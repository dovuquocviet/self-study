window.LESSONS.push({
  id: "10",
  phase: "1", phaseName: "Concurrency hiện đại",
  title: "async/await & Task: concurrency có cấu trúc",
  subtitle: "Điểm treo await · thread pool hợp tác · Task · async let · TaskGroup · huỷ hợp tác",

  theory: `
    <p>Trước Swift 5.5, code bất đồng bộ trên iOS là callback lồng nhau (completion handler) + GCD <code>DispatchQueue</code> — giống <code>CompletableFuture</code> chain hoặc "callback hell" trong JS cũ. Swift 5.5 đưa vào <code>async</code>/<code>await</code> như JS/Kotlin.</p>

    <p><strong>Cơ chế</strong></p>
    <ul>
      <li>Hàm <code>async</code> có thể <strong>treo</strong> (suspend) tại mỗi <code>await</code>. Khi treo, nó <strong>trả luồng</strong> lại cho hệ thống; trạng thái hàm được lưu vào một khung trên heap (async frame). Khi kết quả về, hàm tiếp tục — <em>có thể trên một luồng khác</em>.</li>
      <li>Các task chạy trên <strong>cooperative thread pool</strong> có số luồng ≈ số lõi CPU. Không tạo thread mới cho mỗi việc chờ (khác thread-per-request của Tomcat). Gần với <strong>virtual thread</strong> Java 21 hoặc coroutine Kotlin.</li>
      <li>Hệ quả: <strong>không được chặn luồng</strong> trong code async (<code>Thread.sleep</code>, semaphore chờ, vòng lặp CPU dài không nhả) — sẽ làm đói cả pool. Dùng <code>try await Task.sleep(for: .seconds(1))</code>.</li>
      <li><code>await</code> đánh dấu rõ điểm treo — giữa hai điểm treo, code chạy liền mạch; qua một <code>await</code> thì thế giới có thể đã thay đổi (quan trọng ở bài 11).</li>
    </ul>

    <p><strong>Task: đơn vị công việc</strong></p>
    <table>
      <tr><th>Cách tạo</th><th>Quan hệ</th><th>Dùng khi</th></tr>
      <tr><td><code>async let x = f()</code></td><td>Task con có cấu trúc, số lượng cố định</td><td>Chạy song song 2–3 việc đã biết trước</td></tr>
      <tr><td><code>withThrowingTaskGroup</code></td><td>Task con có cấu trúc, số lượng động</td><td>Tải N ảnh song song</td></tr>
      <tr><td><code>Task { ... }</code></td><td>Không cấu trúc; <strong>kế thừa</strong> actor, priority, task-local của nơi tạo</td><td>Cầu nối từ code đồng bộ (nút bấm) sang async</td></tr>
      <tr><td><code>Task.detached { ... }</code></td><td>Không kế thừa gì</td><td>Hiếm, khi cố ý thoát khỏi actor hiện tại</td></tr>
    </table>
    <p><strong>Structured concurrency</strong>: task con không thể sống lâu hơn scope cha. Hàm không return cho đến khi mọi <code>async let</code>/task trong group xong. Cha bị huỷ → con bị huỷ. Một con ném lỗi trong throwing group → các con khác bị huỷ. Không còn "fire and forget" rồi quên xử lý lỗi.</p>

    <p><strong>Huỷ là hợp tác</strong>: <code>task.cancel()</code> chỉ bật cờ. Code phải tự kiểm tra: <code>try Task.checkCancellation()</code> (ném <code>CancellationError</code>) hoặc đọc <code>Task.isCancelled</code>. Các API hệ thống như <code>URLSession</code> và <code>Task.sleep</code> tự phản ứng với việc huỷ. SwiftUI <code>.task</code> tự huỷ khi view biến mất (bài 19).</p>

    <div class="callout"><p>💡 Cầu nối API callback cũ sang async: <code>withCheckedThrowingContinuation { cont in legacy { result in cont.resume(with: result) } }</code>. Quy tắc: resume <strong>đúng một lần</strong> — hai lần là crash, không lần nào là task treo mãi (bản "checked" sẽ cảnh báo).</p></div>
  `,

  codeTabs: [
    { id: "before", label: "Callback cũ", lines: [
      "func loadHome(completion: @escaping (Result<Home, Error>) -> Void) {",
      "    api.fetchUser { userResult in",
      "        guard case .success(let user) = userResult else { return completion(...) }",
      "        api.fetchOrders(user.id) { ordersResult in",
      "            // lồng tiếp... quên gọi completion ở một nhánh = treo UI",
      "        }",
      "    }",
      "}"
    ]},
    { id: "async", label: "async/await", lines: [
      "func loadHome() async throws -> Home {",
      "    let user = try await api.fetchUser()              // treo, nhả luồng",
      "    async let orders = api.fetchOrders(user.id)        // chạy song song",
      "    async let banners = api.fetchBanners()             // chạy song song",
      "    return try await Home(user: user,",
      "                          orders: orders,",
      "                          banners: banners)            // chờ cả hai",
      "}"
    ]},
    { id: "group", label: "TaskGroup", lines: [
      "func thumbnails(_ ids: [String]) async throws -> [String: Data] {",
      "    try await withThrowingTaskGroup(of: (String, Data).self) { group in",
      "        for id in ids {",
      "            group.addTask { (id, try await api.image(id)) }",
      "        }",
      "        var result: [String: Data] = [:]",
      "        for try await (id, data) in group { result[id] = data }",
      "        return result",
      "    }   // 1 task lỗi → các task còn lại bị huỷ, lỗi ném lên",
      "}"
    ]},
    { id: "cancel", label: "Task & huỷ", lines: [
      "let task = Task {                        // từ code đồng bộ, vd nút bấm",
      "    for page in 1...100 {",
      "        try Task.checkCancellation()     // ném CancellationError nếu bị huỷ",
      "        let items = try await api.page(page)",
      "        await store.append(items)",
      "    }",
      "}",
      "task.cancel()                           // chỉ bật cờ — code phải tự kiểm tra",
      "",
      "try await Task.sleep(for: .milliseconds(300))   // KHÔNG dùng Thread.sleep"
    ]},
    { id: "java", label: "So với Java", lines: [
      "// Java 21 virtual threads: code chặn trông như đồng bộ",
      "try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {  // preview API",
      "    var orders  = scope.fork(() -> api.fetchOrders(userId));",
      "    var banners = scope.fork(() -> api.fetchBanners());",
      "    scope.join().throwIfFailed();",
      "    return new Home(user, orders.get(), banners.get());",
      "}",
      "// Swift: async let = fork, kết thúc scope = join, lỗi = huỷ anh em"
    ]}
  ],

  stageHtml: `
    <div class="node" id="parent"><div class="nl">loadHome()</div><div class="ns">task cha</div></div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">async let orders</div><div class="ns">task con</div></div>
      <div class="node" id="c2"><div class="nl">async let banners</div><div class="ns">task con</div></div>
    </div>
    <div class="arrow" id="a1">↓ await: treo, nhả luồng cho việc khác</div>
    <div class="node" id="pool"><div class="nl">Cooperative thread pool</div><div class="ns">≈ số lõi CPU, không chặn luồng</div></div>
    <div class="arrow" id="a2">↓ cả hai xong (hoặc một lỗi → huỷ còn lại)</div>
    <div class="node" id="done"><div class="nl">return Home</div><div class="ns">không task con nào sống sót ngoài scope</div></div>
  `,
  steps: [
    { title: "1 · Callback lồng nhau", tab: "before", highlight: [1, 2, 4, 5], on: ["parent"],
      desc: "Mỗi bước là một closure @escaping; quên gọi completion ở một nhánh là UI chờ mãi." },
    { title: "2 · await tuần tự", tab: "async", highlight: [1, 2], on: ["parent", "a1", "pool"],
      desc: "Code đọc như đồng bộ. Tại <code>await</code> hàm treo và nhả luồng; tiếp tục có thể trên luồng khác." },
    { title: "3 · async let chạy song song", tab: "async", highlight: [3, 4, 5, 6, 7], on: ["c1", "c2", "a2", "done"],
      desc: "Hai request chạy đồng thời; <code>await</code> ở dòng 5 chờ cả hai. Tổng thời gian ≈ max, không phải tổng." },
    { title: "4 · TaskGroup số lượng động", tab: "group", highlight: [2, 4, 7, 9], on: ["c1", "c2"],
      desc: "Thêm task trong vòng lặp, thu kết quả bằng <code>for try await</code>. Lỗi ở một con huỷ những con khác." },
    { title: "5 · Task không cấu trúc & huỷ", tab: "cancel", highlight: [1, 3, 8, 10], on: ["parent"],
      desc: "<code>Task {}</code> là cầu nối từ code đồng bộ. Huỷ chỉ là cờ; <code>checkCancellation</code> biến cờ thành lỗi. Ngủ bằng <code>Task.sleep</code>." },
    { title: "6 · Đối chiếu Java 21", tab: "java", highlight: [2, 3, 4, 5, 8], on: ["pool"],
      desc: "StructuredTaskScope (vẫn là preview; JDK 25 đổi sang <code>StructuredTaskScope.open()</code>) cùng ý tưởng: fork, join, lỗi thì huỷ anh em." }
  ],

  quiz: [
    { q: "Khi một hàm async gặp await và phải chờ, luồng hiện tại làm gì?", options: [
        "Bị chặn tới khi có kết quả",
        "Được trả về pool để chạy việc khác; hàm tiếp tục sau, có thể trên luồng khác",
        "Tạo thread mới",
        "Crash nếu chờ quá lâu"
      ], correct: 1, explanation: "Suspension nhả luồng; trạng thái lưu trong async frame." },
    { q: "Vì sao không được gọi Thread.sleep trong code async?", options: [
        "Không có hàm đó",
        "Chặn luồng của cooperative pool (ít luồng) làm đói các task khác",
        "Chỉ chậm hơn",
        "Được phép"
      ], correct: 1, explanation: "Dùng try await Task.sleep(for:)." },
    { q: "async let a = f(); async let b = g(); try await (a, b) — f và g chạy thế nào?", options: [
        "Tuần tự", "Song song như hai task con", "f xong mới tạo g", "Trên main thread"
      ], correct: 1, explanation: "async let tạo child task ngay khi khai báo." },
    { q: "Structured concurrency đảm bảo điều gì?", options: [
        "Mọi task chạy trên main thread",
        "Task con không sống lâu hơn scope cha; huỷ cha thì huỷ con",
        "Không bao giờ có lỗi",
        "Task chạy theo thứ tự"
      ], correct: 1, explanation: "Không còn task mồ côi quên xử lý lỗi." },
    { q: "task.cancel() có dừng ngay code đang chạy không?", options: [
        "Có, như Thread.stop",
        "Không — chỉ bật cờ; code phải kiểm tra Task.isCancelled / checkCancellation hoặc gọi API tự phản ứng",
        "Có nếu task là detached",
        "Chỉ trên simulator"
      ], correct: 1, explanation: "Huỷ hợp tác (cooperative cancellation)." },
    { q: "Khác biệt giữa Task {} và Task.detached {}?", options: [
        "Không khác",
        "Task {} kế thừa actor, priority, task-local từ nơi tạo; detached không kế thừa gì",
        "detached nhanh hơn",
        "Task {} chạy đồng bộ"
      ], correct: 1, explanation: "Trong view @MainActor, Task {} chạy trên MainActor." },
    { q: "Trong withThrowingTaskGroup, một task con ném lỗi thì?", options: [
        "Các task khác vẫn chạy và lỗi bị bỏ qua",
        "Lỗi lan ra khi duyệt kết quả; thoát khỏi group sẽ huỷ các task còn lại",
        "Crash app",
        "Group thử lại"
      ], correct: 1, explanation: "Group không kết thúc trước khi mọi con kết thúc (bị huỷ hoặc xong)." },
    { q: "Resume một CheckedContinuation hai lần thì?", options: [
        "Lần hai bị bỏ qua", "Crash (lỗi lập trình)", "Trả hai kết quả", "Không sao"
      ], correct: 1, explanation: "Phải resume đúng một lần." },
    { q: "Mô hình async Swift gần nhất với gì bên Java?", options: [
        "Thread-per-request của Tomcat",
        "Virtual thread / structured concurrency của Java 21+",
        "synchronized",
        "ExecutorService với 1000 thread"
      ], correct: 1, explanation: "Luồng nhẹ được treo/tiếp tục trên số ít luồng hệ điều hành." }
  ]
});
