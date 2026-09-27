window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "Handler & routing",
  title: "fetch handler — Request, Response, ctx.waitUntil",
  subtitle: "Web Fetch API chuẩn · body là stream, đọc một lần · Response.json · waitUntil sau khi trả · fetch ra ngoài",

  theory: `
    <p>Handler HTTP có chữ ký <code>fetch(request, env, ctx)</code>. Cả ba đều là API chuẩn hoặc rất gần chuẩn:</p>
    <ul>
      <li><code>request</code>: <strong>Request</strong> của Web Fetch API (cùng API trình duyệt): <code>method</code>, <code>url</code>, <code>headers</code>, <code>json()</code>, <code>text()</code>, <code>formData()</code>, <code>arrayBuffer()</code>, <code>body</code> (ReadableStream). Thêm <code>request.cf</code> riêng của Cloudflare.</li>
      <li><code>env</code>: vars, secrets, binding (bài 05, 09).</li>
      <li><code>ctx</code>: <strong>ExecutionContext</strong> — quan trọng nhất là <code>ctx.waitUntil(promise)</code>.</li>
    </ul>

    <p><strong>Body là stream, chỉ đọc được một lần.</strong> Gọi <code>await request.json()</code> rồi <code>await request.text()</code> sẽ lỗi "body already used".
    Cần đọc 2 lần thì <code>request.clone()</code> trước. Tương tự <code>Response</code>. Khác với <code>HttpServletRequest</code> nơi bạn quen có <code>@RequestBody</code> đã parse sẵn.</p>

    <p><strong>Request/Response bất biến ở một số chỗ</strong>: header của request đến thường không sửa trực tiếp được; muốn chuyển tiếp với header mới thì tạo
    <code>new Request(request, { headers })</code>. Response nhận từ <code>fetch()</code> có header bất biến → <code>new Response(res.body, res)</code> để copy rồi sửa.</p>

    <p><strong>ctx.waitUntil</strong>: trong Spring bạn quen <code>@Async</code> hoặc đẩy vào thread pool để việc phụ (ghi log, analytics, ghi cache) không làm chậm response.
    Worker không có thread pool; nếu bạn gọi promise mà không await rồi return, runtime có thể <strong>huỷ</strong> nó ngay khi response trả xong.
    <code>ctx.waitUntil(promise)</code> báo runtime: "giữ isolate sống tới khi promise này xong" — tối đa thêm 30 giây. Không có đảm bảo retry: việc quan trọng thì đưa vào Queue (bài 08).</p>

    <p><strong>Gọi ra ngoài</strong>: dùng <code>fetch()</code> toàn cục. Mỗi lần gọi là một <em>subrequest</em> (có giới hạn số lượng — bài 17).
    Tối đa 6 kết nối đồng thời đang chờ header; vượt thì các lời gọi sau xếp hàng chứ không lỗi.</p>

    <div class="callout"><p>💡 Lỗi không bắt trong handler → client nhận 500 (trang lỗi của Cloudflare). Luôn bọc try/catch ở tầng ngoài cùng (hoặc dùng
    <code>app.onError</code> của Hono — bài 07) để trả JSON lỗi có cấu trúc và log lại.</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "Handler đầy đủ", lines: [
      "export default {",
      "  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {",
      "    const url = new URL(request.url);",
      "    if (request.method === 'POST' && url.pathname === '/orders') {",
      "      const body = await request.json<{ sku: string; qty: number }>();",
      "      if (!body.sku || body.qty <= 0) {",
      "        return Response.json({ error: 'invalid' }, { status: 400 });",
      "      }",
      "      const order = { id: crypto.randomUUID(), ...body };",
      "      ctx.waitUntil(sendAnalytics(env, order));  // không chặn response",
      "      return Response.json(order, { status: 201 });",
      "    }",
      "    return new Response('Not found', { status: 404 });",
      "  },",
      "} satisfies ExportedHandler<Env>;"
    ]},
    { id: "body", label: "Bẫy body", lines: [
      "// SAI: body là stream, đọc 2 lần",
      "const data = await request.json();",
      "const raw  = await request.text();            // TypeError: body already used",
      "",
      "// ĐÚNG: clone trước khi đọc nếu cần 2 bản",
      "const copy = request.clone();",
      "const raw2 = await copy.text();                // ví dụ: kiểm tra chữ ký webhook",
      "const data2 = await request.json();"
    ]},
    { id: "proxy", label: "Proxy + sửa header", lines: [
      "async function proxy(request: Request, env: Env): Promise<Response> {",
      "  const url = new URL(request.url);",
      "  url.hostname = 'legacy.shop.vn';",
      "  const headers = new Headers(request.headers);",
      "  headers.set('X-Internal-Token', env.INTERNAL_TOKEN);",
      "  const upstream = await fetch(new Request(url, { method: request.method, headers, body: request.body }));",
      "  const res = new Response(upstream.body, upstream);   // copy để header sửa được",
      "  res.headers.set('X-Served-By', 'edge');",
      "  return res;                                          // body stream thẳng, không nạp vào RAM",
      "}"
    ]},
    { id: "wait", label: "waitUntil vs quên await", lines: [
      "// SAI: promise treo, có thể bị huỷ khi response trả xong",
      "fetch('https://analytics.example.com/e', { method: 'POST', body });",
      "return new Response('ok');",
      "",
      "// ĐÚNG: báo runtime chờ (tối đa +30 giây sau response)",
      "ctx.waitUntil(fetch('https://analytics.example.com/e', { method: 'POST', body }));",
      "return new Response('ok');",
      "",
      "// Việc KHÔNG được mất (gửi email, trừ kho) -> env.ORDER_QUEUE.send(...) (bài 08)"
    ]},
    { id: "java", label: "Spring ↔ Workers", lines: [
      "@PostMapping(\"/orders\")                <->  if (method === 'POST' && pathname === '/orders')",
      "@RequestBody OrderDto dto              <->  await request.json()",
      "ResponseEntity.status(201).body(o)     <->  Response.json(o, { status: 201 })",
      "@Async void sendAnalytics()            <->  ctx.waitUntil(sendAnalytics())",
      "RestTemplate / WebClient               <->  fetch()"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📥 Request</div><div class="ns">method · url · headers · body(stream)</div></div>
    <div class="arrow" id="a1">↓ fetch(request, env, ctx)</div>
    <div class="node" id="h"><div class="nl">⚡ Handler</div><div class="ns">parse · validate · xử lý</div></div>
    <div class="row">
      <div class="node" id="res"><div class="nl">📤 Response</div><div class="ns">trả client ngay</div></div>
      <div class="node" id="wu"><div class="nl">⏳ ctx.waitUntil</div><div class="ns">chạy tiếp ≤ 30 s</div></div>
    </div>
    <div class="arrow" id="a2">→ fetch() ra ngoài = subrequest</div>
  `,
  steps: [
    { title: "1 · Request chuẩn Web", tab: "basic", highlight: [2, 3, 4], on: ["req", "a1", "h"],
      desc: "Không có annotation; bạn tự so method và pathname (hoặc dùng router — bài 07)." },
    { title: "2 · Đọc body một lần", tab: "body", highlight: [2, 3, 6, 7, 8], on: ["req"],
      desc: "Body là ReadableStream. Cần đọc 2 lần (vd kiểm tra chữ ký webhook rồi parse) thì clone trước." },
    { title: "3 · Trả Response", tab: "basic", highlight: [5, 6, 7, 11], on: ["h", "res"],
      desc: "<code>Response.json()</code> tự đặt Content-Type. Mã lỗi nghiệp vụ tự trả rõ ràng." },
    { title: "4 · Việc phụ sau response", tab: "wait", highlight: [2, 6, 9], on: ["wu"],
      desc: "Không await mà cũng không waitUntil → có thể bị huỷ. Việc bắt buộc thành công → Queue." },
    { title: "5 · Proxy và subrequest", tab: "proxy", highlight: [4, 5, 6, 7, 9], on: ["a2", "res"],
      desc: "Copy header để sửa; stream body thẳng qua để không tốn RAM. Mỗi fetch() là một subrequest." }
  ],

  quiz: [
    { q: "Gọi await request.json() rồi await request.text() trên cùng request. Điều gì xảy ra?", options: [
        "Trả cùng dữ liệu hai lần",
        "Lỗi vì body là stream đã bị đọc; cần request.clone() trước",
        "text() trả chuỗi rỗng không lỗi",
        "Runtime tự cache body"
      ], correct: 1, explanation: "Body của Request/Response chỉ tiêu thụ được một lần." },
    { q: "ctx.waitUntil(promise) dùng để làm gì?", options: [
        "Chặn response cho tới khi promise xong",
        "Cho phép promise tiếp tục chạy sau khi đã trả response (tối đa thêm 30 giây)",
        "Retry promise khi lỗi",
        "Chạy promise trên thread khác"
      ], correct: 1, explanation: "Không có retry hay đảm bảo — chỉ giữ isolate sống thêm." },
    { q: "Gọi fetch() không await, không waitUntil rồi return Response. Rủi ro?", options: [
        "Không rủi ro",
        "Promise có thể bị huỷ khi request kết thúc, việc gửi đi có thể không xảy ra",
        "Response bị chậm",
        "Lỗi biên dịch"
      ], correct: 1, explanation: "Runtime không đợi promise 'mồ côi'." },
    { q: "Muốn sửa header của response nhận từ fetch() upstream, cách đúng?", options: [
        "upstream.headers.set(...) trực tiếp luôn được",
        "Tạo new Response(upstream.body, upstream) rồi sửa headers của bản mới",
        "Không thể sửa",
        "Dùng response.setHeader"
      ], correct: 1, explanation: "Header của response từ fetch là immutable." },
    { q: "Việc 'gửi email xác nhận đơn hàng' nên làm bằng gì?", options: [
        "ctx.waitUntil vì nhanh",
        "Đưa message vào Queue để có retry/DLQ",
        "Biến global",
        "setTimeout"
      ], correct: 1, explanation: "waitUntil không có đảm bảo giao; Queues có at-least-once và retry." },
    { q: "Response.json(obj, { status: 201 }) tương đương gì trong Spring?", options: [
        "@ResponseStatus(200)",
        "ResponseEntity.status(201).body(obj) với Content-Type JSON",
        "HttpServletResponse.sendRedirect",
        "@ExceptionHandler"
      ], correct: 1, explanation: "Tự serialize và đặt Content-Type: application/json." },
    { q: "Truyền request.body (stream) thẳng vào fetch upstream có lợi gì?", options: [
        "Không có lợi",
        "Không phải nạp cả body vào bộ nhớ 128 MB; dữ liệu chảy qua",
        "Tự nén body",
        "Tự retry"
      ], correct: 1, explanation: "Streaming là cách xử lý file lớn trong giới hạn bộ nhớ." },
    { q: "Lỗi ném ra mà không ai bắt trong fetch handler dẫn tới?", options: [
        "Worker tự restart và retry",
        "Client nhận lỗi 500 từ Cloudflare, không có body JSON có cấu trúc",
        "Request bị treo mãi",
        "Response 200 rỗng"
      ], correct: 1, explanation: "Nên bắt lỗi ở tầng ngoài cùng để trả lỗi rõ ràng và log." },
    { q: "Số kết nối ra ngoài đồng thời đang chờ header tối đa mỗi request?", options: [
        "1", "6", "100", "Không giới hạn"
      ], correct: 1, explanation: "Vượt 6 thì các lời gọi sau đợi, không bị lỗi." }
  ]
});
