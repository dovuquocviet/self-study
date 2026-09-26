window.LESSONS.push({
  id: "02",
  phase: "1", phaseName: "OAuth 1.0a",
  title: "OAuth 1.0a — bộ 4 chuỗi credential là gì?",
  subtitle: "Consumer Key · Consumer Secret · Access Token · Access Token Secret — và luồng 3 bên sinh ra chúng",

  theory: `
    <p>Nếu bạn từng tạo một <em>Integration</em> trong Magento 2 admin, một app trên X (Twitter) API cũ, hay kết nối Trello, Tumblr, Flickr, Garmin, Jira Server
    (Application Link), bạn sẽ nhận đúng <strong>4 chuỗi</strong>. Đó là OAuth 1.0a (RFC 5849).</p>

    <p><strong>4 chuỗi = 2 cặp (định danh, bí mật)</strong></p>
    <table>
      <tr><th>Chuỗi</th><th>Tên trong spec</th><th>Đại diện cho</th><th>Gửi lên mạng?</th></tr>
      <tr><td><strong>Consumer Key</strong></td><td>client identifier (<code>oauth_consumer_key</code>)</td><td><em>Ứng dụng</em> — "tôi là app X"</td><td>✅ có, mỗi request</td></tr>
      <tr><td><strong>Consumer Secret</strong></td><td>client shared-secret</td><td>Bí mật của ứng dụng</td><td>❌ không bao giờ — chỉ dùng để ký</td></tr>
      <tr><td><strong>Access Token</strong></td><td>token identifier (<code>oauth_token</code>)</td><td><em>Quyền của một user cụ thể</em> đã cấp cho app</td><td>✅ có, mỗi request</td></tr>
      <tr><td><strong>Access Token Secret</strong></td><td>token shared-secret</td><td>Bí mật đi kèm token đó</td><td>❌ không bao giờ — chỉ dùng để ký</td></tr>
    </table>
    <p>Hai cặp này trả lời hai câu hỏi: <strong>app nào đang gọi?</strong> (consumer) và <strong>thay mặt user nào, với quyền gì?</strong> (token).
    Khoá ký HMAC chính là <code>consumer_secret &amp; token_secret</code> ghép lại (bài sau).</p>

    <p><strong>Chúng được sinh ra thế nào — luồng 3 bên (3-legged)</strong></p>
    <ol>
      <li><strong>Đăng ký app</strong> với nhà cung cấp → nhận Consumer Key + Consumer Secret (một lần).</li>
      <li><strong>Temporary credentials</strong>: app gọi <code>POST /oauth/request_token</code> (ký bằng consumer secret, kèm <code>oauth_callback</code>) → nhận <em>request token</em> + request token secret tạm.</li>
      <li><strong>User đồng ý</strong>: app chuyển user tới <code>/oauth/authorize?oauth_token=...</code>. User đăng nhập, bấm "Cho phép". Nhà cung cấp redirect về callback kèm <code>oauth_verifier</code>.</li>
      <li><strong>Đổi lấy token thật</strong>: app gọi <code>POST /oauth/access_token</code> với request token + <code>oauth_verifier</code> (ký bằng consumer secret + request token secret) → nhận <strong>Access Token + Access Token Secret</strong>.</li>
      <li>Từ đây, mọi lời gọi API đều ký bằng cả hai secret.</li>
    </ol>
    <p>Chữ <strong>"a"</strong> trong 1.0a: bản 1.0 (2007) có lỗ hổng session fixation năm 2009 — kẻ tấn công lừa nạn nhân duyệt request token của mình.
    Bản 1.0a thêm <code>oauth_verifier</code> và bắt đăng ký <code>oauth_callback</code> ngay từ bước 2 để vá.</p>

    <p><strong>Vì sao đôi khi bạn nhận luôn đủ 4 chuỗi mà không qua luồng trên?</strong> Khi app là của chính bạn và user là chính bạn
    (vd Magento admin tạo Integration rồi bấm "Activate", X developer portal có nút "Generate access token"), nhà cung cấp chạy tắt bước 2–4 và đưa luôn token cho tài khoản của bạn.
    Có biến thể <strong>2-legged</strong> chỉ dùng consumer key/secret (không token user) — ví dụ WooCommerce REST API qua HTTP thường, hay LTI trong giáo dục.</p>

    <div class="callout"><p>💡 Trả lời sếp trong một câu: <em>"Đó là credential OAuth 1.0a: cặp consumer định danh ứng dụng, cặp access token định danh quyền user cấp cho ứng dụng;
    hai secret không gửi đi mà dùng làm khoá HMAC để ký từng request."</em></p></div>
  `,

  codeTabs: [
    { id: "creds", label: "🔑 4 chuỗi", lines: [
      "# Ví dụ: Magento 2 Admin > System > Integrations > Activate",
      "Consumer Key:         0a1b2c3d4e5f60718293a4b5c6d7e8f9",
      "Consumer Secret:      9f8e7d6c5b4a39281706f5e4d3c2b1a0",
      "Access Token:         q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6",
      "Access Token Secret:  z9x8c7v6b5n4m3l2k1j0h9g8f7d6s5a4",
      "",
      "# Gửi lên mạng:   Consumer Key, Access Token (dạng oauth_consumer_key, oauth_token)",
      "# Giữ bí mật:     Consumer Secret, Access Token Secret (chỉ dùng làm khoá ký)",
      "# Khoá HMAC  =    percentEncode(consumer_secret) + '&' + percentEncode(token_secret)"
    ]},
    { id: "step1", label: "① request_token", lines: [
      "POST /oauth/request_token HTTP/1.1",
      "Host: provider.example.com",
      "Authorization: OAuth oauth_consumer_key=\"0a1b...\",",
      "    oauth_callback=\"https%3A%2F%2Fapp.example.com%2Fcb\",",
      "    oauth_signature_method=\"HMAC-SHA1\", oauth_timestamp=\"1790000000\",",
      "    oauth_nonce=\"n1\", oauth_version=\"1.0\", oauth_signature=\"...\"",
      "",
      "HTTP/1.1 200 OK",
      "oauth_token=rt_abc&oauth_token_secret=rts_xyz&oauth_callback_confirmed=true"
    ]},
    { id: "step2", label: "② authorize", lines: [
      "# Trình duyệt user được chuyển tới:",
      "GET /oauth/authorize?oauth_token=rt_abc",
      "",
      "# User đăng nhập + bấm 'Cho phép', provider redirect về:",
      "GET https://app.example.com/cb?oauth_token=rt_abc&oauth_verifier=v_789",
      "",
      "# oauth_verifier = phần 'a' trong 1.0a (vá lỗi session fixation 2009)"
    ]},
    { id: "step3", label: "③ access_token", lines: [
      "POST /oauth/access_token HTTP/1.1",
      "Authorization: OAuth oauth_consumer_key=\"0a1b...\", oauth_token=\"rt_abc\",",
      "    oauth_verifier=\"v_789\", oauth_signature_method=\"HMAC-SHA1\", ...",
      "    oauth_signature=\"...\"   # khoá ký = consumer_secret & rts_xyz",
      "",
      "HTTP/1.1 200 OK",
      "oauth_token=q1w2e3...&oauth_token_secret=z9x8c7...",
      "",
      "# => Access Token + Access Token Secret: đủ bộ 4 chuỗi"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="app"><div class="nl">📱 App (consumer)</div><div class="ns">consumer key + secret</div></div>
      <div class="node" id="prov"><div class="nl">🏢 Provider</div><div class="ns">Magento · X · Trello…</div></div>
    </div>
    <div class="arrow" id="a1">① request token tạm</div>
    <div class="node" id="user"><div class="nl">🙋 User</div><div class="ns">đăng nhập & bấm Cho phép</div></div>
    <div class="arrow" id="a2">② oauth_verifier về callback</div>
    <div class="node" id="tok"><div class="nl">🎟️ Access Token + Token Secret</div><div class="ns">③ đổi request token + verifier</div></div>
    <div class="arrow" id="a3">↓ mọi request ký bằng 2 secret</div>
    <div class="node" id="api"><div class="nl">📡 API call đã ký</div><div class="ns">Authorization: OAuth …</div></div>
  `,
  steps: [
    { title: "1 · Hai cặp định danh + bí mật", tab: "creds", highlight: [2, 3, 4, 5], on: ["app", "tok"],
      desc: "Consumer = ứng dụng. Token = quyền của một user cấp cho ứng dụng đó. Mỗi cặp có một phần công khai và một phần bí mật." },
    { title: "2 · Cái gì đi trên dây", tab: "creds", highlight: [7, 8, 9], on: ["api"],
      desc: "Chỉ key và token đi trên mạng. Hai secret ghép thành khoá HMAC để ký — đây là khác biệt cốt lõi với OAuth 2." },
    { title: "3 · Xin request token tạm", tab: "step1", highlight: [1, 3, 4, 9], on: ["app", "a1", "prov"],
      desc: "App ký bằng consumer secret, khai <code>oauth_callback</code> ngay từ đầu. Nhận về request token + secret tạm." },
    { title: "4 · User cho phép", tab: "step2", highlight: [2, 5, 7], on: ["user", "a2"],
      desc: "User duyệt trên trang của provider — app không bao giờ thấy mật khẩu. Provider trả <code>oauth_verifier</code> về callback." },
    { title: "5 · Đổi lấy access token thật", tab: "step3", highlight: [2, 3, 4, 7, 9], on: ["tok", "a3"],
      desc: "Ký bằng consumer secret + request token secret, kèm verifier. Nhận Access Token + Access Token Secret — đủ bộ 4 chuỗi." },
    { title: "6 · Gọi API", tab: "creds", highlight: [9], on: ["api", "prov"],
      desc: "Từ đây mỗi request đều mang chữ ký tính từ cả hai secret. Token của OAuth 1.0a thường sống lâu (tới khi bị thu hồi)." }
  ],

  quiz: [
    { q: "Trong bộ 4 chuỗi OAuth 1.0a, cặp nào định danh ỨNG DỤNG?", options: [
        "Access Token + Access Token Secret",
        "Consumer Key + Consumer Secret",
        "Consumer Key + Access Token",
        "Consumer Secret + Access Token Secret"
      ], correct: 1, explanation: "Consumer = client application. Token = quyền của user cấp cho app." },
    { q: "Chuỗi nào KHÔNG bao giờ được gửi qua mạng khi gọi API?", options: [
        "Consumer Key và Access Token",
        "Consumer Secret và Access Token Secret",
        "Chỉ Access Token",
        "Cả 4 đều được gửi"
      ], correct: 1, explanation: "Hai secret chỉ dùng làm khoá HMAC để tính oauth_signature." },
    { q: "Khoá dùng cho chữ ký HMAC-SHA1 trong OAuth 1.0a được tạo thế nào?", options: [
        "consumer_key + access_token",
        "percentEncode(consumer_secret) & percentEncode(token_secret)",
        "SHA1(password)",
        "Base64 của consumer secret"
      ], correct: 1, explanation: "Hai secret đã percent-encode nối bằng dấu &. Khi chưa có token (bước request_token), phần sau & để trống." },
    { q: "Chữ 'a' trong OAuth 1.0a bổ sung gì?", options: [
        "Thuật toán RSA",
        "oauth_verifier và oauth_callback khai từ bước đầu — vá lỗi session fixation",
        "Refresh token",
        "Hỗ trợ JSON"
      ], correct: 1, explanation: "Năm 2009 phát hiện lỗi session fixation ở OAuth 1.0; 1.0a vá bằng verifier." },
    { q: "Thứ tự đúng của luồng 3-legged OAuth 1.0a?", options: [
        "access_token → authorize → request_token",
        "request_token → authorize (user duyệt) → access_token",
        "authorize → request_token → access_token",
        "Chỉ cần gọi access_token"
      ], correct: 1, explanation: "Xin token tạm, user duyệt, đổi token tạm + verifier lấy access token." },
    { q: "Magento admin tạo Integration rồi hiện ngay đủ 4 chuỗi. Vì sao không cần luồng 3 bên?", options: [
        "Vì Magento không dùng OAuth",
        "Vì app và user đều là chính bạn, provider cấp tắt access token cho tài khoản của bạn",
        "Vì 4 chuỗi là mật khẩu",
        "Vì luồng 3 bên đã bị bỏ khỏi OAuth 1"
      ], correct: 1, explanation: "Khi người tạo app cũng là người cấp quyền, provider có thể tạo sẵn token (giống nút 'Generate access token' của X)." },
    { q: "OAuth 1.0a '2-legged' khác 3-legged thế nào?", options: [
        "Không có chữ ký",
        "Chỉ dùng consumer key/secret, không có token của user",
        "Dùng 2 server",
        "Chỉ chạy trên mobile"
      ], correct: 1, explanation: "2-legged: app tự gọi API với danh nghĩa chính nó (vd WooCommerce REST qua HTTP, LTI)." },
    { q: "Lỡ commit Access Token Secret lên git. Nên làm gì?", options: [
        "Không sao vì nó không gửi qua mạng",
        "Thu hồi/tạo lại token (và consumer secret nếu cũng lộ) ngay tại provider",
        "Đổi tên biến",
        "Xoá commit là đủ"
      ], correct: 1, explanation: "Có consumer secret + token secret là ký được request hợp lệ. Thu hồi trước, dọn lịch sử sau." },
    { q: "User có phải đưa mật khẩu cho app trong OAuth 1.0a không?", options: [
        "Có, app gửi mật khẩu kèm mỗi request",
        "Không — user đăng nhập và đồng ý trên trang của provider",
        "Có, trong bước request_token",
        "Chỉ khi dùng 2-legged"
      ], correct: 1, explanation: "Mục tiêu gốc của OAuth: app được quyền mà không bao giờ thấy mật khẩu." }
  ]
});
