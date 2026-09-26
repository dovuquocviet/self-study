window.LESSONS.push({
  id: "08",
  phase: "3", phaseName: "Phân quyền",
  title: "Row-level security & multi-tenancy",
  subtitle: "tenant_id bắt buộc · Postgres RLS · ClickHouse row policy · Mongo lọc theo tenant ở tầng repository · D1 & Durable Objects mỗi tenant một nơi",

  theory: `
    <p>Ứng dụng SaaS phục vụ nhiều khách hàng (tenant) trên cùng hạ tầng. Lỗi đáng sợ nhất ở đây là <strong>rò rỉ chéo tenant</strong>: công ty A nhìn thấy đơn hàng của công ty B.
    Nguyên nhân thường rất đơn giản — một câu truy vấn quên <code>WHERE tenant_id = ...</code>, hoặc lấy <code>tenant_id</code> từ tham số client gửi lên.</p>

    <p><strong>1. Ba mô hình cách ly tenant</strong></p>
    <table>
      <tr><th>Mô hình</th><th>Cách làm</th><th>Mức cách ly</th><th>Chi phí vận hành</th></tr>
      <tr><td>Chung bảng (pool)</td><td>Mọi tenant chung bảng, mỗi dòng có <code>tenant_id</code></td><td>Thấp nhất — phụ thuộc mọi truy vấn lọc đúng</td><td>Rẻ, dễ mở rộng</td></tr>
      <tr><td>Schema/DB riêng (bridge)</td><td>Mỗi tenant một schema (Postgres) hoặc database (Mongo, ClickHouse)</td><td>Trung bình — quyền cắt theo schema/db</td><td>Migration phải chạy cho N schema</td></tr>
      <tr><td>Instance riêng (silo)</td><td>Mỗi tenant một cluster/DB riêng; Cloudflare: một D1 hoặc một Durable Object cho mỗi tenant</td><td>Cao nhất</td><td>Nhiều tài nguyên; Durable Objects làm mô hình này rẻ hơn nhiều</td></tr>
    </table>

    <p><strong>2. Quy tắc vàng cho <code>tenant_id</code></strong></p>
    <ul>
      <li><strong>Lấy từ danh tính đã xác thực</strong> (claim trong token/session do server cấp), <em>không bao giờ</em> từ query string, body hay header client tự đặt.</li>
      <li><strong>Bắt buộc ở tầng dữ liệu</strong>: cột <code>tenant_id NOT NULL</code>, có trong khoá chính/unique và index (<code>(tenant_id, id)</code>), khoá ngoại cũng mang theo <code>tenant_id</code>.</li>
      <li><strong>Không để dev phải nhớ</strong>: đặt việc lọc vào một nơi duy nhất — policy của DB (RLS/row policy) hoặc lớp repository bắt buộc — thay vì rải ở từng câu truy vấn.</li>
      <li><strong>Fail closed</strong>: nếu vì lý do nào đó không xác định được tenant, truy vấn phải trả <em>không</em> dòng nào (hoặc lỗi), không phải trả tất cả.</li>
    </ul>

    <p><strong>3. PostgreSQL Row-Level Security (RLS)</strong></p>
    <p>RLS cho phép DB tự thêm điều kiện vào <em>mọi</em> truy vấn trên bảng. Các điểm cần nhớ:</p>
    <ul>
      <li><code>ENABLE ROW LEVEL SECURITY</code> bật RLS; <code>FORCE ROW LEVEL SECURITY</code> áp cả cho owner của bảng (mặc định owner được bỏ qua).</li>
      <li>Superuser và role có <code>BYPASSRLS</code> luôn bỏ qua RLS → app tuyệt đối không dùng các role này.</li>
      <li><code>USING</code> lọc dòng được đọc/sửa/xoá; <code>WITH CHECK</code> kiểm tra dòng được ghi vào (chặn chèn dữ liệu mang tenant khác).</li>
      <li>Truyền tenant hiện tại bằng biến cấu hình <em>trong phạm vi transaction</em>: <code>set_config('app.tenant_id', $1, true)</code>. Với connection pool, phạm vi transaction tránh việc
        biến của request trước "dính" sang request sau.</li>
      <li>Dùng <code>current_setting('app.tenant_id', true)</code> (tham số <code>true</code> = trả NULL nếu chưa đặt) → so sánh với NULL cho kết quả rỗng → fail closed.</li>
      <li>Giới hạn: RLS chủ yếu chống <em>lỗi lập trình</em> (quên WHERE). Nếu kẻ tấn công chạy được SQL tuỳ ý bằng tài khoản app, họ có thể tự đặt lại biến. Vì vậy vẫn cần truy vấn có tham số (bài 10).</li>
    </ul>

    <p><strong>4. Các engine khác</strong></p>
    <ul>
      <li><strong>ClickHouse</strong>: <code>CREATE ROW POLICY ... USING tenant_id = ... TO role</code>. Row policy có ý nghĩa nhất với user <em>chỉ đọc</em>
        (user có quyền ghi/ALTER có thể lách). Thường dùng một user/role cho mỗi tenant trong công cụ BI, hoặc tầng API tự thêm điều kiện.</li>
      <li><strong>MongoDB</strong>: không có RLS gốc. Dùng lớp repository bắt buộc gắn <code>tenantId</code> vào mọi filter; view (<code>$match</code> theo tenant) cho truy cập chỉ đọc;
        hoặc database riêng mỗi tenant + role chỉ trên database đó.</li>
      <li><strong>Redis / KV</strong>: prefix key theo tenant do server quyết định (<code>t:{tenantId}:...</code>) — bài 11.</li>
      <li><strong>Kafka</strong>: topic theo tenant + ACL prefixed, hoặc topic chung với <code>tenant_id</code> trong message và consumer lọc/kiểm tra.</li>
      <li><strong>Cloudflare D1</strong>: có thể tạo database riêng cho tenant lớn; tenant nhỏ dùng bảng chung + lớp repository bắt buộc.
        <strong>Durable Objects</strong>: <code>env.TENANT.idFromName(tenantId)</code> → mỗi tenant một object với SQLite riêng; code trong object chỉ thấy dữ liệu của tenant đó — cách ly theo thiết kế.</li>
    </ul>

    <div class="callout"><p>💡 Viết test "hai tenant": tạo dữ liệu cho tenant A và B, đăng nhập A, gọi <em>mọi</em> endpoint đọc/sửa/xoá với ID của B — tất cả phải trả 404/403 và không lộ dữ liệu.
    Chạy test này trong CI cho mọi endpoint mới.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Tenant từ client", lines: [
      "// SAI 1: tenant lấy từ query string -> đổi số là xem được công ty khác",
      "GET /api/orders?tenant_id=42",
      "rows = db.query('SELECT * FROM orders WHERE tenant_id = $1', [req.query.tenant_id])",
      "",
      "// SAI 2: quên điều kiện tenant ở một endpoint",
      "GET /api/orders/9001",
      "row = db.query('SELECT * FROM orders WHERE id = $1', [req.params.id])",
      "// -> đơn 9001 của bất kỳ tenant nào (IDOR chéo tenant)",
      "",
      "// ĐÚNG: tenant từ phiên đã xác thực, lọc ở một nơi duy nhất",
      "tenant = session.claims.tenant_id          // server ký, client không sửa được",
      "row = repo.forTenant(tenant).orders.findById(req.params.id)"
    ]},
    { id: "rls", label: "🐘 Postgres RLS", lines: [
      "ALTER TABLE orders ADD COLUMN tenant_id uuid NOT NULL;",
      "CREATE INDEX ON orders (tenant_id, id);",
      "",
      "ALTER TABLE orders ENABLE ROW LEVEL SECURITY;",
      "ALTER TABLE orders FORCE ROW LEVEL SECURITY;      -- áp cả cho owner",
      "",
      "CREATE POLICY tenant_isolation ON orders",
      "  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)",
      "  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);",
      "",
      "-- App role: không SUPERUSER, không BYPASSRLS",
      "ALTER ROLE app_orders NOBYPASSRLS;",
      "",
      "-- Mỗi request: đặt tenant trong phạm vi transaction",
      "BEGIN;",
      "SELECT set_config('app.tenant_id', $1, true);    -- $1 = tenant từ session",
      "SELECT * FROM orders WHERE id = $2;               -- RLS tự thêm điều kiện tenant",
      "COMMIT;"
    ]},
    { id: "ch", label: "🟨 ClickHouse row policy", lines: [
      "-- Mỗi tenant (trong BI) một role chỉ đọc + row policy",
      "CREATE ROLE tenant_42_ro;",
      "GRANT SELECT ON analytics.events TO tenant_42_ro;",
      "CREATE SETTINGS PROFILE tenant_ro SETTINGS readonly = 1 TO tenant_42_ro;",
      "",
      "CREATE ROW POLICY tenant_42 ON analytics.events",
      "  FOR SELECT USING tenant_id = 42 TO tenant_42_ro;",
      "",
      "-- Kiểm tra",
      "SHOW ROW POLICIES ON analytics.events;",
      "-- Đăng nhập bằng user thuộc tenant_42_ro:",
      "SELECT DISTINCT tenant_id FROM analytics.events;   -- chỉ được thấy 42"
    ]},
    { id: "mongo", label: "🍃 Mongo repository", lines: [
      "// Mongo không có RLS: ép tenantId ở MỘT lớp duy nhất",
      "class TenantRepo {",
      "  constructor(db, tenantId) { this.col = db.collection('orders'); this.t = tenantId }",
      "  find(filter)       { return this.col.find({ ...filter, tenantId: this.t }) }",
      "  findOne(filter)    { return this.col.findOne({ ...filter, tenantId: this.t }) }",
      "  insertOne(doc)     { return this.col.insertOne({ ...doc, tenantId: this.t }) }",
      "  updateOne(f, u)    { return this.col.updateOne({ ...f, tenantId: this.t }, u) }",
      "}",
      "// tenantId đặt SAU spread -> filter từ ngoài không ghi đè được",
      "",
      "// Index có tenantId đứng đầu",
      "db.orders.createIndex({ tenantId: 1, _id: 1 })",
      "// Lint rule / code review: cấm gọi db.collection('orders') ngoài TenantRepo"
    ]},
    { id: "do", label: "☁️ D1 & Durable Objects", lines: [
      "// Durable Object: mỗi tenant một object, SQLite riêng",
      "export default { async fetch(req, env) {",
      "  const tenantId = await authenticate(req)            // từ token, không từ URL",
      "  const stub = env.TENANT.get(env.TENANT.idFromName(tenantId))",
      "  return stub.fetch(req)",
      "} }",
      "",
      "export class TenantDO extends DurableObject {",
      "  listOrders() {",
      "    return this.ctx.storage.sql.exec('SELECT id, total FROM orders').toArray()",
      "  }  // chỉ có dữ liệu của một tenant trong storage này",
      "}",
      "",
      "// D1 bảng chung: tenant_id luôn là tham số bind từ session",
      "await env.DB.prepare('SELECT * FROM orders WHERE tenant_id = ?1 AND id = ?2')",
      "  .bind(session.tenantId, orderId).first()"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request</div><div class="ns">token đã xác thực: tenant = A</div></div>
    <div class="arrow" id="a1">↓ tenant từ session, không từ URL</div>
    <div class="node" id="layer"><div class="nl">🧱 Lớp cách ly duy nhất</div><div class="ns">RLS · row policy · TenantRepo · Durable Object</div></div>
    <div class="arrow" id="a2">↓ tự thêm điều kiện tenant</div>
    <div class="row">
      <div class="node" id="ta"><div class="nl">🏢 Dữ liệu tenant A</div><div class="ns">được thấy</div></div>
      <div class="node" id="tb"><div class="nl">🏬 Dữ liệu tenant B</div><div class="ns">vô hình · 404</div></div>
    </div>
    <div class="node" id="failclosed"><div class="nl">🔒 Không rõ tenant?</div><div class="ns">fail closed → 0 dòng</div></div>
  `,
  steps: [
    { title: "1 · Lỗi kinh điển: tenant từ client, quên WHERE", tab: "bad", highlight: [2, 3, 6, 7, 8], on: ["req", "tb"],
      desc: "Chỉ cần đổi <code>tenant_id</code> trên URL hoặc đoán ID đơn hàng là thấy dữ liệu công ty khác. Hai lỗi này chiếm phần lớn sự cố rò rỉ chéo tenant." },
    { title: "2 · Tenant từ phiên, lọc ở một chỗ", tab: "bad", highlight: [11, 12], on: ["req", "a1", "layer"],
      desc: "Tenant lấy từ claim server ký. Việc lọc đặt ở một lớp duy nhất, không phụ thuộc trí nhớ của dev ở từng câu truy vấn." },
    { title: "3 · Postgres RLS", tab: "rls", highlight: [4, 5, 7, 8, 9, 12], on: ["layer", "a2", "ta", "tb"],
      desc: "DB tự thêm điều kiện tenant vào mọi truy vấn. <code>FORCE</code> áp cả cho owner; <code>WITH CHECK</code> chặn ghi dữ liệu mang tenant khác; app không có BYPASSRLS." },
    { title: "4 · Đặt tenant trong phạm vi transaction", tab: "rls", highlight: [15, 16, 17, 18], on: ["req", "layer", "failclosed"],
      desc: "<code>set_config(..., true)</code> chỉ sống trong transaction → không rò sang request khác qua connection pool. Chưa đặt → NULL → 0 dòng (fail closed)." },
    { title: "5 · ClickHouse row policy", tab: "ch", highlight: [2, 3, 4, 6, 7, 12], on: ["layer", "ta"],
      desc: "Row policy gắn với role chỉ đọc. Kiểm tra lại bằng truy vấn <code>DISTINCT tenant_id</code> dưới quyền role đó." },
    { title: "6 · Mongo: TenantRepo bắt buộc", tab: "mongo", highlight: [4, 5, 6, 7, 9, 13], on: ["layer"],
      desc: "Không có RLS thì ép ở một lớp code; đặt <code>tenantId</code> sau spread để filter ngoài không ghi đè được, cấm truy cập collection trực tiếp." },
    { title: "7 · Durable Objects: cách ly theo thiết kế", tab: "do", highlight: [3, 4, 10, 15, 16], on: ["layer", "ta", "tb"],
      desc: "Mỗi tenant một object với SQLite riêng — không có câu truy vấn nào 'lỡ' đọc tenant khác. D1 bảng chung thì tenant luôn là tham số bind từ session." }
  ],

  quiz: [
    { q: "Nguồn đúng cho tenant_id của một request là gì?", options: [
        "Query string ?tenant_id=",
        "Claim trong token/session đã xác thực do server cấp",
        "Body JSON",
        "Header X-Tenant do client tự đặt"
      ], correct: 1,
      explanation: "Mọi thứ client gửi đều sửa được. Tenant phải gắn với danh tính đã xác thực." },
    { q: "Trong Postgres, FORCE ROW LEVEL SECURITY để làm gì?", options: [
        "Áp RLS cả cho owner của bảng (mặc định owner được bỏ qua)",
        "Áp RLS cho superuser",
        "Tắt RLS",
        "Tăng tốc truy vấn"
      ], correct: 0,
      explanation: "Superuser và BYPASSRLS vẫn bỏ qua — vì vậy app không được dùng các role đó." },
    { q: "Vì sao dùng set_config('app.tenant_id', $1, true) (tham số true) thay vì SET cho cả phiên?", options: [
        "Vì nhanh hơn",
        "Vì SET không tồn tại",
        "Biến chỉ sống trong transaction, tránh rò tenant của request trước sang request sau qua connection pool",
        "Để RLS bị tắt"
      ], correct: 2,
      explanation: "Kết nối trong pool được dùng lại; biến cấp phiên có thể 'dính' tenant cũ." },
    { q: "WITH CHECK trong CREATE POLICY chặn điều gì?", options: [
        "Đọc dữ liệu tenant khác",
        "Ghi (INSERT/UPDATE) dòng mang tenant_id khác tenant hiện tại",
        "Truy vấn chậm",
        "Đăng nhập sai mật khẩu"
      ], correct: 1,
      explanation: "USING lọc dòng đọc/sửa; WITH CHECK kiểm tra dữ liệu mới được ghi vào." },
    { q: "RLS có thay thế truy vấn có tham số không?", options: [
        "Có, RLS chặn mọi injection",
        "Không liên quan gì nhau và không nên dùng cùng",
        "Có, nếu dùng FORCE",
        "Không — RLS chủ yếu chống lỗi quên WHERE; kẻ chạy được SQL tuỳ ý bằng tài khoản app có thể tự đặt lại biến tenant"
      ], correct: 3,
      explanation: "Phòng thủ nhiều lớp: RLS + truy vấn có tham số + quyền tối thiểu." },
    { q: "MongoDB không có RLS gốc. Cách cách ly tenant hợp lý?", options: [
        "Tin client gửi tenantId trong filter",
        "Tắt authorization",
        "Lớp repository bắt buộc tự gắn tenantId vào mọi filter/insert (không cho ghi đè), hoặc database riêng mỗi tenant + role",
        "Dùng một collection cho mỗi request"
      ], correct: 2,
      explanation: "Đặt việc lọc ở một nơi duy nhất, cấm truy cập collection trực tiếp bằng lint/review." },
    { q: "Durable Objects hỗ trợ cách ly tenant thế nào?", options: [
        "Mỗi tenant một object (idFromName(tenantId)) với storage SQLite riêng — code trong object chỉ thấy dữ liệu tenant đó",
        "Tự thêm RLS vào D1",
        "Mã hoá dữ liệu theo tenant",
        "Không hỗ trợ"
      ], correct: 0,
      explanation: "Đây là mô hình 'silo' chi phí thấp. tenantId phải lấy từ phiên đã xác thực." },
    { q: "'Fail closed' trong bối cảnh multi-tenancy nghĩa là gì?", options: [
        "Khi không xác định được tenant, trả về tất cả dữ liệu để tránh lỗi",
        "Khoá tài khoản người dùng",
        "Đóng DB khi có lỗi",
        "Khi không xác định được tenant, truy vấn trả 0 dòng hoặc lỗi"
      ], correct: 3,
      explanation: "Ví dụ current_setting(..., true) trả NULL → tenant_id = NULL không khớp dòng nào." },
    { q: "Row policy của ClickHouse phù hợp nhất với loại user nào?", options: [
        "User có quyền ALTER và INSERT",
        "User chỉ đọc (readonly), ví dụ công cụ BI theo từng tenant",
        "User default",
        "User quản trị"
      ], correct: 1,
      explanation: "User có quyền ghi/thay đổi cấu trúc có thể lách row policy; kết hợp readonly và grant hẹp." }
  ]
});
