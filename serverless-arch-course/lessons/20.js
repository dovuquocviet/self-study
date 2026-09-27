window.LESSONS.push({
  id: "20",
  phase: "6", phaseName: "Pattern & tổng kết",
  title: "Tổng kết: kiến trúc tham chiếu và bảng chọn nhanh",
  subtitle: "Ráp mọi khối vào hệ thống thật của công ty · checklist review thiết kế · ôn tập",

  theory: `
    <p><strong>Kiến trúc tham chiếu</strong> cho hệ hiện tại (mobile + service Rust/Java + Postgres/Mongo/Kafka/ClickHouse) khi đưa phần biên và service nhỏ lên Cloudflare:</p>
    <ol>
      <li><strong>Worker gateway/BFF</strong>: xác thực JWT, rate limit, định tuyến, gộp lời gọi cho app. Nói với service nội bộ qua Tunnel + Access (bài 15).</li>
      <li><strong>Service nhỏ trên Workers</strong> gọi nhau bằng service binding RPC (bài 14), dữ liệu riêng mỗi service: D1 hoặc DO SQLite (bài 3, 11).</li>
      <li><strong>State cần phối hợp</strong> (giỏ hàng, ghế, phòng chat, quota) → Durable Object theo thực thể (bài 2–6).</li>
      <li><strong>Việc nền</strong> → Queues với consumer idempotent + DLQ (bài 7–8). <strong>Quy trình dài/saga</strong> → Workflows (bài 9, 19).</li>
      <li><strong>File</strong> → R2 + presigned URL + event notification (bài 12). <strong>Postgres sẵn có</strong> → Hyperdrive (bài 13).</li>
      <li><strong>Phân tích</strong>: sự kiện từ Worker/DO → Queues → service cầu nối → Kafka → ClickHouse (giữ nguyên xương sống hiện có).</li>
      <li><strong>Vận hành</strong>: log JSON + requestId xuyên chặng, Tail Worker đẩy về hệ log, ước tính chi phí trước khi build (bài 16–18).</li>
    </ol>

    <p><strong>Bảng chọn nhanh "state này sống ở đâu?"</strong></p>
    <table>
      <tr><th>Câu hỏi</th><th>Chọn</th></tr>
      <tr><td>Cần một nơi quyết định tuần tự, nhất quán mạnh, theo thực thể?</td><td>Durable Object</td></tr>
      <tr><td>Dữ liệu quan hệ cỡ vừa, query SQL linh hoạt?</td><td>D1 (+ Sessions API nếu bật replica)</td></tr>
      <tr><td>Đọc cực nhiều toàn cầu, ghi ít, chấp nhận trễ ~60 s?</td><td>KV</td></tr>
      <tr><td>File/blob, payload lớn?</td><td>R2</td></tr>
      <tr><td>Dữ liệu đã nằm trong Postgres, service khác cũng dùng?</td><td>Hyperdrive</td></tr>
      <tr><td>Việc làm sau, có thể lặp lại?</td><td>Queues</td></tr>
      <tr><td>Chuỗi bước có chờ, cần bù trừ?</td><td>Workflows</td></tr>
    </table>

    <p><strong>Checklist review thiết kế</strong></p>
    <ul>
      <li>Có biến global nào đang được dùng như nguồn sự thật không?</li>
      <li>Mỗi chỗ ghi: ai là người ghi duy nhất? Đọc sau ghi có cần thấy ngay không?</li>
      <li>Mỗi consumer/step/alarm: chạy 2 lần có sao không? Khoá idempotency là gì?</li>
      <li>Có <code>await</code> ra ngoài giữa đọc và ghi trong DO không?</li>
      <li>Object nào có thể thành điểm nóng? Kế hoạch sharding?</li>
      <li>Đếm round-trip tuần tự tới backend xa trong đường nóng.</li>
      <li>DLQ, cảnh báo, requestId, source map đã có chưa?</li>
      <li>Ước tính hoá đơn tháng với traffic thật; có việc nào nên để ở service Rust không?</li>
    </ul>

    <div class="callout"><p>💡 Nếu chỉ nhớ một câu: <strong>serverless không bỏ đi bài toán phân tán, nó bắt bạn đối mặt sớm hơn</strong>.
    Ranh giới nhất quán (tên object), idempotency, và "ghi ý định trước — thực thi sau" là ba công cụ tư duy dùng được ở mọi nền tảng.</p></div>
  `,

  codeTabs: [
    { id: "arch", label: "① Sơ đồ cấu hình", lines: [
      "// gateway/wrangler.jsonc",
      "{",
      "  \"name\": \"edge-gateway\",",
      "  \"services\": [",
      "    { \"binding\": \"CART\", \"service\": \"cart-svc\", \"entrypoint\": \"CartApi\" },",
      "    { \"binding\": \"MEDIA\", \"service\": \"media-svc\" }",
      "  ],",
      "  \"ratelimits\": [{ \"name\": \"LIMITER\", \"namespace_id\": \"1001\", \"simple\": { \"limit\": 300, \"period\": 60 } }],",
      "  \"observability\": { \"enabled\": true },",
      "  \"tail_consumers\": [{ \"service\": \"log-shipper\" }]",
      "}",
      "",
      "// cart-svc: DO Cart (SQLite) + Queue 'order-events' + Workflow 'order-flow'",
      "// media-svc: R2 'media' + presign + notification → Queue 'media-events'",
      "// catalog đọc Postgres qua Hyperdrive; orders lõi vẫn là service Rust sau Tunnel"
    ]},
    { id: "flow", label: "② Luồng đặt hàng", lines: [
      "1. App  → edge-gateway            : verify JWT, rate limit",
      "2. gateway → CART.checkout(user)  : RPC service binding",
      "3. Cart DO: transactionSync(đơn + outbox)   ; alarm relay → Queue",
      "4. Queue 'order-events' → consumer          : tạo instance Workflow id=order-<id>",
      "5. Workflow: reserve → charge → waitForEvent('shipped') → sleep 7d → review",
      "6. Lỗi → bù trừ (refund, release) trong step",
      "7. Consumer cầu nối → service Rust → Kafka → ClickHouse (phân tích)"
    ]},
    { id: "review", label: "③ Checklist dạng code review", lines: [
      "[ ] Không dùng global làm nguồn sự thật",
      "[ ] Mỗi state có một người ghi; mức nhất quán đọc được ghi rõ",
      "[ ] Consumer/step/alarm idempotent, có khoá nghiệp vụ",
      "[ ] Không await ra ngoài giữa đọc và ghi trong DO",
      "[ ] Kế hoạch sharding cho object nóng",
      "[ ] Round-trip tuần tự trong đường nóng ≤ 2",
      "[ ] DLQ + cảnh báo + requestId + source map",
      "[ ] Ước tính chi phí tháng; việc CPU nặng ở ngoài Workers"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App mobile</div><div class="ns">React Native → native</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="gw"><div class="nl">🌩️ Edge gateway</div><div class="ns">JWT · rate limit · BFF</div></div>
    <div class="row">
      <div class="node" id="do"><div class="nl">🧱 DO</div><div class="ns">cart, room, quota</div></div>
      <div class="node" id="async"><div class="nl">📬 Queues + 🔁 Workflows</div><div class="ns">việc nền, saga</div></div>
      <div class="node" id="data"><div class="nl">🗄️ D1 · R2 · KV · Hyperdrive</div><div class="ns">theo mô hình nhất quán</div></div>
    </div>
    <div class="arrow" id="a2">↓ Tunnel + Access / cầu nối Kafka</div>
    <div class="node" id="core"><div class="nl">🦀 Service Rust/Java · Postgres · Kafka → ClickHouse</div><div class="ns">lõi giữ nguyên</div></div>
  `,
  steps: [
    { title: "1 · Biên", tab: "arch", highlight: [3, 8, 9], on: ["app", "a1", "gw"],
      desc: "Gateway gom auth, rate limit, quan sát. Mọi request đi qua một chỗ." },
    { title: "2 · Service nhỏ & state", tab: "flow", highlight: [2, 3], on: ["do"],
      desc: "RPC tới cart-svc; DO giữ giỏ hàng và outbox nguyên tử." },
    { title: "3 · Bất đồng bộ", tab: "flow", highlight: [4, 5, 6], on: ["async"],
      desc: "Queue kích hoạt Workflow; saga có bù trừ, chờ sự kiện giao hàng." },
    { title: "4 · Dữ liệu", tab: "arch", highlight: [13, 14, 15], on: ["data"],
      desc: "Mỗi loại dữ liệu vào đúng nơi theo mô hình nhất quán." },
    { title: "5 · Lõi hiện có", tab: "flow", highlight: [7], on: ["a2", "core"],
      desc: "Kafka/ClickHouse và service Rust vẫn là xương sống; Cloudflare là lớp biên và service nhỏ." },
    { title: "6 · Review", tab: "review", highlight: [1, 2, 3, 4, 5, 6, 7, 8], on: ["gw", "do", "async", "data"],
      desc: "Dùng checklist này cho mọi thiết kế serverless mới." }
  ],

  quiz: [
    { q: "Bộ đếm lượt xem dùng biến global trong Worker cho kết quả sai vì?", options: [
        "Worker không hỗ trợ số nguyên",
        "Mỗi isolate/PoP có bản riêng và isolate có thể bị huỷ bất kỳ lúc nào",
        "Global bị mã hoá",
        "Vì CPU limit"
      ], correct: 1, explanation: "Bài 01." },
    { q: "Hai request tranh nhau giữ một ghế. Khối nào đảm bảo chỉ một người thắng?", options: [
        "KV", "Durable Object theo tên ghế", "Cache API", "R2"
      ], correct: 1, explanation: "Nhất quán mạnh, tuần tự trong một object." },
    { q: "Trong DO, chỗ nào có thể bị request khác chen ngang?", options: [
        "Giữa hai lệnh sql.exec đồng bộ",
        "Khi await fetch() ra ngoài",
        "Trong transactionSync",
        "Không bao giờ"
      ], correct: 1, explanation: "fetch ngoài mở input gate." },
    { q: "Phòng chat giữ WebSocket hàng giờ mà ít message. API nào giúp tiết kiệm chi phí?", options: [
        "ws.accept()", "ctx.acceptWebSocket() (Hibernation)", "setInterval ping", "KV"
      ], correct: 1, explanation: "Object được ngủ khi rảnh." },
    { q: "Consumer Queue ném lỗi giữa batch mà chưa ack gì. Hậu quả?", options: [
        "Chỉ message lỗi retry",
        "Cả batch retry → các message đã xử lý bị làm lại",
        "Batch bị xoá",
        "Queue dừng hẳn"
      ], correct: 1, explanation: "Ack từng message + idempotent." },
    { q: "Message vượt max_retries, không có DLQ?", options: [
        "Giữ mãi", "Bị xoá vĩnh viễn", "Quay lại đầu queue", "Chuyển sang KV"
      ], correct: 1, explanation: "Luôn cấu hình DLQ cho luồng quan trọng." },
    { q: "Trong Workflows, vì sao không gọi Date.now() ngoài step?", options: [
        "Bị cấm",
        "run() được replay; giá trị không tất định sẽ khác nhau giữa các lần",
        "Tốn CPU",
        "Sai múi giờ"
      ], correct: 1, explanation: "Sinh trong step để được lưu." },
    { q: "Feature flag đổi ở Frankfurt, user Sài Gòn vẫn thấy giá trị cũ 40 giây. Đây là?", options: [
        "Bug nghiêm trọng", "Hành vi nhất quán cuối cùng bình thường của KV", "Lỗi DNS", "Lỗi DO"
      ], correct: 1, explanation: "Tới ~60 s hoặc theo cacheTtl." },
    { q: "Ghi D1 xong, request sau đọc qua replica không thấy dữ liệu. Sửa thế nào?", options: [
        "Tắt D1",
        "Dùng Sessions API và truyền bookmark giữa các request",
        "Dùng KV",
        "Sleep 1 giây"
      ], correct: 1, explanation: "withSession(bookmark) đảm bảo read-your-writes." },
    { q: "Mobile upload video lớn: thiết kế đúng?", options: [
        "POST qua Worker rồi put vào R2",
        "Worker ký presigned PUT URL, app upload thẳng R2, event notification → Queue",
        "Lưu vào KV",
        "Lưu vào D1 BLOB"
      ], correct: 1, explanation: "Bytes không qua Worker." },
    { q: "Worker cần đọc Postgres sẵn có ở Frankfurt. Nên dùng?", options: [
        "Mở kết nối thẳng mỗi request",
        "Hyperdrive (pool + cache), client tạo mỗi request",
        "Copy DB sang KV",
        "Không thể"
      ], correct: 1, explanation: "Bài 13." },
    { q: "Worker orders gọi Worker auth nội bộ, không muốn auth có URL công khai?", options: [
        "Gọi qua Internet với API key",
        "Service binding RPC + workers_dev: false",
        "Qua Queues",
        "Qua KV"
      ], correct: 1, explanation: "Binding chính là quyền." },
    { q: "Origin Rust nhận header X-User-Id từ gateway. Điều kiện để tin header?", options: [
        "Luôn tin",
        "Xác thực request đến từ gateway (Access JWT/mTLS/chữ ký) trước",
        "Kiểm tra User-Agent",
        "Kiểm tra IP client"
      ], correct: 1, explanation: "Bài 15." },
    { q: "Ghi đơn hàng và gửi sự kiện mà không mất sự kiện khi crash?", options: [
        "Ghi DB rồi send Queue",
        "Outbox: đơn + sự kiện cùng transaction, relay gửi sau (at-least-once)",
        "Send Queue rồi ghi DB",
        "2PC"
      ], correct: 1, explanation: "Bài 19." },
    { q: "Encode video 20 phút CPU/file nên chạy ở đâu?", options: [
        "Worker", "Durable Object", "Containers hoặc service Rust; Worker chỉ điều phối", "Workflows step"
      ], correct: 2, explanation: "Trần CPU 5 phút, RAM 128 MB." },
    { q: "Một counter bị nghẽn vì mọi request dồn vào một object. Cách xử lý?", options: [
        "Tăng RAM", "Sharding ra nhiều object, đọc thì cộng", "Chuyển sang KV", "Dùng global"
      ], correct: 1, explanation: "Scale DO bằng số lượng object." }
  ]
});
