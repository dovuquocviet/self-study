window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Giao tiếp mạng",
  title: "Gọi API từ mobile: server luôn là người gác cổng",
  subtitle: "Không nhúng secret · Backend-for-Frontend · App attestation (Play Integrity, App Attest/DeviceCheck) · server kiểm tra mọi thứ",

  theory: `
    <p>API của app mobile là <strong>API công khai</strong>, dù bạn không công bố tài liệu. Chỉ cần mở gói app (bài 02) hoặc đặt proxy trên máy của chính mình (bài 08)
    là thấy toàn bộ endpoint, tham số, header. Bài này trả lời: <em>thiết kế luồng gọi API thế nào khi biết rằng client có thể bị giả?</em></p>

    <p><strong>1. Không nhúng secret của dịch vụ bên thứ ba vào app</strong></p>
    <ul>
      <li>Sai: app gọi thẳng API thanh toán/OpenAI/SMS/email bằng secret key nhúng trong app → ai lấy được key sẽ dùng quota/tiền của bạn, hoặc tệ hơn là đọc/ghi dữ liệu.</li>
      <li>Đúng: app gọi <strong>backend của bạn</strong>; backend giữ secret và gọi bên thứ ba thay app, kèm kiểm tra quyền, giới hạn tần suất, ghi log.</li>
      <li>Ngoại lệ: key được nhà cung cấp thiết kế để công khai (publishable key thanh toán, API key bản đồ, Firebase config) —
        vẫn phải <strong>giới hạn</strong> phía nhà cung cấp (theo package name + chữ ký app / bundle ID, theo API được phép, quota) và bật quy tắc bảo mật (ví dụ Firebase Security Rules).</li>
    </ul>

    <p><strong>2. Backend-for-Frontend (BFF)</strong></p>
    <p>BFF là một lớp backend <em>dành riêng</em> cho app mobile: app chỉ nói chuyện với BFF; BFF gọi các service nội bộ và bên thứ ba.</p>
    <ul>
      <li>Giữ mọi secret ở server, app không cần biết service nội bộ nào tồn tại.</li>
      <li>Trả về đúng dữ liệu app cần (không trả thừa trường nhạy cảm để app "tự lọc").</li>
      <li>Nơi tập trung xác thực, phân quyền, rate limit, kiểm tra attestation.</li>
      <li>Đổi nhà cung cấp bên thứ ba mà không cần phát hành lại app.</li>
    </ul>

    <p><strong>3. Server kiểm tra mọi thứ — checklist</strong></p>
    <table>
      <tr><th>Kiểm tra</th><th>Ví dụ lỗi nếu thiếu</th></tr>
      <tr><td>Xác thực (token hợp lệ, chưa hết hạn, chưa bị thu hồi)</td><td>Token cũ sau logout vẫn dùng được</td></tr>
      <tr><td>Phân quyền theo <strong>đối tượng</strong> (object-level)</td><td>Đổi <code>/orders/1001</code> thành <code>/orders/1002</code> xem được đơn người khác</td></tr>
      <tr><td>Validate input (kiểu, khoảng, độ dài, field thừa)</td><td>Gửi <code>quantity=-5</code> để được hoàn tiền; gửi <code>role</code> trong body</td></tr>
      <tr><td>Logic nghiệp vụ (giá, số dư, hạn mức, trạng thái)</td><td>App gửi giá tiền, server tin theo</td></tr>
      <tr><td>Rate limit theo user/thiết bị/IP</td><td>Dò OTP, spam SMS, cào dữ liệu</td></tr>
      <tr><td>Không trả dữ liệu thừa</td><td>API trả cả <code>passwordHash</code>, email người khác, "app không hiển thị đâu"</td></tr>
    </table>
    <p>"Ẩn nút trong app" <strong>không phải</strong> phân quyền. Mọi endpoint phải tự kiểm tra như thể request được gửi bằng công cụ dòng lệnh.</p>

    <p><strong>4. App attestation — "request này có đến từ app thật, trên thiết bị thật không?"</strong></p>
    <ul>
      <li><strong>Play Integrity API</strong> (Android): Google trả về token có chữ ký chứa đánh giá: app có đúng bản bạn phát hành (chữ ký, package) không,
        thiết bị có vượt kiểm tra toàn vẹn không, (tuỳ chọn) app có được cài từ Play không.</li>
      <li><strong>App Attest</strong> (iOS, qua <code>DCAppAttestService</code>): sinh khoá trong Secure Enclave, Apple chứng thực khoá thuộc về bản app hợp lệ; sau đó mỗi request quan trọng được ký bằng khoá đó (assertion).
        <strong>DeviceCheck</strong> cho phép lưu 2 bit trạng thái cho mỗi thiết bị phía Apple (ví dụ "đã nhận khuyến mãi").</li>
      <li>Firebase App Check là một lớp bọc tiện dụng dùng các provider trên.</li>
    </ul>
    <p><strong>Quy tắc vàng của attestation</strong>:</p>
    <ol>
      <li>Token phải được <strong>xác minh ở server</strong> (gọi API của Google/Apple hoặc kiểm chữ ký). Kết quả kiểm tra trong app là vô nghĩa.</li>
      <li>Gắn với <strong>nonce/challenge do server sinh</strong> (một lần, có hạn) và gắn với nội dung request → chống dùng lại token cũ.</li>
      <li>Attestation là <strong>tín hiệu rủi ro</strong>, không thay thế xác thực người dùng và phân quyền. Kẻ tấn công vẫn có thể dùng app thật trên máy thật để làm điều xấu.</li>
      <li>Có chính sách khi thất bại: chặn thao tác rủi ro cao, yêu cầu xác thực thêm, hoặc chỉ ghi nhận — tuỳ tính năng. Tính đến người dùng có máy cũ/không có Google Play.</li>
    </ol>

    <p><strong>5. Các header "bí mật" tự chế</strong> — Header kiểu <code>X-App-Secret</code>, chữ ký HMAC bằng khoá nhúng trong app để "chứng minh request từ app"
    không có giá trị bảo mật thật: khoá nằm trong gói, ai trích ra được là ký được. Dùng attestation của nền tảng thay thế.</p>

    <div class="callout"><p>💡 Thiết kế API mobile theo giả định: <strong>"người gọi API là một script do kẻ tấn công viết, có token hợp lệ của một tài khoản bình thường"</strong>.
    Nếu API vẫn đúng trong giả định đó thì bạn đã đặt kiểm soát đúng chỗ.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ App gọi thẳng bên thứ ba", lines: [
      "// React Native — secret nằm trong bundle",
      "fetch('https://api.sms-provider.example/send', {",
      "  headers: { Authorization: 'Bearer <secret_key_nhúng_trong_app>' },",
      "  body: JSON.stringify({ to: phone, text: 'Mã OTP: ' + otp }),   // OTP sinh ở client!",
      "})",
      "",
      "// Hậu quả: ai lấy key cũng gửi SMS bằng tiền của bạn;",
      "// OTP sinh ở client thì client tự 'biết' OTP -> xác thực vô nghĩa"
    ]},
    { id: "bff", label: "✅ Qua BFF", lines: [
      "// App: chỉ gửi ý định",
      "api.post('/auth/otp/request', { phone })",
      "",
      "// BFF (server): giữ secret, kiểm tra, giới hạn",
      "handle POST /auth/otp/request (req):",
      "    phone = validatePhone(req.body.phone)          // 400 nếu sai định dạng",
      "    rateLimit(key='otp:' + phone, max=3, per='10m')",
      "    rateLimit(key='otp-ip:' + req.ip, max=10, per='1h')",
      "    otp = secureRandomDigits(6); store(hash(otp), phone, ttl='5m')",
      "    smsProvider.send(phone, template='otp', secret=env.SMS_KEY)",
      "    return 202"
    ]},
    { id: "authz", label: "🛂 Kiểm tra từng đối tượng", lines: [
      "// SAI: chỉ kiểm tra đã đăng nhập",
      "handle GET /orders/:id (req):",
      "    requireAuth(req)",
      "    return db.orders.find(req.params.id)          // đổi id là xem đơn người khác",
      "",
      "// ĐÚNG: kiểm tra quyền trên CHÍNH đối tượng",
      "handle GET /orders/:id (req):",
      "    user = requireAuth(req)",
      "    order = db.orders.find(id=req.params.id, ownerId=user.id)",
      "    if not order: return 404",
      "    return toPublicDto(order)                     // chỉ trường app cần"
    ]},
    { id: "attest", label: "🪪 Attestation", lines: [
      "// 1. App xin challenge từ server",
      "nonce = api.post('/attest/challenge')             // ngẫu nhiên, 1 lần, hết hạn 60s",
      "",
      "// 2a. Android: Play Integrity",
      "token = integrityManager.requestIntegrityToken(nonce + sha256(requestBody))",
      "// 2b. iOS: App Attest (khoá đã được attest khi cài lần đầu)",
      "assertion = DCAppAttestService.shared.generateAssertion(keyId, clientDataHash)",
      "",
      "// 3. Gửi kèm request nhạy cảm",
      "api.post('/wallet/withdraw', body, headers={ 'X-Attestation': token })",
      "",
      "// 4. SERVER xác minh (không bao giờ tin kết quả client tự báo)",
      "verdict = verifyWithGoogleOrApple(token)",
      "require verdict.appRecognized and verdict.nonce == expectedNonce and not reused",
      "if not verdict.deviceIntegrity: requireStepUp()   // tín hiệu rủi ro, không phải phân quyền"
    ]},
    { id: "keys", label: "🔑 Key công khai có giới hạn", lines: [
      "# Key 'công khai theo thiết kế' vẫn phải giới hạn phía nhà cung cấp",
      "",
      "Maps API key:",
      "  - Chỉ cho Android app: package com.shop + SHA-256 chữ ký phát hành",
      "  - Chỉ cho iOS app:     bundle id com.shop.ios",
      "  - Chỉ bật Maps SDK, tắt mọi API khác; đặt quota ngày",
      "",
      "Firebase:",
      "  - Config trong app là công khai; bảo mật nằm ở Security Rules",
      "  - rules: allow read, write: if request.auth.uid == userId;",
      "  - Bật App Check cho Firestore/Storage/Functions"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="app"><div class="nl">📱 App thật</div><div class="ns">token user + attestation</div></div>
      <div class="node" id="script"><div class="nl">🤖 Script giả mạo</div><div class="ns">có thể có token hợp lệ</div></div>
    </div>
    <div class="arrow" id="a1">↓ HTTPS</div>
    <div class="node" id="bff"><div class="nl">🚪 BFF / API gateway</div><div class="ns">xác thực · attestation · rate limit · validate</div></div>
    <div class="arrow" id="a2">↓ đã kiểm tra</div>
    <div class="row">
      <div class="node" id="svc"><div class="nl">⚙️ Service nội bộ</div><div class="ns">phân quyền theo đối tượng</div></div>
      <div class="node" id="third"><div class="nl">🌐 Bên thứ ba</div><div class="ns">SMS, thanh toán — secret ở server</div></div>
    </div>
    <div class="node" id="verify"><div class="nl">🪪 Google / Apple</div><div class="ns">xác minh token attestation</div></div>
  `,

  steps: [
    { title: "1 · Secret trong app = secret công khai", tab: "bad", highlight: [3, 4, 7, 8], on: ["app", "third"],
      desc: "App gọi thẳng nhà cung cấp SMS bằng secret nhúng trong bundle, lại còn tự sinh OTP. Kẻ lấy key dùng được dịch vụ; client tự biết OTP nên xác thực vô nghĩa." },
    { title: "2 · Chuyển qua BFF", tab: "bff", highlight: [2, 6, 7, 8, 9, 10], on: ["a1", "bff", "a2", "third"],
      desc: "App chỉ gửi số điện thoại. Server validate, rate limit theo số và IP, tự sinh OTP bằng CSPRNG, lưu hash, gọi nhà cung cấp bằng secret trong biến môi trường." },
    { title: "3 · Kẻ gọi API có thể là script", tab: "authz", highlight: [3, 4], on: ["script", "a1", "bff"],
      desc: "Chỉ kiểm tra 'đã đăng nhập' là chưa đủ: script với token hợp lệ đổi id trong URL để đọc dữ liệu người khác (lỗi BOLA/IDOR)." },
    { title: "4 · Phân quyền trên từng đối tượng", tab: "authz", highlight: [8, 9, 10, 11], on: ["bff", "svc"],
      desc: "Truy vấn luôn kèm điều kiện sở hữu; trả DTO chỉ gồm trường app cần. Không có chuyện 'app không hiển thị nên trả thừa cũng được'." },
    { title: "5 · Attestation có nonce", tab: "attest", highlight: [2, 5, 7, 10], on: ["app", "bff"],
      desc: "Server phát challenge một lần; app gắn nó (và hash nội dung request) vào token Play Integrity hoặc assertion App Attest." },
    { title: "6 · Server xác minh, coi là tín hiệu", tab: "attest", highlight: [13, 14, 15], on: ["bff", "verify"],
      desc: "Chỉ server xác minh token với Google/Apple. Kết quả là tín hiệu rủi ro: thiết bị không đạt → yêu cầu xác thực thêm; không thay thế phân quyền." },
    { title: "7 · Key công khai vẫn phải có hàng rào", tab: "keys", highlight: [4, 5, 6, 9, 10, 11], on: ["third"],
      desc: "Maps key giới hạn theo app và API; Firebase config công khai nhưng Security Rules + App Check mới là lớp bảo vệ thật." }
  ],

  quiz: [
    { q: "App cần gửi SMS OTP. Thiết kế nào đúng?", options: [
        "App nhúng secret của nhà cung cấp SMS và tự gửi",
        "App gọi backend; backend sinh OTP, giữ secret, rate limit và gửi SMS",
        "App sinh OTP rồi gửi lên server để so sánh",
        "Mã hoá secret bằng base64 trong app"
      ], correct: 1,
      explanation: "Secret và việc sinh OTP phải ở server; client không được biết OTP trước." },
    { q: "Backend-for-Frontend (BFF) mang lại lợi ích gì cho bảo mật?", options: [
        "Làm app nhỏ hơn",
        "Giữ secret ở server, tập trung xác thực/phân quyền/rate limit, chỉ trả dữ liệu app cần",
        "Thay thế HTTPS",
        "Tự động obfuscate app"
      ], correct: 1,
      explanation: "BFF là điểm kiểm soát duy nhất giữa app không đáng tin và hệ thống nội bộ." },
    { q: "GET /orders/:id chỉ kiểm tra token hợp lệ. Lỗ hổng là gì?", options: [
        "Không có lỗ hổng",
        "Người dùng đổi id để xem đơn của người khác (BOLA/IDOR)",
        "SQL injection chắc chắn xảy ra",
        "Token bị lộ"
      ], correct: 1,
      explanation: "Phải kiểm tra quyền trên chính đối tượng, ví dụ điều kiện ownerId = user.id." },
    { q: "Kết quả Play Integrity / App Attest nên được xác minh ở đâu?", options: [
        "Trong app, rồi gửi cờ isValid=true lên server",
        "Ở server, gọi Google/Apple hoặc kiểm chữ ký, kèm kiểm tra nonce",
        "Không cần xác minh",
        "Trong WebView"
      ], correct: 1,
      explanation: "Cờ do client tự báo có thể bị sửa. Chỉ xác minh ở server mới có ý nghĩa." },
    { q: "Vì sao attestation cần nonce do server sinh?", options: [
        "Để token ngắn hơn",
        "Để chống dùng lại token cũ (replay) và gắn token với đúng request",
        "Để tăng tốc",
        "Apple không yêu cầu"
      ], correct: 1,
      explanation: "Nonce một lần, có hạn, gắn với nội dung request khiến token lấy được không thể dùng lại." },
    { q: "Attestation đạt (app thật, thiết bị thật). Server có thể bỏ qua phân quyền không?", options: [
        "Có, vì request đến từ app thật",
        "Không — người dùng thật với app thật vẫn có thể cố truy cập dữ liệu người khác",
        "Có, trên iOS",
        "Có, nếu thiết bị không root"
      ], correct: 1,
      explanation: "Attestation trả lời 'app nào, máy nào', không trả lời 'người này có quyền không'." },
    { q: "Header X-App-Secret với giá trị cố định nhúng trong app để 'chứng minh request đến từ app' — đánh giá?", options: [
        "Là cơ chế bảo mật mạnh",
        "Không có giá trị bảo mật thật: giá trị nằm trong gói, ai trích ra cũng gửi được",
        "Mạnh nếu đổi mỗi năm",
        "Mạnh nếu dùng HTTPS"
      ], correct: 1,
      explanation: "Dùng attestation của nền tảng để chứng minh nguồn gốc app." },
    { q: "Firebase config (apiKey…) nằm trong app. Bảo mật dữ liệu Firestore dựa vào đâu?", options: [
        "Giấu apiKey thật kỹ",
        "Security Rules phía Firebase (và App Check)",
        "Obfuscation",
        "Không thể bảo mật"
      ], correct: 1,
      explanation: "Firebase config được thiết kế công khai; quy tắc truy cập mới quyết định ai đọc/ghi được gì." },
    { q: "API trả object user đầy đủ gồm passwordHash, app chỉ hiển thị tên. Vấn đề?", options: [
        "Không vấn đề vì app không hiển thị",
        "Dữ liệu thừa lộ cho bất kỳ ai xem response (proxy, script); API phải trả DTO tối thiểu",
        "Chỉ tốn băng thông",
        "Chỉ vấn đề trên Android"
      ], correct: 1,
      explanation: "Response API là công khai với người gọi; lọc ở server, không lọc ở app." }
  ]
});
