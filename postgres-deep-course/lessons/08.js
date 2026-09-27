window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Index chuyên sâu",
  title: "Partial, expression, covering INCLUDE & index-only scan",
  subtitle: "Index nhỏ hơn, đúng query hơn · không cần đọc heap · visibility map · Heap Fetches",

  theory: `
    <p>B-tree thường là cái búa. Bài này là bộ tua-vít: bốn kỹ thuật giúp index <strong>nhỏ hơn</strong> và <strong>khớp query hơn</strong>.</p>

    <p><strong>1. Partial index</strong> — chỉ index một phần row thoả <code>WHERE</code>:</p>
    <ul>
      <li>Bảng 50 triệu đơn, chỉ 20 nghìn đơn <code>status = 'PENDING'</code> mà worker cần quét liên tục → <code>CREATE INDEX ... WHERE status = 'PENDING'</code> nhỏ hơn hàng nghìn lần.</li>
      <li>Unique có điều kiện: "mỗi user chỉ một địa chỉ mặc định", "email duy nhất trong số user chưa xoá mềm" → <code>CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL</code>. Đây là thứ <code>@Column(unique=true)</code> không diễn đạt được.</li>
      <li>Planner chỉ dùng khi chứng minh được điều kiện query <em>kéo theo</em> điều kiện index. Với prepared statement có tham số (<code>status = $1</code>) thì generic plan không dùng được partial index <code>WHERE status = 'PENDING'</code> — hãy viết hằng số vào SQL.</li>
    </ul>

    <p><strong>2. Expression index</strong> — index giá trị của biểu thức: <code>lower(email)</code>, <code>(payload-&gt;&gt;'type')</code>, <code>date_trunc('day', created_at)</code>. Query phải viết <em>đúng</em> biểu thức đó. Hàm phải là <code>IMMUTABLE</code> (vd <code>created_at::date</code> trên <code>timestamptz</code> không immutable vì phụ thuộc múi giờ).</p>

    <p><strong>3. Covering index với INCLUDE</strong> (PG 11+): thêm cột "đi kèm" vào leaf nhưng không vào key. Cột INCLUDE không tham gia sắp xếp/tìm kiếm, không bị ràng buộc UNIQUE, chỉ để query đọc được mà không cần tới heap.</p>

    <p><strong>4. Index-only scan</strong>: khi mọi cột query cần đều có trong index, PostgreSQL <em>có thể</em> trả kết quả không đọc heap. Nhưng index không biết tuple có visible với bạn không (bài 03). Lời giải là <strong>visibility map</strong>: 2 bit cho mỗi trang heap, bit all-visible = "mọi tuple trong trang này ai cũng thấy". Với mỗi entry:</p>
    <ol>
      <li>Trang heap tương ứng all-visible → dùng luôn giá trị trong index.</li>
      <li>Không → phải đọc heap để kiểm tra — hiện trong EXPLAIN là <code>Heap Fetches</code>.</li>
    </ol>
    <p>Chỉ VACUUM đặt bit all-visible; mọi thay đổi trên trang xoá bit đó. Bảng ghi nhiều mà VACUUM chậm → index-only scan có Heap Fetches cao, chẳng khác index scan thường.</p>

    <div class="callout"><p>💡 Trade-off: mỗi cột thêm vào index (key hay INCLUDE) là thêm dung lượng, thêm ghi, và có thể phá HOT (bài 04). Chỉ làm covering cho vài query nóng nhất đã đo bằng pg_stat_statements (bài 22).</p></div>
  `,

  codeTabs: [
    { id: "partial", label: "① Partial", lines: [
      "-- worker chỉ quét đơn chờ xử lý",
      "CREATE INDEX orders_pending_idx ON orders (created_at)",
      "    WHERE status = 'PENDING';",
      "",
      "SELECT id FROM orders",
      "WHERE status = 'PENDING' ORDER BY created_at LIMIT 100;   -- ✅ dùng được",
      "",
      "-- unique có điều kiện: email duy nhất trong user chưa xoá",
      "CREATE UNIQUE INDEX users_email_live_uq ON users (lower(email))",
      "    WHERE deleted_at IS NULL;"
    ]},
    { id: "expr", label: "② Expression", lines: [
      "CREATE INDEX users_email_lower_idx ON users (lower(email));",
      "SELECT * FROM users WHERE lower(email) = lower($1);          -- ✅",
      "SELECT * FROM users WHERE email ILIKE $1;                   -- ❌ khác biểu thức",
      "",
      "-- lọc theo ngày: đừng bọc cột, hãy viết điều kiện khoảng",
      "SELECT * FROM orders",
      "WHERE created_at >= '2026-09-01' AND created_at < '2026-09-02';  -- ✅ index thường",
      "",
      "-- ERROR: functions in index expression must be marked IMMUTABLE",
      "CREATE INDEX ON orders ((created_at::date));   -- created_at là timestamptz"
    ]},
    { id: "cover", label: "③ INCLUDE + index-only", lines: [
      "CREATE INDEX orders_cust_idx ON orders (customer_id, created_at DESC)",
      "    INCLUDE (status, total);",
      "",
      "EXPLAIN (ANALYZE, BUFFERS)",
      "SELECT created_at, status, total FROM orders",
      "WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;",
      "",
      " Index Only Scan using orders_cust_idx on orders (actual rows=20 loops=1)",
      "   Index Cond: (customer_id = 42)",
      "   Heap Fetches: 0",
      "   Buffers: shared hit=4"
    ]},
    { id: "vm", label: "④ Heap Fetches cao", lines: [
      "   Heap Fetches: 18342      <- trang heap chưa all-visible",
      "",
      "-- kiểm tra visibility map",
      "CREATE EXTENSION pg_visibility;",
      "SELECT count(*) FILTER (WHERE all_visible) AS vis, count(*) AS pages",
      "FROM pg_visibility_map('orders');",
      "",
      "-- chữa: VACUUM để đặt lại bit all-visible",
      "VACUUM orders;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔎 Query cần created_at, status, total</div><div class="ns">WHERE customer_id = 42</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="ix"><div class="nl">🌲 Leaf index</div><div class="ns">key (customer_id, created_at) + INCLUDE (status, total)</div></div>
    <div class="arrow" id="a2">↓ trang heap của TID này all-visible?</div>
    <div class="row">
      <div class="node" id="vm"><div class="nl">🗺️ Visibility map</div><div class="ns">✅ có → trả luôn</div></div>
      <div class="node" id="heap"><div class="nl">📦 Heap</div><div class="ns">❌ không → Heap Fetch</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Partial index nhỏ, trúng đích", tab: "partial", highlight: [2, 3, 6], on: ["ix"],
      desc: "Chỉ các đơn PENDING vào index. Worker đọc 100 đơn cũ nhất với vài trang index." },
    { title: "2 · Unique có điều kiện", tab: "partial", highlight: [9, 10], on: ["ix"],
      desc: "Ràng buộc chỉ áp cho row chưa xoá mềm, và không phân biệt hoa thường nhờ lower(email)." },
    { title: "3 · Expression phải khớp nguyên văn", tab: "expr", highlight: [1, 2, 3, 7, 10], on: ["q"],
      desc: "Viết đúng biểu thức đã index. Với lọc theo ngày, viết điều kiện khoảng trên cột gốc là cách tốt nhất." },
    { title: "4 · Covering index", tab: "cover", highlight: [1, 2, 5], on: ["q", "a1", "ix"],
      desc: "status và total nằm ở leaf (INCLUDE) → mọi cột query cần đều có trong index." },
    { title: "5 · Index-only scan", tab: "cover", highlight: [8, 10, 11], on: ["a2", "vm"],
      desc: "Heap Fetches: 0 — mọi trang heap liên quan đều all-visible, chỉ đọc 4 buffer." },
    { title: "6 · Khi visibility map không giúp", tab: "vm", highlight: [1, 5, 6, 9], on: ["heap"],
      desc: "Nhiều ghi gần đây làm mất bit all-visible → phải đọc heap. VACUUM đặt lại bit đó." }
  ],

  quiz: [
    { q: "Partial index phù hợp nhất khi nào?", options: [
        "Query lọc theo một tập con nhỏ, cố định của bảng (vd status = 'PENDING')",
        "Mọi query đều lọc toàn bảng",
        "Bảng rất nhỏ",
        "Cột có kiểu JSONB"
      ], correct: 0, explanation: "Index nhỏ, ghi ít hơn vì row ngoài điều kiện không cần cập nhật index." },
    { q: "Làm sao ép 'email duy nhất trong các user chưa bị xoá mềm'?", options: [
        "UNIQUE (email)",
        "CREATE UNIQUE INDEX ... (email) WHERE deleted_at IS NULL",
        "CHECK constraint",
        "Trigger là cách duy nhất"
      ], correct: 1, explanation: "Unique partial index." },
    { q: "Có index trên lower(email). Query nào dùng được?", options: [
        "WHERE email = $1",
        "WHERE lower(email) = lower($1)",
        "WHERE email ILIKE $1",
        "WHERE upper(email) = $1"
      ], correct: 1, explanation: "Biểu thức phải khớp." },
    { q: "Cột trong INCLUDE khác cột key thế nào?", options: [
        "Không có gì khác",
        "Chỉ lưu ở leaf để đọc, không tham gia sắp xếp/tìm kiếm và không bị ràng buộc UNIQUE",
        "Được mã hoá",
        "Được sắp giảm dần"
      ], correct: 1, explanation: "INCLUDE có từ PG 11." },
    { q: "Index-only scan vẫn phải đọc heap khi nào?", options: [
        "Không bao giờ",
        "Khi trang heap chứa tuple đó chưa được đánh dấu all-visible trong visibility map",
        "Khi có LIMIT",
        "Khi dùng ORDER BY"
      ], correct: 1, explanation: "Hiện ở dòng 'Heap Fetches' trong EXPLAIN ANALYZE." },
    { q: "Ai đặt bit all-visible trong visibility map?", options: [
        "INSERT", "VACUUM", "SELECT", "CHECKPOINT"
      ], correct: 1, explanation: "Mọi thay đổi trên trang sẽ xoá bit; VACUUM đặt lại." },
    { q: "Vì sao CREATE INDEX ON orders ((created_at::date)) lỗi khi created_at là timestamptz?", options: [
        "Vì thiếu dấu ngoặc",
        "Vì chuyển timestamptz sang date phụ thuộc múi giờ phiên → không IMMUTABLE",
        "Vì date không index được",
        "Vì phải dùng GIN"
      ], correct: 1, explanation: "Dùng điều kiện khoảng trên created_at, hoặc biểu thức cố định múi giờ như (created_at AT TIME ZONE 'UTC')::date." },
    { q: "Query có WHERE status = $1 (prepared, generic plan). Partial index WHERE status = 'PENDING' có được dùng?", options: [
        "Luôn luôn",
        "Không chắc — planner phải chứng minh được điều kiện; với tham số trong generic plan thì không",
        "Có nếu bảng nhỏ",
        "Có nếu dùng LIMIT"
      ], correct: 1, explanation: "Viết hằng 'PENDING' trực tiếp trong SQL cho các query cần partial index." },
    { q: "Nhược điểm của việc nhét nhiều cột vào INCLUDE?", options: [
        "Không có",
        "Index to hơn, ghi chậm hơn, và UPDATE các cột đó không còn HOT",
        "Query sai kết quả",
        "Không dùng được với UNIQUE"
      ], correct: 1, explanation: "Mọi cột trong index (key hay INCLUDE) đều tính là 'cột được index' với HOT." }
  ]
});
