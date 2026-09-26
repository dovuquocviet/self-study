window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Các chuẩn hiện đại",
  title: "SAML 2.0 vs OIDC & SCIM — SSO và đồng bộ user trong doanh nghiệp",
  subtitle: "Assertion XML · IdP/SP · SP-initiated vs IdP-initiated · khi nào chọn gì",

  theory: `
    <p>Khi bán phần mềm cho doanh nghiệp, câu hỏi đầu tiên thường là: <em>"Có hỗ trợ SSO với Okta/Entra ID/Google Workspace không?"</em> và <em>"Có SCIM không?"</em>.</p>

    <p><strong>SAML 2.0 (2005) — thuật ngữ</strong></p>
    <ul>
      <li><strong>IdP</strong> (Identity Provider): nơi user đăng nhập — Okta, Entra ID (Azure AD), ADFS, Google Workspace, Keycloak. ≈ OpenID Provider.</li>
      <li><strong>SP</strong> (Service Provider): ứng dụng của bạn. ≈ Relying Party.</li>
      <li><strong>Assertion</strong>: tài liệu XML IdP ký, chứa <code>Issuer</code>, <code>Subject/NameID</code>, <code>Conditions</code> (<code>NotBefore</code>, <code>NotOnOrAfter</code>, <code>AudienceRestriction</code>),
        <code>AuthnStatement</code>, <code>AttributeStatement</code> (email, nhóm…). ≈ id_token.</li>
      <li><strong>Metadata</strong> XML: entityID, URL, chứng chỉ ký — hai bên trao đổi một lần. ≈ discovery + JWKS.</li>
      <li><strong>Binding</strong>: HTTP-Redirect (AuthnRequest trên URL), <strong>HTTP-POST</strong> (form tự submit mang <code>SAMLResponse</code> base64 tới <strong>ACS URL</strong> của SP).</li>
    </ul>
    <p><strong>SP-initiated</strong>: user vào app → app gửi AuthnRequest tới IdP → IdP POST Response về ACS, kèm <code>InResponseTo</code> trỏ về request.
    <strong>IdP-initiated</strong>: user bấm icon app trên dashboard IdP → Response gửi thẳng tới SP, không có request gốc → khó chống replay/CSRF hơn; nên hạn chế.</p>

    <p><strong>SP phải kiểm tra</strong>: chữ ký bằng chứng chỉ trong metadata (đúng phần tử được ký — dùng thư viện SAML trưởng thành vì XML Signature rất dễ xử lý sai),
    <code>Issuer</code>, <code>Audience</code> = entityID của mình, <code>Destination</code>/<code>Recipient</code> = ACS URL, thời hạn, <code>InResponseTo</code>, và chống dùng lại assertion ID.</p>

    <table>
      <tr><th></th><th>SAML 2.0</th><th>OIDC</th></tr>
      <tr><td>Định dạng</td><td>XML + XML Signature</td><td>JSON + JWT</td></tr>
      <tr><td>Hợp với</td><td>Web app doanh nghiệp, hệ thống cũ</td><td>Web, SPA, mobile, API — mọi thứ mới</td></tr>
      <tr><td>Gọi API</td><td>Không có khái niệm access token</td><td>Có sẵn OAuth 2 access token</td></tr>
      <tr><td>Mobile</td><td>Khó</td><td>Tốt (code + PKCE)</td></tr>
      <tr><td>Độ phức tạp</td><td>Cao, nhiều lỗi thư viện trong lịch sử</td><td>Thấp hơn</td></tr>
    </table>

    <p><strong>SCIM 2.0 (RFC 7643, 7644)</strong> — SSO chỉ lo đăng nhập. Còn khi nhân viên vào công ty/nghỉ việc/đổi phòng ban, ai tạo và <em>khoá</em> tài khoản trong app của bạn?
    SCIM là REST API chuẩn để IdP <strong>tự động provisioning</strong>: <code>POST /Users</code>, <code>PATCH /Users/{id}</code> (<code>active: false</code> khi nghỉ việc), <code>/Groups</code>.
    Không có SCIM, người đã nghỉ việc vẫn còn tài khoản (và phiên đăng nhập) trong app.</p>

    <div class="callout"><p>💡 Chọn: hệ thống mới → <strong>OIDC</strong>. Khách doanh nghiệp yêu cầu → hỗ trợ thêm <strong>SAML</strong> (qua thư viện/dịch vụ như Keycloak, Auth0, WorkOS…).
    Muốn bán cho doanh nghiệp lớn → thêm <strong>SCIM</strong> để khoá tài khoản ngay khi IdP vô hiệu user.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "SP-initiated", lines: [
      "1. GET https://app.example.com/dashboard           (chưa đăng nhập)",
      "2. 302 https://idp.corp.com/sso?SAMLRequest=<AuthnRequest nén+base64>&RelayState=/dashboard",
      "3. User đăng nhập tại IdP (mật khẩu + MFA của công ty)",
      "4. IdP trả trang HTML có form tự submit:",
      "   <form method='POST' action='https://app.example.com/saml/acs'>",
      "     <input name='SAMLResponse' value='PHNhbWxwOlJlc3BvbnNl...'>",
      "     <input name='RelayState' value='/dashboard'>",
      "   </form>",
      "5. SP kiểm tra Response -> tạo phiên -> chuyển tới /dashboard"
    ]},
    { id: "assert", label: "Assertion", lines: [
      "<saml:Assertion ID='_a75adf55' IssueInstant='2026-09-27T09:00:00Z'>",
      "  <saml:Issuer>https://idp.corp.com</saml:Issuer>",
      "  <ds:Signature>...</ds:Signature>",
      "  <saml:Subject>",
      "    <saml:NameID Format='...:emailAddress'>an@corp.com</saml:NameID>",
      "    <saml:SubjectConfirmationData InResponseTo='_req123'",
      "        Recipient='https://app.example.com/saml/acs' NotOnOrAfter='2026-09-27T09:05:00Z'/>",
      "  </saml:Subject>",
      "  <saml:Conditions NotBefore='2026-09-27T08:59:00Z' NotOnOrAfter='2026-09-27T09:05:00Z'>",
      "    <saml:AudienceRestriction><saml:Audience>https://app.example.com</saml:Audience></saml:AudienceRestriction>",
      "  </saml:Conditions>",
      "  <saml:AttributeStatement> ... groups = ['sales'] ... </saml:AttributeStatement>",
      "</saml:Assertion>"
    ]},
    { id: "scim", label: "SCIM", lines: [
      "# IdP tạo user khi nhân viên mới vào",
      "POST /scim/v2/Users",
      "Authorization: Bearer <token IdP dùng để gọi SCIM>",
      "{ \"schemas\": [\"urn:ietf:params:scim:schemas:core:2.0:User\"],",
      "  \"userName\": \"an@corp.com\", \"externalId\": \"00u1abc\", \"active\": true,",
      "  \"name\": { \"givenName\": \"An\", \"familyName\": \"Nguyễn\" } }",
      "",
      "# Nhân viên nghỉ việc -> IdP khoá ngay",
      "PATCH /scim/v2/Users/2819c223",
      "{ \"schemas\": [\"urn:ietf:params:scim:api:messages:2.0:PatchOp\"],",
      "  \"Operations\": [{ \"op\": \"replace\", \"path\": \"active\", \"value\": false }] }",
      "# App phải: khoá tài khoản + huỷ mọi phiên/token đang có"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">🙋 Nhân viên</div><div class="ns">vào app</div></div>
    <div class="arrow" id="a1">↓ AuthnRequest (redirect)</div>
    <div class="node" id="idp"><div class="nl">🏢 IdP (Okta / Entra ID)</div><div class="ns">đăng nhập công ty + MFA</div></div>
    <div class="arrow" id="a2">↓ SAMLResponse (POST tới ACS)</div>
    <div class="node" id="sp"><div class="nl">🖥️ SP — app của bạn</div><div class="ns">kiểm tra chữ ký · audience · thời hạn</div></div>
    <div class="arrow" id="a3">↑ SCIM: tạo / sửa / khoá user</div>
  `,
  steps: [
    { title: "1 · SP-initiated", tab: "flow", highlight: [1, 2, 3], on: ["user", "a1", "idp"],
      desc: "App gửi AuthnRequest tới IdP qua redirect; RelayState nhớ trang user muốn vào." },
    { title: "2 · Response qua form POST", tab: "flow", highlight: [5, 6, 9], on: ["a2", "sp"],
      desc: "IdP trả form tự submit tới ACS URL của SP, mang SAMLResponse đã ký." },
    { title: "3 · Kiểm tra assertion", tab: "assert", highlight: [2, 3, 6, 7, 9, 10], on: ["sp"],
      desc: "Issuer, chữ ký, InResponseTo, Recipient, thời hạn, Audience. Dùng thư viện SAML trưởng thành — XML Signature rất dễ xử lý sai." },
    { title: "4 · SCIM khoá tài khoản", tab: "scim", highlight: [2, 9, 11, 12], on: ["idp", "a3", "sp"],
      desc: "SSO không tự khoá user trong app. SCIM để IdP tạo/khoá user tự động, app huỷ luôn phiên đang có." }
  ],

  quiz: [
    { q: "Trong SAML, SP tương ứng với gì trong OIDC?", options: [
        "OpenID Provider", "Relying Party (client)", "Resource Server", "User"
      ], correct: 1, explanation: "SP = ứng dụng nhận assertion; IdP ≈ OP." },
    { q: "SAML assertion tương ứng gần nhất với thứ gì trong OIDC?", options: [
        "access_token", "id_token", "refresh_token", "authorization code"
      ], correct: 1, explanation: "Cả hai là tài liệu có chữ ký nói user là ai." },
    { q: "ACS URL là gì?", options: [
        "Trang đăng nhập của IdP",
        "Endpoint của SP nhận SAMLResponse (Assertion Consumer Service)",
        "URL metadata",
        "URL đăng xuất"
      ], correct: 1, explanation: "IdP POST Response tới ACS URL đã khai trong metadata." },
    { q: "Vì sao IdP-initiated SSO kém an toàn hơn SP-initiated?", options: [
        "Vì không có chữ ký",
        "Không có request gốc (InResponseTo) để đối chiếu nên khó chống replay/CSRF",
        "Vì chậm hơn",
        "Vì không dùng HTTPS"
      ], correct: 1, explanation: "SP nhận một Response không do mình yêu cầu." },
    { q: "SP phải kiểm tra Audience trong assertion để?", options: [
        "Biết tên user",
        "Chắc assertion được phát cho chính SP này, không phải cho app khác",
        "Chọn thuật toán",
        "Lấy nhóm user"
      ], correct: 1, explanation: "Giống kiểm tra aud của id_token." },
    { q: "Hệ thống mới, có cả web và mobile, cần SSO. Nên ưu tiên?", options: [
        "SAML 2.0", "OIDC", "OAuth 1.0a", "Basic auth"
      ], correct: 1, explanation: "OIDC hợp với mobile/SPA và có sẵn access token cho API. SAML thêm khi khách yêu cầu." },
    { q: "SCIM giải quyết vấn đề gì mà SSO không giải quyết?", options: [
        "Mã hoá mật khẩu",
        "Tự động tạo/sửa/khoá tài khoản trong app khi thay đổi ở IdP (vd nhân viên nghỉ việc)",
        "Chữ ký request",
        "Refresh token"
      ], correct: 1, explanation: "SSO chỉ chặn đăng nhập mới; tài khoản và phiên cũ vẫn tồn tại nếu không có provisioning." },
    { q: "Nhận PATCH SCIM với active: false. App nên làm gì?", options: [
        "Chỉ ghi log",
        "Khoá tài khoản và huỷ mọi phiên/token đang có của user",
        "Xoá IdP",
        "Bỏ qua tới lần đăng nhập sau"
      ], correct: 1, explanation: "Mục tiêu là cắt quyền ngay lập tức." },
    { q: "Vì sao khuyến nghị dùng thư viện SAML trưởng thành thay vì tự parse?", options: [
        "Vì XML đẹp hơn",
        "XML Signature phức tạp; xử lý sai phần tử được ký từng gây nhiều lỗ hổng giả mạo assertion",
        "Vì SAML bắt buộc Java",
        "Vì nhanh hơn"
      ], correct: 1, explanation: "Đừng tự viết phần xác minh chữ ký XML." }
  ]
});
