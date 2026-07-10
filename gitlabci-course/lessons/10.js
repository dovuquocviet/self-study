window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Tổ chức & triển khai",
  title: "Tái sử dụng — extends, anchors, include",
  subtitle: "Đừng lặp lại chính mình: gom cấu hình chung, tách file, dùng lại",

  theory: `
    <p>Khi pipeline lớn dần, bạn sẽ thấy nhiều job na ná nhau: cùng image, cùng before_script, cùng cache.
    Chép đi chép lại (copy-paste) là mầm mống lỗi — sửa một chỗ quên chỗ kia. GitLab cho ba cách để
    <strong>tránh lặp</strong>:</p>
    <ul>
      <li><strong>extends</strong>: định nghĩa một 'job mẫu' (thường đặt tên bắt đầu bằng dấu chấm, ví dụ
      <code>.base</code>, để nó bị ẩn — không tự chạy). Job thật <code>extends: .base</code> để <em>kế thừa</em>
      mọi khoá, rồi ghi đè phần khác biệt. Đây là cách được khuyến nghị.</li>
      <li><strong>YAML anchors</strong> (<code>&amp;ten</code> để đặt neo, <code>*ten</code> để dán lại): tính năng
      thuần YAML để tái dùng một khối. Mạnh nhưng khó đọc hơn extends, và chỉ trong <em>cùng một file</em>.</li>
      <li><strong>include</strong>: <em>tách</em> cấu hình ra file khác rồi nạp vào. Nạp từ file trong repo, từ
      template dựng sẵn của GitLab, hay từ repo/URL khác. Giúp chia nhỏ và chia sẻ pipeline giữa nhiều dự án.</li>
    </ul>
    <p>Quy tắc thực dụng: dùng <code>extends</code> cho phần lặp trong cùng file; dùng <code>include</code> khi
    muốn tách file hoặc dùng chung nhiều dự án; để dành anchors cho các mẩu nhỏ.</p>
    <div class="callout"><p>💡 DRY — Don't Repeat Yourself. Một 'job mẫu' <code>.base</code> ẩn + nhiều job
    <code>extends</code> nó = sửa một chỗ, mọi job hưởng theo. Đây là bước biến file YAML từ 'dài dằng dặc'
    thành 'gọn gàng, dễ bảo trì'.</p></div>
  `,

  codeTabs: [
    { id: "extends", label: "🧬 extends job mẫu", lines: [
      ".node-base:                # dấu chấm đầu -> job ẩn, KHÔNG tự chạy",
      "  image: node:20",
      "  before_script:",
      "    - npm ci",
      "  cache:",
      "    paths: [node_modules/]",
      "",
      "test:",
      "  extends: .node-base      # kế thừa image + before_script + cache",
      "  script: npm test         # chỉ thêm phần khác biệt",
      "",
      "lint:",
      "  extends: .node-base",
      "  script: npm run lint"
    ]},
    { id: "anchor", label: "⚓ YAML anchors", lines: [
      ".defaults: &defaults        # &defaults đặt 'neo'",
      "  image: node:20",
      "  before_script: [npm ci]",
      "",
      "test:",
      "  <<: *defaults             # *defaults dán lại nội dung neo",
      "  script: npm test",
      "",
      "# anchors chỉ dùng được TRONG CÙNG một file"
    ]},
    { id: "include", label: "📎 include tách file", lines: [
      "include:",
      "  - local: '/ci/test.yml'          # file khác trong repo này",
      "  - template: 'Jobs/SAST.gitlab-ci.yml'  # template có sẵn của GitLab",
      "  - project: 'nhom/ci-chung'       # dùng chung từ repo khác",
      "    file: '/deploy.yml'",
      "",
      "# file .gitlab-ci.yml chính giờ gọn, phần chi tiết nằm nơi khác"
    ]}
  ],

  stageHtml: `
    <div class="node" id="tmpl"><div class="nl">🧬 .node-base (job mẫu ẩn)</div><div class="ns">image · before_script · cache dùng chung</div></div>
    <div class="arrow" id="a1">↓ extends</div>
    <div class="node" id="j1"><div class="nl">✅ job test</div><div class="ns">kế thừa mẫu + script: npm test</div></div>
    <div class="node" id="j2"><div class="nl">🔎 job lint</div><div class="ns">kế thừa mẫu + script: npm run lint</div></div>
    <div class="arrow" id="a2">— hoặc tách hẳn ra file khác —</div>
    <div class="node" id="inc"><div class="nl">📎 include: local / template / project</div><div class="ns">nạp cấu hình từ file/dự án khác</div></div>
  `,
  steps: [
    { title: "1 · Nhận ra sự lặp", tab: "extends", highlight: [8, 9, 10, 12, 13, 14], on: ["j1", "j2"],
      desc: "Hai job <code>test</code> và <code>lint</code> đều cần <code>image: node:20</code>, <code>npm ci</code>, cùng cache. Chép cả khối vào từng job là lặp — sửa image sau này phải nhớ sửa mọi nơi." },
    { title: "2 · Tạo job mẫu ẩn", tab: "extends", highlight: [1, 2, 3, 4, 5, 6], on: ["tmpl"],
      desc: "<code>.node-base</code> gom phần chung. Dấu chấm đầu tên khiến nó <strong>ẩn</strong> — GitLab không chạy nó như job thật, nó chỉ để kế thừa." },
    { title: "3 · Kế thừa bằng extends", tab: "extends", highlight: [8, 9, 10], on: ["tmpl", "a1", "j1"],
      desc: "<code>test</code> khai <code>extends: .node-base</code> để nhận toàn bộ image/before_script/cache, rồi chỉ thêm <code>script: npm test</code>. Ngắn gọn và không lặp." },
    { title: "4 · Sửa một chỗ, mọi job theo", tab: "extends", highlight: [2, 12, 13], on: ["j1", "j2"],
      desc: "Muốn đổi lên <code>node:22</code>? Chỉ sửa trong <code>.node-base</code>, cả <code>test</code> lẫn <code>lint</code> tự cập nhật. Đây là giá trị thật của DRY." },
    { title: "5 · anchors — cách thuần YAML", tab: "anchor", highlight: [1, 5, 6], on: ["tmpl", "a1", "j1"],
      desc: "<code>&amp;defaults</code> đặt neo, <code>&lt;&lt;: *defaults</code> dán nội dung neo vào job. Mạnh nhưng khó đọc hơn extends và chỉ dùng trong <em>cùng một file</em>." },
    { title: "6 · include — tách & chia sẻ", tab: "include", highlight: [1, 2, 3, 4, 5], on: ["a2", "inc"],
      desc: "<code>include</code> nạp cấu hình từ nơi khác: file trong repo (<code>local</code>), template dựng sẵn (<code>template</code>), hay repo chung của cả nhóm (<code>project</code>). Giúp chia nhỏ và tái dùng pipeline giữa nhiều dự án." }
  ],

  quiz: [
    { q: "Vì sao tên job mẫu thường bắt đầu bằng dấu chấm, ví dụ '.node-base'?", options: [
        "Để nó chạy trước mọi job khác",
        "Để nó bị ẩn — GitLab không chạy nó như job thật, chỉ để kế thừa",
        "Để GitLab nén nó lại cho nhẹ",
        "Vì cú pháp YAML bắt buộc"
      ], correct: 1,
      explanation: "Dấu chấm đầu tên biến job thành 'ẩn' (hidden): không tự chạy, chỉ tồn tại để các job khác extends kế thừa." },
    { q: "Cách được KHUYẾN NGHỊ để một job kế thừa cấu hình chung từ job mẫu là gì?", options: [
        "copy-paste toàn bộ khối",
        "extends",
        "artifacts",
        "needs"
      ], correct: 1,
      explanation: "extends là cách được khuyến nghị: job kế thừa mọi khoá của job mẫu rồi ghi đè phần khác biệt, dễ đọc hơn anchors." },
    { q: "Khoá 'include' dùng để làm gì?", options: [
        "Chạy nhiều job song song",
        "Nạp cấu hình CI từ file/template/dự án khác vào pipeline",
        "Che giấu biến bí mật",
        "Xoá cache cũ"
      ], correct: 1,
      explanation: "include tách cấu hình ra nơi khác rồi nạp vào: file local, template dựng sẵn của GitLab, hay repo dùng chung — giúp chia nhỏ và chia sẻ." },
    { q: "Hạn chế của YAML anchors so với extends là gì?", options: [
        "Anchors chạy chậm hơn",
        "Anchors chỉ dùng được trong cùng một file và khó đọc hơn",
        "Anchors không tái dùng được gì",
        "Anchors chỉ dùng cho biến bí mật"
      ], correct: 1,
      explanation: "Anchors là tính năng thuần YAML, chỉ hoạt động trong cùng một file và thường khó đọc hơn extends — nên extends được ưa dùng cho tái sử dụng job." }
  ]
});
