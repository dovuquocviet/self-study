window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Ranh giới & giao tiếp",
  title: "API Gateway & BFF cho mobile",
  subtitle: "Việc chung ở cổng · Backend-for-Frontend gom call · Workers làm gateway ở edge · bẫy 'gateway béo'",

  theory: `
    <p>Nếu app mobile gọi thẳng 8 service, mỗi service phải tự lo xác thực, rate limit, CORS, TLS; app phải biết địa chỉ nội bộ;
    một màn hình cần 6 request qua mạng 4G (mỗi round trip 100+ ms). Hai mẫu giải quyết việc này:</p>

    <p><strong>API Gateway</strong> — một cổng vào duy nhất, lo <em>việc cắt ngang</em> (cross-cutting), không chứa nghiệp vụ:</p>
    <ul>
      <li>Định tuyến theo path/host tới service.</li>
      <li>Kết thúc TLS, xác thực token (kiểm chữ ký JWT), gắn <code>X-User-Id</code>/claims cho service sau.</li>
      <li>Rate limit, giới hạn kích thước body, CORS, chặn bot/WAF.</li>
      <li>Gắn <code>traceparent</code>/request id, ghi access log.</li>
    </ul>

    <p><strong>BFF (Backend-for-Frontend)</strong> — một backend <em>riêng cho từng loại client</em> (mobile BFF, web BFF), sở hữu bởi đội làm client đó:</p>
    <ul>
      <li><strong>Gom call</strong> (aggregation): màn "Trang chủ" cần banner + đơn gần đây + gợi ý → 1 request từ app, BFF gọi song song 3 service trong DC (mỗi call ~ms).</li>
      <li><strong>Cắt gọn payload</strong> cho màn hình: chỉ field app cần, ảnh đúng kích thước.</li>
      <li><strong>Hấp thụ khác biệt phiên bản app</strong>: app 3.2 cũ và 4.0 mới cần định dạng khác nhau → BFF chuyển đổi, service lõi giữ một API.</li>
      <li><strong>Suy giảm êm</strong>: gợi ý sản phẩm lỗi → trả trang chủ không có mục gợi ý thay vì lỗi cả màn.</li>
    </ul>

    <p><strong>Bẫy</strong>: nhồi nghiệp vụ (tính giá, kiểm tồn kho) vào gateway/BFF → thành monolith mới nằm giữa. BFF chỉ <em>ghép và định hình</em> dữ liệu; quy tắc nghiệp vụ ở service sở hữu.
    Gateway là điểm chết chung → phải stateless, chạy nhiều bản, và có timeout chặt.</p>

    <p><strong>Cloudflare Workers làm gateway/BFF ở edge</strong>: code chạy ở PoP gần người dùng, TLS kết thúc gần máy, có thể cache (bài 11), rate limit (bài 12), kiểm JWT bằng Web Crypto trước khi request đi xa về origin.
    Gọi các service Rust ở origin bằng <code>fetch</code>; nhiều call song song dùng <code>Promise.all</code>/<code>allSettled</code>. Lưu ý giới hạn số subrequest và CPU time mỗi request của Workers (tuỳ gói) — BFF nên gom vừa phải.</p>

    <div class="callout"><p>💡 Tương đương Spring: Spring Cloud Gateway (gateway) và một Spring Boot app riêng cho mobile (BFF). GraphQL cũng là một dạng BFF: client tự chọn field.
    Với app React Native hiện tại hay native sau này, BFF giúp đổi backend (Java → Rust) mà app không cần phát hành lại — miễn hợp đồng BFF giữ nguyên.</p></div>
  `,

  codeTabs: [
    { id: "before", label: "① Không có BFF", lines: [
      "# Màn Trang chủ trên app, mạng 4G RTT ~120 ms",
      "GET /banners          -> marketing-svc",
      "GET /orders?limit=3   -> order-svc",
      "GET /recommendations  -> reco-svc",
      "GET /cart/count       -> cart-svc",
      "GET /me               -> customer-svc",
      "",
      "# 5 request; dù gửi song song vẫn tốn pin, và mỗi service phải tự kiểm token,",
      "# tự rate limit; app biết cấu trúc nội bộ -> đổi backend là phải phát hành app"
    ]},
    { id: "bff", label: "② BFF trên Workers", lines: [
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const user = await verifyJwt(req, env);          // gateway: xác thực 1 lần",
      "    if (!user) return new Response('unauthorized', { status: 401 });",
      "    const h = { 'x-user-id': user.sub, 'traceparent': traceOf(req) };",
      "    const [banners, orders, reco] = await Promise.allSettled([",
      "      env.MARKETING.fetch('https://marketing/banners', { headers: h }),",
      "      fetch(env.ORIGIN + '/v1/orders?limit=3', { headers: h, signal: AbortSignal.timeout(800) }),",
      "      fetch(env.ORIGIN + '/v1/recommendations', { headers: h, signal: AbortSignal.timeout(500) }),",
      "    ]);",
      "    return Response.json({",
      "      banners: await okJson(banners, []),",
      "      recentOrders: await okJson(orders, []),",
      "      recommendations: await okJson(reco, null),   // lỗi -> ẩn mục, không lỗi cả màn",
      "    });",
      "  }",
      "};"
    ]},
    { id: "shape", label: "③ Định hình theo phiên bản app", lines: [
      "// service lõi trả đầy đủ",
      "{ \"id\":\"ord_9\", \"status\":\"SHIPPED\", \"total\":{\"amount_minor\":125000,\"currency\":\"VND\"},",
      "  \"items\":[...20 field mỗi item...], \"audit\":{...} }",
      "",
      "// BFF: app >= 4.0 (native) nhận",
      "{ \"id\":\"ord_9\", \"statusLabel\":\"Đang giao\", \"total\":\"125.000 ₫\", \"thumb\":\"https://img/.../w=160\" }",
      "",
      "// BFF: app 3.x (React Native cũ) vẫn nhận định dạng cũ",
      "{ \"orderId\":\"ord_9\", \"status\":\"SHIPPED\", \"totalText\":\"125.000 ₫\" }"
    ]},
    { id: "gw", label: "④ Gateway vs BFF", lines: [
      "API Gateway (chung cho mọi client):",
      "  routing, TLS, xác thực token, rate limit, CORS, WAF, trace id, access log",
      "  KHÔNG: nghiệp vụ, ghép dữ liệu cho màn hình",
      "",
      "BFF (mỗi loại client một cái, đội client sở hữu):",
      "  gom call, cắt payload, chuyển đổi theo phiên bản app, fallback từng phần",
      "  KHÔNG: quy tắc giá, tồn kho, trạng thái đơn (thuộc service lõi)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App (RN cũ / native mới)</div><div class="ns">1 request cho 1 màn hình</div></div>
    <div class="arrow" id="a1">↓ HTTPS tới PoP gần nhất</div>
    <div class="node" id="edge"><div class="nl">☁️ Worker: gateway + mobile BFF</div><div class="ns">JWT · rate limit · gom call · định hình</div></div>
    <div class="arrow" id="a2">↓ song song, có timeout riêng</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">marketing</div><div class="ns">banners</div></div>
      <div class="node" id="s2"><div class="nl">🦀 order</div><div class="ns">đơn gần đây</div></div>
      <div class="node" id="s3"><div class="nl">reco</div><div class="ns">có thể lỗi → ẩn</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Không có BFF: app gọi 5 nơi", tab: "before", highlight: [1, 2, 3, 4, 5, 6, 8, 9], on: ["app"],
      desc: "App biết cấu trúc backend, mỗi service tự làm lại xác thực/rate limit." },
    { title: "2 · Xác thực một lần ở cổng", tab: "bff", highlight: [3, 4, 5], on: ["a1", "edge"],
      desc: "Worker kiểm chữ ký JWT ở edge, truyền danh tính và traceparent cho phía sau." },
    { title: "3 · Gom call song song, timeout riêng", tab: "bff", highlight: [6, 7, 8, 9, 10], on: ["a2", "s1", "s2", "s3"],
      desc: "Trong DC mỗi call chỉ vài ms. allSettled để một call lỗi không kéo đổ cả kết quả. env.MARKETING có thể là service binding tới Worker khác." },
    { title: "4 · Suy giảm êm từng phần", tab: "bff", highlight: [12, 13, 14], on: ["s3", "edge"],
      desc: "Gợi ý lỗi → null → app ẩn mục đó. Trang chủ vẫn dùng được." },
    { title: "5 · Định hình theo phiên bản app", tab: "shape", highlight: [5, 6, 8, 9], on: ["edge", "app"],
      desc: "Service lõi giữ một API; BFF lo khác biệt giữa app RN cũ và app native mới." },
    { title: "6 · Ranh giới trách nhiệm", tab: "gw", highlight: [3, 7], on: ["edge"],
      desc: "Gateway/BFF không chứa quy tắc nghiệp vụ; nếu có, nó thành monolith mới ở giữa." }
  ],

  quiz: [
    { q: "Việc nào thuộc API Gateway?", options: [
        "Tính giá khuyến mãi",
        "Xác thực token, rate limit, routing, CORS",
        "Trừ tồn kho",
        "Tính phí ship"
      ], correct: 1, explanation: "Gateway lo việc cắt ngang, không lo nghiệp vụ." },
    { q: "Lợi ích lớn nhất của BFF cho mobile?", options: [
        "Tăng số request",
        "Gom nhiều call thành một, cắt payload theo màn hình, hấp thụ khác biệt phiên bản app",
        "Thay thế database",
        "Không cần HTTPS"
      ], correct: 1, explanation: "Round trip trên mạng di động đắt; trong DC thì rẻ." },
    { q: "Vì sao dùng Promise.allSettled thay vì Promise.all trong BFF?", options: [
        "Nhanh hơn",
        "Một call lỗi không làm hỏng cả kết quả; từng phần được xử lý fallback riêng",
        "Workers không hỗ trợ Promise.all",
        "Để có retry tự động"
      ], correct: 1, explanation: "Promise.all reject ngay khi một promise lỗi." },
    { q: "Đưa quy tắc tính giá vào BFF gây hậu quả gì?", options: [
        "Không sao",
        "Nghiệp vụ bị trùng/phân tán, BFF thành monolith mới; web BFF và mobile BFF có thể tính khác nhau",
        "BFF nhanh hơn",
        "Giảm chi phí"
      ], correct: 1, explanation: "Quy tắc nghiệp vụ ở service sở hữu." },
    { q: "Lợi ích của việc chạy gateway/BFF trên Cloudflare Workers?", options: [
        "Có thể JOIN DB",
        "Chạy ở PoP gần người dùng: TLS, xác thực, cache, rate limit trước khi request đi xa về origin",
        "Không cần timeout",
        "Không giới hạn CPU"
      ], correct: 1, explanation: "Nhưng có giới hạn subrequest/CPU theo gói." },
    { q: "Công ty đổi backend từ Java sang Rust. BFF giúp gì cho app?", options: [
        "Không giúp gì",
        "Giữ nguyên hợp đồng BFF nên app không cần phát hành lại",
        "Tự dịch Java sang Rust",
        "Bắt buộc app cập nhật"
      ], correct: 1, explanation: "BFF là lớp đệm giữa hợp đồng app và backend." },
    { q: "Vì sao gateway phải stateless và chạy nhiều bản?", options: [
        "Cho rẻ",
        "Mọi request đi qua nó; một bản chết không được làm sập cả hệ",
        "Để debug dễ",
        "Không cần thiết"
      ], correct: 1, explanation: "Điểm vào chung là điểm chết chung nếu không nhân bản." },
    { q: "Ai nên sở hữu mobile BFF?", options: [
        "Đội DBA",
        "Đội làm client mobile (hoặc đội sát nó), vì BFF phục vụ nhu cầu màn hình",
        "Đội bảo mật",
        "Nhà cung cấp cloud"
      ], correct: 1, explanation: "Để đổi nhanh theo UI mà không chờ đội service lõi." }
  ]
});
