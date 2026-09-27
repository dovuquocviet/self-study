window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Mô hình dữ liệu",
  title: "Analyzer: char_filter → tokenizer → token filter",
  subtitle: "_analyze API · index analyzer vs search_analyzer · normalizer cho keyword · autocomplete bằng edge_ngram",

  theory: `
    <p>Analyzer biến một chuỗi thành danh sách <strong>token</strong> (term) để đưa vào inverted index. Chạy ở <strong>hai</strong> thời điểm: khi index document và khi phân tích chuỗi query của <code>match</code>. Tìm được hay không phụ thuộc vào việc token hai bên có <em>giống nhau</em> không.</p>

    <p><strong>Ba tầng, theo thứ tự</strong></p>
    <ol>
      <li><strong>Char filter</strong> (0..n): sửa chuỗi thô. <code>html_strip</code> bỏ thẻ HTML, <code>mapping</code> thay ký tự, <code>pattern_replace</code> theo regex.</li>
      <li><strong>Tokenizer</strong> (đúng 1): cắt thành token và ghi vị trí. <code>standard</code> (theo Unicode word boundary), <code>whitespace</code>, <code>keyword</code> (cả chuỗi 1 token), <code>icu_tokenizer</code> (plugin, bài 07), <code>ngram</code>, <code>edge_ngram</code>.</li>
      <li><strong>Token filter</strong> (0..n): biến đổi từng token. <code>lowercase</code>, <code>asciifolding</code>, <code>stop</code>, <code>synonym_graph</code>, <code>stemmer</code>, <code>edge_ngram</code>, <code>shingle</code>.</li>
    </ol>
    <p>Analyzer <code>standard</code> (mặc định cho text) = tokenizer <code>standard</code> + filter <code>lowercase</code>. Không bỏ dấu, không stop word.</p>

    <p><strong><code>_analyze</code> là công cụ debug số 1</strong>: tìm không ra → chạy _analyze với chuỗi trong document và chuỗi query, so token.</p>

    <p><strong>search_analyzer</strong>: mặc định query dùng cùng analyzer với lúc index. Có thể khác, điển hình là autocomplete: lúc index dùng <code>edge_ngram</code> sinh "đ", "đi", "điệ", "điện"…; lúc search <em>không</em> ngram (nếu không, gõ "điện" sẽ khớp mọi thứ bắt đầu bằng "đ").</p>

    <p><strong>Synonym</strong>: <code>synonym_graph</code> nên đặt ở <em>search analyzer</em> — sửa từ đồng nghĩa không cần reindex (có thể reload với <code>updateable: true</code> + file/synonyms set). Đặt ở index analyzer thì mỗi lần sửa phải reindex.</p>

    <p><strong>Normalizer</strong>: phiên bản "không tách từ" cho <code>keyword</code> — chỉ char filter + token filter theo từng ký tự (lowercase, asciifolding). Dùng khi muốn <code>term</code> không phân biệt hoa thường mà vẫn agg được.</p>

    <div class="callout"><p>💡 Giống <code>LOWER()</code> + <code>unaccent()</code> trong PostgreSQL, nhưng ES làm <em>trước</em> lúc ghi. Đổi analyzer của field đã có = phải reindex, vì token cũ đã nằm trong segment.</p></div>
  `,

  codeTabs: [
    { id: "an", label: "① _analyze", lines: [
      "POST /_analyze",
      "{ \"analyzer\": \"standard\", \"text\": \"<b>Điện Thoại</b> Samsung-A55!\" }",
      "# → [\"b\", \"điện\", \"thoại\", \"b\", \"samsung\", \"a55\"]   (thẻ HTML thành token rác)",
      "",
      "POST /_analyze",
      "{ \"char_filter\": [\"html_strip\"], \"tokenizer\": \"standard\",",
      "  \"filter\": [\"lowercase\", \"asciifolding\"],",
      "  \"text\": \"<b>Điện Thoại</b> Samsung-A55!\" }",
      "# → [\"dien\", \"thoai\", \"samsung\", \"a55\"]"
    ]},
    { id: "custom", label: "② Analyzer tự định nghĩa", lines: [
      "PUT /products_v2",
      "{ \"settings\": { \"analysis\": {",
      "    \"analyzer\": {",
      "      \"vi_folded\": {",
      "        \"type\": \"custom\",",
      "        \"char_filter\": [\"html_strip\"],",
      "        \"tokenizer\": \"standard\",",
      "        \"filter\": [\"lowercase\", \"asciifolding\"]",
      "      } },",
      "    \"normalizer\": {",
      "      \"lower_fold\": { \"type\": \"custom\", \"filter\": [\"lowercase\", \"asciifolding\"] } }",
      "  } },",
      "  \"mappings\": { \"properties\": {",
      "    \"name\":  { \"type\": \"text\", \"analyzer\": \"vi_folded\" },",
      "    \"brand\": { \"type\": \"keyword\", \"normalizer\": \"lower_fold\" }",
      "} } }"
    ]},
    { id: "auto", label: "③ Autocomplete", lines: [
      "\"analysis\": {",
      "  \"filter\": { \"prefix_2_15\": { \"type\": \"edge_ngram\", \"min_gram\": 2, \"max_gram\": 15 } },",
      "  \"analyzer\": {",
      "    \"ac_index\":  { \"tokenizer\": \"standard\", \"filter\": [\"lowercase\", \"asciifolding\", \"prefix_2_15\"] },",
      "    \"ac_search\": { \"tokenizer\": \"standard\", \"filter\": [\"lowercase\", \"asciifolding\"] }",
      "  }",
      "}",
      "\"name\": { \"type\": \"text\", \"fields\": { \"ac\": { \"type\": \"text\",",
      "          \"analyzer\": \"ac_index\", \"search_analyzer\": \"ac_search\" } } }",
      "",
      "# index 'samsung' → sa, sam, sams, samsu, samsun, samsung",
      "# gõ 'sams' → token 'sams' khớp"
    ]},
    { id: "syn", label: "④ Synonym lúc search", lines: [
      "\"filter\": {",
      "  \"vi_syn\": { \"type\": \"synonym_graph\", \"updateable\": true,",
      "              \"synonyms\": [ \"dt, dien thoai, smartphone\", \"tl, tu lanh\" ] }",
      "},",
      "\"analyzer\": {",
      "  \"vi_search\": { \"tokenizer\": \"standard\",",
      "                 \"filter\": [\"lowercase\", \"asciifolding\", \"vi_syn\"] }",
      "}",
      "# field: \"analyzer\": \"vi_folded\", \"search_analyzer\": \"vi_search\"",
      "POST /products_v2/_reload_search_analyzers   // sau khi sửa synonym"
    ]}
  ],

  stageHtml: `
    <div class="node" id="raw"><div class="nl">📝 "&lt;b&gt;Điện Thoại&lt;/b&gt; Samsung-A55!"</div><div class="ns">chuỗi thô</div></div>
    <div class="arrow" id="a1">↓ char_filter: html_strip</div>
    <div class="node" id="tok"><div class="nl">✂️ tokenizer: standard</div><div class="ns">Điện · Thoại · Samsung · A55</div></div>
    <div class="arrow" id="a2">↓ filter: lowercase, asciifolding</div>
    <div class="node" id="out"><div class="nl">🏷️ dien · thoai · samsung · a55</div><div class="ns">token vào inverted index</div></div>
    <div class="arrow" id="a3">↓ query "điện thoại" cũng đi qua cùng đường</div>
    <div class="node" id="match"><div class="nl">✅ token khớp → tìm thấy</div><div class="ns">hai bên phải ra cùng token</div></div>
  `,
  steps: [
    { title: "1 · Analyzer mặc định để lọt rác", tab: "an", highlight: [2, 3], on: ["raw", "tok"],
      desc: "standard không bỏ thẻ HTML, cũng không bỏ dấu." },
    { title: "2 · Ghép pipeline đúng", tab: "an", highlight: [6, 7, 9], on: ["a1", "tok", "a2", "out"],
      desc: "html_strip → standard → lowercase + asciifolding: ra token sạch, không dấu." },
    { title: "3 · Đóng gói thành analyzer", tab: "custom", highlight: [4, 6, 7, 8, 14], on: ["out"],
      desc: "Khai báo trong settings.analysis rồi gán cho field. Normalizer dùng cho keyword." },
    { title: "4 · Query đi qua cùng analyzer", tab: "custom", highlight: [14, 15], on: ["a3", "match"],
      desc: "Người dùng gõ \"ĐIỆN thoại\" → dien, thoai → khớp. Brand \"SAMSUNG\" → samsung → term khớp." },
    { title: "5 · Autocomplete: khác analyzer hai đầu", tab: "auto", highlight: [2, 4, 5, 9, 11, 12], on: ["out", "match"],
      desc: "Ngram chỉ lúc index. Lúc search giữ nguyên từ người dùng gõ." },
    { title: "6 · Synonym đặt ở search", tab: "syn", highlight: [2, 3, 7, 10], on: ["a3"],
      desc: "Sửa danh sách đồng nghĩa rồi reload, không cần reindex." }
  ],

  quiz: [
    { q: "Thứ tự các tầng trong analyzer?", options: [
        "tokenizer → char_filter → token filter",
        "char_filter → tokenizer → token filter",
        "token filter → tokenizer → char_filter",
        "Tuỳ cấu hình"
      ], correct: 1, explanation: "Char filter sửa chuỗi thô, tokenizer cắt, filter biến đổi token." },
    { q: "Một analyzer có bao nhiêu tokenizer?", options: [
        "0 hoặc nhiều", "Đúng 1", "Tối đa 3", "Không cần"
      ], correct: 1, explanation: "Char filter và token filter có thể 0..n, tokenizer đúng một." },
    { q: "Analyzer standard mặc định làm gì?", options: [
        "Tách từ + lowercase",
        "Tách từ + lowercase + bỏ dấu + stop word",
        "Không tách",
        "Chỉ bỏ HTML"
      ], correct: 0, explanation: "Stop filter của standard tắt mặc định; không có asciifolding." },
    { q: "Tìm 'dien thoai' không ra dù tên là 'Điện thoại'. Công cụ debug đầu tiên?", options: [
        "Tăng heap", "POST _analyze với chuỗi document và chuỗi query để so token", "Xoá index", "Restart"
      ], correct: 1, explanation: "Nếu token khác nhau (điện vs dien) thì không khớp." },
    { q: "Autocomplete bằng edge_ngram: vì sao search_analyzer không nên có edge_ngram?", options: [
        "Vì chậm index",
        "Gõ 'sams' sẽ bị cắt thành sa, sam… và khớp quá rộng",
        "ES cấm",
        "Vì tốn disk"
      ], correct: 1, explanation: "Chỉ phía index cần sinh tiền tố." },
    { q: "Normalizer dùng cho kiểu field nào?", options: [
        "text", "keyword", "long", "date"
      ], correct: 1, explanation: "Normalizer không tách từ, chỉ lowercase/fold cả chuỗi." },
    { q: "Vì sao nên đặt synonym ở search analyzer?", options: [
        "Nhanh hơn khi index",
        "Sửa danh sách đồng nghĩa không cần reindex",
        "Bắt buộc",
        "Để agg được"
      ], correct: 1, explanation: "Index analyzer đã ghi token vào segment; đổi thì phải reindex." },
    { q: "Đổi analyzer của field name đang có dữ liệu thế nào?", options: [
        "PUT _mapping với analyzer mới",
        "Tạo index mới với analyzer mới rồi reindex",
        "Close/open index là đủ",
        "Không cần làm gì"
      ], correct: 1, explanation: "Token cũ đã nằm trong segment. (Chỉ search_analyzer mới cập nhật được trên field có sẵn.)" },
    { q: "char_filter html_strip giải quyết vấn đề gì?", options: [
        "Dấu tiếng Việt",
        "Thẻ HTML trong mô tả sản phẩm sinh token rác như 'b', 'div'",
        "Chữ hoa",
        "Từ đồng nghĩa"
      ], correct: 1, explanation: "Bỏ thẻ trước khi tokenizer cắt." }
  ]
});
