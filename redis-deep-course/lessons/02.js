window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "Bên trong một key: dict, redisObject, SDS và encoding của String",
  subtitle: "Keyspace là một hash table · type vs encoding · int / embstr / raw · rehash tiến dần",

  theory: `
    <p>Mỗi database của Redis là một <strong>hash table</strong> (<code>dict</code>) ánh xạ <em>tên key</em> → <em>giá trị</em>. Giá trị được bọc trong
    <code>redisObject</code> (thường gọi <code>robj</code>, 16 byte):</p>
    <table>
      <tr><th>Trường</th><th>Ý nghĩa</th></tr>
      <tr><td><code>type</code> (4 bit)</td><td>Kiểu logic bạn thấy: string, list, hash, set, zset, stream...</td></tr>
      <tr><td><code>encoding</code> (4 bit)</td><td>Cách lưu vật lý thật sự: int, embstr, raw, listpack, quicklist, intset, hashtable, skiplist...</td></tr>
      <tr><td><code>lru</code> (24 bit)</td><td>Thời điểm truy cập (LRU) hoặc bộ đếm tần suất (LFU) — dùng cho eviction (bài 08)</td></tr>
      <tr><td><code>refcount</code>, <code>ptr</code></td><td>Đếm tham chiếu; con trỏ tới dữ liệu (hoặc chứa luôn số nguyên)</td></tr>
    </table>
    <p>Tách <em>type</em> khỏi <em>encoding</em> là ý tưởng trung tâm: cùng một hash, khi nhỏ Redis lưu dạng mảng nén liên tục (tiết kiệm RAM, cache-friendly),
    khi lớn tự chuyển sang hash table thật (O(1)). Giống như <code>HashMap</code> của Java 8 tự đổi bucket từ linked list sang cây đỏ-đen khi dài — nhưng Redis làm vì RAM.</p>

    <p><strong>SDS — Simple Dynamic String</strong> thay cho <code>char*</code> của C:</p>
    <ul>
      <li>Header lưu <code>len</code> và <code>alloc</code> → lấy độ dài O(1) (<code>STRLEN</code>), <strong>binary-safe</strong> (chứa được byte 0, ảnh, protobuf).</li>
      <li>Có dung lượng dự phòng → <code>APPEND</code> không phải realloc mỗi lần.</li>
      <li>Header có nhiều cỡ (sdshdr8/16/32/64) tuỳ độ dài để không phí byte.</li>
    </ul>

    <p><strong>3 encoding của String</strong></p>
    <table>
      <tr><th>Encoding</th><th>Khi nào</th><th>Đặc điểm</th></tr>
      <tr><td><code>int</code></td><td>Giá trị là số nguyên 64-bit (vd "12345")</td><td>Lưu thẳng trong <code>ptr</code>, không cấp phát chuỗi. Số 0–9999 dùng chung object (shared integers)</td></tr>
      <tr><td><code>embstr</code></td><td>Chuỗi ≤ 44 byte</td><td>robj + SDS trong <strong>một</strong> lần cấp phát (vừa 64 byte của jemalloc). Chỉ đọc</td></tr>
      <tr><td><code>raw</code></td><td>Chuỗi &gt; 44 byte, hoặc embstr bị sửa (<code>APPEND</code>, <code>SETRANGE</code>)</td><td>Hai lần cấp phát: robj và SDS riêng</td></tr>
    </table>

    <p><strong>Rehash tiến dần (incremental rehashing)</strong>: khi dict đầy, Redis cấp bảng mới gấp đôi nhưng <em>không</em> chuyển hết một lúc
    (10 triệu key sẽ chặn main thread). Nó giữ cả hai bảng, mỗi lệnh đọc/ghi dời thêm vài bucket, và serverCron dời thêm ~1 ms mỗi lượt.
    Trong lúc rehash, tìm key phải xem cả hai bảng. Đây là mẫu tư duy lặp lại khắp Redis: <em>chia việc lớn thành nhiều mẩu nhỏ</em>.</p>

    <div class="callout"><p>💡 Chi phí một key không chỉ là dữ liệu của bạn: còn entry của dict (~24 byte), robj (16), SDS của tên key, và nếu có TTL thì thêm một entry trong dict <code>expires</code>.
    100 triệu key nhỏ "user:123 → 1" có thể tốn vài GB chỉ cho overhead. Bài 23 sẽ dùng hash để gom lại.</p></div>
  `,

  codeTabs: [
    { id: "enc", label: "① OBJECT ENCODING", lines: [
      "127.0.0.1:6379> SET counter 12345",
      "127.0.0.1:6379> OBJECT ENCODING counter",
      "\"int\"",
      "127.0.0.1:6379> SET name \"Nguyen Van A\"",
      "127.0.0.1:6379> OBJECT ENCODING name",
      "\"embstr\"",
      "127.0.0.1:6379> APPEND name \" - Ha Noi\"",
      "127.0.0.1:6379> OBJECT ENCODING name",
      "\"raw\"            # sửa embstr -> luôn thành raw",
      "127.0.0.1:6379> SET big <chuỗi 45 byte>",
      "127.0.0.1:6379> OBJECT ENCODING big",
      "\"raw\""
    ]},
    { id: "robj", label: "② redisObject & SDS", lines: [
      "typedef struct redisObject {",
      "    unsigned type:4;       // OBJ_STRING, OBJ_LIST, OBJ_HASH ...",
      "    unsigned encoding:4;   // OBJ_ENCODING_INT, _EMBSTR, _RAW, _LISTPACK ...",
      "    unsigned lru:24;       // LRU clock hoặc LFU (8 bit đếm + 16 bit thời gian)",
      "    int refcount;",
      "    void *ptr;",
      "} robj;                   // 16 byte",
      "",
      "struct sdshdr8 { uint8_t len; uint8_t alloc; unsigned char flags; char buf[]; };",
      "// 16 (robj) + 3 (hdr8) + 44 + 1 ('\\0') = 64 byte -> đúng một size class jemalloc"
    ]},
    { id: "dict", label: "③ Rehash tiến dần", lines: [
      "dict {",
      "    ht_table[0]  // bảng cũ, 4 triệu bucket",
      "    ht_table[1]  // bảng mới, 8 triệu bucket",
      "    rehashidx    // bucket tiếp theo cần dời; -1 = không rehash",
      "}",
      "",
      "on GET/SET (key):",
      "    if rehashing: dictRehash(d, 1)        // dời 1 bucket",
      "    lookup ht_table[0], nếu không có -> ht_table[1]",
      "",
      "serverCron: dictRehashMicroseconds(d, 1000)   // dời thêm trong ~1ms"
    ]},
    { id: "java", label: "④ So với Java", lines: [
      "// Java: HashMap<String, Object>",
      "//   resize() dời TOÀN BỘ entry một lần -> một put() có thể rất chậm",
      "//   String: object header 12-16 byte + byte[] + hash cache",
      "",
      "// Redis:",
      "//   rehash chia nhỏ theo từng lệnh -> latency đều",
      "//   embstr gộp object + chuỗi trong 1 allocation",
      "//   số nguyên nhỏ lưu thẳng trong con trỏ, không cấp phát"
    ]}
  ],

  stageHtml: `
    <div class="node" id="db"><div class="nl">🗂️ db[0] — dict</div><div class="ns">"counter" → robj</div></div>
    <div class="arrow" id="a1">↓ tra hash table O(1)</div>
    <div class="node" id="ro"><div class="nl">📦 redisObject</div><div class="ns">type=string · encoding=?</div></div>
    <div class="row">
      <div class="node" id="i"><div class="nl">int</div><div class="ns">12345 nằm trong ptr</div></div>
      <div class="node" id="e"><div class="nl">embstr</div><div class="ns">≤ 44 byte, 1 allocation</div></div>
      <div class="node" id="r"><div class="nl">raw</div><div class="ns">&gt; 44 byte / đã sửa</div></div>
    </div>
    <div class="arrow" id="a2">↓ bảng đầy</div>
    <div class="node" id="rh"><div class="nl">🔁 Rehash tiến dần</div><div class="ns">2 bảng song song, dời dần từng bucket</div></div>
  `,
  steps: [
    { title: "1 · Keyspace là một dict", tab: "dict", highlight: [1, 2], on: ["db", "a1"],
      desc: "Tìm key là tra hash table: O(1) trung bình, bất kể DB có 1 nghìn hay 100 triệu key." },
    { title: "2 · Giá trị bọc trong robj", tab: "robj", highlight: [2, 3, 4, 7], on: ["ro"],
      desc: "type là thứ TYPE trả về; encoding là thứ OBJECT ENCODING trả về. Cùng type có thể nhiều encoding." },
    { title: "3 · Số nguyên → int", tab: "enc", highlight: [1, 2, 3], on: ["i"],
      desc: "\"12345\" được lưu thành số 64-bit ngay trong ptr. INCR thao tác trực tiếp, không parse chuỗi." },
    { title: "4 · Chuỗi ngắn → embstr, sửa → raw", tab: "enc", highlight: [4, 6, 7, 9], on: ["e", "r"],
      desc: "embstr gọn trong 64 byte nhưng bất biến; APPEND buộc chuyển sang raw (robj và SDS tách rời)." },
    { title: "5 · Bảng đầy: rehash từng chút", tab: "dict", highlight: [3, 4, 8, 11], on: ["a2", "rh"],
      desc: "Không dời một lần. Mỗi lệnh dời 1 bucket, cron dời thêm ~1ms. Latency không bị giật." }
  ],

  quiz: [
    { q: "Lệnh nào cho biết cách Redis LƯU vật lý một giá trị?", options: [
        "TYPE key", "OBJECT ENCODING key", "DEBUG SLEEP", "MEMORY DOCTOR"
      ], correct: 1, explanation: "TYPE trả kiểu logic; OBJECT ENCODING trả encoding thật (int, embstr, listpack...)." },
    { q: "SET k 42 rồi OBJECT ENCODING k trả gì?", options: [
        "\"raw\"", "\"embstr\"", "\"int\"", "\"listpack\""
      ], correct: 2, explanation: "Chuỗi biểu diễn được số nguyên 64-bit được lưu dạng int." },
    { q: "Chuỗi 30 byte vừa SET, rồi APPEND thêm 5 byte. Encoding cuối cùng?", options: [
        "embstr", "raw", "int", "Giữ nguyên như lúc SET"
      ], correct: 1, explanation: "embstr là bất biến; mọi thao tác sửa tại chỗ chuyển nó sang raw, kể cả khi vẫn ≤ 44 byte." },
    { q: "Vì sao ngưỡng embstr là 44 byte?", options: [
        "Giới hạn của giao thức RESP", "Để robj + header SDS + chuỗi + '\\0' vừa khít 64 byte (một size class của jemalloc)",
        "Vì cache line CPU là 44 byte", "Do chuẩn UTF-8"
      ], correct: 1, explanation: "16 + 3 + 44 + 1 = 64." },
    { q: "Lợi ích của SDS so với chuỗi C thuần?", options: [
        "Tự nén dữ liệu", "Độ dài O(1), binary-safe, có dung lượng dự phòng cho append", "Mã hoá sẵn", "Lưu trên đĩa"
      ], correct: 1, explanation: "Chuỗi C phải strlen O(n) và không chứa được byte 0." },
    { q: "Khi dict chính cần mở rộng, Redis làm gì?", options: [
        "Dừng server và dời toàn bộ key sang bảng mới",
        "Giữ hai bảng, dời dần từng bucket qua mỗi lệnh và trong serverCron",
        "Fork tiến trình con để rehash", "Không bao giờ mở rộng, chỉ nối chuỗi dài hơn"
      ], correct: 1, explanation: "Incremental rehashing giúp tránh một lần dừng dài." },
    { q: "Trong lúc rehash, GET một key sẽ tìm ở đâu?", options: [
        "Chỉ bảng mới", "Chỉ bảng cũ", "Bảng cũ, không thấy thì tìm bảng mới", "Trong file RDB"
      ], correct: 2, explanation: "Key có thể đang nằm ở một trong hai bảng." },
    { q: "Trường lru 24 bit trong redisObject dùng cho việc gì?", options: [
        "Lưu TTL", "Lưu thời điểm truy cập (LRU) hoặc bộ đếm tần suất (LFU) phục vụ eviction", "Lưu độ dài chuỗi", "Lưu số hash slot"
      ], correct: 1, explanation: "TTL lưu riêng trong dict expires, không nằm trong robj." },
    { q: "Vì sao 100 triệu key rất nhỏ có thể tốn RAM nhiều hơn tổng dữ liệu thật?", options: [
        "Vì Redis nén kém", "Mỗi key có overhead cố định: entry dict, robj, SDS tên key, và entry expires nếu có TTL",
        "Vì Redis lưu 2 bản mỗi key", "Vì RDB"
      ], correct: 1, explanation: "Overhead vài chục byte/key nhân 100 triệu là vài GB." }
  ]
});
