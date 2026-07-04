window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Hệ thống file",
  title: "Điều hướng: pwd, cd, ls, đường dẫn",
  subtitle: "Cây thư mục; đường dẫn tuyệt đối vs tương đối; . .. ~ /",

  theory: `
    <p>Hệ thống file là một <strong>cây thư mục</strong>: bắt đầu từ gốc <code>/</code>, phân nhánh thành
    các thư mục con, mỗi thư mục lại chứa file và thư mục con nữa. Giống như tủ hồ sơ: ngăn lớn chứa ngăn
    nhỏ, ngăn nhỏ chứa tài liệu.</p>
    <p>Bạn luôn "đứng" ở đâu đó trong cây này — gọi là <strong>thư mục hiện tại</strong> (working
    directory). Ba lệnh điều hướng cốt lõi:</p>
    <ul>
      <li><code>pwd</code> — <em>"tôi đang ở đâu?"</em> In đường dẫn đầy đủ tới thư mục hiện tại.</li>
      <li><code>ls</code> — <em>"quanh đây có gì?"</em> Liệt kê nội dung thư mục.</li>
      <li><code>cd</code> — <em>"đi tới chỗ khác"</em> (change directory). Đổi thư mục hiện tại.</li>
    </ul>
    <p>Để chỉ một chỗ trong cây, bạn dùng <strong>đường dẫn</strong>. Có hai kiểu:</p>
    <ul>
      <li><strong>Tuyệt đối</strong>: bắt đầu bằng <code>/</code> — chỉ từ gốc, luôn đúng bất kể bạn đang
      đứng đâu. Ví dụ <code>/Users/an/Documents</code>. Như địa chỉ nhà đầy đủ có số nhà, đường, thành phố.</li>
      <li><strong>Tương đối</strong>: <em>không</em> bắt đầu bằng <code>/</code> — tính từ chỗ bạn đang
      đứng. Ví dụ <code>Documents/cv.pdf</code>. Như nói "rẽ trái ở ngã tư tới" — phụ thuộc bạn đang ở đâu.</li>
    </ul>
    <p>Bốn ký hiệu tắt cực kỳ hay dùng:</p>
    <div class="callout"><p>💡 <code>.</code> = thư mục hiện tại · <code>..</code> = thư mục cha (lùi một
    bậc) · <code>~</code> = thư mục nhà của bạn (home) · <code>/</code> = gốc của cả cây. Ví dụ
    <code>cd ..</code> nghĩa là "lùi ra ngoài một bậc".</p></div>
  `,

  codeTabs: [
    { id: "nav", label: "🧭 Đi lại trong cây", lines: [
      "# Tôi đang ở đâu?",
      "$ pwd",
      "/Users/an",
      "# Quanh đây có gì?",
      "$ ls",
      "Documents  Downloads  Pictures",
      "# Đi vào Documents (đường dẫn tương đối)",
      "$ cd Documents",
      "$ pwd",
      "/Users/an/Documents"
    ]},
    { id: "shortcut", label: "⏩ . .. ~ /", lines: [
      "$ cd ..            # lùi ra cha",
      "$ pwd",
      "/Users/an",
      "$ cd ~             # về thẳng home",
      "$ cd /             # về gốc cây",
      "$ pwd",
      "/",
      "# cd không đối số cũng về home"
    ]},
    { id: "abs", label: "🗺️ Tuyệt đối vs tương đối", lines: [
      "# Tuyệt đối: bắt đầu bằng / → luôn tới đúng chỗ",
      "$ cd /Users/an/Pictures",
      "# Tương đối: tính từ chỗ đang đứng",
      "$ cd ../Downloads",
      "$ pwd",
      "/Users/an/Downloads",
      "# cùng đích, hai cách viết khác nhau"
    ]}
  ],

  stageHtml: `
    <div class="node" id="root"><div class="nl">📁 / (gốc)</div><div class="ns">đỉnh của cả cây thư mục</div></div>
    <div class="arrow" id="a1">↓ chứa</div>
    <div class="node" id="users"><div class="nl">📁 /Users</div><div class="ns">nơi chứa các tài khoản</div></div>
    <div class="arrow" id="a2">↓ chứa thư mục nhà (~)</div>
    <div class="node" id="home"><div class="nl">🏠 /Users/an  (~)</div><div class="ns">home — nơi cd không đối số đưa bạn về</div></div>
    <div class="arrow" id="a3">↓ chứa các thư mục con</div>
    <div class="row">
      <div class="node" id="docs"><div class="nl">📂 Documents</div><div class="ns">cd Documents để vào</div></div>
      <div class="node" id="dl"><div class="nl">📂 Downloads</div><div class="ns">cd .. để lùi ra rồi vào đây</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Xác định vị trí với pwd", tab: "nav", highlight: [1, 2, 3], on: ["home"],
      desc: "<code>pwd</code> (print working directory) trả lời câu hỏi <em>tôi đang đứng ở đâu</em> bằng một đường dẫn tuyệt đối, ví dụ <code>/Users/an</code> — chính là home của bạn." },
    { title: "2 · Nhìn quanh với ls", tab: "nav", highlight: [4, 5, 6], on: ["home", "a3", "docs"],
      desc: "<code>ls</code> liệt kê nội dung thư mục hiện tại. Ở đây thấy các thư mục con <code>Documents</code>, <code>Downloads</code>, <code>Pictures</code>." },
    { title: "3 · Đi vào bằng cd (tương đối)", tab: "nav", highlight: [7, 8, 9, 10], on: ["docs"],
      desc: "<code>cd Documents</code> dùng đường dẫn <strong>tương đối</strong>: tính từ chỗ đang đứng. Sau đó <code>pwd</code> xác nhận bạn đã ở trong <code>/Users/an/Documents</code>." },
    { title: "4 · Lùi ra cha với ..", tab: "shortcut", highlight: [1, 2, 3], on: ["docs", "home"],
      desc: "<code>..</code> nghĩa là <strong>thư mục cha</strong>. <code>cd ..</code> lùi ra ngoài một bậc, đưa bạn từ Documents trở lại <code>/Users/an</code>." },
    { title: "5 · Nhảy nhanh với ~ và /", tab: "shortcut", highlight: [4, 5, 6, 7], on: ["home", "root"],
      desc: "<code>~</code> là lối tắt về <strong>home</strong>, <code>/</code> là <strong>gốc</strong> cây. Dù đang ở sâu đến đâu, hai ký hiệu này đưa bạn về ngay lập tức." },
    { title: "6 · Tuyệt đối vs tương đối", tab: "abs", highlight: [1, 2, 3, 4], on: ["home", "dl"],
      desc: "Đường dẫn <strong>tuyệt đối</strong> mở đầu bằng <code>/</code> nên luôn tới đúng chỗ. Đường dẫn <strong>tương đối</strong> (như <code>../Downloads</code>) phụ thuộc bạn đang đứng đâu — cùng đích nhưng hai cách viết." }
  ],

  quiz: [
    { q: "Lệnh nào trả lời câu hỏi 'tôi đang đứng ở thư mục nào'?", options: [
        "ls",
        "cd",
        "pwd",
        "man"
      ], correct: 2,
      explanation: "pwd (print working directory) in đường dẫn đầy đủ tới thư mục hiện tại." },
    { q: "Ký hiệu <code>..</code> trong đường dẫn nghĩa là gì?", options: [
        "Thư mục gốc của hệ thống",
        "Thư mục cha (lùi ra một bậc)",
        "Thư mục nhà của bạn",
        "Thư mục hiện tại"
      ], correct: 1,
      explanation: "Một dấu chấm . là thư mục hiện tại; hai dấu chấm .. là thư mục cha, dùng để lùi ra ngoài." },
    { q: "Đường dẫn nào là TUYỆT ĐỐI?", options: [
        "Documents/cv.pdf",
        "../Downloads",
        "./anh.png",
        "/Users/an/Pictures"
      ], correct: 3,
      explanation: "Đường dẫn tuyệt đối bắt đầu bằng dấu gạch chéo / (gốc); ba đáp án còn lại tính từ chỗ đang đứng nên là tương đối." },
    { q: "Bạn đang ở <code>/Users/an/Documents</code> và gõ <code>cd ~</code>. Bạn sẽ tới đâu?", options: [
        "Thư mục nhà /Users/an",
        "Thư mục gốc /",
        "Lùi ra /Users/an/Documents (không đổi)",
        "Thư mục /Users"
      ], correct: 0,
      explanation: "~ là lối tắt tới thư mục nhà (home), tức /Users/an, bất kể bạn đang đứng ở đâu." }
  ]
});
