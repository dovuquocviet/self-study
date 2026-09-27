window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Toàn cảnh",
  title: "KMP là gì — chia sẻ cái gì, giữ native cái gì",
  subtitle: "Shared logic + UI native, hay Compose Multiplatform · so với React Native & Flutter",

  theory: `
    <p><strong>Kotlin Multiplatform (KMP)</strong> là công nghệ của JetBrains cho phép viết code Kotlin một lần rồi <em>biên dịch</em> ra nhiều nền tảng:
    Android (bytecode JVM/ART), iOS (mã máy qua Kotlin/Native), desktop (JVM), web (JS/Wasm), server. Điểm then chốt: KMP <strong>không phải runtime</strong> chạy kèm app,
    không có "cầu nối" JS nào. Code chung được dịch thành đúng thứ mà nền tảng đó hiểu.</p>

    <p><strong>Hai cách dùng</strong></p>
    <ul>
      <li><strong>Chia sẻ logic, UI native</strong>: networking, cache, validation, business rule, ViewModel nằm trong module <code>shared</code>. UI viết bằng Jetpack Compose (Android) và SwiftUI (iOS). Đây là cách phổ biến nhất khi đội đã có hoặc muốn có kỹ sư native.</li>
      <li><strong>Compose Multiplatform (CMP)</strong>: chia sẻ luôn cả UI bằng Compose. Trên iOS, Compose tự vẽ bằng Skia (qua Skiko) lên một UIView, không dùng UIKit component. CMP cho iOS stable từ bản 1.8.0 (5/2025).</li>
    </ul>
    <p>Bạn có thể trộn: phần lớn màn hình native, vài màn hình ít đặc thù (cài đặt, form) dùng CMP. KMP cho phép chia sẻ <em>từng phần</em> chứ không "tất cả hoặc không".</p>

    <table>
      <tr><th></th><th>React Native</th><th>Flutter</th><th>KMP + UI native</th><th>Compose Multiplatform</th></tr>
      <tr><td>Ngôn ngữ</td><td>JS/TS</td><td>Dart</td><td>Kotlin (+ Swift cho UI iOS)</td><td>Kotlin</td></tr>
      <tr><td>Chạy thế nào</td><td>JS trong Hermes, gọi native qua JSI/TurboModule</td><td>Dart AOT + engine tự vẽ (Impeller)</td><td>Mã native/bytecode, không runtime trung gian</td><td>Như KMP; UI tự vẽ bằng Skia</td></tr>
      <tr><td>UI</td><td>Component native (View/UIView) điều khiển từ JS</td><td>Widget tự vẽ</td><td>SwiftUI / Compose thật</td><td>Compose tự vẽ</td></tr>
      <tr><td>Chia sẻ</td><td>Gần như tất cả</td><td>Gần như tất cả</td><td>Logic (thường 40–70% code)</td><td>Logic + UI</td></tr>
      <tr><td>Áp dụng dần vào app có sẵn</td><td>Được nhưng nặng</td><td>Add-to-app, nặng</td><td>Rất dễ: chỉ là 1 thư viện</td><td>Dễ, nhúng từng màn</td></tr>
    </table>

    <p><strong>Góc nhìn Java/Spring</strong>: module <code>shared</code> giống một thư viện <code>core</code> (domain + service + client) mà nhiều ứng dụng cùng phụ thuộc.
    Khác biệt: thư viện này được biên dịch thành <em>nhiều định dạng</em> — .aar/.jar cho Android và .framework cho iOS.</p>

    <div class="callout"><p>💡 Câu hỏi đúng không phải "KMP hay native" mà là "dòng code nào đáng viết hai lần?". UI, animation, tích hợp hệ điều hành thường đáng làm native cho trải nghiệm tốt.
    Parse JSON, gọi API, rule tính giá, đồng bộ offline thì viết hai lần chỉ sinh ra hai bộ bug khác nhau.</p></div>
  `,

  codeTabs: [
    { id: "shared", label: "commonMain", lines: [
      "// shared/src/commonMain/kotlin/cart/CartCalculator.kt",
      "package com.shop.cart",
      "",
      "data class CartLine(val sku: String, val price: Long, val qty: Int)",
      "",
      "class CartCalculator {",
      "    fun subtotal(lines: List<CartLine>): Long =",
      "        lines.sumOf { it.price * it.qty }",
      "",
      "    fun shippingFee(subtotal: Long): Long =",
      "        if (subtotal >= 500_000) 0 else 30_000",
      "}"
    ]},
    { id: "android", label: "Android (Compose)", lines: [
      "// androidApp — gọi thẳng như một class Kotlin bình thường",
      "@Composable",
      "fun CartTotal(lines: List<CartLine>) {",
      "    val calc = remember { CartCalculator() }",
      "    val sub = calc.subtotal(lines)",
      "    Text(\"Tạm tính: $sub · Ship: ${calc.shippingFee(sub)}\")",
      "}"
    ]},
    { id: "ios", label: "iOS (SwiftUI)", lines: [
      "// iosApp — framework 'Shared' do Kotlin/Native sinh ra",
      "import SwiftUI",
      "import Shared",
      "",
      "struct CartTotal: View {",
      "    let lines: [CartLine]",
      "    let calc = CartCalculator()",
      "    var body: some View {",
      "        let sub = calc.subtotal(lines: lines)",
      "        Text(\"Tạm tính: \\(sub) · Ship: \\(calc.shippingFee(subtotal: sub))\")",
      "    }",
      "}"
    ]},
    { id: "rn", label: "So với RN", lines: [
      "// React Native: logic trong JS, chạy trong Hermes",
      "const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);",
      "// Muốn gọi code native → viết TurboModule, dữ liệu đi qua JSI",
      "",
      "// KMP: CartCalculator đã là class native trên cả 2 nền tảng",
      "//   Android: bytecode trong APK, như code Kotlin bạn tự viết",
      "//   iOS    : mã máy ARM64 trong Shared.framework, Swift gọi trực tiếp",
      "// → không có bridge, không có JS engine đi kèm"
    ]}
  ],

  stageHtml: `
    <div class="node" id="n1"><div class="nl">📦 shared/commonMain</div><div class="ns">CartCalculator (Kotlin thuần)</div></div>
    <div class="row">
      <div class="arrow" id="a1">↙ Kotlin/JVM</div>
      <div class="arrow" id="a2">↘ Kotlin/Native</div>
    </div>
    <div class="row">
      <div class="node" id="n2"><div class="nl">🤖 Android</div><div class="ns">bytecode trong APK</div></div>
      <div class="node" id="n3"><div class="nl">🍎 iOS</div><div class="ns">Shared.framework (ARM64)</div></div>
    </div>
    <div class="row">
      <div class="node" id="n4"><div class="nl">Jetpack Compose</div><div class="ns">UI native Android</div></div>
      <div class="node" id="n5"><div class="nl">SwiftUI</div><div class="ns">UI native iOS</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Viết logic một lần", tab: "shared", highlight: [4, 6, 7, 8, 10, 11], on: ["n1"],
      desc: "Code trong commonMain chỉ dùng Kotlin chuẩn + thư viện đa nền tảng, không đụng API Android hay iOS." },
    { title: "2 · Android dùng như code thường", tab: "android", highlight: [4, 5, 6], on: ["a1", "n2", "n4"],
      desc: "Trên Android, shared chỉ là một module Kotlin. Không có lớp bọc nào." },
    { title: "3 · iOS gọi qua framework", tab: "ios", highlight: [3, 7, 9, 10], on: ["a2", "n3", "n5"],
      desc: "Kotlin/Native biên dịch shared thành Shared.framework. Swift <code>import Shared</code> rồi gọi class như class Objective-C." },
    { title: "4 · Khác React Native ở đâu", tab: "rn", highlight: [2, 3, 6, 7, 8], on: ["n1", "n2", "n3"],
      desc: "RN chạy JS trong engine và gọi native qua JSI. KMP không có engine: code đã là native ngay lúc biên dịch." }
  ],

  quiz: [
    { q: "KMP chạy code chung trên iOS bằng cách nào?", options: [
        "Nhúng JVM vào app iOS",
        "Biên dịch Kotlin thành mã máy qua Kotlin/Native, đóng gói thành framework",
        "Chuyển Kotlin sang JavaScript rồi chạy trong JavaScriptCore",
        "Chạy trong WebView"
      ], correct: 1, explanation: "Kotlin/Native dùng LLVM để sinh mã máy; không có máy ảo nào đi kèm." },
    { q: "Cách dùng KMP phổ biến nhất khi đội muốn giữ trải nghiệm native là gì?", options: [
        "Chia sẻ logic trong module shared, UI viết bằng Compose (Android) và SwiftUI (iOS)",
        "Viết toàn bộ bằng Compose Multiplatform",
        "Viết UI bằng HTML",
        "Chỉ chia sẻ file cấu hình"
      ], correct: 0, explanation: "Đây là mô hình \"shared logic, native UI\" — mỗi nền tảng giữ UI của mình." },
    { q: "Compose Multiplatform trên iOS vẽ UI thế nào?", options: [
        "Chuyển mỗi composable thành UIKit view tương ứng",
        "Tự vẽ bằng Skia (qua Skiko) lên một view, không dùng UIKit component",
        "Dùng SwiftUI bên dưới",
        "Dùng WebView"
      ], correct: 1, explanation: "Giống Flutter ở điểm tự vẽ; có thể nhúng view UIKit khi cần qua interop." },
    { q: "So với React Native, KMP khác cơ bản ở điểm nào?", options: [
        "KMP cũng có JS engine nhưng nhanh hơn",
        "KMP không có runtime/bridge trung gian; code chung đã là native lúc biên dịch",
        "KMP chỉ chạy trên Android",
        "KMP bắt buộc dùng chung UI"
      ], correct: 1, explanation: "RN chạy JS trong Hermes; KMP sinh bytecode/mã máy." },
    { q: "Vì sao KMP dễ áp dụng dần vào app có sẵn?", options: [
        "Vì nó thay thế toàn bộ app ngay",
        "Vì module shared chỉ là một thư viện (Android module / iOS framework) mà app hiện tại phụ thuộc vào",
        "Vì nó không cần Gradle",
        "Vì nó chạy trên server"
      ], correct: 1, explanation: "Có thể bắt đầu bằng một tính năng nhỏ, ví dụ phần tính giá giỏ hàng." },
    { q: "Phần nào thường ÍT đáng chia sẻ nhất khi chọn \"shared logic, native UI\"?", options: [
        "Parse JSON từ API",
        "Business rule tính phí ship",
        "Animation và tích hợp sâu với UI hệ điều hành",
        "Cache offline"
      ], correct: 2, explanation: "UI và tương tác đặc thù nền tảng là thứ native làm tốt nhất." },
    { q: "Flutter khác KMP + UI native ở đâu?", options: [
        "Flutter dùng Kotlin",
        "Flutter viết bằng Dart và tự vẽ toàn bộ UI bằng engine riêng",
        "Flutter dùng SwiftUI trên iOS",
        "Flutter không chạy trên iOS"
      ], correct: 1, explanation: "Flutter chia sẻ gần như 100% nhưng UI không phải component native." },
    { q: "Trên Android, code commonMain được dùng thế nào?", options: [
        "Qua một bridge giống JNI",
        "Như một module Kotlin bình thường, biên dịch ra bytecode chung với app",
        "Qua WebAssembly",
        "Qua AIDL"
      ], correct: 1, explanation: "Với Android, KMP gần như trong suốt." },
    { q: "Có bắt buộc chọn giữa \"UI native\" và \"Compose Multiplatform\" cho cả app không?", options: [
        "Có, không trộn được",
        "Không, có thể dùng CMP cho vài màn hình và native cho phần còn lại",
        "Chỉ trộn được trên Android",
        "Chỉ trộn được trên desktop"
      ], correct: 1, explanation: "CMP có thể nhúng như một UIViewController trong app SwiftUI/UIKit." }
  ]
});
