window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Async sâu",
  title: "Cancellation, select! & timeout — huỷ bằng cách drop",
  subtitle: "drop future = huỷ tại điểm .await · cancel safety · select! biased · timeout · CancellationToken · JoinSet",

  theory: `
    <p>Java huỷ việc bằng <code>Thread.interrupt()</code> hay <code>future.cancel(true)</code> — mang tính "xin phép", code phải tự kiểm tra cờ. Rust async huỷ theo cách khác hẳn:
    <strong>ngừng poll và drop future</strong>. Không cần hợp tác, nhưng cũng không báo trước.</p>

    <p><strong>1. Ngữ nghĩa huỷ</strong></p>
    <ul>
      <li>Future chỉ chạy khi được poll. Drop nó → state machine bị huỷ <em>tại điểm .await đang chờ</em>, các biến cục bộ được drop theo thứ tự (RAII: đóng connection, trả permit, nhả lock).</li>
      <li>Code sau điểm await đó <strong>không bao giờ chạy</strong>. Không có <code>finally</code>; dọn dẹp phải nằm trong <code>Drop</code> của các giá trị.</li>
      <li>Những ai drop future: <code>select!</code> (nhánh thua), <code>timeout</code> (hết giờ), <code>JoinHandle::abort</code>, axum khi client ngắt kết nối (hyper drop future của handler).</li>
    </ul>

    <p><strong>2. Cancel safety</strong> — câu hỏi: "nếu future này bị drop giữa chừng rồi tạo lại, có mất dữ liệu không?"</p>
    <table>
      <tr><th>Cancel-safe (an toàn trong select! lặp)</th><th>KHÔNG cancel-safe</th></tr>
      <tr><td><code>mpsc::Receiver::recv</code>, <code>broadcast::Receiver::recv</code>, <code>TcpListener::accept</code>, <code>AsyncReadExt::read</code>, <code>sleep</code></td>
          <td><code>read_exact</code>, <code>read_to_end</code>, <code>write_all</code> (có thể đã ghi một phần), <code>Mutex::lock</code> (mất vị trí xếp hàng), tự viết loop gom buffer</td></tr>
    </table>
    <p>Ví dụ nguy hiểm: <code>select! { msg = read_frame(&amp;mut sock) =&gt; ..., _ = tick.tick() =&gt; ... }</code> trong vòng lặp, <code>read_frame</code> đọc header rồi chờ body; tick thắng → nửa frame đã đọc bị vứt, stream lệch.
    Sửa: giữ state bên ngoài (buffer trong struct, như <code>tokio_util::codec::Framed</code>) hoặc ghim một future dài hạn và poll <code>&amp;mut fut</code>.</p>

    <p><strong>3. select!</strong>: poll đồng thời nhiều nhánh, nhánh đầu tiên xong thắng, <em>các nhánh còn lại bị drop</em>. Mặc định chọn nhánh ngẫu nhiên để công bằng;
    <code>biased;</code> để kiểm tra theo thứ tự viết (hữu ích khi ưu tiên tín hiệu shutdown). Pattern không khớp (vd <code>Some(x) = rx.recv()</code> nhận <code>None</code>) → nhánh đó bị vô hiệu cho lần select đó;
    tất cả nhánh vô hiệu → chạy <code>else</code> (thiếu else thì panic).</p>

    <p><strong>4. Công cụ</strong></p>
    <ul>
      <li><code>tokio::time::timeout(dur, fut)</code> → <code>Result&lt;T, Elapsed&gt;</code>. Luôn bọc lời gọi mạng ra ngoài (HTTP client, Redis) — không có timeout = rò task khi đối tác treo.</li>
      <li><code>tokio_util::sync::CancellationToken</code>: huỷ <em>hợp tác</em> kiểu Java, cho shutdown có trật tự: task tự <code>select!</code> trên <code>token.cancelled()</code>, kịp flush/commit offset. <code>child_token()</code> tạo cây huỷ.</li>
      <li><code>JoinSet</code>: tập task có chủ; <code>join_next().await</code> lấy kết quả theo thứ tự xong; <strong>drop JoinSet = abort mọi task trong nó</strong> (structured concurrency).</li>
    </ul>
    <div class="callout"><p>💡 Handler axum có thể bị drop khi client ngắt kết nối. Nếu handler làm 2 bước "trừ tiền → ghi đơn" bằng 2 lệnh DB riêng, huỷ giữa chừng để lại trạng thái nửa vời.
    Việc phải hoàn tất trọn vẹn → gói trong transaction (rollback khi drop) hoặc <code>tokio::spawn</code> tách khỏi vòng đời request.</p></div>
  `,

  codeTabs: [
    { id: "drop", label: "① Drop = huỷ", lines: [
      "async fn transfer(db: &PgPool, from: i64, to: i64, amt: i64) -> anyhow::Result<()> {",
      "    debit(db, from, amt).await?;          // (1)",
      "    // <- client ngắt kết nối ở đây: hyper drop future",
      "    credit(db, to, amt).await?;           // (2) KHÔNG BAO GIỜ CHẠY",
      "    Ok(())",
      "}",
      "",
      "// Sửa: transaction -> drop Transaction chưa commit = ROLLBACK",
      "let mut tx = db.begin().await?;",
      "debit_tx(&mut tx, from, amt).await?;",
      "credit_tx(&mut tx, to, amt).await?;",
      "tx.commit().await?;"
    ]},
    { id: "select", label: "② select!", lines: [
      "loop {",
      "    tokio::select! {",
      "        biased;                                   // kiểm tra theo thứ tự",
      "        _ = token.cancelled() => {",
      "            tracing::info!(\"shutdown requested\");",
      "            break;",
      "        }",
      "        Some(job) = rx.recv() => process(job).await,   // recv: cancel-safe",
      "        _ = interval.tick() => flush_metrics().await,",
      "        else => break,                           // mọi nhánh đều vô hiệu",
      "    }",
      "}"
    ]},
    { id: "unsafe", label: "③ Không cancel-safe", lines: [
      "// SAI: read_exact có thể đã đọc một phần rồi bị drop",
      "loop {",
      "    tokio::select! {",
      "        r = sock.read_exact(&mut header) => { /* ... */ }",
      "        _ = ping.tick() => send_ping().await,",
      "    }",
      "}",
      "",
      "// ĐÚNG: Framed giữ buffer bên ngoài future; next() là cancel-safe",
      "let mut frames = Framed::new(sock, LengthDelimitedCodec::new());",
      "loop {",
      "    tokio::select! {",
      "        Some(frame) = frames.next() => handle(frame?).await,",
      "        _ = ping.tick() => send_ping().await,",
      "    }",
      "}"
    ]},
    { id: "timeout", label: "④ timeout & JoinSet", lines: [
      "use tokio::time::{timeout, Duration};",
      "",
      "let user = timeout(Duration::from_millis(300), profile_client.get(id))",
      "    .await",
      "    .map_err(|_| AppError::UpstreamTimeout)??;",
      "",
      "let mut set = tokio::task::JoinSet::new();",
      "for shop in shops { set.spawn(sync_shop(shop)); }",
      "while let Some(res) = set.join_next().await {",
      "    if let Err(e) = res? { tracing::warn!(%e, \"shop sync failed\"); }",
      "}",
      "// return sớm / panic -> set bị drop -> mọi task còn lại bị abort"
    ]},
    { id: "token", label: "⑤ CancellationToken", lines: [
      "let root = CancellationToken::new();",
      "",
      "let t = root.child_token();",
      "tokio::spawn(async move {",
      "    tokio::select! {",
      "        _ = t.cancelled() => { consumer.commit_offsets().await; }",
      "        _ = consumer.run() => {}",
      "    }",
      "});",
      "",
      "tokio::signal::ctrl_c().await?;",
      "root.cancel();                         // mọi child nhận tín hiệu"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sel"><div class="nl">🔀 select! / timeout / abort</div><div class="ns">người quyết định dừng poll</div></div>
    <div class="arrow" id="a1">↓ drop future đang chờ ở .await</div>
    <div class="row">
      <div class="node" id="raii"><div class="nl">🧹 Drop cục bộ</div><div class="ns">connection, permit, Transaction → rollback</div></div>
      <div class="node" id="lost"><div class="nl">⚠️ Code sau .await</div><div class="ns">không bao giờ chạy</div></div>
    </div>
    <div class="arrow" id="a2">↓ future được tạo lại vòng sau?</div>
    <div class="row">
      <div class="node" id="safe"><div class="nl">✅ Cancel-safe</div><div class="ns">recv, accept, Framed::next</div></div>
      <div class="node" id="uns"><div class="nl">❌ Mất dữ liệu</div><div class="ns">read_exact, write_all</div></div>
    </div>
    <div class="node" id="tok"><div class="nl">🤝 CancellationToken</div><div class="ns">huỷ hợp tác: kịp flush/commit</div></div>
  `,
  steps: [
    { title: "1 · Huỷ giữa hai bước", tab: "drop", highlight: [2, 3, 4], on: ["sel", "a1", "lost"],
      desc: "Client ngắt → hyper drop future của handler. Bước (2) không chạy, tiền đã trừ mà chưa cộng." },
    { title: "2 · RAII cứu: transaction", tab: "drop", highlight: [9, 10, 11, 12], on: ["raii"],
      desc: "Transaction của sqlx bị drop khi chưa commit → rollback. Dọn dẹp nằm trong Drop, không cần finally." },
    { title: "3 · select! với biased", tab: "select", highlight: [3, 4, 8, 9, 10], on: ["sel", "safe"],
      desc: "Nhánh shutdown được kiểm tra trước. <code>recv</code> cancel-safe nên thua ở vòng này cũng không mất message." },
    { title: "4 · Bẫy read_exact", tab: "unsafe", highlight: [4, 5, 10, 13], on: ["a2", "uns", "safe"],
      desc: "read_exact bị drop khi đã đọc nửa header → stream lệch. Framed giữ buffer ngoài future nên next() an toàn." },
    { title: "5 · timeout & JoinSet", tab: "timeout", highlight: [3, 5, 7, 8, 9, 12], on: ["sel"],
      desc: "Mọi lời gọi mạng có hạn chót. JoinSet quản lý nhóm task; drop là abort cả nhóm." },
    { title: "6 · Huỷ hợp tác", tab: "token", highlight: [1, 3, 6, 12], on: ["tok"],
      desc: "Khi cần dọn dẹp async (commit offset Kafka), task tự lắng nghe token thay vì bị drop đột ngột." }
  ],

  quiz: [
    { q: "Rust async huỷ một future bằng cách nào?", options: [
        "Gửi interrupt cho thread",
        "Ngừng poll và drop future; nó dừng tại điểm .await đang chờ",
        "Throw exception vào future",
        "Không huỷ được"
      ], correct: 1, explanation: "Drop state machine, các biến cục bộ được drop theo RAII." },
    { q: "Trong select!, các nhánh không thắng bị làm gì?", options: [
        "Chạy tiếp ngầm", "Bị drop (huỷ)", "Được xếp hàng lại", "Panic"
      ], correct: 1, explanation: "Vì vậy nhánh phải cancel-safe nếu select nằm trong loop." },
    { q: "Phương thức nào cancel-safe khi dùng trong select! lặp?", options: [
        "read_exact", "write_all", "mpsc::Receiver::recv", "read_to_end"
      ], correct: 2, explanation: "recv không lấy message ra khỏi channel nếu bị huỷ trước khi trả về." },
    { q: "Client ngắt kết nối giữa lúc handler axum đang chạy. Điều gì có thể xảy ra?", options: [
        "Handler luôn chạy xong",
        "Future của handler có thể bị drop, code sau .await đang chờ không chạy",
        "Tokio tự retry",
        "Server panic"
      ], correct: 1, explanation: "Dùng transaction hoặc tách việc bắt buộc hoàn tất ra task riêng." },
    { q: "biased; trong select! làm gì?", options: [
        "Chọn nhánh ngẫu nhiên",
        "Kiểm tra các nhánh theo đúng thứ tự viết",
        "Bỏ qua nhánh else",
        "Tăng tốc độ"
      ], correct: 1, explanation: "Hữu ích để ưu tiên tín hiệu shutdown; mất tính công bằng." },
    { q: "Drop JoinSet thì các task bên trong?", options: [
        "Tiếp tục chạy", "Bị abort", "Bị join tự động", "Chuyển thành detached"
      ], correct: 1, explanation: "Khác JoinHandle đơn lẻ — JoinSet mang tính structured concurrency." },
    { q: "tokio::time::timeout trả về gì khi hết giờ?", options: [
        "None", "Err(Elapsed), future bên trong bị drop", "Panic", "Ok(default)"
      ], correct: 1, explanation: "Future gốc bị huỷ tại điểm chờ." },
    { q: "Khi nào dùng CancellationToken thay vì abort()?", options: [
        "Không bao giờ",
        "Khi task cần dọn dẹp async có trật tự (commit offset, flush buffer) trước khi dừng",
        "Khi muốn dừng nhanh nhất",
        "Chỉ trong test"
      ], correct: 1, explanation: "abort drop ngay; token cho task cơ hội tự kết thúc." },
    { q: "Rust async có khối finally để chạy dọn dẹp khi bị huỷ không?", options: [
        "Có, try/finally",
        "Không; dọn dẹp phải đặt trong Drop của các giá trị (RAII) — và Drop không async được",
        "Có, defer!",
        "Chỉ với tokio::main"
      ], correct: 1, explanation: "Dọn dẹp cần async → dùng huỷ hợp tác (token) thay vì dựa vào drop." }
  ]
});
