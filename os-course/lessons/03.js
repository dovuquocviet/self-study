window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Tiến trình & Luồng",
  title: "Tiến trình (process) & PCB",
  subtitle: "Chương trình đang chạy, và cuốn sổ theo dõi nó",

  theory: `
    <p>Đừng nhầm <strong>chương trình</strong> với <strong>tiến trình</strong>. Một <em>chương trình</em> chỉ
    là file nằm im trên đĩa — như một <strong>công thức nấu ăn</strong> ghi trên giấy. Khi bạn chạy nó, HĐH
    tạo ra một <em>tiến trình</em>: bản thực thi đang sống — như <strong>một đầu bếp đang thực sự nấu</strong>
    theo công thức đó, có nguyên liệu (bộ nhớ), có vị trí đang đọc tới (con trỏ lệnh).</p>
    <p>Cùng một công thức có thể có ba đầu bếp nấu song song: một chương trình có thể chạy thành nhiều tiến
    trình độc lập, mỗi tiến trình có <strong>không gian bộ nhớ riêng</strong> và một số định danh
    <strong>PID</strong> (Process ID).</p>
    <p>Để theo dõi từng tiến trình, kernel giữ một <strong>PCB (Process Control Block)</strong> — "cuốn sổ hồ
    sơ" cho mỗi tiến trình, ghi:</p>
    <ul>
      <li><strong>PID</strong> và PID của tiến trình cha;</li>
      <li><strong>Trạng thái</strong> hiện tại (đang chạy? đang chờ?);</li>
      <li><strong>Nội dung thanh ghi CPU</strong> và con trỏ lệnh — để có thể tạm dừng rồi tiếp tục đúng chỗ;</li>
      <li>Thông tin bộ nhớ, danh sách file đang mở, mức ưu tiên…</li>
    </ul>
    <p>Một tiến trình di chuyển qua các <strong>trạng thái</strong>:</p>
    <div class="callout"><p>💡 <em>new</em> (vừa tạo) → <em>ready</em> (sẵn sàng, chờ tới lượt CPU) →
    <em>running</em> (đang chạy trên CPU) → có thể quay lại <em>ready</em> khi hết lượt, hoặc sang
    <em>waiting</em> khi phải chờ (ví dụ chờ đọc đĩa) → cuối cùng <em>terminated</em> (kết thúc).</p></div>
  `,

  codeTabs: [
    { id: "ps", label: "🔍 Xem tiến trình", lines: [
      "$ ps -eo pid,ppid,state,comm",
      "  PID  PPID S COMMAND",
      "    1     0 S systemd     # PID 1, cha của mọi tiến trình",
      " 2048     1 S sshd",
      " 4096  2048 R bash        # R = running/ready",
      " 4210  4096 S sleep       # S = sleeping (waiting)",
      "# Cùng 'bash' có thể chạy thành nhiều tiến trình PID khác nhau"
    ]},
    { id: "states", label: "🔁 Vòng trạng thái", lines: [
      "new       -> ready       # vừa tạo, xếp hàng chờ CPU",
      "ready     -> running     # bộ lập lịch chọn nó lên CPU",
      "running   -> ready       # hết lượt (time slice) → xuống hàng",
      "running   -> waiting     # cần đọc đĩa/mạng → nhường CPU",
      "waiting   -> ready       # dữ liệu về → sẵn sàng chạy tiếp",
      "running   -> terminated  # gọi exit() → kết thúc"
    ]}
  ],

  stageHtml: `
    <div class="node" id="new"><div class="nl">🥚 new</div><div class="ns">tiến trình vừa được tạo</div></div>
    <div class="arrow" id="a1">↓ nạp xong, xếp vào hàng chờ</div>
    <div class="node" id="ready"><div class="nl">⏳ ready</div><div class="ns">sẵn sàng, chờ tới lượt CPU</div></div>
    <div class="arrow" id="a2">↕ lập lịch đưa lên / hết lượt đưa xuống</div>
    <div class="node" id="running"><div class="nl">🏃 running</div><div class="ns">đang thực thi trên CPU</div></div>
    <div class="arrow" id="a3">↓ cần chờ I/O → nhường CPU</div>
    <div class="node" id="waiting"><div class="nl">😴 waiting</div><div class="ns">chờ đĩa/mạng; dữ liệu về thì quay lại ready</div></div>
    <div class="arrow" id="a4">↓ gọi exit()</div>
    <div class="node" id="term"><div class="nl">✅ terminated</div><div class="ns">kết thúc, kernel dọn PCB</div></div>
  `,
  steps: [
    { title: "1 · Chương trình thành tiến trình", tab: "ps", highlight: [3, 5], on: ["new", "ready"],
      desc: "Khi chạy, chương trình (file trên đĩa) biến thành <strong>tiến trình</strong> có <code>PID</code> riêng và bộ nhớ riêng. Cùng một chương trình có thể thành nhiều tiến trình độc lập." },
    { title: "2 · Xếp hàng chờ CPU (ready)", tab: "states", highlight: [1, 2], on: ["ready", "a2", "running"],
      desc: "Tiến trình mới vào trạng thái <strong>ready</strong> — đã sẵn sàng nhưng phải chờ tới lượt. Bộ lập lịch sẽ chọn nó lên CPU (running)." },
    { title: "3 · Đang chạy (running)", tab: "states", highlight: [3], on: ["running", "a2", "ready"],
      desc: "Trên CPU, tiến trình ở trạng thái <strong>running</strong>. Khi hết <em>time slice</em> (lượt thời gian), nó bị đưa lại xuống <strong>ready</strong> để nhường máy cho tiến trình khác." },
    { title: "4 · Phải chờ (waiting)", tab: "states", highlight: [4, 5], on: ["running", "a3", "waiting"],
      desc: "Nếu cần đọc đĩa hay chờ mạng, tiến trình tự nhường CPU và sang <strong>waiting</strong>. Nó không phí CPU để ngồi chờ; khi dữ liệu về, nó quay lại <strong>ready</strong>." },
    { title: "5 · Kết thúc (terminated)", tab: "states", highlight: [6], on: ["waiting", "a4", "term"],
      desc: "Gọi <code>exit()</code>, tiến trình sang <strong>terminated</strong>. Kernel dọn dẹp và giải phóng <strong>PCB</strong> — cuốn sổ hồ sơ đã theo dõi nó suốt vòng đời." }
  ],

  quiz: [
    { q: "Khác biệt giữa 'chương trình' và 'tiến trình' là gì?", options: [
        "Chương trình chạy nhanh hơn tiến trình",
        "Chương trình là file nằm im trên đĩa; tiến trình là bản đang thực thi, có bộ nhớ và trạng thái riêng",
        "Tiến trình chỉ tồn tại trong kernel, chương trình chỉ trong user space",
        "Chúng là hai tên gọi của cùng một thứ"
      ], correct: 1,
      explanation: "Chương trình là công thức trên giấy; tiến trình là đầu bếp đang thực sự nấu — bản thực thi sống, có PID, bộ nhớ và trạng thái riêng." },
    { q: "PCB (Process Control Block) dùng để làm gì?", options: [
        "Lưu mã nguồn của chương trình",
        "Là bảng mạch điều khiển tiến trình trong CPU",
        "Là hồ sơ kernel giữ cho mỗi tiến trình: PID, trạng thái, thanh ghi, bộ nhớ, file đang mở",
        "Là bộ nhớ đệm giữa CPU và RAM"
      ], correct: 2,
      explanation: "PCB là cuốn sổ hồ sơ cho mỗi tiến trình, đủ để kernel tạm dừng rồi tiếp tục nó đúng chỗ." },
    { q: "Khi một tiến trình đang chạy cần đọc dữ liệu từ ổ đĩa, nó thường chuyển sang trạng thái nào?", options: [
        "terminated (kết thúc ngay)",
        "new (tạo lại từ đầu)",
        "waiting (chờ), nhường CPU cho tiến trình khác",
        "vẫn giữ running và chiếm CPU để chờ"
      ], correct: 2,
      explanation: "Chờ I/O thì sang waiting và nhường CPU, tránh lãng phí; khi dữ liệu về nó quay lại ready." },
    { q: "Vì sao một tiến trình đang running lại bị đưa về trạng thái ready dù chưa xong việc?", options: [
        "Vì nó hết lượt thời gian (time slice), phải nhường CPU cho tiến trình khác",
        "Vì nó bị lỗi và phải khởi động lại",
        "Vì kernel xoá bộ nhớ của nó",
        "Vì người dùng luôn tắt nó thủ công"
      ], correct: 0,
      explanation: "Để chia sẻ công bằng, bộ lập lịch giới hạn mỗi lượt bằng time slice; hết lượt, tiến trình về ready chờ lượt sau." }
  ]
});
