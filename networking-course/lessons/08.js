window.LESSONS.push({
  id: "08",
  phase: "3", phaseName: "Tầng vận chuyển",
  title: "UDP & so sánh TCP/UDP",
  subtitle: "Không kết nối, dùng cho DNS và gọi video; bảng so sánh TCP vs UDP",

  theory: `
    <p>Không phải lúc nào ta cũng cần sự kỹ lưỡng của TCP. <strong>UDP</strong> là người anh em tối giản:
    nó chỉ gói dữ liệu, dán số cổng, rồi 'bắn' đi mà <em>không</em> bắt tay, <em>không</em> theo dõi, và
    <em>không</em> gửi lại nếu mất.</p>
    <p>Hãy so sánh bằng đời thường: TCP giống <strong>gửi thư bảo đảm</strong> — có xác nhận đã nhận, mất
    thì gửi lại, nhưng tốn thời gian thủ tục. UDP giống <strong>thả tờ rơi qua khe cửa</strong> — cực
    nhanh, gọn, nhưng bạn không biết chắc người ta có nhận được hay không.</p>
    <p>Vì sao có ứng dụng lại chọn kênh 'không đảm bảo'? Vì với một số việc, <em>đúng giờ</em> quan trọng
    hơn <em>đầy đủ</em>. Trong gọi video, nếu một khung hình cũ bị mất, gửi lại nó chỉ làm mọi thứ trễ
    và giật — thà bỏ qua và vẽ khung mới. DNS thì gói hỏi/đáp rất nhỏ, dựng cả kết nối TCP là phí.</p>
    <table>
      <tr><th>Tiêu chí</th><th>TCP</th><th>UDP</th></tr>
      <tr><td>Kết nối</td><td>Có bắt tay 3 bước</td><td>Không, bắn thẳng</td></tr>
      <tr><td>Tin cậy</td><td>Gửi lại khi mất, đúng thứ tự</td><td>Không đảm bảo, có thể mất/lộn</td></tr>
      <tr><td>Tốc độ / trễ</td><td>Chậm hơn, nhiều thủ tục</td><td>Nhanh, gọn, ít trễ</td></tr>
      <tr><td>Hợp cho</td><td>Web, tải file, email</td><td>DNS, video call, game, streaming</td></tr>
    </table>
    <div class="callout"><p>💡 UDP không 'kém' hơn TCP — chỉ khác mục đích. Nhiều giao thức hiện đại (như
    QUIC dùng cho HTTP/3) xây <em>độ tin cậy có chọn lọc</em> ngay trên UDP để lấy cái nhanh của UDP mà
    vẫn kiểm soát mất mát theo cách riêng.</p></div>
  `,

  codeTabs: [
    { id: "dns", label: "📡 UDP cho DNS", lines: [
      "# Hỏi DNS: một gói đi, một gói về — không bắt tay",
      "$ dig +short example.com @8.8.8.8",
      "  93.184.216.34",
      "",
      "# Bắt gói: DNS chạy trên UDP cổng 53",
      "  IP 10.0.0.5.51000 > 8.8.8.8.53: UDP  # gói hỏi",
      "  IP 8.8.8.8.53 > 10.0.0.5.51000: UDP  # gói đáp",
      "# xong, không cần đóng kết nối"
    ]},
    { id: "cmp", label: "⚖️ Khi nào chọn cái nào", lines: [
      "# TCP: cần đủ và đúng thứ tự",
      "web / tai file / email   -> TCP   # mất 1 byte là hỏng",
      "",
      "# UDP: cần nhanh, chấp nhận mất lác đác",
      "video call / game        -> UDP   # trễ tệ hơn mất",
      "DNS (hỏi-đáp ngắn)       -> UDP   # dựng TCP thì phí",
      "# → chọn theo: đủ quan trọng hay đúng giờ quan trọng?"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📝 Ứng dụng</div><div class="ns">chọn kênh vận chuyển</div></div>
    <div class="arrow" id="a1">↓ cần đủ & đúng thứ tự? hay cần nhanh?</div>
    <div class="row">
      <div class="node" id="tcp"><div class="nl">🚚 TCP</div><div class="ns">bắt tay · gửi lại · đúng thứ tự</div></div>
      <div class="node" id="udp"><div class="nl">🏹 UDP</div><div class="ns">bắn thẳng · không đảm bảo · nhanh</div></div>
    </div>
    <div class="arrow" id="a2">↓ ví dụ điển hình mỗi bên</div>
    <div class="node" id="use"><div class="nl">🎯 Dùng thực tế</div><div class="ns">TCP: web, file · UDP: DNS, video call</div></div>
  `,
  steps: [
    { title: "1 · Ứng dụng chọn kênh", tab: "cmp", highlight: [1], on: ["app", "a1"],
      desc: "Trước khi gửi, ứng dụng quyết định: cần <strong>đầy đủ &amp; đúng thứ tự</strong> (chọn TCP) hay cần <strong>nhanh, ít trễ</strong> (chọn UDP)?" },
    { title: "2 · TCP — thư bảo đảm", tab: "cmp", highlight: [2], on: ["app", "tcp"],
      desc: "TCP bắt tay, đánh số, gửi lại khi mất. Hợp với web, tải file, email — nơi <em>mất một byte là hỏng</em>. Đổi lại là nhiều thủ tục và trễ hơn." },
    { title: "3 · UDP — thả tờ rơi", tab: "cmp", highlight: [4, 5], on: ["app", "udp"],
      desc: "UDP bắn gói thẳng, không theo dõi. Hợp với video call và game — nơi <em>trễ còn tệ hơn mất</em>: thà bỏ khung cũ, vẽ khung mới cho kịp thời gian thực." },
    { title: "4 · DNS chạy trên UDP", tab: "dns", highlight: [2, 6, 7], on: ["udp", "a2", "use"],
      desc: "Truy vấn DNS chỉ là một gói hỏi và một gói đáp rất nhỏ trên <strong>cổng 53</strong>. Dựng cả kết nối TCP cho việc này là phí — nên DNS dùng UDP." },
    { title: "5 · Chốt lại tiêu chí chọn", tab: "cmp", highlight: [6], on: ["use"],
      desc: "Câu hỏi gói gọn: <strong>đủ quan trọng hơn hay đúng giờ quan trọng hơn?</strong> Đủ → TCP; đúng giờ → UDP. Cả hai đều là công cụ, không cái nào 'tốt hơn' tuyệt đối." }
  ],

  quiz: [
    { q: "Khác biệt cốt lõi giữa UDP và TCP là gì?", options: [
        "UDP mã hoá dữ liệu còn TCP thì không",
        "UDP không bắt tay và không đảm bảo giao đủ/đúng thứ tự, TCP thì có",
        "UDP chỉ chạy trong LAN, TCP chạy trên Internet",
        "UDP luôn nhanh hơn vì nén dữ liệu"
      ], correct: 1,
      explanation: "UDP là kênh không kết nối, không đảm bảo; TCP bắt tay, đánh số và gửi lại để đảm bảo tin cậy." },
    { q: "Vì sao gọi video thường dùng UDP thay vì TCP?", options: [
        "Vì UDP mã hoá tốt hơn cho video",
        "Vì TCP không truyền được hình ảnh",
        "Vì với thời gian thực, trễ do gửi lại còn tệ hơn việc mất vài khung hình",
        "Vì UDP tốn ít điện hơn"
      ], correct: 2,
      explanation: "Gửi lại một khung hình cũ chỉ gây trễ và giật; thà bỏ qua và vẽ khung mới nên video call chuộng UDP." },
    { q: "DNS thường chạy trên giao thức và cổng nào?", options: [
        "UDP cổng 53",
        "TCP cổng 80",
        "TCP cổng 443",
        "UDP cổng 25"
      ], correct: 0,
      explanation: "Truy vấn DNS là hỏi-đáp ngắn nên dùng UDP cổng 53; dựng kết nối TCP cho việc nhỏ này là lãng phí." },
    { q: "Câu nào đúng về việc chọn TCP hay UDP?", options: [
        "TCP luôn tốt hơn UDP trong mọi trường hợp",
        "UDP luôn tốt hơn vì nhanh hơn",
        "Phải dùng cả hai cùng lúc cho mọi ứng dụng",
        "Tuỳ nhu cầu: cần đủ & đúng thứ tự thì TCP, cần nhanh & ít trễ thì UDP"
      ], correct: 3,
      explanation: "Không cái nào tốt hơn tuyệt đối; chọn theo việc: đầy đủ quan trọng → TCP, đúng giờ quan trọng → UDP." }
  ]
});
