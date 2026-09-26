window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Code & gói phát hành",
  title: "OTA / hot update & nạp code động",
  subtitle: "CodePush, EAS Update, Shorebird · ký bản cập nhật · kiểm tra toàn vẹn · kênh phát hành · không tải & chạy code tuỳ ý",

  theory: `
    <p>App native truyền thống chỉ đổi code khi người dùng cài bản mới từ store — nơi có review và chữ ký của bạn.
    Các cơ chế <strong>OTA (over-the-air) update</strong> cho phép đẩy code mới thẳng xuống máy, bỏ qua store: rất tiện để sửa lỗi nhanh,
    nhưng cũng tạo ra <strong>một kênh phân phối code thứ hai</strong>. Ai kiểm soát được kênh này thì kiểm soát được app trên mọi máy.</p>

    <p><strong>1. Các cơ chế phổ biến</strong></p>
    <table>
      <tr><th>Nền tảng</th><th>Cơ chế</th><th>Thay đổi được gì</th></tr>
      <tr><td>React Native</td><td>EAS Update (Expo), CodePush / các bản tự host</td><td>JS bundle + asset</td></tr>
      <tr><td>Flutter</td><td>Shorebird</td><td>Code Dart (qua cơ chế patch riêng)</td></tr>
      <tr><td>Hybrid (Capacitor/Cordova)</td><td>Live update</td><td>HTML/JS/CSS</td></tr>
      <tr><td>Mọi nền tảng</td><td>Remote config / feature flag</td><td>Giá trị cấu hình, bật/tắt tính năng (không phải code)</td></tr>
    </table>

    <p><strong>2. Chính sách store</strong> — Apple và Google cho phép cập nhật code thông dịch (JS) nếu <em>không thay đổi mục đích chính</em> của app và không lách review.
    Không được tải và chạy <strong>mã native</strong> mới (dex, .so, framework) từ ngoài store. Vi phạm có thể bị gỡ app.</p>

    <p><strong>3. Rủi ro của kênh OTA</strong></p>
    <ul>
      <li><strong>Server/tài khoản cập nhật bị chiếm</strong> → kẻ tấn công phát hành bundle độc cho toàn bộ người dùng (tấn công chuỗi cung ứng).</li>
      <li><strong>Tải qua kênh không an toàn</strong> → bị thay bundle trên đường truyền.</li>
      <li><strong>Bundle lưu trên máy bị sửa</strong> (máy root, vùng lưu trữ chung) → app chạy code đã bị sửa.</li>
      <li><strong>Hạ cấp (rollback/downgrade)</strong> → ép app chạy bản cũ còn lỗ hổng đã biết.</li>
      <li><strong>Nhầm kênh</strong> → bản staging/debug (có log, endpoint test) đẩy nhầm lên production.</li>
    </ul>

    <p><strong>4. Biện pháp bắt buộc</strong></p>
    <ol>
      <li><strong>Ký bản cập nhật (code signing)</strong>: bundle được ký bằng private key <em>chỉ nằm trong hệ thống build/CI</em> (hoặc HSM); app nhúng public key và
        <strong>từ chối</strong> bundle có chữ ký không hợp lệ. EAS Update hỗ trợ code signing; CodePush có tính năng code signing; Shorebird có tuỳ chọn ký patch.
        Nhờ vậy kể cả server phân phối bị chiếm, kẻ tấn công vẫn không tạo được bundle hợp lệ.</li>
      <li><strong>HTTPS</strong> cho mọi lần tải (bài 08) — cần thiết nhưng không đủ; chữ ký mới chống được server bị chiếm.</li>
      <li><strong>Kiểm tra toàn vẹn khi chạy</strong>: xác minh chữ ký/hash trước mỗi lần nạp bundle đã lưu, không chỉ lúc tải về. Lưu bundle trong vùng riêng của app.</li>
      <li><strong>Chống hạ cấp</strong>: bundle mang số phiên bản trong phần được ký; app từ chối bundle cũ hơn bản đang chạy (trừ rollback do chính bạn phát hành có ký).</li>
      <li><strong>Gắn với runtime version</strong>: bundle chỉ áp dụng cho đúng phiên bản native tương thích.</li>
      <li><strong>Kênh tách biệt</strong>: production / staging dùng kênh và khoá khác nhau; bản production không bao giờ nhận bundle từ kênh staging.</li>
      <li><strong>Bảo vệ tài khoản phát hành</strong>: MFA, quyền tối thiểu, chỉ CI được publish, có log audit; phát hành theo tỉ lệ (staged rollout) và có nút rollback.</li>
    </ol>

    <p><strong>5. Không tải và chạy code tuỳ ý</strong></p>
    <ul>
      <li>Không <code>eval</code>/<code>new Function</code> chuỗi JS lấy từ server hay từ remote config.</li>
      <li>Android: không <code>DexClassLoader</code> nạp dex/jar tải từ mạng hoặc từ external storage; không <code>System.load</code> thư viện .so từ vùng chung.</li>
      <li>Không tải "plugin" hay script từ URL do người dùng/deep link cung cấp.</li>
      <li>Remote config chỉ chứa <strong>dữ liệu</strong> (flag, số, chuỗi hiển thị) và phải được validate như input — không chứa code, URL tuỳ ý để WebView mở, hay biểu thức để thực thi.</li>
      <li>Server-driven UI: server gửi mô tả UI dạng dữ liệu, app chỉ render các component có sẵn theo allowlist, hành động giới hạn trong tập đã định nghĩa.</li>
    </ul>

    <div class="callout"><p>💡 Kênh OTA mạnh ngang quyền phát hành lên store. Hãy bảo vệ <strong>khoá ký bundle</strong> và <strong>tài khoản phát hành</strong> như bảo vệ khoá ký app —
    và để app tự <strong>từ chối mọi thứ không có chữ ký hợp lệ</strong>, thay vì tin server phân phối.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "🔏 Ký & xác minh", lines: [
      "// Trong CI (có private key, không ai khác có)",
      "bundle   = build('production', runtimeVersion='3.2')",
      "manifest = { id, runtimeVersion: '3.2', sequence: 148, sha256: hash(bundle) }",
      "sig      = sign(privateKey_from_HSM, canonical(manifest))",
      "publish(channel='production', bundle, manifest, sig)",
      "",
      "// Trong app (chỉ có public key nhúng sẵn)",
      "onUpdateDownloaded(bundle, manifest, sig):",
      "    require verify(EMBEDDED_PUBLIC_KEY, canonical(manifest), sig)",
      "    require sha256(bundle) == manifest.sha256",
      "    require manifest.runtimeVersion == NATIVE_RUNTIME_VERSION",
      "    require manifest.sequence > current.sequence        // chống hạ cấp",
      "    saveToPrivateDir(bundle, manifest, sig)",
      "",
      "onLaunch(): verify lại bundle đã lưu trước khi nạp; lỗi -> dùng bundle gốc trong gói"
    ]},
    { id: "eas", label: "⚛️ EAS Update", lines: [
      "# Tạo khoá ký (private key giữ trong CI secret, KHÔNG commit)",
      "npx expo-updates codesigning:generate --key-output-directory keys \\",
      "  --certificate-output-directory certs --certificate-validity-duration-years 10 \\",
      "  --certificate-common-name 'Shop App'",
      "",
      "// app.json: app nhúng chứng chỉ, từ chối update không ký đúng",
      "{ 'expo': { 'updates': {",
      "    'codeSigningCertificate': './certs/certificate.pem',",
      "    'codeSigningMetadata': { 'keyid': 'main', 'alg': 'rsa-v1_5-sha256' } },",
      "  'runtimeVersion': { 'policy': 'appVersion' } } }",
      "",
      "# Phát hành từ CI, đúng kênh",
      "eas update --channel production --private-key-path keys/private-key.pem"
    ]},
    { id: "bad", label: "❌ Code động nguy hiểm", lines: [
      "// JS: chạy chuỗi từ remote config",
      "const rule = remoteConfig.getString('discount_rule')",
      "eval(rule)                              // ai sửa được config là chạy được code",
      "",
      "// Android: nạp dex tải về",
      "val loader = DexClassLoader(downloadedJar.path, codeCacheDir.path, null, classLoader)",
      "",
      "// Android: nạp .so từ vùng chung",
      "System.load(\"/sdcard/Download/plugin.so\")",
      "",
      "// WebView mở URL tuỳ ý từ remote config",
      "webView.loadUrl(remoteConfig.getString('promo_url'))"
    ]},
    { id: "config", label: "✅ Remote config là dữ liệu", lines: [
      "// Schema cho remote config — validate như input API",
      "RemoteConfig = {",
      "  discountPercent: integer(min=0, max=50),",
      "  bannerTextVi:    string(maxLength=120),",
      "  promoPath:       enum('/sale', '/new', '/home'),   // path nội bộ, không phải URL tuỳ ý",
      "  featureNewCheckout: boolean",
      "}",
      "cfg = RemoteConfig.parseOrDefault(fetchRemoteConfig())",
      "",
      "// Server-driven UI: chỉ render component có sẵn",
      "ALLOWED_COMPONENTS = { 'banner', 'product_grid', 'text' }",
      "ALLOWED_ACTIONS    = { 'open_product', 'open_category' }"
    ]},
    { id: "ops", label: "🛡️ Vận hành kênh OTA", lines: [
      "# Tài khoản & quyền",
      "- MFA bắt buộc cho mọi người có quyền phát hành",
      "- Chỉ CI được publish production; người không có private key ký bundle",
      "- Audit log: ai phát hành gì, lúc nào",
      "",
      "# Phát hành",
      "- Kênh production/staging tách biệt, khoá ký khác nhau",
      "- Staged rollout 5% -> 25% -> 100%, theo dõi crash",
      "- Rollback nhanh (bản rollback cũng được ký)",
      "",
      "# Khi nghi ngờ khoá ký bị lộ",
      "- Ngừng phát hành OTA, phát hành bản store mới nhúng public key mới"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ci"><div class="nl">🏗️ CI build</div><div class="ns">ký manifest bằng private key (HSM / CI secret)</div></div>
    <div class="arrow" id="a1">↓ publish kênh production</div>
    <div class="node" id="cdn"><div class="nl">☁️ Server phân phối OTA</div><div class="ns">có thể bị chiếm — không được tin</div></div>
    <div class="arrow" id="a2">↓ HTTPS</div>
    <div class="node" id="verify"><div class="nl">🔍 App xác minh</div><div class="ns">chữ ký · hash · runtimeVersion · sequence</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="load"><div class="nl">✅ Lưu vùng riêng & nạp</div><div class="ns">verify lại mỗi lần khởi động</div></div>
      <div class="node" id="reject"><div class="nl">⛔ Từ chối</div><div class="ns">dùng bundle gốc trong gói</div></div>
    </div>
    <div class="node" id="dyn"><div class="nl">🚫 eval · DexClassLoader · .so từ ngoài</div><div class="ns">không bao giờ</div></div>
  `,

  steps: [
    { title: "1 · OTA là kênh phát hành thứ hai", tab: "flow", highlight: [2, 5], on: ["ci", "a1", "cdn"],
      desc: "Ai kiểm soát kênh OTA thì đẩy được code lên mọi máy. Server phân phối có thể bị chiếm, nên app không được tin server." },
    { title: "2 · Ký trong CI", tab: "flow", highlight: [3, 4], on: ["ci"],
      desc: "Manifest chứa hash bundle, runtimeVersion, số thứ tự; được ký bằng private key chỉ CI/HSM có." },
    { title: "3 · App xác minh mọi thứ", tab: "flow", highlight: [9, 10, 11, 12, 15], on: ["a2", "verify", "a3", "load", "reject"],
      desc: "Chữ ký hợp lệ, hash khớp, đúng runtime native, số thứ tự lớn hơn (chống hạ cấp). Kiểm tra lại mỗi lần khởi động; lỗi thì dùng bundle gốc." },
    { title: "4 · EAS Update code signing", tab: "eas", highlight: [2, 8, 9, 10, 13], on: ["ci", "verify"],
      desc: "Sinh khoá, nhúng chứng chỉ vào app, phát hành từ CI với private key. App tự từ chối update không có chữ ký đúng." },
    { title: "5 · Không chạy code tuỳ ý", tab: "bad", highlight: [3, 6, 9, 12], on: ["dyn"],
      desc: "eval chuỗi từ config, nạp dex/.so tải về, WebView mở URL tuỳ ý từ config — đều biến một kênh dữ liệu thành kênh chạy code." },
    { title: "6 · Remote config chỉ là dữ liệu", tab: "config", highlight: [3, 4, 5, 8, 11, 12], on: ["load"],
      desc: "Validate config bằng schema; URL thay bằng enum path nội bộ; server-driven UI chỉ dùng component và action trong allowlist." },
    { title: "7 · Bảo vệ tài khoản phát hành", tab: "ops", highlight: [2, 3, 7, 8, 12], on: ["ci", "cdn"],
      desc: "MFA, chỉ CI publish, kênh tách biệt, staged rollout, rollback có ký. Khoá bị lộ → ngừng OTA, phát hành bản store với khoá mới." }
  ],

  quiz: [
    { q: "Vì sao cần ký bản cập nhật OTA thay vì chỉ dùng HTTPS?", options: [
        "HTTPS chậm",
        "HTTPS chỉ bảo vệ đường truyền; nếu server phân phối bị chiếm, chỉ chữ ký (khoá nằm ở CI) mới giúp app từ chối bundle giả",
        "Ký giúp bundle nhỏ hơn",
        "Store bắt buộc"
      ], correct: 1,
      explanation: "App tin khoá công khai nhúng sẵn, không tin server phân phối." },
    { q: "Private key ký bundle nên nằm ở đâu?", options: [
        "Trong app",
        "Trong repo git",
        "Chỉ trong CI secret / HSM, không ai khác truy cập",
        "Trên server phân phối OTA"
      ], correct: 2,
      explanation: "Nếu key ở server phân phối thì chiếm server là ký được bundle giả." },
    { q: "Chống hạ cấp (downgrade) trong OTA nghĩa là?", options: [
        "Không cho cập nhật",
        "App từ chối bundle có số thứ tự/phiên bản cũ hơn bản đang chạy",
        "Luôn dùng bản cũ nhất",
        "Xoá bản cũ khỏi server"
      ], correct: 1,
      explanation: "Ngăn ép app chạy bản cũ còn lỗ hổng đã biết." },
    { q: "Store cho phép gì với cập nhật ngoài store?", options: [
        "Tải và chạy mã native mới (dex, .so)",
        "Cập nhật code thông dịch (JS) không đổi mục đích chính của app, không lách review",
        "Mọi thứ",
        "Không gì cả"
      ], correct: 1,
      explanation: "Tải mã native từ ngoài store vi phạm chính sách và mở rủi ro lớn." },
    { q: "eval(remoteConfig.getString('discount_rule')) có vấn đề gì?", options: [
        "Không vấn đề",
        "Ai sửa được remote config là chạy được code tuỳ ý trong app",
        "Chạy chậm",
        "Chỉ lỗi trên iOS"
      ], correct: 1,
      explanation: "Remote config chỉ chứa dữ liệu đã validate, không chứa code." },
    { q: "Bundle OTA đã lưu trên máy nên được xác minh khi nào?", options: [
        "Chỉ lúc tải về",
        "Lúc tải về và lại trước mỗi lần nạp khi khởi động",
        "Không cần xác minh",
        "Mỗi năm một lần"
      ], correct: 1,
      explanation: "File lưu trên máy có thể bị sửa sau khi tải." },
    { q: "Remote config có trường promo_url để WebView mở. Cách an toàn hơn?", options: [
        "Mở mọi URL",
        "Thay bằng enum path nội bộ hoặc allowlist host, validate bằng schema",
        "Base64 URL",
        "Mở trong WebView có bridge"
      ], correct: 1,
      explanation: "Giới hạn giá trị hợp lệ thay vì tin chuỗi tuỳ ý." },
    { q: "Nghi ngờ private key ký OTA bị lộ. Việc cần làm?", options: [
        "Tiếp tục phát hành bình thường",
        "Ngừng OTA, phát hành bản store mới nhúng public key mới, thu hồi khoá cũ",
        "Đổi mật khẩu email",
        "Xoá kênh staging"
      ], correct: 1,
      explanation: "App cũ tin khoá cũ; chỉ bản store mới thay được khoá nhúng." },
    { q: "Kênh staging và production nên cấu hình thế nào?", options: [
        "Dùng chung kênh và khoá cho tiện",
        "Tách kênh và khoá ký; bản production không nhận bundle từ staging",
        "Chỉ dùng staging",
        "Không cần kênh"
      ], correct: 1,
      explanation: "Tránh đẩy nhầm bản debug/test lên người dùng thật." }
  ]
});
