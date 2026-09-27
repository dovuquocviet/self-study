window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Tổng kết",
  title: "Bảng chọn DB theo bài toán — tổng kết khoá",
  subtitle: "Từ câu hỏi truy cập → cấu trúc lưu trữ → DB · checklist khi thiết kế · ôn tập toàn khoá",

  theory: `
    <p>Toàn khoá quy về một chuỗi suy luận: <strong>câu hỏi truy cập</strong> → <strong>cấu trúc lưu trữ trả lời nó rẻ</strong> → <strong>DB cài đặt cấu trúc đó</strong> →
    <strong>đảm bảo (ACID, nhất quán, độ bền) DB đó cho và không cho</strong>.</p>

    <table>
      <tr><th>Bài toán</th><th>Cấu trúc phù hợp</th><th>Chọn</th><th>Lưu ý</th></tr>
      <tr><td>Đơn hàng, thanh toán, tồn kho</td><td>Row-store + B-tree + MVCC + WAL</td><td>PostgreSQL</td><td>Isolation, UPDATE nguyên tử, outbox</td></tr>
      <tr><td>Catalog sản phẩm thuộc tính thay đổi, aggregate đọc trọn</td><td>Document + B-tree</td><td>MongoDB (hoặc PostgreSQL jsonb + GIN)</td><td>Nhúng theo cách truy cập, tránh mảng vô hạn</td></tr>
      <tr><td>Báo cáo, dashboard trên sự kiện nhiều năm</td><td>Column-store + sparse index + nén</td><td>ClickHouse</td><td>ORDER BY, batch insert, khử trùng lặp</td></tr>
      <tr><td>Tìm kiếm sản phẩm, autocomplete, log search</td><td>Inverted index + BM25</td><td>Elasticsearch</td><td>Bản chiếu, refresh ~1s, analyzer</td></tr>
      <tr><td>Cache, session, rate limit, leaderboard</td><td>Hash table/skip list trong RAM</td><td>Redis</td><td>Lệnh O(N), eviction, failover bất đồng bộ</td></tr>
      <tr><td>Truyền sự kiện giữa service, CDC, nguồn cho view</td><td>Log append-only chia partition</td><td>Kafka</td><td>Key → thứ tự, consumer idempotent, retention</td></tr>
      <tr><td>Ghi cực nhiều theo khoá, đọc theo khoá</td><td>LSM-tree</td><td>Cassandra/ScyllaDB/RocksDB (ngoài stack hiện tại)</td><td>Chỉ khi PostgreSQL thật sự không theo kịp</td></tr>
    </table>

    <p><strong>Checklist khi thiết kế một bảng/collection/topic mới</strong></p>
    <ol>
      <li>Truy vấn chính là gì, có trong shard key/ORDER BY/index không? (bài 07, 14, 19)</li>
      <li>Tỉ lệ đọc/ghi và kích thước sau 2 năm? Working set còn vừa RAM? (bài 02, 04, 05)</li>
      <li>Cần transaction không, isolation nào, có read-modify-write không? (bài 08–11)</li>
      <li>Ghi bền tới đâu: fsync, bao nhiêu bản sao? Mất vài giây cuối có sao không? (bài 03, 18, 20)</li>
      <li>Đọc từ đâu, được cũ bao lâu? (bài 15, 18, 20)</li>
      <li>Xoá dữ liệu cũ thế nào: DROP partition, TTL, retention, compaction? (bài 05, 17, 19)</li>
      <li>Kiểm chứng bằng EXPLAIN/explain/profile trước khi thêm index hay đổi DB. (bài 12)</li>
    </ol>

    <p><strong>Những ý đáng mang theo</strong></p>
    <ul>
      <li>Page là đơn vị I/O; đĩa chậm hơn RAM hàng trăm lần → mọi thiết kế xoay quanh gom dữ liệu hay dùng cùng nhau.</li>
      <li>WAL + fsync là độ bền; mọi DB có một log bên dưới, Kafka biến log thành sản phẩm.</li>
      <li>B-tree sửa tại chỗ, đọc tốt; LSM (và segment/part bất biến) ghi tuần tự, gộp sau.</li>
      <li>MVCC cho đọc không chặn ghi, nhưng sinh rác cần dọn; transaction dài là kẻ thù.</li>
      <li>Anomaly đồng thời không lộ trong test đơn luồng: biết lost update và write skew.</li>
      <li>Replication không đồng nghĩa không mất dữ liệu; giữa các service luôn là eventual.</li>
    </ul>

    <div class="callout"><p>💡 Các khoá tiếp theo sẽ đi sâu từng engine (PostgreSQL, MongoDB, ClickHouse, Elasticsearch, Redis, Kafka). Khi học chúng, hãy luôn tự hỏi
    "cái này là biến thể của cơ chế nào trong khoá này?" — hầu hết tính năng mới chỉ là tổ hợp của page, log, cây, MVCC và nhân bản.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "Một luồng, nhiều DB", lines: [
      "1. POST /orders",
      "   PostgreSQL:  BEGIN; INSERT orders; INSERT outbox; COMMIT;        -- ACID, WAL fsync",
      "2. Outbox relay / Debezium",
      "   Kafka:       topic orders, key=orderId, acks=all                  -- thứ tự theo đơn",
      "3. Consumers (mỗi cái một group)",
      "   ClickHouse:  Kafka engine → MV → MergeTree ORDER BY (tenant, ts)  -- báo cáo",
      "   Elasticsearch: upsert theo _id, refresh 1s                        -- tìm kiếm",
      "   Redis:       DEL order:{id}:summary (xoá cache)                   -- cache",
      "4. GET /orders/{id}",
      "   Redis hit? → trả. Miss → PostgreSQL (primary nếu vừa ghi) → SET EX 300"
    ]},
    { id: "check", label: "Checklist", lines: [
      "[ ] truy vấn chính + index/ORDER BY/shard key phù hợp",
      "[ ] kích thước 2 năm, working set so với RAM",
      "[ ] transaction? isolation? tránh read-modify-write ở app",
      "[ ] độ bền: fsync, số bản sao, chấp nhận mất bao nhiêu",
      "[ ] đọc replica/near-real-time: được cũ bao lâu",
      "[ ] dọn dữ liệu: partition, TTL, retention, compaction",
      "[ ] EXPLAIN / explain('executionStats') / EXPLAIN indexes=1 / profile"
    ]},
    { id: "smells", label: "Dấu hiệu chọn sai", lines: [
      "PostgreSQL chạy báo cáo GROUP BY tỷ dòng, OLTP bị chậm theo  → ClickHouse",
      "LIKE '%áo%' trên bảng sản phẩm                              → Elasticsearch / trigram GIN",
      "Mongo: mọi truy vấn đều cần $lookup                          → mô hình quan hệ",
      "ClickHouse: UPDATE từng dòng liên tục                       → PostgreSQL",
      "Redis làm nguồn sự thật cho tiền, không AOF, không replica   → PostgreSQL",
      "Kafka dùng như DB truy vấn theo khoá tuỳ ý                   → dựng view vào DB khác"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Câu hỏi truy cập</div><div class="ns">theo khoá · quét · chứa từ · theo thứ tự</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="s"><div class="nl">🧱 Cấu trúc lưu trữ</div><div class="ns">B-tree · LSM · cột · inverted · hash · log</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="pg"><div class="nl">🐘 PG</div><div class="ns">OLTP</div></div>
      <div class="node" id="mg"><div class="nl">🍃 Mongo</div><div class="ns">document</div></div>
      <div class="node" id="ch"><div class="nl">📊 CH</div><div class="ns">OLAP</div></div>
      <div class="node" id="es"><div class="nl">🔎 ES</div><div class="ns">search</div></div>
      <div class="node" id="rd"><div class="nl">⚡ Redis</div><div class="ns">KV</div></div>
      <div class="node" id="kf"><div class="nl">📜 Kafka</div><div class="ns">log</div></div>
    </div>
    <div class="arrow" id="a3">↓ đảm bảo cho / không cho</div>
    <div class="node" id="g"><div class="nl">🛡️ ACID · nhất quán · độ bền</div><div class="ns">biết mình đang mất gì</div></div>
  `,
  steps: [
    { title: "1 · Bắt đầu từ câu hỏi truy cập", tab: "check", highlight: [1, 2], on: ["q"],
      desc: "Không bắt đầu từ 'DB nào đang hot'." },
    { title: "2 · Chọn cấu trúc", tab: "check", highlight: [3, 4, 5], on: ["a1", "s"],
      desc: "Cấu trúc quyết định chi phí đọc, ghi và đảm bảo." },
    { title: "3 · Một luồng nghiệp vụ, nhiều DB", tab: "flow", highlight: [2, 4, 6, 7, 8], on: ["a2", "pg", "kf", "ch", "es", "rd"],
      desc: "PostgreSQL là nguồn sự thật; Kafka nối; các DB khác là view dẫn xuất." },
    { title: "4 · Đọc có cache và replica", tab: "flow", highlight: [9, 10], on: ["rd", "pg"],
      desc: "Cache-aside; đọc primary ngay sau khi ghi để có read-your-writes." },
    { title: "5 · Nhận ra thiết kế sai", tab: "smells", highlight: [1, 2, 3, 4, 5, 6], on: ["a3", "g"],
      desc: "Mỗi dòng là một bài toán bị đặt nhầm vào cấu trúc không hợp." }
  ],

  quiz: [
    { q: "Bài toán: dashboard doanh thu theo ngày trên 3 năm sự kiện. Chọn gì?", options: [
        "Redis", "ClickHouse", "Elasticsearch", "PostgreSQL OLTP chính"
      ], correct: 1, explanation: "Quét nhiều dòng, ít cột → column-store." },
    { q: "Bài toán: tìm sản phẩm theo tên có dấu/không dấu, xếp theo liên quan. Chọn gì?", options: [
        "Elasticsearch với analyzer asciifolding", "Kafka", "Redis string", "ClickHouse"
      ], correct: 0, explanation: "Inverted index + BM25." },
    { q: "Bài toán: trừ tồn kho khi đặt hàng, không được bán quá số lượng. Chọn gì và làm thế nào?", options: [
        "Redis không persistence",
        "PostgreSQL với UPDATE ... SET qty = qty - 1 WHERE qty > 0 trong transaction",
        "Elasticsearch",
        "ClickHouse mutation"
      ], correct: 1, explanation: "ACID + update nguyên tử tránh lost update." },
    { q: "Đơn vị I/O nhỏ nhất của PostgreSQL là?", options: ["Dòng", "Page 8 KB", "Bảng", "Cột"], correct: 1,
      explanation: "Bài 02." },
    { q: "COMMIT trong PostgreSQL chờ điều gì (synchronous_commit=on, không replica đồng bộ)?", options: [
        "Page dữ liệu được ghi đĩa",
        "Bản ghi WAL của transaction được fsync",
        "VACUUM chạy xong",
        "Replica xác nhận"
      ], correct: 1, explanation: "Bài 03." },
    { q: "Cấu trúc nào ghi tuần tự vào file bất biến rồi gộp dần ở nền?", options: [
        "B-tree", "LSM-tree (và segment Lucene, part MergeTree)", "Hash index", "Heap page"
      ], correct: 1, explanation: "Bài 05." },
    { q: "Trong PostgreSQL, UPDATE một dòng tạo ra gì?", options: [
        "Ghi đè tại chỗ",
        "Tuple mới; tuple cũ được đặt xmax và thành dead tuple chờ VACUUM",
        "Bản ghi trong undo log",
        "Không gì cả"
      ], correct: 1, explanation: "Bài 09." },
    { q: "Anomaly nào lọt qua Repeatable Read (snapshot isolation) của PostgreSQL?", options: [
        "Dirty read", "Non-repeatable read", "Write skew", "Phantom"
      ], correct: 2, explanation: "Bài 10 — cần Serializable hoặc khoá tường minh." },
    { q: "Cách phòng deadlock tốt nhất?", options: [
        "Tăng timeout", "Khoá theo cùng một thứ tự, transaction ngắn", "Tắt lock", "Thêm index"
      ], correct: 1, explanation: "Bài 11." },
    { q: "EXPLAIN ANALYZE: rows ước lượng 12, thực tế 980.000. Nghĩ tới gì đầu tiên?", options: [
        "Đĩa hỏng",
        "Thống kê sai/thiếu (cột tương quan, chưa ANALYZE) khiến planner chọn plan tệ",
        "Thiếu RAM JVM",
        "Kafka lag"
      ], correct: 1, explanation: "Bài 12." },
    { q: "MongoDB: khi nào tách comment ra collection riêng thay vì nhúng?", options: [
        "Khi số comment có thể tăng không giới hạn",
        "Khi chỉ có 2 comment",
        "Không bao giờ",
        "Khi dùng index"
      ], correct: 0, explanation: "Bài 13 — giới hạn 16 MB và chi phí ghi lại document." },
    { q: "Thiết kế quan trọng nhất của bảng ClickHouse MergeTree?", options: [
        "Tên bảng", "ORDER BY (thứ tự lưu + sparse primary index)", "Số cột", "Charset"
      ], correct: 1, explanation: "Bài 14." },
    { q: "Vì sao vừa index vào ES, search chưa thấy?", options: [
        "Lỗi", "Near-real-time: phải chờ refresh (~1s) tạo segment mới", "Thiếu replica", "Translog đầy"
      ], correct: 1, explanation: "Bài 15." },
    { q: "Lệnh nào nguy hiểm trên Redis production nhiều key?", options: [
        "GET", "KEYS *", "INCR", "EXPIRE"
      ], correct: 1, explanation: "Bài 16 — chặn event loop một luồng." },
    { q: "Muốn mọi sự kiện của cùng một đơn hàng được xử lý đúng thứ tự trong Kafka?", options: [
        "Dùng 1 consumer group cho mỗi đơn",
        "Dùng orderId làm key để cùng partition",
        "Tăng retention",
        "Dùng log compaction"
      ], correct: 1, explanation: "Bài 17." },
    { q: "Đọc từ replica ngay sau khi user sửa hồ sơ có thể gây gì?", options: [
        "Deadlock", "Thấy dữ liệu cũ do replication lag", "Mất dữ liệu", "Tăng isolation"
      ], correct: 1, explanation: "Bài 18 — cần read-your-writes." },
    { q: "Redis Cluster: MGET hai key khác slot trả lỗi CROSSSLOT. Sửa thế nào?", options: [
        "Tăng số slot",
        "Dùng hash tag, vd {user:42}:name và {user:42}:cart",
        "Tắt cluster",
        "Dùng KEYS"
      ], correct: 1, explanation: "Bài 19." },
    { q: "Nhất quán giữa các service mỗi service một DB được xử lý bằng?", options: [
        "2PC cho mọi request",
        "Outbox + consumer idempotent + saga (eventual consistency)",
        "Một DB dùng chung",
        "Không cần xử lý"
      ], correct: 1, explanation: "Bài 20." }
  ]
});
