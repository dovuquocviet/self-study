window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "Schema & Type System — bản hợp đồng của cả hệ thống",
  subtitle: "SDL, scalar, object type, dấu ! và cặp ngoặc vuông",

  theory: `
    <p>Nếu query là <em>gọi món</em> thì <strong>schema</strong> chính là <em>thực đơn</em>: nó liệt kê
    quán có những món gì, mỗi món gồm thành phần nào. Client không được gọi thứ không có trong thực đơn —
    server sẽ từ chối <em>trước khi</em> chạy bất cứ dòng code nào.</p>
    <p>Schema viết bằng <strong>SDL</strong> (Schema Definition Language) — một cú pháp gọn, không phụ
    thuộc ngôn ngữ lập trình:</p>
    <ul>
      <li><strong>Scalar</strong> — kiểu lá, không chia nhỏ được nữa: <code>Int</code>,
      <code>Float</code>, <code>String</code>, <code>Boolean</code>, <code>ID</code>.
      Có thể tự định nghĩa thêm (<code>scalar DateTime</code>).</li>
      <li><strong>Object type</strong> — <code>type User { … }</code>: một "hộp" gồm nhiều field,
      mỗi field lại có kiểu riêng, có thể trỏ sang object type khác → tạo thành <em>đồ thị</em>
      (chữ "Graph" trong GraphQL là ở đây).</li>
      <li><strong>Dấu <code>!</code></strong> = non-null, <em>chắc chắn có</em>.
      <code>String</code> có thể null, <code>String!</code> thì không bao giờ.</li>
      <li><strong>Ngoặc vuông</strong> = danh sách. Đọc từ trong ra ngoài:
      <code>[Post!]!</code> = mảng chắc chắn tồn tại (có thể rỗng), và trong mảng không phần tử nào null.</li>
    </ul>
    <p>Ba type có tên đặc biệt là <strong>điểm vào</strong> (root type) của schema:
    <code>Query</code> (đọc), <code>Mutation</code> (ghi), <code>Subscription</code> (nhận realtime).
    Mọi câu truy vấn đều bắt đầu từ một field của các type này.</p>
    <div class="callout"><p>💡 Schema là <strong>hợp đồng có kiểm chứng tự động</strong>: frontend và
    backend không còn cãi nhau "field này trả về gì". Nhờ nó mà ta có autocomplete trong IDE,
    sinh type TypeScript tự động, và server bắt lỗi query sai ngay lúc validate — chưa tốn một
    truy vấn database nào.</p></div>
  `,

  codeTabs: [
    { id: "sdl", label: "📜 schema.graphql", lines: [
      "# Kiểu lá (scalar) sẵn có: Int, Float, String, Boolean, ID",
      "",
      "type User {",
      "  id: ID!                  # ! = chắc chắn có, không bao giờ null",
      "  name: String!",
      "  bio: String              # không có ! -> có thể null",
      "  posts: [Post!]!          # mảng luôn tồn tại, phần tử không null",
      "}",
      "",
      "type Post {",
      "  id: ID!",
      "  title: String!",
      "  author: User!            # trỏ ngược lại User -> thành đồ thị",
      "}",
      "",
      "type Query {               # điểm vào để ĐỌC",
      "  user(id: ID!): User      # có thể null nếu không tìm thấy",
      "  posts(last: Int = 10): [Post!]!",
      "}"
    ]},
    { id: "nullable", label: "❔ Đọc dấu ! và [ ]", lines: [
      "# Đọc từ trong ra ngoài — 4 tổ hợp hay nhầm:",
      "",
      "[Post]      # mảng có thể null, phần tử cũng có thể null",
      "[Post]!     # mảng CHẮC CHẮN có, nhưng phần tử có thể null",
      "[Post!]     # mảng có thể null, nếu có thì không phần tử nào null",
      "[Post!]!    # mảng chắc chắn có, phần tử chắc chắn không null  <- hay dùng nhất",
      "",
      "# Mảng rỗng [] KHÔNG phải null — vẫn hợp lệ với [Post!]!",
      "",
      "# Mẹo thiết kế: 'danh sách' hầu như luôn nên là [X!]!",
      "# vì 'không có bài nào' diễn đạt bằng [] rõ hơn bằng null."
    ]},
    { id: "introspect", label: "🔍 Introspection", lines: [
      "# Schema tự mô tả chính nó — đây là cách IDE có autocomplete",
      "query {",
      "  __type(name: \"User\") {",
      "    name",
      "    fields { name type { name kind ofType { name } } }",
      "  }",
      "}",
      "",
      "# Kết quả (rút gọn):",
      "{ \"name\": \"User\", \"fields\": [",
      "    { \"name\": \"id\",   \"type\": { \"kind\": \"NON_NULL\" } },",
      "    { \"name\": \"bio\",  \"type\": { \"name\": \"String\" } } ] }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sdl"><div class="nl">📜 Schema (SDL)</div><div class="ns">type User · type Post · type Query</div></div>
    <div class="arrow" id="a1">↓ ① server nạp schema lúc khởi động</div>
    <div class="node" id="typemap"><div class="nl">🗺️ Bản đồ kiểu</div><div class="ns">field nào có kiểu gì · null được không</div></div>
    <div class="arrow" id="a2">↓ ② client gửi query</div>
    <div class="node" id="validate"><div class="nl">✅ Validate</div><div class="ns">field có tồn tại? kiểu tham số đúng?</div></div>
    <div class="arrow" id="a3">↓ ③ hợp lệ mới được chạy</div>
    <div class="node" id="exec"><div class="nl">⚙️ Thực thi</div><div class="ns">gom dữ liệu theo đúng kiểu đã khai</div></div>
    <div class="arrow" id="a4">↓ ④ IDE cũng đọc chính schema này</div>
    <div class="node" id="tools"><div class="nl">🔍 Introspection</div><div class="ns">autocomplete · sinh type TypeScript</div></div>
  `,
  steps: [
    { title: "1 · Khai báo object type", tab: "sdl", highlight: [3, 4, 5, 6, 7, 8], on: ["sdl"],
      desc: "<code>type User</code> là một 'hộp' gồm các field. Mỗi field có kiểu: <code>ID!</code>, <code>String!</code>, hay một type khác. Đây thuần tuý là <em>mô tả</em> — chưa nói gì về việc lấy dữ liệu ở đâu (đó là việc của resolver, bài 8)." },
    { title: "2 · Type trỏ vào nhau thành đồ thị", tab: "sdl", highlight: [7, 12], on: ["sdl", "a1", "typemap"],
      desc: "<code>User.posts</code> trỏ sang <code>Post</code>, mà <code>Post.author</code> lại trỏ ngược về <code>User</code>. Dữ liệu không còn là các bảng rời rạc mà là một <strong>đồ thị</strong> — client tha hồ đi từ nút này sang nút kia trong cùng một query." },
    { title: "3 · Dấu ! và ngoặc vuông", tab: "nullable", highlight: [3, 4, 5, 6], on: ["typemap"],
      desc: "Đọc từ trong ra ngoài. <code>[Post!]!</code>: dấu <code>!</code> bên trong nói phần tử không null, dấu <code>!</code> bên ngoài nói bản thân mảng không null. Chú ý mảng rỗng <code>[]</code> vẫn hợp lệ — 'không có bài nào' khác với 'null'." },
    { title: "4 · Root type Query là điểm vào", tab: "sdl", highlight: [16, 17, 18], on: ["a2", "validate"],
      desc: "<code>type Query</code> là cửa duy nhất để bắt đầu đọc. Field <code>user(id: ID!)</code> nhận tham số bắt buộc; <code>posts(last: Int = 10)</code> có giá trị mặc định nên client có thể bỏ qua." },
    { title: "5 · Validate trước khi chạy", tab: "sdl", highlight: [17], on: ["validate", "a3", "exec"],
      desc: "Client hỏi field <code>emial</code> (gõ sai) hay truyền <code>id: true</code>? Server đối chiếu schema và trả lỗi <em>ngay</em>, chưa hề chạm vào database. Đây là lợi ích lớn nhất của việc có kiểu tĩnh." },
    { title: "6 · Schema tự mô tả chính nó", tab: "introspect", highlight: [2, 3, 4, 5], on: ["a4", "tools"],
      desc: "Nhờ <strong>introspection</strong>, chính GraphQL API kể được nó có type gì, field gì. Đó là lý do IDE gợi ý field khi bạn gõ, và các công cụ sinh sẵn type TypeScript/Kotlin từ schema. (Ở production thường tắt introspection — bài 13.)" }
  ],

  quiz: [
    { q: "Kiểu [Post!]! nghĩa là gì?", options: [
        "Mảng có thể null, phần tử có thể null",
        "Mảng chắc chắn tồn tại (có thể rỗng) và không phần tử nào null",
        "Mảng bắt buộc phải có ít nhất một phần tử",
        "Một Post duy nhất, không được null"
      ], correct: 1,
      explanation: "Dấu ! trong ngoặc áp cho phần tử, dấu ! ngoài ngoặc áp cho chính mảng. Mảng rỗng [] vẫn hợp lệ — non-null không có nghĩa là non-empty." },
    { q: "Ba root type (điểm vào) của một GraphQL schema là gì?", options: [
        "Get, Post, Put",
        "Query, Mutation, Subscription",
        "Read, Write, Stream",
        "Schema, Type, Field"
      ], correct: 1,
      explanation: "Query để đọc, Mutation để ghi, Subscription để nhận dữ liệu realtime. Mọi câu truy vấn đều bắt đầu từ một field thuộc các type này." },
    { q: "Nếu client hỏi một field không có trong schema thì chuyện gì xảy ra?", options: [
        "Server trả về null cho field đó",
        "Server bỏ qua field và trả các field còn lại",
        "Server từ chối ngay ở bước validate, chưa chạy resolver hay truy vấn database nào",
        "Server trả về HTTP 404"
      ], correct: 2,
      explanation: "Query được validate với schema trước khi thực thi. Query sai bị chặn từ đầu — đó là giá trị của việc có type system." },
    { q: "Introspection là gì?", options: [
        "Cơ chế để schema tự mô tả các type và field của chính nó, giúp IDE autocomplete và sinh type tự động",
        "Một công cụ đo hiệu năng của resolver",
        "Cách GraphQL nén response",
        "Tính năng ghi log mọi query"
      ], correct: 0,
      explanation: "Truy vấn __schema / __type cho biết API có gì. Rất tiện lúc phát triển, nhưng thường bị tắt ở production vì nó phơi bày toàn bộ bề mặt API." }
  ]
});
