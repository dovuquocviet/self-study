window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Injection — khi dữ liệu biến thành lệnh",
  title: "SQL Injection — lỗi kinh điển nhất",
  subtitle: "Nối chuỗi thành câu SQL = cho người lạ viết code chạy trong database của bạn",

  theory: `
    <p><strong>Injection</strong> là cả một họ lỗ hổng có chung một gốc: <strong>dữ liệu từ người dùng bị trộn vào một câu lệnh</strong> (SQL, shell, template, truy vấn NoSQL…),
    và trình thông dịch không phân biệt được đâu là lệnh do lập trình viên viết, đâu là dữ liệu do người dùng gửi. SQL Injection (SQLi) là thành viên nổi tiếng nhất.</p>

    <p><strong>1. Cơ chế.</strong> Lập trình viên viết:</p>
    <p><code>"SELECT * FROM users WHERE email = '" + email + "' AND password_hash = '" + h + "'"</code></p>
    <p>Người dùng gửi <code>email = admin@shop.com' --</code>. Câu SQL thành:</p>
    <p><code>SELECT * FROM users WHERE email = 'admin@shop.com' --' AND password_hash = '...'</code></p>
    <p>Dấu <code>'</code> đóng chuỗi sớm, <code>--</code> biến phần kiểm tra mật khẩu thành comment. Đăng nhập thành admin mà không cần mật khẩu.</p>

    <p><strong>2. Các dạng SQLi hay gặp</strong></p>
    <table>
      <tr><th>Dạng</th><th>Cách hoạt động</th></tr>
      <tr><td>Classic / in-band</td><td>Kết quả hiện luôn trong response — payload làm câu truy vấn trả thêm dữ liệu của bảng khác.</td></tr>
      <tr><td>Error-based</td><td>Cố tình gây lỗi để thông báo lỗi của DB in ra dữ liệu. Đây là lý do không được trả lỗi DB thô cho client.</td></tr>
      <tr><td>Blind boolean</td><td>Response không hiện dữ liệu, nhưng khác nhau khi điều kiện đúng/sai → hỏi từng bit: "ký tự đầu của mật khẩu admin có phải 'a' không?"</td></tr>
      <tr><td>Blind time-based</td><td>Response giống hệt nhau, nhưng payload khiến DB xử lý lâu hơn khi điều kiện đúng → suy ra đúng/sai qua thời gian phản hồi.</td></tr>
      <tr><td>Second-order</td><td>Payload được lưu an toàn vào DB lần 1, rồi một chỗ khác đọc ra và nối chuỗi ở lần 2. "Dữ liệu từ DB của mình" vẫn là dữ liệu không tin cậy!</td></tr>
      <tr><td>Stacked queries</td><td>Nếu driver cho phép nhiều câu lệnh trong một lần gọi, payload thêm được cả câu lệnh sửa/xoá dữ liệu.</td></tr>
    </table>
    <p>Hậu quả: đọc toàn bộ DB (phá C), sửa/xoá dữ liệu (phá I), vượt đăng nhập, đôi khi thực thi lệnh hệ điều hành qua tính năng của DB.</p>

    <p><strong>3. Cách chữa đúng: Parameterized query (prepared statement)</strong> — câu SQL và dữ liệu được gửi <em>tách riêng</em> tới DB.
    DB biên dịch câu lệnh trước với các chỗ trống (<code>?</code>, <code>$1</code>, <code>:email</code>), rồi mới nhận dữ liệu và <em>luôn</em> coi nó là giá trị,
    không bao giờ là cú pháp SQL. <code>admin@shop.com' --</code> chỉ đơn giản là một email lạ không tồn tại.</p>
    <p>Mọi ngôn ngữ, mọi driver phổ biến đều hỗ trợ — xem tab "Đa ngôn ngữ".</p>

    <p><strong>4. Những chỗ placeholder KHÔNG dùng được</strong> — và là nơi SQLi còn sống sót trong code "đã dùng ORM":</p>
    <ul>
      <li><strong>Tên cột / tên bảng / chiều sắp xếp</strong>: <code>ORDER BY ?</code> không hoạt động. Giải pháp: <em>allowlist</em> — map giá trị client gửi sang tên cột cố định.</li>
      <li><strong>Mệnh đề <code>IN (...)</code> với số phần tử động</strong>: sinh đúng số placeholder, hoặc dùng mảng (<code>= ANY($1)</code> trong PostgreSQL).</li>
      <li><strong>Raw query trong ORM</strong>: <code>db.raw("... " + x)</code>, <code>query(f"...{x}")</code>, string template của ngôn ngữ → vẫn là nối chuỗi.</li>
      <li><strong>LIKE</strong>: placeholder chặn injection, nhưng <code>%</code> và <code>_</code> vẫn là ký tự đại diện — escape chúng nếu không muốn user tìm kiểu "mọi thứ".</li>
    </ul>

    <p><strong>5. Lớp phòng thủ bổ sung</strong> (không thay thế parameterized query): tài khoản DB của app quyền tối thiểu (không phải superuser/owner),
    không trả lỗi DB cho client, tắt multi-statement nếu driver cho phép, WAF chỉ là lớp phụ.</p>

    <div class="callout"><p>💡 Quy tắc một dòng: <strong>không bao giờ xây câu lệnh bằng cách nối chuỗi với dữ liệu</strong>. Escape thủ công (thay <code>'</code> bằng <code>''</code>)
    là cách cũ và dễ sai (charset, backslash, số không có dấu nháy). Hãy để driver làm việc tách dữ liệu khỏi lệnh.</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Nối chuỗi", lines: [
      "// Pseudo-code — Java/Go/Python/Node/PHP đều viết ra được",
      "handle POST /login (req):",
      "    email = req.body.email",
      "    h     = hash(req.body.password)",
      "    sql   = \"SELECT id FROM users WHERE email = '\" + email +",
      "            \"' AND password_hash = '\" + h + \"'\"",
      "    row   = db.query(sql)",
      "    if row: loginAs(row.id)",
      "",
      "// email = \"admin@shop.com' --\"  =>",
      "// SELECT id FROM users WHERE email = 'admin@shop.com' --' AND password_hash = '...'",
      "//                                                    ^^ phần còn lại thành comment"
    ]},
    { id: "union", label: "🕵️ Các dạng SQLi", lines: [
      "# Endpoint: GET /products?category=shoes",
      "# Code:  \"SELECT name, price FROM products WHERE category = '\" + c + \"'\"",
      "",
      "# Dạng trừu tượng: category = \"shoes<user_input_payload>\"",
      "",
      "# 1) In-band: payload thay đổi câu SELECT -> dữ liệu bảng khác lọt vào response",
      "# 2) Blind boolean: response khác nhau khi điều kiện đúng/sai -> dò từng chút",
      "# 3) Blind time-based: không khác biệt gì, nhưng thời gian phản hồi thay đổi",
      "# 4) Stacked: driver cho nhiều câu lệnh -> sửa/xoá dữ liệu",
      "",
      "# Cả 4 dạng chung MỘT gốc: dữ liệu được nối vào câu lệnh.",
      "# => chữa MỘT lần bằng parameterized query là hết cả 4."
    ]},
    { id: "safe", label: "✅ Parameterized", lines: [
      "handle POST /login (req):",
      "    row = db.query(",
      "        \"SELECT id, password_hash FROM users WHERE email = $1\",   // câu lệnh cố định",
      "        [req.body.email]                                          // dữ liệu gửi riêng",
      "    )",
      "    if row and verifyPassword(req.body.password, row.password_hash):",
      "        loginAs(row.id)",
      "",
      "// DB nhận: lệnh = SELECT ... WHERE email = $1 ; giá trị $1 = \"admin@shop.com' --\"",
      "// -> tìm user có email đúng bằng chuỗi đó -> không có -> đăng nhập thất bại"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Java (JDBC)",
      "ps = conn.prepareStatement(\"SELECT * FROM users WHERE email = ?\"); ps.setString(1, email);",
      "# Go (database/sql)",
      "db.QueryRow(\"SELECT id FROM users WHERE email = $1\", email)",
      "# Python (psycopg / DB-API)",
      "cur.execute(\"SELECT id FROM users WHERE email = %s\", (email,))   # KHÔNG dùng f-string",
      "# Node (pg)",
      "await pool.query(\"SELECT id FROM users WHERE email = $1\", [email])",
      "# PHP (PDO)",
      "$st = $pdo->prepare(\"SELECT id FROM users WHERE email = :e\"); $st->execute([':e' => $email]);",
      "# Rust (sqlx)",
      "sqlx::query(\"SELECT id FROM users WHERE email = $1\").bind(&email)",
      "# Kotlin/Java ORM, C# ADO.NET, Ruby ActiveRecord... đều có dạng tương tự"
    ]},
    { id: "orderby", label: "⚠️ ORDER BY / IN / raw", lines: [
      "// ORDER BY không nhận placeholder -> ALLOWLIST",
      "SORTS = { \"newest\": \"created_at DESC\", \"price\": \"price ASC\" }",
      "orderSql = SORTS.get(req.query.sort) or \"created_at DESC\"   // không bao giờ lấy thẳng từ client",
      "db.query(\"SELECT * FROM products ORDER BY \" + orderSql)",
      "",
      "// IN (...) động -> mảng",
      "db.query(\"SELECT * FROM products WHERE id = ANY($1)\", [idList])",
      "",
      "// LIKE: placeholder chặn injection, còn % và _ thì tự escape",
      "db.query(\"SELECT * FROM products WHERE name LIKE $1 ESCAPE '\\\\'\", ['%' + escapeLike(q) + '%'])",
      "",
      "// ORM raw query VẪN là nối chuỗi nếu tự ghép:",
      "orm.raw(\"SELECT * FROM t WHERE name = '\" + name + \"'\")    // ❌",
      "orm.raw(\"SELECT * FROM t WHERE name = ?\", [name])            // ✅"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="code"><div class="nl">👩‍💻 Lệnh (lập trình viên viết)</div><div class="ns">SELECT ... WHERE email = ?</div></div>
      <div class="node" id="data"><div class="nl">📨 Dữ liệu (người dùng gửi)</div><div class="ns">admin@shop.com' --</div></div>
    </div>
    <div class="arrow" id="a1">↓ nối chuỗi: trộn lẫn</div>
    <div class="node" id="mixed"><div class="nl">💥 Một chuỗi SQL duy nhất</div><div class="ns">DB không biết đâu là lệnh, đâu là dữ liệu</div></div>
    <div class="arrow" id="a2">↓ parameterized: gửi riêng</div>
    <div class="node" id="db"><div class="nl">🗄️ Database</div><div class="ns">biên dịch lệnh trước, dữ liệu luôn chỉ là giá trị</div></div>
  `,
  steps: [
    { title: "1 · Code nối chuỗi", tab: "vuln", highlight: [5, 6, 7], on: ["code", "data"],
      desc: "Câu SQL được ghép từ các mảnh do lập trình viên viết và các mảnh do người dùng gửi. Với email bình thường, mọi thứ chạy đúng." },
    { title: "2 · Dữ liệu phá vỡ cấu trúc lệnh", tab: "vuln", highlight: [10, 11, 12], on: ["a1", "mixed"],
      desc: "Dấu <code>'</code> đóng chuỗi sớm, <code>--</code> comment phần kiểm tra mật khẩu. Người dùng vừa <strong>viết lại</strong> câu lệnh của bạn." },
    { title: "3 · Không chỉ đăng nhập — cả DB lộ", tab: "union", highlight: [6, 7, 8, 9, 11, 12], on: ["mixed", "db"],
      desc: "Có nhiều dạng (in-band, blind, time-based, stacked) nhưng chung một gốc. Không thấy lỗi trên màn hình không có nghĩa là an toàn — và cũng chỉ cần một cách chữa." },
    { title: "4 · Tách lệnh khỏi dữ liệu", tab: "safe", highlight: [3, 4, 9, 10], on: ["code", "data", "a2", "db"],
      desc: "Parameterized query gửi câu lệnh (có chỗ trống <code>$1</code>) và giá trị <em>riêng biệt</em>. DB không bao giờ phân tích giá trị như cú pháp SQL." },
    { title: "5 · Ngôn ngữ nào cũng làm được", tab: "langs", highlight: [2, 4, 6, 8, 10, 12], on: ["db"],
      desc: "JDBC, database/sql, psycopg, pg, PDO, sqlx… cùng một khái niệm. Lỗi không nằm ở ngôn ngữ, nằm ở thói quen nối chuỗi (kể cả f-string, template literal, String.format)." },
    { title: "6 · Chỗ placeholder không phủ tới", tab: "orderby", highlight: [2, 3, 7, 10, 13, 14], on: ["code"],
      desc: "Tên cột/ORDER BY → allowlist. IN động → mảng. LIKE → escape ký tự đại diện. Raw query trong ORM vẫn phải dùng tham số." }
  ],

  quiz: [
    { q: "Gốc rễ chung của mọi lỗi Injection là gì?", options: [
        "Dùng database quá cũ",
        "Dữ liệu không tin cậy bị trộn vào câu lệnh, trình thông dịch không phân biệt được lệnh và dữ liệu",
        "Không dùng HTTPS",
        "Mật khẩu quá yếu"
      ], correct: 1,
      explanation: "SQL, shell, template, NoSQL… đều cùng cơ chế: dữ liệu biến thành một phần cú pháp của lệnh." },
    { q: "Câu SQL: \"... WHERE email = '\" + email + \"' AND password_hash = ...\". Input email nào có thể vượt qua kiểm tra mật khẩu?", options: [
        "admin@shop.com",
        "admin@shop.com' --",
        "ADMIN@SHOP.COM",
        "admin%40shop.com"
      ], correct: 1,
      explanation: "Dấu ' đóng chuỗi, -- biến phần còn lại (kiểm tra mật khẩu) thành comment." },
    { q: "Parameterized query chống SQLi bằng cách nào?", options: [
        "Tự động xoá dấu nháy khỏi input",
        "Mã hoá dữ liệu trước khi gửi",
        "Gửi câu lệnh và dữ liệu riêng biệt; DB biên dịch lệnh trước và luôn coi dữ liệu là giá trị",
        "Chặn các từ khoá như SELECT, DROP"
      ], correct: 2,
      explanation: "Dữ liệu không bao giờ được phân tích như cú pháp SQL, nên không thể thay đổi cấu trúc câu lệnh." },
    { q: "Trang web không hiện kết quả truy vấn hay lỗi nào, nhưng thời gian phản hồi thay đổi tuỳ input. Đây là dạng SQLi nào?", options: [
        "UNION-based",
        "Error-based",
        "Blind time-based",
        "Không phải SQLi"
      ], correct: 2,
      explanation: "Time-based blind: dùng độ trễ để suy ra điều kiện đúng/sai, từ đó dò dữ liệu từng chút một." },
    { q: "Muốn cho client chọn cột sắp xếp (?sort=price). Cách an toàn?", options: [
        "ORDER BY $1 với placeholder",
        "Nối thẳng req.query.sort vào câu SQL",
        "Map giá trị client gửi sang tên cột cố định bằng allowlist",
        "Escape dấu nháy trong sort rồi nối"
      ], correct: 2,
      explanation: "Placeholder chỉ thay được giá trị, không thay được tên cột/từ khoá. Allowlist là cách đúng cho identifier." },
    { q: "Second-order SQL Injection là gì?", options: [
        "SQLi xảy ra lần thứ hai do retry",
        "Payload được lưu vào DB an toàn, sau đó một chỗ khác đọc ra và nối chuỗi vào câu lệnh",
        "SQLi trên database thứ cấp (replica)",
        "SQLi chỉ xảy ra với 2 tham số"
      ], correct: 1,
      explanation: "Dữ liệu đọc từ DB của chính mình vẫn là dữ liệu người dùng — vẫn phải dùng parameterized query." },
    { q: "Dùng ORM thì có chắc chắn miễn nhiễm SQLi không?", options: [
        "Có, ORM luôn an toàn",
        "Không — raw query, nối chuỗi trong where/order, string template vẫn gây SQLi",
        "Có, trừ khi dùng MySQL",
        "Không, ORM còn nguy hiểm hơn nối chuỗi"
      ], correct: 1,
      explanation: "ORM an toàn khi dùng API có tham số. Cứ tự ghép chuỗi vào raw()/whereRaw()/query() là quay lại lỗi cũ." },
    { q: "Vì sao không nên trả thông báo lỗi DB thô (vd 'syntax error at or near...') cho client?", options: [
        "Vì làm response dài hơn",
        "Vì nó giúp kẻ tấn công xác nhận có SQLi và thậm chí lấy dữ liệu qua error-based injection",
        "Vì trình duyệt không hiển thị được",
        "Không có lý do gì"
      ], correct: 1,
      explanation: "Lỗi chi tiết là thông tin quý cho kẻ tấn công. Ghi log chi tiết phía server, trả thông báo chung cho client." },
    { q: "Biện pháp nào là lớp phòng thủ BỔ SUNG (không thay thế parameterized query)?", options: [
        "Dùng tài khoản DB quyền tối thiểu cho app",
        "Nối chuỗi nhưng escape dấu nháy",
        "Dùng f-string thay vì dấu +",
        "Viết hoa toàn bộ input"
      ], correct: 0,
      explanation: "Least privilege giới hạn thiệt hại nếu có SQLi lọt qua (không DROP được, không đọc bảng khác). Các lựa chọn còn lại vẫn là nối chuỗi." },
    { q: "Dùng placeholder cho điều kiện LIKE: WHERE name LIKE $1 với giá trị '%' + q + '%'. Còn vấn đề gì?", options: [
        "Vẫn bị SQLi",
        "Ký tự % và _ trong q vẫn là ký tự đại diện — user gõ '%' sẽ khớp mọi thứ; nên escape nếu không muốn",
        "LIKE không dùng được placeholder",
        "Không còn vấn đề gì"
      ], correct: 1,
      explanation: "Không phải injection, nhưng có thể gây kết quả ngoài ý muốn và truy vấn nặng (DoS nhẹ). Escape % và _ khi cần." }
  ]
});
