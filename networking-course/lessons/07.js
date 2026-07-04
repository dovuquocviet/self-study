window.LESSONS.push({
  id: "07",
  phase: "3", phaseName: "Tầng vận chuyển",
  title: "TCP: bắt tay 3 bước & độ tin cậy",
  subtitle: "SYN / SYN-ACK / ACK, số seq/ack, và gửi lại khi mất gói",

  theory: `
    <p>Tầng mạng (IP) chỉ hứa "cố gắng giao gói", không đảm bảo gói tới nơi, tới đúng thứ tự, hay không
    bị nhân đôi. <strong>TCP</strong> đứng ở tầng vận chuyển để biến kênh 'may rủi' đó thành một dòng dữ
    liệu <em>tin cậy, đúng thứ tự</em> — như một cuộc gọi điện thoại đã được nối máy rõ ràng.</p>
    <p>Trước khi gửi dữ liệu, hai bên phải <strong>bắt tay ba bước (three-way handshake)</strong> để
    thống nhất bắt đầu:</p>
    <ul>
      <li><strong>SYN</strong>: client nói "tôi muốn kết nối, số thứ tự của tôi bắt đầu từ x".</li>
      <li><strong>SYN-ACK</strong>: server đáp "ok, tôi nhận x; số của tôi bắt đầu từ y".</li>
      <li><strong>ACK</strong>: client xác nhận "tôi nhận y". Giờ kênh đã sẵn sàng.</li>
    </ul>
    <p>Sau đó, mỗi byte dữ liệu được đánh <strong>số thứ tự (seq)</strong>. Bên nhận báo lại
    <strong>số xác nhận (ack)</strong> = "tôi đã nhận tới đây, gửi tiếp phần sau". Nếu một gói mất, bên
    nhận không ack tới đó; sau một khoảng chờ, bên gửi <strong>gửi lại (retransmit)</strong> phần thiếu.</p>
    <div class="callout"><p>💡 Nhờ seq/ack, TCP tự ráp lại đúng thứ tự dù các gói tới lộn xộn, và tự phát
    hiện phần nào bị mất để gửi lại — ứng dụng bên trên chỉ thấy một dòng dữ liệu liền mạch, sạch sẽ.</p></div>
  `,

  codeTabs: [
    { id: "hand", label: "🤝 Bắt tay 3 bước", lines: [
      "# Client và server thống nhất trước khi gửi dữ liệu",
      "client -> server : SYN     seq=100          # bước 1",
      "server -> client : SYN-ACK seq=300 ack=101  # bước 2",
      "client -> server : ACK             ack=301  # bước 3",
      "",
      "# ack=101 nghĩa: 'đã nhận seq 100, chờ 101 tiếp'",
      "# xong bắt tay → kênh tin cậy sẵn sàng"
    ]},
    { id: "rel", label: "📮 Gửi lại khi mất gói", lines: [
      "# Mỗi đoạn có seq; bên nhận ack phần đã nhận",
      "gui  seq=101 (data A)  ->  ack=201  # nhận ok",
      "gui  seq=201 (data B)  ->  (mất!)   # không có ack",
      "... hết thời gian chờ ...",
      "gui LAI seq=201 (data B) ->  ack=301  # retransmit",
      "# → dữ liệu tới đủ và đúng thứ tự"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cli"><div class="nl">💻 Client</div><div class="ns">muốn mở kết nối TCP</div></div>
    <div class="arrow" id="a1">↓ SYN (seq=100)</div>
    <div class="node" id="srv"><div class="nl">🖥️ Server</div><div class="ns">↑ SYN-ACK (seq=300, ack=101)</div></div>
    <div class="arrow" id="a2">↓ ACK (ack=301) — kênh sẵn sàng</div>
    <div class="node" id="data"><div class="nl">🔄 Truyền dữ liệu</div><div class="ns">đánh seq, nhận ack từng phần</div></div>
    <div class="arrow" id="a3">↓ gói mất → hết chờ → gửi lại</div>
    <div class="node" id="ok"><div class="nl">✅ Dòng dữ liệu tin cậy</div><div class="ns">đủ, đúng thứ tự, không trùng</div></div>
  `,
  steps: [
    { title: "1 · Client gửi SYN", tab: "hand", highlight: [2], on: ["cli", "a1"],
      desc: "Client mở lời bằng <strong>SYN</strong>, kèm số thứ tự khởi đầu <code>seq=100</code>. Giống việc nhấc máy và nói 'A lô, tôi muốn nói chuyện'." },
    { title: "2 · Server đáp SYN-ACK", tab: "hand", highlight: [3], on: ["cli", "srv"],
      desc: "Server trả <strong>SYN-ACK</strong>: vừa xác nhận đã nhận (<code>ack=101</code>), vừa gửi số khởi đầu của mình (<code>seq=300</code>). 'Nghe rõ, tôi cũng sẵn sàng'." },
    { title: "3 · Client gửi ACK", tab: "hand", highlight: [4, 6], on: ["srv", "a2", "data"],
      desc: "Client xác nhận lần cuối bằng <strong>ACK</strong> (<code>ack=301</code>). Bắt tay xong — kênh <em>tin cậy</em> đã thiết lập, bắt đầu truyền dữ liệu." },
    { title: "4 · Đánh số & xác nhận", tab: "rel", highlight: [2], on: ["data"],
      desc: "Mỗi đoạn dữ liệu mang <strong>seq</strong>; bên nhận báo lại <strong>ack</strong> = 'đã nhận tới đây'. Nhờ đó dữ liệu tự ráp đúng thứ tự dù gói tới lộn xộn." },
    { title: "5 · Mất gói thì gửi lại", tab: "rel", highlight: [3, 4, 5], on: ["data", "a3", "ok"],
      desc: "Nếu một đoạn mất, bên nhận không ack tới đó. Hết thời gian chờ, bên gửi <strong>retransmit</strong> phần thiếu — bảo đảm dòng dữ liệu cuối cùng đầy đủ và sạch." }
  ],

  quiz: [
    { q: "Ba bước của bắt tay TCP theo đúng thứ tự là gì?", options: [
        "ACK → SYN → SYN-ACK",
        "SYN → SYN-ACK → ACK",
        "SYN → ACK → SYN-ACK",
        "SYN-ACK → SYN → ACK"
      ], correct: 1,
      explanation: "Client gửi SYN, server đáp SYN-ACK, client trả ACK — sau đó kênh tin cậy sẵn sàng truyền dữ liệu." },
    { q: "Số xác nhận (ack) trong TCP mang ý nghĩa gì?", options: [
        "Tổng số byte của cả file",
        "Địa chỉ IP của bên gửi",
        "'Tôi đã nhận tới đây rồi, hãy gửi tiếp phần sau'",
        "Số router mà gói đã đi qua"
      ], correct: 2,
      explanation: "ack cho biết bên nhận đã nhận tới byte nào và đang chờ byte tiếp theo; nó là nền tảng của độ tin cậy." },
    { q: "Khi một gói TCP bị mất trên đường, điều gì xảy ra?", options: [
        "Cả kết nối bị đóng ngay lập tức",
        "Bên nhận không ack phần đó; sau khi hết chờ, bên gửi gửi lại (retransmit)",
        "Dữ liệu tới nơi nhưng bị thiếu vĩnh viễn",
        "Router tự tạo lại gói đã mất"
      ], correct: 1,
      explanation: "Thiếu ack là tín hiệu mất gói; TCP chờ hết thời gian rồi gửi lại phần thiếu, đảm bảo dữ liệu đủ." },
    { q: "Vì sao cần TCP khi tầng IP đã chuyển được gói tin?", options: [
        "Vì IP tự bản thân không đảm bảo gói tới đủ, đúng thứ tự hay không trùng lặp",
        "Vì IP không thể định tuyến qua router",
        "Vì IP không có địa chỉ đích",
        "Vì IP chỉ chạy trong LAN"
      ], correct: 0,
      explanation: "IP chỉ 'cố gắng giao'; TCP thêm seq/ack và retransmit để biến kênh may rủi thành dòng dữ liệu tin cậy, đúng thứ tự." }
  ]
});
