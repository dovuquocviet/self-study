window.LESSONS.push({
  id: "27",
  phase: "6", phaseName: "Vận hành & quy trình",
  title: "Secure SDLC — tổng kết khoá: đưa bảo mật vào mọi bước làm phần mềm",
  subtitle: "Threat model khi thiết kế · checklist review bảo mật · SAST/DAST/SCA/secret scan trong CI · test bảo mật · defense in depth",

  theory: `
    <p>Suốt khoá học, bạn đã gặp hàng chục loại lỗ hổng. Nếu chỉ nhớ chúng như một danh sách rời rạc, bạn sẽ quên. Bài cuối gom tất cả vào một <strong>quy trình</strong>:
    <strong>Secure SDLC</strong> (Secure Software Development Life Cycle) — bảo mật không phải bước "kiểm tra trước khi phát hành" do một team khác làm, mà là thói quen có mặt ở
    <strong>mọi giai đoạn</strong>: thiết kế, viết code, review, build, test, deploy, vận hành. Sửa một lỗi ở giai đoạn thiết kế rẻ hơn rất nhiều so với sửa sau khi đã lên production và bị khai thác
    (tư tưởng "shift left" — dời việc kiểm tra về phía đầu quy trình).</p>

    <p><strong>1. Bản đồ Secure SDLC</strong></p>
    <table>
      <tr><th>Giai đoạn</th><th>Việc bảo mật</th><th>Bài liên quan</th></tr>
      <tr><td>Yêu cầu & thiết kế</td><td>Threat model: tài sản, ranh giới tin cậy, STRIDE; xác định yêu cầu xác thực/phân quyền, dữ liệu nhạy cảm, hạn mức</td><td>01, 02</td></tr>
      <tr><td>Viết code</td><td>Dùng pattern an toàn mặc định: validate schema, query tham số hoá, không qua shell, thư viện crypto cấp cao, framework có auto-escape</td><td>03–22</td></tr>
      <tr><td>Review</td><td>Checklist bảo mật trong PR, CODEOWNERS cho phần nhạy cảm (auth, crypto, CI)</td><td>mục 3 bài này</td></tr>
      <tr><td>Build & CI</td><td>SAST, SCA, secret scan, quét IaC/container; lockfile, action pin hash, CI quyền tối thiểu</td><td>21, 24, 25</td></tr>
      <tr><td>Test</td><td>Unit/integration test cho phân quyền, validate, rate limit; DAST trên môi trường staging</td><td>mục 5 bài này</td></tr>
      <tr><td>Phát hành & deploy</td><td>Ký artifact, cấu hình an toàn, security headers, container non-root, IAM tối thiểu</td><td>24, 25</td></tr>
      <tr><td>Vận hành</td><td>Log sự kiện bảo mật, cảnh báo, ứng phó sự cố, cập nhật dependency thường xuyên</td><td>23, 26</td></tr>
    </table>

    <p><strong>2. Threat model khi thiết kế — nhẹ nhàng nhưng đều đặn.</strong> Không cần tài liệu 50 trang. Với mỗi tính năng mới có chạm tới dữ liệu nhạy cảm, tiền, quyền hoặc tích hợp bên ngoài,
    dành 30 phút trả lời bốn câu hỏi (bài 02):</p>
    <ol>
      <li><strong>Chúng ta đang xây gì?</strong> — vẽ luồng dữ liệu đơn giản: client, API, DB, dịch vụ ngoài, queue; đánh dấu các <strong>ranh giới tin cậy</strong>.</li>
      <li><strong>Điều gì có thể sai?</strong> — đi qua STRIDE cho từng ranh giới: giả mạo danh tính, sửa dữ liệu, chối bỏ hành động, lộ thông tin, từ chối dịch vụ, leo thang quyền.</li>
      <li><strong>Chúng ta sẽ làm gì với nó?</strong> — mỗi mối đe doạ có biện pháp cụ thể, có người chịu trách nhiệm, thành ticket/test.</li>
      <li><strong>Chúng ta đã làm đủ tốt chưa?</strong> — xem lại khi review và sau khi phát hành.</li>
    </ol>

    <p><strong>3. Checklist code review bảo mật — tổng hợp toàn khoá.</strong> Dùng khi review PR (không cần hỏi hết mọi câu cho mọi PR — chọn nhóm liên quan tới phần code thay đổi):</p>
    <table>
      <tr><th>Nhóm</th><th>Câu hỏi khi review</th></tr>
      <tr><td>Input (03)</td><td>Mọi input từ ngoài (body, query, header, file, message queue, webhook) có được parse theo schema allowlist, giới hạn độ dài/khoảng/số phần tử, từ chối field lạ?</td></tr>
      <tr><td>Injection (04–07)</td><td>Có chỗ nào nối chuỗi input vào SQL, filter NoSQL/LDAP, lệnh shell, template, <code>eval</code>? Có dùng query tham số hoá, tham số dạng mảng, allowlist cho tên cột/lệnh?</td></tr>
      <tr><td>File & parse (08, 09, 19)</td><td>Tên file/đường dẫn từ người dùng có được thay bằng ID sinh ở server và kiểm tra nằm trong thư mục gốc? Parser XML tắt entity ngoài? Không deserialize dữ liệu không tin cậy thành object tuỳ ý? Upload kiểm tra kích thước, kiểu thật, lưu ngoài web root?</td></tr>
      <tr><td>Xác thực (10–12)</td><td>Mật khẩu hash bằng Argon2id/bcrypt? Đăng nhập có rate limit, thông báo lỗi trung tính, MFA? Session/token có hết hạn, thu hồi được, cookie Secure/HttpOnly/SameSite?</td></tr>
      <tr><td>Phân quyền (13, 14)</td><td>Mỗi endpoint kiểm tra quyền trên <strong>từng object</strong> (owner/tenant) ở server? Deny by default? Không mass assignment? Quy tắc nghiệp vụ và thao tác đồng thời (race) được bảo vệ bằng transaction/khoá/điều kiện?</td></tr>
      <tr><td>Trình duyệt (15, 16, 18)</td><td>Output được encode theo ngữ cảnh? CSRF được chặn cho request dùng cookie? CORS allowlist, không phản chiếu Origin kèm credentials? Redirect chỉ tới đích trong allowlist? Không đưa input vào header thô?</td></tr>
      <tr><td>Gọi ra ngoài (17)</td><td>URL do người dùng cung cấp có allowlist host/scheme, chặn IP nội bộ sau khi phân giải DNS, không tự theo redirect?</td></tr>
      <tr><td>Crypto & secret (20, 21)</td><td>Dùng thư viện cấp cao, AEAD, CSPRNG, so sánh thời gian hằng? Không tự chế thuật toán? Không hardcode/commit secret, lấy từ secret manager?</td></tr>
      <tr><td>Lộ dữ liệu (22, 26)</td><td>Response chỉ trả field cần thiết (DTO), lỗi không lộ stack trace? Log không chứa mật khẩu/token/PII? Sự kiện bảo mật quan trọng có được audit?</td></tr>
      <tr><td>Tài nguyên (23)</td><td>Có rate limit, phân trang có trần, timeout cho mọi lời gọi ngoài, regex an toàn, việc nặng vào queue?</td></tr>
      <tr><td>Dependency & cấu hình (24, 25)</td><td>Dependency mới có cần thiết, đúng tên, được bảo trì? Lockfile cập nhật hợp lý? Cấu hình mới có bật debug, mở endpoint quản trị, cấp quyền IAM/container rộng hơn cần?</td></tr>
    </table>

    <p><strong>4. Công cụ tự động trong CI — mỗi loại bắt một kiểu lỗi khác nhau.</strong></p>
    <table>
      <tr><th>Loại</th><th>Làm gì</th><th>Ví dụ công cụ</th><th>Giới hạn</th></tr>
      <tr><td><strong>SAST</strong> (Static Application Security Testing)</td><td>Phân tích mã nguồn không cần chạy: tìm luồng input chảy tới SQL/shell/eval, crypto yếu, regex nguy hiểm</td>
        <td>Semgrep, CodeQL, SonarQube, Bandit (Python), gosec (Go), SpotBugs + FindSecBugs (Java), Brakeman (Rails)</td><td>Có báo nhầm; khó hiểu logic nghiệp vụ và phân quyền</td></tr>
      <tr><td><strong>SCA</strong></td><td>Dependency có lỗ hổng đã biết, license</td><td>Dependabot, Renovate, OSV-Scanner, npm audit, pip-audit, govulncheck, Trivy</td><td>Chỉ biết lỗ hổng đã được công bố</td></tr>
      <tr><td><strong>Secret scan</strong></td><td>Phát hiện key/token/mật khẩu trong code và lịch sử git — chạy cả pre-commit và CI</td><td>gitleaks, trufflehog, GitHub secret scanning + push protection</td><td>Secret đã lộ phải <em>xoay vòng</em>, xoá khỏi git là chưa đủ</td></tr>
      <tr><td><strong>IaC / container scan</strong></td><td>Cấu hình Terraform/K8s/Dockerfile không an toàn, lỗ hổng trong image</td><td>Checkov, tfsec, Trivy, Kyverno policy</td><td>Chỉ thấy cấu hình được khai báo dạng code</td></tr>
      <tr><td><strong>DAST</strong> (Dynamic)</td><td>Gửi request thật tới ứng dụng đang chạy (staging) để tìm lỗi phản hồi, header thiếu, endpoint lộ</td><td>OWASP ZAP (baseline/API scan), Burp Suite, Nuclei với template được duyệt</td><td>Chậm hơn, chỉ thấy phần nó tới được; chỉ chạy trên môi trường của mình</td></tr>
    </table>
    <p>Nguyên tắc áp dụng: <strong>bắt đầu nhỏ</strong> (vài rule chất lượng cao), <strong>chặn PR chỉ với lỗi mới mức cao</strong> (không bắt team sửa hết nợ cũ trong một ngày), có quy trình đánh dấu báo nhầm có lý do,
    và theo dõi xu hướng. Công cụ là lưới an toàn — <strong>không thay thế</strong> threat model, review và test do người viết.</p>

    <p><strong>5. Viết test bảo mật — biến quy tắc thành thứ không thể quên.</strong> Lỗ hổng phân quyền và logic nghiệp vụ gần như không công cụ nào tìm được; chỉ test do bạn viết mới bắt được. Ví dụ những test nên có:</p>
    <ul>
      <li><strong>Ma trận phân quyền</strong>: với mỗi endpoint × mỗi vai trò (khách, user A, user B, admin, tenant khác) → mong đợi 200/403/404. User A đọc/sửa/xoá tài nguyên của user B phải thất bại.</li>
      <li><strong>Test "mọi route đều được bảo vệ"</strong>: duyệt danh sách route của framework, khẳng định mỗi route có middleware xác thực trừ allowlist route công khai — thêm route mới quên bảo vệ là test đỏ.</li>
      <li><strong>Validate</strong>: input sai kiểu, quá dài, field lạ (<code>role</code>, <code>is_admin</code>), số âm, page_size quá lớn → 400 và dữ liệu không đổi.</li>
      <li><strong>Injection dạng hồi quy</strong>: input chứa ký tự đặc biệt (<code>'</code>, <code>"</code>, <code>;</code>, <code>&lt;</code>) được lưu và trả về nguyên văn như dữ liệu — không lỗi, không đổi hành vi.</li>
      <li><strong>Xác thực & phiên</strong>: token hết hạn/bị thu hồi bị từ chối; đăng xuất vô hiệu phiên; rate limit đăng nhập kích hoạt sau N lần.</li>
      <li><strong>Lộ dữ liệu</strong>: response không chứa field nhạy cảm (<code>password_hash</code>); log không chứa mật khẩu; lỗi 500 không có stack trace.</li>
      <li><strong>Mỗi lỗ hổng từng được sửa → một test hồi quy</strong> để nó không bao giờ quay lại.</li>
    </ul>

    <p><strong>6. Defense in depth — phòng thủ nhiều lớp.</strong> Không lớp nào hoàn hảo, nên xếp chồng nhiều lớp độc lập sao cho một lớp hỏng thì lớp khác vẫn chặn/giảm thiệt hại. Ví dụ cho một lỗi SQL Injection:</p>
    <ol>
      <li>Validate schema chặn phần lớn input lạ (bài 03).</li>
      <li>Query tham số hoá khiến input không thể thành lệnh (bài 04) — <strong>lớp chính</strong>.</li>
      <li>SAST phát hiện chỗ nối chuỗi khi review; test hồi quy giữ cho nó không quay lại.</li>
      <li>User DB của ứng dụng chỉ có quyền trên schema của nó, không phải superuser (bài 25).</li>
      <li>Dữ liệu cực nhạy cảm được mã hoá ở tầng ứng dụng (bài 20) — đọc được bảng cũng chưa đọc được nội dung.</li>
      <li>Log + cảnh báo phát hiện truy vấn bất thường, xuất dữ liệu bất thường (bài 26).</li>
      <li>Quy trình ứng phó sự cố giới hạn thời gian kẻ tấn công ở trong hệ thống.</li>
    </ol>

    <p><strong>7. Văn hoá.</strong> Bảo mật bền vững khi nó là <em>việc của mọi người</em>: có "security champion" trong mỗi team, lỗi bảo mật được xử lý như bug nghiêm trọng chứ không bị trì hoãn vô thời hạn,
    ai phát hiện vấn đề được cảm ơn chứ không bị trách, và kiến thức được chia sẻ qua post-mortem. Những nguyên tắc xuyên suốt khoá học:</p>
    <ul>
      <li><strong>Không tin input</strong> — mọi thứ từ ngoài ranh giới tin cậy đều có thể độc.</li>
      <li><strong>Tách dữ liệu khỏi lệnh</strong> — gốc của mọi loại injection.</li>
      <li><strong>Deny by default & least privilege</strong> — cho phép đúng thứ cần, không hơn.</li>
      <li><strong>Dùng công cụ đã được kiểm chứng</strong> — framework, thư viện crypto, parser; đừng tự chế.</li>
      <li><strong>Fail securely</strong> — khi lỗi, đóng lại chứ không mở ra; lỗi không lộ chi tiết.</li>
      <li><strong>Giả định sẽ bị xâm nhập</strong> — giới hạn thiệt hại, phát hiện sớm, phục hồi nhanh.</li>
    </ul>

    <div class="callout"><p>💡 Bắt đầu từ đâu với dự án của bạn ngay tuần này? (1) Bật secret scan + SCA trong CI. (2) Viết test ma trận phân quyền cho 5 endpoint quan trọng nhất.
    (3) Thêm checklist bảo mật vào template PR. (4) Làm threat model 30 phút cho tính năng sắp làm. Mỗi bước nhỏ, nhưng cộng lại thay đổi hẳn chất lượng bảo mật.</p></div>
  `,

  codeTabs: [
    { id: "threat", label: "🗺️ Threat model", lines: [
      "# Threat model 30 phút cho tính năng: 'Xuất hoá đơn PDF cho khách hàng'",
      "",
      "Luồng:  Browser -> API /invoices/{id}/pdf -> DB (invoices) -> worker PDF -> S3 -> link tải",
      "Ranh giới tin cậy: Internet|API · API|worker (queue) · worker|S3",
      "Tài sản: dữ liệu hoá đơn (PII, số tiền), tài nguyên CPU của worker",
      "",
      "STRIDE                  Mối đe doạ                               Biện pháp -> ticket/test",
      "Spoofing                gọi API không đăng nhập                  middleware auth, test route được bảo vệ",
      "Tampering               sửa invoice_id xem hoá đơn người khác    check owner/tenant (bài 13), test ma trận quyền",
      "Repudiation             chối đã tải hoá đơn                      audit 'invoice.download' (bài 26)",
      "Information disclosure  link S3 công khai, tồn tại mãi           presigned URL hết hạn 5 phút",
      "Denial of service       spam xuất PDF                            rate limit + queue + giới hạn job chờ (bài 23)",
      "Elevation of privilege  template PDF nhận input -> injection     template cố định, auto-escape (bài 07)"
    ]},
    { id: "ci", label: "🏗️ Pipeline CI", lines: [
      "# Pipeline bảo mật trong CI (pseudo-YAML, áp dụng cho GitHub/GitLab/Jenkins...)",
      "stages: [secrets, build, test, scan, package, deploy-staging, dast, deploy-prod]",
      "",
      "secrets:   gitleaks detect --redact                  # secret trong code/lịch sử git",
      "build:     npm ci   # hoặc pip/go/cargo --locked      # cài đúng lockfile (bài 24)",
      "test:      npm test -- --suite unit,authz,validation # test bảo mật do team viết",
      "scan:",
      "  - semgrep scan --config p/owasp-top-ten --error     # SAST: chặn PR khi có lỗi MỚI mức cao",
      "  - osv-scanner scan -r .                             # SCA",
      "  - checkov -d infra/ ; trivy config k8s/             # IaC",
      "package:",
      "  - build image -> trivy image -> syft SBOM -> cosign sign",
      "dast:      zap-baseline -t https://staging.example.internal   # chỉ trên môi trường của mình",
      "deploy-prod:",
      "  needs: [dast]; environment: production (bảo vệ, cần phê duyệt)"
    ]},
    { id: "authz", label: "🧪 Test phân quyền", lines: [
      "// Ma trận: endpoint x vai trò -> status mong đợi",
      "MATRIX = [",
      "  // endpoint                         anon  ownerA  userB  tenantX  admin",
      "  ['GET    /invoices/{A1}',           401,  200,    404,   404,     200],",
      "  ['PATCH  /invoices/{A1}',           401,  200,    404,   404,     200],",
      "  ['DELETE /invoices/{A1}',           401,  403,    404,   404,     204],",
      "  ['GET    /admin/users',             401,  403,    403,   403,     200],",
      "]",
      "",
      "for [endpoint, ...expected] in MATRIX:",
      "  for (role, status) in zip(ROLES, expected):",
      "    test endpoint + ' as ' + role:",
      "      res = call(endpoint, as=role)",
      "      assert res.status == status",
      "      if status >= 400: assert db.invoice(A1) unchanged",
      "",
      "// Mọi route phải có auth, trừ allowlist công khai",
      "test 'no unprotected routes':",
      "  for r in app.routes(): assert r.hasMiddleware('auth') or r.path in PUBLIC_ROUTES"
    ]},
    { id: "valtest", label: "🧪 Test validate & lộ dữ liệu", lines: [
      "test 'từ chối field lạ (mass assignment)':",
      "  res = patch('/me', { name: 'An', role: 'admin' }, as=userA)",
      "  assert res.status == 400 and db.user(userA).role == 'user'",
      "",
      "test 'giới hạn page_size':",
      "  assert get('/orders?page_size=1000000', as=userA).status == 400",
      "",
      "test 'ký tự đặc biệt chỉ là dữ liệu':",
      "  for s in [\"O'Brien\", 'a\"b', 'x;y', '<b>hi</b>', '<user_input_payload>']:",
      "    id = post('/notes', { text: s }, as=userA).json.id",
      "    assert get('/notes/' + id, as=userA).json.text == s",
      "",
      "test 'response không lộ field nhạy cảm':",
      "  body = get('/users/' + userA.id, as=userA).json",
      "  assert 'password_hash' not in body and 'mfa_secret' not in body",
      "",
      "test 'lỗi 500 không có stack trace':",
      "  res = triggerInternalError()",
      "  assert res.json == { error: 'internal_error', request_id: ANY }"
    ]},
    { id: "pr", label: "✅ Template PR", lines: [
      "## Checklist bảo mật (đánh dấu mục liên quan tới thay đổi)",
      "- [ ] Input mới được parse theo schema allowlist, có giới hạn (bài 03, 23)",
      "- [ ] Không nối chuỗi input vào SQL/filter/shell/template/eval (bài 04-07)",
      "- [ ] File/path/URL/redirect từ người dùng: allowlist + kiểm tra (bài 08, 17, 18, 19)",
      "- [ ] Endpoint mới có xác thực + kiểm tra quyền trên từng object (bài 11-14)",
      "- [ ] Output encode đúng ngữ cảnh; CSRF/CORS đúng (bài 15, 16)",
      "- [ ] Không hardcode secret; crypto dùng thư viện cấp cao (bài 20, 21)",
      "- [ ] Response/log không lộ dữ liệu nhạy cảm; sự kiện bảo mật được audit (bài 22, 26)",
      "- [ ] Dependency mới đã kiểm tra; cấu hình không mở rộng quyền (bài 24, 25)",
      "- [ ] Có test cho quy tắc bảo mật mới (phân quyền, validate, hồi quy)",
      "",
      "# CODEOWNERS: phần nhạy cảm cần security champion duyệt",
      "/src/auth/**      @team/security-champions",
      "/src/crypto/**    @team/security-champions",
      "/.github/workflows/**  @team/platform"
    ]}
  ],

  stageHtml: `
    <div class="node" id="design"><div class="nl">🗺️ Thiết kế</div><div class="ns">threat model · STRIDE · ranh giới tin cậy</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="code"><div class="nl">⌨️ Viết code</div><div class="ns">pattern an toàn mặc định (bài 03–22)</div></div>
    <div class="arrow" id="a2">↓ PR</div>
    <div class="row">
      <div class="node" id="review"><div class="nl">👀 Review</div><div class="ns">checklist · CODEOWNERS</div></div>
      <div class="node" id="ci"><div class="nl">🏗️ CI tự động</div><div class="ns">secret scan · SAST · SCA · IaC</div></div>
      <div class="node" id="tests"><div class="nl">🧪 Test bảo mật</div><div class="ns">ma trận quyền · validate · hồi quy</div></div>
    </div>
    <div class="arrow" id="a3">↓ build · ký · deploy staging</div>
    <div class="node" id="dast"><div class="nl">🔎 DAST trên staging</div><div class="ns">ZAP baseline · header · endpoint lộ</div></div>
    <div class="arrow" id="a4">↓ phê duyệt</div>
    <div class="node" id="prod"><div class="nl">🚀 Production & vận hành</div><div class="ns">cấu hình an toàn · log · cảnh báo · ứng phó sự cố</div></div>
    <div class="arrow" id="a5">↺ bài học từ sự cố quay lại thiết kế & test</div>
  `,
  steps: [
    { title: "1 · Threat model ngay khi thiết kế", tab: "threat", highlight: [3, 4, 5, 7, 8, 9, 10, 11, 12, 13], on: ["design"],
      desc: "30 phút cho mỗi tính năng nhạy cảm: vẽ luồng, đánh dấu ranh giới tin cậy, đi qua STRIDE. Mỗi mối đe doạ thành một biện pháp cụ thể → ticket và test." },
    { title: "2 · Code theo pattern an toàn, review theo checklist", tab: "pr", highlight: [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15], on: ["a1", "code", "a2", "review"],
      desc: "Checklist trong template PR nhắc đúng những câu hỏi của từng bài học. CODEOWNERS đảm bảo phần auth/crypto/CI luôn có người am hiểu bảo mật duyệt." },
    { title: "3 · CI: mỗi công cụ bắt một kiểu lỗi", tab: "ci", highlight: [4, 5, 8, 9, 10, 12], on: ["ci"],
      desc: "Secret scan (gitleaks), cài theo lockfile, SAST (Semgrep/CodeQL), SCA (OSV), quét IaC và image, sinh SBOM, ký image. Chặn PR khi có lỗi <em>mới</em> mức cao." },
    { title: "4 · Test ma trận phân quyền", tab: "authz", highlight: [2, 3, 4, 5, 6, 7, 14, 15, 18, 19], on: ["tests"],
      desc: "Lỗi phân quyền gần như không công cụ nào tìm được. Ma trận endpoint × vai trò khẳng định user B không chạm được tài nguyên của A, và test 'mọi route đều có auth' bắt route mới bị quên bảo vệ." },
    { title: "5 · Test validate, injection hồi quy, lộ dữ liệu", tab: "valtest", highlight: [2, 3, 6, 9, 10, 11, 15, 19], on: ["tests"],
      desc: "Field lạ bị từ chối và dữ liệu không đổi; ký tự đặc biệt được lưu và trả về nguyên văn; response không có <code>password_hash</code>; lỗi 500 không có stack trace." },
    { title: "6 · DAST trên staging trước production", tab: "ci", highlight: [13, 14, 15], on: ["a3", "dast", "a4"],
      desc: "Quét ứng dụng đang chạy (chỉ trên môi trường của mình) để bắt những gì chỉ lộ ra khi chạy: header thiếu, endpoint quản trị mở, lỗi lộ thông tin. Production cần phê duyệt." },
    { title: "7 · Vận hành & vòng lặp học hỏi", tab: "threat", highlight: [10, 12], on: ["prod", "a5", "design"],
      desc: "Log, cảnh báo, ứng phó sự cố. Mỗi sự cố và mỗi lỗ hổng được sửa trở thành test hồi quy, rule SAST hoặc mục checklist mới — defense in depth được bồi đắp liên tục." }
  ],

  quiz: [
    { q: "'Shift left' trong Secure SDLC nghĩa là gì?", options: [
        "Chuyển toàn bộ việc bảo mật cho team vận hành",
        "Đưa hoạt động bảo mật về sớm hơn trong quy trình (thiết kế, viết code, PR) vì sửa lỗi càng sớm càng rẻ",
        "Chỉ kiểm tra bảo mật trước ngày phát hành",
        "Dời server sang trung tâm dữ liệu khác"
      ], correct: 1,
      explanation: "Lỗi thiết kế phát hiện lúc vẽ luồng dữ liệu tốn vài phút; phát hiện sau khi bị khai thác tốn rất nhiều lần hơn." },
    { q: "Trong STRIDE, việc user sửa invoice_id trên URL để xem hoá đơn của người khác liên quan chủ yếu tới biện pháp nào?", options: [
        "Bật HSTS",
        "Kiểm tra quyền trên từng object theo owner/tenant ở server (chống IDOR/BOLA)",
        "Mã hoá invoice_id bằng base64",
        "Tăng độ dài mật khẩu"
      ], correct: 1,
      explanation: "ID khó đoán không thay thế kiểm tra quyền. Mỗi truy cập object phải kèm điều kiện owner/tenant (bài 13)." },
    { q: "Công cụ nào phù hợp nhất để phát hiện một access key cloud vô tình bị commit vào git?", options: [
        "DAST",
        "Secret scanning (gitleaks, trufflehog, GitHub push protection)",
        "Rate limiter",
        "CSP"
      ], correct: 1,
      explanation: "Và khi key đã lộ: xoay vòng (thu hồi, cấp mới) ngay — xoá khỏi lịch sử git là chưa đủ vì có thể đã bị sao chép." },
    { q: "Điểm khác biệt chính giữa SAST và DAST?", options: [
        "SAST phân tích mã nguồn không cần chạy; DAST gửi request tới ứng dụng đang chạy",
        "SAST chỉ dùng cho frontend, DAST cho backend",
        "Hai công cụ giống hệt nhau",
        "DAST quét dependency, SAST quét container"
      ], correct: 0,
      explanation: "Hai cách nhìn bổ sung cho nhau: SAST thấy luồng code bên trong, DAST thấy hành vi thực tế từ bên ngoài." },
    { q: "Loại lỗ hổng nào công cụ tự động (SAST/DAST) THƯỜNG KHÓ phát hiện nhất, nên cần test do team tự viết?", options: [
        "Header bảo mật bị thiếu",
        "Dependency có CVE đã công bố",
        "Lỗi phân quyền và logic nghiệp vụ (user A xem được dữ liệu của user B, áp mã giảm giá hai lần)",
        "Secret bị commit"
      ], correct: 2,
      explanation: "Công cụ không biết 'ai được phép làm gì' trong nghiệp vụ của bạn. Test ma trận phân quyền và test quy tắc nghiệp vụ lấp khoảng trống này." },
    { q: "Test 'duyệt mọi route của app, khẳng định mỗi route có middleware xác thực trừ danh sách công khai' nhằm bắt lỗi gì?", options: [
        "Route bị chậm",
        "Route mới được thêm nhưng quên gắn xác thực/phân quyền",
        "Lỗi cú pháp",
        "Route trùng tên"
      ], correct: 1,
      explanation: "Deny by default được kiểm chứng bằng test: quên bảo vệ route mới → test đỏ ngay trong CI." },
    { q: "Defense in depth nghĩa là gì?", options: [
        "Chỉ cần một biện pháp thật mạnh",
        "Xếp nhiều lớp phòng thủ độc lập để khi một lớp hỏng, lớp khác vẫn chặn hoặc giảm thiệt hại",
        "Đặt server thật sâu trong mạng",
        "Mã hoá dữ liệu nhiều lần bằng cùng một khoá"
      ], correct: 1,
      explanation: "Ví dụ với SQLi: validate + query tham số hoá + SAST + user DB quyền thấp + mã hoá dữ liệu nhạy cảm + cảnh báo truy vấn bất thường." },
    { q: "Gốc chung của SQL injection, command injection, template injection và log injection là gì?", options: [
        "Dùng sai ngôn ngữ lập trình",
        "Dữ liệu không tin cậy bị trộn vào một ngữ cảnh mà nó được diễn giải như lệnh/cấu trúc",
        "Thiếu RAM",
        "Không bật HTTPS"
      ], correct: 1,
      explanation: "Cách chữa chung: tách dữ liệu khỏi lệnh (tham số hoá, mảng tham số, structured logging) và dùng allowlist." },
    { q: "Ứng dụng lưu mật khẩu người dùng. Lựa chọn nào đúng (bài 10)?", options: [
        "MD5 có salt",
        "Mã hoá AES để khi cần có thể giải mã lại",
        "Hash chậm có salt: Argon2id, bcrypt, scrypt hoặc PBKDF2",
        "SHA-256 một lần, không salt"
      ], correct: 2,
      explanation: "Mật khẩu cần hash một chiều, chậm, có salt — không phải mã hoá hai chiều, không phải hash nhanh." },
    { q: "API nhận URL từ người dùng để tải ảnh về (bài 17). Biện pháp nào đúng?", options: [
        "Tải bất kỳ URL nào vì chỉ là ảnh",
        "Allowlist scheme/host, phân giải DNS rồi chặn IP nội bộ/metadata, không tự theo redirect, có timeout và giới hạn kích thước",
        "Chỉ kiểm tra URL bắt đầu bằng 'http'",
        "Chặn chữ 'localhost' trong chuỗi URL là đủ"
      ], correct: 1,
      explanation: "SSRF: server bị lợi dụng để gọi vào mạng nội bộ. Denylist chuỗi dễ bị vượt; phải kiểm tra đích thật sau khi phân giải." },
    { q: "Khi SAST lần đầu bật trên dự án cũ báo 800 cảnh báo, chiến lược hợp lý là gì?", options: [
        "Tắt SAST vì quá nhiều",
        "Chặn mọi PR cho tới khi sửa hết 800 cảnh báo",
        "Chặn PR với lỗi MỚI mức cao, lập kế hoạch xử lý dần nợ cũ theo mức độ, đánh dấu báo nhầm có lý do",
        "Đánh dấu tất cả là báo nhầm"
      ], correct: 2,
      explanation: "Ngăn nợ mới phát sinh trước, trả nợ cũ theo ưu tiên — cách duy nhất để công cụ không bị cả team phớt lờ." },
    { q: "Endpoint trả về object user đầy đủ gồm cả password_hash và mfa_secret. Lỗi thuộc nhóm nào và sửa thế nào?", options: [
        "Lỗi hiệu năng — thêm cache",
        "Lộ dữ liệu nhạy cảm — dùng DTO/allowlist field cho response và viết test khẳng định field nhạy cảm không xuất hiện",
        "Lỗi CORS — thêm header",
        "Không phải lỗi vì hash không đảo ngược được"
      ], correct: 1,
      explanation: "Hash vẫn có thể bị bẻ offline; mfa_secret lộ là mất MFA. Response chỉ nên chứa field cần thiết (bài 22)." },
    { q: "Một lỗ hổng vừa được sửa trong production. Việc nào giúp nó không quay lại nhất?", options: [
        "Ghi chú vào wiki",
        "Viết test hồi quy tái hiện đúng lỗi đó (và nếu được, thêm rule SAST/mục checklist)",
        "Nhắc team trong buổi họp",
        "Không cần làm gì thêm"
      ], correct: 1,
      explanation: "Test chạy mỗi lần CI — một lần refactor vô tình mở lại lỗ hổng sẽ bị bắt ngay." },
    { q: "Nguyên tắc nào sau đây KHÔNG phải nguyên tắc xuyên suốt của khoá học?", options: [
        "Không tin input từ ngoài ranh giới tin cậy",
        "Deny by default và least privilege",
        "Tự viết thuật toán mã hoá riêng để kẻ tấn công không biết",
        "Giả định sẽ bị xâm nhập: giới hạn thiệt hại, phát hiện sớm"
      ], correct: 2,
      explanation: "Security through obscurity không phải bảo mật. Dùng thuật toán và thư viện đã được kiểm chứng (bài 20)." }
  ]
});
