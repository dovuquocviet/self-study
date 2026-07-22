window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "OAuth 2.0",
  title: "PKCE — OAuth cho mobile app & SPA",
  subtitle: "Khi app KHÔNG giấu nổi client_secret thì chứng minh mình bằng cách nào?",

  theory: `
    <p>Bài 5 có một mắt xích quan trọng: đổi code lấy token phải kèm <code>client_secret</code>.
    Nhưng secret chỉ giấu được trên <em>server</em>. Còn <strong>mobile app</strong> và <strong>SPA</strong>
    (code chạy trong trình duyệt)? Ai tải app về cũng dịch ngược ra secret được — nhét secret vào đó
    coi như công khai. Đây gọi là <strong>public client</strong>: client không có khả năng giữ bí mật.</p>
    <p>Không có secret thì lỗ hổng mở ra: trên điện thoại, app độc có thể đăng ký trùng deep-link
    (<code>myapp://callback</code>) để <strong>chặn bắt authorization code</strong> lúc quay về —
    rồi tự đem code đi đổi token. Vụ này gọi là <em>authorization code interception</em>.</p>
    <p><strong>PKCE</strong> (Proof Key for Code Exchange, đọc là "pích-xi") vá lỗ hổng này bằng một
    <em>bí mật dùng một lần, sinh ra ngay lúc chạy</em>:</p>
    <ol>
      <li>Trước khi redirect, app sinh chuỗi ngẫu nhiên <strong>code_verifier</strong> (giữ trong RAM).</li>
      <li>Băm nó ra <strong>code_challenge = SHA256(verifier)</strong>, gửi kèm bước xin code.
      Auth server <em>ghi nhớ</em> challenge này cạnh code.</li>
      <li>Lúc đổi code lấy token, app nộp <strong>code_verifier gốc</strong>. Server tự băm lại và so:
      SHA256(verifier) có bằng challenge đã ghi nhớ không?</li>
    </ol>
    <p>Kẻ chặn được code thì <em>không có verifier</em> (nó chưa từng rời khỏi RAM của app xịn),
    còn từ challenge không tính ngược ra verifier được (SHA256 một chiều) → code vô dụng với kẻ trộm.</p>
    <div class="callout"><p>💡 PKCE giống việc gửi trước <em>ảnh chụp ổ khoá</em>, đến lấy hàng thì trình
    <em>chìa khoá thật</em>. OAuth 2.1 bắt buộc PKCE cho <strong>mọi</strong> client — kể cả server có secret —
    nên cứ làm OAuth là bật PKCE. Shopify "Login with Code" trong app JMango bạn từng nghe cũng chạy đúng flow Authorization Code + PKCE này.</p></div>
  `,

  codeTabs: [
    { id: "gen", label: "🎲 Sinh cặp khoá", lines: [
      "// Trong app (chạy lúc bấm nút Đăng nhập):",
      "const verifier = randomString(64);",
      "// 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'",
      "",
      "const challenge = base64url(sha256(verifier));",
      "// 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'",
      "",
      "// verifier: GIỮ TRONG RAM, chưa gửi đi đâu cả",
      "// challenge: ảnh chụp ổ khoá — gửi đi trước"
    ]},
    { id: "front", label: "🌐 Xin code", lines: [
      "# 1. Redirect sang auth server, kèm CHALLENGE:",
      "GET https://auth.example.com/authorize",
      "  ?response_type=code",
      "  &client_id=my-mobile-app",
      "  &redirect_uri=myapp://callback",
      "  &scope=orders.read",
      "  &code_challenge=E9Melhoa2Owv...   # ảnh ổ khoá",
      "  &code_challenge_method=S256",
      "",
      "# 2. Đăng nhập + đồng ý xong, auth server GHI NHỚ challenge",
      "#    rồi trả code về app:",
      "myapp://callback?code=SplxlO..."
    ]},
    { id: "back", label: "🔑 Đổi token", lines: [
      "# 3. App đổi code lấy token — nộp VERIFIER thay cho secret:",
      "POST https://auth.example.com/token",
      "",
      "grant_type=authorization_code",
      "&code=SplxlO...",
      "&redirect_uri=myapp://callback",
      "&client_id=my-mobile-app",
      "&code_verifier=dBjftJeZ4CVP...    # chìa khoá thật",
      "",
      "# 4. Server kiểm: sha256(verifier) == challenge đã ghi nhớ?",
      "#    khớp -> phát token. Kẻ trộm code không có verifier -> tèo",
      "{ \"access_token\": \"eyJ...\", \"refresh_token\": \"1//x...\" }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 Mobile app</div><div class="ns">sinh verifier (giữ RAM) + challenge (băm)</div></div>
    <div class="arrow" id="a1">↓ ① xin code, gửi kèm challenge</div>
    <div class="node" id="authsrv"><div class="nl">🏛️ Auth server</div><div class="ns">ghi nhớ challenge cạnh code</div></div>
    <div class="arrow" id="a2">↓ ② trả code qua deep-link myapp://</div>
    <div class="node" id="thief"><div class="nl">😈 App độc</div><div class="ns">rình chặn code — nhưng KHÔNG có verifier</div></div>
    <div class="arrow" id="a3">↓ ③ app xịn nộp code + verifier</div>
    <div class="node" id="check"><div class="nl">🔍 Kiểm tra</div><div class="ns">sha256(verifier) == challenge?</div></div>
    <div class="arrow" id="a4">↓ ④ khớp</div>
    <div class="node" id="token"><div class="nl">🎟️ Token</div><div class="ns">chỉ app giữ verifier mới đổi được</div></div>
  `,
  steps: [
    { title: "1 · Vấn đề: không giấu nổi secret", tab: "gen", highlight: [1, 2], on: ["app"],
      desc: "Mobile app/SPA là <strong>public client</strong> — ai cũng dịch ngược được, nên không thể nhét <code>client_secret</code> cố định. PKCE thay secret cố định bằng bí mật <em>sinh mới mỗi lần đăng nhập</em>: <code>code_verifier</code>." },
    { title: "2 · Băm ra challenge", tab: "gen", highlight: [5, 6, 8, 9], on: ["app"],
      desc: "App băm verifier: <code>challenge = SHA256(verifier)</code>. SHA256 một chiều — từ challenge không tính ngược ra verifier. Challenge là 'ảnh chụp ổ khoá', gửi đi trước được, lộ cũng không sao." },
    { title: "3 · Xin code kèm challenge", tab: "front", highlight: [7, 8, 10], on: ["a1", "authsrv"],
      desc: "Bước xin code y hệt bài 5, thêm 2 tham số: <code>code_challenge</code> + <code>code_challenge_method=S256</code>. Auth server ghi nhớ: 'code SplxlO… đi cặp với challenge E9Mel…'." },
    { title: "4 · Kẻ gian chặn code", tab: "front", highlight: [12], on: ["a2", "thief"],
      desc: "Code quay về qua deep-link <code>myapp://callback</code>. App độc đăng ký trùng scheme có thể chặn được code. Không có PKCE thì đến đây là thua — kẻ gian đem code đi đổi token. Với PKCE thì hắn thiếu một thứ: verifier, vốn chưa từng rời RAM của app xịn." },
    { title: "5 · Nộp verifier — chìa khoá thật", tab: "back", highlight: [8, 10, 11], on: ["a3", "check", "a4", "token"],
      desc: "App xịn đổi code, nộp <code>code_verifier</code> gốc. Server băm lại và so với challenge đã ghi nhớ — khớp thì phát token. Kẻ trộm code nộp gì cũng sai → code trong tay hắn là tờ giấy lộn. OAuth 2.1 bắt buộc PKCE cho mọi client." }
  ],

  quiz: [
    { q: "Vì sao mobile app / SPA không dùng client_secret cố định được?", options: [
        "Vì secret quá dài không lưu nổi",
        "Vì code app nằm trong tay người dùng — ai cũng dịch ngược/xem source lấy được secret",
        "Vì Google cấm",
        "Vì secret chỉ chạy trên Windows"
      ], correct: 1,
      explanation: "App phát cho người dùng = code công khai. Secret nhúng trong đó không còn là secret. Loại client này gọi là public client." },
    { q: "PKCE chống lại tấn công nào?", options: [
        "Đoán mật khẩu (brute force)",
        "Chặn bắt authorization code (ví dụ app độc đăng ký trùng deep-link) rồi đem code đi đổi token",
        "Nghe lén HTTPS",
        "Tấn công từ chối dịch vụ DDoS"
      ], correct: 1,
      explanation: "Kẻ chặn được code nhưng không có code_verifier (chưa từng rời RAM app xịn) → không đổi được token. Đó là 'Proof Key for Code Exchange'." },
    { q: "Quan hệ giữa code_verifier và code_challenge là gì?", options: [
        "challenge = SHA256(verifier) — một chiều, từ challenge không suy ngược ra verifier",
        "verifier = SHA256(challenge)",
        "Hai chuỗi ngẫu nhiên độc lập không liên quan",
        "challenge là verifier viết hoa"
      ], correct: 0,
      explanation: "App sinh verifier ngẫu nhiên, băm SHA256 ra challenge gửi trước. Lúc đổi token mới trình verifier gốc để server băm lại đối chiếu." },
    { q: "Theo OAuth 2.1, PKCE áp dụng cho những client nào?", options: [
        "Chỉ mobile app",
        "Chỉ SPA",
        "Mọi client dùng Authorization Code flow — kể cả server có client_secret",
        "Không client nào, PKCE đã bị loại bỏ"
      ], correct: 2,
      explanation: "OAuth 2.1 gom best practice: PKCE bắt buộc cho tất cả. Server có secret thì PKCE là lớp giáp thêm — phòng cả trường hợp code bị lộ qua log/referrer." }
  ]
});
