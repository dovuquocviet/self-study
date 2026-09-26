window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "Bên trong gói app: mọi thứ đều đọc được",
  subtitle: "APK/AAB · IPA · JS bundle · Dart snapshot — thứ gì đóng gói vào app thì coi như công khai",

  theory: `
    <p>Nhiều người nghĩ "app đã build ra file nhị phân thì không ai đọc được". Sai. File cài đặt app là một <strong>file nén</strong> có cấu trúc công khai,
    ai cũng tải được (từ store, từ máy đã cài, từ trang mirror) và mở ra được bằng công cụ miễn phí. Bài này giúp bạn hình dung
    <em>bên trong gói có gì</em> để thiết kế app đúng ngay từ đầu.</p>

    <p><strong>1. Gói Android: APK và AAB</strong></p>
    <ul>
      <li><strong>AAB</strong> (Android App Bundle) là file bạn upload lên Google Play; Play tách nó thành các <strong>APK</strong> phù hợp từng thiết bị.</li>
      <li>APK thực chất là file ZIP. Bên trong: <code>AndroidManifest.xml</code> (khai báo quyền, component, deep link), <code>classes.dex</code> (bytecode Kotlin/Java),
        <code>resources.arsc</code> + thư mục <code>res/</code> (chuỗi, layout, ảnh), <code>assets/</code> (file thô bạn tự bỏ vào), <code>lib/</code> (thư viện native .so).</li>
      <li>Bytecode DEX dịch ngược được thành code Java/Kotlin <em>gần giống bản gốc</em>. R8/ProGuard đổi tên biến thành a, b, c… nhưng logic và chuỗi hằng vẫn còn nguyên.</li>
    </ul>

    <p><strong>2. Gói iOS: IPA</strong></p>
    <ul>
      <li>IPA cũng là file ZIP chứa thư mục <code>.app</code>: file thực thi Mach-O (mã máy ARM), <code>Info.plist</code> (cấu hình, URL scheme), asset, file cấu hình bạn đóng gói kèm.</li>
      <li>Mã máy khó đọc hơn bytecode, nhưng công cụ disassembler/decompiler vẫn khôi phục được logic; <strong>chuỗi hằng</strong> (URL, key, thông báo lỗi) đọc được ngay bằng lệnh liệt kê chuỗi.</li>
      <li>App tải từ App Store được mã hoá FairPlay, nhưng trên thiết bị đã jailbreak có thể lấy bản đã giải mã từ bộ nhớ. Đừng coi đó là lớp bảo vệ.</li>
    </ul>

    <p><strong>3. Cross-platform: React Native và Flutter</strong></p>
    <table>
      <tr><th>Nền tảng</th><th>Code của bạn nằm ở đâu trong gói</th><th>Mức khó đọc</th></tr>
      <tr><td>React Native (JSC)</td><td>File <code>index.android.bundle</code> / <code>main.jsbundle</code> — JavaScript đã minify</td><td>Rất dễ: mở bằng trình soạn thảo, format lại là đọc được</td></tr>
      <tr><td>React Native (Hermes)</td><td>Hermes bytecode (.hbc) trong cùng file bundle</td><td>Dễ: có công cụ disassemble/decompile công khai</td></tr>
      <tr><td>Flutter (release)</td><td>Dart được biên dịch AOT thành <code>libapp.so</code> (Android) / <code>App.framework</code> (iOS)</td><td>Khó hơn, nhưng chuỗi hằng và tên hàm vẫn trích được</td></tr>
      <tr><td>Web-based (Cordova/Capacitor)</td><td>HTML/JS/CSS nguyên bản trong <code>assets/www</code></td><td>Như đọc website</td></tr>
    </table>

    <p><strong>4. Những thứ thường bị lộ khi mở gói</strong></p>
    <ul>
      <li>API key, client secret, token dịch vụ (bản đồ, thanh toán, chat, analytics…) viết cứng trong code hoặc file config.</li>
      <li>URL môi trường staging/nội bộ, endpoint admin "ẩn".</li>
      <li>File <code>.env</code>, <code>google-services.json</code>, <code>GoogleService-Info.plist</code> — một số giá trị trong đó là công khai theo thiết kế, số khác thì không.</li>
      <li>Logic kiểm tra license/premium, "mật khẩu debug", cờ tính năng ẩn.</li>
      <li>Source map (<code>.map</code>) vô tình đóng gói → khôi phục nguyên code JS có tên biến, comment.</li>
      <li>Khoá mã hoá cố định dùng để "mã hoá" dữ liệu cục bộ — có khoá là giải mã được mọi máy.</li>
    </ul>

    <p><strong>5. Hệ quả thiết kế (quan trọng nhất)</strong></p>
    <ol>
      <li><strong>Không có bí mật chung nào trong app.</strong> Bí mật dùng chung cho mọi người dùng (master key, secret API) phải ở server. App chỉ giữ bí mật <em>riêng của từng người dùng</em>, sinh ra lúc chạy (token sau đăng nhập, khoá trong Keystore/Keychain).</li>
      <li><strong>Server là nơi thực thi quy tắc.</strong> Logic trong app chỉ là "gợi ý" UI.</li>
      <li><strong>Obfuscation chỉ làm chậm.</strong> Không dựa vào nó để giữ bí mật (bài 17, 18).</li>
      <li><strong>Kiểm tra gói trước khi phát hành</strong>: tự mở gói release của chính mình, tìm chuỗi nhạy cảm, file thừa (bài 21).</li>
    </ol>

    <div class="callout"><p>💡 Bài kiểm tra đơn giản: <strong>"Nếu tôi dán toàn bộ nội dung gói app lên mạng, có ai lợi dụng được gì không?"</strong>
    Nếu có — thứ đó không nên nằm trong gói.</p></div>
  `,

  codeTabs: [
    { id: "tree", label: "📦 Cấu trúc gói", lines: [
      "# APK (Android) — thực chất là ZIP",
      "app-release.apk",
      "├── AndroidManifest.xml     # quyền, activity, deep link, exported",
      "├── classes.dex             # bytecode Kotlin/Java -> dịch ngược được",
      "├── res/ + resources.arsc   # strings.xml, layout",
      "├── assets/                 # file tự đóng gói: config.json, bundle RN",
      "└── lib/arm64-v8a/*.so      # native (Flutter: libapp.so)",
      "",
      "# IPA (iOS) — cũng là ZIP",
      "Payload/MyApp.app/",
      "├── MyApp                   # Mach-O: mã máy, vẫn trích được chuỗi",
      "├── Info.plist              # URL scheme, ATS, cấu hình",
      "├── main.jsbundle           # (React Native) JS hoặc Hermes bytecode",
      "└── Frameworks/App.framework # (Flutter) Dart AOT"
    ]},
    { id: "bad", label: "❌ Nhét bí mật vào app", lines: [
      "// Kotlin",
      "const val PAYMENT_SECRET = \"sk_live_<giá_trị_bí_mật>\"",
      "",
      "// Swift",
      "let adminBaseURL = \"https://internal-admin.example.com\"",
      "",
      "// React Native (.env được đóng gói vào bundle!)",
      "const API_SECRET = process.env.API_SECRET",
      "",
      "// Flutter",
      "const encryptionKey = 'my-fixed-aes-key-32-bytes-long!!';",
      "",
      "// Tất cả đều nằm trong gói -> ai tải app cũng lấy được"
    ]},
    { id: "good", label: "✅ Thiết kế đúng", lines: [
      "// 1. Secret dùng chung ở SERVER, app gọi qua backend của mình",
      "api.post('/payments/intent', { orderId })   // server dùng secret key",
      "",
      "// 2. Key công khai theo thiết kế (publishable key, maps key)",
      "//    -> giới hạn phía nhà cung cấp: theo package name/bundle id, quota",
      "",
      "// 3. Bí mật RIÊNG từng user, sinh lúc chạy, cất vào Keystore/Keychain",
      "token = await login(email, password)",
      "secureStore.save('refresh_token', token.refresh)",
      "",
      "// 4. Khoá mã hoá cục bộ: sinh ngẫu nhiên trên từng máy, không viết cứng",
      "key = keystore.generateKey(alias='local_db', hardwareBacked=true)"
    ]},
    { id: "audit", label: "🔍 Tự kiểm gói release", lines: [
      "# Chạy trong CI sau khi build release — tìm chuỗi đáng ngờ",
      "unzip -o app-release.apk -d out/apk",
      "grep -rEi 'secret|password|BEGIN PRIVATE|sk_live|internal' out/apk || echo ok",
      "",
      "# React Native: không được có source map trong gói",
      "find out/apk -name '*.map'",
      "",
      "# iOS: liệt kê chuỗi trong file thực thi",
      "strings Payload/MyApp.app/MyApp | grep -Ei 'secret|staging|debug'",
      "",
      "# Kết quả khác rỗng -> chặn phát hành, xem lại"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">👩‍💻 Source code + config</div><div class="ns">Kotlin/Swift/JS/Dart, .env, json</div></div>
    <div class="arrow" id="a1">↓ build</div>
    <div class="node" id="pkg"><div class="nl">📦 Gói APK/AAB/IPA</div><div class="ns">file ZIP có cấu trúc công khai</div></div>
    <div class="arrow" id="a2">↓ phát hành lên store</div>
    <div class="row">
      <div class="node" id="users"><div class="nl">👥 Hàng triệu người dùng</div><div class="ns">cài và dùng</div></div>
      <div class="node" id="analyst"><div class="nl">🔬 Người phân tích</div><div class="ns">giải nén, dịch ngược, trích chuỗi</div></div>
    </div>
    <div class="arrow" id="a3">↓ thiết kế đúng</div>
    <div class="node" id="server"><div class="nl">🖥️ Bí mật chung ở server</div><div class="ns">app chỉ giữ bí mật riêng từng user</div></div>
  `,

  steps: [
    { title: "1 · Gói app chỉ là file ZIP", tab: "tree", highlight: [2, 3, 4, 6, 10, 11], on: ["src", "a1", "pkg"],
      desc: "APK và IPA đều giải nén được. Manifest, Info.plist, asset, bundle JS nằm ngay trong đó; bytecode và mã máy thì dịch ngược được bằng công cụ miễn phí." },
    { title: "2 · Cross-platform cũng vậy", tab: "tree", highlight: [6, 7, 13, 14], on: ["pkg"],
      desc: "Bundle React Native là JS minify hoặc Hermes bytecode; Flutter là Dart AOT trong libapp.so. Khó đọc hơn không có nghĩa là không đọc được." },
    { title: "3 · Store phát tán cho mọi người", tab: "tree", highlight: [2, 10], on: ["a2", "users", "analyst"],
      desc: "Bất kỳ ai cũng tải được gói của bạn. Chỉ cần một người trích được bí mật rồi đăng lên mạng là coi như lộ vĩnh viễn — kể cả khi bạn ra bản mới." },
    { title: "4 · Những thứ không được nằm trong gói", tab: "bad", highlight: [2, 5, 8, 11, 13], on: ["analyst"],
      desc: "Secret key thanh toán, URL admin nội bộ, biến .env được bundle, khoá AES cố định — tất cả đều có thể trích ra trong vài phút." },
    { title: "5 · Chuyển bí mật về server", tab: "good", highlight: [2, 5, 8, 9, 12], on: ["a3", "server"],
      desc: "Bí mật chung ở server; key công khai thì giới hạn phía nhà cung cấp; bí mật riêng từng user sinh lúc chạy và cất vào Keystore/Keychain." },
    { title: "6 · Tự kiểm gói trước khi phát hành", tab: "audit", highlight: [2, 3, 6, 9, 11], on: ["pkg"],
      desc: "Đưa bước giải nén + tìm chuỗi đáng ngờ + tìm file .map vào CI. Phát hiện ở đây rẻ hơn rất nhiều so với sau khi đã lên store." }
  ],

  quiz: [
    { q: "File APK thực chất là gì?", options: [
        "File nhị phân mã hoá không thể mở",
        "File ZIP chứa manifest, bytecode DEX, tài nguyên, asset và thư viện native",
        "File cơ sở dữ liệu SQLite",
        "Ảnh đĩa hệ điều hành"
      ], correct: 1,
      explanation: "APK/IPA đều là ZIP có cấu trúc công khai. Ai có file đều giải nén được." },
    { q: "App React Native build với Hermes. Code JS của bạn có an toàn khỏi bị đọc không?", options: [
        "Có, Hermes mã hoá code",
        "Không — Hermes bytecode có công cụ disassemble/decompile công khai, chuỗi hằng vẫn đọc được",
        "Có, trên iOS",
        "Có, nếu bật minify"
      ], correct: 1,
      explanation: "Hermes nhằm tăng hiệu năng, không phải bảo mật. Coi mọi thứ trong bundle là công khai." },
    { q: "Biến trong file .env của React Native được đọc qua process.env lúc build. Nó nằm ở đâu trong app?", options: [
        "Chỉ trên máy developer",
        "Được nhúng thẳng vào bundle JS trong gói app",
        "Trên server của Apple/Google",
        "Trong Keychain/Keystore"
      ], correct: 1,
      explanation: "Công cụ build thay process.env.X bằng giá trị thật. .env không phải kho bí mật cho app client." },
    { q: "Nguyên tắc thiết kế đúng về bí mật trong app mobile là gì?", options: [
        "Obfuscate thật mạnh rồi nhúng secret",
        "Chia secret thành nhiều mảnh rồi ghép lúc chạy",
        "Bí mật dùng chung cho mọi user để ở server; app chỉ giữ bí mật riêng từng user sinh lúc chạy",
        "Lưu secret trong resources thay vì code"
      ], correct: 2,
      explanation: "Mọi cách giấu trong gói chỉ làm chậm. Bí mật chung phải ở server." },
    { q: "Flutter release biên dịch AOT thành mã máy. Điều nào đúng?", options: [
        "Không thể trích bất kỳ thông tin nào",
        "Khó đọc hơn JS nhưng chuỗi hằng và nhiều tên hàm vẫn trích được",
        "Mã hoá bằng khoá của Google",
        "Chỉ đọc được trên iOS"
      ], correct: 1,
      explanation: "Mã máy tăng chi phí phân tích, không loại bỏ khả năng phân tích." },
    { q: "Vì sao khoá AES viết cứng trong app để 'mã hoá dữ liệu cục bộ' là thiết kế yếu?", options: [
        "AES đã bị phá",
        "Khoá giống nhau trên mọi máy và nằm trong gói; ai trích được khoá sẽ giải mã dữ liệu của mọi người dùng",
        "AES chạy chậm trên mobile",
        "Không yếu, vẫn an toàn"
      ], correct: 1,
      explanation: "Khoá nên sinh ngẫu nhiên trên từng thiết bị và cất trong Keystore/Keychain (bài 05)." },
    { q: "Source map (.map) vô tình được đóng gói vào app gây rủi ro gì?", options: [
        "App chạy chậm",
        "Người phân tích khôi phục được code gốc có tên biến, cấu trúc file, thậm chí comment",
        "App bị từ chối trên store",
        "Không rủi ro"
      ], correct: 1,
      explanation: "Source map chỉ nên upload lên hệ thống crash reporting riêng, không nằm trong gói phát hành." },
    { q: "Bạn đã phát hiện secret bị lộ trong bản app cũ đang có trên store. Ra bản mới xoá secret có đủ không?", options: [
        "Đủ, bản cũ sẽ tự biến mất",
        "Không — bản cũ vẫn còn trên máy người dùng và các trang mirror; phải thu hồi/đổi secret phía server",
        "Đủ nếu bắt buộc cập nhật",
        "Đủ nếu gỡ app khỏi store"
      ], correct: 1,
      explanation: "Secret đã lộ coi như vĩnh viễn công khai. Cách xử lý đúng là rotate (vô hiệu hoá và cấp mới) ở phía server." },
    { q: "Bước nào nên đưa vào CI để phát hiện sớm bí mật trong gói?", options: [
        "Không cần, vì code đã review",
        "Giải nén gói release, tìm chuỗi đáng ngờ và file .map, chặn phát hành nếu có",
        "Chạy app trên emulator",
        "Tăng mức obfuscation"
      ], correct: 1,
      explanation: "Kiểm tra chính artefact sẽ phát hành bắt được cả những thứ build system tự thêm vào mà review code không thấy." }
  ]
});
