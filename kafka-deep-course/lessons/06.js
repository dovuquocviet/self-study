window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "Producer sâu",
  title: "Bên trong producer: batching, linger, nén và bộ đệm",
  subtitle: "send() không gửi ngay · batch.size · linger.ms · compression · buffer đầy thì sao",

  theory: `
    <p>Gọi <code>send()</code> <strong>không</strong> đồng nghĩa với một request mạng. Producer là một pipeline bất đồng bộ:</p>
    <ol>
      <li><strong>Serialize</strong> key/value thành byte (trong Rust bạn tự đưa byte).</li>
      <li><strong>Partitioner</strong> chọn partition (bài 07).</li>
      <li>Record được thêm vào <strong>batch</strong> đang mở của partition đó trong bộ đệm (Java: <em>RecordAccumulator</em>; librdkafka: hàng đợi nội bộ).</li>
      <li>Một <strong>luồng nền</strong> (Java: Sender thread; librdkafka: thread riêng mỗi broker) gom các batch cùng leader thành một ProduceRequest và gửi đi.</li>
      <li>Có phản hồi → hoàn tất future/callback của từng record (trong rdkafka: <code>send().await</code> trả về <code>Delivery</code>).</li>
    </ol>

    <p><strong>Khi nào một batch được gửi?</strong> Khi <em>đầy</em> (<code>batch.size</code>) <strong>hoặc</strong> đã chờ đủ <code>linger.ms</code>, tuỳ cái nào tới trước.</p>
    <table>
      <tr><th>Cấu hình</th><th>Java (Kafka 4.x)</th><th>librdkafka</th><th>Ý nghĩa</th></tr>
      <tr><td><code>batch.size</code></td><td>16384 byte</td><td>1000000 byte (kèm <code>batch.num.messages</code>=10000)</td><td>Trần kích thước một batch / partition</td></tr>
      <tr><td><code>linger.ms</code></td><td>5 (trước 4.0 là 0)</td><td>5 (<code>queue.buffering.max.ms</code>)</td><td>Chờ thêm để gom batch</td></tr>
      <tr><td><code>compression.type</code></td><td>none</td><td>none</td><td>gzip / snappy / lz4 / zstd</td></tr>
      <tr><td>Bộ đệm</td><td><code>buffer.memory</code>=32 MiB, đầy thì <code>send()</code> chặn tới <code>max.block.ms</code>=60s</td><td><code>queue.buffering.max.messages</code> / <code>.kbytes</code>, đầy trả lỗi QueueFull</td><td>Chặn tràn RAM khi broker chậm</td></tr>
    </table>

    <p><strong>linger là núm vặn độ trễ ↔ thông lượng</strong>: linger 0 thì mỗi record có thể thành một request nhỏ; linger 5–50ms gom được nhiều record/batch →
    ít request hơn, nén tốt hơn, broker nhẹ hơn. Tải cao thì batch đầy trước khi hết linger, nên linger gần như không thêm độ trễ.</p>

    <p><strong>Nén theo batch</strong>: cả batch được nén một lần ở producer, broker lưu nguyên dạng nén (trừ khi topic đặt <code>compression.type</code> khác với producer),
    consumer giải nén. Batch càng to, nén càng hiệu quả. <code>zstd</code> hoặc <code>lz4</code> là lựa chọn phổ biến; JSON thường nén được 3–10 lần.</p>

    <p><strong>Timeout</strong>: <code>request.timeout.ms</code> (30s) cho từng request; <code>delivery.timeout.ms</code> (120s) là <em>tổng</em> thời gian từ lúc send tới lúc báo lỗi cuối,
    bao gồm chờ trong buffer + các lần retry. Phải ≥ linger.ms + request.timeout.ms. <code>max.request.size</code> (1 MiB) giới hạn kích thước request;
    phía broker/topic có <code>message.max.bytes</code>.</p>

    <div class="callout"><p>💡 Trong service Rust, <code>FutureProducer</code> nên tạo <strong>một lần</strong> và chia sẻ (nó clone rẻ, thread-safe). Tạo producer mỗi request = mỗi lần một
    kết nối mới + batch rỗng — chậm và phí. Khi tắt service, gọi <code>producer.flush(timeout)</code> để gửi nốt những gì còn trong buffer.</p></div>
  `,

  codeTabs: [
    { id: "pipe", label: "① Đường đi của send()", lines: [
      "app: producer.send(record)",
      "  -> serialize(key, value)",
      "  -> partition = partitioner(key, numPartitions)",
      "  -> accumulator[orders-3].append(record)      // vào batch đang mở",
      "     (trả về future ngay, CHƯA có gì đi qua mạng)",
      "",
      "sender thread (nền):",
      "  mỗi vòng: batch nào đầy HOẶC quá linger.ms -> sẵn sàng",
      "  gom các batch cùng leader -> 1 ProduceRequest -> broker",
      "  nhận ProduceResponse -> complete future của từng record"
    ]},
    { id: "rust", label: "② Producer Rust thông lượng cao", lines: [
      "let producer: FutureProducer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", &cfg.brokers)",
      "    .set(\"acks\", \"all\")",
      "    .set(\"enable.idempotence\", \"true\")",
      "    .set(\"linger.ms\", \"20\")              // gom batch lâu hơn chút",
      "    .set(\"compression.type\", \"zstd\")",
      "    .set(\"batch.size\", \"262144\")         // 256 KiB",
      "    .set(\"queue.buffering.max.kbytes\", \"262144\")",
      "    .create()?;",
      "",
      "// gửi song song nhiều record, rồi chờ tất cả",
      "let futs = events.iter().map(|e| producer.send(",
      "    FutureRecord::to(\"orders\").key(&e.order_id).payload(&e.json), Duration::from_secs(1)));",
      "let results = futures::future::join_all(futs).await;"
    ]},
    { id: "java", label: "③ Java/Spring", lines: [
      "spring.kafka.producer.batch-size=262144",
      "spring.kafka.producer.compression-type=zstd",
      "spring.kafka.producer.properties.linger.ms=20",
      "spring.kafka.producer.buffer-memory=67108864",
      "",
      "// send() trong Java cũng bất đồng bộ; .get() ngay sau mỗi send",
      "// = gửi từng message một, phá hỏng batching:",
      "kafkaTemplate.send(\"orders\", k, v).get();   // chậm!"
    ]},
    { id: "shutdown", label: "④ Tắt service an toàn", lines: [
      "// nhận SIGTERM (vd Kubernetes rolling update)",
      "tokio::signal::ctrl_c().await?;",
      "stop_accepting_requests();",
      "",
      "// gửi nốt record còn trong bộ đệm, tối đa 10s",
      "producer.flush(Duration::from_secs(10))?;",
      "",
      "// không flush: record đang nằm trong batch chưa gửi sẽ biến mất khi process thoát"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🦀 app gọi send()</div><div class="ns">trả future ngay</div></div>
    <div class="arrow" id="a1">↓ serialize → partitioner</div>
    <div class="row">
      <div class="node" id="b0"><div class="nl">batch orders-0</div><div class="ns">đang gom…</div></div>
      <div class="node" id="b3"><div class="nl">batch orders-3</div><div class="ns">đầy hoặc hết linger</div></div>
    </div>
    <div class="arrow" id="a2">↓ luồng nền: nén · gom theo leader · ProduceRequest</div>
    <div class="node" id="br"><div class="nl">📦 Broker leader</div><div class="ns">lưu batch nguyên dạng nén</div></div>
    <div class="arrow" id="a3">↑ response → hoàn tất future (partition, offset)</div>
  `,
  steps: [
    { title: "1 · send() chỉ xếp hàng", tab: "pipe", highlight: [1, 2, 3, 4, 5], on: ["app", "a1", "b0", "b3"],
      desc: "Serialize, chọn partition, thêm vào batch trong bộ nhớ. Hàm trả về ngay; chưa có byte nào ra mạng." },
    { title: "2 · Điều kiện gửi batch", tab: "pipe", highlight: [8, 9], on: ["b3", "a2"],
      desc: "Batch đầy (batch.size) hoặc chờ quá linger.ms. Các batch của nhiều partition cùng leader đi chung một request." },
    { title: "3 · Tinh chỉnh thông lượng", tab: "rust", highlight: [5, 6, 7, 8], on: ["b3", "br"],
      desc: "linger lớn hơn + batch lớn + zstd: ít request, nén tốt, broker nhẹ hơn. Đổi lại vài chục ms độ trễ ở tải thấp." },
    { title: "4 · Chờ kết quả hàng loạt", tab: "rust", highlight: [12, 13, 14], on: ["a3", "app"],
      desc: "Gửi nhiều rồi mới await tất cả — batching phát huy. Await từng cái tuần tự trước khi gửi cái tiếp theo = mất batching." },
    { title: "5 · Anti-pattern .get()", tab: "java", highlight: [6, 7, 8], on: ["app"],
      desc: "Chặn chờ từng message biến producer thành đồng bộ, thông lượng giảm hàng chục lần." },
    { title: "6 · Flush khi tắt", tab: "shutdown", highlight: [2, 6, 8], on: ["b0", "br"],
      desc: "Bộ đệm nằm trong RAM của process. Không flush = mất những gì chưa gửi." }
  ],

  quiz: [
    { q: "Gọi producer.send() thì điều gì xảy ra ngay lập tức?", options: [
        "Mở TCP và gửi đi, chờ broker trả lời",
        "Record được serialize, chọn partition, thêm vào batch trong bộ đệm; hàm trả future",
        "Ghi vào đĩa cục bộ",
        "Gửi tới controller"
      ], correct: 1, explanation: "Mạng do luồng nền đảm nhiệm." },
    { q: "Batch được gửi khi nào?", options: [
        "Chỉ khi đầy",
        "Khi đầy batch.size HOẶC đã chờ đủ linger.ms",
        "Mỗi giây một lần",
        "Khi consumer yêu cầu"
      ], correct: 1, explanation: "Cái nào tới trước." },
    { q: "Tăng linger.ms từ 0 lên 20 ở tải cao thường dẫn đến…", options: [
        "Độ trễ tăng thêm đúng 20ms cho mọi message",
        "Batch to hơn, ít request hơn, nén tốt hơn; độ trễ tăng không đáng kể vì batch thường đầy sớm",
        "Mất message",
        "Tắt nén"
      ], correct: 1, explanation: "Ở tải thấp thì mới thấy rõ độ trễ thêm." },
    { q: "Nén (compression.type) được áp dụng ở mức nào?", options: [
        "Từng message riêng lẻ", "Cả record batch, nén một lần ở producer", "Cả segment ở broker", "Chỉ khi truyền qua TLS"
      ], correct: 1, explanation: "Batch to → nén hiệu quả hơn." },
    { q: "Producer Java: buffer.memory đầy vì broker chậm. send() làm gì?", options: [
        "Bỏ message", "Chặn tối đa max.block.ms rồi ném exception", "Ghi ra đĩa", "Gửi đồng bộ"
      ], correct: 1, explanation: "librdkafka thì trả lỗi QueueFull; rdkafka FutureProducer::send retry theo queue_timeout." },
    { q: "delivery.timeout.ms bao gồm những gì?", options: [
        "Chỉ thời gian một request mạng",
        "Tổng thời gian từ send tới lúc báo kết quả cuối: chờ trong buffer, gửi và mọi lần retry",
        "Thời gian consumer xử lý",
        "Thời gian bầu leader"
      ], correct: 1, explanation: "request.timeout.ms mới là cho từng request." },
    { q: "Gọi kafkaTemplate.send(...).get() sau mỗi message gây ra gì?", options: [
        "Tăng thông lượng",
        "Biến việc gửi thành tuần tự từng message, gần như mất tác dụng batching",
        "Tắt acks",
        "Không ảnh hưởng"
      ], correct: 1, explanation: "Gửi nhiều rồi mới chờ kết quả." },
    { q: "Vì sao cần producer.flush() khi tắt service?", options: [
        "Để xoá topic",
        "Để gửi nốt record còn trong bộ đệm RAM trước khi process thoát",
        "Để commit offset",
        "Để đóng controller"
      ], correct: 1, explanation: "Không flush thì record chưa gửi mất cùng process." },
    { q: "Nên tạo FutureProducer thế nào trong service Rust?", options: [
        "Mỗi request một producer",
        "Một producer dùng chung (clone/Arc) cho cả service",
        "Mỗi partition một producer",
        "Mỗi thread một producer bắt buộc"
      ], correct: 1, explanation: "Producer giữ kết nối và batch; tạo lại liên tục rất đắt." },
    { q: "Kafka 4.0 đổi giá trị mặc định linger.ms của producer Java thành bao nhiêu?", options: ["0", "5", "100", "1000"], correct: 1,
      explanation: "KIP-1030 đổi từ 0 sang 5ms vì gom batch tốt hơn mà độ trễ thêm không đáng kể." }
  ]
});
