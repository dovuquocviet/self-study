window.LESSONS.push({
  id: "11",
  phase: "4", phaseName: "Các chuẩn hiện đại",
  title: "OAuth 2.1 & Security BCP (RFC 9700)",
  subtitle: "Mười năm bài học bảo mật gom vào một bản — những gì thay đổi so với OAuth 2.0",

  theory: `
    <p>Sau 2012, OAuth 2.0 được vá bằng hàng loạt RFC và tài liệu best practice. Năm 2025, <strong>OAuth 2.0 Security Best Current Practice</strong> được xuất bản thành <strong>RFC 9700</strong>.
    <strong>OAuth 2.1</strong> (đang ở dạng draft IETF, đã được các nhà cung cấp lớn áp dụng) gộp RFC 6749 + 6750 + PKCE + BCP thành một tài liệu duy nhất.</p>

    <p><strong>Những gì OAuth 2.1 thay đổi</strong></p>
    <table>
      <tr><th>Chủ đề</th><th>OAuth 2.0 (2012)</th><th>OAuth 2.1</th></tr>
      <tr><td>PKCE</td><td>Tuỳ chọn (RFC 7636 riêng)</td><td><strong>Bắt buộc</strong> cho authorization code, mọi client</td></tr>
      <tr><td>Implicit grant</td><td>Có</td><td><strong>Bị loại</strong></td></tr>
      <tr><td>Password grant (ROPC)</td><td>Có</td><td><strong>Bị loại</strong></td></tr>
      <tr><td>redirect_uri</td><td>Cho phép so khớp lỏng</td><td>So khớp <strong>chuỗi chính xác</strong> (ngoại lệ: port của loopback cho app native)</td></tr>
      <tr><td>Bearer token trong query</td><td>Cho phép <code>?access_token=</code></td><td><strong>Cấm</strong></td></tr>
      <tr><td>Refresh token cho public client</td><td>Không quy định</td><td>Phải <strong>sender-constrained</strong> hoặc <strong>rotation</strong></td></tr>
    </table>

    <p><strong>Các khuyến nghị quan trọng khác trong RFC 9700</strong></p>
    <ul>
      <li><strong>Chống mix-up</strong> khi client làm việc với nhiều AS: dùng tham số <code>iss</code> trong response của authorization (RFC 9207) để biết code đến từ AS nào.</li>
      <li><strong>Access token hạn chế</strong>: audience hẹp (<code>resource</code>), scope tối thiểu, thời hạn ngắn; khuyến khích sender-constrained (DPoP/mTLS).</li>
      <li><strong>Không có open redirector</strong> ở client và AS; AS không tự redirect tới <code>redirect_uri</code> chưa kiểm tra khi báo lỗi.</li>
      <li><strong>Chống CSRF</strong> bằng PKCE (hoặc <code>state</code>/<code>nonce</code> dùng một lần).</li>
      <li><strong>Refresh token</strong>: có thể gắn thời hạn tuyệt đối/không hoạt động, thu hồi khi đổi mật khẩu/đăng xuất.</li>
      <li><strong>Browser-based app</strong>: tài liệu riêng khuyến nghị mô hình <strong>BFF</strong> (Backend-for-Frontend) — backend giữ token, trình duyệt chỉ giữ cookie phiên HttpOnly.</li>
      <li><strong>Native app</strong> (RFC 8252): dùng trình duyệt hệ thống, không WebView; redirect bằng claimed https link hoặc loopback.</li>
    </ul>

    <div class="callout"><p>💡 Nếu bạn làm hệ thống mới hôm nay, hãy "làm như OAuth 2.1": code + PKCE S256 cho mọi client, không implicit/password,
    redirect URI khớp chính xác, token trong header, refresh token có rotation — và cân nhắc DPoP.</p></div>
  `,

  codeTabs: [
    { id: "before", label: "❌ Kiểu 2012", lines: [
      "# SPA dùng implicit, token nằm trên URL",
      "GET /authorize?response_type=token&client_id=spa&redirect_uri=https://*.shop.com/cb",
      "302 https://app.shop.com/cb#access_token=eyJ...",
      "",
      "# Mobile app nhận mật khẩu",
      "POST /token  grant_type=password&username=an&password=s3cret",
      "",
      "# Gọi API bằng query string",
      "GET /api/orders?access_token=eyJ..."
    ]},
    { id: "after", label: "✅ Kiểu OAuth 2.1", lines: [
      "# Mọi client: code + PKCE, redirect_uri khớp chính xác",
      "GET /authorize?response_type=code&client_id=spa",
      "    &redirect_uri=https://app.shop.com/cb",
      "    &code_challenge=E9Mel...&code_challenge_method=S256&state=...",
      "",
      "302 https://app.shop.com/cb?code=...&state=...&iss=https%3A%2F%2Fas.shop.com",
      "#                                              ^ RFC 9207 chống mix-up",
      "",
      "GET /api/orders",
      "Authorization: Bearer eyJ...     (hoặc DPoP)"
    ]},
    { id: "bff", label: "BFF cho SPA", lines: [
      "Trình duyệt  <--- cookie phiên HttpOnly, Secure, SameSite --->  BFF (backend)",
      "                                                                 |  giữ access/refresh token",
      "                                                                 |  (confidential client)",
      "                                                                 v",
      "                                                              API",
      "",
      "# Token không bao giờ nằm trong JavaScript -> XSS không lấy được token",
      "# BFF làm OAuth code flow như một web app truyền thống"
    ]}
  ],

  stageHtml: `
    <div class="node" id="o20"><div class="nl">OAuth 2.0 (RFC 6749, 2012)</div><div class="ns">framework linh hoạt, nhiều cách sai</div></div>
    <div class="arrow" id="a1">↓ + PKCE · + Security BCP (RFC 9700) · + native/browser app BCP</div>
    <div class="node" id="o21"><div class="nl">OAuth 2.1</div><div class="ns">PKCE bắt buộc · bỏ implicit & password · khớp redirect chính xác</div></div>
    <div class="arrow" id="a2">↓ gia cố thêm</div>
    <div class="node" id="plus"><div class="nl">DPoP / mTLS · PAR · FAPI 2.0</div><div class="ns">bài 12–13</div></div>
  `,
  steps: [
    { title: "1 · Ba thói quen cũ", tab: "before", highlight: [2, 3, 6, 9], on: ["o20"],
      desc: "Implicit + wildcard redirect, password grant, token trên query string — cả ba đều bị OAuth 2.1 loại." },
    { title: "2 · Cách làm mới", tab: "after", highlight: [2, 3, 4, 6, 7, 10], on: ["a1", "o21"],
      desc: "Code + PKCE cho mọi client, redirect_uri chính xác, tham số iss trong response để chống mix-up." },
    { title: "3 · SPA: cân nhắc BFF", tab: "bff", highlight: [1, 2, 7], on: ["o21"],
      desc: "Token nằm ở backend, trình duyệt chỉ có cookie HttpOnly. Giảm mạnh hậu quả của XSS." },
    { title: "4 · Bước tiếp theo", tab: "after", highlight: [10], on: ["a2", "plus"],
      desc: "OAuth 2.1 là nền. Hệ thống rủi ro cao thêm token gắn khoá (DPoP/mTLS) và PAR — theo hồ sơ FAPI 2.0." }
  ],

  quiz: [
    { q: "OAuth 2.1 bỏ những grant nào?", options: [
        "Authorization code và refresh token",
        "Implicit và Resource Owner Password Credentials",
        "Client credentials",
        "Device code"
      ], correct: 1, explanation: "Hai grant này có rủi ro vốn có; code + PKCE thay thế." },
    { q: "RFC 9700 là gì?", options: [
        "Chuẩn SAML mới",
        "OAuth 2.0 Security Best Current Practice",
        "Chuẩn JWT",
        "Chuẩn WebAuthn"
      ], correct: 1, explanation: "Tổng hợp các mối đe doạ và biện pháp cho OAuth 2.0, xuất bản 2025." },
    { q: "Theo OAuth 2.1, redirect_uri được so khớp thế nào?", options: [
        "Theo domain", "Theo wildcard", "Khớp chuỗi chính xác (trừ port loopback của app native)", "Không kiểm tra"
      ], correct: 2, explanation: "So khớp lỏng từng gây nhiều vụ lộ code." },
    { q: "Refresh token của public client theo OAuth 2.1 phải?", options: [
        "Không bao giờ hết hạn",
        "Sender-constrained (DPoP/mTLS) hoặc rotation mỗi lần dùng",
        "Lưu trong URL",
        "Giống access token"
      ], correct: 1, explanation: "Để refresh token bị trộm khó dùng được hoặc bị phát hiện." },
    { q: "Tham số iss trong authorization response (RFC 9207) chống lại gì?", options: [
        "XSS", "Mix-up attack khi client dùng nhiều AS", "Brute force", "Replay nonce"
      ], correct: 1, explanation: "Client biết chắc code đến từ AS nào trước khi gửi đi đổi." },
    { q: "Mô hình BFF cho SPA có lợi gì?", options: [
        "SPA chạy nhanh hơn",
        "Token nằm ở backend; trình duyệt chỉ giữ cookie HttpOnly nên XSS không lấy được token",
        "Không cần HTTPS",
        "Bỏ được đăng nhập"
      ], correct: 1, explanation: "BFF biến SPA thành confidential client từ góc nhìn của AS." },
    { q: "App native nên mở màn hình đăng nhập OAuth bằng gì (RFC 8252)?", options: [
        "WebView nhúng trong app",
        "Trình duyệt hệ thống (Custom Tabs / ASWebAuthenticationSession)",
        "Form nhập mật khẩu tự làm",
        "Email"
      ], correct: 1, explanation: "WebView cho app đọc được mật khẩu và không chia sẻ phiên SSO." },
    { q: "OAuth 2.1 có phải giao thức mới không tương thích OAuth 2.0?", options: [
        "Đúng, phải viết lại toàn bộ",
        "Không — là OAuth 2.0 đã bỏ phần nguy hiểm và bắt buộc best practice; client làm đúng BCP gần như đã tương thích",
        "Là tên khác của OAuth 1",
        "Là chuẩn chỉ cho ngân hàng"
      ], correct: 1, explanation: "OAuth 2.1 là bản hợp nhất, không phải giao thức mới." }
  ]
});
