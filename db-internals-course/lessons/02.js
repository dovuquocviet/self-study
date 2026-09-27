window.LESSONS.push({
  id: "02",
  phase: "1", phaseName: "Nền tảng lưu trữ",
  title: "Page & buffer pool — vì sao DB đọc theo khối",
  subtitle: "Đĩa chậm hơn RAM hàng trăm lần · page 8 KB · cache hit ratio · double buffering",

  theory: `
    <p>Mọi DB bền vững đều giải cùng một bài toán: dữ liệu nằm trên đĩa (chậm), còn CPU chỉ làm việc với RAM (nhanh).
    Thiết kế cả engine xoay quanh việc <strong>giảm số lần chạm đĩa</strong>.</p>

    <table>
      <tr><th>Thao tác</th><th>Độ trễ cỡ</th></tr>
      <tr><td>Đọc RAM</td><td>~100 ns</td></tr>
      <tr><td>Đọc ngẫu nhiên 4 KB từ SSD NVMe</td><td>~20–100 µs (chậm hơn RAM vài trăm lần)</td></tr>
      <tr><td>Seek + đọc HDD</td><td>~5–10 ms</td></tr>
      <tr><td>Round-trip mạng trong cùng datacenter</td><td>~0.5 ms</td></tr>
    </table>

    <p><strong>Page (trang)</strong> là đơn vị đọc/ghi nhỏ nhất của engine: PostgreSQL 8 KB, InnoDB (MySQL) 16 KB, WiredTiger (MongoDB) có page kích thước thay đổi.
    Muốn đọc một dòng 100 byte, DB vẫn nạp nguyên page chứa nó. Vì thế <em>dữ liệu hay được đọc cùng nhau nên nằm cùng page</em> — đó là gốc rễ của
    clustering, của mô hình cột, và của việc nhúng document trong MongoDB.</p>

    <p><strong>Bố cục một heap page của PostgreSQL</strong>: header 24 byte → mảng <em>line pointer</em> (4 byte mỗi cái) mọc từ đầu → khoảng trống → các tuple mọc từ cuối lên.
    Địa chỉ vật lý của một dòng là <code>ctid = (số block, số thứ tự line pointer)</code>, ví dụ <code>(0,3)</code>. Index B-tree trỏ tới ctid, không trỏ tới "id".</p>

    <p><strong>Buffer pool</strong> là vùng RAM do DB tự quản lý, chứa bản sao các page:</p>
    <ul>
      <li>Cần page → tìm trong buffer pool (<strong>hit</strong>) → không có thì đọc từ đĩa (<strong>miss</strong>), phải đuổi một page khác nếu đầy.</li>
      <li>Sửa dòng → sửa page trong RAM, đánh dấu <strong>dirty</strong>. Page dirty được ghi xuống đĩa <em>sau</em> (bởi checkpointer/background writer), không phải ngay lúc COMMIT — độ bền lúc commit do WAL lo (bài 03).</li>
      <li>Thuật toán đuổi: PostgreSQL dùng <em>clock-sweep</em> (xấp xỉ LRU, có bộ đếm usage), InnoDB dùng LRU chia hai đoạn để một lần quét bảng lớn không xoá sạch cache.</li>
    </ul>

    <p><strong>Mỗi engine dùng RAM khác nhau</strong></p>
    <ul>
      <li>PostgreSQL: <code>shared_buffers</code> (mặc định 128 MB, thường đặt ~25% RAM) <em>cộng</em> page cache của hệ điều hành → một page có thể nằm 2 nơi (double buffering).</li>
      <li>MongoDB WiredTiger: cache riêng mặc định ~50% của (RAM − 1 GB); dữ liệu trong cache ở dạng giải nén.</li>
      <li>Elasticsearch, ClickHouse, Kafka: dựa nhiều vào page cache của OS; vì vậy ES khuyên heap JVM không quá ~50% RAM, phần còn lại để OS cache file.</li>
      <li>Redis: toàn bộ dữ liệu nằm trong RAM; đĩa chỉ để persistence.</li>
    </ul>

    <div class="callout"><p>💡 Khi query "tự nhiên chậm" sau khi deploy, hãy hỏi: working set (phần dữ liệu hay dùng) còn vừa RAM không?
    Vượt ngưỡng đó là mỗi truy vấn biến thành đọc đĩa, độ trễ tăng hàng chục lần dù code không đổi.</p></div>
  `,

  codeTabs: [
    { id: "page", label: "Bố cục page 8 KB", lines: [
      "+------------------------------------------------+  offset 0",
      "| PageHeader (24 byte: LSN, checksum, lower, upper)|",
      "| lp1 | lp2 | lp3 | ...  → line pointer 4 byte     |  lower",
      "|                                                  |",
      "|            (khoảng trống tự do)                  |",
      "|                                                  |  upper",
      "| ... tuple3 | tuple2 | tuple1  ← tuple mọc ngược   |",
      "| special space (dùng cho page index)              |",
      "+------------------------------------------------+  8192",
      "",
      "# ctid (0,3) = block 0, line pointer số 3 → trỏ tới tuple3"
    ]},
    { id: "sql", label: "Soi page bằng SQL", lines: [
      "SELECT ctid, id, name FROM users LIMIT 3;",
      "-- (0,1) | 1 | An",
      "-- (0,2) | 2 | Bình",
      "-- (0,3) | 3 | Chi",
      "",
      "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE id = 42;",
      "--  Index Scan using users_pkey on users ...",
      "--    Buffers: shared hit=3 read=1",
      "-- hit = page có sẵn trong shared_buffers, read = phải đọc từ OS/đĩa"
    ]},
    { id: "ratio", label: "Cache hit ratio", lines: [
      "SELECT sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0)",
      "       AS hit_pct",
      "FROM pg_stat_database;",
      "",
      "-- OLTP khoẻ mạnh thường > 99%.",
      "-- Lưu ý: 'read' có thể vẫn trúng page cache của OS (double buffering)."
    ]},
    { id: "conf", label: "Cấu hình RAM", lines: [
      "# postgresql.conf",
      "shared_buffers = 4GB            # ~25% RAM máy 16 GB",
      "effective_cache_size = 12GB     # gợi ý cho planner: OS cache được bao nhiêu",
      "",
      "# mongod.conf",
      "storage.wiredTiger.engineConfig.cacheSizeGB: 7   # mặc định ~50% (RAM - 1GB)",
      "",
      "# Elasticsearch jvm.options: heap <= 50% RAM, để phần còn lại cho OS cache",
      "-Xms8g",
      "-Xmx8g"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔍 Query cần dòng id=42</div><div class="ns">index → ctid (7,2)</div></div>
    <div class="arrow" id="a1">↓ cần page số 7</div>
    <div class="node" id="bp"><div class="nl">🧠 Buffer pool (RAM)</div><div class="ns">có page 7 không?</div></div>
    <div class="row">
      <div class="node" id="hit"><div class="nl">✅ Hit</div><div class="ns">~100 ns</div></div>
      <div class="node" id="miss"><div class="nl">❌ Miss</div><div class="ns">đuổi page cũ, đọc đĩa</div></div>
    </div>
    <div class="arrow" id="a2">↓ sửa dòng → page dirty</div>
    <div class="node" id="disk"><div class="nl">💾 Đĩa</div><div class="ns">checkpointer ghi page dirty sau</div></div>
  `,
  steps: [
    { title: "1 · Đơn vị là page, không phải dòng", tab: "page", highlight: [1, 3, 7, 9, 11], on: ["q"],
      desc: "Dòng nằm trong page 8 KB. Index trỏ tới <code>ctid</code> = (block, line pointer)." },
    { title: "2 · Tìm trong buffer pool", tab: "sql", highlight: [6, 8], on: ["a1", "bp"],
      desc: "<code>Buffers: shared hit=3 read=1</code>: 3 page có sẵn trong RAM, 1 page phải đọc thêm." },
    { title: "3 · Hit hay miss", tab: "sql", highlight: [9], on: ["hit", "miss"],
      desc: "Miss là trả giá hàng trăm lần. Buffer pool đầy thì phải đuổi page ít dùng (clock-sweep)." },
    { title: "4 · Sửa trong RAM, ghi đĩa sau", tab: "page", highlight: [2], on: ["a2", "disk"],
      desc: "Page dirty không ghi ngay lúc COMMIT. LSN trong header cho biết page đã phản ánh WAL tới đâu." },
    { title: "5 · Đo và cấu hình", tab: "ratio", highlight: [1, 2, 3, 5, 6], on: ["bp"],
      desc: "Theo dõi tỉ lệ hit; working set vượt RAM là dấu hiệu cần thêm RAM, index tốt hơn, hoặc giảm dữ liệu nóng." }
  ],

  quiz: [
    { q: "Page mặc định của PostgreSQL lớn bao nhiêu?", options: ["4 KB", "8 KB", "16 KB", "64 KB"], correct: 1,
      explanation: "PostgreSQL 8 KB (đổi được khi build). InnoDB mặc định 16 KB." },
    { q: "Muốn đọc một dòng 100 byte, PostgreSQL nạp gì vào RAM?", options: [
        "Đúng 100 byte", "Nguyên page chứa dòng đó", "Cả bảng", "Chỉ cột được SELECT"
      ], correct: 1, explanation: "Page là đơn vị I/O nhỏ nhất của engine." },
    { q: "ctid (7,2) nghĩa là gì?", options: [
        "id = 7, version = 2", "Block 7, line pointer số 2 trong block đó", "Transaction 7, câu lệnh 2", "Shard 7, replica 2"
      ], correct: 1, explanation: "ctid là địa chỉ vật lý của tuple; nó đổi khi dòng bị UPDATE (bài MVCC)." },
    { q: "Trong EXPLAIN (ANALYZE, BUFFERS), 'shared read=1' nghĩa là?", options: [
        "1 page có sẵn trong shared_buffers",
        "1 page không có trong shared_buffers, phải lấy từ OS (page cache hoặc đĩa)",
        "1 dòng được đọc",
        "1 lần lock"
      ], correct: 1, explanation: "hit = trúng shared_buffers; read = phải gọi OS, có thể vẫn trúng page cache của OS." },
    { q: "Khi COMMIT, page dirty có bắt buộc được ghi xuống đĩa ngay không?", options: [
        "Có, luôn ghi ngay",
        "Không; độ bền lúc commit do WAL đảm bảo, page được ghi sau bởi checkpointer/bgwriter",
        "Không bao giờ ghi",
        "Chỉ khi tắt máy"
      ], correct: 1, explanation: "Ghi page ngẫu nhiên đắt; WAL ghi tuần tự nên rẻ hơn — xem bài 03." },
    { q: "'Double buffering' ở PostgreSQL là gì?", options: [
        "Mỗi dòng lưu 2 lần trong bảng",
        "Một page có thể nằm đồng thời trong shared_buffers và page cache của hệ điều hành",
        "Hai replica cùng lúc",
        "Hai WAL song song"
      ], correct: 1, explanation: "PostgreSQL đọc qua OS (không dùng O_DIRECT mặc định), nên page cache OS cũng giữ bản sao." },
    { q: "Vì sao Elasticsearch khuyên heap JVM không vượt ~50% RAM?", options: [
        "Vì JVM không dùng được RAM lớn",
        "Để phần RAM còn lại cho page cache của OS giữ file index Lucene",
        "Vì Redis cần phần còn lại",
        "Vì giấy phép"
      ], correct: 1, explanation: "Lucene đọc segment qua file hệ thống; cache của OS là 'buffer pool' thực tế của ES." },
    { q: "Truy vấn đột nhiên chậm gấp chục lần dù code không đổi, dữ liệu tăng dần. Giả thuyết đầu tiên hợp lý?", options: [
        "CPU hỏng",
        "Working set đã vượt RAM → cache miss tăng, truy vấn chạm đĩa",
        "Mạng Internet chậm",
        "Java GC"
      ], correct: 1, explanation: "Kiểm tra hit ratio và Buffers trong EXPLAIN để xác nhận." },
    { q: "Thuật toán đuổi page của PostgreSQL shared_buffers?", options: [
        "FIFO thuần", "Clock-sweep (xấp xỉ LRU với bộ đếm usage)", "Random", "Không đuổi, tăng RAM vô hạn"
      ], correct: 1, explanation: "Clock-sweep rẻ hơn LRU chính xác nhưng vẫn giữ page hay dùng." }
  ]
});
