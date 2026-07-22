window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Authentication vs Authorization — 'bạn là ai' vs 'bạn được làm gì'",
  subtitle: "Hai câu hỏi khác nhau mà mọi hệ thống đăng nhập đều phải trả lời",

  theory: `
    <p>Hãy tưởng tượng bạn đến một toà nhà văn phòng. Ở sảnh, bảo vệ kiểm tra
    <strong>thẻ nhân viên</strong> của bạn — xác nhận bạn đúng là "Nguyễn Văn A, phòng Kỹ thuật".
    Đó là <strong>Authentication (AuthN)</strong> — <em>xác thực</em>: chứng minh <em>bạn là ai</em>.</p>
    <p>Nhưng có thẻ không có nghĩa là vào được mọi phòng. Thẻ của bạn mở được tầng 3 (phòng Kỹ thuật)
    nhưng <em>không</em> mở được phòng server hay phòng Giám đốc. Đó là
    <strong>Authorization (AuthZ)</strong> — <em>phân quyền / uỷ quyền</em>: quyết định <em>bạn được làm gì</em>.</p>
    <ul>
      <li><strong>Authentication</strong> trả lời: "Ai đang gõ cửa?" — bằng mật khẩu, OTP, vân tay, Face ID…</li>
      <li><strong>Authorization</strong> trả lời: "Người này có được phép làm việc X không?" — bằng vai trò (role), quyền (permission), scope…</li>
    </ul>
    <p>Trên web, hai bước này ánh xạ thẳng vào 2 mã lỗi HTTP hay bị nhầm:</p>
    <ul>
      <li><code>401 Unauthorized</code> — thực ra nghĩa là <em>"chưa xác thực"</em> (chưa đăng nhập / token sai). Tên lỗi đặt hơi… sai, nhưng lịch sử để lại.</li>
      <li><code>403 Forbidden</code> — <em>"đã biết bạn là ai, nhưng bạn không có quyền"</em>.</li>
    </ul>
    <div class="callout"><p>💡 Mẹo nhớ: <strong>AuthN</strong> = <strong>N</strong>ame (bạn tên gì / là ai).
    <strong>AuthZ</strong> = <strong>Z</strong>one (bạn được vào vùng nào). Mọi khái niệm sau này của khoá —
    session, token, OAuth, SSO — đều chỉ là các cách <em>triển khai</em> hai câu hỏi này.</p></div>
  `,

  codeTabs: [
    { id: "authn", label: "🪪 Authentication", lines: [
      "# Client chứng minh mình là ai (đăng nhập)",
      "POST /login HTTP/1.1",
      "Content-Type: application/json",
      "",
      "{ \"email\": \"an@example.com\", \"password\": \"s3cret\" }",
      "",
      "# Server kiểm tra đúng -> cấp 'giấy thông hành' (session/token)",
      "HTTP/1.1 200 OK",
      "Set-Cookie: session=abc123; HttpOnly"
    ]},
    { id: "authz", label: "🚪 Authorization", lines: [
      "# Đã đăng nhập, giờ thử XOÁ một bài viết của người khác",
      "DELETE /posts/42 HTTP/1.1",
      "Cookie: session=abc123",
      "",
      "# Server biết bạn là 'an' (authN ok)…",
      "# …nhưng bài 42 thuộc về 'binh', và 'an' không phải admin",
      "HTTP/1.1 403 Forbidden",
      "",
      "# Còn nếu chưa đăng nhập mà gọi thì:",
      "HTTP/1.1 401 Unauthorized   # 'chưa xác thực' — tên hơi gây hiểu lầm"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">🧑‍💻 Người dùng</div><div class="ns">muốn xoá bài viết #42</div></div>
    <div class="arrow" id="a1">↓ 1. đăng nhập (email + mật khẩu)</div>
    <div class="node" id="authn"><div class="nl">🪪 Authentication</div><div class="ns">"Bạn là ai?" — so mật khẩu, cấp session</div></div>
    <div class="arrow" id="a2">↓ 2. gửi request kèm session</div>
    <div class="node" id="authz"><div class="nl">🚪 Authorization</div><div class="ns">"Bạn có quyền xoá bài này không?"</div></div>
    <div class="arrow" id="a3">↓ 3. quyết định</div>
    <div class="node" id="result"><div class="nl">⚖️ Kết quả</div><div class="ns">200 OK · 401 chưa đăng nhập · 403 không đủ quyền</div></div>
  `,
  steps: [
    { title: "1 · Người dùng đăng nhập", tab: "authn", highlight: [2, 5], on: ["user", "a1", "authn"],
      desc: "Người dùng gửi email + mật khẩu. Đây là bước <strong>Authentication</strong>: chứng minh 'tôi đúng là an@example.com'. Mật khẩu chỉ là một trong nhiều cách — có thể là OTP, vân tay, Face ID…" },
    { title: "2 · Server cấp giấy thông hành", tab: "authn", highlight: [8, 9], on: ["authn"],
      desc: "Mật khẩu khớp → server cấp một <em>giấy thông hành</em> (ở đây là cookie session). Từ giờ mỗi request kèm giấy này, server biết ngay 'à, đây là an' mà không cần hỏi mật khẩu lại." },
    { title: "3 · Request kèm session", tab: "authz", highlight: [2, 3], on: ["a2", "authz"],
      desc: "Người dùng bấm nút xoá bài #42. Trình duyệt tự đính kèm cookie session. Server nhìn session → biết <em>ai</em> đang gọi. AuthN xong, giờ tới câu hỏi thứ hai." },
    { title: "4 · Kiểm tra quyền", tab: "authz", highlight: [5, 6], on: ["authz", "a3"],
      desc: "Đây là <strong>Authorization</strong>: bài #42 thuộc về 'binh', còn 'an' không phải admin. Biết bạn là ai ≠ cho bạn làm mọi thứ — giống thẻ nhân viên không mở được phòng Giám đốc." },
    { title: "5 · 403 vs 401", tab: "authz", highlight: [7, 10], on: ["result"],
      desc: "Không đủ quyền → <code>403 Forbidden</code>. Còn nếu ngay từ đầu <em>chưa đăng nhập</em> → <code>401 Unauthorized</code> (nghĩa thật: 'chưa xác thực'). Nhớ cặp này là phân biệt được AuthN/AuthZ trong mọi API." }
  ],

  quiz: [
    { q: "Authentication (AuthN) trả lời câu hỏi nào?", options: [
        "Bạn được phép làm gì?",
        "Bạn là ai?",
        "Bạn đang ở đâu?",
        "Bạn dùng trình duyệt nào?"
      ], correct: 1,
      explanation: "AuthN = xác thực danh tính ('bạn là ai') — bằng mật khẩu, OTP, sinh trắc học… Còn 'bạn được làm gì' là Authorization." },
    { q: "Đã đăng nhập thành công nhưng gọi API xoá bài của người khác thì thường nhận mã lỗi nào?", options: [
        "401 Unauthorized",
        "404 Not Found",
        "403 Forbidden",
        "500 Internal Server Error"
      ], correct: 2,
      explanation: "Server đã biết bạn là ai (authN ok) nhưng bạn không có quyền → 403 Forbidden. 401 dành cho trường hợp chưa xác thực." },
    { q: "Vì sao nói tên mã lỗi 401 Unauthorized 'đặt hơi sai'?", options: [
        "Vì nó thực ra nghĩa là 'chưa xác thực' (unauthenticated), không phải 'không đủ quyền'",
        "Vì nó chỉ dùng được cho trang HTML",
        "Vì đúng ra phải là mã 400",
        "Vì trình duyệt không hiểu mã này"
      ], correct: 0,
      explanation: "401 được trả khi thiếu/sai thông tin xác thực (chưa đăng nhập, token hết hạn). Trường hợp 'biết bạn là ai nhưng cấm' mới là 403." },
    { q: "Trong ví dụ toà nhà văn phòng, việc 'thẻ của bạn không mở được phòng server' minh hoạ khái niệm nào?", options: [
        "Authentication",
        "Authorization",
        "Encryption",
        "Session"
      ], correct: 1,
      explanation: "Thẻ đã xác nhận bạn là ai (authN xong), nhưng vùng nào được vào là chuyện phân quyền — Authorization (AuthZ = Zone)." }
  ]
});
