window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "iOS gọi Kotlin",
  title: "Interop Objective-C/Swift: Kotlin hiện ra trong Swift trông ra sao",
  subtitle: "Kiểu dữ liệu · object/companion · sealed & enum · ngoại lệ @Throws · generics · SKIE & Swift export",

  theory: `
    <p>Vì Swift đọc Kotlin qua header Objective-C, mọi API bị "dịch" theo quy tắc của Objective-C. Biết bảng dịch này giúp bạn thiết kế API shared dễ dùng từ Swift.</p>

    <table>
      <tr><th>Kotlin</th><th>Swift thấy</th><th>Lưu ý</th></tr>
      <tr><td><code>class</code>, <code>data class</code></td><td>class (không phải struct)</td><td>data class có <code>==</code> (isEqual), <code>description</code>, <code>doCopy(...)</code></td></tr>
      <tr><td><code>object Config</code></td><td><code>Config.shared</code></td><td>singleton</td></tr>
      <tr><td><code>companion object</code></td><td><code>Foo.companion</code></td><td></td></tr>
      <tr><td>Hàm top-level trong <code>Utils.kt</code></td><td><code>UtilsKt.foo()</code></td><td>extension trên kiểu Kotlin → method trên kiểu đó</td></tr>
      <tr><td><code>Int</code>, <code>Long</code>, <code>Boolean</code></td><td><code>Int32</code>, <code>Int64</code>, <code>Bool</code></td><td>nullable <code>Int?</code> → <code>KotlinInt?</code> (box)</td></tr>
      <tr><td><code>String</code>, <code>List</code>, <code>Map</code>, <code>Set</code></td><td><code>String</code>, <code>[T]</code>, <code>[K: V]</code>, <code>Set</code></td><td>có chi phí chuyển đổi</td></tr>
      <tr><td><code>interface</code></td><td><code>protocol</code></td><td>Swift cài đặt được interface Kotlin</td></tr>
      <tr><td><code>enum class</code></td><td>class có thuộc tính tĩnh (<code>Status.paid</code>)</td><td>không phải Swift enum, switch cần <code>default</code></td></tr>
      <tr><td><code>sealed class</code></td><td>cây class con</td><td>switch bằng <code>case let x as ...</code>, không kiểm tra đủ nhánh</td></tr>
      <tr><td>Tham số mặc định</td><td>Không có — phải truyền đủ</td><td></td></tr>
      <tr><td>Generic của class</td><td>Giữ (lightweight generics)</td><td>generic của interface/hàm bị mất</td></tr>
      <tr><td><code>suspend fun</code></td><td><code>async</code> / completion handler</td><td>bài 08</td></tr>
    </table>

    <p><strong>Ngoại lệ</strong> là bẫy lớn nhất. Swift chỉ có lỗi <em>checked</em> (<code>throws</code>); Kotlin mọi exception đều unchecked.</p>
    <ul>
      <li>Hàm <strong>không</strong> có <code>@Throws</code> mà ném exception sang Swift → <strong>app crash</strong> (chương trình bị kết thúc), Swift không bắt được.</li>
      <li>Có <code>@Throws(IOException::class)</code> → Swift thấy hàm <code>throws</code>, exception thành <code>NSError</code>. Exception không thuộc danh sách vẫn crash.</li>
      <li><code>suspend fun</code> không có <code>@Throws</code>: chỉ <code>CancellationException</code> được chuyển thành lỗi; loại khác crash.</li>
    </ul>

    <p><strong>Đặt tên</strong>: <code>@ObjCName("Foo")</code> đổi tên khi xuất; <code>@HiddenFromObjC</code> giấu API; <code>@ShouldRefineInSwift</code> đánh dấu để viết lại bằng Swift extension.
    Hàm Kotlin bắt đầu bằng <code>init</code> (vd <code>initKoin()</code>) bị đổi thành <code>doInitKoin()</code> vì <code>init</code> là từ khoá đặc biệt của Objective-C.</p>

    <p><strong>Công cụ làm đẹp API</strong></p>
    <ul>
      <li><strong>SKIE</strong> (Touchlab, plugin Gradle <code>co.touchlab.skie</code>): sinh thêm code Swift vào framework — sealed class thành Swift enum dùng qua <code>onEnum(of:)</code> (switch đủ nhánh),
        enum Kotlin thành Swift enum thật, suspend thành <code>async</code> có hỗ trợ huỷ hai chiều, Flow thành <code>AsyncSequence</code>, và tuỳ chọn sinh overload cho tham số mặc định.</li>
      <li><strong>Swift export</strong> (JetBrains, đang thử nghiệm): xuất Kotlin thẳng sang Swift không qua Objective-C. Hướng đi dài hạn, chưa dùng cho production.</li>
    </ul>

    <div class="callout"><p>💡 Thiết kế API <em>cho Swift</em> ngay từ đầu: trả về kiểu đơn giản, tránh generic interface ở ranh giới, luôn gắn <code>@Throws</code> cho hàm có thể lỗi,
    hoặc tốt hơn là trả về một sealed <code>Result</code> thay vì ném exception. Lớp "facade" mỏng trong iosMain/commonMain dành riêng cho Swift thường đáng công.</p></div>
  `,

  codeTabs: [
    { id: "kt", label: "Kotlin (shared)", lines: [
      "object AppConfig { val baseUrl = \"https://api.shop.vn\" }",
      "",
      "enum class OrderStatus { PENDING, PAID, SHIPPED }",
      "",
      "sealed interface LoadResult {",
      "    data class Success(val orders: List<Order>) : LoadResult",
      "    data class Failure(val message: String) : LoadResult",
      "    data object Loading : LoadResult",
      "}",
      "",
      "class OrderApi {",
      "    @Throws(ApiException::class, CancellationException::class)",
      "    suspend fun fetch(page: Int = 1): List<Order> = TODO()",
      "",
      "    fun parse(json: String): Order = TODO()   // không @Throws: ném → crash iOS",
      "}",
      "",
      "fun initKoin() { /* ... */ }                  // file Koin.kt"
    ]},
    { id: "swift", label: "Swift thấy (không SKIE)", lines: [
      "let url = AppConfig.shared.baseUrl",
      "",
      "switch status {",
      "case .pending: print(\"chờ\")",
      "case .paid:    print(\"đã trả\")",
      "default:       print(\"khác\")        // bắt buộc: không phải Swift enum",
      "}",
      "",
      "if let s = result as? LoadResultSuccess { show(s.orders) }",
      "else if let f = result as? LoadResultFailure { alert(f.message) }",
      "",
      "let orders = try await api.fetch(page: 1)   // phải truyền page: không có default",
      "KoinKt.doInitKoin()                         // init → doInit"
    ]},
    { id: "skie", label: "Swift với SKIE", lines: [
      "// build.gradle.kts: plugins { id(\"co.touchlab.skie\") version \"...\" }",
      "",
      "switch onEnum(of: result) {                 // exhaustive, không cần default",
      "case .success(let s): show(s.orders)",
      "case .failure(let f): alert(f.message)",
      "case .loading:        spinner()",
      "}",
      "",
      "switch status { case .pending, .paid, .shipped: break }   // Swift enum thật",
      "",
      "let task = Task { try await api.fetch() }   // huỷ Task → huỷ coroutine",
      "task.cancel()"
    ]},
    { id: "names", label: "Tinh chỉnh tên", lines: [
      "import kotlin.experimental.ExperimentalObjCName",
      "import kotlin.experimental.ExperimentalObjCRefinement",
      "import kotlin.native.ObjCName",
      "import kotlin.native.HiddenFromObjC",
      "import kotlin.native.ShouldRefineInSwift",
      "",
      "@OptIn(ExperimentalObjCName::class)",
      "@ObjCName(\"ShopCart\")",
      "class Cart",
      "",
      "@OptIn(ExperimentalObjCRefinement::class)",
      "@HiddenFromObjC",
      "fun internalHelper() {}                     // Swift không thấy",
      "",
      "@OptIn(ExperimentalObjCRefinement::class)",
      "@ShouldRefineInSwift",
      "fun rawItems(): List<Any> = emptyList()     // Swift thấy __rawItems(), tự bọc lại"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">🟪 API Kotlin public</div><div class="ns">object, enum, sealed, suspend, @Throws</div></div>
    <div class="arrow" id="a1">↓ Kotlin/Native xuất header Objective-C</div>
    <div class="node" id="h"><div class="nl">📄 Shared.h</div><div class="ns">class, protocol, NSError, completion handler</div></div>
    <div class="arrow" id="a2">↓ Swift import</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">🦅 Swift thô</div><div class="ns">.shared, as?, default:, doInitKoin</div></div>
      <div class="node" id="s2"><div class="nl">✨ Swift + SKIE</div><div class="ns">onEnum, Swift enum, async huỷ được</div></div>
    </div>
    <div class="node" id="crash"><div class="nl">💥 Exception không @Throws</div><div class="ns">→ app crash</div></div>
  `,
  steps: [
    { title: "1 · object & top-level", tab: "swift", highlight: [1, 13], on: ["k", "a1", "h", "s1"],
      desc: "object thành <code>.shared</code>. Hàm top-level trong Koin.kt thành <code>KoinKt</code>, và tên bắt đầu bằng init bị đổi thành <code>doInit...</code>." },
    { title: "2 · enum không phải Swift enum", tab: "swift", highlight: [3, 4, 5, 6], on: ["s1"],
      desc: "Enum Kotlin xuất thành class; switch phải có <code>default</code>, thêm case mới trong Kotlin thì Swift không báo lỗi." },
    { title: "3 · sealed thành cây class", tab: "swift", highlight: [9, 10], on: ["s1"],
      desc: "Phải ép kiểu từng nhánh bằng <code>as?</code>. Tên class lồng nhau được nối: LoadResultSuccess." },
    { title: "4 · Ngoại lệ", tab: "kt", highlight: [12, 13, 15], on: ["crash"],
      desc: "fetch có @Throws nên Swift dùng <code>try await</code>. parse không có @Throws: exception bay sang Swift là crash." },
    { title: "5 · SKIE làm API giống Swift", tab: "skie", highlight: [3, 4, 5, 6, 9, 11, 12], on: ["s2"],
      desc: "onEnum(of:) cho switch đủ nhánh, enum thành Swift enum thật, huỷ Task của Swift sẽ huỷ coroutine bên Kotlin." },
    { title: "6 · Tinh chỉnh tên xuất", tab: "names", highlight: [8, 12, 16, 17], on: ["h"],
      desc: "Đổi tên bằng @ObjCName, giấu API nội bộ bằng @HiddenFromObjC, và @ShouldRefineInSwift để viết lại API bằng Swift cho đẹp." }
  ],

  quiz: [
    { q: "Kotlin object AppConfig được truy cập trong Swift thế nào?", options: [
        "AppConfig()", "AppConfig.shared", "AppConfig.instance", "AppConfig.companion"
      ], correct: 1, explanation: "companion object mới là .companion." },
    { q: "Một hàm Kotlin không có @Throws ném exception khi được gọi từ Swift. Kết quả?", options: [
        "Swift nhận nil", "Swift catch được như Error", "App crash (chương trình bị kết thúc)", "Exception bị bỏ qua"
      ], correct: 2, explanation: "Chỉ exception khai báo trong @Throws mới thành NSError." },
    { q: "enum class Kotlin (không dùng SKIE) hiện ra trong Swift là gì?", options: [
        "Swift enum thật, switch đủ nhánh",
        "Class với các thuộc tính tĩnh; switch cần default",
        "Chuỗi String",
        "Int"
      ], correct: 1, explanation: "SKIE mới biến nó thành Swift enum." },
    { q: "Tham số mặc định Kotlin (page: Int = 1) trong Swift?", options: [
        "Giữ nguyên default",
        "Không có default — Swift phải truyền đủ (trừ khi dùng SKIE sinh overload)",
        "Thành optional",
        "Bị xoá khỏi API"
      ], correct: 1, explanation: "Objective-C không có tham số mặc định." },
    { q: "Hàm Kotlin initKoin() được Swift gọi với tên nào?", options: [
        "initKoin()", "doInitKoin()", "koinInit()", "InitKoin()"
      ], correct: 1, explanation: "Tên bắt đầu bằng init bị thêm tiền tố do." },
    { q: "SKIE giúp gì cho sealed class?", options: [
        "Xoá sealed class",
        "Cho phép switch exhaustive bằng onEnum(of:) như Swift enum",
        "Biến thành struct",
        "Không giúp gì"
      ], correct: 1, explanation: "Thêm case mới ở Kotlin thì Swift báo lỗi biên dịch — rất có giá trị." },
    { q: "Kiểu Int? (nullable) trong Kotlin hiện ra trong Swift là?", options: [
        "Int32?", "KotlinInt? (kiểu box)", "Int", "NSString?"
      ], correct: 1, explanation: "Objective-C không có primitive nullable nên phải box." },
    { q: "suspend fun không có @Throws ném IOException khi gọi từ Swift?", options: [
        "Thành NSError",
        "Crash — chỉ CancellationException được chuyển thành lỗi khi thiếu @Throws",
        "Trả nil",
        "Tự retry"
      ], correct: 1, explanation: "Luôn gắn @Throws cho suspend fun xuất ra Swift, hoặc trả về Result." },
    { q: "Interface Kotlin có cài đặt được bằng Swift không?", options: [
        "Không", "Có — nó thành protocol Objective-C", "Chỉ với SKIE", "Chỉ với CocoaPods"
      ], correct: 1, explanation: "Đây là cách truyền cài đặt iOS (Keychain...) vào code Kotlin." },
    { q: "Swift export của JetBrains hiện ở trạng thái nào?", options: [
        "Stable, thay thế hoàn toàn Objective-C header",
        "Thử nghiệm — hướng dài hạn xuất thẳng sang Swift",
        "Đã bị huỷ",
        "Chỉ cho macOS"
      ], correct: 1, explanation: "Production hiện vẫn dùng Objective-C export (+ SKIE nếu cần)." }
  ]
});
