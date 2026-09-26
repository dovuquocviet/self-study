window.LESSONS.push({
  id: "23",
  phase: "6", phaseName: "Vận hành & quy trình",
  title: "Rate limiting & chống DoS ở tầng ứng dụng",
  subtitle: "Giới hạn theo user/IP/API key · giới hạn kích thước & độ sâu · timeout mọi lời gọi ra ngoài · ReDoS · đẩy việc nặng vào queue",

  theory: `
    <p>Chữ <strong>A</strong> trong bộ ba CIA là <strong>Availability — tính sẵn sàng</strong>. Một API "chạy đúng" nhưng chỉ cần một người gửi vài request lạ là treo cả server
    thì vẫn là API <em>không an toàn</em>. Tấn công từ chối dịch vụ (DoS) không nhất thiết phải là hàng triệu máy bắn traffic (DDoS mạng — việc của CDN/WAF/nhà cung cấp cloud).
    Rất nhiều vụ sập đến từ <strong>tầng ứng dụng</strong>: một request duy nhất khiến server tốn CPU, RAM, kết nối DB hoặc thời gian gấp hàng nghìn lần bình thường.
    Bài này học cách nhận ra những chỗ "rẻ cho kẻ tấn công, đắt cho server" và chặn chúng bằng code + cấu hình.</p>

    <p><strong>1. Nguyên lý bất đối xứng.</strong> DoS tầng ứng dụng khai thác sự chênh lệch chi phí: client tốn 1 đơn vị công sức, server tốn 1.000 đơn vị. Ví dụ:</p>
    <table>
      <tr><th>Request "rẻ"</th><th>Chi phí "đắt" phía server</th></tr>
      <tr><td><code>GET /products?page_size=10000000</code></td><td>DB quét và trả hàng triệu dòng, server serialize JSON khổng lồ, hết RAM</td></tr>
      <tr><td><code>POST /login</code> gửi liên tục</td><td>Mỗi lần hash mật khẩu chậm (bài 10) tốn ~100ms CPU — cố ý chậm để chống brute-force, nhưng cũng là mục tiêu DoS</td></tr>
      <tr><td>Body JSON 500MB hoặc lồng 100.000 tầng</td><td>Parser đọc hết vào RAM, hoặc đệ quy sâu tới tràn stack</td></tr>
      <tr><td>Một chuỗi đưa vào regex viết kém</td><td>Regex backtracking chạy hàng phút cho một chuỗi 50 ký tự (ReDoS)</td></tr>
      <tr><td><code>POST /reports/export</code></td><td>Sinh file PDF/Excel mất 30 giây, giữ 1 worker và 1 kết nối DB suốt thời gian đó</td></tr>
      <tr><td>Request làm server gọi sang dịch vụ bên thứ ba đang chậm</td><td>Mỗi request treo 60s chờ, thread pool cạn, mọi người dùng khác cũng bị treo</td></tr>
    </table>
    <p>Mục tiêu phòng thủ: <strong>mọi tài nguyên đều có giới hạn trên</strong> — số request, kích thước, độ sâu, số phần tử, thời gian, số việc chạy song song.</p>

    <p><strong>2. Rate limiting — giới hạn tần suất.</strong> Đặt câu hỏi "ai được gọi bao nhiêu lần trong khoảng thời gian nào?". Chọn <em>khoá</em> để đếm:</p>
    <ul>
      <li><strong>Theo user/tài khoản</strong> (sau khi đăng nhập): công bằng nhất, không bị ảnh hưởng khi nhiều người dùng chung một IP (văn phòng, NAT của nhà mạng).</li>
      <li><strong>Theo API key / client_id</strong>: cho đối tác, tích hợp máy-với-máy; mỗi gói dịch vụ có hạn mức khác nhau.</li>
      <li><strong>Theo IP</strong>: dùng cho endpoint chưa đăng nhập (login, đăng ký, quên mật khẩu). Chú ý lấy IP <em>đúng</em>: nếu đứng sau load balancer/reverse proxy,
        chỉ tin header <code>X-Forwarded-For</code> do <strong>proxy của bạn</strong> thêm vào (cấu hình danh sách trusted proxy). Nếu tin mù quáng header do client gửi,
        kẻ tấn công chỉ cần đổi giá trị header mỗi request là "thành người mới".</li>
      <li><strong>Theo đối tượng bị nhắm</strong>: ví dụ số lần thử mật khẩu cho <em>một username</em> bất kể từ IP nào (chống brute-force phân tán — xem bài 11).</li>
      <li><strong>Kết hợp nhiều lớp</strong>: toàn cục (bảo vệ hệ thống) + theo IP + theo user + riêng cho endpoint đắt (export, search, gửi email/SMS).</li>
    </ul>

    <p><strong>3. Thuật toán thường gặp</strong> (không cần tự viết — dùng thư viện/gateway có sẵn):</p>
    <table>
      <tr><th>Thuật toán</th><th>Ý tưởng</th><th>Ghi chú</th></tr>
      <tr><td>Fixed window</td><td>Đếm số request trong mỗi phút tròn (10:00–10:01)</td><td>Đơn giản; có thể bị dồn gấp đôi ở ranh giới hai cửa sổ</td></tr>
      <tr><td>Sliding window</td><td>Đếm trong 60 giây gần nhất tính từ bây giờ</td><td>Mượt hơn, chính xác hơn</td></tr>
      <tr><td>Token bucket</td><td>Xô chứa tối đa N token, mỗi giây nạp r token; mỗi request lấy 1 token</td><td>Cho phép "bùng" ngắn hạn, phổ biến ở API gateway</td></tr>
      <tr><td>Concurrency limit</td><td>Tối đa K request <em>đang chạy cùng lúc</em> cho một user/endpoint</td><td>Hợp với endpoint chậm (export, báo cáo)</td></tr>
    </table>
    <p>Khi chạy nhiều instance, bộ đếm phải nằm ở nơi dùng chung (Redis, gateway) — nếu mỗi instance đếm riêng trong RAM, 10 instance = hạn mức thật gấp 10 lần.
    Khi vượt hạn mức: trả <code>429 Too Many Requests</code> kèm header <code>Retry-After</code>, <strong>không</strong> xử lý tiếp request đó. Nên đặt rate limit càng sớm càng tốt trong pipeline
    (gateway/middleware đầu tiên) để request bị từ chối không kịp tốn tài nguyên.</p>

    <p><strong>4. Giới hạn kích thước và độ phức tạp của input.</strong> Đây là phần mở rộng của validate input (bài 03):</p>
    <ul>
      <li><strong>Kích thước body</strong>: đặt giới hạn ở cả reverse proxy (nginx <code>client_max_body_size</code>) và framework (body parser limit). JSON API thường 100KB–1MB là đủ; upload file có endpoint riêng với giới hạn riêng.</li>
      <li><strong>Phân trang bắt buộc</strong>: <code>page_size</code> có giá trị mặc định (vd 20) và <strong>trần</strong> (vd 100). Không bao giờ có endpoint "trả tất cả". Với dữ liệu lớn, ưu tiên cursor pagination thay vì <code>OFFSET</code> quá sâu (OFFSET 10.000.000 vẫn bắt DB quét).</li>
      <li><strong>Số phần tử</strong>: mảng tối đa N phần tử, số field filter tối đa, số ID trong request batch tối đa.</li>
      <li><strong>Độ sâu lồng nhau</strong>: JSON/XML/GraphQL lồng quá sâu → giới hạn độ sâu (vd ≤ 20), với GraphQL thêm giới hạn độ phức tạp truy vấn.</li>
      <li><strong>File nén / ảnh</strong>: file zip 1MB có thể giải nén ra hàng GB; ảnh nhỏ có thể khai báo kích thước 50.000×50.000 pixel. Kiểm tra kích thước <em>sau giải nén</em>, giới hạn số file, giới hạn số pixel trước khi decode.</li>
      <li><strong>Tổng số header, độ dài URL, số tham số query</strong>: thường cấu hình ở web server.</li>
    </ul>

    <p><strong>5. Timeout cho MỌI lời gọi ra ngoài.</strong> Nhiều thư viện HTTP client, driver DB mặc định <strong>không có timeout</strong> hoặc timeout rất dài.
    Chỉ cần một dịch vụ phụ thuộc chậm lại là toàn bộ worker của bạn đứng chờ — tự DoS chính mình. Quy tắc:</p>
    <ul>
      <li>Đặt <strong>connect timeout</strong> (vd 2s) và <strong>read/total timeout</strong> (vd 5–10s) cho HTTP client, DB, cache, message broker, SMTP.</li>
      <li>Đặt <strong>statement timeout</strong> ở DB để truy vấn chạy quá lâu bị huỷ.</li>
      <li>Có <strong>deadline tổng</strong> cho cả request (vd 30s) và truyền xuống các lời gọi con (context/cancellation token).</li>
      <li>Giới hạn <strong>connection pool</strong> và dùng <strong>circuit breaker</strong>: khi dịch vụ phụ thuộc lỗi liên tục, ngừng gọi một lúc và trả lỗi nhanh thay vì chờ.</li>
      <li>Retry có giới hạn số lần + backoff tăng dần + jitter — retry vô hạn ngay lập tức sẽ nhân traffic lên và đánh sập dịch vụ đang yếu.</li>
    </ul>

    <p><strong>6. ReDoS — khi regex trở thành vũ khí.</strong> Hầu hết engine regex phổ biến (JavaScript, Java, Python <code>re</code>, .NET, PCRE/PHP, Ruby) dùng <strong>backtracking</strong>:
    khi khớp thất bại, engine quay lui thử mọi cách chia chuỗi khác. Với một số pattern "có hai cách khớp cùng một đoạn", số cách thử tăng <strong>theo cấp số mũ</strong>
    theo độ dài chuỗi — chuỗi 30 ký tự đã có thể khiến CPU chạy 100% hàng phút, và trong Node.js (một luồng) điều đó treo <em>toàn bộ</em> server.</p>
    <p>Dấu hiệu pattern nguy hiểm cần tránh:</p>
    <ul>
      <li><strong>Lượng từ lồng nhau</strong>: một nhóm có <code>+</code> hoặc <code>*</code> bên trong, rồi cả nhóm lại có <code>+</code>/<code>*</code> bên ngoài — dạng <code>(x+)+</code>.</li>
      <li><strong>Lựa chọn chồng lấp được lặp lại</strong>: <code>(a|a)*</code>, <code>(\\w|\\d)+</code> — hai nhánh cùng khớp một ký tự.</li>
      <li><strong>Nhiều đoạn <code>.*</code> liền nhau</strong> trên chuỗi dài không bị giới hạn độ dài.</li>
    </ul>
    <p>Cách phòng thủ:</p>
    <ol>
      <li><strong>Giới hạn độ dài input trước khi đưa vào regex</strong> (vd email ≤ 254 ký tự). Đơn giản mà hiệu quả nhất.</li>
      <li><strong>Dùng engine thời gian tuyến tính</strong>: RE2 (Go <code>regexp</code> mặc định đã là RE2, Rust <code>regex</code> crate cũng tuyến tính), thư viện <code>re2</code> cho Node/Python/Java.
        Engine này không hỗ trợ backreference/lookaround nhưng đảm bảo thời gian chạy tỷ lệ với độ dài chuỗi.</li>
      <li><strong>Đặt timeout cho regex</strong> nếu nền tảng hỗ trợ (.NET có <code>matchTimeout</code>, Java có thể dùng CharSequence có kiểm tra ngắt, Python 3.11+ có atomic group/possessive quantifier).</li>
      <li><strong>Không nhận regex từ người dùng</strong>. Nếu buộc phải cho tìm kiếm theo pattern, chạy bằng RE2 kèm timeout.</li>
      <li><strong>Dùng parser/thư viện chuẩn</strong> thay vì tự viết regex phức tạp cho email, URL, ngày giờ.</li>
      <li><strong>Quét tự động</strong>: nhiều công cụ SAST/linter có rule phát hiện regex có nguy cơ backtracking thảm hoạ (vd eslint-plugin-regexp, safe-regex, CodeQL).</li>
    </ol>

    <p><strong>7. Việc nặng → đưa vào queue.</strong> Request HTTP nên ngắn. Việc tốn thời gian (xuất báo cáo, xử lý ảnh/video, gửi email hàng loạt, gọi AI) nên:</p>
    <ol>
      <li>API nhận request, validate, kiểm tra hạn mức, ghi một job vào queue (RabbitMQ, SQS, Kafka, Redis stream, bảng job trong DB…) và trả ngay <code>202 Accepted</code> + <code>job_id</code>.</li>
      <li>Worker riêng lấy job ra xử lý với <strong>số worker cố định</strong> — nên dù có 10.000 job, CPU/DB chỉ chịu tải đúng bằng số worker.</li>
      <li>Client hỏi trạng thái qua <code>GET /jobs/{id}</code> (có kiểm tra quyền sở hữu job — bài 13) hoặc nhận webhook/thông báo khi xong.</li>
      <li>Giới hạn số job <em>đang chờ</em> cho mỗi user; queue có độ dài tối đa; job có timeout và số lần retry tối đa; job lỗi mãi đưa vào dead-letter queue.</li>
    </ol>

    <p><strong>8. Các chỗ hay quên.</strong> Endpoint gửi email/SMS/OTP (vừa tốn tiền vừa bị lợi dụng để spam người khác — cần hạn mức theo người nhận);
    endpoint search full-text; webhook nhận từ bên ngoài; endpoint tạo tài nguyên (tạo tài khoản, tạo workspace) — không giới hạn thì bị tạo hàng triệu bản ghi rác;
    log (request lỗi nào cũng ghi stack trace dài → đầy ổ đĩa).</p>

    <div class="callout"><p>💡 Kiểm tra nhanh cho mỗi endpoint: "Nếu một người gọi endpoint này 1.000 lần/giây, với input lớn nhất có thể, thì cái gì hết trước — CPU, RAM, kết nối DB, tiền SMS hay ổ đĩa?"
    Câu trả lời chính là chỗ cần đặt giới hạn.</p></div>
  `,

  codeTabs: [
    { id: "rl", label: "🚦 Rate limit", lines: [
      "// Middleware rate limit dùng token bucket, bộ đếm chung trong Redis",
      "function rateLimit(policy):",
      "    return middleware(req, res, next):",
      "        key = policy.keyOf(req)            // user.id / apiKey / trustedClientIp(req)",
      "        allowed, retryAfter = redisBucket.take(policy.name + ':' + key,",
      "                                  capacity=policy.burst, refillPerSec=policy.rate)",
      "        if not allowed:",
      "            res.setHeader('Retry-After', retryAfter)",
      "            return res.status(429).json({ error: 'too_many_requests' })",
      "        next()",
      "",
      "// Nhiều lớp: toàn cục + theo IP cho endpoint công khai + theo user + endpoint đắt",
      "app.use(rateLimit({ name: 'global', keyOf: r => 'all', rate: 2000, burst: 4000 }))",
      "app.post('/login',   rateLimit({ name: 'login-ip', keyOf: r => trustedClientIp(r), rate: 0.2, burst: 10 }), login)",
      "app.use('/api',      rateLimit({ name: 'user', keyOf: r => r.user.id, rate: 20, burst: 60 }))",
      "app.post('/exports', rateLimit({ name: 'export', keyOf: r => r.user.id, rate: 0.01, burst: 3 }), createExport)",
      "",
      "// Chỉ tin X-Forwarded-For khi request đi qua proxy của mình",
      "function trustedClientIp(req):",
      "    return framework.clientIp(req, trustedProxies=['10.0.0.0/8'])"
    ]},
    { id: "limits", label: "📏 Giới hạn input", lines: [
      "// 1) Kích thước body — đặt ở cả proxy và framework",
      "# nginx:     client_max_body_size 1m;",
      "app.use(jsonParser({ limit: '1mb', maxDepth: 20 }))",
      "",
      "// 2) Phân trang: có mặc định và có TRẦN",
      "ListQuery = {",
      "    page_size: integer(min=1, max=100, default=20),",
      "    cursor:    optional string(maxLength=200),",
      "    ids:       optional array(maxItems=50) of uuid,",
      "    q:         optional string(maxLength=100)",
      "}",
      "",
      "// 3) Timeout ở DB: truy vấn quá 5s bị huỷ",
      "# PostgreSQL:  SET statement_timeout = '5s';",
      "# MySQL:       SET SESSION max_execution_time = 5000;",
      "",
      "// 4) File nén / ảnh: kiểm tra TRƯỚC khi giải nén/decode toàn bộ",
      "if archive.totalUncompressedSize() > 100 * MB or archive.entryCount() > 1000: reject(413)",
      "if image.headerWidth() * image.headerHeight() > 40_000_000: reject(413)"
    ]},
    { id: "timeout", label: "⏱️ Timeout", lines: [
      "# Node.js (fetch + AbortSignal)",
      "const res = await fetch(url, { signal: AbortSignal.timeout(5000) })",
      "",
      "# Python (requests): (connect, read) — mặc định KHÔNG có timeout!",
      "r = requests.get(url, timeout=(2, 5))",
      "",
      "# Go: http.Client mặc định cũng không có timeout",
      "client := &http.Client{ Timeout: 5 * time.Second }",
      "ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second); defer cancel()",
      "",
      "# Java (java.net.http)",
      "HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();",
      "HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).build();",
      "",
      "// Circuit breaker + retry có giới hạn",
      "payment = circuitBreaker(callPaymentApi, failureThreshold=5, openFor=30s)",
      "retry(payment, maxAttempts=3, backoff=exponential(200ms), jitter=true)"
    ]},
    { id: "redos", label: "🧨 ReDoS", lines: [
      "// ❌ Lượng từ lồng nhau: nhóm có '+' bên trong, cả nhóm lại có '+'",
      "const bad = /^(\\w+\\s?)+$/",
      "bad.test(<user_input_payload>)   // chuỗi dài không khớp ở cuối -> backtracking hàm mũ",
      "",
      "// ✅ 1. Giới hạn độ dài TRƯỚC khi chạy regex",
      "if (input.length > 100) return reject(400)",
      "",
      "// ✅ 2. Viết lại pattern không chồng lấp (mỗi ký tự chỉ có một cách khớp)",
      "const good = /^\\w+(\\s\\w+)*$/",
      "",
      "// ✅ 3. Dùng engine tuyến tính RE2",
      "# Go:     regexp.MustCompile(...)      // mặc định đã là RE2",
      "# Rust:   regex::Regex::new(...)       // tuyến tính",
      "# Node:   new RE2('^\\\\w+(\\\\s\\\\w+)*$')  // package re2",
      "# Python: import re2",
      "",
      "// ✅ 4. Timeout cho regex nếu nền tảng hỗ trợ",
      "# .NET:   new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(100))"
    ]},
    { id: "queue", label: "📬 Queue", lines: [
      "// API: nhận, kiểm tra, xếp hàng, trả ngay",
      "handle POST /exports (req):",
      "    params = ExportRequest.parse(req.body)",
      "    if jobs.countPending(owner=req.user.id) >= 3:",
      "        return 429 { error: 'too_many_pending_jobs' }",
      "    job = jobs.create(owner=req.user.id, params, status='queued')",
      "    queue.publish('exports', { jobId: job.id })",
      "    return 202 { job_id: job.id }",
      "",
      "// Worker: số lượng cố định, mỗi job có timeout",
      "worker(concurrency=4) on 'exports' (msg):",
      "    job = jobs.get(msg.jobId)",
      "    withTimeout(120s): generateReport(job)",
      "    on failure: retry(max=3) then moveTo('exports.dead-letter')",
      "",
      "handle GET /jobs/:id (req):",
      "    job = jobs.findOne(id=req.params.id, owner=req.user.id)   // chống IDOR",
      "    return job ? 200 job.status : 404"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">🌐 Client / kẻ tấn công</div><div class="ns">gửi nhiều request, input lớn, pattern đặc biệt</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="limiter"><div class="nl">🚦 Rate limiter (gateway/middleware đầu tiên)</div><div class="ns">theo IP · user · API key · endpoint đắt → 429</div></div>
    <div class="arrow" id="a2">↓ còn hạn mức</div>
    <div class="node" id="size"><div class="nl">📏 Giới hạn input</div><div class="ns">body ≤ 1MB · page_size ≤ 100 · độ sâu ≤ 20 · độ dài trước regex</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="handler"><div class="nl">⚙️ Handler</div><div class="ns">regex tuyến tính · timeout mọi lời gọi ngoài</div></div>
      <div class="node" id="queue"><div class="nl">📬 Queue + worker cố định</div><div class="ns">việc nặng → 202 + job_id</div></div>
    </div>
    <div class="arrow" id="a4">↓ timeout · circuit breaker</div>
    <div class="node" id="deps"><div class="nl">🗄️ DB / dịch vụ ngoài</div><div class="ns">statement timeout · pool giới hạn</div></div>
  `,
  steps: [
    { title: "1 · Mọi tài nguyên cần một giới hạn trên", tab: "rl", highlight: [12, 13], on: ["client", "a1", "limiter"],
      desc: "DoS tầng ứng dụng khai thác chênh lệch chi phí: client tốn ít, server tốn nhiều. Lớp đầu tiên là giới hạn tổng số request toàn hệ thống để dù có chuyện gì, server vẫn không bị dội quá sức." },
    { title: "2 · Chọn khoá đếm phù hợp", tab: "rl", highlight: [4, 14, 15, 16, 19, 20], on: ["limiter"],
      desc: "Endpoint công khai (login) đếm theo IP thật lấy qua trusted proxy; API đã đăng nhập đếm theo <code>user.id</code>; endpoint đắt (export) có hạn mức riêng rất thấp. Bộ đếm nằm trong Redis để mọi instance dùng chung." },
    { title: "3 · Vượt hạn mức → 429 ngay", tab: "rl", highlight: [5, 6, 7, 8, 9], on: ["limiter", "a2"],
      desc: "Request vượt hạn mức bị trả <code>429 Too Many Requests</code> kèm <code>Retry-After</code> và dừng ngay — không chạm tới DB hay logic nghiệp vụ." },
    { title: "4 · Giới hạn kích thước, số lượng, độ sâu", tab: "limits", highlight: [2, 3, 7, 9, 18, 19], on: ["a2", "size"],
      desc: "Body tối đa 1MB, JSON sâu tối đa 20 tầng, <code>page_size</code> có trần 100, mảng tối đa 50 phần tử, file nén/ảnh kiểm tra kích thước thật <em>trước</em> khi giải nén/decode." },
    { title: "5 · Regex: giới hạn độ dài + engine tuyến tính", tab: "redos", highlight: [2, 3, 6, 9, 12, 14], on: ["size", "a3", "handler"],
      desc: "Pattern có lượng từ lồng nhau khiến engine backtracking thử số cách tăng theo hàm mũ. Phòng thủ: cắt độ dài trước, viết pattern không chồng lấp, hoặc dùng RE2 — thời gian chạy tỉ lệ tuyến tính với độ dài chuỗi." },
    { title: "6 · Timeout cho mọi lời gọi ra ngoài", tab: "timeout", highlight: [2, 5, 8, 9, 16, 17], on: ["handler", "a4", "deps"],
      desc: "Nhiều HTTP client mặc định không có timeout. Một dịch vụ phụ thuộc chậm sẽ giữ hết worker của bạn. Đặt connect/read timeout, statement timeout ở DB, circuit breaker và retry có giới hạn + backoff." },
    { title: "7 · Việc nặng đưa vào queue", tab: "queue", highlight: [4, 5, 7, 8, 11, 13, 17], on: ["queue", "deps"],
      desc: "API chỉ xếp job và trả <code>202</code>. Số worker cố định nên tải lên DB luôn có trần; mỗi user chỉ được vài job đang chờ; job có timeout, retry giới hạn và dead-letter queue." }
  ],

  quiz: [
    { q: "API có 5 instance, mỗi instance đếm rate limit trong RAM của riêng nó với hạn mức 100 request/phút/user. Hạn mức thực tế một user có thể đạt là bao nhiêu?", options: [
        "100 request/phút",
        "Khoảng 500 request/phút, vì mỗi instance đếm riêng",
        "20 request/phút",
        "Không giới hạn"
      ], correct: 1,
      explanation: "Load balancer chia request cho 5 instance, mỗi instance cho 100 → tổng ~500. Bộ đếm phải nằm ở nơi dùng chung (Redis, API gateway)." },
    { q: "Service đứng sau load balancer và rate limit endpoint /login theo IP lấy thẳng từ header X-Forwarded-For do client gửi. Vấn đề là gì?", options: [
        "Không có vấn đề, header này luôn chính xác",
        "Kẻ tấn công đổi giá trị header mỗi request để được tính như một IP mới, vượt qua rate limit",
        "Header này làm chậm request",
        "Chỉ gây lỗi với IPv6"
      ], correct: 1,
      explanation: "Chỉ tin phần X-Forwarded-For do proxy của chính bạn thêm vào (cấu hình trusted proxies). Giá trị do client tự đặt là input không tin cậy." },
    { q: "Khi request vượt hạn mức, phản hồi đúng chuẩn là gì?", options: [
        "200 OK với body rỗng",
        "500 Internal Server Error",
        "429 Too Many Requests kèm header Retry-After, và không xử lý request",
        "Vẫn xử lý nhưng chậm hơn"
      ], correct: 2,
      explanation: "429 báo rõ lý do cho client hợp lệ, Retry-After cho biết khi nào thử lại; quan trọng nhất là request bị dừng trước khi tốn tài nguyên." },
    { q: "Endpoint GET /orders nhận page_size từ client, không có giới hạn. Cách sửa tốt nhất?", options: [
        "Tin client vì client là app của mình",
        "Đặt mặc định (vd 20) và trần (vd 100) trong schema validate; dữ liệu lớn dùng cursor pagination",
        "Bỏ phân trang, luôn trả tất cả",
        "Chỉ log cảnh báo khi page_size lớn"
      ], correct: 1,
      explanation: "Mọi tài nguyên cần giới hạn trên. Client (hoặc kẻ giả làm client) có thể gửi bất kỳ số nào." },
    { q: "Regex nào sau đây có nguy cơ ReDoS (backtracking thảm hoạ) cao nhất?", options: [
        "^[a-z0-9]{3,30}$",
        "^(\\w+\\s?)+$",
        "^\\d{4}-\\d{2}-\\d{2}$",
        "^[A-Z]{2}$"
      ], correct: 1,
      explanation: "Nhóm có \\w+ bên trong và + bên ngoài, lại có \\s? tuỳ chọn → cùng một đoạn chữ có rất nhiều cách chia. Khi chuỗi không khớp ở cuối, engine thử hết mọi cách chia — tăng theo hàm mũ." },
    { q: "Vì sao ReDoS đặc biệt nguy hiểm với server Node.js?", options: [
        "Vì Node.js không hỗ trợ regex",
        "Vì Node.js chạy JavaScript trên một luồng chính: một regex chạy hàng phút làm treo mọi request khác",
        "Vì Node.js dùng RE2 mặc định",
        "Vì regex trong Node.js được biên dịch sang SQL"
      ], correct: 1,
      explanation: "Event loop bị chiếm bởi một phép so khớp → toàn bộ server không phục vụ ai được. Một request là đủ làm sập." },
    { q: "Biện pháp nào KHÔNG giúp chống ReDoS?", options: [
        "Giới hạn độ dài input trước khi chạy regex",
        "Dùng engine tuyến tính như RE2",
        "Tăng số lần retry khi regex chạy lâu",
        "Viết lại pattern để mỗi ký tự chỉ có một cách khớp"
      ], correct: 2,
      explanation: "Retry chỉ chạy lại phép so khớp đắt đỏ thêm nhiều lần — làm tình hình tệ hơn." },
    { q: "Thư viện HTTP client trong Python (requests) và Go (http.Client mặc định) có đặc điểm gì cần lưu ý?", options: [
        "Tự động có timeout 1 giây",
        "Mặc định không có timeout — một dịch vụ chậm có thể giữ worker vô thời hạn",
        "Tự động retry vô hạn",
        "Không hỗ trợ HTTPS"
      ], correct: 1,
      explanation: "Luôn đặt timeout rõ ràng: requests.get(url, timeout=(2, 5)), http.Client{Timeout: 5 * time.Second}." },
    { q: "Endpoint xuất báo cáo mất 30–60 giây. Thiết kế nào chống DoS tốt nhất?", options: [
        "Cho request HTTP chạy đến khi xong, tăng timeout của load balancer lên 10 phút",
        "Nhận request, kiểm tra hạn mức, đẩy job vào queue, trả 202 + job_id; worker số lượng cố định xử lý",
        "Chạy báo cáo trong một thread mới cho mỗi request, không giới hạn",
        "Cache báo cáo trong RAM mãi mãi"
      ], correct: 1,
      explanation: "Queue + số worker cố định đặt trần cho tải; giới hạn số job đang chờ mỗi user ngăn một người xếp hàng nghìn job." },
    { q: "Endpoint gửi OTP qua SMS chỉ rate limit theo IP. Rủi ro còn lại là gì?", options: [
        "Không còn rủi ro",
        "Kẻ tấn công dùng nhiều IP để gửi hàng loạt SMS tới cùng một số (spam người khác) hoặc tới nhiều số (tốn tiền của bạn)",
        "OTP bị lộ trong URL",
        "SMS bị mã hoá sai"
      ], correct: 1,
      explanation: "Cần thêm hạn mức theo số điện thoại nhận, theo tài khoản và hạn mức tổng chi phí — không chỉ theo IP." },
    { q: "Retry khi gọi dịch vụ phụ thuộc nên được cấu hình thế nào?", options: [
        "Retry ngay lập tức, vô hạn lần cho tới khi thành công",
        "Số lần tối đa nhỏ, backoff tăng dần có jitter, kết hợp circuit breaker",
        "Không bao giờ retry",
        "Retry song song 10 lần cùng lúc để lấy kết quả nhanh nhất"
      ], correct: 1,
      explanation: "Retry vô hạn/ngay lập tức nhân traffic lên đúng lúc dịch vụ đang yếu, biến sự cố nhỏ thành sập dây chuyền." }
  ]
});
