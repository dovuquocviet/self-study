window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Truyền dữ liệu & điều khiển",
  title: "Cache — tăng tốc bằng tái dùng dependency",
  subtitle: "Khác artifacts thế nào, cache key, và vì sao pipeline nhanh hơn",

  theory: `
    <p>Mỗi lần pipeline chạy, job thường phải cài lại thư viện: <code>npm install</code>, <code>pip install</code>,
    <code>bundle install</code>... tải hàng trăm gói mỗi lần thì <em>rất chậm</em>. <strong>Cache</strong> giải quyết
    việc này: lưu lại những thư mục 'nặng và ít đổi' (như <code>node_modules/</code>) để lần chạy sau <em>tái dùng</em>,
    khỏi tải lại từ đầu.</p>
    <p>Điểm mấu chốt là phân biệt cache với artifacts — hai cái trông giống nhau nhưng mục đích trái ngược:</p>
    <ul>
      <li><strong>Artifacts</strong> = <em>sản phẩm</em> bạn muốn giữ và chuyển cho job sau. Luôn được lưu, tải về được,
      là kết quả bạn quan tâm.</li>
      <li><strong>Cache</strong> = kho <em>tạm để tăng tốc</em>. Có thì tốt, mất cũng không sao (job vẫn chạy đúng,
      chỉ chậm hơn). Không nên dựa vào cache như một cách chuyển giao chắc chắn.</li>
    </ul>
    <p>Cache dùng một <strong>key</strong> để biết 'kho nào dùng cho lần nào'. Mẹo phổ biến: đặt key theo file khoá
    dependency (như <code>package-lock.json</code>). Khi file khoá không đổi → dùng lại cache cũ; khi nó đổi (thêm/bớt
    thư viện) → tạo cache mới. Nhờ vậy cache luôn khớp với đúng bộ thư viện.</p>
    <div class="callout"><p>💡 Câu thần chú: <strong>Cache để nhanh, artifacts để đúng.</strong> Nếu xoá cache mà
    pipeline vẫn cho kết quả đúng (chỉ chậm hơn) → bạn đang dùng cache đúng mục đích.</p></div>
  `,

  codeTabs: [
    { id: "cache", label: "⚡ Cache node_modules", lines: [
      "build:",
      "  # key theo file khoá: đổi lock -> cache mới",
      "  cache:",
      "    key:",
      "      files:",
      "        - package-lock.json",
      "    paths:",
      "      - node_modules/        # thư mục nặng, tái dùng được",
      "  script:",
      "    - npm ci                 # có cache thì cực nhanh",
      "    - npm run build"
    ]},
    { id: "policy", label: "🔁 pull / push policy", lines: [
      "# Job chỉ ĐỌC cache (không mất công nén lại khi xong):",
      "test:",
      "  cache:",
      "    key:",
      "      files: [package-lock.json]",
      "    paths: [node_modules/]",
      "    policy: pull             # pull = chỉ tải về, không đẩy lên",
      "  script:",
      "    - npm test"
    ]},
    { id: "vs", label: "🆚 Cache vs Artifacts", lines: [
      "# CACHE  : node_modules/  -> để lần sau khỏi tải lại (nhanh)",
      "#          mất cache = vẫn đúng, chỉ chậm hơn",
      "#",
      "# ARTIFACT: dist/ , report.xml -> sản phẩm cần giữ & chuyển tiếp",
      "#          mất artifact = job sau thiếu dữ liệu, có thể sai/hỏng",
      "#",
      "# Quy tắc: Cache để NHANH, Artifacts để ĐÚNG."
    ]}
  ],

  stageHtml: `
    <div class="node" id="run1"><div class="nl">1️⃣ Lần chạy đầu</div><div class="ns">chưa có cache → npm ci tải mọi thứ (chậm)</div></div>
    <div class="arrow" id="a1">↓ xong, nén node_modules/ theo key</div>
    <div class="node" id="store"><div class="nl">🗄️ Kho cache trên server</div><div class="ns">key = hash của package-lock.json</div></div>
    <div class="arrow" id="a2">↓ lần chạy sau, cùng lock file</div>
    <div class="node" id="run2"><div class="nl">2️⃣ Lần chạy sau</div><div class="ns">bung cache → npm ci gần như tức thì (nhanh)</div></div>
    <div class="arrow" id="a3">↕ nếu package-lock.json đổi</div>
    <div class="node" id="newkey"><div class="nl">🔑 Key mới → cache mới</div><div class="ns">bộ thư viện thay đổi thì kho cũng làm lại</div></div>
  `,
  steps: [
    { title: "1 · Lần đầu: chưa có cache", tab: "cache", highlight: [9, 10, 11], on: ["run1"],
      desc: "Lần chạy đầu tiên chưa có gì trong kho cache. <code>npm ci</code> phải tải toàn bộ thư viện về — chậm, như mọi lần bạn cài mới." },
    { title: "2 · Nén cache theo key", tab: "cache", highlight: [3, 4, 5, 6, 7, 8], on: ["run1", "a1", "store"],
      desc: "Job kết thúc, GitLab nén <code>node_modules/</code> và lưu vào kho cache, gắn nhãn bằng <strong>key</strong> tính từ <code>package-lock.json</code>." },
    { title: "3 · Lần sau: bung cache", tab: "cache", highlight: [10], on: ["store", "a2", "run2"],
      desc: "Lần chạy sau, nếu <code>package-lock.json</code> không đổi thì key trùng → GitLab bung lại <code>node_modules/</code> có sẵn. <code>npm ci</code> gần như tức thì. Đây là chỗ pipeline nhanh lên." },
    { title: "4 · Lock đổi → cache mới", tab: "cache", highlight: [4, 5, 6], on: ["run2", "a3", "newkey"],
      desc: "Khi bạn thêm/bớt thư viện, <code>package-lock.json</code> thay đổi → key mới → GitLab tạo kho cache mới cho đúng bộ thư viện đó. Nhờ key theo lock file, cache không bao giờ 'lệch pha'." },
    { title: "5 · Chỉ đọc cache: policy pull", tab: "policy", highlight: [6, 7], on: ["store", "a2", "run2"],
      desc: "Job như <code>test</code> chỉ cần <em>đọc</em> cache chứ không tạo thêm gì. <code>policy: pull</code> cho nó tải cache về mà bỏ qua bước nén lại lúc xong — tiết kiệm thời gian." },
    { title: "6 · Đừng nhầm với artifacts", tab: "vs", highlight: [1, 4, 7], on: ["store"],
      desc: "Ghi nhớ ranh giới: <strong>cache</strong> là thứ tạm để nhanh (mất vẫn đúng), <strong>artifacts</strong> là sản phẩm cần giữ và chuyển tiếp (mất là job sau thiếu dữ liệu)." }
  ],

  quiz: [
    { q: "Mục đích chính của cache trong GitLab CI là gì?", options: [
        "Chuyển sản phẩm build sang job deploy",
        "Tái dùng thư mục nặng (như node_modules/) để lần chạy sau nhanh hơn",
        "Lưu báo cáo test để tải về",
        "Cất giữ mật khẩu an toàn"
      ], correct: 1,
      explanation: "Cache lưu lại thứ nặng và ít đổi để khỏi tải/dựng lại mỗi lần, giúp pipeline nhanh hơn. Chuyển sản phẩm là việc của artifacts." },
    { q: "Câu nào mô tả đúng khác biệt cốt lõi giữa cache và artifacts?", options: [
        "Cache để ĐÚNG, artifacts để NHANH",
        "Cache để NHANH (mất vẫn đúng), artifacts để ĐÚNG (sản phẩm cần giữ)",
        "Cả hai hoàn toàn giống nhau",
        "Artifacts chỉ dùng cho mật khẩu"
      ], correct: 1,
      explanation: "Cache là kho tạm tăng tốc — mất thì chỉ chậm hơn. Artifacts là sản phẩm cần giữ và chuyển tiếp — mất là job sau thiếu dữ liệu." },
    { q: "Vì sao nên đặt cache key theo file như package-lock.json?", options: [
        "Để cache tự làm mới khi bộ thư viện thay đổi và tái dùng khi không đổi",
        "Để job chạy chậm lại cho an toàn",
        "Vì GitLab bắt buộc mọi cache phải có tên file",
        "Để giấu cache khỏi người khác"
      ], correct: 0,
      explanation: "Key theo lock file: lock không đổi → dùng lại cache cũ; lock đổi → tạo cache mới. Nhờ vậy cache luôn khớp đúng bộ thư viện." },
    { q: "policy: pull trên cache của một job có nghĩa là gì?", options: [
        "Job xoá cache sau khi chạy",
        "Job chỉ tải cache về (đọc), không nén và đẩy cache lên khi xong",
        "Job tạo cache mới mỗi lần",
        "Job bỏ qua cache hoàn toàn"
      ], correct: 1,
      explanation: "pull = chỉ đọc cache. Hợp với job không thay đổi node_modules (như test), tiết kiệm bước nén/đẩy cache lúc kết thúc." }
  ]
});
