window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Ownership — trái tim của Rust",
  title: "Slice & lifetime cơ bản: &str, &[T], 'a, 'static",
  subtitle: "fat pointer · String vs &str trong API · lifetime là gì · quy tắc elision · struct giữ tham chiếu",

  theory: `
    <p><strong>Slice</strong> là tham chiếu tới một <em>đoạn liên tiếp</em> dữ liệu mà người khác sở hữu: <code>&amp;[T]</code> (đoạn của Vec/array), <code>&amp;str</code> (đoạn UTF-8 của String hoặc literal).
    Về bộ nhớ, slice là <strong>fat pointer</strong> = (con trỏ, độ dài) — 16 byte trên máy 64-bit. Không copy dữ liệu.</p>

    <table>
      <tr><th>Sở hữu (heap)</th><th>Mượn (slice)</th><th>Dùng trong tham số hàm khi…</th></tr>
      <tr><td><code>String</code></td><td><code>&amp;str</code></td><td>Chỉ đọc chuỗi → nhận <code>&amp;str</code> (nhận được cả String qua <code>&amp;s</code> nhờ deref coercion, cả literal)</td></tr>
      <tr><td><code>Vec&lt;T&gt;</code></td><td><code>&amp;[T]</code></td><td>Chỉ đọc danh sách → nhận <code>&amp;[T]</code> (nhận được Vec, array, một đoạn)</td></tr>
    </table>
    <p>String literal <code>"abc"</code> có kiểu <code>&amp;'static str</code>: dữ liệu nằm sẵn trong binary, sống suốt chương trình. Cắt chuỗi <code>&amp;s[0..3]</code> tính theo <strong>byte</strong>;
    cắt giữa một ký tự UTF-8 nhiều byte (vd "ệ") sẽ <em>panic</em> — dùng <code>chars()</code> khi xử lý ký tự.</p>

    <p><strong>Lifetime</strong> = khoảng code mà một tham chiếu còn hợp lệ. Compiler luôn tính lifetime; phần lớn thời gian bạn không phải viết.
    Chỉ khi hàm <em>trả về tham chiếu</em> và compiler không đoán được nó mượn từ tham số nào, bạn phải chú thích:</p>
    <p><code>fn longest&lt;'a&gt;(x: &amp;'a str, y: &amp;'a str) -&gt; &amp;'a str</code> — đọc là: "kết quả sống không lâu hơn cả x lẫn y". Chú thích lifetime
    <strong>không kéo dài</strong> đời sống của gì cả; nó chỉ <em>mô tả quan hệ</em> để compiler kiểm tra phía người gọi.</p>

    <p><strong>Quy tắc elision</strong> (compiler tự điền lifetime):</p>
    <ol>
      <li>Mỗi tham số tham chiếu nhận một lifetime riêng.</li>
      <li>Nếu chỉ có đúng một lifetime đầu vào → gán cho mọi tham chiếu đầu ra. (<code>fn first_word(s: &amp;str) -&gt; &amp;str</code> không cần chú thích.)</li>
      <li>Nếu là method có <code>&amp;self</code>/<code>&amp;mut self</code> → đầu ra lấy lifetime của self.</li>
    </ol>

    <p><strong>Struct giữ tham chiếu</strong> phải khai báo lifetime: <code>struct Parser&lt;'a&gt; { input: &amp;'a str }</code> — Parser không được sống lâu hơn chuỗi input.
    Với người mới: <strong>struct nên sở hữu dữ liệu</strong> (<code>String</code>, <code>Vec</code>); chỉ dùng tham chiếu trong struct khi có lý do hiệu năng rõ ràng.</p>

    <div class="callout"><p>💡 Java không có dangling reference vì GC giữ object sống chừng nào còn tham chiếu. Rust không có GC, nên thay vào đó
    <strong>chứng minh lúc biên dịch</strong> rằng tham chiếu không bao giờ sống lâu hơn dữ liệu. Lifetime chính là "bằng chứng" đó.</p></div>
  `,

  codeTabs: [
    { id: "slice", label: "Slice", lines: [
      "fn sum(nums: &[i64]) -> i64 {          // nhận Vec, array, hoặc một đoạn",
      "    nums.iter().sum()",
      "}",
      "",
      "fn greet(name: &str) {                 // nhận String (qua &) và literal",
      "    println!(\"Xin chào {name}\");",
      "}",
      "",
      "let v = vec![10, 20, 30, 40];",
      "sum(&v);            // &Vec<i64> tự coerce thành &[i64]",
      "sum(&v[1..3]);      // đoạn [20, 30]",
      "let s = String::from(\"Bình\");",
      "greet(&s);          // &String -> &str (deref coercion)",
      "greet(\"An\");        // &'static str"
    ]},
    { id: "life", label: "Lifetime 'a", lines: [
      "// Không chú thích: compiler không biết kết quả mượn từ x hay y",
      "// fn longest(x: &str, y: &str) -> &str   -> error[E0106]: missing lifetime",
      "",
      "fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {",
      "    if x.len() >= y.len() { x } else { y }",
      "}",
      "",
      "fn main() {",
      "    let a = String::from(\"dài hơn\");",
      "    let result;",
      "    {",
      "        let b = String::from(\"ngắn\");",
      "        result = longest(&a, &b);",
      "    }   // b bị drop ở đây",
      "    // println!(\"{result}\");   -> lỗi E0597: b does not live long enough",
      "}"
    ]},
    { id: "elide", label: "Elision", lines: [
      "// Quy tắc 2: một input -> output cùng lifetime, không cần viết",
      "fn first_word(s: &str) -> &str {",
      "    s.split(' ').next().unwrap_or(\"\")",
      "}",
      "",
      "struct Order { code: String }",
      "impl Order {",
      "    // Quy tắc 3: output mượn từ self",
      "    fn code(&self) -> &str { &self.code }",
      "}",
      "",
      "// 'static: sống suốt chương trình",
      "const APP: &'static str = \"order-svc\";"
    ]},
    { id: "struct", label: "Struct mượn", lines: [
      "struct Parser<'a> {",
      "    input: &'a str,          // Parser không sống lâu hơn input",
      "    pos: usize,",
      "}",
      "",
      "impl<'a> Parser<'a> {",
      "    fn new(input: &'a str) -> Self { Parser { input, pos: 0 } }",
      "    fn rest(&self) -> &'a str { &self.input[self.pos..] }",
      "}",
      "",
      "// Thường thì đơn giản hơn: sở hữu luôn",
      "struct OwnedParser { input: String, pos: usize }"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                  // Rust",
      "// String sub = s.substring(0, 3);      let sub: &str = &s[0..3];  // không copy",
      "// List<Long> part = list.subList(1,3); let part: &[i64] = &v[1..3];",
      "// void greet(String name)              fn greet(name: &str)",
      "// (GC giữ object sống)                 (lifetime chứng minh lúc biên dịch)",
      "// substring cắt theo char UTF-16       &s[a..b] cắt theo BYTE UTF-8"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="own"><div class="nl">🧱 String / Vec</div><div class="ns">owner, dữ liệu trên heap</div></div>
      <div class="node" id="sl"><div class="nl">🔍 &amp;str / &amp;[T]</div><div class="ns">(ptr, len) nhìn một đoạn</div></div>
    </div>
    <div class="arrow" id="a1">↓ hàm trả về tham chiếu</div>
    <div class="node" id="lt"><div class="nl">⏳ Lifetime 'a</div><div class="ns">kết quả sống ≤ input</div></div>
    <div class="arrow" id="a2">↓ người gọi vi phạm?</div>
    <div class="row">
      <div class="node" id="bad"><div class="nl">🛑 E0597</div><div class="ns">does not live long enough</div></div>
      <div class="node" id="el"><div class="nl">✍️ Elision</div><div class="ns">đa số trường hợp không cần viết</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Slice là fat pointer", tab: "slice", highlight: [1, 9, 10, 11], on: ["own", "sl"],
      desc: "&amp;v[1..3] là (con trỏ tới phần tử 1, len 2). Không cấp phát, không copy." },
    { title: "2 · Tham số: ưu tiên &str, &[T]", tab: "slice", highlight: [5, 12, 13, 14], on: ["sl"],
      desc: "Nhận &amp;str thì gọi được với cả String và literal. Nhận &amp;String là hạn chế không cần thiết (clippy sẽ nhắc)." },
    { title: "3 · Khi nào phải viết 'a", tab: "life", highlight: [2, 4, 5], on: ["a1", "lt"],
      desc: "Hai input tham chiếu, một output tham chiếu → compiler cần bạn nói output liên quan tới input nào." },
    { title: "4 · Compiler kiểm tra phía gọi", tab: "life", highlight: [12, 13, 14, 15], on: ["a2", "bad"],
      desc: "result có thể trỏ vào b, mà b chết ở dòng 14 → dùng result sau đó bị chặn. Không bao giờ có dangling reference." },
    { title: "5 · Elision & struct mượn", tab: "elide", highlight: [2, 9, 13], on: ["el"],
      desc: "Một input hoặc &amp;self → không cần viết. Struct chứa tham chiếu phải khai báo 'a; người mới nên cho struct sở hữu dữ liệu." }
  ],

  quiz: [
    { q: "&str về mặt bộ nhớ gồm những gì?", options: [
        "Chỉ con trỏ", "Con trỏ + độ dài (fat pointer)", "Bản sao chuỗi", "Con trỏ + capacity + độ dài"
      ], correct: 1, explanation: "String mới có thêm capacity vì nó sở hữu và có thể lớn lên." },
    { q: "Hàm chỉ đọc chuỗi nên nhận tham số kiểu gì để linh hoạt nhất?", options: [
        "String", "&String", "&str", "Box&lt;str&gt;"
      ], correct: 2, explanation: "&str nhận cả literal và &String (deref coercion)." },
    { q: "Kiểu của literal <code>\"order-svc\"</code>?", options: [
        "String", "&'static str", "char[]", "&mut str"
      ], correct: 1, explanation: "Nằm trong binary, hợp lệ suốt chương trình." },
    { q: "<code>&\"tiếng\"[0..2]</code> — điều gì xảy ra?", options: [
        "Trả \"ti\"", "Panic vì 2 không nằm trên ranh giới ký tự UTF-8", "Lỗi biên dịch", "Trả \"tiế\""
      ], correct: 0, explanation: "\"t\" và \"i\" đều 1 byte nên [0..2] = \"ti\" hợp lệ. Còn [0..3] sẽ cắt giữa \"ế\" (3 byte) → panic." },
    { q: "Chú thích lifetime <code>'a</code> có tác dụng gì?", options: [
        "Kéo dài đời sống của biến",
        "Mô tả quan hệ giữa các tham chiếu để compiler kiểm tra, không đổi đời sống thật",
        "Cấp phát bộ nhớ tĩnh",
        "Bật GC cho biến"
      ], correct: 1, explanation: "Lifetime là ràng buộc, không phải lệnh." },
    { q: "Vì sao <code>fn first_word(s: &str) -> &str</code> không cần viết lifetime?", options: [
        "Vì &str luôn là 'static",
        "Elision: chỉ một input tham chiếu nên output lấy lifetime của nó",
        "Vì hàm không trả tham chiếu",
        "Rust bỏ qua lifetime của str"
      ], correct: 1, explanation: "Quy tắc elision số 2." },
    { q: "Lỗi E0597 \"does not live long enough\" nghĩa là gì?", options: [
        "Hết bộ nhớ",
        "Một tham chiếu còn được dùng sau khi giá trị nó trỏ tới đã bị drop",
        "Thread kết thúc sớm",
        "Biến chưa khởi tạo"
      ], correct: 1, explanation: "Sửa bằng cách cho dữ liệu sống lâu hơn, hoặc trả về giá trị sở hữu (String)." },
    { q: "Với người mới, struct nên giữ dữ liệu chuỗi thế nào?", options: [
        "Luôn dùng &'a str",
        "Sở hữu bằng String; chỉ dùng tham chiếu khi có lý do hiệu năng rõ ràng",
        "Dùng *const u8",
        "Dùng static mut"
      ], correct: 1, explanation: "Struct sở hữu dữ liệu tránh phải lan truyền lifetime khắp nơi." },
    { q: "<code>&v[1..3]</code> với v = vec![10,20,30,40] cho kết quả?", options: [
        "[10, 20, 30]", "[20, 30]", "[20, 30, 40]", "[10, 20]"
      ], correct: 1, explanation: "Range 1..3 gồm index 1 và 2 (không gồm 3)." }
  ]
});
