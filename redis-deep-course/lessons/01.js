window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Redis chạy thế nào: một luồng, event loop và vì sao nhanh",
  subtitle: "Single-threaded command execution · epoll · I/O threads · background threads",

  theory: `
    <p>Trong Spring bạn quen mô hình <strong>thread-per-request</strong>: Tomcat có pool ~200 thread, mỗi request một thread, dữ liệu chung phải khoá
    (<code>synchronized</code>, <code>ConcurrentHashMap</code>). Redis làm ngược lại: <strong>mọi lệnh được thực thi tuần tự trên một luồng chính</strong>.
    Không có khoá, không có context switch giữa các lệnh — và mỗi lệnh là <em>nguyên tử</em> một cách tự nhiên.</p>

    <p><strong>Event loop (ae)</strong> — vòng lặp của luồng chính:</p>
    <ol>
      <li>Gọi <code>epoll_wait</code> (Linux; macOS là <code>kqueue</code>) để hỏi kernel: socket nào đã có dữ liệu đọc / sẵn sàng ghi?</li>
      <li>Với mỗi socket có dữ liệu: đọc byte vào buffer của client, <strong>parse RESP</strong> thành lệnh.</li>
      <li>Thực thi lệnh trên cấu trúc dữ liệu trong RAM (thường vài trăm nano-giây đến vài micro-giây).</li>
      <li>Ghi kết quả vào buffer trả về; trước lần <code>epoll_wait</code> kế tiếp (<code>beforeSleep</code>) thì flush ra socket.</li>
      <li>Xen giữa là <strong>time event</strong> <code>serverCron</code> chạy <code>hz</code> lần/giây (mặc định 10): xoá key hết hạn, đếm thống kê, kiểm tra rewrite AOF...</li>
    </ol>

    <p><strong>Vì sao một luồng mà vẫn ~100k–1M ops/s?</strong></p>
    <ul>
      <li>Dữ liệu nằm hết trong RAM, cấu trúc được tối ưu (bài 02–05). Nút cổ chai thường là <strong>mạng và syscall</strong>, không phải CPU.</li>
      <li>I/O multiplexing: một luồng phục vụ hàng chục nghìn kết nối, không block trên socket nào.</li>
      <li>Không khoá, không false sharing, cache CPU nóng.</li>
    </ul>

    <p><strong>Nhưng không phải chỉ có một thread.</strong></p>
    <table>
      <tr><th>Thread</th><th>Làm gì</th></tr>
      <tr><td>Main thread</td><td>Thực thi <em>mọi</em> lệnh — điểm duy nhất chạm vào dataset</td></tr>
      <tr><td>I/O threads (<code>io-threads N</code>, từ 6.0)</td><td>Đọc/parse request và ghi response song song. Redis 8.0 viết lại: mỗi client gắn với một I/O thread. Lệnh vẫn chạy trên main thread</td></tr>
      <tr><td>bio threads</td><td>Việc chậm chạy nền: <code>close()</code> file, <code>fsync</code> AOF, giải phóng bộ nhớ khi <code>UNLINK</code>/<code>FLUSHALL ASYNC</code> (lazyfree)</td></tr>
      <tr><td>Tiến trình con (fork)</td><td>BGSAVE (RDB), BGREWRITEAOF — bài 09–10</td></tr>
    </table>

    <p><strong>Hệ quả quan trọng nhất</strong>: một lệnh chậm (<code>KEYS *</code>, <code>HGETALL</code> trên hash 5 triệu field, script Lua lặp lâu) <strong>chặn toàn bộ server</strong>.
    Trong Tomcat một request chậm chỉ chiếm một thread; trong Redis nó làm <em>tất cả</em> client khác chờ. Đây là lý do cả khoá này nói nhiều về độ phức tạp lệnh.</p>

    <div class="callout"><p>💡 Bật I/O threads chỉ có ích khi CPU của main thread bị ăn bởi syscall đọc/ghi mạng (nhiều client, payload lớn, &gt; vài trăm nghìn ops/s).
    Nó không làm một lệnh O(N) chạy nhanh hơn. Muốn mở rộng tính toán thật sự thì phải <strong>chia dữ liệu</strong> ra nhiều node (Cluster, bài 13).</p></div>
  `,

  codeTabs: [
    { id: "loop", label: "① Event loop (giả mã)", lines: [
      "// Rút gọn từ ae.c / server.c",
      "while (!stop) {",
      "    beforeSleep();                 // flush reply, fsync AOF (everysec), xử lý lazyfree",
      "    n = epoll_wait(epfd, events, max, timeout_until_next_timer);",
      "    for (i = 0; i < n; i++) {",
      "        if (events[i] readable) readQueryFromClient(c);   // đọc + parse RESP",
      "        // processCommand(c) -> call(c) : thực thi TRÊN MAIN THREAD",
      "        if (events[i] writable) writeToClient(c);",
      "    }",
      "    processTimeEvents();           // serverCron: hz lần/giây",
      "}"
    ]},
    { id: "resp", label: "② RESP trên dây", lines: [
      "# Client gửi SET user:1 alice  (RESP2 = mảng bulk string)",
      "*3\\r\\n$3\\r\\nSET\\r\\n$6\\r\\nuser:1\\r\\n$5\\r\\nalice\\r\\n",
      "",
      "# Server trả",
      "+OK\\r\\n",
      "",
      "# Kiểu reply: + simple string, - error, : integer, $ bulk, * array",
      "# RESP3 (HELLO 3) thêm map %, set ~, double ,, push > ..."
    ]},
    { id: "conf", label: "③ redis.conf", lines: [
      "hz 10                      # tần suất serverCron",
      "io-threads 4               # 1 = tắt; đặt < số core, chừa core cho main thread",
      "lazyfree-lazy-eviction yes # giải phóng bộ nhớ trên bio thread",
      "lazyfree-lazy-expire yes",
      "lazyfree-lazy-user-del yes # DEL hành xử như UNLINK",
      "",
      "# Đo nhanh:",
      "redis-benchmark -t set,get -n 1000000 -P 16 -q"
    ]},
    { id: "java", label: "④ So với Tomcat", lines: [
      "// Spring MVC: 200 thread, mỗi request một thread",
      "@GetMapping(\"/stock\")",
      "int stock() { return counter.incrementAndGet(); }  // cần AtomicInteger/khoá",
      "",
      "// Redis: INCR stock  -> tuần tự trên main thread, tự nhiên nguyên tử",
      "// 1000 client gửi INCR cùng lúc -> kết quả chính xác 1000, không cần khoá",
      "",
      "// Cái giá: 1 lệnh chạy 2 giây = MỌI client chờ 2 giây"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="c1"><div class="nl">👤 Client A</div><div class="ns">SET</div></div>
      <div class="node" id="c2"><div class="nl">👤 Client B</div><div class="ns">INCR</div></div>
      <div class="node" id="c3"><div class="nl">👤 Client C</div><div class="ns">KEYS *</div></div>
    </div>
    <div class="arrow" id="a1">↓ socket có dữ liệu → epoll_wait trả về</div>
    <div class="node" id="io"><div class="nl">🧵 Đọc + parse RESP</div><div class="ns">main thread hoặc I/O threads</div></div>
    <div class="arrow" id="a2">↓ hàng đợi lệnh</div>
    <div class="node" id="main"><div class="nl">⚙️ Main thread thực thi từng lệnh</div><div class="ns">không khoá · nguyên tử</div></div>
    <div class="arrow" id="a3">↓ reply buffer</div>
    <div class="node" id="bio"><div class="nl">🗑️ bio / fork</div><div class="ns">fsync, lazyfree, BGSAVE</div></div>
  `,
  steps: [
    { title: "1 · Nhiều client, một vòng lặp", tab: "loop", highlight: [2, 4], on: ["c1", "c2", "c3", "a1"],
      desc: "epoll_wait trả về danh sách socket sẵn sàng. Một luồng phục vụ hàng chục nghìn kết nối." },
    { title: "2 · Đọc và parse RESP", tab: "resp", highlight: [2, 5], on: ["io"],
      desc: "Giao thức text đơn giản, parse rất rẻ. Phần này có thể giao cho I/O threads." },
    { title: "3 · Thực thi tuần tự", tab: "loop", highlight: [6, 7], on: ["a2", "main"],
      desc: "Mọi lệnh chạm dataset chạy trên main thread theo thứ tự → không cần khoá, mỗi lệnh nguyên tử." },
    { title: "4 · Việc nặng đẩy ra ngoài", tab: "conf", highlight: [3, 4, 5], on: ["a3", "bio"],
      desc: "Giải phóng bộ nhớ lớn, fsync, snapshot được giao cho bio thread hoặc tiến trình con để main thread không bị chặn." },
    { title: "5 · Cái giá của một luồng", tab: "java", highlight: [5, 6, 8], on: ["c3", "main"],
      desc: "Client C gửi KEYS * trên 10 triệu key → main thread bận vài giây, A và B đứng chờ dù lệnh của họ chỉ tốn 1 µs." }
  ],

  quiz: [
    { q: "Trong Redis (kể cả 6.x/7.x/8.x có io-threads), lệnh được THỰC THI trên đâu?", options: [
        "Mỗi client một thread riêng", "Một thread pool chia theo key", "Main thread duy nhất", "Tiến trình con fork ra"
      ], correct: 2, explanation: "I/O threads chỉ đọc/parse/ghi socket; thực thi lệnh vẫn tuần tự trên main thread." },
    { q: "Vì sao INCR trên Redis nguyên tử mà không cần khoá?", options: [
        "Redis dùng CAS ở tầng CPU", "Lệnh được thực thi tuần tự trên một luồng, không có lệnh nào chen giữa",
        "Client tự khoá trước khi gửi", "Redis dùng MVCC"
      ], correct: 1, explanation: "Không có hai lệnh chạy song song trên dataset nên từng lệnh tự nhiên nguyên tử." },
    { q: "Nút cổ chai thường gặp nhất của Redis khi tải cao là gì?", options: [
        "Tính toán trên CPU cho từng lệnh", "Đĩa cứng", "Mạng và syscall đọc/ghi socket", "Garbage collector"
      ], correct: 2, explanation: "Lệnh trong RAM rất rẻ; chi phí chủ yếu là round-trip và syscall. Đó là lý do có pipelining và I/O threads." },
    { q: "Client gửi một lệnh O(N) chạy 3 giây. Điều gì xảy ra với các client khác?", options: [
        "Không ảnh hưởng, họ được phục vụ song song", "Họ đều phải chờ tới khi lệnh đó xong",
        "Redis tự huỷ lệnh sau 1 giây", "Chỉ client cùng database bị chờ"
      ], correct: 1, explanation: "Main thread bận thì không lệnh nào khác được thực thi." },
    { q: "Bật io-threads 8 có làm HGETALL trên hash 5 triệu field nhanh hơn không?", options: [
        "Có, nhanh gấp 8", "Không, việc duyệt hash vẫn chạy trên main thread", "Có, nếu bật io-threads-do-reads", "Chỉ nhanh hơn trên macOS"
      ], correct: 1, explanation: "I/O threads không song song hoá việc thực thi lệnh." },
    { q: "serverCron chạy bao nhiêu lần mỗi giây với cấu hình mặc định?", options: [
        "1", "10 (hz 10)", "100", "1000"
      ], correct: 1, explanation: "hz mặc định 10; có thể tăng (tối đa 500) để xử lý expire/timeouts dày hơn, đổi lại tốn CPU." },
    { q: "Việc nào KHÔNG được làm trên main thread mà giao cho bio thread?", options: [
        "Thực thi INCR", "Parse lệnh MULTI", "Giải phóng bộ nhớ của key lớn khi UNLINK", "Tính hash slot"
      ], correct: 2, explanation: "Lazyfree đẩy việc free() bộ nhớ lớn sang bio thread để không chặn main thread." },
    { q: "Linux dùng cơ chế gì để một luồng Redis theo dõi hàng nghìn socket?", options: [
        "select với mỗi socket một thread", "epoll", "Busy polling từng socket", "signal SIGIO"
      ], correct: 1, explanation: "ae dùng epoll trên Linux, kqueue trên BSD/macOS, select làm dự phòng." },
    { q: "Muốn tăng năng lực XỬ LÝ lệnh vượt quá một core, cách đúng là gì?", options: [
        "Tăng io-threads lên 64", "Tăng hz", "Chia dữ liệu ra nhiều shard (Redis Cluster / nhiều instance)", "Chạy nhiều database 0–15"
      ], correct: 2, explanation: "Mỗi shard là một main thread riêng; nhiều database trong một instance vẫn dùng chung một main thread." }
  ]
});
