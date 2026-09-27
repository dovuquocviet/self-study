window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Mô hình dữ liệu",
  title: "Option & Result — tạm biệt null và exception",
  subtitle: "Option<T> thay null · Result<T,E> thay throw · map / and_then / unwrap_or · khi nào unwrap là chấp nhận được",

  theory: `
    <p>Hai enum quan trọng nhất của thư viện chuẩn, định nghĩa đơn giản đến bất ngờ:</p>
    <p><code>enum Option&lt;T&gt; { Some(T), None }</code> &nbsp;·&nbsp; <code>enum Result&lt;T, E&gt; { Ok(T), Err(E) }</code></p>

    <p><strong>Option thay null.</strong> Trong Java, mọi tham chiếu có thể null nhưng kiểu không nói ra → NPE. Trong Rust, <code>User</code> <em>luôn</em> có giá trị;
    chỉ <code>Option&lt;User&gt;</code> mới có thể "không có". Muốn lấy User ra phải xử lý trường hợp None — compiler bắt buộc. Khác <code>Optional</code> Java:
    Optional vẫn có thể null, không dùng cho field, và thư viện cũ không dùng. Option là nền tảng của cả hệ sinh thái Rust.</p>

    <p><strong>Result thay exception.</strong> Lỗi là <em>giá trị trả về</em>, nằm trong chữ ký hàm: <code>fn parse(s: &amp;str) -&gt; Result&lt;Order, ParseError&gt;</code>.
    Nhìn chữ ký là biết hàm có thể lỗi và lỗi kiểu gì — giống checked exception nhưng không có "throws Exception" chung chung, không nhảy stack ẩn.
    Không xử lý Result thì compiler cảnh báo (<code>#[must_use]</code>).</p>

    <table>
      <tr><th>Muốn</th><th>Option / Result</th><th>Java tương tự</th></tr>
      <tr><td>Biến đổi giá trị bên trong</td><td><code>.map(|u| u.email)</code></td><td><code>optional.map(...)</code></td></tr>
      <tr><td>Nối bước có thể thất bại</td><td><code>.and_then(|u| u.address)</code></td><td><code>flatMap</code></td></tr>
      <tr><td>Giá trị mặc định</td><td><code>.unwrap_or(0)</code>, <code>.unwrap_or_default()</code>, <code>.unwrap_or_else(|| tính())</code></td><td><code>orElse / orElseGet</code></td></tr>
      <tr><td>Option → Result</td><td><code>.ok_or(AppError::NotFound)</code></td><td><code>orElseThrow(...)</code></td></tr>
      <tr><td>Result → Option</td><td><code>.ok()</code></td><td>catch rồi trả null</td></tr>
      <tr><td>Đổi kiểu lỗi</td><td><code>.map_err(|e| AppError::Db(e))</code></td><td>catch + wrap exception</td></tr>
      <tr><td>Lấy ra, sai thì panic</td><td><code>.unwrap()</code>, <code>.expect("lý do")</code></td><td><code>.get()</code> ném NoSuchElementException</td></tr>
    </table>

    <p><strong>panic!</strong> khác Result: panic dành cho <em>bug</em> (bất biến bị vi phạm, không thể phục hồi) — unwind stack thread hiện tại, drop mọi thứ, thread chết.
    Result dành cho lỗi <em>dự kiến</em> (file không tồn tại, input sai, DB timeout). <code>unwrap()</code> chấp nhận được trong test, prototype, hoặc khi bạn
    <em>chứng minh được</em> không thể lỗi — khi đó dùng <code>expect("vì sao chắc chắn")</code> để lại lời giải thích.</p>

    <div class="callout"><p>💡 Trong service production, grep <code>unwrap()</code> là việc đáng làm khi review. Mỗi unwrap là một chỗ có thể làm sập request (hoặc cả thread).
    Clippy có lint <code>clippy::unwrap_used</code> để cấm hẳn.</p></div>
  `,

  codeTabs: [
    { id: "opt", label: "Option", lines: [
      "struct User { id: u64, email: Option<String> }   // email có thể vắng",
      "",
      "fn find_user(id: u64) -> Option<User> {",
      "    if id == 1 { Some(User { id, email: None }) } else { None }",
      "}",
      "",
      "match find_user(1) {",
      "    Some(u) => println!(\"tìm thấy {}\", u.id),",
      "    None => println!(\"không có\"),",
      "}",
      "",
      "let email: String = find_user(1)",
      "    .and_then(|u| u.email)          // Option<User> -> Option<String>",
      "    .unwrap_or_else(|| \"no-reply@shop.vn\".to_string());"
    ]},
    { id: "res", label: "Result", lines: [
      "#[derive(Debug)]",
      "enum PriceError { Empty, NotNumber(String), Negative(i64) }",
      "",
      "fn parse_price(s: &str) -> Result<i64, PriceError> {",
      "    if s.is_empty() { return Err(PriceError::Empty); }",
      "    let n: i64 = match s.trim().parse() {",
      "        Ok(n) => n,",
      "        Err(_) => return Err(PriceError::NotNumber(s.to_string())),",
      "    };                              // bài 10: viết gọn bằng toán tử ?",
      "    if n < 0 { return Err(PriceError::Negative(n)); }",
      "    Ok(n)",
      "}",
      "",
      "match parse_price(\"150000\") {",
      "    Ok(p) => println!(\"giá {p}\"),",
      "    Err(e) => eprintln!(\"lỗi: {e:?}\"),",
      "}"
    ]},
    { id: "comb", label: "Combinator", lines: [
      "let qty: u32 = params.get(\"qty\")      // Option<&String>",
      "    .and_then(|s| s.parse().ok())      // parse lỗi -> None",
      "    .filter(|&q| q > 0)                // bỏ số 0",
      "    .unwrap_or(1);                     // mặc định 1",
      "",
      "",
      "let user = find_user(id).ok_or(AppError::NotFound(id))?;  // Option -> Result",
      "let cfg_port = std::env::var(\"PORT\").ok();                 // Result -> Option"
    ]},
    { id: "panic", label: "unwrap & panic", lines: [
      "let v: Vec<u64> = Vec::new();",
      "// v[0];                 -> panic: index out of bounds",
      "let first = v.first();   // Option<&u64>: an toàn",
      "",
      "let port: u16 = \"8080\".parse().unwrap();   // chấp nhận: literal chắc chắn đúng",
      "let re = Regex::new(r\"^\\d+$\")",
      "    .expect(\"regex hằng số phải hợp lệ\");  // expect: ghi lý do",
      "",
      "// KHÔNG nên trong handler production:",
      "let body: Order = serde_json::from_str(&raw).unwrap();  // input người dùng -> sập"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                        // Rust",
      "// User u = repo.find(id);  // có thể null     let u: Option<User> = repo.find(id);",
      "// if (u != null) {...}                         if let Some(u) = repo.find(id) {...}",
      "// Optional.ofNullable(x).map(..).orElse(d)    x.map(..).unwrap_or(d)",
      "// long parse(String s) throws ParseEx         fn parse(s: &str) -> Result<i64, ParseErr>",
      "// try { parse(s) } catch (ParseEx e) {..}     match parse(s) { Ok(v) => .., Err(e) => .. }",
      "// throw new IllegalStateException()           panic!(\"...\")  // chỉ cho bug"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="o"><div class="nl">❓ Option&lt;T&gt;</div><div class="ns">Some(T) | None</div></div>
      <div class="node" id="r"><div class="nl">⚖️ Result&lt;T,E&gt;</div><div class="ns">Ok(T) | Err(E)</div></div>
    </div>
    <div class="arrow" id="a1">↓ phải xử lý mới lấy được T</div>
    <div class="row">
      <div class="node" id="m"><div class="nl">🔀 match / if let</div><div class="ns">tường minh</div></div>
      <div class="node" id="c"><div class="nl">⛓️ map / and_then / unwrap_or</div><div class="ns">combinator</div></div>
    </div>
    <div class="arrow" id="a2">↓ lối thoát khẩn cấp</div>
    <div class="node" id="p"><div class="nl">💥 unwrap / expect → panic</div><div class="ns">chỉ cho bug hoặc chắc chắn đúng</div></div>
  `,
  steps: [
    { title: "1 · Option: vắng mặt nằm trong kiểu", tab: "opt", highlight: [1, 3, 4], on: ["o"],
      desc: "email: Option&lt;String&gt; nói rõ có thể không có. find_user trả Option — người gọi không thể quên kiểm tra." },
    { title: "2 · Xử lý bằng match", tab: "opt", highlight: [7, 8, 9], on: ["a1", "m"],
      desc: "Không có đường nào dùng User mà bỏ qua None. Hết NullPointerException." },
    { title: "3 · Result: lỗi trong chữ ký", tab: "res", highlight: [2, 4, 5, 8, 10, 11], on: ["r"],
      desc: "Hàm trả Ok(n) hoặc Err(PriceError). Kiểu lỗi là enum của bạn — người gọi match từng loại lỗi." },
    { title: "4 · Combinator", tab: "comb", highlight: [1, 2, 3, 4, 7, 8], on: ["c"],
      desc: "map/and_then/ok_or giúp chuỗi hoá như Stream/Optional của Java. ok_or chuyển 'không có' thành lỗi cụ thể." },
    { title: "5 · unwrap có chủ đích", tab: "panic", highlight: [3, 5, 6, 7, 10], on: ["a2", "p"],
      desc: "unwrap = 'tôi chắc chắn không lỗi, nếu sai thì panic'. Hợp với hằng số; không hợp với input người dùng." }
  ],

  quiz: [
    { q: "Định nghĩa của Option trong thư viện chuẩn?", options: [
        "Một class có field null",
        "enum Option&lt;T&gt; { Some(T), None }",
        "Một con trỏ có thể bằng 0",
        "Một trait"
      ], correct: 1, explanation: "Chỉ là enum bình thường, được prelude import sẵn." },
    { q: "Hàm có thể thất bại với lỗi dự kiến (input sai) nên trả về gì?", options: [
        "panic!", "Result&lt;T, E&gt;", "Option&lt;T&gt; và in log", "Giá trị -1"
      ], correct: 1, explanation: "Result mang thông tin lỗi; Option chỉ nói có/không." },
    { q: "<code>.and_then()</code> trên Option tương đương gì trong Java Optional?", options: [
        "map", "flatMap", "orElse", "filter"
      ], correct: 1, explanation: "Closure trả về Option, không bị lồng Option<Option<T>>." },
    { q: "Chuyển Option&lt;User&gt; thành Result&lt;User, AppError&gt; bằng?", options: [
        ".ok()", ".ok_or(AppError::NotFound)", ".unwrap()", ".map_err()"
      ], correct: 1, explanation: ".ok() làm chiều ngược lại (Result → Option)." },
    { q: "Khi nào <code>unwrap()</code> là hợp lý?", options: [
        "Khi parse JSON từ request",
        "Trong test/prototype, hoặc khi chắc chắn không thể lỗi (tốt hơn dùng expect ghi lý do)",
        "Luôn luôn",
        "Không bao giờ được dùng"
      ], correct: 1, explanation: "Với input bên ngoài, luôn xử lý lỗi." },
    { q: "panic! khác trả Err thế nào?", options: [
        "Không khác",
        "panic dành cho bug không phục hồi được: unwind và kết thúc thread; Err là lỗi dự kiến để người gọi xử lý",
        "panic nhanh hơn",
        "Err làm dừng chương trình"
      ], correct: 1, explanation: "Không dùng panic như exception để điều khiển luồng." },
    { q: "Truy cập <code>v[10]</code> khi Vec có 3 phần tử?", options: [
        "Trả None", "Panic index out of bounds", "Trả giá trị rác", "Lỗi biên dịch"
      ], correct: 1, explanation: "Dùng v.get(10) để nhận Option." },
    { q: "Điểm khác Option Rust so với Optional Java?", options: [
        "Option chậm hơn",
        "Option không thể là null, dùng được cho field, và toàn bộ thư viện chuẩn dùng nó",
        "Option chỉ cho số",
        "Không khác"
      ], correct: 1, explanation: "Optional Java là bổ sung muộn; Option Rust là nền tảng." },
    { q: "Bỏ qua giá trị Result trả về (không dùng) thì compiler làm gì?", options: [
        "Không gì cả", "Cảnh báo unused Result (must_use)", "Lỗi biên dịch", "Tự unwrap"
      ], correct: 1, explanation: "Dùng let _ = ... nếu thật sự muốn bỏ qua." }
  ]
});
