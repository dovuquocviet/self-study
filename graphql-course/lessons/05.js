window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Ngôn ngữ truy vấn",
  title: "Mutation — ghi dữ liệu và trả về đúng thứ client cần cập nhật",
  subtitle: "input type, payload type, và vì sao mutation chạy tuần tự",

  theory: `
    <p><strong>Query</strong> để đọc, <strong>Mutation</strong> để thay đổi. Về mặt kỹ thuật hai thứ
    gần như giống hệt nhau — vẫn là field, vẫn có tham số, vẫn có selection set. Chỉ khác hai điểm
    do spec quy định:</p>
    <ul>
      <li>Các field ở <em>tầng gốc</em> của Mutation chạy <strong>tuần tự</strong>, từ trên xuống —
      vì ghi dữ liệu thì thứ tự quan trọng. Còn field của Query chạy <strong>song song</strong>.</li>
      <li>Mutation là nơi <em>duy nhất</em> được phép có tác dụng phụ. Query mà lén ghi database là
      phá hợp đồng — client và cache sẽ hiểu sai.</li>
    </ul>
    <p>Hai quy ước thiết kế rất phổ biến, nên theo ngay từ đầu:</p>
    <ul>
      <li><strong>Input type</strong> — gom tham số vào một object riêng:
      <code>createPost(input: CreatePostInput!)</code>. <code>input</code> là type riêng biệt
      (không dùng chung với object type thường) vì nó chỉ chứa dữ liệu vào, không có field lồng nhau
      tuỳ ý. Thêm field mới sau này không phá client cũ.</li>
      <li><strong>Payload type</strong> — trả về một object bao ngoài chứ không trả thẳng entity:
      <code>type CreatePostPayload { post: Post  userErrors: [UserError!]! }</code>. Nhờ vậy mutation
      trả được cả kết quả <em>lẫn</em> lỗi nghiệp vụ ("tiêu đề trống", "hết hàng") một cách có kiểu,
      thay vì ném vào mảng <code>errors</code> chung chung.</li>
    </ul>
    <p>Và nhớ: mutation <em>cũng có selection set</em>. Sau khi ghi xong, bạn chọn luôn những field
    đã đổi để client cập nhật giao diện ngay — không cần gọi thêm một query nữa như REST hay phải làm.</p>
    <div class="callout"><p>💡 Mẹo: luôn chọn <code>id</code> và các field bị thay đổi trong payload.
    Client cache (bài 12) dùng <code>id</code> để tìm đúng bản ghi cũ và tự vá lại — giao diện tự cập nhật,
    bạn không phải viết một dòng code đồng bộ nào.</p></div>
  `,

  codeTabs: [
    { id: "sdl", label: "📜 Schema", lines: [
      "input CreatePostInput {        # 'input' — kiểu riêng cho dữ liệu vào",
      "  title: String!",
      "  body: String!",
      "  tagIds: [ID!] = []",
      "}",
      "",
      "type UserError {               # lỗi nghiệp vụ, có kiểu đàng hoàng",
      "  field: String",
      "  message: String!",
      "}",
      "",
      "type CreatePostPayload {       # payload bọc ngoài, không trả thẳng Post",
      "  post: Post",
      "  userErrors: [UserError!]!",
      "}",
      "",
      "type Mutation {",
      "  createPost(input: CreatePostInput!): CreatePostPayload!",
      "  deletePost(id: ID!): DeletePostPayload!",
      "}"
    ]},
    { id: "call", label: "✍️ Gọi mutation", lines: [
      "mutation TaoBai($input: CreatePostInput!) {",
      "  createPost(input: $input) {",
      "    post {                     # chọn luôn thứ cần để vẽ lại UI",
      "      id",
      "      title",
      "      createdAt",
      "    }",
      "    userErrors { field message }",
      "  }",
      "}",
      "",
      "# variables:",
      "{ \"input\": { \"title\": \"Học GraphQL\", \"body\": \"…\" } }"
    ]},
    { id: "resp", label: "📦 Hai kết quả", lines: [
      "# Thành công:",
      "{ \"data\": { \"createPost\": {",
      "    \"post\": { \"id\": \"31\", \"title\": \"Học GraphQL\" },",
      "    \"userErrors\": [] } } }",
      "",
      "# Lỗi nghiệp vụ — vẫn là 200, vẫn có data, lỗi nằm đúng chỗ:",
      "{ \"data\": { \"createPost\": {",
      "    \"post\": null,",
      "    \"userErrors\": [",
      "      { \"field\": \"title\", \"message\": \"Tiêu đề không được trống\" }",
      "    ] } } }"
    ]},
    { id: "order", label: "⏱️ Thứ tự chạy", lines: [
      "# Field gốc của MUTATION chạy tuần tự, trên xuống dưới:",
      "mutation {",
      "  a: deletePost(id: 1) { ok }   # chạy xong…",
      "  b: deletePost(id: 2) { ok }   # …rồi mới tới cái này",
      "}",
      "",
      "# Field gốc của QUERY thì chạy song song, thứ tự không đảm bảo:",
      "query {",
      "  user(id: 1) { name }          # hai field này có thể",
      "  posts { title }               # chạy cùng lúc",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client</div><div class="ns">gửi mutation + input</div></div>
    <div class="arrow" id="a1">↓ ① validate input theo schema</div>
    <div class="node" id="input"><div class="nl">📥 CreatePostInput</div><div class="ns">title · body · tagIds</div></div>
    <div class="arrow" id="a2">↓ ② chạy tuần tự, có tác dụng phụ</div>
    <div class="node" id="write"><div class="nl">💾 Ghi dữ liệu</div><div class="ns">insert vào DB · kiểm tra nghiệp vụ</div></div>
    <div class="arrow" id="a3">↓ ③ đóng gói kết quả</div>
    <div class="node" id="payload"><div class="nl">📤 Payload</div><div class="ns">post + userErrors</div></div>
    <div class="arrow" id="a4">↓ ④ trả về đúng field client đã chọn</div>
    <div class="node" id="ui"><div class="nl">🖼️ UI cập nhật</div><div class="ns">cache vá theo id, không cần gọi lại</div></div>
  `,
  steps: [
    { title: "1 · Input type gom tham số", tab: "sdl", highlight: [1, 2, 3, 4, 5], on: ["client", "a1", "input"],
      desc: "Thay vì rải rác chục tham số, gom vào một <code>input</code>. Đây là loại type riêng — chỉ chứa dữ liệu vào, không có field lồng nhau tuỳ ý. Thêm field mới (có mặc định) sau này không làm client cũ vỡ." },
    { title: "2 · Payload bọc ngoài kết quả", tab: "sdl", highlight: [12, 13, 14, 15], on: ["input"],
      desc: "Mutation trả <code>CreatePostPayload</code> chứ không trả thẳng <code>Post</code>. Nhờ lớp bọc này ta nhét thêm được <code>userErrors</code> — lỗi nghiệp vụ có kiểu, client xử lý được, khác hẳn lỗi kỹ thuật ném vào mảng <code>errors</code> chung." },
    { title: "3 · Gọi mutation kèm selection set", tab: "call", highlight: [1, 2, 3, 4, 5, 6], on: ["a2", "write"],
      desc: "Mutation cũng có selection set như query. Ghi xong bạn chọn luôn <code>id</code>, <code>title</code>, <code>createdAt</code> — những gì cần để vẽ lại giao diện. REST thường phải POST rồi GET lại; ở đây gộp một vòng." },
    { title: "4 · Chọn cả nhánh lỗi", tab: "call", highlight: [8], on: ["write", "a3", "payload"],
      desc: "Luôn chọn <code>userErrors { field message }</code>. Field <code>field</code> cho biết ô nhập nào sai — đủ để hiện lỗi đúng chỗ trên form, thay vì một thông báo chung chung." },
    { title: "5 · Hai dạng kết quả", tab: "resp", highlight: [2, 3, 4, 8, 9, 10], on: ["payload"],
      desc: "Thành công thì <code>post</code> có giá trị, <code>userErrors</code> rỗng. Thất bại nghiệp vụ thì ngược lại — nhưng <em>vẫn</em> là HTTP 200 và <em>vẫn</em> có <code>data</code>. Client chỉ cần đọc <code>userErrors</code>." },
    { title: "6 · Mutation chạy tuần tự", tab: "order", highlight: [3, 4, 9, 10, 11], on: ["a4", "ui"],
      desc: "Field gốc của mutation chạy lần lượt trên xuống — vì ghi dữ liệu thì thứ tự có ý nghĩa. Field gốc của query thì chạy song song. Đây là khác biệt kỹ thuật thật sự duy nhất giữa hai loại operation." }
  ],

  quiz: [
    { q: "Khác biệt kỹ thuật thật sự giữa Query và Mutation là gì?", options: [
        "Mutation dùng HTTP PUT còn Query dùng GET",
        "Field ở tầng gốc của Mutation chạy tuần tự, còn của Query chạy song song",
        "Mutation không có selection set",
        "Mutation không được dùng variables"
      ], correct: 1,
      explanation: "Spec quy định field gốc của mutation chạy lần lượt vì thứ tự ghi có ý nghĩa. Ngoài ra mutation vẫn là field bình thường, vẫn có tham số và selection set." },
    { q: "Vì sao nên trả về 'payload type' (ví dụ CreatePostPayload) thay vì trả thẳng Post?", options: [
        "Vì spec GraphQL bắt buộc như vậy",
        "Vì Post không thể là kiểu trả về của mutation",
        "Vì payload cho phép trả kèm lỗi nghiệp vụ có kiểu (userErrors) và mở rộng thêm field sau này mà không phá client",
        "Vì payload giúp response nhẹ hơn"
      ], correct: 2,
      explanation: "Đây là quy ước, không phải bắt buộc — nhưng rất đáng theo: lỗi nghiệp vụ ('tiêu đề trống') khác hẳn lỗi kỹ thuật, và client cần xử lý chúng khác nhau." },
    { q: "Vì sao nên chọn field 'id' trong payload của mutation?", options: [
        "Để server biết ghi vào bản ghi nào",
        "Để client cache tìm đúng bản ghi cũ và tự vá lại, giúp UI cập nhật mà không cần gọi thêm query",
        "Vì thiếu id thì mutation sẽ lỗi",
        "Để giảm dung lượng response"
      ], correct: 1,
      explanation: "Normalized cache (bài 12) định danh bản ghi bằng typename + id. Có id trong payload thì cache tự cập nhật, mọi component đang hiện bản ghi đó tự vẽ lại." },
    { q: "Vì sao 'input type' là loại type riêng, không dùng chung object type thường?", options: [
        "Vì input chỉ mô tả dữ liệu đi vào — không có tham số, không có field lồng nhau tuỳ ý — nên GraphQL tách riêng để kiểm tra chặt chẽ",
        "Vì input được mã hoá khác",
        "Vì object type không hỗ trợ scalar",
        "Vì input luôn nullable"
      ], correct: 0,
      explanation: "Object type dùng cho dữ liệu ra (có thể có tham số, có resolver); input type dùng cho dữ liệu vào và chỉ chứa scalar/enum/input khác. Tách riêng giúp validate rõ ràng." }
  ]
});
