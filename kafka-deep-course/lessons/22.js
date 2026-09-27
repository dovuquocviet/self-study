window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Tích hợp",
  title: "Bảo mật Kafka cơ bản: TLS, SASL, ACL",
  subtitle: "listener & security.protocol · SCRAM / mTLS · ACL theo nguyên tắc tối thiểu · bí mật trong service Rust",

  theory: `
    <p>Kafka mặc định (<code>PLAINTEXT</code>) không mã hoá, không xác thực, không phân quyền: ai nối tới được cổng 9092 là đọc/ghi/xoá topic được.
    Nguyên tắc tổng quát (mạng riêng, tối thiểu quyền, xoay bí mật, audit) đã có trong khoá <em>An toàn bảo mật Database</em>; bài này chỉ phần riêng của Kafka.</p>

    <p><strong>Ba lớp</strong></p>
    <table>
      <tr><th>Lớp</th><th>Kafka dùng</th><th>Cấu hình</th></tr>
      <tr><td>Mã hoá đường truyền</td><td>TLS</td><td><code>security.protocol=SSL</code> hoặc <code>SASL_SSL</code></td></tr>
      <tr><td>Xác thực (bạn là ai)</td><td>mTLS (chứng chỉ client) hoặc SASL: <code>SCRAM-SHA-512</code>, <code>OAUTHBEARER</code>, <code>GSSAPI</code> (Kerberos), <code>PLAIN</code></td><td><code>sasl.mechanism</code></td></tr>
      <tr><td>Phân quyền (được làm gì)</td><td>ACL: principal + thao tác + tài nguyên</td><td><code>authorizer.class.name</code> (KRaft: <code>StandardAuthorizer</code>)</td></tr>
    </table>
    <p><code>SASL_PLAINTEXT</code> gửi thông tin đăng nhập không mã hoá — với PLAIN là lộ mật khẩu nguyên văn. Luôn dùng <code>SASL_SSL</code> ngoài môi trường dev.</p>

    <p><strong>Listener</strong>: broker có thể mở nhiều listener với giao thức khác nhau: vd <code>INTERNAL</code> (giữa broker, mTLS), <code>CLIENT</code> (SASL_SSL cho service), <code>CONTROLLER</code>.
    Map bằng <code>listener.security.protocol.map</code>.</p>

    <p><strong>ACL theo nguyên tắc tối thiểu</strong></p>
    <ul>
      <li>Mỗi service một principal riêng (<code>User:order-svc</code>, <code>User:clickhouse-ingest</code>) — không dùng chung tài khoản "app".</li>
      <li>Producer cần <code>WRITE</code> (+ <code>DESCRIBE</code>) trên topic; idempotent producer không cần thêm quyền cluster từ Kafka 3.0 (trước đó cần <code>IDEMPOTENT_WRITE</code>); transactional cần <code>WRITE</code>/<code>DESCRIBE</code> trên <code>TransactionalId</code>.</li>
      <li>Consumer cần <code>READ</code> trên topic <strong>và</strong> <code>READ</code> trên <code>Group</code>.</li>
      <li>Dùng prefix (<code>--resource-pattern-type prefixed</code>) cho họ topic <code>orders.*</code> thay vì wildcard <code>*</code>.</li>
      <li><code>allow.everyone.if.no.acl.found=false</code> (mặc định) — không có ACL là bị từ chối.</li>
    </ul>

    <p><strong>Dữ liệu nhạy cảm trong message</strong>: TLS chỉ bảo vệ trên đường truyền; trên đĩa broker và trong mọi consumer, message là plaintext.
    Không đưa số thẻ, mật khẩu, token vào event; PII cần thiết thì mã hoá trường (field-level) hoặc chỉ mang ID. Nhớ: retention 7 ngày = PII nằm 7 ngày trên nhiều broker × RF.</p>

    <div class="callout"><p>💡 Trong service Rust, mật khẩu SASL lấy từ secret (Kubernetes Secret, Vault) qua biến môi trường — không hard-code, không log <code>ClientConfig</code> ra
    (nó chứa <code>sasl.password</code>). Xoay mật khẩu SCRAM: tạo credential mới, rolling deploy service, rồi xoá credential cũ.</p></div>
  `,

  codeTabs: [
    { id: "broker", label: "① Broker listener", lines: [
      "listeners=INTERNAL://:9093,CLIENT://:9094,CONTROLLER://:9095",
      "advertised.listeners=INTERNAL://b1.internal:9093,CLIENT://b1.kafka.svc:9094",
      "listener.security.protocol.map=INTERNAL:SSL,CLIENT:SASL_SSL,CONTROLLER:SSL",
      "inter.broker.listener.name=INTERNAL",
      "sasl.enabled.mechanisms=SCRAM-SHA-512",
      "ssl.keystore.location=/etc/kafka/tls/broker.p12",
      "authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer",
      "super.users=User:admin"
    ]},
    { id: "acl", label: "② Tạo user & ACL", lines: [
      "# tạo credential SCRAM",
      "kafka-configs.sh --bootstrap-server b1:9094 --command-config admin.properties \\",
      "  --alter --add-config 'SCRAM-SHA-512=[password=...]' \\",
      "  --entity-type users --entity-name clickhouse-ingest",
      "",
      "# consumer: READ topic + READ group",
      "kafka-acls.sh --bootstrap-server b1:9094 --command-config admin.properties --add \\",
      "  --allow-principal User:clickhouse-ingest --operation Read \\",
      "  --topic orders --group clickhouse-orders",
      "",
      "# producer cho họ topic orders.* (prefix)",
      "kafka-acls.sh --bootstrap-server b1:9094 --command-config admin.properties --add \\",
      "  --allow-principal User:order-svc --operation Write --operation Describe \\",
      "  --topic orders --resource-pattern-type prefixed"
    ]},
    { id: "rust", label: "③ Client Rust SASL_SSL", lines: [
      "let consumer: StreamConsumer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", &cfg.brokers)",
      "    .set(\"security.protocol\", \"SASL_SSL\")",
      "    .set(\"sasl.mechanism\", \"SCRAM-SHA-512\")",
      "    .set(\"sasl.username\", &cfg.kafka_user)",
      "    .set(\"sasl.password\", &cfg.kafka_password)     // từ Secret, không hard-code",
      "    .set(\"ssl.ca.location\", \"/etc/kafka/ca.pem\")",
      "    .set(\"group.id\", \"clickhouse-orders\")",
      "    .create()?;",
      "// cần feature \"ssl\" và \"sasl\" của rdkafka"
    ]},
    { id: "java", label: "④ Spring tương đương", lines: [
      "spring.kafka.security.protocol=SASL_SSL",
      "spring.kafka.properties.sasl.mechanism=SCRAM-SHA-512",
      "spring.kafka.properties.sasl.jaas.config=\\",
      "  org.apache.kafka.common.security.scram.ScramLoginModule required \\",
      "  username=\"order-svc\" password=\"${KAFKA_PASSWORD}\";",
      "spring.kafka.ssl.trust-store-location=file:/etc/kafka/truststore.p12"
    ]}
  ],

  stageHtml: `
    <div class="node" id="svc"><div class="nl">🦀 clickhouse-ingest</div><div class="ns">SASL_SSL · SCRAM-SHA-512</div></div>
    <div class="arrow" id="a1">↓ TLS: mã hoá đường truyền</div>
    <div class="node" id="auth"><div class="nl">🔐 Broker xác thực</div><div class="ns">principal = User:clickhouse-ingest</div></div>
    <div class="arrow" id="a2">↓ StandardAuthorizer kiểm ACL</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ READ orders</div><div class="ns">+ READ group clickhouse-orders</div></div>
      <div class="node" id="no"><div class="nl">⛔ WRITE payments</div><div class="ns">không có ACL → từ chối</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Listener tách theo mục đích", tab: "broker", highlight: [1, 3, 4, 5], on: ["auth"],
      desc: "Giữa broker dùng mTLS, client dùng SASL_SSL. Mỗi listener một giao thức." },
    { title: "2 · Client kết nối an toàn", tab: "rust", highlight: [3, 4, 5, 6, 7], on: ["svc", "a1"],
      desc: "TLS mã hoá, SCRAM xác thực mà không gửi mật khẩu nguyên văn. Mật khẩu từ Secret." },
    { title: "3 · Xác định principal", tab: "acl", highlight: [2, 3, 4], on: ["auth"],
      desc: "Mỗi service một user riêng — audit và thu hồi được từng service." },
    { title: "4 · ACL tối thiểu", tab: "acl", highlight: [7, 8, 9], on: ["a2", "ok"],
      desc: "Consumer cần quyền trên cả topic lẫn group. Không có ACL = từ chối." },
    { title: "5 · Mọi thứ khác bị chặn", tab: "broker", highlight: [7, 8], on: ["no"],
      desc: "Chỉ super.users vượt qua ACL. Giữ danh sách này thật ngắn." }
  ],

  quiz: [
    { q: "Mặc định PLAINTEXT của Kafka có gì?", options: [
        "TLS nhưng không xác thực", "Không mã hoá, không xác thực, không phân quyền", "Xác thực nhưng không mã hoá", "Đủ cả ba"
      ], correct: 1, explanation: "Phải cấu hình tường minh." },
    { q: "Vì sao SASL_PLAINTEXT với cơ chế PLAIN là nguy hiểm?", options: [
        "Chậm", "Mật khẩu đi trên mạng không mã hoá", "Không hỗ trợ ACL", "Không hỗ trợ Rust"
      ], correct: 1, explanation: "Dùng SASL_SSL." },
    { q: "Consumer cần những ACL nào tối thiểu?", options: [
        "WRITE topic", "READ topic và READ group", "ALL cluster", "DESCRIBE cluster"
      ], correct: 1, explanation: "Thiếu quyền group sẽ lỗi GROUP_AUTHORIZATION_FAILED." },
    { q: "Authorizer dùng với KRaft là?", options: [
        "AclAuthorizer (ZooKeeper)", "StandardAuthorizer", "Không có", "SimpleAclAuthorizer"
      ], correct: 1, explanation: "ACL được lưu trong metadata log." },
    { q: "Vì sao mỗi service nên có principal riêng?", options: [
        "Bắt buộc bởi Kafka",
        "Để cấp quyền tối thiểu, audit và thu hồi từng service độc lập",
        "Để nhanh hơn",
        "Để giảm partition"
      ], correct: 1, explanation: "Tài khoản dùng chung = không biết ai làm gì." },
    { q: "TLS có bảo vệ dữ liệu nằm trên đĩa broker không?", options: [
        "Có", "Không — chỉ bảo vệ đường truyền; trên đĩa và ở consumer là plaintext", "Chỉ với SCRAM", "Chỉ với mTLS"
      ], correct: 1, explanation: "Không đưa bí mật vào message; mã hoá trường nhạy cảm." },
    { q: "Cấp quyền ghi cho họ topic orders.v1, orders.v2… cách tốt nhất?", options: [
        "Wildcard * cho mọi topic", "ACL prefixed với tiền tố orders", "super.users", "Tắt authorizer"
      ], correct: 1, explanation: "Hẹp nhất mà vẫn tiện." },
    { q: "Xoay mật khẩu SCRAM không downtime?", options: [
        "Đổi mật khẩu rồi restart tất cả cùng lúc",
        "Thêm credential mới (user mới hoặc mật khẩu mới theo kế hoạch), rolling deploy service, rồi xoá cái cũ",
        "Tắt xác thực tạm thời",
        "Không thể"
      ], correct: 1, explanation: "Tránh một khoảng mọi service mất kết nối." },
    { q: "Log ra ClientConfig của rdkafka khi debug có rủi ro gì?", options: [
        "Không có", "Lộ sasl.password trong log", "Làm chậm consumer", "Gây rebalance"
      ], correct: 1, explanation: "Lọc trường bí mật trước khi log." }
  ]
});
