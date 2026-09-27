window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Ownership — trái tim của Rust",
  title: "Stack, heap & ownership: move, Copy, Clone, Drop",
  subtitle: "3 quy tắc ownership · String nằm ở đâu · move khi gán/truyền hàm · Copy vs Clone · RAII",

  theory: `
    <p><strong>Stack và heap</strong> (Java cũng có, nhưng JVM giấu đi): stack chứa biến cục bộ có kích thước biết trước, cấp/thu hồi tự động khi vào/ra hàm — cực nhanh.
    Heap chứa dữ liệu kích thước thay đổi (chuỗi, danh sách), phải có ai đó giải phóng. Java: mọi object ở heap, GC giải phóng. Rust: <strong>chủ sở hữu</strong> giải phóng.</p>

    <p><strong>3 quy tắc ownership</strong></p>
    <ol>
      <li>Mỗi giá trị có đúng <strong>một</strong> biến chủ sở hữu (owner).</li>
      <li>Tại một thời điểm chỉ có một owner.</li>
      <li>Owner ra khỏi scope → giá trị bị <strong>drop</strong> (giải phóng) ngay lập tức.</li>
    </ol>

    <p><code>let s = String::from("hello");</code> tạo ra: trên stack một bộ 3 <em>(con trỏ, len = 5, capacity = 5)</em>; trên heap 5 byte "hello".
    Khi <code>let t = s;</code> Rust chỉ copy bộ 3 trên stack (rẻ) và <strong>vô hiệu hoá <code>s</code></strong>. Nếu không, khi cả s và t ra khỏi scope sẽ
    free cùng vùng nhớ hai lần (double free). Đó là <strong>move</strong>. Truyền vào hàm hay return từ hàm cũng là move.</p>

    <table>
      <tr><th>Hành vi</th><th>Kiểu</th><th>Gán <code>let b = a;</code></th></tr>
      <tr><td><strong>Copy</strong></td><td>Kiểu nằm gọn trên stack: số, bool, char, &amp;T, tuple/array của các kiểu Copy</td><td>Copy từng bit; <code>a</code> vẫn dùng được</td></tr>
      <tr><td><strong>Move</strong></td><td>Kiểu sở hữu tài nguyên: String, Vec, Box, struct chứa chúng…</td><td>Chuyển quyền; <code>a</code> không dùng được nữa</td></tr>
      <tr><td><strong>Clone</strong></td><td>Kiểu implement Clone</td><td>Phải gọi <code>a.clone()</code> tường minh — deep copy, tốn chi phí, nhìn thấy trong code</td></tr>
    </table>

    <p><strong>Drop = RAII.</strong> Khi owner ra khỏi scope, Rust gọi <code>Drop::drop</code>: giải phóng heap, đóng file, trả connection về pool, mở khoá mutex.
    Giống <code>try-with-resources</code> của Java nhưng <em>áp dụng cho mọi giá trị</em>, không cần cú pháp đặc biệt, và thời điểm là xác định (không chờ GC/finalizer).
    Thứ tự drop: ngược với thứ tự khai báo.</p>

    <div class="callout"><p>💡 <code>.clone()</code> không phải tội lỗi, nhưng rải khắp nơi để "cho compiler im" là dấu hiệu chưa hiểu ownership.
    Câu hỏi đúng: hàm này cần <em>sở hữu</em> dữ liệu (lưu lại, gửi sang thread khác) hay chỉ cần <em>nhìn</em>? Nếu chỉ nhìn → cho mượn (bài 05).</p></div>
  `,

  codeTabs: [
    { id: "move", label: "Move", lines: [
      "fn main() {",
      "    let s = String::from(\"hello\");   // s sở hữu 5 byte trên heap",
      "    let t = s;                         // move: copy (ptr,len,cap), s bị vô hiệu",
      "    // println!(\"{s}\");               // lỗi E0382: borrow of moved value: s",
      "    println!(\"{t}\");",
      "",
      "    let n = 42;                        // i32 là Copy",
      "    let m = n;                         // copy bit",
      "    println!(\"{n} {m}\");               // cả hai vẫn dùng được",
      "}                                      // t ra khỏi scope -> drop -> free heap"
    ]},
    { id: "fn", label: "Move qua hàm", lines: [
      "fn consume(name: String) {            // tham số nhận quyền sở hữu",
      "    println!(\"hi {name}\");",
      "}                                      // name bị drop ở đây",
      "",
      "fn make() -> String {",
      "    String::from(\"new\")               // trả về = move quyền ra ngoài",
      "}",
      "",
      "fn main() {",
      "    let user = String::from(\"An\");",
      "    consume(user);                     // user bị move vào hàm",
      "    // consume(user);                  // lỗi: use of moved value",
      "    let fresh = make();                // fresh là owner mới",
      "    consume(fresh.clone());            // clone tường minh: gửi bản sao",
      "    println!(\"{fresh}\");              // vẫn dùng được",
      "}"
    ]},
    { id: "drop", label: "Drop / RAII", lines: [
      "struct DbConn { id: u32 }",
      "",
      "impl Drop for DbConn {",
      "    fn drop(&mut self) {",
      "        println!(\"trả conn {} về pool\", self.id);",
      "    }",
      "}",
      "",
      "fn main() {",
      "    let a = DbConn { id: 1 };",
      "    {",
      "        let b = DbConn { id: 2 };",
      "        println!(\"dùng b\");",
      "    }                                  // in: trả conn 2 về pool",
      "    println!(\"dùng a\");",
      "}                                      // in: trả conn 1 về pool"
    ]},
    { id: "mem", label: "Bộ nhớ String", lines: [
      "# let s = String::from(\"hello\");",
      "#",
      "#   STACK (s)                 HEAP",
      "#   +---------+------+        +---+---+---+---+---+",
      "#   | ptr     | ---------->   | h | e | l | l | o |",
      "#   | len = 5 |      |        +---+---+---+---+---+",
      "#   | cap = 5 |      |",
      "#   +---------+------+",
      "#",
      "# let t = s;  -> t nhận ptr/len/cap; s bị đánh dấu 'đã move'",
      "# Chỉ MỘT owner => chỉ MỘT lần free khi t ra khỏi scope"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                   // Rust",
      "// String t = s;   // 2 tham chiếu        let t = s;          // move, s hết dùng",
      "// list2 = new ArrayList<>(list1);        let v2 = v1.clone(); // copy tường minh",
      "// try (var c = pool.get()) { ... }       { let c = pool.get(); ... } // drop tự động",
      "// finalize() / Cleaner (không xác định)   impl Drop (chạy đúng lúc ra scope)",
      "// int, long: giá trị                      i32, i64: Copy",
      "// mọi object: tham chiếu                 String, Vec: move mặc định"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="stk"><div class="nl">📚 Stack: s</div><div class="ns">ptr · len 5 · cap 5</div></div>
      <div class="node" id="heap"><div class="nl">🧱 Heap</div><div class="ns">h e l l o</div></div>
    </div>
    <div class="arrow" id="a1">↓ let t = s (move)</div>
    <div class="row">
      <div class="node" id="dead"><div class="nl">🚫 s</div><div class="ns">đã move, cấm dùng</div></div>
      <div class="node" id="t"><div class="nl">✅ t</div><div class="ns">owner duy nhất</div></div>
    </div>
    <div class="arrow" id="a2">↓ t ra khỏi scope</div>
    <div class="node" id="free"><div class="nl">🗑️ drop(t)</div><div class="ns">free heap đúng một lần</div></div>
  `,
  steps: [
    { title: "1 · Tạo String", tab: "mem", highlight: [1, 3, 4, 5, 6, 7], on: ["stk", "heap"],
      desc: "Biến s trên stack giữ con trỏ tới heap, cùng len và capacity. s là owner của vùng heap." },
    { title: "2 · Move khi gán", tab: "move", highlight: [3, 4], on: ["a1", "dead", "t"],
      desc: "Chỉ bộ ba trên stack được copy. s bị vô hiệu để tránh hai owner cùng free một vùng nhớ." },
    { title: "3 · Copy cho kiểu đơn giản", tab: "move", highlight: [7, 8, 9], on: ["stk"],
      desc: "i32 không sở hữu heap nên copy bit là đủ — không có move, cả n và m đều dùng được." },
    { title: "4 · Move qua tham số hàm", tab: "fn", highlight: [1, 3, 11, 12, 14], on: ["t"],
      desc: "Truyền String vào hàm nhận String = chuyển quyền. Muốn giữ lại thì clone (tốn) hoặc cho mượn (bài sau)." },
    { title: "5 · Drop đúng lúc", tab: "drop", highlight: [3, 4, 5, 14, 16], on: ["a2", "free"],
      desc: "Ra khỏi block, b bị drop trước; cuối main, a bị drop. RAII cho mọi tài nguyên, không cần try-with-resources." }
  ],

  quiz: [
    { q: "Sau <code>let t = s;</code> với s là String, điều gì xảy ra với dữ liệu heap?", options: [
        "Được copy sang vùng heap mới",
        "Không bị copy; t nhận con trỏ, s bị vô hiệu",
        "Bị giải phóng",
        "Cả s và t cùng sở hữu"
      ], correct: 1, explanation: "Move chỉ copy phần trên stack (ptr, len, cap)." },
    { q: "Vì sao Rust vô hiệu hoá s sau khi move?", options: [
        "Để tiết kiệm stack",
        "Tránh double free: hai owner cùng giải phóng một vùng nhớ",
        "Vì String bất biến",
        "Do quy ước đặt tên"
      ], correct: 1, explanation: "Mỗi giá trị chỉ một owner → chỉ một lần drop." },
    { q: "Kiểu nào sau đây là Copy?", options: [
        "String", "Vec&lt;i32&gt;", "(i32, bool)", "Box&lt;i32&gt;"
      ], correct: 2, explanation: "Tuple của các kiểu Copy là Copy. String/Vec/Box sở hữu heap nên move." },
    { q: "<code>fn consume(s: String)</code> — sau <code>consume(name)</code>, dùng lại name được không?", options: [
        "Được", "Không, name đã bị move vào hàm", "Được nếu hàm không sửa name", "Chỉ đọc được"
      ], correct: 1, explanation: "Tham số kiểu String nhận quyền sở hữu; name bị drop khi hàm kết thúc." },
    { q: "Khi nào <code>Drop::drop</code> của một biến cục bộ được gọi?", options: [
        "Khi GC chạy",
        "Khi owner ra khỏi scope, tại thời điểm xác định",
        "Khi chương trình kết thúc",
        "Chỉ khi gọi drop() thủ công"
      ], correct: 1, explanation: "Có thể gọi std::mem::drop(x) để drop sớm, nhưng mặc định là cuối scope." },
    { q: "Hai biến a, b khai báo theo thứ tự a rồi b trong cùng scope. Thứ tự drop?", options: [
        "a rồi b", "b rồi a", "Ngẫu nhiên", "Cùng lúc"
      ], correct: 1, explanation: "Drop ngược thứ tự khai báo — b có thể tham chiếu a nên phải chết trước." },
    { q: "<code>.clone()</code> khác move ở điểm nào?", options: [
        "Không khác",
        "Clone tạo bản sao độc lập (thường deep copy, tốn chi phí); bản gốc vẫn dùng được",
        "Clone nhanh hơn move",
        "Clone chuyển quyền sở hữu"
      ], correct: 1, explanation: "Rust bắt clone phải viết tường minh để chi phí hiện rõ trong code." },
    { q: "RAII trong Rust tương đương gì của Java nhưng tổng quát hơn?", options: [
        "synchronized", "try-with-resources / AutoCloseable", "static block", "volatile"
      ], correct: 1, explanation: "Mọi giá trị đều tự dọn khi ra scope, không cần cú pháp try đặc biệt." },
    { q: "Một hàm chỉ cần đọc độ dài của String. Nên nhận tham số kiểu gì?", options: [
        "String (move vào)", "Cho mượn: &str hoặc &String", "Clone rồi truyền", "Box&lt;String&gt;"
      ], correct: 1, explanation: "Chỉ đọc thì mượn; nhận String buộc người gọi mất quyền hoặc phải clone." }
  ]
});
