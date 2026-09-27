window.LESSONS.push({
  id: "18",
  phase: "4", phaseName: "Tài nguyên: bộ nhớ, mạng, pin, dung lượng",
  title: "Kích thước app: R8, AAB, app thinning, asset",
  subtitle: "Download size vs install size · minify + shrinkResources · split theo ABI/mật độ · slicing · bitcode đã bỏ · đo bằng APK Analyzer & Thinning report",

  theory: `
    <p>App nặng làm giảm tỉ lệ cài (nhất là ở thị trường mạng đắt/máy ít bộ nhớ), cài/cập nhật lâu, và thường kéo theo startup chậm (nhiều code, nhiều thư viện).
    Phân biệt <strong>download size</strong> (nén, người dùng tải) và <strong>install size</strong> (sau khi giải nén/cài, chiếm bộ nhớ máy).</p>

    <p><strong>Android</strong></p>
    <ul>
      <li><strong>Android App Bundle (AAB)</strong>: bạn upload AAB, Google Play sinh <em>split APK</em> cho từng máy — chỉ ABI (arm64-v8a...), mật độ màn hình và ngôn ngữ mà máy đó cần.
      App RN có thư viện native cho 4 ABI; APK "universal" chứa hết, AAB thì mỗi máy chỉ tải một.</li>
      <li><strong>R8</strong> (<code>isMinifyEnabled = true</code>): bỏ class/method không dùng, rút gọn tên, tối ưu bytecode. <code>isShrinkResources = true</code>: bỏ resource không được tham chiếu.
      Cần <em>keep rules</em> cho code dùng reflection (serialization, một số SDK) — và giữ file <code>mapping.txt</code> để đọc stack trace.</li>
      <li>Ảnh: vector drawable cho icon, WebP cho ảnh bitmap; ảnh lớn/ít dùng tải từ CDN thay vì đóng gói.</li>
    </ul>
    <p>RN: file <code>android/app/build.gradle</code> có biến <code>enableProguardInReleaseBuilds</code> (mặc định <code>false</code>) — bật lên để có R8, kiểm tra kỹ bản release sau khi bật.</p>

    <p><strong>iOS</strong></p>
    <ul>
      <li><strong>App thinning</strong>: App Store tự tạo biến thể cho từng loại máy (<em>slicing</em>): chỉ kiến trúc và asset (@2x/@3x) cần thiết. Ảnh phải nằm trong <strong>Asset Catalog</strong> mới được slicing.</li>
      <li><strong>Bitcode</strong> đã bị deprecated từ Xcode 14 — App Store không còn nhận bitcode; đừng tìm cách bật nó để giảm size.</li>
      <li><em>Dead code stripping</em>, tối ưu Swift <code>-Osize</code> khi size quan trọng hơn tốc độ; loại bỏ framework/SDK trùng chức năng; On-Demand Resources cho nội dung tải sau.</li>
    </ul>

    <p><strong>Đo</strong>: Android Studio <em>Build → Analyze APK</em> (xem được cả AAB), <code>bundletool get-size total</code>, báo cáo App size trong Play Console;
    iOS: xuất archive với <em>App Thinning: All compatible device variants</em> → file <code>App Thinning Size Report.txt</code>, và App Store Connect hiển thị size theo từng thiết bị.</p>

    <div class="callout"><p>💡 Thêm SDK = thêm size + thêm thời gian khởi động + thêm rủi ro. Trước khi thêm thư viện 3 MB để dùng một hàm, hỏi: có tự viết 50 dòng được không?
    Đặt ngân sách size (vd download ≤ 30 MB) và kiểm tra trong CI (bài 19).</p></div>
  `,

  codeTabs: [
    { id: "r8", label: "① R8 (Gradle)", lines: [
      "// app/build.gradle.kts",
      "android {",
      "    buildTypes {",
      "        release {",
      "            isMinifyEnabled = true              // R8: shrink + obfuscate + optimize code",
      "            isShrinkResources = true            // bỏ resource không dùng (cần minify)",
      "            proguardFiles(",
      "                getDefaultProguardFile(\"proguard-android-optimize.txt\"),",
      "                \"proguard-rules.pro\"",
      "            )",
      "        }",
      "    }",
      "}",
      "// Lưu build/outputs/mapping/release/mapping.txt cho mỗi bản phát hành"
    ]},
    { id: "rn", label: "② RN Android", lines: [
      "// android/app/build.gradle (template RN)",
      "def enableProguardInReleaseBuilds = true      // mặc định false",
      "",
      "android {",
      "    buildTypes {",
      "        release {",
      "            minifyEnabled enableProguardInReleaseBuilds",
      "            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'",
      "        }",
      "    }",
      "}",
      "# Luôn phát hành AAB: ./gradlew bundleRelease → mỗi máy chỉ tải 1 ABI"
    ]},
    { id: "measure", label: "③ Đo size", lines: [
      "# Android: kích thước tải về ước tính cho từng cấu hình máy",
      "bundletool build-apks --bundle=app-release.aab --output=app.apks",
      "bundletool get-size total --apks=app.apks",
      "# MIN,MAX",
      "# 18432000,24117000",
      "",
      "# Android Studio: Build → Analyze APK... → xem lib/, res/, classes*.dex",
      "",
      "# iOS: Organizer → Distribute → Custom → App Thinning: All compatible device variants",
      "#   → App Thinning Size Report.txt (compressed / uncompressed cho từng máy)"
    ]},
    { id: "where", label: "④ Size đi đâu (ví dụ)", lines: [
      "app-release (universal APK)          62.0 MB",
      "├─ lib/ (4 ABI × native libs RN)     38.5 MB   ← AAB: mỗi máy chỉ ~1/4",
      "├─ assets/index.android.bundle        6.1 MB   ← bundle Hermes bytecode",
      "├─ classes*.dex                       9.8 MB   ← R8 giảm còn ~5 MB",
      "├─ res/ (ảnh PNG đóng gói)            6.4 MB   ← WebP / vector / CDN",
      "└─ khác                               1.2 MB"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">🧱 Code + thư viện + asset</div><div class="ns">cái gì thực sự cần?</div></div>
    <div class="arrow" id="a1">↓ build</div>
    <div class="row">
      <div class="node" id="r8"><div class="nl">✂️ R8 / dead strip</div><div class="ns">bỏ code & resource không dùng</div></div>
      <div class="node" id="asset"><div class="nl">🖼️ Asset</div><div class="ns">WebP · vector · Asset Catalog · CDN</div></div>
    </div>
    <div class="arrow" id="a2">↓ phát hành</div>
    <div class="row">
      <div class="node" id="aab"><div class="nl">🤖 AAB → split APK</div><div class="ns">theo ABI · mật độ · ngôn ngữ</div></div>
      <div class="node" id="thin"><div class="nl">🍎 App thinning</div><div class="ns">slicing theo thiết bị</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="dl"><div class="nl">📥 Download size trên máy người dùng</div><div class="ns">đo & đặt ngân sách</div></div>
  `,
  steps: [
    { title: "1 · Biết size đi đâu", tab: "where", highlight: [1, 2, 4, 5], on: ["src"],
      desc: "Trước khi tối ưu, mở APK Analyzer. Với app RN, lib/ native cho 4 ABI thường chiếm phần lớn APK universal." },
    { title: "2 · Bật R8", tab: "r8", highlight: [5, 6, 8, 14], on: ["a1", "r8"],
      desc: "Minify + shrinkResources. Test kỹ bản release (reflection cần keep rule) và lưu mapping.txt để giải mã crash." },
    { title: "3 · RN: bật ProGuard/R8", tab: "rn", highlight: [2, 7, 12], on: ["r8", "aab"],
      desc: "Template RN mặc định tắt. Phát hành AAB thay vì APK universal." },
    { title: "4 · Asset hợp lý", tab: "where", highlight: [5], on: ["asset"],
      desc: "PNG lớn → WebP hoặc vector; ảnh banner/onboarding ít dùng → tải từ CDN khi cần." },
    { title: "5 · Đo size thật người dùng tải", tab: "measure", highlight: [2, 3, 5, 9, 10], on: ["a2", "aab", "thin", "a3", "dl"],
      desc: "bundletool get-size cho MIN/MAX theo cấu hình máy; iOS có Thinning Size Report theo từng thiết bị." }
  ],

  quiz: [
    { q: "Lợi ích chính của Android App Bundle (AAB) về size?", options: [
        "Nén code tốt hơn zip",
        "Google Play sinh split APK: mỗi máy chỉ tải ABI, mật độ, ngôn ngữ mình cần",
        "Xoá code không dùng",
        "Chuyển Java sang Kotlin"
      ], correct: 1, explanation: "Đặc biệt có lợi với app có thư viện native nhiều ABI như RN." },
    { q: "isShrinkResources = true làm gì?", options: [
        "Nén ảnh PNG",
        "Loại bỏ resource không được tham chiếu (cần bật minify)",
        "Xoá thư viện native",
        "Giảm độ phân giải màn hình"
      ], correct: 1, explanation: "Hoạt động dựa trên kết quả phân tích của R8." },
    { q: "Rủi ro khi bật R8 là gì và xử lý thế nào?", options: [
        "Không có rủi ro",
        "Code dùng reflection có thể bị xoá/đổi tên → thêm keep rules, test kỹ bản release, giữ mapping.txt",
        "App chậm hơn",
        "Không build được iOS"
      ], correct: 1, explanation: "mapping.txt cần để đọc stack trace đã obfuscate." },
    { q: "Trạng thái của bitcode hiện nay?", options: [
        "Bắt buộc để giảm size",
        "Deprecated từ Xcode 14, App Store không còn nhận bitcode",
        "Chỉ dùng cho watchOS mới",
        "Tự bật trong RN"
      ], correct: 1, explanation: "Đừng dựa vào bitcode." },
    { q: "Điều kiện để ảnh được App Store slicing theo @2x/@3x?", options: [
        "Đặt trong thư mục gốc",
        "Nằm trong Asset Catalog",
        "Định dạng BMP",
        "Tên có chữ 'slice'"
      ], correct: 1, explanation: "Asset Catalog cho phép chọn biến thể phù hợp thiết bị." },
    { q: "Trong template RN, biến nào bật R8/ProGuard cho release Android?", options: [
        "hermesEnabled", "enableProguardInReleaseBuilds", "newArchEnabled", "reactNativeArchitectures"
      ], correct: 1, explanation: "Mặc định false trong android/app/build.gradle." },
    { q: "Lệnh nào ước tính download size theo cấu hình máy từ AAB?", options: [
        "bundletool get-size total --apks=app.apks",
        "adb shell du",
        "./gradlew clean",
        "xcodebuild -showsdks"
      ], correct: 0, explanation: "Cần build-apks trước để có file .apks." },
    { q: "Download size khác install size thế nào?", options: [
        "Giống nhau",
        "Download size là dữ liệu nén người dùng tải; install size là dung lượng sau khi cài, thường lớn hơn",
        "Install size luôn nhỏ hơn",
        "Chỉ iOS có download size"
      ], correct: 1, explanation: "Cả hai đều ảnh hưởng quyết định cài của người dùng." },
    { q: "Trên iOS, báo cáo nào cho biết size từng biến thể thiết bị trước khi phát hành?", options: [
        "App Thinning Size Report khi export với 'All compatible device variants'",
        "Console log",
        "Instruments Leaks",
        "Info.plist"
      ], correct: 0, explanation: "Có kích thước nén và không nén cho từng loại máy." }
  ]
});
