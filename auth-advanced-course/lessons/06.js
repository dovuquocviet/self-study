window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "OAuth 2.0 cốt lõi",
  title: "Authorization Code + PKCE — từng tham số một",
  subtitle: "state · redirect_uri · code_verifier/code_challenge S256 · đổi code lấy token",

  theory: `
    <p>Đây là luồng bạn sẽ dùng 90% thời gian. Hiểu từng tham số là hiểu vì sao nó an toàn.</p>

    <p><strong>Request tới /authorize</strong></p>
    <table>
      <tr><th>Tham số</th><th>Ý nghĩa</th><th>Chống lại</th></tr>
      <tr><td><code>response_type=code</code></td><td>Muốn nhận authorization code</td><td>—</td></tr>
      <tr><td><code>client_id</code></td><td>App nào đang xin</td><td>—</td></tr>
      <tr><td><code>redirect_uri</code></td><td>Trả code về đâu; phải <strong>khớp chính xác</strong> URI đã đăng ký</td><td>Gửi code tới domain kẻ gian</td></tr>
      <tr><td><code>scope</code></td><td>Quyền xin, cách nhau bằng dấu cách</td><td>Xin thừa quyền</td></tr>
      <tr><td><code>state</code></td><td>Giá trị ngẫu nhiên client lưu trong session, AS trả lại nguyên vẹn</td><td>CSRF trên callback (bị gắn code của người khác)</td></tr>
      <tr><td><code>code_challenge</code> + <code>code_challenge_method=S256</code></td><td>Băm của một bí mật chỉ client biết</td><td>Code bị chặn giữa đường rồi đem đi đổi</td></tr>
      <tr><td><code>nonce</code> (OIDC)</td><td>Gắn id_token với phiên đăng nhập này</td><td>Replay id_token</td></tr>
    </table>

    <p><strong>PKCE (RFC 7636) trong 3 dòng</strong></p>
    <ol>
      <li>Client sinh <code>code_verifier</code>: chuỗi ngẫu nhiên 43–128 ký tự (<code>A-Z a-z 0-9 - . _ ~</code>).</li>
      <li><code>code_challenge</code> = BASE64URL(SHA256(code_verifier)), không padding <code>=</code>. Gửi challenge lên /authorize.</li>
      <li>Khi đổi code ở /token, gửi <code>code_verifier</code> gốc. AS băm lại, so với challenge đã lưu. Kẻ chặn được code không có verifier → không đổi được.</li>
    </ol>
    <p>Method <code>plain</code> (challenge = verifier) chỉ tồn tại cho thiết bị không có SHA-256 — không dùng. PKCE ban đầu cho mobile, nay OAuth 2.1 bắt buộc cho <em>mọi</em> client, kể cả confidential.</p>

    <p><strong>Request tới /token</strong>: <code>grant_type=authorization_code</code>, <code>code</code>, <code>redirect_uri</code> (giống lúc authorize), <code>code_verifier</code>,
    cộng xác thực client nếu là confidential (bài 08). Code dùng <strong>một lần</strong>, sống rất ngắn (khuyến nghị ≤ 10 phút, thực tế thường 30–60 giây);
    dùng lại code đã dùng thì AS nên thu hồi cả các token đã phát từ code đó.</p>

    <p><strong>Lỗi trả về</strong> theo chuẩn: trên redirect (<code>?error=access_denied&amp;state=...</code>) hoặc JSON từ /token
    (<code>invalid_grant</code>, <code>invalid_client</code>, <code>invalid_request</code>, <code>unauthorized_client</code>, <code>unsupported_grant_type</code>, <code>invalid_scope</code>).</p>

    <div class="callout"><p>💡 <code>state</code> bảo vệ <em>client</em> khỏi callback giả; PKCE bảo vệ <em>code</em> khỏi bị đem đi đổi. Cần cả hai
    (với OIDC, <code>nonce</code> có thể thay vai trò chống replay). Và <code>redirect_uri</code> phải so khớp chuỗi chính xác, không wildcard.</p></div>
  `,

  codeTabs: [
    { id: "pkce", label: "① Sinh PKCE", lines: [
      "code_verifier  = randomUrlSafe(32 bytes)",
      "               = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'",
      "",
      "code_challenge = base64url( sha256(code_verifier) )   // bỏ dấu '='",
      "               = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'",
      "",
      "state = randomUrlSafe(16 bytes)     // lưu cùng code_verifier vào session",
      "",
      "# Ví dụ trên là vector chuẩn trong RFC 7636 — tự băm để kiểm tra"
    ]},
    { id: "auth", label: "② /authorize", lines: [
      "GET https://as.example.com/authorize",
      "  ?response_type=code",
      "  &client_id=shop-web",
      "  &redirect_uri=https%3A%2F%2Fshop.example.com%2Fcb",
      "  &scope=openid%20profile%20orders.read",
      "  &state=af0ifjsldkj",
      "  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      "  &code_challenge_method=S256",
      "",
      "# user đăng nhập + đồng ý, AS redirect:",
      "302 Location: https://shop.example.com/cb?code=SplxlOBeZQQYbYS6WxSbIA&state=af0ifjsldkj"
    ]},
    { id: "cb", label: "③ Callback", lines: [
      "handle GET /cb (req):",
      "    if req.query.error: showError(req.query.error)",
      "    if req.query.state != session.oauth_state: return 400   // chống CSRF",
      "    tokens = POST https://as.example.com/token {",
      "        grant_type:    'authorization_code',",
      "        code:          req.query.code,",
      "        redirect_uri:  'https://shop.example.com/cb',",
      "        code_verifier: session.code_verifier,",
      "        client_id:     'shop-web'          // + client auth nếu confidential",
      "    }",
      "    delete session.oauth_state, session.code_verifier"
    ]},
    { id: "as", label: "④ AS kiểm tra", lines: [
      "on POST /token (grant_type=authorization_code):",
      "    rec = codes.take(code)                 // lấy và XOÁ (dùng 1 lần)",
      "    if not rec or rec.expired:  error invalid_grant",
      "    if rec.client_id != client_id: error invalid_grant",
      "    if rec.redirect_uri != redirect_uri: error invalid_grant",
      "    if base64url(sha256(code_verifier)) != rec.code_challenge: error invalid_grant",
      "    authenticateClientIfConfidential()",
      "    return issueTokens(rec.user, rec.scope)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="c1"><div class="nl">📱 Client sinh verifier + state</div><div class="ns">challenge = b64url(sha256(verifier))</div></div>
    <div class="arrow" id="a1">↓ /authorize (challenge, state)</div>
    <div class="node" id="as1"><div class="nl">🏛️ AS: đăng nhập + đồng ý</div><div class="ns">lưu challenge gắn với code</div></div>
    <div class="arrow" id="a2">↓ redirect ?code&amp;state</div>
    <div class="node" id="c2"><div class="nl">📱 Client kiểm tra state</div><div class="ns">khớp session?</div></div>
    <div class="arrow" id="a3">↓ /token (code + verifier)</div>
    <div class="node" id="as2"><div class="nl">🏛️ AS băm verifier, so challenge</div><div class="ns">khớp → phát token; code bị xoá</div></div>
  `,
  steps: [
    { title: "1 · Sinh verifier, challenge, state", tab: "pkce", highlight: [1, 2, 4, 5, 7], on: ["c1"],
      desc: "Verifier ở lại trong client. Chỉ bản băm (challenge) đi ra ngoài. State cũng lưu vào session." },
    { title: "2 · Gửi user tới /authorize", tab: "auth", highlight: [2, 4, 6, 7, 8], on: ["a1", "as1"],
      desc: "redirect_uri phải khớp chính xác URI đã đăng ký. AS lưu challenge cùng code sắp phát." },
    { title: "3 · Nhận code, kiểm tra state", tab: "cb", highlight: [2, 3], on: ["a2", "c2"],
      desc: "State không khớp session → có thể là callback giả, từ chối ngay." },
    { title: "4 · Đổi code lấy token", tab: "cb", highlight: [4, 5, 6, 7, 8, 11], on: ["a3"],
      desc: "Gửi code + verifier gốc + cùng redirect_uri. Xong thì xoá state/verifier khỏi session." },
    { title: "5 · AS kiểm tra chặt", tab: "as", highlight: [2, 4, 5, 6], on: ["as2"],
      desc: "Code một lần, đúng client, đúng redirect_uri, và băm verifier phải khớp challenge. Kẻ chặn code không có verifier nên thất bại ở dòng 6." }
  ],

  quiz: [
    { q: "code_challenge với method S256 được tính thế nào?", options: [
        "sha256(client_secret)",
        "BASE64URL(SHA256(code_verifier)), bỏ padding",
        "base64(code_verifier)",
        "HMAC(state, code_verifier)"
      ], correct: 1, explanation: "Theo RFC 7636." },
    { q: "Thứ gì được gửi ở bước /token nhưng KHÔNG gửi ở bước /authorize?", options: [
        "code_challenge", "code_verifier", "client_id", "scope"
      ], correct: 1, explanation: "Verifier chỉ lộ diện ở back-channel, sau khi đã có code." },
    { q: "Tham số state chống lại điều gì?", options: [
        "Code bị chặn và đem đi đổi",
        "CSRF trên callback — client bị ép nhận code/phiên của người khác",
        "Token hết hạn",
        "Brute force mật khẩu"
      ], correct: 1, explanation: "Client so state trả về với giá trị đã lưu trong session của chính user đó." },
    { q: "PKCE chống lại điều gì?", options: [
        "XSS",
        "Authorization code bị đánh chặn (app độc, log, Referer) rồi đem đổi lấy token",
        "SQL injection",
        "Mật khẩu yếu"
      ], correct: 1, explanation: "Không có code_verifier thì code vô dụng." },
    { q: "OAuth 2.1 bắt buộc PKCE cho loại client nào?", options: [
        "Chỉ mobile", "Chỉ SPA", "Mọi client, kể cả confidential", "Không bắt buộc"
      ], correct: 2, explanation: "PKCE còn chống code injection cho confidential client, nên được yêu cầu cho tất cả." },
    { q: "AS nhận lại một authorization code đã dùng rồi. Nên làm gì?", options: [
        "Phát token mới bình thường",
        "Từ chối (invalid_grant) và nên thu hồi các token đã phát từ code đó",
        "Gia hạn code",
        "Chuyển thành refresh token"
      ], correct: 1, explanation: "Code dùng lại là dấu hiệu bị đánh cắp." },
    { q: "redirect_uri nên được AS so khớp thế nào?", options: [
        "Chỉ so domain",
        "Cho phép wildcard *.example.com",
        "So khớp chuỗi chính xác với URI đã đăng ký",
        "Không cần kiểm tra"
      ], correct: 2, explanation: "Khớp lỏng là nguồn gốc nhiều vụ đánh cắp code." },
    { q: "code_challenge_method=plain có nên dùng không?", options: [
        "Có, đơn giản hơn",
        "Không — chỉ cho thiết bị không có SHA-256; plain để lộ verifier ngay ở bước authorize",
        "Bắt buộc cho SPA",
        "Chỉ dùng với OIDC"
      ], correct: 1, explanation: "Với plain, challenge = verifier nên kẻ nhìn thấy request authorize cũng có luôn verifier." },
    { q: "Lỗi invalid_grant từ /token thường nghĩa là gì?", options: [
        "Sai client_secret",
        "Code sai/hết hạn/đã dùng, redirect_uri không khớp, hoặc verifier sai",
        "Scope không tồn tại",
        "Server bảo trì"
      ], correct: 1, explanation: "Sai xác thực client là invalid_client; sai grant (code, verifier, refresh token) là invalid_grant." }
  ]
});
