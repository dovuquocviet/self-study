window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Tổ chức & triển khai",
  title: "Runner & executor — image, tags",
  subtitle: "Job chạy Ở ĐÂU, bằng cái gì, và làm sao chọn đúng runner",

  theory: `
    <p>Ta biết Runner là bên chạy job. Nhưng runner chạy job <em>bằng cách nào</em>? Đó là vai trò của
    <strong>executor</strong> — 'động cơ' quyết định môi trường thực thi:</p>
    <ul>
      <li><strong>docker executor</strong> (phổ biến nhất): mỗi job chạy trong một <em>container</em> mới, sạch,
      dựng từ một image bạn chọn. Chạy xong container bị xoá. Nhờ vậy môi trường luôn giống nhau, không 'dây bẩn'
      giữa các job.</li>
      <li><strong>shell executor</strong>: chạy lệnh thẳng trên máy cài runner. Nhanh nhưng môi trường 'dùng chung',
      dễ lẫn lộn trạng thái giữa các lần chạy.</li>
      <li>còn có kubernetes, ssh... nhưng docker là mặc định trong đầu hầu hết mọi người.</li>
    </ul>
    <p>Với docker executor, bạn chọn môi trường bằng khoá <strong>image</strong>. Ví dụ <code>image: node:20</code>
    cho job có sẵn Node 20; <code>image: python:3.12</code> cho job Python. Đây là lý do CI 'chạy giống nhau mọi máy'
    — vì mọi job đều bắt đầu từ cùng một image chuẩn.</p>
    <p>Khi có nhiều runner khác nhau (máy Linux, máy có GPU, máy trong mạng nội bộ...), bạn dùng <strong>tags</strong>
    để chỉ định job cần loại runner nào. Runner được gắn nhãn; job khai <code>tags:</code> khớp nhãn → chỉ runner đó
    nhận job. Không khớp nhãn → job nằm chờ.</p>
    <div class="callout"><p>💡 Ba câu hỏi cho mỗi job: chạy <em>Ở ĐÂU</em> (runner nào — chọn bằng <code>tags</code>),
    <em>BẰNG GÌ</em> (executor + <code>image</code>), và <em>LỆNH GÌ</em> (<code>script</code>). Nắm ba cái này là
    hiểu trọn vòng đời một job.</p></div>
  `,

  codeTabs: [
    { id: "image", label: "🐳 image chọn môi trường", lines: [
      "# docker executor: mỗi job = 1 container mới từ image",
      "test-node:",
      "  image: node:20            # có sẵn Node 20 + npm",
      "  script: npm test",
      "",
      "test-python:",
      "  image: python:3.12        # môi trường Python riêng",
      "  script: pytest",
      "# hai job, hai môi trường độc lập, không dẫm chân nhau"
    ]},
    { id: "tags", label: "🏷️ tags chọn runner", lines: [
      "build-arm:",
      "  tags:",
      "    - linux",
      "    - arm64                 # chỉ runner gắn nhãn này mới nhận job",
      "  script: ./build.sh",
      "",
      "# nếu không runner nào có đủ nhãn -> job đứng chờ (stuck)"
    ]},
    { id: "default", label: "⚙️ default & services", lines: [
      "default:                    # áp cho MỌI job nếu job không tự khai",
      "  image: node:20",
      "  tags: [linux]",
      "",
      "e2e:",
      "  services:                 # container phụ chạy kèm job",
      "    - postgres:16           # DB thật để test chạy dựa vào",
      "  script: npm run test:e2e"
    ]}
  ],

  stageHtml: `
    <div class="node" id="job"><div class="nl">📋 Một job cần chạy</div><div class="ns">có script, có thể có tags/image</div></div>
    <div class="arrow" id="a1">↓ GitLab tìm runner khớp tags</div>
    <div class="node" id="match"><div class="nl">🏷️ Khớp nhãn tags</div><div class="ns">chỉ runner có đủ nhãn mới nhận</div></div>
    <div class="arrow" id="a2">↓ runner dùng executor để dựng môi trường</div>
    <div class="node" id="exec"><div class="nl">🐳 docker executor + image</div><div class="ns">tạo container mới từ image (node:20…)</div></div>
    <div class="arrow" id="a3">↓ chạy script trong container</div>
    <div class="node" id="done"><div class="nl">🧼 Xong → xoá container</div><div class="ns">môi trường sạch cho job kế tiếp</div></div>
  `,
  steps: [
    { title: "1 · Một job cần chạy", tab: "image", highlight: [2, 3, 4], on: ["job"],
      desc: "Job <code>test-node</code> khai <code>image: node:20</code> và một script. GitLab cần tìm nơi chạy nó và dựng đúng môi trường." },
    { title: "2 · Chọn runner bằng tags", tab: "tags", highlight: [1, 2, 3, 4], on: ["job", "a1", "match"],
      desc: "Nếu job khai <code>tags: [linux, arm64]</code>, chỉ runner được gắn <em>đủ</em> các nhãn đó mới nhận. Không có runner khớp → job đứng chờ ('stuck'). Tags là cách định tuyến job tới đúng máy." },
    { title: "3 · Executor dựng môi trường", tab: "image", highlight: [1, 3], on: ["match", "a2", "exec"],
      desc: "Runner dùng <strong>docker executor</strong>: tạo một container mới từ <code>image: node:20</code>. Container này sạch, có sẵn Node 20 — giống hệt nhau ở mọi lần chạy." },
    { title: "4 · Mỗi job môi trường riêng", tab: "image", highlight: [6, 7, 8], on: ["exec"],
      desc: "<code>test-python</code> dùng <code>image: python:3.12</code> — container riêng, hoàn toàn tách biệt với job Node. Không job nào 'dây bẩn' môi trường sang job khác." },
    { title: "5 · default cho gọn", tab: "default", highlight: [1, 2, 3], on: ["exec"],
      desc: "Khoá <code>default:</code> đặt image/tags mặc định cho <em>mọi</em> job không tự khai — đỡ lặp. Job nào cần khác thì tự ghi đè." },
    { title: "6 · Xong thì xoá sạch", tab: "default", highlight: [5, 6, 7, 8], on: ["exec", "a3", "done"],
      desc: "Chạy script xong, docker executor <strong>xoá container</strong>. Job sau lại bắt đầu từ container mới toanh. (Cần DB để test? Dùng <code>services:</code> chạy kèm một container phụ như postgres.)" }
  ],

  quiz: [
    { q: "Trong GitLab CI, 'executor' của runner quyết định điều gì?", options: [
        "Thứ tự các stage",
        "Cách/môi trường mà job được thực thi (docker container, shell máy, k8s...)",
        "Ai được quyền xem log",
        "Tên của pipeline"
      ], correct: 1,
      explanation: "Executor là 'động cơ' chạy job: docker (container mới mỗi job), shell (thẳng trên máy), kubernetes... Nó quyết định môi trường thực thi." },
    { q: "Với docker executor, khoá 'image' dùng để làm gì?", options: [
        "Chọn ảnh nền cho giao diện GitLab",
        "Chọn image Docker làm môi trường chạy job (ví dụ node:20)",
        "Nén artifact lại",
        "Đặt tên cho runner"
      ], correct: 1,
      explanation: "image chỉ định môi trường container cho job — node:20, python:3.12... Nhờ đó mọi lần chạy đều xuất phát từ môi trường chuẩn, giống nhau." },
    { q: "Khoá 'tags' trên một job có tác dụng gì?", options: [
        "Gắn nhãn phân loại cho log",
        "Chỉ định job cần loại runner có nhãn tương ứng mới nhận chạy",
        "Đánh dấu commit",
        "Tự động tạo git tag"
      ], correct: 1,
      explanation: "tags định tuyến job: chỉ runner được gắn đủ các nhãn khớp mới nhận job. Không runner nào khớp thì job đứng chờ." },
    { q: "Ưu điểm của docker executor (mỗi job một container mới rồi xoá) là gì?", options: [
        "Job chạy chậm nhưng an toàn",
        "Môi trường luôn sạch và giống nhau, job không 'dây bẩn' trạng thái sang nhau",
        "Không cần cài runner",
        "Tự động sửa lỗi code"
      ], correct: 1,
      explanation: "Container mới cho mỗi job đảm bảo môi trường sạch, nhất quán, tách biệt — đúng tinh thần 'chạy giống nhau mọi lúc' của CI." }
  ]
});
