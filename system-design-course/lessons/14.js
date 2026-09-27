window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Hiệu năng & scale",
  title: "Partitioning & sharding",
  subtitle: "Partition trong 1 node vs shard nhiều node · chọn shard key · hash vs range · hot key · resharding · mỗi DB làm thế nào",

  theory: `
    <p>Khi một node DB không còn đủ (ghi quá nhiều, dữ liệu quá lớn), ta chia dữ liệu. Hai mức khác nhau hay bị nhầm:</p>
    <ul>
      <li><strong>Partitioning</strong> (trong 1 node): chia một bảng lớn thành nhiều bảng con, vd Postgres <code>PARTITION BY RANGE (created_at)</code> theo tháng.
        Lợi: truy vấn theo thời gian chỉ quét partition liên quan (partition pruning), xoá dữ liệu cũ bằng <code>DROP</code> partition thay vì <code>DELETE</code> hàng triệu dòng.</li>
      <li><strong>Sharding</strong> (nhiều node): mỗi node giữ một phần dữ liệu. Tăng được cả dung lượng lẫn thông lượng ghi. Đổi lại: truy vấn xuyên shard, transaction xuyên shard, và di chuyển dữ liệu khi thêm node.</li>
    </ul>
    <p>Trước khi shard: đã tối ưu index/truy vấn chưa? read replica? cache? tách dữ liệu analytics sang ClickHouse chưa? Sharding là bước <em>cuối</em> vì độ phức tạp vận hành rất lớn.</p>

    <p><strong>Shard key là quyết định quan trọng nhất</strong> — gần như không đổi được về sau. Tiêu chí:</p>
    <ol>
      <li><strong>Truy vấn chính chạm 1 shard</strong>: lịch sử đơn luôn lọc theo khách → shard theo <code>customer_id</code>. Shard theo <code>order_id</code> thì "đơn của tôi" phải hỏi mọi shard (scatter-gather).</li>
      <li><strong>Phân bố đều</strong>: cardinality cao, không lệch. Shard theo <code>country</code> → 90% dữ liệu vào shard VN.</li>
      <li><strong>Không có hot key</strong>: một đối tác lớn/một người nổi tiếng chiếm phần lớn traffic → một shard quá tải. Giải: tách riêng key nóng, hoặc thêm hậu tố ngẫu nhiên (key salting) rồi gộp khi đọc.</li>
    </ol>

    <table>
      <tr><th>Cách chia</th><th>Ưu</th><th>Nhược</th></tr>
      <tr><td>Range (theo khoảng giá trị/thời gian)</td><td>Truy vấn khoảng hiệu quả</td><td>Ghi dồn vào khoảng mới nhất (hot partition theo thời gian)</td></tr>
      <tr><td>Hash (hash(key) mod N)</td><td>Phân bố đều</td><td>Mất truy vấn khoảng; đổi N làm gần như mọi key đổi chỗ</td></tr>
      <tr><td>Consistent hashing / slot cố định</td><td>Thêm node chỉ di chuyển một phần nhỏ</td><td>Phức tạp hơn; cần bảng ánh xạ</td></tr>
    </table>

    <p><strong>Công ty bạn đã dùng sharding ở khắp nơi, dù không gọi tên</strong>:</p>
    <ul>
      <li><strong>Kafka</strong>: partition = shard của topic, key = shard key. Tăng partition làm đổi ánh xạ key → partition (mất thứ tự tạm thời cho key).</li>
      <li><strong>Redis Cluster</strong>: 16 384 hash slot, <code>CRC16(key) mod 16384</code>. Lệnh nhiều khoá chỉ chạy khi các khoá cùng slot → dùng hash tag <code>{user:42}</code>.</li>
      <li><strong>Elasticsearch</strong>: số primary shard đặt lúc tạo index, đổi phải reindex/split → dùng alias + index theo thời gian.</li>
      <li><strong>MongoDB</strong>: shard key cho collection (hashed hoặc ranged), mongos định tuyến.</li>
      <li><strong>ClickHouse</strong>: <code>PARTITION BY</code> (thường theo tháng) trong một node + bảng <code>Distributed</code> trải trên nhiều shard.</li>
    </ul>

    <div class="callout"><p>💡 Nhờ database-per-service, mỗi service đã là một "shard theo chức năng" — thường đủ cho rất lâu. Khi phải shard Postgres, cân nhắc Citus
    hoặc shard ở tầng ứng dụng theo <code>tenant_id</code>/<code>customer_id</code>, dùng <em>nhiều shard logic</em> (vd 256) ánh xạ vào ít node vật lý để sau này chỉ cần dời shard logic, không phải băm lại toàn bộ.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "① Postgres partition", lines: [
      "CREATE TABLE events (",
      "  id bigint, user_id bigint, type text, created_at timestamptz NOT NULL, payload jsonb",
      ") PARTITION BY RANGE (created_at);",
      "",
      "CREATE TABLE events_2026_09 PARTITION OF events",
      "  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');",
      "",
      "-- truy vấn chỉ quét events_2026_09 (partition pruning)",
      "SELECT count(*) FROM events WHERE created_at >= '2026-09-20';",
      "",
      "-- xoá dữ liệu cũ: tức thì, không bloat",
      "DROP TABLE events_2025_09;"
    ]},
    { id: "route", label: "② Shard ở tầng ứng dụng", lines: [
      "const LOGICAL_SHARDS: u32 = 256;",
      "",
      "fn logical_shard(customer_id: &str) -> u32 {",
      "    (xxhash64(customer_id.as_bytes()) % LOGICAL_SHARDS as u64) as u32",
      "}",
      "",
      "// bảng ánh xạ shard logic -> node vật lý (lưu ở config/DB điều phối)",
      "// 0..=127 -> pg-a ; 128..=255 -> pg-b",
      "// Thêm pg-c: chỉ dời 192..=255 sang pg-c, không băm lại mọi khách",
      "fn pool_for(&self, customer_id: &str) -> &PgPool {",
      "    &self.nodes[self.map[logical_shard(customer_id) as usize]]",
      "}"
    ]},
    { id: "key", label: "③ Chọn shard key", lines: [
      "Truy vấn chính: 'lịch sử đơn của khách X'  (95% traffic)",
      "",
      "shard theo customer_id : 1 shard / truy vấn            ✓",
      "shard theo order_id    : hỏi MỌI shard rồi gộp         ✗ (scatter-gather)",
      "shard theo country     : 90% vào shard VN              ✗ (lệch)",
      "shard theo created_at  : mọi ghi mới vào shard cuối    ✗ (hot)",
      "",
      "Hot key: khách B2B 'shop_big' chiếm 30% đơn",
      "  -> tách riêng shard cho shop_big, hoặc salting: shop_big#0..#7"
    ]},
    { id: "others", label: "④ Ở Redis / ES / ClickHouse", lines: [
      "# Redis Cluster: MGET chỉ chạy khi các khoá cùng slot",
      "MGET cart:{u42} profile:{u42}         # hash tag {u42} -> cùng slot ✓",
      "",
      "# Elasticsearch: số shard cố định lúc tạo index",
      "PUT orders-2026.09 { \"settings\": { \"number_of_shards\": 3, \"number_of_replicas\": 1 } }",
      "",
      "-- ClickHouse: partition theo tháng + phân tán theo user",
      "CREATE TABLE events_local ON CLUSTER main (...) ENGINE = ReplicatedMergeTree",
      "PARTITION BY toYYYYMM(ts) ORDER BY (user_id, ts);",
      "CREATE TABLE events ON CLUSTER main AS events_local",
      "ENGINE = Distributed(main, analytics, events_local, cityHash64(user_id));"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🦀 order-service</div><div class="ns">router: customer_id → shard logic</div></div>
    <div class="arrow" id="a1">↓ hash % 256 → bảng ánh xạ</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">🐘 pg-a</div><div class="ns">shard 0–127</div></div>
      <div class="node" id="s2"><div class="nl">🐘 pg-b</div><div class="ns">shard 128–191</div></div>
      <div class="node" id="s3"><div class="nl">🐘 pg-c (mới)</div><div class="ns">shard 192–255</div></div>
    </div>
    <div class="arrow" id="a2">↓ trong mỗi node</div>
    <div class="node" id="part"><div class="nl">📅 partition theo tháng</div><div class="ns">pruning · DROP partition cũ</div></div>
  `,
  steps: [
    { title: "1 · Partition trong một node", tab: "pg", highlight: [3, 5, 6, 9, 12], on: ["part"],
      desc: "Chưa cần nhiều máy: pruning giúp truy vấn theo thời gian nhanh, DROP partition dọn dữ liệu cũ tức thì." },
    { title: "2 · Chọn shard key theo truy vấn chính", tab: "key", highlight: [1, 3, 4, 5, 6], on: ["app"],
      desc: "Truy vấn phổ biến nhất phải chạm đúng 1 shard; phân bố phải đều; không ghi dồn." },
    { title: "3 · Hot key", tab: "key", highlight: [8, 9], on: ["s1"],
      desc: "Một khoá quá lớn làm một shard quá tải dù hash đều. Tách riêng hoặc salting." },
    { title: "4 · Shard logic → node vật lý", tab: "route", highlight: [1, 4, 8, 9, 11], on: ["a1", "s1", "s2", "s3"],
      desc: "256 shard logic cố định; thêm node chỉ dời một nhóm shard, không băm lại mọi khoá như hash % N." },
    { title: "5 · Bạn đã dùng sharding hằng ngày", tab: "others", highlight: [2, 5, 9, 11], on: ["a2"],
      desc: "Hash tag Redis, số shard ES, PARTITION BY + Distributed của ClickHouse đều là cùng một ý tưởng." }
  ],

  quiz: [
    { q: "Khác nhau giữa partitioning (Postgres declarative) và sharding?", options: [
        "Không khác",
        "Partitioning chia bảng trong một node; sharding chia dữ liệu ra nhiều node",
        "Sharding chỉ dùng cho Redis",
        "Partitioning cần nhiều máy"
      ], correct: 1, explanation: "Sharding tăng được cả dung lượng lẫn thông lượng ghi, nhưng phức tạp hơn nhiều." },
    { q: "Truy vấn chính là 'đơn của khách X'. Shard key tốt nhất?", options: [
        "order_id", "customer_id", "country", "created_at"
      ], correct: 1, explanation: "Truy vấn chạm đúng một shard." },
    { q: "Vì sao shard theo created_at thường gây vấn đề?", options: [
        "Không lưu được thời gian",
        "Mọi ghi mới dồn vào shard mới nhất (hot shard)",
        "Không sắp xếp được",
        "Postgres không hỗ trợ"
      ], correct: 1, explanation: "Range theo thời gian hợp cho partition trong node, không hợp làm shard key ghi." },
    { q: "Nhược điểm của hash(key) mod N khi thêm node?", options: [
        "Không có",
        "Gần như mọi khoá đổi vị trí → phải di chuyển gần toàn bộ dữ liệu",
        "Không thêm node được",
        "Chỉ chậm đọc"
      ], correct: 1, explanation: "Consistent hashing hoặc shard logic cố định khắc phục." },
    { q: "Redis Cluster: MGET cart:u42 profile:u42 báo lỗi CROSSSLOT. Sửa thế nào?", options: [
        "Tắt cluster",
        "Dùng hash tag: cart:{u42}, profile:{u42} để cùng slot",
        "Đổi sang GET từng khoá trong transaction MULTI",
        "Tăng số slot"
      ], correct: 1, explanation: "Chỉ phần trong {} được băm." },
    { q: "Số primary shard của một index Elasticsearch…", options: [
        "Đổi tự do bất kỳ lúc nào",
        "Đặt lúc tạo index; đổi cần reindex/split/shrink",
        "Luôn là 1",
        "Tự tăng theo dữ liệu"
      ], correct: 1, explanation: "Vì vậy hay dùng index theo thời gian + alias." },
    { q: "Hot key là gì và xử lý thế nào?", options: [
        "Khoá bị lộ; đổi mật khẩu",
        "Một khoá chiếm phần lớn traffic làm một shard quá tải; tách riêng hoặc salting",
        "Khoá hết hạn; tăng TTL",
        "Khoá trùng; thêm unique"
      ], correct: 1, explanation: "Hash đều không cứu được một khoá quá lớn." },
    { q: "Trước khi sharding Postgres, nên thử gì?", options: [
        "Không cần thử gì",
        "Tối ưu index/truy vấn, read replica, cache, đẩy analytics sang ClickHouse, partition theo thời gian",
        "Đổi sang MySQL",
        "Tăng max_connections lên 10 000"
      ], correct: 1, explanation: "Sharding là bước cuối vì chi phí vận hành cao." },
    { q: "Tăng số partition của một Kafka topic đang chạy ảnh hưởng gì?", options: [
        "Không ảnh hưởng",
        "Ánh xạ key → partition thay đổi, event mới của một key có thể vào partition khác (mất thứ tự tạm thời)",
        "Mất dữ liệu cũ",
        "Consumer group bị xoá"
      ], correct: 1, explanation: "Chọn đủ partition ngay từ đầu." }
  ]
});
