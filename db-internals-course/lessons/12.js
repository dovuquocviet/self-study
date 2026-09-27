window.LESSONS.push({
  id: "12",
  phase: "2", phaseName: "Transaction, đồng thời & truy vấn",
  title: "Query planner & EXPLAIN — DB quyết định chạy SQL thế nào",
  subtitle: "Cost-based optimizer · thống kê · scan & join · ước lượng sai = plan tệ · explain ở Mongo/ClickHouse",

  theory: `
    <p>SQL là <em>khai báo</em>: bạn nói muốn gì, không nói làm thế nào. <strong>Planner</strong> (optimizer) sinh nhiều cách chạy, ước lượng <em>chi phí</em> mỗi cách
    dựa trên thống kê, rồi chọn cách rẻ nhất. Khi query chậm, 80% lý do nằm ở chỗ planner chọn sai hoặc không có lựa chọn tốt.</p>

    <p><strong>Thống kê</strong>: <code>ANALYZE</code> (autovacuum tự chạy) lấy mẫu mỗi cột: số giá trị khác nhau, giá trị phổ biến nhất (MCV), histogram, tỉ lệ NULL,
    tương quan với thứ tự vật lý. Từ đó ước lượng một điều kiện WHERE sẽ lọc còn bao nhiêu dòng (<em>selectivity</em>).</p>

    <p><strong>Đơn vị chi phí</strong>: tương đối, không phải ms. Mặc định <code>seq_page_cost = 1</code>, <code>random_page_cost = 4</code> (hợp với HDD; SSD thường hạ xuống ~1.1),
    cộng chi phí CPU mỗi dòng. Đó là lý do đọc tuần tự cả bảng nhỏ có thể "rẻ" hơn index.</p>

    <table>
      <tr><th>Node</th><th>Khi nào</th></tr>
      <tr><td>Seq Scan</td><td>Bảng nhỏ, hoặc điều kiện khớp phần lớn bảng, hoặc không có index phù hợp</td></tr>
      <tr><td>Index Scan</td><td>Lọc được ít dòng; đọc index rồi nhảy vào heap</td></tr>
      <tr><td>Index Only Scan</td><td>Index chứa đủ cột + page all-visible</td></tr>
      <tr><td>Bitmap Heap Scan</td><td>Số dòng vừa phải, hoặc kết hợp nhiều index</td></tr>
      <tr><td>Nested Loop</td><td>Vế ngoài ít dòng, vế trong tra index nhanh</td></tr>
      <tr><td>Hash Join</td><td>Join bằng <code>=</code> hai tập lớn; dựng bảng băm từ vế nhỏ trong RAM (<code>work_mem</code>)</td></tr>
      <tr><td>Merge Join</td><td>Hai vế đã (hoặc dễ) sắp xếp theo khoá join</td></tr>
    </table>

    <p><strong>Đọc EXPLAIN ANALYZE</strong>: mỗi node có <code>rows=</code> ước lượng và <code>actual ... rows=</code> thật. Ước lượng lệch hàng trăm lần là manh mối số 1:
    planner nghĩ 10 dòng nên chọn Nested Loop, thực tế 1 triệu dòng → chạy 1 triệu lần tra index. Nguyên nhân hay gặp: thống kê cũ, cột tương quan nhau
    (city và country), điều kiện bọc hàm, tham số của prepared statement.</p>

    <p><strong>JPA và planner</strong>: N+1 query (load 100 order rồi lazy-load từng user) không phải lỗi planner — mỗi query đều "tối ưu", chỉ là có 101 query.
    Bật <code>spring.jpa.show-sql</code> hoặc đếm query trong test; dùng <code>JOIN FETCH</code> / <code>@EntityGraph</code>.</p>

    <p><strong>Ở DB khác</strong>: MongoDB <code>explain("executionStats")</code> — tìm <code>COLLSCAN</code> (quét cả collection) vs <code>IXSCAN</code>, so <code>totalDocsExamined</code>
    với <code>nReturned</code>. ClickHouse <code>EXPLAIN indexes = 1</code> cho biết bao nhiêu granule bị loại bởi primary/skip index. Elasticsearch có <code>"profile": true</code>.</p>

    <div class="callout"><p>💡 Quy trình: <code>EXPLAIN (ANALYZE, BUFFERS)</code> → tìm node tốn thời gian nhất → so rows ước lượng vs thật → xem Buffers (đọc đĩa bao nhiêu)
    → mới quyết định thêm index, viết lại query, hay ANALYZE lại. Đừng thêm index theo cảm tính.</p></div>
  `,

  codeTabs: [
    { id: "explain", label: "EXPLAIN ANALYZE", lines: [
      "EXPLAIN (ANALYZE, BUFFERS)",
      "SELECT o.id, u.email FROM orders o JOIN users u ON u.id = o.user_id",
      "WHERE o.created_at >= now() - interval '1 day';",
      "",
      "Hash Join  (cost=1250..9800 rows=4800) (actual time=12.1..48.3 rows=5120 loops=1)",
      "  Hash Cond: (o.user_id = u.id)",
      "  Buffers: shared hit=2100 read=340",
      "  ->  Index Scan using orders_created_at_idx on orders o",
      "        (cost=0.43..7300 rows=4800) (actual rows=5120 loops=1)",
      "  ->  Hash  (actual rows=200000)",
      "        ->  Seq Scan on users u  (actual rows=200000)",
      "Planning Time: 0.4 ms   Execution Time: 49.0 ms"
    ]},
    { id: "bad", label: "Ước lượng sai", lines: [
      "Nested Loop  (rows=12) (actual rows=980000 loops=1)          ← lệch ~80.000 lần",
      "  ->  Seq Scan on orders (rows=12) (actual rows=980000)",
      "        Filter: ((city = 'Hà Nội') AND (country = 'VN'))",
      "  ->  Index Scan using users_pkey on users (actual loops=980000)",
      "",
      "-- planner tưởng 2 điều kiện độc lập → nhân selectivity → quá nhỏ",
      "-- sửa: cho planner biết 2 cột tương quan",
      "CREATE STATISTICS orders_city_country (dependencies) ON city, country FROM orders;",
      "ANALYZE orders;"
    ]},
    { id: "jpa", label: "N+1 trong JPA", lines: [
      "List<Order> orders = orderRepo.findTop100ByOrderByIdDesc();   // 1 query",
      "for (Order o : orders) {",
      "    o.getUser().getEmail();                                 // +100 query (lazy)",
      "}",
      "",
      "// sửa: lấy luôn trong 1 query",
      "@Query(\"select o from Order o join fetch o.user order by o.id desc\")",
      "List<Order> findRecentWithUser(Pageable page);"
    ]},
    { id: "others", label: "Mongo & ClickHouse", lines: [
      "// MongoDB",
      "db.orders.find({ userId: 42 }).sort({ createdAt: -1 }).explain('executionStats')",
      "// winningPlan: FETCH ← IXSCAN { userId: 1, createdAt: -1 }",
      "// nReturned: 20, totalKeysExamined: 20, totalDocsExamined: 20   ← lý tưởng",
      "// nếu thấy COLLSCAN + totalDocsExamined: 5000000 → thiếu index",
      "",
      "-- ClickHouse",
      "EXPLAIN indexes = 1 SELECT count() FROM events WHERE country = 'VN';",
      "--   PrimaryKey  Keys: country  Granules: 120/98000   ← chỉ đọc 120 granule"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sql"><div class="nl">📝 SQL khai báo</div><div class="ns">muốn gì, không nói cách làm</div></div>
    <div class="arrow" id="a1">↓ parse + rewrite</div>
    <div class="node" id="plans"><div class="nl">🗺️ Sinh các plan ứng viên</div><div class="ns">scan nào? join nào? thứ tự join?</div></div>
    <div class="arrow" id="a2">↓ ước lượng chi phí từ thống kê</div>
    <div class="row">
      <div class="node" id="stats"><div class="nl">📊 Thống kê (ANALYZE)</div><div class="ns">MCV, histogram, n_distinct</div></div>
      <div class="node" id="cost"><div class="nl">💰 Cost model</div><div class="ns">seq=1, random=4, cpu</div></div>
    </div>
    <div class="arrow" id="a3">↓ chọn rẻ nhất → thực thi</div>
    <div class="node" id="exec"><div class="nl">⚙️ Executor</div><div class="ns">EXPLAIN ANALYZE so ước lượng vs thật</div></div>
  `,
  steps: [
    { title: "1 · Từ SQL tới các plan", tab: "explain", highlight: [2, 3], on: ["sql", "a1", "plans"],
      desc: "Cùng câu JOIN có thể chạy bằng Nested Loop, Hash Join hay Merge Join, với nhiều thứ tự." },
    { title: "2 · Chi phí dựa vào thống kê", tab: "explain", highlight: [5, 9], on: ["a2", "stats", "cost"],
      desc: "rows=4800 là ước lượng từ histogram của created_at. Ở đây ước lượng sát thực tế (5120)." },
    { title: "3 · Đọc cây plan", tab: "explain", highlight: [5, 6, 7, 8, 10, 11, 12], on: ["a3", "exec"],
      desc: "Hash Join: dựng bảng băm từ users, dò bằng từng order. Buffers cho biết 340 page phải đọc từ OS." },
    { title: "4 · Ước lượng lệch → plan tệ", tab: "bad", highlight: [1, 2, 4, 6], on: ["stats", "exec"],
      desc: "Planner tưởng 12 dòng nên chọn Nested Loop; thực tế 980.000 lần tra index." },
    { title: "5 · Sửa thống kê, không sửa code", tab: "bad", highlight: [8, 9], on: ["stats"],
      desc: "Extended statistics cho planner biết city và country phụ thuộc nhau." },
    { title: "6 · N+1: lỗi ở tầng ứng dụng", tab: "jpa", highlight: [1, 3, 7, 8], on: ["sql"],
      desc: "Mỗi query đều nhanh, nhưng có 101 query. JOIN FETCH gom về 1." },
    { title: "7 · Explain ở Mongo & ClickHouse", tab: "others", highlight: [2, 4, 5, 8, 9], on: ["exec"],
      desc: "Mongo: COLLSCAN vs IXSCAN, docsExamined vs nReturned. ClickHouse: số granule phải đọc." }
  ],

  quiz: [
    { q: "Planner của PostgreSQL chọn plan dựa trên?", options: [
        "Thứ tự viết trong SQL",
        "Chi phí ước lượng từ thống kê dữ liệu và cost model",
        "Ngẫu nhiên",
        "Plan của lần chạy trước luôn luôn"
      ], correct: 1, explanation: "Cost-based optimizer." },
    { q: "Manh mối quan trọng nhất trong EXPLAIN ANALYZE khi query chậm?", options: [
        "Planning Time",
        "rows ước lượng lệch rất xa rows thực tế",
        "Tên index",
        "Số cột SELECT"
      ], correct: 1, explanation: "Ước lượng sai dẫn tới chọn sai loại join/scan." },
    { q: "Hash Join hợp với trường hợp nào?", options: [
        "Join bằng '=' giữa hai tập lớn",
        "Join bằng '<'",
        "Vế ngoài chỉ 1 dòng",
        "Không có điều kiện join"
      ], correct: 0, explanation: "Dựng bảng băm từ vế nhỏ hơn trong work_mem." },
    { q: "Nested Loop tốt khi nào?", options: [
        "Hai vế đều hàng triệu dòng",
        "Vế ngoài ít dòng, vế trong tra được bằng index",
        "Không có index",
        "Luôn luôn"
      ], correct: 1, explanation: "Với vế ngoài lớn nó thành hàng triệu lần tra." },
    { q: "random_page_cost mặc định 4 phản ánh điều gì?", options: [
        "Đọc ngẫu nhiên đắt hơn đọc tuần tự (giả định HDD); SSD thường hạ gần 1",
        "Số CPU",
        "Số index tối đa",
        "Số giây timeout"
      ], correct: 0, explanation: "Hạ xuống khiến planner ưu tiên index scan hơn." },
    { q: "ANALYZE làm gì?", options: [
        "Dọn dead tuple",
        "Lấy mẫu dữ liệu, cập nhật thống kê cho planner",
        "Tạo index",
        "Kiểm tra lỗi cú pháp"
      ], correct: 1, explanation: "VACUUM mới dọn dead tuple; autovacuum chạy cả hai." },
    { q: "N+1 query trong JPA là gì?", options: [
        "Planner chọn sai plan",
        "1 query lấy danh sách + N query lazy-load quan hệ cho từng phần tử",
        "Lỗi deadlock",
        "Thiếu index khoá chính"
      ], correct: 1, explanation: "Sửa bằng JOIN FETCH hoặc @EntityGraph." },
    { q: "Trong MongoDB explain, dấu hiệu thiếu index?", options: [
        "IXSCAN và totalDocsExamined = nReturned",
        "COLLSCAN và totalDocsExamined lớn hơn rất nhiều nReturned",
        "FETCH",
        "winningPlan có SORT_KEY_GENERATOR"
      ], correct: 1, explanation: "Quét cả collection để trả vài document." },
    { q: "CREATE STATISTICS (dependencies) ON city, country giải quyết vấn đề gì?", options: [
        "Tạo index trên 2 cột",
        "Cho planner biết hai cột tương quan để không nhân selectivity như thể độc lập",
        "Nén cột",
        "Chia partition"
      ], correct: 1, explanation: "Mặc định planner giả định các điều kiện độc lập." }
  ]
});
