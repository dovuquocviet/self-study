window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Dữ liệu trên thiết bị",
  title: "Keychain & Keystore chuyên sâu",
  subtitle: "Khoá hardware-backed · accessibility class · khoá chỉ dùng được sau khi xác thực sinh trắc học",

  theory: `
    <p>Bài 04 nói "hãy cất bí mật vào Keychain/Keystore". Bài này đi sâu hơn: <strong>khoá được bảo vệ đến mức nào</strong>,
    <strong>khi nào</strong> dữ liệu đọc được, và cách buộc khoá chỉ dùng được khi <strong>chính chủ</strong> có mặt.</p>

    <p><strong>1. Khoá hardware-backed là gì?</strong></p>
    <ul>
      <li>Điện thoại hiện đại có vùng xử lý bảo mật tách biệt với hệ điều hành chính: <strong>TEE</strong> (Trusted Execution Environment),
        <strong>StrongBox</strong> (chip bảo mật riêng trên nhiều máy Android), <strong>Secure Enclave</strong> (iOS).</li>
      <li>Khoá sinh trong vùng này <strong>không bao giờ rời khỏi phần cứng</strong>. App chỉ gửi dữ liệu vào và nhận kết quả (bản mã, chữ ký).
        Kể cả khi máy bị root, kẻ tấn công cũng không <em>trích xuất</em> được khoá — họ chỉ có thể nhờ máy dùng khoá khi đang chiếm quyền.</li>
      <li>Khác biệt quan trọng: bản mã bị copy sang máy khác là <strong>vô dụng</strong>, vì khoá nằm ở phần cứng máy gốc.</li>
    </ul>

    <p><strong>2. Thuộc tính khoá trên Android (KeyGenParameterSpec)</strong></p>
    <table>
      <tr><th>Thuộc tính</th><th>Ý nghĩa</th></tr>
      <tr><td><code>setIsStrongBoxBacked(true)</code></td><td>Yêu cầu chip StrongBox (nếu máy có); nếu không có thì bắt lỗi và dùng TEE</td></tr>
      <tr><td><code>setUserAuthenticationRequired(true)</code></td><td>Khoá chỉ dùng được sau khi người dùng xác thực (sinh trắc học / mã khoá máy)</td></tr>
      <tr><td><code>setUserAuthenticationParameters(timeout, type)</code></td><td>0 = phải xác thực cho <em>mỗi lần</em> dùng; &gt;0 = dùng được trong N giây sau khi mở khoá</td></tr>
      <tr><td><code>setInvalidatedByBiometricEnrollment(true)</code></td><td>Thêm vân tay/khuôn mặt mới → khoá bị huỷ (chống "thêm vân tay của kẻ khác")</td></tr>
      <tr><td><code>setUnlockedDeviceRequired(true)</code></td><td>Chỉ dùng khi màn hình đang mở khoá</td></tr>
      <tr><td>Key attestation</td><td>Chứng chỉ do phần cứng ký, cho server kiểm tra khoá thật sự nằm trong phần cứng</td></tr>
    </table>

    <p><strong>3. Accessibility class trên iOS Keychain</strong> — quyết định <em>khi nào</em> item đọc được và có theo backup không:</p>
    <table>
      <tr><th>Class</th><th>Đọc được khi</th><th>Theo backup/sang máy mới?</th></tr>
      <tr><td><code>WhenPasscodeSetThisDeviceOnly</code></td><td>Máy mở khoá VÀ máy có đặt mã khoá (xoá mã → item bị xoá)</td><td>Không</td></tr>
      <tr><td><code>WhenUnlockedThisDeviceOnly</code></td><td>Máy đang mở khoá</td><td>Không</td></tr>
      <tr><td><code>WhenUnlocked</code> (mặc định)</td><td>Máy đang mở khoá</td><td>Có (backup mã hoá)</td></tr>
      <tr><td><code>AfterFirstUnlockThisDeviceOnly</code></td><td>Sau lần mở khoá đầu tiên kể từ khi bật máy (cần cho tác vụ chạy nền)</td><td>Không</td></tr>
      <tr><td><code>AfterFirstUnlock</code></td><td>Như trên</td><td>Có</td></tr>
    </table>
    <p>Chọn class <strong>chặt nhất mà tính năng vẫn chạy</strong>. Token dùng khi app mở → <code>WhenUnlockedThisDeviceOnly</code>.
    Token cần cho push/background refresh → <code>AfterFirstUnlockThisDeviceOnly</code>. Hậu tố <code>ThisDeviceOnly</code> ngăn bí mật đi theo backup sang máy khác.</p>

    <p><strong>4. Gắn khoá với sinh trắc học / mã khoá máy</strong></p>
    <ul>
      <li><strong>iOS</strong>: tạo <code>SecAccessControl</code> với cờ <code>.biometryCurrentSet</code> (sinh trắc học hiện tại, thêm vân tay/khuôn mặt mới thì item mất hiệu lực)
        hoặc <code>.userPresence</code> (sinh trắc học hoặc passcode). Khi đọc item, OS tự hiện hộp thoại xác thực; không xác thực được thì <em>không có dữ liệu</em>.</li>
      <li><strong>Android</strong>: khoá có <code>setUserAuthenticationRequired</code> + <code>BiometricPrompt</code> với <code>CryptoObject</code>.
        Chỉ khi xác thực thành công, đối tượng <code>Cipher</code> mới được "mở khoá" để dùng.</li>
      <li>Đây là cách <strong>đúng</strong> để làm "đăng nhập bằng vân tay" — chi tiết so sánh với cách sai ở bài 12.</li>
    </ul>

    <p><strong>5. Ký bằng khoá bất đối xứng — device binding</strong></p>
    <p>Ngoài khoá AES để mã hoá, có thể sinh <strong>cặp khoá EC/RSA</strong> trong phần cứng: private key nằm im trong máy, public key gửi lên server lúc đăng ký thiết bị.
    Mỗi request nhạy cảm, app ký một thông điệp (có nonce từ server). Server kiểm tra chữ ký → biết request đến từ <em>đúng thiết bị đã đăng ký</em>.
    Token bị đánh cắp mang sang máy khác sẽ không ký được (bài 13).</p>

    <p><strong>6. Những sai lầm thường gặp</strong></p>
    <ul>
      <li>Dùng AES chế độ ECB, hoặc dùng IV cố định với GCM → lộ mẫu dữ liệu / phá tính toàn vẹn. Dùng AES-GCM với IV ngẫu nhiên mỗi lần mã hoá.</li>
      <li>Tự sinh khoá bằng <code>Random</code> thường, hoặc dẫn khoá từ chuỗi cố định → dùng Keystore/Keychain/CSPRNG.</li>
      <li>Sinh khoá ngoài phần cứng rồi "import" vào — mất lợi ích "khoá không rời phần cứng" nếu khoá từng nằm trong bộ nhớ app.</li>
      <li>Không xử lý <code>KeyPermanentlyInvalidatedException</code> / lỗi <code>errSecItemNotFound</code> → crash hoặc kẹt người dùng.</li>
    </ul>

    <div class="callout"><p>💡 Keychain/Keystore không làm dữ liệu "bất khả xâm phạm", nhưng nó biến bài toán từ <em>"copy file là xong"</em>
    thành <em>"phải chiếm được chính chiếc máy đó, lúc đang mở khoá, và qua được sinh trắc học"</em> — chênh lệch chi phí tấn công rất lớn.</p></div>
  `,

  codeTabs: [
    { id: "akey", label: "🤖 Android: khoá chặt", lines: [
      "val builder = KeyGenParameterSpec.Builder(\"vault_key\",",
      "        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)",
      "    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)",
      "    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)",
      "    .setKeySize(256)",
      "    .setUserAuthenticationRequired(true)",
      "    .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)",
      "    .setInvalidatedByBiometricEnrollment(true)",
      "    .setUnlockedDeviceRequired(true)",
      "try {",
      "    gen.init(builder.setIsStrongBoxBacked(true).build())",
      "} catch (e: StrongBoxUnavailableException) {",
      "    gen.init(builder.setIsStrongBoxBacked(false).build())   // fallback TEE",
      "}",
      "gen.generateKey()"
    ]},
    { id: "ikey", label: "🍎 iOS: access control", lines: [
      "// Item chỉ đọc được sau Face ID/Touch ID của TẬP sinh trắc học hiện tại",
      "var error: Unmanaged<CFError>?",
      "let access = SecAccessControlCreateWithFlags(nil,",
      "    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,",
      "    .biometryCurrentSet, &error)!",
      "",
      "let add: [String: Any] = [",
      "    kSecClass as String: kSecClassGenericPassword,",
      "    kSecAttrAccount as String: \"vault_secret\",",
      "    kSecAttrAccessControl as String: access,",
      "    kSecValueData as String: secret",
      "]",
      "SecItemAdd(add as CFDictionary, nil)",
      "",
      "// Đọc: OS tự hiện Face ID; thất bại -> không có dữ liệu",
      "let ctx = LAContext(); ctx.localizedReason = \"Mở két bảo mật\""
    ]},
    { id: "access", label: "📋 Chọn accessibility", lines: [
      "# iOS — chọn class chặt nhất mà tính năng vẫn chạy",
      "Token dùng khi app mở          -> WhenUnlockedThisDeviceOnly",
      "Token cho background refresh   -> AfterFirstUnlockThisDeviceOnly",
      "Bí mật rất nhạy cảm            -> WhenPasscodeSetThisDeviceOnly + .biometryCurrentSet",
      "",
      "# Tránh:",
      "kSecAttrAccessibleAlways       // đã deprecated, đọc được cả khi máy khoá",
      "không có ThisDeviceOnly        // bí mật theo backup sang máy khác",
      "",
      "# Android tương đương",
      "setUnlockedDeviceRequired(true)            ~ WhenUnlocked",
      "setUserAuthenticationRequired(true)        ~ access control .userPresence",
      "setInvalidatedByBiometricEnrollment(true)  ~ .biometryCurrentSet"
    ]},
    { id: "sign", label: "✍️ Ký = device binding", lines: [
      "// Sinh cặp khoá EC trong phần cứng khi đăng ký thiết bị",
      "keyPair = hardwareKeystore.generateEC(alias='device_sign', p256)",
      "api.post('/devices', { publicKey: keyPair.public, attestation: keyAttestationChain })",
      "",
      "// Mỗi thao tác nhạy cảm",
      "nonce = api.get('/challenge')",
      "sig   = hardwareKeystore.sign('device_sign', nonce + requestBodyHash)",
      "api.post('/transfer', body, headers={ 'X-Device-Sig': sig })",
      "",
      "// Server: verify(publicKey_đã_đăng_ký, nonce + hash(body), sig)",
      "// Token bị trộm sang máy khác -> không có private key -> không ký được"
    ]},
    { id: "mistake", label: "❌ Sai lầm mật mã", lines: [
      "// SAI: khoá dẫn từ chuỗi cố định",
      "val key = SecretKeySpec(\"myappkey12345678\".toByteArray(), \"AES\")",
      "",
      "// SAI: ECB lộ mẫu dữ liệu",
      "Cipher.getInstance(\"AES/ECB/PKCS5Padding\")",
      "",
      "// SAI: IV cố định với GCM -> phá bảo mật",
      "cipher.init(ENCRYPT_MODE, key, GCMParameterSpec(128, ByteArray(12)))",
      "",
      "// ĐÚNG: khoá từ Keystore, AES-GCM, IV ngẫu nhiên do cipher sinh",
      "cipher.init(ENCRYPT_MODE, keyStore.getKey(\"vault_key\", null))",
      "store(cipher.iv, cipher.doFinal(plain))"
    ]}
  ],

  stageHtml: `
    <div class="node" id="appn"><div class="nl">📱 App</div><div class="ns">gửi dữ liệu vào, nhận kết quả ra</div></div>
    <div class="arrow" id="a1">↓ yêu cầu dùng khoá</div>
    <div class="node" id="gate"><div class="nl">👆 Cổng xác thực</div><div class="ns">máy mở khoá? sinh trắc học hợp lệ?</div></div>
    <div class="arrow" id="a2">↓ đạt điều kiện</div>
    <div class="node" id="hw"><div class="nl">🔒 TEE / StrongBox / Secure Enclave</div><div class="ns">khoá nằm đây, không bao giờ ra ngoài</div></div>
    <div class="arrow" id="a3">↓ bản mã / chữ ký</div>
    <div class="row">
      <div class="node" id="store"><div class="nl">💾 Bản mã lưu trên đĩa</div><div class="ns">copy sang máy khác = vô dụng</div></div>
      <div class="node" id="srv"><div class="nl">🖥️ Server</div><div class="ns">xác minh chữ ký = đúng thiết bị</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Khoá sinh trong phần cứng", tab: "akey", highlight: [1, 3, 5, 10, 11, 12, 13, 15], on: ["hw"],
      desc: "Ưu tiên StrongBox, không có thì dùng TEE. Khoá được tạo và giữ trong phần cứng bảo mật; app chỉ có 'tay cầm' (alias) để nhờ phần cứng mã hoá/giải mã." },
    { title: "2 · Buộc xác thực trước khi dùng khoá", tab: "akey", highlight: [6, 7, 8, 9], on: ["a1", "gate"],
      desc: "Timeout 0 = mỗi lần dùng khoá đều phải xác thực sinh trắc học mạnh. Thêm vân tay mới làm khoá mất hiệu lực — kẻ biết mã khoá máy không thể thêm vân tay mình để mở két." },
    { title: "3 · iOS: SecAccessControl", tab: "ikey", highlight: [3, 4, 5, 10, 15, 16], on: ["gate", "a2", "hw"],
      desc: "<code>.biometryCurrentSet</code> + <code>WhenPasscodeSetThisDeviceOnly</code>: chỉ đọc được sau Face ID/Touch ID của tập sinh trắc học hiện tại, trên chính máy này, và máy phải có mã khoá." },
    { title: "4 · Chọn accessibility class", tab: "access", highlight: [2, 3, 4, 7, 8], on: ["gate"],
      desc: "Class quyết định lúc nào đọc được và có theo backup không. Chọn class chặt nhất mà tính năng vẫn chạy; luôn ưu tiên hậu tố ThisDeviceOnly cho bí mật." },
    { title: "5 · Bản mã rời máy là vô dụng", tab: "mistake", highlight: [11, 12], on: ["a3", "store"],
      desc: "Chỉ lưu IV + bản mã. Không có khoá trong phần cứng của máy gốc thì không ai giải mã được." },
    { title: "6 · Khoá ký để gắn phiên với thiết bị", tab: "sign", highlight: [2, 3, 7, 8, 10, 11], on: ["hw", "srv"],
      desc: "Private key không rời phần cứng, public key đăng ký với server. Server xác minh chữ ký trên nonce + nội dung request → biết request đến từ đúng máy." },
    { title: "7 · Tránh sai lầm mật mã cơ bản", tab: "mistake", highlight: [2, 5, 8], on: ["appn"],
      desc: "Khoá từ chuỗi cố định, ECB, IV cố định — đều phá hỏng bảo mật dù đã 'dùng AES'. Dùng API cấp cao và để Keystore sinh khoá, cipher sinh IV." }
  ],

  quiz: [
    { q: "'Hardware-backed key' mang lại lợi ích chính gì?", options: [
        "Mã hoá nhanh hơn",
        "Khoá không bao giờ rời khỏi phần cứng bảo mật, nên không trích xuất được kể cả khi OS bị chiếm",
        "Không cần mật khẩu nữa",
        "Tự động đồng bộ khoá lên cloud"
      ], correct: 1,
      explanation: "Kẻ tấn công có thể nhờ máy dùng khoá khi đang chiếm quyền, nhưng không mang khoá đi được." },
    { q: "iOS: token chỉ dùng khi app đang mở, không nên theo backup sang máy khác. Chọn class nào?", options: [
        "kSecAttrAccessibleAlways",
        "kSecAttrAccessibleWhenUnlockedThisDeviceOnly",
        "kSecAttrAccessibleAfterFirstUnlock",
        "kSecAttrAccessibleWhenUnlocked"
      ], correct: 1,
      explanation: "WhenUnlocked = chỉ đọc khi máy mở khoá; ThisDeviceOnly = không đi theo backup." },
    { q: "setInvalidatedByBiometricEnrollment(true) chống lại kịch bản nào?", options: [
        "Mất điện",
        "Kẻ biết mã khoá máy thêm vân tay của họ rồi dùng vân tay đó mở dữ liệu",
        "App bị gỡ cài đặt",
        "Mạng chậm"
      ], correct: 1,
      explanation: "Khi tập sinh trắc học thay đổi, khoá bị huỷ; app yêu cầu đăng nhập lại bằng mật khẩu để thiết lập lại." },
    { q: "Token cần đọc khi app chạy nền nhận push (máy có thể đang khoá màn hình). Class phù hợp?", options: [
        "WhenPasscodeSetThisDeviceOnly",
        "AfterFirstUnlockThisDeviceOnly",
        "WhenUnlockedThisDeviceOnly",
        "Không lưu gì cả"
      ], correct: 1,
      explanation: "AfterFirstUnlock cho phép đọc sau lần mở khoá đầu tiên kể từ khi bật máy — cần cho tác vụ nền." },
    { q: "Android: setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG) nghĩa là gì?", options: [
        "Không cần xác thực",
        "Mỗi lần dùng khoá đều phải xác thực bằng sinh trắc học mạnh",
        "Xác thực một lần cho cả ngày",
        "Chỉ dùng mã PIN"
      ], correct: 1,
      explanation: "Timeout 0 = xác thực cho mỗi thao tác, thường đi cùng BiometricPrompt + CryptoObject." },
    { q: "Dòng nào là lỗi mật mã nghiêm trọng?", options: [
        "Dùng AES/GCM/NoPadding với khoá từ Keystore",
        "Dùng GCMParameterSpec với IV toàn số 0 cố định cho mọi lần mã hoá",
        "Lưu IV cạnh bản mã",
        "Sinh khoá bằng KeyGenerator của AndroidKeyStore"
      ], correct: 1,
      explanation: "GCM với IV lặp lại phá cả tính bí mật lẫn toàn vẹn. IV phải khác nhau mỗi lần (để cipher tự sinh)." },
    { q: "Device binding bằng khoá ký giúp gì?", options: [
        "Tăng tốc đăng nhập",
        "Server xác minh request đến từ đúng thiết bị đã đăng ký; token bị trộm sang máy khác không tạo được chữ ký",
        "Thay thế HTTPS",
        "Chống screenshot"
      ], correct: 1,
      explanation: "Private key nằm trong phần cứng máy gốc; không có nó thì không ký được nonce của server." },
    { q: "Vì sao nên dùng hậu tố ThisDeviceOnly cho bí mật trên iOS?", options: [
        "Để app chạy nhanh hơn",
        "Để bí mật không đi theo backup/khôi phục sang thiết bị khác",
        "Để chia sẻ với app khác",
        "Để Keychain không bị đầy"
      ], correct: 1,
      explanation: "Bí mật gắn với thiết bị không nên xuất hiện trên máy khác qua backup." },
    { q: "Key attestation trên Android cho phép server biết điều gì?", options: [
        "Mật khẩu người dùng",
        "Khoá thực sự được sinh và lưu trong phần cứng bảo mật của một thiết bị hợp lệ",
        "Vị trí GPS",
        "Danh sách app đã cài"
      ], correct: 1,
      explanation: "Chuỗi chứng chỉ do phần cứng ký chứng minh thuộc tính của khoá, server kiểm tra được." }
  ]
});
