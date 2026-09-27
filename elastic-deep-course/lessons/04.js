window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Mô hình dữ liệu",
  title: "Mapping: text vs keyword, kiểu dữ liệu, multi-field",
  subtitle: "text để tìm, keyword để lọc/đếm · một chuỗi hai cách index · index/doc_values/ignore_above",

  theory: `
    <p>Mapping quyết định mỗi field được lưu bằng cấu trúc nào (bài 03). Chọn sai kiểu = query sai kết quả hoặc chậm, và <strong>không sửa được kiểu field đã có</strong> — chỉ có thể thêm field mới.</p>

    <p><strong>text vs keyword — khác biệt quan trọng nhất</strong></p>
    <table>
      <tr><th></th><th><code>text</code></th><th><code>keyword</code></th></tr>
      <tr><td>Khi index</td><td>Qua <strong>analyzer</strong>: tách từ, lowercase… "Điện Thoại Samsung" → [điện, thoại, samsung]</td><td>Giữ nguyên cả chuỗi làm <strong>một term</strong>: "Điện Thoại Samsung"</td></tr>
      <tr><td>Dùng cho</td><td>Full-text: <code>match</code>, <code>match_phrase</code>, có chấm điểm</td><td>Lọc chính xác <code>term</code>/<code>terms</code>, sort, aggregation, prefix</td></tr>
      <tr><td>Doc values</td><td>Không</td><td>Có (mặc định)</td></tr>
      <tr><td>Ví dụ</td><td>tên sản phẩm, mô tả, nội dung</td><td>mã đơn, email, status, brand slug, tag, ID</td></tr>
    </table>

    <p><strong>Multi-field</strong>: một giá trị trong JSON, index theo nhiều cách qua <code>fields</code>. Ví dụ <code>name</code> là text để tìm, <code>name.raw</code> là keyword để sort/agg, <code>name.folded</code> là text bỏ dấu (bài 07). Không tốn thêm chỗ trong <code>_source</code>, chỉ tốn thêm index.</p>

    <p><strong>Kiểu hay dùng</strong></p>
    <ul>
      <li>Số: <code>long</code>, <code>integer</code>, <code>double</code>, <code>scaled_float</code> (tiền: lưu long nội bộ với <code>scaling_factor</code>). ID dạng số mà chỉ lọc bằng nhau, không range → nên để <code>keyword</code> (term trên keyword nhanh hơn trên số).</li>
      <li><code>date</code>: lưu nội bộ là epoch millis UTC; <code>format</code> quy định chuỗi nhận vào. <code>date_nanos</code> nếu cần nano giây.</li>
      <li><code>boolean</code>, <code>ip</code>, <code>geo_point</code>, <code>object</code> (mặc định cho JSON lồng), <code>nested</code> (bài 11), <code>flattened</code>, <code>dense_vector</code> (vector search).</li>
    </ul>

    <p><strong>Tham số tinh chỉnh</strong>: <code>"index": false</code> (không tìm được theo field này, vẫn nằm trong _source), <code>"doc_values": false</code> (không sort/agg, tiết kiệm disk), <code>ignore_above: 256</code> (chuỗi dài hơn không được index làm keyword), <code>"enabled": false</code> cho object chỉ để chở dữ liệu.</p>

    <div class="callout"><p>💡 Spring <code>@Field(type = FieldType.Text)</code> không có <code>@InnerField</code> keyword thì agg/sort trên field đó sẽ lỗi. Cách làm có kiểm soát: viết mapping JSON tường minh, commit cùng code, tạo index bằng mapping đó trước khi nạp dữ liệu.</p></div>
  `,

  codeTabs: [
    { id: "map", label: "① Mapping tường minh", lines: [
      "PUT /products_v1",
      "{",
      "  \"mappings\": {",
      "    \"dynamic\": \"strict\",",
      "    \"properties\": {",
      "      \"sku\":        { \"type\": \"keyword\" },",
      "      \"name\": {",
      "        \"type\": \"text\",",
      "        \"fields\": { \"raw\": { \"type\": \"keyword\", \"ignore_above\": 256 } }",
      "      },",
      "      \"brand\":      { \"type\": \"keyword\" },",
      "      \"price\":      { \"type\": \"scaled_float\", \"scaling_factor\": 100 },",
      "      \"stock\":      { \"type\": \"integer\" },",
      "      \"created_at\": { \"type\": \"date\", \"format\": \"strict_date_optional_time||epoch_millis\" },",
      "      \"description\":{ \"type\": \"text\" },",
      "      \"image_url\":  { \"type\": \"keyword\", \"index\": false, \"doc_values\": false }",
      "    }",
      "  }",
      "}"
    ]},
    { id: "diff", label: "② text vs keyword", lines: [
      "# document: { \"brand\": \"Samsung\", \"name\": \"Galaxy A55 Xanh\" }",
      "",
      "{ \"term\":  { \"brand\": \"Samsung\" } }   // khớp (keyword giữ nguyên)",
      "{ \"term\":  { \"brand\": \"samsung\" } }   // KHÔNG khớp (phân biệt hoa thường)",
      "",
      "{ \"match\": { \"name\": \"galaxy xanh\" } } // khớp (text đã lowercase + tách từ)",
      "{ \"term\":  { \"name\": \"Galaxy A55 Xanh\" } } // KHÔNG khớp: index chỉ có 'galaxy','a55','xanh'",
      "{ \"term\":  { \"name.raw\": \"Galaxy A55 Xanh\" } } // khớp"
    ]},
    { id: "get", label: "③ Xem & thêm field", lines: [
      "GET /products_v1/_mapping",
      "",
      "PUT /products_v1/_mapping          // THÊM field mới: được",
      "{ \"properties\": { \"color\": { \"type\": \"keyword\" } } }",
      "",
      "PUT /products_v1/_mapping          // ĐỔI kiểu field cũ: lỗi",
      "{ \"properties\": { \"stock\": { \"type\": \"keyword\" } } }",
      "# → illegal_argument_exception: mapper [stock] cannot be changed",
      "#   from type [integer] to [keyword]"
    ]},
    { id: "java", label: "④ Spring ↔ JSON", lines: [
      "// Spring Data: mapping sinh từ annotation",
      "@MultiField(",
      "  mainField = @Field(type = FieldType.Text),",
      "  otherFields = { @InnerField(suffix = \"raw\", type = FieldType.Keyword) }",
      ")",
      "private String name;",
      "",
      "// Rust: không có annotation — giữ mapping trong file JSON, nạp lúc deploy",
      "let mapping: serde_json::Value = serde_json::from_str(include_str!(\"products_v1.json\"))?;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📄 "name": "Galaxy A55 Xanh"</div><div class="ns">một giá trị trong _source</div></div>
    <div class="arrow" id="a1">↓ index theo mapping</div>
    <div class="row">
      <div class="node" id="txt"><div class="nl">🔤 name (text)</div><div class="ns">galaxy · a55 · xanh</div></div>
      <div class="node" id="kw"><div class="nl">🏷️ name.raw (keyword)</div><div class="ns">"Galaxy A55 Xanh" + doc values</div></div>
    </div>
    <div class="arrow" id="a2">↓ phục vụ</div>
    <div class="row">
      <div class="node" id="u1"><div class="nl">🔍 match, chấm điểm</div><div class="ns">full-text</div></div>
      <div class="node" id="u2"><div class="nl">📊 term / sort / agg</div><div class="ns">chính xác</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Viết mapping tường minh", tab: "map", highlight: [4, 6, 11], on: ["src"],
      desc: "<code>dynamic: strict</code> từ chối field lạ. Mã, brand là keyword." },
    { title: "2 · Multi-field cho name", tab: "map", highlight: [7, 8, 9], on: ["a1", "txt", "kw"],
      desc: "Một giá trị, hai cách index: text để tìm, keyword để sort/agg." },
    { title: "3 · Tiền và field chỉ để chở", tab: "map", highlight: [12, 16], on: ["kw"],
      desc: "scaled_float lưu long nội bộ; image_url không cần tìm/sort nên tắt index và doc_values." },
    { title: "4 · term trên text là bẫy", tab: "diff", highlight: [3, 4, 6, 7, 8], on: ["u1", "u2"],
      desc: "term không phân tích input; tìm chuỗi gốc trên field text sẽ không khớp vì index chỉ chứa các token." },
    { title: "5 · Thêm được, đổi không được", tab: "get", highlight: [3, 6, 8], on: ["src"],
      desc: "Đổi kiểu = tạo index mới và reindex (bài 16)." },
    { title: "6 · Mapping nằm trong repo", tab: "java", highlight: [2, 4, 9], on: ["src"],
      desc: "Rust không có annotation sinh mapping; coi mapping JSON như file migration." }
  ],

  quiz: [
    { q: "Field status (PENDING/PAID/SHIPPED) dùng để lọc và đếm — kiểu nào?", options: [
        "text", "keyword", "long", "object"
      ], correct: 1, explanation: "Giá trị rời rạc, lọc chính xác và aggregation → keyword." },
    { q: "Document có brand: 'Samsung' (keyword). term brand: 'samsung' có khớp không?", options: [
        "Có", "Không — keyword phân biệt hoa thường (trừ khi có normalizer)", "Chỉ khi fuzzy", "Tuỳ shard"
      ], correct: 1, explanation: "Keyword giữ nguyên chuỗi; có thể thêm normalizer lowercase nếu cần." },
    { q: "term { name: 'Galaxy A55 Xanh' } trên field text không khớp vì sao?", options: [
        "term không hỗ trợ text",
        "Field text đã được tách thành token lowercase; không có term nào bằng cả chuỗi gốc",
        "Lỗi phân quyền",
        "Chưa refresh"
      ], correct: 1, explanation: "Dùng match cho text, term cho keyword." },
    { q: "Multi-field (fields) giúp gì?", options: [
        "Lưu nhiều bản _source",
        "Index cùng một giá trị theo nhiều cách (text + keyword + bỏ dấu…)",
        "Tăng số shard",
        "Chia document"
      ], correct: 1, explanation: "_source vẫn một bản; chỉ tốn thêm cấu trúc index." },
    { q: "Đổi field stock từ integer sang keyword trên index đang chạy?", options: [
        "PUT _mapping là xong",
        "Không được; phải tạo index mới và reindex",
        "Restart node",
        "Dùng _update_by_query"
      ], correct: 1, explanation: "Dữ liệu đã index theo cấu trúc cũ, không thể chuyển tại chỗ." },
    { q: "Mã khách hàng dạng số (chỉ lọc bằng nhau) nên map thế nào?", options: [
        "long vì là số", "keyword — term lookup nhanh hơn, không cần range", "text", "double"
      ], correct: 1, explanation: "Kiểu số tối ưu cho range; ID chỉ so bằng nhau nên keyword hợp hơn." },
    { q: "index: false, doc_values: false trên image_url nghĩa là gì?", options: [
        "Field bị xoá",
        "Vẫn trả về trong _source nhưng không tìm/sort/agg được, tiết kiệm disk",
        "Chỉ lưu trong RAM",
        "Không nhận giá trị"
      ], correct: 1, explanation: "Hợp với field chỉ để hiển thị." },
    { q: "ignore_above: 256 trên keyword có tác dụng gì?", options: [
        "Cắt chuỗi còn 256 ký tự trong _source",
        "Chuỗi dài hơn 256 ký tự không được index/đưa vào doc values (vẫn còn trong _source)",
        "Giới hạn 256 document",
        "Giới hạn 256 field"
      ], correct: 1, explanation: "Tránh term khổng lồ; chuỗi đó không lọc/agg được theo field này." },
    { q: "Kiểu nào hợp để lưu giá tiền có 2 chữ số thập phân mà vẫn range/agg tốt?", options: [
        "text", "keyword", "scaled_float với scaling_factor 100", "object"
      ], correct: 2, explanation: "Lưu dạng long nhân 100 nội bộ, nén tốt hơn double." }
  ]
});
