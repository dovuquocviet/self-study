window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Tầng vận chuyển",
  title: "Cổng (port), socket & NAT",
  subtitle: "Cổng 80/443, socket = IP:port, và NAT chia sẻ một IP public",

  theory: `
    <p>Một máy chủ có thể chạy nhiều dịch vụ cùng lúc: web, email, cơ sở dữ liệu… Địa chỉ IP chỉ tới
    đúng <em>máy</em>, nhưng làm sao gói tin biết đến đúng <em>dịch vụ</em>? Câu trả lời là
    <strong>cổng (port)</strong> — một con số 0–65535 giống <em>số phòng ban</em> trong một toà nhà.</p>
    <ul>
      <li><strong>80</strong>: HTTP (web thường). <strong>443</strong>: HTTPS (web mã hoá).</li>
      <li><strong>53</strong>: DNS. <strong>22</strong>: SSH. <strong>25</strong>: email (SMTP).</li>
    </ul>
    <p>Ghép <em>địa chỉ IP</em> với <em>số cổng</em> ta được một <strong>socket</strong>, ví dụ
    <code>93.184.216.34:443</code> = "toà nhà này, phòng 443". Một kết nối được định danh bởi
    <em>bốn</em> giá trị: IP nguồn, cổng nguồn, IP đích, cổng đích. Nhờ bộ bốn này, máy bạn mở nhiều tab
    tới cùng một server mà không lẫn — mỗi tab dùng một cổng nguồn khác nhau.</p>
    <p>Nhưng ở nhà bạn có nhiều thiết bị mà nhà mạng chỉ cấp <strong>một IP public</strong>. Router giải
    quyết bằng <strong>NAT (Network Address Translation)</strong>: nó viết lại địa chỉ, thay IP private
    của từng thiết bị bằng IP public chung, và dùng <em>cổng</em> để nhớ gói trả về thuộc thiết bị nào.</p>
    <div class="callout"><p>💡 NAT giống một <strong>lễ tân</strong>: mọi người trong công ty gọi ra ngoài
    đều hiện cùng một số tổng đài; lễ tân ghi 'cuộc này của phòng A' để khi có hồi âm thì nối đúng máy
    lẻ. Cặp cổng chính là cuốn sổ ghi chú đó.</p></div>
  `,

  codeTabs: [
    { id: "sock", label: "🔌 Cổng & socket", lines: [
      "# Xem các socket đang lắng nghe trên máy",
      "$ ss -tlnp",
      "  LISTEN  0.0.0.0:443   # dịch vụ web HTTPS",
      "  LISTEN  0.0.0.0:22    # SSH",
      "",
      "# Một kết nối = bộ 4: IP:port nguồn <-> IP:port đích",
      "  10.0.0.5:51000  ->  93.184.216.34:443   # tab 1",
      "  10.0.0.5:51001  ->  93.184.216.34:443   # tab 2 (khác cổng nguồn)"
    ]},
    { id: "nat", label: "🔁 NAT viết lại địa chỉ", lines: [
      "# Nhiều thiết bị private chia sẻ 1 IP public",
      "trong LAN : 192.168.1.20:51000 -> web",
      "qua router: 203.0.113.7:40001  -> web   # NAT đổi nguồn",
      "",
      "# Router ghi sổ để nhớ gói về của ai:",
      "  40001  <->  192.168.1.20:51000  # điện thoại",
      "  40002  <->  192.168.1.31:52000  # laptop"
    ]}
  ],

  stageHtml: `
    <div class="node" id="dev"><div class="nl">📱 Thiết bị trong LAN</div><div class="ns">192.168.1.20:51000 (IP private)</div></div>
    <div class="arrow" id="a1">↓ gói đi ra, cổng đích 443</div>
    <div class="node" id="nat"><div class="nl">🚪 Router (NAT)</div><div class="ns">đổi nguồn → 203.0.113.7:40001, ghi sổ</div></div>
    <div class="arrow" id="a2">↓ ra Internet với IP public chung</div>
    <div class="node" id="srv"><div class="nl">🖥️ Server web</div><div class="ns">socket đích 93.184.216.34:443</div></div>
    <div class="arrow" id="a3">↑ gói về cổng 40001 → tra sổ → đúng thiết bị</div>
    <div class="node" id="back"><div class="nl">✅ Trả đúng máy lẻ</div><div class="ns">NAT nối lại 192.168.1.20:51000</div></div>
  `,
  steps: [
    { title: "1 · Cổng = số phòng ban", tab: "sock", highlight: [2, 3, 4], on: ["dev"],
      desc: "IP chỉ tới đúng máy, còn <strong>cổng</strong> chỉ tới đúng dịch vụ: <code>443</code> cho web HTTPS, <code>22</code> cho SSH. Máy dùng cổng để phân luồng nhiều dịch vụ." },
    { title: "2 · Socket = IP:port", tab: "sock", highlight: [6, 7], on: ["dev", "a1"],
      desc: "Ghép IP với cổng ra <strong>socket</strong>. Một kết nối được định danh bởi bộ bốn (IP:port nguồn và đích), nên hai tab tới cùng server vẫn không lẫn nhau." },
    { title: "3 · NAT đổi địa chỉ nguồn", tab: "nat", highlight: [2, 3], on: ["dev", "nat"],
      desc: "Ra Internet, router thay IP private <code>192.168.1.20</code> bằng <strong>IP public chung</strong> <code>203.0.113.7</code> và gán một cổng nguồn mới <code>40001</code>." },
    { title: "4 · Router ghi sổ ánh xạ", tab: "nat", highlight: [5, 6, 7], on: ["nat", "a2", "srv"],
      desc: "Router lưu 'cổng 40001 thuộc điện thoại 192.168.1.20:51000'. Cuốn sổ NAT này chính là chìa khoá để sau đó nối đúng gói hồi âm về đúng thiết bị." },
    { title: "5 · Gói về, tra sổ, trả đúng máy", tab: "nat", highlight: [6], on: ["srv", "a3", "back"],
      desc: "Server trả gói về <code>203.0.113.7:40001</code>. Router tra sổ NAT, thấy 40001 là của điện thoại, <strong>viết lại đích</strong> về <code>192.168.1.20:51000</code> — đúng máy lẻ." }
  ],

  quiz: [
    { q: "Số cổng (port) dùng để làm gì?", options: [
        "Xác định đúng dịch vụ trên một máy, khi IP chỉ tới đúng máy",
        "Mã hoá dữ liệu trước khi gửi",
        "Đếm số router trên đường đi",
        "Lưu địa chỉ MAC của thiết bị"
      ], correct: 0,
      explanation: "IP tới đúng máy; cổng như 'số phòng ban' giúp gói tới đúng dịch vụ (80 web, 443 HTTPS, 22 SSH...)." },
    { q: "Một 'socket' được tạo thành từ những gì?", options: [
        "Chỉ địa chỉ MAC",
        "Địa chỉ IP ghép với số cổng (IP:port)",
        "Tên miền và mật khẩu",
        "Số thứ tự TCP và TTL"
      ], correct: 1,
      explanation: "Socket = IP:port; một kết nối được định danh bởi bộ bốn IP:port nguồn và đích." },
    { q: "NAT giải quyết vấn đề gì?", options: [
        "Mã hoá lưu lượng ra Internet",
        "Tăng tốc độ Wi-Fi",
        "Cho nhiều thiết bị dùng IP private chia sẻ một IP public duy nhất",
        "Chặn virus từ bên ngoài"
      ], correct: 2,
      explanation: "NAT viết lại địa chỉ để nhiều thiết bị nội bộ cùng ra ngoài qua một IP public, dùng cổng để phân biệt." },
    { q: "Nhờ đâu router NAT biết một gói hồi âm thuộc về thiết bị nào trong LAN?", options: [
        "Nhờ địa chỉ MAC của server",
        "Nhờ TTL trong gói tin",
        "Nhờ tên miền trong gói",
        "Nhờ bảng ánh xạ cổng đã ghi khi gói đi ra"
      ], correct: 3,
      explanation: "Khi gói đi ra, router ghi 'cổng X thuộc thiết bị Y'; gói về theo cổng X được tra sổ và viết lại đích đúng thiết bị." }
  ]
});
