window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Ranh giới: unsafe, FFI, macro, WASM",
  title: "Macro: macro_rules! và procedural macro ở mức đọc hiểu",
  subtitle: "macro chạy lúc biên dịch trên token · fragment specifier & lặp $(...),* · hygiene · derive/attribute/function-like · syn + quote · cargo expand",

  theory: `
    <p>Bạn dùng macro mỗi ngày: <code>println!</code>, <code>vec!</code>, <code>#[derive(Serialize)]</code>, <code>#[tokio::main]</code>, <code>sqlx::query!</code>, <code>#[instrument]</code>.
    Macro là <strong>code sinh code lúc biên dịch</strong>, làm việc trên cây token — không phải reflection lúc chạy như annotation processing kiểu Spring (proxy, <code>@Autowired</code> qua reflection).
    Gần nhất trong Java là <em>annotation processor</em> (Lombok, MapStruct): sinh code lúc build.</p>

    <p><strong>1. Declarative: macro_rules!</strong> — "match theo mẫu cú pháp"</p>
    <ul>
      <li>Mỗi nhánh <code>(mẫu) =&gt; { kết quả }</code>. Biến trong mẫu có <em>fragment specifier</em>: <code>$e:expr</code>, <code>$i:ident</code>, <code>$t:ty</code>, <code>$l:literal</code>, <code>$p:pat</code>, <code>$b:block</code>, <code>$tt:tt</code> (một token tree bất kỳ).</li>
      <li>Lặp: <code>$( $x:expr ),*</code> (0+ lần, phân cách bởi dấu phẩy), <code>+</code> (1+ lần), <code>?</code> (0–1). Phía kết quả lặp bằng <code>$( ... )*</code>.</li>
      <li><strong>Hygiene</strong>: biến cục bộ tạo trong macro không đụng biến cùng tên của người gọi — khác <code>#define</code> của C.</li>
      <li>Xuất ra ngoài crate bằng <code>#[macro_export]</code>; bên trong nên gọi đường dẫn tuyệt đối <code>$crate::...</code>.</li>
      <li>Dùng khi: bớt boilerplate lặp (impl trait cho 10 kiểu số), DSL nhỏ, test table. Không dùng khi một hàm generic làm được.</li>
    </ul>

    <p><strong>2. Procedural macro</strong> — hàm Rust nhận <code>TokenStream</code>, trả <code>TokenStream</code>; phải nằm trong crate riêng <code>proc-macro = true</code>.</p>
    <table>
      <tr><th>Loại</th><th>Cú pháp dùng</th><th>Ví dụ</th></tr>
      <tr><td>Derive</td><td><code>#[derive(MyTrait)]</code> — chỉ <em>thêm</em> code (impl), không sửa item gốc</td><td>Serialize, thiserror::Error, FromRef, uniffi::Record</td></tr>
      <tr><td>Attribute</td><td><code>#[my_attr(args)]</code> — nhận item và <em>thay thế</em> nó</td><td>#[tokio::main], #[instrument], #[async_trait]</td></tr>
      <tr><td>Function-like</td><td><code>my_macro!(...)</code> — như macro_rules nhưng logic tuỳ ý</td><td>sqlx::query! (kết nối DB lúc build!), html!</td></tr>
    </table>
    <p>Bộ ba thư viện: <code>syn</code> (parse token thành AST), <code>quote!</code> (sinh token từ template, <code>#ident</code> để chèn biến), <code>proc-macro2</code>.
    Báo lỗi đẹp: <code>syn::Error::new_spanned(node, "msg").to_compile_error()</code> → gạch đỏ đúng chỗ trong IDE.</p>

    <p><strong>3. Cái giá</strong>: proc macro làm tăng thời gian biên dịch (syn khá nặng), lỗi khó đọc, IDE đôi khi không hiểu. Debug bằng <code>cargo expand</code> (crate <code>cargo-expand</code>) để xem code sau khi mở macro —
    cách tốt nhất để hiểu <code>#[tokio::main]</code> hay <code>#[derive(Deserialize)]</code> thật ra làm gì.</p>
    <div class="callout"><p>💡 Với người học: bạn cần <em>đọc hiểu</em> và <em>dùng</em> macro thành thạo, tự viết <code>macro_rules!</code> nhỏ khi thấy lặp; hiếm khi cần tự viết proc macro trong service.
    Khi macro báo lỗi khó hiểu, <code>cargo expand</code> trước, đoán sau.</p></div>
  `,

  codeTabs: [
    { id: "decl", label: "① macro_rules!", lines: [
      "/// hashmap!{ \"a\" => 1, \"b\" => 2 }",
      "#[macro_export]",
      "macro_rules! hashmap {",
      "    () => { ::std::collections::HashMap::new() };",
      "    ( $( $k:expr => $v:expr ),+ $(,)? ) => {{",
      "        let mut m = ::std::collections::HashMap::new();",
      "        $( m.insert($k, $v); )+",
      "        m",
      "    }};",
      "}",
      "",
      "let limits = hashmap! { \"free\" => 100, \"pro\" => 10_000, };",
      "// hygiene: biến `m` trong macro không đụng biến `m` của người gọi"
    ]},
    { id: "impl", label: "② Bớt boilerplate", lines: [
      "pub trait Money { fn to_minor(self) -> i64; }",
      "",
      "macro_rules! impl_money {",
      "    ( $( $t:ty ),* ) => {",
      "        $( impl Money for $t { fn to_minor(self) -> i64 { self as i64 * 100 } } )*",
      "    };",
      "}",
      "impl_money!(i8, i16, i32, u8, u16, u32);     // 6 impl từ một dòng",
      "",
      "// Test table",
      "macro_rules! case { ($name:ident, $input:expr, $expected:expr) => {",
      "    #[test] fn $name() { assert_eq!(normalize($input), $expected); }",
      "}; }",
      "case!(upper, \"abc\", \"ABC\");",
      "case!(trims, \" x \", \"X\");"
    ]},
    { id: "derive", label: "③ Derive macro", lines: [
      "// crate: my-derive (Cargo.toml: [lib] proc-macro = true)",
      "use proc_macro::TokenStream;",
      "use quote::quote;",
      "use syn::{parse_macro_input, DeriveInput};",
      "",
      "#[proc_macro_derive(TableName)]",
      "pub fn derive_table_name(input: TokenStream) -> TokenStream {",
      "    let ast = parse_macro_input!(input as DeriveInput);",
      "    let name = &ast.ident;                          // vd: OrderItem",
      "    let table = to_snake(&name.to_string()) + \"s\";  // \"order_items\"",
      "    quote! {",
      "        impl TableName for #name {",
      "            const TABLE: &'static str = #table;",
      "        }",
      "    }.into()",
      "}",
      "// dùng: #[derive(TableName)] struct OrderItem { .. }  -> OrderItem::TABLE"
    ]},
    { id: "expand", label: "④ cargo expand", lines: [
      "cargo install cargo-expand",
      "cargo expand --bin order-svc main",
      "",
      "// #[tokio::main] async fn main() { run().await }",
      "// mở ra (rút gọn):",
      "fn main() {",
      "    let body = async { run().await };",
      "    tokio::runtime::Builder::new_multi_thread()",
      "        .enable_all()",
      "        .build()",
      "        .expect(\"Failed building the Runtime\")",
      "        .block_on(body)",
      "}"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "@Data                        // Lombok: annotation processor sinh getter/setter lúc build",
      "public class Order { ... }   // ~ #[derive(...)]",
      "",
      "@Transactional               // Spring: proxy + reflection lúc CHẠY",
      "public void pay() { ... }    // Rust không có tương đương runtime; attribute macro",
      "                             // viết lại hàm lúc biên dịch (vd #[instrument])",
      "",
      "// Lombok/MapStruct gần proc macro nhất; Spring AOP thì không"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📝 Source</div><div class="ns">#[derive(TableName)] · hashmap!{...} · #[tokio::main]</div></div>
    <div class="arrow" id="a1">↓ lúc biên dịch: token stream</div>
    <div class="row">
      <div class="node" id="decl"><div class="nl">🧩 macro_rules!</div><div class="ns">khớp mẫu · lặp $(...)* · hygiene</div></div>
      <div class="node" id="proc"><div class="nl">🏭 proc macro</div><div class="ns">syn parse → logic → quote!</div></div>
    </div>
    <div class="arrow" id="a2">↓ code Rust sinh ra</div>
    <div class="node" id="out"><div class="nl">⚙️ Code thường</div><div class="ns">borrow checker + type check như mọi code khác</div></div>
    <div class="arrow" id="a3">↓ xem bằng</div>
    <div class="node" id="exp"><div class="nl">🔍 cargo expand</div><div class="ns">đọc code sau khi mở macro</div></div>
  `,
  steps: [
    { title: "1 · Khớp mẫu và lặp", tab: "decl", highlight: [4, 5, 7], on: ["src", "a1", "decl"],
      desc: "<code>$( $k:expr =&gt; $v:expr ),+</code> khớp 1+ cặp; <code>$(,)?</code> cho phép dấu phẩy cuối; <code>$( m.insert(...); )+</code> lặp lại ở đầu ra." },
    { title: "2 · Hygiene & đường dẫn tuyệt đối", tab: "decl", highlight: [2, 4, 6, 13], on: ["decl", "out"],
      desc: "<code>::std::...</code> để macro chạy đúng dù người gọi có module tên std. Biến m không rò ra ngoài." },
    { title: "3 · Sinh impl hàng loạt", tab: "impl", highlight: [3, 4, 5, 8, 11, 12], on: ["decl", "a2", "out"],
      desc: "Một dòng thay 6 impl; một dòng thay một hàm test. Đây là chỗ macro_rules! đáng dùng." },
    { title: "4 · Derive macro với syn + quote", tab: "derive", highlight: [6, 8, 9, 11, 12, 13], on: ["proc"],
      desc: "Parse struct thành AST, lấy tên, sinh impl. <code>#name</code>, <code>#table</code> chèn biến Rust vào template." },
    { title: "5 · Mở macro để hiểu", tab: "expand", highlight: [2, 6, 7, 8, 12], on: ["a3", "exp"],
      desc: "#[tokio::main] chỉ là dựng runtime + block_on. Không có ma thuật lúc chạy." }
  ],

  quiz: [
    { q: "Macro Rust chạy lúc nào?", options: [
        "Lúc chạy bằng reflection", "Lúc biên dịch, trên token", "Lúc link", "Khi gọi hàm lần đầu"
      ], correct: 1, explanation: "Code sinh ra vẫn đi qua type check và borrow checker." },
    { q: "Trong macro_rules!, $( $x:expr ),* nghĩa là?", options: [
        "Đúng một biểu thức",
        "Không hoặc nhiều biểu thức, phân cách bởi dấu phẩy",
        "Một hoặc nhiều, phân cách bởi *",
        "Một kiểu"
      ], correct: 1, explanation: "+ là 1+, ? là 0–1." },
    { q: "Hygiene của macro_rules! đảm bảo gì?", options: [
        "Macro không panic",
        "Biến cục bộ khai báo trong macro không xung đột với biến cùng tên ở nơi gọi",
        "Macro chạy nhanh",
        "Macro không sinh unsafe"
      ], correct: 1, explanation: "Khác #define của C." },
    { q: "#[tokio::main] thuộc loại macro nào?", options: [
        "Derive", "Attribute procedural macro", "macro_rules!", "Function-like"
      ], correct: 1, explanation: "Nhận hàm main async, thay bằng main đồng bộ dựng runtime." },
    { q: "Derive macro có thể sửa struct gốc không?", options: [
        "Có", "Không — chỉ thêm code (thường là impl) bên cạnh", "Chỉ xoá field", "Chỉ đổi tên"
      ], correct: 1, explanation: "Attribute macro mới thay thế được item." },
    { q: "Vì sao proc macro phải nằm trong crate riêng proc-macro = true?", options: [
        "Quy ước đặt tên",
        "Nó được biên dịch và chạy trong compiler lúc build crate khác, như một plugin",
        "Để public",
        "Không cần"
      ], correct: 1, explanation: "Crate proc-macro chỉ xuất được macro." },
    { q: "syn và quote dùng để làm gì?", options: [
        "Log và trace",
        "syn parse TokenStream thành AST; quote! sinh TokenStream từ template",
        "Kết nối DB",
        "Serialize JSON"
      ], correct: 1, explanation: "Bộ công cụ chuẩn để viết proc macro." },
    { q: "Công cụ xem code sau khi mở macro?", options: [
        "cargo tree", "cargo expand", "cargo fmt", "cargo doc"
      ], correct: 1, explanation: "Cài bằng cargo install cargo-expand." },
    { q: "Tương đương Java gần nhất của derive macro?", options: [
        "Spring AOP proxy", "Annotation processor như Lombok/MapStruct (sinh code lúc build)", "Reflection", "JNI"
      ], correct: 1, explanation: "Spring AOP hoạt động lúc chạy, khác bản chất." },
    { q: "sqlx::query! kiểm tra SQL với DB lúc build được là nhờ?", options: [
        "Reflection",
        "Nó là function-like proc macro — code Rust tuỳ ý chạy lúc biên dịch, kể cả kết nối DB",
        "Annotation",
        "Build script bắt buộc"
      ], correct: 1, explanation: "Proc macro là chương trình đầy đủ chạy trong compiler." }
  ]
});
