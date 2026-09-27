window.LESSONS.push({
  id: "19",
  phase: "4", phaseName: "Vận hành",
  title: "Bảo mật giữa service: mTLS, JWT & zero trust",
  subtitle: "Xác thực service vs người dùng · mTLS & danh tính workload · truyền JWT, audience, token exchange · edge → origin · Kafka ACL · secret",

  theory: `
    <p>Mô hình cũ: "trong mạng nội bộ là tin nhau". Một pod bị chiếm (lỗ hổng thư viện, SSRF) là đi lại tự do, gọi thẳng payment-service.
    <strong>Zero trust</strong>: mọi lời gọi phải trả lời được hai câu — <em>service nào đang gọi?</em> và <em>thay mặt người dùng nào, với quyền gì?</em></p>

    <p><strong>1. Danh tính service — mTLS</strong></p>
    <ul>
      <li>TLS thường: client kiểm chứng chỉ server. <strong>mTLS</strong>: server cũng đòi và kiểm chứng chỉ client → biết chính xác service nào gọi, và kênh được mã hoá.</li>
      <li>Chứng chỉ ngắn hạn (giờ–ngày), cấp và xoay tự động bởi CA nội bộ/service mesh (Istio, Linkerd) hoặc SPIFFE/SPIRE; danh tính dạng <code>spiffe://shop/ns/prod/sa/order-service</code>.</li>
      <li>Có danh tính rồi mới làm được <strong>phân quyền giữa service</strong>: chỉ order-service và refund-service được gọi <code>payment.Capture</code>.</li>
    </ul>

    <p><strong>2. Danh tính người dùng — JWT</strong></p>
    <ul>
      <li>Gateway/Worker kiểm access token của app (chữ ký, <code>exp</code>, <code>iss</code>, <code>aud</code>). Service phía sau <strong>vẫn kiểm lại</strong> (hoặc nhận token nội bộ do gateway ký) — không tin header <code>X-User-Id</code> trần nếu ai trong mạng cũng giả được.</li>
      <li><strong>Audience</strong>: token cấp cho <code>aud=mobile-api</code> không nên dùng được để gọi thẳng <code>aud=payment</code>. Muốn chuyển tiếp sang service khác với quyền hẹp hơn → <strong>token exchange</strong> (RFC 8693) hoặc token nội bộ ngắn hạn.</li>
      <li>Service kiểm JWT bằng khoá công khai từ JWKS (cache, xoay khoá theo <code>kid</code>), không gọi IdP mỗi request.</li>
      <li>Quyền theo dữ liệu vẫn là việc của service: token nói "user cus_12", service phải kiểm <code>order.customer_id == cus_12</code> (chống IDOR).</li>
    </ul>

    <p><strong>3. Edge → origin</strong>: nếu origin công khai trên Internet, kẻ tấn công vòng qua Cloudflare (bỏ qua WAF, rate limit). Khoá lại bằng:
    <strong>Cloudflare Tunnel</strong> (origin không mở cổng vào, chỉ kết nối ra), hoặc <strong>Authenticated Origin Pulls</strong> (mTLS: origin chỉ nhận kết nối có chứng chỉ client của Cloudflare),
    hoặc Cloudflare Access service token cho API nội bộ.</p>

    <p><strong>4. Kafka và dữ liệu</strong>: TLS + SASL để client xác thực, <strong>ACL</strong> theo principal (notification-svc chỉ được READ <code>order.v1</code>, không WRITE).
    Mỗi service một user DB với quyền tối thiểu (bài 03). <strong>Secret</strong> không nằm trong git/ảnh container: dùng secret manager/K8s secret; Workers dùng <code>wrangler secret put</code>.</p>

    <div class="callout"><p>💡 Spring Security + <code>spring-boot-starter-oauth2-resource-server</code> kiểm JWT bằng vài dòng cấu hình. Rust: crate <code>jsonwebtoken</code> (decode + <code>Validation</code> với iss/aud) và <code>rustls</code> cho TLS/mTLS;
    với service mesh, mTLS nằm ở sidecar/proxy nên code không đổi — nhưng bạn vẫn phải hiểu nó để đọc lỗi <em>"certificate unknown"</em> lúc 2 giờ sáng.</p></div>
  `,

  codeTabs: [
    { id: "jwt", label: "① Kiểm JWT (Rust)", lines: [
      "let header = jsonwebtoken::decode_header(token)?;",
      "let key = jwks.get(&header.kid.ok_or(AuthError::NoKid)?)   // cache JWKS, làm mới khi gặp kid lạ",
      "    .ok_or(AuthError::UnknownKid)?;",
      "",
      "let mut v = Validation::new(Algorithm::RS256);           // cố định thuật toán",
      "v.set_issuer(&[\"https://id.shop.vn\"]);",
      "v.set_audience(&[\"order-service\"]);                     // token cho service khác bị từ chối",
      "v.leeway = 30;                                           // lệch đồng hồ tối đa 30 s",
      "let claims = jsonwebtoken::decode::<Claims>(token, &key, &v)?.claims;",
      "",
      "// phân quyền theo dữ liệu: chống IDOR",
      "if order.customer_id != claims.sub { return Err(ApiError::NotFound); }"
    ]},
    { id: "mtls", label: "② mTLS (rustls)", lines: [
      "// payment-service: chỉ nhận client có chứng chỉ do CA nội bộ cấp",
      "let roots = load_ca(\"/etc/certs/internal-ca.pem\")?;",
      "let verifier = WebPkiClientVerifier::builder(Arc::new(roots)).build()?;",
      "let cfg = ServerConfig::builder()",
      "    .with_client_cert_verifier(verifier)                     // bắt buộc cert client",
      "    .with_single_cert(load_certs(\"svc.pem\")?, load_key(\"svc.key\")?)?;",
      "",
      "// sau bắt tay: đọc danh tính từ SAN của cert client",
      "// spiffe://shop/ns/prod/sa/order-service  -> cho phép Capture",
      "// spiffe://shop/ns/prod/sa/reco-service   -> 403"
    ]},
    { id: "authz", label: "③ Phân quyền giữa service", lines: [
      "# Istio AuthorizationPolicy (khi dùng mesh): chỉ order & refund gọi được payment",
      "apiVersion: security.istio.io/v1",
      "kind: AuthorizationPolicy",
      "metadata: { name: payment-callers, namespace: prod }",
      "spec:",
      "  selector: { matchLabels: { app: payment } }",
      "  action: ALLOW",
      "  rules:",
      "  - from:",
      "    - source:",
      "        principals: [\"cluster.local/ns/prod/sa/order-service\",",
      "                     \"cluster.local/ns/prod/sa/refund-service\"]"
    ]},
    { id: "edge", label: "④ Edge → origin & Kafka", lines: [
      "# Origin không mở cổng: Cloudflare Tunnel chỉ kết nối ra",
      "cloudflared tunnel run --token <TUNNEL_TOKEN>",
      "",
      "# Secret cho Worker, không nằm trong wrangler.toml/git",
      "npx wrangler secret put ORIGIN_API_KEY",
      "",
      "# Kafka ACL: notification chỉ đọc",
      "kafka-acls.sh --bootstrap-server kafka:9093 --command-config admin.properties --add \\",
      "  --allow-principal User:notification-svc --operation Read \\",
      "  --topic order.v1 --group notification-svc"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">access token aud=mobile-api</div></div>
    <div class="arrow" id="a1">↓ HTTPS</div>
    <div class="node" id="edge"><div class="nl">☁️ Worker / gateway</div><div class="ns">kiểm JWT · WAF · rate limit</div></div>
    <div class="arrow" id="a2">↓ Tunnel / origin mTLS (không vòng qua được)</div>
    <div class="row">
      <div class="node" id="order"><div class="nl">🦀 order</div><div class="ns">kiểm lại JWT · IDOR</div></div>
      <div class="node" id="pay"><div class="nl">🦀 payment</div><div class="ns">mTLS: chỉ order/refund</div></div>
    </div>
    <div class="node" id="kafka"><div class="nl">📨 Kafka</div><div class="ns">TLS + SASL + ACL</div></div>
  `,
  steps: [
    { title: "1 · Kiểm JWT đầy đủ", tab: "jwt", highlight: [2, 5, 6, 7, 8], on: ["a1", "edge", "order"],
      desc: "Cố định thuật toán, kiểm iss và aud, khoá theo kid từ JWKS đã cache." },
    { title: "2 · Token hợp lệ chưa đủ", tab: "jwt", highlight: [11, 12], on: ["order"],
      desc: "Đơn phải thuộc đúng user. Trả 404 thay 403 để không lộ sự tồn tại của đơn." },
    { title: "3 · mTLS cho danh tính service", tab: "mtls", highlight: [3, 5, 9, 10], on: ["pay"],
      desc: "payment biết chính xác ai gọi nhờ chứng chỉ client; kênh được mã hoá." },
    { title: "4 · Chính sách ai được gọi ai", tab: "authz", highlight: [6, 7, 11, 12], on: ["order", "pay"],
      desc: "Với mesh, mTLS và phân quyền nằm ở proxy; code service không đổi." },
    { title: "5 · Không cho vòng qua edge", tab: "edge", highlight: [2, 5], on: ["a2"],
      desc: "Tunnel: origin không có cổng mở. Secret nằm trong kho secret, không trong git." },
    { title: "6 · Kafka cũng cần quyền tối thiểu", tab: "edge", highlight: [8, 9, 10], on: ["kafka"],
      desc: "Service chỉ đọc không được ghi; một consumer bị chiếm không thể bơm event giả." }
  ],

  quiz: [
    { q: "mTLS khác TLS thường ở điểm nào?", options: [
        "Mã hoá mạnh hơn",
        "Cả server lẫn client đều trình và kiểm chứng chỉ → server biết chính xác service nào gọi",
        "Không cần chứng chỉ",
        "Chỉ dùng cho trình duyệt"
      ], correct: 1, explanation: "Cho danh tính workload và mã hoá kênh." },
    { q: "Vì sao service phía sau không nên tin header X-User-Id trần?", options: [
        "Header bị mất",
        "Bất kỳ ai trong mạng gọi được service đều có thể giả header đó",
        "Header quá dài",
        "HTTP/2 không hỗ trợ"
      ], correct: 1, explanation: "Cần token có chữ ký hoặc kênh đã xác thực (mTLS) từ gateway." },
    { q: "Claim aud trong JWT dùng để?", options: [
        "Lưu tên người dùng",
        "Chỉ định service đích; service từ chối token cấp cho service khác",
        "Thời hạn",
        "Thuật toán ký"
      ], correct: 1, explanation: "Hạn chế token bị dùng sai chỗ." },
    { q: "Token hợp lệ của user A gọi GET /orders/ord_của_B. Lỗi thiết kế nếu trả dữ liệu?", options: [
        "Không lỗi",
        "IDOR — thiếu kiểm tra quyền theo dữ liệu (đơn phải thuộc user trong token)",
        "CSRF",
        "XSS"
      ], correct: 1, explanation: "Xác thực ≠ phân quyền." },
    { q: "Origin có IP công khai, chỉ Cloudflare nên gọi. Cách khoá chắc nhất?", options: [
        "Giấu IP",
        "Cloudflare Tunnel (không mở cổng vào) hoặc Authenticated Origin Pulls (mTLS)",
        "Đổi cổng 8080",
        "Kiểm header User-Agent"
      ], correct: 1, explanation: "Giấu IP không phải biện pháp bảo mật." },
    { q: "Service kiểm JWT hiệu quả thế nào?", options: [
        "Gọi IdP introspect mỗi request",
        "Kiểm chữ ký bằng khoá công khai từ JWKS đã cache, làm mới khi gặp kid lạ",
        "Không kiểm",
        "So sánh chuỗi token với DB"
      ], correct: 1, explanation: "Nhanh, không phụ thuộc IdP mỗi request." },
    { q: "Muốn order-service gọi payment thay mặt user với quyền hẹp hơn. Chuẩn phù hợp?", options: [
        "Chuyển nguyên token của app",
        "Token exchange (RFC 8693) hoặc token nội bộ ngắn hạn aud=payment",
        "Dùng mật khẩu user",
        "Không cần token"
      ], correct: 1, explanation: "Hạn chế phạm vi nếu token bị lộ." },
    { q: "Secret của Worker nên đặt ở đâu?", options: [
        "wrangler.toml trong git",
        "wrangler secret put (lưu mã hoá phía Cloudflare, đọc qua env)",
        "Hard-code trong code",
        "Query string"
      ], correct: 1, explanation: "Không để secret trong repo." },
    { q: "Kafka ACL cho notification-svc hợp lý nhất?", options: [
        "All trên mọi topic",
        "Read trên order.v1 và group của nó, không Write",
        "Không cần ACL trong mạng nội bộ",
        "Write trên mọi topic"
      ], correct: 1, explanation: "Quyền tối thiểu hạn chế thiệt hại khi bị chiếm." }
  ]
});
