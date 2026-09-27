window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Vận hành: giới hạn, log, test",
  title: "Logging & observability — wrangler tail và Workers Logs",
  subtitle: "console.log có cấu trúc · wrangler tail (live) · observability.enabled · sampling · lưu 3/7 ngày · CPU time mỗi request",

  theory: `
    <p>Ở Spring bạn có Logback ghi file/stdout, Filebeat đẩy sang Elasticsearch, Kibana để tìm. Với Workers không có file, không có host để cài agent.
    Log đi theo đường khác: bạn chỉ cần <code>console.log</code>/<code>console.error</code>; runtime thu lại cùng thông tin của lần gọi.</p>

    <p><strong>Hai công cụ chính</strong></p>
    <table>
      <tr><th></th><th><code>wrangler tail</code></th><th>Workers Logs</th></tr>
      <tr><td>Là gì</td><td>Luồng log <strong>trực tiếp</strong> từ production về terminal</td><td>Log được <strong>lưu lại</strong> và truy vấn trên dashboard</td></tr>
      <tr><td>Bật</td><td>Không cần cấu hình</td><td><code>"observability": { "enabled": true }</code></td></tr>
      <tr><td>Lưu</td><td>Không lưu — tắt terminal là mất</td><td>Free 3 ngày (200.000 log/ngày); Paid 7 ngày (20 triệu/tháng, vượt thì trả thêm)</td></tr>
      <tr><td>Dùng khi</td><td>Debug ngay lúc này, xem request đang chạy</td><td>Điều tra sự cố đã qua, lọc theo trường, thống kê</td></tr>
    </table>

    <p><strong>Invocation log</strong>: mỗi lần gọi có một bản ghi tự động gồm URL, method, status, <strong>CPU time</strong>, wall time, outcome
    (<code>ok</code>, <code>exception</code>, <code>exceededCpu</code>, <code>exceededMemory</code>, <code>canceled</code>…). Đây là số liệu để quyết định có cần tối ưu/Rust không (bài 16).</p>

    <p><strong>Log có cấu trúc</strong>: truyền <em>object</em> thay vì nối chuỗi — <code>console.log({ event: 'order_created', orderId, ms })</code>.
    Workers Logs tách từng trường để lọc (<code>orderId = ...</code>), giống MDC + JSON encoder của Logback. Mỗi dòng log tối đa 256 KB.</p>

    <p><strong>Sampling</strong>: <code>head_sampling_rate</code> từ 0 đến 1 (vd <code>0.1</code> = giữ 10% lần gọi). Service lưu lượng lớn nên giảm để không vượt hạn mức;
    lỗi hiếm thì cân nhắc tự log thêm khi có lỗi thay vì giảm sampling mù quáng.</p>

    <p><strong>Đi xa hơn</strong>: Logpush đẩy log sang R2/S3/dịch vụ ngoài; Tail Worker (một Worker nhận log của Worker khác để xử lý tuỳ ý); xuất trace/log theo OpenTelemetry
    sang hệ thống sẵn có. Công ty đã có Elasticsearch — có thể đưa log Worker về đó để tìm chung với log service Rust/Java.</p>

    <div class="callout"><p>💡 Luôn log một <strong>request ID</strong> xuyên suốt: đọc header <code>cf-ray</code> (Cloudflare gắn cho mỗi request) hoặc tự sinh, rồi truyền sang service phía sau
    trong header. Không có nó, ghép log Worker với log backend là đoán mò.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "Bật Workers Logs", lines: [
      "{",
      "  \"name\": \"order-api\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"observability\": {",
      "    \"enabled\": true,",
      "    \"head_sampling_rate\": 1        // 1 = mọi lần gọi; 0.1 = 10%",
      "  }",
      "}"
    ]},
    { id: "log", label: "Log có cấu trúc", lines: [
      "app.use('*', async (c, next) => {",
      "  const requestId = c.req.header('cf-ray') ?? crypto.randomUUID();",
      "  c.set('requestId', requestId);",
      "  await next();",
      "  console.log({ event: 'http', requestId, method: c.req.method, path: c.req.path, status: c.res.status });",
      "});",
      "",
      "app.post('/api/orders', async (c) => {",
      "  const res = await fetch('https://orders.internal/v1/orders', {",
      "    method: 'POST', body: await c.req.text(),",
      "    headers: { 'X-Request-Id': c.get('requestId') },     // truyền sang backend Rust",
      "  });",
      "  if (!res.ok) console.error({ event: 'upstream_error', requestId: c.get('requestId'), status: res.status });",
      "  return new Response(res.body, res);",
      "});"
    ]},
    { id: "tail", label: "wrangler tail", lines: [
      "npx wrangler tail order-api                          # live, định dạng dễ đọc",
      "npx wrangler tail order-api --status error           # chỉ lần gọi lỗi",
      "npx wrangler tail order-api --search upstream_error  # lọc theo nội dung log",
      "npx wrangler tail order-api --method POST --format json | jq '.logs'",
      "npx wrangler tail order-api --env production"
    ]},
    { id: "java", label: "Spring ↔ Workers", lines: [
      "log.info(\"order {}\", id)  + Logback JSON   <->  console.log({ event: 'order', id })",
      "MDC.put(\"requestId\", ...)                 <->  c.set('requestId') + đưa vào mọi log",
      "kubectl logs -f pod                        <->  wrangler tail",
      "Filebeat -> Elasticsearch -> Kibana        <->  Workers Logs (hoặc Logpush/OTel ra hệ thống ngoài)",
      "Micrometer timer                           <->  CPU time / wall time trong invocation log"
    ]}
  ],

  stageHtml: `
    <div class="node" id="w"><div class="nl">⚡ Worker</div><div class="ns">console.log({ ... })</div></div>
    <div class="arrow" id="a1">↓ runtime thu log + invocation log (CPU, status, outcome)</div>
    <div class="row">
      <div class="node" id="tail"><div class="nl">📺 wrangler tail</div><div class="ns">live · không lưu</div></div>
      <div class="node" id="logs"><div class="nl">🗂️ Workers Logs</div><div class="ns">lưu 3/7 ngày · lọc theo trường</div></div>
    </div>
    <div class="arrow" id="a2">↓ Logpush / OTel (tuỳ chọn)</div>
    <div class="node" id="es"><div class="nl">🔎 Elasticsearch / hệ thống sẵn có</div><div class="ns">ghép với log backend qua requestId</div></div>
  `,
  steps: [
    { title: "1 · Bật lưu log", tab: "cfg", highlight: [5, 6, 7], on: ["logs"],
      desc: "Một khối cấu hình; không cần agent hay SDK." },
    { title: "2 · Log là object, có requestId", tab: "log", highlight: [2, 3, 5], on: ["w", "a1"],
      desc: "Middleware gắn requestId (từ <code>cf-ray</code>) và ghi một dòng có cấu trúc cho mỗi request." },
    { title: "3 · Truyền ID sang backend", tab: "log", highlight: [11, 13], on: ["w", "es"],
      desc: "Service Rust log cùng <code>X-Request-Id</code> → ghép được hành trình của một request." },
    { title: "4 · Debug trực tiếp", tab: "tail", highlight: [1, 2, 3], on: ["tail"],
      desc: "Xem log production theo thời gian thực, lọc theo lỗi hoặc nội dung." },
    { title: "5 · Lưu & điều tra", tab: "java", highlight: [4, 5], on: ["logs", "a2", "es"],
      desc: "Workers Logs cho truy vấn sau sự cố; đưa ra ngoài nếu muốn chung chỗ với log hệ thống." }
  ],

  quiz: [
    { q: "Khác biệt chính giữa wrangler tail và Workers Logs?", options: [
        "Không khác",
        "tail là luồng live không lưu; Workers Logs lưu lại (3/7 ngày) và truy vấn được",
        "tail chỉ cho Rust",
        "Workers Logs chỉ chạy local"
      ], correct: 1, explanation: "Dùng tail để debug ngay, Logs để điều tra sau." },
    { q: "Bật Workers Logs bằng cấu hình nào?", options: [
        "\"logging\": true",
        "\"observability\": { \"enabled\": true }",
        "\"tail\": true",
        "Cài agent"
      ], correct: 1, explanation: "Có thể kèm head_sampling_rate." },
    { q: "Vì sao nên console.log(object) thay vì nối chuỗi?", options: [
        "Nhanh hơn",
        "Workers Logs tách từng trường để lọc/truy vấn, như log JSON có cấu trúc",
        "Chuỗi bị cấm",
        "Tiết kiệm CPU"
      ], correct: 1, explanation: "Lọc theo orderId, requestId dễ dàng." },
    { q: "head_sampling_rate: 0.1 nghĩa là?", options: [
        "Log 10 dòng đầu",
        "Giữ log của khoảng 10% số lần gọi",
        "Lưu 10 ngày",
        "Giảm 10% CPU"
      ], correct: 1, explanation: "Giảm khối lượng log cho service lớn." },
    { q: "Thông tin nào có trong invocation log tự động giúp quyết định tối ưu?", options: [
        "Mật khẩu người dùng",
        "CPU time, wall time, status và outcome (vd exceededCpu)",
        "Mã nguồn",
        "Không có gì"
      ], correct: 1, explanation: "Số liệu thật để quyết định có cần tối ưu hay Rust không." },
    { q: "Header nào Cloudflare gắn cho mỗi request, hợp làm request ID?", options: [
        "x-forwarded-for", "cf-ray", "user-agent", "host"
      ], correct: 1, explanation: "Truyền tiếp sang backend để ghép log." },
    { q: "Thời gian lưu Workers Logs trên gói Free?", options: [
        "1 giờ", "3 ngày", "30 ngày", "Vĩnh viễn"
      ], correct: 1, explanation: "Paid lưu 7 ngày." },
    { q: "Chỉ xem các lần gọi bị lỗi bằng tail?", options: [
        "wrangler tail --errors-only",
        "wrangler tail --status error",
        "wrangler logs --fail",
        "Không lọc được"
      ], correct: 1, explanation: "Có thêm --search, --method, --format json." },
    { q: "Muốn gom log Worker về Elasticsearch của công ty, hướng nào hợp lý?", options: [
        "Worker ghi file rồi Filebeat đọc",
        "Logpush hoặc xuất OpenTelemetry/Tail Worker đẩy sang hệ thống ngoài",
        "SSH vào Worker",
        "Không làm được"
      ], correct: 1, explanation: "Worker không có file hay host để cài agent." }
  ]
});
