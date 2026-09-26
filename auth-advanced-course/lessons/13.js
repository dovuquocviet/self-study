window.LESSONS.push({
  id: "13",
  phase: "4", phaseName: "Các chuẩn hiện đại",
  title: "PAR, JAR, RAR & FAPI 2.0",
  subtitle: "Đẩy request qua back-channel · ký request · quyền chi tiết · hồ sơ bảo mật cho ngân hàng",

  theory: `
    <p>Request <code>/authorize</code> truyền thống đi qua trình duyệt dưới dạng query string: ai cũng thấy, ai cũng sửa được, và giới hạn độ dài URL.
    Ba chuẩn sau giải quyết từng vấn đề:</p>

    <table>
      <tr><th>Chuẩn</th><th>RFC</th><th>Giải quyết</th><th>Cách làm</th></tr>
      <tr><td><strong>PAR</strong> — Pushed Authorization Requests</td><td>9126</td><td>Tham số bị lộ/sửa trên trình duyệt; AS xác thực client sớm</td>
        <td>Client POST toàn bộ tham số tới <code>/par</code> (có xác thực client) → nhận <code>request_uri</code>; trình duyệt chỉ mang <code>client_id</code> + <code>request_uri</code></td></tr>
      <tr><td><strong>JAR</strong> — JWT-Secured Authorization Request</td><td>9101</td><td>Chứng minh request thật sự do client tạo, không bị sửa</td>
        <td>Đóng tham số vào một JWT ký bởi client, gửi bằng <code>request=</code> (hoặc qua PAR)</td></tr>
      <tr><td><strong>RAR</strong> — Rich Authorization Requests</td><td>9396</td><td><code>scope</code> là chuỗi phẳng, không diễn tả được "chuyển 45 EUR tới tài khoản X"</td>
        <td>Tham số <code>authorization_details</code> là mảng JSON có <code>type</code> và các trường tuỳ ý</td></tr>
    </table>

    <p><strong>PAR hoạt động thế nào</strong></p>
    <ol>
      <li>Client (back-channel) <code>POST /par</code> với mọi tham số authorize + xác thực client.</li>
      <li>AS kiểm tra ngay (client hợp lệ? redirect_uri đúng? scope được phép?) → trả <code>request_uri</code> (vd <code>urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c</code>) và <code>expires_in</code> ngắn (vd 60s).</li>
      <li>Trình duyệt đi tới <code>/authorize?client_id=...&amp;request_uri=...</code>. Không còn gì để sửa.</li>
    </ol>

    <p><strong>FAPI 2.0 Security Profile</strong> (OpenID Foundation) — không phát minh gì mới, mà <em>bắt buộc</em> một tổ hợp chuẩn cho API rủi ro cao (open banking, y tế, chính phủ):</p>
    <ul>
      <li>Chỉ authorization code + <strong>PKCE S256</strong>, và phải dùng <strong>PAR</strong>.</li>
      <li>Client xác thực bằng <strong>private_key_jwt</strong> hoặc <strong>mTLS</strong> (không client_secret).</li>
      <li>Access token phải <strong>sender-constrained</strong>: DPoP hoặc mTLS.</li>
      <li>Có tham số <code>iss</code> trong authorization response; thuật toán ký PS256/ES256/EdDSA; TLS 1.2+ với cipher hạn chế.</li>
      <li>FAPI 2.0 Message Signing bổ sung ký request (JAR) và response (JARM) khi cần non-repudiation.</li>
    </ul>

    <div class="callout"><p>💡 Nhớ nhanh: <strong>PAR</strong> = giấu và xác thực request sớm; <strong>JAR</strong> = ký request; <strong>RAR</strong> = quyền có cấu trúc thay cho scope phẳng;
    <strong>FAPI 2.0</strong> = PAR + PKCE + client auth bất đối xứng + DPoP/mTLS.</p></div>
  `,

  codeTabs: [
    { id: "par", label: "PAR", lines: [
      "POST /par HTTP/1.1",
      "Host: as.bank.example",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "response_type=code&client_id=fintech-app",
      "&redirect_uri=https%3A%2F%2Ffintech.example%2Fcb",
      "&scope=accounts&state=af0ifjsldkj",
      "&code_challenge=E9Mel...&code_challenge_method=S256",
      "&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      "&client_assertion=eyJ...",
      "",
      "201 Created",
      "{ \"request_uri\": \"urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c\",",
      "  \"expires_in\": 60 }"
    ]},
    { id: "browser", label: "Trình duyệt", lines: [
      "# Trước PAR: mọi tham số lộ trên URL, sửa được",
      "GET /authorize?response_type=code&client_id=fintech-app&redirect_uri=...&scope=...",
      "",
      "# Sau PAR: chỉ còn 2 tham số",
      "GET /authorize?client_id=fintech-app",
      "    &request_uri=urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c"
    ]},
    { id: "rar", label: "RAR", lines: [
      "authorization_details=[",
      "  {",
      "    \"type\": \"payment_initiation\",",
      "    \"instructedAmount\": { \"currency\": \"EUR\", \"amount\": \"45.00\" },",
      "    \"creditorName\": \"Cửa hàng A\",",
      "    \"creditorAccount\": { \"iban\": \"DE02100100109307118603\" }",
      "  }",
      "]",
      "",
      "# Màn hình đồng ý hiện đúng 'Chuyển 45 EUR tới Cửa hàng A'",
      "# Access token mang lại authorization_details đã được duyệt"
    ]},
    { id: "fapi", label: "FAPI 2.0", lines: [
      "FAPI 2.0 Security Profile — checklist:",
      "  [x] authorization code + PKCE S256",
      "  [x] PAR bắt buộc",
      "  [x] client auth: private_key_jwt hoặc mTLS",
      "  [x] access token sender-constrained: DPoP hoặc mTLS",
      "  [x] iss trong authorization response (RFC 9207)",
      "  [x] ký bằng PS256 / ES256 / EdDSA",
      "  [ ] (Message Signing) JAR cho request, JARM cho response"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cl"><div class="nl">🖥️ Client backend</div><div class="ns">private_key_jwt</div></div>
    <div class="arrow" id="a1">↓ POST /par (back-channel, đủ tham số + RAR)</div>
    <div class="node" id="as"><div class="nl">🏛️ AS kiểm tra sớm</div><div class="ns">trả request_uri, sống 60s</div></div>
    <div class="arrow" id="a2">↓ trình duyệt chỉ mang client_id + request_uri</div>
    <div class="node" id="br"><div class="nl">🌐 /authorize</div><div class="ns">màn hình đồng ý chi tiết</div></div>
    <div class="arrow" id="a3">↓ code → token DPoP/mTLS</div>
    <div class="node" id="fapi"><div class="nl">🏦 FAPI 2.0</div><div class="ns">tổ hợp tất cả</div></div>
  `,
  steps: [
    { title: "1 · Đẩy request qua back-channel", tab: "par", highlight: [1, 5, 9, 10, 13, 14], on: ["cl", "a1", "as"],
      desc: "Client gửi toàn bộ tham số kèm xác thực. AS kiểm tra ngay và trả một request_uri ngắn hạn." },
    { title: "2 · Trình duyệt chỉ mang tham chiếu", tab: "browser", highlight: [2, 5, 6], on: ["a2", "br"],
      desc: "Không còn tham số nào để đọc lén hay sửa trên URL." },
    { title: "3 · Quyền chi tiết với RAR", tab: "rar", highlight: [3, 4, 5, 6, 10], on: ["as", "br"],
      desc: "authorization_details diễn tả chính xác giao dịch; user đồng ý đúng số tiền và người nhận." },
    { title: "4 · FAPI 2.0 gom tất cả", tab: "fapi", highlight: [2, 3, 4, 5, 6], on: ["a3", "fapi"],
      desc: "Một hồ sơ cấu hình bắt buộc các chuẩn gia cố — dùng cho open banking và API rủi ro cao." }
  ],

  quiz: [
    { q: "PAR (RFC 9126) làm gì?", options: [
        "Mã hoá access token",
        "Client gửi tham số authorize qua back-channel tới /par, trình duyệt chỉ mang request_uri",
        "Tự động refresh token",
        "Thay thế PKCE"
      ], correct: 1, explanation: "Tham số không lộ/không bị sửa trên trình duyệt; AS xác thực client ngay từ đầu." },
    { q: "Lợi ích phụ của PAR đối với AS?", options: [
        "Không cần kiểm tra redirect_uri",
        "Xác thực client và kiểm tra request sớm trước khi user thấy màn hình đăng nhập",
        "Không cần HTTPS",
        "Không cần user đồng ý"
      ], correct: 1, explanation: "Request sai bị từ chối ở back-channel, không làm phiền user." },
    { q: "RAR (RFC 9396) giải quyết hạn chế nào của scope?", options: [
        "Scope quá dài",
        "Scope là chuỗi phẳng, không diễn tả được quyền có cấu trúc như 'chuyển 45 EUR tới X'",
        "Scope không hỗ trợ tiếng Việt",
        "Scope bắt buộc JWT"
      ], correct: 1, explanation: "authorization_details là mảng JSON có type và trường tuỳ ý." },
    { q: "JAR (RFC 9101) là gì?", options: [
        "Định dạng file Java",
        "Đóng tham số authorize vào JWT do client ký — chống sửa và chứng minh nguồn gốc",
        "Chuẩn đăng xuất",
        "Chuẩn provisioning"
      ], correct: 1, explanation: "Gửi bằng request= hoặc qua PAR." },
    { q: "FAPI 2.0 yêu cầu client xác thực bằng?", options: [
        "client_secret_post", "private_key_jwt hoặc mTLS", "none", "Basic auth với mật khẩu user"
      ], correct: 1, explanation: "Không dùng secret chung." },
    { q: "Theo FAPI 2.0, access token phải?", options: [
        "Là opaque", "Sender-constrained bằng DPoP hoặc mTLS", "Không hết hạn", "Nằm trong query string"
      ], correct: 1, explanation: "Token rò rỉ không được phép dùng lại." },
    { q: "request_uri trả về từ /par có đặc điểm gì?", options: [
        "Dùng mãi mãi", "Ngắn hạn (vd 60 giây) và dùng một lần", "Chứa access token", "Là URL công khai của client"
      ], correct: 1, explanation: "Nó chỉ là tham chiếu tới request đã đẩy lên." },
    { q: "FAPI 2.0 có phải một giao thức mới không?", options: [
        "Có, thay thế OAuth",
        "Không — là hồ sơ bắt buộc tổ hợp các chuẩn có sẵn (PAR, PKCE, DPoP/mTLS, private_key_jwt...)",
        "Là tên mới của SAML",
        "Là thư viện"
      ], correct: 1, explanation: "Profile = tập quy định cấu hình trên nền OAuth/OIDC." }
  ]
});
