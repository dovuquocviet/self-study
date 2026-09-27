window.LESSONS.push({
  id: "16",
  phase: "3", phaseName: "Các mô hình dữ liệu",
  title: "Key-value in-memory — Redis bên dưới",
  subtitle: "Cấu trúc dữ liệu & encoding · event loop một luồng · lệnh O(N) chặn tất cả · RDB/AOF · eviction · TTL",

  theory: `
    <p>Redis không chỉ là "HashMap từ xa". Nó là một <strong>server cấu trúc dữ liệu</strong> nằm trọn trong RAM, và cả thiết kế xoay quanh việc chạy lệnh
    trong <strong>một luồng</strong> để khỏi cần lock.</p>

    <p><strong>1. Cấu trúc dữ liệu — và encoding bên dưới</strong></p>
    <table>
      <tr><th>Kiểu</th><th>Dùng cho</th><th>Encoding nhỏ → lớn</th></tr>
      <tr><td>String</td><td>Cache, counter (<code>INCR</code>), lock</td><td>int / chuỗi SDS</td></tr>
      <tr><td>Hash</td><td>Object nhiều field</td><td>listpack → hashtable</td></tr>
      <tr><td>List</td><td>Hàng đợi đơn giản</td><td>quicklist (danh sách liên kết các listpack)</td></tr>
      <tr><td>Set</td><td>Tập duy nhất, giao/hợp</td><td>intset / listpack → hashtable</td></tr>
      <tr><td>Sorted Set</td><td>Leaderboard, hàng đợi theo thời gian</td><td>listpack → skip list + hashtable</td></tr>
      <tr><td>Stream</td><td>Log sự kiện có consumer group</td><td>radix tree các listpack</td></tr>
    </table>
    <p>Kiểu nhỏ được lưu dạng <em>listpack</em> nén chặt (tiết kiệm RAM, thao tác O(N) nhưng N nhỏ); vượt ngưỡng (vd hash &gt; 128 field) thì chuyển sang cấu trúc đầy đủ.
    Xem bằng <code>OBJECT ENCODING key</code>.</p>

    <p><strong>2. Một luồng thực thi lệnh</strong></p>
    <ul>
      <li>Event loop (epoll/kqueue) nhận lệnh từ hàng nghìn kết nối, chạy <em>từng lệnh một</em>. Mỗi lệnh vì thế atomic tự nhiên. Từ Redis 6 có I/O thread cho đọc/ghi socket, nhưng thực thi lệnh vẫn một luồng.</li>
      <li>Hệ quả: một lệnh chậm chặn <em>tất cả</em> client. <code>KEYS *</code> trên 10 triệu key, <code>SMEMBERS</code>/<code>HGETALL</code> trên key khổng lồ, <code>DEL</code> một set triệu phần tử → độ trễ toàn hệ thống vọt lên.
      Dùng <code>SCAN</code>/<code>HSCAN</code>, <code>UNLINK</code> (giải phóng ở luồng nền), và tránh "big key".</li>
      <li>Muốn logic nhiều bước atomic: Lua script / Redis Functions — cũng chạy trong luồng đó, nên phải ngắn.</li>
    </ul>

    <p><strong>3. Persistence</strong></p>
    <ul>
      <li><strong>RDB</strong>: snapshot định kỳ. Redis <code>fork()</code>, tiến trình con ghi file nhờ copy-on-write. Khôi phục nhanh, nhưng mất dữ liệu kể từ snapshot cuối; fork với dataset lớn tốn RAM và có thể gây khựng.</li>
      <li><strong>AOF</strong>: log mọi lệnh ghi (bài 03), <code>appendfsync everysec</code> là mặc định cân bằng. AOF được <em>rewrite</em> nền để khỏi phình; mặc định có phần đầu dạng RDB cho nạp nhanh.</li>
      <li>Replication sang replica là <em>bất đồng bộ</em> → failover có thể mất vài ghi cuối.</li>
    </ul>

    <p><strong>4. Hết RAM thì sao — eviction &amp; TTL</strong></p>
    <ul>
      <li><code>maxmemory</code> + <code>maxmemory-policy</code>. Mặc định <code>noeviction</code>: đầy thì lệnh ghi trả lỗi. Cache thường dùng <code>allkeys-lru</code> hoặc <code>allkeys-lfu</code>; <code>volatile-*</code> chỉ đuổi key có TTL.</li>
      <li>LRU/LFU của Redis là <em>xấp xỉ</em>: lấy mẫu vài key (<code>maxmemory-samples</code> = 5) rồi đuổi key tệ nhất trong mẫu.</li>
      <li>Key hết hạn bị xoá theo hai cách: <em>lazy</em> (khi có ai truy cập) và <em>active</em> (định kỳ lấy mẫu key có TTL).</li>
    </ul>

    <div class="callout"><p>💡 Redis dùng làm cache thì mất dữ liệu là chấp nhận được; dùng làm nguồn sự thật (giỏ hàng, rate limit tính tiền) thì phải cân nhắc AOF,
    replica, và chấp nhận rằng failover bất đồng bộ vẫn có thể mất ghi. Đừng để một <code>KEYS *</code> trong code Spring (<code>redisTemplate.keys("*")</code>) lên production.</p></div>
  `,

  codeTabs: [
    { id: "types", label: "Cấu trúc dữ liệu", lines: [
      "SET product:42:price 150000 EX 300          # string + TTL 300s",
      "INCR pageview:2026-09-27                     # counter atomic",
      "HSET user:42 name An city HN                 # hash",
      "ZADD leaderboard 980 an 1200 binh            # sorted set",
      "ZREVRANGE leaderboard 0 9 WITHSCORES         # top 10, O(log N + 10)",
      "XADD orders * id 1001 total 350000           # stream",
      "",
      "OBJECT ENCODING user:42                      # \"listpack\" (nhỏ)",
      "OBJECT ENCODING leaderboard                  # \"listpack\" → \"skiplist\" khi lớn"
    ]},
    { id: "block", label: "Lệnh chặn cả server", lines: [
      "KEYS order:*            # ❌ O(N) trên toàn bộ key, chặn event loop",
      "SCAN 0 MATCH order:* COUNT 1000    # ✅ từng lô, trả cursor",
      "",
      "DEL big:set             # ❌ giải phóng triệu phần tử trong luồng chính",
      "UNLINK big:set          # ✅ tách key ngay, giải phóng ở luồng nền",
      "",
      "SLOWLOG GET 10          # lệnh chậm gần đây",
      "redis-cli --bigkeys     # tìm big key",
      "",
      "// Spring: redisTemplate.keys(\"order:*\") gọi KEYS → tránh; dùng scan()"
    ]},
    { id: "persist", label: "Persistence", lines: [
      "# redis.conf",
      "save 3600 1 300 100 60 10000   # RDB: sau 3600s nếu ≥1 thay đổi, 300s nếu ≥100, 60s nếu ≥10000",
      "appendonly yes                 # bật AOF",
      "appendfsync everysec           # fsync mỗi giây",
      "aof-use-rdb-preamble yes       # rewrite AOF với phần đầu RDB → nạp nhanh",
      "",
      "BGSAVE                         # fork() → con ghi dump.rdb (copy-on-write)",
      "BGREWRITEAOF                   # nén AOF ở nền"
    ]},
    { id: "evict", label: "Eviction & TTL", lines: [
      "maxmemory 4gb",
      "maxmemory-policy allkeys-lfu   # mặc định: noeviction → đầy thì ghi lỗi OOM",
      "maxmemory-samples 5            # LRU/LFU xấp xỉ bằng lấy mẫu",
      "",
      "INFO stats",
      "# evicted_keys:12034   expired_keys:998812",
      "# keyspace_hits / keyspace_misses → hit ratio của cache"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="c1"><div class="nl">📱 Client A</div><div class="ns">GET</div></div>
      <div class="node" id="c2"><div class="nl">📱 Client B</div><div class="ns">KEYS *</div></div>
      <div class="node" id="c3"><div class="nl">📱 Client C</div><div class="ns">INCR</div></div>
    </div>
    <div class="arrow" id="a1">↓ epoll gom sự kiện</div>
    <div class="node" id="loop"><div class="nl">🔁 Event loop — 1 luồng</div><div class="ns">chạy từng lệnh một, không lock</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="ram"><div class="nl">🧠 RAM: dict + listpack/skiplist</div><div class="ns">maxmemory → eviction</div></div>
    <div class="arrow" id="a3">↓ bền vững (tuỳ chọn)</div>
    <div class="row">
      <div class="node" id="rdb"><div class="nl">📸 RDB</div><div class="ns">fork + snapshot</div></div>
      <div class="node" id="aof"><div class="nl">📜 AOF</div><div class="ns">log lệnh, fsync everysec</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chọn đúng cấu trúc", tab: "types", highlight: [1, 2, 3, 4, 5, 6], on: ["ram"],
      desc: "Leaderboard dùng sorted set (skip list) thay vì tự sort ở Java." },
    { title: "2 · Encoding thay đổi theo kích thước", tab: "types", highlight: [8, 9], on: ["ram"],
      desc: "Nhỏ: listpack nén chặt. Lớn: hashtable/skiplist đầy đủ." },
    { title: "3 · Một luồng chạy lệnh", tab: "block", highlight: [1, 2], on: ["c1", "c2", "c3", "a1", "loop"],
      desc: "KEYS * của B làm A và C phải chờ. SCAN chia nhỏ công việc." },
    { title: "4 · Big key & UNLINK", tab: "block", highlight: [4, 5, 7, 8, 10], on: ["loop"],
      desc: "Giải phóng bộ nhớ lớn ở luồng nền; tìm lệnh chậm bằng SLOWLOG." },
    { title: "5 · Persistence", tab: "persist", highlight: [2, 3, 4, 7], on: ["a3", "rdb", "aof"],
      desc: "RDB: snapshot bằng fork. AOF: log lệnh. Thường bật cả hai nếu dữ liệu quan trọng." },
    { title: "6 · Eviction khi đầy", tab: "evict", highlight: [1, 2, 3, 6], on: ["a2", "ram"],
      desc: "Mặc định noeviction. Cache thì chọn allkeys-lru/lfu; LRU là xấp xỉ bằng lấy mẫu." }
  ],

  quiz: [
    { q: "Vì sao mỗi lệnh Redis tự nhiên là atomic?", options: [
        "Vì dùng transaction SQL",
        "Vì lệnh được thực thi tuần tự trong một luồng event loop",
        "Vì có lock trên từng key",
        "Vì ghi đĩa ngay"
      ], correct: 1, explanation: "Không có hai lệnh chạy xen nhau." },
    { q: "Hậu quả của KEYS * trên Redis có 10 triệu key?", options: [
        "Không sao",
        "Chặn event loop, mọi client khác phải chờ",
        "Xoá key",
        "Chỉ chậm với client gọi nó"
      ], correct: 1, explanation: "Dùng SCAN theo cursor." },
    { q: "UNLINK khác DEL ở đâu?", options: [
        "UNLINK không xoá",
        "UNLINK tách key ngay và giải phóng bộ nhớ ở luồng nền",
        "UNLINK chậm hơn",
        "Giống hệt"
      ], correct: 1, explanation: "Tránh khựng khi xoá big key." },
    { q: "Sorted set lớn được Redis cài đặt bằng?", options: [
        "B-tree", "Skip list + hashtable", "Mảng sắp xếp", "LSM"
      ], correct: 1, explanation: "Skip list cho truy vấn theo thứ hạng/khoảng điểm, hashtable cho tra điểm theo member." },
    { q: "maxmemory-policy mặc định là gì và hệ quả?", options: [
        "allkeys-lru, tự đuổi key",
        "noeviction — đầy RAM thì lệnh ghi trả lỗi",
        "volatile-ttl",
        "Tự ghi xuống đĩa"
      ], correct: 1, explanation: "Dùng làm cache nên đổi sang allkeys-lru hoặc allkeys-lfu." },
    { q: "RDB snapshot được tạo thế nào mà không dừng server lâu?", options: [
        "Khoá toàn bộ rồi ghi",
        "fork() tiến trình con ghi file, nhờ copy-on-write",
        "Ghi từng key qua mạng",
        "Replica ghi hộ"
      ], correct: 1, explanation: "Dataset lớn thì fork và copy-on-write vẫn tốn RAM, có thể gây khựng." },
    { q: "LRU của Redis có chính xác tuyệt đối không?", options: [
        "Có",
        "Không — xấp xỉ bằng lấy mẫu vài key (maxmemory-samples) rồi đuổi key tệ nhất trong mẫu",
        "Không có LRU",
        "Chỉ chính xác trong cluster"
      ], correct: 1, explanation: "Đổi độ chính xác lấy tốc độ và RAM." },
    { q: "Key có TTL hết hạn bị xoá khi nào?", options: [
        "Đúng thời điểm hết hạn, chính xác từng ms",
        "Khi có ai truy cập (lazy) hoặc khi chu trình định kỳ lấy mẫu gặp nó (active)",
        "Chỉ khi restart",
        "Không bao giờ"
      ], correct: 1, explanation: "Vì vậy bộ nhớ có thể chưa giảm ngay lúc key hết hạn." },
    { q: "Replication Redis mặc định là đồng bộ hay bất đồng bộ?", options: [
        "Đồng bộ", "Bất đồng bộ — failover có thể mất vài ghi cuối", "Không có replication", "Quorum"
      ], correct: 1, explanation: "Lệnh WAIT có thể chờ replica xác nhận, nhưng vẫn không biến Redis thành hệ nhất quán mạnh." },
    { q: "Từ Redis 6, I/O threads làm gì?", options: [
        "Thực thi lệnh song song",
        "Đọc/ghi socket song song; thực thi lệnh vẫn một luồng",
        "Ghi RDB",
        "Nén dữ liệu"
      ], correct: 1, explanation: "Mô hình lập trình vẫn giữ nguyên: lệnh tuần tự." }
  ]
});
