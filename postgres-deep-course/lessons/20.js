window.LESSONS.push({
  id: "20",
  phase: "6", phaseName: "Vận hành production",
  title: "Backup & PITR — quay DB về đúng 14:31:59 trước lệnh DELETE nhầm",
  subtitle: "pg_dump vs base backup · WAL archiving · recovery_target_time · pgBackRest/WAL-G · diễn tập restore",

  theory: `
    <p>14:32 một script dọn dữ liệu chạy <code>DELETE FROM orders WHERE created_at &lt; ...</code> thiếu điều kiện tenant. Replica đã nhận lệnh xoá (bài 19). Câu hỏi duy nhất còn lại: <strong>có quay về được 14:31:59 không?</strong> Câu trả lời phụ thuộc hoàn toàn vào loại backup bạn có.</p>

    <table>
      <tr><th></th><th>Logical: <code>pg_dump</code></th><th>Physical: base backup + WAL archive</th></tr>
      <tr><td>Là gì</td><td>SQL/định dạng tuỳ biến mô tả schema + dữ liệu, chụp trong một snapshot nhất quán</td><td>Bản sao file dữ liệu + chuỗi WAL liên tục sau đó</td></tr>
      <tr><td>Khôi phục về</td><td>Đúng thời điểm dump</td><td><strong>Bất kỳ thời điểm nào</strong> sau base backup (PITR)</td></tr>
      <tr><td>Tốc độ restore DB lớn</td><td>Chậm (phải INSERT lại và dựng lại index)</td><td>Nhanh (chép file + replay WAL)</td></tr>
      <tr><td>Linh hoạt</td><td>Restore một bảng, sang version khác</td><td>Cả cluster, cùng major version</td></tr>
    </table>

    <p><strong>Cơ chế PITR</strong></p>
    <ol>
      <li><code>archive_mode = on</code> + <code>archive_command</code> (hoặc <code>archive_library</code>, PG 15+): mỗi segment WAL 16 MB đầy được copy sang kho an toàn (S3, GCS…).</li>
      <li>Định kỳ chụp <strong>base backup</strong> (<code>pg_basebackup</code> hoặc công cụ chuyên dụng) — không cần dừng DB.</li>
      <li>Khi cần: dựng base backup gần nhất <em>trước</em> sự cố, đặt <code>restore_command</code> (lấy WAL từ kho) + <code>recovery_target_time</code>, tạo file <code>recovery.signal</code>, khởi động. PostgreSQL replay WAL tới đúng thời điểm rồi dừng (mặc định <code>pause</code> để bạn kiểm tra).</li>
      <li>Restore ra một server <em>riêng</em>, trích dữ liệu bị xoá, rồi chép ngược vào production — đỡ mất những giao dịch hợp lệ phát sinh sau 14:32.</li>
    </ol>

    <p><strong>Công cụ</strong>: đừng tự viết script <code>cp</code>. <strong>pgBackRest</strong>, <strong>WAL-G</strong>, <strong>Barman</strong> lo nén, mã hoá, song song, backup incremental, kiểm tra toàn vẹn, retention. PG 17 có sẵn incremental backup (<code>summarize_wal</code> + <code>pg_basebackup --incremental</code> + <code>pg_combinebackup</code>). Dịch vụ managed (RDS, Cloud SQL…) làm PITR thay bạn — nhưng vẫn phải biết cửa sổ retention là bao nhiêu ngày.</p>

    <p><strong>Hai con số phải trả lời được</strong>: RPO (mất tối đa bao nhiêu dữ liệu — với WAL archive thường là vài giây tới một segment; <code>archive_timeout</code> ép chuyển segment khi ít ghi) và RTO (mất bao lâu để chạy lại — phụ thuộc kích thước base backup + lượng WAL phải replay).</p>

    <div class="callout"><p>💡 Backup chưa từng restore thử = không có backup. Lập lịch diễn tập: restore tự động hàng tuần ra máy tạm, chạy vài query kiểm tra, đo thời gian. Đó là cách duy nhất biết RTO thật.</p></div>
  `,

  codeTabs: [
    { id: "dump", label: "① pg_dump", lines: [
      "# định dạng custom (-Fc): nén, restore chọn lọc, song song",
      "pg_dump -h db -U admin -d orders -Fc -f orders_2026-09-27.dump",
      "",
      "# chỉ lấy lại một bảng",
      "pg_restore -d orders_tmp -t order_items orders_2026-09-27.dump",
      "",
      "# restore song song 8 luồng",
      "pg_restore -d orders_new -j 8 orders_2026-09-27.dump",
      "",
      "# pg_dump dùng snapshot REPEATABLE READ → nhất quán, nhưng là transaction dài (bài 05)"
    ]},
    { id: "arch", label: "② WAL archiving", lines: [
      "# postgresql.conf",
      "wal_level = replica",
      "archive_mode = on",
      "archive_command = 'pgbackrest --stanza=main archive-push %p'",
      "archive_timeout = 60s          # ép chuyển segment mỗi phút khi ít ghi → RPO ≤ ~1 phút",
      "",
      "# base backup hằng ngày, incremental mỗi giờ",
      "pgbackrest --stanza=main --type=full backup",
      "pgbackrest --stanza=main --type=incr backup",
      "pgbackrest --stanza=main info"
    ]},
    { id: "pitr", label: "③ PITR tay", lines: [
      "# 1. dựng base backup trước sự cố vào thư mục trống (server tạm)",
      "# 2. postgresql.conf trên server tạm:",
      "restore_command = 'pgbackrest --stanza=main archive-get %f \"%p\"'",
      "recovery_target_time = '2026-09-27 14:31:59+07'",
      "recovery_target_action = 'pause'     # mặc định: dừng lại cho bạn kiểm tra",
      "",
      "# 3. đánh dấu chế độ recovery rồi khởi động",
      "touch $PGDATA/recovery.signal",
      "pg_ctl -D $PGDATA start",
      "",
      "# 4. kiểm tra dữ liệu, rồi: SELECT pg_wal_replay_resume();  hoặc trích bảng cần"
    ]},
    { id: "check", label: "④ Kiểm tra sức khoẻ", lines: [
      "SELECT archived_count, last_archived_wal, last_archived_time,",
      "       failed_count, last_failed_wal, last_failed_time",
      "FROM pg_stat_archiver;",
      "",
      "-- failed_count tăng = WAL không lên kho = PITR có lỗ hổng,",
      "-- và pg_wal/ phình dần vì WAL chưa archive không được xoá",
      "",
      "# pgBackRest: tự động restore diễn tập mỗi tuần",
      "pgbackrest --stanza=main --delta --type=time \\",
      "  --target='2026-09-26 23:00:00+07' --target-action=promote restore"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="bb"><div class="nl">📦 Base backup</div><div class="ns">00:00 hằng ngày</div></div>
      <div class="node" id="wal"><div class="nl">📜 WAL archive (S3)</div><div class="ns">00:00 → 14:32 liên tục</div></div>
    </div>
    <div class="arrow" id="a1">↓ restore base + replay WAL</div>
    <div class="node" id="rep"><div class="nl">⏪ Replay tới recovery_target_time</div><div class="ns">14:31:59 — dừng trước lệnh DELETE</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="tmp"><div class="nl">🧪 Server tạm</div><div class="ns">kiểm tra, trích bảng</div></div>
      <div class="node" id="prod"><div class="nl">🐘 Production</div><div class="ns">chép dữ liệu bị mất trở lại</div></div>
    </div>
  `,
  steps: [
    { title: "1 · pg_dump: tiện nhưng cố định", tab: "dump", highlight: [2, 5, 8, 10], on: ["bb"],
      desc: "Tốt cho restore một bảng, chuyển version, môi trường dev. Chỉ quay về đúng lúc dump; DB vài trăm GB restore rất lâu." },
    { title: "2 · Archive WAL liên tục", tab: "arch", highlight: [3, 4, 5], on: ["wal"],
      desc: "Mỗi segment đầy (hoặc sau archive_timeout) được đẩy lên kho. Đây là 'cuộn phim' cho phép tua tới bất kỳ giây nào." },
    { title: "3 · Base backup định kỳ", tab: "arch", highlight: [8, 9, 10], on: ["bb"],
      desc: "Điểm xuất phát cho replay. Base gần sự cố hơn → ít WAL phải replay → RTO ngắn hơn." },
    { title: "4 · Tua tới 14:31:59", tab: "pitr", highlight: [3, 4, 5, 8, 9], on: ["a1", "rep"],
      desc: "restore_command lấy từng segment từ kho; replay dừng ở recovery_target_time và pause." },
    { title: "5 · Trích dữ liệu, không ghi đè cả production", tab: "pitr", highlight: [11], on: ["a2", "tmp", "prod"],
      desc: "Restore ra server tạm, lấy đúng các row bị xoá, chèn lại production. Giao dịch hợp lệ sau 14:32 được giữ." },
    { title: "6 · Giám sát & diễn tập", tab: "check", highlight: [1, 2, 5, 6, 9, 10], on: ["wal", "tmp"],
      desc: "failed_count &gt; 0 là báo động. Restore diễn tập định kỳ để biết chắc backup dùng được và RTO thật." }
  ],

  quiz: [
    { q: "Muốn khôi phục về 14:31:59 hôm nay (PITR) cần gì?", options: [
        "Chỉ cần pg_dump đêm qua",
        "Base backup trước thời điểm đó + chuỗi WAL archive liên tục tới thời điểm đó",
        "Một replica streaming",
        "Chỉ cần WAL trong pg_wal/"
      ], correct: 1, explanation: "Replica đã nhận lệnh DELETE; pg_dump chỉ quay về lúc dump." },
    { q: "Ưu điểm của pg_dump so với backup vật lý?", options: [
        "Restore DB lớn nhanh hơn",
        "Restore chọn lọc (một bảng), chuyển sang major version khác",
        "Hỗ trợ PITR",
        "Không tốn tài nguyên"
      ], correct: 1, explanation: "Nhược điểm: không PITR, restore DB lớn chậm." },
    { q: "archive_timeout = 60s dùng để làm gì?", options: [
        "Giới hạn thời gian backup",
        "Ép chuyển segment WAL để archive ít nhất mỗi 60s khi hệ thống ít ghi, giới hạn RPO",
        "Xoá WAL cũ",
        "Timeout kết nối S3"
      ], correct: 1, explanation: "Segment chỉ được archive khi đầy hoặc bị ép chuyển." },
    { q: "File nào báo cho PostgreSQL khởi động ở chế độ targeted recovery (PG 12+)?", options: [
        "recovery.conf", "recovery.signal", "standby.conf", "pg_hba.conf"
      ], correct: 1, explanation: "recovery.conf đã bị bỏ từ PG 12; tham số nằm trong postgresql.conf." },
    { q: "pg_stat_archiver.failed_count tăng liên tục nghĩa là?", options: [
        "Bình thường",
        "WAL không lên được kho → có lỗ hổng PITR và pg_wal/ phình dần",
        "Backup đang chạy",
        "Replica bị lag"
      ], correct: 1, explanation: "Segment chưa archive thành công sẽ không bị xoá khỏi pg_wal." },
    { q: "Vì sao nên PITR ra server tạm thay vì ghi đè production?", options: [
        "Nhanh hơn",
        "Để giữ các giao dịch hợp lệ phát sinh sau sự cố; chỉ trích phần dữ liệu bị mất rồi chèn lại",
        "Vì PITR không chạy trên production",
        "Vì licence"
      ], correct: 1, explanation: "Ghi đè production = mất mọi thứ sau thời điểm target." },
    { q: "Cách duy nhất để biết chắc backup dùng được và RTO là bao nhiêu?", options: [
        "Xem dung lượng file backup",
        "Diễn tập restore định kỳ và đo thời gian",
        "Đọc log backup",
        "Hỏi nhà cung cấp cloud"
      ], correct: 1, explanation: "Backup chưa restore thử là giả định." },
    { q: "Công cụ nào là giải pháp backup/PITR chuyên dụng cho PostgreSQL?", options: [
        "pg_trgm", "pgBackRest / WAL-G / Barman", "PgBouncer", "pg_stat_statements"
      ], correct: 1, explanation: "Lo nén, mã hoá, song song, incremental, retention, kiểm tra toàn vẹn." },
    { q: "pg_dump trên DB đang chạy có nhất quán không?", options: [
        "Không, dữ liệu lộn xộn",
        "Có, nó chạy trong một snapshot (REPEATABLE READ) — nhưng là transaction dài, giữ xmin",
        "Chỉ khi dừng DB",
        "Chỉ với bảng nhỏ"
      ], correct: 1, explanation: "Dump lâu trên primary bận có thể cản VACUUM; cân nhắc dump từ replica." }
  ]
});
