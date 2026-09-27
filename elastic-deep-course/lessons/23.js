window.LESSONS.push({
  id: "23",
  phase: "6", phaseName: "Rust & tổng kết",
  title: "Tổng kết: thiết kế một read model tìm kiếm từ đầu đến cuối",
  subtitle: "checklist thiết kế · 12 anti-pattern thường gặp · bảng quyết định · ôn tập toàn khoá",

  theory: `
    <p>Ghép cả khoá lại thành một quy trình cho bài toán thật: <strong>tìm kiếm sản phẩm cho app mobile</strong>, dữ liệu gốc ở PostgreSQL của product-service, tồn kho ở inventory-service (MongoDB).</p>

    <p><strong>Checklist thiết kế</strong></p>
    <ol>
      <li><strong>Vai trò</strong>: ES là read model, dựng lại được (bài 01). Màn hình thanh toán không đọc từ ES.</li>
      <li><strong>Hình dạng document</strong>: theo màn hình tìm kiếm; denormalize tên shop, danh mục; biến thể dùng <code>nested</code> chỉ khi cần lọc theo cặp thuộc tính (bài 11).</li>
      <li><strong>Mapping tường minh</strong>, <code>dynamic: strict</code>; keyword cho ID/status/brand; text + multi-field cho tên (bài 04–05).</li>
      <li><strong>Analyzer tiếng Việt</strong>: <code>icu_normalizer</code> cho bản có dấu, <code>icu_folding</code>/<code>asciifolding</code> cho bản bỏ dấu, boost bản có dấu; edge_ngram cho autocomplete (bài 06–07).</li>
      <li><strong>Query</strong>: từ khoá vào <code>must</code>/<code>should</code>, mọi điều kiện nghiệp vụ vào <code>filter</code>; <code>function_score</code>/<code>rank_feature</code> cho lượt bán (bài 08–10).</li>
      <li><strong>Facet</strong>: <code>terms</code>/<code>range</code> + <code>post_filter</code>; <strong>phân trang</strong>: <code>search_after</code> + cursor (bài 12–13).</li>
      <li><strong>Đồng bộ</strong>: outbox/CDC → Kafka (key = id) → indexer Rust → bulk với <code>_id</code> + external version; commit offset sau cùng; DLQ; reconcile (bài 14–17).</li>
      <li><strong>Tiến hoá</strong>: index có phiên bản + alias; đổi mapping = reindex + swap (bài 16).</li>
      <li><strong>Vận hành</strong>: 1 primary cho catalog vài chục GB; slowlog + cảnh báo heap/disk/rejected; log dùng data stream + ILM (bài 18–20).</li>
      <li><strong>Bảo mật</strong>: ES trong mạng nội bộ, TLS, API key role tối thiểu cho từng service (bài 21–22).</li>
    </ol>

    <p><strong>12 anti-pattern</strong></p>
    <table>
      <tr><th>Anti-pattern</th><th>Hậu quả</th><th>Bài</th></tr>
      <tr><td>ES là nơi duy nhất giữ dữ liệu</td><td>Mapping sai/cụm hỏng = mất dữ liệu</td><td>01, 17</td></tr>
      <tr><td>Để dynamic mapping đoán kiểu</td><td>price thành text, xung đột kiểu</td><td>05</td></tr>
      <tr><td>Key động trong object</td><td>Mapping explosion</td><td>05</td></tr>
      <tr><td><code>term</code> trên field text</td><td>Không ra kết quả</td><td>04, 08</td></tr>
      <tr><td>Chỉ index bản bỏ dấu</td><td>Gõ đúng dấu không được ưu tiên</td><td>07</td></tr>
      <tr><td>Điều kiện lọc đặt trong <code>must</code></td><td>Chậm, không cache, điểm lệch</td><td>08</td></tr>
      <tr><td>Wildcard đầu chuỗi</td><td>Quét cả term dictionary</td><td>09</td></tr>
      <tr><td>from/size sâu</td><td>Tốn heap, chạm 10000</td><td>13</td></tr>
      <tr><td><code>refresh=true</code> mỗi request</td><td>Segment tí hon, merge nặng</td><td>14</td></tr>
      <tr><td>Không đọc <code>items</code> của bulk</td><td>Mất dữ liệu âm thầm</td><td>14, 22</td></tr>
      <tr><td>Dual write DB + ES</td><td>Lệch vĩnh viễn, đảo thứ tự</td><td>17</td></tr>
      <tr><td>Index/ngày × nhiều shard</td><td>Oversharding</td><td>18</td></tr>
    </table>

    <div class="callout"><p>💡 Dấu hiệu bạn đã thành "kỹ sư ES": nhìn một query là đoán được nó chạm cấu trúc nào (inverted index, BKD, doc values), mỗi shard phải làm gì, tốn heap ở đâu — và khi đoán sai thì biết dùng <code>_analyze</code>, <code>explain</code>, <code>profile</code>, slowlog để chứng minh.</p></div>
  `,

  codeTabs: [
    { id: "map", label: "① Mapping cuối", lines: [
      "PUT /products_v1",
      "{ \"settings\": { \"number_of_shards\": 1, \"number_of_replicas\": 1,",
      "    \"analysis\": { \"analyzer\": {",
      "      \"vi_exact\":  { \"tokenizer\": \"icu_tokenizer\", \"filter\": [\"icu_normalizer\"] },",
      "      \"vi_folded\": { \"tokenizer\": \"icu_tokenizer\", \"filter\": [\"icu_folding\"] } } } },",
      "  \"aliases\": { \"products\": { \"is_write_index\": true } },",
      "  \"mappings\": { \"dynamic\": \"strict\", \"properties\": {",
      "    \"sku\":    { \"type\": \"keyword\" },",
      "    \"name\":   { \"type\": \"text\", \"analyzer\": \"vi_exact\",",
      "                \"fields\": { \"folded\": { \"type\": \"text\", \"analyzer\": \"vi_folded\" },",
      "                            \"raw\": { \"type\": \"keyword\", \"ignore_above\": 256 } } },",
      "    \"status\": { \"type\": \"keyword\" }, \"brand\": { \"type\": \"keyword\" },",
      "    \"price\":  { \"type\": \"long\" }, \"in_stock\": { \"type\": \"boolean\" },",
      "    \"sold\":   { \"type\": \"rank_feature\" },",
      "    \"shop\":   { \"properties\": { \"id\": { \"type\": \"keyword\" }, \"name\": { \"type\": \"text\" } } },",
      "    \"updated_at\": { \"type\": \"date\" }",
      "} } }"
    ]},
    { id: "query", label: "② Query cuối", lines: [
      "POST /products/_search",
      "{ \"size\": 20, \"_source\": [\"sku\", \"name\", \"price\", \"shop.name\"],",
      "  \"query\": { \"bool\": {",
      "    \"must\":   [ { \"multi_match\": { \"query\": \"tai nghe khong day\", \"type\": \"most_fields\",",
      "                 \"fields\": [\"name^3\", \"name.folded\"], \"minimum_should_match\": \"2<75%\" } } ],",
      "    \"should\": [ { \"rank_feature\": { \"field\": \"sold\" } } ],",
      "    \"filter\": [ { \"term\": { \"status\": \"ACTIVE\" } }, { \"term\": { \"in_stock\": true } },",
      "                { \"range\": { \"price\": { \"lte\": 2000000 } } } ] } },",
      "  \"aggs\": { \"brands\": { \"terms\": { \"field\": \"brand\" } } },",
      "  \"post_filter\": { \"terms\": { \"brand\": [\"sony\"] } },",
      "  \"sort\": [ \"_score\", { \"sku\": \"asc\" } ],",
      "  \"search_after\": [ 7.42, \"TN-1022\" ] }"
    ]},
    { id: "flow", label: "③ Luồng đồng bộ", lines: [
      "product-service:  UPDATE products + INSERT outbox        (1 transaction)",
      "Debezium:         WAL → topic product-events (key = sku)",
      "inventory-svc:    change stream → topic stock-events (key = sku)",
      "es-indexer (Rust):",
      "    product-events → bulk index  _id = sku, version = row_version (external)",
      "    stock-events   → bulk update { in_stock }  (retry_on_conflict)",
      "    commit offset sau khi ES xác nhận ; 409 bỏ qua ; lỗi khác → DLQ",
      "reconcile hằng đêm: count/checksum PostgreSQL vs ES"
    ]},
    { id: "ops", label: "④ Bảng quyết định", lines: [
      "Cần…                                   → Dùng",
      "lọc chính xác, đếm, sort               → keyword + filter/terms agg",
      "tìm theo từ, có xếp hạng                → text + match/multi_match",
      "gõ không dấu                            → multi-field folded",
      "lọc theo cặp thuộc tính của phần tử mảng → nested",
      "trang sâu / infinite scroll             → search_after (+ PIT nếu cần nhất quán)",
      "đếm distinct                            → cardinality",
      "đổi mapping                             → index mới + reindex + alias swap",
      "log/event theo thời gian                → data stream + ILM (OpenSearch: ISM)",
      "đồng bộ từ DB                           → outbox/CDC + Kafka + external version"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pg"><div class="nl">🐘 PostgreSQL + 🍃 MongoDB</div><div class="ns">source of truth</div></div>
    <div class="arrow" id="a1">↓ outbox / CDC → Kafka</div>
    <div class="node" id="idx"><div class="nl">🦀 es-indexer</div><div class="ns">idempotent · external version · DLQ</div></div>
    <div class="arrow" id="a2">↓ bulk vào alias products</div>
    <div class="node" id="es"><div class="nl">🔎 products_v1 (mapping strict, ICU)</div><div class="ns">1 primary · 1 replica</div></div>
    <div class="arrow" id="a3">↓ bool + filter + facet + search_after</div>
    <div class="node" id="api"><div class="nl">📱 search-api → app mobile</div><div class="ns">API key read-only · TLS</div></div>
  `,
  steps: [
    { title: "1 · Mapping có chủ đích", tab: "map", highlight: [2, 6, 7, 9, 10, 14], on: ["es"],
      desc: "strict, multi-field tiếng Việt, alias ngay từ v1, rank_feature cho lượt bán." },
    { title: "2 · Query đúng ngữ cảnh", tab: "query", highlight: [4, 5, 6, 7, 8], on: ["a3", "api"],
      desc: "Từ khoá ở must, tín hiệu phổ biến ở should, nghiệp vụ ở filter." },
    { title: "3 · Facet và phân trang", tab: "query", highlight: [9, 10, 11, 12], on: ["api"],
      desc: "post_filter giữ facet đủ; sort có tiebreaker sku cho search_after." },
    { title: "4 · Đồng bộ đúng", tab: "flow", highlight: [1, 2, 5, 7, 8], on: ["pg", "a1", "idx", "a2"],
      desc: "Không dual write; at-least-once + idempotent; đối soát định kỳ." },
    { title: "5 · Bảng quyết định", tab: "ops", highlight: [2, 3, 4, 8, 10], on: ["es"],
      desc: "Mỗi nhu cầu một công cụ đúng — và bạn đã biết vì sao nó đúng." }
  ],

  quiz: [
    { q: "Một shard trong ES thực chất là gì?", options: [
        "Một file JSON", "Một index Lucene gồm nhiều segment bất biến", "Một bảng PostgreSQL", "Một partition Kafka"
      ], correct: 1, explanation: "Bài 02–03." },
    { q: "Cấu trúc nào phục vụ terms aggregation và sort?", options: [
        "Inverted index", "Doc values", "Translog", "_source"
      ], correct: 1, explanation: "Lưu trữ theo cột." },
    { q: "Vì sao term { name: 'Galaxy A55' } trên field text không khớp?", options: [
        "Chưa refresh", "Field text đã được phân tích thành token lowercase; term không phân tích input", "Thiếu quyền", "Sai shard"
      ], correct: 1, explanation: "Dùng match cho text, term cho keyword." },
    { q: "Cách chuẩn để người dùng gõ không dấu vẫn tìm được, gõ đúng dấu được ưu tiên?", options: [
        "Chỉ index bản bỏ dấu",
        "Multi-field có dấu + bỏ dấu, multi_match most_fields, boost bản có dấu",
        "Dùng wildcard",
        "Fuzzy 2"
      ], correct: 1, explanation: "Bài 07." },
    { q: "Điều kiện status = ACTIVE đặt ở đâu?", options: [
        "must", "filter", "should", "function_score"
      ], correct: 1, explanation: "Yes/no, cache được, không ảnh hưởng điểm." },
    { q: "Trong BM25, yếu tố nào làm tên ngắn đứng trên mô tả dài khi cùng khớp một từ?", options: [
        "IDF", "Chuẩn hoá độ dài (b)", "k1", "boost"
      ], correct: 1, explanation: "Bài 10." },
    { q: "Mảng biến thể [xanh/M, đỏ/L] cần lọc đúng 'xanh size L không tồn tại' — map thế nào?", options: [
        "object", "nested", "flattened", "keyword"
      ], correct: 1, explanation: "object làm phẳng, mất liên kết giữa các field." },
    { q: "Infinite scroll trang rất sâu dùng gì?", options: [
        "from/size", "search_after (+ PIT)", "scroll mỗi request người dùng", "terms agg"
      ], correct: 1, explanation: "Chi phí không đổi theo độ sâu." },
    { q: "Ghi xong search chưa thấy — nguyên nhân?", options: [
        "Mất dữ liệu", "Near real-time: phải chờ refresh", "Translog lỗi", "Replica chậm"
      ], correct: 1, explanation: "Dùng refresh=wait_for nếu cần." },
    { q: "Đảm bảo sự kiện cũ tới trễ không đè bản mới trong ES?", options: [
        "refresh=true", "version_type=external với version từ DB", "Tăng replica", "Dùng scroll"
      ], correct: 1, explanation: "Bài 15, 17." },
    { q: "Đổi analyzer của field name trên production không downtime?", options: [
        "PUT _mapping", "Index mới + reindex/nạp lại + bắt kịp + swap alias nguyên tử", "Restart", "update_by_query"
      ], correct: 1, explanation: "Bài 16." },
    { q: "Vì sao không dual write DB + ES trong request?", options: [
        "Chậm", "Không có transaction chung, dễ lệch và đảo thứ tự", "ES không nhận", "Tốn tiền"
      ], correct: 1, explanation: "Dùng outbox/CDC + Kafka." },
    { q: "Catalog 15GB, bao nhiêu primary?", options: [
        "1", "15", "30", "100"
      ], correct: 0, explanation: "Trong khoảng 10–50GB/shard." },
    { q: "Log theo thời gian nên quản lý bằng?", options: [
        "Index duy nhất + delete_by_query", "Data stream + ILM rollover (OpenSearch: ISM)", "Alias thủ công hằng ngày", "nested"
      ], correct: 1, explanation: "Xoá cả index cũ gần như miễn phí." },
    { q: "Crate elasticsearch: send() trả Ok với HTTP 409. Nên làm gì?", options: [
        "Coi là thành công", "Kiểm tra status_code / error_for_status_code; với bulk đọc items", "Panic", "Retry vô hạn"
      ], correct: 1, explanation: "Bài 22." },
    { q: "Khác biệt nào giữa Elasticsearch và OpenSearch ảnh hưởng trực tiếp code/vận hành?", options: [
        "Query DSL cơ bản hoàn toàn khác",
        "ILM vs ISM, API PIT, security plugin, client crate khác nhau",
        "OpenSearch không có shard",
        "Elasticsearch không có bulk"
      ], correct: 1, explanation: "Cốt lõi Lucene/Query DSL giống, các API quản trị khác." }
  ]
});
