window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Lifetime & trait nâng cao",
  title: "Lifetime nâng cao: bound, 'static, variance & HRTB",
  subtitle: "'a: 'b · T: 'a · T: 'static ≠ &'static · variance thực dụng · for<'a> khi truyền closure nhận tham chiếu",

  theory: `
    <p>Ở khoá Nhập môn bạn đã biết lifetime là "vùng mà tham chiếu còn hợp lệ" và quy tắc elision. Ở backend thật, lỗi lifetime khó nhất thường không nằm ở hàm
    <code>longest</code> mà ở <strong>bound</strong>: <code>tokio::spawn</code> đòi <code>'static</code>, callback đòi <code>for&lt;'a&gt;</code>, struct chứa <code>&amp;mut</code> không chịu co lại.
    Bài này đi qua 4 khái niệm đủ để đọc hiểu mọi thông báo lỗi kiểu đó.</p>

    <p><strong>1. Lifetime bound — "sống ít nhất bằng"</strong></p>
    <ul>
      <li><code>'a: 'b</code> đọc là "'a outlives 'b": vùng 'a bao trùm vùng 'b. Dùng khi trả về tham chiếu ngắn hơn lấy từ tham chiếu dài hơn.</li>
      <li><code>T: 'a</code>: mọi tham chiếu <em>bên trong</em> T đều sống ít nhất 'a. <code>String</code>, <code>Vec&lt;u8&gt;</code> thoả mọi 'a vì không chứa tham chiếu.</li>
      <li><code>T: 'static</code>: T <strong>không chứa tham chiếu ngắn hạn nào</strong>. Nó KHÔNG có nghĩa "T sống mãi". Một <code>String</code> vừa tạo là <code>'static</code>-bound, vẫn bị drop bình thường.</li>
      <li><code>&amp;'static T</code> thì khác: tham chiếu tới dữ liệu sống tới hết chương trình (literal <code>"abc"</code>, <code>static</code>, <code>Box::leak</code>).</li>
    </ul>
    <p>Vì sao <code>tokio::spawn</code>, <code>std::thread::spawn</code> đòi <code>F: Future + Send + 'static</code>? Task có thể chạy lâu hơn hàm đã spawn nó, nên không được mượn biến cục bộ.
    Cách sửa quen thuộc: <code>move</code> + sở hữu dữ liệu (clone <code>Arc</code>), hoặc dùng <code>std::thread::scope</code> khi muốn mượn thật sự.</p>

    <p><strong>2. Variance — vì sao đôi khi &amp;'long dùng được chỗ cần &amp;'short, đôi khi không</strong></p>
    <table>
      <tr><th>Kiểu</th><th>Với 'a</th><th>Với T</th><th>Hệ quả thực tế</th></tr>
      <tr><td><code>&amp;'a T</code></td><td>covariant</td><td>covariant</td><td>Đưa <code>&amp;'static str</code> vào chỗ cần <code>&amp;'a str</code> thoải mái</td></tr>
      <tr><td><code>&amp;'a mut T</code></td><td>covariant</td><td><strong>invariant</strong></td><td><code>&amp;mut Vec&lt;&amp;'static str&gt;</code> KHÔNG dùng được như <code>&amp;mut Vec&lt;&amp;'a str&gt;</code></td></tr>
      <tr><td><code>Cell&lt;T&gt;</code>, <code>RefCell&lt;T&gt;</code>, <code>Mutex&lt;T&gt;</code></td><td>—</td><td>invariant</td><td>Giống &amp;mut: có thể ghi vào nên không được co T</td></tr>
      <tr><td><code>fn(T) -&gt; U</code></td><td>—</td><td>contra với T, co với U</td><td>Hiếm gặp; chỉ cần biết nó tồn tại</td></tr>
    </table>
    <p>Lý do invariant của <code>&amp;mut T</code>: nếu cho phép co <code>Vec&lt;&amp;'static str&gt;</code> thành <code>Vec&lt;&amp;'a str&gt;</code> thì hàm nhận nó có thể <em>đẩy vào</em> một <code>&amp;'a str</code> ngắn hạn;
    khi hàm trả về, người gọi vẫn tin mọi phần tử là <code>'static</code> → dangling. Java có vấn đề y hệt với mảng (<code>ArrayStoreException</code> lúc chạy) và giải bằng wildcard
    <code>? extends</code>/<code>? super</code>; Rust giải lúc biên dịch.</p>

    <p><strong>3. HRTB — higher-ranked trait bound <code>for&lt;'a&gt;</code></strong></p>
    <p>Khi một hàm nhận closure mà closure đó nhận tham chiếu tới dữ liệu <em>do chính hàm tạo ra</em>, bạn không thể đặt tên lifetime ở chữ ký hàm — lifetime đó chỉ tồn tại bên trong thân hàm.
    <code>F: for&lt;'a&gt; Fn(&amp;'a str) -&gt; &amp;'a str</code> nghĩa là "F phải chạy được với <em>mọi</em> 'a". Tin tốt: viết <code>F: Fn(&amp;str) -&gt; &amp;str</code> thì compiler tự hiểu là HRTB;
    bạn chỉ phải viết tay khi bound nằm trên trait tự định nghĩa hoặc trong <code>where</code> phức tạp (serde có <code>for&lt;'de&gt; Deserialize&lt;'de&gt;</code> = <code>DeserializeOwned</code>).</p>

    <p><strong>4. Mẹo đọc lỗi</strong></p>
    <ul>
      <li><em>"borrowed value does not live long enough ... argument requires that ... is borrowed for 'static"</em> → có bound <code>'static</code> ở đâu đó (spawn, Box&lt;dyn Trait&gt; mặc định <code>+ 'static</code>). Chuyển sang dữ liệu sở hữu.</li>
      <li><code>Box&lt;dyn Trait&gt;</code> ngầm là <code>Box&lt;dyn Trait + 'static&gt;</code>; cần mượn thì viết <code>Box&lt;dyn Trait + 'a&gt;</code>.</li>
      <li>Struct giữ <code>&amp;'a mut T</code> làm lỗi lan ra mọi nơi → thường là tín hiệu nên sở hữu dữ liệu, không phải thêm lifetime.</li>
    </ul>
    <div class="callout"><p>💡 Quy tắc thực dụng cho service: kiểu dữ liệu đi qua ranh giới task/thread/cache nên <strong>sở hữu</strong> (String, Vec, Arc). Chỉ dùng tham chiếu có lifetime trong phạm vi một hàm
    hoặc parser zero-copy ngắn hạn. Phần lớn "chiến tranh lifetime" biến mất khi làm vậy.</p></div>
  `,

  codeTabs: [
    { id: "bound", label: "① 'static bound", lines: [
      "fn spawn_log(msg: &str) {",
      "    // LỖI: `msg` borrowed ... argument requires that `msg` is borrowed for 'static",
      "    // tokio::spawn(async { println!(\"{msg}\") });",
      "",
      "    let owned: String = msg.to_owned();          // String: 'static-bound",
      "    tokio::spawn(async move { println!(\"{owned}\") });",
      "}",
      "",
      "fn need_static<T: 'static>(_t: T) {}",
      "need_static(String::from(\"hi\"));   // OK: không chứa tham chiếu",
      "need_static(\"literal\");            // OK: &'static str",
      "let s = String::from(\"x\");",
      "// need_static(&s);                 // LỖI: &s chỉ sống tới hết scope"
    ]},
    { id: "outlive", label: "② 'a: 'b", lines: [
      "struct Parser<'src> { input: &'src str, pos: usize }",
      "",
      "impl<'src> Parser<'src> {",
      "    // token trả về trỏ vào input gốc, KHÔNG trỏ vào &self",
      "    fn next_token<'p>(&'p mut self) -> &'src str where 'src: 'p {",
      "        let input: &'src str = self.input;     // copy tham chiếu ra",
      "        let start = self.pos;",
      "        self.pos = input.len();",
      "        &input[start..]",
      "    }",
      "}",
      "// Nhờ vậy có thể giữ nhiều token cùng lúc dù mỗi lần gọi mượn &mut self"
    ]},
    { id: "var", label: "③ Variance", lines: [
      "fn push_short<'a>(v: &mut Vec<&'a str>, s: &'a str) { v.push(s); }",
      "",
      "let mut names: Vec<&'static str> = vec![\"admin\"];",
      "{",
      "    let tmp = String::from(\"guest\");",
      "    // push_short(&mut names, &tmp);   // LỖI: &mut Vec<T> invariant với T",
      "}",
      "// Nếu được phép, names sẽ chứa tham chiếu tới tmp đã bị drop",
      "",
      "fn print_all(v: &[&str]) { for s in v { println!(\"{s}\") } }",
      "print_all(&names);   // OK: &T covariant, &'static str co thành &'a str"
    ]},
    { id: "hrtb", label: "④ HRTB for<'a>", lines: [
      "// Hàm tự tạo String bên trong rồi cho closure mượn",
      "fn with_trimmed<F>(raw: String, f: F) -> usize",
      "where F: for<'a> Fn(&'a str) -> &'a str {",
      "    let local = raw.trim().to_lowercase();   // chỉ sống trong hàm",
      "    f(&local).len()",
      "}",
      "",
      "// Viết gọn tương đương: where F: Fn(&str) -> &str",
      "with_trimmed(\"  Hello World \".into(), |s| s.split(' ').next().unwrap());",
      "",
      "// serde: T: DeserializeOwned  ==  T: for<'de> Deserialize<'de>"
    ]},
    { id: "java", label: "⑤ So với Java", lines: [
      "// Java: mảng covariant -> lỗi lúc CHẠY",
      "Object[] arr = new String[1];",
      "arr[0] = 42;                      // ArrayStoreException",
      "",
      "// Java generics: invariant, mở bằng wildcard",
      "void read(List<? extends Number> xs) {}   // ~ &[T] covariant (chỉ đọc)",
      "void write(List<? super Integer> xs) {}   // ~ contravariant (chỉ ghi)",
      "",
      "// Rust: &T covariant, &mut T invariant -> kiểm tra lúc BIÊN DỊCH"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="own"><div class="nl">📦 Dữ liệu sở hữu</div><div class="ns">String, Vec, Arc → T: 'static</div></div>
      <div class="node" id="brw"><div class="nl">🔗 Tham chiếu &amp;'a</div><div class="ns">chỉ sống trong scope</div></div>
    </div>
    <div class="arrow" id="a1">↓ đi qua spawn / Box&lt;dyn&gt; / cache</div>
    <div class="node" id="sp"><div class="nl">🚦 Bound 'static</div><div class="ns">chỉ dữ liệu sở hữu lọt qua</div></div>
    <div class="arrow" id="a2">↓ nhận &amp;mut Vec&lt;&amp;'a&gt;</div>
    <div class="node" id="inv"><div class="nl">🔒 Invariant</div><div class="ns">&amp;mut T không cho co T</div></div>
    <div class="arrow" id="a3">↓ closure nhận &amp;local</div>
    <div class="node" id="hr"><div class="nl">∀ for&lt;'a&gt;</div><div class="ns">closure phải đúng với mọi 'a</div></div>
  `,
  steps: [
    { title: "1 · T: 'static không phải 'sống mãi'", tab: "bound", highlight: [5, 6, 9, 10, 11], on: ["own", "a1", "sp"],
      desc: "String tạo lúc chạy vẫn thoả <code>T: 'static</code> vì không chứa tham chiếu ngắn hạn. Đó là lý do <code>to_owned()</code> + <code>async move</code> sửa được lỗi spawn." },
    { title: "2 · Tham chiếu bị chặn ở 'static", tab: "bound", highlight: [2, 3, 12, 13], on: ["brw", "sp"],
      desc: "<code>&amp;s</code> chỉ sống tới hết scope, trong khi task có thể chạy lâu hơn. Compiler chặn ngay." },
    { title: "3 · 'src: 'p tách hai lifetime", tab: "outlive", highlight: [1, 5, 6, 9], on: ["brw"],
      desc: "Token trỏ vào input gốc (sống 'src), không bị trói vào lần mượn <code>&amp;mut self</code> ngắn ('p). Nhờ vậy giữ được nhiều token cùng lúc." },
    { title: "4 · &mut T là invariant", tab: "var", highlight: [1, 3, 6, 8], on: ["a2", "inv"],
      desc: "Nếu co được <code>Vec&lt;&amp;'static str&gt;</code> thành <code>Vec&lt;&amp;'a str&gt;</code>, hàm sẽ nhét tham chiếu ngắn hạn vào. Java gặp lỗi này lúc chạy (ArrayStoreException), Rust chặn lúc biên dịch." },
    { title: "5 · &T là covariant", tab: "var", highlight: [10, 11], on: ["inv"],
      desc: "Chỉ đọc thì an toàn: <code>&amp;[&amp;'static str]</code> dùng được như <code>&amp;[&amp;'a str]</code>. Giống <code>List&lt;? extends T&gt;</code> của Java." },
    { title: "6 · HRTB cho closure", tab: "hrtb", highlight: [2, 3, 4, 5, 8], on: ["a3", "hr"],
      desc: "Lifetime của <code>local</code> không đặt tên được ở chữ ký → yêu cầu F đúng với mọi 'a. Cú pháp <code>Fn(&amp;str) -&gt; &amp;str</code> đã ngầm là HRTB." }
  ],

  quiz: [
    { q: "T: 'static nghĩa là gì?", options: [
        "Giá trị kiểu T sống tới hết chương trình",
        "T không chứa tham chiếu nào có lifetime ngắn hơn 'static (có thể là dữ liệu sở hữu hoàn toàn)",
        "T phải là biến static",
        "T phải nằm trên heap"
      ], correct: 1, explanation: "String vừa tạo thoả T: 'static nhưng vẫn bị drop bình thường. &'static T mới là tham chiếu tới dữ liệu sống mãi." },
    { q: "Vì sao tokio::spawn đòi future là 'static?", options: [
        "Để chạy nhanh hơn",
        "Task có thể sống lâu hơn hàm đã spawn nó nên không được mượn biến cục bộ",
        "Vì tokio chỉ chạy một thread",
        "Vì async fn luôn trả về &'static"
      ], correct: 1, explanation: "Runtime không biết khi nào task kết thúc; mượn biến cục bộ có thể thành dangling." },
    { q: "Cách sửa phổ biến nhất khi truyền &str vào tokio::spawn bị lỗi 'static?", options: [
        "Thêm lifetime 'a vào hàm",
        "Chuyển thành dữ liệu sở hữu (to_owned/clone Arc) rồi dùng async move",
        "Dùng unsafe transmute",
        "Dùng Box::leak mọi chỗ"
      ], correct: 1, explanation: "Box::leak rò rỉ bộ nhớ; transmute là UB tiềm tàng. Sở hữu dữ liệu là cách đúng." },
    { q: "&'a mut T có variance thế nào với T?", options: [
        "Covariant", "Contravariant", "Invariant", "Bivariant"
      ], correct: 2, explanation: "Có thể ghi qua &mut nên không được co T; nếu không sẽ nhét được dữ liệu ngắn hạn vào chỗ tưởng là dài hạn." },
    { q: "Hàm nhận &[&'a str]. Truyền &Vec<&'static str> có được không?", options: [
        "Được, vì &T covariant: &'static str co thành &'a str",
        "Không, lifetime phải khớp chính xác",
        "Chỉ được nếu dùng unsafe",
        "Chỉ được với 'static"
      ], correct: 0, explanation: "Chỉ đọc thì an toàn nên &T covariant." },
    { q: "'a: 'b đọc là gì?", options: [
        "'a ngắn hơn 'b",
        "'a sống ít nhất lâu bằng 'b (outlives)",
        "'a và 'b bằng nhau",
        "'a là kiểu con của trait 'b"
      ], correct: 1, explanation: "Vùng 'a bao trùm vùng 'b." },
    { q: "Khi nào cần viết for<'a> (HRTB)?", options: [
        "Mỗi khi hàm có tham chiếu",
        "Khi closure/trait phải làm việc với tham chiếu có lifetime chỉ tồn tại bên trong thân hàm gọi nó, và cú pháp Fn(&T) không đủ diễn đạt",
        "Khi dùng async",
        "Khi struct có nhiều trường"
      ], correct: 1, explanation: "Fn(&str) -> &str đã ngầm là HRTB; viết tay khi dùng trait tự định nghĩa hoặc bound phức tạp." },
    { q: "Box<dyn Handler> mặc định tương đương với?", options: [
        "Box<dyn Handler + 'a> với 'a suy ra",
        "Box<dyn Handler + 'static>",
        "Box<dyn Handler + Send>",
        "Box<dyn Handler + Sync>"
      ], correct: 1, explanation: "Default object lifetime của Box<dyn Trait> là 'static; muốn mượn phải viết + 'a." },
    { q: "serde bound DeserializeOwned tương đương với?", options: [
        "Deserialize<'static>",
        "for<'de> Deserialize<'de>",
        "Serialize + Clone",
        "Deserialize<'a> với 'a của hàm"
      ], correct: 1, explanation: "Kiểu không mượn gì từ input nên deserialize được từ buffer có lifetime bất kỳ." },
    { q: "Java giải vấn đề tương tự variance của List như thế nào?", options: [
        "Generics covariant mặc định",
        "Generics invariant; dùng wildcard ? extends / ? super để mở",
        "Không có vấn đề này",
        "Dùng annotation @Covariant"
      ], correct: 1, explanation: "Mảng Java covariant nên lỗi ở runtime (ArrayStoreException); generics thì invariant + wildcard." }
  ]
});
