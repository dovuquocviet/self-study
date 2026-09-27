window.LESSONS.push({
  id: "09",
  phase: "1", phaseName: "Coroutines & Flow",
  title: "Flow, StateFlow & SharedFlow — dòng dữ liệu theo thời gian",
  subtitle: "Cold vs hot · toán tử (map, debounce, flatMapLatest, catch) · stateIn · so với Reactor Flux",

  theory: `
    <p>Hàm suspend trả về <em>một</em> giá trị. <strong>Flow&lt;T&gt;</strong> trả về <em>nhiều</em> giá trị theo thời gian: kết quả tìm kiếm khi user gõ,
    dữ liệu Room mỗi khi bảng đổi, vị trí GPS... Nếu bạn biết Reactor <code>Flux</code> (Spring WebFlux) hay RxJava, Flow là cùng ý tưởng nhưng được xây trên coroutine:
    toán tử là hàm suspend thường, huỷ theo scope, không cần <code>subscribeOn/observeOn</code> phức tạp.</p>

    <p><strong>Cold flow</strong> (<code>flow { emit(x) }</code>, Flow từ Room/Retrofit): chỉ là <em>công thức</em>. Không chạy gì cho tới khi có người gọi
    <code>collect</code>; mỗi collector chạy lại khối từ đầu. <code>collect</code> là hàm suspend — nó "treo" coroutine cho tới khi flow kết thúc hoặc bị huỷ.</p>

    <p><strong>Hot flow</strong> tồn tại độc lập với collector:</p>
    <table>
      <tr><th></th><th>StateFlow&lt;T&gt;</th><th>SharedFlow&lt;T&gt;</th></tr>
      <tr><td>Giá trị hiện tại</td><td>Luôn có (<code>.value</code>), bắt buộc giá trị khởi tạo</td><td>Không bắt buộc</td></tr>
      <tr><td>Collector mới nhận</td><td>Giá trị mới nhất ngay lập tức</td><td>Theo <code>replay</code> (mặc định 0)</td></tr>
      <tr><td>Giá trị trùng</td><td>Bỏ qua nếu <code>equals</code> giá trị cũ (conflated)</td><td>Phát hết</td></tr>
      <tr><td>Dùng cho</td><td><strong>Trạng thái UI</strong> (giống LiveData)</td><td>Sự kiện phát tới nhiều nơi</td></tr>
    </table>

    <p><strong>Toán tử hay dùng</strong>: <code>map</code>, <code>filter</code>, <code>onEach</code>, <code>combine</code> (gộp nhiều flow, phát khi bất kỳ cái nào đổi),
    <code>debounce(300)</code> (chờ user ngừng gõ), <code>distinctUntilChanged</code>, <code>flatMapLatest</code> (có giá trị mới → huỷ việc cũ, chạy việc mới),
    <code>catch</code> (bắt lỗi phía upstream), <code>flowOn(Dispatchers.IO)</code> (đổi dispatcher cho phần <em>phía trên</em> nó).</p>

    <p><strong>Cold → hot</strong>: <code>stateIn(scope, SharingStarted.WhileSubscribed(5_000), initial)</code> biến flow thành StateFlow chia sẻ. <code>WhileSubscribed(5_000)</code>:
    dừng upstream khi không còn collector sau 5 giây — đủ để sống qua xoay màn hình (Activity dựng lại trong &lt; 5s) nhưng không chạy mãi khi app ở nền.</p>

    <div class="callout"><p>💡 Trong Compose, thu thập bằng <code>collectAsStateWithLifecycle()</code> (thư viện <code>lifecycle-runtime-compose</code>): nó ngừng collect khi app xuống dưới
    trạng thái STARTED (ra nền), tránh tốn pin/mạng. <code>collectAsState()</code> thì collect suốt khi composable còn trong cây.</p></div>
  `,

  codeTabs: [
    { id: "cold", label: "① Cold flow", lines: [
      "fun ticker(): Flow<Int> = flow {",
      "    println(\"bắt đầu\")",
      "    var i = 0",
      "    while (true) { emit(i++); delay(1_000) }",
      "}",
      "",
      "val f = ticker()          // chưa in gì — chỉ là công thức",
      "scope.launch { f.collect { println(\"A: $it\") } }   // in 'bắt đầu', A: 0, 1...",
      "scope.launch { f.collect { println(\"B: $it\") } }   // chạy lại từ đầu: 'bắt đầu', B: 0..."
    ]},
    { id: "search", label: "② Tìm kiếm khi gõ", lines: [
      "class SearchViewModel(private val repo: ProductRepo) : ViewModel() {",
      "    private val query = MutableStateFlow(\"\")",
      "",
      "    val results: StateFlow<List<Product>> = query",
      "        .debounce(300)                      // chờ ngừng gõ 300ms",
      "        .map { it.trim() }",
      "        .distinctUntilChanged()",
      "        .flatMapLatest { q -> repo.search(q) }   // gõ tiếp → huỷ request cũ",
      "        .catch { emit(emptyList()) }",
      "        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())",
      "",
      "    fun onQueryChange(q: String) { query.value = q }",
      "}"
    ]},
    { id: "state", label: "③ StateFlow vs SharedFlow", lines: [
      "private val _ui = MutableStateFlow(CartUi())",
      "val ui: StateFlow<CartUi> = _ui.asStateFlow()     // lộ ra bản chỉ-đọc",
      "",
      "fun addItem(p: Product) = _ui.update { it.copy(items = it.items + p) }  // atomic",
      "",
      "private val _toasts = MutableSharedFlow<String>(extraBufferCapacity = 1)",
      "val toasts: SharedFlow<String> = _toasts",
      "fun notify(msg: String) { _toasts.tryEmit(msg) }"
    ]},
    { id: "compose", label: "④ Thu thập trong Compose", lines: [
      "@Composable",
      "fun SearchScreen(vm: SearchViewModel = viewModel()) {",
      "    val results by vm.results.collectAsStateWithLifecycle()",
      "    LazyColumn {",
      "        items(results, key = { it.id }) { ProductRow(it) }",
      "    }",
      "}",
      "// app xuống nền → ngừng collect → sau 5s WhileSubscribed dừng upstream"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">⌨️ query: MutableStateFlow</div><div class="ns">user gõ: 'a', 'ao', 'ao t'</div></div>
    <div class="arrow" id="a1">↓ debounce · map · distinctUntilChanged</div>
    <div class="node" id="flat"><div class="nl">🔀 flatMapLatest → repo.search(q)</div><div class="ns">query mới huỷ request cũ</div></div>
    <div class="arrow" id="a2">↓ stateIn(WhileSubscribed(5000))</div>
    <div class="node" id="sf"><div class="nl">📦 StateFlow&lt;List&lt;Product&gt;&gt;</div><div class="ns">hot · luôn có value · bỏ giá trị trùng</div></div>
    <div class="arrow" id="a3">↓ collectAsStateWithLifecycle()</div>
    <div class="node" id="ui"><div class="nl">🖥️ Composable</div><div class="ns">recompose khi value đổi</div></div>
  `,
  steps: [
    { title: "1 · Cold flow là công thức", tab: "cold", highlight: [1, 4, 7, 8, 9], on: ["src"],
      desc: "Tạo flow không chạy gì. Mỗi collect chạy lại khối từ đầu — hai collector là hai lần chạy độc lập." },
    { title: "2 · Nguồn là StateFlow", tab: "search", highlight: [2, 12], on: ["src"],
      desc: "Mỗi lần user gõ, gán <code>query.value</code>." },
    { title: "3 · Toán tử lọc nhiễu", tab: "search", highlight: [5, 6, 7], on: ["a1"],
      desc: "debounce bỏ các lần gõ nhanh liên tiếp; distinctUntilChanged bỏ truy vấn trùng." },
    { title: "4 · flatMapLatest huỷ việc cũ", tab: "search", highlight: [8, 9], on: ["flat"],
      desc: "Kết quả của 'ao' đến muộn sau khi user đã gõ 'ao t' sẽ không bao giờ đè lên UI, vì request cũ đã bị huỷ." },
    { title: "5 · stateIn thành hot flow", tab: "search", highlight: [10], on: ["a2", "sf"],
      desc: "Chia sẻ một upstream cho mọi collector; giữ giá trị mới nhất; dừng upstream 5s sau khi hết collector." },
    { title: "6 · Cập nhật state an toàn", tab: "state", highlight: [1, 2, 4, 6, 8], on: ["sf"],
      desc: "<code>_ui.update { }</code> là compare-and-set, an toàn khi nhiều coroutine cùng sửa. SharedFlow cho sự kiện không cần giá trị hiện tại." },
    { title: "7 · UI thu thập theo lifecycle", tab: "compose", highlight: [3, 5, 8], on: ["a3", "ui"],
      desc: "collectAsStateWithLifecycle chuyển StateFlow thành State của Compose, và ngừng collect khi app ở nền." }
  ],

  quiz: [
    { q: "Tạo val f = flow { println(\"x\"); emit(1) } mà không collect. Có in 'x' không?", options: [
        "Có, ngay khi tạo", "Không — cold flow chỉ chạy khi collect", "In khi GC", "Tuỳ dispatcher"
      ], correct: 1, explanation: "Cold flow là công thức lười." },
    { q: "Hai collector cùng collect một cold flow gọi API. Có bao nhiêu lần gọi API?", options: [
        "1", "2 — mỗi collector chạy lại khối flow", "0", "Tuỳ cache"
      ], correct: 1, explanation: "Muốn chia sẻ thì dùng stateIn/shareIn." },
    { q: "StateFlow khác SharedFlow mặc định ở điểm nào?", options: [
        "StateFlow luôn có giá trị hiện tại, collector mới nhận ngay, bỏ qua giá trị bằng giá trị cũ",
        "StateFlow là cold",
        "SharedFlow luôn giữ giá trị cuối",
        "Không khác"
      ], correct: 0, explanation: "SharedFlow mặc định replay = 0." },
    { q: "_state.value = sameValue (equals giá trị hiện tại). Collector có nhận không?", options: [
        "Có", "Không — StateFlow conflated và so sánh equals", "Nhận null", "Ném exception"
      ], correct: 1, explanation: "Đây là lý do nên dùng data class bất biến và copy()." },
    { q: "flatMapLatest khác flatMapConcat ở?", options: [
        "Chạy nhanh hơn", "Khi có giá trị mới, huỷ flow bên trong của giá trị cũ", "Giữ thứ tự tuyệt đối", "Chạy song song tất cả"
      ], correct: 1, explanation: "Hoàn hảo cho search-as-you-type." },
    { q: "SharingStarted.WhileSubscribed(5_000) nghĩa là?", options: [
        "Bắt đầu sau 5s",
        "Chạy upstream khi có collector; dừng nó 5s sau khi collector cuối biến mất",
        "Timeout request 5s",
        "Phát lại 5 giá trị"
      ], correct: 1, explanation: "5s đủ vượt qua xoay màn hình mà không restart upstream." },
    { q: "flowOn(Dispatchers.IO) ảnh hưởng tới phần nào?", options: [
        "Toàn bộ chuỗi", "Các toán tử phía trên (upstream) của nó", "Chỉ collect", "Phía dưới nó"
      ], correct: 1, explanation: "collect vẫn chạy trên dispatcher của coroutine collector." },
    { q: "collectAsStateWithLifecycle khác collectAsState thế nào?", options: [
        "Không khác",
        "Ngừng collect khi lifecycle dưới STARTED (app ở nền)",
        "Chỉ chạy trên IO",
        "Tự retry khi lỗi"
      ], correct: 1, explanation: "Tiết kiệm tài nguyên khi UI không hiển thị." },
    { q: "Vì sao dùng _ui.update { it.copy(...) } thay vì _ui.value = _ui.value.copy(...)?", options: [
        "Ngắn hơn", "update là compare-and-set nguyên tử, không mất cập nhật khi nhiều coroutine cùng sửa", "value bị deprecated", "update chạy trên IO"
      ], correct: 1, explanation: "Đọc-rồi-ghi thường có race." },
    { q: "Flow tương đương gần nhất bên Spring/Java là?", options: [
        "CompletableFuture", "Reactor Flux / RxJava Observable", "Optional", "ThreadLocal"
      ], correct: 1, explanation: "Nhiều giá trị bất đồng bộ; Mono tương ứng một hàm suspend." }
  ]
});
