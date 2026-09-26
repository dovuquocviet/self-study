window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Phân quyền",
  title: "Broken Access Control: IDOR/BOLA và BFLA",
  subtitle: "Kiểm tra quyền trên từng object · deny by default · truy vấn kèm owner/tenant · test ma trận quyền",

  theory: `
    <p><strong>Xác thực (authentication)</strong> trả lời câu hỏi "bạn là ai?". <strong>Phân quyền (authorization)</strong> trả lời câu hỏi
    "bạn có được làm <em>việc này</em> với <em>dữ liệu này</em> không?". Rất nhiều hệ thống làm tốt phần đăng nhập nhưng quên phần thứ hai —
    đó là <strong>Broken Access Control</strong>, nhóm lỗi đứng <strong>số 1</strong> trong OWASP Top 10 (bài 02) và cũng đứng đầu OWASP API Security Top 10.
    Điểm đáng sợ: lỗi này <em>không cần kỹ thuật cao</em> để khai thác — chỉ cần đổi một con số trong request.</p>

    <p><strong>1. Hai dạng chính cần nhớ tên</strong></p>
    <table>
      <tr><th>Tên</th><th>Nghĩa</th><th>Ví dụ tình huống</th></tr>
      <tr><td><strong>IDOR</strong> / <strong>BOLA</strong><br>(Insecure Direct Object Reference / Broken Object Level Authorization)</td>
          <td>Server kiểm tra "đã đăng nhập" nhưng <em>không</em> kiểm tra object được yêu cầu có thuộc về người đó không.</td>
          <td>User A gọi <code>GET /orders/1002</code> và xem được đơn hàng của user B chỉ bằng cách đổi số ID.</td></tr>
      <tr><td><strong>BFLA</strong><br>(Broken Function Level Authorization)</td>
          <td>Server không kiểm tra người gọi có được dùng <em>chức năng</em> đó không (thường là chức năng quản trị).</td>
          <td>User thường gọi thẳng <code>DELETE /admin/users/7</code> — nút bấm bị ẩn trên giao diện nhưng API vẫn nhận.</td></tr>
    </table>
    <p>Ngoài ra còn các biến thể: sửa/xoá object của người khác (BOLA ở PUT/DELETE), đọc dữ liệu của tenant khác trong hệ thống SaaS nhiều khách hàng,
    nâng quyền bằng cách tự sửa trường <code>role</code> (bài 14 — mass assignment), hoặc truy cập chức năng khi chưa đi qua bước bắt buộc.</p>

    <p><strong>2. Vì sao lỗi này phổ biến đến vậy?</strong></p>
    <ul>
      <li><strong>Tin vào giao diện</strong>: "Nút Xoá chỉ hiện cho admin nên user thường không xoá được." Sai — kẻ tấn công không dùng giao diện của bạn, họ gửi HTTP request trực tiếp.</li>
      <li><strong>Tin vào ID khó thấy</strong>: "ID nằm trong URL nội bộ, không ai biết." Mọi thứ client nhận được đều có thể bị đọc và sửa.</li>
      <li><strong>Kiểm tra rải rác</strong>: mỗi handler tự viết một đoạn <code>if</code> kiểm tra quyền — chỉ cần một endpoint mới quên là thủng.</li>
      <li><strong>Mặc định là cho phép</strong>: endpoint mới thêm vào mà không khai báo quyền thì vẫn chạy được.</li>
    </ul>

    <p><strong>3. Nguyên tắc phòng thủ (phần quan trọng nhất)</strong></p>
    <ol>
      <li><strong>Kiểm tra quyền ở server, trên TỪNG object, trong MỌI request.</strong> Không dựa vào việc client "không gửi", "không thấy", hay "đã kiểm tra ở màn hình trước".
        Mỗi lần đọc/sửa/xoá một object, server phải trả lời: <em>người này có quyền với object này không?</em></li>
      <li><strong>Deny by default.</strong> Endpoint nào không khai báo rõ ai được gọi thì bị từ chối. Thêm endpoint mới mà quên khai báo → an toàn (bị chặn), chứ không phải thủng.</li>
      <li><strong>Truy vấn luôn kèm owner/tenant.</strong> Thay vì "lấy đơn hàng 1002 rồi kiểm tra chủ", viết thẳng
        <code>WHERE id = ? AND owner_id = ?</code> (hoặc <code>tenant_id = ?</code>). Không có dòng nào khớp → trả 404. Cách này khó quên hơn và cũng không lộ việc object tồn tại.</li>
      <li><strong>Lấy danh tính từ session/token đã xác thực</strong>, không lấy từ tham số client gửi. Đừng tin <code>?userId=</code> hay header <code>X-User-Id</code> do client đặt.</li>
      <li><strong>Tập trung logic phân quyền</strong> vào middleware/policy/guard dùng chung (RBAC theo vai trò, ABAC theo thuộc tính, hoặc thư viện policy như OPA, Casbin, CASL, Pundit, Spring Security).
        Handler chỉ gọi <code>authorize(user, action, resource)</code> — không tự chế logic.</li>
      <li><strong>ID khó đoán (UUID) chỉ là lớp phụ.</strong> UUID làm việc dò ID ngẫu nhiên khó hơn, nhưng ID vẫn bị lộ qua link chia sẻ, log, email, API khác.
        <em>Kiểm tra quyền vẫn bắt buộc</em>; UUID không thay thế được nó.</li>
      <li><strong>Least privilege</strong>: vai trò mặc định có ít quyền nhất; quyền quản trị tách API riêng, có thể thêm lớp mạng (chỉ truy cập từ VPN) và xác thực mạnh hơn.</li>
      <li><strong>Log và cảnh báo</strong> khi một user nhận nhiều 403/404 liên tiếp trên ID khác nhau — dấu hiệu đang dò.</li>
    </ol>

    <p><strong>4. 403 hay 404?</strong> Khi user không có quyền với một object cụ thể, trả <code>404 Not Found</code> thường tốt hơn <code>403</code>
    vì không xác nhận "object này có tồn tại". Với chức năng (BFLA), trả <code>403 Forbidden</code> là bình thường. Quan trọng nhất là <em>thống nhất</em> trong toàn hệ thống.</p>

    <p><strong>5. Kiểm thử phân quyền tự động — ma trận user × endpoint.</strong> Lỗi phân quyền gần như không bị unit test thông thường phát hiện,
    vì test thường chỉ đăng nhập bằng <em>chủ sở hữu</em>. Cách làm hiệu quả:</p>
    <ul>
      <li>Tạo sẵn vài tài khoản: <em>khách chưa đăng nhập</em>, <em>user A</em>, <em>user B</em>, <em>user tenant khác</em>, <em>admin</em>.</li>
      <li>Liệt kê mọi endpoint (có thể sinh từ OpenAPI/route table) và ghi rõ <strong>kết quả mong đợi</strong> cho từng ô của ma trận.</li>
      <li>Chạy test trong CI: user B gọi tài nguyên của user A phải nhận 404; user thường gọi API admin phải nhận 403; khách phải nhận 401.</li>
      <li>Thêm test "endpoint mới chưa khai báo quyền thì build fail" để ép deny by default.</li>
    </ul>

    <div class="callout"><p>💡 Câu hỏi vàng khi review mọi handler có tham số ID: <strong>"Nếu tôi đổi ID này thành ID của người khác, dòng code nào sẽ chặn lại?"</strong>
    Nếu không chỉ ra được dòng đó — đó là lỗi IDOR.</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Chỉ kiểm tra đăng nhập", lines: [
      "// Pseudo-code: xem chi tiết đơn hàng",
      "handle GET /orders/{id} (req):",
      "    requireLogin(req)                          // chỉ biết 'đã đăng nhập'",
      "    order = db.query('SELECT * FROM orders WHERE id = ?', [req.params.id])",
      "    return order                               // không hỏi: đơn này của ai?",
      "",
      "// User A (id=5) đăng nhập, gọi /orders/1001 -> đơn của A, OK",
      "// User A đổi thành /orders/1002 -> nhận đơn của user B  (IDOR/BOLA)",
      "",
      "// BFLA: nút 'Xoá user' bị ẩn trên UI, nhưng API không kiểm tra vai trò",
      "handle DELETE /admin/users/{id} (req):",
      "    requireLogin(req)",
      "    db.deleteUser(req.params.id)               // user thường gọi thẳng vẫn chạy"
    ]},
    { id: "safe", label: "✅ Kiểm tra từng object", lines: [
      "handle GET /orders/{id} (req):",
      "    user = currentUser(req)                    // lấy từ session/token, không từ tham số",
      "    order = db.query(",
      "        'SELECT * FROM orders WHERE id = ? AND owner_id = ?',",
      "        [req.params.id, user.id])              // truy vấn kèm owner",
      "    if order is null: return 404               // không lộ việc đơn có tồn tại",
      "    return order",
      "",
      "// SaaS nhiều khách hàng: luôn kèm tenant",
      "//   WHERE id = ? AND tenant_id = ?   (tenant lấy từ token, không từ body)",
      "",
      "handle DELETE /admin/users/{id} (req):",
      "    authorize(currentUser(req), 'user:delete') // kiểm tra CHỨC NĂNG -> 403",
      "    db.deleteUser(req.params.id)"
    ]},
    { id: "policy", label: "🛡️ Policy tập trung", lines: [
      "// Khai báo quyền ở MỘT chỗ; route nào không khai báo -> bị chặn",
      "routes = [",
      "  { method: 'GET',    path: '/orders/{id}',      policy: 'order:read'  },",
      "  { method: 'DELETE', path: '/admin/users/{id}', policy: 'user:delete' },",
      "]",
      "",
      "middleware authz(req, route):",
      "    if route.policy is missing: return 403     // DENY BY DEFAULT",
      "    user = currentUser(req)",
      "    if not can(user, route.policy, req): return 403",
      "",
      "can(user, 'order:read', req):",
      "    order = loadOrder(req.params.id)",
      "    return order.ownerId == user.id or user.role == 'support'",
      "",
      "can(user, 'user:delete', req):",
      "    return user.role == 'admin'"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Node.js (Express + ORM): lọc theo owner ngay trong truy vấn",
      "const order = await Order.findOne({ where: { id: req.params.id, ownerId: req.user.id } });",
      "if (!order) return res.sendStatus(404);",
      "# Python (Django): queryset theo user",
      "order = get_object_or_404(Order, pk=order_id, owner=request.user)",
      "# Java (Spring Security): policy khai báo trên method",
      "@PreAuthorize(\"hasRole('ADMIN')\") public void deleteUser(Long id) { ... }",
      "# Go: repository luôn nhận ownerID",
      "order, err := repo.FindOrder(ctx, orderID, userID)  // SQL có AND owner_id = $2",
      "# Ruby on Rails: scope qua quan hệ của user",
      "@order = current_user.orders.find(params[:id])",
      "",
      "# Điểm chung: ID object LUÔN đi kèm danh tính lấy từ phiên đăng nhập"
    ]},
    { id: "test", label: "🧪 Test ma trận quyền", lines: [
      "// Ma trận mong đợi: hàng = người gọi, cột = endpoint",
      "matrix = {",
      "  'GET /orders/{A_order}':     { guest: 401, userA: 200, userB: 404, admin: 200 },",
      "  'PUT /orders/{A_order}':     { guest: 401, userA: 200, userB: 404, admin: 403 },",
      "  'DELETE /admin/users/{id}':  { guest: 401, userA: 403, userB: 403, admin: 204 },",
      "}",
      "",
      "for (endpoint, expected) in matrix:",
      "    for (actor, status) in expected:",
      "        res = callAs(actor, endpoint)",
      "        assert res.status == status, actor + ' -> ' + endpoint",
      "",
      "// Thêm test: mọi route trong router PHẢI có policy, nếu không -> CI fail",
      "assert allRoutes().every(r => r.policy is defined)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request</div><div class="ns">GET /orders/1002 · token của user A</div></div>
    <div class="arrow" id="a1">↓ xác thực</div>
    <div class="node" id="authn"><div class="nl">🔑 Authentication</div><div class="ns">biết người gọi là user A (từ token)</div></div>
    <div class="arrow" id="a2">↓ phân quyền</div>
    <div class="row">
      <div class="node" id="func"><div class="nl">🧩 Quyền chức năng</div><div class="ns">user A có được gọi 'order:read'? (BFLA)</div></div>
      <div class="node" id="obj"><div class="nl">📦 Quyền trên object</div><div class="ns">đơn 1002 có thuộc user A? (BOLA)</div></div>
    </div>
    <div class="arrow" id="a3">↓ truy vấn kèm owner/tenant</div>
    <div class="row">
      <div class="node" id="leak"><div class="nl">❌ Chỉ WHERE id = ?</div><div class="ns">trả đơn của user B</div></div>
      <div class="node" id="ok"><div class="nl">✅ WHERE id = ? AND owner_id = ?</div><div class="ns">không khớp → 404</div></div>
    </div>
    <div class="arrow" id="a4">↓ kiểm chứng</div>
    <div class="node" id="matrix"><div class="nl">🧪 Test ma trận user × endpoint</div><div class="ns">chạy trong CI · route thiếu policy → fail</div></div>
  `,
  steps: [
    { title: "1 · Lỗi IDOR/BOLA: chỉ kiểm tra đăng nhập", tab: "vuln", highlight: [3, 4, 5, 7, 8], on: ["req", "authn", "leak"],
      desc: "Server biết người gọi là user A nhưng không hỏi <em>đơn 1002 là của ai</em>. Chỉ cần đổi số ID trong URL là xem được dữ liệu người khác — không cần kỹ thuật gì đặc biệt." },
    { title: "2 · Lỗi BFLA: ẩn nút ≠ chặn quyền", tab: "vuln", highlight: [10, 11, 12, 13], on: ["func"],
      desc: "Giao diện ẩn nút Xoá với user thường, nhưng API không kiểm tra vai trò. Kẻ tấn công gửi request trực tiếp, không cần giao diện." },
    { title: "3 · Truy vấn luôn kèm owner/tenant", tab: "safe", highlight: [2, 3, 4, 5, 6, 10], on: ["obj", "a3", "ok"],
      desc: "Danh tính lấy từ token; ID object luôn đi cùng <code>owner_id</code> hoặc <code>tenant_id</code>. Không khớp → 404, không lộ việc object tồn tại." },
    { title: "4 · Kiểm tra quyền chức năng", tab: "safe", highlight: [12, 13, 14], on: ["func", "a2"],
      desc: "Chức năng quản trị phải kiểm tra vai trò/quyền ở server. Không đủ quyền → 403." },
    { title: "5 · Policy tập trung + deny by default", tab: "policy", highlight: [2, 3, 4, 8, 10, 14, 17], on: ["func", "obj"],
      desc: "Khai báo quyền ở một chỗ; middleware từ chối mọi route không khai báo policy. Endpoint mới quên khai báo sẽ bị chặn chứ không bị thủng." },
    { title: "6 · Ngôn ngữ nào cũng làm được", tab: "langs", highlight: [2, 5, 7, 9, 11, 13], on: ["ok"],
      desc: "ORM, Django, Spring, Go, Rails đều có cách viết truy vấn gắn với user hiện tại. Dấu hiệu nguy hiểm khi review: <code>findById(req.params.id)</code> mà không có điều kiện sở hữu." },
    { title: "7 · Kiểm chứng bằng test ma trận", tab: "test", highlight: [2, 3, 4, 5, 10, 11, 14], on: ["a4", "matrix"],
      desc: "Gọi mọi endpoint bằng mọi vai trò, so với kết quả mong đợi. Chạy trong CI để lỗi phân quyền không lọt lại khi thêm tính năng mới." }
  ],

  quiz: [
    { q: "Khác biệt giữa authentication và authorization là gì?", options: [
        "Hai từ có nghĩa giống nhau",
        "Authentication xác định bạn là ai; authorization quyết định bạn được làm gì với dữ liệu nào",
        "Authentication chỉ dùng cho admin",
        "Authorization là mã hoá mật khẩu"
      ], correct: 1,
      explanation: "Đăng nhập thành công không có nghĩa là được truy cập mọi thứ. Mỗi hành động trên mỗi object cần kiểm tra quyền riêng." },
    { q: "User A đổi /orders/1001 thành /orders/1002 và xem được đơn hàng của user B. Đây là lỗi gì?", options: [
        "SQL Injection",
        "IDOR / BOLA — thiếu kiểm tra quyền trên object",
        "XSS",
        "Lỗi hiệu năng"
      ], correct: 1,
      explanation: "Server không kiểm tra đơn hàng được yêu cầu có thuộc người gọi không." },
    { q: "Nút 'Xoá user' đã bị ẩn trên giao diện với user thường. Như vậy đã an toàn chưa?", options: [
        "Rồi, user thường không thấy nút thì không xoá được",
        "Chưa, API vẫn phải kiểm tra vai trò/quyền ở server vì request có thể được gửi trực tiếp",
        "Rồi, nếu dùng HTTPS",
        "Rồi, nếu URL admin khó đoán"
      ], correct: 1,
      explanation: "Đây là BFLA. Giao diện chỉ là tiện ích; mọi kiểm tra quyền phải nằm ở server." },
    { q: "Cách viết truy vấn nào an toàn nhất để lấy đơn hàng theo ID?", options: [
        "SELECT * FROM orders WHERE id = ?",
        "SELECT * FROM orders WHERE id = ? AND owner_id = ?  (owner_id lấy từ phiên đăng nhập)",
        "SELECT * FROM orders WHERE id = ? AND owner_id = ?  (owner_id lấy từ query string client gửi)",
        "SELECT * FROM orders rồi lọc ở client"
      ], correct: 1,
      explanation: "Danh tính phải lấy từ session/token đã xác thực. Nếu lấy owner_id từ client thì kẻ tấn công chỉ việc sửa luôn tham số đó." },
    { q: "'Deny by default' nghĩa là gì trong phân quyền?", options: [
        "Từ chối mọi request kể cả của admin",
        "Endpoint không khai báo rõ quyền thì bị từ chối; quyền phải được cấp tường minh",
        "Chỉ cho phép request từ localhost",
        "Tắt tính năng đăng nhập"
      ], correct: 1,
      explanation: "Quên khai báo quyền sẽ dẫn đến bị chặn (an toàn) thay vì bị mở (thủng)." },
    { q: "Dùng UUID thay cho ID tăng dần có giải quyết được IDOR không?", options: [
        "Có, hoàn toàn",
        "Không; UUID chỉ làm việc dò ID khó hơn, vẫn phải kiểm tra quyền trên từng object",
        "Có, nếu UUID dài hơn 64 ký tự",
        "Không cần, vì ID tăng dần an toàn hơn"
      ], correct: 1,
      explanation: "ID có thể lộ qua link chia sẻ, log, email, API khác. UUID là lớp phụ, không thay thế kiểm tra quyền." },
    { q: "Vì sao nên tập trung logic phân quyền vào middleware/policy thay vì viết if trong từng handler?", options: [
        "Vì chạy nhanh hơn",
        "Vì dễ review, nhất quán, và endpoint mới khó bị quên kiểm tra",
        "Vì bắt buộc theo HTTP",
        "Vì không cần test nữa"
      ], correct: 1,
      explanation: "Kiểm tra rải rác thì chỉ cần một handler quên là thủng. Policy tập trung + deny by default giảm rủi ro này." },
    { q: "User không có quyền xem một đơn hàng cụ thể. Server nên trả gì cho hợp lý?", options: [
        "200 kèm dữ liệu rỗng một phần",
        "404 Not Found — không xác nhận object có tồn tại",
        "500 Internal Server Error",
        "302 chuyển về trang chủ kèm dữ liệu đơn"
      ], correct: 1,
      explanation: "404 tránh lộ thông tin 'object này tồn tại'. Quan trọng là thống nhất trong toàn hệ thống." },
    { q: "Trong hệ thống SaaS nhiều khách hàng (multi-tenant), truy vấn dữ liệu cần thêm điều gì?", options: [
        "Không cần gì thêm",
        "Luôn kèm tenant_id lấy từ token của người gọi",
        "Luôn kèm tenant_id lấy từ body request",
        "Tạo một database cho mỗi request"
      ], correct: 1,
      explanation: "Thiếu điều kiện tenant, người của khách hàng này có thể đọc dữ liệu khách hàng khác. tenant_id phải lấy từ nguồn đáng tin." },
    { q: "Test phân quyền tự động hiệu quả nên làm thế nào?", options: [
        "Chỉ test bằng tài khoản chủ sở hữu dữ liệu",
        "Ma trận user × endpoint: gọi mọi endpoint bằng nhiều vai trò (khách, user A, user B, admin) và so với kết quả mong đợi",
        "Chỉ test bằng tay trước mỗi lần release lớn",
        "Không cần test nếu đã code review"
      ], correct: 1,
      explanation: "Test thông thường chỉ đăng nhập bằng chủ sở hữu nên không phát hiện IDOR. Ma trận vai trò buộc kiểm tra cả trường hợp 'người khác'." },
    { q: "Handler đọc userId từ header X-User-Id do client gửi để xác định người gọi. Vấn đề là gì?", options: [
        "Không vấn đề gì",
        "Client có thể tự đặt header này thành ID của người khác; danh tính phải lấy từ session/token đã xác thực",
        "Header quá dài",
        "Header không được mã hoá base64"
      ], correct: 1,
      explanation: "Mọi thứ client gửi đều có thể bị sửa. Chỉ dữ liệu server tự xác minh (session, token có chữ ký) mới đáng tin." }
  ]
});
