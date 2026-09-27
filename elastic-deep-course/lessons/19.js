window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Vận hành",
  title: "Vòng đời index: ILM, rollover, data stream, hot-warm-cold (và ISM của OpenSearch)",
  subtitle: "index template · data stream append-only · rollover theo kích thước · min_age · data tier · xoá tự động",

  theory: `
    <p>Dữ liệu theo thời gian (log, audit, event, lịch sử giá) có đặc điểm: ghi liên tục vào phần mới nhất, ít khi sửa, đọc nhiều khi còn mới, sau đó giữ để tra cứu rồi xoá. ILM (Index Lifecycle Management) tự động hoá cả vòng đời đó.</p>

    <p><strong>Ba mảnh ghép</strong></p>
    <ol>
      <li><strong>ILM policy</strong>: các pha và hành động. <code>hot</code> (đang ghi, rollover), <code>warm</code> (không ghi, còn query: shrink, forcemerge, giảm replica), <code>cold</code> (hiếm query, có thể dùng searchable snapshot), <code>frozen</code> (searchable snapshot nạp một phần), <code>delete</code>. <code>min_age</code> tính từ lúc index được rollover (hoặc từ lúc tạo nếu không rollover).</li>
      <li><strong>Index template</strong> (composable, <code>_index_template</code>): áp mapping + settings + tên policy cho mọi index khớp pattern. Index mới sinh ra khi rollover tự nhận template.</li>
      <li><strong>Data stream</strong>: một tên (vd <code>logs-order-prod</code>) đứng trước các <em>backing index</em> ẩn <code>.ds-logs-order-prod-2024.05.01-000001</code>, <code>...-000002</code>. Ghi luôn vào backing index mới nhất; search trên tất cả. Yêu cầu field <code>@timestamp</code>; chỉ <em>append</em> (bulk phải dùng <code>create</code>); sửa/xoá qua <code>_update_by_query</code>/<code>_delete_by_query</code> hoặc trên backing index cụ thể.</li>
    </ol>

    <p><strong>Rollover</strong>: tạo index ghi mới khi đạt một điều kiện — <code>max_primary_shard_size</code> (khuyên dùng, ~50GB), <code>max_age</code>, <code>max_docs</code>. Nhờ vậy kích thước shard ổn định dù lưu lượng ngày lễ gấp 10 ngày thường (bài 18).</p>

    <p><strong>Data tier (hot-warm-cold)</strong>: node gắn role <code>data_hot</code> (SSD nhanh, CPU mạnh), <code>data_warm</code>, <code>data_cold</code> (disk rẻ, dung lượng lớn), <code>data_frozen</code>. ILM có hành động <code>migrate</code> ngầm định: sang pha warm thì shard tự chuyển sang node warm. Không có node warm thì ở lại tier hiện tại.</p>

    <p><strong>License</strong>: ILM, rollover, data stream có ở bản miễn phí (Basic); <em>searchable snapshot</em> (cold/frozen) cần license Enterprise. ES 8.x còn có <em>data stream lifecycle</em> — cấu hình gọn hơn (chỉ thời gian giữ + rollover tự động), dùng khi không cần nhiều tier.</p>

    <p><strong>OpenSearch — ISM (Index State Management)</strong>: khái niệm tương tự nhưng mô hình <em>máy trạng thái</em>: <code>states</code>, mỗi state có <code>actions</code> và <code>transitions</code> (điều kiện <code>min_index_age</code>, <code>min_size</code>…). API <code>_plugins/_ism/policies</code>; gắn policy vào index qua <code>ism_template</code> trong policy. Rollover alias đặt bằng setting <code>plugins.index_state_management.rollover_alias</code>. Policy ILM <strong>không</strong> dùng lại được ở OpenSearch — phải viết lại.</p>

    <div class="callout"><p>💡 Read model catalog sản phẩm <em>không</em> cần ILM — nó là index "sống" có update/delete, dùng alias + reindex. ILM/data stream dành cho log, audit, event, metric: thứ mà ở hệ thống ta có thể nằm song song ở ClickHouse. Chọn một nơi làm kho chính để khỏi trả tiền lưu hai lần.</p></div>
  `,

  codeTabs: [
    { id: "ilm", label: "① ILM policy", lines: [
      "PUT /_ilm/policy/logs-30d",
      "{ \"policy\": { \"phases\": {",
      "    \"hot\":    { \"actions\": { \"rollover\": { \"max_primary_shard_size\": \"50gb\", \"max_age\": \"1d\" } } },",
      "    \"warm\":   { \"min_age\": \"3d\",  \"actions\": {",
      "                  \"shrink\": { \"number_of_shards\": 1 },",
      "                  \"forcemerge\": { \"max_num_segments\": 1 },",
      "                  \"allocate\": { \"number_of_replicas\": 1 } } },",
      "    \"cold\":   { \"min_age\": \"14d\", \"actions\": { \"allocate\": { \"number_of_replicas\": 0 } } },",
      "    \"delete\": { \"min_age\": \"30d\", \"actions\": { \"delete\": {} } }",
      "} } }"
    ]},
    { id: "tpl", label: "② Template + data stream", lines: [
      "PUT /_index_template/logs-order",
      "{ \"index_patterns\": [ \"logs-order-*\" ],",
      "  \"data_stream\": {},",
      "  \"priority\": 500,",
      "  \"template\": {",
      "    \"settings\": { \"number_of_shards\": 1, \"index.lifecycle.name\": \"logs-30d\" },",
      "    \"mappings\": { \"properties\": { \"@timestamp\": { \"type\": \"date\" },",
      "                                   \"level\": { \"type\": \"keyword\" }, \"message\": { \"type\": \"text\" } } }",
      "} }",
      "",
      "POST /logs-order-prod/_doc      // data stream tự tạo ở lần ghi đầu",
      "{ \"@timestamp\": \"2024-05-01T10:00:00+07:00\", \"level\": \"ERROR\", \"message\": \"payment timeout\" }"
    ]},
    { id: "watch", label: "③ Theo dõi", lines: [
      "GET /_data_stream/logs-order-prod",
      "# → \"indices\": [ \".ds-logs-order-prod-2024.05.01-000001\", \"...-000002\" ]",
      "",
      "GET /.ds-logs-order-prod-*/_ilm/explain",
      "# → \"phase\": \"warm\", \"action\": \"forcemerge\", \"step\": \"segment-count\"",
      "",
      "POST /logs-order-prod/_rollover            // ép rollover thủ công (vd đổi mapping)",
      "",
      "# bulk vào data stream phải dùng create:",
      "{ \"create\": { \"_index\": \"logs-order-prod\" } }"
    ]},
    { id: "ism", label: "④ OpenSearch ISM", lines: [
      "PUT /_plugins/_ism/policies/logs_30d",
      "{ \"policy\": {",
      "    \"description\": \"log 30 ngày\", \"default_state\": \"hot\",",
      "    \"states\": [",
      "      { \"name\": \"hot\",  \"actions\": [ { \"rollover\": { \"min_primary_shard_size\": \"50gb\" } } ],",
      "        \"transitions\": [ { \"state_name\": \"warm\", \"conditions\": { \"min_index_age\": \"3d\" } } ] },",
      "      { \"name\": \"warm\", \"actions\": [ { \"force_merge\": { \"max_num_segments\": 1 } } ],",
      "        \"transitions\": [ { \"state_name\": \"delete\", \"conditions\": { \"min_index_age\": \"30d\" } } ] },",
      "      { \"name\": \"delete\", \"actions\": [ { \"delete\": {} } ], \"transitions\": [] } ],",
      "    \"ism_template\": { \"index_patterns\": [ \"logs-order-*\" ], \"priority\": 100 }",
      "} }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ds"><div class="nl">🌊 Data stream logs-order-prod</div><div class="ns">ghi vào backing index mới nhất</div></div>
    <div class="arrow" id="a1">↓ rollover khi shard 50GB / 1 ngày</div>
    <div class="row">
      <div class="node" id="hot"><div class="nl">🔥 hot</div><div class="ns">SSD · đang ghi</div></div>
      <div class="node" id="warm"><div class="nl">🌤️ warm (3d)</div><div class="ns">shrink · forcemerge</div></div>
      <div class="node" id="cold"><div class="nl">❄️ cold (14d)</div><div class="ns">0 replica / snapshot</div></div>
    </div>
    <div class="arrow" id="a2">↓ 30 ngày</div>
    <div class="node" id="del"><div class="nl">🗑️ delete</div><div class="ns">xoá cả index — rẻ hơn delete_by_query rất nhiều</div></div>
  `,
  steps: [
    { title: "1 · Policy mô tả vòng đời", tab: "ilm", highlight: [3, 4, 8, 9], on: ["hot", "warm", "cold", "del"],
      desc: "Mỗi pha một nhóm hành động; min_age tính từ lúc rollover." },
    { title: "2 · Template gắn mọi thứ lại", tab: "tpl", highlight: [2, 3, 6, 7], on: ["ds"],
      desc: "Index mới do rollover tự nhận mapping, settings, policy." },
    { title: "3 · Ghi vào data stream", tab: "tpl", highlight: [11, 12], on: ["ds", "a1"],
      desc: "Ghi vào tên data stream; ES chuyển vào backing index hiện hành. Bắt buộc @timestamp." },
    { title: "4 · Theo dõi ILM", tab: "watch", highlight: [1, 2, 4, 5, 10], on: ["warm"],
      desc: "_ilm/explain cho biết index đang ở pha/bước nào, kẹt ở đâu." },
    { title: "5 · Xoá bằng cả index", tab: "ilm", highlight: [9], on: ["a2", "del"],
      desc: "Xoá index là thao tác metadata, gần như miễn phí; delete_by_query tạo tombstone và merge nặng." },
    { title: "6 · OpenSearch viết lại bằng ISM", tab: "ism", highlight: [1, 3, 5, 6, 10], on: ["hot", "warm"],
      desc: "Mô hình state + transition; API và tên tham số khác (min_index_age, force_merge)." }
  ],

  quiz: [
    { q: "min_age trong pha warm được tính từ khi nào (khi có rollover)?", options: [
        "Từ lúc document đầu tiên được ghi", "Từ lúc index được rollover", "Từ lúc tạo cụm", "Từ lúc policy tạo"
      ], correct: 1, explanation: "Không có rollover thì tính từ lúc tạo index." },
    { q: "Điều kiện rollover khuyên dùng để shard ổn định?", options: [
        "max_docs = 1000", "max_primary_shard_size ~50GB", "max_age = 1h", "Không rollover"
      ], correct: 1, explanation: "Kích thước shard không phụ thuộc lưu lượng." },
    { q: "Data stream yêu cầu gì?", options: [
        "Field @timestamp; ghi kiểu append (op_type create)",
        "Nested mapping",
        "Không có mapping",
        "Chỉ 1 shard"
      ], correct: 0, explanation: "Sửa/xoá qua by_query hoặc trên backing index." },
    { q: "Vì sao xoá dữ liệu cũ bằng xoá cả index tốt hơn delete_by_query?", options: [
        "Không khác",
        "Xoá index gần như miễn phí; delete_by_query đánh dấu từng doc, gây merge nặng",
        "delete_by_query không tồn tại",
        "Để giữ tombstone"
      ], correct: 1, explanation: "Đây là lý do chia dữ liệu theo thời gian." },
    { q: "Hành động nào hợp ở pha warm?", options: [
        "rollover", "shrink + forcemerge", "Tăng replica lên 5", "Đổi mapping"
      ], correct: 1, explanation: "Index không còn ghi nên gộp shard/segment an toàn." },
    { q: "Index template (composable) dùng để?", options: [
        "Tạo query mẫu",
        "Tự áp mapping/settings/policy cho index mới khớp pattern",
        "Backup",
        "Phân quyền"
      ], correct: 1, explanation: "Index sinh ra do rollover nhận template." },
    { q: "Ở OpenSearch, tương đương ILM là?", options: [
        "SLM", "ISM với states/actions/transitions", "CCR", "Không có"
      ], correct: 1, explanation: "Policy phải viết lại theo cú pháp ISM." },
    { q: "Catalog sản phẩm có update/delete liên tục có nên dùng data stream + ILM?", options: [
        "Có",
        "Không — dùng index thường + alias + reindex; data stream dành cho dữ liệu append theo thời gian",
        "Bắt buộc",
        "Chỉ trên OpenSearch"
      ], correct: 1, explanation: "Data stream tối ưu cho append-only." },
    { q: "Searchable snapshot (cold/frozen) cần license nào ở Elastic?", options: [
        "Basic miễn phí", "Enterprise", "Không cần", "Gold"
      ], correct: 1, explanation: "ILM, rollover, data stream thì có ở Basic." },
    { q: "Bulk vào data stream bằng action index sẽ ra sao?", options: [
        "OK",
        "Lỗi — data stream chỉ nhận op_type create",
        "Ghi vào index cũ",
        "Ghi đè"
      ], correct: 1, explanation: "Dùng create." }
  ]
});
