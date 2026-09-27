window.LESSONS.push({
  id: "19",
  phase: "4", phaseName: "Phân tán",
  title: "Partitioning & sharding — chia dữ liệu ra nhiều phần",
  subtitle: "Range vs hash · chọn shard key · hot spot · rebalancing · scatter-gather · mỗi DB chia thế nào",

  theory: `
    <p>Replication = cùng dữ liệu, nhiều bản. <strong>Sharding</strong> (partitioning ngang) = mỗi máy giữ <em>một phần</em> dữ liệu, để vượt giới hạn đĩa, RAM và
    thông lượng ghi của một máy. Thực tế hai thứ đi cùng nhau: mỗi shard lại có replica.</p>

    <p><strong>1. Chia theo cách nào</strong></p>
    <table>
      <tr><th></th><th>Range</th><th>Hash</th></tr>
      <tr><td>Cách</td><td>Khoảng giá trị khoá: A–F, G–M...; hoặc theo tháng</td><td>hash(key) → shard/slot</td></tr>
      <tr><td>Range query</td><td>Tốt: khoảng liên tiếp nằm ít shard</td><td>Kém: phải hỏi mọi shard</td></tr>
      <tr><td>Phân bố</td><td>Dễ lệch; khoá tăng dần (thời gian, id) dồn hết ghi vào shard cuối</td><td>Đều</td></tr>
      <tr><td>Ví dụ</td><td>PostgreSQL partition theo tháng, MongoDB ranged, ClickHouse PARTITION BY</td><td>Redis Cluster, Kafka, Elasticsearch, MongoDB hashed</td></tr>
    </table>

    <p><strong>2. Shard key — quyết định khó đổi nhất</strong></p>
    <ul>
      <li>Truy vấn chính nên chứa shard key để đi thẳng tới <em>một</em> shard. Truy vấn không có shard key → <strong>scatter-gather</strong>: hỏi mọi shard, gộp kết quả, chậm theo shard chậm nhất.</li>
      <li>Cardinality cao và phân bố đều, tránh <strong>hot spot</strong> (một tenant khổng lồ, một người nổi tiếng, khoá tăng dần với range).</li>
      <li>Dữ liệu cần transaction/JOIN với nhau nên nằm cùng shard (vd shard theo <code>tenant_id</code> thì đơn hàng và dòng hàng của tenant đi cùng nhau).</li>
    </ul>

    <p><strong>3. Rebalancing</strong>: thêm máy thì phải chuyển dữ liệu. <code>hash % N</code> ngây thơ làm gần như mọi khoá đổi chỗ khi N đổi. Giải pháp: chia thành
    <em>nhiều phần cố định</em> (slot/chunk/partition) nhiều hơn số máy rồi chỉ di chuyển nguyên phần — Redis Cluster có 16384 hash slot, Elasticsearch/Kafka có số shard/partition cố định,
    MongoDB tách/di chuyển chunk bằng balancer; hoặc consistent hashing.</p>

    <p><strong>4. Mỗi DB</strong></p>
    <ul>
      <li><strong>PostgreSQL</strong>: declarative partitioning (<code>PARTITION BY RANGE/LIST/HASH</code>) chia bảng <em>trong một máy</em> — lợi cho xoá dữ liệu cũ (DROP partition) và partition pruning. Sharding nhiều máy cần Citus hoặc tự chia ở tầng ứng dụng.</li>
      <li><strong>MongoDB</strong>: sharded cluster — <code>mongos</code> định tuyến theo shard key, dữ liệu chia chunk, balancer di chuyển chunk.</li>
      <li><strong>Elasticsearch</strong>: <code>shard = hash(_routing) % số primary shard</code> (routing mặc định là <code>_id</code>) — vì thế số primary shard cố định.</li>
      <li><strong>Kafka</strong>: partition = đơn vị chia tải và thứ tự (bài 17).</li>
      <li><strong>Redis Cluster</strong>: <code>CRC16(key) % 16384</code>; lệnh nhiều key phải cùng slot — dùng hash tag <code>{user:42}</code>.</li>
      <li><strong>ClickHouse</strong>: bảng <code>Distributed</code> trên các shard, sharding key quyết định INSERT đi đâu; truy vấn chạy song song mọi shard rồi gộp.</li>
    </ul>

    <div class="callout"><p>💡 Kiến trúc "mỗi service một DB" của công ty đã là một kiểu chia theo nghiệp vụ. Trước khi shard một DB, hãy chắc là đã thử: index đúng,
    partition theo thời gian + xoá dữ liệu cũ, replica đọc, cache. Sharding thêm độ phức tạp vĩnh viễn: truy vấn chéo shard, transaction chéo shard, backup, rebalancing.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "PostgreSQL partition", lines: [
      "CREATE TABLE events (",
      "    id bigint, tenant_id int, created_at timestamptz, payload jsonb",
      ") PARTITION BY RANGE (created_at);",
      "",
      "CREATE TABLE events_2026_09 PARTITION OF events",
      "    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');",
      "",
      "-- WHERE created_at >= '2026-09-20' → chỉ quét events_2026_09 (partition pruning)",
      "-- xoá dữ liệu cũ tức thì, không để lại dead tuple:",
      "DROP TABLE events_2025_09;"
    ]},
    { id: "mongo", label: "MongoDB sharding", lines: [
      "sh.shardCollection('shop.orders', { tenantId: 1, _id: 1 })",
      "",
      "// có shard key → mongos gửi tới 1 shard",
      "db.orders.find({ tenantId: 7, _id: id })",
      "",
      "// không có shard key → scatter-gather tới mọi shard",
      "db.orders.find({ status: 'PENDING' })",
      "",
      "// ❌ shard key { createdAt: 1 } dạng range → mọi insert dồn vào chunk cuối (hot spot)"
    ]},
    { id: "redis", label: "Redis Cluster slot", lines: [
      "slot = CRC16(key) mod 16384",
      "",
      "SET user:42:name An          # slot của 'user:42:name'",
      "SET user:42:cart ...         # slot khác → MGET 2 key này lỗi CROSSSLOT",
      "",
      "# hash tag: chỉ phần trong {} được băm → cùng slot",
      "SET {user:42}:name An",
      "SET {user:42}:cart ...",
      "MGET {user:42}:name {user:42}:cart   # OK",
      "",
      "# thêm node: chuyển một số slot sang node mới, không băm lại mọi key"
    ]},
    { id: "rehash", label: "hash % N vs slot cố định", lines: [
      "hash % N, N: 4 → 5 máy",
      "  key có hash 10: 10 % 4 = 2  →  10 % 5 = 0   (đổi chỗ)",
      "  key có hash 13: 13 % 4 = 1  →  13 % 5 = 3   (đổi chỗ)",
      "  → phần lớn khoá phải di chuyển",
      "",
      "slot cố định (vd 16384), gán slot → máy:",
      "  thêm máy thứ 5: lấy bớt ~1/5 số slot từ 4 máy cũ",
      "  → chỉ ~20% dữ liệu di chuyển, khoá không đổi slot"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Truy vấn</div><div class="ns">có shard key không?</div></div>
    <div class="arrow" id="a1">↓ router (mongos / client / coordinator)</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">🗂️ Shard 1</div><div class="ns">slot 0–5460</div></div>
      <div class="node" id="s2"><div class="nl">🗂️ Shard 2</div><div class="ns">slot 5461–10922</div></div>
      <div class="node" id="s3"><div class="nl">🗂️ Shard 3</div><div class="ns">slot 10923–16383</div></div>
    </div>
    <div class="arrow" id="a2">↓ không có shard key → hỏi tất cả, gộp</div>
    <div class="node" id="sg"><div class="nl">🧺 Scatter-gather</div><div class="ns">chậm theo shard chậm nhất</div></div>
    <div class="arrow" id="a3">↓ thêm máy</div>
    <div class="node" id="reb"><div class="nl">🚚 Rebalancing</div><div class="ns">chuyển slot/chunk, không băm lại tất cả</div></div>
  `,
  steps: [
    { title: "1 · Partition trong một máy", tab: "pg", highlight: [3, 5, 6, 8, 10], on: ["q"],
      desc: "Range theo thời gian: pruning khi truy vấn, DROP partition để xoá dữ liệu cũ tức thì." },
    { title: "2 · Có shard key → một shard", tab: "mongo", highlight: [1, 3, 4], on: ["a1", "s2"],
      desc: "Router biết chính xác shard nào giữ dữ liệu." },
    { title: "3 · Không có shard key → scatter-gather", tab: "mongo", highlight: [6, 7], on: ["s1", "s2", "s3", "a2", "sg"],
      desc: "Mọi shard đều phải làm việc; độ trễ = shard chậm nhất." },
    { title: "4 · Hot spot", tab: "mongo", highlight: [9], on: ["s3"],
      desc: "Range trên khoá tăng dần: mọi ghi dồn vào shard cuối." },
    { title: "5 · Slot & hash tag", tab: "redis", highlight: [1, 4, 7, 8, 9], on: ["s1", "s2", "s3"],
      desc: "Lệnh nhiều key phải cùng slot; hash tag gom các key liên quan." },
    { title: "6 · Rebalancing rẻ nhờ slot cố định", tab: "rehash", highlight: [1, 4, 6, 7, 8], on: ["a3", "reb"],
      desc: "hash % N làm gần hết khoá đổi chỗ; slot cố định chỉ di chuyển một phần." }
  ],

  quiz: [
    { q: "Sharding khác replication ở điểm nào?", options: [
        "Giống nhau",
        "Sharding chia dữ liệu thành phần trên các máy; replication giữ bản sao cùng dữ liệu",
        "Sharding chỉ dùng cho đọc",
        "Replication chia dữ liệu"
      ], correct: 1, explanation: "Thường dùng cả hai: mỗi shard có replica." },
    { q: "Nhược điểm của range sharding trên khoá tăng dần (thời gian)?", options: [
        "Range query chậm",
        "Mọi ghi mới dồn vào shard cuối (hot spot)",
        "Không lưu được",
        "Không có"
      ], correct: 1, explanation: "Hash sharding phân bố đều hơn." },
    { q: "Nhược điểm của hash sharding?", options: [
        "Phân bố không đều",
        "Range query theo khoá phải hỏi mọi shard",
        "Không hỗ trợ thêm máy",
        "Không có index"
      ], correct: 1, explanation: "Hash phá thứ tự khoá." },
    { q: "Scatter-gather xảy ra khi nào?", options: [
        "Truy vấn có shard key",
        "Truy vấn không chứa shard key nên phải gửi tới mọi shard rồi gộp",
        "Khi ghi",
        "Khi backup"
      ], correct: 1, explanation: "Độ trễ bị chi phối bởi shard chậm nhất." },
    { q: "Redis Cluster có bao nhiêu hash slot?", options: ["1024", "16384", "65536", "Tuỳ số node"], correct: 1,
      explanation: "slot = CRC16(key) mod 16384." },
    { q: "Hash tag {user:42} trong Redis Cluster dùng để?", options: [
        "Mã hoá key",
        "Chỉ băm phần trong ngoặc nhọn để các key liên quan nằm cùng slot",
        "Đặt TTL",
        "Đánh dấu key quan trọng"
      ], correct: 1, explanation: "Cho phép MGET/transaction/Lua trên nhiều key." },
    { q: "Vì sao dùng số slot/partition cố định thay vì hash % số máy?", options: [
        "Cho đẹp",
        "Thêm máy chỉ cần di chuyển một phần slot; hash % N làm gần hết khoá đổi chỗ",
        "Để mã hoá",
        "Không có lý do"
      ], correct: 1, explanation: "Cùng ý tưởng với consistent hashing." },
    { q: "Declarative partitioning của PostgreSQL chủ yếu giúp gì?", options: [
        "Tự sharding ra nhiều máy",
        "Chia bảng lớn trong một máy: partition pruning và xoá dữ liệu cũ bằng DROP partition",
        "Tăng isolation",
        "Thay thế index"
      ], correct: 1, explanation: "Sharding nhiều máy cần Citus hoặc tự chia." },
    { q: "Elasticsearch chọn shard cho document thế nào (mặc định)?", options: [
        "Ngẫu nhiên",
        "hash(_routing) % số primary shard, _routing mặc định là _id",
        "Theo thời gian",
        "Theo kích thước"
      ], correct: 1, explanation: "Nên số primary shard không đổi tuỳ ý được." },
    { q: "Tiêu chí tốt cho shard key?", options: [
        "Ít giá trị khác nhau",
        "Có trong truy vấn chính, cardinality cao, phân bố đều, gom dữ liệu hay dùng chung",
        "Luôn là timestamp",
        "Ngẫu nhiên hoàn toàn và không bao giờ truy vấn"
      ], correct: 1, explanation: "Ví dụ tenant_id kèm id cho hệ thống nhiều tenant." }
  ]
});
