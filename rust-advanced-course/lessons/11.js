window.LESSONS.push({
  id: "11",
  phase: "2", phaseName: "Concurrency",
  title: "Atomics & memory ordering ở mức đủ dùng",
  subtitle: "AtomicU64/AtomicBool · fetch_add, compare_exchange · Relaxed cho counter · Acquire/Release để 'công bố' dữ liệu · SeqCst khi phân vân",

  theory: `
    <p>Atomic là kiểu mà thao tác đọc-sửa-ghi được CPU thực hiện không thể chia cắt, không cần lock. Bạn dùng chúng cho counter, cờ, ID tăng dần — và gián tiếp mỗi khi clone <code>Arc</code>
    (refcount là atomic). Giống <code>java.util.concurrent.atomic</code>, nhưng Rust bắt bạn chọn <strong>Ordering</strong> tường minh.</p>

    <p><strong>1. API chính</strong> (<code>std::sync::atomic</code>)</p>
    <ul>
      <li>Kiểu: <code>AtomicBool</code>, <code>AtomicUsize</code>, <code>AtomicU64</code>, <code>AtomicI64</code>, <code>AtomicPtr</code>... Tạo được trong <code>static</code> vì <code>new</code> là const fn.</li>
      <li><code>load</code>/<code>store</code>, <code>fetch_add</code>/<code>fetch_sub</code> (trả giá trị <em>cũ</em>), <code>swap</code>, <code>compare_exchange(current, new, success, failure)</code>, <code>fetch_update(...)</code> (vòng CAS có sẵn).</li>
      <li>Method nhận <code>&amp;self</code> → chia sẻ bằng <code>&amp;</code>/<code>Arc</code> là đủ, không cần Mutex. Đây là <em>interior mutability</em> an toàn đa luồng.</li>
    </ul>

    <p><strong>2. Ordering — hiểu thực dụng</strong></p>
    <p>CPU và compiler được phép sắp xếp lại lệnh đọc/ghi bộ nhớ miễn là <em>thread hiện tại</em> không nhận ra. Ordering quy định thread khác được đảm bảo thấy gì.</p>
    <table>
      <tr><th>Ordering</th><th>Đảm bảo</th><th>Dùng cho</th></tr>
      <tr><td><code>Relaxed</code></td><td>Chỉ chính thao tác này là nguyên tử; không ràng buộc thứ tự với bộ nhớ khác</td><td>Counter thống kê, ID generator, metrics</td></tr>
      <tr><td><code>Release</code> (ghi) + <code>Acquire</code> (đọc)</td><td>Mọi ghi <em>trước</em> store-Release được thấy bởi thread đã load-Acquire và thấy giá trị đó</td><td>Cờ "dữ liệu đã sẵn sàng", công bố con trỏ, tự viết lock</td></tr>
      <tr><td><code>AcqRel</code></td><td>Cả hai, cho thao tác đọc-sửa-ghi</td><td><code>fetch_sub</code> refcount khi có thể giải phóng</td></tr>
      <tr><td><code>SeqCst</code></td><td>Như AcqRel + một thứ tự toàn cục duy nhất cho mọi thao tác SeqCst</td><td>Khi phân vân; nhiều cờ tương tác nhau</td></tr>
    </table>
    <p>Liên hệ Java: <code>volatile</code> và các method mặc định của <code>AtomicLong</code> ≈ SeqCst; <code>lazySet</code>/<code>setRelease</code> ≈ Release; <code>getPlain</code>/<code>getOpaque</code> gần Relaxed.</p>

    <p><strong>3. Khi nào KHÔNG dùng atomic</strong></p>
    <ul>
      <li>Nhiều giá trị phải thay đổi cùng nhau (số dư + lịch sử) → Mutex. Hai atomic riêng lẻ không tạo thành một giao dịch.</li>
      <li>Counter bị cập nhật cực nhiều từ mọi core → tranh chấp cache line (false sharing). Giải pháp: counter theo shard/thread rồi cộng lại — thư viện <code>metrics</code>/Prometheus client đã làm.</li>
      <li>Tự viết cấu trúc lock-free: gần như không bao giờ cần ở service; dùng <code>crossbeam</code>, <code>ArcSwap</code>, <code>DashMap</code>.</li>
    </ul>
    <div class="callout"><p>💡 Quy tắc thực dụng: counter/ID/metrics → <code>Relaxed</code>. Cờ báo "dữ liệu kia đã ghi xong" → store <code>Release</code> + load <code>Acquire</code>. Không chắc → <code>SeqCst</code>
    (chậm hơn không đáng kể trên x86). Đừng dùng Relaxed cho cờ bảo vệ dữ liệu khác — trên ARM (Graviton, Apple Silicon) lỗi sẽ lộ ra.</p></div>
  `,

  codeTabs: [
    { id: "counter", label: "① Counter & ID", lines: [
      "use std::sync::atomic::{AtomicU64, Ordering};",
      "",
      "static REQUESTS: AtomicU64 = AtomicU64::new(0);    // const fn -> static được",
      "static NEXT_ID: AtomicU64 = AtomicU64::new(1);",
      "",
      "async fn handler() -> String {",
      "    REQUESTS.fetch_add(1, Ordering::Relaxed);      // chỉ cần không mất lượt đếm",
      "    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);   // trả giá trị CŨ -> duy nhất",
      "    format!(\"req-{id}\")",
      "}",
      "",
      "fn stats() -> u64 { REQUESTS.load(Ordering::Relaxed) }"
    ]},
    { id: "flag", label: "② Release/Acquire", lines: [
      "static mut DATA: u64 = 0;                    // minh hoạ; thực tế dùng OnceLock",
      "static READY: AtomicBool = AtomicBool::new(false);",
      "",
      "// Thread A: chuẩn bị rồi công bố",
      "unsafe { DATA = 42; }                        // (1) ghi dữ liệu",
      "READY.store(true, Ordering::Release);        // (2) mọi ghi trước đó 'đi kèm' cờ",
      "",
      "// Thread B:",
      "if READY.load(Ordering::Acquire) {           // (3) thấy true...",
      "    assert_eq!(unsafe { DATA }, 42);         // (4) ...thì chắc chắn thấy 42",
      "}",
      "// Dùng Relaxed ở (2)/(3): B có thể thấy READY=true nhưng DATA=0 (trên ARM)"
    ]},
    { id: "cas", label: "③ compare_exchange", lines: [
      "// Giới hạn tối đa 100 kết nối, không dùng lock",
      "static CONNS: AtomicUsize = AtomicUsize::new(0);",
      "",
      "fn try_acquire() -> bool {",
      "    CONNS.fetch_update(Ordering::AcqRel, Ordering::Acquire, |n| {",
      "        if n < 100 { Some(n + 1) } else { None }   // None -> thất bại, không ghi",
      "    }).is_ok()",
      "}",
      "fn release() { CONNS.fetch_sub(1, Ordering::Release); }",
      "",
      "// Thực tế: tokio::sync::Semaphore làm việc này + có hàng đợi chờ"
    ]},
    { id: "stop", label: "④ Cờ dừng", lines: [
      "let running = Arc::new(AtomicBool::new(true));",
      "",
      "let r = running.clone();",
      "let worker = std::thread::spawn(move || {",
      "    while r.load(Ordering::Acquire) {",
      "        process_batch();",
      "    }",
      "});",
      "",
      "running.store(false, Ordering::Release);",
      "worker.join().unwrap();",
      "// Trong async: ưu tiên CancellationToken / watch (có thông báo, không phải poll)"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "private static final AtomicLong REQUESTS = new AtomicLong();",
      "REQUESTS.incrementAndGet();          // ~ fetch_add(1, SeqCst) + 1",
      "",
      "private volatile boolean ready;      // ~ load/store SeqCst",
      "",
      "LongAdder hits = new LongAdder();    // counter phân shard chống tranh chấp",
      "",
      "// Rust: fetch_add trả giá trị CŨ; incrementAndGet trả giá trị MỚI"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ta"><div class="nl">🧵 Thread A</div><div class="ns">(1) ghi DATA · (2) store Release</div></div>
      <div class="node" id="tb"><div class="nl">🧵 Thread B</div><div class="ns">(3) load Acquire · (4) đọc DATA</div></div>
    </div>
    <div class="arrow" id="a1">↓ Release → Acquire tạo quan hệ happens-before</div>
    <div class="node" id="hb"><div class="nl">✅ B thấy DATA = 42</div><div class="ns">mọi ghi trước (2) hiện ra sau (3)</div></div>
    <div class="arrow" id="a2">↓ nếu chỉ Relaxed</div>
    <div class="node" id="rx"><div class="nl">⚠️ Có thể thấy READY=true, DATA=0</div><div class="ns">CPU/compiler sắp xếp lại</div></div>
    <div class="node" id="ct"><div class="nl">🔢 Counter/ID</div><div class="ns">Relaxed là đủ</div></div>
  `,
  steps: [
    { title: "1 · Counter & ID với Relaxed", tab: "counter", highlight: [3, 4, 7, 8], on: ["ct"],
      desc: "Không cần đồng bộ với dữ liệu khác, chỉ cần không mất lượt. <code>fetch_add</code> trả giá trị cũ → mỗi request một ID riêng." },
    { title: "2 · Công bố dữ liệu", tab: "flag", highlight: [5, 6], on: ["ta"],
      desc: "Ghi dữ liệu trước, rồi store cờ với Release: mọi ghi phía trên được 'gắn' vào lần store này." },
    { title: "3 · Nhận dữ liệu", tab: "flag", highlight: [9, 10], on: ["tb", "a1", "hb"],
      desc: "Load Acquire thấy true → chắc chắn thấy mọi ghi trước Release. Đây là happens-before." },
    { title: "4 · Relaxed sai chỗ", tab: "flag", highlight: [12], on: ["a2", "rx"],
      desc: "x86 thường che lỗi; ARM thì không. Bug chỉ xuất hiện khi deploy lên Graviton." },
    { title: "5 · CAS không lock", tab: "cas", highlight: [5, 6, 7, 11], on: ["ct"],
      desc: "<code>fetch_update</code> = vòng compare_exchange. Nhưng ở service, Semaphore đã làm sẵn và có hàng đợi." },
    { title: "6 · Đối chiếu Java", tab: "java", highlight: [2, 4, 6, 8], on: ["ct"],
      desc: "AtomicLong/volatile ≈ SeqCst. LongAdder chống tranh chấp. Chú ý fetch_add trả giá trị cũ." }
  ],

  quiz: [
    { q: "Counter đếm request cho metrics nên dùng Ordering nào?", options: [
        "SeqCst bắt buộc", "Relaxed", "Acquire", "Không cần atomic"
      ], correct: 1, explanation: "Chỉ cần nguyên tử, không cần đồng bộ với dữ liệu khác." },
    { q: "fetch_add(1, ..) trả về gì?", options: [
        "Giá trị mới", "Giá trị cũ trước khi cộng", "()", "bool"
      ], correct: 1, explanation: "Khác incrementAndGet của Java." },
    { q: "Thread A ghi DATA rồi store READY=true; thread B đọc READY rồi đọc DATA. Cặp Ordering tối thiểu đúng?", options: [
        "Relaxed/Relaxed",
        "store Release, load Acquire",
        "store Acquire, load Release",
        "Không cần gì"
      ], correct: 1, explanation: "Release-Acquire tạo happens-before." },
    { q: "Vì sao bug do dùng Relaxed sai thường chỉ lộ trên ARM?", options: [
        "ARM chậm hơn",
        "x86 có mô hình bộ nhớ mạnh (TSO) che nhiều lỗi sắp xếp lại; ARM yếu hơn",
        "ARM không hỗ trợ atomic",
        "Do compiler khác"
      ], correct: 1, explanation: "Graviton, Apple Silicon là ARM." },
    { q: "Cần cập nhật đồng thời số dư và lịch sử giao dịch. Dùng hai atomic riêng được không?", options: [
        "Được, atomic luôn an toàn",
        "Không — hai atomic không tạo thành một thao tác nguyên tử chung; dùng Mutex (hoặc transaction DB)",
        "Được nếu dùng SeqCst",
        "Được nếu dùng AcqRel"
      ], correct: 1, explanation: "Atomic chỉ nguyên tử cho từng biến." },
    { q: "Vì sao AtomicU64 có thể đặt trong static không cần lazy init?", options: [
        "Nhờ unsafe",
        "AtomicU64::new là const fn",
        "Vì static luôn lazy",
        "Không đặt được"
      ], correct: 1, explanation: "static REQUESTS: AtomicU64 = AtomicU64::new(0);" },
    { q: "Method của atomic nhận &self nghĩa là gì?", options: [
        "Không sửa được",
        "Sửa được qua tham chiếu chia sẻ (interior mutability) — Arc<AtomicBool> là đủ, không cần Mutex",
        "Phải có &mut",
        "Chỉ dùng trong một thread"
      ], correct: 1, explanation: "Atomic là dạng interior mutability an toàn đa luồng." },
    { q: "volatile boolean trong Java gần với Ordering nào của Rust?", options: [
        "Relaxed", "SeqCst", "Không có tương đương", "Consume"
      ], correct: 1, explanation: "Đọc/ghi volatile có ngữ nghĩa thứ tự toàn cục." },
    { q: "Counter được mọi core tăng liên tục làm chậm hệ thống. Nguyên nhân và cách chữa?", options: [
        "Thiếu SeqCst — đổi sang SeqCst",
        "Tranh chấp cache line; dùng counter phân shard (kiểu LongAdder) hoặc thư viện metrics",
        "Dùng Mutex",
        "Dùng Rc"
      ], correct: 1, explanation: "Mỗi fetch_add buộc cache line di chuyển giữa các core." }
  ]
});
