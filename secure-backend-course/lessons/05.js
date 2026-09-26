window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Injection — khi dữ liệu biến thành lệnh",
  title: "NoSQL, LDAP, filter injection — không có SQL vẫn bị inject",
  subtitle: "Khi client gửi object thay vì chuỗi, và object đó chứa toán tử",

  theory: `
    <p>Nhiều người nghĩ "dùng NoSQL thì hết SQL Injection". Đúng là hết <em>SQL</em>, nhưng Injection thì vẫn còn —
    chỉ đổi hình dạng. Nguyên tắc vẫn vậy: <strong>dữ liệu người dùng không được phép trở thành một phần cấu trúc của truy vấn</strong>.</p>

    <p><strong>1. Operator injection — khi JSON body chứa toán tử.</strong> Truy vấn kiểu document (MongoDB và các DB tương tự) được viết bằng object:
    <code>{ email: X, password: Y }</code>. Nếu backend lấy nguyên <code>req.body.password</code> đặt vào, và client gửi
    <code>{"password": {"$ne": null}}</code> thay vì một chuỗi, truy vấn thành "password <em>khác null</em>" → khớp mọi user → đăng nhập không cần mật khẩu.</p>
    <p>Các toán tử hay bị lạm dụng: <code>$ne</code>, <code>$gt</code>, <code>$regex</code> (dò mật khẩu/token từng ký tự: <code>^a</code>, <code>^ab</code>…),
    <code>$in</code>, <code>$where</code>/<code>$function</code> (chạy JavaScript phía server — nguy hiểm nhất), <code>$expr</code>.</p>
    <p>Lưu ý: chuyện này không chỉ xảy ra với JSON. Nhiều framework parse query string <code>?password[$ne]=x</code> thành object lồng nhau
    <code>{ password: { $ne: "x" } }</code> — nên cả form/GET cũng có thể mang object.</p>

    <p><strong>2. Cách chữa (áp dụng cho mọi ngôn ngữ)</strong></p>
    <ul>
      <li><strong>Ép kiểu tại ranh giới</strong> (bài 03): <code>password</code> phải là string. Object/mảng → 400. Đây là cách chữa triệt để nhất.</li>
      <li>Không bao giờ truyền nguyên <code>req.body</code>/<code>req.query</code> làm filter: <code>collection.find(req.query)</code> là cho client tự viết truy vấn.</li>
      <li>Dựng filter từ các field đã biết: <code>{ email: String(email) }</code>. Nếu cần toán tử, dùng <code>$eq</code> tường minh: <code>{ email: { $eq: email } }</code>.</li>
      <li>Tắt/không dùng tính năng chạy JS phía server (<code>$where</code>, <code>mapReduce</code>, <code>$function</code>) — chi tiết ở khoá Database.</li>
      <li>Một số thư viện có chế độ "sanitize filter" (loại key bắt đầu bằng <code>$</code> hoặc chứa <code>.</code>) — nên bật, nhưng coi là lớp phụ.</li>
    </ul>

    <p><strong>3. "Filter API" tự chế — injection kiểu mới.</strong> API cho phép client gửi bộ lọc linh hoạt, ví dụ
    <code>GET /users?filter[role]=admin&amp;filter[password_hash][startsWith]=$2b$10$a</code>. Nếu backend chuyển thẳng mọi field thành điều kiện truy vấn,
    client có thể lọc theo cả field bí mật (<code>password_hash</code>, <code>reset_token</code>) và dò giá trị của chúng từng ký tự — dù không field nào được trả về.
    Chữa: <strong>allowlist các field được phép lọc/sắp xếp</strong> và các toán tử được phép.</p>

    <p><strong>4. Các ngôn ngữ truy vấn khác cũng bị</strong></p>
    <table>
      <tr><th>Ngữ cảnh</th><th>Payload ví dụ</th><th>Cách chữa</th></tr>
      <tr><td>LDAP (đăng nhập doanh nghiệp, Active Directory)</td><td><code>user = *)(uid=*))(|(uid=*</code> phá filter <code>(&amp;(uid=USER)(pass=...))</code></td><td>Escape theo chuẩn LDAP (<code>* ( ) \\ NUL</code>) bằng hàm của thư viện, hoặc bind với DN cố định</td></tr>
      <tr><td>XPath / XQuery</td><td><code>' or '1'='1</code></td><td>Truy vấn có tham số (biến XPath), không nối chuỗi</td></tr>
      <tr><td>Truy vấn tìm kiếm (Elasticsearch/OpenSearch query_string, Lucene)</td><td>Cú pháp <code>field:value OR *</code>, script query</td><td>Dùng query có cấu trúc (term/match), không dùng query_string với input thô; tắt script nếu không cần</td></tr>
      <tr><td>GraphQL (khi resolver tự ghép truy vấn DB)</td><td>Argument được nối vào SQL/NoSQL bên trong resolver</td><td>Resolver vẫn phải dùng parameterized query — GraphQL không tự bảo vệ tầng dưới</td></tr>
      <tr><td>Header/log/CSV</td><td>CRLF <code>\\r\\n</code> trong header; <code>=HYPERLINK(...)</code> trong file CSV xuất ra Excel</td><td>Bài 19 (header) và bài 23 (CSV injection)</td></tr>
    </table>

    <div class="callout"><p>💡 Câu hỏi để tự kiểm tra bất cứ đoạn code truy vấn nào: <em>"Nếu người dùng gửi một object/mảng/chuỗi có ký tự đặc biệt thay vì giá trị mình mong đợi,
    cấu trúc truy vấn có thay đổi không?"</em> Nếu có → injection, dù đó là SQL, Mongo, LDAP hay API filter tự viết.</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Truyền nguyên body", lines: [
      "// Pseudo-code, driver document DB (Mongo và tương tự)",
      "handle POST /login (req):",
      "    user = db.users.findOne({",
      "        email:    req.body.email,",
      "        password: req.body.password      // mong đợi chuỗi...",
      "    })",
      "    if user: loginAs(user.id)",
      "",
      "// Kẻ tấn công gửi JSON:",
      "// { \"email\": \"admin@shop.com\", \"password\": { \"$ne\": null } }",
      "// => findOne({ email: 'admin@shop.com', password: { $ne: null } })",
      "// => 'password khác null' -> khớp -> vào được admin"
    ]},
    { id: "regex", label: "🕵️ $regex dò dữ liệu", lines: [
      "# Dò token reset mật khẩu từng ký tự bằng $regex",
      "POST /reset/verify   {\"email\":\"victim@x.com\", \"token\": {\"$regex\": \"^a\"}}   -> 400",
      "POST /reset/verify   {\"email\":\"victim@x.com\", \"token\": {\"$regex\": \"^b\"}}   -> 400",
      "POST /reset/verify   {\"email\":\"victim@x.com\", \"token\": {\"$regex\": \"^c\"}}   -> 200 !",
      "POST /reset/verify   {\"email\":\"victim@x.com\", \"token\": {\"$regex\": \"^ca\"}}  -> 400",
      "...",
      "",
      "# Query string cũng mang được object (nhiều framework tự parse):",
      "GET /users?role[$ne]=nobody        => { role: { $ne: 'nobody' } }  -> trả mọi user",
      "GET /users?age[$gt]=                => { age: { $gt: '' } }"
    ]},
    { id: "safe", label: "✅ Ép kiểu + dựng filter", lines: [
      "LoginBody = { email: string(format=email, max=254), password: string(max=200) }",
      "",
      "handle POST /login (req):",
      "    body = LoginBody.parse(req.body)      // password là object -> 400",
      "    user = db.users.findOne({ email: { $eq: body.email } })   // chỉ tìm theo email",
      "    if user and verifyPassword(body.password, user.password_hash):",
      "        loginAs(user.id)",
      "",
      "// Không bao giờ: db.users.find(req.query)",
      "// Không bao giờ: so mật khẩu trong truy vấn (xem bài lưu mật khẩu)"
    ]},
    { id: "filter", label: "⚠️ Filter API", lines: [
      "// API lọc linh hoạt tự viết — dễ thành injection",
      "// GET /users?filter[password_hash][startsWith]=$2b$10$a",
      "",
      "FILTERABLE = { \"role\": [\"eq\", \"in\"], \"created_at\": [\"gt\", \"lt\"], \"name\": [\"contains\"] }",
      "SORTABLE   = [\"created_at\", \"name\"]",
      "",
      "function buildFilter(q):",
      "    f = {}",
      "    for field, ops in q.filter:",
      "        if field not in FILTERABLE: reject(400)           // chặn password_hash, reset_token",
      "        for op, val in ops:",
      "            if op not in FILTERABLE[field]: reject(400)",
      "            f[field][op] = castToFieldType(field, val)   // ép kiểu theo field",
      "    return f"
    ]},
    { id: "ldap", label: "🌐 LDAP / search", lines: [
      "// LDAP: filter dựng bằng chuỗi",
      "filter = \"(&(uid=\" + user + \")(objectClass=person))\"",
      "// user = \"*)(uid=*))(|(uid=*\"  -> filter luôn đúng, trả mọi người dùng",
      "",
      "// Sửa: escape theo chuẩn LDAP bằng hàm thư viện",
      "filter = \"(&(uid=\" + ldapEscapeFilter(user) + \")(objectClass=person))\"",
      "",
      "// Search engine: KHÔNG đưa input thô vào query_string",
      "search({ query_string: { query: userInput } })            // ❌ cú pháp Lucene đầy đủ",
      "search({ match: { title: { query: userInput } } })        // ✅ chỉ là văn bản cần tìm"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📨 Client gửi</div><div class="ns">{ "password": { "$ne": null } }</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="check"><div class="nl">📐 Ép kiểu tại ranh giới</div><div class="ns">password phải là string — object → 400</div></div>
    <div class="arrow" id="a2">↓ nếu thiếu bước trên</div>
    <div class="node" id="query"><div class="nl">🧩 Truy vấn bị đổi cấu trúc</div><div class="ns">'bằng X' thành 'khác null' / 'khớp regex'</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="db"><div class="nl">🗄️ Document DB / LDAP / search</div><div class="ns">trả về dữ liệu không nên trả</div></div>
  `,
  steps: [
    { title: "1 · Code trông vô hại", tab: "vuln", highlight: [3, 4, 5], on: ["client"],
      desc: "Không có chuỗi SQL nào, không có nối chuỗi nào. Nhưng giá trị <code>req.body.password</code> có thể là <em>bất kỳ kiểu JSON nào</em>, không chỉ chuỗi." },
    { title: "2 · Object thay cho chuỗi", tab: "vuln", highlight: [10, 11, 12], on: ["client", "a2", "query", "a3", "db"],
      desc: "<code>{\"$ne\": null}</code> biến điều kiện 'password bằng X' thành 'password khác null'. Cấu trúc truy vấn đã bị người dùng thay đổi — đúng định nghĩa injection." },
    { title: "3 · Dò bí mật bằng $regex", tab: "regex", highlight: [2, 3, 4, 5, 9], on: ["query", "db"],
      desc: "Không trả dữ liệu nào nhưng response khác nhau khi khớp/không khớp → dò token từng ký tự. Query string như <code>role[$ne]=</code> cũng được nhiều framework parse thành object." },
    { title: "4 · Ép kiểu, dựng filter từ field đã biết", tab: "safe", highlight: [1, 4, 5, 6], on: ["check", "a1"],
      desc: "Parse body theo schema: password là object → 400 ngay. Tìm user chỉ theo email (dùng <code>$eq</code> tường minh), so mật khẩu bằng hàm verify ở tầng ứng dụng." },
    { title: "5 · Filter API cần allowlist", tab: "filter", highlight: [2, 4, 10, 12, 13], on: ["check"],
      desc: "API lọc 'linh hoạt' mà không giới hạn field cho phép client lọc theo <code>password_hash</code> và dò nó. Allowlist field + toán tử + ép kiểu theo field." },
    { title: "6 · LDAP, search engine: cùng một bệnh", tab: "ldap", highlight: [2, 3, 6, 9, 10], on: ["query", "db"],
      desc: "Mọi ngôn ngữ truy vấn đều có ký tự đặc biệt. Dùng API có cấu trúc/có tham số hoặc hàm escape của thư viện — không tự nối chuỗi." }
  ],

  quiz: [
    { q: "Dùng document DB (không có SQL) thì có còn bị Injection không?", options: [
        "Không, NoSQL miễn nhiễm injection",
        "Có — operator injection, $where/JS phía server, filter tự do đều là injection",
        "Chỉ bị nếu dùng SQL song song",
        "Chỉ bị khi chạy trên Windows"
      ], correct: 1,
      explanation: "Hình dạng khác nhưng bản chất giống: dữ liệu người dùng thay đổi cấu trúc truy vấn." },
    { q: "Body {\"password\": {\"$ne\": null}} gửi tới code findOne({email, password: req.body.password}). Kết quả?", options: [
        "Lỗi cú pháp, không nguy hiểm",
        "Điều kiện thành 'password khác null' → khớp user → đăng nhập không cần mật khẩu",
        "DB tự chuyển object thành chuỗi",
        "Chỉ lỗi nếu email sai"
      ], correct: 1,
      explanation: "Toán tử $ne được DB hiểu như một phần truy vấn, không phải giá trị cần so sánh." },
    { q: "Cách chữa triệt để nhất cho operator injection là gì?", options: [
        "Dùng regex chặn chữ 'ne'",
        "Ép kiểu tại ranh giới: field mong đợi là string thì object/mảng bị từ chối",
        "Đổi tên field password",
        "Mã hoá body bằng base64"
      ], correct: 1,
      explanation: "Khi password chắc chắn là string, không còn chỗ cho toán tử lọt vào truy vấn." },
    { q: "Vì sao query string (GET) cũng có thể gây operator injection?", options: [
        "Vì GET luôn không an toàn",
        "Vì nhiều framework tự parse ?field[$ne]=x thành object lồng { field: { $ne: 'x' } }",
        "Vì trình duyệt tự thêm toán tử",
        "Không thể, chỉ JSON mới gây được"
      ], correct: 1,
      explanation: "Bộ parse query string 'thông minh' tạo object lồng nhau — phải ép kiểu cả tham số query." },
    { q: "Response không trả token, nhưng dùng {\"token\": {\"$regex\": \"^c\"}} thấy 200 thay vì 400. Kẻ tấn công làm được gì?", options: [
        "Không làm được gì vì token không được trả về",
        "Dò token từng ký tự dựa trên khác biệt response",
        "Chỉ làm server chậm",
        "Đổi được mật khẩu của chính mình"
      ], correct: 1,
      explanation: "Giống blind SQLi: mỗi request trả lời một câu hỏi đúng/sai, đủ để dò ra toàn bộ bí mật." },
    { q: "API filter cho phép ?filter[password_hash][startsWith]=... Nguyên nhân gốc là gì?", options: [
        "Hash quá yếu",
        "Backend không allowlist các field/toán tử được phép lọc",
        "Thiếu HTTPS",
        "Dùng GET thay vì POST"
      ], correct: 1,
      explanation: "Cho lọc theo field bí mật = cho dò giá trị của nó. Chỉ cho phép lọc/sắp xếp trên các field đã khai báo." },
    { q: "Toán tử nào nguy hiểm nhất vì có thể chạy code JavaScript phía server DB?", options: [
        "$eq",
        "$in",
        "$where / $function",
        "$exists"
      ], correct: 2,
      explanation: "$where và $function thực thi JS trên server DB — injection vào đây có thể đọc dữ liệu tuỳ ý hoặc gây DoS. Nên tắt nếu không dùng." },
    { q: "LDAP filter (&(uid=USER)(objectClass=person)) với USER = '*)(uid=*))(|(uid=*'. Chuyện gì xảy ra?", options: [
        "Không sao vì LDAP không có injection",
        "Filter bị phá cấu trúc, trả về mọi người dùng",
        "LDAP server bị tắt",
        "Chỉ lỗi cú pháp"
      ], correct: 1,
      explanation: "Các ký tự * ( ) phá cấu trúc filter. Phải escape theo chuẩn LDAP bằng hàm thư viện." },
    { q: "Dùng GraphQL thì resolver có cần parameterized query không?", options: [
        "Không, GraphQL tự chống injection",
        "Có — GraphQL chỉ là lớp API, resolver tự ghép truy vấn DB thì vẫn bị injection như thường",
        "Chỉ khi dùng subscription",
        "Chỉ khi dùng mutation"
      ], correct: 1,
      explanation: "GraphQL kiểm tra kiểu ở tầng API, nhưng không bảo vệ cách resolver xây truy vấn xuống DB." },
    { q: "Với search engine, cách nào an toàn hơn khi tìm theo từ khoá người dùng nhập?", options: [
        "query_string với input thô",
        "Query có cấu trúc (match/term) chỉ coi input là văn bản cần tìm",
        "Nối input vào script query",
        "Cho client gửi nguyên DSL truy vấn"
      ], correct: 1,
      explanation: "query_string hiểu toàn bộ cú pháp (OR, *, field:...). match/term coi input chỉ là dữ liệu." }
  ]
});
