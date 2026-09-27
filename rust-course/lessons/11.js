window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Trừu tượng hoá",
  title: "Trait & generic — interface và generic, nhưng không xoá kiểu",
  subtitle: "trait = interface có default method · impl cho kiểu có sẵn · trait bound · where · impl Trait · monomorphization",

  theory: `
    <p><strong>Trait</strong> khai báo một tập hành vi, giống <code>interface</code> Java (có cả default method). Khác biệt quan trọng:</p>
    <ul>
      <li><strong>Implement tách rời</strong>: <code>impl Priced for Order { ... }</code> viết riêng, không cần sửa khai báo struct (không có <code>implements</code> trong class).
      Bạn còn implement được trait của mình cho kiểu có sẵn, ví dụ <code>impl Priced for u64</code>.</li>
      <li><strong>Orphan rule</strong>: chỉ được <code>impl Trait for Type</code> nếu trait <em>hoặc</em> type thuộc crate của bạn. Không thể impl <code>Display</code> (std) cho <code>Vec</code> (std) — dùng newtype.</li>
      <li>Trait có thể có <strong>associated function</strong> không nhận self (vd <code>fn default() -&gt; Self</code>) và <strong>associated type</strong> (vd <code>type Item;</code> của Iterator).</li>
    </ul>

    <p><strong>Generic + trait bound</strong>: <code>fn cheapest&lt;T: Priced&gt;(items: &amp;[T]) -&gt; Option&lt;&amp;T&gt;</code> — "T là kiểu bất kỳ implement Priced".
    Như <code>&lt;T extends Priced&gt;</code> trong Java. Nhiều bound: <code>T: Priced + Clone</code>; dài thì chuyển xuống mệnh đề <code>where</code>.</p>

    <p><strong>Monomorphization</strong>: Java xoá kiểu generic khi biên dịch (type erasure) — runtime chỉ có <code>List</code>, phần tử bị box, gọi method qua virtual dispatch.
    Rust sinh <em>một bản hàm riêng cho mỗi kiểu cụ thể</em> được dùng: <code>cheapest::&lt;Order&gt;</code>, <code>cheapest::&lt;Product&gt;</code>. Kết quả: gọi trực tiếp, inline được,
    không boxing — đổi lại binary lớn hơn và biên dịch lâu hơn.</p>

    <p><strong><code>impl Trait</code></strong>: ở tham số, <code>fn log(x: impl Display)</code> là cách viết ngắn của generic. Ở kiểu trả về,
    <code>fn evens() -&gt; impl Iterator&lt;Item = u32&gt;</code> nghĩa là "trả một kiểu cụ thể nào đó implement Iterator, người gọi không cần biết tên" — rất hay dùng với iterator và closure
    (những kiểu có tên dài hoặc không thể viết ra).</p>

    <p><strong>Trait chuẩn nên biết</strong>: <code>Debug</code>, <code>Display</code>, <code>Clone</code>, <code>Copy</code>, <code>PartialEq/Eq</code>, <code>PartialOrd/Ord</code>, <code>Hash</code>,
    <code>Default</code>, <code>From/Into</code> (chuyển đổi — impl From thì có Into miễn phí), <code>Iterator</code>, <code>Drop</code>, <code>Send/Sync</code> (bài 17).</p>

    <div class="callout"><p>💡 Generic + trait bound là <strong>static dispatch</strong> (quyết định lúc biên dịch). Khi cần một danh sách chứa nhiều kiểu khác nhau cùng implement trait
    (như <code>List&lt;Shape&gt;</code> của Java), bạn cần <strong>dynamic dispatch</strong> — trait object <code>dyn Trait</code>, bài tiếp theo.</p></div>
  `,

  codeTabs: [
    { id: "trait", label: "Khai báo & impl", lines: [
      "pub trait Priced {",
      "    fn price(&self) -> u64;                      // bắt buộc implement",
      "    fn price_with_vat(&self) -> u64 {            // default method",
      "        self.price() * 110 / 100",
      "    }",
      "}",
      "",
      "struct Product { name: String, price: u64 }",
      "struct Shipping { km: u64 }",
      "",
      "impl Priced for Product {",
      "    fn price(&self) -> u64 { self.price }",
      "}",
      "impl Priced for Shipping {",
      "    fn price(&self) -> u64 { 15_000 + self.km * 3_000 }",
      "    fn price_with_vat(&self) -> u64 { self.price() }   // ghi đè: phí ship không VAT",
      "}"
    ]},
    { id: "gen", label: "Generic & bound", lines: [
      "fn cheapest<T: Priced>(items: &[T]) -> Option<&T> {",
      "    items.iter().min_by_key(|i| i.price())",
      "}",
      "",
      "fn total<T>(items: &[T]) -> u64",
      "where",
      "    T: Priced + std::fmt::Debug,",
      "{",
      "    items.iter().map(|i| i.price_with_vat()).sum()",
      "}",
      "",
      "fn log_price(x: &impl Priced) {        // viết tắt của <T: Priced>(x: &T)",
      "    println!(\"{}\", x.price());",
      "}",
      "",
      "fn even_ids(max: u32) -> impl Iterator<Item = u32> {",
      "    (0..max).filter(|n| n % 2 == 0)     // kiểu thật rất dài, giấu sau impl",
      "}"
    ]},
    { id: "mono", label: "Monomorphization", lines: [
      "cheapest(&products);     // T = Product",
      "cheapest(&shippings);    // T = Shipping",
      "",
      "// Compiler sinh ra 2 hàm riêng (khái niệm):",
      "// fn cheapest_Product(items: &[Product]) -> Option<&Product> { ... gọi Product::price trực tiếp }",
      "// fn cheapest_Shipping(items: &[Shipping]) -> Option<&Shipping> { ... gọi Shipping::price trực tiếp }",
      "",
      "// Java: List<Integer> -> runtime chỉ còn List<Object>, Integer bị box,",
      "//       gọi qua interface = virtual call.",
      "// Rust: Vec<u64> lưu u64 liền nhau, không box, gọi hàm có thể inline."
    ]},
    { id: "from", label: "From / Into / Default", lines: [
      "struct Money(u64);",
      "",
      "impl From<u64> for Money {",
      "    fn from(v: u64) -> Self { Money(v) }",
      "}",
      "",
      "let a = Money::from(50_000);",
      "let b: Money = 70_000.into();     // có From thì có Into miễn phí",
      "",
      "#[derive(Default, Debug)]",
      "struct Paging { page: u32, size: u32, sort: Option<String> }",
      "let p = Paging { size: 20, ..Default::default() };  // page = 0, sort = None"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                        // Rust",
      "// interface Priced { long price();           trait Priced { fn price(&self) -> u64;",
      "//   default long vat() {...} }                 fn vat(&self) -> u64 {...} }",
      "// class Product implements Priced {...}      impl Priced for Product {...}  // tách rời",
      "// <T extends Priced & Comparable<T>>         <T: Priced + Ord>",
      "// type erasure, boxing                       monomorphization, không box",
      "// không thể thêm interface cho String        impl MyTrait for String  // được (trait của mình)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="t"><div class="nl">📜 trait Priced</div><div class="ns">price() + default price_with_vat()</div></div>
    <div class="arrow" id="a1">↓ impl riêng từng kiểu</div>
    <div class="row">
      <div class="node" id="p"><div class="nl">Product</div><div class="ns">impl Priced</div></div>
      <div class="node" id="s"><div class="nl">Shipping</div><div class="ns">impl Priced (override)</div></div>
    </div>
    <div class="arrow" id="a2">↓ fn cheapest&lt;T: Priced&gt;</div>
    <div class="row">
      <div class="node" id="m1"><div class="nl">⚙️ cheapest::&lt;Product&gt;</div><div class="ns">bản riêng</div></div>
      <div class="node" id="m2"><div class="nl">⚙️ cheapest::&lt;Shipping&gt;</div><div class="ns">bản riêng</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Khai báo trait", tab: "trait", highlight: [1, 2, 3, 4], on: ["t"],
      desc: "price bắt buộc; price_with_vat có sẵn cài đặt mặc định dựa trên price — như default method của interface." },
    { title: "2 · impl tách rời struct", tab: "trait", highlight: [11, 12, 14, 15, 16], on: ["a1", "p", "s"],
      desc: "Struct không cần biết trước nó sẽ implement gì. Shipping ghi đè default method." },
    { title: "3 · Trait bound", tab: "gen", highlight: [1, 2, 5, 6, 7], on: ["a2"],
      desc: "T: Priced giới hạn T; where giúp dễ đọc khi có nhiều bound. Trong thân hàm chỉ gọi được method mà bound cho phép." },
    { title: "4 · Monomorphization", tab: "mono", highlight: [1, 2, 5, 6, 10], on: ["m1", "m2"],
      desc: "Mỗi kiểu dùng thật sinh một bản hàm. Không boxing, không virtual call — đó là zero-cost abstraction." },
    { title: "5 · impl Trait & trait chuẩn", tab: "gen", highlight: [12, 16, 17], on: ["t"],
      desc: "impl Trait ở tham số = generic viết tắt; ở kiểu trả về = giấu tên kiểu cụ thể (iterator, closure)." },
    { title: "6 · From/Into, Default", tab: "from", highlight: [3, 4, 8, 10, 12], on: ["t"],
      desc: "Implement From là có Into. Default + struct update thay cho builder đơn giản." }
  ],

  quiz: [
    { q: "Trait gần nhất với khái niệm nào của Java?", options: [
        "abstract class có field", "interface (có default method)", "annotation", "enum"
      ], correct: 1, explanation: "Trait không có field; dữ liệu nằm ở struct." },
    { q: "Orphan rule cho phép <code>impl Trait for Type</code> khi nào?", options: [
        "Luôn luôn",
        "Khi trait hoặc type (ít nhất một) được định nghĩa trong crate hiện tại",
        "Chỉ khi cả hai thuộc std",
        "Chỉ trong unsafe"
      ], correct: 1, explanation: "Tránh hai crate cùng impl một cặp gây xung đột." },
    { q: "Muốn impl Display (std) cho Vec&lt;Order&gt; (std) thì làm thế nào?", options: [
        "impl trực tiếp",
        "Bọc trong newtype struct Orders(Vec&lt;Order&gt;) rồi impl cho Orders",
        "Không thể in Vec",
        "Dùng unsafe"
      ], correct: 1, explanation: "Newtype là cách vượt orphan rule chuẩn." },
    { q: "Monomorphization là gì?", options: [
        "Xoá thông tin kiểu lúc chạy",
        "Sinh bản code riêng cho mỗi kiểu cụ thể dùng với generic",
        "Chuyển generic thành Object",
        "Chỉ cho phép một kiểu"
      ], correct: 1, explanation: "Đổi lại: binary lớn hơn, compile lâu hơn." },
    { q: "<code>fn evens() -> impl Iterator&lt;Item = u32&gt;</code> nghĩa là?", options: [
        "Trả về một trait object trên heap",
        "Trả về một kiểu cụ thể (compiler biết) implement Iterator, người gọi không cần biết tên",
        "Trả về nhiều kiểu khác nhau tuỳ điều kiện",
        "Trả về Vec"
      ], correct: 1, explanation: "Mọi nhánh return phải cùng một kiểu cụ thể." },
    { q: "Implement <code>From&lt;u64&gt; for Money</code> thì được thêm gì miễn phí?", options: [
        "Display", "u64: Into&lt;Money&gt; (gọi được 5.into())", "Clone", "Default"
      ], correct: 1, explanation: "Blanket impl trong std: From ⇒ Into." },
    { q: "Default method trong trait có thể gọi method bắt buộc khác của cùng trait không?", options: [
        "Không", "Có, như price_with_vat gọi self.price()", "Chỉ khi static", "Chỉ trong impl"
      ], correct: 1, explanation: "Mẫu template method quen thuộc." },
    { q: "Viết <code>T: Priced + Clone</code> nghĩa là?", options: [
        "T là Priced hoặc Clone",
        "T phải implement cả Priced và Clone",
        "T kế thừa Priced",
        "Cộng giá"
      ], correct: 1, explanation: "Giống <T extends Priced & Cloneable>." },
    { q: "Generic với trait bound dùng loại dispatch nào?", options: [
        "Dynamic (vtable)", "Static — quyết định lúc biên dịch", "Reflection", "Ngẫu nhiên"
      ], correct: 1, explanation: "dyn Trait mới là dynamic dispatch." }
  ]
});
