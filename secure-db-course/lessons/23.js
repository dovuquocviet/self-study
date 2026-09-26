window.LESSONS.push({
  id: "23",
  phase: "6", phaseName: "Vận hành",
  title: "Migration, môi trường & dữ liệu dev",
  subtitle: "Quyền migration tách khỏi quyền app · migration là code được review · không copy dữ liệu prod ra dev · masking & dữ liệu tổng hợp · tách tài khoản/credential theo môi trường",

  theory: `
    <p>Nhiều sự cố dữ liệu không đến từ hacker mà từ chính quy trình phát triển: một migration xoá nhầm cột trên prod, một bản dump prod nằm trên laptop bị mất,
    môi trường staging dùng chung credential với prod, dev "tạm" kết nối DB prod để debug. Bài này gom các thực hành giữ cho <strong>vòng đời phát triển</strong> không trở thành cửa sau.</p>

    <p><strong>1. Tách quyền migration khỏi quyền ứng dụng</strong></p>
    <ul>
      <li><strong>Tài khoản migration</strong> (<code>migrator</code>) sở hữu schema: tạo/sửa/xoá bảng, index, role. Chỉ chạy trong pipeline deploy, credential chỉ CI có, thời gian dùng ngắn.</li>
      <li><strong>Tài khoản ứng dụng</strong> chỉ có DML trên bảng cần thiết (bài 07). App lúc chạy <em>không</em> có quyền DDL → lỗi injection hay bug không thể <code>DROP</code> bảng.</li>
      <li>Lỗi phổ biến: framework tự chạy migration khi app khởi động ("auto-migrate") → buộc app phải có quyền owner. Tách bước migrate thành job riêng trước khi deploy.</li>
      <li>Áp dụng tương tự: Mongo (app không có <code>dbAdmin</code>/<code>collMod</code>), ClickHouse (app không có <code>ALTER</code>/<code>CREATE</code>), Kafka (topic/ACL tạo qua IaC, app không có <code>Create</code>/<code>Alter</code>),
        Cloudflare (<code>wrangler d1 migrations apply</code> chạy từ CI với token riêng, khác token của runtime).</li>
    </ul>

    <p><strong>2. Migration là code: review, kiểm thử, có đường lui</strong></p>
    <ul>
      <li>Migration nằm trong repo, được review như code — đặc biệt các thao tác <em>phá huỷ</em> (<code>DROP</code>, <code>TRUNCATE</code>, đổi kiểu cột) và thao tác <em>quyền</em> (<code>GRANT</code>, <code>ALTER ROLE</code>, tắt RLS).</li>
      <li>Chạy thử trên staging có cùng cấu trúc (không cần cùng dữ liệu). Kiểm tra thời gian khoá bảng; dùng <code>lock_timeout</code> để migration thất bại nhanh thay vì chặn prod.</li>
      <li>Thay đổi phá huỷ theo mô hình <em>expand → migrate → contract</em>: thêm cột mới, chuyển dữ liệu, cập nhật code, rồi mới xoá cột cũ ở lần deploy sau.</li>
      <li>Có backup/điểm khôi phục ngay trước migration lớn (bài 20); D1 Time Travel cho phép quay về thời điểm trước khi migrate.</li>
      <li>Kiểm tra tự động trong CI: bảng mới có bật RLS chưa? có <code>GRANT</code> quá rộng (<code>ALL</code>, <code>PUBLIC</code>) không? có cột PII mới mà thiếu phân loại/retention không?</li>
    </ul>

    <p><strong>3. Không copy dữ liệu prod ra dev/test</strong></p>
    <p>Môi trường dev/test có bảo vệ yếu hơn nhiều: nhiều người truy cập, credential dùng chung, log debug chi tiết, laptop, công cụ bên thứ ba. Một bản copy prod ở đó
    = một vụ lộ dữ liệu đang chờ xảy ra (và thường vi phạm luật bảo vệ dữ liệu cá nhân). Lựa chọn thay thế, theo thứ tự ưu tiên:</p>
    <ol>
      <li><strong>Dữ liệu tổng hợp (synthetic)</strong>: script/seed sinh dữ liệu giả có cấu trúc và phân bố giống thật (thư viện Faker…). Mặc định cho dev và CI.</li>
      <li><strong>Dữ liệu đã ẩn danh hoá</strong> khi cần phân bố thật (test hiệu năng, tái hiện lỗi): quá trình masking chạy <em>trong vùng prod</em>, chỉ kết quả đã mask mới rời khỏi đó.
        Công cụ: PostgreSQL Anonymizer, pipeline tự viết; mask cả cột tự do (ghi chú, địa chỉ) và file đính kèm.</li>
      <li><strong>Tập con (subset)</strong> nhỏ nhất đủ dùng, đã mask, có hạn sử dụng và bị xoá sau đó.</li>
    </ol>
    <p>Lưu ý khi mask: giữ tính nhất quán tham chiếu (cùng một khách hàng ở hai bảng phải được mask giống nhau — dùng HMAC có khoá), không để lộ qua dữ liệu gián tiếp
    (kết hợp ngày sinh + mã bưu chính + giới tính có thể đủ để nhận diện một người).</p>

    <p><strong>4. Tách môi trường thật sự</strong></p>
    <ul>
      <li>Tài khoản cloud/project/tài khoản Cloudflare hoặc ít nhất resource riêng cho prod; mạng prod không route được từ dev.</li>
      <li>Credential khác nhau cho từng môi trường, lưu ở secret riêng; dev không bao giờ có credential prod "để debug". Cần xem prod → quy trình truy cập khẩn cấp (break-glass) có phê duyệt, có hạn, có log.</li>
      <li>Tên dễ phân biệt, cảnh báo trực quan khi kết nối tới prod (prompt psql/mongosh đổi màu).</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc dễ nhớ: <strong>schema đi từ dev lên prod, dữ liệu không bao giờ đi từ prod xuống dev</strong> (trừ khi đã qua masking trong vùng prod).</p></div>
  `,

  codeTabs: [
    { id: "roles", label: "🛠️ Tách quyền migration", lines: [
      "-- Postgres: migrator sở hữu schema, app chỉ DML",
      "CREATE ROLE migrator LOGIN;                       -- credential chỉ CI có",
      "ALTER SCHEMA orders OWNER TO migrator;",
      "",
      "CREATE ROLE app_orders LOGIN IN ROLE orders_rw;  -- không owner, không DDL",
      "ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA orders",
      "  GRANT SELECT, INSERT, UPDATE ON TABLES TO orders_rw;",
      "",
      "# Pipeline: migrate là job riêng TRƯỚC khi deploy app",
      "steps:",
      "  - name: migrate",
      "    env: { DATABASE_URL: secret('prod/migrator-url') }",
      "    run: ./migrate up --lock-timeout=3s",
      "  - name: deploy-app",
      "    env: { DATABASE_URL: secret('prod/app-orders-url') }   # app không có quyền DDL"
    ]},
    { id: "other", label: "🍃🟨📨☁️ Engine khác", lines: [
      "// Mongo: user migration riêng; app không có dbAdmin / collMod",
      "db.getSiblingDB('orders').createUser({ user: 'orders_migrator', pwd: passwordPrompt(),",
      "  roles: [ { role: 'dbAdmin', db: 'orders' }, { role: 'readWrite', db: 'orders' } ] })",
      "",
      "-- ClickHouse: chỉ migrator có ALTER/CREATE",
      "GRANT CREATE TABLE, ALTER, DROP TABLE ON analytics.* TO ch_migrator;",
      "",
      "# Kafka: topic + ACL qua IaC (vd. Terraform), app không có Create/Alter",
      "",
      "# Cloudflare D1: migration từ CI với token riêng",
      "wrangler d1 migrations create shop-prod add_orders_status",
      "wrangler d1 migrations apply shop-prod --remote --env production",
      "# token CI migrate != token deploy; Time Travel làm điểm khôi phục"
    ]},
    { id: "ci", label: "🔍 Kiểm tra migration", lines: [
      "// Chạy trong CI trên mọi migration mới",
      "for stmt in parse_sql(migration):",
      "    if stmt.kind in [DROP_TABLE, DROP_COLUMN, TRUNCATE]: require_label('destructive-approved')",
      "    if stmt.kind == GRANT and (stmt.privs == ALL or stmt.grantee == PUBLIC): fail('grant quá rộng')",
      "    if stmt.kind == ALTER_TABLE and 'DISABLE ROW LEVEL SECURITY' in stmt: fail('tắt RLS')",
      "    if stmt.kind == CREATE_TABLE and has_tenant_id(stmt) and not enables_rls(migration, stmt.table):",
      "        fail('bảng theo tenant chưa bật RLS')",
      "    if adds_pii_column(stmt) and not documented(stmt.column, 'retention'):",
      "        fail('cột PII mới thiếu phân loại/retention')"
    ]},
    { id: "mask", label: "🎭 Dữ liệu dev", lines: [
      "// 1. Mặc định: dữ liệu tổng hợp",
      "for i in 1..10000:",
      "    insert_customer(name=faker.name(), email='user' + i + '@example.test', city=faker.city())",
      "",
      "-- 2. Cần phân bố thật: mask TRONG vùng prod (PostgreSQL Anonymizer)",
      "CREATE EXTENSION anon CASCADE;",
      "SECURITY LABEL FOR anon ON COLUMN customers.full_name IS 'MASKED WITH FUNCTION anon.fake_last_name()';",
      "SECURITY LABEL FOR anon ON COLUMN customers.email IS 'MASKED WITH FUNCTION anon.fake_email()';",
      "SECURITY LABEL FOR anon ON COLUMN customers.note IS 'MASKED WITH VALUE NULL';",
      "-- xuất bản đã mask bằng công cụ dump của anon, chỉ file kết quả mới rời prod",
      "",
      "// Giữ nhất quán tham chiếu: cùng khách hàng -> cùng giá trị giả ở mọi bảng",
      "pseudo_id = hmac_sha256(MASKING_KEY, customer_id)"
    ]},
    { id: "env", label: "🧭 Tách môi trường", lines: [
      "# Secret theo môi trường, không dùng chung",
      "prod/app-orders-url     -> chỉ workload prod đọc được",
      "staging/app-orders-url  -> chỉ workload staging đọc được",
      "",
      "# psql: prompt đổi màu khi kết nối prod (~/.psqlrc)",
      "\\set PROMPT1 '%[%033[1;31m%]PROD%[%033[0m%] %n@%/%R%# '",
      "",
      "// Break-glass: xem prod khi khẩn cấp",
      "request_access(user, scope='read orders', ttl='1h', reason=ticket)",
      "  -> cần phê duyệt -> cấp credential tạm (bài 06) -> mọi truy vấn được audit (bài 21)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="dev"><div class="nl">💻 Dev / CI</div><div class="ns">dữ liệu tổng hợp</div></div>
      <div class="node" id="stg"><div class="nl">🧪 Staging</div><div class="ns">cùng schema · credential riêng</div></div>
      <div class="node" id="prod"><div class="nl">🏭 Production</div><div class="ns">dữ liệu thật</div></div>
    </div>
    <div class="arrow" id="a1">→ schema đi lên (migration qua CI, tài khoản migrator)</div>
    <div class="row">
      <div class="node" id="mig"><div class="nl">🛠️ migrator</div><div class="ns">DDL · chỉ trong pipeline</div></div>
      <div class="node" id="appr"><div class="nl">🧾 app</div><div class="ns">chỉ DML</div></div>
    </div>
    <div class="arrow" id="a2">⛔ dữ liệu prod không đi xuống dev</div>
    <div class="node" id="maskz"><div class="nl">🎭 Vùng masking trong prod</div><div class="ns">chỉ kết quả đã mask mới rời đi</div></div>
  `,
  steps: [
    { title: "1 · migrator sở hữu schema, app chỉ DML", tab: "roles", highlight: [2, 3, 5, 6, 7], on: ["mig", "appr"],
      desc: "Lỗi ở app không thể <code>DROP</code> bảng vì app không có quyền DDL. Default privileges tự cấp DML cho bảng mới." },
    { title: "2 · Migrate là job riêng trong pipeline", tab: "roles", highlight: [11, 12, 13, 14, 15], on: ["a1", "mig", "prod"],
      desc: "Không auto-migrate lúc app khởi động. Job migrate dùng credential migrator, <code>lock_timeout</code> để thất bại nhanh thay vì chặn prod." },
    { title: "3 · Cùng nguyên tắc trên engine khác", tab: "other", highlight: [2, 3, 6, 8, 11, 12, 13], on: ["mig"],
      desc: "Mongo/ClickHouse có user migration riêng; Kafka dùng IaC; D1 migration từ CI với token khác token deploy." },
    { title: "4 · Kiểm tra migration tự động", tab: "ci", highlight: [3, 4, 5, 6, 7, 8, 9], on: ["stg", "a1"],
      desc: "CI chặn thao tác phá huỷ chưa được duyệt, GRANT quá rộng, tắt RLS, bảng tenant thiếu RLS, cột PII thiếu retention." },
    { title: "5 · Dữ liệu dev: tổng hợp hoặc đã mask", tab: "mask", highlight: [2, 3, 6, 7, 8, 9, 10, 13], on: ["dev", "a2", "maskz"],
      desc: "Mặc định dùng dữ liệu giả. Khi cần phân bố thật, mask trong vùng prod; giữ nhất quán tham chiếu bằng HMAC có khoá." },
    { title: "6 · Tách môi trường và break-glass", tab: "env", highlight: [2, 3, 6, 9, 10], on: ["stg", "prod"],
      desc: "Secret riêng từng môi trường, cảnh báo trực quan khi vào prod; truy cập khẩn cấp có phê duyệt, credential tạm và audit." }
  ],

  quiz: [
    { q: "Vì sao không nên để ứng dụng tự chạy migration khi khởi động (auto-migrate) trên prod?", options: [
        "Vì chậm",
        "Vì không log được",
        "Vì migration không chạy được",
        "Buộc tài khoản app phải có quyền DDL/owner — lỗi ở app có thể thay đổi hoặc xoá cấu trúc"
      ], correct: 3,
      explanation: "Tách migrate thành job riêng với tài khoản migrator." },
    { q: "Nguyên tắc 'schema đi lên, dữ liệu không đi xuống' nghĩa là gì?", options: [
        "Không được đổi schema",
        "Thay đổi cấu trúc đi từ dev lên prod qua migration; dữ liệu prod không được copy xuống dev (trừ khi đã mask trong vùng prod)",
        "Dữ liệu dev được đẩy lên prod",
        "Chỉ dùng một môi trường"
      ], correct: 1,
      explanation: "Môi trường dev bảo vệ yếu hơn nhiều." },
    { q: "Khi cần dữ liệu có phân bố giống thật để test hiệu năng, cách an toàn?", options: [
        "Masking/ẩn danh hoá chạy trong vùng prod, chỉ kết quả đã mask rời đi; dùng tập con nhỏ nhất và xoá sau khi dùng",
        "Copy nguyên DB prod sang staging",
        "Gửi dump prod cho dev qua chat",
        "Cho dev kết nối trực tiếp prod"
      ], correct: 0,
      explanation: "Dữ liệu rõ không bao giờ rời vùng prod." },
    { q: "Vì sao khi mask cần giữ nhất quán tham chiếu (dùng HMAC có khoá)?", options: [
        "Để dữ liệu đẹp hơn",
        "Để tăng tốc",
        "Cùng một thực thể ở nhiều bảng phải được thay bằng cùng giá trị giả để join/test vẫn đúng, mà không đảo ngược được",
        "Không cần thiết"
      ], correct: 2,
      explanation: "HMAC có khoá cho kết quả ổn định nhưng không đoán ngược được." },
    { q: "Mô hình expand → migrate → contract dùng cho việc gì?", options: [
        "Tăng dung lượng DB",
        "Thay đổi phá huỷ an toàn: thêm mới, chuyển dữ liệu, cập nhật code, rồi mới xoá cái cũ ở lần deploy sau",
        "Nén bảng",
        "Mã hoá cột"
      ], correct: 1,
      explanation: "Luôn có đường lui trong suốt quá trình." },
    { q: "Kiểm tra CI nào hữu ích cho migration?", options: [
        "Đếm số dòng code",
        "Không cần kiểm tra",
        "Kiểm tra chính tả comment",
        "Chặn DROP/TRUNCATE chưa duyệt, GRANT ALL/PUBLIC, tắt RLS, bảng tenant thiếu RLS, cột PII thiếu retention"
      ], correct: 3,
      explanation: "Biến quy tắc bảo mật thành kiểm tra tự động." },
    { q: "Với Cloudflare D1, migration prod nên chạy thế nào?", options: [
        "Từ laptop dev bằng token cá nhân",
        "Trong Worker lúc nhận request đầu tiên",
        "Từ CI bằng 'wrangler d1 migrations apply --remote' với token riêng cho migrate, có Time Travel làm điểm khôi phục",
        "Sửa trực tiếp trên dashboard"
      ], correct: 2,
      explanation: "Token migrate tách khỏi token deploy; mọi thay đổi qua repo và CI." },
    { q: "Dev cần xem dữ liệu prod để xử lý sự cố khẩn cấp. Cách đúng?", options: [
        "Quy trình break-glass: phê duyệt, credential tạm có hạn, phạm vi hẹp, mọi truy vấn được audit",
        "Dùng credential prod lưu sẵn trên máy",
        "Nhờ đồng nghiệp gửi dump",
        "Tắt RLS tạm thời"
      ], correct: 0,
      explanation: "Truy cập ngoại lệ vẫn phải kiểm soát và để lại dấu vết." },
    { q: "Vì sao Kafka topic và ACL nên được tạo qua IaC thay vì app tự tạo?", options: [
        "Vì app không kết nối được Kafka",
        "Không có lý do",
        "Để topic nhanh hơn",
        "Để cấu hình (retention, replication, ACL) được review và app không cần quyền Create/Alter"
      ], correct: 3,
      explanation: "Cùng nguyên tắc tách quyền cấu trúc khỏi quyền dữ liệu." }
  ]
});
