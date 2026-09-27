window.LESSONS.push({
  id: "26",
  phase: "6", phaseName: "Kiểm thử & tổng kết",
  title: "Tổng kết: một tính năng từ đầu đến cuối",
  subtitle: "Ghép mọi mảnh: route → ViewModel → repository → Room/Retrofit → state → Compose · checklist review · ôn tập",

  theory: `
    <p>Bài cuối ghép lại toàn bộ khoá bằng một tính năng thật: <strong>màn "Danh sách yêu thích"</strong> — xem offline, bỏ thích một sản phẩm, đồng bộ với server.</p>

    <ol>
      <li><strong>Kotlin</strong> (bài 01–06): model bất biến bằng <code>data class</code>, trạng thái màn hình bằng <code>sealed interface</code>, null xử lý ở biên, mapper bằng extension function.</li>
      <li><strong>Coroutines & Flow</strong> (07–09): Room trả <code>Flow</code>, ViewModel <code>stateIn(WhileSubscribed(5_000))</code>, thao tác trong <code>viewModelScope</code>, lỗi bắt cụ thể.</li>
      <li><strong>Compose</strong> (11–18): Route stateful mỏng + Screen stateless; <code>LazyColumn</code> có <code>key</code>; token theme; Snackbar qua effect.</li>
      <li><strong>Kiến trúc</strong> (19–21): route type-safe, ViewModel theo entry, UDF, Room là single source of truth.</li>
      <li><strong>Dữ liệu & DI</strong> (22–24): Retrofit sau repository, lỗi thành kết quả nghiệp vụ, Hilt với <code>@Singleton</code> đúng chỗ.</li>
      <li><strong>Test</strong> (25): fake repository + runTest cho ViewModel, UI test cho Screen.</li>
    </ol>

    <p><strong>Optimistic update</strong>: bấm bỏ thích → xoá khỏi Room ngay (UI đổi tức thì vì quan sát Room) → gọi API → lỗi thì chèn lại và báo Snackbar.
    UI không cần biết có mạng hay không; nó chỉ render những gì DB đang có.</p>

    <table>
      <tr><th>Checklist review code Compose/Android</th><th>Bài</th></tr>
      <tr><td>Không <code>!!</code> vô cớ; null xử lý ở biên</td><td>02</td></tr>
      <tr><td>Không <code>catch (e: Exception)</code> nuốt CancellationException; không <code>GlobalScope</code>; không blocking trên Main</td><td>07–08</td></tr>
      <tr><td>Thu thập state bằng <code>collectAsStateWithLifecycle</code></td><td>09</td></tr>
      <tr><td>Không tác dụng phụ/tính nặng trong thân composable; <code>remember</code>/<code>derivedStateOf</code> đúng chỗ</td><td>11–13</td></tr>
      <tr><td>Screen stateless + tham số <code>modifier</code>; state hoisted</td><td>14, 16</td></tr>
      <tr><td>LazyColumn có <code>key</code>; áp <code>innerPadding</code> của Scaffold</td><td>15</td></tr>
      <tr><td>Không mã màu cứng — dùng MaterialTheme token</td><td>17</td></tr>
      <tr><td>Effect có key đúng; launch từ onClick qua <code>rememberCoroutineScope</code></td><td>18</td></tr>
      <tr><td>ViewModel không giữ Context/Activity; state lộ ra là StateFlow chỉ-đọc</td><td>20</td></tr>
      <tr><td>Room migration khi tăng version; <code>ignoreUnknownKeys</code> cho JSON; <code>@Singleton</code> cho DB/HTTP client</td><td>22–24</td></tr>
    </table>

    <div class="callout"><p>💡 Bước tiếp theo: Compose Multiplatform/KMP nếu công ty muốn chia sẻ code với iOS (Ktor, Room KMP, Koin); Baseline Profiles và Macrobenchmark để đo khởi động;
    WorkManager cho việc chạy nền đảm bảo (đồng bộ khi có mạng). Nhưng nền tảng vẫn là những gì bạn vừa học: UI = f(state), state có một nguồn sự thật, và coroutine có cấu trúc.</p></div>
  `,

  codeTabs: [
    { id: "data", label: "① Data layer", lines: [
      "@Dao interface FavoriteDao {",
      "    @Query(\"SELECT * FROM favorites ORDER BY added_at DESC\") fun observe(): Flow<List<FavoriteEntity>>",
      "    @Upsert suspend fun upsert(f: FavoriteEntity)",
      "    @Query(\"DELETE FROM favorites WHERE productId = :id\") suspend fun delete(id: Long)",
      "}",
      "",
      "class FavoriteRepository @Inject constructor(private val dao: FavoriteDao, private val api: ShopApi) {",
      "    fun observe(): Flow<List<Favorite>> = dao.observe().map { list -> list.map { it.toDomain() } }",
      "",
      "    suspend fun unfavorite(f: Favorite): Result<Unit> {",
      "        dao.delete(f.productId)                              // optimistic: UI đổi ngay",
      "        return try { api.removeFavorite(f.productId); Result.success(Unit) }",
      "        catch (e: IOException) { dao.upsert(f.toEntity()); Result.failure(e) }   // hoàn tác",
      "    }",
      "}"
    ]},
    { id: "vm", label: "② ViewModel", lines: [
      "sealed interface FavoritesUi {",
      "    data object Loading : FavoritesUi",
      "    data object Empty : FavoritesUi",
      "    data class Content(val items: List<FavoriteUi>) : FavoritesUi",
      "}",
      "",
      "@HiltViewModel",
      "class FavoritesViewModel @Inject constructor(private val repo: FavoriteRepository) : ViewModel() {",
      "    val ui: StateFlow<FavoritesUi> = repo.observe()",
      "        .map { if (it.isEmpty()) FavoritesUi.Empty else FavoritesUi.Content(it.map(Favorite::toUi)) }",
      "        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), FavoritesUi.Loading)",
      "",
      "    private val _messages = Channel<String>(Channel.BUFFERED)",
      "    val messages = _messages.receiveAsFlow()",
      "",
      "    fun unfavorite(item: FavoriteUi) = viewModelScope.launch {",
      "        repo.unfavorite(item.toDomain()).onFailure { _messages.send(\"Không có mạng, đã hoàn tác\") }",
      "    }",
      "}"
    ]},
    { id: "ui", label: "③ Compose", lines: [
      "@Composable",
      "fun FavoritesRoute(onOpen: (Long) -> Unit, vm: FavoritesViewModel = hiltViewModel()) {",
      "    val ui by vm.ui.collectAsStateWithLifecycle()",
      "    val snackbar = remember { SnackbarHostState() }",
      "    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }",
      "    FavoritesScreen(ui, snackbar, onOpen, onUnfavorite = vm::unfavorite)",
      "}",
      "",
      "@Composable",
      "fun FavoritesScreen(ui: FavoritesUi, snackbar: SnackbarHostState,",
      "                    onOpen: (Long) -> Unit, onUnfavorite: (FavoriteUi) -> Unit) {",
      "    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { pad ->",
      "        when (ui) {",
      "            FavoritesUi.Loading -> CircularProgressIndicator(Modifier.padding(pad))",
      "            FavoritesUi.Empty -> EmptyState(Modifier.padding(pad))",
      "            is FavoritesUi.Content -> LazyColumn(contentPadding = pad) {",
      "                items(ui.items, key = { it.productId }) { f ->",
      "                    FavoriteRow(f, onClick = { onOpen(f.productId) }, onRemove = { onUnfavorite(f) },",
      "                                modifier = Modifier.animateItem())",
      "                }",
      "            }",
      "        }",
      "    }",
      "}"
    ]},
    { id: "test", label: "④ Test", lines: [
      "@Test fun unfavorite_offline_restoresItemAndShowsMessage() = runTest {",
      "    val api = FakeShopApi(failRemove = true)",
      "    val repo = FavoriteRepository(FakeFavoriteDao(listOf(sampleEntity)), api)",
      "    val vm = FavoritesViewModel(repo)",
      "    backgroundScope.launch { vm.ui.collect {} }              // giữ stateIn hoạt động",
      "    vm.messages.test {",
      "        vm.unfavorite(sampleUi)",
      "        assertEquals(\"Không có mạng, đã hoàn tác\", awaitItem())",
      "    }",
      "    assertTrue(vm.ui.value is FavoritesUi.Content)             // item đã được chèn lại",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="tap"><div class="nl">👆 User bấm bỏ thích</div><div class="ns">onUnfavorite(f) — event đi lên</div></div>
    <div class="arrow" id="a1">↓ vm.unfavorite → repo</div>
    <div class="node" id="room"><div class="nl">🗃️ Room: delete ngay</div><div class="ns">Flow phát list mới → UI đổi tức thì</div></div>
    <div class="arrow" id="a2">↓ api.removeFavorite()</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ 200</div><div class="ns">xong</div></div>
      <div class="node" id="fail"><div class="nl">📵 IOException</div><div class="ns">upsert lại + Snackbar</div></div>
    </div>
    <div class="arrow" id="a3">↑ state đi xuống: FavoritesUi.Content / Empty</div>
    <div class="node" id="screen"><div class="nl">🖥️ FavoritesScreen (stateless)</div><div class="ns">when đủ nhánh · LazyColumn key</div></div>
  `,
  steps: [
    { title: "1 · Room là nguồn sự thật", tab: "data", highlight: [2, 8], on: ["room"],
      desc: "Repository chỉ lộ Flow từ DB, map sang domain." },
    { title: "2 · Optimistic update", tab: "data", highlight: [10, 11, 12, 13], on: ["a1", "room", "a2", "ok", "fail"],
      desc: "Xoá DB trước để UI đổi ngay; API lỗi mạng thì chèn lại — Flow tự khôi phục UI." },
    { title: "3 · State dạng sealed", tab: "vm", highlight: [1, 2, 3, 4, 9, 10, 11], on: ["a3"],
      desc: "Loading/Empty/Content; stateIn với WhileSubscribed(5_000)." },
    { title: "4 · Sự kiện Snackbar", tab: "vm", highlight: [13, 14, 16, 17], on: ["fail"],
      desc: "Channel cho thông báo một lần; lỗi từ Result được chuyển thành message." },
    { title: "5 · Route & Screen", tab: "ui", highlight: [2, 3, 5, 6, 10], on: ["tap", "screen"],
      desc: "Route lấy state/effect; Screen stateless render theo when đủ nhánh." },
    { title: "6 · LazyColumn có key + animation", tab: "ui", highlight: [12, 16, 17, 19], on: ["screen"],
      desc: "innerPadding cho nội dung; key = productId để animateItem mượt khi xoá/chèn lại." },
    { title: "7 · Test luồng lỗi", tab: "test", highlight: [2, 5, 6, 7, 8, 10], on: ["fail", "a3"],
      desc: "Fake API lỗi mạng; kiểm tra có message và item quay lại danh sách." }
  ],

  quiz: [
    { q: "val x: String? = null; val n = x?.length ?: 0. n bằng?", options: [
        "null", "0", "NPE", "Lỗi compile"
      ], correct: 1, explanation: "Ôn bài 02: safe call + Elvis." },
    { q: "Lợi ích chính của sealed interface cho UI state?", options: [
        "Nhanh hơn", "when đủ nhánh được compiler kiểm tra; trạng thái sai không biểu diễn được", "Tự lưu DB", "Bắt buộc bởi Compose"
      ], correct: 1, explanation: "Ôn bài 04." },
    { q: "Lambda có receiver T.() -> Unit là nền tảng của?", options: [
        "Null safety", "DSL như Gradle kts, LazyColumn { items() }", "Coroutine", "Room"
      ], correct: 1, explanation: "Ôn bài 05." },
    { q: "suspend fun có tự chạy trên background thread không?", options: [
        "Có", "Không — nó chạy trên dispatcher của người gọi; cần withContext cho code blocking", "Chỉ trên Android", "Chỉ với Retrofit"
      ], correct: 1, explanation: "Ôn bài 07." },
    { q: "catch (e: Exception) trong coroutine có rủi ro gì?", options: [
        "Không", "Nuốt CancellationException", "Chậm", "Lỗi compile"
      ], correct: 1, explanation: "Ôn bài 08." },
    { q: "StateFlow khác cold Flow ở?", options: [
        "StateFlow hot, luôn có value, chia sẻ cho nhiều collector", "StateFlow chạy lại cho mỗi collector", "Không khác", "StateFlow không có value"
      ], correct: 0, explanation: "Ôn bài 09." },
    { q: "Compose biết recompose scope nào bằng cách?", options: [
        "Diff cây", "Theo dõi scope nào đọc snapshot state nào", "Recompose toàn bộ", "Polling"
      ], correct: 1, explanation: "Ôn bài 12." },
    { q: "remember vs rememberSaveable?", options: [
        "Giống nhau", "rememberSaveable sống qua xoay màn hình và process death (qua Bundle); remember thì không", "remember lưu disk", "rememberSaveable chỉ cho String"
      ], correct: 1, explanation: "Ôn bài 13." },
    { q: "Composable stateless nhận gì?", options: [
        "ViewModel", "value + lambda event (state xuống, event lên)", "NavController", "Context"
      ], correct: 1, explanation: "Ôn bài 14." },
    { q: "Modifier.padding(8.dp).background(Red) — lề 8dp có màu?", options: [
        "Có", "Không", "Tuỳ theme", "Lỗi"
      ], correct: 1, explanation: "Ôn bài 16: thứ tự modifier." },
    { q: "LaunchedEffect(key) khi key đổi?", options: [
        "Bỏ qua", "Huỷ coroutine cũ, chạy lại", "Chạy song song", "Crash"
      ], correct: 1, explanation: "Ôn bài 18." },
    { q: "ViewModel có sống qua process death không?", options: [
        "Có", "Không — chỉ SavedStateHandle được khôi phục", "Có nếu @Singleton", "Có nếu dùng Hilt"
      ], correct: 1, explanation: "Ôn bài 20." },
    { q: "Offline-first: single source of truth là?", options: [
        "Response API", "Database cục bộ (Room)", "ViewModel", "Composable"
      ], correct: 1, explanation: "Ôn bài 21." },
    { q: "Retrofit hàm trả T gặp HTTP 409?", options: [
        "Trả null", "Ném HttpException", "Trả body rỗng", "Retry"
      ], correct: 1, explanation: "Ôn bài 22." },
    { q: "Tăng version Room mà thiếu migration?", options: [
        "Tự xử lý", "Crash khi mở DB trên máy có bản cũ", "Không sao", "Lỗi compile"
      ], correct: 1, explanation: "Ôn bài 23." },
    { q: "Binding Hilt không có scope?", options: [
        "Singleton", "Tạo mới mỗi lần inject", "Theo Activity", "Lỗi"
      ], correct: 1, explanation: "Ôn bài 24." },
    { q: "Test ViewModel trên JVM cần gì cho Dispatchers.Main?", options: [
        "Không gì", "Dispatchers.setMain(TestDispatcher)", "Emulator", "runBlocking"
      ], correct: 1, explanation: "Ôn bài 25." },
    { q: "Trong optimistic update ở bài này, vì sao UI tự khôi phục khi API lỗi?", options: [
        "ViewModel lưu bản sao",
        "Repository chèn lại vào Room; UI quan sát Room nên tự hiển thị lại",
        "Compose undo tự động",
        "Retrofit retry"
      ], correct: 1, explanation: "Sức mạnh của single source of truth." }
  ]
});
