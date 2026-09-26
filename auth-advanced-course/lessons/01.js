window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Bản đồ",
  title: "Bản đồ các chuẩn: ai giải quyết bài toán gì",
  subtitle: "OAuth 1.0a · OAuth 2.0/2.1 · OIDC · SAML · JOSE · DPoP · PAR · FAPI · Passkeys",

  theory: `
    <p>Các chuẩn đăng nhập hay bị gọi lẫn lộn vì tên na ná nhau. Thật ra mỗi chuẩn trả lời <strong>một câu hỏi khác nhau</strong>.
    Trước khi đi sâu, hãy đặt chúng lên cùng một bản đồ.</p>

    <table>
      <tr><th>Chuẩn</th><th>Năm</th><th>Trả lời câu hỏi</th><th>Nhận diện nhanh</th></tr>
      <tr><td><strong>OAuth 1.0a</strong> (RFC 5849)</td><td>2009–2010</td><td>Uỷ quyền: app được gọi API thay user</td><td>4 chuỗi: consumer key/secret + token/token secret; mỗi request đều <em>ký</em></td></tr>
      <tr><td><strong>OAuth 2.0</strong> (RFC 6749, 6750)</td><td>2012</td><td>Uỷ quyền, đơn giản hơn, cho mọi loại client</td><td><code>Authorization: Bearer ...</code>, access + refresh token, dựa vào TLS</td></tr>
      <tr><td><strong>OpenID Connect</strong></td><td>2014</td><td><em>Người dùng là ai?</em> (xác thực) — lớp trên OAuth 2</td><td><code>scope=openid</code>, <code>id_token</code> dạng JWT</td></tr>
      <tr><td><strong>SAML 2.0</strong></td><td>2005</td><td>SSO doanh nghiệp (xác thực + thuộc tính)</td><td>Assertion XML, IdP/SP, redirect/POST</td></tr>
      <tr><td><strong>JOSE</strong>: JWT, JWS, JWE, JWK</td><td>2015</td><td>Định dạng token/chữ ký/khoá — không phải giao thức đăng nhập</td><td><code>eyJ...</code> 3 phần; <code>/.well-known/jwks.json</code></td></tr>
      <tr><td><strong>PKCE</strong> (RFC 7636)</td><td>2015</td><td>Chống cướp authorization code</td><td><code>code_challenge</code>, <code>code_verifier</code></td></tr>
      <tr><td><strong>OAuth 2.1</strong> (draft) + Security BCP (RFC 9700)</td><td>2020–2025</td><td>Gom các bài học bảo mật vào OAuth 2</td><td>PKCE bắt buộc, bỏ implicit & password grant</td></tr>
      <tr><td><strong>DPoP</strong> (RFC 9449), <strong>mTLS</strong> (RFC 8705)</td><td>2020–2023</td><td>Token bị trộm vẫn không dùng được</td><td>Header <code>DPoP:</code>, claim <code>cnf</code></td></tr>
      <tr><td><strong>PAR / JAR / RAR</strong></td><td>2021–2023</td><td>Request uỷ quyền an toàn & chi tiết hơn</td><td><code>request_uri</code>, <code>request</code>, <code>authorization_details</code></td></tr>
      <tr><td><strong>FAPI 2.0</strong></td><td>2023+</td><td>Hồ sơ cấu hình cho ngân hàng/open banking</td><td>= PAR + PKCE + DPoP/mTLS + private_key_jwt</td></tr>
      <tr><td><strong>WebAuthn / Passkeys</strong> (FIDO2)</td><td>2019+</td><td>Xác thực không mật khẩu tại chính IdP</td><td><code>navigator.credentials</code>, khoá công khai</td></tr>
    </table>

    <p><strong>Ba lớp cần tách bạch</strong></p>
    <ul>
      <li><strong>Xác thực (authN)</strong> — chứng minh bạn là ai: mật khẩu, OTP, passkey, SAML, OIDC.</li>
      <li><strong>Uỷ quyền (authZ delegation)</strong> — cho một app quyền gọi API thay bạn: OAuth 1.0a, OAuth 2.</li>
      <li><strong>Định dạng</strong> — cách đóng gói token và chữ ký: JWT/JWS/JWE/JWK. OAuth 2 không bắt buộc access token phải là JWT.</li>
    </ul>

    <div class="callout"><p>💡 Câu nói cần nhớ: <strong>"OAuth là uỷ quyền, OIDC là xác thực"</strong>. OAuth cho app một chiếc chìa khoá gọi API;
    nó không nói cho app biết người cầm chìa là ai. OIDC thêm <code>id_token</code> để trả lời câu hỏi đó.</p></div>
  `,

  codeTabs: [
    { id: "o1", label: "OAuth 1.0a", lines: [
      "GET /api/orders HTTP/1.1",
      "Host: api.example.com",
      "Authorization: OAuth oauth_consumer_key=\"ck_123\",",
      "    oauth_token=\"at_456\",",
      "    oauth_signature_method=\"HMAC-SHA1\",",
      "    oauth_timestamp=\"1790000000\",",
      "    oauth_nonce=\"k9f3a1x7\",",
      "    oauth_version=\"1.0\",",
      "    oauth_signature=\"tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D\"",
      "",
      "# consumer_secret và token_secret KHÔNG đi trên dây — chỉ dùng để ký"
    ]},
    { id: "o2", label: "OAuth 2.0", lines: [
      "GET /api/orders HTTP/1.1",
      "Host: api.example.com",
      "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
      "",
      "# Không chữ ký theo từng request",
      "# Ai cầm token là dùng được (bearer = 'người cầm')",
      "# An toàn nhờ TLS + token sống ngắn"
    ]},
    { id: "oidc", label: "OIDC", lines: [
      "# Response từ token endpoint khi scope có 'openid'",
      "{",
      "  \"access_token\":  \"eyJ...\",      // để gọi API (OAuth)",
      "  \"id_token\":      \"eyJ...\",      // cho CLIENT biết user là ai (OIDC)",
      "  \"refresh_token\": \"8xLOxBtZp8\",",
      "  \"token_type\":    \"Bearer\",",
      "  \"expires_in\":    3600",
      "}"
    ]},
    { id: "dpop", label: "Hiện đại (DPoP)", lines: [
      "GET /api/orders HTTP/1.1",
      "Host: api.example.com",
      "Authorization: DPoP eyJ...access_token...",
      "DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2In0...",
      "",
      "# Token gắn với khoá riêng của client:",
      "# trộm được token mà không có khoá -> vô dụng"
    ]}
  ],

  stageHtml: `
    <div class="node" id="authn"><div class="nl">🙋 Xác thực — bạn là ai?</div><div class="ns">mật khẩu · passkey · SAML · OIDC</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="authz"><div class="nl">🔑 Uỷ quyền — app được làm gì thay bạn?</div><div class="ns">OAuth 1.0a → OAuth 2.0 → OAuth 2.1</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="fmt"><div class="nl">📦 Định dạng token & khoá</div><div class="ns">JWT · JWS · JWE · JWK</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="harden"><div class="nl">🛡️ Gia cố</div><div class="ns">PKCE · DPoP · mTLS · PAR · FAPI</div></div>
  `,
  steps: [
    { title: "1 · OAuth 1.0a — ký từng request", tab: "o1", highlight: [3, 4, 9, 11], on: ["authz"],
      desc: "Chuẩn uỷ quyền đầu tiên. Mỗi request mang <code>consumer_key</code>, <code>token</code> và một <strong>chữ ký</strong>. Hai secret không bao giờ gửi đi." },
    { title: "2 · OAuth 2.0 — bearer token", tab: "o2", highlight: [3, 6, 7], on: ["authz", "a2", "fmt"],
      desc: "Bỏ chữ ký theo request, dựa vào TLS. Đơn giản hơn nhiều, nhưng token bị lộ là dùng được ngay." },
    { title: "3 · OIDC — thêm danh tính", tab: "oidc", highlight: [3, 4], on: ["authn", "a1"],
      desc: "Cùng luồng OAuth 2, thêm <code>scope=openid</code> để nhận <code>id_token</code>: tờ giấy nói cho client biết user là ai." },
    { title: "4 · Gia cố hiện đại", tab: "dpop", highlight: [3, 4, 6, 7], on: ["harden", "a3"],
      desc: "DPoP/mTLS gắn token với khoá của client; PAR giấu tham số khỏi trình duyệt; FAPI gom tất cả thành một hồ sơ cho ngân hàng." },
    { title: "5 · Ba lớp tách bạch", tab: "oidc", highlight: [3, 4], on: ["authn", "authz", "fmt", "harden"],
      desc: "Khi đọc một chuẩn mới, hỏi: nó thuộc lớp xác thực, uỷ quyền, định dạng hay gia cố? Hầu hết nhầm lẫn biến mất." }
  ],

  quiz: [
    { q: "OAuth (1 hay 2) chủ yếu giải quyết bài toán gì?", options: [
        "Mã hoá mật khẩu",
        "Uỷ quyền cho một app gọi API thay người dùng",
        "Chống DDoS",
        "Lưu session trên server"
      ], correct: 1, explanation: "OAuth là giao thức uỷ quyền (delegation). Nó không định nghĩa cách biết user là ai." },
    { q: "Chuẩn nào thêm lớp 'người dùng là ai' lên trên OAuth 2?", options: [
        "JWE", "OpenID Connect", "PKCE", "SCIM"
      ], correct: 1, explanation: "OIDC thêm scope openid, id_token và endpoint UserInfo." },
    { q: "JWT có phải là một giao thức đăng nhập không?", options: [
        "Có, JWT thay thế OAuth",
        "Không — JWT chỉ là định dạng token có chữ ký; giao thức dùng nó là OAuth/OIDC...",
        "Có, JWT là tên khác của OIDC",
        "Có, nhưng chỉ cho mobile"
      ], correct: 1, explanation: "JWT thuộc họ JOSE (định dạng). OAuth 2 thậm chí không bắt buộc access token là JWT." },
    { q: "Dấu hiệu nhận ra API đang dùng OAuth 1.0a?", options: [
        "Header Authorization: Bearer ...",
        "Header Authorization: OAuth ... có oauth_signature, oauth_nonce, oauth_timestamp",
        "Cookie sid=...",
        "Header X-API-Key"
      ], correct: 1, explanation: "OAuth 1.0a ký từng request; các tham số oauth_* nằm trong header Authorization: OAuth." },
    { q: "OAuth 2.1 là gì?", options: [
        "Một giao thức hoàn toàn mới không tương thích OAuth 2",
        "OAuth 2.0 gom các bài học bảo mật: PKCE bắt buộc, bỏ implicit và password grant",
        "Phiên bản OAuth cho IoT",
        "Tên mới của OIDC"
      ], correct: 1, explanation: "OAuth 2.1 hợp nhất RFC 6749 + các best practice (PKCE, redirect URI khớp chính xác, bỏ grant nguy hiểm)." },
    { q: "DPoP và mTLS-bound token giải quyết vấn đề gì của bearer token?", options: [
        "Token quá dài",
        "Token bị trộm vẫn dùng được — nay token gắn với khoá riêng của client",
        "Token hết hạn quá nhanh",
        "Không hỗ trợ tiếng Việt"
      ], correct: 1, explanation: "Sender-constrained token: phải chứng minh sở hữu khoá mới dùng được token." },
    { q: "SAML 2.0 thường gặp ở đâu?", options: [
        "SSO doanh nghiệp giữa IdP (Okta, Entra ID, ADFS...) và các ứng dụng",
        "Gọi API từ app mobile",
        "Thanh toán thẻ",
        "Lưu trữ file"
      ], correct: 0, explanation: "SAML là chuẩn SSO dựa trên XML, rất phổ biến trong doanh nghiệp trước khi có OIDC." },
    { q: "FAPI 2.0 là gì?", options: [
        "Một ngôn ngữ lập trình",
        "Hồ sơ cấu hình bảo mật cao kết hợp PAR, PKCE, sender-constrained token, client auth mạnh",
        "Thư viện JavaScript",
        "Tên khác của SAML"
      ], correct: 1, explanation: "FAPI (Financial-grade API) không phát minh giao thức mới mà quy định bắt buộc dùng các chuẩn gia cố." },
    { q: "Passkeys (WebAuthn/FIDO2) thuộc lớp nào?", options: [
        "Uỷ quyền API", "Xác thực người dùng không mật khẩu", "Định dạng token", "Provisioning user"
      ], correct: 1, explanation: "Passkey là cách user chứng minh danh tính (thường tại IdP); sau đó IdP vẫn có thể phát token OAuth/OIDC." }
  ]
});
