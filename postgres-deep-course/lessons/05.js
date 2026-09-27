window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "MVCC & VACUUM",
  title: "VACUUM, autovacuum & bloat",
  subtitle: "Ai dọn dead tuple · công thức kích hoạt · vì sao bảng phình · cái gì chặn VACUUM",

  theory: `
    <p>MVCC để lại rác: mỗi UPDATE/DELETE sinh một <strong>dead tuple</strong>. Nếu không dọn, bảng và index phình mãi, query phải lội qua rác. <strong>VACUUM</strong> là người dọn; <strong>autovacuum</strong> là cơ chế tự gọi VACUUM + ANALYZE theo ngưỡng.</p>

    <p><strong>VACUUM (thường) làm gì</strong></p>
    <ol>
      <li>Quét các trang của bảng (bỏ qua trang "all-visible" trong visibility map), gom danh sách TID của tuple chết mà <em>không snapshot nào còn cần</em>.</li>
      <li>Xoá các entry trỏ tới những TID đó trong <strong>từng index</strong>.</li>
      <li>Đánh dấu chỗ của tuple chết là trống, ghi vào <strong>Free Space Map</strong> để INSERT/UPDATE sau dùng lại.</li>
      <li>Cập nhật <strong>visibility map</strong> (bit all-visible/all-frozen), freeze tuple cũ (bài 06), cập nhật <code>pg_class.relpages/reltuples</code>.</li>
      <li>Nếu cuối bảng có trang trống hoàn toàn thì cắt bớt file.</li>
    </ol>
    <p>VACUUM thường <strong>không chặn</strong> đọc/ghi (khoá SHARE UPDATE EXCLUSIVE) và <strong>không trả dung lượng cho OS</strong> (trừ phần đuôi) — nó chỉ tạo chỗ trống để tái dùng. <code>VACUUM FULL</code> ghi lại toàn bộ bảng, trả dung lượng, nhưng giữ khoá ACCESS EXCLUSIVE suốt quá trình: cả SELECT cũng bị chặn. Production thì dùng <code>pg_repack</code> (online).</p>

    <p><strong>Khi nào autovacuum chạy trên một bảng?</strong></p>
    <table>
      <tr><th>Việc</th><th>Kích hoạt khi</th><th>Mặc định</th></tr>
      <tr><td>VACUUM</td><td>dead tuples &gt; threshold + scale_factor × reltuples</td><td>50 + 0.2 × số row</td></tr>
      <tr><td>VACUUM do INSERT (PG 13+)</td><td>row mới chèn &gt; insert_threshold + insert_scale_factor × reltuples</td><td>1000 + 0.2 × số row</td></tr>
      <tr><td>ANALYZE</td><td>row thay đổi &gt; threshold + scale_factor × reltuples</td><td>50 + 0.1 × số row</td></tr>
    </table>
    <p>Bảng 500 triệu row → phải có ~100 triệu dead tuple mới vacuum: quá muộn. Bảng lớn nên đặt scale_factor riêng thấp (vd 0.01) hoặc threshold tuyệt đối. (PG 18 thêm <code>autovacuum_vacuum_max_threshold</code>, mặc định 100 triệu, làm trần.)</p>

    <p><strong>Tốc độ</strong>: autovacuum tự hãm bằng cost-based delay (<code>autovacuum_vacuum_cost_limit</code>, <code>autovacuum_vacuum_cost_delay</code> = 2ms) để không giành I/O. Chỉ có <code>autovacuum_max_workers</code> (mặc định 3) worker cho cả cluster.</p>

    <p><strong>Bloat</strong> = phần dung lượng chứa tuple chết hoặc chỗ trống không dùng tới. Nguyên nhân phổ biến nhất <em>không phải</em> autovacuum lười, mà là thứ gì đó giữ "đường chân trời" <code>xmin</code> của cluster, khiến VACUUM không được phép dọn:</p>
    <ul>
      <li>Transaction dài / <code>idle in transaction</code> (quên commit, gọi HTTP trong transaction).</li>
      <li>Replication slot bị bỏ rơi (logical slot của Debezium ngừng tiêu thụ).</li>
      <li>Standby bật <code>hot_standby_feedback</code> có query chạy lâu.</li>
      <li>Prepared transaction (2PC) bị treo.</li>
    </ul>

    <div class="callout"><p>💡 Queue table kiểu "INSERT rồi DELETE" (bài 15) là bảng sinh rác nhanh nhất — cần autovacuum tích cực và <strong>không</strong> được có transaction dài chạy song song. Cách Java hay làm "@Transactional bao cả vòng batch 30 phút" chính là kẻ thù của VACUUM.</p></div>
  `,

  codeTabs: [
    { id: "check", label: "① Bảng nào nhiều rác", lines: [
      "SELECT relname, n_live_tup, n_dead_tup,",
      "       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,",
      "       last_autovacuum, last_autoanalyze, autovacuum_count",
      "FROM pg_stat_user_tables",
      "ORDER BY n_dead_tup DESC LIMIT 10;",
      "",
      "--  relname   | n_live_tup | n_dead_tup | dead_pct | last_autovacuum",
      "--  job_queue |       1200 |    4820331 |     99.9 | 2026-09-26 03:12",
      "",
      "-- đang chạy: SELECT * FROM pg_stat_progress_vacuum;"
    ]},
    { id: "block", label: "② Ai chặn VACUUM", lines: [
      "-- 1. transaction mở lâu nhất",
      "SELECT pid, state, now() - xact_start AS age, backend_xmin, left(query, 60)",
      "FROM pg_stat_activity",
      "WHERE backend_xmin IS NOT NULL",
      "ORDER BY age(backend_xmin) DESC LIMIT 5;",
      "",
      "-- 2. replication slot giữ xmin",
      "SELECT slot_name, active, xmin, catalog_xmin FROM pg_replication_slots;",
      "",
      "-- 3. prepared transaction treo",
      "SELECT gid, prepared FROM pg_prepared_xacts;",
      "",
      "-- VACUUM VERBOSE báo: 'tuples: 0 removed, ... N are dead but not yet removable'"
    ]},
    { id: "tune", label: "③ Tinh chỉnh", lines: [
      "# postgresql.conf — toàn cục",
      "autovacuum_max_workers = 5",
      "autovacuum_vacuum_cost_limit = 2000        # mặc định -1 → dùng vacuum_cost_limit=200",
      "autovacuum_naptime = 30s                   # mặc định 1min",
      "idle_in_transaction_session_timeout = 60s  # cắt session quên commit",
      "",
      "-- theo bảng lớn",
      "ALTER TABLE events SET (autovacuum_vacuum_scale_factor = 0.01,",
      "                        autovacuum_analyze_scale_factor = 0.02);",
      "",
      "-- bảng queue: dọn liên tục",
      "ALTER TABLE job_queue SET (autovacuum_vacuum_scale_factor = 0,",
      "                           autovacuum_vacuum_threshold = 1000);"
    ]},
    { id: "rust", label: "④ Rust: đừng giữ transaction", lines: [
      "// ❌ giữ transaction qua lời gọi mạng → xmin bị ghim, VACUUM không dọn được",
      "let mut tx = pool.begin().await?;",
      "let order = load_order(&mut tx, id).await?;",
      "let receipt = payment_client.charge(&order).await?;   // 3 giây... hoặc 3 phút",
      "save_receipt(&mut tx, &receipt).await?;",
      "tx.commit().await?;",
      "",
      "// ✅ transaction ngắn, gọi mạng ở ngoài",
      "let order = load_order(&pool, id).await?;",
      "let receipt = payment_client.charge(&order).await?;",
      "save_receipt(&pool, &receipt).await?;   // idempotent theo order_id"
    ]}
  ],

  stageHtml: `
    <div class="node" id="dead"><div class="nl">🧟 Dead tuples tích tụ</div><div class="ns">UPDATE/DELETE → n_dead_tup tăng</div></div>
    <div class="arrow" id="a1">↓ vượt 50 + 0.2 × reltuples</div>
    <div class="node" id="av"><div class="nl">🤖 autovacuum worker</div><div class="ns">SHARE UPDATE EXCLUSIVE — không chặn DML</div></div>
    <div class="arrow" id="a2">↓ chỉ dọn tuple cũ hơn xmin horizon</div>
    <div class="row">
      <div class="node" id="clean"><div class="nl">✅ Index + heap sạch</div><div class="ns">FSM, visibility map cập nhật</div></div>
      <div class="node" id="hold"><div class="nl">⛔ Bị ghim</div><div class="ns">tx dài · slot bỏ rơi · 2PC treo</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Rác tích tụ", tab: "check", highlight: [1, 2, 8], on: ["dead"],
      desc: "<code>job_queue</code> có 1200 row sống nhưng 4,8 triệu row chết: mỗi lần SELECT phải lội qua rác đó." },
    { title: "2 · Ngưỡng kích hoạt", tab: "tune", highlight: [8, 9, 12, 13], on: ["a1", "av"],
      desc: "Mặc định 20% số row. Bảng lớn và bảng queue nên có ngưỡng riêng để dọn sớm, dọn thường xuyên." },
    { title: "3 · VACUUM dọn được gì", tab: "check", highlight: [3, 10], on: ["a2", "clean"],
      desc: "Chỉ tuple chết <strong>trước</strong> xmin horizon (không snapshot nào còn nhìn thấy) mới được dọn. Theo dõi tiến độ bằng <code>pg_stat_progress_vacuum</code>." },
    { title: "4 · Tìm thứ đang ghim horizon", tab: "block", highlight: [2, 4, 5, 8, 11, 13], on: ["hold"],
      desc: "Ba nghi phạm: backend có <code>backend_xmin</code> cũ, replication slot có xmin, prepared transaction. VERBOSE sẽ báo 'dead but not yet removable'." },
    { title: "5 · Sửa từ phía code", tab: "rust", highlight: [2, 4, 9, 10, 11], on: ["hold", "clean"],
      desc: "Transaction ngắn, không gọi mạng bên trong; đặt <code>idle_in_transaction_session_timeout</code> làm lưới an toàn." }
  ],

  quiz: [
    { q: "VACUUM thường (không FULL) có trả dung lượng đĩa cho OS không?", options: [
        "Có, luôn trả hết",
        "Nói chung không — chỉ đánh dấu chỗ trống để tái dùng; có thể cắt các trang trống ở cuối file",
        "Chỉ khi chạy đêm",
        "Chỉ với index"
      ], correct: 1, explanation: "Muốn thu nhỏ file thật cần rewrite: VACUUM FULL (khoá nặng) hoặc pg_repack (online)." },
    { q: "VACUUM FULL giữ khoá gì?", options: [
        "Không khoá",
        "ROW EXCLUSIVE",
        "ACCESS EXCLUSIVE — chặn cả SELECT",
        "SHARE UPDATE EXCLUSIVE"
      ], correct: 2, explanation: "Không chạy trên bảng production đang phục vụ." },
    { q: "Với cấu hình mặc định, bảng 10 triệu row cần khoảng bao nhiêu dead tuple để autovacuum chạy?", options: [
        "50", "1.000", "Khoảng 2.000.050", "10 triệu"
      ], correct: 2, explanation: "50 + 0.2 × 10.000.000." },
    { q: "Nguyên nhân phổ biến khiến VACUUM chạy mà n_dead_tup không giảm?", options: [
        "Thiếu index",
        "Có thứ ghim xmin horizon: transaction dài, replication slot bỏ rơi, prepared transaction",
        "shared_buffers quá nhỏ",
        "Bảng có khoá chính"
      ], correct: 1, explanation: "Tuple chết nhưng vẫn có thể còn được một snapshot cũ nhìn thấy thì không được dọn." },
    { q: "Tham số nào giúp tự cắt session BEGIN rồi bỏ đó?", options: [
        "statement_timeout",
        "idle_in_transaction_session_timeout",
        "lock_timeout",
        "tcp_keepalives_idle"
      ], correct: 1, explanation: "statement_timeout chỉ giới hạn thời gian một câu lệnh đang chạy." },
    { q: "Ngoài dọn rác, VACUUM còn cập nhật cấu trúc nào giúp index-only scan?", options: [
        "WAL", "Visibility map", "pg_hba.conf", "CLOG"
      ], correct: 1, explanation: "Bit all-visible cho phép index-only scan bỏ qua việc đọc heap (bài 08)." },
    { q: "Bảng chỉ INSERT (append-only) có bao giờ được autovacuum không (PG 13+)?", options: [
        "Không bao giờ vì không có dead tuple",
        "Có — có ngưỡng riêng theo số row chèn mới, để freeze và cập nhật visibility map",
        "Chỉ khi chạy VACUUM tay",
        "Chỉ khi bảng có UPDATE"
      ], correct: 1, explanation: "autovacuum_vacuum_insert_threshold/scale_factor ra đời ở PG 13." },
    { q: "Vì sao chỉnh autovacuum_vacuum_scale_factor riêng cho bảng lớn?", options: [
        "Để tắt VACUUM",
        "Vì 20% của bảng rất lớn là quá nhiều rác trước khi dọn",
        "Vì bảng lớn không cần ANALYZE",
        "Để tăng shared_buffers"
      ], correct: 1, explanation: "Đặt 0.01–0.05 hoặc dùng threshold tuyệt đối." },
    { q: "Cách tốt nhất trong code để không cản VACUUM?", options: [
        "Mở một transaction lớn cho cả job batch",
        "Giữ transaction ngắn, không gọi mạng/IO chậm bên trong transaction",
        "Tắt autovacuum",
        "Dùng SERIALIZABLE"
      ], correct: 1, explanation: "Snapshot cũ = horizon bị ghim = rác không dọn được trên toàn cluster." }
  ]
});
