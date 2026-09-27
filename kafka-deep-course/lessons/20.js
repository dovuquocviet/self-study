window.LESSONS.push({
  id: "20",
  phase: "6", phaseName: "Tích hợp",
  title: "Service Kafka bằng Rust (rdkafka): từ @KafkaListener sang code tự kiểm soát",
  subtitle: "Bảng ánh xạ Spring → rdkafka · cấu hình an toàn · graceful shutdown · test",

  theory: `
    <p><code>rdkafka</code> là wrapper Rust quanh <strong>librdkafka</strong> (thư viện C của Confluent — cũng là lõi của client Python, Go, .NET, Node chính thức).
    Nghĩa là: tên cấu hình là của librdkafka (không phải Java), mặc định là của librdkafka, và bạn tự viết phần mà Spring container từng làm.</p>

    <table>
      <tr><th>Spring Kafka</th><th>rdkafka</th></tr>
      <tr><td><code>KafkaTemplate.send()</code></td><td><code>FutureProducer::send(record, queue_timeout).await</code> → <code>Result&lt;Delivery, (KafkaError, OwnedMessage)&gt;</code></td></tr>
      <tr><td><code>@KafkaListener</code> + container</td><td>Vòng <code>loop { consumer.recv().await }</code> bạn tự viết, trong một task tokio</td></tr>
      <tr><td><code>concurrency=3</code></td><td>Nhiều <code>StreamConsumer</code> cùng group.id (mỗi cái một task) hoặc lane theo key (bài 14)</td></tr>
      <tr><td>AckMode.BATCH / RECORD</td><td><code>enable.auto.offset.store=false</code> + <code>store_offset_from_message</code> (bài 12)</td></tr>
      <tr><td><code>ConsumerRebalanceListener</code></td><td><code>ConsumerContext::pre_rebalance / post_rebalance</code></td></tr>
      <tr><td><code>DefaultErrorHandler</code> + DLT</td><td>Tự viết: phân loại lỗi, retry, gửi DLQ (bài 17)</td></tr>
      <tr><td><code>JsonDeserializer</code></td><td><code>serde_json::from_slice(m.payload())</code>; Avro/Protobuf qua crate schema registry</td></tr>
      <tr><td><code>@Transactional</code> Kafka</td><td><code>init_transactions / begin / send_offsets_to_transaction / commit</code> (bài 09)</td></tr>
      <tr><td>Actuator + Micrometer</td><td><code>statistics.interval.ms</code> + <code>ClientContext::stats</code> (bài 18)</td></tr>
    </table>

    <p><strong>Cấu hình khởi điểm an toàn cho service nghiệp vụ</strong> (khác mặc định librdkafka ở các chỗ in đậm):</p>
    <ul>
      <li>Producer: <strong><code>enable.idempotence=true</code></strong>, <strong><code>partitioner=murmur2_random</code></strong> (tương thích Java), <code>compression.type=zstd</code>, <code>linger.ms</code> 5–20.</li>
      <li>Consumer: <strong><code>enable.auto.offset.store=false</code></strong>, <strong><code>partition.assignment.strategy=cooperative-sticky</code></strong>, <code>auto.offset.reset</code> đặt tường minh,
        <code>isolation.level=read_committed</code> (đã là mặc định librdkafka).</li>
    </ul>

    <p><strong>Graceful shutdown</strong> (Kubernetes gửi SIGTERM, chờ <code>terminationGracePeriodSeconds</code>): ngừng nhận message mới → xử lý nốt message đang cầm →
    store offset → commit đồng bộ → rời group (drop/close consumer) → <code>producer.flush()</code>. Làm đúng thì deploy không trùng, không mất.</p>

    <p><strong>Test</strong>: unit test logic xử lý với struct thuần (tách khỏi Kafka); integration test với Kafka thật chạy bằng <code>testcontainers</code> (có module Kafka cho Rust) hoặc docker compose trong CI.</p>

    <div class="callout"><p>💡 Build: rdkafka mặc định biên dịch librdkafka từ mã nguồn (feature <code>cmake-build</code>) — cần cmake, và bật feature <code>ssl</code>/<code>sasl</code> nếu cluster dùng TLS/SASL.
    Image Docker nhiều tầng (build → runtime slim) nhớ copy đủ thư viện động (libssl, libsasl2) nếu không link tĩnh.</p></div>
  `,

  codeTabs: [
    { id: "main", label: "① Skeleton service", lines: [
      "#[tokio::main]",
      "async fn main() -> anyhow::Result<()> {",
      "    let cfg = Config::from_env()?;",
      "    let producer: FutureProducer = producer_config(&cfg).create()?;",
      "    let consumer: StreamConsumer = consumer_config(&cfg).create()?;",
      "    consumer.subscribe(&[\"orders\"])?;",
      "",
      "    let shutdown = tokio_util::sync::CancellationToken::new();",
      "    let s = shutdown.clone();",
      "    tokio::spawn(async move { let _ = tokio::signal::ctrl_c().await; s.cancel(); });",
      "",
      "    run(&consumer, &producer, shutdown).await?;",
      "",
      "    consumer.commit_consumer_state(CommitMode::Sync)?;   // chốt offset đã store",
      "    producer.flush(Duration::from_secs(10))?;             // gửi nốt buffer",
      "    Ok(())",
      "}"
    ]},
    { id: "loop", label: "② Vòng xử lý", lines: [
      "async fn run(c: &StreamConsumer, p: &FutureProducer, stop: CancellationToken) -> anyhow::Result<()> {",
      "    loop {",
      "        let m = tokio::select! {",
      "            _ = stop.cancelled() => return Ok(()),     // ngừng nhận mới",
      "            r = c.recv() => r?,",
      "        };",
      "        match handle(&m, p).await {",
      "            Ok(()) => {}",
      "            Err(e) => send_to_dlq(p, &m, &e).await?,",
      "        }",
      "        c.store_offset_from_message(&m)?;         // chỉ sau khi xong/đã vào DLQ",
      "    }",
      "}"
    ]},
    { id: "cfg", label: "③ Cấu hình khởi điểm", lines: [
      "fn producer_config(c: &Config) -> ClientConfig {",
      "    let mut cc = ClientConfig::new();",
      "    cc.set(\"bootstrap.servers\", &c.brokers)",
      "      .set(\"enable.idempotence\", \"true\")",
      "      .set(\"partitioner\", \"murmur2_random\")",
      "      .set(\"compression.type\", \"zstd\")",
      "      .set(\"linger.ms\", \"10\");",
      "    cc",
      "}",
      "fn consumer_config(c: &Config) -> ClientConfig {",
      "    let mut cc = ClientConfig::new();",
      "    cc.set(\"bootstrap.servers\", &c.brokers)",
      "      .set(\"group.id\", &c.group_id)",
      "      .set(\"enable.auto.offset.store\", \"false\")",
      "      .set(\"partition.assignment.strategy\", \"cooperative-sticky\")",
      "      .set(\"auto.offset.reset\", \"earliest\")",
      "      .set(\"statistics.interval.ms\", \"15000\");",
      "    cc",
      "}"
    ]},
    { id: "cargo", label: "④ Cargo.toml", lines: [
      "[dependencies]",
      "rdkafka = { version = \"0.x\", features = [\"cmake-build\", \"ssl\", \"sasl\", \"zstd\"] }",
      "tokio = { version = \"1\", features = [\"full\"] }",
      "tokio-util = \"0.7\"",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "serde_json = \"1\"",
      "anyhow = \"1\"",
      "tracing = \"0.1\"",
      "",
      "# chọn bản rdkafka mới nhất trên crates.io; API send(record, timeout) -> Delivery"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sig"><div class="nl">🛑 SIGTERM (K8s)</div><div class="ns">CancellationToken.cancel()</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="loop"><div class="nl">🔁 Vòng recv → handle → store</div><div class="ns">select! dừng nhận mới</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="cm"><div class="nl">✅ commit Sync</div><div class="ns">chốt offset đã store</div></div>
      <div class="node" id="fl"><div class="nl">📤 producer.flush</div><div class="ns">gửi nốt DLQ/đầu ra</div></div>
    </div>
    <div class="node" id="bye"><div class="nl">👋 drop consumer</div><div class="ns">rời group → rebalance ngay</div></div>
  `,
  steps: [
    { title: "1 · Cấu hình khác mặc định", tab: "cfg", highlight: [4, 5, 14, 15, 16], on: ["loop"],
      desc: "Idempotence, murmur2, offset store thủ công, cooperative-sticky: bốn dòng sửa bốn cái bẫy của librdkafka." },
    { title: "2 · Vòng xử lý thay @KafkaListener", tab: "loop", highlight: [3, 4, 5, 7, 9, 11], on: ["loop"],
      desc: "Thứ Spring container làm ngầm giờ nằm trong 12 dòng bạn đọc được và kiểm soát được." },
    { title: "3 · Nhận SIGTERM", tab: "main", highlight: [8, 9, 10], on: ["sig", "a1"],
      desc: "Token huỷ lan tới vòng xử lý; message đang cầm được xử lý xong vì select! chỉ kiểm tra khi chờ message mới." },
    { title: "4 · Chốt và dọn", tab: "main", highlight: [14, 15], on: ["a2", "cm", "fl"],
      desc: "Commit đồng bộ phần đã store, flush producer. Sau đó consumer bị drop → rời group." },
    { title: "5 · Phụ thuộc build", tab: "cargo", highlight: [2, 10], on: ["bye"],
      desc: "Feature ssl/sasl phải khớp với cách cluster bảo mật (bài 22)." }
  ],

  quiz: [
    { q: "rdkafka dựa trên thư viện nào?", options: ["Kafka Java client qua JNI", "librdkafka (C)", "Viết thuần Rust từ đầu", "Kafka Streams"], correct: 1,
      explanation: "Nên tên cấu hình và mặc định là của librdkafka." },
    { q: "Tương đương @KafkaListener trong rdkafka là gì?", options: [
        "Annotation #[kafka_listener]",
        "Vòng loop gọi consumer.recv().await do bạn tự viết",
        "consumer.subscribe() là đủ",
        "Không có"
      ], correct: 1, explanation: "Container logic nằm trong code của bạn." },
    { q: "Bốn cấu hình nên đổi so với mặc định librdkafka cho service nghiệp vụ?", options: [
        "acks=0, linger=0, batch=1, retries=0",
        "enable.idempotence=true, partitioner=murmur2_random, enable.auto.offset.store=false, cooperative-sticky",
        "isolation.level=read_uncommitted, auto.commit=false, acks=1, gzip",
        "Không cần đổi gì"
      ], correct: 1, explanation: "Tổng hợp từ bài 07, 08, 11, 12." },
    { q: "Trong graceful shutdown, thứ tự hợp lý?", options: [
        "flush producer → thoát ngay",
        "ngừng nhận mới → xong message đang cầm → store/commit offset → rời group → flush producer",
        "commit offset → rồi mới xử lý nốt",
        "kill -9"
      ], correct: 1, explanation: "Không mất, không trùng không cần thiết." },
    { q: "FutureProducer::send trả về gì khi thành công (bản rdkafka mới)?", options: [
        "()", "Delivery { partition, offset, timestamp }", "Offset kiểu String", "Future không bao giờ kết thúc"
      ], correct: 1, explanation: "Lỗi thì trả (KafkaError, OwnedMessage) để bạn còn giữ message." },
    { q: "Muốn có nhiều consumer song song như concurrency=3 của Spring, trong Rust làm gì?", options: [
        "Không thể",
        "Tạo nhiều StreamConsumer cùng group.id (mỗi cái một task), hoặc lane theo key trong một consumer",
        "Tăng max.poll.records",
        "Dùng nhiều group.id"
      ], correct: 1, explanation: "Khác group.id = mỗi cái đọc toàn bộ — sai." },
    { q: "Cluster dùng SASL_SSL, build rdkafka cần gì?", options: [
        "Không cần gì", "Bật feature ssl và sasl (và có thư viện tương ứng khi chạy)", "Dùng Java", "Tắt TLS"
      ], correct: 1, explanation: "Thiếu feature thì tạo client lỗi 'not supported'." },
    { q: "Cách test tích hợp consumer Rust với Kafka thật?", options: [
        "Không test được",
        "testcontainers hoặc docker compose chạy Kafka trong CI",
        "Mock toàn bộ librdkafka",
        "Chỉ test trên production"
      ], correct: 1, explanation: "Unit test logic tách riêng khỏi Kafka." },
    { q: "Vì sao lại dùng tokio::select! với CancellationToken quanh recv()?", options: [
        "Cho đẹp",
        "Để ngừng chờ message mới ngay khi có tín hiệu tắt, mà không cắt ngang message đang xử lý",
        "Để commit nhanh hơn",
        "Bắt buộc bởi rdkafka"
      ], correct: 1, explanation: "select! chỉ bao phần chờ message." }
  ]
});
