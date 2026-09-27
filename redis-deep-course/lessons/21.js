window.LESSONS.push({
  id: "21",
  phase: "7", phaseName: "Pattern thực chiến",
  title: "Pub/Sub vs Streams: consumer group, PEL, XAUTOCLAIM",
  subtitle: "Fire-and-forget vs log bền · XADD/XREADGROUP/XACK · so sánh với Kafka",

  theory: `
    <p><strong>Pub/Sub</strong> (<code>PUBLISH</code>/<code>SUBSCRIBE</code>/<code>PSUBSCRIBE</code>): tin nhắn đẩy ngay tới các subscriber <em>đang kết nối</em>. Không lưu.
    Subscriber rớt mạng 2 giây = mất tin trong 2 giây đó. Subscriber chậm → output buffer phình, tới <code>client-output-buffer-limit pubsub 32mb 8mb 60</code> thì bị ngắt.
    Hợp cho: invalidation cache cục bộ, thông báo "có thay đổi, hãy đọc lại", chat realtime chấp nhận mất. Trong Cluster, <code>PUBLISH</code> lan tới mọi node; <code>SPUBLISH</code> (7.0) chỉ trong shard của channel.</p>

    <p><strong>Streams</strong> (5.0+) là một <strong>log chỉ-nối-thêm</strong> bền (theo persistence của Redis), giống một partition Kafka thu nhỏ:</p>
    <ul>
      <li>Mỗi entry có ID <code>&lt;ms&gt;-&lt;seq&gt;</code> (vd <code>1727400000000-0</code>) tăng dần, và các cặp field-value.</li>
      <li>Bên trong: <strong>radix tree</strong> mà mỗi node chứa một <strong>listpack</strong> nhiều entry — nén tốt, tìm theo ID nhanh.</li>
      <li>Cắt bớt: <code>XADD ... MAXLEN ~ 100000</code> (dấu <code>~</code> cho phép cắt xấp xỉ theo node, rẻ hơn nhiều) hoặc <code>MINID</code>.</li>
    </ul>

    <p><strong>Consumer group</strong></p>
    <ol>
      <li><code>XGROUP CREATE orders g-billing $ MKSTREAM</code> — group có con trỏ <code>last_delivered_id</code>.</li>
      <li>Consumer đọc <code>XREADGROUP GROUP g-billing c1 COUNT 10 BLOCK 5000 STREAMS orders &gt;</code>: <code>&gt;</code> = "tin chưa giao cho ai trong group". Mỗi tin giao cho <strong>một</strong> consumer.</li>
      <li>Tin đã giao nằm trong <strong>PEL</strong> (Pending Entries List) tới khi <code>XACK</code>.</li>
      <li>Consumer chết giữa chừng: tin kẹt trong PEL. Consumer khác dùng <code>XAUTOCLAIM</code> (6.2) nhận lại tin pending quá <em>min-idle-time</em>. Trường <em>delivery count</em> giúp phát hiện "poison message" để đẩy sang dead-letter.</li>
      <li>Khởi động lại, consumer đọc lại pending của chính mình bằng ID <code>0</code> thay vì <code>&gt;</code>.</li>
    </ol>

    <table>
      <tr><th></th><th>Pub/Sub</th><th>Streams</th><th>Kafka</th></tr>
      <tr><td>Lưu trữ</td><td>Không</td><td>Trong RAM (+ RDB/AOF)</td><td>Đĩa, retention ngày/tuần</td></tr>
      <tr><td>Consumer offline</td><td>Mất tin</td><td>Đọc tiếp từ vị trí cũ</td><td>Đọc tiếp từ offset</td></tr>
      <tr><td>Chia tải</td><td>Không (ai cũng nhận)</td><td>Consumer group, ack từng tin</td><td>Consumer group, 1 partition ↔ 1 consumer, commit offset</td></tr>
      <tr><td>Thứ tự</td><td>—</td><td>Toàn stream; nhưng nhiều consumer xử lý song song</td><td>Theo partition</td></tr>
      <tr><td>Quy mô</td><td>—</td><td>Giới hạn bởi RAM một shard (một stream = một key)</td><td>Rất lớn, replay lâu dài</td></tr>
    </table>

    <div class="callout"><p>💡 Công ty bạn đã có Kafka: Streams hợp cho hàng đợi việc <em>nội bộ một service</em>, ngắn hạn, cần độ trễ rất thấp (gửi email, resize ảnh, job retry).
    Sự kiện nghiệp vụ giữa các service và dữ liệu cho ClickHouse thì để Kafka. Xử lý phải <strong>idempotent</strong> — Streams là at-least-once.</p></div>
  `,

  codeTabs: [
    { id: "ps", label: "① Pub/Sub", lines: [
      "# Terminal 1",
      "SUBSCRIBE cache-invalidate",
      "# Terminal 2",
      "PUBLISH cache-invalidate \"product:9812\"",
      "(integer) 1                # số subscriber ĐANG nghe nhận được",
      "",
      "PUBSUB NUMSUB cache-invalidate",
      "# Subscriber rớt mạng lúc PUBLISH -> tin mất, không có cách đọc lại"
    ]},
    { id: "xs", label: "② Streams cơ bản", lines: [
      "XADD orders MAXLEN ~ 100000 * orderId 881 amount 250000",
      "\"1727400000000-0\"",
      "XGROUP CREATE orders g-billing $ MKSTREAM",
      "XREADGROUP GROUP g-billing c1 COUNT 10 BLOCK 5000 STREAMS orders >",
      "XACK orders g-billing 1727400000000-0",
      "",
      "XPENDING orders g-billing                 # tổng quan PEL",
      "XAUTOCLAIM orders g-billing c2 60000 0-0 COUNT 10   # nhận tin kẹt > 60s",
      "XINFO GROUPS orders                       # lag, pending, last-delivered-id"
    ]},
    { id: "rs", label: "③ Worker Rust", lines: [
      "use redis::streams::{StreamReadOptions, StreamReadReply};",
      "",
      "let opts = StreamReadOptions::default()",
      "    .group(\"g-billing\", \"c1\").count(10).block(5000);",
      "loop {",
      "    let reply: Option<StreamReadReply> =            // None khi BLOCK hết giờ",
      "        con.xread_options(&[\"orders\"], &[\">\"], &opts).await?;",
      "    for key in reply.map(|r| r.keys).unwrap_or_default() {",
      "        for msg in key.ids {",
      "            handle_idempotent(&msg).await?;          // có thể nhận lại -> idempotent",
      "            let _: i64 = con.xack(\"orders\", \"g-billing\", &[&msg.id]).await?;",
      "        }",
      "    }",
      "}"
    ]},
    { id: "life", label: "④ Vòng đời một tin", lines: [
      "XADD            -> entry 1727400000000-0 trong stream",
      "XREADGROUP >    -> giao cho c1, vào PEL (owner=c1, delivery_count=1)",
      "c1 crash        -> tin nằm trong PEL, idle tăng dần",
      "XAUTOCLAIM c2   -> idle > 60s: chuyển owner sang c2, delivery_count=2",
      "c2 XACK         -> rời PEL",
      "delivery_count > 5 -> XADD orders:dlq ... ; XACK   (poison message)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="pub"><div class="nl">📢 PUBLISH</div><div class="ns">đẩy ngay, không lưu</div></div>
      <div class="node" id="xadd"><div class="nl">📜 XADD orders</div><div class="ns">log bền, ID tăng dần</div></div>
    </div>
    <div class="arrow" id="a1">↓ consumer group g-billing</div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">👷 c1</div><div class="ns">XREADGROUP &gt;</div></div>
      <div class="node" id="c2"><div class="nl">👷 c2</div><div class="ns">XREADGROUP &gt;</div></div>
    </div>
    <div class="arrow" id="a2">↓ đã giao, chưa ack</div>
    <div class="node" id="pel"><div class="nl">📋 PEL</div><div class="ns">XACK → xong · XAUTOCLAIM → giao lại</div></div>
    <div class="arrow" id="a3">↓ lỗi lặp lại</div>
    <div class="node" id="dlq"><div class="nl">☠️ Dead-letter stream</div><div class="ns">delivery_count vượt ngưỡng</div></div>
  `,
  steps: [
    { title: "1 · Pub/Sub: bắn và quên", tab: "ps", highlight: [2, 4, 5, 8], on: ["pub"],
      desc: "Chỉ subscriber đang kết nối nhận được. Không có lịch sử." },
    { title: "2 · Stream: log bền", tab: "xs", highlight: [1, 2], on: ["xadd"],
      desc: "ID <ms>-<seq>. MAXLEN ~ cắt xấp xỉ theo node listpack — rẻ." },
    { title: "3 · Consumer group chia việc", tab: "xs", highlight: [3, 4], on: ["a1", "c1", "c2"],
      desc: "'>' lấy tin chưa giao cho ai. Mỗi tin chỉ tới một consumer trong group." },
    { title: "4 · PEL và XACK", tab: "rs", highlight: [6, 7, 10, 11], on: ["a2", "pel"],
      desc: "Tin ở PEL tới khi ack. Xử lý phải idempotent vì có thể được giao lại." },
    { title: "5 · Consumer chết → XAUTOCLAIM", tab: "life", highlight: [2, 3, 4, 5], on: ["pel", "c2"],
      desc: "Tin pending quá lâu được chuyển cho consumer còn sống." },
    { title: "6 · Poison message", tab: "life", highlight: [6], on: ["a3", "dlq"],
      desc: "delivery_count cao → chuyển sang stream DLQ và ack, tránh vòng lặp vô hạn." }
  ],

  quiz: [
    { q: "Subscriber Pub/Sub mất kết nối 5 giây. Tin publish trong lúc đó?", options: [
        "Được lưu và giao lại", "Mất", "Chuyển sang stream", "Giữ trong backlog 1 MB"
      ], correct: 1, explanation: "Pub/Sub không lưu trữ." },
    { q: "Trong XREADGROUP, ID '>' nghĩa là gì?", options: [
        "Tin mới nhất", "Tin chưa từng được giao cho consumer nào trong group", "Tin pending của mình", "Mọi tin"
      ], correct: 1, explanation: "Đọc lại pending của mình thì dùng 0." },
    { q: "PEL là gì?", options: [
        "Danh sách consumer", "Danh sách tin đã giao nhưng chưa XACK", "Dead-letter queue", "Danh sách stream"
      ], correct: 1, explanation: "Pending Entries List của group." },
    { q: "Consumer chết khi đang xử lý tin. Cách khôi phục?", options: [
        "Tin tự quay lại '>'", "Consumer khác dùng XAUTOCLAIM/XCLAIM nhận tin pending quá min-idle-time", "XADD lại", "Không khôi phục được"
      ], correct: 1, explanation: "XAUTOCLAIM có từ 6.2." },
    { q: "XADD s MAXLEN ~ 1000 khác MAXLEN 1000 thế nào?", options: [
        "Không khác", "~ cho phép cắt xấp xỉ (theo node), stream có thể dài hơn 1000 chút nhưng rẻ hơn nhiều", "~ xoá toàn bộ", "~ giữ 1000 tin mới nhất tuyệt đối"
      ], correct: 1, explanation: "Cắt chính xác buộc sửa listpack giữa chừng." },
    { q: "Bảo đảm giao tin của Streams với consumer group?", options: [
        "At-most-once", "At-least-once — cần xử lý idempotent", "Exactly-once", "Không bảo đảm"
      ], correct: 1, explanation: "Tin chưa ack có thể được giao lại." },
    { q: "Stream được lưu bên trong bằng gì?", options: [
        "Linked list", "Radix tree với mỗi node là một listpack", "Skiplist", "Hash table"
      ], correct: 1, explanation: "Gọn và tìm theo ID nhanh." },
    { q: "Khi nào nên chọn Kafka thay vì Redis Streams?", options: [
        "Hàng đợi job nội bộ nhỏ", "Sự kiện giữa nhiều service, cần retention dài, replay, dung lượng lớn vượt RAM", "Cần độ trễ micro giây", "Không bao giờ"
      ], correct: 1, explanation: "Một stream là một key, giới hạn bởi RAM một shard." },
    { q: "Trong Cluster, SPUBLISH khác PUBLISH ở đâu?", options: [
        "Không khác", "SPUBLISH chỉ lan trong shard sở hữu slot của channel, không broadcast mọi node", "SPUBLISH lưu tin", "SPUBLISH mã hoá"
      ], correct: 1, explanation: "Sharded pub/sub (7.0) giảm tải cluster bus." }
  ]
});
