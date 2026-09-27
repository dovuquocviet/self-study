window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Concurrency",
  title: "Channel: mpsc, oneshot, broadcast, watch & actor pattern",
  subtitle: "chọn channel theo hình dạng giao tiếp · Lagged của broadcast · watch chỉ giữ giá trị mới nhất · actor thay Mutex",

  theory: `
    <p>"Đừng giao tiếp bằng cách chia sẻ bộ nhớ; hãy chia sẻ bộ nhớ bằng cách giao tiếp." Tokio có 4 loại channel, mỗi loại cho một hình dạng giao tiếp. Chọn đúng loại là nửa thiết kế.</p>

    <table>
      <tr><th>Channel</th><th>Hình dạng</th><th>Đặc điểm</th><th>Ví dụ trong service</th></tr>
      <tr><td><code>mpsc::channel(n)</code></td><td>Nhiều gửi → một nhận</td><td>Bounded, FIFO; <code>Sender</code> clone được; nhận <code>None</code> khi mọi Sender đã drop</td><td>Hàng đợi job, gom event để ghi lô</td></tr>
      <tr><td><code>oneshot</code></td><td>Một gửi → một nhận, <strong>một giá trị</strong></td><td><code>send</code> không async; receiver là future</td><td>Trả lời cho request gửi vào actor</td></tr>
      <tr><td><code>broadcast::channel(n)</code></td><td>Nhiều gửi → <strong>mọi</strong> người nhận</td><td>Mỗi receiver nhận mọi message (T: Clone); chậm quá thì <code>RecvError::Lagged(k)</code> — mất k message cũ</td><td>Đẩy sự kiện tới mọi WebSocket, invalidate cache nhiều nơi</td></tr>
      <tr><td><code>watch::channel(v)</code></td><td>Một giá trị <strong>mới nhất</strong> → nhiều người đọc</td><td>Không hàng đợi: giá trị cũ bị ghi đè; <code>changed().await</code> báo có giá trị mới</td><td>Config hot-reload, trạng thái health, tín hiệu shutdown</td></tr>
    </table>

    <p><strong>Chi tiết hay bị bỏ qua</strong></p>
    <ul>
      <li>mpsc: channel đóng khi <em>mọi</em> <code>Sender</code> bị drop. Quên drop một bản clone (vd giữ trong main) → consumer <code>recv()</code> chờ mãi, chương trình không thoát.</li>
      <li>broadcast không có backpressure với sender: sender không bao giờ chờ, receiver chậm sẽ <strong>Lagged</strong>. Phải xử lý nhánh đó (log + tiếp tục, hoặc resync toàn bộ).</li>
      <li>watch: <code>borrow()</code> trả guard giữ read lock — đừng giữ qua <code>.await</code>; clone giá trị ra hoặc dùng <code>borrow_and_update()</code> rồi thả ngay.</li>
      <li><code>std::sync::mpsc</code> chặn thread — không dùng trong async (trừ <code>try_recv</code>); dùng tokio hoặc <code>flume</code>/<code>crossbeam</code> cho thread thường.</li>
    </ul>

    <p><strong>Actor pattern</strong>: một task <em>sở hữu</em> tài nguyên (connection, state lớn, rate limiter), nhận lệnh qua <code>mpsc</code>, trả lời qua <code>oneshot</code> kèm trong lệnh.
    Không cần Mutex vì chỉ một task chạm tài nguyên; tuần tự hoá tự nhiên; bounded mpsc cho backpressure miễn phí. Bên ngoài chỉ thấy một "handle" (struct bọc <code>Sender</code>, <code>Clone</code>)
    — giống một Spring bean nhưng mọi lời gọi được xếp hàng vào một thread duy nhất.</p>
    <div class="callout"><p>💡 Chọn nhanh: cần trả lời → mpsc + oneshot. Mọi subscriber cần mọi sự kiện → broadcast. Chỉ cần trạng thái hiện tại → watch.
    Phân phối việc cho N worker (mỗi việc một người làm) → mpsc với receiver bọc <code>Arc&lt;Mutex&gt;</code>, hoặc <code>async-channel</code> (MPMC).</p></div>
  `,

  codeTabs: [
    { id: "actor", label: "① Actor + oneshot", lines: [
      "enum Cmd {",
      "    Get { key: String, reply: oneshot::Sender<Option<String>> },",
      "    Set { key: String, val: String },",
      "}",
      "",
      "async fn run_actor(mut rx: mpsc::Receiver<Cmd>) {",
      "    let mut store = HashMap::new();              // chỉ actor chạm vào -> không Mutex",
      "    while let Some(cmd) = rx.recv().await {",
      "        match cmd {",
      "            Cmd::Get { key, reply } => { let _ = reply.send(store.get(&key).cloned()); }",
      "            Cmd::Set { key, val } => { store.insert(key, val); }",
      "        }",
      "    }                                             // mọi Sender drop -> thoát vòng",
      "}"
    ]},
    { id: "handle", label: "② Handle", lines: [
      "#[derive(Clone)]",
      "pub struct KvHandle { tx: mpsc::Sender<Cmd> }",
      "",
      "impl KvHandle {",
      "    pub fn spawn() -> Self {",
      "        let (tx, rx) = mpsc::channel(256);",
      "        tokio::spawn(run_actor(rx));",
      "        Self { tx }",
      "    }",
      "    pub async fn get(&self, key: &str) -> Option<String> {",
      "        let (reply, rx) = oneshot::channel();",
      "        self.tx.send(Cmd::Get { key: key.into(), reply }).await.ok()?;",
      "        rx.await.ok()?",
      "    }",
      "}"
    ]},
    { id: "bc", label: "③ broadcast & Lagged", lines: [
      "let (tx, _) = broadcast::channel::<PriceUpdate>(1024);",
      "",
      "// mỗi WebSocket client:",
      "let mut rx = tx.subscribe();",
      "loop {",
      "    match rx.recv().await {",
      "        Ok(update) => ws.send(to_msg(&update)).await?,",
      "        Err(RecvError::Lagged(n)) => {",
      "            tracing::warn!(n, \"client too slow, skipped\");   // mất n bản cũ",
      "        }",
      "        Err(RecvError::Closed) => break,",
      "    }",
      "}"
    ]},
    { id: "watch", label: "④ watch", lines: [
      "let (cfg_tx, cfg_rx) = watch::channel(Config::load()?);",
      "",
      "// nạp lại mỗi phút",
      "tokio::spawn(async move {",
      "    let mut tick = tokio::time::interval(Duration::from_secs(60));",
      "    loop { tick.tick().await; let _ = cfg_tx.send(Config::load().unwrap()); }",
      "});",
      "",
      "// người dùng: luôn thấy giá trị mới nhất",
      "let limit = cfg_rx.borrow().rate_limit;          // đọc rồi thả guard ngay",
      "",
      "// hoặc phản ứng khi đổi:",
      "while cfg_rx.changed().await.is_ok() {",
      "    let cfg = cfg_rx.borrow_and_update().clone();",
      "    rebuild_limiter(&cfg);",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="h1"><div class="nl">🔌 Handler A</div><div class="ns">KvHandle.clone()</div></div>
      <div class="node" id="h2"><div class="nl">🔌 Handler B</div><div class="ns">KvHandle.clone()</div></div>
    </div>
    <div class="arrow" id="a1">↓ mpsc (bounded) · lệnh kèm oneshot</div>
    <div class="node" id="act"><div class="nl">🎭 Actor task</div><div class="ns">sở hữu HashMap, xử lý tuần tự</div></div>
    <div class="arrow" id="a2">↑ oneshot trả lời</div>
    <div class="row">
      <div class="node" id="bc"><div class="nl">📢 broadcast</div><div class="ns">mọi subscriber nhận mọi msg · Lagged</div></div>
      <div class="node" id="wt"><div class="nl">👁️ watch</div><div class="ns">chỉ giá trị mới nhất</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Actor sở hữu state", tab: "actor", highlight: [1, 2, 6, 7, 8, 13], on: ["act"],
      desc: "Chỉ một task chạm HashMap → không cần Mutex. Channel đóng khi mọi Sender drop → actor tự thoát." },
    { title: "2 · Handle clone được", tab: "handle", highlight: [1, 2, 6, 7], on: ["h1", "h2", "a1"],
      desc: "Handle bọc Sender, đặt trong AppState như một bean. Bounded 256 → tự có backpressure." },
    { title: "3 · Hỏi và nhận trả lời", tab: "handle", highlight: [11, 12, 13], on: ["a1", "act", "a2"],
      desc: "Tạo oneshot, gửi nửa Sender kèm lệnh, await nửa Receiver. <code>.ok()?</code>: actor chết → None." },
    { title: "4 · broadcast cho fan-out", tab: "bc", highlight: [1, 4, 6, 8, 9], on: ["bc"],
      desc: "Sender không bao giờ chờ; receiver chậm bị Lagged(n). Phải xử lý nhánh này." },
    { title: "5 · watch cho trạng thái hiện tại", tab: "watch", highlight: [1, 6, 10, 13, 14], on: ["wt"],
      desc: "Không hàng đợi — ghi đè. <code>borrow()</code> giữ read lock: đọc xong thả ngay, đừng giữ qua await." }
  ],

  quiz: [
    { q: "Cần gửi request tới một task và nhận lại đúng một kết quả. Kết hợp nào?", options: [
        "broadcast + watch", "mpsc cho lệnh + oneshot kèm trong lệnh để trả lời", "Hai mpsc", "watch"
      ], correct: 1, explanation: "Mẫu actor chuẩn." },
    { q: "Receiver của broadcast chậm hơn sender quá dung lượng buffer thì?", options: [
        "Sender bị chặn",
        "recv trả Err(Lagged(n)) — n message cũ nhất bị bỏ qua",
        "Panic",
        "Buffer tự mở rộng"
      ], correct: 1, explanation: "broadcast không áp backpressure lên sender." },
    { q: "watch channel phù hợp nhất cho?", options: [
        "Hàng đợi job",
        "Trạng thái hiện tại như config hot-reload, cờ shutdown",
        "Log mọi sự kiện",
        "Trả lời request"
      ], correct: 1, explanation: "Chỉ giữ giá trị mới nhất; giá trị trung gian có thể bị bỏ qua." },
    { q: "mpsc Receiver::recv() trả None khi nào?", options: [
        "Khi buffer trống",
        "Khi mọi Sender đã bị drop và buffer đã rút hết",
        "Sau timeout",
        "Khi có lỗi mạng"
      ], correct: 1, explanation: "Quên drop một Sender → recv chờ mãi." },
    { q: "Lợi ích chính của actor so với Arc<Mutex<State>>?", options: [
        "Luôn nhanh hơn",
        "Một task sở hữu tài nguyên: tuần tự hoá tự nhiên, giữ được qua .await, bounded channel cho backpressure",
        "Không cần tokio",
        "Không cần Clone"
      ], correct: 1, explanation: "Đặc biệt hợp khi tài nguyên cần I/O (connection)." },
    { q: "Dùng std::sync::mpsc::Receiver::recv() trong handler async có vấn đề gì?", options: [
        "Không vấn đề",
        "Nó chặn worker thread",
        "Lỗi biên dịch",
        "Mất message"
      ], correct: 1, explanation: "Dùng tokio::sync::mpsc trong async." },
    { q: "Giữ kết quả cfg_rx.borrow() qua .await có vấn đề gì?", options: [
        "Không",
        "Guard giữ read lock, chặn sender cập nhật (và làm future không Send)",
        "Mất giá trị",
        "Panic"
      ], correct: 1, explanation: "Đọc/clone rồi thả ngay." },
    { q: "Muốn N worker cùng lấy việc từ một hàng đợi (mỗi việc chỉ một worker làm), tokio mpsc có sẵn không?", options: [
        "Có, clone Receiver",
        "Không — Receiver không clone được; bọc Arc<tokio Mutex<Receiver>> hoặc dùng async-channel (MPMC)",
        "Dùng broadcast",
        "Dùng watch"
      ], correct: 1, explanation: "broadcast sẽ giao mỗi việc cho mọi worker — sai ngữ nghĩa." },
    { q: "oneshot::Sender::send có cần .await không?", options: [
        "Có", "Không — send là hàm đồng bộ, trả Err nếu receiver đã drop", "Chỉ khi bounded", "Chỉ trong actor"
      ], correct: 1, explanation: "Chỉ có đúng một slot nên không bao giờ phải chờ." }
  ]
});
