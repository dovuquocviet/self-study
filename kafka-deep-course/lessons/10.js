window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Consumer sâu",
  title: "Consumer group & vòng poll: ai đọc partition nào, sống chết ra sao",
  subtitle: "group coordinator · 1 partition ↔ 1 consumer · heartbeat · session.timeout · max.poll.interval",

  theory: `
    <p><strong>Consumer group</strong> = nhiều consumer cùng <code>group.id</code> chia nhau các partition của topic. Luật cứng:
    <strong>trong một group, mỗi partition chỉ được giao cho đúng một consumer</strong>. Một consumer có thể giữ nhiều partition.</p>
    <ul>
      <li>6 partition, 3 instance → mỗi instance 2 partition.</li>
      <li>6 partition, 8 instance → 2 instance ngồi chơi. <em>Số partition là trần song song của một group.</em></li>
      <li>Thêm/bớt instance, instance chết, topic thêm partition → <strong>rebalance</strong>: chia lại (bài 11).</li>
    </ul>

    <p><strong>Group coordinator</strong>: một broker được chọn (theo hash của group.id trên <code>__consumer_offsets</code>) để quản lý group: thành viên, chia partition, lưu offset đã commit.</p>

    <p><strong>Vòng poll</strong> — trái tim của consumer:</p>
    <ol>
      <li><code>poll()</code> trả về một lô record (tối đa <code>max.poll.records</code>=500 ở Java) từ các partition được giao. Client đã prefetch sẵn ở nền.</li>
      <li>Ứng dụng xử lý lô.</li>
      <li>Commit offset (tự động hoặc thủ công — bài 12).</li>
      <li>Quay lại poll.</li>
    </ol>

    <p><strong>Hai cơ chế "còn sống" độc lập</strong> — hiểu sai chỗ này là nguồn của rebalance liên tục:</p>
    <table>
      <tr><th>Cơ chế</th><th>Mặc định</th><th>Phát hiện</th></tr>
      <tr><td>Heartbeat nền (<code>heartbeat.interval.ms</code>) + <code>session.timeout.ms</code></td><td>3s / 45s</td><td>Process chết, mất mạng</td></tr>
      <tr><td><code>max.poll.interval.ms</code></td><td>300000 (5 phút)</td><td>Process sống nhưng <strong>kẹt</strong>: không gọi poll lại trong 5 phút (xử lý lô quá lâu, deadlock, gọi API treo)</td></tr>
    </table>
    <p>Vượt max.poll.interval → consumer tự rời group, partition bị giao cho người khác; lô đang xử lý dở sẽ được người khác xử lý lại (trùng),
    và lần commit sau của consumer cũ bị từ chối (<code>CommitFailedException</code> ở Java). Cách chữa: giảm kích thước lô, xử lý nhanh hơn, đặt timeout cho lời gọi ngoài, hoặc tăng max.poll.interval có cân nhắc.</p>

    <p><strong>librdkafka / rdkafka</strong> hoạt động tương tự: <code>StreamConsumer::recv()</code> trả từng message (lấy từ hàng đợi đã prefetch). Gọi <code>recv()</code> chính là "poll";
    nếu bạn giữ một message và xử lý quá <code>max.poll.interval.ms</code> mà không gọi recv tiếp, consumer bị đá khỏi group. <code>auto.offset.reset</code>
    (earliest/latest) quyết định đọc từ đâu khi group <em>chưa có</em> offset commit — mặc định <code>latest</code>: group mới sẽ bỏ qua dữ liệu cũ.</p>

    <div class="callout"><p>💡 Spring <code>ConcurrentKafkaListenerContainerFactory.setConcurrency(3)</code> = 3 consumer (3 thread) trong cùng group trên một JVM. Chạy 4 pod × concurrency 3 = 12 consumer —
    topic chỉ có 6 partition thì 6 consumer ngồi chơi.</p></div>
  `,

  codeTabs: [
    { id: "assign", label: "① Chia partition", lines: [
      "topic orders: 6 partition   group.id = billing",
      "",
      "2 instance: c1 -> [0,1,2]   c2 -> [3,4,5]",
      "3 instance: c1 -> [0,1]     c2 -> [2,3]   c3 -> [4,5]",
      "8 instance: c1..c6 mỗi cái 1 partition, c7 c8 -> []  (ngồi chơi)",
      "",
      "group khác (clickhouse-ingest) có cách chia RIÊNG, không liên quan billing"
    ]},
    { id: "rust", label: "② Poll loop Rust", lines: [
      "let consumer: StreamConsumer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", &cfg.brokers)",
      "    .set(\"group.id\", \"billing\")",
      "    .set(\"auto.offset.reset\", \"earliest\")",
      "    .set(\"session.timeout.ms\", \"45000\")",
      "    .set(\"max.poll.interval.ms\", \"300000\")",
      "    .create()?;",
      "consumer.subscribe(&[\"orders\"])?;",
      "",
      "loop {",
      "    let m = consumer.recv().await?;              // = poll",
      "    let payload = m.payload().unwrap_or_default();",
      "    handle(payload).await?;                      // phải xong trước max.poll.interval",
      "}"
    ]},
    { id: "timeline", label: "③ Kẹt quá lâu", lines: [
      "t=0      c1 nhận lô 500 message (partition 2)",
      "t=0..6m  mỗi message gọi API thanh toán, API chậm 1s -> 500s",
      "t=5m     c1 chưa poll lại -> vượt max.poll.interval.ms",
      "         c1 rời group -> REBALANCE -> partition 2 giao cho c2",
      "t=5m+    c2 đọc từ offset đã commit -> xử lý LẠI phần c1 đang làm dở",
      "t=6m     c1 xong, commit -> bị từ chối (không còn là thành viên)",
      "",
      "# sửa: max.poll.records nhỏ hơn, timeout cho API, hoặc xử lý song song có kiểm soát"
    ]},
    { id: "java", label: "④ Java/Spring", lines: [
      "spring.kafka.consumer.group-id=billing",
      "spring.kafka.consumer.auto-offset-reset=earliest",
      "spring.kafka.consumer.max-poll-records=100",
      "spring.kafka.consumer.properties.max.poll.interval.ms=300000",
      "",
      "factory.setConcurrency(3);   // 3 consumer trong group trên JVM này",
      "",
      "// KafkaConsumer (Java) KHÔNG thread-safe: mỗi thread một consumer",
      "// rdkafka StreamConsumer dùng chung qua Arc được, nhưng thứ tự xử lý là việc của bạn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="gc"><div class="nl">🧭 Group coordinator (broker)</div><div class="ns">thành viên · phân công · offset</div></div>
    <div class="arrow" id="a1">↓ phân công partition</div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">c1</div><div class="ns">[0,1]</div></div>
      <div class="node" id="c2"><div class="nl">c2</div><div class="ns">[2,3]</div></div>
      <div class="node" id="c3"><div class="nl">c3</div><div class="ns">[4,5]</div></div>
    </div>
    <div class="arrow" id="a2">↻ poll → xử lý → commit → poll</div>
    <div class="row">
      <div class="node" id="hb"><div class="nl">💓 heartbeat</div><div class="ns">session.timeout 45s: chết?</div></div>
      <div class="node" id="mp"><div class="nl">⏱️ max.poll.interval</div><div class="ns">5 phút: kẹt?</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Mỗi partition một chủ", tab: "assign", highlight: [3, 4, 5], on: ["gc", "a1", "c1", "c2", "c3"],
      desc: "Số partition là trần song song. Consumer thừa ngồi chơi — chỉ có ích như dự phòng." },
    { title: "2 · Nhóm độc lập", tab: "assign", highlight: [7], on: ["gc"],
      desc: "Mỗi group có phân công và offset riêng." },
    { title: "3 · Poll loop", tab: "rust", highlight: [3, 4, 8, 11, 13], on: ["a2"],
      desc: "recv() lấy message đã prefetch. auto.offset.reset chỉ áp dụng khi group chưa có offset." },
    { title: "4 · Heartbeat phát hiện chết", tab: "rust", highlight: [5], on: ["hb"],
      desc: "Luồng nền gửi heartbeat; không nhận được trong session.timeout → coi như chết." },
    { title: "5 · max.poll.interval phát hiện kẹt", tab: "timeline", highlight: [2, 3, 4, 5, 6], on: ["mp", "c2"],
      desc: "Heartbeat vẫn đều nhưng không poll lại → bị đá. Hậu quả: xử lý trùng và commit bị từ chối." },
    { title: "6 · Spring concurrency", tab: "java", highlight: [3, 6, 8], on: ["c1", "c2", "c3"],
      desc: "concurrency × số pod là số consumer. Vượt số partition là lãng phí." }
  ],

  quiz: [
    { q: "Topic 6 partition, group có 8 consumer. Bao nhiêu consumer nhận việc?", options: ["8", "6", "4", "1"], correct: 1,
      explanation: "Mỗi partition chỉ giao cho một consumer trong group." },
    { q: "Hai group khác nhau cùng đọc một topic thì…", options: [
        "Chia nhau partition",
        "Mỗi group đọc toàn bộ, phân công và offset độc lập",
        "Group sau bị chặn",
        "Phải khác topic"
      ], correct: 1, explanation: "Group là đơn vị chia việc và lưu tiến độ." },
    { q: "session.timeout.ms phát hiện tình huống nào?", options: [
        "Xử lý lô quá lâu",
        "Consumer chết/mất mạng (không có heartbeat)",
        "Lag cao",
        "Schema sai"
      ], correct: 1, explanation: "Heartbeat chạy ở luồng nền độc lập với xử lý." },
    { q: "max.poll.interval.ms phát hiện tình huống nào?", options: [
        "Process chết",
        "Process còn sống nhưng không gọi poll lại đủ nhanh (kẹt/xử lý quá lâu)",
        "Broker chết",
        "Mạng chậm"
      ], correct: 1, explanation: "Mặc định 5 phút." },
    { q: "Consumer xử lý một lô mất 7 phút với max.poll.interval.ms mặc định. Hậu quả?", options: [
        "Không sao",
        "Bị đá khỏi group, partition giao cho consumer khác xử lý lại; commit sau đó của nó bị từ chối",
        "Broker chờ",
        "Message bị xoá"
      ], correct: 1, explanation: "Giảm max.poll.records hoặc tăng tốc xử lý." },
    { q: "auto.offset.reset=latest (mặc định) nghĩa là group MỚI sẽ…", options: [
        "Đọc từ đầu topic",
        "Bắt đầu từ cuối, bỏ qua dữ liệu có sẵn",
        "Báo lỗi",
        "Đọc ngẫu nhiên"
      ], correct: 1, explanation: "Chỉ áp dụng khi chưa có offset commit (hoặc offset commit đã hết hạn/không hợp lệ)." },
    { q: "Group coordinator là gì?", options: [
        "Controller KRaft",
        "Một broker quản lý thành viên, phân công và offset của group",
        "Một thư viện client",
        "ZooKeeper"
      ], correct: 1, explanation: "Được chọn theo partition của __consumer_offsets chứa group đó." },
    { q: "Spring concurrency=3, chạy 4 pod, topic 6 partition. Kết quả?", options: [
        "12 consumer đều có việc",
        "12 consumer nhưng chỉ 6 có partition",
        "Lỗi khởi động",
        "3 consumer"
      ], correct: 1, explanation: "Muốn dùng hết thì tăng partition (có tính toán) hoặc giảm consumer." },
    { q: "Trong rdkafka, việc tương đương 'poll' là…", options: [
        "consumer.commit()", "consumer.recv().await (hoặc stream())", "consumer.subscribe()", "producer.flush()"
      ], correct: 1, explanation: "Không gọi recv tiếp trong max.poll.interval thì bị đá." }
  ]
});
