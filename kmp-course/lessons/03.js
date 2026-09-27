window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Project & Gradle",
  title: "Target, source set và cây phân cấp",
  subtitle: "commonMain → appleMain → iosMain → iosArm64Main · code nhìn thấy nhau theo chiều nào",

  theory: `
    <p>Hai khái niệm quan trọng nhất của một project KMP:</p>
    <ul>
      <li><strong>Target</strong>: một nền tảng đích mà code được biên dịch cho, ví dụ <code>androidTarget</code>, <code>iosArm64</code> (iPhone thật), <code>iosSimulatorArm64</code> (simulator trên Mac Apple Silicon), <code>jvm</code>.</li>
      <li><strong>Source set</strong>: một thư mục mã nguồn + phụ thuộc riêng, được biên dịch cho <em>một hoặc nhiều</em> target. <code>commonMain</code> được biên dịch cho mọi target;
      <code>iosMain</code> cho mọi target iOS; <code>iosArm64Main</code> chỉ cho iPhone thật.</li>
    </ul>

    <p><strong>Cây phân cấp mặc định</strong> (default hierarchy template, từ Kotlin 1.9.20): khi bạn khai báo target, plugin tự tạo các source set trung gian:</p>
    <ul>
      <li><code>commonMain</code> → <code>nativeMain</code> → <code>appleMain</code> → <code>iosMain</code> → <code>iosArm64Main</code>, <code>iosSimulatorArm64Main</code></li>
      <li><code>commonMain</code> → <code>androidMain</code> (hoặc <code>jvmMain</code>)</li>
    </ul>
    <p>Quy tắc nhìn thấy: source set <strong>con thấy code của cha</strong>, cha <strong>không thấy</strong> con. <code>iosMain</code> gọi được hàm trong <code>commonMain</code> và API Apple;
    <code>commonMain</code> không gọi được gì trong <code>iosMain</code> — muốn thế phải dùng expect/actual hoặc interface (bài 05).</p>

    <p>Mỗi source set chính có một bản <strong>test</strong> tương ứng: <code>commonTest</code>, <code>iosTest</code>, <code>androidUnitTest</code> (hoặc <code>androidHostTest</code> với plugin Android-KMP mới).</p>

    <p><strong>Cấu trúc thư mục điển hình</strong></p>
    <ul>
      <li><code>shared/</code> — module KMP (thư viện). <code>src/commonMain/kotlin</code>, <code>src/androidMain/kotlin</code>, <code>src/iosMain/kotlin</code>...</li>
      <li><code>androidApp/</code> (hoặc <code>composeApp</code>) — app Android, phụ thuộc <code>:shared</code>.</li>
      <li><code>iosApp/</code> — project Xcode, nhúng framework do <code>shared</code> sinh ra.</li>
    </ul>

    <table>
      <tr><th>Source set</th><th>Biên dịch cho</th><th>Thấy được</th></tr>
      <tr><td>commonMain</td><td>Mọi target</td><td>Kotlin chuẩn + thư viện đa nền tảng</td></tr>
      <tr><td>androidMain</td><td>Android</td><td>common + Android SDK + thư viện Java/Android</td></tr>
      <tr><td>appleMain</td><td>iOS, macOS, watchOS, tvOS</td><td>common + Foundation (phần chung của Apple)</td></tr>
      <tr><td>iosMain</td><td>iosArm64, iosSimulatorArm64 (và iosX64)</td><td>common + UIKit, Foundation...</td></tr>
      <tr><td>iosArm64Main</td><td>Chỉ thiết bị thật</td><td>Hiếm khi cần</td></tr>
    </table>

    <div class="callout"><p>💡 So với Maven multi-module của Spring: source set <em>không phải</em> module. Tất cả source set trong <code>shared</code> thuộc cùng một module, được "xếp chồng" theo target.
    Giống <code>src/main</code> + <code>src/test</code> nhưng có thêm chiều nền tảng. Và <code>iosX64</code> (simulator trên Mac Intel) đang dần bị hạ cấp hỗ trợ — project mới thường chỉ cần <code>iosArm64</code> + <code>iosSimulatorArm64</code>.</p></div>
  `,

  codeTabs: [
    { id: "tree", label: "Cây thư mục", lines: [
      "my-app/",
      "├── settings.gradle.kts          // include(':shared', ':androidApp')",
      "├── shared/",
      "│   ├── build.gradle.kts",
      "│   └── src/",
      "│       ├── commonMain/kotlin/   // logic chung",
      "│       ├── commonTest/kotlin/",
      "│       ├── androidMain/kotlin/  // actual cho Android",
      "│       └── iosMain/kotlin/      // actual cho iOS",
      "├── androidApp/                  // implementation(project(':shared'))",
      "└── iosApp/iosApp.xcodeproj      // import Shared"
    ]},
    { id: "hier", label: "Cây source set", lines: [
      "commonMain",
      "├── androidMain                  ← target androidTarget",
      "└── nativeMain",
      "    └── appleMain",
      "        └── iosMain",
      "            ├── iosArm64Main           ← target iosArm64",
      "            └── iosSimulatorArm64Main  ← target iosSimulatorArm64",
      "",
      "# Con thấy cha. Cha không thấy con."
    ]},
    { id: "gradle", label: "Khai báo target", lines: [
      "kotlin {",
      "    androidTarget()              // hoặc android { } với plugin Android-KMP mới",
      "    iosArm64()",
      "    iosSimulatorArm64()",
      "",
      "    // Không cần tự tạo iosMain: default hierarchy template làm sẵn",
      "    sourceSets {",
      "        commonMain.dependencies { /* dùng cho mọi target */ }",
      "        iosMain.dependencies    { /* chỉ iOS */ }",
      "        androidMain.dependencies{ /* chỉ Android */ }",
      "    }",
      "}"
    ]},
    { id: "vis", label: "Ai thấy ai", lines: [
      "// commonMain/Platform.kt",
      "fun greet(): String = \"Hello from \" + platformName()   // cần expect (bài 05)",
      "",
      "// iosMain/Helper.kt",
      "import platform.UIKit.UIDevice",
      "fun iosOnly() = greet() + UIDevice.currentDevice.model  // ✅ con thấy cha",
      "",
      "// commonMain/Other.kt",
      "fun x() = iosOnly()   // ❌ Unresolved reference: cha không thấy con"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cm"><div class="nl">commonMain</div><div class="ns">mọi target</div></div>
    <div class="row">
      <div class="node" id="am"><div class="nl">androidMain</div><div class="ns">Android SDK</div></div>
      <div class="node" id="ap"><div class="nl">appleMain → iosMain</div><div class="ns">UIKit, Foundation</div></div>
    </div>
    <div class="row">
      <div class="node" id="t1"><div class="nl">🎯 androidTarget</div><div class="ns">.aar / bytecode</div></div>
      <div class="node" id="t2"><div class="nl">🎯 iosArm64</div><div class="ns">iPhone thật</div></div>
      <div class="node" id="t3"><div class="nl">🎯 iosSimulatorArm64</div><div class="ns">Simulator (M1+)</div></div>
    </div>
    <div class="arrow" id="rule">↑ con thấy cha · cha không thấy con</div>
  `,
  steps: [
    { title: "1 · Bố cục thư mục", tab: "tree", highlight: [3, 6, 8, 9, 10, 11], on: ["cm"],
      desc: "Một module <code>shared</code> chứa mọi source set. App Android và app iOS là hai consumer của nó." },
    { title: "2 · Khai báo target", tab: "gradle", highlight: [2, 3, 4], on: ["t1", "t2", "t3"],
      desc: "Mỗi dòng là một target. Simulator và thiết bị thật là hai target khác nhau vì khác kiến trúc/SDK." },
    { title: "3 · Source set trung gian tự sinh", tab: "hier", highlight: [1, 3, 4, 5, 6, 7], on: ["cm", "ap"],
      desc: "Default hierarchy template tạo <code>iosMain</code> dùng chung cho cả hai target iOS, khỏi viết code hai lần." },
    { title: "4 · Phụ thuộc theo source set", tab: "gradle", highlight: [7, 8, 9, 10], on: ["cm", "am", "ap"],
      desc: "Thư viện đa nền tảng đặt ở commonMain; thư viện chỉ có cho một nền tảng (vd engine OkHttp) đặt ở androidMain." },
    { title: "5 · Quy tắc nhìn thấy", tab: "vis", highlight: [6, 9], on: ["rule"],
      desc: "iosMain gọi được greet() của common. Ngược lại thì lỗi biên dịch — đó là lý do cần expect/actual." }
  ],

  quiz: [
    { q: "Target và source set khác nhau thế nào?", options: [
        "Là một thứ",
        "Target là nền tảng đích để biên dịch; source set là tập mã nguồn + phụ thuộc, biên dịch cho một hoặc nhiều target",
        "Source set là module Gradle riêng",
        "Target là thư mục test"
      ], correct: 1, explanation: "commonMain là source set được biên dịch cho mọi target." },
    { q: "iosSimulatorArm64 dùng cho gì?", options: [
        "iPhone thật", "Simulator iOS trên Mac Apple Silicon", "Mac Intel", "watchOS"
      ], correct: 1, explanation: "iPhone thật là iosArm64; simulator trên Mac Intel là iosX64." },
    { q: "Code trong commonMain có gọi được hàm định nghĩa trong iosMain không?", options: [
        "Có, luôn luôn",
        "Không — cha không thấy con; cần expect/actual hoặc interface",
        "Có nếu đánh dấu public",
        "Có nếu cùng package"
      ], correct: 1, explanation: "Chỉ chiều con → cha mới nhìn thấy." },
    { q: "Default hierarchy template làm gì?", options: [
        "Tạo project Xcode",
        "Tự tạo các source set trung gian như iosMain, appleMain, nativeMain dựa trên target đã khai báo",
        "Sinh test",
        "Publish thư viện"
      ], correct: 1, explanation: "Có từ Kotlin 1.9.20; trước đó phải tự dependsOn." },
    { q: "Thư viện chỉ có cho Android (vd Ktor engine OkHttp) nên khai báo ở đâu?", options: [
        "commonMain.dependencies", "androidMain.dependencies", "iosMain.dependencies", "settings.gradle.kts"
      ], correct: 1, explanation: "commonMain chỉ nhận thư viện có bản cho mọi target." },
    { q: "Source set so với module Maven của Spring?", options: [
        "Mỗi source set là một module riêng",
        "Các source set nằm trong cùng một module, xếp chồng theo target — giống main/test nhưng thêm chiều nền tảng",
        "Không liên quan tới Gradle",
        "Source set chỉ dùng cho test"
      ], correct: 1, explanation: "Một module shared có thể có hàng chục source set." },
    { q: "Test cho code chung đặt ở đâu?", options: [
        "commonTest", "androidTest duy nhất", "iosApp/Tests", "commonMain/test"
      ], correct: 0, explanation: "commonTest chạy được trên mọi target đã khai báo." },
    { q: "Code dùng UIKit nên đặt trong source set nào?", options: [
        "commonMain", "appleMain (vì có cả macOS)", "iosMain", "androidMain"
      ], correct: 2, explanation: "UIKit chỉ có trên iOS/tvOS; appleMain gồm cả macOS nên không có UIKit." },
    { q: "App iOS nhận code từ module shared dưới dạng gì?", options: [
        "File .kt", "Một framework (Shared.framework) do Kotlin/Native sinh", "Một file .aar", "Một package npm"
      ], correct: 1, explanation: "Xcode link framework này như bất kỳ framework nào khác." }
  ]
});
