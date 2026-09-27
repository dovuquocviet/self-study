window.LESSONS.push({
  id: "11",
  phase: "2", phaseName: "Transaction, đồng thời & truy vấn",
  title: "Lock, deadlock & optimistic locking",
  subtitle: "Row lock · FOR UPDATE / SKIP LOCKED · lock queue khi ALTER TABLE · deadlock detection · @Version",

  theory: `
    <p>MVCC giải quyết đọc-ghi. Còn <strong>ghi-ghi</strong> trên cùng dòng thì vẫn phải xếp hàng bằng lock. Hai trường phái:</p>
    <ul>
      <li><strong>Pessimistic</strong>: khoá trước rồi làm (<code>SELECT ... FOR UPDATE</code>). Hợp khi xung đột thường xuyên.</li>
      <li><strong>Optimistic</strong>: không khoá, lúc ghi kiểm tra "dữ liệu có bị ai đổi chưa" bằng số phiên bản; đổi rồi thì báo lỗi, retry. Hợp khi xung đột hiếm.</li>
    </ul>

    <p><strong>Row lock ở PostgreSQL</strong></p>
    <ul>
      <li>UPDATE/DELETE tự khoá dòng tới hết transaction. Người thứ hai muốn sửa cùng dòng phải <em>chờ</em>; người chỉ đọc (SELECT thường) không chờ nhờ MVCC.</li>
      <li><code>FOR UPDATE</code> / <code>FOR NO KEY UPDATE</code> / <code>FOR SHARE</code> / <code>FOR KEY SHARE</code>: khoá khi đọc, mạnh yếu khác nhau. Khoá dòng được ghi ngay trong tuple (trường xmax), nên khoá triệu dòng không tốn RAM lock manager.</li>
      <li><code>NOWAIT</code>: lỗi ngay nếu đang bị khoá. <code>SKIP LOCKED</code>: bỏ qua dòng đang bị khoá — nền tảng của hàng đợi job trên PostgreSQL.</li>
    </ul>

    <p><strong>Table lock &amp; lock queue — bẫy khi migrate</strong>: <code>ALTER TABLE ... ADD COLUMN</code> cần <code>ACCESS EXCLUSIVE</code>. Nếu có một SELECT dài đang chạy,
    ALTER phải chờ; và <em>mọi câu lệnh đến sau</em> (kể cả SELECT) xếp hàng sau ALTER → service đứng hình dù ALTER chỉ mất 1 ms.
    Luôn đặt <code>SET lock_timeout = '3s'</code> trong migration và retry.</p>

    <p><strong>Deadlock</strong>: A giữ dòng 1 chờ dòng 2, B giữ dòng 2 chờ dòng 1. PostgreSQL chờ <code>deadlock_timeout</code> (mặc định 1 giây) rồi dò đồ thị chờ,
    huỷ một bên với lỗi <code>deadlock detected</code> (SQLSTATE <code>40P01</code>). Phòng: <strong>luôn khoá theo cùng một thứ tự</strong> (vd theo id tăng dần), giữ transaction ngắn.</p>

    <p><strong>Optimistic locking trong JPA</strong>: <code>@Version</code> thêm điều kiện <code>WHERE id = ? AND version = ?</code> vào UPDATE và tăng version.
    0 dòng bị ảnh hưởng → <code>OptimisticLockException</code>. Không giữ lock lâu, hợp với luồng "người dùng mở form, 5 phút sau bấm Lưu".</p>

    <p><strong>Ở DB khác</strong></p>
    <ul>
      <li><strong>MongoDB</strong>: WiredTiger khoá ở mức document; hai transaction sửa cùng document → một bên nhận <code>WriteConflict</code> (lỗi tạm thời, driver có thể retry).</li>
      <li><strong>Redis</strong>: một luồng nên mỗi lệnh tự nhiên tuần tự. Optimistic kiểu Redis: <code>WATCH</code> key rồi <code>MULTI/EXEC</code>, EXEC trả nil nếu key bị đổi.
      Lock phân tán đơn giản: <code>SET key token NX PX 30000</code> — nhớ nó chỉ là lease có hạn, không phải lock tuyệt đối.</li>
    </ul>

    <div class="callout"><p>💡 Deadlock và lock wait không phải "lỗi DB" mà là triệu chứng của thứ tự truy cập trong code. Khi thấy <code>40P01</code>, đọc log
    (PostgreSQL in ra cả hai câu lệnh) rồi sửa thứ tự khoá, đừng chỉ tăng timeout.</p></div>
  `,

  codeTabs: [
    { id: "deadlock", label: "Deadlock", lines: [
      "-- A                                         -- B",
      "BEGIN;                                       BEGIN;",
      "UPDATE accounts SET ... WHERE id = 1;        UPDATE accounts SET ... WHERE id = 2;",
      "UPDATE accounts SET ... WHERE id = 2;  -- chờ B",
      "                                             UPDATE accounts SET ... WHERE id = 1;  -- chờ A",
      "-- sau deadlock_timeout (1s), PostgreSQL dò thấy vòng:",
      "ERROR:  deadlock detected   (SQLSTATE 40P01)  -- một bên bị huỷ",
      "",
      "-- phòng: khoá theo thứ tự id tăng dần ở cả hai phía",
      "SELECT * FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;"
    ]},
    { id: "queue", label: "Job queue SKIP LOCKED", lines: [
      "-- nhiều worker cùng chạy, không ai lấy trùng job",
      "BEGIN;",
      "SELECT id, payload FROM jobs",
      " WHERE status = 'READY'",
      " ORDER BY id",
      " LIMIT 10",
      " FOR UPDATE SKIP LOCKED;",
      "-- xử lý ...",
      "UPDATE jobs SET status = 'DONE' WHERE id = ANY(:ids);",
      "COMMIT;"
    ]},
    { id: "migrate", label: "Lock queue khi migrate", lines: [
      "-- session 1: báo cáo chạy 5 phút, giữ ACCESS SHARE",
      "SELECT ... FROM orders ...;",
      "",
      "-- session 2: migration cần ACCESS EXCLUSIVE → phải chờ session 1",
      "ALTER TABLE orders ADD COLUMN note text;",
      "",
      "-- session 3..N: SELECT bình thường xếp hàng SAU ALTER → service treo",
      "",
      "-- cách đúng:",
      "SET lock_timeout = '3s';",
      "ALTER TABLE orders ADD COLUMN note text;   -- thất bại nhanh, retry sau"
    ]},
    { id: "jpa", label: "@Version", lines: [
      "@Entity",
      "class Product {",
      "    @Id Long id;",
      "    int stock;",
      "    @Version long version;",
      "}",
      "",
      "-- Hibernate sinh ra:",
      "UPDATE product SET stock = ?, version = 8 WHERE id = ? AND version = 7;",
      "-- 0 dòng → OptimisticLockException → báo người dùng / retry",
      "",
      "@Lock(LockModeType.PESSIMISTIC_WRITE)   // → SELECT ... FOR UPDATE",
      "Optional<Product> findWithLockById(Long id);"
    ]},
    { id: "redis", label: "Redis WATCH & lease", lines: [
      "WATCH stock:X",
      "GET stock:X            # 10",
      "MULTI",
      "SET stock:X 9",
      "EXEC                   # nil nếu ai đó đổi stock:X sau WATCH → thử lại",
      "",
      "# lease có hạn, token ngẫu nhiên để chỉ chủ mới xoá được",
      "SET lock:order:1001 5f2c9a NX PX 30000"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="a"><div class="nl">🅰️ A giữ dòng 1</div><div class="ns">chờ dòng 2</div></div>
      <div class="node" id="b"><div class="nl">🅱️ B giữ dòng 2</div><div class="ns">chờ dòng 1</div></div>
    </div>
    <div class="arrow" id="a1">↓ sau deadlock_timeout: dò đồ thị chờ</div>
    <div class="node" id="dl"><div class="nl">💀 deadlock detected</div><div class="ns">huỷ một bên (40P01)</div></div>
    <div class="arrow" id="a2">↓ phòng bệnh</div>
    <div class="row">
      <div class="node" id="order"><div class="nl">🔢 Khoá theo thứ tự</div><div class="ns">ORDER BY id FOR UPDATE</div></div>
      <div class="node" id="opt"><div class="nl">🏷️ Optimistic</div><div class="ns">@Version, WATCH</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Hai bên khoá chéo", tab: "deadlock", highlight: [3, 4, 5], on: ["a", "b"],
      desc: "Mỗi bên giữ một dòng và chờ dòng bên kia đang giữ." },
    { title: "2 · DB phát hiện và huỷ một bên", tab: "deadlock", highlight: [6, 7], on: ["a1", "dl"],
      desc: "Sau 1 giây chờ, PostgreSQL dò vòng trong đồ thị chờ và huỷ một transaction." },
    { title: "3 · Khoá theo cùng thứ tự", tab: "deadlock", highlight: [9, 10], on: ["a2", "order"],
      desc: "Cả hai đều khoá id 1 trước rồi 2 → không thể tạo vòng." },
    { title: "4 · SKIP LOCKED cho hàng đợi", tab: "queue", highlight: [3, 7, 9], on: ["order"],
      desc: "Worker bỏ qua job người khác đang giữ, nên nhiều worker song song không đụng nhau." },
    { title: "5 · Lock queue khi ALTER TABLE", tab: "migrate", highlight: [2, 5, 7, 10], on: ["a", "b"],
      desc: "ALTER chờ lock làm mọi câu lệnh sau nó chờ theo. lock_timeout biến treo cả service thành lỗi nhanh." },
    { title: "6 · Optimistic: @Version & WATCH", tab: "jpa", highlight: [5, 9, 10, 12], on: ["opt"],
      desc: "Không giữ lock; lúc ghi kiểm tra version. Redis có WATCH/MULTI/EXEC cùng ý tưởng." }
  ],

  quiz: [
    { q: "SELECT thường (không FOR UPDATE) có phải chờ dòng đang bị UPDATE chưa commit không (PostgreSQL)?", options: [
        "Có, luôn chờ", "Không — MVCC cho đọc phiên bản đã commit", "Chỉ ở Serializable", "Chỉ khi có index"
      ], correct: 1, explanation: "Chỉ ghi-ghi (hoặc FOR UPDATE) mới chờ nhau." },
    { q: "FOR UPDATE SKIP LOCKED dùng để làm gì?", options: [
        "Khoá cả bảng",
        "Lấy các dòng chưa bị ai khoá, bỏ qua dòng đang bị khoá — hàng đợi job nhiều worker",
        "Bỏ qua MVCC",
        "Xoá lock cũ"
      ], correct: 1, explanation: "Mỗi worker lấy một phần khác nhau mà không chờ nhau." },
    { q: "PostgreSQL xử lý deadlock thế nào?", options: [
        "Chờ vô hạn",
        "Sau deadlock_timeout dò đồ thị chờ và huỷ một transaction (40P01)",
        "Khởi động lại server",
        "Huỷ cả hai"
      ], correct: 1, explanation: "Transaction bị huỷ nên được retry." },
    { q: "Cách phòng deadlock hiệu quả nhất?", options: [
        "Tăng deadlock_timeout",
        "Khoá tài nguyên theo cùng một thứ tự ở mọi nơi và giữ transaction ngắn",
        "Tắt lock",
        "Dùng nhiều index hơn"
      ], correct: 1, explanation: "Không thể tạo vòng khi thứ tự khoá nhất quán." },
    { q: "Vì sao ALTER TABLE mất 1 ms vẫn có thể làm service treo?", options: [
        "Vì ALTER ghi lại cả bảng",
        "Nó chờ ACCESS EXCLUSIVE sau một truy vấn dài, và mọi câu lệnh đến sau xếp hàng sau nó",
        "Vì xoá index",
        "Vì tắt WAL"
      ], correct: 1, explanation: "Đặt lock_timeout ngắn trong migration." },
    { q: "@Version trong JPA hoạt động ra sao?", options: [
        "SELECT FOR UPDATE",
        "UPDATE ... WHERE id = ? AND version = ?; 0 dòng → OptimisticLockException",
        "Khoá bảng",
        "Tạo bản sao dòng"
      ], correct: 1, explanation: "Không giữ lock trong lúc người dùng suy nghĩ." },
    { q: "Optimistic locking hợp với tình huống nào?", options: [
        "Xung đột rất thường xuyên trên cùng dòng",
        "Xung đột hiếm, thời gian giữa đọc và ghi dài (form người dùng)",
        "Batch ghi hàng triệu dòng",
        "Không bao giờ"
      ], correct: 1, explanation: "Xung đột thường xuyên thì retry liên tục, pessimistic tốt hơn." },
    { q: "Redis WATCH + MULTI/EXEC: EXEC trả nil nghĩa là?", options: [
        "Lỗi cú pháp",
        "Key được WATCH đã bị thay đổi, transaction không chạy → thử lại",
        "Thành công",
        "Hết RAM"
      ], correct: 1, explanation: "Đây là optimistic locking kiểu Redis." },
    { q: "Hai transaction MongoDB sửa cùng một document. Chuyện gì xảy ra?", options: [
        "Cả hai thành công, ghi đè nhau",
        "Một bên nhận WriteConflict (lỗi tạm thời) và có thể retry",
        "Deadlock vĩnh viễn",
        "Mongo khoá cả collection"
      ], correct: 1, explanation: "WiredTiger kiểm soát đồng thời ở mức document." }
  ]
});
