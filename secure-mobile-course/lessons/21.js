window.LESSONS.push({
  id: "21",
  phase: "6", phaseName: "Phát hành & vận hành",
  title: "Build release an toàn",
  subtitle: "debuggable=false · allowBackup · loại bỏ log & code debug · bảo vệ keystore/khoá ký · mapping, dSYM, source map không public",

  theory: `
    <p>Rất nhiều lỗ hổng mobile không nằm ở code tính năng mà ở <strong>cấu hình build</strong>: một cờ debug quên tắt, một màn hình test còn trong bản release,
    một file source map đóng gói nhầm, hoặc khoá ký app để trong repo. Bài này là checklist cho bước cuối trước khi app đến tay người dùng.</p>

    <p><strong>1. Tắt mọi thứ debug</strong></p>
    <ul>
      <li><strong>Android</strong>: <code>debuggable</code> phải là false ở bản release (mặc định của buildType release — đừng ghi đè). App debuggable cho phép gắn debugger, đọc dữ liệu qua công cụ debug (<code>run-as</code>) mà không cần root.</li>
      <li><strong>iOS</strong>: build Release; entitlement <code>get-task-allow</code> phải là false (Xcode tự đặt khi archive với distribution profile).</li>
      <li><strong>React Native</strong>: bundle release (<code>__DEV__ = false</code>), không bật debug menu, không kết nối Metro; Flipper/dev tools chỉ trong debug.</li>
      <li><strong>Flutter</strong>: build <code>--release</code> (không phải <code>--debug</code>/<code>--profile</code>) — bản debug chứa kernel snapshot dễ đọc và bật VM service.</li>
      <li>WebView debugging, <code>isInspectable</code> chỉ trong debug (bài 16).</li>
    </ul>

    <p><strong>2. Loại bỏ code và dữ liệu chỉ dành cho phát triển</strong></p>
    <ul>
      <li>Màn hình debug, menu "chọn môi trường", tài khoản test, cờ "bỏ qua OTP", URL staging → đặt trong source set/flavor debug (Android <code>src/debug/</code>), <code>#if DEBUG</code> (Swift), <code>if (__DEV__)</code> (RN), <code>kDebugMode</code> (Flutter) — để trình biên dịch loại bỏ hẳn khỏi release, không chỉ ẩn nút.</li>
      <li>Log debug: xoá bằng R8 (<code>-assumenosideeffects</code>), plugin Babel loại bỏ <code>console.*</code> (RN), wrapper log (bài 06).</li>
      <li>Cleartext/CA test chỉ trong <code>debug-overrides</code> (bài 08).</li>
    </ul>

    <p><strong>3. Cấu hình manifest / plist</strong></p>
    <table>
      <tr><th>Mục</th><th>Kiểm tra</th></tr>
      <tr><td><code>android:allowBackup</code></td><td>false, hoặc có <code>dataExtractionRules</code>/<code>fullBackupContent</code> loại trừ dữ liệu nhạy cảm (bài 06)</td></tr>
      <tr><td><code>android:usesCleartextTraffic</code></td><td>Không có / false</td></tr>
      <tr><td><code>exported</code></td><td>Chỉ component thật sự cần; review merged manifest (bài 15, 20)</td></tr>
      <tr><td>Quyền</td><td>Không có quyền thừa; iOS usage description đúng, trung thực (bài 22)</td></tr>
      <tr><td>ATS / NSC</td><td>Không <code>NSAllowsArbitraryLoads</code>; không cleartext toàn cục</td></tr>
      <tr><td>URL scheme / associated domains</td><td>Đúng những gì dùng (bài 14)</td></tr>
    </table>

    <p><strong>4. Khoá ký app — tài sản quan trọng nhất</strong></p>
    <ul>
      <li>Khoá ký (Android upload key / app signing key, iOS distribution certificate) chứng minh bản cập nhật đến từ bạn. Lộ khoá = kẻ khác có thể phát hành bản "chính chủ".</li>
      <li><strong>Play App Signing</strong>: Google giữ khoá ký app; bạn chỉ giữ <em>upload key</em> — nếu mất/lộ upload key thì có thể yêu cầu đặt lại. Nên dùng.</li>
      <li>Không commit keystore/<code>.jks</code>/<code>.p12</code>/mật khẩu vào repo. Không để mật khẩu trong <code>gradle.properties</code> commit. Lưu trong secret manager của CI; chỉ CI ký bản release.</li>
      <li>iOS: chứng chỉ và profile quản lý qua tài khoản Apple Developer có MFA; dùng App Store Connect API key có quyền tối thiểu cho CI.</li>
      <li>Giới hạn số người có quyền truy cập; thu hồi khi nhân sự rời đi.</li>
    </ul>

    <p><strong>5. Mapping, symbol, source map — giữ riêng tư</strong></p>
    <ul>
      <li>R8 <code>mapping.txt</code>, iOS <code>dSYM</code>, Flutter <code>--split-debug-info</code>, RN source map (<code>.map</code>) giúp đọc crash report — và giúp kẻ tấn công đọc code.</li>
      <li>Upload chúng lên hệ thống crash (có kiểm soát truy cập) trong CI; lưu trữ nội bộ theo phiên bản.</li>
      <li><strong>Không</strong> đóng gói vào app, không để trên server web công khai, không đính kèm trong release công khai.</li>
      <li>Kiểm tra gói cuối cùng không chứa <code>.map</code>, file <code>.env</code>, file cấu hình test, thư mục thừa (bài 02).</li>
    </ul>

    <p><strong>6. Pipeline phát hành có kiểm tra tự động</strong></p>
    <ol>
      <li>Build trên CI sạch, từ tag/commit đã review (không build release từ máy cá nhân).</li>
      <li>Chạy SAST mobile (ví dụ MobSF, semgrep rule mobile), quét secret, quét dependency (bài 20).</li>
      <li>Kiểm tra cấu hình artefact: debuggable, allowBackup, cleartext, exported, quyền, file thừa.</li>
      <li>Ký trong CI, upload symbol riêng tư, phát hành theo staged rollout.</li>
      <li>Theo dõi crash và chỉ số bất thường sau phát hành.</li>
    </ol>

    <div class="callout"><p>💡 Nguyên tắc: <strong>kiểm tra artefact cuối cùng, không chỉ kiểm tra source</strong>. Plugin build, manifest merge, flavor nhầm có thể đưa vào gói
    những thứ không ai thấy trong code review. Tự động hoá các kiểm tra này để không phụ thuộc trí nhớ của người phát hành.</p></div>
  `,

  codeTabs: [
    { id: "gradle", label: "🤖 Gradle release", lines: [
      "android {",
      "    signingConfigs {",
      "        create(\"release\") {",
      "            storeFile = file(System.getenv(\"UPLOAD_KEYSTORE_PATH\"))   // từ CI secret",
      "            storePassword = System.getenv(\"UPLOAD_KEYSTORE_PASSWORD\")",
      "            keyAlias = System.getenv(\"UPLOAD_KEY_ALIAS\")",
      "            keyPassword = System.getenv(\"UPLOAD_KEY_PASSWORD\")",
      "        }",
      "    }",
      "    buildTypes {",
      "        release {",
      "            isDebuggable = false                  // mặc định, KHÔNG ghi đè thành true",
      "            isMinifyEnabled = true",
      "            signingConfig = signingConfigs.getByName(\"release\")",
      "        }",
      "    }",
      "}",
      "// Code/màn hình debug đặt trong app/src/debug/ -> không có trong release"
    ]},
    { id: "strip", label: "🧹 Loại bỏ debug", lines: [
      "// Swift",
      "#if DEBUG",
      "let baseURL = URL(string: \"https://staging.shop.com\")!",
      "#else",
      "let baseURL = URL(string: \"https://api.shop.com\")!",
      "#endif",
      "",
      "// React Native — babel.config.js: xoá console.* khi build production",
      "env: { production: { plugins: ['transform-remove-console'] } }",
      "if (__DEV__) { registerDevMenu() }",
      "",
      "// Flutter",
      "if (kDebugMode) { showEnvironmentPicker(); }",
      "",
      "// ❌ Không làm: nút ẩn nhưng code vẫn có trong release",
      "// if (tapCount == 7) openDebugScreen()"
    ]},
    { id: "check", label: "🔍 Kiểm tra artefact", lines: [
      "# Android: đọc manifest thật của APK release",
      "aapt2 dump xmltree app-release.apk --file AndroidManifest.xml \\",
      "  | grep -E 'debuggable|allowBackup|usesCleartextTraffic|exported=\"true\"'",
      "",
      "# Không có file thừa trong gói",
      "unzip -l app-release.apk | grep -E '\\.map$|\\.env|staging' && exit 1",
      "",
      "# iOS: kiểm tra entitlement get-task-allow",
      "codesign -d --entitlements :- Payload/Shop.app | grep -A1 get-task-allow",
      "",
      "# Quét tổng hợp",
      "mobsf-scan app-release.apk --json > mobsf.json"
    ]},
    { id: "symbols", label: "🗺️ Symbol riêng tư", lines: [
      "# CI: upload symbol lên hệ thống crash (có kiểm soát truy cập), rồi xoá khỏi artefact công khai",
      "upload-symbols --platform android --mapping app/build/outputs/mapping/release/mapping.txt",
      "upload-symbols --platform ios --dsym build/Shop.app.dSYM",
      "upload-symbols --platform flutter --dir build/symbols",
      "upload-sourcemaps --bundle index.android.bundle --map index.android.bundle.map",
      "",
      "# Lưu bản sao nội bộ theo phiên bản (bucket private)",
      "store-private artifacts/symbols/$VERSION/",
      "",
      "# KHÔNG: commit, đính kèm release GitHub công khai, để trên web server"
    ]},
    { id: "keys", label: "🔑 Bảo vệ khoá ký", lines: [
      "# .gitignore",
      "*.jks",
      "*.keystore",
      "*.p12",
      "*.mobileprovision",
      "keystore.properties",
      "",
      "# Nguyên tắc",
      "- Dùng Play App Signing: Google giữ app signing key, team giữ upload key",
      "- Keystore + mật khẩu nằm trong secret manager của CI",
      "- Chỉ CI ký bản release; máy cá nhân chỉ ký debug",
      "- Apple: MFA cho tài khoản, API key CI quyền tối thiểu",
      "- Thu hồi quyền khi nhân sự rời đi; có quy trình khi nghi lộ khoá"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">👩‍💻 Commit đã review</div><div class="ns">tag release</div></div>
    <div class="arrow" id="a1">↓ CI sạch</div>
    <div class="node" id="build"><div class="nl">🏗️ Build release</div><div class="ns">debuggable=false · minify · code debug bị loại</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="checks"><div class="nl">🔍 Kiểm tra artefact</div><div class="ns">manifest · entitlements · file thừa · SAST · secret</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="sign"><div class="nl">🔑 Ký trong CI</div><div class="ns">khoá từ secret manager</div></div>
      <div class="node" id="symbols"><div class="nl">🗺️ Symbol riêng tư</div><div class="ns">mapping · dSYM · source map</div></div>
    </div>
    <div class="arrow" id="a4">↓ staged rollout</div>
    <div class="node" id="store"><div class="nl">🏪 Store</div><div class="ns">theo dõi crash & bất thường</div></div>
  `,

  steps: [
    { title: "1 · Cấu hình release chuẩn", tab: "gradle", highlight: [12, 13, 14, 18], on: ["src", "a1", "build"],
      desc: "debuggable=false (đừng ghi đè), minify bật, code debug đặt trong source set debug để không có trong release." },
    { title: "2 · Loại bỏ hẳn code debug", tab: "strip", highlight: [2, 3, 4, 5, 9, 10, 13, 16], on: ["build"],
      desc: "Dùng điều kiện biên dịch (#if DEBUG, __DEV__, kDebugMode) để trình biên dịch bỏ code. 'Nút ẩn' chạm 7 lần vẫn nằm trong gói." },
    { title: "3 · Kiểm tra artefact thật", tab: "check", highlight: [2, 3, 6, 9, 12], on: ["a2", "checks"],
      desc: "Đọc manifest của APK đã build, entitlement của app iOS, danh sách file trong gói; chạy SAST. Thất bại → chặn phát hành." },
    { title: "4 · Khoá ký chỉ ở CI", tab: "gradle", highlight: [4, 5, 6, 7], on: ["a3", "sign"],
      desc: "Keystore và mật khẩu đọc từ biến môi trường do secret manager của CI cung cấp; không nằm trong repo." },
    { title: "5 · Bảo vệ khoá ký", tab: "keys", highlight: [2, 3, 4, 9, 10, 11, 12], on: ["sign"],
      desc: "Play App Signing, .gitignore cho file khoá, MFA cho tài khoản Apple, quyền tối thiểu, quy trình thu hồi." },
    { title: "6 · Symbol lưu riêng tư", tab: "symbols", highlight: [2, 3, 4, 5, 8, 10], on: ["symbols"],
      desc: "Upload mapping/dSYM/symbol/source map lên hệ thống crash có kiểm soát truy cập; không đóng gói, không public." },
    { title: "7 · Phát hành theo giai đoạn", tab: "check", highlight: [12], on: ["a4", "store"],
      desc: "Staged rollout và theo dõi crash giúp phát hiện sớm lỗi cấu hình trước khi đến toàn bộ người dùng." }
  ],

  quiz: [
    { q: "App Android release có debuggable=true. Rủi ro?", options: [
        "Không rủi ro",
        "Có thể gắn debugger và đọc dữ liệu của app qua công cụ debug mà không cần root",
        "App nhỏ hơn",
        "Chỉ ảnh hưởng emulator"
      ], correct: 1,
      explanation: "debuggable phải false ở release (mặc định), không được ghi đè." },
    { q: "Màn hình debug mở bằng cách chạm logo 7 lần trong bản release. Vấn đề?", options: [
        "Không vấn đề vì ẩn",
        "Code vẫn nằm trong gói, ai tìm ra là dùng được; phải loại bỏ bằng điều kiện biên dịch/source set debug",
        "Chỉ vấn đề trên iOS",
        "Làm app chậm"
      ], correct: 1,
      explanation: "Ẩn không phải loại bỏ. Người phân tích gói sẽ tìm thấy." },
    { q: "Keystore release và mật khẩu nên lưu ở đâu?", options: [
        "Commit vào repo cho tiện",
        "Trong gradle.properties commit",
        "Secret manager của CI; chỉ CI ký bản release",
        "Gửi qua chat nhóm"
      ], correct: 2,
      explanation: "Lộ khoá ký = kẻ khác phát hành được bản cập nhật 'chính chủ'." },
    { q: "Play App Signing mang lại lợi ích gì?", options: [
        "Build nhanh hơn",
        "Google giữ app signing key; team chỉ giữ upload key, có thể đặt lại nếu mất/lộ",
        "Không cần ký nữa",
        "Tự động obfuscate"
      ], correct: 1,
      explanation: "Giảm hậu quả khi khoá của team bị lộ." },
    { q: "File mapping.txt / dSYM / source map nên xử lý thế nào?", options: [
        "Đóng gói vào app để debug",
        "Upload lên hệ thống crash có kiểm soát truy cập và lưu nội bộ; không public",
        "Xoá luôn",
        "Đăng kèm release công khai"
      ], correct: 1,
      explanation: "Cần để đọc crash, nhưng lộ ra thì giúp kẻ tấn công đọc code." },
    { q: "Vì sao cần kiểm tra artefact thay vì chỉ review source?", options: [
        "Artefact nhỏ hơn",
        "Manifest merge, plugin build, flavor nhầm có thể thêm thứ không thấy trong code review",
        "Source không quan trọng",
        "Store yêu cầu"
      ], correct: 1,
      explanation: "Kiểm tra đúng thứ sẽ đến tay người dùng." },
    { q: "Flutter: bản nào dùng để phát hành?", options: [
        "--debug",
        "--profile",
        "--release (kèm --obfuscate --split-debug-info nếu cần)",
        "Bất kỳ"
      ], correct: 2,
      explanation: "Bản debug chứa snapshot dễ đọc và bật VM service." },
    { q: "iOS entitlement get-task-allow ở bản App Store nên là?", options: [
        "true",
        "false",
        "Không quan trọng",
        "Tuỳ người dùng"
      ], correct: 1,
      explanation: "true cho phép gắn debugger — chỉ dành cho bản development." },
    { q: "React Native: cách loại bỏ console.log trong production?", options: [
        "Không cần",
        "Plugin Babel (ví dụ transform-remove-console) cho môi trường production",
        "Đổi tên console",
        "Bật Hermes"
      ], correct: 1,
      explanation: "Kết hợp với quy tắc không bao giờ log bí mật (bài 06)." }
  ]
});
