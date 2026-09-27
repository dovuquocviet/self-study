window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "MergeTree sâu",
  title: "Partition: để quản lý dữ liệu, không phải để tăng tốc query",
  subtitle: "PARTITION BY toYYYYMM · pruning bằng minmax · DROP/DETACH/MOVE PARTITION · quá nhiều partition",

  theory: `
    <p><code>PARTITION BY</code> chia dữ liệu của bảng thành các nhóm độc lập. Mỗi part thuộc đúng một partition và <strong>merge không bao giờ gộp part khác partition</strong>.</p>

    <p><strong>Partition dùng để làm gì?</strong></p>
    <ul>
      <li><strong>Xoá dữ liệu cũ rẻ</strong>: <code>ALTER TABLE ... DROP PARTITION 202301</code> chỉ xoá thư mục, gần như tức thì — so với DELETE phải viết lại part.</li>
      <li><strong>Di chuyển/sao chép</strong>: <code>DETACH/ATTACH</code>, <code>MOVE PARTITION ... TO DISK/VOLUME</code>, <code>REPLACE PARTITION</code> (nạp lại một tháng dữ liệu một cách nguyên tử).</li>
      <li><strong>Pruning</strong>: mỗi part có <code>minmax_*.idx</code> cho các cột trong biểu thức partition, nên <code>WHERE ts &gt;= '2024-09-01'</code> bỏ qua part tháng cũ. Nhưng primary index thường đã làm tốt việc này.</li>
    </ul>

    <p><strong>Quy tắc chọn</strong></p>
    <ol>
      <li>Mặc định: <code>toYYYYMM(ts)</code> hoặc không partition. Dữ liệu nhỏ (vài chục GB) thì không cần partition.</li>
      <li>Số partition nên ở mức <strong>vài chục đến vài trăm</strong>, không phải nghìn.</li>
      <li><strong>Không</strong> partition theo cột cardinality cao (<code>user_id</code>, <code>tenant_id</code> có hàng nghìn giá trị): mỗi insert rải ra nhiều partition ⇒ nhiều part nhỏ ⇒ lỗi <code>Too many parts</code>.</li>
      <li>Giới hạn <code>max_partitions_per_insert_block</code> (mặc định 100): một INSERT chạm quá 100 partition sẽ bị từ chối (có setting <code>throw_on_max_partitions_per_insert_block</code> để chỉ cảnh báo). Đây là "cầu chì" nhắc bạn partition sai.</li>
    </ol>

    <div class="callout"><p>💡 Thói quen từ Postgres "partition theo tenant cho nhanh" gây hại ở ClickHouse. Muốn lọc nhanh theo tenant → đặt <code>tenant_id</code> đầu ORDER BY.
    Partition theo thời gian để <em>TTL/xoá</em> (bài 19) và di chuyển dữ liệu cũ sang đĩa rẻ.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① Partition tốt", lines: [
      "CREATE TABLE orders_analytics",
      "(",
      "    order_id   UInt64,",
      "    tenant_id  UInt32,",
      "    created_at DateTime,",
      "    amount     Decimal(18, 2)",
      ")",
      "ENGINE = MergeTree",
      "PARTITION BY toYYYYMM(created_at)      -- ~12 partition/năm",
      "ORDER BY (tenant_id, created_at);"
    ]},
    { id: "ops", label: "② Thao tác partition", lines: [
      "-- xoá cả tháng: tức thì, không viết lại dữ liệu",
      "ALTER TABLE orders_analytics DROP PARTITION 202301;",
      "",
      "-- nạp lại tháng 9 từ bảng staging (nguyên tử)",
      "ALTER TABLE orders_analytics REPLACE PARTITION 202409 FROM orders_staging;",
      "",
      "-- chuyển tháng cũ sang đĩa chậm",
      "ALTER TABLE orders_analytics MOVE PARTITION 202401 TO VOLUME 'cold';",
      "",
      "SELECT partition, count() AS parts, sum(rows)",
      "FROM system.parts WHERE table = 'orders_analytics' AND active",
      "GROUP BY partition ORDER BY partition;"
    ]},
    { id: "bad", label: "③ Partition sai", lines: [
      "PARTITION BY tenant_id              -- 5.000 tenant",
      "",
      "-- một batch 10.000 hàng có 800 tenant khác nhau",
      "INSERT INTO t SELECT ...;",
      "-- => 800 part mới chỉ từ 1 lần insert",
      "-- Code: 252. DB::Exception: Too many partitions for single INSERT block",
      "--   (more than 100)",
      "",
      "-- vài phút sau, dù insert ít partition hơn:",
      "-- Code: 252. Too many parts (3001) in partition ... Merges are processing",
      "--   significantly slower than inserts"
    ]},
    { id: "prune", label: "④ Pruning", lines: [
      "EXPLAIN indexes = 1",
      "SELECT sum(amount) FROM orders_analytics",
      "WHERE created_at >= '2024-09-01' AND tenant_id = 42;",
      "",
      "-- MinMax      Keys: created_at   Parts: 4/40   <- loại part tháng cũ",
      "-- Partition   Keys: toYYYYMM(created_at)   Parts: 4/4",
      "-- PrimaryKey  Keys: tenant_id, created_at  Granules: 3/980"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ins"><div class="nl">📥 INSERT 1 batch</div><div class="ns">dữ liệu của 2 tháng</div></div>
    <div class="arrow" id="a1">↓ tách theo partition</div>
    <div class="row">
      <div class="node" id="p8"><div class="nl">📁 202408</div><div class="ns">1 part mới</div></div>
      <div class="node" id="p9"><div class="nl">📁 202409</div><div class="ns">1 part mới</div></div>
      <div class="node" id="pold"><div class="nl">📁 202301</div><div class="ns">DROP = xoá thư mục</div></div>
    </div>
    <div class="arrow" id="a2">↓ merge chỉ trong từng partition</div>
    <div class="node" id="bad"><div class="nl">💥 PARTITION BY tenant_id</div><div class="ns">1 insert → hàng trăm part → Too many parts</div></div>
  `,
  steps: [
    { title: "1 · Partition theo tháng", tab: "ddl", highlight: [9, 10], on: ["ins"],
      desc: "Khoảng 12 partition/năm. Tenant nằm đầu ORDER BY chứ không nằm trong partition." },
    { title: "2 · Insert tách theo partition", tab: "ddl", highlight: [9], on: ["a1", "p8", "p9"],
      desc: "Batch chứa 2 tháng tạo 2 part. Merge chỉ gộp part cùng partition." },
    { title: "3 · Thao tác cả partition", tab: "ops", highlight: [2, 5, 8], on: ["pold"],
      desc: "DROP/REPLACE/MOVE PARTITION là thao tác trên thư mục — rẻ và nguyên tử, lý do chính để partition." },
    { title: "4 · Partition sai → quá nhiều part", tab: "bad", highlight: [1, 5, 6, 10], on: ["a2", "bad"],
      desc: "Cardinality cao nhân số part lên theo mỗi insert; merge không theo kịp và ClickHouse từ chối insert." },
    { title: "5 · Pruning là phần thưởng phụ", tab: "prune", highlight: [5, 6, 7], on: ["p9"],
      desc: "minmax theo cột partition loại part cũ; primary key làm phần lọc chính xác." }
  ],

  quiz: [
    { q: "Mục đích chính của PARTITION BY trong ClickHouse là gì?", options: [
        "Tăng tốc mọi query",
        "Quản lý dữ liệu: xoá/di chuyển/thay thế cả nhóm dữ liệu rẻ và nguyên tử",
        "Đảm bảo duy nhất",
        "Chia dữ liệu cho các shard"
      ], correct: 1, explanation: "Tốc độ query chủ yếu đến từ ORDER BY; partition phục vụ vòng đời dữ liệu." },
    { q: "PARTITION BY tenant_id với 5.000 tenant gây vấn đề gì?", options: [
        "Không có vấn đề",
        "Mỗi insert tạo rất nhiều part nhỏ → Too many parts / Too many partitions",
        "Query theo tenant chậm hơn",
        "Không thể DROP dữ liệu"
      ], correct: 1, explanation: "Mỗi partition chạm tới trong một insert sinh ra một part." },
    { q: "Merge có gộp part của hai partition khác nhau không?", options: ["Có", "Không", "Chỉ khi OPTIMIZE FINAL", "Chỉ trên replica"], correct: 1,
      explanation: "Partition là ranh giới cứng của merge." },
    { q: "Cách rẻ nhất để xoá toàn bộ dữ liệu tháng 1/2023?", options: [
        "DELETE FROM t WHERE toYYYYMM(ts) = 202301",
        "ALTER TABLE t DROP PARTITION 202301",
        "ALTER TABLE t DELETE WHERE ...",
        "TRUNCATE rồi insert lại"
      ], correct: 1, explanation: "DROP PARTITION chỉ gỡ thư mục part, không viết lại dữ liệu." },
    { q: "max_partitions_per_insert_block (mặc định 100) để làm gì?", options: [
        "Giới hạn số partition của bảng",
        "Chặn một INSERT rải ra quá nhiều partition — dấu hiệu partition key sai",
        "Giới hạn số replica",
        "Giới hạn số cột"
      ], correct: 1, explanation: "Là cầu chì an toàn chống tạo hàng loạt part nhỏ." },
    { q: "Số partition hợp lý cho một bảng thường là?", options: [
        "Vài chục đến vài trăm",
        "Hàng chục nghìn",
        "Đúng 1 với mọi bảng",
        "Bằng số user"
      ], correct: 0, explanation: "Nhiều partition = nhiều part, nhiều file, merge kém hiệu quả." },
    { q: "Pruning theo partition dựa vào gì?", options: [
        "Bloom filter",
        "File minmax_*.idx của các cột dùng trong biểu thức partition, cho từng part",
        "Keeper",
        "Primary.idx"
      ], correct: 1, explanation: "Mỗi part lưu min/max để loại nhanh part không liên quan." },
    { q: "Muốn nạp lại dữ liệu tháng 9 một cách nguyên tử (không để người đọc thấy nửa vời)?", options: [
        "DELETE rồi INSERT",
        "Nạp vào bảng staging rồi ALTER TABLE ... REPLACE PARTITION 202409 FROM staging",
        "OPTIMIZE FINAL",
        "TRUNCATE"
      ], correct: 1, explanation: "REPLACE PARTITION hoán đổi part một cách nguyên tử." },
    { q: "Muốn query theo tenant nhanh, nên làm gì?", options: [
        "PARTITION BY tenant_id",
        "Đặt tenant_id đầu ORDER BY",
        "Tạo bảng riêng cho mỗi tenant",
        "Dùng Nullable(tenant_id)"
      ], correct: 1, explanation: "Sparse primary index trên tenant_id loại gần hết granule." }
  ]
});
