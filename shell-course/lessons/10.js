window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Scripting",
  title: "Viết shell script: shebang, chạy",
  subtitle: "Gói nhiều lệnh vào một file; #!/bin/bash; chmod +x; tham số USD1",

  theory: `
    <p>Cho tới giờ ta gõ từng lệnh một. Nhưng nếu một chuỗi lệnh phải lặp đi lặp lại, ta gói chúng vào một
    <strong>script</strong> — một file văn bản chứa các lệnh, chạy từ trên xuống như thể bạn tự gõ.</p>
    <p>Dòng đầu tiên rất đặc biệt: <strong>shebang</strong>, viết <code>#!</code> rồi tới đường dẫn trình
    thông dịch, ví dụ <code>#!/bin/bash</code>. Nó nói cho hệ thống biết <em>dùng chương trình nào để chạy
    file này</em>. Không có shebang, hệ thống không chắc nên dùng bash, python hay gì khác.</p>
    <p>Ba bước để một script chạy được (đúng những gì đã học ở bài 05 và 09):</p>
    <ul>
      <li><strong>Viết</strong> file, dòng đầu là shebang.</li>
      <li><strong>Cấp quyền</strong>: <code>chmod +x run.sh</code> (thêm quyền thực thi x).</li>
      <li><strong>Chạy</strong>: <code>./run.sh</code> (dấu ./ vì thư mục hiện tại không nằm trong PATH).</li>
    </ul>
    <p>Script trở nên linh hoạt nhờ <strong>tham số dòng lệnh</strong>. Khi gọi <code>./chao.sh An</code>,
    bên trong script:</p>
    <ul>
      <li>USD1 là tham số thứ nhất (<code>An</code>), USD2 là thứ hai, và cứ thế.</li>
      <li>USD0 là tên chính script; biến môi trường có tên "số tham số" đếm bao nhiêu tham số được truyền.</li>
    </ul>
    <div class="callout"><p>💡 Dòng bắt đầu bằng <code>#</code> (trừ shebang) là <strong>comment</strong> —
    ghi chú cho người đọc, shell bỏ qua. Luôn chú thích script để bạn-của-tương-lai còn hiểu. Thoát khỏi
    script sớm khi gặp sự cố bằng <code>exit</code> (học kỹ ở bài 12).</p></div>
  `,

  codeTabs: [
    { id: "write", label: "📄 Nội dung chao.sh", lines: [
      "#!/bin/bash",
      "# script chao ten truyen vao",
      "echo \"Bat dau chay boi: $0\"",
      "echo \"Xin chao, $1!\"",
      "echo \"Ban truyen $# tham so\"",
      "# $1 = tham so 1, $0 = ten script, $# = so tham so"
    ]},
    { id: "make", label: "🔑 Cấp quyền & chạy", lines: [
      "# Thiếu quyền x → chưa chạy được",
      "$ ./chao.sh An",
      "zsh: permission denied: ./chao.sh",
      "# Cấp quyền thực thi",
      "$ chmod +x chao.sh",
      "# Giờ chạy được, truyền 'An' làm $1",
      "$ ./chao.sh An",
      "Bat dau chay boi: ./chao.sh",
      "Xin chao, An!",
      "Ban truyen 1 tham so"
    ]},
    { id: "args", label: "🎛️ Nhiều tham số", lines: [
      "# Truyền hai tham số",
      "$ ./chao.sh Binh Cuong",
      "Bat dau chay boi: ./chao.sh",
      "Xin chao, Binh!",
      "Ban truyen 2 tham so",
      "# $1=Binh, $2=Cuong; script chi in $1",
      "# Không tham số → $1 rỗng",
      "$ ./chao.sh",
      "Xin chao, !"
    ]}
  ],

  stageHtml: `
    <div class="node" id="file"><div class="nl">📄 chao.sh</div><div class="ns">dòng 1 = shebang #!/bin/bash</div></div>
    <div class="arrow" id="a1">↓ chmod +x (cấp quyền thực thi)</div>
    <div class="node" id="exec"><div class="nl">🔑 -rwxr-xr-x chao.sh</div><div class="ns">giờ có quyền x</div></div>
    <div class="arrow" id="a2">↓ ./chao.sh An  (dấu ./ vì không trong PATH)</div>
    <div class="node" id="shebang"><div class="nl">🧭 Hệ thống đọc shebang</div><div class="ns">dùng /bin/bash để chạy file này</div></div>
    <div class="arrow" id="a3">↓ bash chạy từng dòng, gán tham số</div>
    <div class="row">
      <div class="node" id="p0"><div class="nl">$0 = ./chao.sh</div><div class="ns">tên chính script</div></div>
      <div class="node" id="p1"><div class="nl">$1 = An</div><div class="ns">tham số thứ nhất</div></div>
    </div>
    <div class="arrow" id="a4">↓ in kết quả</div>
    <div class="node" id="out"><div class="nl">📤 Xin chao, An!</div><div class="ns">script hoàn tất</div></div>
  `,
  steps: [
    { title: "1 · Viết file & shebang", tab: "write", highlight: [1, 2, 3], on: ["file"],
      desc: "Dòng đầu <code>#!/bin/bash</code> là <strong>shebang</strong> — nói hệ thống dùng bash để chạy file. Các dòng sau là lệnh, dòng có <code>#</code> là comment." },
    { title: "2 · Cấp quyền thực thi", tab: "make", highlight: [1, 2, 3, 4, 5], on: ["file", "a1", "exec"],
      desc: "Chạy ngay sẽ bị <em>permission denied</em> vì file mới thiếu quyền <code>x</code>. <code>chmod +x chao.sh</code> cấp quyền — đúng như bài 05." },
    { title: "3 · Chạy bằng ./", tab: "make", highlight: [6, 7, 8, 9, 10], on: ["exec", "a2", "shebang"],
      desc: "Gọi <code>./chao.sh An</code>: dấu <code>./</code> vì thư mục hiện tại không nằm trong PATH. Hệ thống đọc shebang và giao file cho bash chạy." },
    { title: "4 · Tham số USD1", tab: "make", highlight: [7, 8, 9, 10], on: ["shebang", "a3", "p1", "a4", "out"],
      desc: "Bên trong script, <code>$1</code> nhận giá trị tham số đầu tiên (<code>An</code>). Đây là cách script nhận đầu vào linh hoạt mỗi lần gọi." },
    { title: "5 · Nhiều tham số & USD0", tab: "args", highlight: [1, 2, 3, 4, 5, 6], on: ["p0", "p1"],
      desc: "<code>$1</code>, <code>$2</code>… là các tham số theo thứ tự; <code>$0</code> là tên script; biến số-tham-số cho biết có bao nhiêu tham số được truyền vào." },
    { title: "6 · Khi thiếu tham số", tab: "args", highlight: [7, 8, 9], on: ["out"],
      desc: "Không truyền gì thì <code>$1</code> <strong>rỗng</strong> — in ra 'Xin chao, !'. Script tốt nên kiểm tra tham số trước khi dùng (bạn sẽ học điều kiện ở bài 11)." }
  ],

  quiz: [
    { q: "Dòng <code>#!/bin/bash</code> ở đầu script (shebang) có tác dụng gì?", options: [
        "Là một comment bị bỏ qua hoàn toàn",
        "Nói cho hệ thống biết dùng chương trình nào (/bin/bash) để chạy file này",
        "Cấp quyền thực thi cho script",
        "In dòng đó ra màn hình"
      ], correct: 1,
      explanation: "Shebang chỉ định trình thông dịch chạy file; thiếu nó hệ thống không biết nên dùng bash, python hay gì khác." },
    { q: "Bên trong script, <code>$1</code> đại diện cho điều gì?", options: [
        "Tên của script",
        "Số lượng tham số được truyền",
        "Tham số dòng lệnh thứ nhất",
        "Kết quả của lệnh trước"
      ], correct: 2,
      explanation: "$1 là tham số vị trí thứ nhất, $2 thứ hai...; $0 mới là tên script." },
    { q: "Bạn viết xong <code>deploy.sh</code> nhưng chạy báo 'permission denied'. Cần làm gì trước?", options: [
        "chmod +x deploy.sh để thêm quyền thực thi",
        "Đổi shebang thành #!/bin/zsh",
        "Xoá comment trong file",
        "Thêm nhiều tham số hơn"
      ], correct: 0,
      explanation: "File script mới thường chưa có quyền x; chmod +x cấp quyền để chạy được bằng ./deploy.sh." },
    { q: "Trong một script, dòng bắt đầu bằng <code>#</code> (không phải shebang) là gì?", options: [
        "Một lệnh đặc biệt chạy ngầm",
        "Comment — ghi chú cho người đọc, shell bỏ qua",
        "Một biến môi trường",
        "Một lỗi cú pháp"
      ], correct: 1,
      explanation: "Ngoài dòng shebang đầu tiên, mọi dòng mở đầu bằng # là comment; shell không thực thi chúng." }
  ]
});
