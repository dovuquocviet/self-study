window.LESSONS.push({
  id: "06",
  phase: "2", phaseName: "Truyền dữ liệu & điều khiển",
  title: "Artifacts — giữ lại sản phẩm của job",
  subtitle: "Vì sao job sau không thấy file job trước, và cách chuyển giao",

  theory: `
    <p>Đây là điều làm nhiều người mới bối rối: <strong>mỗi job chạy trên một môi trường sạch, riêng biệt</strong>.
    Job <code>build</code> tạo ra thư mục <code>dist/</code>, nhưng khi job <code>deploy</code> chạy, nó khởi động
    ở một container mới toanh — <em>không thấy</em> <code>dist/</code> đâu cả. Vì sao? Vì hai job có thể chạy trên
    hai runner khác nhau, và container bị xoá sạch sau mỗi job.</p>
    <p>Để chuyển file từ job này sang job sau, ta dùng <strong>artifacts</strong>. Job tạo ra file khai báo
    <code>artifacts: paths:</code> liệt kê những gì cần giữ. GitLab <em>gói</em> các file đó lại, lưu trên server,
    rồi <em>bung ra</em> cho các job ở stage sau tự động.</p>
    <ul>
      <li><code>artifacts:paths</code>: danh sách file/thư mục cần giữ (ví dụ <code>dist/</code>, <code>build/app.jar</code>).</li>
      <li><code>artifacts:expire_in</code>: bao lâu thì tự xoá (ví dụ <code>1 week</code>) — tiết kiệm dung lượng.</li>
      <li>Artifacts còn <strong>tải về được</strong> từ giao diện — tiện lấy file build, báo cáo test, ảnh chụp lỗi.</li>
    </ul>
    <p>Khác với chuyện lưu cache (bài sau): artifacts là <em>sản phẩm</em> bạn muốn giữ và chuyển tiếp; cache là
    thứ tạm để tăng tốc. Đừng nhầm hai cái.</p>
    <div class="callout"><p>💡 Nhớ đơn giản: job không 'nhớ' gì của job khác. Muốn job sau xài file của job trước
    → job trước phải khai báo <code>artifacts</code>. Mặc định, job chỉ nhận artifacts từ các stage <em>trước</em> nó.</p></div>
  `,

  codeTabs: [
    { id: "art", label: "📦 Tạo & nhận artifact", lines: [
      "stages: [build, deploy]",
      "",
      "build:",
      "  stage: build",
      "  script:",
      "    - npm run build          # tạo ra thư mục dist/",
      "  artifacts:",
      "    paths:",
      "      - dist/                # giữ lại dist/ để job sau dùng",
      "    expire_in: 1 week        # tự xoá sau 1 tuần",
      "",
      "deploy:",
      "  stage: deploy",
      "  script:",
      "    - ls dist/               # dist/ tự có mặt ở đây!",
      "    - ./upload.sh dist/"
    ]},
    { id: "report", label: "📊 Artifact báo cáo test", lines: [
      "unit-test:",
      "  script:",
      "    - npm test -- --reporters junit --out report.xml",
      "  artifacts:",
      "    when: always             # giữ cả khi test đỏ, để xem báo cáo",
      "    paths:",
      "      - report.xml",
      "    reports:",
      "      junit: report.xml      # GitLab hiện tab Tests đẹp mắt"
    ]}
  ],

  stageHtml: `
    <div class="node" id="jbuild"><div class="nl">🔨 Job build (container A)</div><div class="ns">npm run build → tạo dist/</div></div>
    <div class="arrow" id="a1">↓ khai báo artifacts: paths: dist/</div>
    <div class="node" id="pack"><div class="nl">📦 GitLab gói & lưu dist/</div><div class="ns">nén, cất trên server</div></div>
    <div class="arrow" id="a2">↓ job stage sau bắt đầu (container B mới, trống)</div>
    <div class="node" id="unpack"><div class="nl">📥 Bung artifact vào container B</div><div class="ns">dist/ xuất hiện tự động</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="jdeploy"><div class="nl">🚀 Job deploy dùng dist/</div><div class="ns">./upload.sh dist/</div></div>
  `,
  steps: [
    { title: "1 · Job build tạo file", tab: "art", highlight: [3, 4, 5, 6], on: ["jbuild"],
      desc: "Job <code>build</code> chạy trong container A, tạo thư mục <code>dist/</code>. Nhưng nếu chỉ có vậy, <code>dist/</code> sẽ biến mất khi container A bị xoá sau job." },
    { title: "2 · Khai báo giữ lại", tab: "art", highlight: [7, 8, 9, 10], on: ["jbuild", "a1", "pack"],
      desc: "<code>artifacts: paths: - dist/</code> bảo GitLab: 'hãy giữ thư mục này lại'. GitLab nén và lưu nó trên server. <code>expire_in: 1 week</code> để nó tự dọn sau một tuần." },
    { title: "3 · Container mới, trống trơn", tab: "art", highlight: [12, 13, 14], on: ["pack", "a2", "unpack"],
      desc: "Job <code>deploy</code> khởi động ở container B hoàn toàn mới — không có gì của job build. Đây chính là chỗ nhiều người tưởng file 'tự còn đó'." },
    { title: "4 · GitLab tự bung artifact", tab: "art", highlight: [15, 16], on: ["unpack", "a3", "jdeploy"],
      desc: "Trước khi chạy script deploy, GitLab tự động tải và bung artifact từ các stage trước vào container B. Nhờ vậy <code>dist/</code> xuất hiện, <code>ls dist/</code> thấy file ngay." },
    { title: "5 · Deploy dùng file", tab: "art", highlight: [15, 16], on: ["jdeploy"],
      desc: "Giờ <code>./upload.sh dist/</code> chạy được vì có dữ liệu. Artifacts là cây cầu chuyển sản phẩm giữa các job/stage." },
    { title: "6 · Artifact cho báo cáo", tab: "report", highlight: [4, 5, 8, 9], on: ["pack"],
      desc: "Artifacts còn để lưu <em>báo cáo</em>: dùng <code>when: always</code> giữ cả khi test đỏ, và <code>reports: junit:</code> để GitLab hiện tab Tests đẹp mắt. File cũng tải về được từ giao diện." }
  ],

  quiz: [
    { q: "Vì sao job 'deploy' mặc định KHÔNG thấy thư mục dist/ do job 'build' tạo ra?", options: [
        "Vì dist/ bị GitLab tự xoá vì lý do bảo mật",
        "Vì mỗi job chạy trên môi trường/container sạch, riêng biệt",
        "Vì deploy chạy trước build",
        "Vì tên thư mục phải viết hoa"
      ], correct: 1,
      explanation: "Mỗi job có môi trường sạch riêng (có thể trên runner khác), container bị xoá sau job. Không khai báo artifacts thì file không đi theo." },
    { q: "Để chuyển file từ job này sang job ở stage sau, ta dùng gì?", options: [
        "cache", "artifacts", "variables", "before_script"
      ], correct: 1,
      explanation: "artifacts giữ lại file (sản phẩm) và tự bung cho các job ở stage sau. cache dùng cho mục đích tăng tốc, không phải để chuyển giao sản phẩm." },
    { q: "Khoá 'expire_in: 1 week' trong artifacts có tác dụng gì?", options: [
        "Job chỉ chạy trong vòng 1 tuần",
        "Artifact tự bị xoá sau 1 tuần để tiết kiệm dung lượng",
        "Job chờ 1 tuần rồi mới chạy",
        "Giới hạn kích thước artifact còn 1 tuần dữ liệu"
      ], correct: 1,
      explanation: "expire_in đặt hạn sống cho artifact; hết hạn GitLab tự dọn để không phình dung lượng lưu trữ." },
    { q: "Muốn giữ báo cáo test NGAY CẢ KHI job test thất bại, bạn thêm gì vào artifacts?", options: [
        "when: always",
        "retry: 3",
        "allow_failure: true",
        "expire_in: never"
      ], correct: 0,
      explanation: "Mặc định artifacts chỉ giữ khi job xanh. 'when: always' giữ cả khi job đỏ — hữu ích để xem báo cáo/log lỗi." }
  ]
});
