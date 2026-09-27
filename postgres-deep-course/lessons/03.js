window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "MVCC & VACUUM",
  title: "MVCC chi tiết: xmin, xmax, snapshot và tuple visibility",
  subtitle: "Người đọc không chặn người ghi · mỗi row có nhiều phiên bản · ai thấy phiên bản nào",

  theory: `
    <p>Trong JPA bạn gặp <code>@Version</code> (optimistic lock) và nghĩ đó là "MVCC". Thực ra PostgreSQL làm MVCC ở tầng lưu trữ: <strong>mỗi row trên đĩa (gọi là tuple) là một phiên bản</strong>, và mỗi câu lệnh chỉ nhìn thấy những phiên bản hợp lệ với <em>snapshot</em> của nó.</p>

    <p><strong>Header của mỗi tuple</strong> (23 byte) chứa, quan trọng nhất:</p>
    <table>
      <tr><th>Trường</th><th>Ý nghĩa</th></tr>
      <tr><td><code>xmin</code></td><td>XID của transaction đã <strong>tạo</strong> phiên bản này (INSERT hoặc UPDATE)</td></tr>
      <tr><td><code>xmax</code></td><td>XID của transaction đã <strong>xoá/thay thế</strong> phiên bản này (DELETE, UPDATE) — hoặc đang khoá row. 0 nếu chưa ai đụng</td></tr>
      <tr><td><code>ctid</code></td><td>Vị trí vật lý (trang, slot). Với phiên bản cũ, trỏ tới phiên bản mới hơn</td></tr>
      <tr><td>infomask</td><td>Bit gợi ý (hint bits): xmin đã commit/abort chưa... để khỏi tra CLOG lần sau</td></tr>
    </table>

    <p><strong>XID</strong> (transaction ID) là số 32-bit tăng dần, chỉ được cấp khi transaction <em>ghi</em> lần đầu (transaction chỉ đọc không tốn XID). Trạng thái commit/abort của từng XID lưu trong <strong>CLOG</strong> (<code>pg_xact</code>).</p>

    <p><strong>Snapshot</strong> gồm: <code>xmin</code> (mọi XID nhỏ hơn đã kết thúc), <code>xmax</code> (XID từ đây trở lên coi như chưa bắt đầu), và danh sách XID <em>đang chạy</em> lúc chụp. Quy tắc nhìn thấy (rút gọn):</p>
    <ol>
      <li>Tuple thấy được nếu <code>xmin</code> <strong>đã commit</strong> và <strong>không nằm trong</strong> danh sách đang chạy/tương lai của snapshot (hoặc xmin là chính mình).</li>
      <li>…và <code>xmax</code> <strong>rỗng</strong>, hoặc thuộc transaction đã abort, hoặc chưa commit theo snapshot (đang chạy/tương lai), hoặc chỉ là khoá row.</li>
    </ol>

    <p><strong>Khi nào chụp snapshot?</strong> Ở <code>READ COMMITTED</code> (mặc định): <em>mỗi câu lệnh</em> một snapshot mới. Ở <code>REPEATABLE READ</code>/<code>SERIALIZABLE</code>: một snapshot cho <em>cả transaction</em>, chụp ở câu lệnh đầu tiên (bài 13).</p>

    <p><strong>Hệ quả quan trọng</strong></p>
    <ul>
      <li>SELECT không bao giờ chờ UPDATE/DELETE và ngược lại — mỗi bên thấy phiên bản riêng.</li>
      <li>UPDATE = đánh dấu xmax cho bản cũ + INSERT bản mới. DELETE = chỉ đặt xmax. Không có gì bị xoá ngay → sinh <strong>dead tuple</strong> cần VACUUM (bài 05).</li>
      <li>ROLLBACK gần như tức thời: chỉ ghi "abort" vào CLOG; các tuple nó tạo tự thành vô hình.</li>
      <li>Transaction dài giữ snapshot cũ → dead tuple mà nó "có thể còn cần" không được dọn.</li>
    </ul>

    <div class="callout"><p>💡 <code>SELECT count(*)</code> chậm trên bảng lớn chính vì MVCC: không có "số row" duy nhất — mỗi snapshot có câu trả lời riêng, nên phải duyệt để kiểm tra visibility (trừ khi index-only scan + visibility map giúp được, bài 08).</p></div>
  `,

  codeTabs: [
    { id: "cols", label: "① Xem cột hệ thống", lines: [
      "CREATE TABLE account (id int PRIMARY KEY, balance int);",
      "INSERT INTO account VALUES (1, 100);         -- chạy bởi XID 750",
      "",
      "SELECT ctid, xmin, xmax, * FROM account;",
      "--  ctid  | xmin | xmax | id | balance",
      "--  (0,1) |  750 |    0 |  1 |     100",
      "",
      "SELECT txid_current();   -- XID của transaction hiện tại (PG 13+: pg_current_xact_id())",
      "SELECT pg_current_snapshot();  -- ví dụ '751:753:751'  (xmin:xmax:đang chạy)"
    ]},
    { id: "upd", label: "② UPDATE sinh phiên bản", lines: [
      "BEGIN;                                        -- XID 751",
      "UPDATE account SET balance = 80 WHERE id = 1;",
      "COMMIT;",
      "",
      "CREATE EXTENSION pageinspect;",
      "SELECT lp, t_xmin, t_xmax, t_ctid",
      "FROM heap_page_items(get_raw_page('account', 0));",
      "--  lp | t_xmin | t_xmax | t_ctid",
      "--   1 |    750 |    751 | (0,2)   <- bản cũ: balance=100, đã chết",
      "--   2 |    751 |      0 | (0,2)   <- bản mới: balance=80"
    ]},
    { id: "two", label: "③ Hai session song song", lines: [
      "# Session A                           # Session B",
      "BEGIN;  -- XID 752",
      "UPDATE account SET balance = 50",
      "  WHERE id = 1;",
      "                                      SELECT balance FROM account WHERE id = 1;",
      "                                      # → 80  (xmax=752 đang chạy → bản cũ còn hiệu lực)",
      "COMMIT;",
      "                                      SELECT balance FROM account WHERE id = 1;",
      "                                      # → 50  (READ COMMITTED: snapshot mới mỗi câu)"
    ]},
    { id: "vis", label: "④ Quy tắc visibility", lines: [
      "fn visible(t: &Tuple, snap: &Snapshot, me: Xid) -> bool {",
      "    let created = t.xmin == me",
      "        || (committed(t.xmin) && !snap.in_progress_or_future(t.xmin));",
      "    if !created { return false; }",
      "    if t.xmax == 0 || t.xmax_is_lock_only() { return true; }",
      "    if t.xmax == me { return false; }            // chính mình đã xoá",
      "    if aborted(t.xmax) { return true; }",
      "    snap.in_progress_or_future(t.xmax)          // người xoá chưa commit theo snapshot",
      "}",
      "// Rút gọn: bản thật xử lý thêm subtransaction, command id (cmin/cmax)..."
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="v1"><div class="nl">📄 (0,1) balance=100</div><div class="ns">xmin 750 · xmax 751</div></div>
      <div class="node" id="v2"><div class="nl">📄 (0,2) balance=80</div><div class="ns">xmin 751 · xmax 752</div></div>
      <div class="node" id="v3"><div class="nl">📄 (0,3) balance=50</div><div class="ns">xmin 752 · xmax 0</div></div>
    </div>
    <div class="arrow" id="a1">↑ mỗi câu lệnh áp quy tắc visibility với snapshot của nó</div>
    <div class="row">
      <div class="node" id="sa"><div class="nl">🅰️ Session A (XID 752)</div><div class="ns">thấy bản của chính mình</div></div>
      <div class="node" id="sb"><div class="nl">🅱️ Session B</div><div class="ns">snapshot: 752 đang chạy</div></div>
    </div>
  `,
  steps: [
    { title: "1 · INSERT tạo tuple đầu", tab: "cols", highlight: [2, 4, 6], on: ["v1"],
      desc: "Tuple mang <code>xmin=750</code>, <code>xmax=0</code>. <code>ctid=(0,1)</code>: trang 0, slot 1." },
    { title: "2 · UPDATE = bản mới + đánh dấu bản cũ", tab: "upd", highlight: [2, 9, 10], on: ["v1", "v2"],
      desc: "Bản cũ nhận <code>xmax=751</code> và ctid trỏ sang (0,2). Không có gì bị ghi đè tại chỗ." },
    { title: "3 · A update nhưng chưa commit", tab: "two", highlight: [2, 3, 5, 6], on: ["v2", "v3", "sa", "sb"],
      desc: "B chụp snapshot thấy 752 đang chạy → bản (0,3) chưa tồn tại với B, còn xmax=752 của (0,2) chưa có hiệu lực → B thấy 80, và <strong>không phải chờ</strong>." },
    { title: "4 · A commit, B đọc lại", tab: "two", highlight: [7, 8, 9], on: ["v3", "sb"],
      desc: "READ COMMITTED chụp snapshot mới cho mỗi câu → giờ 752 đã commit → B thấy 50." },
    { title: "5 · Quy tắc tổng quát", tab: "vis", highlight: [2, 3, 5, 7, 8], on: ["a1"],
      desc: "Tuple thấy được khi người tạo đã commit (theo snapshot) và người xoá chưa commit (theo snapshot) hoặc đã abort." }
  ],

  quiz: [
    { q: "xmin của một tuple là gì?", options: [
        "Giá trị nhỏ nhất của cột",
        "XID của transaction đã tạo phiên bản tuple đó",
        "Thời điểm tạo row",
        "Số lần row bị sửa"
      ], correct: 1, explanation: "xmax là XID của transaction đã xoá/thay thế (hoặc khoá) nó." },
    { q: "UPDATE một row trong PostgreSQL thực chất làm gì ở tầng lưu trữ?", options: [
        "Ghi đè giá trị tại chỗ",
        "Đặt xmax cho phiên bản cũ và chèn một phiên bản mới",
        "Xoá row rồi VACUUM ngay",
        "Chỉ ghi vào WAL"
      ], correct: 1, explanation: "Vì vậy UPDATE nhiều sinh dead tuple như DELETE." },
    { q: "Ở READ COMMITTED, snapshot được chụp khi nào?", options: [
        "Một lần khi BEGIN",
        "Đầu mỗi câu lệnh",
        "Khi COMMIT",
        "Không dùng snapshot"
      ], correct: 1, explanation: "REPEATABLE READ/SERIALIZABLE mới dùng một snapshot cho cả transaction." },
    { q: "Session B SELECT row mà session A đã UPDATE nhưng chưa commit. B sẽ?", options: [
        "Chờ A commit",
        "Thấy phiên bản cũ ngay lập tức, không chờ",
        "Thấy giá trị mới chưa commit",
        "Nhận lỗi serialization"
      ], correct: 1, explanation: "Reader không chặn writer và ngược lại. Chỉ writer–writer trên cùng row mới chờ nhau." },
    { q: "Vì sao ROLLBACK trong PostgreSQL rất nhanh kể cả sau khi sửa triệu row?", options: [
        "Vì nó chép lại dữ liệu từ undo log",
        "Vì chỉ cần đánh dấu XID là aborted trong CLOG; tuple nó tạo tự động thành vô hình",
        "Vì dữ liệu chưa bao giờ được ghi",
        "Vì ROLLBACK chạy nền"
      ], correct: 1, explanation: "Không có undo log kiểu Oracle/MySQL InnoDB. Đổi lại, các tuple rác đó phải được VACUUM dọn." },
    { q: "Transaction chỉ chạy SELECT có được cấp XID không?", options: [
        "Có, luôn luôn",
        "Không, XID chỉ được cấp khi transaction ghi lần đầu",
        "Chỉ ở SERIALIZABLE",
        "Chỉ khi dùng FOR UPDATE"
      ], correct: 1, explanation: "Transaction chỉ đọc dùng virtual XID. SELECT ... FOR UPDATE thì có cấp XID vì phải ghi khoá vào xmax." },
    { q: "Vì sao count(*) trên bảng lớn không trả về tức thì như một số lưu sẵn?", options: [
        "Vì PostgreSQL không tối ưu",
        "Vì mỗi snapshot có tập row nhìn thấy khác nhau nên phải kiểm tra visibility",
        "Vì count(*) luôn seq scan cả database",
        "Vì thiếu index trên id"
      ], correct: 1, explanation: "Cần đếm nhanh xấp xỉ thì dùng pg_class.reltuples hoặc bộ đếm tự quản lý." },
    { q: "ctid của phiên bản cũ sau khi UPDATE trỏ tới đâu?", options: [
        "Không trỏ đâu cả",
        "Phiên bản mới hơn của cùng row",
        "Trang đầu tiên của bảng",
        "Index"
      ], correct: 1, explanation: "Chuỗi ctid cho phép đi từ bản cũ tới bản mới (dùng khi UPDATE đồng thời, và HOT chain)." },
    { q: "Trạng thái commit/abort của từng XID được lưu ở đâu?", options: [
        "Trong mỗi index", "CLOG (pg_xact)", "pg_stat_activity", "postgresql.conf"
      ], correct: 1, explanation: "Hint bits trên tuple là bản cache để khỏi tra CLOG mãi." }
  ]
});
