window.LESSONS.push({
  id: "12",
  phase: "4", phaseName: "Truy vấn an toàn",
  title: "Dữ liệu trong luồng: Kafka & hàng đợi",
  subtitle: "Validate schema (Schema Registry) · consumer coi message là không tin cậy · ký message khi cần · dead-letter queue · áp dụng cho Kafka, Cloudflare Queues và mọi queue",

  theory: `
    <p>Với hàng đợi/stream (Kafka, RabbitMQ, SQS, Cloudflare Queues…), dữ liệu không đi từ người dùng thẳng vào DB mà qua nhiều chặng: producer → broker → một hoặc nhiều consumer → DB khác.
    Sai lầm phổ biến: <strong>consumer tin rằng message "từ hệ thống nội bộ" thì an toàn</strong>. Thực tế message có thể đến từ một producer bị lỗi, một service bị chiếm,
    một connector, một công cụ chạy tay, hoặc chứa dữ liệu người dùng được chuyển tiếp nguyên vẹn.</p>

    <p><strong>1. Message là input không tin cậy — tại mọi consumer</strong></p>
    <ul>
      <li><strong>Validate schema và giá trị</strong> như với request HTTP: kiểu, khoảng, độ dài, enum, field bắt buộc.</li>
      <li><strong>Giới hạn kích thước</strong>: broker <code>message.max.bytes</code>; consumer <code>max.partition.fetch.bytes</code>; từ chối mảng/chuỗi quá dài trong nội dung.</li>
      <li><strong>Deserialize an toàn</strong>: dùng định dạng dữ liệu thuần (JSON, Avro, Protobuf). Không dùng cơ chế tuần tự hoá "object" của ngôn ngữ (Java native serialization, pickle…)
        và không bật tính năng cho phép message tự chọn class để khởi tạo — đó là đường dẫn tới chạy mã tuỳ ý.</li>
      <li><strong>Không tin các field quyền</strong>: <code>tenant_id</code>, <code>user_id</code>, <code>role</code> trong message phải được kiểm tra khớp với nguồn (topic theo tenant, principal của producer, chữ ký).</li>
      <li><strong>Vẫn dùng truy vấn có tham số</strong> khi ghi message vào DB (bài 10–11). Message không phải lý do để ghép chuỗi.</li>
      <li><strong>Idempotent</strong>: message có thể được giao lại (at-least-once). Dùng <code>event_id</code> + bảng/khoá đã xử lý để không trừ tiền hai lần.</li>
    </ul>

    <p><strong>2. Schema Registry — hợp đồng dữ liệu cho topic</strong></p>
    <p>Schema Registry (Confluent, Apicurio, Karapace…) lưu schema Avro/Protobuf/JSON Schema cho mỗi topic (subject). Serializer của producer kiểm tra message theo schema trước khi gửi;
    deserializer của consumer biết chính xác cấu trúc. Thực hành tốt:</p>
    <ul>
      <li>Đặt chế độ tương thích (ví dụ <code>BACKWARD</code>) để thay đổi schema không phá consumer cũ.</li>
      <li>Producer ở prod: <code>auto.register.schemas=false</code> — schema được đăng ký qua CI/review, không phải do bất kỳ producer nào tự đẩy lên.</li>
      <li>Bảo vệ Schema Registry: có xác thực, phân quyền theo subject, không để hở ra ngoài (bài 17). Ai sửa được schema là sửa được "hợp đồng" của cả hệ thống.</li>
      <li>Schema chỉ bảo đảm <em>hình dạng</em>; ràng buộc nghiệp vụ (số tiền &gt; 0, tenant hợp lệ) consumer vẫn phải kiểm tra.</li>
    </ul>

    <p><strong>3. Ký message — khi nào cần?</strong></p>
    <p>ACL của Kafka (bài 07) đã giới hạn <em>ai được ghi</em> vào topic. Nhưng khi message đi qua nhiều chặng (MirrorMaker giữa cluster, Kafka Connect, bridge sang queue khác, lưu ra file rồi nạp lại),
    consumer cuối không còn biết producer gốc. Khi message mang lệnh có giá trị (chuyển tiền, cấp quyền), hãy <strong>ký</strong>:</p>
    <ul>
      <li>HMAC-SHA256 với khoá bí mật chung (đơn giản) hoặc chữ ký bất đối xứng Ed25519 (consumer chỉ cần khoá công khai).</li>
      <li>Ký trên: payload + <code>event_id</code> + thời gian + id khoá (<code>kid</code>), đặt chữ ký trong header.</li>
      <li>Consumer: xác minh chữ ký bằng so sánh thời gian hằng, kiểm tra thời gian trong cửa sổ cho phép, chống phát lại bằng <code>event_id</code>.</li>
    </ul>

    <p><strong>4. Dead-letter queue (DLQ) — xử lý message hỏng mà không dừng cả luồng</strong></p>
    <p>Message không hợp lệ ("poison pill") nếu cứ retry mãi sẽ chặn cả partition. Cách làm: retry có giới hạn → đẩy sang topic/queue DLQ kèm lý do lỗi → tiếp tục message sau → cảnh báo khi DLQ tăng.
    Lưu ý bảo mật: DLQ chứa <em>đúng dữ liệu nhạy cảm như topic gốc</em> → cần ACL, retention và mã hoá tương đương; không đưa nguyên payload vào log/cảnh báo.</p>

    <table>
      <tr><th>Hệ thống</th><th>Validate</th><th>DLQ</th></tr>
      <tr><td>Kafka (client)</td><td>Serializer/deserializer theo Schema Registry + validate nghiệp vụ</td><td>Tự đẩy sang topic <code>*.dlq</code> sau N lần thử</td></tr>
      <tr><td>Kafka Connect</td><td>Converter theo schema</td><td><code>errors.tolerance=all</code> + <code>errors.deadletterqueue.topic.name</code></td></tr>
      <tr><td>Cloudflare Queues</td><td>Validate trong hàm <code>queue()</code> của consumer Worker</td><td><code>max_retries</code> + <code>dead_letter_queue</code> trong wrangler</td></tr>
      <tr><td>SQS / RabbitMQ</td><td>Validate trong consumer</td><td>Redrive policy / dead-letter exchange</td></tr>
    </table>

    <div class="callout"><p>💡 Hỏi mỗi consumer: "Nếu một message sai kiểu, quá lớn, sai tenant, hoặc bị gửi lại lần hai thì chuyện gì xảy ra?" — câu trả lời phải là
    "bị từ chối/bỏ qua an toàn và nằm trong DLQ", không phải "crash" hay "ghi thẳng vào DB".</p></div>
  `,

  codeTabs: [
    { id: "consumer", label: "📥 Consumer phòng thủ", lines: [
      "// Mọi message là input không tin cậy",
      "for msg in consumer.poll():",
      "    if len(msg.value) > 256 * 1024: to_dlq(msg, 'too_large'); continue",
      "    try:",
      "        evt = OrderPaid.parse(deserialize(msg))       // schema + kiểu + khoảng",
      "    except ValidationError as e:",
      "        to_dlq(msg, 'invalid:' + e.code); continue    // KHÔNG log nguyên payload",
      "    require evt.tenant_id == tenant_of_topic(msg.topic)",
      "    if already_processed(evt.event_id): commit(msg); continue   // idempotent",
      "    db.execute('UPDATE invoices SET paid_at = $1 WHERE tenant_id = $2 AND id = $3',",
      "               [evt.paid_at, evt.tenant_id, evt.invoice_id])",
      "    mark_processed(evt.event_id)",
      "    commit(msg)"
    ]},
    { id: "sr", label: "📐 Schema Registry", lines: [
      "// Avro schema cho topic orders.paid (đăng ký qua CI, không tự đăng ký lúc chạy)",
      "{ \"type\": \"record\", \"name\": \"OrderPaid\", \"fields\": [",
      "    { \"name\": \"event_id\",   \"type\": \"string\" },",
      "    { \"name\": \"tenant_id\",  \"type\": \"string\" },",
      "    { \"name\": \"invoice_id\", \"type\": \"long\" },",
      "    { \"name\": \"amount_minor\", \"type\": \"long\" },",
      "    { \"name\": \"paid_at\",    \"type\": { \"type\": \"long\", \"logicalType\": \"timestamp-millis\" } }",
      "] }",
      "",
      "# producer.properties (prod)",
      "auto.register.schemas=false",
      "use.latest.version=true",
      "",
      "# Chế độ tương thích của subject",
      "curl -u sr-admin:<secret> -X PUT -H 'Content-Type: application/vnd.schemaregistry.v1+json' \\",
      "  --data '{\"compatibility\": \"BACKWARD\"}' https://schema-registry.internal/config/orders.paid-value"
    ]},
    { id: "sign", label: "✍️ Ký message", lines: [
      "// Producer: ký payload + metadata, đặt vào header",
      "headers = { 'event-id': evt.id, 'ts': now_ms(), 'kid': 'k-2026-09' }",
      "sig = hmac_sha256(keys['k-2026-09'], headers['event-id'] + '.' + headers['ts'] + '.' + payload)",
      "produce(topic, payload, headers + { 'sig': base64(sig) })",
      "",
      "// Consumer: xác minh trước khi làm bất cứ điều gì",
      "key = keys.get(msg.headers['kid']) or reject",
      "expected = hmac_sha256(key, msg.headers['event-id'] + '.' + msg.headers['ts'] + '.' + msg.value)",
      "if not constant_time_equal(expected, b64decode(msg.headers['sig'])): to_dlq(msg, 'bad_sig')",
      "if abs(now_ms() - msg.headers['ts']) > 10 * 60 * 1000: to_dlq(msg, 'stale')",
      "if seen(msg.headers['event-id']): skip                          // chống phát lại",
      "",
      "// Cần nhiều consumer độc lập? Dùng Ed25519: producer giữ private key,",
      "// consumer chỉ cần public key -> consumer không giả mạo được message"
    ]},
    { id: "dlq", label: "🪦 Dead-letter queue", lines: [
      "# Kafka Connect sink",
      "errors.tolerance=all",
      "errors.retry.timeout=300000",
      "errors.deadletterqueue.topic.name=orders.paid.dlq",
      "errors.deadletterqueue.context.headers.enable=true",
      "",
      "# Cloudflare Queues — wrangler.toml",
      "[[queues.consumers]]",
      "queue = \"orders-paid\"",
      "max_retries = 3",
      "dead_letter_queue = \"orders-paid-dlq\"",
      "",
      "// Consumer Worker",
      "export default { async queue(batch, env) {",
      "  for (const m of batch.messages) {",
      "    const r = OrderPaid.safeParse(m.body)",
      "    if (!r.success) { m.ack(); await env.BAD.send({ reason: 'invalid', id: m.id }); continue }",
      "    try { await handle(r.data, env); m.ack() } catch { m.retry() }  // quá max_retries -> DLQ",
      "  }",
      "} }"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="prod"><div class="nl">📤 Producer</div><div class="ns">serializer theo schema · ký</div></div>
      <div class="node" id="sreg"><div class="nl">📐 Schema Registry</div><div class="ns">có auth · đăng ký qua CI</div></div>
    </div>
    <div class="arrow" id="a1">↓ ACL: chỉ producer được Write</div>
    <div class="node" id="topic"><div class="nl">📨 Topic / Queue</div><div class="ns">orders.paid</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="cons"><div class="nl">📥 Consumer</div><div class="ns">kích thước · schema · chữ ký · tenant · idempotent</div></div>
    <div class="row">
      <div class="node" id="dbw"><div class="nl">🗄️ Ghi DB</div><div class="ns">truy vấn có tham số</div></div>
      <div class="node" id="dlqn"><div class="nl">🪦 DLQ</div><div class="ns">ACL + retention như topic gốc</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Consumer coi message là không tin cậy", tab: "consumer", highlight: [3, 5, 6, 7], on: ["topic", "a2", "cons"],
      desc: "Kiểm tra kích thước, parse theo schema. Lỗi → DLQ với mã lỗi ngắn, không log nguyên payload (có thể chứa PII)." },
    { title: "2 · Kiểm tra quyền trong message + idempotent", tab: "consumer", highlight: [8, 9, 10, 11, 12], on: ["cons", "dbw"],
      desc: "<code>tenant_id</code> phải khớp nguồn. <code>event_id</code> chống xử lý hai lần. Ghi DB vẫn dùng tham số." },
    { title: "3 · Schema là hợp đồng", tab: "sr", highlight: [2, 3, 4, 5, 6, 7], on: ["sreg", "prod"],
      desc: "Avro/Protobuf/JSON Schema định nghĩa kiểu chính xác cho từng field. Consumer và producer cùng tuân theo." },
    { title: "4 · Không tự đăng ký schema ở prod", tab: "sr", highlight: [11, 12, 15, 16], on: ["sreg"],
      desc: "<code>auto.register.schemas=false</code>: schema mới đi qua review/CI. Registry có xác thực; chế độ <code>BACKWARD</code> bảo vệ consumer cũ." },
    { title: "5 · Ký message có giá trị", tab: "sign", highlight: [2, 3, 4, 7, 8, 9, 10, 11], on: ["prod", "cons"],
      desc: "Chữ ký giữ được tính toàn vẹn qua nhiều chặng. Kiểm tra kid, so sánh thời gian hằng, cửa sổ thời gian và chống phát lại." },
    { title: "6 · DLQ cho poison pill", tab: "dlq", highlight: [2, 4, 8, 9, 10, 11, 17, 18], on: ["cons", "dlqn"],
      desc: "Retry có giới hạn rồi chuyển DLQ để không chặn luồng. DLQ chứa dữ liệu nhạy cảm như topic gốc → ACL, retention, mã hoá tương đương." }
  ],

  quiz: [
    { q: "Consumer nhận message từ topic nội bộ. Nên đối xử với message thế nào?", options: [
        "Tin tưởng hoàn toàn vì là hệ thống nội bộ",
        "Log toàn bộ payload rồi xử lý",
        "Chỉ kiểm tra khi message lớn",
        "Như input không tin cậy: validate schema/giá trị, giới hạn kích thước, kiểm tra tenant, ghi DB bằng tham số"
      ], correct: 3,
      explanation: "Producer có thể lỗi hoặc bị chiếm; dữ liệu người dùng có thể được chuyển tiếp nguyên vẹn." },
    { q: "Vì sao không nên dùng Java native serialization/pickle cho message?", options: [
        "Vì chậm",
        "Vì không nén được",
        "Deserialize dữ liệu không tin cậy bằng cơ chế tạo object của ngôn ngữ có thể dẫn tới chạy mã tuỳ ý",
        "Vì Kafka không hỗ trợ"
      ], correct: 2,
      explanation: "Dùng định dạng dữ liệu thuần (JSON/Avro/Protobuf) và không để message tự chọn class." },
    { q: "'auto.register.schemas=false' ở producer prod có tác dụng gì?", options: [
        "Producer không tự đăng ký schema mới; schema phải được đăng ký qua quy trình review/CI",
        "Tắt Schema Registry",
        "Tắt nén",
        "Bật TLS"
      ], correct: 0,
      explanation: "Ngăn một producer lỗi/bị chiếm tự thay đổi 'hợp đồng' của topic." },
    { q: "Schema Registry bảo đảm điều gì và KHÔNG bảo đảm điều gì?", options: [
        "Bảo đảm mọi ràng buộc nghiệp vụ",
        "Bảo đảm message đã được ký",
        "Không bảo đảm gì",
        "Bảo đảm hình dạng/kiểu của message; không bảo đảm ràng buộc nghiệp vụ như số tiền > 0 hay tenant hợp lệ"
      ], correct: 3,
      explanation: "Consumer vẫn phải kiểm tra nghiệp vụ và quyền." },
    { q: "Khi nào nên ký message dù Kafka đã có ACL?", options: [
        "Không bao giờ",
        "Khi message đi qua nhiều chặng (mirror, connect, bridge) và mang lệnh có giá trị, để consumer cuối xác minh được nguồn gốc và toàn vẹn",
        "Chỉ khi topic có ít partition",
        "Chỉ khi dùng JSON"
      ], correct: 1,
      explanation: "ACL bảo vệ một chặng; chữ ký bảo vệ end-to-end." },
    { q: "Consumer xác minh chữ ký HMAC nên làm thêm những gì?", options: [
        "So sánh thời gian hằng, kiểm tra thời gian trong cửa sổ cho phép, chống phát lại bằng event_id",
        "So sánh bằng ==",
        "Bỏ qua nếu header thiếu",
        "Chỉ log chữ ký"
      ], correct: 0,
      explanation: "Thiếu kiểm tra thời gian/event_id, message hợp lệ cũ có thể bị gửi lại." },
    { q: "Mục đích của dead-letter queue?", options: [
        "Xoá message lỗi vĩnh viễn",
        "Tăng tốc producer",
        "Tách message không xử lý được sau số lần thử giới hạn, để luồng chính tiếp tục và có thể điều tra sau",
        "Mã hoá message"
      ], correct: 2,
      explanation: "Poison pill retry mãi sẽ chặn cả partition." },
    { q: "DLQ cần được bảo vệ thế nào?", options: [
        "Không cần vì chỉ chứa message lỗi",
        "Như topic gốc: ACL, retention, mã hoá — vì chứa cùng loại dữ liệu nhạy cảm",
        "Mở cho mọi người để dễ debug",
        "Chỉ cần đổi tên khó đoán"
      ], correct: 1,
      explanation: "Message lỗi vẫn chứa PII/dữ liệu nghiệp vụ." },
    { q: "Consumer idempotent giải quyết vấn đề gì?", options: [
        "Chặn producer lạ",
        "Mã hoá message",
        "Giảm kích thước message",
        "Message bị giao lại (at-least-once) không gây xử lý hai lần, ví dụ trừ tiền hai lần"
      ], correct: 3,
      explanation: "Lưu event_id đã xử lý; gặp lại thì bỏ qua." }
  ]
});
