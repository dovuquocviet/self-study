window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "struct vs class: value semantics và copy-on-write",
  subtitle: "Gán là sao chép · mutating · === so danh tính · Array/String copy-on-write",

  theory: `
    <p>Trong Java, <code>Order b = a;</code> chỉ sao chép <em>tham chiếu</em>: hai biến cùng trỏ một object, sửa qua <code>b</code> thì <code>a</code> thấy. Swift có hai loại kiểu:</p>
    <table>
      <tr><th></th><th><strong>struct / enum</strong> (value type)</th><th><strong>class</strong> (reference type)</th></tr>
      <tr><td>Gán / truyền tham số</td><td>Sao chép giá trị — mỗi biến một bản độc lập</td><td>Sao chép tham chiếu — chung một object</td></tr>
      <tr><td>Lưu ở đâu</td><td>Thường inline (stack, hoặc nằm trong object chứa nó)</td><td>Heap, có refcount (ARC)</td></tr>
      <tr><td>Kế thừa</td><td>Không (dùng protocol)</td><td>Có, đơn kế thừa</td></tr>
      <tr><td>let</td><td>Khoá toàn bộ nội dung</td><td>Chỉ khoá tham chiếu, vẫn sửa được var bên trong</td></tr>
      <tr><td>So sánh danh tính</td><td>Không có khái niệm</td><td><code>===</code> (cùng object?)</td></tr>
      <tr><td>deinit</td><td>Không</td><td>Có</td></tr>
    </table>

    <p><strong>Vì sao Swift thích struct?</strong> Không ai "sửa lén" dữ liệu của bạn: truyền một <code>Cart</code> vào hàm, hàm sửa bản sao của nó, bản của bạn nguyên vẹn. Không có aliasing thì không có cả một lớp bug (và cũng an toàn khi chuyển giữa các luồng — bài 11). Thư viện chuẩn gần như toàn struct: <code>Int</code>, <code>String</code>, <code>Array</code>, <code>Dictionary</code>, <code>Set</code>.</p>

    <p><strong>mutating</strong>: method của struct mặc định không được sửa <code>self</code>. Muốn sửa phải đánh dấu <code>mutating func</code>, và chỉ gọi được trên biến <code>var</code>. Về cơ chế, <code>self</code> được truyền dạng <code>inout</code> — tức là "lấy ra, sửa, ghi lại".</p>

    <p><strong>Sao chép mảng 1 triệu phần tử có chậm không?</strong> Không, nhờ <strong>copy-on-write (CoW)</strong>: <code>Array</code> bên trong giữ một buffer trên heap. Gán <code>b = a</code> chỉ tăng refcount của buffer. Chỉ khi một bên <em>ghi</em> mà buffer đang bị chia sẻ, nó mới sao chép thật. Lưu ý: CoW là do <code>Array</code>/<code>String</code>/<code>Dictionary</code> tự cài (dùng <code>isKnownUniquelyReferenced</code>), struct bạn tự viết thì sao chép từng field — với field là Array thì vẫn hưởng CoW của field đó.</p>

    <p><strong>Khi nào dùng class?</strong></p>
    <ul>
      <li>Cần <strong>danh tính</strong> chung: một <code>SessionManager</code>, một kết nối, một cache mà nhiều nơi cùng thấy thay đổi.</li>
      <li>Cần <code>deinit</code> để dọn tài nguyên, hoặc kế thừa từ class UIKit/Objective-C.</li>
      <li>ViewModel <code>@Observable</code> trong SwiftUI (bài 15) là class — vì view cần cùng quan sát một object.</li>
    </ul>
    <p>Đánh dấu <code>final class</code> khi không định cho kế thừa: compiler gọi method trực tiếp (static dispatch) thay vì qua vtable.</p>

    <div class="callout"><p>💡 So với Java: struct Swift giống <code>record</code> + sao chép khi gán, nhưng <em>có thể</em> có var và mutating. Quy tắc Apple khuyến nghị: mặc định struct; chỉ dùng class khi thật sự cần danh tính hoặc tương tác Objective-C.</p></div>
  `,

  codeTabs: [
    { id: "value", label: "struct: sao chép", lines: [
      "struct Cart {",
      "    var items: [String] = []",
      "    mutating func add(_ sku: String) { items.append(sku) }",
      "}",
      "",
      "var a = Cart()",
      "a.add(\"SKU-1\")",
      "var b = a            // sao chép giá trị",
      "b.add(\"SKU-2\")",
      "print(a.items)       // [\"SKU-1\"]",
      "print(b.items)       // [\"SKU-1\", \"SKU-2\"]"
    ]},
    { id: "ref", label: "class: chung object", lines: [
      "final class Session {",
      "    var token: String?",
      "}",
      "",
      "let s1 = Session()   // let chỉ khoá tham chiếu",
      "let s2 = s1",
      "s2.token = \"abc\"     // sửa được: token là var bên trong object",
      "print(s1.token)      // Optional(\"abc\") — cùng một object",
      "print(s1 === s2)     // true: cùng danh tính"
    ]},
    { id: "cow", label: "Copy-on-write", lines: [
      "var big = Array(repeating: 0, count: 1_000_000)",
      "var copy = big       // O(1): chung buffer, refcount = 2",
      "copy[0] = 42         // ghi → buffer bị chia sẻ → sao chép thật lúc này",
      "",
      "func total(_ xs: [Int]) -> Int { xs.reduce(0, +) }",
      "total(big)           // truyền mảng: không sao chép vì không ghi",
      "",
      "// Tự cài CoW cho kiểu của mình: dùng isKnownUniquelyReferenced(&storage)"
    ]},
    { id: "java", label: "So với Java", lines: [
      "// Java: mọi object là reference",
      "List<String> a = new ArrayList<>(List.of(\"SKU-1\"));",
      "List<String> b = a;",
      "b.add(\"SKU-2\");",
      "System.out.println(a);  // [SKU-1, SKU-2]  ← a bị sửa theo",
      "",
      "// Muốn an toàn phải tự copy phòng thủ:",
      "List<String> safe = new ArrayList<>(a);   // O(n) luôn luôn"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="va"><div class="nl">var a: Cart</div><div class="ns">items → buffer #1</div></div>
      <div class="node" id="vb"><div class="nl">var b = a</div><div class="ns">bản sao độc lập</div></div>
    </div>
    <div class="arrow" id="a1">↕ class: hai biến, một object</div>
    <div class="row">
      <div class="node" id="r1"><div class="nl">let s1</div><div class="ns">tham chiếu</div></div>
      <div class="node" id="obj"><div class="nl">Session (heap)</div><div class="ns">refcount = 2</div></div>
      <div class="node" id="r2"><div class="nl">let s2</div><div class="ns">tham chiếu</div></div>
    </div>
    <div class="node" id="buf"><div class="nl">Array buffer (heap)</div><div class="ns">chia sẻ tới khi có người ghi</div></div>
  `,
  steps: [
    { title: "1 · struct: gán là sao chép", tab: "value", highlight: [6, 7, 8, 9, 10, 11], on: ["va", "vb"],
      desc: "Sửa <code>b</code> không ảnh hưởng <code>a</code>. Không có aliasing." },
    { title: "2 · mutating", tab: "value", highlight: [3], on: ["va"],
      desc: "Method sửa self phải là <code>mutating</code>; gọi trên <code>let a</code> sẽ lỗi biên dịch." },
    { title: "3 · class: chung một object", tab: "ref", highlight: [5, 6, 7, 8, 9], on: ["a1", "r1", "obj", "r2"],
      desc: "<code>let</code> không ngăn sửa var bên trong object. <code>===</code> so danh tính." },
    { title: "4 · Copy-on-write", tab: "cow", highlight: [1, 2, 3, 6], on: ["buf"],
      desc: "Gán mảng chỉ tăng refcount buffer; ghi lần đầu khi buffer bị chia sẻ mới sao chép O(n)." },
    { title: "5 · Java phải copy phòng thủ", tab: "java", highlight: [3, 4, 5, 8], on: ["a1"],
      desc: "Trong Java, muốn tránh bị sửa lén phải <code>new ArrayList&lt;&gt;(a)</code> — tốn O(n) kể cả khi không ai sửa. Swift đưa việc này vào ngữ nghĩa ngôn ngữ." }
  ],

  quiz: [
    { q: "var b = a với a là struct Cart, rồi b.add(...). a thay đổi không?", options: [
        "Có, như Java", "Không — b là bản sao độc lập", "Tuỳ Cart có final không", "Lỗi biên dịch"
      ], correct: 1, explanation: "Struct là value type: gán là sao chép." },
    { q: "let s = Session() với Session là class. s.token = \"x\" (token là var)?", options: [
        "Lỗi biên dịch vì s là let", "Được — let chỉ khoá tham chiếu", "Crash", "Chỉ được trong init"
      ], correct: 1, explanation: "Với class, let giống final của Java." },
    { q: "Method trong struct muốn sửa thuộc tính của chính nó phải khai báo thế nào?", options: [
        "override func", "mutating func", "static func", "inout func"
      ], correct: 1, explanation: "mutating cho phép sửa self; chỉ gọi được trên var." },
    { q: "Toán tử === dùng cho gì?", options: [
        "So sánh giá trị của struct", "So hai tham chiếu class có cùng trỏ một object không", "So kiểu", "So chuỗi"
      ], correct: 1, explanation: "=== là identity; == là equality (Equatable)." },
    { q: "var copy = big (mảng 1 triệu phần tử). Chi phí dòng này?", options: [
        "O(n) sao chép ngay", "O(1) — chia sẻ buffer, chỉ sao chép khi có người ghi", "Không cho phép", "O(log n)"
      ], correct: 1, explanation: "Copy-on-write của Array." },
    { q: "Struct tự viết có tự động được copy-on-write cho toàn struct không?", options: [
        "Có, mọi struct đều CoW",
        "Không — struct sao chép từng field; các field kiểu Array/String/Dictionary thì tự có CoW của chúng",
        "Có nếu đánh dấu final",
        "Chỉ khi dùng class bên trong"
      ], correct: 1, explanation: "CoW cho kiểu tự viết phải tự cài bằng buffer class + isKnownUniquelyReferenced." },
    { q: "Trường hợp nào nên dùng class thay vì struct?", options: [
        "DTO trả về từ API",
        "Đối tượng cần danh tính chung như SessionManager hoặc ViewModel mà nhiều view cùng quan sát",
        "Toạ độ Point(x, y)",
        "Cấu hình đọc từ file"
      ], correct: 1, explanation: "Cần chia sẻ trạng thái/danh tính hoặc deinit → class." },
    { q: "Lợi ích của final class?", options: [
        "Cho phép kế thừa nhiều lớp",
        "Không cho kế thừa, compiler có thể gọi method trực tiếp thay vì qua vtable",
        "Biến class thành value type",
        "Tắt ARC"
      ], correct: 1, explanation: "final cho phép devirtualization." },
    { q: "Các kiểu Int, String, Array, Dictionary trong Swift là?", options: [
        "class", "struct (value type)", "protocol", "Objective-C object"
      ], correct: 1, explanation: "Thư viện chuẩn chủ yếu là value type." }
  ]
});
