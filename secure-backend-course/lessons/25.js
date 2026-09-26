window.LESSONS.push({
  id: "25",
  phase: "6", phaseName: "Vận hành & quy trình",
  title: "Security headers & cấu hình an toàn",
  subtitle: "HSTS · CSP · nosniff · frame-ancestors · Referrer-Policy · tắt debug · mật khẩu mặc định · đóng admin/metrics · container non-root, read-only · IAM tối thiểu",

  theory: `
    <p>Code viết cẩn thận tới đâu mà <strong>cấu hình</strong> sai thì vẫn thủng: bật chế độ debug trên production, để nguyên tài khoản <code>admin/admin</code> của một công cụ,
    mở endpoint <code>/actuator</code> ra Internet, container chạy bằng root, service account có quyền admin cả tài khoản cloud. OWASP xếp nhóm này là
    <strong>Security Misconfiguration</strong> — một trong những nguyên nhân phổ biến nhất của sự cố thật. Tin tốt: đây cũng là nhóm dễ sửa nhất, vì phần lớn chỉ là
    <strong>đặt đúng giá trị một lần và kiểm tra tự động để nó không bị đổi lại</strong>.</p>

    <p><strong>Phần A — Security headers.</strong> Header HTTP do backend (hoặc reverse proxy) trả về để <em>yêu cầu trình duyệt</em> bật thêm các lớp bảo vệ.
    Chúng không thay thế code an toàn nhưng giảm thiệt hại khi có lỗi (defense in depth).</p>
    <table>
      <tr><th>Header</th><th>Chống gì</th><th>Giá trị gợi ý</th></tr>
      <tr><td><code>Strict-Transport-Security</code> (HSTS)</td><td>Trình duyệt tự dùng HTTPS cho domain trong thời gian dài, không bao giờ thử HTTP → chống bị hạ cấp xuống HTTP/nghe lén trên Wi-Fi công cộng</td>
        <td><code>max-age=31536000; includeSubDomains</code> (thêm <code>preload</code> khi chắc chắn mọi subdomain đều HTTPS)</td></tr>
      <tr><td><code>Content-Security-Policy</code> (CSP)</td><td>Giới hạn nguồn được phép tải script/style/ảnh/kết nối → nếu XSS lọt qua (bài 15), script lạ vẫn không chạy được</td>
        <td>Bắt đầu từ <code>default-src 'self'</code>, dùng nonce cho script inline, tránh <code>'unsafe-inline'</code>/<code>'unsafe-eval'</code></td></tr>
      <tr><td><code>X-Content-Type-Options</code></td><td>Cấm trình duyệt "đoán" kiểu nội dung (MIME sniffing) — vd file upload dạng text bị hiểu thành script</td><td><code>nosniff</code></td></tr>
      <tr><td>CSP <code>frame-ancestors</code> (và <code>X-Frame-Options</code> cho trình duyệt cũ)</td><td>Chặn trang của bạn bị nhúng vào iframe của site khác để lừa người dùng bấm (clickjacking)</td>
        <td><code>frame-ancestors 'none'</code> hoặc <code>'self'</code>; <code>X-Frame-Options: DENY</code></td></tr>
      <tr><td><code>Referrer-Policy</code></td><td>Tránh gửi URL đầy đủ (có thể chứa token, ID) sang site khác qua header Referer</td><td><code>strict-origin-when-cross-origin</code> hoặc <code>no-referrer</code></td></tr>
      <tr><td><code>Permissions-Policy</code></td><td>Tắt các API trình duyệt không dùng (camera, micro, định vị)</td><td><code>camera=(), microphone=(), geolocation=()</code></td></tr>
      <tr><td><code>Cache-Control</code> cho dữ liệu nhạy cảm</td><td>Không để proxy/trình duyệt dùng chung lưu trang có dữ liệu cá nhân</td><td><code>no-store</code> cho response chứa thông tin người dùng</td></tr>
    </table>
    <p>Với <strong>API chỉ trả JSON</strong>: vẫn nên đặt <code>X-Content-Type-Options: nosniff</code>, <code>Content-Type</code> đúng (<code>application/json</code>), HSTS,
    và một CSP rất chặt như <code>default-src 'none'; frame-ancestors 'none'</code> — vì nếu ai đó mở response trực tiếp trên trình duyệt thì cũng không có gì chạy được.
    Đồng thời <strong>bớt header tiết lộ thông tin</strong>: <code>Server: nginx/1.x.y</code>, <code>X-Powered-By: Express</code> giúp kẻ tấn công biết ngay version để tra lỗ hổng.</p>
    <p>Triển khai CSP an toàn: bật chế độ <code>Content-Security-Policy-Report-Only</code> trước để thu báo cáo vi phạm mà không làm hỏng trang, sửa dần, rồi mới chuyển sang chế độ thực thi.
    Đặt header ở <strong>một chỗ</strong> (middleware chung như Helmet cho Express, Spring Security, <code>django.middleware.security</code>, hoặc ở reverse proxy) để không endpoint nào bị sót.</p>

    <p><strong>Phần B — Cấu hình ứng dụng.</strong></p>
    <ul>
      <li><strong>Tắt debug/dev mode trên production</strong>: trang lỗi chi tiết của framework (stack trace, biến môi trường, câu SQL, đường dẫn file) là món quà cho kẻ tấn công;
        một số debug console còn cho <em>chạy code</em> ngay trên trình duyệt. Production trả lỗi chung chung + mã tham chiếu (request ID), chi tiết chỉ nằm trong log nội bộ.</li>
      <li><strong>Không có mật khẩu/khoá mặc định</strong>: DB, Redis, message broker, admin panel, Grafana, Jenkins… đổi ngay khi cài; tốt nhất là không cho khởi động nếu chưa đặt mật khẩu.
        Secret lấy từ secret manager/biến môi trường, không hard-code, không commit.</li>
      <li><strong>Mặc định an toàn (secure by default)</strong>: khi thiếu cấu hình, ứng dụng nên <em>từ chối chạy</em> hoặc chọn phương án an toàn nhất (bật TLS, tắt đăng ký công khai…), không âm thầm chọn phương án mở.</li>
      <li><strong>Đóng endpoint quản trị/giám sát</strong>: <code>/actuator/*</code> (Spring Boot), <code>/metrics</code>, <code>/debug/pprof</code> (Go), <code>/admin</code>, Swagger UI, GraphQL introspection,
        trang quản trị DB. Những endpoint này có thể lộ biến môi trường, heap dump (chứa secret trong RAM), cấu hình, hoặc cho phép thay đổi trạng thái hệ thống. Cách làm:
        <ol>
          <li>Chỉ bật những gì thật sự cần (vd chỉ <code>health</code>).</li>
          <li>Cho chạy trên <strong>port riêng</strong> chỉ lắng nghe mạng nội bộ, không đi qua load balancer công khai.</li>
          <li>Bắt buộc xác thực + phân quyền cho phần còn lại; health check công khai chỉ trả "UP/DOWN", không chi tiết.</li>
        </ol></li>
      <li><strong>Dịch vụ phụ trợ không mở ra Internet</strong>: DB, cache, search engine, broker chỉ nghe trong mạng riêng; security group/firewall theo kiểu "deny by default, mở đúng port cho đúng nguồn".</li>
      <li><strong>TLS đúng</strong>: chỉ TLS 1.2+, tự gia hạn chứng chỉ, kiểm tra chứng chỉ khi gọi ra ngoài (không tắt verify "cho nhanh" — bài 20).</li>
      <li><strong>Cookie</strong>: <code>Secure; HttpOnly; SameSite=Lax/Strict</code> cho cookie phiên (bài 16).</li>
    </ul>

    <p><strong>Phần C — Container & hạ tầng: quyền tối thiểu (least privilege).</strong> Giả định rằng một ngày nào đó ứng dụng <em>sẽ</em> bị chiếm (lỗ hổng chưa biết, dependency độc).
    Câu hỏi là: khi đó kẻ tấn công làm được gì? Cấu hình tốt khiến câu trả lời là "rất ít".</p>
    <ul>
      <li><strong>Chạy non-root</strong>: tạo user riêng trong image (<code>USER 10001</code>), Kubernetes đặt <code>runAsNonRoot: true</code>. Root trong container gần với root trên host hơn bạn nghĩ khi có lỗ hổng runtime.</li>
      <li><strong>Filesystem chỉ đọc</strong>: <code>readOnlyRootFilesystem: true</code>; thư mục cần ghi (tmp, cache) mount riêng dạng <code>emptyDir</code>. Kẻ tấn công không thể thả thêm file thực thi hay sửa code.</li>
      <li><strong>Bỏ bớt quyền kernel</strong>: <code>capabilities: drop: [ALL]</code>, <code>allowPrivilegeEscalation: false</code>, không dùng <code>privileged: true</code>, bật seccomp <code>RuntimeDefault</code>.</li>
      <li><strong>Image tối giản</strong>: distroless/slim, multi-stage build (không mang compiler, shell, công cụ debug lên production), quét image (bài 24).</li>
      <li><strong>Giới hạn tài nguyên</strong>: CPU/memory limit để một container lỗi không kéo sập cả node (liên hệ bài 23).</li>
      <li><strong>Mạng</strong>: NetworkPolicy chỉ cho service nói chuyện với đúng những service cần thiết.</li>
      <li><strong>IAM tối thiểu</strong>: mỗi service một danh tính riêng (service account / IAM role), chỉ đúng hành động trên đúng tài nguyên — vd "đọc/ghi bucket <code>invoices-prod</code>", không phải
        "toàn quyền S3" hay tệ hơn là quyền admin. Không dùng access key dài hạn khi có thể dùng workload identity/instance role. Tắt metadata service hoặc bắt buộc IMDSv2 nếu không cần.
        User DB của ứng dụng chỉ có quyền trên schema của nó, không phải superuser.</li>
    </ul>

    <p><strong>Phần D — Giữ cho cấu hình luôn đúng.</strong> Cấu hình trôi dạt (drift) theo thời gian: ai đó bật debug để sửa lỗi gấp rồi quên tắt. Vì vậy:</p>
    <ul>
      <li>Cấu hình dưới dạng code (Infrastructure as Code, Helm, Kustomize) có review.</li>
      <li>Quét tự động: Checkov/tfsec/Trivy config cho Terraform/K8s, kube-bench, Kyverno/OPA Gatekeeper chặn pod chạy root hoặc privileged ngay khi deploy.</li>
      <li>Test tự động trong CI kiểm tra header và endpoint: gọi <code>/actuator/env</code> phải nhận 404/401, response phải có HSTS và nosniff.</li>
      <li>Công cụ đánh giá header từ bên ngoài (Mozilla Observatory, securityheaders) sau mỗi lần triển khai.</li>
    </ul>

    <div class="callout"><p>💡 Ba câu hỏi cho mỗi thành phần: <strong>Ai truy cập được nó?</strong> (mạng, xác thực) · <strong>Nó tiết lộ gì?</strong> (lỗi, header, endpoint quản trị) ·
    <strong>Nếu nó bị chiếm, kẻ tấn công làm được gì?</strong> (user, filesystem, quyền IAM). Mỗi câu trả lời càng hẹp càng tốt.</p></div>
  `,

  codeTabs: [
    { id: "headers", label: "📨 Headers", lines: [
      "// Middleware đặt header bảo mật cho MỌI response — một chỗ duy nhất",
      "function securityHeaders(req, res, next):",
      "    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')",
      "    res.set('Content-Security-Policy',",
      "            \"default-src 'self'; script-src 'self' 'nonce-\" + res.locals.nonce + \"'; \" +",
      "            \"object-src 'none'; base-uri 'none'; frame-ancestors 'none'\")",
      "    res.set('X-Content-Type-Options', 'nosniff')",
      "    res.set('X-Frame-Options', 'DENY')                 // cho trình duyệt cũ",
      "    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')",
      "    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')",
      "    res.remove('X-Powered-By'); res.remove('Server')",
      "    next()",
      "",
      "// API chỉ trả JSON: CSP chặt nhất có thể",
      "//   Content-Security-Policy: default-src 'none'; frame-ancestors 'none'",
      "//   Content-Type: application/json; charset=utf-8",
      "//   Cache-Control: no-store      (với dữ liệu người dùng)"
    ]},
    { id: "frameworks", label: "🌐 Đa framework", lines: [
      "# Express (Node.js) — Helmet",
      "app.disable('x-powered-by'); app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: [\"'self'\"] } } }))",
      "",
      "# Django (settings.py)",
      "DEBUG = False",
      "SECURE_HSTS_SECONDS = 31536000; SECURE_CONTENT_TYPE_NOSNIFF = True",
      "X_FRAME_OPTIONS = 'DENY'; SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'",
      "",
      "# Spring Security (Java)",
      "http.headers(h -> h.httpStrictTransportSecurity(s -> s.maxAgeInSeconds(31536000))",
      "                   .contentSecurityPolicy(c -> c.policyDirectives(\"default-src 'self'\")));",
      "",
      "# nginx (reverse proxy)",
      "server_tokens off;",
      "add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains' always;",
      "add_header X-Content-Type-Options nosniff always;"
    ]},
    { id: "app", label: "⚙️ Cấu hình app", lines: [
      "# Spring Boot (application-prod.yml): chỉ mở health, port quản trị riêng",
      "management:",
      "  server.port: 9090                     # chỉ nghe mạng nội bộ",
      "  endpoints.web.exposure.include: health",
      "  endpoint.health.show-details: never",
      "",
      "// Khởi động: thiếu cấu hình an toàn -> từ chối chạy",
      "function startup(config):",
      "    if config.env == 'production' and config.debug: fail('debug bật trên production')",
      "    if config.db.password in [null, '', 'admin', 'password', 'changeme']: fail('mật khẩu DB mặc định')",
      "    if not config.tls.enabled: fail('production bắt buộc TLS')",
      "",
      "// Lỗi trả cho client: chung chung + mã tham chiếu; chi tiết chỉ vào log nội bộ",
      "on error (err, req):",
      "    log.error({ requestId: req.id, err })",
      "    return 500 { error: 'internal_error', request_id: req.id }"
    ]},
    { id: "container", label: "🐳 Container & IAM", lines: [
      "# Dockerfile: multi-stage, image tối giản, user không phải root",
      "FROM builder-image AS build",
      "RUN build-app --output /out/app",
      "FROM distroless-base@sha256:<digest>",
      "COPY --from=build /out/app /app",
      "USER 10001",
      "",
      "# Kubernetes securityContext",
      "securityContext:",
      "  runAsNonRoot: true",
      "  readOnlyRootFilesystem: true",
      "  allowPrivilegeEscalation: false",
      "  capabilities: { drop: ['ALL'] }",
      "  seccompProfile: { type: RuntimeDefault }",
      "",
      "# IAM policy: đúng hành động, đúng tài nguyên (không dùng '*')",
      "{ 'Effect': 'Allow',",
      "  'Action': ['s3:GetObject', 's3:PutObject'],",
      "  'Resource': 'arn:aws:s3:::invoices-prod/*' }"
    ]},
    { id: "verify", label: "🧪 Kiểm tra tự động", lines: [
      "// Test chạy trong CI / sau deploy: cấu hình không được trôi dạt",
      "test 'response có security headers':",
      "    r = http.get(BASE + '/')",
      "    assert r.headers['strict-transport-security'] contains 'max-age='",
      "    assert r.headers['x-content-type-options'] == 'nosniff'",
      "    assert 'frame-ancestors' in r.headers['content-security-policy']",
      "    assert 'x-powered-by' not in r.headers",
      "",
      "test 'endpoint quản trị không lộ ra ngoài':",
      "    for path in ['/actuator/env', '/actuator/heapdump', '/debug/pprof/', '/metrics']:",
      "        assert http.get(PUBLIC_BASE + path).status in [401, 403, 404]",
      "",
      "test 'lỗi không lộ stack trace':",
      "    r = http.get(BASE + '/api/orders/not-a-uuid')",
      "    assert 'Exception' not in r.body and 'at ' + 'com.' not in r.body",
      "",
      "# Quét IaC / K8s manifest",
      "checkov -d infra/     ;  trivy config k8s/"
    ]}
  ],

  stageHtml: `
    <div class="node" id="browser"><div class="nl">🌐 Trình duyệt / client</div><div class="ns">thực thi các chính sách mà header yêu cầu</div></div>
    <div class="arrow" id="a1">↑ HSTS · CSP · nosniff · frame-ancestors · Referrer-Policy</div>
    <div class="node" id="proxy"><div class="nl">🛡️ Reverse proxy / middleware header</div><div class="ns">đặt header ở một chỗ · ẩn Server/X-Powered-By</div></div>
    <div class="arrow" id="a2">↕ chỉ port công khai</div>
    <div class="row">
      <div class="node" id="app"><div class="nl">⚙️ Ứng dụng</div><div class="ns">debug tắt · không mật khẩu mặc định · lỗi chung chung</div></div>
      <div class="node" id="admin"><div class="nl">🔧 /actuator · /metrics · /admin</div><div class="ns">port riêng · mạng nội bộ · cần xác thực</div></div>
    </div>
    <div class="arrow" id="a3">↓ chạy bên trong</div>
    <div class="node" id="container"><div class="nl">🐳 Container</div><div class="ns">non-root · read-only FS · drop ALL capabilities</div></div>
    <div class="arrow" id="a4">↓ danh tính riêng</div>
    <div class="node" id="iam"><div class="nl">☁️ IAM / DB user</div><div class="ns">đúng hành động · đúng tài nguyên · không '*'</div></div>
  `,
  steps: [
    { title: "1 · Header yêu cầu trình duyệt bảo vệ thêm", tab: "headers", highlight: [3, 4, 5, 6, 7], on: ["browser", "a1", "proxy"],
      desc: "HSTS buộc HTTPS; CSP giới hạn nguồn script nên XSS lọt qua cũng khó chạy; <code>nosniff</code> cấm đoán kiểu nội dung. Đặt tất cả trong một middleware để không sót endpoint." },
    { title: "2 · Chống clickjacking, rò Referer, lộ version", tab: "headers", highlight: [6, 8, 9, 10, 11], on: ["proxy"],
      desc: "<code>frame-ancestors 'none'</code> chặn nhúng iframe; Referrer-Policy không gửi URL đầy đủ sang site khác; bỏ <code>X-Powered-By</code>/<code>Server</code> để không quảng cáo version." },
    { title: "3 · Framework nào cũng có sẵn", tab: "frameworks", highlight: [2, 5, 6, 7, 10, 11, 14, 15, 16], on: ["proxy", "app"],
      desc: "Helmet (Express), cấu hình <code>SECURE_*</code> (Django), Spring Security headers, <code>add_header ... always</code> ở nginx. Dùng công cụ sẵn có thay vì tự viết từng header ở từng route." },
    { title: "4 · Cấu hình app: secure by default", tab: "app", highlight: [8, 9, 10, 11, 14, 15, 16], on: ["app"],
      desc: "Production mà bật debug, dùng mật khẩu mặc định hay thiếu TLS → ứng dụng <strong>từ chối khởi động</strong>. Lỗi trả cho client chỉ có mã tham chiếu; chi tiết nằm trong log nội bộ." },
    { title: "5 · Đóng endpoint quản trị", tab: "app", highlight: [2, 3, 4, 5], on: ["a2", "admin"],
      desc: "Actuator/metrics/pprof có thể lộ biến môi trường và heap dump chứa secret. Chỉ mở <code>health</code>, chạy trên port riêng trong mạng nội bộ, phần còn lại bắt buộc xác thực." },
    { title: "6 · Container quyền tối thiểu", tab: "container", highlight: [4, 6, 10, 11, 12, 13, 14], on: ["a3", "container"],
      desc: "Image distroless, chạy user 10001, filesystem chỉ đọc, bỏ mọi capability, không leo thang quyền. Nếu app bị chiếm, kẻ tấn công không cài thêm công cụ hay sửa code được." },
    { title: "7 · IAM tối thiểu + kiểm tra tự động", tab: "verify", highlight: [4, 5, 6, 10, 11, 18], on: ["a4", "iam", "admin"],
      desc: "Mỗi service một danh tính, chỉ đúng hành động trên đúng tài nguyên. Test trong CI kiểm tra header có mặt, endpoint quản trị trả 401/403/404 từ ngoài, quét IaC để cấu hình không trôi dạt." }
  ],

  quiz: [
    { q: "Header Strict-Transport-Security (HSTS) có tác dụng gì?", options: [
        "Mã hoá dữ liệu trong database",
        "Yêu cầu trình duyệt luôn dùng HTTPS cho domain trong thời gian max-age, không thử HTTP",
        "Chặn SQL Injection",
        "Giới hạn số request mỗi giây"
      ], correct: 1,
      explanation: "HSTS chống việc bị hạ cấp xuống HTTP (vd trên Wi-Fi công cộng) — sau lần truy cập đầu, trình duyệt tự nâng mọi request lên HTTPS." },
    { q: "CSP (Content-Security-Policy) giúp gì khi ứng dụng vẫn còn một lỗi XSS chưa phát hiện?", options: [
        "Tự sửa lỗi XSS trong code",
        "Không giúp gì",
        "Giới hạn nguồn script được chạy, nên script chèn vào (inline, từ domain lạ) bị trình duyệt chặn",
        "Mã hoá cookie"
      ], correct: 2,
      explanation: "CSP là lớp phòng thủ chiều sâu. Output encoding vẫn là biện pháp chính; CSP giảm thiệt hại khi encoding bị sót." },
    { q: "Muốn chặn trang của mình bị nhúng vào iframe của site khác (clickjacking), dùng gì?", options: [
        "Referrer-Policy: no-referrer",
        "CSP frame-ancestors 'none' (và X-Frame-Options: DENY cho trình duyệt cũ)",
        "X-Content-Type-Options: nosniff",
        "Cache-Control: no-store"
      ], correct: 1,
      explanation: "frame-ancestors quy định ai được phép nhúng trang của bạn vào khung." },
    { q: "Spring Boot production mở /actuator/* ra Internet không cần xác thực. Rủi ro lớn nhất?", options: [
        "Trang load chậm hơn",
        "Lộ biến môi trường, cấu hình, heap dump (chứa secret trong bộ nhớ) và có thể thay đổi trạng thái hệ thống",
        "Không có rủi ro vì chỉ là thông tin giám sát",
        "Chỉ lộ số phiên bản Java"
      ], correct: 1,
      explanation: "Chỉ mở health, chạy management trên port riêng nội bộ, bắt buộc xác thực cho phần còn lại." },
    { q: "Vì sao không nên để chế độ debug của framework bật trên production?", options: [
        "Vì debug làm log ít hơn",
        "Trang lỗi chi tiết lộ stack trace, cấu hình, câu SQL; một số debug console còn cho chạy code",
        "Vì debug tắt HTTPS",
        "Không sao nếu có firewall"
      ], correct: 1,
      explanation: "Production trả lỗi chung chung + request ID; chi tiết chỉ nằm trong log nội bộ." },
    { q: "Thiết lập nào KHÔNG thuộc nhóm 'container quyền tối thiểu'?", options: [
        "runAsNonRoot: true",
        "readOnlyRootFilesystem: true",
        "capabilities drop ALL",
        "privileged: true để dễ debug"
      ], correct: 3,
      explanation: "privileged: true cho container gần như toàn quyền trên host — ngược hẳn với least privilege." },
    { q: "Service chỉ cần đọc/ghi file trong bucket invoices-prod. IAM policy nào đúng tinh thần least privilege?", options: [
        "Action: s3:* trên Resource: *",
        "Quyền AdministratorAccess cho tiện",
        "Action: s3:GetObject, s3:PutObject trên Resource: arn:aws:s3:::invoices-prod/*",
        "Dùng access key của tài khoản root"
      ], correct: 2,
      explanation: "Đúng hành động, đúng tài nguyên. Khi service bị chiếm, kẻ tấn công chỉ chạm được đúng bucket đó." },
    { q: "Ứng dụng khởi động trên production mà phát hiện mật khẩu DB là 'changeme'. Hành vi 'secure by default' là gì?", options: [
        "Ghi cảnh báo rồi chạy bình thường",
        "Từ chối khởi động và báo lỗi cấu hình rõ ràng",
        "Tự đổi mật khẩu thành ngẫu nhiên và in ra log",
        "Bỏ qua vì DB nằm trong mạng nội bộ"
      ], correct: 1,
      explanation: "Fail fast khi cấu hình không an toàn tốt hơn chạy âm thầm với lỗ hổng. In mật khẩu ra log là lỗi khác." },
    { q: "Vì sao nên bỏ header 'X-Powered-By: Express' và 'Server: nginx/1.x.y'?", options: [
        "Để response nhỏ hơn đáng kể",
        "Để không tiết lộ công nghệ và version, khiến việc tra lỗ hổng đã biết khó hơn",
        "Vì trình duyệt không hiểu",
        "Vì chúng gây lỗi CORS"
      ], correct: 1,
      explanation: "Không phải biện pháp chính (vẫn phải cập nhật bản vá), nhưng giảm thông tin miễn phí cho kẻ tấn công." },
    { q: "Cách tốt nhất để đảm bảo cấu hình bảo mật không bị 'trôi dạt' theo thời gian?", options: [
        "Nhờ một người nhớ kiểm tra mỗi quý",
        "Cấu hình dạng code có review + quét IaC/manifest + test tự động kiểm tra header và endpoint quản trị trong CI",
        "Không bao giờ deploy lại",
        "Chỉ cấu hình qua giao diện web của cloud"
      ], correct: 1,
      explanation: "Tự động hoá biến cấu hình an toàn thành điều được kiểm chứng liên tục, không phụ thuộc trí nhớ con người." }
  ]
});
