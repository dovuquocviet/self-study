window.LESSONS.push({
  id: "18",
  phase: "6", phaseName: "Vận hành production",
  title: "Connection pooling: sqlx pool, PgBouncer & Hyperdrive từ Cloudflare Workers",
  subtitle: "Pool ở app vs pooler ở giữa · session/transaction mode · cái gì hỏng ở transaction mode · kích thước pool",

  theory: `
    <p>Bài 01: mỗi connection là một process đắt. Có hai tầng pooling, thường dùng cả hai:</p>
    <ul>
      <li><strong>Pool trong app</strong> (HikariCP, sqlx <code>PgPool</code>): tái dùng connection giữa các request <em>trong một process</em>. Không giải quyết được 50 pod × 20 connection, hay serverless nơi mỗi isolate tự mở connection.</li>
      <li><strong>Pooler ở giữa</strong> (PgBouncer, Hyperdrive, RDS Proxy…): hàng nghìn connection phía client được dồn vào vài chục connection thật tới PostgreSQL.</li>
    </ul>

    <p><strong>PgBouncer — ba chế độ</strong></p>
    <table>
      <tr><th>Mode</th><th>Connection server được trả lại pool khi</th><th>Nhận xét</th></tr>
      <tr><td>session</td><td>Client ngắt kết nối</td><td>An toàn tuyệt đối, ít tiết kiệm</td></tr>
      <tr><td><strong>transaction</strong></td><td>Transaction kết thúc</td><td>Phổ biến nhất; mọi trạng thái cấp <em>phiên</em> không đáng tin</td></tr>
      <tr><td>statement</td><td>Mỗi câu lệnh</td><td>Cấm transaction nhiều câu</td></tr>
    </table>

    <p><strong>Những thứ hỏng ở transaction mode</strong> (vì câu tiếp theo có thể chạy trên connection server khác):</p>
    <ul>
      <li><code>SET</code> cấp phiên (search_path, timezone...) → dùng <code>SET LOCAL</code> trong transaction hoặc đặt ở role/database.</li>
      <li><code>LISTEN</code>, session advisory lock (bài 14), temp table sống qua nhiều transaction, cursor <code>WITH HOLD</code>.</li>
      <li>Prepared statement cấp protocol (sqlx, JDBC đều dùng): PgBouncer <strong>≥ 1.21</strong> hỗ trợ khi đặt <code>max_prepared_statements</code> &gt; 0; bản cũ hơn sẽ gặp lỗi kiểu "prepared statement ... does not exist/already exists".</li>
    </ul>

    <p><strong>Hyperdrive (Cloudflare)</strong> — pooler + cache đặt ở mạng Cloudflare cho Workers:</p>
    <ul>
      <li>Worker là serverless: mỗi request có thể ở isolate khác, mở TCP + TLS + auth tới DB ở region xa tốn nhiều round-trip. Hyperdrive giữ sẵn pool connection gần database và dùng lại.</li>
      <li>Chạy ở <strong>transaction mode</strong>: <code>SET</code> chỉ sống trong transaction/query, bị reset khi trả connection — cùng các giới hạn như PgBouncer.</li>
      <li>Có <strong>query caching</strong> cho câu đọc (bật mặc định): đọc ngay sau khi ghi có thể thấy dữ liệu cũ. Dùng một binding thứ hai tắt cache cho luồng auth/quyền/đọc-sau-ghi.</li>
      <li>Cách dùng: tạo client <strong>mới mỗi request</strong> bên trong handler (không để global), driver <code>pg</code> hoặc <code>postgres</code> với <code>env.HYPERDRIVE.connectionString</code>, bật <code>nodejs_compat</code>.</li>
    </ul>

    <p><strong>Kích thước pool</strong>: số connection <em>đang chạy</em> hữu ích ≈ vài lần số core của DB (công thức kinh điển của HikariCP: <code>core × 2 + số đĩa</code>). Pool to hơn chỉ chuyển hàng đợi từ app vào trong DB, nơi nó đắt hơn. Tổng (số pod × max_connections của pool) phải nhỏ hơn giới hạn của pooler/DB, chừa chỗ cho migration, admin, replication.</p>

    <div class="callout"><p>💡 Triệu chứng pool quá nhỏ: request chờ <code>acquire</code> (sqlx <code>PoolTimedOut</code>, Hikari "Connection is not available"). Triệu chứng pool/DB quá tải: <code>pg_stat_activity</code> đầy <code>active</code> chờ LWLock/IO. Hai thứ này cần hai cách chữa khác nhau — đo trước khi tăng số.</p></div>
  `,

  codeTabs: [
    { id: "sqlx", label: "① sqlx PgPool", lines: [
      "use sqlx::postgres::{PgConnectOptions, PgPoolOptions};",
      "use std::time::Duration;",
      "",
      "let opts: PgConnectOptions = std::env::var(\"DATABASE_URL\")?.parse()?;",
      "let pool = PgPoolOptions::new()",
      "    .max_connections(10)                        // mặc định 10",
      "    .min_connections(2)",
      "    .acquire_timeout(Duration::from_secs(3))    // mặc định 30s — quá lâu cho API",
      "    .idle_timeout(Duration::from_secs(300))",
      "    .max_lifetime(Duration::from_secs(1800))",
      "    .connect_with(opts.application_name(\"order-svc\"))",
      "    .await?;"
    ]},
    { id: "pgb", label: "② pgbouncer.ini", lines: [
      "[databases]",
      "orders = host=10.0.1.5 port=5432 dbname=orders",
      "",
      "[pgbouncer]",
      "listen_port = 6432",
      "pool_mode = transaction",
      "max_client_conn = 5000          # connection phía client",
      "default_pool_size = 40          # connection thật tới PG cho mỗi cặp user/db",
      "max_prepared_statements = 200   # PgBouncer >= 1.21: hỗ trợ prepared statement",
      "server_idle_timeout = 600",
      "auth_type = scram-sha-256"
    ]},
    { id: "hd", label: "③ Hyperdrive (Worker)", lines: [
      "# wrangler.toml",
      "compatibility_flags = [ \"nodejs_compat\" ]",
      "[[hyperdrive]]",
      "binding = \"HYPERDRIVE\"",
      "id = \"<hyperdrive-id>\"",
      "",
      "// src/index.ts",
      "import { Client } from 'pg';",
      "export default {",
      "  async fetch(req: Request, env: Env): Promise<Response> {",
      "    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });",
      "    await client.connect();                        // nhanh: Hyperdrive giữ pool thật",
      "    const { rows } = await client.query('SELECT id, name FROM products WHERE id = $1', [42]);",
      "    return Response.json(rows);",
      "  },",
      "};"
    ]},
    { id: "break", label: "④ Hỏng ở transaction mode", lines: [
      "-- ❌ SET cấp phiên: câu sau có thể chạy trên connection khác",
      "SET search_path = tenant_42;",
      "SELECT * FROM orders;",
      "",
      "-- ✅ gói trong transaction",
      "BEGIN; SET LOCAL search_path = tenant_42; SELECT * FROM orders; COMMIT;",
      "",
      "-- ✅ hoặc gắn cố định vào role",
      "ALTER ROLE order_svc SET statement_timeout = '5s';",
      "",
      "-- ❌ pg_advisory_lock, LISTEN, temp table qua nhiều tx, cursor WITH HOLD"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="pods"><div class="nl">🦀 50 pod Rust</div><div class="ns">sqlx pool × 10</div></div>
      <div class="node" id="wk"><div class="nl">☁️ Workers</div><div class="ns">client mới mỗi request</div></div>
    </div>
    <div class="arrow" id="a1">↓ hàng nghìn connection phía client</div>
    <div class="row">
      <div class="node" id="pgb"><div class="nl">🎱 PgBouncer</div><div class="ns">transaction mode</div></div>
      <div class="node" id="hd"><div class="nl">⚡ Hyperdrive</div><div class="ns">pool + cache câu đọc</div></div>
    </div>
    <div class="arrow" id="a2">↓ vài chục connection thật</div>
    <div class="node" id="pg"><div class="nl">🐘 PostgreSQL</div><div class="ns">max_connections = 200 · ~40–80 backend bận</div></div>
  `,
  steps: [
    { title: "1 · Pool trong app", tab: "sqlx", highlight: [6, 8, 10, 11], on: ["pods"],
      desc: "Pool trong process. acquire_timeout ngắn để fail nhanh thay vì treo request 30s; application_name giúp nhận diện trong pg_stat_activity." },
    { title: "2 · Nhân lên theo số pod", tab: "sqlx", highlight: [6], on: ["pods", "a1"],
      desc: "50 pod × 10 = 500 connection — vượt max_connections nếu nối thẳng DB. Cần pooler ở giữa." },
    { title: "3 · PgBouncer transaction mode", tab: "pgb", highlight: [6, 7, 8, 9], on: ["pgb", "a2", "pg"],
      desc: "5000 client dồn vào 40 connection thật. Cần bản ≥ 1.21 và max_prepared_statements cho sqlx/JDBC." },
    { title: "4 · Hyperdrive cho Workers", tab: "hd", highlight: [2, 3, 4, 11, 12, 13], on: ["wk", "hd"],
      desc: "Worker tạo client mỗi request; bắt tay tốn kém tới DB được Hyperdrive gánh. Câu đọc có thể được cache — cần binding tắt cache cho dữ liệu nhạy cảm." },
    { title: "5 · Tránh trạng thái phiên", tab: "break", highlight: [2, 6, 9, 11], on: ["pgb", "hd"],
      desc: "Mọi thứ gắn với phiên đều có thể 'rơi' sang connection khác. Dùng SET LOCAL, cấu hình theo role, xact advisory lock." }
  ],

  quiz: [
    { q: "PgBouncer transaction mode trả connection server về pool khi nào?", options: [
        "Khi client ngắt kết nối", "Khi transaction kết thúc", "Sau mỗi câu lệnh", "Không bao giờ"
      ], correct: 1, explanation: "Session mode mới là khi client ngắt." },
    { q: "Thứ nào KHÔNG an toàn qua pooler transaction mode?", options: [
        "SELECT đơn giản",
        "SET search_path cấp phiên rồi dùng ở transaction sau",
        "SET LOCAL trong transaction",
        "pg_advisory_xact_lock"
      ], correct: 1, explanation: "Transaction sau có thể chạy trên connection server khác." },
    { q: "sqlx/JDBC dùng prepared statement cấp protocol. Qua PgBouncer transaction mode cần gì?", options: [
        "Không dùng được PgBouncer",
        "PgBouncer ≥ 1.21 với max_prepared_statements > 0 (hoặc tắt statement có tên ở client)",
        "Chuyển sang statement mode",
        "Tăng default_pool_size"
      ], correct: 1, explanation: "Bản cũ sinh lỗi prepared statement không tồn tại/đã tồn tại." },
    { q: "Vì sao Worker nên tạo client Postgres mới mỗi request khi dùng Hyperdrive?", options: [
        "Vì Worker không có bộ nhớ",
        "Hyperdrive giữ pool connection thật nên kết nối rẻ; giữ client ở global scope qua các request dễ gây lỗi I/O giữa các request",
        "Vì Hyperdrive yêu cầu HTTP",
        "Vì pg không hỗ trợ pool"
      ], correct: 1, explanation: "Theo hướng dẫn của Cloudflare: tạo client bên trong handler." },
    { q: "Hyperdrive query caching có thể gây vấn đề gì?", options: [
        "Mất dữ liệu ghi",
        "Đọc ngay sau khi ghi có thể thấy kết quả cũ đã cache",
        "Deadlock",
        "Lỗi cú pháp"
      ], correct: 1, explanation: "Dùng binding tắt cache cho auth, quyền, đọc-sau-ghi." },
    { q: "Tăng max_connections của pool app từ 10 lên 100 khi DB 8 core đã quá tải CPU sẽ?", options: [
        "Tăng thông lượng tuyến tính",
        "Thường làm tệ hơn: nhiều process tranh CPU/lock hơn",
        "Không đổi gì",
        "Giảm độ trễ"
      ], correct: 1, explanation: "Hàng đợi nên nằm ở pool, không phải trong DB." },
    { q: "acquire_timeout trong sqlx nghĩa là gì?", options: [
        "Thời gian tối đa của một query",
        "Thời gian tối đa chờ lấy được connection từ pool",
        "Thời gian giữ connection rảnh",
        "Tuổi thọ tối đa của connection"
      ], correct: 1, explanation: "Mặc định 30s; API thường nên đặt vài giây để fail nhanh." },
    { q: "Cách đặt statement_timeout bền vững khi đi qua pooler?", options: [
        "SET statement_timeout ở đầu mỗi connection",
        "ALTER ROLE ... SET statement_timeout (hoặc SET LOCAL trong transaction)",
        "Không thể",
        "Sửa trong PgBouncer"
      ], correct: 1, explanation: "Cấu hình theo role áp dụng khi server connection được tạo cho role đó." },
    { q: "Chế độ pooling của Hyperdrive?", options: [
        "Session", "Transaction", "Statement", "Không pool"
      ], correct: 1, explanation: "Connection được trả về pool khi transaction kết thúc; SET bị reset." }
  ]
});
