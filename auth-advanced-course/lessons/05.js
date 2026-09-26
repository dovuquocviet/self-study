window.LESSONS.push({
  id: "05",
  phase: "2", phaseName: "OAuth 2.0 cốt lõi",
  title: "OAuth 2.0: 4 vai trò, 2 loại client, các grant type",
  subtitle: "Resource owner · Client · Authorization Server · Resource Server — và chọn grant nào",

  theory: `
    <p>OAuth 2.0 (RFC 6749) tự gọi mình là một <strong>framework</strong>: nó định nghĩa các vai trò, các endpoint và nhiều "grant type" (cách lấy token) —
    bạn chọn cái phù hợp loại ứng dụng.</p>

    <p><strong>4 vai trò</strong></p>
    <table>
      <tr><th>Vai trò</th><th>Là ai</th><th>Ví dụ "Login with Google để app đọc Google Drive"</th></tr>
      <tr><td><strong>Resource Owner</strong></td><td>Người sở hữu dữ liệu</td><td>Bạn</td></tr>
      <tr><td><strong>Client</strong></td><td>Ứng dụng muốn truy cập</td><td>App chỉnh ảnh</td></tr>
      <tr><td><strong>Authorization Server (AS)</strong></td><td>Xác thực user, hỏi đồng ý, phát token</td><td><code>accounts.google.com</code></td></tr>
      <tr><td><strong>Resource Server (RS)</strong></td><td>API giữ dữ liệu, kiểm tra token</td><td><code>www.googleapis.com/drive</code></td></tr>
    </table>

    <p><strong>2 endpoint của AS</strong>: <code>/authorize</code> (trình duyệt user đi qua, hiện màn hình đăng nhập/đồng ý) và <code>/token</code> (client gọi trực tiếp, server-to-server, để đổi lấy token).</p>

    <p><strong>2 loại client</strong></p>
    <ul>
      <li><strong>Confidential</strong> — giữ được bí mật: backend web, service. Có <code>client_secret</code> hoặc khoá riêng.</li>
      <li><strong>Public</strong> — không giữ được bí mật: SPA chạy trong trình duyệt, app mobile/desktop. Chỉ có <code>client_id</code>; phải dùng PKCE.</li>
    </ul>

    <p><strong>Grant types</strong></p>
    <table>
      <tr><th>Grant</th><th>Dùng khi</th><th>Trạng thái</th></tr>
      <tr><td><strong>Authorization Code (+ PKCE)</strong></td><td>Có user, mọi loại app (web, SPA, mobile)</td><td>✅ Mặc định</td></tr>
      <tr><td><strong>Client Credentials</strong></td><td>Máy-với-máy, không có user (cron job, microservice)</td><td>✅</td></tr>
      <tr><td><strong>Refresh Token</strong></td><td>Lấy access token mới khi hết hạn</td><td>✅</td></tr>
      <tr><td><strong>Device Code</strong> (RFC 8628)</td><td>Thiết bị không có trình duyệt/bàn phím: TV, CLI</td><td>✅</td></tr>
      <tr><td><strong>Token Exchange</strong> (RFC 8693), <strong>JWT Bearer</strong> (RFC 7523)</td><td>Đổi token giữa các service / dùng assertion</td><td>✅ nâng cao</td></tr>
      <tr><td>Implicit (<code>response_type=token</code>)</td><td>SPA thời trước CORS — token trả thẳng trên URL</td><td>❌ Bỏ trong OAuth 2.1</td></tr>
      <tr><td>Resource Owner Password Credentials</td><td>App nhận thẳng mật khẩu user</td><td>❌ Bỏ trong OAuth 2.1</td></tr>
    </table>

    <div class="callout"><p>💡 Cây quyết định 3 câu: <strong>Có user không?</strong> Không → Client Credentials. Có → <strong>thiết bị có trình duyệt không?</strong> Không → Device Code.
    Có → <strong>Authorization Code + PKCE</strong> (bất kể web, SPA hay mobile).</p></div>
  `,

  codeTabs: [
    { id: "code", label: "Authorization Code", lines: [
      "# 1) Trình duyệt -> AS",
      "GET /authorize?response_type=code&client_id=photo-app",
      "    &redirect_uri=https://photo.app/cb&scope=drive.readonly",
      "    &state=af0ifjsldkj&code_challenge=E9Mel...&code_challenge_method=S256",
      "",
      "# 2) AS -> trình duyệt -> client",
      "302 Location: https://photo.app/cb?code=SplxlOBeZQQYbYS6WxSbIA&state=af0ifjsldkj",
      "",
      "# 3) Client -> AS (back-channel)",
      "POST /token  grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA",
      "             &redirect_uri=https://photo.app/cb&code_verifier=dBjftJeZ4CVP..."
    ]},
    { id: "cc", label: "Client Credentials", lines: [
      "# Không có user: service tự lấy token cho chính nó",
      "POST /token HTTP/1.1",
      "Authorization: Basic base64(client_id:client_secret)",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "grant_type=client_credentials&scope=orders.sync",
      "",
      "HTTP/1.1 200 OK",
      "{ \"access_token\": \"eyJ...\", \"token_type\": \"Bearer\", \"expires_in\": 3600 }",
      "# Thường KHÔNG có refresh_token: hết hạn thì xin lại"
    ]},
    { id: "dead", label: "❌ Grant đã khai tử", lines: [
      "# Implicit: token nằm trên URL fragment -> lọt history, log, Referer",
      "GET /authorize?response_type=token&client_id=spa&redirect_uri=...",
      "302 Location: https://spa.app/cb#access_token=eyJ...&token_type=Bearer",
      "",
      "# Password grant: app thấy mật khẩu user -> mất ý nghĩa của OAuth",
      "POST /token  grant_type=password&username=an&password=s3cret",
      "",
      "# Thay bằng: Authorization Code + PKCE"
    ]},
    { id: "resp", label: "Token response", lines: [
      "HTTP/1.1 200 OK",
      "Content-Type: application/json",
      "Cache-Control: no-store",
      "",
      "{",
      "  \"access_token\":  \"eyJhbGciOiJSUzI1NiJ9...\",",
      "  \"token_type\":    \"Bearer\",",
      "  \"expires_in\":    900,",
      "  \"refresh_token\": \"8xLOxBtZp8\",",
      "  \"scope\":         \"drive.readonly\"",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ro"><div class="nl">🙋 Resource Owner</div><div class="ns">user</div></div>
      <div class="node" id="cl"><div class="nl">📱 Client</div><div class="ns">public / confidential</div></div>
    </div>
    <div class="arrow" id="a1">↓ /authorize (front-channel) · /token (back-channel)</div>
    <div class="node" id="as"><div class="nl">🏛️ Authorization Server</div><div class="ns">đăng nhập · đồng ý · phát token</div></div>
    <div class="arrow" id="a2">↓ access token</div>
    <div class="node" id="rs"><div class="nl">📡 Resource Server (API)</div><div class="ns">kiểm tra token + scope</div></div>
  `,
  steps: [
    { title: "1 · Client gửi user tới AS", tab: "code", highlight: [2, 3, 4], on: ["ro", "cl", "a1", "as"],
      desc: "Qua trình duyệt (front-channel). Khai client_id, redirect_uri, scope, state, và PKCE challenge." },
    { title: "2 · AS trả code, client đổi lấy token", tab: "code", highlight: [7, 10, 11], on: ["as", "cl"],
      desc: "Code đi qua trình duyệt nhưng vô dụng nếu thiếu code_verifier. Việc đổi code lấy token đi back-channel." },
    { title: "3 · Token response", tab: "resp", highlight: [3, 6, 8, 9, 10], on: ["as", "a2"],
      desc: "access_token, thời hạn, refresh_token và scope thực sự được cấp (có thể ít hơn scope xin)." },
    { title: "4 · Máy-với-máy", tab: "cc", highlight: [3, 6, 10], on: ["cl", "as"],
      desc: "Không có user thì dùng Client Credentials: client tự xác thực bằng secret/khoá, nhận token cho chính nó." },
    { title: "5 · Hai grant đã bị khai tử", tab: "dead", highlight: [1, 3, 5, 6, 8], on: ["cl"],
      desc: "Implicit để lộ token trên URL; password grant cho app thấy mật khẩu. OAuth 2.1 loại cả hai." },
    { title: "6 · API kiểm tra token", tab: "resp", highlight: [6, 10], on: ["rs"],
      desc: "Resource Server xác minh token (chữ ký JWT hoặc introspection), rồi kiểm tra scope có đủ cho endpoint không." }
  ],

  quiz: [
    { q: "Trong OAuth 2, ai phát access token?", options: [
        "Resource Server", "Authorization Server", "Client", "Resource Owner"
      ], correct: 1, explanation: "AS xác thực user, lấy sự đồng ý và phát token. RS chỉ kiểm tra token." },
    { q: "SPA React chạy trong trình duyệt thuộc loại client nào?", options: [
        "Confidential", "Public", "Resource Server", "Không phải client"
      ], correct: 1, explanation: "Code chạy trên máy user không giữ được secret → public client, bắt buộc PKCE." },
    { q: "Cron job đồng bộ đơn hàng giữa 2 service, không có user. Grant nào?", options: [
        "Authorization Code", "Client Credentials", "Device Code", "Implicit"
      ], correct: 1, explanation: "Không có user thì client tự lấy token cho chính nó bằng Client Credentials." },
    { q: "Smart TV cần đăng nhập tài khoản streaming. Grant nào phù hợp?", options: [
        "Password grant", "Device Code", "Client Credentials", "Implicit"
      ], correct: 1, explanation: "Device Code: TV hiện mã, user duyệt trên điện thoại (bài 14)." },
    { q: "Vì sao Implicit grant bị bỏ?", options: [
        "Vì quá chậm",
        "Access token trả thẳng trên URL (fragment) — dễ lọt vào history, log, bị chặn giữa đường; không có cơ chế ràng buộc",
        "Vì không hỗ trợ scope",
        "Vì cần client_secret"
      ], correct: 1, explanation: "Authorization Code + PKCE giải quyết cùng nhu cầu cho SPA mà an toàn hơn." },
    { q: "Endpoint nào trình duyệt user đi qua?", options: [
        "/token", "/authorize", "/introspect", "/jwks"
      ], correct: 1, explanation: "/authorize là front-channel. /token là back-channel do client gọi trực tiếp." },
    { q: "Password grant (ROPC) có vấn đề gì?", options: [
        "Không trả refresh token",
        "App thu mật khẩu user — mất mục tiêu cốt lõi của OAuth, không hỗ trợ MFA/SSO tốt",
        "Không dùng được HTTPS",
        "Chỉ dùng cho TV"
      ], correct: 1, explanation: "OAuth ra đời để app KHÔNG cần thấy mật khẩu." },
    { q: "Token response có header Cache-Control: no-store. Vì sao?", options: [
        "Để response nhanh hơn",
        "Để proxy/trình duyệt không lưu cache response chứa token",
        "Bắt buộc với mọi response JSON",
        "Để bật CORS"
      ], correct: 1, explanation: "RFC 6749 yêu cầu no-store cho response chứa token." },
    { q: "Client xin scope 'drive' nhưng response trả scope 'drive.readonly'. Nghĩa là?", options: [
        "Lỗi, phải bỏ qua",
        "AS/user chỉ cấp quyền hẹp hơn; client phải tôn trọng scope thực tế được cấp",
        "Token vô hiệu",
        "Client được toàn quyền"
      ], correct: 1, explanation: "Scope trong response là nguồn sự thật về quyền đã cấp." }
  ]
});
