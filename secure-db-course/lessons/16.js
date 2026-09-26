window.LESSONS.push({
  id: "16",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "Redis & cache: nhanh nhưng đừng cẩu thả",
  subtitle: "Không cache dữ liệu nhạy cảm bừa · key cache phải chứa ngữ cảnh quyền · session store · key namespace · maxmemory/eviction · persistence · KV & Durable Objects",

  theory: `
    <p>Cache thường được thêm vào sau cùng, "chỉ để tăng tốc", và vì vậy hay bị bỏ qua khi review bảo mật. Nhưng cache chứa <strong>bản sao của dữ liệu đã qua kiểm tra quyền</strong>:
    nếu cache sai cách, một người có thể nhận được kết quả mà hệ thống đã tính cho người khác. Bài này tập trung vào Redis (và tương đương như Valkey, KeyDB), Cloudflare KV/Cache,
    và nguyên tắc chung cho mọi lớp cache.</p>

    <p><strong>1. Cache cái gì — và KHÔNG cache cái gì</strong></p>
    <ul>
      <li>Nên cache: dữ liệu công khai hoặc dùng chung (danh mục sản phẩm, cấu hình), kết quả tính toán tốn kém <em>đã gắn với người/tenant cụ thể</em>.</li>
      <li>Cẩn thận/tránh: nguyên object user (thường kèm password hash, token, cờ quyền), token của bên thứ ba, số giấy tờ, dữ liệu sức khoẻ/tài chính.
        Nếu buộc phải cache, chỉ cache <em>field cần hiển thị</em>, có TTL ngắn, và cân nhắc mã hoá giá trị (bài 14).</li>
      <li>Redis mặc định không mã hoá dữ liệu trong RAM và file RDB/AOF → coi Redis chứa gì thì bảo vệ như DB chứa thứ đó.</li>
    </ul>

    <p><strong>2. Lỗi nguy hiểm nhất: key cache thiếu ngữ cảnh quyền</strong></p>
    <p>Ví dụ: API <code>/api/me/orders</code> cache kết quả với key <code>cache:/api/me/orders</code>. Người A gọi trước → kết quả của A được lưu. Người B gọi sau → nhận đơn hàng của A.
    Quy tắc: <strong>mọi thứ ảnh hưởng tới kết quả (tenant, user, role, ngôn ngữ, tham số) phải nằm trong key</strong>, và phần danh tính lấy từ session đã xác thực.
    Cùng lỗi này xảy ra với cache HTTP/CDN: response có dữ liệu riêng phải gửi <code>Cache-Control: private, no-store</code>.</p>

    <p><strong>3. Namespace & cách ly</strong></p>
    <ul>
      <li>Key có prefix rõ ràng: <code>&lt;app&gt;:&lt;loại&gt;:t:&lt;tenant&gt;:...</code>; kết hợp ACL <code>~&lt;app&gt;:*</code> để mỗi service chỉ chạm key của nó (bài 07, 11).</li>
      <li><code>SELECT 0..15</code> (logical database) <strong>không phải</strong> ranh giới bảo mật — client dùng được lệnh SELECT là sang được DB khác. Cần cách ly thật → ACL theo prefix hoặc instance riêng.</li>
      <li>Tách instance theo mục đích: <em>cache</em> (mất được), <em>session</em> (mất là đăng xuất hàng loạt), <em>rate limit/khoá tài khoản</em> (mất là mở cửa brute-force). Mỗi loại cần cấu hình eviction/persistence khác nhau.</li>
    </ul>

    <p><strong>4. maxmemory & eviction — cũng là chuyện bảo mật</strong></p>
    <p>Không đặt <code>maxmemory</code>, Redis dùng RAM tới khi hệ điều hành giết tiến trình (DoS). Đặt rồi thì phải chọn chính sách khi đầy:</p>
    <table>
      <tr><th>Chính sách</th><th>Hành vi</th><th>Hợp với</th></tr>
      <tr><td><code>allkeys-lru</code> / <code>allkeys-lfu</code></td><td>Xoá key ít dùng, kể cả key không có TTL</td><td>Cache thuần</td></tr>
      <tr><td><code>volatile-lru</code> / <code>volatile-ttl</code></td><td>Chỉ xoá key có TTL</td><td>Instance trộn dữ liệu có/không TTL</td></tr>
      <tr><td><code>noeviction</code></td><td>Từ chối lệnh ghi khi đầy</td><td>Session, rate limit, khoá — mất dữ liệu nguy hiểm hơn lỗi ghi</td></tr>
    </table>
    <p>Ví dụ bảo mật: bộ đếm "đăng nhập sai" nằm chung instance cache với <code>allkeys-lru</code>. Kẻ tấn công làm đầy cache (gọi nhiều trang khác nhau) → bộ đếm bị đẩy ra → giới hạn brute-force bị xoá.</p>

    <p><strong>5. Session store</strong></p>
    <ul>
      <li>Session ID ngẫu nhiên ≥ 128 bit từ CSPRNG; lưu key là <em>hash</em> của ID (<code>sess:&lt;sha256(sid)&gt;</code>) để ai đọc được Redis cũng không dùng lại được cookie.</li>
      <li>TTL tuyệt đối + TTL nhàn rỗi; đăng xuất/đổi mật khẩu → <code>DEL</code> session (và danh sách session của user để "đăng xuất mọi thiết bị").</li>
      <li>Giá trị là JSON với field tối thiểu (user_id, tenant, thời điểm tạo) — <strong>không</strong> lưu object tuần tự hoá của ngôn ngữ (pickle, Java serialization): ai ghi được vào Redis sẽ khiến app deserialize dữ liệu độc.</li>
    </ul>

    <p><strong>6. Persistence, replication, Sentinel</strong></p>
    <ul>
      <li>Cache thuần: tắt persistence (<code>save ""</code>, <code>appendonly no</code>) → không có bản sao trên đĩa để lộ.</li>
      <li>Replica xác thực với master bằng <code>masteruser</code>/<code>masterauth</code>; Sentinel cũng đặt mật khẩu (<code>requirepass</code>, <code>sentinel auth-pass</code>) và TLS.</li>
    </ul>

    <p><strong>7. Cloudflare: KV, Cache API, Durable Objects</strong></p>
    <ul>
      <li><strong>KV nhất quán cuối cùng</strong> (thay đổi có thể mất tới khoảng 60 giây để thấy ở mọi nơi). Không dùng KV cho thứ cần thu hồi tức thì (session vừa đăng xuất, token vừa thu hồi) hay bộ đếm rate limit.</li>
      <li>Cần nhất quán mạnh (bộ đếm, khoá, session thu hồi được ngay) → <strong>Durable Objects</strong>, hoặc binding Rate Limiting.</li>
      <li>Cache API (<code>caches.default</code>): key là URL request — response cá nhân hoá không được đưa vào đó trừ khi key chứa danh tính (và thường là không nên).</li>
    </ul>

    <div class="callout"><p>💡 Với mỗi <code>cache.set</code> trong code, hỏi: "Hai người dùng khác nhau có bao giờ sinh ra cùng key này không?". Nếu có mà dữ liệu lại khác nhau theo người — đó là lỗ rò rỉ.</p></div>
  `,

  codeTabs: [
    { id: "key", label: "🔑 Key có ngữ cảnh quyền", lines: [
      "// ❌ Key thiếu danh tính: người B nhận dữ liệu của người A",
      "key = 'cache:' + req.path                      // 'cache:/api/me/orders'",
      "if (hit = redis.get(key)) return hit",
      "",
      "// ✅ Mọi thứ ảnh hưởng tới kết quả nằm trong key; danh tính từ session",
      "key = 'shop:orders:t:' + session.tenantId + ':u:' + session.userId + ':p:' + page",
      "hit = redis.get(key)",
      "if not hit:",
      "    hit = loadOrders(session, page)",
      "    redis.set(key, json(pickFields(hit)), EX=60)   // chỉ field cần, TTL ngắn",
      "",
      "// HTTP/CDN: response cá nhân hoá",
      "res.setHeader('Cache-Control', 'private, no-store')"
    ]},
    { id: "conf", label: "⚙️ redis.conf", lines: [
      "# Instance CACHE (mất được)",
      "maxmemory 2gb",
      "maxmemory-policy allkeys-lru",
      "save \"\"                          # không ghi RDB",
      "appendonly no",
      "",
      "# Instance SESSION / RATE LIMIT (không được tự mất)",
      "maxmemory 1gb",
      "maxmemory-policy noeviction        # đầy -> lỗi ghi, không âm thầm xoá bộ đếm",
      "appendonly yes",
      "",
      "# Replication & Sentinel có xác thực",
      "masteruser replica_user",
      "masterauth <tu-secret-manager>",
      "# sentinel.conf: requirepass <secret> ; sentinel auth-pass mymaster <secret>"
    ]},
    { id: "sess", label: "🍪 Session store", lines: [
      "// Tạo session",
      "sid = base64url(csprng_bytes(32))                 // 256 bit ngẫu nhiên",
      "k = 'sess:' + sha256_hex(sid)                     // lưu hash, không lưu sid",
      "redis.set(k, json({ uid, tenant, created: now() }), EX=8*3600)",
      "redis.sadd('user_sessions:' + uid, k)",
      "set_cookie('sid', sid, HttpOnly, Secure, SameSite=Lax)",
      "",
      "// Mỗi request: tra theo hash, TTL nhàn rỗi",
      "s = redis.get('sess:' + sha256_hex(cookie.sid)); if not s: 401",
      "",
      "// Đổi mật khẩu -> đăng xuất mọi thiết bị",
      "for k in redis.smembers('user_sessions:' + uid): redis.del(k)",
      "",
      "// ❌ Không lưu object tuần tự hoá của ngôn ngữ (pickle / Java serialization)"
    ]},
    { id: "cf", label: "☁️ KV vs Durable Objects", lines: [
      "// KV: tốt cho dữ liệu đọc nhiều, chấp nhận trễ lan truyền (tới ~60 giây)",
      "await env.CONFIG.put('feature-flags', json, { expirationTtl: 300 })",
      "",
      "// ❌ KV cho bộ đếm đăng nhập sai / session cần thu hồi ngay",
      "// (hai edge khác nhau có thể đọc giá trị cũ)",
      "",
      "// ✅ Durable Object: một nơi duy nhất, nhất quán mạnh cho mỗi user",
      "const stub = env.LOGIN_GUARD.get(env.LOGIN_GUARD.idFromName(accountId))",
      "const { allowed } = await stub.checkAndCount()     // RPC tới DO",
      "if (!allowed) return new Response('Too many attempts', { status: 429 })",
      "",
      "// Cache API: key là URL -> không đưa response cá nhân hoá vào",
      "if (!req.headers.has('Authorization')) await caches.default.put(req, res.clone())"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ua"><div class="nl">👤 Người A</div><div class="ns">tenant 12 · user 7</div></div>
      <div class="node" id="ub"><div class="nl">👤 Người B</div><div class="ns">tenant 12 · user 9</div></div>
    </div>
    <div class="arrow" id="a1">↓ key chứa tenant + user</div>
    <div class="row">
      <div class="node" id="cache"><div class="nl">⚡ Instance cache</div><div class="ns">allkeys-lru · không persistence</div></div>
      <div class="node" id="sessn"><div class="nl">🍪 Instance session</div><div class="ns">noeviction · key = hash(sid)</div></div>
      <div class="node" id="rl"><div class="nl">🚦 Rate limit</div><div class="ns">noeviction / Durable Object</div></div>
    </div>
    <div class="arrow" id="a2">↓ cache miss</div>
    <div class="node" id="src"><div class="nl">🗄️ DB gốc</div><div class="ns">kiểm tra quyền trước khi cache</div></div>
  `,
  steps: [
    { title: "1 · Key thiếu danh tính = rò rỉ chéo người dùng", tab: "key", highlight: [2, 3], on: ["ua", "ub", "cache"],
      desc: "Người gọi sau nhận kết quả đã tính cho người gọi trước. Lỗi này không cần kẻ tấn công giỏi — chỉ cần hai người dùng thật." },
    { title: "2 · Mọi yếu tố ảnh hưởng kết quả nằm trong key", tab: "key", highlight: [6, 9, 10, 13], on: ["a1", "cache", "src"],
      desc: "Tenant, user, tham số — lấy từ session. Chỉ cache field cần, TTL ngắn. Response cá nhân hoá gửi <code>private, no-store</code>." },
    { title: "3 · Tách instance theo mục đích", tab: "conf", highlight: [2, 3, 4, 5, 8, 9, 10], on: ["cache", "sessn", "rl"],
      desc: "Cache được phép mất; session và bộ đếm rate limit thì không. <code>noeviction</code> ngăn kẻ tấn công đẩy bộ đếm ra bằng cách làm đầy bộ nhớ." },
    { title: "4 · Replica & Sentinel cũng phải xác thực", tab: "conf", highlight: [13, 14, 15], on: ["sessn"],
      desc: "Replica dùng <code>masteruser</code>/<code>masterauth</code>; Sentinel có mật khẩu riêng. Thành phần phụ thường là cửa bị quên." },
    { title: "5 · Session store an toàn", tab: "sess", highlight: [2, 3, 4, 6, 9, 12, 14], on: ["sessn"],
      desc: "ID ngẫu nhiên lớn, lưu hash của ID, TTL, thu hồi được cả nhóm. Giá trị là JSON tối thiểu, không phải object tuần tự hoá." },
    { title: "6 · Cloudflare: KV vs Durable Objects", tab: "cf", highlight: [2, 4, 5, 8, 9, 10, 13], on: ["rl", "cache"],
      desc: "KV nhất quán cuối cùng — hợp cấu hình, không hợp bộ đếm hay thu hồi tức thì. Durable Object cho trạng thái nhất quán mạnh theo từng user." }
  ],

  quiz: [
    { q: "API /api/me/orders cache kết quả với key 'cache:/api/me/orders'. Hậu quả?", options: [
        "Không có vấn đề",
        "Người dùng sau có thể nhận đơn hàng của người dùng trước",
        "Chỉ chậm hơn",
        "Redis từ chối key có dấu /"
      ], correct: 1,
      explanation: "Key phải chứa danh tính (tenant/user) lấy từ session." },
    { q: "Lệnh SELECT (logical database 0–15) của Redis có phải ranh giới bảo mật không?", options: [
        "Không — client dùng được SELECT là sang DB khác; cần ACL theo prefix hoặc instance riêng",
        "Có, mỗi DB có mật khẩu riêng",
        "Có, nếu bật TLS",
        "Có, trong Redis Cluster"
      ], correct: 0,
      explanation: "Logical DB chỉ là không gian tên tiện lợi." },
    { q: "Bộ đếm đăng nhập sai nằm chung instance cache dùng allkeys-lru. Rủi ro là gì?", options: [
        "Không rủi ro",
        "Bộ đếm tăng quá nhanh",
        "Kẻ tấn công làm đầy cache khiến bộ đếm bị đẩy ra, vô hiệu giới hạn brute-force",
        "Redis bị crash"
      ], correct: 2,
      explanation: "Dữ liệu bảo mật cần instance noeviction hoặc hệ thống nhất quán mạnh." },
    { q: "Vì sao nên lưu key session là hash của session ID thay vì chính ID?", options: [
        "Để key ngắn hơn",
        "Ai đọc được Redis (dump, replica, backup) cũng không có cookie dùng lại được",
        "Vì Redis không lưu được chuỗi dài",
        "Để tìm kiếm nhanh hơn"
      ], correct: 1,
      explanation: "Tương tự lưu hash của token thay vì token." },
    { q: "Vì sao không lưu object tuần tự hoá kiểu pickle/Java serialization vào Redis?", options: [
        "Tốn bộ nhớ",
        "Chậm khi đọc",
        "Redis không hỗ trợ binary",
        "Ai ghi được vào Redis có thể khiến ứng dụng deserialize dữ liệu độc, dẫn tới chạy mã tuỳ ý"
      ], correct: 3,
      explanation: "Dùng JSON với field tối thiểu." },
    { q: "Cloudflare KV có phù hợp làm bộ đếm rate limit không?", options: [
        "Có, vì nhanh",
        "Có, nếu TTL ngắn",
        "Không — KV nhất quán cuối cùng; nên dùng Durable Objects hoặc binding Rate Limiting",
        "Có, nếu dùng nhiều namespace"
      ], correct: 2,
      explanation: "Các edge khác nhau có thể thấy giá trị cũ trong một khoảng thời gian." },
    { q: "Instance Redis chỉ dùng làm cache nên cấu hình persistence thế nào?", options: [
        "Tắt (save \"\", appendonly no) để không có bản sao dữ liệu trên đĩa",
        "Bật cả RDB và AOF",
        "Ghi RDB mỗi giây",
        "Không quan trọng"
      ], correct: 0,
      explanation: "Không có file thì không có file để lộ; cache mất được." },
    { q: "Không đặt maxmemory cho Redis có thể dẫn tới gì?", options: [
        "Redis tự giới hạn 1GB",
        "Dữ liệu được nén",
        "Không ảnh hưởng",
        "Redis dùng RAM tới khi hệ điều hành giết tiến trình — một dạng DoS"
      ], correct: 3,
      explanation: "Luôn đặt maxmemory và chọn chính sách eviction phù hợp mục đích." },
    { q: "Response API có dữ liệu riêng của người dùng nên gửi header nào?", options: [
        "Cache-Control: public, max-age=3600",
        "Cache-Control: private, no-store",
        "Không cần header",
        "ETag"
      ], correct: 1,
      explanation: "Tránh CDN/proxy dùng chung lưu lại và trả cho người khác." }
  ]
});
