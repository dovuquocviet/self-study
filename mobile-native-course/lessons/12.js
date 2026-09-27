window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Bộ nhớ",
  title: "Memory leak: giữ Activity, retain cycle trong closure — tìm và sửa",
  subtitle: "Context bị giữ bởi static/listener · [weak self] · LeakCanary · Xcode Memory Graph & Instruments",

  theory: `
    <p>Leak trên mobile = <strong>object đáng lẽ đã chết nhưng còn bị giữ</strong>. Nguy hiểm nhất là giữ một <em>màn hình</em>: Activity/ViewController kéo theo cả cây view, bitmap, adapter — dễ vài chục MB.
    Mở/đóng màn đó 10 lần là app bị giết.</p>

    <p><strong>Android — mẫu leak kinh điển</strong> (GC chỉ dọn object không còn đường đi từ GC root; static field, thread đang chạy, singleton là root):</p>
    <ol>
      <li><strong>Static/singleton giữ Context của Activity</strong>: <code>object Analytics { lateinit var ctx: Context }</code> gán bằng Activity → Activity không bao giờ được thu hồi. Dùng <code>applicationContext</code>.</li>
      <li><strong>Listener/callback không huỷ đăng ký</strong>: đăng ký vào service sống lâu (location, event bus) mà không gỡ ở <code>onStop</code>/<code>onDestroy</code>.</li>
      <li><strong>Việc nền vượt vòng đời</strong>: coroutine trong <code>GlobalScope</code> hoặc thread tham chiếu tới view. Dùng <code>viewModelScope</code>/<code>lifecycleScope</code>.</li>
      <li><strong>ViewModel giữ View/Context của Activity</strong>: ViewModel sống lâu hơn Activity (qua xoay màn) → giữ Activity cũ. ViewModel không được tham chiếu tới View.</li>
      <li><strong>Fragment giữ binding sau onDestroyView</strong>: set <code>_binding = null</code>.</li>
    </ol>
    <p>Công cụ: <strong>LeakCanary</strong> (thêm dependency debug, tự phát hiện Activity/Fragment/ViewModel bị giữ sau khi huỷ và in <em>chuỗi tham chiếu</em>), Android Studio Memory Profiler (heap dump).</p>

    <p><strong>iOS — leak = retain cycle</strong></p>
    <ul>
      <li><strong>Closure bắt self mạnh</strong>: ViewController giữ closure (thuộc tính, timer, subscription Combine), closure dùng <code>self</code> → vòng. Sửa bằng <code>[weak self]</code>.</li>
      <li><strong>Delegate mạnh</strong>: khai báo <code>weak var delegate</code> (vì vậy protocol delegate phải <code>AnyObject</code>).</li>
      <li><code>weak</code>: tham chiếu không tăng đếm, tự thành <code>nil</code> khi object chết (luôn là Optional). <code>unowned</code>: không tăng đếm, không Optional — nếu object đã chết mà vẫn truy cập thì <strong>crash</strong>; chỉ dùng khi chắc chắn vòng đời.</li>
      <li>Closure của <code>Task { }</code> không lưu vào thuộc tính và kết thúc nhanh thì không gây vòng; nhưng Task chạy vô hạn (<code>for await</code> một stream) mà bắt self mạnh thì giữ self tới khi Task kết thúc.</li>
    </ul>
    <p>Công cụ: <strong>Xcode Debug Memory Graph</strong> (đánh dấu tím object bị leak), Instruments <em>Leaks</em> và <em>Allocations</em> (đánh dấu generation: mở/đóng màn nhiều lần, xem có object nào tăng mãi).</p>

    <div class="callout"><p>💡 Mẹo kiểm tra nhanh cả hai nền tảng: log trong <code>deinit</code> (Swift) hoặc dùng LeakCanary; mở rồi đóng một màn — nếu không thấy màn đó bị huỷ, bạn có leak.</p></div>
  `,

  codeTabs: [
    { id: "static", label: "① Android: giữ Activity", lines: [
      "object Analytics {",
      "    private lateinit var ctx: Context",
      "    fun init(c: Context) { ctx = c }          // SAI nếu truyền Activity",
      "}",
      "class HomeActivity : AppCompatActivity() {",
      "    override fun onCreate(s: Bundle?) {",
      "        super.onCreate(s)",
      "        Analytics.init(this)                   // leak cả Activity + cây view",
      "        // ĐÚNG: Analytics.init(applicationContext)",
      "    }",
      "}"
    ]},
    { id: "lc", label: "② LeakCanary báo", lines: [
      "// build.gradle.kts",
      "debugImplementation(\"com.squareup.leakcanary:leakcanary-android:2.14\")",
      "",
      "┬───",
      "│ GC Root: Static field",
      "├─ com.shop.Analytics class",
      "│    ↓ static Analytics.ctx",
      "╰→ com.shop.HomeActivity instance",
      "     Leaking: YES (Activity#mDestroyed is true)",
      "     Retaining 12.4 MB in 38201 objects"
    ]},
    { id: "cycle", label: "③ iOS: retain cycle", lines: [
      "final class CartViewController: UIViewController {",
      "    var onUpdate: (() -> Void)?",
      "    private var timer: Timer?",
      "",
      "    override func viewDidLoad() {",
      "        super.viewDidLoad()",
      "        onUpdate = { self.reload() }                 // SAI: self giữ closure, closure giữ self",
      "        onUpdate = { [weak self] in self?.reload() }  // ĐÚNG",
      "        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in",
      "            self?.refreshBadge()",
      "        }",
      "    }",
      "    deinit { timer?.invalidate(); print(\"CartVC deinit\") }",
      "}"
    ]},
    { id: "deleg", label: "④ Delegate & ViewModel", lines: [
      "// iOS: delegate phải weak",
      "protocol PaymentDelegate: AnyObject { func paid(orderId: String) }",
      "final class PaymentSheet { weak var delegate: PaymentDelegate? }",
      "",
      "// Android: ViewModel KHÔNG giữ View/Activity",
      "class CartVM(app: Application) : AndroidViewModel(app) {",
      "    // SAI: var textView: TextView? = null",
      "    val items = MutableStateFlow<List<Item>>(emptyList())   // UI tự quan sát",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="root"><div class="nl">🌳 GC root / chủ sở hữu</div><div class="ns">static, singleton, thread, timer</div></div>
      <div class="node" id="screen"><div class="nl">📱 Activity / ViewController</div><div class="ns">+ cây view, bitmap</div></div>
    </div>
    <div class="arrow" id="a1">↓ tham chiếu mạnh không được gỡ</div>
    <div class="node" id="leak"><div class="nl">🩸 Màn đã đóng nhưng còn trong RAM</div><div class="ns">mỗi lần mở lại + vài MB</div></div>
    <div class="arrow" id="a2">↓ phát hiện</div>
    <div class="node" id="tool"><div class="nl">🔍 LeakCanary / Memory Graph</div><div class="ns">in chuỗi tham chiếu</div></div>
    <div class="arrow" id="a3">↓ sửa</div>
    <div class="node" id="fix"><div class="nl">✂️ applicationContext · [weak self] · weak delegate</div><div class="ns">huỷ đăng ký theo vòng đời</div></div>
  `,
  steps: [
    { title: "1 · Singleton giữ Activity", tab: "static", highlight: [2, 3, 8], on: ["root", "screen", "a1"],
      desc: "Static field là GC root. Gán Activity vào đó → Activity sống mãi dù đã onDestroy." },
    { title: "2 · Hậu quả", tab: "lc", highlight: [9, 10], on: ["leak"],
      desc: "Mỗi Activity bị giữ kéo theo hàng chục nghìn object. Mở/đóng vài lần là ngốn hàng chục MB." },
    { title: "3 · LeakCanary chỉ đường", tab: "lc", highlight: [2, 5, 7, 8], on: ["a2", "tool"],
      desc: "Chuỗi tham chiếu từ GC root tới object rò rỉ cho biết chính xác dòng cần sửa." },
    { title: "4 · iOS: closure bắt self", tab: "cycle", highlight: [2, 7, 8], on: ["screen", "leak"],
      desc: "VC giữ closure, closure giữ VC → không ai về 0. <code>[weak self]</code> phá vòng." },
    { title: "5 · Timer & deinit", tab: "cycle", highlight: [9, 10, 13], on: ["tool"],
      desc: "Run loop giữ timer, timer giữ closure. Có weak self thì deinit chạy được và invalidate timer." },
    { title: "6 · Quy tắc sở hữu", tab: "deleg", highlight: [2, 3, 7, 8], on: ["a3", "fix"],
      desc: "Delegate luôn weak; ViewModel phơi bày state, không giữ View." }
  ],

  quiz: [
    { q: "Vì sao Activity bị giữ bởi một static field không được GC thu hồi?", options: [
        "Vì Activity là final", "Vì static field là GC root, còn đường tham chiếu mạnh tới Activity", "Vì Kotlin không có GC", "Vì Activity đang ở foreground"
      ], correct: 1, explanation: "GC tracing chỉ dọn object không còn đường đi từ root." },
    { q: "Khi singleton cần Context, nên truyền gì?", options: [
        "this (Activity)", "applicationContext", "Fragment", "View"
      ], correct: 1, explanation: "Application sống cùng process nên giữ nó không gây leak màn hình." },
    { q: "Trong Swift, 'onUpdate = { self.reload() }' với onUpdate là thuộc tính của self gây gì?", options: [
        "Không gì", "Retain cycle: self giữ closure, closure giữ self", "Crash ngay", "Lỗi biên dịch"
      ], correct: 1, explanation: "Dùng [weak self]." },
    { q: "Khác biệt giữa weak và unowned?", options: [
        "Không khác",
        "weak là Optional, tự thành nil khi object chết; unowned không Optional, truy cập sau khi object chết thì crash",
        "unowned tăng đếm tham chiếu", "weak chỉ dùng cho struct"
      ], correct: 1, explanation: "unowned chỉ dùng khi chắc chắn object sống lâu hơn tham chiếu." },
    { q: "Vì sao protocol delegate trong Swift thường khai báo ': AnyObject'?", options: [
        "Để nhanh hơn", "Để có thể khai báo weak var delegate (weak chỉ áp dụng cho kiểu class)", "Bắt buộc với mọi protocol", "Để dùng với struct"
      ], correct: 1, explanation: "Delegate mạnh là nguồn retain cycle phổ biến." },
    { q: "ViewModel Android giữ tham chiếu tới TextView của Activity gây gì?", options: [
        "Không sao", "Leak Activity cũ sau khi xoay màn vì ViewModel sống lâu hơn Activity", "UI cập nhật nhanh hơn", "Crash biên dịch"
      ], correct: 1, explanation: "ViewModel chỉ nên phơi state cho UI quan sát." },
    { q: "LeakCanary cung cấp thông tin quan trọng nhất nào?", options: [
        "FPS", "Chuỗi tham chiếu từ GC root tới object bị rò rỉ", "Số request mạng", "Kích thước APK"
      ], correct: 1, explanation: "Chuỗi đó chỉ ra đúng tham chiếu cần gỡ." },
    { q: "Công cụ Xcode nào cho thấy đồ thị object và đánh dấu leak?", options: [
        "Debug Memory Graph", "Interface Builder", "Asset Catalog", "TestFlight"
      ], correct: 0, explanation: "Kết hợp Instruments Leaks/Allocations để xác nhận." },
    { q: "Cách kiểm tra nhanh một màn iOS có leak không?", options: [
        "Xem kích thước IPA", "Đặt log trong deinit, mở rồi đóng màn và xem deinit có chạy", "Tắt ARC", "Xoay máy"
      ], correct: 1, explanation: "deinit không chạy = còn ai đó giữ." }
  ]
});
