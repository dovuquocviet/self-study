window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Pipeline đầu tiên",
  title: "Variables — biến & bí mật",
  subtitle: "Biến tự định nghĩa, biến CI có sẵn, và cất mật khẩu an toàn",

  theory: `
    <p>Pipeline hiếm khi 'cứng' một chỗ. Bạn cần đổi cấu hình theo môi trường, đọc tên nhánh đang chạy, hay
    dùng mật khẩu để deploy. Đó là lúc cần <strong>biến (variables)</strong>. Trong script, bạn đọc biến bằng
    cú pháp <code>$TEN_BIEN</code>.</p>
    <p>Có ba nguồn biến chính:</p>
    <ul>
      <li><strong>Bạn tự định nghĩa</strong> bằng khoá <code>variables:</code> — ở cấp toàn cục (mọi job thấy)
      hoặc trong một job (chỉ job đó thấy).</li>
      <li><strong>Biến có sẵn của GitLab</strong> (predefined) — GitLab tự bơm vào mỗi lần chạy. Ví dụ
      <code>$CI_COMMIT_BRANCH</code> (tên nhánh), <code>$CI_COMMIT_SHORT_SHA</code> (mã commit ngắn),
      <code>$CI_PIPELINE_ID</code>. Rất tiện để đặt tên bản build.</li>
      <li><strong>Biến CI/CD ở phần Settings</strong> — khai báo trong giao diện dự án, KHÔNG nằm trong file.
      Đây là chỗ để cất <em>bí mật</em>: token, mật khẩu, khoá API.</li>
    </ul>
    <p>Vì sao bí mật phải để trong Settings mà không viết thẳng vào <code>.gitlab-ci.yml</code>? Vì file này
    nằm trong repo — ai đọc được code là đọc được luôn mật khẩu. Biến trong Settings có thể đánh dấu
    <strong>Masked</strong> (che trong log) và <strong>Protected</strong> (chỉ lộ ra ở nhánh được bảo vệ).</p>
    <div class="callout"><p>⚠️ Quy tắc sống còn: <strong>không bao giờ</strong> commit token/mật khẩu vào file YAML
    hay code. Luôn dùng biến CI/CD trong Settings, bật Masked để nó không hiện nguyên văn trong log.</p></div>
  `,

  codeTabs: [
    { id: "define", label: "🔤 Tự định nghĩa", lines: [
      "variables:                 # toàn cục — mọi job đều thấy",
      "  APP_ENV: 'staging'",
      "  NODE_VERSION: '20'",
      "",
      "build:",
      "  variables:",
      "    APP_ENV: 'production'  # ghi đè riêng cho job này",
      "  script:",
      "    - echo \"Build cho môi trường: $APP_ENV\""
    ]},
    { id: "predef", label: "🏷️ Biến CI có sẵn", lines: [
      "tag-image:",
      "  script:",
      "    # ghép tên nhánh + mã commit ngắn thành tag ảnh Docker",
      "    - echo \"Nhánh: $CI_COMMIT_BRANCH\"",
      "    - echo \"Commit: $CI_COMMIT_SHORT_SHA\"",
      "    - docker build -t myapp:$CI_COMMIT_SHORT_SHA .",
      "    # $CI_PIPELINE_ID, $CI_PROJECT_NAME... đều có sẵn"
    ]},
    { id: "secret", label: "🔐 Bí mật (Settings)", lines: [
      "# KHÔNG viết mật khẩu vào file. Khai báo ở:",
      "#   Settings > CI/CD > Variables  (bật Masked/Protected)",
      "deploy:",
      "  script:",
      "    # $DEPLOY_TOKEN đến từ Settings, không nằm trong repo",
      "    - curl -H \"Authorization: $DEPLOY_TOKEN\" https://deploy.example.com",
      "    # trong log, giá trị token bị che thành [MASKED]"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src1"><div class="nl">🔤 variables: trong file</div><div class="ns">cấu hình thường: APP_ENV, NODE_VERSION</div></div>
    <div class="node" id="src2"><div class="nl">🏷️ Biến CI có sẵn</div><div class="ns">GitLab tự bơm: CI_COMMIT_BRANCH…</div></div>
    <div class="node" id="src3"><div class="nl">🔐 Biến ở Settings</div><div class="ns">bí mật: token, mật khẩu (Masked)</div></div>
    <div class="arrow" id="a1">↓ tất cả gộp thành môi trường của job</div>
    <div class="node" id="env"><div class="nl">🌱 Môi trường chạy job</div><div class="ns">runner thấy mọi biến dưới dạng $TEN_BIEN</div></div>
    <div class="arrow" id="a2">↓ script đọc biến bằng $</div>
    <div class="node" id="use"><div class="nl">⚙️ script dùng $APP_ENV, $DEPLOY_TOKEN…</div><div class="ns">log che giá trị bí mật thành [MASKED]</div></div>
  `,
  steps: [
    { title: "1 · Biến bạn tự đặt", tab: "define", highlight: [1, 2, 3], on: ["src1"],
      desc: "Khoá <code>variables:</code> ở cấp toàn cục khai báo biến cho <em>mọi</em> job — như <code>APP_ENV</code> và <code>NODE_VERSION</code>. Dùng cho cấu hình thường, không nhạy cảm." },
    { title: "2 · Ghi đè trong job", tab: "define", highlight: [5, 6, 7, 9], on: ["src1", "a1", "env"],
      desc: "Job <code>build</code> khai báo lại <code>APP_ENV: 'production'</code>. Biến trong job <strong>ghi đè</strong> biến toàn cục, chỉ trong phạm vi job đó. Script đọc bằng <code>$APP_ENV</code>." },
    { title: "3 · Biến GitLab bơm sẵn", tab: "predef", highlight: [3, 4, 5], on: ["src2", "a1", "env"],
      desc: "GitLab tự cung cấp hàng loạt biến 'CI_...' cho mỗi lần chạy: tên nhánh, mã commit, id pipeline... Bạn không khai báo mà vẫn dùng được ngay." },
    { title: "4 · Dùng để đặt tên bản build", tab: "predef", highlight: [6, 7], on: ["env", "a2", "use"],
      desc: "Ghép <code>$CI_COMMIT_SHORT_SHA</code> vào tag ảnh Docker giúp mỗi build có tên duy nhất, truy vết được đúng commit nào tạo ra ảnh nào." },
    { title: "5 · Bí mật để ở Settings", tab: "secret", highlight: [1, 2, 3], on: ["src3", "a1", "env"],
      desc: "Token và mật khẩu <strong>không</strong> viết vào file. Bạn khai báo ở <em>Settings → CI/CD → Variables</em>, bật <strong>Masked</strong> và <strong>Protected</strong>. Job vẫn đọc bằng <code>$DEPLOY_TOKEN</code>." },
    { title: "6 · Log che giá trị bí mật", tab: "secret", highlight: [5, 6, 7], on: ["use"],
      desc: "Khi Masked được bật, nếu giá trị token vô tình bị in ra log, GitLab thay nó bằng <code>[MASKED]</code>. Đây là lý do không bao giờ nên hard-code bí mật vào repo." }
  ],

  quiz: [
    { q: "Trong script của job, bạn đọc giá trị một biến tên DEPLOY_TOKEN bằng cú pháp nào?", options: [
        "DEPLOY_TOKEN()", "$DEPLOY_TOKEN", "@DEPLOY_TOKEN", "var(DEPLOY_TOKEN)"
      ], correct: 1,
      explanation: "Biến được đọc bằng tiền tố đô-la: $DEPLOY_TOKEN. Đây là cú pháp biến môi trường quen thuộc của shell." },
    { q: "Biến như CI_COMMIT_BRANCH hay CI_COMMIT_SHORT_SHA đến từ đâu?", options: [
        "Bạn phải tự khai báo trong variables:",
        "GitLab tự bơm sẵn cho mỗi lần chạy (biến predefined)",
        "Chúng nằm trong file .env của dự án",
        "Runner tự bịa ra ngẫu nhiên"
      ], correct: 1,
      explanation: "Đó là các biến có sẵn (predefined) do GitLab cung cấp: tên nhánh, mã commit, id pipeline... dùng được ngay mà không cần khai báo." },
    { q: "Vì sao KHÔNG nên viết mật khẩu/token trực tiếp vào .gitlab-ci.yml?", options: [
        "Vì file YAML không cho phép ký tự đặc biệt",
        "Vì file nằm trong repo — ai đọc được code là đọc được mật khẩu",
        "Vì biến trong file chạy chậm hơn",
        "Vì GitLab cấm biến dài quá 8 ký tự"
      ], correct: 1,
      explanation: "File YAML nằm trong repo. Hard-code bí mật vào đó = lộ cho mọi người xem được code. Hãy dùng biến CI/CD trong Settings." },
    { q: "Khi một biến CI/CD được đánh dấu 'Masked', điều gì xảy ra nếu nó lỡ bị in ra log?", options: [
        "Log bị xoá hoàn toàn",
        "Giá trị bị thay bằng [MASKED] thay vì hiện nguyên văn",
        "Job tự động thất bại",
        "Không có gì thay đổi, giá trị vẫn hiện"
      ], correct: 1,
      explanation: "Masked khiến GitLab che giá trị thành [MASKED] trong log, giảm rủi ro lộ bí mật khi ai đó vô tình echo nó ra." }
  ]
});
