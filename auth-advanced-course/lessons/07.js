window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "OAuth 2.0 cốt lõi",
  title: "Token: opaque vs JWT, refresh rotation, audience, introspection, revocation",
  subtitle: "RFC 6750 · 9068 · 8707 · 7662 · 7009 — vòng đời của một access token",

  theory: `
    <p>OAuth 2 core không quy định access token trông như thế nào. Các RFC bổ sung định nghĩa phần còn lại của vòng đời token.</p>

    <p><strong>1. Hai kiểu access token</strong></p>
    <table>
      <tr><th></th><th>Opaque (chuỗi ngẫu nhiên)</th><th>JWT (RFC 9068 — JWT Access Token profile)</th></tr>
      <tr><td>API kiểm tra bằng</td><td>Hỏi AS qua <strong>introspection</strong> (RFC 7662)</td><td>Tự xác minh chữ ký bằng JWKS của AS</td></tr>
      <tr><td>Thu hồi</td><td>Tức thì (AS xoá là xong)</td><td>Phải đợi <code>exp</code>, hoặc có danh sách đen</td></tr>
      <tr><td>Hiệu năng</td><td>Thêm một lời gọi mạng (thường cache vài giây)</td><td>Không cần gọi AS</td></tr>
      <tr><td>Lộ thông tin</td><td>Không</td><td>Ai cũng decode được payload — đừng để dữ liệu nhạy cảm</td></tr>
    </table>
    <p>JWT access token theo RFC 9068 có header <code>typ: at+jwt</code> và các claim: <code>iss</code>, <code>sub</code>, <code>aud</code>, <code>exp</code>, <code>iat</code>, <code>jti</code>, <code>client_id</code>, <code>scope</code>.
    Header <code>typ</code> giúp API không nhầm id_token với access token.</p>

    <p><strong>2. Gửi token (RFC 6750)</strong>: header <code>Authorization: Bearer &lt;token&gt;</code>. Không đặt token trên query string (lọt vào log, history).
    Khi từ chối, API trả <code>401</code> + <code>WWW-Authenticate: Bearer error="invalid_token"</code>, hoặc <code>403</code> với <code>error="insufficient_scope"</code>.</p>

    <p><strong>3. Audience — token này dành cho API nào?</strong> Claim <code>aud</code> nói token được phát cho resource server nào. API <em>phải</em> kiểm tra <code>aud</code> là chính mình,
    nếu không token xin cho API A có thể đem đi dùng ở API B. RFC 8707 (Resource Indicators) cho client xin token cho một resource cụ thể bằng tham số <code>resource=https://api.example.com</code>.</p>

    <p><strong>4. Refresh token</strong>: sống lâu, chỉ gửi tới AS (không bao giờ tới API). Với public client, OAuth 2.1 yêu cầu refresh token phải
    <strong>rotation</strong> (mỗi lần dùng trả refresh token mới, cái cũ vô hiệu; nếu cái cũ bị dùng lại → thu hồi cả chuỗi vì có dấu hiệu bị trộm)
    <em>hoặc</em> gắn khoá (DPoP/mTLS).</p>

    <p><strong>5. Introspection (RFC 7662)</strong>: RS gửi token tới <code>POST /introspect</code> (RS phải tự xác thực), AS trả <code>{"active": true, "scope": ..., "sub": ..., "exp": ...}</code>
    hoặc chỉ <code>{"active": false}</code>. <strong>Revocation (RFC 7009)</strong>: client gọi <code>POST /revoke</code> với token để huỷ khi user đăng xuất.</p>

    <div class="callout"><p>💡 Checklist cho API nhận JWT access token: chữ ký hợp lệ với khoá trong JWKS (theo <code>kid</code>, allowlist <code>alg</code>) · <code>iss</code> đúng AS ·
    <code>aud</code> là chính API này · <code>exp</code> chưa qua (cho lệch đồng hồ ~60s) · <code>typ</code> là <code>at+jwt</code> · <code>scope</code> đủ cho endpoint.</p></div>
  `,

  codeTabs: [
    { id: "jwt", label: "JWT access token", lines: [
      "// header",
      "{ \"typ\": \"at+jwt\", \"alg\": \"RS256\", \"kid\": \"2026-09\" }",
      "// payload",
      "{",
      "  \"iss\": \"https://as.example.com\",",
      "  \"sub\": \"user-42\",",
      "  \"aud\": \"https://api.example.com\",",
      "  \"client_id\": \"shop-web\",",
      "  \"scope\": \"orders.read profile\",",
      "  \"iat\": 1790000000,",
      "  \"exp\": 1790000900,",
      "  \"jti\": \"b1f9c0e2\"",
      "}"
    ]},
    { id: "rotate", label: "Refresh rotation", lines: [
      "POST /token  grant_type=refresh_token&refresh_token=RT1&client_id=shop-spa",
      "-> { access_token: AT2, refresh_token: RT2 }     // RT1 vô hiệu",
      "",
      "POST /token  grant_type=refresh_token&refresh_token=RT2&client_id=shop-spa",
      "-> { access_token: AT3, refresh_token: RT3 }     // RT2 vô hiệu",
      "",
      "# Kẻ trộm dùng lại RT1 (đã vô hiệu):",
      "POST /token  grant_type=refresh_token&refresh_token=RT1",
      "-> 400 invalid_grant  + AS thu hồi toàn bộ chuỗi (RT3, AT3...)",
      "# => user thật cũng bị đăng xuất, nhưng kẻ trộm mất quyền ngay"
    ]},
    { id: "intro", label: "Introspection", lines: [
      "POST /introspect HTTP/1.1",
      "Authorization: Basic base64(orders-api:secret)     // RS tự xác thực",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "token=mF_9.B5f-4.1JqM&token_type_hint=access_token",
      "",
      "200 OK",
      "{ \"active\": true, \"sub\": \"user-42\", \"client_id\": \"shop-web\",",
      "  \"scope\": \"orders.read\", \"aud\": \"https://api.example.com\", \"exp\": 1790000900 }",
      "",
      "# token không hợp lệ/đã thu hồi: { \"active\": false } — không kèm lý do"
    ]},
    { id: "err", label: "401 / 403", lines: [
      "# Token hết hạn hoặc sai",
      "HTTP/1.1 401 Unauthorized",
      "WWW-Authenticate: Bearer realm=\"orders\", error=\"invalid_token\",",
      "    error_description=\"The access token expired\"",
      "",
      "# Token hợp lệ nhưng thiếu quyền",
      "HTTP/1.1 403 Forbidden",
      "WWW-Authenticate: Bearer error=\"insufficient_scope\", scope=\"orders.write\"",
      "",
      "# Đăng xuất: huỷ refresh token tại AS",
      "POST /revoke  token=RT3&token_type_hint=refresh_token&client_id=shop-spa"
    ]}
  ],

  stageHtml: `
    <div class="node" id="as"><div class="nl">🏛️ Authorization Server</div><div class="ns">phát · làm mới · thu hồi · introspect</div></div>
    <div class="arrow" id="a1">↓ access token (ngắn) + refresh token (dài)</div>
    <div class="node" id="cl"><div class="nl">📱 Client</div><div class="ns">AT gửi tới API · RT chỉ gửi tới AS</div></div>
    <div class="arrow" id="a2">↓ Authorization: Bearer AT</div>
    <div class="node" id="rs"><div class="nl">📡 Resource Server</div><div class="ns">JWT: tự verify · opaque: introspect</div></div>
  `,
  steps: [
    { title: "1 · JWT access token", tab: "jwt", highlight: [2, 5, 7, 9, 11], on: ["as", "a1"],
      desc: "typ <code>at+jwt</code>, aud là API đích, scope là quyền, exp ngắn. API tự verify bằng khoá công khai của AS." },
    { title: "2 · API kiểm tra & từ chối đúng chuẩn", tab: "err", highlight: [2, 3, 7, 8], on: ["a2", "rs"],
      desc: "401 invalid_token khi token sai/hết hạn, 403 insufficient_scope khi thiếu quyền." },
    { title: "3 · Opaque token → introspection", tab: "intro", highlight: [2, 5, 8, 9, 11], on: ["rs", "as"],
      desc: "API hỏi AS token còn sống không. Thu hồi có hiệu lực tức thì, đổi lại thêm một lời gọi mạng." },
    { title: "4 · Refresh rotation", tab: "rotate", highlight: [2, 5, 8, 9, 10], on: ["cl", "as"],
      desc: "Mỗi lần refresh đổi sang RT mới. RT cũ bị dùng lại là tín hiệu trộm → thu hồi cả chuỗi." },
    { title: "5 · Đăng xuất = revoke", tab: "err", highlight: [11], on: ["cl", "as"],
      desc: "Xoá token ở client chưa đủ; gọi /revoke để AS vô hiệu refresh token." }
  ],

  quiz: [
    { q: "Ưu điểm chính của opaque token so với JWT access token?", options: [
        "Nhỏ hơn", "Thu hồi tức thì và không lộ thông tin trong token", "Không cần HTTPS", "Không cần AS"
      ], correct: 1, explanation: "API phải hỏi AS (introspection) nên AS kiểm soát trạng thái ngay lập tức." },
    { q: "Vì sao API bắt buộc kiểm tra claim aud?", options: [
        "Để biết user là ai",
        "Để token phát cho API khác không thể đem sang dùng ở API này",
        "Để tính thời hạn",
        "Không cần thiết"
      ], correct: 1, explanation: "aud = token dành cho ai. Thiếu kiểm tra aud là lỗ hổng 'token substitution'." },
    { q: "Header typ: at+jwt dùng để làm gì?", options: [
        "Chọn thuật toán",
        "Phân biệt JWT access token với các JWT khác (vd id_token) để tránh dùng nhầm",
        "Mã hoá payload",
        "Chỉ định audience"
      ], correct: 1, explanation: "RFC 9068 thêm typ để API không chấp nhận id_token như access token." },
    { q: "Refresh token rotation phát hiện trộm thế nào?", options: [
        "So IP",
        "Mỗi RT dùng một lần; RT cũ bị dùng lại → AS biết có hai bên cầm cùng chuỗi và thu hồi hết",
        "Mã hoá RT",
        "Gửi email cho user"
      ], correct: 1, explanation: "Reuse detection là cơ chế chính bảo vệ refresh token của public client." },
    { q: "Refresh token nên được gửi tới đâu?", options: [
        "Mọi API", "Chỉ Authorization Server (endpoint /token)", "Trong URL", "Resource Server"
      ], correct: 1, explanation: "RT không bao giờ tới RS; chỉ AS dùng nó để phát token mới." },
    { q: "Introspection response {\"active\": false} nghĩa là?", options: [
        "Token hợp lệ nhưng user offline",
        "Token không hợp lệ/hết hạn/thu hồi — API phải từ chối",
        "Cần gọi lại sau",
        "Token chưa kích hoạt, dùng tạm được"
      ], correct: 1, explanation: "AS cố ý không nói lý do để tránh lộ thông tin." },
    { q: "Token hợp lệ nhưng thiếu scope orders.write. API trả gì?", options: [
        "401 invalid_token", "403 insufficient_scope", "404", "500"
      ], correct: 1, explanation: "RFC 6750: thiếu quyền là 403 kèm error=insufficient_scope." },
    { q: "Vì sao không nên gửi access token qua query string ?access_token=...?", options: [
        "Vì URL quá dài",
        "Vì lọt vào access log, history, Referer, cache",
        "Vì server không đọc được",
        "Vì chỉ POST mới có token"
      ], correct: 1, explanation: "RFC 6750 và Security BCP khuyến cáo chỉ dùng header Authorization." },
    { q: "RFC 8707 (Resource Indicators) cho phép gì?", options: [
        "Mã hoá token",
        "Client chỉ định resource (API) muốn dùng token → AS đặt aud tương ứng",
        "Đăng nhập không mật khẩu",
        "Tự động refresh"
      ], correct: 1, explanation: "Tham số resource= giúp token có audience hẹp, giảm rủi ro khi lộ." }
  ]
});
