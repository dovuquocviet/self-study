window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Persistence",
  title: "RDB snapshot: fork và copy-on-write",
  subtitle: "BGSAVE · vì sao fork chụp được ảnh nhất quán mà không dừng server · cái giá về RAM",

  theory: `
    <p>RDB là file nhị phân nén chứa <strong>toàn bộ dataset tại một thời điểm</strong>. Dùng để khôi phục khi khởi động lại, backup, và làm bản đồng bộ đầy đủ cho replica (bài 11).</p>

    <p><strong>BGSAVE hoạt động thế nào</strong></p>
    <ol>
      <li>Main thread gọi <code>fork()</code>. Kernel tạo tiến trình con dùng <em>chung</em> các trang nhớ vật lý với cha — chỉ copy <strong>bảng trang</strong> (page table), không copy dữ liệu.</li>
      <li>Tiến trình con thấy một ảnh bộ nhớ <strong>đóng băng tại lúc fork</strong>, duyệt toàn bộ key, ghi ra <code>temp-xxx.rdb</code>, rồi <code>rename()</code> đè lên <code>dump.rdb</code> (nguyên tử).</li>
      <li>Trong lúc đó cha vẫn phục vụ client. Khi cha <em>ghi</em> vào một trang nhớ, kernel copy trang đó (4 KB) trước khi sửa → <strong>copy-on-write</strong>. Con vẫn thấy bản cũ.</li>
    </ol>
    <p>Nhờ COW mà snapshot nhất quán tuyệt đối mà không cần khoá — ý tưởng giống MVCC của PostgreSQL nhưng do kernel làm hộ ở mức trang nhớ.</p>

    <p><strong>Cái giá</strong></p>
    <ul>
      <li><strong>Thời gian fork</strong>: phải copy page table, tỉ lệ với RAM đang dùng (cỡ ~10 ms mỗi GB trên máy thật, tệ hơn trên một số VM). Trong lúc fork, main thread <em>đứng yên</em>. Xem <code>latest_fork_usec</code>.</li>
      <li><strong>RAM tăng</strong>: workload ghi nhiều có thể làm cha copy phần lớn trang → tốn tới gấp đôi RAM trong lúc BGSAVE. Log in dòng "Fork CoW for RDB: current ... MB, peak ... MB" (bản cũ: "RDB: N MB of memory used by copy-on-write").</li>
      <li><strong>Transparent Huge Pages</strong> phải tắt: với trang 2 MB, sửa 1 byte cũng copy 2 MB.</li>
      <li>Nên đặt <code>vm.overcommit_memory = 1</code>, nếu không fork có thể thất bại vì kernel nghĩ không đủ RAM cho bản sao "lý thuyết".</li>
      <li><strong>Mất dữ liệu</strong>: crash thì mất mọi thay đổi từ lần snapshot trước — có thể vài phút.</li>
    </ul>

    <p><code>SAVE</code> (không B) ghi trên main thread → chặn mọi client. Chỉ dùng khi server không phục vụ ai.
    Cấu hình <code>save &lt;giây&gt; &lt;số thay đổi&gt;</code>: BGSAVE tự động khi đạt điều kiện. <code>save ""</code> tắt RDB tự động.</p>

    <div class="callout"><p>💡 So với <code>pg_dump</code> (đọc qua một transaction MVCC) thì RDB rẻ hơn nhiều về CPU nhưng đòi RAM dư. Một instance 50 GB ghi nặng mà máy chỉ 64 GB
    thì BGSAVE có thể kéo cả máy vào swap. Đó là lý do nên chia nhỏ dữ liệu thành nhiều instance/shard 10–25 GB.</p></div>
  `,

  codeTabs: [
    { id: "conf", label: "① redis.conf", lines: [
      "save 3600 1 300 100 60 10000   # 1h/1 thay đổi, 5p/100, 60s/10000 (mặc định 7.x)",
      "dbfilename dump.rdb",
      "dir /var/lib/redis",
      "rdbcompression yes             # LZF",
      "rdbchecksum yes                # CRC64 ở cuối file",
      "stop-writes-on-bgsave-error yes  # BGSAVE lỗi -> từ chối ghi, để bạn biết",
      "",
      "# save \"\"                     # tắt RDB tự động"
    ]},
    { id: "fork", label: "② BGSAVE (giả mã)", lines: [
      "bgsave():",
      "    pid = fork()                       // main thread dừng trong lúc copy page table",
      "    if pid == 0:                       // tiến trình con",
      "        f = open('temp-<pid>.rdb')",
      "        for db, key, val in dataset:   // ảnh đóng băng tại lúc fork",
      "            write_type(f); write_key(f); write_value(f); write_expire(f)",
      "        fsync(f); rename('temp-<pid>.rdb', 'dump.rdb')",
      "        exit(0)",
      "    else:",
      "        server.child_pid = pid         // cha tiếp tục phục vụ client"
    ]},
    { id: "cow", label: "③ Copy-on-write", lines: [
      "Trước fork:   cha --> [trang A][trang B][trang C]",
      "Sau fork:     cha --> [A][B][C] <-- con     (dùng chung, chỉ đọc)",
      "Cha SET k1:   kernel copy trang B -> B'",
      "              cha --> [A][B'][C]",
      "              con --> [A][B ][C]            (con vẫn thấy bản cũ)",
      "",
      "# Log:",
      "# Background saving started by pid 4121",
      "# Fork CoW for RDB: current 312 MB, peak 312 MB",
      "# Background saving terminated with success"
    ]},
    { id: "ops", label: "④ Vận hành", lines: [
      "INFO persistence",
      "rdb_changes_since_last_save:48211",
      "rdb_bgsave_in_progress:0",
      "rdb_last_bgsave_status:ok",
      "rdb_last_cow_size:327155712",
      "",
      "INFO stats | grep latest_fork_usec",
      "latest_fork_usec:84211          # 84 ms main thread đứng yên",
      "",
      "echo never > /sys/kernel/mm/transparent_hugepage/enabled",
      "sysctl vm.overcommit_memory=1"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m"><div class="nl">⚙️ Main (cha)</div><div class="ns">đang phục vụ client</div></div>
    <div class="arrow" id="a1">↓ fork() — copy page table (main dừng vài chục ms)</div>
    <div class="row">
      <div class="node" id="p"><div class="nl">⚙️ Cha tiếp tục ghi</div><div class="ns">trang bị sửa → COW copy</div></div>
      <div class="node" id="c"><div class="nl">👶 Con</div><div class="ns">ảnh đóng băng → temp.rdb</div></div>
    </div>
    <div class="arrow" id="a2">↓ xong</div>
    <div class="node" id="f"><div class="nl">💾 rename → dump.rdb</div><div class="ns">thay thế nguyên tử</div></div>
  `,
  steps: [
    { title: "1 · Cấu hình điều kiện snapshot", tab: "conf", highlight: [1, 6], on: ["m"],
      desc: "Đạt một trong các cặp (thời gian, số thay đổi) là tự BGSAVE." },
    { title: "2 · fork", tab: "fork", highlight: [2], on: ["a1"],
      desc: "Copy page table chứ không copy dữ liệu. Nhưng page table của 30 GB vẫn đủ lớn để main dừng vài trăm ms." },
    { title: "3 · Con ghi ảnh đóng băng", tab: "fork", highlight: [3, 5, 6, 7], on: ["c"],
      desc: "Con thấy dataset đúng như lúc fork, bất kể cha sửa gì sau đó." },
    { title: "4 · Cha ghi → copy-on-write", tab: "cow", highlight: [3, 4, 5, 9], on: ["p"],
      desc: "Mỗi trang bị sửa được copy. Ghi nhiều = RAM tăng; THP bật thì mỗi lần copy tới 2 MB." },
    { title: "5 · rename nguyên tử", tab: "fork", highlight: [7], on: ["a2", "f"],
      desc: "File cũ chỉ bị thay khi file mới đã ghi xong và fsync. Crash giữa chừng không làm hỏng dump.rdb." },
    { title: "6 · Theo dõi chi phí", tab: "ops", highlight: [5, 8, 10, 11], on: ["m", "p"],
      desc: "latest_fork_usec là thời gian main đứng; rdb_last_cow_size là RAM tốn thêm." }
  ],

  quiz: [
    { q: "fork() khi BGSAVE copy những gì ngay lập tức?", options: [
        "Toàn bộ dataset", "Chỉ bảng trang (page table); trang dữ liệu dùng chung", "Chỉ các key có TTL", "Không copy gì"
      ], correct: 1, explanation: "Dữ liệu chỉ bị copy khi một bên ghi vào trang (COW)." },
    { q: "Vì sao snapshot RDB nhất quán dù client vẫn ghi trong lúc lưu?", options: [
        "Redis khoá mọi lệnh ghi", "Tiến trình con thấy ảnh bộ nhớ lúc fork nhờ copy-on-write", "Ghi log song song", "Dùng MULTI"
      ], correct: 1, explanation: "Mọi sửa đổi của cha đi vào bản copy của trang." },
    { q: "Khác biệt giữa SAVE và BGSAVE?", options: [
        "Không khác", "SAVE chạy trên main thread và chặn mọi client; BGSAVE fork tiến trình con", "SAVE lưu AOF", "BGSAVE chỉ lưu key mới"
      ], correct: 1, explanation: "SAVE chỉ dùng khi không có traffic." },
    { q: "Vì sao nên tắt Transparent Huge Pages cho Redis?", options: [
        "THP làm Redis crash", "Với trang 2 MB, COW sửa 1 byte cũng copy 2 MB → RAM và latency tăng mạnh", "THP làm chậm mạng", "Vì RDB không đọc được"
      ], correct: 1, explanation: "Redis in cảnh báo lúc khởi động nếu THP đang bật." },
    { q: "Metric nào cho biết main thread bị dừng bao lâu khi fork gần nhất?", options: [
        "rdb_last_cow_size", "latest_fork_usec", "instantaneous_ops_per_sec", "mem_fragmentation_ratio"
      ], correct: 1, explanation: "Đơn vị micro giây." },
    { q: "Chỉ dùng RDB, crash lúc 10:04, snapshot gần nhất lúc 10:00. Mất gì?", options: [
        "Không mất gì", "Mọi thay đổi từ 10:00 tới 10:04", "Chỉ key có TTL", "Toàn bộ dữ liệu"
      ], correct: 1, explanation: "RDB là ảnh theo thời điểm; cần AOF nếu muốn mất ít hơn." },
    { q: "stop-writes-on-bgsave-error yes có tác dụng gì?", options: [
        "Tắt RDB", "Khi BGSAVE thất bại, Redis từ chối lệnh ghi để bạn phát hiện sự cố persistence", "Thử lại BGSAVE vô hạn", "Chuyển sang AOF"
      ], correct: 1, explanation: "Tránh việc chạy tiếp trong khi không hề có bản lưu." },
    { q: "Instance 40 GB, workload ghi nặng, máy 48 GB RAM. Rủi ro khi BGSAVE?", options: [
        "Không có", "COW có thể cần thêm nhiều GB → swap hoặc OOM killer", "RDB file quá lớn", "Replica bị ngắt"
      ], correct: 1, explanation: "Để dư RAM hoặc chia nhỏ instance." },
    { q: "Vì sao RDB ghi ra file tạm rồi rename?", options: [
        "Cho nhanh", "rename là nguyên tử: dump.rdb luôn là một bản hoàn chỉnh, crash giữa chừng không làm hỏng", "Để nén", "Để replica đọc"
      ], correct: 1, explanation: "Mẫu ghi file an toàn kinh điển." }
  ]
});
