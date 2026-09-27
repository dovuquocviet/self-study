window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Transaction, đồng thời & truy vấn",
  title: "MVCC — người đọc không chặn người ghi",
  subtitle: "xmin/xmax · snapshot · UPDATE = tuple mới · dead tuple & VACUUM · undo log ở InnoDB · WiredTiger",

  theory: `
    <p>Nếu chỉ dùng lock, người đọc phải chờ người ghi và ngược lại. <strong>MVCC</strong> (Multi-Version Concurrency Control) giữ <em>nhiều phiên bản</em> của một dòng:
    mỗi transaction đọc từ một <strong>snapshot</strong> — ảnh chụp "những gì đã commit tại thời điểm X" — nên đọc không cần chờ ai.</p>

    <p><strong>PostgreSQL làm thế nào</strong></p>
    <ul>
      <li>Mỗi transaction ghi có một số <code>xid</code> tăng dần. Mỗi tuple có hai trường ẩn: <code>xmin</code> (xid tạo ra nó) và <code>xmax</code> (xid xoá/thay nó, 0 nếu còn sống).</li>
      <li><strong>INSERT</strong>: tuple mới với <code>xmin</code> = xid hiện tại.</li>
      <li><strong>DELETE</strong>: không xoá vật lý, chỉ đặt <code>xmax</code>.</li>
      <li><strong>UPDATE</strong> = DELETE + INSERT: đặt <code>xmax</code> cho tuple cũ, tạo tuple mới ở chỗ khác (ctid đổi).</li>
      <li><strong>Snapshot</strong> gồm: xid nhỏ nhất còn đang chạy, xid kế tiếp, và danh sách xid đang chạy. Tuple <em>thấy được</em> nếu <code>xmin</code> đã commit trước snapshot và <code>xmax</code> chưa (hoặc rỗng, hoặc đã abort).</li>
    </ul>

    <p><strong>Cái giá: dead tuple</strong>. Phiên bản cũ nằm lại trong page tới khi không snapshot nào còn cần. <strong>VACUUM</strong> (autovacuum chạy nền) dọn chúng, đánh dấu chỗ trống để tái sử dụng,
    cập nhật visibility map. Nếu không: bảng và index phình (<em>bloat</em>), quét chậm dần.</p>
    <ul>
      <li>Một transaction mở quên đóng (<code>idle in transaction</code>) giữ snapshot cũ → VACUUM không dọn được gì mới hơn nó → bloat lan khắp DB.</li>
      <li><strong>HOT update</strong> (Heap-Only Tuple): nếu không cột nào có index bị đổi và page còn chỗ, tuple mới nằm cùng page và index <em>không</em> phải cập nhật. Để lại chỗ bằng <code>fillfactor</code> &lt; 100.</li>
      <li>xid chỉ 32 bit → phải <em>freeze</em> tuple cũ định kỳ để tránh wraparound; autovacuum lo việc này, đừng tắt nó.</li>
    </ul>

    <p><strong>Cách khác: undo log (InnoDB, Oracle)</strong>. UPDATE sửa tại chỗ, bản cũ ghi vào undo log; người đọc cần phiên bản cũ thì dựng lại từ undo.
    Bảng không phình, nhưng transaction dài làm undo log (history list) dài và đọc cũ chậm. Cùng vấn đề, khác chỗ chứa rác.</p>

    <p><strong>MongoDB WiredTiger</strong>: giữ chuỗi phiên bản của document trong cache; snapshot cũ phải được giữ trong RAM nên transaction mặc định bị giới hạn
    60 giây (<code>transactionLifetimeLimitSeconds</code>). <strong>ClickHouse, Lucene</strong>: dữ liệu bất biến theo part/segment — "phiên bản" chính là tập part/segment mà truy vấn nhìn thấy lúc bắt đầu.</p>

    <div class="callout"><p>💡 Với dev Spring: <code>@Transactional</code> bọc cả một method gọi HTTP chậm 30 giây là đang giữ snapshot 30 giây. Nhân với trăm request đồng thời là
    autovacuum bó tay. Theo dõi <code>pg_stat_activity</code> tìm <code>idle in transaction</code> và đặt <code>idle_in_transaction_session_timeout</code>.</p></div>
  `,

  codeTabs: [
    { id: "hidden", label: "Soi xmin/xmax", lines: [
      "BEGIN;  SELECT txid_current();            -- 900",
      "INSERT INTO items(id, qty) VALUES (1, 10);",
      "COMMIT;",
      "SELECT ctid, xmin, xmax, * FROM items;   -- (0,1) | 900 | 0 | 1 | 10",
      "",
      "BEGIN;  SELECT txid_current();            -- 901",
      "UPDATE items SET qty = 9 WHERE id = 1;",
      "COMMIT;",
      "SELECT ctid, xmin, xmax, * FROM items;   -- (0,2) | 901 | 0 | 1 | 9",
      "-- tuple cũ (0,1) vẫn nằm trong page với xmax = 901 → dead tuple"
    ]},
    { id: "snap", label: "Hai session song song", lines: [
      "-- Session A (REPEATABLE READ)            -- Session B",
      "BEGIN ISOLATION LEVEL REPEATABLE READ;",
      "SELECT qty FROM items WHERE id = 1;  -- 9",
      "                                          UPDATE items SET qty = 5 WHERE id = 1;",
      "                                          -- autocommit, xid 905 commit",
      "SELECT qty FROM items WHERE id = 1;  -- vẫn 9",
      "-- snapshot của A chụp trước 905 → tuple xmin=905 vô hình với A",
      "COMMIT;",
      "SELECT qty FROM items WHERE id = 1;  -- 5"
    ]},
    { id: "vacuum", label: "Bloat & VACUUM", lines: [
      "SELECT relname, n_live_tup, n_dead_tup, last_autovacuum",
      "FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;",
      "",
      "-- transaction mở quá lâu giữ snapshot cũ:",
      "SELECT pid, state, now() - xact_start AS age, query",
      "FROM pg_stat_activity WHERE state = 'idle in transaction';",
      "",
      "ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';",
      "ALTER TABLE items SET (fillfactor = 85);   -- chừa chỗ cho HOT update"
    ]},
    { id: "undo", label: "Undo log (InnoDB)", lines: [
      "UPDATE items SET qty = 9 WHERE id = 1;",
      "",
      "# PostgreSQL: page chứa CẢ tuple cũ (qty=10, xmax=901) và tuple mới (qty=9)",
      "# InnoDB:     page chỉ chứa qty=9; bản qty=10 nằm trong undo log,",
      "#             dòng có con trỏ roll_ptr tới bản cũ",
      "",
      "# reader cần bản cũ → PostgreSQL đọc tuple cũ trong heap",
      "#                    → InnoDB dựng lại từ undo theo roll_ptr"
    ]}
  ],

  stageHtml: `
    <div class="node" id="t1"><div class="nl">tuple v1 · qty=10</div><div class="ns">xmin=900 · xmax=901</div></div>
    <div class="arrow" id="a1">↓ UPDATE (xid 901) tạo bản mới</div>
    <div class="node" id="t2"><div class="nl">tuple v2 · qty=9</div><div class="ns">xmin=901 · xmax=0</div></div>
    <div class="row">
      <div class="node" id="old"><div class="nl">📸 Snapshot cũ</div><div class="ns">thấy v1</div></div>
      <div class="node" id="new"><div class="nl">📸 Snapshot mới</div><div class="ns">thấy v2</div></div>
    </div>
    <div class="arrow" id="a2">↓ không snapshot nào cần v1</div>
    <div class="node" id="vac"><div class="nl">🧹 VACUUM</div><div class="ns">thu hồi chỗ của v1</div></div>
  `,
  steps: [
    { title: "1 · Mỗi tuple mang xmin/xmax", tab: "hidden", highlight: [1, 2, 4], on: ["t1"],
      desc: "Cột ẩn, xem được bằng SELECT xmin, xmax." },
    { title: "2 · UPDATE = tuple mới", tab: "hidden", highlight: [7, 9, 10], on: ["a1", "t2"],
      desc: "Tuple cũ được đặt xmax = 901, tuple mới ở ctid khác. Không ghi đè." },
    { title: "3 · Snapshot quyết định thấy bản nào", tab: "snap", highlight: [2, 3, 4, 6, 7], on: ["old", "new"],
      desc: "A chụp snapshot trước khi B commit → A vẫn thấy qty=9 dù B đã sửa thành 5. Không ai chặn ai." },
    { title: "4 · Dead tuple & VACUUM", tab: "vacuum", highlight: [1, 2, 5, 6], on: ["a2", "vac"],
      desc: "Phiên bản cũ chỉ được dọn khi mọi snapshot còn sống đều không cần nó. Transaction treo = bloat." },
    { title: "5 · Phòng bệnh", tab: "vacuum", highlight: [8, 9], on: ["vac"],
      desc: "Timeout cho idle in transaction, fillfactor để HOT update tránh cập nhật index." },
    { title: "6 · Cách khác: undo log", tab: "undo", highlight: [3, 4, 5, 7, 8], on: ["t1", "t2"],
      desc: "InnoDB/Oracle sửa tại chỗ, bản cũ ở undo. Rác nằm ở undo thay vì trong bảng." }
  ],

  quiz: [
    { q: "Lợi ích chính của MVCC?", options: [
        "Tiết kiệm đĩa",
        "Người đọc không chặn người ghi và ngược lại, vì mỗi transaction đọc từ snapshot",
        "Không cần WAL",
        "Không cần index"
      ], correct: 1, explanation: "Hai người cùng ghi một dòng thì vẫn phải lock (bài 11)." },
    { q: "Trong PostgreSQL, UPDATE một dòng thực chất làm gì?", options: [
        "Ghi đè tại chỗ",
        "Đặt xmax cho tuple cũ và tạo tuple mới (ctid mới)",
        "Xoá dòng rồi báo lỗi",
        "Chỉ ghi vào WAL"
      ], correct: 1, explanation: "UPDATE = DELETE + INSERT ở mức tuple." },
    { q: "xmin của tuple là gì?", options: [
        "Giá trị nhỏ nhất của cột",
        "xid của transaction đã tạo ra tuple đó",
        "Thời điểm VACUUM",
        "Số page"
      ], correct: 1, explanation: "xmax là xid đã xoá/thay thế tuple." },
    { q: "Dead tuple được dọn bởi?", options: [
        "COMMIT", "VACUUM (autovacuum)", "CHECKPOINT", "ANALYZE"
      ], correct: 1, explanation: "ANALYZE chỉ cập nhật thống kê cho planner." },
    { q: "Vì sao một session 'idle in transaction' lâu có thể làm cả DB phình?", options: [
        "Nó giữ lock toàn bảng",
        "Nó giữ snapshot cũ nên VACUUM không được dọn các tuple chết mới hơn snapshot đó",
        "Nó chiếm hết CPU",
        "Nó xoá WAL"
      ], correct: 1, explanation: "Đặt idle_in_transaction_session_timeout." },
    { q: "HOT update tránh được việc gì?", options: [
        "Ghi WAL",
        "Cập nhật index, khi không cột có index nào đổi và page còn chỗ",
        "Tạo tuple mới",
        "Lock dòng"
      ], correct: 1, explanation: "fillfactor < 100 chừa chỗ để HOT xảy ra thường hơn." },
    { q: "InnoDB lưu phiên bản cũ của dòng ở đâu?", options: [
        "Ngay trong page cạnh bản mới",
        "Undo log; dòng có con trỏ tới bản cũ",
        "Trong binlog",
        "Không lưu"
      ], correct: 1, explanation: "Khác PostgreSQL giữ cả hai bản trong heap." },
    { q: "Vì sao PostgreSQL phải 'freeze' tuple cũ?", options: [
        "Để nén",
        "xid chỉ 32 bit, sẽ quay vòng; freeze đánh dấu tuple là 'luôn thấy được' để tránh wraparound",
        "Để mã hoá",
        "Để replica đọc được"
      ], correct: 1, explanation: "Autovacuum lo việc này — không được tắt." },
    { q: "Session A dùng REPEATABLE READ đọc qty=9. B commit qty=5. A đọc lại trong cùng transaction thấy gì?", options: [
        "5", "9", "Lỗi", "NULL"
      ], correct: 1, explanation: "Snapshot của A cố định từ câu lệnh đầu tiên." },
    { q: "Vì sao transaction MongoDB mặc định bị giới hạn khoảng 60 giây?", options: [
        "Giấy phép",
        "WiredTiger phải giữ lịch sử phiên bản cho snapshot trong cache; giữ lâu gây áp lực bộ nhớ",
        "Do oplog",
        "Do mạng"
      ], correct: 1, explanation: "transactionLifetimeLimitSeconds mặc định 60." }
  ]
});
