window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "OAuth 2.0",
  title: "Authorization Code flow — luồng chuẩn của OAuth 2",
  subtitle: "4 vai diễn và điệu nhảy đổi 'code' lấy 'token'",

  theory: `
    <p>OAuth 2 định nghĩa <strong>4 vai</strong> (roles) — thuộc lòng 4 vai này thì đọc tài liệu nào cũng hiểu:</p>
    <ul>
      <li><strong>Resource Owner</strong> — chủ dữ liệu: chính là <em>bạn</em>.</li>
      <li><strong>Client</strong> — app muốn dùng dữ liệu: app in ảnh, mobile app, website…</li>
      <li><strong>Authorization Server</strong> — nơi đăng nhập &amp; phát token: accounts.google.com.</li>
      <li><strong>Resource Server</strong> — API giữ dữ liệu: photos.googleapis.com.</li>
    </ul>
    <p>Luồng phổ biến và an toàn nhất là <strong>Authorization Code flow</strong>. Điểm tinh tế:
    token <em>không</em> được trao ngay ở trình duyệt, mà đi qua 2 bước:</p>
    <ol>
      <li>Qua trình duyệt (front channel — kênh "lộ thiên"), authorization server chỉ trao một
      <strong>authorization code</strong> — mã tạm, dùng 1 lần, sống ~1 phút. Như <em>phiếu hẹn lấy hàng</em>.</li>
      <li>Client đem code + <strong>client_secret</strong> (mật khẩu riêng của app) gọi thẳng
      server-to-server (back channel — kênh kín) để <strong>đổi code lấy access token</strong>.</li>
    </ol>
    <p>Vì sao lòng vòng vậy? Vì URL trình duyệt dễ lộ (history, log, extension…). Thứ đi qua chỗ dễ lộ
    chỉ là <em>phiếu hẹn</em> — muốn quy ra token phải có thêm client_secret mà chỉ server của app biết.</p>
    <div class="callout"><p>💡 <code>state</code> là tham số chống giả mạo: client sinh chuỗi ngẫu nhiên,
    gửi đi rồi kiểm tra lúc quay về — chặn kẻ gian "nhét" code lạ vào phiên của bạn (CSRF).
    Còn app mobile/SPA không giữ nổi client_secret thì dùng PKCE — bài 7.</p></div>
  `,

  codeTabs: [
    { id: "front", label: "🌐 Front channel", lines: [
      "# 1. Client đưa người dùng sang authorization server:",
      "GET https://auth.example.com/authorize",
      "  ?response_type=code          # xin authorization code",
      "  &client_id=photo-print-app",
      "  &redirect_uri=https://print.app/callback",
      "  &scope=photos.read",
      "  &state=xyz789               # chuỗi ngẫu nhiên chống CSRF",
      "",
      "# 2. Người dùng đăng nhập + bấm Đồng ý tại auth server",
      "",
      "# 3. Auth server đưa người dùng quay về app kèm CODE:",
      "HTTP/1.1 302 Found",
      "Location: https://print.app/callback?code=SplxlO...&state=xyz789"
    ]},
    { id: "back", label: "🔒 Back channel", lines: [
      "# 4. Server của app đổi code lấy token (server-to-server):",
      "POST https://auth.example.com/token",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "grant_type=authorization_code",
      "&code=SplxlO...              # phiếu hẹn vừa nhận",
      "&redirect_uri=https://print.app/callback",
      "&client_id=photo-print-app",
      "&client_secret=app-mat-khau-rieng   # chỉ server app biết",
      "",
      "# 5. Auth server trả token:",
      "{ \"access_token\": \"ya29...\", \"token_type\": \"Bearer\",",
      "  \"expires_in\": 3600, \"refresh_token\": \"1//xEo...\" }"
    ]},
    { id: "api", label: "📡 Gọi API", lines: [
      "# 6. Client dùng access token gọi resource server:",
      "GET https://photos.example.com/api/albums",
      "Authorization: Bearer ya29...",
      "",
      "# Resource server kiểm token + scope:",
      "#  - token hợp lệ? còn hạn?",
      "#  - scope photos.read có cho phép đọc album? -> OK",
      "HTTP/1.1 200 OK",
      "[ { \"album\": \"Đà Lạt 2025\", \"photos\": 128 } ]"
    ]}
  ],

  stageHtml: `
    <div class="node" id="owner"><div class="nl">🧑‍💻 Resource Owner</div><div class="ns">bạn — chủ dữ liệu</div></div>
    <div class="arrow" id="a1">↓ ① redirect sang trang đăng nhập</div>
    <div class="node" id="authsrv"><div class="nl">🏛️ Authorization Server</div><div class="ns">đăng nhập + đồng ý → phát CODE</div></div>
    <div class="arrow" id="a2">↓ ② quay về app kèm ?code=…</div>
    <div class="node" id="client"><div class="nl">🖨️ Client (server của app)</div><div class="ns">cầm code + client_secret</div></div>
    <div class="arrow" id="a3">↓ ③ đổi code lấy token (kênh kín)</div>
    <div class="node" id="token"><div class="nl">🎟️ Access token</div><div class="ns">Bearer · scope hẹp · 1 giờ</div></div>
    <div class="arrow" id="a4">↓ ④ Authorization: Bearer …</div>
    <div class="node" id="resource"><div class="nl">🗄️ Resource Server</div><div class="ns">API ảnh — kiểm token, trả dữ liệu</div></div>
  `,
  steps: [
    { title: "1 · Redirect xin phép", tab: "front", highlight: [2, 3, 4, 6, 7], on: ["owner", "a1", "authsrv"],
      desc: "Client đưa bạn sang authorization server, khai: tôi là ai (<code>client_id</code>), xin gì (<code>scope</code>), nhận kết quả ở đâu (<code>redirect_uri</code>), kèm <code>state</code> ngẫu nhiên để chốc nữa đối chiếu." },
    { title: "2 · Đăng nhập + đồng ý", tab: "front", highlight: [9], on: ["authsrv"],
      desc: "Bạn gõ mật khẩu <em>tại authorization server</em> và bấm Đồng ý. Client không thấy mật khẩu — nguyên tắc vàng từ bài trước." },
    { title: "3 · Trao 'phiếu hẹn' (code)", tab: "front", highlight: [12, 13], on: ["authsrv", "a2", "client"],
      desc: "Auth server đưa bạn quay về <code>redirect_uri</code> kèm <code>?code=…</code>. Code đi qua trình duyệt — kênh dễ lộ — nhưng không sao: nó chỉ là phiếu hẹn dùng 1 lần, sống ~1 phút, và một mình nó chưa đổi được token." },
    { title: "4 · Đổi code lấy token (kênh kín)", tab: "back", highlight: [2, 5, 6, 9], on: ["client", "a3"],
      desc: "Server của app gọi <em>thẳng</em> tới auth server (không qua trình duyệt): đưa code + <code>client_secret</code>. Secret chứng minh 'đúng là app xịn đến lấy hàng' — kẻ trộm được code từ URL cũng chịu chết vì thiếu secret." },
    { title: "5 · Nhận token", tab: "back", highlight: [12, 13], on: ["token"],
      desc: "Auth server trả <code>access_token</code> (Bearer, sống 1 giờ) và <code>refresh_token</code> (để gia hạn — bài sau). Token chưa từng xuất hiện trên URL trình duyệt." },
    { title: "6 · Gọi API bằng token", tab: "api", highlight: [2, 3, 8], on: ["token", "a4", "resource"],
      desc: "Client gọi resource server với <code>Authorization: Bearer …</code>. Resource server kiểm token và scope rồi trả dữ liệu. Đủ 4 vai: owner → auth server → client → resource server." }
  ],

  quiz: [
    { q: "Trong OAuth 2, 'Resource Owner' là ai?", options: [
        "Server API giữ dữ liệu",
        "Người dùng — chủ của dữ liệu",
        "App bên thứ ba",
        "Nơi phát token"
      ], correct: 1,
      explanation: "Resource Owner = chủ tài nguyên = bạn. Client là app, Authorization Server phát token, Resource Server là API giữ dữ liệu." },
    { q: "Vì sao auth server trao 'authorization code' qua trình duyệt thay vì trao thẳng access token?", options: [
        "Vì code ngắn hơn nên tải nhanh hơn",
        "Vì URL trình duyệt dễ lộ — thứ đi qua đó chỉ nên là mã tạm dùng 1 lần, phải kèm client_secret ở kênh kín mới đổi được token",
        "Vì access token chưa được tạo xong",
        "Vì trình duyệt không chứa được token dài"
      ], correct: 1,
      explanation: "Front channel (URL, history, log) không an toàn. Code chỉ là 'phiếu hẹn' — quy ra token phải qua back channel kèm client_secret." },
    { q: "Tham số state trong Authorization Code flow dùng để làm gì?", options: [
        "Cho biết người dùng đang ở tỉnh nào",
        "Chuỗi ngẫu nhiên client sinh ra và đối chiếu khi quay về — chống kẻ gian nhét code lạ vào phiên (CSRF)",
        "Chứa mật khẩu đã mã hoá",
        "Đếm số lần đăng nhập"
      ], correct: 1,
      explanation: "Client so state gửi đi với state nhận về — lệch là huỷ. Chặn tấn công gắn authorization code của kẻ khác vào phiên của bạn." },
    { q: "client_secret được dùng ở bước nào và ai giữ nó?", options: [
        "Gõ vào trình duyệt cùng mật khẩu người dùng",
        "Server của app dùng ở bước đổi code lấy token, qua kênh server-to-server",
        "Người dùng giữ trong máy",
        "Resource server phát cho người dùng"
      ], correct: 1,
      explanation: "client_secret là 'mật khẩu của app', chỉ tồn tại trên server của app và chỉ đi qua back channel. App mobile/SPA không giấu nổi secret → cần PKCE (bài 7)." }
  ]
});
