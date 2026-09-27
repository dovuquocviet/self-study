window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "Bản đồ Swift cho người viết Java: biên dịch, let/var, kiểu",
  subtitle: "AOT qua LLVM, không JVM, không GC · let/var · suy luận kiểu · Int tràn là crash",

  theory: `
    <p>Với dev Java, cú sốc đầu tiên không nằm ở cú pháp mà ở <strong>mô hình chạy</strong>. Java: <code>javac</code> → bytecode → JVM (JIT, GC). Swift: <code>swiftc</code> → SIL (Swift Intermediate Language, nơi kiểm tra ownership/tối ưu) → LLVM IR → <strong>mã máy</strong> cho đúng CPU (arm64). Không có máy ảo, không JIT, không garbage collector.</p>

    <table>
      <tr><th>Khía cạnh</th><th>Java / Spring</th><th>Swift</th></tr>
      <tr><td>Chạy trên</td><td>JVM, bytecode</td><td>Binary native (AOT)</td></tr>
      <tr><td>Quản lý bộ nhớ</td><td>GC tracing (G1, ZGC…)</td><td><strong>ARC</strong>: đếm tham chiếu, compiler chèn retain/release (bài 09)</td></tr>
      <tr><td>null</td><td>Mọi reference đều có thể null</td><td>Chỉ kiểu <code>T?</code> mới được nil (bài 02)</td></tr>
      <tr><td>Kiểu dữ liệu chính</td><td>class ở khắp nơi</td><td><strong>struct</strong> (giá trị) là mặc định; class khi cần danh tính (bài 03)</td></tr>
      <tr><td>Build tool</td><td>Maven/Gradle</td><td>Xcode project + Swift Package Manager (bài 12)</td></tr>
      <tr><td>Tràn số nguyên</td><td>Âm thầm quay vòng</td><td><strong>Crash (trap)</strong>; muốn quay vòng thì dùng <code>&amp;+</code>, <code>&amp;*</code></td></tr>
    </table>

    <p><strong>let vs var</strong></p>
    <ul>
      <li><code>let</code> = hằng (giống <code>final</code> của Java), <code>var</code> = biến. Quy ước: viết <code>let</code> trước, compiler cảnh báo nếu một <code>var</code> không bao giờ bị đổi.</li>
      <li>Khác biệt quan trọng: với <strong>struct</strong>, <code>let</code> khoá cả nội dung (không đổi được field nào). Với class, <code>let</code> chỉ khoá tham chiếu — giống <code>final</code> Java. Bài 03 giải thích vì sao.</li>
    </ul>

    <p><strong>Kiểu và suy luận kiểu</strong>: <code>let n = 42</code> là <code>Int</code> (64-bit trên iOS), <code>let x = 3.14</code> là <code>Double</code>. Swift <strong>không tự ép kiểu ngầm</strong>: <code>Int + Double</code> là lỗi biên dịch, phải viết <code>Double(n) + x</code>. Không có primitive vs wrapper (<code>int</code>/<code>Integer</code>) — <code>Int</code> là struct, vừa nhanh vừa có method.</p>

    <p><strong>Hàm có nhãn tham số</strong>: <code>func transfer(from a: Account, to b: Account, amount: Decimal)</code>, gọi <code>transfer(from: x, to: y, amount: 10)</code>. Nhãn ngoài (from) khác tên trong (a); <code>_</code> để bỏ nhãn. Nhãn là một phần tên hàm — đọc code Swift như đọc câu tiếng Anh.</p>

    <p><strong>String</strong> là struct giá trị, đếm theo <em>grapheme</em> (ký tự người nhìn thấy): <code>"Việt".count == 4</code> dù dữ liệu UTF-8 dài hơn. Vì thế không có <code>s[2]</code> bằng số nguyên — phải dùng <code>String.Index</code>. Nội suy chuỗi: <code>"Xin chào &#92;(name)"</code>.</p>

    <div class="callout"><p>💡 Tư duy chuyển đổi: trong Java bạn "tạo class rồi new". Trong Swift, hỏi trước: dữ liệu này có cần <em>danh tính</em> (hai chỗ cùng thấy một đối tượng thay đổi) không? Không → <code>struct</code> + <code>let</code>. Đó là nền của mọi thứ phía sau, kể cả SwiftUI.</p></div>
  `,

  codeTabs: [
    { id: "java", label: "Java", lines: [
      "public final class Order {",
      "    private final String id;",
      "    private int quantity;",
      "    public Order(String id, int quantity) { this.id = id; this.quantity = quantity; }",
      "    public int getQuantity() { return quantity; }",
      "}",
      "",
      "final Order o = new Order(\"A1\", 2);",
      "int max = Integer.MAX_VALUE;",
      "int wrapped = max + 1;   // -2147483648, không báo gì"
    ]},
    { id: "swift", label: "Swift", lines: [
      "struct Order {",
      "    let id: String",
      "    var quantity: Int",
      "}   // init(id:quantity:) được compiler sinh sẵn (memberwise init)",
      "",
      "let o = Order(id: \"A1\", quantity: 2)",
      "// o.quantity = 3   ❌ lỗi biên dịch: o là let, struct là giá trị",
      "",
      "let max = Int.max",
      "// let boom = max + 1   → crash lúc chạy: Arithmetic overflow",
      "let wrapped = max &+ 1  // muốn quay vòng thì nói rõ"
    ]},
    { id: "types", label: "Kiểu & hàm", lines: [
      "let n = 42              // Int",
      "let price = 19.9        // Double",
      "// let total = n * price       ❌ không ép kiểu ngầm",
      "let total = Double(n) * price",
      "",
      "func greet(_ name: String, times count: Int = 1) -> String {",
      "    String(repeating: \"Chào \\(name)! \", count: count)",
      "}",
      "greet(\"Việt\", times: 2)   // body 1 biểu thức thì return ngầm"
    ]},
    { id: "build", label: "Biên dịch", lines: [
      "# Java",
      "$ javac Order.java   # → Order.class (bytecode)",
      "$ java Order         # JVM nạp, JIT dần, GC dọn",
      "",
      "# Swift",
      "$ swiftc -O main.swift -o app   # → SIL → LLVM IR → arm64",
      "$ ./app                         # chạy thẳng, không VM",
      "$ swift repl                    # REPL để thử nhanh"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="jsrc"><div class="nl">☕ .java</div><div class="ns">javac</div></div>
      <div class="node" id="ssrc"><div class="nl">🕊️ .swift</div><div class="ns">swiftc</div></div>
    </div>
    <div class="row">
      <div class="node" id="jbc"><div class="nl">Bytecode</div><div class="ns">JVM + JIT + GC</div></div>
      <div class="node" id="sil"><div class="nl">SIL → LLVM IR</div><div class="ns">tối ưu, kiểm tra ownership</div></div>
    </div>
    <div class="arrow" id="a1">↓ kết quả</div>
    <div class="node" id="bin"><div class="nl">Binary arm64 + ARC</div><div class="ns">không VM, bộ nhớ giải phóng tất định</div></div>
  `,
  steps: [
    { title: "1 · Java: class + new + final", tab: "java", highlight: [1, 2, 3, 8], on: ["jsrc", "jbc"],
      desc: "Quen thuộc: class, field final, constructor viết tay, <code>final</code> chỉ khoá tham chiếu." },
    { title: "2 · Swift: struct + let", tab: "swift", highlight: [1, 2, 3, 4, 6, 7], on: ["ssrc"],
      desc: "Struct có sẵn memberwise init. <code>let o</code> khoá toàn bộ giá trị — không sửa được <code>quantity</code>." },
    { title: "3 · Tràn số: Java quay vòng, Swift crash", tab: "swift", highlight: [9, 10, 11], on: ["ssrc"],
      desc: "Swift chọn an toàn: tràn là lỗi logic nên dừng chương trình. Cần quay vòng (băm, checksum) thì dùng <code>&amp;+</code>." },
    { title: "4 · Không ép kiểu ngầm, hàm có nhãn", tab: "types", highlight: [3, 4, 6, 9], on: ["ssrc"],
      desc: "Int × Double phải chuyển rõ ràng. Nhãn <code>times:</code> là một phần chữ ký hàm, <code>_</code> bỏ nhãn cho tham số đầu." },
    { title: "5 · Từ nguồn tới binary", tab: "build", highlight: [2, 3, 6, 7], on: ["sil", "a1", "bin"],
      desc: "swiftc hạ code qua SIL rồi LLVM để ra mã máy. Không có JVM khởi động, không GC pause — đổi lại bạn phải hiểu ARC." }
  ],

  quiz: [
    { q: "Swift trên iOS được chạy dưới dạng gì?", options: [
        "Bytecode chạy trên máy ảo giống JVM",
        "Mã máy native biên dịch trước (AOT) qua LLVM",
        "Được thông dịch từng dòng",
        "JavaScript chạy trên JSC"
      ], correct: 1, explanation: "swiftc → SIL → LLVM IR → mã máy arm64. Không có VM." },
    { q: "Swift quản lý bộ nhớ đối tượng class bằng gì?", options: [
        "Garbage collector tracing", "ARC — đếm tham chiếu do compiler chèn", "malloc/free thủ công", "Không cần quản lý"
      ], correct: 1, explanation: "Automatic Reference Counting; không có GC chạy nền." },
    { q: "let o = Order(id: \"A1\", quantity: 2) với Order là struct. o.quantity = 3 thì sao?", options: [
        "Chạy bình thường", "Lỗi biên dịch vì o là let và struct là kiểu giá trị", "Crash lúc chạy", "Chỉ cảnh báo"
      ], correct: 1, explanation: "let trên struct khoá toàn bộ giá trị, khác với final của Java chỉ khoá tham chiếu." },
    { q: "Int.max + 1 trong Swift (không dùng &+) cho kết quả gì?", options: [
        "Int.min", "0", "Chương trình trap (crash) vì tràn số", "Tự chuyển sang Int128"
      ], correct: 2, explanation: "Swift kiểm tra tràn mặc định. Toán tử &+ mới quay vòng." },
    { q: "let n = 3; let x = 1.5; n * x?", options: [
        "4.5", "4", "Lỗi biên dịch — Swift không ép kiểu Int sang Double ngầm", "Crash"
      ], correct: 2, explanation: "Phải viết Double(n) * x." },
    { q: "Hàm func greet(_ name: String, times count: Int) được gọi thế nào?", options: [
        "greet(name: \"A\", count: 2)", "greet(\"A\", times: 2)", "greet(\"A\", 2)", "greet(_: \"A\", times: 2)"
      ], correct: 1, explanation: "_ bỏ nhãn ngoài; times là nhãn ngoài, count là tên dùng bên trong hàm." },
    { q: "\"Việt\".count trả về?", options: [
        "4 — đếm theo grapheme", "5 — số byte UTF-8", "6", "Lỗi vì có dấu"
      ], correct: 0, explanation: "String Swift đếm ký tự người đọc thấy (grapheme cluster)." },
    { q: "Tương đương int vs Integer của Java trong Swift là gì?", options: [
        "Int và NSNumber, phải boxing",
        "Không có phân biệt: Int là struct, vừa nhanh vừa có method",
        "int và Int",
        "Int và Int?"
      ], correct: 1, explanation: "Swift không có primitive/wrapper tách đôi." },
    { q: "Struct Order { let id: String; var quantity: Int } không khai báo init. Tạo thế nào?", options: [
        "Không tạo được, phải viết init",
        "Order(id: \"A1\", quantity: 2) — memberwise init do compiler sinh",
        "new Order(\"A1\", 2)",
        "Order.init()"
      ], correct: 1, explanation: "Struct được sinh memberwise initializer tự động (class thì không)." }
  ]
});
