window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Hệ thống file",
  title: "Thao tác file: cp, mv, rm, mkdir, cat",
  subtitle: "Tạo, xem, sao chép, di chuyển, xoá — và cảnh giác với rm -r",

  theory: `
    <p>Điều hướng xong, giờ tới lúc <em>làm việc</em> với file. Năm lệnh dưới đây là bộ đồ nghề cơ bản mà
    bạn sẽ dùng hàng ngày.</p>
    <ul>
      <li><code>mkdir ten_tm</code> — <strong>make directory</strong>: tạo thư mục mới.</li>
      <li><code>cat ten_file</code> — in nội dung file ra màn hình (xem nhanh file văn bản).</li>
      <li><code>cp nguon dich</code> — <strong>copy</strong>: sao chép. Bản gốc <em>vẫn còn</em>.</li>
      <li><code>mv nguon dich</code> — <strong>move</strong>: di chuyển hoặc đổi tên. Bản gốc
      <em>biến mất</em> khỏi chỗ cũ.</li>
      <li><code>rm ten_file</code> — <strong>remove</strong>: xoá. Ở dòng lệnh <em>không có Thùng rác</em>
      — xoá là mất vĩnh viễn.</li>
    </ul>
    <p>Mẹo nhớ <code>cp</code> vs <code>mv</code>: cp như <em>photocopy</em> (có thêm bản mới, giữ bản cũ),
    mv như <em>chuyển nhà</em> (đồ rời khỏi chỗ cũ sang chỗ mới). Thú vị là <code>mv cu.txt moi.txt</code>
    trong cùng một thư mục chính là cách <strong>đổi tên</strong> file.</p>
    <p>Mặc định <code>cp</code> và <code>rm</code> chỉ làm việc với một file. Muốn tác động cả một thư mục
    (kèm mọi thứ bên trong) phải thêm cờ <code>-r</code> (recursive — đệ quy, đi vào từng ngóc ngách).</p>
    <div class="callout"><p>💡 <strong>Cảnh báo:</strong> <code>rm -r thu_muc</code> xoá sạch thư mục và
    TẤT CẢ nội dung, không hỏi lại, không phục hồi được. Câu lệnh nguy hiểm nhất là <code>rm -rf /</code>
    (xoá từ gốc). Trước khi gõ rm, hãy <code>ls</code> để chắc chắn bạn đang xoá đúng thứ; dùng
    <code>rm -i</code> để nó hỏi xác nhận từng file khi chưa quen.</p></div>
  `,

  codeTabs: [
    { id: "make", label: "🛠️ Tạo & xem", lines: [
      "# Tạo thư mục rồi vào",
      "$ mkdir ghi_chu",
      "$ cd ghi_chu",
      "# Tạo nhanh một file có nội dung",
      "$ echo \"Mua sua\" > viec.txt",
      "# Xem nội dung file",
      "$ cat viec.txt",
      "Mua sua"
    ]},
    { id: "cpmv", label: "📄 cp & mv", lines: [
      "# Sao chép: bản gốc viec.txt vẫn còn",
      "$ cp viec.txt viec_backup.txt",
      "$ ls",
      "viec.txt  viec_backup.txt",
      "# Đổi tên (mv trong cùng thư mục)",
      "$ mv viec.txt todo.txt",
      "$ ls",
      "todo.txt  viec_backup.txt"
    ]},
    { id: "remove", label: "🗑️ rm (cẩn thận)", lines: [
      "# Xoá một file — KHÔNG có thùng rác",
      "$ rm viec_backup.txt",
      "# Xoá cả thư mục cần cờ -r (đệ quy)",
      "$ cd ..",
      "$ rm -r ghi_chu",
      "# rm -i sẽ hỏi trước mỗi file",
      "$ rm -i quan_trong.txt",
      "remove quan_trong.txt? "
    ]}
  ],

  stageHtml: `
    <div class="node" id="mkdir"><div class="nl">📁 mkdir ghi_chu</div><div class="ns">tạo thư mục trống</div></div>
    <div class="arrow" id="a1">↓ tạo file bên trong, cat để xem</div>
    <div class="node" id="file"><div class="nl">📄 viec.txt</div><div class="ns">một file văn bản</div></div>
    <div class="arrow" id="a2">↓ cp: nhân đôi (giữ bản gốc)</div>
    <div class="row">
      <div class="node" id="copy"><div class="nl">📄📄 cp → 2 bản</div><div class="ns">gốc + bản sao cùng tồn tại</div></div>
      <div class="node" id="move"><div class="nl">➡️ mv → đổi chỗ/tên</div><div class="ns">bản gốc rời đi, chỉ còn 1</div></div>
    </div>
    <div class="arrow" id="a3">↓ rm: xoá vĩnh viễn (rm -r cho thư mục)</div>
    <div class="node" id="gone"><div class="nl">💥 rm → biến mất</div><div class="ns">không thùng rác, không hoàn tác</div></div>
  `,
  steps: [
    { title: "1 · Tạo thư mục & file", tab: "make", highlight: [1, 2, 3], on: ["mkdir"],
      desc: "<code>mkdir ghi_chu</code> tạo một thư mục trống, rồi <code>cd</code> vào. Đây là bước dựng chỗ chứa trước khi làm việc." },
    { title: "2 · Xem nội dung với cat", tab: "make", highlight: [4, 5, 6, 7, 8], on: ["mkdir", "a1", "file"],
      desc: "<code>echo ... &gt; viec.txt</code> tạo file có nội dung; <code>cat viec.txt</code> in nội dung ra màn hình. <code>cat</code> là cách xem nhanh file văn bản ngắn." },
    { title: "3 · Sao chép với cp", tab: "cpmv", highlight: [1, 2, 3, 4], on: ["file", "a2", "copy"],
      desc: "<code>cp viec.txt viec_backup.txt</code> tạo một <strong>bản sao</strong>. Bản gốc vẫn nguyên — giờ có hai file. cp giống photocopy." },
    { title: "4 · Di chuyển / đổi tên với mv", tab: "cpmv", highlight: [5, 6, 7, 8], on: ["copy", "move"],
      desc: "<code>mv viec.txt todo.txt</code> trong cùng thư mục chính là <strong>đổi tên</strong>: file cũ biến mất, thành file mới. mv giống chuyển nhà — đồ rời khỏi chỗ cũ." },
    { title: "5 · Xoá file với rm", tab: "remove", highlight: [1, 2], on: ["move", "a3", "gone"],
      desc: "<code>rm viec_backup.txt</code> xoá file <strong>vĩnh viễn</strong>. Dòng lệnh không có Thùng rác, nên hãy chắc chắn trước khi nhấn Enter." },
    { title: "6 · rm -r và cách an toàn", tab: "remove", highlight: [3, 4, 5, 6, 7, 8], on: ["gone"],
      desc: "Xoá cả thư mục cần <code>rm -r</code> (đệ quy) — rất mạnh và rất nguy hiểm. Khi chưa quen, dùng <code>rm -i</code> để nó hỏi xác nhận từng file. Tuyệt đối tránh <code>rm -rf /</code>." }
  ],

  quiz: [
    { q: "Khác biệt cốt lõi giữa <code>cp</code> và <code>mv</code> là gì?", options: [
        "cp nhanh hơn mv",
        "cp giữ lại bản gốc và tạo bản sao; mv làm bản gốc rời khỏi chỗ cũ",
        "mv chỉ dùng cho thư mục, cp chỉ dùng cho file",
        "Chúng hoàn toàn giống nhau"
      ], correct: 1,
      explanation: "cp nhân đôi (gốc còn nguyên), mv di chuyển/đổi tên nên bản gốc biến mất khỏi vị trí cũ." },
    { q: "Vì sao <code>rm</code> ở dòng lệnh nguy hiểm hơn xoá file bằng chuột trên desktop?", options: [
        "Vì rm chạy chậm",
        "Vì rm chỉ xoá được file ẩn",
        "Vì rm xoá vĩnh viễn, không có Thùng rác và không hoàn tác được",
        "Vì rm cần mật khẩu mỗi lần"
      ], correct: 2,
      explanation: "Trên desktop file vào Thùng rác; còn rm xoá thẳng, không phục hồi được — nên phải cẩn thận." },
    { q: "Bạn muốn xoá cả một thư mục kèm mọi thứ bên trong. Cần thêm cờ nào?", options: [
        "-r (đệ quy)",
        "-l",
        "-a",
        "Không cần cờ, rm tự xoá thư mục"
      ], correct: 0,
      explanation: "Mặc định rm chỉ xoá file; muốn xoá thư mục và toàn bộ nội dung phải dùng rm -r (recursive)." },
    { q: "Lệnh <code>mv baocao.txt bao_cao_cu.txt</code> trong cùng một thư mục thực chất làm gì?", options: [
        "Tạo thêm một bản sao",
        "Đổi tên file baocao.txt thành bao_cao_cu.txt",
        "Xoá file baocao.txt",
        "In nội dung file ra màn hình"
      ], correct: 1,
      explanation: "Khi nguồn và đích ở cùng thư mục, mv chính là thao tác đổi tên: file cũ trở thành tên mới." }
  ]
});
