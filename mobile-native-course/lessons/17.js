window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Kiến trúc app & tài nguyên hệ thống",
  title: "Permissions: xin quyền đúng lúc, đúng cách, trên cả hai nền tảng",
  subtitle: "normal / dangerous / special · runtime request · rationale · Info.plist usage description · chỉ hỏi được một lần · picker không cần quyền",

  theory: `
    <p>Sandbox (bài 01) chặn mặc định; permission là cánh cửa người dùng mở cho bạn. Khác với <code>@PreAuthorize</code> trong Spring (server tự kiểm tra), ở đây <strong>người dùng quyết định</strong>, có thể từ chối, và có thể thu hồi bất kỳ lúc nào trong Settings.</p>

    <p><strong>Android — ba loại</strong></p>
    <ul>
      <li><strong>Normal</strong> (<code>INTERNET</code>, <code>VIBRATE</code>): khai báo trong manifest là có.</li>
      <li><strong>Dangerous / runtime</strong> (camera, vị trí, micro, danh bạ, <code>POST_NOTIFICATIONS</code> từ Android 13): khai báo <em>và</em> xin lúc chạy bằng <code>ActivityResultContracts.RequestPermission</code>.</li>
      <li><strong>Special</strong> (vẽ đè app khác, exact alarm, truy cập mọi file): người dùng phải bật trong màn Settings riêng.</li>
    </ul>
    <p>Hành vi cần biết: người dùng từ chối lần 1 → <code>shouldShowRequestPermissionRationale()</code> trả true, bạn nên giải thích trước khi hỏi lại. Từ Android 11, <strong>từ chối hai lần</strong> thì hệ thống không hiện hộp thoại nữa — chỉ còn cách mở Settings.
    Android 11 thêm quyền "chỉ lần này" và tự thu hồi quyền của app lâu không dùng. Vị trí nền (<code>ACCESS_BACKGROUND_LOCATION</code>) phải xin <em>riêng, sau</em> vị trí foreground.</p>

    <p><strong>iOS</strong></p>
    <ul>
      <li>Mỗi quyền cần một <strong>usage description</strong> trong Info.plist (<code>NSCameraUsageDescription</code>, <code>NSLocationWhenInUseUsageDescription</code>…). Thiếu → app <em>crash</em> ngay lúc truy cập. Nội dung mô tả là thứ App Review đọc.</li>
      <li>Hộp thoại hệ thống chỉ hiện <strong>một lần</strong> cho mỗi quyền. Bị từ chối thì chỉ có thể dẫn người dùng tới Settings (<code>UIApplication.openSettingsURLString</code>).</li>
      <li>Có các mức trung gian: vị trí "khi dùng app"/"luôn luôn" và "vị trí chính xác" bật/tắt; Photos "truy cập giới hạn" (chọn vài ảnh); thông báo <em>provisional</em> (gửi im lặng vào Notification Center không cần hỏi).</li>
      <li><strong>App Tracking Transparency</strong>: muốn dùng IDFA/theo dõi xuyên app phải hỏi quyền ATT.</li>
    </ul>

    <p><strong>Cách tốt nhất là không cần quyền</strong>: Photo Picker (Android 13+, backport qua Google Play services) và <code>PhotosPicker</code>/<code>PHPickerViewController</code> (iOS) cho phép chọn ảnh mà không cần quyền đọc thư viện; dùng Intent/<code>UIImagePickerController</code> gọi app camera hệ thống thay vì xin quyền camera khi chỉ cần chụp một tấm.</p>

    <div class="callout"><p>💡 Xin quyền <strong>đúng ngữ cảnh</strong>: khi người dùng bấm "Quét mã QR" mới xin camera, không xin dồn 5 quyền ở màn splash. Với iOS (chỉ hỏi được một lần), hiện màn "pre-permission" của bạn trước để tăng tỉ lệ đồng ý.</p></div>
  `,

  codeTabs: [
    { id: "and", label: "① Android: xin camera", lines: [
      "<!-- AndroidManifest.xml -->",
      "<uses-permission android:name=\"android.permission.CAMERA\"/>",
      "",
      "val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->",
      "    if (granted) openScanner() else showDeniedHint()",
      "}",
      "",
      "fun onScanClick() = when {",
      "    ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PERMISSION_GRANTED -> openScanner()",
      "    activity.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) -> showRationaleDialog()",
      "    else -> launcher.launch(Manifest.permission.CAMERA)",
      "}"
    ]},
    { id: "ios", label: "② iOS: Info.plist + request", lines: [
      "<!-- Info.plist: thiếu dòng này = crash khi mở camera -->",
      "<key>NSCameraUsageDescription</key>",
      "<string>Dùng camera để quét mã QR trên hoá đơn.</string>",
      "",
      "switch AVCaptureDevice.authorizationStatus(for: .video) {",
      "case .authorized: openScanner()",
      "case .notDetermined:",
      "    let ok = await AVCaptureDevice.requestAccess(for: .video)   // hộp thoại chỉ hiện 1 lần",
      "    ok ? openScanner() : showDeniedHint()",
      "case .denied, .restricted:",
      "    await UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)",
      "@unknown default: break",
      "}"
    ]},
    { id: "notif", label: "③ Quyền thông báo", lines: [
      "// Android 13+ (target 33+): runtime permission",
      "<uses-permission android:name=\"android.permission.POST_NOTIFICATIONS\"/>",
      "launcher.launch(Manifest.permission.POST_NOTIFICATIONS)",
      "",
      "// iOS",
      "let granted = try await UNUserNotificationCenter.current()",
      "    .requestAuthorization(options: [.alert, .badge, .sound])",
      "// hoặc .provisional: gửi im lặng vào Notification Center, không hỏi trước"
    ]},
    { id: "picker", label: "④ Không cần quyền", lines: [
      "// Android: Photo Picker — không cần READ_MEDIA_IMAGES",
      "val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->",
      "    uri?.let(::upload)",
      "}",
      "pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))",
      "",
      "// iOS: PhotosPicker chạy ngoài process app — không cần quyền Photos",
      "PhotosPicker(selection: $item, matching: .images) { Text(\"Chọn ảnh\") }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="tap"><div class="nl">👆 Người dùng bấm "Quét QR"</div><div class="ns">đúng ngữ cảnh</div></div>
    <div class="arrow" id="a1">↓ kiểm tra trạng thái</div>
    <div class="row">
      <div class="node" id="granted"><div class="nl">✅ Đã cho</div><div class="ns">dùng luôn</div></div>
      <div class="node" id="rat"><div class="nl">💬 Giải thích (rationale)</div><div class="ns">từng từ chối 1 lần</div></div>
    </div>
    <div class="arrow" id="a2">↓ hộp thoại hệ thống</div>
    <div class="node" id="dialog"><div class="nl">🛡️ OS hỏi người dùng</div><div class="ns">iOS: 1 lần · Android 11+: tối đa 2 lần</div></div>
    <div class="arrow" id="a3">↓ bị từ chối hẳn</div>
    <div class="node" id="settings"><div class="nl">⚙️ Dẫn tới Settings</div><div class="ns">hoặc dùng picker không cần quyền</div></div>
  `,
  steps: [
    { title: "1 · Khai báo", tab: "and", highlight: [2], on: ["tap"],
      desc: "Không có trong manifest thì không bao giờ xin được." },
    { title: "2 · Kiểm tra trước khi xin", tab: "and", highlight: [8, 9, 10, 11], on: ["a1", "granted", "rat"],
      desc: "Đã cho → dùng; từng từ chối → giải thích; chưa hỏi → mở hộp thoại." },
    { title: "3 · Nhận kết quả", tab: "and", highlight: [4, 5], on: ["a2", "dialog"],
      desc: "Activity Result API trả về granted; không còn override onRequestPermissionsResult." },
    { title: "4 · iOS: usage description", tab: "ios", highlight: [2, 3, 7, 8], on: ["dialog"],
      desc: "Chuỗi mô tả hiện trong hộp thoại; thiếu nó app crash. Hộp thoại chỉ có một cơ hội." },
    { title: "5 · Bị từ chối → Settings", tab: "ios", highlight: [10, 11], on: ["a3", "settings"],
      desc: "Chỉ còn cách mở trang cài đặt của app." },
    { title: "6 · Tránh xin quyền nếu được", tab: "picker", highlight: [2, 5, 8], on: ["settings"],
      desc: "Picker hệ thống trả về đúng ảnh người dùng chọn, không cần quyền đọc thư viện." }
  ],

  quiz: [
    { q: "App iOS truy cập camera mà thiếu NSCameraUsageDescription trong Info.plist thì sao?", options: [
        "Hộp thoại hiện với chữ mặc định", "App crash khi truy cập", "Tự được cấp quyền", "Bị từ chối âm thầm"
      ], correct: 1, explanation: "Hệ thống terminate app vì thiếu usage description." },
    { q: "Trên iOS, người dùng đã từ chối quyền camera. App có thể hiện lại hộp thoại hệ thống không?", options: [
        "Có, gọi requestAccess lần nữa", "Không; chỉ có thể dẫn tới Settings", "Có sau 24 giờ", "Có nếu cài lại app"
      ], correct: 1, explanation: "Hộp thoại chỉ hiện khi trạng thái là notDetermined." },
    { q: "shouldShowRequestPermissionRationale() trả true nghĩa là gì?", options: [
        "Đã được cấp quyền", "Người dùng từng từ chối; nên giải thích trước khi hỏi lại", "Quyền không tồn tại", "Phải mở Settings"
      ], correct: 1, explanation: "Sau khi bị từ chối hẳn, hàm trả false và hộp thoại không hiện nữa." },
    { q: "Từ Android 13, gửi notification cần gì?", options: [
        "Không cần gì", "Runtime permission POST_NOTIFICATIONS (với app target 33+)", "Quyền INTERNET", "Root"
      ], correct: 1, explanation: "Trước 13 thông báo được bật mặc định." },
    { q: "Muốn cho người dùng chọn một ảnh đại diện, cách tốt nhất?", options: [
        "Xin quyền đọc toàn bộ thư viện ảnh", "Dùng Photo Picker / PhotosPicker — không cần quyền", "Xin quyền camera", "Đọc thẳng thư mục DCIM"
      ], correct: 1, explanation: "Ít quyền hơn = tin cậy hơn, dễ qua review hơn." },
    { q: "Xin quyền vị trí nền trên Android cần lưu ý gì?", options: [
        "Xin cùng lúc với vị trí foreground", "Xin riêng ACCESS_BACKGROUND_LOCATION sau khi đã có vị trí foreground", "Không cần xin", "Chỉ khai báo manifest"
      ], correct: 1, explanation: "Hệ thống thường đưa người dùng tới Settings cho lựa chọn 'Luôn cho phép'." },
    { q: "Loại permission Android nào người dùng phải bật trong màn Settings riêng?", options: [
        "Normal", "Dangerous", "Special (vd SYSTEM_ALERT_WINDOW, exact alarm)", "Signature"
      ], correct: 2, explanation: "Không có hộp thoại runtime cho special permission." },
    { q: "Thời điểm xin quyền tốt nhất?", options: [
        "Tất cả ở màn splash", "Khi người dùng thực hiện hành động cần quyền đó, kèm giải thích", "Sau khi app crash", "Không bao giờ xin"
      ], correct: 1, explanation: "Ngữ cảnh rõ ràng tăng tỉ lệ đồng ý." },
    { q: "Muốn dùng IDFA để đo quảng cáo xuyên app trên iOS cần gì?", options: [
        "Không cần gì", "Xin quyền App Tracking Transparency", "Quyền Location", "Entitlement push"
      ], correct: 1, explanation: "Không có sự đồng ý, IDFA trả về toàn số 0." }
  ]
});
