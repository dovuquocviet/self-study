window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "Kiến trúc cluster: broker, controller và KRaft",
  subtitle: "Ai giữ metadata · vì sao bỏ ZooKeeper · bootstrap.servers thật sự làm gì",

  theory: `
    <p>Một <strong>cluster Kafka</strong> gồm nhiều tiến trình JVM gọi là <strong>broker</strong>. Mỗi broker giữ một số partition trên đĩa của nó
    và phục vụ đọc/ghi cho các partition mà nó đang làm <em>leader</em> (bài 04). Nhưng phải có ai đó quyết định: partition nào nằm ở broker nào, ai là leader,
    topic có bao nhiêu partition, broker nào đang sống. Đó là <strong>metadata</strong>, và người giữ nó là <strong>controller</strong>.</p>

    <p><strong>Thời ZooKeeper (trước Kafka 4.0)</strong>: metadata nằm trong một cụm ZooKeeper riêng; một broker được bầu làm controller, đọc/ghi ZooKeeper.
    Nhược điểm: phải vận hành 2 hệ thống phân tán; khi controller đổi, nó phải nạp lại toàn bộ metadata từ ZooKeeper — cluster có hàng trăm nghìn partition thì failover mất nhiều giây tới phút.</p>

    <p><strong>KRaft (Kafka Raft)</strong>: metadata trở thành <em>một log Kafka</em> — topic nội bộ <code>__cluster_metadata</code> — được nhân bản giữa một nhóm nhỏ
    <strong>controller</strong> (thường 3 hoặc 5) bằng giao thức đồng thuận Raft.</p>
    <ul>
      <li>Một controller là <strong>active controller</strong> (leader của quorum), các controller còn lại là follower nóng — đã có sẵn metadata trong bộ nhớ, failover gần như tức thì.</li>
      <li>Broker <em>theo dõi</em> (fetch) log metadata này giống như consumer đọc topic, nên luôn có bản sao metadata cục bộ.</li>
      <li>Quorum 3 controller chịu được 1 controller chết; 5 chịu được 2 (cần đa số).</li>
      <li>Mốc: KRaft production-ready từ 3.3; <strong>Kafka 4.0 (2025) bỏ hẳn ZooKeeper</strong>. Cluster ZooKeeper cũ phải migrate sang KRaft ở bản 3.x trước khi lên 4.x.</li>
    </ul>

    <p><strong>process.roles</strong>: một node có thể là <code>broker</code>, <code>controller</code>, hoặc cả hai (<em>combined mode</em> — chỉ nên dùng cho dev/cụm nhỏ).
    Production thường tách: 3 controller nhỏ + N broker.</p>

    <p><strong>Client kết nối thế nào?</strong> <code>bootstrap.servers</code> chỉ là "địa chỉ để hỏi đường". Client gọi một broker bất kỳ trong danh sách, xin <em>metadata</em>
    (topic X có partition nào, leader ở broker nào, địa chỉ <code>advertised.listeners</code> của từng broker), rồi <strong>nối thẳng tới leader</strong> của từng partition.
    Vì vậy <code>advertised.listeners</code> sai (vd trả về <code>localhost</code> trong Docker) là lỗi kinh điển: bootstrap được nhưng gửi message thì treo.</p>

    <table>
      <tr><th>Thành phần</th><th>Việc</th><th>So với Spring/Java quen thuộc</th></tr>
      <tr><td>Broker</td><td>Lưu partition, phục vụ produce/fetch</td><td>Giống một node DB lưu dữ liệu</td></tr>
      <tr><td>Controller (KRaft)</td><td>Giữ metadata, bầu leader partition, theo dõi broker sống/chết</td><td>Giống "master" của cụm, nhưng không nằm trên đường đi của dữ liệu</td></tr>
      <tr><td><code>__cluster_metadata</code></td><td>Log metadata, nhân bản bằng Raft</td><td>Như bảng cấu hình được replicate</td></tr>
      <tr><td><code>__consumer_offsets</code></td><td>Offset đã commit của các group</td><td>Như bảng lưu checkpoint</td></tr>
    </table>

    <div class="callout"><p>💡 Controller <strong>không</strong> nằm trên đường đi của message. Producer/consumer nói chuyện trực tiếp với broker leader.
    Controller chết thì dữ liệu vẫn chảy; chỉ các thay đổi metadata (tạo topic, bầu leader mới) phải đợi controller mới — trong KRaft việc này chỉ mất rất ngắn.</p></div>
  `,

  codeTabs: [
    { id: "ctrl", label: "① controller.properties", lines: [
      "# node chỉ làm controller",
      "process.roles=controller",
      "node.id=1",
      "controller.listener.names=CONTROLLER",
      "listeners=CONTROLLER://ctrl-1:9093",
      "# danh sách quorum (cách tĩnh; Kafka 3.9+ có thêm controller.quorum.bootstrap.servers cho quorum động)",
      "controller.quorum.voters=1@ctrl-1:9093,2@ctrl-2:9093,3@ctrl-3:9093",
      "log.dirs=/var/lib/kafka/meta"
    ]},
    { id: "broker", label: "② broker.properties", lines: [
      "process.roles=broker",
      "node.id=101",
      "controller.listener.names=CONTROLLER",
      "controller.quorum.voters=1@ctrl-1:9093,2@ctrl-2:9093,3@ctrl-3:9093",
      "listeners=INTERNAL://0.0.0.0:9092",
      "# địa chỉ broker QUẢNG CÁO cho client — phải là địa chỉ client với tới được",
      "advertised.listeners=INTERNAL://broker-101.kafka.svc:9092",
      "inter.broker.listener.name=INTERNAL",
      "log.dirs=/var/lib/kafka/data"
    ]},
    { id: "boot", label: "③ Client bootstrap", lines: [
      "1. client -> broker-101:9092   : MetadataRequest(topics=[orders])",
      "2. broker-101 trả về:",
      "     orders-0 leader=101  replicas=[101,102,103]",
      "     orders-1 leader=102  replicas=[102,103,101]",
      "     orders-2 leader=103  replicas=[103,101,102]",
      "     brokers: 101=broker-101.kafka.svc:9092, 102=..., 103=...",
      "3. client mở kết nối TRỰC TIẾP tới 101, 102, 103",
      "4. leader đổi (broker chết) -> client nhận lỗi NOT_LEADER -> refresh metadata -> thử lại"
    ]},
    { id: "ops", label: "④ Lệnh xem quorum", lines: [
      "# khởi tạo thư mục log với cluster id (bắt buộc ở KRaft)",
      "kafka-storage.sh random-uuid",
      "kafka-storage.sh format -t <cluster-id> -c controller.properties",
      "",
      "# xem trạng thái quorum: ai là leader, độ trễ của từng voter",
      "kafka-metadata-quorum.sh --bootstrap-server broker-101:9092 describe --status",
      "kafka-metadata-quorum.sh --bootstrap-server broker-101:9092 describe --replication"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="k1"><div class="nl">🧠 Controller 1 (active)</div><div class="ns">leader Raft</div></div>
      <div class="node" id="k2"><div class="nl">🧠 Controller 2</div><div class="ns">follower nóng</div></div>
      <div class="node" id="k3"><div class="nl">🧠 Controller 3</div><div class="ns">follower nóng</div></div>
    </div>
    <div class="arrow" id="a1">↓ broker fetch __cluster_metadata</div>
    <div class="row">
      <div class="node" id="b1"><div class="nl">📦 Broker 101</div><div class="ns">leader orders-0</div></div>
      <div class="node" id="b2"><div class="nl">📦 Broker 102</div><div class="ns">leader orders-1</div></div>
      <div class="node" id="b3"><div class="nl">📦 Broker 103</div><div class="ns">leader orders-2</div></div>
    </div>
    <div class="arrow" id="a2">↑ metadata request · produce/fetch thẳng tới leader</div>
    <div class="node" id="cl"><div class="nl">🦀 Service Rust (rdkafka)</div><div class="ns">bootstrap.servers=broker-101:9092</div></div>
  `,
  steps: [
    { title: "1 · Quorum controller", tab: "ctrl", highlight: [2, 7], on: ["k1", "k2", "k3"],
      desc: "3 controller chạy Raft. Một active controller ghi thay đổi metadata vào __cluster_metadata; hai follower có sẵn bản sao để thay thế ngay." },
    { title: "2 · Broker theo dõi metadata", tab: "broker", highlight: [1, 4], on: ["a1", "b1", "b2", "b3"],
      desc: "Broker không tự quyết ai là leader; nó đọc log metadata từ controller và áp dụng." },
    { title: "3 · advertised.listeners", tab: "broker", highlight: [6, 7], on: ["b1"],
      desc: "Đây là địa chỉ broker nói với client 'hãy gọi tôi ở đây'. Sai chỗ này thì client bootstrap được nhưng không gửi/nhận được." },
    { title: "4 · Client hỏi đường", tab: "boot", highlight: [1, 2, 3, 4, 5, 6], on: ["cl", "a2"],
      desc: "bootstrap.servers chỉ dùng cho lần hỏi metadata đầu tiên; nên liệt kê 2–3 broker để một cái chết vẫn hỏi được." },
    { title: "5 · Nói thẳng với leader", tab: "boot", highlight: [7, 8], on: ["b1", "b2", "b3", "cl"],
      desc: "Mỗi partition đi tới đúng broker leader. Leader đổi → client nhận NOT_LEADER, tự làm mới metadata và thử lại." },
    { title: "6 · Vận hành quorum", tab: "ops", highlight: [3, 6], on: ["k1"],
      desc: "KRaft yêu cầu format thư mục log với cluster id. describe --status cho biết leader quorum và độ trễ follower." }
  ],

  quiz: [
    { q: "Trong KRaft, metadata của cluster được lưu ở đâu?", options: [
        "ZooKeeper", "Topic nội bộ __cluster_metadata, nhân bản giữa các controller bằng Raft", "File cấu hình của từng broker", "__consumer_offsets"
      ], correct: 1, explanation: "Metadata trở thành một log; controller đồng thuận bằng Raft." },
    { q: "Phiên bản nào bỏ hoàn toàn ZooKeeper?", options: ["2.8", "3.3", "4.0", "Chưa bỏ"], correct: 2,
      explanation: "2.8 có KRaft thử nghiệm, 3.3 production-ready, 4.0 bỏ hẳn chế độ ZooKeeper." },
    { q: "Quorum 3 controller chịu được tối đa mấy controller chết mà vẫn hoạt động?", options: ["0", "1", "2", "3"], correct: 1,
      explanation: "Raft cần đa số (2/3) còn sống." },
    { q: "bootstrap.servers dùng để làm gì?", options: [
        "Mọi message đều đi qua các broker này",
        "Chỉ để lấy metadata ban đầu; sau đó client nối thẳng tới leader từng partition",
        "Chỉ định controller",
        "Chỉ định broker lưu offset"
      ], correct: 1, explanation: "Nên liệt kê vài broker để tránh điểm lỗi đơn lúc khởi động." },
    { q: "Client bootstrap thành công nhưng gửi message bị timeout, log thấy client cố nối tới 'localhost:9092'. Nguyên nhân khả dĩ nhất?", options: [
        "Sai acks", "advertised.listeners của broker trả về địa chỉ client không với tới được", "Topic chưa tạo", "Sai serializer"
      ], correct: 1, explanation: "Metadata chứa địa chỉ quảng cáo của broker; client dùng đúng địa chỉ đó." },
    { q: "Active controller chết. Điều gì xảy ra với việc produce/consume đang diễn ra?", options: [
        "Dừng toàn bộ tới khi controller sống lại",
        "Vẫn chạy vì dữ liệu đi thẳng tới broker leader; controller mới được bầu nhanh",
        "Mất dữ liệu",
        "Consumer bị reset offset"
      ], correct: 1, explanation: "Controller không nằm trên data path." },
    { q: "Vì sao failover controller trong KRaft nhanh hơn thời ZooKeeper?", options: [
        "Vì dùng UDP",
        "Controller follower đã có sẵn metadata trong bộ nhớ, không phải nạp lại toàn bộ từ ZooKeeper",
        "Vì ít partition hơn",
        "Vì không cần bầu"
      ], correct: 1, explanation: "Đó là động lực chính của KRaft cùng với việc bỏ một hệ thống phải vận hành." },
    { q: "process.roles=broker,controller (combined mode) phù hợp khi nào?", options: [
        "Cluster production lớn", "Dev/test hoặc cụm rất nhỏ", "Không bao giờ được phép", "Chỉ khi dùng ZooKeeper"
      ], correct: 1, explanation: "Production nên tách controller để tải broker không ảnh hưởng quorum." },
    { q: "Leader của partition orders-1 chuyển từ broker 102 sang 103. Producer biết bằng cách nào?", options: [
        "Controller gửi email",
        "Request tới 102 trả lỗi NOT_LEADER_OR_FOLLOWER → client làm mới metadata và gửi lại tới 103",
        "Producer phải khởi động lại",
        "Không biết, message bị mất"
      ], correct: 1, explanation: "Đây cũng là lý do producer cần retries (bài 08)." }
  ]
});
