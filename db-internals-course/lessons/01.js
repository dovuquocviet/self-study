window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Bản đồ",
  title: "Bản đồ: 6 database, 6 mô hình, 6 kiểu workload",
  subtitle: "Vì sao công ty dùng cả PostgreSQL, MongoDB, ClickHouse, Elasticsearch, Redis lẫn Kafka",

  theory: `
    <p>Với Spring, DB thường là "cái sau <code>JpaRepository</code>". Nhưng mỗi DB được thiết kế quanh <strong>một câu hỏi truy cập</strong> cụ thể, và cấu trúc lưu trữ bên dưới
    được chọn để trả lời câu hỏi đó nhanh nhất. Chọn sai mô hình thì tối ưu code bao nhiêu cũng không cứu được.</p>

    <table>
      <tr><th>DB</th><th>Mô hình</th><th>Câu hỏi nó trả lời giỏi</th><th>Cấu trúc lõi</th></tr>
      <tr><td>PostgreSQL</td><td>Quan hệ, OLTP</td><td>"Đọc/sửa vài dòng theo khoá, đúng tuyệt đối, nhiều người cùng lúc"</td><td>Heap page 8 KB + B-tree + WAL + MVCC</td></tr>
      <tr><td>MongoDB</td><td>Document</td><td>"Lấy cả một aggregate (đơn hàng + dòng hàng) trong một lần đọc"</td><td>BSON trong WiredTiger (B-tree, nén)</td></tr>
      <tr><td>ClickHouse</td><td>Cột, OLAP</td><td>"Quét hàng tỷ dòng, tổng hợp vài cột"</td><td>MergeTree: file theo cột, nén, sparse index</td></tr>
      <tr><td>Elasticsearch</td><td>Search</td><td>"Tài liệu nào chứa các từ này, xếp theo độ liên quan"</td><td>Inverted index (Lucene segment)</td></tr>
      <tr><td>Redis</td><td>Key-value in-memory</td><td>"Lấy/sửa giá trị theo key trong micro-giây"</td><td>Hash table trong RAM, event loop một luồng</td></tr>
      <tr><td>Kafka</td><td>Log phân tán</td><td>"Ghi sự kiện theo thứ tự, cho nhiều bên đọc lại"</td><td>File log append-only chia partition</td></tr>
    </table>

    <p><strong>Hai trục phân loại workload</strong></p>
    <ul>
      <li><strong>OLTP</strong> (Online Transaction Processing): nhiều truy vấn nhỏ, chạm vài dòng, cần transaction. Ví dụ: tạo đơn hàng.</li>
      <li><strong>OLAP</strong> (Online Analytical Processing): ít truy vấn, mỗi truy vấn quét rất nhiều dòng nhưng ít cột. Ví dụ: doanh thu theo ngày trong 2 năm.</li>
      <li><strong>Ghi nhiều hay đọc nhiều?</strong> Quyết định chọn B-tree (đọc tốt, ghi tại chỗ) hay LSM-tree (ghi tuần tự, đọc phải gộp).</li>
    </ul>

    <p><strong>Kiến trúc hiện tại của công ty</strong>: mỗi service một DB riêng (database-per-service). Kafka là "xương sống" sự kiện;
    ClickHouse <em>tiêu thụ</em> Kafka để có dữ liệu phân tích mà không đụng DB OLTP. Nghĩa là cùng một sự kiện "OrderCreated" có thể nằm ở:
    PostgreSQL (nguồn sự thật), Kafka (log sự kiện), ClickHouse (bảng phân tích), Elasticsearch (để tìm kiếm), Redis (cache).</p>

    <p><strong>Lộ trình khoá</strong>: nền tảng lưu trữ (page, WAL, B-tree, LSM, row vs column, index) → transaction &amp; đồng thời (ACID, MVCC, isolation, lock, planner)
    → từng mô hình (document, cột, search, KV, log) → phân tán (replication, sharding, CAP/PACELC) → bảng chọn DB.</p>

    <div class="callout"><p>💡 Câu hỏi của kỹ sư không phải "DB nào tốt nhất" mà là "truy vấn chính là gì, tỉ lệ đọc/ghi thế nào, cần đúng tới mức nào, dữ liệu lớn cỡ nào".
    Trả lời xong 4 câu đó thì mô hình lưu trữ gần như tự lộ ra.</p></div>
  `,

  codeTabs: [
    { id: "same", label: "Một sự kiện, 5 nơi", lines: [
      "-- PostgreSQL: nguồn sự thật, có transaction",
      "INSERT INTO orders(id, user_id, total, status) VALUES (1001, 42, 350000, 'NEW');",
      "",
      "# Kafka: sự kiện append vào topic, key = order id",
      "topic=orders partition=3 offset=88213 key=1001 value={\"type\":\"OrderCreated\",...}",
      "",
      "-- ClickHouse: consumer Kafka ghi vào bảng cột để phân tích",
      "SELECT toDate(created_at) d, sum(total) FROM orders_events GROUP BY d;",
      "",
      "# Elasticsearch: tài liệu để tìm theo tên sản phẩm",
      "PUT /orders/_doc/1001 { \"items\": [\"áo thun cotton\"], \"total\": 350000 }",
      "",
      "# Redis: cache trạng thái đơn, hết hạn sau 300 giây",
      "SET order:1001:status NEW EX 300"
    ]},
    { id: "questions", label: "4 câu hỏi chọn DB", lines: [
      "1. Truy vấn chính?        theo khoá | quét-tổng hợp | full-text | theo thứ tự thời gian",
      "2. Tỉ lệ đọc / ghi?       đọc nhiều → B-tree | ghi dồn dập → LSM / append log",
      "3. Cần đúng tới đâu?      tiền, tồn kho → ACID | view counter → chấp nhận xấp xỉ",
      "4. Dữ liệu cỡ nào?        vừa RAM → Redis | TB, nhiều năm → cột + nén + phân mảnh"
    ]},
    { id: "java", label: "Góc nhìn Spring", lines: [
      "// Spring: cùng một 'Repository' che hết mọi thứ",
      "interface OrderRepo extends JpaRepository<Order, Long> {}",
      "interface OrderDocRepo extends MongoRepository<OrderDoc, String> {}",
      "interface OrderSearchRepo extends ElasticsearchRepository<OrderIdx, String> {}",
      "",
      "// Nhưng phía sau là 3 cấu trúc khác hẳn:",
      "//  - JPA  → heap page + B-tree + MVCC",
      "//  - Mongo → BSON trong WiredTiger B-tree",
      "//  - ES   → inverted index, refresh ~1s mới tìm thấy (near-real-time)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="svc"><div class="nl">🧩 Order service</div><div class="ns">ghi đơn hàng</div></div>
    <div class="arrow" id="a1">↓ transaction</div>
    <div class="node" id="pg"><div class="nl">🐘 PostgreSQL</div><div class="ns">nguồn sự thật (OLTP)</div></div>
    <div class="arrow" id="a2">↓ publish sự kiện</div>
    <div class="node" id="kf"><div class="nl">📜 Kafka topic orders</div><div class="ns">log append-only</div></div>
    <div class="arrow" id="a3">↓ nhiều consumer độc lập</div>
    <div class="row">
      <div class="node" id="ch"><div class="nl">📊 ClickHouse</div><div class="ns">OLAP</div></div>
      <div class="node" id="es"><div class="nl">🔎 Elasticsearch</div><div class="ns">search</div></div>
      <div class="node" id="rd"><div class="nl">⚡ Redis</div><div class="ns">cache</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Ghi vào nguồn sự thật", tab: "same", highlight: [1, 2], on: ["svc", "a1", "pg"],
      desc: "Tiền và trạng thái đơn cần ACID → PostgreSQL. Đây là nơi duy nhất được coi là đúng tuyệt đối." },
    { title: "2 · Phát sự kiện vào log", tab: "same", highlight: [4, 5], on: ["a2", "kf"],
      desc: "Kafka gán <code>offset</code> tăng dần trong partition. Consumer nào đọc lại cũng thấy cùng thứ tự." },
    { title: "3 · Phân tích bằng ClickHouse", tab: "same", highlight: [7, 8], on: ["a3", "ch"],
      desc: "Truy vấn quét hàng triệu dòng nhưng chỉ 2 cột → mô hình cột thắng áp đảo." },
    { title: "4 · Tìm kiếm & cache", tab: "same", highlight: [10, 11, 13, 14], on: ["es", "rd"],
      desc: "ES trả lời 'chứa từ gì'; Redis trả lời 'giá trị của key này' trong RAM. Cả hai là bản sao dẫn xuất, không phải nguồn sự thật." },
    { title: "5 · Chọn DB bằng 4 câu hỏi", tab: "questions", highlight: [1, 2, 3, 4], on: ["pg", "kf", "ch", "es", "rd"],
      desc: "Mỗi DB ở trên là câu trả lời cho một tổ hợp khác nhau của 4 câu hỏi này." }
  ],

  quiz: [
    { q: "Workload OLTP có đặc điểm nào?", options: [
        "Ít truy vấn, mỗi truy vấn quét hàng tỷ dòng",
        "Nhiều truy vấn nhỏ chạm vài dòng, cần transaction",
        "Chỉ ghi, không bao giờ đọc",
        "Chỉ tìm kiếm full-text"
      ], correct: 1, explanation: "OLTP = xử lý giao dịch: tạo đơn, trừ kho, cập nhật trạng thái." },
    { q: "Truy vấn 'tổng doanh thu theo ngày trong 2 năm' là kiểu workload gì?", options: [
        "OLTP", "OLAP", "Cache", "Pub/Sub"
      ], correct: 1, explanation: "Quét rất nhiều dòng, tổng hợp vài cột — đặc trưng OLAP." },
    { q: "Cấu trúc lõi của Elasticsearch để trả lời 'tài liệu nào chứa từ X'?", options: [
        "B-tree trên khoá chính", "Inverted index", "Hash table trong RAM", "File log append-only"
      ], correct: 1, explanation: "Inverted index ánh xạ từ → danh sách tài liệu chứa từ đó." },
    { q: "Trong kiến trúc công ty, ClickHouse lấy dữ liệu từ đâu?", options: [
        "Truy vấn trực tiếp PostgreSQL của từng service",
        "Tiêu thụ sự kiện từ Kafka",
        "Đọc cache Redis",
        "Nhận file CSV hằng đêm"
      ], correct: 1, explanation: "ClickHouse là consumer của Kafka nên không tạo tải lên DB OLTP." },
    { q: "Vì sao Redis và Elasticsearch thường KHÔNG được coi là nguồn sự thật cho đơn hàng?", options: [
        "Vì chúng không lưu được JSON",
        "Vì chúng là bản sao dẫn xuất, tối ưu cho truy cập nhanh/tìm kiếm, không đảm bảo transaction như DB OLTP",
        "Vì chúng không chạy trên Linux",
        "Vì chúng chỉ đọc được, không ghi được"
      ], correct: 1, explanation: "Dữ liệu dẫn xuất có thể dựng lại từ nguồn sự thật (PostgreSQL hoặc log Kafka)." },
    { q: "Tỉ lệ ghi rất cao (log, metric) thường gợi ý cấu trúc lưu trữ nào?", options: [
        "B-tree cập nhật tại chỗ", "LSM-tree hoặc log append-only", "Bảng băm trên đĩa không nén", "Không cần cấu trúc"
      ], correct: 1, explanation: "Ghi tuần tự rẻ hơn nhiều so với ghi ngẫu nhiên vào page có sẵn." },
    { q: "Kafka lưu dữ liệu dưới dạng nào?", options: [
        "Bảng quan hệ", "Log append-only chia theo partition, mỗi bản ghi có offset", "Inverted index", "Document BSON"
      ], correct: 1, explanation: "Offset tăng dần trong mỗi partition cho phép consumer đọc lại theo thứ tự." },
    { q: "JpaRepository, MongoRepository, ElasticsearchRepository trong Spring giống nhau ở điểm nào?", options: [
        "Cùng cấu trúc lưu trữ bên dưới",
        "Chỉ giống nhau ở giao diện lập trình; cơ chế lưu trữ và đảm bảo bên dưới khác hẳn",
        "Cùng mức isolation",
        "Cùng độ trễ ghi-đọc"
      ], correct: 1, explanation: "Abstraction giống nhau che đi khác biệt lớn — ví dụ ES chỉ tìm thấy sau refresh." },
    { q: "Câu hỏi nào KHÔNG thuộc 4 câu hỏi cốt lõi khi chọn DB trong bài?", options: [
        "Truy vấn chính là gì", "Tỉ lệ đọc/ghi", "Logo của DB có đẹp không", "Dữ liệu lớn cỡ nào"
      ], correct: 2, explanation: "4 câu: truy vấn chính, đọc/ghi, mức đúng đắn, kích thước dữ liệu." }
  ]
});
