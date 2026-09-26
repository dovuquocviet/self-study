window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Dữ liệu & mật mã",
  title: "Mật mã cho lập trình viên: dùng đúng, đừng tự chế",
  subtitle: "Thư viện cấp cao · AEAD (AES-GCM, ChaCha20-Poly1305) · nonce · CSPRNG · hash/HMAC/chữ ký · so sánh thời gian hằng · TLS",

  theory: `
    <p>Lập trình viên backend gặp mật mã hằng ngày: mã hoá một cột dữ liệu nhạy cảm, sinh token đặt lại mật khẩu, ký webhook, xác minh chữ ký,
    gọi API qua HTTPS… Tin tốt: bạn <strong>không cần hiểu toán</strong> để dùng mật mã an toàn. Tin xấu: mật mã <strong>hỏng một cách im lặng</strong> —
    code vẫn chạy, test vẫn xanh, dữ liệu trông vẫn "loằng ngoằng", nhưng thực chất đã đọc/giả mạo được. Bài này là bộ quy tắc thực hành để khỏi rơi vào các lỗi đó.</p>

    <p><strong>1. Quy tắc số 0: không tự chế.</strong> Không tự nghĩ thuật toán ("XOR với khoá rồi đảo ngược chuỗi"), không tự ghép các khối nguyên thuỷ
    (tự nối AES-CBC với một hàm hash tự chọn), không tự cài đặt lại AES/RSA. Mật mã an toàn là thứ đã được hàng nghìn chuyên gia soi trong nhiều năm.
    Thay vào đó, dùng <strong>thư viện cấp cao</strong> — thư viện chọn sẵn thuật toán, chế độ, độ dài khoá, cách sinh nonce cho bạn:</p>
    <ul>
      <li><strong>libsodium</strong> (và các binding: PyNaCl, sodium-native / libsodium.js, lazysodium cho Java, sodiumoxide/dryoc cho Rust…): API kiểu <code>secretbox</code>, <code>box</code>, <code>sign</code>, <code>crypto_pwhash</code>.</li>
      <li><strong>Google Tink</strong> (Java, Go, Python, C++, Obj-C): "keyset" + primitive <code>Aead</code>, <code>Mac</code>, <code>PublicKeySign</code> — khó dùng sai.</li>
      <li>Nếu buộc dùng thư viện chuẩn của ngôn ngữ (Web Crypto, Java JCA, Go <code>crypto/*</code>, Python <code>cryptography</code>) → chỉ dùng các chế độ "AEAD" và làm theo recipe chính thức.</li>
      <li>Với <strong>mật khẩu người dùng</strong>: không mã hoá, không SHA-256 — dùng hàm băm mật khẩu chuyên dụng (Argon2id, scrypt, bcrypt). Chi tiết ở phần xác thực của khoá.</li>
    </ul>

    <p><strong>2. Mã hoá đối xứng: chọn AEAD.</strong> Mã hoá không chỉ cần <em>bí mật</em> (người ngoài không đọc được) mà còn cần <em>toàn vẹn</em>
    (bị sửa một bit là phát hiện). Chế độ cũ như AES-ECB, AES-CBC không kèm xác thực: ECB để lộ cấu trúc dữ liệu, CBC không có MAC thì dữ liệu có thể bị sửa
    mà server không hay biết. <strong>AEAD</strong> (Authenticated Encryption with Associated Data) làm cả hai việc trong một bước:</p>
    <table>
      <tr><th>Thuật toán</th><th>Khi nào dùng</th><th>Ghi chú</th></tr>
      <tr><td><strong>AES-256-GCM</strong></td><td>Phổ biến nhất, CPU có tăng tốc AES (hầu hết server)</td><td>Nonce 96 bit, <strong>tuyệt đối không lặp</strong> với cùng khoá</td></tr>
      <tr><td><strong>ChaCha20-Poly1305</strong></td><td>Thiết bị không có tăng tốc AES, hoặc muốn đơn giản</td><td>Nonce 96 bit; biến thể <strong>XChaCha20</strong> nonce 192 bit — sinh ngẫu nhiên thoải mái</td></tr>
      <tr><td>AES-GCM-SIV</td><td>Lo ngại lỡ lặp nonce</td><td>Lặp nonce chỉ lộ "hai bản rõ giống nhau", không sụp đổ hoàn toàn</td></tr>
      <tr><td>❌ ECB, CBC không MAC, RC4, DES/3DES</td><td>Không dùng cho code mới</td><td>Gặp khi review → đánh dấu cần thay</td></tr>
    </table>
    <p>"Associated Data" (AAD) là dữ liệu <em>không cần giấu</em> nhưng phải gắn chặt với bản mã, ví dụ <code>user_id</code> chủ sở hữu bản ghi.
    Nếu kẻ xấu chép bản mã của user A sang dòng của user B, giải mã với AAD = id của B sẽ <strong>thất bại</strong> — chặn được kiểu tấn công "tráo bản mã".</p>

    <p><strong>3. Nonce (IV): số dùng một lần.</strong> Với AES-GCM, <strong>dùng lại cùng (khoá, nonce) cho hai thông điệp là thảm hoạ</strong>:
    kẻ tấn công có thể suy ra quan hệ giữa hai bản rõ và giả mạo được thẻ xác thực. Quy tắc:</p>
    <ul>
      <li>Sinh nonce mới cho <strong>mỗi lần mã hoá</strong> bằng CSPRNG (96 bit ngẫu nhiên), lưu nonce cạnh bản mã (nonce không cần bí mật).</li>
      <li>Không dùng hằng số, không dùng timestamp, không dùng <code>0</code> "cho đơn giản".</li>
      <li>Với 96 bit ngẫu nhiên, nên xoay khoá trước khi mã hoá khoảng 2<sup>32</sup> thông điệp cùng một khoá. Cần nhiều hơn → dùng XChaCha20 hoặc để Tink/libsodium lo.</li>
      <li>Thư viện cấp cao thường <em>tự sinh nonce và gắn vào bản mã</em> — đó là một lý do chính để dùng chúng.</li>
    </ul>

    <p><strong>4. CSPRNG vs random thường.</strong> <code>Math.random()</code>, <code>random.random()</code> (Python), <code>java.util.Random</code>, <code>math/rand</code> (Go), <code>rand()</code> (PHP/C)
    là bộ sinh số giả ngẫu nhiên <em>cho mô phỏng/game</em>: nhanh, nhưng quan sát vài giá trị là có thể <strong>đoán được</strong> các giá trị tiếp theo.
    Mọi thứ dùng cho bảo mật — khoá, nonce, token đặt lại mật khẩu, session id, mã OTP, API key, salt — phải lấy từ <strong>CSPRNG</strong>
    (Cryptographically Secure PRNG, nguồn ngẫu nhiên của hệ điều hành):</p>
    <table>
      <tr><th>Ngôn ngữ</th><th>❌ Không dùng cho bảo mật</th><th>✅ CSPRNG</th></tr>
      <tr><td>Node.js / trình duyệt</td><td><code>Math.random()</code></td><td><code>crypto.randomBytes(n)</code>, <code>crypto.randomUUID()</code>, <code>crypto.getRandomValues()</code></td></tr>
      <tr><td>Python</td><td><code>random</code></td><td><code>secrets.token_urlsafe(32)</code>, <code>secrets.token_bytes()</code></td></tr>
      <tr><td>Java / Kotlin</td><td><code>java.util.Random</code></td><td><code>java.security.SecureRandom</code></td></tr>
      <tr><td>Go</td><td><code>math/rand</code></td><td><code>crypto/rand</code></td></tr>
      <tr><td>PHP</td><td><code>rand()</code>, <code>mt_rand()</code></td><td><code>random_bytes()</code>, <code>random_int()</code></td></tr>
      <tr><td>C# / .NET</td><td><code>System.Random</code></td><td><code>RandomNumberGenerator</code></td></tr>
    </table>
    <p>Độ dài token: tối thiểu <strong>128 bit</strong> (16 byte) ngẫu nhiên, thường dùng 32 byte rồi mã hoá base64url/hex để đưa vào URL.</p>

    <p><strong>5. Hash vs HMAC vs chữ ký số — ba công cụ, ba mục đích.</strong></p>
    <table>
      <tr><th></th><th>Hash (SHA-256, SHA-3, BLAKE2)</th><th>HMAC (HMAC-SHA256)</th><th>Chữ ký số (Ed25519, ECDSA P-256, RSA-PSS)</th></tr>
      <tr><td>Cần khoá?</td><td>Không</td><td>Khoá bí mật <strong>chung</strong> của hai bên</td><td>Khoá riêng để ký, khoá công khai để kiểm</td></tr>
      <tr><td>Chứng minh được gì</td><td>Dữ liệu không bị hỏng ngẫu nhiên (checksum)</td><td>Dữ liệu đến từ người giữ khoá và không bị sửa</td><td>Như HMAC + <strong>ai cũng kiểm được</strong> mà không giữ được quyền ký</td></tr>
      <tr><td>Chống giả mạo có chủ đích?</td><td>❌ Kẻ sửa dữ liệu tính lại hash được</td><td>✅</td><td>✅</td></tr>
      <tr><td>Ví dụ dùng</td><td>Khử trùng lặp file, cache key, checksum tải về (khi hash lấy từ kênh tin cậy)</td><td>Ký webhook, ký cookie/token nội bộ, ký URL tải file có hạn</td><td>JWT phát cho bên thứ ba kiểm, ký bản cập nhật phần mềm, ký tài liệu</td></tr>
    </table>
    <p>Lỗi hay gặp: dùng <code>sha256(secret + data)</code> tự chế thay cho HMAC (dễ bị tấn công mở rộng độ dài với SHA-2); dùng MD5/SHA-1 cho mục đích bảo mật
    (đã có va chạm thực tế); dùng hash thường cho mật khẩu (quá nhanh, dễ dò).</p>

    <p><strong>6. So sánh thời gian hằng.</strong> Khi kiểm tra HMAC, token, API key, <code>a == b</code> thông thường dừng lại ở <em>byte khác đầu tiên</em>.
    Đo thời gian phản hồi đủ nhiều lần, kẻ tấn công có thể đoán dần từng byte. Luôn dùng hàm so sánh <strong>thời gian hằng</strong>:
    <code>crypto.timingSafeEqual</code> (Node), <code>hmac.compare_digest</code> (Python), <code>MessageDigest.isEqual</code> (Java),
    <code>subtle.ConstantTimeCompare</code> / <code>hmac.Equal</code> (Go), <code>hash_equals</code> (PHP), <code>CryptographicOperations.FixedTimeEquals</code> (.NET).
    Tốt hơn nữa: dùng hàm <em>verify</em> của thư viện (nó đã so sánh an toàn bên trong).</p>

    <p><strong>7. TLS đúng cách.</strong> HTTPS chỉ an toàn khi client <strong>kiểm tra chứng chỉ</strong> của server (đúng tên miền, còn hạn, do CA tin cậy ký).
    Tắt kiểm tra = ai đứng giữa đường truyền cũng giả được server. Các "mẹo" sửa lỗi chứng chỉ tuyệt đối không mang lên production:</p>
    <ul>
      <li><code>verify=False</code> (Python requests), <code>rejectUnauthorized: false</code> / <code>NODE_TLS_REJECT_UNAUTHORIZED=0</code> (Node),
        <code>InsecureSkipVerify: true</code> (Go), TrustManager "chấp nhận tất cả" / HostnameVerifier luôn trả true (Java), <code>curl -k</code> trong script deploy.</li>
      <li>Nếu dùng CA nội bộ: <strong>thêm CA đó vào trust store</strong> (hoặc truyền file CA cho client), đừng tắt kiểm tra.</li>
      <li>Chỉ bật TLS 1.2+ (ưu tiên 1.3), để thư viện/proxy chọn cipher suite mặc định hiện đại; bật HSTS cho web.</li>
      <li>Kết nối nội bộ (app → DB, app → Redis, service → service) cũng nên dùng TLS; môi trường zero-trust dùng mTLS.</li>
    </ul>

    <p><strong>8. Quản lý khoá là một nửa bài toán.</strong> Mã hoá mạnh mà khoá nằm cạnh dữ liệu (cùng DB, hardcode trong code) thì cũng như không.
    Khoá phải nằm trong KMS/secret manager, có phiên bản để xoay vòng (envelope encryption: khoá dữ liệu được mã hoá bởi khoá chủ trong KMS).
    Bài 21 đi sâu vào quản lý secret.</p>

    <div class="callout"><p>💡 Checklist review code mật mã: (1) Có thuật toán/chế độ tự chế hay ECB/CBC trần không? (2) Nonce có sinh mới bằng CSPRNG mỗi lần không?
    (3) Token/khoá có dùng random thường không? (4) Mục đích cần hash, HMAC hay chữ ký — có chọn đúng không? (5) So sánh MAC/token có thời gian hằng không?
    (6) Có chỗ nào tắt kiểm tra chứng chỉ TLS không? (7) Khoá lưu ở đâu, xoay vòng thế nào?</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Lỗi hay gặp", lines: [
      "// Pseudo-code: những dòng cần 'bắt' khi review",
      "key   = \"my-super-secret-key-123\"          // khoá hardcode, không đủ ngẫu nhiên",
      "iv    = bytes(16)                          // nonce toàn số 0, dùng lại mãi",
      "ct    = AES_ECB_encrypt(key, data)         // ECB: lộ cấu trúc, không toàn vẹn",
      "token = toString(Math.random())            // random thường -> đoán được",
      "sig   = sha256(secret + body)              // tự chế MAC thay vì HMAC",
      "if sig == req.header('X-Signature'): ok    // so sánh dừng ở byte khác đầu tiên",
      "http.get(url, verifyTls = false)           // tắt kiểm tra chứng chỉ",
      "",
      "// Code vẫn chạy, test vẫn xanh -> lỗi mật mã luôn 'im lặng'"
    ]},
    { id: "aead", label: "✅ AEAD đúng cách", lines: [
      "// Mã hoá một cột nhạy cảm (ví dụ số CMND) bằng AEAD",
      "function encryptField(plain, ownerId):",
      "    key   = kms.getDataKey('pii-key')        // khoá từ KMS, không hardcode",
      "    nonce = csprng.bytes(12)                  // MỚI mỗi lần, 96 bit",
      "    aad   = 'user:' + ownerId                 // gắn bản mã với chủ sở hữu",
      "    ct    = AES_256_GCM.seal(key, nonce, plain, aad)",
      "    return keyVersion + nonce + ct            // lưu kèm nonce + phiên bản khoá",
      "",
      "function decryptField(blob, ownerId):",
      "    (ver, nonce, ct) = split(blob)",
      "    key = kms.getDataKey('pii-key', ver)",
      "    return AES_256_GCM.open(key, nonce, ct, 'user:' + ownerId)",
      "    // sai khoá / sửa 1 bit / tráo sang user khác -> open() báo lỗi"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Python — cryptography (AESGCM) và secrets",
      "nonce = os.urandom(12); ct = AESGCM(key).encrypt(nonce, plain, aad)",
      "token = secrets.token_urlsafe(32)",
      "# Node.js — crypto",
      "const c = crypto.createCipheriv('aes-256-gcm', key, crypto.randomBytes(12))",
      "const token = crypto.randomBytes(32).toString('base64url')",
      "# Java — Tink",
      "Aead aead = handle.getPrimitive(Aead.class); aead.encrypt(plain, aad);",
      "# Go — crypto/cipher + crypto/rand",
      "gcm, _ := cipher.NewGCM(block); rand.Read(nonce); gcm.Seal(nil, nonce, plain, aad)",
      "# libsodium (mọi binding) — tự lo nonce 192 bit",
      "ct = crypto_aead_xchacha20poly1305_ietf_encrypt(plain, aad, nonce, key)",
      "",
      "# Điểm chung: AEAD + nonce từ CSPRNG + khoá ngoài code"
    ]},
    { id: "mac", label: "🔏 HMAC + so sánh", lines: [
      "// Xác minh webhook do đối tác ký bằng HMAC-SHA256",
      "handle POST /webhook (req):",
      "    secret   = secrets.get('partner-webhook-key')",
      "    expected = HMAC_SHA256(secret, req.rawBody + req.header('X-Timestamp'))",
      "    given    = hexDecode(req.header('X-Signature'))",
      "    if not constantTimeEqual(expected, given): return 401",
      "    if abs(now() - req.header('X-Timestamp')) > 5min: return 401  // chống phát lại",
      "    process(req.body)",
      "",
      "# Node:   crypto.timingSafeEqual(a, b)",
      "# Python: hmac.compare_digest(a, b)",
      "# Java:   MessageDigest.isEqual(a, b)",
      "# Go:     hmac.Equal(a, b)      PHP: hash_equals(a, b)"
    ]},
    { id: "tls", label: "🔐 TLS đúng", lines: [
      "# ❌ 'Sửa nhanh' lỗi chứng chỉ — KHÔNG BAO GIỜ lên production",
      "requests.get(url, verify=False)                  # Python",
      "https.request({ rejectUnauthorized: false })     # Node",
      "tls.Config{ InsecureSkipVerify: true }           # Go",
      "",
      "# ✅ Dùng CA nội bộ: chỉ định file CA thay vì tắt kiểm tra",
      "requests.get(url, verify='/etc/ssl/internal-ca.pem')",
      "https.request({ ca: fs.readFileSync('internal-ca.pem') })",
      "tls.Config{ RootCAs: internalPool, MinVersion: tls.VersionTLS12 }",
      "",
      "# ✅ Thêm cờ CI: grep các chuỗi verify=False / InsecureSkipVerify -> fail build"
    ]}
  ],

  stageHtml: `
    <div class="node" id="need"><div class="nl">🎯 Nhu cầu</div><div class="ns">giấu dữ liệu? chống sửa? ai cũng kiểm được?</div></div>
    <div class="arrow" id="a1">↓ chọn đúng công cụ</div>
    <div class="row">
      <div class="node" id="aead"><div class="nl">🔒 AEAD</div><div class="ns">AES-GCM · ChaCha20-Poly1305</div></div>
      <div class="node" id="hmac"><div class="nl">🔏 HMAC</div><div class="ns">khoá chung · webhook · token nội bộ</div></div>
      <div class="node" id="sign"><div class="nl">✍️ Chữ ký số</div><div class="ns">Ed25519 · khoá công khai để kiểm</div></div>
    </div>
    <div class="arrow" id="a2">↓ nguyên liệu</div>
    <div class="row">
      <div class="node" id="rng"><div class="nl">🎲 CSPRNG</div><div class="ns">khoá · nonce · token</div></div>
      <div class="node" id="kms"><div class="nl">🗝️ KMS / secret manager</div><div class="ns">khoá ngoài code · xoay vòng</div></div>
    </div>
    <div class="arrow" id="a3">↓ khi kiểm tra &amp; truyền đi</div>
    <div class="row">
      <div class="node" id="cte"><div class="nl">⏱️ So sánh thời gian hằng</div><div class="ns">timingSafeEqual · compare_digest</div></div>
      <div class="node" id="tls"><div class="nl">🌐 TLS kiểm chứng chỉ</div><div class="ns">không verify=false</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Nhận diện lỗi 'im lặng'", tab: "vuln", highlight: [2, 3, 4, 5, 6, 7, 8], on: ["need"],
      desc: "Mỗi dòng này đều chạy được, không báo lỗi — nhưng mỗi dòng là một lỗ hổng: khoá yếu, nonce lặp, ECB, random đoán được, MAC tự chế, so sánh rò rỉ thời gian, tắt TLS." },
    { title: "2 · Chọn công cụ theo mục đích", tab: "vuln", highlight: [6], on: ["a1", "aead", "hmac", "sign"],
      desc: "Cần giấu + chống sửa → AEAD. Cần chống sửa giữa hai bên cùng giữ khoá → HMAC. Cần bên thứ ba tự kiểm mà không ký được → chữ ký số. Hash trần không chống giả mạo." },
    { title: "3 · AEAD: nonce mới + AAD", tab: "aead", highlight: [3, 4, 5, 6, 7], on: ["aead", "a2", "rng", "kms"],
      desc: "Khoá lấy từ KMS, nonce 96 bit sinh bằng CSPRNG cho <strong>mỗi</strong> lần mã hoá, AAD gắn bản mã với chủ sở hữu. Lưu phiên bản khoá để sau này xoay vòng." },
    { title: "4 · Giải mã tự phát hiện giả mạo", tab: "aead", highlight: [11, 12, 13], on: ["aead"],
      desc: "Sửa một bit, sai khoá, hoặc chép bản mã sang dòng của user khác → <code>open()</code> thất bại. Đây là thứ ECB/CBC trần không cho bạn." },
    { title: "5 · Ngôn ngữ nào cũng có công cụ chuẩn", tab: "langs", highlight: [2, 3, 5, 6, 8, 10, 12], on: ["aead", "rng"],
      desc: "AESGCM, createCipheriv('aes-256-gcm'), Tink Aead, cipher.NewGCM, libsodium XChaCha20 — cùng một ý tưởng. Token luôn lấy từ <code>secrets</code>/<code>randomBytes</code>/<code>SecureRandom</code>." },
    { title: "6 · HMAC + so sánh thời gian hằng", tab: "mac", highlight: [4, 6, 7, 10, 11, 12, 13], on: ["hmac", "a3", "cte"],
      desc: "Tính HMAC trên body gốc + timestamp, so sánh bằng hàm thời gian hằng, từ chối yêu cầu quá cũ để chống phát lại." },
    { title: "7 · Không bao giờ tắt kiểm tra TLS", tab: "tls", highlight: [2, 3, 4, 7, 8, 9, 11], on: ["tls"],
      desc: "Lỗi chứng chỉ với CA nội bộ → chỉ định file CA, không tắt verify. Thêm bước CI dò các cờ tắt kiểm tra để chặn từ sớm." }
  ],

  quiz: [
    { q: "Vì sao lập trình viên không nên tự chế thuật toán hoặc tự ghép các khối mật mã?", options: [
        "Vì thuật toán tự chế chạy chậm",
        "Vì lỗi mật mã thường không lộ ra khi chạy/test; thư viện cấp cao đã được chuyên gia kiểm chứng và chọn sẵn tham số an toàn",
        "Vì pháp luật cấm",
        "Vì tự chế thì không nén được dữ liệu"
      ], correct: 1,
      explanation: "Mật mã hỏng một cách im lặng. libsodium/Tink chọn sẵn thuật toán, chế độ, nonce — giảm tối đa cơ hội dùng sai." },
    { q: "Điểm khác biệt quan trọng của AES-GCM / ChaCha20-Poly1305 so với AES-CBC trần?", options: [
        "Khoá ngắn hơn",
        "Là AEAD: vừa giữ bí mật vừa phát hiện bản mã bị sửa",
        "Không cần khoá",
        "Chỉ dùng được trên Linux"
      ], correct: 1,
      explanation: "AEAD kèm thẻ xác thực; bị sửa một bit thì giải mã thất bại. CBC không MAC không phát hiện được sửa đổi." },
    { q: "Điều gì xảy ra nếu dùng lại cùng (khoá, nonce) cho hai thông điệp với AES-GCM?", options: [
        "Không sao, nonce chỉ để trang trí",
        "Thảm hoạ: lộ quan hệ giữa các bản rõ và có thể giả mạo thẻ xác thực",
        "Bản mã dài gấp đôi",
        "Giải mã chậm hơn"
      ], correct: 1,
      explanation: "Nonce phải là duy nhất cho mỗi lần mã hoá với cùng khoá. Sinh mới bằng CSPRNG, hoặc dùng XChaCha20/AES-GCM-SIV." },
    { q: "Hàm nào phù hợp để sinh token đặt lại mật khẩu trong Python?", options: [
        "random.randint(0, 999999)",
        "secrets.token_urlsafe(32)",
        "str(time.time())",
        "hashlib.md5(email).hexdigest()"
      ], correct: 1,
      explanation: "secrets dùng CSPRNG của hệ điều hành. random, timestamp, hash của email đều đoán được." },
    { q: "Hệ thống cần phát token mà đối tác bên ngoài tự kiểm tra được nhưng KHÔNG thể tự tạo token giả. Chọn gì?", options: [
        "SHA-256 của nội dung",
        "HMAC với khoá chia sẻ cho đối tác",
        "Chữ ký số (ví dụ Ed25519): mình giữ khoá riêng, đối tác giữ khoá công khai",
        "Base64 nội dung"
      ], correct: 2,
      explanation: "Với HMAC, ai kiểm được thì cũng ký được. Chữ ký số tách quyền ký (khoá riêng) và quyền kiểm (khoá công khai)." },
    { q: "Vì sao sha256(secret + body) không phải cách đúng để ký webhook?", options: [
        "Vì SHA-256 đã bị phá hoàn toàn",
        "Vì đây là MAC tự chế, có thể bị tấn công mở rộng độ dài; nên dùng HMAC-SHA256",
        "Vì chuỗi quá dài",
        "Vì webhook không cần ký"
      ], correct: 1,
      explanation: "HMAC được thiết kế đúng để làm MAC từ hàm hash. Ghép secret với dữ liệu rồi hash là cấu trúc tự chế có điểm yếu đã biết." },
    { q: "Vì sao nên so sánh chữ ký/token bằng hàm thời gian hằng (timingSafeEqual, compare_digest)?", options: [
        "Vì nhanh hơn ==",
        "Vì == dừng ở byte khác đầu tiên, thời gian phản hồi rò rỉ thông tin để đoán dần từng byte",
        "Vì == không so sánh được byte",
        "Vì bắt buộc với chuỗi Unicode"
      ], correct: 1,
      explanation: "Rò rỉ thời gian cho phép dò từng phần của giá trị đúng. Hàm thời gian hằng luôn duyệt hết." },
    { q: "Client gọi service nội bộ bị lỗi 'certificate signed by unknown authority' do dùng CA nội bộ. Cách xử lý đúng?", options: [
        "Đặt verify=False / InsecureSkipVerify: true",
        "Thêm CA nội bộ vào trust store hoặc truyền file CA cho client",
        "Chuyển sang HTTP",
        "Tắt TLS chỉ trên production"
      ], correct: 1,
      explanation: "Tắt kiểm tra chứng chỉ cho phép bất kỳ ai ở giữa giả mạo server. Tin đúng CA cần tin, đừng tin tất cả." },
    { q: "Associated Data (AAD) trong AEAD dùng để làm gì trong ví dụ mã hoá cột PII?", options: [
        "Nén bản mã",
        "Gắn bản mã với ngữ cảnh (ví dụ user_id) để bản mã bị chép sang bản ghi khác sẽ giải mã thất bại",
        "Thay thế cho khoá",
        "Giấu user_id"
      ], correct: 1,
      explanation: "AAD không bị mã hoá nhưng được xác thực. Sai ngữ cảnh → thẻ xác thực không khớp." },
    { q: "Mã hoá AES-256-GCM đúng chuẩn nhưng khoá được hardcode trong mã nguồn. Đánh giá?", options: [
        "An toàn vì AES-256 rất mạnh",
        "Không an toàn: ai đọc được code/bản build là giải mã được; khoá phải nằm trong KMS/secret manager",
        "An toàn nếu repo là private",
        "An toàn nếu khoá dài hơn 32 ký tự"
      ], correct: 1,
      explanation: "Độ mạnh của mã hoá phụ thuộc vào việc giữ bí mật khoá. Khoá trong code sớm muộn cũng lộ (bài 21)." }
  ]
});
