window.LESSONS.push({
  id: "24",
  phase: "8", phaseName: "Vận hành & client",
  title: "Client Rust: redis-rs và fred trong service thật",
  subtitle: "Multiplexed connection vs pool · khi nào cần kết nối riêng · timeout, reconnect · so với Lettuce/Jedis",

  theory: `
    <p>Bên Spring bạn dùng <code>RedisTemplate</code> trên nền <strong>Lettuce</strong> (mặc định từ Boot 2: một kết nối Netty dùng chung, async) hoặc <strong>Jedis</strong> (mỗi thread mượn một kết nối từ pool).
    Rust có hai lựa chọn chính, và mô hình tương tự:</p>

    <table>
      <tr><th></th><th>redis-rs (crate <code>redis</code>, 1.x)</th><th>fred</th></tr>
      <tr><td>Phong cách</td><td>Thư viện nền, gần với lệnh; trait <code>AsyncCommands</code> (kiểu trả generic) và <code>AsyncTypedCommands</code> (kiểu trả cố định)</td><td>Client "đầy đủ pin": reconnect policy, pool, cluster/sentinel, metrics, tracing</td></tr>
      <tr><td>Kết nối chính</td><td><code>MultiplexedConnection</code> / <code>ConnectionManager</code> (tự reconnect)</td><td><code>Client</code> (một kết nối multiplexed) / <code>Pool</code></td></tr>
      <tr><td>Cluster</td><td>feature <code>cluster-async</code>, <code>ClusterClient</code></td><td>URL <code>redis-cluster://</code></td></tr>
      <tr><td>Tương đương Java</td><td>Gần Lettuce ở mức thấp</td><td>Gần Lettuce + Spring Data Redis</td></tr>
    </table>

    <p><strong>Multiplexed connection</strong>: một socket TCP, nhiều task gửi lệnh cùng lúc; client xếp các lệnh nối đuôi (pipelining tự nhiên) và ghép reply theo thứ tự.
    <code>clone()</code> rẻ — chia sẻ cho mọi handler axum/actix qua <code>State</code>. Thường <strong>một</strong> kết nối multiplexed đủ cho hàng chục nghìn ops/s.</p>

    <p><strong>Khi nào PHẢI dùng kết nối riêng</strong> (lấy từ pool như bb8-redis/deadpool-redis, hoặc mở mới):</p>
    <ul>
      <li>Lệnh <strong>blocking</strong>: <code>BLPOP</code>, <code>BRPOP</code>, <code>XREAD BLOCK</code>, <code>WAIT</code> — chúng giữ socket, mọi task khác trên kết nối multiplexed bị kẹt sau nó.</li>
      <li><code>WATCH</code>/<code>MULTI</code> tương tác nhiều bước (trạng thái gắn với kết nối; bài 15). Pipeline <code>atomic()</code> gửi trọn MULTI...EXEC một lần thì dùng multiplexed được.</li>
      <li><code>SUBSCRIBE</code> (kết nối ở chế độ pub/sub) — dùng API pubsub riêng.</li>
      <li>Payload rất lớn làm nghẽn đầu hàng (head-of-line blocking) cho lệnh nhỏ phía sau.</li>
    </ul>

    <p><strong>Timeout và lỗi</strong></p>
    <ul>
      <li>Đặt timeout kết nối và <strong>timeout từng lệnh</strong> ngắn (vd 50–200 ms cho cache). Redis đứng (fork, script dài) không được kéo cả service chờ theo — bọc <code>tokio::time::timeout</code> nếu cần.</li>
      <li>Reconnect có backoff (ConnectionManager, <code>ReconnectPolicy</code> của fred). Lệnh không idempotent (INCR, LPUSH) gửi lại sau lỗi mạng có thể chạy <strong>hai lần</strong> — cân nhắc trước khi bật retry tự động.</li>
      <li>Lỗi Redis ở đường cache → log + fallback, không trả 500 (bài 18).</li>
    </ul>

    <div class="callout"><p>💡 Kiểu Rust giúp bắt lỗi mà Java để lọt: <code>GET</code> trả <code>Option&lt;String&gt;</code> buộc bạn xử lý nil; sai kiểu (WRONGTYPE, parse số) là <code>Err</code> chứ không phải <code>ClassCastException</code> lúc chạy.
    Hãy khai báo kiểu trả rõ ràng (<code>let v: Option&lt;String&gt; = ...</code>) thay vì để suy luận ra <code>()</code>.</p></div>
  `,

  codeTabs: [
    { id: "cargo", label: "① Cargo.toml", lines: [
      "[dependencies]",
      "tokio = { version = \"1\", features = [\"full\"] }",
      "redis = { version = \"1\", features = [\"tokio-comp\", \"connection-manager\", \"cluster-async\"] }",
      "# hoặc",
      "fred = \"10\"",
      "",
      "# pool cho lệnh blocking (tuỳ chọn)",
      "deadpool-redis = \"*\"   # ghim phiên bản tương thích với redis bạn dùng"
    ]},
    { id: "rr", label: "② redis-rs + axum", lines: [
      "use redis::{aio::ConnectionManager, AsyncCommands};",
      "",
      "#[derive(Clone)]",
      "struct AppState { redis: ConnectionManager }      // clone rẻ, tự reconnect",
      "",
      "#[tokio::main]",
      "async fn main() -> anyhow::Result<()> {",
      "    let client = redis::Client::open(\"redis://:s3cret@10.0.0.1:6379/0\")?;",
      "    let redis = ConnectionManager::new(client).await?;",
      "    let app = axum::Router::new().route(\"/p/{id}\", get(product)).with_state(AppState { redis });",
      "    // ...",
      "}",
      "",
      "async fn product(State(mut s): State<AppState>, Path(id): Path<i64>) -> Response {",
      "    let v: Option<String> = s.redis.get(format!(\"catalog:v3:product:{id}\")).await.ok().flatten();",
      "    // ...",
      "}"
    ]},
    { id: "fred", label: "③ fred", lines: [
      "use fred::prelude::*;",
      "use fred::types::{Expiration, SetOptions};",
      "",
      "let config = Config::from_url(\"redis://10.0.0.1:6379/0\")?;",
      "let pool = Builder::from_config(config)",
      "    .set_policy(ReconnectPolicy::new_exponential(0, 100, 30_000, 2))  // thử mãi, 100ms..30s",
      "    .build_pool(4)?;                                 // 4 kết nối, round-robin",
      "pool.init().await?;",
      "",
      "// SET lock:job tok NX PX 30000",
      "let ok: Option<String> = pool.set(\"lock:job\", \"tok\",",
      "    Some(Expiration::PX(30_000)), Some(SetOptions::NX), false).await?;",
      "let v: Option<String> = pool.get(\"catalog:v3:product:9812\").await?;"
    ]},
    { id: "block", label: "④ Lệnh blocking", lines: [
      "// SAI: BLPOP 30 giây trên ConnectionManager dùng chung",
      "//      -> mọi GET khác của service xếp hàng sau nó trên cùng socket",
      "",
      "// ĐÚNG: kết nối riêng cho worker",
      "let mut dedicated = client.get_multiplexed_async_connection().await?;",
      "loop {",
      "    let job: Option<(String, String)> = dedicated.blpop(\"jobs\", 30.0).await?;",
      "    if let Some((_, payload)) = job { handle(payload).await; }",
      "}",
      "",
      "// Timeout ngắn cho đường cache",
      "let r = tokio::time::timeout(Duration::from_millis(100), s.redis.get::<_, Option<String>>(k)).await;"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="h1"><div class="nl">🦀 handler 1</div><div class="ns">GET</div></div>
      <div class="node" id="h2"><div class="nl">🦀 handler 2</div><div class="ns">SET EX</div></div>
      <div class="node" id="h3"><div class="nl">🦀 handler N</div><div class="ns">EVALSHA</div></div>
    </div>
    <div class="arrow" id="a1">↓ clone() cùng một kết nối</div>
    <div class="node" id="mx"><div class="nl">🔀 Multiplexed connection</div><div class="ns">1 socket · lệnh nối đuôi · reply theo thứ tự</div></div>
    <div class="arrow" id="a2">↓ lệnh blocking / WATCH / SUBSCRIBE</div>
    <div class="node" id="ded"><div class="nl">🔌 Kết nối riêng / pool</div><div class="ns">BLPOP · XREAD BLOCK · WATCH</div></div>
    <div class="arrow" id="a3">↓ luôn có</div>
    <div class="node" id="to"><div class="nl">⏱️ Timeout + reconnect backoff</div><div class="ns">cẩn thận retry lệnh không idempotent</div></div>
  `,
  steps: [
    { title: "1 · Chọn crate và feature", tab: "cargo", highlight: [3, 5], on: ["mx"],
      desc: "redis-rs cần bật runtime (tokio-comp) và các tính năng như connection-manager, cluster-async." },
    { title: "2 · Một kết nối cho cả service", tab: "rr", highlight: [4, 8, 9, 10], on: ["h1", "h2", "h3", "a1", "mx"],
      desc: "ConnectionManager clone rẻ, chia qua State của axum, tự kết nối lại khi rớt." },
    { title: "3 · Kiểu trả rõ ràng", tab: "rr", highlight: [14, 15], on: ["h1"],
      desc: "Option<String> buộc xử lý nil. Lỗi Redis trên đường cache → coi như miss." },
    { title: "4 · fred: pool + reconnect", tab: "fred", highlight: [5, 6, 7, 11, 12], on: ["mx", "to"],
      desc: "Policy backoff tích hợp; set() nhận Expiration và SetOptions thay cho chuỗi 'NX' 'PX'." },
    { title: "5 · Lệnh blocking cần kết nối riêng", tab: "block", highlight: [1, 2, 5, 7], on: ["a2", "ded"],
      desc: "BLPOP giữ socket tới 30 giây — không bao giờ chạy trên kết nối dùng chung." },
    { title: "6 · Timeout ngắn", tab: "block", highlight: [12], on: ["a3", "to"],
      desc: "Redis chậm không được kéo cả service chậm theo." }
  ],

  quiz: [
    { q: "MultiplexedConnection trong redis-rs là gì?", options: [
        "Pool nhiều socket", "Một socket dùng chung cho nhiều task, lệnh được nối đuôi và reply ghép theo thứ tự", "Kết nối tới nhiều node", "Kết nối chỉ đọc"
      ], correct: 1, explanation: "clone() rẻ, an toàn chia sẻ giữa các task." },
    { q: "Vì sao không chạy BLPOP trên kết nối multiplexed dùng chung?", options: [
        "BLPOP không được hỗ trợ", "Nó giữ socket tới khi có dữ liệu/timeout; mọi lệnh khác trên socket đó bị kẹt sau", "Sẽ mất dữ liệu", "Vì RESP3"
      ], correct: 1, explanation: "Dùng kết nối riêng cho lệnh blocking." },
    { q: "ConnectionManager bổ sung gì so với MultiplexedConnection?", options: [
        "Hỗ trợ Cluster", "Tự kết nối lại khi mất kết nối", "Mã hoá", "Pool nhiều kết nối"
      ], correct: 1, explanation: "Vẫn là multiplexed, thêm reconnect." },
    { q: "Rủi ro của tự động retry lệnh sau lỗi mạng?", options: [
        "Không có", "Lệnh không idempotent (INCR, LPUSH) có thể đã chạy trên server và bị chạy lần hai", "Làm chậm Redis", "Mất kết nối"
      ], correct: 1, explanation: "Lỗi mạng không cho biết lệnh đã chạy hay chưa." },
    { q: "Tương đương gần nhất của mô hình multiplexed trong Java?", options: [
        "Jedis với JedisPool", "Lettuce (một kết nối Netty dùng chung)", "JDBC", "Hibernate"
      ], correct: 1, explanation: "Jedis mượn kết nối riêng từ pool cho mỗi thread." },
    { q: "Đọc cache: GET trả lỗi timeout. Handler nên?", options: [
        "Trả 500", "Coi như miss, đọc DB (có giới hạn), log/metric lỗi", "Retry vô hạn", "Panic"
      ], correct: 1, explanation: "Redis là tối ưu hoá trên đường đọc." },
    { q: "Feature nào của redis-rs cần cho Redis Cluster async?", options: [
        "json", "cluster-async (cùng runtime như tokio-comp)", "sentinel", "bloom"
      ], correct: 1, explanation: "ClusterClient::get_async_connection yêu cầu cluster-async." },
    { q: "Trong fred, set(key, val, Some(Expiration::PX(30_000)), Some(SetOptions::NX), false) tương đương?", options: [
        "SET key val EX 30000", "SET key val NX PX 30000", "SETNX key val", "SET key val XX"
      ], correct: 1, explanation: "Tham số cuối là GET (trả giá trị cũ) — ở đây false." },
    { q: "Vì sao nên khai báo kiểu trả rõ ràng như Option<String>?", options: [
        "Bắt buộc về cú pháp", "Buộc xử lý trường hợp key không tồn tại (nil) và phát hiện sai kiểu thành Err thay vì lỗi lúc chạy", "Nhanh hơn", "Để dùng RESP3"
      ], correct: 1, explanation: "Để suy luận ra () sẽ bỏ qua giá trị thật." }
  ]
});
