window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Pipeline đầu tiên",
  title: "Job & script — viên gạch đầu tiên",
  subtitle: "Cấu tạo một job, script chạy gì, before/after_script, khi nào job đỏ",

  theory: `
    <p>Một <strong>job</strong> chỉ cần hai thứ để tồn tại: một <em>cái tên</em> (do bạn đặt) và một khoá
    <code>script</code> liệt kê các lệnh cần chạy. Runner sẽ chạy từng lệnh trong <code>script</code> theo
    thứ tự, như thể bạn tự gõ chúng trên terminal.</p>
    <p>Điều quan trọng nhất về một job là <strong>khi nào nó xanh, khi nào nó đỏ</strong>:</p>
    <ul>
      <li>Mỗi lệnh trả về một <strong>mã thoát</strong> (exit code). <code>0</code> = thành công, khác 0 = lỗi.</li>
      <li>Nếu một lệnh trả mã khác 0, job <strong>dừng ngay</strong> tại đó và bị đánh dấu <em>failed</em> (đỏ).
      Các lệnh sau không chạy nữa.</li>
      <li>Chỉ khi <em>mọi</em> lệnh trong <code>script</code> đều trả 0, job mới xanh.</li>
    </ul>
    <p>Ngoài <code>script</code>, job còn hai khoá phụ hay dùng:</p>
    <ul>
      <li><code>before_script</code>: các lệnh chạy <em>trước</em> <code>script</code> — thường để cài đặt,
      chuẩn bị môi trường.</li>
      <li><code>after_script</code>: chạy <em>sau cùng</em>, kể cả khi job đã thất bại — thường để dọn dẹp
      hoặc in thông tin gỡ lỗi.</li>
    </ul>
    <div class="callout"><p>💡 Mẹo nhớ: job = một ô việc. Runner đọc <code>before_script</code> → <code>script</code>
    → <code>after_script</code>. Chỉ cần một lệnh trong before_script hoặc script 'ngã' (exit ≠ 0) là cả ô
    chuyển đỏ.</p></div>
  `,

  codeTabs: [
    { id: "job", label: "🧱 Một job đầy đủ", lines: [
      "kiem-tra-lint:",
      "  before_script:",
      "    - echo 'Chuẩn bị môi trường'",
      "    - npm install",
      "  script:",
      "    - npm run lint      # nếu lint lỗi -> exit 1 -> job đỏ",
      "    - npm test",
      "  after_script:",
      "    - echo 'Dọn dẹp (chạy cả khi thất bại)'"
    ]},
    { id: "exit", label: "🚦 Mã thoát & xanh/đỏ", lines: [
      "$ npm run lint",
      "✔ 0 lỗi lint            # lệnh trả về 0 -> đi tiếp",
      "$ npm test",
      "✗ 1 test thất bại",
      "exit code: 1            # khác 0 -> job DỪNG ngay tại đây",
      "# dòng script phía sau (nếu có) sẽ KHÔNG chạy",
      "# job bị đánh dấu: failed (đỏ)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="start"><div class="nl">▶️ Runner nhận job</div><div class="ns">chuẩn bị máy/container</div></div>
    <div class="arrow" id="a1">↓ chạy before_script</div>
    <div class="node" id="before"><div class="nl">🔧 before_script</div><div class="ns">cài đặt, dọn chỗ làm việc</div></div>
    <div class="arrow" id="a2">↓ rồi tới script chính</div>
    <div class="node" id="script"><div class="nl">⚙️ script</div><div class="ns">chạy từng lệnh, kiểm tra exit code</div></div>
    <div class="arrow" id="a3">↓ luôn chạy cuối, dù xanh hay đỏ</div>
    <div class="node" id="after"><div class="nl">🧹 after_script</div><div class="ns">dọn dẹp / in log gỡ lỗi</div></div>
    <div class="arrow" id="a4">↓ tổng kết</div>
    <div class="node" id="result"><div class="nl">🏁 Kết quả job</div><div class="ns">mọi lệnh = 0 → xanh; có lệnh ≠ 0 → đỏ</div></div>
  `,
  steps: [
    { title: "1 · Runner khởi động job", tab: "job", highlight: [1], on: ["start"],
      desc: "Runner nhận job tên <code>kiem-tra-lint</code>, chuẩn bị môi trường sạch (thường là một container mới toanh)." },
    { title: "2 · before_script chạy trước", tab: "job", highlight: [2, 3, 4], on: ["start", "a1", "before"],
      desc: "<code>before_script</code> chạy đầu tiên để chuẩn bị — ở đây in thông báo và <code>npm install</code>. Nếu bước cài đặt này ngã, job đỏ ngay, không cần tới script chính." },
    { title: "3 · script chính", tab: "job", highlight: [5, 6, 7], on: ["before", "a2", "script"],
      desc: "Runner chạy lần lượt <code>npm run lint</code> rồi <code>npm test</code>. Mỗi lệnh được kiểm tra mã thoát ngay sau khi chạy." },
    { title: "4 · Một lệnh trả mã khác 0", tab: "exit", highlight: [3, 4, 5], on: ["script"],
      desc: "Giả sử <code>npm test</code> có bài test đỏ và trả về <code>exit code 1</code>. Job <strong>dừng ngay</strong> — mọi lệnh script phía sau bị bỏ qua." },
    { title: "5 · after_script vẫn chạy", tab: "job", highlight: [8, 9], on: ["script", "a3", "after"],
      desc: "Dù job đã thất bại, <code>after_script</code> vẫn được chạy để dọn dẹp hoặc in thêm log gỡ lỗi. Đây là chỗ tốt để thu thập thông tin khi có sự cố." },
    { title: "6 · Xanh hay đỏ?", tab: "exit", highlight: [6, 7], on: ["after", "a4", "result"],
      desc: "Quy tắc vàng: chỉ khi <strong>mọi</strong> lệnh (trong before_script và script) trả về 0 thì job mới xanh. Chỉ một lệnh khác 0 là job đỏ và pipeline có thể dừng." }
  ],

  quiz: [
    { q: "Một job bắt buộc tối thiểu phải có gì?", options: [
        "Một cái tên và khoá script (danh sách lệnh)",
        "Một stage và một Runner riêng",
        "Một biến môi trường và một artifact",
        "Một image Docker và một tag"
      ], correct: 0,
      explanation: "Chỉ cần tên job + khoá script là job chạy được. Các khoá khác (stage, image, rules...) đều tuỳ chọn." },
    { q: "Điều gì xảy ra khi một lệnh trong script trả về mã thoát khác 0?", options: [
        "Lệnh đó bị bỏ qua, các lệnh sau vẫn chạy",
        "Job dừng ngay tại đó và bị đánh dấu thất bại (đỏ)",
        "Job tự động chạy lại từ đầu",
        "GitLab gửi email nhưng job vẫn xanh"
      ], correct: 1,
      explanation: "Mã thoát khác 0 = lỗi. Job dừng ngay, các lệnh script phía sau không chạy, và job chuyển đỏ." },
    { q: "Khi nào job được coi là THÀNH CÔNG (xanh)?", options: [
        "Khi lệnh cuối cùng chạy xong bất kể kết quả",
        "Khi ít nhất một lệnh trả về 0",
        "Khi mọi lệnh trong before_script và script đều trả về 0",
        "Khi after_script chạy xong"
      ], correct: 2,
      explanation: "Cần TẤT CẢ các lệnh trả về 0. Chỉ một lệnh khác 0 là đủ để job đỏ." },
    { q: "Đặc điểm nào đúng về after_script?", options: [
        "Chỉ chạy khi job thành công",
        "Chạy trước before_script",
        "Chạy sau cùng, kể cả khi job đã thất bại",
        "Thay thế cho script chính"
      ], correct: 2,
      explanation: "after_script luôn chạy ở cuối, kể cả khi job đã đỏ — hợp để dọn dẹp hoặc thu thập log gỡ lỗi." }
  ]
});
