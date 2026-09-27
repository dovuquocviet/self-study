window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Ghi dữ liệu",
  title: "Đường ghi: bulk, refresh, near-real-time, translog, flush",
  subtitle: "vì sao ghi xong search chưa thấy · refresh=wait_for · translog giữ bền · bulk đúng cách · 429",

  theory: `
    <p><strong>Một document đi qua 4 trạng thái trong shard</strong>:</p>
    <ol>
      <li><strong>Indexing buffer (heap) + translog</strong>: ghi vào buffer trong RAM, đồng thời append vào <em>translog</em> (write-ahead log) trên disk. Với <code>index.translog.durability: request</code> (mặc định) translog được <strong>fsync trước khi trả 200</strong> → đã ack thì không mất dù node sập.</li>
      <li><strong>Refresh</strong> (mặc định mỗi <code>1s</code>): buffer thành segment mới trong <em>filesystem cache</em> (chưa fsync) và <strong>mở cho search</strong>. Đây là "near real-time": trễ tối đa ~1 refresh interval.</li>
      <li><strong>Flush</strong>: Lucene commit — fsync các segment xuống disk, bắt đầu translog mới và dọn phần cũ. ES tự flush khi translog đủ lớn.</li>
      <li><strong>Merge</strong> nền (bài 03).</li>
    </ol>
    <p>Node sập sau ack nhưng trước flush? Khởi động lại sẽ <strong>replay translog</strong> → không mất. <code>durability: async</code> (fsync mỗi <code>sync_interval</code>, mặc định 5s) nhanh hơn nhưng có thể mất vài giây dữ liệu đã ack.</p>

    <p><strong>Search idle</strong>: shard không nhận search trong <code>index.search.idle.after</code> (30s) sẽ tạm không refresh định kỳ (nếu bạn không tự đặt <code>refresh_interval</code>); request search đầu tiên sau đó sẽ kích refresh và chờ. Đó là lý do đôi khi query đầu "chậm bất thường".</p>

    <p><strong>Tham số <code>refresh</code> trên request ghi</strong>:</p>
    <ul>
      <li><code>false</code> (mặc định): trả ngay, search thấy sau refresh kế tiếp.</li>
      <li><code>wait_for</code>: chờ tới refresh định kỳ kế tiếp rồi mới trả — "ghi xong đọc được" mà không ép refresh.</li>
      <li><code>true</code>: ép refresh ngay → sinh segment tí hon mỗi request. Chỉ dùng trong test.</li>
    </ul>

    <p><strong>Bulk API</strong>: body NDJSON, mỗi thao tác 1 dòng action + (tuỳ loại) 1 dòng dữ liệu, kết thúc bằng xuống dòng. Điểm khởi đầu hợp lý: vài MB tới ~10–15MB mỗi request (hoặc vài nghìn document), rồi đo và điều chỉnh. Hai bẫy:</p>
    <ul>
      <li>Bulk trả <strong>HTTP 200 kể cả khi một số item lỗi</strong>. Phải đọc <code>"errors": true</code> và duyệt <code>items[]</code> để retry/đưa vào dead-letter.</li>
      <li>Cụm quá tải trả <code>429 es_rejected_execution_exception</code> (hàng đợi thread pool write đầy) → retry có backoff, không bắn dồn.</li>
    </ul>

    <p><strong>Nạp lần đầu hàng chục triệu document</strong>: đặt <code>refresh_interval: -1</code> và <code>number_of_replicas: 0</code> cho index mới, bulk song song, xong trả lại <code>1s</code> / <code>1</code> (replica sẽ copy segment, nhanh hơn index lại từng doc).</p>

    <div class="callout"><p>💡 So với PostgreSQL: translog ≈ WAL, flush ≈ checkpoint. Khác biệt: PostgreSQL commit xong là SELECT thấy ngay; ES tách "bền" (translog) khỏi "nhìn thấy" (refresh). Test tích hợp Rust hay fail ngẫu nhiên vì quên điều này — dùng <code>refresh=wait_for</code> trong test.</p></div>
  `,

  codeTabs: [
    { id: "bulk", label: "① Bulk NDJSON", lines: [
      "POST /_bulk",
      "{ \"index\":  { \"_index\": \"products\", \"_id\": \"42\" } }",
      "{ \"sku\": \"A55\", \"name\": \"Galaxy A55\", \"price\": 8990000 }",
      "{ \"create\": { \"_index\": \"products\", \"_id\": \"43\" } }",
      "{ \"sku\": \"A35\", \"name\": \"Galaxy A35\", \"price\": 6990000 }",
      "{ \"update\": { \"_index\": \"products\", \"_id\": \"40\" } }",
      "{ \"doc\": { \"price\": 5490000 } }",
      "{ \"delete\": { \"_index\": \"products\", \"_id\": \"39\" } }",
      "",
      "# Content-Type: application/x-ndjson ; dòng cuối phải có \\n"
    ]},
    { id: "resp", label: "② 200 nhưng có lỗi", lines: [
      "HTTP/1.1 200 OK",
      "{ \"took\": 12, \"errors\": true, \"items\": [",
      "  { \"index\":  { \"_id\": \"42\", \"status\": 201, \"result\": \"created\" } },",
      "  { \"create\": { \"_id\": \"43\", \"status\": 409,",
      "               \"error\": { \"type\": \"version_conflict_engine_exception\" } } },",
      "  { \"update\": { \"_id\": \"40\", \"status\": 404, \"error\": { \"type\": \"document_missing_exception\" } } },",
      "  { \"delete\": { \"_id\": \"39\", \"status\": 200, \"result\": \"deleted\" } }",
      "] }",
      "# 409/404: lỗi dữ liệu → log/dead-letter ; 429: retry có backoff"
    ]},
    { id: "refresh", label: "③ refresh & translog", lines: [
      "PUT /products/_doc/42?refresh=wait_for     // chờ refresh kế tiếp rồi mới trả",
      "",
      "PUT /products/_settings",
      "{ \"index\": {",
      "    \"refresh_interval\": \"1s\",              // mặc định",
      "    \"translog.durability\": \"request\",      // fsync translog trước khi ack (mặc định)",
      "    \"translog.sync_interval\": \"5s\"         // chỉ có ý nghĩa khi durability = async",
      "} }",
      "",
      "POST /products/_refresh      // ép refresh thủ công",
      "POST /products/_flush        // ép Lucene commit"
    ]},
    { id: "load", label: "④ Nạp lần đầu", lines: [
      "PUT /products_v5/_settings",
      "{ \"index\": { \"refresh_interval\": \"-1\", \"number_of_replicas\": 0 } }",
      "",
      "# ... bulk song song nhiều worker, mỗi request vài MB ...",
      "",
      "PUT /products_v5/_settings",
      "{ \"index\": { \"refresh_interval\": \"1s\", \"number_of_replicas\": 1 } }",
      "POST /products_v5/_refresh",
      "GET /_cluster/health/products_v5?wait_for_status=green&timeout=5m"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="buf"><div class="nl">📥 Indexing buffer</div><div class="ns">heap — chưa search được</div></div>
      <div class="node" id="tl"><div class="nl">📜 Translog</div><div class="ns">fsync trước khi ack</div></div>
    </div>
    <div class="arrow" id="a1">↓ refresh (1s)</div>
    <div class="node" id="seg"><div class="nl">🧱 Segment trong FS cache</div><div class="ns">search thấy · chưa fsync</div></div>
    <div class="arrow" id="a2">↓ flush (Lucene commit)</div>
    <div class="node" id="disk"><div class="nl">💾 Segment đã fsync</div><div class="ns">translog cũ được dọn</div></div>
  `,
  steps: [
    { title: "1 · Gom nhiều thao tác vào bulk", tab: "bulk", highlight: [2, 3, 6, 7, 8], on: ["buf"],
      desc: "Một request, nhiều thao tác: index/create/update/delete. Tiết kiệm round-trip và chi phí mỗi request." },
    { title: "2 · Ack = đã nằm trong translog", tab: "refresh", highlight: [6], on: ["buf", "tl"],
      desc: "Sập node sau ack vẫn phục hồi được bằng replay translog." },
    { title: "3 · Refresh mở cho search", tab: "refresh", highlight: [1, 5], on: ["a1", "seg"],
      desc: "wait_for trả về khi refresh định kỳ đã chạy, không ép sinh segment tí hon." },
    { title: "4 · Flush fsync segment", tab: "refresh", highlight: [11], on: ["a2", "disk"],
      desc: "Sau commit, translog phần cũ không còn cần để phục hồi." },
    { title: "5 · Luôn đọc items[]", tab: "resp", highlight: [1, 2, 4, 6, 9], on: ["tl"],
      desc: "HTTP 200 không có nghĩa mọi document đã vào. Indexer không kiểm tra là mất dữ liệu âm thầm." },
    { title: "6 · Nạp lớn: tắt refresh & replica", tab: "load", highlight: [2, 7, 9], on: ["seg", "disk"],
      desc: "Bớt segment nhỏ và bớt ghi đôi; bật lại khi xong rồi chờ green." }
  ],

  quiz: [
    { q: "Vì sao index xong mà _search chưa thấy document?", options: [
        "Lỗi replica",
        "Document chỉ search được sau refresh (mặc định ~1s) — near real-time",
        "Translog chưa flush",
        "Chưa merge"
      ], correct: 1, explanation: "Refresh biến buffer thành segment mở cho search." },
    { q: "Với durability: request, khi nào translog được fsync?", options: [
        "Mỗi 5s", "Trước khi trả ack cho request ghi", "Khi flush", "Không bao giờ"
      ], correct: 1, explanation: "Nên dữ liệu đã ack không mất khi node sập." },
    { q: "refresh=wait_for khác refresh=true thế nào?", options: [
        "Giống nhau",
        "wait_for chờ refresh định kỳ kế tiếp; true ép refresh ngay, sinh segment nhỏ",
        "wait_for không đợi",
        "true an toàn hơn cho production"
      ], correct: 1, explanation: "true với tải lớn gây rất nhiều segment tí hon." },
    { q: "Bulk trả HTTP 200. Kết luận đúng?", options: [
        "Mọi document đã được index",
        "Phải kiểm tra errors và từng item — một số có thể lỗi",
        "Chưa được lưu",
        "Chỉ document đầu thành công"
      ], correct: 1, explanation: "Status từng item nằm trong items[]." },
    { q: "Nhận 429 es_rejected_execution_exception khi bulk. Làm gì?", options: [
        "Tăng số worker bắn nhanh hơn",
        "Retry với backoff, giảm đồng thời/kích thước",
        "Bỏ qua",
        "Xoá index"
      ], correct: 1, explanation: "Hàng đợi write thread pool đầy." },
    { q: "Flush trong ES tương ứng với khái niệm nào của PostgreSQL?", options: [
        "VACUUM", "Checkpoint (fsync dữ liệu, cắt WAL)", "ANALYZE", "COMMIT"
      ], correct: 1, explanation: "Translog ≈ WAL, flush ≈ checkpoint." },
    { q: "Nạp lần đầu 50 triệu document, cấu hình tạm thời nên là?", options: [
        "refresh_interval 1ms",
        "refresh_interval -1 và number_of_replicas 0, xong thì bật lại",
        "durability async vĩnh viễn",
        "number_of_shards 0"
      ], correct: 1, explanation: "Giảm segment nhỏ và ghi đôi; replica sau đó copy segment." },
    { q: "Query đầu tiên sau một lúc không ai search bị chậm, lý do có thể?", options: [
        "Merge",
        "Search idle: shard ngừng refresh định kỳ, request đầu phải chờ refresh",
        "Master bầu lại",
        "Translog đầy"
      ], correct: 1, explanation: "index.search.idle.after mặc định 30s (khi không đặt refresh_interval tường minh)." },
    { q: "Thao tác create trong bulk khác index ở điểm nào?", options: [
        "Không khác",
        "create lỗi 409 nếu _id đã tồn tại; index ghi đè",
        "create chậm hơn",
        "create không cần _id"
      ], correct: 1, explanation: "Dùng create khi muốn chắc chắn không ghi đè." }
  ]
});
