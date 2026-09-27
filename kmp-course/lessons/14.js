window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Kiến trúc chia sẻ",
  title: "Compose Multiplatform — khi nào nên chia sẻ cả UI",
  subtitle: "Skia vẽ trên iOS · ComposeUIViewController · nhúng vào SwiftUI và ngược lại · resources · tiêu chí chọn",

  theory: `
    <p><strong>Compose Multiplatform (CMP)</strong> là bản đa nền tảng của Jetpack Compose do JetBrains phát triển. Trên Android nó <em>chính là</em> Jetpack Compose;
    trên iOS, desktop, web nó dùng <strong>Skia</strong> (qua thư viện Skiko) để tự vẽ mọi pixel. iOS stable từ CMP 1.8.0.</p>

    <p><strong>Trên iOS hoạt động thế nào</strong></p>
    <ul>
      <li>Hàm Kotlin <code>ComposeUIViewController { App() }</code> trả về một <code>UIViewController</code>. Bên trong là một view vẽ bằng Metal.</li>
      <li>SwiftUI nhúng nó qua <code>UIViewControllerRepresentable</code>. Nghĩa là có thể chỉ một màn hình là CMP, phần còn lại SwiftUI.</li>
      <li>Ngược lại, trong Compose nhúng view native bằng <code>UIKitView</code>/<code>UIKitViewController</code> (bản đồ, camera, video player, WebView).</li>
      <li>Hỗ trợ accessibility (VoiceOver), nhập liệu, cuộn có quán tính kiểu iOS; nhưng component vẫn là của Compose/Material, không phải UIKit — nhìn và "cảm giác" khác app SwiftUI nếu không tuỳ chỉnh.</li>
    </ul>

    <p><strong>Resources</strong>: đặt ảnh, chuỗi, font trong <code>commonMain/composeResources/</code> (<code>drawable/</code>, <code>values/strings.xml</code>, <code>font/</code>). Plugin sinh class <code>Res</code>:
    <code>painterResource(Res.drawable.logo)</code>, <code>stringResource(Res.string.title)</code>. Đa ngôn ngữ bằng <code>values-vi/</code>.</p>

    <p><strong>Gradle</strong>: plugin <code>org.jetbrains.compose</code> + <code>org.jetbrains.kotlin.plugin.compose</code> (compose compiler nằm trong Kotlin từ 2.0, phiên bản trùng Kotlin).</p>

    <table>
      <tr><th>Nên dùng CMP khi</th><th>Nên UI native khi</th></tr>
      <tr><td>Đội nhỏ, đa số là dev Kotlin/Android</td><td>Có dev iOS mạnh, muốn trải nghiệm iOS "chuẩn"</td></tr>
      <tr><td>Màn hình form, cài đặt, admin nội bộ, danh sách đơn giản</td><td>Màn hình chủ lực cần cảm giác native, animation hệ thống, widget, Live Activity</td></tr>
      <tr><td>Thiết kế riêng của thương hiệu (không theo iOS/Material)</td><td>Dùng nhiều tính năng mới của SwiftUI/UIKit ngay khi ra</td></tr>
      <tr><td>Muốn thêm desktop/web cùng UI</td><td>Kích thước app và thời gian khởi động rất nhạy</td></tr>
    </table>

    <div class="callout"><p>💡 So với React Native mà team đang dùng: CMP giống RN ở chỗ viết UI một lần, nhưng khác ở chỗ không có JS/bridge (code là native) và UI tự vẽ (như Flutter) thay vì điều khiển UIView.
    Lựa chọn thực tế cho công ty: <strong>logic KMP + UI native</strong> cho màn hình chính, <strong>CMP</strong> cho vài màn phụ để tiết kiệm công.</p></div>
  `,

  codeTabs: [
    { id: "common", label: "UI chung", lines: [
      "// commonMain/App.kt",
      "@Composable",
      "fun SettingsScreen(vm: SettingsViewModel) {",
      "    val ui by vm.state.collectAsState()",
      "    Column(Modifier.padding(16.dp)) {",
      "        Image(painterResource(Res.drawable.logo), contentDescription = null)",
      "        Text(stringResource(Res.string.settings_title), style = MaterialTheme.typography.titleLarge)",
      "        Row(verticalAlignment = Alignment.CenterVertically) {",
      "            Text(stringResource(Res.string.dark_mode))",
      "            Switch(checked = ui.dark, onCheckedChange = vm::onDarkChanged)",
      "        }",
      "    }",
      "}"
    ]},
    { id: "ios", label: "iOS entry", lines: [
      "// iosMain/MainViewController.kt",
      "fun SettingsViewController(): UIViewController = ComposeUIViewController {",
      "    SettingsScreen(Deps.settingsViewModel())",
      "}",
      "",
      "// Swift — nhúng một màn CMP vào app SwiftUI",
      "struct SettingsView: UIViewControllerRepresentable {",
      "    func makeUIViewController(context: Context) -> UIViewController {",
      "        MainViewControllerKt.SettingsViewController()",
      "    }",
      "    func updateUIViewController(_ vc: UIViewController, context: Context) {}",
      "}"
    ]},
    { id: "interop", label: "Nhúng view native", lines: [
      "// iosMain — dùng MKMapView bên trong Compose",
      "@OptIn(ExperimentalForeignApi::class)",
      "@Composable",
      "fun StoreMap(modifier: Modifier) {",
      "    UIKitView(",
      "        factory = { MKMapView() },",
      "        modifier = modifier,",
      "    )",
      "}",
      "// commonMain: expect @Composable fun StoreMap(modifier: Modifier)"
    ]},
    { id: "gradle", label: "Gradle & resources", lines: [
      "plugins {",
      "    alias(libs.plugins.kotlin.multiplatform)",
      "    alias(libs.plugins.compose.multiplatform)   // org.jetbrains.compose",
      "    alias(libs.plugins.compose.compiler)        // org.jetbrains.kotlin.plugin.compose",
      "}",
      "",
      "# thư mục resources",
      "# shared/src/commonMain/composeResources/drawable/logo.xml",
      "# shared/src/commonMain/composeResources/values/strings.xml",
      "# shared/src/commonMain/composeResources/values-vi/strings.xml",
      "# → sinh class Res: Res.drawable.logo, Res.string.settings_title"
    ]}
  ],

  stageHtml: `
    <div class="node" id="c"><div class="nl">🎨 @Composable SettingsScreen</div><div class="ns">commonMain</div></div>
    <div class="row">
      <div class="node" id="a"><div class="nl">🤖 Android</div><div class="ns">= Jetpack Compose</div></div>
      <div class="node" id="i"><div class="nl">🍎 ComposeUIViewController</div><div class="ns">Skia vẽ qua Metal</div></div>
    </div>
    <div class="arrow" id="a1">↓ UIViewControllerRepresentable</div>
    <div class="node" id="sw"><div class="nl">🦅 App SwiftUI</div><div class="ns">màn chính native, màn Settings là CMP</div></div>
    <div class="node" id="uk"><div class="nl">🗺️ UIKitView(MKMapView)</div><div class="ns">view native bên trong Compose</div></div>
  `,
  steps: [
    { title: "1 · Viết UI một lần", tab: "common", highlight: [2, 3, 4, 6, 7, 10], on: ["c"],
      desc: "Composable dùng chung, đọc state từ ViewModel shared, ảnh và chuỗi lấy từ Res." },
    { title: "2 · Android dùng thẳng", tab: "common", highlight: [3], on: ["a"],
      desc: "Trên Android, CMP chính là Jetpack Compose — không có lớp trung gian." },
    { title: "3 · iOS nhận một UIViewController", tab: "ios", highlight: [2, 3], on: ["i"],
      desc: "ComposeUIViewController tạo controller chứa view vẽ bằng Skia/Metal." },
    { title: "4 · Nhúng vào SwiftUI", tab: "ios", highlight: [7, 8, 9], on: ["a1", "sw"],
      desc: "Chỉ màn Settings là CMP; các màn khác vẫn SwiftUI. Áp dụng từng màn được." },
    { title: "5 · View native trong Compose", tab: "interop", highlight: [5, 6, 7, 10], on: ["uk"],
      desc: "Bản đồ, camera, video: dùng view hệ thống qua UIKitView, khai báo expect ở common." },
    { title: "6 · Cấu hình & resources", tab: "gradle", highlight: [3, 4, 8, 9, 10, 11], on: ["c"],
      desc: "Hai plugin: framework Compose và compose compiler (đi cùng phiên bản Kotlin). Resources đặt trong composeResources." }
  ],

  quiz: [
    { q: "Compose Multiplatform trên Android là gì?", options: [
        "Một engine vẽ riêng", "Chính là Jetpack Compose", "WebView", "Flutter"
      ], correct: 1, explanation: "Khác biệt chỉ nằm ở các nền tảng khác." },
    { q: "CMP vẽ UI trên iOS bằng gì?", options: [
        "UIKit component", "Skia (Skiko) trên Metal", "SwiftUI", "Core Animation layer của từng widget"
      ], correct: 1, explanation: "Tự vẽ, giống cách Flutter làm." },
    { q: "Làm sao đưa một màn CMP vào app SwiftUI?", options: [
        "Không thể",
        "ComposeUIViewController trả UIViewController, SwiftUI bọc bằng UIViewControllerRepresentable",
        "Chuyển cả app sang CMP",
        "Dùng WebView"
      ], correct: 1, explanation: "Cho phép áp dụng từng màn." },
    { q: "Muốn dùng MKMapView bên trong Compose trên iOS?", options: [
        "Không thể", "UIKitView(factory = { MKMapView() })", "Vẽ lại bản đồ bằng Canvas", "Dùng Android MapView"
      ], correct: 1, explanation: "Interop hai chiều." },
    { q: "Resources của CMP đặt ở đâu?", options: [
        "iosApp/Assets.xcassets", "commonMain/composeResources/", "res/ của Android", "assets/"
      ], correct: 1, explanation: "Plugin sinh class Res truy cập type-safe." },
    { q: "Plugin compose compiler từ Kotlin 2.0 là?", options: [
        "androidx.compose.compiler riêng phiên bản", "org.jetbrains.kotlin.plugin.compose — cùng phiên bản với Kotlin", "kapt", "Không cần"
      ], correct: 1, explanation: "Compose compiler đã vào repo Kotlin." },
    { q: "Trường hợp nào KHÔNG hợp dùng CMP?", options: [
        "Màn cài đặt đơn giản",
        "Màn chủ lực cần cảm giác iOS chuẩn, widget, Live Activity",
        "Admin nội bộ",
        "Form nhập liệu"
      ], correct: 1, explanation: "Những thứ đó native làm tốt hơn (widget/Live Activity phải là SwiftUI)." },
    { q: "Điểm giống và khác của CMP so với React Native?", options: [
        "Giống hoàn toàn",
        "Giống: viết UI một lần. Khác: không có JS/bridge và UI tự vẽ thay vì điều khiển UIView",
        "CMP dùng JS",
        "RN tự vẽ bằng Skia"
      ], correct: 1, explanation: "RN render component native; CMP tự vẽ." },
    { q: "CMP cho iOS stable từ phiên bản nào?", options: [
        "1.0", "1.8.0", "Chưa stable", "2.5"
      ], correct: 1, explanation: "Công bố tháng 5/2025." }
  ]
});
