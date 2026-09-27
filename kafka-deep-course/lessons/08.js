window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Producer sâu",
  title: "Retry & idempotent producer: gửi lại mà không nhân đôi",
  subtitle: "Producer ID · sequence number · max.in.flight ≤ 5 · vì sao retry có thể làm đảo thứ tự",

  theory: `
    <p>Mạng chập chờn: producer gửi batch, broker <em>đã ghi</em> nhưng phản hồi bị mất. Producer không biết, retry → broker ghi <strong>lần hai</strong>.
    Đây là nguồn trùng lặp đầu tiên, và nó xảy ra <em>trước</em> cả khi consumer đụng vào.</p>

    <p><strong>Idempotent producer</strong> (<code>enable.idempotence=true</code>) giải quyết bằng một ý tưởng giống idempotency key trong REST:</p>
    <ul>
      <li>Khi khởi tạo, producer xin broker một <strong>Producer ID (PID)</strong> và <em>epoch</em>.</li>
      <li>Mỗi batch gửi tới một partition mang <strong>sequence number</strong> tăng dần (theo từng partition).</li>
      <li>Leader nhớ sequence cuối của mỗi PID trên mỗi partition (cho 5 batch gần nhất). Batch có sequence đã thấy → trả OK nhưng <strong>không ghi lại</strong> (DUPLICATE).
        Sequence nhảy cóc → lỗi <code>OUT_OF_ORDER_SEQUENCE_NUMBER</code>.</li>
    </ul>

    <p><strong>Retry và thứ tự</strong>: <code>max.in.flight.requests.per.connection</code> = số request chưa có phản hồi được phép bay cùng lúc tới một broker.
    Không idempotence mà in-flight &gt; 1: batch 1 lỗi, batch 2 thành công, batch 1 retry thành công → <strong>thứ tự đảo</strong> (2 trước 1).
    Có idempotence, broker dùng sequence để từ chối batch lệch thứ tự và producer gửi lại đúng thứ tự — nên giữ được thứ tự với in-flight tối đa <strong>5</strong>.</p>

    <table>
      <tr><th>Cấu hình khi bật idempotence</th><th>Yêu cầu</th></tr>
      <tr><td><code>acks</code></td><td>phải là <code>all</code></td></tr>
      <tr><td><code>retries</code></td><td>&gt; 0 (mặc định rất lớn; giới hạn thật là <code>delivery.timeout.ms</code>)</td></tr>
      <tr><td><code>max.in.flight.requests.per.connection</code></td><td>≤ 5</td></tr>
    </table>
    <p>Java 3.0+ bật mặc định. librdkafka <strong>mặc định tắt</strong>; bật lên thì nó tự chỉnh các giá trị trên, và báo lỗi nếu bạn đặt mâu thuẫn (vd <code>acks=1</code>).</p>

    <p><strong>Phạm vi của idempotence — rất quan trọng</strong>:</p>
    <ul>
      <li>Chỉ chống trùng do <em>retry nội bộ của một phiên producer</em>. Process khởi động lại → PID mới → không nhận ra message cũ.</li>
      <li>Không chống trùng do <em>ứng dụng</em> gọi send hai lần (vd request HTTP retry từ client, job chạy lại). Việc đó cần idempotency ở tầng nghiệp vụ (event_id + consumer dedup, bài 13).</li>
      <li>Muốn "đúng một lần" xuyên qua restart và xuyên nhiều partition → <strong>transactions</strong> với <code>transactional.id</code> cố định (bài 09).</li>
    </ul>

    <div class="callout"><p>💡 Bật idempotence gần như không tốn gì (vài byte header/batch) mà loại bỏ một lớp trùng và lệch thứ tự. Với rdkafka, luôn đặt <code>enable.idempotence=true</code> cho topic nghiệp vụ.</p></div>
  `,

  codeTabs: [
    { id: "dup", label: "① Trùng do retry", lines: [
      "producer -> leader : batch(orders-0, [OrderPaid #17])",
      "leader            : ghi offset 42  ✅",
      "leader -> producer: response ... mất trên mạng ❌ (timeout)",
      "producer          : retry batch",
      "leader            : ghi offset 43  ← TRÙNG (không idempotence)",
      "",
      "# consumer sẽ thấy OrderPaid #17 hai lần"
    ]},
    { id: "idem", label: "② Với PID + sequence", lines: [
      "init: producer nhận PID=4001, epoch=0",
      "",
      "producer -> leader : batch(PID=4001, seq=90, [OrderPaid #17])",
      "leader            : ghi offset 42, nhớ lastSeq(4001, orders-0)=90",
      "leader -> producer: response ... mất",
      "producer          : retry batch(PID=4001, seq=90)",
      "leader            : seq 90 đã thấy -> trả OK offset 42, KHÔNG ghi lại",
      "",
      "producer          : batch(seq=92)  // bỏ qua 91",
      "leader            : OUT_OF_ORDER_SEQUENCE_NUMBER"
    ]},
    { id: "order", label: "③ Đảo thứ tự", lines: [
      "max.in.flight=5, KHÔNG idempotence, retries>0:",
      "  gửi B1 (seq ngầm 1)  -> lỗi tạm thời",
      "  gửi B2               -> OK, ghi offset 10",
      "  retry B1             -> OK, ghi offset 11     # B2 trước B1!",
      "",
      "CÓ idempotence:",
      "  B2 đến khi leader đang chờ seq của B1 -> bị từ chối (out of order)",
      "  producer gửi lại B1 rồi B2 đúng thứ tự"
    ]},
    { id: "rust", label: "④ Cấu hình rdkafka", lines: [
      "let producer: FutureProducer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", &cfg.brokers)",
      "    .set(\"enable.idempotence\", \"true\")",
      "    // librdkafka tự đặt: acks=all, max.in.flight<=5, retries lớn",
      "    // KHÔNG đặt acks=1 cùng lúc -> tạo producer sẽ lỗi",
      "    .set(\"partitioner\", \"murmur2_random\")",
      "    .create()?;",
      "",
      "// Java: enable.idempotence=true là mặc định từ Kafka 3.0"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">✍️ Producer PID=4001</div><div class="ns">batch seq=90</div></div>
    <div class="arrow" id="a1">↓ gửi</div>
    <div class="node" id="l"><div class="nl">👑 Leader orders-0</div><div class="ns">ghi offset 42 · nhớ lastSeq=90</div></div>
    <div class="arrow" id="a2">↑ phản hồi bị mất</div>
    <div class="node" id="r"><div class="nl">🔁 Retry seq=90</div><div class="ns">leader: đã thấy → OK, không ghi lại</div></div>
    <div class="node" id="lim"><div class="nl">⚠️ Giới hạn</div><div class="ns">restart = PID mới · app gửi 2 lần = không chặn được</div></div>
  `,
  steps: [
    { title: "1 · Nguồn trùng: phản hồi mất", tab: "dup", highlight: [2, 3, 4, 5], on: ["p", "a1", "l", "a2"],
      desc: "Broker đã ghi, producer không biết nên gửi lại. Không idempotence thì log có hai bản." },
    { title: "2 · PID + sequence", tab: "idem", highlight: [1, 3, 4], on: ["p", "l"],
      desc: "Mỗi batch mang (PID, epoch, sequence) theo partition. Leader nhớ sequence gần nhất." },
    { title: "3 · Retry được nhận diện", tab: "idem", highlight: [6, 7], on: ["r"],
      desc: "Leader thấy seq 90 đã ghi nên trả lại offset cũ. Không trùng." },
    { title: "4 · Giữ thứ tự khi in-flight > 1", tab: "order", highlight: [4, 7, 8], on: ["l"],
      desc: "Sequence cho phép broker phát hiện batch tới sai thứ tự, nên idempotent producer giữ được thứ tự với tối đa 5 request đang bay." },
    { title: "5 · Bật trong Rust", tab: "rust", highlight: [3, 4, 5], on: ["p"],
      desc: "librdkafka mặc định tắt — tự bật. Nó điều chỉnh các cấu hình phụ thuộc." },
    { title: "6 · Biết giới hạn", tab: "rust", highlight: [9], on: ["lim"],
      desc: "Chỉ chống trùng do retry nội bộ trong một phiên. Restart hoặc app tự gửi lại vẫn trùng → cần transactions hoặc consumer idempotent." }
  ],

  quiz: [
    { q: "Nguồn trùng lặp mà idempotent producer xử lý là gì?", options: [
        "Consumer xử lý hai lần",
        "Producer retry sau khi phản hồi bị mất dù broker đã ghi",
        "Người dùng bấm nút hai lần",
        "Hai service cùng gửi một sự kiện"
      ], correct: 1, explanation: "Chỉ trùng do retry nội bộ." },
    { q: "Broker nhận diện batch trùng dựa vào gì?", options: [
        "Hash nội dung", "Producer ID + epoch + sequence number theo partition", "Key của message", "Timestamp"
      ], correct: 1, explanation: "Giống idempotency key nhưng do client library tự sinh." },
    { q: "Điều kiện cấu hình để bật idempotence?", options: [
        "acks=1", "acks=all, retries>0, max.in.flight ≤ 5", "linger.ms=0", "compression=none"
      ], correct: 1, explanation: "Đặt mâu thuẫn thì client báo lỗi." },
    { q: "Không bật idempotence, max.in.flight=5, retries>0. Rủi ro về thứ tự?", options: [
        "Không có",
        "Batch sau có thể ghi trước batch trước bị retry → đảo thứ tự",
        "Mất hết message",
        "Consumer không đọc được"
      ], correct: 1, explanation: "Trước đây phải đặt in-flight=1 để tránh — giảm thông lượng." },
    { q: "Service producer bị restart và gửi lại message cuối cùng (do chưa chắc đã gửi). Idempotent producer có chặn trùng không?", options: [
        "Có", "Không — phiên mới có PID mới", "Có nếu cùng key", "Có nếu cùng partition"
      ], correct: 1, explanation: "Cần transactional.id cố định (fencing) hoặc dedup ở consumer." },
    { q: "Mặc định enable.idempotence trong librdkafka là…", options: ["true", "false", "Không hỗ trợ", "Tuỳ broker"], correct: 1,
      explanation: "Khác Java 3.0+ (mặc định true)." },
    { q: "Lỗi OUT_OF_ORDER_SEQUENCE_NUMBER nghĩa là?", options: [
        "Topic sai",
        "Broker nhận batch có sequence không liền kề với sequence cuối nó biết",
        "Consumer commit sai",
        "Schema không khớp"
      ], correct: 1, explanation: "Đây là cách broker bảo vệ thứ tự/không mất batch." },
    { q: "Client HTTP retry POST /orders, service gọi producer.send hai lần với cùng nội dung. Kafka có hai message không?", options: [
        "Không, idempotence chặn",
        "Có — đó là hai lần send của ứng dụng; cần idempotency key nghiệp vụ",
        "Không, broker so nội dung",
        "Tuỳ compression"
      ], correct: 1, explanation: "Idempotence Kafka không biết ý nghĩa nghiệp vụ." },
    { q: "Chi phí của việc bật idempotence?", options: [
        "Giảm thông lượng 90%", "Rất nhỏ (vài trường trong header batch, trạng thái nhỏ trên broker)", "Phải dùng transactions", "Mất khả năng nén"
      ], correct: 1, explanation: "Vì vậy Java bật mặc định." }
  ]
});
