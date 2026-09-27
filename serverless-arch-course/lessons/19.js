window.LESSONS.push({
  id: "19",
  phase: "6", phaseName: "Pattern & tổng kết",
  title: "Pattern mẫu: fan-out/fan-in, saga, outbox",
  subtitle: "Chia việc qua Queues và gom kết quả bằng DO · saga có bù trừ bằng Workflows · outbox trong DO để không mất sự kiện",

  theory: `
    <p>Ba bài toán phân tán kinh điển, và cách ráp chúng từ các khối đã học.</p>

    <p><strong>1. Fan-out / fan-in</strong> — "gửi thông báo cho 200.000 user", "tính lại giá 1 triệu sản phẩm".</p>
    <ul>
      <li>Fan-out: Worker nhận job, chia thành chunk (vd 100 user/message), <code>sendBatch</code> vào queue. Consumer tự scale, retry theo chunk.</li>
      <li>Fan-in: cần biết "xong hết chưa" → DO <code>job:{id}</code> giữ <code>total</code>, <code>done</code>; consumer báo xong từng chunk (idempotent theo chunkId). Khi <code>done == total</code> → phát sự kiện hoàn tất.</li>
    </ul>

    <p><strong>2. Saga</strong> — nghiệp vụ trải qua nhiều service, không có transaction phân tán (2PC).
    Mỗi bước có một <strong>hành động bù</strong>: trừ kho ↔ trả kho, thu tiền ↔ hoàn tiền. Lỗi ở bước n → chạy bù n-1 … 1 theo thứ tự ngược.
    Workflows là nơi tự nhiên để viết <em>orchestrated saga</em>: mỗi bước và mỗi hành động bù là một <code>step.do</code> (được lưu tiến độ, retry, idempotent).</p>

    <p><strong>3. Outbox</strong> — vấn đề "dual write": ghi DB thành công nhưng gửi sự kiện thất bại (hoặc ngược lại) → hệ khác không bao giờ biết.
    Giải pháp: ghi sự kiện vào bảng <code>outbox</code> <strong>trong cùng transaction</strong> với thay đổi nghiệp vụ; một tiến trình riêng đọc outbox, gửi đi, rồi xoá.
    Trong Spring bạn làm với Postgres + Debezium/scheduler. Trong DO: ghi SQLite (nguyên tử) + <strong>alarm</strong> làm relay → at-least-once, nên consumer phía sau phải idempotent.</p>

    <table>
      <tr><th>Pattern</th><th>Khối Cloudflare</th><th>Đảm bảo</th></tr>
      <tr><td>Fan-out/fan-in</td><td>Queues + DO đếm</td><td>Mỗi chunk ≥ 1 lần; phát hiện hoàn tất chính xác nhờ DO tuần tự</td></tr>
      <tr><td>Saga</td><td>Workflows (+ service bindings/HTTP)</td><td>Hoặc xong hết, hoặc đã bù; trạng thái bền qua sự cố</td></tr>
      <tr><td>Outbox</td><td>DO SQLite (hoặc D1 batch) + alarm/cron → Queues</td><td>Không mất sự kiện khi đã commit; có thể gửi trùng</td></tr>
    </table>

    <div class="callout"><p>💡 Cả ba đều dựa trên một nguyên lý: <strong>ghi ý định xuống chỗ bền trước, thực thi sau, và làm cho thực thi lặp lại được an toàn</strong>.
    Hiểu nguyên lý đó thì đổi Kafka lấy Queues hay Spring lấy Workers chỉ là đổi công cụ.</p></div>
  `,

  codeTabs: [
    { id: "fan", label: "① Fan-out + fan-in", lines: [
      "// Worker nhận job",
      "const chunks = chunk(userIds, 100);",
      "await env.JOB.getByName(jobId).start(chunks.length);",
      "for (const part of chunk(chunks.map((ids, i) => ({ body: { jobId, chunkId: i, ids } })), 100)) {",
      "  await env.NOTIFY_Q.sendBatch(part);                 // ≤ 100 message mỗi lần",
      "}",
      "",
      "// Consumer",
      "for (const m of batch.messages) {",
      "  await sendPushes(env, m.body.ids);",
      "  await env.JOB.getByName(m.body.jobId).chunkDone(m.body.chunkId);",
      "  m.ack();",
      "}",
      "",
      "// DO Job",
      "chunkDone(chunkId) {",
      "  this.ctx.storage.sql.exec('INSERT OR IGNORE INTO done(id) VALUES (?)', chunkId);  // idempotent",
      "  const n = this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM done').one().n;",
      "  const meta = this.ctx.storage.sql.exec('SELECT job_id, total FROM meta').one();   // ghi lúc start()",
      "  if (n === meta.total) return this.env.EVENTS_Q.send({ type: 'job-finished', jobId: meta.job_id });",
      "}"
    ]},
    { id: "saga", label: "② Saga bằng Workflows", lines: [
      "async run(event, step) {",
      "  const { orderId } = event.payload;",
      "  const done = [];",
      "  try {",
      "    await step.do('reserve stock', () => inventory.reserve(orderId));",
      "    done.push('stock');",
      "    await step.do('charge', () => payment.charge(orderId, { key: orderId }));",
      "    done.push('payment');",
      "    await step.do('book shipping', () => shipping.book(orderId));",
      "  } catch (e) {",
      "    if (done.includes('payment')) await step.do('refund', () => payment.refund(orderId, { key: orderId }));",
      "    if (done.includes('stock')) await step.do('release stock', () => inventory.release(orderId));",
      "    await step.do('mark failed', () => orders.fail(orderId, String(e)));",
      "  }",
      "}"
    ]},
    { id: "outbox", label: "③ Outbox trong DO", lines: [
      "placeOrder(order) {",
      "  this.ctx.storage.transactionSync(() => {",
      "    this.ctx.storage.sql.exec('INSERT INTO orders(id, total) VALUES (?, ?)', order.id, order.total);",
      "    this.ctx.storage.sql.exec('INSERT INTO outbox(payload) VALUES (?)',",
      "      JSON.stringify({ type: 'order-placed', id: order.id }));",
      "  });                                         // nguyên tử: có đơn thì có sự kiện",
      "  return this.ctx.storage.setAlarm(Date.now());",
      "}",
      "",
      "async alarm() {                              // relay",
      "  const rows = this.ctx.storage.sql.exec('SELECT seq, payload FROM outbox ORDER BY seq LIMIT 100').toArray();",
      "  if (rows.length === 0) return;",
      "  await this.env.ORDER_EVENTS.sendBatch(rows.map(r => ({ body: JSON.parse(r.payload) })));",
      "  this.ctx.storage.sql.exec('DELETE FROM outbox WHERE seq <= ?', rows[rows.length - 1].seq);",
      "  await this.ctx.storage.setAlarm(Date.now() + 1000);   // còn thì chạy tiếp",
      "}"
    ]},
    { id: "java", label: "④ Spring tương đương", lines: [
      "@Transactional",
      "public void placeOrder(Order o) {",
      "    orderRepo.save(o);",
      "    outboxRepo.save(new OutboxEvent(\"order-placed\", o.getId()));  // cùng transaction",
      "}",
      "// relay: Debezium (CDC) hoặc @Scheduled đọc outbox → KafkaTemplate.send → xoá",
      "// SAI kinh điển: orderRepo.save(o); kafkaTemplate.send(...);  // dual write"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="fan"><div class="nl">📤 Fan-out</div><div class="ns">job → N chunk → Queue</div></div>
      <div class="node" id="fin"><div class="nl">🧮 Fan-in</div><div class="ns">DO job đếm chunk xong</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="saga"><div class="nl">🔁 Saga (Workflow)</div><div class="ns">kho → tiền → giao · lỗi thì bù ngược</div></div>
      <div class="node" id="comp"><div class="nl">↩️ Bù trừ</div><div class="ns">refund → release stock</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="ob"><div class="nl">📝 Outbox (DO SQLite)</div><div class="ns">đơn + sự kiện cùng transaction</div></div>
      <div class="node" id="relay"><div class="nl">⏰ Alarm relay</div><div class="ns">sendBatch → xoá outbox</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chia việc", tab: "fan", highlight: [2, 3, 4, 5], on: ["fan"],
      desc: "Mỗi message một chunk 100 user; sendBatch tối đa 100 message. Job DO biết tổng số chunk." },
    { title: "2 · Gom kết quả", tab: "fan", highlight: [11, 17, 18, 20], on: ["fin"],
      desc: "INSERT OR IGNORE theo chunkId → chunk bị giao lại không đếm hai lần. DO tuần tự nên chỉ một lần thấy 'đủ'." },
    { title: "3 · Saga: đi xuôi", tab: "saga", highlight: [5, 6, 7, 8, 9], on: ["a1", "saga"],
      desc: "Mỗi bước là một step bền; ghi nhận bước nào đã xong." },
    { title: "4 · Saga: bù ngược", tab: "saga", highlight: [10, 11, 12, 13], on: ["comp"],
      desc: "Hành động bù cũng là step (có retry) và idempotent (dùng cùng key)." },
    { title: "5 · Outbox: ghi nguyên tử", tab: "outbox", highlight: [2, 3, 4, 6, 7], on: ["a2", "ob"],
      desc: "Đơn hàng và sự kiện cùng commit — không thể có cái này mà thiếu cái kia. Tránh dual write như dòng cuối tab Spring." },
    { title: "6 · Outbox: relay", tab: "outbox", highlight: [11, 13, 14, 15], on: ["relay"],
      desc: "Gửi rồi mới xoá. Crash giữa hai dòng → gửi lại lần sau (at-least-once) — consumer phải idempotent." }
  ],

  quiz: [
    { q: "'Dual write' là vấn đề gì?", options: [
        "Ghi hai lần cùng một dòng",
        "Ghi DB và gửi sự kiện là hai thao tác riêng — một cái thành công, cái kia thất bại → hệ thống lệch",
        "Hai user ghi cùng lúc",
        "Ghi vào hai region"
      ], correct: 1, explanation: "Outbox giải quyết bằng cách đưa sự kiện vào cùng transaction." },
    { q: "Trong outbox bằng DO, vì sao relay 'gửi rồi mới xoá'?", options: [
        "Cho nhanh",
        "Để crash giữa chừng thì chỉ gửi trùng (chấp nhận được với consumer idempotent) chứ không mất sự kiện",
        "Vì Queues yêu cầu",
        "Không quan trọng thứ tự"
      ], correct: 1, explanation: "Xoá trước rồi gửi thì crash sẽ mất sự kiện." },
    { q: "Saga khác transaction phân tán (2PC) thế nào?", options: [
        "Saga khoá tài nguyên ở mọi service tới khi commit",
        "Saga commit từng bước cục bộ và dùng hành động bù khi có lỗi",
        "Giống hệt",
        "Saga chỉ dùng cho đọc"
      ], correct: 1, explanation: "Nhất quán cuối cùng thay vì khoá toàn cục." },
    { q: "Vì sao Workflows hợp để viết saga?", options: [
        "Vì nó nhanh nhất",
        "Tiến độ từng bước được lưu bền, có retry theo bước, sống qua sự cố — kể cả khi đang bù trừ",
        "Vì không cần idempotent",
        "Vì nó thay được database"
      ], correct: 1, explanation: "Orchestrated saga tự nhiên." },
    { q: "Fan-in: làm sao biết chắc 'mọi chunk đã xong' khi message có thể giao lại?", options: [
        "Đếm số lần consumer chạy",
        "DO job ghi chunkId đã xong (INSERT OR IGNORE) và so số chunk khác nhau với tổng",
        "Đợi 1 giờ",
        "Dùng KV đếm"
      ], correct: 1, explanation: "Đếm theo tập id, không theo số lần gọi." },
    { q: "Hành động bù trong saga cần tính chất gì?", options: [
        "Chạy nhanh", "Idempotent và có retry", "Không cần gì", "Chạy song song với bước chính"
      ], correct: 1, explanation: "Bù trừ cũng có thể lỗi và bị chạy lại." },
    { q: "Trong Spring, tương đương relay của outbox thường là?", options: [
        "@Transactional", "Debezium CDC hoặc job định kỳ đọc bảng outbox rồi gửi Kafka", "Feign", "JPA cache"
      ], correct: 1, explanation: "Trên DO, alarm làm vai trò này." },
    { q: "Fan-out 1 triệu việc bằng một request Worker gọi thẳng 1 triệu lần có vấn đề gì?", options: [
        "Không vấn đề",
        "Vượt giới hạn subrequest/CPU, không retry từng phần; nên chia qua Queues",
        "Chỉ chậm hơn",
        "Bị tính egress"
      ], correct: 1, explanation: "Queues cho scale tự động và retry theo chunk." },
    { q: "Nguyên lý chung của ba pattern?", options: [
        "Làm mọi thứ đồng bộ",
        "Ghi ý định xuống chỗ bền trước, thực thi sau, làm cho thực thi lặp lại an toàn",
        "Tránh dùng database",
        "Dùng một service duy nhất"
      ], correct: 1, explanation: "Áp dụng được với mọi công cụ." }
  ]
});
