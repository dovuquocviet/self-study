window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Bản đồ & kiến trúc",
  title: "Cluster, node role, shard primary/replica",
  subtitle: "master election · routing _id → shard · đường đi của write và search · green/yellow/red",

  theory: `
    <p><strong>Node role</strong> (khai báo <code>node.roles</code> trong <code>elasticsearch.yml</code>):</p>
    <table>
      <tr><th>Role</th><th>Làm gì</th></tr>
      <tr><td><code>master</code></td><td>Master-eligible: được bầu làm master, giữ <strong>cluster state</strong> (mapping, danh sách index, shard nằm ở node nào). Không đụng vào dữ liệu.</td></tr>
      <tr><td><code>data</code> / <code>data_hot</code>, <code>data_warm</code>, <code>data_cold</code>, <code>data_frozen</code>, <code>data_content</code></td><td>Giữ shard, chạy indexing, search, aggregation. Tốn heap, CPU, disk.</td></tr>
      <tr><td><code>ingest</code></td><td>Chạy ingest pipeline (biến đổi document trước khi index).</td></tr>
      <tr><td><code>node.roles: []</code></td><td><strong>Coordinating-only</strong>: nhận request, phân tán, gom kết quả. Mọi node đều làm việc coordinating cho request nó nhận.</td></tr>
    </table>
    <p>Production: <strong>3 node master-eligible</strong> (số lẻ) để bầu chọn theo đa số (quorum). Mất 1 vẫn còn 2/3 → cụm sống. Chỉ có 2 master-eligible mà mất 1 thì không đủ đa số → cụm đứng. Từ 7.x cơ chế bầu chọn tự quản lý voting configuration, chỉ cần <code>cluster.initial_master_nodes</code> lúc khởi tạo lần đầu.</p>

    <p><strong>Shard</strong>: index được chia thành <code>number_of_shards</code> <em>primary shard</em> (mặc định 1 từ 7.0, <strong>cố định sau khi tạo</strong> — chỉ đổi được bằng split/shrink/reindex). Mỗi primary có <code>number_of_replicas</code> bản sao (mặc định 1, đổi được bất cứ lúc nào). Replica không bao giờ nằm cùng node với primary của nó.</p>

    <p><strong>Routing</strong>: document đi vào shard nào được tính bằng <code>hash(_routing) % số primary</code> (có thêm hệ số routing shards nội bộ), <code>_routing</code> mặc định = <code>_id</code>. Vì công thức phụ thuộc số primary, đổi số primary = mọi document "lạc nhà" → nên mới cố định.</p>

    <p><strong>Đường đi của một write</strong>: node nhận request (coordinating) tính routing → chuyển tới <strong>primary</strong> → primary ghi xong gửi song song tới các replica in-sync → tất cả in-sync copy xác nhận thì mới trả 200. <br/>
    <strong>Đường đi của search</strong> (<code>query_then_fetch</code>): coordinating gửi query tới <em>một bản</em> (primary hoặc replica) của mỗi shard → mỗi shard trả top N (chỉ id + score) → coordinating trộn, chọn top N toàn cục → pha <em>fetch</em> lấy <code>_source</code> của đúng N document đó. Replica vì thế giúp tăng thông lượng đọc.</p>

    <p><strong>Health</strong>: <code>green</code> mọi shard đã phân bổ; <code>yellow</code> mọi primary OK nhưng thiếu replica (cụm 1 node luôn yellow nếu replicas=1); <code>red</code> có primary chưa phân bổ → một phần dữ liệu không đọc/ghi được.</p>

    <div class="callout"><p>💡 Giống Kafka: partition ↔ primary shard, replica ↔ follower, controller ↔ master. Khác: ES không cho tăng số primary tuỳ ý như tăng partition, vì routing gắn chặt vào số shard.</p></div>
  `,

  codeTabs: [
    { id: "yml", label: "① elasticsearch.yml", lines: [
      "# 3 node dedicated master (nhỏ, ít heap)",
      "node.name: es-master-1",
      "node.roles: [ master ]",
      "cluster.name: prod-search",
      "discovery.seed_hosts: [ es-master-1, es-master-2, es-master-3 ]",
      "cluster.initial_master_nodes: [ es-master-1, es-master-2, es-master-3 ]   # chỉ lần bootstrap đầu",
      "",
      "# data node",
      "node.roles: [ data_hot, data_content, ingest ]"
    ]},
    { id: "create", label: "② Tạo index", lines: [
      "PUT /products",
      "{",
      "  \"settings\": {",
      "    \"number_of_shards\": 3,      // cố định sau khi tạo",
      "    \"number_of_replicas\": 1     // đổi lúc nào cũng được",
      "  }",
      "}",
      "",
      "PUT /products/_settings",
      "{ \"number_of_replicas\": 2 }    // OK",
      "",
      "PUT /products/_settings",
      "{ \"number_of_shards\": 6 }      // lỗi: final setting, không đổi được"
    ]},
    { id: "cat", label: "③ Shard ở đâu", lines: [
      "GET /_cat/shards/products?v",
      "index    shard prirep state   docs  store node",
      "products 0     p      STARTED 3321  2.1mb es-data-1",
      "products 0     r      STARTED 3321  2.1mb es-data-2",
      "products 1     p      STARTED 3350  2.2mb es-data-2",
      "products 1     r      STARTED 3350  2.2mb es-data-3",
      "products 2     p      STARTED 3298  2.1mb es-data-3",
      "products 2     r      UNASSIGNED",
      "",
      "GET /_cluster/allocation/explain     // vì sao shard UNASSIGNED?"
    ]},
    { id: "route", label: "④ Routing", lines: [
      "shard = hash(_routing) % number_of_primary_shards   // _routing mặc định = _id",
      "",
      "PUT /orders/_doc/o-1001?routing=shop-7   // gom mọi đơn của shop-7 vào 1 shard",
      "{ \"shop_id\": \"shop-7\", \"total\": 250000 }",
      "",
      "GET /orders/_search?routing=shop-7       // chỉ hỏi 1 shard thay vì tất cả",
      "",
      "# cẩn thận: shop lớn → shard lệch (hot shard)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="coord"><div class="nl">🧭 Coordinating node</div><div class="ns">nhận request, tính routing, gom kết quả</div></div>
    <div class="arrow" id="a1">↓ hash(_id) % 3 = 1</div>
    <div class="row">
      <div class="node" id="p1"><div class="nl">🟩 Primary shard 1</div><div class="ns">es-data-2</div></div>
      <div class="node" id="r1"><div class="nl">🟦 Replica shard 1</div><div class="ns">es-data-3</div></div>
    </div>
    <div class="arrow" id="a2">↓ primary ghi → replicate → ack</div>
    <div class="node" id="master"><div class="nl">👑 Master</div><div class="ns">giữ cluster state, không nằm trên đường dữ liệu</div></div>
  `,
  steps: [
    { title: "1 · Tách vai trò node", tab: "yml", highlight: [3, 5, 6, 9], on: ["master"],
      desc: "3 master-eligible để có quorum. Master chỉ quản lý metadata, không xử lý query hay indexing." },
    { title: "2 · Số primary là cố định", tab: "create", highlight: [4, 5, 10, 13], on: ["p1", "r1"],
      desc: "Replica đổi thoải mái, primary thì không vì công thức routing phụ thuộc nó." },
    { title: "3 · Request vào coordinating", tab: "route", highlight: [1], on: ["coord", "a1"],
      desc: "Node nhận request tính <code>hash(_id) % 3</code> để biết document thuộc shard 1." },
    { title: "4 · Primary ghi rồi replicate", tab: "cat", highlight: [5, 6], on: ["p1", "a2", "r1"],
      desc: "Primary trên es-data-2 ghi trước, gửi sang replica trên es-data-3; đủ in-sync copy xác nhận mới trả 200." },
    { title: "5 · Shard thiếu replica → yellow", tab: "cat", highlight: [8, 10], on: ["master"],
      desc: "Replica shard 2 UNASSIGNED: dữ liệu vẫn đủ nhưng mất dự phòng. <code>allocation/explain</code> nói lý do (thiếu node, đầy disk…)." },
    { title: "6 · Custom routing", tab: "route", highlight: [3, 6, 8], on: ["coord", "p1"],
      desc: "Routing theo shop giúp query chỉ chạm 1 shard, đổi lại nguy cơ shard lệch kích thước." }
  ],

  quiz: [
    { q: "Vì sao nên có 3 (số lẻ) node master-eligible?", options: [
        "Để chia tải search",
        "Để bầu master theo đa số; mất 1 node vẫn còn quorum 2/3",
        "Vì ES yêu cầu tối thiểu 3 node",
        "Để có 3 replica"
      ], correct: 1, explanation: "Với 2 node, mất 1 là mất đa số và cụm không bầu được master." },
    { q: "Thay đổi nào KHÔNG làm được trên index đang có?", options: [
        "number_of_replicas", "refresh_interval", "number_of_shards (trực tiếp)", "Thêm alias"
      ], correct: 2, explanation: "Số primary cố định; muốn đổi phải split/shrink hoặc reindex." },
    { q: "Mặc định _routing của document là gì?", options: [
        "Timestamp", "_id của document", "Ngẫu nhiên", "Tên node"
      ], correct: 1, explanation: "shard = hash(_routing) % số primary, _routing mặc định là _id." },
    { q: "Cụm 1 node, index có number_of_replicas = 1 sẽ có màu gì?", options: [
        "green", "yellow", "red", "blue"
      ], correct: 1, explanation: "Replica không được đặt cùng node với primary nên luôn UNASSIGNED." },
    { q: "Health red nghĩa là gì?", options: [
        "Thiếu replica",
        "Có ít nhất một primary shard chưa được phân bổ",
        "CPU cao",
        "Master đang bầu lại"
      ], correct: 1, explanation: "Một phần dữ liệu không truy cập được." },
    { q: "Trong search query_then_fetch, pha query trả về gì từ mỗi shard?", options: [
        "Toàn bộ _source của mọi hit",
        "Id + score (và giá trị sort) của top N cục bộ",
        "Chỉ số lượng hit",
        "Mapping"
      ], correct: 1, explanation: "_source chỉ được lấy ở pha fetch cho top N toàn cục." },
    { q: "Tăng số replica giúp gì cho search?", options: [
        "Không giúp gì",
        "Thêm bản sao phục vụ đọc song song → tăng thông lượng search (nếu có đủ node)",
        "Giảm dung lượng",
        "Tăng tốc indexing"
      ], correct: 1, explanation: "Mỗi request chỉ cần một bản của mỗi shard, nên nhiều bản thì chia tải được. Indexing thì chậm hơn vì phải ghi thêm." },
    { q: "Node có node.roles: [] làm gì?", options: [
        "Không làm gì",
        "Coordinating-only: nhận request, phân tán, gom kết quả",
        "Chỉ làm master",
        "Chỉ lưu replica"
      ], correct: 1, explanation: "Hữu ích để tách tải gom kết quả/aggregation khỏi data node." },
    { q: "Custom routing theo shop_id có rủi ro gì?", options: [
        "Không search được",
        "Shop rất lớn dồn hết vào một shard → shard lệch (hot shard)",
        "Mất replica",
        "Không dùng được aggregation"
      ], correct: 1, explanation: "Đổi lấy việc chỉ hỏi 1 shard, bạn chấp nhận phân bố không đều." }
  ]
});
