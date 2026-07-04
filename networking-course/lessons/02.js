window.LESSONS.push({
  id: "02",
  phase: "1", phaseName: "Mô hình phân tầng",
  title: "Phân tầng & đóng gói (encapsulation)",
  subtitle: "Vì sao chia tầng; header lồng nhau như phong bì trong phong bì",

  theory: `
    <p>Gửi dữ liệu qua mạng là một việc <em>khổng lồ</em>: phải chọn đường đi, phải đảm bảo không mất
    gói, phải nói đúng "ngôn ngữ" của ứng dụng… Nếu nhét tất cả vào một khối code thì không ai bảo trì nổi.
    Giải pháp là <strong>chia tầng (layering)</strong>: mỗi tầng lo đúng một việc và chỉ nói chuyện với
    tầng ngay trên và ngay dưới nó.</p>
    <p>Hãy tưởng tượng gửi một lá thư. Bạn viết <em>nội dung</em> (tầng ứng dụng). Bạn bỏ nó vào một
    <em>phong bì</em> ghi tên người nhận (một tầng thấp hơn). Bưu điện lại bỏ phong bì đó vào một
    <em>túi thư</em> ghi thành phố đích (tầng thấp hơn nữa). Mỗi trạm chỉ cần đọc lớp bao ngoài cùng
    <em>của mình</em>, không cần mở nội dung bên trong.</p>
    <p>Trong mạng, quá trình bọc thêm lớp bao gọi là <strong>đóng gói (encapsulation)</strong>. Mỗi tầng
    thêm vào phần đầu của mình — gọi là <strong>header</strong> — vào trước dữ liệu nhận từ tầng trên.
    Dữ liệu của tầng trên (kèm cả header của nó) trở thành <em>payload</em> của tầng dưới.</p>
    <ul>
      <li><strong>Tầng ứng dụng</strong> tạo dữ liệu: ví dụ một request HTTP.</li>
      <li><strong>Tầng vận chuyển</strong> thêm header TCP/UDP (số cổng, số thứ tự).</li>
      <li><strong>Tầng mạng</strong> thêm header IP (địa chỉ nguồn + đích).</li>
      <li><strong>Tầng liên kết</strong> thêm header khung (địa chỉ MAC) để đi tới chặng kế.</li>
    </ul>
    <div class="callout"><p>💡 Ở đích, quá trình ngược lại diễn ra: mỗi tầng <strong>gỡ (decapsulation)</strong>
    đúng lớp header của mình rồi đưa phần còn lại lên tầng trên — như bóc từng lớp phong bì.</p></div>
  `,

  codeTabs: [
    { id: "encap", label: "📦 Đóng gói (bên gửi)", lines: [
      "# Tầng trên đưa dữ liệu xuống, mỗi tầng bọc thêm header",
      "[App]   : GET / HTTP/1.1 ...            # dữ liệu gốc",
      "[TCP]   : [port 443][seq] + data        # thêm header TCP",
      "[IP]    : [src 192.168.1.5][dst ...] + data",
      "[Eth]   : [MAC nguon][MAC dich] + data  # khung ra dây",
      "# → càng xuống dưới, phong bì càng nhiều lớp"
    ]},
    { id: "decap", label: "📭 Gỡ gói (bên nhận)", lines: [
      "# Bên nhận bóc ngược từng lớp, đưa dần lên trên",
      "[Eth]   : bóc header khung, kiem tra MAC dich",
      "[IP]    : bóc header IP, kiem tra dia chi dich",
      "[TCP]   : bóc header TCP, sap xep theo seq",
      "[App]   : con lai GET / HTTP/1.1 ...    # dữ liệu gốc!",
      "# → mỗi tầng chỉ đọc đúng phần của mình"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📝 Tầng ứng dụng</div><div class="ns">tạo dữ liệu (HTTP request)</div></div>
    <div class="arrow" id="a1">↓ bọc header TCP (cổng, seq)</div>
    <div class="node" id="tcp"><div class="nl">🚚 Tầng vận chuyển</div><div class="ns">[TCP | dữ liệu]</div></div>
    <div class="arrow" id="a2">↓ bọc header IP (địa chỉ nguồn/đích)</div>
    <div class="node" id="ip"><div class="nl">🗺️ Tầng mạng</div><div class="ns">[IP | TCP | dữ liệu]</div></div>
    <div class="arrow" id="a3">↓ bọc header khung (MAC) rồi ra dây</div>
    <div class="node" id="eth"><div class="nl">🔌 Tầng liên kết</div><div class="ns">[Eth | IP | TCP | dữ liệu] → bit trên cáp</div></div>
  `,
  steps: [
    { title: "1 · Ứng dụng tạo dữ liệu", tab: "encap", highlight: [2], on: ["app"],
      desc: "Trình duyệt tạo một <strong>HTTP request</strong>. Ở đây nó chưa quan tâm đường đi hay địa chỉ — chỉ lo <em>nội dung</em> muốn gửi, giống như bạn viết xong lá thư." },
    { title: "2 · Vận chuyển bọc header TCP", tab: "encap", highlight: [3], on: ["app", "a1", "tcp"],
      desc: "Tầng vận chuyển thêm <strong>header TCP</strong> ghi số cổng và số thứ tự (seq). Dữ liệu HTTP nay thành <em>payload</em> nằm trong phong bì TCP." },
    { title: "3 · Mạng bọc header IP", tab: "encap", highlight: [4], on: ["tcp", "a2", "ip"],
      desc: "Tầng mạng thêm <strong>header IP</strong> chứa <code>địa chỉ nguồn</code> và <code>địa chỉ đích</code> — đây là 'phong bì' mà các router dọc đường sẽ đọc để chọn chặng." },
    { title: "4 · Liên kết bọc khung & ra dây", tab: "encap", highlight: [5], on: ["ip", "a3", "eth"],
      desc: "Tầng liên kết thêm <strong>header khung</strong> với địa chỉ MAC của chặng kế, rồi đẩy thành các bit trên cáp/sóng. Giờ có đủ 4 lớp phong bì lồng nhau." },
    { title: "5 · Bên nhận bóc ngược", tab: "decap", highlight: [2, 3, 4, 5], on: ["eth", "ip", "tcp", "app"],
      desc: "Ở đích, mỗi tầng <strong>gỡ đúng lớp của mình</strong> rồi đưa phần còn lại lên trên: khung → IP → TCP → cuối cùng lộ ra HTTP request nguyên vẹn." }
  ],

  quiz: [
    { q: "Lợi ích chính của việc chia mạng thành nhiều tầng là gì?", options: [
        "Làm dữ liệu truyền nhanh hơn nhờ nén",
        "Mỗi tầng lo một việc độc lập, dễ thiết kế và thay thế mà không đụng tầng khác",
        "Giảm số lượng router cần dùng",
        "Bắt buộc mọi ứng dụng phải mã hoá dữ liệu"
      ], correct: 1,
      explanation: "Phân tầng tách trách nhiệm: bạn có thể đổi công nghệ ở một tầng (ví dụ Wi-Fi thay Ethernet) mà các tầng khác không cần biết." },
    { q: "\"Đóng gói (encapsulation)\" nghĩa là gì?", options: [
        "Mã hoá dữ liệu để không ai đọc được",
        "Nén dữ liệu cho nhỏ lại",
        "Mỗi tầng thêm header của mình vào trước dữ liệu nhận từ tầng trên",
        "Chia file thành nhiều phần bằng nhau"
      ], correct: 2,
      explanation: "Đóng gói là bọc thêm một lớp header ở mỗi tầng; dữ liệu tầng trên trở thành payload của tầng dưới." },
    { q: "Header của tầng nào chứa địa chỉ IP nguồn và đích?", options: [
        "Tầng mạng",
        "Tầng ứng dụng",
        "Tầng liên kết",
        "Tầng vận chuyển"
      ], correct: 0,
      explanation: "Địa chỉ IP nằm trong header của tầng mạng; đây là thứ các router đọc để định tuyến gói tin." },
    { q: "Ở phía nhận, thứ tự bóc các lớp phong bì diễn ra thế nào?", options: [
        "Ứng dụng trước, rồi tới khung Ethernet",
        "Ngẫu nhiên, tầng nào rảnh thì bóc",
        "Từ lớp ngoài cùng (khung) vào trong: khung → IP → TCP → ứng dụng",
        "Tất cả các tầng bóc cùng một lúc"
      ], correct: 2,
      explanation: "Gỡ gói đi ngược chiều đóng gói: bóc lớp ngoài cùng trước (tầng liên kết) rồi tiến dần lên tầng ứng dụng." }
  ]
});
