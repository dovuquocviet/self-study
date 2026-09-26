window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Code & gói phát hành",
  title: "Secret trong app: không thể giấu",
  subtitle: "Mọi cách giấu API key đều chỉ làm chậm · obfuscation ≠ bảo mật · key phạm vi hẹp + giới hạn phía server · phát hiện & xử lý khi lộ",

  theory: `
    <p>Bài 02 đã cho thấy gói app có thể bị mở. Bài này trả lời câu hỏi lập trình viên hỏi nhiều nhất:
    <em>"Vậy tôi giấu API key trong app thế nào?"</em> Câu trả lời ngắn: <strong>bạn không giấu được</strong>. Câu trả lời dài: hãy thiết kế để việc key bị thấy không gây hại.</p>

    <p><strong>1. Vì sao không giấu được?</strong></p>
    <p>Để dùng key, app phải có key ở dạng rõ <em>tại một thời điểm nào đó</em> trong bộ nhớ, rồi gửi nó đi trong request. Người kiểm soát thiết bị có thể:</p>
    <ul>
      <li>Đọc key trong gói (chuỗi hằng, file config, resources).</li>
      <li>Nếu key được "giấu" (mã hoá, chia mảnh, XOR, đặt trong thư viện native C/C++): theo dõi bộ nhớ lúc app giải mã, hoặc hook hàm dùng key.</li>
      <li>Đơn giản nhất: xem request đi ra (proxy trên máy của họ) — key nằm ngay trong header.</li>
    </ul>
    <p>Mọi kỹ thuật giấu chỉ tăng thời gian từ "vài phút" lên "vài giờ". Với key có giá trị (gọi được dịch vụ trả phí, đọc dữ liệu), vài giờ không là gì.</p>

    <p><strong>2. Các cách "giấu" hay gặp — và giá trị thật của chúng</strong></p>
    <table>
      <tr><th>Cách</th><th>Cảm giác</th><th>Thực tế</th></tr>
      <tr><td>Đặt trong <code>.env</code>, <code>BuildConfig</code>, <code>Info.plist</code>, <code>--dart-define</code></td><td>"Không commit vào git là an toàn"</td><td>Vẫn nằm nguyên trong gói. Chỉ giúp giữ key khỏi repo — việc này có ích, nhưng không giấu khỏi người dùng</td></tr>
      <tr><td>Obfuscate (R8/ProGuard, obfuscate Dart)</td><td>"Đã mã hoá code"</td><td>Đổi tên lớp/hàm; chuỗi hằng vẫn nguyên</td></tr>
      <tr><td>Mã hoá key bằng một khoá khác trong app</td><td>"Key đã mã hoá"</td><td>Khoá giải mã cũng trong app → chỉ thêm một bước</td></tr>
      <tr><td>Đặt trong thư viện native (NDK)</td><td>"Khó dịch ngược C"</td><td>Chuỗi vẫn trích được; hook hàm trả về key rất dễ</td></tr>
      <tr><td>Tải key từ server lúc chạy</td><td>"Không có trong gói"</td><td>Ai gọi được endpoint đó cũng lấy được key; key vẫn trong bộ nhớ và trong request</td></tr>
    </table>
    <p>Những kỹ thuật trên <strong>không vô dụng</strong> — chúng lọc bớt kẻ lười. Nhưng không bao giờ được coi là bảo vệ cho key có giá trị.</p>

    <p><strong>3. Phân loại key — câu hỏi đúng là "key này có ĐƯỢC PHÉP công khai không?"</strong></p>
    <table>
      <tr><th>Loại</th><th>Ví dụ</th><th>Có được nằm trong app?</th></tr>
      <tr><td>Publishable / client key</td><td>Stripe publishable key, Maps SDK key, Firebase config, Sentry DSN, key analytics</td><td><strong>Có</strong> — được thiết kế để công khai; phải giới hạn phía nhà cung cấp</td></tr>
      <tr><td>Secret / server key</td><td>Stripe secret key, key API AI, SMTP/SMS key, AWS access key, service account JSON, JWT signing key</td><td><strong>Không bao giờ</strong> — chuyển về backend (bài 10)</td></tr>
      <tr><td>Bí mật riêng từng người dùng</td><td>Token sau đăng nhập, khoá thiết bị</td><td>Có — sinh lúc chạy, cất Keychain/Keystore (bài 04–05)</td></tr>
    </table>

    <p><strong>4. Giới hạn key công khai (key restrictions)</strong></p>
    <ul>
      <li><strong>Theo ứng dụng</strong>: Android package + SHA-256 chữ ký; iOS bundle ID. (Lưu ý: giới hạn này dựa trên header app gửi, có thể giả khi gọi thẳng — nó giảm lạm dụng, không phải xác thực mạnh.)</li>
      <li><strong>Theo API</strong>: key Maps chỉ bật Maps SDK, không bật Geocoding/Places nếu không dùng.</li>
      <li><strong>Theo quota và ngân sách</strong>: giới hạn request/ngày, cảnh báo chi phí.</li>
      <li><strong>Kết hợp attestation</strong>: Firebase App Check, Play Integrity, App Attest (bài 10) để nhà cung cấp/backend từ chối request không đến từ app thật.</li>
      <li><strong>Quyền dữ liệu nằm ở quy tắc server</strong>: Firebase Security Rules, Supabase Row Level Security — không phải ở việc giấu key.</li>
    </ul>

    <p><strong>5. Nếu cần gọi dịch vụ bằng secret: proxy qua backend</strong></p>
    <p>App → backend của bạn (xác thực người dùng, kiểm tra quyền, rate limit theo user, giới hạn chi phí) → dịch vụ bên thứ ba bằng secret.
    Nếu cần client gọi trực tiếp (ví dụ upload file lớn): backend cấp <strong>credential tạm thời, phạm vi hẹp</strong> — URL ký sẵn (presigned URL) hết hạn sau vài phút cho đúng một object, token tạm thời theo từng user.</p>

    <p><strong>6. Quy trình khi key bị lộ</strong></p>
    <ol>
      <li><strong>Rotate</strong>: tạo key mới, cập nhật backend/app, vô hiệu key cũ. Với key trong app cũ: cân nhắc thời gian chuyển tiếp hoặc bắt buộc cập nhật.</li>
      <li>Kiểm tra log sử dụng key trong khoảng thời gian bị lộ.</li>
      <li>Tìm nguyên nhân (commit nhầm? đóng gói nhầm?) và thêm kiểm tra tự động: secret scanning trong git (gitleaks, trufflehog, GitHub secret scanning), quét gói release (bài 02, 21).</li>
    </ol>

    <div class="callout"><p>💡 Đổi câu hỏi từ <em>"làm sao giấu key?"</em> thành <strong>"nếu key này bị đăng lên mạng ngày mai, thiệt hại là gì?"</strong>.
    Nếu câu trả lời khiến bạn lo — key đó không được ở trong app.</p></div>
  `,

  codeTabs: [
    { id: "hide", label: "🙈 Các cách 'giấu'", lines: [
      "// 1. BuildConfig / .env — vẫn nằm trong gói",
      "buildConfigField(\"String\", \"AI_KEY\", \"\\\"<secret>\\\"\")",
      "",
      "// 2. Mã hoá key bằng khoá cũng nằm trong app",
      "val key = decrypt(ENCRYPTED_KEY, HARDCODED_AES_KEY)",
      "",
      "// 3. Native (C++) — chuỗi vẫn trích được, hàm vẫn hook được",
      "external fun getApiKey(): String",
      "",
      "// 4. Tải từ server — ai gọi endpoint cũng lấy được",
      "val key = api.get(\"/config\").aiKey",
      "",
      "// Điểm chung: cuối cùng key xuất hiện trong header request -> proxy là thấy"
    ]},
    { id: "proxy", label: "✅ Proxy qua backend", lines: [
      "// App: không biết gì về key AI",
      "api.post('/assistant/ask', { question })",
      "",
      "// Backend",
      "handle POST /assistant/ask (req):",
      "    user = authenticate(req)",
      "    rateLimit('ask:' + user.id, max=30, per='1h')",
      "    budget.check(user.plan)                       // giới hạn chi phí theo gói",
      "    q = validate(req.body.question, maxLength=2000)",
      "    answer = aiProvider.complete(q, apiKey=env.AI_KEY)   // secret chỉ ở server",
      "    return { answer }"
    ]},
    { id: "scoped", label: "🎫 Credential tạm, phạm vi hẹp", lines: [
      "// Upload ảnh đại diện trực tiếp lên storage mà không cần secret trong app",
      "",
      "// Backend cấp URL ký sẵn cho ĐÚNG một object, hết hạn sau 5 phút",
      "handle POST /me/avatar/upload-url (req):",
      "    user = authenticate(req)",
      "    objectKey = 'avatars/' + user.id + '/' + uuid() + '.jpg'",
      "    url = storage.presignPut(objectKey, contentType='image/jpeg',",
      "                             maxBytes=5_000_000, expiresIn='5m')",
      "    return { url, objectKey }",
      "",
      "// App",
      "const { url } = await api.post('/me/avatar/upload-url')",
      "await fetch(url, { method: 'PUT', body: jpegBlob })"
    ]},
    { id: "restrict", label: "🔒 Giới hạn key công khai", lines: [
      "# Maps / Places key (cấu hình trên console nhà cung cấp)",
      "Application restriction : Android apps -> com.shop + SHA-256 chữ ký phát hành",
      "                          iOS apps     -> com.shop.ios",
      "API restriction         : chỉ Maps SDK for Android/iOS",
      "Quota                   : 50k request/ngày, cảnh báo ngân sách",
      "",
      "# Firebase / Supabase: key công khai, bảo vệ bằng quy tắc",
      "match /users/{uid} { allow read, write: if request.auth.uid == uid; }",
      "create policy own_rows on profiles using (auth.uid() = user_id);",
      "",
      "# Bật attestation (App Check) để từ chối client không phải app thật"
    ]},
    { id: "scan", label: "🔍 Phát hiện sớm", lines: [
      "# Pre-commit / CI: quét secret trong repo",
      "gitleaks detect --source . --redact",
      "",
      "# CI: quét gói release (bài 02)",
      "unzip -o app-release.apk -d out && grep -rEi 'sk_live|AKIA|BEGIN PRIVATE KEY|service_account' out",
      "",
      "# Khi phát hiện lộ",
      "1. Rotate key ngay (tạo mới -> cập nhật -> vô hiệu key cũ)",
      "2. Xem log sử dụng key trong thời gian bị lộ",
      "3. Viết lại lịch sử git KHÔNG đủ: key đã lộ phải coi như bị lấy"
    ]}
  ],

  stageHtml: `
    <div class="node" id="key"><div class="nl">🔑 Key trong app</div><div class="ns">.env · BuildConfig · native · mã hoá · tải về</div></div>
    <div class="arrow" id="a1">↓ lúc chạy phải có dạng rõ</div>
    <div class="row">
      <div class="node" id="mem"><div class="nl">🧠 Bộ nhớ</div><div class="ns">hook / đọc bộ nhớ</div></div>
      <div class="node" id="req"><div class="nl">📤 Header request</div><div class="ns">proxy trên máy người dùng</div></div>
    </div>
    <div class="arrow" id="a2">↓ vì vậy phân loại key</div>
    <div class="row">
      <div class="node" id="pub"><div class="nl">🌐 Key công khai</div><div class="ns">giới hạn app · API · quota · rules</div></div>
      <div class="node" id="sec"><div class="nl">🔐 Secret</div><div class="ns">chỉ ở backend</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="backend"><div class="nl">🖥️ Backend proxy / credential tạm</div><div class="ns">xác thực user · rate limit · ngân sách</div></div>
  `,

  steps: [
    { title: "1 · Mọi cách giấu đều có điểm yếu chung", tab: "hide", highlight: [2, 5, 8, 11, 13], on: ["key", "a1"],
      desc: "Dù giấu ở đâu, để dùng được key app phải có dạng rõ trong bộ nhớ và gửi nó trong request." },
    { title: "2 · Bộ nhớ và request đều quan sát được", tab: "hide", highlight: [13], on: ["mem", "req"],
      desc: "Người kiểm soát thiết bị hook hàm, đọc bộ nhớ, hoặc chỉ cần xem header qua proxy. Giấu kỹ chỉ tăng thời gian, không đổi kết quả." },
    { title: "3 · Phân loại: công khai hay bí mật?", tab: "restrict", highlight: [2, 3, 4, 5], on: ["a2", "pub"],
      desc: "Key công khai theo thiết kế được phép trong app, nhưng phải giới hạn theo app, API, quota trên console nhà cung cấp." },
    { title: "4 · Quyền dữ liệu nằm ở quy tắc", tab: "restrict", highlight: [8, 9, 11], on: ["pub"],
      desc: "Firebase/Supabase key công khai; Security Rules / RLS mới quyết định ai đọc được gì. Thêm App Check để lọc client giả." },
    { title: "5 · Secret → backend proxy", tab: "proxy", highlight: [2, 6, 7, 8, 10], on: ["sec", "a3", "backend"],
      desc: "App chỉ gửi câu hỏi. Backend xác thực, rate limit, giới hạn chi phí, rồi gọi nhà cung cấp bằng key trong biến môi trường." },
    { title: "6 · Credential tạm thời, phạm vi hẹp", tab: "scoped", highlight: [6, 7, 8, 12, 13], on: ["backend"],
      desc: "Khi client cần gọi trực tiếp: presigned URL cho đúng một object, giới hạn kích thước và hết hạn sau vài phút." },
    { title: "7 · Phát hiện và xử lý khi lộ", tab: "scan", highlight: [2, 5, 8, 9, 10], on: ["key"],
      desc: "Secret scanning trong git và trong gói release; khi lộ thì rotate ngay và kiểm tra log. Xoá khỏi lịch sử git không làm key hết lộ." }
  ],

  quiz: [
    { q: "Đặt API key trong .env/BuildConfig có giấu được key khỏi người dùng không?", options: [
        "Có, vì .env không commit",
        "Không — giá trị được nhúng vào gói app; chỉ giúp giữ key khỏi repo",
        "Có, trên iOS",
        "Có, nếu bật R8"
      ], correct: 1,
      explanation: "Cơ chế build thay biến bằng giá trị thật trong gói." },
    { q: "Vì sao 'mã hoá key rồi giải mã lúc chạy' không bảo vệ được key?", options: [
        "Vì AES yếu",
        "Vì khoá giải mã cũng trong app, và key rõ vẫn xuất hiện trong bộ nhớ/request",
        "Vì chậm",
        "Vì không hỗ trợ Flutter"
      ], correct: 1,
      explanation: "Chỉ thêm một bước cho kẻ phân tích." },
    { q: "Key nào KHÔNG bao giờ được nằm trong app?", options: [
        "Stripe publishable key",
        "Stripe secret key / service account JSON / JWT signing key",
        "Maps SDK key có giới hạn",
        "Firebase web config"
      ], correct: 1,
      explanation: "Secret key cho quyền server-side; phải ở backend." },
    { q: "Dữ liệu Firestore được bảo vệ bởi gì khi Firebase config công khai?", options: [
        "Giấu apiKey",
        "Security Rules (và App Check)",
        "Obfuscation",
        "HTTPS là đủ"
      ], correct: 1,
      explanation: "Config công khai theo thiết kế; quyền đọc/ghi do Rules quyết định." },
    { q: "App cần gọi API AI trả phí. Thiết kế đúng?", options: [
        "Nhúng key, obfuscate kỹ",
        "App gọi backend; backend xác thực user, rate limit, giới hạn ngân sách và gọi AI bằng key ở server",
        "Tải key từ server khi mở app",
        "Chia key thành 3 phần"
      ], correct: 1,
      explanation: "Key ở server, và backend kiểm soát được ai dùng bao nhiêu." },
    { q: "Presigned URL giúp gì?", options: [
        "Cho app secret của storage",
        "Cho client quyền tạm thời, phạm vi hẹp (một object, có hạn) mà không cần secret",
        "Mã hoá file",
        "Tăng tốc download"
      ], correct: 1,
      explanation: "Credential ngắn hạn, phạm vi nhỏ thay cho secret dài hạn." },
    { q: "Phát hiện secret đã bị commit và đẩy lên repo công khai. Việc đầu tiên?", options: [
        "Viết lại lịch sử git là đủ",
        "Rotate secret ngay (vô hiệu key cũ), rồi kiểm tra log sử dụng",
        "Đổi repo sang private",
        "Chờ xem có ai dùng không"
      ], correct: 1,
      explanation: "Secret đã lộ coi như đã bị lấy; chỉ vô hiệu hoá mới chặn được." },
    { q: "Giới hạn key Maps theo package name + SHA-256 chữ ký có ý nghĩa gì?", options: [
        "Là xác thực mạnh không thể vượt",
        "Giảm lạm dụng từ nơi khác, nhưng không phải xác thực mạnh; kết hợp quota và API restriction",
        "Vô dụng hoàn toàn",
        "Thay thế HTTPS"
      ], correct: 1,
      explanation: "Giới hạn dựa trên thông tin client gửi; là một lớp giảm rủi ro." },
    { q: "Obfuscation (R8/ProGuard) có tác dụng gì với chuỗi API key hằng?", options: [
        "Mã hoá chuỗi",
        "Gần như không — nó đổi tên lớp/hàm, chuỗi hằng vẫn đọc được",
        "Xoá chuỗi",
        "Chuyển chuỗi lên server"
      ], correct: 1,
      explanation: "Obfuscation ≠ bảo mật cho secret." }
  ]
});
