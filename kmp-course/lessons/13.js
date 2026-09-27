window.LESSONS.push({
  id: "13",
  phase: "4", phaseName: "Kiến trúc chia sẻ",
  title: "Kiến trúc chia sẻ: Repository → UseCase → ViewModel dùng chung",
  subtitle: "Single source of truth · UiState bất biến · androidx ViewModel trên KMP · vòng đời ViewModel trên iOS",

  theory: `
    <p>Câu hỏi thiết kế lớn nhất: <strong>ranh giới shared/native đặt ở đâu?</strong> Cách được dùng nhiều nhất hiện nay: chia sẻ tới tận <em>ViewModel</em>, UI native chỉ vẽ state và gửi sự kiện.</p>

    <table>
      <tr><th>Tầng</th><th>Nằm ở</th><th>Việc</th><th>Giống bên Spring</th></tr>
      <tr><td>Data: Api, Dao, Repository</td><td>shared</td><td>Lấy/ghi dữ liệu, cache, đồng bộ</td><td>Repository + client</td></tr>
      <tr><td>Domain: UseCase, model</td><td>shared</td><td>Business rule thuần, không phụ thuộc framework</td><td>@Service</td></tr>
      <tr><td>Presentation: ViewModel, UiState</td><td>shared</td><td>Biến dữ liệu thành state màn hình, xử lý sự kiện</td><td>@Controller (nhưng giữ state)</td></tr>
      <tr><td>UI</td><td>native</td><td>Vẽ UiState, gửi hành động</td><td>View/template</td></tr>
    </table>

    <p><strong>Single source of truth</strong>: Repository trả về <code>Flow</code> đọc từ DB cục bộ; <code>refresh()</code> gọi API rồi ghi vào DB; DB phát lại → UI tự cập nhật. UI không bao giờ nhận dữ liệu trực tiếp từ mạng. App chạy được offline và không có hai nguồn dữ liệu mâu thuẫn.</p>

    <p><strong>UseCase</strong> chỉ đáng có khi chứa logic thật (gộp nhiều repository, áp rule). Nếu chỉ gọi thẳng repository thì bỏ qua — đừng tạo tầng rỗng.</p>

    <p><strong>ViewModel dùng chung</strong>: <code>androidx.lifecycle:lifecycle-viewmodel</code> hỗ trợ KMP từ 2.8. Class kế thừa <code>ViewModel()</code> trong commonMain, có sẵn <code>viewModelScope</code> (chạy trên <code>Dispatchers.Main.immediate</code>).
    Công khai một <code>StateFlow&lt;UiState&gt;</code> bất biến và các hàm hành động (<code>onRefresh()</code>, <code>onSelect(id)</code>) — luồng dữ liệu một chiều (UDF).</p>
    <ul>
      <li><strong>Android</strong>: Activity/NavBackStackEntry là <code>ViewModelStoreOwner</code> — ViewModel sống qua xoay màn hình, tự <code>clear</code> khi màn hình bị huỷ.</li>
      <li><strong>iOS</strong>: không ai tự làm điều đó. Bạn phải cho mỗi màn hình một <code>ViewModelStore</code> và gọi <code>clear()</code> khi màn hình biến mất (để huỷ <code>viewModelScope</code>),
        hoặc dùng thư viện như KMP-ObservableViewModel. Quên bước này → coroutine chạy mãi, rò rỉ bộ nhớ.</li>
    </ul>

    <div class="callout"><p>💡 Với người học đang "vibe code" RN: mọi <code>useState</code>/<code>useEffect</code> gọi API rải trong component chính là thứ cần gom vào ViewModel shared.
    Sau khi gom, UI SwiftUI/Compose chỉ còn là hàm <code>state → giao diện</code> — viết hai lần phần này rẻ hơn nhiều so với viết hai lần business logic.</p></div>
  `,

  codeTabs: [
    { id: "repo", label: "Repository (SSOT)", lines: [
      "class OrderRepository(private val api: OrderApi, private val dao: OrderDao) {",
      "    fun observe(): Flow<List<Order>> =",
      "        dao.observeAll().map { rows -> rows.map { it.toDomain() } }",
      "",
      "    suspend fun refresh() {",
      "        val remote = api.fetchOrders(page = 1)",
      "        dao.replaceAll(remote)          // DB phát lại → UI tự cập nhật",
      "    }",
      "}",
      "",
      "class GetVisibleOrders(private val repo: OrderRepository) {   // có rule thật",
      "    operator fun invoke(): Flow<List<Order>> =",
      "        repo.observe().map { list -> list.filter { it.status != OrderStatus.CANCELLED } }",
      "}"
    ]},
    { id: "vm", label: "ViewModel chung", lines: [
      "data class OrdersUiState(",
      "    val items: List<Order> = emptyList(),",
      "    val refreshing: Boolean = false,",
      "    val error: String? = null,",
      ")",
      "",
      "class OrdersViewModel(",
      "    getOrders: GetVisibleOrders,",
      "    private val repo: OrderRepository,",
      ") : ViewModel() {",
      "    private val _state = MutableStateFlow(OrdersUiState())",
      "    val state: StateFlow<OrdersUiState> = _state",
      "",
      "    init {",
      "        getOrders().onEach { list -> _state.update { it.copy(items = list) } }",
      "            .launchIn(viewModelScope)",
      "        onRefresh()",
      "    }",
      "",
      "    fun onRefresh() = viewModelScope.launch {",
      "        _state.update { it.copy(refreshing = true, error = null) }",
      "        runCatching { repo.refresh() }",
      "            .onFailure { e -> _state.update { it.copy(error = e.message) } }",
      "        _state.update { it.copy(refreshing = false) }",
      "    }",
      "}"
    ]},
    { id: "android", label: "Compose", lines: [
      "@Composable",
      "fun OrdersScreen(vm: OrdersViewModel = koinViewModel()) {",
      "    val ui by vm.state.collectAsStateWithLifecycle()",
      "    PullToRefreshBox(isRefreshing = ui.refreshing, onRefresh = vm::onRefresh) {",
      "        LazyColumn { items(ui.items) { OrderRow(it) } }",
      "    }",
      "}"
    ]},
    { id: "ios", label: "iOS: vòng đời VM", lines: [
      "// iosMain — mỗi màn hình một store",
      "class ScreenScope : ViewModelStoreOwner, KoinComponent {",
      "    override val viewModelStore = ViewModelStore()",
      "    fun ordersViewModel(): OrdersViewModel =",
      "        ViewModelProvider.create(this, viewModelFactory {",
      "            initializer { OrdersViewModel(get(), get()) }   // get() của Koin",
      "        })[OrdersViewModel::class]",
      "    fun dispose() = viewModelStore.clear()   // → onCleared, huỷ viewModelScope",
      "}",
      "",
      "// Swift",
      "// @StateObject var model = OrdersModel()   // bọc vm.state bằng wrapper/SKIE (bài 08)",
      "// .onDisappear { model.dispose() }          // gọi scope.dispose() + huỷ subscription"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="api"><div class="nl">🌐 OrderApi</div><div class="ns">Ktor</div></div>
      <div class="node" id="db"><div class="nl">🗄️ OrderDao</div><div class="ns">SQLDelight/Room</div></div>
    </div>
    <div class="arrow" id="a1">↓ refresh(): API → ghi DB · observe(): đọc DB</div>
    <div class="node" id="repo"><div class="nl">📚 Repository → UseCase</div><div class="ns">single source of truth</div></div>
    <div class="arrow" id="a2">↓ Flow</div>
    <div class="node" id="vm"><div class="nl">🧠 OrdersViewModel (shared)</div><div class="ns">StateFlow&lt;OrdersUiState&gt; · onRefresh()</div></div>
    <div class="row">
      <div class="node" id="c"><div class="nl">🤖 Compose</div><div class="ns">collectAsStateWithLifecycle</div></div>
      <div class="node" id="s"><div class="nl">🍎 SwiftUI</div><div class="ns">tự clear store khi thoát màn</div></div>
    </div>
  `,
  steps: [
    { title: "1 · DB là nguồn sự thật", tab: "repo", highlight: [2, 3, 5, 6, 7], on: ["api", "db", "a1", "repo"],
      desc: "UI đọc DB; mạng chỉ cập nhật DB. Mất mạng vẫn hiện dữ liệu cũ." },
    { title: "2 · UseCase có rule thật", tab: "repo", highlight: [11, 12, 13], on: ["repo"],
      desc: "Lọc đơn đã huỷ là business rule — viết một lần cho cả hai nền tảng." },
    { title: "3 · UiState bất biến", tab: "vm", highlight: [1, 2, 3, 4, 11, 12], on: ["a2", "vm"],
      desc: "Một data class mô tả toàn bộ màn hình. UI chỉ đọc; chỉ ViewModel được thay đổi qua <code>update { copy(...) }</code>." },
    { title: "4 · Hành động → state mới", tab: "vm", highlight: [15, 16, 20, 21, 22, 23, 24], on: ["vm"],
      desc: "onRefresh bật cờ, gọi repo, ghi lỗi nếu có, tắt cờ. Danh sách mới tự đến qua Flow từ DB." },
    { title: "5 · Android: vòng đời có sẵn", tab: "android", highlight: [2, 3, 4], on: ["c"],
      desc: "koinViewModel gắn VM vào owner của màn hình; collectAsStateWithLifecycle ngừng collect khi app ở nền." },
    { title: "6 · iOS: tự quản vòng đời", tab: "ios", highlight: [2, 3, 5, 8, 13], on: ["s"],
      desc: "Không có owner tự động: tạo store cho màn hình và gọi <code>clear()</code> khi màn hình biến mất để huỷ viewModelScope." }
  ],

  quiz: [
    { q: "Ranh giới shared/native phổ biến nhất hiện nay là?", options: [
        "Chỉ chia sẻ model",
        "Chia sẻ tới ViewModel; UI native chỉ vẽ state và gửi sự kiện",
        "Chia sẻ cả UI bắt buộc",
        "Không chia sẻ gì"
      ], correct: 1, explanation: "UI native vẫn giữ trải nghiệm riêng từng nền tảng." },
    { q: "Single source of truth trong repository nghĩa là?", options: [
        "Chỉ có một API",
        "UI chỉ đọc từ DB cục bộ; mạng ghi vào DB, DB phát lại cho UI",
        "Chỉ một ViewModel cho cả app",
        "Không dùng cache"
      ], correct: 1, explanation: "Tránh hai nguồn dữ liệu mâu thuẫn và hỗ trợ offline." },
    { q: "Khi nào nên tạo UseCase?", options: [
        "Luôn luôn, mỗi repository một UseCase",
        "Khi có logic thật (gộp nhiều nguồn, áp rule); chỉ gọi thẳng repository thì bỏ qua",
        "Không bao giờ",
        "Chỉ trên iOS"
      ], correct: 1, explanation: "Tầng rỗng chỉ thêm code." },
    { q: "androidx ViewModel hỗ trợ KMP từ phiên bản lifecycle nào?", options: [
        "2.2", "2.8", "3.0 chỉ Android", "Không hỗ trợ"
      ], correct: 1, explanation: "lifecycle-viewmodel 2.8 có bản common." },
    { q: "viewModelScope chạy trên dispatcher nào?", options: [
        "Dispatchers.IO", "Dispatchers.Main.immediate", "Dispatchers.Default", "Unconfined"
      ], correct: 1, explanation: "Nên I/O phải withContext sang IO trong repository." },
    { q: "Trên iOS, ai gọi clear() cho ViewModel khi màn hình đóng?", options: [
        "Hệ điều hành tự làm",
        "Không ai — bạn phải tự quản ViewModelStore của màn hình hoặc dùng thư viện",
        "SwiftUI tự làm",
        "Koin tự làm"
      ], correct: 1, explanation: "Quên thì viewModelScope không bị huỷ → rò rỉ." },
    { q: "Vì sao UiState nên là data class bất biến?", options: [
        "Để nhẹ hơn",
        "UI chỉ đọc, thay đổi đi qua ViewModel bằng copy(); StateFlow so equals để bỏ qua state trùng",
        "Vì Swift yêu cầu",
        "Vì Koin yêu cầu"
      ], correct: 1, explanation: "Luồng dữ liệu một chiều, dễ debug." },
    { q: "collectAsStateWithLifecycle khác collectAsState ở điểm nào?", options: [
        "Không khác",
        "Ngừng collect khi lifecycle xuống dưới STARTED (app ở nền)",
        "Chạy trên IO",
        "Chỉ cho iOS"
      ], correct: 1, explanation: "Tiết kiệm tài nguyên khi app không hiển thị." },
    { q: "Khi chuyển từ RN, code nào nên gom vào ViewModel shared đầu tiên?", options: [
        "Style CSS",
        "Logic gọi API, trạng thái loading/error, rule nghiệp vụ đang nằm trong useState/useEffect",
        "Animation",
        "Icon"
      ], correct: 1, explanation: "UI còn lại chỉ là state → giao diện." }
  ]
});
