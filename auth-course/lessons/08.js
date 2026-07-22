window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Danh tính & đăng nhập hiện đại",
  title: "OpenID Connect — 'Login with Google' thật ra là gì",
  subtitle: "Lớp danh tính mỏng đắp lên OAuth 2: thêm ID token & userinfo",

  theory: `
    <p>Bài 4 đã dặn: OAuth 2 là chuẩn <strong>uỷ quyền</strong>, không phải chuẩn đăng nhập.
    Nhưng các nút "Login with Google / Facebook / Apple" đầy khắp nơi — chúng chạy bằng gì?</p>
    <p>Câu trả lời: <strong>OpenID Connect (OIDC)</strong> — một lớp mỏng chuẩn hoá <em>danh tính</em>
    đắp lên OAuth 2. Công thức dễ nhớ: <strong>OIDC = OAuth 2 + ID token + chuẩn hoá thông tin user</strong>.</p>
    <ul>
      <li>Luồng chạy y hệt Authorization Code (+ PKCE), chỉ thêm <code>openid</code> vào scope.</li>
      <li>Ngoài access token, client nhận thêm <strong>ID token</strong> — một JWT mô tả
      <em>người dùng là ai</em>: <code>sub</code> (mã user), <code>email</code>, <code>name</code>,
      <code>iss</code> (ai phát), <code>aud</code> (phát cho app nào), <code>nonce</code> (chống phát lại).</li>
      <li>Nhà phát danh tính gọi là <strong>Identity Provider (IdP)</strong>: Google, Apple, Microsoft, Keycloak, Auth0…</li>
    </ul>
    <p>Phân vai hai token — nhầm là sinh lỗ hổng:</p>
    <ul>
      <li><strong>ID token</strong> = giấy khai sinh: <em>app của bạn</em> đọc để biết ai vừa đăng nhập. KHÔNG dùng để gọi API của Google.</li>
      <li><strong>Access token</strong> = chìa valet: gọi API tài nguyên (đọc ảnh, đọc lịch). KHÔNG phải bằng chứng danh tính.</li>
    </ul>
    <div class="callout"><p>💡 Vì sao "Login with Google" tiện? App của bạn <strong>không phải giữ mật khẩu</strong>
    (đỡ hẳn mảng rủi ro lộ DB mật khẩu), người dùng đỡ nhớ thêm một mật khẩu, và Google gánh giùm
    cả 2FA, chống bot, phát hiện đăng nhập lạ. App chỉ cần xác minh chữ ký ID token
    (bằng khoá công khai của IdP) và các claim <code>iss/aud/exp/nonce</code> là xong.</p></div>
  `,

  codeTabs: [
    { id: "req", label: "🌐 Xin đăng nhập", lines: [
      "# Y hệt Authorization Code + PKCE, thêm scope 'openid':",
      "GET https://accounts.google.com/o/oauth2/v2/auth",
      "  ?response_type=code",
      "  &client_id=my-web-app",
      "  &redirect_uri=https://myapp.com/callback",
      "  &scope=openid email profile     # <- chữ 'openid' kích hoạt OIDC",
      "  &code_challenge=E9Melhoa...&code_challenge_method=S256",
      "  &nonce=n-0S6_WzA2Mj             # chống phát lại ID token",
      "",
      "# Người dùng đăng nhập Google -> quay về ?code=...",
      "# Đổi code -> nhận THÊM id_token bên cạnh access_token:",
      "{ \"access_token\": \"ya29...\", \"id_token\": \"eyJhbGci...\" }"
    ]},
    { id: "idtoken", label: "🪪 ID token", lines: [
      "# id_token là JWT — payload giải mã ra:",
      "{",
      "  \"iss\": \"https://accounts.google.com\",  // ai phát",
      "  \"aud\": \"my-web-app\",                   // phát cho app nào",
      "  \"sub\": \"10769150350006150715113082367\", // mã user duy nhất",
      "  \"email\": \"an@gmail.com\",",
      "  \"name\": \"Nguyen Van An\",",
      "  \"nonce\": \"n-0S6_WzA2Mj\",               // khớp với lúc xin",
      "  \"exp\": 1750000000",
      "}",
      "",
      "# App xác minh: chữ ký (khoá công khai Google) + iss + aud",
      "#   + exp + nonce -> tin cậy: 'an@gmail.com vừa đăng nhập'"
    ]},
    { id: "roles", label: "⚖️ 2 token, 2 việc", lines: [
      "# ID TOKEN — 'giấy khai sinh'",
      "#   cho APP CỦA BẠN đọc: ai vừa đăng nhập",
      "#   -> tạo session/tài khoản trong app của bạn",
      "#   KHÔNG đem gọi API Google",
      "",
      "# ACCESS TOKEN — 'chìa valet'",
      "#   đem gọi API tài nguyên của IdP:",
      "GET https://openidconnect.googleapis.com/v1/userinfo",
      "Authorization: Bearer ya29...",
      "",
      "#   hoặc Photos/Calendar API nếu scope cho phép",
      "#   KHÔNG dùng làm bằng chứng 'user là ai' cho app khác"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">🧑‍💻 Người dùng</div><div class="ns">bấm nút 'Login with Google'</div></div>
    <div class="arrow" id="a1">↓ ① redirect (scope=openid email profile)</div>
    <div class="node" id="idp"><div class="nl">🔵 IdP — Google</div><div class="ns">đăng nhập, 2FA, chống bot… Google lo hết</div></div>
    <div class="arrow" id="a2">↓ ② code → đổi lấy token</div>
    <div class="node" id="tokens"><div class="nl">🎁 Bộ token</div><div class="ns">access_token + id_token (JWT danh tính)</div></div>
    <div class="arrow" id="a3">↓ ③ xác minh chữ ký + iss/aud/exp/nonce</div>
    <div class="node" id="app"><div class="nl">🏠 App của bạn</div><div class="ns">biết 'an@gmail.com vừa đăng nhập' → tạo session riêng</div></div>
  `,
  steps: [
    { title: "1 · Bấm 'Login with Google'", tab: "req", highlight: [2, 6], on: ["user", "a1", "idp"],
      desc: "Luồng vẫn là Authorization Code + PKCE của bài 5–7. Khác biệt duy nhất ở request: scope có chữ <code>openid</code> — tín hiệu 'tôi cần danh tính, không chỉ quyền truy cập'." },
    { title: "2 · IdP gánh phần khó", tab: "req", highlight: [8, 10], on: ["idp"],
      desc: "Mật khẩu, 2FA, phát hiện đăng nhập lạ, chống bot — <strong>Identity Provider</strong> lo hết. App của bạn không chạm vào mật khẩu, không giữ DB mật khẩu, đỡ hẳn một mảng rủi ro. <code>nonce</code> gửi kèm để lát nữa đối chiếu." },
    { title: "3 · Nhận thêm id_token", tab: "req", highlight: [11, 12], on: ["a2", "tokens"],
      desc: "Đổi code xong, response có thêm <code>id_token</code> bên cạnh <code>access_token</code>. Đây chính là chỗ OIDC 'đắp thêm' lên OAuth 2 — OAuth thuần không có khái niệm này." },
    { title: "4 · Đọc giấy khai sinh", tab: "idtoken", highlight: [3, 4, 5, 8], on: ["tokens", "a3"],
      desc: "ID token là JWT: <code>iss</code> = Google phát, <code>aud</code> = phát cho đúng app mình, <code>sub</code> = mã user duy nhất, kèm email/tên. App xác minh chữ ký bằng <em>khoá công khai</em> của Google + so <code>nonce</code> — khớp hết mới tin." },
    { title: "5 · Hai token, đừng dùng lẫn", tab: "roles", highlight: [1, 4, 6, 12], on: ["app"],
      desc: "ID token để <em>app bạn</em> biết ai đăng nhập → tạo session riêng của app. Access token để gọi API Google (userinfo, Photos…). Dùng lẫn — ví dụ lấy access token làm bằng chứng danh tính — là lỗ hổng kinh điển." }
  ],

  quiz: [
    { q: "Công thức đúng nhất mô tả OpenID Connect là gì?", options: [
        "OIDC = OAuth 2 + ID token + chuẩn hoá thông tin người dùng",
        "OIDC = phiên bản mã hoá của OAuth 1",
        "OIDC = giao thức thay thế hoàn toàn OAuth 2",
        "OIDC = cách lưu mật khẩu trên cloud"
      ], correct: 0,
      explanation: "OIDC là lớp danh tính mỏng chạy TRÊN OAuth 2: cùng luồng code + PKCE, thêm scope openid, nhận thêm ID token." },
    { q: "ID token dùng để làm gì?", options: [
        "Gọi API đọc ảnh của Google",
        "Cho app của bạn biết AI vừa đăng nhập (JWT chứa sub, email, tên…) để tạo phiên riêng",
        "Thay thế refresh token",
        "Mã hoá đường truyền"
      ], correct: 1,
      explanation: "ID token = giấy khai sinh, đối tượng đọc là app của bạn. Gọi API tài nguyên là việc của access token — dùng lẫn là lỗ hổng." },
    { q: "Khi xác minh ID token, app cần kiểm tra những gì?", options: [
        "Chỉ cần độ dài token",
        "Chữ ký (khoá công khai của IdP) + iss + aud + exp + nonce",
        "Chỉ cần email có đuôi @gmail.com",
        "Không cần kiểm tra vì Google luôn đúng"
      ], correct: 1,
      explanation: "Chữ ký chứng minh token do IdP phát và không bị sửa; iss/aud chứng minh 'đúng nơi phát, đúng app nhận'; exp chống token cũ; nonce chống phát lại." },
    { q: "Lợi ích lớn của 'Login with Google' cho app của bạn là gì?", options: [
        "App chạy nhanh gấp đôi",
        "App không phải giữ mật khẩu người dùng — 2FA, chống bot, phát hiện đăng nhập lạ đều do IdP gánh",
        "Không cần HTTPS nữa",
        "Người dùng không cần tài khoản"
      ], correct: 1,
      explanation: "Không giữ mật khẩu = không lo lộ DB mật khẩu. Phần xác thực khó nhằn nhất được giao cho IdP chuyên nghiệp." }
  ]
});
