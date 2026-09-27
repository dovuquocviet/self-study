window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Nền tảng serverless",
  title: "Edge network — request đi đường nào tới Worker của bạn?",
  subtitle: "anycast · data center gần nhất · workers.dev / route / custom domain · Cache API cục bộ · Smart Placement",

  theory: `
    <p>Cloudflare có data center ở hơn 300 thành phố. Tất cả quảng bá <strong>cùng một dải IP</strong> (anycast). Khi điện thoại ở Hà Nội phân giải
    <code>api.shop.vn</code>, nó nhận IP anycast; mạng Internet tự đưa gói tin tới data center Cloudflare <strong>gần nhất về mặt định tuyến</strong>
    (có thể là Hà Nội, Singapore, Hong Kong…). Worker của bạn chạy <strong>ngay tại đó</strong>.</p>

    <p><strong>3 cách gắn Worker vào URL</strong></p>
    <table>
      <tr><th>Cách</th><th>Cấu hình</th><th>Dùng khi</th></tr>
      <tr><td><code>*.workers.dev</code></td><td><code>"workers_dev": true</code> (mặc định)</td><td>Dev, demo, service nội bộ</td></tr>
      <tr><td>Custom domain</td><td><code>"routes": [{ "pattern": "api.shop.vn", "custom_domain": true }]</code></td><td>Worker <em>là</em> origin, Cloudflare tự tạo DNS + cert</td></tr>
      <tr><td>Route</td><td><code>"routes": [{ "pattern": "shop.vn/api/*", "zone_name": "shop.vn" }]</code></td><td>Worker đứng <em>trước</em> origin cũ, chặn một phần đường dẫn</td></tr>
    </table>

    <p><strong>Hệ quả của "chạy ở edge" mà dân backend hay quên:</strong></p>
    <ul>
      <li>Worker gần <em>người dùng</em>, nhưng DB Postgres của bạn ở <em>một</em> region (vd Singapore). Nếu request từ châu Âu vào Worker rồi Worker gọi DB 5 lần
      tuần tự, mỗi lần đi vòng nửa trái đất → chậm hơn cả khi không dùng edge. Giải pháp: gộp truy vấn, dùng Hyperdrive (bài 13), hoặc bật
      <strong>Smart Placement</strong> (<code>"placement": { "mode": "smart" }</code>) để Cloudflare tự chuyển Worker tới gần backend.</li>
      <li><strong>Cache API</strong> (<code>caches.default</code>) là cache <em>của từng data center</em>, không phải cache toàn cầu. Cache ở Singapore không giúp gì cho request ở Frankfurt.</li>
      <li>Không có "một server" để log vào xem: mỗi request có thể ở data center khác nhau. Log phải tập trung (bài 18).</li>
    </ul>

    <p><code>request.cf</code> cho biết request đang ở đâu: <code>colo</code> (mã sân bay của data center, vd <code>SIN</code>), <code>country</code>, <code>city</code>, <code>asn</code>…
    Tiện cho geo-routing, nhưng chỉ nên dùng làm gợi ý, không dùng cho bảo mật tuyệt đối.</p>

    <div class="callout"><p>💡 Edge không làm mọi thứ nhanh lên. Nó làm nhanh những gì <em>trả lời được ngay tại edge</em> (cache, KV, logic thuần) và
    giúp TLS/kết nối ngắn hơn. Mọi cú gọi về backend tập trung vẫn trả giá đường xa.</p></div>
  `,

  codeTabs: [
    { id: "routes", label: "wrangler.jsonc: routes", lines: [
      "{",
      "  \"name\": \"shop-api\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"workers_dev\": false,",
      "  \"routes\": [",
      "    { \"pattern\": \"api.shop.vn\", \"custom_domain\": true },",
      "    { \"pattern\": \"shop.vn/legacy-api/*\", \"zone_name\": \"shop.vn\" }",
      "  ],",
      "  \"placement\": { \"mode\": \"smart\" }",
      "}"
    ]},
    { id: "cf", label: "request.cf", lines: [
      "export default {",
      "  async fetch(request: Request): Promise<Response> {",
      "    const cf = request.cf;                  // có sẵn trên production",
      "    return Response.json({",
      "      colo: cf?.colo,          // vd 'SIN' — data center đang xử lý",
      "      country: cf?.country,    // vd 'VN'",
      "      asn: cf?.asn,            // nhà mạng",
      "    });",
      "  },",
      "};"
    ]},
    { id: "cache", label: "Cache API (cục bộ)", lines: [
      "export default {",
      "  async fetch(request: Request, env: Env, ctx: ExecutionContext) {",
      "    const cache = caches.default;                 // cache CỦA DATA CENTER NÀY",
      "    let res = await cache.match(request);",
      "    if (res) return res;                          // hit tại edge: không gọi origin",
      "    res = await fetch('https://origin.shop.vn' + new URL(request.url).pathname);",
      "    res = new Response(res.body, res);            // copy để sửa header",
      "    res.headers.set('Cache-Control', 'public, max-age=60');",
      "    ctx.waitUntil(cache.put(request, res.clone())); // ghi cache sau khi trả",
      "    return res;",
      "  },",
      "};"
    ]},
    { id: "lat", label: "Độ trễ vòng đi vòng về", lines: [
      "# User ở Frankfurt, Postgres ở Singapore (RTT ~160 ms)",
      "",
      "Worker ở Frankfurt, 5 query tuần tự  -> ~5 x 160 = 800 ms",
      "Worker ở Frankfurt, 1 query gộp      -> ~160 ms",
      "Smart Placement: Worker chạy gần Singapore -> 5 query x vài ms + 1 lượt Frankfurt<->SIN"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">📱 App ở Hà Nội</div><div class="ns">gọi api.shop.vn</div></div>
    <div class="arrow" id="a1">↓ IP anycast → data center gần nhất</div>
    <div class="node" id="edge"><div class="nl">🌐 Data center (vd SIN)</div><div class="ns">TLS + chạy Worker tại đây</div></div>
    <div class="row">
      <div class="node" id="cache"><div class="nl">🧊 Cache cục bộ</div><div class="ns">chỉ data center này</div></div>
      <div class="node" id="origin"><div class="nl">🗄️ Origin / DB</div><div class="ns">một region cố định</div></div>
    </div>
    <div class="arrow" id="a2">↕ mỗi lượt về origin trả giá RTT</div>
  `,
  steps: [
    { title: "1 · Anycast đưa tới edge gần nhất", tab: "cf", highlight: [3, 5, 6], on: ["user", "a1", "edge"],
      desc: "<code>request.cf.colo</code> cho biết data center nào đang chạy Worker của bạn." },
    { title: "2 · Gắn Worker vào domain", tab: "routes", highlight: [5, 6, 7, 8], on: ["edge"],
      desc: "Custom domain: Worker là origin. Route: Worker đứng trước origin cũ cho một phần đường dẫn." },
    { title: "3 · Cache là cục bộ", tab: "cache", highlight: [3, 4, 5, 9], on: ["cache"],
      desc: "<code>caches.default</code> chỉ có ở data center hiện tại. Ghi cache bằng <code>waitUntil</code> để không làm chậm response." },
    { title: "4 · Đường về origin mới là chi phí", tab: "lat", highlight: [3, 4], on: ["origin", "a2"],
      desc: "Gọi DB nhiều lượt tuần tự từ edge xa là phản mẫu. Gộp query hoặc đưa Worker lại gần DB." },
    { title: "5 · Smart Placement", tab: "routes", highlight: [10], on: ["edge", "origin"],
      desc: "Cloudflare đo độ trễ tới backend và có thể chạy Worker ở data center gần backend hơn thay vì gần user." }
  ],

  quiz: [
    { q: "Anycast có nghĩa là gì trong bối cảnh Cloudflare?", options: [
        "Mỗi data center có IP riêng, DNS chọn",
        "Nhiều data center quảng bá cùng IP; định tuyến Internet đưa client tới điểm gần nhất",
        "Gửi request tới tất cả data center cùng lúc",
        "Một dạng load balancer round-robin"
      ], correct: 1, explanation: "Cùng IP ở mọi nơi; BGP chọn đường ngắn nhất." },
    { q: "caches.default trong Worker có phạm vi nào?", options: [
        "Toàn cầu, đồng bộ mọi nơi",
        "Data center đang xử lý request",
        "Chỉ trong 1 request",
        "Trong trình duyệt người dùng"
      ], correct: 1, explanation: "Cache API là cục bộ theo data center. Cần dữ liệu toàn cầu thì dùng KV/D1/R2." },
    { q: "Muốn Worker trở thành origin cho api.shop.vn (Cloudflare tự tạo DNS và chứng chỉ), cấu hình gì?", options: [
        "workers_dev: true",
        "routes với custom_domain: true",
        "Tạo A record trỏ về IP Worker",
        "Không làm được"
      ], correct: 1, explanation: "Custom domain gắn Worker làm origin của hostname." },
    { q: "Route kiểu \"shop.vn/legacy-api/*\" với zone_name dùng khi nào?", options: [
        "Khi Worker thay hoàn toàn site",
        "Khi Worker đứng trước origin cũ và chỉ xử lý một phần đường dẫn",
        "Khi chạy local",
        "Khi dùng Durable Objects"
      ], correct: 1, explanation: "Các đường dẫn không khớp vẫn đi thẳng tới origin." },
    { q: "Worker ở Frankfurt gọi Postgres ở Singapore 5 lần tuần tự. Vấn đề chính?", options: [
        "CPU time vượt giới hạn",
        "Mỗi lượt trả RTT liên lục địa, tổng độ trễ rất lớn",
        "Postgres không cho kết nối từ Đức",
        "Không có vấn đề gì"
      ], correct: 1, explanation: "Latency cộng dồn theo số lượt tuần tự. Gộp query, Hyperdrive hoặc Smart Placement." },
    { q: "Smart Placement làm gì?", options: [
        "Tự scale số isolate",
        "Tự đặt Worker ở data center gần backend nó hay gọi nếu điều đó giảm tổng độ trễ",
        "Tự nén response",
        "Tự chọn DB"
      ], correct: 1, explanation: "Bật bằng \"placement\": { \"mode\": \"smart\" }." },
    { q: "request.cf.colo chứa gì?", options: [
        "Màu theme",
        "Mã data center Cloudflare đang xử lý request (vd SIN)",
        "IP client",
        "User agent"
      ], correct: 1, explanation: "Hữu ích để debug và quan sát request đang chạy ở đâu." },
    { q: "Vì sao không thể 'SSH vào server xem log' với Workers?", options: [
        "Vì Cloudflare cấm SSH",
        "Không có một server cố định; mỗi request có thể chạy ở data center/isolate khác nhau, nên log phải được thu tập trung",
        "Vì Worker không log được",
        "Vì log bị mã hoá"
      ], correct: 1, explanation: "Dùng wrangler tail / Workers Logs (bài 18)." },
    { q: "Edge giúp nhanh nhất cho loại response nào?", options: [
        "Response phụ thuộc nhiều query tuần tự tới DB xa",
        "Response trả được ngay tại edge: cache, KV, logic thuần, redirect",
        "Upload file 5 GB",
        "Batch job"
      ], correct: 1, explanation: "Còn phần phải về backend tập trung thì vẫn chịu độ trễ mạng." }
  ]
});
