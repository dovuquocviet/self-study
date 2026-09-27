window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Handler & routing",
  title: "scheduled (cron) & queue handler — Worker không chỉ nhận HTTP",
  subtitle: "triggers.crons (UTC) · test cron local · Queues producer/consumer · ack/retry · DLQ · at-least-once · so với Kafka",

  theory: `
    <p>Ngoài <code>fetch</code>, Worker có thể export thêm handler cho các loại sự kiện khác. Hai loại dùng nhiều nhất:</p>

    <p><strong>1. <code>scheduled</code> — Cron Triggers</strong> (tương đương <code>@Scheduled(cron=...)</code>)</p>
    <ul>
      <li>Khai báo trong <code>"triggers": { "crons": ["*/5 * * * *"] }</code>. Cú pháp cron 5 trường, <strong>chạy theo giờ UTC</strong> (7h sáng VN = <code>0 0 * * *</code>).</li>
      <li>Handler <code>scheduled(controller, env, ctx)</code>; <code>controller.cron</code> cho biết biểu thức nào kích hoạt (một Worker có thể có nhiều cron).</li>
      <li>Giới hạn CPU: Free 10 ms; Paid 30 giây (cron chu kỳ &lt; 1 giờ) hoặc 15 phút (chu kỳ ≥ 1 giờ). Free tối đa 5 cron/account, Paid 250.</li>
      <li>Thay đổi cron mất tới ~15 phút để lan toả. Test local: <code>wrangler dev --test-scheduled</code> rồi gọi <code>/cdn-cgi/local/scheduled</code>.</li>
      <li>Không có "khoá phân tán" kiểu ShedLock — mỗi lần kích hoạt chạy một lần, nhưng nên viết idempotent phòng khi chạy lại.</li>
    </ul>

    <p><strong>2. <code>queue</code> — Cloudflare Queues</strong></p>
    <ul>
      <li><em>Producer</em>: binding <code>env.ORDER_QUEUE.send(body)</code> / <code>sendBatch([...])</code>. Tin tối đa 128 KB.</li>
      <li><em>Consumer</em>: handler <code>queue(batch, env, ctx)</code> nhận <strong>một lô</strong> tin (mặc định tối đa 10 tin hoặc chờ 5 giây, cấu hình tới 100 tin / 60 giây).</li>
      <li>Mỗi tin: <code>msg.ack()</code> (xong), <code>msg.retry({ delaySeconds })</code> (thử lại). Nếu handler <strong>ném lỗi</strong> mà chưa ack → <em>cả lô</em> bị retry.</li>
      <li>Hết <code>max_retries</code> (mặc định 3) → tin sang <code>dead_letter_queue</code> nếu có cấu hình, không thì bị xoá.</li>
      <li>Đảm bảo <strong>at-least-once</strong>: một tin có thể tới hơn một lần → consumer phải idempotent (vd kiểm tra orderId đã xử lý chưa).</li>
    </ul>

    <table>
      <tr><th></th><th>Kafka (công ty đang dùng)</th><th>Cloudflare Queues</th></tr>
      <tr><td>Mô hình</td><td>Log bền, partition, offset; nhiều consumer group đọc lại được</td><td>Hàng đợi công việc: tin được xoá khi ack</td></tr>
      <tr><td>Replay</td><td>Có (reset offset)</td><td>Không</td></tr>
      <tr><td>Thứ tự</td><td>Trong một partition</td><td>Không cam kết thứ tự</td></tr>
      <tr><td>Consumer</td><td>Process chạy liên tục, poll</td><td>Worker được <em>đẩy</em> lô tin, tự scale</td></tr>
    </table>

    <div class="callout"><p>💡 Queues thay được "RabbitMQ/SQS cho job nền", không thay Kafka làm xương sống sự kiện (ClickHouse đang consume Kafka vẫn giữ nguyên).
    Muốn Worker đẩy sự kiện vào Kafka thì gọi một REST proxy/HTTP ingest phía bạn, hoặc đi qua Queue rồi một service Rust chuyển tiếp.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "wrangler.jsonc", lines: [
      "{",
      "  \"name\": \"order-worker\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"triggers\": { \"crons\": [\"0 0 * * *\", \"*/10 * * * *\"] },   // 07:00 VN; mỗi 10 phút",
      "  \"queues\": {",
      "    \"producers\": [{ \"binding\": \"ORDER_QUEUE\", \"queue\": \"orders\" }],",
      "    \"consumers\": [{",
      "      \"queue\": \"orders\",",
      "      \"max_batch_size\": 20,",
      "      \"max_batch_timeout\": 5,",
      "      \"max_retries\": 5,",
      "      \"dead_letter_queue\": \"orders-dlq\"",
      "    }]",
      "  }",
      "}"
    ]},
    { id: "code", label: "src/index.ts", lines: [
      "type OrderMsg = { orderId: string; email: string };",
      "",
      "export default {",
      "  async fetch(request: Request, env: Env): Promise<Response> {",
      "    const order = await request.json<OrderMsg>();",
      "    await env.ORDER_QUEUE.send(order);                 // producer",
      "    return Response.json({ queued: true }, { status: 202 });",
      "  },",
      "",
      "  async queue(batch: MessageBatch<OrderMsg>, env: Env, ctx: ExecutionContext) {",
      "    for (const msg of batch.messages) {",
      "      try {",
      "        if (await alreadySent(env, msg.body.orderId)) { msg.ack(); continue; }  // idempotent",
      "        await sendConfirmationEmail(env, msg.body);",
      "        msg.ack();",
      "      } catch (e) {",
      "        msg.retry({ delaySeconds: 30 * msg.attempts });  // backoff tăng dần",
      "      }",
      "    }",
      "  },",
      "",
      "  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {",
      "    if (controller.cron === '0 0 * * *') ctx.waitUntil(sendDailyReport(env));",
      "    else ctx.waitUntil(cleanupExpiredCarts(env));",
      "  },",
      "} satisfies ExportedHandler<Env, OrderMsg>;"
    ]},
    { id: "cli", label: "Lệnh & test local", lines: [
      "npx wrangler queues create orders",
      "npx wrangler queues create orders-dlq",
      "",
      "npx wrangler dev --test-scheduled",
      "curl \"http://localhost:8787/cdn-cgi/local/scheduled?cron=0+0+*+*+*\"",
      "",
      "# Queue chạy local luôn: POST vào fetch -> producer -> consumer trong cùng wrangler dev",
      "curl -X POST localhost:8787 -d '{\"orderId\":\"o1\",\"email\":\"a@b.vn\"}'"
    ]},
    { id: "java", label: "Spring ↔ Workers", lines: [
      "@Scheduled(cron = \"0 0 7 * * *\", zone = \"Asia/Ho_Chi_Minh\")",
      "      <->  \"crons\": [\"0 0 * * *\"]   (UTC, 5 trường, không có giây)",
      "",
      "@RabbitListener / @SqsListener(\"orders\")",
      "      <->  async queue(batch, env, ctx)",
      "channel.basicAck / basicNack(requeue)",
      "      <->  msg.ack() / msg.retry()"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="cron"><div class="nl">⏰ Cron Trigger</div><div class="ns">UTC · controller.cron</div></div>
      <div class="node" id="api"><div class="nl">📥 POST /orders</div><div class="ns">fetch handler</div></div>
    </div>
    <div class="arrow" id="a1">↓ env.ORDER_QUEUE.send()</div>
    <div class="node" id="q"><div class="nl">📬 Queue "orders"</div><div class="ns">at-least-once · ≤128 KB/tin</div></div>
    <div class="arrow" id="a2">↓ đẩy theo lô (batch)</div>
    <div class="node" id="cons"><div class="nl">⚙️ queue(batch)</div><div class="ns">ack / retry từng tin</div></div>
    <div class="node" id="dlq"><div class="nl">☠️ orders-dlq</div><div class="ns">hết max_retries</div></div>
  `,
  steps: [
    { title: "1 · Khai báo cron & queue", tab: "cfg", highlight: [5, 6, 7, 8, 9, 10, 11, 12, 13], on: ["cron", "q"],
      desc: "Cron theo UTC. Một Worker có thể vừa là producer vừa là consumer của cùng queue." },
    { title: "2 · Producer: trả 202 ngay", tab: "code", highlight: [5, 6, 7], on: ["api", "a1", "q"],
      desc: "API chỉ ghi vào queue rồi trả 202. Việc chậm (gửi email) xử lý bất đồng bộ, có retry." },
    { title: "3 · Consumer nhận theo lô", tab: "code", highlight: [10, 11, 13, 14, 15], on: ["a2", "cons"],
      desc: "Ack từng tin. Kiểm tra idempotent trước vì cùng một tin có thể tới hai lần." },
    { title: "4 · Retry có backoff, rồi DLQ", tab: "code", highlight: [16, 17], on: ["cons", "dlq"],
      desc: "<code>msg.attempts</code> tăng mỗi lần giao. Hết <code>max_retries</code> → vào DLQ để điều tra." },
    { title: "5 · Một handler, nhiều cron", tab: "code", highlight: [22, 23, 24], on: ["cron"],
      desc: "Phân nhánh theo <code>controller.cron</code>." },
    { title: "6 · Test local", tab: "cli", highlight: [4, 5, 8], on: ["cron", "cons"],
      desc: "<code>--test-scheduled</code> mở route <code>/cdn-cgi/local/scheduled</code>; queue được giả lập trong wrangler dev." }
  ],

  quiz: [
    { q: "Cron \"0 0 * * *\" trên Workers chạy lúc mấy giờ Việt Nam (UTC+7)?", options: [
        "00:00", "07:00", "17:00", "Tuỳ data center"
      ], correct: 1, explanation: "Cron Triggers chạy theo UTC." },
    { q: "Handler queue ném exception khi chưa ack tin nào. Điều gì xảy ra?", options: [
        "Chỉ tin đầu tiên được retry",
        "Cả lô được retry",
        "Tin bị xoá",
        "Queue bị dừng"
      ], correct: 1, explanation: "Nên try/catch từng tin và ack/retry riêng." },
    { q: "Queues đảm bảo giao tin kiểu gì, và hệ quả?", options: [
        "Exactly-once, không cần lo",
        "At-least-once — tin có thể tới nhiều lần, consumer phải idempotent",
        "At-most-once — có thể mất tin",
        "Không đảm bảo gì"
      ], correct: 1, explanation: "Dùng khoá nghiệp vụ (orderId) để bỏ qua tin trùng." },
    { q: "Tin hết max_retries và có cấu hình dead_letter_queue thì?", options: [
        "Bị xoá luôn",
        "Chuyển sang DLQ",
        "Retry vô hạn",
        "Quay lại đầu queue"
      ], correct: 1, explanation: "Không có DLQ thì tin bị xoá sau khi hết lượt." },
    { q: "Khác biệt cốt lõi giữa Kafka và Cloudflare Queues?", options: [
        "Queues có partition và replay",
        "Kafka là log bền đọc lại được theo offset; Queues là hàng đợi công việc, tin mất khi ack, không replay",
        "Kafka không bền",
        "Giống hệt nhau"
      ], correct: 1, explanation: "Queues không thay Kafka làm xương sống sự kiện." },
    { q: "Kích thước tối đa một tin trên Queues?", options: [
        "1 KB", "128 KB", "25 MB", "1 GB"
      ], correct: 1, explanation: "Dữ liệu lớn hơn → lưu R2 và gửi key trong tin." },
    { q: "Test cron local thế nào?", options: [
        "Chờ tới giờ",
        "wrangler dev --test-scheduled rồi gọi /cdn-cgi/local/scheduled",
        "Deploy lên production",
        "Không test được"
      ], correct: 1, explanation: "Có thể truyền ?cron=... để chọn biểu thức." },
    { q: "Giá trị mặc định của max_batch_size và max_retries?", options: [
        "1 và 0", "10 và 3", "100 và 100", "50 và 10"
      ], correct: 1, explanation: "Mặc định 10 tin/lô, retry 3 lần; batch timeout mặc định 5 giây." },
    { q: "msg.retry({ delaySeconds: 30 * msg.attempts }) có tác dụng gì?", options: [
        "Xoá tin",
        "Đưa tin lại queue với độ trễ tăng dần theo số lần đã giao (backoff)",
        "Gửi tin sang DLQ ngay",
        "Tạm dừng cả queue"
      ], correct: 1, explanation: "Tránh dội API đang lỗi." },
    { q: "Vì sao API nên trả 202 sau khi send vào queue thay vì 200/201?", options: [
        "Bắt buộc về cú pháp",
        "202 Accepted diễn đạt đúng: đã nhận, sẽ xử lý bất đồng bộ",
        "202 nhanh hơn",
        "Queue chỉ chấp nhận 202"
      ], correct: 1, explanation: "Ngữ nghĩa HTTP rõ ràng giúp client hiểu kết quả chưa hoàn tất." }
  ]
});
