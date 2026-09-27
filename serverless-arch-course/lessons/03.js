window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Durable Objects sâu",
  title: "Storage API SQLite trong Durable Object",
  subtitle: "sql.exec đồng bộ · cursor · transactionSync · schema migration · PITR · 10 GB/object",

  theory: `
    <p>Mỗi DO kiểu SQLite (khai báo bằng <code>new_sqlite_classes</code> trong migrations) có <strong>một database SQLite riêng</strong>, nằm <em>cùng máy</em> với code.
    Vì vậy query là <strong>gọi hàm đồng bộ</strong>, tính bằng micro-giây, không có round-trip mạng. Đây là khác biệt lớn nhất so với việc Spring gọi Postgres qua JDBC.</p>

    <p><strong>API cốt lõi</strong></p>
    <table>
      <tr><th>API</th><th>Ghi chú</th></tr>
      <tr><td><code>ctx.storage.sql.exec(query, ...bindings)</code></td><td>Trả về cursor, <strong>không cần await</strong>. Tham số dùng <code>?</code></td></tr>
      <tr><td><code>cursor.toArray()</code> / <code>cursor.one()</code> / <code>for (const row of cursor)</code></td><td><code>one()</code> ném lỗi nếu không đúng 1 dòng</td></tr>
      <tr><td><code>cursor.rowsRead</code>, <code>cursor.rowsWritten</code></td><td>Số dòng đọc/ghi — chính là đơn vị tính tiền storage</td></tr>
      <tr><td><code>ctx.storage.transactionSync(() =&gt; {...})</code></td><td>Callback đồng bộ; ném lỗi thì rollback</td></tr>
      <tr><td><code>ctx.storage.get/put/delete/list</code></td><td>API key-value kiểu cũ vẫn dùng được, dữ liệu nằm trong bảng ẩn của cùng SQLite</td></tr>
      <tr><td><code>ctx.storage.getBookmarkForTime()</code> + <code>onNextSessionRestoreBookmark()</code></td><td>Point-in-time recovery trong 30 ngày</td></tr>
    </table>

    <p><strong>Nguyên tử tự động</strong>: mọi write trong cùng một "lượt" xử lý (không có await xen giữa) được gộp và commit nguyên tử; output gate giữ response cho tới khi commit xong.
    Không được dùng lệnh <code>BEGIN TRANSACTION</code> thủ công qua <code>sql.exec</code> — hãy dùng <code>transactionSync</code>.</p>

    <p><strong>Schema migration</strong>: không có Flyway. Mẫu phổ biến: trong constructor gọi <code>ctx.blockConcurrencyWhile()</code> một lần, đọc
    phiên bản schema trong một bảng <code>_meta</code> tự tạo rồi chạy các bước còn thiếu. Constructor chạy lại mỗi lần object thức dậy nên phải idempotent (<code>IF NOT EXISTS</code>).</p>

    <p><strong>Giới hạn</strong>: 10 GB / object (Paid; Free 1 GB). Vượt thì ghi lỗi <code>SQLITE_FULL</code>, đọc/xoá vẫn được. Không có giới hạn tổng số object.
    Muốn nhiều dữ liệu hơn → nhiều object (thường là mỗi user/tenant một object).</p>

    <div class="callout"><p>💡 "Mỗi user một database" nghe lạ với dân Spring quen một Postgres chung, nhưng với DO đó là mẫu chuẩn: dữ liệu của user nằm cạnh code xử lý user đó,
    không bao giờ tranh lock với user khác. Cái giá: <strong>không JOIN/aggregate xuyên object</strong> — báo cáo toàn cục phải đẩy sự kiện ra Queues → ClickHouse/D1.</p></div>
  `,

  codeTabs: [
    { id: "schema", label: "① Constructor + migration", lines: [
      "import { DurableObject } from 'cloudflare:workers';",
      "",
      "export class Cart extends DurableObject {",
      "  constructor(ctx, env) {",
      "    super(ctx, env);",
      "    ctx.blockConcurrencyWhile(async () => this.migrate());",
      "  }",
      "  migrate() {",
      "    const sql = this.ctx.storage.sql;",
      "    sql.exec('CREATE TABLE IF NOT EXISTS _meta(k TEXT PRIMARY KEY, v INTEGER)');",
      "    const v = sql.exec(\"SELECT v FROM _meta WHERE k = 'schema'\").toArray()[0]?.v ?? 0;",
      "    if (v < 1) {",
      "      sql.exec('CREATE TABLE IF NOT EXISTS item(sku TEXT PRIMARY KEY, qty INTEGER NOT NULL)');",
      "    }",
      "    if (v < 2) {",
      "      sql.exec('ALTER TABLE item ADD COLUMN price_cents INTEGER DEFAULT 0');",
      "    }",
      "    sql.exec(\"INSERT OR REPLACE INTO _meta VALUES ('schema', 2)\");",
      "  }"
    ]},
    { id: "query", label: "② Query đồng bộ", lines: [
      "  add(sku, qty, price) {",
      "    this.ctx.storage.sql.exec(",
      "      'INSERT INTO item(sku, qty, price_cents) VALUES (?, ?, ?) ' +",
      "      'ON CONFLICT(sku) DO UPDATE SET qty = qty + excluded.qty',",
      "      sku, qty, price);",
      "    return this.total();              // không await: đọc ngay dữ liệu vừa ghi",
      "  }",
      "  total() {",
      "    const c = this.ctx.storage.sql.exec('SELECT SUM(qty * price_cents) AS t FROM item');",
      "    return { cents: c.one().t ?? 0, rowsRead: c.rowsRead };",
      "  }"
    ]},
    { id: "tx", label: "③ transactionSync", lines: [
      "  checkout(orderId) {",
      "    return this.ctx.storage.transactionSync(() => {",
      "      const items = this.ctx.storage.sql.exec('SELECT * FROM item').toArray();",
      "      if (items.length === 0) throw new Error('EMPTY');   // rollback",
      "      this.ctx.storage.sql.exec('DELETE FROM item');",
      "      this.ctx.storage.put('lastOrder', orderId);",
      "      return items;",
      "    });",
      "  }"
    ]},
    { id: "pitr", label: "④ Khôi phục (PITR)", lines: [
      "  async restoreTo(ts) {",
      "    const bm = await this.ctx.storage.getBookmarkForTime(ts);   // trong 30 ngày",
      "    await this.ctx.storage.onNextSessionRestoreBookmark(bm);",
      "    this.ctx.abort();   // khởi động lại object → dữ liệu quay về thời điểm ts",
      "  }"
    ]},
    { id: "java", label: "⑤ So với Spring/JPA", lines: [
      "// Spring: mỗi query là round-trip mạng tới Postgres chung",
      "@Transactional",
      "public Order checkout(long cartId) {",
      "    var items = itemRepo.findByCartId(cartId);   // ~1-5 ms mạng",
      "    itemRepo.deleteByCartId(cartId);             // lock hàng trong DB chung",
      "    return orderRepo.save(new Order(items));",
      "}",
      "// DO: DB riêng của cart, cùng máy, query ~micro-giây, không tranh lock với cart khác"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 RPC add('SKU-1', 2)</div><div class="ns">tới DO cart:user-7</div></div>
    <div class="arrow" id="a1">↓ gọi hàm, không qua mạng</div>
    <div class="row">
      <div class="node" id="code"><div class="nl">⚙️ Code DO</div><div class="ns">sql.exec đồng bộ</div></div>
      <div class="node" id="db"><div class="nl">💾 SQLite của object</div><div class="ns">cùng máy · ≤ 10 GB</div></div>
    </div>
    <div class="arrow" id="a2">↓ commit nguyên tử, output gate mở</div>
    <div class="node" id="res"><div class="nl">✅ Response</div><div class="ns">chỉ gửi khi đã bền vững</div></div>
  `,
  steps: [
    { title: "1 · Migration khi thức dậy", tab: "schema", highlight: [6, 10, 11, 14, 17], on: ["code", "db"],
      desc: "blockConcurrencyWhile chặn mọi request tới khi schema sẵn sàng. Bảng _meta ghi phiên bản schema, cho biết cần chạy bước nào." },
    { title: "2 · Ghi và đọc không await", tab: "query", highlight: [2, 3, 4, 6], on: ["req", "a1", "code"],
      desc: "sql.exec trả về ngay; đọc lại thấy dữ liệu vừa ghi. Không có N+1 tốn round-trip như JDBC." },
    { title: "3 · Đếm chi phí", tab: "query", highlight: [9, 10], on: ["db"],
      desc: "rowsRead/rowsWritten là đơn vị tính tiền. SELECT không có index trên bảng lớn = đọc nhiều dòng = tốn tiền." },
    { title: "4 · Giao dịch rõ ràng", tab: "tx", highlight: [2, 4, 5, 6], on: ["db", "a2"],
      desc: "transactionSync gộp cả SQL lẫn put KV; ném lỗi thì rollback toàn bộ." },
    { title: "5 · Response sau commit", tab: "tx", highlight: [7], on: ["res"],
      desc: "Output gate chỉ thả response khi commit xong — không có chuyện client thấy 'OK' rồi dữ liệu mất." },
    { title: "6 · Quay ngược thời gian", tab: "pitr", highlight: [2, 3, 4], on: ["db"],
      desc: "PITR 30 ngày cho từng object: cứu dữ liệu một user mà không đụng tới user khác." }
  ],

  quiz: [
    { q: "Vì sao sql.exec trong DO không cần await?", options: [
        "Vì nó chạy trong Worker khác",
        "Vì SQLite nằm cùng máy/tiến trình với object, query là gọi hàm đồng bộ",
        "Vì kết quả luôn được cache",
        "Vì nó chỉ đọc được, không ghi được"
      ], correct: 1, explanation: "Không có mạng giữa code và DB." },
    { q: "Muốn giao dịch nhiều câu SQL có rollback trong DO, dùng gì?", options: [
        "sql.exec('BEGIN TRANSACTION')",
        "ctx.storage.transactionSync(() => {...})",
        "@Transactional",
        "Không thể"
      ], correct: 1, explanation: "BEGIN thủ công không được hỗ trợ; transactionSync rollback khi callback ném lỗi." },
    { q: "Giới hạn storage mỗi SQLite DO trên gói Paid?", options: [
        "128 MB", "1 GB", "10 GB", "Không giới hạn"
      ], correct: 2, explanation: "Free là 1 GB. Vượt thì write lỗi SQLITE_FULL." },
    { q: "Đơn vị tính tiền của SQLite storage trong DO gắn với thông số nào của cursor?", options: [
        "columnNames", "rowsRead / rowsWritten", "cursor.length", "duration"
      ], correct: 1, explanation: "Tiền tính theo số dòng đọc, dòng ghi và dung lượng lưu trữ." },
    { q: "Vì sao code migration trong constructor phải idempotent?", options: [
        "Vì constructor chỉ chạy một lần trong đời object",
        "Vì constructor chạy lại mỗi khi object được nạp vào bộ nhớ (sau khi bị evict/hibernate)",
        "Vì SQLite yêu cầu",
        "Không cần idempotent"
      ], correct: 1, explanation: "Dùng bảng _meta/IF NOT EXISTS để chạy lại không hỏng gì." },
    { q: "Cần báo cáo tổng doanh thu trên 1 triệu DO Cart. Cách đúng?", options: [
        "Gọi RPC tới từng object và cộng",
        "Mỗi object đẩy sự kiện ra Queues, consumer ghi vào kho phân tích (D1/ClickHouse)",
        "JOIN giữa các SQLite",
        "Đọc file SQLite trực tiếp"
      ], correct: 1, explanation: "DO không hỗ trợ query xuyên object; tách đường phân tích riêng." },
    { q: "cursor.one() làm gì khi query trả về 0 dòng?", options: [
        "Trả về null", "Ném lỗi", "Trả về {}", "Trả về mảng rỗng"
      ], correct: 1, explanation: "one() yêu cầu chính xác một dòng." },
    { q: "PITR của DO SQLite cho phép gì?", options: [
        "Khôi phục toàn bộ namespace về 1 năm trước",
        "Khôi phục một object về bất kỳ thời điểm nào trong 30 ngày gần nhất",
        "Sao lưu sang S3",
        "Đồng bộ với Postgres"
      ], correct: 1, explanation: "getBookmarkForTime + onNextSessionRestoreBookmark rồi khởi động lại object." },
    { q: "Đặc điểm của các write trong một lượt xử lý không có await xen giữa?", options: [
        "Mỗi write commit riêng",
        "Được gộp và commit nguyên tử",
        "Bị bỏ qua nếu không gọi flush()",
        "Chỉ commit khi object hibernate"
      ], correct: 1, explanation: "Cơ chế tự gộp write (implicit transaction) cùng output gate." }
  ]
});
