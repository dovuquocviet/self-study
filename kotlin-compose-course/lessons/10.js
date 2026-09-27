window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Android & Gradle",
  title: "Cấu trúc project Android & Gradle Kotlin DSL",
  subtitle: "Manifest · Activity · vòng đời & config change · settings/build.gradle.kts · version catalog · compose plugin",

  theory: `
    <p>Với dev Spring: Gradle ở đây đóng vai Maven/Gradle quen thuộc, nhưng output không phải JAR mà là <strong>APK/AAB</strong> — gói gồm DEX (bytecode),
    tài nguyên đã biên dịch và <code>AndroidManifest.xml</code>. Không có <code>main()</code>: hệ điều hành đọc manifest và <em>tự khởi tạo</em> các component.</p>

    <table>
      <tr><th>File / thư mục</th><th>Vai trò</th><th>Tương đương Spring</th></tr>
      <tr><td><code>settings.gradle.kts</code></td><td>Khai báo repo plugin/dependency và các module (<code>include(":app")</code>)</td><td>parent pom <code>&lt;modules&gt;</code></td></tr>
      <tr><td><code>gradle/libs.versions.toml</code></td><td><strong>Version catalog</strong>: gom version + toạ độ thư viện một chỗ, dùng qua <code>libs.xxx</code></td><td><code>dependencyManagement</code>/BOM</td></tr>
      <tr><td><code>app/build.gradle.kts</code></td><td>Plugin, <code>android { }</code> (namespace, compileSdk, minSdk, targetSdk), dependencies</td><td>pom của module</td></tr>
      <tr><td><code>app/src/main/AndroidManifest.xml</code></td><td>Khai báo Activity, quyền (INTERNET...), Application class</td><td>Không có tương đương trực tiếp</td></tr>
      <tr><td><code>app/src/main/java/...</code> (hoặc <code>kotlin/</code>)</td><td>Code Kotlin</td><td><code>src/main/java</code></td></tr>
      <tr><td><code>app/src/main/res/</code></td><td>Tài nguyên: strings, drawable, mipmap (icon)... → sinh class <code>R</code></td><td><code>resources/</code></td></tr>
      <tr><td><code>src/test</code> / <code>src/androidTest</code></td><td>Unit test (JVM) / test chạy trên máy thật hoặc emulator</td><td><code>src/test</code></td></tr>
    </table>

    <p><strong>Ba con số SDK</strong>: <code>minSdk</code> — Android thấp nhất được cài; <code>compileSdk</code> — bộ API dùng để biên dịch; <code>targetSdk</code> — bạn cam kết đã
    kiểm thử với hành vi của phiên bản này (Google Play yêu cầu targetSdk gần mới nhất).</p>

    <p><strong>Activity & vòng đời</strong>: với Compose, app thường chỉ có <em>một</em> <code>ComponentActivity</code>, gọi <code>setContent { }</code> trong <code>onCreate</code>.
    Vòng đời: <code>onCreate → onStart → onResume</code> (đang tương tác) → <code>onPause → onStop</code> (ra nền) → <code>onDestroy</code>.
    <strong>Config change</strong> (xoay màn hình, đổi ngôn ngữ, dark mode) mặc định <em>huỷ và tạo lại</em> Activity — mọi biến trong Activity mất. Đây là lý do có ViewModel (bài 20).
    Ngoài ra, khi ở nền, hệ điều hành có thể <strong>giết cả process</strong> (process death) để lấy RAM; user quay lại thì app được dựng lại từ trạng thái đã lưu.</p>

    <p><strong>Compose compiler</strong>: từ Kotlin 2.0, compiler Compose là plugin Kotlin <code>org.jetbrains.kotlin.plugin.compose</code>, version đi theo Kotlin (không còn
    <code>kotlinCompilerExtensionVersion</code>). Từ AGP 9, Kotlin đã tích hợp sẵn trong Android Gradle Plugin nên không cần plugin <code>org.jetbrains.kotlin.android</code> nữa
    (project cũ vẫn thấy dòng này). Thư viện Compose lấy version qua <strong>Compose BOM</strong>, giống Spring Boot BOM.</p>

    <div class="callout"><p>💡 Annotation processor: Room, Hilt dùng <strong>KSP</strong> (Kotlin Symbol Processing, plugin <code>com.google.devtools.ksp</code>), nhanh hơn kapt (kapt phải sinh stub Java).
    Thấy <code>ksp(libs.room.compiler)</code> trong dependencies nghĩa là thư viện đó sinh code lúc build — như Lombok/MapStruct bên Java.</p></div>
  `,

  codeTabs: [
    { id: "tree", label: "① Cây thư mục", lines: [
      "shop-app/",
      "├── settings.gradle.kts          # module nào, lấy plugin/lib ở đâu",
      "├── build.gradle.kts             # plugin khai báo 'apply false' cho cả project",
      "├── gradle/libs.versions.toml    # version catalog",
      "└── app/",
      "    ├── build.gradle.kts         # cấu hình module app",
      "    └── src/",
      "        ├── main/AndroidManifest.xml",
      "        ├── main/java/vn/shop/app/MainActivity.kt",
      "        ├── main/res/values/strings.xml",
      "        ├── test/                # unit test chạy trên JVM",
      "        └── androidTest/         # test chạy trên thiết bị"
    ]},
    { id: "toml", label: "② libs.versions.toml", lines: [
      "# số phiên bản chỉ để minh hoạ — luôn kiểm tra bản mới",
      "[versions]",
      "agp = \"9.0.0\"",
      "kotlin = \"2.3.21\"",
      "composeBom = \"2026.01.00\"",
      "",
      "[libraries]",
      "androidx-compose-bom = { group = \"androidx.compose\", name = \"compose-bom\", version.ref = \"composeBom\" }",
      "androidx-compose-material3 = { group = \"androidx.compose.material3\", name = \"material3\" }",
      "androidx-activity-compose = { group = \"androidx.activity\", name = \"activity-compose\", version = \"1.10.1\" }",
      "",
      "[plugins]",
      "android-application = { id = \"com.android.application\", version.ref = \"agp\" }",
      "kotlin-compose = { id = \"org.jetbrains.kotlin.plugin.compose\", version.ref = \"kotlin\" }"
    ]},
    { id: "gradle", label: "③ app/build.gradle.kts", lines: [
      "plugins {",
      "    alias(libs.plugins.android.application)",
      "    alias(libs.plugins.kotlin.compose)      // Compose compiler (Kotlin 2.x)",
      "}",
      "",
      "android {",
      "    namespace = \"vn.shop.app\"",
      "    compileSdk = 36",
      "    defaultConfig {",
      "        applicationId = \"vn.shop.app\"         // ID trên Play Store",
      "        minSdk = 24",
      "        targetSdk = 36",
      "        versionCode = 12                      // số nguyên tăng dần mỗi bản phát hành",
      "        versionName = \"1.4.0\"",
      "    }",
      "    buildFeatures { compose = true }",
      "}",
      "",
      "dependencies {",
      "    implementation(platform(libs.androidx.compose.bom))   // BOM quyết version",
      "    implementation(libs.androidx.compose.material3)       // không cần ghi version",
      "    implementation(libs.androidx.activity.compose)",
      "}"
    ]},
    { id: "act", label: "④ Manifest & Activity", lines: [
      "<!-- AndroidManifest.xml -->",
      "<uses-permission android:name=\"android.permission.INTERNET\" />",
      "<application android:name=\".ShopApp\" android:label=\"@string/app_name\">",
      "  <activity android:name=\".MainActivity\" android:exported=\"true\">",
      "    <intent-filter>   <!-- đây là màn hình mở khi bấm icon -->",
      "      <action android:name=\"android.intent.action.MAIN\" />",
      "      <category android:name=\"android.intent.category.LAUNCHER\" />",
      "    </intent-filter>",
      "  </activity>",
      "</application>",
      "",
      "class MainActivity : ComponentActivity() {",
      "    override fun onCreate(savedInstanceState: Bundle?) {",
      "        super.onCreate(savedInstanceState)",
      "        enableEdgeToEdge()",
      "        setContent { ShopTheme { ShopApp() } }   // từ đây là thế giới Compose",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="gr"><div class="nl">🐘 Gradle: settings → toml → app/build.gradle.kts</div><div class="ns">AGP + Kotlin + Compose compiler + KSP</div></div>
    <div class="arrow" id="a1">↓ build</div>
    <div class="node" id="apk"><div class="nl">📦 APK / AAB</div><div class="ns">DEX + res + AndroidManifest.xml</div></div>
    <div class="arrow" id="a2">↓ user bấm icon — OS đọc manifest</div>
    <div class="node" id="act"><div class="nl">📱 MainActivity.onCreate → setContent { }</div><div class="ns">onStart · onResume · onPause · onStop · onDestroy</div></div>
    <div class="arrow" id="a3">↓ xoay màn hình / process death</div>
    <div class="node" id="re"><div class="nl">♻️ Activity bị huỷ & tạo lại</div><div class="ns">biến trong Activity mất → cần ViewModel / saved state</div></div>
  `,
  steps: [
    { title: "1 · Bố cục project", tab: "tree", highlight: [2, 4, 6, 8, 11, 12], on: ["gr"],
      desc: "Một project nhiều module; module <code>app</code> chứa manifest, code, tài nguyên và hai loại test." },
    { title: "2 · Version catalog", tab: "toml", highlight: [2, 4, 5, 8, 14], on: ["gr"],
      desc: "Version khai báo một chỗ; plugin Compose compiler dùng chung version với Kotlin." },
    { title: "3 · Cấu hình module app", tab: "gradle", highlight: [3, 8, 11, 12, 16, 20, 21], on: ["gr", "a1"],
      desc: "compileSdk/minSdk/targetSdk, bật compose, và dùng BOM để các thư viện Compose khớp version với nhau." },
    { title: "4 · Output & manifest", tab: "act", highlight: [2, 4, 6, 7], on: ["apk", "a2"],
      desc: "OS tìm Activity có intent-filter MAIN/LAUNCHER để mở khi bấm icon. Quên quyền INTERNET → mọi request mạng lỗi." },
    { title: "5 · Activity khởi động Compose", tab: "act", highlight: [12, 13, 16], on: ["act"],
      desc: "Một Activity duy nhất; <code>setContent</code> là cầu nối sang cây composable." },
    { title: "6 · Config change & process death", tab: "act", highlight: [13], on: ["a3", "re"],
      desc: "Xoay màn hình tạo lại Activity. <code>savedInstanceState</code> là Bundle hệ thống giữ hộ qua cả process death — nền của rememberSaveable/SavedStateHandle." }
  ],

  quiz: [
    { q: "App Android bắt đầu chạy từ đâu?", options: [
        "Hàm main()", "OS đọc AndroidManifest và khởi tạo Activity có intent-filter MAIN/LAUNCHER", "Class Application luôn gọi main", "File build.gradle.kts"
      ], correct: 1, explanation: "Component do hệ điều hành tạo, không phải bạn." },
    { q: "minSdk = 24 nghĩa là?", options: [
        "Chỉ chạy trên Android 24", "Thiết bị dưới API 24 không cài được app", "Biên dịch bằng API 24", "Target hành vi API 24"
      ], correct: 1, explanation: "compileSdk mới là API dùng để biên dịch." },
    { q: "Mặc định khi xoay màn hình, Activity thế nào?", options: [
        "Giữ nguyên", "Bị huỷ và tạo lại — biến trong Activity mất", "Tạm dừng", "App restart hoàn toàn"
      ], correct: 1, explanation: "Config change → recreate." },
    { q: "Compose BOM đóng vai trò gì?", options: [
        "Biên dịch composable", "Quy định version tương thích cho các thư viện Compose, như Spring Boot BOM", "Tạo APK", "Chạy test"
      ], correct: 1, explanation: "Dùng platform(bom) rồi khai báo thư viện không kèm version." },
    { q: "Với Kotlin 2.x, bật Compose compiler bằng cách nào?", options: [
        "composeOptions { kotlinCompilerExtensionVersion = ... }",
        "Áp plugin org.jetbrains.kotlin.plugin.compose (version theo Kotlin)",
        "Thêm dependency compose-compiler vào implementation",
        "Không cần gì"
      ], correct: 1, explanation: "Cách cũ kotlinCompilerExtensionVersion dành cho Kotlin 1.x." },
    { q: "Từ AGP 9, điều gì thay đổi với Kotlin?", options: [
        "Không hỗ trợ Kotlin", "Kotlin tích hợp sẵn trong AGP, không cần plugin org.jetbrains.kotlin.android", "Bắt buộc kapt", "Phải viết Groovy"
      ], correct: 1, explanation: "Có thể opt-out khi chưa sẵn sàng migrate." },
    { q: "Thiếu uses-permission INTERNET trong manifest thì?", options: [
        "Không sao", "Request mạng bị từ chối (SecurityException / lỗi socket)", "App không build", "Chỉ ảnh hưởng HTTP"
      ], correct: 1, explanation: "INTERNET là quyền thường, chỉ cần khai báo, không cần hỏi user." },
    { q: "KSP dùng để làm gì?", options: [
        "Ký APK", "Xử lý annotation và sinh code lúc build (Room, Hilt...), nhanh hơn kapt", "Nén ảnh", "Chạy test UI"
      ], correct: 1, explanation: "Tương tự annotation processor bên Java." },
    { q: "src/test và src/androidTest khác nhau?", options: [
        "Không khác", "test chạy trên JVM máy dev; androidTest chạy trên thiết bị/emulator", "androidTest nhanh hơn", "test chỉ cho Java"
      ], correct: 1, explanation: "Unit test nhanh, instrumented test cần thiết bị." },
    { q: "Process death là gì?", options: [
        "App crash", "OS giết process của app ở nền để lấy RAM; quay lại thì app dựng lại từ trạng thái đã lưu", "User force stop", "Hết pin"
      ], correct: 1, explanation: "ViewModel không sống qua process death; saved state thì có." }
  ]
});
