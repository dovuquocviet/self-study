window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Wrangler & cấu hình",
  title: "Environments, biến môi trường & secrets",
  subtitle: "env.staging / env.production · vars không thừa kế · wrangler secret put · .dev.vars · đọc env ở đâu",

  theory: `
    <p>Trong Spring bạn có <code>application-staging.yml</code> + <code>--spring.profiles.active=staging</code>. Trong Wrangler là khối <code>"env"</code> trong wrangler.jsonc
    và cờ <code>--env staging</code>. Mỗi environment deploy thành <strong>một Worker riêng</strong> (mặc định tên <code>&lt;name&gt;-&lt;env&gt;</code>), với binding riêng.</p>

    <p><strong>Quy tắc thừa kế — chỗ hay sai nhất</strong></p>
    <ul>
      <li><em>Thừa kế</em> từ top-level: <code>main</code>, <code>compatibility_date</code>, <code>compatibility_flags</code>, <code>routes</code>…</li>
      <li><em>KHÔNG thừa kế</em>: <code>vars</code> và mọi binding (<code>kv_namespaces</code>, <code>d1_databases</code>, <code>r2_buckets</code>, <code>queues</code>, <code>durable_objects</code>, <code>services</code>…).
      Phải khai báo lại trong từng env. Đây là cố ý: staging không được vô tình dùng DB production.</li>
    </ul>

    <p><strong>vars vs secrets</strong></p>
    <table>
      <tr><th></th><th><code>vars</code></th><th>Secret</th></tr>
      <tr><td>Khai báo</td><td>Trong wrangler.jsonc (commit vào git)</td><td><code>wrangler secret put NAME</code> (không nằm trong git)</td></tr>
      <tr><td>Thấy trên dashboard</td><td>Có, dạng rõ</td><td>Chỉ thấy tên, không thấy giá trị</td></tr>
      <tr><td>Local dev</td><td>Lấy từ config</td><td>File <code>.dev.vars</code> (hoặc <code>.env</code>) — phải nằm trong .gitignore</td></tr>
      <tr><td>Trong code</td><td colspan="2">Đều là <code>env.NAME</code> (chuỗi); vars có thể là object JSON</td></tr>
    </table>
    <p>Secret gắn theo Worker + environment: <code>wrangler secret put STRIPE_KEY --env production</code>. File local theo env: <code>.dev.vars.staging</code>.</p>

    <p><strong>Đọc env ở đâu?</strong> Cách truyền thống: tham số <code>env</code> của handler, truyền xuống hàm cần dùng (giống constructor injection).
    Runtime hiện đại cho phép <code>import { env } from "cloudflare:workers"</code> để đọc ở cấp module. Có <code>nodejs_compat</code> thì <code>process.env</code> cũng được điền sẵn (mặc định từ compatibility_date 2025-04-01).
    Dù cách nào, đừng đọc secret rồi cache vào biến global lẫn giữa các environment.</p>

    <div class="callout"><p>💡 Không có "file .properties được đọc lúc khởi động". Mọi cấu hình đi qua <code>env</code> — một object do runtime tạo, chứa cả chuỗi (vars/secret)
    lẫn <em>đối tượng</em> (KV, D1, Queue…). Bài 09 sẽ giải thích vì sao Cloudflare gọi chung là <strong>binding</strong>.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "wrangler.jsonc với env", lines: [
      "{",
      "  \"name\": \"shop-api\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"vars\": { \"APP_ENV\": \"dev\", \"PAGE_SIZE\": \"20\" },",
      "  \"d1_databases\": [{ \"binding\": \"DB\", \"database_name\": \"shop-dev\", \"database_id\": \"<DEV_ID>\" }],",
      "  \"env\": {",
      "    \"staging\": {",
      "      \"vars\": { \"APP_ENV\": \"staging\", \"PAGE_SIZE\": \"20\" },",
      "      \"d1_databases\": [{ \"binding\": \"DB\", \"database_name\": \"shop-stg\", \"database_id\": \"<STG_ID>\" }]",
      "    },",
      "    \"production\": {",
      "      \"vars\": { \"APP_ENV\": \"production\", \"PAGE_SIZE\": \"50\" },",
      "      \"d1_databases\": [{ \"binding\": \"DB\", \"database_name\": \"shop-prod\", \"database_id\": \"<PROD_ID>\" }]",
      "    }",
      "  }",
      "}"
    ]},
    { id: "cli", label: "Lệnh", lines: [
      "npx wrangler dev                              # top-level (dev)",
      "npx wrangler dev --env staging                # dùng khối env.staging",
      "npx wrangler deploy --env production          # deploy Worker 'shop-api-production'",
      "",
      "npx wrangler secret put JWT_SECRET --env production   # nhập giá trị qua prompt",
      "npx wrangler secret list --env production",
      "",
      "# .dev.vars (local, KHÔNG commit)",
      "JWT_SECRET=local-only-secret"
    ]},
    { id: "code", label: "Dùng trong code", lines: [
      "interface Env {                 // thực tế do 'wrangler types' sinh",
      "  APP_ENV: string;",
      "  PAGE_SIZE: string;",
      "  JWT_SECRET: string;            // secret",
      "  DB: D1Database;                // binding",
      "}",
      "",
      "export default {",
      "  async fetch(request: Request, env: Env): Promise<Response> {",
      "    const size = Number(env.PAGE_SIZE);        // vars là chuỗi -> tự parse",
      "    const ok = await verifyJwt(request, env.JWT_SECRET);",
      "    if (!ok) return new Response('Unauthorized', { status: 401 });",
      "    const { results } = await env.DB.prepare('SELECT * FROM products LIMIT ?').bind(size).all();",
      "    return Response.json({ env: env.APP_ENV, results });",
      "  },",
      "};"
    ]},
    { id: "java", label: "Spring ↔ Workers", lines: [
      "application.yml                 <->  top-level vars + bindings",
      "application-staging.yml         <->  \"env\": { \"staging\": { ... } }",
      "--spring.profiles.active=prod   <->  wrangler deploy --env production",
      "@Value(\"${jwt.secret}\")         <->  env.JWT_SECRET (wrangler secret put)",
      "Vault / AWS Secrets Manager     <->  Worker secrets hoặc Secrets Store (cấp account)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cfg"><div class="nl">📄 wrangler.jsonc</div><div class="ns">top-level + env.staging + env.production</div></div>
    <div class="row">
      <div class="node" id="stg"><div class="nl">🧪 shop-api-staging</div><div class="ns">vars/DB riêng</div></div>
      <div class="node" id="prd"><div class="nl">🚀 shop-api-production</div><div class="ns">vars/DB riêng</div></div>
    </div>
    <div class="arrow" id="a1">↓ secret put (ngoài git)</div>
    <div class="node" id="sec"><div class="nl">🔐 Secret</div><div class="ns">mã hoá, chỉ thấy tên</div></div>
    <div class="arrow" id="a2">↓ runtime gộp lại</div>
    <div class="node" id="env"><div class="nl">🧰 env</div><div class="ns">env.APP_ENV · env.JWT_SECRET · env.DB</div></div>
  `,
  steps: [
    { title: "1 · Một file, nhiều environment", tab: "cfg", highlight: [7, 8, 12], on: ["cfg"],
      desc: "Mỗi khối trong <code>env</code> khi deploy trở thành một Worker riêng." },
    { title: "2 · vars và binding không thừa kế", tab: "cfg", highlight: [5, 6, 9, 10, 13, 14], on: ["stg", "prd"],
      desc: "Phải lặp lại <code>vars</code> và <code>d1_databases</code> ở từng env — thiếu là <code>env.DB</code> undefined." },
    { title: "3 · Secret đi đường riêng", tab: "cli", highlight: [5, 6, 8, 9], on: ["a1", "sec"],
      desc: "Giá trị nhập qua prompt, không nằm trong git. Local dùng <code>.dev.vars</code>." },
    { title: "4 · Mọi thứ hội tụ vào env", tab: "code", highlight: [1, 4, 5, 10, 11, 13], on: ["a2", "env"],
      desc: "vars/secret là chuỗi, binding là object có method. Nhận qua tham số <code>env</code> của handler." },
    { title: "5 · Đối chiếu với Spring profiles", tab: "java", highlight: [2, 3, 4], on: ["env"],
      desc: "Cùng ý tưởng profile, nhưng mỗi env là một Worker độc lập với tài nguyên riêng." }
  ],

  quiz: [
    { q: "Deploy với --env staging tạo ra gì (mặc định)?", options: [
        "Cùng Worker, chỉ đổi biến",
        "Một Worker riêng tên <name>-staging",
        "Một branch git",
        "Một region mới"
      ], correct: 1, explanation: "Mỗi environment là một Worker riêng với binding riêng." },
    { q: "Khai báo kv_namespaces ở top-level, deploy --env production nhưng không khai lại trong env.production. Kết quả?", options: [
        "Production dùng KV của top-level",
        "Binding không có trong production (env.X undefined) — binding không thừa kế",
        "Wrangler tự tạo KV mới",
        "Lỗi cú pháp"
      ], correct: 1, explanation: "vars và binding là non-inheritable (Wrangler thường cảnh báo khi build)." },
    { q: "Nơi đặt secret cho wrangler dev local?", options: [
        "Trong vars của wrangler.jsonc",
        "File .dev.vars (hoặc .env) không commit",
        "Hard-code trong code",
        "Biến global"
      ], correct: 1, explanation: "Có thể tách theo env: .dev.vars.staging." },
    { q: "Khác biệt giữa vars và secret?", options: [
        "vars nhanh hơn",
        "vars nằm trong config (git, hiện rõ trên dashboard); secret đặt qua wrangler secret put, được mã hoá và không hiện giá trị",
        "secret chỉ dùng được trong Rust",
        "Không khác"
      ], correct: 1, explanation: "Trong code cả hai đều là env.NAME." },
    { q: "env.PAGE_SIZE khai báo \"20\" trong vars. Kiểu trong code là gì?", options: [
        "number", "string — cần tự Number(...)", "BigInt", "boolean"
      ], correct: 1, explanation: "Giá trị chuỗi giữ nguyên là chuỗi; vars dạng object JSON thì thành object." },
    { q: "Lệnh đặt secret cho production?", options: [
        "wrangler vars set JWT_SECRET",
        "wrangler secret put JWT_SECRET --env production",
        "export JWT_SECRET=...",
        "wrangler deploy --secret JWT_SECRET"
      ], correct: 1, explanation: "Giá trị được nhập qua prompt tương tác." },
    { q: "Vì sao Wrangler cố ý không cho binding thừa kế sang environment?", options: [
        "Do giới hạn kỹ thuật",
        "Tránh staging vô tình trỏ vào tài nguyên production",
        "Để tiết kiệm tiền",
        "Vì JSON không hỗ trợ thừa kế"
      ], correct: 1, explanation: "An toàn dữ liệu quan trọng hơn sự tiện lợi." },
    { q: "Tương đương của @Value(\"${jwt.secret}\") trong Worker là?", options: [
        "System.getenv", "env.JWT_SECRET", "process.argv", "import secret from './secret'"
      ], correct: 1, explanation: "Mọi cấu hình đến qua object env." },
    { q: "Ngoài tham số env của handler, cách nào khác đọc binding ở cấp module trên runtime hiện đại?", options: [
        "import { env } from \"cloudflare:workers\"",
        "require('env')",
        "window.env",
        "Không có cách nào"
      ], correct: 0, explanation: "Runtime cung cấp env qua module cloudflare:workers; với nodejs_compat còn có process.env." }
  ]
});
