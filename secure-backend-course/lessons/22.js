window.LESSONS.push({
  id: "22",
  phase: "5", phaseName: "Dữ liệu & mật mã",
  title: "Chống lộ dữ liệu nhạy cảm: lỗi, response, log và file export",
  subtitle: "Lỗi chung cho client · tắt debug · DTO response · redact PII · phân loại dữ liệu · CSV/formula injection",

  theory: `
    <p>Không phải vụ lộ dữ liệu nào cũng cần "hack". Rất nhiều vụ đến từ việc chính backend <strong>tự đưa dữ liệu ra ngoài</strong>: một trang lỗi in stack trace kèm
    câu SQL và đường dẫn server, một API trả nguyên object user có cả <code>password_hash</code>, một file log chứa số thẻ và số điện thoại khách hàng,
    một file CSV export khiến Excel của nhân viên tự chạy công thức. Bài này gom các "kênh rò rỉ" phổ biến và cách bịt từng kênh.</p>

    <p><strong>1. Thông báo lỗi: chung chung cho client, chi tiết cho server.</strong> Thông tin lỗi chi tiết (tên bảng, câu truy vấn, phiên bản thư viện, đường dẫn file,
    biến nội bộ) giúp lập trình viên debug — và cũng giúp kẻ tấn công vẽ bản đồ hệ thống, dò injection (bài 04), biết phiên bản có lỗ hổng đã công bố. Nguyên tắc:</p>
    <ul>
      <li>Client nhận: mã HTTP đúng + thông điệp chung + <strong>mã tham chiếu</strong> (<code>errorId</code>/<code>requestId</code>). Ví dụ: <code>{"error": "Đã có lỗi xảy ra", "errorId": "a1b2c3"}</code>.</li>
      <li>Server log: đầy đủ stack trace, ngữ cảnh, cùng <code>errorId</code> đó — support nhận mã từ khách là tra được ngay.</li>
      <li>Dùng <strong>một bộ xử lý lỗi toàn cục</strong> (global exception handler / error middleware) để không có exception nào "lọt" ra ngoài với định dạng mặc định của framework.</li>
      <li>Lỗi validate (400) có thể nói rõ field nào sai — đó là thông tin người dùng cần. Nhưng không lộ chi tiết nội bộ (regex, tên cột DB).</li>
      <li>Lỗi xác thực dùng thông điệp chung: "Email hoặc mật khẩu không đúng" thay vì "Email không tồn tại" (tránh dò tài khoản).</li>
    </ul>

    <p><strong>2. Tắt debug và stack trace trên production.</strong> Hầu như framework nào cũng có chế độ debug tiện lợi — và nguy hiểm nếu để quên:</p>
    <table>
      <tr><th>Framework</th><th>⚠️ Cần tắt trên production</th></tr>
      <tr><td>Django</td><td><code>DEBUG = True</code> (trang lỗi in cả cấu hình), cần đặt <code>ALLOWED_HOSTS</code></td></tr>
      <tr><td>Flask</td><td><code>debug=True</code> / debugger tương tác của Werkzeug — có thể chạy code từ trình duyệt</td></tr>
      <tr><td>Express</td><td><code>NODE_ENV</code> khác <code>production</code> → handler mặc định trả stack trace</td></tr>
      <tr><td>Spring Boot</td><td><code>server.error.include-stacktrace</code>, <code>include-message</code>; Actuator endpoint mở công khai (<code>/actuator/env</code>, <code>heapdump</code>)</td></tr>
      <tr><td>Laravel</td><td><code>APP_DEBUG=true</code></td></tr>
      <tr><td>ASP.NET Core</td><td><code>UseDeveloperExceptionPage()</code> ngoài môi trường Development</td></tr>
      <tr><td>GraphQL</td><td>Introspection + thông báo lỗi chi tiết + "did you mean…" gợi ý field</td></tr>
    </table>
    <p>Thêm vào đó: bỏ header tiết lộ phiên bản (<code>X-Powered-By</code>, <code>Server: nginx/1.x.y</code>), không public thư mục <code>.git</code>, file <code>.env</code>, file backup, source map;
    endpoint quản trị/metrics chỉ mở trong mạng nội bộ. Kiểm tra cấu hình production bằng <strong>test tự động</strong>, đừng dựa vào trí nhớ.</p>

    <p><strong>3. API chỉ trả field cần thiết — DTO response.</strong> Lỗi kinh điển: lấy entity từ ORM rồi <code>return user</code> — serializer in <em>mọi</em> cột,
    kể cả <code>password_hash</code>, <code>reset_token</code>, <code>is_admin</code>, <code>internal_note</code>, <code>deleted_at</code>. Còn tệ hơn: sau này ai đó thêm cột mới vào bảng,
    API tự động lộ luôn cột đó mà không ai review. OWASP API Security gọi đây là <em>Excessive Data Exposure</em> (nay thuộc nhóm Broken Object Property Level Authorization).</p>
    <ul>
      <li>Định nghĩa <strong>DTO/schema response</strong> riêng cho từng use case: <code>UserPublicDto {id, displayName, avatarUrl}</code>, <code>UserSelfDto</code> thêm <code>email</code>.</li>
      <li>Dùng <strong>allowlist</strong> field (chỉ những gì khai báo mới ra ngoài), không dùng denylist (<code>exclude password</code>) — denylist quên cột mới.</li>
      <li><strong>Đừng dựa vào frontend để ẩn</strong>: field bị giấu trên UI vẫn nằm trong JSON, ai mở DevTools cũng thấy.</li>
      <li>Kiểm tra quyền theo từng field khi cần: admin xem được số điện thoại, user thường thì không.</li>
      <li>Giới hạn số lượng: phân trang bắt buộc, không có endpoint "trả toàn bộ bảng".</li>
      <li>Viết test khẳng định response <em>không chứa</em> các field nhạy cảm.</li>
    </ul>

    <p><strong>4. Phân loại dữ liệu — biết mình đang giữ gì.</strong> Không bảo vệ được thứ mình không biết là nhạy cảm. Một bảng phân loại đơn giản giúp cả team ra quyết định nhất quán:</p>
    <table>
      <tr><th>Mức</th><th>Ví dụ</th><th>Xử lý tối thiểu</th></tr>
      <tr><td>Công khai</td><td>Tên sản phẩm, giá niêm yết</td><td>Không yêu cầu đặc biệt</td></tr>
      <tr><td>Nội bộ</td><td>Số liệu vận hành, tên nhân viên</td><td>Chỉ người trong tổ chức; không trả cho client ngoài</td></tr>
      <tr><td>Nhạy cảm / PII</td><td>Email, SĐT, địa chỉ, ngày sinh, IP</td><td>Phân quyền theo nhu cầu, che trong log, hạn chế export, có thời hạn lưu</td></tr>
      <tr><td>Tối mật</td><td>Số CCCD, thông tin thẻ, sức khoẻ, mật khẩu/secret</td><td>Mã hoá cột (bài 20), không bao giờ log, truy cập có audit, tốt nhất là <strong>không lưu</strong> (dùng tokenization của cổng thanh toán)</td></tr>
    </table>
    <p>Nguyên tắc <strong>tối thiểu hoá dữ liệu</strong>: không thu thập thứ không cần, xoá khi hết mục đích. Dữ liệu không tồn tại thì không lộ được. Các luật bảo vệ dữ liệu cá nhân
    (GDPR, Nghị định 13/2023 của Việt Nam…) cũng yêu cầu như vậy.</p>

    <p><strong>5. Che/redact PII trong log.</strong> Log là bản sao dữ liệu ít được bảo vệ nhất: gửi sang nhiều hệ thống, lưu lâu, nhiều người đọc. Cách làm:</p>
    <ul>
      <li><strong>Log sự kiện, không log dữ liệu</strong>: <code>"order created", orderId=123, userId=42</code> thay vì in nguyên body chứa địa chỉ và SĐT.</li>
      <li><strong>Redaction tự động</strong> ở tầng logger theo tên field (<code>password</code>, <code>token</code>, <code>cardNumber</code>, <code>cccd</code>, <code>phone</code>, <code>email</code>) và theo mẫu (chuỗi giống số thẻ).</li>
      <li><strong>Che một phần</strong> khi cần để hỗ trợ: <code>a***@gmail.com</code>, <code>****-****-****-4242</code>, <code>09******89</code>.</li>
      <li><strong>Pseudonymize</strong>: thay email bằng HMAC(email) với khoá riêng để vẫn nối được các dòng log của cùng một người mà không biết người đó là ai.</li>
      <li>Structured logging (JSON) giúp redact theo key chính xác hơn so với log dạng chuỗi tự do.</li>
      <li>Đặt thời hạn lưu log, phân quyền đọc log; nhớ cả các công cụ APM, error tracker (Sentry…) — cấu hình scrubbing ở đó nữa.</li>
    </ul>

    <p><strong>6. CSV / Formula injection khi export.</strong> Nhiều hệ thống có nút "Xuất Excel/CSV" danh sách khách hàng, đơn hàng, feedback. Dữ liệu trong đó có phần do
    <em>người dùng nhập</em> (tên, địa chỉ, ghi chú). Khi mở file bằng Excel/LibreOffice/Google Sheets, ô có nội dung bắt đầu bằng <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>
    (và ký tự Tab, CR) được hiểu là <strong>công thức</strong>. Người dùng ác ý đặt tên là <code>=&lt;cong_thuc_doc&gt;</code>; nhân viên admin mở file export → bảng tính thực thi công thức đó
    trên máy nhân viên (có thể gửi dữ liệu trong bảng ra ngoài hoặc hiện cảnh báo lừa người dùng bấm đồng ý). Server không bị gì, nhưng <strong>người dùng tin cậy của bạn</strong> bị tấn công qua file bạn tạo.</p>
    <p>Phòng thủ:</p>
    <ul>
      <li>Với mỗi ô có nguồn từ người dùng: nếu ký tự đầu là <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>, Tab (<code>\\t</code>) hoặc CR (<code>\\r</code>) → <strong>thêm dấu nháy đơn <code>'</code> phía trước</strong>
        để bảng tính coi là văn bản.</li>
      <li>Sau đó vẫn escape CSV chuẩn: bọc ô trong nháy kép, nhân đôi nháy kép bên trong (dùng thư viện CSV, đừng tự nối chuỗi bằng dấu phẩy).</li>
      <li>Với số âm hợp lệ (<code>-5</code>) mà muốn giữ dạng số: ghi ở cột kiểu số do server kiểm soát, chỉ escape các cột văn bản từ người dùng.</li>
      <li>Nếu xuất <code>.xlsx</code> bằng thư viện: ghi ô dưới dạng <strong>kiểu chuỗi</strong> tường minh, không phải kiểu công thức.</li>
      <li>Export cũng là một kênh lộ dữ liệu: kiểm tra quyền, chỉ xuất cột cần thiết, ghi audit ai xuất gì, lúc nào.</li>
    </ul>

    <div class="callout"><p>💡 Checklist chống lộ dữ liệu: (1) Có global error handler trả lỗi chung + errorId không? (2) Debug/stack trace/Actuator/introspection tắt trên production chưa, có test không?
    (3) Mọi endpoint trả DTO allowlist, không trả entity? (4) Dữ liệu đã phân loại, cột tối mật mã hoá hoặc không lưu? (5) Logger có redact PII và secret?
    (6) Export CSV/Excel có escape ô bắt đầu bằng = + - @ Tab CR không?</p></div>
  `,

  codeTabs: [
    { id: "error", label: "🧯 Xử lý lỗi", lines: [
      "// ❌ Framework mặc định / debug bật: trả nguyên exception",
      "// 500 -> 'SQLException: ... near <cau_truy_van> at db.prod:5432 ...' + stack trace",
      "",
      "// ✅ Global error handler",
      "onError(err, req, res):",
      "    errorId = randomId()",
      "    log.error('unhandled', { errorId, path: req.path, userId: req.user?.id, stack: err.stack })",
      "    if err is ValidationError:",
      "        return res.status(400).json({ error: 'Dữ liệu không hợp lệ', fields: err.publicFields })",
      "    return res.status(500).json({ error: 'Đã có lỗi xảy ra', errorId })",
      "",
      "# Production config: DEBUG=false, NODE_ENV=production, APP_DEBUG=false",
      "# Spring: server.error.include-stacktrace=never ; actuator chỉ mở health"
    ]},
    { id: "dto", label: "📦 DTO response", lines: [
      "// ❌ Trả nguyên entity",
      "handle GET /users/:id -> return db.users.find(id)",
      "// { id, name, email, password_hash, reset_token, is_admin, internal_note, ... }",
      "",
      "// ✅ Allowlist bằng DTO",
      "class UserPublicDto:  id, displayName, avatarUrl",
      "class UserSelfDto:    id, displayName, avatarUrl, email",
      "",
      "handle GET /users/:id (req):",
      "    user = db.users.find(id)",
      "    if req.user.id == user.id: return UserSelfDto.from(user)",
      "    return UserPublicDto.from(user)",
      "// Thêm cột mới vào bảng -> KHÔNG tự lộ ra API"
    ]},
    { id: "langs", label: "🌐 Đa framework", lines: [
      "# Python — Pydantic / FastAPI: response_model chỉ xuất field khai báo",
      "@app.get('/users/{id}', response_model=UserPublic)",
      "# Node.js — map tường minh (hoặc class-transformer @Expose + excludeExtraneousValues)",
      "res.json({ id: u.id, displayName: u.displayName })",
      "# Java / Spring — record DTO",
      "record UserPublic(Long id, String displayName) {}",
      "# Go — struct riêng cho response, field nội bộ gắn json:\"-\"",
      "type UserPublic struct { ID int64 `json:\"id\"`; Name string `json:\"name\"` }",
      "# Rails — serializer / jbuilder chỉ liệt kê attribute cần",
      "attributes :id, :display_name",
      "",
      "# Điểm chung: liệt kê cái ĐƯỢC ra, không liệt kê cái bị cấm"
    ]},
    { id: "redact", label: "🙈 Redact log", lines: [
      "SENSITIVE_KEYS = ['password', 'token', 'authorization', 'cookie',",
      "                  'cardNumber', 'cvv', 'cccd', 'phone', 'email']",
      "",
      "function redact(obj):",
      "    for key in obj:",
      "        if lower(key) in SENSITIVE_KEYS: obj[key] = '[REDACTED]'",
      "        else if isObject(obj[key]): redact(obj[key])",
      "    return obj",
      "",
      "logger.addFormatter(redact)                            // áp dụng cho MỌI log",
      "log.info('order created', { orderId: 123, userId: 42 })  // log sự kiện, không log body",
      "maskEmail('an.nguyen@gmail.com') -> 'a***@gmail.com'",
      "pseudoId = HMAC(logKey, email)                         // nối log mà không lộ danh tính"
    ]},
    { id: "csv", label: "📄 CSV export", lines: [
      "// ❌ Tự nối chuỗi, không escape",
      "line = user.name + ',' + user.note          // name = '=<cong_thuc_doc>' -> Excel chạy công thức",
      "",
      "// ✅ Vô hiệu hoá công thức rồi escape CSV bằng thư viện",
      "DANGEROUS_PREFIX = ['=', '+', '-', '@', '\\t', '\\r']",
      "",
      "function safeCell(value):",
      "    s = toString(value)",
      "    if s.length > 0 and s[0] in DANGEROUS_PREFIX:",
      "        s = \"'\" + s                          // nháy đơn -> bảng tính coi là văn bản",
      "    return s",
      "",
      "csvWriter.writeRow([safeCell(u.name), safeCell(u.note), u.total])  // thư viện lo nháy kép"
    ]}
  ],

  stageHtml: `
    <div class="node" id="data"><div class="nl">🗄️ Dữ liệu trong hệ thống</div><div class="ns">đã phân loại: công khai · nội bộ · PII · tối mật</div></div>
    <div class="arrow" id="a1">↓ bốn kênh có thể rò rỉ</div>
    <div class="row">
      <div class="node" id="err"><div class="nl">🧯 Lỗi</div><div class="ns">chung cho client · chi tiết trong log · tắt debug</div></div>
      <div class="node" id="api"><div class="nl">📦 Response API</div><div class="ns">DTO allowlist · không trả entity</div></div>
      <div class="node" id="logs"><div class="nl">📜 Log</div><div class="ns">redact · che một phần · pseudonymize</div></div>
      <div class="node" id="export"><div class="nl">📄 Export CSV/Excel</div><div class="ns">escape = + - @ · kiểm tra quyền</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="client"><div class="nl">👤 Client / nhân viên</div><div class="ns">chỉ nhận đúng thứ cần thiết</div></div>
  `,
  steps: [
    { title: "1 · Biết mình đang giữ gì", tab: "dto", highlight: [3], on: ["data"],
      desc: "Phân loại dữ liệu trước: cột nào là PII, cột nào tối mật. Dòng 3 cho thấy một entity bình thường chứa rất nhiều thứ không bao giờ được ra ngoài." },
    { title: "2 · Lỗi: chung cho client, chi tiết cho server", tab: "error", highlight: [2, 6, 7, 10], on: ["a1", "err"],
      desc: "Global handler sinh <code>errorId</code>, log đầy đủ stack trace phía server, client chỉ nhận thông điệp chung + mã tham chiếu để báo support." },
    { title: "3 · Tắt debug trên production", tab: "error", highlight: [12, 13], on: ["err"],
      desc: "DEBUG, APP_DEBUG, NODE_ENV, include-stacktrace, Actuator — cấu hình production phải được kiểm tra tự động, không dựa vào trí nhớ." },
    { title: "4 · DTO allowlist cho response", tab: "dto", highlight: [2, 6, 7, 11, 12, 13], on: ["api", "a2", "client"],
      desc: "Không trả entity. Mỗi use case có DTO riêng liệt kê field được phép ra. Cột mới thêm vào DB không tự động lộ." },
    { title: "5 · Framework nào cũng làm được", tab: "langs", highlight: [2, 4, 6, 8, 10], on: ["api"],
      desc: "response_model, map tường minh, record DTO, struct riêng, serializer — cùng một nguyên tắc allowlist." },
    { title: "6 · Redact PII trong log", tab: "redact", highlight: [1, 2, 6, 10, 11, 12, 13], on: ["logs"],
      desc: "Redaction tự động theo tên key áp cho mọi log; log sự kiện kèm id thay vì body; che một phần hoặc pseudonymize khi cần tra cứu." },
    { title: "7 · Export: vô hiệu hoá công thức", tab: "csv", highlight: [2, 5, 9, 10, 13], on: ["export", "client"],
      desc: "Ô từ người dùng bắt đầu bằng <code>= + - @</code>, Tab, CR → thêm nháy đơn phía trước, rồi để thư viện CSV escape phần còn lại. Bảo vệ nhân viên mở file." }
  ],

  quiz: [
    { q: "Khi có exception không lường trước, API nên trả gì cho client?", options: [
        "Nguyên stack trace để client tự debug",
        "Mã HTTP 500 + thông điệp chung + errorId; chi tiết đầy đủ ghi vào log phía server với cùng errorId",
        "Câu SQL gây lỗi",
        "Không trả gì, đóng kết nối"
      ], correct: 1,
      explanation: "Client không cần chi tiết nội bộ; support tra errorId trong log là đủ để debug." },
    { q: "Vì sao để DEBUG=true trên production là nguy hiểm?", options: [
        "Vì làm chậm server một chút",
        "Vì trang lỗi có thể lộ cấu hình, biến môi trường, đường dẫn, câu truy vấn; một số debugger còn cho chạy code",
        "Vì tốn dung lượng ổ đĩa",
        "Vì không ghi được log"
      ], correct: 1,
      explanation: "Chế độ debug thiết kế cho máy dev. Trên production nó là bản đồ hệ thống miễn phí cho kẻ tấn công." },
    { q: "Endpoint GET /users/:id đang 'return db.users.find(id)'. Vấn đề là gì?", options: [
        "Không có vấn đề, chỉ chậm",
        "Serializer trả mọi cột của entity (password_hash, reset_token, is_admin...), cột mới thêm cũng tự lộ",
        "Không trả được JSON",
        "Chỉ lỗi khi id âm"
      ], correct: 1,
      explanation: "Excessive Data Exposure: dùng DTO allowlist để chỉ trả field cần thiết." },
    { q: "Vì sao nên dùng allowlist field (DTO) thay vì denylist (exclude password)?", options: [
        "Vì allowlist chạy nhanh hơn",
        "Vì denylist sẽ bỏ sót các cột nhạy cảm được thêm sau; allowlist chỉ cho ra những gì khai báo",
        "Vì denylist không hỗ trợ JSON",
        "Hai cách giống nhau"
      ], correct: 1,
      explanation: "Mặc định chặn, chỉ mở những gì cần — cùng triết lý với allowlist khi validate input (bài 03)." },
    { q: "Frontend đã ẩn field 'phone' trên giao diện, nhưng API vẫn trả field đó. Có an toàn không?", options: [
        "An toàn vì người dùng không thấy",
        "Không an toàn: ai mở DevTools/gọi API trực tiếp đều đọc được",
        "An toàn nếu dùng HTTPS",
        "An toàn nếu field nằm cuối JSON"
      ], correct: 1,
      explanation: "Mọi thứ gửi xuống client đều coi như công khai với người dùng đó. Lọc phải làm ở server." },
    { q: "Cách log nào phù hợp khi tạo đơn hàng?", options: [
        "log.info(req.body) để có đủ thông tin",
        "log.info('order created', { orderId, userId }) với redaction tự động cho các key nhạy cảm",
        "In số thẻ để tiện đối soát",
        "Không log gì cả"
      ], correct: 1,
      explanation: "Log sự kiện + id là đủ để tra cứu; body chứa địa chỉ, SĐT, thông tin thanh toán không nên vào log." },
    { q: "Pseudonymize email trong log bằng HMAC(logKey, email) giúp gì?", options: [
        "Giải mã lại được email dễ dàng",
        "Vẫn nối được các dòng log của cùng một người mà người đọc log không biết email thật",
        "Nén log nhỏ hơn",
        "Thay thế cho mã hoá DB"
      ], correct: 1,
      explanation: "Cùng email → cùng giá trị HMAC; không có khoá thì không dò ngược được email." },
    { q: "CSV/Formula injection nhắm vào ai?", options: [
        "Database server",
        "Người mở file export bằng bảng tính (thường là nhân viên/admin), vì ô bắt đầu bằng = + - @ bị hiểu là công thức",
        "Trình duyệt của khách hàng",
        "Hệ điều hành của web server"
      ], correct: 1,
      explanation: "Server chỉ tạo file; công thức chạy trên máy người mở file — người dùng tin cậy của hệ thống." },
    { q: "Cách phòng chống CSV injection đúng?", options: [
        "Xoá mọi dấu phẩy khỏi dữ liệu",
        "Với ô văn bản từ người dùng bắt đầu bằng = + - @ Tab CR, thêm dấu nháy đơn phía trước; sau đó escape CSV bằng thư viện",
        "Đổi đuôi file sang .txt",
        "Mã hoá toàn bộ file bằng base64"
      ], correct: 1,
      explanation: "Nháy đơn ở đầu khiến bảng tính coi nội dung là văn bản; thư viện CSV lo nháy kép và dấu phẩy." },
    { q: "Theo nguyên tắc tối thiểu hoá dữ liệu, cách tốt nhất để bảo vệ số thẻ thanh toán là gì?", options: [
        "Lưu dạng văn bản trong bảng riêng",
        "Không lưu: dùng tokenization của cổng thanh toán, hệ thống chỉ giữ token",
        "Lưu và che khi hiển thị",
        "Lưu trong file log để backup"
      ], correct: 1,
      explanation: "Dữ liệu không tồn tại thì không thể lộ. Cổng thanh toán chuyên trách việc bảo vệ số thẻ." },
    { q: "Thông báo lỗi đăng nhập nào an toàn hơn?", options: [
        "\"Email này chưa đăng ký\"",
        "\"Email hoặc mật khẩu không đúng\"",
        "\"Mật khẩu sai, còn 2 ký tự đúng\"",
        "\"Tài khoản tồn tại nhưng mật khẩu sai\""
      ], correct: 1,
      explanation: "Thông điệp chung không giúp kẻ tấn công dò xem email nào có tài khoản." }
  ]
});
