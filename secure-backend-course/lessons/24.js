window.LESSONS.push({
  id: "24",
  phase: "6", phaseName: "Vận hành & quy trình",
  title: "Supply chain & dependency — code bạn không viết cũng là code của bạn",
  subtitle: "Lockfile · pin version · SCA (Dependabot/Renovate/OSV) · typosquatting · script cài đặt · SBOM · bảo vệ CI/CD · ký artifact",

  theory: `
    <p>Một backend điển hình có vài nghìn dòng code do team viết, nhưng kéo theo <strong>hàng trăm đến hàng nghìn package</strong> từ npm, PyPI, Maven Central, Go modules, crates.io…
    cộng thêm base image Docker, GitHub Actions/GitLab CI template, plugin build. Tất cả chạy với <strong>đúng quyền của ứng dụng</strong> — đọc được biến môi trường, secret, database.
    "Chuỗi cung ứng phần mềm" (software supply chain) là toàn bộ con đường từ code nguồn của người khác tới artifact chạy trên production. Kẻ tấn công ngày càng nhắm vào đây vì
    tấn công một package phổ biến = tấn công hàng nghìn công ty cùng lúc.</p>

    <p><strong>1. Các kiểu rủi ro chính</strong> (chỉ cần hiểu để biết phòng thủ chỗ nào):</p>
    <table>
      <tr><th>Rủi ro</th><th>Mô tả</th></tr>
      <tr><td>Lỗ hổng đã biết (CVE)</td><td>Package bạn dùng có bug bảo mật đã công bố. Phổ biến nhất — và dễ phòng nhất nếu có quy trình cập nhật.</td></tr>
      <tr><td>Typosquatting</td><td>Package tên gần giống package thật (thiếu/thừa một chữ, đổi thứ tự, dùng gạch ngang thay gạch dưới). Gõ nhầm khi cài là dính.</td></tr>
      <tr><td>Dependency confusion</td><td>Công ty có package nội bộ tên <code>acme-utils</code>; ai đó đăng package cùng tên lên registry công khai với version cao hơn; trình quản lý package chọn nhầm bản công khai.</td></tr>
      <tr><td>Package bị chiếm quyền</td><td>Tài khoản maintainer bị lộ mật khẩu/token, hoặc maintainer mới "tiếp quản" dự án rồi phát hành version chứa mã độc.</td></tr>
      <tr><td>Script cài đặt</td><td>Nhiều hệ sinh thái cho phép package chạy code ngay lúc cài (npm <code>postinstall</code>, <code>setup.py</code> của Python, build script). Chỉ cần cài là code chạy — trên máy dev hoặc CI có secret.</td></tr>
      <tr><td>Pipeline CI/CD bị xâm nhập</td><td>CI có quyền push image, deploy production, đọc secret. Một action/plugin bên thứ ba bị sửa, hoặc PR từ người lạ chạy được job có secret → mất cả hệ thống.</td></tr>
      <tr><td>Artifact bị tráo</td><td>Image/binary bị thay trên đường từ CI tới production, và không ai kiểm tra nó có đúng là thứ CI đã build không.</td></tr>
    </table>

    <p><strong>2. Lockfile và pin version — biết chính xác mình đang chạy gì.</strong></p>
    <ul>
      <li><strong>Lockfile</strong> (<code>package-lock.json</code>, <code>pnpm-lock.yaml</code>, <code>yarn.lock</code>, <code>poetry.lock</code>, <code>uv.lock</code>, <code>Pipfile.lock</code>, <code>go.sum</code>, <code>Cargo.lock</code>, <code>gradle.lockfile</code>, <code>composer.lock</code>)
        ghi lại version chính xác <em>và hash</em> của mọi package, kể cả dependency gián tiếp. <strong>Luôn commit lockfile</strong> vào git.</li>
      <li>Trong CI, dùng lệnh cài <strong>đúng theo lockfile</strong> và thất bại nếu lockfile lệch: <code>npm ci</code>, <code>pnpm install --frozen-lockfile</code>, <code>yarn install --immutable</code>,
        <code>pip install --require-hashes -r requirements.txt</code>, <code>poetry install --sync</code>, <code>go mod verify</code>, <code>cargo build --locked</code>.</li>
      <li>Khai báo version có kiểm soát: khoảng quá rộng (<code>*</code>, <code>latest</code>, <code>&gt;=1.0</code>) nghĩa là mỗi lần build có thể kéo về code mới chưa ai review.</li>
      <li>Base image Docker: pin theo <strong>digest</strong> (<code>image@sha256:...</code>) chứ không chỉ theo tag — tag có thể bị trỏ sang image khác.</li>
    </ul>

    <p><strong>3. SCA — Software Composition Analysis: tự động phát hiện dependency có lỗ hổng.</strong></p>
    <ul>
      <li>Công cụ đối chiếu lockfile với cơ sở dữ liệu lỗ hổng (OSV, GitHub Advisory, NVD): <strong>Dependabot</strong>, <strong>Renovate</strong>, <strong>OSV-Scanner</strong>, <code>npm audit</code>, <code>pip-audit</code>,
        <code>govulncheck</code> (Go — còn kiểm tra code có thực sự <em>gọi</em> hàm bị lỗi không), <code>cargo audit</code>, OWASP Dependency-Check, Snyk, Trivy/Grype (quét cả image container).</li>
      <li>Chạy SCA <strong>trong CI cho mỗi PR</strong> và <strong>theo lịch</strong> (lỗ hổng mới được công bố mỗi ngày cho code không đổi).</li>
      <li>Bot tự mở PR cập nhật (Dependabot/Renovate) + test tự động tốt = cập nhật trở thành việc nhỏ hằng tuần thay vì dự án lớn mỗi năm.</li>
      <li>Có <strong>chính sách xử lý</strong>: lỗ hổng Critical/High trong code đang dùng → sửa trong N ngày; nếu chưa có bản vá → ghi nhận, đánh giá, có biện pháp tạm thời. Không để cảnh báo tích tụ tới mức mọi người lờ đi.</li>
      <li>Bớt dependency: mỗi package thêm vào là thêm một nhóm người bạn phải tin. Trước khi thêm, hỏi: có thật cần không? package còn được bảo trì không? bao nhiêu người dùng? maintainer là ai?</li>
    </ul>

    <p><strong>4. Chống typosquatting & dependency confusion.</strong></p>
    <ul>
      <li>Copy tên package từ tài liệu chính thức, kiểm tra trang registry (số lượt tải, repo nguồn, ngày tạo) trước khi thêm dependency mới. Review kỹ diff lockfile trong PR — một package lạ xuất hiện là tín hiệu cần hỏi.</li>
      <li>Package nội bộ dùng <strong>scope/namespace</strong> của tổ chức (<code>@acme/utils</code>, group ID <code>com.acme</code>) và cấu hình registry để scope đó <strong>chỉ</strong> lấy từ registry nội bộ.</li>
      <li>Dùng registry proxy nội bộ (Artifactory, Nexus, GitHub Packages, GitLab Package Registry) làm nguồn duy nhất, có thể chặn package mới đăng quá gần đây hoặc chưa được duyệt.</li>
    </ul>

    <p><strong>5. Script cài đặt.</strong> Với npm/pnpm/yarn có thể tắt script mặc định (<code>ignore-scripts=true</code> trong <code>.npmrc</code>) và chỉ bật cho danh sách package cần build native được duyệt
    (pnpm có <code>onlyBuiltDependencies</code>). Với Python ưu tiên cài wheel đã build sẵn (<code>--only-binary</code>) thay vì chạy <code>setup.py</code>. Cài dependency trong CI ở bước <strong>không có secret</strong>,
    tách khỏi bước deploy có secret.</p>

    <p><strong>6. SBOM — Software Bill of Materials.</strong> Là "danh sách thành phần" của artifact: mọi package, version, license, hash — theo chuẩn <strong>CycloneDX</strong> hoặc <strong>SPDX</strong>.
    Sinh SBOM trong CI (Syft, cdxgen, plugin CycloneDX cho Maven/Gradle/npm) và lưu kèm mỗi bản phát hành. Lợi ích: khi một lỗ hổng lớn được công bố, bạn trả lời được trong vài phút
    "service nào của chúng ta đang dùng package đó, version nào" thay vì mất cả tuần đi hỏi từng team.</p>

    <p><strong>7. Bảo vệ pipeline CI/CD</strong> — CI thường là hệ thống có quyền lớn nhất công ty:</p>
    <ul>
      <li><strong>Secret CI</strong>: lưu trong secret store của CI, không trong code/YAML; gắn secret với <em>environment</em> được bảo vệ (chỉ branch main/tag mới dùng được secret production);
        mask trong log; <strong>PR từ fork không được đọc secret</strong>; ưu tiên <strong>OIDC</strong> để CI đổi lấy credential cloud ngắn hạn thay vì lưu access key dài hạn.</li>
      <li><strong>Quyền token tối thiểu</strong>: token mặc định của job chỉ đọc (<code>permissions: contents: read</code>), job nào cần ghi thì cấp riêng quyền đó. Deploy key chỉ cho một repo, một môi trường.</li>
      <li><strong>Pin action/template bên thứ ba theo commit hash đầy đủ</strong>, không theo tag (<code>@v3</code>) hay branch (<code>@main</code>) — tag có thể bị dời sang commit khác. Renovate/Dependabot cập nhật hash giúp bạn.</li>
      <li><strong>Không đưa dữ liệu không tin cậy vào script</strong>: tiêu đề PR, tên branch, nội dung issue là input của người ngoài — không nội suy trực tiếp vào lệnh shell trong workflow (cùng bệnh với bài 06); truyền qua biến môi trường.</li>
      <li>Bảo vệ branch chính: bắt buộc review, bắt buộc CI xanh, không cho force-push; thay đổi file cấu hình CI cần CODEOWNERS duyệt.</li>
      <li>Runner: dùng runner tạm thời (mỗi job một máy sạch); runner self-hosted không dùng chung cho repo công khai.</li>
    </ul>

    <p><strong>8. Ký artifact & xác minh nguồn gốc (provenance).</strong> CI build image/binary rồi <strong>ký</strong> nó (vd <strong>Sigstore cosign</strong>, keyless dựa trên danh tính OIDC của CI)
    và sinh <strong>attestation</strong> mô tả "artifact này được build từ commit nào, bởi workflow nào" (khung <strong>SLSA</strong>). Môi trường deploy (Kubernetes admission controller như Kyverno/Sigstore policy-controller)
    <strong>chỉ chạy artifact có chữ ký hợp lệ từ CI của bạn</strong>. Artifact bị tráo giữa đường sẽ bị từ chối. Deploy luôn tham chiếu image theo digest.</p>

    <div class="callout"><p>💡 Nguyên tắc tổng quát: <strong>biết mình dùng gì</strong> (lockfile, SBOM) · <strong>biết khi nó có lỗ hổng</strong> (SCA) · <strong>cập nhật thường xuyên</strong> (bot + test) ·
    <strong>giới hạn thứ nó được làm</strong> (tắt script, CI quyền tối thiểu) · <strong>chứng minh được thứ đang chạy là thứ mình đã build</strong> (ký + xác minh).</p></div>
  `,

  codeTabs: [
    { id: "lock", label: "🔒 Lockfile & pin", lines: [
      "# Commit lockfile, CI cài ĐÚNG theo lockfile (lệch -> fail)",
      "npm ci                                   # Node (npm)",
      "pnpm install --frozen-lockfile           # Node (pnpm)",
      "pip install --require-hashes -r requirements.txt   # Python: kiểm tra hash từng gói",
      "go mod verify                            # Go: đối chiếu go.sum",
      "cargo build --locked                     # Rust",
      "./gradlew build --write-locks            # Java/Gradle: tạo lockfile (lần đầu)",
      "",
      "# .npmrc — tắt script cài đặt mặc định",
      "ignore-scripts=true",
      "@acme:registry=https://npm.internal.acme.example/   # scope nội bộ chỉ lấy từ registry nội bộ",
      "",
      "# Dockerfile — pin base image theo digest, không chỉ tag",
      "FROM node:22-slim@sha256:<digest_đã_kiểm_tra>"
    ]},
    { id: "sca", label: "🔎 SCA", lines: [
      "# Quét lỗ hổng dependency — chạy mỗi PR + theo lịch hằng ngày",
      "osv-scanner scan --lockfile=package-lock.json",
      "npm audit --audit-level=high",
      "pip-audit -r requirements.txt",
      "govulncheck ./...          # Go: chỉ báo nếu code thật sự gọi hàm bị lỗi",
      "cargo audit",
      "trivy image --severity HIGH,CRITICAL registry.example/app@sha256:<digest>",
      "",
      "# renovate.json — bot tự mở PR cập nhật, gom nhóm, pin digest",
      "{",
      "  'extends': ['config:recommended', 'helpers:pinGitHubActionDigests'],",
      "  'vulnerabilityAlerts': { 'labels': ['security'] },",
      "  'minimumReleaseAge': '3 days'    // chờ vài ngày trước khi nhận bản mới phát hành",
      "}"
    ]},
    { id: "ci", label: "🏗️ CI an toàn", lines: [
      "# GitHub Actions — quyền tối thiểu, pin theo hash, secret theo environment",
      "permissions:",
      "  contents: read                  # mặc định chỉ đọc",
      "",
      "jobs:",
      "  test:                           # chạy cho PR, KHÔNG có secret",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@<full_commit_sha>   # pin hash, không dùng @v4/@main",
      "      - run: npm ci && npm test",
      "  deploy:",
      "    if: github.ref == 'refs/heads/main'",
      "    environment: production        # secret chỉ mở cho env được bảo vệ",
      "    permissions:",
      "      id-token: write              # OIDC -> credential cloud ngắn hạn, không lưu access key",
      "      contents: read",
      "    steps:",
      "      - env:",
      "          PR_TITLE: <tiêu_đề_PR>    # input ngoài -> biến môi trường, KHÔNG nội suy vào lệnh",
      "        run: ./deploy.sh"
    ]},
    { id: "sbom", label: "📦 SBOM & ký", lines: [
      "# 1) Sinh SBOM cho artifact",
      "syft registry.example/app@sha256:<digest> -o cyclonedx-json > sbom.cdx.json",
      "",
      "# 2) Ký image (keyless, danh tính OIDC của CI) và đính kèm SBOM",
      "cosign sign registry.example/app@sha256:<digest>",
      "cosign attest --type cyclonedx --predicate sbom.cdx.json registry.example/app@sha256:<digest>",
      "",
      "# 3) Trước khi deploy: xác minh chữ ký đến từ đúng workflow CI của mình",
      "cosign verify registry.example/app@sha256:<digest> \\",
      "  --certificate-identity-regexp '^https://github.com/acme/app/.github/workflows/release.yml@' \\",
      "  --certificate-oidc-issuer https://token.actions.githubusercontent.com",
      "",
      "# 4) Kubernetes: admission policy chỉ cho chạy image đã ký (Kyverno / policy-controller)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="registry"><div class="nl">📚 Registry công khai</div><div class="ns">npm · PyPI · Maven · Go · crates</div></div>
      <div class="node" id="internal"><div class="nl">🏢 Registry/proxy nội bộ</div><div class="ns">scope nội bộ · duyệt package</div></div>
    </div>
    <div class="arrow" id="a1">↓ cài theo lockfile + hash · tắt script</div>
    <div class="node" id="repo"><div class="nl">📁 Repo: code + lockfile</div><div class="ns">bot SCA mở PR cập nhật · review diff lockfile</div></div>
    <div class="arrow" id="a2">↓ PR / merge</div>
    <div class="node" id="ci"><div class="nl">🏗️ CI/CD</div><div class="ns">quyền tối thiểu · action pin hash · secret theo environment · OIDC</div></div>
    <div class="arrow" id="a3">↓ build → SBOM → ký</div>
    <div class="node" id="artifact"><div class="nl">📦 Artifact đã ký + SBOM</div><div class="ns">image@sha256 · attestation nguồn gốc</div></div>
    <div class="arrow" id="a4">↓ xác minh chữ ký</div>
    <div class="node" id="prod"><div class="nl">🚀 Production</div><div class="ns">chỉ chạy artifact có chữ ký hợp lệ</div></div>
  `,
  steps: [
    { title: "1 · Dependency chạy với quyền của bạn", tab: "lock", highlight: [1, 2, 3, 4, 5, 6], on: ["registry", "a1", "repo"],
      desc: "Mỗi package là code của người khác chạy với quyền của ứng dụng. Bước đầu tiên: lockfile ghi version + hash chính xác, CI cài <em>đúng</em> theo lockfile và fail nếu lệch." },
    { title: "2 · Chặn đường vào: registry, scope, script", tab: "lock", highlight: [9, 10, 11, 13, 14], on: ["registry", "internal", "a1"],
      desc: "Tắt script cài đặt mặc định, package nội bộ dùng scope và chỉ lấy từ registry nội bộ (chống dependency confusion), base image pin theo digest." },
    { title: "3 · SCA: biết khi dependency có lỗ hổng", tab: "sca", highlight: [2, 3, 4, 5, 6, 7], on: ["repo"],
      desc: "Đối chiếu lockfile/image với cơ sở dữ liệu lỗ hổng (OSV, GitHub Advisory) ở mỗi PR và theo lịch. <code>govulncheck</code> còn kiểm tra code có thật sự gọi tới hàm bị lỗi không." },
    { title: "4 · Cập nhật thành thói quen", tab: "sca", highlight: [10, 11, 12, 13], on: ["repo", "a2"],
      desc: "Renovate/Dependabot tự mở PR, gom nhóm, pin digest cho action. <code>minimumReleaseAge</code> chờ vài ngày để cộng đồng kịp phát hiện version bị chèn mã độc. Test tốt giúp merge nhanh." },
    { title: "5 · CI có quyền lớn nhất — khoá chặt nó", tab: "ci", highlight: [2, 3, 6, 9, 12, 13, 15, 19], on: ["ci"],
      desc: "Token mặc định chỉ đọc; action pin theo commit hash; job chạy cho PR không có secret; secret production gắn với environment được bảo vệ; dùng OIDC thay access key; input ngoài truyền qua biến môi trường." },
    { title: "6 · SBOM: danh sách thành phần", tab: "sbom", highlight: [2, 6], on: ["a3", "artifact"],
      desc: "SBOM (CycloneDX/SPDX) cho mỗi bản phát hành. Khi có lỗ hổng lớn mới công bố, bạn tra ngay được service nào đang dùng package đó." },
    { title: "7 · Ký và xác minh artifact", tab: "sbom", highlight: [5, 9, 10, 11, 13], on: ["artifact", "a4", "prod"],
      desc: "CI ký image bằng danh tính OIDC; trước khi deploy, xác minh chữ ký đến đúng từ workflow release của repo mình. Admission policy từ chối mọi image không có chữ ký hợp lệ." }
  ],

  quiz: [
    { q: "Vì sao cần commit lockfile (package-lock.json, poetry.lock, go.sum…) vào git?", options: [
        "Để repo nặng hơn",
        "Để mọi lần build (máy dev, CI, production) dùng đúng cùng version và hash của mọi package, kể cả dependency gián tiếp",
        "Vì trình quản lý package bắt buộc",
        "Để không cần chạy test"
      ], correct: 1,
      explanation: "Không có lockfile, mỗi lần build có thể kéo về version mới chưa ai review — kể cả version bị chèn mã độc." },
    { q: "Khác biệt giữa 'npm install' và 'npm ci' trong CI là gì về bảo mật?", options: [
        "Không khác gì",
        "npm ci cài đúng theo lockfile và báo lỗi nếu package.json và lockfile lệch nhau; npm install có thể cập nhật lockfile",
        "npm ci nhanh hơn nên an toàn hơn",
        "npm ci không cài dependency gián tiếp"
      ], correct: 1,
      explanation: "Build tái lập được (reproducible) là nền tảng: thứ được test chính là thứ được deploy." },
    { q: "Công ty có package nội bộ 'acme-utils' (không scope). Ai đó đăng 'acme-utils' version 99.0.0 lên npm công khai. Đây là kiểu tấn công gì và phòng thế nào?", options: [
        "Typosquatting — không phòng được",
        "Dependency confusion — dùng scope nội bộ (@acme/utils) và cấu hình scope đó chỉ lấy từ registry nội bộ",
        "SQL Injection — dùng prepared statement",
        "XSS — bật CSP"
      ], correct: 1,
      explanation: "Trình quản lý package có thể chọn bản version cao hơn từ registry công khai. Scope + cấu hình registry cố định nguồn cho package nội bộ." },
    { q: "Vì sao nên pin GitHub Action bên thứ ba theo commit hash đầy đủ thay vì '@v4'?", options: [
        "Vì hash ngắn hơn",
        "Vì tag có thể bị dời sang commit khác (vd khi tài khoản maintainer bị chiếm), còn commit hash là bất biến",
        "Vì GitHub không hỗ trợ tag",
        "Vì chạy nhanh hơn"
      ], correct: 1,
      explanation: "Pin hash đảm bảo đoạn code chạy trong CI chính là đoạn bạn đã xem. Bot (Renovate/Dependabot) giúp cập nhật hash có kiểm soát." },
    { q: "Workflow CI có job test chạy cho mọi PR, kể cả PR từ fork của người lạ. Job này có nên được đọc secret deploy production không?", options: [
        "Có, để test được đầy đủ",
        "Không — code trong PR của người lạ chạy trong job đó có thể đọc và gửi secret ra ngoài",
        "Có, nếu secret được mask trong log",
        "Có, nếu PR có tiêu đề hợp lệ"
      ], correct: 1,
      explanation: "Mask chỉ ẩn trong log, không ngăn code đọc biến môi trường. Secret production chỉ mở cho job chạy trên branch/environment được bảo vệ." },
    { q: "Lợi ích chính của OIDC trong CI (vd CI đổi token lấy credential AWS/GCP) là gì?", options: [
        "Không cần mạng",
        "Không phải lưu access key dài hạn trong CI; credential được cấp ngắn hạn, gắn với repo/branch/environment cụ thể",
        "Tăng tốc build",
        "Thay thế hoàn toàn review code"
      ], correct: 1,
      explanation: "Access key dài hạn bị lộ thì dùng được mãi tới khi thu hồi. Credential OIDC hết hạn sau vài phút-giờ và chỉ cấp cho đúng danh tính workflow." },
    { q: "SBOM giúp gì khi một lỗ hổng nghiêm trọng mới được công bố trong một thư viện phổ biến?", options: [
        "Tự động vá lỗ hổng",
        "Tra cứu nhanh service/bản phát hành nào đang chứa thư viện đó và version nào",
        "Chặn mọi request tới server",
        "Mã hoá mã nguồn"
      ], correct: 1,
      explanation: "SBOM là danh sách thành phần của từng artifact. Không có nó, bạn phải đi hỏi từng team, quét lại từng repo." },
    { q: "Tiêu đề PR được nội suy thẳng vào một lệnh shell trong file workflow CI. Rủi ro là gì và cách sửa?", options: [
        "Không có rủi ro vì tiêu đề PR chỉ là văn bản",
        "Command injection trong CI — tiêu đề PR là input không tin cậy; truyền qua biến môi trường và tham chiếu biến trong script",
        "Chỉ làm log xấu",
        "Làm PR bị đóng"
      ], correct: 1,
      explanation: "Cùng bệnh với bài 06: dữ liệu bị trộn vào lệnh. Biến môi trường được shell coi là dữ liệu, không phải cú pháp lệnh." },
    { q: "Mục đích của việc ký image bằng cosign và xác minh ở admission controller là gì?", options: [
        "Nén image nhỏ hơn",
        "Đảm bảo image chạy trên production đúng là image do CI của bạn build, không bị tráo giữa đường",
        "Tăng tốc pull image",
        "Thay thế quét lỗ hổng"
      ], correct: 1,
      explanation: "Chữ ký + xác minh danh tính người ký (workflow nào, repo nào) biến 'hy vọng đây là image của mình' thành điều kiểm chứng được." },
    { q: "Cấu hình 'minimumReleaseAge: 3 days' trong Renovate nhằm mục đích gì?", options: [
        "Làm chậm việc vá lỗi để tiết kiệm CI",
        "Tránh nhận ngay version vừa phát hành — nếu version đó bị chèn mã độc, cộng đồng thường phát hiện và gỡ trong vài ngày",
        "Để tuân thủ license",
        "Để giảm kích thước lockfile"
      ], correct: 1,
      explanation: "Là sự đánh đổi có chủ đích; bản vá bảo mật khẩn cấp có thể được cấu hình ngoại lệ." }
  ]
});
