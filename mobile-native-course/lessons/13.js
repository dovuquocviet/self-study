window.LESSONS.push({
  id: "13",
  phase: "4", phaseName: "Kiến trúc app & tài nguyên hệ thống",
  title: "Điều hướng & back stack: task, NavController, NavigationStack, deep link",
  subtitle: "Activity task · single-Activity + Navigation Compose · UINavigationController / NavigationStack(path:) · predictive back",

  theory: `
    <p>Trên web, trình duyệt giữ lịch sử URL. Trên mobile, <strong>bạn</strong> (và OS) giữ một <em>ngăn xếp màn hình</em>: mở màn mới = push, Back = pop.
    Nắm back stack là tránh được lỗi "bấm Back quay về màn đăng nhập" hay "mở deep link xong không Back được".</p>

    <p><strong>Android — hai tầng</strong></p>
    <ul>
      <li><strong>Task</strong> (tầng OS): chuỗi Activity mà người dùng thấy trong Recents. <code>startActivity</code> push Activity mới lên task. <code>launchMode</code> (<code>singleTop</code>, <code>singleTask</code>…) và cờ Intent (<code>FLAG_ACTIVITY_CLEAR_TOP</code>, <code>NEW_TASK</code>) điều chỉnh cách push.</li>
      <li><strong>Trong app</strong>: kiến trúc hiện đại là <em>một Activity</em> + Navigation Compose. <code>NavController</code> giữ back stack các <em>destination</em>; mỗi entry có Lifecycle và ViewModelStore riêng (ViewModel theo màn bị clear khi entry bị pop).
      Navigation 2.8+ hỗ trợ route an toàn kiểu bằng <code>@Serializable</code> class.</li>
      <li><strong>Predictive back</strong> (Android 13+ opt-in, Android 15 bật animation mặc định cho app target 35): người dùng vuốt thấy trước màn phía sau. Xử lý Back bằng <code>OnBackPressedDispatcher</code>/<code>BackHandler</code>; <code>onBackPressed()</code> đã deprecated.</li>
    </ul>

    <p><strong>iOS</strong></p>
    <ul>
      <li>UIKit: <code>UINavigationController</code> giữ mảng <code>viewControllers</code>; <code>pushViewController</code> / <code>popViewController</code>. Modal (<code>present</code>) là một chồng riêng. Tab bar: mỗi tab thường có navigation stack riêng.</li>
      <li>SwiftUI (iOS 16+): <code>NavigationStack(path:)</code> — back stack là <strong>một mảng dữ liệu</strong> bạn sở hữu. Push = append, pop về gốc = <code>removeAll()</code>. Nhờ đó deep link hay khôi phục trạng thái chỉ là gán mảng.</li>
      <li>iOS không có nút Back hệ thống: Back là nút trên navigation bar + vuốt từ mép trái.</li>
    </ul>

    <p><strong>Deep link</strong>: URL mở thẳng một màn trong app. Custom scheme (<code>shop://product/42</code>) — ai cũng đăng ký được; <strong>App Links</strong> (Android) / <strong>Universal Links</strong> (iOS) dùng <code>https://</code> và được xác minh bằng file trên domain
    (<code>/.well-known/assetlinks.json</code>, <code>/.well-known/apple-app-site-association</code>). Khi mở từ deep link, cần dựng back stack <em>hợp lý</em> (Home → Product) để Back không thoát app đột ngột.</p>

    <div class="callout"><p>💡 Đăng nhập xong phải <strong>xoá màn login khỏi stack</strong>: Compose dùng <code>popUpTo(Login) { inclusive = true }</code>; SwiftUI thay root view hoặc reset path. Đây là lỗi hay gặp nhất khi vibe code điều hướng.</p></div>
  `,

  codeTabs: [
    { id: "nav", label: "① Navigation Compose", lines: [
      "@Serializable object Home",
      "@Serializable data class Product(val id: String)",
      "@Serializable object Login",
      "",
      "NavHost(navController, startDestination = Home) {",
      "    composable<Home>    { HomeScreen(onOpen = { navController.navigate(Product(it)) }) }",
      "    composable<Product> { entry ->",
      "        val args = entry.toRoute<Product>()",
      "        ProductScreen(args.id)          // viewModel() gắn với entry này",
      "    }",
      "    composable<Login> { LoginScreen(onDone = {",
      "        navController.navigate(Home) { popUpTo<Login> { inclusive = true } }",
      "    }) }",
      "}"
    ]},
    { id: "swift", label: "② SwiftUI NavigationStack", lines: [
      "enum Route: Hashable { case product(String), cart }",
      "",
      "struct RootView: View {",
      "    @State private var path: [Route] = []           // back stack là dữ liệu",
      "    var body: some View {",
      "        NavigationStack(path: $path) {",
      "            HomeView(open: { path.append(.product($0)) })",
      "                .navigationDestination(for: Route.self) { r in",
      "                    switch r {",
      "                    case .product(let id): ProductView(id: id)",
      "                    case .cart: CartView()",
      "                    }",
      "                }",
      "        }",
      "        .onOpenURL { url in path = DeepLink.parse(url) }  // [.product(\"42\")]",
      "    }",
      "}"
    ]},
    { id: "back", label: "③ Xử lý Back", lines: [
      "// Compose: chặn Back khi form chưa lưu",
      "BackHandler(enabled = hasUnsavedChanges) { showDiscardDialog = true }",
      "",
      "<!-- AndroidManifest.xml: bật predictive back -->",
      "<application android:enableOnBackInvokedCallback=\"true\" ...>",
      "",
      "// Stack sau khi đi Home -> Product(42) -> Cart:",
      "//   [Home, Product(42), Cart]  -- Back -> [Home, Product(42)]"
    ]},
    { id: "link", label: "④ App Links / Universal Links", lines: [
      "<!-- Android manifest -->",
      "<intent-filter android:autoVerify=\"true\">",
      "  <action android:name=\"android.intent.action.VIEW\"/>",
      "  <category android:name=\"android.intent.category.DEFAULT\"/>",
      "  <category android:name=\"android.intent.category.BROWSABLE\"/>",
      "  <data android:scheme=\"https\" android:host=\"shop.vn\" android:pathPrefix=\"/p/\"/>",
      "</intent-filter>",
      "",
      "# https://shop.vn/.well-known/assetlinks.json            (SHA-256 cert của app)",
      "# https://shop.vn/.well-known/apple-app-site-association (appID + paths)",
      "# iOS entitlement: applinks:shop.vn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="link"><div class="nl">🔗 Mở app / deep link</div><div class="ns">https://shop.vn/p/42</div></div>
    <div class="arrow" id="a1">↓ dựng stack hợp lý</div>
    <div class="row">
      <div class="node" id="home"><div class="nl">🏠 Home</div><div class="ns">gốc</div></div>
      <div class="node" id="prod"><div class="nl">📦 Product(42)</div><div class="ns">ViewModel riêng của entry</div></div>
      <div class="node" id="cart"><div class="nl">🛒 Cart</div><div class="ns">đỉnh stack</div></div>
    </div>
    <div class="arrow" id="a2">↓ Back / vuốt = pop</div>
    <div class="node" id="pop"><div class="nl">⬅️ Pop entry</div><div class="ns">Lifecycle DESTROYED, ViewModel cleared</div></div>
    <div class="arrow" id="a3">↓ đăng nhập xong</div>
    <div class="node" id="login"><div class="nl">🔐 popUpTo(Login, inclusive)</div><div class="ns">Back không quay lại login</div></div>
  `,
  steps: [
    { title: "1 · Khai báo route kiểu an toàn", tab: "nav", highlight: [1, 2, 5, 6], on: ["home"],
      desc: "Mỗi destination là một kiểu @Serializable; navigate(Product(id)) push lên stack." },
    { title: "2 · Mỗi entry có vòng đời riêng", tab: "nav", highlight: [7, 8, 9], on: ["prod"],
      desc: "ViewModel lấy trong composable gắn với back stack entry; pop là bị clear." },
    { title: "3 · SwiftUI: stack là mảng", tab: "swift", highlight: [4, 6, 7, 8], on: ["home", "prod", "cart"],
      desc: "Push = append vào path. Muốn về gốc chỉ cần path.removeAll()." },
    { title: "4 · Back = pop", tab: "back", highlight: [2, 5, 8], on: ["a2", "pop"],
      desc: "BackHandler chặn khi cần; bật predictive back trong manifest." },
    { title: "5 · Xoá login khỏi stack", tab: "nav", highlight: [11, 12], on: ["a3", "login"],
      desc: "popUpTo<Login> { inclusive = true } bỏ luôn Login, Back từ Home sẽ thoát app thay vì quay lại login." },
    { title: "6 · Deep link đã xác minh", tab: "link", highlight: [2, 6, 9, 10, 11], on: ["link", "a1"],
      desc: "App Links/Universal Links dùng https và file xác minh trên domain; mở xong dựng stack Home → Product." }
  ],

  quiz: [
    { q: "Trong Navigation Compose, ViewModel lấy trong một destination bị clear khi nào?", options: [
        "Khi xoay màn", "Khi back stack entry đó bị pop", "Khi app về nền", "Không bao giờ"
      ], correct: 1, explanation: "Mỗi entry là một ViewModelStoreOwner." },
    { q: "Sau khi đăng nhập, làm sao để Back từ Home không quay về Login?", options: [
        "Gọi finish() cho mọi thứ", "navigate(Home) { popUpTo<Login> { inclusive = true } }", "Ẩn nút Back", "Không làm được"
      ], correct: 1, explanation: "inclusive = true bỏ cả Login khỏi stack." },
    { q: "NavigationStack(path:) trong SwiftUI có ưu điểm gì?", options: [
        "Nhanh hơn UIKit", "Back stack là dữ liệu bạn sở hữu: deep link / khôi phục chỉ cần gán mảng", "Không cần NavigationLink", "Chỉ hỗ trợ iPad"
      ], correct: 1, explanation: "Push = append, pop về gốc = removeAll()." },
    { q: "Universal Links / App Links khác custom scheme (shop://) ở điểm nào?", options: [
        "Không khác", "Dùng https và được xác minh bằng file trên domain, app khác không chiếm được", "Chỉ chạy trên web", "Không cần cấu hình"
      ], correct: 1, explanation: "Custom scheme ai cũng có thể đăng ký trùng." },
    { q: "File xác minh App Links của Android đặt ở đâu?", options: [
        "Trong APK", "https://<domain>/.well-known/assetlinks.json", "Trong Play Console", "Trong Info.plist"
      ], correct: 1, explanation: "Chứa package name + SHA-256 chứng chỉ ký." },
    { q: "Cách được khuyến nghị để xử lý nút Back trong Android hiện đại?", options: [
        "Override onBackPressed()", "OnBackPressedDispatcher / BackHandler (hỗ trợ predictive back)", "Bắt KEYCODE_BACK", "Không thể xử lý"
      ], correct: 1, explanation: "onBackPressed đã deprecated từ API 33." },
    { q: "Mở deep link tới trang sản phẩm, stack nên như thế nào?", options: [
        "Chỉ [Product] để Back thoát app ngay",
        "Dựng stack hợp lý như [Home, Product] để Back về Home",
        "[Login, Home, Product] luôn", "Không quan trọng"
      ], correct: 1, explanation: "Trải nghiệm tự nhiên hơn, tránh thoát app bất ngờ." },
    { q: "Task trên Android là gì?", options: [
        "Một coroutine", "Chuỗi Activity người dùng thấy như một mục trong Recents", "Một WorkManager job", "Một process"
      ], correct: 1, explanation: "launchMode và cờ Intent điều chỉnh cách Activity vào task." },
    { q: "Trên iOS, present(vc, animated:) khác pushViewController ở đâu?", options: [
        "Không khác", "present tạo lớp modal riêng phía trên; push thêm vào stack của UINavigationController", "present chỉ cho alert", "push chỉ cho iPad"
      ], correct: 1, explanation: "Modal và navigation stack là hai cơ chế khác nhau." }
  ]
});
