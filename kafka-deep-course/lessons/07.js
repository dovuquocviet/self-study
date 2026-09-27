window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Producer sâu",
  title: "Partitioner & key: message rơi vào partition nào",
  subtitle: "hash(key) % N · sticky cho key null · hot partition · bẫy Rust ↔ Java khác hàm băm",

  theory: `
    <p>Key quyết định partition, và partition quyết định <strong>thứ tự</strong> lẫn <strong>cân bằng tải</strong>. Chọn key là quyết định thiết kế, không phải chi tiết kỹ thuật.</p>

    <p><strong>Producer Java (mặc định)</strong></p>
    <ul>
      <li>Có key: <code>partition = toPositive(murmur2(keyBytes)) % numPartitions</code>. Cùng key → cùng partition → giữ thứ tự cho key đó.</li>
      <li>Key null: từ Kafka 3.3 dùng <em>uniform sticky</em>: dính vào một partition tới khi đầy một batch rồi chuyển sang partition khác (ưu tiên broker ít tải hơn). Trước đó là round-robin từng message → batch nhỏ.</li>
      <li>Có thể chỉ định partition trực tiếp hoặc viết <code>Partitioner</code> riêng.</li>
    </ul>

    <p><strong>librdkafka (rdkafka Rust) — BẪY</strong>: mặc định <code>partitioner=consistent_random</code>, tức <strong>CRC32</strong> của key, không phải murmur2.
    Cùng key "order-17", producer Java và producer Rust có thể ghi vào <em>hai partition khác nhau</em> → mất thứ tự theo key, và các consumer dựa vào "cùng key cùng partition" (vd bảng compacted, state store) bị sai.
    Khi hệ thống có cả producer Java và Rust (đang chuyển dần!), đặt <code>partitioner=murmur2_random</code> cho rdkafka — tương đương partitioner mặc định của Java.</p>

    <p><strong>Chọn key thế nào?</strong></p>
    <table>
      <tr><th>Cần gì</th><th>Key gợi ý</th></tr>
      <tr><td>Sự kiện của cùng một đơn hàng theo đúng thứ tự</td><td><code>order_id</code></td></tr>
      <tr><td>Mọi thay đổi của một khách hàng theo thứ tự</td><td><code>customer_id</code></td></tr>
      <tr><td>Không cần thứ tự, chỉ cần dàn đều (log, click)</td><td>null</td></tr>
      <tr><td>Topic compacted giữ trạng thái mới nhất</td><td>ID của thực thể (bắt buộc có key)</td></tr>
    </table>

    <p><strong>Hot partition</strong>: key phân bố lệch (một shop lớn chiếm 40% đơn, hoặc key = <code>country</code> với 90% là "VN") → một partition gánh gần hết,
    một consumer gánh gần hết, lag chỉ tăng ở partition đó. Cách xử lý: chọn key mịn hơn (order_id thay vì shop_id); nếu buộc phải theo shop thì thêm hậu tố (<em>salting</em>) — nhưng khi đó mất thứ tự toàn cục của shop.</p>

    <p><strong>Tăng số partition làm vỡ ánh xạ</strong>: <code>hash % 6</code> khác <code>hash % 12</code>. Sau khi tăng, key cũ bắt đầu vào partition mới trong khi message trước đó nằm ở partition cũ —
    trong giai đoạn chuyển tiếp thứ tự theo key không còn được đảm bảo. Kafka <strong>không cho giảm</strong> số partition. Vì vậy hãy chọn số partition dư ngay từ đầu (bài 19).</p>

    <div class="callout"><p>💡 Tương tự sharding trong DB: key của Kafka chính là shard key. Mọi bài học về shard key tệ (lệch, đổi số shard phải rehash) áp dụng nguyên xi.</p></div>
  `,

  codeTabs: [
    { id: "java", label: "① Java mặc định", lines: [
      "// BuiltInPartitioner (rút gọn)",
      "if (keyBytes == null) {",
      "    return stickyPartition(topic);          // dính tới khi đầy batch",
      "}",
      "return Utils.toPositive(Utils.murmur2(keyBytes)) % numPartitions;",
      "",
      "// \"order-17\" với 6 partition -> luôn cùng một partition",
      "// đổi thành 12 partition -> có thể sang partition khác"
    ]},
    { id: "rust", label: "② rdkafka: đặt partitioner", lines: [
      "let producer: FutureProducer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", &cfg.brokers)",
      "    // mặc định librdkafka: consistent_random (CRC32) -> KHÁC Java",
      "    .set(\"partitioner\", \"murmur2_random\")   // giống Java, key null thì ngẫu nhiên/sticky",
      "    .create()?;",
      "",
      "producer.send(",
      "    FutureRecord::to(\"orders\").key(order_id.as_str()).payload(&bytes),",
      "    Duration::from_secs(1),",
      ").await;"
    ]},
    { id: "hot", label: "③ Hot partition", lines: [
      "key = shop_id      (shop 'bigmall' = 40% đơn hàng)",
      "",
      "partition | msg/s | consumer | lag",
      "----------+-------+----------+--------",
      "    0     |  4000 |   c1     | 850000   <- nóng",
      "    1     |   900 |   c2     |      0",
      "    2     |  1100 |   c3     |      0",
      "",
      "# thêm consumer KHÔNG giúp: 1 partition chỉ do 1 consumer trong group đọc",
      "# sửa: key = order_id (thứ tự theo đơn là đủ cho nghiệp vụ)"
    ]},
    { id: "expl", label: "④ Chỉ định partition", lines: [
      "// hiếm khi cần; ví dụ tái phát (replay) có kiểm soát vào đúng partition 3",
      "FutureRecord::to(\"orders\").partition(3).key(&k).payload(&v)",
      "",
      "// kiểm tra key rơi vào đâu (debug): xem Delivery trả về",
      "let d = producer.send(rec, Duration::from_secs(1)).await.map_err(|(e, _)| e)?;",
      "tracing::debug!(partition = d.partition, offset = d.offset);"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="pj"><div class="nl">☕ Producer Java</div><div class="ns">murmur2(order-17) % 6 = 2</div></div>
      <div class="node" id="pr"><div class="nl">🦀 Producer Rust (mặc định)</div><div class="ns">crc32(order-17) % 6 = ?</div></div>
    </div>
    <div class="arrow" id="a1">↓ cùng key nhưng khác hàm băm</div>
    <div class="row">
      <div class="node" id="x2"><div class="nl">orders-2</div><div class="ns">OrderCreated</div></div>
      <div class="node" id="x5"><div class="nl">orders-5</div><div class="ns">OrderPaid (lạc!)</div></div>
    </div>
    <div class="arrow" id="a2">↓ sửa: partitioner=murmur2_random</div>
    <div class="node" id="ok"><div class="nl">✅ Cùng key → cùng partition</div><div class="ns">thứ tự theo đơn hàng được giữ</div></div>
  `,
  steps: [
    { title: "1 · Java: murmur2 % N", tab: "java", highlight: [2, 3, 5], on: ["pj", "x2"],
      desc: "Có key thì băm murmur2; không key thì sticky theo batch." },
    { title: "2 · Rust mặc định khác", tab: "rust", highlight: [3], on: ["pr", "a1", "x5"],
      desc: "consistent_random dùng CRC32. Trong giai đoạn Java và Rust cùng ghi một topic, sự kiện của cùng đơn hàng có thể lạc sang partition khác." },
    { title: "3 · Đồng bộ hàm băm", tab: "rust", highlight: [4, 8], on: ["a2", "ok"],
      desc: "murmur2_random tương thích partitioner mặc định của Java. Làm điều này ngay khi service Rust đầu tiên bắt đầu produce." },
    { title: "4 · Hot partition", tab: "hot", highlight: [1, 5, 9, 10], on: ["x2"],
      desc: "Key lệch làm một partition quá tải. Thêm consumer vô ích vì một partition chỉ có một consumer trong group." },
    { title: "5 · Tăng partition làm đổi ánh xạ", tab: "java", highlight: [7, 8], on: ["x2", "x5"],
      desc: "hash % 6 ≠ hash % 12. Chọn đủ partition từ đầu; nếu phải tăng, hiểu rằng thứ tự theo key bị xáo trong giai đoạn chuyển." }
  ],

  quiz: [
    { q: "Producer Java mặc định chọn partition cho record có key thế nào?", options: [
        "Round-robin", "murmur2(key) dương hoá rồi % số partition", "CRC32(key) % số partition", "Ngẫu nhiên"
      ], correct: 1, explanation: "BuiltInPartitioner của Java." },
    { q: "Partitioner mặc định của librdkafka là gì?", options: [
        "murmur2", "consistent_random (CRC32 của key, key rỗng/null thì ngẫu nhiên)", "round_robin", "fnv1a"
      ], correct: 1, explanation: "Khác Java — cần đặt murmur2_random nếu muốn tương thích." },
    { q: "Công ty có producer Java và Rust cùng ghi topic orders với key order_id. Rủi ro nếu để mặc định?", options: [
        "Không có rủi ro",
        "Cùng order_id có thể vào hai partition khác nhau → mất thứ tự theo đơn hàng",
        "Rust không ghi được",
        "Message bị nén hai lần"
      ], correct: 1, explanation: "Đặt partitioner=murmur2_random ở phía rdkafka." },
    { q: "Record key null ở producer Java 3.3+ được phân phối thế nào?", options: [
        "Luôn vào partition 0",
        "Uniform sticky: dính một partition tới khi đầy batch rồi chuyển",
        "Round-robin từng message",
        "Bị từ chối"
      ], correct: 1, explanation: "Sticky giúp batch to hơn so với round-robin từng message." },
    { q: "Một partition có lag rất cao, các partition khác 0. Thêm consumer vào group có giúp không?", options: [
        "Có, luôn giúp",
        "Không — một partition chỉ do một consumer trong group đọc; phải sửa key/phân bố",
        "Có nếu tăng max.poll.records",
        "Có nếu dùng acks=0"
      ], correct: 1, explanation: "Hot partition là vấn đề phân bố key." },
    { q: "Tăng topic từ 6 lên 12 partition ảnh hưởng gì tới key?", options: [
        "Không ảnh hưởng",
        "Nhiều key sẽ ánh xạ sang partition khác; thứ tự theo key không được đảm bảo qua thời điểm chuyển",
        "Kafka tự di chuyển message cũ sang partition mới",
        "Key bị xoá"
      ], correct: 1, explanation: "Message cũ ở nguyên chỗ; chỉ message mới đi theo ánh xạ mới." },
    { q: "Có giảm số partition của topic được không?", options: [
        "Có bằng kafka-topics --alter", "Không; phải tạo topic mới và chuyển dữ liệu", "Có khi topic rỗng", "Có trong KRaft"
      ], correct: 1, explanation: "Kafka chỉ cho tăng." },
    { q: "Topic cần giữ thứ tự mọi sự kiện của một khách hàng. Key nên là…", options: [
        "null", "customer_id", "timestamp", "UUID ngẫu nhiên mỗi message"
      ], correct: 1, explanation: "Cùng key → cùng partition → cùng thứ tự." },
    { q: "Salting key (vd shop_id + '-' + số ngẫu nhiên 0..7) giải quyết hot partition với cái giá gì?", options: [
        "Tốn đĩa gấp 8",
        "Mất thứ tự theo shop_id vì sự kiện của một shop trải trên nhiều partition",
        "Không có giá",
        "Không nén được"
      ], correct: 1, explanation: "Chỉ dùng khi nghiệp vụ không cần thứ tự toàn cục theo shop." }
  ]
});
