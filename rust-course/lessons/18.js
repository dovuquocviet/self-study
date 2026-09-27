window.LESSONS.push({
  id: "18",
  phase: "4", phaseName: "Bộ nhớ & đồng thời",
  title: "async/await với Tokio — hàng nghìn request trên vài thread",
  subtitle: "Future lười · runtime Tokio · #[tokio::main] · spawn task · join! · không block trong async · spawn_blocking",

  theory: `
    <p>Backend phần lớn thời gian <em>chờ I/O</em> (DB, HTTP, Kafka). Mô hình Spring MVC cổ điển: một thread / request, thread ngồi chờ → cần pool vài trăm thread.
    Java 21 có virtual thread; Spring WebFlux có reactive. Rust chọn <strong>async/await</strong>: hàm <code>async fn</code> được biên dịch thành <em>state machine</em> nhỏ,
    chờ I/O thì nhường thread cho việc khác. Vài thread phục vụ hàng chục nghìn kết nối.</p>

    <p><strong>Future lười.</strong> Gọi <code>async fn fetch()</code> <em>không chạy gì cả</em> — chỉ trả về một <code>Future</code>. Nó chạy khi được <code>.await</code> (trong async khác) hoặc giao cho
    runtime. Khác <code>CompletableFuture</code> Java (bắt đầu chạy ngay khi tạo). Quên <code>.await</code> → compiler cảnh báo "futures do nothing unless you .await".</p>

    <p><strong>Runtime không có sẵn trong std.</strong> Rust chỉ định nghĩa trait <code>Future</code> và cú pháp; cần thư viện <em>executor</em> để chạy. <strong>Tokio</strong> là runtime phổ biến nhất
    (axum, sqlx, reqwest, rdkafka… đều dựa trên nó): thread pool đa luồng + work-stealing, event loop I/O (epoll/kqueue), timer, TCP, channel, Mutex async.
    <code>#[tokio::main]</code> là macro dựng runtime rồi <code>block_on</code> hàm main.</p>

    <table>
      <tr><th>Cần</th><th>Tokio</th><th>Java tương tự</th></tr>
      <tr><td>Chạy song song một việc nền</td><td><code>tokio::spawn(async move { ... })</code> → <code>JoinHandle</code></td><td><code>executor.submit()</code> / virtual thread</td></tr>
      <tr><td>Chờ nhiều future cùng lúc (cùng task)</td><td><code>tokio::join!(a, b)</code>, <code>try_join!</code></td><td><code>CompletableFuture.allOf</code></td></tr>
      <tr><td>Lấy cái xong trước</td><td><code>tokio::select!</code></td><td><code>anyOf</code></td></tr>
      <tr><td>Timeout</td><td><code>tokio::time::timeout(dur, fut)</code></td><td><code>orTimeout</code></td></tr>
      <tr><td>Việc CPU nặng / API blocking</td><td><code>tokio::task::spawn_blocking</code></td><td>pool riêng cho blocking</td></tr>
    </table>

    <p><strong>Quy tắc sống còn: không block trong async.</strong> <code>std::thread::sleep</code>, đọc file đồng bộ lớn, driver DB đồng bộ, vòng tính toán dài mà không <code>.await</code> → chiếm thread worker,
    các task khác trên thread đó đứng chờ, latency toàn service tăng vọt. Dùng phiên bản async (<code>tokio::time::sleep</code>, <code>tokio::fs</code>, sqlx) hoặc đẩy vào <code>spawn_blocking</code>.</p>

    <p><strong>tokio::spawn yêu cầu future <code>Send + 'static</code></strong> — vì task có thể bị chuyển giữa các thread worker. Hệ quả: dùng <code>async move</code>, chia sẻ bằng <code>Arc</code>,
    và đừng giữ <code>std::sync::MutexGuard</code> hay <code>Rc</code> qua một điểm <code>.await</code> (compiler báo future is not Send).</p>

    <div class="callout"><p>💡 Future là cooperative: chỉ nhường thread tại các điểm <code>.await</code>. Phần sâu hơn (poll, Waker, Pin, cancellation, backpressure) nằm ở khoá "Rust nâng cao cho backend".</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "async cơ bản", lines: [
      "# Cargo.toml: tokio = { version = \"1\", features = [\"full\"] }",
      "use std::time::Duration;",
      "",
      "async fn fetch_price(sku: &str) -> u64 {",
      "    tokio::time::sleep(Duration::from_millis(100)).await;  // giả lập gọi HTTP",
      "    if sku == \"AO-01\" { 150_000 } else { 90_000 }",
      "}",
      "",
      "#[tokio::main]",
      "async fn main() {",
      "    let fut = fetch_price(\"AO-01\");   // CHƯA chạy gì",
      "    let price = fut.await;             // bây giờ mới chạy",
      "    println!(\"{price}\");",
      "}"
    ]},
    { id: "conc", label: "join! & spawn", lines: [
      "// Tuần tự: ~300ms",
      "let a = fetch_price(\"A\").await;",
      "let b = fetch_price(\"B\").await;",
      "let c = fetch_price(\"C\").await;",
      "",
      "// Đồng thời trong cùng task: ~100ms",
      "let (a, b, c) = tokio::join!(fetch_price(\"A\"), fetch_price(\"B\"), fetch_price(\"C\"));",
      "",
      "// Task độc lập trên runtime (có thể chạy thread khác)",
      "let skus = vec![\"A\".to_string(), \"B\".to_string()];",
      "let mut handles = Vec::new();",
      "for sku in skus {",
      "    handles.push(tokio::spawn(async move { fetch_price(&sku).await }));",
      "}",
      "for h in handles { let p: u64 = h.await.unwrap(); println!(\"{p}\"); }"
    ]},
    { id: "block", label: "Đừng block!", lines: [
      "async fn bad() {",
      "    std::thread::sleep(Duration::from_secs(2));   // SAI: chặn cả thread worker",
      "    let s = std::fs::read_to_string(\"big.csv\");   // SAI nếu file lớn",
      "}",
      "",
      "async fn good() -> anyhow::Result<()> {",
      "    tokio::time::sleep(Duration::from_secs(2)).await;         // nhường thread",
      "    let s = tokio::fs::read_to_string(\"big.csv\").await?;",
      "    let hash = tokio::task::spawn_blocking(move || {",
      "        bcrypt::hash(&s, 12)                                   // CPU nặng -> pool riêng",
      "    }).await??;",
      "    let r = tokio::time::timeout(Duration::from_secs(3), fetch_price(\"A\")).await;",
      "    Ok(())",
      "}"
    ]},
    { id: "send", label: "Send qua .await", lines: [
      "use std::sync::{Arc, Mutex};",
      "",
      "async fn bump(counter: Arc<Mutex<u64>>) {",
      "    {",
      "        let mut g = counter.lock().unwrap();",
      "        *g += 1;",
      "    }                                   // guard drop TRƯỚC .await",
      "    save().await;",
      "}",
      "",
      "// Nếu giữ g qua save().await:",
      "// error: future cannot be sent between threads safely",
      "//        MutexGuard<u64> is not Send  -> tokio::spawn(bump(..)) bị từ chối"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                          // Rust + Tokio",
      "// CompletableFuture.supplyAsync(..) (chạy ngay) async { .. } (lười, cần .await/spawn)",
      "// f.join() / f.get()                            f.await",
      "// CompletableFuture.allOf(a, b)                 tokio::join!(a, b)",
      "// executor.submit(task)                         tokio::spawn(async move { .. })",
      "// Thread.sleep() trong virtual thread: ổn       std::thread::sleep trong async: SAI",
      "// WebFlux Mono/Flux                             async fn + Stream",
      "// JVM có sẵn thread pool                        cần runtime (Tokio) — #[tokio::main]"
    ]}
  ],

  stageHtml: `
    <div class="node" id="fn"><div class="nl">📝 async fn fetch()</div><div class="ns">gọi → trả Future (chưa chạy)</div></div>
    <div class="arrow" id="a1">↓ .await / tokio::spawn</div>
    <div class="node" id="rt"><div class="nl">⚙️ Tokio runtime</div><div class="ns">vài worker thread + event loop I/O</div></div>
    <div class="row">
      <div class="node" id="t1"><div class="nl">task A</div><div class="ns">chờ DB → nhường</div></div>
      <div class="node" id="t2"><div class="nl">task B</div><div class="ns">đang chạy</div></div>
      <div class="node" id="t3"><div class="nl">task C</div><div class="ns">chờ HTTP → nhường</div></div>
    </div>
    <div class="arrow" id="a2">↓ block trong async?</div>
    <div class="node" id="bad"><div class="nl">🐌 worker bị chiếm</div><div class="ns">mọi task trên đó đứng chờ → spawn_blocking</div></div>
  `,
  steps: [
    { title: "1 · Future lười", tab: "basic", highlight: [4, 11, 12], on: ["fn"],
      desc: "Gọi fetch_price chỉ tạo Future. Không .await thì không có gì chạy — khác CompletableFuture Java." },
    { title: "2 · Runtime", tab: "basic", highlight: [1, 9, 10], on: ["a1", "rt"],
      desc: "std không có executor. #[tokio::main] dựng runtime đa luồng rồi chạy main trên đó." },
    { title: "3 · Đồng thời", tab: "conc", highlight: [2, 3, 4, 7], on: ["t1", "t2", "t3"],
      desc: "await tuần tự = cộng dồn thời gian. join! chờ cả ba cùng lúc → bằng cái chậm nhất." },
    { title: "4 · spawn task", tab: "conc", highlight: [12, 13, 15], on: ["rt"],
      desc: "tokio::spawn giao task cho runtime; async move để task sở hữu sku. JoinHandle.await trả Result (Err nếu task panic)." },
    { title: "5 · Không block", tab: "block", highlight: [2, 3, 7, 8, 9, 10], on: ["a2", "bad"],
      desc: "Hàm blocking chiếm worker thread. Dùng API async hoặc spawn_blocking cho CPU nặng/thư viện đồng bộ." },
    { title: "6 · Send qua .await", tab: "send", highlight: [5, 7, 8, 12, 13], on: ["rt"],
      desc: "Task có thể đổi thread tại .await, nên mọi thứ giữ qua .await phải Send. Thả guard trước khi await." }
  ],

  quiz: [
    { q: "Gọi <code>let f = fetch_price(\"A\");</code> (async fn) mà không await thì?", options: [
        "Chạy nền ngay", "Không chạy gì; chỉ tạo Future (và có cảnh báo nếu không dùng)", "Panic", "Chạy đồng bộ"
      ], correct: 1, explanation: "Future Rust lười." },
    { q: "Vì sao cần Tokio?", options: [
        "Vì Rust không có từ khoá async",
        "std chỉ định nghĩa Future; cần runtime (executor + I/O driver) để chạy",
        "Để có GC",
        "Để biên dịch nhanh hơn"
      ], correct: 1, explanation: "Có runtime khác (smol, embassy) nhưng Tokio là chuẩn thực tế cho backend." },
    { q: "Ba lời gọi 100ms: <code>tokio::join!(a, b, c)</code> mất khoảng?", options: [
        "300ms", "100ms", "33ms", "0ms"
      ], correct: 1, explanation: "Chạy đồng thời, bằng cái chậm nhất." },
    { q: "Gọi <code>std::thread::sleep(2s)</code> trong async fn chạy trên Tokio gây gì?", options: [
        "Không sao",
        "Chặn worker thread 2s, các task khác trên thread đó bị treo theo",
        "Lỗi biên dịch",
        "Tokio tự chuyển thành async sleep"
      ], correct: 1, explanation: "Dùng tokio::time::sleep(..).await." },
    { q: "Tính bcrypt hash (CPU nặng) trong handler async nên làm?", options: [
        "Gọi thẳng", "tokio::task::spawn_blocking", "thread::sleep trước", "Dùng Rc"
      ], correct: 1, explanation: "Đẩy sang pool blocking riêng." },
    { q: "Vì sao future truyền cho <code>tokio::spawn</code> phải Send + 'static?", options: [
        "Để serialize",
        "Task có thể chạy/chuyển giữa các worker thread và sống lâu hơn scope tạo nó",
        "Để tối ưu",
        "Không cần"
      ], correct: 1, explanation: "Dùng async move và Arc." },
    { q: "Giữ <code>std::sync::MutexGuard</code> qua một <code>.await</code> rồi spawn thì?", options: [
        "Chạy bình thường", "Lỗi biên dịch: future is not Send", "Deadlock chắc chắn", "Panic"
      ], correct: 1, explanation: "Thả guard trước await, hoặc dùng tokio::sync::Mutex nếu thật sự cần giữ." },
    { q: "Tương đương <code>CompletableFuture.allOf</code>?", options: [
        "tokio::select!", "tokio::join!", "tokio::spawn", "block_on"
      ], correct: 1, explanation: "select! lấy cái xong trước (như anyOf)." },
    { q: "<code>tokio::time::timeout(3s, fut).await</code> trả về gì?", options: [
        "Giá trị của fut", "Result: Ok(giá trị) nếu kịp, Err(Elapsed) nếu quá hạn", "Option", "bool"
      ], correct: 1, explanation: "Hết giờ thì future bên trong bị drop (huỷ)." }
  ]
});
