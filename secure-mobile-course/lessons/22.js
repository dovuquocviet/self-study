window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Phát hành & vận hành",
  title: "Quyền riêng tư & tuân thủ",
  subtitle: "Tối thiểu hoá dữ liệu · xin quyền đúng lúc · ATT · Data Safety & Privacy manifest · PII, consent, quyền xoá tài khoản",

  theory: `
    <p>Bảo mật trả lời "dữ liệu có bị kẻ xấu lấy không?". Quyền riêng tư trả lời câu hỏi rộng hơn: <strong>"chính chúng ta có nên thu thập, dùng, chia sẻ dữ liệu này không?"</strong>
    Trên mobile, quyền riêng tư được thực thi bởi ba bên: <strong>hệ điều hành</strong> (quyền, ATT), <strong>cửa hàng</strong> (Data Safety, Privacy manifest, review) và <strong>pháp luật</strong>
    (GDPR ở châu Âu, Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân ở Việt Nam, CCPA ở California…).</p>

    <p><strong>1. Tối thiểu hoá dữ liệu — nguyên tắc gốc</strong></p>
    <ul>
      <li>Chỉ thu thập dữ liệu phục vụ <strong>mục đích cụ thể</strong> đã thông báo; không "thu hết để sau này dùng".</li>
      <li>Chọn mức chi tiết thấp nhất đủ dùng: vị trí gần đúng thay vì chính xác, năm sinh thay vì ngày sinh, 4 số cuối thẻ.</li>
      <li>Xử lý trên thiết bị khi có thể (nhận diện, gợi ý) thay vì gửi dữ liệu thô lên server.</li>
      <li>Đặt thời hạn lưu trữ và xoá khi hết mục đích.</li>
    </ul>

    <p><strong>2. Xin quyền OS đúng cách (nhắc lại và mở rộng bài 03)</strong></p>
    <ul>
      <li>Xin <strong>đúng lúc</strong>, gắn với hành động của người dùng; hiển thị màn hình giải thích trước hộp thoại hệ thống.</li>
      <li>Dùng API không cần quyền khi có: <strong>Photo Picker</strong> (Android 13+ / <code>PHPickerViewController</code> iOS) thay vì quyền đọc cả thư viện ảnh; chọn liên hệ qua picker thay vì quyền danh bạ; vị trí gần đúng.</li>
      <li>Quyền chạy nền (vị trí nền, Bluetooth nền) cần lý do rất rõ và bị store kiểm duyệt gắt.</li>
      <li>Tôn trọng từ chối: không hỏi lại liên tục, không khoá toàn bộ app vì một quyền không thiết yếu.</li>
    </ul>

    <p><strong>3. App Tracking Transparency (ATT) — iOS</strong></p>
    <ul>
      <li>"Tracking" = liên kết dữ liệu người dùng từ app của bạn với dữ liệu của công ty khác để quảng cáo nhắm mục tiêu/đo lường, hoặc chia sẻ với data broker.</li>
      <li>Muốn tracking hoặc đọc IDFA → phải hỏi qua <code>ATTrackingManager.requestTrackingAuthorization</code> với chuỗi <code>NSUserTrackingUsageDescription</code>.</li>
      <li>Người dùng từ chối → IDFA toàn số 0, và bạn <strong>không được</strong> dùng cách khác (fingerprinting thiết bị) để theo dõi thay thế.</li>
      <li>Android tương đương: Advertising ID có thể bị người dùng xoá; cần quyền <code>AD_ID</code> để đọc; tôn trọng lựa chọn "không cá nhân hoá quảng cáo".</li>
    </ul>

    <p><strong>4. Khai báo trên cửa hàng</strong></p>
    <table>
      <tr><th>Cửa hàng</th><th>Khai báo</th><th>Nội dung</th></tr>
      <tr><td>Google Play</td><td>Data Safety section</td><td>Loại dữ liệu thu thập/chia sẻ, mục đích, có mã hoá khi truyền, người dùng có yêu cầu xoá được không</td></tr>
      <tr><td>App Store</td><td>Privacy Nutrition Label (App Privacy)</td><td>Dữ liệu dùng để tracking, liên kết với danh tính, không liên kết</td></tr>
      <tr><td>App Store</td><td><strong>Privacy manifest</strong> (<code>PrivacyInfo.xcprivacy</code>)</td><td>Loại dữ liệu thu thập, domain tracking, và lý do dùng "required reason API" (ví dụ UserDefaults, thời gian khởi động hệ thống, dung lượng đĩa)</td></tr>
    </table>
    <ul>
      <li>Khai báo phải bao gồm cả dữ liệu do <strong>SDK bên thứ ba</strong> thu thập (bài 20). Nhiều SDK có privacy manifest riêng — Xcode gộp lại thành báo cáo.</li>
      <li>Khai báo sai với hành vi thật → bị gỡ app, và là vấn đề pháp lý.</li>
      <li>Coi khai báo như tài liệu sống: cập nhật mỗi khi thêm tính năng/SDK thu thập dữ liệu mới.</li>
    </ul>

    <p><strong>5. PII (thông tin định danh cá nhân) — xử lý trong code</strong></p>
    <ul>
      <li>Nhận diện PII: họ tên, email, số điện thoại, CCCD, địa chỉ, vị trí chính xác, ảnh khuôn mặt, dữ liệu sức khoẻ, tài chính, danh bạ; dữ liệu nhạy cảm đặc biệt (sức khoẻ, sinh trắc học, tôn giáo…) cần bảo vệ cao hơn.</li>
      <li>Không đưa PII vào log, analytics, crash report, URL (bài 06).</li>
      <li>Truyền qua HTTPS (bài 08), lưu mã hoá (Pha 1), chỉ hiển thị phần cần thiết (che bớt: <code>0912***678</code>).</li>
    </ul>

    <p><strong>6. Consent và quyền của người dùng</strong></p>
    <ul>
      <li>Consent cho analytics/quảng cáo phải rõ ràng, tách từng mục đích, mặc định tắt khi luật yêu cầu; rút lại dễ như khi đồng ý. Lưu bằng chứng consent (thời điểm, phiên bản chính sách).</li>
      <li><strong>Xoá tài khoản trong app</strong>: App Store và Google Play yêu cầu app có tạo tài khoản phải cho phép bắt đầu xoá tài khoản ngay trong app (Google Play yêu cầu thêm một đường dẫn web).</li>
      <li>Cho người dùng xem/xuất dữ liệu của họ theo yêu cầu pháp luật áp dụng.</li>
      <li>Chính sách quyền riêng tư có link trong app và trên trang store, viết dễ hiểu, khớp với thực tế.</li>
    </ul>

    <div class="callout"><p>💡 Lập <strong>bản đồ dữ liệu</strong> (data inventory): mỗi loại dữ liệu → thu ở màn hình nào → mục đích → lưu ở đâu, bao lâu → chia sẻ với ai (kể cả SDK).
    Bản đồ này vừa là cơ sở để điền Data Safety/Privacy manifest, vừa là checklist bảo mật cho từng loại dữ liệu.</p></div>
  `,

  codeTabs: [
    { id: "perm", label: "📷 Không cần quyền nếu có picker", lines: [
      "// Android: Photo Picker — không cần READ_MEDIA_IMAGES",
      "val pick = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->",
      "    uri?.let { uploadAvatar(it) }",
      "}",
      "pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))",
      "",
      "// iOS: PHPicker — không cần quyền thư viện ảnh",
      "var cfg = PHPickerConfiguration(); cfg.filter = .images; cfg.selectionLimit = 1",
      "present(PHPickerViewController(configuration: cfg), animated: true)",
      "",
      "// Flutter image_picker / RN image picker cũng dùng picker hệ thống khi có thể"
    ]},
    { id: "att", label: "🍎 ATT", lines: [
      "// Info.plist",
      "NSUserTrackingUsageDescription = 'Cho phép để xem quảng cáo phù hợp hơn với bạn'",
      "",
      "// Swift: chỉ hỏi khi thật sự tracking, sau khi app đã active",
      "ATTrackingManager.requestTrackingAuthorization { status in",
      "    switch status {",
      "    case .authorized: Ads.enablePersonalized()",
      "    default:          Ads.disablePersonalized()   // KHÔNG fingerprint thay thế",
      "    }",
      "}",
      "",
      "// React Native: expo-tracking-transparency; Flutter: app_tracking_transparency"
    ]},
    { id: "manifest", label: "📄 Privacy manifest", lines: [
      "<!-- PrivacyInfo.xcprivacy (rút gọn) -->",
      "<key>NSPrivacyTracking</key><false/>",
      "<key>NSPrivacyCollectedDataTypes</key><array>",
      "  <dict>",
      "    <key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeEmailAddress</string>",
      "    <key>NSPrivacyCollectedDataTypeLinked</key><true/>",
      "    <key>NSPrivacyCollectedDataTypeTracking</key><false/>",
      "    <key>NSPrivacyCollectedDataTypePurposes</key>",
      "    <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>",
      "  </dict>",
      "</array>",
      "<key>NSPrivacyAccessedAPITypes</key><array>",
      "  <dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string>",
      "    <key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array></dict>",
      "</array>"
    ]},
    { id: "consent", label: "✅ Consent & xoá tài khoản", lines: [
      "// Consent tách theo mục đích, mặc định tắt",
      "consent = { analytics: 'denied', ads: 'denied', crash: 'granted_legit_interest' }",
      "onUserChoice(choice):",
      "    consent = choice; saveConsent(choice, policyVersion='2026-05', at=now())",
      "    Analytics.setEnabled(consent.analytics == 'granted')",
      "",
      "// Xoá tài khoản ngay trong app",
      "Settings > Tài khoản > Xoá tài khoản",
      "  -> xác thực lại (step-up)",
      "  -> api.delete('/me')          // server xoá/ẩn danh dữ liệu theo chính sách lưu trữ",
      "  -> thu hồi mọi phiên, xoá dữ liệu cục bộ (bài 13)"
    ]},
    { id: "inventory", label: "🗺️ Bản đồ dữ liệu", lines: [
      "# Dữ liệu      | Thu ở đâu      | Mục đích        | Lưu trữ              | Chia sẻ",
      "Email           | Đăng ký        | Đăng nhập, hoá đơn | Server, mã hoá     | Nhà cung cấp email",
      "Số điện thoại   | Đăng ký        | OTP             | Server               | Nhà cung cấp SMS",
      "Vị trí gần đúng | Tìm cửa hàng   | Tính khoảng cách| Không lưu            | Không",
      "Ảnh CCCD        | eKYC           | Xác minh danh tính | Server, 90 ngày   | Đối tác eKYC",
      "Crash log       | SDK crash      | Sửa lỗi         | Bên thứ ba, 90 ngày  | Nhà cung cấp crash",
      "",
      "# Mỗi dòng -> 1 mục trong Data Safety / Privacy manifest",
      "# Mỗi dòng -> câu hỏi bảo mật: truyền, lưu, log, backup, xoá thế nào?"
    ]}
  ],

  stageHtml: `
    <div class="node" id="collect"><div class="nl">🧾 Cần dữ liệu gì?</div><div class="ns">mục đích cụ thể · mức chi tiết thấp nhất</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="os"><div class="nl">🔐 OS</div><div class="ns">quyền đúng lúc · picker · ATT</div></div>
      <div class="node" id="store"><div class="nl">🏪 Store</div><div class="ns">Data Safety · Privacy label · xcprivacy</div></div>
      <div class="node" id="law"><div class="nl">⚖️ Pháp luật</div><div class="ns">consent · quyền xoá · thời hạn lưu</div></div>
    </div>
    <div class="arrow" id="a2">↓ bao gồm cả SDK bên thứ ba</div>
    <div class="node" id="map"><div class="nl">🗺️ Bản đồ dữ liệu</div><div class="ns">thu ở đâu · để làm gì · lưu bao lâu · chia sẻ với ai</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="user"><div class="nl">🙋 Người dùng kiểm soát</div><div class="ns">đồng ý / rút lại · xem · xoá tài khoản</div></div>
  `,

  steps: [
    { title: "1 · Không xin quyền nếu có đường khác", tab: "perm", highlight: [2, 5, 8, 9], on: ["collect", "a1", "os"],
      desc: "Photo Picker và PHPicker cho người dùng chọn đúng ảnh cần chia sẻ mà app không cần quyền đọc cả thư viện." },
    { title: "2 · ATT khi tracking", tab: "att", highlight: [2, 5, 7, 8], on: ["os"],
      desc: "Tracking hoặc đọc IDFA phải hỏi qua ATT. Bị từ chối thì tắt cá nhân hoá — không dùng fingerprinting để lách." },
    { title: "3 · Privacy manifest", tab: "manifest", highlight: [2, 5, 6, 7, 9, 13, 14], on: ["store"],
      desc: "Khai báo loại dữ liệu, có liên kết danh tính/tracking không, mục đích, và lý do dùng các API cần giải trình như UserDefaults." },
    { title: "4 · Bản đồ dữ liệu", tab: "inventory", highlight: [1, 2, 4, 5, 6, 8, 9], on: ["a2", "map"],
      desc: "Mỗi loại dữ liệu một dòng — bao gồm dữ liệu do SDK thu. Đây là nguồn để điền khai báo store và để rà soát bảo mật." },
    { title: "5 · Consent theo mục đích", tab: "consent", highlight: [2, 4, 5], on: ["law", "user"],
      desc: "Tách từng mục đích, mặc định tắt khi luật yêu cầu, lưu bằng chứng, áp dụng ngay vào SDK." },
    { title: "6 · Xoá tài khoản trong app", tab: "consent", highlight: [8, 9, 10, 11], on: ["a3", "user"],
      desc: "Store yêu cầu cho phép bắt đầu xoá tài khoản ngay trong app. Xác thực lại, xoá/ẩn danh ở server, thu hồi phiên, xoá dữ liệu cục bộ." }
  ],

  quiz: [
    { q: "Tính năng đổi ảnh đại diện nên dùng cách nào?", options: [
        "Xin quyền đọc toàn bộ thư viện ảnh",
        "Dùng Photo Picker / PHPicker — người dùng chọn một ảnh, app không cần quyền thư viện",
        "Đọc thư mục DCIM trực tiếp",
        "Upload cả thư viện lên server"
      ], correct: 1,
      explanation: "Picker hệ thống là cách tối thiểu hoá quyền." },
    { q: "Người dùng từ chối ATT. App có được dùng fingerprinting thiết bị để theo dõi thay thế không?", options: [
        "Có",
        "Không — đó là vi phạm chính sách App Store",
        "Có, nếu không dùng IDFA",
        "Có, trên iPad"
      ], correct: 1,
      explanation: "Từ chối tracking nghĩa là không tracking bằng bất kỳ cách nào." },
    { q: "Data Safety section trên Google Play cần bao gồm dữ liệu do SDK bên thứ ba thu thập không?", options: [
        "Không, chỉ dữ liệu app tự thu",
        "Có — dữ liệu SDK thu thập cũng tính là của app",
        "Chỉ SDK quảng cáo",
        "Chỉ khi SDK trả phí"
      ], correct: 1,
      explanation: "Với người dùng và store, hành vi SDK là hành vi của app." },
    { q: "Privacy manifest (PrivacyInfo.xcprivacy) dùng để làm gì?", options: [
        "Cấu hình HTTPS",
        "Khai báo loại dữ liệu thu thập, domain tracking và lý do dùng các 'required reason API'",
        "Lưu mật khẩu",
        "Cấu hình push"
      ], correct: 1,
      explanation: "Apple dùng để tổng hợp nhãn quyền riêng tư và kiểm tra lý do dùng API." },
    { q: "Nguyên tắc tối thiểu hoá dữ liệu nghĩa là?", options: [
        "Thu thập mọi thứ, dùng sau",
        "Chỉ thu dữ liệu cần cho mục đích cụ thể, ở mức chi tiết thấp nhất, lưu trong thời hạn cần thiết",
        "Nén dữ liệu",
        "Chỉ lưu trên thiết bị"
      ], correct: 1,
      explanation: "Dữ liệu không thu thập thì không thể bị lộ." },
    { q: "App cho tạo tài khoản. Yêu cầu của store về xoá tài khoản?", options: [
        "Không có yêu cầu",
        "Phải cho phép bắt đầu xoá tài khoản ngay trong app",
        "Chỉ cần gửi email hỗ trợ",
        "Chỉ cần gỡ app"
      ], correct: 1,
      explanation: "Cả App Store và Google Play đều yêu cầu; Google Play cần thêm đường dẫn web." },
    { q: "Consent cho analytics nên thiết kế thế nào?", options: [
        "Một nút 'Đồng ý tất cả' duy nhất, không có từ chối",
        "Tách theo mục đích, rút lại dễ như đồng ý, lưu bằng chứng (thời điểm, phiên bản chính sách)",
        "Ẩn trong điều khoản",
        "Không cần consent"
      ], correct: 1,
      explanation: "Consent phải cụ thể, tự nguyện và có thể rút lại." },
    { q: "Hiển thị số điện thoại trong màn hình hồ sơ nên thế nào?", options: [
        "Hiển thị đầy đủ luôn",
        "Che bớt (vd 0912***678), chỉ hiện đầy đủ khi người dùng yêu cầu",
        "Không bao giờ hiển thị",
        "Hiển thị trong thông báo đẩy"
      ], correct: 1,
      explanation: "Chỉ hiển thị phần cần thiết, giảm rủi ro người đứng cạnh nhìn thấy." },
    { q: "'Bản đồ dữ liệu' (data inventory) giúp gì?", options: [
        "Vẽ bản đồ Google Maps",
        "Làm cơ sở điền khai báo store và rà soát bảo mật cho từng loại dữ liệu",
        "Tăng tốc app",
        "Thay thế chính sách quyền riêng tư"
      ], correct: 1,
      explanation: "Biết dữ liệu nào, ở đâu, chia sẻ với ai là nền tảng cho cả tuân thủ lẫn bảo mật." }
  ]
});
