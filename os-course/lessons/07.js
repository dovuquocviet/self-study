window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Đồng bộ hoá",
  title: "Race condition & vùng tới hạn",
  subtitle: "Khi hai luồng cùng với một quả trứng",

  theory: `
    <p>Ở bài 04, hai luồng dùng chung biến <code>counter</code>. Điều gì xảy ra nếu cả hai cùng làm
    <code>counter++</code> đúng một lúc? Trực giác nói "counter tăng 2". Thực tế có thể chỉ tăng <strong>1</strong>
    — và đó là một <strong>race condition (điều kiện tranh chấp)</strong>.</p>
    <p>Lý do: <code>counter++</code> nhìn như một bước, nhưng CPU làm <em>ba bước</em>: (1) <strong>đọc</strong>
    giá trị từ RAM vào thanh ghi, (2) <strong>cộng 1</strong>, (3) <strong>ghi</strong> lại xuống RAM. Nếu hai
    luồng xen kẽ giữa chừng, chúng cùng đọc "5", cùng tính "6", cùng ghi "6" — mất một lần tăng.</p>
    <p>Hình dung <strong>hai người cùng sửa một bảng tính giấy</strong>: cả hai chép số dư "5" ra nháp, mỗi
    người cộng thêm phần của mình rồi ghi đè lại. Người ghi sau xoá mất công của người ghi trước.</p>
    <ul>
      <li><strong>Vùng tới hạn (critical section)</strong>: đoạn mã <em>đụng tới dữ liệu dùng chung</em>. Ví
          dụ chính là ba bước đọc–cộng–ghi ở trên.</li>
      <li><strong>Loại trừ lẫn nhau (mutual exclusion)</strong>: quy tắc "tại một thời điểm, <em>chỉ một</em>
          luồng được ở trong vùng tới hạn". Nếu bảo đảm được điều này, race condition biến mất.</li>
    </ul>
    <div class="callout"><p>💡 Race condition <em>không xảy ra mỗi lần</em> — nó phụ thuộc thời điểm xen kẽ,
    nên có thể chạy đúng cả nghìn lần rồi thỉnh thoảng sai. Đó là loại lỗi khó chịu nhất: khó tái hiện, khó
    gỡ. Bài 08 sẽ giới thiệu công cụ chặn nó: mutex và semaphore.</p></div>
  `,

  codeTabs: [
    { id: "race", label: "💥 Tranh chấp", lines: [
      "// counter đang = 5. Hai luồng cùng chạy counter++",
      "// CPU tách counter++ thành 3 bước nhỏ:",
      "//   R = đọc counter ;  R = R + 1 ;  counter = R",
      "",
      "Luồng A: đọc 5",
      "Luồng B: đọc 5        // xen vào TRƯỚC khi A ghi",
      "Luồng A: 5+1 = 6, ghi counter = 6",
      "Luồng B: 5+1 = 6, ghi counter = 6   // đè lên!",
      "// Kết quả = 6, đáng lẽ phải là 7 → MẤT 1 lần tăng"
    ]},
    { id: "cs", label: "🚧 Vùng tới hạn", lines: [
      "// Vùng tới hạn = đoạn đụng dữ liệu dùng chung",
      "void deposit(int n) {",
      "    // --- BẮT ĐẦU vùng tới hạn ---",
      "    int tmp = balance;   // đọc",
      "    tmp = tmp + n;       // tính",
      "    balance = tmp;       // ghi",
      "    // --- KẾT THÚC vùng tới hạn ---",
      "}",
      "// Quy tắc: mỗi lúc chỉ MỘT luồng được vào đoạn này"
    ]}
  ],

  stageHtml: `
    <div class="node" id="shared"><div class="nl">🧊 counter = 5 (dùng chung)</div><div class="ns">nằm trong RAM, cả hai luồng thấy</div></div>
    <div class="arrow" id="a1">↓ cả hai cùng muốn +1</div>
    <div class="row" id="threads">
      <div class="node" id="ta"><div class="nl">🧵 Luồng A</div><div class="ns">đọc 5 → tính 6</div></div>
      <div class="node" id="tb"><div class="nl">🧵 Luồng B</div><div class="ns">đọc 5 → tính 6 (xen vào)</div></div>
    </div>
    <div class="arrow" id="a2">↓ cả hai ghi đè, một lần tăng bị mất</div>
    <div class="node" id="bug"><div class="nl">💥 counter = 6</div><div class="ns">đáng lẽ 7 — race condition</div></div>
    <div class="arrow" id="a3">↓ cách chặn</div>
    <div class="node" id="fix"><div class="nl">🚧 Vùng tới hạn + loại trừ lẫn nhau</div><div class="ns">mỗi lúc chỉ 1 luồng được vào</div></div>
  `,
  steps: [
    { title: "1 · Biến dùng chung", tab: "race", highlight: [1], on: ["shared", "a1"],
      desc: "Hai luồng cùng thấy biến <code>counter</code> trong RAM (bài 04). Cả hai muốn làm <code>counter++</code> gần như cùng lúc." },
    { title: "2 · Một dòng, ba bước", tab: "race", highlight: [2, 3], on: ["shared", "ta", "tb"],
      desc: "<code>counter++</code> trông như một bước nhưng CPU tách thành <strong>đọc → cộng → ghi</strong>. Khoảng giữa ba bước này là nơi tranh chấp lọt vào." },
    { title: "3 · Xen kẽ tai hại", tab: "race", highlight: [5, 6, 7, 8], on: ["ta", "tb", "a2"],
      desc: "A đọc 5, B cũng đọc 5 trước khi A kịp ghi. Cả hai tính 6 và cùng ghi 6 — <strong>ghi đè</strong> lên nhau, mất một lần tăng." },
    { title: "4 · Kết quả sai", tab: "race", highlight: [9], on: ["a2", "bug"],
      desc: "<code>counter</code> thành 6 thay vì 7. Đây là <strong>race condition</strong>: kết quả phụ thuộc thứ tự xen kẽ, nên lúc đúng lúc sai — rất khó tái hiện." },
    { title: "5 · Vùng tới hạn", tab: "cs", highlight: [1, 4, 5, 6], on: ["bug", "a3", "fix"],
      desc: "Đoạn đọc–tính–ghi là <strong>vùng tới hạn</strong> — chỗ đụng dữ liệu chung. Đây là nơi cần bảo vệ." },
    { title: "6 · Loại trừ lẫn nhau", tab: "cs", highlight: [3, 7, 9], on: ["fix"],
      desc: "Quy tắc <strong>loại trừ lẫn nhau</strong>: mỗi lúc <em>chỉ một</em> luồng được ở trong vùng tới hạn. Bảo đảm được thì race condition biến mất — bài 08 cho công cụ thực thi." }
  ],

  quiz: [
    { q: "Race condition là gì?", options: [
        "Cuộc đua xem tiến trình nào chạy nhanh nhất",
        "Lỗi khi kết quả phụ thuộc vào thứ tự xen kẽ của nhiều luồng truy cập dữ liệu dùng chung",
        "Khi CPU chạy quá nóng",
        "Khi hai chương trình dùng cùng tên file"
      ], correct: 1,
      explanation: "Race condition xảy ra khi nhiều luồng đụng dữ liệu chung không kiểm soát, và kết quả cuối phụ thuộc vào thứ tự tình cờ." },
    { q: "Vì sao 'counter++' của hai luồng có thể chỉ làm counter tăng 1 thay vì 2?", options: [
        "Vì CPU làm tròn số",
        "Vì một luồng luôn thắng và huỷ luồng kia",
        "Vì counter++ gồm ba bước đọc–cộng–ghi; hai luồng xen kẽ cùng đọc giá trị cũ rồi ghi đè lên nhau",
        "Vì biến counter quá nhỏ để chứa 2"
      ], correct: 2,
      explanation: "Cả hai đọc cùng giá trị (ví dụ 5), cùng tính 6, cùng ghi 6 — một lần tăng bị mất." },
    { q: "Vùng tới hạn (critical section) là gì?", options: [
        "Đoạn mã truy cập dữ liệu dùng chung, cần được bảo vệ khỏi truy cập đồng thời",
        "Vùng RAM nhanh nhất của máy",
        "Phần kernel không được phép sửa",
        "Đoạn mã chạy chậm nhất trong chương trình"
      ], correct: 0,
      explanation: "Vùng tới hạn là đoạn đụng tới dữ liệu chung; nếu để nhiều luồng vào cùng lúc sẽ sinh race condition." },
    { q: "Nguyên tắc 'loại trừ lẫn nhau' (mutual exclusion) yêu cầu điều gì?", options: [
        "Mọi luồng phải chạy trên cùng một CPU",
        "Tại một thời điểm, chỉ một luồng được ở trong vùng tới hạn",
        "Các luồng không bao giờ được chia sẻ dữ liệu",
        "Luồng ưu tiên cao loại bỏ luồng ưu tiên thấp"
      ], correct: 1,
      explanation: "Bảo đảm mỗi lúc chỉ một luồng vào vùng tới hạn thì các thao tác đọc–tính–ghi không xen kẽ, race condition biến mất." }
  ]
});
