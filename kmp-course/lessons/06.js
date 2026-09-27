window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "iOS gọi Kotlin",
  title: "Kotlin/Native & framework: Xcode lấy code Kotlin bằng cách nào",
  subtitle: "Header Objective-C sinh tự động · embedAndSignAppleFrameworkForXcode · debug vs release",

  theory: `
    <p>Kết quả của Kotlin/Native cho iOS là một <strong>Apple framework</strong> (<code>Shared.framework</code>). Bên trong có:</p>
    <ul>
      <li><strong>Binary</strong> mã máy cho một kiến trúc (arm64 thiết bị hoặc arm64 simulator) — gồm code của bạn, thư viện Kotlin, runtime Kotlin/Native (GC, xử lý ngoại lệ).</li>
      <li><strong>Header Objective-C</strong> <code>Headers/Shared.h</code> do compiler sinh ra, mô tả mọi API public. Swift đọc header này qua <em>module map</em> — vì thế Swift thấy Kotlin qua lăng kính Objective-C (bài 07).</li>
      <li><code>Info.plist</code>, <code>Modules/module.modulemap</code>.</li>
    </ul>

    <p><strong>Ba cách đưa framework vào app iOS</strong></p>
    <ol>
      <li><strong>Direct integration (mặc định của wizard)</strong>: Xcode có một <em>Run Script build phase</em> gọi
        <code>./gradlew :shared:embedAndSignAppleFrameworkForXcode</code>. Task đọc biến môi trường Xcode (<code>CONFIGURATION</code>, <code>SDK_NAME</code>, <code>ARCHS</code>) để build đúng target/kiểu build rồi copy vào nơi Xcode link.
        Hợp khi cùng một repo, dev iOS có Gradle + JDK.</li>
      <li><strong>CocoaPods</strong>: plugin <code>kotlin("native.cocoapods")</code> sinh podspec; iOS dùng <code>pod 'shared', :path =&gt; '../shared'</code>.</li>
      <li><strong>XCFramework phát hành qua SPM</strong>: đội iOS chỉ nhận binary, không cần Gradle (bài 15).</li>
    </ol>

    <p><strong>Debug vs Release</strong></p>
    <ul>
      <li>Debug framework: link nhanh hơn, có thông tin debug, ít tối ưu.</li>
      <li>Release framework: tối ưu toàn chương trình (chậm link hơn nhiều), dùng khi archive lên App Store. Task tự chọn theo <code>CONFIGURATION</code> của Xcode.</li>
      <li>Crash trong code Kotlin được symbolicate bằng dSYM của framework như code native thường; stack trace hiện tên hàm Kotlin.</li>
    </ul>

    <p><strong>Thiết lập Xcode cho direct integration</strong></p>
    <ul>
      <li>Build Phases → thêm Run Script <em>trước</em> "Compile Sources", nội dung: <code>cd "$SRCROOT/.." &amp;&amp; ./gradlew :shared:embedAndSignAppleFrameworkForXcode</code>.</li>
      <li>Build Settings → Framework Search Paths thêm <code>$(SRCROOT)/../shared/build/xcode-frameworks/$(CONFIGURATION)/$(SDK_NAME)</code>; Other Linker Flags thêm <code>-framework Shared</code>.</li>
      <li>Tắt <em>User Script Sandboxing</em> (<code>ENABLE_USER_SCRIPT_SANDBOXING = NO</code>) để script chạy được Gradle.</li>
    </ul>

    <div class="callout"><p>💡 Swift <strong>không</strong> gọi Kotlin qua bridge chạy lúc runtime như RN: sau khi link, lệnh gọi từ Swift tới một hàm Kotlin chỉ là một lời gọi hàm Objective-C/C bình thường trong cùng process.
    Chi phí đáng kể duy nhất là chuyển đổi kiểu ở ranh giới (vd String Kotlin ↔ NSString, List ↔ NSArray).</p></div>
  `,

  codeTabs: [
    { id: "fw", label: "Trong framework", lines: [
      "Shared.framework/",
      "├── Shared                 # binary mã máy (1 kiến trúc)",
      "├── Headers/Shared.h       # header Objective-C sinh tự động",
      "├── Modules/module.modulemap",
      "└── Info.plist",
      "",
      "// trích Shared.h",
      "__attribute__((swift_name(\"CartCalculator\")))",
      "@interface SharedCartCalculator : SharedBase",
      "- (int64_t)subtotalLines:(NSArray<SharedCartLine *> *)lines __attribute__((swift_name(\"subtotal(lines:)\")));",
      "@end"
    ]},
    { id: "script", label: "Xcode Run Script", lines: [
      "# Build Phases → New Run Script Phase (đặt trước Compile Sources)",
      "cd \"$SRCROOT/..\"",
      "./gradlew :shared:embedAndSignAppleFrameworkForXcode",
      "",
      "# Task đọc biến Xcode:",
      "#   CONFIGURATION = Debug | Release     → debug/release framework",
      "#   SDK_NAME      = iphonesimulator26.0 → target iosSimulatorArm64",
      "#   ARCHS         = arm64",
      "",
      "# Build Settings:",
      "# FRAMEWORK_SEARCH_PATHS = $(SRCROOT)/../shared/build/xcode-frameworks/$(CONFIGURATION)/$(SDK_NAME)",
      "# OTHER_LDFLAGS          = -framework Shared",
      "# ENABLE_USER_SCRIPT_SANDBOXING = NO"
    ]},
    { id: "swift", label: "Swift dùng", lines: [
      "import Shared",
      "",
      "let calc = CartCalculator()",
      "let line = CartLine(sku: \"A1\", price: 120_000, qty: 2)",
      "let sub: Int64 = calc.subtotal(lines: [line])",
      "print(calc.shippingFee(subtotal: sub))   // 30000",
      "",
      "// top-level function trong file Platform.kt → class PlatformKt",
      "print(PlatformKt.greeting())"
    ]},
    { id: "pods", label: "CocoaPods (tuỳ chọn)", lines: [
      "// shared/build.gradle.kts",
      "plugins { kotlin(\"multiplatform\"); kotlin(\"native.cocoapods\") }",
      "kotlin {",
      "    iosArm64(); iosSimulatorArm64()",
      "    cocoapods {",
      "        summary = \"Shared logic\"",
      "        homepage = \"https://example.com\"",
      "        version = \"1.0\"",
      "        ios.deploymentTarget = \"15.0\"",
      "        framework { baseName = \"Shared\"; isStatic = true }",
      "    }",
      "}",
      "# iosApp/Podfile:  pod 'shared', :path => '../shared'"
    ]}
  ],

  stageHtml: `
    <div class="node" id="x"><div class="nl">🔨 Xcode build (Debug, simulator)</div><div class="ns">chạy Run Script phase</div></div>
    <div class="arrow" id="a1">↓ ./gradlew embedAndSignAppleFrameworkForXcode</div>
    <div class="node" id="g"><div class="nl">🐘 Gradle đọc CONFIGURATION, SDK_NAME</div><div class="ns">→ linkDebugFrameworkIosSimulatorArm64</div></div>
    <div class="arrow" id="a2">↓ copy vào xcode-frameworks/</div>
    <div class="node" id="f"><div class="nl">📦 Shared.framework</div><div class="ns">binary + Shared.h + modulemap</div></div>
    <div class="arrow" id="a3">↓ Swift compile + link</div>
    <div class="node" id="app"><div class="nl">📱 App iOS</div><div class="ns">import Shared → gọi hàm trực tiếp</div></div>
  `,
  steps: [
    { title: "1 · Xcode gọi Gradle", tab: "script", highlight: [2, 3], on: ["x", "a1"],
      desc: "Mỗi lần build app, script phase gọi Gradle. Đặt trước Compile Sources để Swift thấy framework mới nhất." },
    { title: "2 · Chọn đúng target", tab: "script", highlight: [6, 7, 8], on: ["g"],
      desc: "Task đọc biến môi trường Xcode: build Debug cho simulator → link framework debug iosSimulatorArm64." },
    { title: "3 · Framework có gì", tab: "fw", highlight: [2, 3, 8, 9, 10], on: ["a2", "f"],
      desc: "Header Objective-C mô tả API Kotlin, kèm <code>swift_name</code> để Swift thấy tên đẹp hơn (CartCalculator thay vì SharedCartCalculator)." },
    { title: "4 · Xcode tìm và link", tab: "script", highlight: [11, 12, 13], on: ["a3"],
      desc: "Search path trỏ tới thư mục task vừa copy vào; linker flag link framework. Tắt sandbox để script chạy Gradle." },
    { title: "5 · Swift gọi Kotlin", tab: "swift", highlight: [1, 3, 5, 9], on: ["app"],
      desc: "Long thành Int64, List thành mảng Swift. Hàm top-level nằm trong class tên theo file: Platform.kt → PlatformKt." }
  ],

  quiz: [
    { q: "Swift \"nhìn\" API Kotlin qua đâu?", options: [
        "File .kt trong framework",
        "Header Objective-C (Shared.h) do Kotlin/Native sinh ra",
        "JSON schema",
        "Một bridge JavaScript"
      ], correct: 1, explanation: "Vì vậy API Kotlin hiện ra trong Swift theo quy tắc interop Objective-C." },
    { q: "Task embedAndSignAppleFrameworkForXcode biết build target nào nhờ gì?", options: [
        "Tham số dòng lệnh bắt buộc",
        "Biến môi trường Xcode như CONFIGURATION, SDK_NAME, ARCHS",
        "Đọc Podfile",
        "Luôn build release cho thiết bị thật"
      ], correct: 1, explanation: "Nên nó phải được gọi từ trong build phase của Xcode." },
    { q: "Run Script phase nên đặt ở đâu?", options: [
        "Sau khi archive", "Trước Compile Sources", "Sau Copy Bundle Resources ở cuối", "Không quan trọng"
      ], correct: 1, explanation: "Swift cần framework mới trước khi biên dịch." },
    { q: "Hàm top-level greeting() trong Platform.kt được Swift gọi thế nào?", options: [
        "greeting()", "PlatformKt.greeting()", "Shared.greeting()", "Platform.greeting()"
      ], correct: 1, explanation: "Hàm top-level được gom vào class tên file + Kt." },
    { q: "Kiểu Long trong Kotlin hiện ra trong Swift là?", options: [
        "Int", "Int64", "Double", "NSNumber luôn luôn"
      ], correct: 1, explanation: "Int → Int32, Long → Int64. Chỉ khi nullable mới bị box thành KotlinLong." },
    { q: "Cách nào cho phép đội iOS dùng code Kotlin mà KHÔNG cần cài Gradle/JDK?", options: [
        "Direct integration", "Phát hành XCFramework (vd qua Swift Package Manager)", "CocoaPods :path local", "Không có cách nào"
      ], correct: 1, explanation: "Direct integration và pod local đều build từ source bằng Gradle." },
    { q: "Swift gọi hàm Kotlin sau khi link có chạy qua bridge runtime không?", options: [
        "Có, như RN bridge",
        "Không — là lời gọi hàm native bình thường trong cùng process; chỉ tốn chuyển đổi kiểu ở ranh giới",
        "Có, qua XPC",
        "Có, qua socket"
      ], correct: 1, explanation: "Chi phí đáng chú ý là chuyển String/collection." },
    { q: "Release framework khác debug framework ở điểm nào?", options: [
        "Không khác",
        "Được tối ưu toàn chương trình, link chậm hơn nhiều, dùng khi archive",
        "Không chạy được trên thiết bị",
        "Không có GC"
      ], correct: 1, explanation: "Chọn tự động theo CONFIGURATION." },
    { q: "Vì sao cần tắt User Script Sandboxing trong Xcode khi dùng direct integration?", options: [
        "Để tăng tốc Swift",
        "Để script build phase được phép chạy Gradle và đọc/ghi file ngoài vùng sandbox",
        "Để ký app",
        "Không cần"
      ], correct: 1, explanation: "Sandbox chặn script truy cập file không khai báo." }
  ]
});
