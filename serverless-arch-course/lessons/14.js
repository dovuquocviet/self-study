window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Kết nối hệ thống",
  title: "Service bindings & RPC giữa các Worker",
  subtitle: "WorkerEntrypoint · named entrypoint · không qua Internet · promise pipelining · RpcTarget",

  theory: `
    <p>Trong microservice Java, service A gọi service B qua HTTP/gRPC: DNS, load balancer, TLS, serialize JSON, retry, timeout.
    Giữa các Worker, <strong>service binding</strong> cho phép gọi thẳng như gọi hàm: <code>await env.AUTH.verify(token)</code>.</p>

    <p><strong>Đặc điểm</strong></p>
    <ul>
      <li><strong>Không đi qua Internet</strong>: Worker đích thường chạy ngay trên cùng máy, cùng luồng → gần như không thêm độ trễ.</li>
      <li><strong>Không cần URL công khai</strong>: Worker nội bộ có thể tắt <code>workers_dev</code> và không gắn route → chỉ gọi được qua binding. Binding chính là quyền.</li>
      <li><strong>Không tính thêm phí request</strong> cho lời gọi qua binding (vẫn tính CPU theo gói Standard).</li>
      <li>Mỗi Worker deploy độc lập, có version riêng — vẫn là microservice, chỉ bỏ đi phần mạng.</li>
    </ul>

    <p><strong>Hai kiểu gọi</strong>: <code>env.SVC.fetch(request)</code> (HTTP kiểu cũ) hoặc <strong>RPC</strong>: class kế thừa <code>WorkerEntrypoint</code>,
    mọi method public gọi được từ xa. Tham số/giá trị trả về đi qua structured clone; có thể truyền cả <code>ReadableStream</code>, hàm callback, và object kế thừa <code>RpcTarget</code> (truyền theo tham chiếu).</p>

    <p><strong>Named entrypoint</strong>: một Worker có thể export nhiều class (<code>AdminApi</code>, <code>PublicApi</code>) và mỗi binding chọn một <code>entrypoint</code> → phân quyền theo binding:
    Worker "billing" chỉ được bind vào <code>PublicApi</code>, không thấy method admin.</p>

    <p><strong>Promise pipelining</strong>: <code>env.USERS.get(id).profile()</code> — gọi tiếp trên kết quả chưa về mà không phải chờ round-trip đầu (giống Cap'n Proto).</p>

    <div class="callout"><p>💡 Kiểu type an toàn: bên gọi khai báo <code>Service&lt;typeof AuthApi&gt;</code> để TypeScript biết method nào tồn tại — gần giống interface Feign client trong Spring, nhưng không có HTTP ở giữa.
    Lỗi ném ở Worker đích được truyền về bên gọi như exception (message giữ lại, stack thì không).</p></div>
  `,

  codeTabs: [
    { id: "callee", label: "① Worker auth (bên được gọi)", lines: [
      "import { WorkerEntrypoint } from 'cloudflare:workers';",
      "",
      "export class AuthApi extends WorkerEntrypoint {",
      "  async verify(token) {",
      "    const claims = await verifyJwt(token, this.env.JWKS_URL);   // this.env của auth",
      "    return { sub: claims.sub, roles: claims.roles };",
      "  }",
      "}",
      "",
      "export class AdminApi extends WorkerEntrypoint {",
      "  async revokeAll(userId) { /* chỉ Worker quản trị được bind vào */ }",
      "}",
      "",
      "export default { fetch() { return new Response('not public', { status: 404 }); } };"
    ]},
    { id: "cfg", label: "② wrangler của bên gọi", lines: [
      "// orders-worker/wrangler.jsonc",
      "\"services\": [",
      "  { \"binding\": \"AUTH\", \"service\": \"auth-worker\", \"entrypoint\": \"AuthApi\" },",
      "  { \"binding\": \"INVENTORY\", \"service\": \"inventory-worker\" }",
      "]",
      "",
      "// auth-worker/wrangler.jsonc",
      "\"workers_dev\": false        // không có URL công khai, chỉ gọi qua binding"
    ]},
    { id: "caller", label: "③ Worker orders gọi", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const token = req.headers.get('Authorization')?.slice(7);",
      "    let user;",
      "    try { user = await env.AUTH.verify(token); }        // RPC, như gọi hàm",
      "    catch (e) { return new Response('unauthorized', { status: 401 }); }",
      "    const ok = await env.INVENTORY.reserve(user.sub, await req.json());",
      "    return Response.json({ ok });",
      "  }",
      "};"
    ]},
    { id: "java", label: "④ Spring Feign tương đương", lines: [
      "@FeignClient(name = \"auth\", url = \"${auth.url}\")",
      "interface AuthClient {",
      "    @PostMapping(\"/verify\") Claims verify(@RequestHeader(\"Authorization\") String token);",
      "}",
      "// = DNS + LB + TLS + JSON + timeout + retry",
      "// Service binding: không có lớp mạng, không cần mTLS nội bộ, không URL"
    ]},
    { id: "pipe", label: "⑤ RpcTarget & pipelining", lines: [
      "import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers';",
      "",
      "class Session extends RpcTarget {",
      "  constructor(user) { super(); this.user = user; }",
      "  profile() { return loadProfile(this.user); }",
      "}",
      "export class Users extends WorkerEntrypoint {",
      "  login(token) { return new Session(verify(token)); }   // trả về theo tham chiếu",
      "}",
      "",
      "// bên gọi: một lượt đi–về cho cả chuỗi nhờ pipelining",
      "const p = await env.USERS.login(token).profile();"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client</div><div class="ns">POST /orders</div></div>
    <div class="arrow" id="a1">↓ route công khai</div>
    <div class="node" id="orders"><div class="nl">⚙️ orders-worker</div><div class="ns">env.AUTH · env.INVENTORY</div></div>
    <div class="row">
      <div class="node" id="auth"><div class="nl">🔐 auth-worker · AuthApi</div><div class="ns">workers_dev=false</div></div>
      <div class="node" id="inv"><div class="nl">📦 inventory-worker</div><div class="ns">không URL công khai</div></div>
    </div>
    <div class="arrow" id="a2">↑ RPC cùng máy, không qua Internet, không phí request thêm</div>
  `,
  steps: [
    { title: "1 · Định nghĩa API bằng class", tab: "callee", highlight: [3, 4, 5, 6, 10], on: ["auth"],
      desc: "Method public của WorkerEntrypoint là RPC. this.env là binding của chính auth-worker (secret, JWKS)." },
    { title: "2 · Binding = quyền", tab: "cfg", highlight: [3, 4, 8], on: ["orders", "auth", "inv"],
      desc: "orders chỉ bind vào AuthApi, không thấy AdminApi. auth không có URL công khai." },
    { title: "3 · Gọi như hàm", tab: "caller", highlight: [5, 6, 7], on: ["client", "a1", "orders", "a2"],
      desc: "Exception từ auth trả về như exception. Không có JSON, không HTTP status để tự map." },
    { title: "4 · So với Feign", tab: "java", highlight: [1, 5, 6], on: ["a2"],
      desc: "Cùng tư duy 'interface client', bỏ đi toàn bộ lớp mạng nội bộ." },
    { title: "5 · Truyền đối tượng theo tham chiếu", tab: "pipe", highlight: [3, 8, 12], on: ["auth"],
      desc: "RpcTarget cho phép trả về 'đối tượng từ xa'. Pipelining gộp hai lời gọi thành một lượt." }
  ],

  quiz: [
    { q: "Lời gọi qua service binding đi qua đâu?", options: [
        "Internet công khai qua HTTPS",
        "Nội bộ runtime Cloudflare, thường cùng máy — không qua Internet",
        "Qua Queues",
        "Qua KV"
      ], correct: 1, explanation: "Gần như không thêm độ trễ." },
    { q: "Muốn Worker auth chỉ gọi được qua binding, không có URL công khai?", options: [
        "Đặt mật khẩu",
        "workers_dev: false và không gắn route",
        "Dùng KV",
        "Không thể"
      ], correct: 1, explanation: "Binding chính là quyền truy cập." },
    { q: "Để method của Worker gọi được qua RPC, class cần kế thừa gì?", options: [
        "DurableObject", "WorkerEntrypoint", "RpcTarget", "WorkflowEntrypoint"
      ], correct: 1, explanation: "Import từ 'cloudflare:workers'." },
    { q: "Trường entrypoint trong cấu hình services dùng để làm gì?", options: [
        "Chọn region",
        "Chọn class export có tên (named entrypoint) mà binding được phép gọi",
        "Đặt timeout",
        "Chọn phiên bản"
      ], correct: 1, explanation: "Cho phép phân quyền: Public vs Admin." },
    { q: "Lời gọi qua service binding có bị tính thêm phí request không?", options: [
        "Có, như request mới",
        "Không tính thêm phí request (vẫn tính CPU)",
        "Chỉ khi quá 1 triệu",
        "Tính gấp đôi"
      ], correct: 1, explanation: "Theo trang pricing Workers." },
    { q: "Worker đích ném Error('token expired'). Bên gọi nhận được gì?", options: [
        "HTTP 500 dạng text",
        "Exception với message được giữ lại",
        "undefined",
        "Không nhận được gì"
      ], correct: 1, explanation: "Lỗi được truyền qua RPC." },
    { q: "RpcTarget khác giá trị trả về thông thường thế nào?", options: [
        "Được copy (structured clone)",
        "Được truyền theo tham chiếu — bên gọi nhận stub để gọi method trên đối tượng ở bên kia",
        "Không truyền được",
        "Được lưu vào KV"
      ], correct: 1, explanation: "Dùng cho session/capability." },
    { q: "Promise pipelining giúp gì trong env.USERS.login(t).profile()?", options: [
        "Không giúp gì",
        "Gọi tiếp trên kết quả chưa về mà không phải chờ round-trip đầu",
        "Tự cache kết quả",
        "Chạy song song trên nhiều máy"
      ], correct: 1, explanation: "Giảm số lượt đi–về." },
    { q: "Tương đương gần nhất của service binding RPC trong Spring?", options: [
        "@Scheduled", "Feign client — nhưng không có lớp mạng", "JPA repository", "@Async"
      ], correct: 1, explanation: "Cùng tư duy interface client." }
  ]
});
