window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Scripting",
  title: "Điều kiện & vòng lặp: if, for, while, test",
  subtitle: "Ra quyết định với [ ] test; lặp với for và while",

  theory: `
    <p>Script mới chỉ chạy thẳng một mạch thì chưa "thông minh". Để nó biết <em>quyết định</em> và
    <em>lặp lại</em>, ta thêm điều kiện và vòng lặp.</p>
    <p><strong>Kiểm tra điều kiện</strong> dùng lệnh <code>test</code>, viết gọn bằng cặp ngoặc vuông
    <code>[ ... ]</code> (nhớ có khoảng trắng bên trong). Vài phép so sánh:</p>
    <ul>
      <li>Số: <code>-eq</code> (bằng), <code>-lt</code> (nhỏ hơn), <code>-gt</code> (lớn hơn).</li>
      <li>Chuỗi: <code>=</code> (bằng), <code>-z</code> (rỗng), <code>-n</code> (khác rỗng).</li>
      <li>File: <code>-f</code> (là file tồn tại), <code>-d</code> (là thư mục), <code>-e</code> (tồn tại).</li>
    </ul>
    <p><strong>if</strong> chạy khối lệnh khi điều kiện đúng. Cú pháp: <code>if</code> … <code>then</code> …
    <code>fi</code> (fi là if viết ngược — đánh dấu kết thúc). Có thể thêm <code>elif</code> và
    <code>else</code>.</p>
    <p>Hai kiểu <strong>vòng lặp</strong>:</p>
    <ul>
      <li><strong>for</strong>: lặp qua một <em>danh sách</em> đã biết — mỗi phần tử một vòng. Hợp khi
      biết trước sẽ duyệt qua những gì (mọi file .txt, các số 1..5…).</li>
      <li><strong>while</strong>: lặp <em>chừng nào điều kiện còn đúng</em> — không cần biết trước bao
      nhiêu vòng. Hợp khi lặp tới khi một điều kiện thay đổi.</li>
    </ul>
    <div class="callout"><p>💡 Cạm bẫy số một của người mới: <strong>khoảng trắng trong ngoặc vuông</strong>.
    Phải viết <code>[ $x -gt 3 ]</code> — có space sau <code>[</code> và trước <code>]</code>. Viết dính
    <code>[$x -gt 3]</code> sẽ báo lỗi vì <code>[</code> thực chất là một <em>lệnh</em>.</p></div>
  `,

  codeTabs: [
    { id: "iff", label: "🔀 if / test", lines: [
      "#!/bin/bash",
      "diem=7",
      "# [ ... ] là lệnh test; nhớ có space bên trong",
      "if [ $diem -ge 5 ]; then",
      "  echo \"Dat\"",
      "elif [ $diem -eq 4 ]; then",
      "  echo \"Sat nut\"",
      "else",
      "  echo \"Truot\"",
      "fi",
      "# in ra: Dat"
    ]},
    { id: "forl", label: "🔁 for", lines: [
      "#!/bin/bash",
      "# lặp qua danh sách đã biết",
      "for ten in An Binh Cuong; do",
      "  echo \"Chao $ten\"",
      "done",
      "# duyệt mọi file .txt trong thư mục",
      "for f in *.txt; do",
      "  echo \"Xu ly $f\"",
      "done"
    ]},
    { id: "whilel", label: "🔄 while", lines: [
      "#!/bin/bash",
      "# lặp chừng nào điều kiện còn đúng",
      "dem=1",
      "while [ $dem -le 3 ]; do",
      "  echo \"Lan $dem\"",
      "  dem=$((dem + 1))",
      "done",
      "# in: Lan 1 / Lan 2 / Lan 3 rồi dừng",
      "# quên tăng dem → lặp vô tận!"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cond"><div class="nl">🧪 [ $diem -ge 5 ]</div><div class="ns">lệnh test chấm điều kiện đúng/sai</div></div>
    <div class="arrow" id="a1">↓ if rẽ nhánh theo kết quả</div>
    <div class="row">
      <div class="node" id="tthen"><div class="nl">✅ đúng → then</div><div class="ns">chạy khối 'Dat'</div></div>
      <div class="node" id="telse"><div class="nl">❌ sai → else</div><div class="ns">chạy khối 'Truot'</div></div>
    </div>
    <div class="arrow" id="a2">↓ cần lặp? chọn kiểu vòng</div>
    <div class="row">
      <div class="node" id="forn"><div class="nl">🔁 for (danh sách)</div><div class="ns">biết trước duyệt qua gì</div></div>
      <div class="node" id="whilen"><div class="nl">🔄 while (điều kiện)</div><div class="ns">lặp tới khi điều kiện đổi</div></div>
    </div>
    <div class="arrow" id="a3">↓ mỗi vòng chạy khối thân</div>
    <div class="node" id="body"><div class="nl">⚙️ Thân vòng lặp</div><div class="ns">công việc lặp lại mỗi lần</div></div>
  `,
  steps: [
    { title: "1 · test chấm điều kiện", tab: "iff", highlight: [1, 2, 3, 4], on: ["cond"],
      desc: "<code>[ $diem -ge 5 ]</code> là cách viết gọn của lệnh <code>test</code>: nó trả về đúng/sai. Nhớ khoảng trắng bên trong ngoặc — nếu không sẽ lỗi." },
    { title: "2 · if rẽ nhánh", tab: "iff", highlight: [4, 5, 6, 7, 8, 9, 10], on: ["cond", "a1", "tthen", "telse"],
      desc: "<code>if ... then ... fi</code>: điều kiện đúng thì chạy khối <code>then</code>; <code>elif</code>/<code>else</code> lo các trường hợp còn lại. <code>fi</code> đóng khối." },
    { title: "3 · for duyệt danh sách", tab: "forl", highlight: [1, 2, 3, 4, 5], on: ["a2", "forn", "a3", "body"],
      desc: "<code>for ten in An Binh Cuong</code> chạy thân một lần cho mỗi phần tử, biến <code>ten</code> lần lượt nhận từng giá trị. Dùng khi biết trước sẽ duyệt qua gì." },
    { title: "4 · for + wildcard", tab: "forl", highlight: [6, 7, 8, 9], on: ["forn", "body"],
      desc: "Ghép với bài 07: <code>for f in *.txt</code> — shell nở mẫu thành danh sách file, vòng for xử lý từng file. Rất mạnh để thao tác hàng loạt." },
    { title: "5 · while lặp theo điều kiện", tab: "whilel", highlight: [1, 2, 3, 4, 5, 6, 7], on: ["a2", "whilen", "a3", "body"],
      desc: "<code>while [ ... ]</code> lặp <strong>chừng nào điều kiện còn đúng</strong>. Ở đây đếm từ 1 tới 3 rồi dừng. Dùng khi không biết trước số vòng." },
    { title: "6 · Coi chừng lặp vô tận", tab: "whilel", highlight: [6, 8, 9], on: ["body"],
      desc: "Thân while <strong>phải</strong> thay đổi điều gì đó để điều kiện cuối cùng thành sai (ở đây tăng <code>dem</code>). Quên bước này → vòng lặp chạy mãi không dừng." }
  ],

  quiz: [
    { q: "Vì sao <code>[$x -gt 3]</code> báo lỗi còn <code>[ $x -gt 3 ]</code> thì chạy?", options: [
        "Vì phải viết hoa TEST",
        "Vì [ thực chất là một lệnh nên cần khoảng trắng ngăn cách các thành phần bên trong",
        "Vì -gt chỉ dùng cho chuỗi",
        "Vì thiếu dấu chấm phẩy"
      ], correct: 1,
      explanation: "[ là tên một lệnh (đồng nghĩa test); nó cần khoảng trắng sau [ và trước ] để tách đối số, nếu không shell không nhận ra." },
    { q: "Từ khoá nào đánh dấu KẾT THÚC một khối <code>if</code>?", options: [
        "end",
        "endif",
        "fi",
        "done"
      ], correct: 2,
      explanation: "if đóng bằng fi (if đảo ngược); done là để đóng vòng lặp for/while." },
    { q: "Khi nào nên chọn <code>while</code> thay vì <code>for</code>?", options: [
        "Khi đã biết trước chính xác danh sách cần duyệt",
        "Khi muốn lặp chừng nào một điều kiện còn đúng, chưa biết trước số vòng",
        "while luôn nhanh hơn nên luôn dùng while",
        "Khi chỉ lặp đúng một lần"
      ], correct: 1,
      explanation: "for hợp với danh sách đã biết; while hợp khi lặp tới lúc điều kiện thay đổi mà không biết trước bao nhiêu vòng." },
    { q: "Điều gì gây ra vòng lặp <code>while</code> chạy vô tận?", options: [
        "Đặt điều kiện trong ngoặc vuông",
        "Dùng biến $dem",
        "Thân vòng không bao giờ làm điều kiện trở thành sai (ví dụ quên tăng biến đếm)",
        "Thêm lệnh echo trong thân"
      ], correct: 2,
      explanation: "while lặp tới khi điều kiện sai; nếu thân không thay đổi gì để điều kiện thành sai (quên tăng biến đếm), nó lặp mãi." }
  ]
});
