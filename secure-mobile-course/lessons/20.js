window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Code & gói phát hành",
  title: "Thư viện & SDK bên thứ ba",
  subtitle: "SDK chạy với toàn quyền của app · quyền thừa · SDK thu thập PII · chuỗi cung ứng (npm, pub, Gradle, CocoaPods, SPM)",

  theory: `
    <p>Một app mobile điển hình có hàng chục đến hàng trăm dependency: SDK analytics, quảng cáo, crash report, thanh toán, chat, bản đồ, UI kit,
    và với React Native/Flutter là hàng trăm package npm/pub. Mọi dòng code đó <strong>chạy trong cùng tiến trình, cùng sandbox, cùng quyền</strong> với app của bạn.
    Với người dùng và với cơ quan quản lý, hành vi của SDK <strong>là hành vi của app bạn</strong>.</p>

    <p><strong>1. SDK thấy được gì?</strong></p>
    <ul>
      <li>Mọi quyền app đã được cấp (vị trí, danh bạ, ảnh, micro…) — SDK có thể dùng mà không hỏi lại.</li>
      <li>File trong sandbox, SharedPreferences/UserDefaults (nếu biết đường dẫn/key), clipboard, danh sách thông tin thiết bị.</li>
      <li>Có thể hook vào vòng đời Activity/ViewController, chặn request mạng (qua interceptor dùng chung), đọc màn hình (một số SDK "session replay" ghi lại thao tác).</li>
    </ul>

    <p><strong>2. Các rủi ro chính</strong></p>
    <table>
      <tr><th>Rủi ro</th><th>Ví dụ</th></tr>
      <tr><td>Quyền thừa</td><td>Thêm SDK quảng cáo → manifest merge tự thêm quyền vị trí, đọc trạng thái điện thoại; app bị store hỏi lý do</td></tr>
      <tr><td>Thu thập PII quá mức</td><td>SDK analytics tự động ghi mọi màn hình, mọi ô nhập, gửi email/số điện thoại lên server bên thứ ba</td></tr>
      <tr><td>Session replay ghi dữ liệu nhạy cảm</td><td>Ghi lại màn hình nhập mật khẩu, số thẻ nếu không che (mask)</td></tr>
      <tr><td>Lỗ hổng trong thư viện</td><td>Phiên bản cũ của thư viện parse ảnh/zip/XML có lỗi đã công bố</td></tr>
      <tr><td>Chuỗi cung ứng bị chiếm</td><td>Tài khoản maintainer bị chiếm, phát hành bản có mã độc; package typo-squat tên gần giống</td></tr>
      <tr><td>Component exported do SDK thêm</td><td>Activity/Receiver exported của SDK mở cửa IPC mà bạn không biết (bài 15)</td></tr>
      <tr><td>Tuân thủ</td><td>SDK không khai báo đúng dữ liệu thu thập → Data Safety / Privacy manifest của bạn sai (bài 22)</td></tr>
    </table>

    <p><strong>3. Trước khi thêm một dependency — checklist đánh giá</strong></p>
    <ol>
      <li><strong>Có thật sự cần không?</strong> Vài dòng code tự viết đôi khi an toàn hơn một package kéo theo 50 dependency con.</li>
      <li><strong>Ai duy trì?</strong> Tổ chức uy tín, lịch sử phát hành, phản hồi issue bảo mật, số người dùng, lần cập nhật gần nhất.</li>
      <li><strong>Nó thu thập gì, gửi đi đâu?</strong> Đọc tài liệu quyền riêng tư của SDK, privacy manifest (iOS), phần khai báo Data Safety do nhà cung cấp hướng dẫn.</li>
      <li><strong>Nó thêm quyền/component gì?</strong> So sánh merged manifest và Info.plist trước/sau khi thêm.</li>
      <li><strong>Có lỗ hổng đã biết không?</strong> Tra cứu CVE/advisory.</li>
      <li><strong>Có tắt được tính năng thừa không?</strong> Ví dụ tắt thu thập tự động, tắt thu IDFA/Advertising ID, bật che dữ liệu.</li>
    </ol>

    <p><strong>4. Cấu hình SDK theo nguyên tắc tối thiểu</strong></p>
    <ul>
      <li>Tắt tự động thu thập (auto-collection) những gì không cần; chỉ gửi event bạn định nghĩa.</li>
      <li>Session replay: che toàn bộ ô nhập và vùng nhạy cảm; tắt trên màn hình thanh toán/đăng nhập.</li>
      <li>Chỉ khởi tạo SDK quảng cáo/analytics <strong>sau khi người dùng đồng ý</strong> (consent) nếu luật yêu cầu (GDPR, ATT — bài 22).</li>
      <li>Xoá quyền do SDK thêm mà bạn không dùng: <code>tools:node="remove"</code> trong manifest.</li>
      <li>Không đưa token, email, số điện thoại vào user properties của SDK; dùng ID nội bộ ẩn danh.</li>
    </ul>

    <p><strong>5. Chuỗi cung ứng: khoá phiên bản & kiểm tra</strong></p>
    <ul>
      <li><strong>Lockfile</strong> luôn được commit: <code>package-lock.json</code>/<code>yarn.lock</code>, <code>pubspec.lock</code>, <code>Podfile.lock</code>, <code>Package.resolved</code>, Gradle dependency locking.</li>
      <li>CI cài đặt theo lockfile (<code>npm ci</code>, <code>yarn install --immutable</code>, <code>flutter pub get --enforce-lockfile</code>).</li>
      <li>Gradle: bật <strong>dependency verification</strong> (checksum/chữ ký trong <code>verification-metadata.xml</code>). Chỉ khai báo repository cần thiết, tránh repository không tin cậy.</li>
      <li>Quét lỗ hổng tự động: Dependabot/Renovate, <code>npm audit</code>, OWASP Dependency-Check, OSV-Scanner; cập nhật định kỳ, không để thư viện quá cũ.</li>
      <li>Cẩn thận với script cài đặt (postinstall) của npm; cân nhắc tắt khi không cần.</li>
      <li>Tạo <strong>SBOM</strong> (danh sách thành phần phần mềm) cho mỗi bản phát hành để biết nhanh mình có bị ảnh hưởng khi một lỗ hổng mới được công bố.</li>
    </ul>

    <div class="callout"><p>💡 Coi mỗi SDK như <strong>một nhân viên mới được cấp toàn quyền vào app của bạn</strong>: bạn cần biết họ là ai, họ làm gì với dữ liệu,
    giới hạn những gì họ được đụng tới, và theo dõi khi họ thay đổi.</p></div>
  `,

  codeTabs: [
    { id: "manifest", label: "🤖 Kiểm soát quyền của SDK", lines: [
      "<!-- AndroidManifest.xml của app: gỡ quyền do SDK kéo vào mà app không dùng -->",
      "<manifest xmlns:tools=\"http://schemas.android.com/tools\">",
      "  <uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\"",
      "                   tools:node=\"remove\" />",
      "  <uses-permission android:name=\"android.permission.READ_PHONE_STATE\"",
      "                   tools:node=\"remove\" />",
      "  <uses-permission android:name=\"com.google.android.gms.permission.AD_ID\"",
      "                   tools:node=\"remove\" />   <!-- nếu không dùng quảng cáo -->",
      "</manifest>",
      "",
      "# Xem manifest cuối cùng sau khi gộp",
      "# app/build/intermediates/merged_manifests/release/AndroidManifest.xml"
    ]},
    { id: "config", label: "⚙️ Cấu hình tối thiểu", lines: [
      "// Pseudo-code áp dụng cho SDK analytics / crash / replay bất kỳ",
      "Analytics.init({",
      "  autoCollectScreens: false,",
      "  autoCollectInputs:  false,",
      "  collectAdvertisingId: false,",
      "  userId: anonymousInternalId,         // KHÔNG email / số điện thoại",
      "})",
      "",
      "SessionReplay.init({ maskAllInputs: true, maskAllText: true })",
      "SessionReplay.excludeScreens(['Login', 'Payment', 'CardDetails'])",
      "",
      "// Chỉ khởi tạo SDK quảng cáo sau khi có consent",
      "if (consent.ads == 'granted') Ads.init()"
    ]},
    { id: "lock", label: "🔒 Khoá phiên bản", lines: [
      "# CI cài theo lockfile, không tự nâng phiên bản",
      "npm ci                                   # React Native (npm)",
      "yarn install --immutable                 # React Native (yarn berry)",
      "flutter pub get --enforce-lockfile       # Flutter",
      "pod install --deployment                 # iOS CocoaPods: lỗi nếu Podfile.lock lệch",
      "",
      "# Gradle: bật khoá phiên bản + xác minh checksum",
      "./gradlew dependencies --write-locks",
      "./gradlew --write-verification-metadata sha256 help",
      "# -> gradle/verification-metadata.xml, commit vào repo"
    ]},
    { id: "scan", label: "🔍 Quét & theo dõi", lines: [
      "# Quét lỗ hổng dependency trong CI",
      "npm audit --audit-level=high",
      "osv-scanner --lockfile=package-lock.json --lockfile=pubspec.lock",
      "dependency-check --project shop-android --scan app/build",
      "",
      "# Tạo SBOM cho mỗi bản phát hành",
      "cyclonedx-npm --output-file sbom-js.json",
      "",
      "# So sánh quyền trước/sau khi thêm SDK",
      "diff old/merged_manifest.xml new/merged_manifest.xml | grep -E 'permission|exported'"
    ]},
    { id: "review", label: "📋 Checklist thêm SDK", lines: [
      "[ ] Có thật sự cần? Có phương án nhẹ hơn / tự viết?",
      "[ ] Maintainer uy tín, cập nhật gần đây, có kênh báo lỗi bảo mật",
      "[ ] Dữ liệu thu thập & nơi gửi: đã đọc privacy doc / privacy manifest",
      "[ ] Quyền & component mới trong merged manifest / Info.plist",
      "[ ] Không có CVE mức cao chưa vá",
      "[ ] Đã tắt auto-collection, bật masking, gắn với consent",
      "[ ] Đã cập nhật Data Safety / Privacy Nutrition Label (bài 22)",
      "[ ] Đã thêm vào SBOM, Dependabot/Renovate theo dõi"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="npm"><div class="nl">📦 npm / pub</div><div class="ns">RN, Flutter</div></div>
      <div class="node" id="maven"><div class="nl">📦 Maven / Gradle</div><div class="ns">Android</div></div>
      <div class="node" id="pods"><div class="nl">📦 CocoaPods / SPM</div><div class="ns">iOS</div></div>
    </div>
    <div class="arrow" id="a1">↓ lockfile · verification · quét CVE</div>
    <div class="node" id="app"><div class="nl">📱 App của bạn</div><div class="ns">SDK chạy cùng tiến trình, cùng quyền</div></div>
    <div class="arrow" id="a2">↓ SDK có thể</div>
    <div class="row">
      <div class="node" id="perm"><div class="nl">🔐 Thêm quyền / component</div><div class="ns">qua manifest merge</div></div>
      <div class="node" id="pii"><div class="nl">📤 Thu thập PII</div><div class="ns">auto-collect, replay</div></div>
    </div>
    <div class="arrow" id="a3">↓ kiểm soát</div>
    <div class="node" id="control"><div class="nl">🛡️ Gỡ quyền thừa · tắt auto-collect · masking · consent · SBOM</div><div class="ns">hành vi SDK = hành vi app của bạn</div></div>
  `,

  steps: [
    { title: "1 · SDK = code chạy với toàn quyền", tab: "review", highlight: [1, 2, 3], on: ["app", "a2"],
      desc: "SDK dùng được mọi quyền app có và đọc được sandbox. Trước khi thêm, hỏi: có cần không, ai duy trì, thu thập gì." },
    { title: "2 · Quyền thừa từ manifest merge", tab: "manifest", highlight: [3, 4, 5, 6, 7, 8, 12], on: ["perm"],
      desc: "SDK tự khai báo quyền; manifest merge gộp vào app. Kiểm tra merged manifest và gỡ quyền không dùng bằng <code>tools:node=\"remove\"</code>." },
    { title: "3 · Cấu hình thu thập tối thiểu", tab: "config", highlight: [3, 4, 5, 6, 9, 10, 13], on: ["pii", "a3", "control"],
      desc: "Tắt tự động thu thập, dùng ID ẩn danh, che mọi ô nhập trong session replay, loại màn hình nhạy cảm, khởi tạo SDK quảng cáo sau consent." },
    { title: "4 · Khoá phiên bản", tab: "lock", highlight: [2, 3, 4, 5, 8, 9], on: ["npm", "maven", "pods", "a1"],
      desc: "Commit lockfile, CI cài theo lockfile, Gradle xác minh checksum. Bản phát hành chỉ chứa đúng những gì đã được review." },
    { title: "5 · Quét & SBOM", tab: "scan", highlight: [2, 3, 4, 7, 10], on: ["a1", "control"],
      desc: "Quét CVE tự động, sinh SBOM mỗi bản phát hành, so sánh quyền/component trước và sau khi thêm SDK." },
    { title: "6 · Checklist đầy đủ", tab: "review", highlight: [4, 5, 6, 7, 8], on: ["control"],
      desc: "Mỗi SDK mới đi qua checklist: quyền, CVE, cấu hình tối thiểu, khai báo quyền riêng tư, theo dõi cập nhật." }
  ],

  quiz: [
    { q: "SDK analytics trong app có quyền truy cập những gì?", options: [
        "Chỉ những gì SDK tự xin riêng",
        "Mọi quyền app đã được cấp và dữ liệu trong sandbox, vì chạy cùng tiến trình",
        "Không gì cả",
        "Chỉ Internet"
      ], correct: 1,
      explanation: "Không có sandbox riêng cho SDK trong cùng app." },
    { q: "Sau khi thêm SDK quảng cáo, app tự có thêm quyền vị trí. Nguyên nhân và cách xử lý?", options: [
        "Lỗi Android, bỏ qua",
        "Manifest merge gộp quyền của SDK; kiểm tra merged manifest và gỡ quyền không dùng bằng tools:node=\"remove\"",
        "Người dùng tự bật",
        "Không thể gỡ"
      ], correct: 1,
      explanation: "Luôn review manifest cuối cùng của bản release." },
    { q: "Session replay SDK ghi lại màn hình nhập số thẻ. Cần làm gì?", options: [
        "Không cần làm gì",
        "Bật che (mask) mọi ô nhập, loại màn hình thanh toán/đăng nhập khỏi replay",
        "Tăng chất lượng video",
        "Gửi replay qua HTTP"
      ], correct: 1,
      explanation: "Dữ liệu nhạy cảm không được rời app sang bên thứ ba." },
    { q: "Vì sao phải commit lockfile và cài bằng npm ci / --enforce-lockfile?", options: [
        "Để cài nhanh hơn",
        "Để bản build dùng đúng phiên bản đã review, không tự kéo phiên bản mới có thể bị chiếm",
        "Để giảm dung lượng",
        "Store yêu cầu"
      ], correct: 1,
      explanation: "Lockfile là một phần của kiểm soát chuỗi cung ứng." },
    { q: "Gradle dependency verification làm gì?", options: [
        "Tăng tốc build",
        "Kiểm tra checksum/chữ ký của artifact tải về khớp với metadata đã commit",
        "Obfuscate code",
        "Ký app"
      ], correct: 1,
      explanation: "Artifact bị thay đổi sẽ làm build thất bại." },
    { q: "Nên gửi gì làm userId cho SDK analytics?", options: [
        "Email người dùng",
        "Số điện thoại",
        "ID nội bộ ẩn danh",
        "Access token"
      ], correct: 2,
      explanation: "Không gửi PII hay bí mật sang bên thứ ba khi không cần." },
    { q: "SBOM giúp gì?", options: [
        "Tăng tốc app",
        "Biết chính xác bản phát hành chứa thành phần/phiên bản nào để phản ứng nhanh khi có lỗ hổng mới",
        "Mã hoá dependency",
        "Thay thế lockfile"
      ], correct: 1,
      explanation: "Không biết mình dùng gì thì không biết mình có bị ảnh hưởng không." },
    { q: "SDK quảng cáo nên khởi tạo khi nào ở nơi có luật yêu cầu consent?", options: [
        "Ngay khi mở app",
        "Sau khi người dùng đồng ý",
        "Không bao giờ",
        "Khi app vào nền"
      ], correct: 1,
      explanation: "Khởi tạo trước consent có thể đã thu thập dữ liệu trái phép." },
    { q: "Package npm có tên gần giống package phổ biến (typo-squat). Rủi ro?", options: [
        "Không rủi ro",
        "Có thể chứa mã độc chạy khi cài hoặc trong app",
        "Chỉ làm build chậm",
        "Chỉ ảnh hưởng iOS"
      ], correct: 1,
      explanation: "Kiểm tra kỹ tên, maintainer, lượt tải trước khi thêm dependency." }
  ]
});
