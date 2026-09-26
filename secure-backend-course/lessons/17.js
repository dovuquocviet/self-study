window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Các lỗi phía web",
  title: "Gọi URL ra ngoài an toàn (chống SSRF)",
  subtitle: "Allowlist host/scheme · chặn IP nội bộ sau khi resolve DNS · không tự theo redirect · timeout & giới hạn · egress proxy · IMDSv2 · tách mạng",

  theory: `
    <p>Rất nhiều tính năng khiến <strong>server</strong> phải gọi tới một URL do người dùng cung cấp: xem trước link (link preview), tải ảnh đại diện từ URL,
    webhook ("khi có đơn hàng, gọi URL này của tôi"), import dữ liệu từ link, chuyển HTML sang PDF, kiểm tra RSS…</p>
    <p><strong>SSRF (Server-Side Request Forgery)</strong> xảy ra khi kẻ tấn công điều khiển được URL đó để server gọi tới nơi <em>chính kẻ tấn công không tới được</em>:
    dịch vụ nội bộ (admin panel, DB, cache, API nội bộ không cần đăng nhập), hoặc <strong>dịch vụ metadata của cloud</strong> — nơi cấp thông tin và
    credential tạm thời của máy chủ. Server của bạn nằm <em>bên trong</em> mạng, nên nó trở thành "người trong nhà" mở cửa hộ.</p>

    <p><strong>1. Vì sao khó chặn bằng cách kiểm tra chuỗi URL?</strong></p>
    <ul>
      <li>Một địa chỉ nội bộ có thể viết nhiều cách (dạng thập phân, bát phân, IPv6, IPv4-mapped IPv6…) — so chuỗi <code>"127.0.0.1"</code> không bao giờ đủ.</li>
      <li>Một tên miền công khai hoàn toàn có thể <strong>resolve</strong> ra IP nội bộ — vì chủ domain tự đặt bản ghi DNS.</li>
      <li><strong>DNS rebinding</strong>: lần kiểm tra resolve ra IP công khai, lần kết nối thật resolve ra IP nội bộ (TTL rất ngắn).</li>
      <li><strong>Redirect</strong>: URL công khai hợp lệ trả về 302 trỏ sang địa chỉ nội bộ; nếu HTTP client tự theo redirect thì mọi kiểm tra ban đầu vô nghĩa.</li>
      <li>Scheme lạ: <code>file://</code>, <code>gopher://</code>, <code>ftp://</code>… một số thư viện hỗ trợ và có thể bị lợi dụng.</li>
      <li>Parser khác nhau hiểu cùng một URL khác nhau (chỗ kiểm tra dùng parser A, chỗ gọi dùng thư viện B).</li>
    </ul>

    <p><strong>2. Lớp 1 — Tốt nhất: đừng nhận URL tuỳ ý.</strong></p>
    <ul>
      <li>Nếu chỉ cần gọi vài đối tác cố định: <strong>allowlist host</strong> chính xác (<code>api.partner.com</code>), người dùng chỉ chọn "đối tác nào", không gửi URL.</li>
      <li>Nếu chỉ cần ảnh: cho người dùng <em>upload</em> file (bài 19) thay vì nhập URL.</li>
      <li>Chỉ cho scheme <code>https</code> (có thể thêm <code>http</code> nếu buộc phải), cổng 443/80.</li>
    </ul>

    <p><strong>3. Lớp 2 — Buộc phải nhận URL bất kỳ (webhook, link preview): kiểm tra IP SAU khi resolve DNS.</strong></p>
    <ol>
      <li>Parse URL bằng thư viện chuẩn; từ chối nếu có user:password, scheme ngoài allowlist, cổng lạ.</li>
      <li>Tự resolve hostname ra <strong>tất cả</strong> IP (A và AAAA).</li>
      <li>Từ chối nếu <strong>bất kỳ</strong> IP nào thuộc dải cấm: loopback (<code>127.0.0.0/8</code>, <code>::1</code>), private (<code>10/8</code>, <code>172.16/12</code>, <code>192.168/16</code>, <code>fc00::/7</code>),
        link-local (<code>169.254.0.0/16</code> — nơi chứa metadata cloud, <code>fe80::/10</code>), <code>0.0.0.0/8</code>, CGNAT <code>100.64/10</code>, multicast, dải dự trữ, IPv4-mapped IPv6.
        Dùng thư viện IP có sẵn (vd <code>ipaddress</code> Python, <code>net/netip</code> Go, <code>InetAddress</code> Java, <code>ipaddr.js</code>) với hàm như <code>is_private</code>/<code>is_global</code>.</li>
      <li><strong>Kết nối tới chính IP đã kiểm tra</strong> (pin IP), gửi Host header / SNI theo hostname — để tránh DNS rebinding. Nhiều thư viện hỗ trợ hook "kiểm tra IP khi kết nối socket"
        (vd custom resolver / dialer control) — đó là chỗ kiểm tra đáng tin nhất.</li>
      <li><strong>Tắt tự theo redirect</strong>. Nếu cần theo, tự xử lý từng bước: lấy Location, chạy lại <em>toàn bộ</em> kiểm tra, giới hạn tối đa 3 lần.</li>
    </ol>

    <p><strong>4. Lớp 3 — Giới hạn tài nguyên và đầu ra.</strong></p>
    <ul>
      <li>Timeout kết nối (vd 3s) và timeout tổng (vd 10s); giới hạn kích thước response (đọc dạng stream, dừng khi vượt 5MB).</li>
      <li>Kiểm tra Content-Type mong đợi (ảnh? JSON?).</li>
      <li><strong>Không trả nguyên response</strong> (hay thông báo lỗi chi tiết) về cho người dùng — nếu không kẻ tấn công dùng tính năng này để "đọc" dịch vụ nội bộ.
        Link preview chỉ trả title/mô tả đã trích; webhook chỉ báo "thành công/thất bại".</li>
      <li>Rate limit theo người dùng; ghi log URL + IP đích để điều tra.</li>
    </ul>

    <p><strong>5. Lớp 4 — Hạ tầng (defense in depth), vì code kiểm tra có thể có lỗi:</strong></p>
    <table>
      <tr><th>Biện pháp</th><th>Ý nghĩa</th></tr>
      <tr><td><strong>Egress proxy</strong></td><td>Mọi request ra Internet của tính năng này đi qua một proxy riêng (vd Smokescreen) có chính sách chặn dải nội bộ. Code ứng dụng không cần tự làm đúng 100%.</td></tr>
      <tr><td><strong>Tách mạng</strong></td><td>Chạy worker gọi URL ngoài trong subnet/container riêng, firewall/security group chỉ cho đi Internet, không cho tới DB, cache, admin.</td></tr>
      <tr><td><strong>Bảo vệ metadata cloud</strong></td><td>AWS: bắt buộc <strong>IMDSv2</strong> (cần token lấy bằng PUT, hop limit = 1) hoặc tắt IMDS nếu không dùng. GCP/Azure: metadata yêu cầu header đặc biệt — không cho người dùng tuỳ biến header. Chặn <code>169.254.169.254</code> ở tầng mạng cho container không cần.</td></tr>
      <tr><td><strong>Least privilege</strong></td><td>IAM role của máy chủ chỉ có đúng quyền cần thiết — nếu credential có lộ, thiệt hại nhỏ.</td></tr>
      <tr><td><strong>Dịch vụ nội bộ vẫn xác thực</strong></td><td>Đừng tin "đến từ mạng nội bộ = an toàn" (zero trust). Admin panel, Redis, Elasticsearch… đều nên yêu cầu xác thực.</td></tr>
    </table>

    <div class="callout"><p>💡 Checklist khi review một tính năng "server gọi URL": URL có thật sự cần do người dùng nhập không? Có allowlist scheme/host không?
    Kiểm tra IP <strong>sau</strong> resolve và kết nối tới đúng IP đó? Redirect có bị tắt/kiểm tra lại? Có timeout + giới hạn kích thước? Có trả response thô về không?
    Có egress proxy / tách mạng / IMDSv2 làm lưới an toàn không?</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Gọi thẳng URL", lines: [
      "// Tính năng link preview",
      "handle POST /preview (req):",
      "    url = req.body.url                    // <url_do_người_dùng_gửi>",
      "    resp = http.get(url)                  // mặc định: theo redirect, không timeout",
      "    return resp.body                      // trả nguyên nội dung về client",
      "",
      "// Kiểm tra kiểu chuỗi — KHÔNG đủ",
      "if url.contains('localhost') or url.contains('127.0.0.1'): reject",
      "// Vượt qua bằng: cách viết IP khác, tên miền resolve ra IP nội bộ,",
      "// redirect sang địa chỉ nội bộ, DNS rebinding, scheme lạ..."
    ]},
    { id: "good", label: "✅ Kiểm tra sau resolve", lines: [
      "ALLOWED_SCHEMES = ['https']",
      "ALLOWED_PORTS   = [443]",
      "",
      "function safeFetch(rawUrl):",
      "    u = URL.parse(rawUrl)                          // thư viện chuẩn",
      "    if u.scheme not in ALLOWED_SCHEMES: reject('scheme')",
      "    if u.userinfo != null: reject('userinfo')",
      "    if u.port not in ALLOWED_PORTS: reject('port')",
      "",
      "    ips = dns.resolveAll(u.host)                   // A + AAAA",
      "    for ip in ips:",
      "        if not ip.isGlobalUnicast() or ip in BLOCKED_RANGES: reject('ip')",
      "",
      "    resp = http.request(u, connectTo=ips[0],       // pin IP đã kiểm tra",
      "                        followRedirects=false,",
      "                        connectTimeout=3s, totalTimeout=10s)",
      "    body = resp.readAtMost(5 * MB)                 // vượt -> huỷ",
      "    return extractTitleOnly(body)                   // không trả body thô"
    ]},
    { id: "ranges", label: "🚫 Dải IP cấm", lines: [
      "BLOCKED_RANGES = [",
      "    '0.0.0.0/8',        // 'this network'",
      "    '10.0.0.0/8',       // private",
      "    '100.64.0.0/10',    // CGNAT",
      "    '127.0.0.0/8',      // loopback",
      "    '169.254.0.0/16',   // link-local — metadata cloud nằm ở đây",
      "    '172.16.0.0/12',    // private",
      "    '192.168.0.0/16',   // private",
      "    '224.0.0.0/4',      // multicast",
      "    '::1/128',          // loopback IPv6",
      "    'fc00::/7',         // unique local IPv6",
      "    'fe80::/10',        // link-local IPv6",
      "    '::ffff:0:0/96'     // IPv4-mapped: kiểm tra lại phần IPv4 bên trong",
      "]",
      "// Dùng thư viện IP có sẵn thay vì tự so chuỗi:",
      "// Python ipaddress.is_global · Go netip.Addr.IsPrivate/IsLoopback · Java InetAddress.isSiteLocalAddress"
    ]},
    { id: "redirect", label: "↪️ Redirect & DNS", lines: [
      "// Theo redirect có kiểm soát: mỗi bước kiểm tra lại từ đầu",
      "function fetchWithRedirects(url, maxHops=3):",
      "    for hop in 0..maxHops:",
      "        resp = safeFetchNoRedirect(url)           // đủ các bước ở tab trước",
      "        if resp.status not in [301, 302, 303, 307, 308]: return resp",
      "        url = resolveRelative(url, resp.headers['Location'])",
      "    reject('too many redirects')",
      "",
      "// Chống DNS rebinding: kiểm tra IP ngay tại lúc mở socket",
      "dialer.control = function(network, address):",
      "    ip = parseIP(address)                         // IP thật sắp kết nối",
      "    if isBlocked(ip): return error('blocked')",
      "// Go: net.Dialer.Control · Python: custom resolver/adapter · Java: custom DnsResolver"
    ]},
    { id: "infra", label: "🏗️ Hạ tầng", lines: [
      "# 1. Egress proxy: worker chỉ ra Internet qua proxy có chính sách",
      "HTTPS_PROXY=http://egress-proxy.internal:4750   # proxy chặn dải nội bộ",
      "",
      "# 2. AWS: bắt buộc IMDSv2, hop limit 1",
      "aws ec2 modify-instance-metadata-options --instance-id <id> \\",
      "    --http-tokens required --http-put-response-hop-limit 1",
      "",
      "# 3. Tách mạng: security group của worker 'fetcher'",
      "egress:  allow tcp 443 -> 0.0.0.0/0 (qua proxy)",
      "egress:  deny  -> 10.0.0.0/8, 169.254.169.254/32",
      "",
      "# 4. Least privilege: IAM role của worker không có quyền S3/DB",
      "# 5. Dịch vụ nội bộ (Redis, admin, Elasticsearch) vẫn bắt xác thực"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">👤 Người dùng</div><div class="ns">gửi URL (webhook, preview, avatar)</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="parse"><div class="nl">📐 Parse + allowlist</div><div class="ns">scheme · port · host · không userinfo</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="dns"><div class="nl">🔎 Resolve DNS → kiểm tra mọi IP</div><div class="ns">chặn loopback, private, link-local…</div></div>
    <div class="arrow" id="a3">↓ kết nối tới đúng IP đã kiểm tra</div>
    <div class="node" id="fetch"><div class="nl">📡 HTTP client an toàn</div><div class="ns">không tự redirect · timeout · giới hạn size</div></div>
    <div class="arrow" id="a4">↓ qua</div>
    <div class="node" id="proxy"><div class="nl">🧱 Egress proxy + tách mạng</div><div class="ns">lưới an toàn ở tầng hạ tầng</div></div>
    <div class="row">
      <div class="node" id="internet"><div class="nl">🌍 Internet</div><div class="ns">đích hợp lệ</div></div>
      <div class="node" id="internal"><div class="nl">🏢 Dịch vụ nội bộ</div><div class="ns">bị chặn</div></div>
      <div class="node" id="imds"><div class="nl">☁️ Metadata cloud</div><div class="ns">IMDSv2 · bị chặn</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Server trở thành 'người trong nhà'", tab: "bad", highlight: [3, 4, 5], on: ["user", "fetch", "internal", "imds"],
      desc: "Server gọi thẳng URL người dùng gửi, theo redirect, không timeout, trả nguyên body. Kẻ tấn công dùng server để chạm tới dịch vụ nội bộ và metadata cloud mà từ ngoài không tới được." },
    { title: "2 · Kiểm tra chuỗi không đủ", tab: "bad", highlight: [8, 9, 10], on: ["parse"],
      desc: "Địa chỉ nội bộ có nhiều cách viết, tên miền bất kỳ có thể resolve ra IP nội bộ, redirect và DNS rebinding đổi đích sau khi kiểm tra. Phải kiểm tra trên <strong>IP thật</strong>." },
    { title: "3 · Parse + allowlist scheme/port", tab: "good", highlight: [1, 2, 5, 6, 7, 8], on: ["user", "a1", "parse"],
      desc: "Parse bằng thư viện chuẩn, chỉ cho <code>https</code> cổng 443, từ chối userinfo. Nếu có thể, allowlist luôn cả host." },
    { title: "4 · Resolve rồi kiểm tra mọi IP", tab: "ranges", highlight: [5, 6, 3, 7, 8, 13, 16], on: ["a2", "dns"],
      desc: "Chặn loopback, private, link-local (<code>169.254.0.0/16</code> — metadata cloud), CGNAT, IPv6 tương ứng, IPv4-mapped. Dùng hàm của thư viện IP thay vì tự so chuỗi." },
    { title: "5 · Pin IP, tắt redirect, chống rebinding", tab: "redirect", highlight: [2, 4, 6, 10, 11, 12], on: ["a3", "fetch"],
      desc: "Kết nối tới đúng IP đã kiểm tra hoặc kiểm tra IP ngay lúc mở socket. Redirect tự xử lý, mỗi bước chạy lại toàn bộ kiểm tra, tối đa vài lần." },
    { title: "6 · Timeout, giới hạn size, không trả body thô", tab: "good", highlight: [14, 15, 16, 17, 18], on: ["fetch", "internet"],
      desc: "Timeout ngắn, đọc tối đa 5MB, chỉ trả thông tin đã trích (title) — kẻ tấn công không dùng tính năng này để đọc nội dung dịch vụ nội bộ." },
    { title: "7 · Lưới an toàn hạ tầng", tab: "infra", highlight: [2, 5, 6, 9, 10, 12], on: ["a4", "proxy", "imds", "internal"],
      desc: "Egress proxy, security group tách mạng, IMDSv2 bắt buộc token với hop limit 1, IAM role tối thiểu. Nếu code kiểm tra có lỗi, hạ tầng vẫn chặn." }
  ],

  quiz: [
    { q: "SSRF là gì?", options: [
        "Kẻ tấn công chạy script trên trình duyệt nạn nhân",
        "Kẻ tấn công khiến server gọi tới đích do họ chọn, thường là dịch vụ nội bộ hoặc metadata cloud",
        "Tấn công làm sập server bằng nhiều request",
        "Lỗi SQL trong câu truy vấn"
      ], correct: 1,
      explanation: "Server nằm trong mạng nội bộ nên nó tới được những nơi kẻ tấn công từ ngoài không tới được." },
    { q: "Kiểm tra url.contains('127.0.0.1') để chặn SSRF có đủ không?", options: [
        "Đủ",
        "Không — địa chỉ nội bộ có nhiều cách viết, tên miền có thể resolve ra IP nội bộ, redirect và DNS rebinding đổi đích sau kiểm tra",
        "Đủ nếu thêm 'localhost'",
        "Đủ nếu dùng HTTPS"
      ], correct: 1,
      explanation: "Phải kiểm tra IP thật sau khi resolve, và kết nối đúng IP đó." },
    { q: "Vì sao phải kiểm tra IP SAU khi resolve DNS?", options: [
        "Để tăng tốc",
        "Vì một tên miền công khai có thể trỏ bản ghi DNS về IP nội bộ",
        "Vì DNS luôn trả IP công khai",
        "Không cần, kiểm tra hostname là đủ"
      ], correct: 1,
      explanation: "Chủ tên miền tự đặt bản ghi A/AAAA tuỳ ý, kể cả địa chỉ private hay link-local." },
    { q: "DNS rebinding khai thác điều gì?", options: [
        "Mật khẩu DNS yếu",
        "Khoảng cách giữa lúc kiểm tra (resolve ra IP công khai) và lúc kết nối (resolve lại ra IP nội bộ)",
        "Lỗi trong HTTPS",
        "Cookie không có SameSite"
      ], correct: 1,
      explanation: "Chống bằng cách kết nối tới đúng IP đã kiểm tra hoặc kiểm tra IP ngay lúc mở socket." },
    { q: "HTTP client mặc định tự theo redirect. Với tính năng gọi URL người dùng, nên làm gì?", options: [
        "Giữ mặc định",
        "Tắt tự theo redirect; nếu cần, tự xử lý từng bước và chạy lại toàn bộ kiểm tra cho URL mới, giới hạn số lần",
        "Chỉ theo redirect 301",
        "Theo tối đa 100 lần"
      ], correct: 1,
      explanation: "URL công khai hợp lệ có thể redirect sang địa chỉ nội bộ, vượt qua kiểm tra ban đầu." },
    { q: "Dải 169.254.0.0/16 đặc biệt quan trọng với SSRF trên cloud vì sao?", options: [
        "Đó là dải của Google",
        "Dịch vụ metadata cloud (chứa thông tin và credential tạm của máy chủ) nằm trong dải link-local này",
        "Đó là dải IP công khai",
        "Dải này không định tuyến được nên vô hại"
      ], correct: 1,
      explanation: "Chặn dải link-local và bật IMDSv2 để bảo vệ credential của máy chủ." },
    { q: "IMDSv2 của AWS giúp giảm rủi ro SSRF như thế nào?", options: [
        "Mã hoá toàn bộ ổ đĩa",
        "Bắt buộc lấy token bằng request PUT có header riêng (và hop limit), điều mà một SSRF dạng GET đơn giản khó làm được",
        "Tắt Internet của máy chủ",
        "Đổi địa chỉ metadata ngẫu nhiên"
      ], correct: 1,
      explanation: "Kết hợp --http-tokens required và hop limit 1; tắt IMDS nếu không dùng." },
    { q: "Tính năng link preview trả nguyên nội dung trang đã tải về cho người dùng. Rủi ro thêm là gì?", options: [
        "Không rủi ro",
        "Nếu có SSRF, kẻ tấn công đọc được nội dung dịch vụ nội bộ qua response; nên chỉ trả thông tin đã trích",
        "Tốn băng thông nên chậm",
        "Trình duyệt chặn nên không sao"
      ], correct: 1,
      explanation: "Giảm đầu ra: chỉ trả title/mô tả, hoặc chỉ trạng thái thành công/thất bại." },
    { q: "Egress proxy mang lại lợi ích gì?", options: [
        "Tăng tốc độ tải trang",
        "Tập trung chính sách chặn dải nội bộ ở tầng hạ tầng, làm lưới an toàn khi code ứng dụng kiểm tra sót",
        "Thay thế HTTPS",
        "Chống XSS"
      ], correct: 1,
      explanation: "Defense in depth: kể cả khi logic kiểm tra trong code có lỗi, proxy vẫn chặn." },
    { q: "Ứng dụng chỉ cần gọi API của 2 đối tác cố định. Thiết kế nào an toàn nhất?", options: [
        "Cho người dùng nhập URL rồi chặn IP nội bộ",
        "Allowlist chính xác 2 host đó; người dùng chỉ chọn đối tác, không gửi URL",
        "Cho mọi URL https",
        "Dùng regex kiểm tra URL"
      ], correct: 1,
      explanation: "Không nhận URL tuỳ ý là cách loại bỏ SSRF triệt để nhất." },
    { q: "Vì sao dịch vụ nội bộ (Redis, admin panel) vẫn nên yêu cầu xác thực dù không mở ra Internet?", options: [
        "Không cần, đã có firewall",
        "Vì SSRF hoặc máy nội bộ bị chiếm có thể gọi tới chúng; 'trong mạng nội bộ' không có nghĩa là tin cậy",
        "Để tăng hiệu năng",
        "Vì luật bắt buộc"
      ], correct: 1,
      explanation: "Zero trust: mỗi dịch vụ tự xác thực, không dựa vào vị trí mạng." }
  ]
});
