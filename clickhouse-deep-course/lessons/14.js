window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Ingest",
  title: "Ingest từ Kafka: Kafka table engine + materialized view",
  subtitle: "bảng Kafka = consumer · MV kéo dữ liệu vào MergeTree · commit offset · at-least-once · scale consumer",

  theory: `
    <p>Khoá "Kafka chuyên sâu" lo phía producer/broker. Ở đây ta nhìn từ phía ClickHouse: nó là <strong>một consumer group</strong> đọc topic và ghi vào MergeTree.</p>

    <p><strong>Mẫu 3 thành phần</strong></p>
    <ol>
      <li><strong>Bảng Kafka engine</strong> (<code>orders_queue</code>): không lưu gì. Nó là consumer: broker, topic, group, format (JSONEachRow, Avro, Protobuf…).</li>
      <li><strong>Bảng đích MergeTree</strong> (<code>orders</code>): nơi dữ liệu thật nằm.</li>
      <li><strong>Materialized view</strong> <code>FROM orders_queue TO orders</code>: khi có MV gắn vào, ClickHouse chạy luồng nền poll Kafka, gom thành block rồi "insert" block đó qua MV.</li>
    </ol>

    <p><strong>Vòng đời một block</strong></p>
    <ul>
      <li>Poll message cho tới khi đủ <code>kafka_max_block_size</code> hàng hoặc hết <code>kafka_flush_interval_ms</code> (mặc định theo <code>stream_flush_interval_ms</code> = 7,5 giây).</li>
      <li>Parse theo format → block → chạy MV → ghi part vào bảng đích.</li>
      <li><strong>Sau khi ghi xong</strong> mới commit offset lên Kafka.</li>
    </ul>
    <p>Ghi xong mà chưa kịp commit (server restart, rebalance) ⇒ đọc lại block đó ⇒ <strong>at-least-once</strong>: có thể trùng, không mất. Thiết kế bảng đích phải chịu được trùng (bài 15).</p>

    <p><strong>Scale</strong>: <code>kafka_num_consumers</code> = số consumer trong một bảng (không vượt số partition topic và số core).
    Đặt <code>kafka_thread_per_consumer = 1</code> để mỗi consumer flush song song độc lập. Trên cluster, mỗi replica/shard có bảng Kafka cùng group ⇒ Kafka chia partition cho tất cả.</p>

    <p><strong>Vận hành</strong></p>
    <ul>
      <li>Không SELECT trực tiếp bảng Kafka để "xem thử" — nó sẽ <em>tiêu thụ</em> message (bị chặn mặc định bởi <code>stream_like_engine_allow_direct_select = 0</code>).</li>
      <li>Tạm dừng ingest: <code>DETACH TABLE mv</code>; chạy lại: <code>ATTACH</code>. Đổi schema: detach MV, ALTER bảng đích, tạo lại MV, attach.</li>
      <li>Theo dõi: <code>system.kafka_consumers</code> (offset, lỗi, lần poll cuối), consumer lag xem bằng công cụ Kafka.</li>
    </ul>

    <div class="callout"><p>💡 So với Spring Kafka: bảng Kafka ≈ <code>@KafkaListener(batch = true)</code>, MV ≈ phần thân listener làm <code>saveAll()</code>, và
    ack-mode là "commit sau khi saveAll thành công". Chỉ khác là mọi thứ viết bằng SQL và chạy trong ClickHouse.</p></div>
  `,

  codeTabs: [
    { id: "queue", label: "① Bảng Kafka", lines: [
      "CREATE TABLE orders_queue",
      "(",
      "    order_id    UInt64,",
      "    tenant_id   UInt32,",
      "    status      String,",
      "    amount      Decimal(18, 2),",
      "    created_at  DateTime64(3),",
      "    updated_at  DateTime64(3)",
      ")",
      "ENGINE = Kafka",
      "SETTINGS kafka_broker_list = 'kafka-1:9092,kafka-2:9092',",
      "         kafka_topic_list  = 'orders.v1',",
      "         kafka_group_name  = 'clickhouse-orders',",
      "         kafka_format      = 'JSONEachRow',",
      "         kafka_num_consumers = 3,",
      "         kafka_thread_per_consumer = 1;"
    ]},
    { id: "target", label: "② Bảng đích", lines: [
      "CREATE TABLE orders",
      "(",
      "    order_id    UInt64,",
      "    tenant_id   UInt32,",
      "    status      LowCardinality(String),",
      "    amount      Decimal(18, 2),",
      "    created_at  DateTime64(3),",
      "    updated_at  DateTime64(3),",
      "    kafka_partition UInt16,",
      "    kafka_offset    UInt64",
      ")",
      "ENGINE = ReplacingMergeTree(updated_at)",
      "PARTITION BY toYYYYMM(created_at)",
      "ORDER BY (tenant_id, order_id);"
    ]},
    { id: "mv", label: "③ MV nối", lines: [
      "CREATE MATERIALIZED VIEW orders_mv TO orders AS",
      "SELECT order_id, tenant_id, status, amount, created_at, updated_at,",
      "       _partition AS kafka_partition,       -- cột ảo của Kafka engine",
      "       _offset    AS kafka_offset",
      "FROM orders_queue;",
      "",
      "-- từ lúc này ClickHouse bắt đầu consume nền"
    ]},
    { id: "ops", label: "④ Vận hành", lines: [
      "DETACH TABLE orders_mv;          -- tạm dừng consume",
      "ALTER TABLE orders ADD COLUMN channel LowCardinality(String) DEFAULT '';",
      "-- (thêm cột tương ứng vào orders_queue, sửa SELECT của MV)",
      "ATTACH TABLE orders_mv;          -- chạy tiếp từ offset đã commit",
      "",
      "SELECT database, table, consumer_id, assignments.partition_id,",
      "       assignments.current_offset, last_poll_time, exceptions.text",
      "FROM system.kafka_consumers;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="topic"><div class="nl">📨 Topic orders.v1</div><div class="ns">6 partition</div></div>
    <div class="arrow" id="a1">↓ poll (group clickhouse-orders)</div>
    <div class="node" id="q"><div class="nl">🔌 orders_queue (Kafka engine)</div><div class="ns">gom tới max_block_size / flush interval</div></div>
    <div class="arrow" id="a2">↓ block đi qua MV</div>
    <div class="node" id="mv"><div class="nl">⚙️ orders_mv</div><div class="ns">biến đổi + thêm _partition/_offset</div></div>
    <div class="arrow" id="a3">↓ ghi part</div>
    <div class="node" id="t"><div class="nl">📦 orders (ReplacingMergeTree)</div></div>
    <div class="arrow" id="a4">↓ ghi xong mới commit offset</div>
    <div class="node" id="commit"><div class="nl">✅ commit offset lên Kafka</div><div class="ns">crash trước bước này → đọc lại → trùng</div></div>
  `,
  steps: [
    { title: "1 · Bảng Kafka là consumer", tab: "queue", highlight: [10, 11, 12, 13, 14], on: ["topic", "a1", "q"],
      desc: "Không lưu dữ liệu. Khai báo broker, topic, group, format như cấu hình consumer." },
    { title: "2 · Bảng đích lưu dữ liệu thật", tab: "target", highlight: [9, 10, 12, 14], on: ["t"],
      desc: "ReplacingMergeTree theo order_id để chịu được trùng; lưu cả partition/offset để truy vết." },
    { title: "3 · MV kích hoạt consume nền", tab: "mv", highlight: [1, 3, 4, 5], on: ["a2", "mv", "a3"],
      desc: "Có MV gắn vào thì luồng nền bắt đầu poll. Cột ảo _partition, _offset lấy metadata message." },
    { title: "4 · Commit sau khi ghi", tab: "mv", highlight: [7], on: ["a4", "commit"],
      desc: "Offset chỉ commit khi block đã ghi xong → at-least-once. Không mất, nhưng có thể trùng." },
    { title: "5 · Scale & vận hành", tab: "ops", highlight: [1, 2, 4, 6, 7, 8], on: ["q"],
      desc: "DETACH MV để dừng/đổi schema an toàn. system.kafka_consumers cho thấy offset và lỗi từng consumer." }
  ],

  quiz: [
    { q: "Bảng ENGINE = Kafka lưu dữ liệu ở đâu?", options: [
        "Trên đĩa như MergeTree",
        "Không lưu; nó là consumer, dữ liệu đi qua MV sang bảng đích",
        "Trong RAM vĩnh viễn",
        "Trong Keeper"
      ], correct: 1, explanation: "Nó chỉ là 'cổng' đọc từ Kafka." },
    { q: "Điều gì khởi động việc consume nền từ bảng Kafka?", options: [
        "Lệnh START CONSUMER",
        "Gắn một materialized view đọc từ bảng Kafka",
        "SELECT bảng Kafka",
        "Tự động ngay khi CREATE TABLE"
      ], correct: 1, explanation: "Có MV gắn vào thì luồng nền poll và đẩy block qua MV." },
    { q: "Offset được commit khi nào?", options: [
        "Ngay khi poll",
        "Sau khi block đã được ghi xong vào bảng đích qua MV",
        "Mỗi 24 giờ",
        "Không bao giờ"
      ], correct: 1, explanation: "Vì vậy ngữ nghĩa là at-least-once." },
    { q: "Ngữ nghĩa giao nhận mặc định của Kafka engine?", options: [
        "At-most-once", "At-least-once (có thể trùng khi lỗi giữa ghi và commit)", "Exactly-once", "Không đảm bảo gì"
      ], correct: 1, explanation: "Bảng đích cần thiết kế chịu trùng." },
    { q: "Vì sao không nên SELECT * FROM orders_queue để xem thử?", options: [
        "Cú pháp sai",
        "SELECT sẽ tiêu thụ message, lấy mất dữ liệu khỏi luồng ingest (và bị chặn mặc định)",
        "Vì chậm",
        "Vì cần FINAL"
      ], correct: 1, explanation: "Muốn xem dữ liệu, dùng công cụ Kafka hoặc query bảng đích." },
    { q: "kafka_num_consumers nên đặt tối đa bao nhiêu?", options: [
        "Không giới hạn",
        "Không vượt số partition của topic (và số core máy)",
        "Luôn bằng 1",
        "Bằng số bảng đích"
      ], correct: 1, explanation: "Consumer dư sẽ không được gán partition." },
    { q: "Cách an toàn để đổi schema pipeline Kafka → ClickHouse?", options: [
        "DROP bảng đích",
        "DETACH MV, ALTER bảng đích/bảng Kafka, cập nhật MV, ATTACH lại",
        "Restart server",
        "Đổi group name"
      ], correct: 1, explanation: "Consume dừng tại offset đã commit và tiếp tục sau khi attach." },
    { q: "Cột ảo nào cho biết vị trí message trong Kafka?", options: [
        "_part, _row", "_partition, _offset (cùng _topic, _key, _timestamp)", "_shard_num", "_version"
      ], correct: 1, explanation: "Lưu chúng vào bảng đích giúp truy vết và khử trùng." },
    { q: "Bảng hệ thống nào để xem trạng thái consumer của Kafka engine?", options: [
        "system.kafka_consumers", "system.merges", "system.replicas", "system.mutations"
      ], correct: 0, explanation: "Có partition được gán, offset hiện tại, thời gian poll/commit và lỗi gần nhất." }
  ]
});
