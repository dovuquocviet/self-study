window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Planner & tối ưu query",
  title: "Join algorithms & statistics — vì sao planner đoán sai",
  subtitle: "Nested Loop · Hash Join · Merge Join · pg_stats · ANALYZE · extended statistics",

  theory: `
    <p>Planner là bộ tối ưu dựa trên chi phí: với mỗi cách join/scan khả dĩ, nó <em>ước lượng</em> số row rồi tính cost và chọn rẻ nhất. Ước lượng sai → chọn sai. Nên hiểu ba kiểu join và nguồn gốc con số ước lượng.</p>

    <table>
      <tr><th>Join</th><th>Cách chạy</th><th>Tốt khi</th><th>Tệ khi</th></tr>
      <tr><td><strong>Nested Loop</strong></td><td>Với mỗi row bên ngoài, tìm row khớp bên trong (thường qua index)</td><td>Bên ngoài ít row, bên trong có index</td><td>Bên ngoài hoá ra có 1 triệu row (ước lượng 10)</td></tr>
      <tr><td><strong>Hash Join</strong></td><td>Dựng bảng băm từ bên nhỏ (<em>build</em>), quét bên lớn (<em>probe</em>)</td><td>Join bằng (=) giữa hai tập vừa/lớn</td><td>Bảng băm vượt <code>work_mem × hash_mem_multiplier</code> → chia batch ra đĩa</td></tr>
      <tr><td><strong>Merge Join</strong></td><td>Hai bên đã sắp xếp theo khoá, đi song song</td><td>Cả hai đã có thứ tự (index) hoặc rất lớn</td><td>Phải sort thêm hai tập lớn</td></tr>
    </table>

    <p><strong>Thống kê lấy từ đâu?</strong> <code>ANALYZE</code> (autovacuum tự chạy, bài 05) lấy mẫu ~300 × <code>default_statistics_target</code> (100) = 30.000 row mỗi bảng và ghi vào <code>pg_statistic</code> (xem qua view <code>pg_stats</code>):</p>
    <ul>
      <li><code>null_frac</code>, <code>n_distinct</code> — tỉ lệ NULL, số giá trị khác nhau.</li>
      <li><code>most_common_vals</code> + <code>most_common_freqs</code> — tối đa 100 giá trị hay gặp và tần suất.</li>
      <li><code>histogram_bounds</code> — chia phần còn lại thành các khoảng đều nhau để ước lượng điều kiện <code>&lt;</code>, <code>&gt;</code>.</li>
      <li><code>correlation</code> — độ tương quan giữa thứ tự giá trị và thứ tự vật lý (ảnh hưởng cost index scan).</li>
    </ul>

    <p><strong>Nguyên nhân ước lượng sai kinh điển</strong></p>
    <ol>
      <li><strong>Thống kê cũ</strong>: vừa bulk load/xoá lớn mà chưa ANALYZE (autovacuum chưa tới). Sau migration dữ liệu lớn luôn chạy <code>ANALYZE</code>.</li>
      <li><strong>Cột tương quan</strong>: planner mặc định coi các điều kiện độc lập. <code>city = 'Hà Nội' AND district = 'Cầu Giấy'</code> → nhân hai xác suất → ước lượng quá thấp. Chữa: <code>CREATE STATISTICS ... (dependencies, mcv)</code>.</li>
      <li><strong>Phân bố lệch</strong> vượt quá 100 MCV: tăng <code>ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 1000</code>.</li>
      <li><strong>Biểu thức/hàm</strong>: <code>WHERE lower(email) = ...</code> không có thống kê → đoán mặc định (vd 0,5%). Expression index hoặc CREATE STATISTICS trên biểu thức (PG 14+) sẽ có thống kê riêng.</li>
      <li><strong>Generic plan</strong> với prepared statement: sau 5 lần chạy, PostgreSQL có thể chuyển sang plan dùng chung không nhìn giá trị tham số — tệ với dữ liệu lệch (tenant lớn vs nhỏ). Có <code>plan_cache_mode</code> để điều khiển.</li>
    </ol>

    <div class="callout"><p>💡 Đừng vội "ép" planner (<code>SET enable_nestloop = off</code>) ở production — đó là công cụ chẩn đoán. Sửa gốc: thống kê, index, cách viết query. PostgreSQL không có hint chính thức; extension <code>pg_hint_plan</code> tồn tại nhưng là phương án cuối.</p></div>
  `,

  codeTabs: [
    { id: "joins", label: "① Ba kiểu join", lines: [
      " Nested Loop  (rows=20)",
      "   ->  Index Scan using customers_pkey on customers c  (rows=1)",
      "   ->  Index Scan using orders_cust_idx on orders o  (rows=20)",
      "",
      " Hash Join  (rows=480000)",
      "   Hash Cond: (o.customer_id = c.id)",
      "   ->  Seq Scan on orders o",
      "   ->  Hash  (Buckets: 262144  Batches: 1  Memory Usage: 18432kB)",
      "         ->  Seq Scan on customers c",
      "",
      " Merge Join  (Merge Cond: (a.id = b.a_id))"
    ]},
    { id: "stats", label: "② pg_stats", lines: [
      "SELECT attname, null_frac, n_distinct,",
      "       most_common_vals, most_common_freqs, correlation",
      "FROM pg_stats WHERE tablename = 'orders' AND attname = 'status';",
      "",
      "--  attname | null_frac | n_distinct | most_common_vals              | most_common_freqs",
      "--  status  |         0 |          5 | {DELIVERED,PAID,PENDING,...}  | {0.91,0.05,0.004,...}",
      "",
      "-- WHERE status = 'PENDING' → ước lượng 0.004 × reltuples",
      "ANALYZE orders;     -- làm mới sau bulk load / xoá lớn"
    ]},
    { id: "corr", label: "③ Cột tương quan", lines: [
      "EXPLAIN ANALYZE SELECT * FROM addresses",
      "WHERE city = 'Hà Nội' AND district = 'Cầu Giấy';",
      "-- (rows=310)  actual rows=41200   ← 0.3 × 0.004 × N: coi như độc lập",
      "",
      "CREATE STATISTICS addr_city_district (dependencies, mcv)",
      "    ON city, district FROM addresses;",
      "ANALYZE addresses;",
      "-- (rows=40870) actual rows=41200  ✅",
      "",
      "ALTER TABLE orders ALTER COLUMN merchant_id SET STATISTICS 1000;"
    ]},
    { id: "rust", label: "④ Generic plan (sqlx)", lines: [
      "// sqlx chuẩn bị statement (named) và cache theo connection",
      "sqlx::query(\"SELECT * FROM orders WHERE tenant_id = $1 AND status = 'OPEN'\")",
      "    .bind(tenant_id)",
      "    .fetch_all(&pool).await?;",
      "",
      "// Sau ~5 lần, server có thể chọn generic plan dùng cho MỌI tenant_id.",
      "// Tenant nhỏ (10 row) và tenant khổng lồ (10 triệu row) cùng một plan.",
      "",
      "// Chẩn đoán trong psql:",
      "// SET plan_cache_mode = force_custom_plan;   -- lập plan theo từng giá trị"
    ]}
  ],

  stageHtml: `
    <div class="node" id="an"><div class="nl">🎲 ANALYZE lấy mẫu</div><div class="ns">300 × statistics_target row</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="st"><div class="nl">📊 pg_statistic</div><div class="ns">MCV · histogram · n_distinct · correlation</div></div>
    <div class="arrow" id="a2">↓ ước lượng selectivity × reltuples</div>
    <div class="node" id="pl"><div class="nl">🧮 Planner</div><div class="ns">rows ước lượng → cost từng phương án</div></div>
    <div class="arrow" id="a3">↓ chọn rẻ nhất</div>
    <div class="row">
      <div class="node" id="nl"><div class="nl">🔁 Nested Loop</div><div class="ns">ít row ngoài</div></div>
      <div class="node" id="hj"><div class="nl">#️⃣ Hash Join</div><div class="ns">tập lớn, điều kiện =</div></div>
      <div class="node" id="mj"><div class="nl">🔀 Merge Join</div><div class="ns">đã có thứ tự</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Ba kiểu join", tab: "joins", highlight: [1, 5, 6, 8, 11], on: ["nl", "hj", "mj"],
      desc: "Nested Loop cho ít row, Hash Join cho tập lớn điều kiện bằng, Merge Join khi hai bên đã sắp xếp. 'Batches: 1' nghĩa là bảng băm vừa trong bộ nhớ." },
    { title: "2 · Thống kê từ ANALYZE", tab: "stats", highlight: [1, 2, 3, 6, 9], on: ["an", "a1", "st"],
      desc: "MCV cho biết 'PENDING' chiếm 0,4% → planner ước lượng số row và chọn index." },
    { title: "3 · Từ ước lượng tới plan", tab: "stats", highlight: [8], on: ["a2", "pl", "a3"],
      desc: "Selectivity × reltuples = rows ước lượng; rồi mỗi phương án được tính cost." },
    { title: "4 · Cột tương quan phá ước lượng", tab: "corr", highlight: [2, 3], on: ["pl"],
      desc: "Planner nhân hai xác suất như thể độc lập → ước lượng thấp hơn thực tế ~130 lần → dễ chọn Nested Loop cho 41 nghìn row." },
    { title: "5 · Extended statistics", tab: "corr", highlight: [5, 6, 7, 8, 10], on: ["st"],
      desc: "CREATE STATISTICS dạy planner quan hệ giữa các cột. SET STATISTICS tăng độ chi tiết cho cột phân bố lệch." },
    { title: "6 · Generic plan", tab: "rust", highlight: [2, 6, 7, 10], on: ["pl"],
      desc: "Prepared statement có thể dùng một plan cho mọi giá trị tham số. Với dữ liệu lệch theo tenant, đây là nguồn gốc của 'query lúc nhanh lúc chậm'." }
  ],

  quiz: [
    { q: "Nested Loop join phù hợp nhất khi nào?", options: [
        "Hai bảng lớn, không index",
        "Bên ngoài ít row và bên trong tra được bằng index",
        "Điều kiện join là bất đẳng thức trên tập lớn",
        "Luôn luôn"
      ], correct: 1, explanation: "Chi phí ≈ số row ngoài × chi phí một lần tra bên trong." },
    { q: "Hash Join dựng bảng băm từ bên nào?", options: [
        "Bên lớn hơn", "Bên (ước lượng) nhỏ hơn", "Ngẫu nhiên", "Luôn bên trái"
      ], correct: 1, explanation: "Build bên nhỏ, probe bên lớn; nếu vượt bộ nhớ thì chia batch ra đĩa." },
    { q: "ANALYZE lấy mẫu khoảng bao nhiêu row với default_statistics_target = 100?", options: [
        "100", "30.000", "Toàn bộ bảng", "1%"
      ], correct: 1, explanation: "300 × statistics_target." },
    { q: "Vì sao điều kiện city = X AND district = Y thường bị ước lượng quá thấp?", options: [
        "Thiếu index",
        "Planner mặc định coi các điều kiện độc lập và nhân xác suất, trong khi district phụ thuộc city",
        "Do collation",
        "Do work_mem"
      ], correct: 1, explanation: "CREATE STATISTICS (dependencies, mcv) sửa được." },
    { q: "Vừa import 20 triệu row vào bảng mới. Nên làm gì trước khi chạy query báo cáo?", options: [
        "Không cần gì",
        "Chạy ANALYZE bảng đó",
        "VACUUM FULL",
        "Restart server"
      ], correct: 1, explanation: "Không có thống kê, planner dùng ước lượng mặc định rất sai." },
    { q: "most_common_vals trong pg_stats dùng để làm gì?", options: [
        "Liệt kê giá trị unique",
        "Ước lượng chính xác selectivity cho các giá trị hay gặp",
        "Tạo index",
        "Nén dữ liệu"
      ], correct: 1, explanation: "Giá trị ngoài MCV thì ước lượng từ phần còn lại / histogram." },
    { q: "'Query lúc nhanh lúc chậm' tuỳ tham số với prepared statement có thể do?", options: [
        "Network",
        "Generic plan dùng chung cho mọi giá trị tham số, không hợp với dữ liệu lệch",
        "Checkpoint",
        "Autovacuum"
      ], correct: 1, explanation: "Kiểm tra bằng plan_cache_mode = force_custom_plan." },
    { q: "Dùng SET enable_nestloop = off ở production là?", options: [
        "Cách chuẩn để tối ưu",
        "Công cụ chẩn đoán; sửa gốc ở thống kê/index/query mới bền",
        "Bắt buộc với Hash Join",
        "Không có tác dụng"
      ], correct: 1, explanation: "Ép toàn cục sẽ làm hỏng các query khác vốn cần Nested Loop." },
    { q: "Hash Join báo 'Batches: 8' nghĩa là gì?", options: [
        "Chạy 8 worker song song",
        "Bảng băm không vừa bộ nhớ (work_mem × hash_mem_multiplier) nên chia thành 8 lô, dùng file tạm",
        "8 bảng được join",
        "8 lần retry"
      ], correct: 1, explanation: "Batches: 1 là lý tưởng." }
  ]
});
