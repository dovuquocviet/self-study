window.LESSONS.push({
  id: "23",
  phase: "8", phaseName: "Vận hành & client",
  title: "Tối ưu bộ nhớ và giám sát: INFO, SLOWLOG, LATENCY, MEMORY",
  subtitle: "used_memory vs RSS · phân mảnh · gom key vào hash · các metric phải có trên dashboard",

  theory: `
    <p><strong>Đọc INFO memory</strong></p>
    <table>
      <tr><th>Trường</th><th>Ý nghĩa</th></tr>
      <tr><td><code>used_memory</code></td><td>Byte Redis đã cấp phát qua allocator (jemalloc) — dữ liệu + overhead + buffer</td></tr>
      <tr><td><code>used_memory_rss</code></td><td>RAM mà OS thấy tiến trình đang chiếm</td></tr>
      <tr><td><code>mem_fragmentation_ratio</code></td><td>≈ rss / used. 1,0–1,5 bình thường; &gt; 1,5 phân mảnh nhiều; <strong>&lt; 1 là đang bị swap</strong> (nguy hiểm)</td></tr>
      <tr><td><code>used_memory_peak</code></td><td>Đỉnh từng đạt — jemalloc không luôn trả RAM lại cho OS ngay</td></tr>
      <tr><td><code>mem_clients_normal</code>, <code>mem_clients_slaves</code></td><td>Buffer của client/replica — tăng vọt khi client đọc chậm hoặc pub/sub nghẽn</td></tr>
    </table>
    <p>Phân mảnh sinh ra khi xoá/sửa nhiều giá trị khác kích thước. <code>activedefrag yes</code> để Redis dời dữ liệu dần trên main thread (có giới hạn CPU) mà không cần restart.</p>

    <p><strong>Kỹ thuật giảm RAM</strong></p>
    <ul>
      <li><strong>Gom key nhỏ vào hash</strong>: 10 triệu key <code>user:123:score</code> → hash <code>user:score:{123 / 100}</code> field <code>123 % 100</code>. Mỗi hash 100 field là listpack → bỏ được overhead dict entry + robj + expires của từng key. Tiết kiệm có thể tới vài lần. Đổi lại: mất TTL riêng từng key (7.4 có HEXPIRE nhưng field có TTL tốn thêm).</li>
      <li>Tên key ngắn nhưng vẫn đọc được (<code>u:123</code> thay vì <code>application:production:user_profile:123</code>) khi có hàng trăm triệu key.</li>
      <li>Serialize gọn (MessagePack/Protobuf thay JSON dài), nén giá trị lớn &gt; 1 KB (LZ4/zstd) ở client.</li>
      <li>Số nguyên lưu dạng số để được encoding <code>int</code>; bitmap/HLL cho đếm (bài 05).</li>
      <li>Luôn có TTL cho dữ liệu tạm; kiểm tra định kỳ key không TTL.</li>
    </ul>

    <p><strong>Tìm lệnh chậm</strong></p>
    <ul>
      <li><code>SLOWLOG GET 20</code>: lệnh có thời gian <em>thực thi</em> &gt; <code>slowlog-log-slower-than</code> (µs, mặc định 10000 = 10 ms). Không tính thời gian mạng/chờ hàng đợi.</li>
      <li><code>LATENCY DOCTOR</code> / <code>LATENCY LATEST</code>: sự kiện trễ theo loại (command, fork, expire-cycle, aof-fsync...) khi bật <code>latency-monitor-threshold</code>.</li>
      <li><code>redis-cli --latency</code>, <code>--latency-history</code>: đo RTT từ phía client; <code>--intrinsic-latency 30</code> chạy trên máy chủ đo độ trễ nền do OS/VM.</li>
      <li><code>INFO commandstats</code>: số lần gọi, tổng/trung bình µs từng lệnh; <code>INFO latencystats</code> (7.0): p50/p99/p99.9 theo lệnh.</li>
      <li><code>CLIENT LIST</code>: client nào có <code>omem</code> (output buffer) lớn, idle lâu, đang chạy lệnh gì. <code>MONITOR</code> in mọi lệnh — rất tốn, chỉ dùng vài giây khi debug.</li>
    </ul>

    <div class="callout"><p>💡 Dashboard tối thiểu (Prometheus redis_exporter): ops/s, hit ratio, used_memory/maxmemory, evicted_keys, expired_keys, connected_clients, blocked_clients,
    replication lag (offset), latest_fork_usec, rdb/aof last status, p99 latency theo lệnh, số lệnh slowlog. Cảnh báo sớm nhất thường là <strong>p99 tăng</strong> và <strong>memory gần maxmemory</strong>.</p></div>
  `,

  codeTabs: [
    { id: "info", label: "① INFO memory", lines: [
      "127.0.0.1:6379> INFO memory",
      "used_memory:6442450944",
      "used_memory_human:6.00G",
      "used_memory_rss_human:7.91G",
      "used_memory_peak_human:7.20G",
      "maxmemory_human:8.00G",
      "mem_fragmentation_ratio:1.32",
      "mem_clients_normal:18874368",
      "",
      "127.0.0.1:6379> MEMORY USAGE user:score:1234 SAMPLES 0   # 0 = đo toàn bộ phần tử",
      "127.0.0.1:6379> MEMORY DOCTOR"
    ]},
    { id: "hash", label: "② Gom key vào hash", lines: [
      "# Trước: mỗi user một key",
      "SET user:123456:score 870",
      "# ~ 10 triệu key -> overhead dict + robj + SDS tên key mỗi key",
      "",
      "# Sau: bucket 100 user / hash (listpack)",
      "HSET user:score:1234 56 870           # 123456 / 100 = 1234, 123456 % 100 = 56",
      "HGET user:score:1234 56",
      "",
      "# Giữ số field <= hash-max-listpack-entries (128) để còn là listpack",
      "# Đo trước/sau bằng INFO memory trên tập mẫu - đừng đoán"
    ]},
    { id: "slow", label: "③ SLOWLOG & LATENCY", lines: [
      "CONFIG SET slowlog-log-slower-than 10000     # 10 ms",
      "CONFIG SET slowlog-max-len 1024",
      "SLOWLOG GET 2",
      "1) 1) (integer) 1932           # id",
      "   2) (integer) 1727400012     # thời điểm",
      "   3) (integer) 84211          # 84 ms thực thi",
      "   4) 1) \"HGETALL\" 2) \"cart:9981\"",
      "   5) \"10.0.3.17:52144\"      6) \"order-svc\"",
      "",
      "CONFIG SET latency-monitor-threshold 50",
      "LATENCY DOCTOR"
    ]},
    { id: "cli", label: "④ Công cụ nhanh", lines: [
      "redis-cli --latency-history -i 5          # RTT mỗi 5 giây",
      "redis-cli --intrinsic-latency 30          # chạy TRÊN máy Redis: độ trễ nền OS/VM",
      "redis-cli --bigkeys ; redis-cli --memkeys",
      "redis-cli --hotkeys                       # cần maxmemory-policy *-lfu",
      "redis-cli --stat                          # ops, mem, clients theo giây",
      "",
      "INFO commandstats",
      "cmdstat_hgetall:calls=18233,usec=91822311,usec_per_call=5036.02,...",
      "INFO latencystats",
      "latency_percentiles_usec_get:p50=4.015,p99=15.039,p99.9=40.191"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="used"><div class="nl">📦 used_memory 6,0G</div><div class="ns">allocator đã cấp</div></div>
      <div class="node" id="rss"><div class="nl">🧮 RSS 7,9G</div><div class="ns">OS thấy</div></div>
    </div>
    <div class="arrow" id="a1">↓ ratio 1,32 · &lt;1 = swap!</div>
    <div class="node" id="opt"><div class="nl">🗜️ Tối ưu</div><div class="ns">gom hash · key ngắn · nén · TTL · activedefrag</div></div>
    <div class="arrow" id="a2">↓ lệnh chậm ở đâu?</div>
    <div class="row">
      <div class="node" id="sl"><div class="nl">🐌 SLOWLOG</div><div class="ns">thời gian thực thi</div></div>
      <div class="node" id="lat"><div class="nl">⏱️ LATENCY / latencystats</div><div class="ns">fork, fsync, p99</div></div>
      <div class="node" id="cl"><div class="nl">👥 CLIENT LIST</div><div class="ns">omem, idle</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Hai con số bộ nhớ", tab: "info", highlight: [2, 4, 7], on: ["used", "rss", "a1"],
      desc: "used là Redis tự đếm; RSS là OS đếm. Tỉ lệ cho biết phân mảnh (>1,5) hay swap (<1)." },
    { title: "2 · Đo từng key", tab: "info", highlight: [10, 11], on: ["used"],
      desc: "MEMORY USAGE với SAMPLES 0 cho kết quả chính xác (chậm hơn với key lớn). MEMORY DOCTOR gợi ý vấn đề." },
    { title: "3 · Gom key nhỏ", tab: "hash", highlight: [2, 6, 7, 9, 10], on: ["opt"],
      desc: "Một hash listpack 100 field thay cho 100 key riêng: bỏ overhead mỗi key. Luôn đo trước/sau." },
    { title: "4 · SLOWLOG", tab: "slow", highlight: [1, 3, 6, 7, 8], on: ["a2", "sl"],
      desc: "HGETALL trên big key tốn 84 ms — chính là thủ phạm bài 06. Có cả IP và client name để tìm service." },
    { title: "5 · Độ trễ ngoài lệnh", tab: "slow", highlight: [10, 11], on: ["lat"],
      desc: "fork, fsync AOF, expire cycle cũng gây trễ mà SLOWLOG không thấy. LATENCY DOCTOR tổng hợp." },
    { title: "6 · Bộ công cụ nhanh", tab: "cli", highlight: [1, 2, 5, 8, 10], on: ["lat", "cl"],
      desc: "latencystats cho p99 theo lệnh; intrinsic-latency phân biệt lỗi Redis với lỗi VM/OS." }
  ],

  quiz: [
    { q: "mem_fragmentation_ratio = 0,7 báo hiệu gì?", options: [
        "Bộ nhớ rất gọn", "Một phần bộ nhớ Redis đang bị swap ra đĩa — nguy hiểm", "Phân mảnh cao", "Không có ý nghĩa"
      ], correct: 1, explanation: "RSS nhỏ hơn used_memory nghĩa là có trang không nằm trong RAM." },
    { q: "SLOWLOG đo thời gian gì?", options: [
        "Tổng thời gian client chờ, gồm mạng", "Chỉ thời gian thực thi lệnh trên server", "Thời gian fork", "Thời gian fsync"
      ], correct: 1, explanation: "Không gồm mạng hay thời gian nằm trong hàng đợi." },
    { q: "Đơn vị của slowlog-log-slower-than?", options: [
        "Mili giây", "Micro giây", "Giây", "Nano giây"
      ], correct: 1, explanation: "Mặc định 10000 µs = 10 ms." },
    { q: "Vì sao gom 10 triệu key nhỏ vào các hash 100 field tiết kiệm RAM?", options: [
        "Hash được nén gzip", "Bỏ overhead mỗi key (dict entry, robj, SDS tên); hash nhỏ lưu listpack liên tục", "Redis bỏ bớt dữ liệu", "Vì hash không có TTL"
      ], correct: 1, explanation: "Nhớ giữ số field dưới ngưỡng listpack." },
    { q: "Đánh đổi khi gom key vào hash?", options: [
        "Không có", "Mất TTL riêng từng key (trừ HEXPIRE 7.4+) và phải tự tính bucket", "Không đọc được", "Chậm gấp 100"
      ], correct: 1, explanation: "Hợp với dữ liệu cùng vòng đời." },
    { q: "Lệnh nào KHÔNG nên để chạy lâu ở production?", options: [
        "INFO", "MONITOR", "SLOWLOG GET", "LATENCY LATEST"
      ], correct: 1, explanation: "MONITOR in mọi lệnh, giảm throughput đáng kể." },
    { q: "redis-cli --intrinsic-latency dùng để?", options: [
        "Đo RTT tới server", "Đo độ trễ nền của OS/VM trên chính máy chạy Redis", "Đo thời gian fsync", "Đo tốc độ đĩa"
      ], correct: 1, explanation: "Phải chạy trên máy chủ Redis." },
    { q: "Metric nào cho p99 latency theo từng lệnh (7.0+)?", options: [
        "INFO commandstats", "INFO latencystats", "SLOWLOG LEN", "INFO keyspace"
      ], correct: 1, explanation: "commandstats chỉ có trung bình." },
    { q: "CLIENT LIST thấy một client có omem hàng trăm MB. Nghĩa là?", options: [
        "Client gửi quá nhiều lệnh", "Output buffer lớn: client đọc chậm hoặc nhận reply khổng lồ (big key, pub/sub nghẽn)", "Client bị khoá", "Client dùng RESP3"
      ], correct: 1, explanation: "Có thể dẫn tới ngắt kết nối theo client-output-buffer-limit hoặc OOM." },
    { q: "activedefrag yes làm gì?", options: [
        "Restart Redis", "Dời dần dữ liệu để giảm phân mảnh khi đang chạy, có giới hạn CPU", "Xoá key hết hạn", "Nén RDB"
      ], correct: 1, explanation: "Cần jemalloc (mặc định trên Linux)." }
  ]
});
