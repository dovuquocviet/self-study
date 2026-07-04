window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Tiến trình & Luồng",
  title: "Lập lịch CPU (scheduling)",
  subtitle: "Một CPU, nhiều việc — chia lượt cho ai?",

  theory: `
    <p>Máy bạn chạy hàng trăm tiến trình, nhưng CPU (mỗi nhân) chỉ làm được <strong>một việc tại một thời
    điểm</strong>. Vậy vì sao trình duyệt, nhạc và trình soạn thảo dường như chạy <em>cùng lúc</em>? Vì HĐH
    <strong>chuyển đổi cực nhanh</strong> giữa chúng, mỗi tiến trình được một <strong>lượt thời gian nhỏ</strong>
    rồi nhường cho tiến trình sau. Bộ phận quyết định "tới lượt ai" gọi là <strong>bộ lập lịch (scheduler)</strong>.</p>
    <p>Hãy nghĩ tới một <strong>quầy phục vụ duy nhất</strong> với nhiều khách xếp hàng. Nhân viên không phục
    vụ xong hẳn một khách rồi mới sang khách sau nếu việc quá dài — họ dành cho mỗi khách một khoảng ngắn rồi
    xoay vòng, để không ai phải chờ mãi.</p>
    <ul>
      <li><strong>Round-robin</strong>: mỗi tiến trình được một <em>time slice (quantum)</em> bằng nhau, hết
          thì xuống cuối hàng. Công bằng, không ai bị bỏ đói.</li>
      <li><strong>Priority (ưu tiên)</strong>: việc quan trọng (âm thanh, giao diện) được ưu tiên cao hơn việc
          nền (tải file). Rủi ro: việc ưu tiên thấp có thể bị chờ lâu.</li>
    </ul>
    <p>Mỗi lần đổi tiến trình, kernel làm một <strong>context switch (chuyển ngữ cảnh)</strong>: <em>lưu</em>
    trạng thái CPU của tiến trình đang chạy vào PCB của nó, rồi <em>nạp</em> trạng thái của tiến trình kế
    tiếp. Nhờ đó tiến trình bị tạm dừng vẫn tiếp tục đúng chỗ khi tới lượt lại.</p>
    <div class="callout"><p>💡 Context switch không miễn phí — nó tốn chút CPU cho việc lưu/nạp. Time slice
    quá ngắn → chuyển đổi liên tục, phí sức; quá dài → app kém phản hồi. HĐH phải cân bằng.</p></div>
  `,

  codeTabs: [
    { id: "rr", label: "🔁 Round-robin", lines: [
      "# 3 tiến trình A, B, C; quantum = 1 đơn vị thời gian",
      "Thời điểm:  1  2  3  4  5  6  7",
      "CPU chạy:   A  B  C  A  B  C  A",
      "# Mỗi tiến trình được 1 lượt rồi xuống cuối hàng",
      "# → không ai phải chờ quá lâu, chia đều CPU"
    ]},
    { id: "prio", label: "⭐ Ưu tiên", lines: [
      "$ nice -n 10 ./backup.sh    # ưu tiên THẤP (nhường CPU)",
      "$ nice -n -5 ./audio_engine # ưu tiên CAO (giành CPU)",
      "",
      "$ ps -eo pid,ni,comm | head",
      "  PID  NI COMMAND",
      " 5001  10 backup.sh   # NI cao = 'tử tế', chịu nhường",
      " 5002  -5 audio_engine# NI thấp = được ưu tiên chạy trước"
    ]},
    { id: "ctx", label: "🔀 Context switch", lines: [
      "Đang chạy A  -> hết time slice / cần chờ I/O",
      "  1. LƯU thanh ghi + con trỏ lệnh của A vào PCB(A)",
      "  2. Bộ lập lịch chọn tiến trình kế: B",
      "  3. NẠP thanh ghi + con trỏ lệnh của B từ PCB(B)",
      "Đang chạy B  -> A tạm dừng, sẽ tiếp tục đúng chỗ sau"
    ]}
  ],

  stageHtml: `
    <div class="node" id="queue"><div class="nl">🚶 Hàng chờ (ready)</div><div class="ns">nhiều tiến trình sẵn sàng, chờ CPU</div></div>
    <div class="arrow" id="a1">↓ bộ lập lịch chọn 'tới lượt ai'</div>
    <div class="node" id="sched"><div class="nl">🎯 Bộ lập lịch</div><div class="ns">round-robin / ưu tiên → chọn 1 tiến trình</div></div>
    <div class="arrow" id="a2">↓ đưa lên CPU trong 1 time slice</div>
    <div class="node" id="cpu"><div class="nl">⚙️ CPU (1 nhân)</div><div class="ns">chạy tiến trình được chọn</div></div>
    <div class="arrow" id="a3">↓ hết lượt → context switch, lưu/nạp trạng thái</div>
    <div class="node" id="back"><div class="nl">🔄 Quay vòng</div><div class="ns">tiến trình về cuối hàng, chọn người kế tiếp</div></div>
  `,
  steps: [
    { title: "1 · Nhiều việc, một CPU", tab: "rr", highlight: [1, 2], on: ["queue", "a1", "sched"],
      desc: "Nhiều tiến trình cùng ở trạng thái <strong>ready</strong>, xếp hàng chờ. CPU chỉ làm một việc mỗi lúc, nên cần <strong>bộ lập lịch</strong> quyết định tới lượt ai." },
    { title: "2 · Round-robin chia đều", tab: "rr", highlight: [3, 4, 5], on: ["sched", "a2", "cpu"],
      desc: "Với <strong>round-robin</strong>, mỗi tiến trình được một <em>time slice</em> bằng nhau rồi xuống cuối hàng. A, B, C xoay vòng — công bằng, không ai bị bỏ đói." },
    { title: "3 · Ưu tiên cho việc quan trọng", tab: "prio", highlight: [1, 2], on: ["sched", "cpu"],
      desc: "Với lập lịch <strong>ưu tiên</strong>, việc quan trọng (<code>audio_engine</code>) được chạy trước việc nền (<code>backup.sh</code>). Lệnh <code>nice</code> chỉnh mức ưu tiên." },
    { title: "4 · Hết lượt → context switch", tab: "ctx", highlight: [1, 2], on: ["cpu", "a3", "back"],
      desc: "Hết time slice, kernel làm <strong>context switch</strong>: <em>lưu</em> thanh ghi và con trỏ lệnh của tiến trình đang chạy vào PCB của nó." },
    { title: "5 · Nạp tiến trình kế tiếp", tab: "ctx", highlight: [3, 4, 5], on: ["back", "cpu"],
      desc: "Kernel <em>nạp</em> trạng thái tiến trình kế từ PCB của nó và cho chạy tiếp đúng chỗ. Nhờ lưu/nạp này, tiến trình bị tạm dừng không mất dữ liệu đang làm dở." },
    { title: "6 · Cái giá của chuyển đổi", tab: "ctx", highlight: [2, 3], on: ["cpu", "back"],
      desc: "Mỗi context switch tốn chút CPU. Time slice <strong>quá ngắn</strong> → chuyển liên tục, phí sức; <strong>quá dài</strong> → app kém phản hồi. HĐH phải cân bằng." }
  ],

  quiz: [
    { q: "Vì sao nhiều chương trình dường như chạy cùng lúc dù CPU (một nhân) chỉ làm một việc mỗi thời điểm?", options: [
        "Vì mỗi chương trình có một CPU riêng ẩn bên trong",
        "Vì HĐH chuyển đổi cực nhanh giữa các tiến trình, mỗi tiến trình một lượt thời gian ngắn",
        "Vì các chương trình tự chia sẻ mã cho nhau",
        "Vì CPU nhân đôi tín hiệu điện"
      ], correct: 1,
      explanation: "Bộ lập lịch xoay vòng nhanh, mỗi tiến trình một time slice nhỏ, tạo ảo giác chạy song song." },
    { q: "Đặc điểm của lập lịch round-robin là gì?", options: [
        "Luôn chạy xong hẳn một tiến trình rồi mới sang tiến trình khác",
        "Chỉ chạy tiến trình có ưu tiên cao nhất, bỏ qua phần còn lại",
        "Cấp cho mỗi tiến trình một time slice bằng nhau rồi xoay vòng, chia đều CPU",
        "Chọn tiến trình ngẫu nhiên mỗi mili-giây"
      ], correct: 2,
      explanation: "Round-robin phát cho mỗi tiến trình một quantum bằng nhau, hết lượt xuống cuối hàng — công bằng, không bỏ đói." },
    { q: "Context switch (chuyển ngữ cảnh) làm gì?", options: [
        "Lưu trạng thái CPU của tiến trình hiện tại, rồi nạp trạng thái của tiến trình kế tiếp",
        "Xoá bộ nhớ của tiến trình cũ để lấy chỗ",
        "Đổi ngôn ngữ hiển thị của hệ điều hành",
        "Tăng tốc độ xung nhịp CPU"
      ], correct: 0,
      explanation: "Kernel lưu thanh ghi + con trỏ lệnh vào PCB tiến trình cũ, rồi nạp của tiến trình mới, để mỗi cái tiếp tục đúng chỗ." },
    { q: "Nhược điểm khi đặt time slice quá ngắn là gì?", options: [
        "Các tiến trình ưu tiên thấp bị bỏ đói vĩnh viễn",
        "CPU tốn nhiều thời gian cho việc context switch liên tục, giảm hiệu quả",
        "Máy không thể khởi động được",
        "Tiến trình mất dữ liệu mỗi lần chuyển"
      ], correct: 1,
      explanation: "Time slice quá ngắn nghĩa là chuyển đổi quá thường xuyên; mỗi lần chuyển tốn CPU nên phần lớn sức bị phí." }
  ]
});
