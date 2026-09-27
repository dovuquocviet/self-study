window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Consumer sâu",
  title: "At-most / at-least / exactly-once & idempotent consumer",
  subtitle: "Ghép các mảnh: 'exactly-once' thực tế = at-least-once + xử lý idempotent · outbox",

  theory: `
    <p>Ba mức giao nhận, nhìn từ góc <em>hiệu ứng</em> (đã trừ tiền, đã ghi DB) chứ không phải từ việc "đọc":</p>
    <table>
      <tr><th>Mức</th><th>Cách đạt</th><th>Khi nào chấp nhận được</th></tr>
      <tr><td>At-most-once</td><td>Commit trước xử lý; acks=0/1</td><td>Metric, log — mất vài bản ghi không sao</td></tr>
      <tr><td>At-least-once</td><td>acks=all + retry; xử lý rồi mới commit</td><td>Mặc định cho mọi thứ; <strong>phải chịu được trùng</strong></td></tr>
      <tr><td>Exactly-once (hiệu ứng)</td><td>At-least-once + <strong>xử lý idempotent</strong>; hoặc transactions nếu mọi thứ nằm trong Kafka</td><td>Tiền, tồn kho, đếm chính xác</td></tr>
    </table>

    <p><strong>Trùng đến từ đâu?</strong> (1) producer retry không idempotence; (2) ứng dụng gửi lại (restart, job chạy lại); (3) consumer xử lý xong nhưng chết trước khi commit;
    (4) rebalance giữa xử lý và commit; (5) reset offset để replay. Bạn không loại bỏ được hết — nên thiết kế consumer <strong>idempotent</strong>: xử lý 2 lần cho kết quả như 1 lần.</p>

    <p><strong>Các kỹ thuật idempotent consumer</strong></p>
    <ol>
      <li><strong>Event ID + bảng processed</strong>: mỗi sự kiện mang <code>event_id</code> (UUID do producer sinh <em>một lần</em>, ghi trong payload/header).
        Trong cùng transaction DB: <code>INSERT INTO processed_events(event_id)</code> (unique) + cập nhật nghiệp vụ. Trùng khoá → bỏ qua.</li>
      <li><strong>Upsert theo khoá tự nhiên</strong>: <code>INSERT ... ON CONFLICT (order_id) DO UPDATE</code> — ghi trạng thái thay vì cộng dồn.</li>
      <li><strong>Phiên bản/điều kiện</strong>: chỉ áp dụng nếu <code>event.version &gt; row.version</code> — vừa chống trùng vừa chống sự kiện cũ tới muộn.</li>
      <li><strong>Lưu offset cùng dữ liệu</strong>: ghi (partition, offset) vào cùng bảng/transaction với dữ liệu; khi khởi động seek tới offset lưu trong DB, không dùng offset commit của Kafka.</li>
      <li><strong>Đích tự dedup</strong>: ClickHouse <code>ReplacingMergeTree</code>, Elasticsearch index với <code>_id</code> = event_id (ghi lại = ghi đè).</li>
    </ol>

    <p><strong>Phía producer: Transactional Outbox</strong>. Bài toán "dual write": service order vừa ghi Postgres vừa gửi Kafka — một cái thành công, cái kia thất bại → lệch.
    Outbox: trong <em>cùng transaction DB</em>, ghi bảng <code>orders</code> và bảng <code>outbox</code>. Một tiến trình khác (poller, hoặc CDC như Debezium đọc WAL) đẩy outbox lên Kafka.
    Có thể gửi trùng (at-least-once) → consumer vẫn cần idempotent, nhưng <strong>không bao giờ mất</strong> và không có sự kiện "ma" cho giao dịch đã rollback.</p>

    <div class="callout"><p>💡 Câu hỏi phỏng vấn kinh điển "Kafka có exactly-once không?" — trả lời đúng: có, trong phạm vi read-process-write nội bộ Kafka (transactions).
    Ra khỏi Kafka (DB, API, email), exactly-once là thuộc tính <em>bạn</em> xây bằng idempotency.</p></div>
  `,

  codeTabs: [
    { id: "sql", label: "① Bảng processed_events", lines: [
      "CREATE TABLE processed_events (",
      "  event_id   uuid PRIMARY KEY,",
      "  processed_at timestamptz NOT NULL DEFAULT now()",
      ");",
      "",
      "BEGIN;",
      "INSERT INTO processed_events(event_id) VALUES ($1)",
      "  ON CONFLICT DO NOTHING;           -- 0 dòng = đã xử lý rồi -> ROLLBACK, bỏ qua",
      "UPDATE wallets SET balance = balance - $2 WHERE user_id = $3;",
      "COMMIT;"
    ]},
    { id: "rust", label: "② Consumer idempotent (Rust)", lines: [
      "loop {",
      "    let m = consumer.recv().await?;",
      "    let ev: PaymentEvent = serde_json::from_slice(m.payload().unwrap_or_default())?;",
      "    let mut tx = pool.begin().await?;",
      "    let fresh = sqlx::query(\"INSERT INTO processed_events(event_id) VALUES ($1) ON CONFLICT DO NOTHING\")",
      "        .bind(ev.event_id).execute(&mut *tx).await?.rows_affected() == 1;",
      "    if fresh {",
      "        apply_payment(&mut tx, &ev).await?;",
      "    }",
      "    tx.commit().await?;",
      "    consumer.store_offset_from_message(&m)?;   // sau khi DB commit",
      "}"
    ]},
    { id: "outbox", label: "③ Outbox (producer)", lines: [
      "BEGIN;",
      "INSERT INTO orders(id, status) VALUES ('o-17', 'PAID');",
      "INSERT INTO outbox(id, topic, key, payload)",
      "  VALUES (gen_random_uuid(), 'orders', 'o-17', '{\"type\":\"OrderPaid\"}');",
      "COMMIT;                     -- cả hai hoặc không gì cả",
      "",
      "# relay (poller hoặc Debezium CDC) đọc outbox -> produce Kafka -> đánh dấu đã gửi",
      "# relay chết sau khi gửi, trước khi đánh dấu -> gửi lại -> consumer dedup bằng outbox.id"
    ]},
    { id: "ver", label: "④ Upsert có phiên bản", lines: [
      "INSERT INTO order_view(order_id, status, version)",
      "VALUES ($1, $2, $3)",
      "ON CONFLICT (order_id) DO UPDATE",
      "  SET status = EXCLUDED.status, version = EXCLUDED.version",
      "  WHERE order_view.version < EXCLUDED.version;",
      "",
      "-- trùng: version bằng -> không đổi; sự kiện cũ tới muộn: version nhỏ hơn -> bỏ qua"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">🧾 Order service</div><div class="ns">orders + outbox trong 1 transaction</div></div>
    <div class="arrow" id="a1">↓ relay/CDC (có thể gửi trùng)</div>
    <div class="node" id="k"><div class="nl">📨 Kafka (at-least-once)</div><div class="ns">event_id = outbox.id</div></div>
    <div class="arrow" id="a2">↓ có thể nhận 2 lần</div>
    <div class="node" id="c"><div class="nl">💳 Wallet consumer</div><div class="ns">INSERT processed_events ON CONFLICT DO NOTHING</div></div>
    <div class="row">
      <div class="node" id="n1"><div class="nl">lần 1</div><div class="ns">1 dòng → trừ tiền</div></div>
      <div class="node" id="n2"><div class="nl">lần 2</div><div class="ns">0 dòng → bỏ qua</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Outbox chống dual write", tab: "outbox", highlight: [1, 2, 3, 4, 5], on: ["src"],
      desc: "Dữ liệu nghiệp vụ và sự kiện được ghi nguyên tử trong Postgres." },
    { title: "2 · Relay at-least-once", tab: "outbox", highlight: [7, 8], on: ["a1", "k"],
      desc: "Không mất, nhưng có thể trùng. event_id cố định từ outbox là chìa khoá dedup." },
    { title: "3 · Bảng processed_events", tab: "sql", highlight: [2, 7, 8, 9], on: ["a2", "c"],
      desc: "Khoá chính trên event_id + cùng transaction với cập nhật nghiệp vụ." },
    { title: "4 · Consumer Rust", tab: "rust", highlight: [5, 6, 7, 8, 10, 11], on: ["n1", "n2"],
      desc: "Lần 1 chèn được → áp dụng. Lần 2 chèn 0 dòng → bỏ qua. Store offset sau khi DB commit." },
    { title: "5 · Upsert có phiên bản", tab: "ver", highlight: [3, 4, 5, 7], on: ["c"],
      desc: "Cách không cần bảng phụ: dữ liệu mang version; chỉ ghi khi mới hơn." }
  ],

  quiz: [
    { q: "Exactly-once 'thực tế' khi consumer ghi vào PostgreSQL đạt được bằng…", options: [
        "Bật enable.idempotence ở producer",
        "At-least-once + xử lý idempotent (dedup theo event_id trong cùng transaction DB)",
        "acks=all",
        "isolation.level=read_committed"
      ], correct: 1, explanation: "Transactions Kafka không bao được DB bên ngoài." },
    { q: "Nguồn trùng nào KHÔNG bị idempotent producer loại bỏ?", options: [
        "Retry nội bộ sau khi mất phản hồi",
        "Consumer xử lý xong nhưng crash trước khi commit offset",
        "Batch gửi lại do timeout",
        "Retry do NOT_LEADER"
      ], correct: 1, explanation: "Đó là trùng phía consumer." },
    { q: "event_id nên được sinh ở đâu?", options: [
        "Consumer, mỗi lần nhận",
        "Một lần tại nguồn (producer/outbox), đi theo sự kiện qua mọi lần gửi lại",
        "Broker gán",
        "Dùng offset làm event_id luôn an toàn"
      ], correct: 1, explanation: "Nếu sinh lại khi gửi lại thì không dedup được. Offset cũng đổi nếu message bị gửi trùng." },
    { q: "Transactional outbox giải quyết vấn đề gì?", options: [
        "Consumer lag",
        "Dual write: ghi DB và gửi Kafka không nguyên tử",
        "Schema evolution",
        "Rebalance"
      ], correct: 1, explanation: "Sự kiện được ghi cùng transaction với dữ liệu nghiệp vụ." },
    { q: "Consumer cộng tiền 'balance = balance + amount' có idempotent không?", options: [
        "Có", "Không — xử lý 2 lần cộng 2 lần; cần dedup hoặc ghi trạng thái tuyệt đối", "Có nếu acks=all", "Có nếu dùng Rust"
      ], correct: 1, explanation: "Thao tác tương đối (cộng/trừ) cần bảo vệ bằng event_id." },
    { q: "Upsert có điều kiện 'WHERE version < EXCLUDED.version' xử lý thêm được trường hợp nào?", options: [
        "Mất message",
        "Sự kiện cũ tới muộn (lệch thứ tự) không ghi đè trạng thái mới hơn",
        "Rebalance",
        "Lag"
      ], correct: 1, explanation: "Vừa chống trùng vừa chống out-of-order." },
    { q: "Vì sao store offset SAU khi transaction DB commit?", options: [
        "Cho nhanh",
        "Nếu crash giữa hai bước, message được xử lý lại và dedup lo phần trùng — không mất",
        "Bắt buộc bởi Kafka",
        "Để giảm lag"
      ], correct: 1, explanation: "Ngược lại (store trước) có thể mất." },
    { q: "Kafka có exactly-once không — câu trả lời chính xác nhất?", options: [
        "Không bao giờ",
        "Có trong phạm vi read-process-write nội bộ Kafka (transactions); hiệu ứng ra ngoài cần idempotency",
        "Có cho mọi hệ thống khi bật acks=all",
        "Chỉ với ZooKeeper"
      ], correct: 1, explanation: "Phân biệt 'trong Kafka' và 'hiệu ứng bên ngoài'." },
    { q: "Ghi vào Elasticsearch idempotent đơn giản nhất bằng cách…", options: [
        "Để ES tự sinh _id",
        "Dùng _id = event_id (hoặc id thực thể) để ghi lại là ghi đè",
        "Tắt replica",
        "Dùng acks=0"
      ], correct: 1, explanation: "Tương tự ReplacingMergeTree trong ClickHouse." }
  ]
});
