window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Độ bền & nhân bản",
  title: "Replication: leader, follower, ISR và high watermark",
  subtitle: "LEO · HW · replica.lag.time.max.ms · vì sao consumer không thấy message 'mới ghi'",

  theory: `
    <p>Mỗi partition có <code>replication.factor</code> bản sao (thường 3), nằm trên các broker khác nhau. Một bản là <strong>leader</strong>, còn lại là <strong>follower</strong>.</p>
    <ul>
      <li>Mọi produce đi tới leader. (Mặc định fetch cũng từ leader; có thể cho consumer đọc follower gần nhất bằng rack awareness — <code>client.rack</code> + <code>replica.selector.class</code>.)</li>
      <li>Follower <strong>tự kéo</strong> dữ liệu từ leader bằng FetchRequest — y như một consumer. Không có chuyện leader "đẩy" cho follower.</li>
    </ul>

    <p><strong>Hai con trỏ quan trọng</strong></p>
    <table>
      <tr><th>Tên</th><th>Nghĩa</th></tr>
      <tr><td><strong>LEO</strong> (Log End Offset)</td><td>Offset tiếp theo sẽ được ghi trên <em>một</em> bản sao. Mỗi replica có LEO riêng.</td></tr>
      <tr><td><strong>HW</strong> (High Watermark)</td><td>Offset mà <em>mọi replica trong ISR</em> đã có. Message dưới HW gọi là <strong>committed</strong>.</td></tr>
    </table>
    <p>Consumer <strong>chỉ được đọc tới HW</strong>. Message đã nằm trên leader nhưng follower chưa chép thì consumer chưa thấy — nếu cho đọc,
    leader chết ngay sau đó thì consumer đã "thấy" một message sẽ biến mất.</p>

    <p><strong>ISR (In-Sync Replicas)</strong>: tập các replica đang theo kịp leader (gồm cả leader). Follower bị đá khỏi ISR nếu không bắt kịp LEO của leader trong
    <code>replica.lag.time.max.ms</code> (mặc định 30 giây). Bắt kịp lại thì được đưa vào lại. Controller ghi thay đổi ISR vào metadata.</p>
    <ul>
      <li>Leader chết → controller chọn leader mới <em>từ trong ISR</em> → không mất message đã committed.</li>
      <li>Follower tụt lại (GC dài, đĩa chậm, mạng) → rơi khỏi ISR → HW không bị nó kéo lùi, cluster vẫn tiến.</li>
      <li>Chỉ số vận hành: <strong>UnderReplicatedPartitions</strong> &gt; 0 nghĩa là có partition mà ISR ít hơn số replica — cần xem ngay.</li>
    </ul>

    <p><strong>Leader epoch</strong>: mỗi lần đổi leader, epoch tăng. Follower dùng epoch để biết phải cắt bỏ (truncate) phần đuôi log nào không có trên leader mới —
    tránh hai bản sao lệch nhau sau failover.</p>

    <div class="callout"><p>💡 "Committed" trong Kafka nghĩa là <em>đã có trên mọi replica thuộc ISR</em>, không phải "đã fsync". Và điều này chỉ an toàn khi ISR đủ lớn —
    ISR co lại còn 1 (chỉ leader) thì "committed" chỉ còn là "leader có". Bài 05 dùng <code>min.insync.replicas</code> để chặn tình huống đó.</p></div>
  `,

  codeTabs: [
    { id: "state", label: "① Trạng thái 3 replica", lines: [
      "partition orders-0   replicas=[101,102,103]   leader=101",
      "",
      "broker 101 (leader)  : 0 1 2 3 4 5 6        LEO=7",
      "broker 102 (follower): 0 1 2 3 4 5          LEO=6",
      "broker 103 (follower): 0 1 2 3 4            LEO=5",
      "",
      "ISR = {101,102,103}",
      "HW  = min(LEO của ISR) = 5    -> consumer đọc được offset 0..4",
      "# offset 5, 6 đã nằm ở leader nhưng CHƯA committed"
    ]},
    { id: "fetch", label: "② Follower fetch", lines: [
      "loop (follower 103):",
      "  resp = leader.fetch(partition, fetchOffset = myLEO)   // = 5",
      "  append(resp.records)                                  // LEO 103 -> 7",
      "  hw = min(resp.highWatermark, myLEO)",
      "",
      "leader nhận fetch(offset=5) từ 103:",
      "  => biết 103 đã có tới 4; ghi nhận tiến độ",
      "  => khi mọi ISR có tới 6: HW leader = 7"
    ]},
    { id: "shrink", label: "③ ISR co lại", lines: [
      "t=0s   broker 103 bị GC pause dài / đĩa nghẽn",
      "t=30s  103 chưa bắt kịp LEO leader trong replica.lag.time.max.ms",
      "       -> leader đề nghị bỏ 103 khỏi ISR; controller ghi nhận",
      "       ISR = {101,102}",
      "       metric UnderReplicatedPartitions = 1",
      "t=90s  103 bắt kịp -> được đưa vào lại ISR = {101,102,103}"
    ]},
    { id: "cli", label: "④ Xem bằng CLI", lines: [
      "kafka-topics.sh --bootstrap-server b:9092 --describe --topic orders",
      "Topic: orders  Partition: 0  Leader: 101  Replicas: 101,102,103  Isr: 101,102",
      "",
      "# chỉ liệt kê partition đang thiếu bản sao",
      "kafka-topics.sh --bootstrap-server b:9092 --describe --under-replicated-partitions"
    ]}
  ],

  stageHtml: `
    <div class="node" id="prod"><div class="nl">✍️ Producer</div><div class="ns">ghi vào leader</div></div>
    <div class="arrow" id="a1">↓ produce</div>
    <div class="node" id="l"><div class="nl">👑 Leader 101</div><div class="ns">LEO=7 · HW=5</div></div>
    <div class="arrow" id="a2">↑ follower tự fetch</div>
    <div class="row">
      <div class="node" id="f2"><div class="nl">📦 Follower 102</div><div class="ns">LEO=6</div></div>
      <div class="node" id="f3"><div class="nl">📦 Follower 103</div><div class="ns">LEO=5 → có thể rơi khỏi ISR</div></div>
    </div>
    <div class="node" id="cons"><div class="nl">👀 Consumer</div><div class="ns">chỉ đọc tới HW</div></div>
  `,
  steps: [
    { title: "1 · Mỗi replica có LEO riêng", tab: "state", highlight: [3, 4, 5], on: ["prod", "a1", "l", "f2", "f3"],
      desc: "Leader đã có 0..6, hai follower chậm hơn một chút. Đây là trạng thái bình thường từng mili-giây." },
    { title: "2 · HW = mức mọi ISR đều có", tab: "state", highlight: [7, 8, 9], on: ["l", "cons"],
      desc: "Consumer thấy tới offset 4. Offset 5–6 chưa committed nên bị giấu." },
    { title: "3 · Follower kéo dữ liệu", tab: "fetch", highlight: [2, 3, 6, 7], on: ["a2", "f3"],
      desc: "Chính offset trong fetch request của follower cho leader biết follower đã có tới đâu — nhờ vậy leader tính được HW." },
    { title: "4 · HW tiến lên", tab: "fetch", highlight: [8], on: ["l", "cons"],
      desc: "Khi 102 và 103 đều có tới offset 6, HW nhảy lên 7 và consumer thấy thêm hai message." },
    { title: "5 · Follower chậm bị loại khỏi ISR", tab: "shrink", highlight: [2, 3, 4, 5], on: ["f3"],
      desc: "Không loại thì một follower ốm sẽ giữ HW đứng yên và chặn cả partition. Loại ra thì hệ thống tiếp tục, nhưng số bản sao an toàn giảm." },
    { title: "6 · Quan sát", tab: "cli", highlight: [2, 5], on: ["l"],
      desc: "Isr ngắn hơn Replicas = đang under-replicated. Đây là cảnh báo cần theo dõi thường trực." }
  ],

  quiz: [
    { q: "Follower nhận dữ liệu từ leader bằng cách nào?", options: [
        "Leader push", "Follower tự gửi FetchRequest như một consumer", "Qua controller", "Qua ZooKeeper"
      ], correct: 1, explanation: "Cơ chế sao chép dùng lại đúng giao thức fetch." },
    { q: "High watermark (HW) là gì?", options: [
        "Offset lớn nhất trên leader",
        "Offset mà mọi replica trong ISR đã có — ranh giới message committed",
        "Dung lượng đĩa tối đa",
        "Offset consumer đã commit"
      ], correct: 1, explanation: "Consumer chỉ đọc được dưới HW." },
    { q: "Leader có LEO=7, ISR follower có LEO 6 và 5. Consumer đọc được tới offset nào?", options: ["6", "4", "5", "7"], correct: 1,
      explanation: "HW = 5 nên đọc được 0..4." },
    { q: "Vì sao consumer không được đọc message nằm trên leader nhưng chưa đủ ISR?", options: [
        "Vì chưa nén",
        "Vì nếu leader chết, leader mới có thể không có message đó — consumer đã thấy một message 'biến mất'",
        "Vì tiết kiệm băng thông",
        "Vì thiếu schema"
      ], correct: 1, explanation: "Giấu tới khi committed giữ cho mọi consumer thấy một lịch sử nhất quán." },
    { q: "Follower bị loại khỏi ISR khi nào (mặc định)?", options: [
        "Chậm 1 message",
        "Không bắt kịp LEO của leader trong replica.lag.time.max.ms (30s)",
        "Đĩa đầy 50%",
        "Consumer lag cao"
      ], correct: 1, explanation: "Tiêu chí theo thời gian, không theo số message (kiểu cũ replica.lag.max.messages đã bỏ)." },
    { q: "Metric UnderReplicatedPartitions > 0 báo hiệu điều gì?", options: [
        "Có partition mà ISR ít hơn số replica", "Consumer chậm", "Topic chưa có dữ liệu", "Controller chết"
      ], correct: 0, explanation: "Nghĩa là biên an toàn đang mỏng đi." },
    { q: "Khi leader chết, leader mới được chọn (mặc định) từ đâu?", options: [
        "Replica bất kỳ", "Replica trong ISR", "Broker có ít partition nhất", "Producer chỉ định"
      ], correct: 1, explanation: "Chọn ngoài ISR là 'unclean' — bài 05." },
    { q: "Leader epoch dùng để làm gì?", options: [
        "Đếm số consumer",
        "Giúp follower biết phải truncate phần đuôi log nào khi leader thay đổi, tránh lệch dữ liệu",
        "Mã hoá dữ liệu",
        "Tính lag"
      ], correct: 1, explanation: "Thay thế cách cũ dựa trên HW vốn có thể gây mất/lệch dữ liệu trong vài kịch bản failover." },
    { q: "Consumer có thể đọc từ follower thay vì leader không?", options: [
        "Không bao giờ",
        "Có, nếu cấu hình rack awareness (client.rack + replica.selector.class) để đọc bản sao gần nhất",
        "Có, mặc định",
        "Chỉ với ZooKeeper"
      ], correct: 1, explanation: "Hữu ích để giảm phí truyền dữ liệu giữa các availability zone." }
  ]
});
