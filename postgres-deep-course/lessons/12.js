window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Planner & tối ưu query",
  title: "Tối ưu query thực chiến: 7 mẫu hay gặp",
  subtitle: "N+1 · phân trang keyset · OR → UNION · bọc cột · NOT IN · count(*) · batch ghi",

  theory: `
    <p>Quy trình không đổi: <strong>đo</strong> (pg_stat_statements — bài 22) → chọn query tốn tổng thời gian nhiều nhất → <strong>EXPLAIN (ANALYZE, BUFFERS)</strong> → sửa một chỗ → đo lại. Dưới đây là 7 mẫu chiếm phần lớn các ca chậm trong hệ thống Java/Rust thường gặp.</p>

    <p><strong>1. N+1</strong> — lỗi số 1 của ORM: lấy 100 đơn rồi <code>order.getItems()</code> lazy → 101 round-trip. Mỗi câu 0,3 ms nhưng cộng thêm độ trễ mạng. Sửa: một query với <code>JOIN</code>, hoặc <code>WHERE order_id = ANY($1)</code> truyền mảng id.</p>

    <p><strong>2. OFFSET lớn</strong> — <code>LIMIT 20 OFFSET 200000</code> vẫn phải đọc và vứt 200.000 row. Dùng <strong>keyset pagination</strong>: nhớ (created_at, id) của row cuối trang trước, <code>WHERE (created_at, id) &lt; ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20</code> + index khớp. Chi phí trang nào cũng như trang đầu.</p>

    <p><strong>3. Bọc cột trong hàm/ép kiểu</strong> — <code>WHERE date(created_at) = ...</code>, <code>WHERE id::text = $1</code>, so sánh <code>varchar</code> với tham số kiểu khác → không dùng được index. Viết điều kiện trên cột gốc, đúng kiểu.</p>

    <p><strong>4. OR trên các cột khác nhau</strong> — <code>WHERE email = $1 OR phone = $2</code>: planner có thể dùng BitmapOr nếu mỗi cột có index; không thì seq scan. Viết lại thành <code>UNION</code> hai query dùng index riêng thường ổn định hơn.</p>

    <p><strong>5. NOT IN với subquery</strong> — nếu subquery có NULL, <code>NOT IN</code> trả về rỗng (logic 3 giá trị) và thường không thành anti-join được. Dùng <code>NOT EXISTS</code>.</p>

    <p><strong>6. count(*) cho giao diện</strong> — đếm chính xác trên bảng lớn luôn đắt (bài 03). Hỏi lại nghiệp vụ: "có hơn 1000 kết quả không" → <code>SELECT 1 ... LIMIT 1001</code>; tổng xấp xỉ → <code>pg_class.reltuples</code> hoặc số row ước lượng từ EXPLAIN.</p>

    <p><strong>7. Ghi từng row</strong> — 10.000 INSERT riêng lẻ, mỗi cái một transaction = 10.000 lần fsync WAL. Gom batch: <code>INSERT ... SELECT * FROM UNNEST($1, $2)</code>, hoặc <code>COPY</code> cho lượng lớn. UPSERT: <code>INSERT ... ON CONFLICT (key) DO UPDATE</code>.</p>

    <div class="callout"><p>💡 Nhiều ca "DB chậm" thật ra là <em>quá nhiều query nhanh</em>. Nhìn cột <code>calls</code> trong pg_stat_statements: một query 0,2 ms gọi 50 triệu lần/ngày tốn nhiều hơn một báo cáo 30 giây chạy 1 lần.</p></div>
  `,

  codeTabs: [
    { id: "n1", label: "① N+1 → ANY($1)", lines: [
      "// ❌ N+1: một query cho mỗi đơn",
      "for o in &orders {",
      "    let items = sqlx::query_as::<_, Item>(\"SELECT * FROM order_items WHERE order_id = $1\")",
      "        .bind(o.id).fetch_all(&pool).await?;",
      "}",
      "",
      "// ✅ một round-trip, truyền mảng id",
      "let ids: Vec<i64> = orders.iter().map(|o| o.id).collect();",
      "let items = sqlx::query_as::<_, Item>(",
      "    \"SELECT * FROM order_items WHERE order_id = ANY($1)\")",
      "    .bind(&ids).fetch_all(&pool).await?;"
    ]},
    { id: "keyset", label: "② Keyset pagination", lines: [
      "CREATE INDEX orders_created_id_idx ON orders (created_at DESC, id DESC);",
      "",
      "-- ❌ trang 10.000: đọc rồi vứt 200.000 row",
      "SELECT id, total FROM orders ORDER BY created_at DESC, id DESC",
      "LIMIT 20 OFFSET 200000;",
      "",
      "-- ✅ con trỏ = (created_at, id) của row cuối trang trước",
      "SELECT id, total, created_at FROM orders",
      "WHERE (created_at, id) < ($1, $2)",
      "ORDER BY created_at DESC, id DESC LIMIT 20;"
    ]},
    { id: "rewrite", label: "③ Viết lại điều kiện", lines: [
      "-- ❌ bọc cột                             -- ✅ điều kiện khoảng",
      "WHERE date(created_at) = '2026-09-26'     WHERE created_at >= '2026-09-26' AND created_at < '2026-09-27'",
      "",
      "-- ❌ NOT IN (NULL làm kết quả rỗng)",
      "SELECT id FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);",
      "-- ✅ anti-join",
      "SELECT c.id FROM customers c",
      "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
      "",
      "-- OR khác cột → UNION",
      "SELECT id FROM users WHERE email = $1",
      "UNION",
      "SELECT id FROM users WHERE phone = $2;"
    ]},
    { id: "batch", label: "④ Ghi theo lô", lines: [
      "// ✅ 1 câu lệnh, 1 transaction, 1 lần fsync cho cả lô",
      "sqlx::query(",
      "    \"INSERT INTO prices (sku, price) SELECT * FROM UNNEST($1::text[], $2::numeric[]) \\",
      "     ON CONFLICT (sku) DO UPDATE SET price = EXCLUDED.price\")",
      "    .bind(&skus)",
      "    .bind(&prices)",
      "    .execute(&pool).await?;",
      "",
      "// Hàng triệu row: COPY (sqlx: PgConnection::copy_in_raw)",
      "// COPY prices (sku, price) FROM STDIN WITH (FORMAT csv)"
    ]},
    { id: "count", label: "⑤ count(*) thông minh", lines: [
      "-- 'Có hơn 1000 kết quả không?' — dừng sớm",
      "SELECT count(*) FROM (",
      "  SELECT 1 FROM orders WHERE status = 'PENDING' LIMIT 1001",
      ") t;",
      "",
      "-- tổng xấp xỉ toàn bảng, tức thì",
      "SELECT reltuples::bigint FROM pg_class WHERE oid = 'orders'::regclass;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m"><div class="nl">📈 pg_stat_statements</div><div class="ns">query nào tốn tổng thời gian nhất</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="e"><div class="nl">🔬 EXPLAIN (ANALYZE, BUFFERS)</div><div class="ns">node nào đắt, ước lượng lệch?</div></div>
    <div class="arrow" id="a2">↓ nhận diện mẫu</div>
    <div class="row">
      <div class="node" id="p1"><div class="nl">N+1</div><div class="ns">→ ANY / JOIN</div></div>
      <div class="node" id="p2"><div class="nl">OFFSET</div><div class="ns">→ keyset</div></div>
      <div class="node" id="p3"><div class="nl">Bọc cột / OR / NOT IN</div><div class="ns">→ viết lại</div></div>
      <div class="node" id="p4"><div class="nl">Ghi lẻ</div><div class="ns">→ UNNEST / COPY</div></div>
    </div>
    <div class="arrow" id="a3">↓ đo lại</div>
    <div class="node" id="v"><div class="nl">✅ So trước/sau</div><div class="ns">mean_exec_time, calls, buffers</div></div>
  `,
  steps: [
    { title: "1 · N+1", tab: "n1", highlight: [2, 3, 8, 10, 11], on: ["m", "a1", "p1"],
      desc: "100 đơn = 101 round-trip. Truyền mảng id vào <code>ANY($1)</code> để thành 2 query cố định." },
    { title: "2 · Keyset pagination", tab: "keyset", highlight: [1, 5, 9, 10], on: ["e", "p2"],
      desc: "Row-value comparison <code>(created_at, id) &lt; ($1, $2)</code> khớp index (created_at DESC, id DESC) → mỗi trang chỉ đọc ~20 entry." },
    { title: "3 · Viết lại điều kiện", tab: "rewrite", highlight: [2, 5, 7, 8, 11, 12, 13], on: ["a2", "p3"],
      desc: "Điều kiện khoảng thay cho bọc cột; NOT EXISTS thay NOT IN; UNION thay OR khác cột." },
    { title: "4 · Ghi theo lô", tab: "batch", highlight: [3, 4, 5, 6, 10], on: ["p4"],
      desc: "UNNEST biến hai mảng thành các row; một câu lệnh chèn/cập nhật cả lô. Lượng rất lớn thì COPY." },
    { title: "5 · Đếm cho đủ dùng", tab: "count", highlight: [3, 7], on: ["e"],
      desc: "Giao diện hiếm khi cần con số chính xác tuyệt đối trên hàng chục triệu row." },
    { title: "6 · Đo lại", tab: "keyset", highlight: [8, 9, 10], on: ["a3", "v"],
      desc: "Mỗi thay đổi phải có số liệu trước/sau. Reset thống kê bằng <code>pg_stat_statements_reset()</code> nếu cần so sạch." }
  ],

  quiz: [
    { q: "Vì sao LIMIT 20 OFFSET 200000 chậm?", options: [
        "Vì LIMIT không dùng index",
        "Vì vẫn phải sinh và bỏ đi 200.000 row đầu",
        "Vì OFFSET khoá bảng",
        "Vì sort luôn ra đĩa"
      ], correct: 1, explanation: "Keyset pagination tránh được việc này." },
    { q: "Điều kiện keyset đúng cho ORDER BY created_at DESC, id DESC?", options: [
        "WHERE created_at < $1",
        "WHERE (created_at, id) < ($1, $2)",
        "WHERE id > $2",
        "WHERE created_at < $1 AND id < $2"
      ], correct: 1, explanation: "So sánh bộ hai giá trị xử lý đúng các row trùng created_at; cách AND riêng lẻ bỏ sót row." },
    { q: "Cách sửa N+1 khi đã có danh sách 100 order id trong Rust?", options: [
        "Gọi song song 100 query",
        "Một query WHERE order_id = ANY($1) bind Vec<i64>",
        "Tăng max_connections",
        "Dùng OFFSET"
      ], correct: 1, explanation: "Một round-trip, planner chọn được Index Scan hoặc Hash Join." },
    { q: "Vì sao NOT IN (subquery) nguy hiểm?", options: [
        "Không nguy hiểm",
        "Nếu subquery trả về NULL, điều kiện không bao giờ đúng → kết quả rỗng; và khó tối ưu thành anti-join",
        "NOT IN không hỗ trợ subquery",
        "NOT IN khoá bảng"
      ], correct: 1, explanation: "x NOT IN (1, NULL) là NULL, không phải true." },
    { q: "WHERE date(created_at) = '2026-09-26' với index trên created_at?", options: [
        "Dùng index tốt",
        "Không dùng được index thường; viết lại thành khoảng [ngày, ngày+1)",
        "Chỉ dùng được với BRIN",
        "Phải dùng GIN"
      ], correct: 1, explanation: "Hoặc expression index, nhưng viết khoảng là cách đơn giản nhất." },
    { q: "Chèn 10.000 row mỗi row một transaction có vấn đề gì chính?", options: [
        "Không có vấn đề",
        "Mỗi commit là một lần fsync WAL và một round-trip — rất chậm so với chèn theo lô",
        "Sinh deadlock",
        "Bị lỗi unique"
      ], correct: 1, explanation: "Gom lô bằng UNNEST/multi-row VALUES hoặc COPY." },
    { q: "INSERT ... ON CONFLICT (sku) DO UPDATE SET price = EXCLUDED.price làm gì?", options: [
        "Bỏ qua row trùng",
        "Upsert: trùng sku thì cập nhật price bằng giá trị đang định chèn",
        "Xoá row cũ",
        "Báo lỗi khi trùng"
      ], correct: 1, explanation: "EXCLUDED là row bị từ chối do xung đột. Cần unique index/constraint trên sku." },
    { q: "UI cần hiện 'hơn 1000 kết quả'. Cách hiệu quả?", options: [
        "SELECT count(*) toàn bộ",
        "Đếm trên subquery LIMIT 1001",
        "Tải hết về app rồi đếm",
        "Dùng OFFSET 1000"
      ], correct: 1, explanation: "Dừng ngay khi đủ 1001 row." },
    { q: "Theo pg_stat_statements, query nào nên tối ưu trước?", options: [
        "Query có mean_exec_time lớn nhất bất kể số lần gọi",
        "Query có tổng thời gian (total_exec_time) lớn nhất, thường là query nhanh nhưng gọi cực nhiều",
        "Query mới nhất",
        "Query dài nhất về số ký tự"
      ], correct: 1, explanation: "Tổng tải = mean × calls." }
  ]
});
