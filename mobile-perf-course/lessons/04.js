window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Công cụ đo",
  title: "Android: Android Studio Profiler & Perfetto",
  subtitle: "CPU sampling vs tracing · system trace · Trace.beginSection · đọc timeline · truy vấn trace bằng SQL",

  theory: `
    <p>Hai công cụ chính: <strong>Android Studio Profiler</strong> (tiện, gắn vào IDE) và <strong>Perfetto</strong> (trace toàn hệ thống, xem tại <code>ui.perfetto.dev</code>).
    Profiler của Android Studio phiên bản mới cũng dùng Perfetto bên dưới cho system trace.</p>

    <p><strong>Hai kiểu thu CPU</strong></p>
    <table>
      <tr><th>Kiểu</th><th>Cách làm</th><th>Dùng khi</th></tr>
      <tr><td><strong>Sampling</strong> (Java/Kotlin method sample, callstack sample)</td><td>Chụp call stack định kỳ</td><td>Tìm hàm tốn CPU nhất, overhead thấp</td></tr>
      <tr><td><strong>Tracing</strong> (Java/Kotlin method trace)</td><td>Ghi mọi lần vào/ra hàm</td><td>Cần số lần gọi chính xác; overhead cao, làm chậm app → thời gian tuyệt đối sai lệch</td></tr>
      <tr><td><strong>System trace</strong></td><td>Ghi sự kiện kernel + framework + section tự đánh dấu</td><td>Jank, startup, xem các thread chờ nhau (lock, I/O, CPU bị chiếm)</td></tr>
    </table>

    <p><strong>Tự đánh dấu code</strong> bằng <code>Trace.beginSection("tên")</code>/<code>endSection()</code> hoặc hàm tiện ích <code>trace("tên") { ... }</code> của <code>androidx.tracing</code>.
    Section hiện thành thanh có tên trên timeline của thread tương ứng — như span trong distributed tracing của backend.</p>

    <p><strong>Đọc system trace</strong>: với mỗi thread, xem trạng thái</p>
    <ul>
      <li><strong>Running</strong>: đang chạy trên CPU — tốn thời gian vì code của bạn.</li>
      <li><strong>Runnable</strong>: muốn chạy nhưng CPU đang bận việc khác (quá nhiều thread, máy yếu).</li>
      <li><strong>Sleeping / Uninterruptible (D)</strong>: chờ lock, chờ I/O (D thường là đọc đĩa).</li>
    </ul>
    <p>Với jank: tìm frame dài ở hàng <em>Expected/Actual Timeline</em> (Android 12+), xem <code>Choreographer#doFrame</code> của main thread và <code>DrawFrame</code> của RenderThread trong khoảng đó.</p>

    <p><strong>Perfetto có SQL</strong>: trace là một database (bảng <code>slice</code>, <code>thread</code>, <code>process</code>...). Thời gian tính bằng <strong>nano giây</strong>.
    Rất hợp để so sánh nhiều trace hoặc tự động hoá trong CI.</p>

    <p>Thêm: <strong>Memory Profiler</strong> (heap dump, theo dõi allocation), <strong>Power Profiler</strong> (trên máy có ODPM như Pixel 6+),
    thư viện <strong>JankStats</strong> (<code>androidx.metrics:metrics-performance</code>) để báo frame chậm từ production.</p>

    <div class="callout"><p>💡 Profile bản <em>profileable</em> release, không phải debug. Thêm <code>&lt;profileable android:shell="true"/&gt;</code> vào manifest của buildType dùng để đo,
    hoặc chọn "Profile with low overhead" trong Android Studio.</p></div>
  `,

  codeTabs: [
    { id: "section", label: "① Đánh dấu code", lines: [
      "import androidx.tracing.trace",
      "",
      "class CatalogRepository(private val api: Api, private val db: Db) {",
      "    suspend fun load(): List<Product> = trace(\"Catalog.load\") {",
      "        val json = trace(\"Catalog.fetch\") { api.products() }",
      "        val list = trace(\"Catalog.parse\") { parse(json) }",
      "        trace(\"Catalog.save\") { db.insertAll(list) }",
      "        list",
      "    }",
      "}",
      "// Lưu ý: trace() không nên dùng xuyên qua điểm suspend nếu coroutine đổi thread;",
      "// khi đó dùng Trace.beginAsyncSection / endAsyncSection"
    ]},
    { id: "record", label: "② Thu trace", lines: [
      "# Cách 1: Android Studio → Profiler → CPU → 'Capture System Activities'",
      "",
      "# Cách 2: dòng lệnh, 10 giây, có section của app",
      "adb shell perfetto -o /data/misc/perfetto-traces/trace.pftrace -t 10s \\",
      "    sched freq idle am wm gfx view binder_driver hal dalvik input res \\",
      "    -a com.shop",
      "adb pull /data/misc/perfetto-traces/trace.pftrace",
      "",
      "# Mở file tại https://ui.perfetto.dev"
    ]},
    { id: "read", label: "③ Đọc timeline", lines: [
      "main thread (com.shop)",
      "  Choreographer#doFrame 48ms   ← frame này lỡ 2 vsync",
      "    traversal",
      "      RV OnBindView 31ms",
      "        Catalog.parse 27ms      ← section tự đặt: parse trên main thread!",
      "RenderThread",
      "  DrawFrame 6ms                ← GPU không phải vấn đề",
      "",
      "thread state: Running 44ms, Runnable 3ms, Sleeping 1ms"
    ]},
    { id: "sql", label: "④ Perfetto SQL", lines: [
      "-- 10 section tốn thời gian nhất trên main thread",
      "SELECT s.name, s.dur / 1e6 AS ms",
      "FROM slice s",
      "JOIN thread_track tt ON s.track_id = tt.id",
      "JOIN thread t USING (utid)",
      "WHERE t.is_main_thread = 1",
      "ORDER BY s.dur DESC",
      "LIMIT 10;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="mark"><div class="nl">🏷️ Đánh dấu section</div><div class="ns">trace(\"Catalog.parse\") { ... }</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="rec"><div class="nl">⏺️ Thu system trace</div><div class="ns">Profiler hoặc adb shell perfetto</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="ui"><div class="nl">🗺️ ui.perfetto.dev</div><div class="ns">frame dài · thread state</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="sql"><div class="nl">🧮 SQL trên trace</div><div class="ns">slice · thread · dur (ns)</div></div>
  `,
  steps: [
    { title: "1 · Đặt section quanh nghi phạm", tab: "section", highlight: [4, 5, 6, 7], on: ["mark"],
      desc: "Section giống span trong tracing backend: có tên, có thời lượng, lồng nhau được." },
    { title: "2 · Cẩn thận với coroutine", tab: "section", highlight: [11, 12], on: ["mark"],
      desc: "Section đồng bộ phải bắt đầu và kết thúc trên cùng thread. Qua điểm suspend có thể đổi thread → dùng async section." },
    { title: "3 · Thu trace", tab: "record", highlight: [4, 5, 6, 7], on: ["a1", "rec"],
      desc: "<code>-a com.shop</code> bật ghi section của app. Các category (sched, gfx, view...) quyết định dữ liệu nào được ghi." },
    { title: "4 · Tìm frame dài", tab: "read", highlight: [2, 4, 5, 7], on: ["a2", "ui"],
      desc: "doFrame 48 ms, trong đó 27 ms là parse ngay trong onBindViewHolder. RenderThread chỉ 6 ms → vấn đề nằm ở main thread." },
    { title: "5 · Đọc thread state", tab: "read", highlight: [9], on: ["ui"],
      desc: "Chủ yếu Running → code của mình tốn CPU. Nếu chủ yếu Sleeping/D → đang chờ lock hoặc I/O." },
    { title: "6 · Truy vấn trace", tab: "sql", highlight: [2, 3, 6, 7], on: ["a3", "sql"],
      desc: "Đơn vị dur là nano giây nên chia 1e6 ra ms. Có thể chạy cùng truy vấn trên trace before/after để so sánh." }
  ],

  quiz: [
    { q: "Method tracing khác sampling ở điểm nào?", options: [
        "Tracing overhead thấp hơn",
        "Tracing ghi mọi lần vào/ra hàm, overhead cao nên thời gian tuyệt đối bị méo; sampling chụp stack định kỳ, overhead thấp",
        "Sampling cho số lần gọi chính xác",
        "Không khác nhau"
      ], correct: 1, explanation: "Dùng sampling để tìm hàm nóng; tracing khi cần đếm lời gọi." },
    { q: "Muốn thấy đoạn code của mình trên timeline Perfetto, dùng gì?", options: [
        "Log.d()", "Trace.beginSection()/endSection() hoặc trace(\"tên\") { }", "println()", "Toast"
      ], correct: 1, explanation: "Section hiện thành thanh có tên trên thread tương ứng." },
    { q: "Thread ở trạng thái Runnable lâu nghĩa là gì?", options: [
        "Thread đang chờ I/O",
        "Thread sẵn sàng chạy nhưng không được cấp CPU (CPU đang bận việc khác)",
        "Thread đã kết thúc",
        "Thread đang chạy code của bạn"
      ], correct: 1, explanation: "Dấu hiệu tranh chấp CPU: quá nhiều thread, máy yếu." },
    { q: "Trạng thái Uninterruptible sleep (D) thường gợi ý điều gì?", options: [
        "Đang vẽ GPU", "Đang chờ I/O đĩa", "Đang GC", "Đang render text"
      ], correct: 1, explanation: "D thường là chờ I/O ở tầng kernel." },
    { q: "Trong bảng slice của Perfetto, cột dur có đơn vị gì?", options: [
        "Giây", "Mili giây", "Micro giây", "Nano giây"
      ], correct: 3, explanation: "Perfetto dùng nano giây cho ts và dur." },
    { q: "Frame dài: main thread doFrame 48 ms, RenderThread DrawFrame 6 ms. Nên tập trung tối ưu đâu?", options: [
        "GPU/shader", "Công việc trên main thread (bind, layout, parse)", "Mạng", "Kích thước APK"
      ], correct: 1, explanation: "Phần lớn thời gian nằm trên main thread." },
    { q: "Vì sao dùng trace() đồng bộ xuyên qua điểm suspend có thể sai?", options: [
        "Vì coroutine không hỗ trợ trace",
        "Vì sau điểm suspend coroutine có thể tiếp tục trên thread khác, còn section đồng bộ phải begin/end cùng thread",
        "Vì làm crash app",
        "Vì Perfetto không đọc được Kotlin"
      ], correct: 1, explanation: "Dùng async section (beginAsyncSection với cookie) cho công việc xuyên thread." },
    { q: "Để profile bản release với overhead thấp, app cần khai báo gì?", options: [
        "android:debuggable=true",
        "<profileable android:shell=\"true\"/> trong manifest",
        "minifyEnabled false",
        "Không cần gì"
      ], correct: 1, explanation: "Profileable cho phép công cụ profile mà không cần debuggable (vốn làm chậm app)." },
    { q: "JankStats dùng để làm gì?", options: [
        "Giảm APK size",
        "Thu thông tin frame chậm ngay trong app (kể cả production) kèm trạng thái UI",
        "Thay thế Perfetto",
        "Phát hiện memory leak"
      ], correct: 1, explanation: "Thư viện androidx.metrics báo frame jank và cho gắn state (màn hình, thao tác) để phân tích." }
  ]
});
