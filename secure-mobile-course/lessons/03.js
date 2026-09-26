window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Nền tảng",
  title: "Sandbox, quyền hệ điều hành & thiết bị root/jailbreak",
  subtitle: "Mỗi app một 'phòng riêng' · quyền runtime · khi người dùng phá tường sandbox thì sao",

  theory: `
    <p>Hệ điều hành mobile được thiết kế với giả định "app có thể độc hại". Vì vậy mỗi app bị nhốt trong một <strong>sandbox</strong>
    và phải <strong>xin quyền</strong> mới được chạm vào tài nguyên nhạy cảm. Hiểu sandbox giúp bạn biết cái gì OS đã bảo vệ hộ,
    và cái gì bạn phải tự lo.</p>

    <p><strong>1. Sandbox là gì?</strong></p>
    <ul>
      <li><strong>Android</strong>: mỗi app chạy dưới một <em>Linux user ID riêng</em>. Thư mục dữ liệu riêng <code>/data/data/&lt;package&gt;/</code>
        (hay <code>/data/user/0/...</code>) chỉ user đó đọc/ghi được. SELinux bổ sung thêm chính sách chặn truy cập.</li>
      <li><strong>iOS</strong>: mỗi app có <em>container</em> riêng (Documents, Library, tmp). Kernel sandbox profile giới hạn những gì app được gọi.
        App không liệt kê được app khác, không đọc được container của app khác.</li>
      <li>Kết quả: trên máy <strong>chưa bị phá</strong>, app khác <em>không</em> đọc thẳng được file trong vùng riêng của bạn.</li>
    </ul>

    <p><strong>2. Sandbox KHÔNG bảo vệ những gì?</strong></p>
    <table>
      <tr><th>Lỗ hổng vẫn còn</th><th>Vì sao</th><th>Bài</th></tr>
      <tr><td>Dữ liệu ghi ra vùng chung (external storage, thư viện ảnh, thư mục Downloads)</td><td>Vùng chung được nhiều app truy cập</td><td>07</td></tr>
      <tr><td>Component bạn tự "mở cửa" (exported activity, content provider, URL scheme)</td><td>Bạn cho phép app khác gọi vào</td><td>14, 15</td></tr>
      <tr><td>Clipboard, thông báo, ảnh chụp app switcher</td><td>Là kênh chia sẻ của hệ thống</td><td>06</td></tr>
      <tr><td>Bản sao lưu (backup) lên cloud / máy tính</td><td>Dữ liệu rời khỏi thiết bị</td><td>06, 21</td></tr>
      <tr><td>Thiết bị đã root/jailbreak</td><td>Người dùng (hoặc malware) có quyền cao hơn sandbox</td><td>bài này</td></tr>
      <tr><td>Kẻ có máy trong tay + mã mở khoá</td><td>Họ chính là "người dùng"</td><td>05, 12, 13</td></tr>
    </table>

    <p><strong>3. Quyền (permissions)</strong></p>
    <ul>
      <li>Quyền <em>bình thường</em> (Internet, rung…) được cấp tự động. Quyền <em>nguy hiểm</em> (vị trí, camera, danh bạ, micro, ảnh…) phải hỏi người dùng lúc chạy.</li>
      <li>iOS bắt buộc khai báo lý do trong <code>Info.plist</code> (<code>NSCameraUsageDescription</code>, <code>NSLocationWhenInUseUsageDescription</code>…); thiếu là crash khi xin quyền.</li>
      <li>Android khai báo trong <code>AndroidManifest.xml</code> bằng <code>&lt;uses-permission&gt;</code>, rồi gọi API xin quyền runtime.</li>
      <li>Nguyên tắc <strong>least privilege</strong>: chỉ xin quyền thật sự cần, xin <em>đúng lúc</em> dùng (không xin hết lúc mở app), chọn mức hẹp nhất
        (vị trí gần đúng thay vì chính xác, "chỉ khi dùng app" thay vì "luôn luôn", Photo Picker thay vì quyền đọc toàn bộ thư viện ảnh).</li>
      <li>Luôn xử lý trường hợp người dùng <strong>từ chối</strong>: app vẫn chạy được phần không cần quyền đó.</li>
    </ul>

    <p><strong>4. Root (Android) và jailbreak (iOS)</strong></p>
    <p>Root/jailbreak là khi người dùng tự phá giới hạn của OS để có quyền cao nhất. Trên máy đó:</p>
    <ul>
      <li>Có thể đọc thư mục riêng của mọi app → file plaintext của bạn bị lộ.</li>
      <li>Có thể gắn công cụ "hook" để thay đổi hàm của app lúc chạy (ví dụ ép hàm kiểm tra luôn trả <code>true</code>).</li>
      <li>Có thể tắt kiểm tra chứng chỉ TLS để đọc traffic của app.</li>
      <li>Malware trên máy root nguy hiểm hơn nhiều vì không còn bị sandbox chặn.</li>
    </ul>
    <p>Nhưng lưu ý: nhiều người root máy vì lý do chính đáng (tuỳ biến, máy cũ không còn cập nhật). Và <strong>kẻ tấn công kiểm soát máy có thể giấu dấu hiệu root</strong>.</p>

    <p><strong>5. Vậy ứng xử thế nào?</strong></p>
    <ol>
      <li><strong>Thiết kế để vẫn an toàn khi thiết bị bị phá</strong>: dữ liệu nhạy cảm mã hoá bằng khoá trong phần cứng (bài 05), token ngắn hạn, server kiểm tra mọi thứ.</li>
      <li><strong>Phát hiện root/jailbreak là tín hiệu rủi ro</strong>, không phải cổng chặn tuyệt đối. Dùng để: cảnh báo người dùng, yêu cầu xác thực thêm,
        giới hạn giao dịch lớn, gửi tín hiệu về server chấm điểm rủi ro.</li>
      <li><strong>Dựa vào attestation phía server</strong> (Play Integrity, App Attest — bài 10) đáng tin hơn tự kiểm tra trong app.</li>
    </ol>

    <div class="callout"><p>💡 Sandbox là <strong>lớp bảo vệ của OS cho bạn</strong>; đừng tự đục lỗ nó (ghi ra vùng chung, export component bừa bãi).
    Và đừng coi sandbox là lớp duy nhất — thiết kế sao cho kể cả khi sandbox bị phá, thiệt hại vẫn nhỏ.</p></div>
  `,

  codeTabs: [
    { id: "sandbox", label: "📁 Vùng riêng vs vùng chung", lines: [
      "// ANDROID (Kotlin)",
      "val priv = File(context.filesDir, \"profile.json\")        // vùng riêng của app",
      "val shared = File(Environment.getExternalStoragePublicDirectory(",
      "    Environment.DIRECTORY_DOWNLOADS), \"profile.json\")     // vùng chung — tránh",
      "",
      "// iOS (Swift)",
      "let appSupport = FileManager.default.urls(for: .applicationSupportDirectory,",
      "                                          in: .userDomainMask)[0]  // container riêng",
      "",
      "// Flutter",
      "final dir = await getApplicationSupportDirectory();       // riêng",
      "",
      "// React Native (react-native-fs)",
      "const path = RNFS.DocumentDirectoryPath + '/profile.json' // riêng"
    ]},
    { id: "perm", label: "🔐 Xin quyền tối thiểu", lines: [
      "<!-- AndroidManifest.xml: chỉ khai báo quyền thật sự dùng -->",
      "<uses-permission android:name=\"android.permission.ACCESS_COARSE_LOCATION\" />",
      "<!-- KHÔNG: ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION nếu không cần -->",
      "",
      "// Kotlin: xin đúng lúc người dùng bấm 'Tìm cửa hàng gần tôi'",
      "val launcher = registerForActivityResult(RequestPermission()) { granted ->",
      "    if (granted) showNearbyStores() else showManualCityPicker()   // có đường lui",
      "}",
      "",
      "// iOS Info.plist — lý do rõ ràng, trung thực",
      "NSLocationWhenInUseUsageDescription = 'Tìm cửa hàng gần bạn'",
      "// Swift: requestWhenInUseAuthorization() thay vì requestAlwaysAuthorization()"
    ]},
    { id: "root", label: "⚠️ Root = tín hiệu rủi ro", lines: [
      "// Pseudo-code: KHÔNG chặn cứng, mà điều chỉnh mức rủi ro",
      "signals = {",
      "    deviceCompromised: localRootCheck(),         // dễ bị giấu, chỉ tham khảo",
      "    attestation: await getIntegrityToken(nonce)  // server xác minh (bài 10)",
      "}",
      "api.post('/session/risk', signals)",
      "",
      "// Server quyết định",
      "risk = evaluate(verifyAttestation(signals.attestation), signals)",
      "if risk == HIGH:",
      "    requireStepUpAuth()          // bắt nhập OTP / mật khẩu lại",
      "    limitTransferAmount(1_000_000)",
      "// Người dùng root hợp pháp vẫn dùng được tính năng cơ bản"
    ]},
    { id: "design", label: "✅ An toàn kể cả khi bị root", lines: [
      "# Giả định: kẻ tấn công đọc được mọi file trong sandbox",
      "",
      "Token:     access token sống 5-15 phút; refresh token bọc bằng khoá Keystore/Keychain",
      "Dữ liệu:   mã hoá bằng khoá hardware-backed, không phải khoá viết cứng",
      "Quyết định: số dư, hạn mức, quyền -> server kiểm tra",
      "Phiên:     server có thể thu hồi phiên của thiết bị bất kỳ lúc nào",
      "",
      "=> Root chỉ lộ ra dữ liệu của CHÍNH người dùng đó, trong thời gian ngắn",
      "=> Không lộ dữ liệu người khác, không vượt được kiểm tra của server"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="appA"><div class="nl">📱 App của bạn</div><div class="ns">UID/container riêng</div></div>
      <div class="node" id="appB"><div class="nl">👾 App khác</div><div class="ns">UID/container riêng</div></div>
    </div>
    <div class="arrow" id="wall">⛔ sandbox: không đọc được vùng riêng của nhau</div>
    <div class="row">
      <div class="node" id="shared"><div class="nl">🗂️ Vùng chung</div><div class="ns">Downloads, ảnh, clipboard</div></div>
      <div class="node" id="perm"><div class="nl">🔐 Quyền OS</div><div class="ns">vị trí, camera, danh bạ…</div></div>
    </div>
    <div class="arrow" id="a2">↓ nếu máy bị root/jailbreak</div>
    <div class="node" id="rooted"><div class="nl">💥 Tường sandbox bị phá</div><div class="ns">đọc mọi file, hook hàm, tắt kiểm tra TLS</div></div>
    <div class="arrow" id="a3">↓ phòng thủ theo chiều sâu</div>
    <div class="node" id="defense"><div class="nl">🛡️ Khoá phần cứng + token ngắn + server quyết định</div><div class="ns">thiệt hại vẫn nhỏ</div></div>
  `,

  steps: [
    { title: "1 · Mỗi app một phòng riêng", tab: "sandbox", highlight: [2, 7, 8, 11, 14], on: ["appA", "appB", "wall"],
      desc: "Dữ liệu ghi vào thư mục riêng (<code>filesDir</code>, Application Support…) được OS bảo vệ: app khác trên máy bình thường không đọc được." },
    { title: "2 · Đừng tự đục lỗ sandbox", tab: "sandbox", highlight: [3, 4], on: ["shared"],
      desc: "Ghi file vào Downloads hay thư viện ảnh là đưa dữ liệu ra vùng chung. Chỉ làm vậy khi người dùng chủ động muốn xuất file." },
    { title: "3 · Quyền tối thiểu, đúng lúc", tab: "perm", highlight: [2, 3, 6, 7], on: ["perm"],
      desc: "Chỉ khai báo quyền cần dùng, chọn mức hẹp nhất (vị trí gần đúng), xin ngay trước khi dùng và luôn có đường lui khi người dùng từ chối." },
    { title: "4 · Lý do rõ ràng trên iOS", tab: "perm", highlight: [11, 12], on: ["perm"],
      desc: "iOS bắt buộc chuỗi lý do. Viết trung thực, cụ thể; dùng quyền 'khi đang dùng app' thay vì 'luôn luôn' nếu đủ." },
    { title: "5 · Root phá tường sandbox", tab: "root", highlight: [3, 4, 6], on: ["a2", "rooted"],
      desc: "Trên máy root/jailbreak mọi file đều đọc được, hàm có thể bị hook. Kiểm tra root trong app dễ bị giấu — hãy gửi tín hiệu (kèm attestation) về server." },
    { title: "6 · Server điều chỉnh mức rủi ro", tab: "root", highlight: [9, 10, 11, 12, 13], on: ["rooted", "a3"],
      desc: "Thay vì chặn cứng, server yêu cầu xác thực thêm hoặc giới hạn giao dịch khi rủi ro cao. Người dùng root hợp pháp vẫn dùng được tính năng cơ bản." },
    { title: "7 · Thiết kế chịu được root", tab: "design", highlight: [3, 4, 5, 6, 8, 9], on: ["defense"],
      desc: "Giả định file trong sandbox có thể bị đọc. Khoá phần cứng, token ngắn hạn, server kiểm tra và có thể thu hồi phiên giữ cho thiệt hại nhỏ." }
  ],

  quiz: [
    { q: "Trên Android chưa root, app B có đọc trực tiếp được file trong filesDir của app A không?", options: [
        "Có, mọi app đều đọc được",
        "Không, mỗi app chạy dưới Linux UID riêng và thư mục riêng được OS bảo vệ",
        "Có, nếu app B xin quyền Internet",
        "Chỉ khi app A đang chạy"
      ], correct: 1,
      explanation: "Sandbox dựa trên UID riêng + SELinux. App khác chỉ tương tác được qua kênh bạn chủ động mở (IPC)." },
    { q: "Ghi file hồ sơ người dùng vào thư mục Downloads có vấn đề gì?", options: [
        "Không vấn đề gì",
        "Đây là vùng chung, app khác có quyền phù hợp hoặc người dùng khác có thể đọc",
        "File sẽ bị xoá ngay",
        "Chỉ vấn đề trên iOS"
      ], correct: 1,
      explanation: "Vùng chung nằm ngoài sandbox. Dữ liệu nhạy cảm nên ở vùng riêng của app." },
    { q: "Tính năng 'tìm cửa hàng gần tôi' nên xin quyền vị trí thế nào?", options: [
        "Xin vị trí chính xác + nền (background) ngay khi mở app",
        "Xin vị trí gần đúng, chỉ khi đang dùng app, ngay lúc người dùng bấm tính năng; có đường lui nếu bị từ chối",
        "Không xin, tự đoán qua IP",
        "Xin mọi quyền một lần cho tiện"
      ], correct: 1,
      explanation: "Least privilege: mức hẹp nhất, thời điểm hợp lý, xử lý khi bị từ chối." },
    { q: "Trên thiết bị đã root/jailbreak, điều gì KHÔNG còn được đảm bảo?", options: [
        "App vẫn không bị đọc file riêng",
        "Sandbox: file riêng của app có thể bị đọc và hàm có thể bị hook lúc chạy",
        "Server vẫn không bị ảnh hưởng gì dù tin client",
        "Keystore không còn tồn tại"
      ], correct: 1,
      explanation: "Root/jailbreak cho quyền cao hơn sandbox. Đó là lý do cần thiết kế chịu được tình huống này." },
    { q: "Cách ứng xử hợp lý khi phát hiện thiết bị có dấu hiệu root?", options: [
        "Crash app ngay lập tức",
        "Coi là tín hiệu rủi ro: gửi về server, yêu cầu xác thực thêm hoặc giới hạn giao dịch nhạy cảm",
        "Bỏ qua hoàn toàn",
        "Xoá toàn bộ dữ liệu trên máy"
      ], correct: 1,
      explanation: "Kiểm tra root có thể bị giấu, và nhiều người root hợp pháp. Dùng như một tín hiệu trong chấm điểm rủi ro." },
    { q: "Vì sao không nên chỉ dựa vào kiểm tra root chạy trong app?", options: [
        "Vì kiểm tra này quá chậm",
        "Vì người kiểm soát thiết bị có thể hook/giấu kết quả kiểm tra",
        "Vì Apple cấm",
        "Vì nó cần Internet"
      ], correct: 1,
      explanation: "Mọi kiểm tra chạy trên thiết bị đều có thể bị vô hiệu hoá. Attestation được server xác minh đáng tin hơn." },
    { q: "iOS yêu cầu gì khi app xin quyền camera?", options: [
        "Không yêu cầu gì",
        "Khai báo chuỗi lý do NSCameraUsageDescription trong Info.plist",
        "Phải trả phí cho Apple",
        "Chỉ app của Apple mới được dùng camera"
      ], correct: 1,
      explanation: "Thiếu chuỗi lý do thì app bị crash khi truy cập camera, và bị review từ chối." },
    { q: "Thiết kế nào giúp thiệt hại nhỏ kể cả khi file trong sandbox bị đọc?", options: [
        "Lưu token dài hạn dạng plaintext",
        "Access token ngắn hạn, khoá hardware-backed, server quyết định và có thể thu hồi phiên",
        "Đặt tên file khó đoán",
        "Lưu token trong thư mục cache"
      ], correct: 1,
      explanation: "Phòng thủ theo chiều sâu: không dựa vào một lớp duy nhất là sandbox." },
    { q: "Thứ nào sau đây sandbox KHÔNG tự bảo vệ cho bạn?", options: [
        "File trong thư mục riêng của app",
        "Activity/Content provider bạn khai báo exported cho app khác gọi",
        "Bộ nhớ process của app trên máy bình thường",
        "Container riêng trên iOS"
      ], correct: 1,
      explanation: "Component exported là cửa bạn tự mở; phải tự kiểm tra ai gọi và dữ liệu truyền vào (bài 15)." }
  ]
});
