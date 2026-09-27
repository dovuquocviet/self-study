window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Các mô hình dữ liệu",
  title: "Mô hình document — nhúng hay tham chiếu (MongoDB & WiredTiger)",
  subtitle: "Aggregate = đơn vị đọc/ghi · giới hạn 16 MB · mảng vô hạn · WiredTiger: B-tree, nén, checkpoint",

  theory: `
    <p>Trong mô hình quan hệ, một đơn hàng rải ra <code>orders</code>, <code>order_items</code>, <code>addresses</code> và phải JOIN lại. Mô hình document lưu cả
    <strong>aggregate</strong> (khái niệm DDD bạn đã quen) thành một document BSON: đọc một lần, ghi một lần, atomic trên cả document.</p>

    <p><strong>Nguyên tắc thiết kế: theo cách truy cập, không theo "chuẩn hoá"</strong></p>
    <table>
      <tr><th>Nhúng (embed) khi</th><th>Tham chiếu (reference) khi</th></tr>
      <tr><td>Dữ liệu con luôn được đọc cùng cha (dòng hàng của đơn)</td><td>Dữ liệu con được đọc/sửa độc lập (sản phẩm dùng chung cho nhiều đơn)</td></tr>
      <tr><td>Quan hệ 1-vài, số lượng có giới hạn</td><td>Quan hệ 1-rất-nhiều hoặc không giới hạn (log, comment, lịch sử)</td></tr>
      <tr><td>Cần cập nhật atomic cùng cha</td><td>Dữ liệu thay đổi thường xuyên và phải nhất quán ở nhiều nơi</td></tr>
    </table>
    <p>Giữa hai cực là <em>extended reference</em>: nhúng bản sao vài field hay dùng (tên, giá lúc mua) + giữ id để tra khi cần. Đó là <em>chủ ý</em> chấp nhận dữ liệu trùng lặp
    — giá trong đơn hàng <em>nên</em> là giá lúc mua, không phải giá hiện tại.</p>

    <p><strong>Giới hạn &amp; bẫy</strong></p>
    <ul>
      <li>Document tối đa <strong>16 MB</strong>. Mảng tăng không giới hạn (mọi comment của bài viết) sẽ chạm trần, và mỗi lần sửa phải ghi lại document ngày càng lớn.</li>
      <li>Index trên field mảng (multikey) tạo một mục cho mỗi phần tử → mảng lớn làm index phình.</li>
      <li><code>$lookup</code> (JOIN) có, nhưng nếu mọi truy vấn đều cần $lookup thì bạn đang dùng Mongo như DB quan hệ tệ.</li>
      <li>"Schemaless" không có nghĩa là không có schema — schema chuyển vào code. Dùng <code>$jsonSchema</code> validation để DB tự chặn dữ liệu rác.</li>
    </ul>

    <p><strong>Bên dưới: WiredTiger</strong></p>
    <ul>
      <li>Mỗi collection và mỗi index là một <strong>B-tree</strong> riêng. Document được khoá bởi RecordId nội bộ; index <code>_id</code> ánh xạ _id → RecordId.</li>
      <li>Kiểm soát đồng thời ở mức document, MVCC trong cache (bài 09, 11).</li>
      <li>Trên đĩa dữ liệu được <strong>nén</strong>: collection mặc định snappy (có zstd, zlib), index dùng prefix compression. Trong cache ở dạng giải nén.</li>
      <li>Không sửa page tại chỗ trên đĩa: page mới được ghi ra chỗ khác, <strong>checkpoint</strong> mặc định mỗi 60 giây tạo điểm nhất quán; giữa hai checkpoint thì dựa vào <strong>journal</strong> (WAL).</li>
      <li><code>ObjectId</code> 12 byte = 4 byte timestamp + 5 byte ngẫu nhiên + 3 byte bộ đếm → gần tăng dần, thân thiện B-tree (bài 04).</li>
    </ul>

    <div class="callout"><p>💡 Câu hỏi thiết kế Mongo đầu tiên: "màn hình/API nào đọc cái này, và nó cần những gì trong một lần đọc?". Với Spring Data MongoDB,
    một <code>@Document</code> nên tương ứng một aggregate; đừng rải <code>@DBRef</code> khắp nơi — nó chỉ là tham chiếu được driver tự tra thêm, không phải JOIN.</p></div>
  `,

  codeTabs: [
    { id: "embed", label: "Đơn hàng nhúng", lines: [
      "{",
      "  _id: ObjectId('66f6c1e2a1b2c3d4e5f60718'),",
      "  userId: 42,",
      "  status: 'PAID',",
      "  shipping: { name: 'An', city: 'Hà Nội', phone: '09xx' },   // nhúng 1-1",
      "  items: [                                                     // nhúng 1-vài",
      "    { sku: 'TS-01', name: 'Áo thun', price: 150000, qty: 2 },  // extended reference",
      "    { sku: 'HT-07', name: 'Mũ',      price: 50000,  qty: 1 }",
      "  ],",
      "  total: 350000",
      "}",
      "// đọc trang chi tiết đơn = 1 lần đọc, không JOIN"
    ]},
    { id: "anti", label: "Mảng vô hạn", lines: [
      "// ❌ mọi comment nhúng vào bài viết",
      "{ _id: 'post-1', title: '...', comments: [ /* 200.000 phần tử... */ ] }",
      "// → chạm 16 MB, mỗi comment mới ghi lại cả document, multikey index phình",
      "",
      "// ✅ tách collection, tham chiếu ngược + index",
      "{ _id: ObjectId(...), postId: 'post-1', user: 'An', text: '...', at: ISODate(...) }",
      "db.comments.createIndex({ postId: 1, at: -1 })",
      "",
      "// ✅ hoặc nhúng 'subset': 5 comment mới nhất trong post, còn lại ở collection riêng"
    ]},
    { id: "atomic", label: "Cập nhật atomic", lines: [
      "// thêm dòng hàng và cộng tổng trong 1 thao tác atomic, không cần transaction",
      "db.orders.updateOne(",
      "  { _id: id, status: 'CART' },",
      "  { $push: { items: { sku: 'SK-9', price: 90000, qty: 1 } },",
      "    $inc:  { total: 90000 } }",
      ")",
      "",
      "// schema validation: DB tự chặn dữ liệu rác",
      "db.runCommand({ collMod: 'orders', validator: { $jsonSchema: {",
      "  required: ['userId', 'status', 'total'],",
      "  properties: { total: { bsonType: 'long', minimum: 0 } } } } })"
    ]},
    { id: "spring", label: "Spring Data Mongo", lines: [
      "@Document(\"orders\")",
      "class Order {                    // một aggregate = một document",
      "    @Id String id;",
      "    long userId;",
      "    Address shipping;            // nhúng: class thường, không @DBRef",
      "    List<OrderItem> items;       // nhúng",
      "    long total;",
      "    @Version Long version;       // optimistic locking vẫn dùng được",
      "}",
      "",
      "// @DBRef User user;  → driver tra thêm 1 query, không phải JOIN, dễ thành N+1"
    ]}
  ],

  stageHtml: `
    <div class="node" id="api"><div class="nl">📱 API: chi tiết đơn</div><div class="ns">cần đơn + địa chỉ + dòng hàng</div></div>
    <div class="row">
      <div class="node" id="rel"><div class="nl">🐘 Quan hệ</div><div class="ns">3 bảng, JOIN</div></div>
      <div class="node" id="doc"><div class="nl">🍃 Document</div><div class="ns">1 document, 1 lần đọc</div></div>
    </div>
    <div class="arrow" id="a1">↓ bên dưới</div>
    <div class="node" id="wt"><div class="nl">🗄️ WiredTiger</div><div class="ns">B-tree mỗi collection/index · nén snappy</div></div>
    <div class="arrow" id="a2">↓ bền vững</div>
    <div class="node" id="disk"><div class="nl">💾 Journal + checkpoint 60s</div><div class="ns">page mới ghi chỗ khác</div></div>
  `,
  steps: [
    { title: "1 · Aggregate thành một document", tab: "embed", highlight: [5, 6, 7, 8, 12], on: ["api", "doc"],
      desc: "Địa chỉ và dòng hàng luôn đi cùng đơn → nhúng. Giá trong dòng hàng là giá lúc mua (extended reference)." },
    { title: "2 · So với quan hệ", tab: "embed", highlight: [12], on: ["rel", "doc"],
      desc: "Quan hệ chuẩn hoá phải JOIN 3 bảng; document đọc một lần vì dữ liệu nằm liền nhau (bài 02, 06)." },
    { title: "3 · Bẫy mảng không giới hạn", tab: "anti", highlight: [2, 3, 6, 7, 9], on: ["doc"],
      desc: "Quan hệ 1-rất-nhiều → tách collection, hoặc nhúng một tập con." },
    { title: "4 · Atomic trên một document", tab: "atomic", highlight: [2, 3, 4, 5, 9, 10, 11], on: ["doc"],
      desc: "Thiết kế nhúng tốt giúp tránh transaction nhiều document. Schema validation bảo vệ dữ liệu." },
    { title: "5 · WiredTiger bên dưới", tab: "spring", highlight: [1, 2, 5, 6, 11], on: ["a1", "wt"],
      desc: "Mỗi collection/index là một B-tree, nén trên đĩa. @DBRef chỉ là query phụ." },
    { title: "6 · Độ bền", tab: "atomic", highlight: [2], on: ["a2", "disk"],
      desc: "Journal ghi mọi thay đổi; checkpoint định kỳ tạo ảnh nhất quán trên đĩa." }
  ],

  quiz: [
    { q: "Khi nào nên nhúng dữ liệu con vào document cha?", options: [
        "Khi dữ liệu con tăng không giới hạn",
        "Khi dữ liệu con luôn được đọc cùng cha và số lượng có giới hạn",
        "Khi dữ liệu con được nhiều cha dùng chung và sửa thường xuyên",
        "Không bao giờ"
      ], correct: 1, explanation: "Ví dụ: dòng hàng và địa chỉ giao của đơn." },
    { q: "Kích thước tối đa của một document MongoDB?", options: ["1 MB", "16 MB", "64 MB", "Không giới hạn"], correct: 1,
      explanation: "Dữ liệu lớn hơn dùng GridFS hoặc tách document." },
    { q: "Vì sao lưu giá sản phẩm (bản sao) trong dòng hàng của đơn là hợp lý?", options: [
        "Tiết kiệm chỗ",
        "Đơn cần giá lúc mua; đây là trùng lặp có chủ ý (extended reference)",
        "Mongo bắt buộc",
        "Để tránh index"
      ], correct: 1, explanation: "Giá hiện tại có thể đổi, giá trong đơn thì không được đổi." },
    { q: "Vấn đề của mảng comments nhúng tăng không giới hạn?", options: [
        "Không có vấn đề",
        "Chạm giới hạn 16 MB, mỗi lần sửa ghi lại document lớn, multikey index phình",
        "Mongo không hỗ trợ mảng",
        "Không query được"
      ], correct: 1, explanation: "Tách collection comments với index postId." },
    { q: "Cấu trúc lưu trữ mặc định của WiredTiger cho collection và index?", options: [
        "LSM-tree", "B-tree", "Hash table", "Inverted index"
      ], correct: 1, explanation: "WiredTiger có hỗ trợ LSM nhưng MongoDB dùng B-tree." },
    { q: "Nén mặc định cho dữ liệu collection trong WiredTiger?", options: [
        "Không nén", "snappy", "gzip bắt buộc", "RLE"
      ], correct: 1, explanation: "Có thể chọn zstd hoặc zlib; index dùng prefix compression." },
    { q: "Checkpoint của WiredTiger mặc định bao lâu một lần?", options: ["1 giây", "60 giây", "1 giờ", "Chỉ khi tắt"], correct: 1,
      explanation: "Giữa hai checkpoint, journal đảm bảo khôi phục được." },
    { q: "@DBRef trong Spring Data MongoDB thực chất là gì?", options: [
        "JOIN phía server",
        "Tham chiếu mà driver tra thêm bằng query riêng — dễ gây N+1",
        "Nhúng document",
        "Foreign key có ràng buộc"
      ], correct: 1, explanation: "MongoDB không có foreign key constraint." },
    { q: "ObjectId gồm những phần nào?", options: [
        "16 byte ngẫu nhiên",
        "4 byte timestamp + 5 byte ngẫu nhiên + 3 byte bộ đếm",
        "Số tự tăng toàn cục",
        "Hash của document"
      ], correct: 1, explanation: "Nhờ timestamp đứng đầu nên gần tăng dần, tốt cho B-tree." },
    { q: "'Schemaless' trong MongoDB nên hiểu thế nào?", options: [
        "Dữ liệu không cần cấu trúc",
        "Schema nằm ở code thay vì DB; nên thêm $jsonSchema validation để DB chặn dữ liệu rác",
        "Không thể có index",
        "Không cần thiết kế"
      ], correct: 1, explanation: "Schema vẫn tồn tại, chỉ là ai giữ nó." }
  ]
});
