window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Thư viện đa nền tảng",
  title: "kotlinx.coroutines & Flow trong commonMain",
  subtitle: "Dispatchers trên từng nền tảng · structured concurrency · StateFlow vs SharedFlow · so với CompletableFuture/Reactor",

  theory: `
    <p><code>kotlinx-coroutines-core</code> là thư viện đa nền tảng: cùng API <code>launch</code>, <code>async</code>, <code>withContext</code>, <code>Flow</code> cho Android và iOS.
    Đây là "xương sống" bất đồng bộ của gần như mọi thư viện KMP (Ktor, SQLDelight, Room, DataStore).</p>

    <p><strong>Dispatcher trên từng nền tảng</strong></p>
    <table>
      <tr><th>Dispatcher</th><th>Android</th><th>iOS (Kotlin/Native)</th></tr>
      <tr><td><code>Dispatchers.Main</code></td><td>Main looper (cần <code>kotlinx-coroutines-android</code>)</td><td>Main dispatch queue</td></tr>
      <tr><td><code>Dispatchers.Default</code></td><td>Pool thread = số nhân CPU</td><td>Pool thread nền</td></tr>
      <tr><td><code>Dispatchers.IO</code></td><td>Pool co giãn cho I/O chặn</td><td>Có từ coroutines 1.7; trong common phải <code>import kotlinx.coroutines.IO</code></td></tr>
    </table>

    <p><strong>Structured concurrency</strong>: mỗi coroutine thuộc một <code>CoroutineScope</code>. Huỷ scope → huỷ mọi coroutine con. Con lỗi → mặc định huỷ cả cha và anh em
    (trừ khi dùng <code>SupervisorJob</code>). Nhờ vậy khi màn hình đóng, ViewModel huỷ <code>viewModelScope</code> là mọi request đang chạy dừng theo — không rò rỉ như callback.</p>

    <p><strong>Flow</strong></p>
    <ul>
      <li><code>Flow</code> <em>lạnh</em>: chỉ chạy khi có người <code>collect</code>, mỗi collector chạy lại từ đầu (giống <code>Flux</code> lạnh trong Reactor).</li>
      <li><code>StateFlow</code> <em>nóng</em>, luôn có giá trị hiện tại, chỉ phát khi giá trị <em>khác</em> (so bằng <code>equals</code>) — hợp làm UI state.</li>
      <li><code>SharedFlow</code> nóng, không cần giá trị ban đầu, cấu hình replay/buffer — hợp làm sự kiện (toast, điều hướng).</li>
      <li><code>stateIn(scope, SharingStarted.WhileSubscribed(5000), initial)</code> biến Flow lạnh (vd từ DB) thành StateFlow, dừng upstream 5 giây sau khi không còn ai nghe.</li>
    </ul>

    <table>
      <tr><th>Java/Spring</th><th>Kotlin coroutines</th></tr>
      <tr><td><code>CompletableFuture&lt;T&gt;</code></td><td><code>suspend fun (): T</code> hoặc <code>Deferred&lt;T&gt;</code></td></tr>
      <tr><td><code>ExecutorService</code></td><td><code>Dispatcher</code></td></tr>
      <tr><td><code>Mono</code> / <code>Flux</code></td><td><code>suspend</code> / <code>Flow</code></td></tr>
      <tr><td><code>subscribeOn</code></td><td><code>flowOn(Dispatchers.IO)</code></td></tr>
      <tr><td>Huỷ thủ công, dễ quên</td><td>Huỷ theo scope (structured)</td></tr>
    </table>

    <div class="callout"><p>💡 Trong commonMain, đừng hard-code <code>Dispatchers.IO</code> rải rác: <strong>tiêm dispatcher</strong> qua constructor (vd <code>ioDispatcher: CoroutineDispatcher</code>).
    Test trong commonTest khi đó truyền <code>StandardTestDispatcher</code> và điều khiển thời gian ảo được (bài 17).</p></div>
  `,

  codeTabs: [
    { id: "repo", label: "Repository", lines: [
      "import kotlinx.coroutines.*",
      "import kotlinx.coroutines.flow.*",
      "import kotlinx.coroutines.IO            // cần cho Dispatchers.IO trong common",
      "",
      "class OrderRepository(",
      "    private val api: OrderApi,",
      "    private val dao: OrderDao,",
      "    private val io: CoroutineDispatcher = Dispatchers.IO,",
      ") {",
      "    fun observeOrders(): Flow<List<Order>> = dao.observeAll()   // Flow lạnh từ DB",
      "",
      "    suspend fun refresh() = withContext(io) {",
      "        val remote = api.fetchOrders()",
      "        dao.replaceAll(remote)",
      "    }",
      "}"
    ]},
    { id: "vm", label: "StateFlow cho UI", lines: [
      "class OrdersViewModel(private val repo: OrderRepository, private val scope: CoroutineScope) {",
      "    val orders: StateFlow<List<Order>> = repo.observeOrders()",
      "        .map { list -> list.sortedByDescending { it.createdAt } }",
      "        .stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())",
      "",
      "    private val _events = MutableSharedFlow<String>()",
      "    val events: SharedFlow<String> = _events",
      "",
      "    fun refresh() = scope.launch {",
      "        runCatching { repo.refresh() }",
      "            .onFailure { _events.emit(\"Không tải được đơn hàng\") }",
      "    }",
      "}"
    ]},
    { id: "par", label: "Chạy song song", lines: [
      "suspend fun loadHome(): Home = coroutineScope {",
      "    val banners = async { api.banners() }",
      "    val products = async { api.featured() }",
      "    Home(banners.await(), products.await())",
      "}",
      "// một async lỗi → coroutineScope huỷ cái còn lại và ném lỗi ra ngoài",
      "",
      "// Java tương đương:",
      "// CompletableFuture.allOf(b, p).thenApply(v -> new Home(b.join(), p.join()))",
      "// nhưng lỗi một cái KHÔNG tự huỷ cái kia"
    ]},
    { id: "cancel", label: "Huỷ theo scope", lines: [
      "val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)",
      "",
      "scope.launch { repo.refresh() }          // request mạng",
      "scope.launch { vm.orders.collect { } }   // lắng nghe DB",
      "",
      "// màn hình đóng:",
      "scope.cancel()   // cả hai coroutine dừng; Ktor huỷ request, Flow ngừng collect",
      "",
      "// SupervisorJob: một con lỗi không kéo các con khác chết theo"
    ]}
  ],

  stageHtml: `
    <div class="node" id="db"><div class="nl">🗄️ dao.observeAll()</div><div class="ns">Flow lạnh</div></div>
    <div class="arrow" id="a1">↓ map + stateIn(WhileSubscribed)</div>
    <div class="node" id="sf"><div class="nl">📡 StateFlow&lt;List&lt;Order&gt;&gt;</div><div class="ns">nóng, có giá trị hiện tại</div></div>
    <div class="row">
      <div class="node" id="and"><div class="nl">🤖 collectAsState</div><div class="ns">Compose</div></div>
      <div class="node" id="ios"><div class="nl">🍎 wrapper / SKIE</div><div class="ns">SwiftUI</div></div>
    </div>
    <div class="node" id="net"><div class="nl">🌐 refresh() trên Dispatchers.IO</div><div class="ns">ghi DB → Flow tự phát</div></div>
    <div class="arrow" id="a2">✖ scope.cancel() → mọi thứ dừng</div>
  `,
  steps: [
    { title: "1 · Nguồn dữ liệu là Flow lạnh", tab: "repo", highlight: [10], on: ["db"],
      desc: "DB phát danh sách mới mỗi khi bảng đổi. Chưa ai collect thì chưa có truy vấn nào chạy." },
    { title: "2 · Tiêm dispatcher", tab: "repo", highlight: [3, 8, 12, 13, 14], on: ["net"],
      desc: "<code>withContext(io)</code> đưa I/O ra khỏi main thread. Dispatcher được tiêm để test thay được." },
    { title: "3 · Biến thành StateFlow", tab: "vm", highlight: [2, 3, 4], on: ["a1", "sf"],
      desc: "stateIn giữ giá trị mới nhất cho UI; WhileSubscribed(5000) dừng upstream khi không còn ai nghe (xoay màn hình không bị truy vấn lại)." },
    { title: "4 · Sự kiện một lần", tab: "vm", highlight: [6, 7, 10, 11], on: ["and", "ios"],
      desc: "Lỗi hiển thị bằng SharedFlow — không phải state, không phát lại khi UI subscribe lại." },
    { title: "5 · Song song có cấu trúc", tab: "par", highlight: [1, 2, 3, 4, 6], on: ["net"],
      desc: "Hai request chạy song song; một cái lỗi thì cái kia bị huỷ. CompletableFuture không làm điều này tự động." },
    { title: "6 · Huỷ theo scope", tab: "cancel", highlight: [1, 7, 9], on: ["a2"],
      desc: "Đóng màn hình = huỷ scope. Không cần nhớ unsubscribe từng thứ." }
  ],

  quiz: [
    { q: "Dispatchers.Main trên Android cần thêm thư viện nào?", options: [
        "Không cần gì", "kotlinx-coroutines-android", "ktor-client-android", "androidx.room"
      ], correct: 1, explanation: "Trên iOS, Main có sẵn trong core (main queue)." },
    { q: "Dùng Dispatchers.IO trong commonMain cần gì?", options: [
        "Không dùng được",
        "import kotlinx.coroutines.IO (có từ coroutines 1.7)",
        "expect/actual tự viết",
        "Chỉ dùng trong androidMain"
      ], correct: 1, explanation: "IO là extension property trong common." },
    { q: "Flow lạnh nghĩa là gì?", options: [
        "Chạy liên tục từ khi tạo",
        "Chỉ chạy khi có collector; mỗi collector chạy lại từ đầu",
        "Không phát giá trị",
        "Chỉ chạy trên main thread"
      ], correct: 1, explanation: "Giống Flux lạnh trong Reactor." },
    { q: "StateFlow khác SharedFlow ở điểm nào quan trọng?", options: [
        "StateFlow lạnh",
        "StateFlow luôn có giá trị hiện tại và bỏ qua giá trị bằng giá trị cũ; SharedFlow không cần giá trị ban đầu, hợp làm sự kiện",
        "SharedFlow chỉ có trên Android",
        "Không khác"
      ], correct: 1, explanation: "UI state dùng StateFlow, event dùng SharedFlow (hoặc Channel)." },
    { q: "SharingStarted.WhileSubscribed(5000) làm gì?", options: [
        "Timeout request 5 giây",
        "Giữ upstream chạy thêm 5 giây sau khi collector cuối rời đi rồi mới dừng",
        "Retry 5000 lần",
        "Delay 5 giây trước khi phát"
      ], correct: 1, explanation: "Tránh khởi động lại khi xoay màn hình hoặc chuyển tab nhanh." },
    { q: "Trong coroutineScope có hai async, một cái ném lỗi. Điều gì xảy ra?", options: [
        "Cái còn lại chạy tiếp, lỗi bị nuốt",
        "Cái còn lại bị huỷ và lỗi được ném ra khỏi coroutineScope",
        "App crash ngay",
        "Cả hai retry"
      ], correct: 1, explanation: "Đây là structured concurrency." },
    { q: "SupervisorJob dùng khi nào?", options: [
        "Muốn một con lỗi huỷ tất cả",
        "Muốn các coroutine con độc lập — một con lỗi không huỷ các con khác",
        "Muốn chạy trên IO",
        "Muốn chặn thread"
      ], correct: 1, explanation: "viewModelScope cũng dùng SupervisorJob." },
    { q: "Vì sao nên tiêm CoroutineDispatcher vào repository?", options: [
        "Để chạy nhanh hơn",
        "Để test thay bằng test dispatcher và điều khiển thời gian ảo",
        "Vì Dispatchers.IO không có trên iOS",
        "Vì Koin bắt buộc"
      ], correct: 1, explanation: "Code dễ test hơn nhiều." },
    { q: "flowOn(Dispatchers.IO) tương đương khái niệm nào trong Reactor?", options: [
        "publishOn", "subscribeOn — đổi context cho phần upstream", "block()", "zip"
      ], correct: 1, explanation: "flowOn ảnh hưởng các toán tử phía trước nó." }
  ]
});
