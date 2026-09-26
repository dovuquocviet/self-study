window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Phân quyền",
  title: "Mass assignment, lỗi logic nghiệp vụ và race condition",
  subtitle: "DTO/allowlist field · kiểm tra quy tắc nghiệp vụ ở server · transaction, khoá, UPDATE có điều kiện, idempotency key",

  theory: `
    <p>Bài 13 hỏi "người này có được chạm vào object này không?". Bài này hỏi tiếp: <strong>"được chạm vào <em>trường nào</em>, theo <em>quy tắc nào</em>,
    và điều gì xảy ra nếu hai request chạm vào <em>cùng lúc</em>?"</strong> Ba nhóm lỗi dưới đây không cần ký tự đặc biệt hay payload phức tạp —
    request trông hoàn toàn hợp lệ, chỉ là nó làm điều mà lập trình viên <em>không nghĩ tới</em>. Vì vậy scanner tự động thường bỏ sót; phải phòng thủ bằng thiết kế.</p>

    <p><strong>1. Mass assignment (gán hàng loạt)</strong></p>
    <p>Nhiều framework cho phép viết tắt: lấy toàn bộ body JSON rồi gán vào model — <code>user.update(req.body)</code>. Tiện, nhưng nếu model có các trường nhạy cảm như
    <code>role</code>, <code>isVerified</code>, <code>balance</code>, <code>ownerId</code>, <code>tenantId</code>, <code>price</code> thì client chỉ cần <em>thêm một trường</em> vào body là tự sửa được chúng.
    Ví dụ trừu tượng: form "Sửa hồ sơ" gửi <code>{ name, avatar }</code>; kẻ tấn công gửi thêm <code>"role": "&lt;giá_trị_độc&gt;"</code> và server lưu luôn.</p>
    <p>Cách chữa:</p>
    <ul>
      <li><strong>DTO / input schema riêng cho từng hành động</strong>: <code>UpdateProfileInput</code> chỉ có <code>name</code>, <code>avatar</code>. Server chỉ copy các trường này vào model.</li>
      <li><strong>Allowlist field</strong> (danh sách trường được phép), không dùng denylist ("cấm role") — vì khi model thêm trường nhạy cảm mới, denylist sẽ quên.</li>
      <li><strong>Từ chối trường lạ</strong>: schema ở chế độ strict (<code>additionalProperties: false</code>, <code>forbidNonWhitelisted</code>, <code>extra = "forbid"</code>) để phát hiện sớm.</li>
      <li><strong>Trường nhạy cảm chỉ đổi qua API riêng</strong> có kiểm tra quyền riêng (đổi vai trò → endpoint admin; đổi số dư → chỉ qua giao dịch).</li>
      <li>Trường do server quyết định (<code>ownerId</code>, <code>tenantId</code>, <code>createdAt</code>, <code>price</code>) luôn lấy từ phiên đăng nhập / database, không lấy từ body.</li>
    </ul>

    <p><strong>2. Lỗi logic nghiệp vụ (business logic flaws)</strong></p>
    <p>Code chạy "đúng như viết" nhưng quy tắc kinh doanh bị bỏ quên. Các dạng hay gặp:</p>
    <table>
      <tr><th>Tình huống</th><th>Vì sao sai</th><th>Phòng thủ</th></tr>
      <tr><td>Số lượng âm, giá âm, số lượng 0 hay cực lớn</td><td>Tổng tiền âm → hệ thống "trả tiền" cho khách</td><td>Validate miền giá trị: <code>1 ≤ qty ≤ 100</code>, số nguyên</td></tr>
      <tr><td>Client gửi giá / tổng tiền</td><td>Client tự đặt giá</td><td>Server tự tính giá từ database, bỏ qua giá client gửi</td></tr>
      <tr><td>Bỏ bước trong quy trình (gọi thẳng bước "xác nhận" mà chưa thanh toán)</td><td>Server tin client đã đi đúng thứ tự</td><td>Máy trạng thái (state machine) ở server; chỉ cho chuyển trạng thái hợp lệ</td></tr>
      <tr><td>Dùng coupon nhiều lần, dùng coupon của người khác, cộng dồn coupon</td><td>Không ghi nhận việc đã dùng, hoặc ghi nhận không nguyên tử</td><td>Bảng lượt dùng + unique constraint + kiểm tra điều kiện trong transaction</td></tr>
      <tr><td>Hoàn tiền nhiều hơn số đã trả, rút nhiều hơn số dư</td><td>Không so với trạng thái thực trong DB</td><td>UPDATE có điều kiện (xem phần 3)</td></tr>
      <tr><td>Làm tròn tiền bằng số thực</td><td>Sai số tích luỹ, có thể bị lợi dụng</td><td>Dùng số nguyên đơn vị nhỏ nhất (xu, cent) hoặc kiểu decimal</td></tr>
    </table>
    <p>Mẹo tìm lỗi logic: với mỗi tính năng liên quan tiền/điểm/quyền lợi, tự hỏi <em>"Nếu gửi giá trị âm? bằng 0? rất lớn? gửi hai lần? gửi bước 3 trước bước 2? gửi thay cho người khác?"</em>
    và viết test cho từng câu.</p>

    <p><strong>3. Race condition và TOCTOU</strong></p>
    <p><strong>TOCTOU</strong> = <em>Time Of Check To Time Of Use</em>: code <em>kiểm tra</em> rồi mới <em>sử dụng</em>, nhưng giữa hai thời điểm đó một request khác đã làm thay đổi dữ liệu.
    Ví dụ: số dư 100. Hai request rút 100 đến gần như cùng lúc. Cả hai đều đọc "số dư = 100 ≥ 100 → OK", rồi cả hai cùng trừ → rút được 200.
    Coupon "chỉ dùng một lần" cũng vậy: hai request cùng đọc "chưa dùng" rồi cùng áp dụng.</p>
    <p>Các cách chữa, từ đơn giản đến tổng quát:</p>
    <ol>
      <li><strong>UPDATE có điều kiện (atomic)</strong>: gộp "kiểm tra + sửa" vào <em>một câu lệnh</em>:
        <code>UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance &gt;= ?</code>. Kiểm tra số dòng bị ảnh hưởng: 0 dòng → không đủ tiền. Database đảm bảo nguyên tử.</li>
      <li><strong>Unique constraint</strong>: bảng <code>coupon_redemptions</code> có ràng buộc duy nhất <code>(coupon_id, user_id)</code>. Request thứ hai INSERT sẽ bị DB từ chối, dù code có race.</li>
      <li><strong>Transaction + khoá hàng</strong>: <code>SELECT ... FOR UPDATE</code> (SQL) hoặc khoá lạc quan bằng cột <code>version</code>
        (<code>UPDATE ... WHERE id = ? AND version = ?</code>, 0 dòng → thử lại). Chọn mức isolation phù hợp.</li>
      <li><strong>Idempotency key</strong>: client gửi kèm một khoá duy nhất cho mỗi thao tác (header <code>Idempotency-Key</code>). Server lưu khoá (có unique constraint) cùng kết quả;
        request lặp lại với cùng khoá nhận lại kết quả cũ thay vì thực hiện lần hai. Rất quan trọng với thanh toán, vì mạng chập chờn khiến client tự retry.</li>
      <li><strong>Khoá phân tán / hàng đợi</strong> khi thao tác trải qua nhiều hệ thống: khoá theo tài nguyên (ví dụ theo user_id) hoặc đưa vào queue xử lý tuần tự.</li>
    </ol>
    <p>Với NoSQL, ý tưởng giống hệt: dùng thao tác cập nhật có điều kiện của engine (update kèm filter điều kiện, conditional write, compare-and-set) thay cho "đọc rồi ghi".</p>

    <div class="callout"><p>💡 Quy tắc nhớ: <strong>"Đừng đọc rồi mới quyết định rồi mới ghi"</strong> với dữ liệu quan trọng. Hãy để database kiểm tra điều kiện
    <em>trong chính lệnh ghi</em> (UPDATE có điều kiện, unique constraint). Và <strong>"Đừng tin body"</strong>: chỉ nhận các trường trong allowlist, mọi giá trị tiền/quyền do server tự tính.</p></div>
  `,

  codeTabs: [
    { id: "mass", label: "❌ Bind thẳng body", lines: [
      "// Pseudo-code: cập nhật hồ sơ",
      "handle PATCH /me (req):",
      "    user = currentUser(req)",
      "    user.update(req.body)          // gán MỌI trường client gửi vào model",
      "    save(user)",
      "",
      "// Client hợp lệ gửi:  { name: 'An', avatar: 'a.png' }",
      "// Kẻ tấn công gửi:   { name: 'An', role: '<giá_trị_độc>', balance: '<giá_trị_độc>' }",
      "//   -> model có trường role/balance nên server lưu luôn",
      "",
      "// Tương tự: POST /orders với body chứa 'price' hoặc 'ownerId'"
    ]},
    { id: "dto", label: "✅ DTO / allowlist", lines: [
      "schema UpdateProfileInput (strict):          // trường lạ -> 400",
      "    name:   string, 1..80 ký tự",
      "    avatar: string, định dạng URL ảnh, optional",
      "",
      "handle PATCH /me (req):",
      "    input = validate(req.body, UpdateProfileInput)",
      "    user  = currentUser(req)",
      "    user.name   = input.name                 // copy TỪNG trường được phép",
      "    user.avatar = input.avatar",
      "    save(user)",
      "",
      "// role    -> chỉ đổi qua PUT /admin/users/{id}/role (policy 'user:set-role')",
      "// balance -> chỉ đổi qua giao dịch có sổ cái",
      "// ownerId, tenantId, price -> server tự điền từ phiên đăng nhập / DB"
    ]},
    { id: "logic", label: "🧠 Quy tắc nghiệp vụ", lines: [
      "handle POST /checkout (req):",
      "    input = validate(req.body, CheckoutInput)   // items: [{ productId, qty }]",
      "    for item in input.items:",
      "        if not isInteger(item.qty) or item.qty < 1 or item.qty > 100: return 400",
      "        item.price = db.getPrice(item.productId)  // BỎ QUA giá client gửi",
      "    total = sum(item.price * item.qty)           // tiền tính bằng số nguyên (xu)",
      "",
      "// Máy trạng thái đơn hàng: chỉ cho phép chuyển hợp lệ",
      "ALLOWED = { CART: [PENDING_PAYMENT], PENDING_PAYMENT: [PAID, CANCELLED],",
      "            PAID: [SHIPPED, REFUNDED], SHIPPED: [DELIVERED] }",
      "",
      "transition(order, next):",
      "    if next not in ALLOWED[order.status]: return 409   // không bỏ bước",
      "    order.status = next"
    ]},
    { id: "race", label: "⏱️ Race / TOCTOU", lines: [
      "// ❌ Kiểm tra rồi mới dùng: có khoảng hở giữa hai bước",
      "acc = db.query('SELECT balance FROM accounts WHERE id = ?', [id])",
      "if acc.balance >= amount:                       // T1 và T2 cùng thấy 100 >= 100",
      "    db.exec('UPDATE accounts SET balance = ? WHERE id = ?', [acc.balance - amount, id])",
      "",
      "// ✅ Gộp kiểm tra vào câu lệnh ghi (nguyên tử)",
      "n = db.exec('UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?',",
      "            [amount, id, amount])",
      "if n.affectedRows == 0: return 409              // không đủ tiền / đã bị trừ",
      "",
      "// ✅ Coupon dùng một lần: để DB chặn trùng",
      "// UNIQUE (coupon_id, user_id) trên bảng coupon_redemptions",
      "try: db.exec('INSERT INTO coupon_redemptions (coupon_id, user_id) VALUES (?, ?)', [c, u])",
      "catch UniqueViolation: return 409               // request thứ hai bị từ chối"
    ]},
    { id: "idem", label: "🔁 Idempotency & đa engine", lines: [
      "// Idempotency key cho thanh toán",
      "handle POST /payments (req):",
      "    key = req.headers['Idempotency-Key']        // client sinh UUID mỗi thao tác",
      "    if key is missing: return 400",
      "    inTransaction:",
      "        existing = db.findIdem(key, user.id)    // UNIQUE (user_id, key)",
      "        if existing: return existing.response   // lặp lại -> trả kết quả cũ",
      "        result = charge(...)",
      "        db.saveIdem(key, user.id, result)",
      "    return result",
      "",
      "# Khoá hàng (SQL): SELECT ... FROM accounts WHERE id = ? FOR UPDATE",
      "# Khoá lạc quan:   UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = ?",
      "# NoSQL document:  update có filter điều kiện, ví dụ { _id: id, balance: { $gte: amount } }",
      "# Key-value:       conditional write / compare-and-set thay cho đọc-rồi-ghi"
    ]}
  ],

  stageHtml: `
    <div class="node" id="body"><div class="nl">📨 Request body</div><div class="ns">có thể chứa trường lạ, giá trị âm, gửi trùng</div></div>
    <div class="arrow" id="a1">↓ lọc trường</div>
    <div class="node" id="dto"><div class="nl">📋 DTO / allowlist field</div><div class="ns">chỉ name, avatar · trường lạ → 400</div></div>
    <div class="arrow" id="a2">↓ quy tắc nghiệp vụ</div>
    <div class="node" id="rules"><div class="nl">🧠 Business rules ở server</div><div class="ns">miền giá trị · giá lấy từ DB · máy trạng thái</div></div>
    <div class="arrow" id="a3">↓ ghi dữ liệu</div>
    <div class="row">
      <div class="node" id="toctou"><div class="nl">❌ Đọc → kiểm tra → ghi</div><div class="ns">hai request chen giữa (TOCTOU)</div></div>
      <div class="node" id="atomic"><div class="nl">✅ Ghi có điều kiện</div><div class="ns">UPDATE ... WHERE balance &gt;= ? · UNIQUE · khoá</div></div>
    </div>
    <div class="arrow" id="a4">↓ gửi lặp</div>
    <div class="node" id="idem"><div class="nl">🔁 Idempotency key</div><div class="ns">cùng khoá → trả kết quả cũ, không làm lần hai</div></div>
  `,
  steps: [
    { title: "1 · Mass assignment: bind thẳng body", tab: "mass", highlight: [4, 8, 9], on: ["body"],
      desc: "Gán toàn bộ body vào model nghĩa là client quyết định được mọi trường, kể cả <code>role</code>, <code>balance</code>. Request trông hoàn toàn hợp lệ — chỉ thừa một trường." },
    { title: "2 · Chữa: DTO + allowlist field", tab: "dto", highlight: [1, 2, 3, 6, 8, 9], on: ["a1", "dto"],
      desc: "Mỗi hành động có schema riêng ở chế độ strict. Server copy <em>từng</em> trường được phép; trường lạ bị từ chối." },
    { title: "3 · Trường nhạy cảm đi đường riêng", tab: "dto", highlight: [12, 13, 14], on: ["dto"],
      desc: "Vai trò đổi qua API admin có policy riêng (bài 13); số dư đổi qua giao dịch; owner/tenant/giá do server tự điền." },
    { title: "4 · Quy tắc nghiệp vụ: giá trị và giá tiền", tab: "logic", highlight: [4, 5, 6], on: ["a2", "rules"],
      desc: "Chặn số lượng âm/0/quá lớn, không tin giá client gửi, tính tiền bằng số nguyên. Hỏi mọi tính năng liên quan tiền: âm? 0? rất lớn? gửi hai lần?" },
    { title: "5 · Không cho bỏ bước: máy trạng thái", tab: "logic", highlight: [9, 10, 13, 14], on: ["rules"],
      desc: "Server giữ trạng thái đơn hàng và chỉ cho phép chuyển trạng thái hợp lệ. Gọi thẳng bước 'giao hàng' khi chưa thanh toán → 409." },
    { title: "6 · Race condition: gộp kiểm tra vào lệnh ghi", tab: "race", highlight: [2, 3, 4, 7, 9, 12, 14], on: ["a3", "toctou", "atomic"],
      desc: "Đọc–kiểm tra–ghi để hở một khoảng cho request khác chen vào. UPDATE có điều kiện và unique constraint để database đảm bảo tính nguyên tử." },
    { title: "7 · Idempotency key và các engine khác", tab: "idem", highlight: [3, 6, 7, 9, 12, 13, 14], on: ["a4", "idem"],
      desc: "Client retry do mạng lỗi không được trừ tiền hai lần. Lưu khoá kèm kết quả với unique constraint. Khoá hàng, khoá lạc quan, conditional write của NoSQL đều cùng một ý tưởng." }
  ],

  quiz: [
    { q: "Mass assignment là gì?", options: [
        "Gửi quá nhiều request cùng lúc",
        "Server gán toàn bộ trường trong body vào model, cho phép client sửa cả trường không được phép như role, balance",
        "Gán nhiều vai trò cho một user",
        "Import dữ liệu hàng loạt từ file CSV"
      ], correct: 1,
      explanation: "Khi bind thẳng body vào model, client chỉ cần thêm trường vào JSON là sửa được dữ liệu nhạy cảm." },
    { q: "Cách phòng mass assignment tốt nhất?", options: [
        "Denylist: cấm trường role",
        "DTO/schema riêng cho từng hành động với allowlist trường được phép, từ chối trường lạ",
        "Mã hoá body bằng base64",
        "Ẩn trường role trên giao diện"
      ], correct: 1,
      explanation: "Allowlist không bị lỗi khi model thêm trường mới; denylist thì phải nhớ cập nhật và rất dễ quên." },
    { q: "API checkout nhận cả productId và price từ client. Nên xử lý price thế nào?", options: [
        "Tin price client gửi vì client đã hiển thị đúng",
        "Bỏ qua price client gửi, server tự lấy giá từ database",
        "Chỉ kiểm tra price > 0",
        "Làm tròn price rồi dùng"
      ], correct: 1,
      explanation: "Giá tiền là dữ liệu server quyết định. Client có thể gửi bất kỳ giá nào." },
    { q: "Người dùng đặt số lượng -5 và tổng tiền đơn hàng bị âm. Đây là loại lỗi gì và chữa thế nào?", options: [
        "Lỗi giao diện; sửa CSS",
        "Lỗi logic nghiệp vụ; validate miền giá trị ở server (số nguyên, 1 ≤ qty ≤ giới hạn)",
        "SQL Injection; dùng prepared statement",
        "Không phải lỗi"
      ], correct: 1,
      explanation: "Input đúng kiểu nhưng sai quy tắc kinh doanh. Server phải kiểm tra miền giá trị hợp lệ." },
    { q: "Làm sao ngăn người dùng gọi thẳng bước 'xác nhận đơn' khi chưa thanh toán?", options: [
        "Ẩn nút xác nhận trên giao diện",
        "Server giữ máy trạng thái của đơn và chỉ cho phép chuyển trạng thái hợp lệ",
        "Kiểm tra header Referer",
        "Đặt URL bước xác nhận thật khó đoán"
      ], correct: 1,
      explanation: "Không tin client đi đúng thứ tự. Trạng thái nằm ở server, mỗi lần chuyển phải kiểm tra điều kiện." },
    { q: "TOCTOU nghĩa là gì?", options: [
        "Một loại mã hoá",
        "Time Of Check To Time Of Use: dữ liệu bị thay đổi giữa lúc kiểm tra và lúc sử dụng",
        "Tên một framework phân quyền",
        "Thời gian token hết hạn"
      ], correct: 1,
      explanation: "Kiểm tra và sử dụng không nguyên tử thì request khác có thể chen vào giữa." },
    { q: "Số dư 100, hai request rút 100 đến cùng lúc và cả hai đều thành công. Cách chữa đơn giản và chắc chắn nhất?", options: [
        "Thêm sleep ngẫu nhiên trước khi trừ tiền",
        "UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ? rồi kiểm tra số dòng bị ảnh hưởng",
        "Kiểm tra số dư hai lần trong code",
        "Chặn trên giao diện không cho bấm nút hai lần"
      ], correct: 1,
      explanation: "Database kiểm tra điều kiện trong chính lệnh ghi nên hai request không thể cùng vượt qua. 0 dòng → từ chối." },
    { q: "Coupon chỉ được dùng một lần cho mỗi user. Cơ chế nào chống dùng trùng kể cả khi có race condition?", options: [
        "Đọc bảng xem đã dùng chưa rồi mới INSERT",
        "Unique constraint (coupon_id, user_id) trên bảng lượt dùng; INSERT thứ hai bị database từ chối",
        "Lưu cờ đã dùng trong localStorage",
        "Ghi log mỗi lần dùng"
      ], correct: 1,
      explanation: "Ràng buộc ở database là chốt chặn cuối, không phụ thuộc thứ tự thực thi của code." },
    { q: "Vì sao API thanh toán nên hỗ trợ idempotency key?", options: [
        "Để tăng tốc độ xử lý",
        "Để request lặp lại (do client retry khi mạng lỗi) trả về kết quả cũ thay vì trừ tiền lần hai",
        "Để thay thế xác thực",
        "Để mã hoá số thẻ"
      ], correct: 1,
      explanation: "Server lưu khoá kèm kết quả (có unique constraint); cùng khoá → không thực hiện lại thao tác." },
    { q: "Khoá lạc quan (optimistic locking) hoạt động thế nào?", options: [
        "Khoá toàn bộ bảng trong suốt phiên đăng nhập",
        "Mỗi bản ghi có cột version; UPDATE kèm WHERE version = ?, nếu 0 dòng bị ảnh hưởng thì có người sửa trước → đọc lại và thử lại",
        "Tin rằng sẽ không có xung đột nên không kiểm tra",
        "Dùng mật khẩu để khoá bản ghi"
      ], correct: 1,
      explanation: "Không giữ khoá lâu, nhưng phát hiện được xung đột khi ghi và buộc xử lý lại." },
    { q: "Trường ownerId, tenantId, createdAt nên được lấy từ đâu khi tạo bản ghi mới?", options: [
        "Từ body request",
        "Server tự điền từ phiên đăng nhập/đồng hồ server, không nhận từ client",
        "Từ query string",
        "Từ cookie do JavaScript phía client đặt"
      ], correct: 1,
      explanation: "Đây là dữ liệu server quyết định. Nhận từ client là mở đường cho mass assignment và IDOR." },
    { q: "Trên database NoSQL, cách chữa race condition 'đọc rồi ghi' tương đương UPDATE có điều kiện là gì?", options: [
        "Không có cách nào",
        "Dùng thao tác cập nhật/ghi có điều kiện (filter điều kiện, conditional write, compare-and-set) của engine",
        "Đọc hai lần cho chắc",
        "Tắt replication"
      ], correct: 1,
      explanation: "Ý tưởng giống SQL: để engine kiểm tra điều kiện trong chính lệnh ghi một cách nguyên tử." }
  ]
});
