window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Pipeline đầu tiên",
  title: "Stages — xếp job thành dây chuyền",
  subtitle: "Thứ tự stage, song song trong stage, và khi nào pipeline dừng",

  theory: `
    <p>Nếu job là viên gạch, thì <strong>stage</strong> là cách xếp gạch thành hàng. Stage quyết định
    <em>thứ tự</em>: bạn muốn build xong mới test, test xong mới deploy — chứ không phải deploy khi chưa build.</p>
    <p>Có hai quy tắc bạn phải nhớ:</p>
    <ul>
      <li><strong>Trong cùng một stage → chạy song song.</strong> Nếu stage <code>test</code> có 3 job
      (unit, lint, e2e), cả 3 chạy cùng lúc trên các runner khác nhau. Nhanh hơn.</li>
      <li><strong>Giữa các stage → chạy tuần tự.</strong> Stage sau chỉ bắt đầu khi <em>mọi</em> job của
      stage trước đã xanh. Một job đỏ ở stage trước → mặc định pipeline dừng, các stage sau không chạy.</li>
    </ul>
    <p>Bạn khai báo thứ tự bằng danh sách <code>stages:</code> ở đầu file. Mỗi job gắn vào một stage qua khoá
    <code>stage:</code>. Nếu không khai báo <code>stages:</code>, GitLab dùng mặc định:
    <code>build → test → deploy</code>. Job không ghi <code>stage:</code> sẽ rơi vào stage <code>test</code>.</p>
    <div class="callout"><p>💡 Hình dung như dây chuyền lắp ráp: mỗi <em>trạm</em> (stage) có thể có nhiều
    <em>thợ</em> (job) làm song song, nhưng sản phẩm phải qua xong trạm này mới sang trạm kế. Trạm nào có
    thợ làm hỏng → dừng chuyền.</p></div>
  `,

  codeTabs: [
    { id: "stages", label: "🪜 Thứ tự stage", lines: [
      "stages:              # thứ tự các trạm, từ trên xuống",
      "  - build",
      "  - test",
      "  - deploy",
      "",
      "compile:",
      "  stage: build",
      "  script: make",
      "",
      "deploy-prod:",
      "  stage: deploy      # chỉ chạy sau khi build + test xanh",
      "  script: ./deploy.sh"
    ]},
    { id: "song-song", label: "⚡ Song song trong stage", lines: [
      "stages: [build, test, deploy]",
      "",
      "unit:                # cả 3 job dưới đây cùng stage 'test'",
      "  stage: test",
      "  script: npm run test:unit",
      "lint:",
      "  stage: test        # -> chạy SONG SONG với unit và e2e",
      "  script: npm run lint",
      "e2e:",
      "  stage: test",
      "  script: npm run test:e2e"
    ]}
  ],

  stageHtml: `
    <div class="node" id="s-build"><div class="nl">🔨 Stage: build</div><div class="ns">job: compile</div></div>
    <div class="arrow" id="a1">↓ build xanh mới sang test</div>
    <div class="node" id="s-test"><div class="nl">✅ Stage: test — 3 job song song</div><div class="ns">unit · lint · e2e cùng chạy một lúc</div></div>
    <div class="arrow" id="a2">↓ CẢ 3 job test phải xanh</div>
    <div class="node" id="s-deploy"><div class="nl">🚀 Stage: deploy</div><div class="ns">job: deploy-prod</div></div>
    <div class="arrow" id="a3">✗ nếu một job đỏ ở stage trước</div>
    <div class="node" id="stop"><div class="nl">🛑 Pipeline dừng</div><div class="ns">các stage sau không chạy</div></div>
  `,
  steps: [
    { title: "1 · Khai báo thứ tự", tab: "stages", highlight: [1, 2, 3, 4], on: ["s-build"],
      desc: "Danh sách <code>stages:</code> định nghĩa thứ tự các trạm: build → test → deploy. GitLab chạy đúng theo thứ tự này, từ trên xuống." },
    { title: "2 · Stage build chạy trước", tab: "stages", highlight: [6, 7, 8], on: ["s-build"],
      desc: "Job <code>compile</code> gắn vào <code>stage: build</code> nên chạy đầu tiên. Cho tới khi nó xanh, không stage nào sau được đụng tới." },
    { title: "3 · Ba job test chạy song song", tab: "song-song", highlight: [3, 4, 5, 6, 7], on: ["s-build", "a1", "s-test"],
      desc: "Build xong → sang stage test. Ba job <code>unit</code>, <code>lint</code>, <code>e2e</code> cùng thuộc stage test nên chạy <strong>đồng thời</strong> — tiết kiệm thời gian." },
    { title: "4 · Chờ đủ cả stage", tab: "song-song", highlight: [8, 9, 10, 11], on: ["s-test", "a2", "s-deploy"],
      desc: "Stage deploy chỉ bắt đầu khi <strong>cả ba</strong> job test đều xanh. Chỉ cần một job test còn đang chạy, deploy vẫn phải đợi." },
    { title: "5 · Deploy sau cùng", tab: "stages", highlight: [10, 11, 12], on: ["s-deploy"],
      desc: "Job <code>deploy-prod</code> ở stage cuối. Nó chỉ chạy khi mọi thứ phía trước đã sạch — đúng tinh thần 'chỉ deploy code đã được kiểm tra'." },
    { title: "6 · Một job đỏ → dừng chuyền", tab: "song-song", highlight: [6, 7], on: ["s-test", "a3", "stop"],
      desc: "Giả sử <code>lint</code> đỏ. Mặc định pipeline coi cả stage test là thất bại và <strong>không chạy stage deploy</strong>. Code lỗi không thể trôi ra production." }
  ],

  quiz: [
    { q: "Các job trong cùng một stage chạy thế nào so với nhau?", options: [
        "Tuần tự, theo thứ tự khai báo",
        "Song song, cùng lúc",
        "Chỉ job đầu tiên chạy",
        "Phải chờ stage sau xong"
      ], correct: 1,
      explanation: "Cùng stage = chạy song song. Sự tuần tự chỉ xảy ra GIỮA các stage." },
    { q: "Stage 'deploy' bắt đầu khi nào?", options: [
        "Ngay khi pipeline khởi động",
        "Khi ít nhất một job ở stage trước xanh",
        "Khi TẤT CẢ job của các stage trước đã xanh",
        "Khi người push bấm nút thủ công"
      ], correct: 2,
      explanation: "Stage sau chỉ chạy khi mọi job của stage trước đều thành công. Một job còn chạy hoặc đỏ là stage sau phải đợi/không chạy." },
    { q: "Nếu không khai báo khoá 'stages:' trong file, GitLab dùng thứ tự mặc định nào?", options: [
        "test → build → deploy",
        "deploy → test → build",
        "build → test → deploy",
        "Không có thứ tự, chạy ngẫu nhiên"
      ], correct: 2,
      explanation: "Mặc định là build → test → deploy. Job không ghi 'stage:' sẽ rơi vào stage 'test'." },
    { q: "Trong stage 'test' có 3 job và job 'lint' bị đỏ. Mặc định điều gì xảy ra với stage 'deploy'?", options: [
        "Deploy vẫn chạy bình thường",
        "Deploy không chạy vì stage test đã thất bại",
        "Chỉ job lint chạy lại, deploy vẫn tiếp tục",
        "Toàn bộ pipeline bị xoá"
      ], correct: 1,
      explanation: "Một job đỏ khiến cả stage được coi là thất bại; mặc định pipeline dừng nên stage deploy không chạy — ngăn code lỗi ra production." }
  ]
});
