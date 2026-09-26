window.LESSONS.push({
  id: "19",
  phase: "4", phaseName: "Các lỗi phía web",
  title: "Nhận file upload an toàn",
  subtitle: "Giới hạn kích thước · kiểm tra loại bằng nội dung · server tự đặt tên · lưu ngoài web root · domain riêng · quét malware · xử lý ảnh cô lập",

  theory: `
    <p>Upload file là một trong những tính năng rủi ro nhất: người dùng gửi lên một khối byte <em>tuỳ ý</em>, và server phải lưu, xử lý, rồi phục vụ lại cho người khác.
    Mỗi bước đều có thể sai:</p>
    <table>
      <tr><th>Bước</th><th>Nếu làm sai</th></tr>
      <tr><td>Nhận</td><td>File khổng lồ làm đầy ổ đĩa/RAM (DoS); file nén "bom" giải nén ra hàng GB</td></tr>
      <tr><td>Đặt tên &amp; lưu</td><td>Tên file chứa đường dẫn ghi đè file khác (path traversal); ghi đè file của người khác; file lưu trong thư mục web được server <strong>thực thi</strong> như code</td></tr>
      <tr><td>Xử lý</td><td>Thư viện đọc ảnh/PDF/Office có lỗi → file đặc chế khai thác được thư viện; XML trong file Office/SVG → XXE</td></tr>
      <tr><td>Phục vụ lại</td><td>File HTML/SVG mở trên domain chính → XSS (bài 15); trình duyệt tự "đoán" loại file; phát tán malware cho người dùng khác</td></tr>
    </table>

    <p><strong>1. Giới hạn trước khi đọc.</strong></p>
    <ul>
      <li>Giới hạn kích thước request ở <strong>nhiều tầng</strong>: reverse proxy (Nginx <code>client_max_body_size</code>), framework (<code>multer limits</code>, Spring <code>max-file-size</code>, ASP.NET <code>RequestSizeLimit</code>), và trong code khi đọc stream.</li>
      <li>Giới hạn số file mỗi request, tổng dung lượng mỗi người dùng (quota), tốc độ upload (rate limit).</li>
      <li>File nén: giới hạn tổng kích thước sau giải nén, số entry, độ sâu lồng nhau; kiểm tra tên từng entry không thoát khỏi thư mục đích.</li>
      <li>Ảnh: giới hạn số pixel (rộng × cao), không chỉ số byte — một file nhỏ có thể khai báo kích thước ảnh cực lớn.</li>
    </ul>

    <p><strong>2. Kiểm tra loại file bằng NỘI DUNG, không tin tên hay Content-Type.</strong></p>
    <ul>
      <li>Phần mở rộng (<code>.jpg</code>) và header <code>Content-Type</code> đều do client đặt — đổi tuỳ ý.</li>
      <li>Đọc "magic bytes" (vài byte đầu) bằng thư viện: <code>libmagic</code>/<code>python-magic</code>, <code>file-type</code> (Node), Apache Tika (Java), <code>http.DetectContentType</code> (Go).</li>
      <li>So với <strong>allowlist</strong> loại thật sự cần (vd chỉ JPEG, PNG, WebP, PDF). Không dùng denylist "chặn .exe, .php" — luôn có đuôi khác lọt.</li>
      <li>Kiểm tra mạnh nhất cho ảnh: <strong>decode rồi re-encode</strong> (xem mục 6) — nếu không decode được thì không phải ảnh hợp lệ.</li>
      <li>Cẩn thận với SVG (là XML, chứa được script), HTML, file Office có macro: nếu không thật sự cần, đừng cho phép.</li>
    </ul>

    <p><strong>3. Server tự đặt tên file.</strong></p>
    <ul>
      <li>Tên lưu trữ = ID ngẫu nhiên (UUID v4 hoặc hash nội dung) + phần mở rộng <em>do server chọn</em> theo loại đã xác định ở bước 2.</li>
      <li>Tên gốc (nếu cần hiển thị) lưu vào DB như dữ liệu thường, đã giới hạn độ dài và bỏ ký tự điều khiển; khi xuất ra thì encode (bài 15, bài 18).</li>
      <li>Không bao giờ ghép tên người dùng gửi vào đường dẫn thư mục (tránh path traversal và ghi đè).</li>
    </ul>

    <p><strong>4. Lưu ngoài web root — tốt nhất là object storage.</strong></p>
    <ul>
      <li>Không lưu vào thư mục mà web server phục vụ trực tiếp/có thể thực thi script (<code>public/</code>, <code>wwwroot/</code>, <code>htdocs/</code>).</li>
      <li>Dùng object storage (S3, GCS, Azure Blob, MinIO): bucket <strong>private</strong>, không public-list; ứng dụng phát <strong>URL ký có thời hạn</strong> (pre-signed URL) sau khi kiểm tra quyền.</li>
      <li>Nếu lưu đĩa: thư mục riêng ngoài web root, quyền ghi tối thiểu, mount với <code>noexec</code>.</li>
      <li>Kiểm tra quyền truy cập file như mọi tài nguyên khác (người A không tải được file riêng của người B — IDOR).</li>
    </ul>

    <p><strong>5. Phục vụ file an toàn.</strong></p>
    <ul>
      <li><code>Content-Type</code> = loại đã xác định ở server (không lấy từ lúc upload), kèm <code>X-Content-Type-Options: nosniff</code>.</li>
      <li><code>Content-Disposition: attachment</code> cho file không cần xem trực tiếp → trình duyệt tải về thay vì mở.</li>
      <li>Phục vụ nội dung người dùng từ <strong>domain riêng</strong> (vd <code>usercontent-example.net</code>, khác hẳn site chính) — nếu có file HTML/SVG lọt qua, script chạy trên domain đó cũng không chạm được cookie/phiên của site chính.</li>
      <li>Thêm CSP chặt cho domain file: <code>default-src 'none'; sandbox</code>.</li>
    </ul>

    <p><strong>6. Quét và xử lý trong môi trường cô lập.</strong></p>
    <ul>
      <li><strong>Quét malware</strong> (ClamAV, dịch vụ quét của cloud) trước khi cho người khác tải. Luồng: upload vào bucket "cách ly" → worker quét → sạch thì chuyển sang bucket chính; bẩn thì xoá và ghi log.</li>
      <li><strong>Xử lý ảnh/PDF/video</strong> (resize, thumbnail, trích metadata) trong worker riêng: container không có quyền mạng hoặc chỉ ra tới storage, user không phải root, giới hạn CPU/RAM/thời gian, hệ thống file chỉ đọc.
        Thư viện xử lý ảnh có lịch sử lỗi nghiêm trọng — giả định nó <em>có thể</em> bị khai thác và giới hạn thiệt hại.</li>
      <li>Cấu hình thư viện an toàn: ImageMagick dùng <code>policy.xml</code> chỉ cho phép các định dạng cần; tắt xử lý entity ngoài khi parse XML (SVG, DOCX).</li>
      <li><strong>Re-encode</strong> ảnh sang định dạng chuẩn và <strong>xoá metadata EXIF</strong> (chứa toạ độ GPS, thông tin thiết bị) — vừa làm sạch nội dung lạ, vừa bảo vệ quyền riêng tư.</li>
      <li>Cập nhật thư viện xử lý file thường xuyên (bài quản lý dependency).</li>
    </ul>

    <div class="callout"><p>💡 Checklist upload: <strong>giới hạn</strong> (size, số lượng, pixel, giải nén) → <strong>xác định loại bằng nội dung</strong> theo allowlist → <strong>tên do server đặt</strong>
    → <strong>lưu private ngoài web root</strong> → <strong>quét + xử lý cô lập, re-encode</strong> → <strong>phục vụ</strong> với Content-Type đúng, nosniff, attachment, domain riêng, kiểm tra quyền.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "❌ Upload ngây thơ", lines: [
      "handle POST /upload (req):",
      "    f = req.files.avatar",
      "    if not f.filename.endsWith('.jpg'): reject     // tin phần mở rộng",
      "    if f.contentType != 'image/jpeg': reject        // tin header client",
      "    path = '/var/www/public/uploads/' + f.filename  // tên do client đặt, trong web root",
      "    f.saveTo(path)",
      "    return { url: '/uploads/' + f.filename }",
      "",
      "// Vấn đề:",
      "//  - tên/Content-Type đổi tuỳ ý; tên có thể chứa đường dẫn -> ghi ra chỗ khác",
      "//  - file lưu trong web root có thể bị server chạy như script",
      "//  - không giới hạn kích thước, trùng tên thì ghi đè file người khác"
    ]},
    { id: "good", label: "✅ Luồng an toàn", lines: [
      "ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }",
      "MAX_BYTES = 5 * MB",
      "",
      "handle POST /upload (req):",
      "    requireAuth(req)",
      "    stream = req.fileStream('avatar', maxBytes=MAX_BYTES)   // vượt -> 413",
      "    head = stream.peek(64)",
      "    realType = detectTypeByMagic(head)          // libmagic / file-type / Tika",
      "    if realType not in ALLOWED: reject(415)",
      "",
      "    key = 'quarantine/' + uuid4() + '.' + ALLOWED[realType]   // server đặt tên",
      "    objectStorage.put(bucket='uploads-private', key, stream)",
      "    db.insert(file_id, owner=req.user.id, key, originalName=clean(f.name))",
      "    queue.publish('scan-and-process', file_id)",
      "    return { id: file_id, status: 'processing' }"
    ]},
    { id: "worker", label: "🧪 Worker cô lập", lines: [
      "// Chạy trong container riêng: không mạng (trừ storage), non-root,",
      "// read-only FS, giới hạn CPU/RAM/thời gian",
      "on 'scan-and-process' (file_id):",
      "    data = storage.get(key)",
      "    if antivirus.scan(data) != CLEAN: delete(key); alert(file_id); return",
      "",
      "    img = Image.decode(data, maxPixels=40_000_000)   // không decode được -> loại",
      "    img = img.stripMetadata()                        // xoá EXIF (GPS...)",
      "    out = img.resize(maxSide=1024).encode('webp')    // re-encode",
      "",
      "    storage.put('files/' + file_id + '.webp', out)",
      "    storage.delete(key)                              // xoá bản cách ly",
      "    db.update(file_id, status='ready')",
      "",
      "# ImageMagick: policy.xml chỉ cho phép định dạng cần; tắt định dạng lạ"
    ]},
    { id: "serve", label: "📤 Phục vụ file", lines: [
      "handle GET /files/:id (req):",
      "    meta = db.find(req.params.id)",
      "    if not canRead(req.user, meta): return 404     // chống IDOR",
      "    url = storage.presign(meta.key, expires=5min)  // URL ký, có hạn",
      "    return redirect(url)",
      "",
      "// Header do storage/CDN trả trên domain RIÊNG (usercontent-example.net)",
      "Content-Type: image/webp                       // loại server đã xác định",
      "X-Content-Type-Options: nosniff",
      "Content-Disposition: attachment; filename*=UTF-8''avatar.webp",
      "Content-Security-Policy: default-src 'none'; sandbox",
      "",
      "// Bucket: private, chặn public access, không cho list"
    ]},
    { id: "langs", label: "🌐 Đa nền tảng", lines: [
      "# Nginx: giới hạn body",
      "client_max_body_size 5m;",
      "",
      "# Node (multer + file-type)",
      "multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } }); const t = await fileTypeFromBuffer(buf)",
      "",
      "# Python (Flask + python-magic)",
      "app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024; kind = magic.from_buffer(head, mime=True)",
      "",
      "# Java (Spring + Apache Tika)",
      "spring.servlet.multipart.max-file-size=5MB   // String type = new Tika().detect(stream)",
      "",
      "# Go",
      "r.Body = http.MaxBytesReader(w, r.Body, 5<<20); kind := http.DetectContentType(head)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="client"><div class="nl">👤 Người dùng upload</div><div class="ns">byte tuỳ ý · tên · Content-Type (không tin)</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="limit"><div class="nl">📏 Giới hạn</div><div class="ns">proxy + framework + stream · số file · quota</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="magic"><div class="nl">🔬 Loại thật (magic bytes)</div><div class="ns">allowlist JPEG/PNG/WebP/PDF</div></div>
    <div class="arrow" id="a3">↓ tên = UUID do server đặt</div>
    <div class="node" id="quar"><div class="nl">🗄️ Bucket cách ly (private)</div><div class="ns">ngoài web root</div></div>
    <div class="arrow" id="a4">↓ queue</div>
    <div class="node" id="worker"><div class="nl">🧪 Worker cô lập</div><div class="ns">quét malware · decode · xoá EXIF · re-encode</div></div>
    <div class="arrow" id="a5">↓</div>
    <div class="node" id="serve"><div class="nl">📤 Phục vụ</div><div class="ns">kiểm tra quyền · URL ký · domain riêng · nosniff · attachment</div></div>
  `,
  steps: [
    { title: "1 · Upload ngây thơ", tab: "bad", highlight: [3, 4, 5, 6, 7], on: ["client", "quar"],
      desc: "Tin phần mở rộng và Content-Type (client đặt tuỳ ý), dùng tên client gửi, lưu thẳng vào web root. Mỗi dòng là một lỗ hổng tiềm năng." },
    { title: "2 · Giới hạn trước khi đọc", tab: "good", highlight: [2, 5, 6], on: ["a1", "limit"],
      desc: "Giới hạn ở proxy, framework và khi đọc stream. Vượt → 413 ngay, không đọc hết vào RAM. Kèm quota và rate limit." },
    { title: "3 · Loại thật bằng nội dung", tab: "good", highlight: [1, 7, 8, 9], on: ["a2", "magic"],
      desc: "Đọc magic bytes bằng thư viện và so với allowlist. Phần mở rộng lưu trữ do server chọn theo loại thật." },
    { title: "4 · Tên do server đặt, lưu private", tab: "good", highlight: [11, 12, 13, 14], on: ["a3", "quar"],
      desc: "Key = UUID + đuôi server chọn, lưu vào bucket cách ly private. Tên gốc chỉ là dữ liệu trong DB. Đẩy việc quét/xử lý sang queue." },
    { title: "5 · Quét + xử lý cô lập", tab: "worker", highlight: [1, 2, 5, 7, 8, 9], on: ["a4", "worker"],
      desc: "Worker không mạng, non-root, giới hạn tài nguyên. Quét malware, decode với giới hạn pixel, xoá EXIF, re-encode — nếu thư viện bị khai thác, thiệt hại bị nhốt trong container." },
    { title: "6 · Phục vụ an toàn", tab: "serve", highlight: [3, 4, 8, 9, 10, 11], on: ["a5", "serve"],
      desc: "Kiểm tra quyền (chống IDOR), phát URL ký ngắn hạn, phục vụ từ domain riêng với Content-Type đúng, <code>nosniff</code>, <code>attachment</code>, CSP sandbox." },
    { title: "7 · Công cụ theo nền tảng", tab: "langs", highlight: [2, 5, 8, 11, 14], on: ["limit", "magic"],
      desc: "Nginx, multer + file-type, Flask + python-magic, Spring + Tika, Go <code>MaxBytesReader</code> + <code>DetectContentType</code>: cùng ý tưởng giới hạn + nhận diện loại thật." }
  ],

  quiz: [
    { q: "Kiểm tra file upload là ảnh bằng cách xem phần mở rộng '.jpg' và Content-Type 'image/jpeg'. Có đủ không?", options: [
        "Đủ",
        "Không — cả hai do client đặt tuỳ ý; phải xác định loại bằng nội dung (magic bytes) hoặc decode/re-encode",
        "Đủ nếu dùng HTTPS",
        "Đủ nếu file nhỏ hơn 1MB"
      ], correct: 1,
      explanation: "Không tin metadata do client gửi. Dùng libmagic, file-type, Tika… và allowlist loại cho phép." },
    { q: "Vì sao server nên tự đặt tên file lưu trữ (vd UUID)?", options: [
        "Cho đẹp",
        "Tránh path traversal qua tên file, tránh ghi đè file người khác, và không để client quyết định phần mở rộng",
        "Để file nhỏ hơn",
        "Vì hệ điều hành không hỗ trợ tiếng Việt"
      ], correct: 1,
      explanation: "Tên gốc chỉ lưu trong DB như dữ liệu hiển thị, đã lọc và encode khi xuất ra." },
    { q: "Lưu file upload vào thư mục public/ của web server có rủi ro gì lớn nhất?", options: [
        "Tốn dung lượng",
        "Web server có thể thực thi file đó như script, hoặc phục vụ công khai không kiểm tra quyền",
        "Không rủi ro",
        "File bị nén"
      ], correct: 1,
      explanation: "Lưu ngoài web root, tốt nhất là object storage private với URL ký có thời hạn." },
    { q: "Vì sao nên phục vụ file người dùng từ một domain riêng khác domain chính?", options: [
        "Để SEO tốt hơn",
        "Nếu file HTML/SVG có script lọt qua, nó chạy trên domain riêng và không chạm được cookie/phiên của site chính",
        "Để tải nhanh hơn",
        "Vì CDN yêu cầu"
      ], correct: 1,
      explanation: "Cô lập nội dung không tin cậy bằng origin khác — kèm nosniff, attachment và CSP sandbox." },
    { q: "Header Content-Disposition: attachment có tác dụng gì?", options: [
        "Nén file",
        "Trình duyệt tải file về thay vì mở/hiển thị trực tiếp trong trang",
        "Mã hoá file",
        "Chặn virus"
      ], correct: 1,
      explanation: "Giảm rủi ro nội dung bị render như HTML trong trình duyệt." },
    { q: "Giới hạn kích thước upload nên đặt ở đâu?", options: [
        "Chỉ ở frontend",
        "Nhiều tầng: reverse proxy, framework, và khi đọc stream trong code",
        "Chỉ sau khi đã lưu file",
        "Không cần giới hạn"
      ], correct: 1,
      explanation: "Chặn sớm nhất có thể để không đọc hết file khổng lồ vào RAM/đĩa. Frontend có thể bị bỏ qua." },
    { q: "Ảnh chỉ 50KB nhưng khai báo kích thước 50.000 × 50.000 pixel. Rủi ro là gì và phòng thế nào?", options: [
        "Không rủi ro vì file nhỏ",
        "Decode ra bộ nhớ khổng lồ (DoS); giới hạn số pixel trước/khi decode",
        "Chỉ làm ảnh mờ",
        "Phòng bằng cách đổi tên file"
      ], correct: 1,
      explanation: "Giới hạn byte không đủ với ảnh/file nén; cần giới hạn kích thước sau giải mã." },
    { q: "Vì sao xử lý ảnh (resize, thumbnail) nên chạy trong worker cô lập?", options: [
        "Để nhanh hơn",
        "Thư viện xử lý ảnh có thể có lỗ hổng; container không mạng, non-root, giới hạn tài nguyên sẽ nhốt thiệt hại nếu bị khai thác",
        "Vì worker rẻ hơn",
        "Để dễ debug"
      ], correct: 1,
      explanation: "Giả định thư viện parse file có thể bị khai thác và giới hạn phạm vi ảnh hưởng (least privilege)." },
    { q: "Re-encode ảnh và xoá EXIF mang lại lợi ích gì?", options: [
        "Chỉ để giảm dung lượng",
        "Loại bỏ nội dung lạ nhúng trong file, xác nhận đúng là ảnh hợp lệ, và xoá thông tin riêng tư như toạ độ GPS",
        "Tăng độ phân giải",
        "Không có lợi ích bảo mật"
      ], correct: 1,
      explanation: "Không decode được = không phải ảnh hợp lệ; bản re-encode chỉ chứa dữ liệu điểm ảnh sạch." },
    { q: "Luồng quét malware hợp lý là gì?", options: [
        "Cho người khác tải ngay, quét sau",
        "Lưu vào vùng cách ly → worker quét → sạch mới chuyển sang vùng chính cho tải; bẩn thì xoá và cảnh báo",
        "Chỉ quét file .exe",
        "Không cần quét nếu đã kiểm tra phần mở rộng"
      ], correct: 1,
      explanation: "File chưa quét không được phục vụ cho người dùng khác." },
    { q: "Người dùng A đoán được ID file riêng của người dùng B và tải về. Đây là lỗi gì, phòng thế nào?", options: [
        "XSS — encode output",
        "IDOR — kiểm tra quyền sở hữu/đọc file ở mỗi request tải, dùng URL ký ngắn hạn",
        "CSRF — thêm token",
        "SSRF — chặn IP nội bộ"
      ], correct: 1,
      explanation: "File cũng là tài nguyên cần phân quyền như mọi dữ liệu khác." }
  ]
});
