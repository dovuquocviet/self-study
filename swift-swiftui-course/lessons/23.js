window.LESSONS.push({
  id: "23",
  phase: "4", phaseName: "Kiến trúc & dữ liệu",
  title: "Test cơ bản: Swift Testing, XCTest, mock bằng protocol",
  subtitle: "@Test · #expect · #require · test tham số hoá · test async & MainActor · XCUITest",

  theory: `
    <p>Có hai framework unit test chạy song song được trong cùng target:</p>
    <table>
      <tr><th></th><th><strong>Swift Testing</strong> (Xcode 16+, mới)</th><th><strong>XCTest</strong> (cũ)</th><th>JUnit 5</th></tr>
      <tr><td>Khai báo test</td><td><code>@Test func ...</code> (hàm tự do hoặc trong struct)</td><td>class kế thừa <code>XCTestCase</code>, hàm tên bắt đầu bằng <code>test</code></td><td><code>@Test</code></td></tr>
      <tr><td>Kiểm tra</td><td><code>#expect(a == b)</code> — macro, tự in giá trị hai vế khi fail</td><td><code>XCTAssertEqual(a, b)</code> và hàng chục biến thể</td><td><code>assertEquals</code></td></tr>
      <tr><td>Dừng nếu điều kiện sai</td><td><code>try #require(x)</code> (mở Optional luôn)</td><td><code>XCTUnwrap</code></td><td><code>assumeTrue</code>/assert</td></tr>
      <tr><td>Nhóm</td><td><code>@Suite struct</code>; setup trong <code>init</code>, mỗi test một instance mới</td><td><code>setUp()</code>/<code>tearDown()</code></td><td><code>@BeforeEach</code></td></tr>
      <tr><td>Tham số hoá</td><td><code>@Test(arguments: [...])</code></td><td>tự viết vòng lặp</td><td><code>@ParameterizedTest</code></td></tr>
      <tr><td>Song song</td><td>Mặc định chạy song song</td><td>Theo cấu hình</td><td>Theo cấu hình</td></tr>
      <tr><td>UI test, performance</td><td>Chưa hỗ trợ</td><td><strong>XCUITest</strong>, <code>measure</code></td><td>—</td></tr>
    </table>
    <p>Code mới nên viết bằng Swift Testing; UI test vẫn dùng XCTest/XCUITest.</p>

    <p><strong>Test async</strong>: hàm test chỉ cần <code>async</code> (và <code>throws</code>), gọi <code>await</code> bình thường — không cần <code>XCTestExpectation</code> như thời callback. ViewModel <code>@MainActor</code> thì đánh dấu test (hoặc suite) <code>@MainActor</code>. Vì test chạy song song mặc định, tránh chia sẻ trạng thái toàn cục (singleton, UserDefaults.standard) giữa các test — đây là lý do nữa để tiêm phụ thuộc qua init.</p>

    <p><strong>Mock không cần Mockito</strong>: Swift không có proxy động lúc chạy như Java, nên không có Mockito "chính chủ". Cách phổ biến: phụ thuộc là <code>protocol</code> (bài 05, 20), test tạo struct/class giả conform protocol đó, trả dữ liệu định sẵn hoặc ghi lại lời gọi (spy). Với mạng, có thể chặn ở tầng <code>URLProtocol</code> để test <code>APIClient</code> với JSON thật mà không gọi server.</p>

    <p><strong>Truy cập code app từ test</strong>: <code>@testable import ShopKit</code> cho phép test thấy các khai báo <code>internal</code> (module phải build với testing enabled — mặc định ở Debug).</p>

    <p><strong>Chạy</strong>: ⌘U trong Xcode, <code>swift test</code> cho package, <code>xcodebuild test</code> trên CI. <strong>XCUITest</strong> điều khiển app thật trên simulator qua accessibility (<code>app.buttons["Thanh toán"].tap()</code>) — gắn <code>.accessibilityIdentifier("checkout")</code> để selector ổn định; tương tự Detox/Maestro bên RN.</p>

    <div class="callout"><p>💡 Kim tự tháp test cho app: nhiều unit test cho ViewModel/Service (nhanh, không UI), vài test snapshot/Preview cho view quan trọng, rất ít XCUITest cho luồng chính (đăng nhập → thêm giỏ → thanh toán).</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "Swift Testing", lines: [
      "import Testing",
      "@testable import ShopKit",
      "",
      "@Test func cartTotalSumsLineItems() {",
      "    var cart = Cart()",
      "    cart.add(sku: \"A\", price: 100, qty: 2)",
      "    cart.add(sku: \"B\", price: 50, qty: 1)",
      "    #expect(cart.total == 250)          // fail in: cart.total → 200 == 250",
      "}",
      "",
      "@Test func decodesProduct() throws {",
      "    let products = try decodeFixture([Product].self, \"products.json\")",
      "    let p = try #require(products.first)   // mảng rỗng → dừng test ngay",
      "    #expect(p.price > 0)",
      "}"
    ]},
    { id: "param", label: "Suite & tham số", lines: [
      "@Suite(\"Mã giảm giá\")",
      "struct CouponTests {",
      "    let engine: PricingEngine",
      "    init() { engine = PricingEngine(rules: .default) }   // setup: mỗi test 1 instance",
      "",
      "    @Test(arguments: [(\"SALE10\", 90), (\"SALE50\", 50), (\"INVALID\", 100)])",
      "    func applies(code: String, expected: Decimal) {",
      "        #expect(engine.price(100, coupon: code) == expected)",
      "    }",
      "",
      "    @Test func rejectsNegative() {",
      "        #expect(throws: PricingError.self) { try engine.validate(amount: -1) }",
      "    }",
      "}"
    ]},
    { id: "async", label: "Async + mock", lines: [
      "final class SpyProductService: ProductService, @unchecked Sendable {",
      "    var requestedPages: [Int] = []",
      "    func products(page: Int) async throws -> [Product] {",
      "        requestedPages.append(page)",
      "        return [.sample]",
      "    }",
      "}",
      "",
      "@Test @MainActor func loadFetchesFirstPage() async {",
      "    let spy = SpyProductService()",
      "    let vm = ProductListViewModel(service: spy)",
      "    await vm.load()",
      "    #expect(spy.requestedPages == [1])",
      "    if case .loaded(let items) = vm.state { #expect(items.count == 1) }",
      "    else { Issue.record(\"state phải là loaded\") }",
      "}"
    ]},
    { id: "xctest", label: "XCTest & UI test", lines: [
      "import XCTest",
      "",
      "final class CartTests: XCTestCase {",
      "    func testTotal() {",
      "        var cart = Cart(); cart.add(sku: \"A\", price: 100, qty: 2)",
      "        XCTAssertEqual(cart.total, 200)",
      "    }",
      "}",
      "",
      "final class CheckoutUITests: XCTestCase {",
      "    func testCheckoutFlow() {",
      "        let app = XCUIApplication(); app.launch()",
      "        app.buttons[\"add-to-cart\"].tap()       // .accessibilityIdentifier",
      "        app.buttons[\"checkout\"].tap()",
      "        XCTAssertTrue(app.staticTexts[\"Đặt hàng thành công\"].waitForExistence(timeout: 5))",
      "    }",
      "}"
    ]},
    { id: "junit", label: "JUnit 5", lines: [
      "@ParameterizedTest",
      "@CsvSource({\"SALE10,90\", \"SALE50,50\", \"INVALID,100\"})",
      "void applies(String code, BigDecimal expected) {",
      "    assertEquals(expected, engine.price(BigDecimal.valueOf(100), code));",
      "}",
      "",
      "@Test void loadFetchesFirstPage() {",
      "    var service = mock(ProductService.class);     // Mockito: proxy lúc chạy",
      "    when(service.products(1)).thenReturn(List.of(sample));",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="test"><div class="nl">@Test async</div><div class="ns">@MainActor nếu gọi ViewModel</div></div>
    <div class="arrow" id="a1">↓ tạo ViewModel với phụ thuộc giả</div>
    <div class="row">
      <div class="node" id="vm"><div class="nl">ProductListViewModel</div><div class="ns">code thật</div></div>
      <div class="node" id="spy"><div class="nl">SpyProductService</div><div class="ns">conform protocol, ghi lời gọi</div></div>
    </div>
    <div class="arrow" id="a2">↓ await vm.load()</div>
    <div class="node" id="expect"><div class="nl">#expect / #require</div><div class="ns">in rõ giá trị khi fail</div></div>
    <div class="node" id="ui"><div class="nl">XCUITest</div><div class="ns">ít, cho luồng chính</div></div>
  `,
  steps: [
    { title: "1 · @Test và #expect", tab: "basic", highlight: [1, 2, 4, 8], on: ["test", "expect"],
      desc: "Hàm tự do đánh dấu <code>@Test</code>. <code>#expect</code> là macro: khi fail, in giá trị từng vế của biểu thức." },
    { title: "2 · #require dừng sớm", tab: "basic", highlight: [11, 12, 13], on: ["expect"],
      desc: "Mở Optional hoặc kiểm tra điều kiện bắt buộc; sai thì ném và dừng test." },
    { title: "3 · Suite & tham số hoá", tab: "param", highlight: [1, 4, 6, 7, 8, 12], on: ["test"],
      desc: "Setup trong <code>init</code>. Mỗi bộ tham số là một test case riêng trong báo cáo. <code>#expect(throws:)</code> kiểm tra lỗi." },
    { title: "4 · Mock bằng protocol", tab: "async", highlight: [1, 2, 3, 4], on: ["a1", "spy"],
      desc: "Không có Mockito: tự viết spy conform <code>ProductService</code>. <code>@unchecked Sendable</code> chấp nhận được trong test đơn luồng." },
    { title: "5 · Test async trên MainActor", tab: "async", highlight: [9, 11, 12, 13, 14, 15], on: ["vm", "a2", "expect"],
      desc: "Hàm test <code>async</code>, gọi <code>await</code> trực tiếp. <code>Issue.record</code> ghi lỗi tuỳ ý." },
    { title: "6 · XCTest & UI test", tab: "xctest", highlight: [3, 6, 12, 13, 15], on: ["ui"],
      desc: "Code cũ dùng XCTAssert; UI test dùng XCUIApplication, chọn phần tử qua accessibility identifier." }
  ],

  quiz: [
    { q: "Khai báo test trong Swift Testing?", options: [
        "Class kế thừa XCTestCase", "Hàm đánh dấu @Test", "Hàm tên bắt đầu bằng test", "Annotation @Spec"
      ], correct: 1, explanation: "Có thể là hàm tự do hoặc trong @Suite struct." },
    { q: "#expect(cart.total == 250) fail thì báo gì?", options: [
        "Chỉ 'false'", "Giá trị thực của từng vế, ví dụ 200 == 250", "Stack trace Java", "Không báo"
      ], correct: 1, explanation: "Macro phân tích biểu thức lúc biên dịch để ghi lại giá trị." },
    { q: "try #require(optionalValue) làm gì?", options: [
        "Bỏ qua nếu nil",
        "Mở Optional; nếu nil thì ghi lỗi và dừng test",
        "Crash app",
        "Trả giá trị mặc định"
      ], correct: 1, explanation: "Tương đương XCTUnwrap." },
    { q: "Setup chung cho mọi test trong @Suite struct viết ở đâu?", options: [
        "setUp()", "init() — mỗi test chạy trên một instance mới", "@BeforeAll", "static let"
      ], correct: 1, explanation: "Không chia sẻ state giữa các test." },
    { q: "Test một hàm async trong Swift Testing?", options: [
        "Cần XCTestExpectation",
        "Đánh dấu hàm test async và gọi await trực tiếp",
        "Không test được",
        "Dùng sleep"
      ], correct: 1, explanation: "Hỗ trợ async/await gốc." },
    { q: "Swift có Mockito chính chủ không? Cách mock phổ biến?", options: [
        "Có, giống hệt Mockito",
        "Không — phụ thuộc là protocol, test tự viết struct/class giả conform protocol đó",
        "Dùng reflection sửa method",
        "Không mock được"
      ], correct: 1, explanation: "Swift không tạo proxy động lúc chạy như JVM." },
    { q: "@testable import ShopKit cho phép gì?", options: [
        "Chạy test song song", "Test truy cập khai báo internal của module", "Bỏ qua lỗi biên dịch", "Import UI"
      ], correct: 1, explanation: "Module cần build với testing enabled (mặc định ở Debug)." },
    { q: "Tính năng nào vẫn phải dùng XCTest?", options: [
        "Unit test đơn giản", "UI test (XCUITest) và performance test", "Test tham số hoá", "Test async"
      ], correct: 1, explanation: "Swift Testing chưa hỗ trợ UI test." },
    { q: "Selector ổn định cho XCUITest nên dựa vào gì?", options: [
        "Toạ độ màn hình", ".accessibilityIdentifier gắn trên view", "Màu nút", "Thứ tự view"
      ], correct: 1, explanation: "Không phụ thuộc chữ hiển thị hay ngôn ngữ." },
    { q: "Vì sao nên tránh singleton/UserDefaults.standard dùng chung trong unit test Swift Testing?", options: [
        "Không truy cập được",
        "Test chạy song song mặc định; trạng thái chung gây kết quả chập chờn",
        "Chậm",
        "Bị cấm"
      ], correct: 1, explanation: "Tiêm phụ thuộc để mỗi test có bản riêng." }
  ]
});
