window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Mô hình đe doạ trên mobile",
  subtitle: "App nằm trong tay người dùng · client không đáng tin · OWASP MASVS & Mobile Top 10 làm bản đồ khoá học",

  theory: `
    <p>Khi viết backend, code của bạn chạy trên server <strong>bạn kiểm soát</strong>: không ai ngoài đội vận hành đọc được bộ nhớ, sửa được file cấu hình
    hay gắn debugger vào process. Với app mobile thì ngược lại: bạn đóng gói code rồi <strong>giao nó cho hàng triệu người lạ</strong>.
    Mỗi người đều có toàn quyền với chiếc điện thoại của họ — và một số ít trong đó sẽ cố tình soi, sửa, giả mạo app của bạn.</p>

    <p><strong>1. Mô hình đe doạ (threat model) là gì?</strong> Là trả lời có hệ thống 4 câu hỏi:</p>
    <ol>
      <li><strong>Ta đang bảo vệ cái gì?</strong> (tài sản: token đăng nhập, dữ liệu sức khoẻ, số dư ví, API trả phí…)</li>
      <li><strong>Ai có thể muốn tấn công?</strong> (tác nhân đe doạ)</li>
      <li><strong>Họ tấn công bằng đường nào?</strong> (bề mặt tấn công)</li>
      <li><strong>Ta phòng thủ ra sao, và chấp nhận rủi ro nào?</strong></li>
    </ol>

    <p><strong>2. Các tác nhân đe doạ điển hình của app mobile</strong></p>
    <table>
      <tr><th>Tác nhân</th><th>Có gì trong tay</th><th>Ví dụ mục tiêu</th></tr>
      <tr><td>Chính người dùng app (tò mò hoặc gian lận)</td><td>Toàn quyền thiết bị, có thể root/jailbreak, cài công cụ phân tích</td><td>Mở khoá tính năng trả phí, sửa điểm game, gửi request giả tới API</td></tr>
      <tr><td>Kẻ có thiết bị bị mất/bị trộm</td><td>Truy cập vật lý, có thể đã biết mã mở khoá</td><td>Đọc token, tin nhắn, ảnh giấy tờ còn lưu trong app</td></tr>
      <tr><td>App độc hại khác trên cùng máy</td><td>Chạy trong sandbox riêng nhưng gọi được intent, deep link, đọc clipboard</td><td>Lừa app của bạn làm hộ việc nhạy cảm, đánh cắp dữ liệu qua IPC</td></tr>
      <tr><td>Kẻ trên cùng mạng (Wi-Fi quán cà phê)</td><td>Nghe lén, chặn giữa (man-in-the-middle)</td><td>Đọc/sửa request nếu app không dùng HTTPS đúng cách</td></tr>
      <tr><td>Người phân tích gói app</td><td>Tải file APK/IPA công khai trên store</td><td>Lấy API key, endpoint ẩn, logic kiểm tra license</td></tr>
      <tr><td>Bên thứ ba trong app (SDK)</td><td>Chạy cùng quyền với app của bạn</td><td>Thu thập dữ liệu người dùng quá mức</td></tr>
    </table>

    <p><strong>3. Nguyên tắc số một: client không đáng tin (never trust the client).</strong>
    Mọi thứ chạy trên điện thoại đều có thể bị đọc, bị sửa, bị bỏ qua. Hệ quả thực tế:</p>
    <ul>
      <li>Kiểm tra "user có phải VIP không" <em>trong app</em> chỉ để hiển thị UI. Quyết định cho phép thật sự phải nằm ở <strong>server</strong>.</li>
      <li>Giá tiền, số lượng, điểm thưởng do app gửi lên → server phải tự tính lại, không tin số client gửi.</li>
      <li>Secret nhúng trong app (API key, khoá mã hoá cố định) → coi như <strong>đã công khai</strong> (bài 02, 17).</li>
      <li>Kiểm tra root/jailbreak, chống debug… chỉ <strong>làm chậm</strong> kẻ tấn công, không phải bức tường (bài 18).</li>
    </ul>

    <p><strong>4. Nhưng thiết bị vẫn cần được bảo vệ.</strong> "Client không đáng tin" là nói về <em>server tin client</em>.
    Còn từ góc nhìn <em>người dùng hợp pháp</em>, app phải bảo vệ dữ liệu của họ khỏi kẻ thứ ba: app khác, kẻ nhặt được máy, kẻ nghe lén mạng.
    Đó là lý do ta vẫn cần lưu trữ an toàn (Pha 1), HTTPS đúng (Pha 2), IPC an toàn (Pha 4)…</p>

    <p><strong>5. Bản đồ chuẩn: OWASP MASVS và OWASP Mobile Top 10</strong></p>
    <ul>
      <li><strong>MASVS</strong> (Mobile Application Security Verification Standard) — danh sách yêu cầu bảo mật chia theo nhóm. Dùng làm checklist thiết kế và kiểm thử.</li>
      <li><strong>MASTG</strong> (Mobile Application Security Testing Guide) — hướng dẫn cách kiểm tra từng yêu cầu của MASVS.</li>
      <li><strong>Mobile Top 10</strong> — 10 nhóm rủi ro phổ biến nhất, dùng để ưu tiên.</li>
    </ul>
    <table>
      <tr><th>Nhóm MASVS</th><th>Nội dung</th><th>Bài trong khoá</th></tr>
      <tr><td>MASVS-STORAGE</td><td>Lưu trữ dữ liệu nhạy cảm an toàn, tránh rò rỉ</td><td>04–07</td></tr>
      <tr><td>MASVS-CRYPTO</td><td>Dùng mật mã đúng, quản lý khoá</td><td>05, 07</td></tr>
      <tr><td>MASVS-AUTH</td><td>Xác thực, phiên đăng nhập, sinh trắc học</td><td>11–13</td></tr>
      <tr><td>MASVS-NETWORK</td><td>Kênh truyền an toàn, TLS, pinning</td><td>08–10</td></tr>
      <tr><td>MASVS-PLATFORM</td><td>Tương tác với OS và app khác: IPC, deep link, WebView</td><td>14–16</td></tr>
      <tr><td>MASVS-CODE</td><td>Chất lượng code, thư viện, cập nhật</td><td>19–21</td></tr>
      <tr><td>MASVS-RESILIENCE</td><td>Chống reverse engineering, giả mạo</td><td>17–18</td></tr>
      <tr><td>MASVS-PRIVACY</td><td>Quyền riêng tư, tối thiểu hoá dữ liệu</td><td>20, 22</td></tr>
    </table>

    <p><strong>6. Không có nền tảng "an toàn sẵn".</strong> Android (Kotlin/Java), iOS (Swift), React Native, Flutter đều gặp <em>cùng loại lỗi</em>:
    lưu token dạng plaintext, log dữ liệu nhạy cảm, tin dữ liệu từ deep link, nhúng secret. Công cụ khác nhau, tư duy phòng thủ giống nhau.
    Khoá học này dạy tư duy trước, rồi minh hoạ trên nhiều nền tảng.</p>

    <div class="callout"><p>💡 Câu thần chú cho cả khoá: <strong>"Nếu app bị đọc hết, sửa hết thì hệ thống có còn an toàn không?"</strong>
    Nếu câu trả lời là "không" → phần kiểm soát đó đang đặt sai chỗ, cần chuyển về server.</p></div>
  `,

  codeTabs: [
    { id: "trust", label: "❌ Tin client", lines: [
      "// App tự quyết định quyền — server tin theo",
      "fun onBuyClicked(item: Item) {",
      "    if (user.isPremium) {                 // cờ lưu trong app",
      "        api.post(\"/download\", mapOf(\"id\" to item.id, \"premium\" to true))",
      "    }",
      "    val total = item.price * qty          // giá tính ở client",
      "    api.post(\"/checkout\", mapOf(\"total\" to total))",
      "}",
      "",
      "// Server:",
      "// if (body.premium) cho tải      <- ai sửa app / gửi request tay cũng tải được",
      "// charge(body.total)             <- client gửi total = 0 là mua miễn phí"
    ]},
    { id: "server", label: "✅ Server quyết định", lines: [
      "// App chỉ gửi Ý ĐỊNH, không gửi 'kết luận'",
      "api.post('/download', { itemId })",
      "api.post('/checkout', { items: [{ sku, qty }] })",
      "",
      "// Server tự tra cứu và tự tính",
      "handle POST /download (req):",
      "    user = authenticate(req.token)",
      "    if not entitlements.has(user.id, req.itemId): return 403",
      "    return signedDownloadUrl(req.itemId)",
      "",
      "handle POST /checkout (req):",
      "    total = sum(catalog.price(i.sku) * i.qty for i in req.items)",
      "    charge(user, total)"
    ]},
    { id: "model", label: "🗺️ Threat model", lines: [
      "# Mẫu threat model cho một app ví điện tử (điền vào bảng)",
      "Tài sản:        access/refresh token, số dư, lịch sử giao dịch, CCCD đã chụp",
      "Tác nhân:       người dùng gian lận | kẻ nhặt được máy | app độc hại | kẻ nghe lén Wi-Fi",
      "Bề mặt:         gói app, bộ nhớ máy, mạng, deep link, IPC, WebView, SDK bên thứ ba",
      "",
      "Rủi ro #1:      token lưu plaintext -> kẻ nhặt được máy (đã root) đọc được",
      "  Phòng thủ:    Keychain/Keystore + token ngắn hạn + thu hồi từ xa",
      "Rủi ro #2:      API chuyển tiền tin số tiền client gửi",
      "  Phòng thủ:    server kiểm tra số dư, hạn mức, chữ ký giao dịch",
      "Rủi ro #3:      deep link 'transfer?to=..&amount=..' tự động chuyển",
      "  Phòng thủ:    deep link chỉ mở màn hình, luôn yêu cầu người dùng xác nhận",
      "",
      "Chấp nhận:      app bị decompile để đọc logic UI (không chứa bí mật)"
    ]},
    { id: "masvs", label: "📋 MASVS checklist", lines: [
      "# Dùng MASVS như câu hỏi review cho mỗi tính năng mới",
      "STORAGE   : Tính năng này lưu gì trên máy? Có nhạy cảm không? Lưu ở đâu?",
      "CRYPTO    : Có mã hoá không? Khoá ở đâu? Có tự chế thuật toán không?",
      "AUTH      : Ai được dùng? Server kiểm tra quyền ở đâu?",
      "NETWORK   : Có gọi HTTP thường? Có tắt kiểm tra chứng chỉ không?",
      "PLATFORM  : Có nhận input từ deep link / intent / WebView không?",
      "CODE      : Thêm thư viện mới? Đã kiểm tra phiên bản, quyền của nó?",
      "RESILIENCE: Có logic cần làm khó reverse (chống gian lận)?",
      "PRIVACY   : Có thu thập PII mới? Đã khai báo và xin quyền tối thiểu?"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="user"><div class="nl">🧑 Người dùng / kẻ gian lận</div><div class="ns">toàn quyền thiết bị</div></div>
      <div class="node" id="malapp"><div class="nl">👾 App khác trên máy</div><div class="ns">intent, deep link, clipboard</div></div>
      <div class="node" id="thief"><div class="nl">🕵️ Kẻ nhặt được máy</div><div class="ns">truy cập vật lý</div></div>
    </div>
    <div class="arrow" id="a1">↓ tấn công từ phía thiết bị</div>
    <div class="node" id="app"><div class="nl">📱 App của bạn</div><div class="ns">code + dữ liệu nằm trên máy người khác</div></div>
    <div class="arrow" id="a2">↓ mạng (có thể bị nghe lén)</div>
    <div class="node" id="net"><div class="nl">📶 Wi-Fi công cộng / proxy</div><div class="ns">man-in-the-middle</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="server"><div class="nl">🖥️ Server (vùng tin cậy)</div><div class="ns">nơi DUY NHẤT đưa ra quyết định cuối cùng</div></div>
  `,

  steps: [
    { title: "1 · App nằm trong tay người lạ", tab: "trust", highlight: [3, 6], on: ["user", "a1", "app"],
      desc: "Cờ <code>isPremium</code> và phép tính <code>total</code> chạy trên điện thoại người dùng. Người dùng có toàn quyền với máy đó: họ có thể sửa bộ nhớ, sửa app, hoặc bỏ qua app và gửi request trực tiếp." },
    { title: "2 · Server tin client = lỗ hổng", tab: "trust", highlight: [11, 12], on: ["app", "a2", "a3", "server"],
      desc: "Nếu server chấp nhận <code>premium=true</code> hay <code>total</code> do client gửi, ai cũng có thể gửi giá trị mình muốn. Lỗi này không cần kỹ năng cao — chỉ cần một công cụ gửi HTTP request." },
    { title: "3 · Chuyển quyết định về server", tab: "server", highlight: [2, 3, 8, 12], on: ["server"],
      desc: "App chỉ gửi <em>ý định</em> (muốn tải item X, muốn mua sku Y số lượng Z). Server tự tra quyền và tự tính tiền từ dữ liệu của mình." },
    { title: "4 · Liệt kê tài sản & tác nhân", tab: "model", highlight: [2, 3, 4], on: ["user", "malapp", "thief", "net"],
      desc: "Threat model bắt đầu từ việc viết ra: bảo vệ cái gì, ai muốn lấy, họ đi đường nào. Mỗi tác nhân có khả năng khác nhau nên cần biện pháp khác nhau." },
    { title: "5 · Mỗi rủi ro có biện pháp", tab: "model", highlight: [6, 7, 8, 9, 10, 11, 13], on: ["app", "server"],
      desc: "Ghép từng rủi ro với biện pháp phòng thủ cụ thể, và ghi rõ rủi ro nào <strong>chấp nhận</strong> (ví dụ: logic UI bị đọc — không sao nếu không chứa bí mật)." },
    { title: "6 · MASVS làm checklist", tab: "masvs", highlight: [2, 3, 4, 5, 6, 7, 8, 9], on: ["app"],
      desc: "8 nhóm MASVS là 8 câu hỏi review cho mọi tính năng mới. Các pha của khoá học đi lần lượt qua các nhóm này." }
  ],

  quiz: [
    { q: "Khác biệt cốt lõi giữa bảo mật backend và bảo mật mobile là gì?", options: [
        "Mobile không cần bảo mật vì đã có App Store kiểm duyệt",
        "Code mobile chạy trên thiết bị do người khác kiểm soát hoàn toàn, nên có thể bị đọc, sửa, bỏ qua",
        "Backend không bao giờ bị tấn công",
        "Mobile chỉ cần HTTPS là đủ"
      ], correct: 1,
      explanation: "Khi phát hành app, bạn giao code cho người lạ. Họ có toàn quyền với thiết bị, nên mọi kiểm tra phía client đều có thể bị vượt qua." },
    { q: "App kiểm tra 'user.isPremium' rồi mới gọi API tải nội dung trả phí. Server không kiểm tra lại. Điều gì xảy ra?", options: [
        "An toàn vì cờ isPremium lưu trong app",
        "Ai sửa app hoặc gửi request trực tiếp tới API đều tải được nội dung",
        "Chỉ nguy hiểm trên Android",
        "Chỉ nguy hiểm khi không dùng HTTPS"
      ], correct: 1,
      explanation: "Kiểm tra ở client chỉ để hiển thị UI. Quyết định cấp quyền phải do server đưa ra dựa trên dữ liệu server tin cậy." },
    { q: "Ứng dụng gửi 'total' (tổng tiền) lên API thanh toán. Cách đúng là gì?", options: [
        "Mã hoá 'total' trước khi gửi",
        "Server tự tính tổng từ danh mục giá và số lượng, bỏ qua total do client gửi",
        "Obfuscate code tính tiền",
        "Chỉ cho phép total > 0"
      ], correct: 1,
      explanation: "Mã hoá hay obfuscate không ngăn được người dùng gửi số khác. Server phải là nguồn sự thật cho giá tiền." },
    { q: "OWASP MASVS là gì?", options: [
        "Một thư viện mã hoá cho mobile",
        "Tiêu chuẩn liệt kê yêu cầu bảo mật cho app mobile, chia theo nhóm (STORAGE, NETWORK, AUTH…)",
        "Một công cụ quét malware",
        "Quy định bắt buộc của Google Play"
      ], correct: 1,
      explanation: "MASVS là tiêu chuẩn yêu cầu; MASTG là hướng dẫn kiểm thử đi kèm. Dùng làm checklist thiết kế và kiểm thử." },
    { q: "Tác nhân nào KHÔNG cần quyền root/jailbreak mà vẫn có thể tấn công app qua deep link hoặc intent?", options: [
        "Kẻ nghe lén Wi-Fi",
        "Một app độc hại khác cài trên cùng thiết bị",
        "Nhân viên App Store",
        "Không có tác nhân nào"
      ], correct: 1,
      explanation: "App khác có thể gửi intent, mở deep link, đọc clipboard — những kênh giao tiếp hợp lệ của OS. Pha 4 sẽ học cách phòng thủ." },
    { q: "Câu nào mô tả đúng về kiểm tra root/jailbreak?", options: [
        "Là cách chặn hoàn toàn mọi tấn công",
        "Chỉ là lớp làm chậm kẻ tấn công; không thay thế được kiểm tra phía server",
        "Không có giá trị gì, không nên làm",
        "Bắt buộc với mọi app"
      ], correct: 1,
      explanation: "Kẻ tấn công kiểm soát thiết bị có thể vô hiệu hoá mọi kiểm tra chạy trên thiết bị. Nó chỉ tăng chi phí tấn công." },
    { q: "'Client không đáng tin' có nghĩa là app không cần bảo vệ dữ liệu trên máy?", options: [
        "Đúng, vì dù sao cũng không bảo vệ được",
        "Sai — app vẫn phải bảo vệ dữ liệu của người dùng hợp pháp khỏi app khác, kẻ nhặt máy, kẻ nghe lén",
        "Đúng, chỉ cần server bảo vệ",
        "Chỉ cần bảo vệ trên iOS"
      ], correct: 1,
      explanation: "Hai góc nhìn: server không tin client; còn app phải bảo vệ người dùng khỏi bên thứ ba. Cả hai đều cần." },
    { q: "Bước đầu tiên của threat model là gì?", options: [
        "Cài công cụ quét lỗ hổng",
        "Xác định tài sản cần bảo vệ (token, dữ liệu cá nhân, tiền…)",
        "Bật obfuscation",
        "Viết unit test"
      ], correct: 1,
      explanation: "Không biết bảo vệ cái gì thì không thể biết ai muốn lấy và phòng thủ ở đâu." },
    { q: "Lỗi 'lưu token dạng plaintext' xảy ra trên nền tảng nào?", options: [
        "Chỉ Android",
        "Chỉ React Native",
        "Mọi nền tảng — Android, iOS, React Native, Flutter đều có API lưu plaintext dễ dùng",
        "Chỉ Flutter"
      ], correct: 2,
      explanation: "SharedPreferences, UserDefaults, AsyncStorage, shared_preferences đều là plaintext. Tư duy phòng thủ giống nhau trên mọi nền tảng." }
  ]
});
