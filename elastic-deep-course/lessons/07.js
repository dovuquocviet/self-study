window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Mô hình dữ liệu",
  title: "Tìm kiếm tiếng Việt: dấu, Unicode tổ hợp, ICU, asciifolding",
  subtitle: "NFC vs NFD · bỏ dấu mà vẫn ưu tiên đúng dấu · âm tiết vs từ ghép · plugin analysis-icu",

  theory: `
    <p>Tiếng Việt có ba vấn đề riêng khi tìm kiếm:</p>

    <p><strong>1. Cùng chữ, khác byte (Unicode dựng sẵn vs tổ hợp)</strong>. "ệ" có thể là một code point U+1EC7 (<em>NFC, dựng sẵn</em>) hoặc "e" + dấu mũ + dấu nặng (<em>NFD, tổ hợp</em> — gõ bằng bảng mã "Unicode tổ hợp", copy từ một số file Word/PDF, macOS tên file). Mắt nhìn giống hệt, nhưng token khác nhau → tìm "Việt" không ra "Việt".
    Chữa: chuẩn hoá Unicode trước khi tách từ — char filter/token filter <code>icu_normalizer</code> (mặc định <code>nfkc_cf</code>: chuẩn hoá NFKC + case folding).</p>

    <p><strong>2. Người dùng gõ không dấu</strong>: "dien thoai" phải ra "điện thoại". Hai lựa chọn:</p>
    <ul>
      <li><code>asciifolding</code> (có sẵn, không cần plugin): chuyển ký tự Latin có dấu về ASCII; <strong>đ → d</strong> cũng được xử lý. <code>preserve_original: true</code> giữ cả token gốc.</li>
      <li><code>icu_folding</code> (plugin <code>analysis-icu</code>): chuẩn hoá + hạ chữ + bỏ dấu trong một bước, theo chuẩn Unicode (UTR#30), đầy đủ hơn cho nhiều ngôn ngữ.</li>
    </ul>

    <p><strong>Bẫy</strong>: bỏ dấu làm "bán", "bạn", "bàn", "ban" thành cùng token "ban". Người gõ đúng dấu "bàn" vẫn phải thấy "bàn" lên đầu. Giải pháp chuẩn: <strong>multi-field</strong> — <code>name</code> giữ dấu (chỉ normalize + lowercase), <code>name.folded</code> bỏ dấu; query cả hai, cho field có dấu boost cao hơn. Khớp cả hai → điểm cộng dồn → đúng dấu đứng trước.</p>

    <p><strong>3. Âm tiết vs từ</strong>: chữ Việt cách nhau theo âm tiết; "học sinh" và "sinh học" cho cùng tập token {học, sinh}. <code>standard</code> và <code>icu_tokenizer</code> đều tách theo âm tiết. Cách xử lý thực tế:</p>
    <ul>
      <li>Thêm <code>match_phrase</code> (hoặc <code>should</code> phrase có boost) để ưu tiên đúng thứ tự.</li>
      <li>Filter <code>shingle</code> sinh cặp âm tiết "hoc sinh" làm token → khớp cụm từ chính xác hơn.</li>
      <li>Plugin tách từ tiếng Việt của bên thứ ba (vd dựa trên thư viện CocCoc) — tách "học sinh" thành một token. Phải build đúng phiên bản ES, không có sẵn trên dịch vụ cloud → cân nhắc chi phí vận hành.</li>
    </ul>

    <p><strong>Cài plugin</strong>: <code>bin/elasticsearch-plugin install analysis-icu</code> trên <em>mọi</em> node rồi restart từng node. Elastic Cloud và Amazon OpenSearch Service đều có sẵn ICU. Docker: build image riêng có plugin.</p>

    <div class="callout"><p>💡 PostgreSQL làm tương tự bằng <code>unaccent()</code> + index trên biểu thức. Khác biệt: ES cho bạn chấm điểm đồng thời trên cả bản có dấu và bản bỏ dấu nhờ multi-field, nên xếp hạng tự nhiên hơn.</p></div>
  `,

  codeTabs: [
    { id: "nfd", label: "① NFC vs NFD", lines: [
      "\"Việt\" NFC: V i ệ t            → 4 code point (ệ = U+1EC7)",
      "\"Việt\" NFD: V i e ◌̂ ◌̣ t       → 6 code point",
      "",
      "POST /_analyze",
      "{ \"tokenizer\": \"standard\", \"filter\": [\"lowercase\"], \"text\": \"<chuỗi NFD>\" }",
      "# → token khác 'việt' (NFC) → không khớp",
      "",
      "POST /_analyze",
      "{ \"tokenizer\": \"icu_tokenizer\", \"filter\": [\"icu_normalizer\"], \"text\": \"<chuỗi NFD>\" }",
      "# → 'việt' (đã NFC + lowercase) → khớp"
    ]},
    { id: "map", label: "② Mapping chuẩn", lines: [
      "PUT /products_v3",
      "{ \"settings\": { \"analysis\": { \"analyzer\": {",
      "    \"vi_exact\":  { \"tokenizer\": \"icu_tokenizer\", \"filter\": [\"icu_normalizer\"] },",
      "    \"vi_folded\": { \"tokenizer\": \"icu_tokenizer\", \"filter\": [\"icu_folding\"] }",
      "  } } },",
      "  \"mappings\": { \"properties\": {",
      "    \"name\": { \"type\": \"text\", \"analyzer\": \"vi_exact\",",
      "      \"fields\": {",
      "        \"folded\": { \"type\": \"text\", \"analyzer\": \"vi_folded\" },",
      "        \"raw\":    { \"type\": \"keyword\" }",
      "      } }",
      "} } }"
    ]},
    { id: "q", label: "③ Query ưu tiên đúng dấu", lines: [
      "POST /products_v3/_search",
      "{ \"query\": { \"multi_match\": {",
      "    \"query\": \"bàn gỗ\",",
      "    \"type\": \"most_fields\",",
      "    \"fields\": [ \"name^3\", \"name.folded\" ]",
      "} } }",
      "",
      "# 'Bàn gỗ sồi'  : khớp name (x3) + name.folded → điểm cao nhất",
      "# 'Bạn gỗ'      : chỉ khớp một phần name.folded → thấp hơn",
      "# user gõ 'ban go': chỉ name.folded khớp → vẫn ra kết quả"
    ]},
    { id: "shingle", label: "④ Âm tiết & shingle", lines: [
      "\"filter\": { \"vi_pair\": { \"type\": \"shingle\", \"min_shingle_size\": 2,",
      "                           \"max_shingle_size\": 2, \"output_unigrams\": false } }",
      "\"analyzer\": { \"vi_pairs\": { \"tokenizer\": \"icu_tokenizer\",",
      "                            \"filter\": [\"icu_folding\", \"vi_pair\"] } }",
      "",
      "# 'sách sinh học lớp 10' → 'sach sinh', 'sinh hoc', 'hoc lop', 'lop 10'",
      "# query 'học sinh' → 'hoc sinh' → không khớp 'sinh hoc'  ✔ phân biệt được",
      "",
      "# name.pairs thêm vào multi_match với boost nhỏ để thưởng đúng cụm từ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="in"><div class="nl">⌨️ User gõ "ban go" / "bàn gỗ"</div><div class="ns">có thể là NFD, có thể không dấu</div></div>
    <div class="arrow" id="a1">↓ icu_normalizer (NFC + lowercase)</div>
    <div class="row">
      <div class="node" id="ex"><div class="nl">name (giữ dấu)</div><div class="ns">bàn · gỗ — boost ×3</div></div>
      <div class="node" id="fo"><div class="nl">name.folded (bỏ dấu)</div><div class="ns">ban · go</div></div>
    </div>
    <div class="arrow" id="a2">↓ most_fields: cộng điểm</div>
    <div class="node" id="rank"><div class="nl">🏆 "Bàn gỗ sồi" trên "Bạn gỗ"</div><div class="ns">đúng dấu thắng, không dấu vẫn ra</div></div>
  `,
  steps: [
    { title: "1 · Chuỗi trông giống nhưng khác byte", tab: "nfd", highlight: [1, 2, 6], on: ["in"],
      desc: "Văn bản NFD sinh token khác NFC, nên bản ghi dán từ PDF có thể không bao giờ được tìm thấy." },
    { title: "2 · Chuẩn hoá trước", tab: "nfd", highlight: [9, 10], on: ["a1"],
      desc: "icu_normalizer đưa mọi thứ về NFC + chữ thường trước khi so." },
    { title: "3 · Hai cách index cùng một tên", tab: "map", highlight: [3, 4, 7, 9], on: ["ex", "fo"],
      desc: "name giữ dấu; name.folded bỏ dấu (icu_folding, đ → d)." },
    { title: "4 · Query cả hai, thưởng đúng dấu", tab: "q", highlight: [4, 5, 8, 9, 10], on: ["a2", "rank"],
      desc: "most_fields cộng điểm các field khớp. Gõ đúng dấu thì được cả hai phần điểm." },
    { title: "5 · Phân biệt 'học sinh' / 'sinh học'", tab: "shingle", highlight: [1, 6, 7], on: ["rank"],
      desc: "Shingle ghép cặp âm tiết thành token, giữ thông tin thứ tự mà không cần plugin tách từ." }
  ],

  quiz: [
    { q: "Vì sao tìm 'Việt' đôi khi không ra document chứa 'Việt' nhìn giống hệt?", options: [
        "Do shard lỗi",
        "Một bên là Unicode dựng sẵn (NFC), bên kia tổ hợp (NFD) → token khác byte",
        "Do refresh",
        "Do BM25"
      ], correct: 1, explanation: "Cần icu_normalizer để chuẩn hoá về cùng dạng." },
    { q: "asciifolding xử lý 'đường' thành gì?", options: [
        "đuong", "duong", "dường", "Giữ nguyên"
      ], correct: 1, explanation: "Lucene ASCIIFoldingFilter ánh xạ đ → d và bỏ các dấu." },
    { q: "Filter icu_folding đến từ đâu?", options: [
        "Có sẵn trong mọi bản ES", "Plugin analysis-icu", "Kibana", "Ingest pipeline"
      ], correct: 1, explanation: "Phải cài analysis-icu trên mọi node (cloud thường có sẵn)." },
    { q: "Chỉ index bản bỏ dấu gây vấn đề gì?", options: [
        "Không tìm được bằng chữ không dấu",
        "'bàn', 'bạn', 'bán' trùng token; gõ đúng dấu không được ưu tiên",
        "Tốn disk gấp đôi",
        "Không agg được"
      ], correct: 1, explanation: "Dùng multi-field giữ cả bản có dấu và boost nó." },
    { q: "multi_match type most_fields với fields [name^3, name.folded] làm gì?", options: [
        "Lấy điểm của field tốt nhất",
        "Cộng điểm các field khớp, name có trọng số 3",
        "Chỉ query name",
        "Yêu cầu khớp cả hai"
      ], correct: 1, explanation: "Khớp cả bản có dấu và không dấu được điểm cao nhất." },
    { q: "standard tokenizer tách 'học sinh giỏi' thành?", options: [
        "['học sinh', 'giỏi']", "['học', 'sinh', 'giỏi']", "['học sinh giỏi']", "['h','ọ','c']"
      ], correct: 1, explanation: "Tách theo âm tiết (khoảng trắng), không biết từ ghép." },
    { q: "Filter shingle 2 âm tiết giúp gì?", options: [
        "Bỏ dấu",
        "Sinh token cặp âm tiết như 'hoc sinh' để phân biệt thứ tự từ",
        "Đồng nghĩa",
        "Giảm dung lượng"
      ], correct: 1, explanation: "'hoc sinh' khác 'sinh hoc'." },
    { q: "Nhược điểm của plugin tách từ tiếng Việt bên thứ ba?", options: [
        "Không tách được từ",
        "Phải build khớp đúng phiên bản ES, thường không cài được trên dịch vụ managed",
        "Chỉ chạy trên OpenSearch",
        "Không hỗ trợ UTF-8"
      ], correct: 1, explanation: "Mỗi lần nâng cấp ES phải có bản plugin tương ứng." },
    { q: "Filter icu_normalizer mặc định dùng dạng chuẩn hoá nào?", options: [
        "NFD", "nfkc_cf (NFKC + case folding)", "ASCII", "Không làm gì"
      ], correct: 1, explanation: "Vừa chuẩn hoá Unicode vừa hạ chữ thường." }
  ]
});
