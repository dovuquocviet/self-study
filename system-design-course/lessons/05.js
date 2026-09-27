window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Ranh giới & giao tiếp",
  title: "Giao tiếp bất đồng bộ: event qua Kafka",
  subtitle: "Event vs command · topic, partition, key, consumer group · at-least-once · schema & versioning",

  theory: `
    <p>Async = bên phát <strong>ghi một sự kiện rồi đi tiếp</strong>, không chờ ai xử lý. Bên nhận đọc khi sẵn sàng. Hai service không cần cùng sống một lúc
    → tách rời về thời gian. Đổi lại: không có câu trả lời ngay và dữ liệu nhất quán <em>sau</em> một lúc (eventual consistency).</p>

    <p><strong>Event hay command?</strong></p>
    <ul>
      <li><strong>Event</strong>: sự thật đã xảy ra, thì quá khứ, bên phát không biết/không quan tâm ai nghe: <code>OrderPlaced</code>, <code>PaymentCaptured</code>. Thêm consumer mới không phải sửa bên phát.</li>
      <li><strong>Command</strong>: yêu cầu một bên cụ thể làm gì: <code>SendPush</code>, <code>ReserveStock</code>. Có chủ đích, thường một consumer.</li>
    </ul>

    <p><strong>Kafka cần nhớ để thiết kế đúng</strong></p>
    <ul>
      <li><strong>Topic</strong> chia thành <strong>partition</strong>; mỗi partition là log append-only có thứ tự. Thứ tự chỉ đảm bảo <em>trong một partition</em>.</li>
      <li><strong>Key</strong> quyết định partition (hash key). Mọi event của cùng <code>order_id</code> dùng key = order_id → vào cùng partition → giữ thứ tự cho đơn đó.</li>
      <li><strong>Consumer group</strong>: mỗi partition chỉ giao cho 1 consumer trong group → số partition là trần song song. Nhiều group khác nhau (ClickHouse, search, notification) mỗi group đọc đủ toàn bộ, độc lập.</li>
      <li>Consumer tự <strong>commit offset</strong>. Commit sau khi xử lý → nếu chết giữa chừng sẽ xử lý lại → <strong>at-least-once</strong> → consumer phải <strong>idempotent</strong>.</li>
      <li>Producer an toàn: <code>acks=all</code> + <code>enable.idempotence=true</code> (chống trùng do producer retry, là mặc định từ Kafka 3.0 client Java; với librdkafka/rdkafka cần bật tường minh).</li>
      <li>Kafka <strong>giữ lại</strong> message theo retention (vd 7 ngày) chứ không xoá khi đã đọc → consumer mới có thể đọc lại từ đầu để dựng read model.</li>
    </ul>

    <p><strong>Thiết kế event</strong>: có <code>event_id</code> (để khử trùng), <code>type</code>, <code>version</code> schema, <code>occurred_at</code>, key nghiệp vụ, và đủ dữ liệu để consumer khỏi phải gọi ngược lại
    (event-carried state transfer). Schema quản lý bằng Schema Registry (Avro/Protobuf) hoặc ít nhất JSON có version; chỉ thêm field, đổi nghĩa thì ra topic/phiên bản mới.</p>

    <div class="callout"><p>💡 Spring: <code>@KafkaListener</code> + <code>KafkaTemplate</code> che gần hết. Rust thường dùng <code>rdkafka</code> (bọc librdkafka) — bạn thấy rõ cấu hình thật: acks, idempotence, commit.
    ClickHouse của công ty chính là một consumer group độc lập (Kafka engine + materialized view, bài 15). Service nhỏ trên Workers có thể dùng Cloudflare Queues cho việc nội bộ edge,
    nhưng Kafka vẫn là bus chung giữa các service.</p></div>
  `,

  codeTabs: [
    { id: "evt", label: "① Một event", lines: [
      "topic: order.v1          key: \"ord_9f2\"      (=> cùng partition cho mọi event của đơn này)",
      "{",
      "  \"event_id\":   \"01J8Z6Q3K7...\",     // ULID/UUID, để khử trùng",
      "  \"type\":       \"OrderPlaced\",",
      "  \"version\":    2,",
      "  \"occurred_at\":\"2026-09-27T03:10:00Z\",",
      "  \"order_id\":   \"ord_9f2\",",
      "  \"customer_id\":\"cus_12\",",
      "  \"total\":      { \"amount_minor\": 125000, \"currency\": \"VND\" },",
      "  \"items\":      [ { \"sku\": \"SKU-1\", \"qty\": 2 } ]   // đủ dữ liệu, consumer khỏi gọi ngược",
      "}"
    ]},
    { id: "prod", label: "② Producer (rdkafka)", lines: [
      "let producer: FutureProducer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", \"kafka:9092\")",
      "    .set(\"acks\", \"all\")                  // chờ đủ replica in-sync",
      "    .set(\"enable.idempotence\", \"true\")  // retry không tạo bản trùng",
      "    .set(\"compression.type\", \"zstd\")",
      "    .set(\"linger.ms\", \"5\")              // gom lô 5 ms",
      "    .create()?;",
      "",
      "producer.send(",
      "    FutureRecord::to(\"order.v1\").key(&order_id).payload(&json),",
      "    Duration::from_secs(5),",
      ").await.map_err(|(e, _)| e)?;"
    ]},
    { id: "cons", label: "③ Consumer idempotent", lines: [
      "let consumer: StreamConsumer = ClientConfig::new()",
      "    .set(\"group.id\", \"notification-svc\")",
      "    .set(\"enable.auto.commit\", \"false\")   // tự commit sau khi xử lý xong",
      "    .set(\"auto.offset.reset\", \"earliest\")",
      "    .create()?;",
      "consumer.subscribe(&[\"order.v1\"])?;",
      "loop {",
      "    let msg = consumer.recv().await?;",
      "    let e: OrderEvent = serde_json::from_slice(msg.payload().unwrap_or_default())?;",
      "    if !dedup.first_time(&e.event_id).await? { consumer.commit_message(&msg, CommitMode::Async)?; continue; }",
      "    handle(e).await?;                                  // có thể chạy lại nếu crash ở đây",
      "    consumer.commit_message(&msg, CommitMode::Async)?;",
      "}"
    ]},
    { id: "groups", label: "④ Nhiều consumer group", lines: [
      "topic order.v1 — 12 partition",
      "",
      "group notification-svc : 3 instance -> mỗi instance 4 partition",
      "group search-indexer   : 2 instance -> 6 partition mỗi instance",
      "group clickhouse       : Kafka engine table, đọc độc lập",
      "group loyalty-svc      : mới thêm tuần này, đọc lại từ đầu retention",
      "",
      "# 13 instance trong 1 group với 12 partition -> 1 instance ngồi không",
      "# order-service KHÔNG biết và KHÔNG cần sửa khi thêm loyalty-svc"
    ]},
    { id: "java", label: "⑤ Spring ↔ Rust", lines: [
      "// Spring Kafka",
      "@KafkaListener(topics = \"order.v1\", groupId = \"notification-svc\")",
      "public void on(OrderEvent e, Acknowledgment ack) { handle(e); ack.acknowledge(); }",
      "",
      "// Rust rdkafka: không có annotation, tự viết vòng recv + commit (tab ③)",
      "// Lợi: thấy rõ lúc nào offset được commit => biết chắc ngữ nghĩa at-least-once"
    ]}
  ],

  stageHtml: `
    <div class="node" id="o"><div class="nl">🦀 order-service</div><div class="ns">phát OrderPlaced rồi trả lời mobile ngay</div></div>
    <div class="arrow" id="a1">↓ produce key=order_id (acks=all, idempotent)</div>
    <div class="node" id="k"><div class="nl">📨 topic order.v1</div><div class="ns">12 partition · retention 7 ngày</div></div>
    <div class="arrow" id="a2">↓ mỗi group đọc toàn bộ, độc lập</div>
    <div class="row">
      <div class="node" id="n"><div class="nl">🔔 notification</div><div class="ns">group riêng</div></div>
      <div class="node" id="s"><div class="nl">🔎 search-indexer</div><div class="ns">group riêng</div></div>
      <div class="node" id="c"><div class="nl">📊 ClickHouse</div><div class="ns">Kafka engine</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Event là sự thật đã xảy ra", tab: "evt", highlight: [1, 3, 4, 5, 10], on: ["o"],
      desc: "Key = order_id giữ thứ tự theo đơn. event_id để khử trùng; version để tiến hoá schema." },
    { title: "2 · Producer không mất, không trùng", tab: "prod", highlight: [3, 4, 10], on: ["a1", "k"],
      desc: "acks=all: chờ các replica in-sync. Idempotence: retry do mạng không nhân đôi message trong partition." },
    { title: "3 · Consumer tự commit sau khi xử lý", tab: "cons", highlight: [2, 3, 11, 12], on: ["a2", "n"],
      desc: "Crash giữa dòng 11 và 12 → lần sau nhận lại message. Đây là at-least-once." },
    { title: "4 · Khử trùng bằng event_id", tab: "cons", highlight: [10], on: ["n"],
      desc: "Lưu event_id đã xử lý (bảng processed_events hoặc Redis SET NX có TTL). Gặp lại thì bỏ qua." },
    { title: "5 · Fan-out miễn phí", tab: "groups", highlight: [3, 4, 5, 6, 9], on: ["n", "s", "c"],
      desc: "Mỗi group có offset riêng. Thêm loyalty-svc không đụng order-service — đây là giá trị lớn nhất của event." },
    { title: "6 · Partition là trần song song", tab: "groups", highlight: [1, 8], on: ["k"],
      desc: "Chọn số partition theo thông lượng cần đạt; tăng về sau được nhưng làm đổi ánh xạ key → partition." }
  ],

  quiz: [
    { q: "Kafka đảm bảo thứ tự message ở phạm vi nào?", options: [
        "Toàn topic", "Trong một partition", "Toàn cluster", "Không đảm bảo gì"
      ], correct: 1, explanation: "Muốn giữ thứ tự theo đơn → cùng key → cùng partition." },
    { q: "Topic có 6 partition, consumer group có 8 instance. Điều gì xảy ra?", options: [
        "8 instance cùng xử lý song song",
        "Chỉ 6 instance được gán partition, 2 cái ngồi không",
        "Kafka tự tạo thêm partition",
        "Lỗi"
      ], correct: 1, explanation: "Mỗi partition chỉ thuộc một consumer trong group." },
    { q: "Commit offset SAU khi xử lý xong mang lại ngữ nghĩa gì?", options: [
        "At-most-once", "At-least-once — có thể xử lý lặp", "Exactly-once tự động", "Không đảm bảo"
      ], correct: 1, explanation: "Crash trước commit → nhận lại. Vì vậy consumer phải idempotent." },
    { q: "Khác nhau giữa event và command?", options: [
        "Không khác",
        "Event là sự thật đã xảy ra, bên phát không biết ai nghe; command là yêu cầu một bên cụ thể làm việc",
        "Command luôn async, event luôn sync",
        "Event chỉ dùng cho log"
      ], correct: 1, explanation: "OrderPlaced vs SendPush." },
    { q: "enable.idempotence=true ở producer chống lại điều gì?", options: [
        "Consumer xử lý lặp",
        "Message trùng trong partition khi producer retry do lỗi mạng",
        "Mất dữ liệu khi broker chết",
        "Sai thứ tự giữa các partition"
      ], correct: 1, explanation: "Consumer lặp vẫn phải tự khử trùng." },
    { q: "Thêm một service mới cần nghe OrderPlaced. Phải làm gì ở order-service?", options: [
        "Thêm lời gọi HTTP tới service mới",
        "Không cần làm gì — service mới dùng consumer group riêng",
        "Tạo topic mới cho nó",
        "Restart Kafka"
      ], correct: 1, explanation: "Đây là lợi ích tách rời của event." },
    { q: "Vì sao event nên mang đủ dữ liệu (event-carried state)?", options: [
        "Để topic to hơn",
        "Để consumer khỏi phải gọi ngược sync về service phát, tránh ghép chặt lại",
        "Kafka yêu cầu",
        "Để mã hoá dễ hơn"
      ], correct: 1, explanation: "Gọi ngược biến async thành sync trá hình." },
    { q: "Kafka có xoá message ngay khi consumer đọc xong không?", options: [
        "Có",
        "Không — giữ theo retention; consumer mới có thể đọc lại từ đầu",
        "Chỉ khi mọi group đọc xong",
        "Chỉ xoá message lỗi"
      ], correct: 1, explanation: "Khác với hàng đợi kiểu RabbitMQ truyền thống." },
    { q: "acks=all nghĩa là?", options: [
        "Gửi tới mọi consumer",
        "Leader chỉ xác nhận khi các replica in-sync đã ghi",
        "Gửi tới mọi topic",
        "Không chờ xác nhận"
      ], correct: 1, explanation: "Kết hợp min.insync.replicas ≥ 2 để không mất khi một broker chết." }
  ]
});
