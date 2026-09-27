window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Async sâu",
  title: "Future từ bên trong: poll, Context, Waker & state machine",
  subtitle: "trait Future · Poll::Ready/Pending · async fn → enum state machine · waker là 'số điện thoại gọi lại' · tự viết một Future",

  theory: `
    <p>Nhập môn đã dùng <code>async/await</code> như hộp đen. Để debug được task treo, CPU 100%, hay hiểu vì sao "không block trong async", cần mở hộp: Rust async là
    <strong>polling + callback đánh thức</strong>, không có thread ẩn nào chạy future của bạn.</p>

    <p><strong>1. Trait Future (đúng như trong std)</strong></p>
    <p><code>trait Future { type Output; fn poll(self: Pin&lt;&amp;mut Self&gt;, cx: &amp;mut Context&lt;'_&gt;) -&gt; Poll&lt;Self::Output&gt;; }</code>
    với <code>enum Poll&lt;T&gt; { Ready(T), Pending }</code>.</p>
    <ul>
      <li>Executor gọi <code>poll</code>. Future làm được bao nhiêu thì làm, rồi trả <code>Ready(v)</code> (xong) hoặc <code>Pending</code> (chưa xong).</li>
      <li><strong>Hợp đồng quan trọng nhất</strong>: trước khi trả <code>Pending</code>, future phải đảm bảo <code>cx.waker()</code> sẽ được gọi <code>wake()</code> khi có tiến triển
        (socket có dữ liệu, timer hết hạn...). Nếu không, executor sẽ không bao giờ poll lại → task treo vĩnh viễn, không lỗi, không log.</li>
      <li>Future <strong>lười</strong>: tạo ra mà không poll (không <code>.await</code>, không spawn) thì không chạy gì. Compiler cảnh báo <em>unused future</em>.</li>
    </ul>

    <p><strong>2. async fn là một state machine do compiler sinh</strong></p>
    <p><code>async fn handle() { let a = step1().await; let b = step2(a).await; b }</code> được biến thành một <code>enum</code> với mỗi variant là một điểm <code>.await</code>, giữ các biến
    cục bộ còn sống qua điểm đó. Mỗi lần <code>poll</code>, nó chạy tiếp từ variant hiện tại tới <code>.await</code> kế tiếp bị <code>Pending</code>. Hệ quả:</p>
    <ul>
      <li>Kích thước future = kích thước biến sống qua <code>.await</code> lớn nhất. Mảng <code>[u8; 64*1024]</code> giữ qua await làm future to 64KB (và khi spawn, nó nằm trên heap).</li>
      <li>Biến giữ qua <code>.await</code> quyết định future có <code>Send</code> không: giữ <code>Rc</code> hay <code>std::sync::MutexGuard</code> qua await → future không Send → không spawn được trên runtime đa luồng.</li>
      <li>Giữa hai <code>.await</code> là code đồng bộ chạy liền mạch trên worker thread. Vòng lặp tính toán 200ms ở đó = worker bị chiếm 200ms, mọi task khác trên worker phải chờ.</li>
    </ul>

    <p><strong>3. Ai gọi wake?</strong> Tokio có <em>reactor</em> (epoll/kqueue) cho I/O và <em>timer wheel</em> cho sleep. Khi bạn <code>.await</code> một <code>TcpStream::read</code>,
    future đăng ký waker với reactor rồi trả Pending. Khi OS báo socket readable, reactor gọi <code>wake()</code> → task được đẩy lại vào hàng đợi → worker poll tiếp.</p>

    <table>
      <tr><th>Java</th><th>Rust async</th></tr>
      <tr><td><code>CompletableFuture</code> chạy ngay khi tạo (push: callback đẩy kết quả)</td><td><code>Future</code> lười, executor kéo (pull) bằng poll</td></tr>
      <tr><td>Virtual thread (Loom): có stack riêng, JVM tự park/unpark</td><td>Stackless: state machine, không có stack riêng mỗi task</td></tr>
      <tr><td>Blocking call trong virtual thread được JVM xử lý (phần lớn)</td><td>Blocking call chiếm cứng worker thread — runtime không cứu được</td></tr>
    </table>
    <div class="callout"><p>💡 Tự viết <code>impl Future</code> hiếm khi cần ở code nghiệp vụ. Nhưng hiểu hợp đồng "Pending ⇒ đã đăng ký waker" giải thích 90% lỗi async khó: task treo (quên wake),
    CPU 100% (wake liên tục), latency đuôi cao (code đồng bộ quá dài giữa hai await).</p></div>
  `,

  codeTabs: [
    { id: "manual", label: "① Tự viết Future", lines: [
      "struct Delay { when: Instant, spawned: bool }",
      "",
      "impl Future for Delay {",
      "    type Output = &'static str;",
      "    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {",
      "        if Instant::now() >= self.when {",
      "            return Poll::Ready(\"done\");",
      "        }",
      "        if !self.spawned {                    // đăng ký 'gọi lại tôi' đúng 1 lần",
      "            self.spawned = true;",
      "            let waker = cx.waker().clone();",
      "            let when = self.when;",
      "            std::thread::spawn(move || {       // demo; tokio dùng timer wheel",
      "                std::thread::sleep(when - Instant::now());",
      "                waker.wake();                  // báo executor poll lại",
      "            });",
      "        }",
      "        Poll::Pending",
      "    }",
      "}"
    ]},
    { id: "sm", label: "② async → state machine", lines: [
      "async fn handle(id: u64) -> String {",
      "    let user = load_user(id).await;          // điểm dừng #1",
      "    let orders = load_orders(&user).await;   // điểm dừng #2",
      "    format!(\"{} has {}\", user.name, orders.len())",
      "}",
      "",
      "// Compiler sinh (ý tưởng):",
      "enum HandleFuture {",
      "    Start { id: u64 },",
      "    WaitUser { fut: LoadUserFut },",
      "    WaitOrders { user: User, fut: LoadOrdersFut },   // user sống qua await #2",
      "    Done,",
      "}",
      "// poll(): match state { Start => ..., WaitUser => poll fut; Pending => return Pending, ... }"
    ]},
    { id: "bug", label: "③ Bẫy thường gặp", lines: [
      "// (a) Quên wake -> task treo vĩnh viễn",
      "fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {",
      "    if self.ready() { Poll::Ready(()) } else { Poll::Pending }   // không ai gọi wake!",
      "}",
      "",
      "// (b) Wake ngay lập tức mỗi lần -> busy loop, CPU 100%",
      "cx.waker().wake_by_ref(); return Poll::Pending;",
      "",
      "// (c) Future không được poll",
      "async fn audit() { send_audit_log(); }      // thiếu .await -> không gửi gì",
      "",
      "// (d) Code đồng bộ nặng giữa 2 await chiếm worker",
      "let hash = bcrypt::hash(pw, 12)?;           // ~200ms CPU -> dùng spawn_blocking"
    ]},
    { id: "exec", label: "④ Executor tối giản", lines: [
      "// Ý tưởng executor: hàng đợi các task sẵn sàng",
      "loop {",
      "    let task = ready_queue.recv();           // chỉ task đã được wake",
      "    let waker = waker_that_requeues(task.clone());",
      "    let mut cx = Context::from_waker(&waker);",
      "    match task.future.as_mut().poll(&mut cx) {",
      "        Poll::Ready(_) => drop(task),",
      "        Poll::Pending => {}                  // nằm im cho tới khi wake()",
      "    }",
      "}",
      "// Tokio = executor này + nhiều worker + reactor I/O + timer + work stealing"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ex"><div class="nl">🏃 Executor (worker thread)</div><div class="ns">lấy task từ hàng đợi, gọi poll</div></div>
    <div class="arrow" id="a1">↓ poll(cx)</div>
    <div class="node" id="fu"><div class="nl">🔁 Future / state machine</div><div class="ns">chạy tới .await kế tiếp</div></div>
    <div class="row">
      <div class="node" id="rd"><div class="nl">✅ Ready(v)</div><div class="ns">task xong</div></div>
      <div class="node" id="pd"><div class="nl">⏸️ Pending</div><div class="ns">đã đăng ký waker</div></div>
    </div>
    <div class="arrow" id="a2">↓ OS báo socket readable / timer hết hạn</div>
    <div class="node" id="re"><div class="nl">📡 Reactor / timer</div><div class="ns">gọi waker.wake()</div></div>
    <div class="arrow" id="a3">↑ task quay lại hàng đợi → poll lần nữa</div>
  `,
  steps: [
    { title: "1 · Executor gọi poll", tab: "exec", highlight: [3, 4, 5, 6], on: ["ex", "a1", "fu"],
      desc: "Chỉ task đã được wake mới nằm trong hàng đợi. Task Pending không tốn CPU." },
    { title: "2 · Future chưa xong → Pending + đăng ký waker", tab: "manual", highlight: [6, 9, 10, 11, 18], on: ["fu", "pd"],
      desc: "Clone waker ra ngoài để 'ai đó' gọi lại. Ở đây là một thread demo; Tokio dùng timer wheel và epoll/kqueue." },
    { title: "3 · Sự kiện xảy ra → wake", tab: "manual", highlight: [13, 14, 15], on: ["a2", "re", "a3"],
      desc: "<code>wake()</code> chỉ đẩy task lại hàng đợi. Không chạy future ngay tại chỗ." },
    { title: "4 · Poll lại → Ready", tab: "manual", highlight: [6, 7], on: ["ex", "rd"],
      desc: "Lần poll thứ hai thấy đã tới giờ → trả kết quả, task kết thúc." },
    { title: "5 · async fn chính là state machine", tab: "sm", highlight: [2, 3, 8, 10, 11], on: ["fu"],
      desc: "Mỗi .await là một variant; biến sống qua await (<code>user</code>) nằm trong variant → ảnh hưởng kích thước và tính Send của future." },
    { title: "6 · Các bẫy", tab: "bug", highlight: [3, 7, 10, 13], on: ["pd"],
      desc: "Quên wake = treo; wake liên tục = CPU 100%; quên await = không chạy; CPU nặng giữa hai await = chặn worker." }
  ],

  quiz: [
    { q: "poll trả Poll::Pending thì future phải đảm bảo điều gì?", options: [
        "Không cần gì thêm",
        "Waker trong Context sẽ được gọi wake() khi có tiến triển",
        "Tự sleep 1ms",
        "Trả về lỗi cho executor"
      ], correct: 1, explanation: "Không có wake thì executor không bao giờ poll lại → task treo im lặng." },
    { q: "Gọi async fn mà không .await và không spawn thì?", options: [
        "Chạy ngầm trên thread khác",
        "Không chạy gì cả vì future lười",
        "Chạy đồng bộ ngay",
        "Panic"
      ], correct: 1, explanation: "Khác CompletableFuture.supplyAsync của Java (chạy ngay)." },
    { q: "Kích thước của future sinh từ async fn phụ thuộc chủ yếu vào?", options: [
        "Số dòng code",
        "Các biến cục bộ phải sống qua các điểm .await",
        "Số thread của runtime",
        "Luôn 8 byte"
      ], correct: 1, explanation: "Mỗi variant giữ những biến còn dùng sau điểm dừng." },
    { q: "Giữ Rc<T> qua một .await trong hàm được tokio::spawn trên runtime đa luồng dẫn đến?", options: [
        "Chạy bình thường",
        "Lỗi biên dịch: future không Send",
        "Panic lúc chạy",
        "Rò bộ nhớ"
      ], correct: 1, explanation: "Rc không Send; biến sống qua await là một phần của future." },
    { q: "Ai gọi wake() khi bạn await TcpStream::read trong Tokio?", options: [
        "Chính future đó trong vòng lặp",
        "Reactor của Tokio khi OS (epoll/kqueue) báo socket sẵn sàng",
        "Garbage collector",
        "Thread main"
      ], correct: 1, explanation: "Reactor theo dõi fd và đánh thức task tương ứng." },
    { q: "Future luôn gọi cx.waker().wake_by_ref() rồi trả Pending mỗi lần poll sẽ gây ra?", options: [
        "Tối ưu hiệu năng",
        "Busy loop: task được poll liên tục, CPU cao",
        "Deadlock",
        "Không ảnh hưởng"
      ], correct: 1, explanation: "Chỉ nên làm vậy khi cố ý nhường (yield) một lần." },
    { q: "Khác biệt cơ bản giữa Rust Future và Java CompletableFuture?", options: [
        "Không khác",
        "Rust Future lười, được executor poll (pull); CompletableFuture chạy ngay và đẩy kết quả qua callback",
        "Rust Future luôn chạy trên thread riêng",
        "CompletableFuture không hỗ trợ chain"
      ], correct: 1, explanation: "Mô hình pull giúp Rust không cần cấp phát cho mỗi callback và hủy bằng cách drop." },
    { q: "Vì sao bcrypt::hash (~200ms CPU) ngay trong handler async là vấn đề?", options: [
        "bcrypt không an toàn",
        "Nó chiếm worker thread suốt 200ms, các task khác trên worker đó phải chờ",
        "Nó gây lỗi biên dịch",
        "Nó không Send"
      ], correct: 1, explanation: "Code giữa hai await chạy liền, không nhường. Dùng spawn_blocking." },
    { q: "Rust async là stackful hay stackless?", options: [
        "Stackful như goroutine",
        "Stackless: mỗi task là state machine, không có stack riêng",
        "Dùng stack của JVM",
        "Tuỳ runtime"
      ], correct: 1, explanation: "Vì vậy một task tốn vài trăm byte tới vài KB, spawn hàng trăm nghìn task được." }
  ]
});
