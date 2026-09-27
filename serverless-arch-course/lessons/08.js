window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Bất đồng bộ: Queues & Workflows",
  title: "Retry, DLQ và consumer idempotent",
  subtitle: "max_retries · retry_delay · dead letter queue · khoá idempotency · max_concurrency",

  theory: `
    <p>At-least-once nghĩa là <strong>trùng lặp là chuyện bình thường</strong>, không phải lỗi hiếm. Nguồn trùng:
    consumer ném lỗi sau khi đã làm một phần; consumer bị timeout; producer gửi lại vì không chắc lần trước thành công.
    Kỹ sư thiết kế sao cho <em>xử lý 2 lần = xử lý 1 lần</em>.</p>

    <p><strong>Vòng đời một message lỗi</strong></p>
    <ol>
      <li>Consumer gọi <code>msg.retry()</code> hoặc ném lỗi → message quay lại queue, <code>msg.attempts</code> tăng.</li>
      <li>Độ trễ trước lần giao tiếp theo: <code>retry({ delaySeconds })</code>, hoặc mặc định của consumer <code>retry_delay</code>.</li>
      <li>Vượt <code>max_retries</code> (mặc định 3, tối đa 100) → chuyển sang <code>dead_letter_queue</code> nếu có cấu hình; <strong>không có DLQ thì message bị xoá vĩnh viễn</strong>.</li>
      <li>DLQ là một queue bình thường: gắn consumer để cảnh báo/lưu R2/cho người xem, rồi replay sau khi sửa lỗi.</li>
    </ol>

    <p><strong>Ba cách làm consumer idempotent</strong></p>
    <table>
      <tr><th>Cách</th><th>Ví dụ</th><th>Lưu ý</th></tr>
      <tr><td>Thao tác tự nhiên idempotent</td><td><code>UPSERT ... SET status = 'PAID'</code> thay vì <code>balance = balance + 10</code></td><td>Rẻ nhất, ưu tiên thiết kế theo hướng này</td></tr>
      <tr><td>Bảng khoá đã xử lý</td><td><code>INSERT INTO processed(key) ...</code> cùng transaction với tác dụng phụ</td><td>Khoá = khoá nghiệp vụ (orderId+event), không chỉ <code>msg.id</code> (producer gửi lại sẽ có id khác)</td></tr>
      <tr><td>Truyền khoá xuống hệ đích</td><td>Header <code>Idempotency-Key</code> khi gọi Stripe/Payment service</td><td>Hệ đích tự loại trùng</td></tr>
    </table>
    <p>Chỗ khó: tác dụng phụ ở <em>hệ ngoài</em> (gửi email) không nằm chung transaction với bảng khoá. Làm "đánh dấu → gửi" có thể mất email; "gửi → đánh dấu" có thể gửi trùng.
    Với email thường chấp nhận trùng hiếm; với tiền thì bắt buộc hệ đích hỗ trợ idempotency key.</p>

    <p><strong>Concurrency</strong>: consumer tự scale theo backlog (tới 250 invocation đồng thời). Đặt <code>max_concurrency</code> để bảo vệ hệ đích yếu (vd service Java chỉ chịu 20 request song song).</p>

    <div class="callout"><p>💡 Chi phí Queues tính theo <strong>operation</strong>: mỗi 64 KB ghi, đọc, xoá là một operation → một message nhỏ ≈ 3 operation; mỗi lần retry thêm lượt đọc.
    Retry vô hạn vì lỗi logic = đốt tiền. Phân biệt lỗi <em>tạm thời</em> (retry) và lỗi <em>vĩnh viễn</em> (ack + ghi lại, hoặc đẩy thẳng DLQ).</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "① Cấu hình retry/DLQ", lines: [
      "\"queues\": {",
      "  \"consumers\": [",
      "    { \"queue\": \"payments\", \"max_retries\": 8, \"retry_delay\": 60,",
      "      \"dead_letter_queue\": \"payments-dlq\", \"max_concurrency\": 20 },",
      "    { \"queue\": \"payments-dlq\", \"max_batch_size\": 10 }",
      "  ]",
      "}"
    ]},
    { id: "idem", label: "② Consumer idempotent (D1)", lines: [
      "async queue(batch, env) {",
      "  for (const msg of batch.messages) {",
      "    const ev = msg.body;                          // { key: 'order-9:paid', orderId, amount }",
      "    try {",
      "      const [ins] = await env.DB.batch([",
      "        env.DB.prepare('INSERT OR IGNORE INTO processed(key) VALUES (?)').bind(ev.key),",
      "        env.DB.prepare(\"UPDATE orders SET status = 'PAID' WHERE id = ? AND status = 'PENDING'\").bind(ev.orderId)",
      "      ]);                                         // batch = một transaction",
      "      if (ins.meta.changes === 0) { msg.ack(); continue; }   // đã xử lý trước đó",
      "      msg.ack();",
      "    } catch (e) {",
      "      msg.retry({ delaySeconds: Math.min(3600, 2 ** msg.attempts * 10) });",
      "    }",
      "  }",
      "}"
    ]},
    { id: "classify", label: "③ Tạm thời vs vĩnh viễn", lines: [
      "try {",
      "  const r = await env.PAYMENT.fetch('https://payment/charge', {",
      "    method: 'POST', body: JSON.stringify(ev),",
      "    headers: { 'Idempotency-Key': ev.key } });",
      "  if (r.status >= 500 || r.status === 429) return msg.retry({ delaySeconds: 60 });",
      "  if (r.status >= 400) {                       // lỗi dữ liệu: retry vô ích",
      "    await env.BAD.send({ ev, status: r.status, body: await r.text() });",
      "    return msg.ack();",
      "  }",
      "  msg.ack();",
      "} catch { msg.retry(); }"
    ]},
    { id: "dlq", label: "④ Consumer của DLQ", lines: [
      "async queue(batch, env) {",
      "  if (batch.queue !== 'payments-dlq') return;",
      "  for (const msg of batch.messages) {",
      "    await env.ARCHIVE.put('dlq/' + msg.id + '.json', JSON.stringify(msg.body));  // R2",
      "    await notifySlack(env, 'DLQ: ' + msg.id);",
      "    msg.ack();",
      "  }",
      "}",
      "// sửa bug xong: script đọc R2 và send() lại vào 'payments'"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">📬 payments</div><div class="ns">msg order-9:paid</div></div>
    <div class="arrow" id="a1">↓ giao (attempts=1)</div>
    <div class="node" id="c"><div class="nl">⚙️ Consumer</div><div class="ns">INSERT OR IGNORE processed(key)</div></div>
    <div class="row">
      <div class="node" id="dup"><div class="nl">♻️ Đã có key</div><div class="ns">ack, không làm lại</div></div>
      <div class="node" id="tmp"><div class="nl">🔁 Lỗi tạm (5xx)</div><div class="ns">retry, backoff</div></div>
      <div class="node" id="perm"><div class="nl">⛔ Lỗi dữ liệu (4xx)</div><div class="ns">ack + ghi lại</div></div>
    </div>
    <div class="arrow" id="a2">↓ quá max_retries</div>
    <div class="node" id="dlq"><div class="nl">🪦 payments-dlq</div><div class="ns">lưu R2, báo động, replay sau</div></div>
  `,
  steps: [
    { title: "1 · Cấu hình vòng đời", tab: "cfg", highlight: [3, 4], on: ["q"],
      desc: "8 lần thử, mỗi lần cách 60 s mặc định, quá thì vào DLQ. max_concurrency 20 bảo vệ service phía sau." },
    { title: "2 · Khoá idempotency", tab: "idem", highlight: [3, 6, 7, 8], on: ["a1", "c"],
      desc: "Khoá nghiệp vụ và cập nhật trạng thái trong cùng D1 batch (một transaction). Cập nhật cũng có điều kiện status = PENDING." },
    { title: "3 · Gặp lại message đã xử lý", tab: "idem", highlight: [9], on: ["dup"],
      desc: "changes = 0 nghĩa là key đã tồn tại → ack luôn. Trùng không gây hại." },
    { title: "4 · Phân loại lỗi", tab: "classify", highlight: [4, 5, 6, 7, 8], on: ["tmp", "perm"],
      desc: "5xx/429 là tạm thời → retry. 4xx là dữ liệu hỏng → retry chỉ tốn tiền; ack và ghi sang nơi khác để xem xét." },
    { title: "5 · DLQ", tab: "dlq", highlight: [2, 4, 5, 6], on: ["a2", "dlq"],
      desc: "Không cấu hình DLQ thì message quá hạn retry bị xoá mất. DLQ có consumer riêng để lưu và báo động." }
  ],

  quiz: [
    { q: "Message vượt max_retries và queue KHÔNG cấu hình DLQ. Điều gì xảy ra?", options: [
        "Được giữ mãi", "Bị xoá vĩnh viễn", "Quay về producer", "Gửi email cho admin"
      ], correct: 1, explanation: "Luôn cấu hình DLQ cho luồng quan trọng." },
    { q: "Vì sao chỉ dùng msg.id làm khoá chống trùng là chưa đủ?", options: [
        "msg.id quá dài",
        "Nếu producer gửi lại cùng sự kiện, message mới có id khác — cần khoá nghiệp vụ",
        "msg.id thay đổi mỗi lần retry",
        "msg.id không tồn tại"
      ], correct: 1, explanation: "msg.id chỉ chống trùng do retry của chính queue." },
    { q: "Thao tác nào tự nhiên idempotent?", options: [
        "balance = balance + 10",
        "UPDATE orders SET status = 'PAID' WHERE id = ? AND status = 'PENDING'",
        "INSERT không có khoá unique",
        "Gửi email"
      ], correct: 1, explanation: "Chạy lại không đổi kết quả." },
    { q: "Consumer gọi Payment service nhận về 400 (dữ liệu sai). Nên làm gì?", options: [
        "retry() mãi",
        "ack và ghi message sang nơi xem xét, vì retry không sửa được lỗi dữ liệu",
        "Ném lỗi cả batch",
        "Bỏ qua không ack"
      ], correct: 1, explanation: "Retry lỗi vĩnh viễn chỉ tốn operation và làm tắc queue." },
    { q: "max_concurrency của consumer dùng để làm gì?", options: [
        "Tăng tốc độ gửi",
        "Giới hạn số invocation consumer chạy song song để bảo vệ hệ đích",
        "Giới hạn số queue",
        "Giới hạn kích thước message"
      ], correct: 1, explanation: "Mặc định consumer tự scale theo backlog." },
    { q: "Một message nhỏ đi hết vòng đời (ghi, đọc, xoá) tốn khoảng bao nhiêu operation?", options: [
        "1", "3", "10", "64"
      ], correct: 1, explanation: "Mỗi 64 KB ghi/đọc/xoá là một operation." },
    { q: "Gọi service ngoài để trừ tiền từ consumer, cách chống trừ hai lần tốt nhất?", options: [
        "Hy vọng không có retry",
        "Gửi Idempotency-Key để service đích tự loại trùng",
        "Đặt max_retries = 0",
        "Dùng batch size 1"
      ], correct: 1, explanation: "Tác dụng phụ ở hệ ngoài không chung transaction với bảng khoá của bạn." },
    { q: "Dùng D1 batch([...]) cho INSERT khoá + UPDATE trạng thái có ý nghĩa gì?", options: [
        "Chạy song song cho nhanh",
        "Các câu chạy trong một transaction — cùng thành công hoặc cùng rollback",
        "Tự động retry",
        "Bỏ qua lỗi"
      ], correct: 1, explanation: "D1 batch là giao dịch SQL." },
    { q: "retry({ delaySeconds }) tăng theo msg.attempts nhằm mục đích gì?", options: [
        "Tăng throughput",
        "Backoff: không dội liên tục vào hệ đích đang lỗi",
        "Đảm bảo thứ tự",
        "Giảm dung lượng queue"
      ], correct: 1, explanation: "Exponential backoff, có trần." }
  ]
});
