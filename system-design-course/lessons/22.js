window.LESSONS.push({
  id: "22",
  phase: "5", phaseName: "Case study",
  title: "Case study 3: URL shortener trên Cloudflare Workers",
  subtitle: "Đọc gấp 100 lần ghi · sinh mã ngắn · D1 làm nguồn sự thật + KV làm cache edge · 302 vs 301 · click analytics qua Queues",

  theory: `
    <p>Bài toán kinh điển nhưng rất hợp với một service nhỏ trên Workers: logic đơn giản, đọc cực nhiều, cần nhanh ở mọi nơi.</p>

    <p><strong>Yêu cầu</strong>: tạo link ngắn (<code>s.shop.vn/Ab3xY9k</code>) cho chiến dịch marketing, push, SMS; alias tuỳ chọn (<code>s.shop.vn/sale99</code>); hết hạn tuỳ chọn;
    đếm click theo nguồn/quốc gia/thiết bị. Phi chức năng: redirect p99 &lt; 50 ms toàn cầu; link vừa tạo phải dùng được ngay (vì gửi SMS ngay sau khi tạo); link không đoán dò được hàng loạt.</p>

    <p><strong>Con số</strong>: 1 triệu link/tháng tạo mới (~0.4/s), 100 triệu redirect/tháng (~40/s trung bình, đỉnh ~1 000/s khi bắn push). Đọc:ghi ≈ 100:1.
    Mỗi bản ghi ~500 B → 6 GB/năm. Kết luận: dung lượng nhỏ, thách thức là <em>độ trễ đọc toàn cầu</em> và <em>đếm click không làm chậm redirect</em>.</p>

    <p><strong>Sinh mã</strong>: 7 ký tự base62 → 62<sup>7</sup> ≈ 3.5 × 10<sup>12</sup> mã. Hai cách:</p>
    <ul>
      <li><em>Bộ đếm tăng dần → base62</em>: không trùng, nhưng lộ thứ tự và dễ dò tuần tự (đối thủ đếm được số link, cào link của người khác).</li>
      <li><em>Ngẫu nhiên</em> (crypto random) + dựa vào <strong>UNIQUE</strong> của DB để phát hiện trùng hiếm hoi rồi sinh lại: khó đoán. Chọn cách này.</li>
    </ul>

    <p><strong>Lưu trữ trên Cloudflare</strong></p>
    <ul>
      <li><strong>D1</strong> (SQLite serverless) làm nguồn sự thật: ràng buộc UNIQUE cho slug/alias, truy vấn quản trị.</li>
      <li><strong>KV</strong> làm cache đọc ở edge: đọc cực nhanh tại PoP. Nhưng KV <em>eventually consistent</em> — ghi xong, PoP khác có thể chưa thấy (tới ~60 s).
        Vì vậy redirect: đọc KV → <strong>miss thì đọc D1</strong> → ghi lại KV. Link mới tạo vẫn dùng được ngay.</li>
      <li>Với link hết hạn: lưu <code>expires_at</code> và kiểm khi đọc; KV <code>expirationTtl</code> (tối thiểu 60 s) giúp tự dọn cache.</li>
    </ul>

    <p><strong>301 hay 302?</strong> 301 (permanent) được trình duyệt cache → lần sau không qua server → <em>mất số liệu click</em> và không đổi đích được.
    Dùng <strong>302</strong> (hoặc 307) với <code>Cache-Control: private, max-age=0</code> khi cần đếm click.</p>

    <p><strong>Đếm click không làm chậm</strong>: trả redirect ngay, gửi sự kiện click bằng <code>ctx.waitUntil(env.CLICKS.send(...))</code> vào Cloudflare Queues.
    Consumer Queue gom lô rồi đẩy về ingest service → Kafka → ClickHouse (chung đường analytics của công ty), hoặc dùng Workers Analytics Engine nếu chỉ cần số liệu đơn giản.</p>

    <div class="callout"><p>💡 Chống lạm dụng: rate limit API tạo link (bài 12), chỉ cho người đã xác thực tạo, kiểm tra URL đích (chặn domain lừa đảo), không cho redirect tới <code>javascript:</code>.
    Một shortener mở công khai rất nhanh bị dùng làm công cụ phishing.</p></div>
  `,

  codeTabs: [
    { id: "schema", label: "① D1 schema & wrangler", lines: [
      "CREATE TABLE links (",
      "  slug       TEXT PRIMARY KEY,           -- UNIQUE: DB phân xử trùng",
      "  target     TEXT NOT NULL,",
      "  owner      TEXT NOT NULL,",
      "  campaign   TEXT,",
      "  expires_at INTEGER,                    -- epoch giây, NULL = không hết hạn",
      "  created_at INTEGER NOT NULL",
      ");",
      "",
      "# wrangler.toml",
      "[[d1_databases]]",
      "binding = \"DB\"",
      "database_name = \"shortener\"",
      "database_id = \"<id>\"",
      "[[kv_namespaces]]",
      "binding = \"LINKS\"",
      "id = \"<id>\"",
      "[[queues.producers]]",
      "binding = \"CLICKS\"",
      "queue = \"link-clicks\""
    ]},
    { id: "create", label: "② Tạo link", lines: [
      "const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';",
      "function randomSlug(n = 7) {",
      "  const b = crypto.getRandomValues(new Uint8Array(n));",
      "  return Array.from(b, x => ALPHA[x % 62]).join('');   // lệch nhẹ do 256 % 62, chấp nhận được",
      "}",
      "",
      "async function createLink(env, owner, target, alias) {",
      "  if (!target.startsWith('https://')) throw new HttpError(400, 'chỉ nhận https');",
      "  for (let i = 0; i < 3; i++) {",
      "    const slug = alias ?? randomSlug();",
      "    const r = await env.DB.prepare(",
      "      'INSERT INTO links (slug, target, owner, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT DO NOTHING'",
      "    ).bind(slug, target, owner, Math.floor(Date.now() / 1000)).run();",
      "    if (r.meta.changes === 1) return slug;           // thành công",
      "    if (alias) throw new HttpError(409, 'alias đã tồn tại');",
      "  }",
      "  throw new HttpError(500, 'không sinh được slug');",
      "}"
    ]},
    { id: "redirect", label: "③ Redirect", lines: [
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const slug = new URL(req.url).pathname.slice(1);",
      "    let link = await env.LINKS.get(slug, 'json');          // edge cache",
      "    if (!link) {",
      "      link = await env.DB.prepare('SELECT target, expires_at FROM links WHERE slug = ?1')",
      "                         .bind(slug).first();             // nguồn sự thật",
      "      if (!link) return new Response('Not found', { status: 404 });",
      "      ctx.waitUntil(env.LINKS.put(slug, JSON.stringify(link), { expirationTtl: 86400 }));",
      "    }",
      "    if (link.expires_at && link.expires_at * 1000 < Date.now())",
      "      return new Response('Link đã hết hạn', { status: 410 });",
      "    ctx.waitUntil(env.CLICKS.send({ slug, ts: Date.now(),",
      "      country: req.cf?.country, ua: req.headers.get('user-agent') }));",
      "    return new Response(null, { status: 302,",
      "      headers: { Location: link.target, 'Cache-Control': 'private, max-age=0' } });",
      "  }",
      "};"
    ]},
    { id: "queue", label: "④ Consumer click", lines: [
      "export default {",
      "  async queue(batch, env) {                         // lô tới 100 message",
      "    const rows = batch.messages.map(m => m.body);",
      "    const res = await fetch(env.INGEST_URL + '/v1/events/clicks', {",
      "      method: 'POST', body: JSON.stringify(rows),",
      "      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.INGEST_TOKEN },",
      "    });",
      "    if (!res.ok) batch.retryAll();                  // Queues giao lại (at-least-once)",
      "  }",
      "};",
      "// ingest-service (Rust) -> Kafka clicks.v1 -> ClickHouse (bài 15)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="u"><div class="nl">📱 Người bấm link</div><div class="ns">từ SMS / push / mạng xã hội</div></div>
    <div class="arrow" id="a1">↓ PoP gần nhất</div>
    <div class="node" id="w"><div class="nl">☁️ Worker redirect</div><div class="ns">302 · waitUntil</div></div>
    <div class="row">
      <div class="node" id="kv"><div class="nl">KV</div><div class="ns">cache edge, eventual</div></div>
      <div class="node" id="d1"><div class="nl">D1</div><div class="ns">nguồn sự thật · UNIQUE</div></div>
      <div class="node" id="q"><div class="nl">Queues</div><div class="ns">sự kiện click</div></div>
    </div>
    <div class="arrow" id="a2">↓ lô → ingest → Kafka</div>
    <div class="node" id="ch"><div class="nl">📊 ClickHouse</div><div class="ns">click theo chiến dịch/quốc gia</div></div>
  `,
  steps: [
    { title: "1 · Nguồn sự thật có UNIQUE", tab: "schema", highlight: [2, 6, 11, 12, 15, 16, 18, 19], on: ["d1"],
      desc: "D1 cho ràng buộc duy nhất; KV cho đọc nhanh; Queue cho sự kiện click." },
    { title: "2 · Slug ngẫu nhiên, DB phân xử trùng", tab: "create", highlight: [3, 4, 11, 12, 14, 15], on: ["w", "d1"],
      desc: "Không dò tuần tự được; INSERT ON CONFLICT DO NOTHING + kiểm changes; alias trùng → 409." },
    { title: "3 · Đọc KV, miss thì D1", tab: "redirect", highlight: [4, 5, 6, 9], on: ["a1", "kv", "d1"],
      desc: "KV có thể chưa có link vừa tạo ở PoP này; fallback D1 đảm bảo link dùng được ngay." },
    { title: "4 · 302 và không chờ ghi click", tab: "redirect", highlight: [13, 14, 15, 16], on: ["w", "q"],
      desc: "302 + no-cache để lần nào cũng qua Worker đếm được. Gửi Queue trong waitUntil, redirect không chậm." },
    { title: "5 · Gom lô về đường analytics chung", tab: "queue", highlight: [2, 4, 8, 11], on: ["a2", "ch"],
      desc: "Lỗi thì retryAll — ingest phải idempotent hoặc chấp nhận đếm lệch rất nhỏ." }
  ],

  quiz: [
    { q: "Vì sao dùng 302 thay vì 301 cho link có đếm click?", options: [
        "302 nhanh hơn",
        "301 bị trình duyệt cache lâu dài, lần sau không qua server → mất số liệu và không đổi đích được",
        "301 không hỗ trợ HTTPS",
        "Không khác gì"
      ], correct: 1, explanation: "302/307 kèm no-cache." },
    { q: "7 ký tự base62 cho khoảng bao nhiêu mã?", options: [
        "~62 triệu", "~3.5 nghìn tỷ", "~1 tỷ", "~100 nghìn"
      ], correct: 1, explanation: "62^7 ≈ 3.52 × 10^12." },
    { q: "Nhược điểm của slug từ bộ đếm tăng dần?", options: [
        "Trùng nhiều",
        "Dễ đoán/dò tuần tự và lộ số lượng link",
        "Quá dài",
        "Không lưu được"
      ], correct: 1, explanation: "Ngẫu nhiên khó đoán hơn." },
    { q: "Link vừa tạo, gửi SMS ngay; redirect đọc KV ở PoP khác. Rủi ro và cách xử lý?", options: [
        "Không rủi ro",
        "KV eventual consistency có thể chưa có key → miss thì đọc D1 rồi ghi lại KV",
        "Chờ 60 giây mới gửi SMS",
        "Bỏ KV"
      ], correct: 1, explanation: "Nguồn sự thật làm fallback." },
    { q: "Vì sao gửi sự kiện click trong ctx.waitUntil?", options: [
        "Để retry",
        "Trả redirect ngay, việc ghi click chạy tiếp sau khi response đã đi",
        "Bắt buộc với Queues",
        "Để mã hoá"
      ], correct: 1, explanation: "Không cộng độ trễ ghi vào đường đọc nóng." },
    { q: "Tỉ lệ đọc:ghi 100:1 của shortener gợi ý?", options: [
        "Tối ưu đường ghi",
        "Tối ưu đường đọc: cache ở edge gần người dùng",
        "Sharding ghi ngay",
        "Dùng Kafka cho đọc"
      ], correct: 1, explanation: "Đọc toàn cầu cần nhanh." },
    { q: "Alias tuỳ chọn 'sale99' đã có người dùng. API nên?", options: [
        "Ghi đè",
        "Trả 409 Conflict nhờ UNIQUE của DB",
        "Tự thêm số vào cuối và không báo",
        "Trả 500"
      ], correct: 1, explanation: "DB phân xử trùng nguyên tử." },
    { q: "Rủi ro lạm dụng lớn nhất của shortener công khai?", options: [
        "Tốn ổ đĩa",
        "Bị dùng che link lừa đảo/mã độc — cần xác thực người tạo, rate limit, kiểm URL đích",
        "Link quá ngắn",
        "Không có rủi ro"
      ], correct: 1, explanation: "Domain của công ty có thể bị đưa vào danh sách chặn." },
    { q: "Queue consumer gọi ingest thất bại, gọi batch.retryAll(). Hệ quả với số liệu?", options: [
        "Mất click",
        "Có thể giao lại (at-least-once) → ingest nên khử trùng hoặc chấp nhận lệch nhỏ",
        "Queue bị xoá",
        "Không ảnh hưởng gì"
      ], correct: 1, explanation: "Lại là idempotency." }
  ]
});
