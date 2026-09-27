window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Bộ nhớ",
  title: "Bộ nhớ: GC trên Android, ARC trên iOS, và giới hạn RAM mỗi app",
  subtitle: "ART heap & memoryClass · concurrent GC · Bitmap · retain count · struct vs class · jetsam",

  theory: `
    <p>Bạn quen với JVM: heap <code>-Xmx</code>, GC tự dọn, OOM thì tăng RAM máy chủ. Trên mobile: không tăng được RAM, và OS giết app <em>trước khi</em> app kịp OOM.</p>

    <p><strong>Android — ART có GC, giống JVM</strong></p>
    <ul>
      <li>Mỗi app có trần heap Java/Kotlin, xem bằng <code>ActivityManager.memoryClass</code> (MB, tuỳ máy — vài trăm MB trên máy hiện đại). <code>android:largeHeap="true"</code> nâng trần nhưng chỉ nên dùng khi thật cần.</li>
      <li>GC của ART chạy <strong>concurrent</strong> (song song với app), pause rất ngắn; nhưng cấp phát liên tục trong vòng lặp vẽ (<code>onDraw</code> tạo object mới mỗi frame) vẫn gây GC dồn dập → giật.</li>
      <li><strong>Bitmap</strong> là "kẻ ăn RAM" số 1: ảnh 4000×3000 ARGB_8888 = 4000 × 3000 × 4 byte ≈ <strong>48 MB</strong> dù file JPEG chỉ 3 MB. Từ Android 8, pixel của Bitmap nằm ở native heap, nhưng vẫn tính vào tổng RAM của process.</li>
      <li>Vượt trần heap → <code>OutOfMemoryError</code>; tổng RAM hệ thống cạn → lmkd giết process (bài 02).</li>
    </ul>

    <p><strong>iOS — ARC (Automatic Reference Counting), không có GC</strong></p>
    <ul>
      <li>Compiler tự chèn <code>retain</code>/<code>release</code> quanh mỗi tham chiếu tới object (class). Khi đếm về 0, object bị huỷ <em>ngay lập tức</em>, <code>deinit</code> chạy — tất định, không có pause GC.</li>
      <li>Giá phải trả: <strong>retain cycle</strong>. A giữ B, B giữ A → đếm không bao giờ về 0 → rò rỉ vĩnh viễn. GC của JVM/ART dò từ root nên dọn được vòng tròn; ARC thì không. Giải pháp: <code>weak</code>/<code>unowned</code> (bài 12).</li>
      <li><code>struct</code>/<code>enum</code> là <em>value type</em>: sao chép khi gán, thường không cần đếm tham chiếu (Array, String, Dictionary dùng copy-on-write bên trong). SwiftUI và Swift hiện đại ưu tiên struct.</li>
      <li>Không có trần heap cố định công khai; hệ thống <strong>jetsam</strong> giết app vượt ngưỡng theo loại máy. Trước đó app nhận <code>didReceiveMemoryWarning</code> / <code>UIApplication.didReceiveMemoryWarningNotification</code>. <code>os_proc_available_memory()</code> cho biết còn bao nhiêu.</li>
    </ul>

    <table>
      <tr><th></th><th>JVM (server)</th><th>ART (Android)</th><th>ARC (iOS)</th></tr>
      <tr><td>Thu hồi</td><td>GC tracing</td><td>GC tracing, concurrent</td><td>Đếm tham chiếu lúc biên dịch</td></tr>
      <tr><td>Thời điểm huỷ</td><td>Không xác định</td><td>Không xác định</td><td>Ngay khi đếm = 0</td></tr>
      <tr><td>Vòng tham chiếu</td><td>Dọn được</td><td>Dọn được</td><td>Rò rỉ nếu không dùng weak</td></tr>
      <tr><td>Hết bộ nhớ</td><td>OOM, tăng -Xmx</td><td>OOM hoặc bị lmkd giết</td><td>Bị jetsam giết</td></tr>
    </table>

    <div class="callout"><p>💡 Quy tắc ảnh: luôn <strong>giải mã ở kích thước hiển thị</strong> (downsample). Thư viện Coil/Glide (Android), Kingfisher hoặc <code>CGImageSourceCreateThumbnailAtIndex</code> (iOS) làm việc này — đừng tự <code>decodeFile</code> ảnh gốc từ camera.</p></div>
  `,

  codeTabs: [
    { id: "and", label: "① Android: trần heap", lines: [
      "val am = getSystemService(ActivityManager::class.java)",
      "Log.d(\"MEM\", \"memoryClass=${am.memoryClass} MB, large=${am.largeMemoryClass} MB\")",
      "",
      "val rt = Runtime.getRuntime()",
      "val usedMb = (rt.totalMemory() - rt.freeMemory()) / 1_048_576",
      "Log.d(\"MEM\", \"used=$usedMb MB / max=${rt.maxMemory() / 1_048_576} MB\")",
      "",
      "$ adb shell dumpsys meminfo com.shop.app   # Java heap, Native heap, Graphics, TOTAL PSS"
    ]},
    { id: "bmp", label: "② Bitmap: tính RAM", lines: [
      "// Ảnh camera 4000 x 3000, ARGB_8888 = 4 byte/pixel",
      "4000 * 3000 * 4 = 48,000,000 byte ≈ 48 MB   (file JPEG chỉ ~3 MB)",
      "",
      "// Hiển thị trong ô 300 x 300 dp trên màn 3x -> 900 x 900 px",
      "900 * 900 * 4 = 3,240,000 byte ≈ 3.2 MB",
      "",
      "// Coil tự downsample theo kích thước view",
      "AsyncImage(model = product.imageUrl, contentDescription = null,",
      "           modifier = Modifier.size(300.dp))"
    ]},
    { id: "arc", label: "③ iOS: ARC", lines: [
      "final class Cart {",
      "    let id: String",
      "    init(id: String) { self.id = id; print(\"init \\(id)\") }",
      "    deinit { print(\"deinit \\(id)\") }   // chạy NGAY khi đếm về 0",
      "}",
      "",
      "var a: Cart? = Cart(id: \"c1\")   // retain count = 1",
      "var b = a                       // = 2",
      "a = nil                         // = 1",
      "b = nil                         // = 0 -> in 'deinit c1'"
    ]},
    { id: "warn", label: "④ Phản ứng khi thiếu RAM", lines: [
      "// iOS",
      "NotificationCenter.default.addObserver(",
      "    forName: UIApplication.didReceiveMemoryWarningNotification,",
      "    object: nil, queue: .main) { _ in imageCache.removeAll() }",
      "let freeBytes = os_proc_available_memory()",
      "",
      "// Android",
      "override fun onTrimMemory(level: Int) {",
      "    if (level >= TRIM_MEMORY_UI_HIDDEN) imageLoader.memoryCache?.clear()",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="art"><div class="nl">🤖 ART heap</div><div class="ns">GC tracing, concurrent</div></div>
      <div class="node" id="arc"><div class="nl">🍎 ARC</div><div class="ns">retain/release do compiler chèn</div></div>
    </div>
    <div class="arrow" id="a1">↓ ảnh lớn / cache / rò rỉ</div>
    <div class="node" id="grow"><div class="nl">📈 RAM process tăng</div><div class="ns">Bitmap 48 MB mỗi ảnh gốc</div></div>
    <div class="arrow" id="a2">↓ cảnh báo</div>
    <div class="node" id="warn"><div class="nl">⚠️ onTrimMemory / memory warning</div><div class="ns">thả cache ngay</div></div>
    <div class="arrow" id="a3">↓ không đủ</div>
    <div class="node" id="kill"><div class="nl">💀 OOM / lmkd / jetsam</div><div class="ns">crash hoặc bị giết im lặng</div></div>
  `,
  steps: [
    { title: "1 · Trần heap Android", tab: "and", highlight: [2, 5, 6, 8], on: ["art"],
      desc: "memoryClass là giới hạn heap Java/Kotlin; dumpsys meminfo cho thấy cả native heap và graphics." },
    { title: "2 · Bitmap ăn RAM", tab: "bmp", highlight: [2, 5], on: ["a1", "grow"],
      desc: "RAM của ảnh = rộng × cao × 4 byte, không phải kích thước file. Giải mã đúng cỡ hiển thị giảm 15 lần." },
    { title: "3 · ARC: đếm tham chiếu", tab: "arc", highlight: [7, 8, 9, 10], on: ["arc"],
      desc: "Mỗi gán tăng đếm, mỗi nil giảm đếm. Về 0 thì deinit chạy ngay — tất định, không pause GC." },
    { title: "4 · Nhận cảnh báo", tab: "warn", highlight: [3, 4, 5, 8, 9], on: ["a2", "warn"],
      desc: "Thả cache khi OS báo. Đây là cơ hội cuối trước khi bị giết." },
    { title: "5 · Bị giết", tab: "and", highlight: [8], on: ["a3", "kill"],
      desc: "Vượt trần heap → OutOfMemoryError; RAM hệ thống cạn → lmkd/jetsam giết process." }
  ],

  quiz: [
    { q: "Ảnh 4000×3000 ARGB_8888 chiếm bao nhiêu RAM khi giải mã?", options: [
        "≈ 3 MB như file JPEG", "≈ 12 MB", "≈ 48 MB", "≈ 480 MB"
      ], correct: 2, explanation: "4000 × 3000 × 4 byte." },
    { q: "ARC của Swift thu hồi bộ nhớ thế nào?", options: [
        "GC chạy định kỳ", "Compiler chèn retain/release; object bị huỷ ngay khi đếm tham chiếu về 0", "Lập trình viên gọi free()", "OS dọn khi app về nền"
      ], correct: 1, explanation: "Tất định, không có pause GC." },
    { q: "Điều gì ARC KHÔNG tự xử lý được mà GC tracing làm được?", options: [
        "Object tạm", "Vòng tham chiếu (retain cycle)", "String", "Array"
      ], correct: 1, explanation: "Cần weak/unowned để phá vòng." },
    { q: "Cách xem trần heap Java/Kotlin của app Android?", options: [
        "ActivityManager.memoryClass", "Build.VERSION.SDK_INT", "Runtime.availableProcessors()", "PackageManager"
      ], correct: 0, explanation: "largeMemoryClass khi bật largeHeap." },
    { q: "Tạo object mới trong onDraw mỗi frame gây vấn đề gì?", options: [
        "Không vấn đề", "Cấp phát dồn dập kích hoạt GC thường xuyên → có thể rớt frame", "Lỗi biên dịch", "ANR ngay"
      ], correct: 1, explanation: "Nên tạo Paint/Path một lần và tái sử dụng." },
    { q: "App iOS dùng quá nhiều RAM sẽ bị gì?", options: [
        "OutOfMemoryError có thể catch", "Bị jetsam giết (sau khi có thể đã nhận memory warning)", "Tự chuyển sang swap đĩa như server", "Không sao"
      ], correct: 1, explanation: "iOS không cho app dùng swap để kéo dài như máy chủ." },
    { q: "Struct trong Swift khác class ở điểm nào liên quan bộ nhớ?", options: [
        "Struct là value type: gán là sao chép, thường không cần đếm tham chiếu", "Struct luôn nằm trên heap", "Struct có deinit", "Không khác"
      ], correct: 0, explanation: "Collection chuẩn dùng copy-on-write để sao chép rẻ." },
    { q: "Cách đúng để hiển thị ảnh lớn trong ô nhỏ?", options: [
        "Giải mã ảnh gốc rồi scale bằng view", "Giải mã/downsample ở kích thước hiển thị (Coil/Glide, Kingfisher, thumbnail API)", "Chuyển sang PNG", "Bật largeHeap"
      ], correct: 1, explanation: "Giảm RAM hàng chục lần." },
    { q: "Lệnh nào xem chi tiết RAM (Java heap, native, graphics) của app Android?", options: [
        "adb shell dumpsys meminfo <package>", "adb logcat", "adb shell top -n 1", "gradlew dependencies"
      ], correct: 0, explanation: "Cho biết PSS theo từng loại." }
  ]
});
