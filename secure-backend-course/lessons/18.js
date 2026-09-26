window.LESSONS.push({
  id: "18",
  phase: "4", phaseName: "Các lỗi phía web",
  title: "Redirect & header an toàn",
  subtitle: "Open redirect · Host header · link reset mật khẩu · CRLF/header injection",

  theory: `
    <p>Bài này gom ba lỗi có chung một gốc: <strong>server dùng dữ liệu người dùng để quyết định "đi đâu" hoặc "viết gì vào header HTTP"</strong>.</p>

    <p><strong>1. Open redirect</strong></p>
    <p>Rất nhiều ứng dụng có tham số kiểu <code>/login?next=/orders</code>: đăng nhập xong thì chuyển người dùng về trang họ định vào.
    Nếu server redirect tới <em>bất kỳ</em> giá trị nào trong <code>next</code>, kẻ xấu gửi cho nạn nhân một link bắt đầu bằng <strong>domain thật của bạn</strong>
    nhưng cuối cùng đưa họ tới trang giả mạo (<code>&lt;trang_giả_mạo&gt;</code>). Nạn nhân tin vì thấy domain quen. Nguy hiểm hơn, open redirect còn giúp vượt
    kiểm tra khác: allowlist redirect_uri của OAuth, allowlist URL trong chống SSRF (bài 17).</p>
    <p><strong>Cách phòng:</strong></p>
    <ul>
      <li><strong>Tốt nhất: không nhận URL</strong>. Nhận một khoá (<code>next=orders</code>) rồi tra bảng ánh xạ trên server sang đường dẫn thật.</li>
      <li><strong>Chỉ cho đường dẫn tương đối nội bộ</strong>: giá trị phải bắt đầu bằng đúng một dấu <code>/</code>, không bắt đầu bằng <code>//</code> hay <code>/\\</code>
        (trình duyệt coi đó là URL tới host khác), không chứa scheme, không chứa ký tự điều khiển. Tốt hơn nữa: parse bằng thư viện URL với base là domain của bạn và
        kiểm tra host kết quả vẫn đúng là domain của bạn.</li>
      <li><strong>Nếu phải redirect sang domain ngoài</strong>: allowlist host chính xác (so sánh bằng nhau, không <code>contains</code>/<code>endsWith</code>).</li>
      <li>Giá trị không hợp lệ → về trang mặc định (<code>/</code>), không báo lỗi chi tiết.</li>
      <li>Nếu cần cho đi link ngoài tuỳ ý (vd link trong bình luận): hiện trang trung gian "Bạn sắp rời khỏi trang…".</li>
    </ul>

    <p><strong>2. Host header không đáng tin</strong></p>
    <p>Header <code>Host</code> (và <code>X-Forwarded-Host</code>, <code>X-Forwarded-Proto</code>…) do <em>client</em> gửi lên — ai cũng đặt được giá trị tuỳ ý.
    Lỗi kinh điển: tính năng <strong>quên mật khẩu</strong> dựng link từ Host của request:</p>
    <ul>
      <li>Kẻ xấu gửi yêu cầu reset mật khẩu cho email nạn nhân, nhưng đặt Host thành domain của họ.</li>
      <li>Server gửi email <em>thật</em> tới nạn nhân, chứa link <code>https://&lt;domain_kẻ_xấu&gt;/reset?token=…</code>.</li>
      <li>Nạn nhân bấm link → token reset gửi thẳng tới server của kẻ xấu → chiếm tài khoản.</li>
    </ul>
    <p><strong>Cách phòng:</strong></p>
    <ul>
      <li>URL tuyệt đối trong email, link chia sẻ, OAuth callback, sitemap… luôn dựng từ <strong>cấu hình cố định</strong> (<code>PUBLIC_BASE_URL=https://app.example.com</code>), không từ request.</li>
      <li>Cấu hình danh sách host hợp lệ ở web server/framework: Django <code>ALLOWED_HOSTS</code>, ASP.NET <code>AllowedHosts</code>, Spring <code>server.forward-headers-strategy</code> kết hợp danh sách proxy tin cậy,
        Nginx <code>server_name</code> + một <code>default_server</code> trả 444/400 cho host lạ.</li>
      <li>Chỉ tin <code>X-Forwarded-*</code> khi request đến từ reverse proxy của chính bạn (cấu hình "trusted proxies"); proxy phải ghi đè, không nối thêm giá trị từ client.</li>
      <li>Cache: đừng để response phụ thuộc Host lạ được cache (web cache poisoning).</li>
    </ul>

    <p><strong>3. CRLF / header injection</strong></p>
    <p>HTTP dùng cặp ký tự xuống dòng <code>\\r\\n</code> (CR LF) để ngăn cách các header. Nếu server đưa dữ liệu người dùng vào header
    (<code>Location</code>, <code>Set-Cookie</code>, <code>Content-Disposition</code>, header tuỳ chỉnh) mà giá trị chứa CR/LF, kẻ xấu có thể
    <strong>thêm header mới</strong> (vd đặt cookie tuỳ ý) hoặc thậm chí chèn nội dung body (response splitting). Lỗi tương tự xảy ra với header email (SMTP) và dòng log (log injection).</p>
    <p><strong>Cách phòng:</strong></p>
    <ul>
      <li>Dùng API đặt header của framework/thư viện HTTP chuẩn — phần lớn đã <strong>từ chối</strong> giá trị chứa CR/LF (Node, Go net/http, Java Servlet mới, ASP.NET Core…). Đừng tự ghi byte thô ra socket.</li>
      <li>Validate theo allowlist trước khi đưa vào header: tên file chỉ gồm ký tự an toàn, URL đã parse, giá trị không có ký tự điều khiển (mã 0–31, 127).</li>
      <li>Với tên file trong <code>Content-Disposition</code>: dùng tham số <code>filename*=UTF-8''…</code> đã percent-encode (RFC 6266/5987) — thư viện thường có sẵn hàm.</li>
      <li>Email: dùng thư viện gửi mail, không nối chuỗi header; validate địa chỉ email bằng parser.</li>
      <li>Log: dùng logging có cấu trúc (JSON), để thư viện tự escape xuống dòng.</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc chung: <strong>đích redirect</strong> → allowlist hoặc đường dẫn tương đối; <strong>URL tuyệt đối</strong> → từ cấu hình, không từ Host;
    <strong>giá trị header</strong> → đi qua API chuẩn + validate, không có ký tự điều khiển.</p></div>
  `,

  codeTabs: [
    { id: "redir-bad", label: "❌ Open redirect", lines: [
      "handle POST /login (req):",
      "    user = authenticate(req.body)",
      "    startSession(user)",
      "    next = req.query.next                 // <url_bất_kỳ>",
      "    return redirect(next)                 // đi đâu cũng được!",
      "",
      "// Kiểm tra lỏng — vẫn lọt:",
      "if next.startsWith('/'): redirect(next)            // '//host-khác' cũng bắt đầu bằng '/'",
      "if next.contains('example.com'): redirect(next)    // 'example.com.<domain_lạ>' lọt"
    ]},
    { id: "redir-good", label: "✅ Redirect an toàn", lines: [
      "// Cách 1: bảng ánh xạ — client chỉ gửi khoá",
      "REDIRECTS = { 'orders': '/orders', 'cart': '/cart', 'profile': '/me' }",
      "target = REDIRECTS.get(req.query.next, '/')",
      "",
      "// Cách 2: chỉ đường dẫn tương đối nội bộ",
      "function safeLocalPath(next):",
      "    if next == null or hasControlChars(next): return '/'",
      "    if not next.startsWith('/'): return '/'",
      "    if next.startsWith('//') or next.startsWith('/\\\\'): return '/'",
      "    u = URL.parse(next, base='https://app.example.com')",
      "    if u.origin != 'https://app.example.com': return '/'",
      "    return u.pathname + u.search",
      "",
      "// Cách 3: domain ngoài -> allowlist host chính xác",
      "ALLOWED_HOSTS = {'help.example.com', 'shop.partner.com'}"
    ]},
    { id: "host", label: "🏷️ Host header", lines: [
      "// SAI: dựng link từ Host do client gửi",
      "link = 'https://' + req.headers['Host'] + '/reset?token=' + token",
      "sendEmail(user.email, link)             // link có thể trỏ tới <domain_kẻ_xấu>",
      "",
      "// ĐÚNG: base URL cố định từ cấu hình",
      "PUBLIC_BASE_URL = config('PUBLIC_BASE_URL')     // https://app.example.com",
      "link = PUBLIC_BASE_URL + '/reset?token=' + urlEncode(token)",
      "",
      "# Framework: giới hạn host hợp lệ",
      "# Django:   ALLOWED_HOSTS = ['app.example.com']",
      "# ASP.NET:  \"AllowedHosts\": \"app.example.com\"",
      "# Express:  app.set('trust proxy', '10.0.0.0/8')  // chỉ tin proxy của mình",
      "# Nginx:    server { listen 443 default_server; return 444; }  // host lạ"
    ]},
    { id: "crlf", label: "↵ CRLF injection", lines: [
      "// SAI: tự ghép header thô",
      "raw = 'Location: ' + userValue + '\\r\\n'      // userValue chứa CR LF -> thêm header mới",
      "socket.write(raw)",
      "",
      "// ĐÚNG: API chuẩn + validate",
      "function safeHeaderValue(v):",
      "    if matches(v, '[\\x00-\\x1f\\x7f]'): reject(400)   // ký tự điều khiển",
      "    return v",
      "res.setHeader('X-Request-Label', safeHeaderValue(label))",
      "",
      "// Content-Disposition cho tên file",
      "res.setHeader('Content-Disposition',",
      "    \"attachment; filename*=UTF-8''\" + percentEncode(safeName))",
      "",
      "// Log có cấu trúc: logger.info({ event: 'login', user: name })"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Python (Django): kiểm tra URL redirect an toàn",
      "from django.utils.http import url_has_allowed_host_and_scheme",
      "ok = url_has_allowed_host_and_scheme(next, allowed_hosts={'app.example.com'}, require_https=True)",
      "",
      "# Java (Spring): dùng UriComponentsBuilder từ base cố định",
      "UriComponentsBuilder.fromHttpUrl(publicBaseUrl).path(\"/reset\").queryParam(\"token\", t).build()",
      "",
      "# Go: net/http tự từ chối header chứa CR/LF; parse với url.Parse rồi kiểm tra u.Host",
      "u, err := url.Parse(next); if err != nil || u.IsAbs() || u.Host != \"\" { next = \"/\" }",
      "",
      "# Node: res.setHeader ném lỗi nếu giá trị có ký tự không hợp lệ",
      "# .NET: Url.IsLocalUrl(returnUrl) trước khi LocalRedirect(returnUrl)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request</div><div class="ns">?next=… · Host · giá trị người dùng</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="redir"><div class="nl">↪️ Đích redirect</div><div class="ns">bảng ánh xạ / đường dẫn tương đối / allowlist host</div></div>
      <div class="node" id="host"><div class="nl">🏷️ Dựng URL tuyệt đối</div><div class="ns">PUBLIC_BASE_URL từ cấu hình</div></div>
      <div class="node" id="hdr"><div class="nl">🧾 Giá trị header</div><div class="ns">API chuẩn · không ký tự điều khiển</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="resp"><div class="nl">📤 Response / Email</div><div class="ns">Location · Set-Cookie · link reset</div></div>
    <div class="arrow" id="a3">↓ nếu sai</div>
    <div class="node" id="attacker"><div class="nl">🎣 Hậu quả</div><div class="ns">phishing · lộ token reset · header giả</div></div>
  `,
  steps: [
    { title: "1 · Open redirect", tab: "redir-bad", highlight: [4, 5], on: ["req", "redir", "attacker"],
      desc: "Server redirect tới bất cứ giá trị nào trong <code>next</code>. Link bắt đầu bằng domain thật nhưng đưa nạn nhân tới trang giả mạo — và còn giúp vượt allowlist của OAuth/SSRF." },
    { title: "2 · Kiểm tra lỏng vẫn lọt", tab: "redir-bad", highlight: [8, 9], on: ["redir"],
      desc: "<code>startsWith('/')</code> không chặn được <code>//host-khác</code>; <code>contains</code> không chặn được domain có chứa tên bạn. Cần so sánh chính xác sau khi parse." },
    { title: "3 · Bảng ánh xạ hoặc đường dẫn nội bộ", tab: "redir-good", highlight: [2, 3, 7, 8, 9, 10, 11, 12], on: ["redir", "a2", "resp"],
      desc: "Tốt nhất client chỉ gửi khoá. Nếu nhận đường dẫn: chặn <code>//</code>, <code>/\\</code>, ký tự điều khiển, parse với base của bạn và kiểm tra origin không đổi. Sai → về <code>/</code>." },
    { title: "4 · Host header do client đặt", tab: "host", highlight: [2, 3], on: ["req", "host", "attacker"],
      desc: "Dựng link reset từ Host = kẻ xấu đặt Host của họ, server gửi email thật chứa link tới domain của họ, token reset bị lộ khi nạn nhân bấm." },
    { title: "5 · Base URL cố định + ALLOWED_HOSTS", tab: "host", highlight: [6, 7, 10, 11, 12, 13], on: ["host", "resp"],
      desc: "Link tuyệt đối luôn từ cấu hình. Framework/web server chỉ chấp nhận host hợp lệ; chỉ tin <code>X-Forwarded-*</code> từ proxy của mình." },
    { title: "6 · CRLF: đừng ghép header thô", tab: "crlf", highlight: [2, 3, 6, 7, 9, 12, 13], on: ["hdr", "resp"],
      desc: "CR LF trong giá trị header có thể tạo header mới. Dùng API chuẩn (phần lớn tự từ chối CR/LF), validate không có ký tự điều khiển, tên file dùng <code>filename*</code> đã percent-encode." },
    { title: "7 · Framework đã có công cụ", tab: "langs", highlight: [2, 3, 6, 9, 12], on: ["redir", "host", "hdr"],
      desc: "Django <code>url_has_allowed_host_and_scheme</code>, .NET <code>Url.IsLocalUrl</code>, Go <code>url.Parse</code> + kiểm tra Host, Spring <code>UriComponentsBuilder</code> từ base cố định." }
  ],

  quiz: [
    { q: "Open redirect nguy hiểm chủ yếu vì sao?", options: [
        "Làm server chạy chậm",
        "Link mang domain thật của bạn nhưng đưa nạn nhân tới trang giả mạo; còn giúp vượt allowlist của OAuth/SSRF",
        "Làm lộ mã nguồn",
        "Xoá dữ liệu trong DB"
      ], correct: 1,
      explanation: "Người dùng tin domain quen. Open redirect cũng là mắt xích trong các chuỗi tấn công khác." },
    { q: "Kiểm tra next.startsWith('/') để chỉ cho đường dẫn nội bộ. Thiếu gì?", options: [
        "Không thiếu",
        "Giá trị bắt đầu bằng '//' (hoặc '/\\') được trình duyệt hiểu là URL tới host khác",
        "Phải kiểm tra thêm độ dài tối thiểu",
        "Phải viết hoa"
      ], correct: 1,
      explanation: "Chặn '//' và '/\\', hoặc tốt hơn: parse với base của bạn và kiểm tra origin kết quả." },
    { q: "Cách an toàn nhất cho tham số redirect sau đăng nhập?", options: [
        "Nhận URL đầy đủ và tin tưởng",
        "Client chỉ gửi khoá (vd 'orders'); server tra bảng ánh xạ sang đường dẫn thật, khoá lạ về '/'",
        "Base64 URL trước khi gửi",
        "Chỉ cho URL https"
      ], correct: 1,
      explanation: "Không nhận URL thì không có open redirect." },
    { q: "Tính năng quên mật khẩu dựng link từ req.headers['Host']. Kẻ xấu làm được gì?", options: [
        "Không làm được gì vì email gửi tới nạn nhân",
        "Đặt Host thành domain của họ; email thật gửi nạn nhân chứa link tới domain đó, token reset lộ khi nạn nhân bấm",
        "Đọc được mật khẩu cũ",
        "Làm sập server mail"
      ], correct: 1,
      explanation: "Link tuyệt đối phải dựng từ cấu hình cố định (PUBLIC_BASE_URL)." },
    { q: "Khi nào có thể tin header X-Forwarded-Host / X-Forwarded-Proto?", options: [
        "Luôn luôn",
        "Chỉ khi request đến từ reverse proxy tin cậy của chính bạn (cấu hình trusted proxies) và proxy ghi đè giá trị từ client",
        "Khi có HTTPS",
        "Không bao giờ dùng được"
      ], correct: 1,
      explanation: "Client đặt được các header này tuỳ ý; chỉ proxy của bạn mới đáng tin." },
    { q: "Django ALLOWED_HOSTS / ASP.NET AllowedHosts dùng để làm gì?", options: [
        "Giới hạn IP được truy cập",
        "Từ chối request có Host header không thuộc danh sách hợp lệ",
        "Cấu hình CORS",
        "Chặn bot"
      ], correct: 1,
      explanation: "Chặn sớm các request với Host lạ, giảm rủi ro Host header injection và cache poisoning." },
    { q: "CRLF injection khai thác điều gì?", options: [
        "Mật khẩu yếu",
        "Ký tự CR LF trong giá trị đưa vào header HTTP, tạo ra header mới (vd Set-Cookie) hoặc chèn nội dung response",
        "Lỗi trong SQL",
        "Cookie thiếu HttpOnly"
      ], correct: 1,
      explanation: "HTTP dùng CR LF để ngăn cách header; giá trị chứa chúng phá vỡ cấu trúc response." },
    { q: "Cách phòng CRLF injection hiệu quả?", options: [
        "Tự ghi header thô ra socket cho nhanh",
        "Dùng API đặt header chuẩn (thường tự từ chối CR/LF) và validate không có ký tự điều khiển",
        "Chỉ dùng HTTP/1.0",
        "Mã hoá base64 toàn bộ response"
      ], correct: 1,
      explanation: "Thư viện HTTP hiện đại đã chặn phần lớn; validate allowlist là lớp bổ sung." },
    { q: "Đưa tên file người dùng upload vào Content-Disposition. Cách đúng?", options: [
        "Nối thẳng tên file gốc",
        "Dùng tên đã lọc/allowlist và tham số filename*=UTF-8'' đã percent-encode",
        "Bỏ header Content-Disposition",
        "Chỉ lấy phần mở rộng"
      ], correct: 1,
      explanation: "Tên file có thể chứa ký tự điều khiển hoặc dấu nháy; percent-encode theo RFC 5987/6266." },
    { q: "Ngoài HTTP header, loại 'injection xuống dòng' tương tự còn xảy ra ở đâu?", options: [
        "Chỉ ở HTTP",
        "Header email (SMTP) và dòng log — phòng bằng thư viện gửi mail và logging có cấu trúc",
        "Trong CSS",
        "Trong file ảnh"
      ], correct: 1,
      explanation: "Mọi giao thức dựa trên dòng đều có thể bị chèn dòng mới nếu nối chuỗi thô." }
  ]
});
