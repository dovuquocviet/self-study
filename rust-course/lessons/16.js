window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Bộ nhớ & đồng thời",
  title: "Smart pointer: Box, Rc, RefCell, Arc — khi một owner là không đủ",
  subtitle: "Box = heap một chủ · Rc = nhiều chủ (1 thread) · RefCell = kiểm tra borrow lúc chạy · Arc = Rc cho đa luồng · Weak",

  theory: `
    <p>Ownership "một chủ" phủ được 90% tình huống. Phần còn lại cần <strong>smart pointer</strong> — struct giữ con trỏ và implement <code>Deref</code> (dùng như tham chiếu) + <code>Drop</code> (tự dọn).
    <code>String</code> và <code>Vec</code> thực ra cũng là smart pointer.</p>

    <table>
      <tr><th>Kiểu</th><th>Làm gì</th><th>Khi nào dùng</th><th>Chi phí</th></tr>
      <tr><td><code>Box&lt;T&gt;</code></td><td>Đặt T lên heap, một owner</td><td>Kiểu đệ quy (cây, danh sách liên kết), <code>Box&lt;dyn Trait&gt;</code>, dữ liệu rất lớn không muốn copy trên stack</td><td>Một lần cấp phát</td></tr>
      <tr><td><code>Rc&lt;T&gt;</code></td><td>Nhiều owner, đếm tham chiếu; drop khi đếm về 0</td><td>Đồ thị, cache chia sẻ — <strong>chỉ trong một thread</strong></td><td>Tăng/giảm bộ đếm thường</td></tr>
      <tr><td><code>Arc&lt;T&gt;</code></td><td>Như Rc nhưng bộ đếm <strong>atomic</strong></td><td>Chia sẻ dữ liệu giữa thread / task (config, pool, state của axum)</td><td>Atomic, đắt hơn Rc chút</td></tr>
      <tr><td><code>RefCell&lt;T&gt;</code></td><td>Cho phép sửa qua &amp;T; kiểm tra luật borrow <strong>lúc chạy</strong></td><td>Kết hợp <code>Rc&lt;RefCell&lt;T&gt;&gt;</code> khi nhiều chủ cần sửa (1 thread)</td><td>Vi phạm → <strong>panic</strong> (BorrowMutError)</td></tr>
      <tr><td><code>Mutex&lt;T&gt;</code> / <code>RwLock&lt;T&gt;</code></td><td>Như RefCell nhưng khoá thật, an toàn đa luồng</td><td><code>Arc&lt;Mutex&lt;T&gt;&gt;</code> (bài 17)</td><td>Khoá</td></tr>
    </table>

    <p><strong>Rc/Arc chỉ cho đọc chung.</strong> <code>Rc&lt;T&gt;</code> cho ra <code>&amp;T</code> — không có <code>&amp;mut</code>, vì nhiều owner mà ai cũng sửa được thì phá luật aliasing.
    Muốn sửa phải thêm lớp <em>interior mutability</em>: <code>RefCell</code> (1 thread) hoặc <code>Mutex</code>/<code>RwLock</code>/atomic (đa luồng). Đây là cách Rust "cho phép" mutable dùng chung
    — nhưng bắt bạn nói rõ và trả giá kiểm tra.</p>

    <p><strong><code>Rc::clone(&amp;a)</code></strong> chỉ tăng bộ đếm, không copy dữ liệu (viết <code>Rc::clone(&amp;a)</code> thay vì <code>a.clone()</code> để người đọc hiểu là rẻ).
    <strong>Rò rỉ</strong>: hai Rc trỏ vòng vào nhau thì bộ đếm không bao giờ về 0 → leak (GC Java xử lý được vòng, Rc thì không). Dùng <code>Weak&lt;T&gt;</code> cho chiều ngược (con → cha).</p>

    <p>So với Java: mọi tham chiếu Java giống một <code>Arc&lt;Mutex-tuỳ-bạn&lt;T&gt;&gt;</code> mà GC đếm hộ và không ai bắt bạn khoá. Rust tách từng khả năng ra thành kiểu riêng —
    bạn chỉ trả tiền cho khả năng mình dùng.</p>

    <div class="callout"><p>💡 Thấy mình viết <code>Rc&lt;RefCell&lt;...&gt;&gt;</code> khắp nơi thường là dấu hiệu đang mang thiết kế đồ thị object kiểu Java vào Rust.
    Cân nhắc: lưu dữ liệu trong <code>Vec</code> và tham chiếu bằng index/id, hoặc truyền <code>&amp;mut</code> theo luồng gọi hàm.</p></div>
  `,

  codeTabs: [
    { id: "box", label: "Box", lines: [
      "// Kiểu đệ quy cần kích thước biết trước -> Box",
      "enum Category {",
      "    Leaf(String),",
      "    Node(String, Vec<Category>),       // Vec đã ở heap: ok",
      "}",
      "enum Expr {",
      "    Num(i64),",
      "    Add(Box<Expr>, Box<Expr>),         // không Box -> 'recursive type has infinite size'",
      "}",
      "let e = Expr::Add(Box::new(Expr::Num(1)), Box::new(Expr::Num(2)));",
      "",
      "let handler: Box<dyn Fn(u64) -> u64> = Box::new(|x| x * 2);  // trait object"
    ]},
    { id: "rc", label: "Rc & Weak", lines: [
      "use std::rc::{Rc, Weak};",
      "",
      "let cfg = Rc::new(Config { currency: \"VND\".into() });",
      "let a = Rc::clone(&cfg);                 // chỉ tăng đếm, không copy",
      "let b = Rc::clone(&cfg);",
      "println!(\"{}\", Rc::strong_count(&cfg));  // 3",
      "drop(a);",
      "println!(\"{}\", Rc::strong_count(&cfg));  // 2",
      "// a.currency = ...;                     -> lỗi: Rc chỉ cho &T",
      "",
      "let weak: Weak<Config> = Rc::downgrade(&cfg);  // không giữ sống",
      "if let Some(c) = weak.upgrade() { println!(\"{}\", c.currency); }"
    ]},
    { id: "refcell", label: "RefCell", lines: [
      "use std::cell::RefCell;",
      "use std::rc::Rc;",
      "",
      "let cart = Rc::new(RefCell::new(Vec::<String>::new()));",
      "let ui = Rc::clone(&cart);",
      "",
      "cart.borrow_mut().push(\"ao\".into());    // mượn mut lúc chạy",
      "println!(\"{}\", ui.borrow().len());      // 1",
      "",
      "let r = cart.borrow();                   // đang mượn đọc...",
      "let w = cart.borrow_mut();               // PANIC: already borrowed",
      "// Luật & / &mut vẫn còn, chỉ là kiểm tra lúc CHẠY thay vì biên dịch"
    ]},
    { id: "arc", label: "Arc (đa luồng)", lines: [
      "use std::sync::Arc;",
      "use std::thread;",
      "",
      "let cfg = Arc::new(Config { currency: \"VND\".into() });",
      "let mut handles = vec![];",
      "for i in 0..4 {",
      "    let cfg = Arc::clone(&cfg);          // mỗi thread một 'chủ'",
      "    handles.push(thread::spawn(move || {",
      "        println!(\"worker {i} dùng {}\", cfg.currency);",
      "    }));",
      "}",
      "for h in handles { h.join().unwrap(); }",
      "// Rc ở đây -> lỗi biên dịch: Rc<Config> cannot be sent between threads safely"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java: một loại tham chiếu làm mọi việc   // Rust: tách khả năng",
      "// Node left, right;  (đệ quy)              Box<Node>",
      "// shared = config;   (nhiều chủ)           Rc<Config>  /  Arc<Config> (đa luồng)",
      "// shared.list.add(x) (sửa khi chia sẻ)     Rc<RefCell<Vec<_>>>  /  Arc<Mutex<Vec<_>>>",
      "// WeakReference<Parent>                    Weak<Parent>",
      "// GC gom được vòng tham chiếu              Rc vòng -> leak; dùng Weak"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="box"><div class="nl">📦 Box&lt;T&gt;</div><div class="ns">heap, 1 chủ</div></div>
      <div class="node" id="rc"><div class="nl">👥 Rc&lt;T&gt;</div><div class="ns">nhiều chủ, 1 thread</div></div>
      <div class="node" id="arc"><div class="nl">🌐 Arc&lt;T&gt;</div><div class="ns">nhiều chủ, đa luồng</div></div>
    </div>
    <div class="arrow" id="a1">↓ cần sửa khi chia sẻ?</div>
    <div class="row">
      <div class="node" id="rcell"><div class="nl">🧪 RefCell&lt;T&gt;</div><div class="ns">borrow check lúc chạy</div></div>
      <div class="node" id="mtx"><div class="nl">🔒 Mutex&lt;T&gt;</div><div class="ns">khoá thật (bài 17)</div></div>
    </div>
    <div class="arrow" id="a2">↓ vòng tham chiếu</div>
    <div class="node" id="weak"><div class="nl">🪶 Weak&lt;T&gt;</div><div class="ns">không giữ sống, cắt vòng</div></div>
  `,
  steps: [
    { title: "1 · Box: heap + kiểu đệ quy", tab: "box", highlight: [6, 7, 8, 10, 12], on: ["box"],
      desc: "Expr chứa Expr trực tiếp thì kích thước vô hạn. Box có kích thước cố định (một con trỏ) nên phá được vòng." },
    { title: "2 · Rc: nhiều chủ", tab: "rc", highlight: [3, 4, 6, 7, 8, 9], on: ["rc"],
      desc: "Rc::clone tăng đếm; drop giảm đếm; về 0 thì giải phóng. Chỉ cho đọc (&amp;T)." },
    { title: "3 · RefCell: sửa khi chia sẻ", tab: "refcell", highlight: [4, 7, 8, 10, 11, 12], on: ["a1", "rcell"],
      desc: "borrow()/borrow_mut() kiểm tra luật lúc chạy. Vi phạm là panic — đổi lỗi biên dịch lấy lỗi runtime, nên dùng dè dặt." },
    { title: "4 · Arc cho đa luồng", tab: "arc", highlight: [4, 7, 8, 13], on: ["arc", "mtx"],
      desc: "Bộ đếm atomic nên an toàn giữa thread. Dùng Rc thay Arc ở đây thì compiler từ chối (Rc không phải Send)." },
    { title: "5 · Weak cắt vòng", tab: "rc", highlight: [11, 12], on: ["a2", "weak"],
      desc: "Rc không gom được vòng như GC. Weak không tăng strong_count; upgrade() trả Option vì đối tượng có thể đã bị drop." }
  ],

  quiz: [
    { q: "Vì sao <code>enum Expr { Num(i64), Add(Expr, Expr) }</code> không biên dịch?", options: [
        "Enum không chứa enum",
        "Kiểu đệ quy có kích thước vô hạn; cần Box&lt;Expr&gt;",
        "Thiếu derive",
        "i64 không hợp lệ"
      ], correct: 1, explanation: "Box có kích thước cố định bằng một con trỏ." },
    { q: "<code>Rc::clone(&a)</code> làm gì?", options: [
        "Deep copy dữ liệu", "Tăng bộ đếm tham chiếu, trả thêm một con trỏ tới cùng dữ liệu", "Tạo Weak", "Move a"
      ], correct: 1, explanation: "Rẻ, O(1)." },
    { q: "Có sửa được dữ liệu trong <code>Rc&lt;Vec&lt;T&gt;&gt;</code> trực tiếp không?", options: [
        "Có", "Không — Rc chỉ cho &T; cần RefCell bên trong", "Có nếu let mut", "Chỉ khi strong_count = 1 và dùng unsafe"
      ], correct: 1, explanation: "(Rc::get_mut có tồn tại khi chỉ có một chủ, nhưng mẫu chung là RefCell.)" },
    { q: "RefCell vi phạm luật borrow (đang borrow() mà gọi borrow_mut()) thì?", options: [
        "Lỗi biên dịch", "Panic lúc chạy", "Chờ tới khi được", "Trả None"
      ], correct: 1, explanation: "try_borrow_mut() trả Result nếu muốn tránh panic." },
    { q: "Khác biệt chính giữa Rc và Arc?", options: [
        "Arc nhanh hơn",
        "Arc dùng bộ đếm atomic nên an toàn giữa thread; Rc chỉ dùng trong một thread",
        "Rc cho sửa dữ liệu",
        "Không khác"
      ], correct: 1, explanation: "Rc không Send/Sync; compiler chặn gửi Rc sang thread khác." },
    { q: "Hai Rc trỏ vòng vào nhau thì?", options: [
        "GC dọn", "Rò rỉ bộ nhớ — bộ đếm không về 0", "Panic", "Lỗi biên dịch"
      ], correct: 1, explanation: "Dùng Weak cho một chiều." },
    { q: "Tương đương an toàn đa luồng của <code>Rc&lt;RefCell&lt;T&gt;&gt;</code>?", options: [
        "Box&lt;RefCell&lt;T&gt;&gt;", "Arc&lt;Mutex&lt;T&gt;&gt; (hoặc Arc&lt;RwLock&lt;T&gt;&gt;)", "Rc&lt;Mutex&lt;T&gt;&gt;", "Arc&lt;RefCell&lt;T&gt;&gt;"
      ], correct: 1, explanation: "RefCell không Sync nên Arc<RefCell> không chia sẻ được giữa thread." },
    { q: "<code>weak.upgrade()</code> trả về gì?", options: [
        "Rc&lt;T&gt;", "Option&lt;Rc&lt;T&gt;&gt; — None nếu dữ liệu đã bị drop", "T", "bool"
      ], correct: 1, explanation: "Weak không giữ dữ liệu sống." },
    { q: "Dấu hiệu thiết kế cần xem lại khi viết Rust?", options: [
        "Dùng Vec",
        "Rc&lt;RefCell&lt;...&gt;&gt; ở khắp nơi — thường là mang đồ thị object kiểu Java sang",
        "Dùng enum",
        "Dùng &str trong tham số"
      ], correct: 1, explanation: "Thay bằng index/id vào Vec, hoặc truyền &mut theo luồng gọi." }
  ]
});
