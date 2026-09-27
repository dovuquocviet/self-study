window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Project & Gradle",
  title: "build.gradle.kts của module shared — đọc từng khối",
  subtitle: "Plugin KMP · plugin Android-KMP · version catalog · binaries.framework · task hay dùng",

  theory: `
    <p>Module <code>shared</code> được điều khiển bởi <strong>Kotlin Gradle Plugin</strong> với id <code>org.jetbrains.kotlin.multiplatform</code>.
    Mọi thứ nằm trong khối <code>kotlin { }</code>: khai báo target, cấu hình binary, phụ thuộc theo source set.</p>

    <p><strong>Phần Android</strong> có hai cách:</p>
    <ul>
      <li><strong>Cũ</strong>: plugin <code>com.android.library</code> + <code>androidTarget()</code> trong <code>kotlin { }</code> + khối <code>android { namespace; compileSdk }</code> riêng ở ngoài.</li>
      <li><strong>Mới (khuyến nghị)</strong>: plugin <code>com.android.kotlin.multiplatform.library</code> (cần AGP 8.10+ và Kotlin 2.0+). Cấu hình Android đặt <em>bên trong</em> <code>kotlin { android { ... } }</code>
      (một số phiên bản trước dùng tên <code>androidLibrary { }</code>). Plugin này chỉ có một variant, không có build type/flavor trong module shared — đơn giản hơn và build nhanh hơn.
      Với AGP 9, xu hướng là tách app Android thành module riêng (<code>androidApp</code>) thay vì áp plugin application vào module KMP.</li>
    </ul>

    <p><strong>Phần iOS</strong>: mỗi target iOS khai báo <code>binaries.framework { baseName = "Shared" }</code> để Gradle biết cần xuất framework tên gì.
    <code>isStatic = true</code> tạo static framework (link thẳng vào app, khởi động nhanh hơn, thường được chọn); dynamic framework thì phải được embed vào bundle.</p>

    <p><strong>Phụ thuộc</strong>: viết trong <code>sourceSets { commonMain.dependencies { ... } }</code>. Dùng <code>implementation</code> như Java.
    <code>api</code> nghĩa là consumer cũng thấy thư viện đó. Với iOS còn có <code>export(...)</code> trong framework: chỉ những API được export mới hiện ra cho Swift
    (mặc định Swift chỉ thấy API public của chính module shared, không thấy API của thư viện phụ thuộc).</p>

    <p><strong>Version catalog</strong> (<code>gradle/libs.versions.toml</code>) giữ phiên bản tập trung, giống <code>dependencyManagement</code>/BOM trong Maven. Truy cập bằng <code>libs.ktor.client.core</code>, <code>alias(libs.plugins.kotlin.multiplatform)</code>.</p>

    <table>
      <tr><th>Maven/Spring</th><th>Gradle KMP</th></tr>
      <tr><td><code>&lt;dependency&gt;</code> scope compile</td><td><code>implementation(...)</code> trong source set</td></tr>
      <tr><td>BOM / dependencyManagement</td><td>libs.versions.toml, <code>platform(...)</code></td></tr>
      <tr><td><code>mvn package</code></td><td><code>./gradlew :shared:assemble</code> (+ task link framework)</td></tr>
      <tr><td>Profile</td><td>Build type debug/release của framework</td></tr>
    </table>

    <div class="callout"><p>💡 Kotlin Gradle Plugin, AGP, Compose Multiplatform và các plugin như KSP/SQLDelight có <strong>ma trận tương thích phiên bản</strong>. Khi nâng Kotlin, kiểm tra các plugin kia trước.
    Lỗi build "lạ" trong KMP thường đến từ lệch phiên bản chứ không phải từ code.</p></div>
  `,

  codeTabs: [
    { id: "toml", label: "libs.versions.toml", lines: [
      "[versions]",
      "kotlin = \"2.2.20\"          # ví dụ — dùng bản mới nhất tương thích",
      "agp = \"8.12.0\"",
      "ktor = \"3.2.3\"",
      "coroutines = \"1.10.2\"",
      "",
      "[libraries]",
      "ktor-client-core = { module = \"io.ktor:ktor-client-core\", version.ref = \"ktor\" }",
      "kotlinx-coroutines-core = { module = \"org.jetbrains.kotlinx:kotlinx-coroutines-core\", version.ref = \"coroutines\" }",
      "",
      "[plugins]",
      "kotlin-multiplatform = { id = \"org.jetbrains.kotlin.multiplatform\", version.ref = \"kotlin\" }",
      "android-kmp-library = { id = \"com.android.kotlin.multiplatform.library\", version.ref = \"agp\" }"
    ]},
    { id: "build", label: "shared/build.gradle.kts", lines: [
      "plugins {",
      "    alias(libs.plugins.kotlin.multiplatform)",
      "    alias(libs.plugins.android.kmp.library)",
      "}",
      "",
      "kotlin {",
      "    android {                         // plugin Android-KMP mới",
      "        namespace = \"com.shop.shared\"",
      "        compileSdk = 36",
      "        minSdk = 24",
      "    }",
      "",
      "    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->",
      "        target.binaries.framework {",
      "            baseName = \"Shared\"",
      "            isStatic = true",
      "        }",
      "    }",
      "",
      "    sourceSets {",
      "        commonMain.dependencies {",
      "            implementation(libs.kotlinx.coroutines.core)",
      "            implementation(libs.ktor.client.core)",
      "        }",
      "        commonTest.dependencies { implementation(kotlin(\"test\")) }",
      "    }",
      "}"
    ]},
    { id: "old", label: "Cách cũ (androidTarget)", lines: [
      "plugins {",
      "    alias(libs.plugins.kotlin.multiplatform)",
      "    alias(libs.plugins.android.library)     // com.android.library",
      "}",
      "kotlin {",
      "    androidTarget()",
      "    iosArm64(); iosSimulatorArm64()",
      "}",
      "android {                                  // khối AGP riêng, ngoài kotlin {}",
      "    namespace = \"com.shop.shared\"",
      "    compileSdk = 36",
      "    defaultConfig { minSdk = 24 }",
      "}"
    ]},
    { id: "tasks", label: "Task hay dùng", lines: [
      "./gradlew :shared:tasks --all | grep -i framework   # xem task sinh ra",
      "./gradlew :shared:linkDebugFrameworkIosSimulatorArm64",
      "./gradlew :shared:allTests                          # test mọi target",
      "./gradlew :shared:embedAndSignAppleFrameworkForXcode # gọi từ Xcode build phase",
      "./gradlew :androidApp:installDebug",
      "",
      "# gradle.properties hay gặp",
      "kotlin.code.style=official",
      "org.gradle.jvmargs=-Xmx4g              # K/N tốn RAM khi link"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cat"><div class="nl">📒 libs.versions.toml</div><div class="ns">phiên bản tập trung</div></div>
    <div class="arrow" id="a1">↓ alias(...) / libs.xxx</div>
    <div class="node" id="plug"><div class="nl">🔌 plugins</div><div class="ns">kotlin.multiplatform + android.kmp.library</div></div>
    <div class="row">
      <div class="node" id="and"><div class="nl">🤖 kotlin { android { } }</div><div class="ns">namespace, SDK</div></div>
      <div class="node" id="ios"><div class="nl">🍎 binaries.framework</div><div class="ns">baseName = Shared</div></div>
    </div>
    <div class="node" id="deps"><div class="nl">📦 sourceSets { ... }</div><div class="ns">phụ thuộc theo source set</div></div>
    <div class="arrow" id="a2">↓ ./gradlew</div>
    <div class="node" id="out"><div class="nl">🏁 .aar + Shared.framework</div><div class="ns">cho 2 app tiêu thụ</div></div>
  `,
  steps: [
    { title: "1 · Phiên bản ở một chỗ", tab: "toml", highlight: [2, 3, 8, 12, 13], on: ["cat", "a1"],
      desc: "Catalog giống BOM: đổi phiên bản một nơi, mọi module dùng theo. Tên <code>ktor-client-core</code> thành <code>libs.ktor.client.core</code>." },
    { title: "2 · Áp plugin", tab: "build", highlight: [2, 3], on: ["plug"],
      desc: "Plugin KMP tạo khối <code>kotlin { }</code>; plugin Android-KMP thêm target Android vào đó." },
    { title: "3 · Target Android", tab: "build", highlight: [7, 8, 9, 10], on: ["and"],
      desc: "Với plugin mới, cấu hình Android nằm trong <code>kotlin { android { } }</code>. So với cách cũ ở tab bên cạnh: không còn khối <code>android { }</code> riêng." },
    { title: "4 · Framework cho iOS", tab: "build", highlight: [13, 14, 15, 16], on: ["ios"],
      desc: "Mỗi target iOS sinh một framework. baseName là tên Swift sẽ import. Static framework link thẳng vào binary app." },
    { title: "5 · Phụ thuộc theo source set", tab: "build", highlight: [21, 22, 23, 25], on: ["deps"],
      desc: "Thư viện đa nền tảng khai báo một lần ở commonMain, Gradle tự chọn đúng artifact cho từng target." },
    { title: "6 · Chạy task", tab: "tasks", highlight: [2, 3, 4], on: ["a2", "out"],
      desc: "Link framework cho simulator, chạy test mọi target, và task Xcode gọi trong build phase để nhúng framework." }
  ],

  quiz: [
    { q: "Plugin id của Kotlin Multiplatform là?", options: [
        "org.jetbrains.kotlin.jvm", "org.jetbrains.kotlin.multiplatform", "com.android.application", "kotlin-kapt"
      ], correct: 1, explanation: "Thường khai báo qua alias(libs.plugins.kotlin.multiplatform)." },
    { q: "Plugin Android mới dành cho module thư viện KMP là?", options: [
        "com.android.library", "com.android.kotlin.multiplatform.library", "com.android.dynamic-feature", "org.jetbrains.compose"
      ], correct: 1, explanation: "Cần AGP 8.10+ và Kotlin 2.0+; cấu hình trong kotlin { android { } }." },
    { q: "baseName = \"Shared\" trong binaries.framework quyết định điều gì?", options: [
        "Tên package Kotlin",
        "Tên framework — Swift sẽ viết import Shared",
        "Tên app iOS",
        "Tên module Gradle"
      ], correct: 1, explanation: "Tên package Kotlin không ảnh hưởng tới tên framework." },
    { q: "isStatic = true nghĩa là gì?", options: [
        "Framework chỉ chứa hằng số",
        "Tạo static framework, được link thẳng vào binary app thay vì embed dylib",
        "Tắt GC",
        "Chỉ build release"
      ], correct: 1, explanation: "Static thường khởi động nhanh hơn và dễ tích hợp." },
    { q: "Mặc định Swift có thấy API của thư viện mà shared phụ thuộc (vd kiểu của một thư viện khác) không?", options: [
        "Có, thấy hết",
        "Không đầy đủ — cần export(...) trong cấu hình framework để đưa API đó ra Swift",
        "Chỉ thấy trên simulator",
        "Chỉ thấy khi dùng CocoaPods"
      ], correct: 1, explanation: "Mặc định chỉ API public của chính module được xuất đầy đủ." },
    { q: "libs.versions.toml tương đương gì trong Maven?", options: [
        "pom packaging", "BOM / dependencyManagement — quản lý phiên bản tập trung", "settings.xml", "Profile"
      ], correct: 1, explanation: "Khai báo một lần, dùng lại ở mọi module." },
    { q: "Lỗi build lạ sau khi nâng Kotlin thường do đâu?", options: [
        "Lỗi code business",
        "Lệch phiên bản giữa Kotlin, AGP, Compose, KSP và các plugin khác",
        "Hết pin",
        "Máy chậm"
      ], correct: 1, explanation: "Các plugin có ma trận tương thích; kiểm tra release note." },
    { q: "Task nào thường được Xcode gọi trong Run Script build phase?", options: [
        "assembleRelease", "embedAndSignAppleFrameworkForXcode", "bootRun", "publishToMavenLocal"
      ], correct: 1, explanation: "Task này build framework đúng cấu hình/kiến trúc Xcode đang build và nhúng vào app." },
    { q: "Với plugin Android-KMP mới, module shared có build type/flavor như app không?", options: [
        "Có đủ debug/release và flavor",
        "Không — chỉ có một variant, đơn giản và nhanh hơn",
        "Chỉ có flavor",
        "Tuỳ Xcode"
      ], correct: 1, explanation: "Build type/flavor để ở app Android." }
  ]
});
