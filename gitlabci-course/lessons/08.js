window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Truyền dữ liệu & điều khiển",
  title: "rules — chạy job có điều kiện",
  subtitle: "Chỉ deploy ở nhánh main, chạy khi có MR, và vì sao rules thay only/except",

  theory: `
    <p>Không phải job nào cũng nên chạy mọi lúc. Bạn muốn: job <code>deploy</code> chỉ chạy trên nhánh
    <code>main</code>; job kiểm thử nặng chỉ chạy khi có Merge Request; job dọn dẹp chỉ chạy theo lịch. Công cụ
    để nói 'chạy khi nào' là <strong>rules</strong>.</p>
    <p><code>rules</code> là một danh sách điều kiện, xét <strong>từ trên xuống</strong>. GitLab dừng ở
    <em>quy tắc đầu tiên khớp</em> và làm theo nó. Mỗi quy tắc có thể có:</p>
    <ul>
      <li><code>if</code>: biểu thức điều kiện, thường so sánh biến CI. Ví dụ
      <code>$CI_COMMIT_BRANCH == 'main'</code>.</li>
      <li><code>when</code>: làm gì khi khớp — <code>on_success</code> (mặc định, chạy nếu stage trước xanh),
      <code>manual</code> (chờ bấm nút), <code>never</code> (không chạy), <code>always</code>.</li>
      <li><code>changes</code>: chỉ chạy khi có file nhất định thay đổi (ví dụ chỉ chạy khi sửa trong
      <code>backend/</code>).</li>
    </ul>
    <p>Nếu <em>không quy tắc nào</em> khớp, job <strong>không được thêm vào pipeline</strong>. Ngày xưa người ta
    dùng <code>only</code>/<code>except</code>, nhưng nay GitLab khuyến nghị <code>rules</code> vì nó linh hoạt và
    biểu đạt được nhiều tình huống hơn.</p>
    <div class="callout"><p>💡 Tư duy đúng: rules trả lời câu hỏi "job này CÓ nên nằm trong pipeline lần này
    không, và nếu có thì chạy tự động hay chờ bấm?". Thứ tự quan trọng — quy tắc khớp đầu tiên thắng.</p></div>
  `,

  codeTabs: [
    { id: "branch", label: "🌿 Chỉ deploy ở main", lines: [
      "deploy-prod:",
      "  stage: deploy",
      "  script: ./deploy.sh",
      "  rules:",
      "    # ở main -> chờ bấm nút mới deploy (an toàn)",
      "    - if: '$CI_COMMIT_BRANCH == \"main\"'",
      "      when: manual",
      "    # mọi nhánh khác -> không tạo job deploy",
      "    - when: never"
    ]},
    { id: "mr", label: "🔀 Chạy khi có MR", lines: [
      "test-e2e:",
      "  script: npm run test:e2e",
      "  rules:",
      "    # chỉ chạy trong pipeline của Merge Request",
      "    - if: '$CI_PIPELINE_SOURCE == \"merge_request_event\"'",
      "    # (không có quy tắc nào khác) -> ngoài MR thì job bị bỏ"
    ]},
    { id: "changes", label: "📂 Chạy theo file đổi", lines: [
      "build-backend:",
      "  script: ./build-backend.sh",
      "  rules:",
      "    # chỉ chạy khi có file trong backend/ thay đổi",
      "    - changes:",
      "        - backend/**/*",
      "  # sửa mỗi phần frontend -> job này không chạy, đỡ tốn runner"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ev"><div class="nl">📨 Sự kiện kích hoạt</div><div class="ns">push nhánh nào? MR? có file gì đổi?</div></div>
    <div class="arrow" id="a1">↓ GitLab xét rules từ trên xuống</div>
    <div class="node" id="r1"><div class="nl">① if: nhánh == main ?</div><div class="ns">khớp → when: manual (chờ bấm)</div></div>
    <div class="arrow" id="a2">↓ nếu không khớp, xét tiếp</div>
    <div class="node" id="r2"><div class="nl">② when: never</div><div class="ns">khớp → job KHÔNG vào pipeline</div></div>
    <div class="arrow" id="a3">↓ kết luận</div>
    <div class="node" id="dec"><div class="nl">🧭 Quyết định</div><div class="ns">có job không · chạy tự động hay chờ bấm</div></div>
  `,
  steps: [
    { title: "1 · Có sự kiện kích hoạt", tab: "branch", highlight: [1, 2, 3], on: ["ev"],
      desc: "Một push/MR/lịch chạy tới. GitLab cần quyết định: job <code>deploy-prod</code> có nên nằm trong pipeline lần này không? Nó sẽ xét khối <code>rules</code>." },
    { title: "2 · Xét quy tắc đầu tiên", tab: "branch", highlight: [4, 5, 6, 7], on: ["ev", "a1", "r1"],
      desc: "Quy tắc 1: <code>if: $CI_COMMIT_BRANCH == 'main'</code>. Nếu đang ở nhánh main → khớp! GitLab dừng tại đây, áp <code>when: manual</code> — job xuất hiện nhưng chờ bạn bấm nút mới chạy." },
    { title: "3 · Không ở main thì sao", tab: "branch", highlight: [8, 9], on: ["r1", "a2", "r2"],
      desc: "Nếu không phải main, quy tắc 1 trượt. GitLab xét quy tắc 2: <code>when: never</code> — nghĩa là ở mọi nhánh khác, job deploy <strong>không được thêm</strong> vào pipeline." },
    { title: "4 · Chỉ chạy trong MR", tab: "mr", highlight: [3, 4, 5], on: ["ev", "a1", "r1"],
      desc: "Kiểu khác: job e2e chỉ chạy khi <code>$CI_PIPELINE_SOURCE == 'merge_request_event'</code>. Ngoài ngữ cảnh MR, không quy tắc nào khớp nên job bị bỏ — tiết kiệm runner cho những push lặt vặt." },
    { title: "5 · Chạy theo file thay đổi", tab: "changes", highlight: [3, 4, 5, 6], on: ["ev", "a1", "r1"],
      desc: "<code>changes: backend/**/*</code> khiến job chỉ chạy khi có file trong <code>backend/</code> đổi. Sửa mỗi phần frontend thì khỏi build backend — pipeline gọn và nhanh hơn." },
    { title: "6 · Quyết định cuối", tab: "branch", highlight: [6, 7], on: ["r2", "a3", "dec"],
      desc: "Tóm lại rules cho ra hai quyết định: (1) job này <em>có</em> nằm trong pipeline không, và (2) nếu có thì chạy tự động hay chờ bấm. Quy tắc khớp đầu tiên thắng; không quy tắc nào khớp → không có job." }
  ],

  quiz: [
    { q: "GitLab xét danh sách rules của một job theo cách nào?", options: [
        "Xét tất cả rồi lấy quy tắc cuối cùng",
        "Từ trên xuống, dừng ở quy tắc ĐẦU TIÊN khớp",
        "Ngẫu nhiên một quy tắc",
        "Chỉ xét quy tắc có when: always"
      ], correct: 1,
      explanation: "rules được duyệt từ trên xuống; quy tắc khớp đầu tiên quyết định và các quy tắc sau bị bỏ qua." },
    { q: "Nếu KHÔNG có quy tắc nào trong rules khớp, điều gì xảy ra với job?", options: [
        "Job vẫn chạy như bình thường",
        "Job không được thêm vào pipeline",
        "Job chạy nhưng luôn đỏ",
        "Pipeline bị lỗi cú pháp"
      ], correct: 1,
      explanation: "Không quy tắc nào khớp = job không được đưa vào pipeline lần chạy đó (giống như when: never mặc định)." },
    { q: "Bạn muốn job deploy XUẤT HIỆN trên main nhưng phải BẤM NÚT mới chạy. Dùng gì?", options: [
        "when: never",
        "when: manual",
        "when: always",
        "allow_failure: true"
      ], correct: 1,
      explanation: "when: manual tạo job dạng chờ — nó nằm trong pipeline nhưng chỉ chạy khi người dùng bấm nút, hợp cho deploy production." },
    { q: "Vì sao GitLab khuyến nghị dùng 'rules' thay cho 'only/except' cũ?", options: [
        "Vì only/except đã bị xoá hoàn toàn",
        "Vì rules linh hoạt hơn, biểu đạt được nhiều điều kiện (if, changes, when...)",
        "Vì rules chạy nhanh gấp đôi",
        "Vì only/except chỉ chạy trên nhánh main"
      ], correct: 1,
      explanation: "rules gộp được if/changes/when trong một cơ chế linh hoạt, biểu đạt nhiều tình huống hơn only/except nên được khuyến nghị." }
  ]
});
