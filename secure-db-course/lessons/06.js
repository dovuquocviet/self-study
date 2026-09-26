window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "Xác thực",
  title: "Quản lý credential của Database",
  subtitle: "Secret manager · xoay vòng mật khẩu không downtime · dynamic credentials · mỗi service một tài khoản · connection string không lọt log",

  theory: `
    <p>Bài 05 đảm bảo DB <em>đòi</em> credential. Bài này trả lời câu tiếp theo: <strong>credential đó sống ở đâu, ai thấy được, và thay đổi thế nào?</strong>
    Một mật khẩu mạnh nằm trong file <code>.env</code> đã commit lên git thì cũng như không có.</p>

    <p><strong>1. Credential DB hay bị lộ ở đâu?</strong></p>
    <table>
      <tr><th>Nơi lộ</th><th>Ví dụ</th><th>Cách phòng</th></tr>
      <tr><td>Mã nguồn / git</td><td><code>DATABASE_URL=postgres://app:MatKhau@...</code> trong <code>.env</code> commit nhầm; <code>[vars]</code> trong wrangler.toml</td><td>secret manager; scan secret trong CI (pre-commit hook); <code>.env</code> vào <code>.gitignore</code></td></tr>
      <tr><td>Log ứng dụng</td><td>log in nguyên object config; exception in connection string</td><td>redact trước khi log; không log config; bộ lọc log</td></tr>
      <tr><td>Log / lịch sử của DB</td><td><code>ALTER ROLE ... PASSWORD '...'</code> nằm trong log truy vấn</td><td><code>\\password</code>, tắt log cho phiên đổi mật khẩu, dùng công cụ tự động</td></tr>
      <tr><td>Tham số dòng lệnh</td><td><code>psql postgres://u:p@h</code> hiện trong <code>ps aux</code></td><td>file <code>.pgpass</code> (quyền 600), biến môi trường, prompt</td></tr>
      <tr><td>Image / artifact</td><td>Docker image có file config chứa mật khẩu</td><td>inject lúc chạy (runtime), không lúc build</td></tr>
      <tr><td>Chia sẻ thủ công</td><td>mật khẩu gửi qua chat, wiki, ticket</td><td>chỉ chia sẻ quyền đọc secret, không chia sẻ giá trị</td></tr>
    </table>

    <p><strong>2. Secret manager — một nguồn sự thật cho bí mật</strong></p>
    <p>Công cụ: HashiCorp Vault / OpenBao, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Kubernetes Secret (kèm mã hoá etcd), Doppler, 1Password…;
    trên Cloudflare: <code>wrangler secret put</code> (secret gắn vào Worker) hoặc Secrets Store. Lợi ích:</p>
    <ul>
      <li>Giá trị chỉ được đọc lúc chạy bởi đúng service có quyền; người dùng không cần biết giá trị.</li>
      <li>Có audit log: ai đọc secret nào, lúc nào.</li>
      <li>Có công cụ xoay vòng (rotation) tự động.</li>
    </ul>

    <p><strong>3. Xoay vòng (rotation) không làm sập ứng dụng</strong></p>
    <p>Vì sao phải xoay? Credential càng sống lâu càng có nhiều cơ hội bị lộ (log cũ, laptop cũ, nhân viên nghỉ việc). Vấn đề: đổi mật khẩu đột ngột thì các instance đang chạy mất kết nối.
    Hai kỹ thuật phổ biến:</p>
    <ol>
      <li><strong>Hai mật khẩu cùng lúc</strong> (nếu engine hỗ trợ): Redis ACL cho một user có nhiều mật khẩu — thêm mật khẩu mới (<code>&gt;new</code>), triển khai app, rồi gỡ mật khẩu cũ (<code>&lt;old</code>).</li>
      <li><strong>Hai tài khoản luân phiên</strong> (A/B): <code>app_orders_a</code> và <code>app_orders_b</code> cùng quyền (thường cùng thuộc một role nhóm). Đổi mật khẩu của tài khoản đang <em>không</em> dùng,
        chuyển app sang nó, lần sau đảo lại. Dùng được cho Postgres, Mongo, ClickHouse, Kafka SCRAM.</li>
    </ol>

    <p><strong>4. Dynamic credentials — mật khẩu dùng một lần, tự hết hạn</strong></p>
    <p>Thay vì một mật khẩu sống nhiều năm, service xin secret manager cấp một <em>tài khoản tạm</em> (ví dụ sống 1 giờ). Vault database secrets engine làm được việc này với PostgreSQL, MongoDB, Redis, MySQL…;
    các cloud có kiểu tương tự như IAM database authentication (token ngắn hạn thay mật khẩu). Ưu điểm: credential lộ ra cũng nhanh chóng vô dụng, mỗi instance có tên đăng nhập riêng trong log.
    Nhược điểm: phụ thuộc vào secret manager luôn sẵn sàng, số role tạm tăng lên.</p>

    <p><strong>5. Mỗi service một tài khoản</strong></p>
    <ul>
      <li><code>orders-api</code>, <code>billing-worker</code>, <code>reporting</code>, <code>migrations</code>, <code>backup</code> — mỗi cái một tài khoản, một quyền.</li>
      <li>Log DB cho biết chính xác ai đã chạy truy vấn nào; thu hồi một service bị chiếm không ảnh hưởng service khác.</li>
      <li>Con người dùng tài khoản cá nhân (qua SSO/bastion), không dùng chung tài khoản app.</li>
    </ul>

    <div class="callout"><p>💡 Có kế hoạch "credential bị lộ" viết sẵn: (1) xoay vòng ngay credential đó, (2) thu hồi phiên đang mở (<code>pg_terminate_backend</code>, <code>CLIENT KILL USER</code> trên Redis…),
    (3) tra audit log xem đã bị dùng để làm gì, (4) tìm và xoá nguồn lộ (commit, log). Tập dượt trước khi cần.</p></div>
  `,

  codeTabs: [
    { id: "leak", label: "❌ Lộ credential", lines: [
      "// 1. Mật khẩu trong code / file commit",
      "const db = connect('postgres://app:SuperSecret123@db.internal/shop')",
      "",
      "// 2. Log nguyên config",
      "log.info('starting with config', config)          // in cả DATABASE_URL",
      "",
      "// 3. Exception kèm connection string",
      "catch (e) { log.error('cannot connect to ' + dsn + ': ' + e) }",
      "",
      "# 4. wrangler.toml: [vars] là plaintext, nằm trong repo",
      "[vars]",
      "DB_PASSWORD = \"SuperSecret123\"",
      "",
      "# 5. Dòng lệnh hiện trong 'ps aux' của mọi user trên máy",
      "psql postgres://ops:SuperSecret123@db.internal/shop"
    ]},
    { id: "good", label: "✅ Secret manager + redact", lines: [
      "// Đọc lúc chạy, từ secret manager, bằng danh tính của service",
      "dbUrl = secrets.get('prod/orders-api/db-url')",
      "pool  = connect(dbUrl)",
      "",
      "// Redact khi cần log",
      "function redact(url):",
      "    u = parseUrl(url); if u.password: u.password = '***'",
      "    return u.toString()",
      "log.info('db target', redact(dbUrl))            // postgres://app:***@db.internal/shop",
      "",
      "# Cloudflare: secret gắn vào Worker, không nằm trong repo",
      "wrangler secret put UPSTREAM_API_KEY",
      "# Postgres qua Hyperdrive: mật khẩu nằm trong cấu hình Hyperdrive,",
      "# Worker chỉ dùng env.HYPERDRIVE.connectionString",
      "",
      "# psql: .pgpass (chmod 600) thay vì mật khẩu trên dòng lệnh",
      "db.internal:5432:shop:ops_alice:<mat-khau>"
    ]},
    { id: "rotate", label: "🔄 Xoay vòng", lines: [
      "# Redis: một user nhiều mật khẩu -> xoay không downtime",
      "ACL SETUSER app_cache >NEW_PASSWORD      # thêm mật khẩu mới",
      "# ... triển khai app dùng mật khẩu mới ...",
      "ACL SETUSER app_cache <OLD_PASSWORD      # gỡ mật khẩu cũ",
      "ACL SAVE",
      "",
      "-- Postgres: hai tài khoản luân phiên A/B cùng role nhóm",
      "CREATE ROLE orders_rw NOLOGIN;",
      "CREATE ROLE app_orders_a LOGIN IN ROLE orders_rw;",
      "CREATE ROLE app_orders_b LOGIN IN ROLE orders_rw;",
      "-- đang dùng A -> đổi mật khẩu B, chuyển app sang B; lần sau đảo lại",
      "ALTER ROLE app_orders_b PASSWORD '<moi>' VALID UNTIL '2026-12-31';",
      "",
      "// Mongo / ClickHouse: cùng mô hình A/B",
      "db.updateUser('orders_app_b', { pwd: passwordPrompt() })",
      "ALTER USER app_ro_b IDENTIFIED WITH sha256_password BY '<moi>';"
    ]},
    { id: "dynamic", label: "⏳ Dynamic credentials", lines: [
      "# Vault database secrets engine — Postgres",
      "vault write database/config/shop plugin_name=postgresql-database-plugin \\",
      "  connection_url='postgresql://{{username}}:{{password}}@db.internal:5432/shop?sslmode=verify-full' \\",
      "  allowed_roles='orders-ro' username='vault_admin' password='<bootstrap>'",
      "vault write -force database/rotate-root/shop     # đổi luôn mật khẩu bootstrap",
      "",
      "vault write database/roles/orders-ro db_name=shop default_ttl=1h max_ttl=24h \\",
      "  creation_statements=\"CREATE ROLE \\\"{{name}}\\\" LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE orders_ro;\"",
      "",
      "# Service xin credential tạm (hết hạn sau 1 giờ)",
      "vault read database/creds/orders-ro",
      "#  username  v-orders-ro-8f2k...",
      "#  password  <ngau-nhien>",
      "#  lease_duration 1h"
    ]},
    { id: "incident", label: "🚨 Khi bị lộ", lines: [
      "// Runbook: credential DB bị lộ",
      "1. rotate(credential)                  // secret manager / ALTER ROLE / ACL SETUSER",
      "2. kill_sessions(user)",
      "     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'app_orders_a';",
      "     CLIENT KILL USER app_cache        # Redis",
      "     KILL QUERY WHERE user = 'app_ro'  -- ClickHouse (dừng truy vấn đang chạy)",
      "3. review_audit_log(user, since = leak_time)",
      "4. remove_source(commit, log line, ticket)",
      "5. post_mortem: vì sao lộ được? thêm secret scanning / redact"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sm"><div class="nl">🔐 Secret manager</div><div class="ns">Vault · AWS/GCP · wrangler secret · audit ai đọc</div></div>
    <div class="arrow" id="a1">↓ cấp lúc chạy, theo danh tính service</div>
    <div class="row">
      <div class="node" id="svc1"><div class="nl">🧾 orders-api</div><div class="ns">tài khoản riêng</div></div>
      <div class="node" id="svc2"><div class="nl">📊 reporting</div><div class="ns">tài khoản riêng</div></div>
      <div class="node" id="svc3"><div class="nl">🛠️ migrations</div><div class="ns">tài khoản riêng</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="dbx"><div class="nl">🗄️ Database</div><div class="ns">credential xoay vòng / tạm thời</div></div>
    <div class="row">
      <div class="node" id="logs"><div class="nl">📜 Log & repo</div><div class="ns">chỉ thấy '***'</div></div>
      <div class="node" id="rot"><div class="nl">🔄 Rotation</div><div class="ns">A/B · đa mật khẩu · TTL</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Những chỗ credential hay lộ", tab: "leak", highlight: [2, 5, 8, 11, 12, 15], on: ["logs"],
      desc: "Code, log, exception, file cấu hình trong repo, dòng lệnh. Mỗi chỗ đều từng là nguồn gốc của sự cố thật." },
    { title: "2 · Đọc từ secret manager lúc chạy", tab: "good", highlight: [2, 3, 12], on: ["sm", "a1", "svc1", "svc2", "svc3"],
      desc: "Service dùng danh tính của nó (IAM role, service account, binding) để đọc secret. Không ai cần copy giá trị ra ngoài." },
    { title: "3 · Redact trước khi log", tab: "good", highlight: [6, 7, 8, 9, 17], on: ["logs"],
      desc: "Nếu cần log địa chỉ DB, thay mật khẩu bằng <code>***</code>. psql dùng <code>.pgpass</code> quyền 600 thay vì mật khẩu trên dòng lệnh." },
    { title: "4 · Xoay vòng không downtime", tab: "rotate", highlight: [2, 4, 8, 9, 10, 12], on: ["rot", "dbx"],
      desc: "Redis cho nhiều mật khẩu/user. Engine khác dùng hai tài khoản A/B cùng role nhóm: đổi cái đang nghỉ, chuyển app, lặp lại." },
    { title: "5 · Dynamic credentials", tab: "dynamic", highlight: [5, 7, 8, 11, 14], on: ["sm", "rot", "dbx"],
      desc: "Vault tạo role tạm sống 1 giờ cho mỗi lần xin. Lộ ra cũng nhanh hết hạn; log DB cho biết instance nào đã truy vấn." },
    { title: "6 · Mỗi service một tài khoản", tab: "rotate", highlight: [8, 9, 10], on: ["svc1", "svc2", "svc3", "a2"],
      desc: "Quyền gắn với role nhóm, đăng nhập bằng tài khoản riêng. Thu hồi một tài khoản không ảnh hưởng service khác." },
    { title: "7 · Runbook khi bị lộ", tab: "incident", highlight: [2, 4, 5, 6, 7, 8], on: ["rot", "dbx", "logs"],
      desc: "Xoay ngay, cắt phiên đang mở, tra audit log, xoá nguồn lộ, rút kinh nghiệm. Viết sẵn và tập dượt." }
  ],

  quiz: [
    { q: "Vì sao không nên đặt mật khẩu DB trong mục [vars] của wrangler.toml?", options: [
        "[vars] là giá trị plaintext nằm trong file cấu hình thường được commit — dùng wrangler secret put thay thế",
        "Vì [vars] không hỗ trợ chuỗi",
        "Vì Worker không đọc được [vars]",
        "Vì [vars] làm chậm Worker"
      ], correct: 0,
      explanation: "Secret của Worker phải dùng 'wrangler secret put' (hoặc Secrets Store) để không nằm trong repo." },
    { q: "Chạy 'psql postgres://ops:MatKhau@db/shop' trên máy dùng chung có rủi ro gì?", options: [
        "Không rủi ro",
        "psql từ chối URL có mật khẩu",
        "Kết nối không được mã hoá",
        "Mật khẩu hiện trong danh sách tiến trình (ps) và lịch sử shell"
      ], correct: 3,
      explanation: "Dùng .pgpass (quyền 600), biến môi trường hoặc để psql hỏi mật khẩu." },
    { q: "Redis ACL hỗ trợ nhiều mật khẩu cho một user. Điều này giúp gì?", options: [
        "Tăng tốc AUTH",
        "Xoay vòng mật khẩu không downtime: thêm mật khẩu mới, triển khai app, rồi gỡ mật khẩu cũ",
        "Cho phép nhiều người dùng chung một mật khẩu",
        "Không có tác dụng thực tế"
      ], correct: 1,
      explanation: "Giai đoạn chuyển tiếp cả hai mật khẩu đều hợp lệ nên các instance cũ/mới cùng kết nối được." },
    { q: "Kỹ thuật 'hai tài khoản A/B' khi xoay mật khẩu Postgres hoạt động thế nào?", options: [
        "Hai tài khoản cùng quyền (qua role nhóm); đổi mật khẩu tài khoản đang không dùng, chuyển app sang nó, lần sau đảo lại",
        "Dùng A cho đọc, B cho ghi",
        "Dùng A cho dev, B cho prod",
        "Cả hai dùng chung một mật khẩu"
      ], correct: 0,
      explanation: "Không có lúc nào app dùng một mật khẩu đã bị đổi, nên không có downtime." },
    { q: "Ưu điểm chính của dynamic credentials (ví dụ Vault database secrets engine)?", options: [
        "Không cần DB xác thực nữa",
        "Mật khẩu ngắn hơn, dễ nhớ",
        "Credential tạm thời, tự hết hạn và riêng cho từng lần cấp — lộ ra cũng nhanh chóng vô dụng",
        "Chạy nhanh hơn"
      ], correct: 2,
      explanation: "Thời gian sống ngắn giảm giá trị của credential bị lộ và giúp truy vết theo từng instance." },
    { q: "Tại sao mỗi service nên có tài khoản DB riêng?", options: [
        "Vì DB giới hạn số kết nối mỗi user",
        "Truy vết được ai làm gì, quyền cắt theo nhu cầu từng service, thu hồi một cái không làm sập cái khác",
        "Để dùng được nhiều mật khẩu hơn",
        "Không cần thiết nếu dùng TLS"
      ], correct: 1,
      explanation: "Tài khoản dùng chung xoá mất khả năng truy vết và buộc phải cấp quyền rộng nhất mà một service cần." },
    { q: "Khi log địa chỉ DB lúc khởi động, cách đúng là gì?", options: [
        "Log nguyên DATABASE_URL để dễ debug",
        "Không bao giờ log gì về DB",
        "Mã hoá base64 URL rồi log",
        "Parse URL và thay mật khẩu bằng '***' trước khi log"
      ], correct: 3,
      explanation: "Base64 không phải mã hoá. Redact giữ được thông tin hữu ích (host, db) mà không lộ bí mật." },
    { q: "Bước đầu tiên khi phát hiện credential DB bị commit lên repo public?", options: [
        "Xoá commit rồi coi như xong",
        "Đổi tên repo",
        "Xoay vòng (đổi/thu hồi) credential ngay, cắt phiên đang mở, rồi mới xử lý lịch sử git và tra audit log",
        "Chờ xem có ai dùng không"
      ], correct: 2,
      explanation: "Credential đã public phải coi như đã bị lấy. Xoá commit không thu hồi được bản sao người khác đã clone." },
    { q: "Đổi mật khẩu bằng 'ALTER ROLE app PASSWORD ...' trong psql có thể để lộ mật khẩu ở đâu?", options: [
        "Log truy vấn của server (nếu bật log_statement) và lịch sử psql — nên dùng \\password hoặc công cụ tự động",
        "Chỉ trong RAM",
        "Không ở đâu cả",
        "Trong file pg_hba.conf"
      ], correct: 0,
      explanation: "\\password tính hash SCRAM phía client rồi gửi, không để lộ mật khẩu rõ trong log." }
  ]
});
