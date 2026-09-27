window.LESSONS.push({
  id: "24",
  phase: "6", phaseName: "Tổng kết",
  title: "Tổng kết: checklist thiết kế & bảng quyết định",
  subtitle: "Câu hỏi phải trả lời trước khi code · chọn công cụ theo vấn đề · lỗi hay gặp · ôn tập toàn khoá",

  theory: `
    <p>System design không phải thuộc lòng kiến trúc của công ty lớn, mà là <strong>đặt đúng câu hỏi theo đúng thứ tự</strong> rồi chọn công cụ nhỏ nhất giải được bài toán.</p>

    <p><strong>Checklist trước khi viết dòng code đầu tiên</strong></p>
    <ol>
      <li>Chức năng nào, ngoài phạm vi là gì? NFR: p99, SLO, nhất quán cần tới mức nào, mất dữ liệu có chấp nhận không?</li>
      <li>Con số: QPS trung bình/đỉnh, đọc:ghi, GB/năm, điểm nóng (hot key, flash sale)?</li>
      <li>Dữ liệu này thuộc service nào? Service khác cần nó thì qua API, event hay read model?</li>
      <li>Mỗi lời gọi: sync hay async? Timeout bao nhiêu? Retry ở tầng nào? Fallback khi phụ thuộc chết?</li>
      <li>Thao tác nào không idempotent? Idempotency-Key/khử trùng ở đâu?</li>
      <li>Ghi nhiều nơi: saga nào, bù trừ gì, outbox chưa?</li>
      <li>Đường đọc nóng: cache tầng nào, TTL bao lâu, xoá thế nào?</li>
      <li>Bảo vệ: rate limit ở đâu, xác thực/uỷ quyền giữa service ra sao, secret để đâu?</li>
      <li>Vận hành: metric RED + nghiệp vụ, trace xuyên Kafka, cảnh báo burn rate, deploy canary/flag, migration expand–contract?</li>
    </ol>

    <p><strong>Bảng quyết định nhanh</strong></p>
    <table>
      <tr><th>Vấn đề</th><th>Công cụ đầu tiên nghĩ tới</th><th>Bài</th></tr>
      <tr><td>Cần kết quả ngay để trả lời người dùng</td><td>REST/gRPC có timeout</td><td>04</td></tr>
      <tr><td>Báo cho nhiều bên "việc đã xảy ra"</td><td>Event qua Kafka</td><td>05</td></tr>
      <tr><td>App mobile gọi nhiều service cho một màn</td><td>BFF (Worker ở edge)</td><td>06</td></tr>
      <tr><td>Phụ thuộc chậm kéo sập mình</td><td>Timeout, bulkhead, circuit breaker</td><td>07</td></tr>
      <tr><td>Retry tạo bản ghi trùng</td><td>Idempotency-Key, unique, inbox</td><td>08</td></tr>
      <tr><td>Nghiệp vụ trải qua nhiều DB</td><td>Saga + outbox</td><td>09–10</td></tr>
      <tr><td>Đọc nhiều, chấp nhận hơi cũ</td><td>Cache nhiều tầng</td><td>11</td></tr>
      <tr><td>Lạm dụng/quá tải từ client</td><td>Rate limit edge + Redis</td><td>12</td></tr>
      <tr><td>Một node không chịu nổi</td><td>Stateless + scale ngang; cuối cùng mới shard</td><td>13–14</td></tr>
      <tr><td>Tìm kiếm / báo cáo nặng</td><td>Read model ES / ClickHouse</td><td>15</td></tr>
      <tr><td>Không biết lỗi ở đâu</td><td>Trace + metric RED + log có trace_id</td><td>16</td></tr>
      <tr><td>Sợ deploy</td><td>Canary, feature flag, expand–contract</td><td>17</td></tr>
    </table>

    <p><strong>Lỗi hay gặp của người mới chuyển sang microservice</strong></p>
    <ul>
      <li>Tách service theo tầng kỹ thuật (service "DAO", service "validation") thay vì theo nghiệp vụ.</li>
      <li>Dùng chung DB "tạm thời" → coupling vĩnh viễn.</li>
      <li>Gọi sync dây chuyền 5 tầng không timeout; retry ở mọi tầng.</li>
      <li>Ghi DB rồi gửi Kafka bằng hai lệnh (dual write).</li>
      <li>Consumer không idempotent vì "Kafka chắc không gửi lặp đâu".</li>
      <li>Cache không có chiến lược xoá; dùng Workers KV như DB nhất quán mạnh.</li>
      <li>Sharding quá sớm; hoặc chọn shard key không khớp truy vấn chính.</li>
      <li>Chỉ có log, không có metric/trace; cảnh báo theo CPU.</li>
    </ul>

    <div class="callout"><p>💡 Từ "code tay to" thành kỹ sư: mỗi quyết định trong thiết kế nên trả lời được <em>"vì sao chọn cái này, và cái giá là gì?"</em>
    Kafka cho tách rời nhưng đổi lấy nhất quán cuối cùng; cache cho tốc độ nhưng đổi lấy độ tươi; microservice cho deploy độc lập nhưng đổi lấy transaction phân tán.
    Không có lựa chọn miễn phí — chỉ có lựa chọn mà bạn hiểu rõ cái giá.</p></div>
  `,

  codeTabs: [
    { id: "doc", label: "① Mẫu tài liệu thiết kế", lines: [
      "# Design doc: <tên tính năng>",
      "1. Bối cảnh & mục tiêu        — vấn đề gì, đo thành công bằng gì",
      "2. Yêu cầu                    — chức năng / ngoài phạm vi / NFR (p99, SLO, consistency)",
      "3. Ước lượng                  — QPS TB/đỉnh, đọc:ghi, dung lượng, điểm nóng",
      "4. API & event                — endpoint, schema event, versioning",
      "5. Data model & sở hữu        — entity nào của service nào",
      "6. Kiến trúc                  — sơ đồ C4 container, sync/async trên mũi tên",
      "7. Lỗi & suy giảm             — timeout/retry/fallback, saga & bù trừ",
      "8. Bảo mật                    — xác thực, uỷ quyền, rate limit, PII",
      "9. Vận hành                   — metric, trace, alert, rollout, migration",
      "10. Phương án đã loại & vì sao — phần kỹ sư đánh giá cao nhất"
    ]},
    { id: "map", label: "② Bản đồ toàn khoá", lines: [
      "App (RN -> native)",
      "  -> Worker: BFF · JWT · rate limit · cache edge · canary %          (06, 11, 12, 17, 19)",
      "  -> Rust services: stateless, timeout/retry/breaker, idempotent    (04, 07, 08, 13)",
      "       mỗi service một DB: Postgres / Mongo / Redis                 (03, 14)",
      "       outbox -> Kafka (key = aggregate id)                         (05, 10)",
      "       saga cho nghiệp vụ nhiều service                             (09)",
      "  -> Kafka -> ES (tìm kiếm) · ClickHouse (analytics) · push         (15, 21, 23)",
      "  quan sát: trace xuyên HTTP + Kafka, RED, SLO/burn rate            (16, 18)"
    ]},
    { id: "tradeoff", label: "③ Đánh đổi cốt lõi", lines: [
      "Microservice     : deploy độc lập        <-> mất transaction/JOIN chung",
      "Async (Kafka)    : tách rời, chịu tải    <-> nhất quán cuối cùng, khó debug",
      "Cache            : nhanh, giảm tải       <-> dữ liệu cũ, bài toán xoá",
      "Sync (REST/gRPC) : đơn giản, có kết quả  <-> ghép chặt thời gian, lỗi lan truyền",
      "Sharding         : scale ghi             <-> truy vấn xuyên shard, vận hành phức tạp",
      "Edge (Workers)   : gần người dùng        <-> state phân tán, eventual (KV), giới hạn runtime",
      "SLO cao hơn      : tin cậy hơn           <-> chi phí tăng gấp bội mỗi số 9"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Yêu cầu &amp; con số</div><div class="ns">bài 01–02</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="b"><div class="nl">🧱 Ranh giới &amp; giao tiếp</div><div class="ns">bài 03–06</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="r"><div class="nl">🛡️ Độ bền</div><div class="ns">07–10</div></div>
      <div class="node" id="s"><div class="nl">🚀 Scale</div><div class="ns">11–15</div></div>
      <div class="node" id="o"><div class="nl">🔭 Vận hành</div><div class="ns">16–19</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="c"><div class="nl">📐 Case study</div><div class="ns">20–23</div></div>
  `,
  steps: [
    { title: "1 · Bắt đầu từ câu hỏi", tab: "doc", highlight: [2, 3, 4], on: ["q"],
      desc: "Mục tiêu, yêu cầu, con số — trước mọi lựa chọn công nghệ." },
    { title: "2 · Hợp đồng và quyền sở hữu", tab: "doc", highlight: [5, 6, 7], on: ["a1", "b"],
      desc: "API/event và ai sở hữu dữ liệu nào; sơ đồ ghi rõ sync/async." },
    { title: "3 · Thiết kế cho lúc hỏng", tab: "doc", highlight: [8, 9, 10], on: ["a2", "r", "o"],
      desc: "Lỗi, bảo mật, vận hành là một phần của thiết kế, không phải việc làm sau." },
    { title: "4 · Toàn cảnh hệ thống công ty", tab: "map", highlight: [1, 2, 3, 5, 7, 8], on: ["s", "o"],
      desc: "Mỗi khối trong kiến trúc hiện tại gắn với bài đã học." },
    { title: "5 · Mọi lựa chọn đều có giá", tab: "tradeoff", highlight: [1, 2, 3, 4, 5, 6, 7], on: ["a3", "c"],
      desc: "Phần 'phương án đã loại & vì sao' trong design doc là nơi thể hiện tư duy kỹ sư." }
  ],

  quiz: [
    { q: "Bước đầu tiên khi nhận một bài toán thiết kế?", options: [
        "Chọn Kafka hay RabbitMQ",
        "Làm rõ yêu cầu chức năng, phi chức năng và ước lượng con số",
        "Vẽ sơ đồ Kubernetes",
        "Viết Controller"
      ], correct: 1, explanation: "Công cụ được chọn theo con số và yêu cầu." },
    { q: "order-service cần báo cho push, search, analytics rằng đơn đã tạo. Cách phù hợp?", options: [
        "Gọi sync 3 service trong request tạo đơn",
        "Ghi outbox trong transaction, relay phát OrderPlaced lên Kafka, mỗi bên một consumer group",
        "Cho 3 service đọc bảng orders",
        "Gửi email nội bộ"
      ], correct: 1, explanation: "Outbox + event: nguyên tử và tách rời." },
    { q: "App retry POST /orders sau timeout và tạo 2 đơn. Thiếu gì?", options: [
        "Cache", "Idempotency-Key với unique constraint phía server", "Circuit breaker", "Sharding"
      ], correct: 1, explanation: "Bài 08." },
    { q: "reco-service chậm làm cả trang chủ lỗi. Thiếu gì?", options: [
        "Thêm index",
        "Timeout, bulkhead/circuit breaker và fallback ẩn mục gợi ý",
        "Thêm Kafka",
        "Tăng max_connections"
      ], correct: 1, explanation: "Bài 07 và 18." },
    { q: "Consumer Kafka commit offset sau khi xử lý. Điều gì bắt buộc?", options: [
        "Không có gì",
        "Xử lý idempotent vì message có thể được giao lại",
        "Chỉ dùng 1 partition",
        "Tắt acks"
      ], correct: 1, explanation: "At-least-once." },
    { q: "Thứ tự event của cùng một đơn được đảm bảo khi?", options: [
        "Luôn luôn",
        "Chúng có cùng key (order_id) nên vào cùng partition",
        "Topic có 1 consumer group",
        "Dùng acks=all"
      ], correct: 1, explanation: "Thứ tự chỉ trong partition." },
    { q: "Workers KV không phù hợp cho dữ liệu nào?", options: [
        "Feature flag",
        "Tồn kho thay đổi từng giây cần nhất quán mạnh",
        "Bảng ánh xạ link ngắn (có fallback DB)",
        "Cấu hình"
      ], correct: 1, explanation: "KV eventually consistent; cần mạnh thì Durable Object/DB." },
    { q: "Muốn tìm đơn theo tên không dấu cho CSKH mà không làm chậm Postgres chính?", options: [
        "LIKE '%...%' trên Postgres chính",
        "Read model Elasticsearch nạp từ Kafka",
        "Redis KEYS *",
        "ClickHouse FINAL"
      ], correct: 1, explanation: "Bài 15." },
    { q: "Hạn mức 100 req/phút bằng Bucket4j in-memory trên 8 pod thực chất là?", options: [
        "100/phút", "Tới ~800/phút", "12/phút", "Vô hạn"
      ], correct: 1, explanation: "Bộ đếm toàn cục cần Redis hoặc tầng chung." },
    { q: "Đổi tên cột trên bảng đang phục vụ với rolling deploy?", options: [
        "RENAME COLUMN một lần",
        "Expand–contract qua nhiều lần deploy",
        "Tắt hệ thống",
        "Không bao giờ đổi"
      ], correct: 1, explanation: "Bài 17." },
    { q: "Chỉ số nào nên dùng để đánh thức on-call?", options: [
        "CPU > 80%",
        "Burn rate của error budget theo SLI người dùng thấy",
        "Số dòng log",
        "Dung lượng RAM"
      ], correct: 1, explanation: "Bài 18." },
    { q: "Truy vấn chính 'đơn của khách X' — nếu phải shard, shard key?", options: [
        "order_id", "customer_id", "created_at", "status"
      ], correct: 1, explanation: "Bài 14." },
    { q: "Service nội bộ nhận header X-User-Id từ bất kỳ ai trong mạng. Rủi ro và giải?", options: [
        "Không rủi ro",
        "Giả mạo danh tính; cần JWT kiểm chữ ký/aud hoặc kênh mTLS từ gateway",
        "Chỉ cần đổi tên header",
        "Mã hoá base64 header"
      ], correct: 1, explanation: "Bài 19." },
    { q: "Trace bị đứt tại Kafka. Sửa thế nào?", options: [
        "Không sửa được",
        "Inject traceparent vào header message và extract ở consumer",
        "Dùng cùng thread",
        "Thêm log"
      ], correct: 1, explanation: "Bài 16." },
    { q: "Vì sao link ngắn dùng 302 chứ không 301?", options: [
        "302 nhanh hơn",
        "301 bị cache lâu ở trình duyệt, mất khả năng đếm click và đổi đích",
        "301 lỗi thời",
        "Không khác"
      ], correct: 1, explanation: "Bài 22." },
    { q: "Nguyên tắc xuyên suốt khi đánh giá một lựa chọn kiến trúc?", options: [
        "Chọn thứ mới nhất",
        "Nêu rõ lợi ích và cái giá (trade-off), và vì sao cái giá chấp nhận được với yêu cầu này",
        "Chọn thứ công ty lớn dùng",
        "Chọn thứ ít code nhất"
      ], correct: 1, explanation: "Không có lựa chọn miễn phí." }
  ]
});
