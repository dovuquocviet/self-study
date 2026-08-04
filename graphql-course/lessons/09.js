window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Bên trong server",
  title: "Bài toán N+1 và DataLoader — gom nhiều truy vấn thành một",
  subtitle: "Vì sao một query đẹp đẽ lại nện 101 câu SQL, và cách chữa",

  theory: `
    <p>Đây là <strong>lỗi hiệu năng phổ biến nhất</strong> của GraphQL server, và cũng là điều phân
    biệt người mới với người đã làm thật.</p>
    <p>Nhớ lại bài 8: resolver chạy <em>một lần cho mỗi phần tử</em> của mảng. Vậy query
    "lấy 100 bài viết, mỗi bài kèm tên tác giả" sẽ chạy:</p>
    <ul>
      <li>1 câu truy vấn lấy 100 bài viết,</li>
      <li>rồi <strong>100</strong> câu truy vấn <code>SELECT * FROM users WHERE id = ?</code> — mỗi bài một câu.</li>
    </ul>
    <p>Tổng <strong>101</strong> câu. Đó là <strong>N+1</strong>. Tệ hơn: nếu 100 bài đó chỉ do 3 tác giả
    viết, ta hỏi database về cùng một người tới mấy chục lần.</p>
    <p>Cách chữa là <strong>DataLoader</strong> — một lớp mỏng đặt trước nguồn dữ liệu, làm hai việc:</p>
    <ul>
      <li><strong>Batching</strong> — thay vì bắn ngay, nó <em>gom</em> mọi lời gọi
      <code>load(id)</code> xảy ra trong cùng một "nhịp" (tick của event loop) thành một danh sách,
      rồi gọi hàm <code>batchFn([id1, id2, …])</code> đúng <em>một lần</em>:
      <code>WHERE id IN (…)</code>.</li>
      <li><strong>Caching</strong> — trong <em>cùng một request</em>, gọi <code>load(7)</code> mười lần
      chỉ đi hỏi database một lần.</li>
    </ul>
    <p>Hai luật sống còn khi viết <code>batchFn</code>: kết quả phải trả về
    <strong>đúng thứ tự</strong> và <strong>đúng số lượng</strong> với mảng khoá đầu vào
    (không tìm thấy thì để <code>null</code>) — vì DataLoader ghép kết quả về từng lời gọi
    theo <em>vị trí</em>.</p>
    <div class="callout"><p>⚠️ <strong>Tạo DataLoader mới cho MỖI request</strong>, đặt trong
    <code>context</code>. Dùng chung một loader toàn cục nghĩa là cache sống mãi: người dùng B sẽ
    thấy dữ liệu cũ mà người dùng A vừa nạp — vừa sai vừa hở bảo mật.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "🐌 N+1", lines: [
      "// Resolver ngây thơ — mỗi Post gọi database một lần",
      "const resolvers = {",
      "  Query: { posts: (_, __, ctx) => ctx.db.post.recent(100) },",
      "  Post: {",
      "    author: (post, _, ctx) => ctx.db.user.findById(post.authorId)",
      "  }",
      "};",
      "",
      "# Log SQL khi client hỏi: query { posts { title author { name } } }",
      "SELECT * FROM posts ORDER BY created_at DESC LIMIT 100;   -- 1",
      "SELECT * FROM users WHERE id = 7;                         -- 2",
      "SELECT * FROM users WHERE id = 9;                         -- 3",
      "SELECT * FROM users WHERE id = 7;   -- lại hỏi id 7!      -- 4",
      "…                                                         -- tới 101"
    ]},
    { id: "loader", label: "🚚 DataLoader", lines: [
      "// batchFn nhận MẢNG khoá, trả MẢNG kết quả cùng thứ tự, cùng độ dài",
      "function taoUserLoader(db) {",
      "  return new DataLoader(async (ids) => {",
      "    const rows = await db.query(",
      "      \"SELECT * FROM users WHERE id = ANY($1)\", [ids]);",
      "",
      "    const theoId = new Map(rows.map((r) => [String(r.id), r]));",
      "    // GIỮ ĐÚNG THỨ TỰ + ĐỦ SỐ LƯỢNG, thiếu thì null",
      "    return ids.map((id) => theoId.get(String(id)) || null);",
      "  });",
      "}"
    ]},
    { id: "use", label: "✅ Dùng trong resolver", lines: [
      "// 1. Tạo loader MỚI cho mỗi request, nhét vào context",
      "context: async ({ req }) => ({",
      "  db,",
      "  loaders: { user: taoUserLoader(db) }   // mới toanh mỗi request",
      "}),",
      "",
      "// 2. Resolver gọi load() thay vì đi thẳng vào DB",
      "Post: {",
      "  author: (post, _, ctx) => ctx.loaders.user.load(post.authorId)",
      "}",
      "",
      "# SQL giờ chỉ còn 2 câu:",
      "SELECT * FROM posts … LIMIT 100;",
      "SELECT * FROM users WHERE id = ANY('{7,9,12}');   -- gom + khử trùng"
    ]},
    { id: "note", label: "⚠️ Bẫy thường gặp", lines: [
      "# 1. Loader toàn cục -> cache sống mãi -> rò dữ liệu giữa các user.",
      "#    Luôn tạo mới trong context của từng request.",
      "",
      "# 2. batchFn trả sai thứ tự -> author của bài A gắn nhầm sang bài B.",
      "#    Luôn map lại theo mảng ids đầu vào.",
      "",
      "# 3. batchFn trả thiếu phần tử -> DataLoader ném lỗi.",
      "#    Không tìm thấy thì trả null, đừng bỏ qua.",
      "",
      "# 4. DataLoader không chữa được 'lấy danh sách con cho mỗi cha'",
      "#    một cách tự nhiên -> dùng batch theo khoá cha:",
      "#    SELECT * FROM posts WHERE author_id = ANY(…) rồi tự nhóm lại."
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">💠 query { posts { author { name } } }</div><div class="ns">100 bài viết</div></div>
    <div class="arrow" id="a1">↓ ① một truy vấn lấy 100 posts</div>
    <div class="node" id="posts"><div class="nl">📄 100 Post</div><div class="ns">mỗi bài có authorId</div></div>
    <div class="arrow" id="a2">↓ ② resolver author chạy 100 lần</div>
    <div class="node" id="naive"><div class="nl">🐌 100 câu SQL</div><div class="ns">N+1 — hỏi trùng cả người đã hỏi</div></div>
    <div class="arrow" id="a3">↓ ③ đặt DataLoader vào giữa</div>
    <div class="node" id="loader"><div class="nl">🚚 DataLoader</div><div class="ns">gom khoá trong cùng một nhịp · khử trùng</div></div>
    <div class="arrow" id="a4">↓ ④ WHERE id IN (7, 9, 12)</div>
    <div class="node" id="one"><div class="nl">⚡ 1 câu SQL</div><div class="ns">rồi phát kết quả về đúng từng lời gọi</div></div>
  `,
  steps: [
    { title: "1 · Query trông rất vô hại", tab: "bad", highlight: [9], on: ["q", "a1", "posts"],
      desc: "<code>query { posts { title author { name } } }</code> — ngắn, đẹp, client viết trong 5 giây. Nhưng cái giá phải trả nằm ở phía server và client không hề thấy." },
    { title: "2 · Resolver chạy một lần mỗi phần tử", tab: "bad", highlight: [4, 5, 6], on: ["posts", "a2"],
      desc: "<code>Post.author</code> được gọi cho <em>từng</em> bài trong 100 bài. Mỗi lần lại một câu <code>findById</code>. Đây không phải lỗi của bạn viết code cẩu thả — đó là cách cây resolver vận hành." },
    { title: "3 · 101 câu SQL, có câu hỏi trùng", tab: "bad", highlight: [10, 11, 12, 13, 14], on: ["naive"],
      desc: "1 + 100 = 101. Để ý dòng thứ tư: hỏi lại <code>id = 7</code> vì hai bài cùng một tác giả. Database thì rảnh đâu mà nhớ giùm bạn." },
    { title: "4 · DataLoader gom khoá", tab: "loader", highlight: [3, 4, 5], on: ["a3", "loader"],
      desc: "<code>load(id)</code> không bắn ngay mà xếp hàng. Hết một nhịp event loop, DataLoader gom tất cả khoá đã gom được, khử trùng lặp, rồi gọi <code>batchFn</code> đúng một lần với cả mảng." },
    { title: "5 · Trả đúng thứ tự, đúng số lượng", tab: "loader", highlight: [7, 8, 9], on: ["loader"],
      desc: "Luật sống còn: mảng trả về phải cùng độ dài và cùng thứ tự với mảng <code>ids</code>. DataLoader phát kết quả về từng lời gọi <em>theo vị trí</em> — sai thứ tự là tác giả gắn nhầm bài, một bug im lặng và rất khó lần." },
    { title: "6 · Loader phải mới mỗi request", tab: "use", highlight: [2, 3, 4, 8, 9, 13, 14], on: ["a4", "one"],
      desc: "Tạo trong <code>context</code> nên loader (và cache của nó) sống đúng bằng một request. 101 câu SQL còn 2. Nếu để loader toàn cục, người dùng B sẽ đọc phải dữ liệu cache của người dùng A." }
  ],

  quiz: [
    { q: "Bài toán N+1 trong GraphQL phát sinh từ đâu?", options: [
        "Từ việc client gửi quá nhiều query cùng lúc",
        "Từ việc resolver của field con chạy một lần cho mỗi phần tử của mảng cha, mỗi lần lại đi hỏi nguồn dữ liệu",
        "Từ việc schema có quá nhiều type",
        "Từ việc GraphQL không hỗ trợ JOIN"
      ], correct: 1,
      explanation: "1 truy vấn lấy N phần tử, rồi N truy vấn cho field con của từng phần tử = N+1. Đây là hệ quả tự nhiên của cách cây resolver chạy." },
    { q: "DataLoader làm hai việc gì?", options: [
        "Nén dữ liệu và mã hoá dữ liệu",
        "Batching (gom nhiều lời gọi trong cùng một nhịp thành một truy vấn) và caching (trong phạm vi một request)",
        "Phân trang và sắp xếp",
        "Kiểm tra quyền và ghi log"
      ], correct: 1,
      explanation: "Batch để giảm số truy vấn, cache để không hỏi trùng cùng một khoá trong cùng request." },
    { q: "batchFn nhận vào [7, 9, 7, 12] nhưng database chỉ tìm thấy 7 và 9. batchFn phải trả về gì?", options: [
        "[user7, user9] — chỉ những cái tìm thấy",
        "Một mảng cùng độ dài và cùng thứ tự với khoá đầu vào, phần tử không tìm thấy để null",
        "Một object map từ id sang user",
        "Ném lỗi vì thiếu dữ liệu"
      ], correct: 1,
      explanation: "DataLoader ghép kết quả về từng lời gọi theo vị trí. Trả thiếu phần tử sẽ gây lỗi; trả sai thứ tự sẽ gắn nhầm dữ liệu — bug im lặng rất khó lần." },
    { q: "Vì sao phải tạo DataLoader mới cho mỗi request thay vì dùng một instance toàn cục?", options: [
        "Vì DataLoader không hỗ trợ nhiều luồng",
        "Vì cache của loader toàn cục sẽ sống mãi, khiến người dùng này đọc phải dữ liệu cũ hoặc dữ liệu của người dùng khác",
        "Vì tạo mới nhanh hơn",
        "Vì spec GraphQL yêu cầu"
      ], correct: 1,
      explanation: "Cache của DataLoader cố ý chỉ đúng trong phạm vi một request. Chia sẻ toàn cục vừa trả dữ liệu cũ vừa là lỗ hổng rò dữ liệu giữa các user." }
  ]
});
