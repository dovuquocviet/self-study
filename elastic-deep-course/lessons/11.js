window.LESSONS.push({
  id: "11",
  phase: "2", phaseName: "Tìm kiếm & xếp hạng",
  title: "Quan hệ trong ES: object vs nested vs join vs phi chuẩn hoá",
  subtitle: "mảng object bị làm phẳng · nested = document ẩn · inner_hits · vì sao nên denormalize",

  theory: `
    <p>ES không có JOIN. Khi document có mảng object (sản phẩm có nhiều biến thể, đơn có nhiều dòng hàng), cách bạn map quyết định query có <strong>đúng</strong> hay không.</p>

    <p><strong>object (mặc định) — bị làm phẳng</strong>. Lucene không có khái niệm object lồng; mảng
    <code>variants: [{color: xanh, size: M}, {color: đỏ, size: L}]</code> được lưu thành
    <code>variants.color = [xanh, đỏ]</code>, <code>variants.size = [M, L]</code>. Mất liên kết "xanh đi với M".
    Query "color = xanh AND size = L" <strong>khớp sai</strong> dù không có biến thể xanh-L.</p>

    <p><strong>nested — mỗi object là một document Lucene ẩn</strong>, nằm liền kề document cha trong cùng segment (block). Query phải bọc trong <code>nested</code> với <code>path</code>; điều kiện bên trong áp cho <em>cùng một</em> object. Đi kèm:</p>
    <ul>
      <li><code>inner_hits</code>: trả về chính biến thể nào đã khớp.</li>
      <li>Aggregation <code>nested</code> / <code>reverse_nested</code> để đếm theo object con rồi quay lại cha.</li>
      <li>Chi phí: 1 sản phẩm 50 biến thể = 51 document Lucene. Sửa một biến thể = reindex cả khối. Giới hạn <code>nested_objects.limit</code> 10000/doc, <code>nested_fields.limit</code> 50/index.</li>
    </ul>

    <p><strong>join field (parent/child)</strong>: cha và con là document riêng, cùng index, <strong>bắt buộc cùng shard</strong> (routing theo id cha). Sửa con không đụng cha. Nhưng <code>has_child</code>/<code>has_parent</code> chậm hơn nested nhiều lần và tốn heap (global ordinals). Chỉ dùng khi con cập nhật rất thường xuyên và số lượng lớn.</p>

    <p><strong>Denormalize (phi chuẩn hoá)</strong> — lựa chọn mặc định cho read model: chép tên shop, tên danh mục vào document sản phẩm. Đổi tên shop → cập nhật nhiều document (update_by_query hoặc indexer phát lại). Chấp nhận vì đọc nhiều hơn ghi rất nhiều.</p>

    <table>
      <tr><th>Cách</th><th>Query đúng theo từng object?</th><th>Chi phí đọc</th><th>Chi phí sửa con</th></tr>
      <tr><td>object</td><td>Không</td><td>Rẻ nhất</td><td>Reindex doc</td></tr>
      <tr><td>nested</td><td>Có</td><td>Vừa</td><td>Reindex cả khối</td></tr>
      <tr><td>join</td><td>Có</td><td>Đắt</td><td>Chỉ doc con</td></tr>
      <tr><td>denormalize</td><td>Tuỳ cấu trúc</td><td>Rẻ</td><td>Cập nhật nhiều doc</td></tr>
    </table>

    <div class="callout"><p>💡 Với JPA bạn quen <code>@OneToMany</code> + lazy load. Trong ES hãy nghĩ ngược lại: định hình document theo <em>màn hình tìm kiếm</em> cần gì, rồi để indexer chịu phần ghép dữ liệu từ các service.</p></div>
  `,

  codeTabs: [
    { id: "obj", label: "① object bị làm phẳng", lines: [
      "PUT /products/_doc/1",
      "{ \"name\": \"Áo thun\", \"variants\": [",
      "    { \"color\": \"xanh\", \"size\": \"M\" },",
      "    { \"color\": \"do\",   \"size\": \"L\" } ] }",
      "",
      "# Lucene thực sự lưu:",
      "# variants.color: [xanh, do]   variants.size: [M, L]",
      "",
      "{ \"bool\": { \"filter\": [ { \"term\": { \"variants.color\": \"xanh\" } },",
      "                        { \"term\": { \"variants.size\":  \"L\" } } ] } }",
      "# → KHỚP doc 1 (sai: không có áo xanh size L)"
    ]},
    { id: "nested", label: "② nested", lines: [
      "PUT /products_v4",
      "{ \"mappings\": { \"properties\": {",
      "    \"variants\": { \"type\": \"nested\", \"properties\": {",
      "      \"color\": { \"type\": \"keyword\" }, \"size\": { \"type\": \"keyword\" }, \"stock\": { \"type\": \"integer\" } } }",
      "} } }",
      "",
      "{ \"nested\": { \"path\": \"variants\", \"query\": { \"bool\": { \"filter\": [",
      "    { \"term\": { \"variants.color\": \"xanh\" } },",
      "    { \"term\": { \"variants.size\": \"L\" } } ] } },",
      "  \"inner_hits\": {} } }",
      "# → không khớp ✔ ; với xanh+M: khớp và inner_hits chỉ ra đúng biến thể"
    ]},
    { id: "agg", label: "③ nested agg", lines: [
      "{ \"size\": 0, \"aggs\": { \"v\": {",
      "    \"nested\": { \"path\": \"variants\" },",
      "    \"aggs\": { \"by_color\": {",
      "      \"terms\": { \"field\": \"variants.color\" },",
      "      \"aggs\": { \"products\": { \"reverse_nested\": {} } } } }",
      "} } }",
      "# by_color.xanh.doc_count        = số BIẾN THỂ màu xanh",
      "# by_color.xanh.products.doc_count = số SẢN PHẨM có biến thể xanh"
    ]},
    { id: "join", label: "④ join & denormalize", lines: [
      "\"relation\": { \"type\": \"join\", \"relations\": { \"shop\": \"product\" } }",
      "",
      "PUT /catalog/_doc/p-9?routing=s-1",
      "{ \"name\": \"Áo thun\", \"relation\": { \"name\": \"product\", \"parent\": \"s-1\" } }",
      "",
      "{ \"has_child\": { \"type\": \"product\", \"query\": { \"match\": { \"name\": \"áo\" } } } }  // chậm",
      "",
      "# ✅ thường tốt hơn: chép sẵn dữ liệu shop vào sản phẩm",
      "{ \"name\": \"Áo thun\", \"shop\": { \"id\": \"s-1\", \"name\": \"Shop Mây\", \"rating\": 4.8 } }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📄 Áo thun: [xanh/M, đỏ/L]</div><div class="ns">JSON gửi lên</div></div>
    <div class="row">
      <div class="node" id="ob"><div class="nl">object</div><div class="ns">color:[xanh,đỏ] size:[M,L] — mất cặp</div></div>
      <div class="node" id="ne"><div class="nl">nested</div><div class="ns">3 doc Lucene: cha + 2 con ẩn</div></div>
    </div>
    <div class="arrow" id="a1">↓ query xanh AND L</div>
    <div class="row">
      <div class="node" id="bad"><div class="nl">❌ khớp sai</div><div class="ns">object</div></div>
      <div class="node" id="good"><div class="nl">✅ không khớp</div><div class="ns">nested xét từng biến thể</div></div>
    </div>
  `,
  steps: [
    { title: "1 · object làm phẳng mảng", tab: "obj", highlight: [2, 3, 4, 7], on: ["src", "ob"],
      desc: "Mỗi field con thành một mảng giá trị riêng; liên kết giữa chúng biến mất." },
    { title: "2 · Hậu quả: khớp chéo", tab: "obj", highlight: [9, 10, 11], on: ["a1", "bad"],
      desc: "xanh đến từ biến thể 1, L đến từ biến thể 2 — vẫn khớp." },
    { title: "3 · nested giữ ranh giới object", tab: "nested", highlight: [3, 7, 8, 9, 11], on: ["ne", "good"],
      desc: "Điều kiện trong nested phải thoả trên cùng một document con." },
    { title: "4 · Đếm biến thể vs đếm sản phẩm", tab: "agg", highlight: [2, 5, 7, 8], on: ["ne"],
      desc: "reverse_nested quay về document cha để đếm sản phẩm." },
    { title: "5 · Khi nào join, khi nào chép", tab: "join", highlight: [3, 6, 9], on: ["src"],
      desc: "join bắt buộc routing về shard của cha và query chậm; read model thường chọn denormalize." }
  ],

  quiz: [
    { q: "Mảng object map kiểu object mặc định được Lucene lưu thế nào?", options: [
        "Mỗi object một document",
        "Làm phẳng: mỗi field con thành mảng giá trị, mất liên kết giữa các field",
        "Lưu JSON nguyên",
        "Không lưu"
      ], correct: 1, explanation: "Vì Lucene chỉ có document phẳng." },
    { q: "Query color=xanh AND size=L trên object [xanh/M, đỏ/L] cho kết quả?", options: [
        "Không khớp", "Khớp (sai)", "Lỗi", "Khớp với score 0"
      ], correct: 1, explanation: "Đây là lý do cần nested." },
    { q: "Sản phẩm có 20 biến thể kiểu nested tạo ra bao nhiêu document Lucene?", options: [
        "1", "20", "21", "40"
      ], correct: 2, explanation: "1 cha + 20 con ẩn." },
    { q: "inner_hits dùng để làm gì?", options: [
        "Đếm hit",
        "Trả về chính object nested nào đã khớp",
        "Tăng tốc",
        "Phân trang"
      ], correct: 1, explanation: "Ví dụ biết đúng biến thể xanh/M còn hàng." },
    { q: "reverse_nested trong aggregation làm gì?", options: [
        "Đảo thứ tự bucket",
        "Từ ngữ cảnh document con quay về document cha để đếm/agg",
        "Xoá nested",
        "Sort ngược"
      ], correct: 1, explanation: "Đếm số sản phẩm thay vì số biến thể." },
    { q: "Yêu cầu bắt buộc của join field parent/child?", options: [
        "Cha và con khác index",
        "Con phải cùng shard với cha (routing theo id cha)",
        "Tối đa 10 con",
        "Phải là nested"
      ], correct: 1, explanation: "Join chỉ thực hiện được trong phạm vi một shard." },
    { q: "Sửa stock của một biến thể nested thì ES làm gì?", options: [
        "Chỉ sửa document con",
        "Reindex toàn bộ khối (cha + mọi con)",
        "Không sửa được",
        "Chỉ sửa _source"
      ], correct: 1, explanation: "Document cha và con là một khối bất biến." },
    { q: "Lựa chọn mặc định hợp lý cho read model sản phẩm cần hiển thị tên shop?", options: [
        "join shop/product",
        "Denormalize: chép tên/rating shop vào document sản phẩm",
        "Gọi service shop mỗi lần search",
        "nested shop"
      ], correct: 1, explanation: "Đọc rẻ; khi shop đổi tên thì indexer cập nhật lại." },
    { q: "Giới hạn mặc định số object nested trong một document?", options: [
        "100", "1000", "10000", "Không giới hạn"
      ], correct: 2, explanation: "index.mapping.nested_objects.limit = 10000." }
  ]
});
