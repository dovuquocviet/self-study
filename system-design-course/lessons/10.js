window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Độ bền khi gọi nhau",
  title: "Transactional Outbox, CDC & eventual consistency",
  subtitle: "Dual write · bảng outbox cùng transaction · relay polling vs Debezium · thứ tự & trùng lặp",

  theory: `
    <p><strong>Dual write</strong>: ghi DB rồi gửi Kafka bằng hai lệnh riêng. Không có thứ tự nào an toàn:</p>
    <ul>
      <li>Commit DB → crash trước khi gửi: đơn tồn tại nhưng không ai biết (không push, không trừ kho, ClickHouse thiếu).</li>
      <li>Gửi Kafka trước → DB rollback: mọi người tin có đơn nhưng đơn không tồn tại.</li>
      <li>Gửi Kafka <em>bên trong</em> transaction: Kafka timeout làm giữ transaction lâu; và vẫn có thể gửi xong rồi commit lỗi.</li>
    </ul>

    <p><strong>Transactional Outbox</strong>: thay vì gửi Kafka, <em>chèn event vào bảng <code>outbox</code> trong cùng transaction</em> với thay đổi nghiệp vụ.
    Một tiến trình riêng (relay) đọc outbox và publish lên Kafka. Vì cùng transaction nên "có thay đổi ⇔ có event" — nguyên tử bởi chính Postgres.</p>

    <p><strong>Hai cách làm relay</strong></p>
    <table>
      <tr><th></th><th>Polling</th><th>CDC (Debezium đọc WAL)</th></tr>
      <tr><td>Cách</td><td>Vòng lặp <code>SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100</code>, publish, đánh dấu đã gửi</td><td>Đọc logical replication log của Postgres, biến mỗi INSERT vào outbox thành message</td></tr>
      <tr><td>Ưu</td><td>Đơn giản, không cần hạ tầng thêm</td><td>Độ trễ thấp, không query DB liên tục, thứ tự theo commit</td></tr>
      <tr><td>Nhược</td><td>Tải query định kỳ; độ trễ = chu kỳ poll; cần dọn bảng</td><td>Vận hành Kafka Connect/Debezium, replication slot (slot treo làm WAL phình đầy đĩa)</td></tr>
    </table>

    <p><strong>Hệ quả phải chấp nhận</strong></p>
    <ul>
      <li><strong>At-least-once</strong>: relay publish xong nhưng chết trước khi đánh dấu → publish lại. Consumer khử trùng bằng <code>event_id</code> (bài 08).</li>
      <li><strong>Thứ tự</strong>: publish với key = aggregate id (order_id) để các event của cùng đơn vào cùng partition; relay nhiều luồng phải giữ thứ tự theo key.</li>
      <li><strong>Eventual consistency</strong>: read model (ES, ClickHouse, bản sao ở service khác) trễ vài trăm ms–vài giây. Thiết kế UI cho điều đó:
        sau khi tạo đơn, app hiển thị từ response của POST (read-your-writes) thay vì gọi ngay danh sách đơn từ Elasticsearch.</li>
    </ul>

    <p><strong>Inbox</strong> là mẫu đối xứng ở phía nhận: lưu message đến vào bảng <code>inbox</code>/<code>processed_events</code> trong cùng transaction với tác dụng — chính là khử trùng ở bài 08.</p>

    <div class="callout"><p>💡 Outbox + inbox + key theo aggregate = "exactly-once <em>về tác dụng</em>" dù đường truyền là at-least-once. Kafka có transaction/EOS cho luồng Kafka→Kafka,
    nhưng không bao được Postgres của bạn — nên outbox vẫn cần. Với Spring bạn có thể đã dùng <code>@TransactionalEventListener(AFTER_COMMIT)</code>: nó vẫn là dual write (chết sau commit là mất event).</p></div>
  `,

  codeTabs: [
    { id: "dual", label: "① Dual write (sai)", lines: [
      "let mut tx = db.begin().await?;",
      "repo::insert_order(&mut tx, &order).await?;",
      "tx.commit().await?;",
      "// <-- process bị kill ở đây (deploy, OOM): đơn đã có, event mất vĩnh viễn",
      "producer.send(FutureRecord::to(\"order.v1\").key(&order.id).payload(&evt), timeout).await?;"
    ]},
    { id: "outbox", label: "② Ghi outbox", lines: [
      "CREATE TABLE outbox (",
      "  id            uuid PRIMARY KEY,          -- = event_id",
      "  aggregatetype text  NOT NULL,            -- 'order' -> topic",
      "  aggregateid   text  NOT NULL,            -- order_id -> Kafka key",
      "  type          text  NOT NULL,            -- 'OrderPlaced'",
      "  payload       jsonb NOT NULL,",
      "  created_at    timestamptz NOT NULL DEFAULT now(),",
      "  published_at  timestamptz                -- dùng cho relay kiểu polling",
      ");",
      "",
      "BEGIN;",
      "INSERT INTO orders (...) VALUES (...);",
      "INSERT INTO outbox (id, aggregatetype, aggregateid, type, payload)",
      "VALUES ($1, 'order', $2, 'OrderPlaced', $3);",
      "COMMIT;   -- đơn và event cùng tồn tại hoặc cùng không"
    ]},
    { id: "poll", label: "③ Relay polling (Rust)", lines: [
      "loop {",
      "    let mut tx = db.begin().await?;",
      "    let rows: Vec<OutboxRow> = sqlx::query_as(",
      "        \"SELECT * FROM outbox WHERE published_at IS NULL",
      "         ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED\")   // nhiều relay không giẫm nhau",
      "        .fetch_all(&mut *tx).await?;",
      "    for r in &rows {",
      "        producer.send(FutureRecord::to(&topic_of(r)).key(&r.aggregateid).payload(&r.payload_bytes()),",
      "                      Duration::from_secs(5)).await.map_err(|(e, _)| e)?;",
      "    }",
      "    mark_published(&mut tx, &rows).await?;   // chết trước dòng này -> publish lại (at-least-once)",
      "    tx.commit().await?;",
      "    if rows.is_empty() { tokio::time::sleep(Duration::from_millis(200)).await; }",
      "}"
    ]},
    { id: "cdc", label: "④ Debezium Outbox", lines: [
      "# Kafka Connect: Debezium Postgres connector + Outbox Event Router",
      "connector.class=io.debezium.connector.postgresql.PostgresConnector",
      "plugin.name=pgoutput",
      "database.hostname=orders-db",
      "table.include.list=public.outbox",
      "transforms=outbox",
      "transforms.outbox.type=io.debezium.transforms.outbox.EventRouter",
      "transforms.outbox.route.topic.replacement=${routedByValue}.v1",
      "# aggregatetype='order' -> topic order.v1 ; aggregateid -> message key",
      "",
      "# Postgres: wal_level=logical. Theo dõi replication slot lag —",
      "# connector dừng lâu thì WAL không được dọn và đầy đĩa."
    ]},
    { id: "ryw", label: "⑤ Eventual consistency ở UI", lines: [
      "// Sai: tạo đơn xong gọi ngay danh sách từ read model (ES) -> đơn mới chưa có",
      "val created = api.createOrder(cart)",
      "val list = api.listOrders()          // có thể trễ 1-2 s, người dùng tưởng mất đơn",
      "",
      "// Đúng: read-your-writes — hiển thị từ response của POST, chèn vào đầu danh sách cục bộ",
      "val created = api.createOrder(cart)",
      "ordersCache.prepend(created)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="svc"><div class="nl">🦀 order-service</div><div class="ns">1 transaction</div></div>
    <div class="arrow" id="a1">↓ INSERT orders + INSERT outbox</div>
    <div class="node" id="db"><div class="nl">🐘 orders_db</div><div class="ns">orders · outbox (WAL)</div></div>
    <div class="arrow" id="a2">↓ relay: polling SKIP LOCKED hoặc Debezium đọc WAL</div>
    <div class="node" id="k"><div class="nl">📨 Kafka order.v1</div><div class="ns">key = order_id</div></div>
    <div class="arrow" id="a3">↓ at-least-once</div>
    <div class="row">
      <div class="node" id="inbox"><div class="nl">📥 Consumer + inbox</div><div class="ns">khử trùng event_id</div></div>
      <div class="node" id="rm"><div class="nl">🔎 Read model</div><div class="ns">trễ vài giây</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Dual write có khe chết", tab: "dual", highlight: [3, 4, 5], on: ["svc"],
      desc: "Không có thứ tự nào giữa commit và send đảm bảo cả hai cùng xảy ra." },
    { title: "2 · Event vào bảng, cùng transaction", tab: "outbox", highlight: [11, 12, 13, 14, 15], on: ["a1", "db"],
      desc: "Postgres đảm bảo nguyên tử. Chưa cần Kafka sống lúc này." },
    { title: "3 · Relay polling", tab: "poll", highlight: [4, 5, 8, 11], on: ["a2", "k"],
      desc: "SKIP LOCKED cho phép chạy nhiều relay. Chết trước khi đánh dấu → gửi lại: chấp nhận vì consumer khử trùng." },
    { title: "4 · Hoặc CDC với Debezium", tab: "cdc", highlight: [2, 3, 7, 8, 11, 12], on: ["db", "a2"],
      desc: "Đọc WAL: không poll, trễ thấp. Cái giá: vận hành Connect và canh replication slot." },
    { title: "5 · Phía nhận: inbox", tab: "outbox", highlight: [2, 4], on: ["a3", "inbox"],
      desc: "id outbox = event_id; key = aggregateid giữ thứ tự theo đơn. Consumer lưu event_id đã xử lý." },
    { title: "6 · Thiết kế UI cho độ trễ", tab: "ryw", highlight: [3, 6, 7], on: ["rm"],
      desc: "Read model trễ là bình thường. Hiển thị từ response ghi để người dùng thấy ngay việc mình vừa làm." }
  ],

  quiz: [
    { q: "Dual write là gì?", options: [
        "Ghi hai bản sao DB",
        "Ghi vào hai hệ thống (DB và Kafka) bằng hai thao tác không nguyên tử với nhau",
        "Ghi hai lần cho chắc",
        "Replication"
      ], correct: 1, explanation: "Crash giữa hai thao tác gây lệch." },
    { q: "Transactional outbox đảm bảo điều gì?", options: [
        "Exactly-once delivery trên mạng",
        "Thay đổi nghiệp vụ và event cùng được commit hoặc cùng không, nhờ một transaction DB",
        "Kafka không bao giờ chết",
        "Consumer không cần idempotent"
      ], correct: 1, explanation: "Việc publish sau đó vẫn là at-least-once." },
    { q: "Vì sao relay polling dùng FOR UPDATE SKIP LOCKED?", options: [
        "Cho nhanh",
        "Nhiều relay chạy song song mà không lấy trùng cùng dòng và không chờ nhau",
        "Postgres bắt buộc",
        "Để xoá dòng"
      ], correct: 1, explanation: "Dòng đang bị relay khác khoá sẽ được bỏ qua." },
    { q: "Relay publish xong nhưng crash trước khi đánh dấu published. Hệ quả?", options: [
        "Mất event",
        "Event được publish lại → consumer phải khử trùng",
        "DB hỏng",
        "Kafka từ chối"
      ], correct: 1, explanation: "At-least-once." },
    { q: "Rủi ro vận hành chính của CDC qua replication slot?", options: [
        "Không có",
        "Connector dừng lâu → WAL không được giải phóng → đầy đĩa DB",
        "Mất dữ liệu ngay",
        "Chậm INSERT"
      ], correct: 1, explanation: "Phải giám sát độ trễ slot." },
    { q: "Vì sao dùng aggregateid (order_id) làm Kafka key?", options: [
        "Để mã hoá",
        "Event của cùng một đơn vào cùng partition → giữ thứ tự",
        "Để nén tốt",
        "Kafka yêu cầu"
      ], correct: 1, explanation: "OrderPlaced phải đến trước OrderCancelled." },
    { q: "@TransactionalEventListener(AFTER_COMMIT) rồi gửi Kafka có phải outbox không?", options: [
        "Có",
        "Không — vẫn là dual write, process chết sau commit là mất event",
        "Có, nếu dùng Spring Boot 3",
        "Không cần outbox với Spring"
      ], correct: 1, explanation: "Event không được lưu bền trong cùng transaction." },
    { q: "Người dùng tạo đơn xong mở danh sách (đọc từ Elasticsearch) không thấy đơn mới. Cách xử lý đúng?", options: [
        "Bỏ Elasticsearch",
        "Read-your-writes: hiển thị đơn từ response POST / cache cục bộ trong lúc read model cập nhật",
        "Sleep 5 giây",
        "Ghi đồng bộ vào ES trong transaction"
      ], correct: 1, explanation: "Eventual consistency cần được thiết kế ở UI." },
    { q: "Kafka transactions (EOS) có thay thế outbox cho Postgres → Kafka không?", options: [
        "Có hoàn toàn",
        "Không — EOS bao luồng Kafka→Kafka, không bao transaction Postgres của service",
        "Có nếu dùng acks=all",
        "Có nếu 1 partition"
      ], correct: 1, explanation: "Hai hệ thống khác nhau vẫn cần outbox." }
  ]
});
