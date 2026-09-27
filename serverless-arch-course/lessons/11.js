window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Dữ liệu: nhất quán & lưu trữ",
  title: "D1 sâu: giới hạn, read replica, Sessions API và sharding theo tenant",
  subtitle: "Một primary đơn luồng · batch = transaction · bookmark · 10 GB/DB · khi nào chuyển sang DO SQLite",

  theory: `
    <p>D1 là SQLite được quản lý: bạn gọi qua binding (<code>env.DB.prepare(sql).bind(...).run()/first()/all()</code>), có migration, Time Travel, read replica.
    Nhưng bên dưới vẫn là <strong>SQLite: mỗi database xử lý query tuần tự trên một primary</strong>. Đó là điểm phải hiểu trước mọi thứ.</p>

    <p><strong>Throughput = 1 / thời gian query</strong>: query trung bình 1 ms → trần ~1.000 query/giây cho <em>một</em> DB; query quét bảng 100 ms → chỉ ~10/giây và mọi request khác xếp hàng.
    Index đúng quan trọng hơn cả với Postgres. Không có connection pool, không có lock hàng — chỉ có hàng đợi.</p>

    <table>
      <tr><th>Giới hạn (Paid)</th><th>Giá trị</th></tr>
      <tr><td>Dung lượng mỗi DB</td><td>10 GB (không tăng được) — thiết kế để scale ngang</td></tr>
      <tr><td>Số DB / account</td><td>50.000</td></tr>
      <tr><td>Thời gian một query</td><td>≤ 30 s</td></tr>
      <tr><td>Tham số bind / query</td><td>100</td></tr>
      <tr><td>Time Travel (khôi phục theo thời điểm)</td><td>30 ngày</td></tr>
    </table>

    <p><strong>Transaction</strong>: không có <code>BEGIN/COMMIT</code> tương tác qua nhiều round-trip. Dùng <code>env.DB.batch([stmt1, stmt2])</code> — các câu chạy tuần tự trong <em>một</em> transaction, lỗi thì rollback cả.
    Logic kiểu "đọc → quyết định trong JS → ghi" phải viết lại thành SQL có điều kiện (<code>UPDATE ... WHERE stock &gt;= ?</code>) hoặc đưa vào DO.</p>

    <p><strong>Read replication + Sessions API</strong>: bật replica thì query đọc có thể đi tới bản sao gần user. Để không "ghi xong mà đọc không thấy", mọi query phải đi qua một <em>session</em>:</p>
    <ul>
      <li><code>env.DB.withSession('first-primary')</code> — query đầu tới primary (mới nhất), sau đó có thể đọc replica.</li>
      <li><code>env.DB.withSession('first-unconstrained')</code> (mặc định) — query đầu tới bất kỳ đâu, nhanh nhất.</li>
      <li><code>env.DB.withSession(bookmark)</code> — tiếp tục từ phiên trước: đảm bảo thấy dữ liệu <em>ít nhất</em> mới bằng bookmark. Trả bookmark cho client qua header (<code>session.getBookmark()</code>).</li>
    </ul>

    <p><strong>Sharding theo tenant</strong>: tenant lớn cần &gt;10 GB hoặc &gt;1.000 qps → mỗi tenant một DB. Nhưng binding D1 khai báo <em>tĩnh</em> trong wrangler (mỗi DB một binding, tối đa ~5.000 binding/script),
    nên hàng nghìn tenant thay đổi liên tục thì khó. Khi đó <strong>DO SQLite "mỗi tenant một object"</strong> hợp hơn: tạo động theo tên, không cần khai báo.</p>

    <div class="callout"><p>💡 Bảng chọn: dữ liệu quan hệ chung, cỡ vừa, nhiều query ad-hoc → D1. Dữ liệu tách được theo thực thể (user/tenant/room), cần ghi nhiều, cần logic cạnh dữ liệu → DO SQLite.
    Dữ liệu lớn, JOIN phức tạp, đã có sẵn → giữ Postgres + Hyperdrive (bài 13).</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "① Query & batch", lines: [
      "const p = await env.DB.prepare('SELECT * FROM product WHERE id = ?').bind(id).first();",
      "",
      "// Trừ kho có điều kiện — không đọc-rồi-ghi trong JS",
      "const [upd, ins] = await env.DB.batch([",
      "  env.DB.prepare('UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?').bind(qty, id, qty),",
      "  env.DB.prepare('INSERT INTO order_line(order_id, product_id, qty) VALUES (?, ?, ?)').bind(oid, id, qty)",
      "]);",
      "if (upd.meta.changes === 0) throw new Error('OUT_OF_STOCK');",
      "// lưu ý: INSERT vẫn đã chạy → cần điều kiện trong SQL hoặc bù trừ"
    ]},
    { id: "session", label: "② Sessions API", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const bm = req.headers.get('x-d1-bookmark') ?? 'first-unconstrained';",
      "    const s = env.DB.withSession(bm);",
      "    if (req.method === 'POST') {",
      "      await s.prepare('INSERT INTO note(body) VALUES (?)').bind(await req.text()).run();",
      "    }",
      "    const { results } = await s.prepare('SELECT * FROM note ORDER BY id DESC LIMIT 20').all();",
      "    const res = Response.json(results);",
      "    res.headers.set('x-d1-bookmark', s.getBookmark() ?? '');",
      "    return res;",
      "  }",
      "};"
    ]},
    { id: "mig", label: "③ Migration", lines: [
      "npx wrangler d1 create shop-db",
      "npx wrangler d1 migrations create shop-db add_order_line",
      "# viết SQL vào migrations/0002_add_order_line.sql",
      "npx wrangler d1 migrations apply shop-db --local",
      "npx wrangler d1 migrations apply shop-db --remote",
      "",
      "# khôi phục về trước sự cố",
      "npx wrangler d1 time-travel restore shop-db --timestamp=2026-09-20T08:00:00Z"
    ]},
    { id: "shard", label: "④ Chọn DB theo tenant", lines: [
      "// wrangler: mỗi DB lớn một binding (tĩnh)",
      "// \"d1_databases\": [{ \"binding\": \"DB_ACME\", ... }, { \"binding\": \"DB_GLOBEX\", ... }]",
      "const DB_BY_TENANT = { acme: 'DB_ACME', globex: 'DB_GLOBEX' };",
      "const db = env[DB_BY_TENANT[tenant]] ?? env.DB_SHARED;   // tenant nhỏ ở chung, có cột tenant_id",
      "",
      "// Hàng nghìn tenant động → DO SQLite mỗi tenant một object:",
      "const t = env.TENANT.getByName(tenant);",
      "await t.createInvoice(data);"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="u"><div class="nl">👤 User SGN</div><div class="ns">POST note</div></div>
      <div class="node" id="bm"><div class="nl">🔖 bookmark</div><div class="ns">header x-d1-bookmark</div></div>
    </div>
    <div class="arrow" id="a1">↓ ghi luôn tới primary</div>
    <div class="node" id="pri"><div class="nl">🗄️ D1 primary (một luồng)</div><div class="ns">query xếp hàng tuần tự</div></div>
    <div class="arrow" id="a2">↓ sao chép bất đồng bộ</div>
    <div class="node" id="rep"><div class="nl">📖 Replica APAC</div><div class="ns">chỉ phục vụ nếu đã mới bằng bookmark</div></div>
  `,
  steps: [
    { title: "1 · Primary đơn luồng", tab: "basic", highlight: [1], on: ["pri"],
      desc: "Mỗi DB xử lý tuần tự. Query chậm làm cả DB chậm — index là sống còn." },
    { title: "2 · Batch là transaction", tab: "basic", highlight: [4, 5, 6, 8, 9], on: ["pri"],
      desc: "Không có transaction tương tác. Đẩy điều kiện vào SQL; nhớ rằng câu sau trong batch vẫn chạy dù câu trước 'không đổi dòng nào'." },
    { title: "3 · Ghi qua session", tab: "session", highlight: [3, 4, 6], on: ["u", "a1", "pri"],
      desc: "Write luôn tới primary. Session nhớ phiên bản DB đã thấy." },
    { title: "4 · Trả bookmark cho client", tab: "session", highlight: [8, 10], on: ["bm"],
      desc: "Request sau mang bookmark → replica chỉ trả lời nếu đã mới ít nhất bằng bookmark, nếu không thì đi primary. User luôn thấy thứ mình vừa ghi." },
    { title: "5 · Đọc từ replica gần", tab: "session", highlight: [3, 4, 8], on: ["a2", "rep"],
      desc: "Đọc nhanh nhờ replica gần user, vẫn giữ read-your-writes nhờ bookmark." },
    { title: "6 · Scale theo tenant", tab: "shard", highlight: [3, 4, 7, 8], on: ["pri"],
      desc: "Tenant lớn → DB riêng (binding tĩnh). Rất nhiều tenant động → DO SQLite mỗi tenant một object." }
  ],

  quiz: [
    { q: "Vì sao một query D1 chậm (quét bảng 200 ms) làm chậm mọi request khác cùng DB?", options: [
        "Vì D1 có ít connection",
        "Vì mỗi DB xử lý query tuần tự trên một primary; các query khác xếp hàng chờ",
        "Vì Worker bị giới hạn CPU",
        "Không ảnh hưởng"
      ], correct: 1, explanation: "Throughput ≈ 1 / thời gian query." },
    { q: "Dung lượng tối đa một D1 database (Paid)?", options: [
        "500 MB", "10 GB", "100 GB", "1 TB"
      ], correct: 1, explanation: "Scale ngang bằng nhiều DB." },
    { q: "Transaction nhiều câu trong D1 làm thế nào?", options: [
        "BEGIN ... COMMIT qua nhiều lần gọi",
        "env.DB.batch([...]) — chạy trong một transaction",
        "@Transactional",
        "Không hỗ trợ"
      ], correct: 1, explanation: "Không có transaction tương tác qua nhiều round-trip." },
    { q: "withSession('first-primary') khác 'first-unconstrained' ở đâu?", options: [
        "Không khác",
        "first-primary cho query đầu tới primary (dữ liệu mới nhất); unconstrained cho phép tới replica bất kỳ (nhanh nhất)",
        "first-primary chỉ ghi được",
        "unconstrained tắt replica"
      ], correct: 1, explanation: "Sau query đầu, session vẫn giữ nhất quán tuần tự." },
    { q: "Bookmark trong Sessions API dùng để làm gì?", options: [
        "Đánh dấu trang",
        "Đảm bảo request sau thấy dữ liệu ít nhất mới bằng lần trước (read-your-writes qua nhiều request)",
        "Backup DB",
        "Giới hạn query"
      ], correct: 1, explanation: "Trả qua header cho client, client gửi lại lần sau." },
    { q: "Có 20.000 tenant, tenant mới đăng ký liên tục, mỗi tenant cần DB riêng. Lựa chọn hợp lý hơn?", options: [
        "Mỗi tenant một D1 binding khai báo trong wrangler",
        "DO SQLite: mỗi tenant một object tạo động theo tên",
        "Một KV namespace",
        "Một D1 chung 10 GB"
      ], correct: 1, explanation: "Binding D1 là tĩnh; DO tạo động không cần khai báo." },
    { q: "Batch: UPDATE ... WHERE stock >= ? (0 dòng đổi) rồi INSERT order_line. Kết quả?", options: [
        "Cả batch tự rollback vì UPDATE không đổi dòng",
        "INSERT vẫn chạy — 0 dòng đổi không phải lỗi; phải đưa điều kiện vào SQL hoặc tự bù",
        "INSERT bị bỏ qua",
        "Lỗi cú pháp"
      ], correct: 1, explanation: "Chỉ lỗi thật (exception) mới rollback batch." },
    { q: "D1 Time Travel trên gói Paid cho khôi phục trong bao lâu?", options: [
        "24 giờ", "7 ngày", "30 ngày", "1 năm"
      ], correct: 2, explanation: "Free là 7 ngày." },
    { q: "Mẫu 'đọc tồn kho vào JS, kiểm tra, rồi UPDATE' trong D1 nguy hiểm vì?", options: [
        "Chậm",
        "Giữa hai lần gọi, request khác có thể đã đổi tồn kho — không có transaction bao quanh",
        "Tốn tiền",
        "Không nguy hiểm"
      ], correct: 1, explanation: "Dùng UPDATE có điều kiện hoặc đưa logic vào DO." }
  ]
});
