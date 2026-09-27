window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Index chuyên sâu",
  title: "B-tree sâu: cấu trúc, index nhiều cột, thứ tự cột & sort",
  subtitle: "Root → internal → leaf · quy tắc tiền tố trái · ORDER BY dùng index · dedup",

  theory: `
    <p>90% index bạn tạo là B-tree (mặc định của <code>CREATE INDEX</code>). Hiểu hình dạng của nó giúp trả lời được ngay "index này có dùng được cho query kia không".</p>

    <p><strong>Cấu trúc</strong> (biến thể Lehman–Yao): cây cân bằng các trang 8 KB. <em>Leaf page</em> chứa các cặp (key, TID trỏ vào heap), <strong>đã sắp xếp</strong>, và nối với nhau bằng con trỏ trái/phải. <em>Internal page</em> chứa key phân cách để đi xuống. Mỗi trang chứa vài trăm key → cây 1 tỉ row thường chỉ cao 3–4 tầng. Tìm 1 key = đọc ~4 trang index + 1 trang heap.</p>

    <p><strong>B-tree hỗ trợ</strong>: <code>=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>BETWEEN</code>, <code>IN</code>, <code>IS NULL</code>, <code>LIKE 'abc%'</code> (khi collation C hoặc dùng opclass <code>text_pattern_ops</code>), và trả kết quả <strong>theo thứ tự</strong> → dùng được cho <code>ORDER BY ... LIMIT</code> mà không cần sort.</p>

    <p><strong>Index nhiều cột (a, b, c)</strong> sắp xếp theo a, trong cùng a theo b, rồi c. Giống danh bạ sắp theo (họ, tên):</p>
    <table>
      <tr><th>Điều kiện</th><th>Dùng hiệu quả?</th></tr>
      <tr><td><code>a = 1</code></td><td>✅</td></tr>
      <tr><td><code>a = 1 AND b = 2</code></td><td>✅</td></tr>
      <tr><td><code>a = 1 AND b &gt; 2 AND c = 3</code></td><td>✅ cho a, b; c chỉ lọc trong phạm vi đã quét</td></tr>
      <tr><td><code>b = 2</code> (không có a)</td><td>❌ thường không (quét toàn index); PG 18 có <strong>skip scan</strong> giúp được khi a ít giá trị khác nhau</td></tr>
      <tr><td><code>a = 1 ORDER BY b</code></td><td>✅ không cần Sort</td></tr>
      <tr><td><code>ORDER BY a, b DESC</code></td><td>❌ trừ khi index khai báo <code>(a, b DESC)</code></td></tr>
    </table>
    <p><strong>Quy tắc chọn thứ tự cột</strong>: cột so sánh <em>bằng</em> đứng trước, cột <em>khoảng</em>/sort đứng sau. Cột có độ chọn lọc cao đứng trước chỉ là quy tắc phụ.</p>

    <p><strong>Những điều nên biết thêm</strong></p>
    <ul>
      <li><strong>Deduplication</strong> (PG 13+): key trùng lặp lưu một lần + danh sách TID → index cột ít giá trị nhỏ đi nhiều.</li>
      <li>Index B-tree <strong>không lưu thông tin visibility</strong> — vẫn phải kiểm tra heap (trừ index-only scan, bài 08).</li>
      <li>Index cũng bị bloat; <code>REINDEX INDEX CONCURRENTLY</code> (PG 12+) dựng lại không chặn ghi.</li>
      <li>Hàm bọc cột (<code>lower(email)</code>, <code>created_at::date</code>) làm index thường vô dụng → cần expression index (bài 08).</li>
      <li>Kích thước key tối đa ~1/3 trang (~2700 byte) — đừng index cột text dài tuỳ ý.</li>
    </ul>

    <div class="callout"><p>💡 So với JPA: <code>@Index(columnList = "customer_id, created_at")</code> chỉ là khai báo; điều quan trọng là query của bạn có khớp <em>tiền tố trái</em> và thứ tự sort của nó không. Luôn kiểm bằng EXPLAIN (bài 10).</p></div>
  `,

  codeTabs: [
    { id: "idx", label: "① Index nhiều cột", lines: [
      "CREATE INDEX orders_cust_created_idx",
      "    ON orders (customer_id, created_at DESC);",
      "",
      "-- ✅ bằng trên cột đầu, sort theo cột sau: không cần Sort node",
      "SELECT id, total FROM orders",
      "WHERE customer_id = 42",
      "ORDER BY created_at DESC LIMIT 20;",
      "",
      "-- ❌ thiếu cột đầu: thường không dùng được hiệu quả",
      "SELECT count(*) FROM orders WHERE created_at > now() - interval '1 day';"
    ]},
    { id: "plan", label: "② EXPLAIN chứng minh", lines: [
      "EXPLAIN SELECT id, total FROM orders",
      "WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;",
      "",
      " Limit  (cost=0.43..24.12 rows=20 width=16)",
      "   ->  Index Scan using orders_cust_created_idx on orders",
      "         Index Cond: (customer_id = 42)",
      "",
      "# Không có node 'Sort' — index đã trả đúng thứ tự",
      "# Đảo thành (created_at, customer_id) → cần quét rộng + lọc hoặc Sort"
    ]},
    { id: "shape", label: "③ Soi hình dạng cây", lines: [
      "CREATE EXTENSION pageinspect;",
      "SELECT * FROM bt_metap('orders_pkey');",
      "--  root | level | ...",
      "--   412 |     2 |          <- cây 3 tầng (level 0 là leaf)",
      "",
      "SELECT pg_size_pretty(pg_relation_size('orders_pkey'));",
      "",
      "-- dựng lại index bị bloat, không chặn ghi",
      "REINDEX INDEX CONCURRENTLY orders_cust_created_idx;"
    ]},
    { id: "java", label: "④ JPA ↔ sqlx", lines: [
      "// Spring Data: phương thức dẫn xuất sinh đúng query này",
      "List<Order> findTop20ByCustomerIdOrderByCreatedAtDesc(Long customerId);",
      "",
      "// Rust sqlx: viết thẳng SQL, kiểm tra lúc compile với query_as!",
      "let rows = sqlx::query_as!(OrderRow,",
      "    \"SELECT id, total FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20\",",
      "    customer_id)",
      "    .fetch_all(&pool).await?;",
      "// Cả hai đều chỉ nhanh khi có index (customer_id, created_at DESC)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="root"><div class="nl">🌳 Root page</div><div class="ns">key phân cách: 1000 · 2000 · …</div></div>
    <div class="arrow" id="a1">↓ đi xuống theo key</div>
    <div class="node" id="inner"><div class="nl">🌿 Internal page</div><div class="ns">(42, 2026-09-01) · (42, 2026-06-01) · …</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="leaf1"><div class="nl">🍃 Leaf</div><div class="ns">(42, 09-26)→TID · (42, 09-25)→TID…</div></div>
      <div class="node" id="leaf2"><div class="nl">🍃 Leaf kế bên</div><div class="ns">nối bằng con trỏ phải</div></div>
    </div>
    <div class="arrow" id="a3">↓ TID</div>
    <div class="node" id="heap"><div class="nl">📦 Heap</div><div class="ns">đọc tuple, kiểm tra visibility</div></div>
  `,
  steps: [
    { title: "1 · Khai báo index", tab: "idx", highlight: [1, 2], on: ["root", "inner", "leaf1"],
      desc: "Leaf sắp theo customer_id, trong cùng khách thì theo created_at giảm dần." },
    { title: "2 · Đi xuống cây", tab: "idx", highlight: [6], on: ["root", "a1", "inner", "a2"],
      desc: "Từ root theo key <code>customer_id = 42</code> xuống leaf đầu tiên của khách 42. Chỉ 3–4 trang." },
    { title: "3 · Đọc tuần tự trên leaf", tab: "plan", highlight: [4, 5, 6, 8], on: ["leaf1", "leaf2"],
      desc: "Các entry của khách 42 nằm liền nhau và đã đúng thứ tự DESC → đọc 20 cái đầu rồi dừng. Không Sort." },
    { title: "4 · Tra heap", tab: "plan", highlight: [5], on: ["a3", "heap"],
      desc: "Mỗi TID → đọc tuple trong heap để lấy total và kiểm tra visibility MVCC." },
    { title: "5 · Khi index không giúp", tab: "idx", highlight: [9, 10], on: ["root"],
      desc: "Lọc chỉ theo created_at: các entry thoả điều kiện rải khắp mọi nhánh customer_id → không khai thác được thứ tự." },
    { title: "6 · Bảo trì", tab: "shape", highlight: [4, 9], on: ["root", "leaf1"],
      desc: "Cây nông kể cả với bảng rất lớn. Index phình sau nhiều UPDATE/DELETE → REINDEX CONCURRENTLY." }
  ],

  quiz: [
    { q: "Index (customer_id, created_at). Query nào tận dụng tốt nhất?", options: [
        "WHERE created_at > '2026-01-01'",
        "WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20",
        "WHERE total > 100",
        "ORDER BY created_at LIMIT 10 (không lọc customer)"
      ], correct: 1, explanation: "Bằng trên cột đầu, sort theo cột thứ hai — khớp đúng thứ tự trong index." },
    { q: "Quy tắc thứ tự cột phổ biến cho index nhiều cột?", options: [
        "Cột khoảng (>, <) trước, cột bằng sau",
        "Cột so sánh bằng trước, cột khoảng/sort sau",
        "Cột có kiểu text trước",
        "Thứ tự không quan trọng"
      ], correct: 1, explanation: "Sau cột khoảng đầu tiên, các cột sau chỉ còn dùng để lọc, không để thu hẹp phạm vi quét." },
    { q: "Leaf page của B-tree chứa gì?", options: [
        "Toàn bộ row",
        "Key đã sắp xếp + TID trỏ về heap, và nối với leaf kế bên",
        "Chỉ bitmap",
        "Bản ghi WAL"
      ], correct: 1, explanation: "Liên kết giữa các leaf giúp quét khoảng/sort hiệu quả." },
    { q: "Vì sao B-tree trên bảng 1 tỉ row vẫn tra cứu nhanh?", options: [
        "Vì nằm hết trong RAM",
        "Vì mỗi trang chứa hàng trăm key nên cây chỉ cao 3–4 tầng",
        "Vì dùng hash",
        "Vì dùng nhiều CPU"
      ], correct: 1, explanation: "Độ cao tăng theo log cơ số vài trăm." },
    { q: "Index (a, b ASC). Query ORDER BY a ASC, b DESC thì sao?", options: [
        "Dùng index đọc ngược là được",
        "Không khớp thứ tự hỗn hợp; cần index (a, b DESC) (hoặc (a DESC, b ASC)) để tránh Sort",
        "Luôn tự khớp",
        "Lỗi cú pháp"
      ], correct: 1, explanation: "Đọc ngược index chỉ cho (a DESC, b DESC)." },
    { q: "WHERE lower(email) = 'a@x.com' với index trên email (thường)?", options: [
        "Dùng index bình thường",
        "Không dùng được; cần expression index trên lower(email)",
        "Dùng được nếu email UNIQUE",
        "Dùng được với LIMIT"
      ], correct: 1, explanation: "Index lưu giá trị email, không lưu lower(email)." },
    { q: "Deduplication trong B-tree (PG 13+) giúp gì?", options: [
        "Loại row trùng khỏi bảng",
        "Lưu key trùng một lần kèm danh sách TID → index nhỏ hơn với cột ít giá trị khác nhau",
        "Tăng độ cao cây",
        "Cấm giá trị trùng"
      ], correct: 1, explanation: "Không liên quan UNIQUE constraint." },
    { q: "Cách dựng lại index bị bloat mà không chặn ghi (PG 12+)?", options: [
        "VACUUM FULL",
        "REINDEX INDEX CONCURRENTLY",
        "DROP rồi CREATE INDEX thường",
        "ANALYZE"
      ], correct: 1, explanation: "CREATE INDEX thường giữ khoá SHARE chặn INSERT/UPDATE/DELETE." },
    { q: "Tính năng nào của PG 18 giúp index (a, b) phục vụ được WHERE b = ? khi a có ít giá trị?", options: [
        "BRIN", "Skip scan", "Parallel seq scan", "JIT"
      ], correct: 1, explanation: "Skip scan nhảy qua từng giá trị a rồi tìm b; hiệu quả khi số giá trị a nhỏ." }
  ]
});
