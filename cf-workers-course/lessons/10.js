window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Bindings: lưu trữ & kết nối",
  title: "D1 — SQLite serverless: migrations, prepared statement, batch",
  subtitle: "prepare/bind/first/all/run · batch = transaction · migrations · một DB xử lý tuần tự · 10 GB/DB",

  theory: `
    <p><strong>D1</strong> là CSDL SQL do Cloudflare quản lý, xây trên <strong>SQLite</strong>. Bạn viết SQL dialect SQLite, truy cập qua binding (không có JDBC URL, không có pool).
    Hợp cho service nhỏ, mỗi service một DB riêng — đúng với kiến trúc "mỗi service một DB" của công ty.</p>

    <p><strong>Mô hình cần hiểu trước khi dùng</strong></p>
    <ul>
      <li>Mỗi DB có một bản chính (primary) ở một vị trí. Worker ở edge gửi truy vấn tới đó (có thể bật read replication qua Sessions API để đọc gần hơn).</li>
      <li><strong>Mỗi DB xử lý truy vấn tuần tự, từng cái một</strong> (single-threaded). Truy vấn 10 ms → trần ~100 truy vấn/giây cho DB đó. Truy vấn chậm chặn mọi truy vấn khác.
      Vì vậy: index đúng, truy vấn ngắn, và <em>chia nhỏ DB</em> (theo tenant/service) khi tải lớn.</li>
      <li>Giới hạn: 10 GB/DB (Paid), 500 MB (Free); 1000 truy vấn/lần gọi Worker (Paid), 50 (Free); tối đa 100 tham số bind/truy vấn; một hàng ≤ 2 MB.</li>
    </ul>

    <p><strong>API</strong></p>
    <table>
      <tr><th>Gọi</th><th>Trả về</th><th>Giống JDBC/Spring</th></tr>
      <tr><td><code>prepare(sql).bind(a, b)</code></td><td>Statement</td><td><code>PreparedStatement</code> + <code>setX</code></td></tr>
      <tr><td><code>.first()</code> / <code>.first('col')</code></td><td>Hàng đầu hoặc <code>null</code></td><td><code>queryForObject</code> (nhưng không ném lỗi khi rỗng)</td></tr>
      <tr><td><code>.all()</code></td><td><code>{ results, meta }</code></td><td><code>query</code> → List</td></tr>
      <tr><td><code>.run()</code></td><td><code>{ meta: { changes, last_row_id } }</code></td><td><code>update</code> → số dòng</td></tr>
      <tr><td><code>env.DB.batch([s1, s2])</code></td><td>Mảng kết quả</td><td><code>@Transactional</code>: lỗi một câu → rollback cả lô</td></tr>
    </table>
    <p>Không có <code>BEGIN ... COMMIT</code> tương tác kéo dài qua nhiều <code>await</code> — muốn nguyên tử thì gom vào <code>batch()</code>, hoặc viết một câu SQL làm hết (vd <code>UPDATE ... WHERE stock &gt;= ?</code>).</p>

    <p><strong>Migrations</strong> giống Flyway: file SQL đánh số trong <code>migrations/</code>, Wrangler ghi lại cái nào đã áp dụng (bảng <code>d1_migrations</code>).
    Áp local bằng <code>--local</code>, production bằng <code>--remote</code>. Có Time Travel để khôi phục DB về một thời điểm trong 30 ngày gần nhất (Paid).</p>

    <div class="callout"><p>💡 Luôn dùng <code>bind()</code>, đừng nối chuỗi SQL — SQL injection vẫn là SQL injection dù ở edge.
    Và vì DB chạy tuần tự, một truy vấn full-scan trên bảng lớn không chỉ chậm cho bạn mà chặn mọi request khác của service.</p></div>
  `,

  codeTabs: [
    { id: "cli", label: "Tạo & migrate", lines: [
      "npx wrangler d1 create shop-db                         # in ra database_id",
      "npx wrangler d1 migrations create shop-db init          # tạo migrations/0001_init.sql",
      "npx wrangler d1 migrations apply shop-db --local        # áp vào .wrangler/state",
      "npx wrangler d1 migrations apply shop-db --remote       # áp lên production",
      "npx wrangler d1 execute shop-db --remote --command \"SELECT count(*) FROM products\"",
      "",
      "// wrangler.jsonc",
      "\"d1_databases\": [{ \"binding\": \"DB\", \"database_name\": \"shop-db\", \"database_id\": \"<ID>\" }]"
    ]},
    { id: "sql", label: "0001_init.sql", lines: [
      "CREATE TABLE products (",
      "  id    TEXT PRIMARY KEY,",
      "  name  TEXT NOT NULL,",
      "  price INTEGER NOT NULL,          -- lưu đồng, tránh số thực",
      "  stock INTEGER NOT NULL DEFAULT 0",
      ");",
      "CREATE TABLE orders (",
      "  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, qty INTEGER NOT NULL,",
      "  created_at INTEGER NOT NULL",
      ");",
      "CREATE INDEX idx_orders_product ON orders(product_id);"
    ]},
    { id: "query", label: "Truy vấn", lines: [
      "type Product = { id: string; name: string; price: number; stock: number };",
      "",
      "const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?')",
      "  .bind(id).first<Product>();                    // null nếu không có",
      "",
      "const { results } = await env.DB.prepare(",
      "  'SELECT id, name, price FROM products ORDER BY price LIMIT ? OFFSET ?'",
      ").bind(20, 0).all<Product>();",
      "",
      "const { meta } = await env.DB.prepare('DELETE FROM orders WHERE created_at < ?')",
      "  .bind(Date.now() - 90 * 86400_000).run();",
      "console.log({ deleted: meta.changes });"
    ]},
    { id: "batch", label: "batch = transaction", lines: [
      "async function placeOrder(env: Env, productId: string, qty: number) {",
      "  const orderId = crypto.randomUUID();",
      "  const [dec] = await env.DB.batch([",
      "    env.DB.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')",
      "      .bind(qty, productId, qty),",
      "    env.DB.prepare('INSERT INTO orders (id, product_id, qty, created_at) SELECT ?, ?, ?, ? WHERE changes() > 0')",
      "      .bind(orderId, productId, qty, Date.now()),",
      "  ]);",
      "  if (dec.meta.changes === 0) return { ok: false, reason: 'out_of_stock' };",
      "  return { ok: true, orderId };",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="w"><div class="nl">⚡ Worker ở edge</div><div class="ns">env.DB.prepare(...).bind(...)</div></div>
    <div class="arrow" id="a1">↓ truy vấn qua binding</div>
    <div class="node" id="d1"><div class="nl">🗃️ D1 primary (SQLite)</div><div class="ns">xử lý TỪNG truy vấn một</div></div>
    <div class="row">
      <div class="node" id="mig"><div class="nl">📜 migrations/</div><div class="ns">bảng d1_migrations</div></div>
      <div class="node" id="tx"><div class="nl">🔒 batch()</div><div class="ns">lỗi → rollback cả lô</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Tạo DB và migration", tab: "cli", highlight: [1, 2, 3, 4, 8], on: ["mig"],
      desc: "Giống Flyway: file đánh số, áp local trước rồi <code>--remote</code>." },
    { title: "2 · Schema kiểu SQLite", tab: "sql", highlight: [4, 5, 11], on: ["mig", "d1"],
      desc: "Tiền lưu INTEGER. Index cho cột hay lọc — cực quan trọng vì DB xử lý tuần tự." },
    { title: "3 · Truy vấn có tham số", tab: "query", highlight: [3, 4, 6, 7, 8], on: ["w", "a1", "d1"],
      desc: "<code>first()</code> trả null khi rỗng; <code>all()</code> trả <code>results</code>. Luôn <code>bind()</code>." },
    { title: "4 · Ghi và đọc meta", tab: "query", highlight: [10, 11, 12], on: ["d1"],
      desc: "<code>run()</code> cho <code>meta.changes</code> — số dòng bị ảnh hưởng." },
    { title: "5 · Nguyên tử bằng batch", tab: "batch", highlight: [3, 4, 5, 6, 9], on: ["tx"],
      desc: "Hai câu chạy trong một transaction. Trừ kho có điều kiện <code>stock &gt;= ?</code>; câu INSERT chỉ chèn khi câu trước đổi được dòng." }
  ],

  quiz: [
    { q: "D1 dựa trên engine nào?", options: [
        "PostgreSQL", "MySQL", "SQLite", "ClickHouse"
      ], correct: 2, explanation: "Dùng dialect SQLite." },
    { q: "Một DB D1 xử lý truy vấn thế nào và hệ quả?", options: [
        "Song song không giới hạn",
        "Tuần tự từng truy vấn; truy vấn chậm chặn các truy vấn khác, thông lượng phụ thuộc thời gian mỗi truy vấn",
        "Mỗi Worker một DB riêng tự động",
        "Chỉ đọc được"
      ], correct: 1, explanation: "Index tốt và chia nhỏ DB là chìa khoá để scale." },
    { q: "Tương đương @Transactional cho nhiều câu SQL trong D1?", options: [
        "BEGIN/COMMIT qua nhiều await",
        "env.DB.batch([...]) — lỗi một câu thì rollback cả lô",
        "Không có transaction",
        "ctx.waitUntil"
      ], correct: 1, explanation: "Không giữ transaction tương tác xuyên nhiều await." },
    { q: ".first() khi không có dòng nào trả về gì?", options: [
        "Ném exception", "null", "[]", "undefined luôn lỗi"
      ], correct: 1, explanation: "Khác queryForObject của Spring (ném EmptyResultDataAccessException)." },
    { q: "Lấy số dòng bị xoá sau DELETE?", options: [
        "result.rowCount", "(await stmt.run()).meta.changes", "results.length", "Không lấy được"
      ], correct: 1, explanation: "meta còn có last_row_id, duration..." },
    { q: "Áp migration lên production dùng cờ nào?", options: [
        "--prod", "--remote", "--env", "--local"
      ], correct: 1, explanation: "--local áp vào DB giả lập trong .wrangler/state." },
    { q: "Dung lượng tối đa một DB D1 gói Paid?", options: [
        "500 MB", "10 GB", "1 TB", "Không giới hạn"
      ], correct: 1, explanation: "Free là 500 MB. Cần lớn hơn → chia nhiều DB hoặc dùng Postgres qua Hyperdrive." },
    { q: "Vì sao trừ kho bằng 'UPDATE ... SET stock = stock - ? WHERE id = ? AND stock >= ?' an toàn hơn đọc rồi ghi?", options: [
        "Nhanh hơn thôi",
        "Kiểm tra và cập nhật trong một câu nguyên tử, không có khoảng hở cho request khác chen vào",
        "SQLite bắt buộc",
        "Không an toàn hơn"
      ], correct: 1, explanation: "Read-modify-write qua 2 lượt await có race condition." },
    { q: "Số tham số bind tối đa cho một truy vấn D1?", options: [
        "10", "100", "1000", "65535"
      ], correct: 1, explanation: "Insert hàng loạt nên chia lô hoặc dùng batch()." }
  ]
});
