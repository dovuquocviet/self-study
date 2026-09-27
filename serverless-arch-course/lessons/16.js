window.LESSONS.push({
  id: "16",
  phase: "5", phaseName: "Vận hành: hiệu năng, quan sát, chi phí",
  title: "Cold start & hiệu năng: isolate, round-trip và vị trí",
  subtitle: "Isolate vs container/JVM · global scope nhẹ · Promise.all · waitUntil · Cache API · Smart Placement",

  theory: `
    <p><strong>Cold start</strong> ở AWS Lambda + Java có thể vài giây: dựng container, khởi JVM, nạp Spring context. Workers dùng <strong>V8 isolate</strong>:
    nhiều isolate chung một tiến trình, tạo mới chỉ tốn vài mili-giây, và Cloudflare còn bắt đầu nạp Worker ngay trong lúc bắt tay TLS.
    Vì vậy trên Workers, cold start hiếm khi là nút thắt — <strong>nút thắt thật là số round-trip mạng và khoảng cách tới dữ liệu</strong>.</p>

    <p><strong>Cái vẫn làm cold start chậm</strong></p>
    <ul>
      <li>Bundle lớn (nhiều thư viện, Wasm lớn — ví dụ Worker viết bằng Rust qua <code>workers-rs</code>): phải tải và biên dịch.</li>
      <li>Việc nặng ở global scope (parse JSON lớn, dựng bảng tra) — có giới hạn startup 1 giây.</li>
      <li>DO lần đầu thức dậy: nạp object, chạy constructor (migration) — giữ constructor gọn.</li>
    </ul>

    <p><strong>Checklist hiệu năng theo thứ tự tác động</strong></p>
    <ol>
      <li><strong>Đếm round-trip tuần tự</strong> tới dịch vụ xa. 4 lời gọi nối tiếp × 150 ms = 600 ms. Gọi song song bằng <code>Promise.all</code> khi độc lập; gộp query.</li>
      <li><strong>Đưa code tới gần dữ liệu</strong>: Smart Placement (<code>"placement": { "mode": "smart" }</code>) để Cloudflare chạy Worker gần backend mà nó gọi nhiều;
      hoặc đẩy logic nhiều-query vào một DO/service đặt cạnh DB.</li>
      <li><strong>Cache</strong>: Cache API (<code>caches.default</code>) theo PoP, KV cho dữ liệu đọc nhiều toàn cầu, Hyperdrive cache cho query Postgres.</li>
      <li><strong>Làm sau khi trả lời</strong>: <code>ctx.waitUntil(promise)</code> cho log, analytics, ghi cache — user không phải chờ.</li>
      <li><strong>Stream</strong> response lớn thay vì dựng hết trong RAM (128 MB).</li>
    </ol>

    <div class="callout"><p>💡 Smart Placement đổi độ trễ "user ↔ Worker" lấy độ trễ "Worker ↔ backend". Chỉ có lợi khi một request gọi backend <em>nhiều lần</em>.
    Worker chỉ đọc cache/KV thì nên ở edge. Đo trước và sau, đừng bật theo cảm tính.</p></div>

    <p><strong>So với Spring</strong>: bạn quen tối ưu JVM (heap, GC, thread pool). Trên Workers không có nút nào như vậy; tối ưu gần như hoàn toàn là <em>kiến trúc</em>: ít round-trip, đúng vị trí, cache đúng tầng.</p>
  `,

  codeTabs: [
    { id: "seq", label: "① Tuần tự (chậm)", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const user = await env.USERS.get(uid);            // 40 ms",
      "    const orders = await fetchOrders(env, uid);        // 180 ms (origin xa)",
      "    const recs = await fetchRecs(env, uid);            // 150 ms",
      "    const banner = await env.KV.get('banner');         // 5 ms",
      "    await logAnalytics(env, req);                      // 60 ms — user phải chờ!",
      "    return Response.json({ user, orders, recs, banner });   // ≈ 435 ms",
      "  }",
      "};"
    ]},
    { id: "par", label: "② Song song + waitUntil", lines: [
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const [user, orders, recs, banner] = await Promise.all([",
      "      env.USERS.get(uid), fetchOrders(env, uid), fetchRecs(env, uid), env.KV.get('banner')",
      "    ]);                                                // ≈ max = 180 ms",
      "    ctx.waitUntil(logAnalytics(env, req));             // chạy sau khi đã trả response",
      "    return Response.json({ user, orders, recs, banner });",
      "  }",
      "};"
    ]},
    { id: "cache", label: "③ Cache API", lines: [
      "async function cachedCatalog(req, env, ctx) {",
      "  const cache = caches.default;",
      "  const key = new Request(new URL('/catalog/v1', req.url));",
      "  let res = await cache.match(key);",
      "  if (res) return res;                               // trúng cache ở PoP này",
      "  res = await fetch('https://catalog.internal.example.com/v1');",
      "  res = new Response(res.body, res);",
      "  res.headers.set('Cache-Control', 's-maxage=60');",
      "  ctx.waitUntil(cache.put(key, res.clone()));",
      "  return res;",
      "}"
    ]},
    { id: "cfg", label: "④ Smart Placement & global nhẹ", lines: [
      "// wrangler.jsonc",
      "\"placement\": { \"mode\": \"smart\" }",
      "",
      "// global scope: chỉ khai báo, không làm việc nặng",
      "let rules;                                   // nạp lười",
      "async function getRules(env) {",
      "  return rules ??= await env.CONFIG.get('rules', { type: 'json' });",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="iso"><div class="nl">⚡ Isolate mới</div><div class="ns">vài ms, nạp trong lúc bắt tay TLS</div></div>
      <div class="node" id="jvm"><div class="nl">🐢 Container + JVM</div><div class="ns">có thể vài giây</div></div>
    </div>
    <div class="arrow" id="a1">↓ nút thắt thật: round-trip</div>
    <div class="row">
      <div class="node" id="seq"><div class="nl">⛓️ Tuần tự</div><div class="ns">40+180+150+5+60 ≈ 435 ms</div></div>
      <div class="node" id="par"><div class="nl">🔀 Song song</div><div class="ns">max ≈ 180 ms, log để sau</div></div>
    </div>
    <div class="arrow" id="a2">↓ vẫn chậm vì origin xa?</div>
    <div class="node" id="place"><div class="nl">📍 Cache hoặc Smart Placement</div><div class="ns">đưa dữ liệu tới gần, hoặc code tới gần dữ liệu</div></div>
  `,
  steps: [
    { title: "1 · Cold start không phải vấn đề chính", tab: "cfg", highlight: [4, 5, 6, 7], on: ["iso", "jvm"],
      desc: "Isolate khởi động rất nhanh. Chỉ cần giữ global scope nhẹ và nạp lười." },
    { title: "2 · Đếm round-trip", tab: "seq", highlight: [3, 4, 5, 6, 7, 8], on: ["a1", "seq"],
      desc: "Các await nối tiếp cộng dồn độ trễ. Việc analytics còn bắt user chờ." },
    { title: "3 · Song song + waitUntil", tab: "par", highlight: [3, 4, 5, 6], on: ["par"],
      desc: "Độ trễ ≈ lời gọi chậm nhất. Log chạy sau khi trả response." },
    { title: "4 · Cache đúng tầng", tab: "cache", highlight: [2, 4, 5, 8, 9], on: ["a2", "place"],
      desc: "Cache API lưu theo PoP. Dữ liệu cá nhân hoá thì không cache kiểu này." },
    { title: "5 · Đưa code tới gần backend", tab: "cfg", highlight: [2], on: ["place"],
      desc: "Smart Placement có lợi khi mỗi request gọi backend nhiều lần. Đo trước khi bật." }
  ],

  quiz: [
    { q: "Vì sao cold start của Workers thường rất nhỏ so với Lambda + Java?", options: [
        "Vì Workers không có cold start",
        "Vì dùng V8 isolate trong tiến trình sẵn có, không dựng container/JVM",
        "Vì Workers chạy trên GPU",
        "Vì cache toàn bộ response"
      ], correct: 1, explanation: "Và Worker được nạp sớm trong lúc bắt tay TLS." },
    { q: "Trên Workers, nút thắt hiệu năng phổ biến nhất thường là?", options: [
        "GC", "Số round-trip mạng tuần tự và khoảng cách tới dữ liệu", "Thread pool", "Heap size"
      ], correct: 1, explanation: "Tối ưu là tối ưu kiến trúc." },
    { q: "4 lời gọi độc lập 40/180/150/5 ms. Dùng Promise.all thì tổng xấp xỉ?", options: [
        "375 ms", "180 ms", "40 ms", "5 ms"
      ], correct: 1, explanation: "Bằng lời gọi chậm nhất." },
    { q: "ctx.waitUntil(p) dùng để làm gì?", options: [
        "Chặn response tới khi p xong",
        "Cho p tiếp tục chạy sau khi response đã gửi, runtime không huỷ nó",
        "Retry p",
        "Chạy p trong DO"
      ], correct: 1, explanation: "Hợp cho log, analytics, ghi cache." },
    { q: "Smart Placement có lợi khi nào?", options: [
        "Worker chỉ đọc KV",
        "Mỗi request gọi backend tập trung (một region) nhiều lần",
        "Luôn luôn",
        "Khi dùng WebSocket"
      ], correct: 1, explanation: "Đổi độ trễ user↔Worker lấy Worker↔backend." },
    { q: "Điều gì làm Worker khởi động chậm?", options: [
        "Dùng Promise.all",
        "Bundle/Wasm lớn và việc nặng ở global scope",
        "Dùng KV",
        "Dùng ctx.waitUntil"
      ], correct: 1, explanation: "Giới hạn startup là 1 giây." },
    { q: "Cache API (caches.default) lưu ở đâu?", options: [
        "Toàn cầu, đồng bộ mọi PoP",
        "Theo từng PoP (data center)",
        "Trong Durable Object",
        "Trong trình duyệt"
      ], correct: 1, explanation: "Muốn toàn cầu → KV." },
    { q: "Response 80 MB dựng hết trong bộ nhớ rồi mới trả có rủi ro gì?", options: [
        "Không có",
        "Dễ chạm giới hạn 128 MB bộ nhớ; nên stream",
        "Bị tính phí egress",
        "Bị cache sai"
      ], correct: 1, explanation: "Dùng ReadableStream/pipe thẳng từ nguồn." },
    { q: "Tối ưu hiệu năng Workers khác tối ưu Spring chủ yếu ở đâu?", options: [
        "Tinh chỉnh GC",
        "Không có tham số runtime để chỉnh; tối ưu bằng kiến trúc: ít round-trip, đúng vị trí, cache đúng tầng",
        "Tăng số thread",
        "Tăng heap"
      ], correct: 1, explanation: "Runtime do Cloudflare quản lý." }
  ]
});
