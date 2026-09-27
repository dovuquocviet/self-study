window.LESSONS.push({
  id: "24",
  phase: "7", phaseName: "Tổng kết",
  title: "Tổng kết: hành trình của một request & checklist production",
  subtitle: "Nối mọi cơ chế thành một bức tranh · checklist review schema/query/vận hành · ôn tập",

  theory: `
    <p>Theo chân một request <code>POST /orders</code> từ service Rust qua mọi tầng đã học — mỗi tầng là một bài:</p>
    <ol>
      <li><strong>Pool &amp; pooler</strong> (18): sqlx lấy connection trong pool → qua PgBouncer/Hyperdrive transaction mode → tới một <strong>backend process</strong> (01).</li>
      <li><strong>Transaction &amp; isolation</strong> (13): READ COMMITTED mặc định; cần chặt hơn thì SERIALIZABLE + retry 40001.</li>
      <li><strong>Planner</strong> (10–12): dùng thống kê từ ANALYZE để chọn scan/join; index đúng hình dạng (07–09) quyết định đọc 4 trang hay 400.000 trang.</li>
      <li><strong>Ghi</strong> (02–04): sửa trang trong shared_buffers, sinh WAL; UPDATE tạo phiên bản mới (MVCC), may mắn thì HOT.</li>
      <li><strong>Khoá</strong> (14–15): row lock trong tuple header; khoá theo thứ tự cố định, SKIP LOCKED cho queue, outbox cho sự kiện.</li>
      <li><strong>COMMIT</strong> (02): fsync WAL → trả OK. Trang dữ liệu xuống đĩa sau, ở checkpoint.</li>
      <li><strong>Sau commit</strong>: WAL chảy sang standby và Debezium (19), lên kho archive cho PITR (20); autovacuum dọn phiên bản cũ và freeze (05–06).</li>
    </ol>

    <p><strong>Checklist review schema</strong></p>
    <ul>
      <li>Mọi FK có index phía bảng con? (PostgreSQL <em>không</em> tự tạo — thiếu thì DELETE bảng cha quét cả bảng con.)</li>
      <li>Index nhiều cột đúng thứ tự "bằng trước, khoảng/sort sau"? Có index thừa làm chậm ghi, phá HOT?</li>
      <li>Field nóng nằm trong JSONB? Nên là cột thật (17).</li>
      <li>Bảng tăng vô hạn theo thời gian đã có kế hoạch partition/xoá (16)?</li>
      <li><code>timestamptz</code> thay vì <code>timestamp</code>; <code>bigint</code> cho id bảng có thể lớn (đổi int → bigint sau này là rewrite cả bảng).</li>
    </ul>

    <p><strong>Checklist query/code</strong></p>
    <ul>
      <li>Không N+1, không OFFSET sâu, không bọc cột trong hàm ở WHERE (12).</li>
      <li>Transaction ngắn, không gọi mạng bên trong (05); retry 40001/40P01 khi dùng RR/SERIALIZABLE (13).</li>
      <li>Không dùng trạng thái phiên qua pooler (18).</li>
    </ul>

    <p><strong>Checklist vận hành</strong></p>
    <ul>
      <li>pg_stat_statements bật; alert: <code>age(datfrozenxid)</code>, replication lag, WAL giữ bởi slot, failed archive, connection gần max, transaction dài (06, 19, 20, 22).</li>
      <li>Timeout theo role; <code>lock_timeout</code> cho mọi migration; CONCURRENTLY cho index (21, 23).</li>
      <li>Diễn tập restore PITR định kỳ (20).</li>
    </ul>

    <div class="callout"><p>💡 Từ "code tay to" sang kỹ sư: trước mỗi thay đổi, tự hỏi <em>nó lấy khoá gì, sinh bao nhiêu WAL/dead tuple, planner sẽ chọn plan nào, và làm sao tôi đo được</em>. Nếu trả lời được bốn câu đó, bạn đã nắm PostgreSQL.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "① Request đi qua các tầng", lines: [
      "async fn create_order(pool: &PgPool, cmd: NewOrder) -> anyhow::Result<i64> {",
      "    let mut tx = pool.begin().await?;                  // pool → pooler → backend (bài 01, 18)",
      "    let id: i64 = sqlx::query_scalar(",
      "        \"INSERT INTO orders (customer_id, total, currency) VALUES ($1, $2, 'VND') RETURNING id\")",
      "        .bind(cmd.customer_id).bind(cmd.total)",
      "        .fetch_one(&mut *tx).await?;                   // trang dirty + WAL (bài 02, 03)",
      "    sqlx::query(\"UPDATE customers SET order_count = order_count + 1 WHERE id = $1\")",
      "        .bind(cmd.customer_id).execute(&mut *tx).await?;  // nguyên tử ở RC, HOT nếu được (04, 13)",
      "    sqlx::query(\"INSERT INTO outbox (topic, key, payload) VALUES ('order.created', $1, $2)\")",
      "        .bind(id.to_string()).bind(sqlx::types::Json(&cmd))",
      "        .execute(&mut *tx).await?;                     // outbox → Debezium → Kafka (15, 19)",
      "    tx.commit().await?;                                // fsync WAL, trả OK (02)",
      "    Ok(id)",
      "}"
    ]},
    { id: "schema", label: "② Checklist schema (SQL)", lines: [
      "-- FK chưa có index phía bảng con",
      "SELECT c.conrelid::regclass AS tbl, c.conname",
      "FROM pg_constraint c",
      "WHERE c.contype = 'f' AND NOT EXISTS (",
      "  SELECT 1 FROM pg_index i",
      "  WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);",
      "",
      "-- cột int có nguy cơ tràn (sequence đã dùng > 50%)",
      "SELECT schemaname, sequencename, last_value, max_value FROM pg_sequences",
      "WHERE last_value > max_value / 2;"
    ]},
    { id: "alert", label: "③ Alert tối thiểu", lines: [
      "# Điều kiện                                   Ngưỡng gợi ý",
      "# age(datfrozenxid)                           > 500M cảnh báo, > 1B khẩn",
      "# transaction dài nhất (now() - xact_start)   > 5 phút",
      "# idle in transaction                         > 1 phút",
      "# replication replay_lag                      > 30s",
      "# WAL giữ bởi slot (retained)                 > 20% dung lượng đĩa",
      "# pg_stat_archiver.failed_count               tăng",
      "# connection đang dùng / max_connections      > 80%",
      "# deadlocks (pg_stat_database)                tăng bất thường",
      "# cache hit ratio (OLTP)                      < 99%"
    ]},
    { id: "map", label: "④ Bản đồ khoá học", lines: [
      "# Kiến trúc     01 process · 02 shared buffers & WAL",
      "# MVCC          03 xmin/xmax · 04 HOT · 05 VACUUM · 06 wraparound",
      "# Index         07 B-tree · 08 partial/expr/INCLUDE · 09 GIN/GiST/BRIN",
      "# Planner       10 EXPLAIN · 11 join & stats · 12 tối ưu thực chiến",
      "# Đồng thời     13 isolation · 14 lock · 15 SKIP LOCKED queue",
      "# Dữ liệu       16 partition · 17 JSONB",
      "# Vận hành      18 pooling · 19 replication · 20 PITR · 21 migration",
      "#               22 monitoring · 23 cấu hình"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🦀 Rust service (sqlx)</div><div class="ns">pool.begin()</div></div>
    <div class="arrow" id="a1">↓ PgBouncer / Hyperdrive</div>
    <div class="node" id="be"><div class="nl">⚙️ Backend</div><div class="ns">planner + executor · MVCC · khoá row</div></div>
    <div class="row">
      <div class="node" id="sb"><div class="nl">🧠 shared_buffers</div><div class="ns">trang dirty</div></div>
      <div class="node" id="wal"><div class="nl">📜 WAL</div><div class="ns">fsync khi COMMIT</div></div>
    </div>
    <div class="arrow" id="a2">↓ sau commit</div>
    <div class="row">
      <div class="node" id="rep"><div class="nl">🪞 Standby · Debezium</div><div class="ns">→ Kafka → ClickHouse</div></div>
      <div class="node" id="arc"><div class="nl">📦 Archive</div><div class="ns">PITR</div></div>
      <div class="node" id="av"><div class="nl">🧹 Autovacuum</div><div class="ns">dọn · freeze · analyze</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Lấy connection", tab: "flow", highlight: [2], on: ["app", "a1", "be"],
      desc: "Pool trong app, pooler ở giữa, cuối cùng là một backend process riêng cho transaction này." },
    { title: "2 · Ghi dữ liệu", tab: "flow", highlight: [4, 6, 7, 8], on: ["be", "sb", "wal"],
      desc: "INSERT sinh tuple mới; UPDATE counter nguyên tử ở RC, tạo phiên bản mới — HOT nếu order_count không có index." },
    { title: "3 · Outbox trong cùng transaction", tab: "flow", highlight: [9, 10, 11], on: ["be"],
      desc: "Sự kiện commit cùng đơn hàng; Debezium đọc WAL và đẩy sang Kafka." },
    { title: "4 · COMMIT & phía sau", tab: "flow", highlight: [12], on: ["wal", "a2", "rep", "arc", "av"],
      desc: "fsync WAL rồi trả OK. WAL tới standby, Debezium, kho archive; autovacuum lo phần rác MVCC." },
    { title: "5 · Checklist schema", tab: "schema", highlight: [1, 4, 6, 8, 10], on: ["be"],
      desc: "Hai lỗi thiết kế hay gặp nhất: FK thiếu index phía con, và id int sắp tràn." },
    { title: "6 · Alert tối thiểu", tab: "alert", highlight: [2, 3, 5, 6, 7], on: ["rep", "arc", "av"],
      desc: "Mỗi dòng ứng với một cơ chế đã học: wraparound, horizon, replication, slot, archive." }
  ],

  quiz: [
    { q: "Khi client nhận COMMIT OK, điều gì chắc chắn đã xảy ra (synchronous_commit = on, không có standby đồng bộ)?", options: [
        "Trang dữ liệu đã ghi xuống file bảng",
        "WAL chứa commit đã fsync xuống đĩa local",
        "Standby đã replay",
        "Autovacuum đã chạy"
      ], correct: 1, explanation: "Bài 02." },
    { q: "UPDATE một row trong PostgreSQL tạo ra gì ở tầng lưu trữ?", options: [
        "Ghi đè tại chỗ",
        "Phiên bản tuple mới; bản cũ nhận xmax và trở thành dead tuple sau khi commit",
        "Một bản ghi undo",
        "Không gì cho tới checkpoint"
      ], correct: 1, explanation: "Bài 03 — nguồn gốc của VACUUM." },
    { q: "Điều gì phổ biến nhất khiến VACUUM không dọn được dead tuple?", options: [
        "Thiếu index",
        "Transaction dài / idle in transaction, replication slot bỏ rơi, prepared transaction ghim xmin horizon",
        "shared_buffers nhỏ",
        "Quá nhiều partition"
      ], correct: 1, explanation: "Bài 05." },
    { q: "Chỉ số nào cần alert để phòng transaction ID wraparound?", options: [
        "cache hit ratio", "age(datfrozenxid)", "n_live_tup", "max_connections"
      ], correct: 1, explanation: "Bài 06." },
    { q: "Index (tenant_id, created_at). Query nào dùng hiệu quả nhất?", options: [
        "WHERE created_at > $1",
        "WHERE tenant_id = $1 AND created_at >= $2 ORDER BY created_at",
        "WHERE lower(tenant_name) = $1",
        "ORDER BY created_at LIMIT 10"
      ], correct: 1, explanation: "Bài 07: bằng trước, khoảng/sort sau." },
    { q: "Index-only scan có Heap Fetches cao. Nguyên nhân và cách chữa?", options: [
        "Thiếu RAM; tăng shared_buffers",
        "Trang heap chưa all-visible trong visibility map; VACUUM (autovacuum tích cực hơn)",
        "Index hỏng; REINDEX",
        "Sai collation"
      ], correct: 1, explanation: "Bài 08." },
    { q: "Index phù hợp cho LIKE '%abc%' và cho JSONB @>?", options: [
        "B-tree", "GIN (pg_trgm cho LIKE)", "BRIN", "Hash"
      ], correct: 1, explanation: "Bài 09." },
    { q: "Trong EXPLAIN ANALYZE, rows ước lượng 50, thực tế 500.000 ở node dưới cùng. Hướng điều tra đầu tiên?", options: [
        "Tăng max_connections",
        "Thống kê: ANALYZE, cột tương quan (CREATE STATISTICS), statistics target",
        "Restart server",
        "Tắt autovacuum"
      ], correct: 1, explanation: "Bài 10–11." },
    { q: "Hai request đồng thời đọc số dư, tự tính rồi ghi lại giá trị mới ở READ COMMITTED. Hậu quả và cách sửa gọn nhất?", options: [
        "Deadlock; tăng deadlock_timeout",
        "Lost update; dùng UPDATE SET balance = balance - x (hoặc FOR UPDATE / version)",
        "Không vấn đề",
        "Dirty read; dùng READ UNCOMMITTED"
      ], correct: 1, explanation: "Bài 13." },
    { q: "Nhiều worker cùng lấy job từ bảng mà không trùng, không chờ nhau dùng gì?", options: [
        "SELECT ... LIMIT 10",
        "SELECT ... FOR UPDATE SKIP LOCKED",
        "LOCK TABLE",
        "SERIALIZABLE"
      ], correct: 1, explanation: "Bài 15." },
    { q: "ALTER TABLE chờ khoá sau một query dài làm API timeout hàng loạt. Phòng ngừa?", options: [
        "Tăng statement_timeout",
        "SET lock_timeout cho migration và retry",
        "Tắt autovacuum",
        "Dùng VACUUM FULL"
      ], correct: 1, explanation: "Bài 14, 21." },
    { q: "Xoá dữ liệu log quá 90 ngày trên bảng hàng tỉ row, cách ít tác dụng phụ nhất?", options: [
        "DELETE hằng đêm",
        "Partition theo thời gian, DETACH CONCURRENTLY + DROP partition cũ",
        "TRUNCATE cả bảng",
        "VACUUM FULL"
      ], correct: 1, explanation: "Bài 16." },
    { q: "Worker Cloudflare nối PostgreSQL qua Hyperdrive. Điều nào đúng?", options: [
        "Tạo client global dùng mãi",
        "Tạo client mỗi request; tránh trạng thái phiên (SET, session advisory lock); cẩn thận cache câu đọc",
        "Hyperdrive dùng session mode",
        "Không cần nodejs_compat"
      ], correct: 1, explanation: "Bài 18." },
    { q: "Script xoá nhầm dữ liệu lúc 14:32. Thứ cứu được là?", options: [
        "Replica streaming",
        "Base backup + WAL archive → PITR tới 14:31:59 trên server tạm",
        "pg_stat_statements",
        "Logical replication"
      ], correct: 1, explanation: "Bài 20 — replication đã chép cả lệnh xoá." },
    { q: "Thêm index cho bảng 200 triệu row đang nhận ghi liên tục?", options: [
        "CREATE INDEX trong giờ thấp điểm",
        "CREATE INDEX CONCURRENTLY (migration không bọc transaction), dọn index INVALID nếu thất bại",
        "VACUUM FULL rồi CREATE INDEX",
        "Dùng BRIN cho mọi trường hợp"
      ], correct: 1, explanation: "Bài 21." },
    { q: "work_mem = 64MB, không có pooler, 400 query active mỗi query 2 node sort. Rủi ro?", options: [
        "Không rủi ro",
        "Bộ nhớ đỉnh ~50 GB → OOM killer → cả cluster restart",
        "Chỉ chậm hơn",
        "Replica lag"
      ], correct: 1, explanation: "Bài 01, 23: 400 × 2 × 64MB ≈ 51 GB." },
    { q: "Công cụ đầu tiên để biết query nào đáng tối ưu nhất trên production?", options: [
        "EXPLAIN mọi query",
        "pg_stat_statements sắp theo total_exec_time",
        "pg_dump",
        "pg_locks"
      ], correct: 1, explanation: "Bài 22." },
    { q: "Bảng con có FK tới orders nhưng không có index trên order_id. Hậu quả?", options: [
        "Không sao, PostgreSQL tự tạo index cho FK",
        "DELETE/UPDATE khoá ở orders phải quét bảng con để kiểm tra, và JOIN theo order_id chậm",
        "FK không hoạt động",
        "Không insert được"
      ], correct: 1, explanation: "PostgreSQL chỉ tự tạo index cho PK/UNIQUE, không cho phía tham chiếu của FK." }
  ]
});
