window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "Trừu tượng hoá",
  title: "Module & visibility — tổ chức code như package Java",
  subtitle: "mod · file ↔ module · pub / pub(crate) / pub(super) · use & re-export · crate:: self:: super:: · lib + bin",

  theory: `
    <p>Java: package = thư mục, class tự thuộc package theo đường dẫn. Rust: module phải được <strong>khai báo tường minh</strong> bằng <code>mod ten;</code> trong module cha —
    file không được khai báo thì <em>không được biên dịch</em>, dù nằm trong <code>src/</code>. Đây là lỗi đầu tiên dev Java hay gặp.</p>

    <p><strong>Ánh xạ file</strong> (từ edition 2018): trong <code>main.rs</code>/<code>lib.rs</code> viết <code>mod order;</code> → compiler tìm <code>src/order.rs</code>
    hoặc <code>src/order/mod.rs</code> (kiểu cũ). Module con của order: trong <code>order.rs</code> viết <code>mod repo;</code> → <code>src/order/repo.rs</code>.</p>

    <table>
      <tr><th>Rust</th><th>Nhìn thấy từ đâu</th><th>Java gần nhất</th></tr>
      <tr><td>(mặc định, không ghi)</td><td>Module hiện tại và module con của nó</td><td>private (+ class lồng)</td></tr>
      <tr><td><code>pub(super)</code></td><td>Module cha</td><td>—</td></tr>
      <tr><td><code>pub(crate)</code></td><td>Toàn bộ crate hiện tại</td><td>package-private mở rộng / module Java 9 không export</td></tr>
      <tr><td><code>pub</code></td><td>Mọi nơi mà module cha cho phép với tới</td><td>public (+ exports)</td></tr>
    </table>
    <p>Lưu ý: <code>pub struct</code> không làm field thành pub — mỗi field phải ghi <code>pub</code> riêng. Ngược lại <code>pub enum</code> thì mọi variant tự động pub.
    Private là theo <em>module</em>, không theo kiểu: mọi code trong cùng module thấy field private của nhau.</p>

    <p><strong>Đường dẫn</strong>: <code>crate::order::Order</code> (tuyệt đối từ gốc crate), <code>super::Item</code> (module cha), <code>self::repo</code> (module hiện tại).
    <code>use</code> đưa tên vào scope như <code>import</code>. Quy ước: import tới <em>module</em> cho hàm (<code>use std::fs; fs::read(...)</code>), import tới <em>kiểu</em> cho struct/enum/trait.
    Method của trait chỉ gọi được khi trait đã được <code>use</code> vào scope (vd <code>use std::io::Write;</code> để có <code>write_all</code>).</p>

    <p><strong>Re-export</strong> <code>pub use</code>: giấu cấu trúc thư mục nội bộ, lộ API gọn: trong <code>lib.rs</code> viết <code>pub use order::model::Order;</code> → người dùng gọi <code>my_crate::Order</code>.</p>

    <p><strong>Mẫu lib + bin</strong>: <code>src/lib.rs</code> chứa logic (test được, tái dùng), <code>src/main.rs</code> chỉ khởi động và gọi <code>my_app::run()</code>.
    Integration test trong <code>tests/</code> chỉ thấy API <code>pub</code> của lib — giống test một dependency từ bên ngoài.</p>

    <div class="callout"><p>💡 Bắt đầu mọi thứ private, chỉ <code>pub</code> khi thật cần. Dùng <code>pub(crate)</code> cho thứ dùng chung nội bộ service.
    Compiler cảnh báo code không dùng (<code>dead_code</code>) — với mục private, cảnh báo này rất chính xác.</p></div>
  `,

  codeTabs: [
    { id: "tree", label: "Cây thư mục", lines: [
      "order-svc/src/",
      "├── main.rs            # mod-less: fn main() { order_svc::run() }",
      "├── lib.rs             # mod config; mod order; pub use order::Order;",
      "├── config.rs          # crate::config",
      "├── order.rs           # crate::order     — khai báo: mod model; mod repo;",
      "└── order/",
      "    ├── model.rs       # crate::order::model",
      "    └── repo.rs        # crate::order::repo",
      "",
      "# Quên 'mod repo;' trong order.rs => repo.rs KHÔNG được biên dịch"
    ]},
    { id: "lib", label: "lib.rs & order.rs", lines: [
      "// src/lib.rs",
      "mod config;                       // private module",
      "pub mod order;                    // public module",
      "pub use order::model::Order;      // re-export: my_crate::Order",
      "",
      "pub fn run() -> anyhow::Result<()> {",
      "    let cfg = config::load()?;",
      "    order::repo::connect(&cfg.db_url)?;",
      "    Ok(())",
      "}",
      "",
      "// src/order.rs",
      "pub mod model;",
      "pub(crate) mod repo;              // chỉ trong crate này"
    ]},
    { id: "vis", label: "Visibility", lines: [
      "// src/order/model.rs",
      "pub struct Order {",
      "    pub id: u64,                  // đọc/ghi từ ngoài được",
      "    pub(crate) status: Status,    // chỉ trong crate",
      "    internal_note: String,        // chỉ module model (và con)",
      "}",
      "",
      "pub enum Status { Draft, Paid }   // variant tự pub",
      "",
      "impl Order {",
      "    pub fn new(id: u64) -> Self {  // ngoài crate phải tạo qua new()",
      "        Order { id, status: Status::Draft, internal_note: String::new() }",
      "    }",
      "    pub(super) fn audit(&self) {}  // chỉ module cha (order) gọi được",
      "}"
    ]},
    { id: "use", label: "use & đường dẫn", lines: [
      "// src/order/repo.rs",
      "use std::collections::HashMap;           // import kiểu",
      "use std::io::{self, Write};             // io module + trait Write",
      "use super::model::{Order, Status};      // module cha -> model",
      "use crate::config::DbConfig;            // tuyệt đối từ gốc crate",
      "",
      "pub(crate) fn save(o: &Order, out: &mut impl Write) -> io::Result<()> {",
      "    out.write_all(format!(\"{}\\n\", o.id).as_bytes())   // cần use Write",
      "}",
      "",
      "#[cfg(test)]",
      "mod tests {",
      "    use super::*;                        // test thấy cả hàm private",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                   // Rust",
      "// package com.shop.order;                (vị trí file + 'mod order;' ở cha)",
      "// import com.shop.order.Order;           use crate::order::Order;",
      "// import static java.lang.Math.max;      use std::cmp::max;",
      "// public class Order                     pub struct Order",
      "// (package-private)                      pub(crate)",
      "// private (theo class)                   private (theo MODULE)",
      "// module-info: exports com.shop.api      pub use ... ở lib.rs (re-export)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="root"><div class="nl">🌳 crate (lib.rs)</div><div class="ns">gốc cây module</div></div>
    <div class="arrow" id="a1">↓ mod order; mod config;</div>
    <div class="row">
      <div class="node" id="ord"><div class="nl">📁 order</div><div class="ns">pub mod</div></div>
      <div class="node" id="cfg"><div class="nl">📁 config</div><div class="ns">private</div></div>
    </div>
    <div class="arrow" id="a2">↓ mod model; mod repo;</div>
    <div class="row">
      <div class="node" id="model"><div class="nl">model</div><div class="ns">pub struct Order</div></div>
      <div class="node" id="repo"><div class="nl">repo</div><div class="ns">pub(crate)</div></div>
    </div>
    <div class="arrow" id="a3">↑ pub use lên gốc</div>
    <div class="node" id="api"><div class="nl">🚪 my_crate::Order</div><div class="ns">API gọn cho bên ngoài</div></div>
  `,
  steps: [
    { title: "1 · Module phải khai báo", tab: "tree", highlight: [3, 5, 10], on: ["root", "a1"],
      desc: "Cây module bắt đầu từ lib.rs/main.rs. File chỉ được biên dịch khi module cha có 'mod ten;'." },
    { title: "2 · File ↔ module", tab: "lib", highlight: [2, 3, 13, 14], on: ["ord", "cfg", "a2", "model", "repo"],
      desc: "mod order → src/order.rs; trong đó mod model → src/order/model.rs." },
    { title: "3 · Mức visibility", tab: "vis", highlight: [2, 3, 4, 5, 8, 14], on: ["model"],
      desc: "Field private theo module. pub struct không làm field pub. pub(crate), pub(super) để mở có kiểm soát." },
    { title: "4 · use & đường dẫn", tab: "use", highlight: [2, 3, 4, 5, 8], on: ["repo"],
      desc: "crate:: tuyệt đối, super:: lên cha. Method trait (write_all) chỉ dùng được khi trait Write đã được use." },
    { title: "5 · Re-export", tab: "lib", highlight: [4], on: ["a3", "api"],
      desc: "pub use đưa Order lên gốc crate. Người dùng không cần biết cấu trúc thư mục bên trong." }
  ],

  quiz: [
    { q: "Tạo file <code>src/payment.rs</code> nhưng không viết <code>mod payment;</code> ở đâu cả. Kết quả?", options: [
        "Tự động được biên dịch",
        "File bị bỏ qua, không thuộc crate",
        "Lỗi biên dịch",
        "Chỉ chạy khi test"
      ], correct: 1, explanation: "Rust không tự quét thư mục như Java." },
    { q: "Trong lib.rs có <code>mod order;</code>. Compiler tìm file nào?", options: [
        "src/Order.java",
        "src/order.rs hoặc src/order/mod.rs",
        "order/lib.rs",
        "src/mod/order.rs"
      ], correct: 1, explanation: "order.rs là kiểu mới, order/mod.rs là kiểu cũ." },
    { q: "Mặc định một hàm không có pub được thấy từ đâu?", options: [
        "Toàn crate",
        "Module định nghĩa nó và các module con",
        "Mọi nơi",
        "Chỉ trong impl"
      ], correct: 1, explanation: "Private theo module." },
    { q: "<code>pub struct Order { id: u64 }</code> — code ngoài module đọc <code>order.id</code> được không?", options: [
        "Được vì struct là pub",
        "Không, field id vẫn private; phải ghi pub id",
        "Chỉ đọc được",
        "Được trong cùng crate"
      ], correct: 1, explanation: "Visibility của field tách biệt với struct." },
    { q: "<code>pub(crate)</code> tương đương gần nhất với?", options: [
        "public",
        "Hiển thị trong toàn bộ crate nhưng không ra ngoài",
        "private",
        "protected"
      ], correct: 1, explanation: "Hữu ích cho helper dùng chung nội bộ." },
    { q: "Vì sao <code>out.write_all(...)</code> báo \"method not found\" dù out implement Write?", options: [
        "Sai kiểu",
        "Trait std::io::Write chưa được use vào scope",
        "Thiếu mut",
        "write_all không tồn tại"
      ], correct: 1, explanation: "Method của trait chỉ gọi được khi trait ở trong scope." },
    { q: "<code>pub use order::model::Order;</code> trong lib.rs có tác dụng gì?", options: [
        "Copy struct",
        "Re-export: người dùng gọi được my_crate::Order",
        "Import cho riêng lib.rs",
        "Đổi tên module"
      ], correct: 1, explanation: "Giấu cấu trúc nội bộ, API gọn." },
    { q: "Đường dẫn <code>super::model::Order</code> bắt đầu từ đâu?", options: [
        "Gốc crate", "Module cha của module hiện tại", "Thư viện chuẩn", "Module hiện tại"
      ], correct: 1, explanation: "crate:: là gốc, self:: là hiện tại." },
    { q: "Lợi ích của mẫu lib.rs + main.rs mỏng?", options: [
        "Biên dịch nhanh hơn",
        "Logic nằm ở lib: test được (kể cả integration test), tái dùng; main chỉ khởi động",
        "Bắt buộc bởi cargo",
        "Để có hai binary"
      ], correct: 1, explanation: "Integration test trong tests/ chỉ import được lib crate." }
  ]
});
