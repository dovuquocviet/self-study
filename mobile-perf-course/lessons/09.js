window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Khởi động nhanh",
  title: "Startup iOS & React Native: dyld, pre-main, bundle JS và TTI",
  subtitle: "Dynamic framework · static initializer · prewarming · Hermes bytecode · inline requires · đo TTI trong RN",

  theory: `
    <p><strong>Launch iOS</strong> (cold):</p>
    <ol>
      <li>Kernel tạo process; <strong>dyld</strong> nạp và liên kết các <em>dynamic framework</em> (mỗi framework động cộng thêm chi phí).</li>
      <li><strong>Static initializer</strong>: <code>+load</code> của Objective-C, constructor C++ toàn cục chạy trước <code>main()</code>.</li>
      <li><code>UIApplicationMain</code> → <code>application(_:didFinishLaunchingWithOptions:)</code> → scene → view controller đầu → frame đầu.</li>
    </ol>
    <p>Apple khuyến nghị frame đầu trong khoảng <strong>400 ms</strong>; quá lâu (cỡ 20 s) watchdog sẽ kill app. Từ iOS 15 hệ thống có thể <strong>prewarm</strong> — chạy trước phần pre-main
    khi dự đoán bạn sắp mở app — nên đừng đo bằng timestamp lúc process bắt đầu; dùng template <em>App Launch</em> của Instruments, <code>XCTApplicationLaunchMetric</code> hoặc MetricKit.</p>
    <p>Tối ưu: giảm dynamic framework (liên kết tĩnh, hoặc <em>mergeable libraries</em> từ Xcode 15), bỏ <code>+load</code>, đưa việc khỏi <code>didFinishLaunching</code> sang sau frame đầu.</p>

    <p><strong>Startup React Native</strong> có thêm các bước riêng:</p>
    <ol>
      <li>Native init (như app thường) + khởi tạo React Native host/runtime.</li>
      <li><strong>Nạp bundle JS</strong>: với Hermes (mặc định từ 0.70), bundle đã được biên dịch trước thành <strong>bytecode</strong> lúc build → không phải parse/compile JS lúc chạy, và có thể mmap.</li>
      <li><strong>Chạy bundle</strong>: thực thi code top-level của mọi module được <code>require</code>. Đây là nơi app lớn tốn thời gian.</li>
      <li>Render cây React đầu → Fabric mount view → frame đầu → gọi API → dữ liệu hiện ra (TTI/TTFD).</li>
    </ol>

    <p><strong>Tối ưu phía JS</strong></p>
    <ul>
      <li><strong>Inline requires</strong> (Metro <code>inlineRequires: true</code>): đổi <code>require</code> đầu file thành require tại chỗ dùng → module chỉ chạy khi cần. Kiểm tra <code>metro.config.js</code> đã bật chưa.</li>
      <li><strong>Không làm việc nặng ở top-level module</strong>: tạo bảng tra cứu lớn, đọc storage đồng bộ, khởi tạo SDK.</li>
      <li><strong>Giảm bundle</strong>: bỏ thư viện nặng không cần (moment → dayjs/Intl, lodash toàn bộ → import từng hàm), xem bằng bundle visualizer.</li>
      <li><strong>Màn đầu nhẹ</strong>: tab/screen khác lười render; hiện dữ liệu cache (MMKV đọc đồng bộ nhanh) trước khi gọi mạng.</li>
    </ul>

    <div class="callout"><p>💡 Với RN, TTI = native init + nạp/chạy bundle + render + dữ liệu. Đánh dấu từng mốc để biết phần nào lớn nhất trước khi quyết định —
    nếu 70% là chờ API thì tối ưu JS không giúp nhiều, nên xem prefetch/cache (bài 16).</p></div>
  `,

  codeTabs: [
    { id: "ios", label: "① iOS launch", lines: [
      "@main",
      "final class AppDelegate: UIResponder, UIApplicationDelegate {",
      "    func application(_ app: UIApplication,",
      "                     didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {",
      "        CrashReporter.start()                    // cần sớm",
      "        // Analytics.setup(); Chat.setup()       // ✗ chặn frame đầu",
      "        DispatchQueue.main.async {               // ✓ sau khi frame đầu được lên lịch",
      "            Task.detached(priority: .utility) { Analytics.setup() }",
      "        }",
      "        return true",
      "    }",
      "}"
    ]},
    { id: "xct", label: "② Đo launch (XCTest)", lines: [
      "final class LaunchPerfTests: XCTestCase {",
      "    func testLaunch() {",
      "        measure(metrics: [XCTApplicationLaunchMetric()]) {",
      "            XCUIApplication().launch()",
      "        }",
      "    }",
      "}",
      "// Chạy trên máy thật, scheme Release → Xcode báo trung bình + độ lệch",
      "// Đặt baseline trong Xcode để test fail khi chậm hơn ngưỡng"
    ]},
    { id: "metro", label: "③ Metro & bundle", lines: [
      "// metro.config.js",
      "const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');",
      "const config = {",
      "  transformer: {",
      "    getTransformOptions: async () => ({",
      "      transform: { experimentalImportSupport: false, inlineRequires: true },",
      "    }),",
      "  },",
      "};",
      "module.exports = mergeConfig(getDefaultConfig(__dirname), config);",
      "",
      "# Xem module nào chiếm bundle",
      "npx react-native-bundle-visualizer"
    ]},
    { id: "marks", label: "④ Đánh mốc TTI (RN)", lines: [
      "import performance from 'react-native-performance';",
      "",
      "function HomeScreen() {",
      "  const { data } = useProducts();",
      "  useEffect(() => {",
      "    if (data) performance.mark('home_content_ready');",
      "  }, [data]);",
      "  ...",
      "}",
      "",
      "// Thư viện có sẵn mốc native: nativeLaunchStart, nativeLaunchEnd,",
      "// runJsBundleStart, runJsBundleEnd, contentAppeared",
      "performance.measure('tti', 'nativeLaunchStart', 'home_content_ready');",
      "// ví dụ: native 380 ms | bundle 210 ms | render 160 ms | chờ API 900 ms"
    ]}
  ],

  stageHtml: `
    <div class="node" id="dyld"><div class="nl">⚙️ Process + dyld / Zygote</div><div class="ns">framework động · static init</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="nat"><div class="nl">📱 AppDelegate / Application</div><div class="ns">SDK · React Native host</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="bundle"><div class="nl">🟨 Nạp + chạy bundle JS</div><div class="ns">Hermes bytecode · top-level module</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="render"><div class="nl">⚛️ Render → frame đầu</div><div class="ns">Fabric mount</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="tti"><div class="nl">✅ Dữ liệu hiện, chạm được</div><div class="ns">TTI / TTFD</div></div>
  `,
  steps: [
    { title: "1 · Pre-main trên iOS", tab: "ios", highlight: [1], on: ["dyld", "a1"],
      desc: "Trước khi code của bạn chạy: dyld nạp framework động, chạy static initializer. Giảm framework động và +load." },
    { title: "2 · didFinishLaunching gọn", tab: "ios", highlight: [5, 6, 7, 8], on: ["nat"],
      desc: "Mọi thứ trong hàm này chặn frame đầu. Hoãn SDK không thiết yếu, chạy trên background khi an toàn." },
    { title: "3 · Đo launch có phương pháp", tab: "xct", highlight: [3, 4, 8, 9], on: ["nat", "a2"],
      desc: "XCTApplicationLaunchMetric chạy launch nhiều lần; có thể đặt baseline để phát hiện chậm đi." },
    { title: "4 · RN: inline requires", tab: "metro", highlight: [6, 13], on: ["bundle"],
      desc: "Module chỉ được thực thi khi thực sự dùng → giảm thời gian chạy bundle lúc khởi động." },
    { title: "5 · Chia TTI thành từng mốc", tab: "marks", highlight: [6, 11, 12, 13, 14], on: ["a3", "render", "a4", "tti"],
      desc: "Ví dụ trên cho thấy chờ API (900 ms) là phần lớn nhất → ưu tiên cache/prefetch trước khi tối ưu JS." }
  ],

  quiz: [
    { q: "dyld làm gì trong launch iOS?", options: [
        "Vẽ frame đầu",
        "Nạp và liên kết các dynamic library/framework trước khi main() chạy",
        "Tải bundle JS",
        "Gửi analytics"
      ], correct: 1, explanation: "Mỗi framework động tăng chi phí pre-main." },
    { q: "Vì sao không nên đo launch iOS bằng thời điểm process bắt đầu (iOS 15+)?", options: [
        "Vì không lấy được thời gian",
        "Vì prewarming có thể chạy trước phần pre-main lâu trước khi người dùng mở app",
        "Vì Apple cấm",
        "Vì Swift không hỗ trợ"
      ], correct: 1, explanation: "Dùng App Launch instrument, XCTApplicationLaunchMetric, MetricKit." },
    { q: "Apple khuyến nghị frame đầu tiên nên xuất hiện trong khoảng?", options: [
        "400 ms", "2 s", "5 s", "20 s"
      ], correct: 0, explanation: "20 s là mức watchdog có thể kill app." },
    { q: "Hermes giúp startup RN nhờ gì?", options: [
        "Chạy JS trên GPU",
        "Bundle được biên dịch trước thành bytecode lúc build, không phải parse/compile lúc chạy",
        "Bỏ JS thread",
        "Nén ảnh"
      ], correct: 1, explanation: "Giảm thời gian nạp bundle, có thể mmap." },
    { q: "inlineRequires của Metro làm gì?", options: [
        "Gộp mọi file thành một",
        "Chuyển require tới chỗ dùng để module chỉ được thực thi khi cần",
        "Xoá console.log",
        "Nén bundle bằng gzip"
      ], correct: 1, explanation: "Giảm công việc chạy bundle lúc khởi động." },
    { q: "Code nào ở top-level module gây hại cho startup RN?", options: [
        "Khai báo hằng số nhỏ",
        "Khởi tạo SDK, dựng bảng tra cứu lớn, đọc storage đồng bộ",
        "import type",
        "Khai báo function"
      ], correct: 1, explanation: "Top-level chạy ngay khi module được require." },
    { q: "Đo TTI của RN chia theo mốc cho thấy chờ API chiếm 60%. Nên ưu tiên gì?", options: [
        "Chuyển sang native ngay",
        "Cache dữ liệu lần trước/prefetch, gọi API song song sớm hơn",
        "Bỏ Hermes",
        "Thêm useMemo"
      ], correct: 1, explanation: "Tối ưu phần lớn nhất trước." },
    { q: "Cách giảm chi phí dynamic framework trên iOS?", options: [
        "Thêm framework",
        "Liên kết tĩnh hoặc dùng mergeable libraries (Xcode 15+)",
        "Bật bitcode",
        "Dùng Simulator"
      ], correct: 1, explanation: "Ít framework động → dyld làm ít việc hơn." },
    { q: "XCTApplicationLaunchMetric dùng trong ngữ cảnh nào?", options: [
        "Trong XCTest measure(metrics:) để đo launch lặp lại nhiều lần",
        "Trong Android Macrobenchmark",
        "Trong Firebase",
        "Trong Metro"
      ], correct: 0, explanation: "Tương đương StartupTimingMetric bên Android." }
  ]
});
