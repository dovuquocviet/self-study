window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Build, ký & phát hành",
  title: "Build Android: Gradle, DEX, R8, APK vs AAB và ký app",
  subtitle: "kotlinc → .class → D8 → .dex · aapt2 · R8 shrink/obfuscate · build type & flavor · upload key vs Play App Signing",

  theory: `
    <p>Bạn quen <code>mvn package</code> ra một fat JAR. Build Android dài hơn vì đích cuối không phải JVM mà là ART, và gói phải được <strong>ký</strong>.</p>

    <ol>
      <li><strong>Biên dịch mã</strong>: Kotlin/Java → bytecode JVM <code>.class</code> (như server).</li>
      <li><strong>Dex</strong>: công cụ <strong>D8</strong> chuyển <code>.class</code> thành <code>.dex</code> (Dalvik Executable — định dạng thanh ghi, gọn hơn cho mobile), kèm <em>desugaring</em> để dùng API Java mới trên Android cũ.</li>
      <li><strong>Tài nguyên</strong>: <strong>aapt2</strong> biên dịch <code>res/</code> (layout, string, drawable) thành <code>resources.arsc</code> và sinh lớp <code>R</code> (<code>R.string.app_name</code> là một int).</li>
      <li><strong>R8</strong> (release): thu nhỏ (bỏ class/method không dùng), làm rối tên (obfuscate), tối ưu, rồi dex. Tạo <code>mapping.txt</code> — <em>phải lưu lại</em> để đọc stack trace crash. Code dùng reflection (JSON, DI) cần keep rules.</li>
      <li><strong>Đóng gói + ký</strong>: APK là file zip chứa <code>classes.dex</code>, <code>resources.arsc</code>, <code>res/</code>, <code>lib/&lt;abi&gt;/*.so</code>, <code>AndroidManifest.xml</code> (dạng nhị phân); <code>zipalign</code> rồi <code>apksigner</code> ký (APK Signature Scheme v2/v3 ký cả file).</li>
    </ol>

    <p><strong>APK vs AAB</strong></p>
    <table>
      <tr><th></th><th>APK</th><th>AAB (Android App Bundle)</th></tr>
      <tr><td>Là gì</td><td>File cài đặt trực tiếp lên máy</td><td>Định dạng <em>xuất bản</em>, không cài trực tiếp được</td></tr>
      <tr><td>Nội dung</td><td>Mọi ABI, mọi mật độ màn hình, mọi ngôn ngữ</td><td>Tất cả, nhưng Google Play tách thành <em>split APK</em> theo máy (ABI, density, language) → tải về nhỏ hơn</td></tr>
      <tr><td>Dùng khi</td><td>Cài thử nội bộ, phân phối ngoài Play</td><td>Bắt buộc cho app mới trên Google Play (từ 8/2021)</td></tr>
    </table>

    <p><strong>Ký app</strong>: với <strong>Play App Signing</strong>, Google giữ <em>app signing key</em> (khoá thật ký APK tới người dùng); bạn chỉ giữ <em>upload key</em> để ký AAB gửi lên. Mất upload key thì xin reset được; mất app signing key (nếu tự giữ) là không cập nhật app được nữa.
    Chữ ký quyết định "đây có phải cùng một app": bản cập nhật phải cùng khoá ký.</p>

    <p><strong>Biến thể build</strong>: <em>build type</em> (debug/release) × <em>product flavor</em> (vd <code>dev</code>/<code>prod</code>, hay mỗi brand một flavor) = variant, giống profile Maven/Spring. <code>versionCode</code> (số nguyên, phải tăng mỗi lần upload) khác <code>versionName</code> (chuỗi hiển thị "2.3.1").</p>

    <div class="callout"><p>💡 Lưu trữ theo mỗi bản release: AAB, <code>mapping.txt</code>, và native debug symbols. Thiếu mapping thì crash report chỉ còn <code>a.b.c()</code> — vô dụng.</p></div>
  `,

  codeTabs: [
    { id: "gradle", label: "① build.gradle.kts", lines: [
      "android {",
      "    namespace = \"vn.shop.app\"",
      "    compileSdk = 35",
      "    defaultConfig {",
      "        applicationId = \"vn.shop.app\"",
      "        minSdk = 24",
      "        targetSdk = 35",
      "        versionCode = 20301          // phải tăng mỗi lần lên Play",
      "        versionName = \"2.3.1\"",
      "    }",
      "    buildTypes {",
      "        release {",
      "            isMinifyEnabled = true    // bật R8",
      "            isShrinkResources = true",
      "            proguardFiles(getDefaultProguardFile(\"proguard-android-optimize.txt\"), \"proguard-rules.pro\")",
      "            signingConfig = signingConfigs.getByName(\"upload\")",
      "        }",
      "    }",
      "    flavorDimensions += \"env\"",
      "    productFlavors { create(\"dev\") { applicationIdSuffix = \".dev\" }; create(\"prod\") {} }",
      "}"
    ]},
    { id: "pipe", label: "② Chuỗi build", lines: [
      "$ ./gradlew :app:bundleProdRelease",
      "> Task :app:compileProdReleaseKotlin        # .kt -> .class",
      "> Task :app:processProdReleaseResources     # aapt2 -> resources.arsc, R",
      "> Task :app:minifyProdReleaseWithR8         # shrink + obfuscate + dex",
      "> Task :app:bundleProdRelease",
      "",
      "app/build/outputs/bundle/prodRelease/app-prod-release.aab",
      "app/build/outputs/mapping/prodRelease/mapping.txt   # LƯU LẠI"
    ]},
    { id: "apk", label: "③ Bên trong APK", lines: [
      "$ unzip -l app-prod-release.apk",
      "AndroidManifest.xml          # nhị phân",
      "classes.dex  classes2.dex    # bytecode ART",
      "resources.arsc",
      "res/drawable-xxhdpi/...",
      "lib/arm64-v8a/libhermes.so  # thư viện native theo ABI",
      "META-INF/...",
      "",
      "# Từ AAB sinh bộ APK cho đúng một máy để thử:",
      "$ bundletool build-apks --bundle=app.aab --output=app.apks --connected-device"
    ]},
    { id: "sign", label: "④ Ký & keep rules", lines: [
      "$ keytool -genkeypair -v -keystore upload.jks -alias upload \\",
      "    -keyalg RSA -keysize 2048 -validity 10000",
      "$ apksigner verify --print-certs app.apk",
      "",
      "# proguard-rules.pro: giữ class model dùng reflection",
      "-keep class vn.shop.app.data.dto.** { *; }",
      "",
      "# Crash sau R8:  at a.b.c(Unknown Source:12)",
      "$ retrace mapping.txt stacktrace.txt",
      "# -> at vn.shop.app.cart.CartRepository.sync(CartRepository.kt:88)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📝 .kt + res/</div><div class="ns">mã + tài nguyên</div></div>
    <div class="arrow" id="a1">↓ kotlinc · aapt2</div>
    <div class="row">
      <div class="node" id="cls"><div class="nl">☕ .class</div><div class="ns">bytecode JVM</div></div>
      <div class="node" id="arsc"><div class="nl">🗂️ resources.arsc + R</div><div class="ns">tài nguyên đã biên dịch</div></div>
    </div>
    <div class="arrow" id="a2">↓ R8 / D8</div>
    <div class="node" id="dex"><div class="nl">⚙️ classes.dex</div><div class="ns">+ mapping.txt</div></div>
    <div class="arrow" id="a3">↓ đóng gói + ký upload key</div>
    <div class="node" id="aab"><div class="nl">📦 AAB → Google Play</div><div class="ns">Play ký lại bằng app signing key, tách split APK</div></div>
  `,
  steps: [
    { title: "1 · Cấu hình như pom.xml", tab: "gradle", highlight: [3, 5, 6, 7, 8, 9], on: ["src"],
      desc: "applicationId là danh tính app trên Play; versionCode phải tăng; targetSdk quyết định hành vi hệ thống áp dụng cho app." },
    { title: "2 · Biên dịch", tab: "pipe", highlight: [2, 3], on: ["a1", "cls", "arsc"],
      desc: "Kotlin ra .class như server; aapt2 biên dịch tài nguyên và sinh lớp R." },
    { title: "3 · R8: thu nhỏ & dex", tab: "pipe", highlight: [4, 8], on: ["a2", "dex"],
      desc: "R8 bỏ code thừa, đổi tên, ra .dex và mapping.txt để giải mã stack trace." },
    { title: "4 · Bên trong gói", tab: "apk", highlight: [2, 3, 4, 6], on: ["dex"],
      desc: "APK chỉ là zip; .so theo từng ABI là lý do AAB tách split giúp giảm dung lượng." },
    { title: "5 · Ký và gửi AAB", tab: "gradle", highlight: [13, 16, 19, 20], on: ["a3", "aab"],
      desc: "Bản release ký bằng upload key; Play App Signing ký lại bằng khoá thật trước khi phát tới người dùng." },
    { title: "6 · Đọc crash sau R8", tab: "sign", highlight: [6, 8, 9, 10], on: ["aab"],
      desc: "Keep rules cho class dùng reflection; retrace + mapping.txt biến a.b.c thành tên thật." }
  ],

  quiz: [
    { q: "D8 làm gì trong build Android?", options: [
        "Biên dịch Kotlin", "Chuyển bytecode .class thành .dex cho ART", "Ký APK", "Nén ảnh"
      ], correct: 1, explanation: "R8 ở bản release làm luôn phần dex sau khi thu nhỏ." },
    { q: "Vì sao phải lưu mapping.txt cho mỗi bản release?", options: [
        "Để cài app", "Để giải mã stack trace đã bị R8 làm rối tên", "Để ký app", "Google yêu cầu in ra giấy"
      ], correct: 1, explanation: "Không có mapping, crash report chỉ còn tên a.b.c." },
    { q: "AAB khác APK ở điểm nào?", options: [
        "AAB cài trực tiếp được", "AAB là định dạng xuất bản; Play tách thành split APK phù hợp từng máy", "AAB không cần ký", "AAB chỉ cho iOS"
      ], correct: 1, explanation: "Người dùng tải gói nhỏ hơn." },
    { q: "Với Play App Signing, bạn giữ khoá nào?", options: [
        "App signing key", "Upload key", "Cả hai phải gửi Google", "Không cần khoá"
      ], correct: 1, explanation: "Google giữ khoá ký thật; mất upload key có thể xin reset." },
    { q: "versionCode và versionName khác nhau thế nào?", options: [
        "Giống nhau", "versionCode là số nguyên phải tăng mỗi lần upload; versionName là chuỗi hiển thị", "versionName phải tăng, versionCode tuỳ ý", "Chỉ iOS có"
      ], correct: 1, explanation: "Play từ chối upload trùng hoặc nhỏ hơn versionCode đã có." },
    { q: "Bật R8 xong app release crash khi parse JSON. Nguyên nhân thường gặp?", options: [
        "Mạng lỗi", "R8 đổi tên/xoá class model dùng reflection; cần keep rules", "Thiếu quyền", "Sai versionCode"
      ], correct: 1, explanation: "Thư viện dùng codegen (kotlinx.serialization) ít bị hơn reflection." },
    { q: "aapt2 sinh ra lớp R dùng để làm gì?", options: [
        "Lưu token", "Tham chiếu tài nguyên bằng hằng số int như R.string.app_name", "Chạy test", "Ký app"
      ], correct: 1, explanation: "resources.arsc ánh xạ id sang giá trị theo cấu hình (ngôn ngữ, mật độ…)." },
    { q: "Product flavor trong Gradle giống khái niệm nào ở backend?", options: [
        "Transaction", "Profile Maven/Spring — biến thể build với cấu hình khác nhau", "Interceptor", "Thread pool"
      ], correct: 1, explanation: "Build type × flavor = variant." },
    { q: "Bản cập nhật ký bằng khoá khác bản đang cài thì sao?", options: [
        "Cài đè bình thường", "Không cài đè được — hệ thống coi là app khác", "Tự đổi khoá", "Chỉ cảnh báo"
      ], correct: 1, explanation: "Chữ ký là danh tính của app." }
  ]
});
