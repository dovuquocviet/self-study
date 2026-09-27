window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Vận hành production",
  title: "Monitoring: pg_stat_statements, pg_stat_activity, lock & các view thống kê",
  subtitle: "Query nào tốn nhất · ai đang chạy/chờ gì · ai chặn ai · index thừa · cache hit · log chậm",

  theory: `
    <p>PostgreSQL tự ghi rất nhiều số liệu vào các view <code>pg_stat_*</code>. Một kỹ sư cần thuộc khoảng 6 truy vấn dưới đây — chúng trả lời 90% câu hỏi "DB đang bị làm sao".</p>

    <table>
      <tr><th>Câu hỏi</th><th>Nguồn</th></tr>
      <tr><td>Query nào tốn tài nguyên nhất (tích luỹ)?</td><td><code>pg_stat_statements</code></td></tr>
      <tr><td>Ngay lúc này ai đang chạy, chạy bao lâu, chờ gì?</td><td><code>pg_stat_activity</code> (<code>state</code>, <code>wait_event_type</code>, <code>wait_event</code>)</td></tr>
      <tr><td>Ai chặn ai?</td><td><code>pg_blocking_pids()</code>, <code>pg_locks</code></td></tr>
      <tr><td>Bảng nào seq scan nhiều, nhiều dead tuple, lâu chưa vacuum?</td><td><code>pg_stat_user_tables</code></td></tr>
      <tr><td>Index nào không ai dùng?</td><td><code>pg_stat_user_indexes</code> (<code>idx_scan = 0</code>)</td></tr>
      <tr><td>Cache có đủ? I/O ở đâu?</td><td><code>pg_stat_database</code>, <code>pg_stat_io</code> (PG 16+)</td></tr>
      <tr><td>Replication/WAL/checkpoint</td><td><code>pg_stat_replication</code>, <code>pg_stat_wal</code>, <code>pg_stat_checkpointer</code> (PG 17+)</td></tr>
    </table>

    <p><strong>pg_stat_statements</strong> gom mọi câu lệnh theo <em>hình dạng</em> (hằng số thay bằng <code>$1</code>) và cộng dồn: <code>calls</code>, <code>total_exec_time</code>, <code>mean_exec_time</code>, <code>rows</code>, <code>shared_blks_hit/read</code>, <code>temp_blks_written</code>… Phải nạp qua <code>shared_preload_libraries</code> (cần restart) rồi <code>CREATE EXTENSION</code>. Sắp theo <code>total_exec_time</code> để tìm thứ đáng tối ưu (bài 12).</p>

    <p><strong>Đọc wait_event</strong> trong pg_stat_activity:</p>
    <ul>
      <li><code>state = active</code>, wait_event NULL → đang dùng CPU.</li>
      <li><code>Lock</code> / <code>transactionid</code>, <code>tuple</code>, <code>relation</code> → chờ khoá (bài 14).</li>
      <li><code>LWLock</code> → tranh chấp cấu trúc nội bộ (WAL, buffer mapping…) — thường do quá nhiều connection đang chạy.</li>
      <li><code>IO</code> / <code>DataFileRead</code> → chờ đọc đĩa, dữ liệu không nằm trong cache.</li>
      <li><code>Client</code> / <code>ClientRead</code> → server chờ app gửi lệnh; nếu <code>state = idle in transaction</code> đó là app giữ transaction mà không làm gì.</li>
    </ul>

    <p><strong>Log</strong> bổ trợ cho view thống kê: <code>log_min_duration_statement</code> (ghi query chậm hơn ngưỡng), <code>log_lock_waits</code> (chờ khoá quá deadlock_timeout), <code>log_autovacuum_min_duration</code>, <code>log_temp_files</code>, và extension <code>auto_explain</code> để tự ghi plan của query chậm. Xuất số liệu ra Prometheus bằng <code>postgres_exporter</code> để có lịch sử và alert.</p>

    <div class="callout"><p>💡 Các bộ đếm trong pg_stat_* là <strong>tích luỹ</strong> từ lần reset gần nhất. Muốn biết "5 phút qua" thì lấy hiệu hai lần chụp — đó là việc Prometheus/Grafana làm cho bạn. Và đặt <code>application_name</code> cho mỗi service (bài 18) để biết query đến từ đâu.</p></div>
  `,

  codeTabs: [
    { id: "pss", label: "① pg_stat_statements", lines: [
      "# postgresql.conf (restart)",
      "shared_preload_libraries = 'pg_stat_statements'",
      "",
      "CREATE EXTENSION pg_stat_statements;",
      "SELECT left(query, 70) AS q, calls,",
      "       round(total_exec_time) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms,",
      "       rows, shared_blks_read, temp_blks_written",
      "FROM pg_stat_statements",
      "ORDER BY total_exec_time DESC LIMIT 10;",
      "",
      "-- SELECT pg_stat_statements_reset();   -- bắt đầu đo lại sau khi tối ưu"
    ]},
    { id: "act", label: "② Đang xảy ra gì", lines: [
      "SELECT pid, application_name, state, wait_event_type, wait_event,",
      "       now() - query_start AS running, now() - xact_start AS in_tx,",
      "       left(query, 60) AS q",
      "FROM pg_stat_activity",
      "WHERE backend_type = 'client backend' AND state <> 'idle'",
      "ORDER BY xact_start NULLS LAST;",
      "",
      "-- tóm tắt nhanh: bao nhiêu connection theo trạng thái",
      "SELECT state, wait_event_type, count(*) FROM pg_stat_activity",
      "GROUP BY 1, 2 ORDER BY 3 DESC;"
    ]},
    { id: "tbl", label: "③ Bảng & index", lines: [
      "-- bảng hay bị seq scan (ứng viên thiếu index)",
      "SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup",
      "FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 10;",
      "",
      "-- index không ai dùng từ lần reset thống kê (kiểm cả replica trước khi xoá!)",
      "SELECT indexrelid::regclass AS idx, pg_size_pretty(pg_relation_size(indexrelid)) AS size",
      "FROM pg_stat_user_indexes s JOIN pg_index i USING (indexrelid)",
      "WHERE idx_scan = 0 AND NOT i.indisunique",
      "ORDER BY pg_relation_size(indexrelid) DESC;"
    ]},
    { id: "db", label: "④ Cache & log", lines: [
      "SELECT datname,",
      "       round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS cache_hit_pct,",
      "       xact_commit, xact_rollback, deadlocks, temp_bytes",
      "FROM pg_stat_database WHERE datname = current_database();",
      "",
      "# postgresql.conf",
      "log_min_duration_statement = 500ms",
      "log_lock_waits = on",
      "log_temp_files = 0",
      "log_autovacuum_min_duration = 10s",
      "session_preload_libraries = 'auto_explain'",
      "auto_explain.log_min_duration = 2s"
    ]}
  ],

  stageHtml: `
    <div class="node" id="alert"><div class="nl">🚨 Alert: p99 API tăng</div><div class="ns">Grafana / postgres_exporter</div></div>
    <div class="arrow" id="a1">↓ ngay lúc này</div>
    <div class="node" id="act"><div class="nl">👀 pg_stat_activity</div><div class="ns">active? chờ Lock / IO / LWLock? idle in transaction?</div></div>
    <div class="row">
      <div class="node" id="lock"><div class="nl">🔒 pg_blocking_pids</div><div class="ns">chuỗi chặn</div></div>
      <div class="node" id="pss"><div class="nl">📈 pg_stat_statements</div><div class="ns">query tốn nhất</div></div>
    </div>
    <div class="arrow" id="a2">↓ gốc rễ</div>
    <div class="row">
      <div class="node" id="tbl"><div class="nl">📋 pg_stat_user_tables/indexes</div><div class="ns">seq scan, dead tuple, index thừa</div></div>
      <div class="node" id="log"><div class="nl">📝 Log + auto_explain</div><div class="ns">plan của query chậm</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Ảnh chụp tức thời", tab: "act", highlight: [1, 2, 5, 9, 10], on: ["alert", "a1", "act"],
      desc: "Nhìn phân bố state/wait_event trước: nhiều Lock → khoá; nhiều IO → cache; nhiều LWLock → quá nhiều connection chạy cùng lúc." },
    { title: "2 · Query tốn nhất", tab: "pss", highlight: [2, 5, 6, 9], on: ["pss"],
      desc: "Sắp theo total_exec_time; xem thêm shared_blks_read (đọc đĩa) và temp_blks_written (tràn work_mem)." },
    { title: "3 · Chuỗi chặn", tab: "act", highlight: [4, 5], on: ["lock"],
      desc: "Kết hợp với <code>pg_blocking_pids(pid)</code> (bài 14) để lần ra kẻ giữ khoá đầu chuỗi." },
    { title: "4 · Bảng và index", tab: "tbl", highlight: [2, 3, 8], on: ["a2", "tbl"],
      desc: "Seq scan đọc nhiều → thiếu index; idx_scan = 0 → index thừa (làm chậm ghi, phá HOT). Kiểm cả replica vì thống kê tính riêng từng server." },
    { title: "5 · Cache, log, auto_explain", tab: "db", highlight: [2, 3, 7, 8, 11, 12], on: ["log"],
      desc: "Cache hit của OLTP thường &gt; 99%. Log query chậm và plan của chúng để phân tích sau, kể cả khi sự cố đã qua." }
  ],

  quiz: [
    { q: "pg_stat_statements cần cấu hình gì để hoạt động?", options: [
        "Không cần gì",
        "Thêm vào shared_preload_libraries (restart) rồi CREATE EXTENSION",
        "Chỉ CREATE EXTENSION",
        "Cài PgBouncer"
      ], correct: 1, explanation: "Nó cần shared memory cấp phát lúc khởi động." },
    { q: "Nên sắp pg_stat_statements theo cột nào để tìm query đáng tối ưu nhất?", options: [
        "query (theo tên)", "total_exec_time", "min_exec_time", "queryid"
      ], correct: 1, explanation: "Tổng thời gian = tần suất × độ chậm." },
    { q: "Nhiều backend có wait_event_type = 'Lock' cho thấy?", options: [
        "Thiếu CPU",
        "Đang chờ khoá do transaction khác giữ",
        "Đĩa chậm",
        "Mạng chậm"
      ], correct: 1, explanation: "Dùng pg_blocking_pids để tìm kẻ chặn." },
    { q: "state = 'idle in transaction' kéo dài nói lên điều gì?", options: [
        "Bình thường",
        "App đã mở transaction nhưng không gửi lệnh — giữ khoá, snapshot, cản VACUUM",
        "Query đang chạy",
        "Connection đã đóng"
      ], correct: 1, explanation: "Thường là code gọi mạng trong transaction hoặc quên commit." },
    { q: "Truy vấn nào tìm index không được dùng?", options: [
        "pg_stat_user_indexes WHERE idx_scan = 0",
        "pg_stat_activity WHERE state = 'idle'",
        "pg_locks WHERE granted",
        "pg_stat_replication"
      ], correct: 0, explanation: "Loại trừ index unique (đang giữ ràng buộc) và kiểm tra cả replica." },
    { q: "Các bộ đếm pg_stat_* có đặc điểm gì?", options: [
        "Là giá trị tức thời",
        "Tích luỹ từ lần reset; muốn tốc độ theo thời gian phải lấy hiệu giữa hai lần chụp",
        "Tự reset mỗi phút",
        "Chỉ có trên replica"
      ], correct: 1, explanation: "Prometheus + postgres_exporter làm việc này." },
    { q: "temp_blks_written cao trong pg_stat_statements gợi ý gì?", options: [
        "Thiếu index",
        "Sort/hash tràn ra đĩa vì work_mem không đủ",
        "Replication lag",
        "Deadlock"
      ], correct: 1, explanation: "Xem thêm log_temp_files." },
    { q: "auto_explain dùng để làm gì?", options: [
        "Tự tạo index",
        "Tự ghi plan (EXPLAIN) của các query chạy lâu hơn ngưỡng vào log",
        "Tự VACUUM",
        "Giải thích lỗi"
      ], correct: 1, explanation: "Giúp phân tích query chậm sau khi sự cố đã qua." },
    { q: "wait_event_type = 'LWLock' xuất hiện dày đặc khi nhiều backend active thường gợi ý?", options: [
        "Thiếu index",
        "Tranh chấp cấu trúc nội bộ do quá nhiều connection chạy đồng thời",
        "Deadlock",
        "Sai mật khẩu"
      ], correct: 1, explanation: "Giảm số connection active bằng pooler thường hiệu quả hơn thêm CPU." }
  ]
});
