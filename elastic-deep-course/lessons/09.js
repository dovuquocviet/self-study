window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Tìm kiếm & xếp hạng",
  title: "Phrase, multi_match, fuzzy, prefix/wildcard, range",
  subtitle: "vị trí token & slop · best_fields vs most_fields vs cross_fields · fuzziness AUTO · query đắt tiền",

  theory: `
    <p><strong>match_phrase</strong>: các token phải xuất hiện <em>liền nhau, đúng thứ tự</em> — dùng thông tin vị trí lưu trong postings (bài 03). <code>slop</code> cho phép lệch vài vị trí: <code>slop: 1</code> để "samsung galaxy" vẫn khớp "samsung <em>new</em> galaxy". Phrase đắt hơn match vì phải đọc vị trí.</p>

    <p><strong>multi_match</strong> — một chuỗi, nhiều field:</p>
    <table>
      <tr><th>type</th><th>Cách tính</th><th>Khi nào</th></tr>
      <tr><td><code>best_fields</code> (mặc định)</td><td>Lấy điểm của field khớp tốt nhất (+ <code>tie_breaker</code> × phần còn lại)</td><td>Các field cạnh tranh: title vs description</td></tr>
      <tr><td><code>most_fields</code></td><td>Cộng điểm các field</td><td>Cùng nội dung index nhiều cách (bài 07: có dấu + bỏ dấu)</td></tr>
      <tr><td><code>cross_fields</code></td><td>Coi nhiều field như một field lớn, mỗi token chỉ cần có ở một field nào đó</td><td>Tên người: first_name + last_name; địa chỉ</td></tr>
      <tr><td><code>phrase</code>, <code>bool_prefix</code></td><td>Chạy match_phrase / tiền tố trên từng field</td><td>Ưu tiên cụm từ, gõ-đến-đâu-gợi-ý-đến-đó</td></tr>
    </table>
    <p><code>"fields": ["name^3", "description"]</code> — <code>^3</code> là boost trọng số field.</p>

    <p><strong>fuzzy / fuzziness</strong>: cho phép sai theo khoảng cách Levenshtein (thêm, bớt, đổi, đảo 2 ký tự). Tối đa 2. <code>"fuzziness": "AUTO"</code> = term 0–2 ký tự phải đúng, 3–5 ký tự được sai 1, &gt;5 ký tự được sai 2. <code>prefix_length</code> giữ nguyên vài ký tự đầu để giảm số term phải xét. Dùng trong <code>match</code> tốt hơn query <code>fuzzy</code> riêng vì vẫn qua analyzer.</p>

    <p><strong>Query đắt tiền</strong>: <code>wildcard</code> bắt đầu bằng <code>*</code> ("*sung"), <code>regexp</code>, <code>prefix</code> trên text, <code>script</code> — phải duyệt rất nhiều term trong dictionary. <code>search.allow_expensive_queries: false</code> chặn chúng ở mức cụm — lưu ý danh sách "đắt" này gồm cả <code>fuzzy</code>, <code>prefix</code>, <code>regexp</code>, <code>wildcard</code>, <code>range</code> trên text/keyword, script, join; bật cờ này thì <code>fuzziness</code> cũng bị từ chối. Cần tìm "chứa chuỗi con" thật sự → kiểu <code>wildcard</code> field (ngram nội bộ) hoặc ngram analyzer; cần autocomplete → edge_ngram / <code>search_as_you_type</code>.</p>

    <p><strong>range &amp; date math</strong>: <code>gte</code>/<code>gt</code>/<code>lte</code>/<code>lt</code>; ngày hỗ trợ <code>"now-7d/d"</code> (7 ngày trước, làm tròn về đầu ngày), <code>time_zone: "+07:00"</code>. Làm tròn (<code>/d</code>, <code>/h</code>) giúp các request trong cùng khoảng giống hệt nhau → cache trúng. <code>now</code> không làm tròn thì mỗi ms một query khác nhau, không cache được.</p>

    <div class="callout"><p>💡 Tương đương PostgreSQL: match_phrase ≈ <code>phraseto_tsquery</code>, fuzzy ≈ <code>pg_trgm</code>/<code>levenshtein()</code>, wildcard đầu chuỗi ≈ <code>LIKE '%sung'</code> — cũng quét toàn bộ, cũng chậm, cùng một lý do.</p></div>
  `,

  codeTabs: [
    { id: "phrase", label: "① match_phrase", lines: [
      "{ \"match_phrase\": { \"name\": { \"query\": \"samsung galaxy\", \"slop\": 1 } } }",
      "",
      "# vị trí token của 'Samsung New Galaxy A55': samsung@0 new@1 galaxy@2 a55@3",
      "# query: samsung@0 galaxy@1 → cần dịch galaxy 1 vị trí → slop 1 đủ ✔",
      "",
      "# kết hợp: match để lấy rộng, phrase để thưởng đúng cụm",
      "{ \"bool\": {",
      "    \"must\":   [ { \"match\":        { \"name\": \"sách sinh học\" } } ],",
      "    \"should\": [ { \"match_phrase\": { \"name\": { \"query\": \"sách sinh học\", \"boost\": 2 } } } ]",
      "} }"
    ]},
    { id: "multi", label: "② multi_match", lines: [
      "{ \"multi_match\": {",
      "    \"query\": \"nguyễn văn an\",",
      "    \"type\": \"cross_fields\",",
      "    \"fields\": [ \"first_name\", \"middle_name\", \"last_name\" ],",
      "    \"operator\": \"and\"",
      "} }",
      "# mỗi token chỉ cần xuất hiện ở MỘT trong các field",
      "",
      "{ \"multi_match\": { \"query\": \"tai nghe bluetooth\", \"type\": \"best_fields\",",
      "    \"fields\": [ \"name^3\", \"description\" ], \"tie_breaker\": 0.3 } }"
    ]},
    { id: "fuzzy", label: "③ fuzziness", lines: [
      "{ \"match\": { \"name\": {",
      "    \"query\": \"samsnug\",           // gõ sai: đảo 2 ký tự",
      "    \"fuzziness\": \"AUTO\",          // 7 ký tự → cho sai 2",
      "    \"prefix_length\": 2,           // 'sa' phải đúng",
      "    \"max_expansions\": 50",
      "} } }",
      "",
      "# AUTO: 0–2 ký tự: sai 0 | 3–5: sai 1 | >5: sai 2",
      "# 'ip' không fuzzy; 'iphon' khớp 'iphone' (sai 1)"
    ]},
    { id: "range", label: "④ range & đắt tiền", lines: [
      "{ \"range\": { \"created_at\": {",
      "    \"gte\": \"now-7d/d\", \"lt\": \"now/d\", \"time_zone\": \"+07:00\" } } }",
      "",
      "{ \"wildcard\": { \"sku.raw\": \"*A55*\" } }   // ✘ phải duyệt mọi term",
      "",
      "PUT /_cluster/settings",
      "{ \"persistent\": { \"search.allow_expensive_queries\": false } }",
      "# → wildcard/regexp/prefix/fuzzy/script query... bị từ chối"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">⌨️ "samsnug galaxy"</div><div class="ns">người dùng gõ</div></div>
    <div class="arrow" id="a1">↓ analyzer → samsnug · galaxy</div>
    <div class="row">
      <div class="node" id="fz"><div class="nl">〰️ fuzzy</div><div class="ns">samsnug ≈ samsung (đảo 2 ký tự)</div></div>
      <div class="node" id="ph"><div class="nl">📏 phrase + slop</div><div class="ns">đúng thứ tự, lệch ≤ 1</div></div>
    </div>
    <div class="arrow" id="a2">↓ cộng điểm nhiều field</div>
    <div class="node" id="mm"><div class="nl">🧮 multi_match</div><div class="ns">best / most / cross_fields</div></div>
  `,
  steps: [
    { title: "1 · Phrase dùng vị trí token", tab: "phrase", highlight: [1, 3, 4], on: ["ph"],
      desc: "Mỗi token có vị trí; slop là số bước dịch cho phép." },
    { title: "2 · Rộng bằng match, thưởng bằng phrase", tab: "phrase", highlight: [8, 9], on: ["q", "ph"],
      desc: "Không bỏ sót kết quả, nhưng đúng cụm từ lên đầu." },
    { title: "3 · Tên người: cross_fields", tab: "multi", highlight: [3, 4, 5, 7], on: ["mm"],
      desc: "'nguyễn văn an' trải qua ba field; best_fields sẽ không đòi and đúng nghĩa." },
    { title: "4 · Gõ sai vẫn ra", tab: "fuzzy", highlight: [2, 3, 4, 8], on: ["a1", "fz"],
      desc: "AUTO theo độ dài term; prefix_length giảm số term phải thử." },
    { title: "5 · Range làm tròn để cache", tab: "range", highlight: [2], on: ["mm"],
      desc: "now/d giống nhau suốt cả ngày → filter cache trúng." },
    { title: "6 · Chặn query đắt", tab: "range", highlight: [4, 7, 8], on: ["q"],
      desc: "Wildcard đầu chuỗi quét cả term dictionary; chặn ở cụm để một request không kéo sập node." }
  ],

  quiz: [
    { q: "match_phrase dựa vào thông tin nào trong index?", options: [
        "Doc values", "Vị trí (position) của token trong postings", "_source", "BKD tree"
      ], correct: 1, explanation: "Cần vị trí để kiểm tra liền kề và đúng thứ tự." },
    { q: "slop: 1 cho 'samsung galaxy' khớp văn bản nào?", options: [
        "'galaxy by samsung'", "'samsung new galaxy'", "'samsung' một mình", "'sam sung galaxy'"
      ], correct: 1, explanation: "Chỉ cần dịch galaxy một vị trí." },
    { q: "Tìm tên người 'nguyễn văn an' trên first/middle/last_name, type nào hợp nhất?", options: [
        "best_fields", "cross_fields", "phrase_prefix", "most_fields"
      ], correct: 1, explanation: "cross_fields coi các field như một field lớn." },
    { q: "fuzziness AUTO với term dài 4 ký tự cho phép sai bao nhiêu?", options: [
        "0", "1", "2", "3"
      ], correct: 1, explanation: "3–5 ký tự: 1 edit." },
    { q: "Khoảng cách fuzzy tối đa ES hỗ trợ?", options: [
        "1", "2", "5", "Không giới hạn"
      ], correct: 1, explanation: "Levenshtein tối đa 2." },
    { q: "Vì sao wildcard '*A55*' chậm?", options: [
        "Vì dùng regex Java",
        "Không dùng được term dictionary theo tiền tố, phải duyệt rất nhiều term",
        "Vì phải đọc _source",
        "Vì chạy trên master"
      ], correct: 1, explanation: "Giống LIKE '%...' trong SQL." },
    { q: "Vì sao dùng 'now-7d/d' thay vì 'now-7d' trong filter?", options: [
        "Cú pháp bắt buộc",
        "Làm tròn về đầu ngày → các request giống nhau → cache được",
        "Để đổi múi giờ",
        "Để tính điểm"
      ], correct: 1, explanation: "now không làm tròn thay đổi mỗi ms." },
    { q: "multi_match most_fields khác best_fields thế nào?", options: [
        "Giống nhau",
        "most_fields cộng điểm các field; best_fields lấy field tốt nhất",
        "most_fields chỉ dùng cho keyword",
        "best_fields cộng điểm"
      ], correct: 1, explanation: "tie_breaker cho best_fields cộng thêm một phần các field còn lại." },
    { q: "search.allow_expensive_queries: false có tác dụng gì?", options: [
        "Tắt aggregation",
        "Từ chối các query tốn kém như wildcard, regexp, script query…",
        "Giảm replica",
        "Tắt refresh"
      ], correct: 1, explanation: "Bảo vệ cụm khỏi query đắt vô tình; danh sách gồm cả fuzzy và prefix nên cần kiểm tra trước khi bật." }
  ]
});
