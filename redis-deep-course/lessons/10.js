window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Persistence",
  title: "AOF: fsync policy, rewrite và định dạng hybrid",
  subtitle: "always / everysec / no · mất bao nhiêu dữ liệu · multi-part AOF (7.0) · chọn cấu hình nào",

  theory: `
    <p>AOF (Append Only File) ghi <strong>mọi lệnh làm thay đổi dữ liệu</strong> theo định dạng RESP vào cuối file. Khởi động lại = phát lại các lệnh.
    Giống WAL của PostgreSQL hay redo log của InnoDB, nhưng ghi <em>sau</em> khi lệnh đã thực thi trong RAM (không phải write-ahead).</p>

    <p><strong>Đường đi của một lệnh ghi</strong>: thực thi trong RAM → nối vào <code>aof_buf</code> trong RAM → trước khi quay lại event loop, <code>write()</code> vào file
    (dữ liệu mới nằm ở page cache của kernel) → <code>fsync()</code> mới thật sự xuống đĩa. <code>appendfsync</code> quyết định lúc nào fsync:</p>
    <table>
      <tr><th>appendfsync</th><th>Khi nào fsync</th><th>Mất tối đa khi mất điện</th><th>Hiệu năng</th></tr>
      <tr><td><code>always</code></td><td>Sau mỗi vòng event loop, trước khi trả reply</td><td>Gần như không mất lệnh đã được xác nhận</td><td>Chậm nhất, phụ thuộc độ trễ đĩa</td></tr>
      <tr><td><code>everysec</code> (mặc định)</td><td>Mỗi giây, trên bio thread</td><td>~1 giây (xấu nhất ~2 giây)</td><td>Gần như RDB</td></tr>
      <tr><td><code>no</code></td><td>Để kernel tự flush (thường ~30 giây)</td><td>Tới vài chục giây</td><td>Nhanh nhất</td></tr>
    </table>
    <p>Chỉ Redis chết (process crash) mà máy còn sống thì dữ liệu đã <code>write()</code> vẫn nằm trong page cache và sẽ xuống đĩa — fsync chỉ quan trọng khi <em>mất điện / kernel panic</em>.
    Với <code>everysec</code>, nếu fsync nền bị kẹt quá 2 giây (đĩa chậm), main thread sẽ hoãn <code>write()</code> → latency tăng vọt.</p>

    <p><strong>AOF rewrite</strong>: file lớn dần (INCR 1 triệu lần = 1 triệu dòng). <code>BGREWRITEAOF</code> fork tiến trình con ghi ra trạng thái hiện tại dưới dạng tối thiểu.
    Tự kích hoạt theo <code>auto-aof-rewrite-percentage 100</code> (file gấp đôi so với lần rewrite trước) và <code>auto-aof-rewrite-min-size 64mb</code>.</p>

    <p><strong>Multi-part AOF (Redis 7.0+)</strong>: thay vì một file, có thư mục <code>appendonlydir</code> gồm:</p>
    <ul>
      <li><code>*.base.rdb</code> (hoặc <code>.base.aof</code>): ảnh nền do rewrite tạo — mặc định định dạng RDB nhờ <code>aof-use-rdb-preamble yes</code> (hybrid: nạp nhanh như RDB).</li>
      <li><code>*.incr.aof</code>: các lệnh sau base.</li>
      <li><code>*.manifest</code>: danh sách file và thứ tự.</li>
    </ul>
    <p>Khi rewrite, cha chỉ việc mở file incr mới; không còn phải giữ "rewrite buffer" trong RAM và ghi hai lần như bản cũ.</p>

    <table>
      <tr><th>Nhu cầu</th><th>Cấu hình</th></tr>
      <tr><td>Cache thuần, mất được</td><td>Tắt cả hai, hoặc chỉ RDB để khởi động ấm</td></tr>
      <tr><td>Dữ liệu quan trọng (session, queue, rate limit, lock)</td><td>AOF <code>everysec</code> + RDB để backup</td></tr>
      <tr><td>Không chấp nhận mất lệnh đã xác nhận</td><td><code>always</code> + đĩa nhanh; nhưng replication vẫn là async (bài 11) — cân nhắc DB khác</td></tr>
    </table>

    <div class="callout"><p>💡 Bật cả RDB và AOF thì lúc khởi động Redis <strong>ưu tiên AOF</strong> (đầy đủ hơn). Bật AOF trên instance đang chạy chỉ có RDB:
    dùng <code>CONFIG SET appendonly yes</code> (Redis tự rewrite ra AOF từ dữ liệu hiện có) — đừng chỉ sửa file config rồi restart, sẽ khởi động với AOF rỗng.</p></div>
  `,

  codeTabs: [
    { id: "conf", label: "① redis.conf", lines: [
      "appendonly yes",
      "appenddirname \"appendonlydir\"",
      "appendfsync everysec",
      "no-appendfsync-on-rewrite no     # yes = bỏ fsync trong lúc rewrite (giảm latency, tăng rủi ro)",
      "auto-aof-rewrite-percentage 100",
      "auto-aof-rewrite-min-size 64mb",
      "aof-use-rdb-preamble yes         # base dạng RDB",
      "aof-load-truncated yes           # file cụt ở cuối (mất điện) -> vẫn nạp phần hợp lệ"
    ]},
    { id: "file", label: "② Nội dung AOF", lines: [
      "$ ls appendonlydir/",
      "appendonly.aof.3.base.rdb  appendonly.aof.3.incr.aof  appendonly.aof.manifest",
      "",
      "$ cat appendonlydir/appendonly.aof.manifest",
      "file appendonly.aof.3.base.rdb seq 3 type b",
      "file appendonly.aof.3.incr.aof seq 3 type i",
      "",
      "$ head appendonlydir/appendonly.aof.3.incr.aof",
      "*2\\r\\n$6\\r\\nSELECT\\r\\n$1\\r\\n0\\r\\n",
      "*3\\r\\n$4\\r\\nINCR\\r\\n... ",
      "*3\\r\\n$9\\r\\nPEXPIREAT\\r\\n...      # EXPIRE được ghi thành thời điểm tuyệt đối"
    ]},
    { id: "flow", label: "③ Đường đi lệnh ghi", lines: [
      "call(INCR counter)            // 1. thực thi trong RAM",
      "feedAppendOnlyFile()          // 2. nối vào aof_buf",
      "beforeSleep():",
      "    write(aof_fd, aof_buf)    // 3. vào page cache của kernel",
      "    if appendfsync == always:",
      "        fsync(aof_fd)         // 4a. xuống đĩa rồi mới gửi reply",
      "    elif everysec && 1s trôi qua:",
      "        bio_submit(FSYNC)     // 4b. thread nền fsync",
      "    sendRepliesToClients()"
    ]},
    { id: "ops", label: "④ Vận hành", lines: [
      "BGREWRITEAOF",
      "INFO persistence",
      "aof_enabled:1",
      "aof_rewrite_in_progress:0",
      "aof_last_bgrewrite_status:ok",
      "aof_delayed_fsync:3            # số lần main phải chờ vì fsync nền > 2s",
      "",
      "redis-check-aof --fix appendonlydir/appendonly.aof.manifest",
      "CONFIG SET appendonly yes      # bật AOF nóng, tự tạo base từ dữ liệu hiện có"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cmd"><div class="nl">✍️ INCR counter</div><div class="ns">thực thi trong RAM</div></div>
    <div class="arrow" id="a1">↓ aof_buf</div>
    <div class="node" id="pc"><div class="nl">🧠 write() → page cache</div><div class="ns">sống sót nếu chỉ Redis crash</div></div>
    <div class="arrow" id="a2">↓ fsync theo appendfsync</div>
    <div class="node" id="disk"><div class="nl">💽 Đĩa</div><div class="ns">sống sót khi mất điện</div></div>
    <div class="arrow" id="a3">↓ file lớn dần → rewrite</div>
    <div class="row">
      <div class="node" id="base"><div class="nl">🧱 base.rdb</div><div class="ns">ảnh nền (fork)</div></div>
      <div class="node" id="incr"><div class="nl">➕ incr.aof</div><div class="ns">lệnh sau base</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Lệnh chạy trong RAM trước", tab: "flow", highlight: [1, 2], on: ["cmd", "a1"],
      desc: "AOF không phải write-ahead: lệnh thực thi xong mới được nối vào buffer." },
    { title: "2 · write() vào page cache", tab: "flow", highlight: [3, 4], on: ["pc"],
      desc: "Nếu chỉ process Redis chết, dữ liệu này vẫn xuống đĩa nhờ kernel." },
    { title: "3 · fsync quyết định độ bền", tab: "conf", highlight: [3, 4], on: ["a2", "disk"],
      desc: "always: fsync trước khi reply. everysec: bio thread fsync mỗi giây → mất ≤ ~1–2 giây khi mất điện." },
    { title: "4 · Đĩa chậm → latency", tab: "ops", highlight: [6], on: ["disk"],
      desc: "Với everysec, fsync nền kẹt quá 2s thì main hoãn write → client thấy độ trễ tăng. aof_delayed_fsync đếm việc này." },
    { title: "5 · Rewrite tạo base mới", tab: "file", highlight: [2, 5, 6], on: ["a3", "base", "incr"],
      desc: "Fork con ghi base (RDB), cha mở incr mới. Manifest liệt kê file nào thuộc trạng thái hiện tại." },
    { title: "6 · Định dạng lệnh", tab: "file", highlight: [9, 10, 11], on: ["incr"],
      desc: "Chính là RESP. EXPIRE được ghi thành PEXPIREAT để phát lại không bị lệch thời gian." }
  ],

  quiz: [
    { q: "Giá trị mặc định của appendfsync?", options: [
        "always", "everysec", "no", "never"
      ], correct: 1, explanation: "Cân bằng giữa độ bền (~1s) và hiệu năng." },
    { q: "appendfsync everysec, máy mất điện. Mất tối đa khoảng bao nhiêu?", options: [
        "Không mất", "Khoảng 1 giây (xấu nhất ~2 giây)", "30 giây", "Toàn bộ từ lần rewrite trước"
      ], correct: 1, explanation: "fsync mỗi giây trên thread nền." },
    { q: "Chỉ process Redis bị kill -9, máy vẫn chạy, appendfsync no. Lệnh đã write() có mất không?", options: [
        "Mất hết", "Không — dữ liệu đã nằm trong page cache kernel và sẽ được ghi xuống", "Mất 30 giây gần nhất", "Tuỳ hz"
      ], correct: 1, explanation: "fsync chỉ bảo vệ khỏi mất điện/kernel crash." },
    { q: "AOF có phải write-ahead log như WAL của PostgreSQL không?", options: [
        "Có, ghi log trước rồi mới thực thi", "Không — lệnh thực thi trong RAM trước rồi mới ghi vào AOF", "Có nhưng chỉ với MULTI", "Chỉ khi always"
      ], correct: 1, explanation: "Redis ghi sau khi thực thi; với always, fsync xong mới gửi reply." },
    { q: "Multi-part AOF (7.0) gồm những gì?", options: [
        "Một file duy nhất", "base (thường RDB), một hoặc nhiều incr AOF, và manifest", "Chỉ RDB", "Mỗi key một file"
      ], correct: 1, explanation: "Nằm trong thư mục appenddirname." },
    { q: "aof-use-rdb-preamble yes mang lại gì?", options: [
        "Tắt AOF", "Phần base ở định dạng RDB nên nạp nhanh và gọn, phần sau vẫn là lệnh", "Nén AOF bằng gzip", "Chỉ lưu RDB"
      ], correct: 1, explanation: "Đây là persistence hybrid." },
    { q: "Bật cả RDB và AOF, lúc khởi động Redis nạp từ đâu?", options: [
        "RDB", "AOF", "Cái mới hơn", "Hỏi người dùng"
      ], correct: 1, explanation: "AOF thường đầy đủ hơn." },
    { q: "Instance đang chạy chỉ có RDB. Cách bật AOF an toàn?", options: [
        "Sửa appendonly yes trong file rồi restart", "CONFIG SET appendonly yes (Redis tự tạo AOF từ dữ liệu hiện có), sau đó cập nhật file config",
        "Xoá dump.rdb", "Chạy BGSAVE"
      ], correct: 1, explanation: "Restart với AOF bật nhưng chưa có file AOF có thể khởi động rỗng." },
    { q: "Khi nào AOF tự rewrite với cấu hình mặc định?", options: [
        "Mỗi giờ", "Khi file tăng 100% so với sau lần rewrite trước và ≥ 64 MB", "Khi đầy đĩa", "Không bao giờ"
      ], correct: 1, explanation: "auto-aof-rewrite-percentage 100 và auto-aof-rewrite-min-size 64mb." },
    { q: "aof_delayed_fsync tăng liên tục báo hiệu điều gì?", options: [
        "Mạng chậm", "Đĩa chậm: fsync nền quá 2s nên main thread phải hoãn ghi", "Quá nhiều key", "Replica lag"
      ], correct: 1, explanation: "Cần đĩa nhanh hơn hoặc tách I/O khác khỏi đĩa này." }
  ]
});
