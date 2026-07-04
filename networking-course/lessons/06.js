window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "Liên kết & Mạng",
  title: "Định tuyến: router, gateway, bảng định tuyến",
  subtitle: "Default gateway, hop, TTL, và cách mỗi router quyết định chặng kế",

  theory: `
    <p>Internet là một mạng của các mạng, nối với nhau bằng <strong>router</strong>. Mỗi router giống một
    <em>bưu điện trung chuyển</em>: nó không biết toàn bộ hành trình của một lá thư, chỉ cần biết
    <em>chặng kế tiếp</em> nên đẩy gói đi đâu để tiến gần đích hơn.</p>
    <p>Máy của bạn cũng cần biết đường ra: đó là <strong>default gateway</strong> — thường là router
    Wi-Fi ở nhà. Bất cứ gói nào gửi tới một mạng bạn không quen, máy sẽ giao cho gateway lo tiếp.</p>
    <p>Cách router quyết định là dựa vào <strong>bảng định tuyến (routing table)</strong>: một danh sách
    "muốn tới mạng X thì đẩy gói ra chặng kế Y". Router so địa chỉ đích của gói với bảng này, chọn dòng
    khớp nhất, rồi chuyển tiếp. Mỗi lần gói nhảy qua một router gọi là một <strong>hop</strong>.</p>
    <ul>
      <li><strong>Hop-by-hop</strong>: không ai giữ bản đồ toàn cục; mỗi router chỉ lo một bước.</li>
      <li><strong>TTL (Time To Live)</strong>: bộ đếm trong header IP, giảm 1 mỗi hop. Về 0 thì gói bị
          vứt — ngăn gói chạy vòng vô tận nếu định tuyến bị lặp.</li>
      <li><strong>Default route</strong> (<code>0.0.0.0/0</code>): dòng 'không khớp gì khác thì gửi lối này'.</li>
    </ul>
    <div class="callout"><p>💡 Lệnh <code>traceroute</code> lợi dụng TTL để lộ đường đi: nó gửi gói với TTL=1,
    rồi 2, rồi 3… Mỗi router hết TTL sẽ báo lỗi về, nhờ đó ta thấy tên từng chặng trên hành trình.</p></div>
  `,

  codeTabs: [
    { id: "route", label: "🗺️ Bảng định tuyến", lines: [
      "# Xem máy quyết định gửi gói đi đâu",
      "$ ip route",
      "  default via 192.168.1.1 dev eth0    # không khớp gì → gateway",
      "  192.168.1.0/24 dev eth0             # mạng nội bộ → gửi thẳng",
      "",
      "# Gửi tới 8.8.8.8? không thuộc LAN",
      "# → khớp 'default' → giao cho 192.168.1.1"
    ]},
    { id: "trace", label: "🧭 traceroute (hop & TTL)", lines: [
      "# Lộ từng chặng router trên đường tới đích",
      "$ traceroute example.com",
      "  1  192.168.1.1     1.2 ms     # router nhà (hop 1)",
      "  2  100.64.0.1      8.9 ms     # router nhà mạng",
      "  3  72.14.220.5    15.3 ms     # xương sống Internet",
      "  4  93.184.216.34  16.0 ms     # tới đích",
      "# mỗi dòng = một hop, TTL tăng dần để dò ra"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pc"><div class="nl">💻 Máy bạn</div><div class="ns">đích 93.184.216.34 — không thuộc LAN</div></div>
    <div class="arrow" id="a1">↓ khớp 'default' → default gateway</div>
    <div class="node" id="gw"><div class="nl">🚪 Router nhà (gateway)</div><div class="ns">hop 1 · TTL 64→63</div></div>
    <div class="arrow" id="a2">↓ router tra bảng, chọn chặng kế</div>
    <div class="node" id="isp"><div class="nl">🏢 Router nhà mạng</div><div class="ns">hop 2 · TTL 63→62</div></div>
    <div class="arrow" id="a3">↓ nhiều hop qua xương sống Internet</div>
    <div class="node" id="dst"><div class="nl">🖥️ Server đích</div><div class="ns">gói tới nơi trước khi TTL về 0</div></div>
  `,
  steps: [
    { title: "1 · Đích không thuộc LAN", tab: "route", highlight: [5, 6], on: ["pc"],
      desc: "Máy muốn gửi tới <code>93.184.216.34</code>. Địa chỉ này không nằm trong mạng nội bộ, nên máy dò bảng định tuyến tìm dòng khớp." },
    { title: "2 · Khớp default route", tab: "route", highlight: [3], on: ["pc", "a1", "gw"],
      desc: "Không dòng nào khớp cụ thể, nên khớp <strong>default</strong> (<code>0.0.0.0/0</code>): giao gói cho <strong>default gateway</strong> <code>192.168.1.1</code>." },
    { title: "3 · Router tra bảng, chọn chặng kế", tab: "trace", highlight: [3, 4], on: ["gw", "a2", "isp"],
      desc: "Router nhà không biết toàn bộ đường, chỉ tra bảng của mình và đẩy gói sang <strong>router nhà mạng</strong>. Đây là bước <em>hop-by-hop</em>: mỗi router lo một chặng." },
    { title: "4 · Mỗi hop giảm TTL", tab: "trace", highlight: [5, 6], on: ["isp", "a3", "dst"],
      desc: "Gói nhảy qua nhiều router trên xương sống Internet. Mỗi hop <strong>giảm TTL đi 1</strong>. Nếu TTL về 0 trước khi tới đích, gói bị vứt — cơ chế chống lặp vô tận." },
    { title: "5 · traceroute lộ đường đi", tab: "trace", highlight: [7], on: ["pc", "dst"],
      desc: "Bằng cách gửi gói với TTL tăng dần (1, 2, 3…), <code>traceroute</code> khiến từng router báo lỗi về, nhờ đó liệt kê được <strong>mọi hop</strong> trên hành trình." }
  ],

  quiz: [
    { q: "Vai trò của 'default gateway' trên máy tính của bạn là gì?", options: [
        "Lưu trữ mật khẩu Wi-Fi",
        "Là nơi máy giao mọi gói tin gửi tới mạng mà nó không quen",
        "Tăng tốc độ tải xuống",
        "Cấp phát địa chỉ MAC cho các máy"
      ], correct: 1,
      explanation: "Gói tới mạng lạ (không khớp dòng cụ thể nào) sẽ được giao cho default gateway để nó chuyển tiếp ra ngoài." },
    { q: "'Hop-by-hop' trong định tuyến nghĩa là gì?", options: [
        "Máy gửi phải biết trước toàn bộ đường đi tới đích",
        "Mỗi router chỉ quyết định chặng kế tiếp, không ai giữ bản đồ toàn cục",
        "Gói tin luôn đi theo đúng một đường cố định",
        "Router gửi bản sao gói ra mọi hướng"
      ], correct: 1,
      explanation: "Không router nào biết toàn bộ hành trình; mỗi router tra bảng của mình và chỉ chọn bước kế tiếp." },
    { q: "Trường TTL trong header IP dùng để làm gì?", options: [
        "Đo tốc độ đường truyền",
        "Lưu địa chỉ MAC của chặng kế",
        "Giảm 1 mỗi hop; về 0 thì vứt gói để tránh lặp vô tận",
        "Đếm số byte của gói tin"
      ], correct: 2,
      explanation: "TTL là bộ đếm chống vòng lặp: mỗi router giảm 1, khi về 0 gói bị loại bỏ và báo lỗi về nguồn." },
    { q: "traceroute liệt kê được các router trên đường nhờ kỹ thuật nào?", options: [
        "Gửi gói với TTL tăng dần để mỗi router lần lượt báo lỗi về",
        "Hỏi trực tiếp server đích danh sách router",
        "Đọc bảng định tuyến của mọi router qua Internet",
        "Đoán dựa trên địa chỉ IP đích"
      ], correct: 0,
      explanation: "Gửi TTL=1 làm hop 1 báo lỗi, TTL=2 làm hop 2 báo lỗi… lần lượt lộ ra từng chặng trên hành trình." }
  ]
});
