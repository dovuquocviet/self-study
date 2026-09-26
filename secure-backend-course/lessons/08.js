window.LESSONS.push({
  id: "08",
  phase: "1", phaseName: "Injection — khi dữ liệu biến thành lệnh",
  title: "Làm việc với file theo tên một cách an toàn (chống Path Traversal, Zip Slip)",
  subtitle: "ID vào, server tra đường dẫn · server tự sinh tên · resolve + kiểm tra thư mục gốc · quyền thấp nhất",

  theory: `
    <p>Rất nhiều tính năng backend đụng tới file: tải avatar, tải hoá đơn PDF, xem file đính kèm, xuất báo cáo, giải nén gói dữ liệu người dùng upload…
    Nếu ta lấy <strong>tên file hoặc đường dẫn do client gửi</strong> rồi ghép thẳng vào đường dẫn trên đĩa, client có thể khiến server đọc/ghi
    <strong>ra ngoài thư mục dự định</strong> — lỗi này gọi là <strong>Path Traversal</strong>. Khi đường dẫn độc nằm <em>bên trong file nén</em> (zip, tar)
    và được dùng lúc giải nén, người ta gọi là <strong>Zip Slip</strong>. Cả hai cùng một gốc: <em>dữ liệu người dùng quyết định vị trí trên hệ thống file</em>.
    Bài này tập trung hoàn toàn vào cách làm đúng.</p>

    <p><strong>1. Hiểu gốc rễ trong một câu.</strong> Đường dẫn file là một "ngôn ngữ nhỏ": có ký hiệu thư mục cha, dấu phân cách, đường dẫn tuyệt đối, symlink,
    ký tự đặc biệt tuỳ hệ điều hành. Khi ta viết <code>baseDir + "/" + tenFileTuClient</code>, hệ điều hành sẽ diễn giải <em>mọi</em> ký hiệu trong phần tên đó.
    Trong bài ta gọi giá trị độc là <code>&lt;giá_trị_độc&gt;</code> — để phòng thủ ta không cần biết nó trông thế nào, chỉ cần <strong>không để client điều khiển đường dẫn</strong>.</p>

    <p><strong>2. Năm lớp phòng thủ — theo thứ tự ưu tiên</strong></p>
    <ol>
      <li><strong>"ID vào, server tra đường dẫn"</strong> (tốt nhất). Client chỉ gửi một định danh (ví dụ <code>invoiceId = 42</code>).
        Server tra database: bản ghi 42 có thuộc về user này không? đường dẫn/khoá lưu trữ của nó là gì? Client <em>không bao giờ</em> gửi tên file hay đường dẫn.
        Vừa chặn path traversal, vừa kiểm tra quyền sở hữu (chống IDOR — sẽ học ở pha phân quyền).</li>
      <li><strong>Server tự sinh tên file khi lưu.</strong> Upload vào → lưu thành <code>&lt;uuid&gt;.png</code> trong thư mục cố định. Tên gốc của client
        (<code>originalName</code>) chỉ lưu trong DB để <em>hiển thị</em>, không bao giờ dùng làm đường dẫn.</li>
      <li><strong>Allowlist khi buộc phải nhận tên.</strong> Ví dụ chọn mẫu báo cáo: chỉ chấp nhận giá trị trong tập cố định <code>{"monthly", "yearly"}</code>
        rồi <em>server</em> map sang tên file. Nếu phải nhận tên tự do: regex chặt như <code>^[a-zA-Z0-9_-]{1,64}\\.(png|jpg|pdf)$</code> — không có dấu phân cách,
        không có dấu chấm đứng đầu, không ký tự điều khiển/NUL.</li>
      <li><strong>Resolve + kiểm tra tiền tố thư mục gốc</strong> (lưới an toàn bắt buộc). Trước khi mở file: chuẩn hoá đường dẫn đầy đủ
        (resolve/canonicalize — xử lý hết ký hiệu tương đối và, nếu cần, symlink), rồi kiểm tra kết quả <strong>nằm trong</strong> thư mục gốc cho phép.
        So sánh phải theo <em>ranh giới thư mục</em>: <code>/srv/files/</code> chứ không phải <code>/srv/files</code> (vì <code>/srv/files-backup</code> cũng bắt đầu bằng <code>/srv/files</code>).</li>
      <li><strong>Least privilege cho filesystem.</strong> Process chạy bằng user riêng, chỉ có quyền đọc/ghi đúng thư mục dữ liệu; thư mục code, cấu hình, secret
        không đọc được bởi user đó; container với root filesystem chỉ-đọc, volume dữ liệu mount riêng với cờ <code>noexec</code>.</li>
    </ol>

    <p><strong>3. Vì sao "lọc chuỗi nguy hiểm" KHÔNG phải cách chữa.</strong> Tìm-và-xoá một vài ký tự trong tên file (denylist) rất dễ sót: có nhiều cách mã hoá
    (URL-encode, mã hoá hai lần, Unicode, dấu phân cách khác nhau giữa Windows/Linux), và xoá một lần có thể để lại chuỗi mới vẫn nguy hiểm.
    Quy tắc: <em>validate bằng allowlist rồi từ chối</em> (trả 400), <strong>không</strong> "sửa" input cho sạch.</p>

    <p><strong>4. Bảng API resolve + kiểm tra theo ngôn ngữ</strong></p>
    <table>
      <tr><th>Ngôn ngữ</th><th>Chuẩn hoá đường dẫn</th><th>Kiểm tra nằm trong thư mục gốc</th></tr>
      <tr><td>Node.js</td><td><code>path.resolve(base, name)</code>, <code>fs.realpath</code></td><td><code>path.relative(base, full)</code> không bắt đầu bằng <code>..</code> và không tuyệt đối</td></tr>
      <tr><td>Python</td><td><code>(base / name).resolve()</code></td><td><code>full.is_relative_to(base)</code> (3.9+)</td></tr>
      <tr><td>Java/Kotlin</td><td><code>base.resolve(name).normalize()</code>, <code>toRealPath()</code></td><td><code>full.startsWith(base)</code> (so sánh theo từng thành phần Path)</td></tr>
      <tr><td>Go</td><td><code>filepath.Join</code> + <code>filepath.Clean</code></td><td><code>filepath.Rel</code>, <code>filepath.IsLocal</code> (1.20+), hoặc <code>os.Root</code> (1.24+)</td></tr>
      <tr><td>PHP</td><td><code>realpath()</code></td><td><code>str_starts_with($full, $base . DIRECTORY_SEPARATOR)</code></td></tr>
      <tr><td>C# / .NET</td><td><code>Path.GetFullPath(Path.Combine(base, name))</code></td><td><code>full.StartsWith(base + Path.DirectorySeparatorChar, Ordinal)</code></td></tr>
    </table>
    <p>Lưu ý: <code>Path.Combine</code>/<code>path.join</code>/<code>resolve</code> <strong>không</strong> tự bảo vệ — nếu phần sau là đường dẫn tuyệt đối, nhiều API sẽ bỏ luôn phần <code>base</code>.
    Bước kiểm tra tiền tố là bắt buộc.</p>

    <p><strong>5. Giải nén an toàn (chống Zip Slip).</strong> Tên của từng mục trong file nén cũng là <em>input người dùng</em>. Khi giải nén:</p>
    <ul>
      <li>Với <strong>mỗi entry</strong>: tính đường dẫn đích = resolve(thư mục đích, tên entry), rồi kiểm tra nằm trong thư mục đích — y hệt lớp 4. Sai → dừng và báo lỗi, không bỏ qua im lặng.</li>
      <li>Bỏ qua (hoặc từ chối) entry là symlink/hardlink, thiết bị, file đặc biệt — chỉ cho phép file thường và thư mục.</li>
      <li>Giới hạn <strong>số entry</strong>, <strong>tổng dung lượng sau giải nén</strong> và <strong>tỉ lệ nén</strong> (chống "zip bomb" làm đầy đĩa).</li>
      <li>Giải nén vào thư mục tạm riêng, quyền thấp; chỉ chuyển file hợp lệ sang nơi lưu chính sau khi kiểm tra xong.</li>
      <li>Ưu tiên API giải nén có sẵn chế độ an toàn (ví dụ Python 3.12+ <code>tarfile</code> với <code>filter='data'</code>), và cập nhật thư viện nén thường xuyên.</li>
      <li>Tốt hơn nữa: không cần giữ tên entry gốc — server tự sinh tên cho từng file lấy ra, lưu tên gốc vào DB để hiển thị.</li>
    </ul>

    <p><strong>6. Object storage (S3, GCS, Azure Blob…) cũng cần kỷ luật.</strong> Object key không phải đường dẫn đĩa, nhưng key do client điều khiển vẫn có thể
    đọc/ghi đè object của người khác trong cùng bucket. Làm đúng:</p>
    <ul>
      <li>Server dựng key: <code>tenants/&lt;tenantId&gt;/invoices/&lt;uuid&gt;.pdf</code> — tenantId lấy từ phiên đăng nhập, <em>không</em> từ request.</li>
      <li>Cho client tải trực tiếp bằng <strong>presigned URL</strong> ngắn hạn, cấp cho <em>đúng một key</em> mà server đã kiểm tra quyền.</li>
      <li>IAM policy của service chỉ cho phép tiền tố cần thiết; bucket mặc định private, bật chặn public access.</li>
    </ul>

    <p><strong>7. Khi trả file về cho người dùng</strong>: đặt <code>Content-Type</code> từ bản ghi DB (không đoán theo tên client gửi), thêm
    <code>X-Content-Type-Options: nosniff</code>, và <code>Content-Disposition: attachment</code> với tên hiển thị đã được làm sạch/mã hoá đúng chuẩn —
    tránh trình duyệt hiển thị file do người khác upload như một trang web của bạn.</p>

    <div class="callout"><p>💡 Checklist khi review code đụng file: (1) Client có gửi tên/đường dẫn không — đổi được sang ID không? (2) Tên lưu trên đĩa có do server sinh không?
    (3) Có resolve + kiểm tra tiền tố (theo ranh giới thư mục) ngay trước khi mở file không? (4) Code giải nén có kiểm tra từng entry, giới hạn kích thước không?
    (5) Process chỉ có quyền trên đúng thư mục dữ liệu chứ? (6) Object key có dựng từ dữ liệu phiên thay vì request không?</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Ghép tên từ client", lines: [
      "// Pseudo-code: tải file đính kèm",
      "BASE = '/srv/app/uploads'",
      "",
      "handle GET /files (req):",
      "    name = req.query.name                 // client quyết định tên",
      "    data = readFile(BASE + '/' + name)     // ghép chuỗi rồi mở",
      "    return data",
      "",
      "// name = 'report.pdf'        -> đọc đúng file mong muốn",
      "// name = '<giá_trị_độc>'     -> hệ điều hành diễn giải ký hiệu đường dẫn,",
      "//                               có thể trỏ ra NGOÀI thư mục uploads"
    ]},
    { id: "byid", label: "🏆 ID vào, server tra", lines: [
      "// Client chỉ gửi ID. Server tra DB để biết file nằm đâu.",
      "handle GET /files/{id} (req):",
      "    rec = db.files.findById(req.params.id)",
      "    if rec == null: return 404",
      "    if rec.ownerId != req.user.id: return 404     // kiểm tra quyền sở hữu",
      "    path = FILE_ROOT + '/' + rec.storageName       // storageName = uuid do server sinh",
      "    return sendFile(path,",
      "        contentType = rec.contentType,             // lấy từ DB, không đoán",
      "        downloadName = rec.originalName)           // chỉ để hiển thị",
      "",
      "// Khi upload:",
      "handle POST /files (req):",
      "    storageName = uuid() + '.' + allowExt(req.file.type)   // png|jpg|pdf",
      "    writeFile(FILE_ROOT + '/' + storageName, req.file.bytes)",
      "    db.files.insert(owner = req.user.id, storageName, originalName = req.file.name)"
    ]},
    { id: "check", label: "✅ Resolve + kiểm tra gốc", lines: [
      "// Khi BẮT BUỘC nhận tên từ client: allowlist + resolve + kiểm tra tiền tố",
      "NAME_RE = '^[a-zA-Z0-9_-]{1,64}\\.(png|jpg|pdf)$'",
      "BASE    = realPath('/srv/app/uploads')           // chuẩn hoá thư mục gốc 1 lần",
      "",
      "function safeResolve(name):",
      "    if not matches(name, NAME_RE): throw BadRequest   // allowlist, từ chối",
      "    full = realPath(join(BASE, name))                 // resolve đầy đủ",
      "    if not isInside(full, BASE): throw BadRequest     // kiểm tra ranh giới",
      "    return full",
      "",
      "function isInside(full, base):",
      "    // so sánh theo ranh giới thư mục, KHÔNG chỉ startsWith chuỗi thô",
      "    return full.startsWith(base + SEPARATOR)"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Node.js",
      "const full = path.resolve(BASE, name);",
      "const rel = path.relative(BASE, full);",
      "if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('bad path');",
      "# Python",
      "full = (BASE / name).resolve()",
      "if not full.is_relative_to(BASE): raise ValueError('bad path')",
      "# Java / Kotlin",
      "Path full = base.resolve(name).normalize();",
      "if (!full.startsWith(base)) throw new SecurityException(\"bad path\");",
      "# Go (1.24+): os.Root giới hạn mọi thao tác trong một thư mục",
      "root, _ := os.OpenRoot(\"/srv/app/uploads\"); f, err := root.Open(name)",
      "# C# / .NET",
      "var full = Path.GetFullPath(Path.Combine(baseDir, name));",
      "if (!full.StartsWith(baseDir + Path.DirectorySeparatorChar, StringComparison.Ordinal)) throw ...;"
    ]},
    { id: "unzip", label: "📦 Giải nén an toàn", lines: [
      "MAX_ENTRIES = 1000",
      "MAX_TOTAL   = 200 MB",
      "",
      "function safeExtract(archive, destDir):",
      "    dest = realPath(destDir)",
      "    count = 0; total = 0",
      "    for entry in archive.entries():",
      "        count += 1",
      "        if count > MAX_ENTRIES: throw TooManyEntries",
      "        if not (entry.isFile or entry.isDir): throw BadEntry   // không symlink/link",
      "        target = resolve(join(dest, entry.name))",
      "        if not isInside(target, dest): throw BadEntry          // chống Zip Slip",
      "        total += entry.uncompressedSize",
      "        if total > MAX_TOTAL: throw TooLarge                   // chống zip bomb",
      "        writeLimited(target, entry.stream, MAX_TOTAL - total)  // đếm byte thật"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request</div><div class="ns">ID / tên file / file nén / object key</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="concat"><div class="nl">🧵 Ghép tên client</div><div class="ns">❌ client điều khiển đường dẫn</div></div>
      <div class="node" id="lookup"><div class="nl">🗂️ ID → DB → đường dẫn</div><div class="ns">✅ server quyết định vị trí</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="allow"><div class="nl">📐 Allowlist + resolve</div><div class="ns">regex chặt · chuẩn hoá · kiểm tra nằm trong thư mục gốc</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="fs"><div class="nl">💾 Filesystem quyền thấp</div><div class="ns">user riêng · chỉ thư mục dữ liệu · noexec</div></div>
      <div class="node" id="obj"><div class="nl">☁️ Object storage</div><div class="ns">key do server dựng · presigned URL · IAM theo tiền tố</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chỗ lỗi: ghép tên từ client", tab: "vuln", highlight: [5, 6], on: ["req", "a1", "concat"],
      desc: "Tên file đến từ query string và được ghép thẳng vào đường dẫn. Hệ điều hành diễn giải mọi ký hiệu đường dẫn trong phần tên đó — client đang điều khiển vị trí đọc file." },
    { title: "2 · Hậu quả (dạng trừu tượng)", tab: "vuln", highlight: [9, 10, 11], on: ["concat"],
      desc: "Chỉ cần <code>&lt;giá_trị_độc&gt;</code> chứa ký hiệu đường dẫn là file đọc ra có thể nằm ngoài <code>uploads</code> (cấu hình, secret…). Phòng thủ không cần biết giá trị cụ thể: <strong>đừng để client quyết định đường dẫn</strong>." },
    { title: "3 · Lớp 1 + 2: ID vào, server tra, server đặt tên", tab: "byid", highlight: [3, 5, 6, 8, 13, 15], on: ["lookup", "a1"],
      desc: "Client chỉ gửi ID; server kiểm tra quyền sở hữu, lấy <code>storageName</code> (UUID do server sinh lúc upload). Tên gốc chỉ để hiển thị. Không còn chuỗi nào từ client đi vào đường dẫn." },
    { title: "4 · Lớp 3 + 4: allowlist, resolve, kiểm tra gốc", tab: "check", highlight: [2, 3, 6, 7, 8, 13], on: ["allow", "a2"],
      desc: "Khi buộc phải nhận tên: regex allowlist → từ chối nếu sai; resolve đầy đủ; kiểm tra kết quả nằm trong thư mục gốc <em>theo ranh giới thư mục</em> (thêm dấu phân cách khi so sánh)." },
    { title: "5 · Mọi ngôn ngữ đều có công cụ", tab: "langs", highlight: [2, 4, 6, 7, 9, 10, 12, 14, 15], on: ["allow"],
      desc: "resolve/relative, Path.resolve + is_relative_to, normalize + startsWith(Path), os.Root, GetFullPath — cùng một ý tưởng. Nhớ: <code>join/Combine</code> một mình không bảo vệ gì." },
    { title: "6 · Giải nén: mỗi entry là input người dùng", tab: "unzip", highlight: [9, 10, 11, 12, 14, 15], on: ["allow", "fs", "a3"],
      desc: "Kiểm tra từng entry: chỉ file/thư mục thường, đường dẫn đích nằm trong thư mục đích, giới hạn số entry và tổng dung lượng (đếm byte thật khi ghi). Sai → dừng toàn bộ." },
    { title: "7 · Least privilege & object storage", tab: "byid", highlight: [6, 13, 14], on: ["fs", "obj", "a3"],
      desc: "Process chỉ có quyền trên thư mục dữ liệu; code và secret không đọc được. Với S3/GCS: server dựng key từ dữ liệu phiên (tenant, uuid), client tải bằng presigned URL ngắn hạn cho đúng một key." }
  ],

  quiz: [
    { q: "Gốc rễ của Path Traversal là gì?", options: [
        "Server dùng Windows thay vì Linux",
        "Dữ liệu từ client được dùng để quyết định đường dẫn trên hệ thống file",
        "Thiếu HTTPS khi tải file",
        "File quá lớn"
      ], correct: 1,
      explanation: "Đường dẫn là một 'ngôn ngữ nhỏ'; khi client điều khiển phần tên, hệ điều hành diễn giải mọi ký hiệu trong đó — cùng bệnh 'dữ liệu thành lệnh'." },
    { q: "Thiết kế nào an toàn nhất cho API tải file đính kèm?", options: [
        "Nhận tên file từ query, xoá các ký tự lạ rồi mở",
        "Client gửi ID; server tra DB, kiểm tra quyền sở hữu, lấy tên lưu trữ do server sinh",
        "Nhận đường dẫn tuyệt đối từ client cho linh hoạt",
        "Nhận tên file và mã hoá base64 trước khi mở"
      ], correct: 1,
      explanation: "'ID vào, server tra đường dẫn' loại bỏ hoàn toàn việc client điều khiển đường dẫn, đồng thời kiểm tra quyền truy cập." },
    { q: "Khi lưu file upload, nên đặt tên file trên đĩa thế nào?", options: [
        "Giữ nguyên tên client gửi",
        "Server tự sinh (UUID + phần mở rộng từ allowlist); tên gốc chỉ lưu DB để hiển thị",
        "Dùng tên client gửi nhưng viết thường",
        "Dùng timestamp + tên client gửi"
      ], correct: 1,
      explanation: "Tên do server sinh không chứa ký hiệu đường dẫn nào; mọi phần do client gửi chỉ dùng để hiển thị." },
    { q: "Vì sao 'tìm và xoá chuỗi nguy hiểm' trong tên file không phải cách chữa đúng?", options: [
        "Vì chạy chậm",
        "Vì denylist dễ sót (nhiều cách mã hoá, khác biệt hệ điều hành) và xoá một lần có thể để lại chuỗi mới vẫn nguy hiểm",
        "Vì làm mất phần mở rộng file",
        "Vì không tương thích với UTF-8"
      ], correct: 1,
      explanation: "Quy tắc: validate bằng allowlist và từ chối input sai, không cố 'sửa' input cho sạch." },
    { q: "Sau khi resolve, kiểm tra 'full.startsWith(\"/srv/files\")' (chuỗi thô) có vấn đề gì?", options: [
        "Không có vấn đề",
        "Thư mục anh em như /srv/files-backup cũng thoả điều kiện; phải so sánh theo ranh giới thư mục (thêm dấu phân cách hoặc so sánh theo thành phần Path)",
        "startsWith không chạy trên Linux",
        "Phải dùng endsWith"
      ], correct: 1,
      explanation: "So sánh chuỗi thô không tôn trọng ranh giới thư mục. Dùng base + SEPARATOR, Path.startsWith (Java), is_relative_to (Python) hoặc path.relative (Node)." },
    { q: "Nhận định nào đúng về path.join / Path.Combine / resolve?", options: [
        "Chúng tự động chặn mọi đường dẫn ra ngoài thư mục gốc",
        "Chúng chỉ ghép/chuẩn hoá; nếu phần sau là đường dẫn tuyệt đối có thể bỏ luôn phần gốc — vẫn phải kiểm tra tiền tố",
        "Chúng mã hoá tên file",
        "Chúng chỉ hoạt động trên Windows"
      ], correct: 1,
      explanation: "Các hàm ghép đường dẫn không phải hàm bảo mật. Bước 'kiểm tra nằm trong thư mục gốc' luôn bắt buộc." },
    { q: "Khi giải nén file zip/tar do người dùng upload, điều gì là bắt buộc?", options: [
        "Giải nén thẳng vào thư mục web root cho tiện",
        "Với từng entry: resolve đường dẫn đích và kiểm tra nằm trong thư mục đích, từ chối symlink/link, giới hạn số entry và tổng dung lượng",
        "Chỉ kiểm tra phần mở rộng của file nén là .zip",
        "Tin tưởng thư viện nén vì nó chuẩn"
      ], correct: 1,
      explanation: "Tên entry là input người dùng (Zip Slip); giới hạn kích thước chống zip bomb; symlink có thể trỏ ra ngoài." },
    { q: "Với object storage (S3/GCS), cách đúng để client tải hoá đơn của mình?", options: [
        "Cho client gửi object key tuỳ ý rồi server đọc",
        "Server dựng key từ dữ liệu phiên (tenant, uuid), kiểm tra quyền, rồi cấp presigned URL ngắn hạn cho đúng key đó",
        "Để bucket public cho nhanh",
        "Chia sẻ access key của service cho frontend"
      ], correct: 1,
      explanation: "Key do client điều khiển có thể trỏ tới object của người khác. Server kiểm soát key; presigned URL giới hạn một object, thời hạn ngắn." },
    { q: "Least privilege cho filesystem nghĩa là gì trong bối cảnh này?", options: [
        "Chạy backend bằng root để khỏi lỗi quyền",
        "Process chạy bằng user riêng, chỉ có quyền trên thư mục dữ liệu; code/cấu hình/secret không đọc/ghi được; volume dữ liệu mount noexec",
        "Tắt log để tiết kiệm đĩa",
        "Đặt mọi file quyền 777"
      ], correct: 1,
      explanation: "Nếu các lớp trên có sơ suất, quyền thấp giới hạn thiệt hại: không đọc được secret, không ghi đè được code." },
    { q: "Khi trả file người dùng upload về trình duyệt, header nào giúp an toàn hơn?", options: [
        "Content-Type đoán từ tên file client gửi",
        "Content-Type lấy từ DB, X-Content-Type-Options: nosniff và Content-Disposition: attachment",
        "Access-Control-Allow-Origin: *",
        "Không cần header gì"
      ], correct: 1,
      explanation: "Tránh trình duyệt hiển thị file do người khác upload như trang web thuộc domain của bạn." }
  ]
});
