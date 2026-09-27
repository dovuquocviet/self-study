window.LESSONS.push({
  id: "16",
  phase: "5", phaseName: "Mô hình dữ liệu",
  title: "Partitioning: chia bảng lớn theo RANGE, LIST, HASH",
  subtitle: "Partition pruning · khoá chính phải chứa partition key · DROP thay DELETE · ATTACH/DETACH CONCURRENTLY",

  theory: `
    <p>Bảng <code>events</code> 3 tỉ row, mỗi đêm phải xoá dữ liệu cũ hơn 90 ngày. <code>DELETE</code> 30 triệu row = 30 triệu dead tuple, WAL khổng lồ, VACUUM chạy cả ngày. Với partition theo tháng: <code>DROP TABLE events_2026_06</code> — tức thì, không rác.</p>

    <p><strong>Declarative partitioning</strong> (PG 10+): một bảng cha "ảo" (không chứa dữ liệu) + các bảng con, mỗi con giữ một phần theo <em>partition key</em>.</p>
    <table>
      <tr><th>Kiểu</th><th>Ví dụ</th><th>Dùng khi</th></tr>
      <tr><td>RANGE</td><td><code>FOR VALUES FROM ('2026-09-01') TO ('2026-10-01')</code> (cận trên không bao gồm)</td><td>Dữ liệu theo thời gian: log, event, đơn hàng</td></tr>
      <tr><td>LIST</td><td><code>FOR VALUES IN ('VN', 'TH')</code></td><td>Theo vùng, tenant lớn</td></tr>
      <tr><td>HASH</td><td><code>FOR VALUES WITH (MODULUS 8, REMAINDER 3)</code></td><td>Chia đều để giảm kích thước từng bảng/index</td></tr>
    </table>

    <p><strong>Lợi ích thật</strong></p>
    <ul>
      <li><strong>Partition pruning</strong>: query có điều kiện trên partition key chỉ quét partition liên quan (lúc plan, hoặc lúc chạy với tham số — "Subplans Removed").</li>
      <li><strong>Vòng đời dữ liệu</strong>: xoá/archive bằng DROP hoặc DETACH partition.</li>
      <li>Index và VACUUM trên từng partition nhỏ hơn; có thể đặt partition cũ ở tablespace rẻ.</li>
    </ul>

    <p><strong>Ràng buộc &amp; bẫy</strong></p>
    <ul>
      <li><strong>PRIMARY KEY/UNIQUE phải chứa partition key</strong>: không có unique toàn cục chỉ trên <code>id</code>. PK thường là <code>(id, created_at)</code>.</li>
      <li>Query <em>không</em> có điều kiện trên partition key phải quét mọi partition — với 1000 partition, chi phí plan cũng tăng. Giữ số partition vừa phải (vài chục–vài trăm).</li>
      <li>INSERT row không khớp partition nào → lỗi. Có thể tạo <code>DEFAULT</code> partition, nhưng nó làm việc thêm partition mới phức tạp hơn (phải quét default).</li>
      <li>Partition phải được <strong>tạo trước</strong>: dùng cron job hoặc extension <code>pg_partman</code>.</li>
      <li>Partitioning <em>không</em> làm query tra theo khoá chính nhanh hơn — B-tree 3 tỉ row vẫn chỉ 4–5 tầng. Chia vì vận hành, không phải vì "bảng to thì chậm".</li>
    </ul>

    <p><strong>Thao tác không downtime</strong>: <code>ATTACH PARTITION</code> chỉ cần SHARE UPDATE EXCLUSIVE trên bảng cha (PG 12+); tạo sẵn CHECK constraint khớp khoảng để khỏi phải quét. <code>DETACH PARTITION ... CONCURRENTLY</code> (PG 14+) không chặn query.</p>

    <div class="callout"><p>💡 Với ClickHouse bạn quen <code>PARTITION BY toYYYYMM(ts)</code> và TTL. PostgreSQL không có TTL tự động — "TTL" ở đây là job định kỳ tạo partition tương lai và DROP partition quá hạn.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① Tạo bảng partition", lines: [
      "CREATE TABLE events (",
      "  id          bigserial,",
      "  tenant_id   bigint NOT NULL,",
      "  kind        text NOT NULL,",
      "  payload     jsonb,",
      "  created_at  timestamptz NOT NULL,",
      "  PRIMARY KEY (id, created_at)          -- bắt buộc chứa partition key",
      ") PARTITION BY RANGE (created_at);",
      "",
      "CREATE TABLE events_2026_09 PARTITION OF events",
      "  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');",
      "CREATE INDEX ON events (tenant_id, created_at);   -- tự tạo trên mọi partition"
    ]},
    { id: "prune", label: "② Partition pruning", lines: [
      "EXPLAIN SELECT count(*) FROM events",
      "WHERE created_at >= '2026-09-20' AND created_at < '2026-09-27';",
      "",
      " Aggregate",
      "   ->  Index Only Scan using events_2026_09_tenant_id_created_at_idx on events_2026_09",
      "# chỉ 1 partition, các tháng khác bị loại lúc plan",
      "",
      "EXPLAIN SELECT * FROM events WHERE id = 123;",
      "# ❌ Append → quét index của TỪNG partition (không có điều kiện created_at)"
    ]},
    { id: "life", label: "③ Vòng đời dữ liệu", lines: [
      "-- tạo trước partition tháng sau (cron / pg_partman)",
      "CREATE TABLE events_2026_10 (LIKE events INCLUDING DEFAULTS INCLUDING CONSTRAINTS);",
      "ALTER TABLE events_2026_10 ADD CONSTRAINT c_range",
      "  CHECK (created_at >= '2026-10-01' AND created_at < '2026-11-01');",
      "ALTER TABLE events ATTACH PARTITION events_2026_10",
      "  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');   -- có CHECK sẵn → không quét",
      "",
      "-- xoá dữ liệu cũ: tháo ra không chặn query, rồi DROP",
      "ALTER TABLE events DETACH PARTITION events_2026_06 CONCURRENTLY;",
      "DROP TABLE events_2026_06;   -- tức thì, không dead tuple, WAL nhỏ"
    ]},
    { id: "rust", label: "④ Phía ứng dụng", lines: [
      "// Luôn kèm khoảng created_at để được pruning",
      "let rows = sqlx::query_as::<_, Event>(",
      "    \"SELECT * FROM events WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3 \\",
      "     ORDER BY created_at DESC LIMIT 100\")",
      "    .bind(tenant_id).bind(from).bind(to)",
      "    .fetch_all(&pool).await?;",
      "",
      "// Tra theo id đơn lẻ? Kèm luôn created_at (lưu trong id dạng UUIDv7/Snowflake,",
      "// hoặc trong URL) — nếu không sẽ quét mọi partition."
    ]}
  ],

  stageHtml: `
    <div class="node" id="parent"><div class="nl">🗂️ events (bảng cha)</div><div class="ns">PARTITION BY RANGE (created_at) — không chứa dữ liệu</div></div>
    <div class="arrow" id="a1">↓ router theo created_at</div>
    <div class="row">
      <div class="node" id="p6"><div class="nl">2026_06</div><div class="ns">quá hạn → DETACH + DROP</div></div>
      <div class="node" id="p8"><div class="nl">2026_08</div><div class="ns">bị loại khi prune</div></div>
      <div class="node" id="p9"><div class="nl">2026_09</div><div class="ns">✅ được quét</div></div>
      <div class="node" id="p10"><div class="nl">2026_10</div><div class="ns">tạo trước + ATTACH</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Khai báo partition", tab: "ddl", highlight: [7, 8, 10, 11], on: ["parent", "p9"],
      desc: "Khoá chính bắt buộc chứa created_at. Cận trên của RANGE không bao gồm, nên các tháng nối nhau không chồng lấn." },
    { title: "2 · Index trên bảng cha", tab: "ddl", highlight: [12], on: ["p8", "p9", "p10"],
      desc: "CREATE INDEX trên bảng cha tạo index tương ứng trên từng partition (và partition tương lai)." },
    { title: "3 · Pruning", tab: "prune", highlight: [2, 5, 6], on: ["a1", "p9"],
      desc: "Điều kiện trên partition key → planner chỉ giữ partition tháng 9." },
    { title: "4 · Không có partition key", tab: "prune", highlight: [8, 9], on: ["p6", "p8", "p9", "p10"],
      desc: "Tra theo id đơn thuần phải hỏi mọi partition. Thiết kế query/khoá sao cho luôn biết thời gian." },
    { title: "5 · Thêm partition không downtime", tab: "life", highlight: [2, 3, 4, 5, 6], on: ["p10"],
      desc: "Tạo bảng + CHECK khớp khoảng, rồi ATTACH: PostgreSQL dùng CHECK để khỏi quét xác minh." },
    { title: "6 · Xoá dữ liệu cũ bằng DROP", tab: "life", highlight: [9, 10], on: ["p6"],
      desc: "DETACH CONCURRENTLY không chặn query; DROP giải phóng đĩa ngay, không cần VACUUM." }
  ],

  quiz: [
    { q: "Lợi ích lớn nhất của partition theo thời gian cho bảng log?", options: [
        "Tra theo khoá chính nhanh gấp 10",
        "Xoá dữ liệu cũ bằng DROP partition thay vì DELETE hàng loạt, cùng với partition pruning",
        "Không cần index",
        "Tự động nén"
      ], correct: 1, explanation: "DROP không sinh dead tuple và gần như không sinh WAL." },
    { q: "Ràng buộc nào bắt buộc với PRIMARY KEY trên bảng partition?", options: [
        "Phải là UUID",
        "Phải chứa (các) cột partition key",
        "Phải là cột đầu tiên",
        "Không được có PK"
      ], correct: 1, explanation: "Unique chỉ được kiểm trong từng partition nên cần có partition key." },
    { q: "Partition pruning xảy ra khi nào?", options: [
        "Luôn luôn",
        "Khi query có điều kiện trên partition key để loại trừ partition không liên quan",
        "Khi chạy VACUUM",
        "Khi có index GIN"
      ], correct: 1, explanation: "Có thể ở lúc plan hoặc lúc thực thi (với tham số)." },
    { q: "FOR VALUES FROM ('2026-09-01') TO ('2026-10-01') chứa row created_at = '2026-10-01 00:00'?", options: [
        "Có", "Không — cận trên không bao gồm", "Tuỳ múi giờ", "Lỗi"
      ], correct: 1, explanation: "Nhờ vậy các khoảng liền kề không chồng nhau." },
    { q: "Cách gắn partition mới mà tránh quét xác minh toàn bộ dữ liệu?", options: [
        "Tắt constraint",
        "Tạo sẵn CHECK constraint khớp khoảng trên bảng con trước khi ATTACH",
        "Dùng DEFAULT partition",
        "VACUUM FULL trước"
      ], correct: 1, explanation: "PostgreSQL dùng CHECK đã có để chứng minh dữ liệu hợp lệ." },
    { q: "DETACH PARTITION ... CONCURRENTLY có từ phiên bản nào?", options: [
        "PG 10", "PG 12", "PG 14", "PG 17"
      ], correct: 2, explanation: "Không giữ ACCESS EXCLUSIVE lâu trên bảng cha." },
    { q: "Query WHERE id = 123 trên bảng partition theo created_at?", options: [
        "Chỉ quét 1 partition",
        "Phải tra index của mọi partition vì không biết id nằm tháng nào",
        "Lỗi",
        "Dùng BRIN tự động"
      ], correct: 1, explanation: "Kèm điều kiện thời gian khi có thể." },
    { q: "Partitioning có làm tra cứu 1 row theo khoá chính trên bảng 3 tỉ row nhanh hơn đáng kể không?", options: [
        "Có, gấp nhiều lần",
        "Thường không — B-tree đã chỉ 4–5 tầng; partition chủ yếu giúp vận hành và pruning",
        "Có nếu dùng HASH",
        "Chậm hơn 100 lần"
      ], correct: 1, explanation: "Đừng partition chỉ vì 'bảng to'." },
    { q: "Công cụ nào giúp tự tạo partition tương lai và dọn partition cũ?", options: [
        "pg_repack", "pg_partman", "pg_trgm", "pgBouncer"
      ], correct: 1, explanation: "Hoặc một cron job tự viết." }
  ]
});
