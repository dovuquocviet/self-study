window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Mô hình dữ liệu",
  title: "Struct & impl — class Java bị tách làm đôi",
  subtitle: "dữ liệu (struct) tách khỏi hành vi (impl) · self / &self / &mut self · associated fn thay constructor · #[derive]",

  theory: `
    <p>Class Java gộp field + constructor + method. Rust tách: <strong><code>struct</code></strong> chỉ khai báo dữ liệu, <strong><code>impl</code></strong> chứa hàm gắn với kiểu đó.
    Không có constructor đặc biệt, không có <code>this</code> ngầm, không có kế thừa.</p>

    <table>
      <tr><th>Java</th><th>Rust</th></tr>
      <tr><td><code>new Order(...)</code> constructor</td><td>Associated function, quy ước tên <code>Order::new(...)</code> trả <code>Self</code></td></tr>
      <tr><td><code>static</code> method</td><td>Hàm trong impl không có tham số <code>self</code>, gọi <code>Order::from_row(...)</code></td></tr>
      <tr><td>Instance method</td><td>Tham số đầu là <code>&amp;self</code> (đọc), <code>&amp;mut self</code> (sửa) hoặc <code>self</code> (tiêu thụ, lấy quyền sở hữu)</td></tr>
      <tr><td><code>private</code> field + getter</td><td>Field mặc định private với module khác; <code>pub</code> để mở</td></tr>
      <tr><td>Lombok <code>@Data</code>, <code>record</code></td><td><code>#[derive(Debug, Clone, PartialEq, Default)]</code></td></tr>
      <tr><td><code>toString()</code></td><td><code>Debug</code> (<code>{:?}</code>, cho dev) · <code>Display</code> (<code>{}</code>, cho người dùng — tự impl)</td></tr>
      <tr><td><code>equals()/hashCode()</code></td><td><code>PartialEq, Eq, Hash</code></td></tr>
    </table>

    <p><strong>Ba kiểu self</strong> quyết định cách method dùng đối tượng — đây chính là ownership áp vào method:</p>
    <ul>
      <li><code>&amp;self</code>: chỉ đọc, gọi được trên giá trị bất biến. Dùng nhiều nhất.</li>
      <li><code>&amp;mut self</code>: sửa field; biến gọi phải là <code>let mut</code>.</li>
      <li><code>self</code>: tiêu thụ đối tượng — sau khi gọi, biến gốc bị move. Hay dùng cho builder, chuyển trạng thái (<code>order.ship()</code> trả về <code>ShippedOrder</code>).</li>
    </ul>

    <p><strong>Tiện ích cú pháp</strong>: field init shorthand <code>Order { id, total }</code> (khi biến trùng tên field); struct update <code>Order { total: 0, ..old }</code>;
    tuple struct <code>struct OrderId(u64);</code> — "newtype" để không truyền nhầm <code>UserId</code> vào chỗ cần <code>OrderId</code> dù cả hai là u64, chi phí runtime bằng 0.</p>

    <p><strong>Không có null field</strong>: mọi field phải được khởi tạo khi tạo struct. Field có thể vắng mặt → kiểu <code>Option&lt;T&gt;</code> (bài 09).</p>

    <div class="callout"><p>💡 Có thể viết nhiều khối <code>impl</code> cho cùng một struct (kể cả ở file khác trong cùng crate). Không có getter/setter bắt buộc:
    field nội bộ để private, chỉ mở method có ý nghĩa nghiệp vụ (<code>add_item</code>, <code>total()</code>) thay vì <code>setTotal</code>.</p></div>
  `,

  codeTabs: [
    { id: "struct", label: "struct + impl", lines: [
      "#[derive(Debug, Clone, PartialEq)]",
      "pub struct Order {",
      "    pub id: u64,",
      "    items: Vec<Item>,          // private với module khác",
      "    status: Status,",
      "}",
      "",
      "impl Order {",
      "    pub fn new(id: u64) -> Self {          // 'constructor' = associated fn",
      "        Order { id, items: Vec::new(), status: Status::Draft }",
      "    }",
      "    pub fn total(&self) -> u64 {           // đọc",
      "        self.items.iter().map(|i| i.price * i.qty as u64).sum()",
      "    }",
      "    pub fn add_item(&mut self, item: Item) {  // sửa",
      "        self.items.push(item);",
      "    }",
      "    pub fn into_items(self) -> Vec<Item> {  // tiêu thụ: Order bị move",
      "        self.items",
      "    }",
      "}"
    ]},
    { id: "use", label: "Sử dụng", lines: [
      "let mut order = Order::new(1001);",
      "order.add_item(Item { sku: \"AO-01\".into(), price: 150_000, qty: 2 });",
      "println!(\"{}\", order.total());         // 300000",
      "println!(\"{:?}\", order);               // Debug do derive sinh ra",
      "",
      "let snapshot = order.clone();           // Clone do derive",
      "let items = order.into_items();         // order bị move vào method",
      "// order.total();                       -> lỗi: use of moved value",
      "assert_eq!(snapshot.id, 1001);"
    ]},
    { id: "newtype", label: "Newtype & Display", lines: [
      "use std::fmt;",
      "",
      "#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]",
      "pub struct OrderId(pub u64);             // tuple struct",
      "",
      "#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]",
      "pub struct UserId(pub u64);",
      "",
      "fn find_order(id: OrderId) { /* ... */ }",
      "// find_order(UserId(7));   -> lỗi biên dịch: expected OrderId",
      "",
      "impl fmt::Display for OrderId {",
      "    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {",
      "        write!(f, \"ORD-{:06}\", self.0)        // in ra ORD-001001",
      "    }",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java",
      "// @Data public class Order {",
      "//   private final long id;",
      "//   private List<Item> items = new ArrayList<>();",
      "//   public Order(long id) { this.id = id; }",
      "//   public long total() { return items.stream()...sum(); }",
      "//   public void addItem(Item i) { items.add(i); }",
      "// }",
      "",
      "// Rust: struct Order { id: u64, items: Vec<Item> }",
      "//       impl Order { fn new(id: u64) -> Self   fn total(&self)   fn add_item(&mut self, ..) }",
      "// this ngầm  -> self tường minh, và KIỂU của self nói rõ đọc / sửa / tiêu thụ"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="data"><div class="nl">📦 struct Order</div><div class="ns">chỉ dữ liệu</div></div>
      <div class="node" id="beh"><div class="nl">🛠️ impl Order</div><div class="ns">hàm gắn với kiểu</div></div>
    </div>
    <div class="arrow" id="a1">↓ tham số self quyết định quyền</div>
    <div class="row">
      <div class="node" id="r"><div class="nl">&amp;self</div><div class="ns">đọc</div></div>
      <div class="node" id="w"><div class="nl">&amp;mut self</div><div class="ns">sửa</div></div>
      <div class="node" id="c"><div class="nl">self</div><div class="ns">tiêu thụ</div></div>
    </div>
    <div class="arrow" id="a2">↓ #[derive] sinh code sẵn</div>
    <div class="node" id="der"><div class="nl">✨ Debug · Clone · PartialEq · Hash</div><div class="ns">thay Lombok/record</div></div>
  `,
  steps: [
    { title: "1 · Tách dữ liệu và hành vi", tab: "struct", highlight: [2, 3, 4, 5, 8], on: ["data", "beh"],
      desc: "struct chỉ có field; impl chứa method. Field không pub thì module khác không truy cập được." },
    { title: "2 · Constructor là hàm thường", tab: "struct", highlight: [9, 10], on: ["beh"],
      desc: "<code>Order::new</code> chỉ là quy ước tên. Self là alias của kiểu đang impl. Mọi field phải được gán — không có null." },
    { title: "3 · &self vs &mut self vs self", tab: "struct", highlight: [12, 15, 18], on: ["a1", "r", "w", "c"],
      desc: "total chỉ đọc; add_item sửa; into_items lấy luôn Order — gọi xong không dùng order được nữa." },
    { title: "4 · Gọi method", tab: "use", highlight: [1, 2, 7, 8], on: ["w", "c"],
      desc: "order phải là let mut để gọi add_item. Sau into_items, order đã bị move." },
    { title: "5 · derive & newtype", tab: "newtype", highlight: [3, 4, 7, 10, 12], on: ["a2", "der"],
      desc: "derive sinh sẵn Debug/Clone/Eq/Hash. Newtype OrderId vs UserId: cùng u64 nhưng compiler không cho truyền nhầm." }
  ],

  quiz: [
    { q: "Rust thay constructor Java bằng gì?", options: [
        "Từ khoá constructor",
        "Associated function (thường tên new) trả về Self",
        "Hàm init() bắt buộc",
        "Annotation @Constructor"
      ], correct: 1, explanation: "new chỉ là quy ước; có thể có with_capacity, from_row..." },
    { q: "Method cần sửa field nên nhận self kiểu gì?", options: [
        "self", "&self", "&mut self", "Box&lt;self&gt;"
      ], correct: 2, explanation: "Và biến gọi phải được khai báo mut." },
    { q: "Sau khi gọi <code>order.into_items()</code> (nhận <code>self</code>), order còn dùng được không?", options: [
        "Có", "Không — order đã bị move vào method", "Chỉ đọc được", "Có nếu Order derive Debug"
      ], correct: 1, explanation: "self (không &) lấy quyền sở hữu. Trừ khi kiểu là Copy." },
    { q: "<code>#[derive(Debug)]</code> cho phép gì?", options: [
        "In bằng {:?}", "In bằng {}", "So sánh ==", "Clone"
      ], correct: 0, explanation: "{} cần Display, phải tự impl." },
    { q: "Lợi ích của newtype <code>struct OrderId(u64)</code>?", options: [
        "Tăng tốc truy vấn",
        "Compiler phân biệt OrderId với UserId dù cùng u64; chi phí runtime bằng 0",
        "Tự động lưu DB",
        "Cho phép null"
      ], correct: 1, explanation: "Kiểu bọc bị tối ưu mất khi biên dịch." },
    { q: "Mặc định field của struct có visibility gì?", options: [
        "public", "private (chỉ trong module định nghĩa và module con)", "protected", "package-private như Java"
      ], correct: 1, explanation: "Cần pub để module khác truy cập." },
    { q: "<code>Order { total: 0, ..old }</code> nghĩa là gì?", options: [
        "Spread operator của JS, lỗi trong Rust",
        "Struct update: lấy các field còn lại từ old",
        "Copy toàn bộ old rồi xoá total",
        "Tạo mảng"
      ], correct: 1, explanation: "Lưu ý: field không Copy sẽ bị move khỏi old." },
    { q: "Struct Rust có field mang giá trị null được không?", options: [
        "Có, mặc định là null",
        "Không; field có thể vắng mặt phải khai báo Option&lt;T&gt;",
        "Chỉ field kiểu String",
        "Có nếu derive Default"
      ], correct: 1, explanation: "Mọi field phải được khởi tạo khi tạo struct." },
    { q: "Tương đương <code>equals()</code>/<code>hashCode()</code> để dùng struct làm key HashMap?", options: [
        "derive(Debug, Clone)", "derive(PartialEq, Eq, Hash)", "impl Display", "derive(Default)"
      ], correct: 1, explanation: "HashMap yêu cầu key: Eq + Hash." }
  ]
});
