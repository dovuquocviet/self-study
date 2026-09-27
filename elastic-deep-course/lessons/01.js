window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Bản đồ & kiến trúc",
  title: "Elasticsearch đứng ở đâu trong hệ thống của ta",
  subtitle: "search engine, không phải DB chính · read model · Elasticsearch vs OpenSearch · bảng đối chiếu khái niệm",

  theory: `
    <p>Elasticsearch (ES) là một <strong>search &amp; analytics engine</strong> phân tán, xây trên thư viện Java <strong>Apache Lucene</strong>.
    Bạn nói chuyện với nó bằng HTTP + JSON (cổng 9200). Mỗi node là một JVM; một cụm nhiều node chia dữ liệu thành các <em>shard</em>, mỗi shard là một index Lucene.</p>

    <p><strong>ES giỏi gì, dở gì</strong></p>
    <table>
      <tr><th>Giỏi</th><th>Dở / không phải việc của nó</th></tr>
      <tr><td>Full-text search có xếp hạng (relevance), gõ sai vẫn ra, bỏ dấu tiếng Việt</td><td>Transaction nhiều document (không có ACID đa bản ghi)</td></tr>
      <tr><td>Lọc + đếm + gom nhóm (facet) trên hàng triệu bản ghi trong vài chục ms</td><td>JOIN giữa các index (chỉ có nested/join hạn chế)</td></tr>
      <tr><td>Log, metric, tìm kiếm theo thời gian</td><td>Đọc-ngay-sau-khi-ghi mặc định (near real-time, trễ ~1s)</td></tr>
      <tr><td>Scale ngang bằng cách thêm node</td><td>Làm "nguồn sự thật" (source of truth) cho dữ liệu nghiệp vụ</td></tr>
    </table>

    <p><strong>Vị trí trong kiến trúc của công ty</strong>: mỗi service có DB chính riêng (PostgreSQL, MongoDB…). ES là <strong>read model</strong> — một bản sao đã
    được "định hình lại" để tìm kiếm. Mất ES thì <em>dựng lại được</em> từ DB chính (reindex). Đây là nguyên tắc số 1 cả khoá: dữ liệu gốc không bao giờ chỉ nằm trong ES.</p>

    <p><strong>Elasticsearch vs OpenSearch</strong></p>
    <ul>
      <li>2021 Elastic đổi license (bỏ Apache 2.0 → SSPL/Elastic License). AWS fork bản <strong>7.10.2</strong> thành <strong>OpenSearch</strong> (Apache 2.0, nay thuộc OpenSearch Software Foundation / Linux Foundation). Từ 2024 Elastic bổ sung lựa chọn AGPLv3.</li>
      <li>Cốt lõi giống nhau (Lucene, Query DSL, mapping, shard, bulk). Khác nhau dần ở: quản lý vòng đời (<strong>ILM</strong> vs <strong>ISM</strong>), security (X-Pack vs Security plugin), API Point-in-Time, giao diện (Kibana vs OpenSearch Dashboards), client (crate <code>elasticsearch</code> vs <code>opensearch</code>), các tính năng mới (ES|QL chỉ có ở Elastic).</li>
      <li>Client của hãng này thường <strong>từ chối</strong> nói chuyện với server của hãng kia (kiểm tra header/phiên bản). Chọn đúng client theo server.</li>
    </ul>

    <p><strong>Bảng đối chiếu cho dân Java/SQL</strong></p>
    <table>
      <tr><th>SQL / Spring Data</th><th>Elasticsearch</th></tr>
      <tr><td>Database / table</td><td>Index (từ 7.x không còn "type"; 8.x bỏ hẳn)</td></tr>
      <tr><td>Row</td><td>Document (JSON), khoá <code>_id</code></td></tr>
      <tr><td>Schema DDL</td><td>Mapping (khó đổi sau khi tạo!)</td></tr>
      <tr><td>Index B-tree</td><td>Inverted index (text) + BKD tree (số, ngày) + doc values (sort/agg)</td></tr>
      <tr><td><code>WHERE</code></td><td>Query DSL (<code>bool</code>, <code>term</code>, <code>range</code>…)</td></tr>
      <tr><td><code>GROUP BY</code></td><td>Aggregations</td></tr>
      <tr><td>Partition / sharding</td><td>Shard primary + replica</td></tr>
      <tr><td><code>ElasticsearchRepository.save()</code></td><td>Index API / Bulk API qua HTTP</td></tr>
    </table>

    <div class="callout"><p>💡 Spring Data Elasticsearch che giấu gần hết những thứ trên: annotation <code>@Document</code> tự tạo mapping, <code>save()</code> gửi từng request một.
    Khi chuyển sang Rust, không còn lớp phép thuật đó — bạn tự viết mapping, tự gom bulk, tự chọn refresh. Đó chính là lý do khoá này tồn tại.</p></div>
  `,

  codeTabs: [
    { id: "hello", label: "① Chào cụm", lines: [
      "GET /",
      "# → { \"name\": \"es-node-1\", \"cluster_name\": \"prod-search\",",
      "#     \"version\": { \"number\": \"8.15.0\", \"lucene_version\": \"9.11.1\" },",
      "#     \"tagline\": \"You Know, for Search\" }",
      "",
      "GET /_cluster/health",
      "# → { \"status\": \"green\", \"number_of_nodes\": 3,",
      "#     \"active_primary_shards\": 12, \"active_shards\": 24 }"
    ]},
    { id: "crud", label: "② CRUD cơ bản", lines: [
      "PUT /products/_doc/42",
      "{ \"name\": \"Điện thoại Galaxy A55\", \"price\": 8990000, \"brand\": \"samsung\" }",
      "",
      "GET /products/_doc/42          // đọc theo _id: real-time, không cần chờ refresh",
      "",
      "POST /products/_search",
      "{ \"query\": { \"match\": { \"name\": \"dien thoai\" } } }   // search: near real-time",
      "",
      "DELETE /products/_doc/42"
    ]},
    { id: "java", label: "③ Spring Data (cũ)", lines: [
      "@Document(indexName = \"products\")",
      "public class Product {",
      "    @Id private String id;",
      "    @Field(type = FieldType.Text) private String name;",
      "    private long price;",
      "}",
      "",
      "public interface ProductRepo extends ElasticsearchRepository<Product, String> {",
      "    List<Product> findByName(String name);   // sinh ra query gì? ít ai biết",
      "}"
    ]},
    { id: "arch", label: "④ Luồng dữ liệu", lines: [
      "order-service  ──► PostgreSQL (source of truth)",
      "      │",
      "      └─ outbox/CDC ─► Kafka ─► indexer (Rust) ─► Elasticsearch (read model)",
      "                              └──────────────► ClickHouse (analytics)",
      "",
      "search-api (Rust) ─► Elasticsearch   // chỉ đọc",
      "",
      "# ES chết / mapping sai → xoá index, reindex lại từ PostgreSQL hoặc replay Kafka"
    ]}
  ],

  stageHtml: `
    <div class="node" id="db"><div class="nl">🐘 PostgreSQL / MongoDB</div><div class="ns">source of truth của từng service</div></div>
    <div class="arrow" id="a1">↓ sự kiện thay đổi (Kafka)</div>
    <div class="node" id="idx"><div class="nl">⚙️ Indexer</div><div class="ns">biến row → document phẳng, gửi bulk</div></div>
    <div class="arrow" id="a2">↓ HTTP /_bulk</div>
    <div class="node" id="es"><div class="nl">🔎 Elasticsearch</div><div class="ns">read model: search, filter, aggregation</div></div>
    <div class="arrow" id="a3">↓ /_search</div>
    <div class="node" id="api"><div class="nl">🦀 search-api</div><div class="ns">trả kết quả cho mobile / web</div></div>
  `,
  steps: [
    { title: "1 · Nói chuyện bằng HTTP", tab: "hello", highlight: [1, 3, 6, 7], on: ["es"],
      desc: "Mọi thao tác đều là HTTP + JSON. <code>GET /</code> cho biết phiên bản ES và Lucene bên dưới; <code>_cluster/health</code> cho biết cụm khoẻ không." },
    { title: "2 · Document và _id", tab: "crud", highlight: [1, 2, 4], on: ["es"],
      desc: "Document là JSON. Đọc theo <code>_id</code> luôn thấy bản mới nhất (real-time GET), khác với search." },
    { title: "3 · Search là near real-time", tab: "crud", highlight: [6, 7], on: ["a3", "api"],
      desc: "Search chỉ thấy dữ liệu sau lần <em>refresh</em> kế tiếp (mặc định ~1s). Bài 14 mổ xẻ cơ chế này." },
    { title: "4 · Spring đã giấu gì", tab: "java", highlight: [1, 4, 8, 9], on: ["es"],
      desc: "Annotation sinh mapping, method name sinh query. Tiện nhưng không biết mình đang gửi gì cho ES." },
    { title: "5 · ES là read model", tab: "arch", highlight: [1, 3, 8], on: ["db", "a1", "idx", "a2", "es"],
      desc: "Dữ liệu gốc ở DB của service. ES được nuôi bằng sự kiện và có thể dựng lại bất cứ lúc nào." }
  ],

  quiz: [
    { q: "Elasticsearch được xây trên thư viện nào?", options: [
        "RocksDB", "Apache Lucene", "LevelDB", "PostgreSQL"
      ], correct: 1, explanation: "Mỗi shard ES là một index Lucene." },
    { q: "Trong kiến trúc mỗi service một DB, vai trò đúng của ES là gì?", options: [
        "Source of truth thay cho PostgreSQL",
        "Read model phục vụ tìm kiếm, dựng lại được từ DB chính",
        "Message broker",
        "Cache session"
      ], correct: 1, explanation: "ES không có transaction đa document; dữ liệu gốc phải nằm ở DB chính." },
    { q: "OpenSearch ra đời thế nào?", options: [
        "Elastic tự tách bản miễn phí",
        "Fork từ Elasticsearch 7.10.2 sau khi Elastic đổi license năm 2021",
        "Viết lại từ đầu bằng Rust",
        "Fork từ Solr"
      ], correct: 1, explanation: "AWS fork bản 7.10.2 (Apache 2.0) cuối cùng." },
    { q: "Quản lý vòng đời index ở OpenSearch gọi là gì?", options: [
        "ILM", "ISM (Index State Management)", "SLM", "CCR"
      ], correct: 1, explanation: "Elastic dùng ILM, OpenSearch dùng ISM với cú pháp policy khác." },
    { q: "GET /products/_doc/42 ngay sau khi PUT có thấy dữ liệu mới không?", options: [
        "Có — GET theo _id là real-time",
        "Không, phải chờ refresh",
        "Chỉ khi refresh_interval = -1",
        "Chỉ trên primary"
      ], correct: 0, explanation: "GET theo _id đọc được cả thay đổi chưa refresh; còn _search thì phải chờ refresh." },
    { q: "Khái niệm SQL nào tương ứng với mapping?", options: [
        "Index B-tree", "Schema / DDL của bảng", "View", "Trigger"
      ], correct: 1, explanation: "Mapping định nghĩa kiểu từng field, và rất khó thay đổi sau khi tạo." },
    { q: "Việc nào ES làm DỞ?", options: [
        "Tìm kiếm gõ sai chính tả",
        "Đếm theo nhóm trên hàng triệu bản ghi",
        "Transaction cập nhật nhiều document cùng lúc kiểu ACID",
        "Tìm kiếm log theo thời gian"
      ], correct: 2, explanation: "ES chỉ đảm bảo nguyên tử trên từng document." },
    { q: "Dùng client crate elasticsearch để gọi cụm OpenSearch có ổn không?", options: [
        "Luôn ổn vì API giống hệt",
        "Không nên — client mới kiểm tra sản phẩm/phiên bản và có thể từ chối; dùng crate opensearch",
        "Chỉ lỗi với bulk",
        "Chỉ lỗi khi bật TLS"
      ], correct: 1, explanation: "Hai dự án đã tách xa; hãy dùng client đúng hãng." },
    { q: "Mapping sai trên production, cách khắc phục an toàn là?", options: [
        "Sửa trực tiếp kiểu field",
        "Tạo index mới với mapping đúng, reindex/nạp lại từ nguồn, đổi alias",
        "Restart cụm",
        "Xoá field trong _source"
      ], correct: 1, explanation: "Đây là lý do ES phải là read model có thể dựng lại (bài 16)." }
  ]
});
