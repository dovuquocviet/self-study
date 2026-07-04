window.LESSONS.push({
  id: "12",
  phase: "4", phaseName: "Lưu trữ & I/O",
  title: "I/O, ngắt (interrupt) & thiết bị",
  subtitle: "Polling vs interrupt, driver và DMA",

  theory: `
    <p>CPU chạy cực nhanh; bàn phím, ổ đĩa, card mạng thì chậm hơn nhiều. Câu hỏi cốt lõi của <strong>I/O
    (vào/ra)</strong>: khi CPU cần dữ liệu từ một thiết bị chậm, nó <em>chờ</em> bằng cách nào cho đỡ phí sức?</p>
    <p>Có hai kiểu:</p>
    <ul>
      <li><strong>Polling (hỏi vòng)</strong>: CPU cứ liên tục hỏi thiết bị "xong chưa? xong chưa?". Đơn giản
          nhưng <em>phí CPU</em> — như bạn đứng bên lò vi sóng bấm bụng đếm từng giây thay vì đi làm việc khác.</li>
      <li><strong>Interrupt (ngắt)</strong>: CPU ra lệnh cho thiết bị rồi <em>đi làm việc khác</em>. Khi xong,
          thiết bị gửi tín hiệu <strong>ngắt</strong> — CPU tạm dừng việc đang làm, chạy một đoạn xử lý ngắn
          (<strong>trình xử lý ngắt / ISR</strong>), rồi quay lại. Đúng như lò vi sóng <em>kêu bíp</em> khi
          xong: bạn cứ làm việc khác, nghe bíp mới quay lại.</li>
    </ul>
    <p>Phần mềm điều khiển từng loại thiết bị cụ thể gọi là <strong>driver (trình điều khiển)</strong> — lớp
    dịch giữa cách kernel nói chuyện chung và ngôn ngữ riêng của từng phần cứng. Nhờ driver, kernel không cần
    biết chi tiết từng model card mạng hay ổ đĩa.</p>
    <p>Còn <strong>DMA (Direct Memory Access)</strong> giải bài toán chuyển <em>khối lớn</em> dữ liệu: thay vì
    CPU tự tay bê từng byte từ thiết bị vào RAM, một bộ điều khiển DMA làm việc đó thẳng, CPU chỉ ra lệnh lúc
    đầu và nhận một ngắt lúc xong. CPU được giải phóng để tính toán việc khác trong lúc dữ liệu tự chảy vào.</p>
    <div class="callout"><p>💡 Kết hợp <em>interrupt + DMA</em> là chìa khoá để máy vừa nhanh vừa không phí:
    CPU giao việc bê dữ liệu cho DMA, đi làm việc khác, và chỉ bị 'gọi về' bằng một ngắt duy nhất khi cả khối
    đã nằm gọn trong RAM.</p></div>
  `,

  codeTabs: [
    { id: "poll", label: "🔁 Polling", lines: [
      "// CPU tự hỏi liên tục tới khi thiết bị sẵn sàng",
      "while (device_status() != READY) {",
      "    // xoay vòng chờ... CPU KHÔNG làm gì khác",
      "}",
      "data = device_read();",
      "// Đơn giản, nhưng phí sạch CPU trong lúc chờ"
    ]},
    { id: "irq", label: "🔔 Interrupt", lines: [
      "// 1. CPU ra lệnh rồi ĐI LÀM VIỆC KHÁC",
      "device_start_read();      // khởi động, không chờ",
      "do_other_work();          // CPU tính việc khác",
      "",
      "// 2. Thiết bị xong -> phát ngắt (IRQ)",
      "void isr_handler() {      // trình xử lý ngắt (ISR)",
      "    data = device_read(); // lấy dữ liệu đã sẵn sàng",
      "    ack_interrupt();      // báo đã xử lý xong",
      "}                         // CPU quay lại việc dang dở"
    ]},
    { id: "dma", label: "🚚 DMA", lines: [
      "# Chuyển KHỐI LỚN mà không bắt CPU bê từng byte",
      "1. CPU cấu hình DMA: 'chép 8KB từ đĩa vào RAM @0x9000'",
      "2. CPU đi làm việc khác  (không đụng vào việc chép)",
      "3. Bộ điều khiển DMA chép thẳng đĩa -> RAM",
      "4. Xong -> DMA phát 1 ngắt báo CPU",
      "# CPU chỉ tốn công lúc đầu + 1 ngắt lúc cuối"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cpu"><div class="nl">⚙️ CPU (nhanh)</div><div class="ns">cần dữ liệu từ thiết bị chậm</div></div>
    <div class="arrow" id="a1">↓ chờ kiểu nào?</div>
    <div class="row" id="ways">
      <div class="node" id="poll"><div class="nl">🔁 Polling</div><div class="ns">hỏi vòng liên tục — phí CPU</div></div>
      <div class="node" id="irq"><div class="nl">🔔 Interrupt</div><div class="ns">làm việc khác, nghe 'bíp' khi xong</div></div>
    </div>
    <div class="arrow" id="a2">↓ nói chuyện với phần cứng qua</div>
    <div class="node" id="driver"><div class="nl">🔌 Driver</div><div class="ns">lớp dịch cho từng loại thiết bị</div></div>
    <div class="arrow" id="a3">↓ chuyển khối lớn thì nhờ</div>
    <div class="node" id="dma"><div class="nl">🚚 DMA</div><div class="ns">chép thẳng thiết bị ↔ RAM, giải phóng CPU</div></div>
  `,
  steps: [
    { title: "1 · CPU nhanh, thiết bị chậm", tab: "poll", highlight: [1], on: ["cpu", "a1"],
      desc: "CPU cần dữ liệu từ thiết bị chậm hơn nó rất nhiều. Vấn đề: chờ kiểu nào để không phí sức tính toán của CPU?" },
    { title: "2 · Polling phí CPU", tab: "poll", highlight: [2, 3, 4, 6], on: ["a1", "poll"],
      desc: "<strong>Polling</strong>: CPU hỏi vòng 'xong chưa?' liên tục. Đơn giản nhưng phí sạch CPU trong lúc chờ — như đứng đếm giây bên lò vi sóng." },
    { title: "3 · Interrupt giải phóng CPU", tab: "irq", highlight: [1, 2, 3], on: ["poll", "irq"],
      desc: "<strong>Interrupt</strong>: CPU ra lệnh rồi <em>đi làm việc khác</em>. Không phải ngồi chờ — như bấm lò vi sóng xong thì đi làm chuyện khác." },
    { title: "4 · Thiết bị 'bíp' bằng ngắt", tab: "irq", highlight: [5, 6, 7, 9], on: ["irq"],
      desc: "Xong việc, thiết bị phát <strong>ngắt (IRQ)</strong>. CPU tạm dừng, chạy <strong>trình xử lý ngắt (ISR)</strong> để lấy dữ liệu, rồi quay lại việc dang dở." },
    { title: "5 · Driver dịch cho phần cứng", tab: "irq", highlight: [2, 7], on: ["irq", "a2", "driver"],
      desc: "Mỗi loại thiết bị có <strong>driver</strong> riêng — lớp dịch giữa cách kernel nói chuyện chung và ngôn ngữ riêng của phần cứng. Kernel không cần biết chi tiết từng model." },
    { title: "6 · DMA chuyển khối lớn", tab: "dma", highlight: [1, 2, 3, 4, 5], on: ["driver", "a3", "dma"],
      desc: "Với khối lớn, <strong>DMA</strong> chép thẳng thiết bị ↔ RAM, CPU chỉ ra lệnh lúc đầu và nhận một ngắt lúc xong. CPU rảnh để tính việc khác trong lúc dữ liệu tự chảy vào." }
  ],

  quiz: [
    { q: "Nhược điểm chính của polling (hỏi vòng) là gì?", options: [
        "Nó làm hỏng thiết bị phần cứng",
        "CPU phí sức hỏi liên tục 'xong chưa?' thay vì làm việc khác trong lúc chờ",
        "Nó chỉ hoạt động với ổ đĩa, không với bàn phím",
        "Nó cần thêm một CPU thứ hai"
      ], correct: 1,
      explanation: "Polling bắt CPU xoay vòng chờ, tiêu tốn chu kỳ tính toán mà không làm gì hữu ích — như đứng đếm giây bên lò vi sóng." },
    { q: "Cơ chế interrupt (ngắt) hoạt động thế nào?", options: [
        "CPU ra lệnh rồi đi làm việc khác; khi xong, thiết bị phát ngắt để CPU quay lại xử lý",
        "CPU tắt nguồn thiết bị cho tới khi cần",
        "Thiết bị tự ghi thẳng vào CPU mà không báo",
        "CPU hỏi thiết bị mỗi mili-giây một lần"
      ], correct: 0,
      explanation: "Interrupt cho CPU làm việc khác trong lúc chờ; thiết bị 'bíp' bằng tín hiệu ngắt khi xong, CPU chạy ISR rồi quay lại." },
    { q: "Driver (trình điều khiển) đóng vai trò gì?", options: [
        "Là bộ nhớ đệm giữa RAM và đĩa",
        "Là lớp phần mềm dịch giữa cách kernel nói chuyện chung và ngôn ngữ riêng của từng loại thiết bị",
        "Là chương trình diệt virus cho phần cứng",
        "Là bộ đếm thời gian của CPU"
      ], correct: 1,
      explanation: "Driver bọc chi tiết riêng của mỗi thiết bị lại, để kernel điều khiển nhiều model khác nhau qua một giao diện chung." },
    { q: "DMA (Direct Memory Access) giúp ích gì khi chuyển khối dữ liệu lớn?", options: [
        "Nó nén dữ liệu để chuyển nhanh hơn",
        "Nó bắt CPU đích thân bê từng byte để bảo đảm chính xác",
        "Một bộ điều khiển DMA chép thẳng thiết bị ↔ RAM, giải phóng CPU; CPU chỉ ra lệnh đầu và nhận một ngắt cuối",
        "Nó thay thế hoàn toàn RAM bằng đĩa"
      ], correct: 2,
      explanation: "DMA gánh việc chuyển dữ liệu thay CPU; CPU chỉ cấu hình lúc đầu và nhận một ngắt báo hoàn tất, nên rảnh để tính việc khác." }
  ]
});
