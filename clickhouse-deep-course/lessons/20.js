window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Vận hành",
  title: "Cluster: shard, replica, Distributed table & ClickHouse Keeper",
  subtitle: "ReplicatedMergeTree · Keeper thay ZooKeeper · Distributed = router · sharding key · GLOBAL IN/JOIN",

  theory: `
    <p>Hai trục mở rộng độc lập:</p>
    <ul>
      <li><strong>Replica</strong> = bản sao đầy đủ của cùng dữ liệu ⇒ chịu lỗi + chia tải đọc.</li>
      <li><strong>Shard</strong> = chia dữ liệu thành nhiều phần ⇒ tăng dung lượng + song song hoá query/insert.</li>
    </ul>
    <p>Cluster 2 shard × 2 replica = 4 server. Rất nhiều hệ thống chỉ cần <strong>1 shard × 2–3 replica</strong>: một server ClickHouse mạnh xử lý được hàng chục TB. Shard khi thật sự cần.</p>

    <p><strong>ReplicatedMergeTree</strong> (và Replicated* cho mọi biến thể): replica ghi nhật ký thao tác (part mới, merge, mutation) vào <strong>ClickHouse Keeper</strong>
    (thay ZooKeeper, viết bằng C++, dùng Raft, tương thích giao thức ZooKeeper). Các replica khác đọc nhật ký và <em>tải part qua mạng</em> từ replica đã có.
    Replication là <strong>multi-master, bất đồng bộ</strong>: insert vào replica nào cũng được. Keeper chỉ giữ metadata, không giữ dữ liệu.</p>

    <p><code>ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/orders', '{replica}')</code>: đường dẫn Keeper chung cho mọi replica cùng shard; <code>{shard}</code>, <code>{replica}</code> là macro trong config mỗi server.
    Bản mới cho phép bỏ trống tham số (dùng mặc định từ config) và database engine <code>Replicated</code> tự đồng bộ DDL.</p>

    <p><strong>Distributed table</strong> không lưu dữ liệu; nó là router:</p>
    <ul>
      <li>SELECT: gửi query tới một replica của mỗi shard, gom kết quả trung gian (ví dụ state của GROUP BY) về node khởi tạo để gộp.</li>
      <li>INSERT: chia hàng theo <strong>sharding key</strong> (<code>cityHash64(tenant_id)</code> hoặc <code>rand()</code>). Mặc định ghi đệm và gửi bất đồng bộ; tốt hơn là insert thẳng vào bảng local của từng shard nếu client làm được.</li>
      <li>Sharding key theo <code>tenant_id</code> giữ dữ liệu một tenant trên một shard ⇒ JOIN/GROUP BY theo tenant chạy cục bộ; nhưng tenant lớn gây lệch tải.</li>
    </ul>

    <p><strong>Bẫy subquery</strong>: <code>WHERE user_id IN (SELECT ... FROM distributed_table)</code> — mỗi shard lại chạy subquery trên toàn cluster (N² query).
    Dùng <code>GLOBAL IN</code>/<code>GLOBAL JOIN</code>: node khởi tạo chạy subquery một lần, gửi kết quả cho mọi shard.</p>

    <p>Ở ClickHouse Cloud: <strong>SharedMergeTree</strong> — dữ liệu nằm trên object storage, compute tách rời, không cần tự quản shard/replica.</p>

    <div class="callout"><p>💡 Nhớ lại bài 08: khử trùng Replacing chỉ trong cùng shard. Muốn khử trùng đúng trên cluster, sharding key phải đưa mọi phiên bản của một bản ghi về cùng shard (vd <code>cityHash64(order_id)</code>).</p></div>
  `,

  codeTabs: [
    { id: "local", label: "① Bảng local", lines: [
      "CREATE TABLE orders_local ON CLUSTER analytics",
      "(",
      "    order_id UInt64, tenant_id UInt32, status LowCardinality(String),",
      "    amount Decimal(18, 2), created_at DateTime, updated_at DateTime64(3)",
      ")",
      "ENGINE = ReplicatedReplacingMergeTree(",
      "    '/clickhouse/tables/{shard}/orders_local', '{replica}', updated_at)",
      "PARTITION BY toYYYYMM(created_at)",
      "ORDER BY (tenant_id, order_id);"
    ]},
    { id: "dist", label: "② Distributed", lines: [
      "CREATE TABLE orders ON CLUSTER analytics AS orders_local",
      "ENGINE = Distributed(analytics, default, orders_local, cityHash64(order_id));",
      "",
      "-- đọc: fan-out tới mỗi shard, gộp kết quả",
      "SELECT tenant_id, count() FROM orders FINAL GROUP BY tenant_id;",
      "",
      "-- ghi: chia theo cityHash64(order_id)",
      "INSERT INTO orders VALUES (...);"
    ]},
    { id: "config", label: "③ Cấu hình", lines: [
      "<!-- mỗi server: macros khác nhau -->",
      "<macros><shard>01</shard><replica>ch-01a</replica></macros>",
      "",
      "<remote_servers><analytics>",
      "  <shard><internal_replication>true</internal_replication>",
      "    <replica><host>ch-01a</host><port>9000</port></replica>",
      "    <replica><host>ch-01b</host><port>9000</port></replica></shard>",
      "  <shard><internal_replication>true</internal_replication>",
      "    <replica><host>ch-02a</host><port>9000</port></replica>",
      "    <replica><host>ch-02b</host><port>9000</port></replica></shard>",
      "</analytics></remote_servers>",
      "",
      "<zookeeper><node><host>keeper-1</host><port>9181</port></node> ... </zookeeper>"
    ]},
    { id: "global", label: "④ GLOBAL IN & giám sát", lines: [
      "-- SAI: mỗi shard tự chạy subquery trên toàn cluster",
      "SELECT count() FROM orders WHERE order_id IN (SELECT order_id FROM refunds);",
      "",
      "-- ĐÚNG",
      "SELECT count() FROM orders WHERE order_id GLOBAL IN (SELECT order_id FROM refunds);",
      "",
      "SELECT database, table, is_readonly, absolute_delay, queue_size",
      "FROM system.replicas;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🦀 Service / Grafana</div></div>
    <div class="arrow" id="a1">↓ SELECT/INSERT vào bảng Distributed</div>
    <div class="node" id="dist"><div class="nl">🧭 orders (Distributed)</div><div class="ns">router, không lưu dữ liệu</div></div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">🧩 Shard 01</div><div class="ns">ch-01a ⇄ ch-01b</div></div>
      <div class="node" id="s2"><div class="nl">🧩 Shard 02</div><div class="ns">ch-02a ⇄ ch-02b</div></div>
    </div>
    <div class="arrow" id="a2">↓ nhật ký replication</div>
    <div class="node" id="keeper"><div class="nl">🗝️ ClickHouse Keeper (3 node, Raft)</div><div class="ns">chỉ metadata; part tải trực tiếp giữa replica</div></div>
  `,
  steps: [
    { title: "1 · Bảng local có replication", tab: "local", highlight: [1, 6, 7], on: ["s1", "s2"],
      desc: "Mỗi server có bảng local. Đường dẫn Keeper chứa {shard}; tên replica là {replica} — macro lấy từ config." },
    { title: "2 · Keeper điều phối", tab: "config", highlight: [2, 13], on: ["a2", "keeper"],
      desc: "Replica ghi nhật ký part mới/merge vào Keeper; replica khác đọc và tải part trực tiếp từ nhau." },
    { title: "3 · Distributed làm router", tab: "dist", highlight: [1, 2, 5], on: ["app", "a1", "dist"],
      desc: "SELECT fan-out tới một replica mỗi shard rồi gộp. FINAL đúng vì cùng order_id luôn ở cùng shard." },
    { title: "4 · Sharding key", tab: "dist", highlight: [2, 8], on: ["dist", "s1", "s2"],
      desc: "cityHash64(order_id) đưa mọi phiên bản của đơn về cùng shard để Replacing khử trùng đúng." },
    { title: "5 · GLOBAL IN và giám sát", tab: "global", highlight: [2, 5, 7, 8], on: ["dist"],
      desc: "GLOBAL chạy subquery một lần. system.replicas cho biết độ trễ replication và replica read-only (mất Keeper)." }
  ],

  quiz: [
    { q: "Replica và shard khác nhau thế nào?", options: [
        "Giống nhau",
        "Replica là bản sao đầy đủ (chịu lỗi, chia tải đọc); shard chia dữ liệu thành phần (tăng dung lượng, song song)",
        "Shard là bản sao",
        "Replica chỉ dùng cho Kafka"
      ], correct: 1, explanation: "Hai trục mở rộng độc lập." },
    { q: "ClickHouse Keeper lưu gì?", options: [
        "Toàn bộ dữ liệu bảng",
        "Metadata và nhật ký replication (part, merge, mutation), dedup block hash",
        "Kết quả query",
        "Log ứng dụng"
      ], correct: 1, explanation: "Dữ liệu part được tải trực tiếp giữa các replica." },
    { q: "Replication của ReplicatedMergeTree là?", options: [
        "Master–slave đồng bộ",
        "Multi-master, bất đồng bộ: insert vào replica nào cũng được",
        "Chỉ đọc từ replica phụ",
        "Dựa trên WAL như Postgres"
      ], correct: 1, explanation: "Có thể cấu hình quorum insert nếu cần." },
    { q: "Bảng Distributed có lưu dữ liệu không?", options: [
        "Có, bản sao đầy đủ",
        "Không; nó định tuyến query/insert tới bảng local trên các shard",
        "Có, chỉ cache",
        "Chỉ lưu metadata trên Keeper"
      ], correct: 1, explanation: "Dữ liệu thật ở bảng local." },
    { q: "Vì sao dùng GLOBAL IN với subquery trên bảng Distributed?", options: [
        "Cú pháp bắt buộc",
        "Tránh mỗi shard tự chạy lại subquery trên toàn cluster; node khởi tạo chạy một lần và gửi kết quả",
        "Để dùng index",
        "Để có FINAL"
      ], correct: 1, explanation: "Không GLOBAL có thể thành N² query." },
    { q: "Muốn ReplacingMergeTree khử trùng đúng trên cluster nhiều shard?", options: [
        "Sharding key rand()",
        "Sharding key theo khoá khử trùng (vd cityHash64(order_id)) để mọi phiên bản về cùng shard",
        "Tăng số replica",
        "Dùng GLOBAL JOIN"
      ], correct: 1, explanation: "Khử trùng không vượt ranh giới shard." },
    { q: "Macro {shard} và {replica} dùng để?", options: [
        "Tạo tên bảng ngẫu nhiên",
        "Cùng một DDL ON CLUSTER nhưng mỗi server có đường dẫn Keeper/tên replica riêng",
        "Chọn thuật toán nén",
        "Định nghĩa user"
      ], correct: 1, explanation: "Giá trị macro khai báo trong config từng server." },
    { q: "Replica mất kết nối Keeper sẽ?", options: [
        "Tiếp tục nhận insert bình thường",
        "Chuyển read-only: vẫn đọc được nhưng không nhận insert vào bảng replicated",
        "Xoá dữ liệu",
        "Tự thành master"
      ], correct: 1, explanation: "Theo dõi is_readonly trong system.replicas." },
    { q: "Bắt đầu với hệ thống vài TB, cấu hình hợp lý thường là?", options: [
        "10 shard × 1 replica",
        "1 shard × 2–3 replica, shard khi thật sự cần",
        "Không replica",
        "100 shard"
      ], correct: 1, explanation: "Shard thêm phức tạp (sharding key, GLOBAL, rebalancing)." }
  ]
});
