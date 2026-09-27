window.LESSONS.push({
  id: "18",
  phase: "7", phaseName: "Pattern thực chiến",
  title: "Khi cache làm sập DB: stampede, avalanche, penetration",
  subtitle: "Single-flight lock · jitter TTL · probabilistic early refresh · cache giá trị rỗng · Bloom filter",

  theory: `
    <p>Cache làm DB "quen" với tải thấp. Khi cache hụt hàng loạt, DB nhận đột ngột gấp 10–100 lần tải và sập — rồi cache không thể nạp lại vì DB đã sập. Ba kiểu sự cố:</p>

    <table>
      <tr><th>Sự cố</th><th>Nguyên nhân</th><th>Cách chống</th></tr>
      <tr><td><strong>Stampede</strong> (thundering herd, dog-piling)</td><td>Một key <em>nóng</em> hết hạn; 5 000 request cùng miss và cùng chạy truy vấn nặng</td><td>Single-flight (chỉ một người nạp), làm mới sớm, stale-while-revalidate</td></tr>
      <tr><td><strong>Avalanche</strong></td><td>Hàng loạt key hết hạn cùng lúc (cùng TTL lúc warm cache), hoặc Redis chết</td><td><strong>Jitter</strong> TTL, HA cho Redis, circuit breaker/giới hạn tải vào DB</td></tr>
      <tr><td><strong>Penetration</strong></td><td>Truy vấn id <em>không tồn tại</em> (bot, bug) — luôn miss, luôn xuống DB</td><td>Cache giá trị rỗng TTL ngắn, Bloom filter, validate input</td></tr>
    </table>

    <p><strong>1. Single-flight bằng lock</strong>: khi miss, thử <code>SET lock:key token NX PX 5000</code>. Ai giành được thì đọc DB và nạp cache; người khác chờ vài chục ms rồi đọc lại cache
    (hoặc trả bản cũ nếu có). Trong một process, gom thêm bằng single-flight cục bộ (một future dùng chung) để 200 thread không cùng gọi Redis.</p>

    <p><strong>2. Stale-while-revalidate</strong>: lưu value kèm <em>hạn mềm</em> (soft TTL) bên trong, TTL thật của key dài hơn. Quá hạn mềm → vẫn trả bản cũ ngay,
    đồng thời một người (có lock) làm mới nền. Người dùng không bao giờ chờ DB.</p>

    <p><strong>3. Probabilistic early expiration (XFetch)</strong>: mỗi lần đọc, tung xác suất làm mới <em>trước</em> khi hết hạn; xác suất tăng khi gần hạn và khi thời gian tính lại (delta) lớn.
    Công thức: làm mới nếu <code>now - delta * beta * ln(rand()) &gt;= expiry</code> (ln của số trong (0,1) là số âm nên vế trái lớn hơn now). Không cần lock, tự nhiên chỉ vài request làm mới.</p>

    <p><strong>4. Jitter</strong>: TTL = cơ sở + ngẫu nhiên (vd 600 s ± 10%). Warm 1 triệu key lúc deploy sẽ không cùng chết một giây.</p>

    <p><strong>5. Penetration</strong>: lưu cả kết quả "không có" (<code>SET product:999999 "__NULL__" EX 60</code>) — TTL ngắn để khi id được tạo thì sớm thấy. Tấn công bằng id ngẫu nhiên
    thì cache rỗng làm phình RAM → dùng <strong>Bloom filter</strong> (Redis 8 có sẵn <code>BF.ADD</code>/<code>BF.EXISTS</code>): nói "chắc chắn không có" thì từ chối luôn; nói "có thể có" mới xuống cache/DB.</p>

    <div class="callout"><p>💡 Redis chết cũng là một dạng avalanche. Code phải coi Redis là <em>tối ưu hoá</em>: timeout ngắn (vài chục ms), lỗi Redis thì fallback DB có giới hạn đồng thời
    (semaphore/bulkhead), không để 100% traffic ập vào DB. Giống Resilience4j bạn đã quen bên Spring.</p></div>
  `,

  codeTabs: [
    { id: "sf", label: "① Single-flight lock", lines: [
      "async fn get_hot(key: &str, con: &mut Conn, db: &Db) -> anyhow::Result<String> {",
      "    for _ in 0..50 {",
      "        if let Some(v) = con.get::<_, Option<String>>(key).await? { return Ok(v); }",
      "        let lock = format!(\"lock:{key}\");",
      "        let token = uuid::Uuid::new_v4().to_string();",
      "        let got: Option<String> = redis::cmd(\"SET\").arg(&lock).arg(&token)",
      "            .arg(\"NX\").arg(\"PX\").arg(5000).query_async(con).await?;",
      "        if got.is_some() {                            // mình là người nạp",
      "            let v = db.expensive_query().await?;",
      "            let _: () = con.set_ex(key, &v, 600 + jitter(60)).await?;",
      "            release_lock(con, &lock, &token).await?;  // Lua so token (bài 19)",
      "            return Ok(v);",
      "        }",
      "        tokio::time::sleep(Duration::from_millis(20)).await;   // người khác đang nạp",
      "    }",
      "    db.expensive_query().await                         // hết kiên nhẫn: fallback"
    ]},
    { id: "swr", label: "② Stale-while-revalidate", lines: [
      "// value = {\"data\": ..., \"soft_exp\": 1727400600}   key TTL thật = soft + 1 giờ",
      "let entry: Entry = read_cache(key).await?;",
      "if now() < entry.soft_exp {",
      "    return Ok(entry.data);                      // tươi",
      "}",
      "if try_lock(&format!(\"refresh:{key}\"), 10_000).await? {",
      "    tokio::spawn(refresh_in_background(key));   // một người làm mới",
      "}",
      "Ok(entry.data)                                  // mọi người vẫn nhận bản cũ ngay"
    ]},
    { id: "xf", label: "③ XFetch", lines: [
      "// delta = thời gian tính lại lần trước (giây), beta = 1.0 mặc định",
      "fn should_refresh(now: f64, expiry: f64, delta: f64, beta: f64) -> bool {",
      "    let r: f64 = rand::random::<f64>().max(f64::MIN_POSITIVE);  // (0,1]",
      "    now - delta * beta * r.ln() >= expiry        // ln(r) <= 0",
      "}",
      "// Truy vấn tốn 2s, còn 1s nữa hết hạn -> xác suất làm mới sớm đã khá cao",
      "// Truy vấn tốn 10ms, còn 1s -> gần như không làm mới sớm"
    ]},
    { id: "pen", label: "④ Penetration & jitter", lines: [
      "GET product:999999                     # miss",
      "# DB: không có -> cache giá trị rỗng, TTL ngắn",
      "SET product:999999 \"__NULL__\" EX 60",
      "",
      "# Bloom filter (Redis 8 / RedisBloom)",
      "BF.RESERVE product_ids 0.001 10000000  # sai dương 0.1%, 10 triệu phần tử",
      "BF.ADD product_ids 9812",
      "BF.EXISTS product_ids 999999           # 0 = chắc chắn không có -> trả 404 ngay",
      "",
      "# Jitter: TTL = 600 + rand(0..60)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="exp"><div class="nl">⌛ Key nóng hết hạn</div><div class="ns">5 000 request/s</div></div>
    <div class="arrow" id="a1">↓ không phòng bị</div>
    <div class="node" id="herd"><div class="nl">🐃🐃🐃 5 000 truy vấn DB</div><div class="ns">DB quá tải → sập dây chuyền</div></div>
    <div class="arrow" id="a2">↓ có phòng bị</div>
    <div class="row">
      <div class="node" id="lock"><div class="nl">🔒 Single-flight</div><div class="ns">1 người nạp, còn lại chờ</div></div>
      <div class="node" id="stale"><div class="nl">🥖 Stale-while-revalidate</div><div class="ns">trả bản cũ, làm mới nền</div></div>
      <div class="node" id="jit"><div class="nl">🎲 Jitter / XFetch</div><div class="ns">không cùng chết</div></div>
    </div>
    <div class="arrow" id="a3">↓ id không tồn tại</div>
    <div class="node" id="bf"><div class="nl">🌸 NULL cache + Bloom filter</div><div class="ns">chặn penetration</div></div>
  `,
  steps: [
    { title: "1 · Stampede", tab: "sf", highlight: [3], on: ["exp", "a1", "herd"],
      desc: "Không có cơ chế gì: mọi request cùng miss và cùng chạy truy vấn nặng." },
    { title: "2 · Chỉ một người nạp", tab: "sf", highlight: [6, 7, 8, 9, 10, 11], on: ["a2", "lock"],
      desc: "SET NX PX giành quyền nạp. Người thua chờ 20ms rồi đọc lại cache." },
    { title: "3 · Không bắt ai chờ", tab: "swr", highlight: [1, 3, 6, 7, 9], on: ["stale"],
      desc: "Hạn mềm bên trong value; quá hạn thì vẫn trả bản cũ và làm mới nền." },
    { title: "4 · Làm mới sớm theo xác suất", tab: "xf", highlight: [2, 3, 4, 6, 7], on: ["jit"],
      desc: "Truy vấn càng đắt và càng gần hạn thì càng dễ được làm mới sớm — không cần lock." },
    { title: "5 · Chống avalanche", tab: "pen", highlight: [10], on: ["jit"],
      desc: "Jitter trải đều thời điểm hết hạn của hàng triệu key." },
    { title: "6 · Chống penetration", tab: "pen", highlight: [3, 6, 7, 8], on: ["a3", "bf"],
      desc: "Cache 'không có' với TTL ngắn; Bloom filter trả lời 'chắc chắn không có' mà không chạm DB." }
  ],

  quiz: [
    { q: "Cache stampede là gì?", options: [
        "Redis hết RAM", "Một key nóng hết hạn, rất nhiều request cùng miss và cùng dội vào DB", "Replica lag", "Key bị evict"
      ], correct: 1, explanation: "Còn gọi thundering herd / dog-piling." },
    { q: "Cách chống avalanche do warm 1 triệu key với cùng TTL?", options: [
        "Tăng maxmemory", "Thêm jitter ngẫu nhiên vào TTL", "Dùng KEYS", "Tắt TTL"
      ], correct: 1, explanation: "Trải đều thời điểm hết hạn." },
    { q: "Cache penetration nghĩa là?", options: [
        "Truy vấn id không tồn tại luôn miss và luôn xuống DB", "Hacker đọc được cache", "Cache chứa dữ liệu sai", "Key quá lớn"
      ], correct: 0, explanation: "Chống bằng cache giá trị rỗng, Bloom filter, validate input." },
    { q: "Vì sao giá trị rỗng (NULL) nên có TTL ngắn?", options: [
        "Tiết kiệm RAM là lý do duy nhất", "Để khi bản ghi được tạo thật, hệ thống sớm thấy nó thay vì trả 'không có' lâu dài", "Bắt buộc", "Để Bloom filter hoạt động"
      ], correct: 1, explanation: "Đồng thời giới hạn RAM nếu bị tấn công bằng id ngẫu nhiên." },
    { q: "Bloom filter trả lời BF.EXISTS = 0 có nghĩa là?", options: [
        "Có thể có", "Chắc chắn không có", "Chắc chắn có", "Không xác định"
      ], correct: 1, explanation: "Bloom filter có thể sai dương, không sai âm." },
    { q: "Ưu điểm của stale-while-revalidate?", options: [
        "Luôn trả dữ liệu mới nhất", "Không request nào phải chờ DB; một tiến trình làm mới nền", "Không cần TTL", "Không cần lock"
      ], correct: 1, explanation: "Đánh đổi: có thể trả dữ liệu hơi cũ." },
    { q: "Trong XFetch, yếu tố nào làm tăng xác suất làm mới sớm?", options: [
        "Key ngắn", "Càng gần thời điểm hết hạn và thời gian tính lại (delta) càng lớn", "RAM còn nhiều", "Số replica"
      ], correct: 1, explanation: "Truy vấn đắt được làm mới sớm hơn." },
    { q: "Trong single-flight, người không giành được lock nên làm gì?", options: [
        "Cũng gọi DB luôn", "Chờ ngắn rồi đọc lại cache (hoặc trả bản cũ), có giới hạn số lần", "Xoá lock", "Trả lỗi 500 ngay"
      ], correct: 1, explanation: "Có giới hạn để không chờ mãi khi người nạp chết." },
    { q: "Redis chết hoàn toàn. Thiết kế tốt nên?", options: [
        "Mọi request chuyển thẳng xuống DB không giới hạn", "Timeout ngắn, fallback DB có giới hạn đồng thời (bulkhead/circuit breaker)", "Trả lỗi cho mọi request mãi mãi", "Chờ Redis lên lại"
      ], correct: 1, explanation: "Redis là tối ưu hoá; không để nó kéo DB sập theo." }
  ]
});
