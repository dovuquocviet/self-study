window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Mô hình dữ liệu",
  title: "Enum & match — enum mang dữ liệu, match vét cạn",
  subtitle: "enum là sum type · mỗi variant có dữ liệu riêng · match exhaustive · if let / let else · pattern",

  theory: `
    <p>Enum Java là danh sách hằng (có thể thêm field chung). Enum Rust mạnh hơn nhiều: <strong>mỗi variant có thể mang dữ liệu khác nhau</strong>
    — gọi là <em>sum type</em> / tagged union. Gần nhất trong Java là <code>sealed interface</code> + các <code>record</code> (Java 17+).</p>

    <p>Ví dụ trạng thái thanh toán: <code>Pending</code> không có gì, <code>Paid</code> có mã giao dịch và thời điểm, <code>Failed</code> có lý do. Trong Java cổ điển bạn sẽ
    có một class với <code>status</code> + các field <code>txnId</code>, <code>reason</code> có thể null — và phải nhớ field nào hợp lệ ở trạng thái nào.
    Enum Rust khiến <strong>trạng thái không hợp lệ không thể biểu diễn được</strong>: không thể có Failed mà mang txnId.</p>

    <p><strong><code>match</code></strong> là switch có pattern matching:</p>
    <ul>
      <li><strong>Vét cạn (exhaustive)</strong>: thiếu variant → lỗi biên dịch. Thêm variant mới vào enum → compiler chỉ ra mọi chỗ cần xử lý. Đây là lợi thế lớn khi refactor.</li>
      <li>Là expression, trả giá trị. Mỗi nhánh <code>pattern =&gt; biểu thức</code>.</li>
      <li>Pattern: destructure dữ liệu <code>Paid { txn_id, .. }</code>, nhiều giá trị <code>1 | 2</code>, khoảng <code>1..=9</code>, guard <code>n if n &gt; 100</code>, bắt tất cả <code>_</code>.</li>
    </ul>

    <p><strong>Khi chỉ quan tâm một trường hợp</strong>:</p>
    <ul>
      <li><code>if let Status::Failed { reason } = &amp;s { ... }</code> — như match một nhánh.</li>
      <li><code>let Some(user) = find(id) else { return Err(...) };</code> (let-else) — nếu không khớp thì phải thoát (return/break/continue/panic). Rất hợp cho guard clause.</li>
      <li><code>matches!(s, Status::Paid { .. })</code> — trả bool.</li>
    </ul>

    <p><strong>Bộ nhớ</strong>: kích thước enum = variant lớn nhất + tag (discriminant). Không cấp phát heap, không virtual dispatch.</p>

    <div class="callout"><p>💡 Tránh dùng <code>_ =&gt;</code> cho enum nghiệp vụ của chính bạn: nó nuốt luôn variant mới thêm sau này, mất đi cảnh báo của compiler.
    Liệt kê tường minh từng variant.</p></div>
  `,

  codeTabs: [
    { id: "enum", label: "Enum có dữ liệu", lines: [
      "#[derive(Debug, Clone)]",
      "enum PaymentStatus {",
      "    Pending,                                   // không dữ liệu",
      "    Paid { txn_id: String, at: u64 },          // struct-like",
      "    Failed(String),                            // tuple-like: lý do",
      "    Refunded { txn_id: String, amount: u64 },",
      "}",
      "",
      "let s = PaymentStatus::Paid { txn_id: \"TX9\".into(), at: 1_727_000_000 };"
    ]},
    { id: "match", label: "match", lines: [
      "fn describe(s: &PaymentStatus) -> String {",
      "    match s {",
      "        PaymentStatus::Pending => \"Chờ thanh toán\".to_string(),",
      "        PaymentStatus::Paid { txn_id, .. } => format!(\"Đã trả ({txn_id})\"),",
      "        PaymentStatus::Failed(reason) => format!(\"Lỗi: {reason}\"),",
      "        PaymentStatus::Refunded { amount, .. } if *amount > 1_000_000 =>",
      "            \"Hoàn tiền lớn, cần duyệt\".to_string(),",
      "        PaymentStatus::Refunded { amount, .. } => format!(\"Hoàn {amount}\"),",
      "    }",
      "}",
      "// Xoá nhánh Failed -> error[E0004]: non-exhaustive patterns: Failed(_) not covered"
    ]},
    { id: "iflet", label: "if let / let else", lines: [
      "if let PaymentStatus::Failed(reason) = &s {",
      "    alert(reason);",
      "}",
      "",
      "fn txn_of(s: &PaymentStatus) -> Option<&str> {",
      "    let PaymentStatus::Paid { txn_id, .. } = s else {",
      "        return None;                // không khớp -> bắt buộc thoát",
      "    };",
      "    Some(txn_id)                    // txn_id dùng tiếp ở đây",
      "}",
      "",
      "let is_done = matches!(s, PaymentStatus::Paid { .. } | PaymentStatus::Refunded { .. });"
    ]},
    { id: "pat", label: "Pattern khác", lines: [
      "let fee = match weight_kg {",
      "    0 => 0,",
      "    1..=5 => 20_000,",
      "    6 | 7 | 8 => 35_000,",
      "    w if w > 50 => panic!(\"quá tải\"),",
      "    _ => 50_000,                    // số nguyên: cần nhánh bắt tất cả",
      "};",
      "",
      "match (method, path) {             // match trên tuple",
      "    (\"GET\", \"/health\") => ok(),",
      "    (\"POST\", p) if p.starts_with(\"/orders\") => create(),",
      "    _ => not_found(),",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java 21",
      "// sealed interface PaymentStatus permits Pending, Paid, Failed {}",
      "// record Pending() implements PaymentStatus {}",
      "// record Paid(String txnId, long at) implements PaymentStatus {}",
      "// record Failed(String reason) implements PaymentStatus {}",
      "// String d = switch (s) {",
      "//     case Pending p -> \"Chờ\";",
      "//     case Paid(var txn, var at) -> \"Đã trả \" + txn;",
      "//     case Failed(var r) -> \"Lỗi \" + r;",
      "// };",
      "// Rust: enum + match — cùng ý tưởng, nhưng có từ đầu và dùng khắp thư viện chuẩn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="e"><div class="nl">🏷️ enum PaymentStatus</div><div class="ns">tag + dữ liệu của variant</div></div>
    <div class="arrow" id="a1">↓ match s</div>
    <div class="row">
      <div class="node" id="p1"><div class="nl">Pending</div><div class="ns">—</div></div>
      <div class="node" id="p2"><div class="nl">Paid</div><div class="ns">txn_id, at</div></div>
      <div class="node" id="p3"><div class="nl">Failed</div><div class="ns">reason</div></div>
      <div class="node" id="p4"><div class="nl">Refunded</div><div class="ns">guard amount</div></div>
    </div>
    <div class="arrow" id="a2">↓ thiếu nhánh?</div>
    <div class="node" id="ex"><div class="nl">🛑 E0004 non-exhaustive</div><div class="ns">compiler chỉ ra chỗ cần sửa</div></div>
  `,
  steps: [
    { title: "1 · Variant mang dữ liệu riêng", tab: "enum", highlight: [2, 3, 4, 5, 6], on: ["e"],
      desc: "Mỗi trạng thái chỉ có đúng dữ liệu của nó. Không có field null 'chỉ hợp lệ khi status = PAID'." },
    { title: "2 · match destructure", tab: "match", highlight: [2, 3, 4, 5], on: ["a1", "p1", "p2", "p3"],
      desc: "Pattern vừa kiểm tra variant vừa lấy dữ liệu ra biến. <code>..</code> bỏ qua các field còn lại." },
    { title: "3 · Guard", tab: "match", highlight: [6, 7, 8], on: ["p4"],
      desc: "<code>if *amount &gt; 1_000_000</code> thêm điều kiện. Nhánh được thử theo thứ tự từ trên xuống." },
    { title: "4 · Vét cạn", tab: "match", highlight: [11], on: ["a2", "ex"],
      desc: "Thiếu một variant là lỗi biên dịch. Thêm variant Chargeback vào enum → mọi match chưa xử lý đều báo lỗi." },
    { title: "5 · Chỉ cần một trường hợp", tab: "iflet", highlight: [1, 6, 7, 9, 12], on: ["p2", "p3"],
      desc: "if let cho một nhánh; let-else cho guard clause (không khớp thì return); matches! trả bool." }
  ],

  quiz: [
    { q: "Enum Rust khác enum Java chủ yếu ở điểm nào?", options: [
        "Không có khác biệt",
        "Mỗi variant có thể mang dữ liệu khác nhau (sum type)",
        "Enum Rust không có method",
        "Enum Rust chỉ chứa số"
      ], correct: 1, explanation: "Gần với sealed interface + record của Java 17+." },
    { q: "Nếu match thiếu một variant của enum thì sao?", options: [
        "Bỏ qua lặng lẽ", "Panic lúc chạy", "Lỗi biên dịch non-exhaustive", "Cảnh báo"
      ], correct: 2, explanation: "Exhaustiveness là lỗi cứng (E0004)." },
    { q: "Vì sao nên tránh <code>_ =></code> khi match enum nghiệp vụ của mình?", options: [
        "Vì chậm hơn",
        "Vì nó nuốt các variant thêm mới sau này, mất cảnh báo của compiler",
        "Vì không hợp lệ",
        "Vì bắt buộc dùng default"
      ], correct: 1, explanation: "Liệt kê tường minh để compiler giúp khi refactor." },
    { q: "<code>let Some(u) = find(id) else { ... };</code> — khối else phải làm gì?", options: [
        "Trả về giá trị mặc định cho u",
        "Thoát khỏi luồng hiện tại (return, break, continue, panic…) — kiểu !",
        "Không có yêu cầu",
        "Gán u = None"
      ], correct: 1, explanation: "Khối else của let-else phải diverge." },
    { q: "Pattern <code>1..=5</code> khớp những giá trị nào?", options: [
        "1 đến 4", "1 đến 5", "2 đến 5", "Chỉ 1 và 5"
      ], correct: 1, explanation: "..= là range bao gồm hai đầu." },
    { q: "<code>matches!(s, Status::Paid { .. })</code> trả về gì?", options: [
        "Option", "bool", "Dữ liệu trong Paid", "()"
      ], correct: 1, explanation: "Tiện cho điều kiện if/filter." },
    { q: "Kích thước bộ nhớ của một giá trị enum xấp xỉ bằng?", options: [
        "Tổng kích thước mọi variant",
        "Variant lớn nhất + tag phân biệt (có thể được tối ưu)",
        "Luôn 8 byte",
        "Một con trỏ heap"
      ], correct: 1, explanation: "Không cấp phát heap. Option<&T> còn được tối ưu bằng đúng kích thước con trỏ." },
    { q: "Match trên số nguyên u32 có cần nhánh <code>_</code> không?", options: [
        "Không bao giờ",
        "Có, trừ khi các pattern đã phủ hết mọi giá trị",
        "Chỉ trong release",
        "Chỉ khi có guard"
      ], correct: 1, explanation: "Vét cạn áp dụng cho mọi kiểu, không chỉ enum." },
    { q: "Ý tưởng \"làm cho trạng thái không hợp lệ không biểu diễn được\" nghĩa là gì?", options: [
        "Kiểm tra dữ liệu bằng if ở mọi chỗ",
        "Thiết kế kiểu (enum/struct) sao cho tổ hợp dữ liệu sai không thể tạo ra",
        "Dùng exception",
        "Dùng null cho field không hợp lệ"
      ], correct: 1, explanation: "Ví dụ Failed không thể mang txn_id vì variant đó không có field này." }
  ]
});
