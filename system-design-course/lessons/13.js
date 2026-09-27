window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Hiệu năng & scale",
  title: "Scale ngang, stateless & serverless",
  subtitle: "Scale dọc vs ngang · đẩy state ra ngoài · load balancer · pool kết nối DB · Workers isolate & Durable Objects",

  theory: `
    <p><strong>Scale dọc</strong> (máy to hơn) đơn giản nhưng có trần và là một điểm chết. <strong>Scale ngang</strong> (thêm instance) gần như không trần,
    nhưng chỉ làm được khi instance <strong>stateless</strong>: bất kỳ instance nào cũng xử lý được bất kỳ request nào, instance chết không mất gì.</p>

    <p><strong>State hay trốn ở đâu (và chuyển đi đâu)</strong></p>
    <table>
      <tr><th>State trong process</th><th>Vấn đề khi có 5 instance</th><th>Chuyển ra</th></tr>
      <tr><td>HTTP session (Spring <code>HttpSession</code>)</td><td>Request sau rơi vào instance khác → mất đăng nhập</td><td>JWT/token hoặc session trong Redis</td></tr>
      <tr><td>Giỏ hàng trong <code>HashMap</code></td><td>Mất khi deploy/scale down</td><td>Redis/DB</td></tr>
      <tr><td>File upload lưu đĩa local</td><td>Instance khác không thấy</td><td>Object storage (S3/R2), upload thẳng bằng presigned URL</td></tr>
      <tr><td>Cron chạy trong mỗi instance</td><td>5 instance chạy 5 lần</td><td>Scheduler riêng / leader election / Cron Triggers</td></tr>
      <tr><td>Cache in-process</td><td>Mỗi instance một bản, lệch nhau</td><td>Chấp nhận TTL ngắn hoặc dùng Redis</td></tr>
    </table>

    <p><strong>Load balancer</strong> phân phối request (round robin, least connections). Cần <strong>health check</strong>: <em>readiness</em> (sẵn sàng nhận traffic chưa — DB đã kết nối, cache đã ấm)
    khác <em>liveness</em> (process còn sống không — sai thì restart). Đừng để liveness phụ thuộc DB: DB chậm → mọi pod bị restart cùng lúc.
    <strong>Graceful shutdown</strong>: nhận SIGTERM → báo not-ready → xử lý nốt request đang chạy → đóng.</p>

    <p><strong>Nút thắt thật khi scale ngang: kết nối DB</strong>. 30 pod × pool 20 = 600 kết nối, trong khi Postgres mỗi kết nối là một process và <code>max_connections</code> mặc định là 100.
    Giải: pool nhỏ mỗi pod, đặt PgBouncer (transaction pooling) phía trước, read replica cho đọc. Stateless ở tầng app chỉ dời vấn đề xuống tầng dữ liệu — tầng đó mới cần sharding (bài 14).</p>

    <p><strong>Serverless trên Cloudflare Workers</strong> là stateless tới cùng: code chạy trong <em>V8 isolate</em>, khởi động rất nhanh (không có cold start kiểu JVM),
    tự scale theo request ở hàng trăm PoP. Hệ quả thiết kế:</p>
    <ul>
      <li>Biến global có thể còn giữa các request trên cùng isolate nhưng <strong>không được dựa vào</strong> (isolate bị thay bất cứ lúc nào, mỗi PoP một bản).</li>
      <li>State bền → KV (đọc nhiều, eventually consistent), D1 (SQLite), R2 (object), Durable Objects (một thực thể duy nhất toàn cầu cho mỗi id, xử lý tuần tự, storage nhất quán mạnh — dùng cho đếm, phòng chat, khoá).</li>
      <li>Gọi Postgres ở origin từ hàng nghìn isolate → bão kết nối; dùng <strong>Hyperdrive</strong> (pool + cache truy vấn ở edge) hoặc gọi qua service Rust.</li>
      <li>Việc chạy sau khi trả response dùng <code>ctx.waitUntil</code>; việc dài/nặng đẩy sang Queues hoặc service backend.</li>
    </ul>

    <div class="callout"><p>💡 Rust service trên container: một process tokio xử lý hàng nghìn request đồng thời bằng async, RAM nhỏ, khởi động nhanh → scale ngang rẻ hơn JVM nhiều.
    Nhưng nguyên tắc stateless không đổi: <code>AppState</code> chỉ nên chứa thứ dùng chung chỉ-đọc (pool, client, config), không chứa dữ liệu người dùng.</p></div>
  `,

  codeTabs: [
    { id: "state", label: "① AppState đúng", lines: [
      "#[derive(Clone)]",
      "struct AppState {",
      "    db: PgPool,                  // pool kết nối: dùng chung, không phải state người dùng",
      "    redis: redis::aio::ConnectionManager,",
      "    http: reqwest::Client,",
      "    cfg: Arc<Config>,",
      "    // KHÔNG: carts: Arc<Mutex<HashMap<UserId, Cart>>>  -> mất khi scale/deploy",
      "}",
      "",
      "let db = PgPoolOptions::new()",
      "    .max_connections(10)          // 30 pod x 10 = 300 -> qua PgBouncer",
      "    .acquire_timeout(Duration::from_secs(2))",
      "    .connect(&cfg.database_url).await?;"
    ]},
    { id: "health", label: "② Health & shutdown", lines: [
      "let app = Router::new()",
      "    .route(\"/livez\",  get(|| async { \"ok\" }))            // chỉ: process còn sống",
      "    .route(\"/readyz\", get(ready))                        // DB/Redis sẵn sàng + chưa shutdown",
      "    .merge(api_routes())",
      "    .with_state(state.clone());",
      "",
      "axum::serve(listener, app)",
      "    .with_graceful_shutdown(async move {",
      "        tokio::signal::ctrl_c().await.ok();   // thực tế: nghe SIGTERM",
      "        state.ready.store(false, Ordering::SeqCst);   // LB ngừng gửi request mới",
      "        tokio::time::sleep(Duration::from_secs(5)).await; // chờ LB cập nhật",
      "    })",
      "    .await?;   // chờ request đang chạy xong rồi mới thoát"
    ]},
    { id: "conn", label: "③ Toán kết nối DB", lines: [
      "Postgres: max_connections = 100 (mặc định), mỗi kết nối = 1 process (~vài MB RAM)",
      "",
      "order-service  : 30 pod x pool 20 = 600  -> vượt!",
      "",
      "Giải:",
      "  pool mỗi pod = 5-10",
      "  PgBouncer pool_mode = transaction : 600 client -> ~50 kết nối thật tới Postgres",
      "  (transaction mode: tránh phụ thuộc state theo session; kiểm tra lại cách driver dùng prepared statement)",
      "  read replica cho truy vấn đọc"
    ]},
    { id: "worker", label: "④ Workers & Durable Object", lines: [
      "let hits = 0;                                  // global: KHÔNG dựa vào, mỗi isolate/PoP một bản",
      "",
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const id = env.CART.idFromName(userIdOf(req));   // 1 DO duy nhất cho mỗi user, toàn cầu",
      "    const res = await env.CART.get(id).fetch(req);   // xử lý tuần tự trong DO",
      "    ctx.waitUntil(logEvent(env, req));               // chạy tiếp sau khi trả response",
      "    return res;",
      "  }",
      "};",
      "",
      "export class Cart {                             // Durable Object",
      "  constructor(state, env) { this.state = state; }",
      "  async fetch(req) {",
      "    const items = (await this.state.storage.get('items')) || [];",
      "    /* thêm/bớt ... */",
      "    await this.state.storage.put('items', items);   // bền, nhất quán mạnh",
      "    return Response.json(items);",
      "  }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="lb"><div class="nl">⚖️ Load balancer</div><div class="ns">readiness check</div></div>
    <div class="arrow" id="a1">↓ request bất kỳ → instance bất kỳ</div>
    <div class="row">
      <div class="node" id="p1"><div class="nl">🦀 pod 1</div><div class="ns">stateless</div></div>
      <div class="node" id="p2"><div class="nl">🦀 pod 2</div><div class="ns">stateless</div></div>
      <div class="node" id="p3"><div class="nl">🦀 pod N</div><div class="ns">stateless</div></div>
    </div>
    <div class="arrow" id="a2">↓ state ở ngoài</div>
    <div class="row">
      <div class="node" id="bouncer"><div class="nl">PgBouncer → 🐘</div><div class="ns">gom kết nối</div></div>
      <div class="node" id="rd"><div class="nl">🟥 Redis</div><div class="ns">session · giỏ</div></div>
      <div class="node" id="do"><div class="nl">☁️ Durable Object</div><div class="ns">state ở edge</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chỉ giữ thứ dùng chung chỉ-đọc", tab: "state", highlight: [3, 4, 5, 6, 7], on: ["p1", "p2", "p3"],
      desc: "Pool và client là hạ tầng; giỏ hàng trong HashMap là state người dùng → phải ra Redis/DB." },
    { title: "2 · Pool nhỏ, có timeout", tab: "state", highlight: [11, 12], on: ["a2", "bouncer"],
      desc: "Số kết nối nhân theo số pod. Hết kết nối thì fail nhanh sau 2 s thay vì treo." },
    { title: "3 · Toán kết nối", tab: "conn", highlight: [1, 3, 6, 7], on: ["bouncer"],
      desc: "Scale app không scale DB. PgBouncer transaction mode gom hàng trăm client thành vài chục kết nối thật." },
    { title: "4 · Readiness ≠ liveness", tab: "health", highlight: [2, 3], on: ["lb", "a1"],
      desc: "Liveness phụ thuộc DB → DB chậm là mọi pod bị restart dây chuyền." },
    { title: "5 · Tắt êm khi deploy/scale down", tab: "health", highlight: [8, 10, 11, 13], on: ["lb", "p3"],
      desc: "Báo not-ready, chờ LB rút, xử lý nốt request rồi thoát — người dùng không thấy lỗi." },
    { title: "6 · Workers: state ở Durable Object", tab: "worker", highlight: [1, 5, 6, 7, 17], on: ["do"],
      desc: "Global không đáng tin. Cần state nhất quán theo khoá → DO; việc nền → waitUntil/Queues." }
  ],

  quiz: [
    { q: "Điều kiện tiên quyết để scale ngang một service?", options: [
        "Dùng Kubernetes",
        "Instance stateless: request nào cũng xử lý được ở instance nào, mất instance không mất dữ liệu",
        "Dùng Rust",
        "Có GPU"
      ], correct: 1, explanation: "State phải nằm ở kho bên ngoài." },
    { q: "30 pod, mỗi pod pool 20 kết nối Postgres (max_connections=100). Vấn đề?", options: [
        "Không có",
        "600 kết nối vượt giới hạn; cần pool nhỏ hơn và/hoặc PgBouncer",
        "Postgres tự tăng giới hạn",
        "Chỉ chậm hơn"
      ], correct: 1, explanation: "Mỗi kết nối Postgres là một process tốn RAM." },
    { q: "Khác nhau giữa readiness và liveness probe?", options: [
        "Không khác",
        "Readiness: có nên nhận traffic không; liveness: process có cần restart không",
        "Liveness kiểm DB, readiness không",
        "Chỉ dùng một"
      ], correct: 1, explanation: "Liveness không nên phụ thuộc phụ thuộc bên ngoài." },
    { q: "Graceful shutdown đúng gồm?", options: [
        "Kill -9 ngay",
        "Nhận SIGTERM → báo not-ready → xử lý nốt request đang chạy → thoát",
        "Restart DB",
        "Xoá cache"
      ], correct: 1, explanation: "Để deploy không gây lỗi cho người dùng." },
    { q: "Trong Cloudflare Worker, biến global đếm request có đáng tin không?", options: [
        "Có, toàn cầu",
        "Không — mỗi isolate/PoP một bản và isolate có thể bị thay bất kỳ lúc nào",
        "Có trong một ngày",
        "Có nếu dùng const"
      ], correct: 1, explanation: "State bền phải ở KV/D1/R2/Durable Objects." },
    { q: "Durable Object phù hợp cho?", options: [
        "Lưu ảnh lớn",
        "State nhất quán mạnh theo một khoá (bộ đếm chính xác, phòng chat, giỏ của một user), xử lý tuần tự",
        "Thay Kafka",
        "Cache CDN"
      ], correct: 1, explanation: "Mỗi id là một thực thể duy nhất toàn cầu." },
    { q: "Hàng nghìn Worker isolate gọi thẳng Postgres ở origin dễ gây gì? Giải pháp của Cloudflare?", options: [
        "Không sao",
        "Bão kết nối; dùng Hyperdrive (pool + cache truy vấn) hoặc đi qua service backend",
        "Postgres chạy nhanh hơn; không cần gì",
        "Dùng KV thay Postgres cho mọi thứ"
      ], correct: 1, explanation: "Kết nối DB là tài nguyên khan hiếm." },
    { q: "Cron job viết trong service chạy 5 instance. Vấn đề?", options: [
        "Không có",
        "Job chạy 5 lần; cần scheduler riêng, leader election hoặc khoá phân tán",
        "Job không chạy",
        "Chạy nhanh hơn"
      ], correct: 1, explanation: "Stateless cũng có nghĩa không có 'instance đặc biệt' ngầm." },
    { q: "File người dùng upload nên lưu ở đâu khi scale ngang?", options: [
        "Đĩa local của pod",
        "Object storage (S3/R2), tốt nhất client upload thẳng bằng presigned URL",
        "Trong RAM",
        "Trong Kafka"
      ], correct: 1, explanation: "Pod có thể mất bất cứ lúc nào." }
  ]
});
