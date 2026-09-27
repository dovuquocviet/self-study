window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Async sâu",
  title: "Pin & Unpin — vì sao future không được di chuyển",
  subtitle: "future tự tham chiếu · Pin<&mut T> hứa 'không move nữa' · Unpin · Box::pin vs pin! · khi nào bạn thật sự phải đụng tới Pin",

  theory: `
    <p>Chữ ký <code>poll(self: Pin&lt;&amp;mut Self&gt;, ...)</code> ở bài trước có chữ <code>Pin</code>. Người mới gặp Pin thường ở thông báo lỗi
    <em>"... cannot be unpinned"</em> hoặc <em>"the trait Unpin is not implemented for ..."</em>. Bài này giải thích lý do tồn tại và các công thức sửa lỗi.</p>

    <p><strong>1. Vấn đề: future tự tham chiếu</strong></p>
    <p>Xét <code>async { let buf = [0u8; 1024]; let n = sock.read(&amp;mut buf).await; ... }</code>. Trong state machine, variant đang chờ <code>read</code> chứa cả <code>buf</code>
    lẫn future của <code>read</code>, mà future đó giữ con trỏ <code>&amp;mut buf</code> trỏ vào <em>chính struct này</em>. Nếu struct bị move sang địa chỉ khác
    (vd <code>Vec</code> chứa nó grow, hoặc bị <code>mem::swap</code>), con trỏ bên trong vẫn trỏ về địa chỉ cũ → dangling. Borrow checker bình thường không diễn đạt được "struct trỏ vào chính nó".</p>

    <p><strong>2. Giải pháp: Pin</strong></p>
    <ul>
      <li><code>Pin&lt;P&gt;</code> bọc một con trỏ (<code>&amp;mut T</code>, <code>Box&lt;T&gt;</code>) và <strong>hứa</strong>: giá trị T phía sau sẽ không bao giờ bị move nữa cho tới khi drop.</li>
      <li>Từ <code>Pin&lt;&amp;mut T&gt;</code> bạn không lấy lại được <code>&amp;mut T</code> bằng code safe (vì có <code>&amp;mut T</code> là <code>mem::swap</code> được) — trừ khi T: <code>Unpin</code>.</li>
      <li><strong>Unpin</strong> là auto trait: "move tôi cũng không sao". Gần như mọi kiểu thường (<code>i32</code>, <code>String</code>, <code>Vec</code>, <code>Box&lt;T&gt;</code>) đều Unpin. Future sinh từ <code>async</code> thì <strong>!Unpin</strong>.</li>
      <li>Với T: Unpin, <code>Pin</code> gần như vô hiệu: <code>Pin::new(&amp;mut x)</code> và <code>get_mut()</code> dùng thoải mái.</li>
    </ul>

    <p><strong>3. Hai cách ghim</strong></p>
    <table>
      <tr><th>Cách</th><th>Nơi ở</th><th>Khi dùng</th></tr>
      <tr><td><code>Box::pin(fut)</code> → <code>Pin&lt;Box&lt;F&gt;&gt;</code></td><td>Heap, 1 allocation</td><td>Cần lưu vào struct/Vec, trả về, kiểu xoá (<code>Pin&lt;Box&lt;dyn Future&gt;&gt;</code>)</td></tr>
      <tr><td><code>std::pin::pin!(fut)</code> / <code>tokio::pin!</code> → <code>Pin&lt;&amp;mut F&gt;</code></td><td>Stack (shadow biến)</td><td>Dùng tại chỗ: poll lặp lại trong <code>select!</code>, <code>loop</code></td></tr>
    </table>

    <p><strong>4. Khi nào bạn phải đụng Pin trong code service?</strong></p>
    <ol>
      <li><code>tokio::select!</code> trong vòng lặp với cùng một future (tham chiếu <code>&amp;mut fut</code>) → future phải Unpin → <code>pin!</code> nó trước vòng lặp.</li>
      <li>Trả về/lưu future hoặc stream kiểu xoá: <code>Pin&lt;Box&lt;dyn Future&lt;Output = T&gt; + Send&gt;&gt;</code> (đây là <code>BoxFuture</code> của crate futures).</li>
      <li>Tự impl <code>Future</code>/<code>Stream</code>/tower <code>Service</code> bọc future khác → dùng crate <code>pin-project</code> (hoặc <code>pin-project-lite</code>) để "chiếu" Pin xuống field an toàn, không cần unsafe.</li>
    </ol>
    <div class="callout"><p>💡 Công thức sửa lỗi Unpin: "... cannot be unpinned" → bọc bằng <code>Box::pin(...)</code> nếu cần lưu/trả về, hoặc <code>let fut = pin!(fut);</code> nếu chỉ dùng tại chỗ.
    Đừng dùng <code>Pin::new_unchecked</code> (unsafe) trừ khi bạn đang viết thư viện runtime.</p></div>
  `,

  codeTabs: [
    { id: "selfref", label: "① Tự tham chiếu", lines: [
      "async fn read_once(mut sock: TcpStream) -> usize {",
      "    let mut buf = [0u8; 1024];",
      "    let n = sock.read(&mut buf).await.unwrap();   // future read giữ &mut buf",
      "    n",
      "}",
      "",
      "// State machine (ý tưởng):",
      "// enum ReadOnce { Waiting { sock, buf: [u8; 1024], read_fut: Read<'?> } }",
      "//                                   ^^^ read_fut trỏ vào buf NGAY TRONG struct này",
      "// move struct => buf đổi địa chỉ, read_fut vẫn trỏ địa chỉ cũ => dangling",
      "// => sau lần poll đầu tiên, future KHÔNG được move nữa => cần Pin"
    ]},
    { id: "select", label: "② pin! + select!", lines: [
      "let sleep = tokio::time::sleep(Duration::from_secs(30));",
      "tokio::pin!(sleep);                       // hoặc: let mut sleep = std::pin::pin!(sleep);",
      "",
      "loop {",
      "    tokio::select! {",
      "        msg = rx.recv() => match msg {",
      "            Some(m) => handle(m).await,",
      "            None => break,",
      "        },",
      "        _ = &mut sleep => {               // poll cùng một future qua nhiều vòng",
      "            tracing::info!(\"idle 30s, exiting\");",
      "            break;",
      "        }",
      "    }",
      "}",
      "// Không pin: lỗi `Sleep` cannot be unpinned (Sleep là !Unpin)"
    ]},
    { id: "box", label: "③ Box::pin & BoxFuture", lines: [
      "use futures::future::BoxFuture;   // = Pin<Box<dyn Future<Output = T> + Send + 'a>>",
      "",
      "type Job = Box<dyn Fn(u64) -> BoxFuture<'static, anyhow::Result<()>> + Send + Sync>;",
      "",
      "let jobs: Vec<Job> = vec![",
      "    Box::new(|id| Box::pin(async move { sync_orders(id).await })),",
      "    Box::new(|id| Box::pin(async move { sync_stock(id).await })),",
      "];",
      "",
      "// Đệ quy async cũng cần box vì kích thước vô hạn:",
      "fn walk(dir: PathBuf) -> BoxFuture<'static, u64> {",
      "    Box::pin(async move { /* ... walk(sub).await ... */ 0 })",
      "}"
    ]},
    { id: "project", label: "④ pin-project", lines: [
      "#[pin_project::pin_project]",
      "pub struct Timed<F> {",
      "    #[pin] inner: F,          // future bên trong: cần Pin",
      "    started: Instant,         // field thường: &mut bình thường",
      "}",
      "",
      "impl<F: Future> Future for Timed<F> {",
      "    type Output = (F::Output, Duration);",
      "    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {",
      "        let this = self.project();                // Pin<&mut F> + &mut Instant",
      "        match this.inner.poll(cx) {",
      "            Poll::Ready(v) => Poll::Ready((v, this.started.elapsed())),",
      "            Poll::Pending => Poll::Pending,",
      "        }",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="fut"><div class="nl">🧱 Future async (!Unpin)</div><div class="ns">có con trỏ vào chính nó sau lần poll đầu</div></div>
    <div class="arrow" id="a1">↓ bị move?</div>
    <div class="node" id="bad"><div class="nl">💥 Dangling</div><div class="ns">con trỏ nội bộ trỏ địa chỉ cũ</div></div>
    <div class="arrow" id="a2">↓ giải pháp: ghim lại</div>
    <div class="row">
      <div class="node" id="bp"><div class="nl">📦 Box::pin</div><div class="ns">heap · lưu/trả về được</div></div>
      <div class="node" id="sp"><div class="nl">📌 pin!</div><div class="ns">stack · dùng tại chỗ</div></div>
    </div>
    <div class="arrow" id="a3">↓ kiểu Unpin (String, Vec, i32...)</div>
    <div class="node" id="un"><div class="nl">🆓 Unpin</div><div class="ns">Pin vô hại, get_mut() thoải mái</div></div>
  `,
  steps: [
    { title: "1 · Future tự tham chiếu", tab: "selfref", highlight: [2, 3, 8, 9], on: ["fut"],
      desc: "<code>buf</code> và future của <code>read</code> cùng nằm trong một variant; future kia giữ <code>&amp;mut buf</code> → struct trỏ vào chính nó." },
    { title: "2 · Move = dangling", tab: "selfref", highlight: [10, 11], on: ["a1", "bad"],
      desc: "Sau lần poll đầu, move future đi chỗ khác làm con trỏ nội bộ sai. Pin tồn tại để cấm điều đó ở mức kiểu." },
    { title: "3 · pin! cho vòng lặp select!", tab: "select", highlight: [1, 2, 10, 16], on: ["a2", "sp"],
      desc: "Muốn poll cùng một future qua nhiều vòng (<code>&amp;mut sleep</code>) thì nó phải được ghim. Ghim trên stack là đủ." },
    { title: "4 · Box::pin khi cần lưu hoặc xoá kiểu", tab: "box", highlight: [1, 3, 6, 11, 12], on: ["bp"],
      desc: "Vec các job async khác nhau, hoặc async đệ quy → <code>Pin&lt;Box&lt;dyn Future + Send&gt;&gt;</code>." },
    { title: "5 · pin-project khi tự viết wrapper", tab: "project", highlight: [1, 3, 4, 10, 11], on: ["bp", "sp"],
      desc: "Chiếu Pin xuống field <code>#[pin]</code>, các field khác lấy <code>&amp;mut</code> thường — không cần unsafe. Đây là cách tower/tokio viết middleware." },
    { title: "6 · Unpin làm Pin vô hại", tab: "project", highlight: [4], on: ["a3", "un"],
      desc: "Instant, String, Vec đều Unpin → move thoải mái. Pin chỉ 'cắn' với kiểu !Unpin như future async." }
  ],

  quiz: [
    { q: "Vì sao future sinh từ async block cần Pin?", options: [
        "Để chạy nhanh hơn",
        "Nó có thể chứa con trỏ vào chính nó (biến cục bộ bị mượn qua .await); move sẽ làm con trỏ đó dangling",
        "Để tránh GC",
        "Vì nó luôn nằm trên heap"
      ], correct: 1, explanation: "Self-referential struct là lý do tồn tại của Pin." },
    { q: "Pin<&mut T> đảm bảo điều gì?", options: [
        "T không bao giờ bị drop",
        "T sẽ không bị move ra khỏi vị trí hiện tại cho tới khi drop (trừ khi T: Unpin)",
        "T là Send",
        "T chỉ được đọc"
      ], correct: 1, explanation: "Pin là lời hứa ở mức kiểu về địa chỉ ổn định." },
    { q: "Kiểu nào sau đây là !Unpin?", options: [
        "String", "Vec<u8>", "Future sinh từ async fn", "Box<i32>"
      ], correct: 2, explanation: "Hầu hết kiểu thường tự động Unpin; future async thì không." },
    { q: "Dùng tokio::select! trong loop với cùng một Sleep bị lỗi 'cannot be unpinned'. Sửa?", options: [
        "Tạo Sleep mới mỗi vòng (đổi ngữ nghĩa, reset timer)",
        "tokio::pin!(sleep) hoặc std::pin::pin! trước vòng lặp rồi dùng &mut sleep",
        "Thêm unsafe",
        "Đổi sang thread::sleep"
      ], correct: 1, explanation: "Ghim trên stack là đủ vì chỉ dùng tại chỗ." },
    { q: "Khi nào cần Box::pin thay vì pin!?", options: [
        "Khi future phải lưu vào struct/Vec, trả về khỏi hàm, hoặc xoá kiểu thành dyn Future",
        "Luôn luôn",
        "Không bao giờ",
        "Chỉ khi dùng std thread"
      ], correct: 0, explanation: "pin! ghim trên stack của hàm hiện tại nên không sống lâu hơn hàm." },
    { q: "futures::future::BoxFuture<'a, T> là gì?", options: [
        "Box<T>",
        "Pin<Box<dyn Future<Output = T> + Send + 'a>>",
        "Một runtime",
        "Arc<Mutex<Future>>"
      ], correct: 1, explanation: "Alias tiện dụng cho future kiểu xoá, Send." },
    { q: "async fn đệ quy trực tiếp gặp lỗi gì nếu không box?", options: [
        "Deadlock",
        "Kiểu future có kích thước vô hạn (recursion in an async fn requires boxing)",
        "Stack overflow lúc chạy",
        "Không lỗi"
      ], correct: 1, explanation: "Future chứa chính nó → cần Box::pin để có kích thước cố định." },
    { q: "pin-project giúp gì?", options: [
        "Tăng tốc poll",
        "Lấy Pin<&mut Field> cho field #[pin] và &mut cho field khác một cách an toàn, không unsafe",
        "Tự sinh executor",
        "Chuyển future sang thread"
      ], correct: 1, explanation: "Pin projection thủ công cần unsafe và rất dễ sai." },
    { q: "Với T: Unpin, Pin<&mut T> hành xử thế nào?", options: [
        "Không dùng được",
        "Như &mut T bình thường: Pin::new và get_mut dùng thoải mái",
        "Bắt buộc Box",
        "Chỉ đọc"
      ], correct: 1, explanation: "Unpin nghĩa là move không gây hại nên Pin không hạn chế gì." }
  ]
});
