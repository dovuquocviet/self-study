window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Handler & routing",
  title: "Routing với Hono — 'Spring MVC' nhỏ gọn cho Workers",
  subtitle: "app.get/post · path param · middleware · validator · onError · Bindings có kiểu",

  theory: `
    <p>Viết <code>if (pathname === ...)</code> được vài route là rối. <strong>Hono</strong> là framework web nhỏ (vài chục KB), viết trên Web Fetch API chuẩn,
    nên chạy tự nhiên trên Workers (cũng chạy trên Bun, Deno, Node). Một app Hono <em>chính là</em> một object có hàm <code>fetch</code> → export default thẳng.</p>

    <table>
      <tr><th>Spring MVC</th><th>Hono</th></tr>
      <tr><td><code>@GetMapping("/products/{id}")</code></td><td><code>app.get('/products/:id', c =&gt; ...)</code></td></tr>
      <tr><td><code>@PathVariable</code> / <code>@RequestParam</code></td><td><code>c.req.param('id')</code> / <code>c.req.query('page')</code></td></tr>
      <tr><td><code>@RequestBody</code> + <code>@Valid</code></td><td><code>zValidator('json', schema)</code> rồi <code>c.req.valid('json')</code></td></tr>
      <tr><td>Filter / HandlerInterceptor</td><td><code>app.use(middleware)</code> với <code>await next()</code></td></tr>
      <tr><td><code>@ControllerAdvice</code></td><td><code>app.onError</code>, <code>app.notFound</code></td></tr>
      <tr><td>Router con / <code>@RequestMapping("/admin")</code></td><td><code>app.route('/admin', adminApp)</code></td></tr>
    </table>

    <p><strong>Context <code>c</code></strong> gom mọi thứ: <code>c.req</code> (wrapper quanh Request), <code>c.env</code> (bindings), <code>c.executionCtx</code> (có <code>waitUntil</code>),
    <code>c.json()</code>/<code>c.text()</code> để trả response, <code>c.set()</code>/<code>c.get()</code> để middleware truyền dữ liệu cho handler (giống request attribute).</p>

    <p><strong>Kiểu cho bindings</strong>: khai báo <code>new Hono&lt;{ Bindings: Env; Variables: { userId: string } }&gt;()</code> để <code>c.env.DB</code> và <code>c.get('userId')</code> có kiểu.</p>

    <p><strong>Middleware chạy theo mô hình "củ hành"</strong>: code trước <code>await next()</code> chạy khi đi vào, code sau chạy khi đi ra — giống
    <code>preHandle</code>/<code>postHandle</code> gộp làm một. Hono có sẵn <code>cors()</code>, <code>logger()</code>, <code>bearerAuth()</code>, <code>jwt()</code>, <code>etag()</code>…</p>

    <div class="callout"><p>💡 Không có DI container, không có component scan. "Service" chỉ là hàm/module bình thường nhận <code>env</code> hoặc binding cụ thể làm tham số —
    dễ test hơn vì bạn truyền mock vào trực tiếp.</p></div>
  `,

  codeTabs: [
    { id: "app", label: "src/index.ts", lines: [
      "import { Hono } from 'hono';",
      "import { cors } from 'hono/cors';",
      "import { HTTPException } from 'hono/http-exception';",
      "",
      "type Vars = { userId: string };",
      "const app = new Hono<{ Bindings: Env; Variables: Vars }>();",
      "",
      "app.use('/api/*', cors());",
      "app.use('/api/*', async (c, next) => {",
      "  const token = c.req.header('Authorization')?.replace('Bearer ', '');",
      "  const userId = token ? await verify(token, c.env.JWT_SECRET) : null;",
      "  if (!userId) throw new HTTPException(401, { message: 'unauthorized' });",
      "  c.set('userId', userId);",
      "  await next();",
      "});",
      "",
      "app.get('/api/products/:id', async (c) => {",
      "  const id = c.req.param('id');",
      "  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();",
      "  return row ? c.json(row) : c.json({ error: 'not_found' }, 404);",
      "});",
      "",
      "export default app;"
    ]},
    { id: "valid", label: "Validator (zod)", lines: [
      "import { zValidator } from '@hono/zod-validator';",
      "import { z } from 'zod';",
      "",
      "const OrderSchema = z.object({",
      "  sku: z.string().min(1),",
      "  qty: z.number().int().positive(),",
      "});",
      "",
      "app.post('/api/orders', zValidator('json', OrderSchema), async (c) => {",
      "  const order = c.req.valid('json');          // đã đúng kiểu { sku, qty }",
      "  const userId = c.get('userId');             // do middleware set",
      "  c.executionCtx.waitUntil(audit(c.env, userId, order));",
      "  return c.json({ ok: true }, 201);",
      "});"
    ]},
    { id: "err", label: "onError & notFound", lines: [
      "app.onError((err, c) => {",
      "  if (err instanceof HTTPException) {",
      "    return c.json({ error: err.message }, err.status);",
      "  }",
      "  console.error({ msg: 'unhandled', path: c.req.path, err: String(err) });",
      "  return c.json({ error: 'internal' }, 500);",
      "});",
      "",
      "app.notFound((c) => c.json({ error: 'route_not_found' }, 404));"
    ]},
    { id: "multi", label: "Nhiều handler", lines: [
      "// Hono lo fetch; các handler khác đặt cạnh nhau trong cùng object export",
      "export default {",
      "  fetch: app.fetch,",
      "  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {",
      "    ctx.waitUntil(cleanupExpiredCarts(env));",
      "  },",
      "} satisfies ExportedHandler<Env>;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📥 GET /api/products/42</div><div class="ns">Authorization: Bearer ...</div></div>
    <div class="arrow" id="a1">↓ app.fetch</div>
    <div class="node" id="mw1"><div class="nl">🧅 cors()</div><div class="ns">middleware 1</div></div>
    <div class="node" id="mw2"><div class="nl">🧅 auth middleware</div><div class="ns">c.set('userId')</div></div>
    <div class="arrow" id="a2">↓ khớp route :id</div>
    <div class="node" id="h"><div class="nl">🎯 handler</div><div class="ns">c.req.param · c.env.DB · c.json</div></div>
    <div class="node" id="err"><div class="nl">🧯 onError</div><div class="ns">HTTPException → JSON</div></div>
  `,
  steps: [
    { title: "1 · App Hono là một fetch handler", tab: "app", highlight: [1, 6, 23], on: ["req", "a1"],
      desc: "<code>export default app</code> được vì app có hàm <code>fetch(request, env, ctx)</code>." },
    { title: "2 · Middleware kiểu củ hành", tab: "app", highlight: [8, 9, 10, 11, 12, 13, 14], on: ["mw1", "mw2"],
      desc: "Xác thực, gắn <code>userId</code> vào context, rồi <code>await next()</code>. Ném HTTPException để dừng sớm." },
    { title: "3 · Route có param + binding có kiểu", tab: "app", highlight: [17, 18, 19, 20], on: ["a2", "h"],
      desc: "<code>c.env.DB</code> có kiểu D1Database nhờ generic <code>Bindings: Env</code>." },
    { title: "4 · Validate body như @Valid", tab: "valid", highlight: [4, 5, 6, 9, 10, 11], on: ["h"],
      desc: "Body sai schema → validator tự trả 400; handler chỉ nhận dữ liệu hợp lệ, có kiểu." },
    { title: "5 · Xử lý lỗi tập trung", tab: "err", highlight: [1, 2, 3, 5, 6, 9], on: ["err"],
      desc: "Giống @ControllerAdvice: lỗi nghiệp vụ trả đúng mã, lỗi lạ log có cấu trúc và trả 500 gọn." },
    { title: "6 · Ghép với cron/queue handler", tab: "multi", highlight: [2, 3, 4, 5], on: ["h"],
      desc: "Khi cần thêm <code>scheduled</code>/<code>queue</code>, export object và gán <code>fetch: app.fetch</code>." }
  ],

  quiz: [
    { q: "Vì sao có thể viết export default app với app là Hono?", options: [
        "Hono tự đăng ký route với Cloudflare",
        "App Hono có method fetch(request, env, ctx) đúng chữ ký handler mà Workers gọi",
        "Wrangler biên dịch Hono thành Java",
        "Không thể, phải bọc thêm"
      ], correct: 1, explanation: "Hono xây trên Fetch API chuẩn." },
    { q: "Tương đương @PathVariable id trong Hono?", options: [
        "c.req.query('id')", "c.req.param('id')", "c.env.id", "c.get('id')"
      ], correct: 1, explanation: "query() là cho query string (@RequestParam)." },
    { q: "Middleware Hono muốn truyền userId cho handler phía sau dùng gì?", options: [
        "Biến global", "c.set('userId', v) và c.get('userId')", "Header giả", "env.userId = v"
      ], correct: 1, explanation: "Biến global bị chia sẻ giữa request (bài 02) — tuyệt đối tránh." },
    { q: "Code viết SAU await next() trong middleware chạy khi nào?", options: [
        "Không bao giờ",
        "Sau khi handler và các middleware sau đã chạy xong (lượt đi ra)",
        "Trước handler",
        "Song song với handler"
      ], correct: 1, explanation: "Mô hình củ hành: vào rồi ra." },
    { q: "Tương đương @ControllerAdvice?", options: [
        "app.use", "app.onError (và app.notFound)", "app.route", "zValidator"
      ], correct: 1, explanation: "Xử lý lỗi tập trung cho mọi route." },
    { q: "Làm sao để c.env.DB có kiểu D1Database?", options: [
        "Tự ép kiểu any",
        "new Hono<{ Bindings: Env }>() với Env do wrangler types sinh",
        "Không cần, Hono tự đoán",
        "Import D1 từ hono/d1"
      ], correct: 1, explanation: "Generic Bindings khai báo kiểu cho c.env." },
    { q: "Body không khớp schema zValidator. Kết quả mặc định?", options: [
        "Handler vẫn chạy với dữ liệu sai",
        "Validator trả 400 trước khi vào handler",
        "Worker crash",
        "Trả 500"
      ], correct: 1, explanation: "Handler chỉ nhận c.req.valid('json') đã hợp lệ." },
    { q: "Muốn vừa có routes Hono vừa có cron handler trong cùng Worker?", options: [
        "Không được, phải tách 2 Worker",
        "Export object { fetch: app.fetch, scheduled(...) {...} }",
        "app.cron(...)",
        "Đặt cron trong middleware"
      ], correct: 1, explanation: "Mỗi loại sự kiện là một handler trong object export default." },
    { q: "Trong Hono, gọi waitUntil từ handler bằng gì?", options: [
        "c.waitUntil", "c.executionCtx.waitUntil(...)", "app.waitUntil", "Không gọi được"
      ], correct: 1, explanation: "c.executionCtx chính là ctx của Workers." }
  ]
});
