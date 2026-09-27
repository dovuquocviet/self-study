window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Bộ nhớ & vòng đời key",
  title: "Eviction: khi RAM đầy, Redis bỏ key nào?",
  subtitle: "maxmemory · 8 policy · LRU xấp xỉ bằng lấy mẫu · LFU với bộ đếm logarit",

  theory: `
    <p><code>maxmemory</code> đặt trần bộ nhớ cho dữ liệu. Khi vượt trần, <strong>trước khi thực thi lệnh ghi</strong>, Redis chạy eviction theo <code>maxmemory-policy</code>.
    Không đặt <code>maxmemory</code> trên Linux 64-bit thì Redis dùng tới khi OS hết RAM → swap hoặc bị OOM killer giết.</p>

    <table>
      <tr><th>Policy</th><th>Ứng viên</th><th>Chọn theo</th></tr>
      <tr><td><code>noeviction</code> (mặc định)</td><td>—</td><td>Lệnh ghi trả lỗi <code>OOM command not allowed</code>; đọc vẫn chạy</td></tr>
      <tr><td><code>allkeys-lru</code></td><td>Mọi key</td><td>Lâu nhất chưa truy cập</td></tr>
      <tr><td><code>allkeys-lfu</code> (4.0+)</td><td>Mọi key</td><td>Ít được dùng nhất (có suy giảm theo thời gian)</td></tr>
      <tr><td><code>allkeys-random</code></td><td>Mọi key</td><td>Ngẫu nhiên</td></tr>
      <tr><td><code>volatile-lru</code> / <code>volatile-lfu</code> / <code>volatile-random</code></td><td>Chỉ key <strong>có TTL</strong></td><td>Như trên</td></tr>
      <tr><td><code>volatile-ttl</code></td><td>Chỉ key có TTL</td><td>TTL còn lại ngắn nhất</td></tr>
    </table>
    <p>Với <code>volatile-*</code>, nếu không có key nào có TTL thì hành xử như <code>noeviction</code> → lỗi OOM dù còn cả đống key có thể bỏ.</p>

    <p><strong>LRU xấp xỉ</strong>: LRU chính xác cần một linked list toàn cục, mỗi lần đọc phải dời node — tốn con trỏ và RAM. Redis thay bằng:
    mỗi robj lưu 24 bit "đồng hồ LRU"; khi cần bỏ key, <strong>lấy mẫu ngẫu nhiên</strong> <code>maxmemory-samples</code> key (mặc định 5), đưa vào một
    <em>eviction pool</em> 16 ứng viên sắp theo độ "nguội", bỏ cái nguội nhất. Samples 10 gần như LRU thật, tốn thêm CPU.</p>

    <p><strong>LFU</strong>: 24 bit chia thành 16 bit thời gian (phút) + 8 bit bộ đếm <em>logarit</em> (tối đa 255). Không phải mỗi lần đọc +1; xác suất tăng giảm dần khi
    bộ đếm lớn (<code>lfu-log-factor</code>, mặc định 10 → khoảng 1 triệu lượt truy cập mới lên 255). Bộ đếm giảm dần theo thời gian không truy cập
    (<code>lfu-decay-time</code>, phút). LFU tốt hơn LRU khi có "quét một lần" (batch đọc hết dữ liệu cũ làm LRU đẩy mất key nóng thật).</p>

    <table>
      <tr><th>Dùng Redis làm</th><th>Policy gợi ý</th></tr>
      <tr><td>Cache thuần</td><td><code>allkeys-lru</code> hoặc <code>allkeys-lfu</code></td></tr>
      <tr><td>Vừa cache vừa dữ liệu không được mất (session, lock, queue)</td><td>Tách instance. Bất đắc dĩ: <code>volatile-lru</code> và chỉ key cache có TTL</td></tr>
      <tr><td>Queue/Stream, dữ liệu chính</td><td><code>noeviction</code> + cảnh báo RAM</td></tr>
    </table>

    <div class="callout"><p>💡 <code>maxmemory</code> không tính overhead ngoài dataset: output buffer của replica, buffer AOF, phân mảnh bộ nhớ, và <strong>copy-on-write khi fork</strong> (bài 09).
    Quy tắc an toàn: đặt <code>maxmemory</code> khoảng 60–75% RAM máy nếu có persistence/replication.</p></div>
  `,

  codeTabs: [
    { id: "conf", label: "① Cấu hình", lines: [
      "maxmemory 6gb",
      "maxmemory-policy allkeys-lfu",
      "maxmemory-samples 5          # 10 = sát LRU/LFU thật hơn, tốn CPU hơn",
      "lfu-log-factor 10",
      "lfu-decay-time 1             # phút",
      "lazyfree-lazy-eviction yes   # free key bị evict trên bio thread",
      "",
      "CONFIG SET maxmemory-policy allkeys-lru   # đổi nóng được"
    ]},
    { id: "algo", label: "② Eviction pool", lines: [
      "performEvictions():                       // trước lệnh ghi khi used > maxmemory",
      "  while used_memory > maxmemory:",
      "    for db: sample maxmemory-samples keys  // từ dict hoặc expires (volatile-*)",
      "      score = idle_time (LRU) | 255 - freq (LFU) | ttl (volatile-ttl)",
      "      chèn vào pool[16] giữ các ứng viên 'nguội' nhất",
      "    evict pool.best()                     // xoá + lan truyền DEL",
      "  nếu không bỏ được gì (noeviction / không có key TTL):",
      "    trả -OOM command not allowed when used memory > 'maxmemory'"
    ]},
    { id: "lfu", label: "③ Bộ đếm LFU", lines: [
      "// 24 bit của robj.lru khi dùng LFU:",
      "// [ 16 bit: thời điểm giảm gần nhất (phút) ][ 8 bit: counter logarit ]",
      "",
      "LFULogIncr(counter):",
      "  if counter == 255: return 255",
      "  r = random()",
      "  p = 1.0 / ((counter - LFU_INIT_VAL) * lfu_log_factor + 1)",
      "  if r < p: counter++          // càng lớn càng khó tăng",
      "",
      "OBJECT FREQ mykey              # xem counter (chỉ khi policy là *-lfu)"
    ]},
    { id: "obs", label: "④ Quan sát", lines: [
      "INFO memory",
      "used_memory_human:5.98G",
      "maxmemory_human:6.00G",
      "maxmemory_policy:allkeys-lfu",
      "",
      "INFO stats",
      "evicted_keys:1249022           # tăng đều = cache đang quá nhỏ",
      "keyspace_hits:98122311",
      "keyspace_misses:4411203        # hit ratio = hits / (hits + misses)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="w"><div class="nl">✍️ Lệnh ghi tới</div><div class="ns">used_memory &gt; maxmemory?</div></div>
    <div class="arrow" id="a1">↓ có</div>
    <div class="node" id="p"><div class="nl">📜 maxmemory-policy</div><div class="ns">allkeys-* / volatile-* / noeviction</div></div>
    <div class="arrow" id="a2">↓ lấy mẫu 5 key</div>
    <div class="node" id="pool"><div class="nl">🎯 Eviction pool (16)</div><div class="ns">sắp theo idle / tần suất / TTL</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="ev"><div class="nl">🗑️ Evict key nguội nhất</div><div class="ns">DEL → replica/AOF</div></div>
      <div class="node" id="oom"><div class="nl">⛔ -OOM</div><div class="ns">noeviction / không có key TTL</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Đặt trần và policy", tab: "conf", highlight: [1, 2, 3], on: ["w", "p"],
      desc: "Không có maxmemory thì Redis sẽ ăn tới khi OS giết. Cache thuần: allkeys-lru/lfu." },
    { title: "2 · Vượt trần → lấy mẫu", tab: "algo", highlight: [1, 2, 3], on: ["a1", "a2"],
      desc: "Không duy trì danh sách LRU toàn cục; chỉ lấy vài key ngẫu nhiên mỗi lần." },
    { title: "3 · Pool giữ ứng viên tốt nhất", tab: "algo", highlight: [4, 5, 6], on: ["pool", "ev"],
      desc: "Pool 16 phần tử tích luỹ qua nhiều lần lấy mẫu nên kết quả gần LRU thật." },
    { title: "4 · LFU: đếm logarit + suy giảm", tab: "lfu", highlight: [2, 7, 8], on: ["pool"],
      desc: "8 bit đủ phân biệt từ vài lần tới ~1 triệu lượt truy cập; không truy cập thì counter giảm theo lfu-decay-time." },
    { title: "5 · Không bỏ được → OOM", tab: "algo", highlight: [7, 8], on: ["a3", "oom"],
      desc: "noeviction, hoặc volatile-* mà không có key có TTL: lệnh ghi bị từ chối." },
    { title: "6 · Theo dõi", tab: "obs", highlight: [7, 8, 9], on: ["ev"],
      desc: "evicted_keys tăng đều và hit ratio giảm → cache thiếu RAM hoặc TTL chưa hợp lý." }
  ],

  quiz: [
    { q: "Policy mặc định của Redis khi đạt maxmemory?", options: [
        "allkeys-lru", "volatile-lru", "noeviction", "allkeys-random"
      ], correct: 2, explanation: "Mặc định từ chối lệnh ghi bằng lỗi OOM." },
    { q: "volatile-lru nhưng không key nào có TTL. Khi đầy RAM?", options: [
        "Evict key bất kỳ", "Như noeviction: lệnh ghi lỗi OOM", "Xoá key cũ nhất", "Tự chuyển sang allkeys-lru"
      ], correct: 1, explanation: "volatile-* chỉ chọn trong tập key có TTL." },
    { q: "Redis cài LRU thế nào?", options: [
        "Linked list toàn cục, dời node mỗi lần đọc", "Xấp xỉ: lấy mẫu ngẫu nhiên vài key + eviction pool", "Sắp xếp toàn bộ key theo thời gian mỗi giây", "Dùng B-tree"
      ], correct: 1, explanation: "Tiết kiệm RAM và CPU, độ chính xác chỉnh bằng maxmemory-samples." },
    { q: "Tăng maxmemory-samples từ 5 lên 10 thì?", options: [
        "Tiết kiệm RAM", "Sát LRU/LFU thật hơn, tốn thêm CPU khi evict", "Evict nhiều key hơn mỗi lần", "Không ảnh hưởng"
      ], correct: 1, explanation: "Mẫu lớn hơn → ứng viên tốt hơn." },
    { q: "Bộ đếm LFU có 8 bit nhưng phân biệt được tới ~1 triệu lượt truy cập nhờ?", options: [
        "Nén", "Tăng theo xác suất giảm dần (logarit)", "Lưu thêm trong dict riêng", "Chỉ đếm lượt ghi"
      ], correct: 1, explanation: "Counter càng lớn thì xác suất tăng càng nhỏ." },
    { q: "Tình huống nào LFU tốt hơn LRU rõ rệt?", options: [
        "Mọi key được truy cập đều nhau", "Có job quét đọc một lần toàn bộ dữ liệu cũ, đẩy mất key nóng dưới LRU", "Chỉ có lệnh ghi", "Khi không có TTL"
      ], correct: 1, explanation: "Một lần đọc không làm tần suất cao lên nhiều, nên key nóng thật vẫn được giữ." },
    { q: "Vì sao không nên đặt maxmemory = 100% RAM máy khi bật RDB/AOF?", options: [
        "Redis không cho phép", "Fork + copy-on-write, output buffer, phân mảnh cần thêm RAM ngoài dataset", "RDB cần gấp 3 RAM", "Vì eviction chậm"
      ], correct: 1, explanation: "Để dư 25–40% cho các khoản này." },
    { q: "Instance vừa làm cache vừa giữ distributed lock và session. Khuyến nghị?", options: [
        "allkeys-lru cho gọn", "Tách instance; nếu không thể thì volatile-lru và chỉ key cache có TTL", "noeviction cho cache", "allkeys-random"
      ], correct: 1, explanation: "allkeys-* có thể evict lock/session đang dùng." },
    { q: "Metric nào cho thấy cache đang thiếu RAM?", options: [
        "connected_clients tăng", "evicted_keys tăng đều kèm hit ratio giảm", "expired_keys tăng", "rdb_changes_since_last_save"
      ], correct: 1, explanation: "Key bị đẩy ra rồi lại miss." }
  ]
});
