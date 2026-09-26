window.LESSONS.push({
  id: "11",
  phase: "4", phaseName: "Truy vấn an toàn",
  title: "NoSQL, Redis & KV: injection không cần SQL",
  subtitle: "Ép kiểu filter Mongo · không đưa nguyên body vào update · Redis dùng client lib thay vì ghép lệnh · đặt tên key an toàn (prefix theo tenant, server quyết định key)",

  theory: `
    <p>"Không dùng SQL thì không bị injection" — sai. Mọi hệ thống nhận <em>cấu trúc</em> từ bên ngoài đều có thể bị lừa. Với NoSQL, cấu trúc đó là
    <strong>object JSON</strong> (Mongo), <strong>danh sách tham số lệnh</strong> (Redis), hoặc <strong>tên key</strong> (Redis, Cloudflare KV, R2). Bài này đi qua ba dạng đó và cách phòng.</p>

    <p><strong>1. MongoDB: khi giá trị trở thành toán tử</strong></p>
    <p>Filter Mongo là object. Nếu code viết <code>find({ email: req.body.email })</code> và body là JSON, client có thể gửi <code>email</code> là một <em>object</em> thay vì chuỗi —
    ví dụ dạng <code>{ "$&lt;toán_tử&gt;": &lt;giá_trị&gt; }</code>. Khi đó điều kiện "email bằng X" biến thành "email thoả toán tử do client chọn", có thể khớp với mọi tài liệu.
    Cùng kiểu lỗi với SQL injection: dữ liệu biến thành cấu trúc truy vấn.</p>
    <p>Cách phòng, từ gốc tới lớp phụ:</p>
    <ol>
      <li><strong>Validate kiểu ở ranh giới</strong>: schema (Zod, Joi, Pydantic, JSON Schema…) khẳng định <code>email</code> là <em>chuỗi</em>, <code>qty</code> là <em>số</em>. Object ở chỗ cần chuỗi → 400.</li>
      <li><strong>Ép kiểu khi dựng filter</strong>: <code>{ email: String(email) }</code> hoặc dùng toán tử tường minh <code>{ email: { $eq: email } }</code> (giá trị object đặt trong <code>$eq</code> chỉ được so sánh bằng).</li>
      <li><strong>Bật chế độ sanitize của thư viện</strong>: Mongoose <code>sanitizeFilter</code> bọc giá trị chứa khoá <code>$</code> bằng <code>$eq</code>; hoặc middleware loại bỏ khoá bắt đầu bằng <code>$</code> / chứa <code>.</code> trong input.</li>
      <li><strong>Không nhận filter, sort, projection, pipeline tuỳ ý từ client</strong>. API tìm kiếm nhận vài tham số có kiểu và server tự dựng filter.</li>
      <li><strong>Update</strong>: không bao giờ <code>updateOne(filter, req.body)</code> — client có thể gửi toán tử cập nhật và field nhạy cảm (<code>role</code>, <code>tenantId</code>). Dùng <code>$set</code> với danh sách field được phép.</li>
      <li>Tắt server-side JS (<code>javascriptEnabled: false</code>, bài 09) để loại bỏ <code>$where</code>.</li>
    </ol>

    <p><strong>2. Redis: đừng ghép lệnh bằng chuỗi</strong></p>
    <p>Giao thức Redis là danh sách tham số. Client lib (node-redis, ioredis, redis-py, Jedis, go-redis…) gửi mỗi tham số như một khối nhị phân có độ dài — giá trị chứa khoảng trắng, xuống dòng
    hay ký tự lạ vẫn chỉ là <em>một</em> tham số. Lỗi xảy ra khi code tự ghép chuỗi lệnh rồi tách theo dấu cách, hoặc tự viết giao thức: input có dấu cách/xuống dòng sẽ thành
    <em>tham số hoặc lệnh thêm</em>. Tương tự với Lua: truyền dữ liệu qua <code>KEYS</code>/<code>ARGV</code>, không ghép vào thân script.</p>

    <p><strong>3. Tên key là một phần của phân quyền</strong></p>
    <p>Trong Redis/KV/R2, "ai được đọc gì" thường chỉ phụ thuộc <em>tên key</em>. Nếu client quyết định key, client quyết định đọc dữ liệu của ai.</p>
    <ul>
      <li><strong>Server dựng key</strong> từ danh tính đã xác thực: <code>t:{tenantId}:cart:{userId}</code>. Client chỉ gửi phần "nội dung", không gửi key.</li>
      <li><strong>Validate từng thành phần</strong>: ID là UUID/số; không cho chứa ký tự phân tách (<code>:</code>) — nếu không, <code>"a:b" + ":" + "c"</code> và <code>"a" + ":" + "b:c"</code> ra cùng một key.</li>
      <li><strong>Prefix kết thúc bằng dấu phân tách</strong> khi liệt kê: <code>list({ prefix: 't:12:' })</code> chứ không phải <code>'t:12'</code> (sẽ lấy luôn tenant 120, 121…).</li>
      <li><strong>Tên file người dùng</strong> không dùng làm key R2 trực tiếp: sinh key ngẫu nhiên (UUID), lưu tên gốc trong metadata; tránh đè file của người khác và tránh ký tự gây hiểu nhầm ở hệ thống phía sau.</li>
      <li>Kết hợp với <strong>ACL theo key pattern</strong> (Redis <code>~t:*</code>, bài 07) để giới hạn thêm ở phía server.</li>
    </ul>

    <table>
      <tr><th>Hệ thống</th><th>"Cấu trúc" có thể bị lừa</th><th>Phòng thủ chính</th></tr>
      <tr><td>MongoDB</td><td>object filter/update có toán tử <code>$</code></td><td>schema + ép kiểu + <code>$eq</code>/sanitizeFilter + <code>$set</code> allowlist</td></tr>
      <tr><td>Redis</td><td>tham số/lệnh ghép chuỗi; thân Lua</td><td>API client lib; <code>KEYS</code>/<code>ARGV</code>; ACL</td></tr>
      <tr><td>Redis / Cloudflare KV</td><td>tên key</td><td>server dựng key từ session; validate thành phần; prefix có dấu phân tách</td></tr>
      <tr><td>Cloudflare R2</td><td>object key từ tên file</td><td>key ngẫu nhiên, tên gốc vào metadata</td></tr>
    </table>

    <div class="callout"><p>💡 Test tự động nên gửi <em>sai kiểu</em> vào mọi field: object thay cho chuỗi, mảng thay cho số, chuỗi có xuống dòng, chuỗi có ký tự phân tách key.
    API đúng phải trả 400 — không bao giờ trả dữ liệu.</p></div>
  `,

  codeTabs: [
    { id: "mongo", label: "🍃 Mongo filter", lines: [
      "// ❌ Body JSON đi thẳng vào filter",
      "user = await users.findOne({ email: req.body.email, password: req.body.password })",
      "// nếu req.body.password là object { \"$<toán_tử>\": <giá_trị> } -> điều kiện bị đổi nghĩa",
      "",
      "// ✅ 1. Validate kiểu ở ranh giới",
      "const Login = z.object({ email: z.string().email().max(254), password: z.string().max(200) }).strict()",
      "const input = Login.parse(req.body)                   // object -> 400",
      "",
      "// ✅ 2. Filter chỉ theo field có kiểu; so sánh mật khẩu bằng hàm hash, không trong query",
      "user = await users.findOne({ email: { $eq: input.email } })",
      "ok = user && await verifyPasswordHash(user.passwordHash, input.password)",
      "",
      "// ✅ 3. Lớp phụ: Mongoose tự bọc giá trị có '$' bằng $eq",
      "mongoose.set('sanitizeFilter', true)"
    ]},
    { id: "update", label: "🍃 Mongo update", lines: [
      "// ❌ Đưa nguyên body vào update",
      "await users.updateOne({ _id: me }, req.body)",
      "// client có thể gửi toán tử cập nhật + field nhạy cảm (role, tenantId, balance)",
      "",
      "// ✅ Chỉ $set các field được phép, đúng kiểu",
      "const Profile = z.object({ displayName: z.string().max(80), bio: z.string().max(500) })",
      "  .partial().strict()",
      "const patch = Profile.parse(req.body)",
      "await users.updateOne({ _id: me, tenantId: session.tenantId }, { $set: patch })",
      "",
      "// Python (PyMongo) — cùng ý tưởng",
      "patch = ProfilePatch.model_validate(body).model_dump(exclude_unset=True)",
      "db.users.update_one({'_id': me, 'tenantId': tenant}, {'$set': patch})"
    ]},
    { id: "redis", label: "🟥 Redis lệnh", lines: [
      "// ❌ Tự ghép lệnh rồi tách theo dấu cách",
      "client.sendCommand(('SET profile:' + userId + ' ' + displayName).split(' '))",
      "// displayName có dấu cách -> thành THAM SỐ THÊM của lệnh SET (vd. tuỳ chọn hết hạn...)",
      "",
      "// ✅ Dùng API của client lib: mỗi giá trị là MỘT tham số",
      "await client.set('profile:' + userId, displayName)          // node-redis / ioredis",
      "r.set(f'profile:{user_id}', display_name)                    # redis-py",
      "jedis.set(\"profile:\" + userId, displayName);               // Jedis",
      "",
      "// ✅ Lua: dữ liệu qua KEYS/ARGV, script là hằng số",
      "const INCR_LIMIT = \"local v = redis.call('INCR', KEYS[1]); if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return v\"",
      "await client.eval(INCR_LIMIT, { keys: ['rl:' + userId], arguments: ['60'] })"
    ]},
    { id: "keys", label: "🔑 Đặt tên key", lines: [
      "// ❌ Client quyết định key",
      "GET /cache?key=t:12:cart:777          -> redis.get(req.query.key)",
      "",
      "// ✅ Server dựng key từ danh tính + validate từng thành phần",
      "function cartKey(session):",
      "    t = requireUuid(session.tenantId)          // không chứa ':'",
      "    u = requireUuid(session.userId)",
      "    return 't:' + t + ':cart:' + u",
      "",
      "// Liệt kê theo prefix: KẾT THÚC bằng dấu phân tách",
      "env.KV.list({ prefix: 't:' + tenantId + ':' })   // ✅ không lấy nhầm tenant 120",
      "env.KV.list({ prefix: 't:' + tenantId })         // ❌ 't:12' khớp cả 't:120:...'",
      "",
      "// R2: key ngẫu nhiên, tên gốc vào metadata",
      "const key = 't/' + tenantId + '/uploads/' + crypto.randomUUID()",
      "await env.UPLOADS.put(key, body, { customMetadata: { originalName: safeName(file.name) } })"
    ]}
  ],

  stageHtml: `
    <div class="node" id="input"><div class="nl">📨 Input từ client</div><div class="ns">JSON · chuỗi · tên file</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="schema"><div class="nl">📐 Validate kiểu</div><div class="ns">chuỗi là chuỗi, số là số — object sai chỗ → 400</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="mfilter"><div class="nl">🍃 Filter / $set</div><div class="ns">$eq · field allowlist</div></div>
      <div class="node" id="rcmd"><div class="nl">🟥 Lệnh Redis</div><div class="ns">API client lib · KEYS/ARGV</div></div>
      <div class="node" id="kname"><div class="nl">🔑 Tên key</div><div class="ns">server dựng từ session</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="store"><div class="nl">🗄️ Mongo · Redis · KV · R2</div><div class="ns">+ ACL theo key pattern</div></div>
  `,
  steps: [
    { title: "1 · Giá trị biến thành toán tử", tab: "mongo", highlight: [2, 3], on: ["input", "mfilter"],
      desc: "Body JSON cho phép client gửi object ở chỗ code tưởng là chuỗi. Filter Mongo khi đó chứa toán tử do client chọn — injection không cần SQL." },
    { title: "2 · Validate kiểu + $eq", tab: "mongo", highlight: [6, 7, 10, 11, 14], on: ["schema", "a2", "mfilter"],
      desc: "Schema chặn object sai chỗ; <code>$eq</code> và <code>sanitizeFilter</code> là lớp phụ. Mật khẩu so bằng hàm hash trong code, không đặt vào query." },
    { title: "3 · Update chỉ qua $set allowlist", tab: "update", highlight: [2, 3, 6, 7, 8, 9], on: ["mfilter", "store"],
      desc: "Nguyên body làm update = client tự chọn toán tử và field (kể cả <code>role</code>). Schema <code>.strict()</code> + <code>$set</code> chỉ field cho phép." },
    { title: "4 · Redis: mỗi giá trị là một tham số", tab: "redis", highlight: [2, 3, 6, 7, 8], on: ["rcmd"],
      desc: "Ghép rồi tách theo dấu cách biến dữ liệu thành tham số thêm. API client lib gửi giá trị như một khối có độ dài — không tách được." },
    { title: "5 · Lua: script cố định, dữ liệu qua ARGV", tab: "redis", highlight: [11, 12], on: ["rcmd", "store"],
      desc: "Script là hằng số (có thể nạp một lần bằng SCRIPT LOAD/FUNCTION). Key và giá trị truyền qua <code>KEYS</code>/<code>ARGV</code>." },
    { title: "6 · Tên key do server quyết định", tab: "keys", highlight: [2, 5, 6, 7, 8, 11, 12], on: ["kname", "store"],
      desc: "Key dựng từ session, thành phần đã validate. Prefix liệt kê kết thúc bằng <code>:</code> để không lấy nhầm tenant có ID bắt đầu giống." },
    { title: "7 · R2: key ngẫu nhiên", tab: "keys", highlight: [15, 16], on: ["kname", "store"],
      desc: "Tên file người dùng chỉ là metadata; key là UUID dưới prefix tenant. Tránh ghi đè và nhầm lẫn ở hệ thống phía sau." }
  ],

  quiz: [
    { q: "Code Mongo 'findOne({ email: req.body.email })' có rủi ro gì khi body là JSON?", options: [
        "Không rủi ro vì Mongo không dùng SQL",
        "Client gửi object chứa toán tử thay cho chuỗi, làm điều kiện bị đổi nghĩa",
        "Chỉ chậm hơn",
        "Mongo tự từ chối object"
      ], correct: 1,
      explanation: "Validate kiểu (chuỗi) ở ranh giới và dùng $eq/sanitizeFilter." },
    { q: "Vì sao không được viết updateOne({_id: me}, req.body)?", options: [
        "Vì updateOne chậm",
        "Không có vấn đề gì",
        "Vì _id không dùng được làm filter",
        "Client tự chọn toán tử cập nhật và field — có thể sửa role, tenantId, số dư…"
      ], correct: 3,
      explanation: "Chỉ $set các field trong allowlist sau khi validate kiểu." },
    { q: "Mongoose 'sanitizeFilter' làm gì?", options: [
        "Xoá mọi filter",
        "Mã hoá filter",
        "Bọc giá trị có khoá bắt đầu bằng $ trong $eq, để chúng chỉ được so sánh bằng",
        "Bật TLS"
      ], correct: 2,
      explanation: "Là lớp phụ tốt, nhưng vẫn nên validate kiểu ở ranh giới." },
    { q: "Vì sao dùng client.set(key, value) an toàn hơn tự ghép chuỗi lệnh Redis?", options: [
        "Client lib gửi mỗi giá trị như một tham số có độ dài — ký tự đặc biệt/khoảng trắng không tạo được tham số hay lệnh mới",
        "Vì client lib mã hoá giá trị",
        "Vì Redis chặn chuỗi ghép",
        "Không khác nhau"
      ], correct: 0,
      explanation: "Tương tự truy vấn có tham số trong SQL." },
    { q: "Script Lua trong Redis nên nhận dữ liệu thế nào?", options: [
        "Ghép thẳng vào thân script",
        "Qua CONFIG SET",
        "Qua biến môi trường",
        "Qua KEYS và ARGV, thân script là hằng số"
      ], correct: 3,
      explanation: "Giữ script cố định; dữ liệu là tham số." },
    { q: "env.KV.list({ prefix: 't:12' }) có vấn đề gì?", options: [
        "Không có vấn đề",
        "Khớp cả key của tenant 120, 121… — prefix phải kết thúc bằng dấu phân tách 't:12:'",
        "Chậm hơn",
        "KV không hỗ trợ prefix"
      ], correct: 1,
      explanation: "Lỗi nhỏ, hậu quả là rò rỉ chéo tenant." },
    { q: "Ai nên quyết định tên key cache/session?", options: [
        "Server, dựng từ danh tính đã xác thực và các thành phần đã validate",
        "Client, để linh hoạt",
        "Người dùng cuối qua giao diện",
        "Không quan trọng"
      ], correct: 0,
      explanation: "Trong Redis/KV, tên key thường chính là ranh giới phân quyền." },
    { q: "Khi người dùng upload file lên R2, key nên đặt thế nào?", options: [
        "Dùng nguyên tên file người dùng gửi",
        "Dùng tên file + thời gian",
        "Key ngẫu nhiên (UUID) dưới prefix tenant; tên gốc lưu trong metadata sau khi làm sạch",
        "Dùng email người dùng làm key"
      ], correct: 2,
      explanation: "Tránh ghi đè, đoán key, và ký tự gây hiểu nhầm ở hệ thống phía sau." },
    { q: "Vì sao thành phần của key không nên chứa ký tự phân tách (ví dụ ':')?", options: [
        "Vì Redis cấm dấu ':'",
        "Vì hai tổ hợp thành phần khác nhau có thể ghép ra cùng một key, dẫn tới đọc/ghi nhầm dữ liệu",
        "Vì làm key dài hơn",
        "Vì KV không hỗ trợ"
      ], correct: 1,
      explanation: "'a:b'+':'+'c' và 'a'+':'+'b:c' ra cùng kết quả. Validate hoặc encode thành phần." }
  ]
});
