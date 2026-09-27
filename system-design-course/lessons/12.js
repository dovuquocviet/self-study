window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Hiệu năng & scale",
  title: "Rate limiting: thuật toán và đặt ở đâu",
  subtitle: "Fixed/sliding window · token bucket · Redis Lua nguyên tử · Workers Rate Limiting binding · 429 & Retry-After",

  theory: `
    <p>Rate limit bảo vệ hệ thống khỏi quá tải (cố ý hay vô tình — một bản app lỗi retry vòng lặp cũng đủ hạ backend), chia công bằng giữa người dùng,
    và chặn lạm dụng (dò OTP, cào dữ liệu). Ba quyết định: <strong>thuật toán</strong>, <strong>khoá</strong> (theo gì mà đếm), <strong>đặt ở đâu</strong>.</p>

    <p><strong>Thuật toán</strong></p>
    <table>
      <tr><th>Thuật toán</th><th>Cách đếm</th><th>Ưu / nhược</th></tr>
      <tr><td>Fixed window</td><td>Bộ đếm theo khung phút: <code>INCR rl:u1:202609270310</code></td><td>Rất rẻ; nhưng dồn ở biên: 100 request cuối phút + 100 đầu phút sau = 200 trong 2 giây</td></tr>
      <tr><td>Sliding window log</td><td>Lưu timestamp từng request (sorted set), đếm trong 60 s gần nhất</td><td>Chính xác; tốn bộ nhớ theo số request</td></tr>
      <tr><td>Sliding window counter</td><td>Ước lượng: đếm khung hiện tại + đếm khung trước × phần chồng lấn</td><td>Rẻ, đủ chính xác cho hầu hết API</td></tr>
      <tr><td>Token bucket</td><td>Xô chứa tối đa B token, nạp r token/s; mỗi request lấy 1</td><td>Cho phép <em>burst</em> ngắn (tới B) nhưng giữ tốc độ trung bình r — hợp với app mobile mở màn hình bắn nhiều call</td></tr>
      <tr><td>Leaky bucket</td><td>Hàng đợi chảy ra tốc độ cố định</td><td>Làm mượt đầu ra; request phải chờ</td></tr>
    </table>

    <p><strong>Khoá đếm</strong>: user id (sau xác thực) là công bằng nhất; IP cho endpoint chưa đăng nhập (login, OTP) — cẩn thận NAT nhà mạng di động nhiều người chung IP;
    API key cho đối tác; kết hợp theo endpoint (<code>POST /otp</code> chặt hơn <code>GET /products</code>).</p>

    <p><strong>Đặt ở đâu — nhiều tầng</strong></p>
    <ul>
      <li><strong>Edge</strong> (Cloudflare WAF rate limiting rules, hoặc Workers Rate Limiting binding): chặn sớm và rẻ, trước khi tốn băng thông về origin.
        Binding của Workers đếm <em>theo từng location</em> của Cloudflare và nhất quán cuối cùng — dùng cho chống lạm dụng, không dùng cho hạn mức tính tiền chính xác.
        Cấu hình <code>simple.period</code> chỉ nhận 10 hoặc 60 giây.</li>
      <li><strong>Gateway/service</strong> với Redis: bộ đếm dùng chung cho mọi instance, chính xác toàn cục. Phép "đọc–tính–ghi" phải nguyên tử → script Lua (Redis chạy script đơn luồng).</li>
      <li><strong>Hạn mức chính xác toàn cầu ở edge</strong>: Durable Object — một object cho mỗi khoá, xử lý tuần tự, trạng thái nhất quán mạnh.</li>
    </ul>

    <p><strong>Trả lời khi vượt</strong>: <code>429 Too Many Requests</code> + <code>Retry-After</code> (giây). App mobile phải tôn trọng Retry-After thay vì retry ngay.
    Khi Redis lỗi: <em>fail-open</em> (cho qua, ưu tiên sẵn sàng) cho API thường; <em>fail-closed</em> cho endpoint nhạy cảm như OTP.</p>

    <div class="callout"><p>💡 Spring hay dùng Bucket4j (token bucket) hoặc Resilience4j RateLimiter <em>trong một JVM</em> — 10 instance thì hạn mức thật là ×10.
    Muốn giới hạn toàn cục phải có kho đếm chung (Redis) hoặc đặt ở tầng chung (edge/gateway). Đây là khác biệt giữa "rate limit của một process" và "của hệ thống".</p></div>
  `,

  codeTabs: [
    { id: "lua", label: "① Token bucket (Redis Lua)", lines: [
      "-- KEYS[1]=rl:{user} ; ARGV: capacity, refill_per_sec, now_ms, cost",
      "local cap, rate, now, cost = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4])",
      "local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')",
      "local tokens = tonumber(b[1]) or cap",
      "local ts     = tonumber(b[2]) or now",
      "tokens = math.min(cap, tokens + (now - ts) / 1000 * rate)   -- nạp theo thời gian trôi qua",
      "local allowed = tokens >= cost",
      "if allowed then tokens = tokens - cost end",
      "redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)",
      "redis.call('PEXPIRE', KEYS[1], math.ceil(cap / rate * 1000))",
      "return { allowed and 1 or 0, tokens }"
    ]},
    { id: "rust", label: "② Middleware Rust", lines: [
      "async fn rate_limit(State(st): State<AppState>, user: AuthUser, req: Request, next: Next) -> Response {",
      "    let key = format!(\"rl:{}\", user.id);",
      "    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;",
      "    // capacity 20 (burst), 5 token/s (trung bình 300/phút)",
      "    match st.bucket.key(&key).arg(20).arg(5).arg(now).arg(1)",
      "            .invoke_async::<(i32, f64)>(&mut st.redis.clone()).await {",
      "        Ok((1, _)) => next.run(req).await,",
      "        Ok((_, _)) => (StatusCode::TOO_MANY_REQUESTS, [(\"Retry-After\", \"1\")]).into_response(),",
      "        Err(_)     => next.run(req).await,     // Redis lỗi: fail-open cho API thường",
      "    }",
      "}",
      "// st.bucket = redis::Script::new(LUA)  — gửi EVALSHA, nguyên tử phía Redis"
    ]},
    { id: "cf", label: "③ Workers binding", lines: [
      "# wrangler.toml",
      "[[ratelimits]]",
      "name = \"OTP_LIMITER\"",
      "namespace_id = \"1001\"        # số nguyên dạng chuỗi, duy nhất trong account",
      "  [ratelimits.simple]",
      "  limit = 5",
      "  period = 60                 # chỉ 10 hoặc 60",
      "",
      "// Worker",
      "const ip = req.headers.get('cf-connecting-ip');",
      "const { success } = await env.OTP_LIMITER.limit({ key: 'otp:' + ip });",
      "if (!success) return new Response('Too many', { status: 429, headers: { 'Retry-After': '60' } });"
    ]},
    { id: "fixed", label: "④ Fixed window & lỗi biên", lines: [
      "INCR rl:u1:202609270310          # khung phút 03:10",
      "EXPIRE rl:u1:202609270310 60 NX",
      "# > 100 -> 429",
      "",
      "03:10:59  100 request  -> khung 03:10 = 100 (OK)",
      "03:11:00  100 request  -> khung 03:11 = 100 (OK)",
      "=> 200 request trong 2 giây dù hạn mức '100/phút'",
      "",
      "# Sliding window counter ước lượng:",
      "# count = cur + prev * (1 - elapsed_in_cur / 60)"
    ]},
    { id: "java", label: "⑤ Per-process vs toàn cục", lines: [
      "// Spring + Bucket4j trong bộ nhớ JVM",
      "Bucket b = Bucket.builder().addLimit(Bandwidth.simple(100, Duration.ofMinutes(1))).build();",
      "// 10 pod => mỗi pod 100/phút => thực tế 1000/phút",
      "",
      "// Toàn cục: bộ đếm ở Redis (tab ①) hoặc ở edge/gateway dùng chung"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App / bot</div><div class="ns">burst khi mở màn hình</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="edge"><div class="nl">☁️ Edge: WAF / Workers binding</div><div class="ns">chặn thô theo IP · theo location</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="gw"><div class="nl">🦀 Gateway/service middleware</div><div class="ns">token bucket theo user</div></div>
    <div class="row">
      <div class="node" id="redis"><div class="nl">🟥 Redis + Lua</div><div class="ns">nguyên tử, chung mọi instance</div></div>
      <div class="node" id="r429"><div class="nl">⛔ 429</div><div class="ns">Retry-After</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Fixed window có lỗi biên", tab: "fixed", highlight: [1, 2, 5, 6, 7], on: ["gw"],
      desc: "Rẻ nhất nhưng cho phép gấp đôi hạn mức quanh ranh giới khung." },
    { title: "2 · Token bucket: burst có kiểm soát", tab: "lua", highlight: [4, 5, 6, 7, 8], on: ["redis"],
      desc: "Xô đầy 20 token cho phép mở màn hình bắn 20 call; sau đó trung bình 5/s." },
    { title: "3 · Nguyên tử nhờ Lua", tab: "lua", highlight: [3, 9, 10], on: ["redis"],
      desc: "Đọc–tính–ghi chạy trọn trong Redis, không có race giữa các instance. PEXPIRE dọn khoá không dùng." },
    { title: "4 · Middleware trong service", tab: "rust", highlight: [2, 5, 7, 8, 9], on: ["a2", "gw", "r429"],
      desc: "Vượt → 429 + Retry-After. Redis lỗi → quyết định fail-open hay fail-closed theo endpoint." },
    { title: "5 · Chặn sớm ở edge", tab: "cf", highlight: [2, 6, 7, 11, 12], on: ["a1", "edge"],
      desc: "OTP 5 lần/phút theo IP ngay ở PoP. Bộ đếm theo từng location, đủ tốt cho chống lạm dụng." },
    { title: "6 · Hạn mức per-process là ảo", tab: "java", highlight: [2, 3, 5], on: ["gw", "redis"],
      desc: "Giới hạn trong JVM/process nhân theo số instance. Toàn cục cần kho đếm chung." }
  ],

  quiz: [
    { q: "Nhược điểm chính của fixed window?", options: [
        "Tốn bộ nhớ",
        "Dồn request quanh biên khung có thể đạt gần gấp đôi hạn mức trong thời gian ngắn",
        "Không dùng được Redis",
        "Quá chính xác"
      ], correct: 1, explanation: "Cuối khung này + đầu khung sau." },
    { q: "Token bucket khác gì so với giới hạn cứng mỗi giây?", options: [
        "Không khác",
        "Cho phép burst tới dung lượng xô, nhưng giữ tốc độ trung bình bằng tốc độ nạp",
        "Không cho burst",
        "Chỉ dùng cho TCP"
      ], correct: 1, explanation: "Hợp với app mở màn hình gọi nhiều API cùng lúc." },
    { q: "Vì sao dùng script Lua cho rate limiter trên Redis?", options: [
        "Lua nhanh hơn Rust",
        "Phép đọc–tính–ghi chạy nguyên tử trong Redis, tránh race giữa nhiều instance",
        "Redis chỉ hỗ trợ Lua",
        "Để mã hoá"
      ], correct: 1, explanation: "GET rồi SET từ client là hai bước tách rời." },
    { q: "10 pod, mỗi pod dùng Bucket4j in-memory 100 req/phút/user. Hạn mức thực tế?", options: [
        "100/phút", "Tới ~1000/phút", "10/phút", "Không giới hạn"
      ], correct: 1, explanation: "Mỗi pod đếm riêng." },
    { q: "Rate Limiting binding của Workers đếm thế nào?", options: [
        "Toàn cầu, nhất quán mạnh",
        "Theo từng location của Cloudflare, nhất quán cuối cùng — hợp chống lạm dụng, không hợp tính tiền chính xác",
        "Theo từng request",
        "Theo từng Worker instance trên máy người dùng"
      ], correct: 1, explanation: "Cần chính xác toàn cục ở edge thì dùng Durable Object." },
    { q: "simple.period của Workers Rate Limiting binding nhận giá trị nào?", options: [
        "Bất kỳ số giây", "10 hoặc 60", "1 hoặc 3600", "Chỉ 1"
      ], correct: 1, explanation: "Theo tài liệu Cloudflare." },
    { q: "Rate limit endpoint gửi OTP theo IP có rủi ro gì với người dùng di động?", options: [
        "Không có",
        "Nhiều người chung IP qua NAT nhà mạng có thể bị chặn oan",
        "IP di động luôn duy nhất",
        "OTP không cần rate limit"
      ], correct: 1, explanation: "Kết hợp thêm khoá theo số điện thoại/thiết bị." },
    { q: "Khi vượt hạn mức, response chuẩn là?", options: [
        "500", "429 kèm Retry-After", "404", "200 rỗng"
      ], correct: 1, explanation: "Client nên chờ theo Retry-After." },
    { q: "Redis rate limiter chết. Với endpoint OTP nên?", options: [
        "Fail-open, cho qua hết",
        "Fail-closed (từ chối) vì lạm dụng OTP tốn tiền SMS và nguy cơ dò mã",
        "Restart app",
        "Không làm gì"
      ], correct: 1, explanation: "API thường có thể fail-open để ưu tiên sẵn sàng." }
  ]
});
