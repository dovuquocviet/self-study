window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Bên trong server",
  title: "Resolver — mỗi field là một hàm nhỏ",
  subtitle: "parent · args · context · info, và cây resolver chạy theo chiều sâu",

  theory: `
    <p>Schema chỉ nói dữ liệu <em>trông như thế nào</em>. Ai đi lấy dữ liệu thật? <strong>Resolver</strong> —
    một hàm gắn với <em>một field</em>. Đây là ý tưởng trung tâm của GraphQL server, và cũng là chỗ
    nhiều người vỡ ra "à, hoá ra đơn giản vậy thôi".</p>
    <p>Server đi <strong>từng field một</strong> trong query, gọi resolver tương ứng, lấy kết quả rồi
    <em>truyền xuống</em> làm <code>parent</code> cho các field con. Cứ thế theo chiều sâu cho tới khi
    chạm scalar thì dừng.</p>
    <p>Mỗi resolver nhận đúng 4 tham số:</p>
    <ul>
      <li><strong>parent</strong> — giá trị mà resolver tầng trên trả về. Ở tầng gốc thì là
      <code>undefined</code>/root value.</li>
      <li><strong>args</strong> — tham số client truyền cho <em>chính field này</em>:
      <code>{ id: "7" }</code>.</li>
      <li><strong>context</strong> — đồ dùng chung cho cả request: user đã đăng nhập, kết nối DB,
      DataLoader (bài 9). Được tạo <em>mới cho mỗi request</em>.</li>
      <li><strong>info</strong> — siêu dữ liệu về query đang chạy (AST, đường dẫn field, các field con
      đang được hỏi). Ít dùng, nhưng là chìa khoá cho vài kỹ thuật tối ưu.</li>
    </ul>
    <p>Có một luật quan trọng: <strong>resolver mặc định</strong>. Nếu bạn không viết resolver cho
    field <code>title</code>, server tự làm việc hiển nhiên — lấy <code>parent.title</code>. Vì thế
    thực tế bạn chỉ viết resolver cho những field cần đi lấy dữ liệu ở nơi khác.</p>
    <div class="callout"><p>💡 Hệ quả rất đáng nhớ: các field <em>anh em</em> ở cùng một tầng chạy
    <strong>song song</strong>, còn field <em>cha–con</em> chạy <strong>nối tiếp</strong> (con phải chờ
    cha trả về mới có <code>parent</code>). Đây chính là mầm mống của bài toán N+1 ở bài sau.</p></div>
  `,

  codeTabs: [
    { id: "map", label: "🗺️ Resolver map", lines: [
      "const resolvers = {",
      "  Query: {",
      "    // (parent, args, context, info)",
      "    user: (_, args, ctx) => ctx.db.user.findById(args.id),",
      "    posts: (_, args, ctx) => ctx.db.post.recent(args.last)",
      "  },",
      "  User: {",
      "    // parent chính là object User mà resolver trên trả về",
      "    posts: (user, _, ctx) => ctx.db.post.findByAuthor(user.id),",
      "    // fullName không có trong DB -> tính tại chỗ",
      "    fullName: (user) => user.firstName + \" \" + user.lastName",
      "    // name, bio… KHÔNG cần viết: resolver mặc định lấy parent.name",
      "  },",
      "  Post: {",
      "    author: (post, _, ctx) => ctx.db.user.findById(post.authorId)",
      "  }",
      "};"
    ]},
    { id: "ctx", label: "🎒 Context", lines: [
      "// context được tạo MỚI cho mỗi request — không dùng chung giữa các user",
      "const server = new ApolloServer({ typeDefs, resolvers });",
      "",
      "await startStandaloneServer(server, {",
      "  context: async ({ req }) => ({",
      "    user: await xacThuc(req.headers.authorization),  // ai đang gọi",
      "    db: db,                                          // kết nối DB",
      "    loaders: taoDataLoaders(db)                      // bài 9",
      "  })",
      "});",
      "",
      "// Trong resolver: kiểm tra quyền bằng ctx.user",
      "// deletePost: (_, args, ctx) => {",
      "//   if (!ctx.user) throw new GraphQLError(\"Chưa đăng nhập\");",
      "// }"
    ]},
    { id: "trace", label: "🔎 Thứ tự chạy", lines: [
      "query { user(id: 7) { name posts { title author { name } } } }",
      "",
      "1. Query.user(parent=undefined, args={id:7})   -> { id:7, name:'An' }",
      "2.   User.name        parent={id:7,…}          -> 'An'      (mặc định)",
      "3.   User.posts       parent={id:7,…}          -> [P11, P12]",
      "4.     Post.title     parent=P11               -> 'Học GraphQL'",
      "5.     Post.author    parent=P11               -> { id:7 }",
      "6.       User.name    parent={id:7}            -> 'An'",
      "7.     Post.title     parent=P12               -> 'Schema là gì'",
      "8.     Post.author    parent=P12               -> { id:9 }",
      "",
      "# Bước 2 và 3 chạy SONG SONG (anh em cùng tầng).",
      "# Bước 4 phải chờ bước 3 xong (cần parent)."
    ]},
    { id: "default", label: "⚙️ Resolver mặc định", lines: [
      "// Nếu bạn không viết gì cho field 'title', server dùng cái này:",
      "const defaultResolver = (parent, args, ctx, info) => {",
      "  const value = parent[info.fieldName];",
      "  return typeof value === \"function\" ? value(args, ctx) : value;",
      "};",
      "",
      "// Vì vậy: chỉ viết resolver cho field cần ĐI LẤY dữ liệu nơi khác",
      "// hoặc cần TÍNH TOÁN. Field ánh xạ 1-1 với cột DB thì để trống."
    ]}
  ],

  stageHtml: `
    <div class="node" id="query"><div class="nl">💠 Query</div><div class="ns">user → name · posts → title · author</div></div>
    <div class="arrow" id="a1">↓ ① gọi Query.user(args)</div>
    <div class="node" id="r1"><div class="nl">🔧 Query.user</div><div class="ns">trả về object User</div></div>
    <div class="arrow" id="a2">↓ ② object đó thành parent của tầng dưới</div>
    <div class="node" id="r2"><div class="nl">🔧 User.name · User.posts</div><div class="ns">hai anh em — chạy song song</div></div>
    <div class="arrow" id="a3">↓ ③ mỗi Post lại là parent mới</div>
    <div class="node" id="r3"><div class="nl">🔧 Post.title · Post.author</div><div class="ns">lặp cho từng phần tử trong mảng</div></div>
    <div class="arrow" id="a4">↓ ④ chạm scalar thì dừng, ghép ngược lên</div>
    <div class="node" id="out"><div class="nl">📦 data</div><div class="ns">cây kết quả đúng hình dạng query</div></div>
  `,
  steps: [
    { title: "1 · Resolver là hàm gắn với field", tab: "map", highlight: [1, 2, 4], on: ["query", "a1", "r1"],
      desc: "<code>Query.user</code> nhận <code>args.id</code> rồi đi hỏi database. Nó chỉ biết một việc duy nhất: trả về một object User. Không quan tâm client sẽ chọn field nào bên trong." },
    { title: "2 · Kết quả trở thành parent", tab: "map", highlight: [7, 9], on: ["r1", "a2", "r2"],
      desc: "Object User vừa trả về được truyền xuống làm <code>parent</code> cho <code>User.posts</code>. Nhờ đó resolver con biết cần lấy bài viết của <em>ai</em> — <code>user.id</code>." },
    { title: "3 · Không viết resolver cũng chạy", tab: "default", highlight: [2, 3, 4, 5], on: ["r2"],
      desc: "Field <code>name</code> không có trong resolver map, nhưng vẫn ra kết quả: resolver mặc định lấy <code>parent[fieldName]</code>. Thực tế bạn chỉ viết resolver cho field cần đi lấy nơi khác hoặc cần tính toán." },
    { title: "4 · Context — đồ dùng chung mỗi request", tab: "ctx", highlight: [5, 6, 7, 8], on: ["r2"],
      desc: "<code>context</code> tạo mới cho <em>từng</em> request: user đã xác thực, kết nối DB, các DataLoader. Mọi resolver trong request đều thấy nó — đây là chỗ đặt thông tin auth để kiểm quyền (bài 13)." },
    { title: "5 · Đi sâu vào mảng", tab: "trace", highlight: [5, 6, 7, 8, 9], on: ["a3", "r3"],
      desc: "<code>User.posts</code> trả mảng 2 phần tử → resolver <code>Post.title</code> và <code>Post.author</code> chạy <em>một lần cho mỗi phần tử</em>. Hãy để ý con số này: 2 bài viết là 2 lần gọi <code>Post.author</code>…" },
    { title: "6 · Song song vs nối tiếp", tab: "trace", highlight: [12, 13], on: ["a4", "out"],
      desc: "Anh em cùng tầng chạy song song; cha–con phải nối tiếp vì con cần <code>parent</code>. Chính cái 'một lần gọi cho mỗi phần tử' ở bước trước sẽ đẻ ra bài toán <strong>N+1</strong> — nội dung bài 9." }
  ],

  quiz: [
    { q: "Bốn tham số của một resolver là gì?", options: [
        "request, response, next, error",
        "parent, args, context, info",
        "query, variables, schema, result",
        "id, fields, filter, sort"
      ], correct: 1,
      explanation: "parent = kết quả tầng trên, args = tham số của chính field này, context = đồ dùng chung cho request, info = siêu dữ liệu về query đang chạy." },
    { q: "Nếu bạn không viết resolver cho field 'title' của Post thì sao?", options: [
        "Server báo lỗi thiếu resolver",
        "Field luôn trả về null",
        "Resolver mặc định chạy, lấy parent.title",
        "Query bị từ chối ở bước validate"
      ], correct: 2,
      explanation: "Resolver mặc định lấy parent[fieldName]. Nhờ vậy bạn chỉ cần viết resolver cho field phải đi lấy dữ liệu nơi khác hoặc cần tính toán." },
    { q: "Vì sao context nên được tạo mới cho mỗi request?", options: [
        "Để tiết kiệm bộ nhớ",
        "Vì nó chứa thông tin riêng của request đó (user đã đăng nhập, DataLoader theo request) — dùng chung sẽ rò dữ liệu giữa các người dùng",
        "Vì GraphQL không cho phép biến toàn cục",
        "Vì context phải khớp với schema"
      ], correct: 1,
      explanation: "Dùng chung context giữa các request là lỗi bảo mật nghiêm trọng (user A thấy dữ liệu user B) và làm cache của DataLoader trở nên sai." },
    { q: "Các field anh em cùng một tầng chạy thế nào?", options: [
        "Song song — chúng không phụ thuộc nhau",
        "Tuần tự từ trên xuống, luôn luôn",
        "Ngẫu nhiên do server quyết định",
        "Chỉ chạy sau khi mọi field con đã xong"
      ], correct: 0,
      explanation: "Field anh em chạy song song; field cha–con phải nối tiếp vì con cần parent từ cha. Riêng field gốc của Mutation là ngoại lệ — luôn tuần tự (bài 5)." }
  ]
});
