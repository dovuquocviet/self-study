window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Bộ nhớ & vòng đời key",
  title: "TTL & expire: key hết hạn bị xoá lúc nào?",
  subtitle: "dict expires · lazy expire · active expire cycle · TTL trên replica · lệnh nào xoá TTL",

  theory: `
    <p>TTL không nằm trong giá trị mà trong một dict riêng: <code>expires</code> ánh xạ key → <strong>thời điểm hết hạn tuyệt đối</strong> (Unix ms).
    <code>EXPIRE k 60</code> thực chất lưu <em>now + 60000</em>; khi ghi AOF hay gửi sang replica, Redis đổi thành <code>PEXPIREAT</code> để không bị lệch theo thời gian truyền.</p>

    <p><strong>Hết hạn ≠ bị xoá ngay.</strong> Redis không đặt timer cho từng key (hàng triệu timer quá đắt). Nó kết hợp hai cách:</p>
    <ol>
      <li><strong>Lazy (passive) expire</strong>: mỗi khi lệnh chạm tới key, <code>expireIfNeeded()</code> kiểm tra; quá hạn thì xoá rồi trả như key không tồn tại.
        Đảm bảo client <em>không bao giờ đọc được</em> key đã hết hạn.</li>
      <li><strong>Active expire</strong>: key hết hạn mà không ai đọc sẽ nằm mãi trong RAM nếu chỉ có lazy. Nên serverCron (hz lần/giây) chạy <code>activeExpireCycle</code>:
        lấy mẫu một số key có TTL (mặc định 20 mỗi vòng), xoá cái đã hết hạn; nếu tỉ lệ hết hạn trong mẫu còn cao (&gt; ~10% ở bản mới, 25% ở bản cũ) thì lặp tiếp,
        nhưng bị giới hạn thời gian CPU (~25%) để không chặn server. Có thêm "fast cycle" ngắn trong <code>beforeSleep</code>.</li>
    </ol>
    <p>Hệ quả: tại một thời điểm có thể còn một phần nhỏ key đã hết hạn chiếm RAM. <code>active-expire-effort</code> (1–10) cho phép Redis cố hơn, đổi lại tốn CPU.</p>

    <p><strong>Lệnh nào giữ / xoá TTL?</strong></p>
    <table>
      <tr><th>Hành động</th><th>TTL</th></tr>
      <tr><td><code>SET k v</code> (ghi đè toàn bộ), <code>GETSET</code>, <code>PERSIST</code></td><td><strong>Bị xoá</strong> (trừ khi <code>SET ... KEEPTTL</code>)</td></tr>
      <tr><td><code>INCR</code>, <code>APPEND</code>, <code>HSET</code>, <code>LPUSH</code>, <code>SADD</code>... (sửa nội dung)</td><td>Giữ nguyên</td></tr>
      <tr><td><code>RENAME a b</code></td><td>TTL đi theo sang b</td></tr>
      <tr><td><code>EXPIRE</code> với số âm / thời điểm quá khứ</td><td>Key bị xoá ngay</td></tr>
    </table>
    <p>Redis 7.0 thêm cờ <code>EXPIRE k 60 NX|XX|GT|LT</code>: chỉ đặt khi chưa có TTL / đã có / TTL mới lớn hơn / nhỏ hơn. <code>TTL</code> trả <code>-1</code> nếu key không có hạn, <code>-2</code> nếu không tồn tại.</p>

    <p><strong>Trên replica</strong>: replica <em>không tự xoá</em> key hết hạn; nó chờ master gửi <code>DEL</code> (để dữ liệu nhất quán). Nhưng từ 3.2, đọc trên replica
    vẫn trả nil cho key đã quá hạn theo đồng hồ logic. Đồng hồ các máy lệch nhau hoặc bị chỉnh lùi có thể làm TTL sai — dùng NTP.</p>

    <div class="callout"><p>💡 Hàng triệu key được SET cùng lúc với cùng TTL (vd warm cache lúc deploy) sẽ hết hạn cùng lúc: active expire phải xoá dồn dập
    <em>và</em> backend nhận bão cache miss. Thêm <strong>jitter</strong> ngẫu nhiên vào TTL (bài 18).</p></div>
  `,

  codeTabs: [
    { id: "cmd", label: "① Lệnh TTL", lines: [
      "SET session:abc '{...}' EX 1800        # tạo kèm TTL (nguyên tử)",
      "TTL session:abc                        # 1800",
      "EXPIRE session:abc 1800 GT             # 7.0+: chỉ gia hạn nếu dài hơn",
      "HSET session:abc lastSeen 1727400000   # (nếu là hash) sửa nội dung: TTL giữ nguyên",
      "SET session:abc '{new}'                # GHI ĐÈ: TTL MẤT -> -1",
      "SET session:abc '{new}' KEEPTTL        # giữ TTL cũ",
      "PERSIST session:abc                    # bỏ TTL",
      "TTL nokey                              # -2"
    ]},
    { id: "algo", label: "② Active expire (giả mã)", lines: [
      "activeExpireCycle(type):            // gọi từ serverCron và beforeSleep",
      "  for db in databases:",
      "    do {",
      "      sampled = 0; expired = 0",
      "      repeat 20 times:                 // ACTIVE_EXPIRE_CYCLE_KEYS_PER_LOOP",
      "        key = next key in db.expires",
      "        if key.when < now: delete(key); expired++",
      "        sampled++",
      "      if elapsed > time_limit: return  // ~25% CPU mỗi giây",
      "    } while (expired > sampled * acceptable_stale)   // còn nhiều key chết -> quét tiếp"
    ]},
    { id: "lazy", label: "③ Lazy expire", lines: [
      "lookupKey(db, key):",
      "    if expireIfNeeded(db, key):     // when < now ?",
      "        // master: xoá key, lan truyền DEL tới replica + AOF",
      "        // replica: không xoá, chỉ báo 'không tồn tại'",
      "        return NULL",
      "    return dict_find(db.dict, key)",
      "",
      "INFO stats | grep expired",
      "expired_keys:18233412",
      "expired_stale_perc:3.12          # ước lượng % key đã chết còn nằm trong RAM"
    ]},
    { id: "rs", label: "④ Rust", lines: [
      "use redis::AsyncCommands;",
      "",
      "// SET ... EX: nguyên tử, không có khoảng hở giữa SET và EXPIRE",
      "let _: () = con.set_ex(\"session:abc\", payload, 1800).await?;",
      "",
      "// SAI: 2 lệnh riêng -> app crash giữa chừng = key sống mãi",
      "// con.set(\"k\", v).await?;  con.expire(\"k\", 1800).await?;",
      "",
      "let ttl: i64 = con.ttl(\"session:abc\").await?;   // -1 / -2 / số giây"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="d"><div class="nl">🗂️ dict</div><div class="ns">key → value</div></div>
      <div class="node" id="e"><div class="nl">⏳ expires</div><div class="ns">key → thời điểm hết hạn (ms)</div></div>
    </div>
    <div class="arrow" id="a1">↓ hai cơ chế dọn</div>
    <div class="row">
      <div class="node" id="lz"><div class="nl">🐢 Lazy</div><div class="ns">khi có lệnh chạm key</div></div>
      <div class="node" id="ac"><div class="nl">🧹 Active</div><div class="ns">serverCron lấy mẫu 20 key/vòng</div></div>
    </div>
    <div class="arrow" id="a2">↓ lan truyền</div>
    <div class="node" id="rep"><div class="nl">📡 DEL → replica + AOF</div><div class="ns">replica không tự xoá</div></div>
  `,
  steps: [
    { title: "1 · TTL là thời điểm tuyệt đối", tab: "cmd", highlight: [1, 2], on: ["d", "e"],
      desc: "SET ... EX 1800 ghi value vào dict và now+1800s vào expires trong một lệnh nguyên tử." },
    { title: "2 · Ghi đè làm mất TTL", tab: "cmd", highlight: [4, 5, 6], on: ["e"],
      desc: "HSET/INCR giữ TTL, nhưng SET ghi đè thì xoá — lỗi kinh điển làm key sống mãi. Dùng KEEPTTL hoặc SET lại kèm EX." },
    { title: "3 · Lazy: đọc thấy chết thì xoá", tab: "lazy", highlight: [1, 2, 3, 5], on: ["a1", "lz"],
      desc: "Client không bao giờ nhận được key quá hạn. Nhưng key không ai đọc vẫn chiếm RAM." },
    { title: "4 · Active: lấy mẫu có giới hạn", tab: "algo", highlight: [5, 7, 9, 10], on: ["ac"],
      desc: "Xoá dần theo mẫu ngẫu nhiên, lặp khi còn nhiều key chết, dừng khi hết ngân sách CPU." },
    { title: "5 · Replica chờ lệnh DEL", tab: "lazy", highlight: [3, 4, 9, 10], on: ["a2", "rep"],
      desc: "Master là nơi duy nhất quyết định xoá → dữ liệu master/replica/AOF nhất quán." },
    { title: "6 · Trong code", tab: "rs", highlight: [4, 6, 7], on: ["e"],
      desc: "Luôn đặt TTL cùng lệnh ghi (SET EX / pipeline MULTI). Hai lệnh rời rạc có khe hở." }
  ],

  quiz: [
    { q: "Key đã quá hạn nhưng chưa bị active expire dọn. Client GET key đó nhận gì?", options: [
        "Giá trị cũ", "nil — lazy expire kiểm tra và xoá khi truy cập", "Lỗi EXPIRED", "Giá trị cũ kèm cảnh báo"
      ], correct: 1, explanation: "expireIfNeeded chạy trước mọi truy cập." },
    { q: "Vì sao Redis không đặt timer riêng cho từng key có TTL?", options: [
        "Vì Linux không hỗ trợ", "Hàng triệu timer quá tốn bộ nhớ/CPU; lấy mẫu định kỳ + lazy rẻ hơn nhiều", "Vì TTL chỉ có độ phân giải giây", "Vì dùng fork"
      ], correct: 1, explanation: "Thiết kế xác suất: rẻ và đủ tốt." },
    { q: "Key có TTL 600s. Chạy SET key newvalue (không tuỳ chọn). TTL sau đó?", options: [
        "Vẫn còn ~600s", "-1 (không hết hạn)", "-2", "Reset về 600"
      ], correct: 1, explanation: "SET ghi đè xoá TTL; dùng KEEPTTL nếu muốn giữ." },
    { q: "Key có TTL. Chạy INCR key. TTL?", options: [
        "Mất", "Giữ nguyên", "Tăng thêm 1 giây", "Key bị xoá"
      ], correct: 1, explanation: "Lệnh sửa nội dung không động tới TTL." },
    { q: "Replica gặp key đã hết hạn thì sao?", options: [
        "Tự xoá ngay", "Không tự xoá; trả như không tồn tại khi đọc; chờ master gửi DEL", "Hỏi master", "Trả giá trị cũ"
      ], correct: 1, explanation: "Master là nguồn quyết định xoá để giữ nhất quán." },
    { q: "Khi ghi vào AOF/replication, EXPIRE key 60 được chuyển thành gì?", options: [
        "Giữ nguyên EXPIRE 60", "PEXPIREAT với thời điểm tuyệt đối", "DEL sau 60 giây", "SET ... EX 60"
      ], correct: 1, explanation: "Thời điểm tuyệt đối không phụ thuộc lúc replay." },
    { q: "TTL key trả -2 nghĩa là gì?", options: [
        "Key không có TTL", "Key không tồn tại", "Key sắp hết hạn trong 2 giây", "Lỗi"
      ], correct: 1, explanation: "-1: tồn tại, không hạn; -2: không tồn tại." },
    { q: "EXPIRE k 3600 GT làm gì (7.0+)?", options: [
        "Luôn đặt TTL 3600", "Chỉ đặt nếu TTL mới lớn hơn TTL hiện tại", "Chỉ đặt nếu key chưa có TTL", "Đặt TTL cho mọi key lớn hơn k"
      ], correct: 1, explanation: "NX: chưa có TTL; XX: đã có; GT/LT: so sánh với TTL hiện tại. Key không có TTL được coi là vô hạn nên GT không đặt được." },
    { q: "Vì sao nên dùng SET k v EX 60 thay vì SET rồi EXPIRE?", options: [
        "Nhanh hơn 2 lần", "Nguyên tử — không có trường hợp app chết giữa hai lệnh để lại key không hạn", "EXPIRE bị deprecated", "Không có khác biệt"
      ], correct: 1, explanation: "Một lệnh là một đơn vị nguyên tử." },
    { q: "Metric nào ước lượng tỉ lệ key đã hết hạn nhưng vẫn nằm trong RAM?", options: [
        "expired_keys", "expired_stale_perc", "evicted_keys", "keyspace_misses"
      ], correct: 1, explanation: "INFO stats có expired_stale_perc." }
  ]
});
