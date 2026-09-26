window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Xác thực trên mobile",
  title: "Sinh trắc học đúng cách",
  subtitle: "Đừng chỉ dựa vào callback true/false · gắn sinh trắc học với khoá mật mã (CryptoObject / Keychain access control) · xử lý thay đổi vân tay",

  theory: `
    <p>"Đăng nhập bằng vân tay/Face ID" là tính năng người dùng rất thích. Nhưng có hai cách làm, và cách dễ viết nhất lại là cách <strong>yếu</strong>.</p>

    <p><strong>1. Sinh trắc học thực ra làm gì?</strong></p>
    <ul>
      <li>OS so khớp vân tay/khuôn mặt <em>trong phần cứng bảo mật</em>; app không bao giờ nhận được dữ liệu sinh trắc học.</li>
      <li>OS chỉ báo cho app kết quả: thành công hay thất bại. Và — quan trọng — OS có thể <strong>mở khoá một khoá mật mã</strong> trong Keystore/Keychain khi thành công.</li>
      <li>Sinh trắc học xác nhận "một người đã đăng ký trên máy này đang cầm máy", <em>không</em> xác nhận danh tính với server. Nó là cách mở khoá bí mật cục bộ.</li>
    </ul>

    <p><strong>2. Cách yếu: "event-bound" — chỉ tin callback</strong></p>
    <p>App hiện hộp thoại vân tay; nếu callback <code>onAuthenticationSucceeded</code> / <code>evaluatePolicy</code> trả <code>true</code> thì app lấy token từ kho thường và cho vào.</p>
    <ul>
      <li>Trên máy bị root/jailbreak, công cụ hook có thể <strong>ép callback trả true</strong> mà không cần vân tay → vượt qua.</li>
      <li>Token nằm sẵn trong kho không gắn với sinh trắc học → đọc thẳng được, không cần qua hộp thoại.</li>
      <li>Nói cách khác: sinh trắc học chỉ là "cái cửa sơn lên tường", không khoá gì cả.</li>
    </ul>

    <p><strong>3. Cách đúng: "crypto-bound" — sinh trắc học mở khoá mật mã</strong></p>
    <ul>
      <li><strong>Android</strong>: tạo khoá trong Keystore với <code>setUserAuthenticationRequired(true)</code> (timeout 0, <code>AUTH_BIOMETRIC_STRONG</code>).
        Tạo <code>Cipher</code> từ khoá đó, bọc trong <code>BiometricPrompt.CryptoObject</code>, truyền vào <code>authenticate()</code>.
        Chỉ khi xác thực thật sự thành công, phần cứng mới cho phép <code>cipher</code> đó giải mã. Dùng cipher lấy từ <code>result.cryptoObject</code> để giải mã refresh token.</li>
      <li><strong>iOS</strong>: lưu refresh token vào Keychain với <code>SecAccessControl</code> cờ <code>.biometryCurrentSet</code>. Khi đọc item, OS tự hiện Face ID/Touch ID;
        không qua được thì <code>SecItemCopyMatching</code> không trả dữ liệu. App <em>không</em> gọi <code>evaluatePolicy</code> rồi tự quyết.</li>
      <li>Hook callback lúc này vô dụng: không có xác thực thật thì phần cứng không giải mã, dữ liệu vẫn là bản mã.</li>
    </ul>

    <p><strong>4. Tăng thêm một bậc: ký challenge của server</strong></p>
    <p>Với giao dịch (chuyển tiền, xác nhận thanh toán), dùng <em>khoá ký</em> gắn sinh trắc học: server gửi challenge chứa chi tiết giao dịch → người dùng xác thực →
    phần cứng ký challenge → server kiểm chữ ký bằng public key đã đăng ký. Server có bằng chứng "người dùng đã xác thực sinh trắc học trên đúng thiết bị cho đúng giao dịch này".</p>

    <p><strong>5. Các quyết định thiết kế</strong></p>
    <table>
      <tr><th>Câu hỏi</th><th>Khuyến nghị</th></tr>
      <tr><td>Chỉ sinh trắc học mạnh hay cho phép cả passcode?</td><td>Tính năng nhạy cảm: <code>BIOMETRIC_STRONG</code> / <code>.biometryCurrentSet</code>. Tính năng thường: cho phép passcode dự phòng (<code>DEVICE_CREDENTIAL</code> / <code>.userPresence</code>)</td></tr>
      <tr><td>Người dùng thêm vân tay/khuôn mặt mới?</td><td>Huỷ khoá (<code>setInvalidatedByBiometricEnrollment</code>, <code>.biometryCurrentSet</code>) → yêu cầu đăng nhập lại bằng mật khẩu</td></tr>
      <tr><td>Bật tính năng như thế nào?</td><td>Chỉ sau khi đã đăng nhập đầy đủ (mật khẩu/OTP); người dùng chủ động bật</td></tr>
      <tr><td>Thất bại nhiều lần?</td><td>OS tự khoá tạm; app quay về đăng nhập bằng mật khẩu, không có "cửa sau"</td></tr>
      <tr><td>Máy không có sinh trắc học / người dùng tắt?</td><td>Luôn có đường đăng nhập khác</td></tr>
    </table>

    <p><strong>6. React Native và Flutter</strong></p>
    <ul>
      <li>Nhiều thư viện chỉ cung cấp API kiểu "hiện prompt, trả boolean" (<code>local_auth</code> của Flutter, <code>expo-local-authentication</code>…) — đó là <strong>cách yếu</strong> nếu dùng một mình.</li>
      <li>Để crypto-bound: dùng thư viện lưu trữ có gắn sinh trắc học — <code>react-native-keychain</code> với <code>accessControl: BIOMETRY_CURRENT_SET</code>,
        <code>expo-secure-store</code> với <code>requireAuthentication: true</code>, <code>flutter_secure_storage</code>/thư viện biometric storage có tuỳ chọn yêu cầu xác thực — hoặc viết module native.</li>
    </ul>

    <div class="callout"><p>💡 Câu hỏi kiểm tra khi review: <strong>"Nếu callback sinh trắc học bị ép trả true, kẻ tấn công có lấy được bí mật không?"</strong>
    Nếu có → đang dùng cách yếu. Bí mật phải chỉ giải mã được <em>bên trong</em> lần xác thực thành công.</p></div>
  `,

  codeTabs: [
    { id: "weak", label: "❌ Chỉ tin callback", lines: [
      "// Android — event-bound",
      "biometricPrompt.authenticate(promptInfo)          // KHÔNG có CryptoObject",
      "override fun onAuthenticationSucceeded(r: AuthenticationResult) {",
      "    val token = prefs.getString(\"refresh_token\", null)   // token sẵn trong kho thường",
      "    loginWith(token)",
      "}",
      "",
      "// iOS — event-bound",
      "LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: r) { ok, _ in",
      "    if ok { self.loginWith(UserDefaults.standard.string(forKey: \"rt\")) }",
      "}",
      "",
      "// Hook callback -> ok = true -> vào được; hoặc đọc thẳng prefs/UserDefaults"
    ]},
    { id: "android", label: "🤖 CryptoObject", lines: [
      "// Khoá Keystore yêu cầu sinh trắc học mạnh cho MỖI lần dùng (bài 05)",
      "val cipher = Cipher.getInstance(\"AES/GCM/NoPadding\").apply {",
      "    init(Cipher.DECRYPT_MODE, keyStore.getKey(\"rt_key\", null), GCMParameterSpec(128, iv))",
      "}",
      "biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))",
      "",
      "override fun onAuthenticationSucceeded(r: AuthenticationResult) {",
      "    val unlocked = r.cryptoObject!!.cipher!!        // cipher đã được phần cứng mở khoá",
      "    val token = String(unlocked.doFinal(encryptedRefreshToken))",
      "    loginWith(token)",
      "}",
      "// Không xác thực thật -> doFinal ném lỗi, không có token"
    ]},
    { id: "ios", label: "🍎 Keychain access control", lines: [
      "// Lưu: item chỉ đọc được sau Face ID/Touch ID của tập sinh trắc học hiện tại",
      "let access = SecAccessControlCreateWithFlags(nil,",
      "    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .biometryCurrentSet, nil)!",
      "SecItemAdd([kSecClass: kSecClassGenericPassword, kSecAttrAccount: \"rt\",",
      "            kSecAttrAccessControl: access, kSecValueData: rtData] as CFDictionary, nil)",
      "",
      "// Đọc: OS tự hiện Face ID — app KHÔNG tự quyết",
      "let ctx = LAContext(); ctx.localizedReason = \"Đăng nhập nhanh\"",
      "var out: CFTypeRef?",
      "let st = SecItemCopyMatching([kSecClass: kSecClassGenericPassword, kSecAttrAccount: \"rt\",",
      "    kSecReturnData: true, kSecUseAuthenticationContext: ctx] as CFDictionary, &out)",
      "if st == errSecSuccess { loginWith(out as! Data) }   // chỉ có dữ liệu khi xác thực thật"
    ]},
    { id: "sign", label: "✍️ Ký giao dịch", lines: [
      "// Server tạo challenge chứa chi tiết giao dịch",
      "challenge = server.post('/tx/prepare', { to, amount })   // { txId, nonce, to, amount }",
      "",
      "// App: hiện đúng nội dung giao dịch rồi yêu cầu sinh trắc học với khoá ký",
      "signature = await biometricSign(keyAlias='tx_sign', data=canonical(challenge))",
      "",
      "server.post('/tx/confirm', { txId, signature })",
      "",
      "// Server",
      "verify(devicePublicKey[user, device], canonical(storedChallenge), signature)",
      "require not challenge.used and challenge.expiresAt > now()"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// ❌ Chỉ boolean — yếu nếu dùng một mình",
      "const { success } = await LocalAuthentication.authenticateAsync()",
      "",
      "// ✅ React Native: item keychain gắn sinh trắc học",
      "await Keychain.setGenericPassword('user', rt, {",
      "  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,",
      "  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,",
      "})",
      "const creds = await Keychain.getGenericPassword({ authenticationPrompt: { title: 'Đăng nhập' } })",
      "",
      "// ✅ Expo",
      "await SecureStore.setItemAsync('rt', rt, { requireAuthentication: true })",
      "",
      "// Flutter: dùng thư viện storage có tuỳ chọn 'yêu cầu xác thực' hoặc module native"
    ]}
  ],

  stageHtml: `
    <div class="node" id="user"><div class="nl">👆 Người dùng chạm vân tay / Face ID</div><div class="ns">so khớp trong phần cứng</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="cb"><div class="nl">❌ Chỉ callback true/false</div><div class="ns">hook được · token nằm trong kho thường</div></div>
      <div class="node" id="hw"><div class="nl">✅ Phần cứng mở khoá cipher</div><div class="ns">CryptoObject / Keychain access control</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="bypass"><div class="nl">💥 Vượt qua được</div><div class="ns">ép true hoặc đọc thẳng token</div></div>
      <div class="node" id="token"><div class="nl">🔓 Giải mã refresh token</div><div class="ns">chỉ khi xác thực thật</div></div>
    </div>
    <div class="arrow" id="a3">↓ giao dịch nhạy cảm</div>
    <div class="node" id="server"><div class="nl">🖥️ Server kiểm chữ ký</div><div class="ns">đúng thiết bị · đúng giao dịch · một lần</div></div>
  `,

  steps: [
    { title: "1 · Sinh trắc học chỉ mở khoá cục bộ", tab: "weak", highlight: [2, 9], on: ["user", "a1"],
      desc: "App không nhận dữ liệu sinh trắc học; OS chỉ báo kết quả hoặc mở khoá một khoá mật mã. Việc bạn làm gì với kết quả đó quyết định độ an toàn." },
    { title: "2 · Cách yếu: tin boolean", tab: "weak", highlight: [3, 4, 10, 13], on: ["cb", "a2", "bypass"],
      desc: "Token nằm sẵn trong kho thường và callback chỉ là 'cửa sơn lên tường'. Hook ép true, hoặc đọc thẳng file, đều vượt qua." },
    { title: "3 · Android: CryptoObject", tab: "android", highlight: [2, 3, 5, 8, 9, 12], on: ["hw", "token"],
      desc: "Cipher từ khoá yêu cầu xác thực được truyền vào prompt. Chỉ cipher trả về từ lần xác thực thật mới giải mã được refresh token." },
    { title: "4 · iOS: Keychain tự hỏi Face ID", tab: "ios", highlight: [2, 3, 5, 10, 11, 12], on: ["hw", "token"],
      desc: "Item có access control <code>.biometryCurrentSet</code>: OS tự yêu cầu sinh trắc học khi đọc, app không tự quyết. Thêm khuôn mặt/vân tay mới → item mất hiệu lực." },
    { title: "5 · Ký challenge giao dịch", tab: "sign", highlight: [2, 5, 7, 10, 11], on: ["a3", "server"],
      desc: "Server nhận chữ ký của khoá gắn sinh trắc học trên đúng challenge chứa chi tiết giao dịch — bằng chứng mạnh hơn nhiều so với một cờ 'đã xác thực'." },
    { title: "6 · Cross-platform: chọn API đúng", tab: "xplat", highlight: [2, 5, 6, 7, 9, 12], on: ["cb", "hw"],
      desc: "API chỉ trả boolean là cách yếu. Dùng tuỳ chọn lưu trữ gắn sinh trắc học của react-native-keychain / expo-secure-store, hoặc module native." }
  ],

  quiz: [
    { q: "App hiện prompt vân tay, nếu callback thành công thì đọc token từ SharedPreferences. Điểm yếu?", options: [
        "Không có điểm yếu",
        "Callback có thể bị hook ép thành công, và token trong prefs đọc được mà không cần vân tay",
        "Vân tay có thể bị lộ lên server",
        "Chỉ yếu trên iOS"
      ], correct: 1,
      explanation: "Đây là cách event-bound: sinh trắc học không thực sự bảo vệ bí mật nào." },
    { q: "BiometricPrompt.CryptoObject giúp gì?", options: [
        "Gửi vân tay lên server",
        "Gắn lần xác thực với một Cipher: chỉ khi xác thực thật phần cứng mới cho cipher giải mã",
        "Làm prompt đẹp hơn",
        "Tắt sinh trắc học"
      ], correct: 1,
      explanation: "Crypto-bound: bí mật chỉ giải mã được bên trong lần xác thực thành công." },
    { q: "iOS: cách đúng để refresh token chỉ lấy được sau Face ID?", options: [
        "evaluatePolicy rồi đọc UserDefaults",
        "Lưu vào Keychain với SecAccessControl .biometryCurrentSet; OS tự yêu cầu Face ID khi đọc",
        "Mã hoá base64",
        "Lưu trong bộ nhớ tạm"
      ], correct: 1,
      explanation: "Không qua được xác thực thì SecItemCopyMatching không trả dữ liệu." },
    { q: "Vì sao nên huỷ khoá khi người dùng thêm vân tay mới?", options: [
        "Để tiết kiệm bộ nhớ",
        "Kẻ biết passcode có thể thêm vân tay của mình rồi mở dữ liệu; huỷ khoá buộc đăng nhập lại bằng mật khẩu",
        "Apple yêu cầu",
        "Vân tay cũ hết hạn"
      ], correct: 1,
      explanation: "setInvalidatedByBiometricEnrollment / .biometryCurrentSet chống kịch bản này." },
    { q: "Sinh trắc học chứng minh điều gì?", options: [
        "Danh tính pháp lý của người dùng với server",
        "Một người đã đăng ký sinh trắc học trên máy này đang cầm máy — dùng để mở khoá bí mật cục bộ",
        "Người dùng có quyền admin",
        "Thiết bị chưa bị root"
      ], correct: 1,
      explanation: "Server chỉ tin được nếu có chữ ký/bí mật được mở khoá bằng sinh trắc học." },
    { q: "Thư viện chỉ trả { success: true } (vd expo-local-authentication) dùng một mình thì sao?", options: [
        "An toàn tuyệt đối",
        "Là cách event-bound, yếu; cần kết hợp lưu trữ gắn sinh trắc học (requireAuthentication / BIOMETRY_CURRENT_SET)",
        "Không chạy trên Android",
        "Tự động crypto-bound"
      ], correct: 1,
      explanation: "Boolean có thể bị ép; bí mật phải được bảo vệ bởi khoá yêu cầu xác thực." },
    { q: "Khi nào nên cho phép bật đăng nhập sinh trắc học?", options: [
        "Ngay khi cài app, trước khi đăng nhập",
        "Sau khi người dùng đã đăng nhập đầy đủ và chủ động bật",
        "Bật mặc định cho mọi người",
        "Chỉ khi máy bị root"
      ], correct: 1,
      explanation: "Sinh trắc học là cách mở lại phiên đã được xác thực mạnh, không thay thế lần xác thực đầu." },
    { q: "Xác nhận chuyển tiền bằng vân tay theo cách mạnh nhất?", options: [
        "Gửi cờ biometricOk=true lên server",
        "Server gửi challenge chứa chi tiết giao dịch; khoá ký gắn sinh trắc học ký challenge; server kiểm chữ ký",
        "Gửi ảnh vân tay lên server",
        "Chỉ hiện prompt trong app"
      ], correct: 1,
      explanation: "Chữ ký trên đúng challenge là bằng chứng không giả mạo được bằng cách sửa app." },
    { q: "Người dùng thất bại sinh trắc học nhiều lần. App nên?", options: [
        "Mở một 'cửa sau' cho vào",
        "Quay về đăng nhập bằng mật khẩu/OTP; không có đường vòng",
        "Tắt app vĩnh viễn",
        "Xoá tài khoản"
      ], correct: 1,
      explanation: "Luôn có đường xác thực khác, nhưng không được yếu hơn." }
  ]
});
