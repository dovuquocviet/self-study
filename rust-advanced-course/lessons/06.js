window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Async sâu",
  title: "Tokio runtime: worker, work-stealing, spawn vs spawn_blocking",
  subtitle: "multi_thread vs current_thread · local queue + steal · blocking pool · block_in_place · JoinHandle · cấu hình runtime",

  theory: `
    <p><code>#[tokio::main]</code> che giấu cả một hệ thống. Hiểu nó giúp bạn trả lời: service cần bao nhiêu thread, gọi thư viện đồng bộ ở đâu, vì sao p99 tăng vọt khi một endpoint nặng.</p>

    <p><strong>1. Hai loại runtime</strong></p>
    <table>
      <tr><th></th><th><code>multi_thread</code> (mặc định của <code>#[tokio::main]</code>)</th><th><code>current_thread</code> (mặc định của <code>#[tokio::test]</code>)</th></tr>
      <tr><td>Worker</td><td>N thread, mặc định = số CPU</td><td>1 thread (thread gọi block_on)</td></tr>
      <tr><td>spawn đòi</td><td><code>Send + 'static</code></td><td><code>Send + 'static</code> (hoặc <code>spawn_local</code> trong LocalSet: không cần Send)</td></tr>
      <tr><td>Dùng khi</td><td>Server HTTP, consumer Kafka</td><td>Test, CLI, nơi muốn tất định; mô hình giống Workers/Node</td></tr>
    </table>

    <p><strong>2. Work-stealing scheduler</strong></p>
    <ul>
      <li>Mỗi worker có <strong>hàng đợi cục bộ</strong> (256 slot) + một <strong>LIFO slot</strong> cho task vừa được wake (tốt cho cache: task gửi message → task nhận chạy ngay trên cùng core).</li>
      <li>Tràn thì đẩy sang <strong>hàng đợi toàn cục</strong>. Worker rảnh sẽ <strong>trộm</strong> một nửa hàng đợi của worker khác.</li>
      <li>Mỗi task có "ngân sách" (coop budget, 128 thao tác): tài nguyên Tokio (socket, channel) tự trả Pending khi hết ngân sách để task khác được chạy — nhưng <em>chỉ khi code của bạn có .await vào tài nguyên Tokio</em>.</li>
    </ul>

    <p><strong>3. Ba cách chạy việc</strong></p>
    <table>
      <tr><th>API</th><th>Chạy trên</th><th>Dùng cho</th></tr>
      <tr><td><code>tokio::spawn(fut)</code></td><td>Worker thread (ít, = số CPU)</td><td>Việc I/O-bound, có .await thường xuyên</td></tr>
      <tr><td><code>spawn_blocking(closure)</code></td><td><strong>Blocking pool</strong> riêng, tối đa 512 thread mặc định, thread rảnh 10s thì tắt</td><td>Hàm đồng bộ chặn: bcrypt/argon2, nén, đọc file lớn bằng std, driver đồng bộ, JNI</td></tr>
      <tr><td><code>block_in_place(closure)</code></td><td>Biến worker hiện tại thành blocking, chuyển task khác đi chỗ khác</td><td>Khi không muốn move dữ liệu vào closure <code>'static</code>; chỉ có ở multi_thread</td></tr>
    </table>
    <p>Việc CPU-bound nặng và kéo dài (xử lý ảnh, tính toán batch) nên đưa sang pool riêng như <code>rayon</code> rồi gửi kết quả qua <code>oneshot</code>, tránh làm cạn blocking pool vốn dành cho I/O chặn.</p>

    <p><strong>4. JoinHandle</strong>: <code>spawn</code> trả <code>JoinHandle&lt;T&gt;</code>; <code>.await</code> nó ra <code>Result&lt;T, JoinError&gt;</code> (JoinError nếu task panic hoặc bị abort).
    <strong>Drop JoinHandle không huỷ task</strong> — task chạy tiếp ("detached"). Muốn huỷ: <code>handle.abort()</code>. Panic trong task được bắt lại, không làm sập process
   , nhưng nếu bạn không await handle thì panic chỉ in ra stderr — dễ mất dấu.</p>

    <p><strong>So với Java</strong>: worker thread ≈ <code>ForkJoinPool</code> (cũng work-stealing); spawn_blocking ≈ đẩy vào một <code>ThreadPoolExecutor</code> riêng cho I/O chặn —
    đúng pattern "tách pool" bạn hay làm với <code>@Async("ioExecutor")</code>. Khác biệt: ở Tokio, code chặn trong worker không bị phát hiện tự động; nó chỉ lặng lẽ làm chậm mọi thứ.</p>
    <div class="callout"><p>💡 Dấu hiệu worker bị chặn: latency toàn service tăng khi chỉ một endpoint nặng; <code>tokio-console</code> hiện task có "busy" dài mà không yield.
    Quy tắc: mọi thứ không có <code>.await</code> mà có thể mất &gt; 100µs → <code>spawn_blocking</code>.</p></div>
  `,

  codeTabs: [
    { id: "rt", label: "① Cấu hình runtime", lines: [
      "#[tokio::main]                                   // = multi_thread, worker = số CPU",
      "async fn main() { run().await }",
      "",
      "#[tokio::main(flavor = \"multi_thread\", worker_threads = 4)]",
      "async fn main2() { run().await }",
      "",
      "// Tự dựng (hữu ích khi nhúng vào app khác, hoặc chỉnh thêm):",
      "let rt = tokio::runtime::Builder::new_multi_thread()",
      "    .worker_threads(4)",
      "    .max_blocking_threads(64)                    // mặc định 512",
      "    .thread_name(\"api-worker\")",
      "    .enable_all()                                // bật I/O driver + timer",
      "    .build()?;",
      "rt.block_on(run());"
    ]},
    { id: "block", label: "② spawn_blocking", lines: [
      "async fn register(State(s): State<AppState>, Json(req): Json<Register>) -> AppResult<StatusCode> {",
      "    // SAI: argon2 tốn ~50–300ms CPU -> chặn worker",
      "    // let hash = argon2_hash(&req.password)?;",
      "",
      "    let pw = req.password.clone();",
      "    let hash = tokio::task::spawn_blocking(move || argon2_hash(&pw))",
      "        .await??;                                // JoinError rồi tới lỗi hash",
      "    s.users.insert(&req.email, &hash).await?;",
      "    Ok(StatusCode::CREATED)",
      "}"
    ]},
    { id: "join", label: "③ JoinHandle", lines: [
      "let h: JoinHandle<u64> = tokio::spawn(async { count_rows().await });",
      "",
      "match h.await {",
      "    Ok(n) => tracing::info!(n, \"done\"),",
      "    Err(e) if e.is_panic() => tracing::error!(\"task panicked\"),",
      "    Err(e) if e.is_cancelled() => tracing::warn!(\"task aborted\"),",
      "    Err(_) => {}",
      "}",
      "",
      "let bg = tokio::spawn(refresh_cache_forever());",
      "drop(bg);            // KHÔNG huỷ: task vẫn chạy (detached)",
      "// bg.abort();       // huỷ thật: task bị drop ở lần .await kế tiếp"
    ]},
    { id: "cpu", label: "④ CPU-bound với rayon", lines: [
      "async fn resize(img: Bytes) -> anyhow::Result<Bytes> {",
      "    let (tx, rx) = tokio::sync::oneshot::channel();",
      "    rayon::spawn(move || {                      // pool CPU riêng, = số core",
      "        let out = do_resize(&img);",
      "        let _ = tx.send(out);",
      "    });",
      "    Ok(rx.await??)",
      "}",
      "// Tokio worker: I/O · blocking pool: I/O chặn · rayon: tính toán"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "// Spring: tách pool cho việc chặn",
      "@Bean Executor ioExecutor() {",
      "    var ex = new ThreadPoolTaskExecutor();",
      "    ex.setMaxPoolSize(64); return ex;",
      "}",
      "@Async(\"ioExecutor\") CompletableFuture<String> hash(String pw) { ... }",
      "",
      "// Tokio: spawn_blocking đã có sẵn blocking pool",
      "// ForkJoinPool (work-stealing) ~ Tokio worker threads"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="w1"><div class="nl">🧵 Worker 1</div><div class="ns">local queue + LIFO slot</div></div>
      <div class="node" id="w2"><div class="nl">🧵 Worker 2 (rảnh)</div><div class="ns">trộm nửa queue của W1</div></div>
    </div>
    <div class="arrow" id="a1">↓ tràn / không ai nhận</div>
    <div class="node" id="gq"><div class="nl">🌐 Global queue</div><div class="ns">worker kiểm tra định kỳ</div></div>
    <div class="arrow" id="a2">↓ spawn_blocking</div>
    <div class="node" id="bp"><div class="nl">🧱 Blocking pool</div><div class="ns">tối đa 512 thread · I/O chặn, hash</div></div>
    <div class="arrow" id="a3">↓ CPU nặng kéo dài</div>
    <div class="node" id="ry"><div class="nl">⚙️ rayon pool</div><div class="ns">kết quả về qua oneshot</div></div>
  `,
  steps: [
    { title: "1 · Runtime đa luồng", tab: "rt", highlight: [1, 4, 8, 9, 10, 12], on: ["w1", "w2"],
      desc: "Mặc định một worker mỗi CPU. <code>enable_all</code> bật reactor I/O và timer — thiếu nó thì TcpStream/sleep panic." },
    { title: "2 · Work-stealing", tab: "rt", highlight: [9], on: ["w2", "a1", "gq"],
      desc: "Task mới vào local queue; tràn thì ra global. Worker rảnh trộm việc để cân bằng tải — giống ForkJoinPool." },
    { title: "3 · Hash mật khẩu → spawn_blocking", tab: "block", highlight: [3, 5, 6, 7], on: ["a2", "bp"],
      desc: "Move dữ liệu sở hữu vào closure <code>'static</code>. <code>??</code>: lần đầu bóc JoinError, lần hai bóc lỗi của hàm hash." },
    { title: "4 · JoinHandle & huỷ", tab: "join", highlight: [3, 5, 6, 11, 12], on: ["w1"],
      desc: "Drop handle không huỷ task. abort() mới huỷ. Panic trong task thành JoinError::is_panic()." },
    { title: "5 · CPU nặng → rayon", tab: "cpu", highlight: [2, 3, 5, 7], on: ["a3", "ry"],
      desc: "Không làm cạn blocking pool bằng việc tính toán dài; rayon có đúng số thread = số core." },
    { title: "6 · Đối chiếu Spring", tab: "java", highlight: [2, 6, 8], on: ["bp"],
      desc: "Cùng một ý tưởng tách pool. Khác: Tokio không cảnh báo khi bạn chặn worker." }
  ],

  quiz: [
    { q: "#[tokio::main] không tham số tạo runtime loại nào?", options: [
        "current_thread", "multi_thread với số worker = số CPU", "Một thread cho mỗi request", "rayon"
      ], correct: 1, explanation: "#[tokio::test] thì mặc định current_thread." },
    { q: "Hàm argon2 tốn 150ms CPU trong handler. Làm gì?", options: [
        "Gọi thẳng, Tokio tự xử lý",
        "Chạy trong tokio::task::spawn_blocking (hoặc pool CPU riêng) rồi await kết quả",
        "Thêm .await sau lời gọi",
        "Tăng worker_threads lên 1000"
      ], correct: 1, explanation: "Code không có .await chiếm cứng worker thread." },
    { q: "Drop một JoinHandle thì task?", options: [
        "Bị huỷ ngay", "Tiếp tục chạy (detached)", "Panic", "Bị tạm dừng"
      ], correct: 1, explanation: "Muốn huỷ phải gọi abort()." },
    { q: "Số thread tối đa mặc định của blocking pool Tokio?", options: [
        "Bằng số CPU", "512", "Không giới hạn", "1"
      ], correct: 1, explanation: "Có thể đổi bằng max_blocking_threads." },
    { q: "Worker rảnh trong Tokio làm gì khi hàng đợi của nó trống?", options: [
        "Ngủ vĩnh viễn",
        "Kiểm tra global queue và trộm task từ hàng đợi của worker khác",
        "Tạo thread mới",
        "Poll lại mọi task Pending"
      ], correct: 1, explanation: "Work-stealing cân bằng tải giữa các worker." },
    { q: "tokio::spawn đòi future có bound gì trên runtime đa luồng?", options: [
        "Không có", "Send + 'static", "Sync", "Unpin + Clone"
      ], correct: 1, explanation: "Task có thể chạy trên worker khác và sống lâu hơn hàm gọi." },
    { q: "Task panic thì .await JoinHandle trả gì?", options: [
        "Process sập ngay",
        "Err(JoinError) với is_panic() = true",
        "Ok(())",
        "Treo mãi"
      ], correct: 1, explanation: "Runtime bắt panic trong task; bạn quyết định xử lý." },
    { q: "block_in_place khác spawn_blocking ở điểm nào?", options: [
        "Không khác",
        "Chạy closure ngay trên thread hiện tại (không cần 'static), runtime chuyển các task khác sang worker khác; chỉ dùng được trên multi_thread",
        "Chạy trên rayon",
        "Chỉ dùng trong test"
      ], correct: 1, explanation: "Tiện khi dữ liệu là tham chiếu không move được, nhưng panic nếu gọi trong current_thread." },
    { q: "Việc CPU-bound nặng, kéo dài (resize ảnh hàng loạt) nên đặt ở đâu?", options: [
        "Tokio worker",
        "Pool CPU riêng như rayon, nhận kết quả qua oneshot",
        "Trong select!",
        "Trong Drop"
      ], correct: 1, explanation: "Blocking pool dành cho I/O chặn; tính toán dài dùng pool có số thread = số core." },
    { q: "Thiếu enable_all() (hoặc enable_io/enable_time) khi tự build runtime thì?", options: [
        "Không sao",
        "Dùng TcpStream hay tokio::time::sleep sẽ panic vì driver chưa bật",
        "Chạy chậm hơn",
        "Chỉ mất log"
      ], correct: 1, explanation: "#[tokio::main] tự gọi enable_all." }
  ]
});
