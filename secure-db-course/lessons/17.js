window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "Kafka: bảo mật một cụm stream từ đầu tới cuối",
  subtitle: "Listener + SASL + TLS · authorizer & ACL topic/group · quota · Schema Registry, Connect, REST Proxy, UI không để hở · retention nghĩa là Kafka là kho dữ liệu",

  theory: `
    <p>Kafka hay được coi là "ống dẫn", nhưng thực chất nó là <strong>kho dữ liệu có lịch sử</strong>: mọi message được giữ trên đĩa trong suốt thời gian retention (mặc định 7 ngày, nhiều nơi đặt vài tháng hoặc vĩnh viễn).
    Ai có quyền đọc một topic là đọc được <em>toàn bộ lịch sử</em> của nó từ offset đầu tiên. Bài này gom các bài trước thành một cấu hình Kafka hoàn chỉnh.</p>

    <p><strong>1. Mặc định của Kafka rất "mở"</strong></p>
    <ul>
      <li>Listener <code>PLAINTEXT</code>: không mã hoá, không xác thực — ai kết nối được cũng produce/consume được.</li>
      <li>Không cấu hình authorizer → không có kiểm tra quyền.</li>
      <li>Hệ sinh thái (Schema Registry, Kafka Connect, REST Proxy, các UI quản trị) chạy HTTP riêng, thường không có xác thực nếu không cấu hình.</li>
    </ul>

    <p><strong>2. Checklist cấu hình broker (KRaft)</strong></p>
    <table>
      <tr><th>Hạng mục</th><th>Cấu hình</th><th>Ý nghĩa</th></tr>
      <tr><td>Listener</td><td><code>listeners</code>, <code>listener.security.protocol.map</code> chỉ gồm <code>SASL_SSL</code>/<code>SSL</code></td><td>Không còn đường không mã hoá/không xác thực (bài 03–04)</td></tr>
      <tr><td>Controller</td><td><code>controller.listener.names</code> dùng <code>SSL</code> (mTLS), chỉ nghe mạng nội bộ</td><td>Quorum KRaft chứa metadata cả cụm — bảo vệ như admin</td></tr>
      <tr><td>Xác thực</td><td><code>sasl.enabled.mechanisms=SCRAM-SHA-512</code> (hoặc mTLS / OAUTHBEARER)</td><td>Mỗi service một principal (bài 05)</td></tr>
      <tr><td>Phân quyền</td><td><code>authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer</code>, <code>allow.everyone.if.no.acl.found=false</code></td><td>Không có ACL = từ chối (bài 07)</td></tr>
      <tr><td>Super user</td><td><code>super.users</code> chỉ gồm tài khoản vận hành/broker</td><td>Super user bỏ qua mọi ACL</td></tr>
      <tr><td>Topic</td><td><code>auto.create.topics.enable=false</code>; tạo qua IaC</td><td>Retention, replication, ACL được duyệt (bài 09)</td></tr>
      <tr><td>Giới hạn</td><td><code>message.max.bytes</code>, <code>max.connections.per.ip</code>, quota theo user</td><td>Chống cạn tài nguyên (bài 22)</td></tr>
    </table>

    <p><strong>3. ACL: suy nghĩ theo "principal × thao tác × tài nguyên"</strong></p>
    <ul>
      <li>Producer: <code>Write</code> (+ <code>Describe</code>) trên topic. Nếu dùng transaction: thêm <code>Write</code>/<code>Describe</code> trên <code>transactional-id</code> của nó.</li>
      <li>Consumer: <code>Read</code> trên topic + <code>Read</code> trên consumer group của chính nó. Không cho consumer dùng group của service khác (có thể "cướp" partition hoặc đổi offset).</li>
      <li>Dùng <code>--resource-pattern-type prefixed</code> cho quy ước đặt tên (<code>orders.</code>), tránh ACL trên <code>*</code>.</li>
      <li>Rà soát: <code>kafka-acls.sh --list</code>; tìm ACL với <code>User:*</code> hoặc <code>Host:*</code> rộng bất thường.</li>
    </ul>

    <p><strong>4. Quota — một client không được làm nghẹt cả cụm</strong></p>
    <p>Quota theo user/client-id: <code>producer_byte_rate</code>, <code>consumer_byte_rate</code> (byte/giây), <code>request_percentage</code> (thời gian xử lý của broker),
    <code>controller_mutation_rate</code> (tốc độ tạo/xoá partition). Đặt mặc định cho mọi user rồi nới cho service cần nhiều hơn.</p>

    <p><strong>5. Hệ sinh thái quanh Kafka — nơi hay bị hở nhất</strong></p>
    <table>
      <tr><th>Thành phần</th><th>Rủi ro nếu hở</th><th>Phòng thủ</th></tr>
      <tr><td>Schema Registry</td><td>Sửa/xoá schema → phá hợp đồng dữ liệu của mọi consumer</td><td>HTTPS, xác thực (basic/mTLS/OAuth), phân quyền theo subject, chế độ <code>READONLY</code> cho môi trường không cần ghi</td></tr>
      <tr><td>Kafka Connect REST</td><td>Tạo connector mới đọc/ghi hệ thống khác; xem config connector (có thể chứa mật khẩu)</td><td>Chỉ mạng nội bộ, BasicAuth REST extension hoặc proxy có xác thực; secret qua <em>config provider</em> thay vì ghi thẳng trong config</td></tr>
      <tr><td>REST Proxy</td><td>Produce/consume qua HTTP không cần client Kafka</td><td>Xác thực + chuyển danh tính sang principal Kafka để ACL vẫn áp dụng</td></tr>
      <tr><td>UI quản trị (Kafka UI, AKHQ, Conduktor…)</td><td>Xem mọi message, xoá topic, reset offset qua trình duyệt</td><td>SSO + phân quyền theo vai trò, không public, dùng principal Kafka chỉ đọc cho người xem</td></tr>
    </table>

    <p><strong>6. Retention = Kafka là kho dữ liệu</strong></p>
    <ul>
      <li>Mỗi topic có chủ sở hữu, phân loại dữ liệu (có PII không?) và <code>retention.ms</code> phù hợp — không để mặc định "vì tiện" hay đặt <code>-1</code> (vĩnh viễn) khi không cần.</li>
      <li>Topic <code>compact</code> giữ giá trị mới nhất của mỗi key vô thời hạn → xoá bằng tombstone (bài 15).</li>
      <li>Đĩa broker và tiered storage được mã hoá (bài 13); field nhạy cảm mã hoá end-to-end ở producer (bài 14).</li>
      <li>Quyền <code>Read</code> trên topic PII = quyền đọc toàn bộ lịch sử PII → cấp như cấp quyền đọc bảng khách hàng.</li>
    </ul>

    <div class="callout"><p>💡 Kiểm tra nhanh một cụm Kafka: (1) có listener PLAINTEXT nào không? (2) kết nối bằng principal không có ACL có đọc được topic nào không?
    (3) cổng 8081/8083/8082 và UI quản trị có mở mà không cần đăng nhập không? (4) topic nào chứa PII với retention vĩnh viễn?</p></div>
  `,

  codeTabs: [
    { id: "broker", label: "🧱 Broker (KRaft)", lines: [
      "# server.properties",
      "process.roles=broker,controller",
      "listeners=INTERNAL://10.0.1.9:9093,CONTROLLER://10.0.1.9:9094",
      "advertised.listeners=INTERNAL://kafka-1.internal:9093",
      "listener.security.protocol.map=INTERNAL:SASL_SSL,CONTROLLER:SSL",
      "inter.broker.listener.name=INTERNAL",
      "controller.listener.names=CONTROLLER",
      "",
      "sasl.enabled.mechanisms=SCRAM-SHA-512",
      "sasl.mechanism.inter.broker.protocol=SCRAM-SHA-512",
      "ssl.client.auth=required                 # áp cho listener SSL (controller)",
      "",
      "authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer",
      "allow.everyone.if.no.acl.found=false",
      "super.users=User:kafka-admin",
      "",
      "auto.create.topics.enable=false",
      "message.max.bytes=1048588",
      "max.connections.per.ip=200"
    ]},
    { id: "acl", label: "🛂 ACL", lines: [
      "# Producer có transaction",
      "kafka-acls.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties --add \\",
      "  --allow-principal User:orders-svc --operation Write --operation Describe --topic orders.events",
      "kafka-acls.sh ... --add --allow-principal User:orders-svc \\",
      "  --operation Write --operation Describe --transactional-id orders-svc-tx",
      "",
      "# Consumer: đọc topic + đúng group của nó",
      "kafka-acls.sh ... --add --allow-principal User:billing-svc \\",
      "  --operation Read --topic orders.events --group billing-consumer",
      "",
      "# Rà soát",
      "kafka-acls.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties --list",
      "kafka-acls.sh ... --list --principal User:billing-svc"
    ]},
    { id: "quota", label: "🚦 Quota", lines: [
      "# Mặc định cho mọi user",
      "kafka-configs.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties \\",
      "  --alter --entity-type users --entity-default \\",
      "  --add-config 'producer_byte_rate=1048576,consumer_byte_rate=2097152,request_percentage=25'",
      "",
      "# Nới cho service ETL cần thông lượng cao",
      "kafka-configs.sh ... --alter --entity-type users --entity-name etl-loader \\",
      "  --add-config 'consumer_byte_rate=20971520'",
      "",
      "# Giới hạn tốc độ tạo/xoá partition",
      "kafka-configs.sh ... --alter --entity-type users --entity-default \\",
      "  --add-config 'controller_mutation_rate=10'",
      "",
      "kafka-configs.sh ... --describe --entity-type users"
    ]},
    { id: "eco", label: "🧩 Connect & Registry", lines: [
      "# connect-distributed.properties: REST chỉ nội bộ, có TLS và xác thực",
      "listeners=https://10.0.4.10:8443",
      "rest.extension.classes=org.apache.kafka.connect.rest.basic.auth.extension.BasicAuthSecurityRestExtension",
      "# + JAAS: KafkaConnect { PropertyFileLoginModule required file=\"/etc/connect/users.properties\"; }",
      "connector.client.config.override.policy=None",
      "",
      "# Secret trong config connector qua config provider (không ghi thẳng mật khẩu)",
      "config.providers=file",
      "config.providers.file.class=org.apache.kafka.common.config.provider.FileConfigProvider",
      "# trong connector: \"connection.password\": \"${file:/etc/connect/secrets.properties:pg_password}\"",
      "",
      "# Schema Registry (Confluent): HTTPS + basic auth",
      "listeners=https://0.0.0.0:8081",
      "authentication.method=BASIC",
      "authentication.realm=SchemaRegistry",
      "authentication.roles=admin,developer,user"
    ]},
    { id: "ret", label: "🗃️ Retention", lines: [
      "# Topic tạo qua IaC, có retention rõ ràng",
      "kafka-topics.sh --bootstrap-server kafka-1.internal:9093 --command-config admin.properties \\",
      "  --create --topic orders.events --partitions 12 --replication-factor 3 \\",
      "  --config retention.ms=1209600000 --config min.insync.replicas=2",
      "",
      "# Tìm topic giữ vĩnh viễn",
      "kafka-configs.sh ... --describe --entity-type topics --all | grep 'retention.ms=-1'",
      "",
      "# Topic compacted chứa profile: xoá user = gửi tombstone (value null) cho key đó",
      "produce(topic='customer.profile', key=customer_id, value=null)",
      "",
      "// Quyền Read trên topic PII = đọc được toàn bộ lịch sử từ offset 0"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="prodn"><div class="nl">📤 Producer</div><div class="ns">SASL_SSL · Write topic</div></div>
      <div class="node" id="consn"><div class="nl">📥 Consumer</div><div class="ns">Read topic + group</div></div>
    </div>
    <div class="arrow" id="a1">↓ TLS + SCRAM · quota</div>
    <div class="node" id="brokers"><div class="nl">🧱 Brokers + KRaft controller</div><div class="ns">StandardAuthorizer · deny nếu không có ACL</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="topics"><div class="nl">🗃️ Topic = kho dữ liệu</div><div class="ns">retention · compact · PII</div></div>
      <div class="node" id="ecos"><div class="nl">🧩 Registry · Connect · REST · UI</div><div class="ns">HTTPS · auth · nội bộ</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Listener & controller an toàn", tab: "broker", highlight: [3, 5, 6, 7, 11], on: ["brokers", "a1"],
      desc: "Chỉ <code>SASL_SSL</code> cho client/broker và <code>SSL</code> (mTLS) cho controller. Không có listener PLAINTEXT nào." },
    { title: "2 · Authorizer: mặc định từ chối", tab: "broker", highlight: [9, 10, 13, 14, 15, 17], on: ["brokers"],
      desc: "SCRAM cho từng service; StandardAuthorizer + <code>allow.everyone.if.no.acl.found=false</code>; super user chỉ là tài khoản vận hành." },
    { title: "3 · ACL cho producer/consumer/transaction", tab: "acl", highlight: [3, 5, 9, 12], on: ["prodn", "consn", "brokers"],
      desc: "Producer ghi đúng topic (và transactional-id nếu có). Consumer đọc topic + đúng group của nó. Rà soát bằng <code>--list</code>." },
    { title: "4 · Quota chống 'hàng xóm ồn ào'", tab: "quota", highlight: [3, 4, 7, 8, 12], on: ["prodn", "consn", "a1"],
      desc: "Quota mặc định cho mọi user, nới riêng cho service cần. Giới hạn cả tốc độ tạo/xoá partition." },
    { title: "5 · Connect & Schema Registry không để hở", tab: "eco", highlight: [2, 3, 5, 8, 9, 10, 13, 14], on: ["ecos"],
      desc: "REST nội bộ + TLS + xác thực; secret qua config provider để GET config không lộ mật khẩu; Registry có HTTPS và auth." },
    { title: "6 · Retention: Kafka là kho dữ liệu", tab: "ret", highlight: [4, 7, 10, 12], on: ["topics"],
      desc: "Retention rõ ràng cho mọi topic; tìm topic giữ vĩnh viễn; xoá trên topic compact bằng tombstone. Read topic PII = đọc toàn bộ lịch sử." }
  ],

  quiz: [
    { q: "Vì sao nói Kafka là 'kho dữ liệu' chứ không chỉ là ống dẫn?", options: [
        "Message được giữ trên đĩa suốt thời gian retention; ai có quyền Read topic đọc được toàn bộ lịch sử",
        "Vì Kafka có SQL",
        "Vì Kafka thay thế được Postgres",
        "Vì Kafka nén dữ liệu"
      ], correct: 0,
      explanation: "Cần phân loại dữ liệu, retention và quyền đọc như với bảng DB." },
    { q: "allow.everyone.if.no.acl.found=true có nghĩa là gì?", options: [
        "Mọi resource đều bị khoá",
        "Chỉ super user truy cập được",
        "Resource chưa có ACL nào sẽ mở cho tất cả principal",
        "Bật TLS"
      ], correct: 2,
      explanation: "Phải đặt false để có deny-by-default." },
    { q: "Consumer billing-svc cần quyền gì trên consumer group?", options: [
        "Không cần quyền gì",
        "Read trên group của chính nó (billing-consumer), không trên group của service khác",
        "Alter trên mọi group",
        "Delete trên group"
      ], correct: 1,
      explanation: "Dùng group của service khác có thể chiếm partition hoặc thay đổi offset của họ." },
    { q: "Kafka Connect REST API mở không xác thực. Kẻ trong mạng có thể làm gì?", options: [
        "Không làm được gì",
        "Chỉ restart broker",
        "Chỉ xem số partition",
        "Tạo connector mới đọc/ghi hệ thống khác và xem config connector (có thể chứa mật khẩu)"
      ], correct: 3,
      explanation: "Giới hạn mạng, bật xác thực, dùng config provider cho secret." },
    { q: "Quota 'request_percentage' giới hạn điều gì?", options: [
        "Số topic",
        "Kích thước message",
        "Tỷ lệ thời gian xử lý của broker mà một user/client được dùng",
        "Số consumer group"
      ], correct: 2,
      explanation: "Cùng với producer_byte_rate/consumer_byte_rate chống một client làm nghẹt cả cụm." },
    { q: "Vì sao dùng config provider (ví dụ FileConfigProvider) cho mật khẩu trong connector?", options: [
        "Config connector có thể đọc qua REST API; dùng tham chiếu thay vì ghi thẳng mật khẩu giúp không lộ secret",
        "Để connector chạy nhanh hơn",
        "Vì Connect không nhận mật khẩu",
        "Để mã hoá message"
      ], correct: 0,
      explanation: "Secret được giải ra lúc chạy trên worker, không nằm trong config lưu ở topic nội bộ." },
    { q: "Topic compacted chứa profile khách hàng. Xoá dữ liệu một khách thế nào?", options: [
        "Không xoá được",
        "Xoá topic",
        "Giảm retention.ms về 0",
        "Gửi tombstone (key = id khách, value null) để compaction loại bỏ giá trị cũ"
      ], correct: 3,
      explanation: "Compaction giữ giá trị mới nhất vô thời hạn; tombstone đánh dấu xoá key." },
    { q: "UI quản trị Kafka (AKHQ, Kafka UI…) nên được triển khai thế nào?", options: [
        "Public để team dễ dùng",
        "Sau SSO + phân quyền theo vai trò, không public, dùng principal Kafka chỉ đọc cho người xem",
        "Dùng super user để tránh lỗi quyền",
        "Không cần bảo vệ vì chỉ là UI"
      ], correct: 1,
      explanation: "UI có thể xem mọi message, xoá topic, reset offset." },
    { q: "Controller listener của KRaft nên được bảo vệ ra sao?", options: [
        "SSL (mTLS), chỉ nghe mạng nội bộ — quorum chứa metadata của cả cụm",
        "Dùng PLAINTEXT vì chỉ nội bộ",
        "Mở ra Internet để giám sát",
        "Không cần cấu hình"
      ], correct: 0,
      explanation: "Chiếm được controller tương đương chiếm quyền quản trị cả cụm." }
  ]
});
