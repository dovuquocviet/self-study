window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "Sức mạnh dòng lệnh",
  title: "Pipe & redirection: | > < >>",
  subtitle: "stdout/stdin/stderr; nối lệnh thành dây chuyền; ghi ra file",

  theory: `
    <p>Đây là lúc dòng lệnh lộ ra sức mạnh thật sự. Mỗi chương trình có <strong>ba luồng chuẩn</strong>:</p>
    <ul>
      <li><strong>stdin</strong> (đầu vào chuẩn) — nơi chương trình <em>đọc</em> dữ liệu vào.</li>
      <li><strong>stdout</strong> (đầu ra chuẩn) — nơi in <em>kết quả</em> bình thường.</li>
      <li><strong>stderr</strong> (lỗi chuẩn) — nơi in <em>thông báo lỗi</em>, tách riêng khỏi kết quả.</li>
    </ul>
    <p>Bình thường stdin là bàn phím, stdout và stderr là màn hình. Nhưng ta có thể <em>đổi hướng</em>
    chúng — đó là <strong>redirection</strong>:</p>
    <ul>
      <li><code>lệnh &gt; file</code> — ghi stdout vào file, <strong>đè</strong> nội dung cũ.</li>
      <li><code>lệnh &gt;&gt; file</code> — ghi <strong>nối tiếp</strong> vào cuối file (không xoá cũ).</li>
      <li><code>lệnh &lt; file</code> — lấy file làm stdin (đọc từ file thay vì bàn phím).</li>
    </ul>
    <p>Và ngôi sao sáng nhất — <strong>pipe</strong> <code>|</code>: nối stdout của lệnh trái vào stdin của
    lệnh phải. Hãy hình dung một <em>dây chuyền lắp ráp</em>: sản phẩm ra khỏi máy này liền chạy thẳng vào
    máy kế tiếp để gia công thêm. Nhờ pipe, nhiều lệnh nhỏ ghép lại giải được bài toán lớn.</p>
    <div class="callout"><p>💡 Triết lý Unix: mỗi công cụ làm <em>một việc thật giỏi</em>, rồi ghép lại
    bằng pipe. Ví dụ <code>cat nhatky.txt | grep "loi" | wc -l</code> = đọc file → lọc dòng chứa "loi" →
    đếm số dòng. Ba việc nhỏ, một câu trả lời.</p></div>
  `,

  codeTabs: [
    { id: "redir", label: "📝 Ghi ra file (> >>)", lines: [
      "# > ghi mới, ĐÈ nội dung cũ",
      "$ echo \"dong 1\" > log.txt",
      "$ cat log.txt",
      "dong 1",
      "# >> ghi NỐI vào cuối, giữ nội dung cũ",
      "$ echo \"dong 2\" >> log.txt",
      "$ cat log.txt",
      "dong 1",
      "dong 2"
    ]},
    { id: "pipe", label: "🔗 Pipe dây chuyền", lines: [
      "# Không pipe: in cả danh sách dài",
      "$ ls /usr/bin",
      "awk  bash  cat  grep  ls  ... (hàng trăm dòng)",
      "# Có pipe: đưa kết quả ls sang grep để lọc",
      "$ ls /usr/bin | grep zip",
      "gzip",
      "unzip",
      "# rồi đếm bằng cách nối thêm một máy nữa",
      "$ ls /usr/bin | grep zip | wc -l",
      "2"
    ]},
    { id: "stdin", label: "📥 stdin & stderr", lines: [
      "# < lấy file làm đầu vào cho lệnh",
      "$ sort < ten.txt",
      "An",
      "Binh",
      "Cuong",
      "# 2> tách riêng luồng lỗi vào file khác",
      "$ ls thu_muc_khong_ton_tai 2> loi.txt",
      "$ cat loi.txt",
      "ls: thu_muc_khong_ton_tai: No such file"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📤 ls /usr/bin</div><div class="ns">sinh ra stdout: hàng trăm tên file</div></div>
    <div class="arrow" id="a1">↓ | pipe: stdout → stdin lệnh sau</div>
    <div class="node" id="grep"><div class="nl">🔍 grep zip</div><div class="ns">nhận qua stdin, lọc dòng chứa 'zip'</div></div>
    <div class="arrow" id="a2">↓ | pipe: nối thêm một máy nữa</div>
    <div class="node" id="wc"><div class="nl">🔢 wc -l</div><div class="ns">đếm số dòng còn lại</div></div>
    <div class="arrow" id="a3">↓ chọn đích cho stdout</div>
    <div class="row">
      <div class="node" id="screen"><div class="nl">🖥️ màn hình</div><div class="ns">mặc định in ra đây</div></div>
      <div class="node" id="file"><div class="nl">📄 &gt; ket_qua.txt</div><div class="ns">đổi hướng, ghi vào file</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Ghi stdout vào file với >", tab: "redir", highlight: [1, 2, 3, 4], on: ["src", "a3", "file"],
      desc: "Thay vì in ra màn hình, <code>&gt;</code> đổi hướng <strong>stdout</strong> vào file. Lưu ý <code>&gt;</code> <em>đè</em> nội dung cũ — file chỉ còn dòng mới." },
    { title: "2 · Nối tiếp với >>", tab: "redir", highlight: [5, 6, 7, 8, 9], on: ["file"],
      desc: "<code>&gt;&gt;</code> ghi <strong>nối vào cuối</strong> file, giữ nguyên nội dung cũ. Rất hợp để bồi thêm dòng vào một file log qua nhiều lần." },
    { title: "3 · Pipe: nối hai lệnh", tab: "pipe", highlight: [1, 2, 3, 4, 5, 6, 7], on: ["src", "a1", "grep"],
      desc: "<code>|</code> lấy <strong>stdout</strong> của <code>ls</code> làm <strong>stdin</strong> cho <code>grep</code>. Danh sách dài chảy qua bộ lọc, chỉ còn dòng chứa 'zip'." },
    { title: "4 · Kéo dài dây chuyền", tab: "pipe", highlight: [8, 9, 10], on: ["grep", "a2", "wc"],
      desc: "Nối thêm <code>| wc -l</code> để <strong>đếm</strong> số dòng. Ba lệnh nhỏ (liệt kê → lọc → đếm) ghép thành một câu trả lời — đúng tinh thần dây chuyền lắp ráp." },
    { title: "5 · Đọc từ file với <", tab: "stdin", highlight: [1, 2, 3, 4, 5], on: ["screen"],
      desc: "<code>&lt;</code> đổi <strong>stdin</strong>: <code>sort &lt; ten.txt</code> cho <code>sort</code> đọc từ file thay vì bàn phím, rồi in danh sách đã sắp xếp ra màn hình." },
    { title: "6 · Tách luồng lỗi stderr", tab: "stdin", highlight: [6, 7, 8, 9], on: ["screen", "file"],
      desc: "Lỗi đi theo luồng riêng <strong>stderr</strong>. <code>2&gt; loi.txt</code> hứng riêng thông báo lỗi vào file, để kết quả bình thường không lẫn lộn với lỗi." }
  ],

  quiz: [
    { q: "Toán tử pipe <code>|</code> làm gì?", options: [
        "Ghi kết quả vào một file",
        "Nối stdout của lệnh bên trái vào stdin của lệnh bên phải",
        "Chạy hai lệnh song song không liên quan",
        "Xoá đầu ra của lệnh trước"
      ], correct: 1,
      explanation: "Pipe chuyển đầu ra chuẩn của lệnh trái thành đầu vào chuẩn của lệnh phải — như dây chuyền lắp ráp." },
    { q: "Khác biệt giữa <code>&gt;</code> và <code>&gt;&gt;</code> khi ghi ra file là gì?", options: [
        "> đọc file, >> ghi file",
        "Không có khác biệt",
        "> đè (xoá nội dung cũ), còn >> ghi nối vào cuối (giữ nội dung cũ)",
        ">> nhanh hơn >"
      ], correct: 2,
      explanation: "Một dấu > ghi đè toàn bộ; hai dấu >> nối thêm vào cuối file mà không xoá nội dung có sẵn." },
    { q: "Vì sao stderr được tách riêng khỏi stdout?", options: [
        "Để thông báo lỗi không lẫn vào kết quả bình thường, có thể xử lý/lưu riêng",
        "Vì stderr chạy nhanh hơn",
        "Vì stdout không hiển thị được chữ",
        "Để mã hoá lỗi cho an toàn"
      ], correct: 0,
      explanation: "Tách luồng lỗi giúp bạn lọc/ghi riêng lỗi (ví dụ 2> loi.txt) mà không làm bẩn kết quả chính." },
    { q: "Lệnh <code>cat nhatky.txt | grep loi | wc -l</code> trả về điều gì?", options: [
        "Toàn bộ nội dung file nhatky.txt",
        "Số dòng trong file có chứa chữ 'loi'",
        "Dòng đầu tiên chứa chữ 'loi'",
        "Danh sách file trong thư mục"
      ], correct: 1,
      explanation: "Đọc file → lọc các dòng chứa 'loi' → đếm số dòng: kết quả là số dòng có chữ 'loi'." }
  ]
});
