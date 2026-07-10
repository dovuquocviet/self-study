window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng CI/CD",
  title: "CI/CD là gì? Từ 'chạy tay' tới tự động",
  subtitle: "Vì sao mỗi lần push lại muốn máy tự build – test – deploy",

  theory: `
    <p>Hãy tưởng tượng nhóm bạn có 5 người, ngày nào cũng sửa code. Trước khi làm gì tiếp, mỗi người
    phải tự tay: kéo code mới nhất về, cài thư viện, chạy build, chạy test, rồi copy sản phẩm lên server.
    Làm <strong>bằng tay</strong> thì mệt, hay quên bước, và mỗi máy một kiểu — "trên máy tôi chạy được mà!".</p>
    <p><strong>CI/CD</strong> là để máy tính làm những việc lặp đi lặp lại đó thay bạn, một cách <em>giống hệt
    nhau mỗi lần</em>.</p>
    <ul>
      <li><strong>CI — Continuous Integration</strong> (tích hợp liên tục): mỗi khi ai đó đẩy code lên,
      hệ thống <em>tự động</em> build và chạy test. Lỗi bị bắt ngay trong vài phút, thay vì lòi ra sau
      hai tuần khi không ai nhớ mình đã sửa gì.</li>
      <li><strong>CD — Continuous Delivery / Deployment</strong> (chuyển giao / triển khai liên tục):
      sau khi test xanh, hệ thống <em>tự động</em> đóng gói và đưa code lên môi trường — staging, rồi
      production.</li>
    </ul>
    <p>Chuỗi các bước tự động đó gọi là <strong>pipeline</strong> (dây chuyền). Nó giống dây chuyền trong
    nhà máy: nguyên liệu (code) đi vào một đầu, qua các trạm build → test → deploy, ra đầu kia là sản phẩm
    đã chạy được.</p>
    <div class="callout"><p>💡 Ý tưởng cốt lõi: <strong>mỗi commit đều được kiểm tra như nhau</strong>.
    Không còn "tôi quên chạy test", không còn "máy tôi khác máy bạn". Máy làm — đều tăm tắp, ghi lại log,
    và báo xanh/đỏ.</p></div>
  `,

  codeTabs: [
    { id: "tay", label: "😩 Làm tay", lines: [
      "# Mỗi lập trình viên phải tự nhớ và tự gõ, mỗi máy một kiểu:",
      "$ git pull",
      "$ npm install          # dễ quên",
      "$ npm run build        # lỡ bỏ qua thì lỗi lọt lưới",
      "$ npm test             # nhiều người skip cho nhanh",
      "$ scp -r dist/ server:/var/www   # copy tay, sai đường dẫn là toang",
      "# -> hay quên bước, mỗi người một quy trình, khó truy vết"
    ]},
    { id: "auto", label: "🤖 CI/CD tự động", lines: [
      "# .gitlab-ci.yml đặt ở gốc repo — GitLab đọc và làm theo",
      "stages: [build, test, deploy]",
      "",
      "build:",
      "  stage: build",
      "  script: npm install && npm run build",
      "",
      "test:",
      "  stage: test",
      "  script: npm test",
      "",
      "deploy:",
      "  stage: deploy",
      "  script: ./deploy.sh   # chỉ chạy khi build + test đã xanh"
    ]}
  ],

  stageHtml: `
    <div class="node" id="dev"><div class="nl">🧑‍💻 Bạn</div><div class="ns">sửa code rồi git push</div></div>
    <div class="arrow" id="a1">↓ push lên nhánh</div>
    <div class="node" id="gl"><div class="nl">🦊 GitLab</div><div class="ns">thấy có commit mới → khởi động pipeline</div></div>
    <div class="arrow" id="a2">↓ đọc .gitlab-ci.yml</div>
    <div class="node" id="build"><div class="nl">🔨 Build</div><div class="ns">cài thư viện, biên dịch</div></div>
    <div class="arrow" id="a3">↓ nếu build xanh</div>
    <div class="node" id="test"><div class="nl">✅ Test</div><div class="ns">chạy toàn bộ kiểm thử</div></div>
    <div class="arrow" id="a4">↓ nếu test xanh</div>
    <div class="node" id="deploy"><div class="nl">🚀 Deploy</div><div class="ns">đưa lên server tự động</div></div>
  `,
  steps: [
    { title: "1 · Không có CI/CD: làm tay", tab: "tay", highlight: [1, 2, 3, 4], on: ["dev"],
      desc: "Mỗi người tự nhớ chuỗi lệnh, tự gõ trên máy mình. Chỉ cần một người <em>quên</em> chạy test hoặc build thiếu bước là lỗi lọt xuống người khác — và không ai biết bước nào đã bị bỏ." },
    { title: "2 · Bạn push code", tab: "auto", highlight: [1], on: ["dev", "a1", "gl"],
      desc: "Với CI/CD, bạn chỉ cần <code>git push</code> như bình thường. GitLab phát hiện có commit mới trên nhánh và tự động khởi động pipeline." },
    { title: "3 · GitLab đọc .gitlab-ci.yml", tab: "auto", highlight: [2], on: ["gl", "a2"],
      desc: "GitLab tìm file <code>.gitlab-ci.yml</code> ở gốc repo. File này là 'công thức' — liệt kê các bước cần chạy và theo thứ tự nào." },
    { title: "4 · Trạm Build", tab: "auto", highlight: [4, 5, 6], on: ["build"],
      desc: "Trạm đầu tiên cài thư viện và biên dịch. Chạy trên một máy sạch, giống hệt nhau mỗi lần — không còn cảnh 'máy tôi chạy được'." },
    { title: "5 · Trạm Test", tab: "auto", highlight: [8, 9, 10], on: ["build", "a3", "test"],
      desc: "Build xong và xanh thì tới trạm test. Toàn bộ kiểm thử chạy tự động. Nếu có bài test đỏ, pipeline dừng — code lỗi không đi tiếp được." },
    { title: "6 · Trạm Deploy", tab: "auto", highlight: [12, 13, 14], on: ["test", "a4", "deploy"],
      desc: "Chỉ khi build + test đều xanh, code mới được deploy tự động. Đây là ý nghĩa của <strong>CD</strong>: đưa sản phẩm ra môi trường mà không cần copy tay." }
  ],

  quiz: [
    { q: "CI (Continuous Integration) tập trung chủ yếu vào việc gì?", options: [
        "Tự động đưa code lên server production",
        "Tự động build và chạy test mỗi khi có commit mới",
        "Quản lý phân quyền người dùng trong repo",
        "Viết tài liệu cho dự án"
      ], correct: 1,
      explanation: "CI = tích hợp liên tục: mỗi commit được tự động build + test để phát hiện lỗi sớm. Việc đưa lên server là phần CD." },
    { q: "'Pipeline' trong GitLab CI là gì?", options: [
        "Một đường ống mạng vật lý",
        "Tên một loại server",
        "Chuỗi các bước tự động (build → test → deploy) chạy khi có commit",
        "Một lệnh git đặc biệt"
      ], correct: 2,
      explanation: "Pipeline là dây chuyền các bước tự động. Code đi vào một đầu, qua các trạm, ra sản phẩm đã kiểm tra ở đầu kia." },
    { q: "Lợi ích lớn nhất khi để CI/CD thay cho 'làm tay' là gì?", options: [
        "Máy chạy nhanh hơn con người",
        "Mỗi commit được kiểm tra theo đúng một quy trình giống nhau, không ai quên bước nào",
        "Không cần viết test nữa",
        "Xoá được toàn bộ bug trong code"
      ], correct: 1,
      explanation: "Giá trị cốt lõi là tính nhất quán: cùng một quy trình cho mọi commit, có log, báo xanh/đỏ rõ ràng — hết cảnh 'quên bước' hay 'máy tôi khác máy bạn'." },
    { q: "GitLab biết phải chạy những bước nào trong pipeline nhờ đâu?", options: [
        "Nhờ file .gitlab-ci.yml đặt ở gốc repo",
        "Nhờ đoán từ tên các file trong dự án",
        "Nhờ cấu hình bí mật chỉ admin thấy",
        "Nhờ hỏi lại người push mỗi lần"
      ], correct: 0,
      explanation: "GitLab đọc file .gitlab-ci.yml ở gốc repo. Đây là 'công thức' khai báo các job, thứ tự và lệnh cần chạy." }
  ]
});
