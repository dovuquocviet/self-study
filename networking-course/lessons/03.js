window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Mô hình phân tầng",
  title: "OSI 7 tầng vs TCP/IP 4 tầng",
  subtitle: "Bảng ánh xạ hai mô hình và mỗi tầng làm gì",

  theory: `
    <p>Có hai "bản đồ" nổi tiếng mô tả cách chia tầng. <strong>OSI</strong> là mô hình lý thuyết 7 tầng,
    rất chi tiết, dùng để <em>giảng dạy và phân tích</em>. <strong>TCP/IP</strong> là mô hình thực tế
    4 tầng — chính là thứ Internet đang chạy hằng ngày.</p>
    <p>Đừng học thuộc lòng theo kiểu vẹt. Hãy nhớ ý tưởng: cả hai đều xếp từ <em>gần con người</em>
    (ứng dụng, dữ liệu có ý nghĩa) xuống <em>gần phần cứng</em> (bit, tín hiệu điện). TCP/IP đơn giản
    gộp vài tầng OSI lại với nhau.</p>
    <table>
      <tr><th>OSI (7 tầng)</th><th>TCP/IP (4 tầng)</th><th>Việc chính</th></tr>
      <tr><td>7 Application, 6 Presentation, 5 Session</td><td>Application</td><td>HTTP, DNS, TLS — dữ liệu có ý nghĩa với app</td></tr>
      <tr><td>4 Transport</td><td>Transport</td><td>TCP/UDP — cổng, tin cậy, thứ tự</td></tr>
      <tr><td>3 Network</td><td>Internet</td><td>IP — địa chỉ và định tuyến giữa các mạng</td></tr>
      <tr><td>2 Data Link, 1 Physical</td><td>Link</td><td>Ethernet/Wi-Fi — khung, MAC, bit trên dây</td></tr>
    </table>
    <ul>
      <li><strong>Application</strong>: nơi HTTP, DNS, SMTP sống — dữ liệu con người hiểu được.</li>
      <li><strong>Transport</strong>: TCP (tin cậy) hoặc UDP (nhanh, đơn giản); quản lý cổng.</li>
      <li><strong>Internet/Network</strong>: gói IP nhảy qua các router để tới đúng mạng đích.</li>
      <li><strong>Link</strong>: đưa dữ liệu qua <em>một</em> chặng vật lý — cáp, Wi-Fi.</li>
    </ul>
    <div class="callout"><p>💡 Mẹo nhớ tên khi gói tin đi qua từng tầng: ở tầng Transport gọi là
    <strong>segment</strong> (TCP) / <strong>datagram</strong> (UDP), tầng Internet gọi là
    <strong>packet</strong>, tầng Link gọi là <strong>frame</strong>.</p></div>
  `,

  codeTabs: [
    { id: "osi", label: "🗂️ 7 tầng OSI", lines: [
      "# Từ trên (gần người) xuống dưới (gần phần cứng)",
      "7 Application   # HTTP, DNS, SMTP",
      "6 Presentation  # mã hoá, nén, định dạng",
      "5 Session       # quản lý phiên",
      "4 Transport     # TCP / UDP, cổng",
      "3 Network       # IP, định tuyến",
      "2 Data Link     # MAC, khung Ethernet",
      "1 Physical      # bit, tín hiệu điện/quang"
    ]},
    { id: "tcpip", label: "📚 4 tầng TCP/IP", lines: [
      "# Mô hình thực tế Internet đang chạy",
      "Application  # gộp OSI 5-6-7 (HTTP, DNS, TLS)",
      "Transport    # TCP / UDP — tin cậy & cổng",
      "Internet     # IP — địa chỉ & định tuyến",
      "Link         # gộp OSI 1-2 (Ethernet, Wi-Fi)",
      "# → ít tầng hơn, sát thực tế hơn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="l4"><div class="nl">📝 Application</div><div class="ns">HTTP · DNS · TLS (OSI 5-6-7)</div></div>
    <div class="arrow" id="a1">↓ dữ liệu ứng dụng</div>
    <div class="node" id="l3"><div class="nl">🚚 Transport</div><div class="ns">TCP / UDP · cổng (OSI 4)</div></div>
    <div class="arrow" id="a2">↓ segment / datagram</div>
    <div class="node" id="l2"><div class="nl">🗺️ Internet</div><div class="ns">IP · định tuyến (OSI 3)</div></div>
    <div class="arrow" id="a3">↓ packet</div>
    <div class="node" id="l1"><div class="nl">🔌 Link</div><div class="ns">Ethernet / Wi-Fi (OSI 1-2)</div></div>
  `,
  steps: [
    { title: "1 · Hai bản đồ, cùng ý tưởng", tab: "osi", highlight: [1], on: ["l4", "l1"],
      desc: "Cả OSI lẫn TCP/IP đều xếp tầng từ <em>gần con người</em> xuống <em>gần phần cứng</em>. OSI chi tiết để học; TCP/IP gọn để chạy thật." },
    { title: "2 · Tầng Application", tab: "tcpip", highlight: [2], on: ["l4"],
      desc: "TCP/IP gộp ba tầng trên cùng của OSI (Session, Presentation, Application) thành một <strong>Application</strong> — nơi HTTP, DNS, TLS sống." },
    { title: "3 · Tầng Transport", tab: "tcpip", highlight: [3], on: ["l4", "a1", "l3"],
      desc: "Cả hai mô hình đều có tầng <strong>Transport</strong> giống hệt: TCP cho tin cậy, UDP cho nhanh gọn; đây là nơi khái niệm <em>cổng</em> xuất hiện." },
    { title: "4 · Internet & Link", tab: "tcpip", highlight: [4, 5], on: ["l3", "a2", "l2", "a3", "l1"],
      desc: "Tầng <strong>Internet</strong> (IP) lo định tuyến giữa các mạng; tầng <strong>Link</strong> gộp Physical + Data Link của OSI, lo đưa <em>frame</em> qua một chặng vật lý." },
    { title: "5 · Tên gọi đổi theo tầng", tab: "osi", highlight: [5, 6, 7], on: ["l3", "l2", "l1"],
      desc: "Cùng một dữ liệu nhưng tên đổi: <strong>segment</strong> ở Transport, <strong>packet</strong> ở Network, <strong>frame</strong> ở Link. Biết tên giúp đọc tài liệu không rối." }
  ],

  quiz: [
    { q: "Mô hình nào là 'lý thuyết 7 tầng' và mô hình nào là 'thực tế 4 tầng'?", options: [
        "TCP/IP là 7 tầng, OSI là 4 tầng",
        "OSI là 7 tầng lý thuyết, TCP/IP là 4 tầng thực tế",
        "Cả hai đều 7 tầng",
        "Cả hai đều 4 tầng"
      ], correct: 1,
      explanation: "OSI là mô hình tham chiếu 7 tầng dùng để giảng dạy; TCP/IP 4 tầng là mô hình mà Internet thực sự vận hành." },
    { q: "Trong TCP/IP, ba tầng trên cùng của OSI (5,6,7) được gộp thành tầng nào?", options: [
        "Transport",
        "Internet",
        "Link",
        "Application"
      ], correct: 3,
      explanation: "TCP/IP gộp Session + Presentation + Application của OSI thành một tầng Application duy nhất." },
    { q: "Tầng nào chịu trách nhiệm định tuyến gói tin giữa các mạng khác nhau?", options: [
        "Tầng Internet (Network) với giao thức IP",
        "Tầng Application",
        "Tầng Link",
        "Tầng Physical"
      ], correct: 0,
      explanation: "Tầng Internet/Network dùng IP để đánh địa chỉ và cho router chọn đường giữa các mạng." },
    { q: "Đơn vị dữ liệu ở tầng Link thường được gọi là gì?", options: [
        "Segment",
        "Packet",
        "Frame (khung)",
        "Message"
      ], correct: 2,
      explanation: "Ở tầng Link gọi là frame (khung); tầng Network gọi là packet; tầng Transport gọi là segment/datagram." }
  ]
});
