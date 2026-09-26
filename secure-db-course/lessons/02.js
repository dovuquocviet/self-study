window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "Mô hình 7 lớp phòng thủ cho mọi Database",
  subtitle: "Defense in depth: mỗi lớp giả định lớp trước đã thủng · áp dụng giống nhau cho SQL, NoSQL, cache, stream và serverless",

  theory: `
    <p>Bài 01 vẽ bản đồ <em>các cửa</em>. Bài này đưa ra một <strong>khung phòng thủ 7 lớp</strong> để khoá chúng. Ý tưởng cốt lõi là
    <strong>phòng thủ nhiều lớp (defense in depth)</strong>: không lớp nào hoàn hảo, nên mỗi lớp phải được thiết kế với giả định rằng lớp bên ngoài nó <em>đã bị vượt qua</em>.</p>

    <p><strong>1. Bảy lớp</strong></p>
    <table>
      <tr><th>#</th><th>Lớp</th><th>Mục tiêu</th><th>Biện pháp tiêu biểu</th><th>Bài</th></tr>
      <tr><td>1</td><td>🌐 Mạng</td><td>Chỉ đúng máy cần kết nối mới chạm được DB</td><td>bind địa chỉ nội bộ, firewall/security group, private network, bastion/tunnel</td><td>03</td></tr>
      <tr><td>2</td><td>🔒 Kết nối</td><td>Không ai nghe lén/giả mạo trên đường truyền</td><td>TLS bắt buộc, kiểm tra chứng chỉ (verify-full), mTLS</td><td>04</td></tr>
      <tr><td>3</td><td>🔑 Xác thực</td><td>Biết chắc ai đang kết nối</td><td>không tài khoản mặc định/không mật khẩu, SCRAM, x509, secret manager, rotation</td><td>05–06</td></tr>
      <tr><td>4</td><td>🛂 Phân quyền</td><td>Mỗi tài khoản chỉ làm đúng việc của nó</td><td>least privilege, role theo ứng dụng, RLS/row policy, tắt lệnh nguy hiểm</td><td>07–09</td></tr>
      <tr><td>5</td><td>🧾 Truy vấn</td><td>Dữ liệu không bao giờ biến thành lệnh</td><td>truy vấn có tham số, ép kiểu filter, allowlist tên cột/key, validate message</td><td>10–12</td></tr>
      <tr><td>6</td><td>🗃️ Dữ liệu</td><td>Bị lấy cũng giảm thiệt hại</td><td>mã hoá at-rest & mức field, tối thiểu hoá PII, masking, TTL/retention</td><td>13–19</td></tr>
      <tr><td>7</td><td>⚙️ Vận hành</td><td>Phát hiện, chịu được và khôi phục được</td><td>backup mã hoá & test restore, audit log, giới hạn tài nguyên, tách môi trường</td><td>20–23</td></tr>
    </table>

    <p><strong>2. Vì sao phải đủ các lớp? Một ví dụ</strong></p>
    <p>Giả sử ứng dụng có một lỗi truy vấn (lớp 5 thủng). Kết quả phụ thuộc vào các lớp khác:</p>
    <ul>
      <li>Nếu app dùng superuser (lớp 4 thủng) → kẻ tấn công đọc <em>mọi</em> bảng, mọi tenant, có thể xoá dữ liệu.</li>
      <li>Nếu app chỉ có quyền <code>SELECT</code> trên vài bảng và RLS lọc theo tenant → chỉ lộ dữ liệu của chính tenant đó.</li>
      <li>Nếu cột nhạy cảm được mã hoá mức field (lớp 6) → dữ liệu lộ ra chỉ là bản mã.</li>
      <li>Nếu có audit log + cảnh báo (lớp 7) → phát hiện trong vài phút thay vì vài tháng.</li>
    </ul>
    <p>Một lỗi, bốn kết cục rất khác nhau. Đó là giá trị của phòng thủ nhiều lớp.</p>

    <p><strong>3. Áp 7 lớp cho từng engine</strong> — nguyên tắc giống nhau, chỉ khác "núm vặn":</p>
    <table>
      <tr><th>Lớp</th><th>PostgreSQL</th><th>Redis</th><th>Kafka</th><th>ClickHouse</th><th>MongoDB</th><th>Cloudflare</th></tr>
      <tr><td>Mạng</td><td><code>listen_addresses</code>, <code>pg_hba.conf</code></td><td><code>bind</code>, <code>protected-mode</code></td><td><code>listeners</code></td><td><code>listen_host</code>, <code>&lt;networks&gt;</code></td><td><code>net.bindIp</code></td><td>không có cổng; Hyperdrive + Tunnel</td></tr>
      <tr><td>Kết nối</td><td><code>hostssl</code>, <code>sslmode=verify-full</code></td><td><code>tls-port</code>, <code>rediss://</code></td><td><code>SSL</code>/<code>SASL_SSL</code></td><td><code>https_port</code>, <code>tcp_port_secure</code></td><td><code>net.tls.mode: requireTLS</code></td><td>TLS do nền tảng quản lý</td></tr>
      <tr><td>Xác thực</td><td><code>scram-sha-256</code></td><td>ACL user</td><td>SASL SCRAM/mTLS</td><td>user + password hash</td><td>SCRAM / x509</td><td>binding + API token</td></tr>
      <tr><td>Phân quyền</td><td>GRANT, RLS</td><td>ACL lệnh + key pattern</td><td>ACL topic/group</td><td>GRANT, row policy, readonly</td><td>role theo db/collection</td><td>binding riêng, token phạm vi hẹp</td></tr>
      <tr><td>Truy vấn</td><td><code>$1</code> params</td><td>client lib, không ghép lệnh</td><td>schema message</td><td><code>{id:UInt64}</code></td><td>filter có kiểu</td><td><code>prepare().bind()</code></td></tr>
      <tr><td>Dữ liệu</td><td>mã hoá đĩa/field</td><td>TTL, không cache bừa</td><td><code>retention.ms</code></td><td>TTL, codec mã hoá</td><td>TTL index, CSFLE</td><td>mặc định mã hoá at-rest</td></tr>
      <tr><td>Vận hành</td><td>pgaudit, <code>statement_timeout</code></td><td>ACL LOG, <code>maxmemory</code></td><td>quota, authorizer log</td><td><code>query_log</code>, quotas</td><td>auditLog, <code>maxTimeMS</code></td><td>audit log tài khoản, Time Travel</td></tr>
    </table>

    <p><strong>4. Ba nguyên tắc xuyên suốt</strong></p>
    <ol>
      <li><strong>Mặc định từ chối (deny by default)</strong>: không có luật cho phép rõ ràng → không được. Ví dụ Kafka <code>allow.everyone.if.no.acl.found=false</code>.</li>
      <li><strong>Đặc quyền tối thiểu (least privilege)</strong>: quyền đủ để làm việc, không hơn. Áp dụng cho người, service, cả CI/CD.</li>
      <li><strong>Giả định đã bị xâm nhập (assume breach)</strong>: thiết kế sao cho khi một thành phần bị chiếm, thiệt hại bị khoanh vùng và bị phát hiện.</li>
    </ol>

    <div class="callout"><p>💡 Đừng đánh giá bảo mật DB bằng câu "có mật khẩu chưa?". Hãy hỏi: "Nếu lớp X thủng thì lớp nào còn đỡ?". Nếu câu trả lời là "không lớp nào" —
    đó là điểm chết đơn lẻ (single point of failure) cần xử lý.</p></div>
  `,

  codeTabs: [
    { id: "layers", label: "🧅 7 lớp (pseudo)", lines: [
      "// Mỗi kết nối/truy vấn phải qua đủ 7 lớp",
      "function handle(conn, request):",
      "    require network_allows(conn.source_ip)          // 1. Mạng",
      "    require conn.tls and cert_verified(conn)         // 2. Kết nối",
      "    user = authenticate(conn.credential)             // 3. Xác thực",
      "    require authorized(user, request.action, request.resource)  // 4. Phân quyền",
      "    result = run_parameterized(request.query, request.params)   // 5. Truy vấn",
      "    result = mask_or_decrypt_as_allowed(user, result)          // 6. Dữ liệu",
      "    audit_log(user, request, result.row_count)       // 7. Vận hành",
      "    return result"
    ]},
    { id: "breach", label: "💥 Một lớp thủng", lines: [
      "// Tình huống: lớp 5 thủng (một truy vấn ghép chuỗi bị lợi dụng)",
      "",
      "scenario A: app_user = superuser, không RLS, dữ liệu rõ, không log",
      "    -> đọc/xoá mọi bảng mọi tenant, không ai biết",
      "",
      "scenario B: app_user chỉ SELECT 3 bảng, RLS theo tenant,",
      "            cột nhạy cảm mã hoá, audit log + cảnh báo",
      "    -> chỉ đọc được dữ liệu tenant hiện tại, cột nhạy cảm là bản mã,",
      "       cảnh báo bắn ra sau vài phút",
      "",
      "// Cùng một lỗi, thiệt hại khác nhau hàng trăm lần"
    ]},
    { id: "deny", label: "🚫 Deny by default", lines: [
      "# PostgreSQL: bỏ quyền mặc định của PUBLIC",
      "REVOKE ALL ON DATABASE shop FROM PUBLIC;",
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
      "",
      "# Kafka server.properties: không có ACL thì từ chối",
      "allow.everyone.if.no.acl.found=false",
      "",
      "# Redis users.acl: user mặc định bị tắt",
      "user default off",
      "",
      "# MongoDB mongod.conf",
      "security:",
      "  authorization: enabled"
    ]},
    { id: "review", label: "✅ Câu hỏi review", lines: [
      "// Dùng khi review thiết kế một DB mới",
      "1. Mạng     : DB có IP public không? Ai trong VPC kết nối được?",
      "2. Kết nối  : client có kiểm tra chứng chỉ server không (verify-full)?",
      "3. Xác thực : còn user mặc định/không mật khẩu? credential nằm ở đâu?",
      "4. Phân quyền: mỗi service một tài khoản? có ai dùng quyền admin?",
      "5. Truy vấn : có chỗ nào ghép chuỗi input vào truy vấn/lệnh/key?",
      "6. Dữ liệu  : PII nào đang lưu? có cần không? giữ bao lâu?",
      "7. Vận hành : backup mã hoá? đã restore thử? có audit log? có timeout?",
      "",
      "// Với mỗi lớp: 'nếu lớp này thủng thì lớp nào còn đỡ?'"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Kết nối / truy vấn</div><div class="ns">từ app, người vận hành, hay kẻ tấn công</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="l1"><div class="nl">1 · Mạng</div><div class="ns">ai chạm được</div></div>
      <div class="node" id="l2"><div class="nl">2 · Kết nối</div><div class="ns">TLS</div></div>
      <div class="node" id="l3"><div class="nl">3 · Xác thực</div><div class="ns">là ai</div></div>
      <div class="node" id="l4"><div class="nl">4 · Phân quyền</div><div class="ns">được gì</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="l5"><div class="nl">5 · Truy vấn</div><div class="ns">dữ liệu ≠ lệnh</div></div>
      <div class="node" id="l6"><div class="nl">6 · Dữ liệu</div><div class="ns">mã hoá, tối thiểu</div></div>
      <div class="node" id="l7"><div class="nl">7 · Vận hành</div><div class="ns">log, backup, giới hạn</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="core"><div class="nl">🗄️ Dữ liệu cần bảo vệ</div><div class="ns">mọi engine, cùng một khung</div></div>
  `,
  steps: [
    { title: "1 · Mọi yêu cầu đi qua 7 lớp", tab: "layers", highlight: [2, 3, 4, 5, 6, 7, 8, 9], on: ["req", "a1", "l1", "l2", "l3", "l4", "l5", "l6", "l7"],
      desc: "Mỗi lớp là một câu hỏi riêng. Không lớp nào thay thế được lớp khác: TLS không phải phân quyền, mật khẩu không phải firewall." },
    { title: "2 · Lớp ngoài: mạng, kết nối, xác thực", tab: "layers", highlight: [3, 4, 5], on: ["l1", "l2", "l3"],
      desc: "Ba lớp đầu quyết định <em>ai vào được</em>. Chúng chặn bot quét và kẻ tấn công ngoài mạng, nhưng không chặn được người đi qua ứng dụng hợp lệ." },
    { title: "3 · Lớp trong: quyền và truy vấn", tab: "layers", highlight: [6, 7], on: ["l4", "l5"],
      desc: "Khi kẻ tấn công đi qua ứng dụng, chỉ còn quyền tối thiểu và truy vấn có tham số giữ được ranh giới." },
    { title: "4 · Một lớp thủng: so sánh hai kịch bản", tab: "breach", highlight: [3, 4, 6, 7, 8, 9], on: ["l4", "l6", "l7", "core"],
      desc: "Cùng một lỗi truy vấn, nhưng kịch bản B khoanh vùng thiệt hại nhờ quyền hẹp + RLS + mã hoá field + audit log." },
    { title: "5 · Deny by default trên nhiều engine", tab: "deny", highlight: [2, 3, 6, 9, 12, 13], on: ["l3", "l4"],
      desc: "Mỗi engine có một núm 'mặc định từ chối'. Postgres bỏ quyền PUBLIC, Kafka từ chối khi không có ACL, Redis tắt user default, Mongo bật authorization." },
    { title: "6 · Dùng 7 câu hỏi khi review", tab: "review", highlight: [2, 3, 4, 5, 6, 7, 8, 10], on: ["core"],
      desc: "Khi thiết kế hay review một DB, đi lần lượt 7 câu và luôn hỏi thêm: 'nếu lớp này thủng thì lớp nào còn đỡ?'." }
  ],

  quiz: [
    { q: "'Defense in depth' (phòng thủ nhiều lớp) nghĩa là gì?", options: [
        "Đặt DB ở tầng sâu nhất của mạng là đủ",
        "Mã hoá dữ liệu nhiều lần",
        "Dùng nhiều lớp bảo vệ độc lập, mỗi lớp giả định lớp trước có thể đã bị vượt qua",
        "Dùng nhiều DB khác nhau"
      ], correct: 2,
      explanation: "Không lớp nào hoàn hảo; các lớp độc lập giúp một lỗi đơn lẻ không dẫn tới mất toàn bộ dữ liệu." },
    { q: "DB nằm trong mạng riêng (private network). Có thể bỏ qua xác thực không?", options: [
        "Có, vì không ai từ Internet vào được",
        "Không — một máy/service trong mạng bị chiếm vẫn tới được DB; xác thực là lớp độc lập",
        "Có, nếu dùng TLS",
        "Có, nếu là Redis"
      ], correct: 1,
      explanation: "Mạng riêng chỉ là lớp 1. Kẻ tấn công đã ở trong mạng (qua một service bị chiếm) sẽ gặp ngay DB không mật khẩu." },
    { q: "Biện pháp nào thuộc lớp 'Truy vấn'?", options: [
        "Bật TLS",
        "Mã hoá backup",
        "Đặt maxmemory cho Redis",
        "Dùng truy vấn có tham số và allowlist tên cột"
      ], correct: 3,
      explanation: "Lớp truy vấn đảm bảo dữ liệu người dùng không bao giờ bị hiểu thành lệnh." },
    { q: "Cấu hình Kafka 'allow.everyone.if.no.acl.found=false' thể hiện nguyên tắc nào?", options: [
        "Least privilege cho người vận hành",
        "Assume breach",
        "Deny by default — không có luật cho phép thì từ chối",
        "Mã hoá at-rest"
      ], correct: 2,
      explanation: "Nếu để true, mọi resource chưa có ACL sẽ mở cho tất cả — ngược với mặc định từ chối." },
    { q: "Cùng một lỗi injection. Kịch bản nào khoanh vùng thiệt hại tốt nhất?", options: [
        "App chỉ có quyền tối thiểu, RLS theo tenant, cột nhạy cảm mã hoá, audit log có cảnh báo",
        "App dùng superuser nhưng có firewall",
        "App dùng superuser, dữ liệu rõ, không log",
        "App dùng mật khẩu dài 64 ký tự"
      ], correct: 0,
      explanation: "Các lớp trong (phân quyền, dữ liệu, vận hành) quyết định thiệt hại sau khi một lớp đã thủng." },
    { q: "Với Cloudflare D1/KV/R2, 'lớp xác thực + phân quyền' chủ yếu nằm ở đâu?", options: [
        "Mật khẩu của từng database D1",
        "Redis ACL",
        "File pg_hba.conf",
        "Binding trong Worker và phạm vi quyền của API token"
      ], correct: 3,
      explanation: "Worker truy cập qua binding (không có mật khẩu); công cụ ngoài truy cập qua API token — phạm vi token chính là quyền." },
    { q: "'Assume breach' khuyến khích thiết kế thế nào?", options: [
        "Tin tưởng hoàn toàn mạng nội bộ",
        "Thiết kế sao cho khi một thành phần bị chiếm, thiệt hại bị khoanh vùng và bị phát hiện",
        "Không cần backup vì đã có firewall",
        "Dùng một tài khoản chung cho mọi service để dễ quản lý"
      ], correct: 1,
      explanation: "Giả định sẽ có lúc bị xâm nhập → tách quyền, tách tài khoản, log và cảnh báo để giới hạn và phát hiện." },
    { q: "Lớp 'Vận hành' KHÔNG bao gồm biện pháp nào?", options: [
        "Truy vấn có tham số",
        "Audit log",
        "Giới hạn thời gian truy vấn",
        "Backup mã hoá và thử khôi phục"
      ], correct: 0,
      explanation: "Truy vấn có tham số thuộc lớp 5 (Truy vấn). Vận hành gồm backup, log, giám sát, giới hạn tài nguyên, tách môi trường." },
    { q: "Câu hỏi review hữu ích nhất cho từng lớp là gì?", options: [
        "Lớp này có đắt không?",
        "Lớp này có dùng AI không?",
        "Nếu lớp này thủng thì lớp nào còn đỡ?",
        "Lớp này có nằm trong tài liệu vendor không?"
      ], correct: 2,
      explanation: "Câu hỏi này lộ ra các điểm chết đơn lẻ — nơi chỉ một lỗi là mất tất cả." }
  ]
});
