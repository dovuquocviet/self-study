window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Hệ thống file",
  title: "Quyền & thực thi: chmod, permission bits",
  subtitle: "rwx cho user/group/other; chmod 755; chạy ./script",

  theory: `
    <p>Mỗi file và thư mục đều mang một tấm "thẻ quyền" quyết định <em>ai được làm gì</em> với nó. Đây là
    nền tảng bảo mật của cả hệ thống. Khi gõ <code>ls -l</code>, cột đầu tiên như <code>-rwxr-xr-x</code>
    chính là tấm thẻ đó.</p>
    <p>Có <strong>ba loại quyền</strong>, viết tắt <strong>rwx</strong>:</p>
    <ul>
      <li><strong>r</strong> (read) — đọc: xem nội dung file / liệt kê thư mục.</li>
      <li><strong>w</strong> (write) — ghi: sửa hoặc xoá.</li>
      <li><strong>x</strong> (execute) — thực thi: chạy file như một chương trình / đi vào thư mục.</li>
    </ul>
    <p>Và <strong>ba nhóm người</strong>, mỗi nhóm có riêng bộ rwx:</p>
    <ul>
      <li><strong>user</strong> (u) — chủ sở hữu file.</li>
      <li><strong>group</strong> (g) — nhóm cùng làm việc.</li>
      <li><strong>other</strong> (o) — mọi người còn lại.</li>
    </ul>
    <p>Vì mỗi nhóm có 3 quyền, người ta mã hoá bằng <strong>số bát phân</strong>: r=4, w=2, x=1, cộng lại.
    Ví dụ <code>rwx</code> = 4+2+1 = <strong>7</strong>; <code>r-x</code> = 4+0+1 = <strong>5</strong>. Vậy
    <code>chmod 755</code> nghĩa là: chủ = 7 (rwx), nhóm = 5 (r-x), người khác = 5 (r-x).</p>
    <p>Điều bất ngờ với người mới: một script mới viết <em>chưa chạy được</em> vì thiếu quyền <code>x</code>.
    Bạn phải cấp quyền thực thi rồi mới gọi được.</p>
    <div class="callout"><p>💡 Vì sao gọi script bằng <code>./run.sh</code> chứ không phải <code>run.sh</code>?
    Dấu <code>./</code> nói rõ "chương trình nằm ngay thư mục hiện tại". Không có nó, shell chỉ tìm trong
    các thư mục hệ thống (PATH) và sẽ báo "command not found".</p></div>
  `,

  codeTabs: [
    { id: "read", label: "🔍 Đọc thẻ quyền", lines: [
      "$ ls -l run.sh",
      "-rw-r--r--  1 an  staff  120 Jul  3 run.sh",
      "# Giải mã 9 ký tự sau dấu -:",
      "#  rw-   r--   r--",
      "#  user  group other",
      "# user: đọc+ghi | group: chỉ đọc | other: chỉ đọc",
      "# → THIẾU x ở mọi nhóm → chưa chạy được!"
    ]},
    { id: "chmod", label: "🔑 chmod cấp quyền", lines: [
      "# Cấp quyền thực thi cho chủ file",
      "$ chmod +x run.sh",
      "$ ls -l run.sh",
      "-rwxr--r--  1 an  staff  120 Jul  3 run.sh",
      "# Hoặc đặt cả bộ bằng số: 7=rwx 5=r-x",
      "$ chmod 755 run.sh",
      "$ ls -l run.sh",
      "-rwxr-xr-x  1 an  staff  120 Jul  3 run.sh"
    ]},
    { id: "runit", label: "▶️ Chạy script", lines: [
      "# Gõ trần → shell tìm trong PATH, không thấy",
      "$ run.sh",
      "zsh: command not found: run.sh",
      "# ./ nói rõ: file ngay tại thư mục này",
      "$ ./run.sh",
      "Xin chao tu script!",
      "# → chạy được vì đã có quyền x + chỉ đúng chỗ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="bits"><div class="nl">🏷️ -rw-r--r--</div><div class="ns">thẻ quyền hiện tại: thiếu x</div></div>
    <div class="arrow" id="a1">↓ tách 9 ký tự thành 3 nhóm</div>
    <div class="row">
      <div class="node" id="u"><div class="nl">👤 user (7=rwx)</div><div class="ns">chủ file: đọc+ghi+chạy</div></div>
      <div class="node" id="g"><div class="nl">👥 group (5=r-x)</div><div class="ns">nhóm: đọc+chạy</div></div>
      <div class="node" id="o"><div class="nl">🌍 other (5=r-x)</div><div class="ns">còn lại: đọc+chạy</div></div>
    </div>
    <div class="arrow" id="a2">↓ chmod 755 (hoặc +x) cấp quyền x</div>
    <div class="node" id="exec"><div class="nl">🔑 -rwxr-xr-x</div><div class="ns">giờ đã có quyền thực thi</div></div>
    <div class="arrow" id="a3">↓ gọi bằng ./ (chỉ đúng chỗ)</div>
    <div class="node" id="run"><div class="nl">▶️ ./run.sh chạy</div><div class="ns">in ra kết quả của script</div></div>
  `,
  steps: [
    { title: "1 · Đọc thẻ quyền", tab: "read", highlight: [1, 2], on: ["bits"],
      desc: "<code>ls -l</code> hiện cột quyền như <code>-rw-r--r--</code>. Ký tự đầu là loại (<code>-</code> = file thường), 9 ký tự sau là ba nhóm quyền." },
    { title: "2 · Tách rwx theo nhóm", tab: "read", highlight: [3, 4, 5, 6], on: ["bits", "a1", "u"],
      desc: "Chia 9 ký tự thành 3 phần: <strong>user</strong> · <strong>group</strong> · <strong>other</strong>. Mỗi phần đọc lần lượt r (đọc), w (ghi), x (chạy). Dấu <code>-</code> = không có quyền đó." },
    { title: "3 · Nhận ra vì sao chưa chạy", tab: "read", highlight: [7], on: ["u", "g", "o"],
      desc: "Ở đây mọi nhóm đều thiếu <code>x</code>, nên dù file là script, hệ thống <strong>không cho chạy</strong>. Đây là lỗi phổ biến nhất khi mới viết script." },
    { title: "4 · Cấp quyền với chmod +x", tab: "chmod", highlight: [1, 2, 3, 4], on: ["exec"],
      desc: "<code>chmod +x run.sh</code> thêm quyền thực thi. Cột quyền đổi thành có <code>x</code> — script sẵn sàng chạy." },
    { title: "5 · Đặt cả bộ bằng số", tab: "chmod", highlight: [5, 6, 7, 8], on: ["a2", "exec", "u", "g", "o"],
      desc: "<code>chmod 755</code> đặt gọn cả ba nhóm: 7 = rwx (chủ toàn quyền), 5 = r-x (nhóm và người khác đọc + chạy nhưng không sửa). Nhớ: r=4, w=2, x=1." },
    { title: "6 · Chạy bằng ./", tab: "runit", highlight: [1, 2, 3, 4, 5, 6], on: ["a3", "run"],
      desc: "Gõ <code>run.sh</code> trần bị báo <em>command not found</em> vì shell chỉ tìm trong PATH. Thêm <code>./</code> để chỉ rõ file nằm ngay thư mục hiện tại — giờ script chạy." }
  ],

  quiz: [
    { q: "Trong bộ quyền, chữ <code>x</code> cho phép điều gì với một file?", options: [
        "Đọc nội dung file",
        "Ghi/sửa file",
        "Thực thi file như một chương trình",
        "Xoá file"
      ], correct: 2,
      explanation: "r = đọc, w = ghi/sửa, x = thực thi (chạy). Một script thiếu x thì không chạy được." },
    { q: "<code>chmod 755</code> cấp quyền gì cho từng nhóm?", options: [
        "Cả ba nhóm đều rwx",
        "user = rwx, group = r-x, other = r-x",
        "user = r--, group = r--, other = rwx",
        "Không nhóm nào có quyền x"
      ], correct: 1,
      explanation: "7 = 4+2+1 = rwx cho chủ; 5 = 4+0+1 = r-x cho group và other (đọc + chạy, không ghi)." },
    { q: "Vì sao phải gõ <code>./run.sh</code> thay vì <code>run.sh</code> để chạy script trong thư mục hiện tại?", options: [
        "Vì ./ cấp quyền thực thi cho file",
        "Vì ./ chỉ rõ file nằm ngay thư mục hiện tại, còn gõ trần thì shell chỉ tìm trong PATH",
        "Vì run.sh là tên bị cấm",
        "Vì ./ chạy nhanh hơn"
      ], correct: 1,
      explanation: "Khi gõ tên trần, shell chỉ dò các thư mục trong PATH. Dấu ./ nói rõ chương trình ở ngay đây." },
    { q: "Bạn vừa viết xong <code>deploy.sh</code> nhưng chạy thì báo lỗi thiếu quyền. Bước cần làm là gì?", options: [
        "chmod +x deploy.sh để thêm quyền thực thi",
        "Đổi tên file thành deploy.exe",
        "Xoá rồi tạo lại file",
        "Chạy bằng cd deploy.sh"
      ], correct: 0,
      explanation: "File mới thường chưa có quyền x; chmod +x cấp quyền thực thi để có thể chạy nó bằng ./deploy.sh." }
  ]
});
