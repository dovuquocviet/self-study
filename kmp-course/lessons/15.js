window.LESSONS.push({
  id: "15",
  phase: "5", phaseName: "Build, runtime & test",
  title: "Phân phối cho iOS: XCFramework, SPM, CocoaPods",
  subtitle: "Gộp nhiều kiến trúc · Package.swift binaryTarget + checksum · KMMBridge · repo riêng hay monorepo",

  theory: `
    <p>Direct integration (bài 06) yêu cầu dev iOS build Kotlin từ source. Khi đội iOS ở repo khác, hoặc CI iOS không muốn cài JDK/Gradle, ta <strong>phát hành binary</strong>.</p>

    <p><strong>XCFramework</strong> là định dạng của Apple gộp nhiều biến thể của cùng một framework (thiết bị arm64, simulator arm64, simulator x86_64, macOS...) vào một thư mục <code>.xcframework</code>.
    Xcode tự chọn biến thể đúng khi build. Một <code>.framework</code> thường chỉ chứa một nền tảng nên không đủ cho cả thiết bị lẫn simulator.</p>
    <ul>
      <li>Khai báo <code>val xcf = XCFramework("Shared")</code>, với mỗi target iOS gọi <code>xcf.add(this)</code> trong <code>binaries.framework</code>.</li>
      <li>Task: <code>assembleSharedXCFramework</code> (hoặc <code>assembleSharedReleaseXCFramework</code>) → <code>shared/build/XCFrameworks/release/Shared.xcframework</code>.</li>
      <li>Nên đặt <code>binaryOption("bundleId", ...)</code> để framework có CFBundleIdentifier riêng.</li>
    </ul>

    <p><strong>Swift Package Manager</strong> (cách được khuyến nghị cho iOS hiện đại)</p>
    <ol>
      <li>Zip XCFramework, upload lên nơi tải được (GitHub Release, GitLab package registry, S3 nội bộ).</li>
      <li>Tính checksum: <code>swift package compute-checksum Shared.xcframework.zip</code>.</li>
      <li>Trong repo package, <code>Package.swift</code> khai báo <code>.binaryTarget(name:, url:, checksum:)</code>. Tag phiên bản (vd <code>1.4.0</code>).</li>
      <li>App iOS thêm package theo URL git + phiên bản, như mọi thư viện Swift.</li>
    </ol>
    <p><strong>KMMBridge</strong> (Touchlab) là plugin Gradle tự động hoá chuỗi trên: build XCFramework, upload, sinh/sửa <code>Package.swift</code> hoặc podspec, gắn phiên bản.</p>

    <p><strong>CocoaPods</strong>: plugin <code>kotlin("native.cocoapods")</code> sinh podspec. Vẫn gặp trong project cũ (nhiều app RN dùng Pods), nhưng CocoaPods đã chuyển sang chế độ bảo trì — project mới nên chọn SPM.</p>

    <table>
      <tr><th></th><th>Direct integration</th><th>XCFramework + SPM</th><th>CocoaPods</th></tr>
      <tr><td>Dev iOS cần Gradle/JDK</td><td>Có</td><td>Không</td><td>Có (pod local) / Không (pod binary)</td></tr>
      <tr><td>Sửa Kotlin thấy ngay trong Xcode</td><td>Có</td><td>Không, phải phát hành bản mới</td><td>Có với pod local</td></tr>
      <tr><td>Hợp với</td><td>Monorepo, đội full-stack mobile</td><td>Repo tách, đội iOS riêng</td><td>App cũ đã dùng Pods</td></tr>
    </table>

    <div class="callout"><p>💡 Giống việc publish một thư viện Java lên Nexus/Artifactory rồi service khác khai báo phiên bản trong pom: XCFramework + SPM là "Maven artifact" của thế giới iOS.
    Chỉ export <em>một</em> framework cho app: nếu có nhiều module KMP, gom chúng vào một module "umbrella" rồi xuất framework từ đó — hai framework Kotlin riêng sẽ mang hai bản runtime và không chia sẻ kiểu với nhau.</p></div>
  `,

  codeTabs: [
    { id: "xcf", label: "Khai báo XCFramework", lines: [
      "import org.jetbrains.kotlin.gradle.plugin.mpp.apple.XCFramework",
      "",
      "kotlin {",
      "    val xcf = XCFramework(\"Shared\")",
      "    listOf(iosArm64(), iosSimulatorArm64()).forEach {",
      "        it.binaries.framework {",
      "            baseName = \"Shared\"",
      "            binaryOption(\"bundleId\", \"vn.shop.shared\")",
      "            isStatic = true",
      "            xcf.add(this)",
      "        }",
      "    }",
      "}"
    ]},
    { id: "build", label: "Build & đóng gói", lines: [
      "./gradlew :shared:assembleSharedReleaseXCFramework",
      "# → shared/build/XCFrameworks/release/Shared.xcframework/",
      "#      ios-arm64/Shared.framework",
      "#      ios-arm64-simulator/Shared.framework   (tên thư mục tuỳ biến thể)",
      "#      Info.plist",
      "",
      "cd shared/build/XCFrameworks/release",
      "zip -r Shared.xcframework.zip Shared.xcframework",
      "swift package compute-checksum Shared.xcframework.zip",
      "# → 3a5c...e91f   (SHA-256)"
    ]},
    { id: "spm", label: "Package.swift", lines: [
      "// swift-tools-version:5.9",
      "import PackageDescription",
      "",
      "let package = Package(",
      "    name: \"Shared\",",
      "    platforms: [.iOS(.v15)],",
      "    products: [.library(name: \"Shared\", targets: [\"Shared\"])],",
      "    targets: [",
      "        .binaryTarget(",
      "            name: \"Shared\",",
      "            url: \"https://git.shop.vn/mobile/shared/releases/1.4.0/Shared.xcframework.zip\",",
      "            checksum: \"3a5c...e91f\"",
      "        )",
      "    ]",
      ")"
    ]},
    { id: "ci", label: "Pipeline phát hành", lines: [
      "# CI trên runner macOS (cần Xcode)",
      "./gradlew :shared:allTests",
      "./gradlew :shared:assembleSharedReleaseXCFramework",
      "zip + upload lên registry nội bộ",
      "cập nhật url + checksum trong Package.swift, commit, tag 1.4.0",
      "",
      "# Phía app iOS: File → Add Package Dependencies… → URL repo, rule 'Up to Next Major'",
      "# Android: publish .aar lên Maven nội bộ (maven-publish), app khai báo version"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="d"><div class="nl">📱 iosArm64</div><div class="ns">thiết bị</div></div>
      <div class="node" id="s"><div class="nl">💻 iosSimulatorArm64</div><div class="ns">simulator</div></div>
    </div>
    <div class="arrow" id="a1">↓ assembleSharedReleaseXCFramework</div>
    <div class="node" id="x"><div class="nl">📦 Shared.xcframework</div><div class="ns">gộp các biến thể</div></div>
    <div class="arrow" id="a2">↓ zip · checksum · upload</div>
    <div class="node" id="p"><div class="nl">📜 Package.swift (binaryTarget)</div><div class="ns">tag 1.4.0</div></div>
    <div class="arrow" id="a3">↓ Add Package Dependency</div>
    <div class="node" id="app"><div class="nl">🍎 App iOS</div><div class="ns">không cần Gradle/JDK</div></div>
  `,
  steps: [
    { title: "1 · Gom target vào XCFramework", tab: "xcf", highlight: [1, 4, 5, 8, 10], on: ["d", "s"],
      desc: "Mỗi target sinh một framework, xcf.add gom chúng lại. bundleId cho framework định danh riêng." },
    { title: "2 · Build bản release", tab: "build", highlight: [1, 2, 3, 4], on: ["a1", "x"],
      desc: "Một thư mục .xcframework chứa biến thể cho thiết bị và simulator; Xcode tự chọn." },
    { title: "3 · Zip và checksum", tab: "build", highlight: [8, 9, 10], on: ["a2"],
      desc: "SPM kiểm tra SHA-256 của file tải về — đổi file mà không đổi checksum là SPM từ chối." },
    { title: "4 · Package.swift", tab: "spm", highlight: [7, 9, 10, 11, 12], on: ["p"],
      desc: "binaryTarget trỏ tới zip đã upload. Tag git là phiên bản package." },
    { title: "5 · Tự động hoá trong CI", tab: "ci", highlight: [1, 2, 3, 5, 7], on: ["a3", "app"],
      desc: "Runner macOS build + test + phát hành. App iOS nâng phiên bản như nâng một thư viện bình thường. KMMBridge làm sẵn các bước này." }
  ],

  quiz: [
    { q: "Vì sao cần XCFramework thay vì một .framework?", options: [
        "Nhỏ hơn",
        "Để gộp nhiều biến thể (thiết bị, simulator...) vào một gói, Xcode tự chọn đúng",
        "Để chạy trên Android",
        "Vì SPM không nhận framework"
      ], correct: 1, explanation: "Một .framework thường chỉ cho một nền tảng/kiến trúc." },
    { q: "Task Gradle tạo XCFramework release tên Shared là?", options: [
        "linkReleaseFrameworkIosArm64", "assembleSharedReleaseXCFramework", "bundleRelease", "podPublish"
      ], correct: 1, explanation: "assembleSharedXCFramework build cả debug và release." },
    { q: "Trong Package.swift, XCFramework dạng binary khai báo bằng?", options: [
        ".target", ".binaryTarget(name:url:checksum:)", ".executableTarget", ".plugin"
      ], correct: 1, explanation: "URL trỏ tới file zip, checksum là SHA-256." },
    { q: "Lệnh tính checksum cho binaryTarget?", options: [
        "shasum -a 1", "swift package compute-checksum file.zip", "md5", "xcodebuild -checksum"
      ], correct: 1, explanation: "Trả về SHA-256 mà SPM dùng để kiểm tra." },
    { q: "Ưu điểm chính của phát hành qua SPM so với direct integration?", options: [
        "Sửa Kotlin thấy ngay trong Xcode",
        "Dev/CI iOS không cần cài Gradle/JDK; dùng như thư viện Swift có phiên bản",
        "Không cần macOS để build",
        "Không cần checksum"
      ], correct: 1, explanation: "Đổi lại mỗi thay đổi Kotlin phải phát hành bản mới." },
    { q: "KMMBridge là gì?", options: [
        "Bridge runtime giữa Swift và Kotlin",
        "Plugin Gradle của Touchlab tự động build, upload XCFramework và cập nhật Package.swift/podspec",
        "Một IDE",
        "Thư viện network"
      ], correct: 1, explanation: "Tên có \"bridge\" nhưng không phải runtime bridge." },
    { q: "Có nhiều module KMP (auth, cart, orders) thì nên xuất framework thế nào?", options: [
        "Mỗi module một framework",
        "Gom vào một module umbrella và xuất một framework duy nhất",
        "Không xuất",
        "Xuất bằng CocoaPods mới được"
      ], correct: 1, explanation: "Nhiều framework Kotlin = nhiều runtime, kiểu không dùng chung được." },
    { q: "Project iOS mới nên chọn CocoaPods hay SPM?", options: [
        "CocoaPods", "SPM — CocoaPods đã vào chế độ bảo trì", "Carthage", "Không cần"
      ], correct: 1, explanation: "CocoaPods vẫn dùng được cho project cũ." },
    { q: "Build XCFramework trong CI cần runner gì?", options: [
        "Linux", "macOS có Xcode", "Windows", "Bất kỳ"
      ], correct: 1, explanation: "Bước link Apple cần toolchain của Xcode." }
  ]
});
