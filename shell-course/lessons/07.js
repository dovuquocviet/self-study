window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Sức mạnh dòng lệnh",
  title: "Wildcards & globbing: * ? []",
  subtitle: "Shell mở rộng mẫu THÀNH danh sách tên trước khi chạy lệnh",

  theory: `
    <p>Bạn có 50 file ảnh và muốn xoá hết file <code>.tmp</code>. Gõ từng tên thì phát điên. Giải pháp là
    <strong>wildcard</strong> (ký tự đại diện) — mẫu ngắn gọn khớp với nhiều tên file cùng lúc.</p>
    <p>Điều <em>quan trọng nhất</em> phải hiểu: mở rộng mẫu là việc của <strong>SHELL</strong>, làm
    <em>TRƯỚC</em> khi lệnh chạy. Shell nhìn mẫu, tìm mọi tên file khớp trong thư mục, thay mẫu bằng danh
    sách tên thật, <em>rồi mới</em> giao cho lệnh. Lệnh (như <code>rm</code>) không hề biết có wildcard —
    nó chỉ thấy danh sách tên đã nở ra. Quá trình này gọi là <strong>globbing</strong>.</p>
    <ul>
      <li><code>*</code> — khớp <strong>bất kỳ chuỗi nào</strong> (kể cả rỗng). <code>*.txt</code> = mọi
      file kết thúc bằng .txt.</li>
      <li><code>?</code> — khớp <strong>đúng một</strong> ký tự bất kỳ. <code>anh?.png</code> khớp
      <code>anh1.png</code>, <code>anhA.png</code> nhưng không khớp <code>anh12.png</code>.</li>
      <li><code>[...]</code> — khớp <strong>một ký tự trong tập</strong>. <code>anh[123].png</code> chỉ
      khớp anh1/anh2/anh3; <code>[a-z]</code> khớp một chữ thường bất kỳ.</li>
    </ul>
    <div class="callout"><p>💡 Hệ quả bất ngờ: nếu <strong>không có file nào khớp</strong>, shell (bash mặc
    định) giao <em>nguyên mẫu chưa nở</em> cho lệnh, dẫn tới lỗi khó hiểu. Và vì shell nở mẫu trước, một
    lệnh vô hại như <code>ls *</code> có thể bung thành hàng trăm đối số. Muốn ký tự <code>*</code> giữ
    nguyên nghĩa đen, hãy bọc trong nháy: <code>"*"</code>.</p></div>
  `,

  codeTabs: [
    { id: "star", label: "⭐ Dấu *", lines: [
      "$ ls",
      "cv.txt  anh1.png  anh2.png  ghichu.md  todo.txt",
      "# Mọi file .txt",
      "$ ls *.txt",
      "cv.txt  todo.txt",
      "# Mọi file bắt đầu bằng 'anh'",
      "$ ls anh*",
      "anh1.png  anh2.png"
    ]},
    { id: "qmark", label: "❓ ? và [ ]", lines: [
      "# ? khớp ĐÚNG một ký tự",
      "$ ls anh?.png",
      "anh1.png  anh2.png",
      "# [ ] khớp một ký tự trong tập",
      "$ ls anh[12].png",
      "anh1.png  anh2.png",
      "# dải: [a-z] một chữ thường bất kỳ",
      "$ ls file[a-c].log",
      "filea.log  fileb.log"
    ]},
    { id: "expand", label: "🔬 Ai nở mẫu?", lines: [
      "# Bạn gõ:",
      "$ rm *.tmp",
      "# SHELL nở mẫu TRƯỚC khi chạy, thành:",
      "#   rm cache.tmp draft.tmp old.tmp",
      "# rm KHÔNG hề thấy dấu *, chỉ thấy tên thật",
      "# Bọc nháy để giữ nghĩa đen dấu *",
      "$ echo \"*\"",
      "*"
    ]}
  ],

  stageHtml: `
    <div class="node" id="type"><div class="nl">⌨️ Bạn gõ: rm *.tmp</div><div class="ns">mẫu còn nguyên, chưa nở</div></div>
    <div class="arrow" id="a1">↓ SHELL bắt lấy mẫu TRƯỚC khi chạy</div>
    <div class="node" id="scan"><div class="nl">🔎 Shell quét thư mục</div><div class="ns">tìm mọi tên khớp *.tmp</div></div>
    <div class="arrow" id="a2">↓ thay mẫu bằng danh sách tên thật</div>
    <div class="node" id="expanded"><div class="nl">📋 rm cache.tmp draft.tmp</div><div class="ns">mẫu đã nở thành đối số cụ thể</div></div>
    <div class="arrow" id="a3">↓ giờ mới giao cho lệnh</div>
    <div class="node" id="cmd"><div class="nl">▶️ rm nhận danh sách</div><div class="ns">rm không hề biết có dấu * — chỉ thấy tên</div></div>
  `,
  steps: [
    { title: "1 · Dấu * khớp mọi chuỗi", tab: "star", highlight: [1, 2, 3, 4, 5], on: ["type"],
      desc: "<code>*.txt</code> khớp mọi tên kết thúc bằng <code>.txt</code>. Dấu <code>*</code> thay cho một chuỗi bất kỳ, dài ngắn tuỳ ý (kể cả rỗng)." },
    { title: "2 · * ở đầu, giữa, cuối", tab: "star", highlight: [6, 7, 8], on: ["type"],
      desc: "<code>anh*</code> khớp mọi tên bắt đầu bằng 'anh'. Bạn đặt <code>*</code> ở đâu trong mẫu cũng được — nó khớp phần còn thiếu tại vị trí đó." },
    { title: "3 · ? khớp đúng một ký tự", tab: "qmark", highlight: [1, 2, 3], on: ["type"],
      desc: "<code>?</code> khắt khe hơn: khớp <strong>đúng một</strong> ký tự. <code>anh?.png</code> khớp anh1.png nhưng KHÔNG khớp anh12.png (hai ký tự)." },
    { title: "4 · [ ] chọn trong một tập", tab: "qmark", highlight: [4, 5, 6, 7, 8], on: ["type"],
      desc: "<code>[12]</code> khớp '1' hoặc '2'; <code>[a-c]</code> khớp một chữ trong dải a đến c. Cách khoanh vùng chính xác một ký tự trong nhóm cho phép." },
    { title: "5 · Shell nở mẫu TRƯỚC", tab: "expand", highlight: [1, 2, 3, 4, 5], on: ["type", "a1", "scan", "a2", "expanded"],
      desc: "Mấu chốt: <strong>shell</strong> quét thư mục, thay <code>*.tmp</code> bằng danh sách tên thật, <em>rồi mới</em> chạy lệnh. Đây là globbing — xảy ra trước khi lệnh nhận được gì." },
    { title: "6 · Lệnh chỉ thấy tên thật", tab: "expand", highlight: [5, 6, 7, 8], on: ["expanded", "a3", "cmd"],
      desc: "<code>rm</code> không hề biết bạn gõ dấu <code>*</code> — nó chỉ nhận danh sách đã nở. Muốn giữ nghĩa đen dấu <code>*</code> (không nở), hãy bọc nháy: <code>\"*\"</code>." }
  ],

  quiz: [
    { q: "Thành phần nào chịu trách nhiệm 'nở' mẫu <code>*.txt</code> thành danh sách tên file?", options: [
        "Lệnh được gọi (ví dụ rm, ls)",
        "Shell, làm việc đó TRƯỚC khi chạy lệnh",
        "Kernel, sau khi lệnh chạy xong",
        "Terminal khi hiển thị"
      ], correct: 1,
      explanation: "Globbing là việc của shell: nó thay mẫu bằng tên file thật rồi mới giao cho lệnh; lệnh không hề thấy dấu *." },
    { q: "Mẫu <code>anh?.png</code> khớp với tên nào?", options: [
        "anh12.png",
        "anh.png",
        "anh1.png",
        "anhABC.png"
      ], correct: 2,
      explanation: "Dấu ? khớp đúng MỘT ký tự, nên anh1.png khớp; anh.png thiếu ký tự, còn anh12.png/anhABC.png thừa ký tự." },
    { q: "Mẫu <code>file[a-c].log</code> KHÔNG khớp với tên nào sau đây?", options: [
        "filea.log",
        "fileb.log",
        "filed.log",
        "filec.log"
      ], correct: 2,
      explanation: "[a-c] chỉ khớp một ký tự trong dải a, b, c. Chữ d nằm ngoài dải nên filed.log không khớp." },
    { q: "Muốn <code>echo</code> in ra đúng ký tự <code>*</code> chứ không để shell nở nó, bạn làm gì?", options: [
        "Bọc trong nháy: echo \"*\"",
        "Viết hoa: echo *STAR",
        "Thêm cờ: echo -g *",
        "Không thể được, shell luôn nở *"
      ], correct: 0,
      explanation: "Bọc trong nháy (hoặc thoát bằng backslash) khiến shell không xem * là wildcard, giữ nguyên nghĩa đen." }
  ]
});
