window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Vận hành",
  title: "Chống cạn tài nguyên (DoS) ở tầng dữ liệu",
  subtitle: "statement_timeout · connection limit & pooling · Redis maxmemory/maxclients · Mongo maxTimeMS · ClickHouse max_memory_usage · Kafka quota · giới hạn của D1/Workers · giới hạn ở tầng API",

  theory: `
    <p>Tính sẵn sàng (Availability) là một phần của bảo mật. Một DB có thể bị "đánh sập" mà không cần lỗ hổng: chỉ cần một truy vấn không có giới hạn, một endpoint cho phép
    <code>page_size=10000000</code>, một client mở hàng nghìn kết nối, hoặc một lệnh quét toàn bộ key. Kẻ tấn công biết điều này — và lỗi của chính ứng dụng cũng gây ra y hệt.</p>

    <p><strong>1. Các loại tài nguyên có thể cạn</strong></p>
    <table>
      <tr><th>Tài nguyên</th><th>Nguyên nhân thường gặp</th><th>Hậu quả</th></tr>
      <tr><td>Kết nối</td><td>mỗi request mở kết nối mới, pool quá lớn × số instance, kết nối treo</td><td>"too many connections" — mọi service cùng chết</td></tr>
      <tr><td>CPU / thời gian</td><td>truy vấn không index, <code>LIKE '%x%'</code> trên bảng lớn, regex phức tạp, <code>KEYS *</code></td><td>truy vấn khác xếp hàng, timeout dây chuyền</td></tr>
      <tr><td>Bộ nhớ</td><td>GROUP BY/JOIN lớn (ClickHouse), Redis không <code>maxmemory</code>, kết quả trả về quá lớn</td><td>OOM killer giết tiến trình DB</td></tr>
      <tr><td>Khoá (lock)</td><td>transaction mở lâu, <code>idle in transaction</code>, migration khoá bảng</td><td>ghi bị chặn toàn bộ</td></tr>
      <tr><td>Đĩa</td><td>log/WAL/topic không retention, bảng tạm lớn</td><td>DB ngừng ghi</td></tr>
      <tr><td>Băng thông / I/O</td><td>một consumer đọc lại toàn bộ topic, export lớn giờ cao điểm</td><td>các client khác chậm</td></tr>
    </table>

    <p><strong>2. Giới hạn ở tầng API — tuyến đầu</strong></p>
    <ul>
      <li>Phân trang bắt buộc, <code>limit</code> tối đa (ví dụ 100), ưu tiên <em>keyset pagination</em> (<code>WHERE id &gt; last_id</code>) thay vì <code>OFFSET</code> lớn.</li>
      <li>Giới hạn độ dài/kích thước input (chuỗi tìm kiếm, mảng ID, khoảng thời gian tối đa của báo cáo).</li>
      <li>Rate limit theo user/IP/tenant; hàng đợi cho tác vụ nặng (export) thay vì chạy đồng bộ.</li>
    </ul>

    <p><strong>3. Giới hạn ở tầng DB — lưới an toàn khi API sót</strong></p>
    <table>
      <tr><th>Engine</th><th>Thời gian</th><th>Bộ nhớ / dữ liệu</th><th>Kết nối / đồng thời</th></tr>
      <tr><td>PostgreSQL</td><td><code>statement_timeout</code>, <code>lock_timeout</code>, <code>idle_in_transaction_session_timeout</code> (đặt theo role)</td><td><code>work_mem</code> hợp lý, <code>temp_file_limit</code></td><td><code>max_connections</code>, <code>ALTER ROLE ... CONNECTION LIMIT</code>, PgBouncer</td></tr>
      <tr><td>Redis</td><td><code>busy-reply-threshold</code> (Lua/function chạy lâu), <code>timeout</code> kết nối nhàn rỗi</td><td><code>maxmemory</code> + policy, <code>client-output-buffer-limit</code>, <code>proto-max-bulk-len</code></td><td><code>maxclients</code>; cấm <code>KEYS</code> (dùng <code>SCAN</code>)</td></tr>
      <tr><td>MongoDB</td><td><code>maxTimeMS</code> mỗi truy vấn; <code>defaultMaxTimeMS</code> (bản mới)</td><td>giới hạn kết quả, <code>allowDiskUse</code> có kiểm soát</td><td><code>net.maxIncomingConnections</code>, <code>maxPoolSize</code> ở driver</td></tr>
      <tr><td>ClickHouse</td><td><code>max_execution_time</code></td><td><code>max_memory_usage</code>, <code>max_rows_to_read</code>, <code>max_result_rows</code>, <code>max_server_memory_usage_to_ram_ratio</code></td><td><code>max_concurrent_queries_for_user</code>, <code>max_connections</code>, quota</td></tr>
      <tr><td>Kafka</td><td><code>request_percentage</code></td><td><code>message.max.bytes</code>, <code>producer_byte_rate</code>/<code>consumer_byte_rate</code>, retention</td><td><code>max.connections.per.ip</code>, <code>max.connections</code>, <code>connection_creation_rate</code></td></tr>
      <tr><td>Cloudflare</td><td>Giới hạn CPU/thời gian của Worker, giới hạn thời gian truy vấn D1</td><td>Giới hạn kích thước D1 database, giá trị KV</td><td>Durable Object xử lý tuần tự; binding Rate Limiting; WAF rate limit</td></tr>
    </table>

    <p><strong>4. Connection pooling — tính toán thay vì đoán</strong></p>
    <p>Tổng kết nối = <em>số instance × pool mỗi instance</em>. 50 pod × pool 20 = 1.000 kết nối — vượt xa mức một Postgres chịu được. Dùng pooler (PgBouncer ở chế độ transaction, Hyperdrive cho Workers),
    đặt <code>CONNECTION LIMIT</code> theo role để một service lỗi không chiếm hết kết nối của service khác, và giữ một phần kết nối dự phòng cho admin (<code>superuser_reserved_connections</code>).</p>

    <p><strong>5. Đặt timeout theo từng role, không chỉ toàn cục</strong></p>
    <p>API trực tuyến cần timeout ngắn (vài giây); job báo cáo cần dài hơn. Postgres cho phép <code>ALTER ROLE app_orders SET statement_timeout = '5s'</code>; ClickHouse gắn giới hạn vào settings profile theo user;
    Mongo đặt <code>maxTimeMS</code> ở tầng repository. Timeout ở DB cũng phải nhỏ hơn timeout ở API để DB huỷ truy vấn thay vì chạy tiếp sau khi client đã bỏ đi.</p>

    <div class="callout"><p>💡 Đưa "truy vấn xấu nhất có thể" vào test tải: page_size tối đa, khoảng thời gian dài nhất, chuỗi tìm kiếm dài nhất, nhiều request đồng thời từ một tenant.
    Mục tiêu: hệ thống từ chối hoặc cắt ngắn có kiểm soát, không sập — và tenant khác không bị ảnh hưởng.</p></div>
  `,

  codeTabs: [
    { id: "api", label: "🧱 Giới hạn ở API", lines: [
      "// Phân trang bắt buộc + limit tối đa + keyset",
      "limit = clamp(parseInt(q.limit) or 20, 1, 100)",
      "after = q.after ? parseUuid(q.after) : null",
      "rows  = db.query('SELECT id, name FROM products WHERE tenant_id = $1 AND ($2::uuid IS NULL OR id > $2) ORDER BY id LIMIT $3',",
      "                 [tenant, after, limit])",
      "",
      "// Giới hạn phạm vi báo cáo",
      "if days_between(q.from, q.to) > 90: return 400",
      "",
      "// Chuỗi tìm kiếm và danh sách ID",
      "if len(q.search) > 100 or len(q.ids) > 100: return 400",
      "",
      "// Tác vụ nặng -> hàng đợi, không chạy đồng bộ trong request",
      "enqueue('export', { tenant, from, to })"
    ]},
    { id: "pg", label: "🐘 Postgres", lines: [
      "-- Timeout theo role",
      "ALTER ROLE app_orders SET statement_timeout = '5s';",
      "ALTER ROLE app_orders SET lock_timeout = '2s';",
      "ALTER ROLE app_orders SET idle_in_transaction_session_timeout = '30s';",
      "ALTER ROLE reporting_ro SET statement_timeout = '120s';",
      "",
      "-- Giới hạn kết nối theo role",
      "ALTER ROLE app_orders CONNECTION LIMIT 80;",
      "ALTER ROLE reporting_ro CONNECTION LIMIT 10;",
      "",
      "# postgresql.conf",
      "max_connections = 300",
      "superuser_reserved_connections = 5",
      "temp_file_limit = '10GB'",
      "",
      "# pgbouncer.ini",
      "pool_mode = transaction",
      "default_pool_size = 40",
      "max_client_conn = 2000"
    ]},
    { id: "redismongo", label: "🟥 Redis & 🍃 Mongo", lines: [
      "# redis.conf",
      "maxmemory 2gb",
      "maxmemory-policy allkeys-lru",
      "maxclients 5000",
      "timeout 300",
      "busy-reply-threshold 5000                  # ms; Lua/function chạy quá lâu",
      "client-output-buffer-limit normal 256mb 64mb 60",
      "# ACL: -keys (dùng SCAN có COUNT thay cho KEYS *)",
      "",
      "# mongod.conf",
      "net:",
      "  maxIncomingConnections: 2000",
      "",
      "// Mongo: mọi truy vấn có maxTimeMS + limit",
      "db.orders.find({ tenantId: t, status: 'open' }).sort({ _id: 1 }).limit(100).maxTimeMS(3000)",
      "const client = new MongoClient(uri, { maxPoolSize: 20 })"
    ]},
    { id: "chk", label: "🟨 ClickHouse & 📨 Kafka", lines: [
      "-- ClickHouse: giới hạn theo profile của user",
      "ALTER SETTINGS PROFILE bi_profile SETTINGS",
      "    max_memory_usage = 10000000000, max_execution_time = 60,",
      "    max_rows_to_read = 5000000000, max_result_rows = 1000000, result_overflow_mode = 'throw',",
      "    max_concurrent_queries_for_user = 5;",
      "<!-- config.xml: chặn tổng bộ nhớ server -->",
      "<max_server_memory_usage_to_ram_ratio>0.8</max_server_memory_usage_to_ram_ratio>",
      "",
      "# Kafka server.properties",
      "message.max.bytes=1048588",
      "max.connections.per.ip=200",
      "# quota mặc định cho mọi user",
      "kafka-configs.sh ... --alter --entity-type users --entity-default \\",
      "  --add-config 'producer_byte_rate=1048576,consumer_byte_rate=2097152,request_percentage=25'"
    ]},
    { id: "cf", label: "☁️ Cloudflare", lines: [
      "# wrangler.toml: binding Rate Limiting",
      "[[ratelimits]]",
      "name = \"API_LIMIT\"",
      "# (bản wrangler cũ: [[unsafe.bindings]] với type = 'ratelimit')",
      "namespace_id = \"1001\"",
      "simple = { limit = 100, period = 60 }",
      "",
      "// Worker: giới hạn theo tenant trước khi chạm D1",
      "const { success } = await env.API_LIMIT.limit({ key: 'tenant:' + session.tenantId })",
      "if (!success) return new Response('Too Many Requests', { status: 429 })",
      "",
      "// D1: truy vấn luôn có LIMIT và dùng index; kiểm tra truy vấn tốn tài nguyên",
      "// wrangler d1 insights shop-prod --sort-by time"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">👤 Client / kẻ tấn công</div><div class="ns">nhiều request · page_size lớn · truy vấn nặng</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="apil"><div class="nl">🧱 Tầng API</div><div class="ns">rate limit · limit tối đa · khoảng thời gian · hàng đợi</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="pool"><div class="nl">🔌 Pooler</div><div class="ns">PgBouncer · Hyperdrive · maxPoolSize</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="time"><div class="nl">⏱️ Thời gian</div><div class="ns">statement_timeout · maxTimeMS · max_execution_time</div></div>
      <div class="node" id="mem"><div class="nl">🧠 Bộ nhớ</div><div class="ns">maxmemory · max_memory_usage</div></div>
      <div class="node" id="conn"><div class="nl">🔗 Kết nối</div><div class="ns">CONNECTION LIMIT · maxclients · quota</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Tuyến đầu: giới hạn ở API", tab: "api", highlight: [2, 3, 4, 8, 11, 14], on: ["client", "a1", "apil"],
      desc: "Limit tối đa, keyset pagination, giới hạn khoảng thời gian và độ dài input; tác vụ nặng chuyển vào hàng đợi." },
    { title: "2 · Postgres: timeout theo role", tab: "pg", highlight: [2, 3, 4, 5], on: ["time"],
      desc: "API cần timeout ngắn, báo cáo dài hơn. <code>idle_in_transaction_session_timeout</code> giải phóng khoá do transaction bị bỏ quên." },
    { title: "3 · Kết nối: tính toán và pool", tab: "pg", highlight: [8, 9, 12, 13, 17, 18, 19], on: ["pool", "conn"],
      desc: "CONNECTION LIMIT theo role để một service lỗi không chiếm hết; chừa kết nối cho admin; PgBouncer chế độ transaction." },
    { title: "4 · Redis & Mongo", tab: "redismongo", highlight: [2, 4, 5, 6, 8, 12, 15, 16], on: ["mem", "time", "conn"],
      desc: "Redis: maxmemory, maxclients, giới hạn Lua, cấm KEYS. Mongo: maxIncomingConnections, mọi truy vấn có <code>limit</code> và <code>maxTimeMS</code>." },
    { title: "5 · ClickHouse & Kafka", tab: "chk", highlight: [3, 4, 5, 7, 10, 11, 14], on: ["mem", "conn"],
      desc: "ClickHouse giới hạn bộ nhớ/thời gian/dòng đọc theo profile và tổng bộ nhớ server. Kafka giới hạn kích thước message, kết nối mỗi IP và quota." },
    { title: "6 · Cloudflare: rate limit trước khi chạm dữ liệu", tab: "cf", highlight: [2, 3, 4, 6, 9, 10, 13], on: ["apil", "time"],
      desc: "Binding Rate Limiting theo tenant; truy vấn D1 luôn có LIMIT và index; <code>wrangler d1 insights</code> tìm truy vấn tốn tài nguyên." }
  ],

  quiz: [
    { q: "Vì sao tính sẵn sàng (availability) là một phần của bảo mật DB?", options: [
        "DB bị làm cạn tài nguyên khiến dịch vụ ngừng — kẻ tấn công có thể cố ý gây ra mà không cần lỗ hổng",
        "Không phải, đó chỉ là vấn đề hiệu năng",
        "Vì DB chậm thì dữ liệu bị lộ",
        "Vì tuân thủ yêu cầu"
      ], correct: 0,
      explanation: "CIA: Confidentiality, Integrity, Availability." },
    { q: "50 instance, mỗi instance pool 20 kết nối Postgres. Vấn đề là gì?", options: [
        "Không có vấn đề",
        "Postgres tự gộp kết nối",
        "Pool quá nhỏ",
        "Tổng 1.000 kết nối có thể vượt max_connections; cần pooler và CONNECTION LIMIT theo role"
      ], correct: 3,
      explanation: "Tổng kết nối = số instance × pool mỗi instance." },
    { q: "idle_in_transaction_session_timeout giải quyết vấn đề gì?", options: [
        "Truy vấn chậm",
        "Phiên mở transaction rồi bỏ đó, giữ khoá và chặn thao tác khác",
        "Đăng nhập sai",
        "Đĩa đầy"
      ], correct: 1,
      explanation: "Transaction bị bỏ quên là nguồn gây nghẽn khoá phổ biến." },
    { q: "Lệnh Redis nào nên chặn vì có thể làm treo server với dữ liệu lớn?", options: [
        "KEYS * (dùng SCAN thay thế)",
        "GET",
        "SET",
        "EXPIRE"
      ], correct: 0,
      explanation: "Redis đơn luồng: một lệnh quét toàn bộ key chặn mọi client khác." },
    { q: "Mongo maxTimeMS dùng để làm gì?", options: [
        "Đặt TTL cho document",
        "Giới hạn số kết nối",
        "Giới hạn thời gian chạy của một truy vấn, server huỷ khi vượt",
        "Giới hạn kích thước document"
      ], correct: 2,
      explanation: "Đặt ở tầng repository cho mọi truy vấn." },
    { q: "ClickHouse setting nào chặn một truy vấn dùng quá nhiều RAM?", options: [
        "max_threads",
        "max_memory_usage",
        "readonly",
        "log_queries"
      ], correct: 1,
      explanation: "Kết hợp max_server_memory_usage_to_ram_ratio để bảo vệ cả server." },
    { q: "Timeout ở DB nên đặt thế nào so với timeout của API?", options: [
        "Lớn hơn nhiều",
        "Bằng 0",
        "Không cần timeout ở DB",
        "Nhỏ hơn, để DB tự huỷ truy vấn thay vì chạy tiếp sau khi client đã bỏ đi"
      ], correct: 3,
      explanation: "Truy vấn 'mồ côi' tiếp tục tiêu tốn tài nguyên." },
    { q: "Keyset pagination (WHERE id > last_id) tốt hơn OFFSET lớn vì sao?", options: [
        "Dễ viết hơn",
        "OFFSET không an toàn về injection",
        "OFFSET lớn buộc DB đọc và bỏ qua nhiều dòng — tốn tài nguyên và bị lợi dụng; keyset dùng index đi thẳng tới vị trí",
        "Keyset trả nhiều dòng hơn"
      ], correct: 2,
      explanation: "OFFSET 10.000.000 là một cách làm chậm DB dễ dàng." },
    { q: "Kafka quota theo user giúp gì?", options: [
        "Một client không thể chiếm hết băng thông/thời gian xử lý của broker",
        "Mã hoá message",
        "Tăng retention",
        "Tạo topic tự động"
      ], correct: 0,
      explanation: "producer_byte_rate, consumer_byte_rate, request_percentage." }
  ]
});
