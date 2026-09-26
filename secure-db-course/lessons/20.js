window.LESSONS.push({
  id: "20",
  phase: "6", phaseName: "Vận hành",
  title: "Backup & khôi phục an toàn",
  subtitle: "Backup là bản sao đầy đủ của dữ liệu · mã hoá · quyền truy cập · backup bất biến chống ransomware · replication không phải backup · test restore định kỳ",

  theory: `
    <p>Backup phục vụ hai mục tiêu bảo mật trái ngược nhau: <strong>tính sẵn sàng</strong> (khôi phục được khi dữ liệu bị xoá/mã hoá/hỏng) và <strong>tính bí mật</strong>
    (backup là bản sao <em>đầy đủ</em> của dữ liệu — lộ backup = lộ DB). Một chiến lược tốt phải thoả mãn cả hai.</p>

    <p><strong>1. Những sai lầm thường gặp</strong></p>
    <ul>
      <li>File dump để trong bucket public, trong thư mục web, trên laptop cá nhân, trong ổ chia sẻ của team.</li>
      <li>Backup không mã hoá, hoặc mã hoá bằng khoá nằm ngay cạnh file backup.</li>
      <li>Backup nằm cùng tài khoản cloud/cùng quyền với DB → kẻ chiếm được tài khoản xoá cả DB lẫn backup (kịch bản ransomware điển hình).</li>
      <li>Coi <strong>replication là backup</strong>: lệnh xoá nhầm hay dữ liệu bị mã hoá được sao chép sang replica ngay lập tức.</li>
      <li>Chưa bao giờ thử khôi phục — đến ngày cần mới biết backup hỏng, thiếu WAL, hoặc mất khoá giải mã.</li>
    </ul>

    <p><strong>2. Nguyên tắc 3-2-1-1-0</strong></p>
    <ul>
      <li><strong>3</strong> bản dữ liệu, trên <strong>2</strong> loại lưu trữ, <strong>1</strong> bản ở nơi khác (khu vực/tài khoản khác),</li>
      <li><strong>1</strong> bản <em>bất biến</em> hoặc tách mạng (immutable/offline),</li>
      <li><strong>0</strong> lỗi khi kiểm tra khôi phục.</li>
    </ul>

    <p><strong>3. Bảo vệ tính bí mật của backup</strong></p>
    <ul>
      <li><strong>Mã hoá phía client</strong> trước khi đẩy lên kho lưu (pgBackRest <code>repo1-cipher-type</code>, WAL-G libsodium, <code>age</code>/<code>gpg</code> cho dump, mật khẩu cho file backup ClickHouse);
        khoá nằm trong secret manager/KMS, tách khỏi kho backup.</li>
      <li><strong>Quyền truy cập riêng</strong>: tài khoản ghi backup chỉ được <em>ghi</em> (không đọc lại, không xoá); người được đọc/khôi phục backup là nhóm rất nhỏ, có log.</li>
      <li><strong>Tài khoản DB dùng để backup</strong> có quyền đọc mọi thứ (Postgres <code>pg_read_all_data</code>/replication, Mongo role <code>backup</code>) → bảo vệ như tài khoản admin, chỉ dùng từ máy backup.</li>
      <li>Retention của backup phù hợp chính sách dữ liệu (bài 15): backup giữ PII bao lâu thì PII tồn tại bấy lâu.</li>
    </ul>

    <p><strong>4. Bảo vệ tính sẵn sàng: backup bất biến</strong></p>
    <p>Ransomware hiện đại tìm và xoá backup trước khi mã hoá dữ liệu. Backup bất biến (WORM — write once, read many) không thể bị xoá hay sửa trong thời gian khoá, <em>kể cả bởi admin</em>:
    S3 Object Lock chế độ compliance, bucket lock của R2, vault lock của dịch vụ backup cloud, snapshot có khoá xoá. Kết hợp: kho backup ở tài khoản cloud riêng, MFA cho thao tác xoá.</p>

    <p><strong>5. Theo từng engine</strong></p>
    <table>
      <tr><th>Engine</th><th>Cách backup</th><th>Lưu ý bảo mật</th></tr>
      <tr><td>PostgreSQL</td><td>Base backup + WAL archive (PITR) bằng pgBackRest/WAL-G; <code>pg_dump</code> cho logic backup</td><td>Bật mã hoá repo; WAL archive cũng chứa dữ liệu — mã hoá như nhau</td></tr>
      <tr><td>Redis</td><td>Sao chép file RDB/AOF sau <code>BGSAVE</code></td><td>File dạng rõ → mã hoá trước khi chuyển đi; chỉ backup instance cần giữ (session/queue), không backup cache</td></tr>
      <tr><td>MongoDB</td><td><code>mongodump</code>, snapshot volume, Atlas Cloud Backup</td><td>Role <code>backup</code> đọc được mọi db; nén + mã hoá output</td></tr>
      <tr><td>ClickHouse</td><td><code>BACKUP ... TO Disk(...)</code>/<code>S3(...)</code>, công cụ clickhouse-backup</td><td>Không viết access key S3 trực tiếp trong câu lệnh (nằm lại trong query_log) — cấu hình disk/named collection; đặt mật khẩu cho archive</td></tr>
      <tr><td>Kafka</td><td>MirrorMaker 2 sang cụm DR; cấu hình topic/ACL dưới dạng IaC</td><td>Mirror là replication — lệnh xoá cũng sang; cần retention đủ dài ở cụm DR hoặc sink ra object storage bất biến</td></tr>
      <tr><td>Cloudflare</td><td>D1 Time Travel (khôi phục về thời điểm trong cửa sổ retention), <code>wrangler d1 export</code>; R2 bucket lock; KV/DO: tự export định kỳ nếu cần</td><td>File export là bản sao đầy đủ — mã hoá và lưu nơi có quyền hẹp</td></tr>
    </table>

    <p><strong>6. Test restore — backup chưa thử khôi phục chỉ là giả thuyết</strong></p>
    <ul>
      <li>Tự động khôi phục định kỳ (ví dụ hàng tuần) vào môi trường cô lập, chạy truy vấn kiểm tra (số dòng, checksum, bản ghi mới nhất) và báo cáo.</li>
      <li>Đo <strong>RTO</strong> (mất bao lâu để khôi phục) và <strong>RPO</strong> (mất tối đa bao nhiêu dữ liệu) thật, so với cam kết.</li>
      <li>Môi trường khôi phục thử chứa dữ liệu thật → cùng mức bảo vệ như prod, xoá sau khi kiểm tra; không biến nó thành "môi trường dev có dữ liệu thật" (bài 23).</li>
      <li>Diễn tập cả kịch bản mất khoá: khoá giải mã backup có được sao lưu an toàn ở nơi khác không?</li>
    </ul>

    <div class="callout"><p>💡 Câu hỏi kiểm tra: "Nếu kẻ tấn công có toàn quyền trên tài khoản cloud chứa DB trong 1 giờ, họ có xoá được mọi bản backup không?"
    Nếu câu trả lời là "có" — bạn chưa có backup chống ransomware.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "🐘 pgBackRest", lines: [
      "# /etc/pgbackrest/pgbackrest.conf",
      "[global]",
      "repo1-type=s3",
      "repo1-s3-bucket=shop-db-backups            # bucket ở tài khoản backup riêng, Object Lock",
      "repo1-s3-region=ap-southeast-1",
      "repo1-s3-endpoint=s3.ap-southeast-1.amazonaws.com",
      "repo1-path=/pg/shop",
      "repo1-cipher-type=aes-256-cbc               # mã hoá phía client",
      "repo1-cipher-pass=<tu-secret-manager>",
      "repo1-retention-full=4",
      "",
      "[shop]",
      "pg1-path=/var/lib/postgresql/16/main",
      "",
      "# postgresql.conf: WAL archive cho PITR",
      "archive_mode = on",
      "archive_command = 'pgbackrest --stanza=shop archive-push %p'"
    ]},
    { id: "others", label: "🟥🍃🟨 Engine khác", lines: [
      "# Redis: snapshot rồi mã hoá trước khi chuyển đi",
      "redis-cli --tls ... BGSAVE",
      "age -r <public-key-backup> -o dump-2026-09-26.rdb.age /var/lib/redis/dump.rdb",
      "",
      "# MongoDB: dump nén + mã hoá, user có role 'backup' chỉ dùng từ máy backup",
      "mongodump --uri \"$MONGO_BACKUP_URI\" --archive --gzip | age -r <public-key-backup> > orders-2026-09-26.archive.gz.age",
      "",
      "-- ClickHouse: dùng disk đã cấu hình (không viết access key trong SQL), archive có mật khẩu",
      "BACKUP DATABASE analytics TO Disk('backups', 'analytics-2026-09-26.zip')",
      "  SETTINGS password = '<tu-secret-manager>';",
      "RESTORE DATABASE analytics AS analytics_restore_test FROM Disk('backups', 'analytics-2026-09-26.zip')",
      "  SETTINGS password = '<tu-secret-manager>';"
    ]},
    { id: "cf", label: "☁️ D1 & R2", lines: [
      "# D1 Time Travel: xem và khôi phục về một thời điểm trong cửa sổ retention",
      "wrangler d1 time-travel info shop-prod",
      "wrangler d1 time-travel restore shop-prod --timestamp=2026-09-26T02:00:00Z",
      "",
      "# Export định kỳ ra file (bản sao đầy đủ -> mã hoá, lưu nơi quyền hẹp)",
      "wrangler d1 export shop-prod --remote --output=shop-2026-09-26.sql",
      "age -r <public-key-backup> -o shop-2026-09-26.sql.age shop-2026-09-26.sql && shred -u shop-2026-09-26.sql",
      "",
      "# Bucket R2 chứa backup: private, bật bucket lock (giữ tối thiểu N ngày, không xoá được),",
      "# token ghi backup chỉ có quyền ghi vào đúng bucket này"
    ]},
    { id: "immut", label: "🔒 Bất biến & quyền", lines: [
      "// Tách quyền kho backup",
      "backup-writer : PutObject only           // không Get, không Delete",
      "restore-team  : GetObject, có MFA, có log // nhóm rất nhỏ",
      "nobody        : Delete trong thời gian lock (kể cả admin)",
      "",
      "# S3 Object Lock chế độ COMPLIANCE: không ai xoá/sửa được trong 35 ngày",
      "aws s3api put-object-lock-configuration --bucket shop-db-backups \\",
      "  --object-lock-configuration '{\"ObjectLockEnabled\":\"Enabled\",\"Rule\":{\"DefaultRetention\":{\"Mode\":\"COMPLIANCE\",\"Days\":35}}}'",
      "",
      "// Kafka: MirrorMaker 2 là replication, KHÔNG phải backup",
      "// -> thêm sink ra object storage bất biến cho topic quan trọng"
    ]},
    { id: "drill", label: "🧪 Test restore", lines: [
      "// Chạy tự động mỗi tuần",
      "job restore_drill:",
      "    env = create_isolated_env(network='no-internet', ttl='6h')",
      "    t0 = now()",
      "    restore_latest_backup(env, key = kms.decrypt(backup_key_wrapped))",
      "    assert env.query('SELECT count(*) FROM orders') >= expected_min_rows",
      "    assert env.query('SELECT max(created_at) FROM orders') >= now() - RPO",
      "    assert checksum_sample(env) == checksum_sample(prod_snapshot_meta)",
      "    report(rto = now() - t0)",
      "    destroy(env)                      // dữ liệu thật: không giữ lại làm môi trường dev"
    ]}
  ],

  stageHtml: `
    <div class="node" id="dbp"><div class="nl">🗄️ DB production</div><div class="ns">tài khoản cloud A</div></div>
    <div class="arrow" id="a1">↓ backup-writer (chỉ ghi) · mã hoá phía client</div>
    <div class="row">
      <div class="node" id="vault"><div class="nl">🔒 Kho backup bất biến</div><div class="ns">tài khoản B · Object Lock / bucket lock</div></div>
      <div class="node" id="keys"><div class="nl">🔐 Khoá giải mã</div><div class="ns">KMS/secret, tách khỏi kho</div></div>
    </div>
    <div class="arrow" id="a2">↓ restore drill hằng tuần</div>
    <div class="node" id="iso"><div class="nl">🧪 Môi trường khôi phục cô lập</div><div class="ns">kiểm tra số dòng, checksum · đo RTO/RPO · huỷ sau khi xong</div></div>
    <div class="node" id="ransom"><div class="nl">🦠 Kẻ chiếm tài khoản A</div><div class="ns">xoá được DB, không xoá được backup</div></div>
  `,
  steps: [
    { title: "1 · Mã hoá phía client, khoá tách riêng", tab: "pg", highlight: [3, 4, 8, 9, 10], on: ["dbp", "a1", "vault", "keys"],
      desc: "pgBackRest mã hoá trước khi đẩy lên kho; mật khẩu mã hoá lấy từ secret manager, không nằm cạnh backup." },
    { title: "2 · PITR: WAL archive cũng là dữ liệu", tab: "pg", highlight: [16, 17], on: ["vault"],
      desc: "WAL archive cho phép khôi phục tới từng thời điểm — và chứa mọi thay đổi dữ liệu, nên được mã hoá như backup." },
    { title: "3 · Redis, Mongo, ClickHouse", tab: "others", highlight: [3, 6, 9, 10, 11], on: ["vault", "keys"],
      desc: "Mã hoá output bằng khoá công khai (<code>age</code>); ClickHouse dùng disk đã cấu hình và mật khẩu archive thay vì viết access key trong SQL." },
    { title: "4 · D1 Time Travel & export", tab: "cf", highlight: [2, 3, 6, 7, 9, 10], on: ["dbp", "vault"],
      desc: "Time Travel khôi phục về thời điểm trong cửa sổ retention. File export là bản sao đầy đủ → mã hoá, xoá bản rõ, lưu trong bucket khoá." },
    { title: "5 · Bất biến + tách quyền chống ransomware", tab: "immut", highlight: [2, 3, 4, 7, 8, 10, 11], on: ["vault", "ransom"],
      desc: "Người ghi backup không xoá được; không ai xoá được trong thời gian lock. Replication/mirror không thay thế backup." },
    { title: "6 · Test restore định kỳ", tab: "drill", highlight: [3, 5, 6, 7, 8, 9, 10], on: ["a2", "iso"],
      desc: "Khôi phục tự động vào môi trường cô lập, kiểm tra dữ liệu, đo RTO/RPO thật, rồi huỷ môi trường." }
  ],

  quiz: [
    { q: "Vì sao replication (replica, MirrorMaker) không thay thế được backup?", options: [
        "Vì replication chậm",
        "Vì replication tốn tiền hơn",
        "Vì replica không mã hoá được",
        "Lệnh xoá nhầm hoặc dữ liệu bị mã hoá bởi ransomware được sao chép sang replica gần như ngay lập tức"
      ], correct: 3,
      explanation: "Replication bảo vệ khỏi hỏng máy, không bảo vệ khỏi thao tác phá huỷ." },
    { q: "Backup bất biến (Object Lock compliance, bucket lock) chống lại điều gì?", options: [
        "SQL injection",
        "Mất điện",
        "Kẻ chiếm tài khoản (kể cả admin) xoá/sửa backup trước khi tống tiền",
        "Truy vấn chậm"
      ], correct: 2,
      explanation: "Trong thời gian khoá, không ai xoá hay sửa được object." },
    { q: "Tài khoản ghi backup nên có quyền gì trên kho backup?", options: [
        "Chỉ ghi (không đọc lại, không xoá)",
        "Toàn quyền",
        "Chỉ xoá",
        "Đọc và xoá"
      ], correct: 0,
      explanation: "Máy backup bị chiếm cũng không dùng được quyền đó để đọc hay xoá backup cũ." },
    { q: "Vì sao không viết access key S3 trực tiếp trong câu BACKUP ... TO S3(...) của ClickHouse?", options: [
        "Vì cú pháp không cho phép",
        "Vì S3 không hỗ trợ",
        "Vì chậm hơn",
        "Câu lệnh (kèm key) nằm lại trong system.query_log và log khác"
      ], correct: 3,
      explanation: "Dùng disk/named collection đã cấu hình để credential không đi qua SQL." },
    { q: "Nguyên tắc '3-2-1-1-0' — số 0 cuối nghĩa là gì?", options: [
        "0 chi phí",
        "0 lỗi khi kiểm tra khôi phục",
        "0 bản sao ngoài site",
        "0 mã hoá"
      ], correct: 1,
      explanation: "Backup phải được chứng minh khôi phục được." },
    { q: "Khoá giải mã backup nên nằm ở đâu?", options: [
        "Trong KMS/secret manager tách khỏi kho backup, và bản thân khoá cũng có phương án khôi phục",
        "Cùng bucket với backup",
        "Trong file README của repo",
        "Không cần khoá"
      ], correct: 0,
      explanation: "Khoá cạnh backup = không mã hoá; mất khoá = mất backup." },
    { q: "D1 Time Travel dùng để làm gì?", options: [
        "Tăng tốc truy vấn",
        "Mã hoá D1",
        "Khôi phục database về một thời điểm trong cửa sổ retention",
        "Nhân bản D1 sang vùng khác"
      ], correct: 2,
      explanation: "Hữu ích khi xoá nhầm; export định kỳ vẫn cần cho bản sao nằm ngoài D1." },
    { q: "Môi trường dùng để test restore chứa dữ liệu thật. Nên xử lý thế nào sau khi kiểm tra?", options: [
        "Giữ lại cho dev dùng",
        "Huỷ môi trường; trong lúc chạy bảo vệ như prod",
        "Chia sẻ cho QA",
        "Chuyển thành staging"
      ], correct: 1,
      explanation: "Không để test restore trở thành đường đưa dữ liệu prod ra môi trường kém bảo vệ." },
    { q: "Role 'backup' của MongoDB (hay pg_read_all_data của Postgres) cần bảo vệ thế nào?", options: [
        "Như tài khoản thường",
        "Cấp cho mọi dev",
        "Không cần bảo vệ vì chỉ đọc",
        "Như tài khoản admin: đọc được mọi dữ liệu, chỉ dùng từ máy backup, credential trong secret manager"
      ], correct: 3,
      explanation: "Quyền đọc tất cả là quyền rất lớn." }
  ]
});
