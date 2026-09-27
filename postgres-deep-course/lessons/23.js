window.LESSONS.push({
  id: "23",
  phase: "6", phaseName: "Vận hành production",
  title: "Cấu hình quan trọng: bộ nhớ, connection, planner, WAL, timeout",
  subtitle: "shared_buffers · work_mem nhân lên thế nào · effective_cache_size · random_page_cost · timeout · tham số nào cần restart",

  theory: `
    <p>Mặc định của PostgreSQL được chọn để chạy được trên máy rất nhỏ (<code>shared_buffers = 128MB</code>). Trên server thật, khoảng 15 tham số tạo ra phần lớn khác biệt. Dưới đây là chúng, nhóm theo cơ chế đã học.</p>

    <p><strong>Bộ nhớ</strong></p>
    <table>
      <tr><th>Tham số</th><th>Mặc định</th><th>Gợi ý khởi điểm</th><th>Ghi chú</th></tr>
      <tr><td><code>shared_buffers</code></td><td>128MB</td><td>~25% RAM</td><td>Cần restart. Phần còn lại để OS page cache</td></tr>
      <tr><td><code>effective_cache_size</code></td><td>4GB</td><td>50–75% RAM</td><td><em>Không cấp phát gì</em> — chỉ báo planner "cache tổng cộng lớn cỡ này" → mạnh dạn dùng index hơn</td></tr>
      <tr><td><code>work_mem</code></td><td>4MB</td><td>16–64MB, tăng riêng cho query báo cáo</td><td>Cho <strong>mỗi node</strong> sort/hash của <strong>mỗi query</strong>; hash dùng tới <code>work_mem × hash_mem_multiplier</code> (2.0)</td></tr>
      <tr><td><code>maintenance_work_mem</code></td><td>64MB</td><td>512MB–2GB</td><td>VACUUM, CREATE INDEX nhanh hơn</td></tr>
      <tr><td><code>huge_pages</code></td><td>try</td><td>on (Linux, cấu hình hugepages)</td><td>Giảm chi phí bảng trang khi shared_buffers lớn</td></tr>
    </table>
    <p><strong>work_mem nhân lên</strong>: 200 connection × 3 node sort/hash × 64MB (hash tới 128MB) = có thể vượt 40 GB lúc cao điểm → OOM killer → cả cluster restart (bài 01). Đặt mặc định vừa phải, tăng bằng <code>SET LOCAL work_mem</code> cho job báo cáo.</p>

    <p><strong>Connection</strong>: <code>max_connections</code> (mặc định 100, cần restart) — giữ vài trăm trở xuống, dùng pooler (bài 18).</p>

    <p><strong>Planner</strong>: <code>random_page_cost</code> 4.0 → ~1.1 trên SSD; <code>effective_io_concurrency</code> (số I/O song song cho bitmap heap scan; PG 18 nâng mặc định lên 16) — trên SSD/NVMe đặt ~200; <code>default_statistics_target</code> 100; <code>jit</code> (bật mặc định từ PG 12) — OLTP nhiều query ngắn đôi khi bị JIT làm chậm do chi phí biên dịch, cân nhắc tắt nếu thấy "JIT" chiếm đáng kể trong EXPLAIN ANALYZE.</p>

    <p><strong>WAL &amp; checkpoint</strong> (bài 02): <code>max_wal_size</code> 1GB → 4–16GB cho tải ghi lớn, <code>checkpoint_timeout</code> 5min → 15min, <code>wal_compression</code> (giảm full-page write).</p>

    <p><strong>Lưới an toàn</strong>: <code>statement_timeout</code> (theo role cho service API, vd 5s), <code>idle_in_transaction_session_timeout</code> (vd 60s), <code>lock_timeout</code> (migration), <code>transaction_timeout</code> (PG 17+). Đặt theo role thay vì toàn cục để job báo cáo có ngưỡng riêng.</p>

    <p><strong>Cách đổi</strong>: <code>ALTER SYSTEM SET ...</code> ghi vào <code>postgresql.auto.conf</code>, rồi <code>SELECT pg_reload_conf()</code>. Cột <code>context</code> trong <code>pg_settings</code> cho biết: <code>postmaster</code> = phải restart; <code>sighup</code> = reload là đủ; <code>user</code> = đặt được theo phiên/role.</p>

    <div class="callout"><p>💡 Đừng tin "config thần thánh" copy trên mạng. Thay đổi từng tham số, có số liệu trước/sau (pg_stat_statements, Grafana). Các công cụ như PGTune cho điểm khởi đầu hợp lý, không phải đích đến.</p></div>
  `,

  codeTabs: [
    { id: "conf", label: "① Server 64GB / 16 core", lines: [
      "# Điểm khởi đầu cho OLTP trên SSD — đo rồi chỉnh",
      "max_connections = 200                  # + PgBouncer phía trước",
      "shared_buffers = 16GB                  # ~25% RAM (restart)",
      "effective_cache_size = 48GB            # ~75% RAM, chỉ là gợi ý cho planner",
      "work_mem = 32MB                        # × node × connection — tính kỹ!",
      "maintenance_work_mem = 2GB",
      "huge_pages = on",
      "random_page_cost = 1.1",
      "effective_io_concurrency = 200",
      "max_wal_size = 8GB",
      "checkpoint_timeout = 15min",
      "wal_compression = on",
      "idle_in_transaction_session_timeout = 60s"
    ]},
    { id: "role", label: "② Theo role / phiên", lines: [
      "ALTER ROLE order_api   SET statement_timeout = '5s';",
      "ALTER ROLE reporting   SET statement_timeout = '10min';",
      "ALTER ROLE reporting   SET work_mem = '256MB';",
      "",
      "-- chỉ cho một transaction nặng",
      "BEGIN;",
      "SET LOCAL work_mem = '1GB';",
      "SELECT customer_id, sum(total) FROM orders GROUP BY 1 ORDER BY 2 DESC;",
      "COMMIT;"
    ]},
    { id: "apply", label: "③ Áp dụng & kiểm tra", lines: [
      "ALTER SYSTEM SET work_mem = '32MB';",
      "SELECT pg_reload_conf();",
      "",
      "SELECT name, setting, unit, context, source, pending_restart",
      "FROM pg_settings",
      "WHERE name IN ('shared_buffers', 'work_mem', 'max_connections', 'random_page_cost');",
      "",
      "--  name           | setting | unit | context    | pending_restart",
      "--  shared_buffers | 2097152 | 8kB  | postmaster | t        <- cần restart",
      "--  work_mem       | 32768   | kB   | user       | f"
    ]},
    { id: "mem", label: "④ Tính bộ nhớ xấu nhất", lines: [
      "// Ước lượng thô, trường hợp xấu nhất",
      "let active_queries = 60.0;             // đang chạy cùng lúc (sau pooler)",
      "let nodes_per_query = 3.0;             // sort + hash + hash",
      "let work_mem_mb = 32.0;",
      "let hash_mult = 2.0;                   // hash_mem_multiplier",
      "let peak_gb = active_queries * nodes_per_query * work_mem_mb * hash_mult / 1024.0;",
      "// = 60 × 3 × 32 × 2 / 1024 ≈ 11.25 GB",
      "// + shared_buffers 16 GB + vài MB/backend + OS cache → vẫn vừa 64 GB",
      "// Không có pooler, 500 connection active → ≈ 94 GB → OOM"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ram"><div class="nl">🖥️ RAM 64 GB</div><div class="ns">chia cho ai?</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="sb"><div class="nl">🧠 shared_buffers 16GB</div><div class="ns">cấp phát cố định</div></div>
      <div class="node" id="wm"><div class="nl">🧮 work_mem × node × query</div><div class="ns">co giãn theo tải</div></div>
      <div class="node" id="os"><div class="nl">🗄️ OS page cache</div><div class="ns">phần còn lại</div></div>
    </div>
    <div class="arrow" id="a2">↓ planner biết qua</div>
    <div class="node" id="ecs"><div class="nl">📐 effective_cache_size 48GB</div><div class="ns">chỉ là con số gợi ý</div></div>
    <div class="arrow" id="a3">↓ lưới an toàn</div>
    <div class="node" id="to"><div class="nl">⏱️ statement / idle_in_tx / lock timeout</div><div class="ns">theo role</div></div>
  `,
  steps: [
    { title: "1 · shared_buffers + OS cache", tab: "conf", highlight: [3, 4], on: ["ram", "a1", "sb", "os"],
      desc: "PostgreSQL cache hai tầng: shared_buffers của nó và page cache của OS. 25% RAM cho shared_buffers là điểm khởi đầu phổ biến." },
    { title: "2 · work_mem là biến số nguy hiểm", tab: "mem", highlight: [2, 3, 6, 7, 9], on: ["wm"],
      desc: "Cấp theo node, theo query, không phải một lần cho cả server. Pooler giới hạn số query active nên cũng giới hạn luôn bộ nhớ đỉnh." },
    { title: "3 · Planner cần biết phần cứng", tab: "conf", highlight: [4, 8, 9], on: ["a2", "ecs"],
      desc: "effective_cache_size và random_page_cost thấp khiến planner ưa index trên SSD — đúng với thực tế phần cứng hiện đại." },
    { title: "4 · Theo role, theo transaction", tab: "role", highlight: [1, 2, 3, 7], on: ["a3", "to"],
      desc: "API ngắn, báo cáo dài: mỗi role một ngưỡng. SET LOCAL cho riêng một transaction nặng." },
    { title: "5 · Áp dụng đúng cách", tab: "apply", highlight: [1, 2, 4, 9, 10], on: ["sb", "wm"],
      desc: "context = postmaster → cần restart (pending_restart = t). context = user/sighup → reload là xong." }
  ],

  quiz: [
    { q: "effective_cache_size làm gì?", options: [
        "Cấp phát bộ nhớ cache cho PostgreSQL",
        "Chỉ là gợi ý cho planner về tổng dung lượng cache khả dụng (shared_buffers + OS cache)",
        "Giới hạn RAM của OS",
        "Kích thước WAL"
      ], correct: 1, explanation: "Không cấp phát gì; ảnh hưởng tới ước lượng cost của index scan." },
    { q: "work_mem = 64MB, 100 query chạy cùng lúc, mỗi query 2 node sort. Bộ nhớ đỉnh có thể tới khoảng?", options: [
        "64 MB", "6,4 GB", "12,8 GB", "128 MB"
      ], correct: 2, explanation: "100 × 2 × 64MB = 12,8 GB (node hash còn có thể gấp đôi)." },
    { q: "Tham số nào cần restart server khi đổi?", options: [
        "work_mem", "statement_timeout", "shared_buffers", "random_page_cost"
      ], correct: 2, explanation: "Kiểm tra cột context = 'postmaster' trong pg_settings." },
    { q: "Cách tốt để cho job báo cáo nhiều bộ nhớ sort hơn mà không ảnh hưởng API?", options: [
        "Tăng work_mem toàn cục lên 1GB",
        "ALTER ROLE reporting SET work_mem = ... hoặc SET LOCAL work_mem trong transaction của job",
        "Tăng shared_buffers",
        "Tăng max_connections"
      ], correct: 1, explanation: "Giữ mặc định an toàn cho số đông." },
    { q: "Trên SSD, random_page_cost thường nên đặt khoảng?", options: [
        "4.0 (giữ mặc định)", "~1.1", "100", "0"
      ], correct: 1, explanation: "Đọc ngẫu nhiên trên SSD gần bằng đọc tuần tự." },
    { q: "ALTER SYSTEM SET ghi cấu hình vào đâu?", options: [
        "postgresql.conf", "postgresql.auto.conf", "pg_hba.conf", "Bảng pg_settings"
      ], correct: 1, explanation: "Sau đó pg_reload_conf() hoặc restart tuỳ context." },
    { q: "Vì sao JIT đôi khi được tắt cho hệ OLTP?", options: [
        "Vì JIT làm sai kết quả",
        "Vì chi phí biên dịch có thể lớn hơn lợi ích với các query ngắn",
        "Vì JIT tốn đĩa",
        "Vì JIT không hỗ trợ index"
      ], correct: 1, explanation: "Xem dòng JIT trong EXPLAIN ANALYZE để quyết định." },
    { q: "maintenance_work_mem ảnh hưởng tới thao tác nào?", options: [
        "SELECT thường", "VACUUM, CREATE INDEX, ADD FOREIGN KEY", "COMMIT", "Replication"
      ], correct: 1, explanation: "Autovacuum dùng autovacuum_work_mem nếu được đặt, không thì dùng giá trị này." },
    { q: "Lưới an toàn nào cắt session đã BEGIN rồi bỏ quên?", options: [
        "statement_timeout",
        "idle_in_transaction_session_timeout",
        "checkpoint_timeout",
        "deadlock_timeout"
      ], correct: 1, explanation: "Ngăn transaction treo giữ khoá và cản VACUUM." }
  ]
});
