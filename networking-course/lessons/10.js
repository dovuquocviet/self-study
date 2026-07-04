window.LESSONS.push({
  id: "10",
  phase: "4", phaseName: "Tầng ứng dụng",
  title: "DNS: phân giải tên miền",
  subtitle: "Đổi tên thành IP: resolver → root → TLD → authoritative, và cache",

  theory: `
    <p>Con người nhớ <code>example.com</code> dễ hơn nhiều so với <code>93.184.216.34</code>. Nhưng máy
    tính lại cần địa chỉ IP để gửi gói. <strong>DNS (Domain Name System)</strong> là 'cuốn danh bạ' khổng
    lồ của Internet: đổi <em>tên miền</em> thành <em>địa chỉ IP</em>.</p>
    <p>Danh bạ này quá lớn để nằm ở một chỗ, nên nó được chia theo cấp bậc, đọc từ phải sang trái của tên
    miền. Việc tra cứu do một <strong>resolver</strong> (thường của nhà mạng) làm hộ bạn, đi hỏi lần lượt:</p>
    <ul>
      <li><strong>Root</strong>: 'ai quản lý <code>.com</code>?' → chỉ tới máy chủ TLD.</li>
      <li><strong>TLD</strong> (.com): 'ai quản lý <code>example.com</code>?' → chỉ tới máy chủ authoritative.</li>
      <li><strong>Authoritative</strong>: 'IP của <code>example.com</code> là gì?' → trả về
          <code>93.184.216.34</code>.</li>
    </ul>
    <p>Hỏi ba tầng cho mỗi lần vào web thì quá chậm, nên khắp nơi đều <strong>cache (lưu tạm)</strong>:
    trình duyệt, hệ điều hành, và resolver đều nhớ kết quả trong một khoảng thời gian gọi là
    <strong>TTL</strong>. Lần sau vào lại cùng tên miền thì trả lời tức thì, khỏi hỏi lại từ đầu.</p>
    <div class="callout"><p>💡 Hãy hình dung DNS như hỏi đường: bạn hỏi bác bảo vệ (resolver). Bác không
    thuộc hết, nên hỏi trung tâm thành phố (root) → quận (TLD) → tổ dân phố (authoritative). Hỏi xong bác
    ghi nhớ (cache) để lần sau chỉ luôn cho người kế tiếp.</p></div>
  `,

  codeTabs: [
    { id: "dig", label: "🔎 Tra cứu DNS", lines: [
      "# Hỏi tên miền, nhận về địa chỉ IP",
      "$ dig +short example.com",
      "  93.184.216.34",
      "",
      "# Lần đầu: resolver đi hỏi cả chuỗi root → TLD → auth",
      "# Lần sau: trả từ cache ngay, nhanh hơn nhiều",
      "$ dig example.com | grep 'Query time'",
      "  ;; Query time: 1 msec        # đã cache"
    ]},
    { id: "chain", label: "🪜 Chuỗi hỏi phân cấp", lines: [
      "# Đọc tên miền từ phải sang trái",
      "resolver -> ROOT : ai quản .com?      -> máy chủ TLD",
      "resolver -> TLD  : ai quản example.com? -> máy chủ auth",
      "resolver -> AUTH : IP của example.com?  -> 93.184.216.34",
      "",
      "# resolver gộp kết quả, cache theo TTL rồi trả cho bạn",
      "# TTL 3600 = nhớ 1 giờ trước khi hỏi lại"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cli"><div class="nl">💻 Máy bạn</div><div class="ns">cần IP của example.com</div></div>
    <div class="arrow" id="a1">↓ hỏi resolver (danh bạ hộ bạn)</div>
    <div class="node" id="res"><div class="nl">📇 Resolver</div><div class="ns">có cache? → trả ngay; không → đi hỏi</div></div>
    <div class="arrow" id="a2">↓ hỏi root → TLD → authoritative</div>
    <div class="row">
      <div class="node" id="root"><div class="nl">🌐 Root</div><div class="ns">chỉ tới TLD .com</div></div>
      <div class="node" id="tld"><div class="nl">🏢 TLD .com</div><div class="ns">chỉ tới authoritative</div></div>
      <div class="node" id="auth"><div class="nl">📌 Authoritative</div><div class="ns">trả IP 93.184.216.34</div></div>
    </div>
    <div class="arrow" id="a3">↑ resolver cache & trả IP cho máy bạn</div>
    <div class="node" id="ip"><div class="nl">✅ Có IP</div><div class="ns">giờ mới mở kết nối tới server</div></div>
  `,
  steps: [
    { title: "1 · Cần IP, hỏi resolver", tab: "dig", highlight: [2], on: ["cli", "a1", "res"],
      desc: "Bạn gõ <code>example.com</code> nhưng máy cần IP để gửi gói. Nó nhờ <strong>resolver</strong> tra hộ — giống hỏi bác bảo vệ đường tới một địa chỉ." },
    { title: "2 · Cache trước, hỏi sau", tab: "dig", highlight: [5, 6], on: ["res"],
      desc: "Nếu resolver <strong>đã cache</strong> tên này còn hạn, nó trả ngay. Nếu chưa, nó bắt đầu đi hỏi cả chuỗi phân cấp từ trên xuống." },
    { title: "3 · Hỏi Root rồi TLD", tab: "chain", highlight: [2, 3], on: ["res", "a2", "root", "tld"],
      desc: "Resolver hỏi <strong>Root</strong> 'ai quản .com?' → được chỉ tới máy chủ <strong>TLD .com</strong>; hỏi tiếp 'ai quản example.com?' → được chỉ tới authoritative." },
    { title: "4 · Authoritative trả IP", tab: "chain", highlight: [4], on: ["tld", "auth", "a3", "ip"],
      desc: "Máy chủ <strong>authoritative</strong> là nơi giữ bản ghi thật của tên miền, trả về <code>93.184.216.34</code>. Đây là câu trả lời cuối cùng, chính xác." },
    { title: "5 · Cache theo TTL", tab: "chain", highlight: [6, 7], on: ["res", "ip"],
      desc: "Resolver <strong>ghi nhớ kết quả theo TTL</strong> (ví dụ 1 giờ) rồi trả cho bạn. Lần sau vào lại, mọi thứ trả tức thì — đó là lý do web thứ hai vào nhanh hơn." }
  ],

  quiz: [
    { q: "Nhiệm vụ chính của DNS là gì?", options: [
        "Mã hoá dữ liệu giữa client và server",
        "Đổi tên miền (như example.com) thành địa chỉ IP",
        "Định tuyến gói tin qua các router",
        "Chia dữ liệu thành các gói nhỏ"
      ], correct: 1,
      explanation: "DNS là 'danh bạ' của Internet: ánh xạ tên miền dễ nhớ sang địa chỉ IP mà máy cần để gửi gói." },
    { q: "Thứ tự resolver đi hỏi trong một lần tra cứu đầy đủ là gì?", options: [
        "Authoritative → TLD → Root",
        "TLD → Root → Authoritative",
        "Root → TLD → Authoritative",
        "Root → Authoritative → TLD"
      ], correct: 2,
      explanation: "Resolver hỏi Root (chỉ tới TLD), rồi TLD (chỉ tới authoritative), rồi authoritative trả IP cuối cùng." },
    { q: "Vì sao lần thứ hai vào cùng một website thường phân giải DNS nhanh hơn?", options: [
        "Vì kết quả đã được cache ở trình duyệt/hệ điều hành/resolver theo TTL",
        "Vì server đổi sang IP gần hơn",
        "Vì lần hai dùng UDP còn lần đầu dùng TCP",
        "Vì tên miền được rút gọn lại"
      ], correct: 0,
      explanation: "Kết quả DNS được lưu tạm (cache) trong thời gian TTL nên lần sau trả ngay, khỏi hỏi lại cả chuỗi phân cấp." },
    { q: "Máy chủ nào giữ bản ghi 'thật' và trả về IP cuối cùng cho một tên miền?", options: [
        "Máy chủ Root",
        "Máy chủ TLD",
        "Resolver của nhà mạng",
        "Máy chủ authoritative"
      ], correct: 3,
      explanation: "Root và TLD chỉ chỉ đường; authoritative mới là nơi giữ bản ghi thật và trả về địa chỉ IP chính xác." }
  ]
});
