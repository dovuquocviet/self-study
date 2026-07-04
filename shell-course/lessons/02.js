window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Làm quen",
  title: "Cấu trúc lệnh: command, argument, flag",
  subtitle: "Đọc hiểu một dòng lệnh; tra cứu bằng man và --help",

  theory: `
    <p>Mọi dòng lệnh, dù trông phức tạp đến đâu, đều theo một khuôn mẫu duy nhất. Nắm khuôn mẫu này rồi
    thì lệnh lạ mấy bạn cũng "đọc" được.</p>
    <p>Khuôn mẫu: <code>lệnh -cờ --cờ-dài đối_số</code>. Ba loại thành phần:</p>
    <ul>
      <li><strong>Command (lệnh)</strong>: từ đầu tiên — <em>động từ</em>, nói làm việc gì. Ví dụ
      <code>ls</code>, <code>cp</code>, <code>rm</code>. Đây là tên chương trình sẽ chạy.</li>
      <li><strong>Argument (đối số)</strong>: <em>đối tượng</em> để lệnh tác động lên — thường là tên
      file, thư mục, hay một chuỗi. Ví dụ trong <code>rm ghichu.txt</code> thì <code>ghichu.txt</code>
      là đối số.</li>
      <li><strong>Flag / Option (cờ)</strong>: <em>trạng từ</em>, chỉnh cách lệnh chạy. Cờ ngắn đi với
      một dấu gạch (<code>-l</code>), cờ dài đi với hai gạch (<code>--all</code>). Nhiều cờ ngắn có thể
      gộp: <code>-la</code> = <code>-l -a</code>.</li>
    </ul>
    <p>Ví dụ đời thường: "hãy <em>giao</em> (command) <em>nhanh</em> (flag) <em>gói hàng này</em>
    (argument)". Máy tính đọc y hệt: động từ trước, rồi các tinh chỉnh, rồi đối tượng.</p>
    <p>Không nhớ một lệnh làm gì? Có hai cửa tra cứu: <code>man ten_lenh</code> mở sổ tay đầy đủ, còn
    <code>ten_lenh --help</code> in nhanh tóm tắt cách dùng ngay tại chỗ.</p>
    <div class="callout"><p>💡 Nhiều cờ nhận thêm <em>giá trị</em>: <code>-o ketqua.txt</code> nghĩa là cờ
    <code>-o</code> đi kèm giá trị <code>ketqua.txt</code>. Thứ tự cờ thường không quan trọng, nhưng vị
    trí đối số thì có thể quan trọng.</p></div>
  `,

  codeTabs: [
    { id: "anatomy", label: "🔤 Mổ xẻ một lệnh", lines: [
      "# ls  = command | -l -a = flag | Documents = argument",
      "$ ls -l -a Documents",
      "total 24",
      "drwxr-xr-x  4 an  staff   128 Jul  3 09:00 .",
      "-rw-r--r--  1 an  staff  1024 Jul  2 18:00 cv.pdf",
      "# gộp cờ: -la giống hệt -l -a ở trên",
      "$ ls -la Documents",
      "# → cùng kết quả, gõ ngắn hơn"
    ]},
    { id: "help", label: "📖 man & --help", lines: [
      "# Sổ tay đầy đủ (dùng phím q để thoát)",
      "$ man ls",
      "LS(1)   User Commands   LS(1)",
      "NAME  ls - list directory contents",
      "# Tóm tắt nhanh ngay tại prompt",
      "$ ls --help",
      "Usage: ls [OPTION]... [FILE]...",
      "  -l   dùng định dạng danh sách dài"
    ]}
  ],

  stageHtml: `
    <div class="node" id="line"><div class="nl">⌨️ Bạn gõ: ls -la Documents</div><div class="ns">shell tách dòng theo khoảng trắng</div></div>
    <div class="arrow" id="a1">↓ token đầu tiên = lệnh</div>
    <div class="row">
      <div class="node" id="cmd"><div class="nl">🟢 command</div><div class="ns">ls — làm việc gì</div></div>
      <div class="node" id="flag"><div class="nl">🔵 flag</div><div class="ns">-la — chỉnh cách chạy</div></div>
      <div class="node" id="arg"><div class="nl">🟠 argument</div><div class="ns">Documents — tác động lên cái gì</div></div>
    </div>
    <div class="arrow" id="a2">↓ shell chạy chương trình với các phần đã tách</div>
    <div class="node" id="run"><div class="nl">▶️ Thực thi</div><div class="ns">ls đọc cờ -la, liệt kê thư mục Documents</div></div>
    <div class="arrow" id="a3">↓ quên cú pháp? tra cứu</div>
    <div class="node" id="doc"><div class="nl">📚 man / --help</div><div class="ns">xem mọi cờ & cách dùng</div></div>
  `,
  steps: [
    { title: "1 · Shell tách dòng lệnh", tab: "anatomy", highlight: [1, 2], on: ["line", "a1", "cmd"],
      desc: "Shell cắt dòng theo khoảng trắng thành các <em>token</em>. Token <strong>đầu tiên</strong> luôn là <code>command</code> — tên chương trình sẽ chạy." },
    { title: "2 · Nhận diện flag", tab: "anatomy", highlight: [2], on: ["cmd", "flag"],
      desc: "Token bắt đầu bằng <code>-</code> hoặc <code>--</code> là <strong>flag</strong>. Chúng chỉnh <em>cách</em> lệnh chạy: <code>-l</code> = danh sách dài, <code>-a</code> = hiện cả file ẩn." },
    { title: "3 · Nhận diện argument", tab: "anatomy", highlight: [2, 4, 5], on: ["flag", "arg", "a2", "run"],
      desc: "Token còn lại (<code>Documents</code>) là <strong>argument</strong> — đối tượng lệnh tác động lên. Shell ghép tất cả lại và chạy <code>ls</code> với cờ và đối số đó." },
    { title: "4 · Gộp cờ cho gọn", tab: "anatomy", highlight: [6, 7, 8], on: ["run"],
      desc: "Các cờ ngắn có thể gộp: <code>-la</code> tương đương <code>-l -a</code>. Kết quả y hệt, chỉ gõ ngắn hơn. Đây là thói quen rất phổ biến." },
    { title: "5 · Quên thì tra man", tab: "help", highlight: [1, 2, 3, 4], on: ["run", "a3", "doc"],
      desc: "<code>man ls</code> mở <strong>sổ tay</strong> đầy đủ mọi cờ và ví dụ. Cuộn bằng phím mũi tên, thoát bằng phím <code>q</code>." },
    { title: "6 · Xem nhanh với --help", tab: "help", highlight: [5, 6, 7, 8], on: ["doc"],
      desc: "Cần tóm tắt tức thì? <code>ls --help</code> in ngay dòng <code>Usage</code> và danh sách cờ ra prompt, không rời màn hình." }
  ],

  quiz: [
    { q: "Trong lệnh <code>rm -f ghichu.txt</code>, thành phần nào là argument?", options: [
        "rm",
        "-f",
        "ghichu.txt",
        "dấu cách giữa các token"
      ], correct: 2,
      explanation: "rm là command, -f là flag (chỉnh cách chạy), còn ghichu.txt là argument — đối tượng bị tác động." },
    { q: "Cách viết cờ nào tương đương với <code>-l -a</code>?", options: [
        "--la",
        "-la",
        "l-a",
        "-l--a"
      ], correct: 1,
      explanation: "Các cờ ngắn một chữ có thể gộp sau một dấu gạch: -la chính là -l -a." },
    { q: "Bạn quên hoàn toàn các cờ của một lệnh. Cách tra cứu nhanh nhất ngay tại prompt là gì?", options: [
        "Khởi động lại terminal",
        "Gõ lệnh đó kèm --help hoặc man ten_lenh",
        "Xoá lệnh khỏi hệ thống",
        "Đổi sang shell khác"
      ], correct: 1,
      explanation: "man ten_lenh mở sổ tay đầy đủ, còn ten_lenh --help in tóm tắt cách dùng ngay lập tức." },
    { q: "Sự khác biệt giữa cờ ngắn và cờ dài về mặt cú pháp là gì?", options: [
        "Cờ ngắn dùng một gạch (-l), cờ dài dùng hai gạch (--all)",
        "Cờ ngắn phải viết hoa, cờ dài viết thường",
        "Cờ dài luôn đứng trước cờ ngắn",
        "Không có khác biệt, chỉ là sở thích"
      ], correct: 0,
      explanation: "Quy ước: cờ ngắn một ký tự đi với một dấu gạch, cờ dài dạng từ đi với hai dấu gạch." }
  ]
});
