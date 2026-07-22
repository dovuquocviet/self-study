window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Danh tính & đăng nhập hiện đại",
  title: "Login with code — OTP, magic link, passwordless",
  subtitle: "'Nhập mã 6 số gửi vào email của bạn' — đăng nhập không cần mật khẩu",

  theory: `
    <p>Ngày càng nhiều app bỏ hẳn ô mật khẩu: Shopify gửi <em>"mã 6 số vào email"</em>, Slack gửi
    <em>magic link</em>, ngân hàng gửi OTP SMS. Gọi chung là <strong>passwordless</strong> —
    và "login with code" là dạng phổ biến nhất.</p>
    <p>Ý tưởng: thay vì hỏi <em>"thứ bạn nhớ"</em> (mật khẩu), server kiểm tra
    <em>"thứ bạn sở hữu"</em> — quyền truy cập hộp mail / số điện thoại:</p>
    <ol>
      <li>Bạn nhập email → server sinh <strong>mã dùng một lần</strong> (OTP — one-time password/passcode),
      ví dụ 6 số, sống 5–10 phút, <em>lưu dạng băm</em> ở server.</li>
      <li>Server gửi mã vào email/SMS của bạn.</li>
      <li>Bạn gõ mã vào app → khớp + còn hạn → server tin: <em>"đúng chủ hộp mail"</em> → cấp session/token như mọi lần đăng nhập khác.</li>
    </ol>
    <p><strong>Magic link</strong> là biến thể: thay vì gõ mã, bấm thẳng link trong email
    (link chứa token dùng một lần) — chính là cách đăng nhập Supabase của trang học này!</p>
    <p>Vì sao mô hình này thắng thế?</p>
    <ul>
      <li>Không mật khẩu → không gì để lộ, không đoán được, không dùng lại được ở site khác, khỏi 'quên mật khẩu'.</li>
      <li>Mã dùng 1 lần, sống ngắn, server phải <strong>giới hạn số lần thử</strong> (5–10 lần) — không thì mã 6 số bị brute-force trong nháy mắt (chỉ có 1 triệu khả năng).</li>
      <li>Điểm yếu dịch chuyển: an toàn của tài khoản = an toàn của <em>hộp mail</em>. Và OTP <em>phishing được</em> — trang giả mạo dụ bạn gõ mã hộ. Chuẩn chống phishing triệt để là passkey (WebAuthn) — nhắc ở bài 12.</li>
    </ul>
    <div class="callout"><p>💡 Đừng nhầm với <strong>authorization code</strong> của OAuth (bài 5) — đó là mã
    <em>giữa các máy</em> trong luồng OAuth, người dùng không nhìn thấy. "Login with code" ở đây là mã
    <em>gửi cho con người</em> qua email/SMS. Trùng chữ 'code', khác hoàn toàn vai trò. (Còn 'mã hiện trên TV
    để bạn nhập bằng điện thoại' là Device Code flow — bài 11.)</p></div>
  `,

  codeTabs: [
    { id: "request", label: "📧 Xin mã", lines: [
      "# 1. Người dùng chỉ nhập email — không có ô mật khẩu:",
      "POST /auth/code/request",
      "{ \"email\": \"an@example.com\" }",
      "",
      "# 2. Server sinh mã ngẫu nhiên, LƯU DẠNG BĂM + hạn 10 phút:",
      "#    otp_store: { email: 'an@…', hash: sha256('482913'),",
      "#                 exp: now+10m, attempts: 0 }",
      "# 3. Gửi mail: 'Mã đăng nhập của bạn là 482913'",
      "",
      "HTTP/1.1 200 OK",
      "{ \"message\": \"Đã gửi mã vào email của bạn\" }"
    ]},
    { id: "verify", label: "🔢 Nộp mã", lines: [
      "# 4. Người dùng gõ mã vừa nhận:",
      "POST /auth/code/verify",
      "{ \"email\": \"an@example.com\", \"code\": \"482913\" }",
      "",
      "# 5. Server kiểm: hash khớp? còn hạn? chưa quá 5 lần thử?",
      "#    -> đúng chủ hộp mail -> XOÁ mã (dùng 1 lần)",
      "#    -> cấp phiên như đăng nhập thường:",
      "HTTP/1.1 200 OK",
      "Set-Cookie: sid=p8q2r5x1; HttpOnly; Secure",
      "",
      "# Sai mã? attempts+1 — quá 5 lần là huỷ mã, phải xin mã mới"
    ]},
    { id: "magic", label: "🪄 Magic link", lines: [
      "# Biến thể: gửi LINK thay vì mã",
      "# Mail chứa:",
      "https://app.example.com/auth/confirm?token=hEr9...one-time",
      "",
      "# Người dùng bấm link -> server kiểm token dùng-1-lần",
      "# -> đăng nhập luôn, không phải gõ gì",
      "",
      "# Trang học này dùng đúng kiểu đó (Supabase magic link)!",
      "# Đổi lại: phải mở được mail TRÊN CÙNG THIẾT BỊ muốn đăng nhập,",
      "# còn OTP thì đọc mã ở điện thoại, gõ vào máy tính cũng được"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">🧑‍💻 Người dùng</div><div class="ns">chỉ nhập email — không mật khẩu</div></div>
    <div class="arrow" id="a1">↓ ① POST /auth/code/request</div>
    <div class="node" id="server"><div class="nl">🖥️ Server</div><div class="ns">sinh mã 482913 · lưu băm · hạn 10 phút</div></div>
    <div class="arrow" id="a2">↓ ② gửi mã qua kênh bạn SỞ HỮU</div>
    <div class="node" id="mail"><div class="nl">📬 Hộp mail / SMS</div><div class="ns">"Mã đăng nhập: 482913"</div></div>
    <div class="arrow" id="a3">↓ ③ người dùng gõ mã vào app</div>
    <div class="node" id="check"><div class="nl">🔍 Kiểm tra</div><div class="ns">khớp băm? còn hạn? ≤5 lần thử? → xoá mã</div></div>
    <div class="arrow" id="a4">↓ ④ đúng chủ hộp mail</div>
    <div class="node" id="session"><div class="nl">🎟️ Phiên đăng nhập</div><div class="ns">cấp session/token như đăng nhập thường</div></div>
  `,
  steps: [
    { title: "1 · Chỉ cần email", tab: "request", highlight: [2, 3], on: ["user", "a1", "server"],
      desc: "Form đăng nhập chỉ có một ô email. Không mật khẩu nghĩa là: không có gì để người dùng quên, không có DB mật khẩu để hacker nhắm tới, không dùng lại mật khẩu cũ ở site khác." },
    { title: "2 · Sinh mã — lưu băm, có hạn", tab: "request", highlight: [5, 6, 7, 8], on: ["server", "a2", "mail"],
      desc: "Server sinh <code>482913</code>, lưu <em>bản băm</em> (DB lộ cũng không đọc được mã), hạn 10 phút, đếm số lần thử. Rồi gửi qua kênh bạn <strong>sở hữu</strong> — hộp mail. Xác thực chuyển từ 'thứ bạn nhớ' sang 'thứ bạn có'." },
    { title: "3 · Nộp mã & các chốt chặn", tab: "verify", highlight: [2, 3, 5], on: ["a3", "check"],
      desc: "Server kiểm 3 điều: băm khớp, còn hạn, chưa quá 5 lần thử. Chốt số-lần-thử là bắt buộc: mã 6 số chỉ có 10⁶ khả năng — không giới hạn thì script đoán hết trong vài phút." },
    { title: "4 · Dùng 1 lần rồi đốt", tab: "verify", highlight: [6, 8, 9], on: ["check", "a4", "session"],
      desc: "Khớp → server <strong>xoá mã ngay</strong> (one-time!) rồi cấp session/cookie hệt bài 2. Từ đây mọi thứ như đăng nhập thường — passwordless chỉ thay <em>bước chứng minh danh tính</em>, không thay phần sau." },
    { title: "5 · Magic link & giới hạn", tab: "magic", highlight: [3, 8, 9, 10], on: ["mail", "session"],
      desc: "Magic link = mã nằm sẵn trong link, bấm là vào — trang học này dùng đúng kiểu đó. Nhớ hai giới hạn của cả họ passwordless-qua-email: (1) tài khoản chỉ an toàn bằng hộp mail của bạn; (2) OTP vẫn bị <em>phishing</em> — trang giả dụ bạn đọc mã cho chúng. Chống phishing triệt để phải dùng passkey (bài 12)." }
  ],

  quiz: [
    { q: "Login bằng mã OTP gửi qua email chứng minh điều gì với server?", options: [
        "Bạn nhớ được mật khẩu",
        "Bạn sở hữu/truy cập được hộp mail đó — xác thực bằng 'thứ bạn có' thay vì 'thứ bạn nhớ'",
        "Máy tính của bạn không có virus",
        "Bạn đang ở Việt Nam"
      ], correct: 1,
      explanation: "Mã chỉ nằm trong hộp mail của bạn. Nộp lại đúng mã = chứng minh quyền truy cập hộp mail — danh tính gắn với thứ bạn sở hữu." },
    { q: "Vì sao server BẮT BUỘC giới hạn số lần thử mã OTP 6 số?", options: [
        "Để tiết kiệm băng thông",
        "Vì mã 6 số chỉ có 1 triệu khả năng — không giới hạn thì bị đoán hết (brute-force) trong vài phút",
        "Vì email chỉ gửi được 5 lần",
        "Để người dùng đỡ mỏi tay"
      ], correct: 1,
      explanation: "10⁶ khả năng là quá ít với máy tính. Giới hạn 5–10 lần thử + hạn 5–10 phút + mã dùng 1 lần là bộ ba chốt chặn tiêu chuẩn." },
    { q: "Điểm khác nhau chính giữa OTP code và magic link là gì?", options: [
        "Magic link an toàn tuyệt đối còn OTP thì không",
        "OTP đọc ở thiết bị này gõ vào thiết bị khác được; magic link phải mở mail trên đúng thiết bị muốn đăng nhập nhưng đổi lại không phải gõ gì",
        "OTP miễn phí còn magic link mất tiền",
        "Magic link chỉ dùng cho admin"
      ], correct: 1,
      explanation: "Cùng cơ chế token-dùng-1-lần-qua-email, khác cách 'vận chuyển': mã để gõ tay (linh hoạt thiết bị chéo), link để bấm (tiện nhưng bó buộc thiết bị)." },
    { q: "'Code' trong 'login with code' khác gì 'authorization code' của OAuth (bài 5)?", options: [
        "Là một — hai tên của cùng một thứ",
        "Login code là mã gửi cho CON NGƯỜI qua email/SMS để chứng minh danh tính; authorization code là mã máy-với-máy trong luồng OAuth, người dùng không nhìn thấy",
        "Authorization code cũng gửi qua email",
        "Login code dài hơn nên an toàn hơn"
      ], correct: 1,
      explanation: "Trùng chữ 'code' nhưng khác vai trò hoàn toàn: một cái là OTP cho người dùng, một cái là 'phiếu hẹn' kỹ thuật giữa client và authorization server." }
  ]
});
