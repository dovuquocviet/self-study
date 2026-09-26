window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Xác thực & phiên đăng nhập",
  title: "Lưu mật khẩu an toàn",
  subtitle: "Hash chậm có salt (Argon2id/bcrypt/scrypt/PBKDF2) · pepper · nâng cấp hash cũ · chính sách mật khẩu hiện đại",

  theory: `
    <p>Gần như mọi hệ thống đều có bảng <code>users</code> chứa mật khẩu. Câu hỏi không phải "database có bị lộ không" mà là
    <strong>"khi database bị lộ (backup rò rỉ, SQLi ở bài 04, nhân viên sao chép nhầm…), kẻ lấy được nó có đọc ra mật khẩu thật không?"</strong>.
    Người dùng hay dùng lại một mật khẩu cho nhiều nơi, nên mật khẩu lộ từ hệ thống của bạn có thể mở khoá email, ngân hàng của họ.</p>

    <p><strong>1. Bốn cách lưu — chỉ một cách đúng</strong></p>
    <table>
      <tr><th>Cách lưu</th><th>Trong DB trông thế nào</th><th>Vấn đề</th></tr>
      <tr><td>❌ Plaintext</td><td><code>password = 'matkhau123'</code></td><td>Ai đọc được DB/log/backup là có ngay mật khẩu.</td></tr>
      <tr><td>❌ Mã hoá (AES…)</td><td><code>password = enc(key, 'matkhau123')</code></td><td>Mã hoá là <em>hai chiều</em>: có khoá là giải được. Khoá thường nằm cạnh app → lộ app là lộ hết.</td></tr>
      <tr><td>❌ Hash nhanh (MD5, SHA-1, SHA-256)</td><td><code>sha256('matkhau123')</code></td><td>Không có salt: hai người cùng mật khẩu → cùng hash, tra bảng tính sẵn là ra. Kể cả có salt: GPU tính hàng tỉ SHA-256 mỗi giây → đoán hết mật khẩu phổ biến trong vài phút.</td></tr>
      <tr><td>✅ Hash chậm + salt riêng</td><td><code>$argon2id$v=19$m=19456,t=2,p=1$&lt;salt&gt;$&lt;hash&gt;</code></td><td>Mỗi lần đoán tốn nhiều ms và nhiều MB RAM → đoán hàng loạt trở nên cực đắt.</td></tr>
    </table>

    <p><strong>2. Hash (băm) khác mã hoá thế nào?</strong> Hash là hàm <em>một chiều</em>: từ mật khẩu tính ra hash rất dễ, từ hash không tính ngược ra mật khẩu được.
    Khi đăng nhập, server không "giải" gì cả — nó băm lại mật khẩu vừa nhập (cùng salt, cùng tham số) rồi <strong>so sánh hai hash</strong>.
    Server không bao giờ cần biết mật khẩu gốc sau lúc đăng ký → đừng lưu nó ở bất cứ đâu.</p>

    <p><strong>3. Salt là gì và vì sao bắt buộc?</strong></p>
    <ul>
      <li>Salt là chuỗi ngẫu nhiên (≥ 16 byte, sinh bằng CSPRNG) tạo riêng cho <em>từng</em> user, trộn vào trước khi băm.</li>
      <li>Nhờ salt: hai user cùng mật khẩu <code>matkhau123</code> có hai hash khác nhau; bảng tra cứu tính sẵn (rainbow table) vô dụng; kẻ tấn công phải đoán <em>riêng từng tài khoản</em>.</li>
      <li>Salt <strong>không phải bí mật</strong> — nó được lưu ngay trong chuỗi hash. Các thư viện hiện đại tự sinh và tự nhúng salt, bạn không cần tự làm.</li>
    </ul>

    <p><strong>4. Chọn thuật toán nào?</strong> (theo thứ tự ưu tiên của OWASP Password Storage Cheat Sheet)</p>
    <table>
      <tr><th>Thuật toán</th><th>Đặc điểm</th><th>Tham số khởi điểm tham khảo</th></tr>
      <tr><td><strong>Argon2id</strong></td><td>Tốn cả CPU lẫn RAM (memory-hard) → GPU/ASIC khó tăng tốc. Lựa chọn mặc định cho hệ thống mới.</td><td>m = 19 MiB, t = 2, p = 1 (hoặc m = 46 MiB, t = 1)</td></tr>
      <tr><td><strong>scrypt</strong></td><td>Cũng memory-hard, có sẵn trong nhiều runtime (Node crypto, Python hashlib).</td><td>N = 2^17, r = 8, p = 1</td></tr>
      <tr><td><strong>bcrypt</strong></td><td>Lâu đời, phổ biến. Giới hạn: chỉ dùng <strong>72 byte đầu</strong> của mật khẩu.</td><td>cost (work factor) ≥ 10, thường 12</td></tr>
      <tr><td><strong>PBKDF2</strong></td><td>Chỉ tốn CPU, không tốn RAM. Dùng khi cần chuẩn FIPS.</td><td>PBKDF2-HMAC-SHA256 ≥ 600.000 vòng</td></tr>
    </table>
    <p>Các con số trên là <em>điểm khởi đầu</em>. Nguyên tắc chỉnh tham số: đo trên server thật, chọn mức sao cho một lần hash mất khoảng <strong>vài chục tới vài trăm ms</strong>
    mà server vẫn chịu được lượng đăng nhập cao điểm. Phần cứng mạnh dần theo năm → tăng tham số theo thời gian (xem mục 6).</p>

    <p><strong>5. Pepper — lớp bảo vệ thêm (tuỳ chọn)</strong></p>
    <ul>
      <li>Pepper là một khoá bí mật <em>chung</em> cho cả hệ thống, <strong>không</strong> lưu trong DB mà trong secret manager/HSM (bài về quản lý secret).</li>
      <li>Cách dùng phổ biến: <code>HMAC(pepper, password)</code> rồi mới đưa vào Argon2id, hoặc mã hoá chuỗi hash bằng khoá đó.</li>
      <li>Lợi ích: nếu chỉ DB bị lộ (qua SQLi, backup) mà app server không bị lộ → kẻ tấn công không có pepper, không thể đoán mật khẩu offline.</li>
      <li>Cái giá: mất pepper = không ai đăng nhập được; đổi pepper khó. Vì vậy pepper là <em>thêm vào</em>, không thay thế hash chậm có salt.</li>
    </ul>

    <p><strong>6. Nâng cấp hash cũ (rehash on login)</strong><br>
    Hệ thống cũ có thể đang lưu MD5/SHA-1 hoặc bcrypt cost thấp. Ta <em>không có</em> mật khẩu gốc để băm lại hàng loạt — nhưng mỗi khi user đăng nhập thành công,
    server có mật khẩu gốc trong tay đúng một lúc. Quy trình:</p>
    <ol>
      <li>Chuỗi hash có tiền tố cho biết thuật toán + tham số (<code>$2b$10$…</code>, <code>$argon2id$…m=19456…</code>).</li>
      <li>Đăng nhập: xác minh theo thuật toán cũ. Nếu đúng và thư viện báo <code>needsRehash</code> → băm lại bằng thuật toán/tham số mới, ghi đè.</li>
      <li>Với user lâu không đăng nhập mà hash cũ quá yếu (MD5 không salt): <strong>bọc lớp</strong> ngay — lưu <code>argon2id(md5_cũ)</code> cho tất cả, đánh dấu là "legacy-wrapped"; hoặc bắt họ đặt lại mật khẩu.</li>
    </ol>

    <p><strong>7. So sánh thời gian hằng (constant-time)</strong><br>
    So sánh chuỗi thông thường (<code>==</code>) dừng ngay ở byte khác đầu tiên → thời gian trả lời tiết lộ "đúng được bao nhiêu byte".
    Hàm <code>verify</code> của thư viện hash đã tự so sánh thời gian hằng. Chỉ khi bạn <em>tự</em> so sánh hai giá trị bí mật (HMAC, token) mới cần gọi
    <code>timingSafeEqual</code> / <code>hmac.compare_digest</code> / <code>MessageDigest.isEqual</code> / <code>subtle.ConstantTimeCompare</code>.</p>

    <p><strong>8. Chính sách mật khẩu hiện đại (NIST SP 800-63B)</strong></p>
    <table>
      <tr><th>Nên làm ✅</th><th>Không nên ❌</th></tr>
      <tr><td>Tối thiểu 8 ký tự (khuyến nghị 12–15+ nếu không có MFA)</td><td>Bắt buộc "ít nhất 1 hoa, 1 số, 1 ký tự đặc biệt" — người dùng chỉ đặt <code>Matkhau1!</code></td></tr>
      <tr><td>Cho phép mật khẩu dài (ít nhất 64 ký tự), mọi ký tự Unicode, dấu cách, dán từ password manager</td><td>Giới hạn tối đa 16 ký tự, chặn paste</td></tr>
      <tr><td>Kiểm tra với danh sách mật khẩu <strong>đã lộ</strong> / quá phổ biến (vd. dịch vụ Have I Been Pwned dạng k-anonymity, chỉ gửi 5 ký tự đầu của SHA-1)</td><td>Bắt đổi mật khẩu định kỳ 90 ngày dù không có dấu hiệu lộ</td></tr>
      <tr><td>Đồng hồ đo độ mạnh, gợi ý dùng passphrase</td><td>Câu hỏi bảo mật ("tên thú cưng đầu tiên?")</td></tr>
      <tr><td>Chỉ bắt đổi khi có bằng chứng bị lộ</td><td>Gợi ý mật khẩu (password hint) hiển thị cho mọi người</td></tr>
    </table>

    <div class="callout"><p>💡 Giới hạn độ dài tối đa hợp lý (ví dụ 128–1024 ký tự) vẫn cần — không phải để làm khó người dùng, mà để chặn ai đó gửi mật khẩu 10 MB khiến
    hàm hash chậm ngốn CPU (tấn công từ chối dịch vụ). Với bcrypt, nhớ giới hạn 72 byte: hoặc giới hạn độ dài, hoặc tiền xử lý bằng HMAC/SHA-256 rồi base64.</p></div>

    <div class="callout"><p>💡 Checklist review: có hash chậm + salt? thư viện chuẩn (không tự viết)? tham số đủ mạnh và có kế hoạch tăng? có rehash khi login?
    mật khẩu không xuất hiện trong log / message lỗi / analytics / response API? kiểm tra mật khẩu đã lộ khi đăng ký và đổi mật khẩu?</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Cách sai", lines: [
      "// 1. Plaintext — lộ DB là lộ mật khẩu",
      "db.insert('users', { email, password: req.password })",
      "",
      "// 2. Mã hoá hai chiều — có khoá là giải ngược được",
      "db.insert('users', { email, password: aesEncrypt(APP_KEY, req.password) })",
      "",
      "// 3. Hash nhanh, không salt — cùng mật khẩu ra cùng hash",
      "db.insert('users', { email, password: sha256(req.password) })",
      "",
      "// 4. Tự ghép salt + hash nhanh — vẫn quá nhanh với GPU",
      "salt = random(16)",
      "db.insert('users', { email, salt, password: sha256(salt + req.password) })",
      "",
      "// 5. Ghi mật khẩu ra log khi debug",
      "log.info('login attempt', req.body)   // body chứa password!"
    ]},
    { id: "good", label: "✅ Hash chậm + salt", lines: [
      "// Đăng ký",
      "function register(email, password):",
      "    if length(password) < 8 or length(password) > 256: reject(400)",
      "    if breachedPasswords.contains(password): reject(400, 'Mật khẩu đã từng bị lộ')",
      "    // Thư viện tự sinh salt ngẫu nhiên và nhúng vào chuỗi kết quả",
      "    hash = argon2id.hash(password, memory=19MiB, iterations=2, parallelism=1)",
      "    db.insert('users', { email, password_hash: hash })",
      "    // hash trông như: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>",
      "",
      "// Đăng nhập",
      "function login(email, password):",
      "    user = db.findUserByEmail(email)",
      "    ok = argon2id.verify(user.password_hash, password)  // so sánh thời gian hằng",
      "    if not ok: return fail()",
      "    return success(user)"
    ]},
    { id: "rehash", label: "🔁 Nâng cấp hash cũ", lines: [
      "CURRENT = { algo: 'argon2id', memory: 19MiB, iterations: 2 }",
      "",
      "function login(email, password):",
      "    user = db.findUserByEmail(email)",
      "    algo = detectAlgo(user.password_hash)   // đọc tiền tố $2b$, $argon2id$, legacy-md5...",
      "    if not verifyWith(algo, user.password_hash, password): return fail()",
      "",
      "    // Đang có mật khẩu gốc trong tay -> nâng cấp ngay nếu hash cũ/yếu",
      "    if algo != CURRENT.algo or needsRehash(user.password_hash, CURRENT):",
      "        db.update(user.id, { password_hash: argon2id.hash(password, CURRENT) })",
      "    return success(user)",
      "",
      "// User lâu không đăng nhập, hash MD5 cũ: bọc lớp ngay cho tất cả",
      "for u in db.usersWithAlgo('md5'):",
      "    db.update(u.id, { password_hash: 'wrapped:' + argon2id.hash(u.password_hash) })"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Node.js (thư viện argon2)",
      "const hash = await argon2.hash(pw, { type: argon2.argon2id }); const ok = await argon2.verify(hash, pw)",
      "",
      "# Python (argon2-cffi)",
      "ph = PasswordHasher(); h = ph.hash(pw); ph.verify(h, pw); ph.check_needs_rehash(h)",
      "",
      "# Java (Spring Security)",
      "PasswordEncoder enc = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8(); enc.matches(pw, hash)",
      "",
      "# Go (golang.org/x/crypto/bcrypt)",
      "h, _ := bcrypt.GenerateFromPassword([]byte(pw), 12); err := bcrypt.CompareHashAndPassword(h, []byte(pw))",
      "",
      "# PHP (có sẵn trong ngôn ngữ)",
      "$h = password_hash($pw, PASSWORD_ARGON2ID); password_verify($pw, $h); password_needs_rehash($h, PASSWORD_ARGON2ID)"
    ]},
    { id: "pepper", label: "🌶️ Pepper + so sánh", lines: [
      "// Pepper lấy từ secret manager, KHÔNG nằm trong DB",
      "PEPPER = secrets.get('password-pepper')",
      "",
      "function hashPassword(password):",
      "    peppered = hmacSha256(PEPPER, password)   // cũng giải quyết giới hạn 72 byte của bcrypt",
      "    return argon2id.hash(base64(peppered))",
      "",
      "function verifyPassword(stored, password):",
      "    return argon2id.verify(stored, base64(hmacSha256(PEPPER, password)))",
      "",
      "// Khi TỰ so sánh hai giá trị bí mật: dùng hàm thời gian hằng",
      "if expected == provided: ...            // ❌ dừng sớm ở byte khác đầu tiên",
      "if constantTimeEquals(expected, provided): ...   // ✅"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pw"><div class="nl">🔑 Mật khẩu người dùng nhập</div><div class="ns">chỉ tồn tại trong RAM, trong lúc xử lý request</div></div>
    <div class="arrow" id="a1">↓ kiểm tra độ dài + danh sách đã lộ</div>
    <div class="node" id="policy"><div class="nl">📏 Chính sách mật khẩu</div><div class="ns">≥ 8 ký tự · không nằm trong danh sách lộ · có giới hạn trên</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="salt"><div class="nl">🧂 Salt ngẫu nhiên</div><div class="ns">riêng từng user, CSPRNG</div></div>
      <div class="node" id="pepper"><div class="nl">🌶️ Pepper (tuỳ chọn)</div><div class="ns">bí mật chung, ở secret manager</div></div>
    </div>
    <div class="arrow" id="a3">↓ Argon2id / scrypt / bcrypt / PBKDF2</div>
    <div class="node" id="kdf"><div class="nl">🐢 Hàm hash chậm</div><div class="ns">tốn ms + MB RAM mỗi lần → đoán hàng loạt rất đắt</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="row">
      <div class="node" id="db"><div class="nl">🗄️ DB: password_hash</div><div class="ns">$argon2id$…$salt$hash — không có mật khẩu gốc</div></div>
      <div class="node" id="verify"><div class="nl">⚖️ Verify + rehash</div><div class="ns">so sánh thời gian hằng · nâng cấp khi cần</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Những cách lưu sai", tab: "bad", highlight: [2, 5, 8, 12], on: ["pw", "db"],
      desc: "Plaintext và mã hoá hai chiều đều trả lại được mật khẩu gốc. Hash nhanh (kể cả có salt) thì GPU đoán hàng tỉ lần mỗi giây. Đừng quên dòng 15: log cũng là nơi hay rò rỉ mật khẩu." },
    { title: "2 · Chính sách trước khi băm", tab: "good", highlight: [3, 4], on: ["pw", "a1", "policy"],
      desc: "Kiểm tra độ dài tối thiểu, giới hạn trên (chống DoS), và danh sách mật khẩu đã lộ. Không bắt buộc 'hoa + số + ký tự đặc biệt'." },
    { title: "3 · Salt + hash chậm", tab: "good", highlight: [5, 6, 7, 8], on: ["a2", "salt", "a3", "kdf", "a4", "db"],
      desc: "Thư viện Argon2id tự sinh salt, tự nhúng salt và tham số vào chuỗi kết quả. Bạn chỉ lưu một cột <code>password_hash</code>." },
    { title: "4 · Verify đúng cách", tab: "good", highlight: [11, 12, 13, 14], on: ["verify", "db"],
      desc: "Không giải mã gì cả: băm lại mật khẩu vừa nhập với cùng salt/tham số, so sánh thời gian hằng — hàm <code>verify</code> làm hết." },
    { title: "5 · Pepper và so sánh thời gian hằng", tab: "pepper", highlight: [2, 5, 6, 12, 13], on: ["pepper", "kdf"],
      desc: "Pepper nằm ngoài DB nên lộ riêng DB chưa đủ để đoán mật khẩu. Khi tự so sánh giá trị bí mật, dùng hàm constant-time thay vì <code>==</code>." },
    { title: "6 · Nâng cấp hash cũ khi đăng nhập", tab: "rehash", highlight: [5, 6, 9, 10, 14, 15], on: ["verify", "db"],
      desc: "Lúc đăng nhập thành công là lúc duy nhất có mật khẩu gốc → băm lại theo chuẩn mới. User không đăng nhập thì bọc lớp hash cũ bằng Argon2id." },
    { title: "7 · Ngôn ngữ nào cũng có sẵn", tab: "langs", highlight: [2, 5, 8, 11, 14], on: ["kdf", "verify"],
      desc: "Không tự viết thuật toán. Mọi hệ sinh thái đều có thư viện chuẩn với hàm hash, verify và kiểm tra cần rehash." }
  ],

  quiz: [
    { q: "Vì sao KHÔNG nên lưu mật khẩu bằng mã hoá AES?", options: [
        "Vì AES đã bị phá",
        "Vì mã hoá là hai chiều: ai có khoá (thường nằm cạnh app) là giải ra toàn bộ mật khẩu gốc",
        "Vì AES chạy quá chậm",
        "Vì AES không hỗ trợ tiếng Việt"
      ], correct: 1,
      explanation: "Server không cần mật khẩu gốc sau khi đăng ký. Hash một chiều đảm bảo kể cả server cũng không lấy lại được." },
    { q: "SHA-256 là hàm hash an toàn về mặt mật mã. Vì sao vẫn không phù hợp để lưu mật khẩu?", options: [
        "Vì nó quá nhanh — GPU tính hàng tỉ lần/giây nên đoán mật khẩu phổ biến rất rẻ",
        "Vì nó cho ra kết quả quá dài",
        "Vì nó không chạy được trên Linux",
        "Vì nó là hàm hai chiều"
      ], correct: 0,
      explanation: "Hash nhanh được thiết kế cho tốc độ (checksum, chữ ký). Lưu mật khẩu cần hàm cố tình chậm và tốn tài nguyên." },
    { q: "Salt giải quyết vấn đề gì?", options: [
        "Giúp hash chạy nhanh hơn",
        "Làm mật khẩu ngắn trở thành dài",
        "Hai user cùng mật khẩu có hash khác nhau, vô hiệu bảng tính sẵn, buộc đoán riêng từng tài khoản",
        "Giữ bí mật mật khẩu khi truyền qua mạng"
      ], correct: 2,
      explanation: "Salt ngẫu nhiên riêng từng user. Nó không cần bí mật và được lưu cùng hash." },
    { q: "Thuật toán nào được OWASP khuyến nghị ưu tiên cho hệ thống mới?", options: [
        "MD5 hai lần",
        "SHA-512",
        "Base64",
        "Argon2id"
      ], correct: 3,
      explanation: "Argon2id là memory-hard, khó tăng tốc bằng GPU/ASIC. scrypt, bcrypt, PBKDF2 là các lựa chọn tiếp theo." },
    { q: "Pepper khác salt ở điểm nào?", options: [
        "Pepper là bí mật chung của hệ thống, lưu ngoài DB (secret manager); salt riêng từng user và lưu cùng hash",
        "Pepper thay thế được salt",
        "Pepper phải lưu trong cột riêng của bảng users",
        "Không khác gì, chỉ là tên gọi"
      ], correct: 0,
      explanation: "Pepper bảo vệ trường hợp chỉ DB bị lộ. Nó là lớp thêm, không thay thế hash chậm + salt." },
    { q: "Hệ thống cũ lưu mật khẩu bằng MD5. Cách nâng cấp hợp lý là gì?", options: [
        "Giải mã MD5 rồi băm lại bằng Argon2id",
        "Giữ nguyên vì đổi thì phức tạp",
        "Khi user đăng nhập thành công thì băm lại bằng Argon2id; với user không đăng nhập thì bọc lớp argon2id(md5_cũ) hoặc bắt đặt lại",
        "Xoá toàn bộ tài khoản"
      ], correct: 2,
      explanation: "Hash không giải ngược được. Lúc đăng nhập là lúc duy nhất server có mật khẩu gốc; bọc lớp giúp bảo vệ ngay cả những tài khoản chưa đăng nhập lại." },
    { q: "Vì sao so sánh bí mật bằng '==' có thể nguy hiểm?", options: [
        "Vì '==' không so sánh được chuỗi",
        "Vì '==' dừng ở byte khác đầu tiên, thời gian phản hồi tiết lộ độ dài phần trùng khớp",
        "Vì '==' luôn trả về true",
        "Vì '==' làm lộ salt"
      ], correct: 1,
      explanation: "Đó là timing side-channel. Dùng timingSafeEqual / compare_digest / MessageDigest.isEqual. Hàm verify của thư viện hash đã làm sẵn." },
    { q: "Theo NIST SP 800-63B, chính sách nào KHÔNG còn được khuyến nghị?", options: [
        "Kiểm tra mật khẩu với danh sách đã lộ",
        "Cho phép mật khẩu dài và dán từ password manager",
        "Độ dài tối thiểu 8 ký tự",
        "Bắt đổi mật khẩu định kỳ mỗi 90 ngày dù không có dấu hiệu lộ"
      ], correct: 3,
      explanation: "Đổi định kỳ khiến người dùng đặt mật khẩu dễ đoán theo mẫu (Matkhau1 → Matkhau2). Chỉ bắt đổi khi có bằng chứng bị lộ." },
    { q: "Vì sao vẫn nên đặt giới hạn độ dài tối đa (ví dụ 256 ký tự) cho mật khẩu?", options: [
        "Để tiết kiệm dung lượng DB",
        "Để người dùng dễ nhớ",
        "Để tránh request mật khẩu cực dài khiến hàm hash chậm ngốn CPU (từ chối dịch vụ)",
        "Vì Argon2id không nhận chuỗi dài hơn 16 ký tự"
      ], correct: 2,
      explanation: "Hash đã có độ dài cố định nên DB không phình. Giới hạn trên chỉ để chống lạm dụng tài nguyên; mức 64+ ký tự vẫn phải được cho phép." },
    { q: "bcrypt có giới hạn đặc biệt nào cần lưu ý?", options: [
        "Chỉ dùng 72 byte đầu của mật khẩu",
        "Không hỗ trợ salt",
        "Không có tham số cost",
        "Chỉ chạy được trên Windows"
      ], correct: 0,
      explanation: "Phần sau byte 72 bị bỏ qua. Giới hạn độ dài hoặc tiền xử lý bằng HMAC-SHA256 + base64 trước khi đưa vào bcrypt." }
  ]
});
