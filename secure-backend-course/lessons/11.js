window.LESSONS.push({
  id: "11",
  phase: "2", phaseName: "Xác thực & phiên đăng nhập",
  title: "Đăng nhập an toàn",
  subtitle: "Rate limit · lockout vs throttling · MFA (TOTP/WebAuthn) · thông báo lỗi trung tính · quên mật khẩu · xác thực lại",

  theory: `
    <p>Bài 10 bảo vệ mật khẩu khi <em>database</em> bị lộ. Bài này bảo vệ <strong>cửa đăng nhập</strong> — endpoint mà cả Internet gọi được.
    Kẻ tấn công không cần hack server; họ chỉ cần gửi thật nhiều request đăng nhập và hy vọng một cái đúng.</p>

    <p><strong>1. Các kiểu đoán mật khẩu hàng loạt</strong> (hiểu để phòng thủ)</p>
    <table>
      <tr><th>Kiểu</th><th>Mô tả</th><th>Vì sao khó chặn</th></tr>
      <tr><td>Brute force</td><td>Thử rất nhiều mật khẩu cho <em>một</em> tài khoản</td><td>Dễ phát hiện nếu đếm theo tài khoản</td></tr>
      <tr><td>Password spraying</td><td>Thử <em>vài</em> mật khẩu phổ biến cho <em>rất nhiều</em> tài khoản</td><td>Mỗi tài khoản chỉ sai 1–2 lần → không chạm ngưỡng khoá</td></tr>
      <tr><td>Credential stuffing</td><td>Dùng cặp email/mật khẩu bị lộ từ trang <em>khác</em></td><td>Tỉ lệ đúng cao vì người dùng dùng lại mật khẩu; request đến từ hàng nghìn IP</td></tr>
    </table>
    <p>Vì vậy không có biện pháp đơn lẻ nào đủ — cần <strong>nhiều lớp</strong>: giới hạn theo tài khoản, theo IP, theo toàn hệ thống, cộng MFA và kiểm tra mật khẩu đã lộ (bài 10).</p>

    <p><strong>2. Rate limit — đếm theo nhiều chiều</strong></p>
    <ul>
      <li><strong>Theo tài khoản</strong> (email/username đã chuẩn hoá): chống brute force một tài khoản.</li>
      <li><strong>Theo IP / dải IP</strong>: chống một nguồn thử nhiều tài khoản. Cẩn thận: nhiều người dùng chung một IP (công ty, NAT nhà mạng).</li>
      <li><strong>Toàn cục</strong>: tỉ lệ đăng nhập thất bại tăng vọt bất thường → bật CAPTCHA/thử thách, cảnh báo đội vận hành.</li>
      <li>Lưu bộ đếm ở chỗ dùng chung (Redis…) chứ không trong RAM từng instance; áp dụng cho <em>mọi</em> cửa xác thực: login web, API mobile, đặt lại mật khẩu, xác minh OTP.</li>
    </ul>

    <p><strong>3. Lockout (khoá cứng) hay throttling (làm chậm dần)?</strong></p>
    <table>
      <tr><th></th><th>Lockout: sai 5 lần → khoá tài khoản 24h</th><th>Throttling: sai càng nhiều càng phải chờ lâu</th></tr>
      <tr><td>Ưu</td><td>Đơn giản</td><td>Kẻ tấn công bị làm chậm cực mạnh, chủ tài khoản vẫn vào được sau chờ ngắn</td></tr>
      <tr><td>Nhược</td><td>Ai cũng có thể <em>cố tình</em> khoá tài khoản người khác (từ chối dịch vụ) chỉ bằng cách nhập sai</td><td>Phức tạp hơn một chút</td></tr>
    </table>
    <p>Khuyến nghị: <strong>throttling tăng dần</strong> (ví dụ chờ 1s, 2s, 4s… tối đa vài phút) + yêu cầu CAPTCHA/MFA sau vài lần sai + thông báo cho chủ tài khoản.
    Nếu dùng lockout thì có thời hạn ngắn và có kênh mở khoá an toàn.</p>

    <p><strong>4. Thông báo lỗi không lộ tài khoản tồn tại (chống user enumeration)</strong></p>
    <ul>
      <li>❌ "Email không tồn tại" / "Sai mật khẩu" → kẻ tấn công biết email nào có tài khoản để tập trung đoán.</li>
      <li>✅ Luôn trả cùng một câu: <em>"Email hoặc mật khẩu không đúng"</em>, cùng HTTP status, cùng cấu trúc body.</li>
      <li>Cả <strong>thời gian phản hồi</strong> cũng phải giống nhau: nếu email không tồn tại mà trả lời ngay (không chạy hash chậm) thì chỉ cần đo thời gian là biết. Cách chữa: vẫn chạy verify với một hash giả.</li>
      <li>Áp dụng cho mọi nơi: đăng ký ("Nếu email hợp lệ, chúng tôi đã gửi thư xác nhận"), quên mật khẩu, API kiểm tra username.</li>
    </ul>

    <p><strong>5. MFA — xác thực nhiều yếu tố</strong></p>
    <p>Mật khẩu có thể bị lộ (stuffing, phishing). MFA đòi thêm một thứ người dùng <em>có</em> (điện thoại, khoá bảo mật). Các lựa chọn, từ mạnh đến yếu:</p>
    <table>
      <tr><th>Yếu tố</th><th>Cách hoạt động</th><th>Đánh giá</th></tr>
      <tr><td><strong>WebAuthn / Passkey</strong></td><td>Thiết bị giữ khoá riêng, ký thử thách từ server; chữ ký gắn với tên miền</td><td>Mạnh nhất, <strong>chống phishing</strong> — trang giả khác tên miền không dùng được chữ ký</td></tr>
      <tr><td><strong>TOTP</strong> (app Authenticator)</td><td>Server và app chia sẻ một secret; cả hai tính mã 6 số từ secret + thời gian (30s)</td><td>Tốt, nhưng mã vẫn có thể bị lừa nhập vào trang giả</td></tr>
      <tr><td>SMS / email OTP</td><td>Server gửi mã qua tin nhắn</td><td>Yếu hơn (chiếm SIM, đọc trộm); vẫn hơn không có gì</td></tr>
    </table>
    <p>Khi triển khai TOTP: secret lưu <em>mã hoá</em> (vì server cần đọc lại để tính mã); chỉ chấp nhận cửa sổ ±1 bước thời gian; mỗi mã chỉ dùng được <strong>một lần</strong>;
    rate limit ô nhập mã (6 số = chỉ 1 triệu khả năng); cấp <strong>mã khôi phục</strong> dùng một lần, lưu dạng hash như mật khẩu.</p>

    <p><strong>6. Luồng quên mật khẩu an toàn</strong></p>
    <ol>
      <li>Nhận email → luôn trả lời trung tính "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn".</li>
      <li>Sinh token bằng <strong>CSPRNG</strong>, ≥ 128 bit (ví dụ 32 byte ngẫu nhiên, mã hoá base64url). Không dùng <code>Math.random()</code>, timestamp, hay ID tăng dần.</li>
      <li>Trong DB chỉ lưu <strong>hash của token</strong> (SHA-256 là đủ vì token đã ngẫu nhiên và dài) + user_id + thời điểm hết hạn (15–60 phút).</li>
      <li>Link gửi qua email chứa token gốc. Tạo link bằng <strong>domain cấu hình sẵn</strong>, không lấy từ header <code>Host</code> của request (kẻ tấn công sửa header được).</li>
      <li>Khi user bấm link: hash token nhận được, tìm trong DB, kiểm tra còn hạn, chưa dùng. Đặt mật khẩu mới (áp dụng chính sách bài 10).</li>
      <li><strong>Vô hiệu token</strong> ngay sau khi dùng (một lần), vô hiệu các token reset khác của user đó, <strong>đăng xuất mọi phiên</strong> đang mở, gửi email thông báo "mật khẩu vừa được đổi".</li>
      <li>Trang đặt lại mật khẩu đặt <code>Referrer-Policy: no-referrer</code> để token trong URL không rò sang trang khác.</li>
    </ol>

    <p><strong>7. Thao tác nhạy cảm cần xác thực lại (re-authentication)</strong><br>
    Nếu ai đó mượn được máy đang đăng nhập, hoặc đánh cắp được cookie phiên, họ không được phép tự đổi email/mật khẩu để chiếm hẳn tài khoản. Vì vậy:</p>
    <ul>
      <li>Đổi mật khẩu: yêu cầu nhập <strong>mật khẩu hiện tại</strong>.</li>
      <li>Đổi email: yêu cầu mật khẩu/MFA, gửi link xác nhận tới <strong>email mới</strong>, và gửi thông báo (kèm link huỷ) tới <strong>email cũ</strong>.</li>
      <li>Tắt MFA, xem mã khôi phục, thêm phương thức thanh toán, xoá tài khoản: xác thực lại nếu lần đăng nhập gần nhất đã quá X phút.</li>
    </ul>

    <div class="callout"><p>💡 Checklist review đăng nhập: rate limit theo tài khoản + IP + toàn cục? throttling thay vì khoá cứng vĩnh viễn? thông báo lỗi và thời gian phản hồi giống nhau?
    MFA có sẵn (ưu tiên WebAuthn)? token reset ngẫu nhiên, lưu hash, hết hạn nhanh, một lần? đổi mật khẩu thì đăng xuất các phiên khác? thao tác nhạy cảm có xác thực lại? có log + cảnh báo đăng nhập bất thường?</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Đăng nhập ngây thơ", lines: [
      "function login(email, password):",
      "    user = db.findUserByEmail(email)",
      "    if user == null:",
      "        return 404('Email không tồn tại')        // lộ tài khoản nào có thật",
      "    if not verify(user.password_hash, password):",
      "        return 401('Sai mật khẩu')               // thông báo khác nhau",
      "    return createSession(user)",
      "",
      "// Không giới hạn số lần thử -> script thử hàng triệu lần",
      "// Nhánh 'không tồn tại' trả lời ngay, nhánh 'sai mật khẩu' chạy hash chậm",
      "//   -> đo thời gian phản hồi cũng phân biệt được"
    ]},
    { id: "good", label: "✅ Đăng nhập nhiều lớp", lines: [
      "DUMMY_HASH = argon2id.hash('dummy-password-for-timing')",
      "",
      "function login(email, password, ip):",
      "    email = normalize(email)                       // lowercase, trim",
      "    if rateLimiter.tooMany('ip:' + ip) or rateLimiter.tooMany('acct:' + email):",
      "        return 429('Thử lại sau ít phút')",
      "",
      "    user = db.findUserByEmail(email)",
      "    hash = user ? user.password_hash : DUMMY_HASH   // thời gian như nhau",
      "    ok = argon2id.verify(hash, password) and user != null",
      "",
      "    if not ok:",
      "        rateLimiter.recordFailure('ip:' + ip, 'acct:' + email)",
      "        audit.log('login_failed', { email, ip })   // KHÔNG log password",
      "        return 401('Email hoặc mật khẩu không đúng')",
      "",
      "    rateLimiter.reset('acct:' + email)",
      "    if user.mfaEnabled: return requireMfa(user)     // chưa cấp session đầy đủ",
      "    return createSession(user)"
    ]},
    { id: "throttle", label: "⏳ Throttling", lines: [
      "// Chờ tăng dần theo số lần sai liên tiếp của tài khoản",
      "function delayFor(failures):",
      "    if failures < 3: return 0",
      "    return min(2 ^ (failures - 3), 300)   // 1s, 2s, 4s ... tối đa 5 phút",
      "",
      "function checkThrottle(email):",
      "    f = store.get('fail:' + email) or 0",
      "    wait = delayFor(f)",
      "    if now() < store.get('last:' + email) + wait:",
      "        return 429 with header Retry-After: wait",
      "    if f >= 5: requireCaptchaOrMfa()",
      "    if f == 10: notifyOwner(email, 'Nhiều lần đăng nhập sai')"
    ]},
    { id: "reset", label: "🔁 Quên mật khẩu", lines: [
      "function requestReset(email):",
      "    user = db.findUserByEmail(normalize(email))",
      "    if user:",
      "        token = base64url(csprng.bytes(32))          // 256 bit ngẫu nhiên",
      "        db.insert('reset_tokens', { user_id: user.id,",
      "            token_hash: sha256(token), expires_at: now() + 30min, used: false })",
      "        mail.send(user.email, CONFIG.APP_URL + '/reset?token=' + token)  // domain cấu hình",
      "    return 200('Nếu email tồn tại, chúng tôi đã gửi hướng dẫn')",
      "",
      "function doReset(token, newPassword):",
      "    row = db.findResetToken(sha256(token))",
      "    if not row or row.used or row.expires_at < now(): return 400('Link không hợp lệ hoặc đã hết hạn')",
      "    checkPasswordPolicy(newPassword)                 // bài 10",
      "    db.update(row.user_id, { password_hash: argon2id.hash(newPassword) })",
      "    db.invalidateAllResetTokens(row.user_id)         // dùng một lần",
      "    sessions.revokeAll(row.user_id)                  // đăng xuất mọi nơi",
      "    mail.notify(row.user_id, 'Mật khẩu của bạn vừa được thay đổi')"
    ]},
    { id: "mfa", label: "📱 MFA + xác thực lại", lines: [
      "// TOTP: mã 6 số từ secret chung + thời gian",
      "function verifyTotp(user, code):",
      "    if rateLimiter.tooMany('totp:' + user.id): return false",
      "    secret = decrypt(user.totp_secret_encrypted)",
      "    for step in [-1, 0, +1]:                         // cho lệch đồng hồ 30s",
      "        if constantTimeEquals(totp(secret, now() + step*30), code):",
      "            if usedCodes.contains(user.id, code): return false   // chống dùng lại",
      "            usedCodes.add(user.id, code); return true",
      "    return false",
      "",
      "// Thao tác nhạy cảm: đổi email",
      "function changeEmail(session, currentPassword, newEmail):",
      "    if not verify(session.user.password_hash, currentPassword): return 403",
      "    sendConfirmLink(newEmail)                        // xác nhận ở email mới",
      "    notify(session.user.email, 'Có yêu cầu đổi email', cancelLink)   // báo email cũ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">🌐 POST /login</div><div class="ns">email + mật khẩu, từ bất kỳ đâu trên Internet</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="rl"><div class="nl">🚦 Rate limit / throttling</div><div class="ns">theo IP · theo tài khoản · toàn cục</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="check"><div class="nl">🔍 Kiểm tra mật khẩu</div><div class="ns">hash giả nếu user không tồn tại → thời gian như nhau</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="fail"><div class="nl">⛔ 401 trung tính</div><div class="ns">"Email hoặc mật khẩu không đúng" · ghi log</div></div>
      <div class="node" id="mfa"><div class="nl">📱 MFA</div><div class="ns">WebAuthn / TOTP · mã dùng một lần</div></div>
    </div>
    <div class="arrow" id="a4">↓ đạt</div>
    <div class="row">
      <div class="node" id="session"><div class="nl">🎫 Tạo phiên</div><div class="ns">bài 12</div></div>
      <div class="node" id="reset"><div class="nl">🔁 Quên mật khẩu</div><div class="ns">token CSPRNG · lưu hash · 30 phút · một lần</div></div>
      <div class="node" id="reauth"><div class="nl">🔐 Xác thực lại</div><div class="ns">đổi email / mật khẩu / tắt MFA</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Đăng nhập ngây thơ lộ gì?", tab: "bad", highlight: [3, 4, 5, 6, 9, 10], on: ["req", "check"],
      desc: "Hai thông báo khác nhau cho biết email nào có thật. Không giới hạn số lần thử. Thời gian phản hồi hai nhánh khác nhau cũng là một kênh rò rỉ." },
    { title: "2 · Rate limit nhiều chiều", tab: "good", highlight: [4, 5, 6, 13], on: ["req", "a1", "rl"],
      desc: "Đếm theo cả IP lẫn tài khoản (đã chuẩn hoá). Credential stuffing đến từ nhiều IP nên cần thêm theo dõi tỉ lệ thất bại toàn cục." },
    { title: "3 · Throttling thay vì khoá cứng", tab: "throttle", highlight: [2, 3, 4, 10, 11, 12], on: ["rl"],
      desc: "Chờ tăng dần làm kẻ tấn công chậm hàng nghìn lần nhưng không cho phép ai đó cố tình khoá tài khoản người khác. Sau vài lần sai thì đòi CAPTCHA/MFA và báo chủ tài khoản." },
    { title: "4 · Lỗi trung tính, thời gian như nhau", tab: "good", highlight: [1, 9, 10, 14, 15], on: ["a2", "check", "a3", "fail"],
      desc: "Luôn chạy verify (với hash giả nếu không có user) và luôn trả cùng một câu. Ghi log sự kiện nhưng tuyệt đối không log mật khẩu." },
    { title: "5 · MFA", tab: "mfa", highlight: [3, 4, 5, 6, 7, 8], on: ["mfa"],
      desc: "TOTP: secret lưu mã hoá, cho lệch ±1 bước, mỗi mã một lần, rate limit ô nhập. Ưu tiên WebAuthn/passkey vì chống phishing." },
    { title: "6 · Quên mật khẩu đúng cách", tab: "reset", highlight: [4, 6, 7, 8, 12, 15, 16], on: ["reset"],
      desc: "Token 256 bit từ CSPRNG, chỉ lưu hash, hết hạn 30 phút, dùng một lần, link dựng từ domain cấu hình. Đổi xong thì đăng xuất mọi phiên và báo cho user." },
    { title: "7 · Xác thực lại khi thao tác nhạy cảm", tab: "mfa", highlight: [12, 13, 14, 15], on: ["a4", "session", "reauth"],
      desc: "Có cookie phiên chưa đủ để đổi email/mật khẩu. Hỏi lại mật khẩu hoặc MFA, xác nhận ở email mới, báo và cho huỷ ở email cũ." }
  ],

  quiz: [
    { q: "Password spraying khác brute force ở điểm nào?", options: [
        "Spraying thử vài mật khẩu phổ biến trên rất nhiều tài khoản, nên mỗi tài khoản hiếm khi chạm ngưỡng khoá",
        "Spraying chỉ nhắm vào admin",
        "Spraying cần biết mật khẩu hash",
        "Không khác gì nhau"
      ], correct: 0,
      explanation: "Vì vậy chỉ đếm theo tài khoản là không đủ; cần thêm giới hạn theo IP và theo dõi tỉ lệ thất bại toàn cục." },
    { q: "Credential stuffing hiệu quả chủ yếu vì lý do gì?", options: [
        "Vì server dùng HTTP",
        "Vì người dùng dùng lại cùng mật khẩu ở nhiều trang, và danh sách lộ từ trang khác có sẵn",
        "Vì hash quá chậm",
        "Vì thiếu CAPTCHA ở trang chủ"
      ], correct: 1,
      explanation: "Phòng thủ: MFA, kiểm tra mật khẩu đã lộ, rate limit nhiều chiều, phát hiện đăng nhập bất thường." },
    { q: "Nhược điểm lớn của lockout cứng (sai 5 lần khoá 24h)?", options: [
        "Tốn dung lượng DB",
        "Làm hash chậm hơn",
        "Bất kỳ ai cũng có thể cố tình khoá tài khoản người khác chỉ bằng cách nhập sai nhiều lần",
        "Không chặn được brute force"
      ], correct: 2,
      explanation: "Throttling tăng dần + CAPTCHA/MFA giảm tốc kẻ tấn công mà không biến tính năng khoá thành công cụ từ chối dịch vụ." },
    { q: "Thông báo lỗi đăng nhập nào an toàn nhất?", options: [
        "\"Email không tồn tại\"",
        "\"Sai mật khẩu cho tài khoản này\"",
        "\"Tài khoản bị khoá do sai quá nhiều\" chỉ hiển thị với email có thật",
        "\"Email hoặc mật khẩu không đúng\" cho mọi trường hợp"
      ], correct: 3,
      explanation: "Thông báo, status code và cấu trúc body giống nhau cho mọi trường hợp để không lộ email nào có tài khoản." },
    { q: "Vì sao code đăng nhập vẫn chạy verify với một hash giả khi không tìm thấy user?", options: [
        "Để thời gian phản hồi giống trường hợp user tồn tại, tránh lộ tài khoản qua đo thời gian",
        "Để tạo tài khoản mới tự động",
        "Để kiểm tra thư viện còn hoạt động",
        "Để tăng tải cho server"
      ], correct: 0,
      explanation: "Hash chậm mất hàng chục ms; nhánh bỏ qua hash trả lời ngay sẽ lộ thông tin qua timing." },
    { q: "Token đặt lại mật khẩu nên được sinh và lưu thế nào?", options: [
        "ID tự tăng, lưu nguyên văn",
        "Timestamp + email, mã hoá base64",
        "≥ 128 bit từ CSPRNG, lưu hash của token, có hạn ngắn, dùng một lần",
        "Math.random() rồi lưu trong cookie"
      ], correct: 2,
      explanation: "Lưu hash để DB bị lộ cũng không dùng được token. Hết hạn nhanh và một lần giới hạn thời gian token có giá trị." },
    { q: "Vì sao link đặt lại mật khẩu phải dựng từ domain cấu hình sẵn thay vì header Host?", options: [
        "Vì header Host luôn rỗng",
        "Vì kẻ tấn công có thể sửa Host, khiến email chứa link trỏ về domain của họ và token bị gửi tới đó",
        "Vì domain cấu hình ngắn hơn",
        "Vì email không hỗ trợ header Host"
      ], correct: 1,
      explanation: "Header Host do client gửi. Dùng nó để dựng link là tin dữ liệu ngoài ranh giới." },
    { q: "Sau khi user đặt lại mật khẩu thành công, nên làm gì?", options: [
        "Không cần làm gì thêm",
        "Gửi mật khẩu mới qua email cho user",
        "Giữ token để user dùng lại lần sau",
        "Vô hiệu token, thu hồi mọi phiên đang mở, gửi email thông báo đã đổi mật khẩu"
      ], correct: 3,
      explanation: "Nếu kẻ tấn công đang giữ phiên cũ, thu hồi phiên sẽ đẩy họ ra. Email thông báo giúp chủ tài khoản phát hiện nếu không phải họ đổi." },
    { q: "Loại MFA nào chống được phishing tốt nhất?", options: [
        "SMS OTP",
        "Email OTP",
        "WebAuthn / Passkey",
        "Câu hỏi bảo mật"
      ], correct: 2,
      explanation: "Chữ ký WebAuthn gắn với tên miền; trang giả mạo khác domain không nhận được chữ ký dùng được cho trang thật." },
    { q: "Người đang có phiên đăng nhập muốn đổi email tài khoản. Luồng an toàn là gì?", options: [
        "Đổi ngay vì đã có phiên",
        "Yêu cầu mật khẩu hiện tại/MFA, gửi link xác nhận tới email mới, gửi thông báo kèm link huỷ tới email cũ",
        "Chỉ gửi thông báo tới email mới",
        "Yêu cầu CAPTCHA"
      ], correct: 1,
      explanation: "Phiên có thể bị đánh cắp hoặc máy bị mượn. Xác thực lại + thông báo email cũ ngăn chiếm hẳn tài khoản." }
  ]
});
