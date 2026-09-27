window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Kết nối hệ thống",
  title: "Ghép Workers vào hệ microservice Java/Rust sẵn có",
  subtitle: "Edge gateway/BFF · Tunnel · Access service token · mTLS · JWT ở biên · Java/Rust gọi ngược vào Cloudflare",

  theory: `
    <p>Không ai viết lại toàn bộ hệ thống sang serverless. Thực tế là <strong>lai</strong>: Worker ở biên (gateway, BFF, service nhỏ), còn service Rust/Java và Postgres/Mongo/Kafka ở data center hoặc cloud.
    Câu hỏi kỹ thuật: <em>Worker nói chuyện với service nội bộ an toàn thế nào</em>, và <em>ngược lại</em>.</p>

    <p><strong>Worker làm API gateway / BFF</strong></p>
    <ul>
      <li>Xác thực JWT của user <em>tại biên</em> (thư viện <code>jose</code>, JWKS cache ở global/Cache API) → request rác bị chặn trước khi tới origin.</li>
      <li>Rate limit, định tuyến theo path/version, gộp nhiều lời gọi backend cho mobile (BFF) — giảm round-trip cho app React Native/native.</li>
      <li>Chuyển tiếp tới service phía sau kèm danh tính <strong>đã xác thực</strong> (header nội bộ) — và origin phải chắc rằng header đó đến từ Worker chứ không phải kẻ giả mạo.</li>
    </ul>

    <p><strong>Worker → service nội bộ: 3 cách chính</strong></p>
    <table>
      <tr><th>Cách</th><th>Cơ chế</th><th>Khi nào</th></tr>
      <tr><td>Cloudflare Tunnel + Access</td><td><code>cloudflared</code> chạy trong mạng nội bộ, mở kết nối <em>ra ngoài</em> tới Cloudflare; không mở port vào. Access kiểm tra service token (<code>CF-Access-Client-Id</code>/<code>CF-Access-Client-Secret</code>) và gắn <code>Cf-Access-Jwt-Assertion</code> cho origin kiểm tra</td><td>Service trong DC/VPC, không muốn IP công khai</td></tr>
      <tr><td>mTLS client certificate</td><td>Binding <code>mtls_certificates</code>: Worker trình chứng chỉ client khi <code>env.CERT.fetch()</code>; origin chỉ chấp nhận cert đó</td><td>Origin đã có endpoint công khai, cần xác thực mạnh</td></tr>
      <tr><td>Token nội bộ ký bởi gateway</td><td>Worker ký JWT ngắn hạn (aud = tên service), service Rust/Java xác minh bằng public key</td><td>Kết hợp với hai cách trên, để truyền danh tính user</td></tr>
    </table>

    <p><strong>Service Java/Rust → Cloudflare</strong></p>
    <ul>
      <li>Gọi Worker qua route công khai được bảo vệ bằng Access service token hoặc HMAC chữ ký.</li>
      <li>Đẩy message vào Queues qua <strong>HTTP API</strong> của Queues (token API có quyền hạn chế) → không cần Worker trung gian.</li>
      <li>Đọc/ghi R2 bằng AWS SDK (bài 12); D1 có REST API nhưng không dành cho đường nóng.</li>
      <li>Kafka ↔ Cloudflare: consumer Kafka (Rust/Java) đẩy sang Queues/Worker; ngược lại consumer Queues gọi service produce vào Kafka. Đừng cố bắt Worker nói giao thức Kafka.</li>
    </ul>

    <div class="callout"><p>💡 Nguyên tắc: <strong>xác thực user một lần ở biên, xác thực <em>service</em> ở mọi chặng</strong>. Header <code>X-User-Id</code> chỉ đáng tin nếu origin
    chắc chắn request đến từ gateway (Tunnel + Access JWT, mTLS, hoặc chữ ký) — nếu không, bất kỳ ai gọi thẳng origin cũng tự xưng được là admin.</p></div>
  `,

  codeTabs: [
    { id: "gw", label: "① Worker gateway", lines: [
      "import { jwtVerify, createRemoteJWKSet } from 'jose';",
      "const JWKS = createRemoteJWKSet(new URL('https://id.example.com/.well-known/jwks.json'));  // cache theo isolate",
      "",
      "export default {",
      "  async fetch(req, env) {",
      "    const token = req.headers.get('Authorization')?.replace('Bearer ', '');",
      "    let claims;",
      "    try { ({ payload: claims } = await jwtVerify(token, JWKS, { audience: 'mobile-api' })); }",
      "    catch { return new Response('unauthorized', { status: 401 }); }",
      "    const url = new URL(req.url);",
      "    const origin = url.pathname.startsWith('/orders') ? 'https://orders.internal.example.com' : 'https://catalog.internal.example.com';",
      "    const fwd = new Request(origin + url.pathname + url.search, req);",
      "    fwd.headers.set('X-User-Id', claims.sub);",
      "    fwd.headers.set('CF-Access-Client-Id', env.ACCESS_ID);          // service token của Access",
      "    fwd.headers.set('CF-Access-Client-Secret', env.ACCESS_SECRET);",
      "    fwd.headers.delete('Authorization');",
      "    return fetch(fwd);",
      "  }",
      "};"
    ]},
    { id: "tunnel", label: "② Tunnel trong DC", lines: [
      "# chạy trong mạng nội bộ, chỉ mở kết nối RA ngoài",
      "cloudflared tunnel create orders",
      "cloudflared tunnel route dns orders orders.internal.example.com",
      "",
      "# ~/.cloudflared/config.yml",
      "tunnel: orders",
      "ingress:",
      "  - hostname: orders.internal.example.com",
      "    service: http://orders-svc:8080",
      "  - service: http_status:404",
      "# + Access application cho hostname này, policy: chỉ Service Token 'edge-gateway'"
    ]},
    { id: "rust", label: "③ Service Rust kiểm Access JWT", lines: [
      "// axum: middleware xác minh header Cf-Access-Jwt-Assertion",
      "async fn verify_edge(req: Request, next: Next) -> Result<Response, StatusCode> {",
      "    let jwt = req.headers().get(\"cf-access-jwt-assertion\").ok_or(StatusCode::FORBIDDEN)?;",
      "    // kiểm chữ ký bằng JWKS https://<team>.cloudflareaccess.com/cdn-cgi/access/certs",
      "    // kiểm aud = Application Audience (AUD) tag của Access app",
      "    access::verify(jwt, &AUD).map_err(|_| StatusCode::FORBIDDEN)?;",
      "    Ok(next.run(req).await)          // chỉ sau đó mới tin X-User-Id",
      "}"
    ]},
    { id: "mtls", label: "④ mTLS binding", lines: [
      "# npx wrangler mtls-certificate upload --cert client.pem --key client.key --name edge-client",
      "",
      "// wrangler.jsonc",
      "\"mtls_certificates\": [{ \"binding\": \"ORIGIN_CERT\", \"certificate_id\": \"<id>\" }]",
      "",
      "// Worker: fetch qua binding sẽ trình chứng chỉ client",
      "const r = await env.ORIGIN_CERT.fetch('https://legacy-java.example.com/api/stock');"
    ]},
    { id: "java", label: "⑤ Java đẩy vào Queues", lines: [
      "// Spring gửi message vào Cloudflare Queue qua HTTP API",
      "restClient.post()",
      "    .uri(\"https://api.cloudflare.com/client/v4/accounts/{acc}/queues/{queueId}/messages\", acc, queueId)",
      "    .header(\"Authorization\", \"Bearer \" + cfQueuesToken)   // token chỉ có quyền Queues",
      "    .body(Map.of(\"body\", Map.of(\"orderId\", id, \"type\", \"shipped\")))",
      "    .retrieve().toBodilessEntity();"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 Mobile app</div><div class="ns">Bearer JWT của user</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="gw"><div class="nl">🌩️ Worker gateway</div><div class="ns">verify JWT · rate limit · route</div></div>
    <div class="arrow" id="a2">↓ + service token Access, X-User-Id</div>
    <div class="node" id="acc"><div class="nl">🛡️ Cloudflare Access + Tunnel</div><div class="ns">chặn nếu không có token hợp lệ</div></div>
    <div class="arrow" id="a3">↓ Cf-Access-Jwt-Assertion</div>
    <div class="row">
      <div class="node" id="rs"><div class="nl">🦀 orders (Rust)</div><div class="ns">kiểm JWT của Access</div></div>
      <div class="node" id="jv"><div class="nl">☕ catalog (Java)</div><div class="ns">kiểm JWT của Access</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Xác thực user ở biên", tab: "gw", highlight: [1, 2, 6, 8, 9], on: ["app", "a1", "gw"],
      desc: "JWKS được cache theo isolate. Token sai bị chặn trước khi tốn tài nguyên của origin." },
    { title: "2 · Định tuyến + danh tính", tab: "gw", highlight: [11, 13, 16], on: ["gw"],
      desc: "Chuyển tiếp tới service phù hợp, thay token user bằng danh tính đã xác thực." },
    { title: "3 · Xác thực service", tab: "gw", highlight: [14, 15], on: ["a2", "acc"],
      desc: "Service token của Access chứng minh request đến từ gateway." },
    { title: "4 · Tunnel không mở port", tab: "tunnel", highlight: [2, 3, 8, 9, 11], on: ["acc"],
      desc: "cloudflared nối ra ngoài; origin không cần IP công khai hay firewall mở cổng vào." },
    { title: "5 · Origin kiểm tra", tab: "rust", highlight: [3, 5, 6, 7], on: ["a3", "rs", "jv"],
      desc: "Chỉ khi JWT của Access hợp lệ (đúng aud) mới tin X-User-Id." },
    { title: "6 · Chiều ngược lại", tab: "java", highlight: [3, 4, 5], on: ["jv"],
      desc: "Java đẩy thẳng vào Queues qua HTTP API với token quyền hẹp — không cần Worker trung gian." }
  ],

  quiz: [
    { q: "Vì sao origin không được tin header X-User-Id nếu không kiểm tra gì thêm?", options: [
        "Header bị mã hoá",
        "Ai gọi thẳng origin cũng tự đặt được header đó",
        "Header quá dài",
        "Không sao cả"
      ], correct: 1, explanation: "Phải xác thực rằng request đến từ gateway." },
    { q: "Cloudflare Tunnel giúp gì?", options: [
        "Tăng CPU cho Worker",
        "Nối service nội bộ tới Cloudflare bằng kết nối đi ra, không cần mở port vào hay IP công khai",
        "Thay thế Kafka",
        "Mã hoá DB"
      ], correct: 1, explanation: "cloudflared chạy trong mạng nội bộ." },
    { q: "Header nào Worker gửi để xác thực bằng Access service token?", options: [
        "X-Api-Key",
        "CF-Access-Client-Id và CF-Access-Client-Secret",
        "Authorization: Basic",
        "Cookie"
      ], correct: 1, explanation: "Access kiểm tra và cấp Cf-Access-Jwt-Assertion cho origin." },
    { q: "Origin kiểm tra request đã qua Access bằng gì?", options: [
        "IP nguồn",
        "Xác minh JWT trong header Cf-Access-Jwt-Assertion (chữ ký + aud)",
        "User-Agent",
        "Không cần kiểm tra"
      ], correct: 1, explanation: "JWKS lấy từ domain team cloudflareaccess.com." },
    { q: "Binding mtls_certificates dùng khi nào?", options: [
        "Khi Worker cần trình chứng chỉ client cho origin yêu cầu mTLS",
        "Khi cần cấp cert HTTPS cho domain",
        "Để mã hoá KV",
        "Để ký JWT"
      ], correct: 0, explanation: "fetch qua env.CERT.fetch() sẽ trình cert." },
    { q: "Service Java muốn đẩy sự kiện vào Cloudflare Queue. Cách đơn giản?", options: [
        "Không thể",
        "Gọi HTTP API của Queues với API token quyền hạn chế",
        "Ghi vào KV",
        "Mở WebSocket tới DO"
      ], correct: 1, explanation: "Không cần Worker trung gian." },
    { q: "Nên cache JWKS ở đâu trong Worker gateway?", options: [
        "Tải lại mỗi request",
        "Global scope/Cache API (theo isolate), chấp nhận làm mới định kỳ",
        "Durable Object bắt buộc",
        "D1"
      ], correct: 1, explanation: "createRemoteJWKSet của jose tự cache trong isolate." },
    { q: "Hệ thống dùng Kafka, cần dữ liệu từ Worker vào Kafka. Hướng hợp lý?", options: [
        "Worker nói giao thức Kafka trực tiếp",
        "Worker → Queues → consumer gọi service/REST proxy produce vào Kafka",
        "Ghi KV rồi Kafka tự đọc",
        "Không thể"
      ], correct: 1, explanation: "Giữ Kafka là xương sống, cầu nối bằng HTTP." },
    { q: "Lợi ích của BFF ở biên cho mobile app?", options: [
        "Không có lợi ích",
        "Gộp nhiều lời gọi backend thành một, giảm round-trip trên mạng di động chậm",
        "Thay thế database",
        "Không cần xác thực"
      ], correct: 1, explanation: "Worker gần user, backend gọi nhau trên mạng nhanh hơn." }
  ]
});
