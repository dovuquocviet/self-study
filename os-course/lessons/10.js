window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Bộ nhớ",
  title: "Bộ nhớ ảo & phân trang (paging)",
  subtitle: "Địa chỉ ảo → vật lý, page, frame và page fault",

  theory: `
    <p>Bài 09 nói mỗi tiến trình có "bàn làm việc" đánh số từ 0. Nhưng nhiều tiến trình cùng chạy — chẳng lẽ
    tất cả đều dùng địa chỉ 0? Bí quyết là <strong>bộ nhớ ảo (virtual memory)</strong>: mỗi tiến trình thấy
    một không gian địa chỉ <em>ảo</em> của riêng nó, còn HĐH + phần cứng lặng lẽ <strong>dịch</strong> địa chỉ
    ảo đó sang địa chỉ <em>vật lý</em> thật trong RAM.</p>
    <p>Việc dịch được làm theo từng <strong>trang (page)</strong>: bộ nhớ ảo chia thành các trang bằng nhau
    (thường 4KB); RAM vật lý chia thành các <strong>khung (frame)</strong> cùng cỡ. Một <strong>bảng trang
    (page table)</strong> ghi: trang ảo số X của tiến trình này đang nằm ở khung vật lý số Y.</p>
    <p>Hình dung một <strong>thư viện</strong>: bạn đưa cho thủ thư <em>mã số sách</em> (địa chỉ ảo); thủ thư
    tra sổ mục lục (bảng trang) để biết sách nằm ở <em>kệ nào, ngăn nào</em> (địa chỉ vật lý) rồi lấy cho bạn.
    Bạn không cần biết vị trí kệ thật.</p>
    <ul>
      <li><strong>Lợi ích</strong>: mỗi tiến trình được cách ly (không thấy RAM của nhau); RAM có thể lấp đầy
          không cần liền mạch; chương trình lớn hơn RAM vẫn chạy được.</li>
      <li><strong>Page fault</strong>: khi trang cần dùng <em>chưa có</em> trong RAM. CPU báo lỗi, kernel nạp
          trang đó vào một khung rồi cho chạy tiếp — như thủ thư phải xuống kho lấy cuốn chưa bày trên kệ.</li>
      <li><strong>Swap</strong>: khi RAM đầy, kernel đẩy bớt trang ít dùng ra <em>đĩa</em> (vùng swap) để lấy
          chỗ. Trang bị đẩy ra, khi cần lại sẽ gây page fault để nạp về.</li>
    </ul>
    <div class="callout"><p>💡 Nếu RAM quá thiếu, hệ thống liên tục đẩy ra rồi nạp vào (swap qua lại) đến mức
    hầu như chỉ lo chuyển trang thay vì làm việc thật — gọi là <strong>thrashing</strong>. Đó là lúc máy
    "đơ", ổ đĩa kêu liên tục mà chẳng chạy được gì.</p></div>
  `,

  codeTabs: [
    { id: "trans", label: "🔄 Dịch địa chỉ", lines: [
      "# Địa chỉ ảo = (số trang, độ lệch trong trang)",
      "Địa chỉ ảo 0x1A3F, trang 4KB:",
      "   số trang ảo = 0x1  (0x1A3F / 0x1000)",
      "   độ lệch     = 0xA3F",
      "",
      "# Tra BẢNG TRANG: trang ảo 0x1 -> khung vật lý 0x7",
      "Địa chỉ vật lý = 0x7000 + 0xA3F = 0x7A3F",
      "# Độ lệch giữ nguyên; chỉ 'số trang' được dịch"
    ]},
    { id: "fault", label: "⚠️ Page fault", lines: [
      "1. CPU cần trang ảo P của tiến trình",
      "2. Tra bảng trang: P KHÔNG có trong RAM (bit present=0)",
      "3. CPU phát PAGE FAULT -> nhảy vào kernel",
      "4. Kernel tìm 1 khung trống (hoặc swap bớt trang ra)",
      "5. Nạp trang P từ đĩa vào khung đó, cập nhật bảng trang",
      "6. Chạy lại lệnh cũ -> lần này thấy trang, đi tiếp"
    ]},
    { id: "swap", label: "💽 Swap", lines: [
      "$ free -h",
      "        total   used   free",
      "Mem:     8.0G   7.6G   0.4G   # RAM gần cạn",
      "Swap:    4.0G   1.2G   2.8G   # đẩy bớt trang ra đĩa",
      "",
      "# Trang ít dùng -> ra vùng swap trên đĩa để nhường RAM",
      "# Swap liên tục qua lại = thrashing, máy 'đơ'"
    ]}
  ],

  stageHtml: `
    <div class="node" id="virt"><div class="nl">🏷️ Địa chỉ ảo</div><div class="ns">tiến trình chỉ thấy không gian riêng, đánh số từ 0</div></div>
    <div class="arrow" id="a1">↓ tách thành (số trang, độ lệch)</div>
    <div class="node" id="table"><div class="nl">📖 Bảng trang</div><div class="ns">trang ảo X → khung vật lý Y (như sổ mục lục)</div></div>
    <div class="arrow" id="a2">↓ trang có trong RAM?</div>
    <div class="row" id="outcome">
      <div class="node" id="ram"><div class="nl">✅ Khung trong RAM</div><div class="ns">ghép độ lệch → địa chỉ vật lý</div></div>
      <div class="node" id="fault"><div class="nl">⚠️ Page fault</div><div class="ns">chưa có → kernel nạp trang vào</div></div>
    </div>
    <div class="arrow" id="a3">↓ RAM đầy thì</div>
    <div class="node" id="swap"><div class="nl">💽 Swap ra đĩa</div><div class="ns">đẩy trang ít dùng ra để lấy chỗ</div></div>
  `,
  steps: [
    { title: "1 · Tiến trình thấy địa chỉ ảo", tab: "trans", highlight: [1, 2], on: ["virt", "a1"],
      desc: "Mỗi tiến trình dùng <strong>địa chỉ ảo</strong> riêng, luôn như bắt đầu từ 0. Nhờ vậy nhiều tiến trình cùng 'dùng địa chỉ 0' mà không đụng nhau — chúng ánh xạ tới RAM khác nhau." },
    { title: "2 · Tách trang và độ lệch", tab: "trans", highlight: [3, 4], on: ["a1", "table"],
      desc: "Địa chỉ ảo tách thành <strong>số trang</strong> + <strong>độ lệch</strong> trong trang. Bộ nhớ chia thành các <strong>trang (page)</strong> 4KB; RAM chia thành <strong>khung (frame)</strong> cùng cỡ." },
    { title: "3 · Tra bảng trang", tab: "trans", highlight: [6, 7, 8], on: ["table", "a2", "ram"],
      desc: "<strong>Bảng trang</strong> (như sổ mục lục thư viện) ánh xạ trang ảo X → khung vật lý Y. Ghép khung với độ lệch ra <strong>địa chỉ vật lý</strong> thật trong RAM." },
    { title: "4 · Khi trang chưa có: page fault", tab: "fault", highlight: [2, 3, 5], on: ["a2", "fault"],
      desc: "Nếu trang cần dùng <em>chưa</em> trong RAM, CPU phát <strong>page fault</strong>. Kernel nạp trang từ đĩa vào một khung, cập nhật bảng trang, rồi chạy lại lệnh — lần này thành công." },
    { title: "5 · RAM đầy: swap", tab: "swap", highlight: [3, 4, 6], on: ["fault", "a3", "swap"],
      desc: "RAM đầy thì kernel đẩy trang <strong>ít dùng</strong> ra vùng <strong>swap</strong> trên đĩa để lấy chỗ. Khi cần lại, trang đó gây page fault để nạp về." },
    { title: "6 · Thrashing", tab: "swap", highlight: [6, 7], on: ["swap", "ram"],
      desc: "Thiếu RAM trầm trọng khiến hệ thống liên tục swap ra–vào, phần lớn thời gian chỉ lo chuyển trang — gọi là <strong>thrashing</strong>, lúc máy 'đơ' và ổ đĩa kêu liên tục." }
  ],

  quiz: [
    { q: "Bộ nhớ ảo cho phép điều gì?", options: [
        "Tăng gấp đôi tốc độ CPU",
        "Mỗi tiến trình thấy không gian địa chỉ riêng (như bắt đầu từ 0), được HĐH dịch sang RAM vật lý thật",
        "Xoá nhu cầu dùng RAM",
        "Cho phép hai tiến trình chia sẻ mọi biến với nhau"
      ], correct: 1,
      explanation: "Bộ nhớ ảo tạo cho mỗi tiến trình không gian riêng, cách ly nhau; phần cứng + kernel dịch địa chỉ ảo sang vật lý theo bảng trang." },
    { q: "Quan hệ giữa 'page' (trang) và 'frame' (khung) là gì?", options: [
        "Page là đơn vị của ổ đĩa, frame là đơn vị của CPU",
        "Bộ nhớ ảo chia thành các trang; RAM vật lý chia thành các khung cùng cỡ; bảng trang ánh xạ trang ↔ khung",
        "Chúng không liên quan gì nhau",
        "Frame lớn gấp đôi page luôn luôn"
      ], correct: 1,
      explanation: "Page (ảo) và frame (vật lý) cùng kích cỡ; page table ghi trang ảo X đang nằm ở khung vật lý Y." },
    { q: "Page fault xảy ra khi nào?", options: [
        "Khi trang mà CPU cần chưa có trong RAM, buộc kernel nạp nó vào từ đĩa",
        "Khi chương trình chia cho 0",
        "Khi hai tiến trình có cùng số trang",
        "Khi CPU quá nóng"
      ], correct: 0,
      explanation: "Trang cần dùng không có trong RAM (present=0) làm CPU phát page fault; kernel nạp trang rồi cho lệnh chạy lại." },
    { q: "Swap được dùng để làm gì?", options: [
        "Đổi chỗ hai tiến trình cho nhau trên CPU",
        "Nén dữ liệu trong RAM",
        "Khi RAM đầy, đẩy các trang ít dùng ra đĩa để lấy chỗ; khi cần lại thì nạp về",
        "Tăng số nhân CPU"
      ], correct: 2,
      explanation: "Swap dùng một phần đĩa làm 'RAM mở rộng': trang ít dùng bị đẩy ra để nhường chỗ, gây page fault khi cần lại; swap quá nhiều gây thrashing." }
  ]
});
