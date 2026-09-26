window.LESSONS.push({
  id: "12",
  phase: "2", phaseName: "Xác thực & phiên đăng nhập",
  title: "Session & token",
  subtitle: "Cookie flags · session ID từ CSPRNG · chống session fixation · hết hạn & thu hồi · JWT dùng đúng · logout thật sự",

  theory: `
    <p>HTTP không có "trí nhớ": mỗi request là độc lập. Sau khi đăng nhập thành công (bài 11), server phải đưa cho trình duyệt/app một
    <strong>vật chứng nhận</strong> để các request sau chứng minh "tôi là người vừa đăng nhập". Vật đó là <em>session ID</em> hoặc <em>token</em>.
    Ai cầm được nó thì <strong>là</strong> người dùng đó — không cần mật khẩu, không cần MFA. Vì vậy bảo vệ session quan trọng ngang bảo vệ mật khẩu.</p>

    <p><strong>1. Hai mô hình phổ biến</strong></p>
    <table>
      <tr><th></th><th>Session phía server (stateful)</th><th>Token tự chứa (JWT, stateless)</th></tr>
      <tr><td>Client giữ gì</td><td>Một chuỗi ngẫu nhiên vô nghĩa (session ID)</td><td>Một token chứa dữ liệu (user id, quyền, hạn) + chữ ký</td></tr>
      <tr><td>Server lưu gì</td><td>Bảng/Redis: session_id → user, hạn, thiết bị…</td><td>Không cần lưu gì (chỉ cần khoá kiểm chữ ký)</td></tr>
      <tr><td>Thu hồi (logout, khoá user)</td><td>Dễ: xoá bản ghi là xong</td><td>Khó: token vẫn hợp lệ tới khi hết hạn, trừ khi thêm denylist</td></tr>
      <tr><td>Phù hợp</td><td>Web app truyền thống, hầu hết trường hợp</td><td>Nhiều service cần kiểm tra danh tính mà không gọi về trung tâm</td></tr>
    </table>
    <p>Nếu không có lý do rõ ràng, <strong>session phía server + cookie</strong> là lựa chọn đơn giản và an toàn hơn.</p>

    <p><strong>2. Sinh session ID</strong></p>
    <ul>
      <li>Dùng <strong>CSPRNG</strong> (bộ sinh số ngẫu nhiên an toàn mật mã), ≥ 128 bit entropy: <code>crypto.randomBytes(32)</code>, <code>secrets.token_urlsafe(32)</code>, <code>SecureRandom</code>, <code>crypto/rand</code>.</li>
      <li>Không dùng <code>Math.random()</code>, <code>rand()</code>, timestamp, hash(user_id + time) — đều đoán được.</li>
      <li>Session ID không chứa thông tin gì (không có email, không có user id). Tốt nhất dùng cơ chế session có sẵn của framework thay vì tự viết.</li>
      <li>Có thể lưu <em>hash</em> của session ID trong DB để DB bị lộ cũng không dùng được các phiên đang mở.</li>
    </ul>

    <p><strong>3. Cookie flags — cấu hình bắt buộc</strong></p>
    <table>
      <tr><th>Thuộc tính</th><th>Tác dụng</th></tr>
      <tr><td><code>HttpOnly</code></td><td>JavaScript trên trang không đọc được cookie → nếu trang dính XSS, script độc không lấy trộm được session ID.</td></tr>
      <tr><td><code>Secure</code></td><td>Chỉ gửi qua HTTPS → không lộ trên mạng Wi-Fi công cộng.</td></tr>
      <tr><td><code>SameSite=Lax</code> (hoặc <code>Strict</code>)</td><td>Trình duyệt không gửi cookie trong hầu hết request do trang <em>khác</em> khởi tạo → giảm mạnh CSRF (bài về CSRF). <code>None</code> chỉ khi thật sự cần và phải kèm <code>Secure</code>.</td></tr>
      <tr><td>Tiền tố <code>__Host-</code></td><td>Tên cookie <code>__Host-sid</code> buộc trình duyệt chỉ nhận nếu có <code>Secure</code>, <code>Path=/</code>, <strong>không</strong> có <code>Domain</code> → subdomain khác không ghi đè được.</td></tr>
      <tr><td><code>Path=/</code>, không đặt <code>Domain</code></td><td>Cookie chỉ thuộc đúng host này, không chia sẻ cho mọi subdomain.</td></tr>
      <tr><td><code>Max-Age</code> / không đặt</td><td>Không đặt = cookie phiên trình duyệt; đặt thì nên ngắn, khớp với hạn phía server.</td></tr>
    </table>

    <p><strong>4. Đổi session ID sau khi đăng nhập (chống session fixation)</strong><br>
    Nếu server giữ nguyên session ID từ lúc <em>chưa</em> đăng nhập, kẻ tấn công có thể tìm cách khiến nạn nhân dùng một session ID mà kẻ tấn công đã biết trước;
    nạn nhân đăng nhập → session ID đó được "nâng cấp" thành đã đăng nhập → kẻ tấn công dùng luôn. Cách chữa rất đơn giản:
    <strong>mỗi khi mức quyền thay đổi</strong> (đăng nhập, qua bước MFA, chuyển sang quyền admin) → huỷ session cũ, cấp session ID mới
    (<code>req.session.regenerate()</code>, <code>request.changeSessionId()</code>, <code>session_regenerate_id(true)</code>, <code>cycle_key()</code>).</p>

    <p><strong>5. Hết hạn và thu hồi</strong></p>
    <ul>
      <li><strong>Idle timeout</strong>: không hoạt động quá 15–30 phút (tuỳ độ nhạy cảm) → hết hạn.</li>
      <li><strong>Absolute timeout</strong>: dù hoạt động liên tục, sau 8–24h (hoặc vài ngày với tính năng "ghi nhớ đăng nhập") vẫn phải đăng nhập lại.</li>
      <li>Kiểm tra hạn <strong>ở server</strong>, không tin vào việc cookie hết hạn ở trình duyệt.</li>
      <li>Thu hồi: logout, đổi mật khẩu, khoá tài khoản, người dùng bấm "đăng xuất khỏi mọi thiết bị" → xoá (hoặc đánh dấu) các session tương ứng.</li>
    </ul>

    <p><strong>6. JWT — dùng đúng cách</strong></p>
    <p>JWT gồm 3 phần <code>header.payload.signature</code>, mỗi phần mã hoá base64url. Payload <strong>chỉ được mã hoá base64, không bí mật</strong>: ai cầm token đều đọc được.
    Chữ ký chỉ đảm bảo <em>không ai sửa được</em> nội dung. Các lỗi hay gặp và cách phòng:</p>
    <table>
      <tr><th>Lỗi</th><th>Cách đúng</th></tr>
      <tr><td>Chỉ <em>decode</em> token mà quên <em>verify</em> chữ ký</td><td>Luôn gọi hàm verify của thư viện; không đọc payload trước khi verify thành công.</td></tr>
      <tr><td>Tin trường <code>alg</code> trong header do client gửi (kể cả <code>none</code>, hoặc đổi thuật toán bất đối xứng sang đối xứng)</td><td><strong>Allowlist thuật toán</strong> phía server: <code>algorithms: ['ES256']</code>. Mỗi khoá gắn cố định với một thuật toán.</td></tr>
      <tr><td>Không kiểm tra hạn và đối tượng</td><td>Kiểm tra <code>exp</code> (hết hạn), <code>nbf</code>, <code>iss</code> (ai phát hành), <code>aud</code> (token dành cho service nào) — token của service A không được dùng ở service B.</td></tr>
      <tr><td>Nhét dữ liệu bí mật vào payload (email, số điện thoại, quyền nội bộ chi tiết)</td><td>Chỉ để định danh tối thiểu (<code>sub</code>, <code>scope</code>). Cần bí mật thì dùng JWE hoặc tra ở server.</td></tr>
      <tr><td>Khoá HMAC yếu ("secret", "changeme")</td><td>Khoá ≥ 256 bit ngẫu nhiên từ secret manager, hoặc dùng khoá bất đối xứng (ES256/EdDSA/RS256) và xoay vòng (key id <code>kid</code>).</td></tr>
      <tr><td>Access token sống 30 ngày</td><td>Access token <strong>ngắn</strong> (5–15 phút) + refresh token.</td></tr>
    </table>

    <p><strong>7. Access token ngắn + refresh token xoay vòng (rotation)</strong></p>
    <ul>
      <li>Access token: ngắn hạn, gửi kèm mỗi request API. Lộ thì chỉ dùng được vài phút.</li>
      <li>Refresh token: chuỗi ngẫu nhiên dài, <strong>lưu phía server</strong> (dạng hash) nên thu hồi được; chỉ dùng để xin access token mới; trên web nên nằm trong cookie <code>HttpOnly</code>.</li>
      <li><strong>Rotation</strong>: mỗi lần dùng refresh token, server cấp refresh token <em>mới</em> và vô hiệu cái cũ. Nếu một refresh token <em>đã dùng rồi</em> lại được gửi lên
      → dấu hiệu bị đánh cắp → thu hồi <strong>cả chuỗi</strong> (family) và bắt đăng nhập lại.</li>
      <li>Không lưu token trong <code>localStorage</code> của web nếu tránh được — XSS đọc được toàn bộ localStorage.</li>
    </ul>

    <p><strong>8. Logout thật sự</strong></p>
    <ul>
      <li>❌ Chỉ xoá cookie/token phía client: ai đã sao chép được session ID/token vẫn dùng tiếp.</li>
      <li>✅ Xoá session ở server (hoặc thu hồi refresh token + đưa <code>jti</code> của access token vào denylist tới khi hết hạn), rồi xoá cookie
      (gửi lại cookie cùng tên, cùng thuộc tính, <code>Max-Age=0</code>). Có thể thêm header <code>Clear-Site-Data</code>.</li>
      <li>Hỗ trợ "đăng xuất khỏi mọi thiết bị" và danh sách phiên đang hoạt động để người dùng tự kiểm tra.</li>
    </ul>

    <div class="callout"><p>💡 Checklist review: session ID từ CSPRNG ≥ 128 bit? cookie có HttpOnly + Secure + SameSite (+ __Host-)? regenerate ID sau đăng nhập/MFA?
    idle + absolute timeout kiểm tra ở server? logout xoá ở server? JWT: verify chữ ký, allowlist thuật toán, kiểm tra exp/iss/aud, không có dữ liệu bí mật, access ngắn, refresh rotation có phát hiện dùng lại?</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Session yếu", lines: [
      "// Session ID đoán được",
      "sid = md5(user.id + currentTime())",
      "",
      "// Giữ nguyên session trước đăng nhập -> session fixation",
      "session = sessions.get(req.cookie.sid)",
      "session.userId = user.id",
      "",
      "// Cookie thiếu cờ bảo vệ",
      "res.setHeader('Set-Cookie', 'sid=' + sid)       // JS đọc được, gửi cả qua HTTP",
      "",
      "// Logout chỉ ở phía client",
      "function logout(): res.clearCookie('sid')        // session ở server vẫn sống"
    ]},
    { id: "good", label: "✅ Session an toàn", lines: [
      "function onLoginSuccess(req, res, user):",
      "    sessions.destroy(req.cookie['__Host-sid'])       // bỏ session cũ",
      "    sid = base64url(csprng.bytes(32))                // 256 bit ngẫu nhiên, ID mới",
      "    sessions.save(sha256(sid), { userId: user.id,",
      "        createdAt: now(), lastSeen: now(), ip, userAgent })",
      "    res.setCookie('__Host-sid', sid, { httpOnly: true, secure: true,",
      "        sameSite: 'Lax', path: '/' })                   // không đặt Domain",
      "",
      "function loadSession(req):",
      "    s = sessions.get(sha256(req.cookie['__Host-sid']))",
      "    if not s: return null",
      "    if now() - s.lastSeen > 30min or now() - s.createdAt > 12h:",
      "        sessions.destroy(s); return null                // idle + absolute timeout",
      "    s.lastSeen = now(); return s",
      "",
      "function logout(req, res):",
      "    sessions.destroy(sha256(req.cookie['__Host-sid']))  // xoá ở server",
      "    res.setCookie('__Host-sid', '', { maxAge: 0, secure: true, path: '/' })"
    ]},
    { id: "jwt", label: "🪪 JWT verify", lines: [
      "// ❌ Chỉ decode: ai cũng tự tạo được payload",
      "claims = jwt.decode(token)",
      "",
      "// ✅ Verify đầy đủ",
      "claims = jwt.verify(token, publicKeyFor(header.kid), {",
      "    algorithms: ['ES256'],          // allowlist; không bao giờ nhận 'none'",
      "    issuer: 'https://auth.example.com',",
      "    audience: 'orders-api',          // token cho service khác -> từ chối",
      "    clockTolerance: 30s             // exp/nbf được kiểm tra tự động",
      "})",
      "",
      "// Payload chỉ chứa định danh tối thiểu, KHÔNG có dữ liệu bí mật",
      "// { sub: 'u_81f2', scope: 'orders:read', exp: ..., jti: '...' }",
      "if denylist.contains(claims.jti): reject(401)     // token đã logout"
    ]},
    { id: "refresh", label: "🔄 Refresh rotation", lines: [
      "function refresh(oldRefreshToken):",
      "    row = db.findRefresh(sha256(oldRefreshToken))",
      "    if not row or row.expiresAt < now(): return 401",
      "",
      "    if row.used:",
      "        // Token đã dùng rồi lại xuất hiện -> có người đang giữ bản sao",
      "        db.revokeFamily(row.familyId)                 // thu hồi cả chuỗi",
      "        alert('refresh_token_reuse', row.userId)",
      "        return 401",
      "",
      "    db.markUsed(row.id)",
      "    newRefresh = base64url(csprng.bytes(32))",
      "    db.insertRefresh({ hash: sha256(newRefresh), familyId: row.familyId,",
      "        userId: row.userId, expiresAt: now() + 14d })",
      "    access = jwt.sign({ sub: row.userId }, key, { alg: 'ES256', expiresIn: '10m' })",
      "    return { access, refresh: newRefresh }"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Node.js (express-session)",
      "app.use(session({ name: '__Host-sid', cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30*60*1000 } }))",
      "req.session.regenerate(cb)   // sau đăng nhập",
      "",
      "# Python (Django settings)",
      "SESSION_COOKIE_HTTPONLY = True; SESSION_COOKIE_SECURE = True; SESSION_COOKIE_SAMESITE = 'Lax'",
      "",
      "# Java (Spring Security)",
      "http.sessionManagement(s -> s.sessionFixation(f -> f.changeSessionId()))",
      "",
      "# PHP",
      "session_set_cookie_params(['httponly'=>true,'secure'=>true,'samesite'=>'Lax']); session_regenerate_id(true);",
      "",
      "# Go (JWT, golang-jwt)",
      "jwt.Parse(tok, keyFunc, jwt.WithValidMethods([]string{\"ES256\"}), jwt.WithAudience(\"orders-api\"), jwt.WithIssuer(iss))"
    ]}
  ],

  stageHtml: `
    <div class="node" id="login"><div class="nl">✅ Đăng nhập thành công</div><div class="ns">sau mật khẩu + MFA (bài 11)</div></div>
    <div class="arrow" id="a1">↓ huỷ session cũ · sinh ID mới</div>
    <div class="node" id="gen"><div class="nl">🎲 Session ID / token mới</div><div class="ns">CSPRNG ≥ 128 bit · chống fixation</div></div>
    <div class="arrow" id="a2">↓ Set-Cookie</div>
    <div class="node" id="cookie"><div class="nl">🍪 __Host-sid</div><div class="ns">HttpOnly · Secure · SameSite=Lax · Path=/</div></div>
    <div class="arrow" id="a3">↓ mỗi request</div>
    <div class="row">
      <div class="node" id="store"><div class="nl">🗄️ Session store</div><div class="ns">idle + absolute timeout · thu hồi được</div></div>
      <div class="node" id="jwt"><div class="nl">🪪 JWT verify</div><div class="ns">chữ ký · alg allowlist · exp/iss/aud</div></div>
    </div>
    <div class="arrow" id="a4">↓</div>
    <div class="row">
      <div class="node" id="refresh"><div class="nl">🔄 Refresh rotation</div><div class="ns">dùng lại token cũ → thu hồi cả chuỗi</div></div>
      <div class="node" id="logout"><div class="nl">🚪 Logout thật sự</div><div class="ns">xoá ở server + xoá cookie</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Những lỗi session phổ biến", tab: "bad", highlight: [2, 5, 6, 9, 12], on: ["gen", "cookie"],
      desc: "ID đoán được, giữ nguyên ID sau đăng nhập (fixation), cookie thiếu cờ, logout chỉ xoá phía client. Mỗi lỗi đều dẫn tới cùng hậu quả: người khác cầm được phiên." },
    { title: "2 · Sinh ID mới sau đăng nhập", tab: "good", highlight: [2, 3, 4, 5], on: ["login", "a1", "gen"],
      desc: "Huỷ session cũ, sinh ID 256 bit bằng CSPRNG, lưu hash ở server. Làm lại mỗi khi mức quyền thay đổi (qua MFA, lên admin)." },
    { title: "3 · Cookie flags", tab: "good", highlight: [6, 7], on: ["a2", "cookie"],
      desc: "<code>HttpOnly</code> chống script đọc cookie, <code>Secure</code> chỉ gửi qua HTTPS, <code>SameSite</code> giảm CSRF, tiền tố <code>__Host-</code> chặn subdomain ghi đè." },
    { title: "4 · Hết hạn kiểm tra ở server", tab: "good", highlight: [10, 11, 12, 13, 14], on: ["a3", "store"],
      desc: "Idle timeout và absolute timeout được kiểm tra trên dữ liệu phía server, không phụ thuộc trình duyệt có xoá cookie hay không." },
    { title: "5 · JWT: verify, đừng chỉ decode", tab: "jwt", highlight: [2, 5, 6, 7, 8, 13], on: ["jwt"],
      desc: "Allowlist thuật toán, kiểm tra <code>iss</code>/<code>aud</code>/<code>exp</code>. Payload chỉ là base64 — ai cũng đọc được — nên không để dữ liệu bí mật trong đó." },
    { title: "6 · Access ngắn + refresh xoay vòng", tab: "refresh", highlight: [5, 7, 11, 12, 15], on: ["a4", "refresh"],
      desc: "Access token 10 phút; refresh token lưu hash ở server, mỗi lần dùng đổi cái mới. Token cũ bị dùng lại là dấu hiệu bị trộm → thu hồi cả chuỗi." },
    { title: "7 · Logout thật sự", tab: "good", highlight: [16, 17, 18], on: ["logout", "store"],
      desc: "Xoá session ở server rồi mới xoá cookie. Với JWT: thu hồi refresh token và đưa <code>jti</code> vào denylist tới khi access token hết hạn." }
  ],

  quiz: [
    { q: "Vì sao session ID phải sinh bằng CSPRNG thay vì md5(user_id + thời gian)?", options: [
        "Vì md5 chạy chậm",
        "Vì giá trị dựa trên user_id và thời gian có thể đoán được, kẻ tấn công tự tính ra session của người khác",
        "Vì CSPRNG cho chuỗi ngắn hơn",
        "Vì md5 không chạy trên server"
      ], correct: 1,
      explanation: "Session ID phải không đoán được: ≥ 128 bit ngẫu nhiên từ bộ sinh an toàn mật mã." },
    { q: "Cờ HttpOnly trên cookie phiên có tác dụng gì?", options: [
        "Chỉ gửi cookie qua HTTPS",
        "Chặn gửi cookie từ trang khác",
        "JavaScript trên trang không đọc được cookie, nên script độc (XSS) không lấy trộm được session ID",
        "Mã hoá nội dung cookie"
      ], correct: 2,
      explanation: "Secure lo phần HTTPS, SameSite lo request từ trang khác. HttpOnly lo phần JavaScript." },
    { q: "Session fixation được phòng chống bằng cách nào?", options: [
        "Cấp session ID mới (regenerate) mỗi khi đăng nhập hoặc mức quyền thay đổi",
        "Đặt session sống lâu hơn",
        "Lưu session ID trong localStorage",
        "Dùng session ID ngắn hơn"
      ], correct: 0,
      explanation: "Nếu ID trước đăng nhập bị kẻ tấn công biết, việc đổi ID lúc đăng nhập làm ID đó vô giá trị." },
    { q: "Cookie có tên bắt đầu bằng __Host- được trình duyệt đảm bảo điều gì?", options: [
        "Chỉ gửi tới localhost",
        "Tự động mã hoá",
        "Không bao giờ hết hạn",
        "Phải có Secure, Path=/ và không có Domain, nên subdomain khác không ghi đè được"
      ], correct: 3,
      explanation: "Tiền tố __Host- khoá cookie vào đúng host, giảm rủi ro từ subdomain bị chiếm hoặc kém an toàn." },
    { q: "Payload của JWT (không mã hoá JWE) có bí mật không?", options: [
        "Có, vì đã được ký",
        "Không, chỉ là base64url — ai cầm token cũng đọc được; chữ ký chỉ chống sửa",
        "Có, nếu dùng HS256",
        "Chỉ bí mật với trình duyệt"
      ], correct: 1,
      explanation: "Không để email, số điện thoại, dữ liệu nội bộ trong payload. Chỉ định danh tối thiểu." },
    { q: "Vì sao server phải có allowlist thuật toán khi verify JWT?", options: [
        "Để verify nhanh hơn",
        "Để token ngắn hơn",
        "Vì trường alg trong header do client kiểm soát; tin nó có thể dẫn tới chấp nhận 'none' hoặc nhầm loại khoá",
        "Vì thư viện bắt buộc"
      ], correct: 2,
      explanation: "Server quyết định thuật toán, không để token tự khai. Mỗi khoá gắn cố định với một thuật toán." },
    { q: "Trường aud trong JWT dùng để làm gì?", options: [
        "Ghi thời điểm phát hành",
        "Xác định token dành cho service nào — token cấp cho service A không được chấp nhận ở service B",
        "Chứa mật khẩu người dùng",
        "Chọn thuật toán ký"
      ], correct: 1,
      explanation: "Cùng với iss (ai phát hành) và exp (hạn), aud ngăn dùng token sai chỗ." },
    { q: "Trong refresh token rotation, nếu một refresh token ĐÃ DÙNG lại được gửi lên thì server nên làm gì?", options: [
        "Cấp access token mới như bình thường",
        "Bỏ qua và trả về token cũ",
        "Tăng thời hạn token",
        "Coi là dấu hiệu bị đánh cắp: thu hồi cả chuỗi refresh token và bắt đăng nhập lại"
      ], correct: 3,
      explanation: "Chỉ một bên (người dùng hoặc kẻ trộm) có token mới nhất; token cũ xuất hiện lại cho thấy có bản sao." },
    { q: "Logout chỉ bằng cách xoá cookie phía trình duyệt có đủ không?", options: [
        "Không — ai đã sao chép session ID/token vẫn dùng tiếp; phải huỷ phiên ở server",
        "Đủ, vì cookie đã mất",
        "Đủ nếu cookie có HttpOnly",
        "Đủ nếu dùng HTTPS"
      ], correct: 0,
      explanation: "Logout thật sự: xoá session ở server (hoặc thu hồi refresh + denylist jti), rồi xoá cookie." },
    { q: "Idle timeout và absolute timeout khác nhau thế nào?", options: [
        "Không khác gì",
        "Idle: hết hạn khi không hoạt động một khoảng; absolute: hết hạn sau thời gian tối đa kể từ lúc đăng nhập dù vẫn hoạt động",
        "Idle dành cho mobile, absolute dành cho web",
        "Absolute chỉ áp dụng cho admin"
      ], correct: 1,
      explanation: "Cần cả hai và kiểm tra ở server, để một phiên bị đánh cắp không sống mãi." },
    { q: "Vì sao nên tránh lưu token trên web trong localStorage?", options: [
        "Vì localStorage quá nhỏ",
        "Vì localStorage bị xoá mỗi lần tải trang",
        "Vì mọi script chạy trên trang (kể cả script độc qua XSS) đều đọc được localStorage",
        "Vì localStorage không hỗ trợ chuỗi"
      ], correct: 2,
      explanation: "Cookie HttpOnly không đọc được từ JavaScript, nên an toàn hơn cho refresh token/session ID trên web." }
  ]
});
