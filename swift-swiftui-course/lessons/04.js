window.LESSONS.push({
  id: "04",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "enum có associated value & pattern matching",
  subtitle: "Mô hình hoá trạng thái đúng nghĩa · switch phải vét hết · raw value · Result",

  theory: `
    <p>Enum Java là tập hằng số (có thể kèm field chung cho mọi hằng). Enum Swift mạnh hơn nhiều: <strong>mỗi case có thể mang dữ liệu riêng, khác kiểu nhau</strong> — gọi là <em>associated value</em>. Đây là "sum type" (Java 17+ mô phỏng bằng <code>sealed interface</code> + các <code>record</code>).</p>

    <p><strong>Vì sao quan trọng?</strong> Trạng thái màn hình tải dữ liệu thường được viết kiểu Java thế này: <code>boolean loading; List items; String error;</code> — cho phép cả những tổ hợp vô nghĩa (loading = true và error != null cùng lúc). Với enum:</p>
    <ul>
      <li><code>case idle</code>, <code>case loading</code>, <code>case loaded([Product])</code>, <code>case failed(String)</code> — chỉ một trạng thái tồn tại tại một thời điểm, dữ liệu đi kèm đúng trạng thái. "Làm cho trạng thái sai không thể biểu diễn được."</li>
    </ul>

    <p><strong>switch trong Swift</strong></p>
    <ul>
      <li><strong>Phải vét hết</strong> (exhaustive): thiếu case là lỗi biên dịch. Thêm case mới vào enum → compiler chỉ ra mọi chỗ cần sửa. Tránh dùng <code>default</code> với enum của chính bạn vì nó tắt kiểm tra này.</li>
      <li>Không rơi xuống (no implicit fallthrough) — không cần <code>break</code>.</li>
      <li>Pattern mạnh: <code>case .loaded(let items) where items.isEmpty</code>, khớp tuple <code>case (0, _)</code>, khoảng <code>case 200..&lt;300</code>.</li>
      <li><code>if case .failed(let msg) = state { ... }</code> khi chỉ quan tâm một case.</li>
    </ul>

    <p><strong>Raw value</strong>: <code>enum Status: String { case paid, shipped }</code> — mỗi case gắn một giá trị cố định (<code>"paid"</code>). Tạo từ chuỗi bằng <code>Status(rawValue: "paid")</code> → trả <code>Status?</code> vì chuỗi có thể sai. Kết hợp với <code>Codable</code> (bài 21) để parse JSON.</p>

    <p><strong>enum còn có</strong>: method, computed property, <code>static func</code>, conform protocol. <code>indirect enum</code> cho kiểu đệ quy (cây biểu thức). <code>Optional</code> (bài 02) và <code>Result&lt;Success, Failure&gt;</code> đều là enum trong thư viện chuẩn.</p>

    <div class="callout"><p>💡 Với dev backend: một event Kafka có nhiều loại (<code>OrderCreated</code>, <code>OrderPaid</code>…) rất hợp với enum có associated value; khi sang Rust bạn sẽ gặp lại y hệt ý tưởng này ở <code>enum</code> + <code>match</code>.</p></div>
  `,

  codeTabs: [
    { id: "state", label: "Trạng thái màn hình", lines: [
      "enum LoadState {",
      "    case idle",
      "    case loading",
      "    case loaded([Product])",
      "    case failed(message: String, retryable: Bool)",
      "}",
      "",
      "var state: LoadState = .idle",
      "state = .failed(message: \"Mất mạng\", retryable: true)"
    ]},
    { id: "switch", label: "switch vét hết", lines: [
      "func label(for state: LoadState) -> String {",
      "    switch state {",
      "    case .idle, .loading:",
      "        return \"Đang tải…\"",
      "    case .loaded(let items) where items.isEmpty:",
      "        return \"Chưa có sản phẩm\"",
      "    case .loaded(let items):",
      "        return \"\\(items.count) sản phẩm\"",
      "    case .failed(let message, _):",
      "        return message",
      "    }   // thiếu 1 case → lỗi biên dịch",
      "}"
    ]},
    { id: "raw", label: "Raw value", lines: [
      "enum OrderStatus: String, Codable {",
      "    case pending, paid, shipped",
      "    case cancelled = \"CANCELLED\"",
      "}",
      "",
      "OrderStatus.paid.rawValue          // \"paid\"",
      "OrderStatus(rawValue: \"refunded\")  // nil — không có case này",
      "",
      "if case .failed(let msg, true) = state { retry(msg) }"
    ]},
    { id: "java", label: "Java 21+ tương đương", lines: [
      "sealed interface LoadState permits Idle, Loading, Loaded, Failed {}",
      "record Idle() implements LoadState {}",
      "record Loading() implements LoadState {}",
      "record Loaded(List<Product> items) implements LoadState {}",
      "record Failed(String message, boolean retryable) implements LoadState {}",
      "",
      "String label = switch (state) {",
      "    case Loaded l when l.items().isEmpty() -> \"Chưa có sản phẩm\";",
      "    case Loaded l -> l.items().size() + \" sản phẩm\";",
      "    case Failed f -> f.message();",
      "    case Idle _, Loading _ -> \"Đang tải…\";   // unnamed pattern: Java 22+",
      "};"
    ]}
  ],

  stageHtml: `
    <div class="node" id="st"><div class="nl">LoadState</div><div class="ns">chỉ một case tại một thời điểm</div></div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">.idle / .loading</div><div class="ns">không dữ liệu</div></div>
      <div class="node" id="c2"><div class="nl">.loaded([Product])</div><div class="ns">mang danh sách</div></div>
      <div class="node" id="c3"><div class="nl">.failed(message, retryable)</div><div class="ns">mang lỗi</div></div>
    </div>
    <div class="arrow" id="a1">↓ switch (compiler kiểm tra đủ case)</div>
    <div class="node" id="ui"><div class="nl">Chuỗi hiển thị</div><div class="ns">không có tổ hợp vô nghĩa</div></div>
  `,
  steps: [
    { title: "1 · Mỗi case mang dữ liệu riêng", tab: "state", highlight: [1, 4, 5], on: ["st", "c2", "c3"],
      desc: "<code>.loaded</code> mang mảng, <code>.failed</code> mang message + cờ. Không thể vừa loading vừa có lỗi." },
    { title: "2 · switch + bind giá trị", tab: "switch", highlight: [2, 5, 7, 8, 9], on: ["a1"],
      desc: "<code>let items</code> lấy associated value ra; <code>where</code> thêm điều kiện; <code>_</code> bỏ qua trường không dùng." },
    { title: "3 · Vét hết là an toàn", tab: "switch", highlight: [3, 11], on: ["c1", "ui"],
      desc: "Gộp nhiều case bằng dấu phẩy. Thêm case mới vào enum → mọi switch thiếu case sẽ báo lỗi biên dịch." },
    { title: "4 · Raw value & if case", tab: "raw", highlight: [1, 3, 6, 7, 9], on: ["st"],
      desc: "Raw value hợp để map chuỗi từ API; <code>init?(rawValue:)</code> trả Optional. <code>if case</code> khớp riêng một case (ở đây: failed có retryable = true)." },
    { title: "5 · So với Java sealed + record", tab: "java", highlight: [1, 4, 5, 7, 8], on: ["st"],
      desc: "Java 21+ có pattern matching switch với sealed interface — cùng ý tưởng nhưng dài dòng hơn nhiều." }
  ],

  quiz: [
    { q: "Associated value của enum Swift là gì?", options: [
        "Giá trị hằng giống nhau cho mọi case",
        "Dữ liệu riêng gắn với từng case, mỗi case có thể khác kiểu",
        "Chỉ số thứ tự của case",
        "Tên chuỗi của case"
      ], correct: 1, explanation: "Ví dụ .loaded([Product]) và .failed(message: String, retryable: Bool)." },
    { q: "switch trên enum thiếu một case (không có default) thì?", options: [
        "Chạy bình thường, bỏ qua case thiếu", "Lỗi biên dịch: switch must be exhaustive", "Crash khi gặp case thiếu", "Cảnh báo"
      ], correct: 1, explanation: "Swift bắt switch vét hết mọi khả năng." },
    { q: "Vì sao nên tránh default khi switch trên enum của chính mình?", options: [
        "default chậm hơn",
        "default tắt khả năng compiler báo lỗi khi thêm case mới",
        "default không được phép",
        "default gây fallthrough"
      ], correct: 1, explanation: "Thêm case mới sẽ lặng lẽ rơi vào default." },
    { q: "Các case trong switch Swift có tự rơi xuống case sau không?", options: [
        "Có, phải viết break", "Không, trừ khi viết fallthrough", "Chỉ với số", "Chỉ với enum"
      ], correct: 1, explanation: "Không có implicit fallthrough." },
    { q: "OrderStatus(rawValue: \"refunded\") khi không có case refunded?", options: [
        "Ném lỗi", "Trả nil (kiểu OrderStatus?)", "Trả case đầu tiên", "Crash"
      ], correct: 1, explanation: "init(rawValue:) là failable initializer." },
    { q: "Lợi ích của enum LoadState so với 3 field loading/items/error?", options: [
        "Tốn ít bộ nhớ hơn",
        "Loại bỏ các tổ hợp trạng thái vô nghĩa — trạng thái sai không thể biểu diễn",
        "Nhanh hơn",
        "Dễ serialize hơn"
      ], correct: 1, explanation: "Chỉ một case tồn tại, dữ liệu đi đúng case." },
    { q: "if case .failed(let msg, true) = state khớp khi nào?", options: [
        "Mọi case failed",
        "state là .failed và retryable == true; msg được gán message",
        "state khác failed",
        "Lỗi cú pháp"
      ], correct: 1, explanation: "Pattern có thể chứa giá trị cụ thể (true) để khớp." },
    { q: "Cấu trúc Java gần nhất với enum có associated value?", options: [
        "enum Java có field", "sealed interface + các record + switch pattern", "abstract class", "Map<String,Object>"
      ], correct: 1, explanation: "Sealed hierarchy là cách Java mô phỏng sum type." },
    { q: "Optional và Result trong Swift được cài bằng gì?", options: [
        "class", "enum generic", "protocol", "macro"
      ], correct: 1, explanation: "Optional<Wrapped> { none, some } ; Result<Success, Failure> { success, failure }." }
  ]
});
