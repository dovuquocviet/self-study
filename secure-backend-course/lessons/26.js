window.LESSONS.push({
  id: "26",
  phase: "6", phaseName: "Vận hành & quy trình",
  title: "Logging, monitoring & phản ứng sự cố",
  subtitle: "Log sự kiện bảo mật · audit log không sửa được · chống log injection · không log secret/PII · cảnh báo bất thường · quy trình ứng phó sự cố",

  theory: `
    <p>Mọi bài trước đều nói về <strong>ngăn chặn</strong>. Nhưng không hệ thống nào ngăn được 100%. Câu hỏi tiếp theo là: <strong>khi có chuyện, bạn có biết không — và biết sau bao lâu?</strong>
    Nhiều vụ rò rỉ lớn chỉ được phát hiện sau hàng tháng, thường là do bên thứ ba báo, vì hệ thống không ghi lại hoặc không ai nhìn vào những gì đã ghi.
    OWASP gọi nhóm này là <strong>Security Logging and Monitoring Failures</strong>. Bài này học cách log <em>đúng thứ</em>, log <em>an toàn</em>, biến log thành <em>cảnh báo</em>,
    và có sẵn <em>quy trình</em> khi cảnh báo kêu.</p>

    <p><strong>1. Log những sự kiện bảo mật nào?</strong></p>
    <table>
      <tr><th>Nhóm</th><th>Sự kiện</th></tr>
      <tr><td>Xác thực</td><td>Đăng nhập thành công/thất bại, khoá tài khoản, đăng xuất, bật/tắt MFA, đặt lại mật khẩu, đổi email/số điện thoại, tạo/thu hồi API key</td></tr>
      <tr><td>Phân quyền</td><td><strong>Bị từ chối truy cập</strong> (403, truy cập object của người khác — bài 13), cấp/thu quyền, đổi vai trò, thêm người vào tổ chức</td></tr>
      <tr><td>Dữ liệu nhạy cảm</td><td>Xuất dữ liệu hàng loạt, xem hồ sơ người khác (nhân viên hỗ trợ), xoá dữ liệu, thay đổi thông tin thanh toán</td></tr>
      <tr><td>Validate thất bại bất thường</td><td>Input vi phạm schema theo kiểu lạ, chữ ký webhook sai, token giả mạo, CSRF token sai</td></tr>
      <tr><td>Hệ thống</td><td>Thay đổi cấu hình, deploy, khởi động lại, lỗi 5xx tăng đột biến, rate limit bị kích hoạt (bài 23)</td></tr>
    </table>
    <p>Mỗi bản ghi cần trả lời được <strong>Ai · Làm gì · Với cái gì · Khi nào · Từ đâu · Kết quả ra sao</strong>:
    <code>actor_id</code>, <code>action</code>, <code>target</code>, <code>timestamp</code> (UTC, đồng bộ giờ NTP), <code>ip</code>/<code>user_agent</code>, <code>outcome</code>, cùng <code>request_id</code>/<code>trace_id</code> để nối các log liên quan.</p>

    <p><strong>2. Log có cấu trúc (structured logging).</strong> Ghi log dạng JSON với các field cố định thay vì câu văn tự do. Lợi ích kép: dễ truy vấn/cảnh báo (<code>action = "login" AND outcome = "failure"</code>),
    và <strong>an toàn hơn</strong> — giá trị người dùng nằm trong một field được thư viện escape, không trộn vào cấu trúc dòng log.</p>

    <p><strong>3. Log injection — khi input làm giả log.</strong> Nếu ghi log kiểu nối chuỗi <code>"login failed for user " + username</code> vào file text, một username chứa ký tự xuống dòng
    có thể tạo ra một <em>dòng log giả</em> trông như sự kiện thật (vd giả "đăng nhập thành công của admin"), làm rối điều tra. Nếu log được hiển thị trên dashboard web, ký tự HTML trong log có thể gây XSS
    cho người đọc log. Một số thư viện log cũ còn diễn giải cú pháp đặc biệt bên trong thông điệp (bài học lớn từ sự cố Log4Shell năm 2021). Cách phòng:</p>
    <ul>
      <li><strong>Structured logging</strong>: input là giá trị của field, thư viện JSON tự escape ký tự xuống dòng và ký tự điều khiển.</li>
      <li>Nếu buộc phải log text: <strong>thay/escape ký tự CR, LF và ký tự điều khiển</strong> trong mọi giá trị đến từ người dùng; giới hạn độ dài.</li>
      <li>Dùng API tham số hoá của thư viện log (<code>log.info("user {}", name)</code>) thay vì nối chuỗi; tắt tính năng tra cứu/diễn giải trong thông điệp; <strong>cập nhật thư viện log</strong> (bài 24).</li>
      <li>Giao diện xem log phải <strong>output-encode</strong> khi hiển thị (bài 15) — log là dữ liệu không tin cậy.</li>
    </ul>

    <p><strong>4. KHÔNG log secret và dữ liệu cá nhân (PII).</strong> Log thường được giữ lâu, sao chép sang nhiều hệ thống (ELK, Datadog, S3), nhiều người đọc được — tức là <em>kém được bảo vệ hơn database</em>.
    Những thứ không bao giờ được vào log:</p>
    <ul>
      <li>Mật khẩu (kể cả mật khẩu <em>sai</em> — thường là mật khẩu đúng gõ nhầm một ký tự hoặc mật khẩu của tài khoản khác), OTP, câu trả lời bảo mật.</li>
      <li>Session ID, access token, refresh token, API key, header <code>Authorization</code>, <code>Cookie</code>, khoá bí mật, connection string có mật khẩu.</li>
      <li>Số thẻ đầy đủ, CVV; số CMND/CCCD, dữ liệu sức khoẻ; nội dung body đầy đủ của request thanh toán/đăng ký.</li>
      <li>URL chứa token (link đặt lại mật khẩu, link có chữ ký) — chú ý access log của web server ghi cả query string.</li>
    </ul>
    <p>Cách làm: <strong>allowlist field</strong> được log (thay vì log cả object request), dùng bộ <strong>redact tự động</strong> theo tên field (<code>password</code>, <code>token</code>, <code>authorization</code>, <code>secret</code>…),
    <strong>mask</strong> khi cần nhận diện (chỉ 4 số cuối thẻ, email dạng <code>n***@example.com</code>), dùng ID nội bộ thay vì email/số điện thoại. Có test khẳng định secret không xuất hiện trong log.
    Đặt <strong>thời gian lưu giữ</strong> hợp lý và phân quyền đọc log.</p>

    <p><strong>5. Audit log không sửa được.</strong> Khi điều tra, câu hỏi đầu tiên là "log này có đáng tin không?". Kẻ đã chiếm quyền thường cố xoá dấu vết. Audit log cần:</p>
    <ul>
      <li><strong>Chỉ ghi thêm (append-only)</strong>: ứng dụng có quyền INSERT nhưng không UPDATE/DELETE bảng audit; hoặc gửi ra hệ thống riêng.</li>
      <li><strong>Tách khỏi hệ thống được ghi</strong>: đẩy log ngay sang nơi lưu trữ tập trung (SIEM, log service của cloud) mà tài khoản ứng dụng không có quyền xoá.</li>
      <li><strong>Lưu trữ bất biến</strong>: object storage bật chế độ WORM/Object Lock, hoặc log service có retention lock.</li>
      <li><strong>Chống sửa có kiểm chứng</strong>: chuỗi hash (mỗi bản ghi chứa hash của bản ghi trước) hoặc ký định kỳ — sửa/xoá một dòng ở giữa sẽ làm đứt chuỗi.</li>
      <li>Theo dõi cả việc <em>tắt log</em>: log ngừng chảy đột ngột cũng là một cảnh báo.</li>
    </ul>

    <p><strong>6. Monitoring & cảnh báo bất thường.</strong> Log không ai đọc thì vô ích. Biến sự kiện thành cảnh báo có ngưỡng:</p>
    <ul>
      <li>Nhiều lần đăng nhập thất bại cho nhiều tài khoản từ cùng nguồn (credential stuffing) hoặc cho một tài khoản từ nhiều nguồn.</li>
      <li>Đăng nhập thành công ngay sau chuỗi thất bại; đăng nhập từ quốc gia/thiết bị mới rồi đổi email + mật khẩu ngay.</li>
      <li>Tỷ lệ 403/404 tăng vọt từ một user (đang dò ID của người khác).</li>
      <li>Một tài khoản đọc/xuất số bản ghi vượt xa bình thường; truy vấn DB bất thường.</li>
      <li>Cấp quyền admin, tạo API key mới, thay đổi cấu hình bảo mật, tắt MFA — nên thông báo cho cả người dùng liên quan.</li>
      <li>Lỗi validate/chữ ký tăng đột biến; rate limit liên tục bị kích hoạt.</li>
    </ul>
    <p>Cảnh báo phải <strong>có người nhận và có hướng xử lý</strong> (runbook). Quá nhiều cảnh báo vô nghĩa → mọi người tắt thông báo → cảnh báo thật bị bỏ qua. Bắt đầu với ít cảnh báo chất lượng cao.</p>

    <p><strong>7. Quy trình phản ứng sự cố cơ bản.</strong> Khi nghi ngờ bị tấn công, hoảng loạn là kẻ thù. Có quy trình viết sẵn và tập dượt (tabletop exercise) trước:</p>
    <ol>
      <li><strong>Chuẩn bị</strong>: ai trực, liên lạc qua kênh nào (kể cả khi hệ thống chat bị chiếm), ai có quyền quyết định tắt dịch vụ, runbook xoay vòng secret, bản sao lưu đã kiểm tra khôi phục được.</li>
      <li><strong>Phát hiện & đánh giá</strong>: xác nhận có sự cố thật, mức độ nghiêm trọng, phạm vi ban đầu; mở kênh sự cố, ghi nhật ký thời gian mọi việc làm.</li>
      <li><strong>Khoanh vùng (containment)</strong>: chặn đường tấn công — vô hiệu tài khoản/token bị lộ, cô lập máy chủ, tắt tính năng lỗi, chặn IP; <strong>giữ lại bằng chứng</strong> (snapshot, log) trước khi xoá/cài lại.</li>
      <li><strong>Loại bỏ (eradication)</strong>: vá lỗ hổng gốc, <strong>xoay vòng toàn bộ secret</strong> có thể đã bị lộ, gỡ mọi thứ kẻ tấn công để lại.</li>
      <li><strong>Khôi phục</strong>: đưa dịch vụ lên lại từ trạng thái sạch đã biết, theo dõi chặt trong thời gian sau đó.</li>
      <li><strong>Rút kinh nghiệm (post-mortem không đổ lỗi)</strong>: chuyện gì xảy ra, vì sao phát hiện muộn, thêm test/cảnh báo/biện pháp nào để không lặp lại.
        Kèm nghĩa vụ thông báo cho người dùng/cơ quan quản lý theo luật bảo vệ dữ liệu áp dụng cho bạn.</li>
    </ol>

    <div class="callout"><p>💡 Tự kiểm tra: "Nếu ngày mai có người báo rằng tài khoản A bị chiếm từ tuần trước, tôi có trả lời được <strong>ai đã đăng nhập, từ đâu, đã xem/sửa/xuất gì</strong> không —
    và tôi có chắc log đó chưa bị sửa?" Nếu chưa, đó là việc cần làm tiếp theo.</p></div>
  `,

  codeTabs: [
    { id: "events", label: "📝 Sự kiện bảo mật", lines: [
      "// Một hàm audit dùng chung — field cố định, dạng có cấu trúc",
      "function audit(req, action, target, outcome, extra = {}):",
      "    securityLog.write({",
      "        ts:         nowUtcIso(),",
      "        request_id: req.id,",
      "        actor_id:   req.user?.id ?? null,",
      "        ip:         trustedClientIp(req),",
      "        action,                  // 'auth.login', 'authz.denied', 'role.grant', 'data.export'",
      "        target,                  // { type: 'order', id: 'o_123' }",
      "        outcome,                 // 'success' | 'failure' | 'denied'",
      "        ...allowlistFields(extra, ['reason', 'mfa', 'count'])",
      "    })",
      "",
      "// Dùng ở những điểm quan trọng",
      "audit(req, 'auth.login',   { type: 'user', id: user.id }, 'failure', { reason: 'bad_password' })",
      "audit(req, 'authz.denied', { type: 'invoice', id: invoiceId }, 'denied')",
      "audit(req, 'role.grant',   { type: 'user', id: targetId }, 'success', { reason: 'admin' })",
      "audit(req, 'data.export',  { type: 'customers' }, 'success', { count: rows.length })"
    ]},
    { id: "inject", label: "🧵 Log injection", lines: [
      "// ❌ Nối chuỗi vào log text: input chứa ký tự xuống dòng tạo được dòng log giả",
      "log.info('login failed for user ' + req.body.username)",
      "// username = '<giá_trị_độc>' (chứa \\n + nội dung giả một dòng log khác)",
      "",
      "// ✅ 1. Structured logging: input là GIÁ TRỊ của field, được JSON-escape",
      "log.info({ event: 'auth.login', outcome: 'failure', username: req.body.username })",
      "// -> {'event':'auth.login','outcome':'failure','username':'abc\\ninfo ...'}   (vẫn một dòng)",
      "",
      "// ✅ 2. Nếu buộc phải log text: escape CR/LF/ký tự điều khiển + giới hạn độ dài",
      "function safeForLog(s): return s.replace(/[\\r\\n\\t\\x00-\\x1f]/g, '_').slice(0, 200)",
      "",
      "// ✅ 3. API tham số hoá, không nối chuỗi",
      "# Java (SLF4J):   log.info(\"login failed user={}\", username);",
      "# Python:         logger.info('login failed user=%s', username)",
      "# Go (slog):      slog.Info(\"login failed\", \"user\", username)"
    ]},
    { id: "redact", label: "🙈 Không log secret/PII", lines: [
      "// ❌ Log nguyên request: lộ mật khẩu, token, cookie",
      "log.debug('incoming', req.headers, req.body)",
      "",
      "// ✅ Allowlist field được log + redact theo tên + mask",
      "SENSITIVE = /pass(word)?|secret|token|authorization|cookie|api[_-]?key|otp|cvv|card/i",
      "",
      "function redact(obj):",
      "    return mapDeep(obj, (key, value) =>",
      "        SENSITIVE.test(key) ? '[REDACTED]' : value)",
      "",
      "function maskEmail(e): return e[0] + '***@' + e.split('@')[1]      // n***@example.com",
      "function maskCard(c):  return '**** ' + c.slice(-4)",
      "",
      "log.info({ event: 'payment.create', user_id: u.id, card: maskCard(card), amount })",
      "",
      "// Test: secret KHÔNG được xuất hiện trong log",
      "test 'login không log mật khẩu':",
      "    captureLogs(() => post('/login', { email: 'a@x.io', password: 'S3cret-Test!' }))",
      "    assert not logs.contains('S3cret-Test!')"
    ]},
    { id: "audit", label: "🔏 Audit bất biến", lines: [
      "-- DB: ứng dụng chỉ được INSERT/SELECT bảng audit, không UPDATE/DELETE",
      "GRANT INSERT, SELECT ON audit_log TO app_user;",
      "REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_user;",
      "",
      "// Chuỗi hash: sửa/xoá một bản ghi ở giữa làm đứt chuỗi",
      "function appendAudit(entry):",
      "    prev = auditStore.lastHash()",
      "    entry.prev_hash = prev",
      "    entry.hash = sha256(canonicalJson(entry))",
      "    auditStore.insert(entry)",
      "    shipper.send(entry)         // đẩy ngay sang SIEM/log service tách biệt",
      "",
      "function verifyChain(entries):",
      "    for i in 1..len(entries)-1:",
      "        if entries[i].prev_hash != entries[i-1].hash: alert('audit chain broken at', i)",
      "",
      "# Lưu trữ lâu dài: object storage bật Object Lock / WORM, retention 1 năm"
    ]},
    { id: "alert", label: "🚨 Cảnh báo & ứng phó", lines: [
      "# Quy tắc cảnh báo (pseudo-query trên log có cấu trúc)",
      "ALERT credential_stuffing:",
      "    count(action='auth.login' AND outcome='failure') BY ip OVER 5m > 50",
      "      AND count_distinct(target.id) BY ip OVER 5m > 20",
      "ALERT bola_probing:",
      "    count(action='authz.denied') BY actor_id OVER 10m > 30",
      "ALERT mass_export:",
      "    sum(extra.count WHERE action='data.export') BY actor_id OVER 1h > 10000",
      "ALERT privilege_change:",
      "    any(action IN ['role.grant', 'mfa.disable', 'apikey.create'])   -> notify owner + security",
      "ALERT log_silence:",
      "    count(*) FROM service='api' OVER 10m == 0",
      "",
      "# Runbook: token/secret nghi bị lộ",
      "1. Mở kênh sự cố, ghi nhật ký thời gian",
      "2. Giữ bằng chứng: snapshot log/máy trước khi thay đổi",
      "3. Thu hồi token/phiên liên quan, vô hiệu API key",
      "4. Xoay vòng secret, vá lỗ hổng gốc, deploy lại từ artifact sạch",
      "5. Theo dõi chặt, post-mortem không đổ lỗi, thêm test + cảnh báo"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">⚙️ Ứng dụng</div><div class="ns">ghi sự kiện bảo mật: ai · làm gì · với cái gì · kết quả</div></div>
    <div class="arrow" id="a1">↓ structured JSON · escape · redact secret/PII</div>
    <div class="row">
      <div class="node" id="applog"><div class="nl">📄 Log vận hành</div><div class="ns">retention giới hạn · phân quyền đọc</div></div>
      <div class="node" id="auditlog"><div class="nl">🔏 Audit log</div><div class="ns">append-only · chuỗi hash · WORM</div></div>
    </div>
    <div class="arrow" id="a2">↓ đẩy ngay sang hệ thống tách biệt</div>
    <div class="node" id="siem"><div class="nl">📊 SIEM / log tập trung</div><div class="ns">truy vấn · tương quan · quy tắc cảnh báo</div></div>
    <div class="arrow" id="a3">↓ vượt ngưỡng</div>
    <div class="node" id="alert"><div class="nl">🚨 Cảnh báo có người nhận</div><div class="ns">kèm runbook</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="ir"><div class="nl">🧯 Ứng phó sự cố</div><div class="ns">đánh giá → khoanh vùng → loại bỏ → khôi phục → rút kinh nghiệm</div></div>
  `,
  steps: [
    { title: "1 · Log đúng sự kiện, đủ ngữ cảnh", tab: "events", highlight: [2, 4, 5, 6, 7, 8, 9, 10], on: ["app"],
      desc: "Mỗi sự kiện bảo mật trả lời được: ai (<code>actor_id</code>), làm gì (<code>action</code>), với cái gì (<code>target</code>), khi nào, từ đâu, kết quả. <code>request_id</code> nối các log liên quan." },
    { title: "2 · Ghi ở những điểm quan trọng", tab: "events", highlight: [15, 16, 17, 18], on: ["app", "a1"],
      desc: "Đăng nhập thất bại, <strong>bị từ chối truy cập</strong>, cấp quyền, xuất dữ liệu hàng loạt. Sự kiện 'denied' đặc biệt quý: đó thường là dấu vết của người đang dò lỗ hổng." },
    { title: "3 · Chống log injection", tab: "inject", highlight: [2, 3, 6, 7, 10], on: ["a1", "applog"],
      desc: "Nối chuỗi input vào log text cho phép tạo dòng log giả bằng ký tự xuống dòng. Structured logging đặt input vào field được JSON-escape; nếu buộc log text thì escape CR/LF và giới hạn độ dài." },
    { title: "4 · Không log secret và PII", tab: "redact", highlight: [2, 5, 7, 8, 9, 11, 12, 17, 18, 19], on: ["a1", "applog"],
      desc: "Log kém được bảo vệ hơn DB. Không log nguyên request; allowlist field, redact theo tên, mask email/thẻ. Có test khẳng định mật khẩu không xuất hiện trong log." },
    { title: "5 · Audit log không sửa được", tab: "audit", highlight: [2, 3, 7, 8, 9, 11, 15], on: ["auditlog", "a2", "siem"],
      desc: "Ứng dụng chỉ có quyền INSERT; mỗi bản ghi chứa hash bản ghi trước; log được đẩy ngay sang hệ thống tách biệt và lưu trữ bất biến. Kẻ chiếm được app cũng không xoá được dấu vết." },
    { title: "6 · Biến log thành cảnh báo", tab: "alert", highlight: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], on: ["siem", "a3", "alert"],
      desc: "Quy tắc cảnh báo cho credential stuffing, dò ID (nhiều 403), xuất dữ liệu bất thường, thay đổi quyền, và cả khi log ngừng chảy. Ít cảnh báo nhưng chất lượng, mỗi cái có người nhận." },
    { title: "7 · Quy trình ứng phó sự cố", tab: "alert", highlight: [15, 16, 17, 18, 19], on: ["alert", "a4", "ir"],
      desc: "Chuẩn bị trước, rồi: đánh giá → khoanh vùng (thu hồi token, giữ bằng chứng) → loại bỏ (vá, xoay vòng secret) → khôi phục → post-mortem không đổ lỗi, thêm test và cảnh báo mới." }
  ],

  quiz: [
    { q: "Sự kiện nào sau đây QUAN TRỌNG cần ghi vào security log?", options: [
        "Mỗi lần render một ảnh thumbnail",
        "Request bị từ chối vì truy cập object của người khác (403/authz denied)",
        "Thời gian load CSS",
        "Số lần người dùng cuộn trang"
      ], correct: 1,
      explanation: "Sự kiện bị từ chối quyền thường là dấu hiệu có người đang dò IDOR/BOLA. Không log thì không bao giờ biết." },
    { q: "Code ghi log: log.info('login failed for user ' + username) vào file text. Input username chứa ký tự xuống dòng gây ra vấn đề gì?", options: [
        "Không có vấn đề",
        "Log injection: tạo được dòng log giả trông như sự kiện thật, làm sai lệch điều tra",
        "SQL Injection vào database",
        "Làm mật khẩu bị lộ"
      ], correct: 1,
      explanation: "Dùng structured logging (input là giá trị field được escape) hoặc escape CR/LF trước khi ghi." },
    { q: "Vì sao không nên log mật khẩu SAI khi đăng nhập thất bại?", options: [
        "Vì log sẽ quá dài",
        "Vì mật khẩu sai thường là mật khẩu đúng gõ nhầm một ký tự hoặc mật khẩu của tài khoản/dịch vụ khác",
        "Vì mật khẩu sai không có giá trị gì",
        "Được phép log nếu mã hoá base64"
      ], correct: 1,
      explanation: "Không bao giờ log mật khẩu, OTP, token, cookie, header Authorization — dù đúng hay sai. Base64 không phải mã hoá." },
    { q: "Cách nào giúp tránh vô tình log secret hiệu quả nhất?", options: [
        "Dặn mọi người cẩn thận",
        "Log toàn bộ request để đủ thông tin, xoá sau",
        "Allowlist field được log + redact tự động theo tên field + test khẳng định secret không xuất hiện trong log",
        "Chỉ log ở môi trường production"
      ], correct: 2,
      explanation: "Kiểm soát bằng cơ chế (allowlist, redact, test) chứ không dựa vào trí nhớ con người." },
    { q: "Biện pháp nào giúp audit log 'không sửa được' khi kẻ tấn công đã chiếm quyền ứng dụng?", options: [
        "Lưu audit log trong cùng bảng với dữ liệu nghiệp vụ, app có toàn quyền",
        "App chỉ có quyền INSERT, log được đẩy ngay sang hệ thống tách biệt có lưu trữ bất biến, kèm chuỗi hash",
        "Nén log bằng zip",
        "Đổi tên file log hằng ngày"
      ], correct: 1,
      explanation: "Tách quyền + tách hệ thống + lưu trữ WORM + chuỗi hash khiến việc xoá dấu vết khó và dễ bị phát hiện." },
    { q: "Trong audit log dạng chuỗi hash, mỗi bản ghi chứa hash của bản ghi trước. Điều gì xảy ra nếu ai đó xoá một bản ghi ở giữa?", options: [
        "Không ai phát hiện được",
        "Chuỗi bị đứt: prev_hash của bản ghi sau không còn khớp, việc kiểm tra định kỳ phát hiện ngay",
        "Toàn bộ log bị mã hoá",
        "Database tự khôi phục bản ghi"
      ], correct: 1,
      explanation: "Chuỗi hash không ngăn được việc sửa, nhưng biến việc sửa thành điều phát hiện được (tamper-evident)." },
    { q: "Log dịch vụ API đột nhiên không có bản ghi nào trong 10 phút dù đang giờ cao điểm. Nên xử lý thế nào?", options: [
        "Bỏ qua, ít log là tốt",
        "Coi là cảnh báo: có thể pipeline log hỏng, dịch vụ sập, hoặc ai đó đã tắt log để che dấu vết",
        "Tăng mức log lên DEBUG cho mọi service",
        "Xoá log cũ để giải phóng dung lượng"
      ], correct: 1,
      explanation: "Theo dõi cả 'sự im lặng' của log là một quy tắc cảnh báo quan trọng." },
    { q: "Một tài khoản có 40 lần bị từ chối truy cập (authz.denied) tới các invoice khác nhau trong 10 phút. Điều này gợi ý gì?", options: [
        "Người dùng quên mật khẩu",
        "Có thể đang dò ID để tìm lỗ hổng IDOR/BOLA — nên cảnh báo và xem xét",
        "Server bị quá tải",
        "Không có ý nghĩa gì"
      ], correct: 1,
      explanation: "Mẫu hình nhiều 403 trên nhiều object khác nhau là dấu hiệu dò quét điển hình." },
    { q: "Khi phát hiện một API key production bị lộ, bước nào nên làm TRƯỚC khi cài lại máy chủ?", options: [
        "Xoá toàn bộ log để tiết kiệm dung lượng",
        "Giữ lại bằng chứng (snapshot, log) và thu hồi key/phiên liên quan",
        "Đợi xem có thiệt hại gì không",
        "Đăng thông báo công khai trước khi điều tra"
      ], correct: 1,
      explanation: "Khoanh vùng (thu hồi) + bảo toàn bằng chứng trước, rồi mới loại bỏ và khôi phục — cài lại sớm sẽ xoá mất dấu vết cần điều tra." },
    { q: "Mục đích của buổi post-mortem 'không đổ lỗi' (blameless) sau sự cố là gì?", options: [
        "Tìm người để kỷ luật",
        "Hiểu chuyện gì xảy ra và vì sao, rồi thêm biện pháp (test, cảnh báo, quy trình) để không lặp lại",
        "Viết báo cáo cho có",
        "Xoá lịch sử sự cố"
      ], correct: 1,
      explanation: "Khi mọi người không sợ bị phạt, họ kể đúng sự thật — và tổ chức học được nhiều nhất." }
  ]
});
