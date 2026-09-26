window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Giao tiếp mạng",
  title: "Certificate / Public-key pinning",
  subtitle: "Khi nào nên pin · pin cái gì · backup pin · xoay vòng khoá · rủi ro 'khoá cứng' app",

  theory: `
    <p>Bài 08: app tin <em>bất kỳ</em> chứng chỉ nào do một CA hệ thống ký cho đúng hostname. Có hàng trăm CA như vậy.
    Nếu một CA bị xâm nhập hoặc cấp nhầm chứng chỉ cho domain của bạn, hoặc thiết bị bị cài CA lạ (MDM doanh nghiệp, malware có quyền cao),
    thì kẻ giữ chứng chỉ đó có thể đứng giữa. <strong>Pinning</strong> thu hẹp danh sách: "với <code>api.shop.com</code>, tôi chỉ tin <em>khoá này</em>".</p>

    <p><strong>1. Pin cái gì?</strong></p>
    <table>
      <tr><th>Lựa chọn</th><th>Ưu</th><th>Nhược</th></tr>
      <tr><td>Toàn bộ chứng chỉ lá (leaf certificate)</td><td>Chặt nhất</td><td>Chứng chỉ gia hạn (thường 90 ngày – 1 năm) là app hỏng</td></tr>
      <tr><td><strong>Public key (SPKI hash) của leaf</strong></td><td>Gia hạn chứng chỉ mà giữ nguyên khoá thì vẫn chạy</td><td>Phải chủ động giữ khoá khi gia hạn</td></tr>
      <tr><td>Public key của CA trung gian</td><td>Ít phải đổi; đổi leaf thoải mái</td><td>Tin mọi chứng chỉ CA đó cấp cho domain của bạn</td></tr>
    </table>
    <p>Khuyến nghị phổ biến: <strong>pin SPKI hash</strong> (sha256 của public key), luôn kèm <strong>ít nhất một backup pin</strong>.</p>

    <p><strong>2. Backup pin và rotation — phần quan trọng nhất</strong></p>
    <ul>
      <li>Backup pin là hash của một cặp khoá <em>dự phòng</em> bạn đã sinh sẵn, cất an toàn (offline), <em>chưa dùng</em> trên server.</li>
      <li>Khi khoá chính bị lộ hoặc cần đổi: chuyển server sang khoá dự phòng → app cũ vẫn chạy vì đã có pin dự phòng.</li>
      <li>Quy trình rotation: (1) phát hành app có pin <code>{A, B}</code>; (2) chờ đa số người dùng cập nhật; (3) server chuyển A → B;
        (4) phát hành app có pin <code>{B, C}</code> với C là dự phòng mới.</li>
      <li>Đặt <strong>ngày hết hạn pin</strong> (Android: thuộc tính <code>expiration</code>): quá ngày đó app quay về kiểm tra chứng chỉ bình thường — tránh app cũ bị "chết" vĩnh viễn.</li>
    </ul>

    <p><strong>3. Rủi ro lớn nhất của pinning: tự khoá mình ngoài cửa</strong></p>
    <ul>
      <li>Đội hạ tầng đổi nhà cung cấp CDN/chứng chỉ mà không biết app có pin → <strong>mọi app đang cài mất kết nối</strong> tới khi người dùng cập nhật (có người không bao giờ cập nhật).</li>
      <li>Vì vậy: pinning phải có chủ sở hữu rõ ràng, có tài liệu, có trong checklist thay đổi hạ tầng, có giám sát tỉ lệ lỗi pin.</li>
      <li>Một số nền tảng/CA hiện khuyến cáo <em>không</em> pin cho app thông thường, vì rủi ro vận hành lớn hơn lợi ích. Hãy cân nhắc thật.</li>
    </ul>

    <p><strong>4. Khi nào nên pin?</strong></p>
    <ul>
      <li><strong>Nên cân nhắc</strong>: app ngân hàng, ví, y tế, app doanh nghiệp xử lý dữ liệu nhạy cao; đối tượng người dùng có nguy cơ bị giám sát mạng.</li>
      <li><strong>Thường không cần</strong>: app nội dung công khai, app thương mại thông thường — HTTPS đúng chuẩn (bài 08) là đủ.</li>
      <li>Chỉ pin <strong>domain bạn kiểm soát</strong>. Không pin domain bên thứ ba (SDK analytics, CDN ảnh công cộng) — họ đổi chứng chỉ là app bạn hỏng.</li>
    </ul>

    <p><strong>5. Giới hạn: pinning không chống được chủ thiết bị</strong></p>
    <p>Trên máy root/jailbreak, người dùng có thể hook hàm kiểm tra pin để vô hiệu hoá nó và đọc traffic của chính họ. Pinning bảo vệ người dùng khỏi <em>bên thứ ba</em>,
    không giấu được API khỏi người phân tích. Vì vậy vẫn phải thiết kế API không tin client (bài 10).</p>

    <p><strong>6. Cách triển khai theo nền tảng</strong></p>
    <ul>
      <li><strong>Android</strong>: khai báo trong Network Security Config (<code>&lt;pin-set&gt;</code>) — không cần code; hoặc OkHttp <code>CertificatePinner</code>.</li>
      <li><strong>iOS</strong>: từ iOS 14 có khai báo <code>NSPinnedDomains</code> trong ATS (Info.plist); hoặc tự đánh giá trong <code>URLSessionDelegate</code> (kiểm tra trust chuẩn <em>trước</em>, rồi so SPKI).</li>
      <li><strong>React Native / Flutter</strong>: thư viện pinning (ví dụ react-native-ssl-public-key-pinning, http_certificate_pinning) hoặc dùng cấu hình native ở trên (áp dụng cho mọi request đi qua stack native).</li>
    </ul>

    <div class="callout"><p>💡 Pinning là <strong>thêm</strong> một kiểm tra, không <strong>thay</strong> kiểm tra chuẩn. Luôn để OS xác minh chuỗi chứng chỉ + hostname trước,
    rồi mới so pin. Code pinning tự viết mà bỏ bước chuẩn thường còn tệ hơn không pin.</p></div>
  `,

  codeTabs: [
    { id: "nsc", label: "🤖 Android: pin-set", lines: [
      "<network-security-config>",
      "  <domain-config cleartextTrafficPermitted=\"false\">",
      "    <domain includeSubdomains=\"false\">api.shop.com</domain>",
      "    <pin-set expiration=\"2027-06-30\">",
      "      <pin digest=\"SHA-256\"><!-- khoá đang dùng --><hash_A_base64></pin>",
      "      <pin digest=\"SHA-256\"><!-- khoá dự phòng, cất offline --><hash_B_base64></pin>",
      "    </pin-set>",
      "  </domain-config>",
      "</network-security-config>",
      "",
      "// Hoặc OkHttp",
      "CertificatePinner.Builder()",
      "    .add(\"api.shop.com\", \"sha256/<hash_A>\", \"sha256/<hash_B>\")",
      "    .build()"
    ]},
    { id: "ios", label: "🍎 iOS: NSPinnedDomains", lines: [
      "<!-- Info.plist (iOS 14+) -->",
      "<key>NSAppTransportSecurity</key><dict>",
      "  <key>NSPinnedDomains</key><dict>",
      "    <key>api.shop.com</key><dict>",
      "      <key>NSIncludesSubdomains</key><false/>",
      "      <key>NSPinnedLeafIdentities</key><array>",
      "        <dict><key>SPKI-SHA256-BASE64</key><string><hash_A></string></dict>",
      "        <dict><key>SPKI-SHA256-BASE64</key><string><hash_B></string></dict>",
      "      </array>",
      "    </dict>",
      "  </dict>",
      "</dict>"
    ]},
    { id: "manual", label: "🧩 Tự kiểm (đúng thứ tự)", lines: [
      "// Pseudo-code cho delegate/interceptor tự viết",
      "onServerTrustChallenge(trust, host):",
      "    // BƯỚC 1: kiểm tra chuẩn của OS (chuỗi CA + hostname + hạn)",
      "    if not systemEvaluate(trust, host): return REJECT",
      "",
      "    // BƯỚC 2: so pin trên bất kỳ chứng chỉ nào trong chuỗi đã xác minh",
      "    for cert in trust.chain:",
      "        if sha256(cert.subjectPublicKeyInfo) in PINS[host]: return ACCEPT",
      "",
      "    report('pin_failure', host)      // giám sát, không gửi dữ liệu nhạy cảm",
      "    return REJECT"
    ]},
    { id: "rotate", label: "🔁 Rotation", lines: [
      "# Chuẩn bị",
      "Sinh sẵn khoá B (dự phòng) -> cất offline (HSM/két), chỉ đưa hash B vào app",
      "",
      "# v1.0   app pin {A, B}           server dùng A",
      "# ...    chờ >95% người dùng lên v1.0 (theo dõi analytics phiên bản)",
      "# Đổi    server chuyển sang B      app v1.0 vẫn chạy nhờ pin B",
      "# v1.5   app pin {B, C}           C là dự phòng mới, sinh sẵn",
      "",
      "# Luôn có: expiration cho pin-set, giám sát tỉ lệ pin_failure,",
      "#          checklist hạ tầng ghi rõ 'domain này đang bị app pin'"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// React Native (react-native-ssl-public-key-pinning)",
      "await initializeSslPinning({",
      "  'api.shop.com': { includeSubdomains: false,",
      "                    publicKeyHashes: ['<hash_A>', '<hash_B>'] },",
      "})",
      "",
      "// Flutter: dùng SecurityContext/HttpClient tuỳ chỉnh hoặc thư viện pinning",
      "// -> luôn giữ kiểm tra chuẩn, KHÔNG dùng badCertificateCallback để 'pin'",
      "",
      "// Cách đơn giản nhất cho cả hai: khai báo pin ở tầng native",
      "// (Network Security Config / NSPinnedDomains) nếu request đi qua stack native"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">kết nối api.shop.com</div></div>
    <div class="arrow" id="a1">↓ bắt tay TLS</div>
    <div class="node" id="std"><div class="nl">✅ Kiểm tra chuẩn</div><div class="ns">CA hệ thống + hostname + hạn</div></div>
    <div class="arrow" id="a2">↓ đạt</div>
    <div class="node" id="pin"><div class="nl">📌 So pin SPKI</div><div class="ns">{hash A (đang dùng), hash B (dự phòng)}</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">🟢 Khớp</div><div class="ns">gửi request</div></div>
      <div class="node" id="fail"><div class="nl">🔴 Không khớp</div><div class="ns">từ chối + báo cáo pin_failure</div></div>
    </div>
    <div class="arrow" id="a4">↓ vận hành</div>
    <div class="node" id="ops"><div class="nl">🔁 Rotation có kế hoạch</div><div class="ns">backup pin · expiration · giám sát</div></div>
  `,

  steps: [
    { title: "1 · Pin chỉ là lớp thêm", tab: "manual", highlight: [3, 4], on: ["app", "a1", "std"],
      desc: "Bước đầu tiên luôn là kiểm tra chuẩn của OS. Code pinning tự viết mà bỏ bước này có thể chấp nhận chứng chỉ hết hạn hoặc sai hostname." },
    { title: "2 · So SPKI hash", tab: "manual", highlight: [7, 8, 10, 11], on: ["a2", "pin", "a3", "ok", "fail"],
      desc: "Pin hash của public key thay vì cả chứng chỉ: gia hạn chứng chỉ mà giữ khoá thì app vẫn chạy. Không khớp → từ chối và báo cáo để giám sát." },
    { title: "3 · Android: khai báo, không cần code", tab: "nsc", highlight: [3, 4, 5, 6], on: ["pin"],
      desc: "<code>pin-set</code> có sẵn backup pin và <code>expiration</code>. Hết hạn thì app quay về kiểm tra chuẩn, tránh bị khoá vĩnh viễn." },
    { title: "4 · iOS: NSPinnedDomains", tab: "ios", highlight: [3, 4, 6, 7, 8], on: ["pin"],
      desc: "Từ iOS 14 khai báo pin trong ATS. Luôn có ít nhất hai hash: khoá đang dùng và khoá dự phòng." },
    { title: "5 · Cross-platform", tab: "xplat", highlight: [2, 4, 8, 10, 11], on: ["pin"],
      desc: "Dùng thư viện pinning giữ nguyên kiểm tra chuẩn, hoặc khai báo ở tầng native. Không 'pin' bằng badCertificateCallback." },
    { title: "6 · Rotation là phần khó nhất", tab: "rotate", highlight: [2, 4, 5, 6, 7, 9, 10], on: ["a4", "ops"],
      desc: "Sinh khoá dự phòng trước, chờ người dùng cập nhật rồi mới đổi. Ghi rõ trong checklist hạ tầng để không ai đổi chứng chỉ mà quên app." }
  ],

  quiz: [
    { q: "Pinning giải quyết rủi ro gì mà HTTPS chuẩn không giải quyết?", options: [
        "Người dùng đọc traffic của chính mình",
        "Chứng chỉ hợp lệ nhưng do CA bị xâm nhập/cấp nhầm hoặc CA lạ cài trên máy",
        "Server bị SQL injection",
        "App bị decompile"
      ], correct: 1,
      explanation: "HTTPS chuẩn tin mọi CA hệ thống; pinning thu hẹp về khoá cụ thể của bạn." },
    { q: "Vì sao nên pin SPKI hash thay vì toàn bộ chứng chỉ lá?", options: [
        "SPKI hash ngắn hơn",
        "Gia hạn chứng chỉ mà giữ nguyên cặp khoá thì app vẫn chạy",
        "Chứng chỉ không thể hash",
        "Apple bắt buộc"
      ], correct: 1,
      explanation: "Chứng chỉ gia hạn thường xuyên; public key có thể giữ nguyên qua các lần gia hạn." },
    { q: "Backup pin là gì?", options: [
        "Bản sao của pin chính",
        "Hash của một cặp khoá dự phòng đã sinh sẵn, cất offline, chưa dùng trên server",
        "Pin cho domain bên thứ ba",
        "Mã PIN dự phòng của người dùng"
      ], correct: 1,
      explanation: "Khi cần đổi khoá, server chuyển sang khoá dự phòng và app cũ vẫn kết nối được." },
    { q: "Đội hạ tầng đổi chứng chỉ + khoá của api.shop.com mà không biết app có pin, không có backup pin. Hậu quả?", options: [
        "Không ảnh hưởng",
        "Mọi app đang cài mất kết nối tới khi người dùng cập nhật bản mới",
        "App tự động cập nhật pin",
        "Chỉ bản iOS bị ảnh hưởng"
      ], correct: 1,
      explanation: "Đây là rủi ro vận hành lớn nhất của pinning; cần backup pin, expiration và quy trình." },
    { q: "Có nên pin domain của SDK analytics bên thứ ba?", options: [
        "Có, càng nhiều pin càng an toàn",
        "Không — bạn không kiểm soát khoá của họ; họ đổi chứng chỉ là app hỏng",
        "Có, nếu SDK miễn phí",
        "Chỉ trên Android"
      ], correct: 1,
      explanation: "Chỉ pin domain bạn kiểm soát và có quy trình rotation." },
    { q: "Thuộc tính expiration trong pin-set của Android có tác dụng gì?", options: [
        "App ngừng chạy sau ngày đó",
        "Sau ngày đó bỏ qua pin, quay về kiểm tra chứng chỉ chuẩn — tránh app cũ bị khoá vĩnh viễn",
        "Chứng chỉ server hết hạn",
        "Bắt buộc cập nhật app"
      ], correct: 1,
      explanation: "Là lưới an toàn cho người dùng không cập nhật app." },
    { q: "Pinning có ngăn được người dùng root máy đọc traffic của chính app không?", options: [
        "Có, tuyệt đối",
        "Không — họ có thể hook và vô hiệu hoá kiểm tra pin; API vẫn phải không tin client",
        "Có, nếu pin cả CA",
        "Có, trên iOS"
      ], correct: 1,
      explanation: "Pinning bảo vệ người dùng khỏi bên thứ ba, không giấu API khỏi chủ thiết bị." },
    { q: "Code pinning tự viết nên làm gì TRƯỚC khi so hash?", options: [
        "Không cần làm gì",
        "Để OS đánh giá trust chuẩn (chuỗi CA, hostname, hạn); thất bại thì từ chối",
        "Tắt kiểm tra hostname",
        "Tải pin mới từ server qua HTTP"
      ], correct: 1,
      explanation: "Pinning là kiểm tra bổ sung, không thay thế kiểm tra chuẩn." },
    { q: "App thương mại thông thường, dữ liệu không quá nhạy cảm. Khuyến nghị hợp lý?", options: [
        "Bắt buộc pin leaf certificate",
        "HTTPS đúng chuẩn thường là đủ; chỉ pin khi rủi ro cao và có quy trình vận hành rotation",
        "Tắt HTTPS",
        "Pin mọi domain kể cả CDN"
      ], correct: 1,
      explanation: "Pinning có chi phí vận hành; cân nhắc lợi ích/rủi ro theo mức nhạy cảm." }
  ]
});
