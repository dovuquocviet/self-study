window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Cấu trúc dữ liệu & encoding",
  title: "Bitmap, HyperLogLog và Geo — ba kiểu 'giả'",
  subtitle: "Bitmap là String · HLL đếm unique với 12 KB · Geo là ZSET với score geohash",

  theory: `
    <p>Ba kiểu này không có cấu trúc riêng mà <strong>xây trên kiểu có sẵn</strong>. Biết điều đó giúp bạn đoán đúng chi phí và giới hạn.</p>

    <p><strong>1. Bitmap = String</strong></p>
    <ul>
      <li><code>SETBIT key offset 0|1</code> thao tác trên từng bit của một String (tối đa 512 MB = 2^32 bit).</li>
      <li>Hợp khi ID là số nguyên dày đặc: "user ID 0..10 triệu đã đăng nhập hôm nay?" → 10 triệu bit = <strong>1,25 MB</strong>. Cùng dữ liệu bằng Set số nguyên tốn hàng trăm MB.</li>
      <li><code>BITCOUNT</code> (đếm bit 1), <code>BITOP AND/OR/XOR</code> (giao/hợp nhiều ngày), <code>BITPOS</code> (bit 1 đầu tiên).</li>
      <li>Bẫy: <code>SETBIT k 4000000000 1</code> trên key mới sẽ cấp phát ngay ~500 MB. ID thưa (UUID, snowflake) → không dùng bitmap.</li>
      <li><code>BITFIELD</code>: coi String như mảng số nguyên nhiều độ rộng (u8, i16...), có <code>OVERFLOW SAT/WRAP/FAIL</code>.</li>
    </ul>

    <p><strong>2. HyperLogLog = String ≤ 12 KB</strong></p>
    <ul>
      <li>Ước lượng <strong>số phần tử khác nhau</strong> (cardinality) với sai số chuẩn <strong>0,81%</strong> và bộ nhớ tối đa ~12 KB, bất kể 1 nghìn hay 1 tỷ phần tử.</li>
      <li>Ý tưởng: băm phần tử, dùng 14 bit đầu chọn 1 trong 16 384 thanh ghi, phần còn lại đếm số bit 0 liên tiếp; lưu giá trị lớn nhất (6 bit/thanh ghi). Chuỗi 0 dài hiếm → nhiều phần tử khác nhau.</li>
      <li>Khi ít phần tử, dùng encoding <em>sparse</em> nhỏ hơn nhiều; lớn lên tự chuyển <em>dense</em> 12 KB.</li>
      <li><code>PFADD</code>, <code>PFCOUNT</code> (có thể nhiều key → đếm hợp), <code>PFMERGE</code>. <strong>Không</strong> liệt kê được phần tử, <strong>không</strong> hỏi được "X đã có chưa".</li>
    </ul>

    <p><strong>3. Geo = Sorted Set</strong></p>
    <ul>
      <li><code>GEOADD</code> đổi (kinh độ, vĩ độ) thành geohash 52 bit, dùng làm <em>score</em> của ZSET. Điểm gần nhau thường có geohash gần nhau.</li>
      <li><code>GEOSEARCH</code> (6.2+) quét 9 ô geohash quanh tâm rồi lọc theo khoảng cách thật. <code>GEORADIUS</code> cũ đã deprecated.</li>
      <li>Vì là ZSET nên xoá điểm bằng <code>ZREM</code>, đếm bằng <code>ZCARD</code>.</li>
      <li>Thứ tự tham số là <strong>kinh độ trước, vĩ độ sau</strong> — nhầm là lỗi kinh điển.</li>
    </ul>

    <table>
      <tr><th>Bài toán</th><th>Chọn</th><th>RAM (10 triệu user)</th></tr>
      <tr><td>DAU chính xác, ID số liên tục</td><td>Bitmap</td><td>~1,25 MB/ngày</td></tr>
      <tr><td>Số visitor unique, ID là chuỗi, chấp nhận ±1%</td><td>HyperLogLog</td><td>≤ 12 KB</td></tr>
      <tr><td>Cần biết chính xác ai, kiểm tra thành viên</td><td>Set</td><td>hàng trăm MB</td></tr>
      <tr><td>Cửa hàng trong bán kính 3 km</td><td>Geo</td><td>như ZSET</td></tr>
    </table>

    <div class="callout"><p>💡 Redis 8 gộp các module trước đây (RedisBloom: Bloom/Cuckoo filter, Count-Min Sketch, Top-K; RedisJSON; RediSearch; TimeSeries) vào bản phân phối chính.
    Nếu cần "X đã từng xuất hiện chưa" với RAM nhỏ thì Bloom filter mới là công cụ, không phải HLL.</p></div>
  `,

  codeTabs: [
    { id: "bit", label: "① Bitmap DAU", lines: [
      "SETBIT dau:2026-09-27 1042 1          # user 1042 hoạt động hôm nay",
      "GETBIT dau:2026-09-27 1042            # 1",
      "BITCOUNT dau:2026-09-27               # DAU",
      "",
      "# Hoạt động cả 7 ngày:",
      "BITOP AND active7 dau:2026-09-21 dau:2026-09-22 ... dau:2026-09-27",
      "BITCOUNT active7",
      "",
      "STRLEN dau:2026-09-27                 # byte = (offset lớn nhất / 8) + 1"
    ]},
    { id: "hll", label: "② HyperLogLog", lines: [
      "PFADD uv:home:2026-09-27 \"sess-a1\" \"sess-b7\" \"sess-a1\"",
      "PFCOUNT uv:home:2026-09-27            # 2 (ước lượng)",
      "PFCOUNT uv:home:2026-09-26 uv:home:2026-09-27   # unique của cả 2 ngày",
      "PFMERGE uv:home:week uv:home:2026-09-21 uv:home:2026-09-27",
      "MEMORY USAGE uv:home:week             # ≤ ~12 KB",
      "",
      "# 16384 thanh ghi x 6 bit = 12288 byte; sai số chuẩn 1.04/sqrt(16384) = 0.81%"
    ]},
    { id: "geo", label: "③ Geo", lines: [
      "GEOADD stores 105.8342 21.0278 hoankiem 105.8019 21.0285 caugiay",
      "#              ^kinh độ ^vĩ độ",
      "GEOSEARCH stores FROMLONLAT 105.84 21.02 BYRADIUS 3 km ASC COUNT 10 WITHDIST",
      "GEODIST stores hoankiem caugiay km",
      "TYPE stores                           # zset",
      "ZSCORE stores hoankiem                # geohash 52 bit dạng số",
      "ZREM stores caugiay                   # không có GEODEL"
    ]},
    { id: "rs", label: "④ Rust (redis-rs)", lines: [
      "use redis::AsyncCommands;",
      "",
      "async fn mark_active(con: &mut redis::aio::MultiplexedConnection,",
      "                     day: &str, user_id: usize) -> redis::RedisResult<()> {",
      "    let key = format!(\"dau:{day}\");",
      "    let _: bool = con.setbit(&key, user_id, true).await?;   // trả bit cũ",
      "    let _: () = con.expire(&key, 60 * 60 * 24 * 35).await?; // giữ 35 ngày",
      "    Ok(())",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="s"><div class="nl">🧵 String</div><div class="ns">mảng byte ≤ 512MB</div></div>
      <div class="node" id="z"><div class="nl">🏆 ZSET</div><div class="ns">score double</div></div>
    </div>
    <div class="arrow" id="a1">↓ xây trên</div>
    <div class="row">
      <div class="node" id="b"><div class="nl">🟩 Bitmap</div><div class="ns">1 bit / ID</div></div>
      <div class="node" id="h"><div class="nl">📊 HyperLogLog</div><div class="ns">16384 thanh ghi · ≤12KB</div></div>
      <div class="node" id="g"><div class="nl">📍 Geo</div><div class="ns">score = geohash 52 bit</div></div>
    </div>
    <div class="arrow" id="a2">↓ đánh đổi</div>
    <div class="node" id="t"><div class="nl">⚖️ Chính xác vs RAM</div><div class="ns">bitmap chính xác (ID dày) · HLL xấp xỉ ±0,81%</div></div>
  `,
  steps: [
    { title: "1 · Bitmap chỉ là String", tab: "bit", highlight: [1, 2, 3, 9], on: ["s", "a1", "b"],
      desc: "Offset 1042 → byte 130, bit 2. STRLEN cho thấy độ dài String bằng offset lớn nhất / 8." },
    { title: "2 · Phép toán tập hợp bằng bit", tab: "bit", highlight: [6, 7], on: ["b"],
      desc: "BITOP AND 7 bitmap = user hoạt động cả 7 ngày. Chú ý: BITOP là O(N) theo độ dài chuỗi." },
    { title: "3 · HLL đếm unique với 12 KB", tab: "hll", highlight: [1, 2, 3, 7], on: ["s", "h"],
      desc: "Thêm trùng không làm tăng. PFCOUNT nhiều key cho ra hợp mà không cần merge trước." },
    { title: "4 · Geo là ZSET", tab: "geo", highlight: [1, 3, 5, 6], on: ["z", "g"],
      desc: "Kinh độ trước. TYPE trả zset, score là geohash — nên ZREM, ZCARD dùng được luôn." },
    { title: "5 · Chọn đúng công cụ", tab: "rs", highlight: [5, 6, 7], on: ["a2", "t"],
      desc: "Bitmap cho ID số dày và cần chính xác; HLL cho ID bất kỳ khi chấp nhận sai số. Luôn đặt TTL cho key theo ngày." }
  ],

  quiz: [
    { q: "TYPE của một key tạo bằng SETBIT là gì?", options: [
        "bitmap", "string", "set", "hash"
      ], correct: 1, explanation: "Bitmap là thao tác bit trên String." },
    { q: "Bộ nhớ tối đa của một HyperLogLog?", options: [
        "Tỷ lệ với số phần tử", "Khoảng 12 KB", "1 MB", "512 MB"
      ], correct: 1, explanation: "16384 thanh ghi × 6 bit ≈ 12 KB ở dạng dense." },
    { q: "Sai số chuẩn của HLL trong Redis?", options: [
        "0%", "0,81%", "5%", "Không xác định"
      ], correct: 1, explanation: "1.04/√16384 ≈ 0,81%." },
    { q: "Bạn cần kiểm tra 'user X đã xem bài này chưa'. HLL có làm được không?", options: [
        "Có, bằng PFCOUNT", "Không — HLL chỉ ước lượng số lượng, không trả lời câu hỏi thành viên",
        "Có, bằng PFADD trả 0", "Có nếu dùng dense"
      ], correct: 1, explanation: "PFADD trả 1 khi thanh ghi thay đổi, nhưng trả 0 không chứng minh X đã có. Cần Set hoặc Bloom filter." },
    { q: "SETBIT newkey 4000000000 1 trên key chưa tồn tại gây ra gì?", options: [
        "Lỗi out of range", "Cấp phát ngay String ~500 MB", "Tạo sparse bitmap vài byte", "Không làm gì"
      ], correct: 1, explanation: "String được kéo dài tới offset đó. Bitmap không hợp với ID thưa." },
    { q: "Thứ tự tham số của GEOADD?", options: [
        "key vĩđộ kinhđộ member", "key kinhđộ vĩđộ member", "key member kinhđộ vĩđộ", "key member vĩđộ kinhđộ"
      ], correct: 1, explanation: "Longitude trước, latitude sau." },
    { q: "Xoá một điểm khỏi Geo set bằng lệnh nào?", options: [
        "GEODEL", "ZREM", "DEL", "GEOREMOVE"
      ], correct: 1, explanation: "Geo là ZSET; không có GEODEL." },
    { q: "Theo dõi DAU chính xác cho 10 triệu user có ID số liên tục, lựa chọn RAM hiệu quả nhất?", options: [
        "Set các ID", "Bitmap (~1,25 MB/ngày)", "List", "Một String JSON"
      ], correct: 1, explanation: "10^7 bit = 1,25 MB và chính xác tuyệt đối." },
    { q: "GEOSEARCH thay thế lệnh nào đã deprecated?", options: [
        "GEOHASH", "GEORADIUS / GEORADIUSBYMEMBER", "GEOPOS", "GEODIST"
      ], correct: 1, explanation: "GEOSEARCH/GEOSEARCHSTORE có từ 6.2." }
  ]
});
