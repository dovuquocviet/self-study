window.LESSONS.push({
  id: "12",
  phase: "2", phaseName: "Công cụ: Xcode & SPM",
  title: "Xcode project & Swift Package Manager (so với Gradle/Maven)",
  subtitle: "Target · scheme · build configuration · Info.plist · signing · Package.swift · module",

  theory: `
    <p>Trong Java, <code>pom.xml</code>/<code>build.gradle</code> là một file text mô tả mọi thứ. Thế giới Apple có hai hệ song song:</p>
    <ul>
      <li><strong>Xcode project</strong> (<code>MyApp.xcodeproj</code>, bên trong là <code>project.pbxproj</code> — file dạng plist khó đọc, sinh bởi Xcode). Bắt buộc cho <strong>app</strong> (cần bundle, icon, signing, entitlements).</li>
      <li><strong>Swift Package Manager (SPM)</strong> — <code>Package.swift</code> viết bằng Swift. Dùng cho thư viện, module nội bộ, và cả server-side Swift. Xcode mở được package trực tiếp.</li>
    </ul>
    <p>Mô hình phổ biến hiện nay: app project <strong>mỏng</strong> (chỉ entry point + tài nguyên), còn code chia thành các module trong một local package (<code>Packages/Features</code>) — giống multi-module Gradle.</p>

    <p><strong>Từ vựng Xcode ↔ Gradle</strong></p>
    <table>
      <tr><th>Xcode</th><th>Ý nghĩa</th><th>Gần với</th></tr>
      <tr><td>Target</td><td>Một sản phẩm build: app, extension (widget), framework, test bundle</td><td>Gradle module / Maven artifact</td></tr>
      <tr><td>Scheme</td><td>Chọn target nào build/run/test/archive với configuration nào</td><td>Run configuration + task</td></tr>
      <tr><td>Build configuration</td><td>Debug / Release (tự thêm Staging…)</td><td>Build type / profile</td></tr>
      <tr><td>Build settings, <code>.xcconfig</code></td><td>Cờ compiler, bundle id, version… theo configuration</td><td><code>gradle.properties</code>, buildConfigField</td></tr>
      <tr><td>Info.plist</td><td>Metadata app: tên hiển thị, quyền (camera, location usage description), URL scheme</td><td>AndroidManifest.xml</td></tr>
      <tr><td>Entitlements</td><td>Năng lực đặc biệt: push, Keychain sharing, App Groups, Sign in with Apple</td><td>—</td></tr>
      <tr><td>Signing &amp; provisioning profile</td><td>Chứng chỉ + profile cho phép app chạy trên máy/lên store</td><td>keystore Android</td></tr>
      <tr><td><code>Package.resolved</code></td><td>Khoá phiên bản dependency đã phân giải</td><td>lockfile</td></tr>
    </table>

    <p><strong>Module và access control</strong>: mỗi target/package target là một <strong>module</strong>. Mức truy cập: <code>private</code> (trong khối/extension cùng file), <code>fileprivate</code>, <code>internal</code> (<strong>mặc định</strong> — trong cùng module), <code>package</code> (trong cùng package, Swift 5.9), <code>public</code>, <code>open</code> (public + cho phép subclass/override ngoài module). Khác Java: mặc định là internal chứ không phải package-private, và <code>public</code> class không tự cho kế thừa ngoài module.</p>

    <p><strong>Swift 6 language mode</strong> được bật theo target (<code>swiftLanguageModes</code> trong Package.swift, hoặc Build Setting "Swift Language Version"). Có thể chuyển dần từng module từ 5 lên 6 — giống nâng Java version từng module.</p>

    <p><strong>Dòng lệnh</strong>: <code>swift build</code>, <code>swift test</code> cho package; <code>xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' test</code> cho project (dùng trên CI); <code>xcrun simctl</code> điều khiển simulator.</p>

    <div class="callout"><p>💡 So với React Native: <code>ios/</code> trong RN chính là một Xcode project, CocoaPods (<code>Podfile</code>) là trình quản lý dependency cũ hơn SPM. App native thuần mới nên dùng SPM.</p></div>
  `,

  codeTabs: [
    { id: "pkg", label: "Package.swift", lines: [
      "// swift-tools-version: 6.0",
      "import PackageDescription",
      "",
      "let package = Package(",
      "    name: \"ShopKit\",",
      "    platforms: [.iOS(.v17)],",
      "    products: [",
      "        .library(name: \"ShopKit\", targets: [\"Networking\", \"CartFeature\"])",
      "    ],",
      "    dependencies: [",
      "        .package(url: \"https://github.com/apple/swift-collections\", from: \"1.1.0\")",
      "    ],",
      "    targets: [",
      "        .target(name: \"Networking\"),",
      "        .target(name: \"CartFeature\", dependencies: [",
      "            \"Networking\",",
      "            .product(name: \"Collections\", package: \"swift-collections\")",
      "        ]),",
      "        .testTarget(name: \"CartFeatureTests\", dependencies: [\"CartFeature\"])",
      "    ]",
      ")"
    ]},
    { id: "gradle", label: "build.gradle.kts tương đương", lines: [
      "plugins { `java-library` }",
      "",
      "dependencies {",
      "    implementation(project(\":networking\"))",
      "    implementation(\"org.apache.commons:commons-collections4:4.4\")",
      "    testImplementation(\"org.junit.jupiter:junit-jupiter:5.10.2\")",
      "}",
      "// settings.gradle.kts: include(\":networking\", \":cart-feature\")"
    ]},
    { id: "layout", label: "Cấu trúc thư mục", lines: [
      "ShopApp/",
      "  ShopApp.xcodeproj           # project app (target ShopApp, ShopWidget)",
      "  ShopApp/",
      "    ShopApp.swift             # @main App",
      "    Assets.xcassets           # icon, màu, ảnh",
      "    Info.plist",
      "    ShopApp.entitlements",
      "  Packages/ShopKit/",
      "    Package.swift",
      "    Sources/Networking/       # mỗi thư mục = 1 module",
      "    Sources/CartFeature/",
      "    Tests/CartFeatureTests/"
    ]},
    { id: "access", label: "Access control", lines: [
      "// module Networking",
      "public struct APIClient {",
      "    public init(baseURL: URL) { self.baseURL = baseURL }",
      "    let baseURL: URL                       // internal: module khác không thấy",
      "    public func get(_ path: String) async throws -> Data { try await send(path) }",
      "    private func send(_ path: String) async throws -> Data { Data() }",
      "}",
      "",
      "open class BaseScreen {}                  // module khác được kế thừa",
      "public class Analytics {}                // module khác KHÔNG được kế thừa"
    ]},
    { id: "cli", label: "Lệnh", lines: [
      "$ swift build                     # build package",
      "$ swift test --filter CartFeatureTests",
      "$ swift package update            # cập nhật, ghi Package.resolved",
      "",
      "$ xcodebuild -scheme ShopApp -configuration Release \\",
      "    -destination 'platform=iOS Simulator,name=iPhone 16' test",
      "$ xcrun simctl list devices       # liệt kê simulator"
    ]}
  ],

  stageHtml: `
    <div class="node" id="scheme"><div class="nl">Scheme ShopApp</div><div class="ns">Run: Debug · Archive: Release</div></div>
    <div class="arrow" id="a1">↓ build target</div>
    <div class="row">
      <div class="node" id="app"><div class="nl">Target ShopApp</div><div class="ns">Info.plist · entitlements · signing</div></div>
      <div class="node" id="widget"><div class="nl">Target ShopWidget</div><div class="ns">extension</div></div>
    </div>
    <div class="arrow" id="a2">↓ phụ thuộc</div>
    <div class="row">
      <div class="node" id="net"><div class="nl">module Networking</div><div class="ns">SPM target</div></div>
      <div class="node" id="cart"><div class="nl">module CartFeature</div><div class="ns">SPM target</div></div>
      <div class="node" id="ext"><div class="nl">swift-collections</div><div class="ns">remote package</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Package.swift là code Swift", tab: "pkg", highlight: [1, 4, 5, 6], on: ["net", "cart"],
      desc: "Dòng 1 là bắt buộc: phiên bản tools. <code>platforms</code> đặt phiên bản iOS tối thiểu." },
    { title: "2 · Targets = modules", tab: "pkg", highlight: [13, 14, 15, 16, 17, 19], on: ["net", "cart", "ext"],
      desc: "Mỗi target là một module với namespace và access control riêng. Dependency ngoài tham chiếu qua <code>.product</code>." },
    { title: "3 · So với Gradle", tab: "gradle", highlight: [4, 5, 6, 8], on: ["cart"],
      desc: "Cùng khái niệm module + dependency; SPM dùng Git tag + semver (<code>from:</code> = up to next major)." },
    { title: "4 · App project mỏng", tab: "layout", highlight: [2, 4, 6, 7, 8, 10], on: ["scheme", "a1", "app", "widget"],
      desc: "Project app giữ Info.plist, entitlements, assets, signing; logic nằm trong local package." },
    { title: "5 · internal là mặc định", tab: "access", highlight: [2, 3, 4, 6, 9, 10], on: ["a2", "net"],
      desc: "Quên <code>public</code> là module khác không thấy. <code>public init</code> phải viết tay vì memberwise init chỉ là internal." },
    { title: "6 · Dòng lệnh & CI", tab: "cli", highlight: [1, 2, 5, 6], on: ["scheme"],
      desc: "<code>swift test</code> cho package, <code>xcodebuild</code> cho project app trên CI." }
  ],

  quiz: [
    { q: "Mức access control mặc định của Swift là?", options: [
        "public", "private", "internal (trong cùng module)", "package-private như Java"
      ], correct: 2, explanation: "Khai báo không ghi gì là internal." },
    { q: "Khác biệt giữa public và open cho class?", options: [
        "Không khác",
        "open cho phép module khác kế thừa/override; public thì không",
        "public cho phép kế thừa, open thì không",
        "open là private"
      ], correct: 1, explanation: "Mặc định an toàn: kế thừa xuyên module phải được cho phép rõ ràng." },
    { q: "Scheme trong Xcode là gì?", options: [
        "Một module code",
        "Cấu hình chọn target nào build/run/test/archive và dùng build configuration nào",
        "Theme màu",
        "File Info.plist"
      ], correct: 1, explanation: "Gần với run configuration/task." },
    { q: "Tương đương AndroidManifest.xml ở iOS là?", options: [
        "Package.swift", "Info.plist", "project.pbxproj", "Podfile"
      ], correct: 1, explanation: "Chứa metadata app, usage description cho quyền, URL scheme…" },
    { q: "Dòng // swift-tools-version: 6.0 ở đầu Package.swift?", options: [
        "Là comment, xoá được",
        "Bắt buộc — khai báo phiên bản PackageDescription API/tools cần dùng",
        "Chọn phiên bản iOS",
        "Chọn phiên bản Xcode"
      ], correct: 1, explanation: "SPM đọc dòng này trước khi biên dịch manifest." },
    { q: ".package(url: ..., from: \"1.1.0\") chấp nhận phiên bản nào?", options: [
        "Đúng 1.1.0", "Từ 1.1.0 tới dưới 2.0.0", "Mọi phiên bản", "Chỉ bản mới nhất"
      ], correct: 1, explanation: "from: nghĩa là up to next major (semver)." },
    { q: "Một struct public trong module Networking có memberwise init. Module khác gọi được init đó không?", options: [
        "Được",
        "Không — memberwise init tự sinh là internal; phải viết public init",
        "Chỉ khi là class",
        "Chỉ trong test"
      ], correct: 1, explanation: "Lỗi rất hay gặp khi tách module." },
    { q: "Package.resolved đóng vai trò gì?", options: [
        "Mô tả target", "Khoá phiên bản dependency đã phân giải (lockfile)", "Cấu hình signing", "Log build"
      ], correct: 1, explanation: "Nên commit với app để build lặp lại được." },
    { q: "Push notification, App Groups, Keychain sharing được bật qua đâu?", options: [
        "Package.swift", "Entitlements (và capability trong Signing & Capabilities)", "Info.plist chỉ", "Code Swift"
      ], correct: 1, explanation: "Entitlements phải khớp với provisioning profile." }
  ]
});
