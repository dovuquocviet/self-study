window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Nền tảng",
  title: "Query đầu tiên — selection set, tham số và hình dạng response",
  subtitle: "Cách một câu query được viết, gửi đi và biến thành JSON",

  theory: `
    <p>Một query GraphQL chỉ gồm <strong>các field lồng nhau</strong>. Cụm field nằm trong cặp
    ngoặc nhọn gọi là <strong>selection set</strong> — "tôi chọn những thứ này".</p>
    <p>Quy tắc duy nhất phải nhớ: <em>field trả về scalar thì dừng, field trả về object thì
    <strong>bắt buộc</strong> phải mở ngoặc chọn tiếp</em>. Hỏi <code>user</code> mà không nói rõ
    muốn field nào của user là lỗi cú pháp — vì server không tự đoán bạn cần gì.</p>
    <ul>
      <li><strong>Tham số (arguments)</strong> đặt trong ngoặc tròn ngay sau tên field:
      <code>user(id: 7)</code>. Điểm mạnh so với REST: <em>bất kỳ field nào ở bất kỳ tầng nào</em>
      cũng nhận được tham số riêng — <code>posts(last: 3)</code> nằm sâu trong cây vẫn được.</li>
      <li>Toàn bộ query gửi lên trong body JSON: <code>{ "query": "…", "variables": { … } }</code>,
      qua <code>POST /graphql</code>.</li>
      <li>Response luôn có dạng <code>{ "data": … }</code> (và <code>"errors"</code> nếu có sự cố —
      bài 11). Phần <code>data</code> có hình dạng <em>y hệt</em> selection set.</li>
    </ul>
    <p>Một chi tiết hay bị bỏ qua: GraphQL gần như luôn dùng <strong>HTTP 200</strong>, kể cả khi có
    lỗi nghiệp vụ. Lỗi nằm trong body, không nằm ở status code. Đừng bắt lỗi kiểu REST
    (<code>if (res.status !== 200)</code>) khi làm việc với GraphQL.</p>
    <div class="callout"><p>💡 Muốn thử ngay? Mọi GraphQL server đều có sẵn một IDE trên trình duyệt
    (GraphiQL / Apollo Sandbox): gõ query bên trái, bấm ▶, thấy JSON bên phải, có autocomplete lấy từ
    schema. Đây là cách học GraphQL nhanh nhất — nghịch trực tiếp thay vì đọc tài liệu.</p></div>
  `,

  codeTabs: [
    { id: "query", label: "💠 Query", lines: [
      "query GetProfile {          # tên operation - tuỳ chọn, nhưng nên đặt",
      "  user(id: 7) {             # tham số ngay tại field",
      "    id",
      "    name                    # scalar -> dừng ở đây",
      "    bio",
      "    posts(last: 2) {        # object -> BẮT BUỘC chọn tiếp",
      "      title",
      "      author { name }       # đi sâu bao nhiêu tầng cũng được",
      "    }",
      "  }",
      "}"
    ]},
    { id: "http", label: "🌐 Gửi qua HTTP", lines: [
      "POST /graphql HTTP/1.1",
      "Content-Type: application/json",
      "",
      "{",
      "  \"query\": \"query GetProfile { user(id: 7) { name } }\",",
      "  \"operationName\": \"GetProfile\",",
      "  \"variables\": {}",
      "}",
      "",
      "# Chú ý: GraphQL trả HTTP 200 gần như mọi lúc.",
      "# Lỗi nghiệp vụ nằm trong body (mảng errors), không nằm ở status."
    ]},
    { id: "resp", label: "📦 Response", lines: [
      "HTTP/1.1 200 OK",
      "{",
      "  \"data\": {",
      "    \"user\": {",
      "      \"id\": \"7\",",
      "      \"name\": \"An\",",
      "      \"bio\": null,                    # bio nullable -> null hợp lệ",
      "      \"posts\": [",
      "        { \"title\": \"Học GraphQL\", \"author\": { \"name\": \"An\" } },",
      "        { \"title\": \"Schema là gì\", \"author\": { \"name\": \"An\" } }",
      "      ]",
      "    }",
      "  }",
      "}"
    ]},
    { id: "err", label: "🚫 Query sai", lines: [
      "# Gõ nhầm 'nmae' — server bắt được ngay ở bước validate",
      "query { user(id: 7) { nmae } }",
      "",
      "HTTP/1.1 200 OK",
      "{ \"errors\": [ {",
      "    \"message\": \"Cannot query field 'nmae' on type 'User'.\",",
      "    \"locations\": [ { \"line\": 1, \"column\": 23 } ] } ] }",
      "",
      "# Không có key 'data' vì query còn chưa được chạy."
    ]}
  ],

  stageHtml: `
    <div class="node" id="write"><div class="nl">✍️ Viết query</div><div class="ns">selection set — chọn field lồng nhau</div></div>
    <div class="arrow" id="a1">↓ ① POST /graphql, query nằm trong body JSON</div>
    <div class="node" id="parse"><div class="nl">🧩 Parse</div><div class="ns">văn bản → cây cú pháp (AST)</div></div>
    <div class="arrow" id="a2">↓ ② đối chiếu schema</div>
    <div class="node" id="validate"><div class="nl">✅ Validate</div><div class="ns">field có thật? tham số đúng kiểu?</div></div>
    <div class="arrow" id="a3">↓ ③ hợp lệ → thực thi</div>
    <div class="node" id="exec"><div class="nl">⚙️ Execute</div><div class="ns">đi từng field, gom giá trị</div></div>
    <div class="arrow" id="a4">↓ ④ dựng JSON theo đúng thứ tự đã hỏi</div>
    <div class="node" id="json"><div class="nl">📦 data</div><div class="ns">hình dạng soi gương với query</div></div>
  `,
  steps: [
    { title: "1 · Selection set", tab: "query", highlight: [2, 3, 4, 5], on: ["write"],
      desc: "Cụm trong ngoặc nhọn là <strong>selection set</strong>. <code>name</code> và <code>bio</code> là scalar nên dừng lại ở đó. Không có dấu phẩy, không có kiểu — chỉ là danh sách tên field." },
    { title: "2 · Field object phải chọn tiếp", tab: "query", highlight: [6, 7, 8], on: ["write"],
      desc: "<code>posts</code> trả về object nên <em>bắt buộc</em> mở ngoặc chọn tiếp — bỏ trống là lỗi. Đây chính là cơ chế chống over-fetching: server không bao giờ tự ý trả thứ bạn chưa hỏi." },
    { title: "3 · Tham số ở mọi tầng", tab: "query", highlight: [2, 6], on: ["write", "a1"],
      desc: "<code>user(id: 7)</code> và <code>posts(last: 2)</code> — tham số không chỉ dành cho endpoint gốc như REST, mà gắn được vào <em>bất kỳ field nào</em>, kể cả nằm sâu trong cây." },
    { title: "4 · Gửi qua HTTP", tab: "http", highlight: [1, 4, 5, 6], on: ["a1", "parse"],
      desc: "Query đi trong body JSON, dưới key <code>query</code>. Server parse chuỗi đó thành cây cú pháp (AST). Đặt tên operation (<code>GetProfile</code>) giúp log và công cụ đo hiệu năng dễ đọc hơn nhiều." },
    { title: "5 · Validate rồi mới chạy", tab: "err", highlight: [2, 5, 6], on: ["a2", "validate"],
      desc: "Gõ nhầm <code>nmae</code>? Server so với schema và trả lỗi kèm <code>locations</code> (dòng, cột) — <em>chưa</em> chạm database. Chú ý: vẫn là HTTP 200, và response không có key <code>data</code> vì chưa chạy gì cả." },
    { title: "6 · Response soi gương query", tab: "resp", highlight: [3, 4, 6, 7, 9], on: ["a3", "exec", "a4", "json"],
      desc: "Thực thi xong, server dựng JSON theo <em>đúng</em> thứ tự và hình dạng bạn đã hỏi. <code>bio</code> khai là <code>String</code> (nullable) nên <code>null</code> ở đây hoàn toàn hợp lệ." }
  ],

  quiz: [
    { q: "Vì sao query 'query { user(id: 7) }' bị lỗi cú pháp?", options: [
        "Vì thiếu tên operation",
        "Vì user trả về object type nên bắt buộc phải có selection set chọn field bên trong",
        "Vì id phải là chuỗi",
        "Vì thiếu dấu phẩy giữa các field"
      ], correct: 1,
      explanation: "Field trả về object thì bắt buộc chọn tiếp; field scalar thì bắt buộc KHÔNG được chọn tiếp. Đây là cách GraphQL đảm bảo client luôn nói rõ mình cần gì." },
    { q: "Khi một query GraphQL bị lỗi validate, HTTP status thường là gì?", options: [
        "400 Bad Request",
        "422 Unprocessable Entity",
        "200 OK, lỗi nằm trong mảng errors của body",
        "500 Internal Server Error"
      ], correct: 2,
      explanation: "GraphQL gần như luôn trả 200 và đặt lỗi vào body. Vì thế code client phải đọc mảng errors thay vì chỉ kiểm tra status code như khi làm REST." },
    { q: "Tham số (arguments) trong GraphQL có thể đặt ở đâu?", options: [
        "Chỉ ở field gốc của Query",
        "Chỉ ở Mutation",
        "Ở bất kỳ field nào, kể cả field nằm sâu trong cây",
        "Chỉ ở query string của URL"
      ], correct: 2,
      explanation: "Ví dụ posts(last: 3) nằm bên trong user(id: 7). Đây là điểm linh hoạt hơn hẳn REST, nơi tham số chỉ gắn được vào endpoint ngoài cùng." },
    { q: "Phần 'data' trong response có hình dạng thế nào?", options: [
        "Luôn là mảng phẳng các bản ghi",
        "Do server tự quyết định theo endpoint",
        "Giống hệt hình dạng selection set mà client đã gửi",
        "Được nén thành chuỗi base64"
      ], correct: 2,
      explanation: "Response soi gương với query — nhìn query là biết JSON trả về trông ra sao, không cần mở tài liệu API." }
  ]
});
