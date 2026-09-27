window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Cấu trúc dữ liệu & encoding",
  title: "Độ phức tạp lệnh & lệnh nguy hiểm: KEYS vs SCAN, big key, hot key",
  subtitle: "Đọc Big-O trong docs · SCAN hoạt động thế nào · UNLINK · chặn lệnh bằng ACL",

  theory: `
    <p>Vì mọi lệnh chạy trên một luồng (bài 01), <strong>độ phức tạp của lệnh = thời gian cả server đứng chờ</strong>. Trang docs của mỗi lệnh đều ghi <em>Time complexity</em> — hãy đọc nó như đọc chữ ký hàm.</p>

    <table>
      <tr><th>Nguy hiểm (O(N) trên cả keyspace/key lớn)</th><th>Thay bằng</th></tr>
      <tr><td><code>KEYS pattern</code></td><td><code>SCAN cursor MATCH pattern COUNT n</code></td></tr>
      <tr><td><code>HGETALL</code>, <code>SMEMBERS</code>, <code>LRANGE 0 -1</code>, <code>ZRANGE 0 -1</code> trên key lớn</td><td><code>HSCAN</code>/<code>SSCAN</code>/<code>ZSCAN</code>, hoặc lấy theo trang</td></tr>
      <tr><td><code>DEL</code> key lớn (giải phóng triệu phần tử)</td><td><code>UNLINK</code> (giải phóng trên bio thread) hoặc bật <code>lazyfree-lazy-user-del</code></td></tr>
      <tr><td><code>FLUSHALL</code>/<code>FLUSHDB</code></td><td>Thêm <code>ASYNC</code>; và chặn bằng ACL ở production</td></tr>
      <tr><td><code>SINTER</code>/<code>SUNION</code>/<code>ZUNIONSTORE</code> trên set lớn</td><td>Tính trước, hoặc làm ở replica/offline</td></tr>
      <tr><td>Script Lua duyệt nhiều key</td><td>Chia nhỏ theo lô</td></tr>
    </table>

    <p><strong>SCAN hoạt động thế nào</strong></p>
    <ul>
      <li>Trả về <em>một phần</em> key và một cursor mới; gọi lại với cursor đó tới khi cursor = <code>0</code>. Mỗi lần chỉ tốn vài bucket → không chặn server.</li>
      <li>Cursor là vị trí bucket, tăng theo <strong>thứ tự bit đảo ngược</strong> (reverse binary). Nhờ đó dù hash table mở rộng/thu nhỏ giữa chừng, bucket đã duyệt không bị duyệt sót.</li>
      <li>Đảm bảo: key tồn tại suốt từ đầu tới cuối vòng quét <strong>chắc chắn xuất hiện</strong>; nhưng <strong>có thể trùng</strong> → client phải chịu được trùng lặp.</li>
      <li><code>COUNT</code> chỉ là gợi ý; <code>MATCH</code> lọc <em>sau</em> khi lấy ra, nên có lượt trả 0 key mà cursor chưa về 0. Không được dừng khi thấy mảng rỗng.</li>
      <li><code>TYPE hash</code> (6.0+) lọc theo kiểu.</li>
    </ul>

    <p><strong>Big key</strong> — String vài MB, hash/set/zset hàng triệu phần tử. Tác hại: lệnh O(N) chậm, xoá chậm, output buffer phình, replication/migration trong Cluster bị kẹt,
    phân bố RAM giữa các shard lệch. Tìm bằng <code>redis-cli --bigkeys</code> / <code>--memkeys</code> (dùng SCAN, an toàn) hoặc phân tích file RDB offline. Xử lý: chia nhỏ (<code>cart:{uid}:0..15</code>), nén, đặt giới hạn.</p>

    <p><strong>Hot key</strong> — một key nhận phần lớn traffic (sản phẩm flash sale, config toàn cục). Trong Cluster nó dồn hết vào một shard, thêm node không giúp gì.
    Tìm bằng <code>redis-cli --hotkeys</code> (cần policy LFU). Xử lý: cache cục bộ trong process (vài giây), nhân bản key <code>promo:1#0..#7</code> rồi đọc ngẫu nhiên, đọc từ replica.</p>

    <div class="callout"><p>💡 Chặn lệnh nguy hiểm bằng ACL thay vì <code>rename-command</code> (cũ): <code>ACL SETUSER app on &gt;pwd ~* +@all -@dangerous</code>.
    Nhóm <code>@dangerous</code> gồm KEYS, FLUSHALL, DEBUG, CONFIG... App không cần chúng.</p></div>
  `,

  codeTabs: [
    { id: "scan", label: "① SCAN đúng cách", lines: [
      "127.0.0.1:6379> SCAN 0 MATCH session:* COUNT 1000",
      "1) \"1966080\"          # cursor tiếp theo",
      "2) 1) \"session:9a1\" ...",
      "127.0.0.1:6379> SCAN 1966080 MATCH session:* COUNT 1000",
      "1) \"917504\"",
      "2) (empty array)      # rỗng nhưng CHƯA xong - cursor khác 0",
      "...",
      "1) \"0\"                # xong vòng quét",
      "",
      "redis-cli --scan --pattern 'session:*' | head"
    ]},
    { id: "rs", label: "② SCAN trong Rust", lines: [
      "// Tự lặp cursor để thấy rõ cơ chế (redis-rs, async)",
      "let mut cursor: u64 = 0;",
      "let mut seen = std::collections::HashSet::new();",
      "loop {",
      "    let (next, keys): (u64, Vec<String>) = redis::cmd(\"SCAN\")",
      "        .arg(cursor).arg(\"MATCH\").arg(\"session:*\").arg(\"COUNT\").arg(1000)",
      "        .query_async(&mut con).await?;",
      "    seen.extend(keys);          // SCAN có thể trả trùng -> HashSet",
      "    cursor = next;",
      "    if cursor == 0 { break; }   // chỉ dừng khi cursor = 0, KHÔNG dừng khi keys rỗng",
      "}"
    ]},
    { id: "big", label: "③ Big key", lines: [
      "$ redis-cli --bigkeys",
      "[00.00%] Biggest hash found so far '\"cart:9981\"' with 2310442 fields",
      "",
      "$ redis-cli --memkeys           # xếp theo MEMORY USAGE",
      "",
      "127.0.0.1:6379> MEMORY USAGE cart:9981",
      "(integer) 187654321",
      "127.0.0.1:6379> UNLINK cart:9981       # trả về ngay, free trên bio thread",
      "",
      "# Xoá dần một hash cực lớn: HSCAN từng lô 500 field + HDEL"
    ]},
    { id: "acl", label: "④ Chặn lệnh", lines: [
      "ACL SETUSER order-svc on >s3cret ~order:* +@all -@dangerous",
      "ACL SETUSER readonly-bi on >pw2 ~* +@read -@dangerous",
      "ACL CAT dangerous             # liệt kê lệnh trong nhóm",
      "",
      "# redis.conf (cách cũ, tránh dùng):",
      "# rename-command KEYS \"\"",
      "",
      "latency-monitor-threshold 100   # ghi lại sự kiện > 100ms",
      "slowlog-log-slower-than 10000   # ghi lệnh > 10ms (micro giây)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="k"><div class="nl">🧨 KEYS *</div><div class="ns">duyệt 50 triệu key một lèo</div></div>
      <div class="node" id="s"><div class="nl">🔍 SCAN cursor</div><div class="ns">mỗi lần vài bucket</div></div>
    </div>
    <div class="arrow" id="a1">↓ ảnh hưởng tới main thread</div>
    <div class="row">
      <div class="node" id="block"><div class="nl">⛔ Chặn vài giây</div><div class="ns">mọi client timeout</div></div>
      <div class="node" id="ok"><div class="nl">✅ Xen kẽ lệnh khác</div><div class="ns">có thể trùng key</div></div>
    </div>
    <div class="arrow" id="a2">↓ các "mìn" khác</div>
    <div class="row">
      <div class="node" id="bk"><div class="nl">🐘 Big key</div><div class="ns">UNLINK · chia nhỏ</div></div>
      <div class="node" id="hk"><div class="nl">🔥 Hot key</div><div class="ns">local cache · nhân bản</div></div>
    </div>
  `,
  steps: [
    { title: "1 · KEYS chặn cả server", tab: "scan", highlight: [10], on: ["k", "a1", "block"],
      desc: "KEYS O(N) trên toàn keyspace. 50 triệu key có thể mất vài giây — mọi client khác chờ." },
    { title: "2 · SCAN chia nhỏ", tab: "scan", highlight: [1, 2, 4, 5], on: ["s", "ok"],
      desc: "Mỗi lượt trả cursor mới. Server xen lệnh khác giữa các lượt." },
    { title: "3 · Mảng rỗng chưa phải là hết", tab: "scan", highlight: [6, 8], on: ["s"],
      desc: "MATCH lọc sau khi lấy, nên có lượt rỗng. Chỉ dừng khi cursor = 0." },
    { title: "4 · Client chịu được trùng", tab: "rs", highlight: [5, 8, 10], on: ["ok"],
      desc: "Rehash giữa chừng có thể làm một key xuất hiện hai lần. Dùng HashSet hoặc thao tác idempotent." },
    { title: "5 · Big key: đo và xoá an toàn", tab: "big", highlight: [1, 2, 6, 8], on: ["a2", "bk"],
      desc: "--bigkeys dùng SCAN nên chạy được ở production. UNLINK tách khỏi keyspace ngay và free nền." },
    { title: "6 · Rào chắn bằng ACL", tab: "acl", highlight: [1, 2, 3], on: ["hk", "bk"],
      desc: "Tài khoản của service không có quyền @dangerous → không ai lỡ tay KEYS * lên production." }
  ],

  quiz: [
    { q: "Vì sao KEYS * nguy hiểm ở production?", options: [
        "Trả sai kết quả", "O(N) trên toàn keyspace, chặn main thread tới khi xong", "Xoá key", "Chỉ chạy trên replica"
      ], correct: 1, explanation: "Mọi client khác phải chờ." },
    { q: "SCAN trả mảng rỗng và cursor \"917504\". Nên làm gì?", options: [
        "Dừng, đã hết", "Tiếp tục gọi SCAN 917504 tới khi cursor = 0", "Gọi KEYS để chắc", "Tăng COUNT lên 10^9"
      ], correct: 1, explanation: "Chỉ cursor 0 mới đánh dấu kết thúc." },
    { q: "Đảm bảo nào SCAN KHÔNG có?", options: [
        "Key tồn tại suốt vòng quét sẽ được trả ít nhất một lần", "Không bao giờ trả trùng", "Không chặn server lâu", "Có thể dùng MATCH"
      ], correct: 1, explanation: "SCAN có thể trả trùng; client phải khử trùng." },
    { q: "Cơ chế giúp SCAN không bỏ sót key khi hash table resize?", options: [
        "Khoá bảng khi quét", "Cursor tăng theo thứ tự bit đảo ngược", "Chụp snapshot keyspace", "Dùng fork"
      ], correct: 1, explanation: "Reverse binary iteration giữ tính đúng khi bảng gấp đôi hoặc giảm nửa." },
    { q: "Khác nhau giữa DEL và UNLINK với key 5 triệu phần tử?", options: [
        "Không khác", "UNLINK gỡ key khỏi keyspace ngay và giải phóng bộ nhớ trên thread nền; DEL giải phóng đồng bộ",
        "UNLINK chỉ đánh dấu, không xoá", "DEL nhanh hơn"
      ], correct: 1, explanation: "Giải phóng hàng triệu phần tử đồng bộ có thể mất hàng trăm ms." },
    { q: "Công cụ nào tìm big key an toàn trên production?", options: [
        "KEYS * rồi MEMORY USAGE từng key", "redis-cli --bigkeys / --memkeys (dùng SCAN)", "DEBUG OBJECT *", "MONITOR"
      ], correct: 1, explanation: "Hai tuỳ chọn này quét bằng SCAN." },
    { q: "Một hot key trong Redis Cluster: thêm shard có giải quyết được không?", options: [
        "Có, tải chia đều", "Không — một key luôn nằm trên một slot của một shard", "Có nếu dùng hash tag", "Có nếu bật io-threads"
      ], correct: 1, explanation: "Phải cache cục bộ, nhân bản key, hoặc đọc từ replica." },
    { q: "Cách khuyến nghị để service không chạy được FLUSHALL?", options: [
        "Tin tưởng dev", "ACL: -@dangerous cho user của service", "Đổi port", "Tắt persistence"
      ], correct: 1, explanation: "ACL (Redis 6+) thay cho rename-command." },
    { q: "COUNT trong SCAN có ý nghĩa gì?", options: [
        "Số key chính xác trả về", "Gợi ý lượng việc mỗi lượt; số key trả về có thể khác", "Giới hạn tổng số key", "Số lần lặp"
      ], correct: 1, explanation: "COUNT là hint, đặc biệt với encoding nhỏ (listpack) Redis trả cả key một lần." }
  ]
});
