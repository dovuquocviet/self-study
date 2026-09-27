window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Ghi dữ liệu",
  title: "Update, versioning & optimistic concurrency",
  subtitle: "update = đọc-sửa-ghi cả document · _seq_no/_primary_term · if_seq_no · version_type external · update_by_query",

  theory: `
    <p><strong>Update API không sửa tại chỗ</strong>. <code>POST /products/_update/42 {"doc": {"price": ...}}</code> thực chất: đọc <code>_source</code> hiện tại trên primary → merge phần sửa → index lại <em>toàn bộ</em> document (đánh dấu xoá bản cũ, bài 03). Tiết kiệm băng thông mạng chứ không tiết kiệm công index. Nếu nội dung không đổi, ES trả <code>"result": "noop"</code> (<code>detect_noop</code> mặc định bật).</p>

    <p><strong>Metadata phiên bản của mỗi document</strong></p>
    <ul>
      <li><code>_version</code>: tăng 1 mỗi lần ghi (internal versioning).</li>
      <li><code>_seq_no</code>: số thứ tự thao tác trong shard, do primary cấp.</li>
      <li><code>_primary_term</code>: tăng mỗi khi có primary mới (failover). Cặp (<code>_seq_no</code>, <code>_primary_term</code>) xác định duy nhất một lần ghi.</li>
    </ul>

    <p><strong>Optimistic concurrency control</strong> — như <code>@Version</code> của JPA: đọc document lấy <code>_seq_no</code> + <code>_primary_term</code>, ghi kèm <code>if_seq_no</code> &amp; <code>if_primary_term</code>. Có người ghi chen giữa → <strong>409 version_conflict_engine_exception</strong> → đọc lại, áp lại thay đổi, thử lại. (Tham số <code>?version=</code> kiểu cũ cho internal versioning đã bị thay bằng if_seq_no.)</p>

    <p><strong><code>retry_on_conflict</code></strong> trên Update API: ES tự đọc-lại-và-thử-lại N lần. Hợp với thao tác giao hoán như tăng bộ đếm bằng script; không hợp khi logic cần đọc bản mới rồi mới quyết định.</p>

    <p><strong>External versioning</strong> — vũ khí chính cho đồng bộ từ DB: <code>?version=N&amp;version_type=external</code>. ES chỉ nhận nếu N <strong>lớn hơn</strong> version hiện có (<code>external_gte</code>: lớn hơn hoặc bằng). Lấy N từ cột <code>version</code>/<code>updated_at</code> (epoch micro) trong PostgreSQL, hoặc từ offset Kafka của partition → sự kiện đến trễ/trùng lặp bị loại tự động, không cần lock. Delete cũng mang version; ES giữ tombstone một thời gian (<code>index.gc_deletes</code>, mặc định 60s) để chặn bản ghi cũ "hồi sinh" document vừa xoá.</p>

    <p><strong>update_by_query / delete_by_query</strong>: chạy trên mọi document khớp, dùng snapshot + so <code>_seq_no</code>; document bị ghi chen → conflict (<code>conflicts=proceed</code> để bỏ qua và đi tiếp). Chạy nền với <code>wait_for_completion=false</code>, theo dõi qua <code>_tasks</code>. Không có transaction — dừng giữa chừng là cập nhật một phần.</p>

    <div class="callout"><p>💡 Hai người sửa cùng lúc trên Java bạn có <code>OptimisticLockException</code>; ở ES là HTTP 409. Nhưng với read model, cách phổ biến nhất không phải OCC mà là <em>external version từ nguồn</em>: nguồn đã quyết định thứ tự, ES chỉ việc từ chối bản cũ.</p></div>
  `,

  codeTabs: [
    { id: "occ", label: "① if_seq_no", lines: [
      "GET /products/_doc/42",
      "# → { \"_version\": 7, \"_seq_no\": 118, \"_primary_term\": 3, \"_source\": { \"stock\": 5 } }",
      "",
      "PUT /products/_doc/42?if_seq_no=118&if_primary_term=3",
      "{ \"sku\": \"A55\", \"stock\": 4 }",
      "# → 200, _seq_no = 119",
      "",
      "# tiến trình khác vẫn cầm _seq_no = 118:",
      "PUT /products/_doc/42?if_seq_no=118&if_primary_term=3   { ... }",
      "# → 409 version_conflict_engine_exception: required seqNo [118], current [119]"
    ]},
    { id: "upd", label: "② Update API", lines: [
      "POST /products/_update/42",
      "{ \"doc\": { \"price\": 7990000 } }                // partial: merge vào _source",
      "",
      "POST /products/_update/42?retry_on_conflict=3",
      "{ \"script\": { \"source\": \"ctx._source.view_count += params.n\", \"params\": { \"n\": 1 } } }",
      "",
      "POST /products/_update/99",
      "{ \"doc\": { \"price\": 100 }, \"doc_as_upsert\": true }   // chưa có thì tạo",
      "",
      "# nội dung không đổi → \"result\": \"noop\" (không tạo version mới)"
    ]},
    { id: "ext", label: "③ external version", lines: [
      "# PostgreSQL: products(id=42, row_version=1715000000123456)   // updated_at dạng epoch µs",
      "",
      "PUT /products/_doc/42?version=1715000000123456&version_type=external",
      "{ \"sku\": \"A55\", \"price\": 7990000 }   // → 200",
      "",
      "# sự kiện cũ tới trễ:",
      "PUT /products/_doc/42?version=1714999999000000&version_type=external",
      "{ \"sku\": \"A55\", \"price\": 8990000 }",
      "# → 409: current version [1715000000123456] is higher or equal → bị loại ✔"
    ]},
    { id: "ubq", label: "④ update_by_query", lines: [
      "POST /products/_update_by_query?conflicts=proceed&wait_for_completion=false&slices=auto",
      "{ \"query\":  { \"term\": { \"shop.id\": \"s-1\" } },",
      "  \"script\": { \"source\": \"ctx._source.shop.name = params.n\",",
      "              \"params\": { \"n\": \"Shop Mây Official\" } } }",
      "# → { \"task\": \"oTUltX4IQMOUUVeiohTt8A:12345\" }",
      "",
      "GET /_tasks/oTUltX4IQMOUUVeiohTt8A:12345",
      "# → \"status\": { \"total\": 8200, \"updated\": 8190, \"version_conflicts\": 10 }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="r"><div class="nl">📖 Đọc doc 42</div><div class="ns">_seq_no 118 · _primary_term 3</div></div>
    <div class="row">
      <div class="node" id="w1"><div class="nl">✍️ Tiến trình A</div><div class="ns">if_seq_no=118 → OK (119)</div></div>
      <div class="node" id="w2"><div class="nl">✍️ Tiến trình B</div><div class="ns">if_seq_no=118 → 409</div></div>
    </div>
    <div class="arrow" id="a1">↓ B đọc lại, áp lại, thử lại</div>
    <div class="node" id="ext"><div class="nl">🔢 Hoặc: version_type=external</div><div class="ns">nguồn quyết định thứ tự, ES loại bản cũ</div></div>
  `,
  steps: [
    { title: "1 · Đọc kèm seq_no", tab: "occ", highlight: [1, 2], on: ["r"],
      desc: "_seq_no + _primary_term là 'phiên bản' dùng cho OCC." },
    { title: "2 · Ghi có điều kiện", tab: "occ", highlight: [4, 6, 9, 10], on: ["w1", "w2"],
      desc: "Ai ghi sau với seq_no cũ nhận 409 — giống OptimisticLockException." },
    { title: "3 · Update = reindex cả doc", tab: "upd", highlight: [2, 4, 5, 8, 10], on: ["a1"],
      desc: "Partial doc, script, upsert. retry_on_conflict tự thử lại cho thao tác giao hoán." },
    { title: "4 · Nguồn quyết định thứ tự", tab: "ext", highlight: [1, 3, 7, 9], on: ["ext"],
      desc: "version lấy từ DB; sự kiện tới trễ tự bị loại." },
    { title: "5 · Sửa hàng loạt chạy nền", tab: "ubq", highlight: [1, 2, 5, 8], on: ["ext"],
      desc: "conflicts=proceed bỏ qua doc bị ghi chen; theo dõi qua _tasks. Không nguyên tử." }
  ],

  quiz: [
    { q: "Update API partial doc có sửa tại chỗ trong segment không?", options: [
        "Có",
        "Không — đọc _source, merge, index lại toàn bộ document",
        "Chỉ với số",
        "Chỉ khi có script"
      ], correct: 1, explanation: "Segment bất biến." },
    { q: "Cặp giá trị nào dùng cho optimistic concurrency hiện nay?", options: [
        "_id và _index", "_seq_no và _primary_term", "_score và _version", "_routing và _id"
      ], correct: 1, explanation: "if_seq_no + if_primary_term." },
    { q: "Ghi với if_seq_no cũ thì nhận gì?", options: [
        "200 ghi đè", "409 version_conflict_engine_exception", "404", "500"
      ], correct: 1, explanation: "Có người ghi chen giữa." },
    { q: "version_type=external chấp nhận ghi khi nào?", options: [
        "Luôn luôn",
        "Khi version gửi lên lớn hơn version hiện tại",
        "Khi nhỏ hơn",
        "Khi bằng 0"
      ], correct: 1, explanation: "external_gte thì chấp nhận cả bằng." },
    { q: "Vì sao external version hợp để đồng bộ từ PostgreSQL qua Kafka?", options: [
        "Nhanh hơn bulk",
        "Sự kiện trùng hoặc tới trễ mang version cũ sẽ bị ES từ chối — idempotent, không cần lock",
        "Bỏ được refresh",
        "Không cần _id"
      ], correct: 1, explanation: "Thứ tự do nguồn quyết định." },
    { q: "retry_on_conflict phù hợp nhất với thao tác nào?", options: [
        "Đổi trạng thái đơn dựa trên trạng thái cũ phức tạp",
        "Tăng bộ đếm view_count bằng script (giao hoán)",
        "Xoá index",
        "Reindex"
      ], correct: 1, explanation: "ES tự đọc lại và chạy lại script." },
    { q: "Update nhưng giá trị không đổi thì sao?", options: [
        "Tạo version mới", "result: noop, không ghi", "Lỗi 409", "Xoá doc"
      ], correct: 1, explanation: "detect_noop mặc định bật." },
    { q: "update_by_query dừng giữa chừng thì?", options: [
        "Rollback tự động",
        "Một phần document đã được cập nhật — không có transaction",
        "Không document nào đổi",
        "Index bị khoá"
      ], correct: 1, explanation: "Thiết kế để chạy lại được (idempotent)." },
    { q: "index.gc_deletes (mặc định 60s) để làm gì?", options: [
        "Xoá index cũ",
        "Giữ thông tin version của document đã xoá để chặn ghi với version cũ làm nó 'sống lại'",
        "Dọn translog",
        "Merge"
      ], correct: 1, explanation: "Quan trọng với external versioning khi có delete." }
  ]
});
