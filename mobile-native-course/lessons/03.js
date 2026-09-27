window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Hệ điều hành & vòng đời",
  title: "Android: vòng đời Activity, Fragment và ViewModel",
  subtitle: "onCreate → onResume → onPause → onStop → onDestroy · xoay màn hình tạo lại Activity · ViewModel sống sót",

  theory: `
    <p><strong>Activity</strong> là một màn hình mà OS quản lý. Bạn không <code>new</code> nó — OS tạo, gọi các callback, và huỷ nó. Giống bean Spring có <code>@PostConstruct</code>/<code>@PreDestroy</code>,
    nhưng số lần gọi nhiều hơn nhiều và không do bạn quyết định.</p>

    <table>
      <tr><th>Callback</th><th>Khi nào</th><th>Nên làm</th></tr>
      <tr><td><code>onCreate</code></td><td>Tạo Activity (kể cả tạo lại)</td><td>setContent/inflate UI, lấy ViewModel, đọc savedInstanceState</td></tr>
      <tr><td><code>onStart</code></td><td>Sắp hiển thị</td><td>Bắt đầu quan sát dữ liệu hiển thị</td></tr>
      <tr><td><code>onResume</code></td><td>Lên trên cùng, nhận input</td><td>Camera, cảm biến, animation</td></tr>
      <tr><td><code>onPause</code></td><td>Mất focus (dialog hệ thống, multi-window)</td><td>Dừng thứ tốn tài nguyên; phải <strong>nhanh</strong></td></tr>
      <tr><td><code>onStop</code></td><td>Không còn nhìn thấy</td><td>Dừng cập nhật UI, lưu dữ liệu</td></tr>
      <tr><td><code>onDestroy</code></td><td>Bị huỷ: finish() hoặc thay đổi cấu hình</td><td>Dọn dẹp — nhưng <em>không được tin là sẽ được gọi</em> (process death)</td></tr>
    </table>

    <p><strong>Configuration change</strong>: xoay màn hình, đổi ngôn ngữ, đổi dark mode, gập máy… mặc định OS <em>huỷ và tạo lại Activity</em> để nạp resource phù hợp.
    Mọi biến trong Activity mất. Đó là lý do có <strong>ViewModel</strong>: nó nằm trong <code>ViewModelStore</code> được giữ lại qua lần tạo lại, và chỉ bị xoá (<code>onCleared</code>) khi màn hình kết thúc thật.</p>

    <table>
      <tr><th>Sự kiện</th><th>Biến trong Activity</th><th>ViewModel</th><th>SavedStateHandle</th></tr>
      <tr><td>Xoay màn hình</td><td>Mất</td><td>Còn</td><td>Còn</td></tr>
      <tr><td>Process death</td><td>Mất</td><td><strong>Mất</strong></td><td>Còn (được OS lưu)</td></tr>
      <tr><td>Người dùng bấm Back thoát màn</td><td>Mất</td><td>Mất</td><td>Mất</td></tr>
    </table>

    <p><strong>Fragment</strong> là "mảnh màn hình" có vòng đời riêng lồng trong Activity, và có thêm vòng đời <em>view</em> (<code>onCreateView</code>…<code>onDestroyView</code>) ngắn hơn vòng đời Fragment —
    khi bị đẩy vào back stack, view bị huỷ nhưng Fragment vẫn còn. Vì vậy quan sát dữ liệu phải gắn với <code>viewLifecycleOwner</code>, không phải <code>this</code>.
    App mới viết bằng Jetpack Compose thường chỉ có <strong>một Activity</strong>, các màn là composable (bài 04, 13).</p>

    <div class="callout"><p>💡 <code>lifecycleScope</code>/<code>repeatOnLifecycle(STARTED)</code> tự huỷ coroutine khi Lifecycle đi qua ngưỡng — cách chuẩn để không cập nhật UI đã chết và không rò rỉ bộ nhớ.</p></div>
  `,

  codeTabs: [
    { id: "act", label: "① Activity", lines: [
      "class ProductActivity : ComponentActivity() {",
      "    private val vm: ProductViewModel by viewModels()",
      "",
      "    override fun onCreate(savedInstanceState: Bundle?) {",
      "        super.onCreate(savedInstanceState)",
      "        setContent { ProductScreen(vm) }",
      "        Log.d(\"LC\", \"onCreate, restored=${savedInstanceState != null}\")",
      "    }",
      "    override fun onStart()   { super.onStart();   Log.d(\"LC\", \"onStart\") }",
      "    override fun onResume()  { super.onResume();  Log.d(\"LC\", \"onResume\") }",
      "    override fun onPause()   { super.onPause();   Log.d(\"LC\", \"onPause\") }",
      "    override fun onStop()    { super.onStop();    Log.d(\"LC\", \"onStop\") }",
      "    override fun onDestroy() { super.onDestroy(); Log.d(\"LC\", \"onDestroy\") }",
      "}"
    ]},
    { id: "rot", label: "② Log khi xoay màn", lines: [
      "D/LC: onCreate, restored=false",
      "D/LC: onStart",
      "D/LC: onResume",
      "# --- xoay màn hình ---",
      "D/LC: onPause",
      "D/LC: onStop",
      "D/LC: onDestroy        # Activity cũ bị huỷ",
      "D/LC: onCreate, restored=true   # Activity MỚI, cùng ViewModel cũ",
      "D/LC: onStart",
      "D/LC: onResume"
    ]},
    { id: "vm", label: "③ ViewModel + SavedState", lines: [
      "class ProductViewModel(",
      "    private val repo: ProductRepo,",
      "    private val state: SavedStateHandle",
      ") : ViewModel() {",
      "    val qty = state.getStateFlow(\"qty\", 1)   // sống qua process death",
      "    val product = MutableStateFlow<Product?>(null)",
      "",
      "    init { viewModelScope.launch { product.value = repo.load(state[\"id\"]!!) } }",
      "    fun inc() { state[\"qty\"] = qty.value + 1 }",
      "",
      "    override fun onCleared() { /* màn hình kết thúc thật */ }",
      "}"
    ]},
    { id: "frag", label: "④ Fragment: view lifecycle", lines: [
      "class CartFragment : Fragment(R.layout.cart) {",
      "    override fun onViewCreated(view: View, s: Bundle?) {",
      "        viewLifecycleOwner.lifecycleScope.launch {",
      "            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {",
      "                vm.items.collect { adapter.submitList(it) }",
      "            }",
      "        }",
      "    }",
      "    // SAI: lifecycleScope (của Fragment) -> vẫn collect khi view đã bị huỷ",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="c"><div class="nl">onCreate</div><div class="ns">dựng UI, lấy ViewModel</div></div>
    <div class="arrow" id="a1">↓ onStart → onResume</div>
    <div class="node" id="r"><div class="nl">🟢 Resumed</div><div class="ns">đang tương tác</div></div>
    <div class="arrow" id="a2">↓ xoay màn / đổi dark mode</div>
    <div class="node" id="d"><div class="nl">onPause → onStop → onDestroy</div><div class="ns">Activity cũ bị huỷ</div></div>
    <div class="arrow" id="a3">↓ Activity mới</div>
    <div class="row">
      <div class="node" id="vm"><div class="nl">🧠 ViewModel</div><div class="ns">được giữ lại, trả cho Activity mới</div></div>
      <div class="node" id="ss"><div class="nl">💾 SavedStateHandle</div><div class="ns">sống cả qua process death</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Tạo Activity", tab: "act", highlight: [2, 4, 6, 7], on: ["c"],
      desc: "OS tạo Activity và gọi onCreate. <code>by viewModels()</code> lấy ViewModel từ ViewModelStore (tạo mới nếu chưa có)." },
    { title: "2 · Hiển thị & tương tác", tab: "rot", highlight: [1, 2, 3], on: ["a1", "r"],
      desc: "onStart → onResume: màn ở trên cùng, nhận input." },
    { title: "3 · Xoay màn hình", tab: "rot", highlight: [4, 5, 6, 7], on: ["a2", "d"],
      desc: "Configuration change: Activity cũ bị huỷ hoàn toàn. Biến thành viên mất." },
    { title: "4 · Activity mới, ViewModel cũ", tab: "rot", highlight: [8], on: ["a3", "vm"],
      desc: "Activity mới nhận lại đúng instance ViewModel cũ — dữ liệu đã tải không phải tải lại." },
    { title: "5 · SavedStateHandle cho process death", tab: "vm", highlight: [3, 5, 9], on: ["ss"],
      desc: "ViewModel không sống qua process death; SavedStateHandle thì có, vì OS lưu Bundle của nó." },
    { title: "6 · Fragment: dùng viewLifecycleOwner", tab: "frag", highlight: [3, 4, 5, 9], on: ["r"],
      desc: "View của Fragment có vòng đời ngắn hơn Fragment. Collect theo <code>viewLifecycleOwner</code> để không đụng vào view đã huỷ." }
  ],

  quiz: [
    { q: "Xoay màn hình (mặc định) thì Activity thế nào?", options: [
        "Giữ nguyên, chỉ vẽ lại", "Bị huỷ và tạo lại instance mới", "Bị đưa vào nền", "Process bị giết"
      ], correct: 1, explanation: "Configuration change mặc định huỷ và tạo lại Activity để nạp resource phù hợp." },
    { q: "ViewModel có sống qua process death không?", options: [
        "Có", "Không; chỉ dữ liệu trong SavedStateHandle được khôi phục", "Có nếu là singleton", "Chỉ trên Android 14+"
      ], correct: 1, explanation: "ViewModelStore nằm trong RAM của process." },
    { q: "Callback nào không được tin là chắc chắn sẽ được gọi?", options: [
        "onCreate", "onResume", "onDestroy", "onStart"
      ], correct: 2, explanation: "Process bị lmkd giết thì không có onDestroy." },
    { q: "onPause nên làm việc gì?", options: [
        "Gọi API nặng đồng bộ", "Việc nhẹ và nhanh: dừng camera, animation", "Ghi 50MB ra disk", "Không làm gì bao giờ"
      ], correct: 1, explanation: "onPause chạy trên main thread và chặn màn tiếp theo hiện lên." },
    { q: "Trong Fragment, vì sao nên collect Flow bằng viewLifecycleOwner thay vì this?", options: [
        "Nhanh hơn",
        "View của Fragment có thể bị huỷ (vào back stack) trong khi Fragment còn sống; collect theo Fragment sẽ đụng view chết",
        "Bắt buộc bởi compiler",
        "Để chạy trên background thread"
      ], correct: 1, explanation: "onDestroyView xảy ra trước onDestroy của Fragment." },
    { q: "ViewModel.onCleared() được gọi khi nào?", options: [
        "Mỗi lần xoay màn", "Khi màn hình (owner) kết thúc thật, vd người dùng bấm Back thoát", "Mỗi lần onStop", "Không bao giờ"
      ], correct: 1, explanation: "Khi owner bị finish chứ không phải tạo lại do cấu hình." },
    { q: "repeatOnLifecycle(Lifecycle.State.STARTED) làm gì?", options: [
        "Chạy block một lần duy nhất",
        "Chạy block khi lifecycle ≥ STARTED và huỷ khi xuống dưới STARTED, lặp lại mỗi lần vào lại",
        "Chạy block trên thread IO",
        "Ép Activity luôn ở STARTED"
      ], correct: 1, explanation: "Nhờ đó không cập nhật UI khi app ở nền." },
    { q: "Dữ liệu nào nên giữ trong SavedStateHandle?", options: [
        "Danh sách 5.000 sản phẩm", "id sản phẩm, số lượng đang chọn", "Bitmap ảnh", "Kết nối socket"
      ], correct: 1, explanation: "Dữ liệu nhỏ đủ để dựng lại màn; dữ liệu lớn lấy lại từ repo." },
    { q: "Tương đương gần nhất của onCreate/onDestroy trong Spring là gì, và khác ở đâu?", options: [
        "Giống hệt @PostConstruct/@PreDestroy",
        "Giống @PostConstruct/@PreDestroy nhưng Activity có thể bị tạo lại nhiều lần và onDestroy có thể không chạy",
        "Giống @Scheduled",
        "Không có gì tương đương"
      ], correct: 1, explanation: "Vòng đời do OS điều khiển và thay đổi thường xuyên." }
  ]
});
