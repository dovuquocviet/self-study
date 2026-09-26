window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "Cloudflare D1, KV, R2, Durable Objects & Hyperdrive",
  subtitle: "Binding thay password · API token phạm vi hẹp · tách môi trường · R2 public bucket vs presigned URL · D1 prepare().bind() · cách ly tenant bằng Durable Objects · Hyperdrive + RLS",

  theory: `
    <p>Các dịch vụ dữ liệu của Cloudflare không có cổng mạng để mở hay mật khẩu để đặt. Điều đó loại bỏ cả loạt lỗi ở bài 03–05, nhưng bề mặt tấn công chuyển sang chỗ khác:
    <strong>code Worker</strong>, <strong>binding</strong>, <strong>API token</strong>, <strong>chế độ public của R2</strong> và <strong>cấu hình môi trường</strong>. Bài này đi qua từng dịch vụ.</p>

    <p><strong>1. Binding là quyền</strong></p>
    <ul>
      <li>Worker có binding <code>DB</code> tới D1 <em>có toàn quyền</em> trên database đó (đọc, ghi, xoá bảng). Không có binding "chỉ đọc". Tương tự với KV namespace, R2 bucket.</li>
      <li>Vì vậy: Worker chỉ khai báo binding thật sự cần; tách dữ liệu có mức nhạy cảm khác nhau ra database/namespace/bucket khác nhau; tác vụ quản trị đặt trong Worker riêng
        được bảo vệ bằng Cloudflare Access, gọi từ Worker public qua <em>service binding</em> với API hẹp (bài 07).</li>
      <li><strong>Tách môi trường</strong>: <code>[env.staging]</code> và <code>[env.production]</code> dùng <code>database_id</code>/<code>id</code>/<code>bucket_name</code> khác nhau. Lỗi phổ biến:
        môi trường staging vô tình trỏ vào D1 production vì copy cấu hình.</li>
    </ul>

    <p><strong>2. API token — "mật khẩu" của tài khoản</strong></p>
    <ul>
      <li>Không dùng Global API Key. Tạo API token với đúng permission (ví dụ <em>D1: Edit</em>, <em>Workers R2 Storage: Edit</em>, <em>Workers Scripts: Edit</em>), giới hạn account/zone, lọc IP, đặt TTL.</li>
      <li>Token deploy Worker = gián tiếp có mọi binding của Worker đó. Lưu trong secret của CI, không trong repo; mỗi pipeline một token.</li>
      <li>R2 qua S3 API dùng Access Key/Secret sinh từ R2 API token: chọn "Object Read only" khi chỉ cần đọc, và <em>chỉ định bucket</em> thay vì "tất cả bucket".</li>
      <li>Secret ứng dụng: <code>wrangler secret put</code> hoặc Secrets Store — không đặt trong <code>[vars]</code>.</li>
    </ul>

    <p><strong>3. R2: public bucket vs presigned URL vs Worker proxy</strong></p>
    <table>
      <tr><th>Cách</th><th>Ai đọc được</th><th>Dùng khi</th></tr>
      <tr><td>Public bucket (r2.dev hoặc custom domain)</td><td><strong>Bất kỳ ai</strong> có URL — mọi object trong bucket</td><td>Tài nguyên thật sự công khai: ảnh sản phẩm, file tĩnh. Không bao giờ cho file người dùng/hoá đơn/export. <code>r2.dev</code> chỉ nên dùng cho dev.</td></tr>
      <tr><td>Presigned URL (S3 API)</td><td>Ai có URL, trong thời hạn, đúng method + key đã ký</td><td>Cho người dùng tải lên/tải xuống trực tiếp một object cụ thể sau khi server đã kiểm tra quyền. Thời hạn ngắn (vài phút).</td></tr>
      <tr><td>Worker proxy qua binding</td><td>Chỉ người Worker cho phép</td><td>Cần kiểm tra quyền mỗi lần tải, ghi log truy cập, header tuỳ chỉnh.</td></tr>
    </table>
    <p>Thêm: CORS của bucket chỉ cho origin/method cần thiết; key object ngẫu nhiên dưới prefix tenant (bài 11); lifecycle rule cho file tạm (bài 15).</p>

    <p><strong>4. D1 — SQLite, vẫn cần truy vấn có tham số</strong></p>
    <ul>
      <li>Luôn <code>prepare(sql).bind(...)</code>. <code>db.exec()</code> chạy SQL thô không có tham số — chỉ dùng cho câu lệnh cố định (thường là trong migration), không bao giờ với input.</li>
      <li>Nhiều câu cần nguyên tử → <code>db.batch([...])</code> (chạy như một transaction).</li>
      <li>Không có user/role trong D1 → phân quyền nằm trong code Worker: tenant từ session, lớp repository bắt buộc <code>tenant_id</code> (bài 08).</li>
      <li>Migration qua <code>wrangler d1 migrations apply --remote</code> từ CI bằng token riêng; D1 Time Travel cho phép khôi phục về thời điểm trước (bài 20).</li>
    </ul>

    <p><strong>5. Durable Objects — cách ly bằng thiết kế</strong></p>
    <ul>
      <li>Mỗi tenant/tài liệu/phòng chat là một object với storage (SQLite) riêng: <code>idFromName(tenantId)</code>. Dữ liệu tenant khác không nằm cùng chỗ để mà lộ.</li>
      <li>Tên/ID object phải đến từ danh tính đã xác thực hoặc đã được kiểm tra quyền. Nếu client gửi ID object (<code>idFromString</code>), Worker phải kiểm tra người dùng có quyền với object đó.</li>
      <li>SQL trong object: <code>this.ctx.storage.sql.exec(sql, ...bindings)</code> — vẫn là tham số.</li>
      <li>Hợp cho trạng thái cần nhất quán mạnh: bộ đếm rate limit, khoá tài khoản, session thu hồi ngay (bài 16).</li>
    </ul>

    <p><strong>6. Hyperdrive — Postgres/MySQL từ Worker</strong></p>
    <ul>
      <li>Mật khẩu DB gốc nằm trong cấu hình Hyperdrive; Worker nhận <code>env.HYPERDRIVE.connectionString</code> — không log chuỗi này.</li>
      <li>Role Postgres cho Hyperdrive là role app quyền tối thiểu (bài 07), không phải superuser. Kết nối tới DB gốc bằng TLS <code>verify-full</code> (bài 04); DB gốc nên ở mạng riêng qua Tunnel (bài 03).</li>
      <li>Hyperdrive gom kết nối và có thể <strong>cache kết quả truy vấn đọc</strong>. Nếu phân quyền dựa vào biến phiên (RLS với <code>set_config</code>), hai tenant chạy cùng câu SELECT
        cùng tham số có thể nhận nhầm kết quả cache. Cách an toàn: đưa <code>tenant_id</code> vào truy vấn như tham số tường minh, và/hoặc tắt caching cho Hyperdrive phục vụ dữ liệu theo tenant;
        đặt biến tenant bằng <code>set_config(..., true)</code> trong cùng transaction với truy vấn.</li>
    </ul>

    <div class="callout"><p>💡 Checklist nhanh cho một tài khoản Cloudflare: bucket R2 nào đang public? token nào không có hạn/không lọc IP/quyền cả account? Worker public nào có binding tới dữ liệu nhạy cảm?
    staging có trỏ nhầm resource production không? Hyperdrive nào bật cache trên dữ liệu theo tenant?</p></div>
  `,

  codeTabs: [
    { id: "wrangler", label: "⚙️ wrangler.toml", lines: [
      "name = \"shop-api\"",
      "main = \"src/index.ts\"",
      "",
      "[env.production]",
      "d1_databases = [ { binding = \"DB\", database_name = \"shop-prod\", database_id = \"<uuid-prod>\" } ]",
      "kv_namespaces = [ { binding = \"SESSIONS\", id = \"<id-prod>\" } ]",
      "r2_buckets    = [ { binding = \"UPLOADS\", bucket_name = \"uploads-prod\" } ]",
      "hyperdrive    = [ { binding = \"PG\", id = \"<hyperdrive-prod>\" } ]",
      "services      = [ { binding = \"ADMIN_API\", service = \"shop-admin-internal\" } ]",
      "",
      "[env.staging]                       # resource RIÊNG, không dùng lại id của prod",
      "d1_databases = [ { binding = \"DB\", database_name = \"shop-staging\", database_id = \"<uuid-staging>\" } ]",
      "",
      "# Secret: không đặt trong [vars]",
      "# wrangler secret put PII_KEY --env production"
    ]},
    { id: "r2", label: "🪣 R2 presigned", lines: [
      "// Server kiểm tra quyền rồi mới ký URL ngắn hạn cho đúng một object",
      "import { AwsClient } from 'aws4fetch'",
      "const r2 = new AwsClient({ accessKeyId: env.R2_KEY_ID, secretAccessKey: env.R2_SECRET })  // token chỉ bucket này",
      "",
      "async function downloadUrl(session, fileId) {",
      "  const f = await env.DB.prepare('SELECT r2_key FROM files WHERE id = ?1 AND tenant_id = ?2')",
      "    .bind(fileId, session.tenantId).first()",
      "  if (!f) throw notFound()",
      "  const url = new URL('https://' + env.ACCOUNT_ID + '.r2.cloudflarestorage.com/invoices/' + f.r2_key)",
      "  url.searchParams.set('X-Amz-Expires', '300')                   // 5 phút",
      "  const signed = await r2.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } })",
      "  return signed.url",
      "}",
      "",
      "# Bucket 'invoices': KHÔNG bật public access / r2.dev"
    ]},
    { id: "d1", label: "🗃️ D1", lines: [
      "// ✅ prepare + bind",
      "const row = await env.DB.prepare('SELECT id, total FROM orders WHERE tenant_id = ?1 AND id = ?2')",
      "  .bind(session.tenantId, orderId).first()",
      "",
      "// ✅ Nhiều câu nguyên tử",
      "await env.DB.batch([",
      "  env.DB.prepare('UPDATE accounts SET balance = balance - ?1 WHERE id = ?2 AND tenant_id = ?3').bind(amt, from, t),",
      "  env.DB.prepare('UPDATE accounts SET balance = balance + ?1 WHERE id = ?2 AND tenant_id = ?3').bind(amt, to, t)",
      "])",
      "",
      "// ❌ exec() với input: SQL thô, không tham số",
      "await env.DB.exec('DELETE FROM carts WHERE user_id = ' + userId)",
      "",
      "# Migration từ CI với token riêng",
      "wrangler d1 migrations apply shop-prod --remote --env production"
    ]},
    { id: "do", label: "🧱 Durable Objects", lines: [
      "export default { async fetch(req, env) {",
      "  const session = await requireSession(req, env)",
      "  // ✅ tên object từ danh tính đã xác thực",
      "  const stub = env.TENANT.get(env.TENANT.idFromName(session.tenantId))",
      "  return stub.fetch(req)",
      "",
      "  // ❌ ID object do client gửi mà không kiểm tra quyền",
      "  // const stub = env.DOC.get(env.DOC.idFromString(new URL(req.url).searchParams.get('doc')))",
      "} }",
      "",
      "export class TenantDO extends DurableObject {",
      "  addNote(id, body) {",
      "    this.ctx.storage.sql.exec('INSERT INTO notes (id, body) VALUES (?, ?)', id, body)",
      "  }",
      "}"
    ]},
    { id: "hd", label: "🐘 Hyperdrive", lines: [
      "# Role Postgres quyền tối thiểu + TLS verify-full tới DB gốc",
      "wrangler hyperdrive create shop-pg \\",
      "  --connection-string='postgres://app_orders:<secret>@db.internal:5432/shop' \\",
      "  --ca-certificate-id <ca-id> --sslmode verify-full",
      "",
      "# Dữ liệu theo tenant: tắt cache kết quả truy vấn",
      "wrangler hyperdrive update <hyperdrive-id> --caching-disabled true",
      "",
      "// Worker (driver 'pg'): tenant là tham số tường minh + set_config trong cùng transaction",
      "const client = new Client({ connectionString: env.PG.connectionString })",
      "await client.connect()",
      "await client.query('BEGIN')",
      "await client.query(\"SELECT set_config('app.tenant_id', $1, true)\", [session.tenantId])",
      "const { rows } = await client.query('SELECT id, total FROM orders WHERE tenant_id = $1 AND id = $2', [session.tenantId, id])",
      "await client.query('COMMIT')"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="user"><div class="nl">👤 Người dùng</div><div class="ns">session đã xác thực</div></div>
      <div class="node" id="ci"><div class="nl">🤖 CI / công cụ</div><div class="ns">API token phạm vi hẹp</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="worker"><div class="nl">⚙️ Worker</div><div class="ns">chỉ binding cần thiết · env tách riêng</div></div>
    <div class="arrow" id="a2">↓ binding = quyền</div>
    <div class="row">
      <div class="node" id="d1n"><div class="nl">🗃️ D1</div><div class="ns">prepare().bind()</div></div>
      <div class="node" id="r2n"><div class="nl">🪣 R2</div><div class="ns">private + presigned</div></div>
      <div class="node" id="don"><div class="nl">🧱 Durable Object</div><div class="ns">mỗi tenant một object</div></div>
      <div class="node" id="hdn"><div class="nl">🐘 Hyperdrive</div><div class="ns">role hẹp · TLS · cache?</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Binding là quyền, môi trường tách riêng", tab: "wrangler", highlight: [5, 6, 7, 8, 9, 11, 12], on: ["worker", "a2"],
      desc: "Binding cho toàn quyền trên resource. Chỉ khai báo cái cần; staging dùng id riêng; tác vụ admin qua service binding tới Worker nội bộ." },
    { title: "2 · Secret và API token", tab: "wrangler", highlight: [14, 15], on: ["ci", "a1"],
      desc: "Secret qua <code>wrangler secret put</code>; token CI chỉ có permission cần, giới hạn account/IP, có hạn. Không dùng Global API Key." },
    { title: "3 · R2: private + presigned URL ngắn hạn", tab: "r2", highlight: [3, 6, 7, 8, 10, 11, 15], on: ["user", "r2n"],
      desc: "Kiểm tra quyền trong D1 trước, rồi ký URL 5 phút cho đúng object. Bucket chứa hoá đơn không bao giờ bật public/r2.dev." },
    { title: "4 · D1: bind, batch, không exec với input", tab: "d1", highlight: [2, 3, 6, 7, 8, 12, 15], on: ["d1n"],
      desc: "<code>prepare().bind()</code> cho mọi input; <code>batch()</code> cho thao tác nguyên tử; <code>exec()</code> chỉ cho SQL cố định. Migration từ CI." },
    { title: "5 · Durable Objects theo tenant", tab: "do", highlight: [2, 4, 8, 13], on: ["don", "user"],
      desc: "Tên object từ session → mỗi tenant một storage riêng. ID object do client gửi phải được kiểm tra quyền." },
    { title: "6 · Hyperdrive: role hẹp, TLS, cẩn thận với cache", tab: "hd", highlight: [3, 4, 7, 13, 14], on: ["hdn"],
      desc: "Role app, <code>verify-full</code>. Với dữ liệu theo tenant: tắt cache hoặc đảm bảo tenant là tham số tường minh; <code>set_config</code> trong cùng transaction." }
  ],

  quiz: [
    { q: "Worker có binding tới một D1 database. Quyền của nó trên database đó là gì?", options: [
        "Chỉ đọc",
        "Toàn quyền (đọc, ghi, thay đổi cấu trúc) — không có binding chỉ đọc",
        "Chỉ ghi",
        "Tuỳ mật khẩu"
      ], correct: 1,
      explanation: "Least privilege đạt bằng cách tách resource và chỉ khai báo binding cần thiết." },
    { q: "Hoá đơn PDF của khách hàng nên được phục vụ từ R2 thế nào?", options: [
        "Bật public bucket để tải nhanh",
        "Đặt tên file khó đoán trong bucket public",
        "Dùng r2.dev",
        "Bucket private; server kiểm tra quyền rồi cấp presigned URL ngắn hạn (hoặc Worker proxy qua binding)"
      ], correct: 3,
      explanation: "Public bucket = ai có URL cũng đọc; tên khó đoán không phải kiểm soát truy cập." },
    { q: "Vì sao không dùng env.DB.exec() với input người dùng?", options: [
        "Vì exec() chậm",
        "Vì exec() chỉ chạy trên local",
        "exec() chạy SQL thô không có tham số — ghép input vào là injection",
        "Vì exec() không trả kết quả"
      ], correct: 2,
      explanation: "Dùng prepare().bind(); exec() chỉ cho SQL cố định." },
    { q: "Lỗi cấu hình môi trường phổ biến trên Cloudflare là gì?", options: [
        "Staging dùng lại database_id/bucket của production vì copy cấu hình",
        "Dùng quá nhiều Worker",
        "Đặt tên binding viết hoa",
        "Dùng TypeScript"
      ], correct: 0,
      explanation: "Mỗi [env.*] phải trỏ tới resource riêng." },
    { q: "Hyperdrive bật cache, RLS dựa vào set_config('app.tenant_id'). Rủi ro nào có thể xảy ra?", options: [
        "Không có rủi ro",
        "Mật khẩu bị lộ",
        "Hyperdrive tắt RLS",
        "Hai tenant chạy cùng câu SELECT cùng tham số có thể nhận kết quả cache của nhau"
      ], correct: 3,
      explanation: "Đưa tenant_id thành tham số tường minh và/hoặc tắt caching cho dữ liệu theo tenant." },
    { q: "Durable Object nên được chọn theo cách nào để cách ly tenant?", options: [
        "idFromString với ID client gửi, không kiểm tra",
        "idFromName(tenantId) với tenantId từ session đã xác thực",
        "Random mỗi request",
        "Một object dùng chung cho mọi tenant"
      ], correct: 1,
      explanation: "Tên object quyết định dữ liệu nào được chạm tới — phải đến từ danh tính đã xác thực." },
    { q: "API token cho job CI deploy Worker nên thế nào?", options: [
        "Token chỉ có permission cần thiết, giới hạn account, lọc IP runner, có thời hạn, lưu trong secret CI",
        "Global API Key",
        "Token của admin cá nhân",
        "Token không hết hạn để tránh lỗi"
      ], correct: 0,
      explanation: "Token deploy gián tiếp có mọi binding của Worker." },
    { q: "Presigned URL của R2 nên có đặc điểm gì?", options: [
        "Không hết hạn",
        "Ký cho cả bucket",
        "Thời hạn ngắn, ký cho đúng method + key, chỉ cấp sau khi server kiểm tra quyền",
        "Gửi qua email công khai"
      ], correct: 2,
      explanation: "Ai có URL trong thời hạn đều dùng được — nên thời hạn và phạm vi phải hẹp." },
    { q: "Nên đặt secret như khoá mã hoá dữ liệu cho Worker ở đâu?", options: [
        "[vars] trong wrangler.toml",
        "wrangler secret put hoặc Secrets Store",
        "Trong KV cùng dữ liệu",
        "Trong code"
      ], correct: 1,
      explanation: "[vars] là plaintext trong repo." }
  ]
});
