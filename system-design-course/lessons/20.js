window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Case study",
  title: "Case study 1: Hệ thống đơn hàng e-commerce",
  subtitle: "Yêu cầu & con số · kiến trúc tổng · giữ hàng flash sale · thanh toán qua webhook · đối soát",

  theory: `
    <p>Ghép các bài trước vào một thiết kế hoàn chỉnh. Đọc theo đúng quy trình bài 01.</p>

    <p><strong>Yêu cầu</strong>: khách đặt đơn từ giỏ, thanh toán qua cổng bên ngoài (ví/thẻ), xem trạng thái, nhận push. Flash sale 20:00 với vài SKU giá sốc.
    Phi chức năng: không bán quá số tồn (oversell), không trừ tiền 2 lần, không mất đơn đã trả tiền; checkout p99 &lt; 800 ms; lịch sử đơn trễ vài giây được.</p>

    <p><strong>Con số</strong>: bình thường 50 000 đơn/ngày (~0.5 đơn/s). Flash sale: 200 000 người mở app trong 1 phút, 30 000 đơn/phút ≈ <strong>500 đơn/s</strong> dồn vào <strong>vài SKU</strong>
    → điểm nóng là <em>một dòng tồn kho</em>, không phải tổng QPS.</p>

    <p><strong>Kiến trúc</strong></p>
    <ul>
      <li><strong>Edge (Worker)</strong>: BFF, kiểm JWT, rate limit theo user (chống bot bấm liên tục), cache danh mục/trang sale ở edge; phòng chờ (waiting room) nếu quá tải.</li>
      <li><strong>order-service</strong> (Rust, Postgres): tạo đơn PENDING với Idempotency-Key, ghi outbox. Orchestrate saga: giữ hàng → thanh toán → xác nhận.</li>
      <li><strong>inventory-service</strong>: giữ hàng nguyên tử có hạn (reservation 15 phút), nhả khi huỷ/hết hạn.</li>
      <li><strong>payment-service</strong>: tạo phiên thanh toán ở cổng, nhận <strong>webhook</strong> kết quả, phát <code>PaymentCaptured/Failed</code>.</li>
      <li><strong>Kafka</strong> → notification (push), search-indexer (ES cho CSKH), ClickHouse (doanh thu real-time).</li>
    </ul>

    <p><strong>Chống oversell</strong>: không "đọc tồn → kiểm → ghi" ở tầng app. Để DB làm nguyên tử: <code>UPDATE ... SET available = available - q WHERE sku = ? AND available &gt;= q</code> — 0 dòng bị ảnh hưởng = hết hàng.
    Với SKU cực nóng, một dòng Postgres bị hàng trăm transaction tranh khoá; có thể đưa bộ đếm tồn của SKU sale vào Redis (<code>DECRBY</code> nguyên tử / script Lua) làm cổng lọc nhanh, rồi ghi reservation bền vào DB,
    kèm đối soát định kỳ giữa Redis và DB.</p>

    <p><strong>Thanh toán — nơi tiền thật chạy</strong></p>
    <ul>
      <li>Webhook đến <em>ít nhất một lần</em>, có thể trùng, sai thứ tự, hoặc không đến. Kiểm <strong>chữ ký</strong> webhook, khử trùng theo id sự kiện của cổng, cập nhật trạng thái theo máy trạng thái (không lùi từ PAID về PENDING).</li>
      <li>Trả 2xx nhanh cho cổng, xử lý nặng qua outbox/Kafka.</li>
      <li><strong>Đối soát</strong> (reconciliation): job định kỳ hỏi cổng về các giao dịch PENDING quá lâu và so sánh báo cáo cuối ngày của cổng với DB — lưới an toàn cuối cho webhook bị mất.</li>
    </ul>

    <div class="callout"><p>💡 Chú ý thứ tự nghiệp vụ: giữ hàng <em>trước</em> khi thu tiền (để không thu tiền rồi mới biết hết hàng). Reservation có TTL để khách bỏ ngang không giam hàng mãi.
    Thu tiền thành công nhưng reservation đã hết hạn và hàng đã bán cho người khác → nhánh bù trừ: hoàn tiền tự động + push xin lỗi (nghiệp vụ phải chốt trước).</p></div>
  `,

  codeTabs: [
    { id: "arch", label: "① Sơ đồ & luồng", lines: [
      "App --POST /checkout (Idempotency-Key)--> Worker BFF (JWT, rate limit)",
      "  --> order-service: INSERT order PENDING + outbox(OrderPlaced)   [1 transaction]",
      "  --> inventory.Reserve (gRPC, timeout 300ms)  -> reservation 15'",
      "  --> payment.CreateSession -> trả payment_url cho app",
      "App mở cổng thanh toán, khách trả tiền",
      "Cổng --webhook--> payment-service -> outbox(PaymentCaptured) -> Kafka",
      "order-service nghe PaymentCaptured -> CONFIRMED -> outbox(OrderConfirmed)",
      "  -> notification (push) · search-indexer (ES) · ClickHouse (doanh thu)"
    ]},
    { id: "stock", label: "② Giữ hàng nguyên tử", lines: [
      "BEGIN;",
      "UPDATE stock SET available = available - $2",
      "WHERE sku = $1 AND available >= $2;          -- 0 dòng => hết hàng, dừng",
      "",
      "INSERT INTO reservations (id, order_id, sku, qty, expires_at)",
      "VALUES ($3, $4, $1, $2, now() + interval '15 minutes')",
      "ON CONFLICT (order_id, sku) DO NOTHING;      -- idempotent khi retry",
      "COMMIT;",
      "",
      "-- job nhả hàng quá hạn (chạy mỗi phút, một instance nhờ SKIP LOCKED)",
      "-- chọn reservation hết hạn chưa thanh toán -> cộng lại available -> xoá reservation"
    ]},
    { id: "hot", label: "③ SKU sale cực nóng", lines: [
      "-- Redis làm cổng lọc nhanh cho SKU flash sale (trước khi chạm Postgres)",
      "local left = tonumber(redis.call('GET', KEYS[1]) or '0')",
      "local q = tonumber(ARGV[1])",
      "if left < q then return -1 end               -- hết: trả ngay, không tốn DB",
      "return redis.call('DECRBY', KEYS[1], q)",
      "",
      "# 50 000 người bấm cho 1 000 suất:",
      "# ~49 000 bị chặn ở Redis trong ~1 ms; 1 000 đi tiếp ghi reservation vào Postgres",
      "# Đối soát: SUM(reservations) + available(DB) phải khớp; lệch -> báo động"
    ]},
    { id: "hook", label: "④ Webhook thanh toán", lines: [
      "async fn payment_webhook(st: State<AppState>, headers: HeaderMap, body: Bytes) -> StatusCode {",
      "    if !verify_signature(&st.gateway_secret, &headers, &body) { return StatusCode::UNAUTHORIZED; }",
      "    let evt: GatewayEvent = match serde_json::from_slice(&body) { Ok(e) => e, Err(_) => return StatusCode::BAD_REQUEST };",
      "    let mut tx = st.db.begin().await.unwrap();",
      "    // khử trùng theo id sự kiện của cổng",
      "    if !insert_processed(&mut tx, &evt.id).await { return StatusCode::OK; }",
      "    // máy trạng thái: chỉ PENDING -> PAID/FAILED; không lùi",
      "    apply_transition(&mut tx, &evt.payment_id, evt.status).await;",
      "    insert_outbox(&mut tx, PaymentEvent::from(&evt)).await;",
      "    tx.commit().await.unwrap();",
      "    StatusCode::OK      // trả nhanh; việc nặng đi qua Kafka",
      "}"
    ]},
    { id: "recon", label: "⑤ Đối soát", lines: [
      "Mỗi 5 phút:",
      "  SELECT id FROM payments WHERE status='PENDING' AND created_at < now() - interval '10 minutes'",
      "  -> hỏi API cổng: GET /payments/{id}",
      "  -> PAID ở cổng nhưng PENDING ở ta: webhook bị mất -> áp dụng như webhook",
      "",
      "Mỗi ngày:",
      "  tải file quyết toán của cổng, so từng giao dịch với bảng payments",
      "  lệch -> tạo ticket cho kế toán, không tự sửa tiền"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">Idempotency-Key</div></div>
    <div class="node" id="edge"><div class="nl">☁️ Worker BFF</div><div class="ns">JWT · rate limit · cache trang sale</div></div>
    <div class="row">
      <div class="node" id="order"><div class="nl">🦀 order</div><div class="ns">PENDING · saga · outbox</div></div>
      <div class="node" id="inv"><div class="nl">🦀 inventory</div><div class="ns">reserve nguyên tử · Redis cho SKU nóng</div></div>
      <div class="node" id="pay"><div class="nl">🦀 payment</div><div class="ns">webhook · đối soát</div></div>
    </div>
    <div class="arrow" id="a1">↓ outbox → Kafka</div>
    <div class="row">
      <div class="node" id="noti"><div class="nl">🔔 push</div><div class="ns">OrderConfirmed</div></div>
      <div class="node" id="es"><div class="nl">🔎 ES</div><div class="ns">CSKH</div></div>
      <div class="node" id="ch"><div class="nl">📊 ClickHouse</div><div class="ns">doanh thu live</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Toàn cảnh luồng", tab: "arch", highlight: [1, 2, 3, 4], on: ["app", "edge", "order", "inv"],
      desc: "Đơn PENDING + outbox trong một transaction; giữ hàng trước khi thu tiền." },
    { title: "2 · Chống oversell bằng UPDATE có điều kiện", tab: "stock", highlight: [2, 3, 5, 6, 7], on: ["inv"],
      desc: "DB kiểm và trừ nguyên tử. Reservation có hạn; unique (order_id, sku) cho retry an toàn." },
    { title: "3 · SKU nóng: lọc ở Redis", tab: "hot", highlight: [4, 5, 8, 9], on: ["inv"],
      desc: "Phần lớn request bị từ chối trong ~1 ms ở Redis; Postgres chỉ nhận số request bằng số suất. Có đối soát." },
    { title: "4 · Webhook: chữ ký, khử trùng, máy trạng thái", tab: "hook", highlight: [2, 6, 8, 9, 11], on: ["pay"],
      desc: "Webhook trùng/sai thứ tự không làm lùi trạng thái; trả 200 nhanh; sự kiện đi qua outbox." },
    { title: "5 · Fan-out sau xác nhận", tab: "arch", highlight: [6, 7, 8], on: ["a1", "noti", "es", "ch"],
      desc: "Push, tìm kiếm, analytics không nằm trên đường checkout." },
    { title: "6 · Đối soát là lưới an toàn cuối", tab: "recon", highlight: [2, 4, 7, 8], on: ["pay"],
      desc: "Webhook có thể mất. Hỏi lại cổng định kỳ và so file quyết toán hằng ngày." }
  ],

  quiz: [
    { q: "Trong flash sale, điểm nghẽn thật thường là?", options: [
        "Tổng QPS của cả hệ thống",
        "Tranh chấp trên vài dòng tồn kho của SKU sale",
        "Dung lượng ổ đĩa",
        "Số topic Kafka"
      ], correct: 1, explanation: "Hàng nghìn transaction cùng khoá một dòng." },
    { q: "Câu lệnh nào chống oversell đúng?", options: [
        "SELECT available rồi if > 0 thì UPDATE available = available - 1 ở câu riêng",
        "UPDATE stock SET available = available - q WHERE sku = ? AND available >= q, kiểm số dòng bị ảnh hưởng",
        "UPDATE stock SET available = 0",
        "Không cần kiểm, đối soát sau"
      ], correct: 1, explanation: "Kiểm và trừ trong một câu nguyên tử." },
    { q: "Vì sao giữ hàng trước khi thu tiền?", options: [
        "Không quan trọng",
        "Tránh thu tiền rồi mới phát hiện hết hàng, phải hoàn tiền",
        "Cổng thanh toán yêu cầu",
        "Nhanh hơn"
      ], correct: 1, explanation: "Bước khó bù (tiền) để sau." },
    { q: "Vì sao reservation cần thời hạn (TTL)?", options: [
        "Tiết kiệm ổ đĩa",
        "Khách bỏ ngang thì hàng được nhả lại, không bị giam vĩnh viễn",
        "Postgres yêu cầu",
        "Để tăng bảo mật"
      ], correct: 1, explanation: "Job định kỳ nhả reservation quá hạn." },
    { q: "Webhook thanh toán có thể đến trùng hoặc không đến. Thiết kế nào đủ?", options: [
        "Tin webhook tuyệt đối",
        "Kiểm chữ ký, khử trùng theo id sự kiện, máy trạng thái không lùi, và job đối soát hỏi lại cổng",
        "Chỉ dựa vào app báo đã trả tiền",
        "Retry gọi webhook từ phía ta"
      ], correct: 1, explanation: "Nhiều lớp an toàn cho luồng tiền." },
    { q: "Vì sao không tin app báo 'đã thanh toán xong'?", options: [
        "App chậm",
        "Client có thể bị sửa/giả; trạng thái thanh toán phải xác nhận từ cổng (webhook có chữ ký hoặc API cổng)",
        "App không biết",
        "Không có lý do"
      ], correct: 1, explanation: "Nguồn sự thật về tiền là cổng thanh toán." },
    { q: "Dùng Redis DECRBY làm cổng lọc cho SKU nóng cần bổ sung gì?", options: [
        "Không cần gì",
        "Ghi reservation bền vào DB và đối soát Redis với DB định kỳ",
        "Tắt Postgres",
        "TTL 1 giây cho khoá tồn"
      ], correct: 1, explanation: "Redis có thể mất dữ liệu khi failover." },
    { q: "Webhook handler nên trả 200 khi nào?", options: [
        "Sau khi gửi push và cập nhật ES xong",
        "Sau khi ghi bền trạng thái + outbox trong DB; việc nặng xử lý bất đồng bộ",
        "Ngay khi nhận, trước khi kiểm chữ ký",
        "Không bao giờ"
      ], correct: 1, explanation: "Trả chậm → cổng timeout và gửi lại." },
    { q: "Thu tiền thành công nhưng reservation đã hết hạn và hàng bán hết. Hệ thống nên?", options: [
        "Bỏ qua",
        "Chạy nhánh bù trừ đã định trước: hoàn tiền tự động và thông báo cho khách",
        "Tạo tồn kho âm",
        "Giữ tiền, chờ khách liên hệ"
      ], correct: 1, explanation: "Nghiệp vụ cho trường hợp biên phải được chốt từ lúc thiết kế." }
  ]
});
