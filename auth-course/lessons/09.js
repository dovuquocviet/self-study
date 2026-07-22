window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Danh tính & đăng nhập hiện đại",
  title: "SSO — đăng nhập một lần, dùng cả chục app",
  subtitle: "Vì sao vào Gmail xong thì YouTube, Drive tự đăng nhập theo",

  theory: `
    <p>Ở công ty, bạn mở Jira → phải đăng nhập. Mở Confluence → <em>tự vào luôn</em>, không hỏi gì.
    Mở GitLab → cũng tự vào. Đó là <strong>SSO — Single Sign-On</strong>: đăng nhập <em>một lần</em>
    tại một nơi, dùng được <em>nhiều app</em>.</p>
    <p>Bí quyết không có gì thần bí — ghép từ những mảnh bạn đã học:</p>
    <ol>
      <li>Mọi app đều <strong>không tự xác thực</strong> mà chuyển hướng về chung một
      <strong>Identity Provider (IdP)</strong>: Google Workspace, Microsoft Entra ID, Okta, Keycloak…</li>
      <li>Lần đầu đăng nhập, IdP tạo <strong>phiên đăng nhập tại chính IdP</strong> — một session cookie
      trên domain của IdP (bài 2!).</li>
      <li>App thứ hai redirect tới IdP → trình duyệt mang sẵn cookie phiên IdP → IdP thấy
      "người này đăng nhập rồi" → <strong>phát token ngay, không hỏi mật khẩu</strong> → đá về app. Toàn bộ diễn ra trong nháy mắt.</li>
    </ol>
    <p>Hai "ngôn ngữ" SSO phổ biến mà app (Service Provider) nói chuyện với IdP:</p>
    <ul>
      <li><strong>OIDC</strong> (bài 8) — JSON + JWT, chuẩn hiện đại, mặc định cho app mới.</li>
      <li><strong>SAML 2.0</strong> — XML, ra đời từ 2005, vẫn phủ khắp phần mềm doanh nghiệp.
      Ý tưởng y hệt (redirect → IdP xác thực → trả 'assertion' đã ký) — chỉ khác định dạng.</li>
    </ul>
    <div class="callout"><p>💡 SSO là giấc mơ của phòng IT: nhân viên nghỉ việc → khoá <em>một</em> tài khoản
    ở IdP là mất quyền vào <em>tất cả</em> app (offboarding tức thì), 2FA bật một chỗ phủ mọi nơi.
    Đánh đổi: IdP thành 'chìa khoá vạn năng' — IdP sập thì không ai vào được app nào, IdP bị chiếm thì mất tất cả.
    Vì thế tài khoản IdP luôn phải bật MFA.</p></div>
  `,

  codeTabs: [
    { id: "first", label: "1️⃣ App đầu tiên", lines: [
      "# 9:00 sáng — mở jira.congty.com, chưa có phiên nào",
      "GET https://jira.congty.com/dashboard",
      "-> 302 Location: https://idp.congty.com/authorize?client_id=jira&...",
      "",
      "# IdP: chưa có cookie phiên -> hiện form đăng nhập + 2FA",
      "POST https://idp.congty.com/login   (mật khẩu + OTP)",
      "",
      "# IdP tạo PHIÊN TẠI IDP (cookie trên domain idp.congty.com):",
      "Set-Cookie: idp_session=aBcD...; HttpOnly; Secure",
      "-> 302 về Jira kèm code -> Jira đổi token -> vào Jira ✓"
    ]},
    { id: "second", label: "2️⃣ App thứ hai", lines: [
      "# 9:05 — mở confluence.congty.com lần đầu trong ngày",
      "GET https://confluence.congty.com/",
      "-> 302 Location: https://idp.congty.com/authorize?client_id=confluence&...",
      "",
      "# Trình duyệt TỰ đính kèm cookie phiên IdP (cùng domain idp):",
      "Cookie: idp_session=aBcD...",
      "",
      "# IdP: 'người này đăng nhập lúc 9:00 rồi' -> KHÔNG hỏi mật khẩu",
      "-> 302 về Confluence kèm code ngay lập tức",
      "# Confluence đổi token -> vào luôn. Người dùng chỉ thấy 'tự vào'"
    ]},
    { id: "logout", label: "🚪 Nghỉ việc", lines: [
      "# Nhân viên nghỉ việc — IT chỉ làm MỘT việc:",
      "#   Khoá tài khoản trên IdP (Okta/Entra/Keycloak)",
      "",
      "# Hệ quả dây chuyền:",
      "#  - phiên IdP bị huỷ -> không xin được token mới cho app nào",
      "#  - access token cũ hết hạn sau ít phút -> hết đường vào",
      "#  - (IdP xịn còn bắn tín hiệu logout tới từng app)",
      "",
      "# Không SSO: phải nhớ khoá tay 15 tài khoản ở 15 app — sót 1 là rủi ro"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">🧑‍💼 Nhân viên</div><div class="ns">một tài khoản công ty duy nhất</div></div>
    <div class="arrow" id="a1">↓ ① mở Jira → redirect về IdP</div>
    <div class="node" id="idp"><div class="nl">🏛️ IdP (Okta/Entra/Keycloak)</div><div class="ns">đăng nhập + 2FA MỘT lần · giữ phiên IdP</div></div>
    <div class="arrow" id="a2">↓ ② token cho Jira</div>
    <div class="node" id="jira"><div class="nl">📋 Jira</div><div class="ns">tin IdP → tạo phiên riêng của Jira</div></div>
    <div class="arrow" id="a3">↓ ③ mở Confluence → IdP thấy cookie phiên → phát token luôn</div>
    <div class="node" id="conf"><div class="nl">📚 Confluence</div><div class="ns">vào thẳng — không hỏi mật khẩu</div></div>
    <div class="arrow" id="a4">↓ ④ GitLab, Slack… cũng vậy</div>
    <div class="node" id="rest"><div class="nl">🦊 Mọi app khác</div><div class="ns">một phiên IdP phục vụ tất cả</div></div>
  `,
  steps: [
    { title: "1 · Lần đầu trong ngày: đăng nhập thật", tab: "first", highlight: [2, 3, 5, 6], on: ["user", "a1", "idp"],
      desc: "Jira không có form mật khẩu — nó redirect về IdP (đúng mô hình OIDC bài 8). IdP chưa thấy phiên nào → hỏi mật khẩu + 2FA. Đây là lần gõ mật khẩu <strong>duy nhất</strong> trong ngày." },
    { title: "2 · IdP giữ phiên của chính nó", tab: "first", highlight: [8, 9, 10], on: ["idp", "a2", "jira"],
      desc: "Điểm mấu chốt của SSO: IdP đặt <strong>session cookie trên domain của IdP</strong> (idp.congty.com) — kiến thức bài 2 dùng lại nguyên xi. Rồi phát code/token cho Jira như luồng OIDC bình thường." },
    { title: "3 · App thứ hai: tự vào", tab: "second", highlight: [3, 5, 6, 8], on: ["a3", "conf"],
      desc: "Confluence cũng redirect về IdP. Trình duyệt <em>tự</em> mang cookie <code>idp_session</code> theo (cùng domain IdP). IdP thấy phiên còn sống → bỏ qua màn đăng nhập, phát token luôn. Với người dùng: 'ơ, tự vào rồi'." },
    { title: "4 · Nhân rộng mọi app", tab: "second", highlight: [9], on: ["a4", "rest"],
      desc: "GitLab, Slack, HR system… cùng trỏ về một IdP là cùng hưởng. App mới nói chuyện với IdP bằng <strong>OIDC</strong>; phần mềm doanh nghiệp đời cũ dùng <strong>SAML</strong> (XML) — ý tưởng y hệt, khác mỗi định dạng." },
    { title: "5 · Sức mạnh khi offboarding", tab: "logout", highlight: [2, 5, 6, 9], on: ["idp"],
      desc: "Nghỉ việc → IT khoá <em>một</em> tài khoản IdP → mất quyền vào mọi app: không xin được token mới, token cũ tự hết hạn sau ít phút. Đổi lại, IdP là điểm chí tử — phải bảo vệ bằng MFA và giám sát chặt." }
  ],

  quiz: [
    { q: "Cơ chế cốt lõi giúp app thứ hai 'tự đăng nhập' trong SSO là gì?", options: [
        "Các app chia sẻ chung database mật khẩu",
        "IdP giữ session cookie trên domain của IdP — app nào redirect về, IdP thấy phiên còn sống thì phát token luôn, khỏi hỏi mật khẩu",
        "Trình duyệt tự gõ lại mật khẩu giúp bạn",
        "App thứ hai copy cookie của app thứ nhất"
      ], correct: 1,
      explanation: "Cookie phiên nằm ở domain IdP (bài 2). Mọi app đều redirect qua IdP nên đều 'đi ngang' phiên đó — một lần đăng nhập phục vụ tất cả." },
    { q: "SAML và OIDC quan hệ thế nào?", options: [
        "SAML là bản nâng cấp của OIDC",
        "Hai 'ngôn ngữ' SSO cùng ý tưởng (redirect → IdP xác thực → trả kết quả đã ký): SAML dùng XML, đời cũ, phủ doanh nghiệp; OIDC dùng JSON/JWT, chuẩn cho app mới",
        "SAML dùng cho mobile, OIDC dùng cho web",
        "SAML không cần IdP"
      ], correct: 1,
      explanation: "Ý tưởng giống hệt nhau, khác thời đại và định dạng. App mới chọn OIDC; tích hợp phần mềm doanh nghiệp cũ thường vẫn phải nói SAML." },
    { q: "Vì sao SSO giúp offboarding (cho nhân viên nghỉ việc) an toàn hơn?", options: [
        "Vì nhân viên tự giác đăng xuất",
        "Vì chỉ cần khoá MỘT tài khoản ở IdP là mất quyền vào mọi app — không sót app nào",
        "Vì SSO xoá luôn dữ liệu của nhân viên",
        "Vì các app tự đổi mật khẩu hàng ngày"
      ], correct: 1,
      explanation: "Mọi cánh cửa đều mở bằng chìa IdP. Khoá chìa là khoá hết — thay vì nhớ khoá tay 15 tài khoản rời rạc, sót một cái là thành rủi ro." },
    { q: "Mặt trái lớn nhất của SSO là gì?", options: [
        "Người dùng phải nhớ nhiều mật khẩu hơn",
        "IdP thành điểm chí tử: IdP sập thì không vào được app nào, tài khoản IdP bị chiếm là mất tất cả — nên bắt buộc MFA",
        "Không dùng được trên điện thoại",
        "Mỗi app phải viết lại toàn bộ code"
      ], correct: 1,
      explanation: "Gom hết trứng vào giỏ IdP: tiện quản lý nhưng giỏ đó phải được bảo vệ tối đa (MFA, giám sát, dự phòng)." }
  ]
});
