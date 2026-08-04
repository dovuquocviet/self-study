window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Thực chiến",
  title: "Client & cache chuẩn hoá — vì sao sửa một chỗ, cả màn hình tự đổi",
  subtitle: "Normalized cache, cache key, fetch policy và cập nhật sau mutation",

  theory: `
    <p>Client GraphQL (Apollo Client, urql, Relay…) không chỉ là một hàm <code>fetch</code> bọc lại.
    Giá trị lớn nhất của chúng nằm ở <strong>cache chuẩn hoá</strong> (normalized cache).</p>
    <p>Cache thường (kiểu HTTP) lưu theo <em>request</em>: "URL này trả về JSON kia". Cache chuẩn hoá
    thì <em>băm nhỏ</em> response ra thành từng bản ghi, lưu theo <strong>khoá định danh</strong> —
    thường là <code>__typename + id</code>, ví dụ <code>User:7</code>. Response chỉ còn là một
    cái "cây tham chiếu" trỏ vào các bản ghi đó.</p>
    <p>Hệ quả rất dễ chịu: màn hình A hiện <code>User:7</code>, màn hình B cũng hiện
    <code>User:7</code>. Mutation đổi tên user 7 → cache cập nhật <em>một bản ghi</em> →
    <strong>cả hai màn hình tự vẽ lại</strong>. Bạn không viết dòng đồng bộ nào.</p>
    <p>Vài thứ cần nắm để không "cache mà như không":</p>
    <ul>
      <li><strong>Luôn hỏi <code>id</code></strong> (và <code>__typename</code> — client tự thêm giúp).
      Thiếu <code>id</code>, cache không định danh được bản ghi và đành lưu lồng trong query cha,
      mất hết lợi ích chia sẻ.</li>
      <li><strong>Fetch policy</strong> — có cache thì đọc cache (<code>cache-first</code>, mặc định),
      hay luôn hỏi mạng (<code>network-only</code>), hay vẽ cache trước rồi cập nhật sau
      (<code>cache-and-network</code> — mượt nhất cho màn hình danh sách).</li>
      <li><strong>Mutation trả về gì thì cache tự vá đó.</strong> Sửa bản ghi có sẵn: chỉ cần trả
      <code>id</code> + các field đã đổi, xong. <em>Thêm</em> hoặc <em>xoá</em> phần tử khỏi danh sách
      thì cache không tự đoán được — phải viết <code>update</code> hoặc bảo nó nạp lại query liên quan.</li>
      <li><strong>Optimistic UI</strong> — vá cache <em>trước khi</em> server trả lời để giao diện
      phản hồi tức thì, lỗi thì tự cuộn ngược. Rất hợp cho nút thích, đánh dấu đã đọc.</li>
    </ul>
    <div class="callout"><p>💡 Cache chuẩn hoá cũng có mặt trái: nó là một <em>cơ sở dữ liệu nhỏ</em>
    trong trình duyệt, và bạn phải nghĩ như người quản trị nó. Nếu app chủ yếu chỉ đọc rồi hiển thị,
    một client mỏng (fetch + React Query) có khi lại nhẹ đầu hơn.</p></div>
  `,

  codeTabs: [
    { id: "norm", label: "🗄️ Cache chuẩn hoá", lines: [
      "// Response gốc:",
      "{ posts: [ { id:\"31\", title:\"A\", author:{ id:\"7\", name:\"An\" } },",
      "           { id:\"30\", title:\"B\", author:{ id:\"7\", name:\"An\" } } ] }",
      "",
      "// Cache băm nhỏ ra, mỗi bản ghi một khoá:",
      "{",
      "  \"User:7\":  { __typename:\"User\", id:\"7\", name:\"An\" },",
      "  \"Post:31\": { __typename:\"Post\", id:\"31\", title:\"A\",",
      "                author: { __ref: \"User:7\" } },   // chỉ là tham chiếu",
      "  \"Post:30\": { __typename:\"Post\", id:\"30\", title:\"B\",",
      "                author: { __ref: \"User:7\" } },",
      "  \"ROOT_QUERY\": { \"posts\": [ {__ref:\"Post:31\"}, {__ref:\"Post:30\"} ] }",
      "}",
      "",
      "// Sửa User:7 một lần -> mọi nơi tham chiếu tới nó đều đổi theo."
    ]},
    { id: "policy", label: "🎛️ Fetch policy", lines: [
      "const { data, loading } = useQuery(GET_POSTS, {",
      "  fetchPolicy: \"cache-and-network\"",
      "});",
      "",
      "// cache-first      : có trong cache thì dùng luôn, không gọi mạng (mặc định)",
      "// cache-and-network: vẽ cache ngay + gọi mạng, có kết quả thì vẽ lại",
      "// network-only     : luôn gọi mạng, vẫn ghi vào cache",
      "// no-cache         : gọi mạng, KHÔNG đụng vào cache",
      "// cache-only       : chỉ đọc cache, không bao giờ gọi mạng",
      "",
      "// Kinh nghiệm: danh sách -> cache-and-network (mượt),",
      "//              số dư / tồn kho -> network-only (không được cũ)."
    ]},
    { id: "update", label: "✍️ Cập nhật sau mutation", lines: [
      "// 1. SỬA bản ghi có sẵn: chỉ cần trả id + field đã đổi -> cache tự vá",
      "mutation { updatePost(id: 31, title: \"A2\") { post { id title } } }",
      "",
      "// 2. THÊM vào danh sách: cache không tự đoán được, phải bảo nó",
      "useMutation(THEM_BAI, {",
      "  update(cache, { data }) {",
      "    cache.modify({ fields: {",
      "      posts: (cu = []) => [ghiVaoCache(cache, data.addPost.post), ...cu]",
      "    }});",
      "  }",
      "});",
      "",
      "// 3. Cách lười mà chắc: nạp lại query liên quan",
      "useMutation(THEM_BAI, { refetchQueries: [\"GetPosts\"] });"
    ]},
    { id: "optim", label: "⚡ Optimistic UI", lines: [
      "// Vá cache TRƯỚC khi server trả lời -> nút phản hồi tức thì",
      "thich({",
      "  variables: { postId: \"31\" },",
      "  optimisticResponse: {",
      "    likePost: {",
      "      __typename: \"LikePostPayload\",",
      "      post: { __typename: \"Post\", id: \"31\", liked: true, likeCount: 43 }",
      "    }",
      "  }",
      "});",
      "",
      "// Server trả về -> ghi đè bằng dữ liệu thật.",
      "// Server lỗi     -> client tự cuộn ngược về trạng thái cũ."
    ]}
  ],

  stageHtml: `
    <div class="node" id="resp"><div class="nl">📦 Response</div><div class="ns">cây JSON lồng nhau, có bản ghi lặp lại</div></div>
    <div class="arrow" id="a1">↓ ① băm nhỏ theo __typename + id</div>
    <div class="node" id="cache"><div class="nl">🗄️ Normalized cache</div><div class="ns">User:7 · Post:31 · Post:30</div></div>
    <div class="arrow" id="a2">↓ ② nhiều màn hình cùng trỏ vào một bản ghi</div>
    <div class="node" id="views"><div class="nl">🖼️ Màn hình A &amp; B</div><div class="ns">đều đọc User:7</div></div>
    <div class="arrow" id="a3">↓ ③ mutation trả về id + field đã đổi</div>
    <div class="node" id="patch"><div class="nl">🩹 Cache tự vá</div><div class="ns">ghi đè đúng bản ghi User:7</div></div>
    <div class="arrow" id="a4">↓ ④ mọi nơi tham chiếu tự vẽ lại</div>
    <div class="node" id="ui"><div class="nl">✨ UI đồng bộ</div><div class="ns">không viết dòng đồng bộ nào</div></div>
  `,
  steps: [
    { title: "1 · Response bị băm nhỏ", tab: "norm", highlight: [2, 3, 6, 7, 8], on: ["resp", "a1", "cache"],
      desc: "Hai bài viết cùng một tác giả — trong JSON thì <code>An</code> xuất hiện hai lần, nhưng trong cache chỉ có <strong>một</strong> bản ghi <code>User:7</code>. Chỗ khác chỉ giữ tham chiếu <code>__ref</code>." },
    { title: "2 · Khoá định danh cần id", tab: "norm", highlight: [7, 9, 13], on: ["cache"],
      desc: "Khoá mặc định là <code>__typename:id</code>. Quên hỏi <code>id</code> thì cache đành lưu object lồng trong query cha — mất khả năng chia sẻ, mất luôn khả năng tự cập nhật. Vì thế: <em>luôn hỏi id</em>." },
    { title: "3 · Nhiều màn hình dùng chung bản ghi", tab: "norm", highlight: [15], on: ["a2", "views"],
      desc: "Header hiện tên user, trang hồ sơ cũng hiện tên user — cả hai đọc cùng <code>User:7</code>. Đây là điều cache theo-request không làm được, và là lý do người ta chịu độ phức tạp của normalized cache." },
    { title: "4 · Chọn fetch policy", tab: "policy", highlight: [2, 5, 6, 7], on: ["views"],
      desc: "<code>cache-first</code> nhanh nhưng dễ cũ. <code>cache-and-network</code> vẽ ngay từ cache rồi lặng lẽ cập nhật — mượt nhất cho danh sách. Dữ liệu nhạy cảm với độ tươi (số dư, tồn kho) thì <code>network-only</code>." },
    { title: "5 · Mutation vá cache", tab: "update", highlight: [1, 2, 5, 6, 7, 8], on: ["a3", "patch"],
      desc: "Sửa bản ghi sẵn có thì chỉ cần trả <code>id</code> + field đã đổi, cache tự khớp. Nhưng <em>thêm/xoá</em> phần tử khỏi danh sách thì cache không đoán được — phải viết <code>update</code>, hoặc lười thì <code>refetchQueries</code>." },
    { title: "6 · Optimistic UI", tab: "optim", highlight: [3, 4, 5, 6, 7, 12, 13], on: ["a4", "ui"],
      desc: "Vá cache trước, gọi mạng sau: nút thích đổi màu <em>ngay</em>, không chờ vòng mạng. Server trả về thì ghi đè bằng dữ liệu thật; server lỗi thì client tự cuộn ngược. Cảm giác dùng app khác hẳn." }
  ],

  quiz: [
    { q: "Cache chuẩn hoá (normalized cache) lưu dữ liệu theo cách nào?", options: [
        "Theo URL của request, giống cache HTTP",
        "Băm response thành từng bản ghi, lưu theo khoá định danh (thường là __typename + id), chỗ khác chỉ giữ tham chiếu",
        "Lưu nguyên cây JSON của mỗi query",
        "Lưu trong localStorage dưới dạng chuỗi"
      ], correct: 1,
      explanation: "Nhờ chia nhỏ theo bản ghi, mọi màn hình đang hiện User:7 đều dùng chung một bản — sửa một chỗ thì tất cả tự cập nhật." },
    { q: "Vì sao nên luôn hỏi field 'id' trong query?", options: [
        "Vì server bắt buộc",
        "Vì thiếu id thì cache không định danh được bản ghi, phải lưu lồng trong query cha và mất khả năng chia sẻ/tự cập nhật",
        "Vì id giúp giảm dung lượng response",
        "Vì id là bắt buộc trong mọi selection set"
      ], correct: 1,
      explanation: "Khoá cache mặc định là __typename:id. Không có id thì không có khoá, và cache thoái hoá thành cache theo-query." },
    { q: "Sau mutation, trường hợp nào cache KHÔNG tự cập nhật được?", options: [
        "Sửa một field của bản ghi đã có trong cache",
        "Thêm hoặc xoá phần tử khỏi một danh sách — cache không đoán được phần tử mới nên nằm ở đâu",
        "Đổi tên của một User đang hiển thị",
        "Mọi trường hợp cache đều tự cập nhật"
      ], correct: 1,
      explanation: "Sửa bản ghi sẵn có thì khớp theo id là xong. Thêm/xoá thì phải viết hàm update để chỉnh danh sách, hoặc dùng refetchQueries cho chắc." },
    { q: "Optimistic UI hoạt động thế nào?", options: [
        "Gửi mutation hai lần để chắc chắn",
        "Vá cache bằng kết quả dự đoán ngay trước khi gọi mạng, rồi ghi đè bằng dữ liệu thật (hoặc cuộn ngược nếu lỗi)",
        "Bỏ qua server và chỉ lưu ở client",
        "Nén mutation để gửi nhanh hơn"
      ], correct: 1,
      explanation: "Giao diện phản hồi tức thì thay vì chờ vòng mạng. Rất hợp với thao tác nhỏ, hay lặp lại như nút thích hoặc đánh dấu đã đọc." }
  ]
});
