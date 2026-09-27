window.LESSONS.push({
  id: "19",
  phase: "7", phaseName: "Pattern thực chiến",
  title: "Distributed lock: SET NX PX, Redlock và fencing token",
  subtitle: "Khoá đúng cách trên 1 node · vì sao nhả khoá phải dùng Lua · tranh luận Kleppmann – antirez",

  theory: `
    <p>Nhiều instance của service (pod K8s, Worker) cùng muốn làm một việc chỉ được làm một lần: chạy cron, xử lý đơn, gọi API thanh toán.
    Trong một JVM bạn dùng <code>synchronized</code>/<code>ReentrantLock</code>; giữa nhiều process thì cần khoá ở ngoài — Redis là lựa chọn phổ biến.</p>

    <p><strong>Khoá trên một node, làm đúng</strong></p>
    <ol>
      <li><strong>Lấy</strong>: <code>SET lock:order:881 &lt;token-ngẫu-nhiên&gt; NX PX 30000</code> — một lệnh nguyên tử: chỉ đặt nếu chưa có, kèm hạn.
        (Cách cũ <code>SETNX</code> rồi <code>EXPIRE</code> là hai lệnh: chết giữa chừng = khoá vĩnh viễn.)</li>
      <li><strong>Token</strong> duy nhất cho mỗi lần lấy (UUID) để biết khoá này <em>của ai</em>.</li>
      <li><strong>Nhả</strong>: chỉ xoá nếu value vẫn là token của mình — phải là <strong>Lua</strong> (GET + so sánh + DEL nguyên tử). <code>DEL</code> trần có thể xoá khoá của người khác
        khi khoá mình đã hết hạn và người khác vừa lấy.</li>
      <li><strong>Gia hạn</strong> (watchdog) nếu việc có thể lâu hơn TTL: Lua "nếu còn là token của tôi thì PEXPIRE". Redisson bên Java làm đúng việc này.</li>
    </ol>

    <p><strong>Redlock</strong> — thuật toán antirez đề xuất để không phụ thuộc một node (replication async có thể mất khoá khi failover):
    dùng N = 5 master <em>độc lập</em> (không replication). Lấy thời gian bắt đầu; SET NX PX lần lượt trên từng node với timeout nhỏ; thành công nếu giành được
    ≥ 3 node <em>và</em> tổng thời gian đã tốn &lt; TTL. Thời gian hiệu lực còn lại = TTL − thời gian đã tốn − sai lệch đồng hồ. Thất bại thì nhả trên mọi node.</p>

    <p><strong>Tranh luận (2016)</strong>: Martin Kleppmann ("How to do distributed locking") chỉ ra:</p>
    <ul>
      <li>Client lấy khoá rồi bị <strong>dừng</strong> (GC pause, swap, VM bị treo, mạng chậm) lâu hơn TTL → khoá hết hạn, client B lấy khoá → A tỉnh dậy vẫn tưởng mình giữ khoá và ghi → hỏng dữ liệu. <em>Không</em> thuật toán khoá có hạn nào tự tránh được điều này.</li>
      <li>Cách đúng là <strong>fencing token</strong>: mỗi lần cấp khoá kèm một số tăng dần; tài nguyên được bảo vệ (DB, storage) từ chối ghi có token nhỏ hơn token lớn nhất đã thấy.</li>
      <li>Redlock không sinh fencing token và dựa vào giả định về thời gian (đồng hồ, độ trễ) → không nên dùng cho <em>đúng đắn</em>.</li>
    </ul>
    <p>antirez phản hồi ("Is Redlock safe?") rằng giả định thời gian là chấp nhận được trong thực tế và bước kiểm tra thời gian sau khi lấy khoá giảm rủi ro. Kết luận thực dụng:</p>

    <table>
      <tr><th>Mục đích khoá</th><th>Lựa chọn</th></tr>
      <tr><td><strong>Hiệu quả</strong>: tránh làm trùng việc (gửi 2 email, tính lại báo cáo) — thỉnh thoảng trùng thì chịu được</td><td>Một node Redis, SET NX PX + Lua release. Đơn giản, đủ.</td></tr>
      <tr><td><strong>Đúng đắn</strong>: trùng là hỏng dữ liệu (trừ tiền 2 lần)</td><td>Fencing token kiểm tra ở tầng lưu trữ, hoặc ràng buộc DB (unique, optimistic version), hoặc hệ đồng thuận (etcd, ZooKeeper)</td></tr>
    </table>

    <div class="callout"><p>💡 Nhiều khi không cần khoá: <code>INSERT ... ON CONFLICT DO NOTHING</code> với khoá idempotency, <code>UPDATE ... WHERE version = ?</code>, hoặc giao cho một consumer duy nhất
    của partition Kafka. Khoá phân tán là công cụ cuối cùng, không phải đầu tiên.</p></div>
  `,

  codeTabs: [
    { id: "acq", label: "① Lấy / nhả (Rust)", lines: [
      "static RELEASE: LazyLock<redis::Script> = LazyLock::new(|| redis::Script::new(r#\"",
      "    if redis.call('GET', KEYS[1]) == ARGV[1] then",
      "        return redis.call('DEL', KEYS[1])",
      "    end",
      "    return 0",
      "\"#));",
      "",
      "async fn with_lock(con: &mut Conn, name: &str) -> anyhow::Result<bool> {",
      "    let key = format!(\"lock:{name}\");",
      "    let token = uuid::Uuid::new_v4().to_string();",
      "    let ok: Option<String> = redis::cmd(\"SET\").arg(&key).arg(&token)",
      "        .arg(\"NX\").arg(\"PX\").arg(30_000).query_async(con).await?;",
      "    if ok.is_none() { return Ok(false); }          // người khác đang giữ",
      "    let result = do_work().await;                  // phải xong trong < 30s",
      "    let _: i64 = RELEASE.key(&key).arg(&token).invoke_async(con).await?;",
      "    result.map(|_| true)",
      "}"
    ]},
    { id: "bad", label: "② Nhả sai", lines: [
      "t0   A: SET lock tokA NX PX 30000     -> OK",
      "t1   A: GC pause / mạng chậm 35 giây",
      "t30  lock hết hạn",
      "t31  B: SET lock tokB NX PX 30000     -> OK",
      "t35  A: tỉnh dậy, xong việc, DEL lock  -> XOÁ KHOÁ CỦA B!",
      "t36  C: SET lock tokC NX PX 30000     -> OK   (B và C cùng chạy)",
      "",
      "Lua so token ở t35 -> A không xoá được khoá của B",
      "Nhưng A vẫn đã làm việc song song với B trong [t31, t35] -> cần fencing"
    ]},
    { id: "fence", label: "③ Fencing token", lines: [
      "-- Lấy khoá + cấp số hiệu tăng dần trong 1 script",
      "if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then",
      "  return redis.call('INCR', KEYS[2])     -- KEYS[2] = fence:order:881",
      "end",
      "return -1",
      "",
      "-- Tầng lưu trữ từ chối token cũ (Postgres):",
      "-- UPDATE orders SET status = 'SHIPPED', fence = 34",
      "--  WHERE id = 881 AND fence < 34;        -- A mang token 33 tới muộn -> 0 row"
    ]},
    { id: "redlock", label: "④ Redlock (giả mã)", lines: [
      "start = now()",
      "acquired = 0",
      "for node in [r1, r2, r3, r4, r5]:              # 5 master độc lập",
      "    if node.set(key, token, NX, PX=ttl, timeout=5ms): acquired += 1",
      "elapsed = now() - start",
      "validity = ttl - elapsed - clock_drift",
      "if acquired >= 3 and validity > 0:",
      "    return Lock(validity)",
      "else:",
      "    for node in all: release(node, key, token)  # nhả cả chỗ đã lấy được",
      "    return None"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="a"><div class="nl">🅰️ Worker A</div><div class="ns">token 33</div></div>
      <div class="node" id="b"><div class="nl">🅱️ Worker B</div><div class="ns">token 34</div></div>
    </div>
    <div class="arrow" id="a1">↓ SET lock NX PX 30000</div>
    <div class="node" id="r"><div class="nl">🟥 Redis</div><div class="ns">lock:order:881 = tokA → hết hạn → tokB</div></div>
    <div class="arrow" id="a2">↓ A bị GC pause 35s</div>
    <div class="node" id="both"><div class="nl">⚠️ A và B cùng tin mình giữ khoá</div><div class="ns">khoá có hạn không tự tránh được</div></div>
    <div class="arrow" id="a3">↓ ghi kèm fencing token</div>
    <div class="node" id="db"><div class="nl">🐘 Postgres</div><div class="ns">WHERE fence &lt; token → từ chối 33</div></div>
  `,
  steps: [
    { title: "1 · Lấy khoá nguyên tử", tab: "acq", highlight: [10, 11, 12, 13], on: ["a", "a1", "r"],
      desc: "SET NX PX một lệnh. Token ngẫu nhiên đánh dấu chủ sở hữu." },
    { title: "2 · Nhả bằng Lua so token", tab: "acq", highlight: [1, 2, 3, 15], on: ["r"],
      desc: "GET + so sánh + DEL nguyên tử. Không bao giờ DEL trần." },
    { title: "3 · Khi DEL trần gây hoạ", tab: "bad", highlight: [2, 3, 4, 5, 6], on: ["a2", "b"],
      desc: "A tỉnh dậy xoá khoá của B → C vào được. Lua release chặn được bước t35." },
    { title: "4 · Nhưng vẫn chồng lấn", tab: "bad", highlight: [8, 9], on: ["both"],
      desc: "Trong [t31, t35] A và B đều đang làm. Không khoá có TTL nào ngăn được điều này." },
    { title: "5 · Fencing token", tab: "fence", highlight: [2, 3, 8, 9], on: ["a3", "db"],
      desc: "Mỗi lần cấp khoá kèm số tăng dần; DB chỉ nhận ghi có token lớn hơn token đã thấy." },
    { title: "6 · Redlock và giới hạn", tab: "redlock", highlight: [3, 4, 6, 7], on: ["r"],
      desc: "Đa số trong 5 node độc lập, trừ thời gian đã tốn. Chống mất khoá khi 1 node chết, nhưng vẫn dựa vào giả định thời gian và không có fencing." }
  ],

  quiz: [
    { q: "Lệnh lấy khoá đúng trên một node Redis?", options: [
        "SETNX lock 1 rồi EXPIRE lock 30", "SET lock <token> NX PX 30000", "INCR lock", "GET lock rồi SET lock"
      ], correct: 1, explanation: "Một lệnh nguyên tử, có hạn và token chủ sở hữu." },
    { q: "Vì sao nhả khoá phải dùng Lua so token thay vì DEL?", options: [
        "DEL chậm", "Khoá của mình có thể đã hết hạn và thuộc người khác; DEL trần sẽ xoá khoá của họ", "Lua nhanh hơn", "DEL không chạy trong Cluster"
      ], correct: 1, explanation: "GET + so sánh + DEL phải nguyên tử." },
    { q: "Theo Kleppmann, vấn đề gốc mà mọi khoá có hạn (lease) đều gặp?", options: [
        "Redis chậm", "Client bị dừng (GC pause, mạng) lâu hơn TTL rồi tiếp tục hành động như vẫn giữ khoá", "Thiếu RAM", "Token trùng"
      ], correct: 1, explanation: "Cần tầng lưu trữ tự bảo vệ bằng fencing token." },
    { q: "Fencing token hoạt động thế nào?", options: [
        "Mã hoá khoá", "Số tăng dần cấp kèm mỗi lần lấy khoá; tài nguyên từ chối ghi có token nhỏ hơn token lớn nhất đã thấy", "Token ngẫu nhiên dài hơn", "Gia hạn khoá tự động"
      ], correct: 1, explanation: "Bảo vệ nằm ở phía tài nguyên, không ở phía khoá." },
    { q: "Redlock thành công khi nào?", options: [
        "Lấy được 1 node", "Lấy được đa số (≥3/5) node độc lập và tổng thời gian đã tốn nhỏ hơn TTL", "Lấy được cả 5", "Master và replica đều xác nhận"
      ], correct: 1, explanation: "Thời gian hiệu lực = TTL − elapsed − drift." },
    { q: "Khoá để tránh gửi trùng email báo cáo hằng ngày. Lựa chọn hợp lý?", options: [
        "etcd + fencing bắt buộc", "Một node Redis với SET NX PX + Lua release", "Không thể làm", "Redlock 7 node"
      ], correct: 1, explanation: "Mục đích hiệu quả; thỉnh thoảng trùng chấp nhận được." },
    { q: "Khoá bảo vệ việc trừ tiền. Điều quan trọng nhất?", options: [
        "TTL thật dài", "Tầng lưu trữ tự đảm bảo (fencing token, ràng buộc unique/idempotency, optimistic version)", "Dùng Redlock là đủ", "Dùng nhiều replica"
      ], correct: 1, explanation: "Khoá chỉ là tối ưu; đúng đắn phải do DB bảo đảm." },
    { q: "Việc có thể chạy lâu hơn TTL. Nên?", options: [
        "Đặt TTL 1 ngày", "Gia hạn định kỳ (watchdog) bằng Lua 'nếu còn là token của tôi thì PEXPIRE'", "Không đặt TTL", "Lấy khoá lại liên tục"
      ], correct: 1, explanation: "Không TTL thì client chết là khoá kẹt mãi." },
    { q: "Vì sao khoá trên master–replica Redis có thể 'mất' khi failover?", options: [
        "Replica không hỗ trợ SET", "Replication async: master cấp khoá rồi chết trước khi replica nhận, replica lên master không có khoá", "Sentinel xoá khoá", "Do TTL"
      ], correct: 1, explanation: "Đây là động lực của Redlock." }
  ]
});
