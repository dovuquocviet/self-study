window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Tổ chức & triển khai",
  title: "Environments & deploy — nút bấm, môi trường, review app",
  subtitle: "Ghép mọi thứ lại: deploy an toàn lên staging và production",

  theory: `
    <p>Bài cuối gom mọi mảnh ghép thành thứ bạn thật sự muốn: <strong>đưa code ra môi trường</strong> một cách
    an toàn và theo dõi được. GitLab có khái niệm <strong>environment</strong> (môi trường) — một 'đích đến' có
    tên như <code>staging</code> hay <code>production</code>. Khi một job deploy khai <code>environment:</code>,
    GitLab ghi nhận 'phiên bản nào đang chạy ở đâu' và cho bạn xem lịch sử deploy, thậm chí bấm quay lui (rollback).</p>
    <ul>
      <li><strong>Deploy tự động lên staging</strong>: mỗi khi main xanh, tự đẩy lên môi trường staging để kiểm thử.</li>
      <li><strong>Deploy production có nút bấm</strong>: dùng <code>when: manual</code> để job production chỉ chạy
      khi con người bấm — tránh vô tình đẩy code chưa sẵn sàng ra khách hàng.</li>
      <li><strong>Review app</strong>: tạo môi trường tạm cho <em>mỗi</em> Merge Request, để reviewer xem thử tính
      năng đang chạy thật; kèm <code>on_stop</code> để tự dọn khi MR đóng.</li>
    </ul>
    <p>Kết hợp với những gì đã học: <code>rules</code> quyết định job deploy có nằm trong pipeline không và ở nhánh
    nào; <code>needs/artifacts</code> mang sản phẩm build tới job deploy; <code>variables</code> (bí mật) cấp token
    để đẩy lên server. Tất cả hợp thành một quy trình từ commit tới production.</p>
    <div class="callout"><p>💡 Nguyên tắc an toàn: <strong>staging tự động, production thủ công.</strong> Máy lo phần
    lặp lại (build, test, đẩy staging); con người giữ nút bấm cuối cùng cho bước ra thật. Có environment để luôn
    biết 'cái gì đang chạy ở đâu' và quay lui khi cần.</p></div>
  `,

  codeTabs: [
    { id: "deploy", label: "🚀 staging tự động + prod thủ công", lines: [
      "deploy-staging:",
      "  stage: deploy",
      "  script: ./deploy.sh staging",
      "  environment:",
      "    name: staging",
      "    url: https://staging.example.com",
      "  rules:",
      "    - if: '$CI_COMMIT_BRANCH == \"main\"'   # main xanh -> tự đẩy",
      "",
      "deploy-prod:",
      "  stage: deploy",
      "  script: ./deploy.sh production",
      "  environment:",
      "    name: production",
      "    url: https://example.com",
      "  rules:",
      "    - if: '$CI_COMMIT_BRANCH == \"main\"'",
      "      when: manual                         # phải BẤM NÚT mới ra thật"
    ]},
    { id: "review", label: "🔍 Review app cho mỗi MR", lines: [
      "review:",
      "  script: ./deploy.sh review-$CI_COMMIT_REF_SLUG",
      "  environment:",
      "    name: review/$CI_COMMIT_REF_SLUG   # môi trường tạm theo nhánh",
      "    url: https://$CI_COMMIT_REF_SLUG.review.example.com",
      "    on_stop: stop-review               # job dọn khi MR đóng",
      "  rules:",
      "    - if: '$CI_PIPELINE_SOURCE == \"merge_request_event\"'",
      "",
      "stop-review:",
      "  script: ./teardown.sh review-$CI_COMMIT_REF_SLUG",
      "  environment:",
      "    name: review/$CI_COMMIT_REF_SLUG",
      "    action: stop",
      "  when: manual"
    ]},
    { id: "full", label: "🧩 Bức tranh tổng", lines: [
      "# Một pipeline hoàn chỉnh ghép mọi bài đã học:",
      "#  build   : tạo dist/  -> artifacts",
      "#  test    : rules chạy khi MR; cache node_modules",
      "#  staging : environment=staging, tự động khi main xanh",
      "#  prod    : environment=production, when: manual (nút bấm)",
      "#  token deploy: lấy từ biến bí mật trong Settings (Masked)",
      "# => commit tới production, an toàn và truy vết được."
    ]}
  ],

  stageHtml: `
    <div class="node" id="main"><div class="nl">🌿 main xanh (build+test ok)</div><div class="ns">artifacts dist/ sẵn sàng</div></div>
    <div class="arrow" id="a1">↓ rules khớp: tự động</div>
    <div class="node" id="stg"><div class="nl">🧪 environment: staging</div><div class="ns">deploy tự động để kiểm thử</div></div>
    <div class="arrow" id="a2">↓ người kiểm tra staging, rồi bấm nút</div>
    <div class="node" id="btn"><div class="nl">🖱️ when: manual</div><div class="ns">con người giữ nút bấm cuối</div></div>
    <div class="arrow" id="a3">↓ bấm → mới chạy</div>
    <div class="node" id="prod"><div class="nl">🚀 environment: production</div><div class="ns">ra thật; GitLab ghi 'bản nào đang chạy'</div></div>
  `,
  steps: [
    { title: "1 · Main đã xanh", tab: "deploy", highlight: [1, 2, 3], on: ["main"],
      desc: "Build và test trên main đã xanh, artifact <code>dist/</code> sẵn sàng (nhờ những bài trước). Giờ tới bước đưa ra môi trường." },
    { title: "2 · Tự động đẩy staging", tab: "deploy", highlight: [4, 5, 6, 7, 8], on: ["main", "a1", "stg"],
      desc: "<code>deploy-staging</code> khai <code>environment: name: staging</code> và <code>rules</code> chạy khi ở main. Nó chạy <em>tự động</em> — máy lo phần lặp lại. GitLab lưu URL để bấm vào xem ngay." },
    { title: "3 · Người kiểm tra, rồi quyết định", tab: "deploy", highlight: [10, 11, 12], on: ["stg", "a2", "btn"],
      desc: "Có bản staging chạy thật để kiểm tra bằng mắt. Job <code>deploy-prod</code> tồn tại trong pipeline nhưng chưa chạy — nó đợi con người." },
    { title: "4 · Nút bấm cho production", tab: "deploy", highlight: [16, 17, 18], on: ["btn", "a3", "prod"],
      desc: "<code>when: manual</code> khiến deploy production chỉ chạy khi ai đó <strong>bấm nút</strong>. Đây là chốt an toàn: máy không tự đẩy code ra khách khi con người chưa gật đầu." },
    { title: "5 · Review app cho mỗi MR", tab: "review", highlight: [1, 3, 4, 5, 6], on: ["stg"],
      desc: "Với mỗi Merge Request, <code>review</code> dựng một môi trường tạm theo tên nhánh để reviewer xem thử. <code>on_stop: stop-review</code> gắn job dọn dẹp, tự tắt khi MR đóng — không để môi trường rác tồn đọng." },
    { title: "6 · Bức tranh tổng", tab: "full", highlight: [2, 3, 4, 5, 6], on: ["main", "stg", "prod"],
      desc: "Ghép lại: <strong>artifacts</strong> mang sản phẩm, <strong>rules</strong> chọn khi nào chạy, <strong>variables bí mật</strong> cấp token, <strong>environment</strong> theo dõi 'cái gì ở đâu', <strong>manual</strong> giữ nút cuối. Đó là một quy trình CI/CD từ commit tới production — an toàn và truy vết được. 🎉" }
  ],

  quiz: [
    { q: "Khai báo 'environment: name: production' trên một job deploy giúp gì?", options: [
        "Làm job chạy nhanh hơn",
        "Giúp GitLab theo dõi 'phiên bản nào đang chạy ở môi trường nào', xem lịch sử và rollback",
        "Ẩn job khỏi giao diện",
        "Tự động viết changelog"
      ], correct: 1,
      explanation: "environment gắn job deploy với một 'đích đến' có tên; GitLab ghi nhận bản triển khai, cho xem lịch sử deploy và quay lui khi cần." },
    { q: "Vì sao deploy lên production thường đặt 'when: manual' còn staging thì không?", options: [
        "Vì production chạy chậm hơn",
        "Để con người giữ nút bấm cuối, tránh vô tình đẩy code chưa sẵn sàng ra khách",
        "Vì GitLab cấm deploy tự động lên production",
        "Vì staging không cần build"
      ], correct: 1,
      explanation: "Nguyên tắc 'staging tự động, production thủ công': máy lo phần lặp lại, con người bấm nút cho bước ra thật để an toàn." },
    { q: "'Review app' (môi trường tạm cho mỗi Merge Request) dùng để làm gì?", options: [
        "Lưu trữ log vĩnh viễn",
        "Cho reviewer xem thử tính năng đang chạy thật trước khi merge",
        "Thay thế cho việc viết test",
        "Tăng tốc cache"
      ], correct: 1,
      explanation: "Review app dựng môi trường tạm theo nhánh MR để reviewer trải nghiệm tính năng thật; thường kèm on_stop để tự dọn khi MR đóng." },
    { q: "Trong một pipeline hoàn chỉnh, thành phần nào mang SẢN PHẨM build từ job build tới job deploy?", options: [
        "cache", "artifacts", "tags", "environment"
      ], correct: 1,
      explanation: "artifacts giữ và chuyển sản phẩm (như dist/) sang job deploy. Đây chính là mảnh ghép kết nối build với deploy trong bức tranh tổng." }
  ]
});
