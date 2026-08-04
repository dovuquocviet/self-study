window.LESSONS.push({
  id: "11",
  phase: "2", phaseName: "Bên trong server",
  title: "Lỗi & null — mảng errors, dữ liệu một phần và hiện tượng 'null bubbling'",
  subtitle: "Vì sao một field lỗi lại xoá trắng cả nhánh, và cách thiết kế để tránh",

  theory: `
    <p>GraphQL xử lý lỗi rất khác REST, và đây là chỗ hay làm người mới bối rối.</p>
    <p><strong>Luật 1 — hầu như luôn là HTTP 200.</strong> Lỗi nằm trong body, ở mảng
    <code>errors</code> song song với <code>data</code>. Đừng viết
    <code>if (res.ok) { thanhCong() }</code>.</p>
    <p><strong>Luật 2 — dữ liệu một phần.</strong> Một field hỏng không giết cả query. Response có thể
    có <em>cả</em> <code>data</code> (phần chạy được) <em>lẫn</em> <code>errors</code> (phần hỏng).
    Mỗi lỗi kèm <code>path</code> chỉ đúng field nào gãy — nhờ đó client vẫn vẽ được phần lành.</p>
    <p><strong>Luật 3 — null bubbling.</strong> Đây là cơ chế quan trọng nhất phải hiểu. Khi resolver
    của một field ném lỗi, GraphQL đặt <code>null</code> vào field đó. Nhưng nếu field ấy khai là
    <strong>non-null</strong> (<code>String!</code>) thì không được phép null — nên lỗi
    <em>trào lên</em> field cha. Cha cũng non-null? Trào tiếp. Cứ thế cho tới khi gặp một field
    nullable, hoặc lên tới tận <code>data: null</code>.</p>
    <p>Nói cách khác: <strong>mỗi dấu <code>!</code> là một lời hứa, và một lời hứa gãy sẽ kéo sập
    cả nhánh</strong>. Một field phụ như <code>avatarUrl: String!</code> mà gọi sang service ảnh bị
    lỗi có thể xoá trắng cả màn hình hồ sơ.</p>
    <p>Nên phân biệt hai loại lỗi:</p>
    <ul>
      <li><strong>Lỗi kỹ thuật</strong> (mất kết nối DB, bug, hết hạn token) → ném lên mảng
      <code>errors</code>, kèm <code>extensions.code</code> để client phân loại.</li>
      <li><strong>Lỗi nghiệp vụ</strong> (email đã tồn tại, hết hàng) → đưa vào <em>schema</em>
      như dữ liệu: <code>userErrors</code> trong payload (bài 5) hoặc union kết quả (bài 7).
      Client xử lý được, có kiểu, dịch được sang tiếng Việt.</li>
    </ul>
    <div class="callout"><p>💡 Quy tắc thực dụng: <strong>mặc định để field nullable</strong>, chỉ đặt
    <code>!</code> khi thật sự không đời nào null (khoá chính, danh sách). Trong GraphQL, non-null
    không phải "cẩn thận hơn" mà là "giòn hơn".</p></div>
  `,

  codeTabs: [
    { id: "shape", label: "📦 Hình dạng lỗi", lines: [
      "{",
      "  \"data\": {                       # phần chạy được VẪN trả về",
      "    \"user\": { \"name\": \"An\", \"avatarUrl\": null }",
      "  },",
      "  \"errors\": [ {",
      "    \"message\": \"Service ảnh không phản hồi\",",
      "    \"path\": [\"user\", \"avatarUrl\"],   # gãy ở ĐÂU",
      "    \"locations\": [ { \"line\": 4, \"column\": 5 } ],",
      "    \"extensions\": {",
      "      \"code\": \"UPSTREAM_TIMEOUT\",   # client phân loại bằng cái này",
      "      \"traceId\": \"a1b2c3\"",
      "    } } ]",
      "}"
    ]},
    { id: "bubble", label: "🫧 Null bubbling", lines: [
      "type User {",
      "  name: String!          # non-null",
      "  avatarUrl: String!     # non-null  <- lời hứa nguy hiểm",
      "  bio: String            # nullable",
      "}",
      "type Query { user(id: ID!): User }   # user NULLABLE",
      "",
      "# avatarUrl lỗi -> không được null (có !) -> trào lên 'user'",
      "# 'user' nullable -> dừng ở đây:",
      "{ \"data\": { \"user\": null },        # MẤT cả name lẫn bio!",
      "  \"errors\": [ { \"path\": [\"user\",\"avatarUrl\"] } ] }",
      "",
      "# Nếu Query.user cũng khai User! thì trào tiếp:",
      "{ \"data\": null, \"errors\": [ … ] }   # trắng toàn bộ query"
    ]},
    { id: "fix", label: "✅ Thiết kế bớt giòn", lines: [
      "type User {",
      "  id: ID!                # chắc chắn có -> ! xứng đáng",
      "  name: String!          # cột NOT NULL trong DB -> ok",
      "  avatarUrl: String      # gọi service ngoài -> ĐỂ NULLABLE",
      "  posts: [Post!]!        # danh sách: rỗng thì trả [], không null",
      "}",
      "",
      "// Hoặc bọc lỗi lại thay vì để nó trào lên:",
      "avatarUrl: async (user, _, ctx) => {",
      "  try { return await ctx.anh.layUrl(user.id); }",
      "  catch (e) { ctx.log.warn(e); return null; }   // giữ nhánh sống",
      "}"
    ]},
    { id: "biz", label: "🧾 Lỗi nghiệp vụ", lines: [
      "# ĐỪNG ném lỗi nghiệp vụ vào mảng errors:",
      "#   { \"errors\": [ { \"message\": \"Email đã tồn tại\" } ] }",
      "#   -> client phải so khớp chuỗi tiếng Anh, không dịch được, dễ vỡ",
      "",
      "# NÊN đưa vào schema như dữ liệu có kiểu:",
      "type SignUpPayload {",
      "  user: User",
      "  userErrors: [UserError!]!    # field · message · code",
      "}",
      "",
      "# Hoặc union kết quả (bài 7):",
      "union SignUpResult = SignUpSuccess | EmailTaken | WeakPassword",
      "",
      "# Mảng errors dành cho LỖI KỸ THUẬT: mất DB, bug, timeout, hết hạn token."
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">💠 query { user { name avatarUrl bio } }</div><div class="ns">3 field, 1 field gọi service ngoài</div></div>
    <div class="arrow" id="a1">↓ ① resolver avatarUrl ném lỗi</div>
    <div class="node" id="err"><div class="nl">💥 Lỗi tại một field</div><div class="ns">service ảnh timeout</div></div>
    <div class="arrow" id="a2">↓ ② field khai String! → không được null</div>
    <div class="node" id="bubble"><div class="nl">🫧 Trào lên cha</div><div class="ns">user = null, mất luôn name và bio</div></div>
    <div class="arrow" id="a3">↓ ③ gặp field nullable thì dừng</div>
    <div class="node" id="stop"><div class="nl">🛑 Dừng ở Query.user</div><div class="ns">nếu cha cũng non-null → data: null</div></div>
    <div class="arrow" id="a4">↓ ④ lỗi kèm path vào mảng errors</div>
    <div class="node" id="out"><div class="nl">📦 data + errors</div><div class="ns">client vẽ phần lành, báo phần hỏng</div></div>
  `,
  steps: [
    { title: "1 · Lỗi nằm trong body, không ở status", tab: "shape", highlight: [1, 2, 5, 6], on: ["q"],
      desc: "HTTP vẫn 200. Response có <em>cả</em> <code>data</code> lẫn <code>errors</code>. Client GraphQL luôn phải đọc mảng <code>errors</code> — kiểm tra status code như REST là bỏ sót hoàn toàn." },
    { title: "2 · path chỉ đúng chỗ gãy", tab: "shape", highlight: [7, 9, 10, 11], on: ["a1", "err"],
      desc: "<code>path: [\"user\", \"avatarUrl\"]</code> nói chính xác field nào hỏng. <code>extensions.code</code> là chỗ đặt mã lỗi máy đọc được — client phân loại bằng mã, đừng bao giờ so khớp chuỗi <code>message</code>." },
    { title: "3 · Non-null không cho null", tab: "bubble", highlight: [2, 3], on: ["err", "a2"],
      desc: "<code>avatarUrl: String!</code> là lời hứa 'không đời nào null'. Resolver lỗi thì GraphQL muốn đặt null vào đó — nhưng lời hứa cấm. Xung đột này phải giải quyết ở tầng trên." },
    { title: "4 · Lỗi trào lên cha", tab: "bubble", highlight: [8, 9, 10, 11], on: ["bubble"],
      desc: "GraphQL đặt <code>null</code> cho <em>cả</em> <code>user</code>. Bạn mất luôn <code>name</code> và <code>bio</code> — hai field hoàn toàn khoẻ mạnh — chỉ vì một cái ảnh đại diện. Đây là <strong>null bubbling</strong>." },
    { title: "5 · Trào tới đâu thì dừng", tab: "bubble", highlight: [6, 13, 14], on: ["a3", "stop"],
      desc: "Trào lên cho tới khi gặp field <em>nullable</em> đầu tiên. <code>Query.user</code> khai <code>User</code> (nullable) nên dừng ở đó. Nếu khai <code>User!</code> thì trào tiếp lên root → <code>data: null</code>, trắng cả query." },
    { title: "6 · Thiết kế để bớt giòn", tab: "fix", highlight: [4, 5, 9, 10, 11, 12], on: ["a4", "out"],
      desc: "Hai cách chữa: (a) để field 'rủi ro' <em>nullable</em>, (b) bắt lỗi ngay trong resolver và trả <code>null</code> có kiểm soát. Còn lỗi nghiệp vụ thì đưa vào schema như dữ liệu (tab cuối), đừng ném vào mảng <code>errors</code>." }
  ],

  quiz: [
    { q: "Hiện tượng 'null bubbling' xảy ra khi nào?", options: [
        "Khi client hỏi field không tồn tại",
        "Khi resolver của một field non-null ném lỗi — null không đặt được vào đó nên lỗi trào lên field cha, cho tới khi gặp field nullable",
        "Khi database trả về null",
        "Khi query có quá nhiều tầng lồng nhau"
      ], correct: 1,
      explanation: "Dấu ! là lời hứa không null. Lời hứa gãy thì GraphQL phải null hoá cả field cha — có thể xoá trắng cả nhánh dữ liệu vốn khoẻ mạnh." },
    { q: "Một response GraphQL có thể vừa có 'data' vừa có 'errors' không?", options: [
        "Không, chỉ một trong hai",
        "Có — đó là dữ liệu một phần: phần chạy được vẫn trả về, phần hỏng được mô tả trong errors kèm path",
        "Chỉ khi dùng subscription",
        "Chỉ khi HTTP status là 207"
      ], correct: 1,
      explanation: "Đây là điểm khác biệt lớn so với REST. Client nên vẽ phần lành và báo riêng phần hỏng, thay vì coi cả response là thất bại." },
    { q: "Lỗi nghiệp vụ như 'email đã tồn tại' nên đặt ở đâu?", options: [
        "Trong mảng errors với message tiếng Anh",
        "Trong schema như dữ liệu có kiểu — userErrors trong payload hoặc union kết quả",
        "Trong HTTP status 409",
        "Trong header của response"
      ], correct: 1,
      explanation: "Lỗi nghiệp vụ là kết quả hợp lệ của thao tác, client cần xử lý và hiển thị. Đưa vào schema thì có kiểu, dịch được, không phải so khớp chuỗi. Mảng errors dành cho lỗi kỹ thuật." },
    { q: "Vì sao nên hạn chế dùng dấu ! (non-null) cho các field 'rủi ro'?", options: [
        "Vì non-null làm query chạy chậm hơn",
        "Vì non-null khiến một field lỗi kéo sập cả nhánh cha — trong GraphQL, non-null nghĩa là giòn hơn chứ không phải an toàn hơn",
        "Vì client không đọc được field non-null",
        "Vì non-null không dùng được với mảng"
      ], correct: 1,
      explanation: "Chỉ đặt ! khi thật sự không đời nào null (id, khoá chính, danh sách). Field gọi service ngoài nên để nullable để lỗi cục bộ không xoá trắng cả màn hình." }
  ]
});
