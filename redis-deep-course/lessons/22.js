window.LESSONS.push({
  id: "22",
  phase: "7", phaseName: "Pattern thực chiến",
  title: "Session store và mô hình hoá dữ liệu trong Redis",
  subtitle: "Hash mỗi session · sliding TTL · đăng xuất mọi thiết bị · so với Spring Session",

  theory: `
    <p>Session là use case "vừa cache vừa không được mất tuỳ tiện": mất thì user bị đăng xuất. Redis hợp vì đọc mỗi request, TTL sẵn có, mọi pod dùng chung.
    Spring Session Redis bạn từng dùng làm đúng việc này sau lưng <code>HttpSession</code>; khi chuyển sang Rust bạn tự thiết kế — nên hiểu cấu trúc.</p>

    <p><strong>Thiết kế key</strong></p>
    <table>
      <tr><th>Key</th><th>Kiểu</th><th>Nội dung</th></tr>
      <tr><td><code>sess:{sid}</code></td><td>Hash</td><td><code>uid</code>, <code>roles</code>, <code>createdAt</code>, <code>lastSeen</code>, <code>ua</code>... TTL = thời gian không hoạt động tối đa</td></tr>
      <tr><td><code>user:{uid}:sessions</code></td><td>Set (hoặc ZSET score = lastSeen)</td><td>Các sid của user → "đăng xuất mọi thiết bị", "xem thiết bị đang đăng nhập"</td></tr>
    </table>
    <ul>
      <li><strong>Session ID</strong>: ≥ 128 bit ngẫu nhiên từ CSPRNG, base64url. Không dùng UUID v1/số tăng dần.</li>
      <li><strong>Hash thay vì JSON string</strong>: đọc/sửa từng field (<code>HGET sess:x uid</code>, <code>HSET sess:x lastSeen ...</code>) không cần tải và ghi lại cả blob; nhỏ thì là listpack, rất gọn (bài 03).</li>
      <li><strong>Sliding expiration</strong>: mỗi request gia hạn TTL. Để giảm ghi, chỉ gia hạn khi TTL còn lại &lt; một nửa. Thêm <em>hạn tuyệt đối</em> (<code>createdAt</code> + 30 ngày) kiểm tra trong app.</li>
      <li><strong>Đổi sid khi đăng nhập</strong> (chống session fixation): tạo session mới, xoá session cũ.</li>
      <li>Set <code>user:{uid}:sessions</code> không tự dọn khi session hết hạn → khi liệt kê thì lọc sid không còn tồn tại, hoặc dùng ZSET và <code>ZREMRANGEBYSCORE</code> theo lastSeen.</li>
    </ul>

    <p><strong>Session opaque trong Redis vs JWT</strong></p>
    <table>
      <tr><th></th><th>Session ID + Redis</th><th>JWT tự chứa</th></tr>
      <tr><td>Thu hồi tức thì</td><td>DEL là xong</td><td>Khó — cần denylist (lại là Redis) hoặc access token ngắn hạn</td></tr>
      <tr><td>Mỗi request</td><td>1 lượt Redis (~0,3 ms)</td><td>Chỉ verify chữ ký</td></tr>
      <tr><td>Phụ thuộc</td><td>Redis phải sẵn sàng</td><td>Không</td></tr>
    </table>
    <p>Mô hình phổ biến: access token JWT 5–15 phút + refresh token/session lưu Redis để thu hồi được.</p>

    <p><strong>Nguyên tắc mô hình hoá chung</strong> (không chỉ session): thiết kế theo <em>truy vấn</em>, không theo bảng — mỗi câu hỏi app cần trả lời phải là O(1)/O(log n) trên một key biết trước.
    Cần "tìm theo trường khác" thì tự duy trì index phụ (Set/ZSET) và cập nhật cùng lúc trong MULTI/Lua. Không có JOIN, không có query planner — đó là trách nhiệm của bạn.</p>

    <div class="callout"><p>💡 Instance chứa session: <code>maxmemory-policy</code> không được là <code>allkeys-*</code> nếu dùng chung với cache (bài 08), bật AOF <code>everysec</code>, có replica.
    Trong Cluster, dùng hash tag <code>{uid}</code> nếu cần cập nhật session và index của user trong cùng một script.</p></div>
  `,

  codeTabs: [
    { id: "login", label: "① Đăng nhập", lines: [
      "async fn login(con: &mut Conn, uid: u64, ua: &str) -> redis::RedisResult<String> {",
      "    let sid = random_base64url(32);                   // 256 bit từ CSPRNG",
      "    let skey = format!(\"sess:{sid}\");",
      "    let now = unix_now();",
      "    let _: () = redis::pipe().atomic()",
      "        .hset_multiple(&skey, &[(\"uid\", uid.to_string()), (\"ua\", ua.into()),",
      "                                 (\"createdAt\", now.to_string()), (\"lastSeen\", now.to_string())])",
      "        .expire(&skey, 1800)                          // 30 phút không hoạt động",
      "        .zadd(format!(\"user:{uid}:sessions\"), &sid, now)",
      "        .query_async(con).await?;",
      "    Ok(sid)                                           // Set-Cookie: sid=...; HttpOnly; Secure",
      "}"
    ]},
    { id: "req", label: "② Mỗi request", lines: [
      "let (uid, created): (Option<u64>, Option<u64>) =",
      "    con.hget(&skey, &[\"uid\", \"createdAt\"]).await?;   // HMGET",
      "let Some(uid) = uid else { return unauthorized() };    // hết hạn / không tồn tại",
      "if unix_now() - created.unwrap_or(0) > 30 * 86400 { return unauthorized() }  // hạn tuyệt đối",
      "",
      "let ttl: i64 = con.ttl(&skey).await?;",
      "if ttl < 900 {                                          // còn < nửa -> gia hạn",
      "    let _: () = redis::pipe().hset(&skey, \"lastSeen\", unix_now())",
      "        .expire(&skey, 1800).query_async(con).await?;",
      "}"
    ]},
    { id: "logout", label: "③ Đăng xuất mọi nơi", lines: [
      "-- KEYS[1] = user:42:sessions",
      "local sids = redis.call('ZRANGE', KEYS[1], 0, -1)",
      "for _, sid in ipairs(sids) do",
      "  redis.call('UNLINK', 'sess:' .. sid)     -- tên key ghép trong script:",
      "end                                         -- chỉ ổn khi KHÔNG chạy Cluster",
      "redis.call('DEL', KEYS[1])",
      "return #sids",
      "",
      "-- Cluster: app đọc ZRANGE rồi UNLINK từng sess:<sid> (client tự định tuyến)"
    ]},
    { id: "spring", label: "④ Spring Session làm gì", lines: [
      "// spring-session-data-redis (RedisIndexedSessionRepository) tạo:",
      "spring:session:sessions:<id>                  // Hash: creationTime, lastAccessedTime,",
      "                                              //       maxInactiveInterval, sessionAttr:*",
      "spring:session:sessions:expires:<id>          // key rỗng có TTL -> bắt sự kiện hết hạn",
      "spring:session:index:...:PRINCIPAL_NAME_INDEX_NAME:alice  // Set: index theo user",
      "",
      "// Cùng ý tưởng: Hash cho session + Set làm index phụ + TTL",
      "// Spring cần keyspace notification để phát SessionDestroyedEvent"
    ]}
  ],

  stageHtml: `
    <div class="node" id="login"><div class="nl">🔑 Đăng nhập</div><div class="ns">sid mới 256 bit (chống fixation)</div></div>
    <div class="arrow" id="a1">↓ MULTI: HSET + EXPIRE + ZADD</div>
    <div class="row">
      <div class="node" id="sess"><div class="nl">📇 sess:{sid}</div><div class="ns">Hash · TTL 30 phút</div></div>
      <div class="node" id="idx"><div class="nl">🗂️ user:42:sessions</div><div class="ns">ZSET sid → lastSeen</div></div>
    </div>
    <div class="arrow" id="a2">↓ mỗi request</div>
    <div class="node" id="req"><div class="nl">🔄 HMGET + gia hạn khi TTL &lt; nửa</div><div class="ns">+ kiểm tra hạn tuyệt đối</div></div>
    <div class="arrow" id="a3">↓ đăng xuất mọi thiết bị</div>
    <div class="node" id="out"><div class="nl">🚪 Duyệt index → UNLINK từng session</div><div class="ns">thu hồi tức thì, điều JWT không làm được</div></div>
  `,
  steps: [
    { title: "1 · Tạo session", tab: "login", highlight: [2, 3, 5, 6, 8, 9], on: ["login", "a1", "sess", "idx"],
      desc: "Session là Hash có TTL; đồng thời ghi sid vào index của user. Gói trong MULTI để không lệch." },
    { title: "2 · Đọc mỗi request", tab: "req", highlight: [1, 2, 3, 4], on: ["a2", "req"],
      desc: "HMGET vài field, không tải cả blob. Kiểm tra thêm hạn tuyệt đối." },
    { title: "3 · Sliding TTL tiết kiệm ghi", tab: "req", highlight: [6, 7, 8, 9], on: ["req", "sess"],
      desc: "Chỉ gia hạn khi đã qua nửa thời gian → số lệnh ghi giảm mạnh." },
    { title: "4 · Đăng xuất mọi nơi", tab: "logout", highlight: [2, 3, 4, 6, 9], on: ["a3", "out", "idx"],
      desc: "Index phụ cho phép tìm mọi session của user. Trong Cluster không ghép tên key trong Lua." },
    { title: "5 · Spring làm gì sau lưng", tab: "spring", highlight: [2, 4, 5, 7], on: ["sess", "idx"],
      desc: "Cùng mô hình: Hash + index + TTL. Giờ bạn tự làm được nó trong Rust." }
  ],

  quiz: [
    { q: "Vì sao lưu session dạng Hash thay vì một chuỗi JSON?", options: [
        "Hash bảo mật hơn", "Đọc/sửa từng field mà không phải tải và ghi lại cả blob; hash nhỏ lưu listpack rất gọn", "JSON không lưu được", "Hash có TTL từng field bắt buộc"
      ], correct: 1, explanation: "HGET/HSET từng field." },
    { q: "Chống session fixation bằng cách nào?", options: [
        "TTL ngắn", "Cấp session ID mới khi đăng nhập và xoá session cũ", "Mã hoá session", "Dùng Cluster"
      ], correct: 1, explanation: "Kẻ tấn công không thể cài sẵn sid cho nạn nhân." },
    { q: "Sliding expiration mà gia hạn mọi request có nhược điểm gì?", options: [
        "Không nhược điểm", "Mỗi request thêm một lệnh ghi; tối ưu bằng chỉ gia hạn khi TTL còn < nửa", "Session không bao giờ hết hạn", "Mất dữ liệu"
      ], correct: 1, explanation: "Đồng thời cần hạn tuyệt đối để session không sống mãi." },
    { q: "Lợi thế lớn nhất của session opaque trong Redis so với JWT tự chứa?", options: [
        "Nhanh hơn", "Thu hồi tức thì bằng DEL", "Không cần mạng", "Nhỏ hơn"
      ], correct: 1, explanation: "JWT cần denylist hoặc hạn rất ngắn." },
    { q: "Muốn 'đăng xuất mọi thiết bị' cần thêm cấu trúc gì?", options: [
        "Không cần gì", "Index phụ user → danh sách sid (Set/ZSET)", "KEYS sess:*", "Pub/Sub"
      ], correct: 1, explanation: "Không bao giờ quét KEYS để tìm." },
    { q: "Index user:42:sessions có tự dọn khi session hết hạn không?", options: [
        "Có", "Không — phải lọc khi đọc hoặc dọn theo lastSeen (ZREMRANGEBYSCORE)", "Có nếu dùng ZSET", "Có trong Cluster"
      ], correct: 1, explanation: "TTL của sess:x không ảnh hưởng tới key khác." },
    { q: "Nguyên tắc mô hình hoá dữ liệu trong Redis?", options: [
        "Thiết kế như bảng SQL chuẩn hoá", "Thiết kế theo truy vấn: mỗi câu hỏi là thao tác rẻ trên key biết trước; tự duy trì index phụ", "Mọi thứ vào một hash lớn", "Dùng KEYS thay index"
      ], correct: 1, explanation: "Không có JOIN hay query planner." },
    { q: "Instance lưu session dùng chung với cache. Policy nào nguy hiểm?", options: [
        "noeviction", "allkeys-lru (có thể evict session đang dùng)", "volatile-ttl", "Không policy nào nguy hiểm"
      ], correct: 1, explanation: "Tốt nhất tách instance." },
    { q: "Vì sao script ghép 'sess:' .. sid trong Lua không an toàn trong Cluster?", options: [
        "Lua không nối chuỗi được", "Key không khai báo qua KEYS có thể thuộc slot/node khác", "Chậm", "UNLINK không có trong Lua"
      ], correct: 1, explanation: "Mọi key phải khai báo và cùng slot." }
  ]
});
