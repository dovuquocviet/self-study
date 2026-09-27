window.LESSONS.push({
  id: "08",
  phase: "1", phaseName: "Coroutines & Flow",
  title: "Structured concurrency: scope, Job, huỷ & lỗi",
  subtitle: "launch vs async · cây Job · huỷ hợp tác · CancellationException · SupervisorJob · viewModelScope",

  theory: `
    <p>Với thread, bạn <code>submit</code> xong là "thả trôi": màn hình đóng rồi, request vẫn chạy và callback vẫn cập nhật UI đã chết (leak, crash).
    <strong>Structured concurrency</strong> nói: mọi coroutine phải chạy trong một <code>CoroutineScope</code>, và tạo thành <strong>cây cha–con</strong>.</p>
    <ul>
      <li>Cha <strong>chờ</strong> mọi con xong mới hoàn tất.</li>
      <li>Huỷ cha → huỷ toàn bộ con cháu.</li>
      <li>Con lỗi (không bắt) → báo lên cha → cha huỷ các con còn lại → lỗi đi tiếp lên trên.</li>
    </ul>

    <table>
      <tr><th>Builder</th><th>Trả về</th><th>Dùng khi</th></tr>
      <tr><td><code>launch</code></td><td><code>Job</code></td><td>"Bắn và quên" trong scope: lưu, gửi, cập nhật state</td></tr>
      <tr><td><code>async</code></td><td><code>Deferred&lt;T&gt;</code></td><td>Cần kết quả, thường chạy song song rồi <code>await()</code></td></tr>
      <tr><td><code>coroutineScope { }</code></td><td>kết quả khối</td><td>Tạo scope con trong hàm suspend; lỗi một con huỷ tất cả</td></tr>
      <tr><td><code>supervisorScope { }</code></td><td>kết quả khối</td><td>Con lỗi không kéo các con khác</td></tr>
      <tr><td><code>runBlocking</code></td><td>kết quả</td><td>Chặn thread đến khi xong — chỉ cho <code>main()</code>/test cũ, không dùng trong app</td></tr>
    </table>

    <p><strong>Huỷ là hợp tác (cooperative)</strong>: <code>job.cancel()</code> chỉ đặt cờ. Coroutine thực sự dừng khi tới một điểm suspend có kiểm tra huỷ
    (<code>delay</code>, <code>withContext</code>, <code>yield</code>, hầu hết hàm suspend của kotlinx/Retrofit/Room) — lúc đó ném <code>CancellationException</code>.
    Vòng lặp CPU thuần phải tự kiểm tra <code>ensureActive()</code> hoặc <code>isActive</code>.</p>
    <p>Bẫy kinh điển: <code>catch (e: Exception)</code> bắt luôn <code>CancellationException</code> rồi nuốt mất → coroutine đã bị huỷ vẫn chạy tiếp.
    Hoặc bắt kiểu cụ thể (IOException, HttpException), hoặc ném lại CancellationException.</p>

    <p><strong>Scope có sẵn trên Android</strong>: <code>viewModelScope</code> (huỷ khi ViewModel bị clear, dùng <code>SupervisorJob</code> + <code>Dispatchers.Main.immediate</code>),
    <code>lifecycleScope</code> (huỷ khi Activity/Fragment destroy), <code>rememberCoroutineScope()</code> trong Compose (huỷ khi composable rời màn hình).
    <code>GlobalScope</code> phá cấu trúc — tránh.</p>

    <div class="callout"><p>💡 Lỗi trong <code>launch</code> không bắt sẽ lan lên và (nếu không có <code>CoroutineExceptionHandler</code>) crash app như exception không bắt trên thread.
    Lỗi trong <code>async</code> được giữ lại và ném ra ở <code>await()</code> — nhưng với scope thường, nó <em>vẫn</em> huỷ cha ngay khi xảy ra. Quy tắc thực dụng: bắt lỗi
    bên trong coroutine, gần nơi gây ra nó.</p></div>
  `,

  codeTabs: [
    { id: "par", label: "① async song song", lines: [
      "suspend fun loadHome(): Home = coroutineScope {",
      "    val banners = async { api.banners() }     // bắt đầu ngay",
      "    val deals   = async { api.deals() }       // chạy song song",
      "    val cart    = async { cartRepo.summary() }",
      "    Home(banners.await(), deals.await(), cart.await())",
      "}",
      "// deals() lỗi → banners & cart bị huỷ, loadHome ném lỗi đó",
      "// Tổng thời gian ≈ max(3 request) thay vì tổng"
    ]},
    { id: "tree", label: "② Cây Job & huỷ", lines: [
      "val job = viewModelScope.launch {           // cha",
      "    launch { syncCart() }                     // con 1",
      "    launch { while (true) { poll(); delay(5_000) } }   // con 2",
      "}",
      "",
      "job.cancel()          // cha + con 1 + con 2 đều bị huỷ",
      "// ViewModel.onCleared() → viewModelScope bị huỷ → mọi thứ trên dừng theo"
    ]},
    { id: "coop", label: "③ Huỷ hợp tác", lines: [
      "suspend fun resizeAll(files: List<File>) = withContext(Dispatchers.Default) {",
      "    for (f in files) {",
      "        ensureActive()          // không có dòng này → cancel không dừng vòng lặp CPU",
      "        resize(f)               // hàm thường, không suspend",
      "    }",
      "}",
      "",
      "try { api.submit(order) }",
      "catch (e: CancellationException) { throw e }   // ✅ luôn ném lại",
      "catch (e: IOException) { showOffline() }         // ✅ bắt lỗi cụ thể",
      "// ❌ catch (e: Exception) { log(e) }  → nuốt cả CancellationException"
    ]},
    { id: "sup", label: "④ Supervisor", lines: [
      "// Màn hình dashboard: 1 widget lỗi không được kéo sập các widget khác",
      "suspend fun refreshWidgets() = supervisorScope {",
      "    launch { weather.refresh() }",
      "    launch { stocks.refresh() }     // lỗi ở đây không huỷ weather",
      "}",
      "",
      "val handler = CoroutineExceptionHandler { _, e -> log.error(\"uncaught\", e) }",
      "val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default + handler)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="scope"><div class="nl">🌳 viewModelScope (SupervisorJob + Main)</div><div class="ns">huỷ khi ViewModel.onCleared()</div></div>
    <div class="arrow" id="a1">↓ launch</div>
    <div class="node" id="parent"><div class="nl">Job cha: loadHome()</div><div class="ns">coroutineScope — chờ mọi con</div></div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">async banners</div><div class="ns">Deferred</div></div>
      <div class="node" id="c2"><div class="nl">async deals</div><div class="ns">💥 IOException</div></div>
      <div class="node" id="c3"><div class="nl">async cart</div><div class="ns">bị huỷ theo</div></div>
    </div>
    <div class="arrow" id="a2">↑ lỗi lan lên cha, cha huỷ các con còn lại</div>
  `,
  steps: [
    { title: "1 · Chạy song song bằng async", tab: "par", highlight: [1, 2, 3, 4, 5], on: ["parent", "c1", "c2", "c3"],
      desc: "Ba request chạy cùng lúc; <code>await</code> lấy kết quả. coroutineScope chỉ xong khi cả ba xong." },
    { title: "2 · Một con lỗi", tab: "par", highlight: [7, 8], on: ["c2", "a2"],
      desc: "deals() lỗi → cha bị huỷ → banners và cart cũng bị huỷ, lỗi ném ra khỏi loadHome. Không có request 'mồ côi'." },
    { title: "3 · Huỷ theo cây", tab: "tree", highlight: [1, 2, 3, 6, 7], on: ["scope", "a1"],
      desc: "Rời màn hình → ViewModel clear → scope huỷ → vòng poll vô hạn dừng ở <code>delay</code> kế tiếp." },
    { title: "4 · Huỷ là hợp tác", tab: "coop", highlight: [3, 9, 10, 11], on: ["parent"],
      desc: "Vòng lặp CPU phải gọi <code>ensureActive()</code>. Và đừng nuốt CancellationException bằng catch Exception." },
    { title: "5 · Khi muốn cô lập lỗi", tab: "sup", highlight: [2, 3, 4, 8], on: ["scope"],
      desc: "supervisorScope/SupervisorJob: con lỗi không huỷ anh em. viewModelScope đã dùng SupervisorJob." }
  ],

  quiz: [
    { q: "launch và async khác nhau cơ bản ở?", options: [
        "launch chạy trên IO, async chạy trên Main", "launch trả Job (không kết quả); async trả Deferred<T> lấy kết quả bằng await", "async không huỷ được", "Không khác"
      ], correct: 1, explanation: "Dùng async khi cần giá trị, thường để chạy song song." },
    { q: "Trong coroutineScope, một async con ném IOException. Các con khác?", options: [
        "Chạy tiếp bình thường", "Bị huỷ, và coroutineScope ném lại lỗi", "Bị tạm dừng", "Tự retry"
      ], correct: 1, explanation: "Đó là hành vi của Job thường (không supervisor)." },
    { q: "job.cancel() có dừng ngay một vòng lặp CPU không có điểm suspend?", options: [
        "Có, ngay lập tức", "Không — huỷ là hợp tác; cần ensureActive()/isActive hoặc điểm suspend", "Có, bằng Thread.interrupt", "Chỉ trên Main"
      ], correct: 1, explanation: "cancel chỉ đặt trạng thái; code phải kiểm tra." },
    { q: "Vì sao catch (e: Exception) trong coroutine là nguy hiểm?", options: [
        "Chậm", "Bắt luôn CancellationException, làm coroutine đã bị huỷ chạy tiếp", "Không bắt được IOException", "Lỗi compile"
      ], correct: 1, explanation: "Bắt lỗi cụ thể hoặc ném lại CancellationException." },
    { q: "viewModelScope bị huỷ khi nào?", options: [
        "Khi xoay màn hình", "Khi ViewModel bị clear (onCleared) — màn hình bị loại hẳn", "Khi app vào nền", "Không bao giờ"
      ], correct: 1, explanation: "ViewModel sống qua xoay màn hình, nên scope cũng vậy." },
    { q: "supervisorScope khác coroutineScope ở?", options: [
        "Chạy trên thread khác", "Lỗi của một con không huỷ các con khác", "Không chờ con", "Không huỷ được"
      ], correct: 1, explanation: "Hợp với các tác vụ độc lập như widget dashboard." },
    { q: "Vì sao tránh GlobalScope.launch trong app?", options: [
        "Chậm hơn", "Coroutine không gắn vòng đời nào, không tự huỷ → leak, cập nhật UI đã chết", "Bị deprecated hoàn toàn", "Không chạy trên Android"
      ], correct: 1, explanation: "Phá structured concurrency." },
    { q: "runBlocking dùng hợp lý ở đâu?", options: [
        "Trong onClick", "Trong hàm main() hoặc cầu nối code blocking cũ/test; không dùng trên main thread app", "Trong ViewModel", "Trong composable"
      ], correct: 1, explanation: "Nó chặn thread hiện tại." },
    { q: "Ba request async song song mỗi cái 300ms, 500ms, 200ms. Tổng thời gian loadHome xấp xỉ?", options: [
        "1000ms", "500ms", "200ms", "300ms"
      ], correct: 1, explanation: "Chạy song song nên bằng request lâu nhất." }
  ]
});
