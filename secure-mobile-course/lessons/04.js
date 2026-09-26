window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Dữ liệu trên thiết bị",
  title: "Lưu trữ dữ liệu nhạy cảm",
  subtitle: "SharedPreferences/UserDefaults/AsyncStorage là plaintext · Keystore/Keychain · thư viện secure storage cho từng nền tảng",

  theory: `
    <p>Gần như app nào cũng cần lưu gì đó trên máy: token đăng nhập, cài đặt, giỏ hàng, bản nháp tin nhắn. Lỗi phổ biến nhất của mobile
    (luôn đứng đầu các báo cáo kiểm thử) là <strong>lưu dữ liệu nhạy cảm vào kho lưu trữ dạng văn bản thường</strong>.</p>

    <p><strong>1. Câu hỏi đầu tiên: có cần lưu không?</strong></p>
    <ul>
      <li>Dữ liệu tốt nhất là dữ liệu <strong>không lưu</strong>. Mật khẩu người dùng: <em>không bao giờ</em> lưu — lưu token thay thế.</li>
      <li>Số thẻ đầy đủ, CVV, ảnh CCCD: thường không cần lưu trên máy; giữ ở server, app chỉ hiển thị 4 số cuối.</li>
      <li>Nếu chỉ cần trong phiên làm việc → giữ trong bộ nhớ (RAM), không ghi xuống đĩa.</li>
    </ul>

    <p><strong>2. Phân loại dữ liệu</strong></p>
    <table>
      <tr><th>Mức</th><th>Ví dụ</th><th>Lưu ở đâu</th></tr>
      <tr><td>Công khai / không nhạy cảm</td><td>theme sáng/tối, ngôn ngữ, đã xem onboarding chưa</td><td>SharedPreferences / UserDefaults / AsyncStorage — OK</td></tr>
      <tr><td>Nhạy cảm vừa</td><td>lịch sử tìm kiếm, giỏ hàng, hồ sơ cơ bản</td><td>DB/file trong vùng riêng; cân nhắc mã hoá (bài 07)</td></tr>
      <tr><td>Bí mật xác thực</td><td>refresh token, access token, khoá mã hoá, PIN hash</td><td><strong>Keychain (iOS) / Keystore (Android)</strong> hoặc thư viện dựa trên chúng</td></tr>
      <tr><td>Không nên lưu</td><td>mật khẩu, CVV, dữ liệu mà server có thể cung cấp lại</td><td>Không lưu</td></tr>
    </table>

    <p><strong>3. Vì sao SharedPreferences / UserDefaults / AsyncStorage không phù hợp cho bí mật?</strong></p>
    <ul>
      <li><strong>SharedPreferences</strong> (Android) = file XML plaintext trong <code>shared_prefs/</code>.</li>
      <li><strong>UserDefaults</strong> (iOS) = file .plist plaintext trong container.</li>
      <li><strong>AsyncStorage</strong> (React Native) = SQLite hoặc file JSON plaintext.</li>
      <li><strong>shared_preferences</strong> (Flutter) = dùng lại SharedPreferences/UserDefaults ở dưới.</li>
    </ul>
    <p>Chúng được sandbox bảo vệ trên máy bình thường, nhưng lộ ngay khi: máy bị root/jailbreak, có bản backup không mã hoá, người phân tích dùng
    công cụ debug, hoặc lỗi khác của app làm lộ file. Với token, thế là đủ để chiếm tài khoản.</p>

    <p><strong>4. Keychain và Keystore — kho bí mật của OS</strong></p>
    <ul>
      <li><strong>iOS Keychain</strong>: cơ sở dữ liệu mã hoá do OS quản lý, khoá mã hoá gắn với phần cứng (Secure Enclave) và mã mở khoá máy.
        Lưu được cả dữ liệu nhỏ (token, mật khẩu) lẫn khoá mật mã.</li>
      <li><strong>Android Keystore</strong>: lưu <em>khoá mật mã</em> (không phải dữ liệu tuỳ ý) — khoá không bao giờ rời khỏi phần cứng bảo mật (TEE/StrongBox).
        Để lưu token, ta sinh một khoá AES trong Keystore rồi dùng nó <em>mã hoá</em> token, lưu bản mã ở chỗ khác.</li>
      <li>Chi tiết khoá hardware-backed, accessibility class, gắn sinh trắc học: bài 05.</li>
    </ul>

    <p><strong>5. Thư viện theo nền tảng</strong></p>
    <table>
      <tr><th>Nền tảng</th><th>Lựa chọn phổ biến</th><th>Ghi chú</th></tr>
      <tr><td>Android native</td><td>Tự dùng Keystore + AES-GCM; hoặc thư viện EncryptedSharedPreferences (Jetpack Security)</td><td>Jetpack Security crypto đã bị ngừng phát triển — dự án mới nên tự bọc Keystore hoặc dùng thư viện đang được bảo trì; dù dùng gì, khoá phải nằm trong Keystore</td></tr>
      <tr><td>iOS native</td><td>Keychain Services (<code>SecItemAdd</code>…) hoặc wrapper nhỏ</td><td>Chọn đúng accessibility class</td></tr>
      <tr><td>React Native</td><td><code>react-native-keychain</code>, <code>expo-secure-store</code></td><td>Không dùng AsyncStorage cho token</td></tr>
      <tr><td>Flutter</td><td><code>flutter_secure_storage</code></td><td>Không dùng shared_preferences cho token</td></tr>
    </table>

    <p><strong>6. Lưu ý khi dùng secure storage</strong></p>
    <ul>
      <li>Secure storage phù hợp cho <strong>dữ liệu nhỏ</strong> (token, khoá). Dữ liệu lớn → mã hoá file/DB bằng khoá lấy từ secure storage.</li>
      <li>Keychain trên iOS <strong>có thể còn lại sau khi gỡ app</strong>. Lần cài đầu tiên nên dọn dữ liệu cũ (dùng một cờ "first run" trong UserDefaults).</li>
      <li>Xử lý lỗi: khoá có thể bị OS vô hiệu hoá (đổi mã khoá màn hình, thêm vân tay mới). App phải biết cách xoá và yêu cầu đăng nhập lại, không crash.</li>
      <li>Xoá sạch khi logout (bài 13).</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc ngón tay cái: <strong>nếu kẻ khác đọc được giá trị này mà làm được việc thay người dùng → nó thuộc Keychain/Keystore</strong>.
    Còn lại thì cân nhắc có cần lưu không, rồi mới chọn chỗ lưu.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Plaintext", lines: [
      "// Android (Kotlin)",
      "prefs.edit().putString(\"refresh_token\", token).apply()",
      "// -> /data/data/com.shop/shared_prefs/app.xml : <string name=\"refresh_token\">eyJ...</string>",
      "",
      "// iOS (Swift)",
      "UserDefaults.standard.set(token, forKey: \"refresh_token\")",
      "// -> Library/Preferences/com.shop.plist",
      "",
      "// React Native",
      "await AsyncStorage.setItem('refresh_token', token)",
      "",
      "// Flutter",
      "(await SharedPreferences.getInstance()).setString('refresh_token', token);"
    ]},
    { id: "ios", label: "🍎 iOS Keychain", lines: [
      "// Swift — lưu token vào Keychain",
      "let query: [String: Any] = [",
      "    kSecClass as String: kSecClassGenericPassword,",
      "    kSecAttrService as String: \"com.shop.auth\",",
      "    kSecAttrAccount as String: \"refresh_token\",",
      "    kSecValueData as String: Data(token.utf8),",
      "    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly",
      "]",
      "SecItemDelete(query as CFDictionary)            // xoá bản cũ nếu có",
      "let status = SecItemAdd(query as CFDictionary, nil)",
      "guard status == errSecSuccess else { throw StorageError.keychain(status) }"
    ]},
    { id: "android", label: "🤖 Android Keystore", lines: [
      "// Kotlin — sinh khoá AES trong Keystore (khoá không rời phần cứng)",
      "val spec = KeyGenParameterSpec.Builder(\"token_key\",",
      "        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)",
      "    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)",
      "    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)",
      "    .build()",
      "KeyGenerator.getInstance(\"AES\", \"AndroidKeyStore\").apply { init(spec) }.generateKey()",
      "",
      "// Mã hoá token bằng khoá đó, chỉ lưu BẢN MÃ + IV",
      "val cipher = Cipher.getInstance(\"AES/GCM/NoPadding\")",
      "cipher.init(Cipher.ENCRYPT_MODE, keyStore.getKey(\"token_key\", null))",
      "val encrypted = cipher.doFinal(token.toByteArray())",
      "prefs.edit().putString(\"rt\", b64(cipher.iv) + \":\" + b64(encrypted)).apply()"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// React Native — expo-secure-store (Keychain/Keystore bên dưới)",
      "await SecureStore.setItemAsync('refresh_token', token, {",
      "  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,",
      "})",
      "",
      "// React Native — react-native-keychain",
      "await Keychain.setGenericPassword('user', token, { service: 'auth' })",
      "",
      "// Flutter — flutter_secure_storage",
      "const storage = FlutterSecureStorage();",
      "await storage.write(key: 'refresh_token', value: token);",
      "",
      "// Chỉ dùng AsyncStorage / shared_preferences cho: theme, ngôn ngữ, cờ onboarding"
    ]},
    { id: "life", label: "🔁 Vòng đời", lines: [
      "// Lần đầu chạy sau khi cài lại: Keychain iOS có thể còn dữ liệu cũ",
      "if (!prefs.getBool('has_run_before')) {",
      "    secureStore.deleteAll()",
      "    prefs.setBool('has_run_before', true)",
      "}",
      "",
      "// Đọc token: khoá có thể đã bị OS vô hiệu hoá",
      "try { token = secureStore.read('refresh_token') }",
      "catch (KeyInvalidated) { secureStore.deleteAll(); goToLogin() }",
      "",
      "// Logout: xoá sạch",
      "secureStore.deleteAll(); db.wipe(); cache.clear()"
    ]}
  ],

  stageHtml: `
    <div class="node" id="data"><div class="nl">🧾 Dữ liệu cần lưu?</div><div class="ns">phân loại trước khi chọn chỗ lưu</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="none"><div class="nl">🚫 Không lưu</div><div class="ns">mật khẩu, CVV</div></div>
      <div class="node" id="prefs"><div class="nl">📄 Prefs/UserDefaults/AsyncStorage</div><div class="ns">plaintext — chỉ cài đặt UI</div></div>
      <div class="node" id="secure"><div class="nl">🔐 Keychain / Keystore</div><div class="ns">token, khoá, bí mật</div></div>
    </div>
    <div class="arrow" id="a2">↓ nếu máy bị root / backup bị lộ</div>
    <div class="row">
      <div class="node" id="leak"><div class="nl">💥 Plaintext bị đọc</div><div class="ns">chiếm tài khoản</div></div>
      <div class="node" id="safe"><div class="nl">🛡️ Khoá ở phần cứng</div><div class="ns">bản mã vô dụng khi rời máy</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Kho mặc định là plaintext", tab: "bad", highlight: [2, 3, 6, 7, 10, 13], on: ["prefs"],
      desc: "SharedPreferences, UserDefaults, AsyncStorage, shared_preferences đều ghi file văn bản thường. Tiện cho cài đặt UI, không phải cho bí mật." },
    { title: "2 · Plaintext lộ khi sandbox bị phá", tab: "bad", highlight: [3], on: ["a2", "leak"],
      desc: "Máy root, backup không mã hoá, công cụ debug — mở file XML là thấy refresh token. Có token là có tài khoản." },
    { title: "3 · iOS: Keychain", tab: "ios", highlight: [3, 6, 7, 10, 11], on: ["secure"],
      desc: "Keychain lưu dữ liệu nhỏ đã mã hoá bởi OS. Chọn accessibility class <code>WhenUnlockedThisDeviceOnly</code>: chỉ đọc khi máy mở khoá và không đi theo backup sang máy khác." },
    { title: "4 · Android: khoá trong Keystore", tab: "android", highlight: [2, 4, 7, 10, 11, 12, 13], on: ["secure", "safe"],
      desc: "Android Keystore giữ <em>khoá</em>, không giữ dữ liệu. Sinh khoá AES trong phần cứng, dùng nó mã hoá token, lưu bản mã + IV. Ai lấy được file cũng không giải mã được nếu không có khoá trên chính máy đó." },
    { title: "5 · Cross-platform: dùng thư viện đúng", tab: "xplat", highlight: [2, 3, 7, 10, 11, 13], on: ["secure"],
      desc: "expo-secure-store, react-native-keychain, flutter_secure_storage đều dựa trên Keychain/Keystore. AsyncStorage / shared_preferences chỉ cho dữ liệu không nhạy cảm." },
    { title: "6 · Quản lý vòng đời", tab: "life", highlight: [2, 3, 9, 12], on: ["data", "secure"],
      desc: "Dọn Keychain còn sót sau khi cài lại, xử lý khoá bị vô hiệu hoá bằng cách xoá và đăng nhập lại, xoá sạch khi logout." }
  ],

  quiz: [
    { q: "Refresh token nên lưu ở đâu trên iOS?", options: [
        "UserDefaults",
        "Keychain với accessibility class phù hợp",
        "File JSON trong Documents",
        "Biến static trong code"
      ], correct: 1,
      explanation: "Keychain là kho bí mật được OS mã hoá; UserDefaults là plist plaintext." },
    { q: "Android Keystore lưu trực tiếp cái gì?", options: [
        "Mọi loại dữ liệu tuỳ ý như chuỗi token",
        "Khoá mật mã — dùng khoá đó để mã hoá dữ liệu, bản mã lưu ở chỗ khác",
        "Ảnh và video",
        "Mật khẩu Wi-Fi"
      ], correct: 1,
      explanation: "Keystore giữ khoá trong phần cứng bảo mật; dữ liệu được mã hoá bằng khoá đó rồi lưu ở file/prefs." },
    { q: "App React Native lưu access token bằng AsyncStorage. Nhận xét?", options: [
        "An toàn vì AsyncStorage mã hoá sẵn",
        "Không phù hợp — AsyncStorage là plaintext; nên dùng expo-secure-store hoặc react-native-keychain",
        "An toàn trên iOS, không an toàn trên Android",
        "An toàn nếu đặt key có tên khó đoán"
      ], correct: 1,
      explanation: "AsyncStorage không mã hoá. Token là bí mật xác thực, phải dùng kho dựa trên Keychain/Keystore." },
    { q: "Có nên lưu mật khẩu người dùng trên máy (kể cả trong Keychain) để tự đăng nhập lại?", options: [
        "Có, Keychain an toàn tuyệt đối",
        "Không — nên lưu refresh token thay thế; token thu hồi được và không lộ mật khẩu dùng chung ở nơi khác",
        "Có, nếu mã hoá base64",
        "Có, trên Android"
      ], correct: 1,
      explanation: "Mật khẩu thường được dùng lại ở nhiều dịch vụ; token có phạm vi hẹp, có hạn và thu hồi được." },
    { q: "Trên iOS, dữ liệu Keychain có thể còn lại sau khi gỡ và cài lại app. Nên làm gì?", options: [
        "Không cần làm gì",
        "Dùng cờ 'first run' (UserDefaults bị xoá khi gỡ app) để phát hiện cài mới và xoá dữ liệu Keychain cũ",
        "Đổi tên app",
        "Yêu cầu người dùng reset máy"
      ], correct: 1,
      explanation: "UserDefaults bị xoá khi gỡ app còn Keychain thì có thể không — dùng chênh lệch này để dọn dẹp." },
    { q: "Theme sáng/tối và ngôn ngữ giao diện nên lưu ở đâu?", options: [
        "Keychain/Keystore",
        "SharedPreferences / UserDefaults / AsyncStorage là đủ",
        "Server bắt buộc",
        "Không được lưu"
      ], correct: 1,
      explanation: "Dữ liệu không nhạy cảm không cần secure storage; dùng đúng công cụ cho đúng mức dữ liệu." },
    { q: "Người dùng thêm vân tay mới, khoá trong Keystore bị OS vô hiệu hoá. App nên xử lý thế nào?", options: [
        "Crash để người dùng biết",
        "Bắt lỗi, xoá dữ liệu phụ thuộc khoá đó và yêu cầu đăng nhập lại",
        "Bỏ qua lỗi và dùng token rỗng",
        "Chuyển sang lưu plaintext"
      ], correct: 1,
      explanation: "Khoá bị vô hiệu hoá là tình huống bình thường; phải có đường khôi phục an toàn." },
    { q: "Dữ liệu lớn (cả DB tin nhắn) cần bảo vệ. Cách làm hợp lý?", options: [
        "Nhét toàn bộ DB vào Keychain",
        "Mã hoá DB/file bằng một khoá, và cất khoá đó trong Keychain/Keystore",
        "Không cần bảo vệ DB",
        "Nén DB là đủ"
      ], correct: 1,
      explanation: "Secure storage dành cho dữ liệu nhỏ. Dữ liệu lớn dùng mô hình 'khoá trong kho bảo mật, dữ liệu mã hoá bên ngoài' (bài 07)." },
    { q: "Flutter: thư viện nào phù hợp để lưu token?", options: [
        "shared_preferences",
        "flutter_secure_storage",
        "path_provider + file .txt",
        "sqflite không mã hoá"
      ], correct: 1,
      explanation: "flutter_secure_storage dùng Keychain (iOS) và Keystore (Android) bên dưới." }
  ]
});
