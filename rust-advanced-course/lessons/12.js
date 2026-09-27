window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Service production",
  title: "Xử lý lỗi ở quy mô service: phân tầng, mapping HTTP, không panic",
  subtitle: "lỗi domain (thiserror) vs lỗi hạ tầng · AppError → IntoResponse · problem+json · log một lần ở biên · panic = bug · error chain",

  theory: `
    <p>Nhập môn đã có <code>?</code>, <code>thiserror</code>, <code>anyhow</code>. Khi service lớn lên, câu hỏi không còn là cú pháp mà là <strong>kiến trúc lỗi</strong>:
    tầng nào định nghĩa lỗi gì, ai quyết định HTTP status, log ở đâu để không trùng 5 lần, và làm sao client nhận thông báo hữu ích mà không lộ chi tiết nội bộ.</p>

    <p><strong>1. Phân tầng lỗi</strong></p>
    <table>
      <tr><th>Tầng</th><th>Kiểu lỗi</th><th>Nội dung</th></tr>
      <tr><td>Domain / service</td><td><code>enum OrderError</code> (thiserror)</td><td>Lỗi nghiệp vụ có nghĩa: <code>NotFound</code>, <code>OutOfStock { sku }</code>, <code>AlreadyPaid</code> — người gọi <em>match</em> được</td></tr>
      <tr><td>Hạ tầng</td><td><code>sqlx::Error</code>, <code>reqwest::Error</code>...</td><td>Bọc vào variant <code>#[error(transparent)] Internal(#[from] anyhow::Error)</code> hoặc variant riêng</td></tr>
      <tr><td>HTTP (biên)</td><td><code>AppError</code> + <code>impl IntoResponse</code></td><td>Map sang status + body; <strong>log một lần</strong> ở đây</td></tr>
      <tr><td>main / job</td><td><code>anyhow::Result</code></td><td>Không ai match nữa, chỉ cần context để đọc</td></tr>
    </table>
    <p>So với Spring: <code>enum OrderError</code> ≈ các <code>OrderNotFoundException</code>; <code>impl IntoResponse for AppError</code> ≈ <code>@RestControllerAdvice</code> + <code>@ExceptionHandler</code>.
    Khác biệt: lỗi hiện trong chữ ký hàm, compiler bắt bạn xử lý hoặc chuyển tiếp — không có unchecked exception lẳng lặng bay qua.</p>

    <p><strong>2. Nguyên tắc</strong></p>
    <ul>
      <li><strong>Log một lần, ở biên.</strong> Tầng dưới chỉ <em>thêm context</em> (<code>.context("load order 42")</code>) rồi trả lên. Log ở mọi tầng = 5 dòng log cho một lỗi.</li>
      <li><strong>Không lộ lỗi nội bộ ra client</strong>: 5xx trả message chung + <code>trace_id</code>; chi tiết (câu SQL, stack) nằm trong log. 4xx trả thông điệp nghiệp vụ rõ ràng.</li>
      <li><strong>Mã lỗi ổn định</strong> cho client (mobile!) — <code>"code": "OUT_OF_STOCK"</code> — đừng bắt app parse message tiếng Anh. Chuẩn gợi ý: RFC 9457 <em>Problem Details</em> (<code>application/problem+json</code>).</li>
      <li><strong>Panic = bug</strong>, không phải luồng lỗi. <code>unwrap()</code> chỉ cho invariant đã chứng minh; nên dùng <code>expect("lý do")</code>. Đặt <code>CatchPanicLayer</code> để một panic trả 500 thay vì đóng connection.</li>
      <li>Chuỗi nguyên nhân: <code>{:#}</code> với anyhow in cả chain trên một dòng; <code>{:?}</code> in dạng nhiều dòng kèm backtrace nếu bật <code>RUST_BACKTRACE=1</code>.</li>
    </ul>
    <div class="callout"><p>💡 Kiểm tra nhanh một codebase: đếm <code>.unwrap()</code> ngoài test, tìm handler trả <code>Result&lt;_, String&gt;</code>, tìm <code>tracing::error!</code> ở tầng repository.
    Ba chỗ đó thường là nơi lỗi bị nuốt, bị log trùng, hoặc làm sập request.</p></div>
  `,

  codeTabs: [
    { id: "domain", label: "① Lỗi domain", lines: [
      "#[derive(Debug, thiserror::Error)]",
      "pub enum OrderError {",
      "    #[error(\"order {0} not found\")]",
      "    NotFound(i64),",
      "    #[error(\"sku {sku} out of stock (left {left})\")]",
      "    OutOfStock { sku: String, left: u32 },",
      "    #[error(\"order already paid\")]",
      "    AlreadyPaid,",
      "    #[error(transparent)]",
      "    Internal(#[from] anyhow::Error),          // DB, HTTP... gom vào đây",
      "}",
      "",
      "pub async fn pay(repo: &dyn OrderRepo, id: i64) -> Result<Order, OrderError> {",
      "    let order = repo.find(id).await",
      "        .context(\"load order\")?              // sqlx::Error -> anyhow -> Internal",
      "        .ok_or(OrderError::NotFound(id))?;",
      "    if order.paid { return Err(OrderError::AlreadyPaid); }",
      "    Ok(order)",
      "}"
    ]},
    { id: "http", label: "② AppError → HTTP", lines: [
      "pub struct AppError(OrderError);",
      "impl From<OrderError> for AppError { fn from(e: OrderError) -> Self { Self(e) } }",
      "",
      "impl IntoResponse for AppError {",
      "    fn into_response(self) -> Response {",
      "        let (status, code) = match &self.0 {",
      "            OrderError::NotFound(_)       => (StatusCode::NOT_FOUND, \"ORDER_NOT_FOUND\"),",
      "            OrderError::OutOfStock { .. } => (StatusCode::CONFLICT, \"OUT_OF_STOCK\"),",
      "            OrderError::AlreadyPaid       => (StatusCode::CONFLICT, \"ALREADY_PAID\"),",
      "            OrderError::Internal(e) => {",
      "                tracing::error!(\"internal error: {e:#}\");   // log MỘT lần",
      "                (StatusCode::INTERNAL_SERVER_ERROR, \"INTERNAL\")",
      "            }",
      "        };",
      "        let detail = if status.is_server_error() { \"unexpected error\".to_string() }",
      "                     else { self.0.to_string() };",
      "        (status, [(header::CONTENT_TYPE, \"application/problem+json\")],",
      "         Json(json!({ \"type\": \"about:blank\", \"title\": code, \"status\": status.as_u16(),",
      "                      \"code\": code, \"detail\": detail }))).into_response()",
      "    }",
      "}"
    ]},
    { id: "handler", label: "③ Handler gọn", lines: [
      "async fn pay_order(",
      "    State(s): State<AppState>,",
      "    Path(id): Path<i64>,",
      ") -> Result<Json<Order>, AppError> {",
      "    let order = orders::pay(s.orders.as_ref(), id).await?;   // ? tự From -> AppError",
      "    Ok(Json(order))",
      "}",
      "",
      "// Response 409:",
      "// { \"type\":\"about:blank\", \"title\":\"ALREADY_PAID\", \"status\":409,",
      "//   \"code\":\"ALREADY_PAID\", \"detail\":\"order already paid\" }"
    ]},
    { id: "panic", label: "④ Panic & main", lines: [
      "let app = Router::new()",
      "    .route(\"/orders/{id}/pay\", post(pay_order))",
      "    .layer(tower_http::catch_panic::CatchPanicLayer::new());   // panic -> 500",
      "",
      "#[tokio::main]",
      "async fn main() -> anyhow::Result<()> {",
      "    let cfg = Config::from_env().context(\"read config\")?;",
      "    let pool = PgPool::connect(&cfg.db_url).await",
      "        .with_context(|| format!(\"connect db {}\", cfg.db_host))?;",
      "    // lỗi: 'Error: connect db pg-1: pool timed out ...' + cause chain",
      "    Ok(())",
      "}"
    ]},
    { id: "java", label: "⑤ Đối chiếu Spring", lines: [
      "@ResponseStatus(HttpStatus.CONFLICT)",
      "class AlreadyPaidException extends RuntimeException {}",
      "",
      "@RestControllerAdvice",
      "class Handler {",
      "  @ExceptionHandler(AlreadyPaidException.class)",
      "  ProblemDetail paid(AlreadyPaidException e) {",
      "    return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());",
      "  }",
      "}",
      "// Rust: enum + match vét cạn -> thêm variant mới mà quên map = lỗi biên dịch"
    ]}
  ],

  stageHtml: `
    <div class="node" id="infra"><div class="nl">🗄️ sqlx / reqwest error</div><div class="ns">+ .context(\"load order\")</div></div>
    <div class="arrow" id="a1">↓ ? + From</div>
    <div class="node" id="dom"><div class="nl">📦 OrderError (domain)</div><div class="ns">NotFound · OutOfStock · AlreadyPaid · Internal</div></div>
    <div class="arrow" id="a2">↓ ? + From</div>
    <div class="node" id="app"><div class="nl">🌐 AppError: IntoResponse</div><div class="ns">match → status + code · log 5xx MỘT lần</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="c4"><div class="nl">📱 4xx</div><div class="ns">code ổn định + detail rõ</div></div>
      <div class="node" id="c5"><div class="nl">🙈 5xx</div><div class="ns">message chung, chi tiết ở log</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Lỗi hạ tầng + context", tab: "domain", highlight: [14, 15], on: ["infra", "a1"],
      desc: "Không log ở đây. Chỉ thêm ngữ cảnh rồi đẩy lên; anyhow::Error vào variant Internal nhờ #[from]." },
    { title: "2 · Lỗi domain có nghĩa", tab: "domain", highlight: [2, 4, 6, 8, 10, 16, 17], on: ["dom"],
      desc: "Người gọi match được từng trường hợp. Đây là 'checked exception' nhưng không tốn chi phí stack unwinding." },
    { title: "3 · Map ở biên HTTP", tab: "http", highlight: [6, 7, 8, 9, 10, 11], on: ["a2", "app"],
      desc: "Một chỗ duy nhất quyết định status và mã lỗi. Match vét cạn: thêm variant mà quên map → không biên dịch." },
    { title: "4 · Body an toàn cho client", tab: "http", highlight: [15, 16, 17, 18, 19], on: ["a3", "c4", "c5"],
      desc: "4xx: detail nghiệp vụ. 5xx: message chung. Theo dạng problem+json (RFC 9457) với code ổn định cho app mobile." },
    { title: "5 · Handler chỉ còn luồng chính", tab: "handler", highlight: [4, 5, 6], on: ["app"],
      desc: "Không try/catch. <code>?</code> chuyển OrderError → AppError qua From." },
    { title: "6 · Panic & main", tab: "panic", highlight: [3, 6, 7, 9], on: ["c5"],
      desc: "CatchPanicLayer biến panic thành 500. main dùng anyhow + context để thông báo khởi động dễ đọc." }
  ],

  quiz: [
    { q: "Nên log lỗi ở tầng nào?", options: [
        "Mọi tầng để chắc chắn",
        "Một lần ở biên (khi map sang HTTP/kết thúc job); tầng dưới chỉ thêm context",
        "Chỉ ở repository",
        "Không log"
      ], correct: 1, explanation: "Log mọi tầng tạo nhiều dòng trùng cho một lỗi." },
    { q: "Response 500 nên chứa gì?", options: [
        "Toàn bộ câu SQL và stack trace",
        "Thông báo chung + mã/trace_id; chi tiết chỉ nằm trong log",
        "Không có body",
        "Chuỗi Debug của lỗi"
      ], correct: 1, explanation: "Tránh lộ thông tin nội bộ." },
    { q: "Tương đương @RestControllerAdvice trong axum là?", options: [
        "Middleware bắt panic",
        "impl IntoResponse cho kiểu lỗi ứng dụng (AppError)",
        "Router::fallback",
        "tracing subscriber"
      ], correct: 1, explanation: "Handler trả Result<T, AppError>; axum gọi into_response khi Err." },
    { q: "Vì sao dùng enum thiserror cho lỗi domain thay vì anyhow?", options: [
        "anyhow chậm",
        "Người gọi cần match từng trường hợp để quyết định hành vi (404 vs 409)",
        "anyhow không Send",
        "thiserror bắt buộc với axum"
      ], correct: 1, explanation: "anyhow hợp với nơi chỉ cần báo lỗi, không cần phân nhánh." },
    { q: "Thêm variant mới vào OrderError mà quên xử lý trong match của into_response thì?", options: [
        "Trả 500 mặc định lúc chạy",
        "Lỗi biên dịch non-exhaustive patterns (nếu không có nhánh _)",
        "Panic",
        "Bị bỏ qua"
      ], correct: 1, explanation: "Lý do không nên thêm nhánh _ trong match lỗi." },
    { q: "Chuẩn IETF cho body lỗi HTTP dạng JSON là?", options: [
        "RFC 7231", "RFC 9457 Problem Details (application/problem+json)", "JSON:API", "GraphQL errors"
      ], correct: 1, explanation: "RFC 9457 thay RFC 7807; Spring 6 có ProblemDetail." },
    { q: "Trường 'code' ổn định (OUT_OF_STOCK) có ích gì cho app mobile?", options: [
        "Không ích gì",
        "App rẽ nhánh/hiển thị theo code, không phụ thuộc message có thể đổi hoặc được dịch",
        "Giảm kích thước response",
        "Để SEO"
      ], correct: 1, explanation: "Message là cho người; code là cho máy." },
    { q: "In anyhow::Error với {:#} cho ra gì?", options: [
        "Chỉ lỗi ngoài cùng",
        "Cả chuỗi nguyên nhân trên một dòng, ngăn bằng ': '",
        "Backtrace",
        "JSON"
      ], correct: 1, explanation: "{:?} cho dạng nhiều dòng 'Caused by' và backtrace nếu bật." },
    { q: "CatchPanicLayer của tower-http làm gì?", options: [
        "Ngăn panic xảy ra",
        "Bắt panic trong handler và trả 500 thay vì đóng connection đột ngột",
        "Restart server",
        "Chuyển panic thành log warn"
      ], correct: 1, explanation: "Panic vẫn là bug cần sửa; layer chỉ giảm thiệt hại." },
    { q: "Khi nào unwrap()/expect() chấp nhận được trong code service?", options: [
        "Mọi nơi cho gọn",
        "Khi invariant đã được đảm bảo (vd regex hằng số, lúc khởi động) — ưu tiên expect có lý do",
        "Khi parse input người dùng",
        "Khi gọi DB"
      ], correct: 1, explanation: "Dữ liệu từ bên ngoài không bao giờ nên unwrap." }
  ]
});
