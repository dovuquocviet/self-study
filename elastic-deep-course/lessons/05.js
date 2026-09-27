window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Mô hình dữ liệu",
  title: "Dynamic mapping và bẫy mapping explosion",
  subtitle: "ES tự đoán kiểu thế nào · giá trị đầu tiên thắng · dynamic: strict/false/runtime · flattened & dynamic_templates",

  theory: `
    <p>Gửi document vào index chưa có mapping (hoặc có field lạ), ES <strong>tự đoán kiểu</strong> theo giá trị đầu tiên nó thấy rồi ghi luôn vào mapping — vĩnh viễn.</p>
    <table>
      <tr><th>Giá trị JSON</th><th>Kiểu được đoán</th></tr>
      <tr><td><code>"Galaxy"</code></td><td><code>text</code> + sub-field <code>.keyword</code> (ignore_above 256)</td></tr>
      <tr><td><code>"2024-05-01"</code></td><td><code>date</code> (date_detection bật mặc định)</td></tr>
      <tr><td><code>"12000"</code> (chuỗi số)</td><td><code>text</code>+keyword (numeric_detection tắt mặc định)</td></tr>
      <tr><td><code>12000</code></td><td><code>long</code></td></tr>
      <tr><td><code>1.5</code></td><td><code>float</code></td></tr>
      <tr><td><code>{ ... }</code></td><td><code>object</code> (đệ quy từng field con)</td></tr>
    </table>

    <p><strong>Bẫy 1 — giá trị đầu tiên thắng</strong>: service A gửi <code>"order_id": 1001</code> (long). Hôm sau service B gửi <code>"order_id": "ORD-1001"</code> → lỗi <code>mapper_parsing_exception</code>, document bị từ chối. Hoặc ngược lại: <code>"price": "12000"</code> đến trước → price thành text, range/agg hỏng.</p>

    <p><strong>Bẫy 2 — mapping explosion</strong>: dùng giá trị động làm <em>tên field</em>, ví dụ <code>{"attrs": {"size_42": 3, "size_43": 1, "color_red": true}}</code> hay key là user id. Mỗi key mới = một field mới trong mapping. Mapping nằm trong cluster state mà master phải phát tới mọi node → cluster state phình, master chậm, heap tăng. ES chặn bằng giới hạn:</p>
    <ul>
      <li><code>index.mapping.total_fields.limit</code> = 1000 (mặc định)</li>
      <li><code>index.mapping.depth.limit</code> = 20, <code>index.mapping.nested_fields.limit</code> = 50, <code>index.mapping.nested_objects.limit</code> = 10000</li>
    </ul>
    <p>Chạm giới hạn → document mới có field mới bị từ chối. Tăng giới hạn chỉ là hoãn bệnh.</p>

    <p><strong>Tham số <code>dynamic</code></strong> (đặt ở gốc hoặc từng object):</p>
    <ul>
      <li><code>true</code> — mặc định, tự thêm field.</li>
      <li><code>false</code> — field lạ được giữ trong <code>_source</code> nhưng không index (không tìm được).</li>
      <li><code>strict</code> — field lạ → từ chối document. Khuyên dùng cho read model có schema rõ.</li>
      <li><code>runtime</code> — field lạ thành runtime field (tính lúc query, chậm, không index).</li>
    </ul>

    <p><strong>Cách chữa explosion</strong>: (1) đổi key động thành mảng key–value <code>[{"k":"size","v":"42"}]</code> với <code>nested</code>; (2) kiểu <code>flattened</code>: cả object là một field, mọi lá thành keyword — lọc được theo <code>attrs.size</code> nhưng không range số chuẩn, không full-text; (3) <code>dynamic_templates</code> để quy định kiểu cho field động theo tên/kiểu.</p>

    <div class="callout"><p>💡 Với Jackson bên Java, <code>Map&lt;String, Object&gt;</code> serialize ra chính là "key động". Trong Rust hay gặp <code>HashMap&lt;String, Value&gt;</code> với serde. Thấy kiểu này trong struct gửi sang ES là phải dừng lại nghĩ tới explosion.</p></div>
  `,

  codeTabs: [
    { id: "trap", label: "① Giá trị đầu thắng", lines: [
      "POST /orders_tmp/_doc",
      "{ \"order_id\": 1001, \"price\": \"12000\" }",
      "",
      "GET /orders_tmp/_mapping",
      "# order_id → long ; price → text + keyword   (sai!)",
      "",
      "POST /orders_tmp/_doc",
      "{ \"order_id\": \"ORD-1002\", \"price\": 15000 }",
      "# → 400 mapper_parsing_exception: failed to parse field [order_id] of type [long]"
    ]},
    { id: "boom", label: "② Explosion", lines: [
      "# ❌ key động",
      "{ \"sku\": \"A55\", \"attrs\": { \"color_xanh\": true, \"size_128gb\": 3, \"ram_8gb\": 1 } }",
      "# 10.000 sản phẩm × thuộc tính riêng → vài nghìn field",
      "# → Limit of total fields [1000] has been exceeded",
      "",
      "# ✅ cách 1: key-value + nested",
      "{ \"sku\": \"A55\", \"attrs\": [ { \"k\": \"color\", \"v\": \"xanh\" }, { \"k\": \"storage\", \"v\": \"128gb\" } ] }",
      "",
      "# ✅ cách 2: flattened",
      "\"attrs\": { \"type\": \"flattened\" }   // query: { \"term\": { \"attrs.color\": \"xanh\" } }"
    ]},
    { id: "strict", label: "③ dynamic strict", lines: [
      "PUT /orders_v1",
      "{ \"mappings\": {",
      "    \"dynamic\": \"strict\",",
      "    \"properties\": {",
      "      \"order_id\": { \"type\": \"keyword\" },",
      "      \"price\":    { \"type\": \"long\" },",
      "      \"meta\":     { \"type\": \"object\", \"dynamic\": false }   // chở tuỳ ý, không index",
      "} } }",
      "",
      "POST /orders_v1/_doc  { \"order_id\": \"ORD-1\", \"coupon\": \"X\" }",
      "# → strict_dynamic_mapping_exception: mapping set to strict, dynamic introduction of [coupon] ..."
    ]},
    { id: "tpl", label: "④ dynamic_templates", lines: [
      "PUT /events_v1",
      "{ \"mappings\": {",
      "    \"dynamic_templates\": [",
      "      { \"strings_as_keyword\": {",
      "          \"match_mapping_type\": \"string\",",
      "          \"mapping\": { \"type\": \"keyword\", \"ignore_above\": 512 } } },",
      "      { \"ids\": { \"match\": \"*_id\", \"mapping\": { \"type\": \"keyword\" } } }",
      "    ]",
      "} }",
      "# chuỗi mới → keyword thay vì text+keyword (nhẹ hơn cho log/event)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="doc"><div class="nl">📄 Document có field lạ</div><div class="ns">"coupon": "X"</div></div>
    <div class="arrow" id="a1">↓ dynamic = ?</div>
    <div class="row">
      <div class="node" id="dtrue"><div class="nl">true</div><div class="ns">thêm vào mapping (vĩnh viễn)</div></div>
      <div class="node" id="dfalse"><div class="nl">false</div><div class="ns">giữ trong _source, không index</div></div>
      <div class="node" id="dstrict"><div class="nl">strict</div><div class="ns">từ chối document</div></div>
    </div>
    <div class="arrow" id="a2">↓ nếu true và key động</div>
    <div class="node" id="state"><div class="nl">👑 Cluster state phình</div><div class="ns">master phát mapping mới tới mọi node</div></div>
  `,
  steps: [
    { title: "1 · ES tự đoán theo giá trị đầu", tab: "trap", highlight: [2, 5], on: ["doc", "a1", "dtrue"],
      desc: "price là chuỗi \"12000\" nên thành text. Từ giờ range theo giá hỏng." },
    { title: "2 · Kiểu đã chốt thì từ chối kiểu khác", tab: "trap", highlight: [8, 9], on: ["dtrue"],
      desc: "Một service khác gửi order_id dạng chuỗi → document bị từ chối, dữ liệu lặng lẽ thiếu nếu không kiểm tra lỗi bulk." },
    { title: "3 · Key động gây explosion", tab: "boom", highlight: [2, 3, 4], on: ["a2", "state"],
      desc: "Mỗi thuộc tính mới một field. Chạm 1000 field thì document mới bị từ chối; trước đó cluster state đã nặng nề." },
    { title: "4 · Chữa: key-value hoặc flattened", tab: "boom", highlight: [7, 10], on: ["dtrue"],
      desc: "Tên thuộc tính trở thành <em>dữ liệu</em> chứ không phải <em>tên field</em>." },
    { title: "5 · strict cho read model", tab: "strict", highlight: [3, 7, 11], on: ["dstrict", "dfalse"],
      desc: "Field lạ bị từ chối ngay, lỗi lộ ra lúc phát triển thay vì trên production. Object chở dữ liệu tuỳ ý dùng dynamic: false." },
    { title: "6 · Quy tắc cho field động", tab: "tpl", highlight: [3, 5, 6, 7], on: ["dtrue"],
      desc: "Khi thật sự cần dynamic (log, event), dynamic_templates quyết định kiểu thay cho phỏng đoán." }
  ],

  quiz: [
    { q: "Chuỗi \"12000\" gửi lần đầu vào index dynamic mặc định sẽ thành kiểu gì?", options: [
        "long", "text với sub-field keyword", "float", "keyword"
      ], correct: 1, explanation: "numeric_detection tắt mặc định nên chuỗi số vẫn là text." },
    { q: "Mapping explosion là gì?", options: [
        "Shard quá lớn",
        "Số field trong mapping tăng không kiểm soát do dùng giá trị động làm tên field",
        "Quá nhiều document",
        "Heap tràn do query"
      ], correct: 1, explanation: "Mapping nằm trong cluster state nên explosion ảnh hưởng cả cụm." },
    { q: "Giới hạn mặc định index.mapping.total_fields.limit là bao nhiêu?", options: [
        "100", "1000", "10000", "Không giới hạn"
      ], correct: 1, explanation: "Có thể tăng nhưng chỉ là trì hoãn vấn đề." },
    { q: "dynamic: false khác strict thế nào?", options: [
        "Giống nhau",
        "false: field lạ vẫn lưu trong _source nhưng không index; strict: từ chối cả document",
        "false: từ chối; strict: lưu",
        "false tắt _source"
      ], correct: 1, explanation: "false im lặng bỏ qua, strict báo lỗi." },
    { q: "Kiểu flattened phù hợp với trường hợp nào?", options: [
        "Full-text mô tả sản phẩm",
        "Object nhiều key không biết trước, chỉ cần lọc bằng nhau theo key",
        "Range số chính xác",
        "Vector search"
      ], correct: 1, explanation: "Cả object là một field; các lá được index như keyword." },
    { q: "Service gửi order_id: 'ORD-1002' vào index mà order_id đã là long. Kết quả?", options: [
        "Tự đổi kiểu",
        "Document bị từ chối với mapper_parsing_exception",
        "Lưu thành 0",
        "Tạo field order_id_2"
      ], correct: 1, explanation: "Trong bulk, lỗi này nằm trong items; phải kiểm tra từng item." },
    { q: "Struct Rust có HashMap<String, Value> tên attrs gửi thẳng vào ES với dynamic: true. Rủi ro?", options: [
        "Không có",
        "Mỗi key mới thành field mới → mapping explosion",
        "Serde không serialize được",
        "ES không nhận map"
      ], correct: 1, explanation: "Đổi sang mảng key-value, flattened, hoặc object dynamic: false." },
    { q: "dynamic_templates dùng để làm gì?", options: [
        "Tạo index theo lịch",
        "Quy định kiểu cho field mới dựa vào tên hoặc kiểu JSON",
        "Đổi kiểu field cũ",
        "Tăng tốc merge"
      ], correct: 1, explanation: "Ví dụ mọi field *_id thành keyword." },
    { q: "Vì sao mapping lớn làm chậm cả cụm chứ không chỉ index đó?", options: [
        "Vì chiếm disk",
        "Mapping là một phần cluster state do master quản lý và phát tới mọi node",
        "Vì làm chậm translog",
        "Vì tăng replica"
      ], correct: 1, explanation: "Mỗi thay đổi mapping là một lần cập nhật cluster state." }
  ]
});
