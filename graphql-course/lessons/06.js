window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Ngôn ngữ truy vấn",
  title: "Subscription — dữ liệu tự chảy về khi có gì đó thay đổi",
  subtitle: "WebSocket, SSE, pub/sub và khi nào nên (không nên) dùng",

  theory: `
    <p>Query và Mutation đều theo kiểu <em>hỏi–đáp</em>: client mở lời trước, server trả lời rồi
    đóng kết nối. <strong>Subscription</strong> lật ngược lại: client <em>đăng ký</em> một lần,
    rồi ngồi im — mỗi khi có sự kiện, server tự đẩy dữ liệu về.</p>
    <p>Giống như đặt báo dài hạn: bạn không phải ngày nào cũng ra sạp hỏi "có báo mới chưa?"
    (đó là <em>polling</em>), mà báo tự tới cửa mỗi khi ra số.</p>
    <p>Cơ chế bên dưới:</p>
    <ul>
      <li>Kết nối thường là <strong>WebSocket</strong> (giao thức
      <code>graphql-transport-ws</code>) — hai chiều, giữ mở lâu dài. Cũng có thể dùng
      <strong>SSE</strong> (server-sent events) nếu chỉ cần một chiều server → client.</li>
      <li>Trong server có một <strong>pub/sub</strong>: mutation nào đó <em>publish</em> sự kiện
      (ví dụ <code>POST_ADDED</code>), mọi subscription đang <em>subscribe</em> kênh đó sẽ được đánh thức.</li>
      <li>Mỗi lần đẩy về, payload có <strong>đúng hình dạng selection set</strong> của subscription —
      hệt như query. Client không nhận "một event thô" mà nhận đúng cây dữ liệu nó đã đặt hàng.</li>
    </ul>
    <p><strong>Đắt hơn bạn tưởng.</strong> Mỗi subscription là một kết nối mở + trạng thái phải giữ
    trên server. 10.000 người dùng là 10.000 kết nối, và khi scale nhiều instance thì pub/sub phải
    đi qua Redis/Kafka chứ không thể để trong bộ nhớ.</p>
    <div class="callout"><p>💡 Cân nhắc trước khi dùng: dữ liệu thay đổi <em>vài giây một lần</em> và
    người dùng cần thấy ngay (chat, giá cổ phiếu, vị trí shipper) → subscription xứng đáng.
    Còn "thông báo mới" hay "trạng thái đơn hàng" thì <strong>polling</strong> mỗi 10–30 giây thường
    đơn giản, rẻ và đủ tốt hơn nhiều.</p></div>
  `,

  codeTabs: [
    { id: "sdl", label: "📜 Schema", lines: [
      "type Subscription {",
      "  postAdded(topicId: ID!): Post!      # đăng ký theo chủ đề",
      "  typing(roomId: ID!): TypingEvent!",
      "}",
      "",
      "type Mutation {",
      "  addPost(input: AddPostInput!): AddPostPayload!",
      "}",
      "",
      "# Quy ước: mutation ghi dữ liệu XONG mới publish sự kiện,",
      "# để người nhận không đọc phải trạng thái nửa vời."
    ]},
    { id: "sub", label: "📡 Đăng ký", lines: [
      "subscription NgheBaiMoi($topicId: ID!) {",
      "  postAdded(topicId: $topicId) {",
      "    id",
      "    title",
      "    author { name }        # vẫn là selection set như query",
      "  }",
      "}",
      "",
      "# Mỗi lần server đẩy về, payload có đúng hình dạng trên:",
      "{ \"data\": { \"postAdded\": {",
      "    \"id\": \"88\", \"title\": \"Bài mới\",",
      "    \"author\": { \"name\": \"An\" } } } }"
    ]},
    { id: "ws", label: "🔌 WebSocket", lines: [
      "# Bắt tay theo giao thức graphql-transport-ws",
      "-> { \"type\": \"connection_init\", \"payload\": { \"token\": \"…\" } }",
      "<- { \"type\": \"connection_ack\" }",
      "",
      "-> { \"id\": \"1\", \"type\": \"subscribe\",",
      "     \"payload\": { \"query\": \"subscription { postAdded… }\" } }",
      "",
      "<- { \"id\": \"1\", \"type\": \"next\", \"payload\": { \"data\": {…} } }",
      "<- { \"id\": \"1\", \"type\": \"next\", \"payload\": { \"data\": {…} } }",
      "",
      "-> { \"id\": \"1\", \"type\": \"complete\" }     # client huỷ đăng ký",
      "",
      "# Auth đi trong connection_init, KHÔNG có header như HTTP thường."
    ]},
    { id: "poll", label: "⚖️ vs Polling", lines: [
      "# Polling: đơn giản, không giữ trạng thái, chịu được restart server",
      "setInterval(function () { goiQuery(); }, 15000);",
      "",
      "# Subscription: realtime thật, nhưng phải lo:",
      "#  - kết nối rớt -> tự kết nối lại + lấy bù phần đã lỡ",
      "#  - nhiều instance -> pub/sub qua Redis/Kafka, không để trong RAM",
      "#  - mỗi client là một kết nối mở, tốn tài nguyên",
      "",
      "# Quy tắc chọn: cần độ trễ dưới ~1 giây thì mới dùng subscription."
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client</div><div class="ns">mở WebSocket, gửi subscribe</div></div>
    <div class="arrow" id="a1">↓ ① connection_init → connection_ack</div>
    <div class="node" id="server"><div class="nl">🖥️ GraphQL server</div><div class="ns">ghi nhớ: ai đăng ký kênh nào</div></div>
    <div class="arrow" id="a2">↓ ② một người khác gọi mutation addPost</div>
    <div class="node" id="mutation"><div class="nl">✍️ Mutation</div><div class="ns">ghi DB xong mới publish sự kiện</div></div>
    <div class="arrow" id="a3">↓ ③ publish POST_ADDED</div>
    <div class="node" id="pubsub"><div class="nl">📻 Pub/Sub</div><div class="ns">Redis/Kafka — đánh thức người đăng ký</div></div>
    <div class="arrow" id="a4">↓ ④ chạy selection set cho từng subscriber</div>
    <div class="node" id="push"><div class="nl">📨 next</div><div class="ns">đẩy về đúng cây field đã đặt hàng</div></div>
  `,
  steps: [
    { title: "1 · Khai báo trong schema", tab: "sdl", highlight: [1, 2, 3], on: ["client"],
      desc: "<code>type Subscription</code> là root type thứ ba. Field vẫn nhận tham số — <code>topicId</code> ở đây để client chỉ nghe đúng chủ đề mình quan tâm, thay vì nhận mọi bài mới trên hệ thống." },
    { title: "2 · Bắt tay WebSocket", tab: "ws", highlight: [2, 3], on: ["client", "a1", "server"],
      desc: "Khác HTTP thường, subscription không gửi header mỗi request. Token xác thực đi trong <code>connection_init</code>, server duyệt rồi trả <code>connection_ack</code>. Nhớ điều này khi làm auth (bài 13)." },
    { title: "3 · Gửi subscribe", tab: "sub", highlight: [1, 2, 3, 4, 5], on: ["server"],
      desc: "Client gửi một operation kiểu <code>subscription</code>, kèm selection set y như query. Server lưu lại: 'kết nối #1 đang nghe kênh POST_ADDED của topic 12'." },
    { title: "4 · Có người ghi dữ liệu", tab: "sdl", highlight: [7, 10, 11], on: ["a2", "mutation"],
      desc: "Một người dùng khác gọi <code>addPost</code>. Nguyên tắc: <em>ghi database xong xuôi rồi mới publish</em> — publish sớm thì subscriber có thể đọc phải trạng thái chưa commit." },
    { title: "5 · Pub/Sub đánh thức người nghe", tab: "poll", highlight: [6, 7], on: ["a3", "pubsub"],
      desc: "Sự kiện đi qua lớp pub/sub. Nếu server chạy nhiều instance, sự kiện phải qua Redis/Kafka — vì người đăng ký có thể đang nối vào instance khác với instance xử lý mutation." },
    { title: "6 · Đẩy về đúng hình dạng đã hỏi", tab: "sub", highlight: [9, 10, 11, 12], on: ["a4", "push"],
      desc: "Với mỗi subscriber, server chạy selection set <em>của riêng người đó</em> trên dữ liệu sự kiện rồi đẩy message <code>next</code>. Hai client đăng ký cùng kênh nhưng chọn field khác nhau vẫn nhận đúng thứ mình cần." }
  ],

  quiz: [
    { q: "Subscription khác Query/Mutation ở điểm cốt lõi nào?", options: [
        "Subscription không cần schema",
        "Client đăng ký một lần rồi server chủ động đẩy dữ liệu về mỗi khi có sự kiện, thay vì hỏi–đáp một lần",
        "Subscription luôn trả về mảng",
        "Subscription chạy trên HTTP GET"
      ], correct: 1,
      explanation: "Query/Mutation là hỏi–đáp rồi đóng. Subscription giữ kết nối (thường là WebSocket) và server đẩy dữ liệu về nhiều lần." },
    { q: "Trong subscription qua WebSocket, token xác thực thường được gửi ở đâu?", options: [
        "Trong header Authorization của từng message",
        "Trong payload của message connection_init lúc bắt tay",
        "Trong URL query string, luôn luôn",
        "Không cần xác thực"
      ], correct: 1,
      explanation: "WebSocket không gửi header cho từng message như HTTP. Giao thức graphql-transport-ws đặt thông tin auth trong connection_init, server duyệt trước khi ack." },
    { q: "Vì sao mutation nên publish sự kiện SAU khi đã ghi xong database?", options: [
        "Để tiết kiệm băng thông",
        "Để subscriber không đọc phải trạng thái nửa vời (dữ liệu chưa commit)",
        "Vì pub/sub không nhận được sự kiện trước khi commit",
        "Vì spec GraphQL bắt buộc"
      ], correct: 1,
      explanation: "Publish sớm thì subscriber có thể query lại và không thấy bản ghi, hoặc thấy trạng thái cũ — một lớp bug rất khó tái hiện." },
    { q: "Khi nào polling thường là lựa chọn tốt hơn subscription?", options: [
        "Khi cần độ trễ dưới một giây",
        "Khi dữ liệu đổi không thường xuyên và trễ vài chục giây vẫn chấp nhận được — polling đơn giản, không giữ trạng thái, chịu được restart",
        "Khi có rất nhiều người dùng đồng thời cần realtime",
        "Polling luôn tốt hơn subscription"
      ], correct: 1,
      explanation: "Subscription kéo theo kết nối mở, pub/sub phân tán, xử lý reconnect và lấy bù dữ liệu lỡ. Nếu 15–30 giây trễ vẫn ổn thì polling rẻ hơn nhiều." }
  ]
});
