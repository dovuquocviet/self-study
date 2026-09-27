window.LESSONS.push({
  id: "23",
  phase: "7", phaseName: "Tổng kết",
  title: "Tổng kết: checklist thiết kế một luồng Kafka không mất, không trùng",
  subtitle: "Từ topic tới đích — mọi quyết định trong khoá gom lại một chỗ",

  theory: `
    <p>Khi thiết kế (hoặc review) một luồng mới, ví dụ <em>order-service → orders → billing, search, ClickHouse</em>, đi qua checklist này theo thứ tự dữ liệu chảy:</p>

    <p><strong>1. Topic</strong></p>
    <ul>
      <li>Tên, chủ sở hữu, schema (Avro/Protobuf + Schema Registry, mode <code>BACKWARD_TRANSITIVE</code>/<code>FULL_TRANSITIVE</code>) — bài 16.</li>
      <li>Key = ID thực thể cần giữ thứ tự — bài 07, 14. Số partition = max(T/p, T/c) + dư, số có nhiều ước — bài 19.</li>
      <li>RF=3, <code>min.insync.replicas=2</code>, <code>unclean.leader.election.enable=false</code> — bài 05.</li>
      <li><code>cleanup.policy</code>: delete (sự kiện) hay compact (trạng thái); retention ≥ sự cố dài nhất consumer phải chịu + thời gian replay — bài 15.</li>
    </ul>

    <p><strong>2. Producer</strong></p>
    <ul>
      <li><code>acks=all</code>, <code>enable.idempotence=true</code> (librdkafka phải tự bật) — bài 05, 08.</li>
      <li><code>partitioner=murmur2_random</code> khi Rust và Java cùng ghi — bài 07.</li>
      <li><code>linger.ms</code>, <code>batch.size</code>, <code>compression.type=zstd</code> — bài 06. Luôn xử lý kết quả send; flush khi tắt.</li>
      <li>Ghi DB + phát sự kiện → Transactional Outbox, <code>event_id</code> sinh một lần — bài 13. Read-process-write thuần Kafka → transactions — bài 09.</li>
    </ul>

    <p><strong>3. Consumer</strong></p>
    <ul>
      <li>Xử lý rồi mới store/commit offset (<code>enable.auto.offset.store=false</code> trong rdkafka) — bài 12.</li>
      <li>Xử lý idempotent: dedup theo event_id, upsert có version, ReplacingMergeTree ở ClickHouse — bài 13, 21.</li>
      <li><code>cooperative-sticky</code> (hoặc <code>group.protocol=consumer</code>), static membership, graceful shutdown, commit trong revoke — bài 11, 20.</li>
      <li>Xử lý dưới <code>max.poll.interval.ms</code>; song song theo key nếu cần thông lượng — bài 10, 14.</li>
      <li>Phân loại lỗi, retry có giới hạn, DLQ có chủ, pause khi phụ thuộc sập — bài 17.</li>
      <li><code>isolation.level=read_committed</code> nếu nguồn dùng transactions — bài 09.</li>
    </ul>

    <p><strong>4. Vận hành</strong></p>
    <ul>
      <li>Cảnh báo lag theo thời gian; URP, UnderMinIsr, Offline, ActiveController — bài 18.</li>
      <li>SASL_SSL, principal riêng mỗi service, ACL tối thiểu, không đưa bí mật vào message — bài 22.</li>
      <li>Cluster KRaft, controller tách riêng, <code>advertised.listeners</code> đúng — bài 02.</li>
    </ul>

    <div class="callout"><p>💡 Nếu chỉ nhớ một câu: <strong>đường ống Kafka là at-least-once; "đúng một lần" là thuộc tính bạn xây ở hai đầu</strong> — outbox + event_id ở nguồn,
    xử lý idempotent ở đích. Mọi cấu hình còn lại là để "at-least-once" thật sự không mất.</p></div>
  `,

  codeTabs: [
    { id: "topic", label: "① Topic", lines: [
      "kafka-topics.sh --bootstrap-server b:9094 --command-config admin.properties --create \\",
      "  --topic orders --partitions 24 --replication-factor 3 \\",
      "  --config min.insync.replicas=2 \\",
      "  --config unclean.leader.election.enable=false \\",
      "  --config retention.ms=1209600000 \\",
      "  --config compression.type=producer",
      "",
      "# schema: subject orders-value, compatibility BACKWARD_TRANSITIVE"
    ]},
    { id: "prod", label: "② Producer", lines: [
      "ClientConfig::new()",
      "    .set(\"acks\", \"all\")",
      "    .set(\"enable.idempotence\", \"true\")",
      "    .set(\"partitioner\", \"murmur2_random\")",
      "    .set(\"compression.type\", \"zstd\")",
      "    .set(\"linger.ms\", \"10\")",
      "// + outbox trong Postgres, event_id = outbox.id",
      "// + xử lý Err của send; flush khi SIGTERM"
    ]},
    { id: "cons", label: "③ Consumer", lines: [
      "ClientConfig::new()",
      "    .set(\"enable.auto.offset.store\", \"false\")",
      "    .set(\"partition.assignment.strategy\", \"cooperative-sticky\")",
      "    .set(\"group.instance.id\", &pod_name)",
      "    .set(\"isolation.level\", \"read_committed\")",
      "    .set(\"auto.offset.reset\", \"earliest\")",
      "",
      "loop { recv -> xử lý idempotent (event_id) -> (lỗi: retry/DLQ) -> store_offset }"
    ]},
    { id: "ops", label: "④ Vận hành", lines: [
      "cảnh báo: lag theo thời gian > 10 phút liên tục 10 phút",
      "cảnh báo: UnderReplicatedPartitions > 0, UnderMinIsrPartitionCount > 0",
      "cảnh báo: OfflinePartitionsCount > 0, ActiveControllerCount != 1",
      "cảnh báo: DLQ nhận message mới",
      "bảo mật : SASL_SSL, User:<service>, ACL READ topic + READ group"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">🧾 order-service</div><div class="ns">outbox · event_id · idempotent producer</div></div>
    <div class="arrow" id="a1">↓ acks=all · murmur2 · zstd</div>
    <div class="node" id="t"><div class="nl">📨 orders (24 partition, RF3, min.isr 2)</div><div class="ns">schema BACKWARD_TRANSITIVE · retention 14 ngày</div></div>
    <div class="arrow" id="a2">↓ mỗi group độc lập</div>
    <div class="row">
      <div class="node" id="b"><div class="nl">💳 billing</div><div class="ns">processed_events</div></div>
      <div class="node" id="s"><div class="nl">🔎 search</div><div class="ns">ES _id = order_id</div></div>
      <div class="node" id="ch"><div class="nl">📊 ClickHouse</div><div class="ns">ReplacingMergeTree</div></div>
    </div>
    <div class="node" id="ops"><div class="nl">🩺 Lag · URP · DLQ · ACL</div><div class="ns">vận hành</div></div>
  `,
  steps: [
    { title: "1 · Thiết kế topic", tab: "topic", highlight: [2, 3, 4, 5, 8], on: ["t"],
      desc: "Partition, độ bền, retention và hợp đồng schema được quyết định trước khi có dòng code nào." },
    { title: "2 · Nguồn không mất", tab: "prod", highlight: [2, 3, 4, 7, 8], on: ["src", "a1"],
      desc: "Outbox chống dual write, idempotent producer chống trùng do retry, murmur2 giữ thứ tự theo key giữa Java và Rust." },
    { title: "3 · Consumer idempotent", tab: "cons", highlight: [2, 3, 4, 8], on: ["a2", "b", "s", "ch"],
      desc: "Store offset sau khi xử lý; mỗi đích có cách dedup riêng." },
    { title: "4 · Quan sát & bảo vệ", tab: "ops", highlight: [1, 2, 3, 4, 5], on: ["ops"],
      desc: "Không có cảnh báo thì mọi đảm bảo ở trên chỉ là giả định." }
  ],

  quiz: [
    { q: "Cấu hình topic nào đảm bảo mỗi message được báo OK có ít nhất 2 bản sao (với acks=all)?", options: [
        "RF=2, min.isr=1", "RF=3, min.insync.replicas=2", "RF=1", "unclean=true"
      ], correct: 1, explanation: "Bài 05." },
    { q: "Service Rust và Java cùng ghi topic có key. Cấu hình nào ở rdkafka giữ cùng key cùng partition?", options: [
        "acks=all", "partitioner=murmur2_random", "enable.idempotence=true", "linger.ms=0"
      ], correct: 1, explanation: "Bài 07." },
    { q: "Consumer rdkafka at-least-once chuẩn dùng cặp cấu hình nào?", options: [
        "auto.commit=true, auto.offset.store=true",
        "auto.commit=true, auto.offset.store=false + store sau khi xử lý",
        "auto.commit=false, không bao giờ commit",
        "isolation.level=read_uncommitted"
      ], correct: 1, explanation: "Bài 12." },
    { q: "HW (high watermark) quyết định điều gì?", options: [
        "Producer ghi được tới đâu", "Consumer đọc được tới đâu (message đã committed)", "Retention", "Số partition"
      ], correct: 1, explanation: "Bài 04." },
    { q: "Idempotent producer KHÔNG chống được trùng nào?", options: [
        "Retry nội bộ sau timeout", "Ứng dụng gửi lại sau khi restart", "Retry do NOT_LEADER", "Batch gửi hai lần do mất phản hồi"
      ], correct: 1, explanation: "PID mới mỗi phiên — bài 08." },
    { q: "Transactions Kafka đảm bảo exactly-once trong phạm vi nào?", options: [
        "Mọi hệ thống", "Read-process-write nội bộ Kafka (ghi topic + commit offset)", "Ghi PostgreSQL", "Gửi email"
      ], correct: 1, explanation: "Bài 09, 13." },
    { q: "Consumer xử lý một lô quá max.poll.interval.ms. Hậu quả?", options: [
        "Không sao", "Bị đá khỏi group, partition bị giao lại và xử lý trùng", "Broker chết", "Message bị xoá"
      ], correct: 1, explanation: "Bài 10." },
    { q: "Cách giảm stop-the-world khi rolling deploy consumer?", options: [
        "Eager assignor", "cooperative-sticky + static membership + graceful shutdown", "Tăng retention", "acks=0"
      ], correct: 1, explanation: "Bài 11." },
    { q: "Topic lưu 'giá hiện tại của từng sản phẩm' nên dùng?", options: [
        "cleanup.policy=delete, 1 ngày", "cleanup.policy=compact với key = sku", "Không key", "1 partition"
      ], correct: 1, explanation: "Bài 15." },
    { q: "Schema BACKWARD: nâng cấp bên nào trước?", options: ["Producer", "Consumer", "Cùng lúc", "Không quan trọng"], correct: 1,
      explanation: "Bài 16." },
    { q: "Poison pill nên được xử lý thế nào?", options: [
        "Retry vô hạn", "Không retry; gửi DLQ kèm header ngữ cảnh rồi đi tiếp", "Commit bỏ qua không lưu", "Restart consumer"
      ], correct: 1, explanation: "Bài 17." },
    { q: "Lag chỉ cao ở một partition. Thêm consumer có giúp không?", options: [
        "Có", "Không — vấn đề là key lệch hoặc message kẹt ở partition đó", "Có nếu tăng session timeout", "Có nếu dùng Java"
      ], correct: 1, explanation: "Bài 07, 18." },
    { q: "Nạp Kafka → ClickHouse, làm sao tránh trùng khi pipeline là at-least-once?", options: [
        "Không cần", "ReplacingMergeTree theo event_id, truy vấn FINAL/argMax khi cần chính xác", "acks=0", "Bảng Log"
      ], correct: 1, explanation: "Bài 21." },
    { q: "KRaft thay ZooKeeper bằng gì?", options: [
        "etcd", "Quorum controller Raft lưu metadata trong __cluster_metadata", "PostgreSQL", "Không thay gì"
      ], correct: 1, explanation: "Bài 02." },
    { q: "Consumer cần ACL tối thiểu nào?", options: [
        "WRITE topic", "READ topic + READ group", "ALL cluster", "Không cần"
      ], correct: 1, explanation: "Bài 22." },
    { q: "Câu tóm tắt đúng nhất về 'không mất, không trùng' với Kafka?", options: [
        "Bật exactly-once là xong",
        "Đường ống at-least-once được cấu hình không mất; không trùng là do nguồn có event_id và đích xử lý idempotent",
        "Dùng acks=0 cho nhanh",
        "Không thể đạt được"
      ], correct: 1, explanation: "Thông điệp chính của khoá." }
  ]
});
