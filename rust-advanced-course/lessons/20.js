window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Ranh giới: unsafe, FFI, macro, WASM",
  title: "WebAssembly & Cloudflare Workers với workers-rs",
  subtitle: "wasm32 target · wasm-bindgen cầu nối JS · workers-rs: #[event(fetch)], Router, Env, KV · axum không tokio · giới hạn: không thread, không std::net, kích thước bundle",

  theory: `
    <p>WebAssembly (WASM) là định dạng bytecode chạy trong sandbox, nhanh gần native, có ở trình duyệt, Node, và các runtime edge. Rust là một trong những ngôn ngữ biên dịch sang WASM tốt nhất
    (không GC nên binary nhỏ, không cần mang runtime). Với công ty bạn, điểm liên quan trực tiếp là <strong>Cloudflare Workers viết bằng Rust</strong> qua crate <code>worker</code> (workers-rs).</p>

    <p><strong>1. Mô hình chạy của Workers</strong></p>
    <ul>
      <li>Worker chạy trong <strong>V8 isolate</strong> (không phải container): khởi động mili giây, nhiều isolate chung một process. Code Rust được biên dịch thành <code>.wasm</code>, kèm một lớp JS mỏng (shim) do <code>worker-build</code> sinh.</li>
      <li>Target <code>wasm32-unknown-unknown</code>: <strong>một thread</strong>, không có <code>std::thread</code>, <code>std::net</code>, <code>std::fs</code>; <code>std::time::Instant::now()</code> panic (dùng <code>worker::Date</code> hoặc crate <code>web-time</code>).
        I/O đi qua API của runtime: <code>Fetch</code>, KV, R2, D1, Queues, Durable Objects, Hyperdrive...</li>
      <li>Không có Tokio: future được chạy bởi event loop của JS thông qua <code>wasm-bindgen-futures</code> (Future Rust ↔ Promise JS). Vì một thread nên kiểu không cần <code>Send</code>.</li>
      <li>Crate có C code hoặc dùng socket/thread (reqwest bản native, sqlx, rdkafka, tokio full) không biên dịch được. Chọn crate hỗ trợ wasm hoặc dùng API của <code>worker</code>.</li>
    </ul>

    <p><strong>2. wasm-bindgen</strong> — cầu nối Rust ↔ JS: <code>#[wasm_bindgen]</code> xuất hàm Rust cho JS, <code>extern "C"</code> + <code>#[wasm_bindgen]</code> nhập hàm JS; <code>web-sys</code>/<code>js-sys</code> là binding sẵn cho Web API.
    workers-rs xây trên nền này và giấu gần hết chi tiết.</p>

    <p><strong>3. workers-rs</strong></p>
    <ul>
      <li>Entry point: <code>#[event(fetch)] async fn main(req: Request, env: Env, ctx: Context) -&gt; Result&lt;Response&gt;</code>. Có thêm <code>#[event(scheduled)]</code> (cron), <code>#[event(queue)]</code>.</li>
      <li><code>Env</code> cho binding cấu hình trong <code>wrangler.toml</code>: <code>env.kv("CACHE")</code>, <code>env.var("API_BASE")</code>, <code>env.secret("TOKEN")</code>, <code>env.d1("DB")</code>, <code>env.bucket("FILES")</code>.</li>
      <li><code>Router</code> tích hợp sẵn (path dạng <code>/orders/:id</code>) — hoặc bật feature <code>http</code> để dùng <strong>axum</strong> (<code>default-features = false</code>, không tokio) và tái dùng kiến thức bài 14.</li>
      <li><code>ctx.wait_until(fut)</code>: chạy tiếp việc nền (ghi log, cập nhật cache) sau khi đã trả response — thay cho <code>tokio::spawn</code>.</li>
    </ul>

    <p><strong>4. Khi nào Rust, khi nào TypeScript cho Worker?</strong> Rust hợp khi: logic CPU nặng (parse, ảnh, crypto, nén), muốn dùng chung crate với backend Rust (validate, model, pricing), hoặc cần hiệu năng ổn định.
    TypeScript hợp khi: phần lớn là gọi API/KV, cần hệ sinh thái npm, cần hot reload nhanh. Chi phí của Rust: bundle wasm lớn hơn (giới hạn kích thước worker theo gói: 3 MB free, 10 MB trả phí — sau nén),
    build chậm hơn, và mỗi lần vượt ranh giới JS ↔ WASM có chi phí copy dữ liệu.</p>
    <div class="callout"><p>💡 Giảm kích thước wasm: <code>[profile.release] opt-level = "z"</code> (hoặc <code>"s"</code>), <code>lto = true</code>, <code>codegen-units = 1</code>, <code>strip = true</code>; tránh kéo cả <code>regex</code>/<code>chrono</code> đầy đủ nếu không cần.
    Kiểm tra bằng <code>twiggy top</code> để biết hàm nào chiếm chỗ.</p></div>
  `,

  codeTabs: [
    { id: "worker", label: "① Worker cơ bản", lines: [
      "use worker::*;",
      "",
      "#[event(fetch)]",
      "async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {",
      "    Router::new()",
      "        .get_async(\"/price/:sku\", |_req, ctx| async move {",
      "            let sku = ctx.param(\"sku\").unwrap();",
      "            let kv = ctx.kv(\"PRICES\")?;",
      "            match kv.get(sku).json::<Price>().await? {",
      "                Some(p) => Response::from_json(&p),",
      "                None => Response::error(\"Not found\", 404),",
      "            }",
      "        })",
      "        .run(req, env)",
      "        .await",
      "}"
    ]},
    { id: "axum", label: "② axum trên Worker", lines: [
      "# Cargo.toml",
      "[lib]",
      "crate-type = [\"cdylib\"]",
      "[dependencies]",
      "worker = { version = \"0.6\", features = [\"http\"] }",
      "axum = { version = \"0.8\", default-features = false, features = [\"json\"] }",
      "tower-service = \"0.3\"",
      "",
      "// src/lib.rs",
      "use tower_service::Service;                  // để gọi router().call(req)",
      "fn router() -> axum::Router { axum::Router::new().route(\"/\", get(root)) }",
      "",
      "#[event(fetch)]",
      "async fn fetch(req: HttpRequest, _env: Env, _ctx: Context)",
      "    -> Result<http::Response<axum::body::Body>> {",
      "    Ok(router().call(req).await?)",
      "}"
    ]},
    { id: "wrangler", label: "③ wrangler.toml", lines: [
      "name = \"pricing-edge\"",
      "main = \"build/worker/shim.mjs\"",
      "compatibility_date = \"2025-09-01\"",
      "",
      "[build]",
      "command = \"cargo install -q worker-build && worker-build --release\"",
      "",
      "[[kv_namespaces]]",
      "binding = \"PRICES\"",
      "id = \"<kv-namespace-id>\"",
      "",
      "[vars]",
      "API_BASE = \"https://api.example.com\"",
      "",
      "# npx wrangler dev   |   npx wrangler deploy"
    ]},
    { id: "limits", label: "④ Giới hạn wasm32", lines: [
      "// KHÔNG chạy trên wasm32-unknown-unknown:",
      "std::thread::spawn(|| {});                 // không có thread",
      "std::net::TcpStream::connect(\"db:5432\");   // không có socket thô",
      "std::time::Instant::now();                 // panic",
      "tokio::spawn(async {});                    // không có tokio runtime",
      "",
      "// Thay bằng:",
      "let now = Date::now().as_millis();         // worker::Date",
      "let resp = Fetch::Url(url).send().await?;  // fetch của runtime",
      "ctx.wait_until(async move { log_to_r2(ev).await; });   // việc nền sau response",
      "",
      "# [profile.release] opt-level = \"z\"  lto = true  codegen-units = 1  strip = true"
    ]},
    { id: "share", label: "⑤ Dùng chung crate", lines: [
      "workspace/",
      "├── pricing-core/     # logic thuần: không tokio, không IO -> build được mọi target",
      "├── order-svc/        # axum + tokio + sqlx       (x86_64/aarch64 linux)",
      "├── pricing-edge/     # workers-rs                (wasm32-unknown-unknown)",
      "└── pricing-mobile/   # UniFFI                    (android .so, ios .a)",
      "",
      "// pricing-core/Cargo.toml: chỉ serde, thiserror — IO nằm ở crate ngoài cùng",
      "// Kiểm tra: cargo build -p pricing-core --target wasm32-unknown-unknown"
    ]}
  ],

  stageHtml: `
    <div class="node" id="rs"><div class="nl">🦀 Rust (workers-rs)</div><div class="ns">#[event(fetch)] · Router / axum</div></div>
    <div class="arrow" id="a1">↓ worker-build → .wasm + shim.mjs</div>
    <div class="node" id="iso"><div class="nl">🧊 V8 isolate tại edge</div><div class="ns">1 thread · không tokio · Future ↔ Promise</div></div>
    <div class="arrow" id="a2">↓ binding trong Env</div>
    <div class="row">
      <div class="node" id="kv"><div class="nl">🗄️ KV / R2 / D1</div><div class="ns">env.kv(\"PRICES\")</div></div>
      <div class="node" id="fe"><div class="nl">🌐 Fetch</div><div class="ns">gọi origin / API</div></div>
    </div>
    <div class="node" id="core"><div class="nl">📦 pricing-core</div><div class="ns">crate thuần dùng chung: backend · edge · mobile</div></div>
  `,
  steps: [
    { title: "1 · Entry point & Router", tab: "worker", highlight: [3, 4, 5, 6, 14], on: ["rs"],
      desc: "Macro <code>#[event(fetch)]</code> sinh phần xuất cho JS. Router của workers-rs dùng cú pháp <code>:sku</code>." },
    { title: "2 · Đọc KV qua binding", tab: "worker", highlight: [7, 8, 9, 10, 11], on: ["a2", "kv"],
      desc: "Binding PRICES khai báo trong wrangler.toml; <code>.json::&lt;Price&gt;()</code> dùng serde." },
    { title: "3 · Build & cấu hình", tab: "wrangler", highlight: [2, 6, 8, 9, 12, 13], on: ["a1", "iso"],
      desc: "worker-build biên dịch sang wasm32 và sinh shim.mjs; wrangler deploy tải lên." },
    { title: "4 · Tái dùng axum", tab: "axum", highlight: [5, 6, 10, 11, 14, 16], on: ["rs"],
      desc: "Feature http cho Request/Response chuẩn của crate http; axum tắt default features để không kéo tokio." },
    { title: "5 · Biết giới hạn", tab: "limits", highlight: [2, 3, 4, 5, 8, 9, 10, 12], on: ["iso", "fe"],
      desc: "Không thread, không socket, không Instant, không tokio. Dùng Date, Fetch, wait_until. Tối ưu kích thước bằng opt-level z + lto." },
    { title: "6 · Một core, ba đích", tab: "share", highlight: [2, 3, 4, 5, 8], on: ["core"],
      desc: "Tách logic thuần khỏi IO để cùng crate chạy ở backend, edge và mobile (UniFFI bài 18)." }
  ],

  quiz: [
    { q: "Cloudflare Worker viết bằng Rust chạy dưới dạng gì?", options: [
        "Binary Linux trong container",
        "Module WebAssembly trong V8 isolate, kèm shim JS",
        "JVM bytecode",
        "Process native trên edge"
      ], correct: 1, explanation: "worker-build biên dịch sang wasm32-unknown-unknown." },
    { q: "Vì sao không dùng tokio::spawn trong workers-rs?", options: [
        "Tokio quá chậm",
        "Target wasm32 không có thread/tokio runtime; future chạy trên event loop JS qua wasm-bindgen-futures",
        "Cloudflare cấm async",
        "Có dùng được bình thường"
      ], correct: 1, explanation: "Việc nền sau response dùng ctx.wait_until." },
    { q: "std::time::Instant::now() trên wasm32-unknown-unknown?", options: [
        "Trả 0", "Panic", "Chạy đúng", "Lỗi biên dịch"
      ], correct: 1, explanation: "Dùng worker::Date hoặc crate web-time." },
    { q: "Truy cập KV namespace trong Worker Rust thế nào?", options: [
        "Kết nối TCP tới Redis",
        "Qua binding khai báo trong wrangler.toml: env.kv(\"PRICES\") / ctx.kv(...)",
        "Đọc file",
        "Biến môi trường"
      ], correct: 1, explanation: "Mọi tài nguyên đi qua binding của runtime." },
    { q: "Dùng axum trong Worker cần gì?", options: [
        "Không thể",
        "Bật feature http (và axum) của worker; axum với default-features = false để không kéo tokio",
        "Cài tokio full",
        "Dùng hyper server"
      ], correct: 1, explanation: "Router axum được gọi như một tower Service." },
    { q: "Crate nào dưới đây KHÔNG dùng được trong Worker Rust?", options: [
        "serde", "thiserror", "sqlx với Postgres qua TCP (bản tokio)", "serde_json"
      ], correct: 2, explanation: "Không có socket thô; dùng Hyperdrive/D1/fetch thay thế." },
    { q: "Vì sao kiểu trong workers-rs thường không cần Send?", options: [
        "Rust bỏ Send cho wasm",
        "Isolate chạy một thread nên không có chia sẻ giữa thread",
        "Do macro tự impl",
        "Vì dùng Arc"
      ], correct: 1, explanation: "Nhiều kiểu JsValue vốn !Send." },
    { q: "Cấu hình giảm kích thước file wasm?", options: [
        "opt-level = 3, debug = true",
        "opt-level = \"z\" (hoặc \"s\"), lto = true, codegen-units = 1, strip = true",
        "panic = \"unwind\"",
        "Thêm nhiều feature"
      ], correct: 1, explanation: "Worker có giới hạn kích thước bundle; twiggy giúp tìm hàm chiếm chỗ." },
    { q: "Thiết kế để dùng chung logic giữa backend, Worker và mobile?", options: [
        "Copy code",
        "Crate core thuần (không IO, không tokio) + các crate vỏ cho từng môi trường",
        "Viết lại bằng TypeScript",
        "Dùng Java"
      ], correct: 1, explanation: "Kiểm tra bằng cargo build --target wasm32-unknown-unknown cho core." },
    { q: "Khi nào TypeScript thường hợp hơn Rust cho Worker?", options: [
        "Khi xử lý ảnh/crypto nặng",
        "Khi chủ yếu gọi API/KV, cần hệ sinh thái npm và vòng phát triển nhanh",
        "Khi cần dùng chung crate với backend Rust",
        "Không bao giờ"
      ], correct: 1, explanation: "Rust tốn bundle lớn hơn, build chậm hơn, và có chi phí vượt ranh giới JS↔WASM." }
  ]
});
