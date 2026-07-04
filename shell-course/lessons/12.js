window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Scripting",
  title: "Hàm, tham số & exit code",
  subtitle: "Đóng gói logic thành hàm; USD1 USD@; return/exit; kiểm tra USD?",

  theory: `
    <p>Khi script dài ra, ta gom những đoạn lặp lại thành <strong>hàm</strong> — một khối lệnh có tên, gọi
    lại nhiều lần. Giống như dạy trợ lý một "thói quen" rồi chỉ cần gọi tên là làm.</p>
    <p>Định nghĩa hàm: <code>ten_ham() { ...lệnh... }</code>. Gọi hàm y như gọi một lệnh: viết tên rồi kèm
    tham số. Bên trong hàm, tham số truy cập <em>giống hệt</em> script: USD1 là tham số thứ nhất, USD2
    thứ hai, còn <strong>USD@</strong> là <em>tất cả</em> tham số (để lặp qua chúng).</p>
    <p>Điều khiến shell khác biệt: mọi lệnh khi kết thúc đều trả về một <strong>exit code</strong> — con
    số 0..255 báo <em>thành bại</em>:</p>
    <ul>
      <li><strong>0 = thành công</strong> (mọi thứ ổn).</li>
      <li><strong>khác 0 = thất bại</strong> (mỗi số có thể mang một loại lỗi).</li>
    </ul>
    <p>Lưu ý ngược đời so với toán học: <em>0 là "đúng/ổn"</em>, khác 0 là lỗi. Trong hàm và script:</p>
    <ul>
      <li><code>return N</code> — kết thúc <em>hàm</em>, trả exit code N.</li>
      <li><code>exit N</code> — kết thúc <em>cả script</em> ngay lập tức, trả exit code N.</li>
    </ul>
    <p>Biến đặc biệt <strong>USD?</strong> giữ exit code của lệnh <em>vừa chạy xong</em>. Nhờ nó (và
    cấu trúc <code>if</code> ở bài 11) ta biết lệnh trước thành công hay không để xử lý tiếp.</p>
    <div class="callout"><p>💡 Thực ra <code>if lenh; then</code> hoạt động chính nhờ exit code: <code>if</code>
    coi exit code <strong>0</strong> là "đúng" và chạy nhánh then. Đây là nền tảng để nối lệnh an toàn:
    <code>tao_backup &amp;&amp; xoa_ban_goc</code> — chỉ xoá nếu backup (exit 0) thành công.</p></div>
  `,

  codeTabs: [
    { id: "func", label: "🧩 Định nghĩa & gọi hàm", lines: [
      "#!/bin/bash",
      "# định nghĩa hàm chao",
      "chao() {",
      "  echo \"Xin chao, $1!\"   # $1 = tham so cua HAM",
      "}",
      "# gọi hàm như một lệnh",
      "$ chao An",
      "Xin chao, An!",
      "$ chao Binh",
      "Xin chao, Binh!"
    ]},
    { id: "allargs", label: "📦 USD@ và return", lines: [
      "#!/bin/bash",
      "tong() {",
      "  local s=0",
      "  for n in $@; do        # $@ = tat ca tham so",
      "    s=$((s + n))",
      "  done",
      "  echo $s",
      "  return 0               # 0 = thanh cong",
      "}",
      "$ tong 3 5 2",
      "10"
    ]},
    { id: "exitcode", label: "🚦 exit code & USD?", lines: [
      "# Lệnh thành công → $? = 0",
      "$ ls /etc > /dev/null",
      "$ echo $?",
      "0",
      "# Lệnh thất bại → $? khác 0",
      "$ ls /khong_co 2> /dev/null",
      "$ echo $?",
      "1",
      "# nối an toàn: chỉ chạy vế sau nếu vế trước OK",
      "$ mkdir data && cd data"
    ]}
  ],

  stageHtml: `
    <div class="node" id="def"><div class="nl">🧩 chao() { ... }</div><div class="ns">định nghĩa hàm một lần</div></div>
    <div class="arrow" id="a1">↓ gọi tên kèm tham số</div>
    <div class="node" id="call"><div class="nl">📞 chao An</div><div class="ns">bên trong: $1=An, $@=mọi tham số</div></div>
    <div class="arrow" id="a2">↓ hàm/lệnh kết thúc, phát exit code</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ exit 0</div><div class="ns">thành công (return 0 / exit 0)</div></div>
      <div class="node" id="fail"><div class="nl">❌ exit ≠ 0</div><div class="ns">thất bại — mang loại lỗi</div></div>
    </div>
    <div class="arrow" id="a3">↓ $? giữ mã của lệnh vừa chạy</div>
    <div class="node" id="check"><div class="nl">🔎 kiểm tra $?</div><div class="ns">if / && quyết định bước tiếp theo</div></div>
  `,
  steps: [
    { title: "1 · Định nghĩa hàm", tab: "func", highlight: [1, 2, 3, 4, 5], on: ["def"],
      desc: "<code>chao() { ... }</code> gom các lệnh thành một khối có tên. Bên trong, <code>$1</code> là tham số của <em>hàm</em> (không phải của script) — mỗi lần gọi một giá trị khác." },
    { title: "2 · Gọi hàm như một lệnh", tab: "func", highlight: [6, 7, 8, 9, 10], on: ["def", "a1", "call"],
      desc: "Gọi hàm giống gọi lệnh thường: <code>chao An</code>, <code>chao Binh</code>. Viết logic một lần, tái sử dụng nhiều lần — script gọn và dễ bảo trì." },
    { title: "3 · USD@ gom mọi tham số", tab: "allargs", highlight: [1, 2, 3, 4, 5, 6, 7], on: ["call"],
      desc: "<code>$@</code> là <strong>toàn bộ</strong> tham số, thường dùng với <code>for</code> để duyệt qua từng cái. Ở đây hàm cộng dồn mọi số truyền vào." },
    { title: "4 · return kết thúc hàm", tab: "allargs", highlight: [8, 9, 10, 11], on: ["call", "a2", "ok"],
      desc: "<code>return 0</code> kết thúc <em>hàm</em> và trả exit code 0 (thành công). Khác với <code>exit</code> — <code>exit</code> đóng cả script chứ không chỉ hàm." },
    { title: "5 · exit code báo thành bại", tab: "exitcode", highlight: [1, 2, 3, 4, 5, 6, 7, 8], on: ["ok", "fail", "a3", "check"],
      desc: "Mỗi lệnh kết thúc trả một <strong>exit code</strong>: <code>0</code> = ổn, khác 0 = lỗi. <code>$?</code> giữ mã của lệnh <em>vừa chạy</em> — cách kiểm tra thành/bại." },
    { title: "6 · Nối lệnh an toàn với &&", tab: "exitcode", highlight: [9, 10], on: ["check"],
      desc: "<code>&amp;&amp;</code> chỉ chạy vế sau nếu vế trước trả exit 0. <code>mkdir data &amp;&amp; cd data</code> chỉ <code>cd</code> khi tạo thư mục thành công — nền tảng của script chắc chắn." }
  ],

  quiz: [
    { q: "Trong shell, exit code bằng bao nhiêu nghĩa là lệnh THÀNH CÔNG?", options: [
        "1",
        "0",
        "-1",
        "255"
      ], correct: 1,
      explanation: "Ngược với trực giác toán học: 0 nghĩa là thành công/ổn, còn bất kỳ số khác 0 nào cũng báo một loại lỗi." },
    { q: "Biến <code>$?</code> chứa gì?", options: [
        "Tên script đang chạy",
        "Số tham số truyền vào",
        "Exit code của lệnh vừa chạy xong",
        "Đường dẫn hiện tại"
      ], correct: 2,
      explanation: "$? giữ exit code của lệnh gần nhất, dùng để biết lệnh đó thành công (0) hay thất bại (khác 0)." },
    { q: "Khác biệt giữa <code>return</code> và <code>exit</code> trong một script là gì?", options: [
        "return kết thúc hàm hiện tại; exit kết thúc cả script ngay lập tức",
        "Chúng hoàn toàn giống nhau",
        "return chỉ dùng cho vòng lặp",
        "exit chỉ in ra màn hình"
      ], correct: 0,
      explanation: "return thoát khỏi hàm và trả exit code cho nó; exit chấm dứt toàn bộ script với exit code đã cho." },
    { q: "Trong <code>tao_backup &amp;&amp; xoa_ban_goc</code>, khi nào <code>xoa_ban_goc</code> chạy?", options: [
        "Luôn luôn chạy sau tao_backup",
        "Chỉ khi tao_backup thất bại",
        "Chỉ khi tao_backup thành công (trả exit code 0)",
        "Không bao giờ chạy"
      ], correct: 2,
      explanation: "Toán tử && chỉ chạy vế phải nếu vế trái trả exit code 0 (thành công) — nên chỉ xoá bản gốc khi backup thành công." }
  ]
});
