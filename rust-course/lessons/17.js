window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Bộ nhớ & đồng thời",
  title: "Thread, Send/Sync & \"fearless concurrency\"",
  subtitle: "thread::spawn + move · join · Arc<Mutex<T>> · MutexGuard tự mở khoá · channel mpsc · thread::scope · Send vs Sync",

  theory: `
    <p><code>std::thread::spawn</code> tạo thread OS thật (1:1, như <code>new Thread()</code> Java truyền thống). Closure truyền vào phải <code>'static</code> — thread có thể sống lâu hơn hàm gọi,
    nên nó không được mượn biến cục bộ; dùng <code>move</code> để chuyển quyền sở hữu vào thread. <code>spawn</code> trả <code>JoinHandle&lt;T&gt;</code>; <code>join()</code> chờ và lấy giá trị trả về
    (<code>Err</code> nếu thread panic).</p>

    <p><strong>Hai trait đánh dấu (marker trait) — trái tim của an toàn đồng thời</strong>, compiler tự suy ra cho kiểu của bạn:</p>
    <ul>
      <li><strong><code>Send</code></strong>: giá trị kiểu này được phép <em>chuyển</em> sang thread khác. Hầu hết kiểu là Send. Ngoại lệ: <code>Rc</code> (bộ đếm không atomic).</li>
      <li><strong><code>Sync</code></strong>: <code>&amp;T</code> được phép <em>chia sẻ</em> giữa nhiều thread (T: Sync ⇔ &amp;T: Send). Ngoại lệ: <code>Cell</code>, <code>RefCell</code> (sửa không khoá).</li>
    </ul>
    <p><code>thread::spawn</code> yêu cầu closure và giá trị trả về là <code>Send</code>. Vì vậy gửi <code>Rc</code> hay chia sẻ <code>RefCell</code> sang thread khác là <strong>lỗi biên dịch</strong> — đó là
    "fearless concurrency": data race bị loại bỏ bằng hệ thống kiểu, không phải bằng kỷ luật.</p>

    <p><strong><code>Mutex&lt;T&gt;</code> chứa dữ liệu bên trong.</strong> Khác Java (<code>synchronized</code>/<code>Lock</code> tách rời dữ liệu, quên khoá vẫn biên dịch):
    muốn chạm vào T bắt buộc phải <code>lock()</code>, nhận <code>MutexGuard</code>; guard bị drop (ra khỏi scope) thì tự mở khoá — RAII. Không thể quên unlock, không thể truy cập mà không khoá.
    <code>lock()</code> trả <code>Result</code> vì mutex có thể bị "poisoned" nếu thread giữ khoá panic.</p>

    <p><strong>Channel</strong> (<code>std::sync::mpsc</code> — multi-producer single-consumer): "chia sẻ bộ nhớ bằng cách giao tiếp". <code>send(v)</code> <em>move</em> v sang bên nhận — người gửi
    không còn truy cập được, nên không thể có race trên v. Tương đương <code>BlockingQueue</code> Java.</p>

    <p><strong><code>thread::scope</code></strong> (Rust 1.63+): thread trong scope được <em>mượn</em> biến cục bộ, vì scope đảm bảo mọi thread join trước khi trả về — không cần Arc/move.</p>

    <div class="callout"><p>💡 Rust chặn <strong>data race</strong>, không chặn <strong>deadlock</strong> hay race logic (hai bước check-then-act). Giữ khoá ngắn nhất có thể, khoá theo thứ tự cố định.
    Với backend I/O-bound, thường bạn dùng async/Tokio (bài 18) thay vì thread OS trực tiếp.</p></div>
  `,

  codeTabs: [
    { id: "spawn", label: "spawn & join", lines: [
      "use std::thread;",
      "",
      "let skus = vec![\"AO-01\".to_string(), \"QUAN-02\".to_string()];",
      "",
      "let handle = thread::spawn(move || {       // move: skus chuyển vào thread",
      "    skus.len()                              // giá trị trả về",
      "});",
      "// println!(\"{:?}\", skus);                -> lỗi: skus đã move",
      "",
      "let n: usize = handle.join().unwrap();      // chờ + lấy kết quả",
      "",
      "// Không move: error[E0373]: closure may outlive the current function,",
      "// but it borrows skus"
    ]},
    { id: "mutex", label: "Arc<Mutex<T>>", lines: [
      "use std::sync::{Arc, Mutex};",
      "use std::thread;",
      "",
      "let stock = Arc::new(Mutex::new(100u32));  // dữ liệu nằm TRONG mutex",
      "let mut hs = Vec::new();",
      "for _ in 0..10 {",
      "    let stock = Arc::clone(&stock);",
      "    hs.push(thread::spawn(move || {",
      "        let mut qty = stock.lock().unwrap(); // MutexGuard<u32>",
      "        if *qty > 0 { *qty -= 1; }",
      "    }));                                     // guard drop -> tự unlock",
      "}",
      "for h in hs { h.join().unwrap(); }",
      "println!(\"còn {}\", *stock.lock().unwrap());  // 90"
    ]},
    { id: "chan", label: "Channel mpsc", lines: [
      "use std::sync::mpsc;",
      "use std::thread;",
      "",
      "let (tx, rx) = mpsc::channel::<String>();",
      "for w in 0..3 {",
      "    let tx = tx.clone();                    // nhiều producer",
      "    thread::spawn(move || {",
      "        let msg = format!(\"worker {w} xong\");",
      "        tx.send(msg).unwrap();              // msg bị MOVE sang bên nhận",
      "    });",
      "}",
      "drop(tx);                                   // đóng sender gốc",
      "for msg in rx {                             // lặp tới khi mọi sender đóng",
      "    println!(\"{msg}\");",
      "}"
    ]},
    { id: "scope", label: "thread::scope & lỗi Send", lines: [
      "let orders = vec![120, 80, 300, 45];",
      "let (a, b) = orders.split_at(2);",
      "let (s1, s2) = std::thread::scope(|s| {",
      "    let h1 = s.spawn(|| a.iter().sum::<i32>());   // MƯỢN a, không cần move/Arc",
      "    let h2 = s.spawn(|| b.iter().sum::<i32>());",
      "    (h1.join().unwrap(), h2.join().unwrap())",
      "});                                               // mọi thread join trước khi ra",
      "",
      "let rc = std::rc::Rc::new(5);",
      "// std::thread::spawn(move || println!(\"{rc}\"));",
      "// error[E0277]: Rc<i32> cannot be sent between threads safely",
      "//               the trait Send is not implemented for Rc<i32>"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                     // Rust",
      "// new Thread(() -> ...).start(); t.join();  thread::spawn(move || ...).join()",
      "// synchronized(lock) { count++; }           *count.lock().unwrap() += 1;",
      "// quên synchronized -> vẫn biên dịch        không lock thì không chạm được dữ liệu",
      "// lock.unlock() trong finally               MutexGuard drop -> tự unlock",
      "// BlockingQueue<String>                     mpsc::channel::<String>()",
      "// data race: phát hiện lúc chạy (nếu may)   data race: lỗi biên dịch (Send/Sync)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="main"><div class="nl">🧵 main thread</div><div class="ns">Arc&lt;Mutex&lt;u32&gt;&gt;</div></div>
    <div class="arrow" id="a1">↓ spawn(move) — kiểm tra Send</div>
    <div class="row">
      <div class="node" id="t1"><div class="nl">🧵 T1</div><div class="ns">Arc clone</div></div>
      <div class="node" id="t2"><div class="nl">🧵 T2</div><div class="ns">Arc clone</div></div>
      <div class="node" id="t3"><div class="nl">🧵 T3</div><div class="ns">Arc clone</div></div>
    </div>
    <div class="arrow" id="a2">↓ lock() → MutexGuard</div>
    <div class="node" id="lock"><div class="nl">🔒 Mutex</div><div class="ns">một thread một lúc; guard drop = unlock</div></div>
    <div class="arrow" id="a3">↓ Rc / RefCell?</div>
    <div class="node" id="err"><div class="nl">🛑 E0277</div><div class="ns">không Send/Sync — không biên dịch</div></div>
  `,
  steps: [
    { title: "1 · spawn cần move", tab: "spawn", highlight: [5, 6, 8, 12, 13], on: ["main", "a1"],
      desc: "Thread có thể sống lâu hơn hàm hiện tại, nên closure phải sở hữu dữ liệu ('static). move chuyển skus vào thread." },
    { title: "2 · join lấy kết quả", tab: "spawn", highlight: [10], on: ["t1"],
      desc: "join trả Result: Err nếu thread panic. Panic của một thread không giết cả process." },
    { title: "3 · Arc + Mutex", tab: "mutex", highlight: [4, 7, 9, 10, 11], on: ["t1", "t2", "t3", "a2", "lock"],
      desc: "Arc để nhiều thread cùng sở hữu; Mutex để sửa an toàn. Dữ liệu nằm trong Mutex nên không thể quên khoá." },
    { title: "4 · Channel: move thay vì chia sẻ", tab: "chan", highlight: [4, 6, 9, 12, 13], on: ["t2"],
      desc: "send move giá trị sang bên nhận. rx lặp tới khi mọi tx bị drop." },
    { title: "5 · Compiler chặn data race", tab: "scope", highlight: [4, 9, 10, 11, 12], on: ["a3", "err"],
      desc: "thread::scope cho phép mượn an toàn. Rc gửi sang thread khác → E0277 vì không Send." }
  ],

  quiz: [
    { q: "Vì sao closure của <code>thread::spawn</code> thường cần <code>move</code>?", options: [
        "Để chạy nhanh hơn",
        "Thread có thể sống lâu hơn hàm gọi, nên không được mượn biến cục bộ; phải sở hữu",
        "Vì cú pháp bắt buộc",
        "Để tránh deadlock"
      ], correct: 1, explanation: "spawn yêu cầu F: 'static." },
    { q: "Send nghĩa là gì?", options: [
        "Gửi qua mạng được",
        "Giá trị có thể được chuyển quyền sở hữu sang thread khác an toàn",
        "Có thể clone",
        "Có thể serialize"
      ], correct: 1, explanation: "Sync: &T chia sẻ được giữa thread." },
    { q: "Kiểu nào KHÔNG phải Send?", options: [
        "Arc&lt;i32&gt;", "String", "Rc&lt;i32&gt;", "Vec&lt;u8&gt;"
      ], correct: 2, explanation: "Bộ đếm của Rc không atomic." },
    { q: "Mutex của Rust khác <code>synchronized</code> Java ở điểm chính nào?", options: [
        "Chậm hơn",
        "Dữ liệu nằm trong Mutex: phải lock mới truy cập được, guard drop tự unlock",
        "Không hỗ trợ đa luồng",
        "Phải unlock thủ công"
      ], correct: 1, explanation: "Không thể quên khoá hoặc quên mở khoá." },
    { q: "<code>stock.lock()</code> trả Result vì?", options: [
        "Có thể timeout",
        "Mutex có thể bị poisoned khi thread giữ khoá bị panic",
        "Vì lock có thể thất bại do hết bộ nhớ",
        "Vì Rust bắt buộc mọi hàm trả Result"
      ], correct: 1, explanation: "Poisoning báo dữ liệu có thể ở trạng thái dở dang." },
    { q: "Sau <code>tx.send(msg)</code>, bên gửi dùng msg được không?", options: [
        "Được", "Không, msg đã bị move sang bên nhận", "Chỉ đọc", "Được nếu msg: Clone"
      ], correct: 1, explanation: "Nhờ vậy không có race trên msg." },
    { q: "<code>thread::scope</code> cho phép điều gì mà <code>thread::spawn</code> không?", options: [
        "Chạy nhanh hơn",
        "Thread mượn biến cục bộ (không cần 'static/Arc) vì scope join mọi thread trước khi trả về",
        "Chạy trên GPU",
        "Không cần join"
      ], correct: 1, explanation: "Có từ Rust 1.63." },
    { q: "Rust (safe code) có ngăn được deadlock không?", options: [
        "Có, luôn luôn", "Không — chỉ ngăn data race; deadlock vẫn có thể xảy ra", "Chỉ với Mutex", "Chỉ trong release"
      ], correct: 1, explanation: "Giữ khoá ngắn và theo thứ tự cố định." },
    { q: "<code>Arc&lt;RefCell&lt;T&gt;&gt;</code> gửi sang thread khác được không?", options: [
        "Được", "Không, vì RefCell không Sync nên Arc&lt;RefCell&lt;T&gt;&gt; không Send", "Được nếu T: Send", "Chỉ khi đọc"
      ], correct: 1, explanation: "Arc<T> là Send chỉ khi T: Send + Sync." }
  ]
});
