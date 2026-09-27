window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "MVCC & VACUUM",
  title: "HOT update & fillfactor — vì sao index nhiều làm UPDATE chậm",
  subtitle: "Heap-Only Tuple · page pruning · n_tup_hot_upd · chừa chỗ trống trong trang",

  theory: `
    <p>Bài 03: UPDATE tạo một phiên bản tuple mới ở vị trí mới (ctid mới). Vậy các index trỏ tới bản cũ thì sao? Cách "ngây thơ": <strong>mỗi index</strong> phải thêm một entry mới trỏ tới ctid mới — bảng có 6 index thì một UPDATE đổi mỗi cột <code>status</code> cũng sinh 6 lần ghi index + 6 lần WAL. Đây là nguồn gốc của "write amplification" trong PostgreSQL.</p>

    <p><strong>HOT (Heap-Only Tuple)</strong> tránh việc đó khi thoả <em>cả hai</em> điều kiện:</p>
    <ol>
      <li>UPDATE <strong>không đổi cột nào có trong index</strong> (kể cả cột trong index biểu thức, partial index, INCLUDE). Từ PG 16, cột chỉ nằm trong index BRIN không phá HOT.</li>
      <li>Trang chứa bản cũ còn <strong>đủ chỗ trống</strong> cho bản mới.</li>
    </ol>
    <p>Khi đó bản mới nằm cùng trang, không có entry index mới. Index vẫn trỏ tới bản cũ (line pointer gốc); khi đọc, PostgreSQL đi theo <strong>HOT chain</strong> trong trang để tìm bản đang nhìn thấy được.</p>

    <p><strong>Page pruning</strong>: khi một backend đọc trang gần đầy, nó có thể tự dọn các phiên bản HOT đã chết (không còn snapshot nào cần) và thu hồi chỗ ngay trong trang — không cần chờ VACUUM. Line pointer gốc được chuyển thành "redirect" trỏ tới bản sống.</p>

    <p><strong>fillfactor</strong> (mặc định 100 cho bảng): khi INSERT, chỉ lấp trang tới x%. Đặt 80–90 cho bảng UPDATE nhiều để chừa chỗ cho bản HOT. Chỉ áp dụng cho trang ghi mới sau khi đổi (dữ liệu cũ cần rewrite, vd <code>VACUUM FULL</code>/<code>pg_repack</code>, nếu muốn áp ngay).</p>

    <table>
      <tr><th>Tình huống</th><th>HOT?</th></tr>
      <tr><td><code>UPDATE orders SET status='PAID'</code>, không index trên status, trang còn chỗ</td><td>✅</td></tr>
      <tr><td>Như trên nhưng có <code>CREATE INDEX ON orders(status)</code></td><td>❌ đổi cột có index</td></tr>
      <tr><td><code>SET updated_at = now()</code> và có index trên updated_at</td><td>❌ — lỗi rất hay gặp</td></tr>
      <tr><td>Trang đầy (fillfactor 100, bảng vừa bulk load)</td><td>❌ bản mới sang trang khác</td></tr>
    </table>

    <div class="callout"><p>💡 Trước khi thêm index "cho chắc", hãy nhớ: mỗi index là thêm chi phí cho <em>mọi</em> INSERT, thêm chi phí cho UPDATE không-HOT, và có thể <strong>biến</strong> UPDATE đang HOT thành không-HOT. Đo bằng tỉ lệ <code>n_tup_hot_upd / n_tup_upd</code>.</p></div>
  `,

  codeTabs: [
    { id: "setup", label: "① Thử nghiệm", lines: [
      "CREATE TABLE orders (",
      "  id bigint PRIMARY KEY,",
      "  customer_id bigint NOT NULL,",
      "  status text NOT NULL,",
      "  updated_at timestamptz NOT NULL DEFAULT now()",
      ") WITH (fillfactor = 90);",
      "CREATE INDEX ON orders (customer_id);",
      "",
      "UPDATE orders SET status = 'PAID', updated_at = now() WHERE id = 42;  -- HOT được",
      "",
      "CREATE INDEX ON orders (updated_at);",
      "UPDATE orders SET status = 'SHIPPED', updated_at = now() WHERE id = 42; -- hết HOT"
    ]},
    { id: "stat", label: "② Đo tỉ lệ HOT", lines: [
      "SELECT relname, n_tup_upd, n_tup_hot_upd,",
      "       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 1) AS hot_pct,",
      "       n_tup_newpage_upd                -- PG 16+: bản mới phải sang trang khác",
      "FROM pg_stat_user_tables",
      "ORDER BY n_tup_upd DESC LIMIT 10;",
      "",
      "--  relname | n_tup_upd | n_tup_hot_upd | hot_pct",
      "--  orders  |   9120331 |       1204112 |    13.2   <- thấp: kiểm tra index & fillfactor"
    ]},
    { id: "page", label: "③ Nhìn trong trang", lines: [
      "SELECT lp, lp_flags, t_xmin, t_xmax, t_ctid,",
      "       (t_infomask2 & 16384) > 0 AS hot_updated,   -- HEAP_HOT_UPDATED",
      "       (t_infomask2 & 32768) > 0 AS heap_only      -- HEAP_ONLY_TUPLE",
      "FROM heap_page_items(get_raw_page('orders', 0));",
      "",
      "--  lp | t_xmin | t_xmax | t_ctid | hot_updated | heap_only",
      "--   1 |    900 |    901 | (0,5)  | t           | f        <- index trỏ vào đây",
      "--   5 |    901 |      0 | (0,5)  | f           | t        <- bản mới, không có entry index",
      "",
      "# sau page pruning: lp 1 thành REDIRECT → 5, dữ liệu bản cũ được thu hồi"
    ]},
    { id: "fix", label: "④ Sửa khi HOT thấp", lines: [
      "-- 1. Bỏ index không ai dùng (bài 22: idx_scan = 0)",
      "DROP INDEX CONCURRENTLY orders_updated_at_idx;",
      "",
      "-- 2. Chừa chỗ trong trang cho bảng update nhiều",
      "ALTER TABLE orders SET (fillfactor = 85);",
      "-- chỉ áp cho trang mới; muốn áp ngay cần rewrite (pg_repack)",
      "",
      "-- 3. Tách cột 'nóng' hay đổi sang bảng riêng",
      "CREATE TABLE order_counters (order_id bigint PRIMARY KEY, view_count int);"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="idx"><div class="nl">🌲 Index (customer_id)</div><div class="ns">entry → (0,1)</div></div>
      <div class="node" id="idx2"><div class="nl">🌲 Index (updated_at)</div><div class="ns">nếu tồn tại: phải thêm entry mới</div></div>
    </div>
    <div class="arrow" id="a1">↓ trỏ vào line pointer 1</div>
    <div class="node" id="p"><div class="nl">📄 Trang 0 (fillfactor 90)</div><div class="ns">lp1: bản cũ → lp5: bản mới (HOT chain)</div></div>
    <div class="arrow" id="a2">↓ page pruning</div>
    <div class="node" id="pr"><div class="nl">🧹 lp1 = REDIRECT → lp5</div><div class="ns">chỗ của bản cũ được thu hồi, không cần VACUUM</div></div>
  `,
  steps: [
    { title: "1 · Bảng có chừa chỗ", tab: "setup", highlight: [6, 7], on: ["p", "idx"],
      desc: "<code>fillfactor = 90</code>: INSERT chỉ lấp 90% trang, 10% dành cho phiên bản mới của UPDATE." },
    { title: "2 · UPDATE HOT", tab: "setup", highlight: [9], on: ["p", "a1"],
      desc: "status và updated_at không có index → bản mới nằm cùng trang, index customer_id không bị chạm tới." },
    { title: "3 · HOT chain trong trang", tab: "page", highlight: [7, 8], on: ["p"],
      desc: "Index vẫn trỏ lp1. Đọc qua index → tới lp1 → đi theo t_ctid tới lp5 (heap-only)." },
    { title: "4 · Page pruning", tab: "page", highlight: [10], on: ["a2", "pr"],
      desc: "Khi bản cũ không còn ai cần, backend nào đọc trang cũng có thể dọn nó, giữ lp1 làm redirect." },
    { title: "5 · Thêm index → mất HOT", tab: "setup", highlight: [11, 12], on: ["idx2"],
      desc: "Giờ updated_at có index; mỗi UPDATE đổi updated_at phải thêm entry vào <em>mọi</em> index của bảng." },
    { title: "6 · Đo và sửa", tab: "stat", highlight: [1, 2, 3, 8], on: ["idx", "idx2", "p"],
      desc: "Tỉ lệ HOT thấp trên bảng update nhiều → xem lại index thừa, fillfactor, hoặc tách cột nóng." }
  ],

  quiz: [
    { q: "Điều kiện để một UPDATE là HOT?", options: [
        "Bảng không có index nào",
        "Không đổi cột nào có trong index và trang hiện tại còn đủ chỗ cho bản mới",
        "UPDATE chỉ một row",
        "Chạy trong REPEATABLE READ"
      ], correct: 1, explanation: "Cả hai điều kiện đều cần." },
    { q: "Lợi ích chính của HOT update?", options: [
        "Không sinh WAL",
        "Không phải thêm entry mới vào các index, bản cũ có thể được dọn ngay bằng page pruning",
        "Không tạo phiên bản mới",
        "Không cần lock"
      ], correct: 1, explanation: "Vẫn tạo phiên bản mới (MVCC), nhưng tránh được ghi index." },
    { q: "Bảng orders có index trên updated_at, mọi UPDATE đều SET updated_at = now(). Hệ quả?", options: [
        "Không ảnh hưởng",
        "Không UPDATE nào là HOT; mỗi UPDATE ghi thêm vào mọi index",
        "Index updated_at tự bị bỏ qua",
        "UPDATE bị lỗi"
      ], correct: 1, explanation: "Cân nhắc có thật cần index đó không." },
    { q: "fillfactor = 85 trên bảng nghĩa là gì?", options: [
        "Chỉ cho 85% row được UPDATE",
        "INSERT chỉ lấp tới 85% mỗi trang, chừa 15% cho phiên bản UPDATE",
        "Index chiếm 85% dung lượng",
        "Autovacuum chạy khi bảng đầy 85%"
      ], correct: 1, explanation: "Mặc định bảng là 100 (index B-tree mặc định 90)." },
    { q: "Đổi fillfactor bằng ALTER TABLE có áp dụng ngay cho dữ liệu đang có không?", options: [
        "Có, lập tức",
        "Không, chỉ ảnh hưởng trang ghi sau này; cần rewrite bảng để áp cho dữ liệu cũ",
        "Có nhưng phải restart server",
        "Chỉ áp cho index"
      ], correct: 1, explanation: "VACUUM FULL/pg_repack/CLUSTER sẽ rewrite theo fillfactor mới." },
    { q: "Cột nào trong pg_stat_user_tables cho biết số UPDATE là HOT?", options: [
        "n_dead_tup", "n_tup_hot_upd", "idx_scan", "n_live_tup"
      ], correct: 1, explanation: "So với n_tup_upd để ra tỉ lệ." },
    { q: "Page pruning là gì?", options: [
        "VACUUM FULL cho một trang",
        "Backend thường tự dọn phiên bản chết (đặc biệt HOT chain) trong trang khi truy cập, không cần chờ VACUUM",
        "Xoá trang khỏi shared buffers",
        "Nén trang"
      ], correct: 1, explanation: "Nó thu hồi chỗ trong trang; VACUUM vẫn cần để dọn entry index và cập nhật visibility map/free space map." },
    { q: "Từ PG 16, thay đổi cột chỉ nằm trong loại index nào không phá HOT?", options: [
        "B-tree", "GIN", "BRIN", "Hash"
      ], correct: 2, explanation: "BRIN là 'summarizing index' — tóm tắt theo khối trang, không trỏ tới từng tuple." },
    { q: "Khi HOT, index trỏ tới đâu?", options: [
        "Trực tiếp tới bản mới nhất",
        "Tới line pointer gốc; từ đó đi theo HOT chain trong trang",
        "Không trỏ đâu",
        "Tới WAL"
      ], correct: 1, explanation: "Đó là lý do không cần sửa index." }
  ]
});
