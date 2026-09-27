window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Thread & rendering",
  title: "Làm việc nền đúng cách: Kotlin coroutines & Swift concurrency",
  subtitle: "Dispatchers.Main/IO/Default · viewModelScope · async/await · @MainActor · actor · huỷ theo cấu trúc",

  theory: `
    <p>Bài 05 nói: việc nặng phải rời main thread, kết quả phải quay về main. Hai nền tảng đều có lời giải hiện đại, cùng một ý tưởng: <strong>suspend thay vì block</strong> và <strong>structured concurrency</strong>.</p>

    <p><strong>Suspend khác block thế nào?</strong> <code>Thread.sleep</code>/đọc socket đồng bộ giữ chặt thread. Hàm <code>suspend</code> (Kotlin) hay <code>async</code> (Swift) khi chờ I/O thì <em>nhả thread</em> ra cho việc khác,
    lúc có kết quả thì tiếp tục (có thể trên thread khác). Nên <code>await api.getCart()</code> ngay trong ngữ cảnh main vẫn không làm đơ UI — với điều kiện hàm bên dưới thật sự không block.</p>

    <table>
      <tr><th>Khái niệm</th><th>Kotlin (Android)</th><th>Swift (iOS)</th><th>Java/Spring tương tự</th></tr>
      <tr><td>Chạy trên main</td><td><code>Dispatchers.Main</code></td><td><code>@MainActor</code></td><td>— (server không có UI thread)</td></tr>
      <tr><td>Việc I/O chặn</td><td><code>Dispatchers.IO</code> (pool co giãn, mặc định tối đa 64 thread hoặc số nhân nếu lớn hơn)</td><td>API async sẵn có; code chặn cũ thì đẩy ra luồng riêng</td><td>ExecutorService cho I/O</td></tr>
      <tr><td>Việc tính toán CPU</td><td><code>Dispatchers.Default</code> (≈ số nhân CPU)</td><td>Global concurrent executor (≈ số nhân)</td><td>ForkJoinPool</td></tr>
      <tr><td>Phạm vi sống</td><td><code>viewModelScope</code>, <code>lifecycleScope</code></td><td><code>.task</code> của view, <code>Task</code> giữ handle</td><td>—</td></tr>
      <tr><td>Chạy song song</td><td><code>async { }</code> + <code>await()</code></td><td><code>async let</code>, <code>TaskGroup</code></td><td>CompletableFuture.allOf</td></tr>
      <tr><td>Bảo vệ trạng thái chung</td><td><code>Mutex</code>, StateFlow, một dispatcher đơn luồng</td><td><code>actor</code> (compiler kiểm tra), <code>Sendable</code></td><td>synchronized / lock</td></tr>
    </table>

    <p><strong>Structured concurrency</strong>: mọi coroutine/Task con thuộc về một scope cha. Người dùng rời màn → ViewModel bị clear → <code>viewModelScope</code> huỷ → mọi request con bị huỷ.
    Không còn callback "về muộn" cập nhật màn hình đã đóng. Huỷ là <em>hợp tác</em>: code phải chạm điểm suspend hoặc tự kiểm tra (<code>ensureActive()</code>, <code>Task.checkCancellation()</code>).</p>

    <p><strong>Swift 6</strong> bật kiểm tra data race lúc biên dịch: truyền dữ liệu không <code>Sendable</code> qua ranh giới actor là lỗi compile. Kotlin không có kiểm tra tương đương — phải tự kỷ luật.</p>

    <div class="callout"><p>💡 Bẫy hay gặp: <code>GlobalScope.launch</code> / <code>Task.detached</code> cho mọi thứ — thoát khỏi cấu trúc, không bị huỷ theo màn hình, dễ rò rỉ. Và <code>runBlocking</code> trên main thread = chặn main như bài 05.</p></div>
  `,

  codeTabs: [
    { id: "kt", label: "① Kotlin coroutines", lines: [
      "class CheckoutViewModel(private val api: Api, private val db: OrderDao) : ViewModel() {",
      "    val state = MutableStateFlow<UiState>(UiState.Idle)",
      "",
      "    fun load(userId: String) = viewModelScope.launch {     // Main",
      "        state.value = UiState.Loading",
      "        val cart    = async { api.cart(userId) }            // song song",
      "        val address = async { api.address(userId) }",
      "        val saved   = withContext(Dispatchers.IO) { db.lastOrder() }",
      "        state.value = UiState.Ready(cart.await(), address.await(), saved)",
      "    }",
      "}"
    ]},
    { id: "sw", label: "② Swift concurrency", lines: [
      "@MainActor",
      "@Observable final class CheckoutModel {",
      "    var state: UiState = .idle",
      "",
      "    func load(userId: String) async {",
      "        state = .loading",
      "        async let cart = api.cart(userId)           // song song",
      "        async let address = api.address(userId)",
      "        do {",
      "            state = .ready(try await cart, try await address)",
      "        } catch is CancellationError { /* view biến mất */ }",
      "          catch { state = .error(error) }",
      "    }",
      "}"
    ]},
    { id: "actor", label: "③ Trạng thái chung", lines: [
      "// Swift: actor tuần tự hoá truy cập, compiler bắt await",
      "actor TokenStore {",
      "    private var token: String?",
      "    func get() -> String? { token }",
      "    func set(_ t: String) { token = t }",
      "}",
      "let t = await store.get()",
      "",
      "// Kotlin: Mutex (không block thread như synchronized)",
      "private val mutex = Mutex()",
      "suspend fun refresh() = mutex.withLock { if (expired()) token = api.refresh() }"
    ]},
    { id: "java", label: "④ So với Java", lines: [
      "// Java: CompletableFuture + executor, huỷ thủ công",
      "var cart = CompletableFuture.supplyAsync(() -> api.cart(id), ioPool);",
      "var addr = CompletableFuture.supplyAsync(() -> api.address(id), ioPool);",
      "cart.thenCombine(addr, Ui::new)",
      "    .thenAcceptAsync(this::render, mainExecutor);  // nhớ nhảy về main",
      "// Màn đóng? phải tự cancel từng future, nếu không callback vẫn chạy",
      "",
      "// Kotlin/Swift: huỷ scope cha -> con tự huỷ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="main"><div class="nl">🧵 Main (Dispatchers.Main / @MainActor)</div><div class="ns">bắt đầu launch / Task</div></div>
    <div class="arrow" id="a1">↓ suspend: nhả main thread</div>
    <div class="row">
      <div class="node" id="io"><div class="nl">🌐 I/O pool</div><div class="ns">cart, address song song</div></div>
      <div class="node" id="cpu"><div class="nl">🧮 Default pool</div><div class="ns">parse, sort, tính toán</div></div>
    </div>
    <div class="arrow" id="a2">↓ resume trên main</div>
    <div class="node" id="ui"><div class="nl">🖼️ Gán state → UI vẽ lại</div><div class="ns">không cần post thủ công</div></div>
    <div class="arrow" id="a3">↓ rời màn hình</div>
    <div class="node" id="cancel"><div class="nl">✂️ Scope huỷ → mọi con huỷ</div><div class="ns">structured concurrency</div></div>
  `,
  steps: [
    { title: "1 · Bắt đầu trên main", tab: "kt", highlight: [4, 5], on: ["main"],
      desc: "<code>viewModelScope.launch</code> mặc định chạy trên <code>Dispatchers.Main</code>; cập nhật state ngay được." },
    { title: "2 · Chạy song song, không chặn", tab: "kt", highlight: [6, 7, 8], on: ["a1", "io"],
      desc: "<code>async</code> chạy hai request cùng lúc; <code>withContext(IO)</code> đẩy truy vấn DB ra pool IO. Main được nhả ra trong lúc chờ." },
    { title: "3 · Quay về main", tab: "kt", highlight: [9], on: ["a2", "ui"],
      desc: "Sau <code>await</code>, coroutine tiếp tục trên Main (dispatcher của scope)." },
    { title: "4 · Swift: cùng ý tưởng", tab: "sw", highlight: [1, 7, 8, 10], on: ["main", "io", "ui"],
      desc: "<code>async let</code> chạy song song; class là <code>@MainActor</code> nên gán state luôn an toàn." },
    { title: "5 · Huỷ theo cấu trúc", tab: "sw", highlight: [11], on: ["a3", "cancel"],
      desc: "View biến mất → Task của <code>.task</code> bị huỷ → các <code>async let</code> con cũng huỷ, ném CancellationError." },
    { title: "6 · Bảo vệ trạng thái chung", tab: "actor", highlight: [2, 7, 10, 11], on: ["cpu"],
      desc: "Swift <code>actor</code> được compiler kiểm tra; Kotlin dùng <code>Mutex</code> (suspend, không block thread)." }
  ],

  quiz: [
    { q: "Hàm suspend khác hàm block ở điểm nào?", options: [
        "Chạy nhanh hơn", "Khi chờ I/O thì nhả thread cho việc khác, xong mới tiếp tục", "Luôn chạy trên thread mới", "Không thể huỷ"
      ], correct: 1, explanation: "Nhờ vậy await ngay trên main mà UI vẫn mượt, miễn là hàm bên dưới không block." },
    { q: "Truy vấn Room/SQLite đồng bộ nên chạy trên dispatcher nào?", options: [
        "Dispatchers.Main", "Dispatchers.IO", "Dispatchers.Unconfined", "GlobalScope"
      ], correct: 1, explanation: "IO dành cho việc chặn thread như disk/network." },
    { q: "Người dùng rời màn hình khi request còn đang chạy trong viewModelScope. Điều gì xảy ra?", options: [
        "Request chạy tiếp và cập nhật UI đã đóng",
        "ViewModel bị clear → scope huỷ → coroutine con bị huỷ",
        "App crash",
        "Request được chuyển sang WorkManager"
      ], correct: 1, explanation: "Đó là lợi ích của structured concurrency." },
    { q: "Trong Swift, 'async let a = f(); async let b = g()' có nghĩa gì?", options: [
        "Chạy f rồi mới chạy g", "f và g chạy song song, await khi cần kết quả", "Chạy trên main tuần tự", "Lỗi cú pháp"
      ], correct: 1, explanation: "async let tạo task con chạy đồng thời." },
    { q: "@MainActor gắn trên class có tác dụng gì?", options: [
        "Class chạy trên thread riêng",
        "Mọi thuộc tính/phương thức của class được đảm bảo chạy trên main actor; gọi từ ngoài phải await",
        "Tắt concurrency", "Chỉ dùng cho test"
      ], correct: 1, explanation: "Compiler đảm bảo cô lập, thay cho DispatchQueue.main.async thủ công." },
    { q: "Vì sao nên tránh GlobalScope.launch trong app?", options: [
        "Chậm hơn", "Không gắn vòng đời nào nên không bị huỷ theo màn hình, dễ rò rỉ và cập nhật UI chết", "Không chạy được trên Android", "Bị deprecated từ Kotlin 1.0"
      ], correct: 1, explanation: "Nó thoát khỏi structured concurrency." },
    { q: "Swift actor giải quyết vấn đề gì?", options: [
        "Vẽ UI nhanh hơn", "Data race: truy cập trạng thái bên trong được tuần tự hoá, compiler bắt phải await", "Quản lý bộ nhớ", "Gọi mạng"
      ], correct: 1, explanation: "Tương tự synchronized nhưng không block thread và được kiểm tra lúc biên dịch." },
    { q: "Huỷ coroutine/Task có tự dừng một vòng lặp tính toán thuần CPU không?", options: [
        "Có, ngay lập tức",
        "Không, huỷ là hợp tác: phải có điểm suspend hoặc tự kiểm tra ensureActive()/Task.checkCancellation()",
        "Chỉ trên iOS", "Chỉ khi dùng Dispatchers.IO"
      ], correct: 1, explanation: "Giống interrupt trong Java: code phải hợp tác." },
    { q: "Dispatchers.Default có khoảng bao nhiêu thread?", options: [
        "1", "Xấp xỉ số nhân CPU", "64", "Không giới hạn"
      ], correct: 1, explanation: "Dành cho việc tốn CPU; IO mới là pool lớn (mặc định tới 64)." }
  ]
});
