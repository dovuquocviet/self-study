window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Thực chiến backend",
  title: "REST API nhỏ với axum + sqlx — đối chiếu Spring Boot",
  subtitle: "Router · handler là async fn · extractor (Path, Query, Json, State) · PgPool · query_as · AppError → IntoResponse",

  theory: `
    <p>Stack phổ biến cho service Rust: <strong>axum</strong> (web framework của nhóm Tokio, dựng trên hyper + tower) + <strong>sqlx</strong> (truy vấn SQL async, không phải ORM) + <strong>serde</strong> (JSON).
    Không có annotation scanning, không có DI container, không có magic lúc chạy: mọi thứ nối bằng code và được kiểm tra khi biên dịch.</p>

    <table>
      <tr><th>Spring Boot</th><th>axum + sqlx</th></tr>
      <tr><td><code>@RestController</code> + <code>@GetMapping("/products/{id}")</code></td><td><code>Router::new().route("/products/{id}", get(get_one))</code> — axum 0.8 dùng <code>{id}</code> (0.7 dùng <code>:id</code>)</td></tr>
      <tr><td>Method controller</td><td><code>async fn</code> bình thường — tham số là <strong>extractor</strong>, kiểu trả về implement <code>IntoResponse</code></td></tr>
      <tr><td><code>@PathVariable</code>, <code>@RequestParam</code>, <code>@RequestBody</code></td><td><code>Path&lt;T&gt;</code>, <code>Query&lt;T&gt;</code>, <code>Json&lt;T&gt;</code> (T: <code>Deserialize</code>)</td></tr>
      <tr><td>Bean inject (<code>@Autowired DataSource</code>)</td><td><code>State&lt;AppState&gt;</code>; gắn bằng <code>.with_state(...)</code>. AppState phải <code>Clone</code> (PgPool bên trong là Arc nên clone rẻ)</td></tr>
      <tr><td>Jackson</td><td>serde: <code>#[derive(Serialize, Deserialize)]</code></td></tr>
      <tr><td>HikariCP</td><td><code>PgPoolOptions::new().max_connections(10).connect(url)</code></td></tr>
      <tr><td>JdbcTemplate / Spring Data</td><td><code>sqlx::query_as::&lt;_, Product&gt;(sql).bind(..).fetch_one/fetch_optional/fetch_all</code></td></tr>
      <tr><td>Flyway</td><td><code>sqlx migrate add</code> / <code>sqlx::migrate!().run(&amp;pool)</code> (thư mục <code>migrations/</code>)</td></tr>
      <tr><td><code>@ControllerAdvice</code></td><td><code>impl IntoResponse for AppError</code>; handler trả <code>Result&lt;_, AppError&gt;</code> và dùng <code>?</code></td></tr>
      <tr><td>Filter / Interceptor</td><td>tower middleware: <code>.layer(TraceLayer::new_for_http())</code> (tower-http)</td></tr>
    </table>

    <p><strong>Extractor</strong>: axum đọc kiểu tham số để biết lấy gì từ request. Parse lỗi (id không phải số, JSON sai) → axum tự trả 400/422, handler không chạy.
    Extractor tiêu thụ body (<code>Json</code>, <code>String</code>, <code>Bytes</code>) phải là <strong>tham số cuối cùng</strong> — vì body chỉ đọc được một lần.</p>

    <p><strong>sqlx</strong> có hai kiểu API: hàm <code>sqlx::query_as::&lt;_, T&gt;("...")</code> (kiểm tra lúc chạy, T derive <code>FromRow</code>) và macro <code>sqlx::query_as!(T, "...", args)</code>
    — <strong>kiểm tra SQL và kiểu cột với database thật lúc biên dịch</strong> (cần <code>DATABASE_URL</code> khi build, hoặc chạy <code>cargo sqlx prepare</code> để lưu metadata vào <code>.sqlx/</code> cho CI).
    Tham số luôn bind qua <code>$1, $2</code> (Postgres) — không nối chuỗi, không SQL injection.</p>

    <p><strong>Kết quả thực tế</strong>: binary vài MB đến vài chục MB, khởi động vài ms, RAM nền vài MB–vài chục MB — so với JVM Spring Boot hàng trăm MB. Image Docker có thể dựng từ <code>distroless</code>/<code>scratch</code>.</p>

    <div class="callout"><p>💡 Handler axum phải trả future <code>Send</code> (lý do như bài 18). Lỗi compile khó đọc kiểu "the trait Handler is not implemented" thường do: tham số không phải extractor,
    Json không ở cuối, hoặc giữ thứ không Send qua <code>.await</code>. Macro <code>#[axum::debug_handler]</code> (feature <code>macros</code>) cho thông báo lỗi dễ hiểu hơn.</p></div>
  `,

  codeTabs: [
    { id: "toml", label: "Cargo.toml & SQL", lines: [
      "[dependencies]",
      "axum = \"0.8\"",
      "tokio = { version = \"1\", features = [\"full\"] }",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "serde_json = \"1\"",
      "sqlx = { version = \"0.8\", features = [\"runtime-tokio\", \"postgres\", \"macros\", \"migrate\"] }",
      "thiserror = \"2\"",
      "anyhow = \"1\"",
      "",
      "# migrations/20250101000000_products.sql",
      "# CREATE TABLE products (",
      "#   id    BIGSERIAL PRIMARY KEY,",
      "#   name  TEXT   NOT NULL,",
      "#   price BIGINT NOT NULL CHECK (price >= 0)",
      "# );"
    ]},
    { id: "main", label: "main.rs", lines: [
      "use axum::{routing::get, Router};",
      "use sqlx::{postgres::PgPoolOptions, PgPool};",
      "",
      "#[derive(Clone)]",
      "struct AppState { db: PgPool }          // PgPool = Arc bên trong, clone rẻ",
      "",
      "#[tokio::main]",
      "async fn main() -> anyhow::Result<()> {",
      "    let url = std::env::var(\"DATABASE_URL\")?;",
      "    let db = PgPoolOptions::new().max_connections(10).connect(&url).await?;",
      "    sqlx::migrate!().run(&db).await?;      // như Flyway lúc khởi động",
      "",
      "    let app = Router::new()",
      "        .route(\"/products\", get(list).post(create))",
      "        .route(\"/products/{id}\", get(get_one))",
      "        .with_state(AppState { db });",
      "",
      "    let listener = tokio::net::TcpListener::bind(\"0.0.0.0:3000\").await?;",
      "    axum::serve(listener, app).await?;",
      "    Ok(())",
      "}"
    ]},
    { id: "handler", label: "Handler", lines: [
      "use axum::{extract::{Path, Query, State}, http::StatusCode, Json};",
      "use serde::{Deserialize, Serialize};",
      "",
      "#[derive(Serialize, sqlx::FromRow)]",
      "struct Product { id: i64, name: String, price: i64 }",
      "#[derive(Deserialize)]",
      "struct NewProduct { name: String, price: i64 }",
      "#[derive(Deserialize)]",
      "struct Paging { limit: Option<i64> }",
      "",
      "async fn get_one(State(st): State<AppState>, Path(id): Path<i64>)",
      "    -> Result<Json<Product>, AppError> {",
      "    let p = sqlx::query_as::<_, Product>(\"SELECT id, name, price FROM products WHERE id = $1\")",
      "        .bind(id)",
      "        .fetch_optional(&st.db).await?        // sqlx::Error -> AppError::Db",
      "        .ok_or(AppError::NotFound)?;          // None -> 404",
      "    Ok(Json(p))",
      "}",
      "",
      "async fn list(State(st): State<AppState>, Query(pg): Query<Paging>)",
      "    -> Result<Json<Vec<Product>>, AppError> {",
      "    let rows = sqlx::query_as::<_, Product>(\"SELECT id, name, price FROM products ORDER BY id LIMIT $1\")",
      "        .bind(pg.limit.unwrap_or(20)).fetch_all(&st.db).await?;",
      "    Ok(Json(rows))",
      "}",
      "",
      "async fn create(State(st): State<AppState>, Json(input): Json<NewProduct>)  // Json ở CUỐI",
      "    -> Result<(StatusCode, Json<Product>), AppError> {",
      "    if input.price < 0 { return Err(AppError::BadRequest(\"price phải >= 0\".into())); }",
      "    let p = sqlx::query_as::<_, Product>(",
      "        \"INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id, name, price\")",
      "        .bind(&input.name).bind(input.price)",
      "        .fetch_one(&st.db).await?;",
      "    Ok((StatusCode::CREATED, Json(p)))",
      "}"
    ]},
    { id: "err", label: "AppError", lines: [
      "use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};",
      "",
      "#[derive(Debug, thiserror::Error)]",
      "enum AppError {",
      "    #[error(\"không tìm thấy\")]",
      "    NotFound,",
      "    #[error(\"{0}\")]",
      "    BadRequest(String),",
      "    #[error(\"lỗi database\")]",
      "    Db(#[from] sqlx::Error),",
      "}",
      "",
      "impl IntoResponse for AppError {          // = @ControllerAdvice",
      "    fn into_response(self) -> Response {",
      "        let status = match &self {",
      "            AppError::NotFound => StatusCode::NOT_FOUND,",
      "            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,",
      "            AppError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,  // không lộ chi tiết SQL",
      "        };",
      "        (status, Json(serde_json::json!({ \"error\": self.to_string() }))).into_response()",
      "    }",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Spring Boot",
      "// @RestController @RequestMapping(\"/products\")",
      "// class ProductController {",
      "//   @Autowired ProductRepository repo;",
      "//   @GetMapping(\"/{id}\")",
      "//   Product get(@PathVariable long id) {",
      "//     return repo.findById(id).orElseThrow(NotFoundException::new);",
      "//   }",
      "// }",
      "",
      "// axum",
      "// .route(\"/products/{id}\", get(get_one)).with_state(AppState { db })",
      "// async fn get_one(State(st): State<AppState>, Path(id): Path<i64>) -> Result<Json<Product>, AppError>",
      "//     query_as(..).bind(id).fetch_optional(&st.db).await?.ok_or(AppError::NotFound)?"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">🌐 GET /products/42</div><div class="ns">hyper nhận request</div></div>
    <div class="arrow" id="a1">↓ Router khớp /products/{id}</div>
    <div class="node" id="ext"><div class="nl">🧲 Extractor</div><div class="ns">State(db) · Path(42) — sai kiểu → 400</div></div>
    <div class="arrow" id="a2">↓ async fn get_one</div>
    <div class="node" id="db"><div class="nl">🐘 sqlx → PostgreSQL</div><div class="ns">$1 = 42, fetch_optional</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ Ok(Json(p))</div><div class="ns">200 + JSON</div></div>
      <div class="node" id="err"><div class="nl">❌ Err(AppError)</div><div class="ns">IntoResponse → 404 / 500</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Dependency & schema", tab: "toml", highlight: [2, 6, 11, 12, 13, 14], on: ["db"],
      desc: "axum 0.8, sqlx 0.8 với runtime Tokio + Postgres. Migration SQL thuần, như Flyway." },
    { title: "2 · Khởi động: pool, migrate, router", tab: "main", highlight: [5, 10, 11, 13, 14, 15, 16], on: ["req", "a1"],
      desc: "Không có container: tạo pool, chạy migration, đăng ký route, gắn state — tất cả là code thường." },
    { title: "3 · Serve", tab: "main", highlight: [18, 19], on: ["req"],
      desc: "Bind TcpListener của Tokio rồi axum::serve. Mỗi request là một task async trên runtime." },
    { title: "4 · Extractor", tab: "handler", highlight: [11, 20, 27], on: ["ext"],
      desc: "Kiểu tham số quyết định dữ liệu lấy từ đâu. Parse lỗi thì axum trả lỗi 4xx trước khi vào handler. Json luôn đặt cuối." },
    { title: "5 · Truy vấn an toàn", tab: "handler", highlight: [13, 14, 15, 16, 31, 32], on: ["a2", "db", "ok"],
      desc: "Bind tham số $1/$2 — không nối chuỗi. fetch_optional trả Option; ok_or biến None thành 404." },
    { title: "6 · Lỗi → HTTP status", tab: "err", highlight: [10, 13, 15, 16, 17, 18, 20], on: ["err"],
      desc: "? chuyển sqlx::Error thành AppError::Db (nhờ #[from]); IntoResponse map sang status. Lỗi DB trả 500 chung, không lộ SQL." }
  ],

  quiz: [
    { q: "Trong axum 0.8, khai báo route có path param viết thế nào?", options: [
        "/products/:id", "/products/{id}", "/products/<id>", "/products/*id"
      ], correct: 1, explanation: "axum 0.8 đổi sang {id}; :id là cú pháp 0.7." },
    { q: "Tương đương <code>@PathVariable long id</code>?", options: [
        "Query(id): Query&lt;i64&gt;", "Path(id): Path&lt;i64&gt;", "Json(id)", "State(id)"
      ], correct: 1, explanation: "Destructure ngay trong tham số." },
    { q: "Vì sao extractor <code>Json&lt;T&gt;</code> phải là tham số cuối?", options: [
        "Quy ước đặt tên",
        "Nó tiêu thụ body request, mà body chỉ đọc được một lần",
        "Vì Json chậm",
        "Không bắt buộc"
      ], correct: 1, explanation: "Các extractor khác chỉ đọc phần đầu (path, header…)." },
    { q: "Chia sẻ PgPool cho mọi handler như bean Spring bằng cách nào?", options: [
        "Biến static mut",
        "Đặt trong AppState, .with_state(state), handler nhận State&lt;AppState&gt;",
        "Tạo pool mới trong mỗi handler",
        "Dùng thread_local"
      ], correct: 1, explanation: "AppState: Clone; PgPool clone chỉ tăng đếm Arc." },
    { q: "<code>sqlx::query_as!</code> (macro) khác <code>sqlx::query_as</code> (hàm) ở điểm nào?", options: [
        "Macro nhanh hơn lúc chạy",
        "Macro kiểm tra SQL và kiểu cột với DB lúc biên dịch (cần DATABASE_URL hoặc dữ liệu .sqlx offline)",
        "Hàm không hỗ trợ bind",
        "Macro chỉ cho SELECT"
      ], correct: 1, explanation: "cargo sqlx prepare lưu metadata để CI build không cần DB." },
    { q: "Handler trả <code>Result&lt;Json&lt;Product&gt;, AppError&gt;</code>. Điều kiện để axum chấp nhận?", options: [
        "AppError phải derive Debug",
        "AppError phải implement IntoResponse",
        "AppError phải là String",
        "Không có điều kiện"
      ], correct: 1, explanation: "Cả Ok và Err đều phải chuyển được thành Response." },
    { q: "Request <code>GET /products/abc</code> với <code>Path&lt;i64&gt;</code>?", options: [
        "Handler nhận id = 0",
        "axum trả lỗi 400 trước khi gọi handler",
        "Panic",
        "500"
      ], correct: 1, explanation: "Extractor thất bại tự sinh response lỗi." },
    { q: "Vì sao dùng <code>.bind(id)</code> với <code>$1</code> thay vì <code>format!</code> chuỗi SQL?", options: [
        "Đẹp hơn",
        "Tham số gửi riêng (prepared statement) → chống SQL injection, tái dùng plan",
        "Bắt buộc bởi Rust",
        "Nhanh biên dịch"
      ], correct: 1, explanation: "Không bao giờ nối input vào SQL." },
    { q: "Tương đương <code>@ControllerAdvice</code> trong axum?", options: [
        "tower Layer", "impl IntoResponse for AppError", "Router::fallback", "panic hook"
      ], correct: 1, explanation: "Handler dùng ? để đổ mọi lỗi về AppError." },
    { q: "Thông báo \"the trait Handler&lt;_, _&gt; is not implemented\" thường do?", options: [
        "Thiếu tokio",
        "Tham số không phải extractor, Json không ở cuối, hoặc future không Send",
        "Sai port",
        "Thiếu migration"
      ], correct: 1, explanation: "#[axum::debug_handler] giúp thông báo rõ hơn." }
  ]
});
