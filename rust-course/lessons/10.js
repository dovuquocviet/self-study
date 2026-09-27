window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Mô hình dữ liệu",
  title: "Xử lý lỗi thực chiến: toán tử ?, From, thiserror & anyhow",
  subtitle: "? = early return + chuyển kiểu lỗi · thiserror cho thư viện/domain · anyhow cho ứng dụng · context",

  theory: `
    <p>Bài trước viết <code>match</code> cho mọi Result thì rất dài. Toán tử <strong><code>?</code></strong> rút gọn: đặt sau một Result,
    nếu <code>Ok(v)</code> → lấy <code>v</code> đi tiếp; nếu <code>Err(e)</code> → <strong>return sớm</strong> <code>Err(From::from(e))</code> khỏi hàm hiện tại.
    Với Option: None → return None. Hàm dùng <code>?</code> phải trả Result (hoặc Option) tương ứng.</p>

    <p>Điểm tinh tế: <code>?</code> gọi <code>From::from(e)</code> — nên nếu kiểu lỗi của hàm bạn có <code>impl From&lt;sqlx::Error&gt;</code>, lỗi DB tự được chuyển thành lỗi của bạn.
    Tương tự việc Java bắt exception tầng dưới rồi bọc lại, nhưng tự động và tường minh trong kiểu.</p>

    <p><strong>Hai crate gần như tiêu chuẩn</strong>:</p>
    <table>
      <tr><th></th><th><code>thiserror</code></th><th><code>anyhow</code></th></tr>
      <tr><td>Dùng cho</td><td>Thư viện, tầng domain — nơi người gọi cần <em>phân biệt</em> loại lỗi</td><td>Ứng dụng, main, CLI, job — nơi chỉ cần báo lỗi kèm ngữ cảnh</td></tr>
      <tr><td>Kiểu lỗi</td><td>Enum của bạn, <code>#[derive(Error)]</code> sinh <code>Display</code>, <code>Error</code>, <code>From</code></td><td>Một kiểu chung <code>anyhow::Error</code> bọc mọi lỗi</td></tr>
      <tr><td>Giống Java</td><td>Tự định nghĩa hệ exception nghiệp vụ</td><td>Ném <code>RuntimeException</code> bọc cause</td></tr>
      <tr><td>Thêm ngữ cảnh</td><td>Field trong variant</td><td><code>.context("đọc config")</code>, <code>.with_context(|| format!(...))</code></td></tr>
    </table>

    <p><strong>Kiến trúc lỗi trong một service</strong> (giống <code>@ControllerAdvice</code> của Spring): tầng repository/domain trả lỗi có kiểu (thiserror);
    handler HTTP chuyển <code>AppError</code> thành status code (bài 19 với axum: <code>impl IntoResponse for AppError</code>); main/khởi động dùng anyhow.</p>

    <p><strong>Trait <code>std::error::Error</code></strong>: yêu cầu <code>Debug + Display</code>, có <code>source()</code> để lần chuỗi nguyên nhân (như <code>getCause()</code>).
    <code>Box&lt;dyn Error&gt;</code> là cách "lỗi gì cũng được" không cần crate ngoài — ổn cho ví dụ nhỏ.</p>

    <div class="callout"><p>💡 Không có stack trace mặc định như Java. anyhow ghi backtrace nếu bật biến môi trường <code>RUST_BACKTRACE=1</code> (hoặc <code>RUST_LIB_BACKTRACE=1</code>);
    trong service, ngữ cảnh từ <code>.context()</code> + log có cấu trúc (crate tracing) thường hữu ích hơn stack trace.</p></div>
  `,

  codeTabs: [
    { id: "q", label: "Toán tử ?", lines: [
      "use std::fs;",
      "// (read_port_v1 còn unwrap ở dòng 10 — sẽ sửa ở tab From)",
      "",
      "// Không có ?",
      "fn read_port_v1(path: &str) -> Result<u16, std::io::Error> {",
      "    let text = match fs::read_to_string(path) {",
      "        Ok(t) => t,",
      "        Err(e) => return Err(e),",
      "    };",
      "    Ok(text.trim().parse().unwrap())",
      "}",
      "",
      "// Có ?: Ok -> lấy giá trị, Err -> return Err(From::from(e))",
      "fn read_len(path: &str) -> Result<usize, std::io::Error> {",
      "    let text = fs::read_to_string(path)?;",
      "    Ok(text.len())",
      "}"
    ]},
    { id: "this", label: "thiserror", lines: [
      "// Cargo.toml: thiserror = \"2\"",
      "use thiserror::Error;",
      "",
      "#[derive(Debug, Error)]",
      "pub enum OrderError {",
      "    #[error(\"không tìm thấy đơn {0}\")]",
      "    NotFound(u64),",
      "    #[error(\"hết hàng: {sku}\")]",
      "    OutOfStock { sku: String },",
      "    #[error(\"lỗi database\")]",
      "    Db(#[from] sqlx::Error),          // sinh impl From<sqlx::Error>",
      "}",
      "",
      "pub async fn get_order(pool: &PgPool, id: u64) -> Result<Order, OrderError> {",
      "    let row = sqlx::query_as::<_, Order>(\"SELECT * FROM orders WHERE id = $1\")",
      "        .bind(id as i64)",
      "        .fetch_optional(pool).await?;  // sqlx::Error -> OrderError::Db tự động",
      "    row.ok_or(OrderError::NotFound(id))",
      "}"
    ]},
    { id: "any", label: "anyhow", lines: [
      "// Cargo.toml: anyhow = \"1\"",
      "use anyhow::{bail, Context, Result};   // Result<T> = Result<T, anyhow::Error>",
      "",
      "fn load_config(path: &str) -> Result<Config> {",
      "    let raw = std::fs::read_to_string(path)",
      "        .with_context(|| format!(\"không đọc được {path}\"))?;",
      "    let cfg: Config = toml::from_str(&raw).context(\"config sai định dạng\")?;",
      "    if cfg.port == 0 { bail!(\"port không được bằng 0\"); }",
      "    Ok(cfg)",
      "}",
      "",
      "fn main() -> Result<()> {",
      "    let cfg = load_config(\"app.toml\")?;",
      "    println!(\"chạy ở cổng {}\", cfg.port);",
      "    Ok(())",
      "}",
      "// Lỗi in ra: Error: không đọc được app.toml",
      "//            Caused by: No such file or directory (os error 2)"
    ]},
    { id: "from", label: "impl From thủ công", lines: [
      "#[derive(Debug)]",
      "enum AppError { Parse(std::num::ParseIntError), Io(std::io::Error) }",
      "",
      "impl From<std::io::Error> for AppError {",
      "    fn from(e: std::io::Error) -> Self { AppError::Io(e) }",
      "}",
      "impl From<std::num::ParseIntError> for AppError {",
      "    fn from(e: std::num::ParseIntError) -> Self { AppError::Parse(e) }",
      "}",
      "",
      "fn read_port(path: &str) -> Result<u16, AppError> {",
      "    let text = std::fs::read_to_string(path)?;   // io::Error -> AppError",
      "    let port = text.trim().parse::<u16>()?;       // ParseIntError -> AppError",
      "    Ok(port)",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                          // Rust",
      "// int readPort(String p) throws IOException {  fn read_port(p: &str) -> Result<u16, AppError> {",
      "//   String t = Files.readString(Path.of(p));    let t = fs::read_to_string(p)?;",
      "//   return Integer.parseInt(t.trim());           Ok(t.trim().parse()?)",
      "// }                                             }",
      "// class NotFoundException extends RuntimeEx     #[derive(Error)] enum OrderError { NotFound(u64) }",
      "// throw new RuntimeException(\"ctx\", e)         .context(\"ctx\")?",
      "// @ControllerAdvice                             impl IntoResponse for AppError (bài 19)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="call"><div class="nl">📞 fs::read_to_string(path)?</div><div class="ns">Result&lt;String, io::Error&gt;</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ Ok(text)</div><div class="ns">lấy text, chạy tiếp</div></div>
      <div class="node" id="err"><div class="nl">❌ Err(e)</div><div class="ns">return Err(From::from(e))</div></div>
    </div>
    <div class="arrow" id="a1">↓ From chuyển kiểu lỗi</div>
    <div class="row">
      <div class="node" id="te"><div class="nl">🏷️ thiserror</div><div class="ns">enum lỗi có kiểu (domain/lib)</div></div>
      <div class="node" id="ae"><div class="nl">📦 anyhow</div><div class="ns">lỗi chung + context (app)</div></div>
    </div>
    <div class="arrow" id="a2">↓ tầng trên cùng</div>
    <div class="node" id="top"><div class="nl">🌐 HTTP status / log / exit code</div><div class="ns">như @ControllerAdvice</div></div>
  `,
  steps: [
    { title: "1 · Viết tay thì dài", tab: "q", highlight: [6, 7, 8, 9], on: ["call"],
      desc: "match mỗi Result, nhánh Err thì return. Lặp lại khắp nơi." },
    { title: "2 · ? làm hộ", tab: "q", highlight: [13, 15], on: ["ok", "err"],
      desc: "Ok → lấy giá trị. Err → return ngay, sau khi gọi From::from để đổi sang kiểu lỗi của hàm." },
    { title: "3 · From là cầu nối", tab: "from", highlight: [4, 5, 12, 13], on: ["a1"],
      desc: "Có impl From&lt;io::Error&gt; for AppError thì ? tự chuyển. Hai loại lỗi khác nhau cùng đổ về AppError." },
    { title: "4 · thiserror cho domain", tab: "this", highlight: [4, 6, 7, 10, 11, 17, 18], on: ["te"],
      desc: "derive sinh Display từ #[error], sinh From từ #[from]. Người gọi match được NotFound vs Db để trả 404 hay 500." },
    { title: "5 · anyhow cho ứng dụng", tab: "any", highlight: [2, 6, 7, 8, 12], on: ["ae", "a2", "top"],
      desc: "Một kiểu lỗi cho mọi thứ, thêm ngữ cảnh bằng context. main trả Result thì lỗi được in kèm chuỗi 'Caused by'." }
  ],

  quiz: [
    { q: "<code>let t = read()?;</code> khi read() trả <code>Err(e)</code> thì?", options: [
        "Panic",
        "Hàm hiện tại return Err(From::from(e)) ngay",
        "t = giá trị mặc định",
        "Bỏ qua lỗi"
      ], correct: 1, explanation: "? là early return có chuyển kiểu lỗi." },
    { q: "Dùng <code>?</code> trong hàm trả về <code>()</code> (không phải Result/Option) thì sao?", options: [
        "Được", "Lỗi biên dịch", "Panic khi Err", "Cảnh báo"
      ], correct: 1, explanation: "Hàm phải trả kiểu tương thích (Result, Option, hoặc kiểu implement Try)." },
    { q: "Vì sao <code>?</code> đổi được sqlx::Error thành OrderError?", options: [
        "Rust tự đoán",
        "Vì có impl From&lt;sqlx::Error&gt; for OrderError (sinh bởi #[from])",
        "Nhờ reflection",
        "Nhờ cast as"
      ], correct: 1, explanation: "? gọi From::from trên lỗi." },
    { q: "thiserror thích hợp nhất cho?", options: [
        "Hàm main của CLI",
        "Thư viện/tầng domain nơi người gọi cần phân biệt loại lỗi",
        "Script một lần",
        "Test"
      ], correct: 1, explanation: "anyhow hợp cho tầng ứng dụng chỉ cần báo lỗi." },
    { q: "<code>.context(\"đọc config\")</code> của anyhow làm gì?", options: [
        "Bỏ lỗi gốc",
        "Bọc lỗi gốc với thông điệp ngữ cảnh, vẫn giữ lỗi gốc làm nguyên nhân",
        "Ghi log ra file",
        "Retry"
      ], correct: 1, explanation: "Giống new RuntimeException(\"msg\", cause)." },
    { q: "<code>bail!(\"port = 0\")</code> tương đương?", options: [
        "panic!", "return Err(anyhow!(\"port = 0\"))", "println!", "unreachable!()"
      ], correct: 1, explanation: "Macro tiện lợi để trả lỗi sớm." },
    { q: "Trait std::error::Error yêu cầu kiểu phải implement?", options: [
        "Clone + Copy", "Debug + Display", "Send + Sync", "Serialize"
      ], correct: 1, explanation: "Và có thể override source() để trỏ tới nguyên nhân." },
    { q: "Tương đương <code>@ControllerAdvice</code> của Spring trong service axum là gì?", options: [
        "Không có",
        "impl IntoResponse cho kiểu AppError, handler trả Result&lt;_, AppError&gt;",
        "try/catch toàn cục",
        "panic hook"
      ], correct: 1, explanation: "Mỗi variant map sang một status code." },
    { q: "Rust có in stack trace tự động khi trả Err như exception Java không?", options: [
        "Có, luôn luôn",
        "Không; Err chỉ là giá trị. Backtrace cần bật (vd RUST_BACKTRACE=1 với anyhow/panic)",
        "Chỉ trong release",
        "Chỉ trên Linux"
      ], correct: 1, explanation: "Nên dựa vào context + log có cấu trúc." }
  ]
});
