window.LESSONS.push({
  id: "13",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "Mã hoá at-rest: bảo vệ được gì, không bảo vệ được gì",
  subtitle: "Mã hoá đĩa · TDE · encrypted disk/codec ClickHouse · Mongo encrypted storage · dịch vụ managed & Cloudflare · khoá phải tách khỏi dữ liệu",

  theory: `
    <p>"Dữ liệu của chúng tôi được mã hoá at-rest" là câu có trong mọi tài liệu bảo mật. Nhưng nó chỉ trả lời một câu hỏi rất hẹp:
    <strong>nếu ai đó lấy được <em>phương tiện lưu trữ</em> (ổ đĩa, snapshot, file backup) mà không có khoá, họ có đọc được không?</strong>
    Hiểu đúng phạm vi này để không đặt niềm tin sai chỗ.</p>

    <p><strong>1. Các mức mã hoá at-rest</strong></p>
    <table>
      <tr><th>Mức</th><th>Ví dụ</th><th>Ai giải mã?</th></tr>
      <tr><td>Ổ đĩa / volume</td><td>LUKS/dm-crypt, BitLocker, EBS/Persistent Disk mã hoá bằng KMS</td><td>Hệ điều hành/hypervisor — mọi tiến trình trên máy đang chạy đều đọc được dữ liệu rõ</td></tr>
      <tr><td>Trong DB engine (TDE)</td><td>Mongo Enterprise encrypted storage engine; ClickHouse encrypted disk & codec; Percona <code>pg_tde</code></td><td>Tiến trình DB — ai truy vấn được DB đều thấy dữ liệu rõ</td></tr>
      <tr><td>Dịch vụ managed</td><td>RDS/Cloud SQL/Atlas/ElastiCache/MSK mã hoá lưu trữ; Cloudflare D1, KV, R2, Durable Objects mã hoá mặc định</td><td>Nhà cung cấp, bằng khoá của họ hoặc khoá bạn quản lý (BYOK/CMK)</td></tr>
      <tr><td>Ứng dụng / field</td><td>Mã hoá trước khi ghi (bài 14)</td><td>Chỉ ứng dụng có quyền dùng khoá</td></tr>
    </table>

    <p><strong>2. Bảo vệ được gì</strong></p>
    <ul>
      <li>Ổ đĩa bị mất cắp, máy chủ thanh lý không xoá sạch, ổ hỏng gửi đi bảo hành.</li>
      <li>Snapshot/backup bị sao chép sang nơi khác mà <em>không kèm quyền dùng khoá</em> (ví dụ snapshot mã hoá bằng khoá KMS riêng — tài khoản khác không giải mã được nếu không được cấp quyền khoá).</li>
      <li>Nhân viên hạ tầng có quyền vật lý nhưng không có quyền khoá.</li>
      <li>Đáp ứng yêu cầu tuân thủ (PCI DSS, HIPAA, GDPR…) cho phần "dữ liệu lưu trữ".</li>
    </ul>

    <p><strong>3. KHÔNG bảo vệ được gì</strong> — đây là phần hay bị hiểu sai:</p>
    <ul>
      <li><strong>Injection, IDOR, lỗi phân quyền</strong>: truy vấn đi qua DB, DB giải mã và trả dữ liệu rõ.</li>
      <li><strong>Credential DB bị lộ</strong>: kẻ tấn công đăng nhập như app → thấy dữ liệu rõ.</li>
      <li><strong>Kẻ tấn công có quyền root trên máy DB đang chạy</strong>: volume đã được mở khoá, khoá nằm trong bộ nhớ hoặc file cấu hình.</li>
      <li><strong>Bản sao nằm ngoài vùng mã hoá</strong>: export CSV, log truy vấn, cache Redis, message Kafka, file dump trên laptop.</li>
      <li><strong>Người quản trị có quyền giải mã trên KMS</strong>.</li>
    </ul>
    <p>Tóm lại: at-rest bảo vệ <em>phương tiện lưu trữ</em>, không bảo vệ <em>đường truy cập hợp lệ</em>. Các lớp phân quyền, truy vấn an toàn và mã hoá mức field (bài 14) lo phần còn lại.</p>

    <p><strong>4. Áp dụng trên từng engine</strong></p>
    <table>
      <tr><th>Engine</th><th>Cách mã hoá at-rest</th><th>Lưu ý</th></tr>
      <tr><td>PostgreSQL (community)</td><td>Không có TDE gốc → mã hoá volume (LUKS/cloud); backup mã hoá bằng pgBackRest/WAL-G; managed: bật storage encryption + KMS</td><td>Mã hoá cả volume chứa WAL, tablespace, file tạm, bản sao replica</td></tr>
      <tr><td>Redis</td><td>Không có mã hoá gốc → mã hoá volume chứa RDB/AOF; managed: bật at-rest encryption</td><td>File RDB/AOF là bản sao đầy đủ, dạng rõ — bảo vệ như backup</td></tr>
      <tr><td>Kafka</td><td>Không có mã hoá gốc → mã hoá volume <code>log.dirs</code>; tiered storage lên S3/R2 bật SSE-KMS</td><td>Cần payload không đọc được ngay cả với admin broker → mã hoá end-to-end ở client (bài 14)</td></tr>
      <tr><td>ClickHouse</td><td>Disk loại <code>encrypted</code> bọc disk khác; hoặc codec <code>AES_128_GCM_SIV</code>/<code>AES_256_GCM_SIV</code> cho từng cột</td><td>Khoá nằm trong config trên cùng máy → chủ yếu chống mất đĩa/snapshot; lấy khoá từ biến môi trường/secret, không commit</td></tr>
      <tr><td>MongoDB</td><td>Enterprise: <code>security.enableEncryption</code> + KMIP; Atlas: mặc định + tuỳ chọn khoá của bạn; Community: mã hoá volume</td><td><code>encryptionKeyFile</code> chỉ nên dùng thử nghiệm; prod dùng KMIP/KMS</td></tr>
      <tr><td>Cloudflare D1/KV/R2/DO</td><td>Mã hoá at-rest mặc định do Cloudflare quản lý; R2 hỗ trợ thêm SSE-C (khoá do bạn cung cấp mỗi request) qua S3 API</td><td>Với SSE-C: mất khoá = mất dữ liệu; giữ khoá trong secret manager</td></tr>
    </table>

    <p><strong>5. Khoá quan trọng hơn thuật toán</strong></p>
    <ul>
      <li>Khoá <strong>không nằm cạnh dữ liệu</strong>: không cùng ổ, không cùng backup, không cùng repo.</li>
      <li>Dùng <strong>KMS/HSM</strong> để quản lý khoá chính; quyền "decrypt" trên KMS được audit và cấp hẹp.</li>
      <li>Có kế hoạch <strong>xoay khoá</strong> và <strong>khôi phục</strong> (mất khoá = mất dữ liệu vĩnh viễn — kể cả backup).</li>
    </ul>

    <div class="callout"><p>💡 Khi ai đó nói "đã mã hoá at-rest", hãy hỏi tiếp hai câu: "Khoá nằm ở đâu và ai dùng được?" và "Kịch bản tấn công nào mà biện pháp này chặn được?".
    Nếu câu trả lời cho câu hai là "SQL injection" — đó là hiểu sai.</p></div>
  `,

  codeTabs: [
    { id: "scope", label: "🎯 Phạm vi bảo vệ", lines: [
      "// At-rest chỉ trả lời: 'lấy được phương tiện lưu trữ mà không có khoá thì đọc được không?'",
      "threats = {",
      "  'ổ đĩa/máy bị lấy cắp':              PROTECTED,",
      "  'snapshot copy sang account khác':    PROTECTED if key_not_shared,",
      "  'file backup bị lộ':                  PROTECTED if backup_encrypted_separately,",
      "  'SQL/NoSQL injection':                NOT_PROTECTED,   // DB giải mã hộ",
      "  'credential app bị lộ':               NOT_PROTECTED,",
      "  'root trên máy DB đang chạy':         NOT_PROTECTED,   // volume đã mở khoá",
      "  'CSV export / log / cache / Kafka':   NOT_PROTECTED,   // bản sao ngoài vùng mã hoá",
      "  'admin có quyền kms:Decrypt':         NOT_PROTECTED",
      "}"
    ]},
    { id: "disk", label: "💽 Volume & managed", lines: [
      "# Linux: mã hoá volume dữ liệu DB bằng LUKS (khoá mở từ KMS/TPM, không để trên đĩa)",
      "cryptsetup luksFormat --type luks2 /dev/nvme1n1",
      "cryptsetup open /dev/nvme1n1 pgdata",
      "mkfs.xfs /dev/mapper/pgdata && mount /dev/mapper/pgdata /var/lib/postgresql",
      "",
      "# Cloud managed Postgres: bật mã hoá lưu trữ bằng khoá KMS của bạn",
      "aws rds create-db-instance --db-instance-identifier shop-prod --engine postgres \\",
      "  --storage-encrypted --kms-key-id alias/shop-db ...",
      "",
      "# Nhớ mã hoá luôn: WAL archive, replica, file tạm, volume của Redis (RDB/AOF),",
      "# log.dirs của Kafka, thư mục dữ liệu ClickHouse/Mongo"
    ]},
    { id: "ch", label: "🟨 ClickHouse", lines: [
      "<!-- config.d/encrypted_storage.xml: disk mã hoá bọc disk local -->",
      "<clickhouse><storage_configuration>",
      "  <disks>",
      "    <plain><type>local</type><path>/var/lib/clickhouse/disks/plain/</path></plain>",
      "    <secure>",
      "      <type>encrypted</type>",
      "      <disk>plain</disk>",
      "      <path>encrypted/</path>",
      "      <key_hex from_env=\"CH_DISK_KEY_HEX\"/>   <!-- khoá từ secret, không ghi trong file -->",
      "    </secure>",
      "  </disks>",
      "  <policies><secure_policy><volumes><main><disk>secure</disk></main></volumes></secure_policy></policies>",
      "</storage_configuration></clickhouse>",
      "",
      "CREATE TABLE analytics.payments (id UInt64, card_last4 String, amount Decimal(18,2))",
      "ENGINE = MergeTree ORDER BY id SETTINGS storage_policy = 'secure_policy';"
    ]},
    { id: "mongo", label: "🍃 Mongo & ☁️ Cloudflare", lines: [
      "# MongoDB Enterprise — encrypted storage engine + KMIP",
      "security:",
      "  enableEncryption: true",
      "  kmip:",
      "    serverName: kms.internal",
      "    port: 5696",
      "    clientCertificateFile: /etc/mongo/kmip-client.pem",
      "    serverCAFile: /etc/mongo/kmip-ca.pem",
      "",
      "# Cloudflare: D1 / KV / R2 / Durable Objects mã hoá at-rest mặc định.",
      "# R2 + SSE-C: bạn tự giữ khoá, gửi kèm mỗi request qua S3 API",
      "aws s3api put-object --endpoint-url https://<account>.r2.cloudflarestorage.com \\",
      "  --bucket exports --key 2026/09/report.parquet --body report.parquet \\",
      "  --sse-customer-algorithm AES256 --sse-customer-key fileb://sse-c.key",
      "# mất sse-c.key = mất object"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="thief"><div class="nl">🧳 Lấy cắp đĩa / snapshot</div><div class="ns">không có khoá</div></div>
      <div class="node" id="inj"><div class="nl">🧾 Injection / credential lộ</div><div class="ns">đi qua DB</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="dbproc"><div class="nl">🗄️ Tiến trình DB đang chạy</div><div class="ns">giải mã trong bộ nhớ</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="disk"><div class="nl">💽 Dữ liệu trên đĩa (đã mã hoá)</div><div class="ns">volume · TDE · encrypted disk</div></div>
    <div class="row">
      <div class="node" id="kms"><div class="nl">🔐 KMS / HSM</div><div class="ns">khoá tách khỏi dữ liệu · audit</div></div>
      <div class="node" id="copies"><div class="nl">📤 Bản sao ngoài vùng</div><div class="ns">CSV · log · cache · Kafka</div></div>
    </div>
  `,
  steps: [
    { title: "1 · At-rest trả lời một câu hỏi hẹp", tab: "scope", highlight: [1, 3, 4, 5], on: ["thief", "disk"],
      desc: "Lấy được đĩa/snapshot/backup mà không có khoá → không đọc được. Đó là tất cả những gì at-rest hứa." },
    { title: "2 · Những gì at-rest KHÔNG chặn", tab: "scope", highlight: [6, 7, 8, 9, 10], on: ["inj", "dbproc", "copies"],
      desc: "Mọi truy cập đi qua DB đều nhận dữ liệu đã giải mã. Bản sao ở nơi khác không được mã hoá theo." },
    { title: "3 · Mã hoá volume & dịch vụ managed", tab: "disk", highlight: [2, 3, 4, 7, 8, 10, 11], on: ["disk", "kms"],
      desc: "Postgres/Redis/Kafka community không có TDE gốc → mã hoá volume. Đừng quên WAL, replica, file tạm, RDB/AOF, log.dirs." },
    { title: "4 · ClickHouse encrypted disk", tab: "ch", highlight: [6, 7, 9, 12, 16], on: ["disk"],
      desc: "Disk <code>encrypted</code> bọc disk thường; bảng chọn storage policy mã hoá. Khoá lấy từ biến môi trường/secret, không ghi trong file cấu hình." },
    { title: "5 · Mongo Enterprise + KMIP, Cloudflare mặc định", tab: "mongo", highlight: [3, 4, 5, 10, 14, 15], on: ["disk", "kms"],
      desc: "Mongo mã hoá storage engine với khoá từ KMIP. Cloudflare mã hoá mặc định; R2 SSE-C khi bạn muốn tự giữ khoá (mất khoá = mất dữ liệu)." },
    { title: "6 · Khoá mới là thứ cần bảo vệ", tab: "disk", highlight: [1, 8], on: ["kms", "a2"],
      desc: "Khoá không nằm cạnh dữ liệu, quyền decrypt trên KMS được cấp hẹp và audit, có kế hoạch xoay và khôi phục khoá." }
  ],

  quiz: [
    { q: "Mã hoá at-rest chủ yếu chống lại kịch bản nào?", options: [
        "SQL injection",
        "Credential app bị lộ",
        "Ổ đĩa, snapshot hoặc backup bị lấy mà không kèm khoá",
        "Lỗi phân quyền IDOR"
      ], correct: 2,
      explanation: "At-rest bảo vệ phương tiện lưu trữ, không bảo vệ đường truy cập qua DB." },
    { q: "DB đã bật TDE. Kẻ tấn công khai thác injection trong app đọc được gì?", options: [
        "Dữ liệu rõ — DB giải mã trước khi trả kết quả truy vấn",
        "Không đọc được gì",
        "Chỉ bản mã",
        "Chỉ metadata"
      ], correct: 0,
      explanation: "TDE trong suốt với mọi truy vấn hợp lệ, kể cả truy vấn bị lợi dụng." },
    { q: "PostgreSQL community muốn mã hoá at-rest thì làm thế nào?", options: [
        "Bật ssl = on",
        "Không làm được",
        "Dùng pg_hba.conf",
        "Mã hoá volume (LUKS/cloud KMS), mã hoá backup/WAL archive; hoặc dùng dịch vụ managed có storage encryption"
      ], correct: 3,
      explanation: "Postgres community không có TDE gốc; ssl là mã hoá đường truyền." },
    { q: "File RDB/AOF của Redis cần được đối xử thế nào?", options: [
        "Không quan trọng vì Redis chỉ là cache",
        "Như bản sao đầy đủ dạng rõ của dữ liệu — mã hoá volume, giới hạn quyền đọc, bảo vệ như backup",
        "Xoá sau mỗi lần khởi động",
        "Chia sẻ cho team để debug"
      ], correct: 1,
      explanation: "Redis không mã hoá file persistence." },
    { q: "ClickHouse lưu key của encrypted disk trong file config trên cùng máy. Điều này bảo vệ tốt trước kịch bản nào?", options: [
        "Mất đĩa hoặc snapshot đĩa dữ liệu bị sao chép riêng",
        "Injection",
        "Root trên máy đang chạy",
        "Credential bị lộ"
      ], correct: 0,
      explanation: "Người có quyền trên máy đọc được cả khoá; nên lấy khoá từ biến môi trường/secret manager." },
    { q: "Điều quan trọng nhất trong quản lý khoá at-rest?", options: [
        "Dùng thuật toán mới nhất",
        "Để khoá cùng thư mục với dữ liệu cho tiện",
        "Khoá tách khỏi dữ liệu (KMS/HSM), quyền decrypt được cấp hẹp và audit, có kế hoạch xoay/khôi phục",
        "Đặt khoá trong repo"
      ], correct: 2,
      explanation: "Khoá nằm cạnh dữ liệu thì mã hoá gần như vô nghĩa." },
    { q: "R2 SSE-C có đặc điểm gì?", options: [
        "Cloudflare giữ khoá thay bạn",
        "Bạn cung cấp khoá mỗi request qua S3 API; mất khoá là mất dữ liệu",
        "Tắt mã hoá mặc định",
        "Chỉ dùng cho D1"
      ], correct: 1,
      explanation: "Giữ khoá trong secret manager và có kế hoạch khôi phục." },
    { q: "Dữ liệu được export ra CSV từ DB đã mã hoá at-rest. File CSV có được bảo vệ không?", options: [
        "Có, tự động",
        "Có, nếu DB là Mongo",
        "Có, nếu tên file khó đoán",
        "Không — bản sao nằm ngoài vùng mã hoá phải được bảo vệ riêng"
      ], correct: 3,
      explanation: "Export, log, cache, message đều là bản sao dạng rõ." },
    { q: "Muốn cả admin của Kafka broker cũng không đọc được payload, cần gì?", options: [
        "Mã hoá volume log.dirs",
        "Bật SASL",
        "Mã hoá end-to-end ở client (mã hoá payload trước khi produce)",
        "Tắt retention"
      ], correct: 2,
      explanation: "Mã hoá volume không che được dữ liệu với người vận hành broker; cần mã hoá mức ứng dụng (bài 14)." }
  ]
});
