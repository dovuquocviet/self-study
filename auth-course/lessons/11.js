window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Thực chiến",
  title: "Device Code flow & các grant khác của OAuth 2",
  subtitle: "Đăng nhập Netflix trên TV, service gọi service — và các flow đã bị khai tử",

  theory: `
    <p>Authorization Code + PKCE là luồng "chính lộ", nhưng OAuth 2 có nhiều <strong>grant type</strong>
    (kiểu cấp quyền) cho các tình huống khác nhau:</p>
    <p><strong>1. Device Code flow</strong> — cho thiết bị <em>không gõ nổi</em> (TV, máy chơi game, CLI).
    Bạn từng thấy: TV hiện <em>"Mở netflix.com/tv và nhập mã <code>WDJB-MJHT</code>"</em>. Cơ chế:</p>
    <ol>
      <li>TV xin auth server một cặp mã: <code>device_code</code> (TV giữ) + <code>user_code</code> (hiện lên màn hình).</li>
      <li>Bạn mở điện thoại/laptop — nơi gõ phím dễ và <em>đã đăng nhập sẵn</em> — vào URL, nhập user_code, bấm Cho phép.</li>
      <li>Trong lúc đó TV <strong>hỏi lại (poll)</strong> auth server vài giây một lần: "user duyệt chưa?" — duyệt xong là TV nhận token. TV chưa từng thấy mật khẩu.</li>
    </ol>
    <p><strong>2. Client Credentials flow</strong> — <em>không có người dùng nào cả</em>: service A gọi API của
    service B (cron job, microservice). App đem thẳng <code>client_id + client_secret</code> đổi lấy token.
    Token đại diện cho <em>chính app</em>, không đại diện người dùng.</p>
    <p><strong>3. Hai flow đã bị khai tử</strong> (gặp trong code cũ thì hiểu, đừng viết mới):</p>
    <ul>
      <li><strong>Implicit</strong> — trả access token <em>thẳng trên URL</em> (bỏ bước code). Token phơi trong history/log → OAuth 2.1 xoá sổ, thay bằng Code + PKCE.</li>
      <li><strong>Password (ROPC)</strong> — app thu mật khẩu người dùng rồi tự nộp cho auth server. Phá vỡ nguyên tắc số 1 "app không được thấy mật khẩu" → khai tử.</li>
    </ul>
    <div class="callout"><p>💡 Bản đồ chọn flow: có người dùng + app có UI trình duyệt → <strong>Code + PKCE</strong>.
    Thiết bị không gõ được → <strong>Device Code</strong>. Máy gọi máy, không người dùng → <strong>Client Credentials</strong>.
    Hết. Ba lựa chọn này phủ mọi tình huống hiện đại.</p></div>
  `,

  codeTabs: [
    { id: "device", label: "📺 Device Code", lines: [
      "# 1. TV xin cặp mã:",
      "POST https://auth.example.com/device/code",
      "client_id=tv-app&scope=profile",
      "",
      "{ \"device_code\": \"GmRhmhcxhwAzk...\",   # TV giữ, dài",
      "  \"user_code\": \"WDJB-MJHT\",            # cho NGƯỜI, ngắn",
      "  \"verification_uri\": \"https://netflix.com/tv\",",
      "  \"interval\": 5, \"expires_in\": 900 }",
      "",
      "# 2. TV hiện: 'Mở netflix.com/tv, nhập mã WDJB-MJHT'",
      "# 3. Bạn duyệt trên ĐIỆN THOẠI (đã đăng nhập sẵn)"
    ]},
    { id: "poll", label: "🔄 TV poll", lines: [
      "# 4. TV cứ 5 giây hỏi một lần:",
      "POST https://auth.example.com/token",
      "grant_type=urn:ietf:params:oauth:grant-type:device_code",
      "&device_code=GmRhmhcxhwAzk...&client_id=tv-app",
      "",
      "# Chưa duyệt:",
      "{ \"error\": \"authorization_pending\" }   # -> đợi 5s hỏi lại",
      "",
      "# Bạn vừa bấm 'Cho phép' trên điện thoại:",
      "{ \"access_token\": \"eyJ...\", \"refresh_token\": \"1//x...\" }",
      "# TV đăng nhập xong — chưa từng chạm vào mật khẩu"
    ]},
    { id: "cc", label: "🤖 Client Credentials", lines: [
      "# Service A gọi API service B — KHÔNG có người dùng:",
      "POST https://auth.example.com/token",
      "grant_type=client_credentials",
      "&client_id=report-cron",
      "&client_secret=xxxx           # server-to-server, giấu được",
      "&scope=invoices.read",
      "",
      "{ \"access_token\": \"eyJ...\", \"expires_in\": 3600 }",
      "# Token đại diện cho CHÍNH APP report-cron,",
      "# không đại diện người dùng nào — không có refresh token"
    ]},
    { id: "dead", label: "☠️ Đã khai tử", lines: [
      "# IMPLICIT (cũ) — token trả THẲNG trên URL:",
      "https://myapp.com/#access_token=eyJ...   # lộ qua history/log!",
      "# -> OAuth 2.1 xoá sổ. Dùng Code + PKCE thay thế",
      "",
      "# PASSWORD / ROPC (cũ) — app thu mật khẩu hộ:",
      "POST /token",
      "grant_type=password&username=an&password=s3cret",
      "# -> app thấy mật khẩu = phá nguyên tắc số 1 của OAuth",
      "# -> chỉ còn trong hệ thống legacy, đừng viết mới"
    ]}
  ],

  stageHtml: `
    <div class="node" id="tv"><div class="nl">📺 TV</div><div class="ns">không gõ nổi — hiện mã WDJB-MJHT</div></div>
    <div class="arrow" id="a1">↓ ① xin device_code + user_code</div>
    <div class="node" id="authsrv"><div class="nl">🏛️ Auth server</div><div class="ns">giữ cặp mã, chờ người dùng duyệt</div></div>
    <div class="arrow" id="a2">↓ ② bạn nhập mã trên điện thoại + bấm Cho phép</div>
    <div class="node" id="phone"><div class="nl">📱 Điện thoại</div><div class="ns">đã đăng nhập sẵn — gõ phím dễ dàng</div></div>
    <div class="arrow" id="a3">↓ ③ TV poll: "duyệt chưa?" … "duyệt chưa?"</div>
    <div class="node" id="token"><div class="nl">🎟️ Token về TV</div><div class="ns">TV đăng nhập — không chạm mật khẩu</div></div>
  `,
  steps: [
    { title: "1 · TV xin cặp mã", tab: "device", highlight: [2, 5, 6, 7], on: ["tv", "a1", "authsrv"],
      desc: "TV gọi auth server nhận <strong>2 mã</strong>: <code>device_code</code> dài (TV giữ, như số phiếu chờ) và <code>user_code</code> ngắn kiểu <code>WDJB-MJHT</code> (cho con người — đủ ngắn để nhìn TV gõ lại)." },
    { title: "2 · Chuyển việc gõ sang thiết bị dễ gõ", tab: "device", highlight: [10, 11], on: ["a2", "phone"],
      desc: "Ý tưởng lõi: <em>đừng bắt người ta gõ mật khẩu bằng remote TV</em>. Việc xác thực chuyển sang điện thoại/laptop — nơi bàn phím tử tế và thường <em>đăng nhập sẵn</em> (SSO bài 9!). Bạn nhập user_code, bấm Cho phép." },
    { title: "3 · TV kiên nhẫn poll", tab: "poll", highlight: [2, 3, 7], on: ["tv", "a3", "authsrv"],
      desc: "Song song, TV cứ <code>interval</code> = 5 giây hỏi auth server một lần. Chưa duyệt → <code>authorization_pending</code>, đợi rồi hỏi tiếp. Đây là kiểu 'chờ chủ động' vì TV không có cách nào nhận redirect như trình duyệt." },
    { title: "4 · Token về TV", tab: "poll", highlight: [9, 10, 11], on: ["token"],
      desc: "Bạn vừa bấm Cho phép → lượt poll kế tiếp nhận luôn token. TV đăng nhập thành công mà <strong>chưa từng thấy mật khẩu</strong> — nguyên tắc vàng của OAuth được giữ nguyên trên cả cái TV." },
    { title: "5 · Máy gọi máy & đồ cổ", tab: "cc", highlight: [3, 4, 5, 9, 10], on: ["authsrv"],
      desc: "Không có người dùng? <strong>Client Credentials</strong>: app nộp thẳng id+secret lấy token đại diện chính nó. Còn gặp <code>grant_type=password</code> hay token trên URL fragment trong code cũ? Đó là ROPC/Implicit — hiểu để đọc, nhưng OAuth 2.1 đã khai tử, đừng viết mới." }
  ],

  quiz: [
    { q: "Device Code flow sinh ra cho tình huống nào?", options: [
        "App có form đăng nhập đẹp",
        "Thiết bị khó/không gõ được bàn phím (TV, console, CLI) — chuyển việc xác thực sang điện thoại/laptop",
        "Server gọi server",
        "Đăng nhập bằng vân tay"
      ], correct: 1,
      explanation: "TV hiện user_code ngắn, bạn duyệt trên thiết bị dễ gõ, TV poll chờ kết quả. Mật khẩu không bao giờ chạm vào TV." },
    { q: "Trong Device Code flow, vì sao TV phải 'poll' (hỏi đi hỏi lại) auth server?", options: [
        "Vì TV muốn kiểm tra mạng",
        "Vì TV không có cách nhận redirect như trình duyệt — nó phải chủ động hỏi 'user duyệt chưa?' cho tới khi có token",
        "Vì auth server yêu cầu trả phí mỗi lần hỏi",
        "Vì user_code thay đổi mỗi 5 giây"
      ], correct: 1,
      explanation: "Luồng duyệt diễn ra trên thiết bị KHÁC (điện thoại). TV chỉ còn cách hỏi định kỳ theo interval, nhận authorization_pending cho tới khi bạn bấm Cho phép." },
    { q: "Client Credentials flow khác các flow còn lại ở điểm căn bản nào?", options: [
        "Không có người dùng nào — token đại diện cho chính app (service gọi service)",
        "Nó dùng mật khẩu người dùng",
        "Nó chỉ chạy trên mobile",
        "Nó không cần client_id"
      ], correct: 0,
      explanation: "Cron job, microservice… tự chứng minh bằng client_id + client_secret. Không resource owner, không consent, thường cũng không refresh token." },
    { q: "Vì sao Implicit flow bị OAuth 2.1 khai tử?", options: [
        "Vì chạy quá chậm",
        "Vì access token trả thẳng trên URL — phơi ra history, log, referrer; Code + PKCE thay thế an toàn hơn",
        "Vì không hỗ trợ tiếng Việt",
        "Vì bắt buộc phải có client_secret"
      ], correct: 1,
      explanation: "Token nằm trên URL fragment là token bị lộ ở đủ nơi. ROPC cũng chết vì app thấy mật khẩu. Hiện đại chỉ còn: Code+PKCE, Device Code, Client Credentials." }
  ]
});
