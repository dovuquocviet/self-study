window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Sức mạnh dòng lệnh",
  title: "Biến & môi trường: PATH, export",
  subtitle: "Biến shell vs biến môi trường; PATH tìm lệnh ở đâu; export",

  theory: `
    <p>Shell có thể <em>nhớ</em> giá trị bằng <strong>biến</strong>. Gán bằng dấu <code>=</code> (lưu ý:
    <strong>không có khoảng trắng</strong> quanh dấu bằng), đọc lại bằng cách đặt USD trước tên biến.</p>
    <p>Có hai loại biến, khác nhau ở phạm vi lan tỏa:</p>
    <ul>
      <li><strong>Biến shell</strong> (biến cục bộ): chỉ sống trong phiên shell hiện tại. Chương trình con
      mà bạn chạy <em>không</em> nhìn thấy nó.</li>
      <li><strong>Biến môi trường</strong>: được <code>export</code> để <em>truyền xuống</em> mọi chương
      trình con. Hãy hình dung: biến shell là ghi chú dán trên bàn bạn; biến môi trường là thông báo phát
      cho cả phòng — ai bước vào cũng nghe.</li>
    </ul>
    <p><code>export TEN=giatri</code> biến một biến thường thành biến môi trường. Xem tất cả bằng
    <code>env</code>; xem một biến bằng <code>echo</code> kèm USD trước tên.</p>
    <p>Biến môi trường quan trọng nhất là <strong>PATH</strong> — một danh sách thư mục, ngăn cách bằng
    dấu hai chấm. Khi bạn gõ <code>ls</code>, shell <em>không đoán</em>: nó lần lượt tìm file tên
    <code>ls</code> trong <em>từng</em> thư mục của PATH, từ trái sang phải, và chạy cái đầu tiên tìm thấy.
    Nếu không thư mục nào có, bạn nhận <code>command not found</code>.</p>
    <div class="callout"><p>💡 Đây chính là lý do bài trước phải gõ <code>./run.sh</code>: thư mục hiện tại
    thường KHÔNG nằm trong PATH, nên shell không tự tìm script của bạn ở đó. Muốn thêm một thư mục vào
    PATH: <code>export PATH="$HOME/bin:$PATH"</code> — đặt trước để được ưu tiên tìm.</p></div>
  `,

  codeTabs: [
    { id: "assign", label: "📝 Gán & đọc biến", lines: [
      "# Gán: KHÔNG có space quanh dấu =",
      "$ ten=An",
      "# Đọc: đặt $ trước tên biến",
      "$ echo $ten",
      "An",
      "$ echo \"Xin chao $ten\"",
      "Xin chao An",
      "# space quanh = sẽ báo lỗi:",
      "$ ten = An",
      "zsh: command not found: ten"
    ]},
    { id: "export", label: "📢 shell vs môi trường", lines: [
      "# Biến shell: con KHÔNG thấy",
      "$ mau=xanh",
      "$ bash -c 'echo [$mau]'",
      "[]",
      "# export → biến môi trường, con THẤY",
      "$ export mau=xanh",
      "$ bash -c 'echo [$mau]'",
      "[xanh]",
      "# xem mọi biến môi trường:  env"
    ]},
    { id: "path", label: "🛣️ PATH tìm lệnh", lines: [
      "# PATH là danh sách thư mục, ngăn bằng :",
      "$ echo $PATH",
      "/usr/local/bin:/usr/bin:/bin",
      "# shell tìm 'ls' lần lượt trong từng thư mục",
      "$ which ls",
      "/bin/ls",
      "# thêm thư mục riêng vào ĐẦU PATH (ưu tiên)",
      "$ export PATH=\"$HOME/bin:$PATH\"",
      "# giờ lệnh trong ~/bin gọi được không cần ./"
    ]}
  ],

  stageHtml: `
    <div class="node" id="type"><div class="nl">⌨️ Bạn gõ: ls</div><div class="ns">một tên lệnh trần, không đường dẫn</div></div>
    <div class="arrow" id="a1">↓ shell đọc biến môi trường PATH</div>
    <div class="node" id="path"><div class="nl">🛣️ PATH = /usr/local/bin:/usr/bin:/bin</div><div class="ns">danh sách thư mục, xét từ trái sang phải</div></div>
    <div class="arrow" id="a2">↓ dò từng thư mục tìm file tên 'ls'</div>
    <div class="row">
      <div class="node" id="d1"><div class="nl">📁 /usr/local/bin</div><div class="ns">không có ls → đi tiếp</div></div>
      <div class="node" id="d2"><div class="nl">📁 /usr/bin</div><div class="ns">không có → đi tiếp</div></div>
      <div class="node" id="d3"><div class="nl">📁 /bin ✅</div><div class="ns">tìm thấy /bin/ls!</div></div>
    </div>
    <div class="arrow" id="a3">↓ chạy cái đầu tiên tìm thấy</div>
    <div class="node" id="run"><div class="nl">▶️ Thực thi /bin/ls</div><div class="ns">không thấy đâu cả → command not found</div></div>
  `,
  steps: [
    { title: "1 · Gán & đọc biến", tab: "assign", highlight: [1, 2, 3, 4, 5], on: ["type"],
      desc: "Gán bằng <code>ten=An</code> (không space quanh dấu <code>=</code>), đọc bằng <code>$ten</code>. Shell thay <code>$ten</code> bằng giá trị trước khi chạy lệnh." },
    { title: "2 · Cạm bẫy khoảng trắng", tab: "assign", highlight: [6, 7, 8, 9, 10], on: ["type"],
      desc: "Đặt space quanh <code>=</code> sẽ hỏng: <code>ten = An</code> bị shell hiểu là chạy lệnh tên <code>ten</code>. Đây là lỗi kinh điển của người mới." },
    { title: "3 · Biến shell không lan xuống con", tab: "export", highlight: [1, 2, 3, 4], on: ["type"],
      desc: "Biến shell thường chỉ sống trong phiên hiện tại. Một chương trình con (ví dụ <code>bash -c ...</code>) <strong>không thấy</strong> nó — kết quả in ra rỗng." },
    { title: "4 · export tạo biến môi trường", tab: "export", highlight: [5, 6, 7, 8, 9], on: ["type"],
      desc: "<code>export mau=xanh</code> biến nó thành <strong>biến môi trường</strong> — được truyền xuống mọi tiến trình con. Giờ chương trình con đọc được giá trị." },
    { title: "5 · PATH quyết định tìm lệnh ở đâu", tab: "path", highlight: [1, 2, 3, 4, 5, 6], on: ["type", "a1", "path", "a2", "d1", "d2", "d3"],
      desc: "Khi gõ <code>ls</code>, shell đọc <strong>PATH</strong> rồi dò <em>lần lượt</em> từng thư mục từ trái sang phải, chạy file <code>ls</code> đầu tiên tìm được (<code>/bin/ls</code>)." },
    { title: "6 · Thêm thư mục vào PATH", tab: "path", highlight: [7, 8, 9], on: ["a3", "run"],
      desc: "Không thư mục nào trong PATH có lệnh → <code>command not found</code>. Thêm thư mục riêng vào <strong>đầu</strong> PATH để được ưu tiên và gọi lệnh không cần <code>./</code>." }
  ],

  quiz: [
    { q: "Cách gán biến ĐÚNG trong shell là gì?", options: [
        "ten = An",
        "ten=An",
        "let ten = An",
        "$ten = An"
      ], correct: 1,
      explanation: "Phải viết liền không khoảng trắng quanh dấu =. Có space (ten = An) sẽ bị hiểu là gọi lệnh tên 'ten'." },
    { q: "Khác biệt giữa biến shell thường và biến môi trường là gì?", options: [
        "Biến môi trường chạy nhanh hơn",
        "Biến shell chỉ chứa số, biến môi trường chỉ chứa chữ",
        "Biến môi trường (được export) truyền xuống các tiến trình con; biến shell thường thì không",
        "Không có khác biệt"
      ], correct: 2,
      explanation: "export biến nó thành biến môi trường, lan xuống mọi chương trình con; biến shell thường chỉ sống trong phiên hiện tại." },
    { q: "Khi bạn gõ <code>ls</code>, shell dùng gì để biết chạy file nào?", options: [
        "Nó dò lần lượt các thư mục liệt kê trong biến môi trường PATH",
        "Nó tìm khắp toàn bộ ổ đĩa",
        "Nó hỏi kernel đoán giúp",
        "Nó luôn chạy file trong thư mục hiện tại"
      ], correct: 0,
      explanation: "Shell duyệt từng thư mục trong PATH từ trái sang phải và chạy file khớp tên đầu tiên; không thấy thì báo command not found." },
    { q: "Vì sao script trong thư mục hiện tại thường phải gọi bằng <code>./run.sh</code>?", options: [
        "Vì ./ cấp quyền thực thi",
        "Vì thư mục hiện tại thường KHÔNG nằm trong PATH nên shell không tự tìm ở đó",
        "Vì run.sh là từ khoá dành riêng",
        "Vì shell không đọc được file .sh"
      ], correct: 1,
      explanation: "Shell chỉ dò các thư mục trong PATH; thư mục hiện tại thường không có trong đó, nên phải chỉ rõ ./ ." }
  ]
});
