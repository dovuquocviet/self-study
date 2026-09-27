window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Worker bằng Rust",
  title: "Viết Worker bằng Rust với workers-rs (WebAssembly)",
  subtitle: "cargo generate · wasm32-unknown-unknown · worker-build · #[event(fetch)] · Router · bindings từ Rust · feature flags",

  theory: `
    <p>Runtime Workers chạy JavaScript và <strong>WebAssembly (WASM)</strong>. Rust biên dịch được sang WASM, nên có thể viết Worker bằng Rust qua crate
    <strong><code>worker</code></strong> (dự án workers-rs của Cloudflare, bản 0.8 ở thời điểm viết). Cơ chế:</p>
    <ol>
      <li><code>cargo</code> biên dịch crate của bạn (kiểu <code>cdylib</code>) sang target <code>wasm32-unknown-unknown</code>.</li>
      <li><code>worker-build</code> chạy <code>wasm-bindgen</code> để sinh lớp JS "keo" (glue) + file <code>.wasm</code>, chạy <code>wasm-opt</code> để thu nhỏ, xuất ra thư mục <code>build/</code>.</li>
      <li>Wrangler coi <code>build/index.js</code> là entry như một Worker JS bình thường; JS glue nạp WASM và chuyển mỗi sự kiện vào hàm Rust của bạn.</li>
    </ol>

    <p><strong>Macro <code>#[event(...)]</code></strong> đánh dấu handler: <code>fetch</code>, <code>scheduled</code>, <code>queue</code> (cần feature <code>queue</code>), <code>start</code>.
    Chữ ký fetch: <code>async fn fetch(req: Request, env: Env, ctx: Context) -&gt; Result&lt;Response&gt;</code>. Thêm <code>respond_with_errors</code> để lỗi <code>Err</code> tự thành response 500 có message.</p>

    <p><strong>Bindings từ Rust</strong> (qua <code>env</code>, hoặc <code>ctx</code> của Router):</p>
    <ul>
      <li><code>env.var("APP_ENV")?</code>, <code>env.secret("JWT_SECRET")?</code> → dùng <code>.to_string()</code></li>
      <li><code>env.kv("CONFIG")?</code>, <code>env.d1("DB")?</code> (feature <code>d1</code>), <code>env.bucket("MEDIA")?</code>, <code>env.durable_object("CART")?</code>, <code>env.queue("ORDERS")?</code> (feature <code>queue</code>)</li>
    </ul>
    <p>Muốn dùng hệ sinh thái <strong>axum</strong> quen thuộc: bật feature <code>http</code>, handler nhận <code>HttpRequest</code> (kiểu của crate <code>http</code>) và trả <code>http::Response</code>.</p>

    <p><strong>Điều khác so với Rust trên server</strong> (công ty đang chuyển backend sang Rust nên cần nhớ):</p>
    <ul>
      <li>Không có tokio runtime đa luồng, không <code>std::thread</code>, không <code>std::fs</code>, không <code>std::net</code>. Async chạy trên event loop của JS thông qua <code>wasm-bindgen-futures</code>.</li>
      <li>Future của workers-rs là <code>!Send</code> (bọc giá trị JS). Framework đòi <code>Send</code> như axum → dùng macro <code>#[worker::send]</code>.</li>
      <li>Mọi crate phụ thuộc phải biên dịch được sang <code>wasm32-unknown-unknown</code>. <code>std::time::SystemTime::now()</code> sẽ panic trên target này — dùng <code>Date::now()</code> của crate worker.</li>
      <li>Mặc định panic = abort, <strong>làm hỏng cả instance WASM</strong>; request sau trên isolate đó cũng lỗi. <code>worker-build --panic-unwind</code> cho phép bắt panic từng request. Tốt nhất: không <code>unwrap()</code> bừa.</li>
    </ul>

    <div class="callout"><p>💡 Mọi lời gọi binding từ Rust thực chất là gọi sang JS rồi quay lại (qua ranh giới WASM↔JS). Rust nhanh cho <em>tính toán</em>, nhưng
    không làm I/O nhanh hơn — bài 16 so sánh kỹ khi nào đáng dùng.</p></div>
  `,

  codeTabs: [
    { id: "setup", label: "Khởi tạo", lines: [
      "rustup target add wasm32-unknown-unknown",
      "cargo install cargo-generate",
      "cargo generate cloudflare/workers-rs         # chọn template hello-world (hoặc axum)",
      "cd shop-edge-rs",
      "npx wrangler dev                              # chạy build command rồi workerd local",
      "npx wrangler deploy"
    ]},
    { id: "cfg", label: "Cargo.toml + wrangler.toml", lines: [
      "# Cargo.toml",
      "[lib]",
      "crate-type = [\"cdylib\"]",
      "",
      "[dependencies]",
      "worker = { version = \"0.8\", features = [\"d1\"] }",
      "worker-macros = { version = \"0.8\" }",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "",
      "[profile.release]",
      "lto = true",
      "strip = true",
      "codegen-units = 1",
      "",
      "# wrangler.toml",
      "name = \"shop-edge-rs\"",
      "main = \"build/index.js\"",
      "compatibility_date = \"2026-09-01\"",
      "[build]",
      "command = \"cargo install -q 'worker-build@^0.8' && worker-build --release\""
    ]},
    { id: "lib", label: "src/lib.rs", lines: [
      "use serde::{Deserialize, Serialize};",
      "use worker::*;",
      "",
      "#[derive(Deserialize, Serialize)]",
      "struct Product { id: String, name: String, price: i64 }",
      "",
      "#[event(fetch, respond_with_errors)]",
      "async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {",
      "    Router::new()",
      "        .get(\"/health\", |_, _| Response::ok(\"ok\"))",
      "        .get_async(\"/products/:id\", |_req, ctx| async move {",
      "            let id = match ctx.param(\"id\") { Some(v) => v.clone(), None => return Response::error(\"Bad Request\", 400) };",
      "            let db = ctx.env.d1(\"DB\")?;",
      "            let stmt = db.prepare(\"SELECT id, name, price FROM products WHERE id = ?1\").bind(&[id.into()])?;",
      "            match stmt.first::<Product>(None).await? {",
      "                Some(p) => Response::from_json(&p),",
      "                None => Response::error(\"Not found\", 404),",
      "            }",
      "        })",
      "        .run(req, env)",
      "        .await",
      "}"
    ]},
    { id: "cmp", label: "TS ↔ Rust", lines: [
      "// TypeScript                                   // Rust (workers-rs)",
      "export default { async fetch(req, env, ctx) }   #[event(fetch)] async fn fetch(req, env, ctx)",
      "app.get('/products/:id', h)                     Router::new().get_async(\"/products/:id\", h)",
      "c.req.param('id')                               ctx.param(\"id\")",
      "env.DB.prepare(sql).bind(id).first()            env.d1(\"DB\")?.prepare(sql).bind(&[..])?.first(None)",
      "c.json(obj)                                     Response::from_json(&obj)",
      "env.JWT_SECRET                                  env.secret(\"JWT_SECRET\")?.to_string()",
      "console.log({...})                              console_log!(\"...\")"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">🦀 src/lib.rs</div><div class="ns">#[event(fetch)]</div></div>
    <div class="arrow" id="a1">↓ cargo build --target wasm32-unknown-unknown</div>
    <div class="node" id="wb"><div class="nl">🔧 worker-build</div><div class="ns">wasm-bindgen + wasm-opt</div></div>
    <div class="arrow" id="a2">↓ build/index.js + .wasm</div>
    <div class="node" id="rt"><div class="nl">⚙️ workerd</div><div class="ns">JS glue nạp WASM, chuyển sự kiện</div></div>
    <div class="node" id="bind"><div class="nl">🔌 Bindings</div><div class="ns">D1/KV/R2 qua ranh giới WASM↔JS</div></div>
  `,
  steps: [
    { title: "1 · Chuẩn bị toolchain", tab: "setup", highlight: [1, 2, 3], on: ["src"],
      desc: "Cần target WASM và cargo-generate để tạo project từ template chính thức." },
    { title: "2 · Cấu hình build", tab: "cfg", highlight: [3, 6, 17, 20], on: ["a1", "wb"],
      desc: "<code>cdylib</code> để xuất WASM; Wrangler chạy <code>[build].command</code> trước khi dev/deploy; entry là <code>build/index.js</code>." },
    { title: "3 · Handler & Router", tab: "lib", highlight: [7, 8, 9, 10, 11], on: ["src"],
      desc: "<code>respond_with_errors</code> biến <code>Err</code> thành response 500. Router có <code>get</code> (đồng bộ) và <code>get_async</code>." },
    { title: "4 · Gọi D1 từ Rust", tab: "lib", highlight: [12, 13, 14, 15, 16, 17], on: ["a2", "rt", "bind"],
      desc: "Mỗi lời gọi binding đi qua JS. <code>first::&lt;Product&gt;</code> deserialize hàng thành struct nhờ serde." },
    { title: "5 · Đối chiếu với TS", tab: "cmp", highlight: [2, 3, 5, 7], on: ["rt"],
      desc: "Khái niệm y hệt; khác ở cú pháp, xử lý lỗi bằng <code>Result</code>/<code>?</code> và feature flag cho từng binding." }
  ],

  quiz: [
    { q: "Rust chạy trên Workers bằng cơ chế nào?", options: [
        "Workers có runtime Rust native",
        "Biên dịch sang WebAssembly; JS glue do wasm-bindgen sinh ra nạp và gọi WASM",
        "Chạy trong container",
        "Transpile Rust sang JavaScript"
      ], correct: 1, explanation: "worker-build lo phần wasm-bindgen và tối ưu." },
    { q: "Target biên dịch cần cài?", options: [
        "x86_64-unknown-linux-gnu", "wasm32-unknown-unknown", "wasm32-wasi bắt buộc", "aarch64-apple-darwin"
      ], correct: 1, explanation: "rustup target add wasm32-unknown-unknown." },
    { q: "crate-type trong Cargo.toml của Worker Rust?", options: [
        "bin", "cdylib", "staticlib", "proc-macro"
      ], correct: 1, explanation: "Xuất thư viện động dạng WASM." },
    { q: "Vì sao không dùng được tokio đa luồng hay std::thread?", options: [
        "Do license",
        "WASM trên Workers chạy trên event loop JS đơn luồng; target không hỗ trợ thread/net/fs của std",
        "Vì Rust không hỗ trợ async",
        "Được dùng bình thường"
      ], correct: 1, explanation: "Async đi qua wasm-bindgen-futures." },
    { q: "Mặc định một panic trong Worker Rust gây ra gì?", options: [
        "Chỉ request đó lỗi",
        "Abort instance WASM — các request sau trên isolate đó cũng hỏng, trừ khi build với --panic-unwind",
        "Tự retry",
        "Không ảnh hưởng"
      ], correct: 1, explanation: "Tránh unwrap() bừa; dùng Result và ?." },
    { q: "Truy cập D1 từ workers-rs cần gì?", options: [
        "Không cần gì thêm",
        "Bật feature \"d1\" của crate worker, rồi env.d1(\"DB\")?",
        "Driver sqlx",
        "Hyperdrive"
      ], correct: 1, explanation: "Queue cũng cần feature \"queue\"; axum cần \"http\"." },
    { q: "Muốn dùng axum trên Workers, lưu ý nào về Send?", options: [
        "Không có vấn đề",
        "Future của workers-rs là !Send; dùng #[worker::send] để thỏa yêu cầu Send của axum",
        "Phải dùng Arc<Mutex>",
        "axum không chạy được"
      ], correct: 1, explanation: "Giá trị JS không thể gửi giữa thread." },
    { q: "std::time::SystemTime::now() trên wasm32-unknown-unknown?", options: [
        "Trả thời gian đúng",
        "Panic — dùng worker::Date::now() thay thế",
        "Trả 0",
        "Lỗi biên dịch"
      ], correct: 1, explanation: "Target không có nguồn thời gian của OS." },
    { q: "Thuộc tính respond_with_errors trong #[event(fetch, respond_with_errors)] làm gì?", options: [
        "Tắt log lỗi",
        "Khi handler trả Err, tự tạo response 500 kèm thông điệp lỗi",
        "Retry request",
        "Gửi lỗi vào Queue"
      ], correct: 1, explanation: "Tiện cho dev; production nên tự map lỗi sang response rõ ràng." }
  ]
});
