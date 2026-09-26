window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Bề mặt tấn công của một Database",
  subtitle: "Mạng · xác thực · phân quyền · truy vấn · dữ liệu · backup · vận hành — và vì sao hàng chục nghìn DB bị lộ chỉ vì 'không có mật khẩu'",

  theory: `
    <p>Khi nói "bảo mật database", nhiều người chỉ nghĩ tới SQL Injection. Thực tế, một DB — dù là PostgreSQL, Redis, Kafka, ClickHouse, MongoDB
    hay D1/KV/R2 của Cloudflare — có <strong>nhiều cửa</strong> để kẻ xấu đi vào. Tập hợp tất cả các cửa đó gọi là <strong>bề mặt tấn công</strong> (attack surface).
    Bài này vẽ bản đồ các cửa; những bài sau sẽ lần lượt khoá từng cửa.</p>

    <p><strong>1. Bảy vùng của bề mặt tấn công</strong></p>
    <table>
      <tr><th>Vùng</th><th>Câu hỏi cần trả lời</th><th>Ví dụ sai lầm hay gặp</th></tr>
      <tr><td>🌐 Mạng</td><td>Ai <em>chạm được</em> tới cổng của DB?</td><td>Postgres <code>listen_addresses = '*'</code> + security group mở <code>0.0.0.0/0</code> cổng 5432</td></tr>
      <tr><td>🔑 Xác thực</td><td>Làm sao DB biết người kết nối là ai?</td><td>Redis không đặt mật khẩu; MongoDB chưa bật <code>authorization</code>; ClickHouse user <code>default</code> mật khẩu rỗng</td></tr>
      <tr><td>🛂 Phân quyền</td><td>Người đó được làm gì?</td><td>Ứng dụng web kết nối bằng superuser <code>postgres</code> hoặc Mongo role <code>root</code></td></tr>
      <tr><td>🧾 Truy vấn</td><td>Dữ liệu người dùng có bị hiểu thành <em>lệnh</em> không?</td><td>Nối chuỗi vào SQL; truyền nguyên object JSON vào filter Mongo; ghép chuỗi thành lệnh Redis</td></tr>
      <tr><td>🗃️ Dữ liệu</td><td>Nếu dữ liệu bị lấy mất thì hậu quả cỡ nào?</td><td>Lưu số CMND, token, mật khẩu dạng rõ; giữ log/PII vô thời hạn trong Kafka, ClickHouse</td></tr>
      <tr><td>💾 Backup</td><td>Bản sao dữ liệu nằm ở đâu, ai đọc được?</td><td>File dump để trong bucket public; backup không mã hoá; chưa từng thử khôi phục</td></tr>
      <tr><td>⚙️ Vận hành</td><td>Có ai phát hiện khi có chuyện? DB có bị "đánh sập" dễ không?</td><td>Không có audit log; không giới hạn thời gian truy vấn; copy dữ liệu prod về máy dev</td></tr>
    </table>

    <p><strong>2. Mỗi engine có "cửa" riêng, nhưng cùng một kiểu</strong></p>
    <ul>
      <li><strong>PostgreSQL</strong>: cổng 5432, file <code>pg_hba.conf</code> quyết định ai được đăng nhập bằng cách nào, hệ thống role/GRANT, RLS, extension.</li>
      <li><strong>Redis</strong>: cổng 6379, mô hình lệnh rất mạnh (xoá toàn bộ, đổi cấu hình, nạp module). Được thiết kế cho mạng tin cậy — mặc định chỉ bảo vệ bằng <code>protected-mode</code>.</li>
      <li><strong>Kafka</strong>: nhiều listener (9092…), cộng thêm hệ sinh thái Schema Registry, Kafka Connect, REST Proxy — mỗi thứ là một cổng HTTP riêng.</li>
      <li><strong>ClickHouse</strong>: cổng HTTP 8123, native 9000, cộng thêm các table function có thể đọc file/URL/DB khác.</li>
      <li><strong>MongoDB</strong>: cổng 27017, quyền theo role/database, toán tử truy vấn là object (<code>$ne</code>, <code>$gt</code>…).</li>
      <li><strong>Cloudflare D1/KV/R2/Durable Objects/Hyperdrive</strong>: không có cổng mạng để mở — "cửa" nằm ở <em>binding</em> trong Worker, <em>API token</em> của tài khoản và chế độ public của bucket R2.</li>
    </ul>

    <p><strong>3. Sự cố kinh điển: DB để public không mật khẩu</strong></p>
    <p>Nhiều năm liền, các đợt quét Internet tự động tìm DB mở cổng ra ngoài mà không yêu cầu đăng nhập. Kịch bản (mức khái niệm) luôn giống nhau:</p>
    <ol>
      <li>Công cụ quét toàn bộ dải IPv4 trên các cổng phổ biến (5432, 6379, 9092, 8123, 9000, 27017…) — việc này chỉ mất vài giờ.</li>
      <li>Gặp một DB trả lời mà không đòi mật khẩu → bot đọc danh sách database/collection/key.</li>
      <li>Bot tải dữ liệu về, <strong>xoá</strong> dữ liệu gốc và để lại một bản ghi "đòi tiền chuộc". Có những đợt chỉ xoá sạch mà không đòi gì.</li>
      <li>Với các DB có lệnh quản trị mạnh (như Redis cho phép đổi cấu hình), kẻ tấn công còn tìm cách biến quyền trên DB thành quyền trên <em>máy chủ</em>.</li>
    </ol>
    <p>Các đợt như vậy đã xảy ra với MongoDB, Elasticsearch, Redis, CouchDB, bucket lưu trữ đối tượng để public… Điểm chung: <strong>không cần lỗ hổng phần mềm nào</strong> —
    chỉ cần cấu hình sai ở lớp mạng + lớp xác thực. Nghĩa là chỉ cần làm đúng 2 lớp đầu (bài 03–05) đã chặn được cả loạt sự cố này.</p>

    <p><strong>4. Ai là "kẻ tấn công"?</strong> Không chỉ hacker bên ngoài:</p>
    <ul>
      <li><strong>Bot quét tự động</strong> — không nhắm vào bạn, chỉ tìm cửa mở.</li>
      <li><strong>Người dùng ác ý của chính ứng dụng</strong> — gửi input đặc biệt để đọc dữ liệu của tenant khác.</li>
      <li><strong>Mã độc/thư viện bị chiếm</strong> trong một service nội bộ — dùng credential của service đó để đọc DB.</li>
      <li><strong>Nhân viên nội bộ / tài khoản bị lộ</strong> — dùng quyền quá rộng hoặc tải backup.</li>
      <li><strong>Chính bạn</strong> — lỡ chạy lệnh xoá trên prod vì dùng chung tài khoản với dev.</li>
    </ul>

    <div class="callout"><p>💡 Cách dùng bảng 7 vùng: với mỗi DB trong hệ thống, trả lời 7 câu hỏi ở cột giữa. Câu nào bạn trả lời "không biết" — đó là chỗ cần làm trước.
    Không có vùng nào "đủ an toàn" để bỏ qua vùng khác: DB nằm trong mạng riêng nhưng dùng superuser vẫn bị lộ sạch khi ứng dụng bị chiếm.</p></div>
  `,

  codeTabs: [
    { id: "surface", label: "🗺️ Bản đồ bề mặt", lines: [
      "// Kiểm kê bề mặt tấn công cho MỖI database trong hệ thống",
      "for db in [postgres, redis, kafka, clickhouse, mongo, d1, kv, r2]:",
      "    network   = ai kết nối được tới db? (IP, cổng, VPC, Internet?)",
      "    authn     = có bắt đăng nhập không? cơ chế gì? có tài khoản mặc định?",
      "    authz     = mỗi tài khoản được làm gì? có ai dùng quyền admin?",
      "    queries   = input người dùng đi vào truy vấn/lệnh như thế nào?",
      "    data      = có PII/bí mật không? mã hoá? giữ bao lâu?",
      "    backups   = bản sao nằm ở đâu? ai đọc được? đã thử restore chưa?",
      "    ops       = có log truy cập? có giới hạn tài nguyên? dev có dữ liệu prod?",
      "    if any(answer == 'không biết'): add_to_todo(db)"
    ]},
    { id: "exposed", label: "❌ Cấu hình phơi DB", lines: [
      "# PostgreSQL — postgresql.conf + pg_hba.conf",
      "listen_addresses = '*'",
      "host  all  all  0.0.0.0/0  trust        # ai cũng vào, không cần mật khẩu",
      "",
      "# Redis — redis.conf",
      "bind 0.0.0.0",
      "protected-mode no                        # tắt lớp bảo vệ cuối cùng",
      "",
      "# MongoDB — mongod.conf",
      "net:",
      "  bindIp: 0.0.0.0",
      "# (không có security.authorization: enabled)",
      "",
      "# Cloud firewall",
      "allow tcp 5432,6379,27017,8123,9092 from 0.0.0.0/0"
    ]},
    { id: "scan", label: "🤖 Bot quét (khái niệm)", lines: [
      "// Mô phỏng logic của bot quét — KHÔNG phải công cụ thật",
      "for ip in all_ipv4_addresses():",
      "    for port in [5432, 6379, 8123, 9000, 9092, 27017]:",
      "        if tcp_connect(ip, port):",
      "            if server_accepts_without_password(ip, port):",
      "                data = dump_everything(ip, port)",
      "                delete_everything(ip, port)",
      "                leave_note('<ransom_note>')",
      "",
      "// Bot KHÔNG cần lỗ hổng phần mềm. Nó chỉ cần 2 điều:",
      "//   1) cổng mở ra Internet   -> chặn ở lớp Mạng (bài 03)",
      "//   2) không cần đăng nhập   -> chặn ở lớp Xác thực (bài 05)"
    ]},
    { id: "cf", label: "☁️ Cloudflare khác gì?", lines: [
      "# wrangler.toml — D1/KV/R2 không có cổng mạng, truy cập qua binding",
      "[[d1_databases]]",
      "binding = \"DB\"",
      "database_name = \"shop-prod\"",
      "database_id = \"<uuid>\"",
      "",
      "[[r2_buckets]]",
      "binding = \"UPLOADS\"",
      "bucket_name = \"user-uploads\"",
      "",
      "# Bề mặt tấn công chuyển sang:",
      "#  - code Worker (ai gọi được endpoint nào, truy vấn có bind() không)",
      "#  - API token tài khoản (token quyền rộng = chìa khoá vạn năng)",
      "#  - R2 bucket bật public / r2.dev = ai có URL cũng đọc được"
    ]}
  ],

  stageHtml: `
    <div class="node" id="attacker"><div class="nl">👤 Kẻ tấn công</div><div class="ns">bot quét · người dùng ác ý · service bị chiếm · người nội bộ</div></div>
    <div class="arrow" id="a1">↓ cố đi vào qua…</div>
    <div class="row">
      <div class="node" id="net"><div class="nl">🌐 Mạng</div><div class="ns">cổng, IP, VPC</div></div>
      <div class="node" id="authn"><div class="nl">🔑 Xác thực</div><div class="ns">mật khẩu, cert</div></div>
      <div class="node" id="authz"><div class="nl">🛂 Phân quyền</div><div class="ns">role, GRANT, ACL</div></div>
    </div>
    <div class="row">
      <div class="node" id="query"><div class="nl">🧾 Truy vấn</div><div class="ns">input thành lệnh?</div></div>
      <div class="node" id="data"><div class="nl">🗃️ Dữ liệu</div><div class="ns">PII, mã hoá, retention</div></div>
      <div class="node" id="backup"><div class="nl">💾 Backup</div><div class="ns">dump, snapshot</div></div>
      <div class="node" id="ops"><div class="nl">⚙️ Vận hành</div><div class="ns">log, tài nguyên, dev</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="db"><div class="nl">🗄️ Database</div><div class="ns">Postgres · Redis · Kafka · ClickHouse · Mongo · D1/KV/R2</div></div>
  `,
  steps: [
    { title: "1 · Liệt kê mọi DB và hỏi 7 câu", tab: "surface", highlight: [2, 3, 4, 5, 6, 7, 8, 9], on: ["net", "authn", "authz", "query", "data", "backup", "ops"],
      desc: "Bề mặt tấn công là <strong>tất cả</strong> các cửa. Mỗi DB (kể cả Redis 'chỉ là cache' hay Kafka 'chỉ là hàng đợi') đều phải trả lời đủ 7 câu hỏi." },
    { title: "2 · Cấu hình phơi DB ra ngoài", tab: "exposed", highlight: [2, 3, 6, 7, 11, 15], on: ["net", "authn"],
      desc: "Ghép lại: DB lắng nghe mọi địa chỉ + firewall mở cho cả Internet + không bắt đăng nhập. Đây là cấu hình của phần lớn vụ lộ dữ liệu hàng loạt." },
    { title: "3 · Bot không cần lỗ hổng", tab: "scan", highlight: [2, 3, 4, 5, 6, 7], on: ["attacker", "a1", "net", "authn"],
      desc: "Bot quét toàn bộ Internet theo cổng. Gặp DB không mật khẩu là lấy dữ liệu rồi xoá. Không cần kỹ năng đặc biệt — chỉ cần cửa mở." },
    { title: "4 · Hai lớp đầu chặn cả loạt sự cố", tab: "scan", highlight: [10, 11, 12], on: ["net", "authn"],
      desc: "Đóng cổng ra Internet (bài 03) và bắt buộc xác thực (bài 05) là đủ chặn kịch bản bot quét. Chi phí thấp, hiệu quả cực cao." },
    { title: "5 · Kẻ tấn công ở bên trong", tab: "surface", highlight: [5, 6, 7], on: ["authz", "query", "data"],
      desc: "Người dùng ác ý đi qua <em>ứng dụng</em>, không qua cổng DB. Khi đó chỉ phân quyền hẹp, truy vấn có tham số và dữ liệu được mã hoá/tối thiểu hoá mới bảo vệ được." },
    { title: "6 · Backup và vận hành cũng là cửa", tab: "surface", highlight: [8, 9], on: ["backup", "ops", "db"],
      desc: "File dump để nhầm chỗ lộ y hệt DB. Không có log thì bị lấy dữ liệu cũng không biết. Dữ liệu prod trên laptop dev là bản sao không được bảo vệ." },
    { title: "7 · Cloudflare: bề mặt dịch chuyển", tab: "cf", highlight: [2, 3, 7, 8, 12, 13, 14], on: ["db", "authz"],
      desc: "D1/KV/R2 không có cổng để quét, nhưng cửa chuyển sang code Worker, API token tài khoản và chế độ public của bucket R2. Vẫn đủ 7 vùng, chỉ khác hình dạng." }
  ],

  quiz: [
    { q: "Bề mặt tấn công (attack surface) của một database là gì?", options: [
        "Tập hợp mọi đường mà kẻ xấu có thể dùng để chạm tới/lạm dụng DB: mạng, xác thực, phân quyền, truy vấn, dữ liệu, backup, vận hành",
        "Chỉ là các câu SQL có thể bị injection",
        "Dung lượng ổ đĩa của DB",
        "Số bảng trong DB"
      ], correct: 0,
      explanation: "SQL Injection chỉ là một vùng (truy vấn). Bề mặt tấn công bao gồm mọi cửa, kể cả backup và thói quen vận hành." },
    { q: "Các đợt 'xoá dữ liệu đòi tiền chuộc' hàng loạt nhắm vào MongoDB/Redis/Elasticsearch chủ yếu khai thác điều gì?", options: [
        "Một lỗ hổng zero-day rất phức tạp",
        "Mật khẩu quá ngắn",
        "DB mở cổng ra Internet và không yêu cầu đăng nhập",
        "Lỗi trong driver của ứng dụng"
      ], correct: 2,
      explanation: "Không cần lỗ hổng phần mềm: cổng mở + không xác thực là đủ để bot tự động đọc và xoá dữ liệu." },
    { q: "Hai lớp nào nếu làm đúng sẽ chặn được kịch bản 'bot quét Internet tìm DB không mật khẩu'?", options: [
        "Mã hoá at-rest và backup",
        "Mạng (không phơi cổng ra Internet) và Xác thực (bắt buộc đăng nhập)",
        "Audit log và retention",
        "Row-level security và masking"
      ], correct: 1,
      explanation: "Bot cần chạm được cổng và vào được mà không có credential. Chặn một trong hai là bot bó tay; chặn cả hai là phòng thủ nhiều lớp." },
    { q: "Ứng dụng web kết nối PostgreSQL bằng superuser 'postgres'. Vùng nào của bề mặt tấn công đang có vấn đề?", options: [
        "Mạng",
        "Không vùng nào, vì dùng mật khẩu mạnh",
        "Backup",
        "Phân quyền"
      ], correct: 3,
      explanation: "Xác thực có thể ổn, nhưng quyền quá rộng: nếu ứng dụng bị chiếm hoặc có lỗi injection, kẻ tấn công có toàn quyền trên cả cluster." },
    { q: "Với Cloudflare D1/KV/R2, điều nào đúng về bề mặt tấn công?", options: [
        "Không có bề mặt tấn công vì không có cổng mạng",
        "Chỉ cần đặt mật khẩu mạnh cho D1",
        "Bề mặt chuyển sang code Worker, API token tài khoản, và chế độ public của bucket R2",
        "Chỉ lo SQL Injection là đủ"
      ], correct: 2,
      explanation: "Không có cổng để quét, nhưng token quyền rộng, bucket public hay truy vấn ghép chuỗi trong Worker vẫn là cửa vào." },
    { q: "Tại sao 'Redis chỉ là cache, không cần bảo vệ' là suy nghĩ sai?", options: [
        "Vì Redis thường chứa session/token/dữ liệu người dùng, và có lệnh quản trị mạnh có thể bị lạm dụng để phá dữ liệu hoặc ảnh hưởng tới máy chủ",
        "Vì Redis chậm",
        "Vì Redis không hỗ trợ TLS",
        "Vì cache luôn lớn hơn DB chính"
      ], correct: 0,
      explanation: "Cache chứa session là đủ để chiếm tài khoản. Lệnh quản trị (xoá toàn bộ, đổi cấu hình, nạp module) biến Redis mở thành cửa vào máy chủ." },
    { q: "File dump DB được để trong một bucket lưu trữ bật public đọc. Đây là vấn đề ở vùng nào?", options: [
        "Truy vấn",
        "Không có vấn đề vì DB vẫn đặt mật khẩu",
        "Xác thực của DB",
        "Backup"
      ], correct: 3,
      explanation: "Backup là một bản sao đầy đủ của dữ liệu. Mật khẩu DB không bảo vệ được bản sao nằm ở nơi khác." },
    { q: "Kẻ tấn công nào sau đây KHÔNG bị chặn chỉ bằng firewall?", options: [
        "Bot quét cổng từ Internet",
        "Người dùng ác ý gửi input đặc biệt qua chính ứng dụng web của bạn",
        "Máy lạ ngoài VPC",
        "Tất cả đều bị chặn bởi firewall"
      ], correct: 1,
      explanation: "Người dùng đi qua ứng dụng — ứng dụng được phép kết nối DB. Phải dựa vào phân quyền hẹp, truy vấn có tham số, RLS…" },
    { q: "Khi kiểm kê bề mặt tấn công, câu trả lời 'không biết' cho một câu hỏi nên được xử lý thế nào?", options: [
        "Coi như một việc cần làm (todo) và ưu tiên tìm hiểu/khắc phục",
        "Bỏ qua vì chắc là ổn",
        "Tắt DB đó đi",
        "Chỉ ghi chú lại, không cần làm gì"
      ], correct: 0,
      explanation: "Chỗ không biết thường là chỗ không ai kiểm soát. Đó là nơi nên bắt đầu." }
  ]
});
