window.LESSONS.push({
  id: "21",
  phase: "6", phaseName: "Vận hành production",
  title: "Migration an toàn, không downtime",
  subtitle: "lock_timeout · ADD COLUMN · NOT NULL/FK qua NOT VALID · CREATE INDEX CONCURRENTLY · expand/contract · sqlx migrate",

  theory: `
    <p>Với Flyway/Liquibase bạn quen "chạy file SQL lúc app khởi động". Trên bảng 200 triệu row đang nhận 3.000 request/giây, câu hỏi cho <em>mỗi</em> câu DDL là: <strong>nó lấy khoá gì, giữ bao lâu, có rewrite/quét bảng không</strong>.</p>

    <p><strong>Nguyên tắc 1 — luôn có lock_timeout</strong> (bài 14): DDL chờ khoá sẽ làm tắc mọi query phía sau. <code>SET lock_timeout = '3s'</code>, thất bại thì retry sau vài giây — tốt hơn nhiều so với 5 phút bảng đứng hình.</p>

    <p><strong>Bảng tra các thao tác phổ biến</strong></p>
    <table>
      <tr><th>Thao tác</th><th>Nguy hiểm</th><th>Cách an toàn</th></tr>
      <tr><td>ADD COLUMN nullable, không default</td><td>Không — chỉ sửa catalog</td><td>Làm bình thường (có lock_timeout)</td></tr>
      <tr><td>ADD COLUMN ... DEFAULT hằng số</td><td>Từ PG 11: không rewrite</td><td>OK. Default <em>volatile</em> (<code>gen_random_uuid()</code>, <code>clock_timestamp()</code>) vẫn rewrite cả bảng</td></tr>
      <tr><td>SET NOT NULL</td><td>Quét cả bảng dưới ACCESS EXCLUSIVE</td><td>ADD CHECK (col IS NOT NULL) NOT VALID → VALIDATE → SET NOT NULL (PG 12+ dùng CHECK đã validate để bỏ qua quét) → DROP CHECK</td></tr>
      <tr><td>ADD FOREIGN KEY</td><td>Quét bảng, khoá cả hai bảng</td><td>ADD CONSTRAINT ... NOT VALID → VALIDATE CONSTRAINT (khoá nhẹ, không chặn ghi)</td></tr>
      <tr><td>CREATE INDEX</td><td>Chặn mọi ghi suốt quá trình</td><td><code>CREATE INDEX CONCURRENTLY</code></td></tr>
      <tr><td>ALTER COLUMN TYPE</td><td>Thường rewrite bảng + index</td><td>Cột mới + backfill theo lô + chuyển đọc/ghi (expand/contract). Ngoại lệ không rewrite: tăng độ dài varchar, varchar → text</td></tr>
      <tr><td>RENAME COLUMN</td><td>Nhanh, nhưng app phiên bản cũ đang chạy sẽ lỗi</td><td>Expand/contract qua nhiều lần deploy</td></tr>
      <tr><td>UPDATE backfill cả bảng</td><td>Một transaction khổng lồ: khoá row, WAL, bloat, lag replica</td><td>Theo lô 1.000–10.000 row, mỗi lô một transaction</td></tr>
    </table>

    <p><strong>CREATE INDEX CONCURRENTLY</strong>: quét bảng hai lần, chờ các transaction cũ kết thúc; chậm hơn nhưng không chặn ghi. Không chạy được trong transaction block. Nếu thất bại (vd trùng giá trị với UNIQUE) sẽ để lại index <strong>INVALID</strong> — phải <code>DROP INDEX CONCURRENTLY</code> rồi làm lại.</p>

    <p><strong>Expand / contract</strong> (đổi tên cột <code>phone</code> → <code>phone_e164</code>):</p>
    <ol>
      <li><em>Expand</em>: thêm cột mới; deploy app ghi <strong>cả hai</strong> cột.</li>
      <li>Backfill theo lô cho dữ liệu cũ.</li>
      <li>Deploy app đọc cột mới.</li>
      <li><em>Contract</em>: deploy app ngừng ghi cột cũ; migration sau đó DROP cột cũ.</li>
    </ol>
    <p>Mỗi bước tương thích ngược với phiên bản app đang chạy cùng lúc (rolling deploy luôn có hai phiên bản song song).</p>

    <div class="callout"><p>💡 <code>sqlx migrate</code> mặc định bọc mỗi file trong transaction — CREATE INDEX CONCURRENTLY sẽ lỗi. Đặt dòng đầu file là <code>-- no-transaction</code> và để câu CONCURRENTLY trong file riêng. Flyway cũng có cơ chế tương tự (chạy migration không transaction).</p></div>
  `,

  codeTabs: [
    { id: "nn", label: "① NOT NULL an toàn", lines: [
      "SET lock_timeout = '3s';",
      "ALTER TABLE orders ADD COLUMN currency text;                     -- tức thì",
      "ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'VND';        -- cho row mới",
      "-- backfill theo lô (tab ④)",
      "",
      "ALTER TABLE orders ADD CONSTRAINT orders_currency_nn",
      "  CHECK (currency IS NOT NULL) NOT VALID;                         -- tức thì",
      "ALTER TABLE orders VALIDATE CONSTRAINT orders_currency_nn;        -- quét, không chặn ghi",
      "ALTER TABLE orders ALTER COLUMN currency SET NOT NULL;            -- PG 12+: không quét lại",
      "ALTER TABLE orders DROP CONSTRAINT orders_currency_nn;"
    ]},
    { id: "fk", label: "② FK & index", lines: [
      "SET lock_timeout = '3s';",
      "ALTER TABLE order_items ADD CONSTRAINT order_items_order_fk",
      "  FOREIGN KEY (order_id) REFERENCES orders (id) NOT VALID;         -- chỉ áp cho row mới",
      "ALTER TABLE order_items VALIDATE CONSTRAINT order_items_order_fk;  -- kiểm row cũ, khoá nhẹ",
      "",
      "CREATE INDEX CONCURRENTLY order_items_order_id_idx ON order_items (order_id);",
      "",
      "-- thất bại giữa chừng → index INVALID còn nằm đó",
      "SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;",
      "DROP INDEX CONCURRENTLY order_items_order_id_idx;"
    ]},
    { id: "sqlx", label: "③ sqlx migrate", lines: [
      "# migrations/20260927090000_add_currency.sql",
      "SET lock_timeout = '3s';",
      "ALTER TABLE orders ADD COLUMN currency text;",
      "",
      "# migrations/20260927090100_idx_currency.sql",
      "-- no-transaction",
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_currency_idx ON orders (currency);",
      "",
      "$ sqlx migrate run --database-url \"$DATABASE_URL\"",
      "",
      "// hoặc nhúng vào binary: sqlx::migrate!(\"./migrations\").run(&pool).await?;"
    ]},
    { id: "batch", label: "④ Backfill theo lô", lines: [
      "loop {",
      "    let n = sqlx::query(",
      "        \"UPDATE orders SET currency = 'VND' \\",
      "         WHERE id IN (SELECT id FROM orders WHERE currency IS NULL LIMIT 5000 \\",
      "                      FOR UPDATE SKIP LOCKED)\")",
      "        .execute(&pool).await?        // mỗi lô một transaction ngắn",
      "        .rows_affected();",
      "    if n == 0 { break; }",
      "    tokio::time::sleep(Duration::from_millis(200)).await;   // nhường I/O, cho replica kịp",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="e1"><div class="nl">① Expand</div><div class="ns">ADD COLUMN · app ghi cả cũ lẫn mới</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="e2"><div class="nl">② Backfill theo lô</div><div class="ns">5.000 row / transaction</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="e3"><div class="nl">③ Ràng buộc &amp; index</div><div class="ns">NOT VALID → VALIDATE · CONCURRENTLY</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="e4"><div class="nl">④ Chuyển đọc sang cột mới</div><div class="ns">deploy app</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="e5"><div class="nl">⑤ Contract</div><div class="ns">ngừng ghi cột cũ → DROP COLUMN</div></div>
  `,
  steps: [
    { title: "1 · Expand với lock_timeout", tab: "nn", highlight: [1, 2, 3], on: ["e1"],
      desc: "Thêm cột nullable là thao tác chỉ sửa catalog. lock_timeout đảm bảo nó không làm tắc bảng nếu phải chờ." },
    { title: "2 · Backfill từng lô", tab: "batch", highlight: [3, 4, 5, 6, 9], on: ["a1", "e2"],
      desc: "Mỗi lô commit riêng: khoá ngắn, VACUUM dọn được dần, replica không bị dồn WAL." },
    { title: "3 · NOT NULL không quét dưới khoá nặng", tab: "nn", highlight: [6, 7, 8, 9, 10], on: ["a2", "e3"],
      desc: "CHECK NOT VALID tức thì; VALIDATE quét với khoá cho phép ghi; SET NOT NULL tin vào CHECK đã validate." },
    { title: "4 · FK và index không chặn ghi", tab: "fk", highlight: [3, 4, 6, 9, 10], on: ["e3"],
      desc: "FK NOT VALID + VALIDATE; index CONCURRENTLY. Nhớ dọn index INVALID nếu thất bại." },
    { title: "5 · Chạy bằng sqlx migrate", tab: "sqlx", highlight: [2, 6, 7, 9, 11], on: ["a3", "e4"],
      desc: "File có CONCURRENTLY phải có <code>-- no-transaction</code> ở dòng đầu, và nên chỉ chứa một câu lệnh." },
    { title: "6 · Contract", tab: "sqlx", highlight: [9], on: ["a4", "e5"],
      desc: "Chỉ DROP cột cũ khi không còn phiên bản app nào đọc/ghi nó — thường ở lần deploy sau." }
  ],

  quiz: [
    { q: "Vì sao mọi migration DDL nên SET lock_timeout?", options: [
        "Để chạy nhanh hơn",
        "Để DDL bỏ cuộc sớm khi phải chờ khoá, thay vì làm tắc mọi query xếp hàng phía sau",
        "Để tránh deadlock với VACUUM",
        "Bắt buộc về cú pháp"
      ], correct: 1, explanation: "Thất bại rồi retry rẻ hơn nhiều so với vài phút bảng đứng hình." },
    { q: "Từ PG 11, ADD COLUMN ... DEFAULT 'VND' có rewrite bảng không?", options: [
        "Có, luôn luôn",
        "Không, default hằng số được lưu trong catalog",
        "Có nếu bảng > 1 GB",
        "Chỉ khi có index"
      ], correct: 1, explanation: "Default volatile như clock_timestamp() vẫn rewrite." },
    { q: "Cách đặt NOT NULL trên bảng lớn không quét dưới ACCESS EXCLUSIVE?", options: [
        "ALTER COLUMN SET NOT NULL trực tiếp",
        "ADD CHECK (col IS NOT NULL) NOT VALID → VALIDATE CONSTRAINT → SET NOT NULL → DROP CHECK",
        "Dùng trigger",
        "VACUUM FULL trước"
      ], correct: 1, explanation: "PG 12+ dùng CHECK đã validate để bỏ qua bước quét." },
    { q: "ADD FOREIGN KEY ... NOT VALID có tác dụng gì?", options: [
        "Tắt FK hoàn toàn",
        "Áp ràng buộc cho row mới ngay, bỏ qua kiểm tra row cũ; VALIDATE sau với khoá nhẹ",
        "Chỉ kiểm tra row cũ",
        "Tạo index"
      ], correct: 1, explanation: "Tách phần tốn thời gian ra khỏi khoá nặng." },
    { q: "CREATE INDEX CONCURRENTLY thất bại giữa chừng để lại gì?", options: [
        "Không gì cả",
        "Một index INVALID vẫn tốn chi phí ghi — cần DROP INDEX CONCURRENTLY rồi tạo lại",
        "Bảng bị khoá",
        "Dữ liệu hỏng"
      ], correct: 1, explanation: "Tìm bằng pg_index.indisvalid = false." },
    { q: "Vì sao migration CREATE INDEX CONCURRENTLY lỗi khi chạy bằng sqlx migrate mặc định?", options: [
        "sqlx không hỗ trợ index",
        "sqlx bọc mỗi migration trong transaction, mà CONCURRENTLY không chạy trong transaction block",
        "Thiếu quyền",
        "Sai cú pháp"
      ], correct: 1, explanation: "Thêm '-- no-transaction' ở dòng đầu file." },
    { q: "Đổi tên cột an toàn khi rolling deploy?", options: [
        "RENAME COLUMN một lần",
        "Expand/contract: thêm cột mới, ghi cả hai, backfill, chuyển đọc, rồi mới bỏ cột cũ",
        "Tắt app rồi đổi",
        "Dùng view"
      ], correct: 1, explanation: "Rolling deploy luôn có hai phiên bản app chạy song song." },
    { q: "Backfill 200 triệu row nên làm thế nào?", options: [
        "Một câu UPDATE duy nhất",
        "Theo lô vài nghìn row, mỗi lô một transaction, có nghỉ giữa các lô",
        "VACUUM FULL",
        "Qua pg_dump"
      ], correct: 1, explanation: "Tránh transaction khổng lồ, bloat, lag replica." },
    { q: "ALTER COLUMN TYPE nào thường KHÔNG rewrite bảng?", options: [
        "int → bigint",
        "varchar(50) → varchar(100) hoặc varchar → text",
        "text → int",
        "numeric → integer"
      ], correct: 1, explanation: "int → bigint rewrite cả bảng và index — cần expand/contract với bảng lớn." }
  ]
});
