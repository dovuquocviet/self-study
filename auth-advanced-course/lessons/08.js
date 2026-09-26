window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "OAuth 2.0 cốt lõi",
  title: "Client xác thực với AS & discovery metadata",
  subtitle: "client_secret_basic/post · private_key_jwt · tls_client_auth · /.well-known/oauth-authorization-server",

  theory: `
    <p>Confidential client phải chứng minh "tôi đúng là client_id này" khi gọi <code>/token</code>, <code>/introspect</code>, <code>/revoke</code>.
    Có nhiều cách, xếp từ yếu tới mạnh:</p>

    <table>
      <tr><th>Phương thức (<code>token_endpoint_auth_method</code>)</th><th>Cách làm</th><th>Đánh giá</th></tr>
      <tr><td><code>none</code></td><td>Chỉ gửi client_id (public client)</td><td>Dùng cho SPA/mobile, bắt buộc PKCE</td></tr>
      <tr><td><code>client_secret_post</code></td><td>client_id + client_secret trong body form</td><td>Được phép nhưng kém hơn basic</td></tr>
      <tr><td><code>client_secret_basic</code></td><td><code>Authorization: Basic base64(id:secret)</code></td><td>Mặc định phổ biến; secret chung → AS cũng giữ secret</td></tr>
      <tr><td><code>client_secret_jwt</code></td><td>Ký một JWT bằng HMAC với secret</td><td>Secret không đi trên dây, nhưng vẫn là khoá chung</td></tr>
      <tr><td><strong><code>private_key_jwt</code></strong> (RFC 7523)</td><td>Ký JWT assertion bằng <strong>khoá riêng</strong>; AS giữ khoá công khai (JWKS của client)</td><td>✅ Mạnh: không có secret chung; FAPI yêu cầu</td></tr>
      <tr><td><strong><code>tls_client_auth</code></strong> / <code>self_signed_tls_client_auth</code> (RFC 8705)</td><td>Chứng chỉ client trong mTLS</td><td>✅ Mạnh; cần hạ tầng mTLS</td></tr>
    </table>

    <p><strong>private_key_jwt — client assertion</strong>: client tạo JWT với <code>iss</code> = <code>sub</code> = client_id, <code>aud</code> = URL của AS (issuer hoặc token endpoint),
    <code>jti</code> duy nhất (chống dùng lại), <code>exp</code> rất ngắn (vài phút), ký bằng khoá riêng. Gửi kèm:
    <code>client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer</code> và <code>client_assertion=&lt;JWT&gt;</code>.</p>

    <p><strong>Discovery metadata</strong> — thay vì cấu hình tay từng URL, client đọc tài liệu JSON của AS:</p>
    <ul>
      <li>OAuth: <code>/.well-known/oauth-authorization-server</code> (RFC 8414).</li>
      <li>OIDC: <code>/.well-known/openid-configuration</code> — cùng ý tưởng, nhiều field hơn.</li>
    </ul>
    <p>Trong đó có: <code>issuer</code>, <code>authorization_endpoint</code>, <code>token_endpoint</code>, <code>jwks_uri</code>, <code>scopes_supported</code>,
    <code>response_types_supported</code>, <code>grant_types_supported</code>, <code>token_endpoint_auth_methods_supported</code>, <code>code_challenge_methods_supported</code>,
    <code>revocation_endpoint</code>, <code>introspection_endpoint</code>, <code>pushed_authorization_request_endpoint</code>…
    Client phải kiểm tra <code>issuer</code> trong tài liệu khớp đúng URL đã cấu hình (chống giả mạo/mix-up).</p>

    <p><strong>Dynamic Client Registration</strong> (RFC 7591): client tự đăng ký qua API <code>/register</code> để nhận client_id — dùng trong hệ sinh thái mở (open banking, MCP server…).</p>

    <div class="callout"><p>💡 Server-to-server quan trọng (thanh toán, dữ liệu nhạy cảm): ưu tiên <code>private_key_jwt</code> hoặc mTLS thay cho client_secret.
    Khoá riêng không bao giờ rời client, xoay khoá chỉ cần cập nhật JWKS — không phải gửi secret mới qua email.</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "client_secret_basic", lines: [
      "POST /token HTTP/1.1",
      "Host: as.example.com",
      "Authorization: Basic c2hvcC13ZWI6czNjcmV0",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "grant_type=authorization_code&code=Splx...&redirect_uri=...&code_verifier=dBjf...",
      "",
      "# c2hvcC13ZWI6czNjcmV0 = base64('shop-web:s3cret')",
      "# id và secret phải được form-urlencode TRƯỚC khi ghép 'id:secret' (RFC 6749 2.3.1)"
    ]},
    { id: "pkjwt", label: "private_key_jwt", lines: [
      "// JWT do client ký bằng KHOÁ RIÊNG",
      "header:  { \"alg\": \"ES256\", \"kid\": \"client-key-1\" }",
      "payload: {",
      "  \"iss\": \"shop-backend\", \"sub\": \"shop-backend\",",
      "  \"aud\": \"https://as.example.com\",",
      "  \"jti\": \"4f1c9a2e-...\", \"iat\": 1790000000, \"exp\": 1790000060",
      "}",
      "",
      "POST /token",
      "grant_type=client_credentials&scope=payments",
      "&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      "&client_assertion=eyJhbGciOiJFUzI1NiIsImtpZCI6ImNsaWVudC1rZXktMSJ9..."
    ]},
    { id: "meta", label: "Discovery", lines: [
      "GET https://as.example.com/.well-known/oauth-authorization-server",
      "{",
      "  \"issuer\": \"https://as.example.com\",",
      "  \"authorization_endpoint\": \"https://as.example.com/authorize\",",
      "  \"token_endpoint\": \"https://as.example.com/token\",",
      "  \"jwks_uri\": \"https://as.example.com/jwks\",",
      "  \"grant_types_supported\": [\"authorization_code\", \"refresh_token\", \"client_credentials\"],",
      "  \"token_endpoint_auth_methods_supported\": [\"private_key_jwt\", \"client_secret_basic\"],",
      "  \"code_challenge_methods_supported\": [\"S256\"],",
      "  \"pushed_authorization_request_endpoint\": \"https://as.example.com/par\"",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="weak"><div class="nl">🔓 Secret chung</div><div class="ns">basic · post · client_secret_jwt</div></div>
      <div class="node" id="strong"><div class="nl">🔐 Khoá bất đối xứng</div><div class="ns">private_key_jwt · mTLS</div></div>
    </div>
    <div class="arrow" id="a1">↓ gọi /token</div>
    <div class="node" id="as"><div class="nl">🏛️ Authorization Server</div><div class="ns">xác minh client · đọc JWKS của client</div></div>
    <div class="arrow" id="a2">↑ client đọc cấu hình</div>
    <div class="node" id="meta"><div class="nl">📄 /.well-known/…</div><div class="ns">endpoints · jwks_uri · phương thức hỗ trợ</div></div>
  `,
  steps: [
    { title: "1 · client_secret_basic", tab: "basic", highlight: [3, 8, 9], on: ["weak", "a1", "as"],
      desc: "Đơn giản, phổ biến. Nhược điểm: AS và client cùng giữ một secret; secret đi trên dây mỗi lần." },
    { title: "2 · private_key_jwt", tab: "pkjwt", highlight: [2, 4, 5, 6, 11, 12], on: ["strong", "a1", "as"],
      desc: "Client ký assertion ngắn hạn bằng khoá riêng. AS chỉ cần khoá công khai. jti chống dùng lại, aud chống đem sang AS khác." },
    { title: "3 · Discovery", tab: "meta", highlight: [3, 5, 6, 8, 9, 10], on: ["meta", "a2"],
      desc: "Client đọc metadata để biết endpoint, thuật toán, phương thức xác thực. Luôn kiểm tra issuer khớp URL đã cấu hình." },
    { title: "4 · Chọn phương thức", tab: "meta", highlight: [8], on: ["strong", "weak"],
      desc: "Public client: none + PKCE. Backend thường: basic. Nhạy cảm/FAPI: private_key_jwt hoặc mTLS." }
  ],

  quiz: [
    { q: "SPA (public client) xác thực với /token bằng cách nào?", options: [
        "client_secret_basic", "none — chỉ client_id, bảo vệ bằng PKCE", "private_key_jwt với khoá nhúng trong JS", "Không gọi /token"
      ], correct: 1, explanation: "Public client không giữ được bí mật; PKCE thay vai trò bảo vệ code." },
    { q: "Ưu điểm lớn nhất của private_key_jwt so với client_secret_basic?", options: [
        "Nhanh hơn",
        "Không có bí mật chung — khoá riêng không rời client, AS chỉ giữ khoá công khai",
        "Không cần HTTPS",
        "Không cần client_id"
      ], correct: 1, explanation: "Lộ dữ liệu ở AS cũng không lộ được khả năng giả danh client." },
    { q: "Trong client assertion JWT, iss và sub là gì?", options: [
        "URL của AS", "client_id của chính client", "user id", "kid của khoá"
      ], correct: 1, explanation: "iss = sub = client_id; aud = AS." },
    { q: "Claim jti trong client assertion để làm gì?", options: [
        "Chọn thuật toán", "Định danh duy nhất để AS chặn dùng lại assertion", "Chứa scope", "Chứa secret"
      ], correct: 1, explanation: "Kết hợp exp ngắn và jti để chống replay." },
    { q: "Tài liệu discovery của OIDC nằm ở đâu?", options: [
        "/oauth/config", "/.well-known/openid-configuration", "/api/discovery", "/jwks.json"
      ], correct: 1, explanation: "OAuth thuần dùng /.well-known/oauth-authorization-server (RFC 8414)." },
    { q: "Vì sao client phải kiểm tra field issuer trong metadata?", options: [
        "Để biết màu giao diện",
        "Để chắc tài liệu thuộc đúng AS đã cấu hình, chống giả mạo/mix-up",
        "Để tính thời hạn token",
        "Không cần"
      ], correct: 1, explanation: "issuer phải khớp chính xác URL gốc; id_token cũng phải có iss này." },
    { q: "tls_client_auth (RFC 8705) xác thực client bằng gì?", options: [
        "Mật khẩu", "Chứng chỉ client trong kết nối mutual TLS", "Cookie", "API key"
      ], correct: 1, explanation: "AS kiểm tra chứng chỉ client (subject DN/SAN) khớp với client đã đăng ký." },
    { q: "Dynamic Client Registration (RFC 7591) là gì?", options: [
        "Tự đổi mật khẩu user",
        "Client tự đăng ký với AS qua API để nhận client_id/metadata",
        "Tự động refresh token",
        "Đăng ký domain"
      ], correct: 1, explanation: "Hữu ích khi có rất nhiều client không quen biết trước (open banking, MCP...)." },
    { q: "Khi dùng client_secret_basic, bước nào hay bị làm sai?", options: [
        "Quên base64",
        "Không form-urlencode client_id/secret trước khi ghép id:secret nếu chúng có ký tự đặc biệt",
        "Dùng POST",
        "Gửi Content-Type"
      ], correct: 1, explanation: "RFC 6749 mục 2.3.1 yêu cầu encode trước; nhiều AS/SDK xử lý khác nhau khi secret có ký tự như + / :." }
  ]
});
