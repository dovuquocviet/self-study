window.LESSONS.push({
  id: "17",
  phase: "3", phaseName: "Các mô hình dữ liệu",
  title: "Log phân tán — Kafka như một database chỉ-thêm",
  subtitle: "Partition = log append-only · offset · key → partition · consumer group · retention & log compaction",

  theory: `
    <p>Bài 03: mọi DB đều có một log bên dưới. Kafka đưa log đó lên làm <strong>mô hình dữ liệu chính</strong>: một chuỗi bản ghi chỉ thêm, có thứ tự, đọc lại được,
    cho nhiều bên cùng đọc với tốc độ riêng. Nó không phải hàng đợi kiểu "đọc xong là mất".</p>

    <p><strong>1. Topic, partition, offset</strong></p>
    <ul>
      <li>Topic chia thành nhiều <strong>partition</strong>. Mỗi partition là một log append-only; mỗi bản ghi có <strong>offset</strong> tăng dần <em>trong partition đó</em>.</li>
      <li>Trên đĩa, partition là thư mục gồm các <strong>segment</strong> (mặc định 1 GB): file <code>.log</code> + <code>.index</code> (offset → vị trí) + <code>.timeindex</code>. Chỉ segment cuối được ghi.</li>
      <li>Thứ tự chỉ được đảm bảo <strong>trong một partition</strong>. Producer chọn partition theo <em>key</em> (băm murmur2 % số partition) → mọi sự kiện của đơn 1001 vào cùng partition, giữ thứ tự.</li>
      <li>Tăng số partition sau này làm đổi ánh xạ key → partition: thứ tự theo key bị xáo trộn tại thời điểm đổi. Chọn số partition từ đầu cho dư.</li>
    </ul>

    <p><strong>2. Vì sao nhanh</strong>: chỉ ghi tuần tự vào cuối file; đọc cũng tuần tự; dựa vào page cache của OS (bài 02) thay vì cache riêng; gửi dữ liệu cho consumer bằng
    zero-copy (<code>sendfile</code>) từ page cache ra socket; gom lô và nén theo batch.</p>

    <p><strong>3. Consumer group</strong></p>
    <ul>
      <li>Mỗi partition được gán cho <em>đúng một</em> consumer trong một group → song song tối đa = số partition. Consumer thừa ngồi chơi.</li>
      <li>Group lưu vị trí đã xử lý (<em>committed offset</em>) trong topic nội bộ <code>__consumer_offsets</code>. Group khác (vd ClickHouse, search indexer) có offset riêng, đọc độc lập.</li>
      <li>Commit offset <em>sau</em> khi xử lý → at-least-once (crash giữa chừng thì xử lý lại) → consumer phải <strong>idempotent</strong>. Commit trước → at-most-once.</li>
      <li><strong>Consumer lag</strong> = offset cuối của partition − offset đã commit: chỉ số sức khoẻ quan trọng nhất.</li>
    </ul>

    <p><strong>4. Giữ dữ liệu bao lâu</strong></p>
    <ul>
      <li><code>cleanup.policy=delete</code>: xoá cả segment cũ theo <code>retention.ms</code> (mặc định 7 ngày) hoặc <code>retention.bytes</code>.</li>
      <li><code>cleanup.policy=compact</code>: <strong>log compaction</strong> giữ ít nhất bản ghi <em>mới nhất cho mỗi key</em>; bản ghi value = null là tombstone để xoá key. Topic trở thành "bảng" trạng thái hiện tại
      — dựng lại cache/DB bằng cách đọc từ offset 0.</li>
    </ul>

    <p><strong>5. Độ bền</strong>: mỗi partition có một leader và các follower; tập đồng bộ gọi là <strong>ISR</strong>. <code>acks=all</code> + <code>min.insync.replicas=2</code>
    (với replication factor 3) = ghi chỉ thành công khi ít nhất 2 bản đã có. Producer idempotent (mặc định bật từ Kafka 3.0) chống ghi trùng khi retry.
    Kafka 4.0 bỏ hẳn ZooKeeper, metadata do KRaft quản lý.</p>

    <div class="callout"><p>💡 Kafka là "nguồn sự thật dạng sự kiện", còn PostgreSQL/ES/ClickHouse/Redis có thể là các <em>view</em> dựng từ log. Muốn thêm một view mới?
    Tạo consumer group mới, đọc từ đầu (nếu retention còn đủ hoặc topic được compact). Đây là lý do log là cấu trúc trung tâm của kiến trúc nhiều DB.</p></div>
  `,

  codeTabs: [
    { id: "log", label: "Partition trên đĩa", lines: [
      "topic orders, 6 partition, replication factor 3",
      "",
      "/var/kafka/orders-3/",
      "  00000000000000000000.log        # segment cũ (đầy 1 GB, chỉ đọc)",
      "  00000000000000000000.index      # offset → vị trí byte",
      "  00000000000000000000.timeindex  # timestamp → offset",
      "  00000000000000088000.log        # segment đang ghi (active)",
      "",
      "offset: 88210  88211  88212  88213  ← append ở cuối",
      "        o:1001 o:1007 o:1001 o:1001    (key)"
    ]},
    { id: "producer", label: "Producer & key", lines: [
      "Properties p = new Properties();",
      "p.put(\"acks\", \"all\");                 // chờ đủ ISR",
      "p.put(\"enable.idempotence\", \"true\");  // mặc định từ 3.0, chống trùng khi retry",
      "",
      "// key = orderId → cùng partition → giữ thứ tự sự kiện của đơn",
      "producer.send(new ProducerRecord<>(\"orders\", \"1001\", \"{\\\"type\\\":\\\"OrderPaid\\\"}\"));",
      "",
      "// partition = murmur2(key) % numPartitions",
      "// tăng numPartitions → key có thể sang partition khác"
    ]},
    { id: "consumer", label: "Consumer group", lines: [
      "@KafkaListener(topics = \"orders\", groupId = \"search-indexer\")",
      "public void on(ConsumerRecord<String, String> rec) {",
      "    esIndexer.upsert(rec.key(), rec.value());   // idempotent: upsert theo id",
      "}",
      "// Spring Kafka (AckMode BATCH mặc định) commit SAU khi xử lý xong lô poll → at-least-once",
      "",
      "# xem lag",
      "kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group search-indexer",
      "# PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG",
      "# 3          88150           88213           63"
    ]},
    { id: "retention", label: "Retention & compaction", lines: [
      "# topic sự kiện: giữ 7 ngày (mặc định)",
      "kafka-configs.sh --alter --entity-type topics --entity-name orders \\",
      "  --add-config retention.ms=604800000",
      "",
      "# topic trạng thái: giữ bản mới nhất mỗi key",
      "kafka-configs.sh --alter --entity-type topics --entity-name product-prices \\",
      "  --add-config cleanup.policy=compact",
      "",
      "# trước compaction: sku1=100 sku2=50 sku1=120 sku2=null",
      "# sau compaction:   sku1=120            (sku2 bị xoá nhờ tombstone)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="prod"><div class="nl">✍️ Producer</div><div class="ns">key=1001 → murmur2 % 6</div></div>
    <div class="arrow" id="a1">↓ append vào partition 3 (leader)</div>
    <div class="node" id="part"><div class="nl">📜 orders-3</div><div class="ns">… 88211 · 88212 · 88213 →</div></div>
    <div class="arrow" id="a2">↓ follower trong ISR sao chép, acks=all</div>
    <div class="row">
      <div class="node" id="g1"><div class="nl">🔎 group search-indexer</div><div class="ns">offset 88150 (lag 63)</div></div>
      <div class="node" id="g2"><div class="nl">📊 group clickhouse</div><div class="ns">offset 88213 (lag 0)</div></div>
    </div>
    <div class="arrow" id="a3">↓ retention / compaction</div>
    <div class="node" id="ret"><div class="nl">🧹 Xoá segment cũ hoặc giữ bản mới nhất mỗi key</div><div class="ns">delete vs compact</div></div>
  `,
  steps: [
    { title: "1 · Key quyết định partition", tab: "producer", highlight: [5, 6, 8, 9], on: ["prod", "a1"],
      desc: "Cùng key → cùng partition → cùng thứ tự. Thứ tự giữa các partition thì không đảm bảo." },
    { title: "2 · Log append-only chia segment", tab: "log", highlight: [4, 5, 7, 9, 10], on: ["part"],
      desc: "Chỉ ghi vào cuối segment active; offset tăng dần trong partition." },
    { title: "3 · Bền nhờ nhân bản", tab: "producer", highlight: [2, 3], on: ["a2"],
      desc: "acks=all + min.insync.replicas: thành công khi đủ bản sao. Idempotence chống trùng khi retry." },
    { title: "4 · Mỗi group một offset riêng", tab: "consumer", highlight: [1, 3, 5], on: ["g1", "g2"],
      desc: "search-indexer và clickhouse đọc cùng log với tốc độ riêng. Commit sau xử lý → at-least-once → cần idempotent." },
    { title: "5 · Theo dõi lag", tab: "consumer", highlight: [8, 9, 10], on: ["g1"],
      desc: "Lag tăng đều = consumer không theo kịp; thêm partition/consumer hoặc tối ưu xử lý." },
    { title: "6 · Retention & compaction", tab: "retention", highlight: [3, 7, 9, 10], on: ["a3", "ret"],
      desc: "delete: log sự kiện có hạn. compact: log thành bảng trạng thái mới nhất theo key." }
  ],

  quiz: [
    { q: "Kafka đảm bảo thứ tự bản ghi ở phạm vi nào?", options: [
        "Toàn topic", "Trong một partition", "Toàn cluster", "Không đảm bảo"
      ], correct: 1, explanation: "Muốn giữ thứ tự theo thực thể thì dùng id thực thể làm key." },
    { q: "Producer chọn partition cho bản ghi có key thế nào (mặc định)?", options: [
        "Ngẫu nhiên", "Băm key (murmur2) modulo số partition", "Theo thời gian", "Theo kích thước message"
      ], correct: 1, explanation: "Nên đổi số partition sẽ đổi ánh xạ." },
    { q: "Trong một consumer group, một partition được đọc bởi bao nhiêu consumer cùng lúc?", options: [
        "Tất cả consumer", "Đúng một", "Hai", "Tuỳ kích thước"
      ], correct: 1, explanation: "Nên song song tối đa bằng số partition." },
    { q: "Hai consumer group khác nhau đọc cùng topic thì?", options: [
        "Chia nhau message",
        "Mỗi group nhận đủ mọi message với offset riêng",
        "Group sau không nhận gì",
        "Lỗi"
      ], correct: 1, explanation: "Đây là khác biệt lớn với hàng đợi truyền thống." },
    { q: "Commit offset sau khi xử lý dẫn tới ngữ nghĩa nào?", options: [
        "At-most-once", "At-least-once — cần xử lý idempotent", "Exactly-once tự động", "Không đảm bảo gì"
      ], correct: 1, explanation: "Crash giữa xử lý và commit sẽ xử lý lại." },
    { q: "Log compaction giữ lại gì?", options: [
        "Bản ghi cũ nhất mỗi key",
        "Ít nhất bản ghi mới nhất cho mỗi key; value null là tombstone xoá key",
        "Chỉ 7 ngày gần nhất",
        "Không giữ gì"
      ], correct: 1, explanation: "Biến topic thành bảng trạng thái hiện tại." },
    { q: "retention.ms mặc định của Kafka?", options: ["1 giờ", "24 giờ", "7 ngày", "Vĩnh viễn"], correct: 2,
      explanation: "604800000 ms = 168 giờ." },
    { q: "Vì sao Kafka đạt thông lượng cao?", options: [
        "Lưu mọi thứ trong heap JVM",
        "Ghi/đọc tuần tự, dựa vào page cache OS, zero-copy sendfile, gom lô và nén",
        "Không ghi đĩa",
        "Dùng B-tree"
      ], correct: 1, explanation: "Thiết kế quanh truy cập tuần tự." },
    { q: "Consumer lag là gì?", options: [
        "Độ trễ mạng",
        "Khoảng cách giữa offset cuối của partition và offset group đã commit",
        "Số consumer",
        "Kích thước segment"
      ], correct: 1, explanation: "Chỉ số chính để biết consumer có theo kịp không." },
    { q: "acks=all kết hợp min.insync.replicas=2 (RF=3) nghĩa là?", options: [
        "Ghi thành công khi ít nhất 2 bản sao trong ISR đã có bản ghi",
        "Ghi vào 2 topic",
        "Chỉ leader xác nhận",
        "Không cần replica"
      ], correct: 0, explanation: "ISR còn dưới 2 thì producer nhận lỗi NotEnoughReplicas." }
  ]
});
