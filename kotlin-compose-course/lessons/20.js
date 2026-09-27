window.LESSONS.push({
  id: "20",
  phase: "4", phaseName: "Kiến trúc app",
  title: "ViewModel & lifecycle",
  subtitle: "Vì sao sống qua xoay màn hình · ViewModelStore · viewModelScope · SavedStateHandle & process death · UiState + event",

  theory: `
    <p>Activity bị huỷ và tạo lại khi xoay màn hình (bài 10). Nếu state và request mạng nằm trong Activity/composable, chúng mất theo. <strong>ViewModel</strong> là object
    sống lâu hơn: nó được giữ trong <code>ViewModelStore</code> của owner (Activity, hoặc NavBackStackEntry), và owner <em>giữ lại store</em> qua config change.
    Activity mới hỏi <code>ViewModelProvider</code> → nhận lại đúng instance cũ.</p>

    <table>
      <tr><th>Sự kiện</th><th>Activity</th><th>ViewModel</th><th>SavedStateHandle</th></tr>
      <tr><td>Recompose</td><td>—</td><td>giữ</td><td>giữ</td></tr>
      <tr><td>Xoay màn hình / đổi dark mode</td><td>tạo lại</td><td><strong>giữ</strong></td><td>giữ</td></tr>
      <tr><td>Rời màn (pop / finish)</td><td>huỷ</td><td><code>onCleared()</code>, <code>viewModelScope</code> bị huỷ</td><td>mất</td></tr>
      <tr><td>Process death (OS giết app ở nền)</td><td>tạo lại</td><td><strong>mất</strong> — tạo mới</td><td><strong>khôi phục</strong> (lưu trong Bundle)</td></tr>
    </table>

    <p><strong>Trách nhiệm của ViewModel</strong>: giữ <em>UI state</em> của màn hình, nhận <em>event</em> từ UI, gọi tầng dữ liệu (repository), biến đổi dữ liệu thành state để UI hiển thị.
    Nó <strong>không</strong> giữ tham chiếu Activity/Context/View/composable (sẽ leak vì sống lâu hơn chúng). Cần Context cho tài nguyên thì để tầng dữ liệu lo, hoặc dùng
    <code>@ApplicationContext</code> qua DI.</p>

    <ul>
      <li>Lộ state bằng <code>StateFlow&lt;UiState&gt;</code> (bản chỉ-đọc), giữ <code>MutableStateFlow</code> private.</li>
      <li>Lấy trong Compose: <code>viewModel()</code> (lifecycle-viewmodel-compose) hoặc <code>hiltViewModel()</code> khi dùng Hilt — gọi ở composable cấp màn hình.</li>
      <li><code>SavedStateHandle</code>: map key-value sống qua process death — cho giá trị nhỏ như ID, từ khoá tìm kiếm, tab đang chọn. Dữ liệu lớn thì tải lại từ DB/API.</li>
    </ul>

    <p><strong>Sự kiện một lần</strong> (điều hướng sau khi lưu, hiện toast): hướng dẫn chính thức của Google khuyên biểu diễn nó như <em>state</em> (vd <code>ui.savedOrderId</code>)
    rồi UI xử lý xong gọi <code>vm.onNavigated()</code> để xoá; nhiều team dùng <code>Channel</code>/<code>SharedFlow</code> — đơn giản hơn nhưng có thể mất sự kiện nếu phát lúc UI không collect.</p>

    <div class="callout"><p>💡 So với Spring: ViewModel giống một bean <em>scope theo màn hình</em> (như <code>@ViewScoped</code> của JSF): container (ViewModelStore) quản lý vòng đời,
    bạn không tự <code>new</code>. Với React Native, đây là thứ bạn thường làm bằng Redux/Zustand store + hook — nhưng gắn vòng đời màn hình tự động.</p></div>
  `,

  codeTabs: [
    { id: "vm", label: "① ViewModel", lines: [
      "data class CheckoutUi(",
      "    val items: List<CartItemUi> = emptyList(),",
      "    val placing: Boolean = false,",
      "    val error: String? = null,",
      "    val placedOrderCode: String? = null        // sự kiện dạng state",
      ")",
      "",
      "@HiltViewModel class CheckoutViewModel @Inject constructor(",
      "    private val cartRepo: CartRepository,",
      "    private val orderRepo: OrderRepository,",
      "    private val handle: SavedStateHandle",
      ") : ViewModel() {",
      "    private val _ui = MutableStateFlow(CheckoutUi())",
      "    val ui: StateFlow<CheckoutUi> = _ui.asStateFlow()",
      "",
      "    var note: String",
      "        get() = handle[\"note\"] ?: \"\"",
      "        set(v) { handle[\"note\"] = v }            // sống qua process death",
      "",
      "    fun placeOrder() {",
      "        if (_ui.value.placing) return            // chặn double-click",
      "        viewModelScope.launch {",
      "            _ui.update { it.copy(placing = true, error = null) }",
      "            runCatching { orderRepo.place(cartRepo.current(), note) }",
      "                .onSuccess { code -> _ui.update { it.copy(placing = false, placedOrderCode = code) } }",
      "                .onFailure { e -> _ui.update { it.copy(placing = false, error = e.message) } }",
      "        }",
      "    }",
      "    fun onOrderNavigated() = _ui.update { it.copy(placedOrderCode = null) }",
      "}"
    ]},
    { id: "ui", label: "② Composable dùng ViewModel", lines: [
      "@Composable",
      "fun CheckoutRoute(onOrderPlaced: (String) -> Unit, vm: CheckoutViewModel = hiltViewModel()) {",
      "    val ui by vm.ui.collectAsStateWithLifecycle()",
      "",
      "    LaunchedEffect(ui.placedOrderCode) {",
      "        ui.placedOrderCode?.let { code ->",
      "            onOrderPlaced(code)",
      "            vm.onOrderNavigated()                  // báo đã xử lý",
      "        }",
      "    }",
      "    CheckoutScreen(ui = ui, onPlace = vm::placeOrder)",
      "}"
    ]},
    { id: "life", label: "③ Vì sao sống qua xoay", lines: [
      "// Rút gọn cơ chế",
      "class ComponentActivity : ViewModelStoreOwner {",
      "    override val viewModelStore: ViewModelStore",
      "    // Khi bị huỷ DO config change: store được giữ lại (NonConfigurationInstances)",
      "    // Khi bị huỷ THẬT (finish): viewModelStore.clear() → mọi VM.onCleared()",
      "}",
      "",
      "val vm = ViewModelProvider(owner)[CheckoutViewModel::class.java]",
      "// Activity mới → cùng store → cùng instance VM"
    ]},
    { id: "leak", label: "④ Đừng làm", lines: [
      "class BadViewModel(private val activity: Activity) : ViewModel()   // ❌ leak Activity cũ",
      "",
      "class BadViewModel2 : ViewModel() {",
      "    var onDone: (() -> Unit)? = null                               // ❌ lambda giữ composable/Activity",
      "    val bigList = mutableListOf<Product>()                         // ❌ state mutable lộ ra ngoài",
      "}",
      "",
      "// ✅ Nhận repository qua constructor (DI), lộ StateFlow chỉ-đọc, không giữ UI"
    ]}
  ],

  stageHtml: `
    <div class="node" id="act1"><div class="nl">📱 Activity #1</div><div class="ns">CheckoutRoute → hiltViewModel()</div></div>
    <div class="node" id="store"><div class="nl">🗄️ ViewModelStore</div><div class="ns">CheckoutViewModel đang placeOrder()</div></div>
    <div class="arrow" id="a1">↓ xoay màn hình: Activity #1 huỷ, store được giữ</div>
    <div class="node" id="act2"><div class="nl">📱 Activity #2</div><div class="ns">nhận lại đúng VM, request vẫn chạy</div></div>
    <div class="arrow" id="a2">↓ OS giết process ở nền</div>
    <div class="node" id="death"><div class="nl">💀 VM mất · SavedStateHandle khôi phục</div><div class="ns">note còn, giỏ tải lại từ repository</div></div>
  `,
  steps: [
    { title: "1 · UI state trong một data class", tab: "vm", highlight: [1, 2, 3, 4, 5, 13, 14], on: ["store"],
      desc: "Một object mô tả toàn bộ màn hình; MutableStateFlow private, StateFlow public." },
    { title: "2 · Event → coroutine → state mới", tab: "vm", highlight: [20, 21, 22, 23, 24, 25, 26], on: ["store"],
      desc: "placeOrder chạy trong viewModelScope; mỗi bước cập nhật state bằng copy. Không đụng tới UI trực tiếp." },
    { title: "3 · UI thu thập state", tab: "ui", highlight: [2, 3, 11], on: ["act1"],
      desc: "hiltViewModel() lấy VM theo owner hiện tại (entry navigation). UI chỉ render và gửi event." },
    { title: "4 · Sự kiện một lần dạng state", tab: "ui", highlight: [5, 6, 7, 8], on: ["act1"],
      desc: "Có placedOrderCode → điều hướng → báo VM xoá. Không mất sự kiện dù UI đang tạm không collect." },
    { title: "5 · Sống qua config change", tab: "life", highlight: [3, 4, 5, 8, 9], on: ["a1", "act2"],
      desc: "Store được Activity giữ qua config change nên request đặt hàng không bị gửi lại hay mất." },
    { title: "6 · Process death", tab: "vm", highlight: [11, 16, 17, 18], on: ["a2", "death"],
      desc: "VM mất, nhưng SavedStateHandle khôi phục giá trị nhỏ. Phần còn lại tải lại từ repository." },
    { title: "7 · Những điều cấm", tab: "leak", highlight: [1, 4, 5], on: ["store"],
      desc: "VM sống lâu hơn Activity: giữ Activity/Context/View là leak." }
  ],

  quiz: [
    { q: "Vì sao ViewModel sống qua xoay màn hình?", options: [
        "Là singleton toàn app", "ViewModelStore của owner được giữ lại qua config change, Activity mới nhận lại cùng instance", "Được serialize ra disk", "Chạy trên thread riêng"
      ], correct: 1, explanation: "Chỉ clear khi owner bị huỷ thật." },
    { q: "Khi process death, ViewModel thế nào?", options: [
        "Được khôi phục nguyên vẹn", "Mất — tạo mới; chỉ dữ liệu trong SavedStateHandle được khôi phục", "Lưu vào Room tự động", "Không bị ảnh hưởng"
      ], correct: 1, explanation: "Phân biệt config change và process death." },
    { q: "ViewModel giữ tham chiếu Activity gây gì?", options: [
        "Không sao", "Leak Activity cũ (và toàn bộ View/Context của nó) sau khi xoay", "Crash ngay", "Chạy nhanh hơn"
      ], correct: 1, explanation: "VM sống lâu hơn Activity." },
    { q: "viewModelScope bị huỷ khi?", options: [
        "Xoay màn hình", "onCleared() — owner bị huỷ thật", "App ra nền", "Mỗi recompose"
      ], correct: 1, explanation: "Request đang chạy dừng theo." },
    { q: "SavedStateHandle nên lưu gì?", options: [
        "Danh sách 5.000 sản phẩm", "Giá trị nhỏ cần sống qua process death: ID, query, tab", "Bitmap", "Token bí mật"
      ], correct: 1, explanation: "Bundle có giới hạn kích thước (TransactionTooLarge)." },
    { q: "Cách lộ state từ ViewModel được khuyến nghị?", options: [
        "public var MutableList", "StateFlow chỉ-đọc, giữ MutableStateFlow private", "LiveData public mutable", "Biến static"
      ], correct: 1, explanation: "Chỉ ViewModel được sửa state." },
    { q: "Hướng dẫn của Google khuyên xử lý sự kiện một lần (navigate sau khi lưu) thế nào?", options: [
        "Gọi navController từ ViewModel",
        "Biểu diễn thành state, UI xử lý rồi báo lại để xoá",
        "Dùng GlobalScope",
        "Dùng static callback"
      ], correct: 1, explanation: "Channel/SharedFlow cũng phổ biến nhưng có thể mất sự kiện." },
    { q: "Vì sao kiểm tra if (_ui.value.placing) return trong placeOrder?", options: [
        "Trang trí", "Chặn đặt hàng hai lần khi user bấm liên tục", "Bắt buộc bởi Compose", "Để test"
      ], correct: 1, explanation: "Idempotency phía server vẫn nên có." },
    { q: "Mỗi màn trong Navigation có ViewModel riêng vì?", options: [
        "Trùng hợp", "NavBackStackEntry là một ViewModelStoreOwner", "Hilt bắt buộc", "Activity tạo nhiều store"
      ], correct: 1, explanation: "Pop entry → VM của nó bị clear." }
  ]
});
