window.LESSONS.push({
  id: "18",
  phase: "4", phaseName: "Vận hành",
  title: "Độ tin cậy: SLI, SLO, error budget & graceful degradation",
  subtitle: "Đo cái người dùng cảm nhận · ngân sách lỗi · cảnh báo theo burn rate · suy giảm êm · RPO/RTO",

  theory: `
    <p>"Hệ thống phải luôn chạy" không phải mục tiêu đo được. Kỹ sư định nghĩa độ tin cậy bằng con số, rồi dùng con số đó để quyết định
    <em>khi nào được phép đẩy nhanh tính năng, khi nào phải dừng lại sửa ổn định</em>.</p>

    <ul>
      <li><strong>SLI</strong> (indicator): tỉ lệ sự kiện tốt / tổng sự kiện, đo gần người dùng nhất có thể. Vd: "% request <code>POST /orders</code> trả không-5xx <em>và</em> dưới 500 ms, đo ở gateway".</li>
      <li><strong>SLO</strong> (objective): mục tiêu cho SLI trong một cửa sổ: "99.9% trong 30 ngày trượt".</li>
      <li><strong>SLA</strong> (agreement): cam kết với khách kèm phạt/đền bù — luôn lỏng hơn SLO nội bộ.</li>
      <li><strong>Error budget</strong> = 1 − SLO. 99.9% trên 1 triệu request/tháng → được phép 1 000 request lỗi. Còn ngân sách: cứ deploy, thử nghiệm. Cạn: đóng băng tính năng rủi ro, ưu tiên ổn định.</li>
    </ul>
    <p>Không phải mọi thứ cần 99.99%: checkout cần cao; trang "gợi ý cho bạn" 99% là đủ. Mỗi số 9 thêm vào đắt gấp bội (dư thừa nhiều vùng, on-call, quy trình).
    Và SLO của bạn không thể cao hơn phụ thuộc cứng của bạn (chuỗi sync ở bài 04).</p>

    <p><strong>Cảnh báo theo burn rate</strong> thay vì "CPU &gt; 80%": burn rate = tốc độ tiêu ngân sách so với mức đều. Burn rate 14.4 kéo dài 1 giờ = tiêu 2% ngân sách 30 ngày → gọi người dậy.
    Burn rate thấp kéo dài → tạo ticket. Cảnh báo theo triệu chứng người dùng thấy, không theo nguyên nhân đoán trước.</p>

    <p><strong>Graceful degradation — thiết kế sẵn chế độ "sống sót"</strong></p>
    <ul>
      <li>Phân loại tính năng: <em>lõi</em> (xem sản phẩm, giỏ, checkout) vs <em>phụ</em> (gợi ý, đánh giá, lịch sử xem). Phụ hỏng → ẩn/giá trị mặc định.</li>
      <li>Trả dữ liệu cũ từ cache khi nguồn lỗi (stale-if-error) — giá hơi cũ vẫn hơn trang trắng (nhưng lúc thanh toán phải kiểm lại giá thật).</li>
      <li>Chuyển ghi sang bất đồng bộ: thanh toán chậm → nhận đơn ở trạng thái PENDING, xử lý sau, báo qua push.</li>
      <li>Kill switch bằng feature flag để tắt tính năng nặng khi quá tải; load shedding ưu tiên request lõi.</li>
      <li>Phía app: hiển thị dữ liệu cục bộ khi offline, hàng đợi thao tác để gửi lại (với Idempotency-Key).</li>
    </ul>

    <p><strong>Thảm hoạ</strong>: <strong>RPO</strong> (mất tối đa bao nhiêu dữ liệu — vd 5 phút) và <strong>RTO</strong> (bao lâu để chạy lại — vd 1 giờ). Backup chưa từng khôi phục thử = chưa có backup.
    Chạy nhiều availability zone cho service và DB (replica đồng bộ/bán đồng bộ), Kafka <code>replication.factor=3</code>, <code>min.insync.replicas=2</code>.</p>

    <div class="callout"><p>💡 Người "code tay to" đo thành công bằng "chạy được trên máy tôi". Kỹ sư hỏi: "SLO của endpoint này là gì, hôm nay còn bao nhiêu ngân sách lỗi,
    và khi Redis chết thì màn hình này trông thế nào?" Câu cuối phải có câu trả lời <em>trước</em> khi Redis chết.</p></div>
  `,

  codeTabs: [
    { id: "slo", label: "① Định nghĩa SLO", lines: [
      "service: order-service",
      "slo:",
      "  - name: checkout-availability",
      "    sli: good = POST /v1/orders có status < 500 VÀ latency < 500ms (đo ở gateway)",
      "         total = mọi POST /v1/orders (trừ 4xx do client)",
      "    objective: 99.9%          # cửa sổ 30 ngày trượt",
      "  - name: recommendations",
      "    objective: 99.0%          # tính năng phụ, không cần cao",
      "",
      "error budget checkout = 0.1% x 1 200 000 request/tháng = 1 200 request lỗi"
    ]},
    { id: "burn", label: "② Burn rate alert", lines: [
      "# tỉ lệ lỗi 1h / tỉ lệ lỗi cho phép (0.001) = burn rate",
      "(",
      "  sum(rate(http_requests_total{route=\"/v1/orders\",code=~\"5..\"}[1h]))",
      "  / sum(rate(http_requests_total{route=\"/v1/orders\"}[1h]))",
      ") / 0.001 > 14.4",
      "# 14.4 x 1h = 14.4/720 = 2% ngân sách tháng trong 1 giờ -> PAGE",
      "# kèm điều kiện cửa sổ 5m cũng > 14.4 để cảnh báo tắt nhanh khi đã hết",
      "",
      "# burn rate > 1 kéo dài 3 ngày -> TICKET (không đánh thức ai)"
    ]},
    { id: "degrade", label: "③ Suy giảm êm (Rust)", lines: [
      "async fn product_page(st: &AppState, sku: &str) -> ProductPage {",
      "    let product = match catalog::get(st, sku).await {",
      "        Ok(p) => p,",
      "        Err(_) => match st.cache.get_stale(sku).await {    // stale-if-error",
      "            Some(p) => p.marked_stale(),",
      "            None => return ProductPage::unavailable(),",
      "        },",
      "    };",
      "    let reviews = if st.flags.on(\"reviews\") {           // kill switch",
      "        reviews::top(st, sku).await.unwrap_or_default()  // phụ: lỗi -> rỗng",
      "    } else { vec![] };",
      "    ProductPage { product, reviews }",
      "}"
    ]},
    { id: "dr", label: "④ RPO / RTO", lines: [
      "Postgres orders : replica đồng bộ khác AZ + WAL archive liên tục (PITR)",
      "                  RPO ≈ 0 (mất AZ) / ≈ vài phút (mất region) ; RTO 30 phút",
      "Kafka           : replication.factor=3, min.insync.replicas=2, acks=all",
      "Redis cache     : mất được -> RPO không quan trọng, chỉ cần chịu cold cache",
      "ClickHouse      : read model -> dựng lại từ Kafka/nguồn; RTO vài giờ chấp nhận",
      "",
      "Diễn tập: mỗi quý khôi phục backup sang môi trường tách biệt và đo thời gian thật"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sli"><div class="nl">📏 SLI</div><div class="ns">% request tốt, đo ở gateway</div></div>
    <div class="arrow" id="a1">↓ so với</div>
    <div class="node" id="slo"><div class="nl">🎯 SLO 99.9% / 30 ngày</div><div class="ns">error budget = 0.1%</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">🟢 Còn ngân sách</div><div class="ns">deploy, thử nghiệm</div></div>
      <div class="node" id="burn"><div class="nl">🔥 Burn rate cao</div><div class="ns">page on-call</div></div>
      <div class="node" id="freeze"><div class="nl">🧊 Cạn ngân sách</div><div class="ns">ưu tiên ổn định</div></div>
    </div>
    <div class="node" id="deg"><div class="nl">🛟 Graceful degradation</div><div class="ns">lõi sống · phụ tắt · dữ liệu cũ</div></div>
  `,
  steps: [
    { title: "1 · SLI đo điều người dùng thấy", tab: "slo", highlight: [4, 5], on: ["sli"],
      desc: "Tốt = không lỗi server VÀ đủ nhanh. Đo ở gateway gần người dùng, không phải CPU." },
    { title: "2 · SLO theo mức quan trọng", tab: "slo", highlight: [6, 8, 10], on: ["a1", "slo"],
      desc: "Checkout 99.9%, gợi ý 99%. Error budget là số lỗi được phép — một nguồn lực để tiêu." },
    { title: "3 · Cảnh báo theo tốc độ đốt ngân sách", tab: "burn", highlight: [3, 4, 5, 6, 9], on: ["burn"],
      desc: "Đốt nhanh → gọi người; đốt chậm kéo dài → ticket. Ít cảnh báo rác hơn ngưỡng CPU." },
    { title: "4 · Ngân sách quyết định tốc độ", tab: "slo", highlight: [10], on: ["ok", "freeze"],
      desc: "Còn ngân sách thì ship; cạn thì dừng tính năng rủi ro. Đây là thoả thuận giữa sản phẩm và kỹ thuật." },
    { title: "5 · Thiết kế sẵn chế độ sống sót", tab: "degrade", highlight: [4, 5, 9, 10], on: ["deg"],
      desc: "Nguồn lỗi → dữ liệu cũ có đánh dấu; tính năng phụ lỗi → rỗng; quá tải → kill switch." },
    { title: "6 · RPO/RTO cho từng kho", tab: "dr", highlight: [1, 2, 3, 4, 5, 7], on: ["deg"],
      desc: "Nguồn sự thật cần RPO gần 0; cache và read model thì dựng lại được. Backup phải được diễn tập khôi phục." }
  ],

  quiz: [
    { q: "SLI nào tốt nhất cho API checkout?", options: [
        "CPU trung bình của pod",
        "% request POST /orders không lỗi 5xx và dưới 500 ms, đo ở gateway",
        "Số dòng log",
        "RAM của DB"
      ], correct: 1, explanation: "SLI phản ánh trải nghiệm người dùng." },
    { q: "SLO 99.9% với 2 triệu request/tháng cho phép bao nhiêu request lỗi?", options: [
        "200", "2 000", "20 000", "0"
      ], correct: 1, explanation: "0.1% × 2 000 000." },
    { q: "Error budget cạn thì đội nên làm gì?", options: [
        "Tiếp tục ship như thường",
        "Ưu tiên công việc ổn định, hạn chế thay đổi rủi ro tới khi ngân sách hồi lại",
        "Tăng SLO",
        "Tắt monitoring"
      ], correct: 1, explanation: "Ngân sách là công cụ ra quyết định." },
    { q: "Vì sao SLA thường lỏng hơn SLO nội bộ?", options: [
        "Không có lý do",
        "Để có biên an toàn: vi phạm SLO nội bộ được phát hiện và xử lý trước khi vi phạm cam kết có phạt",
        "SLA không quan trọng",
        "Luật yêu cầu"
      ], correct: 1, explanation: "SLA gắn với hợp đồng." },
    { q: "Burn rate alert có lợi gì so với 'CPU > 80%'?", options: [
        "Không lợi gì",
        "Cảnh báo theo mức ảnh hưởng thật tới người dùng và tốc độ tiêu ngân sách, ít báo động rác",
        "Rẻ hơn",
        "Không cần metric"
      ], correct: 1, explanation: "CPU cao chưa chắc người dùng bị ảnh hưởng." },
    { q: "Service đánh giá sản phẩm chết. Trang sản phẩm nên?", options: [
        "Trả 500",
        "Hiển thị sản phẩm bình thường, ẩn phần đánh giá",
        "Chuyển sang trang bảo trì",
        "Retry vô hạn"
      ], correct: 1, explanation: "Tính năng phụ không được kéo đổ tính năng lõi." },
    { q: "RPO là?", options: [
        "Thời gian khôi phục",
        "Lượng dữ liệu tối đa chấp nhận mất (tính theo thời gian)",
        "Số request/giây",
        "Số replica"
      ], correct: 1, explanation: "RTO là thời gian để chạy lại." },
    { q: "Hiển thị giá từ cache cũ khi catalog lỗi — cần lưu ý gì?", options: [
        "Không cần gì",
        "Đánh dấu dữ liệu cũ và kiểm lại giá thật ở bước thanh toán",
        "Không bao giờ được làm",
        "Xoá cache ngay"
      ], correct: 1, explanation: "Suy giảm êm không được làm sai nghiệp vụ tiền." },
    { q: "Có thể đặt SLO 99.99% cho service phụ thuộc cứng (sync) vào service chỉ đạt 99.9% không?", options: [
        "Có, dễ dàng",
        "Không thực tế — độ sẵn sàng bị giới hạn bởi phụ thuộc cứng, trừ khi có fallback",
        "Có nếu dùng Rust",
        "Có nếu tăng timeout"
      ], correct: 1, explanation: "Toán nhân xác suất ở bài 04." },
    { q: "Backup chưa bao giờ khôi phục thử có giá trị gì?", options: [
        "Đủ an toàn",
        "Chưa chứng minh được — cần diễn tập khôi phục định kỳ và đo RTO thật",
        "Tốt hơn không có, không cần thử",
        "Chỉ cần kiểm tra dung lượng file"
      ], correct: 1, explanation: "Nhiều sự cố lộ ra backup hỏng đúng lúc cần." }
  ]
});
