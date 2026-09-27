window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Ghi dữ liệu",
  title: "Đổi mapping không downtime: reindex + alias",
  subtitle: "app chỉ biết alias · index có phiên bản · _reindex chạy nền · bắt kịp thay đổi · swap nguyên tử",

  theory: `
    <p>Bài 04 đã nói: không đổi được kiểu field, analyzer, số primary shard trên index đang có. Cách làm chuẩn là <strong>index mới + alias</strong>.</p>

    <p><strong>Alias</strong> là một cái tên trỏ tới một hay nhiều index. Ứng dụng <em>chỉ</em> dùng alias (<code>products</code>), không bao giờ dùng tên index thật (<code>products_v3</code>). Nhờ đó đổi index bên dưới mà code không biết. Alias trỏ nhiều index: search trên tất cả, còn ghi thì cần đúng một index có <code>is_write_index: true</code>.</p>

    <p><strong>Quy trình zero-downtime</strong></p>
    <ol>
      <li>Tạo <code>products_v4</code> với mapping/settings mới (có thể <code>refresh_interval: -1</code>, replicas 0 để nạp nhanh).</li>
      <li>Ghi nhận mốc T0 (thời điểm hoặc offset Kafka).</li>
      <li>Nạp dữ liệu: <code>POST _reindex</code> từ v3 (<code>wait_for_completion=false</code>, <code>slices=auto</code>) — đọc <code>_source</code> của v3, nên v3 phải còn _source. Hoặc nạp lại từ DB chính nếu mapping mới cần dữ liệu v3 không có.</li>
      <li><strong>Bắt kịp</strong> các thay đổi từ T0: indexer ghi song song vào cả v3 và v4 trong lúc chuyển, hoặc cho consumer thứ hai đọc Kafka từ offset T0 vào v4. Dùng external version (bài 15) để bản mới không bị bản cũ đè, bất kể thứ tự.</li>
      <li>Bật lại refresh/replica, chờ green, so số lượng (<code>_count</code>) và chạy vài query mẫu.</li>
      <li><strong>Swap alias nguyên tử</strong>: một request <code>_aliases</code> gồm <code>remove</code> v3 + <code>add</code> v4 — không có khoảnh khắc nào alias trỏ vào không gì.</li>
      <li>Giữ v3 vài ngày để rollback (swap ngược), rồi xoá.</li>
    </ol>

    <p><strong>_reindex cần biết</strong>: chạy dưới dạng task (<code>GET _tasks/&lt;id&gt;</code>, huỷ bằng <code>_cancel</code>); có <code>requests_per_second</code> để throttle; <code>"op_type": "create"</code> để không ghi đè doc đã có ở đích; <code>"version_type": "external"</code> để giữ version nguồn; có <code>script</code> để biến đổi document; có thể reindex từ cụm khác (<code>source.remote</code>, phải whitelist <code>reindex.remote.whitelist</code>) — dùng khi chuyển cụm hay chuyển ES ↔ OpenSearch.</p>

    <p><strong>Những việc không cần reindex</strong>: thêm field mới, đổi <code>number_of_replicas</code>, đổi <code>refresh_interval</code>, đổi <code>search_analyzer</code> (với synonym updateable), thêm multi-field mới (nhưng document cũ chỉ có giá trị sau khi được index lại — <code>_update_by_query</code> không script sẽ làm việc đó).</p>

    <div class="callout"><p>💡 Coi mỗi phiên bản index như một migration Flyway: <code>products_v4.json</code> nằm trong repo, CI tạo index, job reindex, bước cuối swap alias. Khác Flyway ở chỗ bạn có sẵn nút rollback: swap alias ngược lại.</p></div>
  `,

  codeTabs: [
    { id: "alias", label: "① Alias ban đầu", lines: [
      "PUT /products_v3",
      "{ \"aliases\": { \"products\": { \"is_write_index\": true } }, \"mappings\": { ... } }",
      "",
      "GET /_alias/products",
      "# → { \"products_v3\": { \"aliases\": { \"products\": { \"is_write_index\": true } } } }",
      "",
      "// code Rust chỉ biết tên alias",
      "const INDEX: &str = \"products\";"
    ]},
    { id: "reindex", label: "② Tạo v4 & reindex", lines: [
      "PUT /products_v4",
      "{ \"settings\": { \"refresh_interval\": \"-1\", \"number_of_replicas\": 0, \"analysis\": { ... } },",
      "  \"mappings\": { ... mapping mới ... } }",
      "",
      "POST /_reindex?wait_for_completion=false&slices=auto",
      "{ \"source\": { \"index\": \"products_v3\", \"size\": 2000 },",
      "  \"dest\":   { \"index\": \"products_v4\", \"version_type\": \"external\" } }",
      "# → { \"task\": \"r1A2WoRbTwKZ516z6NEs5A:36619\" }",
      "",
      "GET /_tasks/r1A2WoRbTwKZ516z6NEs5A:36619"
    ]},
    { id: "catch", label: "③ Bắt kịp thay đổi", lines: [
      "# Cách A: indexer ghi đôi trong thời gian chuyển",
      "for target in [\"products_v3\", \"products_v4\"]:",
      "    bulk(target, events, version_type = external)",
      "",
      "# Cách B: consumer group mới đọc Kafka từ offset T0 → chỉ ghi v4",
      "kafka-consumer-groups --group es-indexer-v4 --topic product-events \\",
      "    --reset-offsets --to-datetime 2024-05-01T10:00:00.000 --execute",
      "",
      "# external version đảm bảo reindex và event trễ không đè bản mới"
    ]},
    { id: "swap", label: "④ Swap nguyên tử", lines: [
      "PUT /products_v4/_settings  { \"index\": { \"refresh_interval\": \"1s\", \"number_of_replicas\": 1 } }",
      "GET /_cat/count/products_v3,products_v4?v",
      "",
      "POST /_aliases",
      "{ \"actions\": [",
      "    { \"remove\": { \"index\": \"products_v3\", \"alias\": \"products\" } },",
      "    { \"add\":    { \"index\": \"products_v4\", \"alias\": \"products\", \"is_write_index\": true } }",
      "] }",
      "",
      "# rollback = đảo hai action ; vài ngày sau: DELETE /products_v3"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🦀 search-api / indexer</div><div class="ns">chỉ biết alias "products"</div></div>
    <div class="arrow" id="a1">↓ alias</div>
    <div class="row">
      <div class="node" id="v3"><div class="nl">products_v3</div><div class="ns">mapping cũ</div></div>
      <div class="node" id="v4"><div class="nl">products_v4</div><div class="ns">mapping mới</div></div>
    </div>
    <div class="arrow" id="a2">↓ _reindex + bắt kịp từ T0</div>
    <div class="node" id="swap"><div class="nl">🔀 POST /_aliases</div><div class="ns">remove v3 + add v4 trong một request</div></div>
  `,
  steps: [
    { title: "1 · Ứng dụng chỉ biết alias", tab: "alias", highlight: [2, 8], on: ["app", "a1", "v3"],
      desc: "Tên index thật không bao giờ xuất hiện trong code." },
    { title: "2 · Index mới, nạp nhanh", tab: "reindex", highlight: [2, 5, 6, 7], on: ["v4", "a2"],
      desc: "_reindex chạy nền bằng task, song song theo slice, giữ version nguồn." },
    { title: "3 · Không để lọt thay đổi", tab: "catch", highlight: [2, 3, 5, 6, 7, 9], on: ["v3", "v4"],
      desc: "Mọi thay đổi sau T0 phải vào v4. External version làm thứ tự đến không còn quan trọng." },
    { title: "4 · Kiểm tra trước khi đổi", tab: "swap", highlight: [1, 2], on: ["v4"],
      desc: "Bật replica, chờ green, so số lượng, chạy query mẫu." },
    { title: "5 · Swap nguyên tử", tab: "swap", highlight: [4, 6, 7, 10], on: ["swap", "app"],
      desc: "Một request, hai action: không có khoảnh khắc alias rỗng. Rollback bằng cách đảo lại." }
  ],

  quiz: [
    { q: "Vì sao ứng dụng nên dùng alias thay vì tên index thật?", options: [
        "Alias nhanh hơn",
        "Đổi index bên dưới (reindex, rollback) mà không cần deploy lại code",
        "Alias tự tạo mapping",
        "Bắt buộc từ ES 8"
      ], correct: 1, explanation: "Alias là lớp gián tiếp." },
    { q: "Swap alias an toàn làm thế nào?", options: [
        "DELETE alias rồi PUT alias mới",
        "Một request POST /_aliases chứa cả remove và add — thực hiện nguyên tử",
        "Đổi tên index",
        "Restart cụm"
      ], correct: 1, explanation: "Hai request riêng tạo khoảng trống alias không trỏ đâu." },
    { q: "_reindex lấy dữ liệu từ đâu?", options: [
        "Translog", "_source của index nguồn", "Doc values", "Snapshot"
      ], correct: 1, explanation: "Tắt _source là mất khả năng reindex." },
    { q: "Trong lúc reindex, dữ liệu mới vẫn đổ về. Cần làm gì?", options: [
        "Không cần gì",
        "Bắt kịp thay đổi từ mốc T0 (ghi đôi hoặc replay Kafka từ T0) vào index mới",
        "Dừng toàn hệ thống",
        "Tăng replica"
      ], correct: 1, explanation: "Nếu không, index mới thiếu các thay đổi trong thời gian reindex." },
    { q: "Vì sao dùng version_type external khi reindex + bắt kịp song song?", options: [
        "Bắt buộc",
        "Để document bản mới (từ event) không bị bản cũ (từ reindex) ghi đè, bất kể thứ tự",
        "Để nhanh hơn",
        "Để giữ _seq_no"
      ], correct: 1, explanation: "Bản có version cao hơn luôn thắng." },
    { q: "Alias trỏ tới 2 index, ghi vào alias thì sao?", options: [
        "Ghi vào cả hai",
        "Cần đúng một index có is_write_index: true, nếu không sẽ lỗi",
        "Ghi ngẫu nhiên",
        "Ghi vào index đầu"
      ], correct: 1, explanation: "Search thì trên tất cả." },
    { q: "Thay đổi nào KHÔNG cần reindex?", options: [
        "Đổi kiểu field price",
        "Đổi analyzer của name",
        "Tăng number_of_replicas",
        "Đổi số primary shard"
      ], correct: 2, explanation: "Replica là setting động." },
    { q: "Reindex từ cụm Elasticsearch cũ sang cụm OpenSearch mới dùng tính năng gì?", options: [
        "Snapshot luôn tương thích",
        "Reindex from remote (source.remote) với reindex.remote.whitelist ở cụm đích",
        "CCR",
        "Không có cách"
      ], correct: 1, explanation: "Snapshot giữa hai dự án chỉ tương thích hạn chế theo phiên bản." },
    { q: "Rollback sau khi swap sang v4 bị lỗi?", options: [
        "Khôi phục snapshot",
        "Swap alias ngược lại về v3 (nếu còn giữ và v3 vẫn được cập nhật)",
        "Không rollback được",
        "Reindex v4 về v3"
      ], correct: 1, explanation: "Vì vậy giữ v3 thêm vài ngày." }
  ]
});
