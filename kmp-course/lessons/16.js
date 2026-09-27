window.LESSONS.push({
  id: "16",
  phase: "5", phaseName: "Build, runtime & test",
  title: "Bộ nhớ & concurrency trên Kotlin/Native",
  subtitle: "Từ freeze() tới memory model mới · GC tracing gặp ARC · vòng tham chiếu vượt ranh giới · data race là việc của bạn",

  theory: `
    <p><strong>Một chút lịch sử (để đọc hiểu bài viết cũ)</strong>: trước Kotlin 1.7.20, Kotlin/Native có memory model "nghiêm": object muốn dùng ở thread khác phải <code>freeze()</code> (đóng băng, bất biến),
    sửa object đã freeze ném <code>InvalidMutabilityException</code>, giao tiếp giữa thread bằng <code>Worker</code>. Rất khó chịu. Nếu gặp tài liệu nói về freeze — nó đã lỗi thời.</p>

    <p><strong>Memory model mới</strong> (mặc định từ 1.7.20): giống JVM — object chia sẻ và sửa tự do giữa các thread. <code>freeze()</code> bị bỏ.
    Coroutines chuyển thread (<code>withContext(Dispatchers.Default)</code>) hoạt động như trên Android. Nhưng cũng giống JVM: <strong>tự do nghĩa là data race có thể xảy ra</strong> — hai thread ghi cùng một <code>MutableList</code> là lỗi của bạn.</p>
    <ul>
      <li>Đồng bộ bằng: <code>Mutex</code> của coroutines, <code>MutableStateFlow.update { }</code> (nguyên tử), <code>kotlin.concurrent.atomics</code>/atomicfu, hoặc giữ state trong một dispatcher đơn luồng.</li>
      <li>Không có <code>synchronized</code>/<code>java.util.concurrent</code> trong commonMain.</li>
    </ul>

    <p><strong>Garbage collector</strong>: tracing GC (đánh dấu từ gốc rồi quét), dọn được cả vòng tham chiếu thuần Kotlin. Nhiều năm mặc định là <em>parallel mark, concurrent sweep</em> (có pause khi đánh dấu);
    Kotlin 2.4 bật <strong>concurrent mark and sweep (CMS)</strong> mặc định để giảm pause. Chọn lại bằng <code>kotlin.native.binary.gc=pmcs</code> nếu có vấn đề.</p>

    <p><strong>Khi GC gặp ARC</strong> — Swift/Objective-C quản lý bộ nhớ bằng đếm tham chiếu (ARC), không có GC:</p>
    <ul>
      <li>Swift giữ object Kotlin → object Kotlin sống tới khi Swift nhả <em>và</em> GC chạy.</li>
      <li>Kotlin giữ object Swift → Swift object chỉ được giải phóng (<code>deinit</code>) sau khi GC thấy wrapper Kotlin không còn ai dùng — có thể <strong>trễ</strong>, và chuỗi đan xen Kotlin↔Swift có thể cần nhiều vòng GC mới dọn hết.</li>
      <li><strong>Vòng tham chiếu trộn Kotlin + Swift không được thu hồi tự động</strong>: GC không phá được vòng đi qua object ARC. Phía Swift phải dùng <code>weak</code>/<code>unowned</code> (vd <code>[weak self]</code> trong closure truyền vào Kotlin).</li>
      <li>Vòng lặp dài gọi API Objective-C tạo nhiều object tạm → bọc trong <code>autoreleasepool { }</code> để giải phóng sớm.</li>
    </ul>

    <table>
      <tr><th>JVM/Spring bạn quen</th><th>Kotlin/Native</th></tr>
      <tr><td>GC thế hệ (G1, ZGC), heap lớn</td><td>Tracing GC không thế hệ, runtime nhỏ trong binary</td></tr>
      <tr><td><code>synchronized</code>, <code>ConcurrentHashMap</code></td><td><code>Mutex</code>, atomics, StateFlow.update</td></tr>
      <tr><td>Mọi thứ đều do GC quản</td><td>Ranh giới với ARC: cần weak ở phía Swift</td></tr>
      <tr><td>VisualVM, heap dump</td><td>Xcode Instruments (Allocations, Leaks), <code>GC.lastGCInfo</code></td></tr>
    </table>

    <div class="callout"><p>💡 Rò rỉ bộ nhớ điển hình trong app KMP: Swift ViewModel wrapper truyền closure <code>{ self.ui = $0 }</code> (không weak) cho một Flow Kotlin, và không bao giờ huỷ subscription.
    Closure giữ Swift object, coroutine giữ closure, Swift object giữ ViewModel Kotlin → một vòng trộn mà GC không phá được.</p></div>
  `,

  codeTabs: [
    { id: "old", label: "Cũ vs mới", lines: [
      "// ❌ Memory model cũ (trước 1.7.20) — chỉ để nhận ra khi đọc code cũ",
      "val config = Config().freeze()",
      "worker.execute(TransferMode.SAFE, { config }) { it.load() }",
      "",
      "// ✅ Memory model mới — như JVM",
      "val cache = mutableMapOf<String, Order>()",
      "suspend fun load(id: String) = withContext(Dispatchers.Default) {",
      "    cache[id] ?: api.get(id).also { cache[id] = it }   // ⚠️ data race nếu gọi song song",
      "}"
    ]},
    { id: "sync", label: "Đồng bộ đúng", lines: [
      "class OrderCache(private val api: OrderApi) {",
      "    private val mutex = Mutex()",
      "    private val cache = mutableMapOf<String, Order>()",
      "",
      "    suspend fun get(id: String): Order = mutex.withLock {",
      "        cache[id] ?: api.get(id).also { cache[id] = it }",
      "    }",
      "}",
      "",
      "// State đơn giản: StateFlow.update là nguyên tử (compare-and-set)",
      "_state.update { it.copy(count = it.count + 1) }"
    ]},
    { id: "arc", label: "Vòng tham chiếu Swift↔Kotlin", lines: [
      "// Swift",
      "final class OrdersModel: ObservableObject {",
      "    let vm = OrdersViewModel()          // Swift → Kotlin (strong)",
      "    var sub: Cancellable?",
      "    func start() {",
      "        // ❌ closure giữ self mạnh → Kotlin giữ closure → vòng trộn, không ai thu hồi",
      "        sub = vm.stateWatcher.watch { s in self.ui = s }",
      "        // ✅",
      "        sub = vm.stateWatcher.watch { [weak self] s in self?.ui = s }",
      "    }",
      "    deinit { sub?.cancel() }",
      "}"
    ]},
    { id: "gc", label: "GC & công cụ", lines: [
      "# gradle.properties",
      "kotlin.native.binary.gc=pmcs        # quay về parallel mark concurrent sweep nếu cần",
      "",
      "// iosMain — vòng lặp gọi nhiều API Objective-C",
      "import kotlinx.cinterop.autoreleasepool",
      "images.forEach { path ->",
      "    autoreleasepool { process(UIImage(contentsOfFile = path)) }",
      "}",
      "",
      "# Đo: Xcode Instruments → Allocations / Leaks; trong test: GC.collect() + GC.lastGCInfo"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="k"><div class="nl">🟪 Heap Kotlin</div><div class="ns">tracing GC (CMS từ 2.4)</div></div>
      <div class="node" id="s"><div class="nl">🦅 Object Swift</div><div class="ns">ARC đếm tham chiếu</div></div>
    </div>
    <div class="arrow" id="a1">↔ tham chiếu qua ranh giới</div>
    <div class="node" id="cyc"><div class="nl">♻️ Vòng trộn Kotlin↔Swift</div><div class="ns">GC không phá được → rò rỉ</div></div>
    <div class="node" id="fix"><div class="nl">✅ [weak self] + cancel()</div><div class="ns">phá vòng phía Swift</div></div>
    <div class="node" id="race"><div class="nl">⚠️ Data race</div><div class="ns">Mutex · atomics · StateFlow.update</div></div>
  `,
  steps: [
    { title: "1 · freeze đã là quá khứ", tab: "old", highlight: [2, 3, 6, 7], on: ["k"],
      desc: "Model mới cho phép chia sẻ object tự do giữa thread. Code có freeze/Worker là code cũ." },
    { title: "2 · Tự do → data race", tab: "old", highlight: [8], on: ["race"],
      desc: "Hai coroutine trên Dispatchers.Default cùng ghi một map là race — như trên JVM." },
    { title: "3 · Đồng bộ bằng Mutex/StateFlow", tab: "sync", highlight: [2, 5, 6, 11], on: ["race"],
      desc: "Mutex.withLock không chặn thread (suspend). StateFlow.update thử lại cho tới khi compare-and-set thành công." },
    { title: "4 · GC gặp ARC", tab: "arc", highlight: [3, 7], on: ["s", "a1", "cyc"],
      desc: "Swift giữ vm, Kotlin giữ closure, closure giữ self — vòng đi qua cả hai thế giới, không bên nào tự thu hồi." },
    { title: "5 · Phá vòng ở phía Swift", tab: "arc", highlight: [9, 11], on: ["fix"],
      desc: "<code>[weak self]</code> và huỷ subscription. Đây là việc của người viết Swift, Kotlin không làm hộ được." },
    { title: "6 · Tinh chỉnh & đo", tab: "gc", highlight: [2, 5, 7, 10], on: ["k"],
      desc: "autoreleasepool cho vòng lặp dùng nhiều API Apple. Đo rò rỉ bằng Instruments như app iOS thường." }
  ],

  quiz: [
    { q: "Từ Kotlin 1.7.20, chia sẻ object mutable giữa các thread trên Kotlin/Native?", options: [
        "Phải freeze trước",
        "Được tự do như JVM (memory model mới); đồng bộ là việc của bạn",
        "Bị cấm",
        "Chỉ qua Worker"
      ], correct: 1, explanation: "freeze() đã bị deprecate và bỏ." },
    { q: "InvalidMutabilityException là dấu hiệu của gì?", options: [
        "Lỗi Swift",
        "Code/thư viện dùng memory model cũ (object bị freeze rồi bị sửa)",
        "Lỗi network",
        "Lỗi GC mới"
      ], correct: 1, explanation: "Gặp trong code rất cũ." },
    { q: "Trong commonMain, đồng bộ truy cập map dùng chung giữa coroutine nên dùng?", options: [
        "synchronized", "Mutex (kotlinx.coroutines) hoặc atomics", "ConcurrentHashMap", "Không cần"
      ], correct: 1, explanation: "java.util.concurrent không có trong common." },
    { q: "Kotlin 2.4 bật GC nào mặc định trên Native?", options: [
        "Reference counting", "Concurrent mark and sweep (CMS)", "Generational G1", "Không có GC"
      ], correct: 1, explanation: "Trước đó mặc định là parallel mark, concurrent sweep (PMCS)." },
    { q: "Vòng tham chiếu gồm cả object Kotlin và object Swift thì?", options: [
        "GC Kotlin dọn được",
        "Không được thu hồi tự động — phải phá bằng weak/unowned phía Swift",
        "ARC dọn được",
        "Crash ngay"
      ], correct: 1, explanation: "ARC không dọn vòng; GC không phá được vòng đi qua object ARC." },
    { q: "Object Swift được Kotlin giữ có deinit ngay khi Kotlin bỏ tham chiếu không?", options: [
        "Có, ngay lập tức",
        "Không chắc ngay — phải đợi GC phát hiện wrapper không còn dùng, có thể trễ",
        "Không bao giờ",
        "Chỉ khi app thoát"
      ], correct: 1, explanation: "Chuỗi đan xen có thể cần nhiều vòng GC." },
    { q: "autoreleasepool trong Kotlin/Native dùng khi nào?", options: [
        "Mọi hàm",
        "Vòng lặp dài gọi nhiều API Objective-C tạo object tạm, để giải phóng sớm",
        "Để tắt GC",
        "Để chạy trên main thread"
      ], correct: 1, explanation: "Giống cách dùng trong code Swift/ObjC." },
    { q: "StateFlow.update { } an toàn khi nhiều thread cùng gọi vì?", options: [
        "Nó khoá toàn bộ app",
        "Nó thực hiện compare-and-set nguyên tử, tính lại nếu giá trị bị đổi giữa chừng",
        "Nó chạy trên main thread",
        "Không an toàn"
      ], correct: 1, explanation: "Khác với _state.value = _state.value.copy(...) — có thể mất cập nhật." },
    { q: "Công cụ tìm rò rỉ bộ nhớ trong app iOS dùng KMP?", options: [
        "VisualVM", "Xcode Instruments (Allocations, Leaks)", "jmap", "Android Profiler"
      ], correct: 1, explanation: "Binary Kotlin là native nên Instruments thấy được." }
  ]
});
