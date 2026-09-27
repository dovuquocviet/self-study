window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Ứng dụng & tổng kết",
  title: "Client Rust: crate clickhouse — insert theo batch, query có kiểu",
  subtitle: "#[derive(Row)] · insert().await · Inserter gom theo số hàng/thời gian · bind tham số · so với JDBC",

  theory: `
    <p>Khi chuyển backend sang Rust, service cần ghi/đọc ClickHouse dùng crate chính thức <code>clickhouse</code> (clickhouse-rs, dùng giao thức HTTP, định dạng RowBinary).
    Ví dụ dưới theo API bản 0.14 — bản 0.13 trở về trước <code>insert()</code> không phải async; kiểm tra docs.rs đúng phiên bản bạn dùng.</p>

    <p><strong>Ánh xạ kiểu</strong>: struct derive <code>Row</code> + serde. Thứ tự và tên field khớp cột.</p>
    <table>
      <tr><th>ClickHouse</th><th>Rust</th></tr>
      <tr><td>UInt64 / Int32 / Float64</td><td><code>u64</code> / <code>i32</code> / <code>f64</code></td></tr>
      <tr><td>String, LowCardinality(String)</td><td><code>String</code> (hoặc <code>&amp;str</code> khi đọc)</td></tr>
      <tr><td>UUID</td><td><code>uuid::Uuid</code> + <code>#[serde(with = "clickhouse::serde::uuid")]</code></td></tr>
      <tr><td>DateTime / DateTime64(3)</td><td><code>time::OffsetDateTime</code> + <code>clickhouse::serde::time::datetime</code> / <code>datetime64::millis</code></td></tr>
      <tr><td>Nullable(T)</td><td><code>Option&lt;T&gt;</code></td></tr>
      <tr><td>Tiền</td><td>lưu <code>Int64</code> đơn vị nhỏ nhất ↔ <code>i64</code> cho đơn giản</td></tr>
    </table>

    <p><strong>Ba cách ghi</strong></p>
    <ol>
      <li><code>client.insert::&lt;T&gt;("table").await?</code> → <code>write(&amp;row)</code> nhiều lần → <code>end()</code>: một INSERT, một part. Không gọi <code>end()</code> thì insert bị huỷ.</li>
      <li><code>client.inserter::&lt;T&gt;("table")</code> (feature <code>inserter</code>) với <code>with_max_rows</code>, <code>with_max_bytes</code>, <code>with_period</code>:
      tự cắt thành nhiều INSERT theo ngưỡng — hợp với service consume Kafka chạy liên tục. Gọi <code>commit()</code> định kỳ để nó kiểm tra ngưỡng; <code>end()</code> khi tắt.</li>
      <li>Insert nhỏ lẻ + <code>with_option("async_insert", "1")</code>: để server gom (bài 12).</li>
    </ol>

    <p><strong>Đọc</strong>: <code>client.query("SELECT ?fields FROM t WHERE x = ?").bind(v)</code> — <code>?fields</code> tự thay bằng danh sách field của struct,
    <code>?</code> được bind an toàn (chống SQL injection). <code>fetch_all</code>, <code>fetch_one</code>, hoặc <code>fetch()</code> để stream bằng cursor khi kết quả lớn.</p>

    <div class="callout"><p>💡 So với Java: Inserter ≈ <code>JdbcTemplate.batchUpdate</code> + một <code>@Scheduled</code> flush, gói sẵn. Điểm cần nhớ: <strong>commit offset Kafka chỉ sau khi insert/commit của Inserter thành công</strong> —
    cùng tư duy at-least-once như Kafka engine, và bảng đích vẫn phải chịu trùng.</p></div>
  `,

  codeTabs: [
    { id: "cargo", label: "① Cargo & client", lines: [
      "# Cargo.toml",
      "[dependencies]",
      "clickhouse = { version = \"0.14\", features = [\"inserter\", \"uuid\", \"time\", \"rustls-tls\"] }",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "tokio = { version = \"1\", features = [\"full\"] }",
      "uuid = \"1\"",
      "time = \"0.3\"",
      "",
      "// main.rs",
      "let client = clickhouse::Client::default()",
      "    .with_url(\"https://ch.internal:8443\")",
      "    .with_user(\"ingest_svc\")",
      "    .with_password(std::env::var(\"CH_PASSWORD\")?)",
      "    .with_database(\"analytics\");"
    ]},
    { id: "row", label: "② Row", lines: [
      "use clickhouse::Row;",
      "use serde::{Deserialize, Serialize};",
      "",
      "#[derive(Row, Serialize, Deserialize, Debug)]",
      "pub struct AppEvent {",
      "    #[serde(with = \"clickhouse::serde::uuid\")]",
      "    pub event_id: uuid::Uuid,",
      "    pub user_id: u64,",
      "    pub event: String,              // LowCardinality(String)",
      "    pub amount_cents: i64,",
      "    #[serde(with = \"clickhouse::serde::time::datetime64::millis\")]",
      "    pub ts: time::OffsetDateTime,   // DateTime64(3)",
      "}"
    ]},
    { id: "insert", label: "③ Insert & Inserter", lines: [
      "// một batch = một INSERT",
      "let mut insert = client.insert::<AppEvent>(\"app_events\").await?;",
      "for e in &batch { insert.write(e).await?; }",
      "insert.end().await?;                       // không end() = huỷ",
      "",
      "// service chạy liên tục: tự cắt theo ngưỡng",
      "let mut inserter = client.inserter::<AppEvent>(\"app_events\")",
      "    .with_max_rows(100_000)",
      "    .with_period(Some(std::time::Duration::from_secs(5)));",
      "",
      "while let Some(msg) = consumer.recv().await {",
      "    inserter.write(&parse(&msg)?).await?;",
      "    let stats = inserter.commit().await?;   // flush nếu chạm ngưỡng",
      "    if stats.rows > 0 { consumer.commit_offsets().await?; }",
      "}",
      "inserter.end().await?;"
    ]},
    { id: "query", label: "④ Query", lines: [
      "#[derive(Row, Deserialize)]",
      "struct Daily { day: u16, orders: u64 }   // Date = số ngày từ 1970 (u16)",
      "",
      "let rows = client",
      "    .query(\"SELECT toDate(ts) AS day, count() AS orders",
      "            FROM app_events WHERE user_id = ? AND ts >= now() - INTERVAL 30 DAY",
      "            GROUP BY day ORDER BY day\")",
      "    .bind(42_u64)",
      "    .fetch_all::<Daily>()",
      "    .await?;",
      "",
      "client.query(\"OPTIMIZE TABLE tmp FINAL\").execute().await?;   // DDL/lệnh"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">📨 Kafka consumer (rdkafka)</div></div>
    <div class="arrow" id="a1">↓ parse → AppEvent</div>
    <div class="node" id="ins"><div class="nl">🦀 Inserter</div><div class="ns">gom tới 100k hàng hoặc 5 giây</div></div>
    <div class="arrow" id="a2">↓ HTTP RowBinary + LZ4</div>
    <div class="node" id="ch"><div class="nl">🟨 ClickHouse</div><div class="ns">1 part / lần flush</div></div>
    <div class="arrow" id="a3">↓ flush OK</div>
    <div class="node" id="commit"><div class="nl">✅ commit offset Kafka</div><div class="ns">at-least-once</div></div>
  `,
  steps: [
    { title: "1 · Cấu hình client", tab: "cargo", highlight: [3, 10, 11, 12, 13, 14], on: ["ch"],
      desc: "Bật feature inserter/uuid/time/tls. Client rẻ để clone, dùng chung cho cả ứng dụng (giống DataSource bean)." },
    { title: "2 · Struct ánh xạ cột", tab: "row", highlight: [4, 6, 7, 11, 12], on: ["a1"],
      desc: "derive(Row) + serde; UUID và DateTime64 cần serde helper tương ứng." },
    { title: "3 · Insert một batch", tab: "insert", highlight: [2, 3, 4], on: ["ins", "a2", "ch"],
      desc: "Một INSERT cho cả batch. Quên end() thì dữ liệu không được ghi." },
    { title: "4 · Inserter cho luồng liên tục", tab: "insert", highlight: [7, 8, 9, 12, 13], on: ["k", "ins"],
      desc: "Inserter tự bắt đầu INSERT mới khi chạm số hàng hoặc thời gian — tránh too many parts." },
    { title: "5 · Commit offset sau khi ghi", tab: "insert", highlight: [13, 14, 16], on: ["a3", "commit"],
      desc: "Chỉ commit Kafka khi Inserter đã flush thành công. Minh hoạ đơn giản: thực tế cần theo dõi offset nào đã nằm trong batch đã flush." },
    { title: "6 · Query có kiểu, bind an toàn", tab: "query", highlight: [2, 5, 6, 8, 9], on: ["ch"],
      desc: "bind() chống injection; kết quả map thẳng vào struct. Date đọc ra là số ngày (u16) hoặc dùng serde time::date." }
  ],

  quiz: [
    { q: "Crate clickhouse (chính thức) giao tiếp với server bằng gì?", options: [
        "JDBC", "HTTP với định dạng RowBinary", "gRPC", "Kafka"
      ], correct: 1, explanation: "Có nén LZ4 mặc định." },
    { q: "Điều gì xảy ra nếu không gọi insert.end()?", options: [
        "Dữ liệu vẫn được ghi",
        "INSERT bị huỷ, dữ liệu không được ghi",
        "Server treo",
        "Tự retry"
      ], correct: 1, explanation: "end() hoàn tất request INSERT." },
    { q: "Inserter khác insert() thế nào?", options: [
        "Không khác",
        "Tự chia thành nhiều INSERT theo ngưỡng số hàng/byte/thời gian — hợp cho luồng liên tục",
        "Chỉ insert 1 hàng",
        "Dùng giao thức native"
      ], correct: 1, explanation: "Cần gọi commit() định kỳ để kiểm tra ngưỡng, end() khi dừng." },
    { q: "Ánh xạ cột UUID sang Rust thế nào?", options: [
        "String thuần, không cần gì",
        "uuid::Uuid với #[serde(with = \"clickhouse::serde::uuid\")]",
        "u128 luôn luôn",
        "Không hỗ trợ"
      ], correct: 1, explanation: "Cần feature uuid." },
    { q: "?fields trong câu query làm gì?", options: [
        "Bind tham số",
        "Tự thay bằng danh sách field của struct Row",
        "Chọn mọi cột",
        "Chống trùng"
      ], correct: 1, explanation: "Giữ SELECT khớp với struct." },
    { q: "Vì sao dùng .bind() thay vì format! chuỗi SQL?", options: [
        "Nhanh hơn",
        "Chống SQL injection và escape đúng kiểu",
        "Bắt buộc với DDL",
        "Để dùng FINAL"
      ], correct: 1, explanation: "Giống PreparedStatement trong JDBC." },
    { q: "Khi consume Kafka bằng service Rust, commit offset lúc nào?", options: [
        "Ngay khi nhận message",
        "Sau khi dữ liệu chứa message đó đã được flush thành công vào ClickHouse",
        "Trước khi parse",
        "Không cần commit"
      ], correct: 1, explanation: "At-least-once; bảng đích vẫn cần chịu trùng." },
    { q: "Muốn server tự gom các insert nhỏ từ client Rust?", options: [
        "with_option(\"async_insert\", \"1\")",
        "with_database(\"async\")",
        "Không thể",
        "Tăng max_threads"
      ], correct: 0, explanation: "Có thể kèm wait_for_async_insert = 1." },
    { q: "Tiền tệ ánh xạ đơn giản và an toàn nhất giữa ClickHouse và Rust?", options: [
        "Float32 ↔ f32",
        "Int64 đơn vị nhỏ nhất (xu) ↔ i64",
        "String ↔ String",
        "Float64 ↔ f64"
      ], correct: 1, explanation: "Tránh sai số float và rắc rối ánh xạ Decimal." }
  ]
});
