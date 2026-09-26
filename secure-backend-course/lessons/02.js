window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Tư duy nền tảng",
  title: "Threat modeling & bản đồ OWASP Top 10",
  subtitle: "Trước khi code: cái gì có giá trị, ai muốn lấy, lấy bằng đường nào",

  theory: `
    <p><strong>Threat modeling</strong> (mô hình hoá mối đe doạ) là việc ngồi xuống <em>trước khi</em> (hoặc trong khi) thiết kế một tính năng,
    trả lời 4 câu hỏi đơn giản:</p>
    <ol>
      <li><strong>Ta đang xây gì?</strong> — vẽ luồng dữ liệu: client → API → service → DB/queue/bên thứ ba.</li>
      <li><strong>Cái gì có thể sai?</strong> — dùng STRIDE để không bỏ sót.</li>
      <li><strong>Ta làm gì với nó?</strong> — chặn, giảm thiểu, chấp nhận, hoặc bỏ tính năng.</li>
      <li><strong>Ta làm đủ chưa?</strong> — review lại, viết test.</li>
    </ol>

    <p><strong>STRIDE</strong> — 6 nhóm mối đe doạ, mỗi nhóm đối lập với một thuộc tính an toàn:</p>
    <table>
      <tr><th>Mối đe doạ</th><th>Phá thuộc tính</th><th>Ví dụ trong backend</th></tr>
      <tr><td><strong>S</strong>poofing — giả mạo danh tính</td><td>Authentication</td><td>Đoán được session ID; JWT không kiểm tra chữ ký</td></tr>
      <tr><td><strong>T</strong>ampering — sửa dữ liệu</td><td>Integrity</td><td>Sửa <code>price</code> trong request; sửa message trên queue không ký</td></tr>
      <tr><td><strong>R</strong>epudiation — chối bỏ</td><td>Non-repudiation</td><td>Admin xoá dữ liệu mà không có audit log nào ghi lại ai làm</td></tr>
      <tr><td><strong>I</strong>nformation disclosure — lộ thông tin</td><td>Confidentiality</td><td>Stack trace lộ đường dẫn, version; API trả thừa field</td></tr>
      <tr><td><strong>D</strong>enial of service — từ chối dịch vụ</td><td>Availability</td><td>Endpoint export không giới hạn số dòng; upload file 10GB</td></tr>
      <tr><td><strong>E</strong>levation of privilege — leo thang quyền</td><td>Authorization</td><td>User thường gọi được <code>/admin/*</code>; đổi <code>role</code> qua API cập nhật profile</td></tr>
    </table>

    <p><strong>OWASP Top 10</strong> là danh sách 10 nhóm rủi ro phổ biến nhất của ứng dụng web, do tổ chức OWASP tổng hợp từ dữ liệu thật
    (bản 2021, bản 2025 sắp xếp lại một chút nhưng các nhóm lớn vẫn vậy). Đây là "bản đồ" của khoá học:</p>
    <table>
      <tr><th>Nhóm OWASP</th><th>Học ở bài</th></tr>
      <tr><td>Broken Access Control (IDOR, leo quyền, CSRF)</td><td>Pha 3, Pha 4</td></tr>
      <tr><td>Cryptographic Failures (lưu mật khẩu sai, mã hoá tự chế)</td><td>Pha 2, Pha 5</td></tr>
      <tr><td>Injection (SQL, NoSQL, OS command, template, XSS)</td><td>Pha 1, Pha 4</td></tr>
      <tr><td>Insecure Design (logic nghiệp vụ, race condition)</td><td>Pha 3</td></tr>
      <tr><td>Security Misconfiguration (debug bật, header thiếu, CORS mở, XXE)</td><td>Pha 1, Pha 4, Pha 6</td></tr>
      <tr><td>Vulnerable & Outdated Components (supply chain)</td><td>Pha 6</td></tr>
      <tr><td>Identification & Authentication Failures</td><td>Pha 2</td></tr>
      <tr><td>Software & Data Integrity Failures (deserialization, CI/CD)</td><td>Pha 1, Pha 6</td></tr>
      <tr><td>Security Logging & Monitoring Failures</td><td>Pha 6</td></tr>
      <tr><td>Server-Side Request Forgery (SSRF)</td><td>Pha 4</td></tr>
    </table>
    <p>Với API riêng, OWASP có thêm danh sách <strong>API Security Top 10</strong> — đứng đầu là <strong>BOLA</strong> (Broken Object Level Authorization, hay IDOR):
    đổi <code>/orders/1001</code> thành <code>/orders/1002</code> và xem được đơn của người khác. Đây là lỗi số 1 trong API thực tế.</p>

    <div class="callout"><p>💡 Threat modeling không cần công cụ xịn: một tấm bảng, vẽ các hộp và mũi tên, rồi với <em>mỗi mũi tên đi qua ranh giới tin cậy</em>
    hãy đọc to 6 chữ S-T-R-I-D-E. 20 phút làm việc này trước khi code thường rẻ hơn rất nhiều so với vá lỗi sau khi bị khai thác.</p></div>
  `,

  codeTabs: [
    { id: "feature", label: "📝 Tính năng", lines: [
      "Tính năng: 'Đổi avatar bằng URL'",
      "",
      "POST /me/avatar",
      "{ \"url\": \"https://cdn.example.com/cat.png\" }",
      "",
      "Server làm:",
      "  1. tải ảnh từ url",
      "  2. resize về 256x256",
      "  3. lưu vào storage, cập nhật users.avatar_key",
      "  4. trả về link avatar mới"
    ]},
    { id: "stride", label: "🔍 Đọc STRIDE", lines: [
      "S  Spoofing   : đổi avatar của NGƯỜI KHÁC được không? (có userId trong body?)",
      "T  Tampering  : sửa avatar_key thành key của file khác trong storage?",
      "R  Repudiation: có log ai đổi avatar lúc nào không?",
      "I  Disclosure : url = http://169.254.169.254/...  -> server tải hộ metadata cloud (SSRF)",
      "              : url = file:///etc/passwd          -> đọc file nội bộ",
      "D  DoS        : url trỏ tới file 20GB / server trả dữ liệu chậm vô hạn",
      "              : ảnh 'decompression bomb' 50000x50000 pixel",
      "E  Elevation  : thư viện xử lý ảnh có lỗi RCE khi parse file độc?"
    ]},
    { id: "mitigate", label: "🛡️ Biện pháp", lines: [
      "S  : userId lấy từ session, không nhận từ body",
      "T  : avatar_key do server sinh (random), client không chọn được",
      "R  : ghi audit log: user, thời điểm, url nguồn",
      "I  : chỉ cho https, chặn IP nội bộ / link-local, không theo redirect bừa (bài SSRF)",
      "D  : timeout tải, giới hạn kích thước (vd 5MB), giới hạn số pixel trước khi decode",
      "E  : cập nhật thư viện ảnh, xử lý ảnh trong sandbox/worker quyền thấp",
      "",
      "=> hoặc đơn giản hơn: BỎ tính năng 'avatar bằng URL', chỉ cho upload file"
    ]}
  ],

  stageHtml: `
    <div class="node" id="s1"><div class="nl">1 · Ta đang xây gì?</div><div class="ns">vẽ luồng dữ liệu + ranh giới tin cậy</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="s2"><div class="nl">2 · Cái gì có thể sai?</div><div class="ns">đọc S-T-R-I-D-E trên từng mũi tên</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="s3"><div class="nl">3 · Làm gì với nó?</div><div class="ns">chặn · giảm thiểu · chấp nhận · bỏ tính năng</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="s4"><div class="nl">4 · Làm đủ chưa?</div><div class="ns">review, viết test bảo mật</div></div>
  `,
  steps: [
    { title: "1 · Mô tả tính năng", tab: "feature", highlight: [3, 4, 7, 8, 9], on: ["s1"],
      desc: "Tính năng nghe vô hại: user dán URL ảnh, server tải về làm avatar. Mũi tên nguy hiểm nhất: <strong>server tự đi tải một URL do user chọn</strong>." },
    { title: "2 · S và T — danh tính và dữ liệu", tab: "stride", highlight: [1, 2], on: ["s2", "a1"],
      desc: "Có cho client chỉ định userId hay avatar_key không? Nếu có, kẻ tấn công đổi avatar người khác hoặc trỏ tới file không phải của mình." },
    { title: "3 · I — lộ thông tin qua SSRF", tab: "stride", highlight: [4, 5], on: ["s2"],
      desc: "Server nằm trong mạng nội bộ, có thể gọi tới địa chỉ metadata của cloud hoặc service nội bộ. User mượn tay server để đọc những thứ user không bao giờ tự truy cập được." },
    { title: "4 · D và E — tài nguyên và thư viện", tab: "stride", highlight: [6, 7, 8], on: ["s2"],
      desc: "File cực lớn, server trả chậm cố ý, ảnh nén nhỏ nhưng giải nén ra hàng GB RAM. Parser ảnh cũng là code — từng có nhiều lỗ hổng thực thi mã." },
    { title: "5 · Chọn biện pháp", tab: "mitigate", highlight: [1, 2, 3, 4, 5, 6], on: ["s3", "a2"],
      desc: "Mỗi mối đe doạ có một biện pháp cụ thể. Chú ý dòng cuối: đôi khi <strong>bỏ tính năng</strong> là lựa chọn an toàn và rẻ nhất." },
    { title: "6 · Kiểm chứng", tab: "mitigate", highlight: [8], on: ["s4", "a3"],
      desc: "Viết test cho từng biện pháp: gửi url nội bộ phải bị từ chối, file 6MB phải bị từ chối. Threat model là tài liệu sống — tính năng đổi thì model cũng đổi." }
  ],

  quiz: [
    { q: "Chữ 'E' trong STRIDE là gì?", options: [
        "Encryption",
        "Exposure",
        "Elevation of privilege — leo thang quyền",
        "Error handling"
      ], correct: 2,
      explanation: "E = Elevation of privilege: người dùng có được quyền cao hơn quyền được cấp, ví dụ user thường gọi được API admin." },
    { q: "Admin xoá dữ liệu khách hàng nhưng hệ thống không ghi lại ai đã làm. Thuộc nhóm STRIDE nào?", options: [
        "Spoofing",
        "Repudiation",
        "Tampering",
        "Denial of service"
      ], correct: 1,
      explanation: "Repudiation = có thể chối bỏ hành động vì không có bằng chứng (audit log)." },
    { q: "Endpoint export CSV không giới hạn số dòng, một request làm server hết RAM. Nhóm STRIDE nào?", options: [
        "Information disclosure",
        "Elevation of privilege",
        "Spoofing",
        "Denial of service"
      ], correct: 3,
      explanation: "Làm hệ thống không phục vụ được người khác = Denial of service (phá Availability)." },
    { q: "Theo OWASP API Security Top 10, lỗi phổ biến số 1 trong API là gì?", options: [
        "SQL Injection",
        "BOLA/IDOR — đổi ID trong URL để truy cập object của người khác",
        "XSS",
        "Thiếu HTTPS"
      ], correct: 1,
      explanation: "Broken Object Level Authorization: API không kiểm tra object được yêu cầu có thuộc về người gọi không." },
    { q: "Thời điểm tốt nhất để làm threat modeling là khi nào?", options: [
        "Sau khi bị hack",
        "Chỉ trước khi release lớn",
        "Khi thiết kế/trước khi code tính năng, và cập nhật khi tính năng thay đổi",
        "Không cần nếu đã có pentest"
      ], correct: 2,
      explanation: "Sửa ở giai đoạn thiết kế rẻ nhất. Pentest tìm lỗi sau khi đã code — bổ sung, không thay thế." },
    { q: "Khi threat modeling, ta nên tập trung soi STRIDE ở đâu nhất?", options: [
        "Ở các mũi tên dữ liệu đi qua ranh giới tin cậy",
        "Ở phần CSS của frontend",
        "Chỉ ở database",
        "Ở các hàm tiện ích nội bộ"
      ], correct: 0,
      explanation: "Chỗ dữ liệu vượt ranh giới (client→API, API→bên thứ ba, queue→consumer) là nơi phần lớn mối đe doạ xuất hiện." },
    { q: "Trong tính năng 'avatar bằng URL', rủi ro 'server tải hộ http://169.254.169.254/...' là loại lỗi gì?", options: [
        "XSS",
        "CSRF",
        "SSRF — Server-Side Request Forgery",
        "SQL Injection"
      ], correct: 2,
      explanation: "SSRF: kẻ tấn công khiến server gửi request tới địa chỉ do họ chọn, thường là tài nguyên nội bộ." },
    { q: "Lựa chọn nào KHÔNG phải một cách xử lý hợp lệ cho một mối đe doạ đã xác định?", options: [
        "Chặn/giảm thiểu bằng biện pháp kỹ thuật",
        "Chấp nhận rủi ro có ý thức (ghi lại lý do)",
        "Bỏ hoặc thiết kế lại tính năng",
        "Giữ nguyên và hy vọng không ai phát hiện"
      ], correct: 3,
      explanation: "'Security through obscurity' không phải biện pháp. Chấp nhận rủi ro phải là quyết định có ý thức, có ghi chép." },
    { q: "OWASP Top 10 là gì?", options: [
        "Danh sách 10 ngôn ngữ lập trình an toàn nhất",
        "Danh sách 10 nhóm rủi ro bảo mật ứng dụng web phổ biến nhất, tổng hợp từ dữ liệu thực tế",
        "Tiêu chuẩn bắt buộc theo luật",
        "10 công cụ scan bảo mật"
      ], correct: 1,
      explanation: "Đây là tài liệu nhận thức (awareness), dùng làm bản đồ để biết nên ưu tiên phòng thủ ở đâu." }
  ]
});
