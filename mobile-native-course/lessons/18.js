window.LESSONS.push({
  id: "18",
  phase: "4", phaseName: "Kiến trúc app & tài nguyên hệ thống",
  title: "Push notification: luồng chạy từ backend tới màn hình khoá",
  subtitle: "FCM token · APNs device token · FCM HTTP v1 · APNs HTTP/2 + JWT .p8 · notification vs data · Notification Service Extension",

  theory: `
    <p>Backend của bạn <strong>không bao giờ kết nối thẳng tới điện thoại</strong>. Mỗi OS duy trì <em>một</em> kết nối lâu dài, tiết kiệm pin từ máy tới dịch vụ push của hãng (Google FCM, Apple APNs); mọi app dùng chung kết nối đó.
    Backend chỉ gửi tin cho dịch vụ này kèm "địa chỉ" của máy — token.</p>

    <ol>
      <li><strong>Đăng ký</strong>: app gọi SDK → nhận <em>token</em>. Android: FCM registration token. iOS: APNs device token (hoặc FCM token nếu dùng Firebase trên iOS, Firebase sẽ chuyển tiếp qua APNs).</li>
      <li><strong>Gửi token về backend</strong> kèm userId, platform. Token <em>có thể đổi</em> (cài lại app, khôi phục máy, xoá dữ liệu) → lắng nghe <code>onNewToken</code> / callback đăng ký mỗi lần mở app và cập nhật.</li>
      <li><strong>Backend gửi</strong>:
        <ul>
          <li>FCM <strong>HTTP v1</strong>: <code>POST https://fcm.googleapis.com/v1/projects/&lt;id&gt;/messages:send</code>, xác thực OAuth2 bằng service account (API "legacy" server key đã bị tắt).</li>
          <li>APNs: HTTP/2 tới <code>api.push.apple.com</code> (sandbox: <code>api.sandbox.push.apple.com</code>), xác thực bằng JWT ký khoá <code>.p8</code> (Key ID + Team ID) hoặc chứng chỉ; header <code>apns-topic</code> = bundle id, <code>apns-push-type</code>, <code>apns-priority</code> (10 ngay / 5 tiết kiệm pin).</li>
        </ul>
      </li>
      <li><strong>Dịch vụ push chuyển tới máy</strong> (có thể trễ nếu máy tắt/Doze; tin cũ có thể bị gộp hoặc bỏ). Payload tối đa khoảng <strong>4 KB</strong> — gửi id, không gửi cả đơn hàng.</li>
      <li><strong>OS xử lý</strong>: hiển thị notification và/hoặc đánh thức app.</li>
      <li><strong>Token chết</strong>: APNs trả <code>410</code> (Unregistered), FCM trả <code>UNREGISTERED</code> → backend xoá token.</li>
    </ol>

    <table>
      <tr><th></th><th>Android (FCM)</th><th>iOS (APNs)</th></tr>
      <tr><td>Tự hiển thị khi app ở nền</td><td>Tin có khối <code>notification</code></td><td>Tin có <code>aps.alert</code></td></tr>
      <tr><td>Chỉ dữ liệu, app tự xử lý</td><td>Tin <code>data</code> → <code>onMessageReceived</code> (kể cả ở nền, thời gian xử lý ngắn)</td><td>Silent push <code>content-available: 1</code> — bị điều tiết (bài 14)</td></tr>
      <tr><td>Sửa nội dung trước khi hiện</td><td>Tự dựng notification từ data message</td><td><strong>Notification Service Extension</strong> + <code>mutable-content: 1</code> (tải ảnh, giải mã)</td></tr>
      <tr><td>Phân loại</td><td><strong>Notification channel</strong> (Android 8+, bắt buộc) — người dùng tắt được từng kênh</td><td>Category, interruption level (time-sensitive…)</td></tr>
      <tr><td>Quyền</td><td><code>POST_NOTIFICATIONS</code> từ Android 13</td><td><code>requestAuthorization</code></td></tr>
    </table>

    <div class="callout"><p>💡 Lỗi hay gặp khi chuyển môi trường: build debug iOS dùng APNs <strong>sandbox</strong>, build TestFlight/App Store dùng <strong>production</strong>; token của môi trường này gửi sang môi trường kia bị từ chối (<code>BadDeviceToken</code>). Và push <em>không đảm bảo tới</em> — đừng dùng push làm kênh duy nhất cho dữ liệu quan trọng.</p></div>
  `,

  codeTabs: [
    { id: "and", label: "① Android: nhận token & tin", lines: [
      "class ShopMessagingService : FirebaseMessagingService() {",
      "    override fun onNewToken(token: String) {",
      "        scope.launch { api.registerPushToken(token, platform = \"android\") }",
      "    }",
      "    override fun onMessageReceived(msg: RemoteMessage) {",
      "        val orderId = msg.data[\"orderId\"] ?: return",
      "        val n = NotificationCompat.Builder(this, \"orders\")   // channel id",
      "            .setSmallIcon(R.drawable.ic_bag)",
      "            .setContentTitle(\"Đơn $orderId đã giao\")",
      "            .setContentIntent(deepLinkTo(orderId))",
      "            .build()",
      "        NotificationManagerCompat.from(this).notify(orderId.hashCode(), n)",
      "    }",
      "}"
    ]},
    { id: "ios", label: "② iOS: đăng ký APNs", lines: [
      "final class AppDelegate: NSObject, UIApplicationDelegate {",
      "    func application(_ app: UIApplication, didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {",
      "        app.registerForRemoteNotifications()",
      "        return true",
      "    }",
      "    func application(_ app: UIApplication,",
      "                     didRegisterForRemoteNotificationsWithDeviceToken token: Data) {",
      "        let hex = token.map { String(format: \"%02x\", $0) }.joined()",
      "        Task { try await api.registerPushToken(hex, platform: \"ios\") }",
      "    }",
      "}"
    ]},
    { id: "send", label: "③ Backend gửi", lines: [
      "# FCM HTTP v1 (access token OAuth2 từ service account)",
      "POST https://fcm.googleapis.com/v1/projects/shop-prod/messages:send",
      "Authorization: Bearer ya29.a0Af...",
      "{ 'message': { 'token': 'fGx1...', 'data': { 'orderId': 'A1024' },",
      "               'android': { 'priority': 'high' } } }",
      "",
      "# APNs HTTP/2 (JWT ES256 ký bằng khoá .p8)",
      "POST https://api.push.apple.com/3/device/<device-token-hex>",
      "authorization: bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IkFCQzEyMyJ9...",
      "apns-topic: vn.shop.app",
      "apns-push-type: alert",
      "apns-priority: 10",
      "{ 'aps': { 'alert': { 'title': 'Đơn A1024 đã giao' }, 'mutable-content': 1 }, 'orderId': 'A1024' }"
    ]},
    { id: "nse", label: "④ Notification Service Extension", lines: [
      "final class NotificationService: UNNotificationServiceExtension {",
      "    override func didReceive(_ req: UNNotificationRequest,",
      "                             withContentHandler done: @escaping (UNNotificationContent) -> Void) {",
      "        let content = req.content.mutableCopy() as! UNMutableNotificationContent",
      "        if let url = req.content.userInfo[\"imageUrl\"] as? String,",
      "           let file = downloadSync(url) {                      // có ~30 giây",
      "            content.attachments = [try! UNNotificationAttachment(identifier: \"img\", url: file)]",
      "        }",
      "        done(content)",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App đăng ký</div><div class="ns">nhận FCM token / APNs device token</div></div>
    <div class="arrow" id="a1">↓ gửi token + userId</div>
    <div class="node" id="be"><div class="nl">🦀 Backend (Rust / Workers)</div><div class="ns">lưu token theo user</div></div>
    <div class="arrow" id="a2">↓ HTTP v1 (OAuth2) / HTTP/2 (JWT .p8)</div>
    <div class="node" id="svc"><div class="nl">☁️ FCM / APNs</div><div class="ns">giữ 1 kết nối lâu dài tới mỗi máy</div></div>
    <div class="arrow" id="a3">↓ đẩy xuống máy</div>
    <div class="node" id="os"><div class="nl">🔔 OS hiển thị / đánh thức app</div><div class="ns">channel · NSE sửa nội dung</div></div>
    <div class="arrow" id="a4">↑ 410 / UNREGISTERED</div>
    <div class="node" id="dead"><div class="nl">🗑️ Backend xoá token chết</div><div class="ns">gỡ app, đổi máy</div></div>
  `,
  steps: [
    { title: "1 · Android nhận token", tab: "and", highlight: [2, 3], on: ["app", "a1"],
      desc: "onNewToken gọi khi token được tạo hoặc đổi → gửi lên backend." },
    { title: "2 · iOS nhận device token", tab: "ios", highlight: [3, 7, 8, 9], on: ["app", "a1", "be"],
      desc: "Token là Data nhị phân; đổi sang hex trước khi gửi. Cần entitlement aps-environment (bài 01)." },
    { title: "3 · Backend gửi qua dịch vụ hãng", tab: "send", highlight: [2, 3, 4, 8, 9, 10], on: ["a2", "svc"],
      desc: "FCM v1 dùng OAuth2 service account; APNs dùng JWT ký bằng khoá .p8 và apns-topic = bundle id." },
    { title: "4 · Tới máy, OS xử lý", tab: "and", highlight: [5, 6, 7, 12], on: ["a3", "os"],
      desc: "Data message vào onMessageReceived; app dựng notification trên channel 'orders'." },
    { title: "5 · iOS sửa nội dung trước khi hiện", tab: "nse", highlight: [4, 6, 7, 9], on: ["os"],
      desc: "mutable-content: 1 kích hoạt Notification Service Extension — process riêng, thời gian giới hạn." },
    { title: "6 · Dọn token chết", tab: "send", highlight: [8], on: ["a4", "dead"],
      desc: "APNs 410 / FCM UNREGISTERED → xoá token khỏi DB để không gửi mãi vào hư không." }
  ],

  quiz: [
    { q: "Backend có kết nối thẳng tới điện thoại để gửi push không?", options: [
        "Có, qua WebSocket", "Không — gửi tới FCM/APNs, dịch vụ này giữ kết nối tới máy", "Có, qua SMS", "Có, qua IP của máy"
      ], correct: 1, explanation: "Một kết nối chung cho mọi app giúp tiết kiệm pin." },
    { q: "Vì sao phải xử lý onNewToken / cập nhật token mỗi lần mở app?", options: [
        "Token không bao giờ đổi", "Token có thể đổi (cài lại, khôi phục máy, xoá dữ liệu)", "Để tăng tốc", "Để tránh xin quyền"
      ], correct: 1, explanation: "Token cũ sẽ bị trả UNREGISTERED/410." },
    { q: "Gửi APNs bằng token auth cần gì?", options: [
        "Server key của FCM", "JWT ES256 ký bằng khoá .p8 (Key ID, Team ID) và header apns-topic", "Mật khẩu Apple ID", "Chứng chỉ SSL của website"
      ], correct: 1, explanation: "Khoá .p8 dùng được cho mọi app trong team và không hết hạn hằng năm như chứng chỉ." },
    { q: "Payload push nên chứa gì?", options: [
        "Toàn bộ chi tiết đơn hàng", "Thông tin tối thiểu (id, tiêu đề); app tự tải chi tiết — giới hạn khoảng 4 KB", "Ảnh base64", "Token đăng nhập"
      ], correct: 1, explanation: "Cả FCM và APNs giới hạn khoảng 4 KB." },
    { q: "Notification Service Extension trên iOS dùng để làm gì?", options: [
        "Gửi push từ máy", "Sửa nội dung notification trước khi hiển thị (tải ảnh, giải mã) khi có mutable-content: 1", "Xin quyền", "Chạy nền vô hạn"
      ], correct: 1, explanation: "Chạy trong process extension riêng, thời gian giới hạn." },
    { q: "Android 8+ bắt buộc gì khi hiển thị notification?", options: [
        "Notification channel", "Quyền camera", "Foreground service", "Deep link"
      ], correct: 0, explanation: "Người dùng có thể tắt từng channel." },
    { q: "Build debug iOS gửi push được nhưng TestFlight thì không. Nguyên nhân hay gặp?", options: [
        "TestFlight không hỗ trợ push", "Backend gửi nhầm môi trường APNs (sandbox vs production)", "Thiếu quyền INTERNET", "Máy không có SIM"
      ], correct: 1, explanation: "Token sandbox và production không dùng lẫn được." },
    { q: "APNs trả 410 cho một token nghĩa là gì?", options: [
        "Server lỗi tạm thời, thử lại", "Token không còn hợp lệ; nên xoá khỏi DB", "Payload quá lớn", "Sai JWT"
      ], correct: 1, explanation: "Thường do người dùng gỡ app." },
    { q: "FCM data message (không có khối notification) được giao tới đâu?", options: [
        "Tự hiển thị trên khay hệ thống", "onMessageReceived của app, kể cả khi app ở nền", "Chỉ khi app mở", "Không bao giờ tới"
      ], correct: 1, explanation: "App tự quyết định hiển thị gì." }
  ]
});
