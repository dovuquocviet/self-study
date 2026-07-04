window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Tổng quan",
  title: "Mạng máy tính là gì?",
  subtitle: "Host, gói tin, và mô hình client — server",

  theory: `
    <p>Một <strong>mạng máy tính</strong> đơn giản là nhiều <strong>host</strong> (máy tính, điện thoại,
    server, TV…) được nối với nhau để <em>trao đổi dữ liệu</em>. Mỗi host có một <strong>địa chỉ</strong>
    để những host khác biết đường gửi dữ liệu tới.</p>
    <p>Dữ liệu không đi thành một khối lớn. Nó bị cắt nhỏ thành các <strong>gói tin (packet)</strong> —
    mỗi gói mang một phần dữ liệu cộng thêm "nhãn" ghi rõ <em>từ đâu</em>, <em>tới đâu</em>. Các gói đi
    độc lập qua mạng rồi được ráp lại ở đích. Cắt nhỏ như vậy giúp nhiều cuộc trao đổi cùng dùng chung
    một sợi cáp mà không ai phải chờ ai độc chiếm.</p>
    <ul>
      <li><strong>LAN</strong> (Local Area Network): mạng nội bộ nhỏ — nhà bạn, một văn phòng.</li>
      <li><strong>Internet</strong>: "mạng của các mạng" — hàng triệu LAN nối lại qua các router.</li>
      <li><strong>Client — Server</strong>: kiểu giao tiếp phổ biến nhất. <em>Client</em> (trình duyệt,
          app) <strong>gửi yêu cầu (request)</strong>; <em>server</em> xử lý và <strong>trả lời
          (response)</strong>.</li>
    </ul>
    <div class="callout"><p>💡 Câu hỏi xuyên suốt khoá học: <em>"Một gói tin đi từ máy tôi tới server ở
    bên kia thế giới bằng cách nào?"</em> Bài này trả lời ý tưởng tổng quát; các bài sau mổ xẻ từng tầng.</p></div>
  `,

  codeTabs: [
    { id: "req", label: "📤 Client gửi request", lines: [
      "# Trình duyệt (client) hỏi server: 'cho tôi trang chủ'",
      "$ curl https://example.com/",
      "",
      "GET / HTTP/1.1          # phương thức + đường dẫn",
      "Host: example.com       # gửi tới host nào",
      "Accept: text/html",
      "# → gói tin này được đóng nhãn 'tới example.com' rồi rời máy bạn"
    ]},
    { id: "res", label: "📥 Server trả response", lines: [
      "HTTP/1.1 200 OK         # 200 = thành công",
      "Content-Type: text/html",
      "Content-Length: 1256",
      "",
      "<!doctype html>",
      "<html> ... trang chủ ... </html>",
      "# → server đóng gói câu trả lời, gửi ngược về địa chỉ của bạn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">💻 Client (máy bạn)</div><div class="ns">trình duyệt / app</div></div>
    <div class="arrow" id="a1">↓ request "GET /"</div>
    <div class="node" id="net"><div class="nl">🌐 Internet</div><div class="ns">chuỗi router chuyển tiếp gói tin</div></div>
    <div class="arrow" id="a2">↓ gói tin nhảy qua từng router</div>
    <div class="node" id="server"><div class="nl">🖥️ Server (example.com)</div><div class="ns">xử lý yêu cầu</div></div>
    <div class="arrow" id="a3">↑ response "200 OK"</div>
    <div class="node" id="done"><div class="nl">✅ Trang hiển thị</div><div class="ns">dữ liệu đã ráp lại xong</div></div>
  `,
  steps: [
    { title: "1 · Client tạo yêu cầu", tab: "req", highlight: [2, 4, 5], on: ["client"],
      desc: "Bạn gõ URL (hoặc app gọi API). Client soạn một <strong>request</strong> ghi rõ muốn gì (<code>GET /</code>) và gửi tới host nào (<code>Host: example.com</code>)." },
    { title: "2 · Cắt thành gói tin & rời máy", tab: "req", highlight: [7], on: ["client", "a1", "net"],
      desc: "Request được cắt thành <strong>gói tin</strong>, mỗi gói dán nhãn địa chỉ nguồn + đích, rồi đẩy ra mạng. Máy bạn không cần biết đường đi đầy đủ — chỉ cần giao cho router gần nhất." },
    { title: "3 · Định tuyến qua Internet", tab: "req", highlight: [], on: ["net", "a2", "server"],
      desc: "Mỗi <strong>router</strong> đọc nhãn đích và chuyển gói sang chặng kế tiếp — như bưu điện chuyển thư qua nhiều trạm. Các gói có thể đi đường khác nhau nhưng cùng tới <code>example.com</code>." },
    { title: "4 · Server xử lý & trả lời", tab: "res", highlight: [1, 5, 6], on: ["server", "a3", "done"],
      desc: "Server ráp các gói lại, hiểu yêu cầu, tạo <strong>response</strong> (<code>200 OK</code> + nội dung trang) rồi lại cắt nhỏ và gửi ngược về địa chỉ của bạn." },
    { title: "5 · Client ráp lại & hiển thị", tab: "res", highlight: [4, 5], on: ["done"],
      desc: "Client nhận đủ gói, ráp lại thành trang HTML và vẽ ra màn hình. Cả vòng đi–về này thường chỉ mất vài chục mili-giây." }
  ],

  quiz: [
    { q: "Vì sao dữ liệu được cắt thành các \"gói tin\" (packet) thay vì gửi nguyên khối?", options: [
        "Để mã hoá dữ liệu cho an toàn hơn",
        "Để nhiều cuộc trao đổi chia sẻ chung đường truyền và gói lỗi chỉ cần gửi lại phần nhỏ",
        "Vì cáp mạng không thể mang dữ liệu lớn",
        "Để server chạy nhanh hơn"
      ], correct: 1,
      explanation: "Chia gói giúp ghép kênh (nhiều bên dùng chung một đường) và khi mất/hỏng thì chỉ gửi lại gói đó, không phải cả file." },
    { q: "Trong mô hình client — server, ai là bên chủ động khởi tạo giao tiếp?", options: [
        "Server luôn gọi client trước",
        "Client gửi request trước, server trả response",
        "Cả hai gửi cùng lúc",
        "Router quyết định ai gửi trước"
      ], correct: 1,
      explanation: "Client (trình duyệt/app) chủ động gửi yêu cầu; server lắng nghe và phản hồi lại." },
    { q: "\"Internet\" khác một mạng LAN ở điểm nào?", options: [
        "Internet chỉ dùng cho web, LAN dùng cho game",
        "LAN nhanh hơn Internet nên không cần router",
        "Internet là nhiều mạng (LAN) nối với nhau qua các router — một 'mạng của các mạng'",
        "Chúng là hai tên gọi của cùng một thứ"
      ], correct: 2,
      explanation: "LAN là mạng nội bộ nhỏ; Internet ghép vô số mạng như vậy lại bằng hệ thống router toàn cầu." },
    { q: "Mỗi gói tin cần mang theo thông tin gì để tới đúng đích?", options: [
        "Tên người dùng và mật khẩu",
        "Địa chỉ nguồn và địa chỉ đích",
        "Toàn bộ đường đi chi tiết qua từng router",
        "Tốc độ đường truyền"
      ], correct: 1,
      explanation: "Gói chỉ cần biết nó từ đâu và tới đâu; việc chọn đường đi cụ thể là do các router dọc đường quyết định từng chặng." }
  ]
});
