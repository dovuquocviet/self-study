window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Nền tảng",
  title: "Bearer token & JWT — giấy thông hành tự chứa thông tin",
  subtitle: "'Bearer' = ai cầm là dùng được — vì sao API hiện đại chuộng token",

  theory: `
    <p>Session hợp với web truyền thống, nhưng có điểm yếu: <strong>server phải giữ sổ</strong>.
    Khi bạn có 10 server API, mobile app, service gọi service… việc mọi máy phải tra chung một cuốn sổ
    trở nên phiền. Cách thứ hai ra đời: <strong>token tự chứa</strong> (self-contained).</p>
    <p><strong>Bearer token</strong> nghĩa đen là "token của <em>người cầm</em>" — như tấm vé xem phim:
    rạp không hỏi tên bạn, <em>ai cầm vé thì được vào</em>. Client gửi token trong header:</p>
    <p style="text-align:center"><code>Authorization: Bearer &lt;token&gt;</code></p>
    <p>Định dạng token phổ biến nhất là <strong>JWT</strong> (JSON Web Token) — 3 phần nối bằng dấu chấm
    <code>header.payload.signature</code>:</p>
    <ul>
      <li><strong>Header</strong>: thuật toán ký (vd <code>HS256</code>).</li>
      <li><strong>Payload</strong>: các <em>claim</em> — user là ai (<code>sub</code>), quyền gì (<code>role</code>), hết hạn khi nào (<code>exp</code>).</li>
      <li><strong>Signature</strong>: chữ ký do server tạo bằng khoá bí mật. Ai sửa payload → chữ ký lệch → server phát hiện ngay.</li>
    </ul>
    <div class="callout"><p>⚠️ Hai hiểu lầm chết người về JWT:
    (1) JWT <strong>không mã hoá</strong> — payload chỉ là Base64, <em>ai cũng đọc được</em>, đừng nhét mật khẩu/số thẻ vào.
    Chữ ký chỉ chống <em>sửa</em>, không chống <em>đọc</em>.
    (2) Vì server không giữ sổ, JWT <strong>không thu hồi ngay được</strong> — token đã phát thì còn dùng được tới khi hết hạn (<code>exp</code>).
    Vì vậy token thường sống ngắn (5–15 phút), sẽ học cách gia hạn ở bài Refresh token.</p></div>
  `,

  codeTabs: [
    { id: "use", label: "📡 Dùng token", lines: [
      "# Client gọi API, đính token vào header Authorization",
      "GET /api/orders HTTP/1.1",
      "Host: api.example.com",
      "Authorization: Bearer eyJhbGciOi...abc.def",
      "",
      "# Server KHÔNG tra sổ nào cả:",
      "#  1. tách 3 phần header.payload.signature",
      "#  2. tự tính lại chữ ký bằng khoá bí mật",
      "#  3. khớp? -> tin payload -> biết user là ai, quyền gì",
      "#  4. kiểm tra exp chưa quá hạn",
      "HTTP/1.1 200 OK"
    ]},
    { id: "jwt", label: "🎫 Mổ xẻ JWT", lines: [
      "# JWT = 3 đoạn Base64 nối bằng dấu chấm",
      "eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiJhbiIsInJvbGUi... . SflKxwRJ...",
      "",
      "# Giải mã đoạn 1 — HEADER (thuật toán):",
      "{ \"alg\": \"HS256\", \"typ\": \"JWT\" }",
      "",
      "# Giải mã đoạn 2 — PAYLOAD (claims — ĐỌC ĐƯỢC, không mã hoá!):",
      "{ \"sub\": \"an\", \"role\": \"member\", \"exp\": 1750000000 }",
      "",
      "# Đoạn 3 — SIGNATURE (chữ ký):",
      "HMACSHA256(base64(header) + '.' + base64(payload), SECRET)",
      "# Sửa 1 ký tự payload -> chữ ký lệch -> server từ chối"
    ]},
    { id: "vs", label: "⚖️ Session vs Token", lines: [
      "# SESSION (stateful — trạng thái ở server)",
      "#  + thu hồi tức thì (xoá sổ là xong)",
      "#  - mọi server phải tra chung session store",
      "#  ~ hợp: web truyền thống, cùng một domain",
      "",
      "# BEARER TOKEN / JWT (stateless — trạng thái trong token)",
      "#  + server nào cũng tự kiểm tra được, không cần sổ chung",
      "#  + hợp mobile app, API, microservices, đa domain",
      "#  - không thu hồi ngay được -> phải để sống ngắn",
      "#  - payload ai cũng đọc -> không nhét dữ liệu nhạy cảm"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Mobile app / SPA</div><div class="ns">giữ token sau khi đăng nhập</div></div>
    <div class="arrow" id="a1">↓ Authorization: Bearer eyJ...</div>
    <div class="node" id="api"><div class="nl">🖥️ API server</div><div class="ns">không có session store</div></div>
    <div class="arrow" id="a2">↓ tự kiểm tra tại chỗ</div>
    <div class="node" id="verify"><div class="nl">🔏 Kiểm chữ ký</div><div class="ns">tính lại signature bằng khoá bí mật</div></div>
    <div class="arrow" id="a3">↓ khớp → tin payload</div>
    <div class="node" id="claims"><div class="nl">📜 Claims</div><div class="ns">sub=an · role=member · exp chưa quá hạn</div></div>
  `,
  steps: [
    { title: "1 · Client gửi kèm token", tab: "use", highlight: [2, 4], on: ["client", "a1", "api"],
      desc: "Khác cookie (trình duyệt tự gửi), với bearer token <em>client chủ động</em> đặt header <code>Authorization: Bearer …</code>. Vì vậy nó chạy tốt ở mọi nơi: mobile app, script, service gọi service — không phụ thuộc trình duyệt." },
    { title: "2 · Server tách 3 phần", tab: "jwt", highlight: [2], on: ["api", "a2"],
      desc: "JWT là chuỗi <code>header.payload.signature</code>. Hai phần đầu chỉ là Base64 — <strong>ai cũng giải mã đọc được</strong>. Thử dán một JWT vào jwt.io mà xem: thấy hết payload." },
    { title: "3 · Kiểm tra chữ ký", tab: "jwt", highlight: [11, 12], on: ["verify"],
      desc: "Server tự tính lại <code>HMACSHA256(header + '.' + payload, SECRET)</code>. Kẻ gian sửa <code>role: member</code> thành <code>admin</code>? Chữ ký lệch ngay vì hắn không có SECRET. Chữ ký chống <strong>sửa</strong>, không chống <strong>đọc</strong>." },
    { title: "4 · Tin payload, kiểm hạn", tab: "use", highlight: [9, 10, 11], on: ["a3", "claims"],
      desc: "Chữ ký khớp → server tin toàn bộ claims: user <code>an</code>, quyền <code>member</code>, hạn <code>exp</code>. Không tra bất kỳ database nào — <strong>stateless</strong>. 10 server API đều tự kiểm tra được, miễn có khoá." },
    { title: "5 · Đánh đổi", tab: "vs", highlight: [2, 9], on: ["client", "claims"],
      desc: "Cái giá của stateless: token đã phát thì <strong>không rút lại được</strong> — server đâu có sổ để xoá. Giải pháp thực tế: cho token sống ngắn (5–15 phút) + cấp refresh token để gia hạn — học ở bài 6." }
  ],

  quiz: [
    { q: "'Bearer' trong 'Bearer token' nghĩa là gì?", options: [
        "Token được mã hoá hai lớp",
        "Ai cầm token thì dùng được — như vé xem phim, rạp không hỏi tên",
        "Token chỉ dùng được một lần",
        "Token do người dùng tự tạo"
      ], correct: 1,
      explanation: "Bearer = người cầm. Server không kiểm tra người gửi là ai — cầm token hợp lệ là được phục vụ. Vì thế lộ token = lộ tài khoản (tới khi token hết hạn)." },
    { q: "Payload của JWT có đặc điểm gì?", options: [
        "Được mã hoá, chỉ server đọc được",
        "Chỉ là Base64 — ai cũng giải mã đọc được, nên không được nhét dữ liệu nhạy cảm",
        "Luôn rỗng",
        "Chứa mật khẩu của người dùng"
      ], correct: 1,
      explanation: "Base64 không phải mã hoá. Chữ ký chỉ đảm bảo payload không bị SỬA — còn ĐỌC thì ai cũng đọc được." },
    { q: "Vì sao JWT khó 'thu hồi tức thì' như session?", options: [
        "Vì JWT quá dài",
        "Vì server không giữ trạng thái — token đã phát sẽ hợp lệ tới khi hết hạn exp",
        "Vì trình duyệt cấm xoá JWT",
        "Vì JWT lưu trong database"
      ], correct: 1,
      explanation: "Stateless nghĩa là không có 'cuốn sổ' để xoá. Cách giảm rủi ro: exp ngắn (5–15 phút) + refresh token, hoặc thêm danh sách đen (nhưng thế là lại stateful)." },
    { q: "Kẻ gian sửa claim role từ 'member' thành 'admin' trong JWT rồi gửi lên. Chuyện gì xảy ra?", options: [
        "Server cấp quyền admin vì payload nói vậy",
        "Server tính lại chữ ký thấy lệch (kẻ gian không có khoá bí mật) → từ chối token",
        "JWT tự sửa lại về member",
        "Trình duyệt chặn request"
      ], correct: 1,
      explanation: "Chữ ký được tính trên toàn bộ header + payload bằng khoá bí mật. Sửa payload mà không có khoá → signature không khớp → 401." }
  ]
});
