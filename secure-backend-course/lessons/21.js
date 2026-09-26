window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Dữ liệu & mật mã",
  title: "Quản lý secret: không hardcode, không commit, không in ra log",
  subtitle: "Biến môi trường vs secret manager · phân quyền đọc · rotation · secret scanning · xử lý khi lỡ lộ",

  theory: `
    <p><strong>Secret</strong> là mọi giá trị mà ai có được sẽ hành động được <em>thay mặt hệ thống</em>: mật khẩu database, API key của cổng thanh toán,
    khoá ký JWT, khoá mã hoá dữ liệu (bài 20), token truy cập cloud, private key TLS, webhook secret, mật khẩu SMTP… Lộ secret thường nguy hiểm hơn cả một lỗ hổng code:
    kẻ có secret <strong>không cần khai thác gì</strong>, chỉ cần đăng nhập như bạn. Các vụ lộ lọt lớn thường bắt đầu từ một key bị commit lên repo công khai,
    một file <code>.env</code> nằm trong image Docker, hay một dòng log in nguyên header <code>Authorization</code>.</p>

    <p><strong>1. Không hardcode, không commit.</strong> Secret trong mã nguồn sẽ đi theo mọi bản sao của code: máy mọi lập trình viên, CI, bản build, image container,
    bản fork, bản backup… và <strong>ở mãi trong lịch sử git</strong> dù bạn xoá ở commit sau. Repo "private" hôm nay có thể bị lộ quyền truy cập, chia sẻ cho đối tác, hay chuyển thành public ngày mai.</p>
    <ul>
      <li>Code chỉ chứa <strong>tên</strong> của secret (<code>DB_PASSWORD</code>), giá trị được nạp lúc chạy.</li>
      <li>Thêm <code>.env</code>, <code>*.pem</code>, <code>*.key</code>, file credential của cloud vào <code>.gitignore</code>; commit file mẫu <code>.env.example</code> chỉ có tên biến, giá trị giả.</li>
      <li>Không đưa secret vào Dockerfile (<code>ENV</code>, <code>ARG</code>, <code>COPY .env</code>) — chúng nằm lại trong layer image. Dùng build secret / nạp lúc runtime.</li>
      <li>Không để secret trong bundle frontend/app mobile: mọi thứ gửi xuống client đều coi như công khai.</li>
    </ul>

    <p><strong>2. Biến môi trường vs secret manager.</strong></p>
    <table>
      <tr><th></th><th>Biến môi trường (env var)</th><th>Secret manager / Vault</th></tr>
      <tr><td>Ví dụ</td><td><code>.env</code>, biến trong CI, env của container</td><td>HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Kubernetes Secret (+ mã hoá etcd / External Secrets)</td></tr>
      <tr><td>Ưu điểm</td><td>Đơn giản, chuẩn 12-factor, tách khỏi code</td><td>Mã hoá khi lưu, phân quyền chi tiết, <strong>audit log</strong> ai đọc lúc nào, xoay vòng tự động, secret động có hạn</td></tr>
      <tr><td>Nhược điểm</td><td>Dễ rò qua: dump env khi lỗi, process con kế thừa, trang debug, <code>/proc</code>, log của CI; không có audit, khó xoay vòng</td><td>Thêm hạ tầng, cần xác thực app với manager (dùng danh tính workload, không dùng thêm một secret tĩnh)</td></tr>
      <tr><td>Phù hợp</td><td>Máy dev, dự án nhỏ, là "kênh giao" cuối cùng từ manager vào process</td><td>Staging/production, nhiều service, yêu cầu tuân thủ</td></tr>
    </table>
    <p>Cách phổ biến: secret sống trong manager → được <em>bơm</em> vào lúc chạy (sidecar/agent, CSI driver, SDK đọc trực tiếp, hoặc env var do nền tảng inject).
    App xác thực với manager bằng <strong>danh tính của workload</strong> (IAM role, service account, OIDC của CI) thay vì một mật khẩu nữa — tránh bài toán "secret để mở két secret".</p>

    <p><strong>3. Phân quyền đọc secret — least privilege.</strong></p>
    <ul>
      <li>Mỗi service chỉ đọc được <strong>secret của chính nó</strong>: service gửi email không đọc được khoá thanh toán.</li>
      <li>Tách theo môi trường: key production không bao giờ có trên máy dev hay trong CI của nhánh feature.</li>
      <li>Con người hạn chế đọc giá trị secret production; thao tác qua quy trình có phê duyệt, có ghi log.</li>
      <li>Bản thân secret cũng nên <strong>ít quyền</strong>: user DB của app chỉ có quyền trên schema cần thiết; API key giới hạn scope, giới hạn IP nếu nhà cung cấp hỗ trợ.</li>
      <li>Bật audit log của secret manager và cảnh báo khi có truy cập bất thường.</li>
    </ul>

    <p><strong>4. Rotation — xoay vòng.</strong> Giả định rằng secret <em>sẽ</em> lộ vào một lúc nào đó; xoay vòng định kỳ làm giảm thời gian giá trị bị lộ còn dùng được,
    và quan trọng hơn: <strong>tập dượt</strong> để khi có sự cố thật bạn xoay trong vài phút chứ không phải vài ngày. Quy trình xoay không gián đoạn:</p>
    <ol>
      <li>Tạo secret mới (phiên bản N+1) song song với bản cũ — hệ thống đích chấp nhận cả hai.</li>
      <li>Triển khai app đọc bản mới (app nên đọc lại secret định kỳ hoặc khi nhận tín hiệu, không chỉ lúc khởi động).</li>
      <li>Xác nhận không còn ai dùng bản cũ (xem log/metric).</li>
      <li>Vô hiệu hoá bản cũ.</li>
    </ol>
    <p>Tốt nhất là <strong>secret động/ngắn hạn</strong>: Vault cấp user DB sống 1 giờ, cloud cấp token tạm qua IAM role, CI dùng OIDC thay cho access key dài hạn. Không có gì để xoay nếu secret tự hết hạn.</p>

    <p><strong>5. Secret scanning — bắt trước khi lọt.</strong> Người luôn có lúc sơ suất, nên cần máy móc chặn ở nhiều tầng:</p>
    <ul>
      <li><strong>Pre-commit hook</strong> trên máy dev (gitleaks, detect-secrets, trufflehog, ggshield…): chặn commit có chuỗi giống key.</li>
      <li><strong>Trong CI</strong>: quét mọi merge request, fail pipeline nếu phát hiện; quét cả lịch sử định kỳ.</li>
      <li><strong>Push protection</strong> của nền tảng git (GitHub/GitLab secret detection) và chương trình đối tác tự thu hồi key bị đẩy lên public.</li>
      <li>Quét cả image container, artifact build, file log, wiki/ticket.</li>
      <li>Có quy trình đánh dấu "false positive" có lý do, không tắt scanner vì phiền.</li>
    </ul>

    <p><strong>6. Khi lỡ lộ: THU HỒI TRƯỚC, xoá lịch sử sau.</strong> Phản xạ sai phổ biến là vội <code>git push --force</code> để xoá commit. Nhưng từ lúc secret lên remote,
    phải coi như <strong>đã bị người khác lấy</strong> (bot quét repo công khai chỉ mất vài phút; bản clone, fork, cache, mirror CI không biến mất). Thứ tự đúng:</p>
    <ol>
      <li><strong>Thu hồi/vô hiệu hoá</strong> secret ngay tại nhà cung cấp (revoke key, đổi mật khẩu DB, huỷ token).</li>
      <li><strong>Cấp secret mới</strong> qua secret manager, triển khai lại.</li>
      <li><strong>Điều tra</strong>: audit log của nhà cung cấp — secret cũ đã bị dùng từ đâu, làm gì, trong khoảng thời gian nào?</li>
      <li><strong>Dọn dẹp</strong>: xoá khỏi lịch sử git (git filter-repo / BFG), xoá khỏi artifact, image, log, ticket — việc này để <em>giảm rác</em>, không phải biện pháp khắc phục chính.</li>
      <li><strong>Rút kinh nghiệm</strong>: vì sao scanner không chặn? Bổ sung rule, pre-commit, đào tạo.</li>
    </ol>

    <p><strong>7. Không in secret ra log.</strong> Log được gửi đi nhiều nơi (hệ thống log tập trung, nhà cung cấp APM, ticket hỗ trợ) và nhiều người đọc được — thường lỏng hơn nhiều so với secret manager.</p>
    <ul>
      <li>Không log nguyên request/headers: header <code>Authorization</code>, <code>Cookie</code>, <code>X-Api-Key</code> phải bị che.</li>
      <li>Không log connection string đầy đủ (chứa mật khẩu), không log object config lúc khởi động.</li>
      <li>Bọc secret trong kiểu dữ liệu riêng có <code>toString()</code> trả <code>"***"</code> (ví dụ <code>SecretStr</code> của Pydantic, <code>Secret</code> trong nhiều framework) để lỡ in ra cũng không lộ.</li>
      <li>Cấu hình redaction ở tầng logger (danh sách key như <code>password</code>, <code>token</code>, <code>secret</code>, <code>authorization</code>) — bài 22 nói thêm về redact PII.</li>
      <li>Để ý cả thông báo lỗi của thư viện: một số exception in nguyên URL có kèm credential.</li>
    </ul>

    <div class="callout"><p>💡 Checklist secret: (1) grep repo có key/mật khẩu nào không? (2) <code>.gitignore</code> có chặn <code>.env</code>, file key? (3) Production đọc secret từ đâu, ai đọc được, có audit không?
    (4) Lần xoay vòng gần nhất là khi nào, mất bao lâu? (5) Pre-commit + CI có quét secret không? (6) Có runbook "lộ secret" ghi rõ thu hồi trước? (7) Log có che header nhạy cảm không?</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Secret sai chỗ", lines: [
      "// config.js — commit lên repo",
      "DB_URL      = 'postgres://app:<mat_khau_that>@db.prod:5432/shop'",
      "PAYMENT_KEY = '<api_key_that_cua_cong_thanh_toan>'",
      "",
      "# Dockerfile",
      "ENV PAYMENT_KEY=<api_key_that>     # nằm lại trong layer image",
      "COPY .env /app/.env                # .env vào luôn image",
      "",
      "// Log khi khởi động",
      "log.info('config loaded', config)         // in cả mật khẩu",
      "log.debug('request', req.headers)         // in cả Authorization"
    ]},
    { id: "load", label: "✅ Nạp lúc chạy", lines: [
      "// Code chỉ biết TÊN secret",
      "function loadSecrets():",
      "    if env == 'dev':",
      "        return readDotEnv('.env')              // file bị .gitignore",
      "    client = secretManager.connect(identity = workloadIdentity())",
      "    return {",
      "        dbPassword: Secret(client.get('shop/prod/db-password')),",
      "        paymentKey: Secret(client.get('shop/prod/payment-key'))",
      "    }",
      "",
      "class Secret:",
      "    toString() = '***'                          // lỡ log cũng không lộ",
      "    reveal()   = this.value                     // chỉ gọi đúng chỗ cần"
    ]},
    { id: "langs", label: "🌐 Đa nền tảng", lines: [
      "# Python — Pydantic Settings + SecretStr",
      "class Settings(BaseSettings): db_password: SecretStr",
      "# Node.js — AWS Secrets Manager SDK",
      "const s = await client.send(new GetSecretValueCommand({ SecretId: 'shop/prod/db' }))",
      "# Java / Spring — Vault",
      "spring.cloud.vault.kv.enabled=true   # @Value('${db.password}') nạp từ Vault",
      "# Go — GCP Secret Manager",
      "res, _ := client.AccessSecretVersion(ctx, &pb.AccessSecretVersionRequest{Name: name})",
      "# Kubernetes — secret gắn vào pod dưới dạng file, không hardcode trong manifest",
      "volumeMounts: [{ name: db-secret, mountPath: /run/secrets, readOnly: true }]",
      "",
      "# Điểm chung: giá trị không nằm trong code, danh tính workload để xác thực"
    ]},
    { id: "scan", label: "🔎 Secret scanning", lines: [
      "# .pre-commit-config.yaml — chặn trên máy dev",
      "repos:",
      "  - repo: https://github.com/gitleaks/gitleaks",
      "    hooks: [{ id: gitleaks }]",
      "",
      "# .gitlab-ci.yml / GitHub Actions — chặn trong CI",
      "secret_scan:",
      "  script: gitleaks detect --source . --redact --exit-code 1",
      "",
      "# .gitignore",
      ".env",
      "*.pem",
      "*.key"
    ]},
    { id: "leak", label: "🚨 Runbook khi lộ", lines: [
      "// Phát hiện: key thanh toán bị commit lên repo công khai",
      "1. REVOKE key cũ ngay tại dashboard nhà cung cấp     // phút thứ 0",
      "2. Tạo key mới -> lưu vào secret manager -> redeploy",
      "3. Xem audit log nhà cung cấp: key cũ bị dùng ở đâu, khi nào",
      "4. Đánh giá thiệt hại, báo cáo theo quy trình sự cố",
      "5. Xoá khỏi lịch sử git (git filter-repo), artifact, log",
      "6. Hậu kiểm: vì sao scanner không chặn? thêm rule / pre-commit",
      "",
      "// ❌ SAI: bước 5 trước bước 1 — force push không thu hồi được bản đã bị clone"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vault"><div class="nl">🏦 Secret manager / Vault</div><div class="ns">mã hoá · phân quyền · audit · rotation</div></div>
    <div class="arrow" id="a1">↓ danh tính workload (IAM / OIDC), không dùng secret tĩnh</div>
    <div class="row">
      <div class="node" id="app"><div class="nl">⚙️ Service</div><div class="ns">chỉ đọc secret của chính nó</div></div>
      <div class="node" id="log"><div class="nl">📜 Log</div><div class="ns">redact · Secret.toString() = ***</div></div>
    </div>
    <div class="arrow" id="a2">↑ chặn trước khi lọt vào repo</div>
    <div class="row">
      <div class="node" id="precommit"><div class="nl">🪝 Pre-commit</div><div class="ns">gitleaks · detect-secrets</div></div>
      <div class="node" id="ci"><div class="nl">🧪 CI scan</div><div class="ns">fail pipeline khi phát hiện</div></div>
      <div class="node" id="repo"><div class="nl">📁 Repo</div><div class="ns">chỉ có tên biến + .env.example</div></div>
    </div>
    <div class="arrow" id="a3">↓ nếu vẫn lộ</div>
    <div class="node" id="revoke"><div class="nl">🚨 Thu hồi → cấp mới → điều tra → dọn lịch sử</div><div class="ns">theo đúng thứ tự</div></div>
  `,
  steps: [
    { title: "1 · Secret nằm sai chỗ", tab: "vuln", highlight: [2, 3, 6, 7], on: ["repo"],
      desc: "Mật khẩu trong code, key trong Dockerfile, <code>.env</code> copy vào image — tất cả đi theo mọi bản sao của repo và image, nằm mãi trong lịch sử." },
    { title: "2 · Log cũng là nơi rò rỉ", tab: "vuln", highlight: [10, 11], on: ["log"],
      desc: "In nguyên config hoặc headers là đưa mật khẩu và token vào hệ thống log — nơi nhiều người đọc được và lưu rất lâu." },
    { title: "3 · Nạp secret lúc chạy từ manager", tab: "load", highlight: [3, 4, 5, 7, 8], on: ["vault", "a1", "app"],
      desc: "Dev dùng <code>.env</code> (đã gitignore); staging/production đọc từ secret manager bằng danh tính workload. Mỗi service chỉ có quyền trên đường dẫn secret của mình." },
    { title: "4 · Bọc secret để khỏi lỡ in ra", tab: "load", highlight: [11, 12, 13], on: ["log"],
      desc: "Kiểu <code>Secret</code> với <code>toString()</code> trả <code>***</code>: lỡ log object config cũng không lộ giá trị. Chỉ gọi <code>reveal()</code> tại chỗ thật sự cần." },
    { title: "5 · Nền tảng nào cũng có công cụ", tab: "langs", highlight: [2, 4, 6, 8, 10], on: ["vault", "app"],
      desc: "SecretStr, AWS/GCP Secret Manager, Spring Cloud Vault, Kubernetes secret mount — cùng một nguyên tắc: code chỉ biết tên, giá trị đến lúc chạy." },
    { title: "6 · Chặn ở pre-commit và CI", tab: "scan", highlight: [3, 4, 8, 11, 12, 13], on: ["a2", "precommit", "ci", "repo"],
      desc: "Scanner trên máy dev chặn sớm nhất; CI chặn khi dev bỏ qua hook; <code>.gitignore</code> ngăn file nhạy cảm từ đầu." },
    { title: "7 · Lỡ lộ: thu hồi trước", tab: "leak", highlight: [2, 3, 4, 5, 9], on: ["a3", "revoke"],
      desc: "Từ lúc lên remote, coi như secret đã bị lấy. Revoke ngay, cấp mới, điều tra audit log — rồi mới dọn lịch sử git và rút kinh nghiệm." }
  ],

  quiz: [
    { q: "Lập trình viên commit nhầm mật khẩu DB, 5 phút sau commit tiếp để xoá dòng đó. Secret đã an toàn chưa?", options: [
        "Rồi, vì file hiện tại không còn mật khẩu",
        "Chưa: mật khẩu vẫn nằm trong lịch sử git và mọi bản clone; phải thu hồi/đổi mật khẩu",
        "Rồi, nếu repo là private",
        "Rồi, nếu commit mới có message rõ ràng"
      ], correct: 1,
      explanation: "Git lưu toàn bộ lịch sử. Mọi secret đã lên remote đều phải coi là đã lộ và thu hồi." },
    { q: "Thứ tự đúng khi phát hiện API key bị đẩy lên repo công khai?", options: [
        "Force push xoá commit → chờ xem có ai dùng không",
        "Thu hồi key tại nhà cung cấp → cấp key mới → điều tra audit log → dọn lịch sử git",
        "Đổi tên biến trong code",
        "Chuyển repo sang private là đủ"
      ], correct: 1,
      explanation: "Bot quét repo công khai rất nhanh; bản clone/fork không xoá được. Thu hồi là bước duy nhất vô hiệu hoá giá trị đã lộ." },
    { q: "Ưu điểm của secret manager so với chỉ dùng biến môi trường?", options: [
        "Không cần mạng",
        "Mã hoá khi lưu, phân quyền chi tiết, audit log ai đọc, hỗ trợ xoay vòng và secret ngắn hạn",
        "Nhanh hơn đọc env",
        "Không cần cấu hình gì"
      ], correct: 1,
      explanation: "Env var đơn giản nhưng không có audit, dễ rò qua dump môi trường, khó xoay vòng." },
    { q: "App nên xác thực với secret manager thế nào để tránh bài toán 'secret để mở két secret'?", options: [
        "Hardcode mật khẩu của secret manager trong code",
        "Dùng danh tính workload (IAM role, service account, OIDC) do nền tảng cấp",
        "Không cần xác thực",
        "Gửi mật khẩu qua query string"
      ], correct: 1,
      explanation: "Danh tính workload do nền tảng cấp, ngắn hạn, không phải lưu thêm secret tĩnh nào." },
    { q: "Vì sao không nên đặt API key bằng ENV trong Dockerfile?", options: [
        "Vì Docker không đọc được ENV",
        "Vì giá trị nằm lại trong layer image, ai kéo được image là đọc được",
        "Vì ENV chỉ hỗ trợ số",
        "Vì làm image nặng"
      ], correct: 1,
      explanation: "Layer image là bất biến và được phân phối qua registry. Dùng build secret hoặc nạp lúc runtime." },
    { q: "Service gửi email có nên đọc được khoá của cổng thanh toán không?", options: [
        "Có, để tiện cấu hình chung",
        "Không — mỗi service chỉ đọc được secret của chính nó (least privilege)",
        "Có, nếu cùng namespace",
        "Chỉ khi chạy trên production"
      ], correct: 1,
      explanation: "Nếu service email bị chiếm, kẻ tấn công không lấy được khoá thanh toán." },
    { q: "Pre-commit hook quét secret (gitleaks, detect-secrets) mang lại lợi ích gì?", options: [
        "Tự động xoay vòng secret",
        "Chặn secret ngay trên máy dev trước khi thành commit, sớm hơn và rẻ hơn mọi bước sau",
        "Mã hoá repo",
        "Thay thế hoàn toàn việc quét trong CI"
      ], correct: 1,
      explanation: "Hook có thể bị bỏ qua nên vẫn cần CI scan; nhưng chặn sớm nhất là đỡ tốn công thu hồi nhất." },
    { q: "Cách nào giúp lỡ gọi log.info(config) cũng không lộ mật khẩu?", options: [
        "Đặt log level ERROR",
        "Bọc secret trong kiểu dữ liệu có toString() trả '***' và cấu hình redaction ở logger",
        "Viết log bằng tiếng Anh",
        "Nén file log"
      ], correct: 1,
      explanation: "SecretStr/Secret wrapper + redaction theo tên key là phòng thủ ở tầng dữ liệu, không phụ thuộc vào việc dev nhớ." },
    { q: "Lợi ích lớn nhất của việc xoay vòng secret định kỳ?", options: [
        "Giảm dung lượng lưu trữ",
        "Giới hạn thời gian secret bị lộ còn dùng được và tập dượt để xoay nhanh khi có sự cố thật",
        "Tăng tốc độ ứng dụng",
        "Không cần secret manager nữa"
      ], correct: 1,
      explanation: "Xoay vòng thường xuyên biến việc 'đổi key khẩn cấp' thành thao tác quen thuộc, không gây gián đoạn." },
    { q: "Quy trình xoay vòng không gián đoạn thường gồm các bước nào?", options: [
        "Xoá secret cũ → tạo secret mới → khởi động lại",
        "Tạo bản mới song song → app chuyển sang bản mới → xác nhận không ai dùng bản cũ → vô hiệu hoá bản cũ",
        "Đổi secret trong code rồi deploy",
        "Tắt hệ thống trong giờ thấp điểm"
      ], correct: 1,
      explanation: "Hai phiên bản cùng hợp lệ trong thời gian chuyển giúp không có request nào bị lỗi." }
  ]
});
