window.LESSONS.push({
  id: "20",
  phase: "4", phaseName: "Phân tán",
  title: "CAP, PACELC & mô hình nhất quán — dùng cho thực tế",
  subtitle: "Khi mạng đứt: chọn nhất quán hay sẵn sàng · khi bình thường: chọn độ trễ hay nhất quán · eventual consistency giữa các service",

  theory: `
    <p>CAP hay bị hiểu thành "chọn 2 trong 3". Cách hiểu đúng và dùng được: <strong>network partition là chuyện sẽ xảy ra</strong>; khi nó xảy ra, một hệ thống có nhiều bản sao phải chọn:</p>
    <ul>
      <li><strong>C</strong> (Consistency — ở đây nghĩa là <em>linearizable</em>: mọi đọc thấy ghi mới nhất như thể chỉ có một bản) → phía thiểu số từ chối phục vụ.</li>
      <li><strong>A</strong> (Availability — mọi node còn sống đều trả lời) → hai phía đều phục vụ, chấp nhận dữ liệu lệch nhau rồi hoà giải sau.</li>
    </ul>
    <p>Chữ C của CAP <em>khác</em> chữ C của ACID (ràng buộc dữ liệu). Và CAP chỉ nói về lúc mạng đứt — phần lớn thời gian mạng vẫn ổn.</p>

    <p><strong>PACELC</strong> bổ sung phần còn lại: <strong>if P</strong> then A or C, <strong>else</strong> (bình thường) <strong>L</strong>atency or <strong>C</strong>onsistency.
    Ngay cả khi không có sự cố, chờ replica xác nhận (nhất quán hơn) luôn tốn thêm độ trễ. Đây mới là đánh đổi bạn gặp hằng ngày.</p>

    <p><strong>Các DB của công ty đứng đâu</strong> — tuỳ cấu hình, không phải bản chất cố định:</p>
    <table>
      <tr><th>DB</th><th>Cấu hình thiên về C</th><th>Cấu hình thiên về A / L</th></tr>
      <tr><td>PostgreSQL</td><td>Đọc/ghi primary, replica đồng bộ</td><td>Replica bất đồng bộ, đọc từ replica</td></tr>
      <tr><td>MongoDB</td><td><code>w: majority</code> + readConcern <code>majority</code>/<code>linearizable</code>, đọc primary</td><td><code>w: 1</code>, đọc secondary</td></tr>
      <tr><td>Kafka</td><td><code>acks=all</code>, <code>min.insync.replicas=2</code>, <code>unclean.leader.election.enable=false</code> → thiếu ISR thì từ chối ghi</td><td><code>acks=1</code>, cho phép unclean election → có thể mất dữ liệu</td></tr>
      <tr><td>Redis</td><td><code>WAIT</code> giảm rủi ro nhưng không đảm bảo</td><td>Mặc định: replica bất đồng bộ, failover có thể mất ghi</td></tr>
      <tr><td>Elasticsearch</td><td>—</td><td>Near-real-time: search thấy dữ liệu sau refresh</td></tr>
    </table>

    <p><strong>Thang nhất quán</strong> (mạnh → yếu): <em>linearizable</em> → <em>sequential</em> → <em>causal</em> (thấy nguyên nhân trước kết quả) →
    các bảo đảm theo phiên: <em>read-your-writes</em>, <em>monotonic reads</em> (không "quay ngược thời gian") → <em>eventual</em> (không ghi thêm thì cuối cùng các bản sẽ giống nhau).
    Nhiều bài toán chỉ cần bảo đảm theo phiên, rẻ hơn linearizable rất nhiều.</p>

    <p><strong>Giữa các service: luôn là eventual</strong>. Mỗi service một DB → không có transaction chung. Đơn hàng ở PostgreSQL, sự kiện qua Kafka, ClickHouse và ES cập nhật sau vài giây.
    Công cụ của kỹ sư:</p>
    <ul>
      <li><strong>Outbox</strong> (bài 08) để ghi DB và phát sự kiện không lệch nhau.</li>
      <li><strong>Consumer idempotent</strong> (upsert theo id, bảng processed_event_id) vì Kafka giao at-least-once.</li>
      <li><strong>Saga</strong>: chuỗi bước cục bộ + bước bù (hoàn tiền, trả kho) thay cho transaction phân tán 2PC.</li>
      <li><strong>Thiết kế UI chấp nhận trễ</strong>: "Đơn đang được xử lý", thay vì giả định báo cáo cập nhật ngay.</li>
    </ul>

    <div class="callout"><p>💡 Câu hỏi thực dụng thay cho "hệ này CP hay AP": <em>(1) khi một node/mạng hỏng, request bị lỗi hay nhận dữ liệu cũ? (2) bình thường, ghi chờ bao nhiêu bản sao?
    (3) đọc từ đâu và có thể cũ bao lâu? (4) nếu mất vài giây ghi cuối thì nghiệp vụ có chấp nhận được không?</em></p></div>
  `,

  codeTabs: [
    { id: "partition", label: "Khi mạng đứt", lines: [
      "Replica set 3 node: A (primary), B, C.   Mạng tách: {A} | {B, C}",
      "",
      "Phía {A} (thiểu số):",
      "  C-choice: A tự bước xuống secondary, từ chối ghi w:majority   → lỗi, nhưng không lệch",
      "  A-choice: A vẫn nhận ghi                                       → lệch, hoà giải/rollback sau",
      "",
      "Phía {B, C} (đa số):",
      "  bầu B thành primary mới (term tăng), tiếp tục phục vụ",
      "",
      "Mạng nối lại: ghi của A chưa tới đa số bị rollback (MongoDB lưu vào thư mục rollback)"
    ]},
    { id: "pacelc", label: "Bình thường: L vs C", lines: [
      "-- PostgreSQL, ghi quan trọng: chờ 1 standby (thêm ~1 RTT)",
      "SET synchronous_commit = remote_apply;   -- replica đã áp dụng → đọc replica thấy ngay",
      "",
      "-- ghi log hành vi: chấp nhận rủi ro để nhanh",
      "SET synchronous_commit = local;",
      "",
      "// MongoDB: chọn theo từng thao tác",
      "db.payments.insertOne(p, { writeConcern: { w: 'majority' } })   // chờ đa số",
      "db.clicks.insertOne(c,   { writeConcern: { w: 1 } })            // chỉ primary"
    ]},
    { id: "kafka", label: "Kafka chọn C", lines: [
      "# topic thanh toán: thà từ chối ghi còn hơn mất",
      "replication.factor=3",
      "min.insync.replicas=2",
      "unclean.leader.election.enable=false   # mặc định: replica ngoài ISR không được lên leader",
      "",
      "# producer",
      "acks=all",
      "",
      "# 2 broker chết → ISR = 1 < 2 → NotEnoughReplicasException: mất A, giữ C"
    ]},
    { id: "idem", label: "Eventual giữa service", lines: [
      "@KafkaListener(topics = \"orders\", groupId = \"loyalty\")",
      "@Transactional",
      "public void on(OrderPaid e) {",
      "    // at-least-once → có thể nhận lại cùng sự kiện",
      "    if (!processed.insertIfAbsent(e.eventId())) return;    // bảng processed_events, UNIQUE",
      "    points.add(e.userId(), e.total() / 1000);",
      "}",
      "",
      "// Saga: OrderCreated → ReserveStock → ChargePayment",
      "//        thanh toán lỗi → ReleaseStock (bước bù) → OrderCancelled"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">🔌 Mạng đứt (P)?</div><div class="ns">xảy ra hay không</div></div>
    <div class="row">
      <div class="node" id="yes"><div class="nl">Có → A hay C</div><div class="ns">phục vụ dữ liệu có thể lệch, hay từ chối</div></div>
      <div class="node" id="no"><div class="nl">Không (Else) → L hay C</div><div class="ns">trả nhanh, hay chờ bản sao</div></div>
    </div>
    <div class="arrow" id="a1">↓ giữa các service</div>
    <div class="node" id="ev"><div class="nl">🌊 Eventual consistency</div><div class="ns">outbox · idempotent · saga</div></div>
  `,
  steps: [
    { title: "1 · Khi mạng đứt phải chọn", tab: "partition", highlight: [1, 3, 4, 5], on: ["p", "yes"],
      desc: "Phía thiểu số: từ chối (C) hoặc tiếp tục và lệch (A)." },
    { title: "2 · Đa số tiếp tục phục vụ", tab: "partition", highlight: [7, 8, 10], on: ["yes"],
      desc: "Bầu leader theo đa số; ghi chưa tới đa số của leader cũ bị rollback khi nối lại." },
    { title: "3 · Bình thường: độ trễ vs nhất quán", tab: "pacelc", highlight: [2, 5, 8, 9], on: ["no"],
      desc: "PACELC: chờ replica luôn tốn thêm độ trễ. Chọn theo từng loại dữ liệu." },
    { title: "4 · Kafka cấu hình thiên C", tab: "kafka", highlight: [3, 4, 7, 9], on: ["yes"],
      desc: "Thiếu ISR thì từ chối ghi thay vì mạo hiểm mất dữ liệu." },
    { title: "5 · Giữa service: eventual", tab: "idem", highlight: [4, 5, 6, 9, 10], on: ["a1", "ev"],
      desc: "Consumer idempotent + saga với bước bù thay cho transaction phân tán." }
  ],

  quiz: [
    { q: "CAP thực sự nói gì?", options: [
        "Luôn chọn được 2 trong 3 tính chất tuỳ ý",
        "Khi có network partition, hệ nhiều bản sao phải chọn giữa nhất quán (linearizable) và sẵn sàng",
        "Hệ phân tán không thể nhất quán",
        "Chỉ áp dụng cho SQL"
      ], correct: 1, explanation: "P không phải thứ bạn 'chọn bỏ' được." },
    { q: "Chữ C trong CAP có giống chữ C trong ACID?", options: [
        "Giống hệt",
        "Không — CAP C là linearizability, ACID C là dữ liệu thoả ràng buộc",
        "Cả hai đều là cache",
        "Cả hai là concurrency"
      ], correct: 1, explanation: "Trùng chữ cái, khác khái niệm." },
    { q: "Phần 'ELC' của PACELC nói gì?", options: [
        "Else: khi không có partition, vẫn phải đánh đổi giữa độ trễ và nhất quán",
        "Error, Log, Commit",
        "Eventual, Linear, Causal",
        "Không có ý nghĩa"
      ], correct: 0, explanation: "Chờ bản sao xác nhận luôn tốn thêm thời gian." },
    { q: "Kafka với acks=all, min.insync.replicas=2, RF=3 khi 2 broker chết sẽ?", options: [
        "Vẫn nhận ghi bình thường",
        "Từ chối ghi (NotEnoughReplicas) — ưu tiên không mất dữ liệu",
        "Tự tạo broker mới",
        "Xoá topic"
      ], correct: 1, explanation: "Đổi availability lấy độ bền/nhất quán." },
    { q: "Read-your-writes là bảo đảm gì?", options: [
        "Mọi người thấy mọi ghi ngay",
        "Một phiên luôn thấy các ghi của chính nó",
        "Không bao giờ đọc được",
        "Đọc từ cache"
      ], correct: 1, explanation: "Yếu hơn linearizable nhưng đủ cho nhiều UI." },
    { q: "Giữa các microservice mỗi service một DB, tính nhất quán thường là?", options: [
        "Linearizable nhờ 2PC mặc định",
        "Eventual — dùng outbox, consumer idempotent, saga",
        "Không có nhất quán gì",
        "Serializable"
      ], correct: 1, explanation: "Không có transaction chung giữa các DB." },
    { q: "Saga xử lý lỗi ở bước giữa thế nào?", options: [
        "Rollback toàn cục bằng 2PC",
        "Chạy các bước bù (compensating action) cho những bước đã hoàn tất",
        "Bỏ qua lỗi",
        "Khởi động lại mọi service"
      ], correct: 1, explanation: "Ví dụ: thanh toán lỗi → trả lại tồn kho đã giữ." },
    { q: "Vì sao consumer Kafka phải idempotent?", options: [
        "Cho nhanh",
        "Giao hàng at-least-once có thể gửi lại cùng sự kiện",
        "Vì Kafka mã hoá",
        "Không cần"
      ], correct: 1, explanation: "Dùng bảng processed_events với UNIQUE hoặc upsert theo id." },
    { q: "MongoDB primary bị cô lập ở phía thiểu số khi mạng tách. Chuyện gì xảy ra?", options: [
        "Tiếp tục là primary mãi mãi",
        "Bước xuống; phía đa số bầu primary mới; ghi chưa tới đa số của primary cũ bị rollback khi nối lại",
        "Xoá dữ liệu",
        "Cả cluster dừng"
      ], correct: 1, explanation: "w:majority tránh được việc ghi bị rollback." },
    { q: "synchronous_commit = remote_apply ở PostgreSQL đảm bảo gì thêm so với on?", options: [
        "Không khác",
        "Chờ standby đồng bộ đã áp dụng thay đổi, nên đọc từ standby đó thấy ngay",
        "Không ghi WAL",
        "Tắt replication"
      ], correct: 1, explanation: "Đổi lại độ trễ ghi tăng." }
  ]
});
