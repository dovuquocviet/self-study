window.LESSONS.push({
  id: "21",
  phase: "6", phaseName: "Vận hành",
  title: "Audit log & giám sát",
  subtitle: "Ghi gì, không ghi gì · pgaudit · Mongo auditLog · ClickHouse query_log & session_log · Kafka authorizer log · Redis ACL LOG · Cloudflare audit logs · cảnh báo có ý nghĩa",

  theory: `
    <p>Mọi lớp phòng thủ đều có thể thủng. Audit log trả lời những câu hỏi sau sự cố: <strong>ai</strong> đã làm <strong>gì</strong>, <strong>khi nào</strong>, <strong>từ đâu</strong>, <strong>trên dữ liệu nào</strong>.
    Giám sát (monitoring + cảnh báo) biến log thành phát hiện <em>trong vài phút</em> thay vì vài tháng. Không có log, bạn không thể biết phạm vi thiệt hại — và thường phải giả định điều tệ nhất.</p>

    <p><strong>1. Ghi những gì?</strong></p>
    <table>
      <tr><th>Nhóm sự kiện</th><th>Ví dụ</th><th>Mức ưu tiên</th></tr>
      <tr><td>Xác thực</td><td>đăng nhập thành công/thất bại, từ IP nào, user nào</td><td>Luôn ghi</td></tr>
      <tr><td>Thay đổi quyền</td><td>CREATE/ALTER/DROP USER/ROLE, GRANT/REVOKE, <code>ACL SETUSER</code>, <code>createUser</code>, ACL Kafka</td><td>Luôn ghi + cảnh báo</td></tr>
      <tr><td>Thay đổi cấu trúc</td><td>DDL (<code>DROP TABLE</code>, <code>ALTER</code>), xoá topic/collection, đổi cấu hình</td><td>Luôn ghi; cảnh báo nếu ngoài khung deploy</td></tr>
      <tr><td>Truy cập dữ liệu nhạy cảm</td><td>đọc bảng khách hàng/thanh toán, export lớn</td><td>Ghi có chọn lọc (theo bảng/role)</td></tr>
      <tr><td>Bị từ chối</td><td>permission denied, ACL deny, NOAUTH</td><td>Luôn ghi — tài khoản app bị từ chối là dấu hiệu lỗi hoặc bị chiếm</td></tr>
      <tr><td>Tài nguyên bất thường</td><td>truy vấn đọc hàng tỷ dòng, số kết nối tăng vọt</td><td>Giám sát metric</td></tr>
    </table>

    <p><strong>2. KHÔNG ghi những gì?</strong> Mật khẩu, token, khoá mã hoá, nội dung PII. Audit log thường được giữ lâu và nhiều người đọc được — nó không được trở thành kho dữ liệu nhạy cảm thứ hai.
    Ví dụ: pgaudit mặc định không ghi giá trị tham số (<code>pgaudit.log_parameter = off</code>) — giữ như vậy; câu lệnh ghép giá trị trực tiếp (không dùng tham số) sẽ lộ giá trị trong log — thêm một lý do dùng tham số.</p>

    <p><strong>3. Công cụ theo từng engine</strong></p>
    <ul>
      <li><strong>PostgreSQL</strong>: <code>log_connections</code>, <code>log_disconnections</code>, <code>log_line_prefix</code> có user/db/host; extension <strong>pgaudit</strong> ghi theo lớp
        (<code>ddl</code>, <code>role</code>, <code>write</code>, <code>read</code>…) và <em>object audit</em> (chỉ ghi truy cập bảng mà role <code>pgaudit.role</code> có quyền — cách chọn lọc bảng nhạy cảm).</li>
      <li><strong>MongoDB</strong>: <code>auditLog</code> (Enterprise, Atlas, Percona Server for MongoDB) với <code>filter</code> theo loại sự kiện; bản Community chỉ có log hệ thống và profiler.</li>
      <li><strong>ClickHouse</strong>: <code>system.query_log</code> (mọi truy vấn, user, số dòng đọc), <code>system.session_log</code> (đăng nhập thành công/thất bại — cần bật trong cấu hình),
        <code>system.query_views_log</code>. Đây là bảng trong chính ClickHouse → đẩy ra hệ thống log riêng để kẻ có quyền quản trị không xoá dấu vết.</li>
      <li><strong>Kafka</strong>: logger <code>kafka.authorizer.logger</code> ghi quyết định phân quyền (từ chối ở mức INFO, cho phép ở mức DEBUG — bật DEBUG rất nhiều log); log xác thực của broker.</li>
      <li><strong>Redis</strong>: <code>ACL LOG</code> ghi các lần xác thực thất bại và lệnh/key bị ACL chặn; <code>SLOWLOG</code> cho lệnh chậm. <code>MONITOR</code> không dùng trên prod (tốn tài nguyên, in cả dữ liệu).</li>
      <li><strong>Cloudflare</strong>: Audit Logs của tài khoản (ai tạo token, đổi binding, bật public R2, xoá database), Workers Logs/Logpush cho log ứng dụng, <code>wrangler d1 insights</code> cho truy vấn tốn tài nguyên.
        Worker cần tự ghi log nghiệp vụ (ai xem/sửa gì) vì D1/KV không có audit log mức dòng.</li>
    </ul>

    <p><strong>4. Bảo vệ chính audit log</strong></p>
    <ul>
      <li>Đẩy <strong>ra khỏi máy DB</strong> ngay (syslog, agent, Logpush) tới SIEM/kho log mà admin DB không có quyền xoá/sửa.</li>
      <li>Lưu dạng append-only/bất biến, có retention theo yêu cầu (thường ≥ 1 năm cho sự kiện bảo mật).</li>
      <li>Đồng bộ thời gian (NTP) để ghép sự kiện giữa các hệ thống.</li>
    </ul>

    <p><strong>5. Cảnh báo có ý nghĩa</strong> — ít nhưng đúng:</p>
    <ul>
      <li>Nhiều lần đăng nhập thất bại / đăng nhập thành công sau chuỗi thất bại.</li>
      <li>Tài khoản ứng dụng đăng nhập từ IP ngoài subnet của app, hoặc bị từ chối quyền (lỗi triển khai hoặc bị chiếm).</li>
      <li>Thay đổi quyền, tạo user mới, bật tính năng nguy hiểm, bật public bucket.</li>
      <li>DDL/xoá dữ liệu ngoài khung giờ deploy, không từ tài khoản migration.</li>
      <li>Lượng đọc bất thường: một user đọc gấp nhiều lần mức bình thường (dấu hiệu rút dữ liệu).</li>
      <li>Job backup thất bại hoặc có thao tác xoá backup.</li>
    </ul>

    <div class="callout"><p>💡 Thử log của bạn bằng một "diễn tập": dùng tài khoản test đăng nhập sai 10 lần, GRANT một quyền, đọc bảng nhạy cảm, xoá một bảng tạm.
    Kiểm tra: có đủ 4 sự kiện trong SIEM không? có cảnh báo nào bắn không? mất bao lâu?</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "🐘 Postgres & pgaudit", lines: [
      "# postgresql.conf",
      "log_connections = on",
      "log_disconnections = on",
      "log_line_prefix = '%m [%p] user=%u db=%d host=%h app=%a '",
      "shared_preload_libraries = 'pgaudit'",
      "pgaudit.log = 'ddl, role'                  # mọi DDL và thay đổi quyền",
      "pgaudit.log_parameter = off                # không ghi giá trị tham số (PII)",
      "pgaudit.role = 'auditor'                   # object audit",
      "",
      "-- Chỉ ghi truy cập các bảng nhạy cảm (object audit)",
      "CREATE EXTENSION pgaudit;",
      "CREATE ROLE auditor NOLOGIN;",
      "GRANT SELECT, UPDATE, DELETE ON public.customers, public.payments TO auditor;",
      "-- mọi SELECT/UPDATE/DELETE trên 2 bảng này sẽ có dòng AUDIT: OBJECT,..."
    ]},
    { id: "mongo", label: "🍃 Mongo auditLog", lines: [
      "# mongod.conf (Enterprise / Percona Server for MongoDB)",
      "auditLog:",
      "  destination: file",
      "  format: JSON",
      "  path: /var/log/mongodb/audit.json",
      "  filter: '{ atype: { $in: [ \"authenticate\", \"createUser\", \"dropUser\", \"updateUser\",",
      "            \"grantRolesToUser\", \"revokeRolesFromUser\", \"createRole\",",
      "            \"dropCollection\", \"dropDatabase\", \"shutdown\" ] } }'",
      "",
      "# Atlas: bật Database Auditing trong project, chọn sự kiện tương tự",
      "# Community: không có auditLog -> dựa vào log hệ thống + giám sát kết nối"
    ]},
    { id: "ch", label: "🟨 ClickHouse", lines: [
      "<!-- config.d/logs.xml: bật session_log (đăng nhập thành công/thất bại) -->",
      "<clickhouse>",
      "  <session_log><database>system</database><table>session_log</table></session_log>",
      "</clickhouse>",
      "",
      "-- Đăng nhập thất bại gần đây",
      "SELECT event_time, user, client_address, auth_type",
      "  FROM system.session_log WHERE type = 'LoginFailure' AND event_date = today();",
      "",
      "-- User đọc nhiều bất thường hôm nay",
      "SELECT user, sum(read_rows) AS rows, count() AS q FROM system.query_log",
      " WHERE type = 'QueryFinish' AND event_date = today() GROUP BY user ORDER BY rows DESC;",
      "",
      "-- Thay đổi quyền",
      "SELECT event_time, user, query FROM system.query_log",
      " WHERE query_kind IN ('Create', 'Grant', 'Revoke', 'Drop') AND event_date >= today() - 7;"
    ]},
    { id: "kr", label: "📨 Kafka & 🟥 Redis", lines: [
      "# Kafka log4j.properties: tách log quyết định phân quyền ra file riêng",
      "log4j.appender.authorizerAppender=org.apache.log4j.DailyRollingFileAppender",
      "log4j.appender.authorizerAppender.File=${kafka.logs.dir}/kafka-authorizer.log",
      "log4j.appender.authorizerAppender.layout=org.apache.log4j.PatternLayout",
      "log4j.logger.kafka.authorizer.logger=INFO, authorizerAppender   # INFO = các lần bị TỪ CHỐI",
      "log4j.additivity.kafka.authorizer.logger=false",
      "# (Kafka 4.x dùng log4j2 — cấu hình tương đương trong log4j2.yaml)",
      "",
      "# Redis: xác thực thất bại, lệnh/key bị ACL chặn",
      "ACL LOG 20",
      "#  reason: auth | command | key | channel ; username ; client-info ; count",
      "# redis.conf",
      "acllog-max-len 256",
      "slowlog-log-slower-than 10000",
      "# KHÔNG dùng MONITOR trên production"
    ]},
    { id: "alert", label: "🚨 Luật cảnh báo", lines: [
      "// Ví dụ luật cảnh báo (pseudo, dạng SIEM)",
      "alert 'db-bruteforce' when count(auth_failure by user, src_ip) > 20 in 5m",
      "alert 'app-login-outside-subnet' when auth_success.user in APP_USERS and src_ip not in APP_SUBNETS",
      "alert 'app-permission-denied' when permission_denied.user in APP_USERS",
      "alert 'privilege-change' when event in [GRANT, REVOKE, CREATE_USER, ACL_SETUSER, createUser, kafka_acl_add]",
      "alert 'ddl-outside-deploy' when event == DDL and user != 'migrator' or not in deploy_window",
      "alert 'bulk-read' when rows_read(user, 1h) > 10 * baseline(user)",
      "alert 'r2-made-public' when cf_audit.action == 'bucket public access enabled'",
      "alert 'backup-tamper' when event in [backup_delete, backup_job_failed]"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="pgn"><div class="nl">🐘 pgaudit</div><div class="ns">ddl · role · object</div></div>
      <div class="node" id="mgn"><div class="nl">🍃 auditLog</div><div class="ns">authenticate · createUser…</div></div>
      <div class="node" id="chn"><div class="nl">🟨 query_log / session_log</div><div class="ns">ai đọc bao nhiêu</div></div>
      <div class="node" id="krn"><div class="nl">📨🟥 authorizer · ACL LOG</div><div class="ns">bị từ chối</div></div>
      <div class="node" id="cfn"><div class="nl">☁️ Audit Logs</div><div class="ns">token · binding · R2 public</div></div>
    </div>
    <div class="arrow" id="a1">↓ đẩy ra khỏi máy DB ngay</div>
    <div class="node" id="siem"><div class="nl">📚 SIEM / kho log</div><div class="ns">append-only · admin DB không xoá được · không chứa PII/secret</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="alertn"><div class="nl">🚨 Cảnh báo</div><div class="ns">ít nhưng đúng → phát hiện trong vài phút</div></div>
  `,
  steps: [
    { title: "1 · Postgres: kết nối + pgaudit", tab: "pg", highlight: [2, 3, 4, 5, 6, 7], on: ["pgn"],
      desc: "Log kết nối có user/db/host; pgaudit ghi mọi DDL và thay đổi quyền; không ghi giá trị tham số để tránh PII trong log." },
    { title: "2 · Object audit cho bảng nhạy cảm", tab: "pg", highlight: [8, 11, 12, 13, 14], on: ["pgn", "a1"],
      desc: "Role <code>auditor</code> được 'cấp quyền' trên bảng nhạy cảm chỉ để đánh dấu: mọi truy cập tới đúng các bảng đó được ghi, không phải toàn bộ DB." },
    { title: "3 · Mongo auditLog có filter", tab: "mongo", highlight: [2, 3, 4, 5, 6, 7, 8], on: ["mgn"],
      desc: "Ghi xác thực, quản lý user/role, xoá collection/database. Có ở Enterprise/Atlas/Percona; Community cần giải pháp khác." },
    { title: "4 · ClickHouse: session_log & query_log", tab: "ch", highlight: [3, 7, 8, 11, 12, 15, 16], on: ["chn"],
      desc: "Đăng nhập thất bại, user đọc bất thường, thay đổi quyền — truy vấn được ngay trong ClickHouse, nhưng phải đẩy ra ngoài để không bị xoá." },
    { title: "5 · Kafka authorizer log & Redis ACL LOG", tab: "kr", highlight: [3, 5, 10, 11, 13, 15], on: ["krn"],
      desc: "Các lần bị từ chối là tín hiệu quý: app bị từ chối = lỗi cấu hình hoặc bị chiếm. Không dùng MONITOR trên prod." },
    { title: "6 · Đưa ra SIEM và đặt cảnh báo", tab: "alert", highlight: [2, 3, 4, 5, 6, 7, 8, 9], on: ["cfn", "siem", "a2", "alertn"],
      desc: "Brute-force, đăng nhập lạ, bị từ chối, đổi quyền, DDL ngoài giờ, đọc hàng loạt, bucket bị public, backup bị động tới." }
  ],

  quiz: [
    { q: "Audit log giúp trả lời câu hỏi nào sau sự cố?", options: [
        "DB có nhanh không",
        "Có bao nhiêu bảng",
        "Ai đã làm gì, khi nào, từ đâu, trên dữ liệu nào",
        "Chi phí server"
      ], correct: 2,
      explanation: "Không có log, phạm vi thiệt hại không thể xác định." },
    { q: "Vì sao giữ pgaudit.log_parameter = off?", options: [
        "Tránh giá trị tham số (có thể là PII/secret) bị ghi vào audit log",
        "Để tăng tốc",
        "Vì pgaudit không hỗ trợ",
        "Để tắt audit"
      ], correct: 0,
      explanation: "Audit log được giữ lâu và nhiều người đọc — không được chứa dữ liệu nhạy cảm." },
    { q: "Object audit của pgaudit (pgaudit.role) dùng để làm gì?", options: [
        "Cấp quyền đọc cho auditor",
        "Mã hoá log",
        "Tắt log DDL",
        "Chỉ ghi truy cập tới những bảng mà role audit được 'cấp quyền' — chọn lọc bảng nhạy cảm"
      ], correct: 3,
      explanation: "Ghi toàn bộ read/write thường quá nhiều; object audit tập trung vào nơi quan trọng." },
    { q: "Tài khoản ứng dụng liên tục bị 'permission denied'. Nên coi là gì?", options: [
        "Bình thường, bỏ qua",
        "Tín hiệu cần điều tra: lỗi triển khai hoặc tài khoản bị chiếm và đang dò quyền",
        "Nên cấp thêm quyền ngay",
        "Lỗi của DB"
      ], correct: 1,
      explanation: "App đúng không bao giờ thử làm việc ngoài quyền của nó." },
    { q: "Vì sao phải đẩy audit log ra khỏi máy DB?", options: [
        "Để kẻ có quyền quản trị DB/máy không xoá được dấu vết",
        "Để tiết kiệm đĩa",
        "Vì DB không lưu được log",
        "Để log chạy nhanh hơn"
      ], correct: 0,
      explanation: "Kho log riêng, append-only, admin DB không có quyền sửa/xoá." },
    { q: "Redis ACL LOG ghi lại gì?", options: [
        "Mọi lệnh thành công",
        "Nội dung mọi key",
        "Xác thực thất bại và các lệnh/key/kênh bị ACL chặn",
        "Lịch sử cấu hình"
      ], correct: 2,
      explanation: "Kết hợp acllog-max-len và thu thập định kỳ vào SIEM." },
    { q: "Logger kafka.authorizer.logger ở mức INFO ghi gì?", options: [
        "Mọi lần được phép",
        "Các lần bị từ chối (cho phép ghi ở mức DEBUG)",
        "Nội dung message",
        "Không ghi gì"
      ], correct: 1,
      explanation: "Bật DEBUG sẽ ghi cả lần được phép — rất nhiều log." },
    { q: "Trên Cloudflare, sự kiện 'bật public access cho bucket R2' được ghi ở đâu?", options: [
        "Trong D1",
        "Không được ghi",
        "Trong KV",
        "Audit Logs của tài khoản"
      ], correct: 3,
      explanation: "Nên đặt cảnh báo cho thay đổi cấu hình nhạy cảm như vậy." },
    { q: "Dấu hiệu nào gợi ý đang có rút dữ liệu (exfiltration)?", options: [
        "Số truy vấn giảm",
        "CPU thấp",
        "Một user đọc số dòng gấp nhiều lần mức bình thường trong thời gian ngắn",
        "Không có đăng nhập"
      ], correct: 2,
      explanation: "So sánh với baseline của từng user (query_log, pg_stat_statements, metric)." }
  ]
});
