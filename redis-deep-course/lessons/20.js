window.LESSONS.push({
  id: "20",
  phase: "7", phaseName: "Pattern thực chiến",
  title: "Rate limiter: fixed window, sliding window, token bucket",
  subtitle: "INCR + EXPIRE · ZSET sliding log · sliding window counter · token bucket / GCRA bằng Lua",

  theory: `
    <p>Giới hạn "mỗi user tối đa 100 request/phút" khi service có 20 pod: bộ đếm phải ở chỗ chung — Redis. Bốn thuật toán hay gặp:</p>

    <table>
      <tr><th>Thuật toán</th><th>Cấu trúc</th><th>Ưu</th><th>Nhược</th></tr>
      <tr><td><strong>Fixed window</strong></td><td>String: <code>INCR rl:u42:202609271405</code> + EXPIRE</td><td>Rẻ nhất, 1 key/cửa sổ</td><td>Dồn ở biên: 100 req lúc 14:05:59 + 100 lúc 14:06:00 = 200 trong 1 giây</td></tr>
      <tr><td><strong>Sliding log</strong></td><td>ZSET: score = timestamp mỗi request</td><td>Chính xác tuyệt đối</td><td>Tốn RAM O(số request trong cửa sổ)</td></tr>
      <tr><td><strong>Sliding window counter</strong></td><td>2 counter: cửa sổ hiện tại + trước</td><td>Gần chính xác, rẻ</td><td>Xấp xỉ (giả định request trải đều trong cửa sổ trước)</td></tr>
      <tr><td><strong>Token bucket</strong> / GCRA</td><td>Hash hoặc 1 String (thời điểm)</td><td>Cho phép burst có kiểm soát, tốc độ trung bình mượt</td><td>Cần Lua, cần đồng hồ</td></tr>
    </table>

    <p><strong>Fixed window đúng cách</strong>: <code>INCR</code> trả số mới; nếu bằng 1 (key vừa được tạo) thì <code>EXPIRE</code>. Hai lệnh nên nằm trong Lua/MULTI —
    nếu app chết sau INCR mà chưa EXPIRE, key sống mãi và user bị chặn vĩnh viễn. Redis 7 có thể dùng <code>EXPIRE key 60 NX</code> luôn sau INCR (chỉ đặt khi chưa có TTL).</p>

    <p><strong>Sliding window counter</strong>: ước lượng = <em>count_hiện_tại + count_trước × (phần cửa sổ trước còn nằm trong 60 giây gần nhất)</em>.
    Vd 15 giây vào phút mới: 30 + 80 × 45/60 = 90 → còn cho qua. Cloudflare dùng cách này ở quy mô lớn.</p>

    <p><strong>Token bucket</strong>: xô chứa tối đa <em>capacity</em> token, được nạp <em>rate</em> token/giây. Mỗi request lấy 1 token; hết token thì từ chối.
    Không cần tiến trình nạp: lưu (số token, thời điểm cập nhật), mỗi lần gọi tính token nạp thêm theo thời gian trôi qua. <strong>GCRA</strong> là biến thể chỉ lưu một số
    (theoretical arrival time) — gọn hơn nữa; module <code>redis-cell</code> cài sẵn nó (<code>CL.THROTTLE</code>).</p>

    <p><strong>Chi tiết thực tế</strong></p>
    <ul>
      <li>Dùng đồng hồ của <strong>Redis</strong> (<code>redis.call('TIME')</code>) trong Lua thay vì đồng hồ từng pod — 20 pod lệch nhau vài trăm ms là limiter sai.</li>
      <li>Trả header <code>X-RateLimit-Remaining</code>, <code>Retry-After</code> từ kết quả script.</li>
      <li>Redis lỗi thì <strong>fail-open</strong> (cho qua, vì limiter là bảo vệ phụ) hay <strong>fail-closed</strong> (chặn, với API đắt/nhạy cảm như login OTP) — quyết định có chủ đích.</li>
      <li>Trong Cluster, mọi key của một limiter phải cùng slot: <code>rl:{u42}:cur</code>, <code>rl:{u42}:prev</code>.</li>
    </ul>

    <div class="callout"><p>💡 Trên Cloudflare Workers có sẵn Rate Limiting binding và Durable Objects (một object = một luồng, giống tư duy Redis) — không nhất thiết phải gọi Redis từ edge.
    Trong service Rust nội bộ, limiter Lua trên Redis là lựa chọn chuẩn.</p></div>
  `,

  codeTabs: [
    { id: "fixed", label: "① Fixed window", lines: [
      "-- KEYS[1] = rl:{u42}:202609271405   ARGV[1] = limit  ARGV[2] = window (giây)",
      "local n = redis.call('INCR', KEYS[1])",
      "if n == 1 then",
      "  redis.call('EXPIRE', KEYS[1], ARGV[2])",
      "end",
      "if n > tonumber(ARGV[1]) then",
      "  return {0, redis.call('TTL', KEYS[1])}     -- chặn, retry-after",
      "end",
      "return {1, tonumber(ARGV[1]) - n}            -- cho qua, còn lại"
    ]},
    { id: "log", label: "② Sliding log (ZSET)", lines: [
      "-- KEYS[1] = rl:{u42}:log   ARGV = limit, window_ms, request_id",
      "local t = redis.call('TIME')",
      "local now = t[1] * 1000 + math.floor(t[2] / 1000)       -- ms theo đồng hồ Redis",
      "redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - tonumber(ARGV[2]))",
      "if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then",
      "  return 0",
      "end",
      "redis.call('ZADD', KEYS[1], now, ARGV[3])                -- member duy nhất",
      "redis.call('PEXPIRE', KEYS[1], ARGV[2])",
      "return 1"
    ]},
    { id: "tb", label: "③ Token bucket", lines: [
      "-- KEYS[1] = tb:{u42}   ARGV = capacity, rate (token/giây), cost",
      "local cap, rate, cost = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])",
      "local t = redis.call('TIME')",
      "local now = t[1] + t[2] / 1e6",
      "local s = redis.call('HMGET', KEYS[1], 'tokens', 'ts')",
      "local tokens = tonumber(s[1]) or cap",
      "local ts = tonumber(s[2]) or now",
      "tokens = math.min(cap, tokens + (now - ts) * rate)        -- nạp theo thời gian trôi",
      "local ok = 0",
      "if tokens >= cost then tokens = tokens - cost; ok = 1 end",
      "redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))",
      "redis.call('EXPIRE', KEYS[1], math.ceil(cap / rate) * 2)",
      "return ok"
    ]},
    { id: "rs", label: "④ Middleware Rust", lines: [
      "static FIXED: LazyLock<redis::Script> = LazyLock::new(|| redis::Script::new(FIXED_LUA));",
      "",
      "async fn check(con: &mut Conn, user: &str) -> Result<(bool, i64), redis::RedisError> {",
      "    let minute = chrono::Utc::now().format(\"%Y%m%d%H%M\");",
      "    let key = format!(\"rl:{{{user}}}:{minute}\");      // rl:{u42}:202609271405",
      "    let (allowed, n): (i64, i64) = FIXED.key(key).arg(100).arg(60)",
      "        .invoke_async(con).await?;",
      "    Ok((allowed == 1, n))",
      "}",
      "// Err từ Redis -> fail-open (cho qua) hay fail-closed: quyết định theo từng API"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request của user 42</div><div class="ns">20 pod dùng chung một bộ đếm</div></div>
    <div class="arrow" id="a1">↓ EVALSHA limiter (nguyên tử)</div>
    <div class="row">
      <div class="node" id="fw"><div class="nl">🪟 Fixed window</div><div class="ns">INCR + EXPIRE</div></div>
      <div class="node" id="sl"><div class="nl">📜 Sliding log</div><div class="ns">ZSET timestamp</div></div>
      <div class="node" id="tb"><div class="nl">🪣 Token bucket</div><div class="ns">tokens + ts</div></div>
    </div>
    <div class="arrow" id="a2">↓ kết quả</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ 200</div><div class="ns">X-RateLimit-Remaining</div></div>
      <div class="node" id="no"><div class="nl">⛔ 429</div><div class="ns">Retry-After</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Fixed window", tab: "fixed", highlight: [2, 3, 4], on: ["req", "a1", "fw"],
      desc: "INCR tạo key nếu chưa có; lần đầu (n == 1) thì đặt hạn. Cả hai trong Lua nên không có key sống mãi." },
    { title: "2 · Vượt ngưỡng → 429", tab: "fixed", highlight: [6, 7, 9], on: ["a2", "no", "ok"],
      desc: "Trả kèm TTL làm Retry-After. Nhược: dồn gấp đôi ở biên cửa sổ." },
    { title: "3 · Sliding log chính xác", tab: "log", highlight: [2, 3, 4, 5, 8], on: ["sl"],
      desc: "Xoá request cũ hơn cửa sổ, đếm, thêm request mới. Dùng TIME của Redis để mọi pod chung một đồng hồ." },
    { title: "4 · Token bucket cho phép burst", tab: "tb", highlight: [6, 7, 8, 10, 11], on: ["tb"],
      desc: "Không cần tiến trình nạp: tính token theo thời gian trôi qua mỗi lần gọi." },
    { title: "5 · Tích hợp vào service", tab: "rs", highlight: [5, 6, 7, 10], on: ["req", "ok", "no"],
      desc: "Hash tag {u42} để mọi key của một user cùng slot. Quyết định fail-open/fail-closed rõ ràng." }
  ],

  quiz: [
    { q: "Nhược điểm chính của fixed window?", options: [
        "Tốn RAM", "Có thể cho qua gần gấp đôi giới hạn quanh biên hai cửa sổ", "Không dùng được với Redis", "Cần Lua phức tạp"
      ], correct: 1, explanation: "100 cuối phút trước + 100 đầu phút sau." },
    { q: "Vì sao INCR và EXPIRE nên nằm trong cùng Lua/MULTI?", options: [
        "Cho nhanh", "App chết giữa hai lệnh sẽ để lại key không hạn → user bị chặn vĩnh viễn", "EXPIRE không chạy riêng được", "Để replica đồng bộ"
      ], correct: 1, explanation: "Hoặc dùng EXPIRE ... NX (7.0) ngay sau INCR — vẫn nên gom lại." },
    { q: "Sliding log dùng cấu trúc nào?", options: [
        "HyperLogLog", "Sorted Set với score là timestamp", "Bitmap", "List"
      ], correct: 1, explanation: "ZREMRANGEBYSCORE xoá phần cũ, ZCARD đếm." },
    { q: "Nhược điểm của sliding log?", options: [
        "Không chính xác", "Bộ nhớ tỉ lệ với số request trong cửa sổ", "Không có TTL", "Không chạy trong Cluster"
      ], correct: 1, explanation: "Limit 10 000/phút = tới 10 000 member mỗi user." },
    { q: "Sliding window counter: cửa sổ trước 80 request, hiện tại 30, đã qua 15/60 giây của phút mới. Ước lượng?", options: [
        "110", "30 + 80 × 45/60 = 90", "80", "30 + 80 × 15/60 = 50"
      ], correct: 1, explanation: "Phần cửa sổ trước còn nằm trong 60 giây gần nhất là 45/60." },
    { q: "Ưu điểm của token bucket?", options: [
        "Không cần lưu trạng thái", "Cho phép burst tới capacity nhưng giữ tốc độ trung bình bằng rate", "Chính xác tuyệt đối như log", "Không cần đồng hồ"
      ], correct: 1, explanation: "Hợp với API muốn chấp nhận đột biến ngắn." },
    { q: "Vì sao dùng redis.call('TIME') trong script thay vì truyền thời gian từ app?", options: [
        "TIME nhanh hơn", "Mọi pod dùng chung một đồng hồ, tránh lệch giờ giữa các máy", "Bắt buộc về cú pháp", "Để có micro giây"
      ], correct: 1, explanation: "Từ Redis 7 script được replicate theo hiệu ứng nên dùng TIME an toàn." },
    { q: "Trong Cluster, key rl:{u42}:cur và rl:{u42}:prev có ý nghĩa gì?", options: [
        "Không có gì đặc biệt", "Hash tag {u42} đảm bảo cùng slot để dùng chung trong một script", "Tạo 2 cluster", "Đặt TTL chung"
      ], correct: 1, explanation: "Script nhiều key yêu cầu cùng slot." },
    { q: "API gửi OTP đăng nhập, Redis limiter không phản hồi. Chính sách hợp lý?", options: [
        "Fail-open: cho gửi thoải mái", "Fail-closed: tạm chặn, vì API đắt và dễ bị lạm dụng", "Retry vô hạn", "Tắt limiter vĩnh viễn"
      ], correct: 1, explanation: "Quyết định theo mức rủi ro của từng API." }
  ]
});
