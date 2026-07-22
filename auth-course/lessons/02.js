window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "Session & Cookie — cách web 'nhớ' bạn đã đăng nhập",
  subtitle: "HTTP vốn 'mất trí nhớ' — session là cách chữa kinh điển nhất",

  theory: `
    <p>HTTP có một tính chất quan trọng: <strong>stateless</strong> — <em>không nhớ gì</em> giữa hai request.
    Bạn vừa đăng nhập xong, request tiếp theo server đã "quên" bạn là ai. Vậy sao ta vẫn lướt Facebook
    cả ngày mà không phải gõ lại mật khẩu mỗi lần bấm?</p>
    <p>Câu trả lời kinh điển: <strong>session + cookie</strong>, giống việc gửi xe:</p>
    <ul>
      <li>Bạn gửi xe (đăng nhập) → bảo vệ ghi sổ <em>"vé 1234 = xe SH màu đỏ"</em> và đưa bạn <strong>vé số 1234</strong>.</li>
      <li>Sổ của bảo vệ = <strong>session store</strong> trên server (ai đăng nhập, lúc nào, quyền gì).</li>
      <li>Tấm vé = <strong>session ID</strong> — một chuỗi ngẫu nhiên <em>vô nghĩa</em>, chỉ là chìa khoá tra sổ.</li>
      <li><strong>Cookie</strong> = cái túi trình duyệt tự động mang vé theo <em>mỗi request</em> về cùng website — bạn không phải làm gì cả.</li>
    </ul>
    <p>Vài cờ (flag) quan trọng khi server đặt cookie:</p>
    <ul>
      <li><code>HttpOnly</code> — JavaScript trong trang không đọc được cookie → hacker khó trộm vé qua lỗ hổng XSS.</li>
      <li><code>Secure</code> — chỉ gửi qua HTTPS, không gửi qua HTTP thường.</li>
      <li><code>SameSite</code> — hạn chế website khác "mượn" cookie của bạn để gửi request giả (chống CSRF).</li>
    </ul>
    <div class="callout"><p>💡 Điểm mấu chốt: với session, <strong>trạng thái nằm ở server</strong> (cuốn sổ).
    Muốn "đăng xuất từ xa" chỉ cần xoá dòng trong sổ — vé lập tức vô dụng. Bài sau ta sẽ gặp cách ngược lại:
    token tự chứa thông tin, server <em>không cần</em> giữ sổ.</p></div>
  `,

  codeTabs: [
    { id: "login", label: "🔑 Đăng nhập", lines: [
      "# 1. Trình duyệt gửi mật khẩu MỘT LẦN duy nhất",
      "POST /login HTTP/1.1",
      "Host: shop.example.com",
      "",
      "email=an@example.com&password=s3cret",
      "",
      "# 2. Server ghi 'sổ' rồi phát 'vé' qua Set-Cookie",
      "HTTP/1.1 200 OK",
      "Set-Cookie: sid=k9f3a1x7; HttpOnly; Secure; SameSite=Lax",
      "",
      "# Trong RAM/Redis của server (cuốn sổ):",
      "#   sid k9f3a1x7 -> { user: 'an', role: 'member', exp: ... }"
    ]},
    { id: "next", label: "🍪 Request sau đó", lines: [
      "# 3. Mọi request sau, trình duyệt TỰ đính kèm cookie",
      "GET /orders HTTP/1.1",
      "Host: shop.example.com",
      "Cookie: sid=k9f3a1x7",
      "",
      "# 4. Server tra sổ: k9f3a1x7 -> user 'an' -> trả đơn hàng của an",
      "HTTP/1.1 200 OK",
      "",
      "[ { \"order\": 1001, \"total\": 250000 } ]"
    ]},
    { id: "logout", label: "🚪 Đăng xuất", lines: [
      "# 5. Đăng xuất = server XOÁ dòng trong sổ",
      "POST /logout HTTP/1.1",
      "Cookie: sid=k9f3a1x7",
      "",
      "HTTP/1.1 200 OK",
      "Set-Cookie: sid=; Max-Age=0   # bảo trình duyệt vứt vé luôn",
      "",
      "# Vé k9f3a1x7 giờ vô dụng — dù ai đó đã trộm được nó",
      "# Đây là điểm mạnh của session: thu hồi TỨC THÌ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="browser"><div class="nl">🌐 Trình duyệt</div><div class="ns">giữ cookie, tự gửi kèm mỗi request</div></div>
    <div class="arrow" id="a1">↓ POST /login (mật khẩu — 1 lần duy nhất)</div>
    <div class="node" id="server"><div class="nl">🖥️ Server</div><div class="ns">kiểm tra mật khẩu, phát session ID</div></div>
    <div class="arrow" id="a2">↓ ghi vào sổ</div>
    <div class="node" id="store"><div class="nl">📒 Session store</div><div class="ns">sid k9f3a1x7 → user 'an'</div></div>
    <div class="arrow" id="a3">↑ các request sau: Cookie: sid=k9f3a1x7</div>
    <div class="node" id="lookup"><div class="nl">🔎 Tra sổ mỗi request</div><div class="ns">vé hợp lệ? → biết ngay là 'an'</div></div>
  `,
  steps: [
    { title: "1 · Đăng nhập một lần", tab: "login", highlight: [2, 5], on: ["browser", "a1", "server"],
      desc: "Mật khẩu chỉ đi qua mạng <strong>một lần</strong> lúc đăng nhập. Sau đó không bao giờ gửi lại — thứ đi lại hằng ngày là tấm vé (session ID), không phải mật khẩu." },
    { title: "2 · Server phát vé + ghi sổ", tab: "login", highlight: [9, 11, 12], on: ["server", "a2", "store"],
      desc: "Server sinh chuỗi ngẫu nhiên <code>k9f3a1x7</code> làm session ID, ghi vào session store (RAM/Redis/DB): 'vé này = user an'. Rồi gửi vé về qua header <code>Set-Cookie</code> với các cờ <code>HttpOnly; Secure; SameSite</code>." },
    { title: "3 · Trình duyệt tự mang vé", tab: "next", highlight: [2, 4], on: ["browser", "a3"],
      desc: "Đây là việc của <strong>cookie</strong>: từ giờ, mọi request tới <code>shop.example.com</code> đều được trình duyệt <em>tự động</em> đính kèm <code>Cookie: sid=k9f3a1x7</code>. Lập trình viên frontend không phải viết dòng nào." },
    { title: "4 · Server tra sổ", tab: "next", highlight: [6, 7], on: ["lookup", "store"],
      desc: "Nhận request, server tra sổ: <code>k9f3a1x7</code> → user 'an'. Vé chỉ là chìa khoá tra cứu — bản thân nó <em>vô nghĩa</em>, mọi thông tin thật nằm ở server. Đây gọi là <strong>stateful</strong>: trạng thái ở phía server." },
    { title: "5 · Đăng xuất = xoá sổ", tab: "logout", highlight: [1, 5, 8, 9], on: ["server", "store"],
      desc: "Đăng xuất chỉ là xoá dòng trong sổ. Vé <code>k9f3a1x7</code> lập tức vô dụng — kể cả khi đã bị trộm. <strong>Thu hồi tức thì</strong> là ưu điểm lớn nhất của session so với token tự chứa (bài sau)." }
  ],

  quiz: [
    { q: "HTTP 'stateless' nghĩa là gì?", options: [
        "HTTP không mã hoá dữ liệu",
        "Server không tự nhớ gì giữa hai request — mỗi request là một lần 'gặp người lạ'",
        "HTTP chỉ chạy được trên một server",
        "Trình duyệt không lưu được dữ liệu"
      ], correct: 1,
      explanation: "Stateless = không trạng thái. Không có cơ chế bổ sung (cookie/session/token) thì request sau server đã quên bạn là ai." },
    { q: "Trong phép so sánh 'gửi xe', session ID tương ứng với gì?", options: [
        "Chiếc xe",
        "Cuốn sổ của bảo vệ",
        "Tấm vé số ngẫu nhiên",
        "Bãi đỗ xe"
      ], correct: 2,
      explanation: "Session ID = tấm vé — chuỗi ngẫu nhiên vô nghĩa dùng để tra sổ. Cuốn sổ (dữ liệu thật) là session store nằm trên server." },
    { q: "Cờ HttpOnly trên cookie có tác dụng gì?", options: [
        "Chỉ cho cookie gửi qua HTTP, cấm HTTPS",
        "JavaScript trong trang không đọc được cookie — giảm nguy cơ bị trộm qua XSS",
        "Cookie tự xoá sau 1 giờ",
        "Cookie chỉ dùng được trên máy tính, không dùng trên điện thoại"
      ], correct: 1,
      explanation: "HttpOnly chặn document.cookie đọc giá trị — script độc chèn vào trang (XSS) không trộm được session ID." },
    { q: "Vì sao session cho phép 'đăng xuất từ xa' (thu hồi tức thì)?", options: [
        "Vì cookie tự hết hạn rất nhanh",
        "Vì trạng thái nằm ở server — chỉ cần xoá bản ghi trong session store là vé vô dụng ngay",
        "Vì trình duyệt gửi mật khẩu lại mỗi request",
        "Vì session ID được mã hoá bằng RSA"
      ], correct: 1,
      explanation: "Server giữ 'cuốn sổ'. Xoá dòng trong sổ thì mọi vé trỏ tới nó vô dụng lập tức — không phải đợi hết hạn như token tự chứa." }
  ]
});
