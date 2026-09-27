window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "Hiệu năng & scale",
  title: "Read model: Elasticsearch cho tìm kiếm, ClickHouse cho analytics",
  subtitle: "CQRS thực dụng · indexer từ Kafka · external version · Kafka engine + materialized view · dựng lại read model",

  theory: `
    <p>Nguồn sự thật (Postgres/Mongo) tối ưu cho <em>ghi đúng</em>: transaction, ràng buộc, chuẩn hoá. Nhưng người dùng cần <em>đọc theo kiểu khác</em>:
    tìm "son môi đỏ lì dưới 300k" (full-text, lọc, xếp hạng), hay "doanh thu theo giờ theo tỉnh 90 ngày" (quét hàng tỷ dòng). Ép Postgres làm cả hai thì chậm và kéo sập đường ghi.
    <strong>CQRS thực dụng</strong>: ghi vào nguồn sự thật, phát event, dựng các <strong>read model</strong> chuyên dụng từ event.</p>

    <table>
      <tr><th></th><th>Elasticsearch</th><th>ClickHouse</th></tr>
      <tr><td>Giỏi</td><td>Full-text (inverted index), lọc/facet, xếp hạng liên quan, gợi ý</td><td>Tổng hợp trên hàng tỷ dòng (lưu theo cột, nén mạnh, quét song song)</td></tr>
      <tr><td>Truy vấn điển hình</td><td>Tìm sản phẩm, tìm đơn theo mã/tên/SĐT cho CSKH</td><td>Dashboard, funnel, cohort, báo cáo doanh thu</td></tr>
      <tr><td>Cập nhật</td><td>Ghi đè document theo id, gần real-time (refresh ~1 s)</td><td>Thích append; update/delete đắt → ReplacingMergeTree</td></tr>
      <tr><td>Nạp từ Kafka</td><td>Service indexer (Rust) dùng Bulk API</td><td>Kafka table engine + materialized view (tự consume)</td></tr>
      <tr><td>Không nên</td><td>Làm nguồn sự thật, JOIN phức tạp</td><td>Tra từng dòng theo id tần suất cao, OLTP</td></tr>
    </table>

    <p><strong>Nguyên tắc read model</strong></p>
    <ul>
      <li><strong>Có thể dựng lại</strong>: mất index/bảng → đọc lại Kafka (nếu retention đủ) hoặc snapshot từ nguồn. Nếu không dựng lại được thì nó đang là nguồn sự thật trá hình.</li>
      <li><strong>Chịu được lặp và sai thứ tự</strong>: ES dùng <code>version_type=external</code> với version từ nguồn → bản cũ đến muộn bị từ chối. ClickHouse dùng <code>ReplacingMergeTree(version)</code>; bản trùng được gộp lúc merge nền, nên khi cần chính xác thì truy vấn với <code>FINAL</code> hoặc <code>argMax</code>.</li>
      <li><strong>Hình dạng theo truy vấn</strong>, không theo bảng nguồn: document ES của đơn đã phi chuẩn hoá (tên khách, tên sản phẩm) để tìm một phát ra.</li>
      <li><strong>Đổi mapping/schema</strong>: tạo index mới <code>orders_v2</code>, nạp lại, chuyển alias <code>orders</code> nguyên tử → không downtime.</li>
      <li><strong>Đo độ trễ</strong> (consumer lag) và cho UI biết dữ liệu "tính đến" lúc nào.</li>
    </ul>

    <div class="callout"><p>💡 Trong Spring bạn có thể từng viết <code>@Query</code> 5 JOIN + <code>LIKE '%abc%'</code> cho màn tìm kiếm admin, và báo cáo chạy thẳng trên DB chính lúc 9 giờ sáng làm chậm checkout.
    Read model tách hai tải đó khỏi đường ghi. ClickHouse của công ty chính là một consumer group độc lập của Kafka — không service nào phải "gửi sang ClickHouse".</p></div>
  `,

  codeTabs: [
    { id: "idx", label: "① Indexer ES (Rust)", lines: [
      "// consumer group 'search-indexer' đọc order.v1, gom lô rồi Bulk",
      "let mut body: Vec<JsonBody<Value>> = Vec::new();",
      "for e in batch {",
      "    body.push(json!({ \"index\": { \"_index\": \"orders\", \"_id\": e.order_id,",
      "                                 \"version\": e.version, \"version_type\": \"external\" } }).into());",
      "    body.push(json!({ \"order_id\": e.order_id, \"status\": e.status,",
      "                      \"customer_name\": e.customer_name, \"phone\": e.phone,",
      "                      \"items\": e.item_names, \"total_minor\": e.total_minor,",
      "                      \"created_at\": e.created_at }).into());",
      "}",
      "let resp = es.bulk(BulkParts::None).body(body).send().await?;",
      "// lỗi 409 version_conflict = bản cũ đến muộn -> bỏ qua; lỗi khác -> retry",
      "consumer.commit_consumer_state(CommitMode::Async)?;   // commit sau khi Bulk xong"
    ]},
    { id: "alias", label: "② Đổi mapping không downtime", lines: [
      "PUT orders_v2 { \"mappings\": { \"properties\": {",
      "  \"customer_name\": { \"type\": \"text\", \"analyzer\": \"vi_folding\" },",
      "  \"phone\":         { \"type\": \"keyword\" },",
      "  \"status\":        { \"type\": \"keyword\" },",
      "  \"created_at\":    { \"type\": \"date\" } } } }",
      "",
      "# nạp lại orders_v2 (reindex hoặc replay Kafka), rồi đổi alias nguyên tử:",
      "POST _aliases { \"actions\": [",
      "  { \"remove\": { \"index\": \"orders_v1\", \"alias\": \"orders\" } },",
      "  { \"add\":    { \"index\": \"orders_v2\", \"alias\": \"orders\" } } ] }"
    ]},
    { id: "ch", label: "③ ClickHouse từ Kafka", lines: [
      "CREATE TABLE order_events_queue (",
      "  order_id String, status LowCardinality(String), province LowCardinality(String),",
      "  total_minor UInt64, version UInt64, occurred_at DateTime64(3)",
      ") ENGINE = Kafka SETTINGS",
      "  kafka_broker_list = 'kafka:9092', kafka_topic_list = 'order.v1',",
      "  kafka_group_name = 'clickhouse-orders', kafka_format = 'JSONEachRow';",
      "",
      "CREATE TABLE orders_rm (",
      "  order_id String, status LowCardinality(String), province LowCardinality(String),",
      "  total_minor UInt64, version UInt64, occurred_at DateTime64(3)",
      ") ENGINE = ReplacingMergeTree(version)",
      "PARTITION BY toYYYYMM(occurred_at) ORDER BY order_id;",
      "",
      "CREATE MATERIALIZED VIEW order_events_mv TO orders_rm AS SELECT * FROM order_events_queue;"
    ]},
    { id: "q", label: "④ Truy vấn đúng", lines: [
      "-- ReplacingMergeTree gộp bản trùng lúc merge nền => cần FINAL hoặc argMax khi cần chính xác",
      "SELECT province, sum(total_minor) AS revenue",
      "FROM orders_rm FINAL",
      "WHERE status = 'CONFIRMED' AND occurred_at >= now() - INTERVAL 90 DAY",
      "GROUP BY province ORDER BY revenue DESC;",
      "",
      "-- ES: CSKH tìm đơn theo SĐT hoặc tên không dấu",
      "GET orders/_search { \"query\": { \"multi_match\": {",
      "  \"query\": \"nguyen van a\", \"fields\": [\"customer_name\", \"phone\", \"order_id\"] } } }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">🦀 order-service + 🐘 Postgres</div><div class="ns">nguồn sự thật · outbox</div></div>
    <div class="arrow" id="a1">↓ order.v1</div>
    <div class="node" id="k"><div class="nl">📨 Kafka</div><div class="ns">retention đủ để replay</div></div>
    <div class="row">
      <div class="node" id="es"><div class="nl">🔎 Elasticsearch</div><div class="ns">indexer · external version · alias</div></div>
      <div class="node" id="ch"><div class="nl">📊 ClickHouse</div><div class="ns">Kafka engine → MV → ReplacingMergeTree</div></div>
    </div>
    <div class="arrow" id="a2">↓ đọc</div>
    <div class="row">
      <div class="node" id="u1"><div class="nl">📱 Tìm kiếm / CSKH</div><div class="ns">full-text</div></div>
      <div class="node" id="u2"><div class="nl">📈 Dashboard</div><div class="ns">tổng hợp tỷ dòng</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Nguồn sự thật phát event", tab: "idx", highlight: [1], on: ["src", "a1", "k"],
      desc: "Không service nào gọi thẳng ES hay ClickHouse trong luồng ghi. Chỉ phát event." },
    { title: "2 · Indexer: Bulk + external version", tab: "idx", highlight: [4, 5, 11, 12, 13], on: ["es"],
      desc: "Version từ nguồn giúp ES từ chối bản cũ đến muộn. Commit offset sau khi Bulk thành công." },
    { title: "3 · Đổi mapping bằng alias", tab: "alias", highlight: [1, 2, 8, 9, 10], on: ["es"],
      desc: "App luôn truy vấn alias 'orders'; chuyển alias là nguyên tử." },
    { title: "4 · ClickHouse tự consume", tab: "ch", highlight: [4, 5, 6, 11, 14], on: ["ch"],
      desc: "Bảng Kafka engine chỉ là cửa đọc; MV đẩy từng lô vào bảng lưu trữ ReplacingMergeTree." },
    { title: "5 · Truy vấn chính xác", tab: "q", highlight: [1, 3, 4], on: ["a2", "u2"],
      desc: "Bản trùng chưa merge vẫn còn; FINAL/argMax cho kết quả đúng (đổi lại tốn thêm tài nguyên)." },
    { title: "6 · Tìm kiếm cho CSKH", tab: "q", highlight: [8, 9], on: ["u1"],
      desc: "Document phi chuẩn hoá: tìm theo tên không dấu, SĐT, mã đơn một phát ra." }
  ],

  quiz: [
    { q: "Read model là gì?", options: [
        "Bản backup DB",
        "Bản dữ liệu dựng từ event, tối ưu cho một kiểu đọc, có thể dựng lại từ nguồn",
        "Replica đồng bộ của Postgres",
        "Cache trình duyệt"
      ], correct: 1, explanation: "Không thể dựng lại thì đó là nguồn sự thật trá hình." },
    { q: "Truy vấn 'doanh thu theo tỉnh 90 ngày trên 2 tỷ dòng' hợp với?", options: [
        "Elasticsearch", "ClickHouse", "Redis", "Postgres chính"
      ], correct: 1, explanation: "Lưu theo cột, nén, quét song song." },
    { q: "Vì sao indexer ES dùng version_type=external?", options: [
        "Để mã hoá",
        "Bản cũ đến muộn (lặp/sai thứ tự) bị từ chối, không ghi đè bản mới",
        "Để tăng tốc",
        "ES bắt buộc"
      ], correct: 1, explanation: "Version lấy từ nguồn sự thật." },
    { q: "ReplacingMergeTree khử trùng khi nào?", options: [
        "Ngay khi INSERT",
        "Trong quá trình merge nền, không đảm bảo thời điểm — cần FINAL/argMax khi cần chính xác",
        "Không bao giờ",
        "Mỗi giờ đúng một lần"
      ], correct: 1, explanation: "Đây là bẫy phổ biến khi mới dùng ClickHouse." },
    { q: "Đổi mapping của index ES đang phục vụ mà không downtime?", options: [
        "Sửa mapping trực tiếp mọi field",
        "Tạo index mới, nạp lại, chuyển alias nguyên tử",
        "Xoá index rồi tạo lại",
        "Restart cluster"
      ], correct: 1, explanation: "App truy vấn qua alias." },
    { q: "Vai trò của bảng ENGINE = Kafka trong ClickHouse?", options: [
        "Lưu dữ liệu lâu dài",
        "Cửa đọc từ topic; materialized view chuyển dữ liệu sang bảng MergeTree lưu trữ",
        "Gửi dữ liệu lên Kafka",
        "Thay thế Kafka"
      ], correct: 1, explanation: "Đọc trực tiếp bảng Kafka sẽ tiêu thụ message." },
    { q: "Vì sao không ghi ES trực tiếp trong transaction tạo đơn?", options: [
        "ES không nhận ghi",
        "Dual write và ES chậm/lỗi sẽ làm hỏng đường ghi chính; qua event thì tách rời",
        "ES quá nhanh",
        "Không có lý do"
      ], correct: 1, explanation: "Read model cập nhật bất đồng bộ." },
    { q: "Document ES cho đơn hàng nên thiết kế theo?", options: [
        "Đúng cấu trúc bảng Postgres",
        "Truy vấn cần phục vụ — phi chuẩn hoá thêm tên khách, tên sản phẩm",
        "Chỉ lưu order_id",
        "Lưu nguyên event JSON không mapping"
      ], correct: 1, explanation: "ES không JOIN tốt." },
    { q: "Mất toàn bộ index ES. Làm sao khôi phục?", options: [
        "Không thể",
        "Replay Kafka (nếu retention đủ) hoặc nạp lại từ snapshot của nguồn sự thật",
        "Nhập tay",
        "Lấy từ ClickHouse"
      ], correct: 1, explanation: "Đây là lý do read model phải dựng lại được." }
  ]
});
