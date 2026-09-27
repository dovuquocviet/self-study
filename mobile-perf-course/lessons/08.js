window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Khởi động nhanh",
  title: "Startup Android: cold start từng giai đoạn, Macrobenchmark, Baseline Profiles",
  subtitle: "Zygote → Application → Activity · ContentProvider ẩn · App Startup · lazy init · reportFullyDrawn",

  theory: `
    <p><strong>Cold start Android diễn ra thế nào</strong></p>
    <ol>
      <li>Hệ thống fork process mới từ <strong>Zygote</strong> (process đã nạp sẵn framework), hiện <em>starting window</em> (splash).</li>
      <li><code>bindApplication</code>: nạp code app, chạy <code>onCreate()</code> của mọi <strong>ContentProvider</strong> khai báo trong manifest — nhiều thư viện lén khởi tạo ở đây.</li>
      <li><code>Application.onCreate()</code>: DI graph (Hilt/Koin), analytics, crash reporter, remote config...</li>
      <li><code>Activity.onCreate()</code> → inflate layout / dựng Compose → measure/layout/draw → frame đầu tiên (<strong>TTID</strong>).</li>
      <li>Tải dữ liệu → nội dung thật hiện ra → <code>reportFullyDrawn()</code> (<strong>TTFD</strong>).</li>
    </ol>
    <p>Giống Spring Boot khởi động: mỗi <code>@Bean</code> eager, mỗi auto-configuration đều cộng vào thời gian khởi động. Khác biệt: người dùng nhìn chằm chằm vào nó mỗi ngày.</p>

    <p><strong>Tối ưu theo thứ tự hiệu quả</strong></p>
    <ul>
      <li><strong>Hoãn / lười hoá</strong>: chỉ khởi tạo những gì màn đầu tiên cần. SDK analytics, ads, chat có thể chờ sau frame đầu hoặc khởi tạo trên background.</li>
      <li><strong>Gom ContentProvider</strong> bằng thư viện <strong>App Startup</strong> (<code>androidx.startup</code>): một provider chung, khai báo phụ thuộc, có thể tắt tự khởi tạo để init lười.</li>
      <li><strong>Không I/O trên main thread</strong> lúc khởi động: SharedPreferences lớn, đọc file, mở DB, reflection nặng.</li>
      <li><strong>Baseline Profiles</strong>: danh sách class/method cần AOT-compile ngay khi cài. Không có nó, lần chạy đầu code chạy thông dịch/JIT; Google ghi nhận cải thiện khoảng 30% tốc độ thực thi từ lần mở đầu tiên. Startup Profile (tập con) còn giúp R8 xếp class khởi động vào DEX chính.</li>
      <li><strong>Splash Screen API</strong> (<code>core-splashscreen</code>): dùng chính starting window của hệ thống thay vì tự làm Activity splash (thêm một Activity = thêm thời gian).</li>
    </ul>

    <p><strong>Đo bằng Macrobenchmark</strong>: module test riêng, điều khiển app thật đã build release, lặp nhiều lần, có chế độ compile (<code>CompilationMode</code>) và kiểu start (<code>StartupMode.COLD/WARM/HOT</code>).
    Kết quả in ra <code>timeToInitialDisplayMs</code> và <code>timeToFullDisplayMs</code> (nếu có <code>reportFullyDrawn</code>) kèm min/median/max, và lưu trace Perfetto cho từng lần chạy.</p>

    <div class="callout"><p>💡 App RN cũng là app Android: toàn bộ bài này áp dụng cho phần native của RN (MainApplication, thư viện native). Phần riêng của RN (tải bundle JS) ở bài 09.</p></div>
  `,

  codeTabs: [
    { id: "lazy", label: "① Application gọn", lines: [
      "class ShopApp : Application() {",
      "    override fun onCreate() {",
      "        super.onCreate()",
      "        CrashReporter.init(this)              // cần sớm để bắt crash khởi động",
      "        // Analytics.init(this)               // ✗ trước: 180 ms trên main thread",
      "        // Chat.init(this)                    // ✗ trước: 240 ms",
      "        appScope.launch(Dispatchers.Default) {",
      "            Analytics.init(this@ShopApp)      // ✓ chạy nền",
      "        }",
      "    }",
      "}",
      "// Chat: init lười khi người dùng mở màn Chat lần đầu"
    ]},
    { id: "startup", label: "② App Startup", lines: [
      "class AnalyticsInitializer : Initializer<Analytics> {",
      "    override fun create(context: Context): Analytics = Analytics.init(context)",
      "    override fun dependencies(): List<Class<out Initializer<*>>> =",
      "        listOf(WorkManagerInitializer::class.java)",
      "}",
      "",
      "<!-- AndroidManifest.xml: tắt tự khởi tạo để init lười -->",
      "<provider android:name='androidx.startup.InitializationProvider'",
      "    android:authorities='${applicationId}.androidx-startup' tools:node='merge'>",
      "    <meta-data android:name='com.shop.AnalyticsInitializer' tools:node='remove' />",
      "</provider>",
      "",
      "// Khi cần: AppInitializer.getInstance(ctx).initializeComponent(AnalyticsInitializer::class.java)"
    ]},
    { id: "macro", label: "③ Macrobenchmark", lines: [
      "@RunWith(AndroidJUnit4::class)",
      "class StartupBenchmark {",
      "    @get:Rule val rule = MacrobenchmarkRule()",
      "",
      "    @Test fun coldStart() = rule.measureRepeated(",
      "        packageName = \"com.shop\",",
      "        metrics = listOf(StartupTimingMetric()),",
      "        iterations = 10,",
      "        startupMode = StartupMode.COLD,",
      "        compilationMode = CompilationMode.Partial()   // dùng Baseline Profile",
      "    ) {",
      "        pressHome()",
      "        startActivityAndWait()",
      "    }",
      "}",
      "// timeToInitialDisplayMs   min 612  median 648  max 701"
    ]},
    { id: "bp", label: "④ Baseline Profile", lines: [
      "@RunWith(AndroidJUnit4::class)",
      "class BaselineProfileGenerator {",
      "    @get:Rule val rule = BaselineProfileRule()",
      "",
      "    @Test fun generate() = rule.collect(",
      "        packageName = \"com.shop\",",
      "        includeInStartupProfile = true",
      "    ) {",
      "        pressHome()",
      "        startActivityAndWait()",
      "        device.findObject(By.res(\"product_list\")).fling(Direction.DOWN)",
      "    }",
      "}",
      "# ./gradlew :app:generateBaselineProfile  (plugin androidx.baselineprofile)",
      "# → src/release/generated/baselineProfiles/baseline-prof.txt, đóng gói vào AAB"
    ]}
  ],

  stageHtml: `
    <div class="node" id="z"><div class="nl">🧬 Fork từ Zygote</div><div class="ns">starting window / splash</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="cp"><div class="nl">📜 ContentProvider.onCreate()</div><div class="ns">thư viện tự khởi tạo ở đây</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="app"><div class="nl">🏗️ Application.onCreate()</div><div class="ns">DI · SDK · config</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="act"><div class="nl">🖼️ Activity → frame đầu</div><div class="ns">TTID</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="full"><div class="nl">✅ Dữ liệu hiện ra</div><div class="ns">reportFullyDrawn → TTFD</div></div>
  `,
  steps: [
    { title: "1 · Process & ContentProvider", tab: "startup", highlight: [8, 9], on: ["z", "a1", "cp"],
      desc: "Mỗi thư viện khai báo ContentProvider riêng để tự init → chạy trước cả Application.onCreate. App Startup gom về một provider." },
    { title: "2 · Tắt tự init, init lười", tab: "startup", highlight: [1, 2, 10, 13], on: ["cp"],
      desc: "<code>tools:node='remove'</code> bỏ initializer khỏi lúc khởi động; gọi initializeComponent khi thực sự cần." },
    { title: "3 · Application.onCreate gọn", tab: "lazy", highlight: [4, 5, 6, 7, 8], on: ["a2", "app"],
      desc: "Chỉ giữ thứ bắt buộc phải sớm (crash reporter). Phần còn lại chạy nền hoặc lười. Lưu ý thứ tự phụ thuộc khi chuyển sang nền." },
    { title: "4 · Đo bằng Macrobenchmark", tab: "macro", highlight: [5, 7, 8, 9, 12, 13, 16], on: ["a3", "act"],
      desc: "Chạy bản release thật, 10 lần cold start, in min/median/max của TTID. Mỗi lần có trace Perfetto để mở ra xem." },
    { title: "5 · Sinh Baseline Profile", tab: "bp", highlight: [3, 5, 7, 10, 11, 14], on: ["act", "a4", "full"],
      desc: "Chạy hành trình quan trọng (mở app, cuộn danh sách) để ghi lại method được dùng. Profile đi kèm AAB, ART biên dịch trước khi cài." },
    { title: "6 · So sánh có/không profile", tab: "macro", highlight: [10], on: ["full"],
      desc: "Chạy benchmark với <code>CompilationMode.None()</code> và <code>Partial()</code> để thấy lợi ích của Baseline Profile trên chính app mình." }
  ],

  quiz: [
    { q: "Thứ tự nào đúng trong cold start Android?", options: [
        "Activity.onCreate → Application.onCreate → ContentProvider",
        "Tạo process → ContentProvider.onCreate → Application.onCreate → Activity.onCreate → frame đầu",
        "Application.onCreate → tạo process → Activity",
        "ContentProvider chạy sau Activity"
      ], correct: 1, explanation: "ContentProvider được khởi tạo trước Application.onCreate." },
    { q: "Vì sao nhiều thư viện làm chậm startup dù bạn không gọi init?", options: [
        "Vì Gradle",
        "Vì chúng tự khởi tạo qua ContentProvider khai báo trong manifest được merge vào app",
        "Vì Zygote",
        "Vì R8"
      ], correct: 1, explanation: "Xem Merged Manifest để thấy các provider này." },
    { q: "Thư viện App Startup (androidx.startup) giúp gì?", options: [
        "Nén APK",
        "Gom việc khởi tạo về một ContentProvider, khai báo phụ thuộc, cho phép tắt tự init để init lười",
        "Thay thế Application class",
        "Tạo splash screen"
      ], correct: 1, explanation: "Giảm số provider và kiểm soát thứ tự init." },
    { q: "Baseline Profile cải thiện startup nhờ cơ chế nào?", options: [
        "Nén ảnh",
        "Cho ART biên dịch trước (AOT) các class/method trong danh sách ngay khi cài, không phải chờ JIT",
        "Xoá code thừa",
        "Tăng RAM"
      ], correct: 1, explanation: "Lần chạy đầu không phải thông dịch/JIT những đường code nóng." },
    { q: "Macrobenchmark khác chạy tay 'adb am start' ở điểm nào?", options: [
        "Không khác",
        "Lặp nhiều lần có kiểm soát kiểu start và chế độ compile, báo min/median/max, lưu trace mỗi lần",
        "Chỉ chạy trên emulator",
        "Chỉ đo debug build"
      ], correct: 1, explanation: "Là công cụ benchmark có phương pháp, dùng được trong CI." },
    { q: "Metric nào của Macrobenchmark đo TTID?", options: [
        "FrameTimingMetric", "StartupTimingMetric (timeToInitialDisplayMs)", "MemoryUsageMetric", "PowerMetric"
      ], correct: 1, explanation: "Có thêm timeToFullDisplayMs nếu app gọi reportFullyDrawn." },
    { q: "Vì sao nên dùng Splash Screen API thay vì một SplashActivity riêng?", options: [
        "Vì đẹp hơn",
        "Dùng starting window có sẵn của hệ thống, tránh tạo thêm một Activity trong đường khởi động",
        "Vì iOS bắt buộc",
        "Vì giảm APK"
      ], correct: 1, explanation: "Thêm Activity là thêm thời gian inflate và chuyển màn." },
    { q: "Việc nào KHÔNG nên hoãn lại sau frame đầu?", options: [
        "SDK chat", "SDK quảng cáo", "Crash reporter (để bắt được crash trong khởi động)", "Analytics phụ"
      ], correct: 2, explanation: "Crash reporter cần có mặt sớm." },
    { q: "Tương tự trong Spring Boot, điều nào làm chậm khởi động giống việc init eager trong Application.onCreate?", options: [
        "@Lazy bean",
        "Nhiều @Bean eager và auto-configuration nặng chạy lúc context khởi tạo",
        "Dùng Controller",
        "Dùng JPA repository interface"
      ], correct: 1, explanation: "Cả hai đều trả giá khởi tạo trước khi phục vụ yêu cầu đầu tiên." }
  ]
});
