window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Truy vấn",
  title: "JOIN & dictionary: làm giàu dữ liệu mà không nổ RAM",
  subtitle: "hash join dựng bảng phải trong RAM · chọn thuật toán · dictionary + dictGet · denormalize khi ingest",

  theory: `
    <p>ClickHouse JOIN được, nhưng mô hình chi phí khác Postgres. Thuật toán mặc định là <strong>hash join</strong>:
    bảng <em>bên phải</em> được đọc hết và dựng thành hash table <strong>trong RAM</strong>, rồi bảng bên trái stream qua để dò.</p>

    <ul>
      <li>Truyền thống: đặt bảng <strong>nhỏ ở bên phải</strong>. Bản mới (từ 24.12) optimizer có thể tự đổi bên dựa trên ước lượng kích thước, nhưng đừng dựa hoàn toàn.</li>
      <li>Lọc/chọn cột bảng phải trong subquery trước khi JOIN để hash table nhỏ.</li>
      <li>Không có index nested-loop như Postgres; JOIN hai bảng lớn là tốn kém.</li>
    </ul>

    <table>
      <tr><th><code>join_algorithm</code></th><th>Khi nào</th></tr>
      <tr><td><code>hash</code> / <code>parallel_hash</code></td><td>Mặc định, nhanh nhất khi bảng phải vừa RAM</td></tr>
      <tr><td><code>grace_hash</code></td><td>Bảng phải lớn: chia bucket, tràn xuống đĩa</td></tr>
      <tr><td><code>full_sorting_merge</code> / <code>partial_merge</code></td><td>Hai bên đã sort theo khoá join, hoặc cần ít RAM</td></tr>
      <tr><td><code>direct</code></td><td>Bên phải là dictionary hoặc bảng key-value (EmbeddedRocksDB): tra từng khoá</td></tr>
    </table>

    <p><strong>Dictionary</strong> — cách chuẩn để làm giàu dữ liệu với bảng tham chiếu (tên sản phẩm, thông tin tenant, mã quốc gia):</p>
    <ul>
      <li>Nạp dữ liệu từ nguồn (bảng ClickHouse, <strong>PostgreSQL</strong>, MySQL, MongoDB, HTTP, file…) vào RAM theo layout (<code>FLAT</code>, <code>HASHED</code>, <code>COMPLEX_KEY_HASHED</code>, <code>RANGE_HASHED</code>…).</li>
      <li>Tự làm mới theo <code>LIFETIME(MIN .. MAX ..)</code> giây.</li>
      <li>Tra bằng <code>dictGet('dict', 'cột', khoá)</code> — O(1), không dựng hash table mỗi query.</li>
      <li>Chấp nhận dữ liệu "trễ" tới LIFETIME; không hợp với dữ liệu tham chiếu khổng lồ.</li>
    </ul>

    <p><strong>Denormalize khi ingest</strong>: gắn sẵn thuộc tính hiếm đổi (tên kênh, loại tenant) vào event trong MV bằng dictGet. Query sau đó không cần JOIN.
    Đánh đổi: thuộc tính đổi sau này thì dữ liệu cũ giữ giá trị cũ (thường đó lại là điều bạn muốn cho báo cáo lịch sử).</p>

    <p>Trên cluster, JOIN với bảng Distributed bên phải cần <code>GLOBAL JOIN</code> (bài 20) để tránh mỗi shard tự đọc toàn bộ bảng phải.</p>

    <div class="callout"><p>💡 Tư duy JPA "entity liên kết, @ManyToOne rồi fetch join" không mang sang được. Ở ClickHouse: bảng sự kiện rộng (đã denormalize) + dictionary cho tham chiếu + JOIN chỉ khi thật cần.</p></div>
  `,

  codeTabs: [
    { id: "join", label: "① JOIN đúng cách", lines: [
      "SELECT o.channel, p.category, sum(o.amount) AS revenue",
      "FROM order_items AS o                 -- bảng lớn: bên trái",
      "INNER JOIN",
      "(",
      "    SELECT product_id, category         -- chỉ cột cần",
      "    FROM products WHERE active = 1      -- lọc trước",
      ") AS p ON p.product_id = o.product_id  -- bảng nhỏ: bên phải",
      "WHERE o.created_at >= today() - 30",
      "GROUP BY o.channel, p.category",
      "SETTINGS join_algorithm = 'parallel_hash';"
    ]},
    { id: "dict", label: "② Dictionary từ Postgres", lines: [
      "CREATE DICTIONARY tenants_dict",
      "(",
      "    tenant_id  UInt64,",
      "    name       String,",
      "    plan       String DEFAULT 'free'",
      ")",
      "PRIMARY KEY tenant_id",
      "SOURCE(POSTGRESQL(host 'pg-tenant' port 5432 user 'ch_ro'",
      "                  password '...' db 'tenant' table 'tenants'))",
      "LAYOUT(HASHED())",
      "LIFETIME(MIN 300 MAX 600);          -- làm mới mỗi 5–10 phút"
    ]},
    { id: "use", label: "③ dictGet", lines: [
      "SELECT dictGet('tenants_dict', 'plan', toUInt64(tenant_id)) AS plan,",
      "       count() AS orders",
      "FROM orders",
      "GROUP BY plan;",
      "",
      "-- hoặc JOIN thẳng với dictionary (thuật toán direct)",
      "SELECT o.order_id, d.name",
      "FROM orders AS o JOIN tenants_dict AS d ON d.tenant_id = o.tenant_id",
      "LIMIT 10;"
    ]},
    { id: "denorm", label: "④ Denormalize trong MV", lines: [
      "CREATE MATERIALIZED VIEW orders_mv TO orders AS",
      "SELECT q.*,",
      "       dictGet('tenants_dict', 'plan', toUInt64(q.tenant_id)) AS tenant_plan",
      "FROM orders_queue AS q;",
      "",
      "SELECT name, status, element_count, formatReadableSize(bytes_allocated)",
      "FROM system.dictionaries;"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="left"><div class="nl">📦 order_items (tỷ hàng)</div><div class="ns">bên trái, stream qua</div></div>
      <div class="node" id="right"><div class="nl">📦 products (nhỏ)</div><div class="ns">bên phải → hash table RAM</div></div>
    </div>
    <div class="arrow" id="a1">↓ hash join</div>
    <div class="node" id="res"><div class="nl">📊 doanh thu theo category</div></div>
    <div class="arrow" id="a2">↓ tham chiếu từ Postgres</div>
    <div class="node" id="dict"><div class="nl">📖 tenants_dict (RAM)</div><div class="ns">nạp lại mỗi 5–10 phút</div></div>
    <div class="arrow" id="a3">↓ dictGet khi ingest</div>
    <div class="node" id="wide"><div class="nl">📦 orders có tenant_plan</div><div class="ns">query không cần JOIN</div></div>
  `,
  steps: [
    { title: "1 · Bảng phải vào RAM", tab: "join", highlight: [2, 5, 6, 7], on: ["left", "right"],
      desc: "Hash join đọc hết bên phải để dựng hash table. Chỉ lấy cột cần và lọc trước để nó nhỏ." },
    { title: "2 · Chọn thuật toán", tab: "join", highlight: [10], on: ["a1", "res"],
      desc: "parallel_hash cho bảng phải vừa RAM; grace_hash hoặc full_sorting_merge khi lớn." },
    { title: "3 · Dictionary từ Postgres", tab: "dict", highlight: [7, 8, 10, 11], on: ["a2", "dict"],
      desc: "Dữ liệu tenant nằm ở DB của service tenant; ClickHouse kéo về RAM và tự làm mới theo LIFETIME." },
    { title: "4 · Tra bằng dictGet", tab: "use", highlight: [1, 8], on: ["dict"],
      desc: "dictGet tra O(1). JOIN với dictionary dùng thuật toán direct, không dựng hash table mỗi query." },
    { title: "5 · Denormalize lúc ingest", tab: "denorm", highlight: [3, 6, 7], on: ["a3", "wide"],
      desc: "Gắn sẵn thuộc tính vào dữ liệu khi ghi; query báo cáo không cần JOIN. Theo dõi dictionary ở system.dictionaries." }
  ],

  quiz: [
    { q: "Với hash join mặc định, bảng nào được dựng thành hash table trong RAM?", options: [
        "Bảng bên trái", "Bảng bên phải", "Cả hai", "Bảng lớn hơn, luôn luôn"
      ], correct: 1, explanation: "Vì vậy truyền thống đặt bảng nhỏ bên phải; bản mới có thể tự đổi bên." },
    { q: "Cách giảm RAM khi JOIN với bảng tham chiếu?", options: [
        "Dùng SELECT * cho bảng phải",
        "Lọc và chỉ chọn cột cần trong subquery bảng phải",
        "Tăng max_threads",
        "Bỏ WHERE"
      ], correct: 1, explanation: "Hash table chỉ chứa những gì bạn đưa vào." },
    { q: "join_algorithm nào phù hợp khi bảng phải quá lớn so với RAM?", options: [
        "hash", "grace_hash (hoặc full_sorting_merge)", "direct", "parallel_hash"
      ], correct: 1, explanation: "grace_hash chia bucket và tràn xuống đĩa." },
    { q: "Dictionary trong ClickHouse là gì?", options: [
        "Bảng MergeTree đặc biệt",
        "Dữ liệu tham chiếu nạp vào RAM từ nguồn (CH, Postgres, HTTP…), tra bằng dictGet, tự làm mới theo LIFETIME",
        "Từ điển nén LowCardinality",
        "Danh sách từ khoá SQL"
      ], correct: 1, explanation: "Công cụ chuẩn để làm giàu dữ liệu." },
    { q: "LIFETIME(MIN 300 MAX 600) nghĩa là?", options: [
        "Dictionary hết hạn sau 300–600 ngày",
        "Tự nạp lại sau một khoảng ngẫu nhiên 300–600 giây",
        "Giữ 300–600 bản ghi",
        "Timeout kết nối"
      ], correct: 1, explanation: "Khoảng ngẫu nhiên tránh mọi server nạp lại cùng lúc." },
    { q: "Nhược điểm của dictionary?", options: [
        "Tra cứu chậm",
        "Dữ liệu có thể cũ tới LIFETIME và phải vừa RAM",
        "Không dùng được với Postgres",
        "Không dùng được trong MV"
      ], correct: 1, explanation: "Hợp với dữ liệu tham chiếu vừa phải, đổi chậm." },
    { q: "Denormalize khi ingest (dictGet trong MV) có đánh đổi gì?", options: [
        "Không đánh đổi",
        "Thuộc tính đổi sau này thì hàng cũ giữ giá trị cũ",
        "Không thể GROUP BY cột đó",
        "Làm hỏng Kafka offset"
      ], correct: 1, explanation: "Với báo cáo lịch sử, đó thường là hành vi mong muốn." },
    { q: "JOIN bảng Distributed bên phải trên cluster nên dùng gì?", options: [
        "LEFT JOIN", "GLOBAL JOIN", "CROSS JOIN", "ASOF JOIN"
      ], correct: 1, explanation: "GLOBAL đọc bảng phải một lần rồi gửi cho mọi shard." },
    { q: "Theo dõi dictionary đã nạp chưa, tốn bao nhiêu RAM ở đâu?", options: [
        "system.dictionaries", "system.parts", "system.merges", "system.kafka_consumers"
      ], correct: 0, explanation: "Có status, element_count, bytes_allocated, lỗi nạp gần nhất." }
  ]
});
