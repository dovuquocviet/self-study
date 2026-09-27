window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Coroutines & Flow",
  title: "Coroutine là gì — suspend dưới lớp vỏ",
  subtitle: "So với Thread/CompletableFuture · suspend = state machine + Continuation · Dispatchers · withContext",

  theory: `
    <p>Trên Android có một luật sắt: <strong>main thread</strong> (UI thread) chỉ để vẽ và xử lý chạm; chặn nó quá ~5 giây là ANR ("App Not Responding"),
    chặn vài chục ms đã giật khung hình. Mọi I/O (mạng, DB, file) phải chạy chỗ khác và <em>quay lại</em> main thread để cập nhật UI.</p>

    <table>
      <tr><th>Cách</th><th>Code trông thế nào</th><th>Vấn đề</th></tr>
      <tr><td>Thread / ExecutorService</td><td>Tự submit, tự post về main</td><td>Mỗi thread ~0.5–1 MB stack; khó huỷ; lỗi dễ thất lạc</td></tr>
      <tr><td>Callback / CompletableFuture</td><td><code>thenApply().thenCompose().exceptionally()</code></td><td>Logic tuần tự bị bẻ thành chuỗi; try/catch, vòng lặp khó viết</td></tr>
      <tr><td><strong>Coroutine</strong></td><td>Viết tuần tự như code blocking</td><td>Cần hiểu cơ chế huỷ và scope (bài 08)</td></tr>
    </table>

    <p><strong>suspend hoạt động thế nào?</strong> Compiler biến mỗi hàm <code>suspend</code> thành <em>state machine</em>:</p>
    <ol>
      <li>Thêm tham số ẩn <code>Continuation</code> — object chứa "phần còn lại của hàm": biến cục bộ + nhãn <code>label</code> đang ở bước nào.</li>
      <li>Mỗi lời gọi suspend là một điểm cắt. Nếu hàm con cần chờ (I/O), nó trả về giá trị đặc biệt <code>COROUTINE_SUSPENDED</code> — thread được
        <strong>trả lại</strong> để làm việc khác, không bị chặn.</li>
      <li>Khi kết quả về, ai đó gọi <code>continuation.resumeWith(result)</code>; dispatcher đưa coroutine lên một thread, hàm chạy tiếp từ <code>label</code> đã lưu.</li>
    </ol>
    <p>Vì vậy coroutine rất rẻ (một object nhỏ trên heap, không phải stack riêng): chạy 100.000 coroutine <code>delay()</code> đồng thời là bình thường.
    Nhưng <strong>suspend không tự làm code chạy nền</strong>: gọi hàm blocking (<code>Thread.sleep</code>, JDBC) bên trong suspend vẫn chặn thread đang chạy nó.</p>

    <p><strong>Dispatcher</strong> = coroutine chạy trên thread nào:</p>
    <ul>
      <li><code>Dispatchers.Main</code>: main thread Android. Mặc định của <code>viewModelScope</code>/<code>lifecycleScope</code>.</li>
      <li><code>Dispatchers.Default</code>: tính toán CPU, số thread = số nhân CPU (tối thiểu 2).</li>
      <li><code>Dispatchers.IO</code>: code blocking I/O, mặc định tối đa 64 thread (hoặc số nhân nếu lớn hơn), dùng chung pool với Default.</li>
      <li><code>withContext(Dispatchers.IO) { ... }</code>: chạy khối trên dispatcher khác rồi <em>quay lại</em> dispatcher cũ, trả về kết quả.</li>
    </ul>

    <div class="callout"><p>💡 Quy ước "main-safe": mọi hàm suspend public nên an toàn khi gọi từ main thread — hàm nào làm I/O blocking thì tự <code>withContext(Dispatchers.IO)</code> bên trong.
    Retrofit và Room (hàm suspend) đã main-safe sẵn, không cần bọc thêm. So với Java 21 virtual threads: cùng mục tiêu "code tuần tự, không chặn thread OS",
    nhưng coroutine là biến đổi lúc compile + có structured concurrency và huỷ hợp tác.</p></div>
  `,

  codeTabs: [
    { id: "future", label: "① CompletableFuture", lines: [
      "CompletableFuture.supplyAsync(() -> api.getUser(id), ioPool)",
      "    .thenCompose(user -> CompletableFuture.supplyAsync(() -> api.getOrders(user.getId()), ioPool))",
      "    .thenAccept(orders -> mainHandler.post(() -> render(orders)))",
      "    .exceptionally(e -> { mainHandler.post(() -> showError(e)); return null; });"
    ]},
    { id: "coro", label: "② Coroutine tuần tự", lines: [
      "viewModelScope.launch {                     // chạy trên Main",
      "    try {",
      "        val user = api.getUser(id)          // suspend: nhả Main trong lúc chờ mạng",
      "        val orders = api.getOrders(user.id) // tiếp tục trên Main khi có kết quả",
      "        render(orders)                      // đã ở Main, cập nhật UI thẳng",
      "    } catch (e: IOException) {",
      "        showError(e)",
      "    }",
      "}"
    ]},
    { id: "sm", label: "③ Compiler sinh state machine", lines: [
      "// suspend fun loadOrders(id: Long): List<Order>  ≈",
      "fun loadOrders(id: Long, cont: Continuation<Any?>): Any? {",
      "    val sm = cont as? LoadOrdersSM ?: LoadOrdersSM(cont)   // lưu biến cục bộ + label",
      "    when (sm.label) {",
      "        0 -> { sm.label = 1",
      "               val r = api.getUser(id, sm); if (r == COROUTINE_SUSPENDED) return r",
      "               sm.user = r as User }",
      "        1 -> { sm.user = sm.result as User }                // resume vào đây",
      "    }",
      "    // ... label 2 cho getOrders, tương tự",
      "}"
    ]},
    { id: "disp", label: "④ Dispatchers & withContext", lines: [
      "class ReportRepository(private val dao: LegacyJdbcDao) {",
      "    // main-safe: ai gọi từ Main cũng không chặn UI",
      "    suspend fun export(): File = withContext(Dispatchers.IO) {",
      "        val rows = dao.queryAll()               // JDBC blocking → IO",
      "        withContext(Dispatchers.Default) {       // CPU nặng → Default",
      "            buildCsv(rows)",
      "        }",
      "    }",
      "}",
      "",
      "// ❌ Sai: suspend không tự chạy nền",
      "suspend fun bad() { Thread.sleep(2000) }       // chặn thread đang chạy (có thể là Main!)",
      "suspend fun good() { delay(2000) }             // nhả thread, hẹn giờ resume"
    ]}
  ],

  stageHtml: `
    <div class="node" id="main"><div class="nl">🧵 Main thread</div><div class="ns">vẽ UI 60–120 fps · chạy coroutine phần UI</div></div>
    <div class="arrow" id="a1">↓ gọi suspend api.getUser()</div>
    <div class="node" id="susp"><div class="nl">⏸️ COROUTINE_SUSPENDED</div><div class="ns">Continuation lưu label + biến cục bộ · Main được trả lại</div></div>
    <div class="arrow" id="a2">↓ I/O xong (OkHttp thread / IO pool)</div>
    <div class="node" id="resume"><div class="nl">▶️ continuation.resumeWith(result)</div><div class="ns">dispatcher đưa về Main, chạy tiếp từ label</div></div>
    <div class="node" id="io"><div class="nl">🗄️ Dispatchers.IO / Default</div><div class="ns">withContext cho code blocking / CPU</div></div>
  `,
  steps: [
    { title: "1 · Cách cũ: chuỗi callback", tab: "future", highlight: [1, 2, 3, 4], on: ["io"],
      desc: "Logic 'lấy user rồi lấy đơn' bị bẻ thành chuỗi lambda, phải tự post về main thread." },
    { title: "2 · Coroutine: viết tuần tự", tab: "coro", highlight: [1, 3, 4, 5], on: ["main", "a1"],
      desc: "Trông như code blocking, có try/catch bình thường. Nhưng ở dòng 3, Main thread không bị chặn." },
    { title: "3 · Điểm suspend", tab: "sm", highlight: [2, 3, 6], on: ["susp"],
      desc: "Compiler thêm tham số Continuation. Khi hàm con trả COROUTINE_SUSPENDED, hàm hiện tại cũng return ngay — thread rảnh để vẽ UI." },
    { title: "4 · Resume", tab: "sm", highlight: [4, 8], on: ["a2", "resume"],
      desc: "Khi có kết quả, resumeWith gọi lại hàm; <code>label</code> cho biết nhảy vào bước nào, biến cục bộ lấy lại từ state machine." },
    { title: "5 · Chọn thread bằng dispatcher", tab: "disp", highlight: [3, 4, 5, 6], on: ["io"],
      desc: "withContext chuyển sang IO cho JDBC blocking, sang Default cho tính CSV, rồi tự quay lại dispatcher của người gọi." },
    { title: "6 · Bẫy: blocking trong suspend", tab: "disp", highlight: [12, 13], on: ["main"],
      desc: "<code>suspend</code> chỉ là khả năng tạm dừng. Thread.sleep vẫn chặn thread; dùng <code>delay</code> hoặc đưa sang IO." }
  ],

  quiz: [
    { q: "Compiler biến hàm suspend thành gì?", options: [
        "Một thread mới", "Hàm nhận thêm Continuation, thân hàm thành state machine theo các điểm suspend", "Một CompletableFuture", "Một class Runnable"
      ], correct: 1, explanation: "Đây là continuation-passing style (CPS)." },
    { q: "Khi một hàm suspend thực sự tạm dừng, thread đang chạy nó thế nào?", options: [
        "Bị chặn đến khi có kết quả", "Được trả lại để chạy việc khác", "Bị huỷ", "Ngủ 10ms rồi kiểm tra lại"
      ], correct: 1, explanation: "Hàm trả COROUTINE_SUSPENDED và thread tự do." },
    { q: "suspend fun f() { Thread.sleep(1000) } gọi trong viewModelScope.launch (Main) sẽ?", options: [
        "Không chặn gì vì là suspend", "Chặn Main thread 1 giây", "Tự chuyển sang IO", "Lỗi compile"
      ], correct: 1, explanation: "suspend không đổi thread; dùng delay hoặc withContext(IO)." },
    { q: "Dispatcher nào phù hợp cho truy vấn JDBC blocking?", options: [
        "Main", "Default", "IO", "Unconfined"
      ], correct: 2, explanation: "IO có pool lớn hơn cho các thread bị chặn chờ I/O." },
    { q: "Dispatchers.Default có khoảng bao nhiêu thread?", options: [
        "1", "Bằng số nhân CPU (tối thiểu 2)", "64", "Không giới hạn"
      ], correct: 1, explanation: "Dành cho tác vụ CPU; nhiều thread hơn số nhân không giúp gì." },
    { q: "withContext(Dispatchers.IO) { x } làm gì?", options: [
        "Tạo coroutine chạy song song, không chờ",
        "Chạy khối trên IO, suspend người gọi đến khi xong, trả kết quả, rồi quay về dispatcher cũ",
        "Chuyển vĩnh viễn coroutine sang IO",
        "Chặn thread IO"
      ], correct: 1, explanation: "Là cách chuẩn để làm hàm main-safe." },
    { q: "Vì sao chạy 100.000 coroutine đồng thời khả thi còn 100.000 thread thì không?", options: [
        "Coroutine chạy trên GPU",
        "Coroutine đang chờ chỉ là object nhỏ trên heap, không chiếm stack/thread OS",
        "JVM giới hạn thread 1000",
        "Coroutine không bao giờ chạy song song"
      ], correct: 1, explanation: "Thread OS mỗi cái giữ stack riêng cỡ MB." },
    { q: "Hàm suspend của Retrofit/Room có cần bọc withContext(IO) khi gọi từ Main?", options: [
        "Có, bắt buộc", "Không — chúng đã main-safe, tự chạy phần blocking ở thread riêng", "Chỉ Room cần", "Chỉ Retrofit cần"
      ], correct: 1, explanation: "Bọc thêm không sai nhưng thừa." },
    { q: "Trên Android, chặn main thread lâu sẽ dẫn tới?", options: [
        "Không sao", "Giật khung hình, lâu hơn thì ANR", "Tự chuyển sang thread khác", "Crash ngay lập tức"
      ], correct: 1, explanation: "Với input, ngưỡng ANR khoảng 5 giây." }
  ]
});
