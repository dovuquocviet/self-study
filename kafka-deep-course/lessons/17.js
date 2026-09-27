window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Vận hành",
  title: "Xử lý lỗi: poison pill, retry tại chỗ, retry topic & DLQ",
  subtitle: "Phân loại lỗi · không để một message chặn cả partition · header mang ngữ cảnh lỗi",

  theory: `
    <p>Kafka không có "nack từng message". Consumer gặp lỗi ở offset 500 thì hoặc <em>dừng lại</em> (không commit, thử lại), hoặc <em>đi tiếp</em> (commit qua nó) — không có ô giữa.
    Nếu đi tiếp mà không lưu message ở đâu thì là mất. Vì vậy xử lý lỗi là pattern bạn tự dựng.</p>

    <p><strong>Bước 1 — phân loại lỗi</strong></p>
    <table>
      <tr><th>Loại</th><th>Ví dụ</th><th>Cách xử lý</th></tr>
      <tr><td><strong>Tạm thời</strong> (transient)</td><td>DB timeout, API 503, deadlock</td><td>Retry có backoff</td></tr>
      <tr><td><strong>Vĩnh viễn</strong> (poison pill)</td><td>Không giải mã được, schema lạ, vi phạm nghiệp vụ, null pointer do dữ liệu</td><td>Không retry — chuyển DLQ ngay</td></tr>
      <tr><td><strong>Hệ thống sập</strong></td><td>DB chết hoàn toàn</td><td>Dừng/tạm dừng consumer (pause), không đổ hàng loạt vào DLQ</td></tr>
    </table>
    <p>Lỗi hay gặp: retry vô hạn một poison pill → partition kẹt vĩnh viễn, lag tăng mãi. Hoặc ngược lại: DB sập 5 phút → hàng triệu message đổ vào DLQ.</p>

    <p><strong>Bước 2 — chọn chiến lược</strong></p>
    <ol>
      <li><strong>Retry tại chỗ (blocking)</strong>: thử lại vài lần với backoff ngắn ngay trong consumer. Giữ thứ tự, nhưng chặn partition trong lúc chờ (nhớ giới hạn max.poll.interval).</li>
      <li><strong>Retry topic (non-blocking)</strong>: không được thì publish sang <code>orders.retry.1m</code>, commit và đi tiếp. Một consumer khác đọc retry topic, chờ đủ thời gian
        (so timestamp/header), thử lại; thất bại tiếp → <code>orders.retry.10m</code> → cuối cùng <code>orders.dlq</code>. Không chặn, nhưng <em>vỡ thứ tự</em> (bài 14).</li>
      <li><strong>DLQ (dead letter queue)</strong>: topic chứa message không xử lý được, kèm header ngữ cảnh: topic/partition/offset gốc, lỗi, số lần thử, thời điểm.
        Có người sở hữu, có cảnh báo, có công cụ <em>re-drive</em> (đẩy lại vào topic gốc sau khi sửa).</li>
    </ol>

    <p><strong>Spring Kafka</strong> có sẵn: <code>DefaultErrorHandler</code> + <code>BackOff</code> (retry tại chỗ, lỗi không retry được cấu hình qua <code>addNotRetryableExceptions</code>),
    <code>DeadLetterPublishingRecoverer</code> (gửi DLT với header <code>kafka_dlt-original-topic</code>, <code>kafka_dlt-exception-message</code>...), và <code>@RetryableTopic</code> (retry topic tự động).
    Trong Rust, bạn tự viết — logic không nhiều, như tab ②.</p>

    <div class="callout"><p>💡 DLQ không có người đọc là thùng rác có chi phí lưu trữ. Mỗi DLQ cần: metric số message vào, cảnh báo, runbook, và lệnh re-drive.
    Và đặt retention DLQ dài hơn topic gốc.</p></div>
  `,

  codeTabs: [
    { id: "classify", label: "① Phân loại lỗi (Rust)", lines: [
      "enum ProcessError {",
      "    Transient(anyhow::Error),   // DB timeout, 503",
      "    Permanent(anyhow::Error),   // decode lỗi, dữ liệu sai",
      "}",
      "",
      "fn classify(e: &sqlx::Error) -> bool /* transient? */ {",
      "    matches!(e, sqlx::Error::PoolTimedOut | sqlx::Error::Io(_))",
      "}"
    ]},
    { id: "flow", label: "② Vòng xử lý có retry + DLQ", lines: [
      "let m = consumer.recv().await?;",
      "let mut attempt = 0;",
      "loop {",
      "    match process(&m).await {",
      "        Ok(()) => break,",
      "        Err(ProcessError::Transient(e)) if attempt < 3 => {",
      "            attempt += 1;",
      "            tokio::time::sleep(Duration::from_millis(200 * 2u64.pow(attempt))).await;",
      "        }",
      "        Err(e) => { send_to_dlq(&producer, &m, &e, attempt).await?; break; }",
      "    }",
      "}",
      "consumer.store_offset_from_message(&m)?;   // đi tiếp sau khi đã xử lý HOẶC đã vào DLQ"
    ]},
    { id: "dlq", label: "③ Gửi DLQ kèm header", lines: [
      "let headers = OwnedHeaders::new()",
      "    .insert(Header { key: \"x-orig-topic\", value: Some(m.topic()) })",
      "    .insert(Header { key: \"x-orig-partition\", value: Some(&m.partition().to_string()) })",
      "    .insert(Header { key: \"x-orig-offset\", value: Some(&m.offset().to_string()) })",
      "    .insert(Header { key: \"x-error\", value: Some(&err.to_string()) })",
      "    .insert(Header { key: \"x-attempts\", value: Some(&attempt.to_string()) });",
      "",
      "producer.send(FutureRecord::to(\"orders.dlq\")",
      "        .key(m.key().unwrap_or_default())",
      "        .payload(m.payload().unwrap_or_default())",
      "        .headers(headers), Duration::from_secs(5))",
      "    .await.map_err(|(e, _)| e)?;     // gửi DLQ thất bại -> KHÔNG store offset"
    ]},
    { id: "spring", label: "④ Spring tương đương", lines: [
      "@Bean",
      "DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> t) {",
      "    var recoverer = new DeadLetterPublishingRecoverer(t);   // -> <topic>-dlt",
      "    var h = new DefaultErrorHandler(recoverer, new ExponentialBackOff(200, 2.0));",
      "    h.addNotRetryableExceptions(DeserializationException.class, ValidationException.class);",
      "    return h;",
      "}",
      "",
      "// hoặc non-blocking:",
      "@RetryableTopic(attempts = \"4\", backoff = @Backoff(delay = 60000, multiplier = 10))",
      "@KafkaListener(topics = \"orders\")"
    ]},
    { id: "pause", label: "⑤ Hệ thống sập: pause", lines: [
      "// DB chết: đừng đổ hàng triệu message vào DLQ",
      "if db_circuit_breaker.is_open() {",
      "    consumer.pause(&consumer.assignment()?)?;     // ngừng fetch, vẫn giữ membership",
      "    wait_until_db_healthy().await;",
      "    consumer.resume(&consumer.assignment()?)?;",
      "}",
      "// lưu ý: StreamConsumer vẫn phải được poll (recv) để duy trì group — dùng timeout/select"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m"><div class="nl">📥 orders offset 500</div><div class="ns">process() lỗi</div></div>
    <div class="arrow" id="a1">↓ phân loại</div>
    <div class="row">
      <div class="node" id="tr"><div class="nl">⏳ Tạm thời</div><div class="ns">retry tại chỗ, backoff</div></div>
      <div class="node" id="pm"><div class="nl">☠️ Poison pill</div><div class="ns">không retry</div></div>
      <div class="node" id="down"><div class="nl">🔌 Hệ thống sập</div><div class="ns">pause consumer</div></div>
    </div>
    <div class="arrow" id="a2">↓ hết lượt / vĩnh viễn</div>
    <div class="row">
      <div class="node" id="rt"><div class="nl">🔁 orders.retry.1m</div><div class="ns">non-blocking (vỡ thứ tự)</div></div>
      <div class="node" id="dlq"><div class="nl">🪦 orders.dlq</div><div class="ns">header ngữ cảnh · cảnh báo · re-drive</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Phân loại trước", tab: "classify", highlight: [2, 3, 7], on: ["m", "a1"],
      desc: "Chỉ lỗi tạm thời mới đáng retry. Poison pill retry bao nhiêu cũng vô ích." },
    { title: "2 · Retry tại chỗ có giới hạn", tab: "flow", highlight: [6, 7, 8], on: ["tr"],
      desc: "Backoff 400, 800, 1600ms. Tổng thời gian phải dưới max.poll.interval." },
    { title: "3 · Hết lượt → DLQ, rồi đi tiếp", tab: "flow", highlight: [10, 13], on: ["pm", "a2", "dlq"],
      desc: "Chỉ store offset khi message đã được xử lý hoặc đã nằm an toàn trong DLQ." },
    { title: "4 · Header ngữ cảnh", tab: "dlq", highlight: [2, 3, 4, 5, 6, 12], on: ["dlq"],
      desc: "Ai đọc DLQ cần biết message từ đâu, lỗi gì. Gửi DLQ thất bại thì không được commit." },
    { title: "5 · Spring làm sẵn", tab: "spring", highlight: [3, 4, 5, 10], on: ["rt", "dlq"],
      desc: "DefaultErrorHandler + DeadLetterPublishingRecoverer, hoặc @RetryableTopic cho non-blocking." },
    { title: "6 · Khi phụ thuộc sập", tab: "pause", highlight: [2, 3, 5], on: ["down"],
      desc: "Pause giữ nguyên offset và membership; resume khi phụ thuộc khoẻ lại." }
  ],

  quiz: [
    { q: "Poison pill là gì?", options: [
        "Message quá lớn",
        "Message mà xử lý bao nhiêu lần cũng lỗi (dữ liệu hỏng, schema lạ...)",
        "Message bị nén",
        "Message có key null"
      ], correct: 1, explanation: "Retry vô hạn poison pill làm kẹt partition." },
    { q: "Retry vô hạn tại chỗ một poison pill gây ra gì?", options: [
        "Không sao", "Partition kẹt, lag tăng mãi", "Message tự vào DLQ", "Broker xoá message"
      ], correct: 1, explanation: "Cần giới hạn số lần và phân loại lỗi." },
    { q: "Nhược điểm chính của retry topic (non-blocking)?", options: [
        "Chặn partition", "Làm vỡ thứ tự theo key", "Mất message", "Không dùng được với Rust"
      ], correct: 1, explanation: "Message sau cùng key được xử lý trước message đang chờ retry." },
    { q: "DB chết hoàn toàn 10 phút. Cách xử lý tốt?", options: [
        "Đẩy mọi message vào DLQ",
        "Pause consumer (circuit breaker), resume khi DB khoẻ",
        "Commit bỏ qua",
        "Xoá topic"
      ], correct: 1, explanation: "Đây không phải lỗi của từng message." },
    { q: "Khi nào được store/commit offset của message lỗi?", options: [
        "Ngay khi lỗi",
        "Sau khi đã gửi thành công sang retry topic/DLQ",
        "Không bao giờ",
        "Sau 1 phút"
      ], correct: 1, explanation: "Gửi DLQ thất bại mà vẫn commit = mất." },
    { q: "Header nên kèm message trong DLQ?", options: [
        "Không cần gì",
        "Topic/partition/offset gốc, lỗi, số lần thử, thời điểm",
        "Mật khẩu DB",
        "Toàn bộ stack trace JVM của mọi thread"
      ], correct: 1, explanation: "Đủ để điều tra và re-drive." },
    { q: "Trong Spring, lỗi DeserializationException nên…", options: [
        "Retry 10 lần", "Khai báo không retry (addNotRetryableExceptions) và đưa thẳng DLT", "Bỏ qua im lặng", "Dừng ứng dụng"
      ], correct: 1, explanation: "Giải mã lỗi là lỗi vĩnh viễn." },
    { q: "Tổng thời gian retry tại chỗ bị giới hạn bởi cấu hình nào của consumer?", options: [
        "session.timeout.ms", "max.poll.interval.ms", "linger.ms", "retention.ms"
      ], correct: 1, explanation: "Vượt thì bị đá khỏi group." },
    { q: "Một DLQ 'tốt' cần những gì?", options: [
        "Chỉ cần tồn tại",
        "Người sở hữu, metric + cảnh báo, runbook, công cụ re-drive, retention đủ dài",
        "Replication factor 1",
        "Compaction"
      ], correct: 1, explanation: "DLQ không ai đọc = mất dữ liệu có trì hoãn." }
  ]
});
