window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Vận hành",
  title: "Giới hạn, settings profile & quota: không để một query hạ cả cluster",
  subtitle: "max_memory_usage · max_execution_time · spill ra đĩa · SETTINGS PROFILE · QUOTA · user/role cho từng service",

  theory: `
    <p>Mặc định ClickHouse cố dùng <em>hết</em> tài nguyên cho mỗi query (bài 01). Một dashboard vô tình <code>GROUP BY user_id</code> trên cả năm có thể ăn hết RAM và làm lỗi các query khác.
    Phòng thủ gồm 3 lớp:</p>

    <p><strong>1. Giới hạn theo query</strong> (setting, đặt trong profile)</p>
    <table>
      <tr><th>Setting</th><th>Ý nghĩa</th></tr>
      <tr><td><code>max_memory_usage</code></td><td>RAM tối đa cho một query; vượt ⇒ lỗi MEMORY_LIMIT_EXCEEDED</td></tr>
      <tr><td><code>max_execution_time</code></td><td>Giây tối đa; vượt ⇒ huỷ (hoặc trả một phần với <code>timeout_overflow_mode = 'break'</code>)</td></tr>
      <tr><td><code>max_rows_to_read</code> / <code>max_bytes_to_read</code></td><td>Chặn query quét quá nhiều</td></tr>
      <tr><td><code>max_result_rows</code></td><td>Chặn trả kết quả khổng lồ về client</td></tr>
      <tr><td><code>max_threads</code></td><td>Số luồng mỗi query — giảm cho user dashboard để nhiều query chạy song song</td></tr>
      <tr><td><code>max_bytes_before_external_group_by</code> / <code>..._sort</code></td><td>Vượt ngưỡng thì GROUP BY/ORDER BY tràn xuống đĩa thay vì lỗi RAM</td></tr>
      <tr><td><code>readonly = 1</code></td><td>User chỉ được đọc, không đổi setting</td></tr>
    </table>

    <p><strong>2. Giới hạn cấp server</strong>: <code>max_server_memory_usage</code> (hoặc tỷ lệ theo RAM), <code>max_concurrent_queries</code>, và <em>workload scheduling</em> ở bản mới để chia CPU/IO giữa các nhóm.</p>

    <p><strong>3. Quota theo khoảng thời gian</strong>: <code>CREATE QUOTA</code> giới hạn tổng số query, lỗi, số hàng đọc, thời gian chạy… trong mỗi khoảng (giờ, ngày) cho user/role, có thể tách theo <code>KEYED BY</code> (vd ip_address, client_key).</p>

    <p><strong>Tổ chức</strong>: mỗi service một user riêng (ingest, API, dashboard, ad-hoc), gán role + settings profile + quota riêng. Ingest không bị readonly nhưng có giới hạn nhỏ cho SELECT;
    dashboard readonly với max_execution_time ngắn. Kết hợp row policy để tenant chỉ thấy dữ liệu của mình (xem thêm khoá bảo mật database).</p>

    <div class="callout"><p>💡 Giống cấu hình Hikari pool + timeout + rate limit trong Spring: không cấu hình thì mọi thứ chạy tốt cho tới ngày có người chạy query "lỡ tay".</p></div>
  `,

  codeTabs: [
    { id: "profile", label: "① Settings profile", lines: [
      "CREATE SETTINGS PROFILE dashboard_profile SETTINGS",
      "    readonly = 1,",
      "    max_memory_usage = 10000000000,              -- 10 GB",
      "    max_execution_time = 30,",
      "    max_rows_to_read = 5000000000,",
      "    max_result_rows = 100000,",
      "    max_threads = 8,",
      "    max_bytes_before_external_group_by = 5000000000,",
      "    final = 1;                                   -- đọc đúng bảng Replacing"
    ]},
    { id: "users", label: "② User & role", lines: [
      "CREATE ROLE dashboard_ro;",
      "GRANT SELECT ON analytics.* TO dashboard_ro;",
      "",
      "CREATE USER grafana IDENTIFIED WITH sha256_password BY '...'",
      "    HOST IP '10.0.0.0/8'",
      "    DEFAULT ROLE dashboard_ro",
      "    SETTINGS PROFILE 'dashboard_profile';",
      "",
      "CREATE USER ingest_svc IDENTIFIED WITH sha256_password BY '...'",
      "    SETTINGS async_insert = 1, wait_for_async_insert = 1;",
      "GRANT INSERT ON analytics.events TO ingest_svc;"
    ]},
    { id: "quota", label: "③ Quota", lines: [
      "CREATE QUOTA adhoc_quota",
      "    FOR INTERVAL 1 hour MAX queries = 500, errors = 50,",
      "                            read_rows = 50000000000,",
      "                            execution_time = 1800",
      "    TO analyst_role;",
      "",
      "SELECT quota_name, queries, max_queries, read_rows, max_read_rows",
      "FROM system.quotas_usage;"
    ]},
    { id: "err", label: "④ Khi chạm giới hạn", lines: [
      "-- Code: 241. DB::Exception: Memory limit (for query) exceeded:",
      "--   would use 10.01 GiB, maximum: 9.31 GiB. (MEMORY_LIMIT_EXCEEDED)",
      "",
      "-- Code: 159. Timeout exceeded: elapsed 30.0 seconds, maximum: 30. (TIMEOUT_EXCEEDED)",
      "",
      "SELECT user, exception_code, count()",
      "FROM system.query_log",
      "WHERE exception_code IN (241, 159) AND event_date = today()",
      "GROUP BY user, exception_code;"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="u1"><div class="nl">📊 grafana</div><div class="ns">readonly, 30s, 10 GB</div></div>
      <div class="node" id="u2"><div class="nl">🦀 ingest_svc</div><div class="ns">chỉ INSERT, async_insert</div></div>
      <div class="node" id="u3"><div class="nl">🧑‍💻 analyst</div><div class="ns">quota theo giờ</div></div>
    </div>
    <div class="arrow" id="a1">↓ profile + quota kiểm tra mỗi query</div>
    <div class="node" id="guard"><div class="nl">🛡️ Giới hạn query</div><div class="ns">RAM · thời gian · số hàng · spill</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="server"><div class="nl">🖥️ Giới hạn server</div><div class="ns">max_server_memory_usage · max_concurrent_queries</div></div>
  `,
  steps: [
    { title: "1 · Settings profile", tab: "profile", highlight: [2, 3, 4, 6, 7], on: ["guard"],
      desc: "Gom giới hạn cho một nhóm user. readonly chặn cả ghi lẫn đổi setting." },
    { title: "2 · Tràn đĩa thay vì lỗi", tab: "profile", highlight: [8], on: ["guard"],
      desc: "GROUP BY lớn ghi tạm ra đĩa khi vượt ngưỡng: chậm hơn nhưng không chết." },
    { title: "3 · User riêng cho từng service", tab: "users", highlight: [4, 5, 6, 7, 9, 10, 11], on: ["u1", "u2", "a1"],
      desc: "Grafana chỉ đọc, giới hạn IP; service ingest chỉ INSERT vào đúng bảng và bật async_insert." },
    { title: "4 · Quota theo giờ", tab: "quota", highlight: [2, 3, 4, 5, 7], on: ["u3"],
      desc: "Giới hạn tổng tài nguyên mỗi giờ cho analyst; theo dõi ở system.quotas_usage." },
    { title: "5 · Theo dõi vi phạm", tab: "err", highlight: [1, 4, 8], on: ["server"],
      desc: "Mã 241/159 trong query_log cho biết ai chạm giới hạn — dữ liệu để chỉnh giới hạn hoặc sửa query." }
  ],

  quiz: [
    { q: "max_memory_usage giới hạn gì?", options: [
        "RAM của cả server", "RAM tối đa cho một query", "Dung lượng đĩa", "Bộ nhớ Keeper"
      ], correct: 1, explanation: "Giới hạn server là max_server_memory_usage." },
    { q: "Muốn GROUP BY lớn không lỗi RAM mà chạy chậm hơn?", options: [
        "Tăng max_threads",
        "Đặt max_bytes_before_external_group_by để tràn xuống đĩa",
        "Dùng FINAL",
        "Tắt nén"
      ], correct: 1, explanation: "Tương tự max_bytes_before_external_sort cho ORDER BY." },
    { q: "readonly = 1 trong profile nghĩa là?", options: [
        "Bảng chỉ đọc cho mọi user",
        "User chỉ được đọc và không được đổi setting",
        "Tắt insert trên server",
        "Chỉ đọc từ replica"
      ], correct: 1, explanation: "readonly = 2 cho phép đổi setting nhưng vẫn không ghi." },
    { q: "Quota khác settings profile ở điểm nào?", options: [
        "Giống nhau",
        "Quota giới hạn tổng tài nguyên trong một khoảng thời gian; profile giới hạn từng query",
        "Quota chỉ cho INSERT",
        "Profile chỉ cho admin"
      ], correct: 1, explanation: "Ví dụ tối đa 500 query/giờ." },
    { q: "Vì sao nên giảm max_threads cho user dashboard?", options: [
        "Để query sai",
        "Để nhiều query đồng thời chia sẻ CPU thay vì một query chiếm hết",
        "Để tiết kiệm đĩa",
        "Không nên"
      ], correct: 1, explanation: "Mặc định mỗi query dùng mọi core." },
    { q: "Mỗi service một user riêng có lợi gì?", options: [
        "Không lợi gì",
        "Phân quyền tối thiểu, giới hạn riêng, và truy vết trong query_log theo user",
        "Nhanh hơn",
        "Bắt buộc bởi Kafka"
      ], correct: 1, explanation: "Principle of least privilege + quan sát được." },
    { q: "timeout_overflow_mode = 'break' làm gì?", options: [
        "Ném lỗi",
        "Dừng khi hết giờ và trả kết quả một phần",
        "Tăng thời gian",
        "Retry"
      ], correct: 1, explanation: "Mặc định là 'throw'." },
    { q: "Xem mức sử dụng quota ở đâu?", options: [
        "system.quotas_usage", "system.parts", "system.settings", "system.merges"
      ], correct: 0, explanation: "Có số query, số hàng đọc so với giới hạn." },
    { q: "Mã lỗi 241 trong query_log là gì?", options: [
        "TIMEOUT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "TOO_MANY_PARTS", "UNKNOWN_TABLE"
      ], correct: 1, explanation: "159 là TIMEOUT_EXCEEDED, 252 là TOO_MANY_PARTS." }
  ]
});
