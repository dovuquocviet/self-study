window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Các chuẩn hiện đại",
  title: "Device Flow, CIBA & Token Exchange",
  subtitle: "Đăng nhập trên TV/CLI · xác thực trên thiết bị khác · đổi token giữa các service",

  theory: `
    <p><strong>1. Device Authorization Grant (RFC 8628)</strong> — cho thiết bị không có trình duyệt hoặc khó gõ phím: smart TV, console, CLI (<code>gh auth login</code>, <code>az login</code>…).</p>
    <ol>
      <li>Thiết bị <code>POST /device_authorization</code> → nhận <code>device_code</code> (bí mật, giữ trên thiết bị), <code>user_code</code> ngắn (vd <code>WDJB-MJHT</code>),
        <code>verification_uri</code>, <code>expires_in</code>, <code>interval</code>.</li>
      <li>Thiết bị hiển thị: "Mở <code>example.com/device</code> trên điện thoại, nhập WDJB-MJHT" (hoặc mã QR với <code>verification_uri_complete</code>).</li>
      <li>Trong lúc đó thiết bị <strong>poll</strong> <code>/token</code> với <code>grant_type=urn:ietf:params:oauth:grant-type:device_code</code> theo <code>interval</code>.
        Nhận <code>authorization_pending</code> → chờ; <code>slow_down</code> → tăng khoảng cách thêm 5 giây; <code>access_denied</code>/<code>expired_token</code> → dừng.</li>
      <li>User duyệt xong → lần poll kế tiếp nhận token.</li>
    </ol>
    <p>Rủi ro chính: <em>lừa đảo mã thiết bị</em> — kẻ gian tự khởi tạo luồng rồi gửi user_code cho nạn nhân kèm lời nhắn giả. Phòng thủ: màn hình duyệt ghi rõ tên app và thiết bị,
    user_code sống ngắn, và không dùng device flow cho thiết bị có trình duyệt.</p>

    <p><strong>2. CIBA — Client-Initiated Backchannel Authentication</strong> (OpenID Foundation): client biết user là ai (vd số điện thoại, username) và muốn xác thực
    <em>trên thiết bị của user</em> mà không cần redirect. Ví dụ: nhân viên call center bấm "xác minh", app ngân hàng trên điện thoại khách hiện thông báo "Xác nhận đăng nhập?".
    Client gọi <code>/bc-authorize</code> với <code>login_hint</code>, nhận <code>auth_req_id</code>, rồi nhận token bằng poll, ping (callback báo) hoặc push.</p>

    <p><strong>3. Token Exchange (RFC 8693)</strong> — một service đổi token đang có lấy token khác, dùng trong kiến trúc microservice:</p>
    <ul>
      <li><strong>Hạ phạm vi / đổi audience</strong>: API Gateway nhận token của user (aud = gateway), đổi lấy token aud = orders-service, scope hẹp hơn.</li>
      <li><strong>Delegation</strong> ("A hành động thay B"): token mới có <code>sub</code> = user và claim <code>act</code> = service đang hành động — dấu vết ai làm gì thay ai.</li>
      <li><strong>Impersonation</strong>: token mới chỉ có danh tính user (không có <code>act</code>) — mạnh hơn, cần kiểm soát chặt.</li>
    </ul>
    <p>Tham số: <code>grant_type=urn:ietf:params:oauth:grant-type:token-exchange</code>, <code>subject_token</code> + <code>subject_token_type</code>,
    tuỳ chọn <code>actor_token</code>, <code>audience</code>/<code>resource</code>, <code>scope</code>, <code>requested_token_type</code>.</p>

    <div class="callout"><p>💡 Đừng chuyển tiếp nguyên token của user qua 5 service liên tiếp — mỗi service đều có một token dùng được ở mọi service khác.
    Token Exchange cho mỗi bước một token có audience và scope vừa đủ.</p></div>
  `,

  codeTabs: [
    { id: "dev1", label: "Device: bắt đầu", lines: [
      "POST /device_authorization",
      "client_id=tv-app&scope=profile%20watch",
      "",
      "200 OK",
      "{",
      "  \"device_code\": \"GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS\",",
      "  \"user_code\": \"WDJB-MJHT\",",
      "  \"verification_uri\": \"https://example.com/device\",",
      "  \"verification_uri_complete\": \"https://example.com/device?user_code=WDJB-MJHT\",",
      "  \"expires_in\": 1800,",
      "  \"interval\": 5",
      "}"
    ]},
    { id: "dev2", label: "Device: poll", lines: [
      "POST /token",
      "grant_type=urn:ietf:params:oauth:grant-type:device_code",
      "&device_code=GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS&client_id=tv-app",
      "",
      "-> 400 { \"error\": \"authorization_pending\" }   // user chưa duyệt, chờ 5s",
      "-> 400 { \"error\": \"slow_down\" }              // poll quá nhanh, +5s",
      "-> 200 { \"access_token\": \"...\", \"refresh_token\": \"...\" }   // đã duyệt",
      "-> 400 { \"error\": \"expired_token\" }          // hết 30 phút, bắt đầu lại"
    ]},
    { id: "ciba", label: "CIBA", lines: [
      "POST /bc-authorize",
      "scope=openid&login_hint=+84901234567&binding_message=W4SCT",
      "&client_assertion_type=...&client_assertion=eyJ...",
      "",
      "200 OK  { \"auth_req_id\": \"1c266114-a1be-4252-8ad1-04986c5b9ac1\",",
      "          \"expires_in\": 120, \"interval\": 2 }",
      "",
      "# Điện thoại user hiện: 'Xác nhận đăng nhập? Mã W4SCT'",
      "POST /token  grant_type=urn:openid:params:grant-type:ciba&auth_req_id=1c266114-..."
    ]},
    { id: "tx", label: "Token Exchange", lines: [
      "# Gateway đổi token của user lấy token dành riêng cho orders-service",
      "POST /token",
      "grant_type=urn:ietf:params:oauth:grant-type:token-exchange",
      "&subject_token=eyJ...token-user...",
      "&subject_token_type=urn:ietf:params:oauth:token-type:access_token",
      "&audience=orders-service&scope=orders.read",
      "",
      "200 OK { \"access_token\": \"eyJ...\", \"issued_token_type\":",
      "         \"urn:ietf:params:oauth:token-type:access_token\", \"token_type\": \"Bearer\" }",
      "",
      "# Delegation: token mới có  \"sub\": \"user-42\", \"act\": { \"sub\": \"api-gateway\" }"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="tv"><div class="nl">📺 TV / CLI</div><div class="ns">hiện user_code · poll /token</div></div>
      <div class="node" id="phone"><div class="nl">📱 Điện thoại user</div><div class="ns">nhập mã · duyệt</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="as"><div class="nl">🏛️ Authorization Server</div><div class="ns">device · CIBA · token exchange</div></div>
    <div class="arrow" id="a2">↓ token có audience hẹp</div>
    <div class="row">
      <div class="node" id="gw"><div class="nl">🚪 Gateway</div><div class="ns">subject_token</div></div>
      <div class="node" id="svc"><div class="nl">⚙️ orders-service</div><div class="ns">aud đúng mình</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Device: xin mã", tab: "dev1", highlight: [6, 7, 8, 10, 11], on: ["tv", "as"],
      desc: "device_code giữ bí mật trên TV; user_code ngắn để người gõ trên điện thoại." },
    { title: "2 · User duyệt trên thiết bị khác", tab: "dev1", highlight: [8, 9], on: ["phone", "a1", "as"],
      desc: "Trình duyệt điện thoại làm phần đăng nhập, MFA, đồng ý. TV không bao giờ thấy mật khẩu." },
    { title: "3 · TV poll tới khi có token", tab: "dev2", highlight: [2, 5, 6, 7, 8], on: ["tv", "as"],
      desc: "Tôn trọng interval và slow_down; dừng khi expired_token hoặc access_denied." },
    { title: "4 · CIBA: không cần redirect", tab: "ciba", highlight: [2, 5, 8, 9], on: ["as", "phone"],
      desc: "Client biết user là ai, AS đẩy yêu cầu xác thực tới thiết bị của user. binding_message giúp user đối chiếu." },
    { title: "5 · Token Exchange giữa service", tab: "tx", highlight: [3, 4, 6, 11], on: ["gw", "a2", "svc"],
      desc: "Mỗi bước nhận token có audience và scope vừa đủ; act ghi lại ai đang hành động thay user." }
  ],

  quiz: [
    { q: "Device Authorization Grant phù hợp với?", options: [
        "Web app có trình duyệt", "Smart TV, console, CLI — thiết bị khó nhập liệu/không có trình duyệt", "Máy-với-máy không có user", "SPA"
      ], correct: 1, explanation: "User duyệt trên thiết bị khác có trình duyệt." },
    { q: "Trong device flow, giá trị nào được hiển thị cho user?", options: [
        "device_code", "user_code", "access_token", "client_secret"
      ], correct: 1, explanation: "device_code là bí mật của thiết bị; user_code ngắn để user nhập." },
    { q: "Thiết bị poll nhận lỗi slow_down. Nên?", options: [
        "Poll nhanh hơn", "Tăng khoảng cách poll thêm 5 giây", "Dừng hẳn", "Tạo device_code mới ngay"
      ], correct: 1, explanation: "RFC 8628 quy định tăng interval thêm 5 giây." },
    { q: "Rủi ro đặc trưng của device flow là gì?", options: [
        "SQL injection",
        "Lừa đảo: kẻ gian khởi tạo luồng và dụ nạn nhân nhập user_code của kẻ gian",
        "Token quá ngắn",
        "Không hỗ trợ MFA"
      ], correct: 1, explanation: "Màn hình duyệt phải ghi rõ app/thiết bị; mã sống ngắn." },
    { q: "CIBA khác Authorization Code ở điểm nào?", options: [
        "Không có token",
        "Không redirect trình duyệt; client gửi yêu cầu qua back-channel và user xác thực trên thiết bị riêng",
        "Chỉ cho TV",
        "Không cần AS"
      ], correct: 1, explanation: "Ví dụ call center, POS, xác nhận giao dịch trên app ngân hàng." },
    { q: "Token Exchange (RFC 8693) dùng để?", options: [
        "Đổi mật khẩu",
        "Đổi một token lấy token khác (audience/scope khác, delegation) giữa các service",
        "Đổi OAuth 1 sang OAuth 2 tự động",
        "Đổi tiền tệ"
      ], correct: 1, explanation: "Mẫu hình quan trọng cho microservice." },
    { q: "Claim act trong token do Token Exchange tạo ra thể hiện gì?", options: [
        "Hành động bị cấm",
        "Bên đang hành động thay mặt subject (delegation)",
        "Thời gian hết hạn",
        "Thuật toán ký"
      ], correct: 1, explanation: "sub = user, act = service đang hành động — giữ dấu vết." },
    { q: "Vì sao không nên chuyển tiếp nguyên token của user qua nhiều service?", options: [
        "Vì token quá lớn",
        "Mỗi service đều giữ một token dùng được ở mọi service khác (audience rộng) — lộ ở một chỗ là lộ tất cả",
        "Vì chậm",
        "Vì không có HTTPS"
      ], correct: 1, explanation: "Token Exchange cho mỗi bước token có audience và scope tối thiểu." }
  ]
});
