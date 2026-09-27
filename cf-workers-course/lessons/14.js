window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Bindings: lưu trữ & kết nối",
  title: "Service bindings — Worker gọi Worker khác không qua HTTP công khai",
  subtitle: "binding services · RPC với WorkerEntrypoint · fetch binding · không URL public · 32 lượt gọi/chuỗi",

  theory: `
    <p>Trong microservice Spring, service A gọi service B bằng HTTP (RestTemplate/Feign) qua URL nội bộ, cộng service discovery, mTLS, retry…
    Với Workers, nếu A gọi B qua URL <code>https://b.shop.vn</code> thì request đi ra Internet rồi quay lại, và B phải mở public (rồi tự xác thực A).</p>

    <p><strong>Service binding</strong> cho A một đối tượng <code>env.B</code> trỏ thẳng tới Worker B:</p>
    <ul>
      <li>Không cần URL public cho B — có thể tắt <code>workers_dev</code>, không route nào; chỉ ai có binding mới gọi được (capability, như bài 09).</li>
      <li>Theo docs, hai Worker thường chạy trên <strong>cùng máy, cùng thread</strong> → gần như không thêm độ trễ; và không tính thêm phí cho việc tách Worker.</li>
      <li>Mỗi lời gọi vẫn tính là một subrequest; một chuỗi gọi nhau tối đa <strong>32 lượt Worker</strong> — vượt là exception (chống vòng lặp vô hạn).</li>
    </ul>

    <p><strong>Hai kiểu giao tiếp</strong></p>
    <table>
      <tr><th></th><th>Fetch binding</th><th>RPC (khuyên dùng)</th></tr>
      <tr><td>B viết</td><td><code>export default { fetch() }</code> như thường</td><td><code>class extends WorkerEntrypoint</code> với method public</td></tr>
      <tr><td>A gọi</td><td><code>env.B.fetch(new Request(...))</code></td><td><code>await env.B.getUser(id)</code></td></tr>
      <tr><td>Kiểu dữ liệu</td><td>Tự serialize JSON</td><td>Truyền object có cấu trúc, có type TS</td></tr>
      <tr><td>Giống Java</td><td>RestTemplate</td><td>Gọi interface kiểu gRPC/Feign — nhưng không cần .proto hay HTTP</td></tr>
    </table>
    <p>Có thể export nhiều entrypoint có tên (vd <code>AdminEntrypoint</code>) và cấp cho từng Worker gọi đúng entrypoint nó được phép dùng
    (<code>"entrypoint": "AdminEntrypoint"</code>) — phân quyền ngay trong cấu hình.</p>

    <div class="callout"><p>💡 Tách Worker khi có lý do rõ: deploy độc lập, team khác nhau, quyền binding khác nhau (vd chỉ Worker "billing" có binding tới DB thanh toán).
    Đừng tách "nano-service" chỉ vì thói quen microservice — 32 lượt/chuỗi và độ phức tạp deploy là có thật.</p></div>
  `,

  codeTabs: [
    { id: "b", label: "Worker B (user-service)", lines: [
      "import { WorkerEntrypoint } from 'cloudflare:workers';",
      "",
      "export type User = { id: string; name: string; tier: 'gold' | 'basic' };",
      "",
      "export default class UserService extends WorkerEntrypoint<Env> {",
      "  async getUser(id: string): Promise<User | null> {",
      "    return await this.env.DB.prepare('SELECT id, name, tier FROM users WHERE id = ?')",
      "      .bind(id).first<User>();",
      "  }",
      "",
      "  async fetch(request: Request) {          // vẫn nhận HTTP nếu cần",
      "    return new Response('user-service', { status: 200 });",
      "  }",
      "}",
      "",
      "export class AdminEntrypoint extends WorkerEntrypoint<Env> {",
      "  async banUser(id: string) { /* chỉ Worker admin mới được bind tới đây */ }",
      "}"
    ]},
    { id: "cfgA", label: "wrangler.jsonc của A", lines: [
      "{",
      "  \"name\": \"order-api\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"services\": [",
      "    { \"binding\": \"USERS\", \"service\": \"user-service\" },",
      "    { \"binding\": \"USERS_ADMIN\", \"service\": \"user-service\", \"entrypoint\": \"AdminEntrypoint\" }",
      "  ]",
      "}"
    ]},
    { id: "a", label: "Worker A gọi", lines: [
      "app.post('/api/orders', async (c) => {",
      "  const user = await c.env.USERS.getUser(c.get('userId'));   // RPC, có kiểu",
      "  if (!user) return c.json({ error: 'no_user' }, 404);",
      "  const discount = user.tier === 'gold' ? 0.1 : 0;",
      "  return c.json({ discount });",
      "});",
      "",
      "// kiểu fetch binding (khi B chỉ có fetch handler):",
      "const res = await c.env.USERS.fetch(new Request('https://internal/users/42'));"
    ]},
    { id: "java", label: "So với microservice Java", lines: [
      "# Spring Cloud                                  # Workers",
      "Feign client + Eureka/K8s DNS          <->   \"services\": [{ binding, service }]",
      "mTLS / JWT giữa service                 <->   có binding = có quyền; B không cần public",
      "HTTP qua mạng (ms)                      <->   thường cùng máy/thread, độ trễ rất nhỏ",
      "Circuit breaker cho vòng gọi            <->   giới hạn 32 lượt Worker mỗi chuỗi"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 App</div><div class="ns">POST /api/orders</div></div>
    <div class="arrow" id="a0">↓ public</div>
    <div class="node" id="A"><div class="nl">⚡ order-api (A)</div><div class="ns">env.USERS · env.USERS_ADMIN</div></div>
    <div class="arrow" id="a1">↓ RPC qua service binding (không ra Internet)</div>
    <div class="row">
      <div class="node" id="B"><div class="nl">👤 user-service (B)</div><div class="ns">default entrypoint · không URL public</div></div>
      <div class="node" id="adm"><div class="nl">🛡️ AdminEntrypoint</div><div class="ns">chỉ binding được cấp mới gọi</div></div>
    </div>
  `,
  steps: [
    { title: "1 · B khai báo method RPC", tab: "b", highlight: [1, 5, 6, 7, 8], on: ["B"],
      desc: "Method public của class WorkerEntrypoint trở thành API gọi được từ Worker khác." },
    { title: "2 · A khai báo binding", tab: "cfgA", highlight: [5, 6, 7], on: ["A"],
      desc: "<code>service</code> là tên Worker B. <code>entrypoint</code> chọn class export có tên." },
    { title: "3 · Gọi như gọi hàm", tab: "a", highlight: [2, 3, 4], on: ["client", "a0", "A", "a1", "B"],
      desc: "Không URL, không JSON thủ công, có type. Vẫn là lời gọi bất đồng bộ — nhớ await." },
    { title: "4 · Phân quyền theo entrypoint", tab: "b", highlight: [16, 17], on: ["adm"],
      desc: "Chỉ Worker được cấp binding tới <code>AdminEntrypoint</code> mới gọi được <code>banUser</code>." },
    { title: "5 · Đối chiếu Spring Cloud", tab: "java", highlight: [2, 3, 4, 5], on: ["A", "B"],
      desc: "Service discovery, xác thực nội bộ, mạng — đều được thay bằng một dòng cấu hình binding." }
  ],

  quiz: [
    { q: "Lợi ích chính của service binding so với gọi URL công khai của Worker khác?", options: [
        "Không có lợi ích",
        "Không cần mở public Worker đích, không đi qua Internet, gần như không thêm độ trễ; quyền gọi = có binding",
        "Nhanh hơn vì dùng UDP",
        "Miễn phí CPU"
      ], correct: 1, explanation: "Theo docs, hai Worker thường chạy cùng thread." },
    { q: "Để expose method RPC, Worker B làm gì?", options: [
        "Viết file .proto",
        "Export class extends WorkerEntrypoint với method public",
        "Mở route /rpc",
        "Dùng Durable Object"
      ], correct: 1, explanation: "Import WorkerEntrypoint từ cloudflare:workers." },
    { q: "Trường nào trong services chọn entrypoint có tên?", options: [
        "class_name", "entrypoint", "handler", "export"
      ], correct: 1, explanation: "Không ghi thì dùng default export." },
    { q: "Số lượt Worker tối đa trong một chuỗi gọi nhau qua service binding?", options: [
        "3", "32", "1000", "Không giới hạn"
      ], correct: 1, explanation: "Vượt quá sẽ ném exception." },
    { q: "Service binding có tính là subrequest không?", options: [
        "Không bao giờ", "Có — mỗi lời gọi tính vào giới hạn subrequest", "Chỉ kiểu fetch", "Chỉ kiểu RPC"
      ], correct: 1, explanation: "Theo docs: mỗi lời gọi service binding tính vào subrequest limit." },
    { q: "Worker B chỉ có fetch handler, không có RPC. A gọi thế nào?", options: [
        "Không gọi được",
        "env.B.fetch(new Request(...))",
        "env.B.call('path')",
        "fetch('http://b')"
      ], correct: 1, explanation: "Fetch binding: gửi Request, nhận Response." },
    { q: "Làm sao chỉ Worker admin mới gọi được banUser?", options: [
        "Kiểm tra IP",
        "Đặt banUser trong một entrypoint riêng và chỉ cấp binding tới entrypoint đó cho Worker admin",
        "Đặt mật khẩu trong code",
        "Không làm được"
      ], correct: 1, explanation: "Phân quyền bằng cấu hình binding." },
    { q: "Khi nào NÊN tách một Worker thành hai?", options: [
        "Luôn luôn, càng nhỏ càng tốt",
        "Khi cần deploy độc lập, team khác, hoặc quyền binding khác nhau",
        "Khi file dài hơn 100 dòng",
        "Không bao giờ"
      ], correct: 1, explanation: "Tách vô cớ chỉ thêm độ phức tạp." },
    { q: "Tách logic vào nhiều Worker nối bằng service binding có tốn thêm phí cho chính việc tách không?", options: [
        "Có, gấp đôi",
        "Theo docs: có thể tách chức năng ra nhiều Worker mà không phát sinh thêm chi phí",
        "Chỉ miễn phí trên Free",
        "Tính theo số binding"
      ], correct: 1, explanation: "Đây là điểm docs service bindings nhấn mạnh." }
  ]
});
