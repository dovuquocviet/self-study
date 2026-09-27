window.LESSONS.push({
  id: "12",
  phase: "4", phaseName: "Replication & HA",
  title: "Sentinel: tự động failover cho master–replica",
  subtitle: "SDOWN → ODOWN · quorum vs majority · bầu leader · client hỏi Sentinel địa chỉ master",

  theory: `
    <p>Replication cho bạn bản sao, nhưng master chết thì ai thăng cấp replica, và làm sao app biết địa chỉ mới? <strong>Sentinel</strong> là các tiến trình riêng
    (cổng 26379) giám sát master/replica, phát hiện sự cố, điều phối failover và làm <em>dịch vụ tra cứu</em> địa chỉ master cho client.</p>

    <p><strong>Phát hiện sự cố</strong></p>
    <ol>
      <li>Mỗi Sentinel PING master/replica/Sentinel khác mỗi giây. Không nhận reply hợp lệ trong <code>down-after-milliseconds</code> → đánh dấu <strong>SDOWN</strong> (subjectively down: "tôi thấy nó chết").</li>
      <li>Sentinel hỏi các Sentinel khác. Đủ <strong>quorum</strong> Sentinel cùng thấy SDOWN → <strong>ODOWN</strong> (objectively down).</li>
      <li>Muốn thực hiện failover, một Sentinel phải được <strong>bầu làm leader</strong> với phiếu của <em>đa số</em> (majority) tổng số Sentinel — cơ chế giống Raft, theo <code>epoch</code> tăng dần.</li>
    </ol>
    <p>Chú ý hai con số khác nhau: <em>quorum</em> chỉ để kết luận ODOWN; <em>majority</em> mới cho phép failover. 5 Sentinel, quorum 2: 2 con thấy chết là đủ ODOWN, nhưng cần 3 con đồng ý bầu leader.</p>

    <p><strong>Leader chọn replica để thăng cấp</strong>: loại replica mất kết nối quá lâu, rồi ưu tiên <code>replica-priority</code> nhỏ (0 = không bao giờ chọn),
    rồi offset replication lớn nhất (ít thiếu dữ liệu nhất), cuối cùng run ID nhỏ nhất. Gửi <code>REPLICAOF NO ONE</code> cho replica được chọn, <code>REPLICAOF new-master</code> cho các replica còn lại,
    cập nhật cấu hình và phát sự kiện <code>+switch-master</code>.</p>

    <p><strong>Client</strong> không hardcode địa chỉ master; nó kết nối tới danh sách Sentinel, hỏi <code>SENTINEL GET-MASTER-ADDR-BY-NAME mymaster</code>,
    rồi kết nối master và kiểm tra lại bằng <code>ROLE</code>. Khi failover, master cũ ngắt các client (hoặc chúng nhận lỗi <code>READONLY</code>) → client hỏi lại Sentinel.
    Giống việc Spring Boot cấu hình <code>spring.data.redis.sentinel.master</code> + <code>nodes</code> thay vì <code>host</code>.</p>

    <table>
      <tr><th>Thiết kế</th><th>Đánh giá</th></tr>
      <tr><td>2 Sentinel</td><td>Sai: mất 1 con là không còn đa số → không failover được</td></tr>
      <tr><td>3 Sentinel trên 3 máy/zone khác nhau, quorum 2</td><td>Tối thiểu hợp lý</td></tr>
      <tr><td>Sentinel chạy cùng máy master</td><td>Máy chết = mất cả master lẫn phiếu bầu</td></tr>
    </table>

    <div class="callout"><p>💡 <strong>Split-brain</strong>: master cũ bị cô lập cùng vài client vẫn nhận ghi trong khi phía kia đã bầu master mới. Khi mạng lành, master cũ thành replica và
    xoá sạch các ghi đó. Giảm thiểu bằng <code>min-replicas-to-write</code>/<code>min-replicas-max-lag</code> (bài 11). Sentinel chỉ cho HA, không cho mở rộng ghi — cần mở rộng thì dùng Cluster.</p></div>
  `,

  codeTabs: [
    { id: "conf", label: "① sentinel.conf", lines: [
      "port 26379",
      "sentinel monitor mymaster 10.0.0.1 6379 2        # quorum = 2",
      "sentinel down-after-milliseconds mymaster 5000",
      "sentinel failover-timeout mymaster 60000",
      "sentinel parallel-syncs mymaster 1               # số replica đồng bộ lại cùng lúc",
      "sentinel auth-user mymaster sentinel-user",
      "sentinel auth-pass mymaster s3cret",
      "",
      "# replica: replica-priority 100 (mặc định); 0 = không bao giờ thăng cấp"
    ]},
    { id: "cli", label: "② Hỏi Sentinel", lines: [
      "$ redis-cli -p 26379",
      "127.0.0.1:26379> SENTINEL GET-MASTER-ADDR-BY-NAME mymaster",
      "1) \"10.0.0.1\"",
      "2) \"6379\"",
      "127.0.0.1:26379> SENTINEL REPLICAS mymaster",
      "127.0.0.1:26379> SENTINEL CKQUORUM mymaster",
      "OK 3 usable Sentinels. Quorum and failover authorization can be reached",
      "127.0.0.1:26379> SENTINEL FAILOVER mymaster     # failover thủ công (không cần đồng ý)"
    ]},
    { id: "log", label: "③ Log failover", lines: [
      "+sdown master mymaster 10.0.0.1 6379",
      "+odown master mymaster 10.0.0.1 6379 #quorum 2/2",
      "+new-epoch 7",
      "+try-failover master mymaster 10.0.0.1 6379",
      "+vote-for-leader 3f1c... 7",
      "+elected-leader master mymaster 10.0.0.1 6379",
      "+selected-slave slave 10.0.0.3:6379 10.0.0.3 6379 @ mymaster 10.0.0.1 6379",
      "+promoted-slave slave 10.0.0.3:6379 ...",
      "+switch-master mymaster 10.0.0.1 6379 10.0.0.3 6379"
    ]},
    { id: "rs", label: "④ Client Rust (fred)", lines: [
      "use fred::prelude::*;",
      "",
      "// URL sentinel: Sentinel đầu tiên ở host, các Sentinel khác qua &node=",
      "let config = Config::from_url(concat!(",
      "    \"redis-sentinel://10.0.0.11:26379/0?sentinelServiceName=mymaster\",",
      "    \"&node=10.0.0.12:26379&node=10.0.0.13:26379\"))?;",
      "let client = Builder::from_config(config).build()?;",
      "client.init().await?;       // hỏi Sentinel, kết nối master, tự làm lại khi failover"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="s1"><div class="nl">🛡️ Sentinel 1</div><div class="ns">SDOWN</div></div>
      <div class="node" id="s2"><div class="nl">🛡️ Sentinel 2</div><div class="ns">SDOWN</div></div>
      <div class="node" id="s3"><div class="nl">🛡️ Sentinel 3</div><div class="ns">bỏ phiếu</div></div>
    </div>
    <div class="arrow" id="a1">↓ đủ quorum → ODOWN · đa số → bầu leader</div>
    <div class="row">
      <div class="node" id="m"><div class="nl">💀 Master cũ</div><div class="ns">10.0.0.1</div></div>
      <div class="node" id="r"><div class="nl">👑 Replica → master mới</div><div class="ns">REPLICAOF NO ONE</div></div>
    </div>
    <div class="arrow" id="a2">↓ +switch-master</div>
    <div class="node" id="app"><div class="nl">📱 Client</div><div class="ns">hỏi lại GET-MASTER-ADDR-BY-NAME</div></div>
  `,
  steps: [
    { title: "1 · Cấu hình giám sát", tab: "conf", highlight: [2, 3], on: ["s1", "s2", "s3"],
      desc: "Mỗi Sentinel chỉ cần biết master; nó tự khám phá replica (qua INFO) và các Sentinel khác (qua pub/sub)." },
    { title: "2 · SDOWN → ODOWN", tab: "log", highlight: [1, 2], on: ["s1", "s2", "m"],
      desc: "Quá 5 giây không trả lời → SDOWN. Đủ 2 Sentinel đồng ý (quorum) → ODOWN." },
    { title: "3 · Bầu leader bằng đa số", tab: "log", highlight: [3, 4, 5, 6], on: ["a1", "s3"],
      desc: "Epoch mới, mỗi Sentinel bỏ một phiếu mỗi epoch. Cần đa số của tổng số Sentinel." },
    { title: "4 · Chọn và thăng cấp replica", tab: "log", highlight: [7, 8], on: ["r"],
      desc: "Ưu tiên replica-priority nhỏ, rồi offset lớn nhất (ít thiếu dữ liệu nhất)." },
    { title: "5 · Công bố master mới", tab: "log", highlight: [9], on: ["a2"],
      desc: "Replica còn lại được trỏ sang master mới; Sentinel ghi lại cấu hình." },
    { title: "6 · Client tự tìm lại", tab: "rs", highlight: [5, 8], on: ["app"],
      desc: "Client cấu hình danh sách Sentinel + tên service, không cấu hình địa chỉ master." }
  ],

  quiz: [
    { q: "SDOWN khác ODOWN thế nào?", options: [
        "Giống nhau", "SDOWN: một Sentinel thấy chết; ODOWN: đủ quorum Sentinel cùng thấy", "ODOWN chỉ cho replica", "SDOWN là khi đã failover xong"
      ], correct: 1, explanation: "Subjective vs objective." },
    { q: "5 Sentinel, quorum 2. Cần bao nhiêu Sentinel để được phép thực hiện failover?", options: [
        "2", "3 (đa số)", "5", "1"
      ], correct: 1, explanation: "Quorum chỉ để kết luận ODOWN; bầu leader cần majority." },
    { q: "Vì sao triển khai 2 Sentinel là sai?", options: [
        "Tốn RAM", "Mất 1 con thì con còn lại không đạt đa số → không failover được", "Sentinel cần số chẵn", "Không sai"
      ], correct: 1, explanation: "Dùng tối thiểu 3, đặt ở các máy/zone khác nhau." },
    { q: "Tiêu chí nào Sentinel dùng khi chọn replica để thăng cấp?", options: [
        "Replica có nhiều RAM nhất", "replica-priority, rồi offset replication lớn nhất, rồi run ID", "Ngẫu nhiên", "Replica gần Sentinel nhất"
      ], correct: 1, explanation: "Offset lớn = ít mất dữ liệu nhất." },
    { q: "replica-priority 0 nghĩa là gì?", options: [
        "Ưu tiên cao nhất", "Không bao giờ được thăng cấp làm master", "Replica bị tắt", "Chỉ đọc"
      ], correct: 1, explanation: "Hữu ích cho replica ở DC phụ hoặc dùng cho backup." },
    { q: "Client nên kết nối thế nào trong mô hình Sentinel?", options: [
        "Hardcode IP master", "Cấu hình danh sách Sentinel + tên master, hỏi địa chỉ rồi kết nối", "Kết nối mọi node và ghi vào tất cả", "Qua DNS round-robin"
      ], correct: 1, explanation: "SENTINEL GET-MASTER-ADDR-BY-NAME." },
    { q: "Split-brain trong Sentinel dẫn tới gì khi mạng lành lại?", options: [
        "Hai master cùng tồn tại mãi", "Master cũ thành replica và các ghi nó nhận trong lúc cô lập bị mất", "Dữ liệu được merge", "Sentinel báo lỗi và dừng"
      ], correct: 1, explanation: "Giảm thiểu bằng min-replicas-to-write." },
    { q: "Sentinel có giúp tăng throughput ghi không?", options: [
        "Có, chia ghi cho các replica", "Không — chỉ có một master nhận ghi; mở rộng ghi cần Cluster", "Có nếu quorum lớn", "Có với io-threads"
      ], correct: 1, explanation: "Sentinel là giải pháp HA." },
    { q: "Sentinel khám phá các Sentinel khác bằng cách nào?", options: [
        "Cấu hình tay từng con", "Qua kênh pub/sub __sentinel__:hello trên master/replica", "DNS", "Multicast"
      ], correct: 1, explanation: "Mỗi Sentinel publish thông tin của mình lên kênh hello." }
  ]
});
