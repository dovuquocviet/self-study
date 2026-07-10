window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng CI/CD",
  title: "Kiến trúc GitLab CI: Runner, pipeline, job",
  subtitle: "Ai ra lệnh, ai thực sự chạy — và những viên gạch của một pipeline",

  theory: `
    <p>GitLab CI có hai vai rõ ràng. Hiểu ranh giới này giúp bạn không bị rối khi pipeline 'treo' hay
    'không có runner'.</p>
    <ul>
      <li><strong>GitLab (server)</strong> là <em>bộ não điều phối</em>. Nó lưu code, đọc file cấu hình,
      quyết định cần chạy những gì, và hiển thị kết quả xanh/đỏ. Nhưng nó <em>không tự chạy</em> lệnh của bạn.</li>
      <li><strong>Runner</strong> là <em>người làm việc thật</em> — một tiến trình chạy trên một máy nào đó
      (máy chủ, VM, hay container). Runner nhận job từ GitLab, chạy các lệnh trong đó, rồi gửi log và kết quả
      về. Không có runner rảnh, job sẽ nằm chờ ('pending').</li>
    </ul>
    <p>Về mặt cấu trúc, một <strong>pipeline</strong> được tạo nên từ những viên gạch lồng nhau:</p>
    <ul>
      <li><strong>Job</strong>: đơn vị nhỏ nhất — một việc cụ thể có tên và một danh sách lệnh (<code>script</code>).
      Ví dụ job <code>test</code> chạy <code>npm test</code>.</li>
      <li><strong>Stage</strong>: một nhóm job cùng 'giai đoạn'. Các job trong cùng stage chạy <em>song song</em>;
      stage sau chỉ bắt đầu khi stage trước xong.</li>
      <li><strong>Pipeline</strong>: toàn bộ tập hợp stage + job cho một lần chạy (thường ứng với một commit).</li>
    </ul>
    <div class="callout"><p>💡 So sánh: GitLab giống <em>quản đốc</em> cầm bản kế hoạch, còn Runner là
    <em>công nhân</em> đứng máy. Quản đốc phân việc; công nhân mới là người bật máy chạy.</p></div>
  `,

  codeTabs: [
    { id: "yml", label: "📄 .gitlab-ci.yml", lines: [
      "stages:",
      "  - build",
      "  - test",
      "",
      "compile:            # tên job (bạn tự đặt)",
      "  stage: build      # thuộc stage 'build'",
      "  script:",
      "    - echo 'Đang biên dịch...'",
      "    - make",
      "",
      "unit-test:          # job này ở stage 'test'",
      "  stage: test",
      "  script:",
      "    - make test"
    ]},
    { id: "runner", label: "🏃 Runner nhận job", lines: [
      "# Trên máy có cài runner, log đại khái như sau:",
      "Running with gitlab-runner 16.0",
      "Preparing the 'docker' executor",
      "Using Docker image node:20 ...",
      "$ echo 'Đang biên dịch...'   # chính là script trong job",
      "Đang biên dịch...",
      "$ make",
      "Job succeeded"
    ]}
  ],

  stageHtml: `
    <div class="node" id="repo"><div class="nl">📦 Repo + .gitlab-ci.yml</div><div class="ns">code và công thức pipeline</div></div>
    <div class="arrow" id="a1">↓ có commit mới</div>
    <div class="node" id="server"><div class="nl">🦊 GitLab server (quản đốc)</div><div class="ns">đọc file, dựng pipeline, phân job</div></div>
    <div class="arrow" id="a2">↓ giao job cho runner rảnh</div>
    <div class="node" id="runner"><div class="nl">🏃 Runner (công nhân)</div><div class="ns">chạy script trong container/máy</div></div>
    <div class="arrow" id="a3">↑ trả log + kết quả (xanh/đỏ)</div>
    <div class="node" id="ui"><div class="nl">📊 Giao diện Pipeline</div><div class="ns">hiện stage → job → trạng thái</div></div>
  `,
  steps: [
    { title: "1 · Bản kế hoạch nằm trong repo", tab: "yml", highlight: [1, 2, 3], on: ["repo"],
      desc: "File <code>.gitlab-ci.yml</code> khai báo các <strong>stage</strong> và <strong>job</strong>. Ở đây có 2 stage: build rồi test. Bản thân file này chưa chạy gì — nó chỉ là kế hoạch." },
    { title: "2 · GitLab dựng pipeline", tab: "yml", highlight: [5, 6, 11, 12], on: ["repo", "a1", "server"],
      desc: "Khi có commit, GitLab (quản đốc) đọc file, thấy job <code>compile</code> ở stage build và <code>unit-test</code> ở stage test. Nó dựng pipeline nhưng <em>tự nó không chạy lệnh</em>." },
    { title: "3 · Phân job cho Runner", tab: "runner", highlight: [1, 2, 3], on: ["server", "a2", "runner"],
      desc: "GitLab giao job cho một <strong>Runner</strong> đang rảnh. Runner chuẩn bị môi trường (ở đây là executor Docker với image node:20). Không có runner nào rảnh → job đứng ở trạng thái 'pending'." },
    { title: "4 · Runner chạy script", tab: "runner", highlight: [5, 6, 7], on: ["runner"],
      desc: "Runner chạy đúng từng dòng trong <code>script</code> của job. Mỗi dòng in ra như bạn tự gõ trên terminal. Đây là nơi công việc thật diễn ra." },
    { title: "5 · Trả kết quả về server", tab: "runner", highlight: [8], on: ["runner", "a3", "ui"],
      desc: "Runner gửi log và mã thoát về GitLab. 'Job succeeded' nghĩa là mọi lệnh trả về 0 (thành công). Server dùng cái này để tô job xanh hay đỏ." },
    { title: "6 · Bạn xem trên giao diện", tab: "yml", highlight: [5, 11], on: ["ui"],
      desc: "Giao diện Pipeline hiển thị cây <strong>stage → job → trạng thái</strong>. Bạn thấy build xong mới tới test, và job nào đỏ thì bấm vào xem log ngay tại chỗ." }
  ],

  quiz: [
    { q: "Ai là bên THỰC SỰ chạy các lệnh trong script của một job?", options: [
        "GitLab server",
        "Runner",
        "Trình duyệt của bạn",
        "Chính người push code"
      ], correct: 1,
      explanation: "GitLab server điều phối (đọc file, phân job, hiển thị kết quả) nhưng Runner mới là tiến trình thực sự chạy lệnh trên một máy/container." },
    { q: "Các job nằm trong CÙNG một stage sẽ chạy như thế nào?", options: [
        "Lần lượt theo thứ tự khai báo",
        "Song song với nhau",
        "Chỉ job đầu tiên chạy, còn lại bị bỏ",
        "Ngẫu nhiên một job bất kỳ"
      ], correct: 1,
      explanation: "Job cùng stage chạy song song. Stage kế tiếp chỉ bắt đầu khi tất cả job của stage trước đã xong." },
    { q: "Đơn vị NHỎ NHẤT có một cái tên và một danh sách lệnh để chạy được gọi là gì?", options: [
        "Stage", "Pipeline", "Job", "Runner"
      ], correct: 2,
      explanation: "Job là viên gạch nhỏ nhất: một cái tên + một script. Nhiều job gộp thành stage, nhiều stage gộp thành pipeline." },
    { q: "Một job bị kẹt ở trạng thái 'pending' (chờ mãi không chạy) thường vì lý do gì?", options: [
        "Code có lỗi cú pháp",
        "Không có Runner nào rảnh/khớp để nhận job",
        "File YAML quá dài",
        "Người push chưa đăng nhập"
      ], correct: 1,
      explanation: "Pending nghĩa là GitLab đã dựng job nhưng chưa có Runner phù hợp và rảnh để nhận. Không runner = không ai chạy = job nằm chờ." }
  ]
});
