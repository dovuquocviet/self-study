window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "MVCC & VACUUM",
  title: "Transaction ID wraparound & freeze — sự cố có thể làm DB ngừng ghi",
  subtitle: "XID 32-bit · so sánh vòng tròn · freeze · anti-wraparound autovacuum · theo dõi age()",

  theory: `
    <p>XID (bài 03) chỉ có <strong>32 bit</strong> ≈ 4,2 tỉ giá trị. Một hệ thống ghi 2.000 transaction/giây sẽ dùng hết ~2 tỉ XID trong khoảng 12 ngày. PostgreSQL sống được nhiều năm nhờ <strong>so sánh XID theo vòng tròn</strong> và <strong>freeze</strong>.</p>

    <p><strong>So sánh vòng tròn</strong>: với một XID bất kỳ, ~2,1 tỉ XID "phía trước" coi là tương lai, ~2,1 tỉ "phía sau" coi là quá khứ. Nếu một tuple có xmin cũ hơn 2,1 tỉ transaction mà vẫn để nguyên, đột nhiên nó sẽ bị coi là "ở tương lai" → <strong>biến mất</strong> khỏi mọi truy vấn. Đó là mất dữ liệu kiểu wraparound.</p>

    <p><strong>Freeze</strong>: VACUUM đánh dấu tuple đủ cũ là <em>frozen</em> (một bit trong infomask) = "được tạo ở quá khứ vô hạn, ai cũng thấy". Sau đó xmin không còn tham gia so sánh nữa. Mỗi bảng lưu <code>relfrozenxid</code>: mọi XID cũ hơn giá trị này trong bảng đã được freeze. <code>age(relfrozenxid)</code> = bảng đang "nợ" bao nhiêu transaction.</p>

    <table>
      <tr><th>Tham số</th><th>Mặc định</th><th>Ý nghĩa</th></tr>
      <tr><td><code>vacuum_freeze_min_age</code></td><td>50 triệu</td><td>Tuple cũ hơn mức này sẽ được freeze khi VACUUM đi qua trang</td></tr>
      <tr><td><code>vacuum_freeze_table_age</code></td><td>150 triệu</td><td>age vượt mức này → VACUUM chạy chế độ <em>aggressive</em>: quét mọi trang chưa all-frozen</td></tr>
      <tr><td><code>autovacuum_freeze_max_age</code></td><td>200 triệu</td><td>Vượt mức này → <strong>bắt buộc</strong> chạy autovacuum "to prevent wraparound", kể cả khi autovacuum bị tắt</td></tr>
      <tr><td><code>vacuum_failsafe_age</code> (PG 14+)</td><td>1,6 tỉ</td><td>Chế độ khẩn cấp: bỏ qua dọn index và cost delay để freeze nhanh nhất</td></tr>
    </table>

    <p><strong>Nếu vẫn không kịp</strong>: còn ~40 triệu XID tới giới hạn, log bắt đầu cảnh báo; còn ~3 triệu, PostgreSQL <strong>từ chối cấp XID mới</strong> — mọi INSERT/UPDATE/DELETE lỗi, chỉ còn đọc được. Hướng xử lý theo docs hiện tại: chạy <code>VACUUM</code> thường (bằng superuser) trên các bảng có age cao nhất, loại bỏ trước thứ đang ghim horizon (transaction cũ, slot, prepared xact). Đã có những sự cố production nổi tiếng kéo dài hàng giờ vì chuyện này.</p>

    <p><strong>Anti-wraparound autovacuum khác thường ở chỗ</strong>: nó không tự nhường khi gặp xung đột khoá (autovacuum thường sẽ tự huỷ để nhường DDL). Vì vậy một <code>ALTER TABLE</code> có thể bị kẹt sau nó — đừng giết nó liên tục, nó sẽ chạy lại.</p>

    <p><strong>MultiXact</strong> (khi nhiều transaction cùng khoá một row, vd FOR SHARE/FK check) cũng có bộ đếm 32-bit riêng và cơ chế tương tự (<code>autovacuum_multixact_freeze_max_age</code> = 400 triệu).</p>

    <div class="callout"><p>💡 Cần alert trên <code>age(datfrozenxid)</code>: cảnh báo khi vượt ~500 triệu, khẩn cấp khi vượt ~1 tỉ. Bảng lớn append-only (event log) là ứng viên hàng đầu vì ít khi có lý do khác để VACUUM ghé qua — PG 13+ đã có vacuum theo số INSERT giúp giảm rủi ro này.</p></div>
  `,

  codeTabs: [
    { id: "age", label: "① Theo dõi age", lines: [
      "-- mức database",
      "SELECT datname, age(datfrozenxid) AS xid_age,",
      "       round(100.0 * age(datfrozenxid) / 2147483647, 1) AS pct_to_wrap",
      "FROM pg_database ORDER BY xid_age DESC;",
      "",
      "-- mức bảng (kể cả TOAST)",
      "SELECT c.oid::regclass AS tbl, age(c.relfrozenxid) AS xid_age,",
      "       pg_size_pretty(pg_table_size(c.oid)) AS size",
      "FROM pg_class c WHERE c.relkind IN ('r', 'm', 't')",
      "ORDER BY age(c.relfrozenxid) DESC LIMIT 10;"
    ]},
    { id: "log", label: "② Log khi sắp cạn", lines: [
      "WARNING:  database \"orders\" must be vacuumed within 38123456 transactions",
      "HINT:  To avoid XID assignment failures, execute a database-wide VACUUM in that database.",
      "",
      "# ... bỏ qua cảnh báo ...",
      "",
      "ERROR:  database is not accepting commands that assign new transaction IDs",
      "        to avoid wraparound data loss in database \"orders\"",
      "HINT:  Execute a database-wide VACUUM in that database."
    ]},
    { id: "act", label: "③ autovacuum chống wraparound", lines: [
      "SELECT pid, now() - xact_start AS running, query",
      "FROM pg_stat_activity",
      "WHERE backend_type = 'autovacuum worker';",
      "",
      "--  pid  | running  | query",
      "-- 48121 | 02:14:07 | autovacuum: VACUUM public.events (to prevent wraparound)",
      "",
      "SELECT relid::regclass, phase, heap_blks_scanned, heap_blks_total",
      "FROM pg_stat_progress_vacuum;"
    ]},
    { id: "fix", label: "④ Phòng & chữa", lines: [
      "-- phòng: bảng append-only lớn, freeze sớm hơn",
      "ALTER TABLE events SET (autovacuum_freeze_max_age = 100000000,",
      "                        autovacuum_vacuum_insert_scale_factor = 0.05);",
      "",
      "-- chữa: gỡ thứ ghim horizon trước (bài 05), rồi",
      "SET maintenance_work_mem = '2GB';",
      "VACUUM (VERBOSE) events;          -- VACUUM thường, KHÔNG phải VACUUM FULL",
      "",
      "-- công cụ tiện: vacuumdb --all --freeze --jobs=4  (chạy song song các bảng)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ring"><div class="nl">⭕ Vòng XID 32-bit</div><div class="ns">~2,1 tỉ quá khứ · ~2,1 tỉ tương lai</div></div>
    <div class="arrow" id="a1">↓ tuple chưa freeze, age tăng dần</div>
    <div class="row">
      <div class="node" id="m50"><div class="nl">50M</div><div class="ns">freeze khi đi qua</div></div>
      <div class="node" id="m150"><div class="nl">150M</div><div class="ns">VACUUM aggressive</div></div>
      <div class="node" id="m200"><div class="nl">200M</div><div class="ns">autovacuum bắt buộc</div></div>
    </div>
    <div class="arrow" id="a2">↓ nếu vẫn bị ghim…</div>
    <div class="row">
      <div class="node" id="warn"><div class="nl">⚠️ còn ~40M</div><div class="ns">WARNING trong log</div></div>
      <div class="node" id="stop"><div class="nl">🛑 còn ~3M</div><div class="ns">từ chối ghi</div></div>
    </div>
  `,
  steps: [
    { title: "1 · XID là vòng tròn", tab: "age", highlight: [2, 3], on: ["ring"],
      desc: "Mọi thứ đo bằng <code>age()</code> = số transaction đã trôi qua kể từ XID đó. Giới hạn an toàn ~2,1 tỉ (2^31)." },
    { title: "2 · Freeze định kỳ", tab: "fix", highlight: [2, 3], on: ["a1", "m50", "m150"],
      desc: "VACUUM thường freeze những tuple cũ hơn 50M. Khi age bảng vượt 150M, VACUUM quét cả những trang nó hay bỏ qua." },
    { title: "3 · Autovacuum chống wraparound", tab: "act", highlight: [6], on: ["m200"],
      desc: "Vượt 200M: autovacuum bắt buộc, có chữ '(to prevent wraparound)', không nhường khoá cho DDL." },
    { title: "4 · Cảnh báo rồi dừng ghi", tab: "log", highlight: [1, 6, 7], on: ["a2", "warn", "stop"],
      desc: "Không ai đọc log → tới lúc DB từ chối cấp XID mới. Ứng dụng nhận lỗi ở mọi thao tác ghi." },
    { title: "5 · Chữa cháy", tab: "fix", highlight: [5, 6, 7, 9], on: ["stop"],
      desc: "Gỡ thứ ghim horizon, rồi VACUUM các bảng có age lớn nhất. Sau đó đặt alert trên age(datfrozenxid)." }
  ],

  quiz: [
    { q: "XID trong PostgreSQL rộng bao nhiêu bit?", options: ["16", "32", "64", "128"], correct: 1,
      explanation: "32 bit nên cần so sánh vòng tròn và freeze. (Giá trị 64-bit hiển thị qua pg_current_xact_id có thêm epoch, nhưng trên tuple chỉ lưu 32 bit.)" },
    { q: "Freeze một tuple nghĩa là gì?", options: [
        "Khoá row không cho sửa",
        "Đánh dấu tuple là tạo ở 'quá khứ vô hạn', mọi transaction đều thấy, xmin không còn tham gia so sánh",
        "Nén tuple",
        "Chuyển tuple sang TOAST"
      ], correct: 1, explanation: "Nhờ đó XID có thể quay vòng mà không làm tuple cũ biến mất." },
    { q: "Nếu không freeze, tuple có xmin cũ hơn ~2,1 tỉ transaction sẽ?", options: [
        "Bị xoá vật lý",
        "Bị coi như ở tương lai và trở nên vô hình",
        "Không sao cả",
        "Được tự động freeze khi đọc"
      ], correct: 1, explanation: "Đó là 'wraparound data loss' mà PostgreSQL phải từ chối ghi để ngăn." },
    { q: "autovacuum_freeze_max_age mặc định và hệ quả khi vượt?", options: [
        "2 tỉ; DB tắt",
        "200 triệu; bắt buộc chạy autovacuum chống wraparound kể cả khi autovacuum bị tắt",
        "50 triệu; freeze tuple",
        "1 triệu; cảnh báo"
      ], correct: 1, explanation: "Đây là 'chạy dù thế nào đi nữa' — tắt autovacuum không ngăn được nó." },
    { q: "Khi DB báo 'not accepting commands that assign new transaction IDs', hướng xử lý đúng?", options: [
        "Restart server là hết",
        "Gỡ thứ ghim horizon rồi chạy VACUUM thường trên các bảng có age lớn nhất",
        "VACUUM FULL toàn bộ",
        "DROP các bảng lớn"
      ], correct: 1, explanation: "VACUUM FULL không cần thiết và rất chậm; thứ cần là freeze." },
    { q: "Truy vấn nào dùng để theo dõi nguy cơ wraparound ở mức database?", options: [
        "SELECT count(*) FROM pg_stat_activity",
        "SELECT datname, age(datfrozenxid) FROM pg_database",
        "SHOW max_connections",
        "SELECT * FROM pg_locks"
      ], correct: 1, explanation: "Mức bảng thì dùng age(relfrozenxid) trên pg_class." },
    { q: "Điểm khác biệt của anti-wraparound autovacuum về khoá?", options: [
        "Nó giữ ACCESS EXCLUSIVE",
        "Nó không tự huỷ để nhường khi có DDL chờ khoá, nên DDL có thể bị kẹt sau nó",
        "Nó không cần khoá",
        "Nó chặn SELECT"
      ], correct: 1, explanation: "Autovacuum thường sẽ tự huỷ khi chặn người khác; bản chống wraparound thì không." },
    { q: "vacuum_failsafe_age (PG 14+) làm gì?", options: [
        "Tắt autovacuum",
        "Khi age quá cao, VACUUM bỏ qua dọn index và cost delay để freeze nhanh nhất có thể",
        "Tự động restore backup",
        "Tăng XID lên 64 bit"
      ], correct: 1, explanation: "Mặc định 1,6 tỉ." },
    { q: "Loại bảng nào dễ bị bỏ quên freeze nhất trước PG 13?", options: [
        "Bảng UPDATE liên tục",
        "Bảng lớn chỉ INSERT (append-only) vì không sinh dead tuple nên ít khi được vacuum",
        "Bảng nhỏ",
        "Bảng tạm"
      ], correct: 1, explanation: "PG 13 thêm trigger vacuum theo số row INSERT." }
  ]
});
