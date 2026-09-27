window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Nền tảng lưu trữ",
  title: "Các loại index — mỗi loại trả lời một kiểu câu hỏi",
  subtitle: "B-tree · hash · GIN/inverted · bitmap · BRIN · sparse & skip index · composite & covering",

  theory: `
    <p>Index là <strong>bản sao dữ liệu được sắp xếp theo cách khác</strong> để trả lời một kiểu câu hỏi nhanh hơn. Mỗi index làm chậm ghi (phải cập nhật thêm)
    và tốn chỗ. Chọn index = chọn kiểu câu hỏi bạn muốn trả lời rẻ.</p>

    <table>
      <tr><th>Loại</th><th>Trả lời tốt</th><th>Ở đâu</th></tr>
      <tr><td><strong>B-tree</strong></td><td><code>=</code>, <code>&lt;</code>, <code>BETWEEN</code>, <code>ORDER BY</code>, tiền tố <code>LIKE 'abc%'</code></td><td>Mặc định PostgreSQL, MongoDB, MySQL</td></tr>
      <tr><td><strong>Hash</strong></td><td>Chỉ <code>=</code></td><td>PostgreSQL <code>USING hash</code>; bảng băm của Redis</td></tr>
      <tr><td><strong>GIN / inverted</strong></td><td>"Chứa phần tử X": jsonb <code>@&gt;</code>, mảng, full-text, trigram</td><td>PostgreSQL GIN; Elasticsearch (Lucene)</td></tr>
      <tr><td><strong>Bitmap</strong></td><td>Kết hợp nhiều điều kiện AND/OR trên cột ít giá trị</td><td>PostgreSQL dựng bitmap lúc chạy (Bitmap Index Scan); Oracle có bitmap index lưu sẵn</td></tr>
      <tr><td><strong>BRIN</strong></td><td>Cột tương quan với thứ tự vật lý (timestamp của bảng chỉ thêm)</td><td>PostgreSQL: lưu min/max cho mỗi dải 128 page</td></tr>
      <tr><td><strong>Sparse primary index</strong></td><td>Khoảng theo khoá sắp xếp của bảng</td><td>ClickHouse: 1 mục cho mỗi granule 8192 dòng</td></tr>
      <tr><td><strong>Skip index</strong></td><td>Bỏ qua khối chắc chắn không khớp</td><td>ClickHouse <code>minmax</code>, <code>set</code>, <code>bloom_filter</code></td></tr>
    </table>

    <p><strong>Dense vs sparse</strong>: B-tree của PostgreSQL là <em>dense</em> — mỗi dòng một mục. ClickHouse dữ liệu đã sắp theo <code>ORDER BY</code> nên chỉ cần
    <em>sparse</em> index — một mục cho mỗi 8192 dòng — nhỏ tới mức luôn nằm trong RAM, nhưng chỉ chỉ ra "khối nào có thể chứa", không trỏ tới dòng cụ thể.</p>

    <p><strong>Composite index &amp; quy tắc tiền tố trái</strong>: index <code>(user_id, created_at)</code> được sắp theo user_id trước rồi created_at. Nó phục vụ
    <code>WHERE user_id = ?</code> và <code>WHERE user_id = ? ORDER BY created_at</code>, nhưng <em>không</em> phục vụ tốt <code>WHERE created_at &gt; ?</code> một mình.
    MongoDB gọi thứ tự nên đặt là <strong>ESR</strong>: Equality → Sort → Range.</p>

    <p><strong>Covering index / index-only scan</strong>: nếu index chứa đủ cột truy vấn cần (PostgreSQL <code>INCLUDE (...)</code>), DB khỏi phải ra heap.
    Ở PostgreSQL còn cần <em>visibility map</em> đánh dấu page "mọi tuple đều thấy được" — bảng chưa VACUUM thì index-only scan vẫn phải ghé heap.</p>

    <p><strong>Khi nào index vô dụng</strong></p>
    <ul>
      <li>Điều kiện khớp phần lớn bảng (vd <code>status = 'DONE'</code> chiếm 95%): đọc tuần tự rẻ hơn nhảy qua index.</li>
      <li>Bọc cột trong hàm: <code>WHERE lower(email) = ?</code> cần index biểu thức <code>(lower(email))</code>.</li>
      <li><code>LIKE '%abc'</code>: B-tree bó tay, cần trigram GIN hoặc search engine.</li>
    </ul>

    <div class="callout"><p>💡 Mỗi index là thêm một cấu trúc phải cập nhật khi INSERT/UPDATE. Bảng có 12 index thì mỗi insert là 13 lần ghi (và ở PostgreSQL, UPDATE không-HOT
    phải thêm mục vào mọi index). Hãy xoá index không ai dùng: <code>pg_stat_user_indexes.idx_scan = 0</code>.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "PostgreSQL", lines: [
      "CREATE INDEX ON orders (user_id, created_at);                 -- B-tree composite",
      "CREATE INDEX ON orders (lower(email));                        -- index biểu thức",
      "CREATE INDEX ON orders USING hash (tracking_code);            -- chỉ '='",
      "CREATE INDEX ON products USING gin (attrs jsonb_path_ops);    -- attrs @> '{\"color\":\"red\"}'",
      "CREATE INDEX ON events USING brin (created_at);               -- rất nhỏ, bảng chỉ thêm",
      "CREATE INDEX ON orders (user_id) INCLUDE (total, status);     -- covering",
      "CREATE INDEX ON orders (created_at) WHERE status = 'PENDING'; -- partial index",
      "",
      "-- tìm index không ai dùng",
      "SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0;"
    ]},
    { id: "bitmap", label: "Bitmap lúc chạy", lines: [
      "EXPLAIN SELECT * FROM orders WHERE status = 'PENDING' AND country = 'VN';",
      "",
      "Bitmap Heap Scan on orders",
      "  Recheck Cond: ((status = 'PENDING') AND (country = 'VN'))",
      "  ->  BitmapAnd",
      "        ->  Bitmap Index Scan on orders_status_idx",
      "        ->  Bitmap Index Scan on orders_country_idx",
      "",
      "# mỗi index cho ra bitmap các page khớp → AND hai bitmap → đọc heap theo thứ tự page"
    ]},
    { id: "ch", label: "ClickHouse", lines: [
      "CREATE TABLE events (",
      "    ts DateTime, user_id UInt64, country LowCardinality(String), url String,",
      "    INDEX url_bf url TYPE bloom_filter GRANULARITY 4        -- skip index",
      ") ENGINE = MergeTree",
      "ORDER BY (country, ts)                                     -- sparse primary index",
      "SETTINGS index_granularity = 8192;",
      "",
      "-- WHERE country = 'VN' AND ts > now() - INTERVAL 1 DAY",
      "--   → sparse index chọn vài granule, bỏ qua phần còn lại"
    ]},
    { id: "mongo", label: "MongoDB", lines: [
      "// ESR: Equality → Sort → Range",
      "db.orders.createIndex({ userId: 1, createdAt: -1, total: 1 })",
      "",
      "// phục vụ tốt:",
      "db.orders.find({ userId: 42, total: { $gt: 100 } }).sort({ createdAt: -1 })",
      "",
      "// multikey: field là mảng → mỗi phần tử một mục index",
      "db.products.createIndex({ tags: 1 })   // find({ tags: 'sale' })"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Kiểu câu hỏi</div><div class="ns">bằng? khoảng? chứa? nhiều điều kiện?</div></div>
    <div class="row">
      <div class="node" id="bt"><div class="nl">🌳 B-tree</div><div class="ns">= &lt; &gt; ORDER BY</div></div>
      <div class="node" id="gin"><div class="nl">🔁 GIN / inverted</div><div class="ns">chứa phần tử</div></div>
      <div class="node" id="bm"><div class="nl">🟩 Bitmap</div><div class="ns">AND/OR nhiều index</div></div>
    </div>
    <div class="arrow" id="a1">↓ dữ liệu đã có thứ tự vật lý?</div>
    <div class="row">
      <div class="node" id="brin"><div class="nl">📦 BRIN</div><div class="ns">min/max mỗi dải page</div></div>
      <div class="node" id="sparse"><div class="nl">🪜 Sparse + skip</div><div class="ns">ClickHouse granule</div></div>
    </div>
  `,
  steps: [
    { title: "1 · B-tree: mặc định đa năng", tab: "pg", highlight: [1, 2], on: ["q", "bt"],
      desc: "Composite theo quy tắc tiền tố trái; index biểu thức khi WHERE bọc cột trong hàm." },
    { title: "2 · Hash, GIN, covering, partial", tab: "pg", highlight: [3, 4, 6, 7], on: ["gin"],
      desc: "GIN là inverted index: phần tử → danh sách dòng. Partial index chỉ index phần dòng hay truy vấn." },
    { title: "3 · Bitmap kết hợp nhiều index", tab: "bitmap", highlight: [3, 5, 6, 7, 9], on: ["bm"],
      desc: "PostgreSQL dựng bitmap page lúc chạy rồi AND/OR, sau đó đọc heap theo thứ tự page." },
    { title: "4 · BRIN cho bảng chỉ thêm", tab: "pg", highlight: [5], on: ["a1", "brin"],
      desc: "Chỉ lưu min/max cho mỗi dải page → index vài KB cho bảng hàng trăm GB, nhưng chỉ hiệu quả khi dữ liệu tương quan thứ tự vật lý." },
    { title: "5 · Sparse & skip index ở ClickHouse", tab: "ch", highlight: [3, 5, 6, 8, 9], on: ["sparse"],
      desc: "1 mục / 8192 dòng; skip index bloom_filter loại granule chắc chắn không chứa url cần tìm." },
    { title: "6 · MongoDB: ESR & multikey", tab: "mongo", highlight: [1, 2, 5, 8], on: ["bt"],
      desc: "Cùng B-tree, thứ tự field trong index quyết định có tránh được sort trong RAM không." },
    { title: "7 · Dọn index thừa", tab: "pg", highlight: [9, 10], on: ["q"],
      desc: "Index không ai dùng chỉ làm chậm ghi và tốn RAM." }
  ],

  quiz: [
    { q: "Index hash trong PostgreSQL hỗ trợ toán tử nào?", options: [
        "= , <, >", "Chỉ =", "LIKE", "@>"
      ], correct: 1, explanation: "Băm mất thứ tự nên không hỗ trợ khoảng hay ORDER BY." },
    { q: "GIN index hợp với truy vấn nào?", options: [
        "WHERE id = 5",
        "jsonb @> '{\"color\":\"red\"}', mảng chứa phần tử, full-text",
        "ORDER BY created_at",
        "WHERE price BETWEEN 1 AND 10"
      ], correct: 1, explanation: "GIN là inverted index: phần tử → các dòng chứa nó." },
    { q: "Index (user_id, created_at) phục vụ kém truy vấn nào?", options: [
        "WHERE user_id = 1",
        "WHERE user_id = 1 ORDER BY created_at",
        "WHERE created_at > '2026-01-01' (không có user_id)",
        "WHERE user_id = 1 AND created_at > '2026-01-01'"
      ], correct: 2, explanation: "Quy tắc tiền tố trái: cột đầu phải có điều kiện." },
    { q: "BRIN index hiệu quả khi nào?", options: [
        "Cột có giá trị ngẫu nhiên",
        "Giá trị cột tương quan với thứ tự vật lý (vd created_at của bảng chỉ thêm)",
        "Cột dạng jsonb",
        "Bảng rất nhỏ"
      ], correct: 1, explanation: "BRIN lưu min/max mỗi dải page; dữ liệu lộn xộn thì dải nào cũng 'có thể khớp'." },
    { q: "Sparse primary index của ClickHouse lưu gì?", options: [
        "Một mục cho mỗi dòng",
        "Một mục cho mỗi granule (mặc định 8192 dòng) theo khoá ORDER BY",
        "Hash của mọi cột",
        "Không lưu gì"
      ], correct: 1, explanation: "Nhỏ, luôn trong RAM, chỉ cho biết granule nào cần đọc." },
    { q: "Quy tắc ESR của MongoDB là?", options: [
        "Encrypt, Sign, Replicate",
        "Equality → Sort → Range khi xếp field trong compound index",
        "Error, Skip, Retry",
        "Embed, Split, Reference"
      ], correct: 1, explanation: "Giúp index vừa lọc vừa tránh sort trong bộ nhớ." },
    { q: "Vì sao index-only scan của PostgreSQL vẫn có thể phải ghé heap?", options: [
        "Index hỏng",
        "Page chưa được đánh dấu all-visible trong visibility map (chưa VACUUM), phải kiểm tra MVCC ở heap",
        "Do dùng hash",
        "Do thiếu RAM"
      ], correct: 1, explanation: "Index không chứa thông tin hiển thị MVCC (xmin/xmax)." },
    { q: "WHERE status = 'DONE' khớp 95% bảng. Planner thường chọn gì?", options: [
        "Index scan", "Seq scan — đọc tuần tự rẻ hơn nhảy qua index cho gần cả bảng", "Hash join", "Bỏ qua truy vấn"
      ], correct: 1, explanation: "Index có lợi khi lọc được phần nhỏ dữ liệu." },
    { q: "Chi phí ẩn của việc có nhiều index?", options: [
        "Không có",
        "Mỗi INSERT/UPDATE phải cập nhật thêm các index → ghi chậm, tốn RAM và đĩa",
        "Đọc chậm hơn",
        "Mất transaction"
      ], correct: 1, explanation: "Dọn index có idx_scan = 0." },
    { q: "Bitmap Index Scan + BitmapAnd trong PostgreSQL dùng để làm gì?", options: [
        "Nén bảng",
        "Kết hợp kết quả từ nhiều index rồi đọc heap theo thứ tự page",
        "Tạo index lưu sẵn trên đĩa",
        "Khoá bảng"
      ], correct: 1, explanation: "PostgreSQL không có bitmap index lưu sẵn; bitmap được dựng lúc chạy." }
  ]
});
