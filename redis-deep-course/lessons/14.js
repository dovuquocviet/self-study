window.LESSONS.push({
  id: "14",
  phase: "5", phaseName: "Redis Cluster",
  title: "Làm việc với Cluster: MOVED, ASK, CROSSSLOT và hash tag",
  subtitle: "Smart client cache bảng slot · resharding trực tuyến · gom key cùng slot bằng {tag}",

  theory: `
    <p>Client cho Cluster là <strong>smart client</strong>: khi khởi động nó gọi <code>CLUSTER SHARDS</code> (hoặc <code>CLUSTER SLOTS</code> ở bản cũ) để lấy bảng slot → node,
    tính slot của từng key và gửi thẳng tới đúng node. Nếu bảng đã cũ, server trả lời chuyển hướng:</p>

    <table>
      <tr><th>Reply</th><th>Nghĩa</th><th>Client làm gì</th></tr>
      <tr><td><code>-MOVED 5712 10.0.0.2:7000</code></td><td>Slot này <strong>đã thuộc hẳn</strong> node khác (sau failover/rebalance)</td><td>Gửi lại tới node đó <em>và cập nhật bảng slot</em> (thường tải lại cả bảng)</td></tr>
      <tr><td><code>-ASK 5712 10.0.0.7:7000</code></td><td>Slot <strong>đang được chuyển</strong>; key này đã sang node đích</td><td>Gửi <code>ASKING</code> rồi lệnh tới node đích, <em>một lần</em>; <strong>không</strong> cập nhật bảng</td></tr>
      <tr><td><code>-TRYAGAIN</code></td><td>Lệnh nhiều key mà các key đang nằm rải hai bên trong lúc chuyển slot</td><td>Chờ và thử lại</td></tr>
      <tr><td><code>-CROSSSLOT Keys in request don't hash to the same slot</code></td><td>Lệnh nhiều key nhưng key khác slot</td><td>Lỗi thiết kế key — sửa code</td></tr>
      <tr><td><code>-CLUSTERDOWN</code></td><td>Cluster không phục vụ (thiếu slot, đang bầu)</td><td>Retry có backoff</td></tr>
    </table>

    <p><strong>Resharding trực tuyến</strong>: chuyển slot S từ A sang B mà không dừng dịch vụ. Đánh dấu B <code>IMPORTING S</code>, A <code>MIGRATING S</code>;
    <code>MIGRATE</code> từng lô key từ A sang B (nguyên tử theo lô); cuối cùng <code>CLUSTER SETSLOT S NODE B</code>. Trong lúc đó A vẫn phục vụ key còn ở A, key đã đi thì trả ASK.
    Big key (bài 06) làm MIGRATE chậm và chặn cả hai node — thêm lý do tránh big key.</p>

    <p><strong>Lệnh nhiều key</strong> — <code>MGET</code>, <code>MSET</code>, <code>SUNIONSTORE</code>, <code>RENAME</code>, <code>MULTI/EXEC</code>, script Lua, <code>BLMOVE</code>...
    chỉ chạy khi <strong>mọi key cùng slot</strong>. Redis không làm giao dịch phân tán giữa các node.</p>

    <p><strong>Hash tag</strong>: nếu tên key chứa <code>{...}</code> với nội dung không rỗng, chỉ phần <em>giữa cặp ngoặc nhọn đầu tiên</em> được băm.
    <code>{user:1001}:cart</code> và <code>{user:1001}:profile</code> cùng slot 5712 → dùng chung được trong MULTI hay Lua.</p>
    <ul>
      <li>Chọn tag theo <strong>thực thể</strong> (user, đơn hàng, tenant) mà nghiệp vụ cần nguyên tử — giống chọn aggregate root trong DDD.</li>
      <li>Đừng dùng tag chung cho quá nhiều key (<code>{global}:*</code>): tất cả dồn về một slot → hot shard, big slot, mất ý nghĩa của Cluster.</li>
      <li><code>{}</code> rỗng không được coi là tag (băm cả key). Chỉ cặp ngoặc đầu tiên có tác dụng.</li>
    </ul>

    <div class="callout"><p>💡 Client như redis-rs/fred tự tách pipeline và <code>MGET</code> nhiều slot thành nhiều request theo node rồi ghép kết quả — tiện, nhưng
    <strong>mất tính nguyên tử</strong>. Đọc từ replica trong Cluster cần lệnh <code>READONLY</code> trên kết nối tới replica; pub/sub thường phát tới mọi node — dùng <code>SPUBLISH</code>/<code>SSUBSCRIBE</code> (7.0) để giới hạn trong shard.</p></div>
  `,

  codeTabs: [
    { id: "redir", label: "① MOVED / ASK", lines: [
      "$ redis-cli -p 7000 GET user:1001",
      "(error) MOVED 5712 10.0.0.2:7000",
      "",
      "$ redis-cli -c -p 7000 GET user:1001      # -c: tự theo chuyển hướng",
      "-> Redirected to slot [5712] located at 10.0.0.2:7000",
      "\"alice\"",
      "",
      "# Trong lúc chuyển slot 5712 từ B sang node mới N:",
      "B> GET user:1001",
      "(error) ASK 5712 10.0.0.7:7000",
      "N> ASKING",
      "N> GET user:1001                         # chỉ lần này; lần sau vẫn hỏi B trước"
    ]},
    { id: "tag", label: "② Hash tag", lines: [
      "127.0.0.1:7000> CLUSTER KEYSLOT {user:1001}:cart",
      "(integer) 5712",
      "127.0.0.1:7000> CLUSTER KEYSLOT {user:1001}:profile",
      "(integer) 5712",
      "127.0.0.1:7000> MGET user:1001 user:1002",
      "(error) CROSSSLOT Keys in request don't hash to the same slot   # 5712 vs 9779",
      "127.0.0.1:7000> MGET {user:1001}:cart {user:1001}:profile",
      "1) ... 2) ...                            # OK - cùng slot",
      "",
      "# cart:{1001} và order:{1001} -> cùng slot 15391 (tag = '1001')"
    ]},
    { id: "mig", label: "③ Resharding", lines: [
      "# chuyển slot 5712 từ B (id b2..) sang N (id n7..)",
      "N> CLUSTER SETSLOT 5712 IMPORTING b2..",
      "B> CLUSTER SETSLOT 5712 MIGRATING n7..",
      "B> CLUSTER GETKEYSINSLOT 5712 100",
      "B> MIGRATE 10.0.0.7 7000 \"\" 0 5000 KEYS k1 k2 ... k100",
      "   ... lặp tới khi slot rỗng ...",
      "*> CLUSTER SETSLOT 5712 NODE n7..       # gửi cho cả N, B và các master",
      "",
      "# Thực tế: redis-cli --cluster reshard / rebalance làm hộ các bước trên"
    ]},
    { id: "rs", label: "④ Rust cluster client", lines: [
      "use redis::cluster::ClusterClient;",
      "use redis::AsyncCommands;",
      "",
      "let client = ClusterClient::new(vec![",
      "    \"redis://10.0.0.1:7000\", \"redis://10.0.0.2:7000\", \"redis://10.0.0.3:7000\",",
      "])?;                                   // chỉ là seed, client tự khám phá phần còn lại",
      "let mut con = client.get_async_connection().await?;   // feature \"cluster-async\"",
      "",
      "let uid = 1001;",
      "let cart_key = format!(\"{{user:{uid}}}:cart\");   // {{ }} = ngoặc nhọn thật trong format!",
      "let _: () = con.hset(&cart_key, \"sku-9\", 2).await?;  // MOVED/ASK được xử lý tự động"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cl"><div class="nl">📱 Smart client</div><div class="ns">cache bảng slot → node</div></div>
    <div class="arrow" id="a1">↓ GET user:1001 (slot 5712) gửi node A theo bảng cũ</div>
    <div class="row">
      <div class="node" id="mv"><div class="nl">↪️ -MOVED 5712 B</div><div class="ns">cập nhật bảng, gửi lại B</div></div>
      <div class="node" id="ask"><div class="nl">🚚 -ASK 5712 N</div><div class="ns">ASKING + gửi N một lần</div></div>
    </div>
    <div class="arrow" id="a2">↓ lệnh nhiều key</div>
    <div class="row">
      <div class="node" id="cs"><div class="nl">⛔ CROSSSLOT</div><div class="ns">user:1001 / user:1002</div></div>
      <div class="node" id="ht"><div class="nl">🏷️ {user:1001}:*</div><div class="ns">cùng slot → MULTI/Lua được</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Bảng slot cũ → MOVED", tab: "redir", highlight: [1, 2, 4, 5], on: ["cl", "a1", "mv"],
      desc: "Slot đã đổi chủ vĩnh viễn. Client gửi lại và làm mới bảng slot." },
    { title: "2 · Đang chuyển slot → ASK", tab: "redir", highlight: [9, 10, 11, 12], on: ["ask"],
      desc: "Chỉ key này đã sang N. ASKING cho phép N phục vụ slot mà nó đang IMPORTING. Không cập nhật bảng." },
    { title: "3 · Resharding từng lô", tab: "mig", highlight: [2, 3, 5, 7], on: ["ask"],
      desc: "IMPORTING/MIGRATING → MIGRATE theo lô → SETSLOT NODE. Dịch vụ không dừng." },
    { title: "4 · Lệnh nhiều key khác slot", tab: "tag", highlight: [5, 6], on: ["a2", "cs"],
      desc: "5712 và 9779 khác slot → CROSSSLOT, dù có thể cùng node." },
    { title: "5 · Hash tag gom key", tab: "tag", highlight: [1, 2, 3, 4, 7, 8], on: ["ht"],
      desc: "Chỉ phần trong {} được băm. Chọn tag theo thực thể cần thao tác nguyên tử." },
    { title: "6 · Trong Rust", tab: "rs", highlight: [4, 6, 7, 10, 11], on: ["cl", "ht"],
      desc: "Truyền vài seed node; client tự lấy topology và xử lý MOVED/ASK. Nhớ escape {{ }} trong format!." }
  ],

  quiz: [
    { q: "Khác biệt chính giữa MOVED và ASK?", options: [
        "Không khác", "MOVED: slot đã đổi chủ, cập nhật bảng; ASK: slot đang chuyển, chỉ chuyển hướng một lần, không cập nhật bảng",
        "ASK dùng cho replica", "MOVED chỉ xảy ra khi failover"
      ], correct: 1, explanation: "ASK là trạng thái tạm thời trong lúc migrate." },
    { q: "Trước khi gửi lệnh tới node đích theo ASK, client phải gửi gì?", options: [
        "READONLY", "ASKING", "CLUSTER SLOTS", "AUTH"
      ], correct: 1, explanation: "Không có ASKING, node đích sẽ trả MOVED về node nguồn." },
    { q: "MGET a b trong Cluster, a và b khác slot nhưng cùng node. Kết quả?", options: [
        "Chạy bình thường vì cùng node", "Lỗi CROSSSLOT", "Trả nil cho key thứ hai", "Tự chuyển thành 2 GET"
      ], correct: 1, explanation: "Điều kiện là cùng slot, không phải cùng node (slot có thể bị chuyển đi bất cứ lúc nào)." },
    { q: "Key nào cùng slot với {order:77}:items?", options: [
        "order:77:items", "{order:77}:payment", "order:{77}", "{order}:77"
      ], correct: 1, explanation: "Chỉ nội dung trong cặp {} đầu tiên được băm: 'order:77'." },
    { q: "Vì sao không nên đặt mọi key là {app}:...?", options: [
        "Cú pháp sai", "Mọi key dồn vào một slot → một node gánh hết, mất lợi ích của Cluster", "Tốn thêm RAM cho ngoặc", "Không thể đặt TTL"
      ], correct: 1, explanation: "Hash tag chỉ nên gom theo thực thể nhỏ." },
    { q: "Key {}:session:1 được băm theo phần nào?", options: [
        "Chuỗi rỗng", "Toàn bộ key (vì {} rỗng không phải hash tag)", "session", "1"
      ], correct: 1, explanation: "Tag rỗng bị bỏ qua." },
    { q: "Pipeline chứa key ở nhiều node, client cluster sẽ?", options: [
        "Lỗi", "Tách theo node, gửi song song, ghép kết quả — nhưng không nguyên tử", "Gửi tất cả tới một node", "Chuyển thành MULTI"
      ], correct: 1, explanation: "Tiện nhưng không có đảm bảo giao dịch." },
    { q: "Muốn đọc từ replica trong Cluster, kết nối tới replica cần gì?", options: [
        "Không cần gì", "Gửi lệnh READONLY", "SLAVEOF", "ASKING"
      ], correct: 1, explanation: "Nếu không, replica trả MOVED về master." },
    { q: "Lỗi TRYAGAIN thường xảy ra khi nào?", options: [
        "Sai mật khẩu", "Lệnh nhiều key trong lúc slot đang migrate và các key nằm rải ở hai node", "Hết RAM", "Script chạy lâu"
      ], correct: 1, explanation: "Client chờ ngắn rồi thử lại." }
  ]
});
