window.LESSONS.push({
  id: "24",
  phase: "6", phaseName: "Vận hành",
  title: "Checklist hardening theo từng engine (tổng kết)",
  subtitle: "Gom 23 bài thành checklist dùng được ngay cho PostgreSQL, Redis, Kafka, ClickHouse, MongoDB và Cloudflare D1/KV/R2/Durable Objects/Hyperdrive",

  theory: `
    <p>Bài cuối gom toàn bộ khoá học thành <strong>checklist theo 7 lớp</strong> (bài 02) cho từng engine. Dùng nó khi dựng DB mới, khi review hạ tầng, hoặc làm bài tự kiểm tra định kỳ.
    Mỗi dòng có số bài để bạn quay lại xem chi tiết.</p>

    <p><strong>1. Checklist chung — áp cho mọi DB</strong></p>
    <table>
      <tr><th>Lớp</th><th>Câu hỏi phải trả lời "có"</th><th>Bài</th></tr>
      <tr><td>Mạng</td><td>DB không có IP public, bind địa chỉ nội bộ, firewall chỉ cho nguồn cần thiết, người vận hành đi qua bastion/tunnel?</td><td>03</td></tr>
      <tr><td>Kết nối</td><td>Chỉ còn cổng TLS; client kiểm tra chứng chỉ (verify-full / không tắt hostname verification)?</td><td>04</td></tr>
      <tr><td>Xác thực</td><td>Không user mặc định/không mật khẩu; SCRAM/x509; mỗi service một tài khoản; credential trong secret manager, có xoay vòng?</td><td>05–06</td></tr>
      <tr><td>Phân quyền</td><td>App chỉ có quyền tối thiểu, không admin; RLS/row policy/lớp repository cho multi-tenant; tính năng nguy hiểm đã tắt?</td><td>07–09</td></tr>
      <tr><td>Truy vấn</td><td>Mọi truy vấn có tham số; identifier qua allowlist; filter NoSQL có kiểu; key do server dựng; message được validate?</td><td>10–12</td></tr>
      <tr><td>Dữ liệu</td><td>Biết PII nằm đâu; tối thiểu hoá; mã hoá at-rest + field khi cần; TTL/retention cho mọi nơi chứa dữ liệu tạm?</td><td>13–19</td></tr>
      <tr><td>Vận hành</td><td>Backup mã hoá, bất biến, đã test restore; audit log ra SIEM có cảnh báo; giới hạn tài nguyên; migration tách quyền; dev không có dữ liệu prod?</td><td>20–23</td></tr>
    </table>

    <p><strong>2. PostgreSQL</strong></p>
    <ul>
      <li><code>listen_addresses</code> nội bộ; pg_hba chỉ <code>hostssl</code> + <code>scram-sha-256</code>/<code>cert</code>, dòng <code>reject</code> cuối; không <code>trust</code>.</li>
      <li><code>ssl = on</code>, <code>ssl_min_protocol_version = 'TLSv1.2'</code>; client <code>sslmode=verify-full</code>.</li>
      <li>App không SUPERUSER/BYPASSRLS/CREATEROLE, không owner bảng; <code>REVOKE CREATE ON SCHEMA public FROM PUBLIC</code>; không ai thuộc <code>pg_execute_server_program</code>/<code>pg_*_server_files</code> ngoài admin.</li>
      <li>RLS + <code>FORCE</code> cho bảng theo tenant; <code>set_config(..., true)</code> trong transaction.</li>
      <li><code>statement_timeout</code>, <code>idle_in_transaction_session_timeout</code>, <code>CONNECTION LIMIT</code> theo role; PgBouncer.</li>
      <li>pgaudit (<code>ddl, role</code> + object audit), <code>log_connections</code>; pgBackRest/WAL-G có mã hoá + WAL archive.</li>
    </ul>

    <p><strong>3. Redis</strong></p>
    <ul>
      <li><code>bind</code> nội bộ, <code>protected-mode yes</code>; <code>port 0</code> + <code>tls-port</code>; replication/cluster qua TLS.</li>
      <li><code>user default off</code>; ACL mỗi app: <code>-@all</code> + lệnh cần, <code>~prefix:*</code>; không <code>@dangerous</code>/<code>@admin</code>.</li>
      <li><code>enable-protected-configs no</code>, <code>enable-module-command no</code>, <code>enable-debug-command no</code>.</li>
      <li><code>maxmemory</code> + policy phù hợp mục đích; instance riêng cho session/rate limit (<code>noeviction</code>); <code>maxclients</code>; mọi key tạm có TTL.</li>
      <li>Cache thuần tắt persistence; RDB/AOF (nếu có) mã hoá khi sao lưu; <code>ACL LOG</code> được thu thập.</li>
    </ul>

    <p><strong>4. Kafka</strong></p>
    <ul>
      <li>Listener chỉ <code>SASL_SSL</code>/<code>SSL</code>; controller KRaft dùng mTLS; client không tắt <code>ssl.endpoint.identification.algorithm</code>.</li>
      <li>SCRAM/mTLS/OAuth mỗi service một principal; <code>StandardAuthorizer</code>, <code>allow.everyone.if.no.acl.found=false</code>, <code>super.users</code> tối thiểu.</li>
      <li>ACL theo topic/group/transactional-id; <code>auto.create.topics.enable=false</code>; topic + ACL qua IaC.</li>
      <li>Quota mặc định; <code>message.max.bytes</code>, <code>max.connections.per.ip</code>.</li>
      <li>Retention rõ ràng cho mọi topic; topic PII được phân loại; tombstone cho compacted topic.</li>
      <li>Schema Registry, Connect, REST Proxy, UI: nội bộ, HTTPS, có xác thực; secret connector qua config provider; authorizer log ra SIEM.</li>
    </ul>

    <p><strong>5. ClickHouse</strong></p>
    <ul>
      <li><code>listen_host</code> nội bộ; chỉ <code>https_port</code>/<code>tcp_port_secure</code>; user <code>default</code> bị khoá.</li>
      <li>SQL-driven access control; role chỉ SELECT; không cấp <code>SOURCES</code>; <code>HOST IP</code> cho user; row policy cho user theo tenant.</li>
      <li>Settings profile (<code>readonly</code>, <code>max_memory_usage</code>, <code>max_execution_time</code>…) + constraints + quota.</li>
      <li>Không PII rõ trong kho (dùng HMAC); TTL bảng/cột; encrypted disk nếu cần; <code>query_log</code>/<code>session_log</code> đẩy ra ngoài; trình duyệt không gọi thẳng HTTP interface.</li>
    </ul>

    <p><strong>6. MongoDB</strong></p>
    <ul>
      <li><code>net.bindIp</code> nội bộ; <code>net.tls.mode: requireTLS</code>; <code>security.authorization: enabled</code>.</li>
      <li>SCRAM-SHA-256/x509; custom role theo collection; không <code>root</code>/<code>dbOwner</code>/<code>userAdmin*</code> cho app.</li>
      <li><code>security.javascriptEnabled: false</code>; validate kiểu, <code>$eq</code>/<code>sanitizeFilter</code>, <code>$set</code> theo allowlist.</li>
      <li>Lớp repository ép <code>tenantId</code>; TTL index; CSFLE/Queryable Encryption cho field nhạy cảm; <code>maxTimeMS</code>; auditLog (Enterprise/Atlas/Percona).</li>
    </ul>

    <p><strong>7. Cloudflare D1 / KV / R2 / Durable Objects / Hyperdrive</strong></p>
    <ul>
      <li>Worker chỉ có binding cần thiết; môi trường dùng resource riêng; tác vụ admin sau Access/service binding.</li>
      <li>API token phạm vi hẹp, có hạn, lọc IP; không Global API Key; secret qua <code>wrangler secret put</code>/Secrets Store.</li>
      <li>D1 <code>prepare().bind()</code>, không <code>exec()</code> với input; <code>batch()</code> cho nguyên tử; migration từ CI.</li>
      <li>R2 private mặc định; presigned URL ngắn hạn; không r2.dev cho dữ liệu thật; CORS hẹp; lifecycle rule.</li>
      <li>Durable Object theo tenant từ session; KV không dùng cho bộ đếm/thu hồi tức thì; Hyperdrive với role hẹp, <code>verify-full</code>, cân nhắc tắt cache cho dữ liệu theo tenant.</li>
      <li>Audit Logs tài khoản có cảnh báo; D1 Time Travel + export mã hoá.</li>
    </ul>

    <div class="callout"><p>💡 Checklist chỉ có giá trị khi được <strong>kiểm chứng</strong>: thử kết nối từ ngoài, thử đăng nhập không mật khẩu, thử lệnh bị cấm bằng tài khoản app, thử đọc tenant khác,
    thử khôi phục backup. Mỗi mục "có" nên đi kèm một bài test tự động hoặc một bằng chứng cụ thể.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "🐘 PostgreSQL", lines: [
      "# postgresql.conf",
      "listen_addresses = '10.0.1.5'",
      "ssl = on",
      "ssl_min_protocol_version = 'TLSv1.2'",
      "password_encryption = 'scram-sha-256'",
      "shared_preload_libraries = 'pgaudit'",
      "pgaudit.log = 'ddl, role'",
      "log_connections = on",
      "# pg_hba.conf",
      "hostssl shop app_orders 10.0.1.0/24 scram-sha-256",
      "host    all  all        0.0.0.0/0   reject",
      "-- quyền & giới hạn",
      "ALTER ROLE app_orders NOSUPERUSER NOBYPASSRLS NOCREATEROLE CONNECTION LIMIT 80;",
      "ALTER ROLE app_orders SET statement_timeout = '5s';",
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
      "ALTER TABLE orders ENABLE ROW LEVEL SECURITY;",
      "ALTER TABLE orders FORCE ROW LEVEL SECURITY;"
    ]},
    { id: "redis", label: "🟥 Redis", lines: [
      "bind 127.0.0.1 10.0.1.6",
      "protected-mode yes",
      "port 0",
      "tls-port 6379",
      "tls-cert-file /etc/redis/tls/redis.crt",
      "tls-key-file /etc/redis/tls/redis.key",
      "tls-ca-cert-file /etc/redis/tls/ca.crt",
      "tls-replication yes",
      "enable-protected-configs no",
      "enable-module-command no",
      "enable-debug-command no",
      "maxmemory 2gb",
      "maxmemory-policy allkeys-lru",
      "maxclients 5000",
      "aclfile /etc/redis/users.acl",
      "# users.acl",
      "user default off",
      "user app_cache on #<sha256-hex> ~cache:* -@all +get +set +del +expire +ttl"
    ]},
    { id: "kafka", label: "📨 Kafka", lines: [
      "listeners=INTERNAL://10.0.1.9:9093,CONTROLLER://10.0.1.9:9094",
      "listener.security.protocol.map=INTERNAL:SASL_SSL,CONTROLLER:SSL",
      "controller.listener.names=CONTROLLER",
      "inter.broker.listener.name=INTERNAL",
      "sasl.enabled.mechanisms=SCRAM-SHA-512",
      "sasl.mechanism.inter.broker.protocol=SCRAM-SHA-512",
      "authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer",
      "allow.everyone.if.no.acl.found=false",
      "super.users=User:kafka-admin",
      "auto.create.topics.enable=false",
      "message.max.bytes=1048588",
      "max.connections.per.ip=200",
      "# quota mặc định + ACL theo topic/group qua IaC",
      "# Connect/Registry/UI: nội bộ, HTTPS, có xác thực"
    ]},
    { id: "chmongo", label: "🟨 ClickHouse & 🍃 Mongo", lines: [
      "<!-- ClickHouse -->",
      "<listen_host>10.0.1.8</listen_host>",
      "<https_port>8443</https_port>",
      "<tcp_port_secure>9440</tcp_port_secure>",
      "-- SQL",
      "CREATE ROLE bi_ro; GRANT SELECT ON analytics.* TO bi_ro;",
      "CREATE SETTINGS PROFILE bi_profile SETTINGS readonly = 1, max_memory_usage = 10000000000, max_execution_time = 60 TO bi_ro;",
      "CREATE QUOTA bi_quota KEYED BY user_name FOR INTERVAL 1 hour MAX queries = 1000 TO bi_ro;",
      "",
      "# MongoDB mongod.conf",
      "net:",
      "  bindIp: 127.0.0.1,10.0.1.7",
      "  tls:",
      "    mode: requireTLS",
      "security:",
      "  authorization: enabled",
      "  javascriptEnabled: false"
    ]},
    { id: "cf", label: "☁️ Cloudflare", lines: [
      "[env.production]",
      "d1_databases = [ { binding = \"DB\", database_name = \"shop-prod\", database_id = \"<uuid-prod>\" } ]",
      "r2_buckets    = [ { binding = \"UPLOADS\", bucket_name = \"uploads-prod\" } ]   # private",
      "[env.staging]",
      "d1_databases = [ { binding = \"DB\", database_name = \"shop-staging\", database_id = \"<uuid-staging>\" } ]",
      "",
      "// Worker",
      "const s = await requireSession(req, env)",
      "const row = await env.DB.prepare('SELECT * FROM orders WHERE tenant_id = ?1 AND id = ?2').bind(s.tenantId, id).first()",
      "const stub = env.TENANT.get(env.TENANT.idFromName(s.tenantId))",
      "",
      "# Token CI: chỉ permission cần, có hạn, lọc IP · secret: wrangler secret put",
      "# R2: không public cho dữ liệu người dùng · presigned URL 5 phút",
      "# Hyperdrive: role hẹp, --sslmode verify-full, cân nhắc --caching-disabled"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="l1"><div class="nl">1 · Mạng</div><div class="ns">bài 03</div></div>
      <div class="node" id="l2"><div class="nl">2 · Kết nối</div><div class="ns">bài 04</div></div>
      <div class="node" id="l3"><div class="nl">3 · Xác thực</div><div class="ns">bài 05–06</div></div>
      <div class="node" id="l4"><div class="nl">4 · Phân quyền</div><div class="ns">bài 07–09</div></div>
    </div>
    <div class="row">
      <div class="node" id="l5"><div class="nl">5 · Truy vấn</div><div class="ns">bài 10–12</div></div>
      <div class="node" id="l6"><div class="nl">6 · Dữ liệu</div><div class="ns">bài 13–19</div></div>
      <div class="node" id="l7"><div class="nl">7 · Vận hành</div><div class="ns">bài 20–23</div></div>
    </div>
    <div class="arrow" id="a1">↓ áp cho từng engine</div>
    <div class="row">
      <div class="node" id="epg"><div class="nl">🐘 Postgres</div><div class="ns">pg_hba · RLS</div></div>
      <div class="node" id="ers"><div class="nl">🟥 Redis</div><div class="ns">ACL · TLS</div></div>
      <div class="node" id="ekf"><div class="nl">📨 Kafka</div><div class="ns">SASL_SSL · ACL</div></div>
      <div class="node" id="ech"><div class="nl">🟨 ClickHouse</div><div class="ns">profile · quota</div></div>
      <div class="node" id="emg"><div class="nl">🍃 Mongo</div><div class="ns">auth · roles</div></div>
      <div class="node" id="ecf"><div class="nl">☁️ Cloudflare</div><div class="ns">binding · token</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="verify"><div class="nl">✅ Kiểm chứng</div><div class="ns">test "phải bị từ chối" · restore thử · diễn tập log</div></div>
  `,
  steps: [
    { title: "1 · PostgreSQL: mạng, TLS, SCRAM", tab: "pg", highlight: [2, 3, 4, 5, 10, 11], on: ["l1", "l2", "l3", "epg"],
      desc: "Bind nội bộ, chỉ hostssl + scram, dòng reject cuối pg_hba. Client dùng verify-full." },
    { title: "2 · PostgreSQL: quyền, RLS, giới hạn, audit", tab: "pg", highlight: [6, 7, 8, 13, 14, 15, 16, 17], on: ["l4", "l7", "epg"],
      desc: "App không có quyền đặc biệt, có timeout và connection limit; RLS FORCE cho bảng tenant; pgaudit ghi DDL và thay đổi quyền." },
    { title: "3 · Redis: TLS, ACL, tắt tính năng nguy hiểm", tab: "redis", highlight: [1, 2, 3, 4, 9, 10, 11, 17, 18], on: ["l1", "l2", "l3", "l4", "ers"],
      desc: "Chỉ TLS, user default tắt, ACL theo lệnh + prefix, MODULE/DEBUG/protected configs bị tắt." },
    { title: "4 · Redis: tài nguyên", tab: "redis", highlight: [12, 13, 14], on: ["l7", "ers"],
      desc: "maxmemory + policy theo mục đích, maxclients; session/rate limit dùng instance noeviction riêng." },
    { title: "5 · Kafka: listener, authorizer, giới hạn", tab: "kafka", highlight: [2, 5, 7, 8, 9, 10, 11, 12], on: ["l2", "l3", "l4", "ekf"],
      desc: "SASL_SSL + mTLS controller, deny-by-default, super user tối thiểu, không auto-create, giới hạn kích thước và kết nối." },
    { title: "6 · ClickHouse & Mongo", tab: "chmongo", highlight: [2, 3, 4, 6, 7, 8, 12, 14, 16, 17], on: ["ech", "emg", "l4", "l7"],
      desc: "ClickHouse: cổng bảo mật, role chỉ đọc, profile + quota. Mongo: bind nội bộ, requireTLS, authorization, tắt server-side JS." },
    { title: "7 · Cloudflare & kiểm chứng", tab: "cf", highlight: [2, 5, 9, 10, 12, 13, 14], on: ["ecf", "a2", "verify"],
      desc: "Resource riêng từng môi trường, bind tham số, DO theo tenant, token hẹp, R2 private, Hyperdrive an toàn. Cuối cùng: kiểm chứng từng mục bằng test." }
  ],

  quiz: [
    { q: "Hai lớp nào nếu làm đúng đã chặn được kịch bản 'bot quét Internet tìm DB không mật khẩu'?", options: [
        "Mã hoá at-rest và TTL",
        "Mạng (không phơi DB) và Xác thực (bắt buộc đăng nhập, không user mặc định)",
        "Audit log và backup",
        "RLS và masking"
      ], correct: 1,
      explanation: "Bài 01, 03, 05." },
    { q: "Client Postgres nên dùng sslmode nào để chống man-in-the-middle?", options: [
        "verify-full",
        "require",
        "prefer",
        "disable"
      ], correct: 0,
      explanation: "verify-full kiểm tra cả CA và hostname (bài 04)." },
    { q: "Cấu hình Redis nào buộc mọi client phải xác thực bằng user riêng?", options: [
        "protected-mode no",
        "maxmemory 0",
        "user default off + ACL user cho từng app",
        "save \"\""
      ], correct: 2,
      explanation: "Bài 05, 07." },
    { q: "Trong Kafka, cấu hình nào đảm bảo 'không có ACL thì từ chối'?", options: [
        "auto.create.topics.enable=true",
        "allow.everyone.if.no.acl.found=false (cùng authorizer được bật)",
        "super.users=User:*",
        "ssl.client.auth=none"
      ], correct: 1,
      explanation: "Bài 07, 17." },
    { q: "Ứng dụng web nên kết nối Postgres bằng tài khoản thế nào?", options: [
        "Superuser postgres",
        "Owner của mọi bảng",
        "Tài khoản dùng chung với team BI",
        "Role riêng chỉ có DML trên bảng cần, không SUPERUSER/BYPASSRLS, có timeout và connection limit"
      ], correct: 3,
      explanation: "Bài 07, 22, 23." },
    { q: "Truy vấn ClickHouse có input người dùng nên viết thế nào?", options: [
        "Ghép chuỗi sau khi escape",
        "Dùng table function url()",
        "Dùng tham số có kiểu {name:Type} và truyền param_name/query_params",
        "Chạy bằng user default"
      ], correct: 2,
      explanation: "Bài 10." },
    { q: "Filter MongoDB từ body JSON cần xử lý gì?", options: [
        "Validate kiểu (chuỗi/số), dùng $eq hoặc sanitizeFilter, update chỉ qua $set allowlist",
        "Không cần gì",
        "Chuyển sang $where",
        "Mã hoá base64"
      ], correct: 0,
      explanation: "Bài 11." },
    { q: "Mã hoá at-rest KHÔNG chống được kịch bản nào?", options: [
        "Ổ đĩa bị lấy cắp",
        "Snapshot bị sao chép sang tài khoản không có quyền khoá",
        "Máy chủ thanh lý không xoá đĩa",
        "Injection qua ứng dụng đọc dữ liệu"
      ], correct: 3,
      explanation: "DB giải mã cho mọi truy vấn hợp lệ, kể cả truy vấn bị lợi dụng (bài 13)." },
    { q: "Hoá đơn người dùng lưu trên R2 nên được phục vụ thế nào?", options: [
        "Bucket public qua r2.dev",
        "Bucket private + presigned URL ngắn hạn sau khi kiểm tra quyền (hoặc Worker proxy)",
        "Đặt tên file khó đoán",
        "Gửi link bucket cho khách"
      ], correct: 1,
      explanation: "Bài 19." },
    { q: "Topic Kafka chứa PII nên được quản lý thế nào?", options: [
        "Phân loại dữ liệu, retention phù hợp, ACL Read hẹp, mã hoá field nhạy cảm, tombstone khi xoá trên topic compact",
        "retention.ms=-1 để không mất dữ liệu",
        "Cho mọi service Read để tiện",
        "Không cần quản lý vì chỉ là hàng đợi"
      ], correct: 0,
      explanation: "Bài 15, 17." },
    { q: "Điều gì làm cho backup chống được ransomware?", options: [
        "Backup cùng tài khoản với DB",
        "Replica ở vùng khác",
        "Backup bất biến (Object Lock/bucket lock) ở tài khoản riêng, người ghi không xoá được, đã test restore",
        "Nén backup"
      ], correct: 2,
      explanation: "Bài 20." },
    { q: "Setting nào giới hạn bộ nhớ của một truy vấn ClickHouse?", options: [
        "readonly",
        "max_memory_usage",
        "listen_host",
        "access_management"
      ], correct: 1,
      explanation: "Kèm constraints, quota và max_concurrent_queries_for_user (bài 18, 22)." },
    { q: "MongoDB cấu hình nào tắt $where, mapReduce JS và $function?", options: [
        "net.bindIp",
        "setParameter.authenticationMechanisms",
        "auditLog.destination",
        "security.javascriptEnabled: false"
      ], correct: 3,
      explanation: "Bài 09." },
    { q: "Nguyên tắc về dữ liệu giữa các môi trường là gì?", options: [
        "Copy prod xuống dev hằng tuần",
        "Dev dùng chung credential prod",
        "Schema đi lên qua migration; dữ liệu prod không đi xuống dev (trừ khi đã mask trong vùng prod)",
        "Staging trỏ vào DB prod để tiết kiệm"
      ], correct: 2,
      explanation: "Bài 23." },
    { q: "Vì sao checklist cần đi kèm kiểm chứng (test 'phải bị từ chối', restore thử)?", options: [
        "Cấu hình có thể trôi theo thời gian hoặc bị hiểu sai; chỉ kiểm chứng thực tế mới chứng minh được lớp bảo vệ hoạt động",
        "Để tài liệu dài hơn",
        "Vì kiểm toán yêu cầu định dạng",
        "Không cần thiết"
      ], correct: 0,
      explanation: "Một mục 'có' không có bằng chứng chỉ là giả định." }
  ]
});
