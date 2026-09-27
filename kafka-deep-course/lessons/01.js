window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Kafka là một cái log — không phải hàng đợi",
  subtitle: "Append-only log · offset · consumer tự nhớ vị trí · khác gì RabbitMQ và gọi REST",

  theory: `
    <p>Ở Spring bạn viết <code>kafkaTemplate.send("orders", order)</code> và <code>@KafkaListener(topics = "orders")</code> là chạy. Nhưng muốn hiểu vì sao
    message bị trùng, bị lệch thứ tự hay consumer "đứng hình", phải bắt đầu từ mô hình gốc: <strong>Kafka là một commit log phân tán</strong>.</p>

    <p><strong>Log là gì?</strong> Một dãy bản ghi chỉ được <em>ghi nối vào cuối</em> (append-only), mỗi bản ghi có một số thứ tự tăng dần gọi là <strong>offset</strong>.
    Không sửa, không xoá từng bản ghi (chỉ xoá cả đoạn cũ theo retention — bài 15).</p>
    <ul>
      <li><strong>Producer</strong> chỉ làm một việc: nối bản ghi vào cuối log.</li>
      <li><strong>Consumer</strong> đọc tuần tự từ một offset nào đó. Đọc xong <em>message vẫn còn đó</em>; consumer chỉ ghi nhớ "tôi đã xử lý tới offset N" (commit offset).</li>
      <li>Nhiều nhóm consumer độc lập cùng đọc một log, mỗi nhóm có vị trí riêng: service billing ở offset 1200, ClickHouse ở offset 900 — không ai ảnh hưởng ai.</li>
      <li>Muốn đọc lại (replay) sau khi sửa bug? Chỉ cần lùi offset.</li>
    </ul>

    <table>
      <tr><th></th><th>Kafka (log)</th><th>RabbitMQ / JMS (queue)</th><th>Gọi REST trực tiếp</th></tr>
      <tr><td>Sau khi đọc</td><td>Message vẫn còn tới hết retention</td><td>Ack xong là xoá</td><td>Không lưu gì</td></tr>
      <tr><td>Nhiều bên nhận</td><td>Mỗi consumer group đọc đủ toàn bộ</td><td>Cần exchange/fanout, mỗi queue một bản</td><td>Bên gửi phải gọi từng bên</td></tr>
      <tr><td>Thứ tự</td><td>Đảm bảo trong <strong>một partition</strong></td><td>Theo queue, dễ lệch khi nhiều consumer</td><td>—</td></tr>
      <tr><td>Bên nhận chết</td><td>Không sao, đọc tiếp khi sống lại</td><td>Message nằm chờ trong queue</td><td>Request lỗi, bên gửi phải retry</td></tr>
      <tr><td>Ai nhớ tiến độ</td><td>Consumer (offset)</td><td>Broker (trạng thái từng message)</td><td>—</td></tr>
    </table>

    <p><strong>Vì sao công ty dùng Kafka giữa các service?</strong> Mỗi service có DB riêng; khi đơn hàng đổi trạng thái, service order ghi sự kiện
    <code>OrderPaid</code> vào topic. Billing, notification, search (Elasticsearch) và analytics (ClickHouse) tự đọc theo tốc độ của mình.
    Service order không cần biết ai đang nghe — <em>tách rời theo thời gian và theo số lượng</em>.</p>

    <p><strong>Cái giá phải trả</strong>: Kafka không có "routing thông minh", không có ack từng message, không có priority queue. Đổi lại được thông lượng rất lớn
    (ghi tuần tự lên đĩa, đọc qua page cache) và khả năng đọc lại lịch sử.</p>

    <div class="callout"><p>💡 Câu cần nhớ suốt khoá: <strong>broker không đẩy message cho ai và không biết ai đã "xử lý" gì</strong>. Consumer tự <em>kéo</em> (pull) và tự báo offset.
    Hầu hết lỗi trùng/mất message là lỗi ở chỗ "báo offset khi nào".</p></div>
  `,

  codeTabs: [
    { id: "log", label: "① Log trông thế nào", lines: [
      "topic: orders   partition: 0",
      "",
      "offset | key      | value",
      "-------+----------+-----------------------------------",
      "  0    | order-17 | {\"type\":\"OrderCreated\",\"total\":120}",
      "  1    | order-18 | {\"type\":\"OrderCreated\",\"total\":45}",
      "  2    | order-17 | {\"type\":\"OrderPaid\"}",
      "  3    | order-19 | {\"type\":\"OrderCreated\",\"total\":300}",
      "  4    | order-17 | {\"type\":\"OrderShipped\"}      <- log-end-offset = 5",
      "",
      "# consumer group 'billing'    đã commit offset 3 -> lần tới đọc từ 3",
      "# consumer group 'clickhouse' đã commit offset 1 -> đang chậm hơn"
    ]},
    { id: "spring", label: "② Spring quen thuộc", lines: [
      "// Producer",
      "kafkaTemplate.send(\"orders\", order.getId(), event);",
      "",
      "// Consumer",
      "@KafkaListener(topics = \"orders\", groupId = \"billing\")",
      "public void onOrder(OrderEvent e) {",
      "    billingService.handle(e);",
      "}   // Spring (container) tự commit offset sau khi hàm return — bạn không thấy",
      "",
      "// Câu hỏi của khoá này: send() trả về lúc nào? commit xảy ra khi nào?",
      "// hàm handle() ném exception thì offset ra sao? chạy 2 instance thì chia việc thế nào?"
    ]},
    { id: "cli", label: "③ Tự tay với CLI", lines: [
      "# tạo topic 3 partition, mỗi partition 3 bản sao",
      "kafka-topics.sh --bootstrap-server localhost:9092 --create \\",
      "  --topic orders --partitions 3 --replication-factor 3",
      "",
      "# ghi vài message có key (định dạng key:value)",
      "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders \\",
      "  --property parse.key=true --property key.separator=:",
      "",
      "# đọc từ đầu, in cả partition và offset",
      "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders \\",
      "  --from-beginning --group billing \\",
      "  --property print.partition=true --property print.offset=true --property print.key=true"
    ]},
    { id: "rust", label: "④ Cùng ý tưởng bằng Rust", lines: [
      "// Cargo.toml: rdkafka (feature cmake-build) + tokio — API theo docs.rs bản mới nhất",
      "let producer: FutureProducer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", \"localhost:9092\")",
      "    .create()?;",
      "",
      "let d = producer",
      "    .send(FutureRecord::to(\"orders\").key(\"order-17\").payload(&json), Duration::from_secs(5))",
      "    .await",
      "    .map_err(|(e, _msg)| e)?;",
      "println!(\"ghi vào partition {} offset {}\", d.partition, d.offset);"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">🧾 Service order (producer)</div><div class="ns">append OrderPaid</div></div>
    <div class="arrow" id="a1">↓ nối vào cuối log</div>
    <div class="node" id="log"><div class="nl">📜 orders / partition 0</div><div class="ns">0 · 1 · 2 · 3 · 4 → offset tiếp theo = 5</div></div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">💳 group billing</div><div class="ns">commit = 3</div></div>
      <div class="node" id="c2"><div class="nl">📊 group clickhouse</div><div class="ns">commit = 1 (chậm hơn)</div></div>
    </div>
    <div class="arrow" id="a2">↺ lùi offset = đọc lại</div>
  `,
  steps: [
    { title: "1 · Producer chỉ nối vào cuối", tab: "log", highlight: [5, 6, 7, 8, 9], on: ["p", "a1", "log"],
      desc: "Mỗi bản ghi nhận offset tăng dần trong partition. Không có thao tác 'sửa' hay 'xoá một message'." },
    { title: "2 · Mỗi group có vị trí riêng", tab: "log", highlight: [11, 12], on: ["c1", "c2"],
      desc: "Billing đã xử lý tới offset 2 (commit 3 = 'lần tới đọc từ 3'). ClickHouse chậm hơn nhưng không làm chậm billing." },
    { title: "3 · Spring giấu điều gì", tab: "spring", highlight: [2, 5, 8], on: ["c1"],
      desc: "Listener container của Spring gọi poll, gọi hàm của bạn, rồi commit offset. Mọi bài sau là mở hộp đen này ra." },
    { title: "4 · Tự tay xem offset", tab: "cli", highlight: [2, 3, 10, 11, 12], on: ["log"],
      desc: "print.offset=true cho thấy message vẫn còn nguyên sau khi đọc; chạy lại với group khác sẽ đọc lại từ đầu." },
    { title: "5 · Đọc lại lịch sử", tab: "log", highlight: [12], on: ["a2", "c2"],
      desc: "Sửa bug ở consumer rồi reset offset về quá khứ là xử lý lại được — điều không làm được với queue đã ack-là-xoá." }
  ],

  quiz: [
    { q: "Sau khi một consumer group đọc và commit một message, message đó…", options: [
        "Bị broker xoá ngay",
        "Vẫn nằm trong log tới khi hết hạn retention (hoặc bị compaction)",
        "Chuyển sang topic __deleted",
        "Bị khoá, group khác không đọc được"
      ], correct: 1, explanation: "Đọc không làm thay đổi log; xoá chỉ xảy ra theo retention/compaction." },
    { q: "Ai lưu tiến độ 'đã xử lý tới đâu' trong Kafka?", options: [
        "Broker đánh dấu từng message đã ack",
        "Consumer group, bằng cách commit offset",
        "Producer",
        "ZooKeeper đánh dấu từng message"
      ], correct: 1, explanation: "Offset đã commit được lưu trong topic nội bộ __consumer_offsets, theo group." },
    { q: "Hai consumer group 'billing' và 'clickhouse' cùng subscribe topic orders. Kết quả?", options: [
        "Mỗi message chỉ tới một trong hai group",
        "Mỗi group nhận đầy đủ mọi message, với tiến độ độc lập",
        "Group sau bị từ chối",
        "Phải tạo hai topic"
      ], correct: 1, explanation: "Chia việc chỉ xảy ra giữa các consumer TRONG cùng group." },
    { q: "Kafka đảm bảo thứ tự message ở phạm vi nào?", options: [
        "Toàn bộ cluster", "Toàn bộ topic", "Trong một partition", "Không đảm bảo gì"
      ], correct: 2, explanation: "Offset tăng dần trong từng partition; giữa các partition không có thứ tự chung." },
    { q: "Consumer Kafka nhận dữ liệu theo cơ chế nào?", options: [
        "Broker push qua websocket",
        "Consumer chủ động pull (fetch) từ broker",
        "Broker gọi webhook",
        "Qua ZooKeeper"
      ], correct: 1, explanation: "Pull cho phép consumer tự điều tốc độ và tự đọc lại." },
    { q: "Offset là gì?", options: [
        "ID toàn cục duy nhất của message trong cluster",
        "Số thứ tự tăng dần của bản ghi trong một partition",
        "Thời gian ghi message",
        "Kích thước message"
      ], correct: 1, explanation: "Partition 0 và partition 1 đều có offset 0 — offset chỉ có nghĩa kèm (topic, partition)." },
    { q: "Muốn xử lý lại dữ liệu 3 ngày qua sau khi sửa bug consumer, trong khi retention là 7 ngày. Làm gì?", options: [
        "Không thể, message đã bị ack",
        "Reset offset của group về thời điểm 3 ngày trước rồi chạy lại",
        "Bắt producer gửi lại",
        "Tạo topic mới"
      ], correct: 1, explanation: "kafka-consumer-groups.sh --reset-offsets --to-datetime ... (khi group đang dừng)." },
    { q: "Điểm yếu của Kafka so với RabbitMQ là gì?", options: [
        "Không lưu được message",
        "Không có routing phức tạp/priority/ack từng message; xử lý lỗi từng message phải tự dựng",
        "Không chạy được nhiều consumer",
        "Chậm hơn nhiều"
      ], correct: 1, explanation: "Retry/DLQ trong Kafka là pattern ở phía ứng dụng (bài 17)." },
    { q: "'Commit offset 3' của một group nghĩa là gì?", options: [
        "Đã xử lý message offset 3",
        "Lần tới group sẽ bắt đầu đọc từ offset 3 (đã xong 0..2)",
        "Broker xoá message 0..3",
        "Có 3 consumer trong group"
      ], correct: 1, explanation: "Quy ước: offset commit là offset của message TIẾP THEO cần đọc." }
  ]
});
