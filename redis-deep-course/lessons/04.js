window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Cấu trúc dữ liệu & encoding",
  title: "Set và Sorted Set: intset, skiplist + dict",
  subtitle: "Vì sao ZSET dùng skiplist chứ không phải cây cân bằng · ZRANGE, ZRANK có giá bao nhiêu",

  theory: `
    <p><strong>Set</strong> — tập không trùng, không thứ tự. Ba encoding:</p>
    <table>
      <tr><th>Encoding</th><th>Điều kiện (mặc định)</th><th>Cấu trúc</th></tr>
      <tr><td><code>intset</code></td><td>Mọi phần tử là số nguyên, ≤ 512 phần tử (<code>set-max-intset-entries</code>)</td><td>Mảng số nguyên <em>đã sắp xếp</em>, tìm bằng binary search O(log n)</td></tr>
      <tr><td><code>listpack</code> (7.2+)</td><td>≤ 128 phần tử, mỗi phần tử ≤ 64 byte</td><td>Như hash nhỏ</td></tr>
      <tr><td><code>hashtable</code></td><td>Còn lại</td><td>dict với value rỗng, O(1)</td></tr>
    </table>
    <p><code>SINTER</code>, <code>SUNION</code>, <code>SDIFF</code> là O(N·M) / O(N) trên tổng kích thước — với set triệu phần tử thì đó là lệnh nặng. <code>SMEMBERS</code> trên set lớn cũng vậy; dùng <code>SSCAN</code>.</p>

    <p><strong>Sorted Set (ZSET)</strong> — mỗi member có một <code>score</code> (double). Dùng cho leaderboard, hàng đợi hẹn giờ, sliding window rate limit, index phụ.</p>
    <ul>
      <li>Nhỏ (≤ 128 phần tử, member ≤ 64 byte): <code>listpack</code> sắp theo score.</li>
      <li>Lớn: <code>skiplist</code> — thực chất là <strong>hai cấu trúc cùng lúc</strong>:
        <ul>
          <li><strong>dict</strong> member → score: <code>ZSCORE</code> O(1), kiểm tra tồn tại O(1).</li>
          <li><strong>skiplist</strong> sắp theo (score, member): <code>ZADD</code>, <code>ZRANK</code>, <code>ZRANGEBYSCORE</code> O(log n).</li>
        </ul></li>
    </ul>

    <p><strong>Skiplist là gì?</strong> Linked list đã sắp xếp, nhưng mỗi node được "tung đồng xu" để có thêm các tầng con trỏ nhảy xa
    (xác suất lên tầng 1/4, tối đa 32 tầng). Tìm kiếm đi từ tầng cao nhất, nhảy xa rồi hạ tầng → trung bình O(log n).
    Redis thêm <code>span</code> ở mỗi con trỏ (số node bị nhảy qua) nên tính được <strong>rank</strong> trong O(log n) — điều cây đỏ-đen thường không làm sẵn.</p>
    <p>Vì sao không dùng cây cân bằng? antirez nêu: skiplist đơn giản hơn nhiều để cài đặt và debug, <code>ZRANGE</code> chỉ là đi tiếp theo linked list,
    và tốn bộ nhớ tương đương. Java cũng có <code>ConcurrentSkipListMap</code> — cùng ý tưởng.</p>

    <table>
      <tr><th>Lệnh</th><th>Độ phức tạp</th></tr>
      <tr><td><code>ZADD</code>, <code>ZREM</code>, <code>ZRANK</code></td><td>O(log n)</td></tr>
      <tr><td><code>ZSCORE</code></td><td>O(1)</td></tr>
      <tr><td><code>ZRANGE key 0 9</code></td><td>O(log n + 10)</td></tr>
      <tr><td><code>ZRANGEBYSCORE ... LIMIT</code></td><td>O(log n + m) — nhưng <code>LIMIT offset</code> lớn vẫn phải đi qua offset phần tử</td></tr>
      <tr><td><code>ZUNIONSTORE</code>, <code>ZINTERSTORE</code></td><td>O(N) + O(M log M) — nặng</td></tr>
    </table>

    <div class="callout"><p>💡 Score là double 64-bit: số nguyên chính xác tuyệt đối chỉ tới 2^53. Dùng timestamp mili-giây làm score thì ổn; ghép "điểm * 10^13 + thời gian"
    để phá hoà có thể vượt 2^53 và mất chính xác. Khi score bằng nhau, Redis sắp theo member (so sánh byte).</p></div>
  `,

  codeTabs: [
    { id: "set", label: "① Set", lines: [
      "127.0.0.1:6379> SADD ids 3 1 2",
      "127.0.0.1:6379> OBJECT ENCODING ids",
      "\"intset\"",
      "127.0.0.1:6379> SADD ids abc",
      "127.0.0.1:6379> OBJECT ENCODING ids",
      "\"listpack\"           # 7.2+ ; bản cũ -> \"hashtable\"",
      "",
      "SISMEMBER ids 2        # O(1) (intset: O(log n))",
      "SMEMBERS big_set       # O(N) - tránh trên set lớn",
      "SSCAN big_set 0 COUNT 100"
    ]},
    { id: "zset", label: "② Leaderboard", lines: [
      "ZADD lb 1200 alice 950 bob 1500 carol",
      "ZINCRBY lb 100 bob                  # 1050",
      "ZREVRANGE lb 0 2 WITHSCORES         # top 3 (6.2+: ZRANGE lb 0 2 REV WITHSCORES)",
      "ZREVRANK lb alice                   # hạng của alice (0-based)",
      "ZSCORE lb carol                     # O(1) qua dict",
      "ZRANGEBYSCORE lb 1000 +inf LIMIT 0 20",
      "ZCOUNT lb 1000 2000                 # O(log n)"
    ]},
    { id: "sl", label: "③ Skiplist", lines: [
      "L3: head ---------------------------------> 1500 -> nil",
      "L2: head -------------> 1050 -------------> 1500 -> nil",
      "L1: head ----> 950 ---> 1050 ----> 1200 --> 1500 -> nil",
      "",
      "// Tìm 1200: L3 nhảy tới 1500? quá -> hạ L2 -> 1050 -> tiếp 1500? quá",
      "//           -> hạ L1 -> 1200 ✓   (cộng span dọc đường = rank)",
      "",
      "zset { dict *dict;  zskiplist *zsl; }   // hai cấu trúc trỏ chung member"
    ]},
    { id: "delay", label: "④ Hàng đợi hẹn giờ", lines: [
      "# Producer: score = thời điểm cần chạy (epoch ms)",
      "ZADD delayed 1767225600000 job:881",
      "",
      "# Worker mỗi giây:",
      "ZRANGEBYSCORE delayed -inf <now> LIMIT 0 100",
      "# Lấy + xoá nguyên tử để 2 worker không cùng nhận: dùng Lua (bài 16)",
      "# hoặc ZPOPMIN (lấy phần tử score nhỏ nhất) rồi kiểm tra đã tới hạn chưa"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="is"><div class="nl">🔢 intset</div><div class="ns">mảng int đã sắp</div></div>
      <div class="node" id="lp"><div class="nl">📃 listpack</div><div class="ns">nhỏ, member ngắn</div></div>
      <div class="node" id="hs"><div class="nl">#️⃣ hashtable</div><div class="ns">set lớn</div></div>
    </div>
    <div class="arrow" id="a1">↓ ZSET lớn</div>
    <div class="row">
      <div class="node" id="d"><div class="nl">📖 dict</div><div class="ns">member → score · O(1)</div></div>
      <div class="node" id="sk"><div class="nl">🪜 skiplist</div><div class="ns">sắp theo score · O(log n) · span → rank</div></div>
    </div>
    <div class="arrow" id="a2">↓ ứng dụng</div>
    <div class="node" id="app"><div class="nl">🏆 Leaderboard · ⏰ delay queue · 🪟 sliding window</div><div class="ns">score = điểm / timestamp</div></div>
  `,
  steps: [
    { title: "1 · Set số nguyên nhỏ → intset", tab: "set", highlight: [1, 2, 3], on: ["is"],
      desc: "Mảng int sắp xếp, tự nâng độ rộng 16→32→64 bit khi cần. Tìm bằng binary search." },
    { title: "2 · Thêm chuỗi → đổi encoding", tab: "set", highlight: [4, 5, 6], on: ["lp", "hs"],
      desc: "Có phần tử không phải số → listpack (7.2+) nếu nhỏ, hashtable nếu lớn." },
    { title: "3 · ZSET = dict + skiplist", tab: "sl", highlight: [8], on: ["a1", "d", "sk"],
      desc: "dict trả lời 'score của X' O(1); skiplist trả lời 'ai đứng từ hạng 0 đến 9' O(log n + 10)." },
    { title: "4 · Tìm trong skiplist", tab: "sl", highlight: [1, 2, 3, 5, 6], on: ["sk"],
      desc: "Nhảy ở tầng cao, hạ dần. Cộng span các bước nhảy ra rank — ZRANK O(log n)." },
    { title: "5 · Dùng vào việc thật", tab: "zset", highlight: [1, 2, 3, 4], on: ["a2", "app"],
      desc: "Leaderboard: ZINCRBY cộng điểm, ZRANGE ... REV lấy top, ZREVRANK lấy hạng user." },
    { title: "6 · Delay queue", tab: "delay", highlight: [2, 5, 6], on: ["app"],
      desc: "Score là thời điểm chạy. Lấy việc tới hạn bằng ZRANGEBYSCORE; phần lấy-và-xoá phải nguyên tử." }
  ],

  quiz: [
    { q: "ZSET lớn trong Redis được lưu bằng gì?", options: [
        "Cây đỏ-đen", "B-tree", "skiplist + dict song song", "Chỉ một hash table"
      ], correct: 2, explanation: "dict cho tra score O(1), skiplist cho truy vấn theo thứ tự O(log n)." },
    { q: "Độ phức tạp của ZSCORE?", options: [
        "O(1)", "O(log n)", "O(n)", "O(n log n)"
      ], correct: 0, explanation: "Tra qua dict member → score." },
    { q: "Vì sao ZRANK chạy được O(log n)?", options: [
        "Redis cache sẵn rank", "Mỗi con trỏ trong skiplist lưu span (số node nhảy qua), cộng dọc đường tìm kiếm ra rank",
        "Vì dict lưu rank", "Không, ZRANK là O(n)"
      ], correct: 1, explanation: "span là phần Redis thêm vào skiplist chuẩn." },
    { q: "SADD s 1 2 3 với cấu hình mặc định cho encoding gì?", options: [
        "listpack", "intset", "hashtable", "skiplist"
      ], correct: 1, explanation: "Toàn số nguyên và ≤ 512 phần tử → intset." },
    { q: "Hai member có cùng score, thứ tự của chúng do đâu quyết định?", options: [
        "Thời điểm thêm vào", "Ngẫu nhiên", "So sánh byte (lexicographic) của member", "Độ dài member"
      ], correct: 2, explanation: "Skiplist sắp theo (score, member)." },
    { q: "Vấn đề khi dùng score = điểm * 10^13 + timestamp để phá hoà?", options: [
        "Không có vấn đề", "Score là double, vượt 2^53 thì mất chính xác số nguyên", "Score phải < 1000", "ZADD sẽ lỗi"
      ], correct: 1, explanation: "double chỉ biểu diễn chính xác số nguyên tới 2^53." },
    { q: "Lệnh nào nên tránh trên set 10 triệu phần tử ở giờ cao điểm?", options: [
        "SISMEMBER", "SADD", "SMEMBERS", "SCARD"
      ], correct: 2, explanation: "SMEMBERS O(N) trả cả 10 triệu phần tử, chặn main thread và dồn output buffer. Dùng SSCAN." },
    { q: "Lý do chính antirez chọn skiplist thay cây cân bằng?", options: [
        "Nhanh hơn gấp 10", "Đơn giản để cài đặt/debug, duyệt range tự nhiên, bộ nhớ tương đương", "Để lưu lên đĩa", "Vì cây không hỗ trợ double"
      ], correct: 1, explanation: "Hiệu năng tương đương; ưu điểm là đơn giản." },
    { q: "ZRANGEBYSCORE key min max LIMIT 1000000 10 có rẻ không?", options: [
        "Rẻ, O(log n + 10)", "Không — vẫn phải đi qua 1 triệu phần tử offset", "Rẻ vì dùng dict", "Lỗi cú pháp"
      ], correct: 1, explanation: "Offset lớn tốn O(offset). Phân trang sâu nên dùng score của phần tử cuối làm mốc (keyset pagination)." }
  ]
});
