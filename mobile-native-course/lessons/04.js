window.LESSONS.push({
  id: "04",
  phase: "0", phaseName: "Hệ điều hành & vòng đời",
  title: "iOS App/Scene lifecycle & vòng đời trong SwiftUI / Compose",
  subtitle: "AppDelegate · SceneDelegate · scenePhase · composition/recomposition · onAppear / LaunchedEffect",

  theory: `
    <p><strong>iOS từ 13 tách hai tầng</strong>: <em>App</em> (process — khởi động, push token, cấu hình chung) và <em>Scene</em> (một cửa sổ UI; iPad có thể có nhiều scene cùng lúc).</p>
    <table>
      <tr><th>Tầng</th><th>UIKit</th><th>SwiftUI</th></tr>
      <tr><td>App</td><td><code>UIApplicationDelegate</code>: <code>didFinishLaunchingWithOptions</code>, <code>didRegisterForRemoteNotificationsWithDeviceToken</code></td><td><code>@main struct ShopApp: App</code> + <code>@UIApplicationDelegateAdaptor</code> khi cần</td></tr>
      <tr><td>Scene</td><td><code>UISceneDelegate</code>: <code>sceneDidBecomeActive</code>, <code>sceneWillResignActive</code>, <code>sceneDidEnterBackground</code></td><td><code>@Environment(\\.scenePhase)</code>: <code>.active</code>, <code>.inactive</code>, <code>.background</code></td></tr>
      <tr><td>Màn hình</td><td><code>UIViewController</code>: <code>viewDidLoad</code>, <code>viewWillAppear</code>, <code>viewDidAppear</code>, <code>viewDidDisappear</code></td><td><code>.onAppear</code>, <code>.onDisappear</code>, <code>.task</code></td></tr>
    </table>
    <p>Apple đang đẩy mạnh scene-based lifecycle: app mới nên dùng scene; các callback trạng thái ở AppDelegate (như <code>applicationDidEnterBackground</code>) không được gọi khi app đã dùng scene.</p>

    <p><strong>UI khai báo (SwiftUI, Jetpack Compose) có vòng đời khác hẳn</strong>. Bạn không giữ đối tượng view; bạn viết một <em>hàm mô tả UI từ state</em>.
    Khi state đổi, framework gọi lại hàm (Compose: <strong>recomposition</strong>; SwiftUI: tính lại <code>body</code>) rồi so sánh để cập nhật phần thay đổi.</p>
    <ul>
      <li><strong>Compose</strong>: composable <em>vào</em> composition → có thể recompose nhiều lần → <em>rời</em> composition. Biến cục bộ bị tạo lại mỗi lần; muốn giữ qua recomposition dùng <code>remember</code>, qua xoay màn/process death dùng <code>rememberSaveable</code>.
      Side effect: <code>LaunchedEffect(key)</code> chạy coroutine khi vào composition và huỷ khi rời (hoặc khi key đổi); <code>DisposableEffect</code> có <code>onDispose</code> để dọn dẹp.</li>
      <li><strong>SwiftUI</strong>: struct <code>View</code> là giá trị rẻ, bị tạo lại liên tục — <em>không</em> đặt logic khởi tạo tốn kém trong <code>init</code>. Trạng thái sống trong storage do SwiftUI quản lý, gắn với <strong>identity</strong> của view: <code>@State</code>, <code>@StateObject</code>/<code>@State</code> với <code>@Observable</code>.
      <code>.task</code> chạy async khi view xuất hiện và tự huỷ khi biến mất.</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc vàng cho cả hai: hàm UI phải <strong>thuần và rẻ</strong> — có thể bị gọi hàng chục lần mỗi giây. Gọi API, ghi DB trong thân composable/body là lỗi; đặt vào effect (<code>LaunchedEffect</code>/<code>.task</code>) hoặc ViewModel.</p></div>
  `,

  codeTabs: [
    { id: "scene", label: "① iOS: App & Scene", lines: [
      "@main",
      "struct ShopApp: App {",
      "    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate",
      "    @Environment(\\.scenePhase) private var phase",
      "",
      "    var body: some Scene {",
      "        WindowGroup { RootView() }",
      "            .onChange(of: phase) { _, newPhase in",
      "                if newPhase == .background { draftStore.save() }",
      "            }",
      "    }",
      "}"
    ]},
    { id: "swiftui", label: "② SwiftUI view", lines: [
      "struct ProductView: View {",
      "    let id: String",
      "    @State private var product: Product?      // storage do SwiftUI giữ",
      "",
      "    var body: some View {                      // bị tính lại nhiều lần",
      "        Text(product?.name ?? \"Đang tải…\")",
      "            .task(id: id) {                    // chạy khi xuất hiện, huỷ khi biến mất",
      "                product = try? await api.product(id)",
      "            }",
      "            .onDisappear { analytics.leave(id) }",
      "    }",
      "}"
    ]},
    { id: "compose", label: "③ Compose", lines: [
      "@Composable",
      "fun ProductScreen(id: String, api: Api) {",
      "    var product by remember(id) { mutableStateOf<Product?>(null) }",
      "    var qty by rememberSaveable { mutableStateOf(1) }   // sống qua xoay màn",
      "",
      "    LaunchedEffect(id) { product = api.product(id) }   // huỷ khi rời / id đổi",
      "",
      "    DisposableEffect(Unit) {",
      "        tracker.enter(id)",
      "        onDispose { tracker.leave(id) }",
      "    }",
      "    Text(product?.name ?: \"Đang tải…\")",
      "}"
    ]},
    { id: "bad", label: "④ Lỗi hay gặp", lines: [
      "@Composable",
      "fun Bad(api: Api) {",
      "    val list = api.loadSync()          // SAI: gọi mạng mỗi lần recompose",
      "    var count = 0                      // SAI: reset về 0 mỗi lần recompose",
      "    Button(onClick = { count++ }) { Text(\"$count\") }",
      "}",
      "",
      "struct BadView: View {",
      "    let vm = ProductVM()               // SAI: tạo lại mỗi khi parent render",
      "    var body: some View { Text(vm.title) }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🚀 App launch</div><div class="ns">didFinishLaunching / @main App</div></div>
    <div class="arrow" id="a1">↓ tạo scene / cửa sổ</div>
    <div class="node" id="scene"><div class="nl">🪟 Scene: active ⇄ inactive ⇄ background</div><div class="ns">scenePhase</div></div>
    <div class="arrow" id="a2">↓ view vào cây UI</div>
    <div class="node" id="enter"><div class="nl">🌱 Vào composition / xuất hiện</div><div class="ns">LaunchedEffect / .task bắt đầu</div></div>
    <div class="arrow" id="a3">↓ state đổi</div>
    <div class="node" id="re"><div class="nl">🔁 Recompose / tính lại body</div><div class="ns">remember / @State giữ giá trị</div></div>
    <div class="arrow" id="a4">↓ rời màn</div>
    <div class="node" id="leave"><div class="nl">🍂 Rời composition / biến mất</div><div class="ns">effect bị huỷ, onDispose</div></div>
  `,
  steps: [
    { title: "1 · App khởi động", tab: "scene", highlight: [1, 2, 3], on: ["app"],
      desc: "<code>@main</code> App là điểm vào. Việc cấp process (push token, SDK) vẫn có thể cần AppDelegate qua adaptor." },
    { title: "2 · Theo dõi scenePhase", tab: "scene", highlight: [4, 8, 9], on: ["a1", "scene"],
      desc: "Chuyển sang <code>.background</code> là lúc lưu nháp — vì sau đó app có thể bị suspend rồi bị giết." },
    { title: "3 · View xuất hiện, effect bắt đầu", tab: "swiftui", highlight: [3, 7, 8], on: ["a2", "enter"],
      desc: "<code>.task(id:)</code> chạy async khi view xuất hiện, tự huỷ khi biến mất hoặc id đổi." },
    { title: "4 · Compose: remember & LaunchedEffect", tab: "compose", highlight: [3, 4, 6], on: ["enter", "re"],
      desc: "<code>remember</code> giữ giá trị qua recomposition; <code>rememberSaveable</code> giữ cả qua xoay màn." },
    { title: "5 · Rời màn: dọn dẹp", tab: "compose", highlight: [8, 9, 10], on: ["a4", "leave"],
      desc: "<code>onDispose</code> chạy khi composable rời composition — tương tự <code>.onDisappear</code>." },
    { title: "6 · Tránh lỗi kinh điển", tab: "bad", highlight: [3, 4, 9], on: ["re"],
      desc: "Hàm UI bị gọi lại liên tục: gọi mạng hay tạo ViewModel trong đó là lãng phí và sai trạng thái." }
  ],

  quiz: [
    { q: "Từ iOS 13, tầng nào quản lý vòng đời từng cửa sổ UI?", options: [
        "UIApplicationDelegate", "UISceneDelegate / Scene", "UIViewController", "NotificationCenter"
      ], correct: 1, explanation: "Scene đại diện một instance UI; iPad có thể có nhiều scene." },
    { q: "Trong SwiftUI, đọc trạng thái active/background của cửa sổ bằng gì?", options: [
        "@Environment(\\.scenePhase)", "@State var phase", "UIApplication.state trong body", "onAppear"
      ], correct: 0, explanation: "scenePhase có các giá trị .active, .inactive, .background." },
    { q: "Trong Compose, biến khai báo 'var count = 0' trong composable sẽ…", options: [
        "Giữ giá trị giữa các lần recompose", "Reset mỗi lần recompose", "Lưu xuống disk", "Gây lỗi biên dịch"
      ], correct: 1, explanation: "Cần remember { mutableStateOf(0) } để giữ giá trị và để Compose biết mà recompose." },
    { q: "rememberSaveable khác remember ở chỗ nào?", options: [
        "Nhanh hơn", "Giá trị còn sống qua configuration change và process death (lưu vào saved state)", "Chạy trên background", "Không khác"
      ], correct: 1, explanation: "remember chỉ sống trong composition hiện tại." },
    { q: "LaunchedEffect(id) bị huỷ và chạy lại khi nào?", options: [
        "Mỗi lần recompose", "Khi id đổi; và bị huỷ khi composable rời composition", "Không bao giờ huỷ", "Khi app về nền"
      ], correct: 1, explanation: "Key điều khiển việc khởi động lại effect." },
    { q: "Vì sao không nên tạo ViewModel bằng 'let vm = ProductVM()' làm thuộc tính của struct View SwiftUI?", options: [
        "Swift không cho phép",
        "Struct View bị tạo lại liên tục nên VM cũng bị tạo lại, mất trạng thái",
        "Làm chậm biên dịch",
        "Không có vấn đề gì"
      ], correct: 1, explanation: "Dùng @StateObject (ObservableObject) hoặc @State (với @Observable) để SwiftUI giữ instance." },
    { q: ".task { } trong SwiftUI có đặc điểm gì?", options: [
        "Chạy trên thread riêng vĩnh viễn",
        "Chạy async khi view xuất hiện và tự động huỷ khi view biến mất",
        "Chỉ chạy khi app ở nền",
        "Tương đương DispatchQueue.main.sync"
      ], correct: 1, explanation: "Gắn vòng đời Task với vòng đời view." },
    { q: "Nguyên tắc cho thân composable / body SwiftUI là gì?", options: [
        "Có thể gọi API đồng bộ", "Thuần, rẻ, không side effect trực tiếp", "Chỉ được gọi một lần", "Phải chạy trên background thread"
      ], correct: 1, explanation: "Chúng có thể được gọi nhiều lần mỗi giây." },
    { q: "Nhận device token push trên iOS thuộc tầng nào?", options: [
        "Scene", "App (UIApplicationDelegate)", "View", "Không cần callback"
      ], correct: 1, explanation: "Token gắn với cả app, callback là didRegisterForRemoteNotificationsWithDeviceToken." }
  ]
});
