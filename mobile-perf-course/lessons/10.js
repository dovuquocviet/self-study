window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Giao diện mượt",
  title: "Đừng chặn main thread: ANR, hang và cách đẩy việc ra nền",
  subtitle: "Coroutines & Dispatchers · StrictMode · Swift concurrency & @MainActor · Hangs instrument · JS thread trong RN",

  theory: `
    <p>Trong Spring, mỗi request có thread riêng; một request chậm không làm các request khác "đơ". Trên mobile, <strong>main thread là tài nguyên duy nhất phục vụ mọi tương tác</strong>.
    100 ms chặn ở đó = người dùng thấy app không phản hồi. Mức cảm nhận: &lt; 100 ms thấy tức thì; Apple gọi việc main thread bận từ <strong>250 ms</strong> trở lên là <em>hang</em>; Android báo ANR ở 5 s.</p>

    <p><strong>Thủ phạm thường gặp</strong></p>
    <ul>
      <li>I/O: đọc/ghi file, SharedPreferences/UserDefaults lớn, query SQLite/Room/Core Data, <strong>mạng đồng bộ</strong>.</li>
      <li>CPU: parse JSON lớn, decode ảnh lớn, sắp xếp/lọc hàng nghìn phần tử, regex phức tạp, tạo formatter mỗi lần.</li>
      <li>Chờ đợi: <code>lock</code>/<code>synchronized</code> mà thread khác đang giữ, <code>runBlocking</code> trên main, <code>DispatchSemaphore.wait()</code> trên main.</li>
      <li>Binder/IPC đồng bộ tới service hệ thống (Android) — trông vô hại nhưng có thể chờ lâu.</li>
    </ul>

    <p><strong>Android</strong>: dùng coroutines — <code>viewModelScope.launch</code> ở main, <code>withContext(Dispatchers.IO)</code> cho I/O, <code>Dispatchers.Default</code> cho CPU.
    Room mặc định <em>cấm</em> query trên main thread. Bật <strong>StrictMode</strong> ở bản debug để bắt I/O vô tình trên main thread.</p>

    <p><strong>iOS</strong>: Swift concurrency — UI code chạy trên <code>@MainActor</code>; việc nặng đặt trong hàm <code>nonisolated</code>/actor khác hoặc <code>Task.detached</code>.
    Lưu ý: gọi một hàm <code>async</code> <em>không tự động</em> đưa việc ra khỏi main thread — nếu hàm đó bị cô lập vào MainActor thì vẫn chạy trên main.
    Từ Swift 6.2, nếu bật chế độ <code>NonisolatedNonsendingByDefault</code> (mặc định trong project Xcode 26 mới), hàm <code>nonisolated async</code> chạy trên actor của bên gọi —
    khi đó cần đánh dấu <code>@concurrent</code> để chắc chắn chạy trên thread nền.
    Công cụ: <em>Hangs</em> instrument, <em>Thread Performance Checker</em> trong Diagnostics của scheme, và hang rate trong Xcode Organizer.</p>

    <p><strong>React Native</strong>: có hai "main thread" cần bảo vệ — UI thread (native) và JS thread. JS thread bận thì mọi <code>onPress</code>, <code>setState</code> phải xếp hàng.</p>
    <ul>
      <li>Chia nhỏ việc nặng (xử lý theo lô, nhường lượt bằng <code>setTimeout</code>/<code>requestIdleCallback</code>) hoặc để server làm sẵn.</li>
      <li>Việc thực sự nặng (mã hoá, xử lý ảnh, parse lớn) → native module chạy trên thread nền, hoặc runtime worklet riêng.</li>
      <li>Cẩn thận hàm native <strong>đồng bộ</strong> qua JSI/TurboModule: tiện nhưng chặn JS thread trong lúc chạy.</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc: <strong>main thread chỉ nhận kết quả và cập nhật UI</strong>. Nếu không chắc một hàm có chạm I/O không, hãy giả định là có và bật StrictMode/Thread Performance Checker để hệ thống báo cho bạn.</p></div>
  `,

  codeTabs: [
    { id: "kt", label: "① Kotlin coroutines", lines: [
      "class ProductViewModel(private val repo: ProductRepo) : ViewModel() {",
      "    val state = MutableStateFlow<UiState>(UiState.Loading)",
      "",
      "    fun load() = viewModelScope.launch {                 // Main",
      "        val raw = withContext(Dispatchers.IO) { repo.readCacheFile() }   // I/O",
      "        val items = withContext(Dispatchers.Default) { parseAndSort(raw) } // CPU",
      "        state.value = UiState.Ready(items)                 // quay lại Main",
      "    }",
      "}",
      "// ✗ Tránh: runBlocking { repo.fetch() } trên main thread"
    ]},
    { id: "strict", label: "② StrictMode", lines: [
      "class ShopApp : Application() {",
      "    override fun onCreate() {",
      "        super.onCreate()",
      "        if (BuildConfig.DEBUG) {",
      "            StrictMode.setThreadPolicy(",
      "                StrictMode.ThreadPolicy.Builder()",
      "                    .detectDiskReads().detectDiskWrites().detectNetwork()",
      "                    .penaltyLog()        // hoặc penaltyDeath() để fail nhanh",
      "                    .build())",
      "        }",
      "    }",
      "}"
    ]},
    { id: "swift", label: "③ Swift concurrency", lines: [
      "@MainActor",
      "final class CatalogModel: ObservableObject {",
      "    @Published var items: [Product] = []",
      "",
      "    func load() async {",
      "        let data = try? await api.products()                 // mạng: không chặn main",
      "        let parsed = await Self.decodeAndSort(data ?? Data()) // chạy ngoài MainActor",
      "        items = parsed                                        // cập nhật UI trên main",
      "    }",
      "",
      "    // Swift 6.2 + NonisolatedNonsendingByDefault: thêm @concurrent phía trước",
      "    nonisolated static func decodeAndSort(_ d: Data) async -> [Product] {",
      "        let list = (try? JSONDecoder().decode([Product].self, from: d)) ?? []",
      "        return list.sorted { $0.price < $1.price }",
      "    }",
      "}"
    ]},
    { id: "rn", label: "④ JS thread (RN)", lines: [
      "// ✗ Chặn JS thread ~400 ms với 20.000 sản phẩm",
      "const view = products.map(enrich).filter(matches).sort(byPrice);",
      "",
      "// ✓ Cách 1: để server lọc/sắp xếp + phân trang",
      "// ✓ Cách 2: chia lô, nhường lượt cho sự kiện người dùng",
      "async function processInChunks(items, size = 500) {",
      "  const out = [];",
      "  for (let i = 0; i < items.length; i += size) {",
      "    out.push(...items.slice(i, i + size).map(enrich));",
      "    await new Promise(r => setTimeout(r, 0));   // nhường JS thread",
      "  }",
      "  return out;",
      "}",
      "// ✓ Cách 3: native module chạy trên thread nền, trả kết quả qua Promise"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ui"><div class="nl">🧵 Main / UI thread</div><div class="ns">input · layout · vẽ · cập nhật state</div></div>
    <div class="arrow" id="a1">↓ đẩy việc nặng ra</div>
    <div class="row">
      <div class="node" id="io"><div class="nl">💾 I/O</div><div class="ns">Dispatchers.IO · async/await</div></div>
      <div class="node" id="cpu"><div class="nl">🧮 CPU</div><div class="ns">Dispatchers.Default · nonisolated</div></div>
      <div class="node" id="js"><div class="nl">🟨 JS thread</div><div class="ns">chia lô · server · native</div></div>
    </div>
    <div class="arrow" id="a2">↑ chỉ trả kết quả về main</div>
    <div class="node" id="guard"><div class="nl">🚨 Lưới an toàn</div><div class="ns">StrictMode · Thread Performance Checker · Hangs</div></div>
  `,
  steps: [
    { title: "1 · Mỗi loại việc một dispatcher", tab: "kt", highlight: [4, 5, 6, 7], on: ["ui", "a1", "io", "cpu"],
      desc: "IO cho chờ đĩa/mạng (pool lớn), Default cho tính toán (số thread ≈ số core). Kết quả quay về Main để cập nhật state." },
    { title: "2 · Không runBlocking trên main", tab: "kt", highlight: [10], on: ["ui"],
      desc: "runBlocking chặn thread hiện tại tới khi coroutine xong — trên main thread là công thức tạo ANR." },
    { title: "3 · StrictMode bắt lỗi sớm", tab: "strict", highlight: [4, 5, 7, 8], on: ["guard"],
      desc: "Mọi lần đọc/ghi đĩa hay gọi mạng trên main thread bị log (hoặc crash) ngay trong lúc phát triển." },
    { title: "4 · Swift: rời MainActor khi làm nặng", tab: "swift", highlight: [1, 7, 8, 11, 12], on: ["cpu", "a2"],
      desc: "Model gắn @MainActor; hàm decode khai báo nonisolated async nên chạy trên executor chung, không chiếm main." },
    { title: "5 · RN: giải phóng JS thread", tab: "rn", highlight: [2, 4, 6, 10, 14], on: ["js"],
      desc: "Chia lô để onPress không phải chờ 400 ms. Tốt nhất là đừng xử lý 20.000 phần tử trên client." }
  ],

  quiz: [
    { q: "Android báo ANR khi main thread không xử lý input trong bao lâu?", options: [
        "100 ms", "1 s", "5 s", "30 s"
      ], correct: 2, explanation: "Input dispatch timeout 5 s." },
    { q: "Apple coi main thread bận liên tục từ khoảng bao lâu là 'hang'?", options: [
        "16 ms", "250 ms", "5 s", "20 s"
      ], correct: 1, explanation: "Hangs instrument và Organizer dùng mốc 250 ms." },
    { q: "Dispatcher nào phù hợp cho parse và sắp xếp danh sách lớn trong Kotlin?", options: [
        "Dispatchers.Main", "Dispatchers.IO", "Dispatchers.Default", "Dispatchers.Unconfined"
      ], correct: 2, explanation: "Default dành cho việc tốn CPU; IO dành cho chờ I/O." },
    { q: "StrictMode ThreadPolicy dùng để làm gì?", options: [
        "Tăng tốc app",
        "Phát hiện I/O đĩa, mạng vô tình chạy trên main thread trong lúc phát triển",
        "Mã hoá dữ liệu",
        "Giới hạn RAM"
      ], correct: 1, explanation: "Chỉ bật ở debug." },
    { q: "Trong Swift, gọi một hàm async có chắc chắn chạy ngoài main thread không?", options: [
        "Có, luôn luôn",
        "Không — nếu hàm bị cô lập vào MainActor thì vẫn chạy trên main; cần nonisolated/actor khác/Task.detached",
        "Chỉ trên iOS 17",
        "Chỉ khi dùng GCD"
      ], correct: 1, explanation: "async là về khả năng tạm dừng, không phải về thread." },
    { q: "Trong RN, JS thread bận 400 ms thì điều gì xảy ra?", options: [
        "Không ảnh hưởng gì",
        "onPress, setState và cập nhật UI từ JS phải chờ → app có cảm giác đơ",
        "App crash",
        "GPU ngừng vẽ"
      ], correct: 1, explanation: "Mọi logic React xếp hàng trên JS thread." },
    { q: "Rủi ro của hàm native đồng bộ gọi qua JSI là gì?", options: [
        "Không có rủi ro",
        "Chặn JS thread trong suốt thời gian hàm chạy",
        "Làm tăng APK size",
        "Không chạy được trên iOS"
      ], correct: 1, explanation: "Chỉ nên đồng bộ cho việc rất nhanh." },
    { q: "Room database mặc định xử lý query trên main thread thế nào?", options: [
        "Cho phép bình thường",
        "Ném exception — cấm query trên main thread trừ khi bật allowMainThreadQueries()",
        "Tự chuyển sang background",
        "Bỏ qua query"
      ], correct: 1, explanation: "Thiết kế để buộc dev đưa query ra khỏi main." },
    { q: "Cách nào KHÔNG giúp giải phóng main thread?", options: [
        "withContext(Dispatchers.IO) cho đọc file",
        "DispatchSemaphore.wait() trên main để chờ kết quả mạng",
        "Để server lọc sẵn dữ liệu",
        "Decode JSON trong hàm nonisolated"
      ], correct: 1, explanation: "Chờ đồng bộ trên main vẫn là chặn main." }
  ]
});
