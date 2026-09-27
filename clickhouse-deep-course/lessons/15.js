window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "Ingest",
  title: "Kafka nâng cao: chống trùng, message hỏng, ClickPipes & các lựa chọn khác",
  subtitle: "Replacing theo khoá nghiệp vụ · kafka_handle_error_mode = stream / dead_letter_queue · skip_broken · ClickPipes · Kafka Connect",

  theory: `
    <p>Bài 14 kết thúc ở câu "at-least-once". Bài này trả lời: <strong>trùng thì xử lý sao, message hỏng thì sao, có cách nào khác ngoài Kafka engine?</strong></p>

    <p><strong>1. Chống trùng — nhiều lớp</strong></p>
    <ul>
      <li><strong>Lớp chính: ReplacingMergeTree theo khoá nghiệp vụ</strong> (<code>event_id</code> hoặc <code>order_id</code>) + ver. Message bị đọc lại có cùng khoá, cùng ver ⇒ merge/FINAL gộp.
      Với event append-only (click, view) thì sinh <code>event_id</code> (UUID) ở producer và dùng nó làm khoá.</li>
      <li><strong>ver</strong>: <code>updated_at</code> của nguồn, hoặc <code>_offset</code> nếu mọi thay đổi của một khoá đi vào cùng partition (producer dùng khoá = order_id). Offset tăng dần trong partition nên bản mới luôn thắng.</li>
      <li>Insert dedup theo hash block (bài 12) <em>không</em> đáng tin với Kafka engine: block đọc lại không chắc có cùng ranh giới/nội dung.</li>
      <li>Có chế độ thử nghiệm lưu offset trong Keeper (<code>kafka_keeper_path</code>, <code>kafka_replica_name</code>) để tiến gần exactly-once — đọc kỹ changelog trước khi dùng.</li>
    </ul>

    <p><strong>2. Message hỏng (poison message)</strong> — mặc định một message parse lỗi làm cả block lỗi, consumer thử lại mãi ⇒ ingest đứng.</p>
    <table>
      <tr><th>Cách</th><th>Hành vi</th><th>Nhận xét</th></tr>
      <tr><td><code>kafka_skip_broken_messages = N</code></td><td>Bỏ qua tối đa N message lỗi mỗi block</td><td>Mất dữ liệu âm thầm — chỉ dùng tạm</td></tr>
      <tr><td><code>kafka_handle_error_mode = 'stream'</code></td><td>Message lỗi vẫn đi qua với cột ảo <code>_error</code> và <code>_raw_message</code></td><td>Tự tách bằng 2 MV: một MV lấy <code>_error = ''</code>, một MV ghi lỗi vào bảng DLQ</td></tr>
      <tr><td><code>kafka_handle_error_mode = 'dead_letter_queue'</code> (bản mới)</td><td>Lỗi được ghi vào <code>system.dead_letter_queue</code></td><td>Ít code, nhưng là bảng hệ thống của từng server</td></tr>
    </table>
    <p>Kiểu dữ liệu cũng là "hỏng" mềm: đặt cột bảng Kafka rộng hơn (String) rồi chuyển kiểu trong MV bằng <code>toDecimal64OrZero</code>, <code>parseDateTime64BestEffortOrNull</code>… tránh cả block lỗi vì một trường.</p>

    <p><strong>3. Các đường ingest khác</strong></p>
    <ul>
      <li><strong>ClickPipes</strong> (ClickHouse Cloud): dịch vụ managed đọc Kafka/Confluent/MSK/Redpanda, cấu hình bằng UI/API, tự scale, có bảng lỗi riêng. Không phải quản lý consumer trong server.</li>
      <li><strong>Kafka Connect ClickHouse Sink</strong>: chạy trên hạ tầng Connect; hỗ trợ exactly-once nhờ lưu trạng thái trong KeeperMap.</li>
      <li><strong>Service tự viết</strong> (Rust, bài 22): consume, validate, batch và insert. Nhiều code hơn nhưng toàn quyền xử lý lỗi, enrich, và tách tải khỏi ClickHouse.</li>
    </ul>

    <div class="callout"><p>💡 Kết hợp với khoá Kafka: producer đặt key = khoá nghiệp vụ (để thứ tự theo khoá được giữ trong partition) và gửi kèm <code>event_id</code>, <code>updated_at</code>.
    Ba trường đó là thứ ClickHouse cần để khử trùng đúng.</p></div>
  `,

  codeTabs: [
    { id: "stream", label: "① Bảng Kafka mode stream", lines: [
      "CREATE TABLE events_queue",
      "(",
      "    event_id  String,",
      "    user_id   String,          -- để String, ép kiểu trong MV",
      "    event     String,",
      "    ts        String",
      ")",
      "ENGINE = Kafka",
      "SETTINGS kafka_broker_list = 'kafka-1:9092',",
      "         kafka_topic_list  = 'app.events',",
      "         kafka_group_name  = 'ch-events',",
      "         kafka_format      = 'JSONEachRow',",
      "         kafka_handle_error_mode = 'stream';"
    ]},
    { id: "mvs", label: "② Tách đúng / lỗi", lines: [
      "CREATE MATERIALIZED VIEW events_ok_mv TO events AS",
      "SELECT toUUIDOrZero(event_id) AS event_id,",
      "       toUInt64OrZero(user_id) AS user_id,",
      "       event,",
      "       parseDateTime64BestEffortOrZero(ts, 3) AS ts",
      "FROM events_queue",
      "WHERE length(_error) = 0;",
      "",
      "CREATE MATERIALIZED VIEW events_dlq_mv TO events_dlq AS",
      "SELECT now() AS at, _topic AS topic, _partition AS partition,",
      "       _offset AS offset, _raw_message AS raw, _error AS error",
      "FROM events_queue",
      "WHERE length(_error) > 0;"
    ]},
    { id: "dedup", label: "③ Bảng đích chịu trùng", lines: [
      "CREATE TABLE events",
      "(",
      "    event_id  UUID,",
      "    user_id   UInt64,",
      "    event     LowCardinality(String),",
      "    ts        DateTime64(3)",
      ")",
      "ENGINE = ReplacingMergeTree",
      "PARTITION BY toYYYYMM(ts)",
      "ORDER BY (event, toStartOfHour(ts), event_id);  -- event_id cuối khoá",
      "",
      "-- đếm chính xác kể cả khi còn trùng:",
      "SELECT event, uniqExact(event_id) FROM events GROUP BY event;"
    ]},
    { id: "dlq", label: "④ Dead letter queue", lines: [
      "-- bản mới: để ClickHouse tự ghi lỗi",
      "ALTER TABLE events_queue MODIFY SETTING kafka_handle_error_mode = 'dead_letter_queue';",
      "",
      "SELECT event_time, table, kafka_topic_name, kafka_partition, kafka_offset,",
      "       error, raw_message",
      "FROM system.dead_letter_queue",
      "ORDER BY event_time DESC LIMIT 20;",
      "",
      "-- đặt cảnh báo khi số lỗi/phút vượt ngưỡng; xử lý lại bằng tool riêng"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">📨 app.events</div><div class="ns">có message JSON hỏng</div></div>
    <div class="arrow" id="a1">↓ kafka_handle_error_mode = 'stream'</div>
    <div class="node" id="q"><div class="nl">🔌 events_queue</div><div class="ns">_error, _raw_message cho message lỗi</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ events_ok_mv</div><div class="ns">_error rỗng → ép kiểu</div></div>
      <div class="node" id="bad"><div class="nl">🧯 events_dlq_mv</div><div class="ns">_error có → bảng DLQ</div></div>
    </div>
    <div class="arrow" id="a2">↓ đọc lại do at-least-once</div>
    <div class="node" id="t"><div class="nl">📦 events (Replacing theo event_id)</div><div class="ns">trùng được gộp / uniqExact khi đọc</div></div>
  `,
  steps: [
    { title: "1 · Nhận cả message lỗi", tab: "stream", highlight: [4, 6, 13], on: ["k", "a1", "q"],
      desc: "Mode stream không ném exception; message lỗi đi qua với _error và _raw_message. Cột để String để lỗi kiểu không làm hỏng block." },
    { title: "2 · Hai MV tách luồng", tab: "mvs", highlight: [3, 5, 7, 11, 13], on: ["ok", "bad"],
      desc: "MV thứ nhất ép kiểu và ghi dữ liệu tốt; MV thứ hai lưu message lỗi kèm topic/partition/offset để xử lý lại." },
    { title: "3 · Bảng đích chịu trùng", tab: "dedup", highlight: [3, 8, 10, 13], on: ["a2", "t"],
      desc: "event_id nằm trong ORDER BY nên message đọc lại bị gộp khi merge; báo cáo dùng uniqExact(event_id) hoặc FINAL để chính xác ngay." },
    { title: "4 · DLQ có sẵn ở bản mới", tab: "dlq", highlight: [2, 6], on: ["bad"],
      desc: "dead_letter_queue ghi lỗi vào system.dead_letter_queue — ít code hơn, nhưng cần cơ chế đọc và cảnh báo." },
    { title: "5 · Khi nào chọn đường khác", tab: "dlq", highlight: [9], on: ["k"],
      desc: "Trên Cloud: ClickPipes. Cần exactly-once trên hạ tầng Connect: ClickHouse Kafka Connect Sink. Cần logic phức tạp: service Rust riêng." }
  ],

  quiz: [
    { q: "Lớp chống trùng chính khi ingest từ Kafka engine là gì?", options: [
        "Insert deduplication theo hash block",
        "ReplacingMergeTree (hoặc truy vấn uniqExact/FINAL) theo khoá nghiệp vụ như event_id/order_id",
        "Tăng kafka_num_consumers",
        "Đặt kafka_skip_broken_messages"
      ], correct: 1, explanation: "Block đọc lại không chắc giống hệt nên dedup theo hash không đáng tin." },
    { q: "Dùng _offset làm ver cho ReplacingMergeTree đúng khi nào?", options: [
        "Luôn luôn",
        "Khi mọi thay đổi của một khoá đi vào cùng partition (producer đặt key = khoá nghiệp vụ)",
        "Khi topic có 1 partition duy nhất mới được",
        "Không bao giờ"
      ], correct: 1, explanation: "Offset chỉ có thứ tự trong một partition." },
    { q: "Mặc định một message JSON hỏng gây gì?", options: [
        "Bị bỏ qua âm thầm",
        "Block lỗi, consumer thử lại liên tục → ingest bị kẹt",
        "Được ghi NULL",
        "Kafka tự xoá message"
      ], correct: 1, explanation: "Cần cấu hình xử lý lỗi." },
    { q: "kafka_handle_error_mode = 'stream' cung cấp gì?", options: [
        "Tự retry",
        "Cột ảo _error và _raw_message để MV tách message lỗi ra bảng riêng",
        "Ghi lỗi vào Kafka topic khác tự động",
        "Tắt parse"
      ], correct: 1, explanation: "Bạn tự viết MV cho luồng tốt và luồng lỗi." },
    { q: "Nhược điểm của kafka_skip_broken_messages?", options: [
        "Chậm",
        "Message lỗi bị bỏ âm thầm, mất dữ liệu mà không có dấu vết",
        "Không hoạt động với JSON",
        "Làm trùng dữ liệu"
      ], correct: 1, explanation: "Chỉ nên dùng như biện pháp tạm thời." },
    { q: "Vì sao khai báo cột bảng Kafka là String rồi ép kiểu trong MV?", options: [
        "Để nén tốt hơn",
        "Để lỗi kiểu một trường không làm hỏng cả block; dùng hàm OrZero/OrNull kiểm soát",
        "Vì Kafka engine chỉ hỗ trợ String",
        "Để dùng LowCardinality"
      ], correct: 1, explanation: "Chuyển lỗi parse cứng thành xử lý mềm có kiểm soát." },
    { q: "ClickPipes là gì?", options: [
        "Hàm SQL xử lý chuỗi",
        "Dịch vụ ingest managed của ClickHouse Cloud, đọc Kafka và các nguồn khác",
        "Tên khác của Kafka engine",
        "Công cụ backup"
      ], correct: 1, explanation: "Tách việc consume ra khỏi server ClickHouse, tự scale." },
    { q: "Muốn exactly-once từ Kafka vào ClickHouse trên hạ tầng Kafka Connect?", options: [
        "Không thể",
        "Dùng ClickHouse Kafka Connect Sink với chế độ exactly-once (trạng thái lưu trong KeeperMap)",
        "Đặt kafka_num_consumers = 1",
        "Dùng Nullable"
      ], correct: 1, explanation: "Connector ghi nhận offset đã xử lý cùng dữ liệu." },
    { q: "Producer nên gửi những trường nào để ClickHouse khử trùng đúng?", options: [
        "Chỉ payload",
        "Key = khoá nghiệp vụ, kèm event_id và updated_at/version",
        "Thời gian nhận ở ClickHouse",
        "Số thứ tự của consumer"
      ], correct: 1, explanation: "Khoá giữ thứ tự theo entity; event_id/version là cơ sở cho Replacing." },
    { q: "Đếm chính xác số event khi bảng Replacing có thể còn trùng?", options: [
        "count()", "uniqExact(event_id) hoặc count() với FINAL", "uniq(event_id) luôn chính xác", "sum(1)"
      ], correct: 1, explanation: "uniq là xấp xỉ; uniqExact chính xác nhưng tốn RAM hơn." }
  ]
});
