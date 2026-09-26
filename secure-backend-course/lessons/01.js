window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Tư duy nền tảng",
  title: "Tư duy bảo mật — nghĩ như kẻ tấn công",
  subtitle: "CIA, bề mặt tấn công, ranh giới tin cậy — và vì sao 'chạy đúng' chưa phải 'an toàn'",

  theory: `
    <p>Khi viết tính năng, ta hỏi: <em>"người dùng bình thường dùng nó thế nào?"</em>. Khi nghĩ về bảo mật, ta hỏi câu ngược lại:
    <strong>"một người cố tình phá thì sẽ gửi gì vào đây?"</strong>. Code chạy đúng với input đẹp chưa nói lên gì —
    kẻ tấn công không bao giờ gửi input đẹp.</p>

    <p><strong>1. Ba thứ ta bảo vệ — bộ ba CIA</strong></p>
    <table>
      <tr><th>Chữ</th><th>Nghĩa</th><th>Ví dụ bị phá</th></tr>
      <tr><td><strong>C</strong>onfidentiality — bí mật</td><td>Chỉ người được phép mới đọc được dữ liệu</td><td>API <code>GET /users/42</code> trả luôn cả <code>password_hash</code> và số CCCD</td></tr>
      <tr><td><strong>I</strong>ntegrity — toàn vẹn</td><td>Dữ liệu không bị sửa trái phép</td><td>Client gửi <code>"price": 1</code> và server tin luôn giá đó</td></tr>
      <tr><td><strong>A</strong>vailability — sẵn sàng</td><td>Hệ thống vẫn phục vụ được người dùng hợp lệ</td><td>Một regex viết dở làm CPU 100% khi nhận chuỗi dài 50 ký tự</td></tr>
    </table>
    <p>Mọi lỗ hổng trong khoá này đều phá ít nhất một trong ba chữ đó. Khi đọc một lỗi mới, hãy tự hỏi: nó phá C, I hay A?</p>

    <p><strong>2. Bề mặt tấn công (attack surface)</strong> = mọi chỗ dữ liệu từ bên ngoài đi vào hệ thống:</p>
    <ul>
      <li>Rõ ràng: URL path, query string, body JSON/form, header (<code>Cookie</code>, <code>Authorization</code>, <code>User-Agent</code>, <code>X-Forwarded-For</code>…), file upload.</li>
      <li>Ít ai để ý: message từ queue (Kafka, RabbitMQ), webhook từ bên thứ ba, dữ liệu đọc lại từ DB (do chính user nhập trước đó), tên file, biến môi trường trong CI, response của API khác.</li>
    </ul>
    <p>Bề mặt càng rộng càng nhiều chỗ để thủ. Nguyên tắc: <strong>tắt/xoá những gì không dùng</strong> (endpoint debug, route admin quên xoá, port mở thừa).</p>

    <p><strong>3. Ranh giới tin cậy (trust boundary)</strong> — đường kẻ giữa "vùng ta kiểm soát" và "vùng ta không kiểm soát".
    Dữ liệu vượt qua ranh giới này phải được kiểm tra. Điều quan trọng nhất cho người mới:</p>
    <div class="callout"><p>💡 <strong>Client không bao giờ nằm trong vùng tin cậy.</strong> App mobile, trang web, Postman, curl — với server, tất cả đều là "một ai đó gửi byte tới".
    Validate ở frontend chỉ để trải nghiệm người dùng tốt hơn; <strong>kiểm tra thật phải nằm ở backend</strong>. Kẻ tấn công bỏ qua frontend chỉ bằng một lệnh curl.</p></div>

    <p><strong>4. Vài nguyên tắc vàng — sẽ gặp lại suốt khoá</strong></p>
    <ul>
      <li><strong>Least privilege</strong> — mỗi thành phần chỉ có đúng quyền nó cần. Service đọc báo cáo không cần quyền <code>DROP TABLE</code>.</li>
      <li><strong>Defense in depth</strong> — nhiều lớp phòng thủ; một lớp thủng vẫn còn lớp khác.</li>
      <li><strong>Fail securely</strong> — khi có lỗi thì từ chối, không mở cửa. <code>catch (e) { return true; }</code> trong hàm kiểm tra quyền là thảm hoạ.</li>
      <li><strong>Secure by default</strong> — cấu hình mặc định phải là cấu hình an toàn; muốn mở thì phải cố tình mở.</li>
      <li><strong>Không tự chế</strong> — mật mã, xác thực, parser: dùng thư viện đã được kiểm chứng.</li>
      <li><strong>Tách dữ liệu khỏi lệnh</strong> — gốc rễ của cả họ Injection (Pha 1).</li>
    </ul>

    <p><strong>5. Vì sao khoá này không gắn với ngôn ngữ nào?</strong> Vì lỗ hổng nằm ở <em>cách ta ghép dữ liệu, tin dữ liệu, và cấp quyền</em>,
    không nằm ở cú pháp. Nối chuỗi thành câu SQL thì Java, Go, Python, Node, PHP, Rust đều dính như nhau. Mỗi bài sẽ cho code mẫu ở vài ngôn ngữ để bạn thấy
    <strong>hình dạng lỗi giống hệt nhau</strong>.</p>
  `,

  codeTabs: [
    { id: "naive", label: "❌ Tin client", lines: [
      "// Pseudo-code — ngôn ngữ nào cũng viết ra được đoạn này",
      "handle POST /checkout (req):",
      "    cart   = req.body.items",
      "    total  = req.body.total          // client tự tính tổng tiền!",
      "    userId = req.body.userId         // client tự khai mình là ai!",
      "    if req.body.isAdmin == true:     // client tự khai quyền!",
      "        applyDiscount(100%)",
      "    charge(userId, total)",
      "    return 200"
    ]},
    { id: "attack", label: "🕵️ Kẻ tấn công gửi", lines: [
      "# Không cần app, không cần web — chỉ cần curl",
      "$ curl -X POST https://shop.example.com/checkout \\",
      "    -H 'Content-Type: application/json' \\",
      "    -d '{",
      "      \"items\":  [{\"sku\": \"IPHONE-17\", \"qty\": 1}],",
      "      \"total\":  1000,",
      "      \"userId\": 42,",
      "      \"isAdmin\": true",
      "    }'",
      "",
      "# => mua iPhone giá 1000đ, trừ tiền tài khoản người khác (42)"
    ]},
    { id: "safe", label: "✅ Server tự quyết", lines: [
      "handle POST /checkout (req):",
      "    user  = authenticate(req)           // danh tính lấy từ session/token đã xác thực",
      "    items = validate(req.body.items)    // chỉ nhận sku + qty, kiểm tra kiểu & giới hạn",
      "    total = 0",
      "    for it in items:",
      "        product = db.findProduct(it.sku)          // giá lấy từ DB, không lấy từ client",
      "        total  += product.price * it.qty",
      "    total = applyDiscounts(user, items, total)     // quyền giảm giá do server quyết",
      "    charge(user.id, total)",
      "    return 200"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">📱 Client (app / web / curl)</div><div class="ns">NGOÀI vùng tin cậy — ai cũng giả mạo được</div></div>
    <div class="arrow" id="a1">↓ byte bất kỳ</div>
    <div class="node" id="boundary"><div class="nl">🚧 Ranh giới tin cậy</div><div class="ns">xác thực · validate · phân quyền</div></div>
    <div class="arrow" id="a2">↓ chỉ dữ liệu đã kiểm tra</div>
    <div class="row">
      <div class="node" id="logic"><div class="nl">⚙️ Business logic</div><div class="ns">tự tính giá, tự quyết quyền</div></div>
      <div class="node" id="db"><div class="nl">🗄️ DB / service</div><div class="ns">nguồn sự thật</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Code 'chạy đúng' với input đẹp", tab: "naive", highlight: [3, 4, 5, 6], on: ["client", "a1", "logic"],
      desc: "Với app thật của ta, <code>total</code> luôn được tính đúng ở client, <code>isAdmin</code> luôn là false. Test tay mọi thứ đều xanh. Nhưng server đang <strong>tin</strong> ba giá trị mà client tự khai." },
    { title: "2 · Kẻ tấn công không dùng app của bạn", tab: "attack", highlight: [2, 6, 7, 8], on: ["client", "a1"],
      desc: "Một lệnh curl là đủ để gửi bất kỳ JSON nào. Không có gì ở phía client ngăn được việc này — kể cả app mobile đã obfuscate hay web có validate form." },
    { title: "3 · Hậu quả: phá cả C, I lẫn A", tab: "attack", highlight: [11], on: ["logic", "db"],
      desc: "<strong>Integrity</strong>: giá bị sửa. <strong>Confidentiality/Integrity</strong>: trừ tiền user 42 không phải mình. <strong>Authorization</strong>: tự phong admin. Ba lỗi, cùng một gốc: tin dữ liệu từ ngoài ranh giới." },
    { title: "4 · Dựng ranh giới tin cậy", tab: "safe", highlight: [2, 3], on: ["boundary", "a2"],
      desc: "Danh tính lấy từ session/token <em>server đã xác thực</em>, không lấy từ body. Input được validate: chỉ nhận đúng các field cần, đúng kiểu, trong giới hạn." },
    { title: "5 · Server là nguồn sự thật", tab: "safe", highlight: [6, 7, 8, 9], on: ["logic", "db"],
      desc: "Giá lấy từ DB, giảm giá do server quyết theo quyền thật của user. Client chỉ được nói <em>'tôi muốn mua sku X số lượng Y'</em> — mọi thứ còn lại server tự tính." }
  ],

  quiz: [
    { q: "Bộ ba CIA trong bảo mật gồm những gì?", options: [
        "Code, Infrastructure, Application",
        "Confidentiality, Integrity, Availability",
        "Client, Internet, API",
        "Certificate, Identity, Authorization"
      ], correct: 1,
      explanation: "CIA = Bí mật (chỉ người được phép đọc), Toàn vẹn (không bị sửa trái phép), Sẵn sàng (hệ thống vẫn phục vụ được)." },
    { q: "API trả về cả password_hash của user trong response. Đây là vi phạm chữ nào trong CIA?", options: [
        "Availability",
        "Integrity",
        "Confidentiality",
        "Không vi phạm vì chỉ là hash"
      ], correct: 2,
      explanation: "Dữ liệu lọt tới người không cần/không được phép thấy = phá Confidentiality. Hash vẫn có thể bị bẻ offline (bài lưu mật khẩu)." },
    { q: "Form đăng ký ở frontend đã kiểm tra email hợp lệ. Backend có cần kiểm tra lại không?", options: [
        "Không, vì frontend đã kiểm tra rồi",
        "Chỉ cần nếu app là web, app mobile thì không cần",
        "Có — kẻ tấn công gửi request thẳng tới API, bỏ qua hoàn toàn frontend",
        "Chỉ cần kiểm tra ở database"
      ], correct: 2,
      explanation: "Validate ở client chỉ phục vụ trải nghiệm. Client nằm ngoài ranh giới tin cậy; curl/Postman/script bỏ qua nó dễ dàng." },
    { q: "Thứ nào sau đây CŨNG là bề mặt tấn công mà nhiều người hay quên?", options: [
        "Chỉ URL và body của request",
        "Message đọc từ Kafka/queue, webhook bên thứ ba, header như X-Forwarded-For",
        "Chỉ những endpoint có đăng nhập",
        "Chỉ file upload"
      ], correct: 1,
      explanation: "Mọi dữ liệu đến từ ngoài vùng kiểm soát đều là bề mặt tấn công — kể cả queue, webhook, header, dữ liệu user nhập đã lưu trong DB." },
    { q: "Hàm kiểm tra quyền viết: try { return checkPermission(user) } catch (e) { return true }. Vi phạm nguyên tắc nào?", options: [
        "Least privilege",
        "Fail securely — gặp lỗi phải từ chối, không được cho qua",
        "Secure by default",
        "Không vi phạm gì"
      ], correct: 1,
      explanation: "Khi có lỗi (DB timeout, exception bất ngờ) hệ thống phải 'đóng cửa'. Ở đây lỗi lại mở cửa cho tất cả." },
    { q: "Service chỉ đọc dữ liệu để làm báo cáo nhưng dùng tài khoản DB có quyền DROP TABLE. Vi phạm nguyên tắc nào?", options: [
        "Least privilege",
        "Fail securely",
        "Defense in depth",
        "Availability"
      ], correct: 0,
      explanation: "Least privilege: chỉ cấp đúng quyền cần dùng. Nếu service bị chiếm, thiệt hại bị giới hạn ở quyền đọc thay vì xoá được cả bảng." },
    { q: "Vì sao lỗi như SQL Injection không gắn với một ngôn ngữ lập trình cụ thể?", options: [
        "Vì chỉ PHP mới bị SQL Injection",
        "Vì lỗi nằm ở cách ghép dữ liệu thành lệnh (nối chuỗi), ngôn ngữ nào nối chuỗi cũng dính",
        "Vì database tự chặn được mọi injection",
        "Vì các ngôn ngữ hiện đại đã loại bỏ hoàn toàn lỗi này"
      ], correct: 1,
      explanation: "Hình dạng lỗi là 'trộn dữ liệu không tin cậy vào lệnh'. Java, Go, Python, Node, Rust… đều có thể viết ra code nối chuỗi SQL." },
    { q: "Trong endpoint checkout an toàn, giá sản phẩm nên lấy từ đâu?", options: [
        "Từ body request do client gửi",
        "Từ header do app mobile gắn vào",
        "Từ database/nguồn dữ liệu phía server",
        "Từ cookie"
      ], correct: 2,
      explanation: "Server là nguồn sự thật. Client chỉ nói muốn mua gì, bao nhiêu; giá và giảm giá do server tự tra và tự tính." },
    { q: "'Defense in depth' nghĩa là gì?", options: [
        "Viết thật nhiều code kiểm tra ở cùng một chỗ",
        "Chỉ dựa vào firewall",
        "Nhiều lớp phòng thủ độc lập, một lớp thủng vẫn còn lớp khác chặn",
        "Mã hoá dữ liệu nhiều lần liên tiếp"
      ], correct: 2,
      explanation: "Ví dụ: validate input + parameterized query + tài khoản DB quyền thấp + giám sát. Một lớp sai vẫn có lớp khác hạn chế thiệt hại." }
  ]
});
