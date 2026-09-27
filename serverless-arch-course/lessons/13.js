window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Dữ liệu: nhất quán & lưu trữ",
  title: "Hyperdrive + PostgreSQL: dùng DB sẵn có từ Worker",
  subtitle: "Vì sao không connect thẳng · pool kiểu transaction · cache query đọc · binding không cache · Tunnel cho DB nội bộ",

  theory: `
    <p>Công ty đã có Postgres (và các service Java/Rust dùng nó). Worker muốn đọc/ghi Postgres đó thì gặp 2 vấn đề mà Spring không có:</p>
    <ol>
      <li><strong>Không có pool sống lâu</strong>: HikariCP giữ 10 kết nối suốt đời JVM. Worker thì mỗi request có thể ở isolate mới → mỗi request phải
      mở TCP + TLS + xác thực Postgres (nhiều round-trip, thường vài trăm ms nếu DB ở xa).</li>
      <li><strong>Bão kết nối</strong>: 5.000 request đồng thời ở 100 thành phố = hàng nghìn kết nối vào Postgres vốn chỉ chịu vài trăm (<code>max_connections</code>).</li>
    </ol>

    <p><strong>Hyperdrive</strong> đứng giữa: Worker nói chuyện giao thức Postgres với Hyperdrive ngay tại PoP gần nó (nhanh), Hyperdrive giữ một <strong>pool kết nối ấm</strong>
    đặt gần database và tái sử dụng chúng. Pool chạy ở chế độ <strong>transaction mode</strong>: mỗi transaction mượn một kết nối, xong trả lại.</p>

    <table>
      <tr><th>Tính năng</th><th>Chi tiết</th></tr>
      <tr><td>Connection pooling</td><td>Giảm setup kết nối, bảo vệ <code>max_connections</code> của DB</td></tr>
      <tr><td>Query caching</td><td>Chỉ cache query đọc. Mặc định <code>max_age</code> 60 s, <code>stale_while_revalidate</code> 15 s; max_age tối đa 1 giờ; có thể tắt</td></tr>
      <tr><td>Kết nối DB riêng tư</td><td>Qua Cloudflare Tunnel, DB không cần mở ra Internet</td></tr>
    </table>

    <p><strong>Hệ quả của transaction mode</strong> (giống PgBouncer transaction pooling): không dựa vào state phiên kéo dài qua nhiều transaction —
    <code>SET</code> cấp session, advisory lock cấp session, <code>LISTEN/NOTIFY</code>, temp table không đáng tin. Prepared statement được Hyperdrive hỗ trợ (postgres.js để <code>prepare: true</code>).</p>

    <p><strong>Cache và nhất quán</strong>: ghi xong rồi đọc lại qua binding có cache có thể thấy dữ liệu cũ tới 60 s. Mẫu khuyến nghị: tạo <strong>hai</strong> cấu hình Hyperdrive —
    một có cache cho trang công khai, một tắt cache cho auth, quyền, và "đọc sau khi ghi".</p>

    <div class="callout"><p>💡 Hyperdrive giải quyết <em>chi phí kết nối</em>, không giải quyết <em>khoảng cách</em>: mỗi query vẫn phải đi tới region của DB.
    Endpoint làm 5 query tuần tự → gom thành 1 query, đưa logic vào một RPC tới service Java/Rust đặt cạnh DB, hoặc bật Smart Placement để chạy Worker gần DB.</p></div>
  `,

  codeTabs: [
    { id: "setup", label: "① Tạo & khai báo", lines: [
      "npx wrangler hyperdrive create orders-pg \\",
      "  --connection-string='postgres://app:secret@db.internal.example.com:5432/orders'",
      "",
      "npx wrangler hyperdrive create orders-pg-nocache --caching-disabled \\",
      "  --connection-string='postgres://app:secret@db.internal.example.com:5432/orders'",
      "",
      "// wrangler.jsonc",
      "\"compatibility_flags\": [\"nodejs_compat\"],",
      "\"hyperdrive\": [",
      "  { \"binding\": \"PG\", \"id\": \"<id-có-cache>\" },",
      "  { \"binding\": \"PG_FRESH\", \"id\": \"<id-không-cache>\" }",
      "]"
    ]},
    { id: "code", label: "② Worker + postgres.js", lines: [
      "import postgres from 'postgres';",
      "",
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    // tạo client MỖI request — Hyperdrive mới là nơi giữ pool",
      "    const sql = postgres(env.PG.connectionString, { max: 5, fetch_types: false });",
      "    const products = await sql`SELECT id, name, price FROM product WHERE active LIMIT 50`;",
      "    ctx.waitUntil(sql.end());",
      "    return Response.json(products);",
      "  }",
      "};"
    ]},
    { id: "fresh", label: "③ Ghi rồi đọc: không cache", lines: [
      "const db = postgres(env.PG_FRESH.connectionString, { max: 5, fetch_types: false });",
      "const [order] = await db.begin(async (tx) => {",
      "  const [o] = await tx`INSERT INTO orders(user_id, total) VALUES (${uid}, ${total}) RETURNING *`;",
      "  await tx`UPDATE product SET stock = stock - ${qty} WHERE id = ${pid} AND stock >= ${qty}`;",
      "  return [o];",
      "});                                       // transaction = một kết nối mượn từ pool",
      "const again = await db`SELECT * FROM orders WHERE id = ${order.id}`;   // thấy ngay"
    ]},
    { id: "java", label: "④ So với Spring", lines: [
      "# application.yml",
      "spring.datasource.hikari.maximum-pool-size: 10     # pool sống cùng JVM",
      "",
      "# Worker không có JVM sống lâu → pool chuyển ra Hyperdrive",
      "# Spring: 20 pod × 10 = 200 kết nối cố định",
      "# Worker + Hyperdrive: hàng nghìn isolate → vẫn ~vài chục kết nối thật tới Postgres"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="w1"><div class="nl">⚙️ Worker SGN</div><div class="ns">postgres(env.PG.connectionString)</div></div>
      <div class="node" id="w2"><div class="nl">⚙️ Worker NRT</div><div class="ns">cùng binding</div></div>
    </div>
    <div class="arrow" id="a1">↓ bắt tay nhanh tại PoP gần</div>
    <div class="node" id="hd"><div class="nl">🚀 Hyperdrive</div><div class="ns">cache SELECT · pool transaction mode</div></div>
    <div class="arrow" id="a2">↓ kết nối ấm, đặt gần DB (qua Tunnel nếu DB nội bộ)</div>
    <div class="node" id="pg"><div class="nl">🐘 PostgreSQL (Frankfurt)</div><div class="ns">max_connections được bảo vệ</div></div>
  `,
  steps: [
    { title: "1 · Hai cấu hình", tab: "setup", highlight: [1, 4, 10, 11], on: ["hd"],
      desc: "Một có cache cho đọc công khai, một tắt cache cho đọc cần mới. nodejs_compat cần cho driver Postgres." },
    { title: "2 · Client mỗi request", tab: "code", highlight: [5, 6], on: ["w1", "w2", "a1"],
      desc: "Không giữ client ở global. max: 5 vì Worker chỉ có 6 kết nối ra ngoài đồng thời; fetch_types: false bớt một round-trip." },
    { title: "3 · Cache query đọc", tab: "code", highlight: [7], on: ["hd"],
      desc: "SELECT giống nhau trong 60 s được trả từ cache, không chạm DB." },
    { title: "4 · Pool gần DB", tab: "java", highlight: [2, 5, 6], on: ["a2", "pg"],
      desc: "Pool rời khỏi ứng dụng, chuyển ra hạ tầng. DB thấy số kết nối ổn định." },
    { title: "5 · Transaction & đọc mới", tab: "fresh", highlight: [1, 2, 3, 4, 7], on: ["pg"],
      desc: "Binding không cache cho luồng ghi và đọc-sau-ghi. Một transaction giữ một kết nối tới khi xong." }
  ],

  quiz: [
    { q: "Vì sao Worker connect thẳng Postgres mỗi request là tệ?", options: [
        "Postgres không hỗ trợ TLS",
        "Mỗi request trả chi phí TCP+TLS+auth nhiều round-trip, và số kết nối có thể vượt max_connections",
        "Worker không có TCP",
        "Vì tốn phí egress"
      ], correct: 1, explanation: "Không có pool sống lâu như HikariCP." },
    { q: "Hyperdrive pool hoạt động ở chế độ nào?", options: [
        "Session mode", "Transaction mode", "Statement mode", "Không pool"
      ], correct: 1, explanation: "Mỗi transaction mượn một kết nối." },
    { q: "Hệ quả của transaction mode?", options: [
        "Không dùng được SELECT",
        "Không dựa vào state cấp phiên kéo dài qua nhiều transaction (SET session, advisory lock phiên, LISTEN/NOTIFY)",
        "Không dùng được transaction",
        "Không có hệ quả"
      ], correct: 1, explanation: "Giống PgBouncer transaction pooling." },
    { q: "Cache mặc định của Hyperdrive?", options: [
        "Tắt",
        "max_age 60 s, stale_while_revalidate 15 s, chỉ cho query đọc",
        "Cache cả INSERT",
        "24 giờ"
      ], correct: 1, explanation: "max_age tối đa 1 giờ." },
    { q: "Vừa INSERT đơn hàng xong, đọc lại để trả cho user. Dùng binding nào?", options: [
        "Binding có cache",
        "Binding tắt cache (hoặc đọc trong cùng transaction)",
        "KV",
        "Không quan trọng"
      ], correct: 1, explanation: "Binding có cache có thể trả kết quả cũ." },
    { q: "Nên tạo client Postgres ở đâu trong Worker?", options: [
        "Global scope để tái sử dụng",
        "Trong handler, mỗi request — Hyperdrive giữ pool thật",
        "Trong Durable Object",
        "Trong cron"
      ], correct: 1, explanation: "Theo hướng dẫn chính thức." },
    { q: "Vì sao đặt max: 5 cho postgres.js?", options: [
        "Postgres giới hạn 5",
        "Worker giới hạn 6 kết nối ra ngoài đồng thời mỗi request",
        "Để tiết kiệm tiền",
        "Không lý do"
      ], correct: 1, explanation: "Vượt sẽ phải xếp hàng." },
    { q: "Hyperdrive có làm query tới DB ở Frankfurt nhanh như DB ở cạnh không?", options: [
        "Có",
        "Không — nó bớt chi phí thiết lập kết nối và cache đọc; mỗi query không cache vẫn phải đi tới region DB",
        "Có nếu bật cache cho INSERT",
        "Chỉ khi dùng D1"
      ], correct: 1, explanation: "Giảm số round-trip hoặc chạy gần DB (Smart Placement)." },
    { q: "DB Postgres nằm trong mạng nội bộ không mở Internet. Hyperdrive kết nối bằng cách nào?", options: [
        "Không thể",
        "Qua Cloudflare Tunnel",
        "Mở port 5432 ra Internet",
        "Qua KV"
      ], correct: 1, explanation: "Tunnel (cloudflared) chạy trong mạng nội bộ." }
  ]
});
