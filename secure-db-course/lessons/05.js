window.LESSONS.push({
  id: "05",
  phase: "2", phaseName: "Xác thực",
  title: "Xác thực: không mặc định, không bỏ trống mật khẩu",
  subtitle: "SCRAM cho Postgres/Mongo/Kafka · Redis ACL · ClickHouse users · x509 · Cloudflare binding & API token",

  theory: `
    <p>Xác thực (authentication) trả lời câu hỏi: <strong>"Người đang kết nối là ai?"</strong>. Nếu DB không hỏi câu này, mọi lớp phía sau (phân quyền, RLS…) trở nên vô nghĩa
    vì ai cũng là "người được tin". Đây là lớp đã thủng trong gần như mọi vụ lộ DB hàng loạt.</p>

    <p><strong>1. Ba lỗi phải loại bỏ ngay</strong></p>
    <ul>
      <li><strong>Không yêu cầu xác thực</strong>: Postgres <code>trust</code> trong pg_hba; MongoDB chưa bật <code>security.authorization</code>; Redis không có ACL/mật khẩu;
        Kafka listener không có SASL/mTLS; ClickHouse user <code>default</code> mật khẩu rỗng mở ra mạng.</li>
      <li><strong>Tài khoản mặc định</strong>: dùng thẳng <code>postgres</code>, <code>default</code>, <code>admin</code> cho ứng dụng. Tên đã biết trước → kẻ tấn công chỉ phải đoán mật khẩu.</li>
      <li><strong>Mật khẩu yếu/dùng lại</strong>: mật khẩu kiểu "tên công ty + năm", dùng chung giữa dev và prod. Mật khẩu của service nên là chuỗi ngẫu nhiên dài (≥ 32 ký tự) do máy sinh.</li>
    </ul>

    <p><strong>2. Chọn cơ chế xác thực tốt trên từng engine</strong></p>
    <table>
      <tr><th>Engine</th><th>Nên dùng</th><th>Tránh</th><th>Ghi chú</th></tr>
      <tr><td>PostgreSQL</td><td><code>scram-sha-256</code>, hoặc <code>cert</code> (mTLS); IAM auth trên cloud</td><td><code>trust</code>, <code>password</code> (gửi rõ), <code>md5</code> (cũ)</td><td><code>password_encryption = 'scram-sha-256'</code> (mặc định từ PG 14). SCRAM không gửi mật khẩu qua mạng.</td></tr>
      <tr><td>Redis ≥ 6</td><td>ACL user riêng, mật khẩu lưu dạng hash SHA-256 (<code>#...</code>)</td><td>chỉ <code>requirepass</code> dùng chung, user <code>default</code> còn bật</td><td>Lệnh <code>AUTH &lt;user&gt; &lt;pass&gt;</code>; đặt <code>user default off</code>.</td></tr>
      <tr><td>Kafka</td><td>SASL <code>SCRAM-SHA-512</code> qua <code>SASL_SSL</code>, mTLS, hoặc OAUTHBEARER</td><td>SASL <code>PLAIN</code> trên kênh không TLS; listener không xác thực</td><td>Broker cũng xác thực lẫn nhau (inter-broker).</td></tr>
      <tr><td>ClickHouse</td><td>user riêng, <code>sha256_password</code>/<code>bcrypt_password</code>, hoặc <code>ssl_certificate</code></td><td>user <code>default</code> không mật khẩu, <code>plaintext_password</code></td><td>Có thể giới hạn user theo IP (<code>HOST IP</code> / <code>&lt;networks&gt;</code>).</td></tr>
      <tr><td>MongoDB</td><td><code>SCRAM-SHA-256</code>, hoặc <code>MONGODB-X509</code></td><td>chạy không bật authorization</td><td>Bật auth, tạo admin đầu tiên qua "localhost exception", rồi tạo user riêng cho app.</td></tr>
      <tr><td>Cloudflare D1/KV/R2/DO</td><td><strong>Binding</strong> trong Worker (không có mật khẩu); API token phạm vi hẹp cho công cụ ngoài</td><td>Global API Key; token "All accounts / All zones"; nhúng token trong code</td><td>Quyền nằm ở: Worker nào có binding nào + token được cấp quyền gì.</td></tr>
    </table>

    <p><strong>3. Cloudflare: "không có mật khẩu" không có nghĩa là "không có xác thực"</strong></p>
    <p>Một Worker khai báo binding <code>DB</code> tới D1 có thể truy vấn D1 đó — nền tảng đã xác thực Worker thay bạn. Do đó:</p>
    <ul>
      <li>Ai deploy được Worker (có token <em>Workers Scripts: Edit</em>) = gián tiếp có quyền trên mọi binding → bảo vệ token deploy như mật khẩu DB.</li>
      <li>Công cụ bên ngoài (CI chạy migration, script sao lưu) dùng API token: chỉ cấp đúng quyền (ví dụ <em>D1: Edit</em> trên một account), đặt TTL, giới hạn IP nếu được.</li>
      <li>R2 qua S3 API dùng Access Key/Secret sinh từ R2 API token — chọn quyền "Object Read" hoặc "Object Read &amp; Write" và <em>chỉ định bucket</em>.</li>
      <li>Hyperdrive giữ mật khẩu DB gốc trong cấu hình của nó; Worker chỉ thấy <code>env.HYPERDRIVE.connectionString</code>. Mật khẩu vẫn cần mạnh và được xoay vòng.</li>
    </ul>

    <p><strong>4. Tạo tài khoản đúng cách</strong></p>
    <ul>
      <li>Không gõ mật khẩu thẳng trong câu lệnh SQL (nằm lại trong lịch sử shell, log server). Dùng <code>\\password</code> của psql, <code>passwordPrompt()</code> của mongosh, hoặc sinh từ secret manager.</li>
      <li>Mỗi service một tài khoản (bài 06–07) — để khi có sự cố biết ngay ai đã làm gì, và thu hồi một tài khoản không làm sập cả hệ thống.</li>
      <li>Tài khoản admin: chỉ dùng từ bastion, có MFA ở tầng truy cập (SSO/VPN), không bao giờ nằm trong cấu hình ứng dụng.</li>
    </ul>

    <div class="callout"><p>💡 Kiểm tra sau khi cấu hình: thử kết nối <em>không</em> có credential và với user mặc định — phải bị từ chối.
    Với Postgres: <code>SELECT rolname FROM pg_authid WHERE rolcanlogin AND (rolpassword IS NULL OR rolpassword LIKE 'md5%');</code> liệt kê role đăng nhập được mà không có mật khẩu hoặc còn dùng md5.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "🐘 Postgres SCRAM", lines: [
      "# postgresql.conf",
      "password_encryption = 'scram-sha-256'",
      "",
      "# pg_hba.conf — không 'trust', không 'md5'",
      "local    all   postgres                 peer",
      "hostssl  shop  app_orders  10.0.1.0/24  scram-sha-256",
      "hostssl  shop  svc_etl     10.0.3.0/24  cert           # danh tính = CN của cert client",
      "",
      "-- Tạo role cho app, không gõ mật khẩu trong câu lệnh",
      "CREATE ROLE app_orders LOGIN;",
      "\\password app_orders          -- psql hỏi mật khẩu, gửi dạng đã băm SCRAM",
      "",
      "-- Rà soát role yếu",
      "SELECT rolname FROM pg_authid",
      " WHERE rolcanlogin AND (rolpassword IS NULL OR rolpassword LIKE 'md5%');"
    ]},
    { id: "redis", label: "🟥 Redis ACL", lines: [
      "# redis.conf",
      "aclfile /etc/redis/users.acl",
      "",
      "# /etc/redis/users.acl",
      "user default off                                   # tắt user mặc định",
      "user app_cache on #<sha256-hex-cua-mat-khau> ~cache:* +@read +@write -@dangerous",
      "user ops_admin on #<sha256-hex> ~* &* +@all          # chỉ dùng từ bastion",
      "",
      "# Client xác thực bằng user + mật khẩu (Redis 6+)",
      "AUTH app_cache <mat-khau-tu-secret-manager>",
      "",
      "# Kiểm tra: kết nối không AUTH phải bị từ chối (NOAUTH)",
      "ACL WHOAMI",
      "ACL LIST"
    ]},
    { id: "kafka", label: "📨 Kafka SASL", lines: [
      "# server.properties (broker)",
      "listener.security.protocol.map=INTERNAL:SASL_SSL",
      "sasl.enabled.mechanisms=SCRAM-SHA-512",
      "sasl.mechanism.inter.broker.protocol=SCRAM-SHA-512",
      "",
      "# Tạo credential SCRAM cho từng service",
      "kafka-configs.sh --bootstrap-server kafka-1.internal:9093 \\",
      "  --command-config admin.properties --alter \\",
      "  --add-config 'SCRAM-SHA-512=[iterations=8192,password=<tu-secret-manager>]' \\",
      "  --entity-type users --entity-name orders-svc",
      "",
      "# client.properties của orders-svc",
      "security.protocol=SASL_SSL",
      "sasl.mechanism=SCRAM-SHA-512",
      "sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"orders-svc\" password=\"<inject-luc-chay>\";"
    ]},
    { id: "mongoch", label: "🍃 Mongo & 🟨 ClickHouse", lines: [
      "# mongod.conf",
      "security:",
      "  authorization: enabled",
      "setParameter:",
      "  authenticationMechanisms: SCRAM-SHA-256,MONGODB-X509",
      "",
      "// mongosh — user cho app, mật khẩu nhập tương tác",
      "db.getSiblingDB('orders').createUser({ user: 'orders_app', pwd: passwordPrompt(),",
      "  roles: [ { role: 'readWrite', db: 'orders' } ], mechanisms: ['SCRAM-SHA-256'] })",
      "",
      "-- ClickHouse: user riêng, mật khẩu băm, giới hạn IP",
      "CREATE USER app_ro IDENTIFIED WITH sha256_password BY '<tu-secret-manager>'",
      "    HOST IP '10.0.2.0/24';",
      "CREATE USER etl IDENTIFIED WITH ssl_certificate CN 'etl.internal';",
      "<!-- users.d/default.xml: khoá user default về localhost + có mật khẩu -->",
      "<clickhouse><users><default>",
      "  <password_sha256_hex>...</password_sha256_hex>",
      "  <networks><ip>::1</ip><ip>127.0.0.1</ip></networks>",
      "</default></users></clickhouse>"
    ]},
    { id: "cf", label: "☁️ Cloudflare", lines: [
      "# wrangler.toml — Worker được xác thực với D1 qua binding, không mật khẩu",
      "[[d1_databases]]",
      "binding = \"DB\"",
      "database_name = \"shop-prod\"",
      "database_id = \"<uuid>\"",
      "",
      "// Worker",
      "export default { async fetch(req, env) {",
      "  const row = await env.DB.prepare('SELECT 1').first()   // không có credential trong code",
      "} }",
      "",
      "# Công cụ ngoài (CI migration): API token phạm vi hẹp",
      "#   Permissions: Account > D1 > Edit   (chỉ account này)",
      "#   Client IP filtering: IP của runner CI  ·  TTL: có hạn",
      "export CLOUDFLARE_API_TOKEN=<token-tu-secret-cua-CI>",
      "wrangler d1 migrations apply shop-prod --remote"
    ]}
  ],

  stageHtml: `
    <div class="node" id="who"><div class="nl">❓ Ai đang kết nối?</div><div class="ns">app, người vận hành, CI, bot</div></div>
    <div class="arrow" id="a1">↓ trình credential</div>
    <div class="row">
      <div class="node" id="pwd"><div class="nl">🔑 Mật khẩu (SCRAM)</div><div class="ns">Postgres · Mongo · Kafka · Redis ACL · ClickHouse</div></div>
      <div class="node" id="cert"><div class="nl">📜 Chứng chỉ (x509)</div><div class="ns">pg cert · MONGODB-X509 · Kafka mTLS · CH ssl_certificate</div></div>
      <div class="node" id="bind"><div class="nl">🔗 Binding / API token</div><div class="ns">D1 · KV · R2 · DO · Hyperdrive</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ Danh tính riêng cho từng service</div><div class="ns">sang lớp phân quyền</div></div>
      <div class="node" id="deny"><div class="nl">⛔ Từ chối</div><div class="ns">không credential · user mặc định · trust</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Postgres: SCRAM, không trust/md5", tab: "pg", highlight: [2, 5, 6, 7], on: ["who", "a1", "pwd", "cert"],
      desc: "SCRAM chứng minh biết mật khẩu mà không gửi mật khẩu. <code>cert</code> dùng chứng chỉ client làm danh tính. <code>trust</code> = ai cũng vào." },
    { title: "2 · Không gõ mật khẩu vào câu lệnh", tab: "pg", highlight: [10, 11, 14, 15], on: ["pwd"],
      desc: "<code>\\password</code> gửi dạng đã băm, không để lại mật khẩu rõ trong log. Truy vấn rà soát tìm role không mật khẩu hoặc còn md5." },
    { title: "3 · Redis: tắt default, user riêng", tab: "redis", highlight: [2, 5, 6, 10], on: ["pwd", "deny"],
      desc: "<code>user default off</code> đóng cửa không mật khẩu. Mỗi app một user với mật khẩu lưu dạng hash (<code>#...</code>)." },
    { title: "4 · Kafka: SCRAM qua SASL_SSL", tab: "kafka", highlight: [2, 3, 4, 9, 10, 13, 14], on: ["pwd", "ok"],
      desc: "Mỗi service một principal SCRAM, broker cũng xác thực lẫn nhau. Mật khẩu inject lúc chạy, không commit file properties có mật khẩu." },
    { title: "5 · Mongo & ClickHouse", tab: "mongoch", highlight: [3, 5, 8, 9, 12, 13, 14, 17, 18], on: ["pwd", "cert", "ok"],
      desc: "Mongo bật <code>authorization</code> rồi tạo user theo db. ClickHouse: user riêng mật khẩu băm + giới hạn IP; user <code>default</code> bị khoá về localhost." },
    { title: "6 · Cloudflare: binding + token phạm vi hẹp", tab: "cf", highlight: [2, 3, 9, 13, 14, 15], on: ["bind", "ok"],
      desc: "Worker không cầm mật khẩu — binding là quyền. Công cụ ngoài dùng API token chỉ có quyền cần thiết, giới hạn IP và có hạn." }
  ],

  quiz: [
    { q: "Dòng pg_hba 'host all all 10.0.0.0/8 trust' có nghĩa là gì?", options: [
        "Chỉ user tin cậy mới vào",
        "Bắt buộc TLS",
        "Mọi kết nối từ 10.0.0.0/8 được vào với bất kỳ user nào mà không cần mật khẩu",
        "Dùng xác thực Kerberos"
      ], correct: 2,
      explanation: "'trust' bỏ qua xác thực hoàn toàn. Bất kỳ máy nào trong dải đó (kể cả máy bị chiếm) đều vào được với tư cách superuser." },
    { q: "Vì sao SCRAM-SHA-256 tốt hơn phương thức 'password' của Postgres?", options: [
        "SCRAM chứng minh biết mật khẩu mà không gửi mật khẩu qua mạng, và server lưu dạng băm có salt",
        "SCRAM nhanh hơn",
        "SCRAM không cần mật khẩu",
        "SCRAM tự động xoay mật khẩu"
      ], correct: 0,
      explanation: "'password' gửi mật khẩu dạng rõ (chỉ an toàn nếu có TLS). SCRAM là challenge-response." },
    { q: "Với Redis 6+, cấu hình nào đóng cửa kết nối không mật khẩu?", options: [
        "rename-command AUTH ''",
        "appendonly yes",
        "maxmemory 0",
        "user default off (và tạo ACL user riêng cho từng app)"
      ], correct: 3,
      explanation: "User 'default' là user mà kết nối chưa AUTH dùng. Tắt nó buộc mọi client phải xác thực bằng user riêng." },
    { q: "Worker trên Cloudflare truy cập D1 qua binding. Điều nào đúng?", options: [
        "Không có xác thực nên ai cũng truy cập được D1",
        "Nền tảng xác thực Worker; ai deploy được Worker có binding thì gián tiếp có quyền trên D1 — phải bảo vệ token deploy",
        "Phải đặt mật khẩu D1 trong code Worker",
        "D1 chỉ truy cập được qua cổng 5432"
      ], correct: 1,
      explanation: "Binding thay cho mật khẩu. Quyền thực sự nằm ở việc ai được deploy code gắn binding đó." },
    { q: "Kafka dùng SASL PLAIN trên listener SASL_PLAINTEXT. Vấn đề là gì?", options: [
        "Tên đăng nhập và mật khẩu đi qua mạng ở dạng rõ, ai nghe lén cũng lấy được",
        "PLAIN không hỗ trợ nhiều user",
        "Kafka không chạy được",
        "Không có vấn đề"
      ], correct: 0,
      explanation: "PLAIN chỉ chấp nhận được khi đi trên TLS (SASL_SSL). Ưu tiên SCRAM-SHA-512 hoặc mTLS/OAUTHBEARER." },
    { q: "Tạo user Mongo cho ứng dụng, cách nào an toàn hơn?", options: [
        "Dùng user admin có role root cho tiện",
        "Tắt authorization để app kết nối nhanh",
        "createUser với pwd: passwordPrompt() (hoặc từ secret manager), role readWrite chỉ trên db của app",
        "Dùng chung user với team BI"
      ], correct: 2,
      explanation: "Mật khẩu không nằm trong lịch sử lệnh, quyền giới hạn theo db, mỗi app một user." },
    { q: "API token Cloudflare cho job CI chạy migration D1 nên có phạm vi thế nào?", options: [
        "Global API Key để tránh lỗi quyền",
        "Chỉ quyền D1 Edit trên account cần thiết, giới hạn IP runner nếu được, có thời hạn",
        "Quyền admin mọi account và zone",
        "Token của cá nhân trưởng nhóm"
      ], correct: 1,
      explanation: "Token là credential. Phạm vi hẹp giới hạn thiệt hại khi token bị lộ từ log CI." },
    { q: "Điều gì KHÔNG phải là thực hành tốt khi tạo tài khoản DB?", options: [
        "Mỗi service một tài khoản",
        "Mật khẩu ngẫu nhiên dài do máy sinh",
        "Admin chỉ dùng từ bastion có MFA",
        "Gõ mật khẩu trực tiếp trong câu CREATE USER trên terminal dùng chung rồi để lại trong lịch sử shell"
      ], correct: 3,
      explanation: "Mật khẩu trong câu lệnh có thể nằm lại trong lịch sử shell, log truy vấn, log audit." },
    { q: "ClickHouse user 'default' không mật khẩu, networks '::/0'. Cách khắc phục hợp lý?", options: [
        "Đổi tên cổng 8123",
        "Bật readonly cho default là đủ",
        "Đặt mật khẩu băm cho default và giới hạn networks về localhost; tạo user riêng cho app",
        "Không cần làm gì nếu chỉ dùng HTTP"
      ], correct: 2,
      explanation: "User mặc định mở ra mọi IP không mật khẩu là cửa vào. Khoá nó lại và cấp user riêng có quyền hẹp." }
  ]
});
