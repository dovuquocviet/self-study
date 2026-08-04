window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Ngôn ngữ truy vấn",
  title: "Enum, Interface, Union — khi một field trả về nhiều loại dữ liệu",
  subtitle: "__typename, inline fragment và cách mô hình hoá kết quả tìm kiếm hỗn hợp",

  theory: `
    <p>Đến đây bạn đã mô hình hoá được dữ liệu "thẳng thớm". Nhưng đời thật hay có kiểu:
    <em>ô tìm kiếm trả về lẫn lộn người dùng, bài viết và ảnh</em>. GraphQL có ba công cụ cho việc này.</p>
    <p><strong>Enum</strong> — tập giá trị đóng, đặt tên: <code>enum Role { ADMIN EDITOR VIEWER }</code>.
    Hơn hẳn <code>String</code> ở chỗ server <em>từ chối</em> giá trị ngoài danh sách, IDE tự gợi ý,
    và công cụ sinh ra kiểu enum tương ứng bên client.</p>
    <p><strong>Interface</strong> — "mọi type này đều <em>có chung</em> mấy field sau".
    Ví dụ <code>interface Node { id: ID! }</code> hay <code>interface Media { url: String! }</code>.
    Type nào <code>implements</code> interface thì bắt buộc có đủ các field đó. Client được phép chọn
    thẳng field chung mà không cần biết type cụ thể.</p>
    <p><strong>Union</strong> — "kết quả là <em>một trong</em> mấy type này", và chúng
    <em>không cần</em> có field chung: <code>union SearchResult = User | Post | Photo</code>.
    Vì không có field chung nên client <em>buộc</em> phải tách nhánh theo từng type.</p>
    <p>Cách tách nhánh là <strong>inline fragment</strong>: <code>... on Post { title }</code> —
    "nếu vật này là <code>Post</code> thì lấy thêm <code>title</code>". Kèm theo đó là field ma thuật
    <strong><code>__typename</code></strong>, có ở mọi type, trả về tên type thật lúc chạy — client
    dùng nó để chọn component nào render.</p>
    <div class="callout"><p>💡 Chọn cái nào? Có field chung và muốn client dùng được ngay mà không
    tách nhánh → <strong>interface</strong>. Các type chẳng liên quan gì nhau, chỉ tình cờ xuất hiện
    cùng chỗ → <strong>union</strong>. Union còn rất hợp để mô hình hoá kết quả mutation:
    <code>union LoginResult = LoginSuccess | InvalidCredentials | AccountLocked</code>.</p></div>
  `,

  codeTabs: [
    { id: "sdl", label: "📜 Schema", lines: [
      "enum Role { ADMIN EDITOR VIEWER }   # tập giá trị đóng",
      "",
      "interface Node { id: ID! }          # field CHUNG bắt buộc phải có",
      "",
      "type User implements Node {",
      "  id: ID!",
      "  name: String!",
      "  role: Role!",
      "}",
      "type Post implements Node {",
      "  id: ID!",
      "  title: String!",
      "}",
      "type Photo { url: String! width: Int! }   # không implements gì cả",
      "",
      "union SearchResult = User | Post | Photo  # 'một trong ba'",
      "",
      "type Query {",
      "  node(id: ID!): Node                 # trả về interface",
      "  search(q: String!): [SearchResult!]!",
      "}"
    ]},
    { id: "union", label: "🔀 Query union", lines: [
      "query TimKiem($q: String!) {",
      "  search(q: $q) {",
      "    __typename                  # tên type thật lúc chạy",
      "    ... on User  { id name role }",
      "    ... on Post  { id title }",
      "    ... on Photo { url width }",
      "  }",
      "}",
      "",
      "# Union KHÔNG có field chung -> không thể viết { id } ở ngoài,",
      "# bắt buộc tách nhánh bằng inline fragment như trên."
    ]},
    { id: "iface", label: "🧬 Query interface", lines: [
      "query {",
      "  node(id: \"7\") {",
      "    id                         # field chung -> chọn thẳng được",
      "    ... on User { name role }  # muốn field riêng thì mới tách nhánh",
      "    ... on Post { title }",
      "  }",
      "}",
      "",
      "# Khác biệt so với union: 'id' lấy được mà không cần biết type nào."
    ]},
    { id: "client", label: "🖼️ Client dùng ra sao", lines: [
      "// __typename cho biết vẽ component nào",
      "{ \"data\": { \"search\": [",
      "    { \"__typename\": \"User\", \"id\": \"7\", \"name\": \"An\", \"role\": \"ADMIN\" },",
      "    { \"__typename\": \"Post\", \"id\": \"31\", \"title\": \"Học GraphQL\" },",
      "    { \"__typename\": \"Photo\", \"url\": \"/a.jpg\", \"width\": 800 } ] } }",
      "",
      "function render(item) {",
      "  if (item.__typename === \"User\")  return <TheNguoiDung {...item} />;",
      "  if (item.__typename === \"Post\")  return <TheBaiViet  {...item} />;",
      "  return <TheAnh {...item} />;",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔎 search(q: "graphql")</div><div class="ns">kết quả hỗn hợp nhiều loại</div></div>
    <div class="arrow" id="a1">↓ ① schema khai union SearchResult</div>
    <div class="node" id="union"><div class="nl">🔀 Union</div><div class="ns">User | Post | Photo</div></div>
    <div class="arrow" id="a2">↓ ② client tách nhánh bằng inline fragment</div>
    <div class="node" id="frag"><div class="nl">🧩 ... on Post</div><div class="ns">chọn field riêng cho từng khả năng</div></div>
    <div class="arrow" id="a3">↓ ③ lúc chạy: resolveType xác định type thật</div>
    <div class="node" id="resolve"><div class="nl">🎯 __typename</div><div class="ns">"User" · "Post" · "Photo"</div></div>
    <div class="arrow" id="a4">↓ ④ chỉ nhánh khớp được lấy field</div>
    <div class="node" id="out"><div class="nl">🖼️ Client render</div><div class="ns">switch theo __typename → component</div></div>
  `,
  steps: [
    { title: "1 · Enum thay cho String tự do", tab: "sdl", highlight: [1, 7], on: ["q"],
      desc: "<code>enum Role</code> đóng tập giá trị lại. Truyền <code>role: \"admin\"</code> (viết thường) hay <code>\"BOSS\"</code> đều bị chặn ngay ở bước validate — thay vì lọt xuống database rồi mới sinh chuyện." },
    { title: "2 · Interface gom field chung", tab: "sdl", highlight: [3, 5, 9], on: ["q", "a1"],
      desc: "<code>interface Node { id: ID! }</code>: type nào <code>implements Node</code> cũng buộc phải có <code>id</code>. Đây là nền tảng cho pattern 'lấy bất kỳ object nào theo id' — rất quan trọng cho cache (bài 12)." },
    { title: "3 · Union cho các type không liên quan", tab: "sdl", highlight: [13, 15, 19], on: ["union"],
      desc: "<code>Photo</code> chẳng có <code>id</code> hay điểm chung nào với <code>User</code>, nhưng vẫn xuất hiện trong kết quả tìm kiếm. <code>union</code> mô tả đúng chuyện đó: 'một trong ba', không hứa hẹn field chung nào." },
    { title: "4 · Inline fragment tách nhánh", tab: "union", highlight: [4, 5, 6], on: ["a2", "frag"],
      desc: "<code>... on User { … }</code> nghĩa là 'nếu phần tử này là User thì lấy thêm mấy field sau'. Với union đây là <em>bắt buộc</em>, vì không có field nào chọn chung được." },
    { title: "5 · Interface thì nhẹ hơn", tab: "iface", highlight: [3, 4, 5], on: ["frag"],
      desc: "Với interface, field chung <code>id</code> chọn thẳng ở ngoài, chỉ tách nhánh khi cần field riêng. Đó là khác biệt thực dụng giữa interface và union." },
    { title: "6 · __typename dẫn đường cho client", tab: "client", highlight: [3, 4, 5, 8, 9, 10], on: ["a3", "resolve", "a4", "out"],
      desc: "Lúc chạy, server gọi <code>resolveType</code> để biết vật này thật ra là type nào, rồi chỉ lấy field của nhánh khớp. Client đọc <code>__typename</code> và chọn component tương ứng — không cần đoán qua sự có mặt của field." }
  ],

  quiz: [
    { q: "Khác biệt chính giữa interface và union là gì?", options: [
        "Interface nhanh hơn union",
        "Interface bắt các type phải có field chung nên client chọn thẳng được field đó; union chỉ nói 'một trong các type này' và không hứa field chung nào",
        "Union chỉ dùng được trong mutation",
        "Interface không cần __typename"
      ], correct: 1,
      explanation: "Có field chung và muốn dùng ngay → interface. Các type chẳng liên quan, chỉ tình cờ xuất hiện cùng chỗ → union." },
    { q: "Cú pháp '... on Post { title }' gọi là gì và dùng để làm gì?", options: [
        "Named fragment, để tái sử dụng cụm field",
        "Directive, để bỏ qua field",
        "Inline fragment, để chọn field áp dụng riêng cho một type cụ thể trong interface/union",
        "Alias, để đổi tên field"
      ], correct: 2,
      explanation: "Inline fragment là fragment không tên, gắn ngay tại chỗ. Với union thì bắt buộc dùng nó, vì không có field nào chọn chung được." },
    { q: "__typename là gì?", options: [
        "Một field có ở mọi object type, trả về tên type thật lúc chạy",
        "Một directive đặc biệt",
        "Tên của operation",
        "Một scalar do người dùng định nghĩa"
      ], correct: 0,
      explanation: "__typename luôn có sẵn, không cần khai trong schema. Client dùng nó để chọn component render, và cache dùng nó để tạo khoá định danh bản ghi." },
    { q: "Vì sao nên dùng enum thay vì String cho một trường như 'role'?", options: [
        "Vì enum tiết kiệm băng thông",
        "Vì server từ chối giá trị ngoài danh sách ngay ở bước validate, IDE gợi ý được, và công cụ sinh ra kiểu enum bên client",
        "Vì String không dùng được làm tham số",
        "Vì enum tự động sắp xếp giá trị"
      ], correct: 1,
      explanation: "Enum đóng tập giá trị lại — lỗi kiểu 'admin' viết thường hay 'BOSS' không tồn tại bị chặn từ đầu, thay vì lọt xuống tận database." }
  ]
});
