window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Vận hành",
  title: "Hiệu năng & monitoring: _cat, slowlog, profile, hot threads, circuit breaker",
  subtitle: "đọc sức khoẻ cụm trong 5 lệnh · bắt query chậm · mổ xẻ một query · rejected & breaker · checklist tối ưu",

  theory: `
    <p><strong>5 lệnh đầu tiên khi "ES chậm"</strong></p>
    <ol>
      <li><code>_cluster/health</code>: status, shard chưa phân bổ, <code>number_of_pending_tasks</code>.</li>
      <li><code>_cat/nodes</code>: <code>heap.percent</code> (liên tục &gt; 85% là báo động), <code>cpu</code>, <code>load_1m</code>, role, ai là master.</li>
      <li><code>_cat/thread_pool/search,write</code>: <code>active</code>, <code>queue</code>, <code>rejected</code>. Rejected tăng = đang trả 429.</li>
      <li><code>_nodes/hot_threads</code>: thread nào đang ăn CPU (merge? search? GC?).</li>
      <li><code>_cat/indices?s=store.size:desc</code>, <code>_cat/shards</code>: index/shard nào bất thường, có shard lệch không.</li>
    </ol>

    <p><strong>Slowlog</strong> — log mọi query/indexing vượt ngưỡng, <em>theo từng index</em>, ở mức shard. Tách pha <code>query</code> (tìm + chấm điểm) và <code>fetch</code> (lấy _source). Đặt ngưỡng <code>warn</code>/<code>info</code>; log có cả nguồn query (<code>source</code>) và từ 8.x có thể kèm user (<code>include.user</code>). Đây là cách tìm "query nào đang giết cụm" trên production.</p>

    <p><strong>Profile API</strong> — thêm <code>"profile": true</code> để có thời gian từng thành phần Lucene (TermQuery, BooleanQuery, <code>build_scorer</code>, <code>next_doc</code>, <code>score</code>…) trên từng shard, và thời gian từng aggregation. Kibana có Search Profiler để xem trực quan. Chỉ dùng khi debug (tốn thêm chi phí).</p>

    <p><strong>Circuit breaker</strong>: ES ước lượng bộ nhớ một request sẽ dùng; vượt ngưỡng thì từ chối với <code>circuit_breaking_exception</code> (HTTP 429) thay vì để JVM OutOfMemory. <code>parent</code> (tổng, mặc định 95% heap khi bật real-memory), <code>request</code> (60%, cho agg), <code>fielddata</code> (40%). Gặp breaker = query/agg quá nặng hoặc heap quá nhỏ, không phải "lỗi ngẫu nhiên".</p>

    <p><strong>Checklist tối ưu search</strong></p>
    <ul>
      <li>Điều kiện yes/no vào <code>filter</code>; làm tròn <code>now</code> (bài 08–09).</li>
      <li>Chỉ lấy field cần: <code>_source: ["id","name","price"]</code> hoặc <code>_source: false</code> + <code>fields</code>; <code>size</code> nhỏ.</li>
      <li>Tránh script query, wildcard đầu chuỗi, regexp; tránh from/size sâu.</li>
      <li>ID dạng keyword; tránh <code>nested</code>/<code>join</code> nếu denormalize được.</li>
      <li>Agg nặng: <code>size: 0</code> để trúng request cache; ưu tiên <code>composite</code> khi duyệt nhiều bucket.</li>
      <li><code>preference</code> (vd theo user id) để các request của cùng người dùng rơi vào cùng bản shard → cache ấm, kết quả ổn định.</li>
    </ul>
    <p><strong>Checklist tối ưu indexing</strong>: bulk, nhiều worker song song, <code>refresh_interval</code> dài hơn (5–30s) nếu chấp nhận trễ, tránh update từng doc, <code>_id</code> do bạn quản lý nhưng biết rằng ES phải kiểm tra trùng (auto-id nhanh hơn một chút cho log).</p>

    <p><strong>Giám sát liên tục</strong>: Elastic Stack Monitoring (Metricbeat/Elastic Agent → Kibana), hoặc exporter Prometheus. OpenSearch có Performance Analyzer và plugin Observability. Cảnh báo tối thiểu: status ≠ green, heap &gt; 85%, disk &gt; 80%, rejected &gt; 0, p99 latency search.</p>

    <div class="callout"><p>💡 Tương đương PostgreSQL: slowlog ≈ <code>log_min_duration_statement</code>, profile ≈ <code>EXPLAIN ANALYZE</code>, _cat/thread_pool ≈ <code>pg_stat_activity</code> đang chờ. Cách làm giống nhau: đo trước, đoán sau.</p></div>
  `,

  codeTabs: [
    { id: "cat", label: "① Sức khoẻ nhanh", lines: [
      "GET /_cat/nodes?v&h=name,node.role,master,heap.percent,ram.percent,cpu,load_1m",
      "name       node.role master heap.percent ram.percent cpu load_1m",
      "es-data-1  hs        -                91          98  87    9.12",
      "es-data-2  hs        -                54          97  23    1.80",
      "es-m-1     m         *                31          60   2    0.10",
      "",
      "GET /_cat/thread_pool/search,write?v&h=node_name,name,active,queue,rejected",
      "es-data-1  search  13  870   2211     // hàng đợi đầy, đang từ chối",
      "",
      "GET /_nodes/es-data-1/hot_threads"
    ]},
    { id: "slow", label: "② Slowlog", lines: [
      "PUT /products/_settings",
      "{ \"index.search.slowlog.threshold.query.warn\": \"2s\",",
      "  \"index.search.slowlog.threshold.query.info\": \"500ms\",",
      "  \"index.search.slowlog.threshold.fetch.warn\": \"1s\",",
      "  \"index.indexing.slowlog.threshold.index.warn\": \"5s\" }",
      "",
      "# logs/prod-search_index_search_slowlog.json",
      "{ \"elasticsearch.slowlog.took\": \"3.1s\", \"elasticsearch.index.name\": \"products\",",
      "  \"elasticsearch.slowlog.source\": \"{\\\"query\\\":{\\\"wildcard\\\":{\\\"sku.raw\\\":\\\"*55*\\\"}}}\" }"
    ]},
    { id: "prof", label: "③ Profile API", lines: [
      "POST /products/_search",
      "{ \"profile\": true, \"query\": { \"bool\": {",
      "    \"must\": [ { \"match\": { \"name\": \"tai nghe\" } } ],",
      "    \"filter\": [ { \"range\": { \"price\": { \"lte\": 2000000 } } } ] } } }",
      "",
      "\"profile\": { \"shards\": [ { \"searches\": [ { \"query\": [",
      "  { \"type\": \"BooleanQuery\", \"time_in_nanos\": 1873000, \"children\": [",
      "    { \"type\": \"TermQuery\", \"description\": \"name:tai\",  \"time_in_nanos\": 402000 },",
      "    { \"type\": \"IndexOrDocValuesQuery\", \"description\": \"price:[-inf TO 2000000]\", \"time_in_nanos\": 1210000 } ] } ]"
    ]},
    { id: "cb", label: "④ Breaker & tối ưu", lines: [
      "# circuit_breaking_exception: [parent] Data too large, data for [<http_request>]",
      "#   would be [31.2gb], which is larger than the limit of [30.4gb]   → HTTP 429",
      "",
      "GET /_nodes/stats/breaker",
      "",
      "POST /products/_search?preference=user-8812",
      "{ \"_source\": [ \"id\", \"name\", \"price\", \"thumb\" ], \"size\": 20,",
      "  \"query\": { \"bool\": { \"must\": [ ... ], \"filter\": [ ... ] } } }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="alert"><div class="nl">🚨 p99 search tăng vọt</div><div class="ns">alert từ monitoring</div></div>
    <div class="arrow" id="a1">↓ _cat/nodes, thread_pool</div>
    <div class="node" id="node"><div class="nl">🖥️ es-data-1: heap 91%, queue 870</div><div class="ns">node nào, tài nguyên nào</div></div>
    <div class="arrow" id="a2">↓ slowlog</div>
    <div class="node" id="q"><div class="nl">🐢 wildcard *55* 3.1s</div><div class="ns">query nào</div></div>
    <div class="arrow" id="a3">↓ profile</div>
    <div class="node" id="fix"><div class="nl">🔧 Viết lại query / đổi mapping</div><div class="ns">thành phần nào tốn</div></div>
  `,
  steps: [
    { title: "1 · Node nào có vấn đề", tab: "cat", highlight: [1, 3, 8], on: ["alert", "a1", "node"],
      desc: "es-data-1 heap 91%, CPU 87%, hàng đợi search đầy và đã từ chối 2211 request." },
    { title: "2 · Nó đang làm gì", tab: "cat", highlight: [10], on: ["node"],
      desc: "hot_threads cho stack trace của thread nóng nhất: search, merge hay GC." },
    { title: "3 · Query nào chậm", tab: "slow", highlight: [2, 3, 8, 9], on: ["a2", "q"],
      desc: "Slowlog ghi lại nguyên văn query vượt ngưỡng: wildcard đầu chuỗi." },
    { title: "4 · Mổ xẻ query", tab: "prof", highlight: [2, 7, 8, 9], on: ["a3", "fix"],
      desc: "Profile cho thời gian từng Lucene query con trên từng shard." },
    { title: "5 · Breaker là tín hiệu, không phải lỗi ngẫu nhiên", tab: "cb", highlight: [1, 2, 4], on: ["node"],
      desc: "ES từ chối request thay vì OOM. Giảm kích thước agg/request hoặc thêm heap/node." },
    { title: "6 · Viết query rẻ hơn", tab: "cb", highlight: [6, 7, 8], on: ["fix"],
      desc: "Chỉ lấy field cần, filter context, preference giữ cache ấm." }
  ],

  quiz: [
    { q: "Cột rejected trong _cat/thread_pool/search tăng nghĩa là gì?", options: [
        "Query sai cú pháp",
        "Hàng đợi search đầy, ES đang trả 429 cho request mới",
        "Mất shard",
        "Index read-only"
      ], correct: 1, explanation: "Cụm quá tải so với lưu lượng hoặc query quá nặng." },
    { q: "Slowlog được cấu hình ở mức nào?", options: [
        "Toàn cụm duy nhất", "Theo từng index (settings), ghi ở mức shard", "Theo user", "Theo node role"
      ], correct: 1, explanation: "index.search.slowlog.threshold.*" },
    { q: "Slowlog tách hai pha search nào?", options: [
        "parse và execute", "query và fetch", "read và write", "map và reduce"
      ], correct: 1, explanation: "Fetch chậm thường do _source lớn hoặc size lớn." },
    { q: "Công cụ tương đương EXPLAIN ANALYZE của PostgreSQL?", options: [
        "_analyze", "profile: true", "explain: true", "_cat/indices"
      ], correct: 1, explanation: "explain giải thích điểm; profile đo thời gian thực thi." },
    { q: "circuit_breaking_exception có ý nghĩa gì?", options: [
        "Mất kết nối mạng",
        "ES ước lượng request sẽ vượt giới hạn bộ nhớ nên từ chối để tránh OOM",
        "Sai mật khẩu",
        "Shard hỏng"
      ], correct: 1, explanation: "Trả HTTP 429; cần giảm tải request hoặc tăng tài nguyên." },
    { q: "_nodes/hot_threads dùng để làm gì?", options: [
        "Liệt kê index nóng",
        "Xem thread đang tốn CPU nhất trên node và stack trace",
        "Tăng thread",
        "Xoá thread treo"
      ], correct: 1, explanation: "Phân biệt search, merge, GC…" },
    { q: "Tham số preference=user-8812 giúp gì?", options: [
        "Phân quyền",
        "Request cùng user rơi vào cùng bản shard: cache ấm, thứ tự kết quả ổn định",
        "Tăng độ chính xác agg",
        "Bỏ qua replica"
      ], correct: 1, explanation: "Tránh kết quả 'nhảy' giữa primary/replica có thống kê hơi khác." },
    { q: "Cách giảm thời gian pha fetch?", options: [
        "Tăng refresh",
        "Chỉ lấy field cần qua _source includes/fields và giữ size nhỏ",
        "Bật fielddata",
        "Tăng shard"
      ], correct: 1, explanation: "Fetch đọc và giải nén _source của từng hit." },
    { q: "Ngưỡng cảnh báo heap hợp lý cho data node?", options: [
        "Liên tục > 85%", "> 10%", "> 99% mới lo", "Không cần theo dõi"
      ], correct: 0, explanation: "Heap cao kéo dài dẫn tới GC dài và breaker." }
  ]
});
