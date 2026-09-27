window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Hệ điều hành & vòng đời",
  title: "Kiến trúc OS mobile & sandbox — app của bạn thực ra là gì?",
  subtitle: "Linux kernel + ART vs XNU + Darwin · mỗi app một user/container · Zygote · entitlements",

  theory: `
    <p>Trên server Java, bạn chạy <code>java -jar app.jar</code>: một process, có quyền đọc gần như mọi file user đó đọc được, sống tới khi bạn kill.
    Trên điện thoại thì khác hẳn: <strong>OS là ông chủ</strong>, app chỉ là khách được cấp một phòng riêng, được đánh thức khi cần và bị đuổi đi khi hết chỗ.</p>

    <p><strong>Hai chồng phần mềm</strong></p>
    <table>
      <tr><th>Tầng</th><th>Android</th><th>iOS</th></tr>
      <tr><td>Kernel</td><td>Linux (có thêm Binder IPC, lowmemorykiller qua lmkd)</td><td>XNU (Mach + BSD) — nhân của Darwin, dùng chung với macOS</td></tr>
      <tr><td>Runtime ngôn ngữ</td><td><strong>ART</strong>: chạy bytecode DEX, JIT + AOT (dex2oat), có GC</td><td>Không có VM: Swift/ObjC biên dịch thẳng ra mã máy arm64, bộ nhớ quản lý bằng ARC</td></tr>
      <tr><td>Framework</td><td>Android Framework (Activity, Service, ContentProvider, BroadcastReceiver) viết Java/Kotlin</td><td>UIKit/SwiftUI, Foundation, Core Animation…</td></tr>
      <tr><td>Dịch vụ hệ thống</td><td><code>system_server</code> (ActivityManager, WindowManager, PackageManager…) — app nói chuyện qua <strong>Binder</strong></td><td><code>launchd</code>, SpringBoard, <code>backboardd</code>, render server… — nói chuyện qua Mach IPC/XPC</td></tr>
    </table>

    <p><strong>Sandbox: mỗi app một "phòng" riêng</strong></p>
    <ul>
      <li><strong>Android</strong>: mỗi app được gán một <em>Linux UID riêng</em> lúc cài (vd <code>u0_a142</code>). Thư mục <code>/data/data/&lt;package&gt;</code> chỉ UID đó đọc được — cơ chế quyền file bình thường của Linux, cộng SELinux. Muốn dùng camera, danh bạ… phải có permission (bài 17).</li>
      <li><strong>iOS</strong>: mỗi app có một <em>container</em> (Bundle chỉ-đọc + Data container), bị profile sandbox của kernel giới hạn. Khả năng đặc biệt (push, iCloud, App Groups, Keychain sharing) phải khai báo bằng <strong>entitlements</strong> được ký vào app — không có entitlement thì API trả lỗi dù code đúng.</li>
      <li>App không thể đọc dữ liệu app khác, không thể tự chạy nền tuỳ ý, không thể giữ CPU mãi. Muốn chia sẻ phải qua kênh OS cho phép: Intent/ContentProvider/FileProvider (Android), App Groups/Share Extension/URL scheme (iOS).</li>
    </ul>

    <p><strong>Process được sinh ra thế nào?</strong> Android có tiến trình <strong>Zygote</strong> đã nạp sẵn framework và các class phổ biến; mở app = <em>fork</em> Zygote, nhờ copy-on-write nên khởi động nhanh và chia sẻ RAM.
    iOS: <code>launchd</code> tạo process mới, dyld nạp binary và các framework (shared cache của hệ thống đã map sẵn).</p>

    <div class="callout"><p>💡 Tư duy đổi từ backend: server của bạn "sống mãi", còn app mobile <strong>có thể bị giết bất kỳ lúc nào ở background mà không có callback nào</strong>.
    Mọi thứ phía sau (lưu trạng thái, chạy nền, push) đều xoay quanh sự thật này.</p></div>
  `,

  codeTabs: [
    { id: "adb", label: "① Android: nhìn sandbox", lines: [
      "$ adb shell ps -A | grep com.shop.app",
      "u0_a142  12873  812 ...  com.shop.app          # UID riêng, PPID 812 = zygote64",
      "",
      "$ adb shell ps -A | grep zygote",
      "root       812    1 ...  zygote64",
      "",
      "$ adb shell run-as com.shop.app ls files/   # chỉ debug build mới run-as được",
      "session.pb  cache.db",
      "",
      "$ adb shell ls /data/data/com.other.app",
      "ls: /data/data/com.other.app: Permission denied"
    ]},
    { id: "ios", label: "② iOS: container", lines: [
      "// Đường dẫn thật trong sandbox (UUID đổi theo lần cài)",
      "let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]",
      "print(docs)",
      "// file:///var/mobile/Containers/Data/Application/6F1C.../Documents/",
      "",
      "let bundle = Bundle.main.bundleURL",
      "// file:///private/var/containers/Bundle/Application/9A2E.../Shop.app/  (chỉ đọc)",
      "",
      "// Đọc file ngoài container -> lỗi, sandbox chặn ở kernel",
      "try String(contentsOfFile: \"/var/mobile/Library/SMS/sms.db\")  // throws"
    ]},
    { id: "ent", label: "③ Entitlements & manifest", lines: [
      "<!-- iOS: Shop.entitlements (được ký vào app) -->",
      "<key>aps-environment</key><string>production</string>",
      "<key>com.apple.security.application-groups</key>",
      "<array><string>group.com.shop.app</string></array>",
      "",
      "<!-- Android: AndroidManifest.xml -->",
      "<manifest package=\"com.shop.app\">",
      "  <uses-permission android:name=\"android.permission.INTERNET\"/>",
      "  <uses-permission android:name=\"android.permission.CAMERA\"/>",
      "</manifest>"
    ]},
    { id: "java", label: "④ So với server Java", lines: [
      "// Server Spring Boot",
      "java -jar order-svc.jar      // process sống tới khi bạn kill",
      "new File(\"/etc/hosts\")        // đọc được nếu user OS có quyền",
      "",
      "// App mobile",
      "// - OS quyết định khi nào process được tạo / bị giết",
      "// - chỉ đọc/ghi trong sandbox của mình",
      "// - năng lực đặc biệt phải khai báo (permission / entitlement)",
      "// - giao tiếp với hệ thống qua IPC: Binder (Android), Mach/XPC (iOS)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">🧱 Kernel</div><div class="ns">Linux / XNU — cô lập process, quyền file, bộ nhớ</div></div>
    <div class="arrow" id="a1">↓ dịch vụ hệ thống</div>
    <div class="node" id="sys"><div class="nl">⚙️ system_server / launchd, SpringBoard</div><div class="ns">quản lý vòng đời, cửa sổ, package</div></div>
    <div class="arrow" id="a2">↓ fork Zygote / launchd spawn</div>
    <div class="row">
      <div class="node" id="app1"><div class="nl">📦 App A (UID/container riêng)</div><div class="ns">chỉ thấy sandbox của mình</div></div>
      <div class="node" id="app2"><div class="nl">📦 App B</div><div class="ns">không đọc được dữ liệu A</div></div>
    </div>
    <div class="arrow" id="a3">↓ khả năng đặc biệt</div>
    <div class="node" id="perm"><div class="nl">🔑 Permission / Entitlement</div><div class="ns">khai báo + người dùng cho phép</div></div>
  `,
  steps: [
    { title: "1 · Kernel cô lập process", tab: "adb", highlight: [1, 2], on: ["k"],
      desc: "Mỗi app Android chạy dưới một Linux UID riêng; kernel dùng quyền file + SELinux để cô lập." },
    { title: "2 · App sinh ra từ Zygote", tab: "adb", highlight: [4, 5], on: ["sys", "a2"],
      desc: "PPID của app là zygote64: app được fork từ process đã nạp sẵn framework, nhờ copy-on-write nên khởi động nhanh." },
    { title: "3 · Sandbox chặn truy cập chéo", tab: "adb", highlight: [7, 8, 10, 11], on: ["app1", "app2"],
      desc: "Trong thư mục của mình thì đọc được; thư mục app khác thì <em>Permission denied</em>." },
    { title: "4 · iOS: container theo UUID", tab: "ios", highlight: [2, 4, 7, 10], on: ["app1"],
      desc: "Bundle chỉ đọc, dữ liệu nằm trong Data container. Đọc file ngoài container bị sandbox chặn." },
    { title: "5 · Khai báo năng lực", tab: "ent", highlight: [2, 3, 4, 8, 9], on: ["a3", "perm"],
      desc: "Push, App Groups (iOS) cần entitlement được ký; Android khai báo permission trong manifest (quyền nguy hiểm còn phải xin lúc chạy)." },
    { title: "6 · Đổi tư duy từ server", tab: "java", highlight: [2, 6, 7], on: ["sys"],
      desc: "OS quyết định sống chết của process. Code mobile phải giả định mình có thể bị giết bất cứ lúc nào khi ở nền." }
  ],

  quiz: [
    { q: "Android cô lập dữ liệu giữa các app chủ yếu bằng cơ chế nào?", options: [
        "Mỗi app chạy trong một JVM riêng nên không thấy nhau",
        "Mỗi app được gán một Linux UID riêng + quyền file và SELinux",
        "Mã hoá toàn bộ ổ đĩa",
        "Google Play kiểm tra lúc cài"
      ], correct: 1, explanation: "Sandbox Android dựa trên UID riêng của Linux; ART chỉ là runtime, không phải ranh giới bảo mật." },
    { q: "Zygote trên Android dùng để làm gì?", options: [
        "Biên dịch Kotlin sang DEX",
        "Process đã nạp sẵn framework; app mới được fork từ nó để khởi động nhanh và chia sẻ bộ nhớ",
        "Quản lý push notification",
        "Chạy garbage collector cho mọi app"
      ], correct: 1, explanation: "Fork + copy-on-write giúp các trang bộ nhớ của framework được dùng chung giữa các app." },
    { q: "Code Swift trên iOS chạy thế nào?", options: [
        "Trên một VM giống JVM",
        "Thông dịch từng dòng",
        "Biên dịch ra mã máy arm64, không có VM, bộ nhớ quản lý bằng ARC",
        "Biên dịch sang bytecode DEX"
      ], correct: 2, explanation: "iOS không có runtime VM kiểu ART/JVM; Swift biên dịch AOT qua LLVM." },
    { q: "App iOS gọi API push notification nhưng lỗi dù code đúng. Nguyên nhân hay gặp nhất?", options: [
        "Thiếu entitlement aps-environment trong bản ký",
        "Thiếu quyền INTERNET",
        "Chưa bật JIT",
        "Chưa đăng nhập iCloud"
      ], correct: 0, explanation: "Năng lực đặc biệt trên iOS phải có entitlement được ký vào app (qua provisioning profile)." },
    { q: "App Android giao tiếp với ActivityManager/WindowManager qua cơ chế nào?", options: [
        "HTTP localhost", "Binder IPC tới system_server", "Gọi hàm trực tiếp cùng process", "Shared file"
      ], correct: 1, explanation: "Các dịch vụ hệ thống sống trong system_server; app gọi qua Binder." },
    { q: "Hai app muốn chia sẻ file trên iOS một cách hợp lệ thì dùng gì?", options: [
        "Ghi vào /tmp chung", "App Groups (container chung) hoặc Share Extension", "Đọc thẳng container của app kia", "Dùng root"
      ], correct: 1, explanation: "App Groups cấp một container chung cho các app/extension cùng team có entitlement tương ứng." },
    { q: "Khác biệt tư duy quan trọng nhất khi chuyển từ server Java sang app mobile?", options: [
        "Mobile không có thread",
        "OS có thể giết process của app ở background bất kỳ lúc nào, không báo trước",
        "Mobile không cần xử lý lỗi mạng",
        "Mobile không có bộ nhớ heap"
      ], correct: 1, explanation: "Mọi thiết kế lưu trạng thái, chạy nền đều xuất phát từ việc process không được đảm bảo sống." },
    { q: "Lệnh ls /data/data/com.other.app từ adb shell (user thường) trả về gì?", options: [
        "Danh sách file", "Permission denied", "File rỗng", "Tự tạo thư mục mới"
      ], correct: 1, explanation: "Thư mục dữ liệu chỉ UID của app đó truy cập được." },
    { q: "Thư mục Bundle (.app) của app iOS sau khi cài có đặc điểm gì?", options: [
        "Ghi được, dùng để lưu dữ liệu", "Chỉ đọc; dữ liệu ghi vào Data container (Documents, Library, tmp)", "Dùng chung cho mọi app", "Bị xoá sau mỗi lần mở app"
      ], correct: 1, explanation: "Bundle được ký, sửa là hỏng chữ ký; dữ liệu phải ghi vào Data container." }
  ]
});
