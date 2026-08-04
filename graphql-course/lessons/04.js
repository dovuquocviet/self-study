window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Ngôn ngữ truy vấn",
  title: "Biến, alias, fragment, directive — bộ đồ nghề viết query",
  subtitle: "Bốn công cụ biến query từ 'chạy được' thành 'dùng được trong dự án thật'",

  theory: `
    <p>Bốn thứ dưới đây xuất hiện trong hầu hết query của dự án thật. Học một lượt cho gọn.</p>
    <p><strong>1. Variables ($var)</strong> — đừng nhét giá trị thẳng vào chuỗi query. Khai báo biến
    ở đầu operation rồi truyền giá trị qua key <code>variables</code>. Lợi ích: query trở thành
    <em>hằng số</em> (cache được, kiểm tra kiểu được, không dính lỗi nối chuỗi), và giá trị người dùng
    nhập không bao giờ trộn vào cú pháp.</p>
    <p><strong>2. Alias</strong> — cùng một field gọi hai lần với tham số khác nhau sẽ đụng tên trong
    JSON. Đặt bí danh: <code>hanoi: city(id: 1)</code>. Alias cũng dùng để đổi tên field cho hợp với
    code client.</p>
    <p><strong>3. Fragment</strong> — cụm field dùng đi dùng lại, khai một lần rồi
    <code>...tênFragment</code> ở mọi nơi. Trong dự án thật, mỗi component UI thường sở hữu một
    fragment mô tả đúng dữ liệu nó cần (colocation) — sửa component thì sửa fragment ngay cạnh,
    khỏi sợ quên.</p>
    <p><strong>4. Directive</strong> — chỉ thị đính vào field để đổi cách thực thi. Hai cái có sẵn
    trong mọi server: <code>@include(if: …)</code> và <code>@skip(if: …)</code>, cho phép bật/tắt cả
    một nhánh query bằng biến boolean — thay vì viết hai query gần giống nhau.</p>
    <div class="callout"><p>💡 Quy tắc nghề: <strong>mọi giá trị động đều đi qua variables</strong>.
    Ngoài an toàn, nó còn mở đường cho "persisted query" (bài 13) — client chỉ gửi mã băm của
    query thay vì cả chuỗi dài.</p></div>
  `,

  codeTabs: [
    { id: "vars", label: "🔤 Variables", lines: [
      "# Khai kiểu của biến ngay sau tên operation",
      "query GetUser($id: ID!, $withPosts: Boolean! = false) {",
      "  user(id: $id) {",
      "    name",
      "    posts @include(if: $withPosts) { title }",
      "  }",
      "}",
      "",
      "# Giá trị đi riêng, không nối chuỗi:",
      "{ \"query\": \"…\",",
      "  \"variables\": { \"id\": \"7\", \"withPosts\": true } }"
    ]},
    { id: "alias", label: "🏷️ Alias", lines: [
      "# Không có alias: hai field 'user' đụng tên trong JSON -> lỗi",
      "query {",
      "  tacGia:  user(id: 7) { name }",
      "  nguoiSua: user(id: 9) { name }",
      "}",
      "",
      "# Response mang đúng tên bí danh:",
      "{ \"data\": {",
      "    \"tacGia\":   { \"name\": \"An\" },",
      "    \"nguoiSua\": { \"name\": \"Bình\" } } }"
    ]},
    { id: "frag", label: "🧩 Fragment", lines: [
      "# Khai một lần, dùng nhiều nơi",
      "fragment TheNguoiDung on User {",
      "  id",
      "  name",
      "  avatarUrl",
      "}",
      "",
      "query {",
      "  user(id: 7) { ...TheNguoiDung  bio }",
      "  post(id: 1) {",
      "    title",
      "    author { ...TheNguoiDung }   # cùng cụm field, khỏi chép lại",
      "  }",
      "}"
    ]},
    { id: "dir", label: "🎚️ Directive", lines: [
      "# @include(if:) — chỉ lấy nhánh này khi biến là true",
      "# @skip(if:)    — ngược lại, bỏ qua nhánh khi biến là true",
      "",
      "query Feed($chiTiet: Boolean!) {",
      "  posts {",
      "    title",
      "    body     @include(if: $chiTiet)",
      "    comments @skip(if: $chiTiet) { id }",
      "  }",
      "}",
      "",
      "# Một query dùng cho cả màn hình danh sách lẫn màn hình chi tiết,",
      "# thay vì viết hai query na ná nhau rồi quên đồng bộ."
    ]}
  ],

  stageHtml: `
    <div class="node" id="tpl"><div class="nl">📄 Query cố định</div><div class="ns">chuỗi hằng, không đổi giữa các lần gọi</div></div>
    <div class="arrow" id="a1">↓ ① giá trị động đi riêng qua variables</div>
    <div class="node" id="vars"><div class="nl">🔤 variables</div><div class="ns">{ id: "7", withPosts: true }</div></div>
    <div class="arrow" id="a2">↓ ② server kiểm kiểu biến với schema</div>
    <div class="node" id="frag"><div class="nl">🧩 Fragment</div><div class="ns">được 'trải phẳng' vào selection set</div></div>
    <div class="arrow" id="a3">↓ ③ directive quyết định giữ hay bỏ nhánh</div>
    <div class="node" id="dir"><div class="nl">🎚️ @include / @skip</div><div class="ns">cắt bớt cây trước khi thực thi</div></div>
    <div class="arrow" id="a4">↓ ④ alias đặt tên key trong JSON</div>
    <div class="node" id="out"><div class="nl">📦 data</div><div class="ns">key theo alias · nhánh theo directive</div></div>
  `,
  steps: [
    { title: "1 · Khai báo biến", tab: "vars", highlight: [2, 3], on: ["tpl"],
      desc: "Biến khai ngay sau tên operation, có kiểu đàng hoàng: <code>$id: ID!</code>. Có thể đặt giá trị mặc định (<code>= false</code>). Nhờ vậy chuỗi query <em>không đổi</em> giữa các lần gọi." },
    { title: "2 · Truyền giá trị riêng", tab: "vars", highlight: [10, 11], on: ["a1", "vars"],
      desc: "Giá trị nằm ở key <code>variables</code> của body, hoàn toàn tách khỏi cú pháp query. Không còn nối chuỗi — không lo giá trị người dùng nhập phá vỡ câu truy vấn, và server kiểm tra kiểu giúp bạn." },
    { title: "3 · Alias khi gọi trùng field", tab: "alias", highlight: [3, 4, 9, 10], on: ["a2", "out"],
      desc: "Gọi <code>user</code> hai lần với id khác nhau thì JSON không biết chọn key nào. Alias giải quyết: key trong <code>data</code> mang đúng tên bí danh bạn đặt." },
    { title: "4 · Fragment gom cụm field", tab: "frag", highlight: [2, 3, 4, 5], on: ["frag"],
      desc: "<code>fragment TheNguoiDung on User</code> khai một cụm field gắn với type <code>User</code>. Nó chỉ dùng được ở nơi có kiểu <code>User</code> — server kiểm tra điều đó." },
    { title: "5 · Trải fragment vào query", tab: "frag", highlight: [9, 12], on: ["frag", "a3"],
      desc: "<code>...TheNguoiDung</code> được 'trải phẳng' vào selection set trước khi thực thi. Dùng ở cả <code>user</code> lẫn <code>post.author</code> — sửa fragment một chỗ, mọi nơi đổi theo." },
    { title: "6 · Directive cắt nhánh", tab: "dir", highlight: [6, 7], on: ["dir", "a4", "out"],
      desc: "<code>@include(if: $chiTiet)</code> giữ field khi biến true, <code>@skip</code> thì ngược lại. Server cắt nhánh <em>trước khi</em> chạy resolver — nghĩa là nhánh bị bỏ thì không tốn một truy vấn database nào." }
  ],

  quiz: [
    { q: "Vì sao nên dùng variables thay vì nhét giá trị thẳng vào chuỗi query?", options: [
        "Vì query sẽ chạy nhanh hơn 10 lần",
        "Vì query trở thành chuỗi hằng (cache/persist được), giá trị được kiểm kiểu, và không phải nối chuỗi",
        "Vì GraphQL không cho phép ghi giá trị trực tiếp",
        "Vì variables tự động mã hoá dữ liệu"
      ], correct: 1,
      explanation: "Query cố định + giá trị tách riêng: an toàn hơn, kiểm kiểu được, và là điều kiện để dùng persisted query sau này. GraphQL vẫn CHO phép ghi giá trị trực tiếp, chỉ là không nên." },
    { q: "Khi nào bắt buộc phải dùng alias?", options: [
        "Khi query có nhiều hơn 3 field",
        "Khi gọi cùng một field nhiều lần trong một selection set (ví dụ user(id:7) và user(id:9))",
        "Khi dùng fragment",
        "Khi field trả về mảng"
      ], correct: 1,
      explanation: "Không có alias thì hai kết quả sẽ tranh nhau cùng một key trong JSON. Alias cũng tiện để đổi tên field cho khớp với code client." },
    { q: "Fragment 'on User' có thể dùng ở đâu?", options: [
        "Ở bất kỳ field nào trong query",
        "Chỉ ở field gốc của Query",
        "Ở những vị trí mà kiểu dữ liệu là User (hoặc tương thích với User)",
        "Chỉ trong Mutation"
      ], correct: 2,
      explanation: "Fragment gắn với một type cụ thể; server kiểm tra tính tương thích. Nhờ vậy mỗi component UI có thể sở hữu fragment mô tả đúng dữ liệu nó cần." },
    { q: "@skip(if: $x) khác @include(if: $x) thế nào?", options: [
        "@skip bỏ field khi $x là true; @include chỉ giữ field khi $x là true",
        "@skip chạy ở client, @include chạy ở server",
        "@skip chỉ dùng cho mutation",
        "Hai directive này hoàn toàn giống nhau"
      ], correct: 0,
      explanation: "Hai directive ngược nhau, đều nhận biến boolean và đều được xử lý trước khi thực thi — nhánh bị loại sẽ không chạy resolver." }
  ]
});
