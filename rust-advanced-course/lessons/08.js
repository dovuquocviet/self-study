window.LESSONS.push({
  id: "08",
  phase: "1", phaseName: "Async sâu",
  title: "Backpressure: giới hạn đồng thời để service không tự sập",
  subtitle: "unbounded = hẹn giờ OOM · bounded channel · Semaphore · buffer_unordered · tower ConcurrencyLimit/LoadShed · poll_ready",

  theory: `
    <p>Spawn task trong Rust rẻ tới mức bạn dễ spawn <em>quá nhiều</em>. Thread pool của Java tự giới hạn (pool size + queue capacity + RejectedExecutionHandler);
    <code>tokio::spawn</code> thì không giới hạn gì. <strong>Backpressure</strong> = khi tầng sau chậm, tầng trước phải chậm lại (chờ hoặc từ chối) thay vì dồn việc vào bộ nhớ.</p>

    <p><strong>1. Ba kiểu hỏng khi thiếu backpressure</strong></p>
    <ul>
      <li><strong>Unbounded channel/queue</strong>: consumer Kafka đọc nhanh hơn ghi DB → queue phình → OOM sau vài giờ. Không có lỗi nào trước đó.</li>
      <li><strong>Spawn không giới hạn</strong>: mỗi request spawn 100 task gọi API ngoài → vượt connection pool, API ngoài trả 429, latency tăng vọt.</li>
      <li><strong>Retry bão</strong>: downstream chậm → timeout → retry → tải tăng gấp đôi.</li>
    </ul>

    <p><strong>2. Công cụ theo tầng</strong></p>
    <table>
      <tr><th>Công cụ</th><th>Cơ chế</th><th>Dùng khi</th></tr>
      <tr><td><code>mpsc::channel(cap)</code></td><td><code>send().await</code> chờ khi đầy</td><td>Pipeline producer → consumer</td></tr>
      <tr><td><code>Semaphore</code> + <code>acquire_owned()</code></td><td>N permit; permit trả lại khi drop</td><td>Giới hạn số việc đồng thời bất kỳ (gọi API ngoài, spawn)</td></tr>
      <tr><td><code>stream.buffer_unordered(n)</code></td><td>Tối đa n future chạy cùng lúc</td><td>Xử lý danh sách lớn có giới hạn</td></tr>
      <tr><td>tower <code>ConcurrencyLimitLayer</code> / <code>RateLimitLayer</code></td><td>Service chỉ <code>poll_ready</code> = Ready khi còn chỗ</td><td>Giới hạn ở tầng HTTP / client</td></tr>
      <tr><td>tower <code>LoadShedLayer</code></td><td>Không Ready → trả lỗi ngay thay vì chờ</td><td>Fail fast (503) thay vì xếp hàng vô hạn</td></tr>
    </table>

    <p><strong>3. poll_ready — backpressure trong tower</strong>: trait <code>Service</code> có hai method: <code>poll_ready</code> ("anh nhận thêm được không?") và <code>call</code>.
    Người gọi phải chờ Ready rồi mới call. <code>ConcurrencyLimit</code> trả Pending khi hết permit → áp lực truyền ngược lên tới tầng accept connection. Đây là cách một hệ thống async
    "nói không" mà không cần queue.</p>

    <p><strong>4. Chọn chờ hay từ chối?</strong> Chờ (bounded channel, Semaphore) phù hợp với job nền, consumer Kafka (Kafka đã là buffer bền). Với request người dùng, chờ lâu tệ hơn từ chối nhanh:
    kết hợp giới hạn + <code>timeout</code> hoặc <code>LoadShed</code> để trả 503 ngay, client retry có backoff.</p>
    <div class="callout"><p>💡 Quy tắc review code: thấy <code>unbounded_channel</code> hoặc <code>tokio::spawn</code> trong vòng lặp theo dữ liệu đầu vào → hỏi "cái gì giới hạn số lượng?".
    Không trả lời được = bug đang chờ ngày có traffic lớn.</p></div>
  `,

  codeTabs: [
    { id: "chan", label: "① Bounded channel", lines: [
      "let (tx, mut rx) = tokio::sync::mpsc::channel::<Event>(1_000);  // tối đa 1000 chờ",
      "",
      "// producer: đọc Kafka",
      "tokio::spawn(async move {",
      "    while let Some(msg) = stream.next().await {",
      "        let ev = decode(msg?)?;",
      "        tx.send(ev).await?;          // ĐẦY -> chờ -> ngừng đọc Kafka = backpressure",
      "    }",
      "    anyhow::Ok(())",
      "});",
      "",
      "// consumer: ghi ClickHouse theo lô",
      "while let Some(ev) = rx.recv().await { batch.push(ev); /* flush khi đủ */ }",
      "",
      "// let (tx, rx) = mpsc::unbounded_channel();   // KHÔNG: hẹn giờ OOM"
    ]},
    { id: "sem", label: "② Semaphore", lines: [
      "let limit = Arc::new(Semaphore::new(20));      // tối đa 20 lời gọi đồng thời",
      "",
      "for order in orders {",
      "    let permit = limit.clone().acquire_owned().await?;   // chờ nếu hết",
      "    let client = client.clone();",
      "    tokio::spawn(async move {",
      "        let _permit = permit;                    // giữ tới hết task",
      "        client.push_to_erp(order).await",
      "    });                                          // drop permit -> trả lại slot",
      "}"
    ]},
    { id: "stream", label: "③ buffer_unordered", lines: [
      "use futures::{stream, StreamExt};",
      "",
      "let results: Vec<anyhow::Result<Price>> = stream::iter(skus)",
      "    .map(|sku| {",
      "        let c = client.clone();",
      "        async move { c.fetch_price(&sku).await }",
      "    })",
      "    .buffer_unordered(16)          // tối đa 16 request cùng lúc",
      "    .collect()",
      "    .await;",
      "// buffered(16): giữ thứ tự kết quả; buffer_unordered: xong trước trả trước"
    ]},
    { id: "tower", label: "④ tower layer", lines: [
      "use tower::ServiceBuilder;",
      "use tower::limit::ConcurrencyLimitLayer;",
      "use tower::load_shed::LoadShedLayer;",
      "",
      "let app = Router::new()",
      "    .route(\"/report\", get(heavy_report))",
      "    .layer(",
      "        ServiceBuilder::new()",
      "            .layer(HandleErrorLayer::new(|_: BoxError| async { StatusCode::SERVICE_UNAVAILABLE }))",
      "            .layer(LoadShedLayer::new())           // không Ready -> lỗi ngay",
      "            .layer(ConcurrencyLimitLayer::new(8)), // tối đa 8 report cùng lúc",
      "    );"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "new ThreadPoolExecutor(",
      "    8, 8, 0L, TimeUnit.MILLISECONDS,",
      "    new ArrayBlockingQueue<>(100),              // ~ bounded channel",
      "    new ThreadPoolExecutor.AbortPolicy());      // ~ LoadShed (từ chối)",
      "",
      "// Resilience4j Bulkhead ~ Semaphore / ConcurrencyLimit",
      "// Tokio spawn KHÔNG có pool size -> phải tự đặt giới hạn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📥 Nguồn: Kafka / HTTP</div><div class="ns">nhanh, không giới hạn</div></div>
    <div class="arrow" id="a1">↓ đẩy việc</div>
    <div class="node" id="lim"><div class="nl">🚧 Điểm giới hạn</div><div class="ns">bounded channel · Semaphore · ConcurrencyLimit</div></div>
    <div class="row">
      <div class="node" id="wait"><div class="nl">⏳ Chờ</div><div class="ns">send().await / acquire().await</div></div>
      <div class="node" id="shed"><div class="nl">🚫 Từ chối</div><div class="ns">LoadShed → 503</div></div>
    </div>
    <div class="arrow" id="a2">↓ chỉ N việc cùng lúc</div>
    <div class="node" id="dst"><div class="nl">🐢 Đích chậm: DB / API ngoài</div><div class="ns">không bị quá tải</div></div>
    <div class="arrow" id="a3">↑ áp lực truyền ngược về nguồn</div>
  `,
  steps: [
    { title: "1 · Bounded channel", tab: "chan", highlight: [1, 7, 15], on: ["src", "a1", "lim", "wait"],
      desc: "Channel đầy → <code>send().await</code> chờ → producer ngừng đọc Kafka. Kafka giữ phần còn lại trên đĩa, service không phình bộ nhớ." },
    { title: "2 · Semaphore giới hạn spawn", tab: "sem", highlight: [1, 4, 7, 9], on: ["lim", "wait", "a2", "dst"],
      desc: "Permit acquire trước khi spawn nên vòng for cũng bị chặn lại. Drop permit (task xong) → slot mở." },
    { title: "3 · buffer_unordered", tab: "stream", highlight: [3, 8, 11], on: ["lim", "a2"],
      desc: "Cách gọn nhất để xử lý danh sách với độ đồng thời cố định, không cần tự quản lý Semaphore." },
    { title: "4 · tower: poll_ready + LoadShed", tab: "tower", highlight: [9, 10, 11], on: ["shed", "a3"],
      desc: "Hết chỗ → ConcurrencyLimit không Ready → LoadShed trả lỗi ngay → HandleErrorLayer đổi thành 503." },
    { title: "5 · Đối chiếu ThreadPoolExecutor", tab: "java", highlight: [3, 4, 7], on: ["lim"],
      desc: "Java có giới hạn sẵn trong pool; Tokio không — bạn phải tự đặt ở đúng chỗ." }
  ],

  quiz: [
    { q: "Vấn đề chính của unbounded_channel trong consumer Kafka ghi DB chậm?", options: [
        "Chậm hơn bounded",
        "Không có backpressure: queue phình tới OOM khi producer nhanh hơn consumer",
        "Không Send",
        "Mất thứ tự"
      ], correct: 1, explanation: "Bounded channel làm producer chờ, để Kafka giữ phần dư." },
    { q: "tokio::spawn có giới hạn số task đồng thời không?", options: [
        "Có, bằng số worker",
        "Không, bạn phải tự giới hạn (Semaphore, JoinSet có kiểm soát, buffer_unordered...)",
        "Có, 512",
        "Có, 10000"
      ], correct: 1, explanation: "Khác ThreadPoolExecutor có pool size và queue." },
    { q: "Permit của Semaphore::acquire_owned được trả lại khi nào?", options: [
        "Gọi release() thủ công bắt buộc",
        "Khi OwnedSemaphorePermit bị drop",
        "Sau 30 giây",
        "Khi task spawn"
      ], correct: 1, explanation: "RAII; move permit vào task để giữ tới khi task xong." },
    { q: "buffer_unordered(16) khác buffered(16) ở điểm nào?", options: [
        "Không khác",
        "unordered trả kết quả theo thứ tự hoàn thành; buffered giữ thứ tự đầu vào",
        "unordered không giới hạn",
        "buffered chạy tuần tự"
      ], correct: 1, explanation: "Cả hai giới hạn 16 future đồng thời." },
    { q: "Trong tower, backpressure được truyền qua method nào?", options: [
        "call", "poll_ready", "clone", "drop"
      ], correct: 1, explanation: "Service chỉ báo Ready khi nhận thêm được." },
    { q: "LoadShedLayer làm gì khi service bên trong chưa Ready?", options: [
        "Chờ vô hạn",
        "Trả lỗi ngay (Overloaded) thay vì xếp hàng",
        "Retry",
        "Tạo thêm worker"
      ], correct: 1, explanation: "Fail fast; kết hợp HandleErrorLayer để trả 503." },
    { q: "Với request người dùng, vì sao thường ưu tiên từ chối nhanh hơn chờ lâu?", options: [
        "Tiết kiệm log",
        "Chờ lâu làm latency tăng, giữ tài nguyên và gây retry bão; 503 nhanh cho client backoff",
        "Vì HTTP không hỗ trợ chờ",
        "Vì Tokio bắt buộc"
      ], correct: 1, explanation: "Job nền thì ngược lại: chờ là hợp lý." },
    { q: "Tương đương Java gần nhất của tower ConcurrencyLimit là?", options: [
        "synchronized", "Resilience4j Bulkhead / Semaphore", "volatile", "ThreadLocal"
      ], correct: 1, explanation: "Giới hạn số lời gọi đồng thời vào một tài nguyên." },
    { q: "Review code thấy tokio::spawn trong for theo từng dòng file CSV đầu vào. Câu hỏi đầu tiên nên hỏi?", options: [
        "Có dùng clone không?",
        "Cái gì giới hạn số task đồng thời?",
        "Có log không?",
        "Có #[inline] không?"
      ], correct: 1, explanation: "File 1 triệu dòng = 1 triệu task + 1 triệu kết nối tiềm năng." }
  ]
});
