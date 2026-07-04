window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Làm quen",
  title: "Shell là gì? Terminal, REPL, prompt",
  subtitle: "Phân biệt terminal — shell — kernel; vòng đọc–thực thi–in",

  theory: `
    <p>Khi bạn mở "cửa sổ đen chữ trắng" trên máy, thực ra có <strong>ba thứ khác nhau</strong> đang phối
    hợp. Hiểu rõ ranh giới giữa chúng giúp bạn không bị rối về sau.</p>
    <ul>
      <li><strong>Terminal</strong> (cửa sổ): chỉ là cái <em>màn hình + bàn phím ảo</em>. Nó hiển thị chữ
      và nhận phím bạn gõ. Nó không hiểu lệnh — nó chỉ chuyển tiếp.</li>
      <li><strong>Shell</strong> (bash, zsh…): <em>người phiên dịch</em>. Nó đọc dòng chữ bạn gõ, hiểu ý,
      tìm chương trình tương ứng và bảo hệ thống chạy, rồi in kết quả ra terminal.</li>
      <li><strong>Kernel</strong> (nhân hệ điều hành): <em>người thực sự làm việc</em> — đọc/ghi file, cấp
      CPU, quản lý bộ nhớ. Shell chỉ nhờ kernel làm, chứ không tự làm.</li>
    </ul>
    <p>Hãy hình dung bạn là sếp ngồi trong phòng (terminal). Bạn ra lệnh bằng lời cho một <em>trợ lý</em>
    (shell). Trợ lý không tự khuân vác, mà chuyển yêu cầu xuống <em>đội hậu cần</em> (kernel) làm rồi báo
    kết quả lại cho bạn.</p>
    <p>Shell hoạt động theo vòng lặp gọi là <strong>REPL</strong>: <em>Read</em> (đọc lệnh) →
    <em>Eval</em> (thực thi) → <em>Print</em> (in kết quả) → <em>Loop</em> (quay lại chờ lệnh tiếp).
    Dấu nhắc <strong>prompt</strong> (thường là ký tự USD) là cách shell nói "tôi rảnh rồi, mời gõ lệnh".</p>
    <div class="callout"><p>💡 Một prompt thường có dạng <code>ten_may:thu_muc$</code>. Phần trước dấu USD
    cho biết bạn đang ở đâu; dấu USD (hoặc %) báo shell đang chờ. Thấy prompt = shell sẵn sàng.</p></div>
  `,

  codeTabs: [
    { id: "repl", label: "🐚 Một vòng REPL", lines: [
      "# Prompt xuất hiện → shell đang chờ bạn (Read)",
      "$ date",
      "Thu Jul  3 09:15:00 2026",
      "# shell chạy chương trình 'date' (Eval), in kết quả (Print)",
      "$ echo Xin chao",
      "Xin chao",
      "$",
      "# prompt lại hiện ra → quay về đầu vòng (Loop)"
    ]},
    { id: "who", label: "🧩 Ai là ai", lines: [
      "# Hỏi shell: mày là chương trình nào?",
      "$ echo $0",
      "-zsh",
      "# xem đường dẫn chương trình shell đang chạy",
      "$ which zsh",
      "/bin/zsh",
      "# terminal chỉ hiển thị; shell mới là thứ đọc & hiểu dòng này"
    ]}
  ],

  stageHtml: `
    <div class="node" id="you"><div class="nl">🧑 Bạn gõ lệnh</div><div class="ns">bàn phím trong terminal</div></div>
    <div class="arrow" id="a1">↓ ký tự truyền vào</div>
    <div class="node" id="term"><div class="nl">🖥️ Terminal</div><div class="ns">chỉ hiển thị & chuyển tiếp, không hiểu lệnh</div></div>
    <div class="arrow" id="a2">↓ giao cả dòng lệnh cho shell</div>
    <div class="node" id="shell"><div class="nl">🐚 Shell (bash/zsh)</div><div class="ns">Read → Eval: phiên dịch, tìm chương trình</div></div>
    <div class="arrow" id="a3">↓ nhờ kernel thực thi</div>
    <div class="node" id="kernel"><div class="nl">⚙️ Kernel</div><div class="ns">đọc file, cấp CPU/bộ nhớ — làm việc thật</div></div>
    <div class="arrow" id="a4">↑ Print: kết quả in ngược ra terminal</div>
    <div class="node" id="out"><div class="nl">📤 Kết quả hiển thị</div><div class="ns">rồi prompt hiện lại → Loop</div></div>
  `,
  steps: [
    { title: "1 · Prompt mời bạn (Read)", tab: "repl", highlight: [1, 2], on: ["you", "a1", "term"],
      desc: "Thấy dấu <code>$</code> là shell đang chờ. Bạn gõ <code>date</code> và nhấn Enter. Terminal chỉ nhận phím và hiển thị — nó chưa hiểu gì cả, chỉ chuyển tiếp." },
    { title: "2 · Shell phiên dịch (Eval)", tab: "repl", highlight: [3, 4], on: ["term", "a2", "shell"],
      desc: "Shell nhận cả dòng, tách ra tên lệnh <code>date</code>, tìm chương trình tương ứng và yêu cầu chạy. Shell là <strong>người phiên dịch</strong> đứng giữa bạn và hệ thống." },
    { title: "3 · Kernel làm việc thật", tab: "who", highlight: [2, 3], on: ["shell", "a3", "kernel"],
      desc: "Chương trình chạy nhờ <strong>kernel</strong> cấp CPU, bộ nhớ và truy cập phần cứng (như đồng hồ hệ thống). Shell không tự làm — nó chỉ nhờ kernel, như trợ lý gọi đội hậu cần." },
    { title: "4 · In kết quả (Print)", tab: "repl", highlight: [5, 6], on: ["kernel", "a4", "out"],
      desc: "Kết quả được in ngược ra terminal để bạn đọc. Với <code>echo Xin chao</code>, shell chỉ in lại đúng chữ bạn đưa." },
    { title: "5 · Quay lại chờ (Loop)", tab: "repl", highlight: [7, 8], on: ["out"],
      desc: "Xong một lệnh, prompt <code>$</code> hiện lại — shell quay về đầu vòng <strong>REPL</strong>, sẵn sàng cho lệnh kế. Cứ thế lặp mãi cho tới khi bạn thoát." },
    { title: "6 · Shell nào đang chạy?", tab: "who", highlight: [4, 5, 6], on: ["shell"],
      desc: "<code>echo $0</code> cho biết tên shell hiện tại; <code>which zsh</code> chỉ ra file chương trình của nó. Nhớ: <em>terminal</em> là cửa sổ, còn <em>shell</em> mới là bộ não đọc lệnh." }
  ],

  quiz: [
    { q: "Trong bộ ba terminal — shell — kernel, thành phần nào ĐỌC và HIỂU dòng lệnh bạn gõ?", options: [
        "Terminal",
        "Shell",
        "Kernel",
        "Cả ba cùng hiểu như nhau"
      ], correct: 1,
      explanation: "Terminal chỉ hiển thị và chuyển tiếp ký tự; kernel thực thi ở tầng dưới; chính shell là người phiên dịch đọc và hiểu dòng lệnh." },
    { q: "REPL trong ngữ cảnh shell mô tả điều gì?", options: [
        "Một loại file cấu hình của bash",
        "Vòng lặp Read → Eval → Print → Loop mà shell chạy liên tục",
        "Tên một chương trình dò lỗi mạng",
        "Chế độ chỉ đọc, không cho gõ lệnh"
      ], correct: 1,
      explanation: "Shell đọc lệnh, thực thi, in kết quả rồi quay lại chờ lệnh mới — đó chính là vòng REPL." },
    { q: "Dấu nhắc (prompt), thường là ký tự đô-la, có ý nghĩa gì?", options: [
        "Báo có lỗi vừa xảy ra",
        "Yêu cầu bạn nhập mật khẩu",
        "Shell đang rảnh và sẵn sàng nhận lệnh mới",
        "Máy sắp tắt"
      ], correct: 2,
      explanation: "Prompt là cách shell nói 'tôi sẵn sàng, mời gõ lệnh'. Thấy prompt nghĩa là shell đang chờ bạn." },
    { q: "Vì sao nói shell 'không tự làm việc' mà phải qua kernel?", options: [
        "Vì shell nhờ kernel truy cập phần cứng, file và cấp CPU/bộ nhớ",
        "Vì shell chạy chậm hơn kernel",
        "Vì shell không có quyền hiển thị chữ",
        "Vì kernel là một loại terminal đặc biệt"
      ], correct: 0,
      explanation: "Shell chỉ phiên dịch lệnh rồi yêu cầu kernel — thứ thực sự đọc/ghi file, quản lý CPU và bộ nhớ — thực thi." }
  ]
});
