window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Tìm kiếm & xếp hạng",
  title: "Relevance: BM25, explain, boost, function_score",
  subtitle: "TF · IDF · độ dài field · IDF tính theo shard · trộn điểm văn bản với tín hiệu nghiệp vụ",

  theory: `
    <p>Từ ES 5.0 (Lucene 6), độ tương đồng mặc định là <strong>BM25</strong>. Với mỗi token của query khớp một document, điểm gồm ba yếu tố:</p>
    <ul>
      <li><strong>IDF</strong> (độ hiếm): <code>ln(1 + (N − n + 0.5) / (n + 0.5))</code>, N = số document, n = số document chứa term. "samsung" xuất hiện ở 30% sản phẩm → IDF thấp; "a55" hiếm → IDF cao.</li>
      <li><strong>TF có bão hoà</strong>: xuất hiện nhiều lần thì điểm tăng nhưng tiệm cận trần — khác TF-IDF cổ điển tăng mãi. Tham số <code>k1 = 1.2</code> điều khiển tốc độ bão hoà.</li>
      <li><strong>Chuẩn hoá độ dài</strong>: cùng khớp, field ngắn được điểm cao hơn field dài. <code>b = 0.75</code> quyết định mức phạt độ dài (b = 0 bỏ qua độ dài).</li>
    </ul>
    <p>Dạng rút gọn Lucene dùng: <code>score = IDF × tf / (tf + k1 × (1 − b + b × dl/avgdl))</code> × boost. Điểm của bool = tổng điểm các mệnh đề must/should khớp.</p>

    <p><strong>IDF tính theo shard</strong>: mỗi shard chỉ biết thống kê của chính nó. Dữ liệu ít hoặc phân bố lệch → cùng document có thể điểm khác nhau tuỳ shard. Dùng <code>search_type=dfs_query_then_fetch</code> để gom thống kê toàn cục trước (tốn thêm một vòng) — thường chỉ cần khi test với dữ liệu nhỏ; dữ liệu lớn thì thống kê các shard hội tụ.</p>

    <p><strong><code>explain: true</code></strong> in cây tính điểm cho từng hit. Là cách duy nhất để trả lời "vì sao A đứng trên B" mà không đoán.</p>

    <p><strong>Công cụ điều chỉnh</strong></p>
    <ul>
      <li><code>boost</code> trên mệnh đề hoặc <code>^n</code> trên field: nhân điểm của phần đó.</li>
      <li><code>boosting</code> query: <code>positive</code> + <code>negative</code> + <code>negative_boost</code> (0–1) — hạ hạng thay vì loại bỏ (vd hàng hết hàng xuống cuối).</li>
      <li><code>function_score</code>: trộn điểm văn bản với tín hiệu nghiệp vụ. Hàm: <code>field_value_factor</code> (vd lượt bán, có <code>modifier: log1p</code> để không một sản phẩm bán chạy đè tất cả), <code>gauss</code>/<code>exp</code>/<code>linear</code> decay (gần vị trí / mới đăng), <code>weight</code> theo filter, <code>random_score</code>. <code>score_mode</code> gộp các hàm với nhau, <code>boost_mode</code> gộp kết quả hàm với điểm query (<code>multiply</code> mặc định, <code>sum</code>, <code>replace</code>…).</li>
      <li><code>rank_feature</code> field + query: tín hiệu số (popularity, pagerank) được tối ưu để bỏ qua sớm document điểm thấp — nhanh hơn function_score cho cùng mục đích.</li>
    </ul>

    <div class="callout"><p>💡 Điểm BM25 không có đơn vị và không so được giữa hai query khác nhau. Đừng đặt ngưỡng kiểu "score &gt; 5 mới hiển thị"; hãy dùng <code>minimum_should_match</code> hoặc filter để quy định "đủ liên quan".</p></div>
  `,

  codeTabs: [
    { id: "bm25", label: "① BM25 bằng số", lines: [
      "N = 10000 sản phẩm, avgdl(name) = 6 token, k1 = 1.2, b = 0.75",
      "",
      "term 'samsung': n = 3000 → IDF = ln(1 + 7000.5/3000.5) ≈ 1.20",
      "term 'a55'    : n = 12   → IDF = ln(1 + 9988.5/12.5)   ≈ 6.68",
      "",
      "doc A: name = 'Samsung A55' (dl = 2, tf = 1 mỗi term)",
      "  norm = 1 − 0.75 + 0.75 × 2/6 = 0.5",
      "  tfPart = 1 / (1 + 1.2 × 0.5) = 0.625",
      "  score ≈ (1.20 + 6.68) × 0.625 ≈ 4.93",
      "",
      "doc B: 'Ốp lưng silicon trong suốt cho Samsung Galaxy A55 5G' (dl = 10)",
      "  norm = 0.25 + 0.75 × 10/6 = 1.5  → tfPart = 1/(1 + 1.8) ≈ 0.357  → score ≈ 2.82"
    ]},
    { id: "explain", label: "② explain", lines: [
      "POST /products/_search",
      "{ \"explain\": true, \"query\": { \"match\": { \"name\": \"samsung a55\" } } }",
      "",
      "\"_explanation\": { \"value\": 4.93, \"description\": \"sum of:\", \"details\": [",
      "  { \"value\": 0.75, \"description\": \"weight(name:samsung in 12) [PerFieldSimilarity]\" ... },",
      "  { \"value\": 4.18, \"description\": \"weight(name:a55 in 12) ...\",",
      "    \"details\": [ { \"description\": \"idf, computed as log(1 + (N - n + 0.5) / (n + 0.5))\" },",
      "                 { \"description\": \"tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl))\" } ] }",
      "] }"
    ]},
    { id: "fs", label: "③ function_score", lines: [
      "{ \"query\": { \"function_score\": {",
      "    \"query\": { \"match\": { \"name\": \"tai nghe\" } },",
      "    \"functions\": [",
      "      { \"field_value_factor\": { \"field\": \"sold_count\", \"modifier\": \"log1p\", \"factor\": 0.5, \"missing\": 0 } },",
      "      { \"gauss\": { \"created_at\": { \"origin\": \"now\", \"scale\": \"30d\", \"decay\": 0.5 } } },",
      "      { \"filter\": { \"term\": { \"is_official\": true } }, \"weight\": 1.5 }",
      "    ],",
      "    \"score_mode\": \"sum\",",
      "    \"boost_mode\": \"multiply\"",
      "} } }",
      "# điểm cuối = BM25 × (log1p(0.5 × sold) + decay(tuổi) + 1.5 nếu chính hãng)"
    ]},
    { id: "boosting", label: "④ boosting & rank_feature", lines: [
      "{ \"boosting\": {",
      "    \"positive\": { \"match\": { \"name\": \"iphone 15\" } },",
      "    \"negative\": { \"term\":  { \"stock\": 0 } },",
      "    \"negative_boost\": 0.2        // hết hàng: điểm × 0.2, vẫn hiện nhưng xuống dưới",
      "} }",
      "",
      "\"popularity\": { \"type\": \"rank_feature\" }       // mapping",
      "{ \"bool\": { \"must\":   [ { \"match\": { \"name\": \"iphone\" } } ],",
      "            \"should\": [ { \"rank_feature\": { \"field\": \"popularity\", \"saturation\": {} } } ] } }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="idf"><div class="nl">📉 IDF</div><div class="ns">term hiếm = nặng ký</div></div>
    <div class="arrow" id="a1">↓ ×</div>
    <div class="node" id="tf"><div class="nl">📈 TF bão hoà (k1)</div><div class="ns">+ phạt field dài (b)</div></div>
    <div class="arrow" id="a2">↓ cộng qua các token → BM25</div>
    <div class="node" id="fs"><div class="nl">🧪 function_score</div><div class="ns">× lượt bán, độ mới, chính hãng</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="final"><div class="nl">🏆 _score cuối</div><div class="ns">explain để kiểm chứng</div></div>
  `,
  steps: [
    { title: "1 · Term hiếm quyết định", tab: "bm25", highlight: [3, 4], on: ["idf"],
      desc: "'a55' hiếm hơn 'samsung' 250 lần nên đóng góp điểm gấp ~5 lần." },
    { title: "2 · Field ngắn thắng", tab: "bm25", highlight: [6, 7, 8, 9, 11, 12], on: ["tf", "a2"],
      desc: "Cùng tf = 1 nhưng tên ốp lưng dài hơn nên bị chuẩn hoá xuống. Tên đúng sản phẩm đứng trên phụ kiện." },
    { title: "3 · Đừng đoán, hãy explain", tab: "explain", highlight: [2, 5, 6, 7, 8], on: ["final"],
      desc: "Cây explain cho thấy từng thành phần và công thức Lucene thực sự dùng." },
    { title: "4 · Trộn tín hiệu nghiệp vụ", tab: "fs", highlight: [4, 5, 6, 8, 9, 11], on: ["fs"],
      desc: "log1p chặn sản phẩm cực bán chạy đè hết; gauss giảm dần theo tuổi." },
    { title: "5 · Hạ hạng thay vì loại", tab: "boosting", highlight: [3, 4], on: ["final"],
      desc: "Hàng hết vẫn tìm được nhưng xuống dưới." },
    { title: "6 · rank_feature nhanh hơn", tab: "boosting", highlight: [7, 9], on: ["fs", "final"],
      desc: "Tín hiệu số dạng rank_feature cho phép Lucene bỏ qua sớm các document không thể lọt top." }
  ],

  quiz: [
    { q: "Thuật toán similarity mặc định của ES hiện nay?", options: [
        "TF-IDF cổ điển", "BM25", "Cosine", "PageRank"
      ], correct: 1, explanation: "Mặc định từ ES 5.0." },
    { q: "Trong BM25, term xuất hiện ở rất nhiều document thì sao?", options: [
        "IDF cao, điểm cao", "IDF thấp, đóng góp ít", "Bị loại", "Không ảnh hưởng"
      ], correct: 1, explanation: "Term phổ biến ít giá trị phân biệt." },
    { q: "Tham số k1 trong BM25 điều khiển gì?", options: [
        "Phạt độ dài", "Tốc độ bão hoà của term frequency", "Số shard", "Fuzziness"
      ], correct: 1, explanation: "b điều khiển phạt độ dài." },
    { q: "Hai document cùng chứa 'a55' một lần; một tên 2 từ, một tên 10 từ. Ai điểm cao hơn (mặc định)?", options: [
        "Tên 10 từ", "Tên 2 từ", "Bằng nhau", "Ngẫu nhiên"
      ], correct: 1, explanation: "Chuẩn hoá độ dài với b = 0.75." },
    { q: "Vì sao trên index nhỏ, cùng document có thể có điểm khác nhau giữa các lần?", options: [
        "Lỗi Lucene",
        "IDF tính theo từng shard (primary/replica có thể khác số document đã xoá); dfs_query_then_fetch dùng thống kê toàn cục",
        "Do cache",
        "Do random_score mặc định"
      ], correct: 1, explanation: "Thống kê cục bộ mỗi shard, kể cả document đã xoá chưa merge." },
    { q: "modifier log1p trong field_value_factor dùng để làm gì?", options: [
        "Tăng mạnh ảnh hưởng của lượt bán",
        "Nén ảnh hưởng để sản phẩm bán cực chạy không đè hết độ liên quan",
        "Đổi sang số âm",
        "Bỏ qua missing"
      ], correct: 1, explanation: "log(1 + x) tăng chậm dần." },
    { q: "boosting query với negative_boost 0.2 làm gì?", options: [
        "Loại document khớp negative",
        "Nhân điểm của document khớp negative với 0.2",
        "Cộng 0.2",
        "Đảo thứ tự"
      ], correct: 1, explanation: "Hạ hạng chứ không loại." },
    { q: "Nên đặt ngưỡng 'score > 5 mới hiển thị' không?", options: [
        "Có, chuẩn",
        "Không — score BM25 không có đơn vị, thay đổi theo query và dữ liệu",
        "Chỉ với multi_match",
        "Chỉ trên 1 shard"
      ], correct: 1, explanation: "Dùng minimum_should_match / filter." },
    { q: "boost_mode multiply trong function_score nghĩa là?", options: [
        "Cộng điểm hàm và điểm query",
        "Điểm cuối = điểm query × kết quả các hàm",
        "Bỏ điểm query",
        "Lấy max"
      ], correct: 1, explanation: "score_mode gộp các hàm; boost_mode gộp với điểm query." },
    { q: "Công cụ nào cho biết chính xác vì sao document A đứng trên B?", options: [
        "_cat/indices", "explain: true", "profile", "_analyze"
      ], correct: 1, explanation: "profile đo thời gian; explain giải thích điểm." }
  ]
});
