window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Khởi động",
  title: "Biến, mut, kiểu dữ liệu & biểu thức",
  subtitle: "let vs let mut · shadowing · i32/u64/f64/bool/char · tuple, array · String vs &str · mọi thứ là expression",

  theory: `
    <p><strong>Mặc định bất biến.</strong> <code>let x = 5;</code> giống <code>final var x = 5;</code> trong Java. Muốn đổi giá trị phải khai báo
    <code>let mut x = 5;</code>. Ngược với Java (mặc định mutable), Rust bắt bạn nói rõ chỗ nào thay đổi — đọc code biết ngay đâu là trạng thái.</p>

    <p><strong>Suy luận kiểu</strong> như <code>var</code> của Java 10 nhưng mạnh hơn: compiler nhìn cả cách dùng về sau. Khi cần thì ghi kiểu: <code>let n: u64 = 0;</code></p>

    <p><strong>Shadowing</strong>: khai báo lại <code>let</code> cùng tên tạo biến <em>mới</em>, có thể khác kiểu. Hay dùng khi biến đổi dữ liệu:
    <code>let port = "8080"; let port: u16 = port.parse().unwrap();</code>. Khác <code>mut</code>: mut đổi giá trị trong cùng biến và không đổi được kiểu.</p>

    <table>
      <tr><th>Rust</th><th>Java gần nhất</th><th>Ghi chú</th></tr>
      <tr><td><code>i8 i16 i32 i64 i128</code></td><td>byte short int long</td><td>Số nguyên có dấu; mặc định <code>i32</code></td></tr>
      <tr><td><code>u8 u16 u32 u64 u128</code></td><td>(không có)</td><td>Không dấu — Java thiếu, Rust dùng nhiều (độ dài, id)</td></tr>
      <tr><td><code>usize / isize</code></td><td>int (index)</td><td>Bằng độ rộng con trỏ (64-bit trên máy 64-bit); index và độ dài collection</td></tr>
      <tr><td><code>f32 f64</code></td><td>float double</td><td>Mặc định <code>f64</code></td></tr>
      <tr><td><code>bool</code></td><td>boolean</td><td></td></tr>
      <tr><td><code>char</code></td><td>char</td><td>Rust: 4 byte, một Unicode scalar value (Java: 2 byte UTF-16)</td></tr>
      <tr><td><code>(i32, String)</code></td><td>record/Pair</td><td>Tuple, truy cập <code>t.0</code>, <code>t.1</code></td></tr>
      <tr><td><code>[u8; 4]</code></td><td>byte[4]</td><td>Array độ dài cố định, nằm trên stack</td></tr>
      <tr><td><code>String</code> / <code>&amp;str</code></td><td>String</td><td>String: sở hữu, trên heap, sửa được. &amp;str: <em>mượn</em> một đoạn UTF-8</td></tr>
    </table>

    <p><strong>Không tự ép kiểu số</strong>: cộng <code>i32 + i64</code> là lỗi; phải <code>a as i64 + b</code> hoặc <code>i64::from(a)</code>. Tràn số: debug build <em>panic</em>,
    release build quay vòng (wrap) — muốn rõ ràng thì dùng <code>checked_add</code>, <code>saturating_add</code>, <code>wrapping_add</code>.</p>

    <p><strong>Mọi thứ là expression.</strong> <code>if</code>, <code>match</code>, block <code>{ }</code> đều trả giá trị: dòng cuối <em>không có dấu chấm phẩy</em> là giá trị trả về.
    <code>let fee = if vip { 0 } else { 15_000 };</code> thay cho toán tử ba ngôi. Hàm cũng vậy: không cần <code>return</code> ở cuối.</p>

    <div class="callout"><p>💡 Bẫy hay gặp: thêm <code>;</code> vào dòng cuối hàm biến nó thành statement, hàm trả về <code>()</code> (unit, như void) → lỗi "mismatched types: expected i64, found ()".</p></div>
  `,

  codeTabs: [
    { id: "vars", label: "Biến & mut", lines: [
      "fn main() {",
      "    let qty = 3;                 // bất biến, kiểu suy ra i32",
      "    // qty = 4;                  // lỗi E0384: cannot assign twice",
      "    let mut total: u64 = 0;      // mutable, ghi rõ kiểu",
      "    total += 50_000;             // _ để dễ đọc số lớn",
      "",
      "    let port = \"8080\";           // &str",
      "    let port: u16 = port.parse().expect(\"port không hợp lệ\"); // shadowing, đổi kiểu",
      "",
      "    const MAX_ITEMS: usize = 100; // hằng lúc biên dịch, bắt buộc ghi kiểu",
      "    println!(\"{qty} {total} {port} {MAX_ITEMS}\");",
      "}"
    ]},
    { id: "types", label: "Kiểu dữ liệu", lines: [
      "let id: u64 = 42;",
      "let price: f64 = 19.99;",
      "let ok: bool = true;",
      "let c: char = 'ệ';                       // 4 byte Unicode",
      "let pair: (u64, &str) = (42, \"An\");      // tuple",
      "let (uid, name) = pair;                  // destructuring",
      "let ip: [u8; 4] = [10, 0, 0, 1];         // array cố định",
      "let big = id as i128 * 1_000;           // ép kiểu tường minh bằng as",
      "let safe = u8::MAX.checked_add(1);       // None thay vì tràn",
      "let owned: String = String::from(\"xin chào\"); // sở hữu, heap",
      "let view: &str = &owned[0..3];           // mượn 3 byte đầu: \"xin\""
    ]},
    { id: "expr", label: "Expression", lines: [
      "fn shipping_fee(total: u64, vip: bool) -> u64 {",
      "    let base = if total >= 500_000 { 0 } else { 30_000 };  // if trả giá trị",
      "    let discount = {",
      "        let pct = if vip { 50 } else { 0 };",
      "        base * pct / 100          // không ; => giá trị của block",
      "    };",
      "    base - discount               // không ; => giá trị trả về của hàm",
      "}",
      "",
      "fn broken(x: i64) -> i64 {",
      "    x * 2;                        // có ; => hàm trả () -> lỗi biên dịch",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                  // Rust",
      "// final int qty = 3;                   let qty = 3;",
      "// int total = 0;                       let mut total = 0;",
      "// long fee = vip ? 0 : 15000;          let fee = if vip { 0 } else { 15_000 };",
      "// Integer.parseInt(\"8080\")            \"8080\".parse::<u16>()",
      "// (long) x                             x as i64",
      "// Math.addExact(a, b) // ném exception  a.checked_add(b)  // trả Option",
      "// static final int MAX = 100;          const MAX: usize = 100;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="let"><div class="nl">let x = …</div><div class="ns">bất biến mặc định</div></div>
    <div class="row">
      <div class="node" id="mut"><div class="nl">let mut</div><div class="ns">đổi giá trị, giữ kiểu</div></div>
      <div class="node" id="shadow"><div class="nl">let lại (shadowing)</div><div class="ns">biến mới, có thể đổi kiểu</div></div>
    </div>
    <div class="arrow" id="a1">↓ giá trị có kiểu tĩnh</div>
    <div class="node" id="ty"><div class="nl">🔢 Kiểu rõ ràng</div><div class="ns">không tự ép số, dùng as / from</div></div>
    <div class="arrow" id="a2">↓ ghép thành</div>
    <div class="node" id="ex"><div class="nl">🧮 Expression</div><div class="ns">if/match/block trả giá trị</div></div>
  `,
  steps: [
    { title: "1 · Bất biến là mặc định", tab: "vars", highlight: [2, 3], on: ["let"],
      desc: "Gán lại <code>qty</code> là lỗi biên dịch. Rust muốn mọi thay đổi trạng thái phải được khai báo." },
    { title: "2 · mut và shadowing", tab: "vars", highlight: [4, 5, 7, 8], on: ["mut", "shadow"],
      desc: "<code>total</code> đổi giá trị nhờ mut. <code>port</code> được khai báo lại với kiểu u16 — đó là biến mới, biến &amp;str cũ bị che." },
    { title: "3 · Kiểu số tường minh", tab: "types", highlight: [1, 2, 8, 9], on: ["a1", "ty"],
      desc: "Không có ép kiểu ngầm giữa các kiểu số. <code>checked_add</code> trả <code>None</code> khi tràn thay vì âm thầm sai." },
    { title: "4 · String vs &str", tab: "types", highlight: [10, 11], on: ["ty"],
      desc: "String sở hữu vùng nhớ heap. &amp;str chỉ là 'cửa sổ' (con trỏ + độ dài) nhìn vào dữ liệu UTF-8 của người khác. Chi tiết ở bài 06." },
    { title: "5 · Block trả giá trị", tab: "expr", highlight: [2, 3, 5, 6, 7], on: ["a2", "ex"],
      desc: "Dòng cuối không có ; là giá trị của block/hàm. Không cần toán tử ba ngôi hay return cuối hàm." },
    { title: "6 · Bẫy dấu chấm phẩy", tab: "expr", highlight: [10, 11], on: ["ex"],
      desc: "<code>x * 2;</code> thành statement, block trả <code>()</code>, không khớp <code>i64</code> → compiler báo mismatched types." }
  ],

  quiz: [
    { q: "<code>let x = 5; x = 6;</code> — kết quả?", options: [
        "x bằng 6", "Lỗi biên dịch: không gán lại biến bất biến", "Panic lúc chạy", "Cảnh báo nhưng vẫn chạy"
      ], correct: 1, explanation: "Cần let mut x." },
    { q: "Shadowing khác <code>mut</code> ở điểm nào?", options: [
        "Không khác",
        "Shadowing tạo biến mới nên có thể đổi kiểu; mut chỉ đổi giá trị cùng kiểu",
        "mut tạo biến mới",
        "Shadowing chỉ dùng trong vòng lặp"
      ], correct: 1, explanation: "let port: u16 = port.parse()... là mẫu shadowing điển hình." },
    { q: "Kiểu số nguyên mặc định khi viết <code>let n = 10;</code> (không có ràng buộc khác)?", options: [
        "i64", "i32", "usize", "u32"
      ], correct: 1, explanation: "Số nguyên mặc định i32, số thực mặc định f64." },
    { q: "Index của Vec/slice dùng kiểu gì?", options: [
        "i32", "u32", "usize", "i64"
      ], correct: 2, explanation: "usize có độ rộng bằng con trỏ của nền tảng." },
    { q: "<code>let a: i32 = 1; let b: i64 = 2; a + b</code>?", options: [
        "Tự nâng a lên i64",
        "Lỗi biên dịch: mismatched types; phải ép tường minh",
        "Kết quả i32",
        "Panic"
      ], correct: 1, explanation: "Rust không ép kiểu số ngầm. Dùng a as i64 hoặc i64::from(a)." },
    { q: "<code>char</code> trong Rust chiếm bao nhiêu byte?", options: [
        "1", "2 (như Java)", "4 — một Unicode scalar value", "Thay đổi theo ký tự"
      ], correct: 2, explanation: "Còn String lưu UTF-8 nên mỗi ký tự trong String chiếm 1–4 byte." },
    { q: "Hàm <code>fn f() -> i32 { 5; }</code> lỗi vì sao?", options: [
        "Thiếu return",
        "Dấu ; biến 5 thành statement, block trả () thay vì i32",
        "5 không phải i32",
        "Hàm không được trả số"
      ], correct: 1, explanation: "Bỏ ; thì 5 là giá trị trả về." },
    { q: "Cách viết tương đương <code>long fee = vip ? 0 : 15000;</code>?", options: [
        "let fee = vip ? 0 : 15000;",
        "let fee = if vip { 0 } else { 15_000 };",
        "let fee = when vip -> 0;",
        "Rust không hỗ trợ"
      ], correct: 1, explanation: "if là expression nên thay được toán tử ba ngôi." },
    { q: "Trong release build, <code>255u8 + 1</code> tính lúc chạy (không phải hằng) cho kết quả gì theo mặc định?", options: [
        "Panic", "0 (wrap)", "256", "Lỗi biên dịch"
      ], correct: 1, explanation: "Debug: panic 'attempt to add with overflow'. Release mặc định tắt kiểm tra → wrap về 0. Muốn chắc chắn thì dùng checked_/saturating_/wrapping_." }
  ]
});
