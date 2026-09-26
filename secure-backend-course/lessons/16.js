window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Các lỗi phía web",
  title: "CSRF & CORS",
  subtitle: "SameSite cookie · CSRF token · kiểm tra Origin · CORS allowlist · CORS không phải cơ chế xác thực",

  theory: `
    <p>Hai khái niệm này hay bị nhầm vì cùng xoay quanh chuyện "trang web A gửi request tới server B". Nhưng chúng giải quyết hai việc khác nhau:</p>
    <ul>
      <li><strong>CSRF (Cross-Site Request Forgery)</strong> là một <em>lỗ hổng</em>: trang lạ khiến trình duyệt của người dùng gửi request <em>có kèm cookie đăng nhập</em>
        tới server của bạn, và server tưởng chính người dùng muốn làm việc đó (đổi email, chuyển tiền, xoá dữ liệu).</li>
      <li><strong>CORS (Cross-Origin Resource Sharing)</strong> là một <em>cơ chế nới lỏng</em>: mặc định trình duyệt không cho JS của trang A <strong>đọc</strong> response từ server B
        (Same-Origin Policy). CORS là cách server B nói "tôi cho phép origin này đọc". Cấu hình CORS sai = tự mở cửa.</li>
    </ul>

    <p><strong>1. Origin và "site" là gì?</strong></p>
    <table>
      <tr><th>Khái niệm</th><th>Gồm</th><th>Ví dụ</th></tr>
      <tr><td>Origin</td><td>scheme + host + port</td><td><code>https://app.example.com</code> khác <code>https://api.example.com</code> (khác host)</td></tr>
      <tr><td>Site</td><td>scheme + "domain đăng ký" (eTLD+1)</td><td><code>app.example.com</code> và <code>api.example.com</code> <strong>cùng site</strong> <code>example.com</code></td></tr>
    </table>
    <p>SameSite cookie dựa trên <em>site</em>; CORS dựa trên <em>origin</em>. Nhớ điểm này để hiểu vì sao subdomain bị chiếm quyền vẫn là rủi ro với SameSite.</p>

    <p><strong>2. CSRF xảy ra khi nào?</strong> Khi đủ 3 điều kiện:</p>
    <ol>
      <li>Có hành động thay đổi trạng thái (POST/PUT/DELETE…) đáng giá.</li>
      <li>Server xác thực chỉ dựa vào thứ trình duyệt <em>tự động</em> đính kèm: cookie, HTTP Basic auth, chứng chỉ client.</li>
      <li>Request không có tham số nào mà trang lạ không đoán được.</li>
    </ol>
    <p>Trang lạ chỉ cần một form tự submit tới <code>https://bank.example/transfer</code>; trình duyệt tự gửi kèm cookie. Trang lạ không đọc được kết quả — nhưng không cần đọc, hành động đã xảy ra.
    API dùng header <code>Authorization: Bearer …</code> do JS tự gắn thì <em>không</em> bị CSRF theo cách này (trình duyệt không tự gắn header đó).</p>

    <p><strong>3. Phòng thủ CSRF — nhiều lớp:</strong></p>
    <ul>
      <li><strong>SameSite cookie</strong>: <code>SameSite=Lax</code> (mặc định ở nhiều trình duyệt hiện đại, nhưng hãy đặt tường minh) — cookie không được gửi kèm request POST từ site khác.
        <code>Strict</code> chặt hơn (không gửi cả khi bấm link từ site khác). <code>None</code> chỉ dùng khi thật sự cần nhúng cross-site và bắt buộc đi kèm <code>Secure</code>.</li>
      <li><strong>CSRF token</strong> (synchronizer token): server sinh giá trị ngẫu nhiên gắn với phiên, nhúng vào form/meta tag; mọi request thay đổi trạng thái phải gửi lại token đó
        (trong field ẩn hoặc header <code>X-CSRF-Token</code>); server so sánh bằng hàm <em>constant-time</em>. Trang lạ không đọc được token nên không giả mạo được.
        Biến thể "double-submit cookie" nên dùng bản có ký HMAC gắn với session.</li>
      <li><strong>Kiểm tra Origin / Sec-Fetch-Site</strong>: với request thay đổi trạng thái, header <code>Origin</code> phải thuộc allowlist; hoặc từ chối khi
        <code>Sec-Fetch-Site: cross-site</code>. Đây là lớp rất rẻ và hiệu quả.</li>
      <li><strong>Đúng ngữ nghĩa HTTP</strong>: GET/HEAD không bao giờ thay đổi dữ liệu. Nếu <code>GET /delete?id=5</code> xoá được bản ghi, mọi biện pháp trên đều dễ bị vượt.</li>
      <li>Hành động cực nhạy cảm (đổi mật khẩu, đổi email, chuyển tiền): yêu cầu nhập lại mật khẩu hoặc OTP.</li>
      <li>Dùng middleware CSRF có sẵn của framework (Django, Rails, Laravel, Spring Security, ASP.NET antiforgery…) thay vì tự viết — và đừng tắt nó "cho nhanh".</li>
    </ul>

    <p><strong>4. CORS — cấu hình đúng.</strong> Luồng cơ bản: trình duyệt gửi request kèm <code>Origin</code>; server trả <code>Access-Control-Allow-Origin</code>;
    trình duyệt so khớp rồi mới cho JS đọc response. Với request "không đơn giản" (method PUT/DELETE, header tuỳ chỉnh, JSON…) trình duyệt gửi trước một request
    <code>OPTIONS</code> (preflight).</p>
    <table>
      <tr><th>Sai lầm</th><th>Hậu quả</th><th>Cách đúng</th></tr>
      <tr><td>Phản chiếu Origin bất kỳ: lấy header Origin gửi lên và trả lại y nguyên</td><td>Mọi website đều đọc được dữ liệu người dùng</td><td>So khớp <strong>chính xác</strong> với allowlist cấu hình sẵn</td></tr>
      <tr><td>Phản chiếu Origin + <code>Allow-Credentials: true</code></td><td>Trang lạ đọc được dữ liệu <em>đã đăng nhập</em> của nạn nhân</td><td>Chỉ bật credentials cho origin tin cậy, liệt kê cụ thể</td></tr>
      <tr><td>So khớp bằng "chứa chuỗi" / "kết thúc bằng" / regex lỏng</td><td>Domain do kẻ xấu đăng ký trùng một phần vẫn lọt</td><td>So sánh bằng nhau cả scheme+host+port; regex phải neo đầu cuối và escape dấu chấm</td></tr>
      <tr><td>Cho phép origin <code>null</code></td><td>iframe sandbox/file cục bộ đều có origin <code>null</code></td><td>Không bao giờ allow <code>null</code></td></tr>
      <tr><td>Quên <code>Vary: Origin</code> khi trả header động</td><td>CDN/cache trả nhầm header của origin này cho origin khác</td><td>Luôn thêm <code>Vary: Origin</code></td></tr>
    </table>
    <p><code>Access-Control-Allow-Origin: *</code> chỉ chấp nhận được với dữ liệu <strong>công khai thật sự</strong> (vd API tỷ giá công khai) — và trình duyệt không cho dùng <code>*</code> cùng credentials.</p>

    <p><strong>5. CORS KHÔNG phải cơ chế xác thực hay phân quyền.</strong></p>
    <ul>
      <li>CORS chỉ được thực thi bởi <em>trình duyệt</em>. curl, Postman, script, server khác… bỏ qua CORS hoàn toàn. Mọi endpoint vẫn phải kiểm tra đăng nhập và quyền (authN/authZ).</li>
      <li>CORS không chặn request được <em>gửi đi</em> — nó chỉ chặn JS <em>đọc</em> response. Request "đơn giản" (form POST) vẫn tới server và vẫn gây tác dụng → đó là lý do cần phòng CSRF riêng.</li>
      <li>Ngược lại, cấu hình CORS quá rộng lại <em>tạo ra</em> lỗ hổng (trang lạ đọc được dữ liệu người dùng).</li>
    </ul>

    <div class="callout"><p>💡 Tóm tắt: <strong>CSRF</strong> = chặn trang lạ <em>khiến</em> trình duyệt gửi request có cookie → SameSite + CSRF token + kiểm tra Origin.
    <strong>CORS</strong> = cho phép trang cụ thể <em>đọc</em> response → allowlist chính xác, cẩn thận credentials, không phải lớp bảo mật thay cho authN/authZ.</p></div>
  `,

  codeTabs: [
    { id: "csrf", label: "❌ Lỗ hổng CSRF", lines: [
      "// Server chỉ dựa vào cookie để biết 'ai đang gọi'",
      "handle POST /account/email (req):",
      "    user = sessionFromCookie(req)         // trình duyệt TỰ gửi cookie",
      "    user.email = req.body.email",
      "    save(user)",
      "",
      "// Còn tệ hơn: GET thay đổi dữ liệu",
      "handle GET /posts/:id/delete (req):",
      "    deletePost(req.params.id)",
      "",
      "// Trang lạ (evil.example) chỉ cần một form ẩn tự submit tới",
      "// https://app.example/account/email với <email_của_kẻ_xấu>.",
      "// Trình duyệt nạn nhân gửi kèm cookie -> server làm theo."
    ]},
    { id: "defense", label: "✅ Phòng CSRF", lines: [
      "// 1. Cookie phiên",
      "Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Lax; Path=/",
      "",
      "// 2. Kiểm tra nguồn gốc cho mọi method thay đổi trạng thái",
      "middleware csrfGuard(req):",
      "    if req.method in ['GET', 'HEAD', 'OPTIONS']: return next()",
      "    if req.headers['Sec-Fetch-Site'] == 'cross-site': reject(403)",
      "    origin = req.headers['Origin']",
      "    if origin != null and origin not in ALLOWED_ORIGINS: reject(403)",
      "",
      "    // 3. CSRF token gắn với phiên",
      "    sent = req.headers['X-CSRF-Token'] or req.body._csrf",
      "    if not constantTimeEquals(sent, req.session.csrfToken): reject(403)",
      "    return next()",
      "",
      "// Token sinh bằng CSPRNG khi tạo phiên: randomBytes(32)"
    ]},
    { id: "cors-bad", label: "❌ CORS sai", lines: [
      "// SAI 1: phản chiếu mọi Origin + cho credentials",
      "res.header('Access-Control-Allow-Origin', req.headers['Origin'])",
      "res.header('Access-Control-Allow-Credentials', 'true')",
      "",
      "// SAI 2: so khớp lỏng",
      "if origin.endsWith('example.com'): allow(origin)     // 'notexample.com' lọt",
      "if origin.contains('example.com'): allow(origin)     // 'example.com.evil.test' lọt",
      "if regex('https://.*.example.com').matches(origin)   // dấu . không escape, không neo",
      "",
      "// SAI 3: cho phép 'null'",
      "ALLOWED = ['https://app.example.com', 'null']",
      "",
      "// SAI 4: nghĩ CORS là bảo mật -> bỏ kiểm tra đăng nhập",
      "// 'chỉ frontend của mình gọi được' -> SAI, curl gọi thoải mái"
    ]},
    { id: "cors-good", label: "✅ CORS đúng", lines: [
      "ALLOWED_ORIGINS = {                       // lấy từ cấu hình, theo môi trường",
      "    'https://app.example.com',",
      "    'https://admin.example.com'",
      "}",
      "",
      "middleware cors(req, res):",
      "    origin = req.headers['Origin']",
      "    res.header('Vary', 'Origin')",
      "    if origin in ALLOWED_ORIGINS:             // so sánh BẰNG NHAU",
      "        res.header('Access-Control-Allow-Origin', origin)",
      "        res.header('Access-Control-Allow-Credentials', 'true')",
      "        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')",
      "        res.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')",
      "        res.header('Access-Control-Max-Age', '600')",
      "    // origin lạ: không trả header CORS nào",
      "",
      "// Endpoint VẪN kiểm tra authN + authZ như bình thường"
    ]},
    { id: "langs", label: "🌐 Đa framework", lines: [
      "# Express (Node): thư viện cors với danh sách cụ thể",
      "app.use(cors({ origin: ['https://app.example.com'], credentials: true }))",
      "",
      "# Spring (Java)",
      "config.setAllowedOrigins(List.of(\"https://app.example.com\")); config.setAllowCredentials(true);",
      "",
      "# Django: django-cors-headers + CSRF middleware mặc định",
      "CORS_ALLOWED_ORIGINS = ['https://app.example.com']; CSRF_TRUSTED_ORIGINS = ['https://app.example.com']",
      "",
      "# ASP.NET Core",
      "policy.WithOrigins(\"https://app.example.com\").AllowCredentials();  // + [ValidateAntiForgeryToken]",
      "",
      "# Go (rs/cors)",
      "cors.New(cors.Options{ AllowedOrigins: []string{\"https://app.example.com\"}, AllowCredentials: true })"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="evil"><div class="nl">🕸️ Trang lạ</div><div class="ns">evil.example</div></div>
      <div class="node" id="app"><div class="nl">🖥️ Frontend hợp lệ</div><div class="ns">app.example.com</div></div>
    </div>
    <div class="arrow" id="a1">↓ trình duyệt gửi request (có thể kèm cookie)</div>
    <div class="node" id="samesite"><div class="nl">🍪 SameSite=Lax</div><div class="ns">cookie không theo POST cross-site</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="origin"><div class="nl">🧭 Kiểm tra Origin / Sec-Fetch-Site</div><div class="ns">allowlist chính xác</div></div>
      <div class="node" id="token"><div class="nl">🔑 CSRF token</div><div class="ns">so sánh constant-time</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="auth"><div class="nl">🛂 AuthN + AuthZ</div><div class="ns">luôn chạy — CORS không thay thế</div></div>
    <div class="arrow" id="a4">↓ response</div>
    <div class="node" id="cors"><div class="nl">🌐 CORS header</div><div class="ns">quyết định JS origin nào được ĐỌC response</div></div>
  `,
  steps: [
    { title: "1 · CSRF: trình duyệt tự gửi cookie", tab: "csrf", highlight: [2, 3, 4, 11, 12, 13], on: ["evil", "a1", "auth"],
      desc: "Server chỉ nhận diện người dùng qua cookie. Trang lạ khiến trình duyệt nạn nhân gửi form tới server; cookie được gửi kèm tự động nên server tưởng đó là thao tác thật." },
    { title: "2 · GET không bao giờ thay đổi dữ liệu", tab: "csrf", highlight: [7, 8, 9], on: ["evil", "a1"],
      desc: "Một link hay thẻ ảnh cũng tạo được request GET. Nếu GET xoá được dữ liệu, SameSite=Lax cũng không cứu (Lax vẫn gửi cookie với điều hướng GET cấp cao nhất)." },
    { title: "3 · SameSite + Origin + token", tab: "defense", highlight: [2, 6, 7, 8, 9, 12, 13], on: ["samesite", "a2", "origin", "token"],
      desc: "Nhiều lớp: cookie <code>SameSite=Lax</code>; từ chối request thay đổi trạng thái có <code>Origin</code> lạ hoặc <code>Sec-Fetch-Site: cross-site</code>; bắt buộc CSRF token so sánh constant-time." },
    { title: "4 · CORS sai: phản chiếu Origin", tab: "cors-bad", highlight: [2, 3, 6, 7, 8, 11], on: ["cors", "evil"],
      desc: "Trả lại nguyên Origin gửi lên kèm <code>Allow-Credentials: true</code> = cho mọi website đọc dữ liệu đã đăng nhập của nạn nhân. So khớp bằng endsWith/contains/regex lỏng cũng tương tự." },
    { title: "5 · CORS đúng: allowlist chính xác", tab: "cors-good", highlight: [1, 2, 3, 8, 9, 10, 11, 15], on: ["cors", "app"],
      desc: "Danh sách origin cụ thể, so sánh bằng nhau, thêm <code>Vary: Origin</code>. Origin không có trong danh sách: không trả header CORS nào." },
    { title: "6 · CORS không phải xác thực", tab: "cors-bad", highlight: [13, 14], on: ["auth"],
      desc: "CORS chỉ do trình duyệt thực thi và chỉ chặn việc <em>đọc</em> response. curl/script gọi thẳng API được. Endpoint vẫn phải kiểm tra đăng nhập và quyền." },
    { title: "7 · Dùng thứ framework đã có", tab: "langs", highlight: [2, 5, 8, 11, 14], on: ["cors", "token"],
      desc: "Express, Spring, Django, ASP.NET, Go đều có middleware CORS và CSRF. Cấu hình danh sách origin cụ thể theo môi trường, đừng tắt CSRF middleware." }
  ],

  quiz: [
    { q: "Điểm khác nhau cốt lõi giữa CSRF và CORS?", options: [
        "Hai tên gọi của cùng một lỗi",
        "CSRF là lỗ hổng trang lạ khiến trình duyệt gửi request có cookie; CORS là cơ chế cho phép origin khác đọc response",
        "CORS là lỗ hổng, CSRF là header",
        "CSRF chỉ xảy ra với API mobile"
      ], correct: 1,
      explanation: "CSRF là tấn công; CORS là cơ chế nới lỏng Same-Origin Policy. Cấu hình CORS sai có thể tạo lỗ hổng, nhưng bản thân CORS không chống CSRF." },
    { q: "API xác thực bằng header Authorization: Bearer do JS tự gắn (không dùng cookie). Có bị CSRF kiểu cổ điển không?", options: [
        "Có, luôn luôn",
        "Không, vì trình duyệt không tự đính kèm header Authorization vào request từ trang lạ",
        "Có, nếu dùng HTTPS",
        "Chỉ khi token dài hơn 32 ký tự"
      ], correct: 1,
      explanation: "CSRF khai thác thứ trình duyệt tự gửi (cookie, Basic auth). Token do JS gắn thì trang lạ không có." },
    { q: "Cookie SameSite=Lax có tác dụng gì?", options: [
        "Cookie không bao giờ được gửi",
        "Cookie không được gửi kèm request POST/nhúng từ site khác, nhưng vẫn gửi khi người dùng bấm link điều hướng GET",
        "Cookie chỉ gửi qua HTTP",
        "Cookie không đọc được bằng JS"
      ], correct: 1,
      explanation: "Lax chặn phần lớn CSRF qua form POST. Không đọc được bằng JS là tác dụng của HttpOnly, không phải SameSite." },
    { q: "Endpoint GET /posts/5/delete xoá bài viết. Vấn đề là gì?", options: [
        "Không vấn đề nếu có đăng nhập",
        "GET phải an toàn (không đổi trạng thái); một link hay thẻ ảnh cũng kích hoạt được và SameSite=Lax vẫn gửi cookie khi điều hướng GET",
        "Nên đổi thành GET /delete-post?id=5",
        "Chỉ sai về mặt đặt tên"
      ], correct: 1,
      explanation: "Dùng đúng ngữ nghĩa HTTP: thay đổi dữ liệu bằng POST/PUT/DELETE và bảo vệ bằng CSRF token." },
    { q: "Server so sánh CSRF token gửi lên với token trong phiên. Cách so sánh nên dùng?", options: [
        "So sánh chuỗi bằng == thông thường",
        "Hàm so sánh constant-time",
        "So sánh 4 ký tự đầu",
        "Không cần so sánh, chỉ cần có token"
      ], correct: 1,
      explanation: "So sánh constant-time tránh rò rỉ thông tin qua thời gian phản hồi. Token phải sinh bằng CSPRNG và gắn với phiên." },
    { q: "Cấu hình CORS: server lấy header Origin của request và trả lại y nguyên trong Access-Control-Allow-Origin, kèm Allow-Credentials: true. Hậu quả?", options: [
        "An toàn vì có kiểm tra Origin",
        "Mọi website đều có thể dùng JS đọc dữ liệu đã đăng nhập của người dùng",
        "Chỉ ảnh hưởng hiệu năng",
        "Trình duyệt tự chặn nên không sao"
      ], correct: 1,
      explanation: "Phản chiếu Origin = allow tất cả. Phải so khớp chính xác với allowlist cấu hình sẵn." },
    { q: "Kiểm tra origin bằng origin.endsWith('example.com'). Lỗi ở đâu?", options: [
        "Không lỗi",
        "Domain như 'notexample.com' do người khác đăng ký cũng khớp",
        "endsWith chạy chậm",
        "Phải dùng startsWith"
      ], correct: 1,
      explanation: "So khớp một phần luôn có biến thể lọt. So sánh bằng nhau toàn bộ scheme + host + port." },
    { q: "Nhóm frontend nói: 'API đã cấu hình CORS chỉ cho app.example.com, nên không cần kiểm tra quyền ở endpoint nữa'. Đúng hay sai?", options: [
        "Đúng, CORS đã chặn mọi nguồn khác",
        "Sai — CORS chỉ do trình duyệt thực thi; curl, script, server khác gọi thẳng API được, nên vẫn phải authN/authZ",
        "Đúng nếu có HTTPS",
        "Đúng nếu API chỉ trả JSON"
      ], correct: 1,
      explanation: "CORS không phải cơ chế xác thực hay phân quyền." },
    { q: "Vì sao cần thêm header Vary: Origin khi trả Access-Control-Allow-Origin động?", options: [
        "Để trình duyệt chạy nhanh hơn",
        "Để cache/CDN không trả nhầm header CORS của origin này cho origin khác",
        "Bắt buộc theo luật",
        "Để bật HTTP/2"
      ], correct: 1,
      explanation: "Khi header phụ thuộc Origin, response phải được cache riêng theo từng Origin." },
    { q: "Có nên đưa origin 'null' vào allowlist CORS không?", options: [
        "Có, để hỗ trợ file cục bộ",
        "Không — iframe sandbox và nhiều ngữ cảnh do kẻ xấu kiểm soát cũng có origin 'null'",
        "Có, 'null' nghĩa là không có ai",
        "Chỉ ở môi trường production"
      ], correct: 1,
      explanation: "'null' không đại diện cho một nguồn tin cậy cụ thể nào; cho phép nó gần như cho phép bất kỳ ai." }
  ]
});
