window.LESSONS.push({
  id: "21",
  phase: "6", phaseName: "Tích hợp",
  title: "Kafka → ClickHouse: ba cách nạp và bài toán không mất, không trùng",
  subtitle: "Kafka table engine + materialized view · ClickPipes · consumer service tự viết · dedup ở đích",

  theory: `
    <p>Trong hệ thống của công ty, ClickHouse là một <strong>consumer group</strong> của Kafka như mọi service khác. Bài này nhìn từ phía Kafka;
    chi tiết phía ClickHouse (MergeTree, part, insert theo lô, ReplacingMergeTree) có trong khoá <em>ClickHouse chuyên sâu</em>.</p>

    <p><strong>Cách 1 — Kafka table engine + Materialized View</strong> (ClickHouse tự làm consumer)</p>
    <ul>
      <li>Bảng <code>ENGINE = Kafka</code> là "vòi": đọc nó thì tiêu thụ message (mỗi message chỉ đọc được một lần qua bảng này). Không lưu gì.</li>
      <li><strong>Materialized View</strong> <code>TO</code> bảng MergeTree đích: nền ClickHouse liên tục đọc lô từ bảng Kafka, chạy SELECT biến đổi, chèn vào bảng đích, rồi commit offset.</li>
      <li>Cấu hình chính: <code>kafka_broker_list</code>, <code>kafka_topic_list</code>, <code>kafka_group_name</code>, <code>kafka_format</code> (JSONEachRow, Avro, AvroConfluent, Protobuf...), <code>kafka_num_consumers</code> (≤ số partition), <code>kafka_max_block_size</code>.</li>
      <li>Ngữ nghĩa: <strong>at-least-once</strong> — offset commit sau khi insert; crash giữa hai bước → lô bị chèn lại. (Có chế độ lưu offset trong ClickHouse Keeper — <code>kafka_keeper_path</code> — hướng tới exactly-once nhưng đang ở mức thử nghiệm; kiểm tra phiên bản.)</li>
      <li>Message không parse được: <code>kafka_skip_broken_messages</code> hoặc <code>kafka_handle_error_mode='stream'</code> (đưa lỗi vào cột ảo <code>_error</code>/<code>_raw_message</code> để MV thứ hai ghi ra bảng lỗi — giống DLQ).</li>
    </ul>

    <p><strong>Cách 2 — ClickPipes</strong> (ClickHouse Cloud): dịch vụ nạp được quản lý, cấu hình qua UI/API; hỗ trợ Kafka, Confluent Cloud, MSK, Redpanda... và Schema Registry.
    Không phải tự vận hành consumer; đổi lại phụ thuộc Cloud và chi phí dịch vụ. Cũng là at-least-once.</p>

    <p><strong>Cách 3 — Consumer service tự viết</strong> (Rust rdkafka, hoặc Kafka Connect ClickHouse Sink)</p>
    <ul>
      <li>Toàn quyền: làm giàu dữ liệu, lọc, gọi service khác, định tuyến lỗi tinh vi, metric riêng.</li>
      <li>Bắt buộc insert <strong>theo lô lớn</strong> (hàng nghìn–hàng trăm nghìn dòng, hoặc mỗi vài giây) — insert từng dòng tạo quá nhiều part và làm ClickHouse "Too many parts". Hoặc dùng async insert của ClickHouse.</li>
      <li>Offset store sau khi insert thành công (bài 12).</li>
    </ul>

    <table>
      <tr><th></th><th>Kafka engine + MV</th><th>ClickPipes</th><th>Consumer tự viết</th></tr>
      <tr><td>Vận hành</td><td>Trong ClickHouse</td><td>Được quản lý (Cloud)</td><td>Một service nữa</td></tr>
      <tr><td>Biến đổi</td><td>SQL trong MV</td><td>Ánh xạ cột cơ bản</td><td>Bất kỳ</td></tr>
      <tr><td>Xử lý lỗi</td><td>skip / stream mode</td><td>Bảng lỗi riêng</td><td>DLQ tự thiết kế</td></tr>
      <tr><td>Ngữ nghĩa</td><td>at-least-once</td><td>at-least-once</td><td>tuỳ bạn (thường at-least-once)</td></tr>
    </table>

    <p><strong>Không mất</strong>: phía Kafka — acks=all, min.isr=2, retention đủ dài so với thời gian ClickHouse có thể ngừng nạp, cảnh báo lag theo thời gian.
    <strong>Không trùng</strong>: vì mọi cách đều at-least-once, dedup ở đích: <code>ReplacingMergeTree</code> với khoá sắp xếp chứa <code>event_id</code> (dedup khi merge — truy vấn cần <code>FINAL</code> hoặc
    <code>argMax</code> nếu cần chính xác tức thì), hoặc insert deduplication theo lô (cơ chế <code>insert_deduplication_token</code> / dedup theo hash block trên bảng Replicated — chỉ hiệu quả khi lô chèn lại giống hệt).</p>

    <div class="callout"><p>💡 Quy tắc chung với mọi đích analytics: <strong>chấp nhận at-least-once ở đường ống, làm idempotent ở đích</strong> — đúng như bài 13, chỉ thay
    "bảng processed_events" bằng ReplacingMergeTree.</p></div>
  `,

  codeTabs: [
    { id: "engine", label: "① Kafka engine + MV", lines: [
      "CREATE TABLE orders_queue (",
      "  event_id String, order_id String, status String, total Int64, ts DateTime64(3)",
      ") ENGINE = Kafka",
      "SETTINGS kafka_broker_list = 'b1:9092,b2:9092',",
      "         kafka_topic_list = 'orders',",
      "         kafka_group_name = 'clickhouse-orders',",
      "         kafka_format = 'JSONEachRow',",
      "         kafka_num_consumers = 4;",
      "",
      "CREATE TABLE orders_events (",
      "  event_id String, order_id String, status String, total Int64, ts DateTime64(3)",
      ") ENGINE = ReplacingMergeTree ORDER BY (order_id, event_id);",
      "",
      "CREATE MATERIALIZED VIEW orders_mv TO orders_events AS",
      "SELECT event_id, order_id, status, total, ts FROM orders_queue;"
    ]},
    { id: "err", label: "② Lỗi parse như DLQ", lines: [
      "-- trong SETTINGS của orders_queue thêm:",
      "--   kafka_handle_error_mode = 'stream'",
      "",
      "CREATE TABLE orders_errors (topic String, part UInt64, off UInt64, raw String, err String)",
      "ENGINE = MergeTree ORDER BY (topic, part, off);",
      "",
      "CREATE MATERIALIZED VIEW orders_err_mv TO orders_errors AS",
      "SELECT _topic AS topic, _partition AS part, _offset AS off,",
      "       _raw_message AS raw, _error AS err",
      "FROM orders_queue WHERE length(_error) > 0;"
    ]},
    { id: "rust", label: "③ Consumer Rust theo lô", lines: [
      "// gom tối đa 50_000 dòng hoặc 2 giây (xem mẫu select! ở bài 19)",
      "let rows: Vec<OrderRow> = buf.iter().filter_map(|m| parse(m).ok()).collect();",
      "",
      "let mut insert = ch.insert(\"orders_events\")?;        // crate clickhouse",
      "for r in &rows { insert.write(r).await?; }",
      "insert.end().await?;                                  // 1 lần insert = 1 part",
      "",
      "for m in &buf { consumer.store_offset(m.topic(), m.partition(), m.offset())?; }  // librdkafka tự +1",
      "// crash trước dòng trên -> lô chèn lại -> ReplacingMergeTree dọn trùng"
    ]},
    { id: "query", label: "④ Truy vấn khi có trùng", lines: [
      "-- trùng chưa được merge: dùng FINAL (chậm hơn) cho truy vấn cần chính xác",
      "SELECT status, count() FROM orders_events FINAL GROUP BY status;",
      "",
      "-- hoặc gộp tường minh theo khoá",
      "SELECT order_id, argMax(status, ts) AS last_status",
      "FROM orders_events GROUP BY order_id;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">📨 topic orders</div><div class="ns">acks=all · retention đủ dài</div></div>
    <div class="arrow" id="a1">↓ consumer group (at-least-once)</div>
    <div class="row">
      <div class="node" id="e"><div class="nl">① Kafka engine + MV</div><div class="ns">trong ClickHouse</div></div>
      <div class="node" id="cp"><div class="nl">② ClickPipes</div><div class="ns">Cloud quản lý</div></div>
      <div class="node" id="rs"><div class="nl">③ Service Rust</div><div class="ns">insert theo lô</div></div>
    </div>
    <div class="arrow" id="a2">↓ có thể trùng khi crash/rebalance</div>
    <div class="node" id="rmt"><div class="nl">🗃️ ReplacingMergeTree</div><div class="ns">ORDER BY (order_id, event_id) · FINAL/argMax</div></div>
  `,
  steps: [
    { title: "1 · Bảng Kafka là vòi", tab: "engine", highlight: [3, 4, 5, 6, 7, 8], on: ["k", "a1", "e"],
      desc: "ClickHouse tham gia group clickhouse-orders như một consumer. kafka_num_consumers không nên vượt số partition." },
    { title: "2 · MV đổ vào bảng đích", tab: "engine", highlight: [12, 14, 15], on: ["e", "rmt"],
      desc: "MV chạy nền: đọc lô, biến đổi, insert, commit offset. Bảng đích là ReplacingMergeTree để chịu trùng." },
    { title: "3 · Lỗi parse không làm kẹt", tab: "err", highlight: [2, 7, 8, 9, 10], on: ["e"],
      desc: "Stream mode đưa message hỏng vào bảng lỗi — DLQ phiên bản ClickHouse." },
    { title: "4 · Hoặc tự viết consumer", tab: "rust", highlight: [4, 5, 6, 8, 9], on: ["rs"],
      desc: "Insert theo lô lớn rồi mới store offset. Crash giữa chừng → lô chèn lại → dedup ở đích." },
    { title: "5 · Truy vấn chính xác", tab: "query", highlight: [2, 5, 6], on: ["a2", "rmt"],
      desc: "ReplacingMergeTree dọn trùng khi merge (không biết lúc nào). Cần chính xác ngay thì FINAL hoặc argMax." }
  ],

  quiz: [
    { q: "Bảng ENGINE = Kafka trong ClickHouse lưu dữ liệu lâu dài không?", options: [
        "Có", "Không — nó là điểm tiêu thụ; cần Materialized View đổ vào bảng MergeTree", "Chỉ 7 ngày", "Có nếu dùng ReplacingMergeTree"
      ], correct: 1, explanation: "Đọc bảng Kafka là tiêu thụ message." },
    { q: "Ngữ nghĩa giao nhận của Kafka engine + MV (mặc định)?", options: ["At-most-once", "At-least-once", "Exactly-once", "Không đảm bảo"], correct: 1,
      explanation: "Commit offset sau insert → có thể chèn lại khi lỗi." },
    { q: "kafka_num_consumers nên đặt thế nào?", options: [
        "Càng lớn càng tốt", "Không vượt số partition của topic", "Bằng số CPU × 10", "Luôn 1"
      ], correct: 1, explanation: "Consumer thừa ngồi chơi." },
    { q: "Consumer tự viết insert từng dòng vào ClickHouse gây ra gì?", options: [
        "Không sao", "Quá nhiều part nhỏ → merge quá tải, lỗi Too many parts", "Mất dữ liệu", "Kafka chậm"
      ], correct: 1, explanation: "Insert theo lô lớn hoặc dùng async insert." },
    { q: "Cách phổ biến để khử trùng ở ClickHouse?", options: [
        "Không cần", "ReplacingMergeTree với khoá sắp xếp chứa event_id, truy vấn FINAL/argMax khi cần chính xác", "Bảng Log", "Tắt replica"
      ], correct: 1, explanation: "Dedup xảy ra khi merge, không tức thì." },
    { q: "ClickPipes là gì?", options: [
        "Tên cũ của Kafka engine", "Dịch vụ nạp dữ liệu được quản lý của ClickHouse Cloud", "Một loại MergeTree", "Công cụ Kafka CLI"
      ], correct: 1, explanation: "Không cần tự vận hành consumer." },
    { q: "Từ phía Kafka, cấu hình nào giúp ClickHouse ngừng nạp 2 ngày mà không mất dữ liệu?", options: [
        "linger.ms", "retention.ms của topic đủ dài hơn thời gian ngừng (kèm cảnh báo lag theo thời gian)", "acks=0", "compaction"
      ], correct: 1, explanation: "Retention là cam kết với consumer." },
    { q: "kafka_handle_error_mode='stream' dùng để?", options: [
        "Tăng tốc", "Đưa message lỗi parse vào cột ảo _error/_raw_message để ghi ra bảng lỗi thay vì chặn", "Nén dữ liệu", "Bật exactly-once"
      ], correct: 1, explanation: "Tương tự DLQ." },
    { q: "Trong consumer Rust nạp ClickHouse, khi nào store offset?", options: [
        "Ngay khi nhận", "Sau khi insert lô thành công", "Trước khi parse", "Không cần"
      ], correct: 1, explanation: "Nguyên tắc chung bài 12." }
  ]
});
