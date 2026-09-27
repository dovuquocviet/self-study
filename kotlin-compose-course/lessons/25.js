window.LESSONS.push({
  id: "25",
  phase: "6", phaseName: "Kiểm thử & tổng kết",
  title: "Test cơ bản: ViewModel, coroutine, Flow & Compose UI",
  subtitle: "Kim tự tháp test · fake thay mock · runTest & thời gian ảo · Dispatchers.setMain · Turbine · createComposeRule",

  theory: `
    <p><strong>Hai loại test trên Android</strong>: <em>local unit test</em> (<code>src/test</code>, chạy trên JVM máy dev, nhanh — ViewModel, repository, mapper) và
    <em>instrumented test</em> (<code>src/androidTest</code>, chạy trên máy/emulator — Room thật, UI). Compose UI test cũng chạy được trên JVM qua <strong>Robolectric</strong>.
    Phần lớn test nên là unit test; kiến trúc bài 21 (ViewModel không đụng Android View, repository sau interface) chính là để việc này dễ.</p>

    <p><strong>Fake hơn mock</strong>: Google khuyên dùng <em>fake</em> — implementation thật nhưng đơn giản của interface (repository lưu trong <code>MutableStateFlow</code>/list) —
    thay vì mock từng lời gọi. Fake phản ánh hành vi (ghi rồi đọc lại thấy), test ít gãy khi refactor. Mockito/MockK vẫn dùng được khi cần kiểm tra tương tác.</p>

    <p><strong>Test coroutine</strong> (<code>kotlinx-coroutines-test</code>):</p>
    <ul>
      <li><code>runTest { }</code> — chạy test trong <code>TestScope</code> với <strong>thời gian ảo</strong>: <code>delay(5_000)</code> trả về ngay, không chờ thật. Coroutine con chưa xong khi hết test → báo lỗi.</li>
      <li><code>viewModelScope</code> dùng <code>Dispatchers.Main</code> — trên JVM không có main looper → phải <code>Dispatchers.setMain(testDispatcher)</code> trước, <code>resetMain()</code> sau
        (thường gói trong một JUnit Rule <code>MainDispatcherRule</code>).</li>
      <li><code>StandardTestDispatcher</code> xếp hàng coroutine, cần <code>advanceUntilIdle()</code>/<code>runCurrent()</code> để chạy; <code>UnconfinedTestDispatcher</code> chạy ngay (dễ viết, kém sát thực tế).</li>
      <li>Inject dispatcher (<code>@IoDispatcher</code>, bài 24) thay vì hard-code <code>Dispatchers.IO</code> — để test thay được.</li>
    </ul>

    <p><strong>Test Flow</strong>: StateFlow thì đọc <code>.value</code>; chuỗi giá trị theo thời gian dùng thư viện <strong>Turbine</strong>: <code>flow.test { awaitItem(); ... }</code>.</p>

    <p><strong>Compose UI test</strong>: <code>createComposeRule()</code> → <code>setContent { }</code> với composable <em>stateless</em> và dữ liệu giả → tìm node theo <strong>semantics</strong>
    (<code>onNodeWithText</code>, <code>onNodeWithTag</code>, <code>onNodeWithContentDescription</code>) → hành động (<code>performClick</code>, <code>performTextInput</code>) → khẳng định
    (<code>assertIsDisplayed</code>, <code>assertIsEnabled</code>). Test tự đồng bộ với recomposition — không cần <code>Thread.sleep</code>.</p>

    <div class="callout"><p>💡 Dev Spring: <code>runTest</code> ≈ StepVerifier với virtual time của Reactor; fake repository ≈ repository in-memory bạn viết cho <code>@DataJpaTest</code> thay vì mock.
    Test UI dựa trên semantics nên cũng là cách kiểm tra trợ năng: node không có text/contentDescription thì test cũng khó tìm.</p></div>
  `,

  codeTabs: [
    { id: "fake", label: "① Fake repository", lines: [
      "class FakeCartRepository : CartRepository {",
      "    private val items = MutableStateFlow<List<CartItem>>(emptyList())",
      "    var failNext = false",
      "",
      "    override fun observe(): Flow<List<CartItem>> = items",
      "    override suspend fun add(item: CartItem) {",
      "        if (failNext) { failNext = false; throw IOException(\"offline\") }",
      "        items.update { it + item }",
      "    }",
      "}"
    ]},
    { id: "rule", label: "② MainDispatcherRule", lines: [
      "class MainDispatcherRule(",
      "    val dispatcher: TestDispatcher = StandardTestDispatcher()",
      ") : TestWatcher() {",
      "    override fun starting(d: Description) = Dispatchers.setMain(dispatcher)",
      "    override fun finished(d: Description) = Dispatchers.resetMain()",
      "}"
    ]},
    { id: "vmtest", label: "③ Test ViewModel", lines: [
      "class CartViewModelTest {",
      "    @get:Rule val mainRule = MainDispatcherRule()",
      "    private val repo = FakeCartRepository()",
      "",
      "    @Test fun addItem_updatesTotal() = runTest {",
      "        val vm = CartViewModel(repo)",
      "        vm.ui.test {                                  // Turbine",
      "            assertEquals(0L, awaitItem().total)",
      "            vm.add(CartItem(id = 1, priceCents = 150_000, qty = 2))",
      "            assertEquals(300_000L, awaitItem().total)",
      "        }",
      "    }",
      "",
      "    @Test fun addItem_offline_showsError() = runTest {",
      "        repo.failNext = true",
      "        val vm = CartViewModel(repo)",
      "        vm.add(CartItem(id = 1, priceCents = 1, qty = 1))",
      "        advanceUntilIdle()                            // chạy hết coroutine đang chờ",
      "        assertEquals(\"offline\", vm.ui.value.error)",
      "    }",
      "}"
    ]},
    { id: "ui", label: "④ Compose UI test", lines: [
      "class CartScreenTest {",
      "    @get:Rule val compose = createComposeRule()",
      "",
      "    @Test fun emptyCart_disablesCheckout() {",
      "        compose.setContent {",
      "            ShopTheme { CartScreen(ui = CartUi(items = emptyList()), onQtyChange = { _, _ -> }, onCheckout = {}) }",
      "        }",
      "        compose.onNodeWithText(\"Giỏ hàng trống\").assertIsDisplayed()",
      "        compose.onNodeWithTag(\"checkout_button\").assertIsNotEnabled()",
      "    }",
      "",
      "    @Test fun clickCheckout_callsCallback() {",
      "        var clicked = false",
      "        compose.setContent { CartScreen(CartUi.sample, { _, _ -> }, onCheckout = { clicked = true }) }",
      "        compose.onNodeWithTag(\"checkout_button\").performClick()",
      "        assertTrue(clicked)",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ui"><div class="nl">🖥️ Compose UI test (ít)</div><div class="ns">createComposeRule · semantics · thiết bị hoặc Robolectric</div></div>
    <div class="node" id="vm"><div class="nl">🧠 ViewModel test (nhiều)</div><div class="ns">runTest · setMain · Turbine</div></div>
    <div class="node" id="unit"><div class="nl">🧩 Unit test mapper/logic (rất nhiều)</div><div class="ns">JUnit thuần, cực nhanh</div></div>
    <div class="arrow" id="a1">↑ kim tự tháp: càng lên càng chậm, càng ít</div>
    <div class="node" id="fake"><div class="nl">🧪 Fake repository</div><div class="ns">thay API/DB thật, hành vi thật</div></div>
  `,
  steps: [
    { title: "1 · Viết fake thay mock", tab: "fake", highlight: [1, 2, 5, 7, 8], on: ["fake"],
      desc: "Fake lưu dữ liệu trong StateFlow: thêm rồi observe thấy ngay, và có công tắc giả lập lỗi mạng." },
    { title: "2 · Thay Dispatchers.Main", tab: "rule", highlight: [2, 4, 5], on: ["vm"],
      desc: "viewModelScope cần Main; trên JVM phải setMain bằng TestDispatcher, và reset sau test." },
    { title: "3 · Test chuỗi state bằng Turbine", tab: "vmtest", highlight: [5, 7, 8, 9, 10], on: ["vm", "fake"],
      desc: "runTest dùng thời gian ảo; awaitItem() lấy từng giá trị StateFlow phát ra." },
    { title: "4 · Test nhánh lỗi", tab: "vmtest", highlight: [15, 17, 18, 19], on: ["vm"],
      desc: "advanceUntilIdle chạy hết coroutine đang xếp hàng trên StandardTestDispatcher rồi mới kiểm tra state." },
    { title: "5 · Compose UI test", tab: "ui", highlight: [2, 5, 6, 8, 9], on: ["ui"],
      desc: "Render composable stateless với dữ liệu giả, tìm node theo text/testTag, kiểm tra trạng thái." },
    { title: "6 · Hành động & callback", tab: "ui", highlight: [13, 14, 15, 16], on: ["ui", "a1"],
      desc: "performClick rồi kiểm tra lambda được gọi — không cần ViewModel hay navigation thật." }
  ],

  quiz: [
    { q: "Test ViewModel dùng viewModelScope trên JVM cần làm gì với Dispatchers.Main?", options: [
        "Không cần gì", "Dispatchers.setMain(testDispatcher) trước và resetMain() sau", "Chạy trên emulator", "Dùng runBlocking"
      ], correct: 1, explanation: "JVM không có Android main looper." },
    { q: "Trong runTest, delay(10_000) mất bao lâu thời gian thật?", options: [
        "10 giây", "Gần như 0 — thời gian ảo được tua", "Lỗi", "1 giây"
      ], correct: 1, explanation: "TestScope điều khiển đồng hồ ảo." },
    { q: "Google khuyên dùng gì thay cho mock cho repository?", options: [
        "Spy", "Fake — implementation đơn giản nhưng có hành vi thật", "Stub rỗng", "Không test repository"
      ], correct: 1, explanation: "Ít gãy khi refactor." },
    { q: "StandardTestDispatcher khác UnconfinedTestDispatcher?", options: [
        "Không khác", "Standard xếp hàng coroutine, cần advanceUntilIdle/runCurrent; Unconfined chạy ngay", "Standard nhanh hơn", "Unconfined dùng thread thật"
      ], correct: 1, explanation: "Standard sát thực tế hơn về thứ tự." },
    { q: "Turbine dùng để?", options: [
        "Tạo UI", "Test Flow: nhận từng giá trị bằng awaitItem()", "Chạy emulator", "Mock HTTP"
      ], correct: 1, explanation: "flow.test { awaitItem() }." },
    { q: "Compose UI test tìm node dựa trên gì?", options: [
        "ID XML", "Semantics tree (text, contentDescription, testTag)", "Toạ độ pixel", "Tên hàm composable"
      ], correct: 1, explanation: "onNodeWithText, onNodeWithTag..." },
    { q: "Vì sao inject CoroutineDispatcher thay vì dùng thẳng Dispatchers.IO trong repository?", options: [
        "Nhanh hơn", "Test có thể thay bằng TestDispatcher để điều khiển thời gian/thứ tự", "Bắt buộc bởi Hilt", "Để chạy trên Main"
      ], correct: 1, explanation: "Khả năng test." },
    { q: "Test Room với DB thật thường là loại test nào?", options: [
        "Local unit test thuần", "Instrumented test (androidTest) với in-memory DB (hoặc Robolectric)", "UI test", "Không test được"
      ], correct: 1, explanation: "Room.inMemoryDatabaseBuilder." },
    { q: "Có cần Thread.sleep trong Compose UI test chờ recomposition không?", options: [
        "Có, 500ms", "Không — test rule tự đồng bộ với Compose trước mỗi assertion/hành động", "Chỉ trên máy chậm", "Có, 5 giây"
      ], correct: 1, explanation: "Tự chờ idle." },
    { q: "Vì sao nên test composable stateless thay vì Route có ViewModel?", options: [
        "Bắt buộc", "Truyền dữ liệu giả trực tiếp, không cần DI/mạng/DB — test nhanh và ổn định", "Route không test được", "Không khác"
      ], correct: 1, explanation: "Lợi ích của state hoisting." }
  ]
});
