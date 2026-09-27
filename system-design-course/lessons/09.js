window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Độ bền khi gọi nhau",
  title: "Nhất quán giữa service: Saga",
  subtitle: "Vì sao không 2PC · choreography vs orchestration · hành động bù trừ · trạng thái trung gian",

  theory: `
    <p>Đặt hàng cần: tạo đơn (order-db), giữ hàng (inventory-db), thu tiền (payment-db). Ba DB, không có <code>@Transactional</code> chung.
    <strong>2PC</strong> (two-phase commit, XA) về lý thuyết làm được, nhưng: mọi bên khoá tài nguyên chờ coordinator, coordinator chết thì treo,
    Kafka/Mongo/API thanh toán bên ngoài không tham gia XA. Thực tế microservice dùng <strong>Saga</strong>.</p>

    <p><strong>Saga</strong> = chuỗi <em>transaction cục bộ</em>, mỗi bước commit trong DB của mình và phát event/lệnh cho bước sau.
    Bước nào thất bại → chạy <strong>hành động bù trừ</strong> (compensation) cho các bước đã xong, theo thứ tự ngược. Không rollback — mà "làm ngược lại" về nghiệp vụ:
    huỷ giữ hàng, hoàn tiền.</p>

    <table>
      <tr><th></th><th>Choreography</th><th>Orchestration</th></tr>
      <tr><td>Cách chạy</td><td>Mỗi service nghe event và tự quyết bước tiếp</td><td>Một orchestrator giữ trạng thái saga, gửi lệnh từng bước</td></tr>
      <tr><td>Ưu</td><td>Không có điểm trung tâm, ít code cho luồng ngắn</td><td>Luồng hiện rõ ở một chỗ, dễ theo dõi, dễ thêm bước/timeout</td></tr>
      <tr><td>Nhược</td><td>Luồng rải rác, khó biết "đơn này đang kẹt ở đâu", dễ vòng lặp event</td><td>Thêm một thành phần; nguy cơ orchestrator ôm nghiệp vụ</td></tr>
      <tr><td>Hợp khi</td><td>2–3 bước, ít nhánh</td><td>≥ 4 bước, có timeout, nhiều nhánh bù trừ</td></tr>
    </table>

    <p><strong>Thiết kế saga đúng</strong></p>
    <ul>
      <li><strong>Trạng thái trung gian là hữu hình</strong>: đơn ở <code>PENDING</code> trong lúc chờ thanh toán — UI hiện "Đang xử lý", không hiện "Thành công".</li>
      <li><strong>Mọi bước và mọi bù trừ phải idempotent</strong> (bài 08) vì sẽ bị gọi lặp.</li>
      <li><strong>Bù trừ không được thất bại vĩnh viễn</strong>: retry tới khi được, hoặc đưa vào hàng chờ cho người xử lý. Có bước không thể bù (email đã gửi) → đặt nó <em>sau cùng</em>.</li>
      <li><strong>Pivot</strong>: bước mà sau nó saga chỉ đi tiếp chứ không quay lui (thường là thu tiền thành công).</li>
      <li><strong>Timeout</strong>: thanh toán không phản hồi sau 15 phút → coi như thất bại, bù trừ.</li>
      <li><strong>Thiếu cô lập</strong>: saga không có Isolation của ACID — người khác có thể thấy trạng thái giữa chừng (hàng đã giữ nhưng đơn chưa trả tiền). Chấp nhận và thiết kế cho nó (semantic lock: trạng thái PENDING).</li>
    </ul>

    <div class="callout"><p>💡 Saga không làm mất lỗi — nó biến lỗi thành <em>trạng thái nghiệp vụ</em> (PAYMENT_FAILED, CANCELLED). Mỗi bước "commit rồi phát event" phải nguyên tử,
    nếu không có thể commit mà không phát được event → saga kẹt. Bài sau (Outbox) giải quyết đúng điểm này. Orchestrator có thể là một service Rust với bảng <code>saga_state</code>,
    hoặc công cụ workflow bền (Temporal; trên Cloudflare có Workflows cho luồng nhiều bước ở edge).</p></div>
  `,

  codeTabs: [
    { id: "happy", label: "① Luồng thành công", lines: [
      "T1  order-svc     : INSERT order status=PENDING          -> OrderPlaced",
      "T2  inventory-svc : giữ hàng (reservation, TTL 15')     -> StockReserved",
      "T3  payment-svc   : thu tiền qua cổng thanh toán        -> PaymentCaptured   (pivot)",
      "T4  order-svc     : status=CONFIRMED                     -> OrderConfirmed",
      "T5  notification  : push 'Đặt hàng thành công'           (không bù được -> để cuối)"
    ]},
    { id: "fail", label: "② Thất bại & bù trừ", lines: [
      "T1  order-svc     : PENDING                               ✓",
      "T2  inventory-svc : giữ hàng                              ✓",
      "T3  payment-svc   : thẻ bị từ chối                        ✗ -> PaymentFailed",
      "",
      "C2  inventory-svc : nhả hàng đã giữ                       (bù T2)",
      "C1  order-svc     : status=CANCELLED, reason=PAYMENT_FAILED (bù T1)",
      "",
      "# Không có ROLLBACK: T1, T2 đã commit thật. Bù trừ là nghiệp vụ ngược lại."
    ]},
    { id: "choreo", label: "③ Choreography", lines: [
      "order-svc     phát OrderPlaced",
      "inventory-svc nghe OrderPlaced     -> giữ hàng  -> phát StockReserved | StockRejected",
      "payment-svc   nghe StockReserved   -> thu tiền  -> phát PaymentCaptured | PaymentFailed",
      "order-svc     nghe PaymentCaptured -> CONFIRMED",
      "order-svc     nghe StockRejected   -> CANCELLED",
      "inventory-svc nghe PaymentFailed   -> nhả hàng",
      "order-svc     nghe PaymentFailed   -> CANCELLED",
      "",
      "# Luồng nằm rải rác ở 3 service. 'Đơn ord_9 đang kẹt ở đâu?' -> phải ghép log."
    ]},
    { id: "orch", label: "④ Orchestrator (Rust)", lines: [
      "enum Step { Reserve, Charge, Confirm, Done, Compensating(Vec<Undo>), Failed }",
      "",
      "async fn on_reply(saga: &mut Saga, reply: Reply) -> Vec<Command> {",
      "    match (&saga.step, reply) {",
      "        (Step::Reserve, Reply::Reserved)   => { saga.step = Step::Charge;  vec![Command::Charge(saga.order_id)] }",
      "        (Step::Reserve, Reply::Rejected)   => { saga.step = Step::Failed;  vec![Command::CancelOrder(saga.order_id)] }",
      "        (Step::Charge,  Reply::Captured)   => { saga.step = Step::Confirm; vec![Command::ConfirmOrder(saga.order_id)] }",
      "        (Step::Charge,  Reply::Failed | Reply::Timeout) => {",
      "            saga.step = Step::Compensating(vec![Undo::Release, Undo::Cancel]);",
      "            vec![Command::ReleaseStock(saga.order_id), Command::CancelOrder(saga.order_id)]",
      "        }",
      "        _ => vec![],       // reply lặp/lạc thứ tự: bỏ qua (idempotent)",
      "    }",
      "}",
      "// saga_state lưu trong DB của orchestrator; lệnh gửi qua outbox -> Kafka"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="t1"><div class="nl">T1 Tạo đơn</div><div class="ns">PENDING</div></div>
      <div class="node" id="t2"><div class="nl">T2 Giữ hàng</div><div class="ns">inventory</div></div>
      <div class="node" id="t3"><div class="nl">T3 Thu tiền</div><div class="ns">pivot</div></div>
      <div class="node" id="t4"><div class="nl">T4 Xác nhận</div><div class="ns">CONFIRMED</div></div>
    </div>
    <div class="arrow" id="fail">↓ T3 thất bại → bù trừ theo thứ tự ngược</div>
    <div class="row">
      <div class="node" id="c2"><div class="nl">C2 Nhả hàng</div><div class="ns">bù T2</div></div>
      <div class="node" id="c1"><div class="nl">C1 Huỷ đơn</div><div class="ns">CANCELLED</div></div>
    </div>
    <div class="node" id="orc"><div class="nl">🎼 Orchestrator</div><div class="ns">saga_state · timeout · lệnh qua Kafka</div></div>
  `,
  steps: [
    { title: "1 · Chuỗi transaction cục bộ", tab: "happy", highlight: [1, 2, 3, 4], on: ["t1", "t2", "t3", "t4"],
      desc: "Mỗi bước commit trong DB của chính service đó rồi phát event. Không ai khoá tài nguyên của ai." },
    { title: "2 · Bước không bù được để cuối", tab: "happy", highlight: [3, 5], on: ["t3", "t4"],
      desc: "Thu tiền là pivot; push/email không thu hồi được nên chỉ làm khi chắc chắn thành công." },
    { title: "3 · Thất bại → bù trừ ngược", tab: "fail", highlight: [3, 5, 6, 8], on: ["fail", "c2", "c1"],
      desc: "Nhả hàng rồi huỷ đơn. Đơn không biến mất: nó thành CANCELLED với lý do rõ ràng." },
    { title: "4 · Choreography: luồng rải rác", tab: "choreo", highlight: [2, 3, 6, 9], on: ["t2", "t3"],
      desc: "Ít thành phần nhưng muốn biết một đơn đang ở đâu phải ghép event từ nhiều service." },
    { title: "5 · Orchestration: máy trạng thái", tab: "orch", highlight: [1, 5, 8, 9, 10, 12], on: ["orc"],
      desc: "Luồng nằm một chỗ; timeout thanh toán cũng là một nhánh. Reply lặp bị bỏ qua nhờ match theo trạng thái." },
    { title: "6 · Còn thiếu một mảnh", tab: "orch", highlight: [15], on: ["orc", "t1"],
      desc: "'Cập nhật saga_state' và 'gửi lệnh' phải nguyên tử — nếu không, commit xong mà chết trước khi gửi thì saga kẹt. → Outbox (bài 10)." }
  ],

  quiz: [
    { q: "Vì sao microservice thường tránh 2PC/XA?", options: [
        "Không có lý do",
        "Khoá tài nguyên chờ coordinator, coordinator chết thì treo; Kafka/API ngoài không tham gia XA",
        "2PC quá nhanh",
        "Rust không hỗ trợ"
      ], correct: 1, explanation: "Saga đổi nhất quán tức thì lấy tính sẵn sàng." },
    { q: "Hành động bù trừ (compensation) là gì?", options: [
        "ROLLBACK transaction DB",
        "Một transaction nghiệp vụ mới làm ngược tác dụng của bước đã commit (vd nhả hàng, hoàn tiền)",
        "Retry bước lỗi",
        "Xoá log"
      ], correct: 1, explanation: "Các bước trước đã commit thật; không rollback được." },
    { q: "Bước nào nên đặt CUỐI saga?", options: [
        "Giữ hàng",
        "Bước không thể bù trừ, như gửi email/push xác nhận",
        "Tạo đơn",
        "Thu tiền"
      ], correct: 1, explanation: "Không thu hồi được email đã gửi." },
    { q: "Ưu điểm của orchestration so với choreography?", options: [
        "Không cần thêm thành phần",
        "Luồng tập trung một chỗ: dễ theo dõi trạng thái, thêm bước, xử lý timeout",
        "Luôn nhanh hơn",
        "Không cần idempotent"
      ], correct: 1, explanation: "Đổi lại có thêm orchestrator phải vận hành." },
    { q: "Trong saga, đơn ở trạng thái PENDING có ý nghĩa gì?", options: [
        "Lỗi",
        "Trạng thái trung gian hữu hình — UI hiện 'Đang xử lý', người khác biết đơn chưa chốt",
        "Đơn đã giao",
        "Không nên có"
      ], correct: 1, explanation: "Semantic lock thay cho Isolation của ACID." },
    { q: "Vì sao bước và bù trừ trong saga phải idempotent?", options: [
        "Cho đẹp",
        "Event/lệnh được giao at-least-once và có thể retry, nên sẽ bị chạy lặp",
        "Để nhanh",
        "Không cần"
      ], correct: 1, explanation: "Nhả hàng hai lần không được làm tồn kho tăng hai lần." },
    { q: "Saga thiếu tính chất nào của ACID?", options: [
        "Durability", "Isolation — trạng thái giữa chừng có thể bị người khác thấy", "Atomicity của từng bước cục bộ", "Không thiếu gì"
      ], correct: 1, explanation: "Cần thiết kế nghiệp vụ chấp nhận điều đó." },
    { q: "Bù trừ bị lỗi (inventory đang chết). Nên làm gì?", options: [
        "Bỏ qua",
        "Retry bền bỉ (idempotent) tới khi được, hoặc đẩy vào hàng chờ xử lý thủ công, có cảnh báo",
        "Xoá đơn",
        "Restart orchestrator"
      ], correct: 1, explanation: "Bù trừ không được thất bại vĩnh viễn." },
    { q: "Điểm yếu còn lại khi mỗi bước 'commit DB rồi gửi Kafka' bằng hai lệnh riêng?", options: [
        "Không có",
        "Crash giữa hai lệnh → DB đã đổi nhưng event không được gửi (hoặc ngược lại) → saga kẹt",
        "Kafka quá nhanh",
        "Commit bị chậm"
      ], correct: 1, explanation: "Dual write — giải bằng Outbox." }
  ]
});
