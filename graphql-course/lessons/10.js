window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Bên trong server",
  title: "Phân trang — offset vs cursor và chuẩn Connection",
  subtitle: "edges · node · pageInfo, và vì sao page=2 lại nhảy mất bản ghi",

  theory: `
    <p>Không ai trả về 100.000 bài viết trong một query. Câu hỏi là <em>cắt thế nào</em>.</p>
    <p><strong>Cách 1 — offset/limit</strong> (<code>page=2&size=20</code>): quen thuộc, dễ nhảy tới
    trang bất kỳ, hiện được "trang 5/48". Nhưng có hai nhược điểm thật sự:</p>
    <ul>
      <li><strong>Trôi dữ liệu.</strong> Bạn xem trang 1, trong lúc đó có người thêm 1 bài mới lên đầu.
      Sang trang 2, bản ghi cuối của trang 1 bị đẩy xuống và <em>hiện lại</em>; hoặc nếu có bài bị xoá
      thì một bản ghi <em>biến mất</em> mà bạn không bao giờ nhìn thấy.</li>
      <li><strong>Chậm dần.</strong> <code>OFFSET 100000</code> buộc database đếm và bỏ qua 100.000
      dòng trước khi lấy 20 dòng bạn cần.</li>
    </ul>
    <p><strong>Cách 2 — cursor</strong> (<code>after: "abc" first: 20</code>): thay vì "bỏ qua N dòng",
    ta nói "lấy 20 dòng <em>sau</em> cái mốc này". Cursor là một chuỗi mờ (thường là base64 của
    khoá sắp xếp) trỏ đúng vào một vị trí trong danh sách. Không trôi, không chậm dần — đổi lại,
    không nhảy thẳng tới trang 37 được.</p>
    <p>Cộng đồng GraphQL chuẩn hoá cách cursor thành <strong>Connection</strong> (chuẩn Relay), gồm:</p>
    <ul>
      <li><code>edges</code> — danh sách "cạnh", mỗi cạnh có <code>node</code> (dữ liệu thật) và
      <code>cursor</code> (mốc của chính nó).</li>
      <li><code>pageInfo</code> — <code>hasNextPage</code>, <code>hasPreviousPage</code>,
      <code>startCursor</code>, <code>endCursor</code>.</li>
      <li>Tầng <code>edges</code> nom thừa thãi, nhưng chính là chỗ đặt <strong>dữ liệu về mối quan hệ</strong>
      chứ không phải về node: <code>role</code> khi thêm thành viên vào nhóm, <code>addedAt</code>,
      <code>score</code> của kết quả tìm kiếm…</li>
    </ul>
    <div class="callout"><p>💡 Chọn thế nào: giao diện <em>cuộn vô tận</em> (feed, chat, thông báo) →
    cursor, gần như không có lựa chọn khác. Giao diện <em>bảng có số trang</em> cho admin, dữ liệu ít
    thay đổi → offset đơn giản hơn nhiều, đừng bê Connection vào cho mệt.</p></div>
  `,

  codeTabs: [
    { id: "offset", label: "🔢 Offset", lines: [
      "type Query { posts(page: Int = 1, size: Int = 20): PostPage! }",
      "type PostPage { items: [Post!]!  total: Int!  page: Int! }",
      "",
      "# SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 20;",
      "",
      "# Vấn đề 1 — trôi dữ liệu:",
      "#   t0: xem trang 1  -> [P100 … P81]",
      "#   t1: ai đó đăng P101 (lên đầu danh sách)",
      "#   t2: xem trang 2  -> [P81 … P62]   <- P81 HIỆN LẠI lần hai",
      "",
      "# Vấn đề 2 — OFFSET lớn thì chậm:",
      "#   OFFSET 100000 phải duyệt bỏ 100.000 dòng rồi mới lấy 20 dòng."
    ]},
    { id: "conn", label: "🔗 Connection", lines: [
      "type Query {",
      "  posts(first: Int, after: String,",
      "        last: Int,  before: String): PostConnection!",
      "}",
      "",
      "type PostConnection {",
      "  edges: [PostEdge!]!",
      "  pageInfo: PageInfo!",
      "  totalCount: Int          # tuỳ chọn — đếm tổng thường tốn kém",
      "}",
      "type PostEdge {",
      "  node: Post!              # dữ liệu thật",
      "  cursor: String!          # mốc của chính phần tử này",
      "  addedAt: DateTime        # dữ liệu về QUAN HỆ, không thuộc Post",
      "}",
      "type PageInfo {",
      "  hasNextPage: Boolean!  hasPreviousPage: Boolean!",
      "  startCursor: String    endCursor: String",
      "}"
    ]},
    { id: "query", label: "💠 Truy vấn & kết quả", lines: [
      "query Trang($after: String) {",
      "  posts(first: 2, after: $after) {",
      "    edges { cursor  node { id title } }",
      "    pageInfo { hasNextPage endCursor }",
      "  }",
      "}",
      "",
      "{ \"data\": { \"posts\": {",
      "  \"edges\": [",
      "    { \"cursor\": \"Y3Vyc29yOjE=\", \"node\": { \"id\":\"31\", \"title\":\"A\" } },",
      "    { \"cursor\": \"Y3Vyc29yOjI=\", \"node\": { \"id\":\"30\", \"title\":\"B\" } }",
      "  ],",
      "  \"pageInfo\": { \"hasNextPage\": true,",
      "                \"endCursor\": \"Y3Vyc29yOjI=\" } } } }",
      "",
      "# Trang sau: truyền lại after = endCursor vừa nhận."
    ]},
    { id: "impl", label: "⚙️ Bên trong", lines: [
      "// Cursor = mã hoá khoá sắp xếp (đừng dùng offset trá hình!)",
      "const encode = (p) => btoa(p.createdAt + \"|\" + p.id);",
      "const decode = (c) => atob(c).split(\"|\");",
      "",
      "// Lấy first + 1 phần tử để biết còn trang sau hay không",
      "const rows = await db.query(",
      "  \"SELECT * FROM posts WHERE (created_at, id) < ($1, $2)\" +",
      "  \" ORDER BY created_at DESC, id DESC LIMIT $3\", [ca, cid, first + 1]);",
      "",
      "const hasNextPage = rows.length > first;",
      "const items = rows.slice(0, first);",
      "",
      "// Sắp xếp phải ỔN ĐỊNH: luôn kèm khoá phụ (id) để không nhảy",
      "// khi hai bản ghi trùng created_at."
    ]}
  ],

  stageHtml: `
    <div class="node" id="list"><div class="nl">📚 Danh sách 100.000 bài</div><div class="ns">không thể trả hết một lần</div></div>
    <div class="arrow" id="a1">↓ ① cách cũ: page &amp; size</div>
    <div class="node" id="offset"><div class="nl">🔢 OFFSET</div><div class="ns">trôi dữ liệu · chậm dần khi offset lớn</div></div>
    <div class="arrow" id="a2">↓ ② cách bền: lấy sau một MỐC</div>
    <div class="node" id="cursor"><div class="nl">🎯 Cursor</div><div class="ns">after: "Y3Vyc29yOjI=" · first: 20</div></div>
    <div class="arrow" id="a3">↓ ③ đóng gói theo chuẩn Connection</div>
    <div class="node" id="conn"><div class="nl">🔗 edges + pageInfo</div><div class="ns">node · cursor · hasNextPage</div></div>
    <div class="arrow" id="a4">↓ ④ client giữ endCursor, xin trang kế</div>
    <div class="node" id="scroll"><div class="nl">♾️ Cuộn vô tận</div><div class="ns">không lặp, không mất bản ghi</div></div>
  `,
  steps: [
    { title: "1 · Offset dễ hiểu nhưng dễ trôi", tab: "offset", highlight: [1, 4], on: ["list", "a1", "offset"],
      desc: "<code>page &amp; size</code> ánh xạ thẳng sang <code>LIMIT/OFFSET</code>. Rất quen thuộc, hiện được 'trang 5/48'. Vấn đề chỉ lộ ra khi dữ liệu thay đổi trong lúc người dùng đang xem." },
    { title: "2 · Bản ghi hiện lại hoặc biến mất", tab: "offset", highlight: [7, 8, 9], on: ["offset"],
      desc: "Có bài mới chèn lên đầu → mọi thứ dịch xuống một ô → sang trang 2 bạn thấy lại P81 vừa đọc. Nếu có bài <em>bị xoá</em> thì ngược lại: một bản ghi trượt qua khe và bạn không bao giờ thấy nó." },
    { title: "3 · Cursor: lấy sau một mốc", tab: "impl", highlight: [1, 2, 3], on: ["a2", "cursor"],
      desc: "Cursor mã hoá <em>khoá sắp xếp</em> của phần tử cuối (ví dụ <code>createdAt|id</code>). Truy vấn thành <code>WHERE (created_at, id) &lt; (…)</code> — dùng được index, không phải đếm bỏ, và không bị ảnh hưởng khi đầu danh sách thay đổi." },
    { title: "4 · Chuẩn Connection", tab: "conn", highlight: [6, 7, 8, 11, 12, 13], on: ["a3", "conn"],
      desc: "<code>edges</code> chứa <code>node</code> (dữ liệu) + <code>cursor</code> (mốc). Tầng <code>edges</code> tưởng thừa nhưng là chỗ đặt dữ liệu <em>về quan hệ</em> — <code>addedAt</code>, <code>role</code>, <code>score</code> — những thứ không thuộc về bản thân node." },
    { title: "5 · pageInfo dẫn đường", tab: "query", highlight: [4, 13, 14, 16], on: ["conn", "a4"],
      desc: "<code>hasNextPage</code> cho biết còn gì phía sau, <code>endCursor</code> là mốc để xin trang kế. Client chỉ cần giữ đúng <code>endCursor</code> — không cần đếm trang, không cần biết tổng số." },
    { title: "6 · Mẹo cài đặt", tab: "impl", highlight: [6, 7, 8, 10, 11, 13, 14], on: ["scroll"],
      desc: "Lấy <code>first + 1</code> phần tử để biết còn trang sau mà không cần <code>COUNT(*)</code>. Và luôn sắp xếp kèm khoá phụ (<code>id</code>) — hai bản ghi trùng <code>created_at</code> mà thứ tự không ổn định thì cursor sẽ nhảy lung tung." }
  ],

  quiz: [
    { q: "Nhược điểm lớn nhất của phân trang kiểu offset/limit trên dữ liệu thay đổi liên tục là gì?", options: [
        "Không hỗ trợ sắp xếp",
        "Bản ghi có thể hiện lại hai lần hoặc biến mất khi có phần tử được thêm/xoá giữa các lần lật trang",
        "Không trả về được tổng số bản ghi",
        "Không dùng được với GraphQL"
      ], correct: 1,
      explanation: "Offset đếm theo vị trí, mà vị trí thì trôi khi danh sách thay đổi. Ngoài ra OFFSET lớn còn chậm vì database phải duyệt bỏ toàn bộ phần đầu." },
    { q: "Cursor thường là gì?", options: [
        "Số thứ tự trang",
        "Chuỗi mờ mã hoá khoá sắp xếp của một phần tử, dùng làm mốc để lấy các phần tử sau nó",
        "ID của người dùng đang đăng nhập",
        "Dấu thời gian của request"
      ], correct: 1,
      explanation: "Cursor trỏ vào một vị trí trong danh sách theo khoá sắp xếp (ví dụ created_at|id). Nhờ vậy truy vấn thành WHERE key < cursor, dùng được index và không bị trôi." },
    { q: "Trong chuẩn Connection, tầng 'edges' để làm gì mà không trả thẳng mảng node?", options: [
        "Để response nhẹ hơn",
        "Vì spec GraphQL bắt buộc",
        "Để có chỗ đặt cursor của từng phần tử và dữ liệu về mối QUAN HỆ (addedAt, role, score) — thứ không thuộc về bản thân node",
        "Để hỗ trợ sắp xếp ngược"
      ], correct: 2,
      explanation: "edge mô tả cạnh nối giữa hai nút trong đồ thị, nên nó là chỗ tự nhiên cho dữ liệu của chính mối quan hệ đó, tách khỏi dữ liệu của node." },
    { q: "Khi nào offset/limit vẫn là lựa chọn hợp lý?", options: [
        "Feed mạng xã hội cuộn vô tận",
        "Danh sách chat realtime",
        "Bảng dữ liệu cho admin có số trang, dữ liệu ít thay đổi",
        "Không bao giờ nên dùng offset"
      ], correct: 2,
      explanation: "Cursor không nhảy thẳng tới trang 37 được. Với bảng admin cần 'trang 5/48' và dữ liệu tương đối tĩnh, offset đơn giản và đủ tốt." }
  ]
});
