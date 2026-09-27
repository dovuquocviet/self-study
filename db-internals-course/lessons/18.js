window.LESSONS.push({
  id: "18",
  phase: "4", phaseName: "Phân tán",
  title: "Replication — sao chép dữ liệu sang nhiều máy",
  subtitle: "Leader-follower · đồng bộ vs bất đồng bộ · replication lag · quorum W+R>N · mỗi DB làm thế nào",

  theory: `
    <p>Replication giữ cùng dữ liệu trên nhiều máy để: <strong>sống sót khi mất máy</strong> (HA), <strong>chia tải đọc</strong>, và <strong>đặt dữ liệu gần người dùng</strong>.
    Khó khăn không nằm ở việc chép, mà ở câu hỏi: <em>chờ bao nhiêu bản sao xác nhận thì báo "ghi thành công"?</em></p>

    <p><strong>1. Leader-follower (single leader)</strong> — mô hình của PostgreSQL, MongoDB, Redis, Kafka (theo partition), Elasticsearch (theo shard)</p>
    <ul>
      <li>Mọi ghi đi vào leader; leader gửi luồng thay đổi (WAL, oplog, log) cho follower phát lại.</li>
      <li><strong>Bất đồng bộ</strong>: leader trả OK ngay. Nhanh, nhưng leader chết trước khi follower nhận → failover <em>mất các ghi đã báo thành công</em>.</li>
      <li><strong>Đồng bộ</strong>: chờ follower xác nhận. Không mất khi failover, nhưng ghi chậm theo follower chậm nhất và bị treo nếu follower chết (trừ khi dùng quorum "k trong n").</li>
    </ul>

    <table>
      <tr><th>DB</th><th>Truyền gì</th><th>Nút vặn</th></tr>
      <tr><td>PostgreSQL</td><td>WAL vật lý (streaming) hoặc logical</td><td><code>synchronous_standby_names = 'ANY 1 (s1, s2)'</code> + <code>synchronous_commit</code></td></tr>
      <tr><td>MongoDB</td><td>oplog (thao tác logic, idempotent)</td><td><code>w: "majority"</code>, readConcern, readPreference; bầu leader kiểu Raft</td></tr>
      <tr><td>Kafka</td><td>Log partition, follower kéo từ leader</td><td><code>acks=all</code> + <code>min.insync.replicas</code>; chỉ replica trong ISR được lên leader (mặc định)</td></tr>
      <tr><td>Elasticsearch</td><td>Primary chuyển thao tác sang replica shard</td><td>Ghi chờ các bản in-sync; <code>wait_for_active_shards</code></td></tr>
      <tr><td>Redis</td><td>Luồng lệnh, bất đồng bộ</td><td><code>WAIT</code>, <code>min-replicas-to-write</code></td></tr>
      <tr><td>ClickHouse</td><td>ReplicatedMergeTree: đồng bộ part qua ClickHouse Keeper</td><td><code>insert_quorum</code></td></tr>
    </table>

    <p><strong>2. Replication lag &amp; hệ quả đọc</strong>: đọc từ follower có thể thấy dữ liệu cũ. Bug kinh điển: user vừa đổi avatar, reload trang (đọc replica) → vẫn thấy avatar cũ.
    Cách xử lý: <em>read-your-writes</em> — đọc từ leader một lúc sau khi ghi, hoặc đọc replica nhưng chờ tới vị trí (LSN/optime) đã ghi. Spring hay dùng routing datasource
    (<code>@Transactional(readOnly = true)</code> → replica) — nhớ rằng nó mang theo lag.</p>

    <p><strong>3. Leaderless &amp; quorum</strong> (Cassandra, DynamoDB-style): ghi gửi tới N bản, thành công khi W bản xác nhận; đọc hỏi R bản. Nếu <strong>W + R &gt; N</strong>,
    tập đọc và tập ghi chắc chắn giao nhau → đọc thấy bản mới nhất (trong điều kiện bình thường). Ví dụ N=3, W=2, R=2. Cùng ý tưởng "majority" xuất hiện ở Mongo w:majority và Kafka min.insync.replicas.</p>

    <p><strong>4. Failover &amp; split brain</strong>: phát hiện leader chết (timeout — không phân biệt được "chết" với "mạng chậm"), bầu leader mới, chuyển client.
    Nguy hiểm nhất là <em>hai leader cùng nhận ghi</em>. Hệ thống tốt dùng bầu chọn theo đa số (Raft) và <em>term/epoch</em> để leader cũ bị từ chối.</p>

    <div class="callout"><p>💡 "Có replica" không có nghĩa là "không mất dữ liệu". Hãy hỏi: replica đồng bộ hay bất đồng bộ? Failover tự động có thể mất bao nhiêu ghi?
    Và đọc từ replica thì code có chịu được dữ liệu cũ vài trăm ms không?</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "PostgreSQL", lines: [
      "# primary: postgresql.conf",
      "wal_level = replica",
      "synchronous_standby_names = 'ANY 1 (replica_a, replica_b)'   # quorum 1 trong 2",
      "synchronous_commit = on        # chờ 1 standby ghi bền WAL",
      "",
      "-- đo lag trên primary",
      "SELECT application_name, state, sync_state, replay_lag",
      "FROM pg_stat_replication;",
      "-- replica_a | streaming | quorum | 00:00:00.002"
    ]},
    { id: "mongo", label: "MongoDB", lines: [
      "// ghi: chờ đa số node trong replica set đã ghi journal",
      "db.orders.insertOne(doc, { writeConcern: { w: 'majority', j: true } })",
      "",
      "// đọc: chỉ dữ liệu đã được đa số xác nhận (không bị rollback khi failover)",
      "db.orders.find({ _id: id }).readConcern('majority')",
      "",
      "// đọc từ secondary: có thể cũ",
      "db.orders.find({ userId: 42 }).readPref('secondaryPreferred')"
    ]},
    { id: "quorum", label: "Quorum W+R>N", lines: [
      "N = 3 bản sao: A B C",
      "",
      "Ghi x=2 với W=2:   A=2  B=2  C=1 (C chậm)",
      "Đọc với R=2:       hỏi B, C → thấy {2, 1} → lấy bản mới nhất (2) ✔",
      "",
      "W=1, R=1 (W+R=2 ≤ 3): có thể ghi vào A, đọc từ C → thấy 1 ✘ dữ liệu cũ",
      "",
      "# W lớn → ghi chậm/kém sẵn sàng; R lớn → đọc chậm. Đánh đổi theo workload"
    ]},
    { id: "spring", label: "Đọc replica ở Spring", lines: [
      "class RoutingDs extends AbstractRoutingDataSource {",
      "    protected Object determineCurrentLookupKey() {",
      "        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()",
      "               ? \"replica\" : \"primary\";",
      "    }",
      "}",
      "// bọc bằng LazyConnectionDataSourceProxy để quyết định SAU khi biết readOnly",
      "",
      "@Transactional(readOnly = true)   // → replica, có thể trễ vài trăm ms",
      "public UserDto profile(long id) { ... }",
      "// ngay sau khi user sửa hồ sơ: đọc primary để có read-your-writes"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client ghi</div><div class="ns">UPDATE avatar</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="leader"><div class="nl">👑 Leader</div><div class="ns">ghi WAL / oplog / log</div></div>
    <div class="arrow" id="a2">↓ gửi luồng thay đổi</div>
    <div class="row">
      <div class="node" id="f1"><div class="nl">🪞 Follower 1</div><div class="ns">đồng bộ: chờ xác nhận</div></div>
      <div class="node" id="f2"><div class="nl">🪞 Follower 2</div><div class="ns">bất đồng bộ: trễ vài ms–s</div></div>
    </div>
    <div class="arrow" id="a3">↓ đọc từ follower 2 ngay sau khi ghi</div>
    <div class="node" id="stale"><div class="nl">🕰️ Thấy avatar cũ</div><div class="ns">replication lag</div></div>
  `,
  steps: [
    { title: "1 · Ghi vào leader", tab: "pg", highlight: [2], on: ["client", "a1", "leader"],
      desc: "Mọi ghi qua một nơi → không có xung đột ghi giữa các bản." },
    { title: "2 · Đồng bộ theo quorum", tab: "pg", highlight: [3, 4], on: ["a2", "f1"],
      desc: "ANY 1 trong 2: chờ một standby bất kỳ — không bị treo nếu một standby chết." },
    { title: "3 · Đo lag", tab: "pg", highlight: [7, 8, 9], on: ["f2"],
      desc: "replay_lag cho biết follower chậm bao nhiêu." },
    { title: "4 · Majority ở MongoDB", tab: "mongo", highlight: [2, 5, 8], on: ["leader", "f1", "f2"],
      desc: "w:majority chống mất ghi khi failover; đọc secondary thì chấp nhận dữ liệu cũ." },
    { title: "5 · Quorum W+R>N", tab: "quorum", highlight: [3, 4, 6], on: ["f1", "f2"],
      desc: "Tập ghi và tập đọc giao nhau thì đọc luôn chạm ít nhất một bản mới nhất." },
    { title: "6 · Lag lộ ra ở ứng dụng", tab: "spring", highlight: [3, 4, 9, 11], on: ["a3", "stale"],
      desc: "Routing readOnly → replica tiện, nhưng mang theo lag; luồng 'vừa sửa xong' đọc primary." }
  ],

  quiz: [
    { q: "Replication bất đồng bộ có rủi ro gì khi failover?", options: [
        "Không rủi ro",
        "Mất các ghi đã báo thành công nhưng chưa tới follower",
        "Dữ liệu bị nhân đôi",
        "Không đọc được"
      ], correct: 1, explanation: "Leader trả OK trước khi follower nhận." },
    { q: "Nhược điểm của replication đồng bộ chờ một follower cố định?", options: [
        "Mất dữ liệu",
        "Ghi chậm theo follower và bị treo nếu follower đó chết",
        "Không đọc được",
        "Không có"
      ], correct: 1, explanation: "Quorum ANY k (n) giảm vấn đề này." },
    { q: "Với N=3, cấu hình W và R nào đảm bảo đọc thấy ghi mới nhất (điều kiện bình thường)?", options: [
        "W=1, R=1", "W=2, R=2", "W=1, R=2", "W=0, R=3"
      ], correct: 1, explanation: "W + R > N (4 > 3)." },
    { q: "MongoDB oplog chứa gì?", options: [
        "Page vật lý",
        "Thao tác ở mức logic, idempotent, để secondary phát lại",
        "Log truy cập",
        "Snapshot RDB"
      ], correct: 1, explanation: "PostgreSQL streaming thì gửi WAL vật lý." },
    { q: "Vì sao user vừa đổi avatar, reload lại thấy avatar cũ?", options: [
        "Cache trình duyệt luôn luôn",
        "Đọc từ replica bị replication lag",
        "Mất dữ liệu",
        "Deadlock"
      ], correct: 1, explanation: "Cần read-your-writes: đọc primary sau khi ghi." },
    { q: "readConcern 'majority' trong MongoDB đảm bảo điều gì?", options: [
        "Đọc nhanh nhất",
        "Chỉ đọc dữ liệu đã được đa số node xác nhận, không bị rollback khi failover",
        "Đọc từ mọi node",
        "Khoá document"
      ], correct: 1, explanation: "Kết hợp w:majority cho nhất quán mạnh hơn." },
    { q: "Split brain là gì?", options: [
        "Replica bị xoá",
        "Hai node cùng nghĩ mình là leader và cùng nhận ghi",
        "Chia bảng thành 2",
        "Hai consumer group"
      ], correct: 1, explanation: "Chống bằng bầu chọn theo đa số và term/epoch." },
    { q: "Vì sao phát hiện leader 'chết' là khó?", options: [
        "Leader không bao giờ chết",
        "Timeout không phân biệt được node chết với mạng chậm/tạm đứt",
        "Do thiếu log",
        "Do fsync"
      ], correct: 1, explanation: "Timeout ngắn → failover nhầm; dài → gián đoạn lâu." },
    { q: "ClickHouse ReplicatedMergeTree phối hợp giữa các replica qua đâu?", options: [
        "PostgreSQL", "ClickHouse Keeper (hoặc ZooKeeper)", "Redis", "Kafka"
      ], correct: 1, explanation: "Keeper lưu metadata về part cần tải/merge." },
    { q: "@Transactional(readOnly = true) + routing datasource tới replica có hệ quả gì?", options: [
        "Luôn thấy dữ liệu mới nhất",
        "Chia tải đọc nhưng có thể đọc dữ liệu cũ do lag",
        "Không cho phép SELECT",
        "Tăng isolation"
      ], correct: 1, explanation: "Luồng cần dữ liệu vừa ghi nên đọc primary." }
  ]
});
