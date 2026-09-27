window.LESSONS.push({
  id: "18",
  phase: "6", phaseName: "Chuyển đổi & tổng kết",
  title: "Lộ trình chuyển dần từ React Native sang KMP + UI native",
  subtitle: "Strangler fig cho mobile · KMP làm native module cho RN · thay từng màn · khi nào tắt RN",

  theory: `
    <p>Viết lại toàn bộ app một lần là rủi ro lớn nhất (tính năng đứng im hàng tháng, bug mới). Cách an toàn là <strong>strangler fig</strong> — giống cách tách monolith Java thành service:
    bọc hệ thống cũ, thay từng phần, đến khi phần cũ không còn gì.</p>

    <p><strong>Giai đoạn 0 — Chuẩn bị</strong></p>
    <ul>
      <li>Liệt kê nghiệp vụ nằm trong JS: gọi API, tính giá, giỏ hàng, xác thực, cache. Đây là ứng viên chuyển vào KMP.</li>
      <li>Tạo module <code>shared</code>, CI build Android + XCFramework, bộ test commonTest. Đặt "hợp đồng" API backend (OpenAPI) làm nguồn sinh DTO nếu được.</li>
    </ul>

    <p><strong>Giai đoạn 1 — KMP làm "bộ não" cho app RN</strong></p>
    <ul>
      <li>Viết logic trong KMP, lộ ra cho JS qua <strong>native module</strong> (TurboModule): Android gọi thẳng Kotlin; iOS module Objective-C/Swift gọi <code>Shared.framework</code>.</li>
      <li>JS chỉ còn gọi <code>ShopCore.getCart()</code> — dần bỏ logic trùng lặp trong JS. Ranh giới JS ↔ native truyền dữ liệu đơn giản (JSON string/map).</li>
      <li>Giá trị: logic đã được kiểm chứng trong production <em>trước</em> khi thay UI.</li>
    </ul>

    <p><strong>Giai đoạn 2 — Màn hình native mới trong app RN (brownfield)</strong></p>
    <ul>
      <li>Tính năng mới viết bằng Compose/SwiftUI, dùng ViewModel KMP. Điều hướng giữa màn RN và màn native qua một module điều hướng.</li>
      <li>Chọn màn ít phụ thuộc trước (cài đặt, lịch sử đơn), để lại màn phức tạp nhiều state chung (checkout) cho sau.</li>
    </ul>

    <p><strong>Giai đoạn 3 — Đảo chiều: app native là vỏ</strong></p>
    <ul>
      <li>Khi phần lớn màn đã native, đổi vỏ app thành native; các màn RN còn lại nhúng như một view (RN hỗ trợ nhúng vào app native).</li>
      <li>Thay nốt, cuối cùng gỡ React Native, Hermes, Metro khỏi build → app nhỏ và khởi động nhanh hơn.</li>
    </ul>

    <table>
      <tr><th>Rủi ro</th><th>Cách giảm</th></tr>
      <tr><td>Hai nguồn state (JS và Kotlin) lệch nhau</td><td>Một chủ sở hữu duy nhất cho mỗi dữ liệu; phía kia chỉ đọc</td></tr>
      <tr><td>Kích thước app tăng khi có cả RN + KMP</td><td>Chấp nhận tạm thời; đo mỗi release</td></tr>
      <tr><td>Đội chưa quen Kotlin/Swift</td><td>Bắt đầu bằng logic (dễ review, dễ test) trước UI</td></tr>
      <tr><td>Hai app lệch hành vi</td><td>Business rule chỉ ở shared, test ở commonTest</td></tr>
    </table>

    <div class="callout"><p>💡 Người học biết nghiệp vụ nhưng chưa nắm cơ chế RN: tin tốt là giai đoạn 1 chính là nơi hiểu nghiệp vụ có giá trị nhất — dịch rule từ JS sang Kotlin kèm test.
    Việc đó cũng tạo ra "đặc tả sống" cho team native sau này. Và vì backend đang chuyển sang Rust, DTO/hợp đồng API nên được chốt bằng OpenAPI cho cả hai phía.</p></div>
  `,

  codeTabs: [
    { id: "core", label: "Logic KMP", lines: [
      "// shared/commonMain — bộ não dùng chung",
      "class CartService(private val repo: CartRepository, private val rules: PricingRules) {",
      "    suspend fun addItem(sku: String, qty: Int): Cart {",
      "        val cart = repo.current()",
      "        val updated = cart.add(sku, qty)",
      "        return repo.save(rules.apply(updated))",
      "    }",
      "}",
      "",
      "// Facade đơn giản cho RN: nhận/trả JSON string",
      "class ShopCoreFacade(private val cart: CartService) {",
      "    @Throws(Exception::class)",
      "    suspend fun addItemJson(sku: String, qty: Int): String =",
      "        Json.encodeToString(cart.addItem(sku, qty))",
      "}"
    ]},
    { id: "android", label: "RN module (Android)", lines: [
      "// androidApp — TurboModule/NativeModule gọi thẳng Kotlin",
      "class ShopCoreModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {",
      "    private val facade: ShopCoreFacade = Deps.shopCore()",
      "    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)",
      "    override fun getName() = \"ShopCore\"",
      "",
      "    @ReactMethod",
      "    fun addItem(sku: String, qty: Int, promise: Promise) {",
      "        scope.launch {",
      "            runCatching { facade.addItemJson(sku, qty) }",
      "                .onSuccess(promise::resolve)",
      "                .onFailure { promise.reject(\"CART_ERROR\", it) }",
      "        }",
      "    }",
      "}"
    ]},
    { id: "ios", label: "RN module (iOS)", lines: [
      "// iosApp — module Swift gọi Shared.framework (đăng ký với RN qua macro RCT_EXTERN_MODULE)",
      "import Shared",
      "",
      "@objc(ShopCore)",
      "class ShopCore: NSObject {",
      "    private let facade = Deps.shared.shopCore()",
      "",
      "    @objc func addItem(_ sku: String, qty: Int,",
      "                       resolve: @escaping RCTPromiseResolveBlock,",
      "                       reject: @escaping RCTPromiseRejectBlock) {",
      "        Task { @MainActor in",
      "            do { resolve(try await facade.addItemJson(sku: sku, qty: Int32(qty))) }",
      "            catch { reject(\"CART_ERROR\", error.localizedDescription, error) }",
      "        }",
      "    }",
      "}"
    ]},
    { id: "js", label: "Phía JS", lines: [
      "// Trước: logic nằm trong JS",
      "// const next = applyPromotions(addLine(cart, sku, qty)); setCart(next);",
      "",
      "// Sau giai đoạn 1: JS chỉ gọi native",
      "import { NativeModules } from 'react-native';",
      "const { ShopCore } = NativeModules;",
      "",
      "async function onAdd(sku, qty) {",
      "  const cart = JSON.parse(await ShopCore.addItem(sku, qty));",
      "  setCart(cart);",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p0"><div class="nl">0 · Chuẩn bị</div><div class="ns">module shared, CI, commonTest, OpenAPI</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="p1"><div class="nl">1 · KMP là bộ não của app RN</div><div class="ns">native module gọi Kotlin, JS bỏ dần logic</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="p2"><div class="nl">2 · Màn mới viết native</div><div class="ns">Compose/SwiftUI + ViewModel KMP</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="p3"><div class="nl">3 · Vỏ app native, RN nhúng</div><div class="ns">thay nốt → gỡ RN khỏi build</div></div>
  `,
  steps: [
    { title: "1 · Logic chuyển vào KMP", tab: "core", highlight: [2, 3, 6, 11, 12, 13, 14], on: ["p0", "a1", "p1"],
      desc: "Rule giỏ hàng viết một lần, có test. Facade đơn giản (JSON string) để ranh giới với JS dễ ổn định." },
    { title: "2 · Android: module gọi Kotlin", tab: "android", highlight: [3, 4, 8, 9, 10, 11, 12], on: ["p1"],
      desc: "Trên Android không có ranh giới ngôn ngữ: module RN gọi thẳng code Kotlin, trả về qua Promise." },
    { title: "3 · iOS: module Swift gọi framework", tab: "ios", highlight: [2, 6, 11, 12, 13], on: ["p1"],
      desc: "Swift gọi suspend fun như async (có @Throws nên dùng try). Cùng facade với Android." },
    { title: "4 · JS mỏng dần", tab: "js", highlight: [2, 6, 9], on: ["p1"],
      desc: "Logic cũ trong JS bị xoá; hai app dùng chung một bản rule đã được test." },
    { title: "5 · Màn native mới, rồi đảo vỏ", tab: "core", highlight: [2], on: ["a2", "p2", "a3", "p3"],
      desc: "CartService vẫn dùng lại nguyên vẹn khi màn Cart được viết lại bằng SwiftUI/Compose. Cuối cùng gỡ RN." }
  ],

  quiz: [
    { q: "Vì sao nên chuyển dần thay vì viết lại toàn bộ app?", options: [
        "Vì KMP không hỗ trợ app mới",
        "Giảm rủi ro: vẫn ra tính năng, mỗi bước kiểm chứng trong production",
        "Vì RN cấm",
        "Vì rẻ hơn khi viết lại"
      ], correct: 1, explanation: "Strangler fig — như tách monolith thành service." },
    { q: "Giai đoạn đầu nên chuyển gì vào KMP?", options: [
        "Animation", "Business logic: API, giỏ hàng, giá, auth, cache", "Font", "Icon"
      ], correct: 1, explanation: "Logic dễ test, dễ review, giá trị chia sẻ cao." },
    { q: "App RN gọi logic KMP qua đâu?", options: [
        "WebView", "Native module (TurboModule/NativeModule) ở mỗi nền tảng", "HTTP localhost", "Không gọi được"
      ], correct: 1, explanation: "Android gọi Kotlin trực tiếp; iOS gọi qua Shared.framework." },
    { q: "Vì sao facade cho RN trả JSON string?", options: [
        "Nhanh nhất có thể",
        "Giữ ranh giới JS ↔ native đơn giản, ổn định; không phải map từng kiểu Kotlin sang JS",
        "RN chỉ nhận string",
        "Vì Swift yêu cầu"
      ], correct: 1, explanation: "Có thể tối ưu sau nếu cần." },
    { q: "Rủi ro \"hai nguồn state lệch nhau\" giải quyết thế nào?", options: [
        "Đồng bộ hai chiều liên tục",
        "Mỗi dữ liệu có một chủ sở hữu duy nhất (vd KMP giữ giỏ hàng), phía kia chỉ đọc",
        "Bỏ state",
        "Lưu ở server"
      ], correct: 1, explanation: "Giống nguyên tắc mỗi service sở hữu dữ liệu của mình." },
    { q: "Màn nào nên viết native trước?", options: [
        "Checkout phức tạp nhất",
        "Màn ít phụ thuộc như cài đặt, lịch sử đơn",
        "Màn chính trang chủ",
        "Tất cả cùng lúc"
      ], correct: 1, explanation: "Học quy trình trên màn rủi ro thấp." },
    { q: "Giai đoạn 3 \"đảo chiều\" nghĩa là gì?", options: [
        "Chuyển về RN",
        "Vỏ app thành native, các màn RN còn lại được nhúng vào như view",
        "Đổi backend",
        "Xoá KMP"
      ], correct: 1, explanation: "Khi phần lớn màn đã native." },
    { q: "Lợi ích khi cuối cùng gỡ RN khỏi build?", options: [
        "Không có",
        "Bỏ Hermes/JS bundle: app nhỏ hơn, khởi động nhanh hơn, một stack ít hơn",
        "Thêm tính năng miễn phí",
        "Không cần Xcode"
      ], correct: 1, explanation: "Và không còn ranh giới JS ↔ native." },
    { q: "Khi iOS module Swift gọi suspend fun có @Throws(Exception::class)?", options: [
        "Dùng try await, lỗi thành Error bắt được bằng catch",
        "Không bắt được lỗi",
        "Phải dùng callback",
        "Không gọi được từ Swift"
      ], correct: 0, explanation: "Có @Throws nên exception thành NSError." }
  ]
});
