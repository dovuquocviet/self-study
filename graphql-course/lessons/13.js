window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Thực chiến",
  title: "Bảo mật & vận hành — khi client được quyền hỏi bất cứ thứ gì",
  subtitle: "Auth trong resolver, giới hạn độ sâu & độ phức tạp, timeout, persisted query",

  theory: `
    <p>Sức mạnh "client tự mô tả thứ mình cần" cũng chính là bề mặt tấn công. Với REST, mỗi endpoint
    có hình dạng cố định nên chi phí xử lý đoán được. Với GraphQL, <em>một</em> câu query có thể
    nặng gấp mười nghìn lần câu bên cạnh.</p>
    <p><strong>1. Phân quyền đặt ở đâu?</strong> Không phải ở tầng HTTP (chỉ có một endpoint, chẳng
    phân biệt được gì) mà ở <strong>tầng nghiệp vụ</strong> — resolver đọc <code>context.user</code>
    và tự kiểm tra. Nếu chỉ chặn ở <code>Query.user</code> mà quên <code>Post.author</code>,
    kẻ tấn công vẫn đi vòng qua bài viết để lấy được email của người khác.</p>
    <p><strong>2. Query lồng vô hạn.</strong> Schema có vòng lặp (<code>User.posts.author.posts…</code>)
    thì kẻ tấn công viết một query sâu 30 tầng là server tự đánh gục chính mình. Hai lá chắn:
    <em>giới hạn độ sâu</em> (depth limit) và <em>giới hạn độ phức tạp</em> (mỗi field có "điểm",
    field trả danh sách nhân theo <code>first</code>; vượt ngưỡng thì từ chối
    <strong>trước khi</strong> chạy).</p>
    <p><strong>3. Tắt introspection ở production</strong> — hoặc ít nhất khoá lại sau đăng nhập.
    Bật thì bất kỳ ai cũng tải nguyên bản đồ API của bạn về. Kèm theo: tắt trang GraphiQL công khai,
    và tắt gợi ý <em>"Did you mean 'email'?"</em> — nó vô tình tiết lộ field ẩn.</p>
    <p><strong>4. Persisted query</strong> — server chỉ chấp nhận các query đã được duyệt trước
    (client gửi mã băm SHA-256 thay vì cả chuỗi). Vừa chặn query lạ tận gốc, vừa giảm dung lượng
    gửi lên. Đây là lá chắn mạnh nhất cho API chỉ phục vụ app của chính mình.</p>
    <p><strong>5. Đừng quên những thứ tầm thường:</strong> timeout cho mỗi resolver, giới hạn số
    request (rate limit) tính theo <em>độ phức tạp</em> chứ không theo số request, giới hạn kích thước
    body, và chặn <code>alias</code> nhân bản (gọi cùng một field nặng 1000 lần với 1000 alias khác nhau).</p>
    <div class="callout"><p>⚠️ Sai lầm kinh điển: nghĩ rằng đặt API sau cổng đăng nhập là xong.
    Người dùng <em>đã đăng nhập</em> vẫn có thể (vô tình hay cố ý) gửi một query đủ sức làm nghẽn
    database. Giới hạn độ phức tạp là bắt buộc, không phải tuỳ chọn.</p></div>
  `,

  codeTabs: [
    { id: "authz", label: "🔐 Phân quyền", lines: [
      "// SAI: chỉ chặn ở một cửa",
      "Query: {",
      "  user: (_, a, ctx) => {",
      "    if (!ctx.user) throw new GraphQLError(\"Chưa đăng nhập\");",
      "    return ctx.db.user.findById(a.id);",
      "  }",
      "}",
      "// -> kẻ tấn công đi vòng: { posts { author { email } } }",
      "",
      "// ĐÚNG: kiểm tra ở chính field nhạy cảm, ở MỌI lối vào",
      "User: {",
      "  email: (user, _, ctx) => {",
      "    const laChuTai = ctx.user && ctx.user.id === user.id;",
      "    if (!laChuTai && !ctx.user.laAdmin) return null;",
      "    return user.email;",
      "  }",
      "}"
    ]},
    { id: "depth", label: "🕳️ Độ sâu & phức tạp", lines: [
      "# Query độc: schema có vòng lặp -> lồng bao nhiêu tầng cũng được",
      "query {",
      "  user(id: 1) { posts { author { posts { author {",
      "    posts { author { name } } } } } } }",
      "}",
      "",
      "// Lá chắn 1 — giới hạn độ sâu",
      "validationRules: [ depthLimit(10) ]",
      "",
      "// Lá chắn 2 — giới hạn độ phức tạp (chính xác hơn)",
      "//   mỗi field 1 điểm; field trả danh sách nhân với 'first'",
      "//   posts(first: 100) { comments(first: 100) { … } } = 10.000 điểm",
      "createComplexityRule({ maximumComplexity: 1000,",
      "  onComplete: (d) => log.info(\"complexity\", d) })",
      "",
      "# Cả hai đều chặn ở bước VALIDATE — chưa tốn truy vấn nào."
    ]},
    { id: "prod", label: "🏭 Cấu hình production", lines: [
      "new ApolloServer({",
      "  typeDefs, resolvers,",
      "  introspection: false,            // giấu bản đồ API",
      "  includeStacktraceInErrorResponses: false,  // đừng lộ đường dẫn file",
      "  validationRules: [depthLimit(10), complexityRule],",
      "  formatError: (err) => ({         // che chi tiết nội bộ",
      "    message: err.extensions?.code === \"INTERNAL_SERVER_ERROR\"",
      "      ? \"Có lỗi xảy ra\" : err.message,",
      "    extensions: { code: err.extensions?.code,",
      "                  traceId: err.extensions?.traceId }",
      "  })",
      "});",
      "",
      "# Nhớ tắt luôn: trang GraphiQL công khai, gợi ý 'Did you mean …?'"
    ]},
    { id: "persist", label: "📌 Persisted query", lines: [
      "# Client gửi mã băm thay vì cả chuỗi query:",
      "POST /graphql",
      "{ \"variables\": { \"id\": \"7\" },",
      "  \"extensions\": { \"persistedQuery\": {",
      "      \"version\": 1,",
      "      \"sha256Hash\": \"ec2e01311ab3b02f3d8c8c712f9…\" } } }",
      "",
      "# Server tra mã băm trong danh sách query đã duyệt lúc build.",
      "# Không có trong danh sách -> từ chối thẳng.",
      "",
      "# Được hai thứ:",
      "#  - chặn mọi query lạ ngay từ cửa (allowlist thật sự)",
      "#  - body gửi lên nhỏ hơn nhiều, đỡ tốn băng thông mobile"
    ]}
  ],

  stageHtml: `
    <div class="node" id="atk"><div class="nl">🎯 Query gửi lên</div><div class="ns">có thể lành, có thể độc</div></div>
    <div class="arrow" id="a1">↓ ① mã băm có trong allowlist?</div>
    <div class="node" id="persist"><div class="nl">📌 Persisted query</div><div class="ns">query lạ bị chặn ngay tại cửa</div></div>
    <div class="arrow" id="a2">↓ ② đếm độ sâu &amp; độ phức tạp</div>
    <div class="node" id="limit"><div class="nl">📏 Depth / complexity</div><div class="ns">vượt ngưỡng → từ chối trước khi chạy</div></div>
    <div class="arrow" id="a3">↓ ③ vào thực thi, mỗi field tự kiểm quyền</div>
    <div class="node" id="authz"><div class="nl">🔐 Resolver kiểm ctx.user</div><div class="ns">ở MỌI lối vào, không chỉ cửa chính</div></div>
    <div class="arrow" id="a4">↓ ④ lỗi được che chi tiết nội bộ</div>
    <div class="node" id="out"><div class="nl">🛡️ Response an toàn</div><div class="ns">không lộ schema, không lộ stack trace</div></div>
  `,
  steps: [
    { title: "1 · Chặn ở cửa chính là chưa đủ", tab: "authz", highlight: [2, 3, 4, 8], on: ["atk"],
      desc: "Kiểm quyền ở <code>Query.user</code> rồi yên tâm? Kẻ tấn công đi đường vòng: <code>{ posts { author { email } } }</code> — vẫn tới được <code>User.email</code> mà không đi qua cửa bạn canh." },
    { title: "2 · Kiểm quyền tại chính field nhạy cảm", tab: "authz", highlight: [11, 12, 13, 14, 15], on: ["a3", "authz"],
      desc: "Đặt kiểm tra ngay tại <code>User.email</code>: mọi lối đi tới field này đều phải qua đó. Trong GraphQL, phân quyền thuộc về <em>field</em>, không thuộc về endpoint." },
    { title: "3 · Query lồng vô hạn", tab: "depth", highlight: [2, 3, 4], on: ["atk", "a2"],
      desc: "Schema có vòng lặp <code>User → posts → author → posts…</code> nên một query sâu 30 tầng là hoàn toàn hợp lệ về cú pháp — và đủ sức làm nghẽn cả database." },
    { title: "4 · Đếm độ sâu và độ phức tạp", tab: "depth", highlight: [7, 8, 11, 12, 13, 14], on: ["limit"],
      desc: "Depth limit đơn giản nhưng thô. Complexity chính xác hơn: mỗi field một điểm, field danh sách nhân với <code>first</code> — <code>posts(first:100){comments(first:100)}</code> ra 10.000 điểm và bị chặn <em>trước khi</em> chạy." },
    { title: "5 · Persisted query — allowlist thật sự", tab: "persist", highlight: [3, 4, 5, 6, 8, 9], on: ["a1", "persist"],
      desc: "Client gửi mã băm của query đã được duyệt lúc build. Không có trong danh sách thì từ chối. Với API chỉ phục vụ app của chính mình, đây là lá chắn mạnh nhất — và còn giảm dung lượng gửi lên." },
    { title: "6 · Cấu hình production", tab: "prod", highlight: [3, 4, 5, 6, 7, 8], on: ["a4", "out"],
      desc: "Tắt introspection (giấu bản đồ API), tắt stack trace, che chi tiết lỗi nội bộ nhưng vẫn giữ <code>traceId</code> để tra log. Và tắt luôn gợi ý <em>'Did you mean …?'</em> — nó vô tình tiết lộ tên field ẩn." }
  ],

  quiz: [
    { q: "Vì sao phân quyền trong GraphQL nên đặt ở tầng resolver/field thay vì tầng HTTP?", options: [
        "Vì HTTP không hỗ trợ header xác thực",
        "Vì chỉ có một endpoint duy nhất, và cùng một field nhạy cảm có thể tới được qua nhiều đường đi khác nhau trong đồ thị",
        "Vì resolver chạy nhanh hơn middleware",
        "Vì GraphQL không dùng HTTP"
      ], correct: 1,
      explanation: "Chặn Query.user nhưng quên User.email thì kẻ tấn công vẫn lấy được email qua { posts { author { email } } }. Quyền thuộc về field, không thuộc về endpoint." },
    { q: "Giới hạn độ phức tạp (complexity) hơn giới hạn độ sâu (depth) ở điểm nào?", options: [
        "Nó chạy nhanh hơn",
        "Nó tính cả số lượng phần tử được yêu cầu (first: 100) chứ không chỉ đếm số tầng lồng nhau",
        "Nó không cần cấu hình",
        "Nó thay thế được việc phân quyền"
      ], correct: 1,
      explanation: "Một query chỉ sâu 3 tầng nhưng posts(first:1000){comments(first:1000)} vẫn cực nặng — depth limit không bắt được, complexity thì có." },
    { q: "Persisted query hoạt động thế nào?", options: [
        "Server lưu kết quả query để trả lại lần sau",
        "Client gửi mã băm của một query đã được duyệt trước thay vì cả chuỗi query; server từ chối mã băm không có trong danh sách",
        "Query được lưu vào localStorage của trình duyệt",
        "Query được nén bằng gzip"
      ], correct: 1,
      explanation: "Đây là allowlist thật sự: chỉ các query có trong bản build mới chạy được. Kèm lợi ích phụ là body gửi lên nhỏ hơn nhiều." },
    { q: "Vì sao nên tắt introspection ở môi trường production?", options: [
        "Vì nó làm chậm server",
        "Vì bất kỳ ai cũng tải được toàn bộ bản đồ API — mọi type, mọi field, kể cả những field bạn tưởng là ẩn",
        "Vì nó gây lỗi với cache",
        "Vì spec GraphQL yêu cầu"
      ], correct: 1,
      explanation: "Introspection rất tiện lúc phát triển nhưng ở production nó phơi bày toàn bộ bề mặt tấn công. Nhớ tắt kèm cả trang GraphiQL công khai và gợi ý 'Did you mean …?'." }
  ]
});
