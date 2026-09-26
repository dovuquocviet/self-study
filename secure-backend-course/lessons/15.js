window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Các lỗi phía web",
  title: "XSS nhìn từ backend",
  subtitle: "Output encoding theo ngữ cảnh · template auto-escape · JSON đúng Content-Type · sanitize HTML · CSP · cookie HttpOnly",

  theory: `
    <p><strong>XSS (Cross-Site Scripting)</strong> xảy ra khi dữ liệu do người dùng gửi lên được trình duyệt của <em>người khác</em> hiểu là <strong>code</strong>
    (HTML/JavaScript) thay vì <strong>chữ</strong>. Script đó chạy dưới danh nghĩa trang web của bạn: đọc được dữ liệu trên trang, gửi request thay người dùng,
    đổi giao diện để lừa nhập mật khẩu… Nhiều người nghĩ XSS là "lỗi frontend", nhưng rất nhiều XSS sinh ra từ <strong>backend</strong>:
    server render HTML từ template, server trả JSON sai Content-Type, server lưu và trả lại nội dung HTML người dùng soạn.</p>

    <p><strong>1. Ba dạng XSS thường gặp</strong></p>
    <table>
      <tr><th>Dạng</th><th>Dữ liệu độc đi đường nào</th><th>Ví dụ tình huống</th></tr>
      <tr><td>Reflected</td><td>Nằm trong request (query string, form) và được server in thẳng lại vào response</td><td>Trang tìm kiếm in "Kết quả cho: <code>&lt;giá_trị_độc&gt;</code>"</td></tr>
      <tr><td>Stored</td><td>Được lưu vào DB rồi hiển thị cho mọi người xem sau này</td><td>Bình luận, tên hiển thị, mô tả sản phẩm, tên file upload</td></tr>
      <tr><td>DOM-based</td><td>JS phía client tự lấy dữ liệu (URL, API) rồi chèn vào DOM bằng <code>innerHTML</code></td><td>Backend trả JSON "sạch", nhưng frontend chèn sai cách</td></tr>
    </table>
    <p>Stored XSS là nguy hiểm nhất vì một lần gửi ảnh hưởng tới <em>mọi</em> người xem — kể cả admin mở trang quản trị.</p>

    <p><strong>2. Gốc rễ: trộn dữ liệu và code trong cùng một chuỗi</strong> — giống hệt SQL Injection (bài 04). Khi server làm
    <code>"&lt;p&gt;Xin chào " + name + "&lt;/p&gt;"</code>, trình duyệt không biết đâu là phần bạn viết, đâu là phần người dùng gửi.
    Nếu <code>name</code> chứa ký tự có ý nghĩa với HTML (<code>&lt;</code> <code>&gt;</code> <code>"</code> <code>'</code> <code>&amp;</code>),
    nó có thể mở thẻ mới hoặc thoát khỏi thuộc tính.</p>

    <p><strong>3. Phòng thủ chính: output encoding THEO NGỮ CẢNH.</strong> Không có một hàm "escape" dùng cho mọi chỗ. Cùng một giá trị, đặt ở chỗ khác nhau cần cách mã hoá khác nhau:</p>
    <table>
      <tr><th>Ngữ cảnh đầu ra</th><th>Cách mã hoá</th><th>Ghi chú</th></tr>
      <tr><td>Nội dung HTML <code>&lt;p&gt;…&lt;/p&gt;</code></td><td>HTML entity: <code>&lt;</code>→<code>&amp;lt;</code>, <code>&gt;</code>→<code>&amp;gt;</code>, <code>&amp;</code>→<code>&amp;amp;</code>, <code>"</code>→<code>&amp;quot;</code>, <code>'</code>→<code>&amp;#39;</code></td><td>Template engine hiện đại tự làm</td></tr>
      <tr><td>Thuộc tính HTML <code>title="…"</code></td><td>HTML attribute encoding + <strong>luôn bọc giá trị trong nháy kép</strong></td><td>Thuộc tính không có nháy → dấu cách cũng đủ để thoát</td></tr>
      <tr><td>Bên trong <code>&lt;script&gt;</code></td><td>Serialize bằng JSON encoder an toàn (escape <code>&lt;</code>, <code>/</code>, U+2028…), hoặc tốt hơn: <strong>đừng đặt</strong> — đưa dữ liệu vào <code>data-*</code> attribute rồi JS đọc ra</td><td>HTML-escape KHÔNG đủ trong ngữ cảnh JS</td></tr>
      <tr><td>URL trong <code>href</code>/<code>src</code></td><td>Percent-encode từng tham số; kiểm tra <strong>scheme</strong> thuộc allowlist (<code>https:</code>, <code>mailto:</code>)</td><td>Chặn scheme như <code>javascript:</code> dù đã escape</td></tr>
      <tr><td>CSS <code>style="…"</code></td><td>Tránh đưa dữ liệu người dùng vào CSS; nếu buộc phải: allowlist giá trị (vd màu <code>#RRGGBB</code>)</td><td>Ít gặp, rất khó làm đúng</td></tr>
    </table>

    <p><strong>4. Dùng template engine có auto-escape và đừng tắt nó.</strong> Jinja2, Django template, Thymeleaf, Razor, Go <code>html/template</code>,
    ERB, Blade, React JSX… đều tự escape mặc định. Lỗ hổng thường nằm ở những chỗ <em>cố tình tắt</em>:
    <code>|safe</code>, <code>{{{ }}}</code>, <code>th:utext</code>, <code>@Html.Raw</code>, <code>dangerouslySetInnerHTML</code>, <code>v-html</code>, <code>template.HTML(...)</code>.
    Khi review code, hãy grep đúng những từ khoá này — mỗi chỗ phải có lý do và dữ liệu đi qua đó phải đã được sanitize.</p>

    <p><strong>5. API trả JSON: đúng Content-Type.</strong> Nếu API trả JSON nhưng header là <code>text/html</code> (hoặc không có header và trình duyệt tự đoán),
    người dùng mở thẳng URL API trên trình duyệt thì chuỗi trong JSON có thể bị hiểu là HTML. Luôn:</p>
    <ul>
      <li><code>Content-Type: application/json; charset=utf-8</code> cho mọi response JSON — kể cả response lỗi.</li>
      <li><code>X-Content-Type-Options: nosniff</code> để trình duyệt không tự "đoán" loại nội dung.</li>
      <li>Dùng serializer của framework (<code>res.json()</code>, <code>jsonify</code>, <code>ResponseEntity</code>…) thay vì tự nối chuỗi JSON.</li>
      <li>Trang lỗi (404, 500) cũng là output: đừng in lại URL/tham số người dùng mà không encode.</li>
    </ul>

    <p><strong>6. Khi BẮT BUỘC cho phép người dùng nhập HTML</strong> (trình soạn bài viết, email template…): encoding sẽ làm hỏng định dạng,
    nên phải <strong>sanitize bằng thư viện chuyên dụng</strong> theo allowlist thẻ/thuộc tính — tuyệt đối không tự viết regex.</p>
    <ul>
      <li>Thư viện: DOMPurify (JS, chạy được cả server với jsdom), OWASP Java HTML Sanitizer, bleach/nh3 (Python), HtmlSanitizer (.NET), bluemonday (Go), ammonia (Rust), sanitize (Ruby).</li>
      <li>Cấu hình allowlist tối thiểu: vd chỉ <code>p, b, i, ul, ol, li, a[href], img[src,alt]</code>; <code>href</code>/<code>src</code> chỉ cho <code>https:</code>.</li>
      <li>Cân nhắc dùng Markdown thay HTML: người dùng viết Markdown, server render bằng thư viện có tắt raw HTML rồi sanitize kết quả.</li>
      <li>Sanitize <strong>ngay trước khi xuất ra</strong> (hoặc cả lúc lưu lẫn lúc xuất) — để khi thư viện được cập nhật, dữ liệu cũ vẫn được lọc lại.</li>
    </ul>

    <p><strong>7. Lớp phòng thủ thứ hai: Content-Security-Policy (CSP).</strong> CSP là header nói với trình duyệt "chỉ chạy script từ những nguồn này".
    Nếu encoding bị sót một chỗ, CSP chặt vẫn ngăn script lạ chạy.</p>
    <ul>
      <li>Khuyến nghị: CSP dạng <em>nonce</em> — mỗi response sinh một giá trị ngẫu nhiên, chỉ thẻ <code>&lt;script nonce="…"&gt;</code> mang đúng giá trị đó mới được chạy.</li>
      <li>Tránh <code>'unsafe-inline'</code> và <code>'unsafe-eval'</code> — chúng vô hiệu hoá phần lớn tác dụng của CSP.</li>
      <li>Thêm <code>object-src 'none'; base-uri 'none'; frame-ancestors 'self'</code>.</li>
      <li>Triển khai dần bằng <code>Content-Security-Policy-Report-Only</code> + <code>report-to</code> để xem cái gì sẽ bị chặn trước khi bật thật.</li>
    </ul>

    <p><strong>8. Giảm thiệt hại: cookie HttpOnly.</strong> Cookie phiên đăng nhập đặt <code>HttpOnly</code> thì JavaScript (kể cả script độc) không đọc được bằng
    <code>document.cookie</code>. Kèm theo <code>Secure</code> (chỉ gửi qua HTTPS) và <code>SameSite=Lax</code> hoặc <code>Strict</code> (bài 16).
    Lưu ý: HttpOnly không ngăn XSS — script độc vẫn gửi request thay người dùng được — nó chỉ ngăn <em>lấy trộm</em> cookie mang đi nơi khác.
    Vì lý do tương tự, tránh để token đăng nhập trong <code>localStorage</code>.</p>

    <div class="callout"><p>💡 Nguyên tắc vàng: <strong>validate khi vào (bài 03), encode khi ra (theo đúng ngữ cảnh), CSP + HttpOnly để giảm thiệt hại</strong>.
    Đừng "escape khi lưu vào DB" — dữ liệu trong DB nên là dạng gốc, vì cùng dữ liệu đó còn được xuất ra JSON, CSV, email, PDF… mỗi nơi cần cách mã hoá riêng.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Nối chuỗi HTML", lines: [
      "// Pseudo-code: server tự ghép HTML từ dữ liệu người dùng",
      "handle GET /search (req):",
      "    q = req.query.q                       // '<giá_trị_độc>' do người dùng gửi",
      "    html = '<h1>Kết quả cho: ' + q + '</h1>'",
      "    return response(html, type='text/html')",
      "",
      "handle GET /profile/:id (req):",
      "    user = db.findUser(req.params.id)",
      "    // displayName lưu từ lúc đăng ký -> Stored XSS",
      "    html = '<div title=' + user.bio + '>' + user.displayName + '</div>'",
      "    return response(html, type='text/html')",
      "",
      "// Vấn đề: dữ liệu và code HTML nằm chung một chuỗi,",
      "// trình duyệt không phân biệt được đâu là 'chữ', đâu là 'thẻ'"
    ]},
    { id: "ctx", label: "✅ Encode theo ngữ cảnh", lines: [
      "// Mỗi ngữ cảnh một hàm mã hoá riêng",
      "htmlText  = encodeForHTML(name)          // < > & \" ' -> entity",
      "htmlAttr  = encodeForHTMLAttr(bio)       // + luôn bọc trong \"...\"",
      "urlParam  = percentEncode(keyword)       // cho ?q=...",
      "jsData    = safeJsonForScript(obj)       // escape < / U+2028",
      "",
      "// URL do người dùng cung cấp: kiểm tra scheme trước",
      "function safeLink(url):",
      "    u = parseURL(url)                     // parse thật, không regex",
      "    if u.scheme not in ['https', 'mailto']: return '#'",
      "    return encodeForHTMLAttr(u.toString())",
      "",
      "// Tốt nhất: đừng nhét dữ liệu vào <script>, dùng data-*",
      "// <div id='app' data-user=\"{{ user_json }}\"></div>",
      "// JS: JSON.parse(el.dataset.user)"
    ]},
    { id: "tpl", label: "🌐 Template đa ngôn ngữ", lines: [
      "# Auto-escape mặc định (AN TOÀN)          | Chỗ TẮT escape (cần review)",
      "# Jinja2 / Django:  {{ name }}            | {{ name|safe }}  {% autoescape off %}",
      "# Thymeleaf (Java): th:text=\"...\"        | th:utext=\"...\"",
      "# Razor (.NET):     @Model.Name            | @Html.Raw(Model.Name)",
      "# Go html/template: {{ .Name }}           | template.HTML(s)",
      "# Handlebars:       {{ name }}            | {{{ name }}}",
      "# ERB (Rails):      <%= name %>           | raw(name)  name.html_safe",
      "# Blade (Laravel):  {{ $name }}           | {!! $name !!}",
      "# React JSX:        {name}                | dangerouslySetInnerHTML",
      "# Vue:              {{ name }}            | v-html",
      "",
      "# Lưu ý Go: dùng html/template, KHÔNG dùng text/template cho HTML",
      "# Checklist review: grep các từ khoá cột phải, mỗi chỗ phải có lý do"
    ]},
    { id: "sanitize", label: "🧼 Sanitize HTML", lines: [
      "// Chỉ dùng khi người dùng BUỘC phải soạn HTML (bài viết, mô tả)",
      "policy = HtmlSanitizer.allowlist(",
      "    tags       = ['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'img'],",
      "    attributes = { 'a': ['href'], 'img': ['src', 'alt'] },",
      "    urlSchemes = ['https'],               // chặn mọi scheme khác",
      "    addRelNoopener = true",
      ")",
      "",
      "handle POST /articles (req):",
      "    body = validateLength(req.body.html, max=100_000)",
      "    db.save(article, rawHtml=body)        // lưu bản gốc",
      "",
      "handle GET /articles/:id (req):",
      "    clean = policy.sanitize(article.rawHtml)   // lọc lúc xuất ra",
      "    render('article.html', content=clean)",
      "",
      "// Thư viện: DOMPurify, OWASP Java HTML Sanitizer, nh3/bleach, bluemonday, ammonia",
      "// KHÔNG tự viết regex xoá thẻ <script> — luôn có cách vượt"
    ]},
    { id: "headers", label: "🛡️ Header phòng thủ", lines: [
      "// Response JSON",
      "Content-Type: application/json; charset=utf-8",
      "X-Content-Type-Options: nosniff",
      "",
      "// Response HTML: CSP dạng nonce (sinh mới mỗi request)",
      "Content-Security-Policy: default-src 'self'; script-src 'nonce-R4nd0m' 'strict-dynamic';",
      "    object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
      "// thử trước bằng: Content-Security-Policy-Report-Only",
      "",
      "// Cookie phiên đăng nhập",
      "Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Lax; Path=/",
      "",
      "// TRÁNH: script-src 'unsafe-inline' 'unsafe-eval'",
      "// TRÁNH: lưu access token trong localStorage (script nào cũng đọc được)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="input"><div class="nl">📨 Dữ liệu người dùng</div><div class="ns">query, form, JSON, DB (dữ liệu cũ)</div></div>
    <div class="arrow" id="a1">↓ validate khi vào (bài 03)</div>
    <div class="node" id="store"><div class="nl">🗄️ Lưu dạng gốc</div><div class="ns">không escape khi lưu</div></div>
    <div class="arrow" id="a2">↓ xuất ra</div>
    <div class="row">
      <div class="node" id="enc"><div class="nl">🔤 Encode theo ngữ cảnh</div><div class="ns">HTML · attribute · JS · URL</div></div>
      <div class="node" id="san"><div class="nl">🧼 Sanitize (thư viện)</div><div class="ns">chỉ khi buộc cho HTML</div></div>
      <div class="node" id="json"><div class="nl">📦 JSON API</div><div class="ns">application/json + nosniff</div></div>
    </div>
    <div class="arrow" id="a3">↓ response</div>
    <div class="node" id="browser"><div class="nl">🌐 Trình duyệt</div><div class="ns">CSP chặn script lạ · cookie HttpOnly</div></div>
  `,
  steps: [
    { title: "1 · Nối chuỗi HTML = trộn dữ liệu với code", tab: "bad", highlight: [3, 4, 9, 10], on: ["input", "a2", "browser"],
      desc: "Server ghép <code>q</code> và <code>displayName</code> thẳng vào HTML. Nếu chúng chứa <code>&lt;</code> hay <code>\"</code>, trình duyệt sẽ hiểu là thẻ/thuộc tính mới. Bản ở <code>/profile</code> còn là <strong>Stored XSS</strong>: ai xem trang đều bị ảnh hưởng." },
    { title: "2 · Lưu dạng gốc, encode khi ra", tab: "ctx", highlight: [2, 3, 4, 5], on: ["store", "a2", "enc"],
      desc: "Không escape khi lưu DB. Tới lúc xuất ra mới chọn hàm mã hoá phù hợp với <strong>vị trí</strong> đặt dữ liệu: nội dung HTML, thuộc tính, tham số URL hay dữ liệu cho JS." },
    { title: "3 · URL cần thêm kiểm tra scheme", tab: "ctx", highlight: [8, 9, 10, 11], on: ["enc"],
      desc: "Escape không đủ cho <code>href</code>: một URL với scheme lạ vẫn chạy được code khi bấm. Parse URL và chỉ cho <code>https</code>/<code>mailto</code>. Dữ liệu cho JS thì đặt vào <code>data-*</code> thay vì nhét vào thẻ <code>&lt;script&gt;</code>." },
    { title: "4 · Template auto-escape — đừng tắt", tab: "tpl", highlight: [2, 3, 4, 5, 9, 13], on: ["enc"],
      desc: "Mọi template engine hiện đại tự escape. Lỗ hổng nằm ở cột phải: <code>|safe</code>, <code>th:utext</code>, <code>@Html.Raw</code>, <code>v-html</code>… Khi review, grep các từ khoá này." },
    { title: "5 · Buộc cho HTML? Sanitize bằng thư viện", tab: "sanitize", highlight: [2, 3, 4, 5, 14], on: ["san"],
      desc: "Allowlist thẻ và thuộc tính tối thiểu, URL chỉ <code>https</code>. Lưu bản gốc, sanitize lúc xuất để thư viện mới cập nhật cũng áp dụng cho dữ liệu cũ." },
    { title: "6 · JSON đúng Content-Type", tab: "headers", highlight: [2, 3], on: ["json", "a3"],
      desc: "<code>application/json</code> + <code>nosniff</code>: trình duyệt không bao giờ render response API như một trang HTML, kể cả khi người dùng mở thẳng URL." },
    { title: "7 · CSP + HttpOnly: lớp dự phòng", tab: "headers", highlight: [6, 7, 11, 13, 14], on: ["browser"],
      desc: "Nếu có chỗ sót encoding, CSP nonce chặn script không có nonce hợp lệ; cookie HttpOnly không bị script đọc trộm. Đây là giảm thiệt hại, <em>không</em> thay thế encoding." }
  ],

  quiz: [
    { q: "Vì sao nói XSS thường có gốc rễ ở backend?", options: [
        "Vì JavaScript chạy trên server",
        "Vì server render HTML/trả response chứa dữ liệu người dùng mà không mã hoá đúng, hoặc trả sai Content-Type",
        "Vì database không hỗ trợ Unicode",
        "Vì trình duyệt không kiểm tra chữ ký số"
      ], correct: 1,
      explanation: "Server là nơi ghép dữ liệu vào template, đặt header Content-Type, lưu và trả lại nội dung người dùng soạn — mỗi chỗ đều có thể sinh XSS." },
    { q: "Dạng XSS nào ảnh hưởng tới mọi người xem trang, kể cả admin?", options: [
        "Reflected XSS",
        "Stored XSS",
        "CSRF",
        "SQL Injection"
      ], correct: 1,
      explanation: "Stored XSS được lưu vào DB (bình luận, tên hiển thị…) và hiển thị cho mọi người xem sau đó." },
    { q: "Một giá trị được đặt bên trong thẻ <script> của trang. Dùng hàm HTML-escape thông thường có đủ không?", options: [
        "Đủ, HTML-escape dùng được mọi nơi",
        "Không đủ — ngữ cảnh JS cần encoder khác (JSON an toàn), tốt nhất là đưa dữ liệu vào data-* attribute rồi JS đọc ra",
        "Đủ nếu giá trị viết hoa",
        "Không cần làm gì vì CSP đã chặn"
      ], correct: 1,
      explanation: "Encoding phải theo ngữ cảnh. Ký tự nguy hiểm trong JS khác với trong HTML; tránh hẳn việc chèn dữ liệu vào script là cách an toàn nhất." },
    { q: "Người dùng nhập URL website cá nhân, server in vào href sau khi HTML-attribute-encode. Còn thiếu gì?", options: [
        "Không thiếu gì",
        "Kiểm tra scheme thuộc allowlist (vd chỉ https/mailto) vì scheme lạ vẫn chạy code khi bấm",
        "Chuyển URL thành chữ hoa",
        "Nén URL bằng gzip"
      ], correct: 1,
      explanation: "Encoding giữ URL nằm trong thuộc tính, nhưng không ngăn được một scheme nguy hiểm. Parse URL và kiểm tra scheme." },
    { q: "Khi review code template, dấu hiệu nào cần xem kỹ nhất?", options: [
        "Các biến được in bằng {{ name }}",
        "Các chỗ tắt auto-escape: |safe, th:utext, @Html.Raw, v-html, dangerouslySetInnerHTML, {{{ }}}",
        "Các comment trong template",
        "Tên file template"
      ], correct: 1,
      explanation: "Auto-escape là mặc định an toàn; lỗ hổng xuất hiện ở chỗ cố ý tắt nó." },
    { q: "API trả JSON với header Content-Type: text/html. Rủi ro là gì?", options: [
        "Không rủi ro, JSON vẫn là JSON",
        "Mở thẳng URL trên trình duyệt, chuỗi trong JSON có thể bị render như HTML và chạy script",
        "API chạy chậm hơn",
        "Client mobile không đọc được"
      ], correct: 1,
      explanation: "Luôn trả application/json kèm X-Content-Type-Options: nosniff, kể cả với response lỗi." },
    { q: "Ứng dụng blog cho phép người dùng soạn bài có định dạng (HTML). Cách xử lý đúng?", options: [
        "Tự viết regex xoá thẻ <script>",
        "HTML-escape toàn bộ nội dung",
        "Sanitize bằng thư viện chuyên dụng theo allowlist thẻ/thuộc tính/scheme URL",
        "Tin tưởng vì người dùng đã đăng nhập"
      ], correct: 2,
      explanation: "Escape toàn bộ sẽ phá định dạng; regex tự viết luôn có cách vượt. Dùng DOMPurify, OWASP Java HTML Sanitizer, nh3, bluemonday… với allowlist tối thiểu." },
    { q: "Có nên HTML-escape dữ liệu ngay khi lưu vào DB không?", options: [
        "Có, để khỏi phải nhớ escape lúc hiển thị",
        "Không — lưu dạng gốc, encode khi xuất ra vì mỗi đầu ra (HTML, JSON, CSV, email) cần cách mã hoá khác",
        "Có, và escape hai lần cho chắc",
        "Chỉ escape khi DB là MySQL"
      ], correct: 1,
      explanation: "Escape khi lưu làm hỏng dữ liệu cho các đầu ra khác và dễ dẫn tới escape hai lần hoặc quên ở chỗ khác. Encode theo ngữ cảnh tại điểm xuất." },
    { q: "CSP dạng nonce hoạt động thế nào?", options: [
        "Mã hoá toàn bộ HTML",
        "Mỗi response sinh giá trị ngẫu nhiên; trình duyệt chỉ chạy thẻ script mang đúng nonce đó",
        "Chặn mọi request tới server",
        "Thay thế cho HTTPS"
      ], correct: 1,
      explanation: "Script chèn vào qua XSS không biết nonce (nó đổi mỗi request) nên bị chặn. Tránh 'unsafe-inline' vì nó vô hiệu hoá cơ chế này." },
    { q: "Cookie phiên đặt HttpOnly có tác dụng gì?", options: [
        "Ngăn hoàn toàn XSS",
        "JavaScript không đọc được cookie, nên script độc không lấy trộm được session mang đi nơi khác",
        "Cookie chỉ gửi qua HTTP không mã hoá",
        "Cookie hết hạn sau 1 giờ"
      ], correct: 1,
      explanation: "HttpOnly giảm thiệt hại chứ không ngăn XSS: script độc vẫn có thể gửi request thay người dùng. Kết hợp Secure và SameSite." }
  ]
});
