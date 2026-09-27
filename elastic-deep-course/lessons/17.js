window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Ghi dữ liệu",
  title: "Đồng bộ từ DB chính vào ES: dual write vs outbox/CDC + Kafka",
  subtitle: "vì sao dual write hỏng · outbox · Debezium · partition key · idempotent bằng _id + external version · dựng lại read model",

  theory: `
    <p>Mỗi service một DB; ES là read model. Câu hỏi: <strong>làm sao thay đổi ở PostgreSQL/MongoDB đến được ES — đúng, đủ, đúng thứ tự?</strong></p>

    <p><strong>Cách 1 — Dual write</strong> (service ghi DB rồi gọi ES trong cùng request). Đơn giản nhưng sai theo nhiều kiểu:</p>
    <ul>
      <li>Ghi DB xong, gọi ES lỗi/timeout → hai bên lệch vĩnh viễn (không có transaction chung, không có 2PC với ES).</li>
      <li>Gọi ES trước khi transaction DB commit → ES có dữ liệu mà DB rollback.</li>
      <li>Hai request cập nhật cùng sản phẩm song song → tới ES theo thứ tự ngược → bản cũ đè bản mới.</li>
      <li>ES chậm/sập kéo theo API ghi của service chậm/sập.</li>
    </ul>

    <p><strong>Cách 2 — Sự kiện qua Kafka</strong> (khuyên dùng, và công ty đã có Kafka):</p>
    <ul>
      <li><strong>Transactional outbox</strong>: trong <em>cùng transaction</em> nghiệp vụ, INSERT một dòng vào bảng <code>outbox</code>. Tiến trình relay (hoặc CDC) đẩy dòng đó lên Kafka. DB commit ⇔ sự kiện tồn tại.</li>
      <li><strong>CDC</strong> (Change Data Capture) — Debezium đọc WAL của PostgreSQL (logical replication) hoặc change streams của MongoDB, phát mọi thay đổi lên Kafka mà không sửa code service. Thường kết hợp outbox (Debezium có Outbox Event Router) để sự kiện mang ý nghĩa nghiệp vụ thay vì lộ cấu trúc bảng.</li>
      <li><strong>Indexer</strong> (Rust, rdkafka) đọc topic, dựng document, gửi bulk vào ES, rồi mới commit offset → at-least-once.</li>
    </ul>

    <p><strong>Ba nguyên tắc để at-least-once thành "đúng"</strong></p>
    <ol>
      <li><strong>Idempotent</strong>: <code>_id</code> ES = id thực thể (không để ES tự sinh). Nhận lại cùng sự kiện = ghi đè cùng document.</li>
      <li><strong>Thứ tự</strong>: key Kafka = id thực thể → mọi sự kiện của một sản phẩm vào cùng partition, giữ thứ tự. Thêm <strong>external version</strong> (row version / updated_at từ DB) để bản cũ tới trễ (retry, reindex, replay) bị loại.</li>
      <li><strong>Sự kiện mang trạng thái đầy đủ</strong> (hoặc indexer đọc lại trạng thái mới nhất từ API/DB khi nhận sự kiện) thay vì delta kiểu "giá giảm 10%": delta áp hai lần là sai, trạng thái đầy đủ áp hai lần vẫn đúng.</li>
    </ol>

    <p><strong>Dữ liệu từ nhiều service</strong> (sản phẩm + tồn kho + đánh giá): indexer subscribe nhiều topic, mỗi topic cập nhật phần của mình bằng partial update/script, hoặc giữ state cục bộ để ghép. Chấp nhận nhất quán cuối cùng (eventual consistency) — màn hình tìm kiếm trễ vài giây là bình thường; màn hình thanh toán thì đọc từ service gốc.</p>

    <p><strong>Vận hành</strong>: lỗi dữ liệu (409 từ external version là bình thường — bỏ qua; 400 mapping) → dead-letter topic; lỗi tạm (429, timeout) → retry có backoff, không commit offset. Luôn có đường <strong>dựng lại từ đầu</strong>: full export từ DB → index mới → alias swap (bài 16), và job <strong>reconcile</strong> định kỳ so số lượng/checksum giữa DB và ES.</p>

    <div class="callout"><p>💡 Spring hay có <code>@TransactionalEventListener(phase = AFTER_COMMIT)</code> gọi ES — tránh được "ghi trước commit" nhưng vẫn mất sự kiện nếu app chết ngay sau commit. Outbox giải quyết đúng chỗ đó. ClickHouse của ta cũng là consumer Kafka — cùng topic có thể nuôi cả ES lẫn ClickHouse.</p></div>
  `,

  codeTabs: [
    { id: "dual", label: "① Dual write hỏng ở đâu", lines: [
      "// ❌ trong handler của product-service",
      "tx.begin();",
      "db.update_price(42, 7_990_000);",
      "es.index(\"products\", 42, doc).await?;   // (1) ES đã có giá mới",
      "tx.commit()?;                             // (2) commit lỗi → DB vẫn giá cũ",
      "",
      "// đảo thứ tự: commit trước, gọi ES sau",
      "tx.commit()?;",
      "es.index(\"products\", 42, doc).await?;   // timeout → ES giữ giá cũ mãi mãi",
      "// request A (giá 8.99tr) và B (7.99tr) song song → ES có thể nhận B rồi A"
    ]},
    { id: "outbox", label: "② Outbox trong PostgreSQL", lines: [
      "BEGIN;",
      "UPDATE products SET price = 7990000, row_version = row_version + 1 WHERE id = 42;",
      "INSERT INTO outbox (aggregate_type, aggregate_id, type, payload)",
      "VALUES ('product', '42', 'ProductUpdated',",
      "        '{\"id\":42,\"sku\":\"A55\",\"price\":7990000,\"row_version\":18}');",
      "COMMIT;",
      "",
      "# Debezium (Outbox Event Router) đọc WAL → topic product-events, key = '42'"
    ]},
    { id: "indexer", label: "③ Indexer idempotent", lines: [
      "loop {",
      "    let batch = consumer.poll_batch(500, Duration::from_millis(200)).await;",
      "    let ops = batch.iter().map(|ev| {",
      "        BulkOperation::index(ev.to_document())",
      "            .id(ev.id.to_string())               // _id = id thực thể",
      "            .version(ev.row_version)             // version từ DB",
      "            .version_type(VersionType::External)",
      "            .into()",
      "    }).collect::<Vec<BulkOperation<_>>>();",
      "    let failed = send_bulk_and_classify(ops).await?;  // 409 = bản cũ, bỏ qua",
      "    dead_letter(failed.permanent).await?;             // 400 mapping...",
      "    retry_with_backoff(failed.transient).await?;      // 429, timeout",
      "    consumer.commit_offsets(&batch)?;                 // commit SAU khi ES nhận",
      "}"
    ]},
    { id: "rebuild", label: "④ Dựng lại & đối soát", lines: [
      "# dựng lại toàn bộ read model",
      "1. tạo products_v5 (mapping mới)",
      "2. ghi lại offset hiện tại của topic = T0",
      "3. export từ PostgreSQL: SELECT ... ORDER BY id  → bulk vào v5 (external version)",
      "4. consumer group mới đọc từ T0 → v5",
      "5. alias swap",
      "",
      "# reconcile hằng đêm",
      "SELECT count(*) FROM products WHERE status = 'ACTIVE';   -- 120 431",
      "GET /products/_count { \"query\": { \"term\": { \"status\": \"ACTIVE\" } } }   // 120 429 → tìm 2 id lệch"
    ]}
  ],

  stageHtml: `
    <div class="node" id="svc"><div class="nl">🧩 product-service</div><div class="ns">UPDATE products + INSERT outbox (1 transaction)</div></div>
    <div class="arrow" id="a1">↓ Debezium đọc WAL</div>
    <div class="node" id="kafka"><div class="nl">📨 Kafka: product-events</div><div class="ns">key = product id → cùng partition</div></div>
    <div class="row">
      <div class="node" id="idx"><div class="nl">🦀 es-indexer</div><div class="ns">_id + external version · bulk</div></div>
      <div class="node" id="ch"><div class="nl">📊 ClickHouse consumer</div><div class="ns">cùng topic, mục đích khác</div></div>
    </div>
    <div class="arrow" id="a2">↓ commit offset sau khi ES nhận</div>
    <div class="node" id="es"><div class="nl">🔎 Elasticsearch</div><div class="ns">read model, trễ vài giây</div></div>
  `,
  steps: [
    { title: "1 · Dual write không có transaction chung", tab: "dual", highlight: [4, 5, 9, 10], on: ["svc", "es"],
      desc: "Mọi thứ tự gọi đều có kịch bản lệch; không có 2PC giữa PostgreSQL và ES." },
    { title: "2 · Outbox: sự kiện cùng transaction", tab: "outbox", highlight: [1, 2, 3, 6], on: ["svc"],
      desc: "Commit thành công thì chắc chắn có sự kiện; rollback thì không có." },
    { title: "3 · CDC đẩy lên Kafka theo key", tab: "outbox", highlight: [8], on: ["a1", "kafka"],
      desc: "Key = id sản phẩm giữ thứ tự trong một partition." },
    { title: "4 · Indexer idempotent", tab: "indexer", highlight: [5, 6, 7, 10], on: ["idx", "es"],
      desc: "Nhận trùng thì ghi đè cùng _id; bản cũ bị external version loại (409 là bình thường)." },
    { title: "5 · Commit offset sau cùng", tab: "indexer", highlight: [11, 12, 13], on: ["a2"],
      desc: "Sập giữa chừng thì đọc lại từ offset cũ — at-least-once, và nhờ bước 4 nên vẫn đúng." },
    { title: "6 · Luôn dựng lại được", tab: "rebuild", highlight: [2, 3, 4, 5, 9, 10], on: ["kafka", "ch", "es"],
      desc: "Export + replay từ T0 + alias swap; reconcile để phát hiện lệch âm thầm." }
  ],

  quiz: [
    { q: "Vấn đề cốt lõi của dual write DB + ES?", options: [
        "Chậm hơn",
        "Không có transaction chung: một bên thành công một bên lỗi → lệch vĩnh viễn; thứ tự có thể đảo",
        "ES không nhận HTTP",
        "Tốn disk"
      ], correct: 1, explanation: "Không có 2PC giữa PostgreSQL và ES." },
    { q: "Transactional outbox đảm bảo điều gì?", options: [
        "Exactly-once tới ES",
        "Sự kiện được ghi cùng transaction với thay đổi nghiệp vụ — commit thì có sự kiện, rollback thì không",
        "Không cần Kafka",
        "ES luôn cập nhật tức thì"
      ], correct: 1, explanation: "Relay/CDC sau đó đẩy sự kiện đi." },
    { q: "Debezium lấy thay đổi của PostgreSQL từ đâu?", options: [
        "Polling SELECT mỗi giây", "WAL qua logical replication", "Trigger gọi HTTP", "pg_dump"
      ], correct: 1, explanation: "MongoDB thì qua change streams." },
    { q: "Vì sao key Kafka nên là id thực thể?", options: [
        "Để nén tốt",
        "Mọi sự kiện của cùng thực thể vào cùng partition → giữ thứ tự",
        "Để tăng partition",
        "Bắt buộc"
      ], correct: 1, explanation: "Kafka chỉ đảm bảo thứ tự trong partition." },
    { q: "Indexer commit offset trước khi gửi bulk rồi sập. Hậu quả?", options: [
        "Không sao",
        "Sự kiện đã commit nhưng chưa vào ES → mất cập nhật",
        "Trùng dữ liệu",
        "Kafka tự gửi lại"
      ], correct: 1, explanation: "Commit sau khi ES xác nhận để có at-least-once." },
    { q: "Làm sao at-least-once (có thể nhận trùng) vẫn cho kết quả đúng?", options: [
        "Không thể",
        "_id = id thực thể + external version + sự kiện mang trạng thái đầy đủ",
        "Dùng refresh=true",
        "Tăng replica"
      ], correct: 1, explanation: "Áp lại nhiều lần cho cùng kết quả (idempotent)." },
    { q: "Vì sao sự kiện 'giá giảm 10%' (delta) nguy hiểm với ES?", options: [
        "ES không hỗ trợ số thập phân",
        "Nhận trùng thì áp hai lần → sai; trạng thái đầy đủ áp lại vẫn đúng",
        "Vì chậm",
        "Vì không có _id"
      ], correct: 1, explanation: "Delta không idempotent." },
    { q: "Indexer nhận 409 version_conflict với version_type external. Xử lý?", options: [
        "Retry mãi",
        "Bỏ qua — ES đã có bản mới hơn",
        "Gửi dead-letter và báo động",
        "Xoá document"
      ], correct: 1, explanation: "Đây là cơ chế loại bản cũ đang hoạt động đúng." },
    { q: "Mục đích của job reconcile định kỳ?", options: [
        "Tăng tốc search",
        "Phát hiện lệch âm thầm giữa DB chính và ES (so số lượng/checksum) để sửa",
        "Merge segment",
        "Xoá index cũ"
      ], correct: 1, explanation: "Không hệ thống phân tán nào miễn nhiễm lệch." },
    { q: "Màn hình nào KHÔNG nên đọc từ ES read model?", options: [
        "Tìm kiếm sản phẩm",
        "Facet lọc",
        "Xác nhận thanh toán cần giá/tồn kho chính xác tức thời",
        "Gợi ý autocomplete"
      ], correct: 2, explanation: "Read model nhất quán cuối cùng; nghiệp vụ quan trọng đọc từ service gốc." }
  ]
});
