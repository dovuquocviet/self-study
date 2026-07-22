window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "OAuth 2.0",
  title: "OAuth là gì? Bài toán uỷ quyền — chìa khoá valet",
  subtitle: "Cho app khác dùng dữ liệu của bạn mà KHÔNG đưa mật khẩu",

  theory: `
    <p>Năm 2007, các app kiểu "in ảnh từ Google Photos của bạn" gặp một bài toán khó:
    app cần đọc ảnh trong tài khoản Google của bạn. Cách duy nhất thời đó? <strong>Bạn đưa
    mật khẩu Google cho app lạ</strong>. Kinh khủng: app đó đọc được cả Gmail, xoá được cả Drive,
    và bạn muốn "rút quyền" thì chỉ còn cách… đổi mật khẩu.</p>
    <p><strong>OAuth</strong> (Open Authorization) sinh ra để giải bài toán <strong>uỷ quyền</strong>
    (delegation) này. Phép so sánh nổi tiếng: <strong>chìa khoá valet</strong> của xe sang —
    chiếc chìa phụ đưa cho nhân viên đỗ xe: <em>nổ máy được, chạy chậm được, nhưng không mở được
    cốp và không chạy quá 30km/h</em>. Chìa chính (mật khẩu) bạn giữ.</p>
    <ul>
      <li>OAuth cấp cho app một <strong>access token</strong> = chìa valet: quyền <em>hẹp</em> (chỉ đọc ảnh), có <em>hạn</em>, và <em>thu hồi được</em> mà không đổi mật khẩu.</li>
      <li>Mật khẩu chỉ gõ ở <strong>trang của Google</strong> — app lạ không bao giờ nhìn thấy.</li>
      <li><strong>OAuth 2.0</strong> (2012) là phiên bản thay thế OAuth 1 (đơn giản hoá chữ ký, chạy trên HTTPS) — ngày nay nói "OAuth" gần như mặc định là OAuth 2. Bản vá hiện đại nhất là <strong>OAuth 2.1</strong> (gom các best practice: bắt buộc PKCE, bỏ các flow yếu).</li>
    </ul>
    <div class="callout"><p>💡 Nhớ kỹ: OAuth nguyên bản là chuẩn <strong>uỷ quyền (authorization)</strong> —
    "app X được đọc ảnh của tôi" — chứ <em>không phải</em> chuẩn đăng nhập. Chuyện "Login with Google"
    là lớp <strong>OpenID Connect</strong> đắp thêm lên OAuth 2 — học ở bài 8. Đừng lẫn hai thứ này.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "😱 Trước OAuth", lines: [
      "# App in ảnh xin thẳng mật khẩu Google của bạn:",
      "POST /login-as-you  (gửi tới server của APP LẠ)",
      "",
      "{ \"gmail\": \"an@gmail.com\", \"password\": \"matkhau-google\" }",
      "",
      "# Hậu quả:",
      "#  - app đọc được CẢ Gmail, Drive, Calendar…",
      "#  - app lưu mật khẩu của bạn — app bị hack là bạn toang",
      "#  - muốn rút quyền? chỉ còn cách đổi mật khẩu"
    ]},
    { id: "good", label: "🔑 Với OAuth 2", lines: [
      "# 1. App đưa bạn sang TRANG CỦA GOOGLE để xin phép:",
      "https://accounts.google.com/o/oauth2/auth",
      "  ?client_id=print-app",
      "  &scope=photos.readonly        # CHỈ xin quyền đọc ảnh",
      "  &redirect_uri=https://print.app/callback",
      "",
      "# 2. Bạn gõ mật khẩu Ở TRANG GOOGLE (app không thấy)",
      "# 3. Google hỏi: 'print-app muốn ĐỌC ẢNH của bạn — đồng ý?'",
      "# 4. Đồng ý -> app nhận access token quyền hẹp:",
      "{ \"access_token\": \"ya29.a0Af...\", \"scope\": \"photos.readonly\",",
      "  \"expires_in\": 3600 }",
      "",
      "# Thu hồi bất cứ lúc nào tại myaccount.google.com/permissions"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">🧑‍💻 Bạn</div><div class="ns">chủ tài khoản Google (resource owner)</div></div>
    <div class="arrow" id="a1">↓ muốn in ảnh</div>
    <div class="node" id="app"><div class="nl">🖨️ App in ảnh</div><div class="ns">cần đọc ảnh — nhưng không được cầm mật khẩu</div></div>
    <div class="arrow" id="a2">↓ đưa bạn sang trang Google xin phép</div>
    <div class="node" id="google"><div class="nl">🔵 Google</div><div class="ns">bạn đăng nhập + bấm 'Đồng ý cho đọc ảnh'</div></div>
    <div class="arrow" id="a3">↓ phát chìa valet</div>
    <div class="node" id="token"><div class="nl">🎟️ Access token</div><div class="ns">chỉ đọc ảnh · hết hạn sau 1h · thu hồi được</div></div>
  `,
  steps: [
    { title: "1 · Thời kỳ đen tối", tab: "bad", highlight: [2, 4], on: ["user", "app"],
      desc: "Trước OAuth: muốn app đọc ảnh thì đưa <strong>mật khẩu Google</strong> cho app. Mật khẩu là 'chìa khoá vạn năng' — app mở được mọi cửa: Gmail, Drive, tất cả." },
    { title: "2 · Hậu quả", tab: "bad", highlight: [7, 8, 9], on: ["app"],
      desc: "Quyền quá rộng, không thời hạn, không thu hồi riêng được. App bị hack → mật khẩu của bạn lộ. Đây chính là bài toán OAuth phải giải: <em>uỷ quyền hẹp mà không đưa chìa chính</em>." },
    { title: "3 · Sang trang Google xin phép", tab: "good", highlight: [2, 3, 4], on: ["app", "a2", "google"],
      desc: "Với OAuth 2, app <em>chuyển hướng</em> bạn sang trang của Google, khai rõ: tôi là <code>print-app</code> (client_id), tôi xin quyền <code>photos.readonly</code> (scope). Mật khẩu gõ ở trang Google — app lạ không bao giờ thấy." },
    { title: "4 · Màn hình đồng ý (consent)", tab: "good", highlight: [7, 8], on: ["google"],
      desc: "Google hiển thị: '<em>print-app muốn xem ảnh của bạn</em>'. Bạn — chủ tài nguyên (resource owner) — bấm Đồng ý. Đây là khoảnh khắc <strong>uỷ quyền</strong>: bạn trao một quyền hẹp, không trao danh tính." },
    { title: "5 · Chìa valet được phát", tab: "good", highlight: [10, 11, 13], on: ["a3", "token"],
      desc: "App nhận <strong>access token</strong>: chỉ đọc ảnh (scope), sống 1 giờ (expires_in), thu hồi được trong trang quản lý Google mà <em>không cần đổi mật khẩu</em>. Đúng nghĩa chìa valet: nổ máy được nhưng không mở được cốp." }
  ],

  quiz: [
    { q: "OAuth sinh ra để giải quyết bài toán gốc nào?", options: [
        "Mã hoá dữ liệu khi truyền qua mạng",
        "Cho app bên thứ ba dùng MỘT PHẦN dữ liệu của bạn mà không phải đưa mật khẩu",
        "Tăng tốc độ đăng nhập",
        "Lưu mật khẩu an toàn hơn trong database"
      ], correct: 1,
      explanation: "OAuth = uỷ quyền (delegation): cấp 'chìa valet' quyền hẹp, có hạn, thu hồi được — thay cho việc đưa 'chìa chính' là mật khẩu." },
    { q: "Trong phép so sánh chìa khoá valet, access token tương ứng với gì?", options: [
        "Chìa chính của chủ xe (mật khẩu)",
        "Chiếc xe (dữ liệu)",
        "Chìa phụ quyền hạn chế — nổ máy được nhưng không mở được cốp",
        "Nhân viên đỗ xe"
      ], correct: 2,
      explanation: "Access token = chìa valet: quyền hẹp (scope), có thời hạn, thu hồi riêng được. Mật khẩu = chìa chính, bạn không bao giờ đưa ra." },
    { q: "Trong luồng OAuth 2, người dùng gõ mật khẩu Google ở đâu?", options: [
        "Trong form của app bên thứ ba",
        "Ở trang đăng nhập của chính Google — app bên thứ ba không bao giờ thấy mật khẩu",
        "Gửi qua email cho app",
        "Không cần mật khẩu"
      ], correct: 1,
      explanation: "Điểm cốt lõi của OAuth: xác thực diễn ra tại nhà cung cấp (Google). App chỉ nhận về token quyền hẹp." },
    { q: "Phát biểu nào về OAuth là ĐÚNG?", options: [
        "OAuth nguyên bản là chuẩn uỷ quyền (authorization), không phải chuẩn đăng nhập — 'Login with Google' là lớp OpenID Connect đắp thêm",
        "OAuth 2 là công cụ mã hoá mật khẩu",
        "OAuth 1 vẫn là phiên bản được khuyên dùng nhất",
        "OAuth bắt buộc người dùng đổi mật khẩu mỗi tháng"
      ], correct: 0,
      explanation: "OAuth 2 giải bài toán 'app X được làm gì với dữ liệu của tôi'. Chuyện đăng nhập/danh tính do OpenID Connect (bài 8) đảm nhiệm, xây trên nền OAuth 2." }
  ]
});
