window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Thực chiến",
  title: "RBAC, API key, passkey — ráp bức tranh tổng thể",
  subtitle: "Phân quyền trong app + những mảnh còn thiếu + bản đồ ôn tập toàn khoá",

  theory: `
    <p>Token đã nói "user là ai, scope gì". Nhưng <em>bên trong app của bạn</em>, ai được bấm nút nào?
    Đó là tầng <strong>mô hình phân quyền</strong>:</p>
    <ul>
      <li><strong>RBAC</strong> (Role-Based Access Control) — phân quyền theo <em>vai trò</em>:
      user gán role (<code>admin</code>, <code>editor</code>, <code>viewer</code>), role gom sẵn các quyền.
      Dễ hiểu, dễ quản — 90% app dùng RBAC là đủ.</li>
      <li><strong>ABAC</strong> (Attribute-Based) — phân quyền theo <em>thuộc tính/điều kiện</em>:
      "editor sửa được bài <em>của phòng mình</em>, <em>trong giờ hành chính</em>". Mạnh hơn, phức tạp hơn — dùng khi RBAC không tả nổi luật.</li>
      <li>Phân biệt độ cao: <strong>scope</strong> (bài 6) giới hạn <em>app</em> được làm gì thay bạn;
      <strong>role</strong> giới hạn <em>chính bạn</em> được làm gì trong hệ thống. Một request qua cả hai cửa.</li>
    </ul>
    <p>Hai mảnh cuối cùng của bức tranh:</p>
    <ul>
      <li><strong>API key</strong> — chuỗi bí mật tĩnh (<code>sk_live_...</code>) cho tình huống
      máy-gọi-máy đơn giản (Stripe, OpenAI…). Như bearer token nhưng <em>không tự hết hạn, không scope chuẩn</em> —
      tiện cho dev, lộ là phải thu hồi tay. Nghiêm túc hơn thì dùng Client Credentials (bài 11).</li>
      <li><strong>Passkey (WebAuthn)</strong> — tương lai của authentication: cặp khoá ký số gắn với
      <em>đúng tên miền</em>, mở bằng vân tay/Face ID. Trang giả mạo khác domain → passkey <em>không thèm ký</em> —
      chống phishing triệt để, điều mà mật khẩu lẫn OTP (bài 10) đều không làm được.</li>
    </ul>
    <div class="callout"><p>💡 Bản đồ toàn khoá — mỗi khái niệm một câu:
    <strong>AuthN</strong> bạn là ai · <strong>AuthZ</strong> bạn được làm gì ·
    <strong>Session</strong> vé gửi xe, sổ ở server · <strong>Bearer/JWT</strong> vé tự chứa, ai cầm là dùng ·
    <strong>OAuth 2</strong> chìa valet — uỷ quyền không đưa mật khẩu · <strong>Code flow</strong> phiếu hẹn đổi token ·
    <strong>Refresh</strong> thẻ thành viên xin vé mới · <strong>PKCE</strong> ảnh ổ khoá + chìa thật cho public client ·
    <strong>OIDC</strong> OAuth 2 + giấy khai sinh (ID token) · <strong>SSO</strong> một phiên IdP mở mọi app ·
    <strong>Login with code</strong> chứng minh sở hữu hộp mail · <strong>Device code</strong> TV nhờ điện thoại đăng nhập hộ ·
    <strong>RBAC</strong> vai trò → quyền. Mông lung ngày nào — giờ mỗi thứ đã có một chỗ đứng rõ ràng.</p></div>
  `,

  codeTabs: [
    { id: "rbac", label: "👥 RBAC", lines: [
      "// Định nghĩa role -> quyền:",
      "const ROLES = {",
      "  viewer: ['post.read'],",
      "  editor: ['post.read', 'post.create', 'post.edit'],",
      "  admin:  ['post.read', 'post.create', 'post.edit',",
      "           'post.delete', 'user.manage']",
      "};",
      "",
      "// Middleware kiểm quyền cho từng API:",
      "app.delete('/posts/:id', require('post.delete'), handler);",
      "",
      "// user 'an' role=editor gọi DELETE /posts/9",
      "// -> editor không có post.delete -> 403 Forbidden"
    ]},
    { id: "layers", label: "🚧 2 cửa kiểm tra", lines: [
      "# Một request đi qua HAI cửa độc lập:",
      "DELETE /api/posts/9",
      "Authorization: Bearer eyJ...",
      "",
      "# CỬA 1 — SCOPE (app được phép gì THAY user?):",
      "#   token có scope 'posts.write' không? (bài 6)",
      "#   -> app chỉ xin đọc mà đòi xoá? chặn tại đây",
      "",
      "# CỬA 2 — ROLE (bản thân user được phép gì?):",
      "#   user 'an' có quyền post.delete không? (RBAC)",
      "#   -> app được uỷ quyền đầy đủ nhưng an chỉ là editor? chặn",
      "",
      "# Qua cả hai cửa mới tới handler thật"
    ]},
    { id: "apikey", label: "🗝️ API key", lines: [
      "# Gọi API Stripe bằng API key tĩnh:",
      "curl https://api.stripe.com/v1/charges \\",
      "  -H 'Authorization: Bearer sk_live_51Mx...'",
      "",
      "# Ưu: đơn giản — tạo 1 lần, dùng mãi, không luồng redirect",
      "# Nhược so với OAuth token:",
      "#   - không tự hết hạn -> lộ là phải thu hồi TAY",
      "#   - thường gắn cả tài khoản, không chia scope mịn",
      "#   - commit nhầm lên GitHub = tai nạn kinh điển",
      "# -> dùng cho server-to-server đơn giản; cần chuẩn chỉnh",
      "#    hơn thì Client Credentials (bài 11)"
    ]},
    { id: "passkey", label: "🔏 Passkey", lines: [
      "# Đăng ký: thiết bị tạo CẶP KHOÁ cho riêng site này",
      "#   khoá riêng: nằm trong secure chip, mở bằng Face ID",
      "#   khoá công khai: gửi server lưu",
      "",
      "# Đăng nhập: server gửi challenge ngẫu nhiên",
      "#   thiết bị KÝ challenge bằng khoá riêng (sau khi quét vân tay)",
      "#   server verify bằng khoá công khai -> đăng nhập",
      "",
      "# Chống phishing tận gốc: passkey gắn với ĐÚNG domain đăng ký",
      "#   trang giả evil.com -> trình duyệt không đưa passkey ra ký",
      "#   (mật khẩu & OTP: người dùng bị lừa gõ được — passkey thì KHÔNG)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request</div><div class="ns">DELETE /posts/9 + Bearer token</div></div>
    <div class="arrow" id="a1">↓ cửa 1</div>
    <div class="node" id="gate1"><div class="nl">🚧 Scope check</div><div class="ns">app có được uỷ quyền 'posts.write'? (OAuth)</div></div>
    <div class="arrow" id="a2">↓ cửa 2</div>
    <div class="node" id="gate2"><div class="nl">🚧 Role check</div><div class="ns">user 'an' (editor) có quyền post.delete? (RBAC)</div></div>
    <div class="arrow" id="a3">↓ qua cả hai cửa</div>
    <div class="node" id="handler"><div class="nl">⚙️ Handler</div><div class="ns">mới thật sự xoá bài</div></div>
  `,
  steps: [
    { title: "1 · RBAC: role gom quyền", tab: "rbac", highlight: [3, 4, 5, 6], on: ["req"],
      desc: "Thay vì gán từng quyền lẻ cho từng user (rối tung), RBAC gom quyền vào <strong>role</strong>: viewer chỉ đọc, editor thêm sửa/tạo, admin thêm xoá + quản user. User đổi vai trò = đổi 1 trường, không sửa trăm dòng phân quyền." },
    { title: "2 · Cửa 1: scope — quyền CỦA APP", tab: "layers", highlight: [5, 6, 7], on: ["a1", "gate1"],
      desc: "Scope trả lời: '<em>app này</em> được user uỷ quyền tới đâu?'. App chỉ xin <code>posts.read</code> mà gọi DELETE → chặn ngay, bất kể user là admin. Đây là tầng OAuth (bài 6)." },
    { title: "3 · Cửa 2: role — quyền CỦA USER", tab: "layers", highlight: [9, 10, 11], on: ["a2", "gate2"],
      desc: "Qua cửa scope rồi vẫn còn cửa role: user 'an' là editor, không có <code>post.delete</code> → <code>403</code>. Hai cửa <em>độc lập</em> — nhầm lẫn hai tầng này là nguồn bug phân quyền kinh điển." },
    { title: "4 · API key: tiện nhưng thô", tab: "apikey", highlight: [3, 7, 8, 9], on: ["handler"],
      desc: "API key = bearer token tĩnh: tiện cho dev (không luồng redirect) nhưng không tự hết hạn, ít scope mịn, và <em>commit nhầm lên GitHub</em> là tai nạn kinh điển. Máy-gọi-máy nghiêm túc → Client Credentials có hạn + scope." },
    { title: "5 · Passkey: chống phishing tận gốc", tab: "passkey", highlight: [6, 7, 9, 10], on: ["handler"],
      desc: "Passkey ký challenge bằng khoá riêng trong secure chip, và chỉ ký cho <strong>đúng domain</strong> đã đăng ký. Trang giả mạo? Trình duyệt không đưa passkey ra ký — người dùng <em>muốn bị lừa cũng không được</em>. Đây là hướng tương lai thay mật khẩu lẫn OTP." }
  ],

  quiz: [
    { q: "RBAC phân quyền dựa trên gì?", options: [
        "Địa chỉ IP của người dùng",
        "Vai trò (role) gán cho user — mỗi role gom sẵn một bộ quyền",
        "Thời gian trong ngày",
        "Độ dài mật khẩu"
      ], correct: 1,
      explanation: "User → role → permissions. Đơn giản, dễ quản, đủ cho đa số app. Khi cần luật theo điều kiện/thuộc tính (phòng ban, giờ giấc…) mới lên ABAC." },
    { q: "Scope (OAuth) và role (RBAC) khác nhau thế nào?", options: [
        "Là một, chỉ khác tên",
        "Scope giới hạn APP được làm gì thay user; role giới hạn CHÍNH USER được làm gì trong hệ thống — request phải qua cả hai",
        "Scope dùng cho web, role dùng cho mobile",
        "Role do Google quản lý, scope do app quản lý"
      ], correct: 1,
      explanation: "Hai cửa độc lập: app xin thiếu scope thì admin cũng bị chặn; app đủ scope nhưng user thiếu quyền thì vẫn 403." },
    { q: "So với OAuth access token, API key tĩnh có nhược điểm gì?", options: [
        "Khó gõ hơn",
        "Không tự hết hạn và thường không chia scope mịn — lộ (ví dụ commit nhầm lên GitHub) là phải thu hồi thủ công",
        "Chỉ dùng được 10 lần",
        "Bắt buộc người dùng đăng nhập lại mỗi giờ"
      ], correct: 1,
      explanation: "API key = bearer token sống mãi. Tiện cho tích hợp đơn giản nhưng rủi ro kéo dài — hệ thống nghiêm túc dùng Client Credentials với token có hạn." },
    { q: "Vì sao passkey chống phishing tốt hơn hẳn mật khẩu và OTP?", options: [
        "Vì passkey dài hơn mật khẩu",
        "Vì passkey gắn với đúng domain đăng ký — trang giả mạo khác domain thì trình duyệt không đưa passkey ra ký, người dùng muốn bị lừa cũng không được",
        "Vì passkey đổi mỗi 30 giây",
        "Vì passkey lưu trên cloud của Google"
      ], correct: 1,
      explanation: "Mật khẩu/OTP: kẻ gian dựng trang giả và dụ bạn TỰ GÕ ra. Passkey: việc ký bị ràng vào domain thật ở tầng trình duyệt/hệ điều hành — không có gì để gõ nhầm chỗ." }
  ]
});
