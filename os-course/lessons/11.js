window.LESSONS.push({
  id: "11",
  phase: "4", phaseName: "Lưu trữ & I/O",
  title: "Hệ thống file (file system)",
  subtitle: "File, inode, thư mục, đường dẫn và block",

  theory: `
    <p>Ổ đĩa thật ra chỉ là một dãy khổng lồ các <strong>block (khối)</strong> đánh số, mỗi khối vài KB. Con
    người không muốn nghĩ theo "khối số 91823"; ta muốn "file <code>baocao.pdf</code> trong thư mục Tài liệu".
    <strong>Hệ thống file (file system)</strong> là lớp biến dãy khối vô danh đó thành <em>file và thư mục</em>
    có tên.</p>
    <p>Mấu chốt là <strong>inode</strong>: mỗi file có một inode — tấm "thẻ hồ sơ" ghi <em>metadata</em> của
    file (kích thước, quyền, thời gian, và <strong>danh sách các block chứa nội dung</strong>) — nhưng
    <em>không</em> ghi tên file. Nội dung một file có thể nằm rải ở nhiều block không liền nhau; inode chính
    là bản đồ gom chúng lại.</p>
    <p>Vậy tên file ở đâu? Ở <strong>thư mục (directory)</strong>. Thư mục thực chất là một file đặc biệt chứa
    bảng ánh xạ <strong>tên → số inode</strong>. Hình dung một <strong>thư viện</strong>: <em>thẻ mục lục</em>
    (thư mục) ghi "cuốn tên X → hồ sơ số 42"; <em>hồ sơ số 42</em> (inode) ghi cuốn đó nằm ở những ngăn kệ
    nào (block).</p>
    <ul>
      <li><strong>Đường dẫn (path)</strong> như <code>/home/an/baocao.pdf</code> được đọc từng chặng: từ thư
          mục gốc <code>/</code>, tra tên <code>home</code> ra inode, mở nó ra tìm <code>an</code>, rồi tìm
          <code>baocao.pdf</code> — mỗi bước một lần tra bảng tên → inode.</li>
      <li>Vì tên tách khỏi inode, hai tên khác nhau có thể cùng trỏ tới <em>một</em> inode
          (<strong>hard link</strong>) — cùng một file, hai lối vào.</li>
    </ul>
    <div class="callout"><p>💡 Chia file thành block giúp ổ đĩa lấp đầy linh hoạt (không cần chỗ liền), nhưng
    cũng gây phân mảnh giống heap ở bài 09. Xoá file thường chỉ xoá mục "tên → inode" trong thư mục và đánh
    dấu block trống — dữ liệu cũ vẫn còn cho tới khi bị ghi đè (nền tảng của việc khôi phục file).</p></div>
  `,

  codeTabs: [
    { id: "ls", label: "📂 File & inode", lines: [
      "$ ls -li                    # -i hiện số inode",
      "  inode  quyền    kích thước  tên",
      " 131074  -rw-r--r--    1256   baocao.pdf",
      " 131075  drwxr-xr-x    4096   tailieu",
      "",
      "$ stat baocao.pdf           # xem metadata trong inode",
      "  Size: 1256   Blocks: 8   Inode: 131074",
      "  Access: 2026-07-03   Links: 1"
    ]},
    { id: "path", label: "🧭 Đọc đường dẫn", lines: [
      "# Mở /home/an/baocao.pdf — đi từng chặng:",
      "1. Bắt đầu ở thư mục gốc '/'",
      "2. Tra bảng của '/'    : 'home'    -> inode 20",
      "3. Mở inode 20, tra    : 'an'      -> inode 77",
      "4. Mở inode 77, tra    : 'baocao.pdf' -> inode 131074",
      "5. Đọc inode 131074 -> danh sách block chứa nội dung",
      "# Mỗi chặng = một lần tra 'tên -> số inode'"
    ]},
    { id: "block", label: "🧱 Block trên đĩa", lines: [
      "# Nội dung file KHÔNG cần nằm liền nhau",
      "inode 131074 -> block [ 812, 813, 4090, 4091 ]",
      "",
      "Ổ đĩa: [..812..][..813..]......[.4090.][.4091.]",
      "#        ^^^ hai đoạn rời nhau, inode gom chúng lại",
      "$ ln baocao.pdf sao_luu.pdf  # hard link: tên khác, cùng inode",
      "# Cả hai tên trỏ tới inode 131074 — cùng một file"
    ]}
  ],

  stageHtml: `
    <div class="node" id="path"><div class="nl">🧭 Đường dẫn</div><div class="ns">/home/an/baocao.pdf — cách con người gọi file</div></div>
    <div class="arrow" id="a1">↓ đi từng chặng, tra tên → inode</div>
    <div class="node" id="dir"><div class="nl">📁 Thư mục</div><div class="ns">bảng ánh xạ tên → số inode (thẻ mục lục)</div></div>
    <div class="arrow" id="a2">↓ ra được số inode của file</div>
    <div class="node" id="inode"><div class="nl">🪪 Inode</div><div class="ns">metadata + bản đồ các block; KHÔNG chứa tên</div></div>
    <div class="arrow" id="a3">↓ inode trỏ tới các khối chứa nội dung</div>
    <div class="node" id="block"><div class="nl">🧱 Block trên đĩa</div><div class="ns">nội dung thật, có thể nằm rải rác</div></div>
  `,
  steps: [
    { title: "1 · Con người dùng đường dẫn", tab: "path", highlight: [1, 2], on: ["path", "a1"],
      desc: "Ta gọi file bằng <strong>đường dẫn</strong> như <code>/home/an/baocao.pdf</code>, không phải số khối. Hệ thống file là lớp dịch từ tên sang vị trí thật trên đĩa." },
    { title: "2 · Thư mục ánh xạ tên → inode", tab: "path", highlight: [3, 4, 5], on: ["a1", "dir", "a2"],
      desc: "Mỗi <strong>thư mục</strong> là bảng <em>tên → số inode</em>. Đọc đường dẫn là đi từng chặng: tra <code>home</code>, rồi <code>an</code>, rồi <code>baocao.pdf</code> — mỗi bước một lần tra bảng." },
    { title: "3 · Inode giữ metadata", tab: "ls", highlight: [3, 6, 7], on: ["dir", "a2", "inode"],
      desc: "Số inode dẫn tới <strong>inode</strong> — thẻ hồ sơ ghi kích thước, quyền, thời gian và <em>danh sách block</em>. Lưu ý inode <strong>không</strong> chứa tên file; tên nằm ở thư mục." },
    { title: "4 · Inode trỏ tới các block", tab: "block", highlight: [1, 2, 4, 5], on: ["inode", "a3", "block"],
      desc: "Nội dung file nằm trong các <strong>block</strong> trên đĩa, có thể <em>rải rác</em> không liền nhau. Inode là bản đồ gom chúng lại đúng thứ tự." },
    { title: "5 · Một inode, nhiều tên", tab: "block", highlight: [6, 7], on: ["dir", "inode"],
      desc: "Vì tên tách khỏi inode, hai tên có thể cùng trỏ một inode (<strong>hard link</strong>) — cùng một file, hai lối vào. Đó cũng là lý do xoá 'tên' chưa chắc xoá dữ liệu." }
  ],

  quiz: [
    { q: "Vai trò của một inode là gì?", options: [
        "Lưu tên file và mật khẩu mở file",
        "Chứa metadata của file (kích thước, quyền, thời gian) và bản đồ các block chứa nội dung — nhưng không chứa tên file",
        "Là một khối trống trên đĩa",
        "Là thư mục gốc của hệ thống"
      ], correct: 1,
      explanation: "Inode là thẻ hồ sơ của file: metadata + danh sách block. Tên file không nằm trong inode mà nằm ở thư mục." },
    { q: "Thư mục (directory) thực chất chứa gì?", options: [
        "Toàn bộ nội dung của mọi file bên trong nó",
        "Bản sao dự phòng của các file",
        "Một bảng ánh xạ tên file → số inode",
        "Chỉ dung lượng còn trống của ổ đĩa"
      ], correct: 2,
      explanation: "Thư mục là file đặc biệt chứa các cặp 'tên → số inode'; nhờ đó tên người-đọc-được dẫn tới hồ sơ inode." },
    { q: "Khi mở '/home/an/baocao.pdf', hệ thống file làm gì?", options: [
        "Đọc thẳng một block duy nhất chứa cả file",
        "Đi từng chặng từ thư mục gốc, mỗi chặng tra 'tên → inode' cho tới khi ra inode của file",
        "Tìm kiếm toàn bộ ổ đĩa cho tới khi thấy tên trùng",
        "Hỏi người dùng vị trí block"
      ], correct: 1,
      explanation: "Đường dẫn được phân giải từng bậc: '/' → home → an → baocao.pdf, mỗi bậc là một lần tra bảng tên-sang-inode." },
    { q: "Vì sao nội dung một file có thể nằm ở các block không liền nhau trên đĩa?", options: [
        "Vì đĩa lấp đầy linh hoạt từng block, và inode giữ danh sách block nên vẫn gom lại được đúng thứ tự",
        "Vì file bị lỗi nên vỡ vụn",
        "Vì mỗi block chỉ chứa đúng một ký tự",
        "Vì hệ thống file cố tình làm chậm việc đọc"
      ], correct: 0,
      explanation: "Chia thành block cho phép dùng bất kỳ chỗ trống nào; inode lưu danh sách block để ráp nội dung lại — đổi lại có thể gây phân mảnh." }
  ]
});
