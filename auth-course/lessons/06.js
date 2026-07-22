window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "OAuth 2.0",
  title: "Access token, Refresh token & Scope",
  subtitle: "Vì sao cần HAI token — và scope thu hẹp quyền thế nào",

  theory: `
    <p>Bài trước, response token có cả <code>access_token</code> lẫn <code>refresh_token</code>.
    Vì sao phải hai cái?</p>
    <p>Mâu thuẫn cần giải: access token kiểu bearer <em>ai cầm là dùng được</em> — lộ là nguy.
    Muốn an toàn thì cho nó <strong>sống thật ngắn</strong> (5–60 phút). Nhưng sống ngắn thì
    người dùng cứ 15 phút lại phải đăng nhập lại? Không ai chịu nổi.</p>
    <ul>
      <li><strong>Access token</strong> — "vé ngày": dùng liên tục để gọi API, hết hạn nhanh.
      Lộ cũng chỉ thiệt hại trong ít phút.</li>
      <li><strong>Refresh token</strong> — "thẻ thành viên": sống lâu (ngày/tháng), <em>không</em> gọi API được,
      chỉ dùng để <strong>xin access token mới</strong> tại authorization server. Được cất kỹ, rất hiếm khi đi qua mạng.</li>
    </ul>
    <p>Luồng thực tế: access token hết hạn → API trả <code>401</code> → client <em>lặng lẽ</em> đem
    refresh token đi đổi access token mới → gọi lại API. Người dùng không thấy gì cả —
    đây là lý do bạn mở app cả tháng không phải đăng nhập lại.</p>
    <p><strong>Scope</strong> là chiều còn lại của "chìa valet": không chỉ giới hạn <em>thời gian</em> mà giới hạn
    <em>phạm vi</em>. <code>scope=photos.read</code> thì token chỉ đọc ảnh — gọi API xoá ảnh sẽ ăn <code>403</code>
    dù token còn hạn. Nguyên tắc: <em>least privilege</em> — xin ít quyền nhất đủ dùng.</p>
    <div class="callout"><p>💡 Refresh token bị trộm thì sao? Kỹ thuật hiện đại: <strong>refresh token rotation</strong> —
    mỗi lần dùng, server phát refresh token MỚI và vô hiệu cái cũ. Kẻ trộm dùng lại token cũ →
    server phát hiện "token đã dùng rồi!" → thu hồi cả chuỗi. Kẻ trộm và nạn nhân, chỉ một người dùng được — có kẻ thứ hai là lộ ngay.</p></div>
  `,

  codeTabs: [
    { id: "expire", label: "⏰ Token hết hạn", lines: [
      "# Access token đã quá 15 phút:",
      "GET /api/albums HTTP/1.1",
      "Authorization: Bearer eyJ...cũ",
      "",
      "HTTP/1.1 401 Unauthorized",
      "{ \"error\": \"invalid_token\", \"error_description\": \"expired\" }",
      "",
      "# Client KHÔNG bắt người dùng đăng nhập lại —",
      "# nó lặng lẽ dùng refresh token…"
    ]},
    { id: "refresh", label: "🔄 Refresh", lines: [
      "# Đổi refresh token lấy access token mới:",
      "POST https://auth.example.com/token",
      "",
      "grant_type=refresh_token",
      "&refresh_token=1//xEoDL4iW...",
      "&client_id=photo-print-app",
      "",
      "# Server trả cặp mới (rotation: refresh token cũng thay):",
      "{ \"access_token\": \"eyJ...mới\", \"expires_in\": 900,",
      "  \"refresh_token\": \"1//yFpEM5jX...\"  }",
      "",
      "# -> gọi lại API với token mới, người dùng không hề hay biết"
    ]},
    { id: "scope", label: "🎯 Scope", lines: [
      "# Token được cấp với scope=photos.read",
      "",
      "# ĐỌC ảnh -> nằm trong scope -> OK:",
      "GET /api/albums",
      "Authorization: Bearer eyJ...",
      "HTTP/1.1 200 OK",
      "",
      "# XOÁ ảnh -> ngoài scope -> bị chặn dù token còn hạn:",
      "DELETE /api/photos/99",
      "Authorization: Bearer eyJ...",
      "HTTP/1.1 403 Forbidden",
      "{ \"error\": \"insufficient_scope\", \"required\": \"photos.write\" }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client</div><div class="ns">giữ access token (ngắn) + refresh token (dài, cất kỹ)</div></div>
    <div class="arrow" id="a1">↓ Bearer eyJ…cũ</div>
    <div class="node" id="api"><div class="nl">🗄️ Resource server</div><div class="ns">thấy token hết hạn → 401</div></div>
    <div class="arrow" id="a2">↓ lặng lẽ: grant_type=refresh_token</div>
    <div class="node" id="authsrv"><div class="nl">🏛️ Authorization server</div><div class="ns">kiểm refresh token → phát cặp token MỚI</div></div>
    <div class="arrow" id="a3">↓ retry với token mới</div>
    <div class="node" id="ok"><div class="nl">✅ 200 OK</div><div class="ns">người dùng không thấy gì — không phải đăng nhập lại</div></div>
  `,
  steps: [
    { title: "1 · Access token hết hạn", tab: "expire", highlight: [2, 3, 5], on: ["client", "a1", "api"],
      desc: "Access token cố tình sống ngắn (ở đây 15 phút) để giảm thiệt hại nếu lộ. Hết hạn → resource server trả <code>401 invalid_token</code>. Đây là chuyện <em>bình thường</em>, xảy ra cả trăm lần mỗi ngày trong mọi app." },
    { title: "2 · Client tự xử lý, không hỏi người dùng", tab: "expire", highlight: [8, 9], on: ["client"],
      desc: "Gặp 401, client <strong>không</strong> đá người dùng ra màn hình đăng nhập. Nó lấy refresh token — 'thẻ thành viên' cất kỹ trong két (secure storage / httpOnly cookie) — để đi xin vé mới." },
    { title: "3 · Đổi refresh lấy access mới", tab: "refresh", highlight: [2, 4, 5], on: ["a2", "authsrv"],
      desc: "Client gọi thẳng token endpoint với <code>grant_type=refresh_token</code>. Chú ý: refresh token <em>chỉ nói chuyện với authorization server</em>, không bao giờ gửi cho API thường — nên nó rất ít khi đi qua mạng." },
    { title: "4 · Rotation — thay cả refresh token", tab: "refresh", highlight: [9, 10], on: ["authsrv"],
      desc: "Server trả access token mới VÀ refresh token mới, vô hiệu refresh token cũ. Nếu kẻ trộm dùng lại token cũ, server thấy 'token này dùng rồi!' → biết có trộm → thu hồi cả chuỗi. Đó là <strong>refresh token rotation</strong>." },
    { title: "5 · Scope chặn ngang quyền", tab: "scope", highlight: [9, 11, 12], on: ["a3", "ok"],
      desc: "Chiều thứ hai của chìa valet: token còn hạn nhưng xin xoá ảnh với scope <code>photos.read</code> → <code>403 insufficient_scope</code>. Thời hạn giới hạn <em>bao lâu</em>, scope giới hạn <em>được làm gì</em>." }
  ],

  quiz: [
    { q: "Vì sao access token nên sống ngắn (5–60 phút)?", options: [
        "Để tiết kiệm bộ nhớ server",
        "Vì token kiểu bearer lộ là ai cầm cũng dùng được — sống ngắn thì thiệt hại chỉ trong ít phút",
        "Vì chuẩn HTTP bắt buộc",
        "Để người dùng phải đăng nhập lại thường xuyên cho an toàn"
      ], correct: 1,
      explanation: "Bearer = ai cầm là dùng. Hạn ngắn giới hạn cửa sổ thiệt hại khi lộ; còn trải nghiệm 'không phải đăng nhập lại' đã có refresh token lo." },
    { q: "Refresh token khác access token ở điểm nào?", options: [
        "Refresh token dùng để gọi API nhanh hơn",
        "Refresh token sống lâu, KHÔNG gọi API được, chỉ dùng đổi access token mới tại authorization server",
        "Refresh token là bản sao của access token",
        "Refresh token do resource server phát"
      ], correct: 1,
      explanation: "Access token = vé ngày đi gọi API; refresh token = thẻ thành viên cất kỹ, chỉ nói chuyện với authorization server để xin vé mới." },
    { q: "App gặp 401 vì access token hết hạn. Luồng đúng là gì?", options: [
        "Hiện màn hình đăng nhập bắt người dùng gõ lại mật khẩu",
        "Lặng lẽ dùng refresh token đổi access token mới rồi gọi lại API — người dùng không thấy gì",
        "Bỏ qua lỗi và dùng tiếp token cũ",
        "Xoá app cài lại"
      ], correct: 1,
      explanation: "Đây chính là lý do bạn mở app cả tháng không phải đăng nhập lại: chu trình 401 → refresh → retry chạy ngầm liên tục." },
    { q: "Refresh token rotation phát hiện trộm bằng cách nào?", options: [
        "Quét địa chỉ IP của mọi request",
        "Mỗi lần dùng phát refresh token mới và vô hiệu cái cũ — ai dùng lại token cũ nghĩa là có 2 người cùng giữ, tức là đã bị trộm",
        "Gửi email hỏi người dùng mỗi lần refresh",
        "So sánh tên thiết bị"
      ], correct: 1,
      explanation: "Token cũ đã 'chết' mà vẫn có người dùng → chắc chắn có bản sao ngoài ý muốn → server thu hồi cả chuỗi token để bảo vệ tài khoản." }
  ]
});
