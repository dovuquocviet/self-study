window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Trừu tượng hoá",
  title: "Trait object: dyn Trait, vtable & khi nào chọn nó",
  subtitle: "Box<dyn Trait> · &dyn Trait · fat pointer (data + vtable) · static vs dynamic dispatch · dyn-compatible",

  theory: `
    <p>Generic <code>Vec&lt;T&gt;</code> chỉ chứa <em>một</em> kiểu T. Muốn <code>List&lt;PaymentGateway&gt;</code> kiểu Java — chứa Momo, VnPay, Stripe cùng lúc — cần <strong>trait object</strong>:
    <code>Vec&lt;Box&lt;dyn PaymentGateway&gt;&gt;</code>.</p>

    <p><strong>Vì sao phải có Box / &amp;?</strong> Các kiểu implement trait có kích thước khác nhau, nên <code>dyn PaymentGateway</code> là kiểu <em>không biết kích thước</em> (unsized, <code>!Sized</code>).
    Không đặt trực tiếp lên stack hay vào Vec được; phải đi qua con trỏ: <code>Box&lt;dyn T&gt;</code> (sở hữu, trên heap), <code>&amp;dyn T</code> (mượn), <code>Arc&lt;dyn T&gt;</code> (chia sẻ giữa thread).</p>

    <p><strong>Bên trong</strong>: con trỏ tới trait object là <strong>fat pointer</strong> = (con trỏ dữ liệu, con trỏ <em>vtable</em>). Vtable là bảng địa chỉ hàm của kiểu cụ thể cho trait đó
    (+ size, align, drop). Gọi <code>gw.charge()</code> = tra vtable rồi nhảy — y như virtual call của Java. Khác Java: object Rust không mang sẵn con trỏ vtable trong header;
    vtable chỉ đi kèm khi bạn chủ động biến nó thành <code>dyn</code>.</p>

    <table>
      <tr><th></th><th>Generic <code>&lt;T: Trait&gt;</code> / <code>impl Trait</code></th><th>Trait object <code>dyn Trait</code></th></tr>
      <tr><td>Dispatch</td><td>Static, lúc biên dịch</td><td>Dynamic, qua vtable lúc chạy</td></tr>
      <tr><td>Hiệu năng</td><td>Inline được, nhanh nhất</td><td>Một lần gián tiếp, không inline; thường thêm cấp phát Box</td></tr>
      <tr><td>Nhiều kiểu trong một collection</td><td>Không</td><td>Có</td></tr>
      <tr><td>Chọn implementation lúc chạy (config, plugin)</td><td>Khó</td><td>Dễ</td></tr>
      <tr><td>Kích thước binary</td><td>Lớn hơn (mỗi kiểu một bản)</td><td>Nhỏ hơn</td></tr>
    </table>

    <p><strong>dyn-compatible</strong> (trước gọi là object safe): không phải trait nào cũng dùng làm <code>dyn</code> được. Method không được trả <code>Self</code> hay có tham số generic riêng
    (vì vtable phải có số hàm cố định). Ví dụ <code>Clone</code> (trả Self) không dùng được như <code>dyn Clone</code>.</p>

    <p><strong>Trong service thực tế</strong>: dependency injection kiểu Spring (inject interface, đổi implementation khi test) thường làm bằng
    <code>Arc&lt;dyn OrderRepo&gt;</code> trong state, hoặc bằng generic <code>AppState&lt;R: OrderRepo&gt;</code>. Arc vì state được chia sẻ giữa nhiều request/thread (bài 16–17).</p>

    <div class="callout"><p>💡 Quy tắc chọn: mặc định dùng generic; dùng <code>dyn</code> khi cần collection nhiều kiểu, chọn implementation lúc chạy, hoặc muốn giảm thời gian biên dịch/kích thước binary.
    Chi phí vtable nhỏ — đừng tối ưu sớm.</p></div>
  `,

  codeTabs: [
    { id: "dyn", label: "Box<dyn Trait>", lines: [
      "trait PaymentGateway {",
      "    fn name(&self) -> &str;",
      "    fn charge(&self, amount: u64) -> Result<String, String>;",
      "}",
      "",
      "struct Momo;",
      "struct VnPay { merchant: String }",
      "impl PaymentGateway for Momo {",
      "    fn name(&self) -> &str { \"momo\" }",
      "    fn charge(&self, a: u64) -> Result<String, String> { Ok(format!(\"MOMO-{a}\")) }",
      "}",
      "impl PaymentGateway for VnPay {",
      "    fn name(&self) -> &str { \"vnpay\" }",
      "    fn charge(&self, a: u64) -> Result<String, String> { Ok(format!(\"VNP-{}-{a}\", self.merchant)) }",
      "}",
      "",
      "let gateways: Vec<Box<dyn PaymentGateway>> = vec![",
      "    Box::new(Momo),",
      "    Box::new(VnPay { merchant: \"SHOP1\".into() }),",
      "];",
      "for g in &gateways {",
      "    println!(\"{} -> {:?}\", g.name(), g.charge(100_000));  // tra vtable",
      "}"
    ]},
    { id: "runtime", label: "Chọn lúc chạy", lines: [
      "fn gateway_from_config(kind: &str) -> Box<dyn PaymentGateway> {",
      "    match kind {",
      "        \"momo\" => Box::new(Momo),",
      "        _ => Box::new(VnPay { merchant: std::env::var(\"MERCHANT\").unwrap_or_default() }),",
      "    }                 // hai nhánh khác kiểu -> chỉ dyn làm được",
      "}",
      "",
      "fn pay(g: &dyn PaymentGateway, amount: u64) {   // mượn, không cần Box",
      "    let _ = g.charge(amount);",
      "}"
    ]},
    { id: "vt", label: "Fat pointer & vtable", lines: [
      "# Box<dyn PaymentGateway> trỏ tới VnPay:",
      "#",
      "#  +-------------+             HEAP: VnPay { merchant }",
      "#  | data ptr  ---------->     +----------------------+",
      "#  | vtable ptr --+            | merchant: String     |",
      "#  +-------------+  |         +----------------------+",
      "#                   v",
      "#   VTABLE <VnPay as PaymentGateway>",
      "#   [drop_in_place, size, align, name = VnPay::name, charge = VnPay::charge]",
      "#",
      "# g.charge(x)  =>  (vtable.charge)(data_ptr, x)"
    ]},
    { id: "di", label: "DI kiểu Spring", lines: [
      "use std::sync::Arc;",
      "",
      "trait OrderRepo: Send + Sync {                      // dùng được giữa các thread",
      "    fn find(&self, id: u64) -> Option<Order>;",
      "}",
      "",
      "#[derive(Clone)]",
      "struct AppState { repo: Arc<dyn OrderRepo> }        // như @Autowired OrderRepo",
      "",
      "let prod = AppState { repo: Arc::new(PgOrderRepo::new(pool)) };",
      "let test = AppState { repo: Arc::new(InMemoryRepo::default()) };  // mock khi test"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                       // Rust",
      "// List<PaymentGateway> gws = List.of(        let gws: Vec<Box<dyn PaymentGateway>> = vec![",
      "//     new Momo(), new VnPay(\"SHOP1\"));          Box::new(Momo), Box::new(VnPay{..}) ];",
      "// gw.charge(100)   // luôn virtual            g.charge(100)  // virtual chỉ vì dyn",
      "// <T extends Gw> void f(T g) // vẫn virtual   fn f<T: Gw>(g: &T) // static, inline",
      "// @Autowired OrderRepo repo;                  repo: Arc<dyn OrderRepo>"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vec"><div class="nl">📋 Vec&lt;Box&lt;dyn PaymentGateway&gt;&gt;</div><div class="ns">mỗi phần tử = fat pointer</div></div>
    <div class="row">
      <div class="node" id="d1"><div class="nl">Momo</div><div class="ns">data + vtable Momo</div></div>
      <div class="node" id="d2"><div class="nl">VnPay</div><div class="ns">data + vtable VnPay</div></div>
    </div>
    <div class="arrow" id="a1">↓ g.charge(x)</div>
    <div class="node" id="vt"><div class="nl">📑 tra vtable</div><div class="ns">nhảy tới VnPay::charge</div></div>
    <div class="arrow" id="a2">↓ so với generic</div>
    <div class="node" id="st"><div class="nl">⚡ static dispatch</div><div class="ns">gọi thẳng, inline — mặc định nên chọn</div></div>
  `,
  steps: [
    { title: "1 · Nhiều kiểu, một danh sách", tab: "dyn", highlight: [17, 18, 19, 20], on: ["vec", "d1", "d2"],
      desc: "Momo và VnPay khác kích thước nên phải Box lên heap; Vec chứa các con trỏ cùng kích thước." },
    { title: "2 · Fat pointer", tab: "vt", highlight: [3, 4, 5, 8, 9], on: ["d2"],
      desc: "Box&lt;dyn T&gt; gồm con trỏ dữ liệu + con trỏ vtable của đúng cặp (VnPay, PaymentGateway)." },
    { title: "3 · Gọi qua vtable", tab: "dyn", highlight: [21, 22], on: ["a1", "vt"],
      desc: "g.charge tra vtable lúc chạy — giống virtual call Java. Không inline được." },
    { title: "4 · Chọn implementation lúc chạy", tab: "runtime", highlight: [1, 3, 4, 5, 8], on: ["vt"],
      desc: "Hai nhánh match trả hai kiểu khác nhau → bắt buộc dyn. &amp;dyn khi chỉ cần mượn." },
    { title: "5 · DI & chọn cách nào", tab: "di", highlight: [3, 8, 10, 11], on: ["a2", "st"],
      desc: "Arc&lt;dyn Repo&gt; cho phép thay mock khi test như Spring. Nhưng mặc định hãy dùng generic; dyn khi thật sự cần linh hoạt lúc chạy." }
  ],

  quiz: [
    { q: "Vì sao không viết được <code>Vec&lt;dyn PaymentGateway&gt;</code>?", options: [
        "Vì Vec không hỗ trợ trait",
        "dyn Trait không biết kích thước lúc biên dịch (unsized); phải qua con trỏ như Box/&/Arc",
        "Vì thiếu lifetime",
        "Được, không vấn đề"
      ], correct: 1, explanation: "Vec cần mọi phần tử cùng kích thước." },
    { q: "Box&lt;dyn Trait&gt; chứa những gì?", options: [
        "Chỉ con trỏ dữ liệu",
        "Con trỏ dữ liệu + con trỏ vtable",
        "Bản sao object",
        "Tên kiểu dạng chuỗi"
      ], correct: 1, explanation: "Fat pointer 2 word." },
    { q: "Khác biệt với Java về vtable?", options: [
        "Không khác",
        "Object Rust không mang vtable trong header; vtable chỉ đi kèm con trỏ khi dùng dyn",
        "Rust không có vtable",
        "Java không có vtable"
      ], correct: 1, explanation: "Struct thường không tốn thêm byte nào cho dispatch." },
    { q: "Khi nào nên chọn dyn Trait thay vì generic?", options: [
        "Luôn luôn",
        "Khi cần collection nhiều kiểu hoặc chọn implementation lúc chạy",
        "Khi cần nhanh nhất",
        "Khi trait có method trả Self"
      ], correct: 1, explanation: "Mặc định generic; dyn cho linh hoạt runtime." },
    { q: "Trait nào KHÔNG dùng được làm <code>dyn</code>?", options: [
        "Display", "Debug", "Clone (vì clone() trả Self)", "Error"
      ], correct: 2, explanation: "Trait phải dyn-compatible (object safe)." },
    { q: "Hàm có hai nhánh trả Momo và VnPay. Kiểu trả về phù hợp?", options: [
        "impl PaymentGateway", "Box&lt;dyn PaymentGateway&gt;", "Momo", "Self"
      ], correct: 1, explanation: "impl Trait yêu cầu mọi nhánh cùng một kiểu cụ thể." },
    { q: "Muốn chia sẻ repo giữa nhiều thread trong AppState, dùng?", options: [
        "Box&lt;dyn OrderRepo&gt;",
        "Arc&lt;dyn OrderRepo&gt; với trait: Send + Sync",
        "&amp;dyn OrderRepo",
        "Rc&lt;dyn OrderRepo&gt;"
      ], correct: 1, explanation: "Rc không an toàn giữa thread; Arc thì có." },
    { q: "<code>fn f&lt;T: Gw&gt;(g: &T)</code> gọi <code>g.charge()</code> là loại dispatch nào?", options: [
        "Dynamic", "Static", "Reflection", "Tuỳ runtime"
      ], correct: 1, explanation: "Monomorphize nên gọi trực tiếp." },
    { q: "Chi phí chính của dynamic dispatch là gì?", options: [
        "Copy toàn bộ object",
        "Gọi gián tiếp qua vtable, không inline được (và thường thêm cấp phát Box)",
        "Khoá mutex",
        "GC"
      ], correct: 1, explanation: "Thường nhỏ — chỉ đáng lo ở vòng lặp nóng." }
  ]
});
