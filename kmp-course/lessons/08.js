window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "iOS gọi Kotlin",
  title: "suspend & Flow khi sang Swift",
  subtitle: "async/await có sẵn nhưng không huỷ được · Flow mất generic · wrapper tự viết, KMP-NativeCoroutines, SKIE",

  theory: `
    <p>Code shared thường trả về <code>suspend fun</code> và <code>Flow</code>/<code>StateFlow</code>. Qua ranh giới Objective-C, cả hai đều bị "hạ cấp":</p>

    <p><strong>suspend fun → Swift</strong></p>
    <ul>
      <li>Kotlin xuất suspend fun thành method Objective-C có tham số <code>completionHandler</code>. Swift 5.5+ tự nhìn thấy nó như một hàm <code>async</code> → gọi được bằng <code>try await</code>.</li>
      <li><strong>Hạn chế</strong>: huỷ <code>Task</code> bên Swift <em>không</em> huỷ coroutine bên Kotlin; coroutine chạy tiếp tới khi xong. Exception theo luật @Throws ở bài 07.</li>
    </ul>

    <p><strong>Flow → Swift</strong></p>
    <ul>
      <li><code>Flow&lt;T&gt;</code> là <em>interface</em> generic, mà generic của interface bị mất khi xuất Objective-C → Swift thấy một <code>Flow</code> không rõ kiểu phần tử,
        với method <code>collect(collector:completionHandler:)</code>. Dùng trực tiếp rất vụng.</li>
      <li><code>StateFlow.value</code> đọc được nhưng kiểu là <code>Any?</code>, phải ép kiểu.</li>
    </ul>

    <p><strong>Ba cách xử lý</strong></p>
    <ol>
      <li><strong>Wrapper tự viết</strong> trong shared: một <em>class</em> generic (generic của class được giữ) nhận callback, trả về handle để huỷ. Không phụ thuộc thư viện ngoài, ít code, bạn kiểm soát thread.</li>
      <li><strong>KMP-NativeCoroutines</strong> (Rick Clephas): gắn <code>@NativeCoroutines</code> lên suspend fun/Flow; phía Swift dùng <code>asyncFunction(for:)</code>, <code>asyncSequence(for:)</code>, hoặc bản Combine/RxSwift. Hỗ trợ huỷ hai chiều. Được docs JetBrains đánh giá là giải pháp "đã kiểm chứng" nhất.</li>
      <li><strong>SKIE</strong>: không cần annotation; Flow thành <code>AsyncSequence</code> có kiểu (<code>for await x in vm.state</code>), suspend thành <code>async</code> huỷ được, StateFlow có <code>.value</code> đúng kiểu. Dễ cài, ít code Swift.</li>
    </ol>

    <p><strong>Thread</strong>: trên iOS, <code>Dispatchers.Main</code> của kotlinx.coroutines chạy trên main queue. Nếu wrapper collect trên <code>Dispatchers.Main</code>, callback đến Swift đã ở main thread — cập nhật <code>@Published</code> an toàn.</p>

    <table>
      <tr><th></th><th>Không làm gì</th><th>Wrapper tự viết</th><th>KMP-NativeCoroutines</th><th>SKIE</th></tr>
      <tr><td>suspend</td><td>async, không huỷ</td><td>Tự lo</td><td>async, huỷ được</td><td>async, huỷ được</td></tr>
      <tr><td>Flow có kiểu</td><td>Không</td><td>Có (class generic)</td><td>Có</td><td>Có (AsyncSequence)</td></tr>
      <tr><td>Chi phí</td><td>0</td><td>Ít code</td><td>Annotation + Swift package</td><td>1 plugin Gradle, phụ thuộc phiên bản Kotlin</td></tr>
    </table>

    <div class="callout"><p>💡 Giống cách bạn không trả <code>Mono</code>/<code>Flux</code> thẳng cho một client không hiểu Reactor: ở ranh giới hệ thống, chuyển về thứ phía bên kia hiểu.
    Với iOS, "thứ bên kia hiểu" là <code>async</code>, <code>AsyncSequence</code>, hoặc callback + handle huỷ.</p></div>
  `,

  codeTabs: [
    { id: "raw", label: "Không xử lý", lines: [
      "// Kotlin",
      "class OrdersViewModel {",
      "    val state: StateFlow<OrdersUiState> = MutableStateFlow(OrdersUiState())",
      "    suspend fun refresh() { /* ... */ }",
      "}",
      "",
      "// Swift",
      "try await vm.refresh()                 // chạy được, nhưng Task.cancel() không huỷ coroutine",
      "let s = vm.state.value as! OrdersUiState  // value là Any?, phải ép kiểu",
      "// vm.state.collect(collector: ..., completionHandler: ...)  ← phải tự cài FlowCollector"
    ]},
    { id: "wrap", label: "Wrapper tự viết", lines: [
      "// commonMain/FlowWatcher.kt",
      "fun interface Cancellable { fun cancel() }",
      "",
      "class FlowWatcher<T : Any>(private val flow: Flow<T>) {   // class generic → giữ kiểu",
      "    fun watch(onEach: (T) -> Unit): Cancellable {",
      "        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)",
      "        scope.launch { flow.collect { onEach(it) } }",
      "        return Cancellable { scope.cancel() }",
      "    }",
      "}",
      "",
      "// OrdersViewModel",
      "val stateWatcher get() = FlowWatcher(state)"
    ]},
    { id: "swift", label: "Swift dùng wrapper", lines: [
      "@MainActor",
      "final class OrdersModel: ObservableObject {",
      "    @Published var ui = OrdersUiState()",
      "    private let vm = OrdersViewModel()",
      "    private var sub: Cancellable?",
      "",
      "    func start() {",
      "        sub = vm.stateWatcher.watch { [weak self] s in self?.ui = s }",
      "    }",
      "    func stop() { sub?.cancel() }",
      "}"
    ]},
    { id: "libs", label: "NativeCoroutines / SKIE", lines: [
      "// KMP-NativeCoroutines — Kotlin",
      "@NativeCoroutinesState",
      "val state: StateFlow<OrdersUiState> = _state",
      "@NativeCoroutines",
      "suspend fun refresh() { }",
      "",
      "// Swift",
      "for try await s in asyncSequence(for: vm.stateFlow) { self.ui = s }",
      "try await asyncFunction(for: vm.refresh())",
      "",
      "// SKIE — không cần annotation",
      "for await s in vm.state { self.ui = s }     // AsyncSequence có kiểu",
      "let current: OrdersUiState = vm.state.value"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">🟪 StateFlow&lt;OrdersUiState&gt;</div><div class="ns">+ suspend fun refresh()</div></div>
    <div class="arrow" id="a1">↓ xuất Objective-C</div>
    <div class="node" id="lost"><div class="nl">⚠️ Flow (mất kiểu) · async không huỷ được</div><div class="ns">value: Any?</div></div>
    <div class="row">
      <div class="node" id="w"><div class="nl">🧰 FlowWatcher&lt;T&gt;</div><div class="ns">callback + Cancellable</div></div>
      <div class="node" id="n"><div class="nl">📚 NativeCoroutines</div><div class="ns">asyncSequence(for:)</div></div>
      <div class="node" id="s"><div class="nl">✨ SKIE</div><div class="ns">for await in vm.state</div></div>
    </div>
    <div class="arrow" id="a2">↓ main thread</div>
    <div class="node" id="ui"><div class="nl">🦅 SwiftUI @Published</div><div class="ns">render lại</div></div>
  `,
  steps: [
    { title: "1 · Mặc định bị hạ cấp", tab: "raw", highlight: [3, 4, 8, 9, 10], on: ["k", "a1", "lost"],
      desc: "suspend thành async nhưng huỷ không truyền sang Kotlin. StateFlow mất kiểu phần tử vì Flow là interface generic." },
    { title: "2 · Wrapper là class generic", tab: "wrap", highlight: [2, 4, 5, 6, 7, 8], on: ["w"],
      desc: "Generic của class được giữ khi xuất nên Swift thấy <code>FlowWatcher&lt;OrdersUiState&gt;</code>. Collect trên Dispatchers.Main (= main queue trên iOS)." },
    { title: "3 · Swift đăng ký và huỷ", tab: "swift", highlight: [5, 8, 10], on: ["a2", "ui"],
      desc: "Giữ handle Cancellable, huỷ khi màn hình biến mất. <code>[weak self]</code> tránh closure giữ model mãi." },
    { title: "4 · Dùng thư viện", tab: "libs", highlight: [2, 4, 8, 9], on: ["n"],
      desc: "KMP-NativeCoroutines sinh property/hàm song song (<code>stateFlow</code>), Swift dùng qua <code>asyncSequence(for:)</code>, huỷ Task sẽ huỷ coroutine." },
    { title: "5 · Hoặc SKIE", tab: "libs", highlight: [12, 13], on: ["s", "ui"],
      desc: "SKIE sinh code Swift vào framework: StateFlow thành AsyncSequence có kiểu và <code>.value</code> đúng kiểu, không cần annotation." }
  ],

  quiz: [
    { q: "suspend fun Kotlin được Swift 5.5+ nhìn thấy thế nào (không dùng thư viện)?", options: [
        "Không gọi được",
        "Như hàm async (từ completion handler) — gọi bằng try await",
        "Như Combine Publisher",
        "Như AsyncSequence"
      ], correct: 1, explanation: "Swift tự chuyển method có completionHandler thành async." },
    { q: "Không dùng thư viện, huỷ Task Swift đang await một suspend fun Kotlin thì?", options: [
        "Coroutine bị huỷ ngay",
        "Coroutine Kotlin vẫn chạy tiếp tới khi xong",
        "App crash",
        "Swift báo lỗi biên dịch"
      ], correct: 1, explanation: "Huỷ hai chiều là thứ SKIE/KMP-NativeCoroutines thêm vào." },
    { q: "Vì sao Flow<T> mất kiểu T khi sang Swift?", options: [
        "Vì Swift không có generic",
        "Vì Flow là interface, và generic của interface không được giữ khi xuất Objective-C",
        "Vì T là reified",
        "Vì Flow là suspend"
      ], correct: 1, explanation: "Generic của class thì giữ được — nên wrapper dùng class." },
    { q: "Wrapper FlowWatcher nên là class hay interface generic?", options: [
        "Interface", "Class — generic của class được giữ trong header Objective-C", "Object", "Typealias"
      ], correct: 1, explanation: "Swift sẽ thấy FlowWatcher<OrdersUiState>." },
    { q: "Dispatchers.Main trên iOS tương ứng với gì?", options: [
        "Một thread nền", "Main dispatch queue", "Thread của Gradle", "Không tồn tại"
      ], correct: 1, explanation: "Callback trên Main nên cập nhật UI SwiftUI an toàn." },
    { q: "SKIE biến StateFlow thành gì trong Swift?", options: [
        "Combine Publisher", "AsyncSequence có kiểu, kèm .value đúng kiểu", "NSNotification", "Callback"
      ], correct: 1, explanation: "for await s in vm.state { ... }" },
    { q: "Với KMP-NativeCoroutines, Swift đọc Flow bằng hàm nào?", options: [
        "asyncSequence(for:)", "onEnum(of:)", "collect()", "subscribe()"
      ], correct: 0, explanation: "Và asyncFunction(for:) cho suspend fun; có cả bản Combine/RxSwift." },
    { q: "Vì sao cần [weak self] trong closure watch phía Swift?", options: [
        "Bắt buộc về cú pháp",
        "Để closure (được Kotlin giữ) không giữ mạnh model Swift, tránh rò rỉ bộ nhớ",
        "Để chạy nhanh hơn",
        "Để chạy trên main thread"
      ], correct: 1, explanation: "Coroutine giữ closure; closure giữ self → vòng tham chiếu vượt ranh giới." },
    { q: "Nguyên tắc chung ở ranh giới Kotlin ↔ Swift là gì?", options: [
        "Trả thẳng mọi kiểu Kotlin",
        "Chuyển về thứ Swift hiểu: async, AsyncSequence, hoặc callback + handle huỷ",
        "Chuyển sang JSON",
        "Dùng NotificationCenter"
      ], correct: 1, explanation: "Giống không trả Mono/Flux thẳng cho client không hiểu Reactor." }
  ]
});
