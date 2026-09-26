window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Mạng & kết nối",
  title: "Không phơi DB ra Internet",
  subtitle: "Bind address · firewall/security group · private network · bastion & tunnel · mặc định của từng engine",

  theory: `
    <p>Lớp đầu tiên và rẻ nhất: <strong>chỉ những máy thật sự cần mới chạm được tới cổng DB</strong>. Nếu kẻ tấn công không mở nổi kết nối TCP,
    mọi lỗi cấu hình phía sau (mật khẩu yếu, user mặc định…) khó bị khai thác từ xa hơn rất nhiều.</p>

    <p><strong>1. Ba vòng kiểm soát mạng</strong></p>
    <ol>
      <li><strong>Bind address</strong> (trong cấu hình DB): tiến trình DB lắng nghe trên <em>địa chỉ IP nào</em> của máy. <code>127.0.0.1</code> = chỉ trong máy;
        <code>10.0.1.5</code> = chỉ trên card mạng nội bộ; <code>0.0.0.0</code> / <code>*</code> / <code>::</code> = mọi card mạng, kể cả card có IP public.</li>
      <li><strong>Firewall / security group</strong> (hệ điều hành hoặc cloud): gói tin từ IP nào, tới cổng nào được đi qua. Luật đúng: chỉ cho phép <em>subnet/security group của app</em>, không bao giờ <code>0.0.0.0/0</code>.</li>
      <li><strong>Kiến trúc mạng</strong>: DB nằm trong subnet riêng <em>không có route ra Internet</em> (private subnet), không gắn IP public. Người vận hành vào qua bastion, VPN hoặc tunnel có xác thực.</li>
    </ol>
    <p>Ba vòng này độc lập: bind sai nhưng firewall đúng vẫn an toàn tạm thời — nhưng chỉ cần ai đó "mở tạm" firewall để debug là lộ. Phải đúng cả ba.</p>

    <p><strong>2. Mặc định của từng engine</strong> (cài từ gói chính thức; image Docker và dịch vụ managed có thể khác — luôn kiểm tra lại):</p>
    <table>
      <tr><th>Engine</th><th>Cổng</th><th>Tham số bind</th><th>Mặc định</th><th>Ghi chú</th></tr>
      <tr><td>PostgreSQL</td><td>5432</td><td><code>listen_addresses</code> (postgresql.conf)</td><td><code>'localhost'</code></td><td>Còn lớp thứ hai: <code>pg_hba.conf</code> lọc theo IP + database + user</td></tr>
      <tr><td>Redis</td><td>6379</td><td><code>bind</code> (redis.conf)</td><td><code>127.0.0.1 -::1</code></td><td><code>protected-mode yes</code>: nếu không bind và không mật khẩu, chỉ nhận kết nối từ loopback</td></tr>
      <tr><td>Kafka</td><td>9092</td><td><code>listeners</code>, <code>advertised.listeners</code></td><td><code>PLAINTEXT://:9092</code> (mọi interface, không mã hoá)</td><td>Mặc định mở rộng nhất trong nhóm — phải cấu hình tay</td></tr>
      <tr><td>ClickHouse</td><td>8123 (HTTP), 9000 (native)</td><td><code>listen_host</code> (config.xml)</td><td>localhost</td><td>Image Docker thường đặt <code>0.0.0.0</code>; thêm lọc IP theo user bằng <code>&lt;networks&gt;</code></td></tr>
      <tr><td>MongoDB</td><td>27017</td><td><code>net.bindIp</code></td><td><code>localhost</code> (từ bản 3.6)</td><td>Các vụ lộ hàng loạt trước đây phần lớn do bind mọi địa chỉ + chưa bật auth</td></tr>
      <tr><td>Cloudflare D1/KV/R2/DO</td><td>—</td><td>—</td><td>Không có cổng</td><td>Truy cập qua binding của Worker hoặc API (có token). R2 có thể bật public — xem bài 19</td></tr>
    </table>

    <p><strong>3. Bẫy Docker</strong>: <code>docker run -p 5432:5432 postgres</code> publish cổng trên <strong>mọi địa chỉ</strong> của host. Docker tự thêm luật iptables
    riêng, nên luật chặn của <code>ufw</code> nhiều khi <em>không</em> có tác dụng. Hãy viết <code>-p 127.0.0.1:5432:5432</code>, hoặc không publish cổng mà cho app và DB chung một network Docker nội bộ.</p>

    <p><strong>4. Người vận hành vào DB bằng cách nào?</strong></p>
    <ul>
      <li><strong>Bastion + SSH tunnel</strong>: SSH vào một máy trung gian (đã hardening, có MFA), chuyển tiếp cổng tới DB. DB không cần mở ra ngoài.</li>
      <li><strong>Cloud port-forwarding</strong> (ví dụ AWS SSM Session Manager): không cần mở cổng SSH, có log phiên.</li>
      <li><strong>Zero-trust tunnel</strong> (ví dụ Cloudflare Tunnel + Access): kết nối đi <em>ra</em> từ mạng riêng, người dùng xác thực qua SSO trước khi tới được DB.</li>
      <li><strong>Cloudflare Hyperdrive</strong> cũng có thể kết nối Worker tới Postgres/MySQL nằm trong mạng riêng qua Cloudflare Tunnel — DB không cần IP public.</li>
    </ul>

    <p><strong>5. Kafka: đừng quên <code>advertised.listeners</code></strong>. Client kết nối tới broker, broker trả về danh sách địa chỉ để client kết nối tiếp.
    Nếu tách listener nội bộ và bên ngoài, mỗi listener phải có giao thức an toàn riêng (<code>listener.security.protocol.map</code>) — đừng để listener <code>PLAINTEXT</code> nào nghe trên interface public.</p>

    <div class="callout"><p>💡 Kiểm tra thực tế thay vì tin cấu hình: từ một máy <em>ngoài</em> mạng, thử kết nối TCP tới IP/cổng của DB — phải thất bại.
    Từ trong máy DB, dùng <code>ss -ltnp</code> để xem tiến trình đang lắng nghe trên địa chỉ nào. Đưa bước này vào checklist sau mỗi lần đổi hạ tầng.</p></div>
  `,

  codeTabs: [
    { id: "bind", label: "🔌 Bind từng engine", lines: [
      "# PostgreSQL — postgresql.conf",
      "listen_addresses = '10.0.1.5'           # chỉ IP nội bộ, không '*'",
      "",
      "# Redis — redis.conf",
      "bind 127.0.0.1 10.0.1.6",
      "protected-mode yes",
      "",
      "# MongoDB — mongod.conf",
      "net:",
      "  port: 27017",
      "  bindIp: 127.0.0.1,10.0.1.7",
      "",
      "# ClickHouse — config.d/listen.xml",
      "<clickhouse>",
      "    <listen_host>10.0.1.8</listen_host>",
      "</clickhouse>",
      "",
      "# Kafka — server.properties (chỉ listener nội bộ, có mã hoá)",
      "listeners=INTERNAL://10.0.1.9:9093,CONTROLLER://10.0.1.9:9094",
      "advertised.listeners=INTERNAL://kafka-1.internal:9093",
      "listener.security.protocol.map=INTERNAL:SASL_SSL,CONTROLLER:SSL",
      "inter.broker.listener.name=INTERNAL"
    ]},
    { id: "hba", label: "🛡️ pg_hba & networks", lines: [
      "# PostgreSQL — pg_hba.conf (đọc từ trên xuống, luật khớp đầu tiên thắng)",
      "# TYPE   DATABASE  USER         ADDRESS        METHOD",
      "local    all       postgres                    peer",
      "hostssl  shop      app_orders   10.0.1.0/24    scram-sha-256",
      "hostssl  shop      app_report   10.0.2.0/24    scram-sha-256",
      "host     all       all          0.0.0.0/0      reject",
      "host     all       all          ::/0           reject",
      "",
      "# ClickHouse — users.d/app.xml: user chỉ được đăng nhập từ subnet app",
      "<clickhouse><users><app_ro>",
      "    <networks><ip>10.0.2.0/24</ip></networks>",
      "</app_ro></users></clickhouse>",
      "",
      "-- hoặc dạng SQL (SQL-driven access control)",
      "CREATE USER app_ro IDENTIFIED WITH sha256_password BY '<từ secret manager>'",
      "    HOST IP '10.0.2.0/24';"
    ]},
    { id: "fw", label: "🧱 Firewall & Docker", lines: [
      "# Security group của DB (pseudo, kiểu cloud)",
      "inbound:",
      "  - port: 5432   source: sg-app-orders      # theo security group, không theo 0.0.0.0/0",
      "  - port: 5432   source: sg-bastion",
      "outbound: chỉ những gì cần (replication, backup endpoint)",
      "",
      "# Docker: SAI — publish ra mọi địa chỉ, có thể vượt qua ufw",
      "docker run -p 5432:5432 postgres:16",
      "",
      "# Docker: ĐÚNG — chỉ loopback, hoặc không publish",
      "docker run -p 127.0.0.1:5432:5432 postgres:16",
      "docker network create backend",
      "docker run --network backend --name db postgres:16     # app cùng network gọi 'db:5432'",
      "",
      "# Kiểm tra thực tế trên máy DB",
      "ss -ltnp | grep -E '5432|6379|8123|9000|9092|27017'"
    ]},
    { id: "tunnel", label: "🚇 Bastion & tunnel", lines: [
      "# SSH tunnel qua bastion: DB không cần mở ra ngoài",
      "ssh -N -L 15432:db.internal:5432 ops@bastion.example.com",
      "psql 'host=127.0.0.1 port=15432 dbname=shop user=ops_readonly sslmode=verify-full sslrootcert=db-ca.pem'",
      "# lưu ý: với tunnel, hostname trong cert thường không khớp 127.0.0.1",
      "# -> dùng tên đúng qua /etc/hosts hoặc ProxyJump tới máy trong mạng",
      "",
      "# AWS SSM port forwarding (không mở cổng SSH, có log phiên)",
      "aws ssm start-session --target i-0abc123 \\",
      "  --document-name AWS-StartPortForwardingSessionToRemoteHost \\",
      "  --parameters host=db.internal,portNumber=5432,localPortNumber=15432",
      "",
      "# Cloudflare Hyperdrive tới Postgres trong mạng riêng qua Tunnel",
      "# (DB không có IP public; cloudflared chạy trong mạng riêng, kết nối đi ra)",
      "wrangler hyperdrive create shop-db --connection-string='postgres://app:<secret>@db.internal:5432/shop'"
    ]}
  ],

  stageHtml: `
    <div class="node" id="internet"><div class="nl">🌍 Internet</div><div class="ns">bot quét, kẻ tấn công</div></div>
    <div class="arrow" id="a1">↓ bị chặn</div>
    <div class="node" id="fw"><div class="nl">🧱 Firewall / Security group</div><div class="ns">chỉ cho sg-app, sg-bastion</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="app"><div class="nl">🖥️ App (subnet riêng)</div><div class="ns">10.0.1.0/24</div></div>
      <div class="node" id="bastion"><div class="nl">🚪 Bastion / Tunnel</div><div class="ns">MFA, log phiên</div></div>
    </div>
    <div class="arrow" id="a3">↓ chỉ IP nội bộ</div>
    <div class="node" id="dbbind"><div class="nl">🗄️ DB bind 10.0.1.x</div><div class="ns">+ pg_hba / networks theo user</div></div>
  `,
  steps: [
    { title: "1 · Bind vào địa chỉ nội bộ", tab: "bind", highlight: [2, 5, 6, 11, 15, 19], on: ["dbbind"],
      desc: "Mỗi engine có một tham số quyết định lắng nghe ở đâu. Không dùng <code>*</code>/<code>0.0.0.0</code> nếu máy có IP public." },
    { title: "2 · Kafka: listener nào cũng phải an toàn", tab: "bind", highlight: [19, 20, 21, 22], on: ["dbbind", "app"],
      desc: "Mặc định Kafka nghe PLAINTEXT trên mọi interface. Khai báo listener nội bộ rõ ràng và ánh xạ nó sang <code>SASL_SSL</code>." },
    { title: "3 · Lọc thêm theo IP + user", tab: "hba", highlight: [4, 5, 6, 7, 11, 16], on: ["dbbind", "a3"],
      desc: "<code>pg_hba.conf</code> và <code>&lt;networks&gt;</code> của ClickHouse cho phép khoá: user X chỉ được vào từ subnet Y. Luật cuối <code>reject</code> chặn mọi thứ còn lại." },
    { title: "4 · Firewall theo security group", tab: "fw", highlight: [2, 3, 4, 5], on: ["internet", "a1", "fw"],
      desc: "Nguồn cho phép là security group của app/bastion, không phải dải IP rộng. Internet không bao giờ nằm trong danh sách." },
    { title: "5 · Bẫy Docker publish cổng", tab: "fw", highlight: [8, 11, 12, 13, 16], on: ["fw", "dbbind"],
      desc: "<code>-p 5432:5432</code> mở trên mọi địa chỉ và có thể vượt qua ufw. Dùng <code>127.0.0.1:</code> hoặc network nội bộ. Kiểm tra bằng <code>ss -ltnp</code>." },
    { title: "6 · Người vận hành đi qua bastion/tunnel", tab: "tunnel", highlight: [2, 3, 8, 9, 10], on: ["bastion", "a3", "dbbind"],
      desc: "SSH tunnel, SSM port forwarding hay zero-trust tunnel đều cho phép vào DB mà không mở cổng ra ngoài, và để lại log phiên." },
    { title: "7 · Hyperdrive + Tunnel cho Worker", tab: "tunnel", highlight: [12, 13, 14], on: ["app", "dbbind"],
      desc: "Worker trên Cloudflare kết nối Postgres trong mạng riêng qua Hyperdrive + Cloudflare Tunnel, DB vẫn không có IP public." }
  ],

  quiz: [
    { q: "Postgres có listen_addresses = '*' nhưng security group chỉ cho subnet app. Nhận định nào đúng nhất?", options: [
        "An toàn tuyệt đối, không cần sửa gì",
        "Tạm thời an toàn nhờ firewall, nhưng chỉ cần firewall bị nới là lộ — nên sửa bind về IP nội bộ",
        "Không an toàn vì Postgres không hỗ trợ firewall",
        "Phải tắt Postgres ngay"
      ], correct: 1,
      explanation: "Các vòng kiểm soát nên đúng độc lập. Một người 'mở tạm' security group để debug là đủ để lộ DB." },
    { q: "Mặc định (cấu hình gốc) của Kafka về listener là gì?", options: [
        "Chỉ localhost, có TLS",
        "SASL_SSL trên localhost",
        "Tắt hoàn toàn cho tới khi cấu hình",
        "PLAINTEXT trên mọi interface cổng 9092"
      ], correct: 3,
      explanation: "Kafka mặc định mở rộng và không mã hoá — phải tự cấu hình listener nội bộ + SASL_SSL." },
    { q: "Lệnh 'docker run -p 5432:5432 postgres' có rủi ro gì trên máy có IP public?", options: [
        "Không rủi ro, Docker chỉ mở cho localhost",
        "Postgres không chạy được",
        "Cổng được publish trên mọi địa chỉ của host, và luật iptables của Docker có thể vượt qua ufw",
        "Chỉ rủi ro khi dùng Windows"
      ], correct: 2,
      explanation: "Dùng -p 127.0.0.1:5432:5432 hoặc network Docker nội bộ, và kiểm tra lại bằng ss -ltnp / thử kết nối từ ngoài." },
    { q: "Trong pg_hba.conf, dòng 'host all all 0.0.0.0/0 reject' đặt ở CUỐI file có tác dụng gì?", options: [
        "Chặn mọi kết nối không khớp các luật cho phép phía trên (deny by default)",
        "Chặn cả các dòng cho phép phía trên",
        "Không có tác dụng vì Postgres bỏ qua 'reject'",
        "Cho phép mọi kết nối"
      ], correct: 0,
      explanation: "pg_hba.conf dùng luật khớp đầu tiên. Luật reject cuối cùng bắt mọi kết nối còn lại." },
    { q: "Redis 'protected-mode yes' làm gì?", options: [
        "Mã hoá dữ liệu trong RAM",
        "Bật TLS tự động",
        "Chặn lệnh FLUSHALL",
        "Khi Redis không cấu hình bind và không có mật khẩu, chỉ chấp nhận kết nối từ loopback"
      ], correct: 3,
      explanation: "Đây là lưới an toàn cuối cho cấu hình sơ sài. Không được tắt nó như một 'cách sửa lỗi không kết nối được'." },
    { q: "Cách nào để người vận hành truy cập DB trong private subnet mà KHÔNG mở cổng DB ra Internet?", options: [
        "Gắn IP public cho DB trong 5 phút",
        "SSH tunnel qua bastion, SSM port forwarding, hoặc zero-trust tunnel có xác thực",
        "Đổi cổng DB sang số lạ như 54321",
        "Tắt firewall khi cần"
      ], correct: 1,
      explanation: "Đổi cổng không phải bảo mật — bot quét toàn bộ cổng. Tunnel giữ DB trong mạng riêng và để lại log." },
    { q: "ClickHouse '<networks><ip>10.0.2.0/24</ip></networks>' trong định nghĩa user có tác dụng gì?", options: [
        "User đó chỉ được đăng nhập khi kết nối đến từ subnet 10.0.2.0/24",
        "Đổi địa chỉ lắng nghe của server",
        "Mã hoá kết nối từ subnet đó",
        "Giới hạn băng thông"
      ], correct: 0,
      explanation: "Đây là lọc IP theo từng user — lớp bổ sung cho listen_host và firewall." },
    { q: "Vì sao 'đổi cổng DB sang số không phổ biến' không phải biện pháp bảo mật đáng kể?", options: [
        "Vì DB không hỗ trợ đổi cổng",
        "Vì làm chậm DB",
        "Vì công cụ quét có thể quét mọi cổng và nhận diện dịch vụ qua phản hồi",
        "Vì firewall không hỗ trợ cổng lạ"
      ], correct: 2,
      explanation: "Đây là 'security through obscurity' — có thể giảm nhiễu log, nhưng không thay thế bind + firewall + xác thực." },
    { q: "Cloudflare Hyperdrive giúp gì cho lớp mạng?", options: [
        "Mở Postgres ra Internet nhanh hơn",
        "Cho Worker kết nối tới DB (có thể qua Cloudflare Tunnel vào mạng riêng) mà DB không cần IP public",
        "Thay thế hoàn toàn xác thực của Postgres",
        "Tự động tạo RLS"
      ], correct: 1,
      explanation: "Hyperdrive gom kết nối và có thể đi qua Tunnel, giữ DB trong mạng riêng. Xác thực Postgres vẫn cần." }
  ]
});
