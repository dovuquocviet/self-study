window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Toàn cảnh",
  title: "Một ngôn ngữ, nhiều backend biên dịch",
  subtitle: "Frontend K2 → IR → JVM / Native (LLVM) / JS / Wasm · klib · vì sao iOS cần máy Mac",

  theory: `
    <p>Muốn hiểu KMP phải hiểu trình biên dịch Kotlin có <strong>hai nửa</strong>:</p>
    <ol>
      <li><strong>Frontend (K2)</strong>: đọc mã nguồn, phân giải kiểu, kiểm tra lỗi. Phần này giống nhau cho mọi nền tảng.</li>
      <li><strong>Backend</strong>: chuyển cây trung gian (<em>IR</em>) thành định dạng đích.
        <ul>
          <li><strong>Kotlin/JVM</strong> → file <code>.class</code> (Android dịch tiếp sang DEX).</li>
          <li><strong>Kotlin/Native</strong> → LLVM IR → mã máy (ARM64 cho iPhone, ARM64/x64 cho simulator, macOS, Linux, Windows).</li>
          <li><strong>Kotlin/JS</strong> và <strong>Kotlin/Wasm</strong> → JavaScript / WebAssembly.</li>
        </ul>
      </li>
    </ol>

    <p><strong>Thư viện đa nền tảng được phân phối thế nào?</strong> Một thư viện KMP publish nhiều artifact: bản JVM (<code>.jar</code>), bản Android (<code>.aar</code>),
    và bản <strong>klib</strong> cho từng target native (klib chứa IR, chưa phải mã máy). Chỉ ở bước <em>link</em> cuối cùng — khi tạo framework cho iOS — toàn bộ klib của bạn và của thư viện mới được biên dịch thành một binary duy nhất.
    File metadata Gradle (<code>.module</code>) cho Gradle biết target nào lấy artifact nào.</p>

    <p><strong>Hệ quả thực tế</strong></p>
    <ul>
      <li><strong>Build iOS cần macOS + Xcode</strong>: bước link dùng toolchain và SDK của Apple. Android và phần common thì build được trên Linux/Windows.</li>
      <li><strong>Link Kotlin/Native chậm</strong> hơn nhiều so với JVM (tối ưu toàn chương trình). Bản debug nhanh hơn release; Gradle có cache cho các phụ thuộc.</li>
      <li><strong>commonMain chỉ thấy API chung</strong>: <code>kotlin.*</code>, <code>kotlin.collections</code>, <code>kotlin.text</code>... Không có <code>java.io.File</code>, <code>java.time</code>, <code>java.util.UUID</code> — những thứ đó là JDK, iOS không có JDK. Thay bằng thư viện đa nền tảng (kotlinx-datetime, okio...) hoặc expect/actual.</li>
      <li>Code <code>iosMain</code> gọi được API Apple trực tiếp (<code>platform.Foundation.*</code>, <code>platform.UIKit.*</code>) vì Kotlin/Native sinh sẵn binding từ header Objective-C của SDK.</li>
    </ul>

    <table>
      <tr><th>Java/Spring bạn quen</th><th>Trong KMP</th></tr>
      <tr><td>javac → .class, chạy trên JVM</td><td>Kotlin/JVM y hệt; Kotlin/Native thì không có JVM, có runtime nhỏ (GC, ngoại lệ) link sẵn vào binary</td></tr>
      <tr><td>Maven artifact = 1 jar</td><td>1 thư viện KMP = nhiều artifact theo target + metadata</td></tr>
      <tr><td><code>java.util.*</code> có ở khắp nơi</td><td>Chỉ có ở JVM/Android; common dùng <code>kotlin.*</code></td></tr>
      <tr><td>Reflection đầy đủ</td><td>Native hạn chế reflection → thư viện dùng code generation (compiler plugin, KSP)</td></tr>
    </table>

    <div class="callout"><p>💡 Vì Native hạn chế reflection, những thứ Spring làm bằng reflection lúc chạy (Jackson, DI quét annotation) trong KMP được làm <strong>lúc biên dịch</strong>:
    kotlinx.serialization là compiler plugin sinh serializer; Room/SQLDelight sinh code từ schema. Đây là lý do nhiều thư viện Java quen thuộc không dùng được trong commonMain.</p></div>
  `,

  codeTabs: [
    { id: "pipe", label: "Pipeline biên dịch", lines: [
      "src/commonMain/*.kt + src/iosMain/*.kt",
      "        │  K2 frontend (phân giải kiểu, kiểm tra)",
      "        ▼",
      "      Kotlin IR",
      "        ├── JVM backend    → .class → (Android D8/R8) → .dex",
      "        ├── Native backend → klib → link → LLVM → Shared.framework (arm64)",
      "        ├── JS backend     → .js",
      "        └── Wasm backend   → .wasm",
      "",
      "# klib = IR chưa biên dịch; mã máy chỉ sinh ở bước link cuối"
    ]},
    { id: "common", label: "commonMain không có JDK", lines: [
      "// ❌ không biên dịch trong commonMain",
      "import java.util.UUID",
      "import java.time.Instant",
      "",
      "// ✅ dùng thư viện đa nền tảng",
      "import kotlin.uuid.Uuid                 // Kotlin 2.0.20+, @ExperimentalUuidApi",
      "import kotlinx.datetime.Clock            // kotlinx-datetime",
      "",
      "@OptIn(kotlin.uuid.ExperimentalUuidApi::class)",
      "fun newOrderId(): String = Uuid.random().toString()"
    ]},
    { id: "ios", label: "iosMain gọi API Apple", lines: [
      "// src/iosMain/kotlin/DeviceInfo.ios.kt",
      "import platform.UIKit.UIDevice",
      "import platform.Foundation.NSProcessInfo",
      "",
      "fun deviceName(): String =",
      "    UIDevice.currentDevice.systemName + \" \" + UIDevice.currentDevice.systemVersion",
      "",
      "fun osVersion(): String = NSProcessInfo.processInfo.operatingSystemVersionString"
    ]},
    { id: "gradle", label: "Task Gradle tương ứng", lines: [
      "./gradlew :shared:compileKotlinIosSimulatorArm64     # → klib",
      "./gradlew :shared:linkDebugFrameworkIosSimulatorArm64 # → Shared.framework",
      "./gradlew :shared:compileDebugKotlinAndroid           # → .class cho Android",
      "",
      "# Kết quả framework:",
      "# shared/build/bin/iosSimulatorArm64/debugFramework/Shared.framework"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📝 Mã nguồn Kotlin</div><div class="ns">commonMain + platform source sets</div></div>
    <div class="arrow" id="a1">↓ K2 frontend</div>
    <div class="node" id="ir"><div class="nl">🧬 Kotlin IR</div><div class="ns">chung mọi nền tảng</div></div>
    <div class="row">
      <div class="node" id="jvm"><div class="nl">☕ JVM backend</div><div class="ns">.class → .dex</div></div>
      <div class="node" id="nat"><div class="nl">⚙️ Native backend</div><div class="ns">klib → LLVM → mã máy</div></div>
    </div>
    <div class="arrow" id="a2">↓ link (chỉ trên macOS cho Apple)</div>
    <div class="node" id="fw"><div class="nl">🍎 Shared.framework</div><div class="ns">code của bạn + mọi thư viện + runtime K/N</div></div>
  `,
  steps: [
    { title: "1 · Frontend dùng chung", tab: "pipe", highlight: [1, 2, 4], on: ["src", "a1", "ir"],
      desc: "Lỗi kiểu, null-safety, smart cast... được kiểm tra một lần, giống nhau cho mọi target." },
    { title: "2 · Tách ra các backend", tab: "pipe", highlight: [5, 6, 7, 8], on: ["jvm", "nat"],
      desc: "JVM backend cho Android; Native backend sinh klib cho iOS. Mỗi target iOS (thiết bị, simulator) có klib riêng." },
    { title: "3 · Link thành framework", tab: "gradle", highlight: [1, 2, 6], on: ["a2", "fw"],
      desc: "Bước link gom klib của bạn và thư viện, chạy LLVM ra mã máy và đóng gói framework. Bước này chậm và cần Xcode." },
    { title: "4 · commonMain không có JDK", tab: "common", highlight: [2, 3, 6, 7, 10], on: ["src"],
      desc: "iOS không có JDK nên <code>java.*</code> bị cấm trong common. Dùng API Kotlin chuẩn hoặc thư viện kotlinx." },
    { title: "5 · iosMain thấy API Apple", tab: "ios", highlight: [2, 3, 5, 6, 8], on: ["nat"],
      desc: "Kotlin/Native sinh binding từ header Objective-C của iOS SDK nên iosMain gọi UIKit/Foundation như gọi Kotlin." }
  ],

  quiz: [
    { q: "Phần nào của trình biên dịch Kotlin dùng chung cho mọi nền tảng?", options: [
        "Backend LLVM", "Frontend (phân tích, kiểm tra kiểu) và Kotlin IR", "D8/R8", "Linker của Xcode"
      ], correct: 1, explanation: "Frontend + IR chung; mỗi nền tảng có backend riêng." },
    { q: "klib là gì?", options: [
        "Mã máy iOS đã biên dịch xong",
        "Định dạng thư viện Kotlin chứa IR; mã máy chỉ sinh ở bước link",
        "File .jar đổi tên",
        "File cấu hình Gradle"
      ], correct: 1, explanation: "Nhờ đó thư viện native có thể được tối ưu cùng code của bạn khi link." },
    { q: "Vì sao build framework iOS cần máy Mac?", options: [
        "Vì Kotlin chỉ cài được trên macOS",
        "Vì bước link cần toolchain và SDK của Apple (Xcode)",
        "Vì Gradle chỉ chạy trên macOS",
        "Không cần, Linux build được"
      ], correct: 1, explanation: "Android và common vẫn build được trên Linux/Windows." },
    { q: "Dòng nào KHÔNG biên dịch được trong commonMain?", options: [
        "import kotlin.math.max",
        "import java.time.Instant",
        "import kotlinx.coroutines.flow.Flow",
        "import kotlin.collections.List"
      ], correct: 1, explanation: "java.time là JDK, không có trên iOS." },
    { q: "Code trong iosMain gọi UIDevice thế nào?", options: [
        "Qua JNI",
        "Import platform.UIKit.UIDevice — binding được Kotlin/Native sinh từ header Objective-C",
        "Phải viết Swift rồi gọi ngược",
        "Không gọi được"
      ], correct: 1, explanation: "Các package platform.* được sinh sẵn cho SDK Apple." },
    { q: "Vì sao thư viện KMP thường dùng sinh code lúc biên dịch thay vì reflection?", options: [
        "Vì reflection bị cấm trên Android",
        "Vì Kotlin/Native hỗ trợ reflection rất hạn chế",
        "Vì reflection chậm trên JVM",
        "Vì Gradle yêu cầu"
      ], correct: 1, explanation: "Ví dụ kotlinx.serialization là compiler plugin chứ không đọc field bằng reflection như Jackson." },
    { q: "Trong Shared.framework cuối cùng có gì?", options: [
        "Chỉ code của bạn",
        "Code của bạn, các thư viện Kotlin nó dùng, và runtime Kotlin/Native (GC...)",
        "Một JVM thu gọn",
        "Chỉ header Objective-C"
      ], correct: 1, explanation: "Tất cả được link thành một binary." },
    { q: "Một thư viện KMP publish lên Maven gồm những gì?", options: [
        "Một file jar duy nhất",
        "Nhiều artifact theo target (jar, aar, klib...) cùng metadata để Gradle chọn đúng",
        "Chỉ source code",
        "Một file .framework"
      ], correct: 1, explanation: "Gradle đọc file .module để biết target nào dùng artifact nào." },
    { q: "Muốn tạo UUID trong commonMain, lựa chọn hợp lý là?", options: [
        "java.util.UUID",
        "kotlin.uuid.Uuid (Kotlin 2.0.20+, experimental) hoặc thư viện đa nền tảng",
        "NSUUID",
        "Không thể"
      ], correct: 1, explanation: "NSUUID chỉ có ở iosMain, java.util.UUID chỉ có ở JVM/Android." }
  ]
});
