window.LESSONS.push({
  id: "20",
  phase: "6", phaseName: "Tổng kết",
  title: "Tổng kết — kiến trúc mẫu & khi nào KHÔNG nên dùng Workers",
  subtitle: "bản đồ toàn khoá · kiến trúc BFF cho app mobile · checklist trước khi chuyển một service · dấu hiệu nên giữ ở Rust server",

  theory: `
    <p><strong>Bản đồ cơ chế đã học</strong></p>
    <table>
      <tr><th>Cơ chế</th><th>Hệ quả khi thiết kế</th></tr>
      <tr><td>V8 isolate, không phải VM/container</td><td>Cold start vài ms; 128 MB; không thread; global dùng chung và không bền</td></tr>
      <tr><td>Chạy ở edge, gần user</td><td>Nhanh với logic/cached; chậm nếu gọi DB xa nhiều lượt → gộp, Hyperdrive, Smart Placement</td></tr>
      <tr><td>Tính CPU time, không tính chờ I/O</td><td>Rẻ cho service I/O-bound; giới hạn CPU theo gói</td></tr>
      <tr><td>Binding = capability</td><td>Không credential trong code; env riêng từng môi trường</td></tr>
      <tr><td>Mỗi kho một tính chất</td><td>KV (đọc nhiều, cuối cùng) · D1 (SQL, tuần tự/DB) · R2 (file, mạnh) · DO (tuần tự/thực thể) · Queues (at-least-once)</td></tr>
      <tr><td>Request là đơn vị sống</td><td>waitUntil ≤ 30 giây; việc bền → Queue; I/O object không xuyên request</td></tr>
    </table>

    <p><strong>Kiến trúc mẫu cho công ty</strong>: App mobile → <em>Worker BFF</em> (Hono: auth JWT, ghép dữ liệu, cache KV) → service binding tới các Worker nhỏ
    (user, pricing) và <code>fetch</code> tới service Rust chính → Postgres qua Hyperdrive cho Worker cần SQL trực tiếp → Queue cho job nền (email, webhook) →
    log có requestId vào Workers Logs/Elasticsearch. Kafka + ClickHouse giữ nguyên ở phía server.</p>

    <p><strong>Khi nào KHÔNG nên dùng Workers</strong></p>
    <ul>
      <li><strong>Tiến trình chạy dài / kết nối liên tục</strong>: Kafka consumer group, CDC, WebSocket server khổng lồ không qua DO, job batch hàng giờ. CPU tối đa 5 phút/lần gọi (Paid).</li>
      <li><strong>Cần nhiều bộ nhớ</strong>: xử lý dữ liệu lớn trong RAM, cache in-process hàng GB — trần 128 MB/isolate.</li>
      <li><strong>Phụ thuộc thư viện native/JVM/OS</strong>: ffmpeg, thư viện PDF dựa trên JVM, driver chỉ chạy với socket Node đầy đủ, thread.</li>
      <li><strong>Truy vấn "lắm lời" với DB một region</strong> mà không gộp được — edge chỉ thêm đường vòng.</li>
      <li><strong>Tính toán nặng liên tục</strong> (ML inference tự host, encode video) — trả CPU theo ms trở nên đắt, và có giới hạn.</li>
      <li><strong>Yêu cầu tuân thủ/nơi lưu dữ liệu rất chặt</strong> hoặc lo ngại phụ thuộc nhà cung cấp: binding là API riêng của Cloudflare; hãy cô lập chúng sau interface của bạn.</li>
    </ul>
    <p>Cloudflare có thêm <strong>Containers</strong> (chạy image Docker, điều khiển từ Worker/DO) cho phần không vừa isolate — nhưng đó là mô hình khác, cân nhắc riêng.</p>

    <p><strong>Checklist trước khi chuyển một service Java nhỏ sang Worker</strong></p>
    <ol>
      <li>CPU mỗi request &lt; vài chục ms? State nằm ở đâu, chọn kho nào?</li>
      <li>Bao nhiêu lời gọi ra ngoài mỗi request (subrequest, latency tới DB)?</li>
      <li>Thư viện đang dùng có chạy trên workerd không (không eval, không thread, không socket Node thuần)?</li>
      <li>Việc nền nào đang dùng <code>@Async</code>/<code>@Scheduled</code> → Queue/Cron?</li>
      <li>Log, requestId, test trong workerd, rollback — đã có chưa?</li>
    </ol>

    <div class="callout"><p>💡 Câu hỏi của kỹ sư không phải "Workers có tốt không?" mà là "cơ chế của nó (isolate, edge, CPU-billing, binding) có khớp với
    hình dạng của bài toán này không?". Khớp thì Workers rất rẻ và nhanh; không khớp thì giữ ở Rust server.</p></div>
  `,

  codeTabs: [
    { id: "arch", label: "Kiến trúc BFF", lines: [
      "📱 App (React Native -> native)",
      "   |  HTTPS api.shop.vn  (custom domain)",
      "⚡ bff-worker (Hono)",
      "   |- middleware: JWT verify (secret), requestId (cf-ray), cors",
      "   |- KV CONFIG: feature flags / cache trang chủ (chấp nhận cũ ~60 s)",
      "   |- service binding USERS  -> user-worker (D1 riêng)",
      "   |- service binding PRICING -> pricing-worker (Rust/WASM, crate dùng chung)",
      "   |- fetch -> orders-service (Rust trên server) --X-Request-Id-->",
      "   |- Queue EMAILS -> email-consumer (retry + DLQ)",
      "   |- DO CART: giỏ hàng theo user, alarm dọn giỏ",
      "Kafka -> ClickHouse: giữ nguyên phía server"
    ]},
    { id: "cfg", label: "wrangler.jsonc BFF", lines: [
      "{",
      "  \"name\": \"bff-worker\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"routes\": [{ \"pattern\": \"api.shop.vn\", \"custom_domain\": true }],",
      "  \"observability\": { \"enabled\": true, \"head_sampling_rate\": 0.2 },",
      "  \"kv_namespaces\": [{ \"binding\": \"CONFIG\", \"id\": \"<KV_ID>\" }],",
      "  \"services\": [",
      "    { \"binding\": \"USERS\", \"service\": \"user-worker\" },",
      "    { \"binding\": \"PRICING\", \"service\": \"pricing-worker\" }",
      "  ],",
      "  \"queues\": { \"producers\": [{ \"binding\": \"EMAILS\", \"queue\": \"emails\" }] },",
      "  \"durable_objects\": { \"bindings\": [{ \"name\": \"CART\", \"class_name\": \"Cart\" }] },",
      "  \"migrations\": [{ \"tag\": \"v1\", \"new_sqlite_classes\": [\"Cart\"] }]",
      "}"
    ]},
    { id: "no", label: "Giữ ở server khi...", lines: [
      "Kafka consumer group chạy liên tục          -> service Rust (tokio) trên server",
      "Batch/report hàng giờ, RAM vài GB           -> job trên server / container",
      "Thư viện native (ffmpeg), JVM, thread        -> container",
      "10+ query tuần tự tới Postgres một region    -> đặt logic cạnh DB (hoặc gộp query)",
      "Cần thứ tự sự kiện nghiêm ngặt + replay      -> Kafka, không phải Queues"
    ]},
    { id: "map", label: "Spring → Workers (ôn tập)", lines: [
      "main() + Tomcat                -> export default { fetch }",
      "@RestController / Filter       -> Hono app.get / app.use",
      "application-{profile}.yml      -> env.staging / env.production",
      "@Value + Vault                 -> vars + wrangler secret put",
      "JdbcTemplate + HikariCP        -> D1 binding / pg + Hyperdrive",
      "@Async                         -> ctx.waitUntil (không bền) / Queue (bền)",
      "@Scheduled                     -> triggers.crons (UTC)",
      "@RabbitListener                -> queue(batch, env, ctx)",
      "Feign giữa service             -> service binding RPC",
      "synchronized / Redis lock      -> Durable Object",
      "@SpringBootTest                -> @cloudflare/vitest-plugin"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App mobile</div><div class="ns">api.shop.vn</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="bff"><div class="nl">⚡ bff-worker (Hono)</div><div class="ns">auth · ghép · cache</div></div>
    <div class="row">
      <div class="node" id="edge"><div class="nl">🧰 KV · DO · Queue</div><div class="ns">binding tại edge</div></div>
      <div class="node" id="svc"><div class="nl">🔗 user/pricing Worker</div><div class="ns">service binding</div></div>
      <div class="node" id="rust"><div class="nl">🦀 Rust server</div><div class="ns">orders · Kafka · ClickHouse</div></div>
    </div>
    <div class="arrow" id="a2">✋ Không hợp isolate → giữ ở server/container</div>
  `,
  steps: [
    { title: "1 · Toàn cảnh kiến trúc", tab: "arch", highlight: [1, 2, 3, 4], on: ["app", "a1", "bff"],
      desc: "Worker BFF là cửa ngõ cho app: xác thực, gắn requestId, ghép dữ liệu." },
    { title: "2 · Dùng đúng kho", tab: "arch", highlight: [5, 9, 10], on: ["edge"],
      desc: "KV cho cấu hình/cache, Queue cho việc nền cần bền, DO cho state nhất quán theo user." },
    { title: "3 · Tách Worker có lý do", tab: "cfg", highlight: [8, 9, 10], on: ["svc"],
      desc: "user-worker có D1 riêng; pricing-worker bằng Rust dùng chung crate với backend." },
    { title: "4 · Server vẫn có chỗ đứng", tab: "no", highlight: [1, 2, 3, 4, 5], on: ["rust", "a2"],
      desc: "Việc dài, nặng RAM, cần thread/native hoặc cần Kafka thì giữ ở Rust server." },
    { title: "5 · Ôn lại bản đồ Spring → Workers", tab: "map", highlight: [1, 5, 6, 10, 11], on: ["bff", "edge", "svc"],
      desc: "Mỗi thói quen Spring có một tương đương — và một khác biệt cơ chế cần nhớ." }
  ],

  quiz: [
    { q: "Vì sao cold start của Workers chỉ vài ms?", options: [
        "Dùng GraalVM native image",
        "Chạy trong V8 isolate: không boot VM/JVM, chỉ tạo isolate và chạy global scope của code đã cache",
        "Không bao giờ tắt instance",
        "Dùng UDP"
      ], correct: 1, explanation: "Ôn bài 02." },
    { q: "Workers tính phí CPU thế nào?", options: [
        "Theo thời gian thực kể cả chờ I/O",
        "Theo CPU time; thời gian chờ fetch/DB không tính",
        "Theo số dòng code",
        "Theo RAM"
      ], correct: 1, explanation: "Hợp với service I/O-bound." },
    { q: "Dữ liệu nào hợp với KV nhất?", options: [
        "Số dư ví", "Feature flag cho app mobile", "Tồn kho", "Bộ đếm rate limit chính xác"
      ], correct: 1, explanation: "Đọc nhiều, ghi ít, chấp nhận cũ ~60 giây." },
    { q: "Giỏ hàng cần cập nhật nhất quán từ nhiều thiết bị của cùng user. Chọn gì?", options: [
        "KV", "Durable Object theo user", "Cache API", "Biến global"
      ], correct: 1, explanation: "Một instance/ID, xử lý tuần tự, storage riêng." },
    { q: "Gửi email xác nhận đơn hàng (không được mất) nên dùng gì?", options: [
        "ctx.waitUntil", "Queue với retry + DLQ, consumer idempotent", "setTimeout", "Cron mỗi phút đọc KV"
      ], correct: 1, explanation: "waitUntil không có đảm bảo giao." },
    { q: "Worker cần truy vấn Postgres có sẵn của công ty. Cách khuyên dùng?", options: [
        "Mở kết nối pg thẳng tới DB mỗi request",
        "Hyperdrive + tạo client mới mỗi request từ env.HYPERDRIVE.connectionString",
        "Lưu client ở global",
        "Chuyển hết sang KV"
      ], correct: 1, explanation: "Pool gần DB, cache truy vấn đọc." },
    { q: "Worker A gọi Worker B mà không muốn B public. Dùng gì?", options: [
        "Gọi workers.dev URL của B", "Service binding (RPC qua WorkerEntrypoint)", "Queue", "KV"
      ], correct: 1, explanation: "Có binding mới gọi được; gần như không thêm độ trễ." },
    { q: "Trường hợp nào KHÔNG nên đưa lên Workers?", options: [
        "BFF ghép 3 API",
        "Kafka consumer group chạy liên tục đẩy dữ liệu vào ClickHouse",
        "Webhook receiver",
        "Redirect theo quốc gia"
      ], correct: 1, explanation: "Cần tiến trình sống lâu và kết nối liên tục." },
    { q: "Viết lại Worker BFF (CPU 3 ms/request) bằng Rust có đáng không?", options: [
        "Luôn đáng",
        "Thường không — I/O-bound, thêm chi phí WASM↔JS; chỉ đáng khi đo thấy CPU là nút cổ chai hoặc cần dùng chung crate",
        "Bắt buộc vì backend là Rust",
        "Rust không chạy trên Workers"
      ], correct: 1, explanation: "Quyết định dựa trên số liệu." },
    { q: "Binding khai ở top-level có dùng được khi deploy --env production không?", options: [
        "Có, thừa kế",
        "Không — vars và binding không thừa kế, phải khai lại trong env",
        "Chỉ KV thừa kế",
        "Tuỳ compatibility_date"
      ], correct: 1, explanation: "Ôn bài 05." },
    { q: "Cron \"30 1 * * *\" chạy lúc mấy giờ Việt Nam?", options: [
        "01:30", "08:30", "18:30", "Tuỳ data center"
      ], correct: 1, explanation: "UTC 01:30 + 7 giờ = 08:30." },
    { q: "Lưu client pg ở biến global để tái dùng dẫn tới?", options: [
        "Nhanh hơn",
        "Lỗi dùng I/O object của request khác",
        "Tiết kiệm subrequest",
        "Không ảnh hưởng"
      ], correct: 1, explanation: "I/O object gắn với request tạo ra nó." },
    { q: "Công cụ xem log production theo thời gian thực?", options: [
        "wrangler logs --live", "wrangler tail", "kubectl logs", "wrangler dev --remote"
      ], correct: 1, explanation: "Workers Logs dùng để truy vấn log đã lưu." },
    { q: "Test Worker trong đúng runtime production dùng gì?", options: [
        "Jest + Node", "@cloudflare/vitest-plugin (Vitest chạy trong workerd)", "Postman", "JUnit"
      ], correct: 1, explanation: "Storage cô lập theo file test." },
    { q: "Tại sao gọi DB ở Singapore 5 lần tuần tự từ Worker ở Frankfurt lại chậm?", options: [
        "CPU yếu",
        "Mỗi lượt chịu RTT liên lục địa; tổng cộng dồn — cần gộp query hoặc Smart Placement",
        "Hyperdrive chặn",
        "Vượt 128 MB"
      ], correct: 1, explanation: "Edge không xoá được khoảng cách tới DB tập trung." },
    { q: "Giới hạn bộ nhớ và CPU tối đa (Paid) của một lần gọi Worker?", options: [
        "1 GB và không giới hạn",
        "128 MB và tối đa 5 phút CPU (mặc định 30 giây)",
        "512 MB và 10 ms",
        "128 MB và 15 phút cho mọi request HTTP"
      ], correct: 1, explanation: "Vượt khung này là dấu hiệu nên dùng server/container." }
  ]
});
