window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Tài nguyên: bộ nhớ, mạng, pin, dung lượng",
  title: "Memory leak & OOM: GC, ARC và JS heap",
  subtitle: "Leak = còn tham chiếu nhưng không dùng · LeakCanary · retain cycle & [weak self] · jetsam · listener/timer quên huỷ trong RN",

  theory: `
    <p>Java có GC nên bạn quen nghĩ "không có leak". Sai: GC chỉ thu hồi object <strong>không còn ai tham chiếu</strong>. Leak trong ngôn ngữ có GC = object không còn dùng nhưng
    <em>vẫn còn đường tham chiếu từ gốc</em> (static field, singleton, listener đã đăng ký...). Trên server, heap vài GB che giấu leak lâu; trên điện thoại, app nền có thể bị giới hạn vài trăm MB.</p>

    <table>
      <tr><th></th><th>Android (ART)</th><th>iOS (ARC)</th><th>RN (Hermes)</th></tr>
      <tr><td>Cơ chế</td><td>GC tracing</td><td>Đếm tham chiếu, giải phóng ngay khi về 0; <strong>không</strong> tự phá vòng tham chiếu</td><td>GC của Hermes cho JS heap + bộ nhớ native của view/ảnh</td></tr>
      <tr><td>Leak kinh điển</td><td>Giữ <code>Activity</code>/<code>View</code> qua static, singleton, callback chưa huỷ, coroutine <code>GlobalScope</code></td><td><strong>Retain cycle</strong>: A giữ closure, closure giữ A (<code>self</code>)</td><td>Listener/subscription/timer không huỷ khi unmount, cache toàn cục phình ra</td></tr>
      <tr><td>Công cụ</td><td>LeakCanary, Memory Profiler (heap dump)</td><td>Memory Graph, Leaks, Allocations</td><td>DevTools → Memory (heap snapshot, so sánh)</td></tr>
      <tr><td>Khi hết bộ nhớ</td><td><code>OutOfMemoryError</code> (Java heap có giới hạn theo máy) hoặc bị Low Memory Killer kill khi ở nền</td><td><strong>Jetsam</strong> kill app (không có crash log thông thường; Organizer/MetricKit báo)</td><td>Như nền tảng chứa nó</td></tr>
    </table>

    <p><strong>Vì sao giữ Activity là thảm hoạ?</strong> Activity giữ cả cây View, và View giữ Bitmap. Xoay màn hình tạo Activity mới; nếu cái cũ bị giữ lại, mỗi lần xoay mất thêm vài MB tới chục MB.</p>

    <p><strong>LeakCanary</strong>: chỉ cần thêm dependency ở debug. Nó theo dõi Activity, Fragment, View, ViewModel... đã bị huỷ; nếu sau 5 giây (và sau GC) vẫn còn sống,
    nó dump heap và in ra <em>leak trace</em> — chuỗi tham chiếu từ gốc tới object bị rò.</p>

    <p><strong>iOS — phá retain cycle</strong>: closure lưu vào thuộc tính mà dùng <code>self</code> → dùng <code>[weak self]</code>; delegate khai báo <code>weak var</code>;
    <code>Timer</code> giữ target mạnh → invalidate khi rời màn; observer dạng block của NotificationCenter phải remove.</p>

    <p><strong>Phản ứng khi hệ thống thiếu bộ nhớ</strong>: Android <code>onTrimMemory(level)</code>, iOS <code>didReceiveMemoryWarning</code> / <code>UIApplication.didReceiveMemoryWarningNotification</code> — xoá cache ảnh trong bộ nhớ, dữ liệu có thể tải lại.</p>

    <div class="callout"><p>💡 Cách tìm leak không cần đoán: <strong>lặp một thao tác N lần</strong> (mở/đóng màn chi tiết 10 lần), ép GC, rồi xem bộ nhớ có trở về mức ban đầu không.
    Không trở về = có thứ bị giữ lại. So sánh heap snapshot trước/sau để thấy object nào tăng.</p></div>
  `,

  codeTabs: [
    { id: "android", label: "① Leak Android", lines: [
      "object CartBus {                                      // singleton sống cả đời process",
      "    val listeners = mutableListOf<(Cart) -> Unit>()",
      "}",
      "",
      "class CartActivity : AppCompatActivity() {",
      "    private val onCart: (Cart) -> Unit = { render(it) }  // lambda giữ Activity",
      "    override fun onStart() { super.onStart(); CartBus.listeners += onCart }",
      "    // ✗ quên onStop → CartBus giữ Activity mãi mãi (cả cây View, Bitmap)",
      "    override fun onStop() { CartBus.listeners -= onCart; super.onStop() }  // ✓",
      "}",
      "",
      "// ✗ GlobalScope.launch { ... this@CartActivity ... }  → dùng lifecycleScope/viewModelScope"
    ]},
    { id: "lc", label: "② LeakCanary", lines: [
      "// app/build.gradle.kts",
      "dependencies {",
      "    debugImplementation(\"com.squareup.leakcanary:leakcanary-android:2.14\")",
      "}",
      "",
      "// Leak trace in ra (rút gọn):",
      "┬ GC Root: static CartBus.INSTANCE",
      "├─ CartBus.listeners  ArrayList",
      "├─ CartActivity$onCart$1  (lambda)",
      "╰→ CartActivity  instance LEAKING (onDestroy() đã được gọi)"
    ]},
    { id: "ios", label: "③ Retain cycle iOS", lines: [
      "final class ProductDetailVC: UIViewController {",
      "    private let viewModel = DetailViewModel()",
      "",
      "    override func viewDidLoad() {",
      "        super.viewDidLoad()",
      "        // ✗ VC giữ viewModel, viewModel giữ closure, closure giữ VC (self)",
      "        // viewModel.onUpdate = { self.render($0) }",
      "        viewModel.onUpdate = { [weak self] state in    // ✓ phá vòng",
      "            self?.render(state)",
      "        }",
      "    }",
      "    deinit { print(\"ProductDetailVC deinit\") }         // không in ra = còn bị giữ",
      "}",
      "protocol CartDelegate: AnyObject {}",
      "final class CartView { weak var delegate: CartDelegate? }  // delegate luôn weak"
    ]},
    { id: "rn", label: "④ Leak trong RN", lines: [
      "useEffect(() => {",
      "  const sub = AppState.addEventListener('change', onAppState);",
      "  const timer = setInterval(pollCart, 5000);",
      "  const unsub = cartStore.subscribe(onCartChange);",
      "  return () => {             // ✓ cleanup khi unmount",
      "    sub.remove();",
      "    clearInterval(timer);",
      "    unsub();",
      "  };",
      "}, []);",
      "",
      "// ✗ cache toàn cục không giới hạn: const imageCache = {}  → dùng LRU có giới hạn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="root"><div class="nl">🌳 GC root / chủ sở hữu mạnh</div><div class="ns">static · singleton · thread đang chạy</div></div>
    <div class="arrow" id="a1">↓ tham chiếu bị quên huỷ</div>
    <div class="node" id="ref"><div class="nl">🔗 Listener · closure · timer</div><div class="ns">giữ self / Activity</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="obj"><div class="nl">📦 Activity / ViewController đã đóng</div><div class="ns">+ cây view + bitmap</div></div>
    <div class="arrow" id="a3">↓ lặp N lần</div>
    <div class="node" id="oom"><div class="nl">💥 OOM / jetsam</div><div class="ns">bị hệ thống kill</div></div>
  `,
  steps: [
    { title: "1 · Singleton giữ listener", tab: "android", highlight: [1, 2, 6, 7, 8], on: ["root", "a1", "ref"],
      desc: "Lambda tham chiếu Activity; singleton giữ lambda. Activity đóng rồi vẫn có đường từ gốc tới nó." },
    { title: "2 · Huỷ đăng ký đối xứng", tab: "android", highlight: [9, 12], on: ["ref"],
      desc: "Đăng ký ở onStart thì huỷ ở onStop. Coroutine dùng scope gắn vòng đời thay vì GlobalScope." },
    { title: "3 · LeakCanary chỉ đường", tab: "lc", highlight: [3, 7, 8, 9, 10], on: ["obj"],
      desc: "Leak trace đi từ GC root tới object bị rò — đọc từ trên xuống là thấy mắt xích cần cắt." },
    { title: "4 · iOS: retain cycle", tab: "ios", highlight: [7, 8, 9, 12, 15], on: ["ref", "a2", "obj"],
      desc: "ARC không phá vòng. [weak self] cắt một cạnh; deinit không in ra là dấu hiệu còn bị giữ." },
    { title: "5 · RN: cleanup trong useEffect", tab: "rn", highlight: [2, 3, 4, 5, 6, 7, 8, 12], on: ["ref"],
      desc: "Mọi subscription/timer tạo trong effect phải được huỷ trong hàm cleanup." },
    { title: "6 · Tích tụ → bị kill", tab: "rn", highlight: [12], on: ["a3", "oom"],
      desc: "Mỗi lần mở màn rò vài MB; sau vài chục lần app bị jetsam/OOM — người dùng thấy app 'tự tắt'." }
  ],

  quiz: [
    { q: "Trong ngôn ngữ có GC, memory leak nghĩa là gì?", options: [
        "Không thể xảy ra",
        "Object không còn dùng nhưng vẫn còn đường tham chiếu từ GC root nên không được thu hồi",
        "Quên gọi free()",
        "GC chạy quá chậm"
      ], correct: 1, explanation: "GC chỉ thu object không còn tới được từ gốc." },
    { q: "Vì sao ARC không tự giải phóng hai object tham chiếu mạnh lẫn nhau?", options: [
        "Vì ARC có lỗi",
        "Vì ARC đếm tham chiếu; trong vòng tham chiếu, bộ đếm không bao giờ về 0",
        "Vì Swift không có ARC",
        "Vì chúng ở main thread"
      ], correct: 1, explanation: "Cần weak/unowned để phá vòng." },
    { q: "Closure lưu vào thuộc tính của ViewModel, bên trong gọi self.render(). Cách sửa?", options: [
        "Dùng [weak self] trong capture list",
        "Đổi sang struct",
        "Gọi deinit thủ công",
        "Dùng DispatchQueue.main"
      ], correct: 0, explanation: "Cắt tham chiếu mạnh từ closure về VC." },
    { q: "LeakCanary phát hiện leak thế nào?", options: [
        "Đọc source code",
        "Theo dõi object đã bị huỷ (Activity, Fragment, ViewModel...), nếu sau GC vẫn còn sống thì dump heap và tìm đường tham chiếu",
        "Đo nhiệt độ máy",
        "Chạy trên server"
      ], correct: 1, explanation: "Kết quả là leak trace từ GC root." },
    { q: "'Jetsam' trên iOS là gì?", options: [
        "Một thư viện ảnh",
        "Cơ chế hệ thống kill app khi dùng quá giới hạn bộ nhớ",
        "Một loại animation",
        "Crash do Swift"
      ], correct: 1, explanation: "Không có crash log thông thường; xem Organizer/MetricKit." },
    { q: "Trong RN, thiếu gì trong useEffect sau gây leak: const t = setInterval(poll, 5000)?", options: [
        "Dependency array",
        "Hàm cleanup trả về clearInterval(t)",
        "async",
        "useMemo"
      ], correct: 1, explanation: "Không huỷ thì interval chạy mãi và giữ closure." },
    { q: "Vì sao leak Activity đặc biệt tốn bộ nhớ?", options: [
        "Activity rất nhỏ",
        "Activity giữ cả cây View, và View có thể giữ Bitmap lớn",
        "Vì Activity chạy trên GPU",
        "Không tốn"
      ], correct: 1, explanation: "Mỗi lần xoay màn/mở lại có thể mất vài MB." },
    { q: "Cách đáng tin để phát hiện leak khi không biết nó ở đâu?", options: [
        "Đọc code từng dòng",
        "Lặp một thao tác N lần, ép GC, xem bộ nhớ có về mức cũ không; so sánh heap snapshot",
        "Tăng heap",
        "Tắt ảnh"
      ], correct: 1, explanation: "Bộ nhớ tăng dần theo số lần lặp là dấu hiệu rõ." },
    { q: "Khi nhận onTrimMemory / didReceiveMemoryWarning, app nên làm gì?", options: [
        "Bỏ qua",
        "Giải phóng cache có thể tạo lại (ảnh trong bộ nhớ, dữ liệu tạm)",
        "Tự crash",
        "Tải thêm dữ liệu"
      ], correct: 1, explanation: "Giảm nguy cơ bị kill." }
  ]
});
