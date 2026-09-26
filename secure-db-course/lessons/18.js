window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "ClickHouse & kho phân tích",
  subtitle: "User readonly · settings profile & constraints · quotas · HTTP interface · giới hạn truy vấn · SQL-driven access control · dữ liệu phân tích cũng là dữ liệu thật",

  theory: `
    <p>Kho phân tích (ClickHouse, BigQuery, Snowflake, Druid…) thường gom dữ liệu từ <em>mọi</em> hệ thống: đơn hàng, hành vi người dùng, log, thanh toán.
    Vì vậy nó là mục tiêu giá trị nhất — và cũng hay được bảo vệ kém nhất: "chỉ team data dùng", "chỉ để làm dashboard". Bài này tập trung vào ClickHouse; nguyên tắc áp dụng cho mọi kho phân tích.</p>

    <p><strong>1. Bật quản lý quyền bằng SQL và bỏ user default</strong></p>
    <ul>
      <li>ClickHouse có hai cách khai báo user: file XML (<code>users.xml</code>, <code>users.d/*.xml</code>) và SQL (<code>CREATE USER</code>, <code>GRANT</code>…). Cho một user quản trị có
        <code>access_management</code> = 1 để dùng SQL, mọi user khác được tạo và phân quyền bằng SQL (dễ review, dễ tự động hoá).</li>
      <li>User <code>default</code>: đặt mật khẩu, giới hạn về localhost, hoặc không cho đăng nhập qua mạng; ứng dụng và người dùng không dùng nó (bài 05).</li>
    </ul>

    <p><strong>2. Ba công cụ giới hạn: grant, settings profile, quota</strong></p>
    <table>
      <tr><th>Công cụ</th><th>Trả lời câu hỏi</th><th>Ví dụ</th></tr>
      <tr><td><code>GRANT</code> / row policy</td><td>Được <em>đọc/ghi cái gì</em>?</td><td><code>GRANT SELECT ON analytics.* TO bi_ro</code>; row policy theo tenant (bài 08); không cấp <code>SOURCES</code> (bài 09)</td></tr>
      <tr><td>Settings profile + constraints</td><td>Một truy vấn được <em>dùng bao nhiêu</em> tài nguyên, có được tự đổi giới hạn không?</td><td><code>readonly = 1</code>, <code>max_memory_usage</code>, <code>max_execution_time</code>, <code>max_result_rows</code>; ràng buộc <code>CONST</code>/<code>MAX</code></td></tr>
      <tr><td>Quota</td><td>Trong một khoảng thời gian được dùng <em>tổng cộng</em> bao nhiêu?</td><td>tối đa 1.000 truy vấn/giờ, đọc tối đa 10 tỷ dòng/giờ</td></tr>
    </table>

    <p><strong>3. readonly có ba mức</strong></p>
    <ul>
      <li><code>readonly = 0</code>: không giới hạn (ghi, DDL, đổi setting).</li>
      <li><code>readonly = 1</code>: chỉ truy vấn đọc, <em>không được đổi setting</em> — phù hợp tài khoản BI/dashboard.</li>
      <li><code>readonly = 2</code>: chỉ đọc nhưng được đổi setting (trừ chính <code>readonly</code>) — thường cần cho một số client/driver; kết hợp constraints để chặn nới giới hạn.</li>
    </ul>
    <p>Constraints trong profile (<code>CONSTRAINTS max_memory_usage MAX 10000000000</code>, hoặc <code>CONST</code>) đảm bảo người dùng không tự nâng giới hạn tài nguyên của chính mình.</p>

    <p><strong>4. HTTP interface — tiện nhưng rộng</strong></p>
    <ul>
      <li>Cổng 8123 (HTTP) / 8443 (HTTPS) nhận truy vấn qua URL/body. Chỉ bật HTTPS, chỉ nghe mạng nội bộ (bài 03–04).</li>
      <li>Truyền credential bằng header (<code>X-ClickHouse-User</code>/<code>X-ClickHouse-Key</code>) hoặc Basic Auth — <strong>không</strong> đặt <code>password=</code> trong URL (lọt vào log proxy, lịch sử trình duyệt).</li>
      <li>Request GET tự động chạy ở chế độ readonly; nhưng đừng dựa vào đó như lớp bảo vệ duy nhất — quyền phải nằm ở user/profile.</li>
      <li>Không cho trình duyệt người dùng cuối gọi thẳng ClickHouse. Đặt một API ở giữa: API nhận tham số có kiểu, dựng truy vấn với <code>{param:Type}</code> (bài 10), kiểm tra tenant, rồi mới gọi ClickHouse bằng user readonly.</li>
      <li>Nếu cần endpoint HTTP cố định, cân nhắc <em>predefined HTTP handlers</em>: chỉ chạy các truy vấn đã định nghĩa sẵn với tham số.</li>
    </ul>

    <p><strong>5. Giới hạn truy vấn — vì một câu SELECT cũng có thể "đánh sập" cụm</strong></p>
    <p>ClickHouse nhanh vì dùng rất nhiều CPU/RAM cho mỗi truy vấn. Một truy vấn <code>GROUP BY</code> trên cột có hàng tỷ giá trị khác nhau, hoặc một <code>JOIN</code> lớn,
    có thể chiếm toàn bộ bộ nhớ. Các setting nên đặt cho user không phải quản trị:
    <code>max_memory_usage</code>, <code>max_execution_time</code>, <code>max_rows_to_read</code>/<code>max_bytes_to_read</code>, <code>max_result_rows</code> + <code>result_overflow_mode</code>,
    <code>max_concurrent_queries_for_user</code>, và ở server <code>max_server_memory_usage_to_ram_ratio</code>. Chi tiết chống cạn tài nguyên ở bài 22.</p>

    <p><strong>6. Dữ liệu phân tích cũng là dữ liệu thật</strong></p>
    <ul>
      <li>Không đẩy PII dạng rõ vào kho nếu không cần; dùng khoá giả danh (HMAC) và TTL cột (bài 15).</li>
      <li><code>system.query_log</code> lưu <em>nguyên văn</em> câu truy vấn — nếu ai đó ghép giá trị nhạy cảm vào SQL, nó nằm lại trong log. Dùng tham số, và giới hạn quyền đọc bảng <code>system.*</code>.</li>
      <li>Export (<code>INTO OUTFILE</code>, tải CSV từ BI) là bản sao — áp chính sách như backup.</li>
    </ul>

    <div class="callout"><p>💡 Thử nghiệm đơn giản: đăng nhập bằng user của dashboard và thử (1) <code>INSERT</code>, (2) <code>SET max_memory_usage = 0</code>, (3) đọc bảng ngoài phạm vi,
    (4) gọi table function <code>url()</code>. Cả bốn phải bị từ chối.</p></div>
  `,

  codeTabs: [
    { id: "users", label: "👤 User & quyền", lines: [
      "<!-- users.d/admin.xml: một user quản trị dùng SQL-driven access control -->",
      "<clickhouse><users><ch_admin>",
      "    <password_sha256_hex>...</password_sha256_hex>",
      "    <networks><ip>10.0.9.0/24</ip></networks>       <!-- chỉ từ bastion -->",
      "    <access_management>1</access_management>",
      "</ch_admin></users></clickhouse>",
      "",
      "-- Mọi user khác tạo bằng SQL",
      "CREATE ROLE bi_ro;",
      "GRANT SELECT ON analytics.* TO bi_ro;",
      "CREATE USER dashboard IDENTIFIED WITH sha256_password BY '<secret>'",
      "    HOST IP '10.0.2.0/24' DEFAULT ROLE bi_ro;",
      "SHOW GRANTS FOR dashboard;"
    ]},
    { id: "profile", label: "📏 Profile & constraints", lines: [
      "CREATE SETTINGS PROFILE bi_profile SETTINGS",
      "    readonly = 1,",
      "    max_memory_usage = 10000000000,             -- 10 GB / truy vấn",
      "    max_execution_time = 60,                    -- giây",
      "    max_rows_to_read = 5000000000,",
      "    max_result_rows = 1000000, result_overflow_mode = 'throw',",
      "    max_concurrent_queries_for_user = 5",
      "TO bi_ro;",
      "",
      "-- Client cần readonly = 2 (được đổi setting) -> khoá bằng constraints",
      "CREATE SETTINGS PROFILE api_profile SETTINGS",
      "    readonly = 2,",
      "    max_memory_usage = 4000000000 MAX 4000000000,",
      "    max_execution_time = 20 MAX 20",
      "TO api_reader;"
    ]},
    { id: "quota", label: "🧮 Quota", lines: [
      "-- Tổng tài nguyên theo khoảng thời gian, tính riêng cho từng user",
      "CREATE QUOTA bi_quota",
      "    KEYED BY user_name",
      "    FOR INTERVAL 1 hour MAX queries = 1000, read_rows = 10000000000, execution_time = 1800,",
      "    FOR INTERVAL 1 day  MAX queries = 10000, result_rows = 100000000",
      "TO bi_ro;",
      "",
      "-- Theo dõi mức dùng",
      "SELECT * FROM system.quota_usage;",
      "SHOW QUOTA;"
    ]},
    { id: "http", label: "🌐 HTTP interface", lines: [
      "# ❌ Mật khẩu trong URL (lọt vào log proxy, lịch sử)",
      "curl 'http://ch.example.com:8123/?user=dashboard&password=<secret>&query=SELECT...'",
      "",
      "# ✅ HTTPS, credential trong header, truy vấn có tham số",
      "curl --cacert ch-ca.pem 'https://ch.internal:8443/?param_tenant=42&param_from=2026-09-01' \\",
      "  -H 'X-ClickHouse-User: api_reader' -H \"X-ClickHouse-Key: $CH_PASSWORD\" \\",
      "  --data-binary 'SELECT event_type, count() FROM analytics.events WHERE tenant_id = {tenant:UInt32} AND event_date >= {from:Date} GROUP BY event_type'",
      "",
      "// ✅ Trình duyệt không gọi thẳng ClickHouse: API ở giữa",
      "GET /api/stats?from=2026-09-01",
      "  -> tenant lấy từ session, 'from' parse thành Date, giới hạn khoảng tối đa 90 ngày",
      "  -> client.query({ query: STATS_SQL, query_params: { tenant, from } })   // user readonly"
    ]},
    { id: "logs", label: "📜 query_log & export", lines: [
      "-- query_log lưu nguyên văn câu truy vấn -> không ghép giá trị nhạy cảm vào SQL",
      "SELECT event_time, user, query_duration_ms, read_rows, substring(query, 1, 200)",
      "  FROM system.query_log",
      " WHERE type = 'QueryFinish' AND user = 'dashboard' AND event_date = today()",
      " ORDER BY read_rows DESC LIMIT 20;",
      "",
      "-- Hạn chế ai đọc được system.* (có thể chứa truy vấn của người khác)",
      "REVOKE SELECT ON system.query_log FROM bi_ro;",
      "",
      "-- Kho phân tích chỉ nhận khoá giả danh + TTL cột cho dữ liệu nhạy cảm",
      "ALTER TABLE analytics.events MODIFY COLUMN ip String TTL event_date + INTERVAL 7 DAY;"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="bi"><div class="nl">📊 Dashboard / BI</div><div class="ns">user readonly = 1</div></div>
      <div class="node" id="api"><div class="nl">🧩 API nội bộ</div><div class="ns">tham số có kiểu · tenant từ session</div></div>
      <div class="node" id="browser"><div class="nl">🌍 Trình duyệt</div><div class="ns">không gọi thẳng ClickHouse</div></div>
    </div>
    <div class="arrow" id="a1">↓ HTTPS 8443 / native 9440</div>
    <div class="row">
      <div class="node" id="grant"><div class="nl">🛂 GRANT · row policy</div><div class="ns">đọc cái gì</div></div>
      <div class="node" id="prof"><div class="nl">📏 Profile · constraints</div><div class="ns">mỗi truy vấn tối đa bao nhiêu</div></div>
      <div class="node" id="quo"><div class="nl">🧮 Quota</div><div class="ns">tổng mỗi giờ/ngày</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="chn"><div class="nl">🟨 ClickHouse</div><div class="ns">query_log · TTL · không PII rõ</div></div>
  `,
  steps: [
    { title: "1 · Một admin XML, còn lại bằng SQL", tab: "users", highlight: [4, 5, 9, 10, 11, 12], on: ["grant", "chn"],
      desc: "User quản trị giới hạn IP bastion, có <code>access_management</code>. User ứng dụng/BI tạo bằng SQL với role chỉ SELECT." },
    { title: "2 · Settings profile: giới hạn mỗi truy vấn", tab: "profile", highlight: [2, 3, 4, 5, 6, 7], on: ["bi", "prof"],
      desc: "<code>readonly = 1</code> cho BI; giới hạn bộ nhớ, thời gian, số dòng đọc/trả về và số truy vấn đồng thời." },
    { title: "3 · Constraints khi cần readonly = 2", tab: "profile", highlight: [12, 13, 14], on: ["api", "prof"],
      desc: "Một số client cần đổi setting. <code>MAX</code> đảm bảo họ không tự nâng giới hạn tài nguyên." },
    { title: "4 · Quota theo thời gian", tab: "quota", highlight: [2, 3, 4, 5, 9], on: ["quo"],
      desc: "Quota giới hạn tổng số truy vấn, dòng đọc, thời gian chạy mỗi giờ/ngày cho từng user." },
    { title: "5 · HTTP interface đúng cách", tab: "http", highlight: [2, 5, 6, 7, 10, 11, 12], on: ["api", "browser", "a1"],
      desc: "HTTPS, credential trong header, truy vấn có tham số. Trình duyệt gọi API nội bộ; API dùng user readonly và tenant từ session." },
    { title: "6 · query_log và dữ liệu nhạy cảm", tab: "logs", highlight: [2, 3, 4, 8, 11], on: ["chn"],
      desc: "query_log giữ nguyên văn truy vấn: dùng tham số, hạn chế quyền đọc <code>system.*</code>, dùng TTL cột cho dữ liệu nhạy cảm." }
  ],

  quiz: [
    { q: "readonly = 1 trong ClickHouse cho phép gì?", options: [
        "Đọc và ghi",
        "Chỉ đọc nhưng được đổi mọi setting",
        "Chỉ truy vấn đọc, không được đổi setting",
        "Không làm được gì"
      ], correct: 2,
      explanation: "readonly = 2 cho đổi setting (trừ readonly) — cần constraints đi kèm." },
    { q: "Settings profile constraints 'max_memory_usage = 4000000000 MAX 4000000000' dùng để làm gì?", options: [
        "Tăng bộ nhớ",
        "Ngăn user tự đặt max_memory_usage cao hơn giới hạn",
        "Tắt truy vấn",
        "Nén dữ liệu"
      ], correct: 1,
      explanation: "Không có constraints, user được đổi setting có thể tự nới giới hạn." },
    { q: "Quota khác settings profile ở điểm nào?", options: [
        "Không khác",
        "Profile chỉ áp cho HTTP",
        "Quota chỉ dùng cho admin",
        "Profile giới hạn từng truy vấn; quota giới hạn tổng tài nguyên trong một khoảng thời gian"
      ], correct: 3,
      explanation: "Cần cả hai: truy vấn đơn lẻ không quá lớn, và tổng lượng dùng không vượt mức." },
    { q: "Vì sao không đặt password=... trong URL khi gọi HTTP interface?", options: [
        "Vì ClickHouse không đọc được",
        "Vì làm chậm truy vấn",
        "URL lọt vào log proxy/load balancer, lịch sử trình duyệt, công cụ giám sát",
        "Vì URL không hỗ trợ ký tự đặc biệt"
      ], correct: 2,
      explanation: "Dùng header X-ClickHouse-User/Key hoặc Basic Auth qua HTTPS." },
    { q: "Dashboard cho khách hàng nên truy cập ClickHouse thế nào?", options: [
        "Qua API nội bộ: tham số có kiểu, tenant từ session, user readonly có giới hạn",
        "Trình duyệt gọi thẳng ClickHouse bằng user chung",
        "Nhúng mật khẩu ClickHouse vào JavaScript",
        "Mở cổng 8123 ra Internet"
      ], correct: 0,
      explanation: "API là nơi kiểm tra quyền và giới hạn phạm vi truy vấn." },
    { q: "system.query_log có rủi ro gì với dữ liệu nhạy cảm?", options: [
        "Không có rủi ro",
        "Mã hoá truy vấn",
        "Tự xoá dữ liệu",
        "Lưu nguyên văn câu truy vấn — giá trị nhạy cảm ghép vào SQL sẽ nằm lại; ai đọc được bảng này thấy truy vấn của người khác"
      ], correct: 3,
      explanation: "Dùng tham số và hạn chế quyền đọc bảng system.*." },
    { q: "Setting nào giới hạn số truy vấn chạy đồng thời của một user?", options: [
        "max_threads",
        "max_concurrent_queries_for_user",
        "max_result_rows",
        "readonly"
      ], correct: 1,
      explanation: "Kết hợp với max_memory_usage và max_execution_time." },
    { q: "Cách quản lý user ClickHouse dễ review/tự động hoá hơn?", options: [
        "SQL-driven access control (CREATE USER/ROLE/GRANT) với một user quản trị có access_management",
        "Sửa users.xml trực tiếp trên từng máy",
        "Dùng user default cho mọi người",
        "Tạo user qua HTTP GET"
      ], correct: 0,
      explanation: "Quyền khai báo bằng SQL có thể quản lý như migration và rà soát bằng SHOW GRANTS." },
    { q: "Thử nghiệm nào xác nhận user dashboard đã được giới hạn đúng?", options: [
        "Chạy SELECT 1",
        "Đổi mật khẩu",
        "Thử INSERT, tự nâng max_memory_usage, đọc bảng ngoài phạm vi, gọi table function url() — tất cả phải bị từ chối",
        "Khởi động lại server"
      ], correct: 2,
      explanation: "Kiểm thử 'phải bị từ chối' cho từng loại giới hạn." }
  ]
});
