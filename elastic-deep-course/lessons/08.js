window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Tìm kiếm & xếp hạng",
  title: "Query DSL: bool, match vs term, query context vs filter context",
  subtitle: "must/should/filter/must_not · có chấm điểm hay không · filter cache · minimum_should_match",

  theory: `
    <p>Mỗi mệnh đề query chạy trong một trong hai <strong>ngữ cảnh</strong>:</p>
    <table>
      <tr><th></th><th>Query context</th><th>Filter context</th></tr>
      <tr><td>Câu hỏi</td><td>"Khớp <em>tốt đến mức nào</em>?"</td><td>"Khớp <em>hay không</em>?" (yes/no)</td></tr>
      <tr><td>Tính <code>_score</code></td><td>Có (BM25, bài 10)</td><td>Không</td></tr>
      <tr><td>Cache</td><td>Không</td><td>Có thể cache dạng bitset theo segment (node query cache)</td></tr>
      <tr><td>Vị trí</td><td><code>must</code>, <code>should</code>, query gốc</td><td><code>filter</code>, <code>must_not</code>, <code>constant_score</code></td></tr>
    </table>

    <p><strong>bool query</strong> — xương sống của mọi query thực tế:</p>
    <ul>
      <li><code>must</code>: phải khớp, <em>cộng điểm</em>.</li>
      <li><code>filter</code>: phải khớp, <em>không</em> tính điểm → nhanh, cache được. Dùng cho status, brand, khoảng giá, tenant_id…</li>
      <li><code>should</code>: nên khớp, khớp thì cộng điểm. Nếu bool <em>không có</em> must/filter thì phải khớp ít nhất 1 should; nếu có must/filter thì should chỉ để cộng điểm (trừ khi đặt <code>minimum_should_match</code>).</li>
      <li><code>must_not</code>: không được khớp, filter context.</li>
    </ul>

    <p><strong>match vs term</strong> (hệ quả trực tiếp của bài 04/06):</p>
    <ul>
      <li><code>match</code>: <strong>phân tích</strong> chuỗi query bằng analyzer của field rồi tìm các token. Dùng cho <code>text</code>. <code>"operator": "and"</code> hoặc <code>minimum_should_match</code> để đòi khớp nhiều token.</li>
      <li><code>term</code>/<code>terms</code>: <strong>không phân tích</strong>, so nguyên văn với term trong index. Dùng cho <code>keyword</code>, số, ngày, bool.</li>
      <li>Chạy <code>match</code> trên keyword vẫn ổn (keyword analyzer giữ nguyên chuỗi). Chạy <code>term</code> trên text là bẫy kinh điển.</li>
    </ul>

    <p><strong>Cache</strong>: node query cache chỉ giữ filter được dùng lặp lại và trên segment đủ lớn; khi segment mới sinh ra (refresh) thì cache của segment cũ vẫn dùng được — lợi ích của segment bất biến. Shard request cache (khác) cache kết quả cả request có <code>size: 0</code> (thường là aggregation), bị huỷ khi shard refresh có thay đổi.</p>

    <div class="callout"><p>💡 Quy tắc ngón tay cái: điều kiện nào người dùng <em>không</em> mong ảnh hưởng thứ tự (đang bán, thuộc shop, giá 1–5 triệu) → cho vào <code>filter</code>. Chỉ từ khoá tìm kiếm mới vào <code>must</code>/<code>should</code>. Tương đương SQL: filter là <code>WHERE</code>, must/should là phần <code>ORDER BY relevance</code>.</p></div>
  `,

  codeTabs: [
    { id: "bool", label: "① bool đầy đủ", lines: [
      "POST /products/_search",
      "{ \"query\": { \"bool\": {",
      "    \"must\":     [ { \"match\": { \"name\": { \"query\": \"điện thoại samsung\", \"operator\": \"and\" } } } ],",
      "    \"should\":   [ { \"term\": { \"is_official\": true } } ],",
      "    \"filter\":   [",
      "      { \"term\":  { \"status\": \"ACTIVE\" } },",
      "      { \"terms\": { \"brand\": [\"samsung\", \"oppo\"] } },",
      "      { \"range\": { \"price\": { \"gte\": 3000000, \"lte\": 10000000 } } }",
      "    ],",
      "    \"must_not\": [ { \"term\": { \"stock\": 0 } } ]",
      "} } }"
    ]},
    { id: "sql", label: "② Tương đương SQL", lines: [
      "SELECT *, relevance(name, 'điện thoại samsung') + (is_official ? bonus : 0) AS score",
      "FROM products",
      "WHERE status = 'ACTIVE'",
      "  AND brand IN ('samsung', 'oppo')",
      "  AND price BETWEEN 3000000 AND 10000000",
      "  AND NOT stock = 0",
      "  AND name CONTAINS_ALL_TOKENS('điện thoại samsung')",
      "ORDER BY score DESC",
      "LIMIT 10"
    ]},
    { id: "mt", label: "③ match vs term", lines: [
      "# name (text): 'Điện thoại Samsung A55'   status (keyword): 'ACTIVE'",
      "",
      "{ \"match\": { \"name\": \"SAMSUNG\" } }        // ✔ phân tích → 'samsung'",
      "{ \"term\":  { \"name\": \"SAMSUNG\" } }        // ✘ index chứa 'samsung', không phải 'SAMSUNG'",
      "{ \"term\":  { \"status\": \"ACTIVE\" } }       // ✔",
      "{ \"term\":  { \"status\": \"active\" } }       // ✘ keyword phân biệt hoa thường",
      "",
      "{ \"match\": { \"name\": { \"query\": \"samsung a55 xanh\",",
      "                       \"minimum_should_match\": \"2<75%\" } } }",
      "# ≤2 token: phải khớp hết; >2 token: khớp ≥75%"
    ]},
    { id: "score", label: "④ Điểm trong kết quả", lines: [
      "\"hits\": [",
      "  { \"_id\": \"42\", \"_score\": 7.31, \"_source\": { \"name\": \"Điện thoại Samsung A55\" } },",
      "  { \"_id\": \"77\", \"_score\": 5.02, ... }",
      "]",
      "",
      "# chỉ có filter → mọi hit _score = 0.0 (hoặc 1.0 với constant_score)",
      "{ \"query\": { \"bool\": { \"filter\": [ { \"term\": { \"brand\": \"samsung\" } } ] } },",
      "  \"sort\": [ { \"price\": \"asc\" } ] }   // sort theo field → không cần score"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">🔍 bool query</div><div class="ns">từ khoá + điều kiện lọc</div></div>
    <div class="row">
      <div class="node" id="flt"><div class="nl">🧱 filter / must_not</div><div class="ns">yes/no · bitset · cache</div></div>
      <div class="node" id="mst"><div class="nl">🎯 must / should</div><div class="ns">BM25 · cộng điểm</div></div>
    </div>
    <div class="arrow" id="a1">↓ giao tập doc, chỉ chấm điểm trên tập còn lại</div>
    <div class="node" id="res"><div class="nl">📋 Top 10 theo _score</div><div class="ns">sort mặc định: _score giảm dần</div></div>
  `,
  steps: [
    { title: "1 · Từ khoá vào must", tab: "bool", highlight: [3], on: ["req", "mst"],
      desc: "match phân tích chuỗi; operator and đòi đủ cả 3 token." },
    { title: "2 · Điều kiện nghiệp vụ vào filter", tab: "bool", highlight: [5, 6, 7, 8, 10], on: ["flt"],
      desc: "Không ảnh hưởng điểm, được cache, và loại bớt document trước khi chấm điểm." },
    { title: "3 · should chỉ cộng điểm", tab: "bool", highlight: [4], on: ["mst", "a1"],
      desc: "Có must/filter rồi nên should không bắt buộc — hàng chính hãng chỉ được đẩy lên." },
    { title: "4 · Đọc bằng SQL", tab: "sql", highlight: [1, 3, 4, 5, 6, 8], on: ["res"],
      desc: "filter ≈ WHERE; must/should ≈ biểu thức score dùng trong ORDER BY." },
    { title: "5 · match vs term", tab: "mt", highlight: [3, 4, 5, 6], on: ["mst", "flt"],
      desc: "term không phân tích input, nên chỉ dùng cho keyword/số/ngày." },
    { title: "6 · Không cần điểm thì đừng tính", tab: "score", highlight: [6, 7, 8], on: ["flt", "res"],
      desc: "Listing theo giá chỉ cần filter + sort." }
  ],

  quiz: [
    { q: "Điều kiện status = ACTIVE nên đặt ở đâu trong bool?", options: [
        "must", "filter", "should", "Trong match"
      ], correct: 1, explanation: "Yes/no, không ảnh hưởng thứ tự, cache được." },
    { q: "Mệnh đề nào chạy trong filter context?", options: [
        "must và should", "filter và must_not", "Chỉ should", "Tất cả"
      ], correct: 1, explanation: "must_not cũng không tính điểm." },
    { q: "bool chỉ có should (không must/filter). Document không khớp should nào thì sao?", options: [
        "Vẫn trả về với score 0",
        "Không được trả về — phải khớp ít nhất 1 should",
        "Lỗi",
        "Trả về cuối danh sách"
      ], correct: 1, explanation: "minimum_should_match mặc định là 1 khi không có must/filter." },
    { q: "bool có filter và should. Document khớp filter nhưng không khớp should?", options: [
        "Bị loại", "Vẫn được trả về, chỉ không được cộng điểm từ should", "Lỗi", "Bị cache"
      ], correct: 1, explanation: "Khi có must/filter, should trở thành tuỳ chọn (mặc định 0)." },
    { q: "match khác term ở điểm cốt lõi nào?", options: [
        "match nhanh hơn",
        "match phân tích chuỗi query bằng analyzer của field; term so nguyên văn",
        "term chấm điểm, match không",
        "Không khác"
      ], correct: 1, explanation: "Đó là lý do term trên text hay trượt." },
    { q: "Vì sao filter nhanh hơn must với cùng điều kiện?", options: [
        "Dùng index khác",
        "Không phải tính điểm và kết quả có thể được cache dạng bitset",
        "Chạy trên master",
        "Bỏ qua replica"
      ], correct: 1, explanation: "Đồng thời không cần duyệt thông tin tần suất để chấm điểm." },
    { q: "minimum_should_match '2<75%' nghĩa là gì?", options: [
        "Luôn khớp 2 token",
        "Từ 2 token trở xuống phải khớp hết; nhiều hơn 2 thì khớp ≥75%",
        "Khớp 75% shard",
        "Tối đa 2 kết quả"
      ], correct: 1, explanation: "Cú pháp điều kiện của minimum_should_match." },
    { q: "Listing 'sắp xếp theo giá tăng dần' có cần query context không?", options: [
        "Có, luôn cần",
        "Không — filter + sort theo field là đủ, không tốn công chấm điểm",
        "Cần should",
        "Cần function_score"
      ], correct: 1, explanation: "Khi sort theo field, score không quyết định thứ tự." },
    { q: "Shard request cache mặc định cache loại request nào?", options: [
        "Mọi request",
        "Request có size: 0 (thường là aggregation/count)",
        "Chỉ GET theo _id",
        "Request có highlight"
      ], correct: 1, explanation: "Bị invalidated khi shard refresh có dữ liệu mới." }
  ]
});
