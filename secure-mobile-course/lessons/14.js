window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Giao tiếp giữa các app",
  title: "Deep link, Universal Links & App Links",
  subtitle: "Xác minh domain · validate mọi tham số · link chỉ mở màn hình, không tự thực hiện hành động nhạy cảm",

  theory: `
    <p>Deep link cho phép một URL mở thẳng vào màn hình cụ thể trong app: link sản phẩm trong email, link đặt lại mật khẩu, link mời bạn bè, redirect OAuth (bài 11).
    Rất tiện — nhưng nhớ rằng <strong>bất kỳ ai cũng tạo được link</strong>: kẻ tấn công gửi qua SMS, chèn vào trang web, hoặc app độc hại trên máy tự mở.
    Deep link là <strong>input không đáng tin</strong>, giống như request HTTP đến từ internet.</p>

    <p><strong>1. Hai loại deep link</strong></p>
    <table>
      <tr><th></th><th>Custom URL scheme</th><th>Verified HTTPS link</th></tr>
      <tr><td>Dạng</td><td><code>shopapp://product/123</code></td><td><code>https://shop.com/product/123</code></td></tr>
      <tr><td>Tên trên nền tảng</td><td>URL scheme (iOS), intent-filter scheme (Android)</td><td>Universal Links (iOS), App Links (Android)</td></tr>
      <tr><td>Độc quyền?</td><td><strong>Không</strong> — app khác đăng ký cùng scheme được</td><td><strong>Có</strong> — OS xác minh app sở hữu domain</td></tr>
      <tr><td>Không cài app thì</td><td>Link hỏng</td><td>Mở trang web bình thường</td></tr>
    </table>
    <p>Dùng verified HTTPS link cho mọi thứ quan trọng (OAuth redirect, đặt lại mật khẩu, magic link đăng nhập). Custom scheme chỉ cho điều hướng vô hại.</p>

    <p><strong>2. Xác minh domain</strong></p>
    <ul>
      <li><strong>Android App Links</strong>: intent-filter có <code>android:autoVerify="true"</code> + file <code>https://shop.com/.well-known/assetlinks.json</code> chứa package name và SHA-256 của <em>chứng chỉ ký phát hành</em>.</li>
      <li><strong>iOS Universal Links</strong>: entitlement <code>Associated Domains</code> (<code>applinks:shop.com</code>) + file <code>https://shop.com/.well-known/apple-app-site-association</code> chứa Team ID + bundle ID và các path được phép.</li>
      <li>Chỉ khai báo path thật sự cần (ví dụ <code>/product/*</code>, <code>/reset/*</code>) thay vì toàn domain.</li>
      <li>Kiểm tra lại sau khi đổi khoá ký, đổi CDN, đổi domain — xác minh thất bại thì Android quay về hộp thoại chọn app, và link có thể rơi vào app khác.</li>
    </ul>

    <p><strong>3. Validate tham số — như validate API</strong></p>
    <ul>
      <li>Parse URL bằng API chuẩn (<code>Uri</code>, <code>URLComponents</code>, <code>Uri.parse</code> của Dart, <code>URL</code> của JS), không tự cắt chuỗi.</li>
      <li>Kiểm tra host và path thuộc danh sách cho phép; route không khớp → mở màn hình chính.</li>
      <li>Validate từng tham số: kiểu (ID là số/UUID), độ dài, tập giá trị cho phép. Không truyền thẳng tham số vào WebView, câu truy vấn, đường dẫn file, intent khác.</li>
      <li>Tham số dạng URL (<code>?next=</code>, <code>?redirect=</code>, <code>?url=</code>) → chỉ chấp nhận host trong allowlist; nếu không sẽ thành open redirect hoặc mở trang lừa đảo trong WebView của app (bài 16).</li>
    </ul>

    <p><strong>4. Link chỉ mở màn hình, không tự làm việc nhạy cảm</strong></p>
    <p>Một link như <code>shopapp://transfer?to=&lt;tài_khoản&gt;&amp;amount=&lt;số_tiền&gt;</code> mà app <em>tự động</em> chuyển tiền thì ai gửi link là người đó ra lệnh.
    Quy tắc:</p>
    <ul>
      <li>Deep link <strong>chỉ điền sẵn và hiển thị</strong> màn hình; người dùng phải xem rõ nội dung và <strong>tự bấm xác nhận</strong> (kèm xác thực nếu nhạy cảm).</li>
      <li>Hành động không cần xác nhận chỉ được là loại vô hại: mở trang sản phẩm, mở bài viết.</li>
      <li>Không cho deep link thay đổi cài đặt bảo mật, liên kết tài khoản, đăng xuất, xoá dữ liệu, bật/tắt tính năng.</li>
      <li>Nếu người dùng chưa đăng nhập: lưu "đích đến" (đã validate), đăng nhập xong mới điều hướng — không bỏ qua màn hình đăng nhập.</li>
    </ul>

    <p><strong>5. Link mang bí mật (magic link, reset password)</strong></p>
    <ul>
      <li>Token trong link phải: ngẫu nhiên đủ dài, dùng <strong>một lần</strong>, hết hạn nhanh (10–30 phút), gắn với đúng tài khoản.</li>
      <li>Dùng verified HTTPS link để app khác không nhận được.</li>
      <li>Không log URL đầy đủ, không gửi vào analytics/crash report (bài 06).</li>
      <li>Server đổi token sang phiên, không phải app tự tin token.</li>
    </ul>

    <p><strong>6. React Native / Flutter</strong>: React Navigation <code>linking</code> config, <code>expo-router</code>, <code>go_router</code>, <code>app_links</code>… giúp map URL → màn hình.
    Nhưng chúng chỉ <em>định tuyến</em>; validate tham số và quyết định "có được làm không" vẫn là việc của bạn trong màn hình đích.</p>

    <div class="callout"><p>💡 Tự hỏi với mỗi route deep link: <strong>"Nếu kẻ xấu gửi link này với tham số tuỳ ý cho người dùng đã đăng nhập, điều tệ nhất xảy ra là gì?"</strong>
    Câu trả lời phải là "không có gì xảy ra nếu người dùng không tự xác nhận".</p></div>
  `,

  codeTabs: [
    { id: "verify", label: "🔗 Xác minh domain", lines: [
      "<!-- AndroidManifest.xml -->",
      "<intent-filter android:autoVerify=\"true\">",
      "  <action android:name=\"android.intent.action.VIEW\" />",
      "  <category android:name=\"android.intent.category.DEFAULT\" />",
      "  <category android:name=\"android.intent.category.BROWSABLE\" />",
      "  <data android:scheme=\"https\" android:host=\"shop.com\" android:pathPrefix=\"/product/\" />",
      "</intent-filter>",
      "",
      "// https://shop.com/.well-known/assetlinks.json",
      "[{ 'relation': ['delegate_permission/common.handle_all_urls'],",
      "   'target': { 'namespace': 'android_app', 'package_name': 'com.shop',",
      "               'sha256_cert_fingerprints': ['<SHA256_của_khoá_ký_phát_hành>'] } }]",
      "",
      "// https://shop.com/.well-known/apple-app-site-association",
      "{ 'applinks': { 'details': [{ 'appIDs': ['<TEAMID>.com.shop'],",
      "    'components': [{ '/': '/product/*' }, { '/': '/reset/*' }] }] } }"
    ]},
    { id: "parse", label: "🧪 Validate tham số", lines: [
      "// Pseudo-code dùng chung cho mọi nền tảng",
      "ROUTES = {",
      "  '/product/:id': { id: '^[0-9]{1,12}$' },",
      "  '/reset/:token': { token: '^[A-Za-z0-9_-]{32,64}$' },",
      "  '/promo':        { code: '^[A-Z0-9]{4,16}$' },",
      "}",
      "ALLOWED_HOSTS = ['shop.com']",
      "",
      "handleDeepLink(raw):",
      "    url = parseUrl(raw)                         // API chuẩn, không tự cắt chuỗi",
      "    if url.scheme != 'https' or url.host not in ALLOWED_HOSTS: return openHome()",
      "    route, params = matchRoute(ROUTES, url.path, url.query)",
      "    if not route or not allValid(params): return openHome()",
      "    navigate(route, params)                     // CHỈ mở màn hình"
    ]},
    { id: "action", label: "⚠️ Không tự hành động", lines: [
      "// ❌ SAI: link tự thực hiện chuyển tiền",
      "if (uri.path == \"/transfer\") {",
      "    api.transfer(uri.getQueryParameter(\"to\"), uri.getQueryParameter(\"amount\"))",
      "}",
      "",
      "// ✅ ĐÚNG: link chỉ điền sẵn, người dùng xác nhận + xác thực",
      "if (uri.path == \"/transfer\") {",
      "    val draft = TransferDraft.parseOrNull(uri) ?: return openHome()",
      "    navigateTo(TransferReviewScreen(draft))     // hiển thị rõ người nhận, số tiền",
      "}",
      "// Trên màn hình review: nút 'Xác nhận' -> sinh trắc học/OTP -> server kiểm tra"
    ]},
    { id: "native", label: "📱 Swift / Kotlin", lines: [
      "// iOS — SceneDelegate nhận Universal Link",
      "func scene(_ scene: UIScene, continue activity: NSUserActivity) {",
      "    guard activity.activityType == NSUserActivityTypeBrowsingWeb,",
      "          let url = activity.webpageURL,",
      "          let comps = URLComponents(url: url, resolvingAgainstBaseURL: true),",
      "          comps.host == \"shop.com\" else { return }",
      "    router.handle(comps)                       // router validate từng tham số",
      "}",
      "",
      "// Android — Activity nhận App Link",
      "val uri = intent?.data ?: return",
      "if (uri.scheme != \"https\" || uri.host != \"shop.com\") return openHome()",
      "val id = uri.lastPathSegment?.toLongOrNull() ?: return openHome()",
      "openProduct(id)"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// React Navigation: định tuyến URL -> màn hình",
      "const linking = { prefixes: ['https://shop.com'],",
      "  config: { screens: { Product: 'product/:id', Reset: 'reset/:token' } } }",
      "",
      "// Màn hình đích vẫn phải validate",
      "function Product({ route }) {",
      "  const id = /^[0-9]{1,12}$/.test(route.params?.id) ? route.params.id : null",
      "  if (!id) return <NotFound />",
      "}",
      "",
      "// Flutter go_router",
      "GoRoute(path: '/product/:id', redirect: (ctx, s) =>",
      "    RegExp(r'^[0-9]{1,12}$').hasMatch(s.pathParameters['id'] ?? '') ? null : '/')"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="email"><div class="nl">✉️ Email / SMS / web</div><div class="ns">ai cũng tạo được link</div></div>
      <div class="node" id="evil"><div class="nl">👾 App độc hại</div><div class="ns">tự mở link, giành scheme</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="os"><div class="nl">🧭 OS: link thuộc app nào?</div><div class="ns">verified HTTPS → đúng app · custom scheme → có thể app khác</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="router"><div class="nl">🧪 Router của app</div><div class="ns">parse chuẩn · allowlist host/path · validate tham số</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="screen"><div class="nl">📄 Mở màn hình (điền sẵn)</div><div class="ns">không tự hành động</div></div>
      <div class="node" id="confirm"><div class="nl">✅ Người dùng xác nhận + xác thực</div><div class="ns">server kiểm tra lần cuối</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Link là input không đáng tin", tab: "action", highlight: [2, 3], on: ["email", "evil", "a1"],
      desc: "Ai cũng tạo được link với tham số tuỳ ý. Link tự gọi API chuyển tiền nghĩa là người gửi link ra lệnh thay người dùng." },
    { title: "2 · Verified HTTPS link", tab: "verify", highlight: [2, 6, 11, 12, 15, 16], on: ["os"],
      desc: "App Links (assetlinks.json với SHA-256 khoá ký) và Universal Links (apple-app-site-association) chứng minh app sở hữu domain. Custom scheme thì không độc quyền." },
    { title: "3 · Parse + allowlist", tab: "parse", highlight: [2, 3, 4, 5, 7, 10, 11], on: ["a2", "router"],
      desc: "Dùng parser chuẩn, chỉ chấp nhận host và route đã khai báo, mỗi tham số có pattern riêng." },
    { title: "4 · Không khớp → về trang chủ", tab: "parse", highlight: [12, 13, 14], on: ["router", "a3", "screen"],
      desc: "Route lạ hoặc tham số sai → mở màn hình chính, không cố đoán. Route hợp lệ chỉ được điều hướng." },
    { title: "5 · Native: kiểm host & kiểu", tab: "native", highlight: [3, 4, 5, 6, 12, 13], on: ["router"],
      desc: "Swift dùng URLComponents, Kotlin dùng Uri; kiểm scheme/host rồi chuyển ID sang kiểu số trước khi dùng." },
    { title: "6 · Điền sẵn, người dùng xác nhận", tab: "action", highlight: [8, 9, 11], on: ["screen", "confirm"],
      desc: "Link chỉ tạo bản nháp; màn hình review hiển thị rõ nội dung, người dùng bấm xác nhận + xác thực, server kiểm tra lần cuối." },
    { title: "7 · Thư viện điều hướng chỉ định tuyến", tab: "xplat", highlight: [2, 3, 7, 8, 12, 13], on: ["router", "screen"],
      desc: "React Navigation, go_router map URL → màn hình, nhưng validate tham số vẫn là trách nhiệm của bạn." }
  ],

  quiz: [
    { q: "Khác biệt bảo mật chính giữa custom URL scheme và Universal/App Links?", options: [
        "Custom scheme nhanh hơn",
        "Custom scheme không độc quyền (app khác đăng ký được); Universal/App Links được OS xác minh app sở hữu domain",
        "Universal Links không cần HTTPS",
        "Không khác gì"
      ], correct: 1,
      explanation: "Link quan trọng (OAuth, reset password) nên dùng verified HTTPS link." },
    { q: "File assetlinks.json cho Android App Links chứa gì quan trọng?", options: [
        "Mật khẩu app",
        "Package name và SHA-256 của chứng chỉ ký phát hành",
        "Danh sách người dùng",
        "API key"
      ], correct: 1,
      explanation: "OS so khớp chữ ký của app đã cài với fingerprint trong file để xác minh." },
    { q: "Link 'shopapp://transfer?to=X&amount=Y' tự động chuyển tiền khi mở. Vấn đề?", options: [
        "Không vấn đề nếu dùng HTTPS",
        "Ai gửi link cũng ra lệnh chuyển tiền thay người dùng; link chỉ nên mở màn hình xác nhận",
        "Chỉ vấn đề trên iOS",
        "Link quá dài"
      ], correct: 1,
      explanation: "Hành động nhạy cảm phải do người dùng chủ động xác nhận (và xác thực)." },
    { q: "Deep link có tham số ?next=<url> để điều hướng sau đăng nhập. Cần làm gì?", options: [
        "Mở mọi URL được truyền vào",
        "Chỉ chấp nhận path nội bộ hoặc host trong allowlist",
        "Base64 decode rồi mở",
        "Mở trong WebView để an toàn"
      ], correct: 1,
      explanation: "Không kiểm tra thì thành open redirect hoặc mở trang lừa đảo trong app." },
    { q: "Link đặt lại mật khẩu mang token. Yêu cầu với token này?", options: [
        "Token cố định theo user",
        "Ngẫu nhiên đủ dài, dùng một lần, hết hạn nhanh, không log",
        "Token = email base64",
        "Token không bao giờ hết hạn"
      ], correct: 1,
      explanation: "Token trong link có thể đi qua nhiều hệ thống (email, lịch sử); phải giới hạn giá trị của nó." },
    { q: "Cách parse deep link đúng?", options: [
        "Tự cắt chuỗi bằng split('/')",
        "Dùng API chuẩn (Uri, URLComponents, URL) rồi validate host, path, từng tham số",
        "Dùng regex bắt mọi thứ",
        "Truyền nguyên chuỗi vào WebView"
      ], correct: 1,
      explanation: "Tự cắt chuỗi dễ sai với encode, ký tự đặc biệt, host giả dạng." },
    { q: "Người dùng chưa đăng nhập mở deep link tới màn hình đơn hàng. Nên?", options: [
        "Mở thẳng màn hình đơn hàng, bỏ qua đăng nhập",
        "Lưu đích đến đã validate, yêu cầu đăng nhập, sau đó mới điều hướng",
        "Báo lỗi và thoát app",
        "Mở WebView"
      ], correct: 1,
      explanation: "Deep link không được dùng để vượt qua màn hình đăng nhập." },
    { q: "Thư viện React Navigation linking / go_router đã map URL → màn hình. Còn thiếu gì?", options: [
        "Không thiếu gì",
        "Validate tham số và quyết định quyền trong màn hình đích",
        "Cấu hình HTTPS",
        "Obfuscation"
      ], correct: 1,
      explanation: "Thư viện định tuyến không biết tham số nào hợp lệ với nghiệp vụ của bạn." },
    { q: "Đổi khoá ký app nhưng quên cập nhật assetlinks.json. Hậu quả?", options: [
        "Không ảnh hưởng",
        "Xác minh App Links thất bại; link có thể mở hộp thoại chọn app hoặc mở trình duyệt thay vì app",
        "App bị gỡ khỏi store",
        "Link tự chuyển sang custom scheme"
      ], correct: 1,
      explanation: "File xác minh phải khớp với khoá ký thật của bản phát hành." }
  ]
});
