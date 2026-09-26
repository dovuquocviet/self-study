window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Xác thực trên mobile",
  title: "Đăng nhập & OAuth trên mobile",
  subtitle: "Public client · Authorization Code + PKCE · system browser thay vì WebView · redirect URI · lưu refresh token ở đâu",

  theory: `
    <p>Đăng nhập là cửa chính của app. Trên mobile có vài đặc thù làm nó khác web: app là <strong>public client</strong> (không giữ được client secret — bài 02),
    redirect quay về app qua <strong>deep link</strong> (app khác có thể giành), và app có sẵn <strong>WebView</strong> — rất tiện nhưng rất nguy hiểm cho màn hình đăng nhập.</p>

    <p><strong>1. Hai kiểu đăng nhập</strong></p>
    <ul>
      <li><strong>Đăng nhập trực tiếp vào backend của bạn</strong> (email + mật khẩu → backend trả token). Đơn giản; áp dụng mọi nguyên tắc của bài 10 và 13.</li>
      <li><strong>Qua OAuth 2.0 / OpenID Connect</strong>: đăng nhập bằng Google/Apple/Microsoft, hoặc qua Identity Provider (IdP) riêng của công ty (Keycloak, Auth0, Cognito…).
        Chuẩn cho mobile được mô tả trong RFC 8252 "OAuth 2.0 for Native Apps".</li>
    </ul>

    <p><strong>2. Authorization Code + PKCE — luồng bắt buộc cho app mobile</strong></p>
    <ol>
      <li>App sinh <code>code_verifier</code> (chuỗi ngẫu nhiên 43–128 ký tự) và tính <code>code_challenge = BASE64URL(SHA256(code_verifier))</code>.</li>
      <li>App mở <strong>trình duyệt hệ thống</strong> tới trang đăng nhập của IdP, kèm <code>code_challenge</code>, <code>state</code> ngẫu nhiên, <code>redirect_uri</code>.</li>
      <li>Người dùng đăng nhập <em>trên trang của IdP</em> (app không thấy mật khẩu).</li>
      <li>IdP redirect về app với <code>code</code> và <code>state</code>. App kiểm tra <code>state</code> khớp.</li>
      <li>App đổi <code>code</code> + <code>code_verifier</code> lấy token. IdP kiểm tra SHA256(verifier) = challenge đã nhận ở bước 2.</li>
    </ol>
    <p><strong>Vì sao PKCE?</strong> Nếu một app độc hại đăng ký cùng custom URL scheme và "cướp" được <code>code</code> ở bước 4, nó vẫn không đổi được token
    vì không có <code>code_verifier</code> (chỉ nằm trong bộ nhớ app thật). Luồng <em>Implicit</em> (trả token thẳng trong URL) và <em>Resource Owner Password</em> (app nhận mật khẩu) đã bị khuyến nghị không dùng.</p>

    <p><strong>3. System browser, KHÔNG phải WebView</strong></p>
    <table>
      <tr><th></th><th>WebView nhúng</th><th>System browser (Custom Tabs / ASWebAuthenticationSession)</th></tr>
      <tr><td>App đọc được mật khẩu?</td><td>Có — app host có thể chèn JS, đọc DOM, bắt phím</td><td>Không — chạy trong process trình duyệt</td></tr>
      <tr><td>Người dùng kiểm tra được URL/ổ khoá?</td><td>Không có thanh địa chỉ đáng tin</td><td>Có</td></tr>
      <tr><td>Dùng lại phiên đã đăng nhập, password manager, passkey</td><td>Không</td><td>Có</td></tr>
      <tr><td>IdP chấp nhận</td><td>Google và nhiều IdP <strong>chặn</strong> đăng nhập trong WebView</td><td>Có</td></tr>
    </table>
    <ul>
      <li>Android: <strong>Custom Tabs</strong> (thư viện AppAuth-Android làm sẵn). iOS: <strong>ASWebAuthenticationSession</strong> (AppAuth-iOS làm sẵn).</li>
      <li>React Native: <code>react-native-app-auth</code>, <code>expo-auth-session</code>. Flutter: <code>flutter_appauth</code>. Đều dùng system browser + PKCE.</li>
      <li>Đăng nhập Google/Apple: dùng SDK chính thức (Sign in with Apple, Credential Manager của Android) — server phải <strong>xác minh ID token</strong> (chữ ký, <code>aud</code>, <code>iss</code>, hạn).</li>
    </ul>

    <p><strong>4. Redirect URI</strong></p>
    <ul>
      <li>Tốt nhất: <strong>claimed HTTPS link</strong> — App Links (Android) / Universal Links (iOS) đã xác minh domain (bài 14). App khác không giành được.</li>
      <li>Chấp nhận được: custom scheme dạng reverse-domain (<code>com.shop.app:/oauth2redirect</code>) — <em>kèm PKCE bắt buộc</em>, vì scheme không độc quyền.</li>
      <li>IdP phải đăng ký chính xác redirect URI (không dùng wildcard).</li>
    </ul>

    <p><strong>5. Token nhận được và nơi lưu</strong></p>
    <ul>
      <li><strong>Access token</strong>: ngắn hạn (5–15 phút), giữ trong bộ nhớ là đủ; nếu cần qua lần khởi động thì Keychain/Keystore.</li>
      <li><strong>Refresh token</strong>: dài hơn, là "chìa khoá chủ" → chỉ lưu trong Keychain/Keystore (bài 04, 05), cân nhắc gắn sinh trắc học (bài 12), rotation (bài 13).</li>
      <li><strong>ID token</strong>: chỉ để app biết thông tin người dùng; không dùng làm access token gọi API.</li>
      <li>Không lưu token trong AsyncStorage, UserDefaults, SharedPreferences thường, không đưa vào URL, log, analytics.</li>
    </ul>

    <p><strong>6. Những điều khác cần có ở màn hình đăng nhập</strong>: rate limit + khoá tạm thời phía server, thông báo lỗi chung ("sai email hoặc mật khẩu"),
    hỗ trợ password manager (autofill), hỗ trợ passkey, MFA cho tài khoản nhạy cảm, không tự làm "ghi nhớ mật khẩu" bằng cách lưu mật khẩu.</p>

    <div class="callout"><p>💡 Tóm tắt một dòng cho mobile OAuth: <strong>Authorization Code + PKCE + system browser + claimed HTTPS redirect + refresh token trong Keychain/Keystore</strong>.
    Dùng thư viện AppAuth (hoặc bản bọc cho RN/Flutter) thay vì tự viết.</p></div>
  `,

  codeTabs: [
    { id: "pkce", label: "🔐 PKCE từng bước", lines: [
      "// 1. Sinh verifier + challenge (trong bộ nhớ, không lưu đĩa)",
      "verifier  = base64url(secureRandomBytes(32))",
      "challenge = base64url(sha256(verifier))",
      "state     = base64url(secureRandomBytes(16))",
      "",
      "// 2. Mở system browser",
      "openAuthSession('https://id.shop.com/authorize?response_type=code'",
      "  + '&client_id=shop-mobile&redirect_uri=https://shop.com/oauth/cb'",
      "  + '&scope=openid%20profile%20offline_access'",
      "  + '&code_challenge=' + challenge + '&code_challenge_method=S256&state=' + state)",
      "",
      "// 3. Nhận redirect",
      "onRedirect(url): require url.state == state",
      "",
      "// 4. Đổi code (không có client_secret — public client)",
      "tokens = POST /token { grant_type: 'authorization_code', code, code_verifier: verifier,",
      "                       client_id: 'shop-mobile', redirect_uri }"
    ]},
    { id: "webview", label: "❌ Đăng nhập trong WebView", lines: [
      "// Android — app host kiểm soát hoàn toàn WebView",
      "webView.settings.javaScriptEnabled = true",
      "webView.loadUrl(\"https://id.shop.com/login\")",
      "// App có thể chèn script đọc ô mật khẩu, người dùng không thấy URL thật,",
      "// không dùng được password manager/passkey, Google chặn luồng này",
      "",
      "// Luồng cũ không còn khuyến nghị:",
      "//  response_type=token      (Implicit: token nằm trong URL)",
      "//  grant_type=password      (app nhận mật khẩu người dùng)"
    ]},
    { id: "native", label: "📱 AppAuth native", lines: [
      "// Android (AppAuth) — Custom Tabs + PKCE tự động",
      "val request = AuthorizationRequest.Builder(serviceConfig, \"shop-mobile\",",
      "        ResponseTypeValues.CODE, Uri.parse(\"https://shop.com/oauth/cb\"))",
      "    .setScopes(\"openid\", \"profile\", \"offline_access\")",
      "    .build()",
      "launcher.launch(authService.getAuthorizationRequestIntent(request))",
      "",
      "// iOS (AppAuth / ASWebAuthenticationSession)",
      "let request = OIDAuthorizationRequest(configuration: config, clientId: \"shop-mobile\",",
      "    scopes: [OIDScopeOpenID, OIDScopeProfile, \"offline_access\"],",
      "    redirectURL: URL(string: \"https://shop.com/oauth/cb\")!,",
      "    responseType: OIDResponseTypeCode, additionalParameters: nil)",
      "session = OIDAuthState.authState(byPresenting: request, presenting: vc) { state, err in ... }"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// React Native — react-native-app-auth",
      "const result = await authorize({",
      "  issuer: 'https://id.shop.com', clientId: 'shop-mobile',",
      "  redirectUrl: 'com.shop.app:/oauth2redirect',   // scheme -> PKCE bắt buộc (mặc định bật)",
      "  scopes: ['openid', 'profile', 'offline_access'],",
      "})",
      "await Keychain.setGenericPassword('rt', result.refreshToken, { service: 'auth' })",
      "",
      "// Flutter — flutter_appauth",
      "final r = await appAuth.authorizeAndExchangeCode(AuthorizationTokenRequest(",
      "  'shop-mobile', 'com.shop.app:/oauth2redirect',",
      "  issuer: 'https://id.shop.com', scopes: ['openid', 'profile', 'offline_access']));",
      "await secureStorage.write(key: 'rt', value: r.refreshToken);"
    ]},
    { id: "server", label: "🖥️ Server xác minh", lines: [
      "// Đăng nhập Google/Apple: app gửi ID token, server PHẢI xác minh",
      "handle POST /auth/social (req):",
      "    claims = verifyJwt(req.idToken, jwks=providerKeys)   // chữ ký",
      "    require claims.iss in ['https://accounts.google.com', 'https://appleid.apple.com']",
      "    require claims.aud == OUR_CLIENT_ID",
      "    require claims.exp > now()",
      "    require claims.nonce == session.nonce              // chống replay",
      "    user = findOrCreateByProviderSubject(claims.iss, claims.sub)  // dùng sub, không dùng email",
      "    return issueOurTokens(user)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">sinh verifier + challenge + state</div></div>
    <div class="arrow" id="a1">↓ mở system browser (challenge)</div>
    <div class="node" id="browser"><div class="nl">🌐 Custom Tabs / ASWebAuthenticationSession</div><div class="ns">người dùng đăng nhập trên trang IdP</div></div>
    <div class="arrow" id="a2">↓ redirect: code + state</div>
    <div class="row">
      <div class="node" id="link"><div class="nl">🔗 Claimed HTTPS redirect</div><div class="ns">App/Universal Link đã xác minh</div></div>
      <div class="node" id="evil"><div class="nl">👾 App giành scheme</div><div class="ns">có code nhưng không có verifier</div></div>
    </div>
    <div class="arrow" id="a3">↓ code + verifier</div>
    <div class="node" id="idp"><div class="nl">🏛️ Token endpoint của IdP</div><div class="ns">kiểm SHA256(verifier) == challenge</div></div>
    <div class="arrow" id="a4">↓ access + refresh token</div>
    <div class="node" id="store"><div class="nl">🔑 Keychain / Keystore</div><div class="ns">refresh token</div></div>
  `,

  steps: [
    { title: "1 · Sinh PKCE và state", tab: "pkce", highlight: [2, 3, 4], on: ["app"],
      desc: "<code>code_verifier</code> là bí mật tạm thời chỉ app thật biết; server chỉ nhận bản băm (challenge). <code>state</code> chống giả mạo redirect." },
    { title: "2 · Mở system browser", tab: "pkce", highlight: [7, 8, 9, 10], on: ["a1", "browser"],
      desc: "Người dùng nhập mật khẩu trên trang IdP trong trình duyệt hệ thống: app không đọc được, người dùng thấy URL thật, dùng được password manager và passkey." },
    { title: "3 · Vì sao không dùng WebView", tab: "webview", highlight: [2, 3, 4, 5, 8, 9], on: ["browser"],
      desc: "WebView do app kiểm soát hoàn toàn — có thể đọc mật khẩu. Nhiều IdP chặn. Implicit và Password grant đã lỗi thời." },
    { title: "4 · Redirect về app", tab: "pkce", highlight: [13], on: ["a2", "link", "evil"],
      desc: "Claimed HTTPS link (App/Universal Link) là tốt nhất. Nếu dùng custom scheme, app độc hại có thể giành được <code>code</code> — nhưng PKCE làm code đó vô dụng." },
    { title: "5 · Đổi code bằng verifier", tab: "pkce", highlight: [16, 17], on: ["a3", "idp"],
      desc: "Không có client_secret (app là public client). IdP kiểm tra SHA256(verifier) khớp challenge → chỉ app đã bắt đầu luồng mới đổi được token." },
    { title: "6 · Dùng thư viện, lưu đúng chỗ", tab: "xplat", highlight: [2, 4, 7, 10, 13], on: ["a4", "store"],
      desc: "AppAuth / react-native-app-auth / flutter_appauth làm sẵn PKCE + system browser. Refresh token cất ngay vào Keychain/Keystore." },
    { title: "7 · Server xác minh ID token", tab: "server", highlight: [3, 4, 5, 6, 7, 8], on: ["idp"],
      desc: "Đăng nhập Google/Apple: server kiểm chữ ký, iss, aud, hạn, nonce, và định danh người dùng bằng <code>sub</code> (không bằng email)." }
  ],

  quiz: [
    { q: "Vì sao app mobile là 'public client' trong OAuth?", options: [
        "Vì app miễn phí",
        "Vì không thể giữ bí mật client_secret — mọi thứ trong gói đều có thể bị trích ra",
        "Vì app dùng HTTPS",
        "Vì app có nhiều người dùng"
      ], correct: 1,
      explanation: "Không có client_secret nên cần PKCE để bảo vệ bước đổi code lấy token." },
    { q: "PKCE bảo vệ khỏi kịch bản nào?", options: [
        "Người dùng quên mật khẩu",
        "App độc hại chặn được authorization code qua redirect nhưng không đổi được token vì thiếu code_verifier",
        "Server bị DDoS",
        "Token hết hạn"
      ], correct: 1,
      explanation: "Chỉ app thật có code_verifier; code bị chặn trở nên vô dụng." },
    { q: "Vì sao không nên hiển thị trang đăng nhập IdP trong WebView nhúng?", options: [
        "WebView chậm hơn",
        "App host có thể đọc mật khẩu, người dùng không kiểm tra được URL, không dùng được password manager; nhiều IdP chặn",
        "WebView không hỗ trợ HTTPS",
        "Apple cấm WebView"
      ], correct: 1,
      explanation: "System browser (Custom Tabs, ASWebAuthenticationSession) tách biệt khỏi app." },
    { q: "Redirect URI nào an toàn nhất cho app mobile?", options: [
        "myapp://callback",
        "Claimed HTTPS link đã xác minh domain (App Links / Universal Links)",
        "http://localhost",
        "Wildcard https://*.shop.com/*"
      ], correct: 1,
      explanation: "Custom scheme không độc quyền; claimed HTTPS link chỉ app sở hữu domain mới nhận được." },
    { q: "code_challenge được tính thế nào với phương thức S256?", options: [
        "Bằng chính code_verifier",
        "BASE64URL(SHA256(code_verifier))",
        "MD5(client_id)",
        "Mã hoá AES code_verifier"
      ], correct: 1,
      explanation: "Server nhận challenge trước, sau đó kiểm tra verifier khớp khi đổi token." },
    { q: "Tham số state trong OAuth dùng để làm gì?", options: [
        "Lưu trạng thái giỏ hàng",
        "Chống giả mạo redirect (CSRF): app chỉ chấp nhận redirect có state khớp giá trị đã sinh",
        "Chọn ngôn ngữ",
        "Mã hoá token"
      ], correct: 1,
      explanation: "state ngẫu nhiên gắn request đăng nhập với response tương ứng." },
    { q: "Refresh token nên lưu ở đâu?", options: [
        "AsyncStorage / UserDefaults",
        "Keychain / Keystore (qua secure storage)",
        "Trong URL",
        "Trong log để debug"
      ], correct: 1,
      explanation: "Refresh token là chìa khoá dài hạn, cần kho bảo mật của OS." },
    { q: "Server nhận ID token Google từ app. Điều nào KHÔNG đủ để tin?", options: [
        "Kiểm chữ ký với JWKS của Google",
        "Chỉ decode JWT và đọc email mà không kiểm chữ ký, aud, iss, hạn",
        "Kiểm aud bằng client ID của mình",
        "Kiểm hạn exp"
      ], correct: 1,
      explanation: "Decode không phải verify. Ai cũng tạo được JWT giả nếu server không kiểm chữ ký và các claim." },
    { q: "Luồng OAuth nào đã không còn được khuyến nghị cho app mobile?", options: [
        "Authorization Code + PKCE",
        "Implicit (response_type=token) và Resource Owner Password",
        "Refresh token grant",
        "Device authorization grant"
      ], correct: 1,
      explanation: "Implicit để token trong URL; Password grant buộc app xử lý mật khẩu người dùng." }
  ]
});
