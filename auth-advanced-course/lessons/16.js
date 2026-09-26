window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Các chuẩn hiện đại",
  title: "Passkeys, GNAP & bảng chọn chuẩn — tổng kết khoá",
  subtitle: "WebAuthn/FIDO2 thay mật khẩu · GNAP 'OAuth thế hệ mới' · chọn chuẩn nào cho tình huống nào",

  theory: `
    <p><strong>1. Passkeys = WebAuthn + CTAP (FIDO2)</strong> — xác thực bằng cặp khoá thay mật khẩu.</p>
    <ul>
      <li><strong>Đăng ký</strong>: server gửi <code>challenge</code> ngẫu nhiên + thông tin RP (<code>rp.id</code> = domain). Thiết bị (Face ID, vân tay, PIN, khoá bảo mật) sinh cặp khoá
        <em>riêng cho domain đó</em>, trả khoá công khai + <code>credentialId</code>. Server lưu khoá công khai.</li>
      <li><strong>Đăng nhập</strong>: server gửi challenge mới; thiết bị ký challenge bằng khoá riêng; server kiểm tra bằng khoá công khai đã lưu.</li>
      <li><strong>Chống phishing theo thiết kế</strong>: trình duyệt gắn <code>origin</code> vào dữ liệu được ký và chỉ dùng khoá cho đúng <code>rp.id</code> — trang giả mạo khác domain không thể xin chữ ký.</li>
      <li>Server chỉ giữ khoá công khai → lộ DB không lộ gì dùng được để đăng nhập. Passkey đồng bộ qua iCloud Keychain / Google Password Manager; khoá phần cứng thì gắn với thiết bị.</li>
    </ul>
    <p><strong>Quan hệ với OAuth/OIDC</strong>: passkey là cách user <em>xác thực tại IdP</em>. Sau đó IdP vẫn phát id_token/access token như bình thường
    (claim <code>amr</code> có thể chứa <code>hwk</code>/<code>swk</code>, <code>acr</code> thể hiện mức đảm bảo cao).</p>

    <p><strong>2. GNAP — Grant Negotiation and Authorization Protocol (RFC 9635, 2024)</strong>: thiết kế lại từ đầu thay vì vá OAuth 2.
    Client gửi <em>một</em> yêu cầu JSON tới AS mô tả mình cần quyền gì (giống RAR) và có thể tương tác thế nào (redirect, mã hiển thị, push…);
    mọi request đều gắn khoá (không có bearer mặc định). Rất đáng biết về mặt ý tưởng, nhưng hệ sinh thái còn nhỏ — thực tế vẫn là OAuth 2.1 + các RFC mở rộng.</p>

    <p><strong>3. Bảng chọn chuẩn</strong></p>
    <table>
      <tr><th>Tình huống</th><th>Chọn</th></tr>
      <tr><td>Web app có backend, đăng nhập user</td><td>OIDC code + PKCE, client_secret hoặc private_key_jwt</td></tr>
      <tr><td>SPA</td><td>BFF (khuyến nghị) hoặc code + PKCE public client + refresh rotation / DPoP</td></tr>
      <tr><td>Mobile app</td><td>Code + PKCE qua trình duyệt hệ thống (RFC 8252), cân nhắc DPoP</td></tr>
      <tr><td>Service-to-service</td><td>Client Credentials (+ private_key_jwt/mTLS); Token Exchange khi cần danh tính user</td></tr>
      <tr><td>TV, CLI</td><td>Device Authorization Grant</td></tr>
      <tr><td>Xác nhận trên điện thoại (call center, POS)</td><td>CIBA</td></tr>
      <tr><td>SSO doanh nghiệp</td><td>OIDC; thêm SAML nếu khách yêu cầu; SCIM cho provisioning</td></tr>
      <tr><td>Open banking / API tài chính</td><td>FAPI 2.0 (PAR + PKCE + DPoP/mTLS + private_key_jwt)</td></tr>
      <tr><td>Tích hợp hệ thống cũ (Magento Integration, WooCommerce, X v1.1)</td><td>OAuth 1.0a — dùng thư viện, không tự ký</td></tr>
      <tr><td>Thay mật khẩu</td><td>Passkeys (WebAuthn) tại IdP</td></tr>
    </table>

    <div class="callout"><p>💡 Toàn khoá trong 5 dòng: <strong>OAuth 1.0a</strong> ký từng request bằng 2 secret · <strong>OAuth 2</strong> dùng bearer + TLS, nhiều grant ·
    <strong>OIDC</strong> thêm id_token để biết user là ai · <strong>OAuth 2.1/BCP</strong> bắt buộc PKCE, bỏ implicit/password · <strong>DPoP/mTLS, PAR, FAPI</strong> gia cố cho rủi ro cao.</p></div>
  `,

  codeTabs: [
    { id: "reg", label: "Passkey: đăng ký", lines: [
      "// Trình duyệt (server đã gửi challenge + user id)",
      "cred = await navigator.credentials.create({ publicKey: {",
      "  challenge: fromServer.challenge,                   // ngẫu nhiên, dùng 1 lần",
      "  rp:   { id: 'shop.example.com', name: 'Shop' },",
      "  user: { id: userIdBytes, name: 'an@example.com', displayName: 'An' },",
      "  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],   // -7 = ES256",
      "  authenticatorSelection: { residentKey: 'required', userVerification: 'required' }",
      "}})",
      "// gửi cred.response (attestation, clientDataJSON) lên server",
      "// server kiểm tra challenge + origin, LƯU khoá công khai + credentialId"
    ]},
    { id: "login", label: "Passkey: đăng nhập", lines: [
      "assertion = await navigator.credentials.get({ publicKey: {",
      "  challenge: fromServer.challenge,",
      "  rpId: 'shop.example.com',",
      "  userVerification: 'required'",
      "}})",
      "",
      "// server kiểm tra:",
      "//  - clientDataJSON.challenge == challenge đã phát, origin == https://shop.example.com",
      "//  - chữ ký hợp lệ với khoá công khai đã lưu cho credentialId",
      "//  - cờ UV (user verified) bật; signCount hợp lý (nếu authenticator hỗ trợ)"
    ]},
    { id: "gnap", label: "GNAP (tham khảo)", lines: [
      "POST /gnap HTTP/1.1",
      "Signature-Input: ...   Signature: ...     // request luôn được ký bằng khoá client",
      "{",
      "  \"access_token\": { \"access\": [ { \"type\": \"photo-api\", \"actions\": [\"read\"] } ] },",
      "  \"client\": { \"key\": { \"proof\": \"httpsig\", \"jwk\": { ... } } },",
      "  \"interact\": { \"start\": [\"redirect\"], \"finish\": { \"method\": \"redirect\",",
      "                \"uri\": \"https://client.example/cb\", \"nonce\": \"LKLTI25DK82FX4T4QFZC\" } }",
      "}"
    ]},
    { id: "cheat", label: "Nhận diện nhanh", lines: [
      "Thấy...                                          => Đang dùng",
      "Authorization: OAuth oauth_signature=...          => OAuth 1.0a",
      "4 chuỗi consumer key/secret + token/secret        => OAuth 1.0a",
      "Authorization: Bearer ...                         => OAuth 2 (bearer)",
      "Authorization: DPoP ... + header DPoP             => OAuth 2 + DPoP",
      "scope=openid, id_token                            => OpenID Connect",
      "code_challenge / code_verifier                    => PKCE",
      "request_uri=urn:ietf:params:oauth:request_uri:... => PAR",
      "SAMLResponse=PHNhbWxw...                          => SAML 2.0",
      "/scim/v2/Users                                    => SCIM",
      "navigator.credentials.create/get                  => WebAuthn / Passkeys"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pk"><div class="nl">🔏 Passkey tại IdP</div><div class="ns">ký challenge · gắn origin · chống phishing</div></div>
    <div class="arrow" id="a1">↓ xác thực xong</div>
    <div class="node" id="oidc"><div class="nl">🪪 OIDC / OAuth 2.1</div><div class="ns">id_token · access token</div></div>
    <div class="arrow" id="a2">↓ rủi ro cao</div>
    <div class="node" id="harden"><div class="nl">🛡️ DPoP/mTLS · PAR · FAPI</div><div class="ns">gia cố</div></div>
    <div class="arrow" id="a3">↓ tương lai</div>
    <div class="node" id="gnap"><div class="nl">🧭 GNAP (RFC 9635)</div><div class="ns">thiết kế lại, hệ sinh thái còn nhỏ</div></div>
  `,
  steps: [
    { title: "1 · Đăng ký passkey", tab: "reg", highlight: [3, 4, 6, 7, 10], on: ["pk"],
      desc: "Thiết bị sinh cặp khoá cho đúng rp.id. Server chỉ lưu khoá công khai." },
    { title: "2 · Đăng nhập bằng passkey", tab: "login", highlight: [2, 3, 8, 9, 10], on: ["pk"],
      desc: "Ký challenge mới; server kiểm tra challenge, origin và chữ ký. Trang giả khác domain không xin được chữ ký." },
    { title: "3 · Sau đó vẫn là OIDC/OAuth", tab: "cheat", highlight: [4, 5, 6, 7], on: ["a1", "oidc", "a2", "harden"],
      desc: "Passkey thay mật khẩu ở bước xác thực; token vẫn do IdP phát theo OIDC/OAuth 2.1, gia cố bằng DPoP/PAR khi cần." },
    { title: "4 · GNAP", tab: "gnap", highlight: [2, 4, 5, 6], on: ["a3", "gnap"],
      desc: "Một request JSON mô tả quyền và cách tương tác, luôn ký bằng khoá. Đáng biết về ý tưởng." },
    { title: "5 · Nhận diện chuẩn trong 5 giây", tab: "cheat", highlight: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], on: ["pk", "oidc", "harden", "gnap"],
      desc: "Lần tới gặp một header hay tham số lạ, tra bảng này là biết đang ở chuẩn nào." }
  ],

  quiz: [
    { q: "Vì sao passkey chống phishing tốt hơn mật khẩu + OTP?", options: [
        "Vì dài hơn",
        "Khoá gắn với rp.id/origin; trang giả khác domain không thể xin thiết bị ký",
        "Vì gửi qua SMS",
        "Vì server lưu khoá riêng"
      ], correct: 1, explanation: "OTP vẫn có thể bị user gõ vào trang giả; passkey thì trình duyệt tự kiểm tra origin." },
    { q: "Server lưu gì khi user đăng ký passkey?", options: [
        "Khoá riêng", "Khoá công khai + credentialId", "Mật khẩu", "Ảnh khuôn mặt"
      ], correct: 1, explanation: "Sinh trắc học chỉ mở khoá trên thiết bị, không gửi lên server." },
    { q: "Passkey và OIDC quan hệ thế nào?", options: [
        "Passkey thay thế hoàn toàn OIDC",
        "Passkey là cách user xác thực tại IdP; IdP vẫn phát token theo OIDC/OAuth",
        "Không liên quan gì",
        "OIDC là một loại passkey"
      ], correct: 1, explanation: "Hai lớp khác nhau: xác thực vs giao thức phát token." },
    { q: "GNAP (RFC 9635) là gì?", options: [
        "Bản vá nhỏ của OAuth 1",
        "Giao thức uỷ quyền thiết kế lại từ đầu, request JSON, luôn gắn khoá",
        "Chuẩn SAML mới",
        "Thư viện JWT"
      ], correct: 1, explanation: "Hệ sinh thái còn nhỏ; thực tế vẫn dùng OAuth 2.1 + mở rộng." },
    { q: "Ôn tập: 4 chuỗi consumer key, consumer secret, access token, token secret thuộc chuẩn nào?", options: [
        "OAuth 2.0", "OAuth 1.0a", "OIDC", "SAML"
      ], correct: 1, explanation: "Hai cặp (định danh, bí mật) của app và của quyền user." },
    { q: "Ôn tập: khác biệt cốt lõi OAuth 1.0a và OAuth 2.0?", options: [
        "OAuth 2 dùng XML",
        "OAuth 1.0a ký từng request; OAuth 2 dùng bearer token dựa vào TLS",
        "OAuth 1 có refresh token",
        "OAuth 2 không cần user đồng ý"
      ], correct: 1, explanation: "Chữ ký theo request vs bearer." },
    { q: "Ôn tập: PKCE bảo vệ thứ gì?", options: [
        "Mật khẩu", "Authorization code khỏi bị đem đi đổi khi bị chặn", "id_token", "JWKS"
      ], correct: 1, explanation: "Không có code_verifier thì code vô dụng." },
    { q: "Ôn tập: id_token dành cho ai và access token dành cho ai?", options: [
        "Cả hai cho API",
        "id_token cho client biết user là ai; access token cho API",
        "id_token cho API; access token cho client",
        "Cả hai cho trình duyệt"
      ], correct: 1, explanation: "Không gửi id_token tới API làm bearer." },
    { q: "Ôn tập: API nhận JWT access token phải kiểm tra gì?", options: [
        "Chỉ chữ ký",
        "Chữ ký (allowlist alg, khoá theo kid từ JWKS issuer), iss, aud, exp, typ, scope",
        "Chỉ exp",
        "Không cần kiểm tra"
      ], correct: 1, explanation: "Thiếu aud/iss là lỗ hổng thay thế token." },
    { q: "Ôn tập: SPA đọc được token trong JavaScript lo ngại XSS. Kiến trúc khuyến nghị?", options: [
        "Implicit grant",
        "BFF — backend giữ token, trình duyệt chỉ có cookie HttpOnly",
        "Lưu token trong localStorage",
        "Password grant"
      ], correct: 1, explanation: "Theo tài liệu best practice cho browser-based app." },
    { q: "Ôn tập: Smart TV đăng nhập — grant nào?", options: [
        "Device Authorization Grant", "Implicit", "Client Credentials", "SAML"
      ], correct: 0, explanation: "RFC 8628: TV hiện mã, user duyệt trên điện thoại." },
    { q: "Ôn tập: API open banking cần hồ sơ bảo mật nào?", options: [
        "OAuth 1.0a", "FAPI 2.0", "Basic auth", "Implicit"
      ], correct: 1, explanation: "PAR + PKCE + private_key_jwt/mTLS + DPoP/mTLS." },
    { q: "Ôn tập: nhân viên nghỉ việc cần bị khoá ngay trong mọi app SaaS. Chuẩn nào?", options: [
        "SCIM", "PKCE", "JWE", "DPoP"
      ], correct: 0, explanation: "SCIM provisioning: IdP PATCH active=false tới từng app." }
  ]
});
