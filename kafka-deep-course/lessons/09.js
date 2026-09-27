window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Producer sâu",
  title: "Transactions: ghi nhiều partition và commit offset nguyên tử",
  subtitle: "transactional.id · fencing · control marker · read_committed · LSO · read-process-write",

  theory: `
    <p>Bài toán điển hình: service đọc <code>orders</code>, tính toán, ghi ra <code>invoices</code> và <code>notifications</code>, rồi commit offset đầu vào.
    Nếu chết giữa chừng: đã ghi invoices nhưng chưa commit → chạy lại ghi invoices <em>lần hai</em>. <strong>Transaction</strong> gói cả ba việc
    (ghi nhiều partition + commit offset) thành <em>tất cả hoặc không</em>.</p>

    <p><strong>Thành phần</strong></p>
    <ul>
      <li><code>transactional.id</code>: tên cố định do bạn đặt (vd <code>invoice-svc-0</code>), tồn tại qua restart. Tự bật idempotence.</li>
      <li><strong>Transaction coordinator</strong>: một broker giữ trạng thái giao dịch trong topic nội bộ <code>__transaction_state</code>.</li>
      <li><strong>Fencing</strong>: <code>initTransactions()</code> tăng epoch gắn với transactional.id. Instance "zombie" cũ (tưởng chết nhưng còn chạy, vd sau GC pause dài) dùng epoch cũ sẽ bị từ chối — không thể có hai instance cùng ghi.</li>
      <li><strong>Control marker</strong>: khi commit/abort, coordinator ghi một bản ghi đặc biệt COMMIT/ABORT vào <em>mọi</em> partition tham gia (2-phase commit bên trong Kafka).</li>
    </ul>

    <p><strong>Phía consumer</strong>: <code>isolation.level</code></p>
    <ul>
      <li><code>read_uncommitted</code> (mặc định Java): thấy cả message của giao dịch đang mở hoặc đã abort.</li>
      <li><code>read_committed</code> (mặc định librdkafka): chỉ thấy message của giao dịch đã commit; bị chặn đọc tại <strong>LSO</strong> (Last Stable Offset — offset đầu tiên của giao dịch còn mở).
        Một giao dịch treo lâu → consumer read_committed <em>đứng</em> tại LSO (tối đa <code>transaction.timeout.ms</code>, mặc định 60s, rồi coordinator tự abort).</li>
    </ul>

    <p><strong>Exactly-once có phạm vi</strong>: transactions cho "đúng một lần" trong vòng <em>Kafka → xử lý → Kafka</em> (Kafka Streams dùng chính cơ chế này với <code>processing.guarantee=exactly_once_v2</code>).
    Nếu bước xử lý có gọi DB, gửi email, gọi API bên ngoài — những việc đó <strong>không</strong> nằm trong giao dịch Kafka; chạy lại vẫn lặp. Phần đó cần idempotent consumer / outbox (bài 13).</p>

    <table>
      <tr><th></th><th>Idempotent producer</th><th>Transactions</th></tr>
      <tr><td>Chống trùng do retry</td><td>✅</td><td>✅</td></tr>
      <tr><td>Qua restart</td><td>❌ (PID mới)</td><td>✅ (transactional.id cố định + fencing)</td></tr>
      <tr><td>Nguyên tử nhiều partition/topic</td><td>❌</td><td>✅</td></tr>
      <tr><td>Commit offset cùng lúc</td><td>❌</td><td>✅ (<code>sendOffsetsToTransaction</code>)</td></tr>
      <tr><td>Chi phí</td><td>~0</td><td>Thêm round-trip tới coordinator, marker, độ trễ consumer read_committed</td></tr>
    </table>

    <div class="callout"><p>💡 Spring: <code>@Transactional</code> với <code>KafkaTransactionManager</code> làm đúng những bước dưới đây. Nhưng "chuỗi" transaction Kafka + JPA
    (ChainedTransactionManager) <em>không</em> phải giao dịch phân tán thật — có cửa sổ lệch. Đừng tin nó như 2PC.</p></div>
  `,

  codeTabs: [
    { id: "rust", label: "① Read-process-write (Rust)", lines: [
      "producer.init_transactions(Duration::from_secs(30))?;       // fencing zombie",
      "loop {",
      "    let batch = poll_batch(&consumer).await?;                // vd 500 message",
      "    producer.begin_transaction()?;",
      "    for m in &batch {",
      "        let inv = build_invoice(m)?;",
      "        producer.send_result(FutureRecord::to(\"invoices\").key(&inv.id).payload(&inv.bytes))",
      "            .map_err(|(e, _)| e)?;",
      "    }",
      "    let offsets = consumer.position()?;                       // offset tiếp theo mỗi partition",
      "    let gm = consumer.group_metadata().expect(\"group\");",
      "    producer.send_offsets_to_transaction(&offsets, &gm, Duration::from_secs(30))?;",
      "    match producer.commit_transaction(Duration::from_secs(30)) {",
      "        Ok(()) => {}",
      "        Err(e) => { producer.abort_transaction(Duration::from_secs(30))?; rewind(&consumer)?; }",
      "    }",
      "}"
    ]},
    { id: "cfg", label: "② Cấu hình", lines: [
      "# producer",
      "transactional.id=invoice-svc-0        # cố định cho instance/partition-set này",
      "transaction.timeout.ms=60000",
      "",
      "# consumer đầu vào",
      "enable.auto.commit=false               # offset đi cùng transaction",
      "isolation.level=read_committed",
      "",
      "# consumer phía sau (đọc invoices)",
      "isolation.level=read_committed         # nếu không sẽ thấy cả giao dịch bị abort"
    ]},
    { id: "log", label: "③ Log với marker", lines: [
      "invoices-0:",
      "  40  inv-A   (txn PID=7 epoch=3)",
      "  41  inv-B   (txn PID=7 epoch=3)",
      "  42  [COMMIT marker PID=7]",
      "  43  inv-C   (txn PID=7 epoch=3)",
      "  44  [ABORT marker PID=7]           # inv-C bị bỏ",
      "  45  inv-D   (txn đang mở)           <- LSO = 45",
      "",
      "read_committed   thấy: inv-A, inv-B          (dừng ở LSO)",
      "read_uncommitted thấy: inv-A, inv-B, inv-C, inv-D"
    ]},
    { id: "java", label: "④ Spring tương đương", lines: [
      "spring.kafka.producer.transaction-id-prefix=invoice-svc-",
      "spring.kafka.consumer.isolation-level=read_committed",
      "",
      "@KafkaListener(topics = \"orders\")",
      "@Transactional(\"kafkaTransactionManager\")",
      "public void on(OrderEvent e) {",
      "    kafkaTemplate.send(\"invoices\", e.id(), toInvoice(e));",
      "}   // container gửi offset vào transaction rồi commit"
    ]}
  ],

  stageHtml: `
    <div class="node" id="in"><div class="nl">📥 orders (đầu vào)</div><div class="ns">poll 500 message</div></div>
    <div class="arrow" id="a1">↓ begin_transaction</div>
    <div class="node" id="proc"><div class="nl">⚙️ Xử lý & ghi invoices</div><div class="ns">nhiều partition</div></div>
    <div class="arrow" id="a2">↓ send_offsets_to_transaction</div>
    <div class="node" id="tc"><div class="nl">🧾 Transaction coordinator</div><div class="ns">__transaction_state</div></div>
    <div class="arrow" id="a3">↓ COMMIT marker tới mọi partition + __consumer_offsets</div>
    <div class="node" id="rc"><div class="nl">👀 Consumer read_committed</div><div class="ns">chỉ thấy giao dịch đã commit, dừng ở LSO</div></div>
  `,
  steps: [
    { title: "1 · init_transactions & fencing", tab: "rust", highlight: [1], on: ["tc"],
      desc: "Epoch của transactional.id tăng; instance cũ còn sống sẽ bị từ chối khi ghi." },
    { title: "2 · Mở giao dịch, ghi đầu ra", tab: "rust", highlight: [3, 4, 5, 6, 7], on: ["in", "a1", "proc"],
      desc: "Mọi message gửi trong khoảng này thuộc cùng giao dịch, dù ở nhiều partition/topic." },
    { title: "3 · Offset đầu vào vào cùng giao dịch", tab: "rust", highlight: [10, 11, 12], on: ["a2", "tc"],
      desc: "Không commit offset theo đường thường; offset được ghi vào __consumer_offsets như một phần giao dịch." },
    { title: "4 · Commit hoặc abort", tab: "rust", highlight: [13, 14, 15], on: ["a3"],
      desc: "Commit: marker COMMIT. Lỗi: abort và tua consumer về offset đã commit để xử lý lại cả lô." },
    { title: "5 · Consumer phía sau", tab: "log", highlight: [4, 6, 7, 9, 10], on: ["rc"],
      desc: "read_committed lọc bỏ giao dịch abort và dừng ở LSO. read_uncommitted thấy cả rác." },
    { title: "6 · Cấu hình & Spring", tab: "cfg", highlight: [2, 6, 7, 10], on: ["rc"],
      desc: "Tắt auto commit ở đầu vào, read_committed ở mọi consumer phía sau. Spring làm tương tự qua transaction-id-prefix." }
  ],

  quiz: [
    { q: "transactional.id khác Producer ID ở điểm nào?", options: [
        "Giống nhau",
        "transactional.id do bạn đặt, cố định qua restart; PID do broker cấp mỗi phiên",
        "PID do bạn đặt",
        "transactional.id là số ngẫu nhiên"
      ], correct: 1, explanation: "Nhờ cố định mà fencing và hoàn tất giao dịch dở dang sau restart được." },
    { q: "Fencing zombie nghĩa là gì?", options: [
        "Chặn consumer chậm",
        "Instance cũ cùng transactional.id nhưng epoch cũ bị từ chối ghi sau khi instance mới gọi initTransactions",
        "Xoá topic cũ",
        "Mã hoá dữ liệu"
      ], correct: 1, explanation: "Tránh hai instance cùng ghi đầu ra cho cùng phần việc." },
    { q: "Consumer với isolation.level=read_committed dừng ở đâu?", options: [
        "High watermark", "Last Stable Offset (LSO)", "Log start offset", "Offset 0"
      ], correct: 1, explanation: "LSO = offset đầu của giao dịch còn mở." },
    { q: "isolation.level mặc định của consumer Java và librdkafka lần lượt là?", options: [
        "read_committed / read_committed",
        "read_uncommitted / read_committed",
        "read_committed / read_uncommitted",
        "read_uncommitted / read_uncommitted"
      ], correct: 1, explanation: "Khác nhau — cần đặt tường minh khi hệ thống trộn client." },
    { q: "Transactions Kafka có làm việc ghi PostgreSQL trong bước xử lý thành exactly-once không?", options: [
        "Có",
        "Không — chỉ các thao tác trên Kafka (ghi topic, commit offset) nằm trong giao dịch",
        "Có nếu dùng Spring",
        "Có nếu read_committed"
      ], correct: 1, explanation: "Hiệu ứng bên ngoài cần idempotency/outbox." },
    { q: "Control marker (COMMIT/ABORT) được ghi ở đâu?", options: [
        "Chỉ __transaction_state",
        "Vào mọi partition tham gia giao dịch (kể cả partition __consumer_offsets liên quan)",
        "Trong header message đầu tiên",
        "Không ghi, chỉ trong RAM"
      ], correct: 1, explanation: "Consumer read_committed dùng marker để lọc." },
    { q: "Một producer giữ giao dịch mở rất lâu (treo). Ảnh hưởng?", options: [
        "Không ảnh hưởng",
        "Consumer read_committed bị chặn ở LSO tới khi giao dịch commit/abort hoặc timeout",
        "Topic bị xoá",
        "Broker restart"
      ], correct: 1, explanation: "transaction.timeout.ms giới hạn thời gian này." },
    { q: "Trong read-process-write có transaction, offset đầu vào được commit bằng cách nào?", options: [
        "enable.auto.commit=true",
        "sendOffsetsToTransaction trong cùng giao dịch",
        "commitSync sau khi commitTransaction",
        "Không cần commit"
      ], correct: 1, explanation: "Nếu commit riêng sẽ có cửa sổ lệch." },
    { q: "Commit transaction thất bại. Nên làm gì?", options: [
        "Bỏ qua, xử lý lô tiếp",
        "abort_transaction và tua consumer về offset đã commit để xử lý lại lô",
        "Commit offset thủ công",
        "Xoá topic đầu ra"
      ], correct: 1, explanation: "Đầu ra lô đó bị abort nên phải làm lại." },
    { q: "Kafka Streams bật exactly-once bằng cấu hình nào?", options: [
        "acks=all", "processing.guarantee=exactly_once_v2", "enable.idempotence=true", "isolation.level=read_committed"
      ], correct: 1, explanation: "Nó dùng transactions bên dưới." }
  ]
});
