window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Vì sao có GraphQL — thực đơn set sẵn vs gọi món",
  subtitle: "Over-fetching, under-fetching và ý tưởng 'client tự mô tả thứ mình cần'",

  theory: `
    <p>Tưởng tượng bạn vào quán. <strong>REST</strong> giống <em>thực đơn set sẵn</em>: gọi "set A"
    thì bưng ra nguyên mâm — cơm, canh, tráng miệng — dù bạn chỉ muốn ăn canh. Muốn thêm ly nước
    thì phải gọi thêm "set B". Mỗi endpoint là một mâm đã đóng cứng từ trước.</p>
    <p>Điều đó đẻ ra hai nỗi khổ kinh điển:</p>
    <ul>
      <li><strong>Over-fetching</strong> (thừa) — <code>GET /users/7</code> trả về 40 field
      (địa chỉ, ngày sinh, avatar 5 kích cỡ…) trong khi màn hình chỉ hiện mỗi cái tên. Tốn băng thông,
      tốn pin điện thoại.</li>
      <li><strong>Under-fetching</strong> (thiếu) — một màn hình cần dữ liệu từ 3 nơi → phải gọi 3–5
      request <em>nối tiếp nhau</em>, request sau chờ request trước. Trên mạng 4G mỗi vòng ~200ms,
      5 vòng là gần 1 giây trắng màn hình.</li>
    </ul>
    <p><strong>GraphQL</strong> là <em>gọi món</em>: client gửi lên một <strong>query</strong> mô tả
    chính xác cây dữ liệu mình muốn, server trả về <em>đúng hình dạng đó</em> — không thừa một field,
    không thiếu một nhánh, trong <strong>một</strong> request.</p>
    <p>Ba điều cần nhớ ngay từ đầu:</p>
    <ul>
      <li>GraphQL là một <strong>ngôn ngữ truy vấn cho API</strong> (spec), không phải database,
      không phải framework, không thay thế SQL.</li>
      <li>Nó thường chạy trên <strong>một endpoint duy nhất</strong> — <code>POST /graphql</code>.
      Không còn chuyện đẻ thêm URL cho mỗi màn hình.</li>
      <li>Nó không quan tâm dữ liệu nằm ở đâu: sau lưng có thể là Postgres, Redis, một API REST khác,
      hay cả ba trộn lại.</li>
    </ul>
    <div class="callout"><p>💡 Một câu tóm gọn cả khoá: <strong>REST để server quyết định hình dạng
    response, GraphQL để client quyết định</strong>. Mọi khái niệm sau này — schema, resolver,
    DataLoader, cache — chỉ là hệ quả của việc chuyển quyền quyết định đó.</p></div>
  `,

  codeTabs: [
    { id: "rest", label: "🍱 REST", lines: [
      "# Màn hình 'Hồ sơ' cần: tên user, tiêu đề 3 bài gần nhất,",
      "# và tên người bình luận từng bài. Với REST:",
      "",
      "GET /users/7               # trả 40 field, ta chỉ cần 'name'   <- thừa",
      "GET /users/7/posts         # có bài viết, nhưng chưa có comment <- thiếu",
      "GET /posts/11/comments     # phải lặp cho TỪNG bài…",
      "GET /posts/12/comments",
      "GET /posts/13/comments",
      "",
      "# 5 vòng nối tiếp + tải cả tá field không dùng tới.",
      "# Muốn gộp thành 1 endpoint? Phải sửa backend rồi deploy lại."
    ]},
    { id: "gql", label: "💠 GraphQL query", lines: [
      "# Một request duy nhất — client tự liệt kê đúng field cần",
      "POST /graphql",
      "",
      "query {",
      "  user(id: 7) {",
      "    name",
      "    posts(last: 3) {",
      "      title",
      "      comments { author { name } }",
      "    }",
      "  }",
      "}"
    ]},
    { id: "resp", label: "📦 Response", lines: [
      "# Response có HÌNH DẠNG y hệt query — không thừa, không thiếu",
      "{",
      "  \"data\": {",
      "    \"user\": {",
      "      \"name\": \"An\",",
      "      \"posts\": [",
      "        { \"title\": \"Học GraphQL\",",
      "          \"comments\": [ { \"author\": { \"name\": \"Bình\" } } ] }",
      "      ]",
      "    }",
      "  }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="screen"><div class="nl">📱 Màn hình Hồ sơ</div><div class="ns">cần: tên · 3 tiêu đề · người bình luận</div></div>
    <div class="arrow" id="a1">↓ ① REST: 5 request nối tiếp</div>
    <div class="node" id="rest"><div class="nl">🍱 Nhiều endpoint</div><div class="ns">thừa field · thiếu nhánh · nhiều vòng chờ</div></div>
    <div class="arrow" id="a2">↓ ② GraphQL: mô tả cây dữ liệu cần</div>
    <div class="node" id="query"><div class="nl">💠 Một query</div><div class="ns">user → posts → comments → author</div></div>
    <div class="arrow" id="a3">↓ ③ POST /graphql (1 request)</div>
    <div class="node" id="server"><div class="nl">🖥️ GraphQL server</div><div class="ns">đọc query, gom dữ liệu từ mọi nguồn</div></div>
    <div class="arrow" id="a4">↓ ④ trả đúng hình dạng đã hỏi</div>
    <div class="node" id="json"><div class="nl">📦 JSON</div><div class="ns">soi gương với query — không dư một byte</div></div>
  `,
  steps: [
    { title: "1 · Màn hình cần dữ liệu từ nhiều nơi", tab: "rest", highlight: [1, 2], on: ["screen"],
      desc: "Một màn hình hồ sơ tầm thường đã cần 3 loại dữ liệu liên quan nhau: user, bài viết của user, và bình luận của từng bài. Đây là hình dạng <em>cây</em> — mà REST lại chỉ biết trả về từng <em>mâm phẳng</em>." },
    { title: "2 · Over-fetching: mâm quá to", tab: "rest", highlight: [4], on: ["screen", "a1", "rest"],
      desc: "<code>GET /users/7</code> bưng ra 40 field vì endpoint được thiết kế cho <em>mọi</em> màn hình. Bạn dùng đúng 1 field <code>name</code>, 39 field kia đi thẳng vào sọt rác — nhưng vẫn tốn băng thông và thời gian parse." },
    { title: "3 · Under-fetching: phải gọi thêm vòng nữa", tab: "rest", highlight: [5, 6, 7, 8], on: ["rest"],
      desc: "Có danh sách bài viết rồi mới biết id từng bài, mới gọi được comment của bài đó. Request sau <em>phụ thuộc</em> request trước nên không song song được — đây chính là 'waterfall', thủ phạm số một của màn hình trắng." },
    { title: "4 · Client mô tả thứ mình cần", tab: "gql", highlight: [4, 5, 6, 7, 9], on: ["a2", "query"],
      desc: "Với GraphQL, client viết ra <em>cây</em> field mình muốn: <code>user</code> → <code>name</code> + <code>posts</code> → <code>title</code> + <code>comments</code> → <code>author</code> → <code>name</code>. Đây là văn bản mô tả nhu cầu, chưa phải lời gọi hàm nào cả." },
    { title: "5 · Một endpoint, một vòng mạng", tab: "gql", highlight: [2], on: ["query", "a3", "server"],
      desc: "Cả cây trên đi trong <strong>một</strong> <code>POST /graphql</code>. Server tự đi gom dữ liệu — dù nguồn là Postgres, Redis hay một REST API cũ — rồi ghép lại. Client không cần biết và không cần đổi khi backend đổi." },
    { title: "6 · Response soi gương với query", tab: "resp", highlight: [3, 4, 5, 6, 8], on: ["a4", "json"],
      desc: "Đây là điểm 'sướng' nhất của GraphQL: JSON trả về có <em>đúng</em> hình dạng bạn đã hỏi. Nhìn query là biết response, không cần mở tài liệu. Muốn thêm field? Sửa query, không cần chờ backend deploy." }
  ],

  quiz: [
    { q: "Over-fetching trong REST nghĩa là gì?", options: [
        "Gọi quá nhiều request cùng lúc làm sập server",
        "Endpoint trả về nhiều field hơn màn hình thực sự cần",
        "Client gửi payload quá lớn lên server",
        "Database trả về sai kiểu dữ liệu"
      ], correct: 1,
      explanation: "Over = thừa: endpoint được thiết kế cho mọi màn hình nên trả cả tá field, còn màn hình của bạn chỉ dùng vài field. Ngược lại, under-fetching là thiếu dữ liệu nên phải gọi thêm request." },
    { q: "Vì sao chuỗi request REST kiểu /users → /posts → /comments lại chậm hơn nhiều so với một query GraphQL?", options: [
        "Vì JSON của REST nặng hơn",
        "Vì các request phụ thuộc nhau nên phải chờ nối tiếp (waterfall), mỗi vòng tốn thêm một lần đi–về mạng",
        "Vì REST luôn dùng HTTP/1.0",
        "Vì REST không nén được dữ liệu"
      ], correct: 1,
      explanation: "Phải có kết quả /posts mới biết id bài viết để gọi /comments — nên không song song được. GraphQL gộp cả cây vào một vòng mạng duy nhất." },
    { q: "Phát biểu nào ĐÚNG về GraphQL?", options: [
        "GraphQL là một cơ sở dữ liệu thay thế cho SQL",
        "GraphQL là ngôn ngữ truy vấn cho API, thường chạy trên một endpoint duy nhất, và không quan tâm dữ liệu nằm ở đâu",
        "GraphQL bắt buộc backend phải viết bằng JavaScript",
        "GraphQL thay thế hoàn toàn HTTP"
      ], correct: 1,
      explanation: "GraphQL chỉ là một spec về ngôn ngữ truy vấn + cách thực thi. Nó chạy trên HTTP (thường là POST /graphql), và phía sau có thể là bất kỳ nguồn dữ liệu nào." },
    { q: "Khác biệt cốt lõi giữa REST và GraphQL nằm ở đâu?", options: [
        "Ai quyết định hình dạng của response — server (REST) hay client (GraphQL)",
        "REST dùng JSON còn GraphQL dùng XML",
        "GraphQL nhanh hơn vì dùng UDP",
        "REST không hỗ trợ dữ liệu lồng nhau"
      ], correct: 0,
      explanation: "Toàn bộ khoá này xoay quanh câu đó: khi client được quyền mô tả cây dữ liệu, ta cần schema làm hợp đồng, resolver để gom dữ liệu, DataLoader để khỏi N+1, và cache phía client." }
  ]
});
