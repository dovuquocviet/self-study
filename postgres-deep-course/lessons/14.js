window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Đồng thời: isolation & lock",
  title: "Lock: bảng, row, deadlock & advisory lock",
  subtitle: "8 mức khoá bảng · FOR UPDATE / NO KEY UPDATE / SHARE / KEY SHARE · hàng đợi khoá · pg_advisory_xact_lock",

  theory: `
    <p>MVCC giúp đọc và ghi không chặn nhau, nhưng <strong>ghi–ghi</strong> trên cùng row và <strong>DDL</strong> vẫn cần khoá. Hầu hết sự cố "cả hệ thống đứng hình" đều do khoá, không phải do CPU.</p>

    <p><strong>Khoá mức bảng</strong> (tự động lấy theo câu lệnh), từ nhẹ tới nặng:</p>
    <table>
      <tr><th>Khoá</th><th>Ai lấy</th><th>Xung đột với</th></tr>
      <tr><td>ACCESS SHARE</td><td>SELECT</td><td>chỉ ACCESS EXCLUSIVE</td></tr>
      <tr><td>ROW SHARE</td><td>SELECT ... FOR UPDATE/SHARE</td><td>EXCLUSIVE, ACCESS EXCLUSIVE</td></tr>
      <tr><td>ROW EXCLUSIVE</td><td>INSERT, UPDATE, DELETE</td><td>SHARE trở lên</td></tr>
      <tr><td>SHARE UPDATE EXCLUSIVE</td><td>VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY, một số ALTER</td><td>chính nó và các khoá nặng hơn</td></tr>
      <tr><td>SHARE</td><td>CREATE INDEX (thường)</td><td>ROW EXCLUSIVE → chặn mọi ghi</td></tr>
      <tr><td>SHARE ROW EXCLUSIVE, EXCLUSIVE</td><td>CREATE TRIGGER, REFRESH MATERIALIZED VIEW CONCURRENTLY…</td><td></td></tr>
      <tr><td><strong>ACCESS EXCLUSIVE</strong></td><td>Hầu hết ALTER TABLE, DROP, TRUNCATE, VACUUM FULL</td><td><strong>mọi thứ, kể cả SELECT</strong></td></tr>
    </table>

    <p><strong>Hàng đợi khoá — cái bẫy của migration</strong>: <code>ALTER TABLE orders ADD COLUMN ...</code> chỉ mất 1 ms, nhưng phải chờ một SELECT dài 5 phút đang giữ ACCESS SHARE. Trong lúc nó chờ, <em>mọi</em> SELECT mới tới cũng phải xếp hàng sau nó (vì xung đột với ACCESS EXCLUSIVE đang đợi). Kết quả: bảng "chết" 5 phút. Luôn đặt <code>SET lock_timeout = '3s'</code> cho DDL và retry (bài 21).</p>

    <p><strong>Khoá mức row</strong> — lưu ngay trong tuple (xmax + infomask), không tốn bộ nhớ theo số row:</p>
    <table>
      <tr><th>Mode</th><th>Lấy bởi</th><th>Ghi chú</th></tr>
      <tr><td>FOR UPDATE</td><td>DELETE, UPDATE đổi cột khoá (PK/unique dùng cho FK), <code>SELECT ... FOR UPDATE</code></td><td>Mạnh nhất</td></tr>
      <tr><td>FOR NO KEY UPDATE</td><td>UPDATE không đổi cột khoá</td><td>Không chặn FK check</td></tr>
      <tr><td>FOR SHARE</td><td><code>SELECT ... FOR SHARE</code></td><td>Nhiều người cùng giữ</td></tr>
      <tr><td>FOR KEY SHARE</td><td>Kiểm tra foreign key khi INSERT row con</td><td>Chỉ chặn xoá/đổi khoá của row cha</td></tr>
    </table>
    <p>Thêm tuỳ chọn: <code>NOWAIT</code> (lỗi ngay nếu bận), <code>SKIP LOCKED</code> (bỏ qua row bận — bài 15).</p>

    <p><strong>Deadlock</strong>: T1 khoá A chờ B, T2 khoá B chờ A. Sau <code>deadlock_timeout</code> (1s), PostgreSQL kiểm tra đồ thị chờ và huỷ một bên với <code>40P01</code>. Phòng tránh: <strong>luôn khoá theo cùng một thứ tự</strong> (vd sắp id tăng dần trước khi update nhiều row), transaction ngắn.</p>

    <p><strong>Advisory lock</strong>: khoá theo một số <code>bigint</code> do app tự định nghĩa, DB không gắn với row nào — thay cho distributed lock (Redis SETNX) khi các instance đã dùng chung DB: "chỉ một pod chạy cron job X", "tuần tự hoá xử lý theo customer_id". Có hai loại: <em>session-level</em> (<code>pg_advisory_lock</code>, giữ tới khi unlock/ngắt kết nối) và <em>transaction-level</em> (<code>pg_advisory_xact_lock</code>, tự nhả khi commit/rollback).</p>

    <div class="callout"><p>💡 Sau pooler chế độ transaction (PgBouncer, Hyperdrive — bài 18), <strong>chỉ dùng bản xact</strong>: session-level lock bám vào connection server, connection đó sẽ bị người khác dùng tiếp và lock không bao giờ được nhả đúng chỗ.</p></div>
  `,

  codeTabs: [
    { id: "queue", label: "① Hàng đợi khoá", lines: [
      "# Session A: báo cáo dài",
      "BEGIN; SELECT sum(total) FROM orders;      -- giữ ACCESS SHARE 5 phút",
      "",
      "# Session B: migration",
      "ALTER TABLE orders ADD COLUMN note text;   -- cần ACCESS EXCLUSIVE → CHỜ A",
      "",
      "# Session C, D, E...: API bình thường",
      "SELECT * FROM orders WHERE id = 42;        -- CHỜ sau B → API timeout hàng loạt",
      "",
      "# ✅ migration an toàn",
      "SET lock_timeout = '3s';",
      "ALTER TABLE orders ADD COLUMN note text;   -- lỗi sau 3s thay vì làm tắc bảng; retry sau"
    ]},
    { id: "who", label: "② Ai chặn ai", lines: [
      "SELECT a.pid, pg_blocking_pids(a.pid) AS blocked_by,",
      "       a.wait_event_type, now() - a.query_start AS waiting, left(a.query, 60)",
      "FROM pg_stat_activity a",
      "WHERE cardinality(pg_blocking_pids(a.pid)) > 0;",
      "",
      "--  pid  | blocked_by | wait_event_type | waiting  | query",
      "-- 3301  | {3120}     | Lock            | 00:02:11 | ALTER TABLE orders ADD COLUMN...",
      "-- 3305  | {3301}     | Lock            | 00:02:05 | SELECT * FROM orders WHERE id...",
      "",
      "SELECT pg_cancel_backend(3120);     -- huỷ câu lệnh; pg_terminate_backend: ngắt hẳn"
    ]},
    { id: "dead", label: "③ Deadlock", lines: [
      "# T1                                     # T2",
      "UPDATE account SET ... WHERE id = 1;",
      "                                         UPDATE account SET ... WHERE id = 2;",
      "UPDATE account SET ... WHERE id = 2;  -- chờ T2",
      "                                         UPDATE account SET ... WHERE id = 1;  -- chờ T1",
      "ERROR:  deadlock detected",
      "DETAIL: Process 3120 waits for ShareLock on transaction 9012; blocked by process 3188.",
      "",
      "// ✅ Rust: khoá theo thứ tự cố định",
      "let (a, b) = if from < to { (from, to) } else { (to, from) };",
      "sqlx::query(\"SELECT id FROM account WHERE id IN ($1, $2) ORDER BY id FOR UPDATE\")",
      "    .bind(a).bind(b).fetch_all(&mut *tx).await?;"
    ]},
    { id: "adv", label: "④ Advisory lock", lines: [
      "// Chỉ 1 pod chạy job đối soát mỗi lần — an toàn sau PgBouncer/Hyperdrive",
      "const RECONCILE_JOB: i64 = 0x5245_434F_4E43;   // hằng số tự chọn",
      "",
      "let mut tx = pool.begin().await?;",
      "let got: bool = sqlx::query_scalar(\"SELECT pg_try_advisory_xact_lock($1)\")",
      "    .bind(RECONCILE_JOB)",
      "    .fetch_one(&mut *tx).await?;",
      "if !got { return Ok(()); }          // pod khác đang chạy",
      "run_reconcile(&mut tx).await?;",
      "tx.commit().await?;                 // lock tự nhả tại đây"
    ]}
  ],

  stageHtml: `
    <div class="node" id="a"><div class="nl">🅰️ SELECT dài</div><div class="ns">giữ ACCESS SHARE</div></div>
    <div class="arrow" id="a1">↓ xung đột</div>
    <div class="node" id="b"><div class="nl">🅱️ ALTER TABLE</div><div class="ns">xin ACCESS EXCLUSIVE — đang chờ</div></div>
    <div class="arrow" id="a2">↓ mọi người đến sau xếp hàng</div>
    <div class="node" id="c"><div class="nl">🚦 SELECT/UPDATE của API</div><div class="ns">bị chặn sau B</div></div>
    <div class="row">
      <div class="node" id="dl"><div class="nl">🔄 Deadlock</div><div class="ns">phát hiện sau deadlock_timeout → 40P01</div></div>
      <div class="node" id="adv"><div class="nl">🔐 Advisory lock</div><div class="ns">khoá theo số, do app định nghĩa</div></div>
    </div>
  `,
  steps: [
    { title: "1 · SELECT dài giữ khoá nhẹ", tab: "queue", highlight: [2], on: ["a"],
      desc: "ACCESS SHARE chỉ xung đột với ACCESS EXCLUSIVE — bình thường chẳng ai để ý." },
    { title: "2 · DDL xếp hàng", tab: "queue", highlight: [5], on: ["a1", "b"],
      desc: "ALTER TABLE cần ACCESS EXCLUSIVE nên phải chờ A." },
    { title: "3 · Mọi người phía sau bị kẹt", tab: "queue", highlight: [8], on: ["a2", "c"],
      desc: "Khoá được cấp theo hàng đợi: SELECT mới xung đột với yêu cầu đang chờ của B nên phải đợi sau B. Đây là cách một ALTER '1 ms' làm sập API." },
    { title: "4 · Tìm kẻ chặn, đặt lock_timeout", tab: "who", highlight: [1, 4, 7, 8, 10], on: ["a", "b", "c"],
      desc: "<code>pg_blocking_pids()</code> lần ra chuỗi chặn. Phòng từ trước bằng <code>lock_timeout</code> cho mọi DDL." },
    { title: "5 · Deadlock và thứ tự khoá", tab: "dead", highlight: [4, 5, 6, 10, 11], on: ["dl"],
      desc: "Khoá các row theo thứ tự id tăng dần ở mọi code path → không thể có chu trình chờ." },
    { title: "6 · Advisory lock thay distributed lock", tab: "adv", highlight: [5, 8, 10], on: ["adv"],
      desc: "<code>pg_try_advisory_xact_lock</code> trả true/false ngay, tự nhả khi transaction kết thúc — hợp với pooler transaction mode." }
  ],

  quiz: [
    { q: "Khoá nào chặn cả SELECT thường?", options: [
        "ROW EXCLUSIVE", "SHARE UPDATE EXCLUSIVE", "ACCESS EXCLUSIVE", "ACCESS SHARE"
      ], correct: 2, explanation: "Hầu hết ALTER TABLE, DROP, TRUNCATE, VACUUM FULL lấy khoá này." },
    { q: "ALTER TABLE đang chờ một SELECT dài. Các SELECT mới tới thì sao?", options: [
        "Chạy bình thường",
        "Xếp hàng sau ALTER TABLE → bảng bị tắc cho tới khi SELECT dài xong và ALTER chạy xong",
        "Huỷ ALTER TABLE",
        "Đọc dữ liệu cũ"
      ], correct: 1, explanation: "Dùng lock_timeout để DDL bỏ cuộc sớm thay vì làm tắc bảng." },
    { q: "CREATE INDEX (không CONCURRENTLY) chặn gì?", options: [
        "Không chặn gì",
        "Chặn INSERT/UPDATE/DELETE (khoá SHARE), vẫn cho SELECT",
        "Chặn cả SELECT",
        "Chỉ chặn VACUUM"
      ], correct: 1, explanation: "CREATE INDEX CONCURRENTLY dùng SHARE UPDATE EXCLUSIVE, không chặn ghi." },
    { q: "UPDATE không đổi cột khoá lấy row lock mode nào?", options: [
        "FOR UPDATE", "FOR NO KEY UPDATE", "FOR SHARE", "FOR KEY SHARE"
      ], correct: 1, explanation: "Nhờ đó không chặn các INSERT bảng con đang kiểm tra FK (FOR KEY SHARE)." },
    { q: "Cách phòng deadlock hiệu quả nhất?", options: [
        "Tăng deadlock_timeout",
        "Mọi code path khoá các row/tài nguyên theo cùng một thứ tự và giữ transaction ngắn",
        "Dùng READ UNCOMMITTED",
        "Tắt autovacuum"
      ], correct: 1, explanation: "Không có chu trình thì không có deadlock." },
    { q: "PostgreSQL xử lý deadlock thế nào?", options: [
        "Chờ vô hạn",
        "Sau deadlock_timeout kiểm tra đồ thị chờ, huỷ một transaction với lỗi 40P01",
        "Huỷ cả hai",
        "Restart server"
      ], correct: 1, explanation: "Transaction bị huỷ nên được retry." },
    { q: "Sau PgBouncer transaction mode, nên dùng advisory lock loại nào?", options: [
        "pg_advisory_lock (session-level)",
        "pg_advisory_xact_lock / pg_try_advisory_xact_lock (transaction-level)",
        "Cả hai như nhau",
        "Không dùng được advisory lock"
      ], correct: 1, explanation: "Session-level bám vào connection server vốn được chia sẻ giữa nhiều client." },
    { q: "Hàm nào cho biết một backend đang bị những pid nào chặn?", options: [
        "pg_locks_of()", "pg_blocking_pids(pid)", "pg_cancel_backend(pid)", "pg_stat_statements"
      ], correct: 1, explanation: "pg_cancel_backend huỷ câu lệnh; pg_terminate_backend ngắt kết nối." },
    { q: "SELECT ... FOR UPDATE NOWAIT làm gì khi row đang bị khoá?", options: [
        "Chờ tới khi row rảnh",
        "Báo lỗi ngay lập tức",
        "Bỏ qua row đó",
        "Đọc phiên bản cũ"
      ], correct: 1, explanation: "SKIP LOCKED mới là bỏ qua row bận." },
    { q: "Row lock trong PostgreSQL được lưu ở đâu?", options: [
        "Bảng khoá trong RAM, mỗi row một entry",
        "Ngay trong header tuple (xmax + infomask), nên khoá triệu row không tốn bộ nhớ khoá",
        "Trong WAL",
        "Trong Redis"
      ], correct: 1, explanation: "Vì vậy PostgreSQL không có 'lock escalation' như SQL Server." }
  ]
});
