window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Dữ liệu trên thiết bị",
  title: "Rò rỉ ngoài ý muốn",
  subtitle: "Log · clipboard · screenshot & app switcher · bộ nhớ đệm bàn phím · backup · crash report · analytics",

  theory: `
    <p>Bạn đã cất token vào Keychain/Keystore. Nhưng dữ liệu nhạy cảm vẫn có thể "chảy" ra ngoài qua những kênh phụ mà lập trình viên hay quên:
    một dòng log debug, một lần copy số tài khoản, ảnh chụp màn hình trong trình chuyển app… Bài này đi qua từng kênh và cách bịt.</p>

    <p><strong>1. Log</strong></p>
    <ul>
      <li>Android <code>Log.d</code>, iOS <code>print</code>/<code>NSLog</code>, JS <code>console.log</code>, Dart <code>print</code> — trong bản release vẫn có thể ghi ra log hệ thống.
        Trên Android, người có máy kết nối debug (hoặc app có quyền đặc biệt trên máy root) đọc được logcat; trên iOS log hiện trong Console khi cắm máy.</li>
      <li>Thứ hay bị log nhầm: toàn bộ request/response HTTP (kèm header Authorization), object user (email, số điện thoại), token, OTP.</li>
      <li>Phòng thủ: dùng wrapper log có cấp độ, <strong>tắt log debug trong release</strong>, không bao giờ log token/mật khẩu/OTP kể cả ở debug;
        với iOS <code>os_log</code>/<code>Logger</code>, giá trị động mặc định là <code>&lt;private&gt;</code> — giữ nguyên, đừng đánh dấu <code>public</code> cho dữ liệu nhạy cảm.</li>
    </ul>

    <p><strong>2. Clipboard (pasteboard)</strong></p>
    <ul>
      <li>Clipboard là vùng chung: app khác đọc được (các OS mới có hiện thông báo khi app đọc clipboard, nhưng không chặn). Có thể đồng bộ sang máy khác (Universal Clipboard, cloud clipboard).</li>
      <li>Phòng thủ: tắt copy cho trường mật khẩu, OTP, số thẻ; nếu cần copy (mã ví, số tài khoản) thì đánh dấu nhạy cảm và đặt thời gian hết hạn —
        iOS: <code>UIPasteboard</code> với <code>localOnly</code> + <code>expirationDate</code>; Android 13+: extra <code>ClipDescription.EXTRA_IS_SENSITIVE</code> để ẩn nội dung ở bản xem trước.</li>
    </ul>

    <p><strong>3. Screenshot, quay màn hình, app switcher</strong></p>
    <ul>
      <li>Khi app vào nền, OS chụp lại màn hình hiện tại để hiển thị trong trình chuyển app. Ảnh này có thể lưu trên đĩa và bị người đứng cạnh nhìn thấy.</li>
      <li>Android: <code>FLAG_SECURE</code> trên window chặn chụp/quay màn hình và làm trắng ảnh trong recent apps. Áp dụng cho màn hình nhạy cảm (OTP, số dư, thẻ).</li>
      <li>iOS không có cờ tương đương để chặn chụp; cách phổ biến: khi app sắp vào nền (<code>sceneWillResignActive</code>) phủ một view che (logo/làm mờ),
        và lắng nghe <code>UIScreen.capturedDidChangeNotification</code> để ẩn nội dung khi đang quay màn hình.</li>
      <li>React Native / Flutter: dùng thư viện gọi đúng các API native trên (ví dụ bật FLAG_SECURE qua module native).</li>
    </ul>

    <p><strong>4. Bộ nhớ đệm bàn phím và autofill</strong></p>
    <ul>
      <li>Bàn phím học từ những gì bạn gõ để gợi ý; bàn phím bên thứ ba có thể gửi dữ liệu lên cloud.</li>
      <li>Phòng thủ: trường nhạy cảm dùng kiểu mật khẩu (<code>isSecureTextEntry</code>, <code>inputType=textPassword</code>, <code>secureTextEntry</code>, <code>obscureText</code>),
        tắt autocorrect/gợi ý (<code>autocorrectionType = .no</code>, <code>textNoSuggestions</code>, <code>autoCorrect=false</code>). iOS tự dùng bàn phím hệ thống cho ô secure.</li>
      <li>Dùng đúng <code>textContentType</code>/<code>autofillHints</code> để trình quản lý mật khẩu hoạt động — autofill của hệ thống là an toàn và nên hỗ trợ.</li>
    </ul>

    <p><strong>5. Backup</strong></p>
    <ul>
      <li>Android: <code>android:allowBackup="true"</code> (mặc định) → dữ liệu app có thể được sao lưu lên Google Drive hoặc trích ra qua công cụ backup trên máy tính.
        Dùng <code>dataExtractionRules</code> (Android 12+) / <code>fullBackupContent</code> để loại trừ file nhạy cảm, hoặc tắt hẳn nếu không cần.</li>
      <li>iOS: mọi thứ trong Documents và Library (trừ Caches, tmp) mặc định được backup iCloud/máy tính. Đặt <code>isExcludedFromBackup</code> cho file nhạy cảm;
        Keychain item có <code>ThisDeviceOnly</code> không khôi phục sang máy khác.</li>
      <li>Lưu ý: khoá Keystore không theo backup → bản mã được khôi phục sang máy mới sẽ không giải mã được. Code phải xử lý (xoá và đăng nhập lại).</li>
    </ul>

    <p><strong>6. Crash report và analytics</strong></p>
    <ul>
      <li>Crash report gửi kèm stack trace, log gần nhất, đôi khi breadcrumb URL/request → có thể chứa token hoặc PII.</li>
      <li>Analytics event đặt tên kiểu <code>search: "số CCCD của tôi…"</code>, <code>screen: /reset?token=…</code> đưa dữ liệu nhạy cảm sang bên thứ ba.</li>
      <li>Phòng thủ: bộ lọc (scrubber) trước khi gửi — xoá header Authorization, query string, trường có tên như password/token/otp;
        dùng ID nội bộ ẩn danh thay vì email; review danh sách event như review API.</li>
    </ul>

    <p><strong>7. Thông báo đẩy (push) và widget</strong> — hiển thị trên màn hình khoá. Không đưa OTP đầy đủ, số dư, nội dung tin nhắn riêng tư vào payload hiển thị;
    dùng nội dung chung ("Bạn có giao dịch mới") và để app tải chi tiết sau khi mở khoá.</p>

    <div class="callout"><p>💡 Cách làm có hệ thống: lập danh sách <strong>trường dữ liệu nhạy cảm</strong> (token, OTP, mật khẩu, số thẻ, CCCD, số dư…),
    rồi với từng kênh ở trên hỏi "trường này có thể đi qua kênh này không?". Kiểm tra bằng cách chạy bản release, dùng app, rồi xem log/backup/crash report thực tế.</p></div>
  `,

  codeTabs: [
    { id: "log", label: "📝 Log", lines: [
      "// SAI: log cả request có header Authorization",
      "Log.d(\"HTTP\", request.toString())               // Android",
      "print(\"login ok: \\(user.email) token=\\(token)\")  // iOS",
      "console.log('response', res.data)               // React Native",
      "",
      "// ĐÚNG: wrapper chỉ log trong debug, không bao giờ log bí mật",
      "object AppLog {",
      "    fun d(msg: String) { if (BuildConfig.DEBUG) Log.d(\"App\", msg) }",
      "}",
      "HttpLoggingInterceptor().apply {",
      "    level = if (BuildConfig.DEBUG) Level.BASIC else Level.NONE",
      "    redactHeader(\"Authorization\"); redactHeader(\"Cookie\")",
      "}",
      "// iOS: Logger giữ giá trị động ở dạng <private>",
      "logger.info(\"login ok for user \\(userId, privacy: .private)\")"
    ]},
    { id: "screen", label: "📸 Screenshot", lines: [
      "// Android: chặn chụp/quay + trắng trong recent apps cho màn hình nhạy cảm",
      "window.setFlags(WindowManager.LayoutParams.FLAG_SECURE,",
      "                WindowManager.LayoutParams.FLAG_SECURE)",
      "",
      "// iOS: phủ view che khi app sắp vào nền",
      "func sceneWillResignActive(_ scene: UIScene) {",
      "    window?.addSubview(privacyCoverView)",
      "}",
      "func sceneDidBecomeActive(_ scene: UIScene) {",
      "    privacyCoverView.removeFromSuperview()",
      "}",
      "// iOS: ẩn số dư khi đang quay/phát màn hình",
      "NotificationCenter.default.addObserver(forName: UIScreen.capturedDidChangeNotification, ...)",
      "balanceLabel.isHidden = UIScreen.main.isCaptured"
    ]},
    { id: "input", label: "⌨️ Clipboard & bàn phím", lines: [
      "// iOS: ô OTP",
      "otpField.isSecureTextEntry = false; otpField.textContentType = .oneTimeCode",
      "otpField.autocorrectionType = .no",
      "",
      "// iOS: copy số tài khoản — chỉ trên máy này, hết hạn sau 60 giây",
      "UIPasteboard.general.setItems([[UTType.plainText.identifier: acct]],",
      "    options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(60)])",
      "",
      "// Android 13+: đánh dấu clip nhạy cảm",
      "clip.description.extras = PersistableBundle().apply {",
      "    putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true) }",
      "",
      "// React Native / Flutter",
      "<TextInput secureTextEntry autoCorrect={false} contextMenuHidden />",
      "TextField(obscureText: true, enableSuggestions: false, autocorrect: false)"
    ]},
    { id: "backup", label: "☁️ Backup", lines: [
      "<!-- AndroidManifest.xml -->",
      "<application android:allowBackup=\"true\"",
      "    android:dataExtractionRules=\"@xml/data_extraction_rules\"",
      "    android:fullBackupContent=\"@xml/backup_rules\">",
      "",
      "<!-- res/xml/data_extraction_rules.xml (Android 12+) -->",
      "<cloud-backup>",
      "  <exclude domain=\"sharedpref\" path=\"secure_prefs.xml\"/>",
      "  <exclude domain=\"database\" path=\"messages.db\"/>",
      "</cloud-backup>",
      "",
      "// iOS: loại file nhạy cảm khỏi backup",
      "var values = URLResourceValues(); values.isExcludedFromBackup = true",
      "try fileURL.setResourceValues(values)"
    ]},
    { id: "crash", label: "🧯 Crash & analytics", lines: [
      "// Bộ lọc trước khi gửi (pseudo-code, áp dụng cho mọi SDK crash/analytics)",
      "SENSITIVE = ['password', 'token', 'otp', 'authorization', 'cvv', 'id_number']",
      "",
      "beforeSend(event):",
      "    for key in event.allKeys():",
      "        if key.lower() in SENSITIVE: event[key] = '[REDACTED]'",
      "    event.request.url = stripQueryString(event.request.url)",
      "    event.user = { id: anonymousUserId }        // không gửi email/sđt",
      "    return event",
      "",
      "// Analytics: tên event cố định, không chứa dữ liệu người dùng nhập",
      "track('search_performed', { resultCount: 12 })   // KHÔNG: { query: text }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 Dữ liệu nhạy cảm trong app</div><div class="ns">token, OTP, số dư, CCCD</div></div>
    <div class="arrow" id="a1">↓ các kênh rò rỉ phụ</div>
    <div class="row">
      <div class="node" id="log"><div class="nl">📝 Log</div><div class="ns">logcat / Console</div></div>
      <div class="node" id="clip"><div class="nl">📋 Clipboard</div><div class="ns">app khác đọc</div></div>
      <div class="node" id="shot"><div class="nl">📸 App switcher</div><div class="ns">ảnh chụp màn hình</div></div>
    </div>
    <div class="row">
      <div class="node" id="kbd"><div class="nl">⌨️ Bàn phím</div><div class="ns">gợi ý, cache</div></div>
      <div class="node" id="bak"><div class="nl">☁️ Backup</div><div class="ns">cloud / máy tính</div></div>
      <div class="node" id="crash"><div class="nl">🧯 Crash / analytics</div><div class="ns">gửi sang bên thứ ba</div></div>
    </div>
    <div class="arrow" id="a2">↓ bịt từng kênh</div>
    <div class="node" id="fix"><div class="nl">🛡️ Tắt log release · FLAG_SECURE/che màn hình · loại trừ backup · scrubber</div><div class="ns">kiểm tra trên bản release thật</div></div>
  `,

  steps: [
    { title: "1 · Log là kênh rò rỉ số một", tab: "log", highlight: [2, 3, 4], on: ["app", "a1", "log"],
      desc: "Log toàn bộ request/response hay object user là cách nhanh nhất để token và PII xuất hiện trong log hệ thống, log thu thập từ máy test, và crash report." },
    { title: "2 · Wrapper log + redact", tab: "log", highlight: [8, 11, 12, 15], on: ["log", "fix"],
      desc: "Chỉ log ở debug, redact header Authorization/Cookie, và với iOS giữ giá trị động ở dạng <code>private</code>." },
    { title: "3 · Che màn hình nhạy cảm", tab: "screen", highlight: [2, 3, 6, 7, 14], on: ["shot", "fix"],
      desc: "Android dùng FLAG_SECURE; iOS phủ view che khi vào nền và ẩn nội dung khi màn hình đang bị quay." },
    { title: "4 · Clipboard & bàn phím", tab: "input", highlight: [2, 3, 6, 7, 11, 14, 15], on: ["clip", "kbd"],
      desc: "Tắt gợi ý/autocorrect cho ô nhạy cảm; nếu buộc phải copy thì giới hạn trong máy và cho hết hạn nhanh, đánh dấu clip nhạy cảm." },
    { title: "5 · Loại trừ khỏi backup", tab: "backup", highlight: [3, 4, 8, 9, 13, 14], on: ["bak"],
      desc: "Chỉ rõ file/DB nhạy cảm không được sao lưu. Nhớ xử lý trường hợp dữ liệu mã hoá được khôi phục sang máy mới mà không có khoá." },
    { title: "6 · Lọc trước khi gửi ra ngoài", tab: "crash", highlight: [2, 6, 7, 8, 12], on: ["crash", "a2", "fix"],
      desc: "Mọi SDK crash/analytics đều có hook trước khi gửi. Xoá trường nhạy cảm, bỏ query string, dùng ID ẩn danh, không đưa text người dùng nhập vào event." }
  ],

  quiz: [
    { q: "Dòng Log.d(\"HTTP\", request.toString()) trong bản release có rủi ro gì?", options: [
        "Không rủi ro vì release không có log",
        "Header Authorization và dữ liệu nhạy cảm có thể xuất hiện trong log hệ thống",
        "Chỉ làm app chậm",
        "Chỉ rủi ro trên iOS"
      ], correct: 1,
      explanation: "Log.d vẫn chạy trong release nếu không bị loại bỏ. Phải tắt log debug và redact header nhạy cảm." },
    { q: "FLAG_SECURE trên Android có tác dụng gì?", options: [
        "Mã hoá dữ liệu trong RAM",
        "Chặn chụp/quay màn hình và làm trắng ảnh của app trong recent apps",
        "Chặn app khác đọc clipboard",
        "Bật HTTPS"
      ], correct: 1,
      explanation: "Dùng cho màn hình hiển thị OTP, số dư, thông tin thẻ." },
    { q: "iOS không có cờ chặn chụp màn hình tương đương FLAG_SECURE. Cách phổ biến để bảo vệ ảnh trong app switcher là gì?", options: [
        "Không có cách nào",
        "Phủ một view che khi app sắp vào nền, gỡ khi app active lại",
        "Tắt đa nhiệm",
        "Xoá app khỏi màn hình chính"
      ], correct: 1,
      explanation: "Ảnh chụp được tạo khi app vào nền; nếu lúc đó màn hình đã bị che thì ảnh không chứa dữ liệu nhạy cảm." },
    { q: "Người dùng cần copy số tài khoản. Cách an toàn trên iOS?", options: [
        "Copy bình thường",
        "Đặt vào pasteboard với localOnly và expirationDate ngắn",
        "Gửi số tài khoản qua SMS",
        "Lưu vào UserDefaults"
      ], correct: 1,
      explanation: "localOnly chặn đồng bộ sang thiết bị khác; hết hạn giảm thời gian app khác có thể đọc." },
    { q: "android:allowBackup mặc định là gì và cần làm gì?", options: [
        "false — không cần làm gì",
        "true — cần loại trừ file nhạy cảm bằng dataExtractionRules/fullBackupContent hoặc tắt backup",
        "true — không có cách loại trừ",
        "Chỉ có trên iOS"
      ], correct: 1,
      explanation: "Backup đưa dữ liệu ra khỏi sandbox; cần kiểm soát file nào được sao lưu." },
    { q: "Crash report gửi kèm URL đầy đủ '/reset-password?token=...'. Vấn đề là gì?", options: [
        "Không vấn đề",
        "Token đặt lại mật khẩu bị gửi sang dịch vụ bên thứ ba và lưu lâu dài",
        "Crash report sẽ bị từ chối",
        "Chỉ làm tốn băng thông"
      ], correct: 1,
      explanation: "Cần scrubber: bỏ query string, xoá trường nhạy cảm trước khi gửi." },
    { q: "Event analytics nào có vấn đề về quyền riêng tư?", options: [
        "track('search_performed', { resultCount: 12 })",
        "track('search', { query: textNgườiDùngNhập, email: user.email })",
        "track('screen_view', { screen: 'home' })",
        "track('purchase_completed', { itemCount: 3 })"
      ], correct: 1,
      explanation: "Text người dùng nhập có thể chứa bất cứ gì (CCCD, số điện thoại); email là PII." },
    { q: "Ô nhập OTP nên cấu hình thế nào?", options: [
        "Bật autocorrect để tiện",
        "Tắt autocorrect/gợi ý, dùng textContentType .oneTimeCode / autofillHints phù hợp",
        "Cho phép copy tự do",
        "Lưu OTP vào lịch sử nhập"
      ], correct: 1,
      explanation: "Autofill OTP của hệ thống là an toàn; gợi ý bàn phím thì không cần thiết và có thể lưu giá trị." },
    { q: "Payload push hiển thị trên màn hình khoá nên chứa gì?", options: [
        "Mã OTP đầy đủ và số dư",
        "Nội dung chung (ví dụ 'Bạn có giao dịch mới'); chi tiết tải sau khi mở app",
        "Refresh token",
        "Mật khẩu tạm thời"
      ], correct: 1,
      explanation: "Màn hình khoá ai đứng cạnh cũng nhìn được; không đưa dữ liệu nhạy cảm vào nội dung hiển thị." }
  ]
});
