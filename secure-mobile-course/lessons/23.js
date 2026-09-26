window.LESSONS.push({
  id: "23",
  phase: "6", phaseName: "Phát hành & vận hành",
  title: "Kiểm thử bảo mật mobile & checklist MASVS (tổng kết)",
  subtitle: "Tĩnh · động · thủ công · tự động trong CI · checklist theo 8 nhóm MASVS · ôn tập toàn khoá",

  theory: `
    <p>Bài cuối gom toàn bộ khoá học thành <strong>một quy trình kiểm thử</strong> và <strong>một checklist</strong> bạn có thể dùng cho mọi app, mọi nền tảng.
    Mục tiêu không phải biến bạn thành pentester chuyên nghiệp, mà là để đội phát triển tự bắt được phần lớn lỗi phổ biến <em>trước khi</em> app đến tay người dùng.</p>

    <p><strong>1. Ba loại kiểm thử bổ sung cho nhau</strong></p>
    <table>
      <tr><th>Loại</th><th>Làm gì</th><th>Bắt được</th><th>Công cụ ví dụ</th></tr>
      <tr><td><strong>Tĩnh (SAST)</strong></td><td>Phân tích source/gói mà không chạy</td><td>Secret trong code, TrustManager rỗng, cleartext, exported, log nhạy cảm, API mật mã yếu</td><td>MobSF, semgrep (rule mobile), Android Lint, gitleaks</td></tr>
      <tr><td><strong>Động (DAST)</strong></td><td>Chạy app, quan sát lưu trữ, mạng, IPC</td><td>Token plaintext trên đĩa, dữ liệu trong backup/cache, request lộ dữ liệu, deep link nguy hiểm</td><td>Proxy HTTP trên máy test, trình xem file sandbox trên emulator/máy test, MobSF dynamic</td></tr>
      <tr><td><strong>Kiểm tra API phía server</strong></td><td>Gọi API trực tiếp như kẻ tấn công có token hợp lệ</td><td>Thiếu phân quyền đối tượng, tin giá client gửi, thiếu rate limit</td><td>Bộ test API tự động, test phân quyền</td></tr>
    </table>
    <p>Kiểm thử động nên chạy trên <strong>emulator hoặc máy test chuyên dụng</strong> với bản build của chính đội — không bao giờ trên máy cá nhân chứa dữ liệu thật.</p>

    <p><strong>2. Quy trình gợi ý</strong></p>
    <ol>
      <li><strong>Threat model</strong> cho tính năng mới (bài 01) — xác định tài sản và rủi ro trước khi code.</li>
      <li><strong>Review code</strong> theo checklist MASVS (bên dưới).</li>
      <li><strong>CI tự động</strong>: SAST, quét secret, quét dependency, kiểm tra artefact (bài 02, 17, 20, 21).</li>
      <li><strong>Kiểm thử động</strong> trước mỗi bản phát hành lớn: dùng app như người dùng, rồi kiểm tra sandbox, log, backup, traffic.</li>
      <li><strong>Test API</strong>: bộ test tự động cho phân quyền (user A không đọc được dữ liệu user B).</li>
      <li><strong>Pentest độc lập</strong> định kỳ cho app rủi ro cao (tài chính, y tế), đối chiếu với MASVS/MASTG.</li>
      <li><strong>Sau phát hành</strong>: kênh nhận báo cáo lỗ hổng (security.txt, email bảo mật), theo dõi bất thường, quy trình phản ứng sự cố.</li>
    </ol>

    <p><strong>3. Checklist theo 8 nhóm MASVS — tóm tắt toàn khoá</strong></p>
    <table>
      <tr><th>Nhóm</th><th>Câu hỏi kiểm tra</th><th>Bài</th></tr>
      <tr><td>STORAGE</td><td>Token/bí mật chỉ trong Keychain/Keystore? DB nhạy cảm mã hoá? Không có dữ liệu nhạy cảm trong log, clipboard, ảnh app switcher, backup, cache, crash report?</td><td>04, 06, 07</td></tr>
      <tr><td>CRYPTO</td><td>Khoá sinh trong phần cứng, không viết cứng? AES-GCM với IV ngẫu nhiên? Không tự chế thuật toán?</td><td>05, 07</td></tr>
      <tr><td>AUTH</td><td>OAuth dùng PKCE + system browser? Sinh trắc học gắn khoá mật mã? Access token ngắn hạn, refresh rotation, logout thu hồi ở server?</td><td>11, 12, 13</td></tr>
      <tr><td>NETWORK</td><td>Chỉ HTTPS, không cleartext? Không TrustManager/delegate bỏ qua kiểm tra? Pinning (nếu có) có backup pin và kế hoạch rotation?</td><td>08, 09</td></tr>
      <tr><td>PLATFORM</td><td>Deep link verified, validate tham số, không tự hành động? Component exported tối thiểu, PendingIntent immutable? WebView allowlist, bridge tối thiểu?</td><td>14, 15, 16</td></tr>
      <tr><td>CODE</td><td>Không secret trong gói? Dependency khoá phiên bản, quét CVE? OTA có ký? Không nạp code động? Build release sạch debug?</td><td>17, 19, 20, 21</td></tr>
      <tr><td>RESILIENCE</td><td>Obfuscation bật? Tín hiệu toàn vẹn/root gửi về server kèm attestation? Không dùng lớp làm chậm thay kiểm tra server?</td><td>18, 10</td></tr>
      <tr><td>PRIVACY</td><td>Quyền tối thiểu? Khai báo store khớp thực tế (kể cả SDK)? Consent, xoá tài khoản trong app?</td><td>20, 22</td></tr>
    </table>

    <p><strong>4. Kiểm thử động — những gì cần nhìn</strong></p>
    <ul>
      <li><strong>Lưu trữ</strong>: sau khi đăng nhập và dùng các tính năng, xem thư mục dữ liệu của app trên emulator test: prefs, DB, cache, file tạm có chứa token/PII dạng rõ không?</li>
      <li><strong>Logout</strong>: sau khi đăng xuất, dữ liệu trên có bị xoá không? Token cũ gọi API còn được không?</li>
      <li><strong>Log</strong>: xem log hệ thống trong khi dùng app bản release.</li>
      <li><strong>Mạng</strong>: qua proxy test, có request HTTP thường không? Response có trả dữ liệu thừa không? App có từ chối chứng chỉ không hợp lệ không (với cấu hình release)?</li>
      <li><strong>Nền</strong>: ảnh trong app switcher của màn hình nhạy cảm có bị che không?</li>
      <li><strong>IPC</strong>: liệt kê component exported, thử mở deep link với tham số không hợp lệ — app có về màn hình chính an toàn không?</li>
    </ul>

    <p><strong>5. Viết test để lỗi không quay lại</strong></p>
    <ul>
      <li>Unit test cho router deep link: tham số sai → trang chủ.</li>
      <li>Instrumented test/UI test: sau logout, secure storage rỗng.</li>
      <li>Test cấu hình: manifest release không có <code>debuggable</code>, <code>usesCleartextTraffic</code>; Info.plist không có <code>NSAllowsArbitraryLoads</code>.</li>
      <li>Test API: user A gọi tài nguyên của user B → 403/404.</li>
    </ul>

    <div class="callout"><p>💡 Tóm tắt cả khoá trong ba câu: <strong>(1) Server là nơi duy nhất ra quyết định</strong> — client có thể bị đọc, sửa, giả.
    <strong>(2) Trên thiết bị, bảo vệ dữ liệu người dùng bằng công cụ của OS</strong> — Keychain/Keystore, sandbox, HTTPS mặc định, system browser — và đừng tự đục lỗ chúng.
    <strong>(3) Kiểm tra artefact thật, tự động hoá trong CI</strong> — để bảo mật không phụ thuộc vào trí nhớ.</p></div>
  `,

  codeTabs: [
    { id: "ci", label: "🤖 Pipeline CI", lines: [
      "# .ci/security.yml (pseudo) — chạy mỗi merge request và mỗi bản release",
      "stages: [static, deps, build, artefact]",
      "",
      "static:",
      "  - gitleaks detect --redact                       # secret trong repo",
      "  - semgrep --config p/android --config p/ios --config p/react-native",
      "  - ./gradlew lintRelease                          # Android Lint (bảo mật)",
      "deps:",
      "  - osv-scanner --recursive .                       # CVE trong dependency",
      "build:",
      "  - build release (CI sạch, ký bằng secret CI)",
      "artefact:",
      "  - mobsf-scan app-release.apk                      # SAST trên gói",
      "  - ./scripts/check-manifest.sh app-release.apk     # debuggable/cleartext/exported",
      "  - ./scripts/check-no-maps.sh app-release.apk      # không có .map/.env",
      "  - fail nếu có phát hiện mức HIGH chưa được chấp nhận"
    ]},
    { id: "dynamic", label: "🔬 Kiểm thử động", lines: [
      "# Trên emulator test với bản build của đội (không dùng máy cá nhân)",
      "",
      "1. Đăng nhập, dùng các tính năng chính",
      "2. Lưu trữ: xem thư mục dữ liệu app -> prefs/DB/cache có token, PII dạng rõ?",
      "3. Log: theo dõi log hệ thống trong lúc dùng bản release -> có token/PII?",
      "4. Mạng: qua proxy test -> có http://? response có dữ liệu thừa?",
      "5. Nền: mở app switcher trên màn hình OTP/số dư -> có bị che?",
      "6. Deep link: mở route với tham số sai định dạng -> về trang chủ an toàn?",
      "7. Logout: dữ liệu cục bộ bị xoá? token cũ gọi API -> 401?",
      "8. Backup: tạo bản backup -> có chứa file nhạy cảm đã loại trừ?"
    ]},
    { id: "tests", label: "🧪 Test tự động", lines: [
      "// Router deep link (unit test, pseudo)",
      "test('tham số sai -> trang chủ'):",
      "    assert handleDeepLink('https://shop.com/product/abc') == HOME",
      "    assert handleDeepLink('https://evil.example/product/1') == HOME",
      "",
      "// Logout (instrumented test)",
      "test('logout xoá sạch'):",
      "    login(); logout()",
      "    assert secureStore.isEmpty() and not dbFile.exists()",
      "",
      "// API phân quyền (test server)",
      "test('user A không đọc đơn của user B'):",
      "    res = GET('/orders/' + orderOfB.id, token=tokenOfA)",
      "    assert res.status in (403, 404)"
    ]},
    { id: "checklist", label: "📋 Checklist release", lines: [
      "STORAGE    [ ] bí mật trong Keychain/Keystore  [ ] DB nhạy cảm mã hoá  [ ] loại trừ backup",
      "           [ ] không log bí mật  [ ] che app switcher  [ ] scrub crash/analytics",
      "CRYPTO     [ ] khoá phần cứng, không viết cứng  [ ] AES-GCM IV ngẫu nhiên",
      "AUTH       [ ] PKCE + system browser  [ ] sinh trắc học crypto-bound",
      "           [ ] token ngắn hạn + rotation  [ ] logout thu hồi ở server",
      "NETWORK    [ ] không cleartext  [ ] không bỏ qua kiểm tra chứng chỉ  [ ] pin có backup",
      "PLATFORM   [ ] deep link verified + validate  [ ] exported tối thiểu  [ ] WebView allowlist",
      "CODE       [ ] không secret  [ ] lockfile + quét CVE  [ ] OTA có ký  [ ] release sạch debug",
      "RESILIENCE [ ] obfuscation  [ ] tín hiệu -> server + attestation",
      "PRIVACY    [ ] quyền tối thiểu  [ ] khai báo store đúng  [ ] consent  [ ] xoá tài khoản"
    ]},
    { id: "response", label: "🚨 Sau phát hành", lines: [
      "# Nhận báo cáo",
      "https://shop.com/.well-known/security.txt",
      "Contact: mailto:security@shop.com",
      "Policy:  https://shop.com/security-policy",
      "",
      "# Khi có lỗ hổng",
      "1. Đánh giá mức độ, phạm vi phiên bản bị ảnh hưởng (dùng SBOM)",
      "2. Giảm thiểu phía server trước (tắt tính năng, thu hồi token, rotate key)",
      "3. Phát hành bản sửa; cân nhắc bắt buộc cập nhật với lỗi nghiêm trọng",
      "4. Viết test hồi quy, cập nhật checklist để lỗi không quay lại"
    ]}
  ],

  stageHtml: `
    <div class="node" id="design"><div class="nl">🗺️ Threat model</div><div class="ns">tài sản · tác nhân · bề mặt</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="review"><div class="nl">👀 Review theo MASVS</div><div class="ns">8 nhóm câu hỏi</div></div>
      <div class="node" id="sast"><div class="nl">🤖 CI: SAST · secret · CVE</div><div class="ns">tự động mỗi merge</div></div>
    </div>
    <div class="arrow" id="a2">↓ build release</div>
    <div class="row">
      <div class="node" id="artefact"><div class="nl">📦 Kiểm tra artefact</div><div class="ns">manifest · plist · file thừa</div></div>
      <div class="node" id="dast"><div class="nl">🔬 Kiểm thử động</div><div class="ns">lưu trữ · log · mạng · IPC</div></div>
      <div class="node" id="api"><div class="nl">🖥️ Test API</div><div class="ns">phân quyền · rate limit</div></div>
    </div>
    <div class="arrow" id="a3">↓ phát hành</div>
    <div class="node" id="ops"><div class="nl">🚨 Vận hành</div><div class="ns">security.txt · giám sát · phản ứng sự cố · test hồi quy</div></div>
  `,

  steps: [
    { title: "1 · Bắt đầu từ threat model", tab: "checklist", highlight: [1, 4, 7], on: ["design", "a1"],
      desc: "Mỗi tính năng mới bắt đầu bằng câu hỏi: bảo vệ gì, ai tấn công, qua đâu. Checklist MASVS biến câu trả lời thành việc cụ thể." },
    { title: "2 · Review theo 8 nhóm", tab: "checklist", highlight: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], on: ["review"],
      desc: "STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE, PRIVACY — mỗi nhóm tương ứng một phần của khoá học." },
    { title: "3 · Tự động hoá trong CI", tab: "ci", highlight: [5, 6, 7, 9, 13, 14, 15, 16], on: ["sast", "a2", "artefact"],
      desc: "Quét secret, SAST, CVE mỗi merge request; kiểm tra artefact release; chặn phát hành khi có phát hiện mức cao chưa xử lý." },
    { title: "4 · Kiểm thử động", tab: "dynamic", highlight: [1, 4, 5, 6, 7, 8, 9, 10], on: ["dast"],
      desc: "Trên emulator test: xem sandbox, log, traffic, app switcher, deep link, logout, backup — những lỗi mà đọc code dễ bỏ sót." },
    { title: "5 · Test để lỗi không quay lại", tab: "tests", highlight: [3, 4, 9, 12, 13], on: ["api", "dast"],
      desc: "Mỗi lỗi đã sửa thành một test: router deep link, logout xoá sạch, phân quyền API giữa hai user." },
    { title: "6 · Sau phát hành", tab: "response", highlight: [2, 3, 7, 8, 9, 10], on: ["a3", "ops"],
      desc: "Có kênh nhận báo cáo, dùng SBOM đánh giá phạm vi, giảm thiểu phía server trước, phát hành bản sửa và thêm test hồi quy." }
  ],

  quiz: [
    { q: "Kiểm thử tĩnh (SAST) phù hợp nhất để bắt lỗi nào?", options: [
        "Token lưu plaintext chỉ xuất hiện sau khi đăng nhập",
        "TrustManager rỗng, secret viết cứng, component exported trong code/manifest",
        "Thiếu phân quyền đối tượng trên server đang chạy",
        "Ảnh app switcher không bị che"
      ], correct: 1,
      explanation: "SAST đọc code/gói; các lỗi phụ thuộc hành vi lúc chạy cần kiểm thử động." },
    { q: "Kiểm thử động nên chạy trên thiết bị nào?", options: [
        "Máy cá nhân chứa dữ liệu thật",
        "Emulator hoặc máy test chuyên dụng với bản build của đội",
        "Máy của khách hàng",
        "Không cần thiết bị"
      ], correct: 1,
      explanation: "Tách biệt môi trường test khỏi dữ liệu thật." },
    { q: "Sau logout, dùng lại access token cũ gọi API vẫn thành công trong nhiều giờ. Nhóm MASVS nào có vấn đề?", options: [
        "NETWORK",
        "AUTH",
        "PRIVACY",
        "RESILIENCE"
      ], correct: 1,
      explanation: "Vòng đời phiên: token phải ngắn hạn và logout phải thu hồi ở server (bài 13)." },
    { q: "Tìm thấy file .map trong gói release. Thuộc nhóm nào và xử lý ra sao?", options: [
        "STORAGE — mã hoá file",
        "CODE — loại khỏi gói, upload riêng tư lên hệ thống crash, thêm kiểm tra artefact trong CI",
        "NETWORK — bật pinning",
        "Không cần xử lý"
      ], correct: 1,
      explanation: "Kiểm tra artefact tự động ngăn lỗi này lặp lại (bài 21)." },
    { q: "Nguyên tắc số một xuyên suốt khoá học?", options: [
        "Obfuscate mọi thứ",
        "Server là nơi duy nhất ra quyết định; client có thể bị đọc, sửa, giả",
        "Chỉ dùng iOS",
        "Không dùng thư viện bên thứ ba"
      ], correct: 1,
      explanation: "Mọi kiểm soát quan trọng phải ở server; client chỉ là giao diện." },
    { q: "Refresh token lưu trong AsyncStorage. Nhóm và cách sửa?", options: [
        "NETWORK — dùng HTTPS",
        "STORAGE — chuyển sang secure storage dựa trên Keychain/Keystore",
        "PRIVACY — thêm consent",
        "RESILIENCE — bật Hermes"
      ], correct: 1,
      explanation: "AsyncStorage là plaintext (bài 04)." },
    { q: "Deep link 'shop.com/transfer?to=..&amount=..' tự chuyển tiền. Nhóm và cách sửa?", options: [
        "PLATFORM — link chỉ mở màn hình điền sẵn; người dùng xác nhận + xác thực",
        "CRYPTO — mã hoá tham số",
        "NETWORK — pin chứng chỉ",
        "CODE — obfuscate router"
      ], correct: 0,
      explanation: "Link là input không đáng tin; không được tự thực hiện hành động nhạy cảm (bài 14)." },
    { q: "Đăng nhập vân tay chỉ dựa vào callback boolean. Cách sửa?", options: [
        "Thêm root detection",
        "Gắn sinh trắc học với khoá mật mã (CryptoObject / Keychain access control)",
        "Hiện prompt hai lần",
        "Lưu token trong UserDefaults"
      ], correct: 1,
      explanation: "Bí mật chỉ giải mã được bên trong lần xác thực thật (bài 12)." },
    { q: "Test API nào quan trọng nhất cần tự động hoá cho app mobile?", options: [
        "Test tốc độ phản hồi",
        "User A dùng token của mình truy cập tài nguyên của user B phải bị từ chối",
        "Test giao diện",
        "Test font chữ"
      ], correct: 1,
      explanation: "Thiếu phân quyền đối tượng là lỗi API phổ biến và nghiêm trọng." },
    { q: "Code có onReceivedSslError gọi handler.proceed(). Nhóm và hậu quả?", options: [
        "PLATFORM/NETWORK — WebView chấp nhận chứng chỉ không hợp lệ, kẻ MITM đọc/sửa được nội dung",
        "PRIVACY — thiếu consent",
        "STORAGE — lộ backup",
        "Không có hậu quả"
      ], correct: 0,
      explanation: "Lỗi SSL phải cancel() (bài 08, 16)." },
    { q: "API key AI trả phí nằm trong bundle JS. Nhóm và cách sửa?", options: [
        "RESILIENCE — obfuscate kỹ hơn",
        "CODE — chuyển key về backend proxy, rotate key đã lộ",
        "PRIVACY — cập nhật Data Safety",
        "NETWORK — pin chứng chỉ"
      ], correct: 1,
      explanation: "Không giấu được secret trong app (bài 17)." },
    { q: "Phát hiện lỗ hổng nghiêm trọng trong bản đang lưu hành. Bước đầu tiên nên là?", options: [
        "Chờ bản phát hành định kỳ",
        "Đánh giá phạm vi (SBOM, phiên bản) và giảm thiểu phía server ngay (tắt tính năng, thu hồi token, rotate key)",
        "Gỡ app khỏi store vĩnh viễn",
        "Không làm gì nếu chưa bị khai thác"
      ], correct: 1,
      explanation: "Server là nơi bạn kiểm soát tức thì; bản sửa app cần thời gian để đến người dùng." },
    { q: "Ảnh app switcher của màn hình số dư không bị che. Nhóm và cách sửa?", options: [
        "STORAGE — FLAG_SECURE (Android) / phủ view che khi vào nền (iOS)",
        "AUTH — thêm OTP",
        "CODE — bật R8",
        "NETWORK — HTTPS"
      ], correct: 0,
      explanation: "Rò rỉ ngoài ý muốn qua ảnh chụp hệ thống (bài 06)." }
  ]
});
