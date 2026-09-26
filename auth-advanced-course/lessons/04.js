window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "OAuth 1.0a",
  title: "OAuth 1.0a vs OAuth 2.0 — khác nhau ở đâu, vì sao đổi",
  subtitle: "Chữ ký vs bearer · 1 luồng vs nhiều grant · token sống lâu vs access + refresh",

  theory: `
    <p>OAuth 2.0 <strong>không phải bản nâng cấp tương thích</strong> của OAuth 1.0a — nó là một giao thức viết lại từ đầu với cùng mục tiêu (uỷ quyền),
    nhưng triết lý khác hẳn: <em>đẩy độ phức tạp từ client sang TLS và authorization server</em>.</p>

    <table>
      <tr><th>Tiêu chí</th><th>OAuth 1.0a</th><th>OAuth 2.0</th></tr>
      <tr><td>Bảo vệ request</td><td>Chữ ký HMAC/RSA trên <em>từng request</em></td><td>Bearer token, dựa vào <strong>TLS</strong>; không ký</td></tr>
      <tr><td>Credential của client</td><td>4 chuỗi: consumer key/secret + token/token secret</td><td>client_id (+ client_secret nếu là confidential client) + access token</td></tr>
      <tr><td>Token</td><td>Access token thường sống lâu, không có refresh chuẩn</td><td>Access token sống ngắn + <strong>refresh token</strong></td></tr>
      <tr><td>Luồng</td><td>Một luồng 3-legged (+ biến thể 2-legged)</td><td>Nhiều <strong>grant type</strong>: authorization code, client credentials, device code, refresh…</td></tr>
      <tr><td>Loại client</td><td>Chủ yếu web server giữ được secret</td><td>Web, SPA, mobile, TV, máy-với-máy (public & confidential client)</td></tr>
      <tr><td>Vai trò server</td><td>Một server làm tất cả</td><td>Tách <strong>Authorization Server</strong> (phát token) và <strong>Resource Server</strong> (API)</td></tr>
      <tr><td>Phạm vi quyền</td><td>Không chuẩn hoá (tuỳ provider)</td><td><code>scope</code> chuẩn hoá</td></tr>
      <tr><td>Độ khó implement client</td><td>Cao — ký sai 1 ký tự là 401</td><td>Thấp — gắn header <code>Bearer</code></td></tr>
      <tr><td>Token bị lộ</td><td>Chưa đủ: còn thiếu 2 secret để ký</td><td>Đủ để dùng tới khi hết hạn (bearer) — trừ khi dùng DPoP/mTLS</td></tr>
      <tr><td>Chuẩn</td><td>RFC 5849 (2010)</td><td>RFC 6749 + 6750 (2012), là một <em>framework</em> mở rộng bằng nhiều RFC</td></tr>
    </table>

    <p><strong>Vì sao cộng đồng chuyển sang OAuth 2?</strong></p>
    <ul>
      <li>Chữ ký là nguồn lỗi tích hợp số 1; TLS đã phổ biến nên chữ ký theo request không còn quá cần thiết cho đa số API.</li>
      <li>App mobile/SPA không giữ được secret → OAuth 1 không có câu trả lời tốt; OAuth 2 có public client + PKCE.</li>
      <li>Hệ thống lớn cần tách máy chủ phát token khỏi hàng trăm API.</li>
    </ul>
    <p><strong>OAuth 2 trả giá gì?</strong> Bearer token bị trộm là dùng được, và vì là "framework" nên có nhiều cách cấu hình sai. Các chuẩn về sau
    (PKCE, OAuth 2.1, DPoP, mTLS, PAR) chính là để lấp lại những chỗ đó — thú vị là DPoP đưa <em>chữ ký theo request</em> quay trở lại, nhưng dùng khoá bất đối xứng và JWT.</p>

    <p><strong>Khi nào vẫn gặp OAuth 1.0a?</strong> Magento 2 Integration, WooCommerce (HTTP), X API v1.1, Trello, Tumblr, Flickr, Garmin, NetSuite TBA, Jira/Confluence Application Link, LTI 1.1.
    Không có lý do để chọn OAuth 1.0a cho hệ thống mới.</p>

    <div class="callout"><p>💡 Tóm một câu: <strong>OAuth 1.0a bảo vệ bằng chữ ký trên từng request; OAuth 2.0 bảo vệ bằng TLS + token sống ngắn, đổi lại đơn giản và linh hoạt hơn nhiều.</strong></p></div>
  `,

  codeTabs: [
    { id: "o1", label: "OAuth 1.0a", lines: [
      "# Client phải: gom tham số, encode, sắp xếp, dựng base string, HMAC, base64",
      "GET /api/orders HTTP/1.1",
      "Authorization: OAuth oauth_consumer_key=\"ck123\", oauth_token=\"at456\",",
      "  oauth_signature_method=\"HMAC-SHA1\", oauth_timestamp=\"1790000000\",",
      "  oauth_nonce=\"k9f3a1x7\", oauth_version=\"1.0\",",
      "  oauth_signature=\"wFLbhjPZX1e7NQuBSJzXnSOkWmk%3D\"",
      "",
      "# Nghe lén được header này? Không sửa được request, không gửi lại được (nonce)"
    ]},
    { id: "o2", label: "OAuth 2.0", lines: [
      "# Client chỉ cần gắn token",
      "GET /api/orders HTTP/1.1",
      "Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...",
      "",
      "# Nghe lén được header này (nếu không có TLS)? Dùng được ngay tới khi hết hạn",
      "# => bắt buộc HTTPS, token sống ngắn (vd 5-60 phút), refresh token để lấy token mới"
    ]},
    { id: "refresh", label: "Refresh (chỉ OAuth 2)", lines: [
      "POST /oauth/token HTTP/1.1",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "grant_type=refresh_token&refresh_token=8xLOxBtZp8&client_id=shop-web",
      "",
      "HTTP/1.1 200 OK",
      "{ \"access_token\": \"eyJ...mới\", \"expires_in\": 900, \"refresh_token\": \"9yMPyCuAq9\" }"
    ]},
    { id: "map", label: "Quy đổi thuật ngữ", lines: [
      "OAuth 1.0a                      OAuth 2.0",
      "-----------------------------   -----------------------------",
      "Consumer Key                 -> client_id",
      "Consumer Secret              -> client_secret (chỉ confidential client)",
      "Request token (tạm)          -> authorization code",
      "oauth_verifier               -> (gộp vào code) + state / PKCE",
      "Access Token + Token Secret  -> access_token (bearer) [+ refresh_token]",
      "Service Provider             -> Authorization Server + Resource Server"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="v1"><div class="nl">OAuth 1.0a</div><div class="ns">chữ ký mỗi request · 4 chuỗi · 1 luồng</div></div>
      <div class="node" id="v2"><div class="nl">OAuth 2.0</div><div class="ns">bearer + TLS · nhiều grant · refresh</div></div>
    </div>
    <div class="arrow" id="a1">↓ cái giá của sự đơn giản</div>
    <div class="node" id="gap"><div class="nl">⚠️ Bearer bị trộm = dùng được</div><div class="ns">nhiều cách cấu hình sai</div></div>
    <div class="arrow" id="a2">↓ vá bằng</div>
    <div class="node" id="fix"><div class="nl">🛡️ PKCE · OAuth 2.1 · DPoP · mTLS · PAR</div><div class="ns">DPoP đưa chữ ký quay lại (bằng JWT)</div></div>
  `,
  steps: [
    { title: "1 · OAuth 1.0a: ký từng request", tab: "o1", highlight: [1, 3, 6, 8], on: ["v1"],
      desc: "Client làm nhiều việc; đổi lại header bị nghe lén cũng không sửa hay phát lại được." },
    { title: "2 · OAuth 2.0: gắn token là xong", tab: "o2", highlight: [1, 3, 5, 6], on: ["v2"],
      desc: "Không ký. Toàn bộ an toàn trên đường truyền giao cho TLS; token sống ngắn để giới hạn thiệt hại khi lộ." },
    { title: "3 · Refresh token — thứ OAuth 1 không có", tab: "refresh", highlight: [4, 7], on: ["v2"],
      desc: "Access token hết hạn nhanh, client dùng refresh token lấy token mới mà không bắt user đăng nhập lại." },
    { title: "4 · Quy đổi thuật ngữ", tab: "map", highlight: [3, 4, 5, 7, 8], on: ["v1", "v2"],
      desc: "Consumer key ≈ client_id, request token ≈ authorization code, provider tách thành AS + RS." },
    { title: "5 · Cái giá và cách vá", tab: "o2", highlight: [5], on: ["a1", "gap", "a2", "fix"],
      desc: "Bearer bị trộm là dùng được. Các chuẩn sau này (bài 11–13) vá chỗ này; DPoP thậm chí đưa lại ý tưởng ký theo request." }
  ],

  quiz: [
    { q: "Khác biệt cốt lõi nhất giữa OAuth 1.0a và OAuth 2.0?", options: [
        "OAuth 2 dùng XML",
        "OAuth 1.0a ký từng request; OAuth 2.0 dùng bearer token dựa vào TLS",
        "OAuth 1.0a không cần user đồng ý",
        "OAuth 2.0 chỉ dành cho mobile"
      ], correct: 1, explanation: "Chữ ký theo request vs bearer + TLS là khác biệt nền tảng." },
    { q: "OAuth 2.0 có tương thích ngược với OAuth 1.0a không?", options: [
        "Có hoàn toàn",
        "Không — là giao thức viết lại, cùng mục tiêu nhưng khác cơ chế",
        "Có, chỉ cần đổi header",
        "Chỉ tương thích với HMAC-SHA1"
      ], correct: 1, explanation: "Client OAuth 1 không nói chuyện được với server OAuth 2 và ngược lại." },
    { q: "Consumer Key trong OAuth 1.0a tương ứng gì trong OAuth 2.0?", options: [
        "access_token", "client_id", "refresh_token", "scope"
      ], correct: 1, explanation: "Cả hai định danh ứng dụng client." },
    { q: "Thứ nào có trong OAuth 2.0 nhưng OAuth 1.0a không chuẩn hoá?", options: [
        "Consumer secret", "Refresh token và scope", "Nonce", "Chữ ký HMAC"
      ], correct: 1, explanation: "OAuth 2 có refresh token, scope, và nhiều grant type chuẩn." },
    { q: "Lộ một access token OAuth 2 (bearer) thì sao?", options: [
        "Không dùng được vì thiếu secret",
        "Ai cầm cũng dùng được tới khi hết hạn/bị thu hồi — trừ khi token gắn khoá (DPoP/mTLS)",
        "Tự động bị vô hiệu",
        "Chỉ dùng được trên cùng IP"
      ], correct: 1, explanation: "Bearer = người cầm. Vì vậy cần TLS, thời hạn ngắn, hoặc sender-constrained token." },
    { q: "Lộ riêng Access Token của OAuth 1.0a (không lộ secret) thì sao?", options: [
        "Dùng được ngay như bearer",
        "Chưa đủ để gọi API — còn cần consumer secret và token secret để ký",
        "Lộ luôn mật khẩu user",
        "Server tự đổi token"
      ], correct: 1, explanation: "Token OAuth 1 chỉ là phần định danh; không có secret thì không ký được." },
    { q: "Vì sao OAuth 2 phù hợp app mobile/SPA hơn OAuth 1.0a?", options: [
        "Vì OAuth 2 nhanh hơn",
        "Vì có khái niệm public client (không giữ secret) + PKCE; OAuth 1 giả định client giữ được secret",
        "Vì OAuth 1 không chạy trên HTTPS",
        "Vì OAuth 2 không cần user đồng ý"
      ], correct: 1, explanation: "Secret nhúng trong app mobile/JS luôn bị lấy ra được." },
    { q: "Chuẩn hiện đại nào đưa ý tưởng 'ký theo request' quay lại OAuth 2?", options: [
        "SAML", "DPoP", "SCIM", "Implicit grant"
      ], correct: 1, explanation: "DPoP: client ký một JWT proof cho mỗi request bằng khoá riêng." },
    { q: "Hệ thống mới cần uỷ quyền API. Nên chọn?", options: [
        "OAuth 1.0a",
        "OAuth 2.x (theo OAuth 2.1/Security BCP)",
        "Gửi mật khẩu user trong mỗi request",
        "API key dùng chung cho mọi user"
      ], correct: 1, explanation: "OAuth 1.0a chỉ còn để tích hợp hệ thống cũ." }
  ]
});
