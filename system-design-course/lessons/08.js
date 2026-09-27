window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Độ bền khi gọi nhau",
  title: "Idempotency: gọi lại bao nhiêu lần cũng như một",
  subtitle: "Idempotency-Key cho API · bảng khoá trong cùng transaction · consumer khử trùng · ràng buộc unique",

  theory: `
    <p>Mạng di động mất response thường xuyên: server đã tạo đơn, nhưng app nhận timeout. App (hoặc người dùng bấm lại) gửi lần nữa → hai đơn, trừ tiền hai lần.
    Retry chỉ an toàn khi thao tác <strong>idempotent</strong>: thực hiện N lần có cùng hiệu ứng như 1 lần.</p>

    <table>
      <tr><th>Thao tác</th><th>Idempotent tự nhiên?</th></tr>
      <tr><td>GET, HEAD</td><td>Có (không đổi trạng thái)</td></tr>
      <tr><td>PUT /carts/1 (ghi đè toàn bộ), DELETE /x/1</td><td>Có về mặt trạng thái (response lần 2 có thể khác, vd 404)</td></tr>
      <tr><td><code>UPDATE ... SET status='PAID'</code></td><td>Có</td></tr>
      <tr><td><code>UPDATE ... SET balance = balance - 100</code></td><td><strong>Không</strong></td></tr>
      <tr><td>POST /orders, POST /payments</td><td><strong>Không</strong> → cần Idempotency-Key</td></tr>
    </table>

    <p><strong>Mẫu Idempotency-Key</strong> (Stripe phổ biến hoá; IETF đang chuẩn hoá header <code>Idempotency-Key</code>):</p>
    <ol>
      <li>Client sinh UUID <em>một lần cho một ý định</em> (một lần bấm "Đặt hàng"), lưu lại, gửi kèm mọi lần retry của ý định đó.</li>
      <li>Server lưu (key, user, hash body, trạng thái, response) <strong>trong cùng transaction</strong> với việc tạo đơn. Unique constraint trên (user, key).</li>
      <li>Request lặp với key đã xong → trả lại response đã lưu. Key đang xử lý → 409 (hoặc chờ). Cùng key nhưng body khác → 422 (client dùng sai key).</li>
      <li>Key hết hạn sau 24 h–vài ngày để bảng không phình.</li>
    </ol>

    <p><strong>Idempotent ở phía consumer Kafka</strong> (at-least-once, bài 05):</p>
    <ul>
      <li>Bảng <code>processed_events(event_id PK)</code>, chèn cùng transaction với tác dụng nghiệp vụ; trùng khoá → bỏ qua.</li>
      <li>Hoặc làm tác dụng tự nhiên idempotent: upsert theo khoá nghiệp vụ, <code>SET status</code> thay vì cộng dồn, ràng buộc unique (vd <code>UNIQUE(order_id)</code> ở bảng payment).</li>
      <li>Redis <code>SET key 1 NX EX 86400</code> nhanh nhưng không cùng transaction với DB → có khe hở nếu crash giữa hai bước; dùng cho tác dụng "chấp nhận lặp hiếm" như gửi push.</li>
    </ul>

    <div class="callout"><p>💡 Cốt lõi: <strong>kiểm tra và ghi phải nguyên tử</strong>. "SELECT xem có chưa → chưa thì INSERT" trong hai câu riêng có race: hai retry đến cùng lúc đều thấy "chưa".
    Để DB chặn bằng unique constraint (<code>INSERT ... ON CONFLICT DO NOTHING</code>) thay vì tự kiểm bằng code. Spring cũng vậy — <code>@Transactional</code> mặc định READ COMMITTED không cứu được check-then-insert.</p></div>
  `,

  codeTabs: [
    { id: "client", label: "① Mobile gửi key", lines: [
      "// Kotlin (app native) — sinh key khi người dùng bấm 'Đặt hàng', giữ tới khi có kết quả cuối",
      "val key = checkoutState.idempotencyKey ?: UUID.randomUUID().toString().also {",
      "    checkoutState = checkoutState.copy(idempotencyKey = it)   // lưu, sống qua retry",
      "}",
      "api.post(\"/v1/orders\") {",
      "    header(\"Idempotency-Key\", key)",
      "    setBody(cartSnapshot)",
      "}",
      "// timeout -> retry với CÙNG key; thành công/lỗi nghiệp vụ -> xoá key"
    ]},
    { id: "sql", label: "② Bảng khoá", lines: [
      "CREATE TABLE idempotency_keys (",
      "  user_id      text        NOT NULL,",
      "  key          text        NOT NULL,",
      "  request_hash text        NOT NULL,",
      "  status       text        NOT NULL,        -- IN_PROGRESS | DONE",
      "  response     jsonb,",
      "  created_at   timestamptz NOT NULL DEFAULT now(),",
      "  PRIMARY KEY (user_id, key)",
      ");",
      "-- dọn định kỳ: DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours';"
    ]},
    { id: "rust", label: "③ Handler Rust", lines: [
      "async fn create_order(db: &PgPool, uid: &str, key: &str, req: OrderReq) -> Result<Resp, ApiError> {",
      "    let hash = sha256_hex(&serde_json::to_vec(&req)?);",
      "    let mut tx = db.begin().await?;",
      "    let inserted = sqlx::query(\"INSERT INTO idempotency_keys (user_id, key, request_hash, status)",
      "                               VALUES ($1, $2, $3, 'IN_PROGRESS') ON CONFLICT DO NOTHING\")",
      "        .bind(uid).bind(key).bind(&hash).execute(&mut *tx).await?.rows_affected() == 1;",
      "    if !inserted {",
      "        tx.rollback().await?;",
      "        return replay_or_conflict(db, uid, key, &hash).await;  // DONE->response cũ; khác hash->422; đang chạy->409",
      "    }",
      "    let order = repo::insert_order(&mut tx, uid, &req).await?;",
      "    let resp = Resp::created(&order);",
      "    sqlx::query(\"UPDATE idempotency_keys SET status='DONE', response=$3 WHERE user_id=$1 AND key=$2\")",
      "        .bind(uid).bind(key).bind(serde_json::to_value(&resp)?).execute(&mut *tx).await?;",
      "    tx.commit().await?;          // đơn và khoá cùng commit hoặc cùng mất",
      "    Ok(resp)",
      "}"
    ]},
    { id: "cons", label: "④ Consumer khử trùng", lines: [
      "BEGIN;",
      "INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING;",
      "-- rows_affected = 0  => đã xử lý rồi: COMMIT và bỏ qua",
      "INSERT INTO payments (order_id, amount_minor, status)",
      "VALUES ($2, $3, 'PENDING') ON CONFLICT (order_id) DO NOTHING;   -- lưới an toàn thứ 2",
      "COMMIT;",
      "",
      "-- Không idempotent:  UPDATE wallet SET balance = balance - $1 WHERE id = $2;",
      "-- Idempotent:        ghi bút toán ledger(entry_id PK, ...) rồi balance = SUM(ledger)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">Idempotency-Key: 7c1e…</div></div>
    <div class="arrow" id="a1">↓ lần 1 (response bị mất) · lần 2 (retry, cùng key)</div>
    <div class="node" id="svc"><div class="nl">🦀 order-service</div><div class="ns">INSERT key ON CONFLICT DO NOTHING</div></div>
    <div class="row">
      <div class="node" id="new"><div class="nl">Key mới</div><div class="ns">tạo đơn + lưu response, 1 transaction</div></div>
      <div class="node" id="dup"><div class="nl">Key đã có</div><div class="ns">trả response cũ / 409 / 422</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="db"><div class="nl">🐘 Postgres</div><div class="ns">PRIMARY KEY (user_id, key)</div></div>
  `,
  steps: [
    { title: "1 · Một ý định, một key", tab: "client", highlight: [2, 3, 6, 9], on: ["app"],
      desc: "Key sinh lúc bấm nút và được giữ qua các lần retry. Sinh key mới mỗi lần retry thì vô nghĩa." },
    { title: "2 · Bảng khoá với khoá chính kép", tab: "sql", highlight: [2, 3, 4, 5, 8], on: ["db"],
      desc: "request_hash phát hiện client dùng lại key cho nội dung khác." },
    { title: "3 · Chèn khoá — DB phân xử race", tab: "rust", highlight: [3, 4, 5, 6], on: ["a1", "svc"],
      desc: "Hai retry đến cùng lúc: chỉ một INSERT thắng. Không có 'SELECT rồi INSERT'." },
    { title: "4 · Request lặp", tab: "rust", highlight: [7, 8, 9], on: ["dup"],
      desc: "Đã DONE → trả y response cũ, app thấy như thành công bình thường." },
    { title: "5 · Cùng commit", tab: "rust", highlight: [11, 13, 15], on: ["new", "a2", "db"],
      desc: "Đơn và trạng thái khoá trong một transaction: không có chuyện có đơn mà khoá chưa DONE." },
    { title: "6 · Consumer cũng phải idempotent", tab: "cons", highlight: [2, 3, 5, 8, 9], on: ["db"],
      desc: "processed_events + unique nghiệp vụ. Cộng dồn số dư là không idempotent; ghi bút toán có ID thì có." }
  ],

  quiz: [
    { q: "Thao tác idempotent là…", options: [
        "Thao tác nhanh",
        "Thực hiện nhiều lần có cùng hiệu ứng như một lần",
        "Thao tác chỉ đọc",
        "Thao tác không lỗi"
      ], correct: 1, explanation: "GET/PUT/DELETE về mặt trạng thái; POST thì không tự nhiên." },
    { q: "Câu SQL nào KHÔNG idempotent?", options: [
        "UPDATE orders SET status='PAID' WHERE id=1",
        "UPDATE wallet SET balance = balance - 100 WHERE id=1",
        "DELETE FROM carts WHERE id=1",
        "INSERT ... ON CONFLICT DO NOTHING"
      ], correct: 1, explanation: "Chạy hai lần trừ hai lần." },
    { q: "Client nên sinh Idempotency-Key khi nào?", options: [
        "Mỗi lần gửi HTTP, kể cả retry",
        "Một lần cho một ý định (một lần bấm Đặt hàng), dùng lại cho mọi retry của ý định đó",
        "Một lần khi cài app",
        "Server sinh"
      ], correct: 1, explanation: "Key mới mỗi retry = không khử trùng được." },
    { q: "Vì sao 'SELECT xem key có chưa, chưa thì INSERT' là sai?", options: [
        "Chậm",
        "Race: hai request đồng thời đều thấy 'chưa' và cùng xử lý",
        "Postgres không cho SELECT",
        "Không sai"
      ], correct: 1, explanation: "Dùng unique constraint để DB phân xử nguyên tử." },
    { q: "Vì sao lưu khoá idempotency trong CÙNG transaction với việc tạo đơn?", options: [
        "Cho gọn code",
        "Để không có trạng thái 'có đơn mà không có khoá' hoặc ngược lại khi crash",
        "Bắt buộc bởi HTTP",
        "Để nhanh hơn"
      ], correct: 1, explanation: "Cùng commit hoặc cùng rollback." },
    { q: "Cùng Idempotency-Key nhưng body khác lần trước. Server nên?", options: [
        "Tạo đơn mới",
        "Từ chối (vd 422) vì client dùng sai key",
        "Trả response cũ",
        "Ghi đè đơn cũ"
      ], correct: 1, explanation: "request_hash phát hiện điều này." },
    { q: "Consumer Kafka khử trùng chắc chắn nhất bằng cách nào?", options: [
        "Hy vọng Kafka không gửi lặp",
        "Chèn event_id vào bảng processed_events trong cùng transaction với tác dụng nghiệp vụ",
        "Sleep 1 giây",
        "Chỉ dùng 1 partition"
      ], correct: 1, explanation: "At-least-once nên lặp là bình thường." },
    { q: "Khử trùng bằng Redis SET NX có điểm yếu gì khi tác dụng ghi vào Postgres?", options: [
        "Redis chậm",
        "Không nguyên tử với transaction DB — crash giữa hai bước có thể mất hoặc lặp tác dụng",
        "Redis không có TTL",
        "Không có điểm yếu"
      ], correct: 1, explanation: "Chấp nhận được cho tác dụng lặp hiếm vô hại như gửi push." },
    { q: "Timeout khi gọi POST /payments có nghĩa là?", options: [
        "Thanh toán chắc chắn thất bại",
        "Không biết — có thể đã thành công; chỉ retry khi có idempotency key",
        "Thanh toán chắc chắn thành công",
        "Phải gọi hoàn tiền"
      ], correct: 1, explanation: "Timeout là 'không biết', không phải 'thất bại'." }
  ]
});
