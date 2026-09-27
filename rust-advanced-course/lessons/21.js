window.LESSONS.push({
  id: "21",
  phase: "6", phaseName: "Tổng kết",
  title: "Tổng kết: bản đồ quyết định cho service Rust production",
  subtitle: "từ lifetime tới WASM trên một trang · checklist review code · triệu chứng → nguyên nhân · ôn tập",

  theory: `
    <p>Khoá này đi từ hệ kiểu (lifetime, trait) xuống runtime (Future, Pin, Tokio), sang đồng thời (lock, channel, atomic), rồi lên tầng service (lỗi, tracing, axum, sqlx, serde, hiệu năng)
    và ra biên (unsafe/FFI/UniFFI, macro, WASM). Bài cuối gom lại thành <strong>các quyết định</strong> bạn sẽ gặp hằng ngày.</p>

    <p><strong>1. Bảng quyết định nhanh</strong></p>
    <table>
      <tr><th>Tình huống</th><th>Chọn</th><th>Bài</th></tr>
      <tr><td>Dữ liệu đi qua spawn/cache/thread</td><td>Sở hữu (String, Arc), không mượn</td><td>01</td></tr>
      <tr><td>Repository cần mock, gọi qua state</td><td><code>Arc&lt;dyn Trait&gt;</code> + <code>#[async_trait]</code>; tập đóng → enum</td><td>03</td></tr>
      <tr><td>"cannot be unpinned"</td><td><code>pin!</code> tại chỗ / <code>Box::pin</code> khi lưu</td><td>05</td></tr>
      <tr><td>Hàm CPU/đồng bộ &gt; 100µs</td><td><code>spawn_blocking</code> (I/O chặn) / rayon (tính toán)</td><td>06</td></tr>
      <tr><td>Gọi mạng ra ngoài</td><td>Luôn có <code>timeout</code>; cân nhắc cancel safety</td><td>07</td></tr>
      <tr><td>Nhiều việc song song</td><td>Có giới hạn: bounded channel, Semaphore, buffer_unordered</td><td>08</td></tr>
      <tr><td>State chia sẻ, không await trong vùng găng</td><td><code>std::sync::Mutex</code>; đọc nhiều ghi hiếm → ArcSwap/watch</td><td>09, 10</td></tr>
      <tr><td>Tài nguyên cần I/O tuần tự</td><td>Actor: mpsc + oneshot</td><td>10</td></tr>
      <tr><td>Counter/metrics</td><td>Atomic <code>Relaxed</code></td><td>11</td></tr>
      <tr><td>Lỗi</td><td>Domain enum (thiserror) → AppError: IntoResponse; log một lần ở biên</td><td>12</td></tr>
      <tr><td>Quan sát</td><td><code>#[instrument]</code>, JSON log, OTLP, <code>traceparent</code></td><td>13</td></tr>
      <tr><td>Nhiều bước DB phải cùng thành công</td><td>Transaction (drop = rollback)</td><td>15</td></tr>
      <tr><td>Chia sẻ logic với mobile / edge</td><td>Crate core thuần + UniFFI / workers-rs</td><td>18, 20</td></tr>
    </table>

    <p><strong>2. Triệu chứng → nguyên nhân thường gặp</strong></p>
    <ul>
      <li><em>p99 của mọi endpoint tăng khi một endpoint nặng</em> → code chặn worker thread (hash, nén, std I/O) — bài 06.</li>
      <li><em>Task treo im lặng</em> → Future trả Pending mà không ai wake; deadlock lock lồng / read→write; channel không đóng vì còn Sender — bài 04, 09, 10.</li>
      <li><em>Bộ nhớ tăng đều tới OOM</em> → unbounded channel, spawn không giới hạn, cache không TTL — bài 08.</li>
      <li><em>"future cannot be sent between threads safely"</em> → giữ <code>MutexGuard</code>/<code>Rc</code> qua <code>.await</code>, hoặc async fn trong trait thiếu <code>+ Send</code> — bài 03, 09.</li>
      <li><em>Dữ liệu nửa vời sau khi client huỷ request</em> → nhiều bước không trong transaction — bài 07, 15.</li>
      <li><em>Mất field span trong log của task nền</em> → quên <code>.instrument(span)</code> — bài 13.</li>
      <li><em>ID sai ở app mobile/web</em> → i64 serialize dạng số vượt 2^53 — bài 16.</li>
    </ul>

    <p><strong>3. Checklist review một PR Rust backend</strong></p>
    <ol>
      <li>Có <code>.unwrap()</code> trên dữ liệu từ bên ngoài không? Có <code>clone()</code> trong vòng lặp nóng không?</li>
      <li>Có <code>.await</code> khi đang giữ lock không? Có code đồng bộ nặng trong async không?</li>
      <li>Mọi <code>tokio::spawn</code>/channel đều có giới hạn và có người xử lý kết quả/lỗi?</li>
      <li>Mọi lời gọi mạng có timeout? Các nhánh <code>select!</code> có cancel-safe?</li>
      <li>Lỗi có context, được map đúng HTTP status, log đúng một lần, không lộ chi tiết?</li>
      <li>Query có kiểm tra lúc biên dịch (<code>query!</code>), dùng transaction khi cần, không N+1?</li>
      <li>Khối <code>unsafe</code> có comment <code>// SAFETY:</code>? Có thể thay bằng API safe?</li>
    </ol>
    <div class="callout"><p>💡 Tư duy "kỹ sư" khác "code theo mẫu" ở một câu hỏi: <strong>"cái gì xảy ra bên dưới?"</strong> — ai poll future này, ai giải phóng bộ nhớ này, cái gì giới hạn số task này,
    điều gì xảy ra nếu future bị drop ở dòng này. Trả lời được 4 câu đó cho mỗi đoạn code, bạn đã làm chủ Rust backend.</p></div>
  `,

  codeTabs: [
    { id: "skeleton", label: "① Khung service", lines: [
      "#[tokio::main]",
      "async fn main() -> anyhow::Result<()> {",
      "    let provider = init_telemetry();                        // 13",
      "    let cfg = Config::from_env().context(\"config\")?;         // 12",
      "    let pool = PgPoolOptions::new().max_connections(20)     // 15",
      "        .acquire_timeout(Duration::from_secs(3)).connect(&cfg.db).await?;",
      "    sqlx::migrate!().run(&pool).await?;",
      "    let token = CancellationToken::new();                   // 07",
      "    let consumer = tokio::spawn(run_consumer(token.child_token()));",
      "    let state = AppState { db: pool.clone(), orders: Arc::new(PgOrders::new(pool.clone())) };",
      "    let app = routes().layer(middleware_stack()).with_state(state);   // 14",
      "    let listener = TcpListener::bind(\"0.0.0.0:8080\").await?;",
      "    axum::serve(listener, app).with_graceful_shutdown(shutdown_signal()).await?;",
      "    token.cancel();",
      "    consumer.await??;",
      "    pool.close().await;",
      "    provider.shutdown()?;",
      "    Ok(())",
      "}"
    ]},
    { id: "consumer", label: "② Consumer có giới hạn", lines: [
      "async fn run_consumer(token: CancellationToken) -> anyhow::Result<()> {",
      "    let (tx, mut rx) = mpsc::channel::<OrderEvent>(1_000);          // 08",
      "    let reader = tokio::spawn(read_kafka(tx, token.clone()));",
      "    let mut batch = Vec::with_capacity(500);                        // 17",
      "    let mut tick = tokio::time::interval(Duration::from_secs(1));",
      "    loop {",
      "        tokio::select! {                                            // 07",
      "            biased;",
      "            _ = token.cancelled() => break,",
      "            Some(ev) = rx.recv() => { batch.push(ev); if batch.len() >= 500 { flush(&mut batch).await?; } }",
      "            _ = tick.tick() => if !batch.is_empty() { flush(&mut batch).await?; },",
      "        }",
      "    }",
      "    flush(&mut batch).await?;                                       // không mất lô cuối",
      "    reader.await?",
      "}"
    ]},
    { id: "review", label: "③ Tìm lỗi", lines: [
      "async fn sync_all(State(s): State<AppState>) -> String {",
      "    let ids: Vec<i64> = s.cache.lock().unwrap().keys().cloned().collect();",
      "    let guard = s.stats.lock().unwrap();",
      "    for id in ids {",
      "        tokio::spawn(push_to_erp(id));",
      "    }",
      "    let report = reqwest::get(&s.cfg.report_url).await.unwrap().text().await.unwrap();",
      "    format!(\"{} {}\", guard.total, report)",
      "}",
      "// Lỗi: (3) guard giữ qua await · (5) spawn không giới hạn, bỏ kết quả",
      "//      (7) không timeout + unwrap dữ liệu ngoài · handler trả String thay vì Result"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ty"><div class="nl">🧬 Hệ kiểu</div><div class="ns">lifetime · trait · dyn/impl</div></div>
      <div class="node" id="rt"><div class="nl">⚙️ Runtime</div><div class="ns">Future · Pin · Tokio</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="cc"><div class="nl">🔀 Đồng thời</div><div class="ns">lock · channel · atomic · backpressure · cancel</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="svc"><div class="nl">🏗️ Service</div><div class="ns">lỗi · tracing · axum · sqlx · serde · hiệu năng</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="edge"><div class="nl">🌉 Biên</div><div class="ns">unsafe/FFI · UniFFI · macro · WASM</div></div>
  `,
  steps: [
    { title: "1 · Khởi động theo thứ tự", tab: "skeleton", highlight: [3, 4, 5, 6, 7], on: ["svc"],
      desc: "Telemetry trước tiên để log được lỗi khởi động; config có context; pool có giới hạn; migration trước khi nhận request." },
    { title: "2 · Nền và HTTP song song", tab: "skeleton", highlight: [8, 9, 10, 11, 13], on: ["cc", "svc"],
      desc: "Consumer có token để dừng hợp tác. State chứa Arc<dyn>. Middleware stack như bài 14." },
    { title: "3 · Tắt đúng thứ tự", tab: "skeleton", highlight: [13, 14, 15, 16, 17], on: ["svc"],
      desc: "Ngừng HTTP → huỷ consumer và chờ nó flush → đóng pool → flush trace." },
    { title: "4 · Consumer: giới hạn + huỷ + lô", tab: "consumer", highlight: [2, 4, 8, 9, 10, 11, 14], on: ["rt", "a1", "cc"],
      desc: "Bounded channel, biased select ưu tiên shutdown, gom lô 500 hoặc mỗi giây, flush lô cuối trước khi thoát." },
    { title: "5 · Luyện mắt review", tab: "review", highlight: [3, 5, 7, 10, 11], on: ["ty", "edge", "a3"],
      desc: "Bốn lỗi trong 9 dòng: guard qua await, spawn không giới hạn, không timeout, unwrap dữ liệu ngoài. Áp checklist ở phần lý thuyết." }
  ],

  quiz: [
    { q: "T: 'static trong tokio::spawn đòi hỏi gì ở dữ liệu bị capture?", options: [
        "Phải là biến static",
        "Không chứa tham chiếu ngắn hạn — dùng dữ liệu sở hữu (String, Arc...)",
        "Phải Copy",
        "Phải nằm trên stack"
      ], correct: 1, explanation: "Bài 01." },
    { q: "Trait có async fn native muốn dùng qua Arc<dyn Trait>. Giải pháp phổ biến?", options: [
        "Không thể, bỏ trait",
        "#[async_trait] (box future) hoặc tự trả Pin<Box<dyn Future + Send>>",
        "Thêm 'static",
        "Dùng Rc"
      ], correct: 1, explanation: "Bài 03." },
    { q: "Future trả Poll::Pending nhưng không đăng ký waker. Hậu quả?", options: [
        "Executor poll lại ngay",
        "Task treo vĩnh viễn, không lỗi",
        "Panic",
        "Lỗi biên dịch"
      ], correct: 1, explanation: "Bài 04." },
    { q: "Vì sao future sinh từ async là !Unpin?", options: [
        "Vì lớn",
        "Có thể tự tham chiếu sau lần poll đầu; move làm con trỏ nội bộ dangling",
        "Vì chứa Mutex",
        "Vì là trait object"
      ], correct: 1, explanation: "Bài 05." },
    { q: "Endpoint nén file 300ms làm p99 các endpoint khác tăng. Sửa?", options: [
        "Tăng timeout",
        "Chạy phần nén trong spawn_blocking/rayon",
        "Thêm .await",
        "Dùng tokio Mutex"
      ], correct: 1, explanation: "Bài 06." },
    { q: "Trong select! lặp, nhánh nào KHÔNG an toàn khi bị huỷ?", options: [
        "rx.recv()", "listener.accept()", "sock.read_exact(&mut buf)", "interval.tick()"
      ], correct: 2, explanation: "Bài 07." },
    { q: "Consumer Kafka ghi ClickHouse chậm hơn tốc độ đọc. Cần gì?", options: [
        "unbounded_channel",
        "Bounded channel để producer chờ (backpressure), Kafka giữ phần dư",
        "Tăng heap",
        "Bỏ bớt message"
      ], correct: 1, explanation: "Bài 08." },
    { q: "Vùng găng ngắn không có await trong handler async nên dùng?", options: [
        "tokio::sync::Mutex", "std::sync::Mutex (hoặc parking_lot)", "RefCell", "static mut"
      ], correct: 1, explanation: "Bài 09." },
    { q: "Config hot-reload cho nhiều task, chỉ cần giá trị mới nhất?", options: [
        "broadcast", "watch (hoặc ArcSwap)", "mpsc", "oneshot"
      ], correct: 1, explanation: "Bài 10." },
    { q: "Cờ 'dữ liệu đã sẵn sàng' giữa hai thread cần cặp ordering?", options: [
        "Relaxed/Relaxed", "Release khi store, Acquire khi load", "SeqCst bắt buộc cả hai", "Không cần atomic"
      ], correct: 1, explanation: "Bài 11." },
    { q: "Log lỗi ở đâu trong kiến trúc lỗi phân tầng?", options: [
        "Mọi tầng",
        "Một lần ở biên (IntoResponse / kết thúc job); tầng dưới chỉ thêm context",
        "Chỉ repository",
        "Không log"
      ], correct: 1, explanation: "Bài 12." },
    { q: "Task spawn mất field span của request cha. Sửa?", options: [
        "Dùng MDC", "fut.instrument(span) / in_current_span()", "Bật RUST_LOG=trace", "Dùng println!"
      ], correct: 1, explanation: "Bài 13." },
    { q: "Router::layer(A).layer(B) — request đi qua?", options: [
        "A rồi B", "B rồi A", "Chỉ A", "Song song"
      ], correct: 1, explanation: "Bài 14: layer thêm sau nằm ngoài." },
    { q: "Handler bị huỷ giữa 'trừ kho' và 'tạo đơn'. Cách đảm bảo nhất quán?", options: [
        "try/finally",
        "Đặt hai lệnh trong transaction sqlx: drop khi chưa commit = rollback",
        "Retry",
        "Mutex"
      ], correct: 1, explanation: "Bài 07 + 15." },
    { q: "Consumer không muốn crash khi gặp event type mới từ producer?", options: [
        "deny_unknown_fields", "Variant #[serde(other)] Unknown", "untagged", "flatten"
      ], correct: 1, explanation: "Bài 16." },
    { q: "Hàm chuẩn hoá chuỗi trả về gì để tránh cấp phát khi không cần sửa?", options: [
        "String", "Cow<'_, str>", "Box<str>", "Vec<u8>"
      ], correct: 1, explanation: "Bài 17." },
    { q: "Chia sẻ engine tính giá Rust cho app Kotlin và Swift native?", options: [
        "Viết JNI tay cho Android và C header cho iOS",
        "UniFFI: Record/Object/Error + binding sinh tự động",
        "Chạy HTTP server trong app",
        "Không thể"
      ], correct: 1, explanation: "Bài 18." },
    { q: "Công cụ để xem #[tokio::main] mở ra thành code gì?", options: [
        "cargo tree", "cargo expand", "cargo audit", "rustfmt"
      ], correct: 1, explanation: "Bài 19." },
    { q: "Thứ gì KHÔNG có trong Worker Rust (wasm32-unknown-unknown)?", options: [
        "serde", "Thread và socket thô (std::net), tokio runtime", "async/await", "Result"
      ], correct: 1, explanation: "Bài 20." }
  ]
});
