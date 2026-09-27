window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Wrangler & cấu hình",
  title: "Wrangler & wrangler.jsonc — tạo, chạy local, deploy, rollback",
  subtitle: "create-cloudflare · compatibility_date · wrangler dev (workerd) · deploy · versions · rollback · wrangler types",

  theory: `
    <p><strong>Wrangler</strong> là CLI chính thức (Node.js) — vai trò giống Maven/Gradle + <code>kubectl</code> gộp lại: chạy local, deploy, quản lý KV/D1/R2/Queues, xem log.
    File cấu hình là <code>wrangler.jsonc</code> (JSON có comment; Cloudflare khuyên dùng, tính năng mới chỉ có ở JSON) hoặc <code>wrangler.toml</code> (cũ, vẫn chạy).</p>

    <p><strong>Các trường bắt buộc phải hiểu</strong></p>
    <ul>
      <li><code>name</code>: tên Worker trên Cloudflare (cũng là subdomain <code>name.account.workers.dev</code>).</li>
      <li><code>main</code>: file entry (TS được Wrangler tự bundle bằng esbuild — không cần webpack/tsc riêng).</li>
      <li><code>compatibility_date</code>: "hợp đồng" hành vi runtime. Cloudflare sửa hành vi runtime (có thể phá tương thích) sau một <em>ngày</em>; Worker của bạn giữ
      hành vi của ngày bạn ghi, tới khi bạn chủ động nâng. Giống việc ghim version Spring Boot, nhưng cho chính runtime.</li>
      <li><code>compatibility_flags</code>: bật/tắt từng hành vi lẻ, vd <code>nodejs_compat</code> (cho phép <code>node:buffer</code>, <code>node:crypto</code>…).
      Từ <code>compatibility_date</code> 2026-08-04 cờ này được bật mặc định; project cũ vẫn phải khai báo.</li>
    </ul>

    <p><strong>Dev local</strong>: <code>wrangler dev</code> chạy Worker trong <strong>workerd</strong> — chính runtime chạy production, mã nguồn mở — ở <code>localhost:8787</code>.
    KV/D1/R2/Queues/DO được giả lập, dữ liệu lưu ở <code>.wrangler/state</code>. Muốn một binding dùng tài nguyên thật trên Cloudflare khi dev, đặt <code>"remote": true</code> cho binding đó.</p>

    <p><strong>Deploy &amp; phiên bản</strong>: mỗi <code>wrangler deploy</code> tạo một <em>version</em> bất biến và đưa 100% traffic sang nó ngay. Muốn triển khai dần:
    <code>wrangler versions upload</code> (tải lên, chưa nhận traffic) rồi <code>wrangler versions deploy</code> (chia % traffic giữa 2 version). Hỏng thì
    <code>wrangler rollback</code> — quay về version trước trong vài giây, không cần build lại. Lưu ý: rollback chỉ quay <em>code + cấu hình</em>, không quay dữ liệu KV/D1.</p>

    <p><strong>Type an toàn</strong>: <code>wrangler types</code> đọc wrangler.jsonc và sinh <code>worker-configuration.d.ts</code> chứa interface <code>Env</code>
    (mỗi binding thành một field có kiểu đúng) cùng kiểu của runtime. Chạy lại mỗi khi sửa config; trong CI dùng <code>wrangler types --check</code>.</p>

    <div class="callout"><p>💡 Nếu <code>env.DB</code> là <code>undefined</code> lúc chạy, 90% là tên binding trong code không khớp tên trong wrangler.jsonc,
    hoặc bạn khai báo ở top-level nhưng deploy với <code>--env staging</code> (bài 05).</p></div>
  `,

  codeTabs: [
    { id: "cli", label: "Lệnh cơ bản", lines: [
      "npm create cloudflare@latest -- shop-api     # C3: chọn template 'Hello World' + TypeScript",
      "cd shop-api",
      "npx wrangler login                             # OAuth qua trình duyệt, lưu token local",
      "npx wrangler dev                               # workerd local tại http://localhost:8787",
      "npx wrangler types                             # sinh worker-configuration.d.ts (interface Env)",
      "npx wrangler deploy                            # build + upload + 100% traffic",
      "npx wrangler deployments list                  # lịch sử deploy",
      "npx wrangler rollback                          # quay về version trước"
    ]},
    { id: "cfg", label: "wrangler.jsonc", lines: [
      "{",
      "  \"$schema\": \"./node_modules/wrangler/config-schema.json\",",
      "  \"name\": \"shop-api\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"compatibility_flags\": [\"nodejs_compat\"],",
      "  \"observability\": { \"enabled\": true },",
      "  \"vars\": { \"APP_ENV\": \"dev\" },",
      "  \"kv_namespaces\": [",
      "    { \"binding\": \"CACHE\", \"id\": \"<KV_ID>\" }",
      "  ]",
      "}"
    ]},
    { id: "grad", label: "Triển khai dần", lines: [
      "# 1. tải version mới lên, CHƯA nhận traffic",
      "npx wrangler versions upload --message \"v2: thêm /orders\"",
      "",
      "# 2. chia 10% traffic cho version mới (lệnh hỏi tương tác chọn version + %)",
      "npx wrangler versions deploy",
      "",
      "# 3. theo dõi lỗi, rồi đẩy lên 100% — hoặc quay lại",
      "npx wrangler rollback"
    ]},
    { id: "java", label: "So với Maven/K8s", lines: [
      "# Java/Spring                                  # Workers",
      "pom.xml / build.gradle              <->        package.json + wrangler.jsonc",
      "mvn spring-boot:run                 <->        wrangler dev",
      "docker build + kubectl apply        <->        wrangler deploy",
      "kubectl rollout undo                <->        wrangler rollback",
      "Spring Boot version                 <->        compatibility_date",
      "application.yml                     <->        vars + bindings trong wrangler.jsonc"
    ]}
  ],

  stageHtml: `
    <div class="node" id="code"><div class="nl">📝 src/index.ts + wrangler.jsonc</div><div class="ns">code + khai báo binding</div></div>
    <div class="row">
      <div class="node" id="dev"><div class="nl">💻 wrangler dev</div><div class="ns">workerd local · .wrangler/state</div></div>
      <div class="node" id="types"><div class="nl">🧾 wrangler types</div><div class="ns">sinh interface Env</div></div>
    </div>
    <div class="arrow" id="a1">↓ wrangler deploy (esbuild bundle + upload)</div>
    <div class="node" id="ver"><div class="nl">📦 Version bất biến</div><div class="ns">nhận % traffic</div></div>
    <div class="arrow" id="a2">↺ rollback về version trước</div>
  `,
  steps: [
    { title: "1 · Khởi tạo project", tab: "cli", highlight: [1, 2, 3], on: ["code"],
      desc: "C3 tạo sẵn package.json, tsconfig, wrangler.jsonc và src/index.ts." },
    { title: "2 · Đọc wrangler.jsonc", tab: "cfg", highlight: [3, 4, 5, 6], on: ["code"],
      desc: "<code>compatibility_date</code> ghim hành vi runtime; <code>nodejs_compat</code> mở các module <code>node:*</code>." },
    { title: "3 · Chạy local bằng runtime thật", tab: "cli", highlight: [4, 5], on: ["dev", "types"],
      desc: "workerd chạy local giống production. <code>wrangler types</code> sinh kiểu cho <code>env.CACHE</code>, <code>env.APP_ENV</code>..." },
    { title: "4 · Deploy = một version mới", tab: "cli", highlight: [6, 7], on: ["a1", "ver"],
      desc: "Wrangler bundle TS bằng esbuild, upload, tạo version và chuyển toàn bộ traffic." },
    { title: "5 · Triển khai dần & rollback", tab: "grad", highlight: [2, 5, 8], on: ["ver", "a2"],
      desc: "Tách upload và deploy để canary. Rollback nhanh vì version cũ vẫn còn đó — nhưng dữ liệu thì không quay lại." },
    { title: "6 · Bản đồ từ thế giới Java", tab: "java", highlight: [3, 4, 5, 6], on: ["code", "ver"],
      desc: "Đa số khái niệm có tương đương; khác lớn nhất là không có image/container nào cả." }
  ],

  quiz: [
    { q: "compatibility_date dùng để làm gì?", options: [
        "Ngày hết hạn của Worker",
        "Ghim hành vi runtime theo một ngày; thay đổi phá tương thích sau ngày đó không ảnh hưởng tới Worker cho tới khi bạn nâng",
        "Ngày deploy gần nhất",
        "Ngày cron chạy"
      ], correct: 1, explanation: "Cơ chế giúp Cloudflare sửa runtime mà không phá Worker cũ." },
    { q: "wrangler dev chạy Worker bằng gì?", options: [
        "Node.js thuần",
        "workerd — runtime mã nguồn mở giống production, chạy trên máy bạn",
        "Docker container",
        "Luôn chạy trên Cloudflare"
      ], correct: 1, explanation: "Binding được giả lập local, trừ khi đặt remote: true." },
    { q: "Dữ liệu KV/D1 khi chạy wrangler dev local nằm ở đâu?", options: [
        "Trên Cloudflare production",
        "Trong thư mục .wrangler/state của project",
        "Trong RAM, mất khi tắt",
        "Trong ~/.m2"
      ], correct: 1, explanation: "Có thể xoá thư mục này để reset dữ liệu local." },
    { q: "Lệnh nào sinh interface Env có kiểu đúng cho các binding?", options: [
        "wrangler init", "wrangler types", "tsc --env", "wrangler bindings"
      ], correct: 1, explanation: "Sinh worker-configuration.d.ts; chạy lại sau mỗi lần sửa config." },
    { q: "Muốn upload version mới nhưng CHƯA cho nhận traffic để canary, dùng gì?", options: [
        "wrangler deploy --dry-run",
        "wrangler versions upload, sau đó wrangler versions deploy để chia %",
        "wrangler publish",
        "wrangler dev --remote"
      ], correct: 1, explanation: "deploy thường = upload + 100% traffic ngay." },
    { q: "wrangler rollback có khôi phục dữ liệu D1 về trạng thái cũ không?", options: [
        "Có",
        "Không — chỉ quay code và cấu hình của Worker",
        "Chỉ khôi phục KV",
        "Chỉ trên gói Paid"
      ], correct: 1, explanation: "Migration dữ liệu phải tự tính đường lui (backward compatible)." },
    { q: "Vì sao không cần cấu hình webpack/tsc riêng cho TypeScript?", options: [
        "Workers chạy TS trực tiếp không cần biên dịch",
        "Wrangler tự bundle bằng esbuild khi dev/deploy",
        "Phải tự cài webpack",
        "TS không được hỗ trợ"
      ], correct: 1, explanation: "esbuild chỉ bỏ type, không kiểm tra type — vẫn nên chạy tsc --noEmit trong CI." },
    { q: "Khuyến nghị hiện tại về định dạng file cấu hình?", options: [
        "Chỉ dùng wrangler.toml",
        "wrangler.jsonc — một số tính năng mới chỉ có ở JSON",
        "application.yml",
        "Không cần file cấu hình"
      ], correct: 1, explanation: "TOML vẫn chạy, nhưng docs mới ưu tiên JSONC." },
    { q: "env.DB là undefined lúc chạy. Nguyên nhân hay gặp nhất?", options: [
        "D1 bị sập",
        "Tên binding trong code khác tên trong config, hoặc binding khai ở top-level nhưng chạy với --env khác",
        "Thiếu import",
        "Hết quota"
      ], correct: 1, explanation: "Binding không được thừa kế sang environment (bài 05)." }
  ]
});
