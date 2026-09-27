window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Build, runtime & test",
  title: "Test trong commonTest — một bộ test, chạy trên mọi nền tảng",
  subtitle: "kotlin-test · runTest & thời gian ảo · Turbine cho Flow · Ktor MockEngine · fake thay mock · allTests",

  theory: `
    <p>Test viết ở <code>commonTest</code> được biên dịch và <strong>chạy trên từng target</strong>: JVM/Android host test và iOS simulator (Kotlin/Native). Cùng một test phát hiện được lỗi chỉ xảy ra trên một nền tảng
    (khác biệt định dạng số, múi giờ, thread).</p>

    <p><strong>Bộ công cụ</strong></p>
    <ul>
      <li><code>kotlin("test")</code>: <code>@Test</code>, <code>@BeforeTest</code>, <code>assertEquals</code>, <code>assertFailsWith</code>. Plugin tự nối với JUnit trên JVM và test runner native trên iOS.</li>
      <li><code>kotlinx-coroutines-test</code>: <code>runTest { }</code> chạy coroutine với <strong>thời gian ảo</strong> — <code>delay(30_000)</code> xong tức thì. <code>StandardTestDispatcher</code>/<code>UnconfinedTestDispatcher</code> tiêm vào code cần dispatcher.
        <code>Dispatchers.setMain(testDispatcher)</code> khi test ViewModel dùng <code>viewModelScope</code>.</li>
      <li><strong>Turbine</strong> (Cash App): <code>flow.test { awaitItem(); ... }</code> — kiểm tra lần lượt từng giá trị Flow phát ra.</li>
      <li><strong>Ktor <code>MockEngine</code></strong>: thay engine thật, trả response giả theo request — test tầng API không cần mạng.</li>
      <li>DB: SQLDelight dùng driver in-memory (JDBC SQLite trên JVM, <code>inMemory = true</code> cho native); Room dùng <code>inMemoryDatabaseBuilder</code>.</li>
    </ul>

    <p><strong>Mock?</strong> Mockito/MockK dựa trên JVM (bytecode/reflection) — không chạy được trên Native. Trong commonTest ưu tiên <strong>fake viết tay</strong> dựa trên interface
    (lý do nữa để thiết kế theo interface ở bài 05). Nếu thật sự cần thư viện mock đa nền tảng có Mokkery (compiler plugin).</p>

    <table>
      <tr><th>Task Gradle</th><th>Chạy gì</th></tr>
      <tr><td><code>:shared:allTests</code></td><td>Mọi target + báo cáo gộp</td></tr>
      <tr><td><code>:shared:testAndroidHostTest</code> / <code>testDebugUnitTest</code></td><td>Test trên JVM máy dev (tên tuỳ plugin Android)</td></tr>
      <tr><td><code>:shared:iosSimulatorArm64Test</code></td><td>Test chạy trong simulator iOS (cần macOS)</td></tr>
    </table>

    <div class="callout"><p>💡 Kim tự tháp test của app KMP: phần lớn test ở commonTest (repository, use case, ViewModel, parse JSON — chạy nhanh, chạy cho cả hai nền tảng),
    ít test UI native (Compose test, XCUITest). Giống Spring: unit test service với fake repository nhiều, <code>@SpringBootTest</code> ít.</p></div>
  `,

  codeTabs: [
    { id: "vm", label: "Test ViewModel", lines: [
      "class OrdersViewModelTest {",
      "    private val dispatcher = StandardTestDispatcher()",
      "",
      "    @BeforeTest fun setUp() { Dispatchers.setMain(dispatcher) }",
      "    @AfterTest fun tearDown() { Dispatchers.resetMain() }",
      "",
      "    @Test",
      "    fun refresh_error_shows_message() = runTest(dispatcher) {",
      "        val repo = FakeOrderRepository(failRefresh = true)",
      "        val vm = OrdersViewModel(GetVisibleOrders(repo), repo)",
      "        advanceUntilIdle()",
      "        assertEquals(\"network down\", vm.state.value.error)",
      "        assertFalse(vm.state.value.refreshing)",
      "    }",
      "}"
    ]},
    { id: "turbine", label: "Turbine cho Flow", lines: [
      "@Test",
      "fun hides_cancelled_orders() = runTest {",
      "    val repo = FakeOrderRepository()",
      "    GetVisibleOrders(repo)().test {",
      "        assertEquals(emptyList(), awaitItem())",
      "        repo.emit(listOf(order(\"o1\", PAID), order(\"o2\", CANCELLED)))",
      "        assertEquals(listOf(\"o1\"), awaitItem().map { it.id })",
      "        cancelAndIgnoreRemainingEvents()",
      "    }",
      "}"
    ]},
    { id: "ktor", label: "Ktor MockEngine", lines: [
      "@Test",
      "fun parses_orders_and_ignores_unknown_fields() = runTest {",
      "    val engine = MockEngine { req ->",
      "        assertEquals(\"/v1/orders\", req.url.encodedPath)",
      "        respond(",
      "            content = \"[{\\\"id\\\":\\\"o1\\\",\\\"total_amount\\\":1,\\\"created_at\\\":\\\"x\\\",\\\"promo\\\":1}]\",",
      "            headers = headersOf(HttpHeaders.ContentType, \"application/json\"),",
      "        )",
      "    }",
      "    val api = OrderApi(createHttpClient(engine, FakeTokenStore()))",
      "    assertEquals(\"o1\", api.fetchOrders(1).single().id)",
      "}"
    ]},
    { id: "run", label: "Gradle & fake", lines: [
      "// build.gradle.kts",
      "commonTest.dependencies {",
      "    implementation(kotlin(\"test\"))",
      "    implementation(libs.kotlinx.coroutines.test)",
      "    implementation(libs.turbine)",
      "    implementation(libs.ktor.client.mock)",
      "}",
      "",
      "# chạy",
      "./gradlew :shared:allTests",
      "./gradlew :shared:iosSimulatorArm64Test",
      "",
      "// fake thay cho mock: OrderRepository là interface → class FakeOrderRepository : OrderRepository { ... }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ct"><div class="nl">🧪 commonTest</div><div class="ns">kotlin-test · runTest · Turbine · MockEngine</div></div>
    <div class="row">
      <div class="node" id="jvm"><div class="nl">☕ JVM / Android host</div><div class="ns">JUnit</div></div>
      <div class="node" id="ios"><div class="nl">🍎 iosSimulatorArm64Test</div><div class="ns">chạy trong simulator</div></div>
    </div>
    <div class="arrow" id="a1">↓ allTests → báo cáo gộp</div>
    <div class="node" id="fake"><div class="nl">🎭 Fake theo interface</div><div class="ns">thay Mockito/MockK (JVM-only)</div></div>
  `,
  steps: [
    { title: "1 · Test ViewModel với thời gian ảo", tab: "vm", highlight: [2, 4, 8, 11, 12], on: ["ct"],
      desc: "setMain để viewModelScope dùng test dispatcher; advanceUntilIdle chạy hết coroutine đang chờ, không có sleep thật." },
    { title: "2 · Flow từng giá trị", tab: "turbine", highlight: [4, 5, 6, 7, 8], on: ["ct"],
      desc: "Turbine lấy lần lượt từng item. Test chứng minh business rule lọc đơn huỷ." },
    { title: "3 · API không cần mạng", tab: "ktor", highlight: [3, 4, 5, 6, 10, 11], on: ["ct"],
      desc: "MockEngine thay engine thật (client nhận engine qua tham số). Kiểm tra cả URL và parse với field lạ." },
    { title: "4 · Chạy trên mọi target", tab: "run", highlight: [3, 4, 5, 6, 10, 11], on: ["jvm", "ios", "a1"],
      desc: "Cùng bộ test chạy trên JVM và trong simulator iOS — lỗi riêng của Kotlin/Native lộ ra ở đây." },
    { title: "5 · Fake thay mock", tab: "run", highlight: [13], on: ["fake"],
      desc: "Mockito/MockK không chạy trên Native. Fake viết tay dựa trên interface vừa đơn giản vừa đa nền tảng." }
  ],

  quiz: [
    { q: "Test trong commonTest chạy ở đâu?", options: [
        "Chỉ JVM", "Trên từng target đã khai báo: JVM/Android host và iOS simulator...", "Chỉ trên iPhone thật", "Không chạy, chỉ biên dịch"
      ], correct: 1, explanation: "allTests chạy tất cả." },
    { q: "runTest khác runBlocking ở điểm nào quan trọng?", options: [
        "Không khác",
        "Dùng thời gian ảo: delay được bỏ qua tức thì, điều khiển bằng advanceTimeBy/advanceUntilIdle",
        "Chỉ chạy trên iOS",
        "Chạy song song nhiều thread"
      ], correct: 1, explanation: "Test có delay dài vẫn chạy trong mili giây." },
    { q: "Vì sao cần Dispatchers.setMain khi test ViewModel?", options: [
        "Vì viewModelScope dùng Dispatchers.Main, môi trường test không có main thread UI",
        "Để chạy nhanh hơn",
        "Để dùng Turbine",
        "Không cần"
      ], correct: 0, explanation: "Nhớ resetMain sau test." },
    { q: "Turbine dùng để làm gì?", options: [
        "Mock HTTP", "Kiểm tra lần lượt các giá trị một Flow phát ra", "Đo hiệu năng", "Build framework"
      ], correct: 1, explanation: "awaitItem(), awaitComplete(), awaitError()." },
    { q: "Test tầng Ktor API không cần mạng bằng cách nào?", options: [
        "Gọi server staging", "Ktor MockEngine trả response giả", "Tắt Wi-Fi", "Dùng Mockito"
      ], correct: 1, explanation: "Cần thiết kế client nhận engine qua tham số." },
    { q: "Vì sao MockK/Mockito không dùng được trong commonTest khi có target iOS?", options: [
        "Vì license",
        "Vì chúng dựa trên cơ chế JVM (bytecode/reflection), không chạy trên Kotlin/Native",
        "Vì chậm",
        "Dùng được bình thường"
      ], correct: 1, explanation: "Dùng fake viết tay hoặc Mokkery." },
    { q: "Task chạy test trong simulator iOS là?", options: [
        "iosTest", "iosSimulatorArm64Test", "xcodebuild test", "testRelease"
      ], correct: 1, explanation: "Cần macOS có Xcode." },
    { q: "Nên đặt phần lớn test của app KMP ở đâu?", options: [
        "UI test trên thiết bị",
        "commonTest: repository, use case, ViewModel, parse — nhanh và bao cả hai nền tảng",
        "Chỉ test thủ công",
        "XCUITest"
      ], correct: 1, explanation: "UI test native chỉ cho luồng quan trọng." },
    { q: "Lỗi nào commonTest chạy trên iOS có thể bắt được mà test JVM bỏ sót?", options: [
        "Không có",
        "Khác biệt hành vi riêng Kotlin/Native (định dạng, thread, API platform, bộ nhớ)",
        "Lỗi CSS",
        "Lỗi Gradle sync"
      ], correct: 1, explanation: "Vì code thực sự chạy trên runtime native." }
  ]
});
