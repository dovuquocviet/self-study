window.LESSONS.push({
  id: "04",
  phase: "2", phaseName: "Liên kết & Mạng",
  title: "Tầng liên kết: MAC, Ethernet, switch",
  subtitle: "Địa chỉ MAC, khung (frame) và cách switch học địa chỉ",

  theory: `
    <p>Tầng liên kết lo một việc rất cụ thể: đưa dữ liệu qua <em>một chặng</em> — từ máy bạn tới thiết bị
    kế bên trong cùng mạng nội bộ (LAN). Để làm được, mỗi card mạng có một <strong>địa chỉ MAC</strong>:
    một dãy 48 bit, viết dạng <code>a4:83:e7:1b:9c:0d</code>, được nhà sản xuất gán cố định.</p>
    <p>Ví như địa chỉ IP là "địa chỉ nhà" có thể đổi khi bạn chuyển chỗ, thì MAC giống <em>số khung xe</em>
    dập cứng vào thiết bị. Trong một LAN, các máy tìm nhau bằng MAC chứ không phải IP.</p>
    <p>Dữ liệu ở tầng này được bọc thành <strong>khung (frame)</strong>: gồm MAC nguồn, MAC đích, payload
    và một mã kiểm lỗi. Thiết bị nối các máy trong LAN là <strong>switch</strong>. Switch thông minh hơn
    hub cũ: nó <em>học</em> xem MAC nào nằm ở cổng nào, rồi chỉ gửi khung tới đúng cổng thay vì phát ra
    tất cả.</p>
    <ul>
      <li><strong>Học địa chỉ</strong>: khi một khung đi vào, switch ghi lại "MAC nguồn này ở cổng số X".</li>
      <li><strong>Chuyển tiếp có chọn lọc</strong>: nếu đã biết MAC đích ở cổng nào, chỉ gửi ra cổng đó.</li>
      <li><strong>Phát tràn (flooding)</strong>: nếu chưa biết đích, gửi ra mọi cổng (trừ cổng đến) để dò.</li>
    </ul>
    <div class="callout"><p>💡 MAC chỉ có ý nghĩa <em>trong phạm vi một chặng</em>. Khi gói tin đi qua router
    sang mạng khác, header IP giữ nguyên nhưng địa chỉ MAC nguồn/đích được <strong>viết lại</strong> cho
    chặng mới.</p></div>
  `,

  codeTabs: [
    { id: "mac", label: "🔎 Xem MAC & bảng ARP", lines: [
      "# Xem địa chỉ MAC của card mạng máy mình",
      "$ ip link show eth0",
      "  link/ether a4:83:e7:1b:9c:0d   # MAC 48-bit",
      "",
      "# Bảng ARP: ánh xạ IP trong LAN → MAC",
      "$ arp -a",
      "  192.168.1.1  ->  b8:27:eb:0a:11:22   # router",
      "  192.168.1.20 ->  3c:22:fb:7d:ee:01   # máy in"
    ]},
    { id: "frame", label: "📦 Cấu trúc một khung", lines: [
      "# Ethernet frame = phong bì của tầng liên kết",
      "[ MAC dich ][ MAC nguon ][ Type ][ payload ][ CRC ]",
      "  6 byte      6 byte       2       ...        4",
      "",
      "# Switch đọc 'MAC dich' để quyết định gửi ra cổng nào",
      "# CRC giúp phát hiện khung bị hỏng trên đường"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pc"><div class="nl">💻 Máy A</div><div class="ns">MAC a4:83:e7:1b:9c:0d</div></div>
    <div class="arrow" id="a1">↓ gửi khung [đích = MAC máy B]</div>
    <div class="node" id="sw"><div class="nl">🔀 Switch</div><div class="ns">học: MAC nào ở cổng nào</div></div>
    <div class="arrow" id="a2">↓ chuyển tiếp đúng cổng của B</div>
    <div class="node" id="pcb"><div class="nl">🖥️ Máy B</div><div class="ns">MAC 3c:22:fb:7d:ee:01</div></div>
  `,
  steps: [
    { title: "1 · Mỗi card có một MAC", tab: "mac", highlight: [2, 3], on: ["pc"],
      desc: "Card mạng máy A mang <strong>MAC cố định</strong> <code>a4:83:e7:1b:9c:0d</code>. Trong LAN, các máy nhận diện nhau bằng MAC chứ không phải IP." },
    { title: "2 · Đóng khung để gửi", tab: "frame", highlight: [2, 3], on: ["pc", "a1"],
      desc: "Dữ liệu được bọc thành <strong>khung</strong>: ghi MAC đích (máy B), MAC nguồn (máy A), payload và mã kiểm lỗi CRC. Khung này đi vào switch." },
    { title: "3 · Switch học địa chỉ", tab: "mac", highlight: [6, 7, 8], on: ["sw"],
      desc: "Khi khung đi vào, switch ghi vào bảng: 'MAC nguồn của A nằm ở cổng này'. Dần dần switch biết mọi máy ở cổng nào — không cần cấu hình tay." },
    { title: "4 · Chuyển tiếp có chọn lọc", tab: "frame", highlight: [5], on: ["sw", "a2", "pcb"],
      desc: "Switch đọc <strong>MAC đích</strong> trong khung. Nếu đã biết B ở cổng nào, nó chỉ gửi ra đúng cổng đó — tiết kiệm băng thông so với hub cũ phát ra mọi cổng." },
    { title: "5 · Khung tới đúng máy B", tab: "frame", highlight: [6], on: ["pcb"],
      desc: "Máy B nhận khung, dùng <strong>CRC</strong> kiểm tra không hỏng, bóc header khung rồi đưa payload lên tầng trên. Toàn bộ chỉ trong phạm vi một chặng LAN." }
  ],

  quiz: [
    { q: "Địa chỉ MAC khác địa chỉ IP ở điểm cốt lõi nào?", options: [
        "MAC do nhà sản xuất gán cố định cho card mạng, còn IP có thể thay đổi theo mạng",
        "MAC luôn dài hơn IP nên chậm hơn",
        "IP chỉ dùng trong LAN, MAC dùng cho Internet",
        "Không có khác biệt, chỉ là hai tên gọi"
      ], correct: 0,
      explanation: "MAC giống số khung xe dập cứng vào thiết bị; IP giống địa chỉ nhà, thay đổi khi máy đổi mạng." },
    { q: "Khi một switch nhận khung mà chưa biết MAC đích nằm ở cổng nào, nó làm gì?", options: [
        "Vứt bỏ khung",
        "Gửi khung ngược lại nơi gửi",
        "Phát tràn (flood) ra mọi cổng trừ cổng đến để dò tìm",
        "Hỏi router phải làm gì"
      ], correct: 2,
      explanation: "Chưa biết đích thì switch flood ra tất cả cổng; khi máy đích trả lời, switch học được cổng của nó cho lần sau." },
    { q: "Switch 'học địa chỉ' bằng cách nào?", options: [
        "Được người quản trị nhập tay từng MAC",
        "Ghi lại MAC nguồn của khung đi vào và cổng tương ứng",
        "Tải danh sách MAC từ Internet",
        "Đoán ngẫu nhiên rồi sửa sau"
      ], correct: 1,
      explanation: "Mỗi khung đi vào để lộ MAC nguồn; switch ghi 'MAC này ở cổng này' vào bảng địa chỉ, hoàn toàn tự động." },
    { q: "Khi gói tin đi qua router sang mạng khác, điều gì xảy ra với địa chỉ MAC?", options: [
        "MAC giữ nguyên suốt hành trình",
        "MAC nguồn/đích được viết lại cho chặng mới, còn địa chỉ IP giữ nguyên",
        "MAC bị xoá hoàn toàn",
        "Địa chỉ IP bị viết lại, MAC giữ nguyên"
      ], correct: 1,
      explanation: "MAC chỉ có ý nghĩa trong một chặng; qua mỗi router MAC được thay mới, nhưng địa chỉ IP đích vẫn giữ nguyên tới cùng." }
  ]
});
