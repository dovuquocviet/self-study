window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Danh tính & định dạng token",
  title: "OpenID Connect sâu: id_token, UserInfo, nonce, discovery",
  subtitle: "Lớp danh tính trên OAuth 2 — và các claim bạn phải kiểm tra",

  theory: `
    <p>OAuth 2 cho client một access token để gọi API, nhưng <em>không</em> cho client biết user là ai. Nhiều app từng dùng "gọi API /me bằng access token" để suy ra danh tính —
    cách đó dễ sai (token phát cho app khác vẫn gọi được /me). <strong>OpenID Connect Core 1.0</strong> chuẩn hoá lớp danh tính:</p>
    <ul>
      <li><code>scope=openid</code> bật OIDC. Scope chuẩn thêm: <code>profile</code>, <code>email</code>, <code>address</code>, <code>phone</code>, <code>offline_access</code> (xin refresh token).</li>
      <li><strong>id_token</strong>: một JWT do OP (OpenID Provider = AS) ký, gửi cho <em>client</em> (Relying Party), nói "user này vừa đăng nhập vào app của bạn".</li>
      <li><strong>UserInfo endpoint</strong>: API trả thêm claim hồ sơ, gọi bằng access token.</li>
      <li><strong>Discovery</strong> <code>/.well-known/openid-configuration</code> + <strong>JWKS</strong> để verify chữ ký.</li>
    </ul>

    <p><strong>Claim trong id_token</strong></p>
    <table>
      <tr><th>Claim</th><th>Ý nghĩa</th><th>Client phải kiểm tra</th></tr>
      <tr><td><code>iss</code></td><td>OP phát hành</td><td>Khớp chính xác issuer đã cấu hình</td></tr>
      <tr><td><code>sub</code></td><td>ID ổn định, duy nhất của user <em>tại OP đó</em></td><td>Khoá chính để liên kết tài khoản: dùng cặp (iss, sub), <strong>không dùng email</strong></td></tr>
      <tr><td><code>aud</code></td><td>client_id nhận token</td><td>Chứa client_id của mình</td></tr>
      <tr><td><code>exp</code>, <code>iat</code></td><td>Hết hạn, thời điểm phát</td><td>Chưa hết hạn</td></tr>
      <tr><td><code>nonce</code></td><td>Giá trị client gửi ở /authorize</td><td>Bằng giá trị đã lưu trong session (chống replay)</td></tr>
      <tr><td><code>auth_time</code>, <code>acr</code>, <code>amr</code></td><td>Lúc đăng nhập, mức độ & phương thức xác thực (vd <code>mfa</code>, <code>pwd</code>)</td><td>Khi cần yêu cầu MFA/đăng nhập lại gần đây</td></tr>
      <tr><td><code>azp</code></td><td>Bên được uỷ quyền (khi aud có nhiều giá trị)</td><td>Bằng client_id nếu có</td></tr>
      <tr><td><code>at_hash</code>, <code>c_hash</code></td><td>Băm nửa trái của access token/code</td><td>Khi nhận token từ front-channel (hybrid flow)</td></tr>
    </table>

    <p><strong>id_token vs access token — không dùng lẫn</strong></p>
    <ul>
      <li>id_token: người nhận là <em>client</em>; dùng để biết ai đăng nhập. <strong>Không gửi id_token tới API</strong> làm bearer.</li>
      <li>access token: người nhận là <em>API</em>; client coi nó là chuỗi mờ, không cần đọc.</li>
    </ul>

    <p><strong>Các flow</strong> (theo <code>response_type</code>): <code>code</code> (khuyến nghị), <code>id_token</code> / <code>id_token token</code> (implicit — không dùng nữa),
    <code>code id_token</code> (hybrid — dùng trong FAPI 1). <strong>Đăng xuất</strong>: RP-Initiated Logout (<code>end_session_endpoint</code>), Front-/Back-Channel Logout để OP báo cho các app khi user đăng xuất SSO.</p>

    <div class="callout"><p>💡 Liên kết tài khoản bằng <code>(iss, sub)</code>. Email có thể đổi, có thể chưa xác minh (<code>email_verified: false</code>), và hai OP khác nhau có thể cùng
    trả một email — dùng email làm khoá là con đường chiếm tài khoản kinh điển.</p></div>
  `,

  codeTabs: [
    { id: "req", label: "Request OIDC", lines: [
      "GET https://op.example.com/authorize",
      "  ?response_type=code",
      "  &client_id=shop-web",
      "  &redirect_uri=https%3A%2F%2Fshop.example.com%2Fcb",
      "  &scope=openid%20profile%20email",
      "  &state=af0ifjsldkj",
      "  &nonce=n-0S6_WzA2Mj",
      "  &code_challenge=E9Mel...&code_challenge_method=S256",
      "",
      "# /token trả thêm \"id_token\" bên cạnh access_token"
    ]},
    { id: "idt", label: "id_token", lines: [
      "// header: { \"alg\": \"RS256\", \"kid\": \"op-2026-09\", \"typ\": \"JWT\" }",
      "{",
      "  \"iss\": \"https://op.example.com\",",
      "  \"sub\": \"248289761001\",",
      "  \"aud\": \"shop-web\",",
      "  \"exp\": 1790003600, \"iat\": 1790000000,",
      "  \"auth_time\": 1789999990,",
      "  \"nonce\": \"n-0S6_WzA2Mj\",",
      "  \"amr\": [\"pwd\", \"otp\"],",
      "  \"email\": \"an@example.com\", \"email_verified\": true,",
      "  \"name\": \"Nguyễn An\"",
      "}"
    ]},
    { id: "verify", label: "Client kiểm tra", lines: [
      "jwks  = fetchCached(discovery.jwks_uri)",
      "claims = verifyJwt(id_token, jwks, allowedAlgs=['RS256','ES256'])  // chữ ký + kid",
      "assert claims.iss == 'https://op.example.com'",
      "assert 'shop-web' in claims.aud",
      "assert claims.exp > now() - 60",
      "assert claims.nonce == session.nonce",
      "if claims.azp: assert claims.azp == 'shop-web'",
      "",
      "user = accounts.findBy(iss=claims.iss, sub=claims.sub)   // KHÔNG tìm theo email",
      "      or accounts.create(iss, sub, email if claims.email_verified)"
    ]},
    { id: "ui", label: "UserInfo & logout", lines: [
      "GET /userinfo HTTP/1.1",
      "Authorization: Bearer <access_token>",
      "",
      "{ \"sub\": \"248289761001\", \"name\": \"Nguyễn An\", \"picture\": \"https://...\" }",
      "# sub ở UserInfo PHẢI bằng sub trong id_token",
      "",
      "# Đăng xuất khỏi OP (RP-Initiated Logout)",
      "GET https://op.example.com/logout?id_token_hint=eyJ...",
      "    &post_logout_redirect_uri=https://shop.example.com/&state=xyz"
    ]}
  ],

  stageHtml: `
    <div class="node" id="rp"><div class="nl">📱 Relying Party (client)</div><div class="ns">scope=openid · nonce</div></div>
    <div class="arrow" id="a1">↓ code flow + PKCE</div>
    <div class="node" id="op"><div class="nl">🏛️ OpenID Provider</div><div class="ns">phát id_token + access_token</div></div>
    <div class="row">
      <div class="node" id="idt"><div class="nl">🪪 id_token → client</div><div class="ns">ai vừa đăng nhập</div></div>
      <div class="node" id="at"><div class="nl">🔑 access_token → API</div><div class="ns">UserInfo / API khác</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Bật OIDC bằng scope openid", tab: "req", highlight: [5, 7, 10], on: ["rp", "a1", "op"],
      desc: "Vẫn là Authorization Code + PKCE, thêm scope openid và nonce. /token trả thêm id_token." },
    { title: "2 · Đọc id_token", tab: "idt", highlight: [3, 4, 5, 8, 9, 10], on: ["idt"],
      desc: "iss/sub định danh user, aud là client của bạn, nonce gắn với phiên, amr cho biết đã dùng OTP." },
    { title: "3 · Kiểm tra đầy đủ", tab: "verify", highlight: [2, 3, 4, 5, 6], on: ["rp", "idt"],
      desc: "Chữ ký theo JWKS, allowlist alg, iss, aud, exp, nonce. Thiếu một bước là có lỗ hổng." },
    { title: "4 · Liên kết bằng (iss, sub)", tab: "verify", highlight: [9, 10], on: ["rp"],
      desc: "Không bao giờ tìm tài khoản bằng email. Chỉ tin email khi email_verified = true, và vẫn không dùng làm khoá." },
    { title: "5 · UserInfo & đăng xuất", tab: "ui", highlight: [2, 5, 8], on: ["at", "op"],
      desc: "access token dùng cho UserInfo (một API). Đăng xuất SSO qua end_session_endpoint của OP." }
  ],

  quiz: [
    { q: "Điều gì bật chế độ OpenID Connect trong một request OAuth 2?", options: [
        "response_type=token", "scope chứa openid", "grant_type=oidc", "Header X-OIDC"
      ], correct: 1, explanation: "scope=openid là dấu hiệu bắt buộc của một request OIDC." },
    { q: "id_token dành cho ai?", options: [
        "Resource Server (API)", "Client (Relying Party)", "Trình duyệt", "Database"
      ], correct: 1, explanation: "id_token cho client biết ai đã đăng nhập. API nhận access token." },
    { q: "Khoá nên dùng để liên kết tài khoản nội bộ với user OIDC?", options: [
        "email", "cặp (iss, sub)", "name", "access_token"
      ], correct: 1, explanation: "sub ổn định và duy nhất trong phạm vi một issuer." },
    { q: "Claim nonce trong id_token dùng để?", options: [
        "Chọn thuật toán",
        "Gắn id_token với phiên đăng nhập cụ thể — chống replay id_token",
        "Chứa mật khẩu",
        "Đếm số lần đăng nhập"
      ], correct: 1, explanation: "Client lưu nonce trước khi redirect và so khi nhận id_token." },
    { q: "Có nên gửi id_token tới API làm bearer token?", options: [
        "Có, vì nó là JWT có chữ ký",
        "Không — aud của id_token là client, không phải API; dùng access token",
        "Chỉ khi API cùng domain",
        "Có nếu hết hạn access token"
      ], correct: 1, explanation: "Dùng nhầm id_token là lỗi thiết kế phổ biến; API phải kiểm tra aud/typ để từ chối." },
    { q: "Claim amr: [\"pwd\", \"otp\"] cho biết gì?", options: [
        "User có 2 tài khoản", "User đã xác thực bằng mật khẩu + OTP", "Token có 2 audience", "Thuật toán ký"
      ], correct: 1, explanation: "amr = authentication methods references; acr = mức độ đảm bảo." },
    { q: "id_token có email_verified: false. Client nên?", options: [
        "Tự động gộp với tài khoản cùng email",
        "Không tin email đó để liên kết/đặc quyền; liên kết bằng (iss, sub)",
        "Từ chối đăng nhập mọi trường hợp",
        "Bỏ qua claim"
      ], correct: 1, explanation: "Gộp tài khoản theo email chưa xác minh là cách chiếm tài khoản kinh điển." },
    { q: "Endpoint UserInfo được gọi bằng gì?", options: [
        "id_token", "access_token", "client_secret", "code"
      ], correct: 1, explanation: "UserInfo là một protected resource; sub trả về phải khớp id_token." },
    { q: "response_type nào là khuyến nghị hiện nay cho OIDC?", options: [
        "id_token token (implicit)", "code (kèm PKCE)", "token", "none"
      ], correct: 1, explanation: "Implicit đã lỗi thời; code flow + PKCE cho mọi loại client." }
  ]
});
