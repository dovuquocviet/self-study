window.LESSONS.push({
  id: "15",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "PII & vòng đời dữ liệu",
  subtitle: "Tối thiểu hoá · masking · retention/TTL trên Redis, ClickHouse, Kafka, Mongo, Postgres, D1/KV/R2 · xoá thật sự và crypto-shredding",

  theory: `
    <p><strong>PII</strong> (Personally Identifiable Information — thông tin định danh cá nhân) là dữ liệu giúp xác định một người: họ tên, email, số điện thoại, địa chỉ, số giấy tờ,
    IP, vị trí, ảnh, dữ liệu sức khoẻ, tài chính… Dữ liệu an toàn nhất là dữ liệu <strong>bạn không lưu</strong>. Dữ liệu an toàn thứ nhì là dữ liệu <strong>đã bị xoá đúng hạn</strong>.
    Nhiều luật (GDPR, Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân ở Việt Nam…) yêu cầu tối thiểu hoá, giới hạn thời gian lưu và xoá khi được yêu cầu.</p>

    <p><strong>1. Tối thiểu hoá (data minimization)</strong></p>
    <ul>
      <li><strong>Không thu thập</strong> thứ không dùng. "Để sau này có thể cần" là lý do tệ nhất.</li>
      <li><strong>Lưu dạng suy ra</strong>: cần kiểm tra đủ 18 tuổi → lưu cờ <code>is_adult</code> hoặc năm sinh, không cần ngày sinh đầy đủ. Thống kê theo thành phố → không cần địa chỉ nhà.</li>
      <li><strong>Pseudonymize cho phân tích</strong>: kho ClickHouse/Kafka dùng <code>user_key = HMAC(khoá, user_id)</code> thay cho email/số điện thoại. Không dùng SHA-256 thuần của email — dễ đoán ngược bằng danh sách email.</li>
      <li><strong>Không để PII trôi vào nơi không kiểm soát</strong>: log ứng dụng, query log, message lỗi, cache, công cụ phân tích bên thứ ba.</li>
    </ul>

    <p><strong>2. Masking — hiển thị ít nhất có thể</strong></p>
    <ul>
      <li>Masking hiển thị: nhân viên hỗ trợ thấy <code>****-****-1234</code>, <code>n***@gmail.com</code>.</li>
      <li>Masking theo quyền ở DB: Postgres view chỉ trả cột đã che + <code>GRANT SELECT</code> trên view chứ không trên bảng gốc (hoặc grant theo cột, bài 07); ClickHouse tương tự bằng view/grant cột;
        Mongo dùng view với <code>$project</code>. Extension <em>PostgreSQL Anonymizer</em> hỗ trợ khai báo luật masking động theo role.</li>
      <li>Masking khi sao dữ liệu ra môi trường khác: bài 23.</li>
    </ul>

    <p><strong>3. Retention/TTL — để dữ liệu tự hết hạn</strong></p>
    <table>
      <tr><th>Engine</th><th>Cơ chế</th><th>Lưu ý</th></tr>
      <tr><td>Redis</td><td><code>SET k v EX 900</code>, <code>EXPIRE</code></td><td>Mọi key session/OTP/cache phải có TTL; kiểm tra key không TTL bằng <code>TTL k</code> = -1</td></tr>
      <tr><td>ClickHouse</td><td><code>TTL</code> cấp bảng (xoá dòng) và cấp cột (xoá giá trị cột)</td><td>TTL được áp khi merge; muốn áp ngay dùng <code>ALTER TABLE ... MATERIALIZE TTL</code></td></tr>
      <tr><td>Kafka</td><td><code>retention.ms</code> / <code>retention.bytes</code> theo topic</td><td>Topic <code>compact</code> giữ giá trị mới nhất <em>mãi mãi</em> → xoá bằng tombstone (value null); xoá chỉ xảy ra khi segment đóng</td></tr>
      <tr><td>MongoDB</td><td>TTL index: <code>expireAfterSeconds</code></td><td>Tiến trình nền chạy khoảng mỗi 60 giây; field phải là kiểu Date</td></tr>
      <tr><td>PostgreSQL</td><td>Không có TTL gốc → partition theo thời gian + <code>DROP</code> partition cũ (pg_partman), hoặc job xoá theo lô (pg_cron)</td><td>DROP partition nhanh và không để lại bloat như DELETE hàng loạt</td></tr>
      <tr><td>Cloudflare</td><td>KV <code>expirationTtl</code>; R2 lifecycle rule theo prefix; D1: Cron Trigger xoá theo lô; Durable Objects: <code>setAlarm()</code> dọn dữ liệu</td><td>KV TTL tối thiểu 60 giây</td></tr>
    </table>

    <p><strong>4. Xoá thật sự — khó hơn bạn nghĩ</strong></p>
    <p>Khi người dùng yêu cầu xoá tài khoản, dữ liệu của họ nằm ở: bảng chính, bảng log/audit, replica, cache Redis, topic Kafka, kho ClickHouse, file export, backup của 35 ngày qua…
    Cần một <strong>bản đồ dữ liệu</strong> (data inventory) để biết PII nằm đâu, và một quy trình xoá chạm tới từng nơi. Với backup, thường chấp nhận "hết hạn theo retention của backup" và ghi rõ trong chính sách.</p>

    <p><strong>5. Crypto-shredding — xoá bằng cách huỷ khoá</strong></p>
    <p>Mỗi người dùng (hoặc tenant) có một DEK riêng (bài 14); mọi PII của họ ở mọi nơi — DB, Kafka, ClickHouse, backup — được mã hoá bằng DEK đó.
    Khi cần xoá: <strong>huỷ DEK</strong>. Mọi bản sao lập tức trở thành byte vô nghĩa, kể cả những bản trong backup bất biến hay topic Kafka không sửa được.
    Điều kiện: DEK phải thật sự bị huỷ ở mọi nơi (kể cả bản sao lưu của key store), và PII không được tồn tại dạng rõ ở chỗ nào khác.</p>

    <div class="callout"><p>💡 Mỗi bảng/collection/topic/bucket mới nên có 3 dòng mô tả trong review: <em>có PII không? giữ bao lâu? xoá bằng cơ chế gì?</em>
    Không trả lời được → chưa nên tạo.</p></div>
  `,

  codeTabs: [
    { id: "min", label: "✂️ Tối thiểu hoá", lines: [
      "// ❌ Lưu thừa",
      "users: { full_name, email, phone, birth_date, home_address, national_id, ip_history[] }",
      "",
      "// ✅ Chỉ lưu thứ cần, dạng suy ra khi có thể",
      "users: { display_name, email, is_adult, city }",
      "",
      "// ✅ Kho phân tích dùng khoá giả danh (pseudonymous), không phải PII",
      "user_key = hmac_sha256(ANALYTICS_KEY, user_id)          // không dùng sha256(email)",
      "clickhouse.insert('events', { user_key, event_type, city, ts })",
      "",
      "// ✅ Không để PII vào log",
      "log.info('password reset requested', { user_id })     // không log email/phone"
    ]},
    { id: "mask", label: "🎭 Masking", lines: [
      "-- Postgres: support chỉ đọc view đã che",
      "CREATE VIEW support.customers_masked AS",
      "SELECT id,",
      "       left(full_name, 1) || '***'                         AS name,",
      "       regexp_replace(email, '^(.).*(@.*)$', '\\1***\\2')     AS email,",
      "       '****' || right(phone, 3)                          AS phone",
      "  FROM public.customers;",
      "REVOKE ALL ON public.customers FROM support_ro;",
      "GRANT SELECT ON support.customers_masked TO support_ro;",
      "",
      "// Mongo: view chỉ chứa field cho phép",
      "db.createView('customers_support', 'customers', [",
      "  { $project: { _id: 1, city: 1, plan: 1, emailDomain: { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] } } }",
      "])"
    ]},
    { id: "ttl", label: "⏳ TTL từng engine", lines: [
      "# Redis: OTP sống 5 phút",
      "SET otp:t:12:u:777 <hash> EX 300",
      "",
      "-- ClickHouse: xoá dòng sau 90 ngày, xoá cột IP sau 7 ngày",
      "CREATE TABLE analytics.events (event_date Date, user_key String, ip String TTL event_date + INTERVAL 7 DAY,",
      "  event_type LowCardinality(String)) ENGINE = MergeTree ORDER BY (event_date, user_key)",
      "  TTL event_date + INTERVAL 90 DAY DELETE;",
      "",
      "# Kafka: topic clickstream giữ 7 ngày",
      "kafka-configs.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties \\",
      "  --alter --entity-type topics --entity-name clickstream --add-config retention.ms=604800000",
      "",
      "// Mongo: session tự xoá sau 1 giờ kể từ createdAt",
      "db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })",
      "",
      "-- Postgres: partition theo tháng, bỏ partition cũ",
      "ALTER TABLE audit_events DETACH PARTITION audit_events_2026_03;",
      "DROP TABLE audit_events_2026_03;"
    ]},
    { id: "cf", label: "☁️ Cloudflare TTL", lines: [
      "// KV: tự hết hạn (tối thiểu 60 giây)",
      "await env.SESSIONS.put('s:' + sid, JSON.stringify(sess), { expirationTtl: 3600 })",
      "",
      "# R2: lifecycle rule xoá file export tạm sau 7 ngày (theo prefix)",
      "wrangler r2 bucket lifecycle add exports expire-tmp tmp/ --expire-days 7",
      "",
      "# D1: Cron Trigger dọn dữ liệu cũ theo lô",
      "[triggers]",
      "crons = [\"15 3 * * *\"]",
      "",
      "export default { async scheduled(evt, env) {",
      "  await env.DB.prepare(\"DELETE FROM login_events WHERE id IN (SELECT id FROM login_events WHERE ts < unixepoch('now', '-30 days') LIMIT 5000)\").run()",
      "} }",
      "// xoá theo lô qua subquery: tránh một câu DELETE quá lớn chạy quá giới hạn thời gian"
    ]},
    { id: "shred", label: "🔥 Crypto-shredding", lines: [
      "// Mỗi user một DEK; mọi PII ở mọi nơi mã hoá bằng DEK đó",
      "dek_id = keystore.create_dek(user_id)",
      "pg.write(user_id, encrypt(dek_id, profile))",
      "kafka.produce('profile-changes', encrypt(dek_id, change))",
      "clickhouse.insert(..., encrypt(dek_id, address))",
      "",
      "// Yêu cầu xoá tài khoản",
      "function forget(user_id):",
      "    keystore.destroy_dek(user_id)     // huỷ khoá (kể cả bản sao lưu của key store)",
      "    pg.delete_rows(user_id)            // xoá chỗ xoá được",
      "    redis.del('t:*:u:' + user_id)      // (thực tế: dùng SCAN theo pattern, không KEYS)",
      "    // Kafka, ClickHouse, backup: còn byte nhưng không ai giải mã được nữa"
    ]}
  ],

  stageHtml: `
    <div class="node" id="collect"><div class="nl">📝 Thu thập</div><div class="ns">chỉ thứ cần · dạng suy ra</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="store"><div class="nl">🗄️ Lưu</div><div class="ns">mã hoá field · DEK theo user</div></div>
      <div class="node" id="maskn"><div class="nl">🎭 Dùng</div><div class="ns">masking · view · grant cột</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="ttln"><div class="nl">⏳ Hết hạn</div><div class="ns">TTL · retention · lifecycle</div></div>
      <div class="node" id="forget"><div class="nl">🔥 Xoá theo yêu cầu</div><div class="ns">bản đồ dữ liệu · crypto-shredding</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Không lưu là an toàn nhất", tab: "min", highlight: [2, 5, 8, 9, 12], on: ["collect"],
      desc: "Lưu dạng suy ra (is_adult, city), dùng khoá giả danh HMAC cho phân tích, không đưa PII vào log." },
    { title: "2 · Masking theo quyền", tab: "mask", highlight: [2, 4, 5, 6, 8, 9, 12, 13], on: ["maskn"],
      desc: "Nhóm hỗ trợ đọc view đã che, không có quyền trên bảng gốc. Mongo dùng view với <code>$project</code> chỉ giữ field cho phép." },
    { title: "3 · TTL ngay từ lúc thiết kế", tab: "ttl", highlight: [2, 5, 7, 11, 14], on: ["ttln"],
      desc: "Redis EX, ClickHouse TTL bảng & cột, Kafka retention.ms, Mongo TTL index — mỗi nơi chứa dữ liệu tạm đều có hạn." },
    { title: "4 · Postgres: partition + DROP", tab: "ttl", highlight: [17, 18], on: ["ttln"],
      desc: "Không có TTL gốc; partition theo thời gian rồi DETACH/DROP partition cũ — nhanh, không để lại bloat." },
    { title: "5 · Cloudflare: KV TTL, R2 lifecycle, cron", tab: "cf", highlight: [2, 5, 9, 12], on: ["ttln"],
      desc: "KV <code>expirationTtl</code>, lifecycle rule cho R2 theo prefix, Cron Trigger xoá theo lô trong D1." },
    { title: "6 · Crypto-shredding", tab: "shred", highlight: [2, 3, 4, 5, 9, 12], on: ["store", "forget"],
      desc: "PII ở mọi nơi mã hoá bằng DEK của người đó. Huỷ DEK = mọi bản sao (Kafka, ClickHouse, backup) không còn đọc được." }
  ],

  quiz: [
    { q: "Cách tốt nhất để giảm rủi ro lộ PII là gì?", options: [
        "Mã hoá mọi thứ",
        "Đổi tên cột cho khó đoán",
        "Chỉ lưu trong Redis",
        "Không thu thập/lưu PII không cần thiết, và xoá đúng hạn thứ đã lưu"
      ], correct: 3,
      explanation: "Dữ liệu không tồn tại thì không thể bị lộ." },
    { q: "Vì sao không dùng sha256(email) làm khoá giả danh trong kho phân tích?", options: [
        "Vì sha256 chậm",
        "Vì dễ đoán ngược bằng cách băm danh sách email có sẵn; nên dùng HMAC với khoá bí mật",
        "Vì ClickHouse không hỗ trợ",
        "Vì kết quả quá dài"
      ], correct: 1,
      explanation: "Không có khoá bí mật thì hash của dữ liệu dễ đoán vẫn là dữ liệu dễ đoán." },
    { q: "Cơ chế nào tự xoá document Mongo sau một khoảng thời gian?", options: [
        "TTL index với expireAfterSeconds trên field kiểu Date",
        "Capped collection",
        "db.dropDatabase()",
        "mongodump"
      ], correct: 0,
      explanation: "Tiến trình nền xoá document hết hạn định kỳ (khoảng 60 giây)." },
    { q: "Kafka topic dùng cleanup.policy=compact. Điều nào đúng về retention?", options: [
        "Dữ liệu tự xoá sau 7 ngày",
        "Compact topic không lưu gì",
        "Giá trị mới nhất của mỗi key được giữ vô thời hạn; muốn xoá phải gửi tombstone (value null)",
        "Compact topic mã hoá dữ liệu"
      ], correct: 2,
      explanation: "Compacted topic hay chứa profile/PII — cần quy trình tombstone khi xoá." },
    { q: "PostgreSQL không có TTL gốc. Cách xoá dữ liệu cũ hiệu quả cho bảng lớn?", options: [
        "DELETE toàn bộ mỗi ngày trong một transaction lớn",
        "Partition theo thời gian và DETACH/DROP partition cũ (pg_partman), hoặc job xoá theo lô",
        "VACUUM FULL",
        "TRUNCATE mỗi tuần"
      ], correct: 1,
      explanation: "DROP partition gần như tức thì và không để lại bloat." },
    { q: "ClickHouse 'ip String TTL event_date + INTERVAL 7 DAY' có tác dụng gì?", options: [
        "Xoá cả dòng sau 7 ngày",
        "Không có tác dụng",
        "Mã hoá cột ip",
        "Sau 7 ngày giá trị cột ip được thay bằng giá trị mặc định (xoá dữ liệu cột), dòng vẫn giữ"
      ], correct: 3,
      explanation: "TTL cấp cột giúp giữ số liệu thống kê nhưng bỏ PII sớm hơn." },
    { q: "Crypto-shredding là gì?", options: [
        "Mã hoá backup bằng khoá chung",
        "Xoá ổ đĩa vật lý",
        "Mã hoá dữ liệu của mỗi người bằng khoá riêng; khi cần xoá thì huỷ khoá, mọi bản sao trở nên không đọc được",
        "Nén dữ liệu rồi xoá"
      ], correct: 2,
      explanation: "Hữu ích cho nơi không sửa/xoá từng bản ghi được: Kafka, backup bất biến, kho phân tích." },
    { q: "Nhân viên hỗ trợ cần xem thông tin khách hàng. Thiết kế nào tốt?", options: [
        "Cấp SELECT trên view đã che (masked) và không có quyền trên bảng gốc",
        "Cấp SELECT trên bảng gốc",
        "Gửi họ file CSV hằng ngày",
        "Dùng chung tài khoản app"
      ], correct: 0,
      explanation: "Masking theo quyền ở DB đảm bảo dữ liệu đầy đủ không rời khỏi DB tới người không cần." },
    { q: "Khi người dùng yêu cầu xoá tài khoản, điều kiện tiên quyết để xoá đầy đủ là gì?", options: [
        "Chỉ cần DELETE ở bảng users",
        "Đổi email của họ thành rỗng",
        "Tắt DB",
        "Có bản đồ dữ liệu biết PII của họ nằm ở đâu (DB, cache, Kafka, kho phân tích, export, backup) và quy trình cho từng nơi"
      ], correct: 3,
      explanation: "PII thường nằm ở nhiều nơi hơn bảng chính." }
  ]
});
