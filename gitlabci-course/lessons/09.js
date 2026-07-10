window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Truyền dữ liệu & điều khiển",
  title: "needs — DAG & chạy song song không chờ stage",
  subtitle: "Phá vỡ rào cản stage để pipeline nhanh hơn, và lấy artifact chọn lọc",

  theory: `
    <p>Ở bài stages, ta biết: stage sau phải chờ <em>toàn bộ</em> stage trước xong. Điều đó an toàn nhưng đôi khi
    <strong>lãng phí</strong>. Ví dụ job <code>deploy-backend</code> ở stage deploy chỉ thật sự cần
    <code>build-backend</code> — vậy mà nó phải ngồi chờ cả <code>build-frontend</code> và mọi job test khác xong,
    dù chẳng liên quan.</p>
    <p>Khoá <strong>needs</strong> cho phép một job nói rõ: 'tôi chỉ cần job X và Y xong là chạy được, không cần
    đợi cả stage'. Khi đó GitLab dựng pipeline thành một <strong>DAG</strong> (đồ thị phụ thuộc có hướng) thay vì
    các hàng rào stage cứng nhắc. Job nào đủ điều kiện phụ thuộc là chạy ngay — pipeline có thể xong sớm hơn nhiều.</p>
    <ul>
      <li><code>needs: [build-backend]</code>: job chạy ngay khi <code>build-backend</code> xong, bỏ qua rào stage.</li>
      <li>needs cũng <strong>tự kéo artifacts</strong> của các job được liệt kê — bạn nhận đúng file mình cần.</li>
      <li><code>needs: []</code> (rỗng): job chạy <em>ngay lập tức</em> từ đầu pipeline, không chờ ai.</li>
    </ul>
    <p>Đánh đổi: DAG nhanh nhưng bạn phải khai báo phụ thuộc <em>đúng</em>. Quên khai một phụ thuộc → job có thể
    chạy khi chưa có dữ liệu cần thiết.</p>
    <div class="callout"><p>💡 Ẩn dụ: stage là 'xếp hàng theo lượt', còn needs là 'ai xong việc của tôi thì tôi
    làm ngay'. Với dự án có nhánh backend/frontend tách biệt, needs cắt giảm thời gian chờ rất đáng kể.</p></div>
  `,

  codeTabs: [
    { id: "needs", label: "🧭 needs cắt rào stage", lines: [
      "stages: [build, test, deploy]",
      "",
      "build-backend:  { stage: build,  script: ./b-be.sh }",
      "build-frontend: { stage: build,  script: ./b-fe.sh }",
      "",
      "deploy-backend:",
      "  stage: deploy",
      "  needs: [build-backend]   # chỉ chờ build-backend, KHÔNG chờ frontend",
      "  script: ./deploy-be.sh"
    ]},
    { id: "art", label: "📦 needs kéo artifact", lines: [
      "build:",
      "  stage: build",
      "  script: npm run build",
      "  artifacts:",
      "    paths: [dist/]",
      "",
      "deploy:",
      "  needs:",
      "    - job: build",
      "      artifacts: true        # tự lấy dist/ từ job build",
      "  script: ./upload.sh dist/"
    ]},
    { id: "empty", label: "🚀 needs: [] chạy ngay", lines: [
      "lint:",
      "  stage: test",
      "  needs: []                 # không chờ stage build",
      "  script: npm run lint      # chạy ngay từ giây đầu pipeline",
      "# hợp cho các job độc lập, không cần sản phẩm build"
    ]}
  ],

  stageHtml: `
    <div class="node" id="bbe"><div class="nl">🔨 build-backend</div><div class="ns">stage build</div></div>
    <div class="node" id="bfe"><div class="nl">🔨 build-frontend</div><div class="ns">stage build (chạy song song)</div></div>
    <div class="arrow" id="a1">↓ needs: [build-backend] — chỉ nối từ backend</div>
    <div class="node" id="dbe"><div class="nl">🚀 deploy-backend</div><div class="ns">chạy ngay khi build-backend xong</div></div>
    <div class="arrow" id="a2">✗ KHÔNG có mũi tên từ build-frontend</div>
    <div class="node" id="wait"><div class="nl">⏭️ Không phải chờ frontend</div><div class="ns">rào stage bị bỏ qua nhờ needs</div></div>
  `,
  steps: [
    { title: "1 · Vấn đề: chờ thừa", tab: "needs", highlight: [1, 3, 4], on: ["bbe", "bfe"],
      desc: "Hai job build (backend, frontend) chạy song song ở stage build. Theo luật stage thông thường, mọi job stage deploy phải chờ <em>cả hai</em> xong — kể cả job chỉ cần một trong hai." },
    { title: "2 · Khai báo needs", tab: "needs", highlight: [6, 7, 8, 9], on: ["bbe", "a1", "dbe"],
      desc: "<code>deploy-backend</code> khai <code>needs: [build-backend]</code>. Nó tuyên bố mình chỉ phụ thuộc backend. GitLab dựng một cạnh phụ thuộc từ build-backend tới đây." },
    { title: "3 · Bỏ qua job không liên quan", tab: "needs", highlight: [8], on: ["dbe", "a2", "wait"],
      desc: "Không có needs tới <code>build-frontend</code> → deploy-backend <strong>không chờ</strong> frontend. Ngay khi build-backend xong, nó chạy luôn, dù frontend còn đang build. Pipeline xong sớm hơn." },
    { title: "4 · needs kéo theo artifact", tab: "art", highlight: [4, 5, 7, 8, 9], on: ["bbe", "a1", "dbe"],
      desc: "Dạng <code>needs: - job: build, artifacts: true</code> vừa tạo phụ thuộc vừa <strong>tự tải artifact</strong> của job đó. Bạn nhận đúng <code>dist/</code> cần dùng, không lẫn artifact thừa." },
    { title: "5 · needs rỗng: chạy tức thì", tab: "empty", highlight: [2, 3, 4], on: ["wait"],
      desc: "<code>needs: []</code> (rỗng) cho job chạy <em>ngay từ đầu</em> pipeline, không chờ stage nào. Hợp với job độc lập như lint — không cần sản phẩm build nên khởi động sớm càng tốt." },
    { title: "6 · Đánh đổi của DAG", tab: "needs", highlight: [8], on: ["dbe"],
      desc: "DAG nhanh nhưng bạn phải khai <strong>đúng</strong> phụ thuộc. Quên khai một job cần thiết → job có thể chạy khi thiếu dữ liệu. Nhanh đi kèm trách nhiệm mô tả phụ thuộc cho chuẩn." }
  ],

  quiz: [
    { q: "Khoá 'needs' cho phép một job làm gì mà luật stage thường không cho?", options: [
        "Chạy nhiều lần liên tiếp",
        "Chạy ngay khi các job nó phụ thuộc xong, không cần chờ hết stage trước",
        "Bỏ qua bước test",
        "Tự sửa lỗi trong code"
      ], correct: 1,
      explanation: "needs biến pipeline thành DAG: job chạy ngay khi phụ thuộc của nó xong, phá vỡ rào cản 'chờ cả stage'." },
    { q: "'needs: []' (danh sách rỗng) khiến job hành xử thế nào?", options: [
        "Job không bao giờ chạy",
        "Job chạy ngay từ đầu pipeline, không chờ stage nào trước",
        "Job chờ tất cả các job khác xong",
        "Job chạy cuối cùng"
      ], correct: 1,
      explanation: "needs rỗng = không phụ thuộc gì → job khởi động ngay từ giây đầu pipeline, hợp với job độc lập như lint." },
    { q: "Ngoài việc tạo phụ thuộc, 'needs' còn tiện lợi ở điểm nào?", options: [
        "Tự động kéo artifacts của các job được liệt kê",
        "Tự viết test cho bạn",
        "Nén cache nhanh hơn",
        "Ẩn log khỏi người khác"
      ], correct: 0,
      explanation: "needs có thể tự tải artifact của đúng những job nó phụ thuộc (job: X, artifacts: true), nên bạn nhận đúng file cần." },
    { q: "Rủi ro khi dùng DAG/needs là gì?", options: [
        "Pipeline luôn chạy chậm hơn",
        "Nếu khai thiếu một phụ thuộc, job có thể chạy khi chưa có dữ liệu cần thiết",
        "GitLab tính phí gấp đôi",
        "Không thể dùng chung với stages"
      ], correct: 1,
      explanation: "DAG nhanh nhưng đòi hỏi khai báo phụ thuộc chính xác. Quên một cạnh phụ thuộc có thể khiến job chạy thiếu artifact/điều kiện." }
  ]
});
