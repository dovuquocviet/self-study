window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Concurrency",
  title: "Mutex & RwLock: std hay tokio? Giữ lock qua .await",
  subtitle: "std::sync::Mutex trong async là bình thường · khi nào cần tokio::sync::Mutex · RwLock & writer starvation · poisoning · DashMap, ArcSwap",

  theory: `
    <p>Nhập môn đã dạy <code>Arc&lt;Mutex&lt;T&gt;&gt;</code> với thread. Trong async có hai loại Mutex và lời khuyên của chính Tokio thường làm người mới ngạc nhiên:
    <strong>mặc định dùng <code>std::sync::Mutex</code></strong>.</p>

    <p><strong>1. So sánh</strong></p>
    <table>
      <tr><th></th><th><code>std::sync::Mutex</code></th><th><code>tokio::sync::Mutex</code></th></tr>
      <tr><td>Khi tranh chấp</td><td>Chặn thread (OS futex)</td><td>Task trả Pending, worker đi làm việc khác</td></tr>
      <tr><td>Giữ guard qua <code>.await</code></td><td>Không nên: guard <code>!Send</code> → future không spawn được; nếu cố (current_thread) có thể deadlock</td><td>Được thiết kế cho việc này</td></tr>
      <tr><td>Chi phí</td><td>Rất rẻ khi không tranh chấp</td><td>Đắt hơn (bên trong dùng semaphore + hàng đợi)</td></tr>
      <tr><td>Poisoning</td><td>Có: thread panic khi giữ lock → <code>lock()</code> trả <code>Err</code></td><td>Không</td></tr>
    </table>
    <p>Quy tắc: vùng găng ngắn, không có <code>.await</code> bên trong (cập nhật HashMap, tăng counter) → std Mutex (hoặc <code>parking_lot::Mutex</code>, nhanh hơn, không poisoning).
    Chỉ dùng tokio Mutex khi <em>bắt buộc</em> giữ lock qua I/O — ví dụ tuần tự hoá việc ghi vào một connection dùng chung. Khi đó thường tốt hơn nữa là đổi sang <strong>actor</strong> (bài sau).</p>

    <p><strong>2. Mẫu "khoá ngắn, không await"</strong>: lấy dữ liệu cần thiết ra khỏi lock trong một block <code>{ }</code>, guard drop ở cuối block, rồi mới <code>.await</code>.
    Block riêng là cách rõ ràng và chắc chắn nhất; <code>drop(guard)</code> trước <code>.await</code> chỉ được compiler mới nhận ra (compiler cũ vẫn coi guard còn sống tới hết scope).</p>

    <p><strong>3. RwLock</strong>: nhiều reader hoặc một writer. Chỉ có lợi khi đọc rất nhiều, vùng đọc đủ dài; với vùng găng nhỏ, Mutex thường nhanh hơn vì RwLock tốn chi phí quản lý.
    <code>tokio::sync::RwLock</code> công bằng (FIFO) nên writer không bị bỏ đói; <code>std::sync::RwLock</code> phụ thuộc hệ điều hành. Bẫy kinh điển: đang giữ read lock rồi xin write lock trong cùng task → deadlock.</p>

    <p><strong>4. Lựa chọn khác cho dữ liệu chia sẻ</strong></p>
    <ul>
      <li><code>DashMap</code>: HashMap chia shard, mỗi shard một RwLock — cache nhiều key, ít tranh chấp. Đừng giữ <code>Ref</code> của DashMap qua .await.</li>
      <li><code>arc_swap::ArcSwap</code>: đọc cực nhiều, ghi hiếm (config, bảng routing, danh sách feature flag): reader <code>load()</code> không khoá, writer thay cả <code>Arc</code> mới.</li>
      <li><code>tokio::sync::watch</code>: tương tự nhưng có thông báo thay đổi (bài 10).</li>
      <li>Atomic cho counter/cờ đơn lẻ (bài 11).</li>
    </ul>
    <div class="callout"><p>💡 So với Java: <code>synchronized</code>/<code>ReentrantLock</code> là <em>reentrant</em>; Mutex Rust KHÔNG reentrant — lock lại trong cùng thread là deadlock (std) hoặc treo (tokio).
    Và Rust bắt bạn đi qua guard mới chạm được dữ liệu, nên "quên lock" là lỗi biên dịch chứ không phải race condition.</p></div>
  `,

  codeTabs: [
    { id: "std", label: "① std Mutex đúng cách", lines: [
      "#[derive(Clone, Default)]",
      "struct AppState { hits: Arc<std::sync::Mutex<HashMap<String, u64>>> }",
      "",
      "async fn track(State(s): State<AppState>, Path(page): Path<String>) -> String {",
      "    let count = {",
      "        let mut map = s.hits.lock().unwrap();   // unwrap: chỉ Err khi bị poison",
      "        let c = map.entry(page.clone()).or_insert(0);",
      "        *c += 1;",
      "        *c",
      "    };                                            // guard drop tại đây",
      "    audit_log(&page, count).await;                // await SAU khi nhả lock",
      "    format!(\"{page}: {count}\")",
      "}"
    ]},
    { id: "wrong", label: "② Giữ guard qua await", lines: [
      "async fn bad(s: AppState) {",
      "    let mut map = s.hits.lock().unwrap();",
      "    map.insert(\"k\".into(), 1);",
      "    save_to_redis(&map).await;     // guard vẫn sống",
      "}",
      "// tokio::spawn(bad(s));",
      "// error: future cannot be sent between threads safely",
      "//   ... `std::sync::MutexGuard<'_, HashMap<..>>` which is not `Send`",
      "",
      "// Cách chắc chắn: bọc phần dùng guard trong block { } như tab ①"
    ]},
    { id: "tokio", label: "③ Khi cần tokio Mutex", lines: [
      "// Một connection dùng chung, phải ghi tuần tự cả frame",
      "struct Upstream { conn: tokio::sync::Mutex<TcpStream> }",
      "",
      "impl Upstream {",
      "    async fn send(&self, frame: &[u8]) -> io::Result<()> {",
      "        let mut conn = self.conn.lock().await;   // chờ không chặn worker",
      "        conn.write_all(frame).await?;              // giữ lock qua await: OK",
      "        conn.flush().await",
      "    }",
      "}",
      "// Tốt hơn thường là actor sở hữu TcpStream + mpsc (bài 10)"
    ]},
    { id: "rw", label: "④ RwLock & ArcSwap", lines: [
      "// Đọc nhiều, ghi hiếm: cấu hình nạp lại mỗi phút",
      "static CONFIG: LazyLock<ArcSwap<Config>> =",
      "    LazyLock::new(|| ArcSwap::from_pointee(Config::default()));",
      "",
      "fn current_limit() -> u32 { CONFIG.load().rate_limit }   // không khoá",
      "fn reload(new_cfg: Config) { CONFIG.store(Arc::new(new_cfg)); }",
      "",
      "// Deadlock kinh điển với RwLock:",
      "let r = lock.read().await;",
      "if r.is_empty() {",
      "    let mut w = lock.write().await;   // chờ read của CHÍNH MÌNH -> treo vĩnh viễn",
      "}"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "synchronized (this) { count++; }            // reentrant, quên lock = race",
      "",
      "private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock();",
      "",
      "ConcurrentHashMap<String, Long> hits;       // ~ DashMap",
      "AtomicReference<Config> cfg;                // ~ ArcSwap<Config>",
      "",
      "// Rust: Mutex<T> BỌC dữ liệu -> không chạm được T nếu chưa lock"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Có .await khi đang giữ lock?</div><div class="ns">câu hỏi quyết định</div></div>
    <div class="row">
      <div class="node" id="std"><div class="nl">🔒 Không → std / parking_lot Mutex</div><div class="ns">block { } rồi mới await</div></div>
      <div class="node" id="tk"><div class="nl">⏳ Có → tokio::sync::Mutex</div><div class="ns">hoặc actor + channel</div></div>
    </div>
    <div class="arrow" id="a1">↓ giữ std guard qua await?</div>
    <div class="node" id="err"><div class="nl">⛔ future không Send</div><div class="ns">MutexGuard: !Send</div></div>
    <div class="arrow" id="a2">↓ đọc cực nhiều, ghi hiếm</div>
    <div class="node" id="as"><div class="nl">🔁 ArcSwap / RwLock / DashMap</div><div class="ns">chọn theo tỉ lệ đọc/ghi</div></div>
  `,
  steps: [
    { title: "1 · Vùng găng ngắn với std Mutex", tab: "std", highlight: [2, 5, 6, 10, 11], on: ["q", "std"],
      desc: "Lấy dữ liệu trong block; guard drop ở dấu <code>}</code>; sau đó mới await. Nhanh và đúng." },
    { title: "2 · Giữ guard qua await → lỗi Send", tab: "wrong", highlight: [2, 4, 7, 8], on: ["a1", "err"],
      desc: "Compiler cứu bạn: MutexGuard của std không Send nên future chứa nó không spawn được trên runtime đa luồng." },
    { title: "3 · Khi thật sự cần giữ qua I/O", tab: "tokio", highlight: [2, 6, 7, 11], on: ["tk"],
      desc: "Ghi trọn một frame lên connection chung. tokio Mutex cho phép, nhưng actor thường sạch hơn." },
    { title: "4 · Đọc nhiều ghi hiếm", tab: "rw", highlight: [2, 3, 5, 6], on: ["a2", "as"],
      desc: "ArcSwap: reader không khoá, writer thay cả Arc. Hợp với config hot-reload." },
    { title: "5 · Deadlock read→write", tab: "rw", highlight: [9, 10, 11], on: ["as"],
      desc: "Không nâng cấp read lock lên write trong cùng task. Nhả read trước, hoặc lấy write ngay từ đầu." },
    { title: "6 · Khác Java", tab: "java", highlight: [1, 5, 6, 8], on: ["std"],
      desc: "Mutex Rust không reentrant và bọc dữ liệu — quên lock là lỗi biên dịch." }
  ],

  quiz: [
    { q: "Trong handler async, cập nhật HashMap dùng chung không có .await bên trong vùng găng — nên dùng?", options: [
        "tokio::sync::Mutex bắt buộc",
        "std::sync::Mutex (hoặc parking_lot) với vùng găng ngắn",
        "RefCell",
        "static mut"
      ], correct: 1, explanation: "Tokio docs khuyên như vậy; std Mutex rẻ hơn." },
    { q: "Giữ std::sync::MutexGuard qua .await rồi tokio::spawn sẽ?", options: [
        "Chạy bình thường",
        "Lỗi biên dịch: future không Send",
        "Panic ngay",
        "Tự chuyển sang tokio Mutex"
      ], correct: 1, explanation: "MutexGuard của std là !Send." },
    { q: "Khi nào tokio::sync::Mutex là lựa chọn đúng?", options: [
        "Mọi lúc trong async",
        "Khi phải giữ lock qua các điểm .await (vd ghi trọn frame lên connection chung)",
        "Khi cần poisoning",
        "Khi dữ liệu là i32"
      ], correct: 1, explanation: "Nó đắt hơn std; chỉ dùng khi cần." },
    { q: "Mutex của Rust có reentrant như synchronized của Java không?", options: [
        "Có", "Không — lock lại trong cùng thread/task là deadlock", "Chỉ tokio Mutex", "Tuỳ OS"
      ], correct: 1, explanation: "Khác Java; phải cấu trúc code để không lock lồng." },
    { q: "Poisoning của std Mutex nghĩa là gì?", options: [
        "Dữ liệu bị mã hoá",
        "Một thread panic khi giữ lock; lần lock sau trả Err để báo dữ liệu có thể dở dang",
        "Lock bị rò rỉ",
        "Mutex bị drop"
      ], correct: 1, explanation: "lock().unwrap() sẽ lan panic; parking_lot và tokio không có poisoning." },
    { q: "Đang giữ read lock của RwLock rồi xin write lock trong cùng task thì?", options: [
        "Tự nâng cấp", "Deadlock/treo", "Lỗi biên dịch", "Read lock tự nhả"
      ], correct: 1, explanation: "Write chờ mọi reader nhả, trong đó có chính bạn." },
    { q: "Config đọc ở mọi request, nạp lại vài phút một lần. Cấu trúc phù hợp?", options: [
        "Mutex<Config> lock mỗi request",
        "ArcSwap<Config> (hoặc watch channel): đọc không khoá, ghi thay Arc",
        "static mut Config",
        "Đọc file mỗi request"
      ], correct: 1, explanation: "Tương tự AtomicReference<Config> trong Java." },
    { q: "RwLock luôn nhanh hơn Mutex khi có nhiều reader?", options: [
        "Đúng, luôn luôn",
        "Không — với vùng găng rất ngắn, chi phí quản lý RwLock có thể làm nó chậm hơn Mutex",
        "RwLock không dùng được trong async",
        "Chỉ khi có đúng 1 reader"
      ], correct: 1, explanation: "Đo trước khi chọn." },
    { q: "Vì sao 'quên lock trước khi đọc dữ liệu chia sẻ' là lỗi biên dịch trong Rust?", options: [
        "Vì Rust có GC",
        "Vì Mutex<T> sở hữu T; chỉ truy cập được qua guard do lock() trả về",
        "Vì clippy chặn",
        "Không đúng, vẫn quên được"
      ], correct: 1, explanation: "Dữ liệu nằm trong lock chứ không nằm cạnh lock như Java." }
  ]
});
