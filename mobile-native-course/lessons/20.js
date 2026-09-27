window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Build, ký & phát hành",
  title: "Build iOS: từ Swift tới IPA — certificate, provisioning profile, entitlements",
  subtitle: "swiftc → LLVM → arm64 · .app bundle · archive → IPA · dSYM · 3 mảnh ghép của code signing",

  theory: `
    <p>iOS không có VM: Swift được biên dịch AOT ra mã máy <strong>arm64</strong>. Và iOS <em>chỉ chạy code đã được Apple cho phép ký</em> — đây là phần làm đau đầu nhất khi mới làm iOS.</p>

    <p><strong>Chuỗi build</strong></p>
    <ol>
      <li><code>swiftc</code>: Swift → SIL (tối ưu riêng của Swift) → LLVM IR → mã máy arm64 (<code>.o</code>). Linker ghép thành một file thực thi <strong>Mach-O</strong>.</li>
      <li>Tài nguyên: <code>Assets.xcassets</code> biên dịch thành <code>Assets.car</code>; storyboard → <code>.storyboardc</code>; <code>Info.plist</code> được xử lý (thay biến build).</li>
      <li>Tất cả gom vào thư mục <strong><code>Shop.app</code></strong> (bundle): binary, Info.plist, tài nguyên, <code>Frameworks/</code>, <code>embedded.mobileprovision</code>, <code>_CodeSignature/</code>.</li>
      <li><strong>Archive</strong> (<code>.xcarchive</code>) = bản release + <strong>dSYM</strong> (bảng ký hiệu gỡ lỗi — tương đương mapping.txt, cần để đọc crash). <strong>Export</strong> ra <strong>IPA</strong> = file zip chứa <code>Payload/Shop.app</code>.</li>
    </ol>

    <p><strong>Code signing = 3 mảnh ghép phải khớp nhau</strong></p>
    <table>
      <tr><th>Mảnh</th><th>Là gì</th><th>Chứng minh điều gì</th></tr>
      <tr><td><strong>Certificate</strong> + private key</td><td>Chứng chỉ Apple Development / Apple Distribution do Apple cấp cho team; khoá riêng nằm trong Keychain máy build</td><td><em>Ai</em> ký</td></tr>
      <tr><td><strong>App ID</strong> + <strong>entitlements</strong></td><td>Bundle id (<code>vn.shop.app</code>) và các năng lực đã bật (Push, App Groups, Sign in with Apple…)</td><td>App <em>nào</em>, được làm <em>gì</em></td></tr>
      <tr><td><strong>Provisioning profile</strong></td><td>File do Apple ký, gắn: App ID + certificate(s) + entitlements + (danh sách thiết bị với Development/Ad Hoc)</td><td>Được chạy <em>ở đâu</em>: máy dev, máy trong danh sách, hay chỉ qua App Store</td></tr>
    </table>
    <p>Loại profile: <em>Development</em> (máy đã đăng ký), <em>Ad Hoc</em> (tối đa 100 máy mỗi loại thiết bị mỗi năm), <em>App Store</em> (TestFlight + App Store), <em>Enterprise</em> (nội bộ doanh nghiệp, chương trình riêng).
    Lỗi kinh điển: bật Push trong code/entitlements nhưng profile chưa có năng lực đó → build fail "Provisioning profile doesn't include the aps-environment entitlement".</p>

    <p><strong>Phiên bản</strong>: <code>CFBundleShortVersionString</code> (Marketing Version "2.3.1") và <code>CFBundleVersion</code> (Build number, phải tăng mỗi lần upload cho cùng version). Phụ thuộc: Swift Package Manager (khuyến nghị), CocoaPods (RN dùng nhiều).</p>

    <div class="callout"><p>💡 Trên CI: dùng "automatic signing" với App Store Connect API key, hoặc <code>fastlane match</code> lưu certificate + profile mã hoá trong git riêng để mọi máy build dùng chung. Đừng để certificate chỉ nằm trên laptop một người.</p></div>
  `,

  codeTabs: [
    { id: "xb", label: "① xcodebuild", lines: [
      "$ xcodebuild -workspace Shop.xcworkspace -scheme Shop-Prod \\",
      "    -configuration Release -destination 'generic/platform=iOS' \\",
      "    -archivePath build/Shop.xcarchive archive",
      "",
      "$ xcodebuild -exportArchive -archivePath build/Shop.xcarchive \\",
      "    -exportOptionsPlist ExportOptions.plist -exportPath build/ipa",
      "",
      "build/ipa/Shop.ipa",
      "build/Shop.xcarchive/dSYMs/Shop.app.dSYM      # LƯU LẠI để symbolicate crash"
    ]},
    { id: "bundle", label: "② Bên trong IPA", lines: [
      "$ unzip -l Shop.ipa",
      "Payload/Shop.app/Shop                     # Mach-O arm64",
      "Payload/Shop.app/Info.plist",
      "Payload/Shop.app/Assets.car",
      "Payload/Shop.app/Frameworks/hermes.framework",
      "Payload/Shop.app/PlugIns/NotificationService.appex   # extension, ký riêng",
      "Payload/Shop.app/embedded.mobileprovision",
      "Payload/Shop.app/_CodeSignature/CodeResources",
      "",
      "$ file Payload/Shop.app/Shop",
      "Mach-O 64-bit executable arm64"
    ]},
    { id: "sign", label: "③ Kiểm tra chữ ký", lines: [
      "# Chữ ký và entitlements thực tế trong app",
      "$ codesign -dv --verbose=2 Payload/Shop.app",
      "Authority=Apple Distribution: Shop JSC (ABCDE12345)",
      "$ codesign -d --entitlements :- Payload/Shop.app",
      "<key>aps-environment</key><string>production</string>",
      "",
      "# Nội dung provisioning profile",
      "$ security cms -D -i Payload/Shop.app/embedded.mobileprovision | grep -A2 Entitlements"
    ]},
    { id: "export", label: "④ ExportOptions.plist", lines: [
      "<dict>",
      "  <key>method</key><string>app-store-connect</string>",
      "  <key>teamID</key><string>ABCDE12345</string>",
      "  <key>signingStyle</key><string>automatic</string>",
      "  <key>uploadSymbols</key><true/>",
      "</dict>"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📝 .swift + Assets + Info.plist</div><div class="ns">SPM / CocoaPods</div></div>
    <div class="arrow" id="a1">↓ swiftc → LLVM → arm64, link</div>
    <div class="node" id="app"><div class="nl">📁 Shop.app (Mach-O + tài nguyên)</div><div class="ns">+ extension .appex</div></div>
    <div class="arrow" id="a2">↓ ký</div>
    <div class="row">
      <div class="node" id="cert"><div class="nl">🪪 Certificate + key</div><div class="ns">ai ký</div></div>
      <div class="node" id="ent"><div class="nl">🔑 App ID + entitlements</div><div class="ns">app nào, được làm gì</div></div>
      <div class="node" id="prof"><div class="nl">📜 Provisioning profile</div><div class="ns">chạy ở đâu</div></div>
    </div>
    <div class="arrow" id="a3">↓ archive → export</div>
    <div class="node" id="ipa"><div class="nl">📦 IPA + dSYM</div><div class="ns">upload App Store Connect</div></div>
  `,
  steps: [
    { title: "1 · Archive bằng xcodebuild", tab: "xb", highlight: [1, 2, 3], on: ["src", "a1", "app"],
      desc: "Biên dịch Release cho thiết bị thật (arm64), tạo .xcarchive gồm app và dSYM." },
    { title: "2 · Bên trong bundle", tab: "bundle", highlight: [2, 5, 6, 7, 11], on: ["app"],
      desc: "Binary Mach-O, framework (vd Hermes nếu là RN), extension được ký riêng, profile nhúng sẵn." },
    { title: "3 · Ba mảnh ghép ký", tab: "sign", highlight: [2, 3, 4, 5, 8], on: ["a2", "cert", "ent", "prof"],
      desc: "Certificate nói ai ký; entitlements nói app được làm gì; profile phải cho phép đúng cả hai." },
    { title: "4 · Export IPA", tab: "export", highlight: [2, 4, 5], on: ["a3", "ipa"],
      desc: "method = app-store-connect → ký bằng Distribution cert + App Store profile; upload kèm symbols." },
    { title: "5 · Lưu dSYM", tab: "xb", highlight: [8, 9], on: ["ipa"],
      desc: "Không có dSYM đúng build thì crash report chỉ còn địa chỉ hex." }
  ],

  quiz: [
    { q: "Swift trên iOS được biên dịch thành gì?", options: [
        "Bytecode chạy trên VM", "Mã máy arm64 trong file Mach-O", "JavaScript", "DEX"
      ], correct: 1, explanation: "swiftc → SIL → LLVM IR → arm64." },
    { q: "Ba mảnh ghép của code signing iOS là gì?", options: [
        "Keystore, AAB, Gradle", "Certificate (+ private key), App ID/entitlements, provisioning profile", "Apple ID, mật khẩu, 2FA", "Info.plist, Assets, dSYM"
      ], correct: 1, explanation: "Ba mảnh phải khớp nhau thì mới ký và chạy được." },
    { q: "dSYM dùng để làm gì?", options: [
        "Cài app", "Symbolicate crash: đổi địa chỉ thành tên hàm, file, dòng", "Ký app", "Nén ảnh"
      ], correct: 1, explanation: "Tương đương mapping.txt của Android." },
    { q: "Bật Push trong Xcode nhưng build lỗi thiếu aps-environment trong profile. Sửa thế nào?", options: [
        "Xoá code push", "Bật Push cho App ID và tạo lại/tải lại provisioning profile có năng lực đó", "Đổi bundle id ngẫu nhiên", "Tắt code signing"
      ], correct: 1, explanation: "Profile phải bao gồm mọi entitlement app khai báo." },
    { q: "Provisioning profile loại Ad Hoc dùng khi nào?", options: [
        "Phát hành App Store", "Cài bản thử lên các máy đã đăng ký UDID (giới hạn số máy mỗi năm)", "Chạy simulator", "Chỉ cho Mac"
      ], correct: 1, explanation: "Giới hạn 100 máy mỗi loại thiết bị mỗi năm thành viên." },
    { q: "IPA thực chất là gì?", options: [
        "Ảnh đĩa", "File zip chứa Payload/<App>.app", "Một file Mach-O", "Tệp cấu hình"
      ], correct: 1, explanation: "Giống APK cũng là zip." },
    { q: "Khi upload bản mới cùng Marketing Version 2.3.1, cái gì phải tăng?", options: [
        "Không gì", "CFBundleVersion (build number)", "Bundle id", "Team ID"
      ], correct: 1, explanation: "App Store Connect từ chối build number trùng." },
    { q: "Notification Service Extension (.appex) trong app cần gì về ký?", options: [
        "Không cần ký", "Được ký riêng với App ID và profile của chính nó", "Dùng chung chữ ký với website", "Chỉ ký khi debug"
      ], correct: 1, explanation: "Mỗi target có bundle id riêng (vd vn.shop.app.NotificationService)." },
    { q: "Giải pháp chia sẻ certificate/profile cho nhiều máy CI?", options: [
        "Gửi file .p12 qua chat", "fastlane match hoặc automatic signing với App Store Connect API key", "Mỗi máy tạo certificate riêng mỗi lần build", "Tắt code signing"
      ], correct: 1, explanation: "Tập trung, mã hoá, có kiểm soát." }
  ]
});
