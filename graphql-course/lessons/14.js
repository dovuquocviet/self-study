window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Thực chiến",
  title: "Thiết kế schema, Federation, và khi nào KHÔNG nên dùng GraphQL",
  subtitle: "API không có version, deprecate thay vì xoá, nhiều service một đồ thị",

  theory: `
    <p>Bài cuối gom lại những quyết định mang tính "kiến trúc" — thứ khó sửa nhất về sau.</p>
    <p><strong>1. GraphQL không đánh version.</strong> Không có <code>/v2/graphql</code>. Thay vào đó
    schema <em>tiến hoá</em>: thêm field thoải mái (client cũ không hỏi thì không ảnh hưởng),
    và khi cần bỏ field thì đánh dấu <code>@deprecated(reason: "…")</code>, theo dõi xem còn ai dùng
    không, đủ lâu rồi mới xoá. Vì server <em>biết chính xác</em> field nào được hỏi, bạn có số liệu
    thật để quyết định — điều mà REST không bao giờ có.</p>
    <p><strong>2. Thiết kế theo nghiệp vụ, không theo bảng database.</strong> Sai lầm phổ biến nhất là
    ánh xạ 1-1 mỗi bảng thành một type rồi phơi hết cột ra. Schema là <em>ngôn ngữ chung</em> giữa
    frontend, backend và sản phẩm — nó nên nói "giỏ hàng", "đơn hàng", "khuyến mãi đang áp dụng",
    chứ không phải "bảng <code>order_items</code> có cột <code>status_id</code>".</p>
    <p><strong>3. Nhiều service, một đồ thị.</strong> Công ty lớn có hàng chục service, mỗi đội một
    mảng. Hai cách ghép:</p>
    <ul>
      <li><strong>Schema stitching</strong> (cũ) — một gateway ghép thủ công các schema lại.</li>
      <li><strong>Federation</strong> (phổ biến hiện nay) — mỗi service khai phần schema của mình và
      <em>mở rộng</em> type của service khác. Service Users sở hữu <code>User</code>; service Orders
      dùng <code>@key(fields: "id")</code> để nối thêm field <code>orders</code> vào chính
      <code>User</code> đó. Gateway lắp thành một đồ thị duy nhất, client chỉ thấy một API.</li>
    </ul>
    <p><strong>4. Khi nào KHÔNG nên dùng GraphQL?</strong> Trung thực mà nói:</p>
    <ul>
      <li>API rất đơn giản, ít client, dữ liệu phẳng → REST rẻ hơn về mọi mặt.</li>
      <li>Cần cache theo HTTP/CDN mạnh (nội dung công khai, ít đổi) → REST + Cache-Control ăn đứt.</li>
      <li>Tải/lưu file, streaming nhị phân → GraphQL không sinh ra cho việc đó.</li>
      <li>Đội chưa sẵn sàng lo N+1, complexity limit, cache client → chi phí vận hành sẽ vượt lợi ích.</li>
    </ul>
    <div class="callout"><p>💡 GraphQL toả sáng nhất khi: <strong>nhiều loại client</strong> (web, iOS,
    Android, đối tác) cần <strong>hình dạng dữ liệu khác nhau</strong> từ <strong>nhiều nguồn</strong>,
    và tốc độ lặp của frontend là thứ quan trọng. Không đúng bối cảnh đó thì REST vẫn là lựa chọn
    chuyên nghiệp.</p></div>
  `,

  codeTabs: [
    { id: "evolve", label: "🌱 Tiến hoá schema", lines: [
      "type User {",
      "  id: ID!",
      "  name: String!",
      "  fullName: String @deprecated(reason: \"Dùng 'name'. Xoá sau 2026-12\")",
      "  email: String",
      "}",
      "",
      "# Thêm field mới: AN TOÀN — client cũ không hỏi thì không thấy.",
      "# Xoá field / đổi kiểu / thêm ! vào tham số: PHÁ VỠ client cũ.",
      "",
      "# Quy trình bỏ field:",
      "#  1. @deprecated kèm lý do + hạn chót",
      "#  2. đo xem còn client nào hỏi field đó không (server biết chính xác)",
      "#  3. về 0 và qua hạn -> mới xoá"
    ]},
    { id: "design", label: "🎨 Thiết kế schema", lines: [
      "# TỆ — phơi nguyên bảng database ra:",
      "type Order {",
      "  id: ID!  user_id: Int!  status_id: Int!",
      "  created_at: String!  updated_at: String!  deleted_at: String",
      "}",
      "",
      "# TỐT — nói ngôn ngữ nghiệp vụ:",
      "type Order {",
      "  id: ID!",
      "  customer: User!            # quan hệ, không phải khoá ngoại",
      "  status: OrderStatus!       # enum, không phải Int bí ẩn",
      "  placedAt: DateTime!",
      "  items: [OrderItem!]!",
      "  total: Money!              # scalar riêng: số tiền + đơn vị",
      "  canCancel: Boolean!        # câu trả lời UI cần, tính ở server",
      "}"
    ]},
    { id: "fed", label: "🕸️ Federation", lines: [
      "# --- service Users: sở hữu type User ---",
      "type User @key(fields: \"id\") {",
      "  id: ID!",
      "  name: String!",
      "}",
      "",
      "# --- service Orders: MỞ RỘNG chính User đó ---",
      "type User @key(fields: \"id\") {",
      "  id: ID! @external          # khoá để nối lại",
      "  orders: [Order!]!          # field do đội Orders sở hữu",
      "}",
      "",
      "# Gateway lắp thành MỘT đồ thị. Client chỉ thấy:",
      "query { user(id: 7) { name orders { total } } }",
      "# Gateway tự chia việc: name -> Users, orders -> Orders."
    ]},
    { id: "when", label: "⚖️ Nên / không nên", lines: [
      "# NÊN dùng GraphQL khi:",
      "#  - nhiều loại client (web, iOS, Android, đối tác) cần hình dạng khác nhau",
      "#  - dữ liệu quan hệ nhiều tầng, gom từ nhiều nguồn",
      "#  - frontend cần lặp nhanh, không muốn chờ backend đẻ endpoint",
      "",
      "# KHÔNG nên khi:",
      "#  - API đơn giản, một client, dữ liệu phẳng      -> REST rẻ hơn",
      "#  - cần cache CDN mạnh cho nội dung công khai    -> REST + Cache-Control",
      "#  - upload/stream file nhị phân                  -> không phải việc của GraphQL",
      "#  - đội chưa sẵn sàng lo N+1, complexity, cache  -> chi phí vượt lợi ích",
      "",
      "# Và luôn nhớ: dùng cả hai cũng được. GraphQL cho app,",
      "# REST cho webhook/tải file/tích hợp bên thứ ba."
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client</div><div class="ns">một query · một endpoint</div></div>
    <div class="arrow" id="a1">↓ ① gateway nhận query</div>
    <div class="node" id="gw"><div class="nl">🕸️ Gateway</div><div class="ns">giữ đồ thị hợp nhất (supergraph)</div></div>
    <div class="arrow" id="a2">↓ ② chia việc theo chủ sở hữu field</div>
    <div class="node" id="split"><div class="nl">✂️ Query plan</div><div class="ns">name → Users · orders → Orders</div></div>
    <div class="arrow" id="a3">↓ ③ gọi từng service, nối bằng @key</div>
    <div class="node" id="svc"><div class="nl">🧩 Users · Orders · Products</div><div class="ns">mỗi đội sở hữu phần schema của mình</div></div>
    <div class="arrow" id="a4">↓ ④ ghép kết quả lại</div>
    <div class="node" id="out"><div class="nl">📦 Một response</div><div class="ns">client không biết có bao nhiêu service</div></div>
  `,
  steps: [
    { title: "1 · Không đánh version, mà tiến hoá", tab: "evolve", highlight: [4, 8, 9], on: ["client"],
      desc: "Thêm field là thay đổi an toàn — client cũ không hỏi thì không ảnh hưởng. Còn xoá field, đổi kiểu, hay thêm <code>!</code> vào tham số thì phá vỡ client cũ. Đó là ranh giới bạn phải thuộc." },
    { title: "2 · @deprecated + số liệu thật", tab: "evolve", highlight: [4, 11, 12, 13, 14], on: ["client"],
      desc: "Đánh dấu <code>@deprecated</code>, IDE sẽ gạch ngang field cho lập trình viên thấy. Quan trọng hơn: server <em>đếm được</em> chính xác còn ai hỏi field đó — xuống 0 mới xoá. REST không có món này." },
    { title: "3 · Thiết kế theo nghiệp vụ", tab: "design", highlight: [2, 3, 4, 9, 10, 11, 15], on: ["a1", "gw"],
      desc: "Đừng phơi <code>status_id: Int</code> ra ngoài. Dùng <code>enum OrderStatus</code>, dùng quan hệ <code>customer: User!</code> thay khoá ngoại, và đừng ngại thêm field kiểu <code>canCancel</code> — câu trả lời mà UI cần, tính một lần ở server." },
    { title: "4 · Mỗi service sở hữu một phần", tab: "fed", highlight: [2, 3, 4, 5], on: ["gw", "a2", "split"],
      desc: "Trong Federation, đội Users <em>sở hữu</em> type <code>User</code> và khai <code>@key(fields: \"id\")</code> — khoá để các service khác nối vào. Không còn cảnh mọi đội chen nhau sửa một file schema khổng lồ." },
    { title: "5 · Service khác mở rộng type", tab: "fed", highlight: [8, 9, 10, 11], on: ["a3", "svc"],
      desc: "Đội Orders thêm field <code>orders</code> vào chính <code>User</code> đó, dùng <code>id @external</code> làm khớp nối. Hai service, hai đội, hai vòng deploy độc lập — nhưng client chỉ thấy một type <code>User</code> liền mạch." },
    { title: "6 · Và biết khi nào nên nói không", tab: "when", highlight: [6, 7, 8, 9, 10, 12, 13], on: ["a4", "out"],
      desc: "GraphQL không phải lựa chọn mặc định cho mọi API. Ít client, dữ liệu phẳng, cần cache CDN, hay tải file — REST vẫn thắng. Và hoàn toàn hợp lý khi dùng cả hai: GraphQL cho app, REST cho webhook và tích hợp bên ngoài." }
  ],

  quiz: [
    { q: "GraphQL xử lý việc thay đổi API thế nào?", options: [
        "Đánh version endpoint như /v2/graphql",
        "Tiến hoá schema: thêm field thoải mái, đánh dấu @deprecated cho field cần bỏ rồi xoá khi không còn ai dùng",
        "Mỗi client tự chọn phiên bản schema",
        "Không bao giờ được thay đổi schema"
      ], correct: 1,
      explanation: "Vì server biết chính xác field nào đang được hỏi, bạn có số liệu thật để quyết định lúc nào xoá được — thứ REST không cung cấp." },
    { q: "Thay đổi nào PHÁ VỠ client cũ?", options: [
        "Thêm một field mới vào type",
        "Thêm một tham số tuỳ chọn có giá trị mặc định",
        "Xoá một field, đổi kiểu của field, hoặc thêm dấu ! vào một tham số đang tuỳ chọn",
        "Thêm một type mới vào schema"
      ], correct: 2,
      explanation: "Thêm thì an toàn (client cũ không hỏi thì không thấy). Xoá, đổi kiểu, hay siết ràng buộc đầu vào thì làm hỏng query đang chạy." },
    { q: "Trong Federation, chỉ thị @key(fields: \"id\") dùng để làm gì?", options: [
        "Đánh dấu khoá chính trong database",
        "Khai khoá định danh để các service khác có thể tham chiếu và mở rộng chính type đó",
        "Bật cache cho type",
        "Giới hạn quyền truy cập type"
      ], correct: 1,
      explanation: "@key là khớp nối: service Users sở hữu User với khoá id, service Orders dùng chính khoá đó để gắn thêm field orders vào User. Gateway ghép lại thành một đồ thị." },
    { q: "Trường hợp nào REST thường là lựa chọn tốt hơn GraphQL?", options: [
        "Nhiều loại client cần hình dạng dữ liệu khác nhau",
        "Dữ liệu quan hệ nhiều tầng gom từ nhiều nguồn",
        "Nội dung công khai ít thay đổi cần cache mạnh qua CDN, hoặc tải/stream file nhị phân",
        "Frontend cần lặp nhanh mà không chờ backend"
      ], correct: 2,
      explanation: "GraphQL đi qua POST một endpoint nên khó tận dụng cache HTTP/CDN, và không sinh ra cho dữ liệu nhị phân. Dùng cả hai trong một hệ thống là hoàn toàn hợp lý." }
  ]
});
