window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Mạng & kết nối",
  title: "TLS cho kết nối Database",
  subtitle: "Mã hoá chưa đủ — phải kiểm tra server là ai (verify-full) · mTLS · cấu hình trên Postgres, Redis, Kafka, ClickHouse, Mongo, Hyperdrive",

  theory: `
    <p>Kết nối DB mang theo những thứ quý nhất: <strong>mật khẩu</strong> lúc đăng nhập, <strong>câu truy vấn</strong> và <strong>kết quả</strong> (có khi là cả bảng khách hàng).
    Nếu kết nối không mã hoá, bất kỳ ai đứng giữa đường truyền — một máy khác trong cùng mạng, một switch bị chiếm, một đường nối liên vùng — đều đọc được.
    "Mạng nội bộ nên không cần TLS" là giả định sai: nhiều sự cố bắt đầu từ một máy bên trong đã bị chiếm.</p>

    <p><strong>1. TLS làm hai việc — và việc thứ hai hay bị quên</strong></p>
    <ul>
      <li><strong>Mã hoá</strong>: người nghe lén chỉ thấy byte vô nghĩa.</li>
      <li><strong>Xác thực server</strong>: client kiểm tra chứng chỉ của server được ký bởi CA mình tin, và <em>tên máy khớp</em> với tên trong chứng chỉ.
        Thiếu bước này, kẻ đứng giữa (man-in-the-middle) chỉ cần tự tạo một chứng chỉ bất kỳ, giả làm DB, nhận mật khẩu của bạn rồi chuyển tiếp.</li>
    </ul>
    <p>Vì vậy "đã bật TLS" chưa đủ. Câu hỏi đúng là: <strong>client có kiểm tra chứng chỉ server không?</strong></p>

    <p><strong>2. Các mức sslmode của PostgreSQL (libpq) — thang đo dễ hiểu nhất</strong></p>
    <table>
      <tr><th>sslmode</th><th>Mã hoá</th><th>Kiểm tra CA</th><th>Kiểm tra tên máy</th><th>Chống MITM?</th></tr>
      <tr><td><code>disable</code></td><td>❌</td><td>❌</td><td>❌</td><td>❌</td></tr>
      <tr><td><code>prefer</code> (mặc định libpq)</td><td>nếu server hỗ trợ</td><td>❌</td><td>❌</td><td>❌ (có thể bị hạ cấp về không mã hoá)</td></tr>
      <tr><td><code>require</code></td><td>✅</td><td>❌*</td><td>❌</td><td>❌</td></tr>
      <tr><td><code>verify-ca</code></td><td>✅</td><td>✅</td><td>❌</td><td>một phần</td></tr>
      <tr><td><code>verify-full</code></td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
    </table>
    <p>* Với libpq, nếu có sẵn file root CA thì <code>require</code> sẽ kiểm tra CA như <code>verify-ca</code>; đừng dựa vào hành vi ngầm này — ghi rõ <code>verify-full</code>.
    Các engine khác có "núm" tương đương: Kafka <code>ssl.endpoint.identification.algorithm=https</code> (mặc định, đừng đặt rỗng),
    Mongo <em>đừng</em> dùng <code>tlsAllowInvalidCertificates</code>/<code>tlsInsecure</code>, driver Node đừng đặt <code>rejectUnauthorized: false</code>.</p>

    <p><strong>3. Phía server: bắt buộc TLS, không chỉ "hỗ trợ"</strong></p>
    <table>
      <tr><th>Engine</th><th>Bật TLS</th><th>Bắt buộc TLS (đóng cổng rõ)</th></tr>
      <tr><td>PostgreSQL</td><td><code>ssl = on</code>, <code>ssl_cert_file</code>, <code>ssl_key_file</code></td><td>dùng <code>hostssl</code> trong pg_hba, không có dòng <code>host</code> cho phép; <code>ssl_min_protocol_version = 'TLSv1.2'</code></td></tr>
      <tr><td>Redis (≥ 6)</td><td><code>tls-port</code>, <code>tls-cert-file</code>, <code>tls-key-file</code>, <code>tls-ca-cert-file</code></td><td><code>port 0</code> để tắt cổng thường; <code>tls-replication yes</code>, <code>tls-cluster yes</code></td></tr>
      <tr><td>Kafka</td><td>listener <code>SSL</code> hoặc <code>SASL_SSL</code> + keystore/truststore</td><td>không khai báo listener <code>PLAINTEXT</code>/<code>SASL_PLAINTEXT</code></td></tr>
      <tr><td>ClickHouse</td><td><code>https_port</code> 8443, <code>tcp_port_secure</code> 9440, khối <code>&lt;openSSL&gt;</code></td><td>bỏ <code>http_port</code>/<code>tcp_port</code> khỏi cấu hình</td></tr>
      <tr><td>MongoDB</td><td><code>net.tls.certificateKeyFile</code>, <code>CAFile</code></td><td><code>net.tls.mode: requireTLS</code></td></tr>
      <tr><td>Cloudflare</td><td>Binding D1/KV/R2/DO đi trong mạng Cloudflare; API/S3 endpoint chỉ HTTPS</td><td>Hyperdrive → DB gốc: đặt <code>sslmode verify-full</code> + CA riêng (và mTLS nếu cần)</td></tr>
    </table>

    <p><strong>4. mTLS — client cũng trình chứng chỉ</strong>. Server kiểm tra chứng chỉ client do CA nội bộ cấp. Lợi ích: kẻ tấn công lấy được mật khẩu
    nhưng không có private key của client vẫn không vào được; hoặc dùng chính chứng chỉ làm danh tính (Postgres <code>cert</code>, Mongo <code>MONGODB-X509</code>, Kafka principal từ CN).
    Cái giá: phải vận hành CA, phát hành, xoay vòng và thu hồi chứng chỉ.</p>

    <p><strong>5. Chứng chỉ cũng là bí mật cần vận hành</strong></p>
    <ul>
      <li>Private key của server/client: quyền file <code>600</code>, chủ sở hữu là user chạy DB; không commit vào git; không đưa vào image.</li>
      <li>Đặt lịch gia hạn trước khi hết hạn (chứng chỉ hết hạn = sự cố mất kết nối toàn hệ thống).</li>
      <li>Dùng TLS 1.2 trở lên; tắt các phiên bản cũ.</li>
    </ul>

    <div class="callout"><p>💡 Cách kiểm tra nhanh: trỏ client tới DB bằng một tên máy <em>khác</em> với tên trong chứng chỉ (ví dụ dùng IP). Nếu kết nối vẫn thành công,
    client của bạn <strong>không</strong> kiểm tra tên máy → vẫn có thể bị MITM.</p></div>
  `,

  codeTabs: [
    { id: "pg", label: "🐘 PostgreSQL", lines: [
      "# postgresql.conf",
      "ssl = on",
      "ssl_cert_file = '/etc/postgresql/tls/server.crt'",
      "ssl_key_file  = '/etc/postgresql/tls/server.key'     # chmod 600, owner postgres",
      "ssl_ca_file   = '/etc/postgresql/tls/client-ca.crt'  # để kiểm tra cert client (mTLS)",
      "ssl_min_protocol_version = 'TLSv1.2'",
      "",
      "# pg_hba.conf — chỉ hostssl; mTLS + mật khẩu cho app",
      "hostssl shop app_orders 10.0.1.0/24 scram-sha-256 clientcert=verify-full",
      "host    all  all        0.0.0.0/0   reject",
      "",
      "# Client (connection string)",
      "postgresql://app_orders@db.internal:5432/shop?sslmode=verify-full&sslrootcert=/etc/ssl/db-ca.pem",
      "",
      "// Node (pg) — SAI vs ĐÚNG",
      "ssl: { rejectUnauthorized: false }                     // ❌ tắt kiểm tra cert",
      "ssl: { ca: readFile('/etc/ssl/db-ca.pem'), rejectUnauthorized: true }  // ✅"
    ]},
    { id: "redis", label: "🟥 Redis", lines: [
      "# redis.conf — chỉ TLS",
      "port 0                                   # tắt cổng không mã hoá",
      "tls-port 6379",
      "tls-cert-file /etc/redis/tls/redis.crt",
      "tls-key-file  /etc/redis/tls/redis.key",
      "tls-ca-cert-file /etc/redis/tls/ca.crt",
      "tls-auth-clients yes                     # yêu cầu cert client (mTLS)",
      "tls-protocols \"TLSv1.2 TLSv1.3\"",
      "tls-replication yes",
      "tls-cluster yes",
      "",
      "# Client",
      "redis-cli --tls --cacert ca.crt --cert client.crt --key client.key -h redis.internal",
      "rediss://app_cache:<secret>@redis.internal:6379/0     # 'rediss' = có TLS"
    ]},
    { id: "kafka", label: "📨 Kafka", lines: [
      "# server.properties (broker)",
      "listeners=INTERNAL://10.0.1.9:9093",
      "listener.security.protocol.map=INTERNAL:SASL_SSL",
      "ssl.keystore.location=/etc/kafka/tls/broker.keystore.p12",
      "ssl.keystore.type=PKCS12",
      "ssl.truststore.location=/etc/kafka/tls/truststore.p12",
      "ssl.truststore.type=PKCS12",
      "ssl.enabled.protocols=TLSv1.3,TLSv1.2",
      "ssl.client.auth=required                # mTLS; 'none' nếu chỉ dùng SASL",
      "",
      "# client.properties",
      "security.protocol=SASL_SSL",
      "ssl.truststore.location=/etc/app/truststore.p12",
      "ssl.endpoint.identification.algorithm=https   # mặc định; KHÔNG đặt rỗng"
    ]},
    { id: "ch", label: "🟨 ClickHouse & Mongo", lines: [
      "<!-- ClickHouse config.d/tls.xml: chỉ mở cổng bảo mật -->",
      "<clickhouse>",
      "    <https_port>8443</https_port>",
      "    <tcp_port_secure>9440</tcp_port_secure>",
      "    <openSSL><server>",
      "        <certificateFile>/etc/clickhouse-server/tls/server.crt</certificateFile>",
      "        <privateKeyFile>/etc/clickhouse-server/tls/server.key</privateKeyFile>",
      "        <caConfig>/etc/clickhouse-server/tls/ca.crt</caConfig>",
      "    </server></openSSL>",
      "</clickhouse>",
      "<!-- và xoá http_port / tcp_port khỏi config.xml -->",
      "clickhouse-client --secure --host ch.internal --port 9440",
      "",
      "# MongoDB mongod.conf",
      "net:",
      "  tls:",
      "    mode: requireTLS",
      "    certificateKeyFile: /etc/mongo/tls/server.pem",
      "    CAFile: /etc/mongo/tls/ca.pem",
      "# client: KHÔNG dùng tlsAllowInvalidCertificates / tlsInsecure",
      "mongodb://db.internal:27017/?tls=true&tlsCAFile=/etc/ssl/ca.pem"
    ]},
    { id: "hd", label: "☁️ Hyperdrive", lines: [
      "# Hyperdrive nói chuyện với Postgres gốc: bắt kiểm tra cert server",
      "wrangler cert upload certificate-authority --ca-cert db-ca.pem --name shop-db-ca",
      "wrangler hyperdrive create shop-db \\",
      "  --connection-string='postgres://app:<secret>@db.example.com:5432/shop' \\",
      "  --ca-certificate-id <id-ca-vua-upload> --sslmode verify-full",
      "",
      "# mTLS: Hyperdrive trình cert client cho Postgres",
      "wrangler cert upload mtls-certificate --cert hd-client.pem --key hd-client.key --name shop-hd",
      "wrangler hyperdrive update <hyperdrive-id> --mtls-certificate-id <id-cert>",
      "",
      "# D1 / KV / R2 / Durable Objects qua binding: không cấu hình TLS thủ công",
      "# R2 qua S3 API: luôn dùng endpoint https://<account>.r2.cloudflarestorage.com"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="client"><div class="nl">🖥️ Client / App</div><div class="ns">có CA để kiểm tra server</div></div>
      <div class="node" id="mitm"><div class="nl">🕵️ Kẻ đứng giữa</div><div class="ns">giả làm DB bằng cert tự tạo</div></div>
    </div>
    <div class="arrow" id="a1">↓ TLS handshake</div>
    <div class="node" id="verify"><div class="nl">🔎 Kiểm tra cert server</div><div class="ns">ký bởi CA tin cậy? tên máy khớp?</div></div>
    <div class="arrow" id="a2">↓ (mTLS) server kiểm tra cert client</div>
    <div class="node" id="server"><div class="nl">🗄️ DB server</div><div class="ns">chỉ mở cổng TLS · TLS ≥ 1.2</div></div>
    <div class="arrow" id="a3">↓ kênh mã hoá</div>
    <div class="node" id="chan"><div class="nl">🔒 Mật khẩu, truy vấn, kết quả</div><div class="ns">không ai đọc/sửa được trên đường</div></div>
  `,
  steps: [
    { title: "1 · Server: bật và bắt buộc TLS", tab: "pg", highlight: [2, 3, 4, 6, 9, 10], on: ["server"],
      desc: "Bật <code>ssl</code> chưa đủ: pg_hba chỉ có <code>hostssl</code>, và luật <code>reject</code> ở cuối chặn mọi kết nối không mã hoá." },
    { title: "2 · Client: verify-full, không phải require", tab: "pg", highlight: [13, 16, 17], on: ["client", "a1", "verify"],
      desc: "<code>verify-full</code> kiểm tra CA <em>và</em> tên máy. <code>rejectUnauthorized: false</code> là lỗi kinh điển khiến TLS mất tác dụng chống MITM." },
    { title: "3 · Vì sao phải kiểm tra tên máy", tab: "pg", highlight: [13], on: ["mitm", "verify"],
      desc: "Không kiểm tra cert, kẻ đứng giữa trình một cert tự tạo, nhận mật khẩu của bạn rồi chuyển tiếp tới DB thật — bạn không hề biết." },
    { title: "4 · Redis: tắt cổng thường, dùng rediss://", tab: "redis", highlight: [2, 3, 7, 9, 10, 14], on: ["server", "chan"],
      desc: "<code>port 0</code> đóng cổng không mã hoá. Nhớ bật TLS cho replication và cluster bus, nếu không dữ liệu vẫn đi rõ giữa các node." },
    { title: "5 · Kafka: SASL_SSL + kiểm tra hostname", tab: "kafka", highlight: [3, 9, 12, 14], on: ["client", "verify", "server"],
      desc: "Listener ánh xạ sang <code>SASL_SSL</code>. Phía client, <code>ssl.endpoint.identification.algorithm=https</code> là mặc định — đừng tắt để 'chữa' lỗi cert." },
    { title: "6 · ClickHouse & Mongo", tab: "ch", highlight: [3, 4, 11, 17, 20, 21], on: ["server", "verify"],
      desc: "ClickHouse chỉ mở 8443/9440; Mongo dùng <code>requireTLS</code>. Không dùng tuỳ chọn 'allow invalid certificates' ở client." },
    { title: "7 · Hyperdrive tới DB gốc", tab: "hd", highlight: [2, 5, 8, 9], on: ["a2", "server", "chan"],
      desc: "Upload CA và đặt <code>verify-full</code> để Hyperdrive kiểm tra Postgres gốc; thêm cert mTLS nếu DB yêu cầu. Binding D1/KV/R2 không cần cấu hình TLS thủ công." }
  ],

  quiz: [
    { q: "Client Postgres dùng sslmode=require. Nó có chống được man-in-the-middle không?", options: [
        "Có, vì kết nối đã mã hoá",
        "Chỉ khi dùng IPv6",
        "Có, nếu mật khẩu dài",
        "Không chắc chắn — require không kiểm tra tên máy; cần verify-full"
      ], correct: 3,
      explanation: "Mã hoá với một kẻ giả mạo vẫn là mã hoá. verify-full kiểm tra cả CA lẫn hostname." },
    { q: "Dòng code 'ssl: { rejectUnauthorized: false }' trong driver Node có tác dụng gì?", options: [
        "Tăng tốc kết nối, không ảnh hưởng bảo mật",
        "Bật mTLS",
        "Tắt việc kiểm tra chứng chỉ server — TLS vẫn mã hoá nhưng không biết mình đang nói chuyện với ai",
        "Chặn các client không có chứng chỉ"
      ], correct: 2,
      explanation: "Đây là cách 'sửa nhanh' lỗi cert phổ biến nhất và cũng là lỗ hổng phổ biến nhất. Hãy cung cấp CA đúng thay vì tắt kiểm tra." },
    { q: "Trên Redis, 'port 0' kết hợp 'tls-port 6379' nghĩa là gì?", options: [
        "Tắt cổng không mã hoá, chỉ nhận kết nối TLS trên 6379",
        "Redis chạy trên cổng ngẫu nhiên",
        "Redis không chạy",
        "Chỉ nhận kết nối từ localhost"
      ], correct: 0,
      explanation: "Không chỉ bật TLS mà còn đóng đường không mã hoá — tránh client vô tình kết nối rõ." },
    { q: "Vì sao 'DB nằm trong mạng nội bộ nên không cần TLS' là giả định sai?", options: [
        "Vì TLS là bắt buộc theo luật ở mọi nước",
        "Vì DB không chạy được nếu thiếu TLS",
        "Vì mạng nội bộ luôn chậm",
        "Vì một máy trong mạng bị chiếm có thể nghe lén/giả mạo; lưu lượng nội bộ chứa mật khẩu và dữ liệu nhạy cảm"
      ], correct: 3,
      explanation: "Assume breach: kẻ tấn công thường đã ở trong mạng. TLS bảo vệ dữ liệu trên đường truyền kể cả trong VPC." },
    { q: "Lợi ích chính của mTLS so với TLS một chiều là gì?", options: [
        "Mã hoá mạnh hơn",
        "Server kiểm tra được client có chứng chỉ hợp lệ — lấy được mật khẩu thôi chưa đủ để kết nối",
        "Truyền nhanh hơn",
        "Không cần mật khẩu nữa trong mọi trường hợp"
      ], correct: 1,
      explanation: "mTLS thêm một yếu tố (private key của client). Có thể dùng cert làm danh tính, hoặc kết hợp với mật khẩu." },
    { q: "Kafka client đặt 'ssl.endpoint.identification.algorithm=' (rỗng). Hậu quả?", options: [
        "Tắt kiểm tra hostname của broker — mở đường cho MITM",
        "Kafka bật mTLS",
        "Kafka từ chối kết nối",
        "Không ảnh hưởng gì"
      ], correct: 0,
      explanation: "Giá trị mặc định là https (kiểm tra hostname). Đặt rỗng thường là 'sửa nhanh' lỗi cert và làm hỏng bảo mật." },
    { q: "Để Cloudflare Hyperdrive kiểm tra chứng chỉ của Postgres gốc, cần làm gì?", options: [
        "Không làm được, Hyperdrive luôn dùng sslmode=disable",
        "Đặt mật khẩu dài hơn",
        "Upload CA bằng wrangler cert upload certificate-authority và cấu hình Hyperdrive với --sslmode verify-full",
        "Bật R2 public"
      ], correct: 2,
      explanation: "Hyperdrive hỗ trợ CA tuỳ chỉnh và verify-full; thêm mTLS certificate nếu DB yêu cầu cert client." },
    { q: "Cách kiểm tra nhanh xem client có thực sự kiểm tra hostname không?", options: [
        "Xem CPU của DB",
        "Kết nối bằng một tên máy/IP không có trong chứng chỉ — nếu vẫn thành công thì client không kiểm tra hostname",
        "Đổi mật khẩu DB",
        "Tắt TLS trên server"
      ], correct: 1,
      explanation: "Client đúng phải từ chối khi tên không khớp. Thành công = đang ở chế độ không kiểm tra." },
    { q: "Private key TLS của server DB nên được lưu thế nào?", options: [
        "Commit vào repo để dễ triển khai",
        "Nhúng vào Docker image",
        "Chia sẻ qua chat nhóm",
        "File quyền 600, owner là user chạy DB, cấp phát từ secret manager, không commit/không đưa vào image"
      ], correct: 3,
      explanation: "Lộ private key server = kẻ tấn công có thể giả làm DB hoặc giải mã một số lưu lượng." }
  ]
});
