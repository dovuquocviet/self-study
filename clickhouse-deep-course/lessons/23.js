window.LESSONS.push({
  id: "23",
  phase: "6", phaseName: "Ứng dụng & tổng kết",
  title: "Tổng kết: thiết kế pipeline analytics đơn hàng từ Kafka tới dashboard",
  subtitle: "checklist thiết kế bảng · chọn engine · ingest · đọc đúng · vận hành — ôn tập cả khoá",

  theory: `
    <p>Bài toán: service Order (Rust, Postgres) phát event <code>orders.v1</code> lên Kafka mỗi khi đơn đổi trạng thái. Cần dashboard doanh thu theo tenant/kênh/ngày,
    tra cứu trạng thái đơn trong analytics, giữ dữ liệu chi tiết 1 năm.</p>

    <p><strong>Checklist thiết kế (theo thứ tự)</strong></p>
    <ol>
      <li><strong>Liệt kê truy vấn chính</strong> trước khi viết DDL (bài 03).</li>
      <li><strong>Dữ liệu là event bất biến hay trạng thái thay đổi?</strong> Event → MergeTree. Trạng thái → ReplacingMergeTree(ver) (bài 08), hoặc VersionedCollapsing nếu cần tổng chính xác không FINAL (bài 10).</li>
      <li><strong>ORDER BY</strong> = khoá lọc chính + khoá khử trùng; cột thay đổi không nằm trong đó.</li>
      <li><strong>PARTITION BY</strong> theo tháng của cột <em>không đổi</em> (created_at); vài chục–vài trăm partition (bài 04).</li>
      <li><strong>Kiểu</strong>: LowCardinality cho status/channel, kiểu số nhỏ nhất, tránh Nullable, codec cho cột lớn (bài 05).</li>
      <li><strong>Ingest</strong>: Kafka engine + MV (hoặc ClickPipes / service Rust + Inserter); batch lớn; error mode stream/DLQ; chịu at-least-once (bài 12–15, 22).</li>
      <li><strong>Tổng hợp</strong>: MV incremental sang SummingMergeTree/AggregatingMergeTree cho dashboard; refreshable MV cho top-N cần JOIN (bài 09, 13).</li>
      <li><strong>Đọc đúng</strong>: FINAL hoặc argMax; không lọc cột thay đổi trước khi khử trùng; luôn GROUP BY khi đọc bảng Summing/Aggregating (bài 11).</li>
      <li><strong>Làm giàu</strong>: dictionary từ Postgres thay vì JOIN (bài 16).</li>
      <li><strong>Vòng đời</strong>: TTL + ttl_only_drop_parts, tiered storage (bài 19). Tránh mutation trong luồng thường (bài 18).</li>
      <li><strong>Vận hành</strong>: replica + Keeper, sharding key = khoá khử trùng (bài 20); user/profile/quota riêng (bài 21); theo dõi part, query_log, kafka_consumers (bài 12, 14, 17).</li>
    </ol>

    <table>
      <tr><th>Triệu chứng</th><th>Nguyên nhân thường gặp</th><th>Bài</th></tr>
      <tr><td>TOO_MANY_PARTS</td><td>Insert nhỏ lẻ, partition cardinality cao</td><td>04, 12</td></tr>
      <tr><td>Số liệu dashboard lớn hơn thực tế</td><td>Đọc bảng Replacing không FINAL; Kafka giao lại</td><td>08, 11, 15</td></tr>
      <tr><td>Query quét toàn bảng</td><td>Điều kiện không khớp ORDER BY</td><td>03, 07, 17</td></tr>
      <tr><td>MEMORY_LIMIT_EXCEEDED</td><td>JOIN bảng phải lớn, GROUP BY cardinality cao</td><td>16, 21</td></tr>
      <tr><td>Ingest đứng, lag Kafka tăng</td><td>Poison message, MV lỗi kiểu</td><td>15</td></tr>
      <tr><td>Bảng tổng hợp thiếu dữ liệu cũ</td><td>MV chỉ thấy insert mới, chưa backfill</td><td>13</td></tr>
    </table>

    <div class="callout"><p>💡 Tư duy kỹ sư: ClickHouse đẩy phần lớn "đúng đắn" sang <em>thiết kế</em> (khoá, engine, luồng ghi) thay vì runtime (transaction, UNIQUE, UPDATE).
    Mỗi quyết định trong checklist trên đều trả lời được bằng câu "merge chạy lúc nào không biết, part bất biến, đọc ít byte là nhanh".</p></div>
  `,

  codeTabs: [
    { id: "raw", label: "① Bảng trạng thái", lines: [
      "CREATE TABLE orders ON CLUSTER analytics",
      "(",
      "    order_id     UInt64,",
      "    tenant_id    UInt32,",
      "    channel      LowCardinality(String),",
      "    status       LowCardinality(String),",
      "    amount_cents Int64,",
      "    created_at   DateTime,",
      "    updated_at   DateTime64(3),",
      "    is_deleted   UInt8 DEFAULT 0",
      ")",
      "ENGINE = ReplicatedReplacingMergeTree(updated_at, is_deleted)",
      "PARTITION BY toYYYYMM(created_at)",
      "ORDER BY (tenant_id, order_id)",
      "TTL created_at + INTERVAL 1 YEAR DELETE",
      "SETTINGS ttl_only_drop_parts = 1;"
    ]},
    { id: "ingest", label: "② Ingest", lines: [
      "CREATE TABLE orders_queue (... cột dạng String ...)",
      "ENGINE = Kafka SETTINGS kafka_broker_list = 'kafka-1:9092',",
      "    kafka_topic_list = 'orders.v1', kafka_group_name = 'ch-orders',",
      "    kafka_format = 'JSONEachRow', kafka_handle_error_mode = 'stream';",
      "",
      "CREATE MATERIALIZED VIEW orders_mv TO orders AS",
      "SELECT toUInt64(order_id) AS order_id, toUInt32(tenant_id) AS tenant_id,",
      "       channel, status, toInt64(amount_cents) AS amount_cents,",
      "       parseDateTimeBestEffort(created_at) AS created_at,",
      "       parseDateTime64BestEffort(updated_at, 3) AS updated_at,",
      "       toUInt8(is_deleted) AS is_deleted",
      "FROM orders_queue WHERE length(_error) = 0;",
      "-- + orders_dlq_mv ghi _raw_message/_error (bài 15)"
    ]},
    { id: "agg", label: "③ Tổng hợp", lines: [
      "-- event PAID là append-only -> tổng hợp an toàn bằng MV",
      "CREATE TABLE revenue_daily",
      "(",
      "    day Date, tenant_id UInt32, channel LowCardinality(String),",
      "    orders UInt64, revenue_cents Int64",
      ")",
      "ENGINE = ReplicatedSummingMergeTree",
      "ORDER BY (tenant_id, day, channel);",
      "",
      "CREATE MATERIALIZED VIEW revenue_daily_mv TO revenue_daily AS",
      "SELECT toDate(updated_at) AS day, tenant_id, channel,",
      "       count() AS orders, sum(amount_cents) AS revenue_cents",
      "FROM orders WHERE status = 'PAID'",
      "GROUP BY day, tenant_id, channel;",
      "-- lưu ý: Kafka giao lại sự kiện PAID sẽ bị cộng 2 lần -> chấp nhận sai số",
      "-- hoặc đối soát định kỳ bằng refreshable MV đọc orders FINAL"
    ]},
    { id: "read", label: "④ Đọc", lines: [
      "-- dashboard (profile có final = 1, readonly, max_execution_time = 30)",
      "SELECT day, sum(orders), sum(revenue_cents) / 100 AS revenue",
      "FROM revenue_daily",
      "WHERE tenant_id = 7 AND day >= today() - 30",
      "GROUP BY day ORDER BY day;",
      "",
      "-- tra cứu trạng thái đơn",
      "SELECT status, updated_at FROM orders FINAL",
      "WHERE tenant_id = 7 AND order_id = 1001;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="svc"><div class="nl">🦀 Order service → Postgres</div><div class="ns">phát orders.v1 (key = order_id)</div></div>
    <div class="arrow" id="a1">↓ Kafka (at-least-once)</div>
    <div class="node" id="q"><div class="nl">🔌 orders_queue + MV</div><div class="ns">error mode stream → DLQ</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="orders"><div class="nl">📦 orders (ReplicatedReplacing)</div><div class="ns">partition tháng · TTL 1 năm</div></div>
    <div class="arrow" id="a3">↓ MV tổng hợp</div>
    <div class="node" id="rev"><div class="nl">📊 revenue_daily (Summing)</div></div>
    <div class="arrow" id="a4">↓ user readonly + profile + quota</div>
    <div class="node" id="dash"><div class="nl">📈 Grafana / API</div><div class="ns">GROUP BY khi đọc · FINAL khi tra cứu</div></div>
  `,
  steps: [
    { title: "1 · Chọn engine & khoá", tab: "raw", highlight: [12, 13, 14], on: ["orders"],
      desc: "Trạng thái đơn thay đổi → Replacing(updated_at, is_deleted). ORDER BY là khoá khử trùng, partition theo created_at." },
    { title: "2 · Vòng đời trong DDL", tab: "raw", highlight: [15, 16], on: ["orders"],
      desc: "TTL 1 năm + ttl_only_drop_parts: xoá dữ liệu cũ bằng cách bỏ nguyên part." },
    { title: "3 · Ingest chịu lỗi", tab: "ingest", highlight: [4, 6, 12, 13], on: ["svc", "a1", "q", "a2"],
      desc: "Kafka engine + MV ép kiểu; message lỗi sang DLQ; trùng do at-least-once được Replacing xử lý." },
    { title: "4 · Tổng hợp cho dashboard", tab: "agg", highlight: [7, 10, 13, 15, 16], on: ["a3", "rev"],
      desc: "MV tính doanh thu theo ngày. Ghi rõ giới hạn: sự kiện bị giao lại làm cộng trùng — chọn chấp nhận hay đối soát." },
    { title: "5 · Đọc đúng, có rào chắn", tab: "read", highlight: [1, 2, 5, 8, 9], on: ["a4", "dash"],
      desc: "Bảng Summing luôn GROUP BY; bảng Replacing dùng FINAL; user dashboard bị giới hạn bởi profile và quota." }
  ],

  quiz: [
    { q: "Bước đầu tiên khi thiết kế bảng ClickHouse?", options: [
        "Chọn codec",
        "Liệt kê các truy vấn chính để chọn ORDER BY",
        "Tạo cluster 10 shard",
        "Viết MV"
      ], correct: 1, explanation: "ORDER BY không đổi được và quyết định hiệu năng lọc." },
    { q: "Trạng thái đơn hàng thay đổi nhiều lần, cần tra cứu bản mới nhất. Engine?", options: [
        "MergeTree + ALTER UPDATE", "ReplacingMergeTree(updated_at)", "Log", "Null"
      ], correct: 1, explanation: "Insert phiên bản mới, khử trùng khi merge/FINAL." },
    { q: "Partition bảng orders theo cột nào?", options: [
        "updated_at", "created_at (không đổi)", "order_id", "status"
      ], correct: 1, explanation: "Để mọi phiên bản cùng partition." },
    { q: "Dashboard đếm đơn lớn hơn thực tế. Nguyên nhân khả dĩ nhất?", options: [
        "Nén sai",
        "Đọc bảng Replacing không dùng FINAL/khử trùng, còn phiên bản cũ và bản giao lại từ Kafka",
        "Thiếu skip index",
        "TTL quá ngắn"
      ], correct: 1, explanation: "Merge chưa chạy nên vẫn còn trùng." },
    { q: "TOO_MANY_PARTS khi ingest. Hướng xử lý đúng?", options: [
        "Tăng parts_to_throw_insert",
        "Batch lớn hơn / async_insert / sửa partition key",
        "Tắt merge",
        "Thêm replica"
      ], correct: 1, explanation: "Giảm số part được tạo." },
    { q: "Materialized view incremental thấy dữ liệu nào?", options: [
        "Toàn bộ bảng nguồn",
        "Chỉ block vừa được insert vào bảng nguồn",
        "Dữ liệu trong Keeper",
        "Kết quả query trước"
      ], correct: 1, explanation: "Dữ liệu cũ cần backfill." },
    { q: "Ngữ nghĩa giao nhận của Kafka engine?", options: [
        "Exactly-once", "At-least-once", "At-most-once", "Không đảm bảo"
      ], correct: 1, explanation: "Commit offset sau khi ghi xong." },
    { q: "Message JSON hỏng làm ingest đứng. Giải pháp bền vững?", options: [
        "kafka_skip_broken_messages rất lớn",
        "kafka_handle_error_mode = 'stream' (hoặc dead_letter_queue) và MV tách lỗi sang bảng DLQ",
        "Xoá topic",
        "Restart ClickHouse"
      ], correct: 1, explanation: "Không mất dấu vết message lỗi." },
    { q: "Làm giàu event với tên/plan của tenant nằm trong Postgres?", options: [
        "JOIN trực tiếp Postgres mỗi query",
        "Dictionary nguồn PostgreSQL + dictGet (có thể ngay trong MV)",
        "Copy tay mỗi ngày",
        "Nullable"
      ], correct: 1, explanation: "Nạp vào RAM, tự làm mới theo LIFETIME." },
    { q: "Xoá dữ liệu quá 1 năm rẻ nhất?", options: [
        "ALTER DELETE hằng đêm",
        "TTL + partition theo tháng + ttl_only_drop_parts",
        "Lightweight UPDATE",
        "OPTIMIZE FINAL"
      ], correct: 1, explanation: "Bỏ nguyên part, không viết lại." },
    { q: "Trên cluster nhiều shard, sharding key cho bảng Replacing orders?", options: [
        "rand()", "cityHash64(order_id)", "now()", "status"
      ], correct: 1, explanation: "Mọi phiên bản của một đơn về cùng shard để khử trùng." },
    { q: "Query dashboard chạy lâu và chiếm hết RAM ảnh hưởng ingest. Làm gì?", options: [
        "Tăng RAM vô hạn",
        "User riêng với settings profile (max_memory_usage, max_execution_time, max_threads) và quota",
        "Tắt ingest",
        "Xoá query_log"
      ], correct: 1, explanation: "Cô lập tài nguyên theo nhóm người dùng." },
    { q: "Lọc WHERE status = 'PAID' trước GROUP BY order_id với argMax sai vì?", options: [
        "argMax không hỗ trợ String",
        "Bắt phiên bản cũ PAID của đơn nay đã đổi trạng thái",
        "Chậm",
        "Không sai"
      ], correct: 1, explanation: "Khử trùng trước, lọc cột thay đổi sau." },
    { q: "Muốn đếm user khác nhau theo giờ và gộp được qua các batch?", options: [
        "SummingMergeTree cột users",
        "AggregatingMergeTree với uniqState / uniqMerge",
        "ReplacingMergeTree",
        "count()"
      ], correct: 1, explanation: "Số distinct không cộng được." },
    { q: "Cần thêm một kiểu truy vấn lọc theo user_id trên bảng sort theo tenant_id, query không muốn đổi?", options: [
        "Đổi ORDER BY",
        "Thêm projection ORDER BY user_id",
        "PARTITION BY user_id",
        "Nullable(user_id)"
      ], correct: 1, explanation: "Optimizer tự chọn projection." },
    { q: "Service Rust consume Kafka rồi ghi ClickHouse: commit offset khi nào?", options: [
        "Ngay khi poll",
        "Sau khi Inserter flush thành công batch chứa message",
        "Mỗi giờ bất kể",
        "Trước khi parse"
      ], correct: 1, explanation: "At-least-once, kết hợp bảng đích chịu trùng." }
  ]
});
