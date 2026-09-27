window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Hiệu năng & scale",
  title: "Cache nhiều tầng: client → edge → Redis → DB",
  subtitle: "Cache-Control & ETag · CDN/Workers Cache API/KV · cache-aside Redis · stampede · invalidation",

  theory: `
    <p>Cache là đánh đổi <strong>độ tươi</strong> lấy <strong>độ trễ và tải</strong>. Mỗi tầng gần người dùng hơn thì nhanh hơn nhưng khó xoá hơn.
    Câu hỏi thiết kế đầu tiên luôn là: <em>dữ liệu này được phép cũ bao lâu, và cũ cho ai?</em></p>

    <table>
      <tr><th>Tầng</th><th>Ví dụ</th><th>Độ trễ</th><th>Xoá thế nào</th></tr>
      <tr><td>Client (app)</td><td>HTTP cache của OkHttp/URLSession, DB cục bộ (Room/SQLite)</td><td>0 ms</td><td>Chỉ chờ hết hạn hoặc app tự quyết; bạn không điều khiển được máy người dùng</td></tr>
      <tr><td>Edge/CDN</td><td>Cloudflare cache, Workers Cache API, Workers KV</td><td>~vài–chục ms</td><td>Purge theo URL/tag; KV ghi mới lan toàn cầu mất tới ~60 s</td></tr>
      <tr><td>Service</td><td>Redis dùng chung; cache in-process (moka)</td><td>~0.3–1 ms / ~µs</td><td>DEL khoá; nghe event để xoá</td></tr>
      <tr><td>DB</td><td>Buffer cache của Postgres</td><td>ms</td><td>Tự quản</td></tr>
    </table>

    <p><strong>HTTP caching — nền của client và edge</strong></p>
    <ul>
      <li><code>Cache-Control: public, max-age=60, s-maxage=300</code>: trình duyệt/app giữ 60 s, cache dùng chung (CDN) giữ 300 s.</li>
      <li><code>private</code>: chỉ client được cache (dữ liệu của riêng user, vd đơn hàng) — CDN không được lưu. <code>no-store</code>: không ai lưu (thông tin thanh toán).</li>
      <li><code>ETag</code> + <code>If-None-Match</code> → <code>304 Not Modified</code>: không gửi lại body, tiết kiệm băng thông di động.</li>
      <li><code>stale-while-revalidate</code>: cho phép trả bản cũ trong lúc nạp bản mới ở nền (tuỳ mức hỗ trợ của từng cache).</li>
    </ul>

    <p><strong>Trên Cloudflare Workers</strong>: <code>caches.default</code> (Cache API) lưu response <em>theo từng data center</em>, không đồng bộ toàn cầu.
    <strong>KV</strong> là kho key-value toàn cầu, đọc nhanh ở edge nhưng <em>eventually consistent</em> (ghi mới có thể mất tới ~60 s mới thấy ở nơi khác) — hợp cho cấu hình, feature flag, danh mục ít đổi; không hợp cho tồn kho.</p>

    <p><strong>Cache-aside với Redis</strong> (mẫu phổ biến nhất): đọc cache → miss thì đọc DB → ghi cache kèm TTL. Khi ghi: cập nhật DB rồi <strong>xoá</strong> khoá cache (không ghi đè — ghi đè dễ race đưa bản cũ vào).
    Ba bẫy:</p>
    <ul>
      <li><strong>Stampede</strong>: khoá nóng hết hạn, 1 000 request cùng miss và cùng đập DB. Chống: single-flight (một request nạp, số còn lại chờ), khoá <code>SET lock NX PX</code>, hoặc làm mới sớm ngẫu nhiên.</li>
      <li><strong>TTL đồng loạt</strong>: nạp 100 000 khoá cùng lúc với TTL 3600 → cùng hết hạn. Thêm jitter: TTL = 3600 ± 10%.</li>
      <li><strong>Penetration</strong>: truy vấn khoá không tồn tại liên tục (id rác) luôn miss → cache cả kết quả "không có" với TTL ngắn.</li>
    </ul>

    <div class="callout"><p>💡 Spring <code>@Cacheable</code> che toàn bộ cache-aside; bạn không thấy stampede hay race ghi. Trong Rust bạn tự viết vài chục dòng với <code>redis</code>/<code>fred</code> — và vì thế hiểu rõ.
    Invalidation tốt nhất trong hệ event-driven: service sở hữu phát <code>ProductUpdated</code> qua Kafka, các nơi cache nghe và xoá khoá/purge tag CDN.</p></div>
  `,

  codeTabs: [
    { id: "http", label: "① HTTP headers", lines: [
      "# Danh mục sản phẩm công khai: CDN giữ 5 phút, app giữ 1 phút",
      "Cache-Control: public, max-age=60, s-maxage=300",
      "ETag: \"cat-v8812\"",
      "",
      "# Lần sau app hỏi lại:",
      "GET /v1/categories        If-None-Match: \"cat-v8812\"",
      "HTTP/1.1 304 Not Modified   (không body)",
      "",
      "# Lịch sử đơn của user: chỉ app được cache",
      "Cache-Control: private, max-age=30",
      "",
      "# Thông tin thanh toán: không ai được lưu",
      "Cache-Control: no-store"
    ]},
    { id: "edge", label: "② Worker Cache API", lines: [
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    if (req.method !== 'GET') return fetch(req);",
      "    const cache = caches.default;                 // cache của data center này",
      "    let res = await cache.match(req);",
      "    if (res) return res;                          // HIT ở edge",
      "    res = await fetch(env.ORIGIN + new URL(req.url).pathname);",
      "    res = new Response(res.body, res);            // bản có thể sửa header",
      "    res.headers.set('Cache-Control', 'public, s-maxage=300');",
      "    ctx.waitUntil(cache.put(req, res.clone()));    // ghi cache sau khi đã trả response",
      "    return res;",
      "  }",
      "};"
    ]},
    { id: "aside", label: "③ Cache-aside + single-flight", lines: [
      "async fn get_product(sku: &str, st: &AppState) -> Result<Product> {",
      "    let key = format!(\"product:v1:{sku}\");",
      "    if let Some(p) = st.redis.get_json::<Product>(&key).await? { return Ok(p); }   // HIT",
      "",
      "    // single-flight trong process: 1000 request cùng sku chỉ 1 lần nạp",
      "    st.local.try_get_with(key.clone(), async {        // moka::future::Cache: gộp các lần nạp đồng thời",
      "        let p = repo::find(&st.db, sku).await?.ok_or(NotFound)?;",
      "        let ttl = 3600 + rand::thread_rng().gen_range(0..360);   // jitter chống hết hạn đồng loạt",
      "        st.redis.set_json_ex(&key, &p, ttl).await?;",
      "        Ok(p)",
      "    }).await",
      "}",
      "",
      "// Khi ghi: DB trước, rồi XOÁ khoá (không ghi đè)",
      "repo::update(&db, &p).await?;  redis.del(format!(\"product:v1:{}\", p.sku)).await?;"
    ]},
    { id: "redis", label: "④ Lệnh Redis", lines: [
      "SET product:v1:SKU-1 '{...}' EX 3712          # TTL có jitter",
      "SET lock:product:SKU-1 <token> NX PX 3000      # khoá nạp lại phân tán, tự hết hạn",
      "SET product:v1:SKU-404 '__none__' EX 60        # cache kết quả rỗng (chống penetration)",
      "DEL product:v1:SKU-1                           # invalidation khi nhận ProductUpdated",
      "",
      "# Đổi định dạng value? tăng version trong khoá: product:v2:* — bản cũ tự hết hạn"
    ]},
    { id: "inval", label: "⑤ Invalidation bằng event", lines: [
      "catalog-service  --ProductUpdated(sku=SKU-1)-->  Kafka catalog.product.v1",
      "",
      "cache-invalidator (consumer group riêng):",
      "  1. DEL product:v1:SKU-1                         (Redis)",
      "  2. purge Cloudflare theo cache tag 'sku-SKU-1'  (edge)",
      "",
      "app mobile: không xoá được từ xa -> giữ max-age ngắn cho dữ liệu hay đổi,",
      "           dùng ETag để kiểm tra lại rẻ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cl"><div class="nl">📱 Client cache</div><div class="ns">max-age · ETag/304 · Room/SQLite</div></div>
    <div class="arrow" id="a1">↓ miss</div>
    <div class="node" id="edge"><div class="nl">☁️ Edge</div><div class="ns">CDN · Cache API (theo DC) · KV (toàn cầu, ~60 s)</div></div>
    <div class="arrow" id="a2">↓ miss</div>
    <div class="node" id="rd"><div class="nl">🟥 Redis</div><div class="ns">cache-aside · TTL + jitter</div></div>
    <div class="arrow" id="a3">↓ miss (single-flight)</div>
    <div class="node" id="db"><div class="nl">🐘 DB</div><div class="ns">nguồn sự thật</div></div>
  `,
  steps: [
    { title: "1 · Chọn quyền cache theo dữ liệu", tab: "http", highlight: [2, 10, 13], on: ["cl", "edge"],
      desc: "public cho dữ liệu chung, private cho dữ liệu của một user, no-store cho dữ liệu nhạy cảm." },
    { title: "2 · 304 tiết kiệm băng thông di động", tab: "http", highlight: [3, 6, 7], on: ["cl"],
      desc: "App gửi ETag cũ; không đổi thì server trả 304 không body." },
    { title: "3 · Cache ở edge bằng Worker", tab: "edge", highlight: [4, 5, 6, 9, 10], on: ["a1", "edge"],
      desc: "Cache API lưu theo từng data center. waitUntil để ghi cache không làm chậm response." },
    { title: "4 · Cache-aside ở service", tab: "aside", highlight: [3, 6, 7, 8, 9], on: ["a2", "rd"],
      desc: "Miss → một request nạp DB (single-flight), TTL có jitter." },
    { title: "5 · Ghi: DB rồi xoá khoá", tab: "aside", highlight: [14, 15], on: ["a3", "db"],
      desc: "Xoá thay vì ghi đè để tránh race đưa bản cũ vào cache." },
    { title: "6 · Chống stampede & penetration", tab: "redis", highlight: [2, 3], on: ["rd"],
      desc: "Khoá NX PX cho nạp lại phân tán; cache giá trị rỗng TTL ngắn cho id không tồn tại." },
    { title: "7 · Xoá mọi tầng bằng event", tab: "inval", highlight: [1, 4, 5, 7], on: ["rd", "edge", "cl"],
      desc: "Redis và CDN xoá được chủ động; client thì không — nên TTL client phải ngắn cho dữ liệu hay đổi." }
  ],

  quiz: [
    { q: "Lịch sử đơn của một user nên dùng Cache-Control nào?", options: [
        "public, s-maxage=3600", "private, max-age ngắn", "public, immutable", "Không cần header"
      ], correct: 1, explanation: "public để CDN lưu có thể trả dữ liệu của user A cho user B." },
    { q: "Response 304 Not Modified có tác dụng gì?", options: [
        "Báo lỗi",
        "Xác nhận bản cache của client vẫn đúng, không gửi lại body",
        "Chuyển hướng",
        "Xoá cache"
      ], correct: 1, explanation: "Dựa trên ETag/If-None-Match." },
    { q: "Workers KV phù hợp nhất để lưu gì?", options: [
        "Số tồn kho thay đổi từng giây",
        "Cấu hình, feature flag, dữ liệu ít đổi đọc nhiều ở edge",
        "Số dư ví",
        "Khoá phân tán"
      ], correct: 1, explanation: "KV eventually consistent, ghi mới có thể mất tới ~60 s để lan." },
    { q: "caches.default trong Worker có phạm vi?", options: [
        "Toàn cầu, đồng bộ tức thì",
        "Từng data center của Cloudflare",
        "Chỉ trong một request",
        "Trong trình duyệt"
      ], correct: 1, explanation: "Mỗi PoP có cache riêng." },
    { q: "Khi cập nhật dữ liệu trong cache-aside, nên làm gì với cache?", options: [
        "Ghi đè giá trị mới vào cache trước khi ghi DB",
        "Ghi DB rồi xoá khoá cache",
        "Không làm gì, chờ TTL",
        "Xoá toàn bộ Redis"
      ], correct: 1, explanation: "Xoá tránh race đưa giá trị cũ vào và lần đọc sau sẽ nạp giá trị mới." },
    { q: "Cache stampede là gì?", options: [
        "Cache quá lớn",
        "Khoá nóng hết hạn, nhiều request cùng miss và cùng đập DB",
        "Redis chết",
        "Client cache quá lâu"
      ], correct: 1, explanation: "Chống bằng single-flight, lock, làm mới sớm." },
    { q: "Vì sao thêm jitter vào TTL?", options: [
        "Tiết kiệm RAM",
        "Tránh nhiều khoá nạp cùng lúc rồi hết hạn cùng lúc",
        "Redis bắt buộc",
        "Tăng bảo mật"
      ], correct: 1, explanation: "Trải đều thời điểm nạp lại." },
    { q: "Truy vấn liên tục các id không tồn tại (cache penetration). Cách giảm?", options: [
        "Tăng TTL",
        "Cache cả kết quả 'không có' với TTL ngắn, hoặc Bloom filter",
        "Tắt cache",
        "Tăng số DB"
      ], correct: 1, explanation: "Để request rác không chạm DB." },
    { q: "Tầng cache nào bạn KHÔNG thể xoá chủ động?", options: [
        "Redis", "CDN", "Cache trên máy người dùng", "Cache in-process"
      ], correct: 2, explanation: "Chỉ điều khiển bằng TTL/ETag ngay từ đầu." },
    { q: "Đổi định dạng JSON lưu trong cache. Cách an toàn?", options: [
        "FLUSHALL Redis",
        "Đổi version trong tên khoá (product:v2:...), bản cũ tự hết hạn",
        "Sửa từng khoá tay",
        "Không cần làm gì"
      ], correct: 1, explanation: "Code cũ và mới cùng chạy trong lúc deploy mà không đọc nhầm định dạng." }
  ]
});
