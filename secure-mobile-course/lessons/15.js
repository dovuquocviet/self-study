window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Giao tiếp giữa các app",
  title: "IPC: giao tiếp giữa các app",
  subtitle: "Android: exported component, Intent, PendingIntent, ContentProvider · iOS: URL scheme, pasteboard, App Extension, App Group",

  theory: `
    <p>Sandbox (bài 03) tách các app ra. Nhưng app vẫn cần nói chuyện: chia sẻ ảnh, mở file, nhận dữ liệu từ widget, cho app khác gọi tính năng của mình.
    Các kênh này gọi chung là <strong>IPC</strong> (Inter-Process Communication). Mỗi kênh là một <strong>cánh cửa bạn tự mở</strong> trong bức tường sandbox —
    cần biết ai được vào và mang theo gì.</p>

    <p><strong>1. Android: bốn loại component</strong></p>
    <table>
      <tr><th>Component</th><th>Vai trò</th><th>Rủi ro nếu mở sai</th></tr>
      <tr><td>Activity</td><td>Màn hình</td><td>App khác mở thẳng màn hình nội bộ (bỏ qua đăng nhập, màn hình admin/debug)</td></tr>
      <tr><td>Service</td><td>Tác vụ nền</td><td>App khác ra lệnh cho service làm việc (đồng bộ, gửi dữ liệu)</td></tr>
      <tr><td>BroadcastReceiver</td><td>Nhận sự kiện</td><td>App khác gửi sự kiện giả; hoặc broadcast của bạn bị app khác nghe lén</td></tr>
      <tr><td>ContentProvider</td><td>Chia sẻ dữ liệu có cấu trúc</td><td>App khác đọc/ghi DB của bạn; truy vấn nối chuỗi; đọc file ngoài phạm vi</td></tr>
    </table>

    <p><strong>2. Thuộc tính <code>exported</code></strong></p>
    <ul>
      <li><code>android:exported="true"</code> = app khác gọi được. Từ Android 12, component có intent-filter <strong>bắt buộc</strong> khai báo rõ exported.</li>
      <li>Mặc định: <code>exported="false"</code> cho mọi thứ chỉ dùng nội bộ. Chỉ export Activity launcher và những gì thật sự cần cho app khác.</li>
      <li>Component exported cần: <strong>permission</strong> (tốt nhất <code>protectionLevel="signature"</code> — chỉ app cùng chữ ký của bạn gọi được),
        và <strong>validate mọi dữ liệu</strong> trong Intent như input từ internet.</li>
    </ul>

    <p><strong>3. Intent: implicit vs explicit, và "intent redirection"</strong></p>
    <ul>
      <li><strong>Explicit intent</strong> (chỉ rõ class/package đích) cho giao tiếp nội bộ. <strong>Implicit intent</strong> (chỉ nói action) có thể bị app khác đăng ký cùng action "đón" mất → đừng gửi dữ liệu nhạy cảm qua implicit intent.</li>
      <li>Broadcast chứa dữ liệu nhạy cảm: gửi explicit (setPackage) hoặc kèm permission.</li>
      <li><strong>Intent redirection</strong>: component exported nhận một Intent lồng trong extras rồi <code>startActivity</code> nó → app khác mượn quyền của bạn để mở component <em>không exported</em> của bạn.
        Không bao giờ khởi chạy intent lấy từ input bên ngoài mà không kiểm tra đích đến thuộc allowlist.</li>
    </ul>

    <p><strong>4. PendingIntent</strong> — "tấm vé" cho app khác thực hiện một intent <em>với danh tính của app bạn</em> (dùng cho notification, alarm, widget).</p>
    <ul>
      <li>Luôn dùng <strong>explicit</strong> intent bên trong (chỉ rõ component đích).</li>
      <li>Dùng <code>FLAG_IMMUTABLE</code> (bắt buộc khai báo từ Android 12) để app nhận vé không sửa được nội dung. Chỉ dùng MUTABLE khi thật sự cần (ví dụ inline reply) và vẫn explicit.</li>
    </ul>

    <p><strong>5. ContentProvider và FileProvider</strong></p>
    <ul>
      <li>Không exported nếu không cần. Nếu cần chia sẻ: permission đọc/ghi riêng, hoặc cấp quyền tạm thời theo URI (<code>grantUriPermissions</code>).</li>
      <li>Truy vấn: dùng tham số (<code>selectionArgs</code>), không nối <code>selection</code> từ app gọi vào câu SQL; giới hạn cột trả về (projection allowlist).</li>
      <li>FileProvider: <code>file_paths.xml</code> chỉ khai báo thư mục con cụ thể (ví dụ <code>shared_exports/</code>), không khai báo gốc dữ liệu app. Khi mở file theo tên từ bên ngoài, chuẩn hoá đường dẫn và kiểm tra vẫn nằm trong thư mục cho phép.</li>
    </ul>

    <p><strong>6. iOS: các kênh IPC</strong></p>
    <ul>
      <li><strong>URL scheme</strong>: như deep link (bài 14) — mọi tham số không đáng tin. <code>sourceApplication</code> trong options có thể giúp phân biệt nguồn, nhưng không phải xác thực mạnh.</li>
      <li><strong>Pasteboard</strong>: vùng chung (bài 06). Không dùng làm kênh truyền bí mật giữa các app của bạn.</li>
      <li><strong>App Extension</strong> (share, widget, keyboard, notification service…): chạy tiến trình riêng, chia sẻ dữ liệu với app chính qua <strong>App Group</strong> (container chung + Keychain access group).
        Chỉ đặt vào App Group những gì extension thực sự cần; keyboard extension bên thứ ba với "full access" có thể gửi dữ liệu gõ ra ngoài — với ô nhạy cảm, iOS tự dùng bàn phím hệ thống.</li>
      <li><strong>UIActivityViewController / document picker</strong>: người dùng chủ động chọn app đích — kênh chia sẻ an toàn nhất.</li>
    </ul>

    <p><strong>7. React Native / Flutter</strong> — Framework không thay đổi luật IPC: <code>AndroidManifest.xml</code> và <code>Info.plist</code> vẫn là nơi khai báo.
    Thư viện bên thứ ba có thể <em>tự thêm</em> component exported vào manifest (qua manifest merge) → kiểm tra <strong>merged manifest</strong> của bản release (bài 20, 21).</p>

    <div class="callout"><p>💡 Checklist IPC: <strong>(1) liệt kê mọi cửa</strong> (merged manifest, Info.plist, App Group), <strong>(2) đóng những cửa không cần</strong>,
    <strong>(3) cửa còn mở thì có khoá</strong> (permission signature, xác nhận người dùng), <strong>(4) mọi thứ đi qua cửa đều được validate</strong>.</p></div>
  `,

  codeTabs: [
    { id: "manifest", label: "🤖 Manifest", lines: [
      "<!-- Chỉ dùng nội bộ: không export -->",
      "<activity android:name=\".AdminDebugActivity\" android:exported=\"false\" />",
      "<service android:name=\".SyncService\" android:exported=\"false\" />",
      "",
      "<!-- Cho các app CÙNG chữ ký của công ty gọi -->",
      "<permission android:name=\"com.shop.permission.PARTNER\"",
      "            android:protectionLevel=\"signature\" />",
      "<service android:name=\".PartnerApiService\" android:exported=\"true\"",
      "         android:permission=\"com.shop.permission.PARTNER\" />",
      "",
      "<!-- Provider chia sẻ file: không export, cấp quyền theo URI -->",
      "<provider android:name=\"androidx.core.content.FileProvider\"",
      "    android:authorities=\"com.shop.files\" android:exported=\"false\"",
      "    android:grantUriPermissions=\"true\" />"
    ]},
    { id: "redirect", label: "🔀 Intent redirection", lines: [
      "// ❌ Activity exported chạy intent lấy từ extras",
      "val next = intent.getParcelableExtra<Intent>(\"next\")",
      "startActivity(next)    // app khác mở được Activity KHÔNG exported của bạn",
      "",
      "// ✅ Chỉ chấp nhận đích trong allowlist, tự dựng intent mới",
      "val target = intent.getStringExtra(\"screen\")",
      "val dest = when (target) {",
      "    \"orders\"  -> OrdersActivity::class.java",
      "    \"profile\" -> ProfileActivity::class.java",
      "    else -> return finish()",
      "}",
      "startActivity(Intent(this, dest))                 // explicit, không lấy extras lạ"
    ]},
    { id: "pending", label: "🎟️ PendingIntent", lines: [
      "// ❌ Implicit + mutable: app nhận có thể đổi đích và dữ liệu",
      "PendingIntent.getActivity(ctx, 0, Intent(\"com.shop.OPEN\"), PendingIntent.FLAG_MUTABLE)",
      "",
      "// ✅ Explicit + immutable",
      "val intent = Intent(ctx, OrderDetailActivity::class.java).putExtra(\"orderId\", id)",
      "val pi = PendingIntent.getActivity(ctx, id.hashCode(), intent,",
      "    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)",
      "",
      "// ✅ Broadcast nội bộ: chỉ app mình nhận",
      "sendBroadcast(Intent(\"com.shop.SYNC_DONE\").setPackage(packageName))"
    ]},
    { id: "provider", label: "🗄️ ContentProvider", lines: [
      "// ❌ Nối selection từ app gọi vào SQL, trả mọi cột",
      "override fun query(uri: Uri, proj: Array<String>?, sel: String?, args: Array<String>?, so: String?) =",
      "    db.rawQuery(\"SELECT * FROM notes WHERE \" + sel, null)",
      "",
      "// ✅ Truy vấn cố định, tham số hoá, cột allowlist",
      "private val PUBLIC_COLUMNS = arrayOf(\"id\", \"title\", \"updated_at\")",
      "override fun query(uri: Uri, proj: Array<String>?, sel: String?, args: Array<String>?, so: String?): Cursor {",
      "    val id = uri.lastPathSegment?.toLongOrNull() ?: throw IllegalArgumentException()",
      "    return db.query(\"notes\", PUBLIC_COLUMNS, \"id = ? AND shared = 1\", arrayOf(id.toString()), null, null, null)",
      "}",
      "",
      "<!-- res/xml/file_paths.xml: chỉ thư mục con cụ thể -->",
      "<paths><cache-path name=\"exports\" path=\"shared_exports/\" /></paths>"
    ]},
    { id: "ios", label: "🍎 iOS: scheme & App Group", lines: [
      "// URL scheme: input không đáng tin (xem bài 14)",
      "func scene(_ scene: UIScene, openURLContexts ctxs: Set<UIOpenURLContext>) {",
      "    guard let url = ctxs.first?.url, let route = Router.parse(url) else { return }",
      "    router.show(route)                  // chỉ mở màn hình, không tự hành động",
      "}",
      "",
      "// App Group: chỉ chia sẻ thứ extension cần",
      "let shared = UserDefaults(suiteName: \"group.com.shop\")",
      "shared?.set(widgetSummary, forKey: \"widget_summary\")   // 'Có 2 đơn đang giao'",
      "// KHÔNG đặt refresh token vào App Group nếu extension không cần gọi API",
      "",
      "// Chia sẻ file: để người dùng chọn đích",
      "present(UIActivityViewController(activityItems: [pdfURL], applicationActivities: nil), animated: true)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="other"><div class="nl">👾 App khác trên máy</div><div class="ns">gửi Intent, mở URL scheme, đọc pasteboard</div></div>
    <div class="arrow" id="a1">↓ cửa IPC</div>
    <div class="row">
      <div class="node" id="exported"><div class="nl">🚪 Component exported</div><div class="ns">permission signature?</div></div>
      <div class="node" id="pending"><div class="nl">🎟️ PendingIntent</div><div class="ns">explicit + IMMUTABLE?</div></div>
      <div class="node" id="provider"><div class="nl">🗄️ ContentProvider</div><div class="ns">tham số hoá · cột allowlist</div></div>
    </div>
    <div class="arrow" id="a2">↓ validate mọi dữ liệu đi qua cửa</div>
    <div class="node" id="internal"><div class="nl">🏠 Bên trong app</div><div class="ns">component nội bộ exported=false</div></div>
    <div class="arrow" id="a3">↓ iOS</div>
    <div class="node" id="group"><div class="nl">📦 App Group / Extension</div><div class="ns">chỉ chia sẻ thứ cần thiết</div></div>
  `,

  steps: [
    { title: "1 · Mỗi component exported là một cửa", tab: "manifest", highlight: [2, 3], on: ["other", "a1", "internal"],
      desc: "Mặc định mọi thứ nội bộ phải <code>exported=false</code>. Màn hình debug/admin exported là lối tắt cho app khác bỏ qua đăng nhập." },
    { title: "2 · Cửa cần mở thì có khoá", tab: "manifest", highlight: [6, 7, 8, 9], on: ["exported"],
      desc: "Permission <code>signature</code> chỉ cho app cùng khoá ký của bạn gọi. Dữ liệu trong Intent vẫn phải validate." },
    { title: "3 · Intent redirection", tab: "redirect", highlight: [2, 3, 6, 7, 8, 9, 10, 12], on: ["exported", "a2", "internal"],
      desc: "Chạy intent lấy từ extras = cho app khác mượn danh tính của bạn để mở component không exported. Dựng intent mới từ allowlist." },
    { title: "4 · PendingIntent explicit + immutable", tab: "pending", highlight: [2, 5, 6, 7, 10], on: ["pending"],
      desc: "PendingIntent chạy với danh tính app bạn. Explicit + FLAG_IMMUTABLE để app nhận không đổi được đích và dữ liệu. Broadcast nội bộ gắn setPackage." },
    { title: "5 · ContentProvider an toàn", tab: "provider", highlight: [3, 6, 8, 9, 13], on: ["provider"],
      desc: "Không nối selection vào SQL, không trả mọi cột. FileProvider chỉ khai báo thư mục con dành riêng để chia sẻ." },
    { title: "6 · iOS: scheme & App Group", tab: "ios", highlight: [3, 4, 8, 9, 10, 13], on: ["a3", "group"],
      desc: "URL scheme là input không đáng tin; App Group chỉ chứa dữ liệu extension cần; chia sẻ file qua UIActivityViewController để người dùng chọn đích." }
  ],

  quiz: [
    { q: "Activity màn hình debug nội bộ khai báo exported=\"true\". Rủi ro?", options: [
        "Không rủi ro",
        "App khác mở thẳng được màn hình đó, có thể bỏ qua đăng nhập",
        "App chạy chậm",
        "Chỉ rủi ro trên emulator"
      ], correct: 1,
      explanation: "Component nội bộ phải exported=false." },
    { q: "protectionLevel=\"signature\" nghĩa là gì?", options: [
        "Người dùng phải ký tên",
        "Chỉ app được ký bằng cùng khoá với app định nghĩa permission mới được cấp quyền",
        "Mọi app đều được cấp",
        "Chỉ app hệ thống được cấp"
      ], correct: 1,
      explanation: "Phù hợp để các app của cùng công ty giao tiếp với nhau." },
    { q: "Activity exported đọc Intent từ extra 'next' rồi startActivity(next). Lỗ hổng gọi là gì?", options: [
        "SQL injection",
        "Intent redirection — app khác mượn quyền của bạn mở component không exported",
        "XSS",
        "Buffer overflow"
      ], correct: 1,
      explanation: "Dựng intent mới từ allowlist đích thay vì chạy intent do bên ngoài cung cấp." },
    { q: "PendingIntent nên tạo thế nào?", options: [
        "Implicit + FLAG_MUTABLE",
        "Explicit (chỉ rõ component) + FLAG_IMMUTABLE",
        "Không cần cờ",
        "Dùng intent rỗng"
      ], correct: 1,
      explanation: "App nhận PendingIntent thực thi với danh tính của bạn; immutable ngăn họ sửa." },
    { q: "Broadcast chứa dữ liệu nhạy cảm nên gửi thế nào?", options: [
        "Implicit để mọi app nhận",
        "Explicit với setPackage hoặc kèm permission",
        "Qua clipboard",
        "Qua file trong Downloads"
      ], correct: 1,
      explanation: "Implicit broadcast có thể bị app khác đăng ký cùng action nghe được." },
    { q: "ContentProvider nối selection của app gọi vào câu SQL. Vấn đề?", options: [
        "Không vấn đề",
        "App gọi kiểm soát điều kiện truy vấn, có thể đọc dữ liệu ngoài phạm vi cho phép",
        "Chỉ làm chậm",
        "Provider bị xoá"
      ], correct: 1,
      explanation: "Dùng truy vấn cố định + tham số hoá + cột allowlist." },
    { q: "file_paths.xml của FileProvider nên khai báo gì?", options: [
        "Toàn bộ thư mục dữ liệu app (path=\".\")",
        "Chỉ thư mục con dành riêng để chia sẻ, ví dụ shared_exports/",
        "Thư mục gốc hệ thống",
        "Không cần file này"
      ], correct: 1,
      explanation: "Khai báo rộng cho phép cấp URI tới file nhạy cảm như DB, prefs." },
    { q: "iOS App Group nên chứa gì?", options: [
        "Mọi dữ liệu của app để tiện",
        "Chỉ dữ liệu extension thực sự cần (ví dụ tóm tắt cho widget)",
        "Mật khẩu người dùng",
        "Khoá riêng của server"
      ], correct: 1,
      explanation: "Extension là tiến trình khác; giảm thiểu dữ liệu chia sẻ." },
    { q: "Thư viện React Native tự thêm component exported vào manifest. Làm sao phát hiện?", options: [
        "Không thể phát hiện",
        "Kiểm tra merged manifest của bản release",
        "Đọc README thư viện là đủ",
        "Chạy app trên iOS"
      ], correct: 1,
      explanation: "Manifest merge gộp khai báo của mọi thư viện; phải review kết quả cuối." }
  ]
});
