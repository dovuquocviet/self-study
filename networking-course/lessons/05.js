window.LESSONS.push({
  id: "05",
  phase: "2", phaseName: "Liên kết & Mạng",
  title: "Địa chỉ IP & subnet mask",
  subtitle: "IPv4, public/private, subnet mask, CIDR /24, cùng mạng hay khác mạng",

  theory: `
    <p>Địa chỉ <strong>IPv4</strong> là bốn số 0–255 nối bằng dấu chấm, ví dụ <code>192.168.1.10</code>.
    Bên trong máy tính, nó chỉ là một chuỗi 32 bit. Địa chỉ IP giống <em>địa chỉ nhà</em>: nó cho biết
    máy nằm ở đâu để dữ liệu tìm tới.</p>
    <p>Một địa chỉ IP thực ra có hai phần: <strong>phần mạng</strong> (khu phố) và <strong>phần host</strong>
    (số nhà trong khu phố đó). Ranh giới giữa hai phần do <strong>subnet mask</strong> quyết định. Mask
    <code>255.255.255.0</code> nghĩa là 24 bit đầu là phần mạng — viết gọn theo kiểu <strong>CIDR</strong>
    là <code>/24</code>.</p>
    <p>Với mạng <code>192.168.1.0/24</code>: mọi địa chỉ từ <code>192.168.1.1</code> tới
    <code>192.168.1.254</code> <em>cùng một mạng</em> (cùng khu phố) và nói chuyện trực tiếp với nhau.
    Muốn gửi cho ai <em>khác mạng</em>, gói tin phải đi qua router.</p>
    <ul>
      <li><strong>IP private</strong>: <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>,
          <code>192.168.0.0/16</code> — chỉ dùng nội bộ, không định tuyến ra Internet.</li>
      <li><strong>IP public</strong>: địa chỉ duy nhất toàn cầu mà nhà mạng cấp cho router của bạn.</li>
      <li><strong>Cùng mạng?</strong> So sánh <em>phần mạng</em> của hai IP (theo mask). Giống nhau = cùng
          mạng, gửi thẳng; khác nhau = phải qua gateway.</li>
    </ul>
    <div class="callout"><p>💡 Cách kiểm tra 'cùng mạng': lấy IP AND với mask ra <strong>địa chỉ mạng</strong>.
    Nếu hai máy ra cùng địa chỉ mạng thì chúng ở chung khu phố và không cần router để nói chuyện.</p></div>
  `,

  codeTabs: [
    { id: "show", label: "🔎 Xem IP & mask", lines: [
      "# Xem địa chỉ IP và tiền tố mạng của máy",
      "$ ip addr show eth0",
      "  inet 192.168.1.10/24        # /24 = mask 255.255.255.0",
      "",
      "# 24 bit đầu = phần mạng, 8 bit cuối = phần host",
      "  mang  : 192.168.1.0         # phần chung mọi máy trong LAN",
      "  host  : .10                 # số nhà riêng của máy này",
      "  broadcast: 192.168.1.255    # gửi cho tất cả trong mạng"
    ]},
    { id: "same", label: "🧮 Cùng mạng hay không", lines: [
      "# Cùng mask /24 → so sánh 3 số đầu (phần mạng)",
      "A = 192.168.1.10   mang = 192.168.1.0",
      "B = 192.168.1.55   mang = 192.168.1.0   # cùng mạng ✔ gửi thẳng",
      "C = 192.168.2.20   mang = 192.168.2.0   # khác mạng -> qua router",
      "",
      "# Quy tắc: IP AND mask = địa chỉ mạng",
      "# hai địa chỉ mạng bằng nhau ⇒ cùng LAN"
    ]}
  ],

  stageHtml: `
    <div class="node" id="a"><div class="nl">💻 Máy A · 192.168.1.10/24</div><div class="ns">phần mạng 192.168.1.0</div></div>
    <div class="arrow" id="ar1">↓ cùng phần mạng? so theo mask /24</div>
    <div class="row">
      <div class="node" id="b"><div class="nl">🖥️ Máy B · 192.168.1.55</div><div class="ns">cùng mạng → gửi thẳng</div></div>
      <div class="node" id="c"><div class="nl">🌍 Máy C · 192.168.2.20</div><div class="ns">khác mạng → cần router</div></div>
    </div>
    <div class="arrow" id="ar2">↓ nếu khác mạng, giao cho gateway</div>
    <div class="node" id="gw"><div class="nl">🚪 Router / Gateway</div><div class="ns">chuyển gói sang mạng khác</div></div>
  `,
  steps: [
    { title: "1 · Đọc IP và mask", tab: "show", highlight: [2, 3], on: ["a"],
      desc: "Máy A có <code>192.168.1.10/24</code>. Ký hiệu <strong>/24</strong> (mask <code>255.255.255.0</code>) nói rằng 24 bit đầu là phần mạng." },
    { title: "2 · Tách mạng và host", tab: "show", highlight: [5, 6, 7], on: ["a"],
      desc: "Phần mạng <code>192.168.1.0</code> là 'khu phố' chung; phần host <code>.10</code> là 'số nhà' riêng. Mọi máy cùng LAN chia sẻ phần mạng này." },
    { title: "3 · So sánh với máy B", tab: "same", highlight: [2, 3], on: ["a", "ar1", "b"],
      desc: "Máy B là <code>192.168.1.55</code> — cùng phần mạng <code>192.168.1.0</code>. A và B <strong>cùng khu phố</strong> nên gửi khung thẳng cho nhau, không cần router." },
    { title: "4 · So sánh với máy C", tab: "same", highlight: [4], on: ["a", "ar1", "c"],
      desc: "Máy C là <code>192.168.2.20</code> — phần mạng <code>192.168.2.0</code> khác. C ở <strong>khu phố khác</strong>, nên A không gửi trực tiếp được." },
    { title: "5 · Khác mạng thì qua gateway", tab: "same", highlight: [6, 7], on: ["c", "ar2", "gw"],
      desc: "Vì khác mạng, A giao gói cho <strong>router (default gateway)</strong>. Router có chân ở nhiều mạng và sẽ chuyển gói sang phía máy C." }
  ],

  quiz: [
    { q: "Subnet mask dùng để làm gì?", options: [
        "Mã hoá địa chỉ IP cho an toàn",
        "Xác định phần nào của IP là 'mạng' và phần nào là 'host'",
        "Tăng tốc độ đường truyền",
        "Đếm số máy tối đa của Internet"
      ], correct: 1,
      explanation: "Mask vạch ranh giới mạng/host; ví dụ /24 nghĩa là 24 bit đầu là phần mạng, 8 bit cuối là host." },
    { q: "Hai máy 192.168.1.10/24 và 192.168.1.99/24 có cùng mạng không?", options: [
        "Không, vì số cuối khác nhau",
        "Chỉ cùng mạng nếu có cùng MAC",
        "Có, vì phần mạng 192.168.1.0 giống nhau nên gửi thẳng được",
        "Không thể biết nếu thiếu địa chỉ router"
      ], correct: 2,
      explanation: "Với /24 ta so 3 số đầu; cả hai đều thuộc 192.168.1.0 nên cùng LAN và giao tiếp trực tiếp." },
    { q: "Dải nào sau đây là địa chỉ IP private (chỉ dùng nội bộ)?", options: [
        "8.8.8.8",
        "192.168.0.0/16",
        "203.0.113.5",
        "1.1.1.1"
      ], correct: 1,
      explanation: "192.168.0.0/16 (cùng 10.0.0.0/8 và 172.16.0.0/12) là dải private, không định tuyến ra Internet." },
    { q: "Khi muốn gửi dữ liệu cho một máy ở KHÁC mạng, gói tin phải đi qua đâu?", options: [
        "Gửi thẳng bằng địa chỉ MAC của máy đích",
        "Không gửi được, phải cùng mạng",
        "Qua một switch trong cùng LAN",
        "Qua router (default gateway) để sang mạng khác"
      ], correct: 3,
      explanation: "Khác mạng thì máy giao gói cho default gateway; router chuyển tiếp giữa các mạng cho tới đích." }
  ]
});
