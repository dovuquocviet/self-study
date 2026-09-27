window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Bất đồng bộ: Queues & Workflows",
  title: "Queues: producer, consumer, batching và ack",
  subtitle: "send/sendBatch · queue(batch) · ack/retry từng message · at-least-once · so với Kafka",

  theory: `
    <p>Cloudflare Queues là hàng đợi message được quản lý hoàn toàn: Worker A <code>send()</code>, Worker B nhận theo <strong>batch</strong> qua handler <code>queue()</code>.
    Dùng khi việc không cần làm ngay trong request: gửi email, gọi webhook, ghi log phân tích, đẩy sang hệ Java/Rust.</p>

    <p><strong>Đừng nghĩ nó là Kafka</strong></p>
    <table>
      <tr><th></th><th>Kafka (công ty đang dùng)</th><th>Cloudflare Queues</th></tr>
      <tr><td>Mô hình</td><td>Log bền, consumer tự giữ offset, đọc lại được</td><td>Hàng đợi: message bị xoá sau khi ack</td></tr>
      <tr><td>Thứ tự</td><td>Đảm bảo trong một partition</td><td><strong>Không đảm bảo</strong> thứ tự</td></tr>
      <tr><td>Nhiều consumer group</td><td>Có</td><td>Mỗi queue <strong>một</strong> consumer (fan-out: gửi vào nhiều queue)</td></tr>
      <tr><td>Giao nhận</td><td>Tuỳ cấu hình commit</td><td><strong>At-least-once</strong></td></tr>
      <tr><td>Vận hành</td><td>Broker, partition, rebalance</td><td>Không có gì để vận hành; tự scale consumer</td></tr>
    </table>

    <p><strong>Giới hạn chính</strong>: message ≤ 128 KB; <code>sendBatch</code> ≤ 100 message và ≤ 256 KB; batch consumer ≤ 100 message, chờ tối đa 60 s;
    ~5.000 message/giây/queue; lưu giữ mặc định 4 ngày, cấu hình tới 14 ngày (Free: 24 giờ); <code>delaySeconds</code> tối đa 24 giờ.</p>

    <p><strong>Batch được giao khi</strong> đủ <code>max_batch_size</code> (mặc định 10) <em>hoặc</em> hết <code>max_batch_timeout</code> (mặc định 5 s), cái nào tới trước.
    Batch lớn = ít lần gọi consumer, rẻ và hiệu quả khi ghi hàng loạt (vd insert ClickHouse/D1); batch nhỏ = độ trễ thấp.</p>

    <p><strong>Ack</strong>: handler chạy xong không lỗi → cả batch coi như thành công. Handler ném lỗi → <em>cả batch</em> bị retry, trừ message đã <code>msg.ack()</code>.
    Vì vậy khi xử lý từng message độc lập, hãy <code>ack()</code>/<code>retry()</code> <strong>từng message</strong> để một message hỏng không kéo 99 message tốt chạy lại.</p>

    <div class="callout"><p>💡 Kafka vẫn là xương sống giữa các service lớn (ClickHouse đang consume). Queues hợp cho việc bất đồng bộ <em>bên trong</em> vùng Cloudflare;
    cần đẩy sang Kafka thì consumer Queues gọi REST Proxy/HTTP ingest của hệ Kafka, hoặc gọi service Java/Rust nhận rồi produce.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "① wrangler.jsonc", lines: [
      "\"queues\": {",
      "  \"producers\": [{ \"binding\": \"EMAIL_Q\", \"queue\": \"email-jobs\" }],",
      "  \"consumers\": [{",
      "    \"queue\": \"email-jobs\",",
      "    \"max_batch_size\": 50,        // mặc định 10, tối đa 100",
      "    \"max_batch_timeout\": 5,      // giây, tối đa 60",
      "    \"max_retries\": 5,            // mặc định 3",
      "    \"dead_letter_queue\": \"email-jobs-dlq\"",
      "  }]",
      "}",
      "",
      "# tạo queue: npx wrangler queues create email-jobs"
    ]},
    { id: "prod", label: "② Producer", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const order = await req.json();",
      "    await env.EMAIL_Q.send({ type: 'order-confirm', orderId: order.id, to: order.email });",
      "    // gửi nhiều:",
      "    await env.EMAIL_Q.sendBatch(order.items.map(i => ({ body: { type: 'stock', sku: i.sku } })));",
      "    // hẹn gửi sau 10 phút:",
      "    await env.EMAIL_Q.send({ type: 'review-ask', orderId: order.id }, { delaySeconds: 600 });",
      "    return new Response('accepted', { status: 202 });",
      "  }",
      "};"
    ]},
    { id: "cons", label: "③ Consumer ack từng message", lines: [
      "export default {",
      "  async queue(batch, env, ctx) {",
      "    for (const msg of batch.messages) {",
      "      try {",
      "        await sendEmail(env, msg.body);",
      "        msg.ack();                                  // xong cái nào chốt cái đó",
      "      } catch (e) {",
      "        console.error({ id: msg.id, attempts: msg.attempts, err: String(e) });",
      "        msg.retry({ delaySeconds: 30 * msg.attempts }); // backoff tự làm",
      "      }",
      "    }",
      "  }",
      "};"
    ]},
    { id: "bad", label: "④ Consumer ném lỗi cả batch", lines: [
      "async queue(batch, env) {",
      "  for (const msg of batch.messages) {",
      "    await sendEmail(env, msg.body);   // message thứ 37 lỗi → throw",
      "  }",
      "}",
      "// → cả batch 50 message bị retry, 36 email đầu bị GỬI LẠI",
      "// → vì vậy consumer phải idempotent, và nên ack từng message"
    ]},
    { id: "java", label: "⑤ Spring Kafka tương đương", lines: [
      "@KafkaListener(topics = \"email-jobs\", batch = \"true\")",
      "public void onBatch(List<ConsumerRecord<String, EmailJob>> records, Acknowledgment ack) {",
      "    records.forEach(r -> emailService.send(r.value()));",
      "    ack.acknowledge();     // commit offset cả batch",
      "}",
      "// Queues: không có offset; ack/retry theo từng message"
    ]}
  ],

  stageHtml: `
    <div class="node" id="api"><div class="nl">⚙️ Worker API</div><div class="ns">send() rồi trả 202 ngay</div></div>
    <div class="arrow" id="a1">↓ message ghi bền xuống đĩa</div>
    <div class="node" id="q"><div class="nl">📬 Queue email-jobs</div><div class="ns">gom batch: 50 msg hoặc 5 s</div></div>
    <div class="arrow" id="a2">↓ queue(batch)</div>
    <div class="node" id="c"><div class="nl">⚙️ Consumer</div><div class="ns">ack / retry từng message</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ ack</div><div class="ns">bị xoá khỏi queue</div></div>
      <div class="node" id="rt"><div class="nl">🔁 retry</div><div class="ns">quay lại sau delaySeconds</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Khai báo producer/consumer", tab: "cfg", highlight: [2, 5, 6, 7, 8], on: ["q"],
      desc: "Một queue chỉ có một consumer Worker. Batch size/timeout quyết định độ trễ và chi phí." },
    { title: "2 · Gửi rồi trả lời ngay", tab: "prod", highlight: [4, 6, 8, 9], on: ["api", "a1"],
      desc: "Khi send() resolve, message đã được ghi bền. Trả 202 Accepted; phần chậm để consumer lo." },
    { title: "3 · Gom batch", tab: "cfg", highlight: [5, 6], on: ["q", "a2"],
      desc: "Đủ 50 message hoặc 5 giây thì giao — cái nào tới trước." },
    { title: "4 · Ack từng message", tab: "cons", highlight: [3, 5, 6, 9], on: ["c", "ok", "rt"],
      desc: "Message tốt được chốt ngay; message lỗi retry với độ trễ tăng dần theo msg.attempts." },
    { title: "5 · Ném lỗi cả batch", tab: "bad", highlight: [3, 6, 7], on: ["c"],
      desc: "Cách dễ viết nhất cũng là cách gây gửi trùng nhiều nhất." },
    { title: "6 · So với Kafka", tab: "java", highlight: [4, 6], on: ["q"],
      desc: "Kafka commit offset; Queues không có offset, không đọc lại được, không đảm bảo thứ tự." }
  ],

  quiz: [
    { q: "Cloudflare Queues đảm bảo giao nhận kiểu gì?", options: [
        "At-most-once", "At-least-once", "Exactly-once", "Không đảm bảo"
      ], correct: 1, explanation: "Consumer phải idempotent." },
    { q: "Queues có đảm bảo thứ tự message không?", options: [
        "Có, tuyệt đối", "Có, theo partition key", "Không", "Chỉ khi batch size = 1"
      ], correct: 2, explanation: "Cần thứ tự theo thực thể → cho qua Durable Object của thực thể đó." },
    { q: "Consumer ném lỗi ở message thứ 37 trong batch 50 (chưa ack message nào). Điều gì xảy ra?", options: [
        "Chỉ message 37 được retry",
        "Cả batch (các message chưa ack) được retry",
        "Batch bị xoá",
        "Message 37 vào DLQ ngay"
      ], correct: 1, explanation: "Nên ack/retry từng message." },
    { q: "Batch được giao cho consumer khi nào?", options: [
        "Chỉ khi đủ max_batch_size",
        "Khi đủ max_batch_size hoặc hết max_batch_timeout, cái nào tới trước",
        "Mỗi phút một lần",
        "Ngay khi có 1 message"
      ], correct: 1, explanation: "Mặc định 10 message / 5 giây." },
    { q: "Kích thước tối đa một message?", options: [
        "1 KB", "128 KB", "1 MB", "25 MB"
      ], correct: 1, explanation: "Payload lớn → lưu vào R2, message chỉ mang khoá tham chiếu." },
    { q: "Một queue có thể có bao nhiêu consumer Worker (push)?", options: [
        "Một", "Mười", "Không giới hạn như consumer group Kafka", "Bằng số partition"
      ], correct: 0, explanation: "Muốn nhiều bên nhận cùng sự kiện → producer gửi vào nhiều queue." },
    { q: "delaySeconds khi send/retry tối đa bao lâu?", options: [
        "60 giây", "12 giờ", "24 giờ", "14 ngày"
      ], correct: 2, explanation: "Theo bảng giới hạn Queues hiện hành." },
    { q: "Khác biệt cốt lõi giữa Queues và Kafka?", options: [
        "Queues nhanh hơn",
        "Kafka là log bền đọc lại được theo offset; Queues xoá message sau ack, không đọc lại",
        "Kafka không bền",
        "Queues hỗ trợ nhiều consumer group"
      ], correct: 1, explanation: "Không dùng Queues làm event store." },
    { q: "Khi nào send() resolve?", options: [
        "Khi consumer đã xử lý xong",
        "Khi message đã được ghi bền vào queue",
        "Ngay lập tức, chưa ghi gì",
        "Khi batch đầy"
      ], correct: 1, explanation: "Nên await send() trước khi trả 202." }
  ]
});
