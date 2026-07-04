window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Sức mạnh dòng lệnh",
  title: "Tìm kiếm: grep & find",
  subtitle: "grep lọc theo NỘI DUNG dòng; find duyệt cây theo TÊN/thuộc tính",

  theory: `
    <p>Hai câu hỏi khác nhau, hai công cụ khác nhau — người mới hay lẫn lộn:</p>
    <ul>
      <li><em>"Dòng nào <strong>chứa</strong> chữ này?"</em> → dùng <strong>grep</strong> (lọc theo
      <strong>nội dung</strong> bên trong file).</li>
      <li><em>"File nào <strong>tên</strong> thế này / nằm ở đâu?"</em> → dùng <strong>find</strong>
      (duyệt <strong>cây thư mục</strong> theo tên, loại, ngày, kích thước).</li>
    </ul>
    <p><strong>grep MẪU file</strong> quét từng dòng và in ra dòng nào khớp mẫu. Các cờ hay dùng:</p>
    <ul>
      <li><code>-i</code> — bỏ qua hoa/thường.</li>
      <li><code>-n</code> — kèm số dòng.</li>
      <li><code>-r</code> — quét đệ quy mọi file trong cả cây thư mục.</li>
      <li><code>-v</code> — <em>đảo ngược</em>: in dòng KHÔNG khớp.</li>
    </ul>
    <p><strong>find ĐƯỜNG_DẪN điều_kiện</strong> đi vào từng ngóc ngách của cây, lọc theo:
    <code>-name "*.log"</code> (theo tên), <code>-type f</code> (chỉ file) hay <code>-type d</code> (chỉ
    thư mục), <code>-mtime -7</code> (sửa trong 7 ngày qua)…</p>
    <p>Cả hai đều đẹp nhất khi <strong>kết hợp với pipe</strong>. grep thường đứng cuối một dây chuyền để
    lọc kết quả của lệnh khác; find có thể liệt kê file rồi đẩy sang lệnh sau xử lý.</p>
    <div class="callout"><p>💡 Nhớ nhanh: <strong>grep nhìn BÊN TRONG file</strong> (nội dung từng dòng),
    <strong>find nhìn BẢN THÂN file</strong> (tên, vị trí, thuộc tính). Hỏi "chứa gì" → grep; hỏi "ở đâu,
    tên gì" → find.</p></div>
  `,

  codeTabs: [
    { id: "grep", label: "🔍 grep — lọc nội dung", lines: [
      "# In các dòng chứa 'ERROR' trong file",
      "$ grep ERROR app.log",
      "12:03 ERROR ket noi that bai",
      "12:07 ERROR het bo nho",
      "# -i bỏ qua hoa/thường, -n kèm số dòng",
      "$ grep -in error app.log",
      "45:12:03 ERROR ket noi that bai",
      "# -r quét cả cây; -v in dòng KHÔNG khớp",
      "$ grep -r TODO src/"
    ]},
    { id: "find", label: "🗂️ find — duyệt cây", lines: [
      "# Mọi file .log dưới thư mục hiện tại (.)",
      "$ find . -name \"*.log\"",
      "./app.log",
      "./logs/2026-07.log",
      "# Chỉ thư mục (-type d)",
      "$ find . -type d -name \"cache\"",
      "./build/cache",
      "# File sửa trong 7 ngày qua",
      "$ find . -type f -mtime -7"
    ]},
    { id: "combo", label: "🔗 Kết hợp pipe", lines: [
      "# grep cuối dây chuyền: lọc tiến trình",
      "$ ps aux | grep node",
      "an  918  node server.js",
      "# đếm file .js bằng find + pipe",
      "$ find . -name \"*.js\" | wc -l",
      "42",
      "# grep -v loại bỏ dòng nhiễu",
      "$ ls -l | grep -v \"^d\"    # bỏ thư mục"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Bạn muốn tìm gì?</div><div class="ns">nội dung bên trong, hay bản thân file?</div></div>
    <div class="arrow" id="a1">↓ chọn công cụ theo câu hỏi</div>
    <div class="row">
      <div class="node" id="grep"><div class="nl">🔍 grep 'chứa gì'</div><div class="ns">quét từng DÒNG trong file</div></div>
      <div class="node" id="find"><div class="nl">🗂️ find 'ở đâu/tên gì'</div><div class="ns">duyệt CÂY thư mục theo thuộc tính</div></div>
    </div>
    <div class="arrow" id="a2">↓ mỗi công cụ in ra dòng/đường dẫn khớp</div>
    <div class="node" id="result"><div class="nl">📋 Kết quả lọc</div><div class="ns">dòng khớp mẫu / danh sách file</div></div>
    <div class="arrow" id="a3">↓ nối pipe để xử lý tiếp</div>
    <div class="node" id="pipe"><div class="nl">🔗 | wc -l, | sort ...</div><div class="ns">đếm, sắp xếp, hoặc lọc thêm lần nữa</div></div>
  `,
  steps: [
    { title: "1 · Hỏi đúng câu hỏi", tab: "grep", highlight: [1, 2, 3, 4], on: ["q", "a1", "grep"],
      desc: "Trước khi gõ, hỏi: mình cần <em>nội dung bên trong</em> hay <em>bản thân file</em>? 'Dòng nào chứa ERROR' là câu hỏi về nội dung → dùng <strong>grep</strong>." },
    { title: "2 · Tinh chỉnh grep bằng cờ", tab: "grep", highlight: [5, 6, 7, 8, 9], on: ["grep", "a2", "result"],
      desc: "<code>-i</code> bỏ qua hoa/thường, <code>-n</code> kèm số dòng, <code>-r</code> quét cả cây, <code>-v</code> đảo ngược (in dòng không khớp). Ghép cờ để lọc chính xác điều bạn cần." },
    { title: "3 · find duyệt cây theo tên", tab: "find", highlight: [1, 2, 3, 4], on: ["q", "find"],
      desc: "'File .log nằm ở đâu' là câu hỏi về <em>vị trí/tên</em> → dùng <strong>find</strong>. <code>find . -name \"*.log\"</code> đi khắp cây từ thư mục hiện tại, in mọi đường dẫn khớp." },
    { title: "4 · Lọc find theo thuộc tính", tab: "find", highlight: [5, 6, 7, 8], on: ["find", "a2", "result"],
      desc: "find lọc theo nhiều tiêu chí: <code>-type d</code> (chỉ thư mục), <code>-type f</code> (chỉ file), <code>-mtime -7</code> (sửa trong 7 ngày). Ghép các điều kiện để khoanh vùng." },
    { title: "5 · grep cuối một dây chuyền", tab: "combo", highlight: [1, 2, 3], on: ["result", "a3", "pipe"],
      desc: "grep tỏa sáng khi lọc đầu ra của lệnh khác: <code>ps aux | grep node</code> lọc danh sách tiến trình, chỉ giữ dòng liên quan 'node'." },
    { title: "6 · find + pipe để đếm/xử lý", tab: "combo", highlight: [4, 5, 6, 7, 8], on: ["pipe"],
      desc: "<code>find . -name \"*.js\" | wc -l</code> đếm số file .js. Và <code>grep -v</code> loại dòng nhiễu. Cả hai công cụ ghép với pipe thành những câu trả lời mạnh mẽ." }
  ],

  quiz: [
    { q: "Bạn muốn tìm mọi DÒNG chứa chữ 'timeout' bên trong file server.log. Dùng công cụ nào?", options: [
        "find server.log -name timeout",
        "grep timeout server.log",
        "ls -l timeout",
        "cd timeout"
      ], correct: 1,
      explanation: "grep quét nội dung từng dòng của file và in ra dòng khớp — đúng cho câu hỏi 'dòng nào chứa gì'." },
    { q: "Bạn muốn tìm mọi FILE tên kết thúc bằng .log nằm rải rác trong cả cây thư mục. Dùng gì?", options: [
        "grep -r .log .",
        "cat *.log",
        "find . -name \"*.log\"",
        "ls .log"
      ], correct: 2,
      explanation: "find duyệt cây thư mục và lọc theo tên/thuộc tính; -name \"*.log\" khớp mọi file .log ở mọi cấp." },
    { q: "Cờ <code>-v</code> của grep có tác dụng gì?", options: [
        "In kèm số dòng",
        "Bỏ qua hoa/thường",
        "Quét đệ quy cả cây",
        "Đảo ngược: in các dòng KHÔNG khớp mẫu"
      ], correct: 3,
      explanation: "grep -v lọc ngược lại, giữ những dòng không chứa mẫu — hữu ích để loại bỏ dòng nhiễu." },
    { q: "Cách nhớ nhanh phân biệt grep và find là gì?", options: [
        "grep nhìn nội dung BÊN TRONG file; find nhìn TÊN/vị trí của bản thân file",
        "grep chỉ cho thư mục; find chỉ cho file",
        "grep chạy nhanh hơn nên luôn dùng grep",
        "Chúng giống hệt nhau, chọn cái nào cũng được"
      ], correct: 0,
      explanation: "Hỏi 'chứa gì' → grep (nội dung dòng); hỏi 'ở đâu, tên gì' → find (thuộc tính file trong cây)." }
  ]
});
