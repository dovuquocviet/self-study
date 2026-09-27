window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Bindings: lưu trữ & kết nối",
  title: "Hyperdrive — Worker nói chuyện với PostgreSQL có sẵn của công ty",
  subtitle: "vì sao kết nối DB từ serverless đắt · pool đặt gần DB · cache truy vấn đọc · pg driver · localConnectionString · DB khác thì sao",

  theory: `
    <p>Với Spring Boot, HikariCP mở sẵn 10–20 kết nối Postgres lúc khởi động và tái dùng mãi. Worker thì không có "lúc khởi động" lâu dài và có thể có
    hàng nghìn isolate ở hàng trăm data center. Nếu mỗi request tự mở kết nối Postgres mới:</p>
    <ul>
      <li>Mỗi kết nối mới tốn nhiều lượt khứ hồi: TCP handshake, TLS handshake, xác thực SCRAM, rồi mới tới truy vấn. Từ edge xa tới DB, riêng phần này có thể vài trăm ms.</li>
      <li>Postgres mỗi kết nối là một process; vài nghìn kết nối đồng thời làm DB quá tải (<code>max_connections</code>).</li>
    </ul>

    <p><strong>Hyperdrive</strong> là dịch vụ đứng giữa:</p>
    <ol>
      <li>Duy trì <strong>connection pool</strong> đặt gần DB của bạn — giống PgBouncer do Cloudflare vận hành.</li>
      <li>Worker kết nối tới Hyperdrive qua mạng nội bộ Cloudflare (nhanh, gần), Hyperdrive tái dùng kết nối sẵn có tới DB.</li>
      <li><strong>Cache kết quả truy vấn đọc</strong> (mặc định tối đa 60 giây) — tắt được nếu cần dữ liệu luôn mới. Truy vấn ghi và truy vấn trong transaction không cache.</li>
    </ol>
    <p>Hỗ trợ PostgreSQL (và MySQL). Driver: dùng driver Node phổ biến như <code>pg</code> hoặc <code>postgres</code> (postgres.js) — cần <code>nodejs_compat</code>
    (mặc định bật với compatibility_date từ 2026-08-04). DB nằm trong mạng riêng thì nối qua Cloudflare Tunnel.</p>

    <p><strong>Quy tắc code</strong>: tạo client <strong>mới trong mỗi request</strong> từ <code>env.HYPERDRIVE.connectionString</code> — rẻ vì pool thật nằm ở Hyperdrive.
    Đừng giữ client trong biến global (bài 17: không dùng lại I/O object giữa các request).</p>

    <p><strong>Các DB khác của công ty truy cập thế nào từ Worker?</strong></p>
    <table>
      <tr><th>DB</th><th>Cách</th></tr>
      <tr><td>PostgreSQL</td><td>Hyperdrive (khuyên dùng)</td></tr>
      <tr><td>ClickHouse</td><td>HTTP interface (<code>fetch</code> tới cổng HTTP/HTTPS của ClickHouse) — nhưng ClickHouse đang consume Kafka, Worker thường chỉ đọc báo cáo</td></tr>
      <tr><td>Elasticsearch</td><td>REST API qua <code>fetch</code></td></tr>
      <tr><td>Redis</td><td>Dịch vụ Redis qua HTTP, hoặc client hỗ trợ TCP socket của Workers (<code>connect()</code>) — kiểm tra driver trước khi chọn</td></tr>
      <tr><td>MongoDB, Kafka</td><td>Driver dựa vào kết nối dài/giao thức riêng; thường an toàn hơn là gọi một service Rust nội bộ (qua HTTP) làm cầu nối</td></tr>
    </table>

    <div class="callout"><p>💡 Hyperdrive giảm chi phí <em>kết nối</em>, không giảm độ trễ <em>mỗi truy vấn</em> đi xa. Worker ở Frankfurt, DB ở Singapore: vẫn nên gộp truy vấn
    và cân nhắc Smart Placement (bài 03).</p></div>
  `,

  codeTabs: [
    { id: "cli", label: "Tạo cấu hình", lines: [
      "npx wrangler hyperdrive create shop-pg \\",
      "  --connection-string=\"postgres://app_user:<PASSWORD>@db.internal.shop.vn:5432/shop\"",
      "# -> in ra id",
      "",
      "// wrangler.jsonc",
      "\"compatibility_flags\": [\"nodejs_compat\"],       // cần nếu compatibility_date < 2026-08-04",
      "\"hyperdrive\": [",
      "  {",
      "    \"binding\": \"HYPERDRIVE\",",
      "    \"id\": \"<HYPERDRIVE_ID>\",",
      "    \"localConnectionString\": \"postgres://dev:dev@localhost:5432/shop\"   // cho wrangler dev",
      "  }",
      "]"
    ]},
    { id: "code", label: "Worker + pg", lines: [
      "import { Client } from 'pg';",
      "",
      "export default {",
      "  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {",
      "    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });",
      "    await client.connect();                 // nhanh: tới Hyperdrive, không tới thẳng DB",
      "    try {",
      "      const { rows } = await client.query(",
      "        'SELECT id, name, price FROM products WHERE category = $1 LIMIT 20', ['phone']",
      "      );",
      "      return Response.json(rows);",
      "    } finally {",
      "      ctx.waitUntil(client.end());          // đóng sau khi trả response",
      "    }",
      "  },",
      "} satisfies ExportedHandler<Env>;"
    ]},
    { id: "flow", label: "Không có vs có Hyperdrive", lines: [
      "# Không Hyperdrive: mỗi request, Worker ở HKG -> Postgres ở SIN",
      "TCP handshake        1 RTT",
      "TLS handshake        1–2 RTT",
      "Xác thực SCRAM       ~2 RTT",
      "Truy vấn             1 RTT",
      "=> ~5–6 RTT x 35 ms  ~ 200 ms, và mỗi request một kết nối mới trên DB",
      "",
      "# Có Hyperdrive: Worker -> Hyperdrive (mạng Cloudflare) -> kết nối đã mở sẵn trong pool",
      "=> chủ yếu còn lượt truy vấn; SELECT lặp lại có thể trúng cache"
    ]},
    { id: "java", label: "Spring ↔ Workers", lines: [
      "spring.datasource.url=jdbc:postgresql://...   <->  wrangler hyperdrive create --connection-string",
      "HikariCP pool trong JVM                       <->  Pool trong Hyperdrive, gần DB",
      "@Autowired JdbcTemplate (singleton)           <->  new Client(...) mỗi request",
      "@Cacheable trên query đọc                     <->  Hyperdrive query cache (mặc định <= 60 s)",
      "PgBouncer tự vận hành                          <->  Hyperdrive do Cloudflare vận hành"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="w1"><div class="nl">⚡ Worker @ HKG</div><div class="ns">new Client() mỗi request</div></div>
      <div class="node" id="w2"><div class="nl">⚡ Worker @ SIN</div><div class="ns">new Client() mỗi request</div></div>
    </div>
    <div class="arrow" id="a1">↓ mạng Cloudflare</div>
    <div class="node" id="hd"><div class="nl">🚀 Hyperdrive</div><div class="ns">pool gần DB · cache truy vấn đọc</div></div>
    <div class="arrow" id="a2">↓ ít kết nối, tái dùng</div>
    <div class="node" id="pg"><div class="nl">🐘 PostgreSQL của công ty</div><div class="ns">qua Internet hoặc Tunnel</div></div>
  `,
  steps: [
    { title: "1 · Vấn đề: kết nối mới rất đắt", tab: "flow", highlight: [1, 2, 3, 4, 5, 6], on: ["w1", "pg"],
      desc: "Nhiều lượt khứ hồi chỉ để mở kết nối, và hàng nghìn isolate có thể làm Postgres quá tải." },
    { title: "2 · Tạo cấu hình Hyperdrive", tab: "cli", highlight: [1, 2, 7, 9, 10, 11], on: ["hd"],
      desc: "Credential DB nằm ở cấu hình Hyperdrive, không nằm trong code. Local dev dùng <code>localConnectionString</code>." },
    { title: "3 · Client mới mỗi request", tab: "code", highlight: [5, 6], on: ["w1", "w2", "a1", "hd"],
      desc: "Kết nối tới Hyperdrive rẻ; pool thật tới Postgres đã mở sẵn." },
    { title: "4 · Truy vấn & cache", tab: "code", highlight: [8, 9, 10, 11], on: ["a2", "pg"],
      desc: "SELECT lặp lại có thể được Hyperdrive trả từ cache. Ghi thì luôn tới DB." },
    { title: "5 · Dọn dẹp", tab: "code", highlight: [12, 13], on: ["w1"],
      desc: "<code>client.end()</code> trong <code>waitUntil</code> để không làm chậm response." },
    { title: "6 · Đối chiếu với Spring", tab: "java", highlight: [2, 3, 4], on: ["hd"],
      desc: "Pool chuyển từ trong JVM ra một dịch vụ riêng gần DB." }
  ],

  quiz: [
    { q: "Vì sao mở kết nối Postgres trực tiếp trong mỗi request Worker là vấn đề?", options: [
        "Postgres cấm kết nối từ Cloudflare",
        "Mỗi kết nối tốn nhiều lượt khứ hồi (TCP/TLS/auth) và số kết nối đồng thời lớn làm DB quá tải",
        "Worker không hỗ trợ TCP",
        "Không có vấn đề gì"
      ], correct: 1, explanation: "Hyperdrive giải quyết cả hai bằng pool đặt gần DB." },
    { q: "Hyperdrive tương đương thành phần nào trong kiến trúc quen thuộc?", options: [
        "Kafka", "PgBouncer/connection pooler (kèm cache truy vấn đọc)", "Redis", "Nginx"
      ], correct: 1, explanation: "Do Cloudflare vận hành, đặt gần DB." },
    { q: "Trong Worker, client pg nên tạo khi nào?", options: [
        "Một lần ở global scope và dùng mãi",
        "Mới trong mỗi request, từ env.HYPERDRIVE.connectionString",
        "Trong cron",
        "Trong Durable Object"
      ], correct: 1, explanation: "Không dùng lại object I/O giữa các request." },
    { q: "Truy vấn nào Hyperdrive có thể cache?", options: [
        "INSERT/UPDATE",
        "Truy vấn đọc (SELECT) không nằm trong transaction",
        "Mọi truy vấn",
        "Không cache gì"
      ], correct: 1, explanation: "Mặc định tối đa 60 giây; tắt được nếu cần dữ liệu luôn mới." },
    { q: "Cấu hình để wrangler dev nối vào Postgres local?", options: [
        "Sửa connectionString trong code",
        "localConnectionString trong binding hyperdrive (hoặc biến CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>)",
        "Không làm được",
        "Dùng --remote"
      ], correct: 1, explanation: "Code không đổi giữa local và production." },
    { q: "Driver pg cần gì để chạy trên Workers?", options: [
        "Không cần gì",
        "nodejs_compat (mặc định bật với compatibility_date từ 2026-08-04)",
        "Rust",
        "Docker"
      ], correct: 1, explanation: "pg dùng một số API Node được runtime cung cấp qua nodejs_compat." },
    { q: "Hyperdrive có làm truy vấn từ Worker ở Frankfurt tới DB ở Singapore nhanh như DB cùng thành phố không?", options: [
        "Có, luôn luôn",
        "Không — nó giảm chi phí mở kết nối, nhưng mỗi truy vấn không trúng cache vẫn phải đi tới DB",
        "Có nếu bật cache 1 giờ",
        "Chỉ với MySQL"
      ], correct: 1, explanation: "Gộp truy vấn và Smart Placement vẫn cần thiết." },
    { q: "Worker muốn đọc số liệu từ ClickHouse. Cách đơn giản?", options: [
        "Hyperdrive",
        "fetch() tới HTTP interface của ClickHouse",
        "Kafka consumer trong Worker",
        "R2"
      ], correct: 1, explanation: "ClickHouse có giao diện HTTP gốc; Hyperdrive dành cho Postgres/MySQL." },
    { q: "Postgres nằm trong mạng riêng, không mở ra Internet. Hyperdrive nối thế nào?", options: [
        "Không thể",
        "Qua Cloudflare Tunnel",
        "Mở port 5432 ra Internet là bắt buộc",
        "Qua Queue"
      ], correct: 1, explanation: "Tunnel tạo kết nối ra ngoài từ mạng của bạn tới Cloudflare." }
  ]
});
