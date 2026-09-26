window.LESSONS.push({
  id: "07",
  phase: "3", phaseName: "Phân quyền",
  title: "Least privilege: quyền tối thiểu trên từng engine",
  subtitle: "Role theo ứng dụng · read-only · GRANT hẹp: Postgres roles, Mongo roles, Redis ACL theo lệnh/key, Kafka ACL theo topic/group, ClickHouse grants, Cloudflare binding",

  theory: `
    <p>Xác thực cho biết <em>ai</em>; phân quyền (authorization) quyết định <strong>người đó được làm gì</strong>. Nguyên tắc <strong>đặc quyền tối thiểu</strong> (least privilege):
    mỗi tài khoản chỉ có <em>đúng</em> những quyền cần cho công việc của nó — không hơn. Mục tiêu là <strong>giới hạn bán kính thiệt hại</strong> (blast radius) khi tài khoản đó bị lạm dụng.</p>

    <p><strong>1. Vì sao "cho quyền admin cho nhanh" nguy hiểm?</strong></p>
    <ul>
      <li>Một lỗi injection trong API đọc sản phẩm, nếu tài khoản app có quyền <code>DROP</code>/<code>DELETE</code> trên mọi bảng → lỗi nhỏ thành thảm hoạ.</li>
      <li>Superuser Postgres có thể đọc file và chạy chương trình trên máy chủ (bài 09). Role <code>root</code> của Mongo quản lý cả user.</li>
      <li>Quyền rộng khiến audit log vô ích: "app đã xoá bảng" — nhưng app nào, vì sao nó được xoá?</li>
    </ul>

    <p><strong>2. Cách thiết kế quyền (áp cho mọi engine)</strong></p>
    <ol>
      <li><strong>Liệt kê thao tác thật</strong> của service: orders-api đọc/ghi bảng orders, order_items; chỉ đọc bảng products. reporting chỉ đọc. Không ai cần <code>DROP</code> lúc chạy.</li>
      <li><strong>Tạo role nhóm theo chức năng</strong> (<code>orders_rw</code>, <code>catalog_ro</code>, <code>reporting_ro</code>), cấp quyền cho role, rồi gán role cho tài khoản đăng nhập.</li>
      <li><strong>Tách quyền DDL</strong> (tạo/sửa/xoá bảng) cho tài khoản migration riêng (bài 23). Tài khoản app chỉ có DML.</li>
      <li><strong>Hẹp theo chiều dữ liệu</strong>: schema/database cụ thể, bảng/collection/topic cụ thể, thậm chí cột cụ thể (Postgres, ClickHouse đều hỗ trợ grant theo cột).</li>
      <li><strong>Rà soát định kỳ</strong>: quyền có xu hướng phình ra theo thời gian. Kiểm tra bằng <code>\\dp</code>, <code>SHOW GRANTS</code>, <code>ACL LIST</code>, <code>kafka-acls --list</code>.</li>
    </ol>

    <p><strong>3. "Núm vặn" trên từng engine</strong></p>
    <table>
      <tr><th>Engine</th><th>Đơn vị quyền</th><th>Mẫu tối thiểu cho app</th><th>Tránh</th></tr>
      <tr><td>PostgreSQL</td><td>role, GRANT trên database/schema/bảng/cột/sequence/hàm</td><td><code>CONNECT</code> + <code>USAGE</code> schema + <code>SELECT/INSERT/UPDATE</code> đúng bảng</td><td><code>SUPERUSER</code>, <code>CREATEROLE</code>, owner của bảng, <code>pg_read_all_data</code> cho app</td></tr>
      <tr><td>MongoDB</td><td>role = tập privileges (resource db/collection + actions)</td><td>custom role với <code>find</code>/<code>insert</code>/<code>update</code> trên collection cụ thể, hoặc <code>read</code>/<code>readWrite</code> một db</td><td><code>root</code>, <code>dbOwner</code>, <code>userAdmin*</code>, <code>readWriteAnyDatabase</code></td></tr>
      <tr><td>Redis</td><td>ACL: lệnh/nhóm lệnh (<code>+@read</code>), key pattern (<code>~</code>), kênh pub/sub (<code>&amp;</code>)</td><td>chỉ vài lệnh cần dùng, chỉ key có prefix của app; key chỉ đọc bằng <code>%R~</code> (Redis 7)</td><td><code>+@all ~*</code>, dùng chung user <code>default</code></td></tr>
      <tr><td>Kafka</td><td>ACL: principal × operation × resource (topic, group, cluster, transactionalId)</td><td>producer: <code>Write</code>+<code>Describe</code> topic; consumer: <code>Read</code> topic + <code>Read</code> group</td><td>ACL <code>*</code>, <code>super.users</code> cho app, quyền <code>Alter</code>/<code>Delete</code>/<code>Create</code> cho app</td></tr>
      <tr><td>ClickHouse</td><td>user/role, GRANT trên db/bảng/cột, settings profile</td><td><code>GRANT SELECT ON analytics.* TO reporting_ro</code> + profile <code>readonly = 1</code></td><td><code>GRANT ALL</code>, <code>access_management</code> cho app, dùng user <code>default</code></td></tr>
      <tr><td>Cloudflare</td><td>binding (Worker có binding = toàn quyền trên resource đó); API token theo permission + resource</td><td>tách database/namespace/bucket theo mục đích; Worker chỉ có binding nó cần</td><td>một Worker "god" có binding tới mọi thứ; token quyền cả account</td></tr>
    </table>

    <p><strong>4. Cloudflare: binding không có "read-only"</strong> — nên least privilege thực hiện bằng <em>kiến trúc</em>:</p>
    <ul>
      <li>Worker public chỉ giữ binding tới resource nó thật sự cần; tác vụ nhạy cảm (admin, xuất dữ liệu) đặt trong Worker khác, gọi qua <em>service binding</em> với API hẹp.</li>
      <li>Công cụ ngoài đọc R2 qua S3 API dùng token "Object Read only" chỉ cho bucket cụ thể.</li>
      <li>Dữ liệu khác mức nhạy cảm → D1 database / KV namespace / R2 bucket khác nhau.</li>
    </ul>

    <div class="callout"><p>💡 Kiểm thử quyền như kiểm thử tính năng: viết test tích hợp đăng nhập bằng tài khoản app rồi thử <code>DROP TABLE</code>, đọc bảng không liên quan,
    ghi vào topic khác, gọi <code>FLUSHALL</code> — tất cả phải <strong>bị từ chối</strong>. Test đỏ = quyền đã phình ra.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "🐘 Postgres roles", lines: [
      "-- Role nhóm (không đăng nhập) giữ quyền",
      "CREATE ROLE orders_rw NOLOGIN;",
      "GRANT CONNECT ON DATABASE shop TO orders_rw;",
      "GRANT USAGE ON SCHEMA orders TO orders_rw;",
      "GRANT SELECT, INSERT, UPDATE ON orders.orders, orders.order_items TO orders_rw;",
      "GRANT SELECT ON catalog.products TO orders_rw;          -- chỉ đọc",
      "",
      "CREATE ROLE reporting_ro NOLOGIN;",
      "GRANT USAGE ON SCHEMA orders TO reporting_ro;",
      "GRANT SELECT (id, status, total, created_at) ON orders.orders TO reporting_ro;  -- chỉ vài cột",
      "",
      "-- Bảng mới do migrator tạo sau này cũng tự cấp quyền đọc",
      "ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA orders",
      "    GRANT SELECT ON TABLES TO reporting_ro;",
      "",
      "-- Tài khoản đăng nhập kế thừa role nhóm",
      "CREATE ROLE app_orders LOGIN IN ROLE orders_rw;",
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC;"
    ]},
    { id: "mongo", label: "🍃 Mongo roles", lines: [
      "// Custom role: chỉ thao tác cần thiết trên collection cụ thể",
      "db.getSiblingDB('orders').createRole({",
      "  role: 'ordersApp',",
      "  privileges: [",
      "    { resource: { db: 'orders', collection: 'orders' }, actions: ['find', 'insert', 'update'] },",
      "    { resource: { db: 'orders', collection: 'products' }, actions: ['find'] }",
      "  ],",
      "  roles: []",
      "})",
      "db.getSiblingDB('orders').createUser({ user: 'orders_app', pwd: passwordPrompt(),",
      "  roles: [ { role: 'ordersApp', db: 'orders' } ] })",
      "",
      "// Reporting: role có sẵn 'read' trên đúng một db",
      "db.getSiblingDB('orders').grantRolesToUser('bi_reader', [ { role: 'read', db: 'orders' } ])",
      "// Tránh cho app: root, dbOwner, userAdmin, readWriteAnyDatabase"
    ]},
    { id: "redis", label: "🟥 Redis ACL", lines: [
      "# Chỉ vài lệnh, chỉ key có prefix của app",
      "ACL SETUSER orders_cache on #<sha256-hex> resetkeys ~orders:cache:* resetchannels",
      "ACL SETUSER orders_cache -@all +get +set +del +expire +ttl +mget",
      "",
      "# Worker chỉ đọc: key chỉ-đọc (Redis 7: %R~)",
      "ACL SETUSER stats_reader on #<sha256-hex> resetkeys %R~stats:* -@all +get +mget +scan",
      "",
      "# Pub/Sub chỉ kênh của mình",
      "ACL SETUSER notifier on #<sha256-hex> resetchannels &notify:* -@all +publish",
      "",
      "# Kiểm tra quyền",
      "ACL GETUSER orders_cache",
      "ACL DRYRUN orders_cache FLUSHALL        # -> bị từ chối"
    ]},
    { id: "kafka", label: "📨 Kafka ACL", lines: [
      "# Producer orders-svc: chỉ ghi topic orders.events",
      "kafka-acls.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties \\",
      "  --add --allow-principal User:orders-svc \\",
      "  --operation Write --operation Describe --topic orders.events",
      "",
      "# Consumer billing-svc: đọc topic + dùng đúng consumer group của nó",
      "kafka-acls.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties \\",
      "  --add --allow-principal User:billing-svc \\",
      "  --operation Read --topic orders.events --group billing-consumer",
      "",
      "# Nhiều topic cùng tiền tố",
      "kafka-acls.sh ... --add --allow-principal User:analytics \\",
      "  --operation Read --topic analytics. --resource-pattern-type prefixed",
      "",
      "# server.properties: không có ACL thì từ chối",
      "allow.everyone.if.no.acl.found=false"
    ]},
    { id: "ch", label: "🟨 ClickHouse & ☁️ CF", lines: [
      "-- ClickHouse: role + grant hẹp + profile chỉ đọc",
      "CREATE ROLE reporting_ro;",
      "GRANT SELECT ON analytics.* TO reporting_ro;",
      "GRANT SELECT(event_time, event_type, country) ON analytics.raw_events TO reporting_ro;",
      "CREATE SETTINGS PROFILE ro_profile SETTINGS readonly = 1 TO reporting_ro;",
      "CREATE USER bi_tool IDENTIFIED WITH sha256_password BY '<secret>' DEFAULT ROLE reporting_ro;",
      "SHOW GRANTS FOR bi_tool;",
      "",
      "# Cloudflare: Worker public chỉ có binding nó cần",
      "[[d1_databases]]",
      "binding = \"CATALOG\"          # không có binding tới D1 'billing'",
      "database_name = \"catalog-prod\"",
      "database_id = \"<uuid>\"",
      "[[services]]",
      "binding = \"BILLING_API\"      # tác vụ billing qua service binding với API hẹp",
      "service = \"billing-internal\""
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="app"><div class="nl">🧾 orders-api</div><div class="ns">orders_rw</div></div>
      <div class="node" id="rep"><div class="nl">📊 reporting</div><div class="ns">reporting_ro</div></div>
      <div class="node" id="mig"><div class="nl">🛠️ migrator</div><div class="ns">DDL, chỉ lúc deploy</div></div>
    </div>
    <div class="arrow" id="a1">↓ mỗi tài khoản một phạm vi</div>
    <div class="row">
      <div class="node" id="rw"><div class="nl">✏️ orders.orders</div><div class="ns">SELECT/INSERT/UPDATE</div></div>
      <div class="node" id="ro"><div class="nl">👁️ catalog.products</div><div class="ns">SELECT</div></div>
      <div class="node" id="cols"><div class="nl">🔍 cột được phép</div><div class="ns">id, status, total</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="denied"><div class="nl">⛔ Mọi thứ khác</div><div class="ns">DROP · bảng khác · topic khác · FLUSHALL → từ chối</div></div>
  `,
  steps: [
    { title: "1 · Role nhóm theo chức năng", tab: "pg", highlight: [2, 3, 4, 5, 6, 17], on: ["app", "a1", "rw", "ro"],
      desc: "Quyền cấp cho role nhóm <code>orders_rw</code>, tài khoản đăng nhập chỉ kế thừa. App chỉ có DML trên đúng bảng, chỉ đọc bảng tham chiếu." },
    { title: "2 · Hẹp tới mức cột", tab: "pg", highlight: [8, 9, 10, 13, 14], on: ["rep", "cols"],
      desc: "Reporting chỉ thấy vài cột không nhạy cảm. Default privileges đảm bảo bảng mới cũng được cấp đúng — không ai phải 'GRANT ALL cho nhanh'." },
    { title: "3 · Mongo: custom role theo collection", tab: "mongo", highlight: [2, 5, 6, 10, 11, 15], on: ["app", "rw", "ro"],
      desc: "Privileges = resource (db + collection) × actions. Tránh các role có sẵn quá rộng như <code>root</code>, <code>dbOwner</code>." },
    { title: "4 · Redis: lệnh + key pattern", tab: "redis", highlight: [2, 3, 6, 9, 13], on: ["app", "denied"],
      desc: "<code>-@all</code> rồi cộng dần đúng lệnh cần; <code>~orders:cache:*</code> giới hạn key. <code>ACL DRYRUN</code> kiểm tra một lệnh có bị chặn không." },
    { title: "5 · Kafka: ACL theo topic và group", tab: "kafka", highlight: [3, 4, 8, 9, 13, 16], on: ["app", "rep", "denied"],
      desc: "Producer chỉ Write topic của mình; consumer Read topic + Read group. Không có ACL = từ chối." },
    { title: "6 · ClickHouse: grant + profile readonly", tab: "ch", highlight: [2, 3, 4, 5, 6], on: ["rep", "cols"],
      desc: "Grant theo db/bảng/cột, profile <code>readonly = 1</code> chặn mọi truy vấn ghi và việc tự đổi setting." },
    { title: "7 · Cloudflare: quyền bằng kiến trúc", tab: "ch", highlight: [10, 11, 14, 15, 16], on: ["mig", "denied"],
      desc: "Binding = toàn quyền trên resource. Chỉ khai báo binding cần thiết; tác vụ nhạy cảm tách sang Worker khác qua service binding." }
  ],

  quiz: [
    { q: "Nguyên tắc least privilege nhằm mục tiêu chính nào?", options: [
        "Tăng hiệu năng truy vấn",
        "Không cần mật khẩu",
        "Giảm số lượng tài khoản",
        "Giới hạn thiệt hại khi một tài khoản bị lạm dụng hoặc có lỗi"
      ], correct: 3,
      explanation: "Quyền càng hẹp, lỗi (injection, service bị chiếm) càng ít gây hại." },
    { q: "Consumer Kafka billing-svc cần tối thiểu những ACL nào?", options: [
        "All trên cluster",
        "Read trên topic và Read trên consumer group của nó",
        "Write trên topic",
        "Alter trên topic và group"
      ], correct: 1,
      explanation: "Consumer cần đọc topic và commit offset qua group. Không cần Write/Alter/Create." },
    { q: "Redis ACL '-@all +get +set ~orders:cache:*' nghĩa là gì?", options: [
        "Chỉ cho GET/SET, và chỉ trên key bắt đầu bằng 'orders:cache:'",
        "Cho phép mọi lệnh trên mọi key",
        "Chặn GET/SET",
        "Chỉ đọc mọi key"
      ], correct: 0,
      explanation: "Bắt đầu từ không có gì (-@all), cộng dần lệnh cần, giới hạn key pattern." },
    { q: "Vì sao không nên để tài khoản ứng dụng là owner của các bảng Postgres?", options: [
        "Owner không đọc được dữ liệu",
        "Owner làm chậm truy vấn",
        "Owner có quyền DROP/ALTER bảng và bỏ qua RLS (trừ khi FORCE) — quá rộng cho app",
        "Không có lý do gì"
      ], correct: 2,
      explanation: "Tách owner (migrator) khỏi app: app chỉ có DML, không thay đổi được cấu trúc." },
    { q: "ALTER DEFAULT PRIVILEGES giải quyết vấn đề gì?", options: [
        "Đổi mật khẩu mặc định",
        "Bảng mới do một role tạo ra sau này tự được cấp quyền đúng, tránh phải 'GRANT ALL cho nhanh'",
        "Xoá quyền mặc định của superuser",
        "Bật RLS mặc định"
      ], correct: 1,
      explanation: "GRANT ON ALL TABLES chỉ áp cho bảng đang có; default privileges áp cho bảng tạo sau." },
    { q: "Binding D1 trong Worker có thể đặt 'chỉ đọc' không, và nên làm gì?", options: [
        "Có, thêm readonly = true",
        "Dùng API token thay binding trong Worker",
        "Không cần vì D1 tự chặn DELETE",
        "Binding cho quyền đầy đủ trên resource; least privilege đạt được bằng cách tách database/Worker và chỉ khai báo binding cần thiết"
      ], correct: 3,
      explanation: "Kiến trúc thay cho GRANT: Worker public không giữ binding tới dữ liệu nhạy cảm." },
    { q: "Role Mongo nào KHÔNG nên cấp cho tài khoản ứng dụng?", options: [
        "Custom role có find/insert trên một collection",
        "read trên db của app",
        "userAdminAnyDatabase",
        "readWrite trên db của app"
      ], correct: 2,
      explanation: "userAdmin* có thể tạo user/cấp quyền — tương đương leo thang lên toàn quyền." },
    { q: "ClickHouse profile 'readonly = 1' cho user reporting có tác dụng gì?", options: [
        "Chỉ cho phép truy vấn đọc và không cho tự thay đổi setting",
        "Chỉ đọc được một bảng",
        "Tắt HTTP interface",
        "Mã hoá kết quả"
      ], correct: 0,
      explanation: "Kết hợp với GRANT SELECT trên đúng db/bảng/cột để có quyền đọc tối thiểu." },
    { q: "Cách tốt để phát hiện quyền 'phình ra' theo thời gian?", options: [
        "Hỏi dev có nhớ đã cấp gì không",
        "Xoá hết quyền mỗi tháng",
        "Chờ audit năm",
        "Test tích hợp đăng nhập bằng tài khoản app và khẳng định các thao tác không được phép bị từ chối, cộng rà soát định kỳ"
      ], correct: 3,
      explanation: "Test 'phải bị từ chối' biến least privilege thành thứ kiểm chứng được tự động." }
  ]
});
