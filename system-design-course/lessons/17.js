window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Vận hành",
  title: "Triển khai an toàn: rolling, blue-green, canary, feature flag",
  subtitle: "Tách deploy khỏi release · expand–contract cho DB · tương thích schema event · Workers gradual deployment · app mobile",

  theory: `
    <p>Phần lớn sự cố đến từ <strong>thay đổi</strong>. Mục tiêu không phải "không bao giờ lỗi", mà là: lỗi chỉ chạm một phần nhỏ người dùng, phát hiện nhanh, và rút lui trong vài phút.</p>

    <table>
      <tr><th>Chiến lược</th><th>Cách chạy</th><th>Ưu / nhược</th></tr>
      <tr><td>Rolling</td><td>Thay dần từng pod cũ bằng pod mới</td><td>Không tốn thêm máy; trong lúc chạy có cả hai phiên bản; rollback cũng phải rolling</td></tr>
      <tr><td>Blue-green</td><td>Dựng đủ môi trường mới (green) bên cạnh (blue), chuyển toàn bộ traffic một lần</td><td>Chuyển/rút tức thì; tốn gấp đôi tài nguyên lúc chuyển; lỗi thì chạm 100% ngay</td></tr>
      <tr><td>Canary</td><td>Cho 1% → 5% → 25% → 100% traffic sang bản mới, mỗi bước so metric với bản cũ</td><td>Giới hạn phạm vi ảnh hưởng; cần metric tốt và tự động dừng</td></tr>
      <tr><td>Feature flag</td><td>Code mới đã deploy nhưng tắt; bật theo % người dùng/nhóm/nội bộ</td><td>Tách <strong>deploy</strong> (đưa code lên) khỏi <strong>release</strong> (bật cho người dùng); tắt không cần deploy</td></tr>
    </table>

    <p><strong>Hai phiên bản luôn chạy song song</strong> — trong rolling/canary và khi rollback. Vì vậy mọi thay đổi phải tương thích <em>cả tiến lẫn lùi</em>:</p>
    <ul>
      <li><strong>DB: expand → migrate → contract</strong>. Đổi tên cột <code>phone</code> → <code>phone_e164</code> không làm trong một lần.
        (1) Thêm cột mới, code ghi cả hai. (2) Backfill dữ liệu cũ, code đọc cột mới. (3) Khi không còn bản cũ nào, xoá cột cũ. Mỗi bước là một lần deploy có thể rollback.</li>
      <li><strong>Migration không khoá bảng</strong>: Postgres <code>CREATE INDEX CONCURRENTLY</code>; thêm cột có default hằng số từ PG 11 không rewrite bảng; tránh <code>ALTER ... TYPE</code> trên bảng lớn giờ cao điểm.</li>
      <li><strong>Event Kafka</strong>: chỉ thêm field tuỳ chọn; consumer bỏ qua field lạ; đổi nghĩa → type/topic phiên bản mới. Deploy consumer hiểu định dạng mới <em>trước</em> producer phát nó.</li>
      <li><strong>API cho mobile</strong>: app cũ sống nhiều tháng → server phải giữ tương thích; có cơ chế "phiên bản tối thiểu" (min supported version) để buộc cập nhật khi thật cần; tính năng mới trên app bật bằng remote config/feature flag.</li>
    </ul>

    <p><strong>Cloudflare Workers</strong> hỗ trợ <em>gradual deployments</em>: upload phiên bản mới mà chưa nhận traffic (<code>wrangler versions upload</code>), rồi chia traffic theo % giữa hai phiên bản (<code>wrangler versions deploy</code>), rollback bằng <code>wrangler rollback</code>.</p>

    <div class="callout"><p>💡 Spring + Flyway/Liquibase: migration chạy lúc app khởi động — với rolling deploy, pod mới chạy migration trong khi pod cũ vẫn phục vụ, nên migration <em>phải</em> tương thích với code cũ.
    Rust với <code>sqlx migrate</code> cũng vậy; nhiều đội tách migration thành job riêng chạy trước deploy. Feature flag trên edge có thể lưu ở Workers KV (đọc nhanh, lan trong ~60 s).</p></div>
  `,

  codeTabs: [
    { id: "expand", label: "① Expand–contract", lines: [
      "-- Deploy 1 (expand): thêm cột, code ghi CẢ HAI cột, vẫn đọc cột cũ",
      "ALTER TABLE customers ADD COLUMN phone_e164 text;",
      "",
      "-- Deploy 2 (migrate): backfill theo lô, code đọc cột mới (fallback cột cũ)",
      "UPDATE customers SET phone_e164 = normalize(phone)",
      "WHERE id IN (SELECT id FROM customers WHERE phone_e164 IS NULL LIMIT 5000);",
      "",
      "-- Deploy 3 (contract): khi không còn bản code nào dùng cột cũ",
      "ALTER TABLE customers DROP COLUMN phone;",
      "",
      "-- Index không khoá ghi:",
      "CREATE INDEX CONCURRENTLY idx_customers_phone ON customers (phone_e164);"
    ]},
    { id: "canary", label: "② Canary tự động", lines: [
      "bước 1:  1% traffic -> v2, chờ 10 phút",
      "  so sánh v2 vs v1: tỉ lệ 5xx, p99, tỉ lệ thanh toán thất bại",
      "  v2.error_rate > v1.error_rate * 1.5  => tự rollback, báo động",
      "bước 2:  10%  -> chờ 15 phút -> kiểm tra",
      "bước 3:  50%  -> chờ 15 phút -> kiểm tra",
      "bước 4: 100%",
      "",
      "# Canary cần: metric theo phiên bản (label version=v2) + ngưỡng rõ ràng"
    ]},
    { id: "flag", label: "③ Feature flag", lines: [
      "// Code mới đã deploy nhưng mặc định tắt",
      "if flags.enabled(\"new_checkout_flow\", &FlagCtx { user_id, app_version, country }) {",
      "    new_checkout(&st, req).await",
      "} else {",
      "    old_checkout(&st, req).await",
      "}",
      "",
      "# cấu hình flag (KV / dịch vụ flag):",
      "new_checkout_flow: { enabled: true, rollout_percent: 5, allow_groups: [\"staff\"],",
      "                     min_app_version: \"4.2.0\" }",
      "# Sự cố -> rollout_percent: 0  (không cần deploy)",
      "# Xong rollout -> XOÁ flag và nhánh cũ (flag là nợ kỹ thuật)"
    ]},
    { id: "wrangler", label: "④ Workers gradual", lines: [
      "# Upload phiên bản mới, chưa nhận traffic",
      "npx wrangler versions upload",
      "",
      "# Chia traffic: 10% bản mới, 90% bản đang chạy",
      "npx wrangler versions deploy <new-version-id>@10% <old-version-id>@90%",
      "",
      "# Ổn -> 100% ; có vấn đề -> quay lại bản trước",
      "npx wrangler rollback"
    ]},
    { id: "mobile", label: "⑤ App mobile", lines: [
      "GET /v1/app-config   (BFF)",
      "{",
      "  \"min_supported_version\": \"3.8.0\",     // thấp hơn -> màn 'Vui lòng cập nhật'",
      "  \"latest_version\": \"4.3.1\",            // thấp hơn -> gợi ý cập nhật",
      "  \"features\": { \"new_checkout_flow\": false, \"apple_pay\": true }",
      "}",
      "# App phát hành qua store mất vài ngày duyệt và người dùng cập nhật chậm:",
      "# -> tính năng rủi ro luôn có công tắc từ xa"
    ]}
  ],

  stageHtml: `
    <div class="node" id="lb"><div class="nl">⚖️ Router / LB</div><div class="ns">chia traffic theo %</div></div>
    <div class="row">
      <div class="node" id="v1"><div class="nl">🦀 v1 (đang chạy)</div><div class="ns">99% → 90% → 50% → 0%</div></div>
      <div class="node" id="v2"><div class="nl">🦀 v2 (canary)</div><div class="ns">1% → 10% → 50% → 100%</div></div>
    </div>
    <div class="arrow" id="a1">↓ cả hai cùng đọc/ghi</div>
    <div class="node" id="db"><div class="nl">🐘 DB schema tương thích cả hai</div><div class="ns">expand → migrate → contract</div></div>
    <div class="node" id="ff"><div class="nl">🚩 Feature flag</div><div class="ns">release tách khỏi deploy</div></div>
  `,
  steps: [
    { title: "1 · Canary theo bậc", tab: "canary", highlight: [1, 2, 3], on: ["lb", "v2"],
      desc: "1% người dùng gặp bản mới; so sánh với v1 cùng thời điểm; xấu hơn ngưỡng thì tự rút." },
    { title: "2 · Hai phiên bản cùng chạm DB", tab: "expand", highlight: [1, 2], on: ["v1", "v2", "a1", "db"],
      desc: "v1 không biết cột mới, v2 ghi cả hai → rollback về v1 vẫn an toàn." },
    { title: "3 · Backfill theo lô, rồi mới xoá", tab: "expand", highlight: [5, 6, 9, 12], on: ["db"],
      desc: "Lô nhỏ tránh khoá dài; DROP chỉ khi chắc chắn không còn code cũ. Index tạo CONCURRENTLY." },
    { title: "4 · Feature flag: bật/tắt không deploy", tab: "flag", highlight: [2, 9, 11, 12], on: ["ff"],
      desc: "Deploy giờ hành chính khi code đang tắt; release dần theo %; sự cố thì kéo về 0." },
    { title: "5 · Workers: chia % giữa hai version", tab: "wrangler", highlight: [2, 5, 8], on: ["lb"],
      desc: "Canary ngay trên edge; rollback một lệnh." },
    { title: "6 · App mobile cần công tắc từ xa", tab: "mobile", highlight: [3, 5, 7, 8], on: ["ff"],
      desc: "Không rollback được app trên máy người dùng — chỉ tắt được tính năng và buộc cập nhật khi cần." }
  ],

  quiz: [
    { q: "Feature flag giúp tách hai việc nào?", options: [
        "Build và test",
        "Deploy (đưa code lên) và release (bật cho người dùng)",
        "Frontend và backend",
        "Log và metric"
      ], correct: 1, explanation: "Tắt tính năng không cần deploy lại." },
    { q: "Đổi tên cột đang dùng trong hệ thống deploy rolling. Cách an toàn?", options: [
        "ALTER TABLE RENAME COLUMN rồi deploy code mới",
        "Expand–contract: thêm cột mới + ghi cả hai, backfill, chuyển đọc, cuối cùng mới xoá cột cũ",
        "Tắt hệ thống để đổi",
        "Tạo bảng mới và bỏ bảng cũ"
      ], correct: 1, explanation: "Mỗi bước tương thích với cả phiên bản trước." },
    { q: "Ưu điểm chính của canary so với blue-green?", options: [
        "Rẻ hơn về máy",
        "Lỗi chỉ chạm một phần nhỏ traffic và có thể phát hiện bằng so sánh metric trước khi mở rộng",
        "Không cần metric",
        "Nhanh hơn"
      ], correct: 1, explanation: "Blue-green chuyển 100% một lần." },
    { q: "Vì sao migration Flyway/sqlx phải tương thích với code cũ khi rolling deploy?", options: [
        "Không cần",
        "Pod cũ vẫn phục vụ traffic trên schema đã được migrate",
        "Flyway yêu cầu",
        "Để test nhanh hơn"
      ], correct: 1, explanation: "Hai phiên bản code cùng dùng một schema." },
    { q: "Thêm index trên bảng orders lớn trong giờ cao điểm (Postgres). Nên?", options: [
        "CREATE INDEX thường",
        "CREATE INDEX CONCURRENTLY để không chặn ghi",
        "Khoá bảng rồi tạo",
        "Không bao giờ tạo index"
      ], correct: 1, explanation: "Chậm hơn nhưng không khoá INSERT/UPDATE." },
    { q: "Producer sắp phát event có field mới bắt buộc với consumer. Thứ tự deploy?", options: [
        "Producer trước",
        "Consumer hiểu định dạng mới trước, producer sau",
        "Cùng lúc",
        "Không quan trọng"
      ], correct: 1, explanation: "Consumer cũ nhận định dạng lạ có thể lỗi." },
    { q: "Lệnh nào upload phiên bản Worker mới mà chưa nhận traffic?", options: [
        "wrangler deploy --dry-run", "wrangler versions upload", "wrangler dev", "wrangler publish"
      ], correct: 1, explanation: "Sau đó wrangler versions deploy để chia %." },
    { q: "App mobile có lỗi nghiêm trọng trong tính năng mới. Cách giảm thiệt hại nhanh nhất?", options: [
        "Rollback app trên store",
        "Tắt tính năng qua remote config/feature flag; nếu cần, nâng min_supported_version sau khi có bản sửa",
        "Chờ người dùng tự gỡ",
        "Xoá app khỏi store"
      ], correct: 1, explanation: "Không thể thu hồi binary đã cài." },
    { q: "Feature flag đã rollout 100% hai tháng. Nên?", options: [
        "Giữ mãi cho chắc",
        "Xoá flag và nhánh code cũ",
        "Thêm flag khác bọc ngoài",
        "Đặt lại 50%"
      ], correct: 1, explanation: "Flag tồn đọng là nợ kỹ thuật và làm tổ hợp trạng thái bùng nổ." }
  ]
});
