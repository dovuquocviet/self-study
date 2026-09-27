window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Vận hành: hiệu năng, quan sát, chi phí",
  title: "Observability & debugging khi không có server để SSH",
  subtitle: "Workers Logs · log JSON có cấu trúc · wrangler tail · Tail Worker · traces OTel · source map · correlation id",

  theory: `
    <p>Trong Spring bạn có log file, Actuator, APM agent, và khi bí thì SSH vào pod. Serverless không có máy để vào — <strong>mọi thứ bạn biết về production là thứ bạn đã chủ động phát ra</strong>.</p>

    <table>
      <tr><th>Công cụ</th><th>Dùng khi</th><th>Ghi chú</th></tr>
      <tr><td><strong>Workers Logs</strong> (<code>observability.enabled</code>)</td><td>Tra cứu log sau sự cố</td><td>Lưu và query trên dashboard; <code>head_sampling_rate</code> để lấy mẫu khi traffic lớn</td></tr>
      <tr><td><code>wrangler tail</code></td><td>Xem log realtime lúc debug</td><td>Có lọc <code>--status error</code>, <code>--search</code></td></tr>
      <tr><td><strong>Tail Worker</strong></td><td>Tự xử lý log/exception của Worker khác (đẩy về hệ log công ty, cảnh báo)</td><td>Handler <code>tail(events)</code>, khai báo <code>tail_consumers</code></td></tr>
      <tr><td><strong>Logpush</strong></td><td>Đẩy log số lượng lớn về R2/S3/Datadog/Splunk...</td><td>Hợp với nhu cầu lưu lâu, tuân thủ</td></tr>
      <tr><td><strong>Traces</strong> (OpenTelemetry)</td><td>Xem thời gian từng subrequest, binding</td><td>Tự động instrument fetch/binding; export OTLP tới hệ tracing sẵn có</td></tr>
      <tr><td><code>upload_source_maps</code></td><td>Stack trace chỉ đúng dòng TypeScript gốc</td><td>Không có thì stack chỉ trỏ vào bundle đã build</td></tr>
    </table>

    <p><strong>Log có cấu trúc</strong>: <code>console.log(JSON.stringify({...}))</code> hoặc truyền object — Workers Logs tự tách field để lọc/nhóm
    (vd lọc theo <code>orderId</code>). Log chuỗi tự do thì chỉ tìm kiếm văn bản được.</p>

    <p><strong>Correlation id xuyên hệ thống</strong>: mỗi request vào có header <code>cf-ray</code>. Lấy nó (hoặc <code>traceparent</code> nếu client gửi) làm <code>requestId</code>,
    ghi vào mọi log, truyền xuống service Rust/Java qua header, và <em>nhét vào body message</em> khi gửi Queues/Workflows — vì hàng đợi làm đứt chuỗi trace.</p>

    <p><strong>Debug theo loại</strong></p>
    <ul>
      <li>Queues: xem backlog, số retry, DLQ trên dashboard; log <code>msg.id</code> + <code>msg.attempts</code>.</li>
      <li>Workflows: <code>wrangler workflows instances describe</code> cho thấy từng step, lần thử, lỗi, output.</li>
      <li>DO: log kèm tên object; lỗi hay gặp là "object reset" do exception không bắt, hoặc vượt CPU.</li>
      <li>Local: <code>wrangler dev</code> chạy runtime <code>workerd</code> thật, có DevTools để đặt breakpoint.</li>
    </ul>

    <div class="callout"><p>💡 Log trả tiền theo dung lượng và bị lấy mẫu khi lớn. Log <em>quyết định và dữ kiện</em> (orderId, nhánh đã đi, lỗi, thời gian gọi backend), không log cả payload và
    <strong>không log token/PII</strong>.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "① Bật observability", lines: [
      "// wrangler.jsonc",
      "\"observability\": {",
      "  \"enabled\": true,",
      "  \"head_sampling_rate\": 1       // 1 = 100%; traffic lớn giảm xuống 0.1",
      "},",
      "\"upload_source_maps\": true,",
      "\"tail_consumers\": [{ \"service\": \"log-shipper\" }]"
    ]},
    { id: "log", label: "② Log có cấu trúc + requestId", lines: [
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const requestId = req.headers.get('cf-ray') ?? crypto.randomUUID();",
      "    const log = (level, msg, extra) => console.log(JSON.stringify({ level, msg, requestId, ...extra }));",
      "    const t0 = Date.now();",
      "    const r = await fetch('https://orders.internal.example.com/x', { headers: { 'X-Request-Id': requestId } });",
      "    log('info', 'orders call', { status: r.status, ms: Date.now() - t0 });",
      "    await env.EVENTS_Q.send({ type: 'viewed', requestId });   // mang id qua hàng đợi",
      "    return new Response('ok', { headers: { 'X-Request-Id': requestId } });",
      "  }",
      "};"
    ]},
    { id: "tail", label: "③ Tail Worker", lines: [
      "// log-shipper: nhận log/exception của các Worker khai báo tail_consumers",
      "export default {",
      "  async tail(events, env, ctx) {",
      "    const errors = events.filter(e => e.outcome !== 'ok' || e.exceptions.length > 0);",
      "    if (errors.length) ctx.waitUntil(alertSlack(env, errors));",
      "    ctx.waitUntil(fetch(env.LOKI_URL, { method: 'POST', body: JSON.stringify(events) }));",
      "  }",
      "};"
    ]},
    { id: "cli", label: "④ Lệnh debug", lines: [
      "npx wrangler tail orders-worker --status error --format pretty",
      "npx wrangler tail orders-worker --search 'order-9'",
      "npx wrangler workflows instances describe order-flow order-9",
      "npx wrangler queues info payments",
      "npx wrangler dev      # workerd local, nhấn D để mở DevTools"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request (cf-ray = 8a1f…)</div><div class="ns">requestId gắn vào mọi log</div></div>
    <div class="arrow" id="a1">↓ header X-Request-Id · body message</div>
    <div class="row">
      <div class="node" id="svc"><div class="nl">🦀 Service Rust</div><div class="ns">log cùng requestId</div></div>
      <div class="node" id="q"><div class="nl">📬 Queue</div><div class="ns">requestId trong body</div></div>
    </div>
    <div class="arrow" id="a2">↓ Workers Logs · Tail Worker · traces OTLP</div>
    <div class="node" id="obs"><div class="nl">🔭 Hệ quan sát của công ty</div><div class="ns">lọc theo requestId thấy cả chuỗi</div></div>
  `,
  steps: [
    { title: "1 · Bật thu thập", tab: "cfg", highlight: [3, 4, 6, 7], on: ["obs"],
      desc: "Workers Logs + source map + Tail Worker. Giảm sampling khi traffic lớn để kiểm soát chi phí." },
    { title: "2 · Gắn requestId", tab: "log", highlight: [3, 4], on: ["req"],
      desc: "cf-ray là id duy nhất cho request. Log dạng JSON để lọc theo field." },
    { title: "3 · Truyền qua mọi chặng", tab: "log", highlight: [6, 7, 8], on: ["a1", "svc", "q"],
      desc: "Header cho HTTP, body cho message — hàng đợi không tự mang trace context." },
    { title: "4 · Xử lý log tập trung", tab: "tail", highlight: [3, 4, 5, 6], on: ["a2", "obs"],
      desc: "Tail Worker lọc lỗi để cảnh báo và đẩy log về hệ sẵn có (Loki/ELK)." },
    { title: "5 · Công cụ khi điều tra", tab: "cli", highlight: [1, 2, 3, 5], on: ["obs"],
      desc: "tail realtime, describe instance workflow, DevTools khi chạy local." }
  ],

  quiz: [
    { q: "Vì sao nên log JSON có cấu trúc thay vì chuỗi tự do?", options: [
        "Nhỏ hơn",
        "Hệ log tách field để lọc/nhóm (vd theo orderId), thay vì chỉ tìm văn bản",
        "Bắt buộc bởi runtime",
        "Nhanh hơn"
      ], correct: 1, explanation: "Workers Logs tự index field của log JSON." },
    { q: "Header nào có sẵn trong mọi request vào Cloudflare, dùng làm requestId được?", options: [
        "x-request-id", "cf-ray", "x-amzn-trace-id", "traceparent (luôn có)"
      ], correct: 1, explanation: "Ray ID định danh request." },
    { q: "Vì sao phải nhét requestId vào body khi gửi Queues?", options: [
        "Queues yêu cầu",
        "Hàng đợi làm đứt chuỗi trace; không mang thì consumer không nối được log với request gốc",
        "Để mã hoá",
        "Để giảm kích thước"
      ], correct: 1, explanation: "Truyền context thủ công qua message." },
    { q: "Tail Worker dùng để làm gì?", options: [
        "Chạy cuối cùng trong chuỗi middleware",
        "Nhận log/exception/kết quả của Worker khác để xử lý (cảnh báo, đẩy về hệ log)",
        "Thay cho Queues",
        "Rút gọn response"
      ], correct: 1, explanation: "Khai báo qua tail_consumers." },
    { q: "upload_source_maps: true giúp gì?", options: [
        "Giảm kích thước bundle",
        "Stack trace lỗi trỏ về dòng TypeScript gốc",
        "Tăng tốc cold start",
        "Mã hoá code"
      ], correct: 1, explanation: "Không có thì stack trỏ vào code đã bundle." },
    { q: "head_sampling_rate: 0.1 nghĩa là?", options: [
        "Giữ 10% request để ghi log",
        "Log 10 dòng mỗi request",
        "Giữ log 10 ngày",
        "Chỉ log lỗi"
      ], correct: 0, explanation: "Lấy mẫu để kiểm soát khối lượng/chi phí." },
    { q: "Điều tra vì sao một workflow order-9 bị kẹt, dùng lệnh nào?", options: [
        "wrangler tail",
        "wrangler workflows instances describe order-flow order-9",
        "wrangler d1 execute",
        "wrangler kv get"
      ], correct: 1, explanation: "Hiện từng step, số lần thử, lỗi." },
    { q: "Cái gì KHÔNG nên log?", options: [
        "orderId", "Mã lỗi và thời gian gọi backend", "Access token và dữ liệu cá nhân", "Nhánh logic đã đi"
      ], correct: 2, explanation: "Log đi qua nhiều hệ thống và người." },
    { q: "Muốn đẩy log khối lượng lớn về kho lưu trữ lâu dài (R2/S3/SIEM)?", options: [
        "wrangler tail > file", "Logpush", "KV", "console.table"
      ], correct: 1, explanation: "Logpush dành cho export số lượng lớn." }
  ]
});
