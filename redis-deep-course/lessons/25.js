window.LESSONS.push({
  id: "25",
  phase: "9", phaseName: "Tổng kết",
  title: "Tổng kết: bản đồ quyết định và checklist production",
  subtitle: "Chọn kiểu dữ liệu, persistence, topology, pattern · xử lý sự cố thường gặp · ôn tập",

  theory: `
    <p>Mọi thứ trong khoá quy về một vài ý tưởng gốc. Nắm chúng thì gặp tình huống mới vẫn suy ra được:</p>
    <ol>
      <li><strong>Một luồng thực thi</strong> (bài 01) → mỗi lệnh nguyên tử, không cần khoá; nhưng lệnh O(N), script dài, big key chặn tất cả (06, 16).</li>
      <li><strong>Type ≠ encoding</strong> (02–05) → nhỏ thì listpack/intset gọn, lớn thì hashtable/skiplist nhanh; chi phí lệnh phụ thuộc encoding.</li>
      <li><strong>Làm việc lớn từng mẩu nhỏ</strong> → rehash tiến dần, SCAN, active expire lấy mẫu, eviction lấy mẫu, lazyfree, MIGRATE theo lô.</li>
      <li><strong>fork + copy-on-write</strong> (09–10) → RDB, AOF rewrite, full sync đều tốn RAM dư và một khoảnh khắc dừng.</li>
      <li><strong>Mọi thứ phân tán đều async</strong> (11–14) → replication, failover có thể mất ghi; Redis không phải nguồn sự thật cho tiền.</li>
      <li><strong>Nguyên tử phía server</strong> (15–16) → MULTI để cô lập, WATCH để CAS, Lua/Functions để đọc–quyết định–ghi.</li>
    </ol>

    <table>
      <tr><th>Câu hỏi</th><th>Trả lời nhanh</th></tr>
      <tr><td>Đếm, cờ, cache giá trị</td><td>String (<code>INCR</code>, <code>SET EX</code>)</td></tr>
      <tr><td>Object nhiều field</td><td>Hash</td></tr>
      <tr><td>Xếp hạng, hàng đợi hẹn giờ, cửa sổ thời gian</td><td>Sorted Set</td></tr>
      <tr><td>Hàng đợi việc có ack, retry</td><td>Stream + consumer group</td></tr>
      <tr><td>Đếm unique xấp xỉ / cờ theo ID số dày</td><td>HyperLogLog / Bitmap</td></tr>
      <tr><td>Chỉ cache, mất được</td><td>Không persistence (hoặc RDB), <code>allkeys-lfu</code></td></tr>
      <tr><td>Session, lock, queue</td><td>AOF everysec + RDB, replica, <code>noeviction</code>/<code>volatile-*</code>, instance riêng</td></tr>
      <tr><td>Cần HA, dữ liệu vừa 1 máy</td><td>Master–replica + Sentinel (hoặc dịch vụ managed)</td></tr>
      <tr><td>Vượt RAM/CPU một máy</td><td>Cluster + hash tag theo thực thể</td></tr>
      <tr><td>Khoá đúng đắn tuyệt đối</td><td>Fencing ở DB / ràng buộc idempotency, không chỉ dựa Redis</td></tr>
    </table>

    <p><strong>Sự cố thường gặp và việc đầu tiên cần xem</strong></p>
    <table>
      <tr><th>Triệu chứng</th><th>Xem</th><th>Nghi phạm</th></tr>
      <tr><td>p99 tăng vọt định kỳ</td><td><code>latest_fork_usec</code>, <code>LATENCY DOCTOR</code></td><td>BGSAVE/rewrite fork, THP bật</td></tr>
      <tr><td>p99 tăng ngẫu nhiên</td><td><code>SLOWLOG</code>, <code>latencystats</code></td><td>KEYS, HGETALL big key, Lua dài</td></tr>
      <tr><td>OOM command not allowed</td><td><code>INFO memory</code>, policy</td><td>noeviction/volatile-* không có TTL, big key, buffer client</td></tr>
      <tr><td>Replica liên tục full sync</td><td>log, <code>repl_backlog_size</code></td><td>backlog nhỏ, output buffer replica nhỏ</td></tr>
      <tr><td>DB sập khi deploy</td><td>hit ratio, <code>expired_keys</code></td><td>warm cache cùng TTL, stampede key nóng</td></tr>
      <tr><td>Một shard CPU 100%</td><td><code>--hotkeys</code>, commandstats từng node</td><td>hot key, hash tag quá rộng</td></tr>
    </table>

    <div class="callout"><p>💡 Bước tiếp theo: dựng một Cluster 6 node bằng Docker, viết service axum nhỏ dùng redis-rs với cache-aside + rate limiter Lua + worker Stream,
    rồi chạy <code>redis-benchmark</code> và kill -9 master để quan sát failover, MOVED và dữ liệu mất. Nhìn tận mắt một lần đáng hơn đọc mười lần.</p></div>
  `,

  codeTabs: [
    { id: "conf", label: "① redis.conf production", lines: [
      "bind 10.0.0.1 ; protected-mode yes ; port 6379",
      "aclfile /etc/redis/users.acl               # user cho từng service, -@dangerous",
      "maxmemory 12gb                             # ~70% RAM máy 16GB",
      "maxmemory-policy allkeys-lfu               # hoặc noeviction cho dữ liệu chính",
      "appendonly yes ; appendfsync everysec",
      "save 3600 1 300 100 60 10000",
      "repl-backlog-size 512mb",
      "client-output-buffer-limit replica 1gb 256mb 60",
      "lazyfree-lazy-eviction yes ; lazyfree-lazy-expire yes ; lazyfree-lazy-user-del yes",
      "slowlog-log-slower-than 10000 ; latency-monitor-threshold 50",
      "# OS: THP=never, vm.overcommit_memory=1, somaxconn đủ lớn"
    ]},
    { id: "app", label: "② Checklist phía app", lines: [
      "[ ] Key có namespace + version:  svc:v2:entity:{id}",
      "[ ] Mọi key tạm có TTL (+ jitter)",
      "[ ] Không KEYS/SMEMBERS/HGETALL trên key có thể lớn -> SCAN/phân trang",
      "[ ] Giá trị < ~100 KB; collection < ~10k phần tử (hoặc chia nhỏ)",
      "[ ] Đọc-quyết định-ghi dùng Lua/Functions, không GET rồi SET",
      "[ ] Lock: SET NX PX + token + Lua release; việc quan trọng có fencing",
      "[ ] Timeout lệnh ngắn; lỗi Redis trên đường cache -> fallback có giới hạn",
      "[ ] Lệnh blocking/WATCH/SUBSCRIBE dùng kết nối riêng",
      "[ ] Cluster: lệnh nhiều key dùng hash tag theo thực thể"
    ]},
    { id: "map", label: "③ Bản đồ khoá học", lines: [
      "01 event loop  -> 02 robj/SDS -> 03 list/hash -> 04 set/zset -> 05 bitmap/HLL/geo",
      "06 độ phức tạp, big/hot key",
      "07 TTL -> 08 eviction",
      "09 RDB -> 10 AOF",
      "11 replication -> 12 Sentinel -> 13 Cluster -> 14 MOVED/ASK/hash tag",
      "15 pipeline/MULTI/WATCH -> 16 Lua/Functions",
      "17 cache pattern -> 18 stampede -> 19 lock -> 20 rate limit -> 21 streams -> 22 session",
      "23 memory & monitoring -> 24 client Rust -> 25 tổng kết"
    ]},
    { id: "lab", label: "④ Bài thực hành", lines: [
      "$ docker run -d --name r1 -p 7000-7005:7000-7005 ... (6 node cluster-enabled)",
      "$ redis-cli --cluster create ... --cluster-replicas 1",
      "$ cargo new shop-cache && cd shop-cache   # axum + redis (cluster-async)",
      "#   GET /product/{id}  -> cache-aside + jitter + single-flight",
      "#   POST /order        -> rate limit Lua (token bucket) + XADD orders",
      "#   worker             -> XREADGROUP + XACK + XAUTOCLAIM",
      "$ redis-benchmark -c 100 -n 1000000 -P 16 -t get,set -q",
      "$ docker kill <master>   # quan sát: FAIL, failover, MOVED, ghi bị mất?"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="core"><div class="nl">⚙️ 1 luồng · encoding</div><div class="ns">bài 01–06</div></div>
      <div class="node" id="mem"><div class="nl">🧠 TTL · eviction</div><div class="ns">bài 07–08</div></div>
      <div class="node" id="dur"><div class="nl">💾 RDB · AOF</div><div class="ns">bài 09–10</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="ha"><div class="nl">📡 Replica · Sentinel · Cluster</div><div class="ns">bài 11–14</div></div>
      <div class="node" id="atom"><div class="nl">🧩 MULTI · Lua</div><div class="ns">bài 15–16</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="pat"><div class="nl">🛠️ Cache · lock · rate limit · stream · session</div><div class="ns">bài 17–22</div></div>
      <div class="node" id="ops"><div class="nl">📈 Vận hành · Rust</div><div class="ns">bài 23–24</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Nền tảng", tab: "map", highlight: [1, 2], on: ["core"],
      desc: "Một luồng + encoding giải thích vì sao Redis nhanh và vì sao một lệnh sai có thể làm sập cả hệ thống." },
    { title: "2 · Vòng đời và độ bền", tab: "conf", highlight: [3, 4, 5, 6], on: ["mem", "dur"],
      desc: "maxmemory để dư cho fork; policy theo mục đích; AOF everysec cho dữ liệu cần giữ." },
    { title: "3 · Phân tán", tab: "conf", highlight: [7, 8], on: ["a1", "ha"],
      desc: "Backlog và output buffer đủ lớn để tránh vòng lặp full sync. Nhớ: mọi thứ async." },
    { title: "4 · Nguyên tử và pattern", tab: "app", highlight: [5, 6, 9], on: ["atom", "a2", "pat"],
      desc: "Lua cho đọc–quyết định–ghi, fencing cho việc quan trọng, hash tag trong Cluster." },
    { title: "5 · Phía ứng dụng", tab: "app", highlight: [1, 2, 3, 7, 8], on: ["pat", "ops"],
      desc: "TTL + jitter, tránh lệnh O(N), timeout ngắn, kết nối riêng cho lệnh blocking." },
    { title: "6 · Tự tay kiểm chứng", tab: "lab", highlight: [1, 2, 7, 8], on: ["core", "ha", "ops"],
      desc: "Dựng cluster, viết service, kill master và quan sát." }
  ],

  quiz: [
    { q: "Client A chạy HGETALL trên hash 3 triệu field. Client B chỉ GET một key nhỏ. B bị ảnh hưởng thế nào?", options: [
        "Không ảnh hưởng", "B phải chờ HGETALL xong vì cùng main thread", "B nhận lỗi BUSY", "B được chuyển sang replica"
      ], correct: 1, explanation: "Bài 01 và 06." },
    { q: "Hash 50 field ngắn, cấu hình mặc định 7.x. Encoding và độ phức tạp HGET?", options: [
        "hashtable, O(1)", "listpack, O(n) duyệt nhưng rất nhanh vì n nhỏ và nằm liền trong bộ nhớ", "skiplist, O(log n)", "intset, O(log n)"
      ], correct: 1, explanation: "Bài 03." },
    { q: "Key có TTL, chạy SET key v (không tuỳ chọn). Chuyện gì xảy ra với TTL?", options: [
        "Giữ nguyên", "Bị xoá, key thành vĩnh viễn", "Reset về ban đầu", "Key bị xoá"
      ], correct: 1, explanation: "Bài 07 — dùng KEEPTTL hoặc SET ... EX." },
    { q: "Instance cache thuần, RAM đầy, muốn giữ key được dùng thường xuyên nhất. Policy?", options: [
        "noeviction", "allkeys-lfu", "volatile-ttl", "allkeys-random"
      ], correct: 1, explanation: "Bài 08." },
    { q: "p99 tăng vọt đều đặn mỗi vài phút trên instance 30 GB. Nghi phạm đầu tiên?", options: [
        "Mạng", "fork cho BGSAVE/AOF rewrite (xem latest_fork_usec, THP)", "Client quá nhiều", "Hash tag"
      ], correct: 1, explanation: "Bài 09–10, 23." },
    { q: "appendfsync everysec, mất điện toàn bộ. Mất tối đa khoảng?", options: [
        "0", "~1–2 giây ghi", "30 giây", "Tới lần BGSAVE trước"
      ], correct: 1, explanation: "Bài 10." },
    { q: "Replica rớt mạng 3 phút rồi quay lại, master ghi 5 MB/s, backlog 1 MB. Kết quả?", options: [
        "Partial resync", "Full resync (fork + gửi toàn bộ RDB)", "Replica tự thăng cấp", "Không đồng bộ được nữa"
      ], correct: 1, explanation: "Bài 11 — 900 MB thiếu vượt xa backlog 1 MB." },
    { q: "3 Sentinel, quorum 2, một Sentinel chết cùng master. Failover có xảy ra không?", options: [
        "Không", "Có — còn 2/3 Sentinel: đủ quorum và đủ đa số", "Chỉ khi quorum = 1", "Cần can thiệp tay"
      ], correct: 1, explanation: "Bài 12." },
    { q: "Trong Cluster, EVAL dùng KEYS 'cart:1' và 'stock:9' báo CROSSSLOT. Cách sửa đúng?", options: [
        "Tắt Cluster", "Thiết kế key cùng hash tag nếu nghiệp vụ thật sự cần nguyên tử giữa chúng, hoặc tách thành hai bước có bù trừ", "Dùng KEYS *", "Thêm node"
      ], correct: 1, explanation: "Bài 14, 16." },
    { q: "MULTI; INCR a; LPUSH a x; EXEC với a là số. Kết quả?", options: [
        "Cả hai rollback", "INCR thành công, LPUSH lỗi WRONGTYPE, không rollback", "EXECABORT", "Cả hai thành công"
      ], correct: 1, explanation: "Bài 15." },
    { q: "Muốn trừ tồn kho chỉ khi còn đủ, nguyên tử, ít round-trip nhất?", options: [
        "GET rồi DECRBY", "Pipeline GET + DECRBY", "Script Lua / Function", "MULTI GET DECRBY"
      ], correct: 2, explanation: "Bài 16." },
    { q: "Ghi DB xong mới DEL cache, vẫn có race hiếm. Lưới an toàn quan trọng nhất?", options: [
        "Không cần", "TTL cho mọi key cache (kèm CDC nếu cần chặt hơn)", "Tăng maxmemory", "Dùng KEYS"
      ], correct: 1, explanation: "Bài 17." },
    { q: "Deploy xong, 2 triệu key warm cùng TTL 600s; 10 phút sau DB sập. Tên sự cố và cách chống?", options: [
        "Penetration — Bloom filter", "Avalanche — jitter TTL", "Split-brain — Sentinel", "Big key — UNLINK"
      ], correct: 1, explanation: "Bài 18." },
    { q: "Nhả distributed lock đúng cách?", options: [
        "DEL lock", "Lua: nếu GET lock == token của mình thì DEL", "EXPIRE lock 0", "Chờ hết TTL"
      ], correct: 1, explanation: "Bài 19." },
    { q: "Worker Stream crash sau khi nhận tin, trước XACK. Tin đó?", options: [
        "Mất", "Nằm trong PEL; consumer khác XAUTOCLAIM để xử lý lại", "Tự quay lại cuối stream", "Được giao cho mọi consumer"
      ], correct: 1, explanation: "Bài 21 — xử lý phải idempotent." },
    { q: "Service Rust dùng một ConnectionManager chung, thêm worker BLPOP 30s trên chính nó. Hậu quả?", options: [
        "Không sao", "Các lệnh khác trên kết nối đó bị kẹt sau BLPOP", "Redis từ chối BLPOP", "Mất dữ liệu"
      ], correct: 1, explanation: "Bài 24." }
  ]
});
