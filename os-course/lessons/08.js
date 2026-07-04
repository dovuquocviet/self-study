window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Đồng bộ hoá",
  title: "Mutex, semaphore & deadlock",
  subtitle: "Khoá cửa, đếm chỗ trống, và cái bẫy khoá chéo",

  theory: `
    <p>Bài 07 cho ta bài toán: phải bảo đảm mỗi lúc chỉ một luồng vào vùng tới hạn. Bài này cho <em>công cụ</em>.</p>
    <p><strong>Mutex (mutual exclusion lock)</strong> là một <em>ổ khoá</em> cho vùng tới hạn — như chìa khoá
    của một <strong>phòng vệ sinh đơn</strong>. Luồng muốn vào phải <code>lock()</code> (lấy khoá); ai tới sau
    thấy khoá đang giữ thì phải <em>chờ</em>. Xong việc, luồng <code>unlock()</code> (trả khoá) cho người kế.
    Mỗi lúc đúng một người bên trong.</p>
    <p><strong>Semaphore</strong> là một <em>bộ đếm chỗ trống</em> — như bãi đỗ xe có <strong>N chỗ</strong>.
    Mỗi lần xe vào, đếm giảm 1; hết chỗ (đếm = 0) thì xe phải chờ; xe ra thì đếm tăng 1. Semaphore với N=1
    hoạt động như mutex; với N&gt;1 nó cho phép <em>tối đa N</em> luồng cùng vào (ví dụ giới hạn số kết nối).</p>
    <p>Nhưng khoá dùng sai lại sinh ra <strong>deadlock (bế tắc)</strong>: các luồng chờ nhau vòng tròn, không
    ai nhả khoá, cả nhóm đứng im mãi. Kinh điển: A giữ khoá 1 chờ khoá 2; B giữ khoá 2 chờ khoá 1. Deadlock
    cần đủ <strong>4 điều kiện cùng lúc</strong>:</p>
    <ul>
      <li><strong>Loại trừ lẫn nhau</strong>: tài nguyên chỉ một luồng giữ được;</li>
      <li><strong>Giữ và chờ</strong>: đang giữ cái này, lại chờ cái khác;</li>
      <li><strong>Không tước đoạt</strong>: không ai giật khoá của luồng khác được;</li>
      <li><strong>Chờ vòng tròn</strong>: chuỗi luồng chờ nhau khép thành vòng.</li>
    </ul>
    <div class="callout"><p>💡 Phá <em>bất kỳ một</em> trong 4 điều kiện là hết deadlock. Mẹo phổ biến: buộc
    mọi luồng lấy khoá theo <strong>cùng một thứ tự</strong> (khoá 1 trước khoá 2) → không thể có chờ vòng tròn.</p></div>
  `,

  codeTabs: [
    { id: "mutex", label: "🔒 Mutex", lines: [
      "pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;",
      "",
      "void deposit(int n) {",
      "    pthread_mutex_lock(&m);    // lấy khoá — ai tới sau phải chờ",
      "    balance = balance + n;     // vùng tới hạn: an toàn",
      "    pthread_mutex_unlock(&m);  // trả khoá cho luồng kế",
      "}",
      "// Mỗi lúc chỉ MỘT luồng ở giữa lock và unlock"
    ]},
    { id: "sem", label: "🎫 Semaphore", lines: [
      "sem_t slots;",
      "sem_init(&slots, 0, 3);   // bãi đỗ có 3 chỗ trống",
      "",
      "sem_wait(&slots);         // xin 1 chỗ: đếm 3->2->1->0",
      "//   ... dùng tài nguyên (tối đa 3 luồng cùng lúc) ...",
      "sem_post(&slots);         // trả chỗ: đếm tăng lại",
      "# N=1 => hành xử như mutex; N>1 => cho tối đa N luồng"
    ]},
    { id: "dead", label: "☠️ Deadlock", lines: [
      "// A và B lấy 2 khoá theo THỨ TỰ NGƯỢC NHAU",
      "Luồng A: lock(1) ... rồi chờ lock(2)",
      "Luồng B: lock(2) ... rồi chờ lock(1)",
      "// A giữ 1 đợi 2; B giữ 2 đợi 1 -> chờ vòng tròn, đứng im",
      "",
      "// SỬA: mọi luồng LUÔN lấy khoá theo cùng thứ tự 1 -> 2",
      "Luồng A: lock(1), lock(2)   // không còn vòng tròn",
      "Luồng B: lock(1), lock(2)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cs"><div class="nl">🚧 Vùng tới hạn</div><div class="ns">cần mỗi lúc chỉ 1 luồng (bài 07)</div></div>
    <div class="arrow" id="a1">↓ dùng khoá để thực thi</div>
    <div class="node" id="mutex"><div class="nl">🔒 Mutex</div><div class="ns">lock/unlock — như chìa khoá phòng đơn</div></div>
    <div class="arrow" id="a2">↓ cần cho tối đa N luồng?</div>
    <div class="node" id="sem"><div class="nl">🎫 Semaphore</div><div class="ns">bộ đếm N chỗ; N=1 ≈ mutex</div></div>
    <div class="arrow" id="a3">↓ dùng sai thứ tự khoá →</div>
    <div class="node" id="deadlock"><div class="nl">☠️ Deadlock</div><div class="ns">chờ nhau vòng tròn, cả nhóm đứng im</div></div>
    <div class="arrow" id="a4">↓ phá 1 trong 4 điều kiện</div>
    <div class="node" id="fix"><div class="nl">✅ Lấy khoá cùng thứ tự</div><div class="ns">không còn chờ vòng tròn</div></div>
  `,
  steps: [
    { title: "1 · Mutex khoá vùng tới hạn", tab: "mutex", highlight: [4, 5, 6], on: ["cs", "a1", "mutex"],
      desc: "<strong>Mutex</strong> là ổ khoá: <code>lock()</code> trước khi vào vùng tới hạn, <code>unlock()</code> khi ra. Ai tới lúc khoá đang giữ thì phải chờ — mỗi lúc đúng một luồng bên trong." },
    { title: "2 · Semaphore đếm chỗ trống", tab: "sem", highlight: [2, 4, 6], on: ["mutex", "a2", "sem"],
      desc: "<strong>Semaphore</strong> là bộ đếm N chỗ: <code>sem_wait</code> xin một chỗ (giảm đếm), <code>sem_post</code> trả chỗ. Hết chỗ thì chờ." },
    { title: "3 · N=1 thì như mutex", tab: "sem", highlight: [7], on: ["sem", "mutex"],
      desc: "Semaphore với <strong>N=1</strong> hành xử như mutex; với <strong>N&gt;1</strong> nó cho <em>tối đa N</em> luồng cùng vào — hữu ích để giới hạn số kết nối, số tải song song." },
    { title: "4 · Khoá sai → deadlock", tab: "dead", highlight: [1, 2, 3, 4], on: ["sem", "a3", "deadlock"],
      desc: "A giữ khoá 1 chờ khoá 2; B giữ khoá 2 chờ khoá 1. Không ai nhả, cả hai đứng im mãi — đó là <strong>deadlock</strong>, do <em>chờ vòng tròn</em>." },
    { title: "5 · Bốn điều kiện deadlock", tab: "dead", highlight: [2, 3, 4], on: ["deadlock"],
      desc: "Deadlock cần đủ 4: <strong>loại trừ lẫn nhau</strong>, <strong>giữ và chờ</strong>, <strong>không tước đoạt</strong>, <strong>chờ vòng tròn</strong>. Thiếu một là không xảy ra." },
    { title: "6 · Phá vòng bằng thứ tự khoá", tab: "dead", highlight: [6, 7, 8], on: ["a4", "fix"],
      desc: "Mẹo đơn giản: buộc mọi luồng lấy khoá theo <strong>cùng thứ tự</strong> (1 rồi 2). Không thể có chờ vòng tròn, nên deadlock bị loại bỏ." }
  ],

  quiz: [
    { q: "Một mutex hoạt động như thế nào?", options: [
        "Nó nhân đôi tài nguyên để không luồng nào phải chờ",
        "Nó là ổ khoá: luồng phải lock trước khi vào vùng tới hạn và unlock khi ra; luồng khác phải chờ",
        "Nó tăng ưu tiên của luồng đang chạy",
        "Nó xoá dữ liệu dùng chung để tránh tranh chấp"
      ], correct: 1,
      explanation: "Mutex bảo đảm loại trừ lẫn nhau: chỉ luồng giữ khoá mới vào được vùng tới hạn, phần còn lại chờ tới khi khoá được trả." },
    { q: "Semaphore khác mutex ở điểm nào?", options: [
        "Semaphore chỉ dùng trong kernel, mutex chỉ dùng ở user space",
        "Semaphore là bộ đếm cho phép tối đa N luồng vào cùng lúc; với N=1 nó tương đương mutex",
        "Semaphore không bao giờ bắt luồng phải chờ",
        "Mutex đếm chỗ trống, semaphore chỉ khoá/mở"
      ], correct: 1,
      explanation: "Semaphore đếm số 'chỗ' còn trống; N=1 hành xử như mutex, N>1 cho phép tối đa N luồng đồng thời." },
    { q: "Tình huống nào mô tả đúng một deadlock?", options: [
        "Một luồng chạy mãi không dừng và ngốn hết CPU",
        "Hai luồng cùng ghi một biến và ra kết quả sai",
        "A giữ khoá 1 và chờ khoá 2, trong khi B giữ khoá 2 và chờ khoá 1 — cả hai đứng im vô hạn",
        "Một luồng bị kernel huỷ giữa chừng"
      ], correct: 2,
      explanation: "Deadlock là chờ vòng tròn: mỗi luồng giữ tài nguyên bên kia cần và chờ tài nguyên đang bị bên kia giữ." },
    { q: "Một cách thực tế để tránh deadlock giữa nhiều khoá là gì?", options: [
        "Buộc mọi luồng lấy các khoá theo cùng một thứ tự cố định, để không thể có chờ vòng tròn",
        "Cho mỗi luồng vô số khoá dự phòng",
        "Tăng time slice thật lớn",
        "Không bao giờ dùng quá một luồng"
      ], correct: 0,
      explanation: "Phá điều kiện 'chờ vòng tròn' bằng cách áp một thứ tự khoá toàn cục — mọi luồng khoá 1 trước rồi mới 2, nên không thể khép vòng." }
  ]
});
