window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Injection — khi dữ liệu biến thành lệnh",
  title: "Gọi lệnh hệ điều hành an toàn (chống OS Command Injection)",
  subtitle: "Không qua shell · tham số dạng mảng · allowlist · quyền thấp nhất",

  theory: `
    <p>Backend đôi khi cần gọi chương trình bên ngoài: công cụ convert video, resize ảnh, tạo PDF, nén file, chạy <code>git</code>…
    Nếu ta ghép input của người dùng vào <strong>một chuỗi lệnh</strong> rồi đưa cho <strong>shell</strong> thực thi, shell sẽ đọc input đó như một phần câu lệnh —
    đó là <strong>OS Command Injection</strong>. Hậu quả: người ngoài chạy được lệnh tuỳ ý với quyền của process backend. Bài này tập trung vào <em>cách làm đúng</em>.</p>

    <p><strong>1. Hiểu gốc rễ trong một câu.</strong> Shell (sh, bash, cmd, PowerShell) có rất nhiều ký tự mang nghĩa điều khiển (nối lệnh, chuyển hướng, thay thế lệnh con, glob…).
    Khi chuỗi lệnh = <code>"tool " + userInput</code>, bất kỳ ký tự điều khiển nào trong <code>userInput</code> đều được shell diễn giải.
    Cùng một bệnh với SQL Injection: <strong>dữ liệu bị trộn vào lệnh</strong>. Trong bài ta ký hiệu input độc là <code>&lt;user_input_payload&gt;</code> — không cần biết cụ thể nó là gì để phòng thủ đúng.</p>

    <p><strong>2. Nhận diện API nguy hiểm</strong> — những hàm nhận <em>một chuỗi</em> và chạy qua shell:</p>
    <table>
      <tr><th>Ngôn ngữ</th><th>⚠️ Qua shell (tránh)</th><th>✅ Gọi trực tiếp, tham số mảng</th></tr>
      <tr><td>Node.js</td><td><code>child_process.exec(str)</code>, <code>spawn(..., {shell: true})</code></td><td><code>execFile(cmd, [args])</code>, <code>spawn(cmd, [args])</code></td></tr>
      <tr><td>Python</td><td><code>os.system(str)</code>, <code>subprocess.run(str, shell=True)</code></td><td><code>subprocess.run([cmd, arg1, arg2])</code></td></tr>
      <tr><td>Java/Kotlin</td><td><code>Runtime.exec("sh -c ...")</code></td><td><code>new ProcessBuilder(cmd, arg1, arg2)</code></td></tr>
      <tr><td>Go</td><td><code>exec.Command("sh", "-c", str)</code></td><td><code>exec.Command(cmd, arg1, arg2)</code></td></tr>
      <tr><td>PHP</td><td><code>system()</code>, <code>shell_exec()</code>, <code>exec()</code> với chuỗi</td><td><code>proc_open([cmd, arg1])</code> (dạng mảng, PHP 7.4+)</td></tr>
      <tr><td>Ruby</td><td><code>system(str)</code>, backtick</td><td><code>system(cmd, arg1, arg2)</code></td></tr>
      <tr><td>Rust</td><td><code>Command::new("sh").arg("-c").arg(str)</code></td><td><code>Command::new(cmd).arg(a1).arg(a2)</code></td></tr>
    </table>

    <p><strong>3. Bốn lớp phòng thủ — theo thứ tự ưu tiên</strong></p>
    <ol>
      <li><strong>Không gọi lệnh ngoài nếu có thư viện.</strong> Tra DNS → thư viện mạng; nén zip → thư viện zip; xử lý ảnh → thư viện binding. Không có shell thì không có shell injection.</li>
      <li><strong>Gọi trực tiếp chương trình, KHÔNG qua shell, tham số dạng mảng.</strong> Hệ điều hành nhận từng tham số tách biệt; ký tự đặc biệt chỉ là ký tự bình thường
        trong một tham số. Đây chính là "parameterized query" của thế giới process.</li>
      <li><strong>Validate bằng allowlist</strong> trước khi truyền: hostname đúng định dạng, tên file theo pattern cố định, định dạng output ∈ {<code>png</code>, <code>jpg</code>}.
        Tốt nhất: <em>server tự sinh</em> tên file (UUID) thay vì dùng tên client gửi.</li>
      <li><strong>Least privilege cho process</strong>: user hệ điều hành riêng không quyền ghi thư mục code, container tối giản, giới hạn mạng đi ra, timeout, giới hạn CPU/RAM.
        Nếu lớp 1–3 thủng, thiệt hại vẫn bị khoanh vùng.</li>
    </ol>

    <p><strong>4. Argument injection — bẫy còn sót lại khi đã dùng mảng.</strong> Dù không qua shell, nếu một tham số do người dùng điều khiển <em>bắt đầu bằng dấu <code>-</code></em>,
    chương trình đích có thể hiểu nó là <strong>một option</strong> chứ không phải dữ liệu (nhiều công cụ có option đọc/ghi file tuỳ ý hoặc chạy chương trình phụ).
    Cách chữa:</p>
    <ul>
      <li>Đặt <code>--</code> trước dữ liệu (quy ước "hết option" mà đa số công cụ Unix hỗ trợ): <code>["tool", "--opt", "--", userValue]</code>.</li>
      <li>Allowlist không cho giá trị bắt đầu bằng <code>-</code>; với đường dẫn, thêm tiền tố <code>./</code> hoặc dùng đường dẫn tuyệt đối do server dựng.</li>
      <li>Với URL/tên nhánh/tên file: validate định dạng chặt (bài 03), không cho ký tự điều khiển, xuống dòng, NUL.</li>
    </ul>

    <p><strong>5. Escape thủ công chỉ là phương án cuối.</strong> Các hàm quote cho shell tồn tại (<code>shlex.quote</code>, <code>escapeshellarg</code>…) nhưng phụ thuộc loại shell,
    hệ điều hành, và rất dễ dùng sai chỗ. Nếu bạn thấy mình cần escape, câu hỏi đúng là: <em>"Vì sao mình còn đi qua shell?"</em></p>

    <div class="callout"><p>💡 Checklist khi review code gọi process: (1) Có thư viện thay thế không? (2) Có cờ <code>shell</code>/chuỗi lệnh nào không? (3) Tham số người dùng có qua allowlist không?
    (4) Có <code>--</code> trước dữ liệu không? (5) Process chạy bằng user nào, có timeout không? Trả lời đủ 5 câu là đã chặn được gần hết lỗi loại này.</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Chuỗi qua shell", lines: [
      "// Pseudo-code: trang 'kiểm tra kết nối tới host'",
      "handle GET /diag/ping (req):",
      "    host = req.query.host",
      "    out  = runShell(\"ping -c 1 \" + host)     // chuỗi lệnh đưa cho shell",
      "    return out",
      "",
      "// host = \"example.com\"               -> chạy đúng như mong đợi",
      "// host = \"example.com<user_input_payload>\"",
      "//      -> shell diễn giải phần payload như LỆNH, không phải dữ liệu",
      "//      -> chạy với quyền của process backend"
    ]},
    { id: "safe", label: "✅ Mảng, không shell", lines: [
      "HOSTNAME = '^(?=.{1,253}$)([a-zA-Z0-9-]{1,63}\\.)*[a-zA-Z0-9-]{1,63}$'",
      "",
      "handle GET /diag/ping (req):",
      "    host = req.query.host",
      "    if not (isValidIp(host) or matches(host, HOSTNAME)): return 400   // allowlist",
      "    out = runProcess(",
      "        program = \"/usr/bin/ping\",                // đường dẫn tuyệt đối",
      "        args    = [\"-c\", \"1\", \"--\", host],        // từng tham số riêng, '--' chặn option",
      "        timeout = 3s,",
      "        user    = \"diag-runner\"                  // user quyền thấp",
      "    )",
      "    return out"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Node.js",
      "execFile('/usr/bin/ping', ['-c', '1', '--', host], { timeout: 3000 })",
      "# Python",
      "subprocess.run(['/usr/bin/ping', '-c', '1', '--', host], timeout=3, check=True)",
      "# Java / Kotlin",
      "new ProcessBuilder(\"/usr/bin/ping\", \"-c\", \"1\", \"--\", host).start();",
      "# Go",
      "exec.CommandContext(ctx, \"/usr/bin/ping\", \"-c\", \"1\", \"--\", host)",
      "# Rust",
      "Command::new(\"/usr/bin/ping\").args([\"-c\", \"1\", \"--\", &host])",
      "",
      "# Điểm chung: KHÔNG có 'sh -c', KHÔNG có shell=True, KHÔNG ghép chuỗi"
    ]},
    { id: "argi", label: "⚠️ Argument injection", lines: [
      "// Đã dùng mảng, nhưng tham số do user điều khiển bắt đầu bằng '-'",
      "runProcess(\"/usr/bin/sometool\", [userValue])",
      "// userValue = \"-<option_nguy_hiem>\"  -> tool hiểu là OPTION, không phải dữ liệu",
      "",
      "// Chữa 1: '--' báo hiệu hết option",
      "runProcess(\"/usr/bin/sometool\", [\"--\", userValue])",
      "",
      "// Chữa 2: allowlist không cho bắt đầu bằng '-'",
      "if userValue.startsWith(\"-\"): return 400",
      "",
      "// Chữa 3 (tốt nhất cho file): server tự sinh tên",
      "path = \"/srv/uploads/\" + uuid() + \".png\"",
      "runProcess(\"/usr/bin/sometool\", [\"--input\", path])"
    ]},
    { id: "lib", label: "🏆 Không cần process", lines: [
      "// Thay vì gọi lệnh ngoài, dùng thư viện trong ngôn ngữ:",
      "",
      "ping / nslookup   -> thư viện DNS / socket (resolve, connect có timeout)",
      "zip / tar         -> thư viện nén chuẩn của ngôn ngữ",
      "resize ảnh        -> thư viện xử lý ảnh (binding), chạy trong worker quyền thấp",
      "tạo PDF           -> thư viện PDF / headless renderer trong sandbox",
      "git               -> thư viện git (libgit2 binding, JGit, go-git...)",
      "",
      "// Không có shell => không có shell injection.",
      "// Vẫn phải validate input và giới hạn tài nguyên (file quá lớn, timeout)."
    ]}
  ],

  stageHtml: `
    <div class="node" id="input"><div class="nl">📨 Input người dùng</div><div class="ns">host / tên file / định dạng</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="allow"><div class="nl">📐 Allowlist</div><div class="ns">định dạng chặt · không bắt đầu bằng '-' · hoặc server tự sinh</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="shell"><div class="nl">🐚 Chuỗi → shell</div><div class="ns">❌ ký tự đặc biệt thành lệnh</div></div>
      <div class="node" id="argv"><div class="nl">📦 Gọi trực tiếp + mảng</div><div class="ns">✅ mỗi tham số là dữ liệu thuần</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="sandbox"><div class="nl">🔒 Process quyền thấp</div><div class="ns">user riêng · timeout · giới hạn mạng/tài nguyên</div></div>
  `,
  steps: [
    { title: "1 · Chỗ lỗi: chuỗi lệnh qua shell", tab: "vuln", highlight: [3, 4], on: ["input", "shell"],
      desc: "Input được ghép vào chuỗi rồi đưa cho shell. Shell không biết phần nào do lập trình viên viết, phần nào đến từ người dùng." },
    { title: "2 · Hậu quả (dạng trừu tượng)", tab: "vuln", highlight: [8, 9, 10], on: ["shell"],
      desc: "Chỉ cần <code>&lt;user_input_payload&gt;</code> chứa ký tự điều khiển của shell là phần đó chạy như một lệnh riêng, với quyền của backend. Để phòng thủ, ta không cần biết payload cụ thể — chỉ cần <strong>không cho shell diễn giải dữ liệu</strong>." },
    { title: "3 · Lớp 1: thay bằng thư viện", tab: "lib", highlight: [3, 4, 5, 6, 7, 9], on: ["input"],
      desc: "Lựa chọn tốt nhất là không gọi process nào. Hầu hết tác vụ phổ biến đều có thư viện trong mọi ngôn ngữ." },
    { title: "4 · Lớp 2 + 3: allowlist rồi gọi trực tiếp", tab: "safe", highlight: [1, 5, 7, 8], on: ["allow", "a1", "a2", "argv"],
      desc: "Validate host bằng định dạng chặt, gọi chương trình bằng đường dẫn tuyệt đối, tham số dạng mảng. Không có shell ở giữa nên ký tự đặc biệt chỉ là ký tự." },
    { title: "5 · Lớp 4: quyền thấp nhất", tab: "safe", highlight: [9, 10], on: ["a3", "sandbox"],
      desc: "Timeout, user riêng quyền thấp, container tối giản. Nếu các lớp trên có sơ suất, thiệt hại vẫn bị giới hạn." },
    { title: "6 · Ngôn ngữ nào cũng có API dạng mảng", tab: "langs", highlight: [2, 4, 6, 8, 10, 12], on: ["argv"],
      desc: "execFile, subprocess.run(list), ProcessBuilder, exec.Command, Command::new — cùng một ý tưởng. Dấu hiệu cần cảnh giác khi review: <code>shell=True</code>, <code>sh -c</code>, <code>exec(string)</code>." },
    { title: "7 · Đừng quên argument injection", tab: "argi", highlight: [2, 3, 6, 9, 12, 13], on: ["allow", "argv"],
      desc: "Tham số bắt đầu bằng <code>-</code> có thể bị hiểu là option. Thêm <code>--</code>, chặn tiền tố <code>-</code>, hoặc để server tự sinh tên file." }
  ],

  quiz: [
    { q: "Gốc rễ của OS Command Injection là gì?", options: [
        "Server dùng hệ điều hành Linux",
        "Input người dùng bị ghép vào chuỗi lệnh và được shell diễn giải như một phần câu lệnh",
        "Thiếu HTTPS",
        "Process chạy quá lâu"
      ], correct: 1,
      explanation: "Giống SQLi: dữ liệu và lệnh bị trộn lẫn, trình thông dịch (shell) không phân biệt được." },
    { q: "Biện pháp nào được ưu tiên CAO NHẤT?", options: [
        "Escape input bằng hàm quote",
        "Dùng thư viện trong ngôn ngữ thay vì gọi lệnh ngoài",
        "Chặn một danh sách ký tự nguy hiểm",
        "Chạy lệnh trong try/catch"
      ], correct: 1,
      explanation: "Không có shell/process thì không có command injection. Các lớp khác là phương án khi buộc phải gọi process." },
    { q: "Vì sao truyền tham số dạng mảng (execFile, ProcessBuilder, subprocess.run(list)) an toàn hơn?", options: [
        "Vì chạy nhanh hơn",
        "Vì hệ điều hành nhận từng tham số tách biệt, không có shell diễn giải ký tự đặc biệt",
        "Vì mảng tự mã hoá dữ liệu",
        "Vì mảng giới hạn độ dài input"
      ], correct: 1,
      explanation: "Không có bước shell parse chuỗi, nên ký tự đặc biệt trong một tham số chỉ là dữ liệu." },
    { q: "Dấu hiệu nào khi review code cho thấy có thể đang đi qua shell?", options: [
        "Dùng đường dẫn tuyệt đối tới chương trình",
        "subprocess.run(..., shell=True) hoặc exec.Command(\"sh\", \"-c\", str)",
        "Có đặt timeout",
        "Dùng thư viện zip"
      ], correct: 1,
      explanation: "shell=True, 'sh -c', exec(string), system(string) đều đưa chuỗi cho shell diễn giải." },
    { q: "Đã dùng mảng tham số, nhưng giá trị người dùng bắt đầu bằng '-'. Rủi ro gì?", options: [
        "Không rủi ro gì",
        "Argument injection: chương trình đích hiểu giá trị đó là một option",
        "SQL Injection",
        "Process bị crash ngay"
      ], correct: 1,
      explanation: "Nhiều công cụ có option mạnh (đọc/ghi file, chạy chương trình phụ). Dữ liệu bị hiểu thành option là một dạng injection." },
    { q: "Quy ước '--' trong danh sách tham số có tác dụng gì?", options: [
        "Tạo comment",
        "Báo cho chương trình rằng mọi thứ phía sau là dữ liệu, không còn là option",
        "Chạy lệnh ở chế độ im lặng",
        "Giảm quyền process"
      ], correct: 1,
      explanation: "'--' là quy ước 'hết option' mà đa số công cụ Unix hỗ trợ, chặn argument injection." },
    { q: "Với file người dùng upload cần đưa vào công cụ convert, cách đặt tên file an toàn nhất?", options: [
        "Dùng nguyên tên file client gửi",
        "Server tự sinh tên (UUID) trong thư mục cố định",
        "Dùng tên client gửi nhưng bỏ dấu cách",
        "Dùng tên client gửi viết hoa"
      ], correct: 1,
      explanation: "Không có dữ liệu người dùng trong tham số thì không có gì để inject." },
    { q: "Vì sao escape thủ công (hàm quote cho shell) chỉ là phương án cuối?", options: [
        "Vì không có hàm nào như vậy",
        "Vì phụ thuộc loại shell/hệ điều hành và dễ dùng sai; tốt hơn là tránh shell hoàn toàn",
        "Vì làm chậm chương trình",
        "Vì chỉ dùng được trên Windows"
      ], correct: 1,
      explanation: "Escape đúng cho sh chưa chắc đúng cho cmd/PowerShell; sai một chỗ là thủng. Không qua shell thì không cần escape." },
    { q: "Principle of Least Privilege áp dụng cho process được gọi thế nào?", options: [
        "Chạy bằng root để tránh lỗi quyền",
        "Chạy bằng user riêng quyền thấp, container tối giản, có timeout và giới hạn tài nguyên/mạng",
        "Tắt log để tránh lộ thông tin",
        "Cho process quyền ghi vào thư mục code để cập nhật nhanh"
      ], correct: 1,
      explanation: "Nếu có lỗi lọt qua, quyền thấp giới hạn những gì kẻ tấn công làm được." },
    { q: "Lệnh ping trong trang chẩn đoán nhận host từ người dùng. Validate nào phù hợp?", options: [
        "Chặn dấu chấm phẩy là đủ",
        "Allowlist: host phải là IP hợp lệ hoặc hostname đúng định dạng; từ chối mọi thứ khác",
        "Không cần validate nếu đã dùng mảng",
        "Chỉ giới hạn độ dài 1000 ký tự"
      ], correct: 1,
      explanation: "Allowlist định dạng + mảng tham số + '--' là phòng thủ nhiều lớp. Denylist ký tự luôn thiếu." }
  ]
});
