window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "Các mô hình dữ liệu",
  title: "Inverted index & search — Elasticsearch/Lucene bên dưới",
  subtitle: "Analyzer · term → postings · BM25 · segment bất biến · refresh 1s (near-real-time) · translog",

  theory: `
    <p>B-tree trả lời "dòng có khoá X ở đâu". Search cần câu hỏi ngược: <strong>"những tài liệu nào chứa từ X"</strong>, rồi xếp hạng theo độ liên quan.
    Đó là <strong>inverted index</strong> — giống mục lục cuối sách: từ → danh sách trang.</p>

    <p><strong>1. Analyzer: văn bản → term</strong> (chạy cả lúc index lẫn lúc search)</p>
    <ul>
      <li><em>Character filter</em>: tiền xử lý chuỗi (bỏ HTML...).</li>
      <li><em>Tokenizer</em>: tách thành token (standard tokenizer tách theo ranh giới từ Unicode).</li>
      <li><em>Token filter</em>: lowercase, bỏ dấu (<code>asciifolding</code>: "Áo" → "ao"), stopword, stemming, synonym...</li>
    </ul>
    <p>Field <code>text</code> đi qua analyzer (để tìm full-text). Field <code>keyword</code> giữ nguyên chuỗi (để lọc chính xác, sort, aggregation).
    Analyzer lúc search phải "khớp" analyzer lúc index, nếu không term sẽ không bao giờ gặp nhau.</p>

    <p><strong>2. Cấu trúc index</strong>: <em>term dictionary</em> (sắp xếp, nén bằng FST, phần lớn nằm trong RAM) → <em>postings list</em> cho mỗi term: danh sách doc ID
    (tăng dần, nén delta), tần suất, vị trí (để tìm cụm từ). Truy vấn "áo thun" = lấy 2 postings list rồi giao/hợp — thao tác trên danh sách đã sắp xếp rất nhanh.</p>

    <p><strong>3. Xếp hạng BM25</strong> (mặc định từ ES 5): điểm cao khi term xuất hiện nhiều trong tài liệu (<em>tf</em>, nhưng bão hoà dần, tham số k1 = 1.2),
    term hiếm trong cả tập (<em>idf</em>), và tài liệu ngắn (chuẩn hoá độ dài, b = 0.75). "cotton" hiếm → quan trọng hơn "áo" phổ biến.</p>

    <p><strong>4. Segment bất biến — LSM trong thế giới search</strong></p>
    <ul>
      <li>Document mới vào <em>buffer trong RAM</em> + ghi <strong>translog</strong> (để bền).</li>
      <li><strong>Refresh</strong> (mặc định mỗi 1 giây, với index có truy vấn search gần đây) biến buffer thành một <strong>segment</strong> mới mở được để tìm → <strong>near-real-time</strong>:
      vừa index xong, search có thể chưa thấy trong ~1 giây. GET theo <code>_id</code> thì realtime.</li>
      <li><strong>Flush</strong>: Lucene commit (fsync segment) rồi cắt translog.</li>
      <li><strong>Merge</strong> nền gộp segment nhỏ. Delete chỉ đánh dấu trong bitmap "đã xoá"; update = đánh dấu xoá bản cũ + index bản mới. Chỗ thật được thu hồi khi merge.</li>
    </ul>

    <p><strong>5. Shard</strong>: một index ES = nhiều <em>primary shard</em>, mỗi shard là một index Lucene độc lập. Số primary shard chốt lúc tạo (đổi phải split/shrink/reindex).
    Search gửi tới mọi shard rồi gộp top-k.</p>

    <div class="callout"><p>💡 ES không phải nguồn sự thật: không có transaction, dữ liệu thấy sau refresh, đổi mapping thường phải reindex.
    Hãy coi nó như bản chiếu (projection) dựng từ PostgreSQL/Kafka — hỏng thì dựng lại. Test tích hợp gọi <code>refresh</code> trước khi search, nếu không sẽ "flaky".</p></div>
  `,

  codeTabs: [
    { id: "analyze", label: "Analyzer", lines: [
      "PUT /products",
      "{ \"settings\": { \"analysis\": { \"analyzer\": {",
      "    \"vi_fold\": { \"tokenizer\": \"standard\", \"filter\": [\"lowercase\", \"asciifolding\"] } } } },",
      "  \"mappings\": { \"properties\": {",
      "    \"name\":  { \"type\": \"text\", \"analyzer\": \"vi_fold\" },",
      "    \"brand\": { \"type\": \"keyword\" } } } }",
      "",
      "POST /products/_analyze",
      "{ \"analyzer\": \"vi_fold\", \"text\": \"Áo Thun Cotton\" }",
      "# → tokens: [\"ao\", \"thun\", \"cotton\"]"
    ]},
    { id: "inverted", label: "Inverted index", lines: [
      "doc 1: 'Áo thun cotton'      doc 2: 'Áo sơ mi'      doc 3: 'Quần cotton'",
      "",
      "term      postings (docID: tf)",
      "ao     →  1:1, 2:1",
      "cotton →  1:1, 3:1",
      "mi     →  2:1",
      "quan   →  3:1",
      "so     →  2:1",
      "thun   →  1:1",
      "",
      "# 'ao cotton' (OR): hợp {1,2} ∪ {1,3} = {1,2,3}; doc 1 khớp cả hai → điểm cao nhất"
    ]},
    { id: "search", label: "Truy vấn & BM25", lines: [
      "GET /products/_search",
      "{ \"query\": { \"bool\": {",
      "    \"must\":   [ { \"match\": { \"name\": \"áo cotton\" } } ],      // có tính điểm BM25",
      "    \"filter\": [ { \"term\":  { \"brand\": \"Coolmate\" } } ] } } } // lọc, không tính điểm, cache được",
      "",
      "# BM25 cho mỗi term:",
      "#   idf(t) · tf·(k1+1) / (tf + k1·(1 - b + b·len/avgLen))     k1=1.2, b=0.75",
      "# 'cotton' hiếm hơn 'ao' → idf lớn hơn → đóng góp nhiều điểm hơn"
    ]},
    { id: "nrt", label: "Refresh & near-real-time", lines: [
      "PUT /products/_doc/42 { \"name\": \"Áo polo\" }     # vào buffer RAM + translog",
      "GET /products/_search?q=name:polo                  # có thể CHƯA thấy",
      "GET /products/_doc/42                              # thấy ngay (realtime get)",
      "",
      "# ~1s sau refresh → segment mới mở cho search → thấy",
      "",
      "# nạp hàng loạt: tắt refresh cho nhanh, bật lại sau",
      "PUT /products/_settings { \"index\": { \"refresh_interval\": \"-1\" } }",
      "",
      "# test: ép refresh trước khi assert",
      "PUT /products/_doc/43?refresh=wait_for { \"name\": \"Áo khoác\" }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="doc"><div class="nl">📄 'Áo Thun Cotton'</div><div class="ns">document mới</div></div>
    <div class="arrow" id="a1">↓ analyzer: tokenize + lowercase + asciifolding</div>
    <div class="node" id="terms"><div class="nl">🔤 ao · thun · cotton</div><div class="ns">term</div></div>
    <div class="arrow" id="a2">↓ buffer RAM + translog</div>
    <div class="node" id="buf"><div class="nl">🧠 In-memory buffer</div><div class="ns">chưa tìm được</div></div>
    <div class="arrow" id="a3">↓ refresh (~1s)</div>
    <div class="row">
      <div class="node" id="seg"><div class="nl">📦 Segment mới</div><div class="ns">term → postings, bất biến</div></div>
      <div class="node" id="merge"><div class="nl">🗜️ Merge nền</div><div class="ns">gộp, dọn doc đã xoá</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Analyzer biến văn bản thành term", tab: "analyze", highlight: [3, 5, 9, 10], on: ["doc", "a1", "terms"],
      desc: "text đi qua analyzer; keyword giữ nguyên. asciifolding giúp tìm 'ao' ra 'Áo'." },
    { title: "2 · Term → postings list", tab: "inverted", highlight: [3, 4, 5, 11], on: ["terms"],
      desc: "Mỗi term trỏ tới danh sách doc đã sắp xếp. Truy vấn = giao/hợp các danh sách." },
    { title: "3 · Xếp hạng bằng BM25", tab: "search", highlight: [3, 4, 7, 8], on: ["seg"],
      desc: "must tính điểm; filter chỉ lọc, cache được. Term hiếm đóng góp nhiều điểm hơn." },
    { title: "4 · Ghi vào buffer + translog", tab: "nrt", highlight: [1, 2, 3], on: ["a2", "buf"],
      desc: "Chưa refresh thì search chưa thấy, nhưng GET theo id thì thấy." },
    { title: "5 · Refresh → segment → tìm được", tab: "nrt", highlight: [5, 8, 11], on: ["a3", "seg"],
      desc: "Near-real-time. Nạp hàng loạt thì tắt refresh; test dùng refresh=wait_for." },
    { title: "6 · Merge dọn dẹp", tab: "inverted", highlight: [1], on: ["merge"],
      desc: "Segment bất biến: xoá/sửa chỉ đánh dấu; merge mới thu hồi chỗ — cùng tư tưởng LSM (bài 05)." }
  ],

  quiz: [
    { q: "Inverted index ánh xạ gì sang gì?", options: [
        "Doc ID → nội dung", "Term → danh sách document chứa term", "Khoá chính → ctid", "Offset → message"
      ], correct: 1, explanation: "Giống mục lục cuối sách." },
    { q: "Khác nhau giữa field text và keyword?", options: [
        "Không khác",
        "text đi qua analyzer để tìm full-text; keyword giữ nguyên để lọc chính xác, sort, aggregation",
        "keyword nhanh hơn nên luôn dùng",
        "text không tìm được"
      ], correct: 1, explanation: "Thường map cả hai (multi-field) cho cùng một chuỗi." },
    { q: "Token filter asciifolding làm gì với 'Áo'?", options: [
        "Xoá", "Chuyển thành 'ao' (bỏ dấu)", "Dịch sang tiếng Anh", "Giữ nguyên"
      ], correct: 1, explanation: "Giúp người gõ không dấu vẫn tìm được." },
    { q: "Thuật toán xếp hạng mặc định của Elasticsearch hiện nay?", options: [
        "TF-IDF cổ điển", "BM25", "PageRank", "Cosine trên embedding"
      ], correct: 1, explanation: "Mặc định từ ES 5.0." },
    { q: "Trong BM25, vì sao term hiếm đóng góp nhiều điểm hơn?", options: [
        "Vì ngắn hơn",
        "Vì idf (inverse document frequency) cao — term hiếm phân biệt tài liệu tốt hơn",
        "Vì nằm đầu câu",
        "Vì viết hoa"
      ], correct: 1, explanation: "'cotton' nói nhiều hơn 'áo' trong một shop quần áo." },
    { q: "Vì sao vừa index xong, _search có thể chưa thấy document?", options: [
        "Lỗi ES",
        "Document chỉ tìm được sau refresh (mặc định ~1s) tạo segment mới — near-real-time",
        "Cần restart",
        "Do translog hỏng"
      ], correct: 1, explanation: "GET theo _id thì realtime." },
    { q: "Translog trong ES đóng vai trò gì?", options: [
        "Cache truy vấn",
        "Log ghi để bảo đảm độ bền cho thao tác chưa được Lucene commit",
        "Lưu analyzer",
        "Nhật ký truy cập"
      ], correct: 1, explanation: "Giống WAL của DB quan hệ." },
    { q: "Update một document trong ES thực chất là?", options: [
        "Sửa tại chỗ trong segment",
        "Đánh dấu xoá bản cũ và index bản mới; merge sau này thu hồi chỗ",
        "Ghi đè file",
        "Không hỗ trợ update"
      ], correct: 1, explanation: "Segment bất biến." },
    { q: "Số primary shard của một index ES có đổi tuỳ ý sau khi tạo được không?", options: [
        "Được, bất cứ lúc nào",
        "Không trực tiếp; phải dùng split/shrink hoặc reindex",
        "Chỉ tăng được bằng cách thêm node",
        "Không có khái niệm shard"
      ], correct: 1, explanation: "Số replica thì đổi tự do." },
    { q: "Trong bool query, 'filter' khác 'must' ở đâu?", options: [
        "filter không tính điểm và có thể được cache",
        "filter chậm hơn",
        "must không lọc",
        "Giống hệt nhau"
      ], correct: 0, explanation: "Dùng filter cho điều kiện có/không như brand, trạng thái." }
  ]
});
