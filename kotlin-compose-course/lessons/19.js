window.LESSONS.push({
  id: "19",
  phase: "4", phaseName: "Kiến trúc app",
  title: "Navigation trong Compose",
  subtitle: "Back stack · route type-safe bằng @Serializable · NavHost/composable<T> · toRoute · popUpTo · Navigation 3 · so với React Navigation",

  theory: `
    <p>App một-Activity: mọi "màn hình" là composable, và một thư viện điều hướng giữ <strong>back stack</strong> — danh sách màn hình đã mở; nút Back lấy phần tử trên cùng ra.
    Mỗi mục trong back stack (<code>NavBackStackEntry</code>) có lifecycle, <code>SavedStateHandle</code> và <strong>ViewModel riêng</strong> — ViewModel của màn chi tiết bị clear khi màn đó bị pop.</p>

    <p><strong>Navigation Compose (2.8+) — route type-safe</strong>. Route không còn là chuỗi <code>"product/{id}"</code> dễ gõ sai, mà là class <code>@Serializable</code>:</p>
    <ul>
      <li><code>@Serializable object Home</code> — màn không có tham số; <code>@Serializable data class ProductDetail(val id: Long)</code> — màn có tham số.</li>
      <li><code>NavHost(navController, startDestination = Home) { composable&lt;Home&gt; { ... } }</code> khai báo đồ thị.</li>
      <li><code>navController.navigate(ProductDetail(42))</code> để đi; <code>backStackEntry.toRoute&lt;ProductDetail&gt;()</code> hoặc <code>savedStateHandle.toRoute&lt;ProductDetail&gt;()</code> trong ViewModel để đọc tham số.</li>
      <li>Cần plugin <code>org.jetbrains.kotlin.plugin.serialization</code> + <code>kotlinx-serialization-json</code>. Bên dưới, thư viện vẫn chuyển object thành route/arguments, nên chỉ truyền
        <strong>ID và giá trị nhỏ</strong>, không truyền cả object Product (đọc lại từ repository).</li>
    </ul>

    <p><strong>Tuỳ chọn khi navigate</strong>: <code>popUpTo(Home) { inclusive = false }</code> — pop các màn phía trên Home (vd sau khi đặt hàng xong không cho Back về checkout);
    <code>launchSingleTop = true</code> — không tạo bản sao nếu màn đó đã ở đỉnh stack; <code>saveState</code>/<code>restoreState</code> — giữ stack riêng từng tab bottom navigation.</p>

    <p><strong>Nguyên tắc</strong>: composable màn hình <em>không</em> nhận <code>NavController</code>. Nó nhận lambda như <code>onOpenProduct: (Long) -&gt; Unit</code>; chỉ nơi khai báo NavHost mới gọi
    <code>navigate</code>. Màn hình vì vậy test/preview được và không phụ thuộc thư viện điều hướng.</p>

    <p><strong>Navigation 3</strong> (<code>androidx.navigation3</code>) là thư viện mới hơn được thiết kế riêng cho Compose: back stack là một <em>list state do bạn giữ</em>
    (<code>rememberNavBackStack</code>), điều hướng = <code>add</code>/<code>removeLastOrNull</code>, hiển thị bằng <code>NavDisplay</code>. Codebase hiện có đa phần dùng Navigation Compose 2.x; dự án mới nên cân nhắc Nav3.</p>

    <div class="callout"><p>💡 So với React Navigation: <code>createNativeStackNavigator</code> ↔ <code>NavHost</code>, <code>navigation.navigate('Product', { id })</code> ↔
    <code>navigate(ProductDetail(id))</code>, <code>route.params</code> ↔ <code>toRoute()</code>. Điểm hơn: tham số được kiểm tra kiểu lúc compile.
    Deep link (<code>https://shop.vn/p/42</code> mở thẳng màn chi tiết) khai báo bằng <code>deepLinks</code> trong <code>composable&lt;T&gt;</code> + intent-filter trong manifest.</p></div>
  `,

  codeTabs: [
    { id: "routes", label: "① Route type-safe", lines: [
      "@Serializable object Home",
      "@Serializable object Cart",
      "@Serializable data class ProductDetail(val id: Long)",
      "@Serializable data class OrderDone(val orderCode: String)",
      "",
      "// build.gradle.kts",
      "plugins { alias(libs.plugins.kotlin.serialization) }",
      "dependencies { implementation(libs.androidx.navigation.compose) }"
    ]},
    { id: "host", label: "② NavHost", lines: [
      "@Composable",
      "fun ShopNavHost(navController: NavHostController = rememberNavController()) {",
      "    NavHost(navController, startDestination = Home) {",
      "        composable<Home> {",
      "            HomeRoute(onOpenProduct = { id -> navController.navigate(ProductDetail(id)) })",
      "        }",
      "        composable<ProductDetail> { entry ->",
      "            val args = entry.toRoute<ProductDetail>()",
      "            ProductRoute(productId = args.id, onBack = { navController.popBackStack() })",
      "        }",
      "        composable<Cart> {",
      "            CartRoute(onOrderPlaced = { code ->",
      "                navController.navigate(OrderDone(code)) {",
      "                    popUpTo(Home)            // xoá Cart/Checkout khỏi stack",
      "                    launchSingleTop = true",
      "                }",
      "            })",
      "        }",
      "        composable<OrderDone> { OrderDoneRoute(it.toRoute<OrderDone>().orderCode) }",
      "    }",
      "}"
    ]},
    { id: "vm", label: "③ Tham số trong ViewModel", lines: [
      "@HiltViewModel",
      "class ProductViewModel @Inject constructor(",
      "    savedStateHandle: SavedStateHandle,",
      "    private val repo: ProductRepository",
      ") : ViewModel() {",
      "    private val productId = savedStateHandle.toRoute<ProductDetail>().id",
      "",
      "    val ui = repo.observeProduct(productId)       // đọc lại từ repo, không truyền cả object",
      "        .map { ProductUi.from(it) }",
      "        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)",
      "}"
    ]},
    { id: "nav3", label: "④ Navigation 3", lines: [
      "@Serializable data object Home : NavKey",
      "@Serializable data class ProductDetail(val id: Long) : NavKey",
      "",
      "@Composable",
      "fun ShopApp() {",
      "    val backStack = rememberNavBackStack(Home)       // back stack là state của bạn",
      "    NavDisplay(",
      "        backStack = backStack,",
      "        onBack = { backStack.removeLastOrNull() },",
      "        entryProvider = entryProvider {",
      "            entry<Home> { HomeRoute(onOpenProduct = { backStack.add(ProductDetail(it)) }) }",
      "            entry<ProductDetail> { key -> ProductRoute(key.id) }",
      "        }",
      "    )",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="home"><div class="nl">🏠 Home</div><div class="ns">startDestination</div></div>
    <div class="arrow" id="a1">↓ navigate(ProductDetail(42))</div>
    <div class="node" id="detail"><div class="nl">📦 ProductDetail(id=42)</div><div class="ns">entry riêng: ViewModel + SavedStateHandle</div></div>
    <div class="arrow" id="a2">↓ navigate(Cart) → đặt hàng</div>
    <div class="node" id="cart"><div class="nl">🛒 Cart</div><div class="ns">sẽ bị popUpTo(Home) xoá</div></div>
    <div class="arrow" id="a3">↓ navigate(OrderDone) { popUpTo(Home) }</div>
    <div class="node" id="done"><div class="nl">✅ Stack: [Home, OrderDone]</div><div class="ns">Back → về Home, không về giỏ</div></div>
  `,
  steps: [
    { title: "1 · Route là class", tab: "routes", highlight: [1, 3, 4, 7], on: ["home"],
      desc: "Object cho màn không tham số, data class cho màn có tham số. Cần plugin kotlinx.serialization." },
    { title: "2 · Khai báo đồ thị", tab: "host", highlight: [3, 4, 5], on: ["home"],
      desc: "NavHost với startDestination; màn hình nhận lambda, không nhận navController." },
    { title: "3 · Điều hướng có tham số", tab: "host", highlight: [5, 7, 8, 9], on: ["a1", "detail"],
      desc: "navigate(ProductDetail(id)) — sai kiểu tham số là lỗi compile. toRoute đọc lại object." },
    { title: "4 · ViewModel theo entry", tab: "vm", highlight: [3, 6, 8], on: ["detail"],
      desc: "Mỗi entry có ViewModel riêng; tham số route lấy từ SavedStateHandle, dữ liệu đầy đủ đọc từ repository." },
    { title: "5 · popUpTo sau khi đặt hàng", tab: "host", highlight: [12, 13, 14, 15], on: ["a2", "cart", "a3", "done"],
      desc: "Pop mọi màn phía trên Home rồi mới đẩy OrderDone: Back không quay lại giỏ đã thanh toán." },
    { title: "6 · Navigation 3", tab: "nav3", highlight: [1, 6, 9, 11, 12], on: ["done"],
      desc: "Back stack là SnapshotStateList bạn tự giữ; điều hướng chỉ là add/remove phần tử." }
  ],

  quiz: [
    { q: "Route type-safe trong Navigation Compose 2.8+ được khai báo bằng?", options: [
        "Chuỗi \"product/{id}\"", "Class/object có @Serializable", "Enum", "Annotation @Route"
      ], correct: 1, explanation: "Cần plugin kotlinx.serialization." },
    { q: "Đọc tham số route trong ViewModel bằng cách nào?", options: [
        "Truyền NavController vào ViewModel", "savedStateHandle.toRoute<ProductDetail>()", "Intent extras", "Biến global"
      ], correct: 1, explanation: "SavedStateHandle chứa arguments của entry." },
    { q: "Vì sao chỉ nên truyền ID qua navigation?", options: [
        "Giới hạn kiểu",
        "Tham số được lưu như arguments/saved state — object lớn tốn kém, dễ cũ; đọc lại từ repository là nguồn sự thật",
        "Navigation không hỗ trợ data class",
        "Để bảo mật"
      ], correct: 1, explanation: "Single source of truth." },
    { q: "navigate(OrderDone(code)) { popUpTo(Home) } làm gì?", options: [
        "Xoá Home",
        "Pop các màn phía trên Home rồi đẩy OrderDone; Back từ OrderDone về Home",
        "Mở Home mới",
        "Không làm gì"
      ], correct: 1, explanation: "inclusive = true mới xoá cả Home." },
    { q: "launchSingleTop = true tránh điều gì?", options: [
        "Crash", "Tạo bản sao khi màn đích đã ở đỉnh back stack (vd bấm tab hai lần)", "Mất tham số", "Animation"
      ], correct: 1, explanation: "Hay dùng với bottom navigation." },
    { q: "Vì sao composable màn hình không nên nhận NavController?", options: [
        "Không compile",
        "Để màn hình test/preview được và không phụ thuộc thư viện điều hướng; nhận lambda thay thế",
        "NavController chậm",
        "Bị rò rỉ bộ nhớ chắc chắn"
      ], correct: 1, explanation: "Điều hướng tập trung ở NavHost." },
    { q: "ViewModel của màn ProductDetail bị clear khi nào?", options: [
        "Khi xoay màn hình", "Khi entry ProductDetail bị pop khỏi back stack", "Khi app ra nền", "Không bao giờ"
      ], correct: 1, explanation: "ViewModel gắn với NavBackStackEntry." },
    { q: "Trong Navigation 3, back stack là gì?", options: [
        "Ẩn trong NavController", "Một list state do app tự giữ (rememberNavBackStack), điều hướng bằng add/remove", "File XML", "Bundle"
      ], correct: 1, explanation: "Hiển thị bằng NavDisplay + entryProvider." },
    { q: "Tương đương của route.params (React Navigation) trong Navigation Compose?", options: [
        "remember", "backStackEntry.toRoute<T>()", "LocalContext", "Intent"
      ], correct: 1, explanation: "Có kiểm tra kiểu lúc compile." }
  ]
});
