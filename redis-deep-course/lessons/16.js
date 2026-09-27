window.LESSONS.push({
  id: "16",
  phase: "6", phaseName: "Thực thi nhiều lệnh",
  title: "Lua scripting và Redis Functions",
  subtitle: "EVAL/EVALSHA · KEYS vs ARGV · nguyên tử vì chạy trên main thread · FUNCTION LOAD / FCALL (7.0)",

  theory: `
    <p>Khi cần <strong>đọc – quyết định – ghi</strong> nguyên tử (trừ kho nếu còn, nhả lock nếu đúng chủ, rate limit), MULTI không làm được (không đọc giữa chừng),
    WATCH thì thử lại nhiều. Lua chạy <strong>ngay trên server</strong>, trên main thread, nên cả script là một đơn vị nguyên tử: không lệnh nào chen vào.</p>

    <p><strong>EVAL</strong>: <code>EVAL script numkeys key1 .. keyN arg1 .. argM</code></p>
    <ul>
      <li>Trong script: <code>KEYS[1..N]</code> và <code>ARGV[1..M]</code> (mảng Lua bắt đầu từ 1). Gọi Redis bằng <code>redis.call(...)</code> (lỗi → dừng script, ném lỗi)
        hoặc <code>redis.pcall(...)</code> (trả lỗi như giá trị).</li>
      <li><strong>Mọi tên key phải truyền qua KEYS</strong>, không ghép chuỗi trong script: Cluster cần biết key để định tuyến và kiểm tra cùng slot.</li>
      <li>Kiểu dữ liệu: nil của Redis → <code>false</code> trong Lua; số Lua → integer (phần thập phân bị cắt! trả số thực thì đổi sang chuỗi); table → array reply.</li>
    </ul>

    <p><strong>EVALSHA</strong>: gửi cả script mỗi lần tốn băng thông. <code>SCRIPT LOAD</code> trả SHA1; sau đó <code>EVALSHA sha ...</code>. Script cache <em>không bền</em>:
    restart, failover, <code>SCRIPT FLUSH</code> → <code>NOSCRIPT</code>; client phải fallback sang EVAL (redis-rs <code>Script</code> tự làm việc này).</p>

    <p><strong>Nguy hiểm</strong>: script chạy lâu = chặn cả server (bài 01). Sau <code>busy-reply-threshold</code> (tên cũ <code>lua-time-limit</code>, mặc định 5000 ms) Redis bắt đầu trả
    <code>BUSY</code> cho client khác và chỉ chấp nhận <code>SCRIPT KILL</code> (nếu script chưa ghi gì) hoặc <code>SHUTDOWN NOSAVE</code>. Giữ script ngắn, O(1)/O(log n).</p>

    <p><strong>Redis Functions (7.0+)</strong> — khắc phục điểm yếu của EVAL:</p>
    <table>
      <tr><th></th><th>EVAL/EVALSHA</th><th>Functions</th></tr>
      <tr><td>Ở đâu</td><td>Code nằm trong app, cache tạm trên server</td><td>Thư viện được nạp lên server, có tên</td></tr>
      <tr><td>Bền</td><td>Mất khi restart/failover</td><td>Được lưu vào RDB/AOF và replicate</td></tr>
      <tr><td>Gọi</td><td><code>EVALSHA &lt;sha&gt;</code></td><td><code>FCALL tên numkeys ...</code>, <code>FCALL_RO</code> cho hàm chỉ đọc (chạy được trên replica)</td></tr>
      <tr><td>Giống</td><td>SQL gửi từ app</td><td>Stored procedure</td></tr>
    </table>

    <div class="callout"><p>💡 Từ Redis 7, script luôn được replicate theo <em>hiệu ứng</em> (các lệnh ghi thật sự sinh ra), không replay cả script — nên dùng <code>TIME</code> hay số ngẫu nhiên
    trong script vẫn an toàn cho replica. Nhưng hãy coi script như code production: có test, có version, không chứa vòng lặp phụ thuộc kích thước dữ liệu.</p></div>
  `,

  codeTabs: [
    { id: "lua", label: "① Trừ kho nguyên tử", lines: [
      "-- KEYS[1] = stock:sku9   ARGV[1] = số lượng muốn mua",
      "local stock = tonumber(redis.call('GET', KEYS[1]) or '0')",
      "local qty = tonumber(ARGV[1])",
      "if stock < qty then",
      "  return -1                           -- không đủ hàng, không ghi gì",
      "end",
      "return redis.call('DECRBY', KEYS[1], qty)",
      "",
      "-- EVAL \"<script>\" 1 stock:sku9 2"
    ]},
    { id: "rs", label: "② Gọi từ Rust", lines: [
      "use std::sync::LazyLock;",
      "",
      "static RESERVE: LazyLock<redis::Script> = LazyLock::new(|| redis::Script::new(r#\"",
      "    local stock = tonumber(redis.call('GET', KEYS[1]) or '0')",
      "    local qty = tonumber(ARGV[1])",
      "    if stock < qty then return -1 end",
      "    return redis.call('DECRBY', KEYS[1], qty)",
      "\"#));",
      "",
      "let left: i64 = RESERVE.key(\"stock:sku9\").arg(2)",
      "    .invoke_async(&mut con).await?;   // EVALSHA, gặp NOSCRIPT thì tự EVAL",
      "if left < 0 { /* hết hàng */ }"
    ]},
    { id: "fn", label: "③ Redis Functions", lines: [
      "#!lua name=inventory",
      "",
      "local function reserve(keys, args)",
      "  local stock = tonumber(redis.call('GET', keys[1]) or '0')",
      "  local qty = tonumber(args[1])",
      "  if stock < qty then return -1 end",
      "  return redis.call('DECRBY', keys[1], qty)",
      "end",
      "",
      "redis.register_function('reserve', reserve)",
      "",
      "-- $ cat inventory.lua | redis-cli -x FUNCTION LOAD REPLACE",
      "-- > FCALL reserve 1 stock:sku9 2"
    ]},
    { id: "ops", label: "④ Vận hành", lines: [
      "SCRIPT LOAD \"return redis.call('GET', KEYS[1])\"",
      "\"d3c21d0c2b9ca22f82737626a27bcaf5d288f99f\"",
      "EVALSHA d3c21d0c... 1 mykey",
      "SCRIPT FLUSH          # sau đó EVALSHA -> NOSCRIPT",
      "",
      "busy-reply-threshold 5000   # ms; quá ngưỡng -> client khác nhận BUSY",
      "SCRIPT KILL           # chỉ được nếu script chưa ghi",
      "FUNCTION LIST",
      "FUNCTION DUMP / FUNCTION RESTORE   # sao lưu thư viện"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">EVALSHA sha 1 stock:sku9 2</div></div>
    <div class="arrow" id="a1">↓ NOSCRIPT? → gửi lại bằng EVAL</div>
    <div class="node" id="lua"><div class="nl">🌙 Lua trên main thread</div><div class="ns">GET → so sánh → DECRBY</div></div>
    <div class="arrow" id="a2">↓ không lệnh nào chen giữa</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ Trả tồn kho mới</div><div class="ns">replicate hiệu ứng DECRBY</div></div>
      <div class="node" id="busy"><div class="nl">⏳ Script chạy lâu</div><div class="ns">&gt; 5s → BUSY cho mọi client</div></div>
    </div>
    <div class="arrow" id="a3">↓ 7.0+</div>
    <div class="node" id="fn"><div class="nl">📚 Functions</div><div class="ns">có tên · bền · FCALL</div></div>
  `,
  steps: [
    { title: "1 · Logic đọc–quyết định–ghi", tab: "lua", highlight: [2, 3, 4, 5, 7], on: ["lua"],
      desc: "Đọc tồn kho, không đủ thì trả -1, đủ thì trừ. Không client nào thấy trạng thái nửa vời." },
    { title: "2 · Tên key qua KEYS", tab: "lua", highlight: [1, 9], on: ["app"],
      desc: "numkeys = 1, KEYS[1] = stock:sku9, ARGV[1] = 2. Cluster dùng KEYS để định tuyến." },
    { title: "3 · EVALSHA + fallback", tab: "rs", highlight: [3, 10, 11], on: ["app", "a1"],
      desc: "redis::Script tính SHA1 sẵn, gửi EVALSHA; gặp NOSCRIPT thì tự nạp lại." },
    { title: "4 · Nguyên tử vì một luồng", tab: "rs", highlight: [4, 5, 6, 7], on: ["a2", "ok"],
      desc: "Cả script chạy liền trên main thread. Replica nhận DECRBY (hiệu ứng), không chạy lại script." },
    { title: "5 · Cái giá", tab: "ops", highlight: [6, 7], on: ["busy"],
      desc: "Script lặp qua 1 triệu phần tử sẽ làm mọi client nhận BUSY. SCRIPT KILL chỉ dừng được script chưa ghi." },
    { title: "6 · Functions: stored procedure", tab: "fn", highlight: [1, 3, 10, 12, 13], on: ["a3", "fn"],
      desc: "Nạp một lần, sống qua restart và failover, gọi bằng tên. Không còn lỗi NOSCRIPT." }
  ],

  quiz: [
    { q: "Vì sao một script Lua là nguyên tử?", options: [
        "Redis khoá các key liên quan", "Script chạy trọn vẹn trên main thread, không lệnh nào khác chen vào", "Dùng MVCC", "Dùng WATCH ngầm"
      ], correct: 1, explanation: "Cùng lý do mọi lệnh đơn đều nguyên tử." },
    { q: "Vì sao phải truyền tên key qua KEYS thay vì ghép chuỗi trong script?", options: [
        "Cho đẹp", "Để Cluster biết key nào, định tuyến và kiểm tra cùng slot", "Vì Lua không có chuỗi", "Để nhanh hơn"
      ], correct: 1, explanation: "Script truy cập key không khai báo có thể chạy sai node." },
    { q: "Script trả về số 3.7 thì client nhận gì?", options: [
        "3.7", "3 (số Lua bị chuyển thành integer, cắt phần thập phân)", "\"3.7\"", "Lỗi"
      ], correct: 1, explanation: "Muốn giữ số thực thì trả tostring(x)." },
    { q: "Sau failover, EVALSHA trả NOSCRIPT. Vì sao?", options: [
        "Script bị lỗi", "Script cache không bền và không đảm bảo có trên node mới", "SHA1 thay đổi", "Lua bị tắt"
      ], correct: 1, explanation: "Client phải fallback EVAL; Functions giải quyết triệt để." },
    { q: "Script chạy quá busy-reply-threshold. Client khác nhận gì?", options: [
        "Kết quả bình thường", "Lỗi BUSY", "Timeout ngay lập tức", "MOVED"
      ], correct: 1, explanation: "Redis chỉ nhận vài lệnh như SCRIPT KILL, SHUTDOWN NOSAVE." },
    { q: "SCRIPT KILL không dừng được script trong trường hợp nào?", options: [
        "Script đang đọc", "Script đã thực hiện lệnh ghi", "Script chạy trên replica", "Script dùng pcall"
      ], correct: 1, explanation: "Dừng giữa chừng sẽ phá tính nguyên tử; chỉ còn SHUTDOWN NOSAVE." },
    { q: "Điểm khác biệt chính của Redis Functions so với EVAL?", options: [
        "Nhanh hơn 10 lần", "Có tên, được lưu vào RDB/AOF và replicate — như stored procedure", "Không nguyên tử", "Viết bằng Python"
      ], correct: 1, explanation: "FUNCTION LOAD một lần, FCALL mọi nơi." },
    { q: "redis.call và redis.pcall khác nhau thế nào?", options: [
        "Giống nhau", "call ném lỗi và dừng script; pcall trả lỗi như giá trị để script tự xử lý", "pcall chạy song song", "call chỉ đọc"
      ], correct: 1, explanation: "p = protected." },
    { q: "Từ Redis 7, script được replicate sang replica thế nào?", options: [
        "Gửi nguyên script để replica chạy lại", "Gửi các lệnh ghi mà script thực sự tạo ra (effects replication)", "Không replicate", "Gửi SHA1"
      ], correct: 1, explanation: "Nên hàm không tất định (TIME, random) không gây lệch replica." }
  ]
});
