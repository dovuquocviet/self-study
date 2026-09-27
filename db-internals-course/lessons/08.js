window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Transaction, đồng thời & truy vấn",
  title: "ACID — bốn chữ cái, bốn cơ chế khác nhau",
  subtitle: "Atomicity nhờ log · Consistency là việc của bạn · Isolation nhờ MVCC/lock · Durability nhờ fsync",

  theory: `
    <p>ACID hay được học thuộc như một khẩu hiệu. Kỹ sư cần biết <strong>cơ chế nào</strong> đứng sau từng chữ, vì khi đổi sang DB khác (MongoDB, Redis, Kafka, ClickHouse)
    thứ bị mất thường chỉ là một hai chữ trong đó.</p>

    <table>
      <tr><th>Chữ</th><th>Nghĩa thật</th><th>Cơ chế (PostgreSQL)</th></tr>
      <tr><td><strong>A</strong>tomicity</td><td>Tất cả hoặc không gì cả — lỗi giữa chừng thì như chưa từng chạy</td><td>Commit record trong WAL; tuple của transaction abort bị MVCC coi là vô hình</td></tr>
      <tr><td><strong>C</strong>onsistency</td><td>Dữ liệu luôn thoả ràng buộc bạn khai báo</td><td>CHECK, UNIQUE, FOREIGN KEY, NOT NULL — và logic ứng dụng của bạn</td></tr>
      <tr><td><strong>I</strong>solation</td><td>Transaction đồng thời không thấy nhau "dở dang"</td><td>MVCC + lock; mức độ tuỳ isolation level (bài 10)</td></tr>
      <tr><td><strong>D</strong>urability</td><td>Đã commit thì không mất khi crash</td><td>WAL + fsync (bài 03), thêm replica nếu muốn sống sót khi mất máy</td></tr>
    </table>

    <p><strong>Atomicity ≠ "đồng thời"</strong>. Chữ A nói về <em>lỗi</em>, không nói về người khác nhìn thấy gì — đó là chữ I. Và chữ C phần lớn là trách nhiệm của bạn:
    DB chỉ giữ những ràng buộc bạn đã khai báo.</p>

    <p><strong>ACID ở các DB khác</strong></p>
    <ul>
      <li><strong>MongoDB</strong>: thao tác trên <em>một document</em> luôn atomic. Transaction nhiều document có từ 4.0 (replica set) và 4.2 (sharded), nhưng tốn hơn — thiết kế tốt thường nhúng để khỏi cần (bài 13).</li>
      <li><strong>Redis</strong>: mỗi lệnh atomic vì chạy một luồng. <code>MULTI/EXEC</code> chạy liền một khối nhưng <em>không rollback</em> nếu một lệnh bên trong lỗi. Lua script chạy nguyên khối.</li>
      <li><strong>Kafka</strong>: transaction cho phép ghi atomic vào nhiều partition và commit offset cùng lúc (exactly-once trong phạm vi Kafka).</li>
      <li><strong>ClickHouse</strong>: một INSERT vào một bảng MergeTree là atomic nếu nằm trong một block (mặc định tối đa ~1 triệu dòng, <code>max_insert_block_size</code>); không có transaction nhiều câu lệnh kiểu OLTP.</li>
      <li><strong>Elasticsearch</strong>: thao tác trên một document atomic; không có transaction nhiều document.</li>
    </ul>

    <p><strong>Spring <code>@Transactional</code> làm gì thật?</strong> Proxy mở connection, <code>setAutoCommit(false)</code>, chạy method, gặp RuntimeException thì <code>rollback()</code>,
    không thì <code>commit()</code>. Bẫy quen thuộc: gọi method <code>@Transactional</code> từ chính class đó (self-invocation) không đi qua proxy → không có transaction;
    và checked exception mặc định <em>không</em> gây rollback.</p>

    <div class="callout"><p>💡 Transaction càng dài càng đắt: giữ lock lâu hơn, giữ snapshot MVCC làm VACUUM không dọn được tuple cũ, giữ connection trong pool.
    Đừng gọi HTTP ra ngoài hay publish Kafka bên trong transaction DB — dùng pattern Outbox (ghi sự kiện vào bảng trong cùng transaction, publish sau).</p></div>
  `,

  codeTabs: [
    { id: "sql", label: "Atomicity bằng SQL", lines: [
      "BEGIN;",
      "UPDATE accounts SET balance = balance - 100 WHERE id = 1;",
      "UPDATE accounts SET balance = balance + 100 WHERE id = 999;  -- id không tồn tại? vẫn 'UPDATE 0'",
      "INSERT INTO transfers(from_id, to_id, amount) VALUES (1, 999, 100);",
      "-- ERROR: violates foreign key constraint → transaction bị huỷ",
      "COMMIT;   -- thực tế trả về ROLLBACK",
      "",
      "-- Consistency là việc của bạn: khai báo ràng buộc",
      "ALTER TABLE accounts ADD CONSTRAINT balance_nonneg CHECK (balance >= 0);"
    ]},
    { id: "spring", label: "@Transactional", lines: [
      "@Service",
      "class TransferService {",
      "    @Transactional",
      "    public void transfer(long from, long to, long amount) {",
      "        repo.debit(from, amount);",
      "        repo.credit(to, amount);          // ném RuntimeException → rollback cả hai",
      "    }",
      "",
      "    public void batch() {",
      "        transfer(1, 2, 100);              // ⚠ self-invocation: KHÔNG qua proxy → không có tx",
      "    }",
      "}",
      "// checked exception mặc định KHÔNG rollback: dùng @Transactional(rollbackFor = Exception.class)"
    ]},
    { id: "outbox", label: "Outbox thay vì publish trong tx", lines: [
      "BEGIN;",
      "INSERT INTO orders(id, total) VALUES (1001, 350000);",
      "INSERT INTO outbox(aggregate_id, type, payload)",
      "     VALUES (1001, 'OrderCreated', '{\"total\":350000}');",
      "COMMIT;   -- cả hai cùng thành công hoặc cùng mất",
      "",
      "# tiến trình khác (hoặc Debezium đọc WAL) đẩy outbox → Kafka",
      "# nếu publish Kafka ngay trong tx: tx rollback nhưng message đã đi → dữ liệu lệch"
    ]},
    { id: "others", label: "Các DB khác", lines: [
      "# Redis: MULTI/EXEC chạy liền khối, KHÔNG rollback",
      "MULTI",
      "INCR stock:sku1",
      "LPUSH stock:sku1 x      # lỗi WRONGTYPE lúc EXEC, nhưng INCR ở trên vẫn đã chạy",
      "EXEC",
      "",
      "// MongoDB: update 1 document luôn atomic",
      "db.orders.updateOne({ _id: 1001 }, { $push: { items: item }, $inc: { total: 50000 } })"
    ]}
  ],

  stageHtml: `
    <div class="node" id="a"><div class="nl">🅰️ Atomicity</div><div class="ns">commit record + MVCC ẩn tuple abort</div></div>
    <div class="node" id="c"><div class="nl">🅲 Consistency</div><div class="ns">ràng buộc bạn khai báo</div></div>
    <div class="node" id="i"><div class="nl">🅸 Isolation</div><div class="ns">MVCC + lock, theo isolation level</div></div>
    <div class="node" id="d"><div class="nl">🅳 Durability</div><div class="ns">WAL + fsync (+ replica)</div></div>
    <div class="arrow" id="a1">↓ đổi sang DB khác</div>
    <div class="node" id="other"><div class="nl">🔀 Mongo · Redis · Kafka · ClickHouse · ES</div><div class="ns">mỗi nơi mất một vài chữ</div></div>
  `,
  steps: [
    { title: "1 · A: tất cả hoặc không", tab: "sql", highlight: [1, 2, 3, 4, 5, 6], on: ["a"],
      desc: "Lỗi FK ở câu 3 → cả transaction bị huỷ, câu 1 cũng không còn. Lưu ý UPDATE 0 dòng KHÔNG phải lỗi." },
    { title: "2 · C: bạn phải khai báo", tab: "sql", highlight: [8, 9], on: ["c"],
      desc: "DB chỉ bảo vệ ràng buộc được khai báo. 'Không âm' mà không có CHECK thì DB không biết." },
    { title: "3 · I và D: cơ chế riêng", tab: "sql", highlight: [6], on: ["i", "d"],
      desc: "Isolation = MVCC/lock (bài 09–11). Durability = WAL fsync lúc COMMIT (bài 03)." },
    { title: "4 · Spring proxy và bẫy", tab: "spring", highlight: [3, 6, 10, 13], on: ["a"],
      desc: "Self-invocation không qua proxy; checked exception không rollback mặc định." },
    { title: "5 · Đừng gọi ra ngoài trong tx", tab: "outbox", highlight: [2, 3, 5, 8], on: ["a", "d"],
      desc: "Outbox biến 'ghi DB + gửi sự kiện' thành một transaction duy nhất trong DB." },
    { title: "6 · ACID ở DB khác", tab: "others", highlight: [1, 4, 7, 8], on: ["a1", "other"],
      desc: "Redis MULTI không rollback; Mongo atomic trên một document. Biết mình đang mất chữ nào." }
  ],

  quiz: [
    { q: "Atomicity trong ACID nói về điều gì?", options: [
        "Nhiều transaction chạy song song",
        "Transaction thành công trọn vẹn hoặc không để lại dấu vết nào khi lỗi",
        "Dữ liệu không mất khi crash",
        "Tốc độ ghi"
      ], correct: 1, explanation: "Người khác thấy gì khi chạy song song là chuyện của Isolation." },
    { q: "Chữ C (Consistency) chủ yếu do ai đảm bảo?", options: [
        "Hoàn toàn do DB tự biết",
        "Ràng buộc bạn khai báo (CHECK, FK, UNIQUE) và logic ứng dụng",
        "Hệ điều hành",
        "Replica"
      ], correct: 1, explanation: "DB chỉ giữ những gì được khai báo." },
    { q: "Durability trong PostgreSQL dựa vào?", options: [
        "Buffer pool", "WAL được fsync trước khi trả COMMIT", "Index", "VACUUM"
      ], correct: 1, explanation: "Muốn sống sót khi mất cả máy thì thêm replica đồng bộ." },
    { q: "UPDATE ... WHERE id = 999 không khớp dòng nào trong transaction. Điều gì xảy ra?", options: [
        "Transaction tự rollback",
        "Trả 'UPDATE 0', không phải lỗi; transaction tiếp tục",
        "DB tạo dòng mới",
        "Deadlock"
      ], correct: 1, explanation: "Ứng dụng phải tự kiểm tra số dòng bị ảnh hưởng nếu cần." },
    { q: "Gọi method @Transactional từ một method khác trong cùng class thì sao?", options: [
        "Vẫn có transaction bình thường",
        "Không đi qua proxy nên annotation không có tác dụng",
        "Tạo transaction lồng",
        "Ném lỗi biên dịch"
      ], correct: 1, explanation: "Spring AOP proxy chỉ chặn lời gọi từ bên ngoài bean." },
    { q: "Mặc định @Transactional rollback khi gặp?", options: [
        "Mọi Exception",
        "RuntimeException và Error; checked exception thì không",
        "Chỉ SQLException",
        "Không bao giờ"
      ], correct: 1, explanation: "Dùng rollbackFor để đổi." },
    { q: "Redis MULTI/EXEC có rollback khi một lệnh bên trong lỗi lúc thực thi không?", options: [
        "Có, như SQL",
        "Không; các lệnh khác vẫn chạy",
        "Có nếu dùng AOF",
        "Chỉ trong cluster"
      ], correct: 1, explanation: "MULTI/EXEC đảm bảo chạy liền khối, không đảm bảo all-or-nothing khi lỗi runtime." },
    { q: "Vì sao không nên publish Kafka ngay bên trong transaction DB?", options: [
        "Kafka chậm",
        "Transaction có thể rollback sau khi message đã gửi → hai hệ thống lệch nhau; dùng Outbox",
        "Kafka không nhận JSON",
        "Vì Spring cấm"
      ], correct: 1, explanation: "Outbox ghi sự kiện vào bảng trong cùng transaction rồi publish sau." },
    { q: "Thao tác nào luôn atomic trong MongoDB mà không cần transaction?", options: [
        "Cập nhật nhiều document ở nhiều collection",
        "Cập nhật một document (kể cả nhiều field, mảng lồng)",
        "Cập nhật nhiều shard",
        "Không thao tác nào"
      ], correct: 1, explanation: "Vì vậy thiết kế nhúng giúp tránh transaction nhiều document." }
  ]
});
