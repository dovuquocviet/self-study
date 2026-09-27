window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Bản đồ & kiến trúc",
  title: "Bên trong một shard: Lucene segment, inverted index, doc values",
  subtitle: "segment bất biến · xoá = đánh dấu · merge · 4 cấu trúc dữ liệu cho 4 việc khác nhau",

  theory: `
    <p>Một shard = một index Lucene = nhiều <strong>segment</strong>. Segment là một "mini index" hoàn chỉnh, <strong>bất biến</strong> (immutable) sau khi được ghi.</p>
    <ul>
      <li><strong>Thêm document</strong>: vào buffer trong RAM → mỗi lần <em>refresh</em> buffer thành segment mới (bài 14).</li>
      <li><strong>Xoá</strong>: không xoá thật, chỉ đánh dấu vào file <code>.liv</code> (live docs). Document vẫn chiếm chỗ tới khi merge.</li>
      <li><strong>Update</strong> = xoá bản cũ (đánh dấu) + thêm bản mới vào segment mới. Không có "update tại chỗ".</li>
      <li><strong>Merge</strong>: nền, gộp nhiều segment nhỏ thành segment lớn, lúc này mới bỏ hẳn document đã xoá. Tốn IO/CPU.</li>
    </ul>
    <p>Vì bất biến nên segment cache rất tốt (OS page cache), không cần lock khi đọc, nén mạnh được. Cái giá: update nhiều = rác nhiều.</p>

    <p><strong>Mỗi field được lưu bằng cấu trúc phù hợp với việc nó phải làm</strong></p>
    <table>
      <tr><th>Cấu trúc</th><th>Hình dạng</th><th>Phục vụ</th></tr>
      <tr><td><strong>Inverted index</strong> (term dictionary + postings)</td><td>term → danh sách docId (+ tần suất, vị trí)</td><td>Tìm "document nào chứa từ X" — full-text, <code>term</code></td></tr>
      <tr><td><strong>BKD tree</strong> (points)</td><td>cây k-d cho số, ngày, IP, geo</td><td><code>range</code>, lọc số/ngày</td></tr>
      <tr><td><strong>Doc values</strong></td><td>lưu theo cột: docId → giá trị, trên disk</td><td>Sort, aggregation, script — "doc này có giá trị gì"</td></tr>
      <tr><td><strong>Stored fields</strong> / <code>_source</code></td><td>JSON gốc nén theo khối</td><td>Trả document về cho client (pha fetch)</td></tr>
    </table>
    <p>Inverted index trả lời câu hỏi "từ → document"; doc values trả lời chiều ngược "document → giá trị". Aggregation <code>terms</code> trên field <code>brand</code> đọc doc values, không đọc inverted index.
    Field <code>text</code> <strong>không có doc values</strong> → không sort/agg được (trừ khi bật <code>fielddata</code> — nạp vào heap, rất tốn, tránh dùng).</p>

    <p><code>_source</code> là JSON bạn gửi lên, được lưu nguyên. Tắt <code>_source</code> để tiết kiệm disk = mất khả năng reindex, update, highlight — gần như không bao giờ nên tắt với read model.</p>

    <div class="callout"><p>💡 So với B-tree của PostgreSQL: B-tree sắp xếp giá trị để tìm vị trí row; inverted index sắp xếp <em>từ</em> để tìm <em>tập</em> document, và tập đó giao/hợp rất nhanh (bool query). Đổi lại, ghi vào Lucene rẻ theo lô nhưng "sửa một dòng" thì đắt hơn DB quan hệ.</p></div>
  `,

  codeTabs: [
    { id: "inv", label: "① Inverted index", lines: [
      "doc 1: \"Điện thoại Samsung giá rẻ\"",
      "doc 2: \"Ốp lưng điện thoại\"",
      "doc 3: \"Samsung Galaxy Tab\"",
      "",
      "# sau analyzer (lowercase, bỏ dấu):",
      "term       → postings (docId: tần suất @ vị trí)",
      "dien       → 1:1@0, 2:1@2",
      "thoai      → 1:1@1, 2:1@3",
      "samsung    → 1:1@2, 3:1@0",
      "gia        → 1:1@3",
      "galaxy     → 3:1@1",
      "",
      "# 'samsung' AND 'thoai' = {1,3} ∩ {1,2} = {1}"
    ]},
    { id: "dv", label: "② Doc values", lines: [
      "# lưu theo cột, cho sort/aggregation",
      "docId │ brand     │ price",
      "──────┼───────────┼─────────",
      "  1   │ samsung   │ 3990000",
      "  2   │ noname    │   90000",
      "  3   │ samsung   │ 7490000",
      "",
      "# terms agg trên brand: quét cột brand của các doc khớp → đếm",
      "# sort theo price: đọc cột price, không cần mở _source"
    ]},
    { id: "seg", label: "③ Segment trên disk", lines: [
      "GET /_cat/segments/products?v",
      "index    shard segment generation docs.count docs.deleted size",
      "products 0     _0      0          120000     8500         48mb",
      "products 0     _1      1          3000       0            1.3mb",
      "products 0     _2      2          40         0            40kb",
      "",
      "# docs.deleted: đánh dấu xoá, chưa merge",
      "POST /logs-2024.01/_forcemerge?max_num_segments=1   // CHỈ cho index không còn ghi"
    ]},
    { id: "fd", label: "④ Bẫy fielddata", lines: [
      "POST /products/_search",
      "{ \"aggs\": { \"by_name\": { \"terms\": { \"field\": \"name\" } } } }",
      "",
      "# → illegal_argument_exception: Fielddata is disabled on [name]",
      "#   Text fields are not optimised for operations that require",
      "#   per-document field data like aggregations and sorting...",
      "",
      "# ĐÚNG: agg trên sub-field keyword (bài 04)",
      "{ \"aggs\": { \"by_name\": { \"terms\": { \"field\": \"name.raw\" } } } }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="buf"><div class="nl">📥 Indexing buffer (RAM)</div><div class="ns">document mới chưa search được</div></div>
    <div class="arrow" id="a1">↓ refresh (~1s)</div>
    <div class="row">
      <div class="node" id="s0"><div class="nl">🧱 Segment _0</div><div class="ns">lớn, 8500 doc đánh dấu xoá</div></div>
      <div class="node" id="s1"><div class="nl">🧱 Segment _1, _2</div><div class="ns">nhỏ, mới</div></div>
    </div>
    <div class="arrow" id="a2">↓ merge nền</div>
    <div class="node" id="s3"><div class="nl">🧱 Segment _3</div><div class="ns">gộp lại, rác bị loại bỏ</div></div>
  `,
  steps: [
    { title: "1 · Từ → tập document", tab: "inv", highlight: [6, 7, 9, 13], on: ["s0"],
      desc: "Inverted index lưu mỗi term một danh sách docId. Query AND = giao hai tập." },
    { title: "2 · Chiều ngược: document → giá trị", tab: "dv", highlight: [2, 4, 5, 6, 8], on: ["s0"],
      desc: "Doc values lưu theo cột, giống ClickHouse, để sort và aggregation." },
    { title: "3 · Refresh tạo segment mới", tab: "seg", highlight: [3, 4, 5], on: ["buf", "a1", "s1"],
      desc: "Mỗi refresh sinh một segment nhỏ. Segment không bao giờ bị sửa." },
    { title: "4 · Xoá chỉ là đánh dấu", tab: "seg", highlight: [3, 7], on: ["s0"],
      desc: "8500 document bị đánh dấu xoá vẫn nằm trên disk và vẫn tốn công bỏ qua khi search." },
    { title: "5 · Merge dọn rác", tab: "seg", highlight: [8], on: ["a2", "s3"],
      desc: "Merge chạy nền tự động. forcemerge thủ công chỉ dành cho index đã ngừng ghi (vd log ngày cũ)." },
    { title: "6 · text không agg được", tab: "fd", highlight: [2, 4, 9], on: ["s0"],
      desc: "Field text không có doc values. Dùng sub-field keyword thay vì bật fielddata." }
  ],

  quiz: [
    { q: "Segment Lucene có đặc điểm gì?", options: [
        "Sửa tại chỗ khi update",
        "Bất biến sau khi ghi; update = đánh dấu xoá bản cũ + ghi bản mới",
        "Mỗi document một segment",
        "Chỉ nằm trong RAM"
      ], correct: 1, explanation: "Bất biến giúp đọc không cần lock và cache tốt." },
    { q: "Khi xoá một document, dung lượng disk được giải phóng lúc nào?", options: [
        "Ngay lập tức", "Khi segment chứa nó được merge", "Khi restart node", "Không bao giờ"
      ], correct: 1, explanation: "Xoá chỉ ghi vào live-docs; merge mới loại bỏ thật." },
    { q: "Aggregation terms trên field brand đọc cấu trúc nào?", options: [
        "Inverted index", "Doc values", "_source", "Translog"
      ], correct: 1, explanation: "Doc values là lưu trữ theo cột document → giá trị." },
    { q: "Query range trên price (số) dùng cấu trúc nào hiệu quả?", options: [
        "Postings list", "BKD tree (points)", "_source", "fielddata"
      ], correct: 1, explanation: "Số, ngày, IP, geo được index dạng points trong BKD tree." },
    { q: "Vì sao terms agg trên field kiểu text báo lỗi Fielddata is disabled?", options: [
        "Field text không có doc values",
        "Thiếu quyền",
        "Index bị read-only",
        "Aggregation bị tắt toàn cụm"
      ], correct: 0, explanation: "Dùng sub-field keyword; bật fielddata sẽ nạp dữ liệu vào heap, rất tốn." },
    { q: "forcemerge max_num_segments=1 nên dùng khi nào?", options: [
        "Mỗi giờ trên index đang ghi",
        "Trên index không còn nhận ghi (vd log ngày đã qua)",
        "Sau mỗi bulk",
        "Không bao giờ"
      ], correct: 1, explanation: "Trên index đang ghi, segment khổng lồ sẽ lại tích rác và khó merge tiếp." },
    { q: "Tắt _source trên index read model có hệ quả gì?", options: [
        "Không ảnh hưởng",
        "Mất khả năng reindex, update, highlight từ chính ES",
        "Search nhanh gấp 10",
        "Không lưu được keyword"
      ], correct: 1, explanation: "_source là nguyên liệu cho reindex/update; hầu như không nên tắt." },
    { q: "Truy vấn 'samsung AND thoai' được inverted index xử lý thế nào?", options: [
        "Quét toàn bộ _source",
        "Lấy postings của từng term rồi giao hai tập docId",
        "Dùng doc values",
        "Sort rồi so sánh"
      ], correct: 1, explanation: "Giao/hợp các postings list là thao tác cốt lõi của bool query." },
    { q: "Index có nhiều update liên tục gây vấn đề gì?", options: [
        "Không vấn đề",
        "Nhiều document đánh dấu xoá, merge phải làm việc nhiều, tốn IO",
        "Mất dữ liệu",
        "Shard tự tăng số primary"
      ], correct: 1, explanation: "Mỗi update là một lần xoá + thêm." }
  ]
});
