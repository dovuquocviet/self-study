window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Phân quyền",
  title: "Tính năng & lệnh nguy hiểm: tắt hoặc khoá lại",
  subtitle: "Redis (FLUSHALL, CONFIG, MODULE, EVAL) · Postgres (superuser, COPY PROGRAM, extension) · Mongo server-side JS · ClickHouse table function · Kafka admin & Connect",

  theory: `
    <p>Mỗi DB có một nhóm tính năng rất mạnh, được thiết kế cho <strong>người quản trị</strong>: xoá toàn bộ dữ liệu, đổi cấu hình khi đang chạy, nạp mã mở rộng, đọc file hay gọi ra mạng.
    Nếu tài khoản ứng dụng dùng được chúng, thì một lỗi nhỏ ở ứng dụng (hoặc credential bị lộ) có thể biến thành: mất toàn bộ dữ liệu, dữ liệu bị gửi ra ngoài, hoặc kẻ tấn công
    <strong>chiếm được máy chủ</strong> chạy DB. Bài này đi qua từng engine theo khuôn: <em>tính năng gì → vì sao nguy hiểm → cách tắt/khoá</em>.</p>

    <p><strong>Nguyên tắc chung</strong>: (1) app không bao giờ có quyền quản trị; (2) tính năng không dùng thì tắt ở cấu hình server; (3) tính năng cần dùng thì chỉ cấp cho tài khoản riêng, dùng từ bastion, có audit.</p>

    <p><strong>1. Redis</strong></p>
    <table>
      <tr><th>Lệnh / tính năng</th><th>Vì sao nguy hiểm</th><th>Cách khoá</th></tr>
      <tr><td><code>FLUSHALL</code>, <code>FLUSHDB</code></td><td>Xoá sạch dữ liệu trong một lệnh</td><td>ACL không cấp (nằm trong nhóm <code>@dangerous</code>)</td></tr>
      <tr><td><code>CONFIG SET</code></td><td>Đổi cấu hình khi đang chạy — kể cả nơi Redis ghi file xuống đĩa; đây là bước then chốt trong nhiều vụ chiếm máy chủ từ Redis mở</td><td>ACL không cấp; <code>enable-protected-configs no</code> (mặc định Redis 7) chặn đổi các config nhạy cảm như thư mục ghi file</td></tr>
      <tr><td><code>MODULE LOAD</code></td><td>Nạp thư viện native vào tiến trình Redis = chạy mã tuỳ ý</td><td><code>enable-module-command no</code> (mặc định Redis 7)</td></tr>
      <tr><td><code>DEBUG</code></td><td>Có thể làm treo/crash server, lộ thông tin nội bộ</td><td><code>enable-debug-command no</code> (mặc định Redis 7)</td></tr>
      <tr><td><code>EVAL</code>/<code>FUNCTION</code> (Lua)</td><td>Chạy script trên server; script dài chặn cả Redis (đơn luồng); từng có lỗ hổng sandbox</td><td>ACL <code>-@scripting</code> nếu app không cần; nếu cần, chỉ nạp script cố định do app sở hữu</td></tr>
      <tr><td><code>KEYS *</code></td><td>Quét toàn bộ key, chặn server với dữ liệu lớn (DoS)</td><td>ACL không cấp; dùng <code>SCAN</code></td></tr>
      <tr><td><code>REPLICAOF</code>, <code>MIGRATE</code>, <code>SHUTDOWN</code></td><td>Đổi vai trò replication, đẩy dữ liệu đi nơi khác, tắt server</td><td>nằm trong <code>@admin</code>/<code>@dangerous</code> — không cấp</td></tr>
    </table>
    <p>Trước Redis 6, cách duy nhất là <code>rename-command FLUSHALL ""</code> trong redis.conf. Cách này vẫn dùng được nhưng ACL là cách chuẩn hiện nay (và rename còn làm hỏng công cụ quản trị).</p>

    <p><strong>2. PostgreSQL</strong></p>
    <ul>
      <li><strong>Superuser</strong> vượt qua mọi kiểm tra quyền, có thể đọc/ghi file của máy chủ và chạy chương trình hệ điều hành (qua <code>COPY ... TO/FROM PROGRAM</code>, hàm file phía server, ngôn ngữ "untrusted").
        → App không bao giờ là superuser; số superuser tối thiểu.</li>
      <li><strong>Predefined role</strong> <code>pg_execute_server_program</code>, <code>pg_read_server_files</code>, <code>pg_write_server_files</code> cấp đúng các khả năng trên cho role thường → không cấp cho app.</li>
      <li><strong>Ngôn ngữ untrusted</strong> (<code>plpython3u</code>, <code>plperlu</code>): hàm viết bằng chúng chạy với quyền của tiến trình Postgres → chỉ cài khi thật sự cần.</li>
      <li><strong>Extension</strong>: một số extension mở ra đọc file hoặc kết nối mạng ra ngoài (<code>dblink</code>, <code>postgres_fdw</code>, <code>file_fdw</code>) → chỉ cài extension đã review, kiểm tra <code>\\dx</code> định kỳ.</li>
      <li><strong>Hàm <code>SECURITY DEFINER</code></strong> chạy với quyền của người tạo → luôn đặt <code>SET search_path</code> cố định và <code>REVOKE EXECUTE ... FROM PUBLIC</code>.</li>
      <li><strong><code>ALTER SYSTEM</code></strong>: PostgreSQL 17 có <code>allow_alter_system = off</code> khi cấu hình được quản lý bằng công cụ bên ngoài.</li>
    </ul>

    <p><strong>3. MongoDB — server-side JavaScript</strong></p>
    <p>Toán tử <code>$where</code>, <code>mapReduce</code> dạng JS, <code>$function</code>, <code>$accumulator</code> chạy JavaScript bên trong mongod. Nếu input người dùng lọt vào đó, nó trở thành <em>mã</em>
    chạy trên server (và rất dễ làm chậm cả cluster). Tắt bằng <code>security.javascriptEnabled: false</code> nếu ứng dụng không dùng — phần lớn ứng dụng không cần.</p>

    <p><strong>4. ClickHouse — table function & nguồn ngoài</strong></p>
    <p>Các table function như <code>file()</code>, <code>url()</code>, <code>remote()</code>, <code>s3()</code>, <code>mysql()</code>, <code>postgresql()</code>, <code>executable()</code> cho phép một câu SELECT
    đọc file trên máy chủ, gọi HTTP ra ngoài hoặc tới DB khác. Với user phân tích bị lợi dụng, đây là đường để <em>đọc file cục bộ</em> hoặc <em>đẩy dữ liệu ra ngoài</em>.
    Quyền dùng chúng thuộc nhóm <code>SOURCES</code> (<code>FILE</code>, <code>URL</code>, <code>REMOTE</code>, <code>S3</code>, <code>MYSQL</code>, <code>POSTGRES</code>…) → không cấp cho user thường;
    kiểm tra bằng <code>SHOW GRANTS</code>. Không cấp <code>access_management</code>, <code>SYSTEM</code>, <code>allow_introspection_functions</code> cho app.</p>

    <p><strong>5. Kafka — thao tác quản trị & hệ sinh thái</strong></p>
    <ul>
      <li>ACL thao tác <code>Alter</code>, <code>AlterConfigs</code>, <code>Delete</code> (xoá topic/records), <code>Create</code>, <code>ClusterAction</code> chỉ cho tài khoản vận hành/IaC.</li>
      <li><code>auto.create.topics.enable=false</code>: tránh client (hoặc lỗi chính tả) tự tạo topic với cấu hình mặc định.</li>
      <li><strong>Kafka Connect REST API</strong> (mặc định cổng 8083) không có xác thực theo mặc định. Ai gọi được nó có thể tạo connector mới — đọc/ghi hệ thống khác bằng credential của Connect.
        → chỉ nghe trên mạng nội bộ, bật xác thực, giới hạn plugin được cài, đặt <code>connector.client.config.override.policy=None</code>.</li>
      <li>Schema Registry, REST Proxy: tương tự — không để hở, có xác thực (bài 17).</li>
    </ul>

    <div class="callout"><p>💡 Mỗi quý chạy một "kiểm kê quyền nguy hiểm": ai là superuser Postgres, ai có <code>@dangerous</code> trên Redis, ai có <code>SOURCES</code> trên ClickHouse, ai có <code>Alter</code>/<code>Delete</code> trên Kafka,
    <code>javascriptEnabled</code> đang bật hay tắt. Danh sách càng ngắn càng tốt.</p></div>
  `,

  codeTabs: [
    { id: "redis", label: "🟥 Redis", lines: [
      "# redis.conf — tắt tính năng quản trị ở mức server (mặc định Redis 7)",
      "enable-protected-configs no     # CONFIG SET không đổi được dir, dbfilename...",
      "enable-debug-command no",
      "enable-module-command no",
      "",
      "# users.acl — app: bỏ các nhóm nguy hiểm",
      "user default off",
      "user app_cache on #<sha256-hex> ~cache:* +@all -@dangerous -@admin -@scripting -keys",
      "",
      "# Kiểm tra",
      "ACL DRYRUN app_cache FLUSHALL",
      "ACL DRYRUN app_cache CONFIG SET maxmemory 0",
      "",
      "# Redis cũ (< 6): cách tạm thời",
      "rename-command FLUSHALL \"\"",
      "rename-command CONFIG \"\""
    ]},
    { id: "pg", label: "🐘 Postgres", lines: [
      "-- Ai là superuser / có quyền đặc biệt?",
      "SELECT rolname FROM pg_roles WHERE rolsuper OR rolbypassrls OR rolcreaterole;",
      "SELECT r.rolname, m.rolname AS member FROM pg_auth_members am",
      "  JOIN pg_roles r ON r.oid = am.roleid JOIN pg_roles m ON m.oid = am.member",
      " WHERE r.rolname IN ('pg_execute_server_program','pg_read_server_files','pg_write_server_files');",
      "",
      "-- App: không superuser, không quyền server file/program",
      "ALTER ROLE app_orders NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;",
      "",
      "-- Extension & ngôn ngữ đang cài",
      "\\dx",
      "SELECT lanname, lanpltrusted FROM pg_language;",
      "",
      "-- SECURITY DEFINER: khoá search_path, bỏ EXECUTE của PUBLIC",
      "ALTER FUNCTION billing.close_month() SET search_path = pg_catalog, pg_temp;",
      "REVOKE EXECUTE ON FUNCTION billing.close_month() FROM PUBLIC;",
      "",
      "# postgresql.conf (PG 17+): cấu hình quản lý bằng IaC",
      "allow_alter_system = off"
    ]},
    { id: "mongo", label: "🍃 Mongo", lines: [
      "# mongod.conf — tắt server-side JavaScript",
      "security:",
      "  authorization: enabled",
      "  javascriptEnabled: false     # chặn $where, mapReduce JS, $function, $accumulator",
      "",
      "// Mẫu SAI: đưa input vào toán tử chạy JS",
      "db.users.find({ $where: 'this.name == \"' + <user_input_payload> + '\"' })",
      "",
      "// Mẫu ĐÚNG: filter thường, giá trị có kiểu",
      "db.users.find({ name: String(input.name) })"
    ]},
    { id: "ch", label: "🟨 ClickHouse", lines: [
      "-- Table function đọc file/URL/DB khác thuộc nhóm quyền SOURCES",
      "-- Không cấp cho user phân tích/app:",
      "REVOKE SOURCES ON *.* FROM reporting_ro;",
      "SHOW GRANTS FOR reporting_ro;     -- không được có FILE, URL, REMOTE, S3, MYSQL, POSTGRES...",
      "",
      "-- Chỉ user ETL riêng (dùng từ mạng nội bộ) được đọc S3",
      "GRANT S3 ON *.* TO etl_loader;",
      "",
      "<!-- users.d/app.xml: không quản trị, không introspection -->",
      "<clickhouse><users><reporting_ro>",
      "    <access_management>0</access_management>",
      "</reporting_ro></users>",
      "<profiles><ro_profile>",
      "    <readonly>1</readonly>",
      "    <allow_introspection_functions>0</allow_introspection_functions>",
      "</ro_profile></profiles></clickhouse>"
    ]},
    { id: "kafka", label: "📨 Kafka & Connect", lines: [
      "# server.properties",
      "auto.create.topics.enable=false",
      "allow.everyone.if.no.acl.found=false",
      "super.users=User:kafka-admin              # không có service ứng dụng nào ở đây",
      "",
      "# Thao tác quản trị chỉ cho principal IaC",
      "kafka-acls.sh ... --add --allow-principal User:terraform \\",
      "  --operation Create --operation Alter --operation AlterConfigs --operation Delete \\",
      "  --topic orders. --resource-pattern-type prefixed",
      "",
      "# connect-distributed.properties",
      "listeners=https://10.0.4.10:8443          # nội bộ, có TLS",
      "connector.client.config.override.policy=None",
      "plugin.path=/opt/connect/plugins-approved # chỉ plugin đã duyệt",
      "# + bật xác thực cho REST API (vd. BasicAuth REST extension / reverse proxy có auth)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🧾 Tài khoản ứng dụng</div><div class="ns">chỉ đọc/ghi dữ liệu nghiệp vụ</div></div>
    <div class="arrow" id="a1">↓ thử gọi tính năng quản trị</div>
    <div class="row">
      <div class="node" id="r"><div class="nl">🟥 FLUSHALL · CONFIG · MODULE</div><div class="ns">ACL -@dangerous</div></div>
      <div class="node" id="p"><div class="nl">🐘 COPY PROGRAM · untrusted</div><div class="ns">không superuser</div></div>
      <div class="node" id="m"><div class="nl">🍃 $where · $function</div><div class="ns">javascriptEnabled: false</div></div>
    </div>
    <div class="row">
      <div class="node" id="c"><div class="nl">🟨 file() · url() · remote()</div><div class="ns">không cấp SOURCES</div></div>
      <div class="node" id="k"><div class="nl">📨 Alter · Delete · Connect REST</div><div class="ns">chỉ IaC · REST có auth</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="blocked"><div class="nl">⛔ Bị từ chối</div><div class="ns">lỗi nhỏ ở app không thành chiếm máy chủ</div></div>
  `,
  steps: [
    { title: "1 · Redis: tắt ở server + ACL", tab: "redis", highlight: [2, 3, 4, 7, 8, 11, 12], on: ["app", "a1", "r", "blocked"],
      desc: "Redis 7 mặc định tắt MODULE, DEBUG và việc đổi config nhạy cảm. App bỏ <code>@dangerous</code>, <code>@admin</code>, <code>@scripting</code>; kiểm chứng bằng <code>ACL DRYRUN</code>." },
    { title: "2 · Postgres: kiểm kê superuser & role đặc biệt", tab: "pg", highlight: [2, 3, 4, 5, 8], on: ["p"],
      desc: "Superuser và ba role <code>pg_*_server_*</code> có thể chạm vào hệ điều hành. Danh sách thành viên phải gần như rỗng; app không bao giờ có." },
    { title: "3 · Postgres: extension, ngôn ngữ, SECURITY DEFINER", tab: "pg", highlight: [11, 12, 15, 16, 19], on: ["p", "blocked"],
      desc: "Rà extension và ngôn ngữ untrusted, khoá <code>search_path</code> cho hàm SECURITY DEFINER, và (PG17) chặn <code>ALTER SYSTEM</code>." },
    { title: "4 · Mongo: tắt server-side JS", tab: "mongo", highlight: [4, 7, 10], on: ["m", "blocked"],
      desc: "<code>$where</code> ghép chuỗi biến input thành mã chạy trên server. Tắt hẳn bằng <code>javascriptEnabled: false</code> và dùng filter thường có kiểu." },
    { title: "5 · ClickHouse: không cấp SOURCES", tab: "ch", highlight: [3, 4, 7, 11, 14, 15], on: ["c", "blocked"],
      desc: "Table function đọc file/URL/DB khác cần quyền nhóm SOURCES. User phân tích không có; chỉ user ETL riêng có đúng nguồn nó cần." },
    { title: "6 · Kafka: quản trị qua IaC, Connect không hở", tab: "kafka", highlight: [2, 3, 4, 8, 12, 13, 14], on: ["k", "blocked"],
      desc: "Không auto-create topic, không app nào là super user. Connect REST chỉ nội bộ, có xác thực, chỉ plugin đã duyệt." }
  ],

  quiz: [
    { q: "Vì sao lệnh CONFIG SET của Redis không được cấp cho tài khoản ứng dụng?", options: [
        "Nó cho phép đổi cấu hình lúc chạy, kể cả nơi Redis ghi file — bước then chốt trong nhiều vụ chiếm máy chủ từ Redis",
        "Vì nó chậm",
        "Vì nó chỉ dùng được trên Linux",
        "Vì nó xoá dữ liệu"
      ], correct: 0,
      explanation: "Chặn bằng ACL và giữ enable-protected-configs no để các config nhạy cảm không đổi được lúc chạy." },
    { q: "Cấu hình Redis 7 nào ngăn nạp thư viện native vào tiến trình Redis?", options: [
        "protected-mode yes",
        "maxmemory-policy noeviction",
        "enable-module-command no",
        "appendonly yes"
      ], correct: 2,
      explanation: "MODULE LOAD = chạy mã native tuỳ ý trong Redis. Mặc định Redis 7 đã tắt." },
    { q: "Predefined role nào của Postgres cho phép chạy chương trình trên máy chủ qua COPY ... PROGRAM?", options: [
        "pg_read_all_data",
        "pg_execute_server_program",
        "pg_monitor",
        "pg_signal_backend"
      ], correct: 1,
      explanation: "Role này (cùng pg_read/write_server_files) không bao giờ cấp cho app." },
    { q: "security.javascriptEnabled: false trong MongoDB tắt những gì?", options: [
        "Driver JavaScript của Node",
        "Kết nối từ mongosh",
        "Tất cả truy vấn",
        "Toán tử/tính năng chạy JS phía server như $where, mapReduce JS, $function, $accumulator"
      ], correct: 3,
      explanation: "Phần lớn ứng dụng không cần server-side JS; tắt nó loại bỏ cả một lớp rủi ro." },
    { q: "Trong ClickHouse, quyền dùng table function file()/url()/remote()/s3() thuộc nhóm nào?", options: [
        "SELECT",
        "INSERT",
        "SOURCES",
        "SHOW"
      ], correct: 2,
      explanation: "Không cấp SOURCES cho user thường; chỉ user ETL riêng có đúng nguồn cần." },
    { q: "Kafka Connect REST API để mở không xác thực trong mạng. Rủi ro là gì?", options: [
        "Ai gọi được có thể tạo connector mới để đọc/ghi hệ thống khác bằng credential của Connect",
        "Không rủi ro vì chỉ là API quản trị",
        "Chỉ làm chậm broker",
        "Chỉ lộ tên topic"
      ], correct: 0,
      explanation: "Giới hạn mạng, bật xác thực, chỉ plugin đã duyệt, override policy = None." },
    { q: "Hàm SECURITY DEFINER trong Postgres cần thêm gì để an toàn?", options: [
        "Chuyển sang plpython3u",
        "Không cần gì",
        "Đặt tên hàm dài",
        "SET search_path cố định (pg_catalog, pg_temp) và REVOKE EXECUTE FROM PUBLIC, chỉ cấp cho role cần"
      ], correct: 3,
      explanation: "Hàm chạy với quyền người tạo; search_path mở có thể bị lợi dụng để gọi nhầm đối tượng do người khác tạo." },
    { q: "Tại sao nên đặt auto.create.topics.enable=false trên Kafka?", options: [
        "Để tăng thông lượng",
        "Tránh client (hoặc lỗi chính tả) tự tạo topic với cấu hình mặc định ngoài quy trình quản lý",
        "Vì Kafka không hỗ trợ tạo topic",
        "Để bật TLS"
      ], correct: 1,
      explanation: "Topic nên được tạo qua IaC với retention, ACL, replication đã duyệt." },
    { q: "So với 'rename-command FLUSHALL \"\"', cách hiện đại để chặn lệnh nguy hiểm trên Redis 6+ là gì?", options: [
        "ACL theo user: bỏ @dangerous/@admin, cấp đúng lệnh cần",
        "Đổi cổng Redis",
        "Tắt persistence",
        "Dùng Redis Cluster"
      ], correct: 0,
      explanation: "ACL linh hoạt theo từng user, kiểm tra được bằng ACL DRYRUN, không làm hỏng công cụ quản trị." }
  ]
});
