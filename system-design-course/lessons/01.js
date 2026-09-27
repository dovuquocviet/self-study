window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Tư duy thiết kế",
  title: "Quy trình thiết kế: từ yêu cầu tới con số",
  subtitle: "Yêu cầu chức năng / phi chức năng · ước lượng QPS, dung lượng, băng thông · 5 bước lặp",

  theory: `
    <p>Người "code tay to" thường bắt đầu từ Controller rồi nghĩ dần. Kỹ sư bắt đầu từ <strong>câu hỏi và con số</strong>:
    hệ thống phải làm gì, chịu tải bao nhiêu, được phép sai/chậm tới mức nào. Chỉ khi có con số mới biết một bảng Postgres là đủ
    hay phải Kafka + ClickHouse. Thiết kế thừa tốn tiền vận hành y như thiết kế thiếu làm sập hệ thống.</p>

    <p><strong>5 bước (lặp lại, không phải thác nước)</strong></p>
    <ol>
      <li><strong>Yêu cầu chức năng</strong> (functional): hành động của người dùng/hệ thống khác. Viết dạng động từ: "khách đặt đơn", "app nhận push khi đơn giao".
        Chốt cái gì <em>không</em> làm (out of scope) — quan trọng không kém.</li>
      <li><strong>Yêu cầu phi chức năng</strong> (NFR): độ trễ (p99 &lt; 300 ms), sẵn sàng (99.9%), nhất quán (đọc lại thấy ngay hay chậm vài giây được?),
        độ bền dữ liệu (mất 1 đơn có chấp nhận được không?), bảo mật, chi phí, pháp lý (dữ liệu ở EU?).</li>
      <li><strong>Ước lượng</strong> (back-of-the-envelope): QPS trung bình &amp; đỉnh, tỉ lệ đọc/ghi, dung lượng/năm, băng thông.</li>
      <li><strong>API &amp; data model</strong>: hợp đồng giữa client và service, entity và ai sở hữu nó (bài 02, 03).</li>
      <li><strong>Sơ đồ tổng thể → đào sâu điểm nghẽn</strong>: vẽ khối lớn, rồi chỉ đào vào chỗ con số nói là khó (hot key, fan-out, ghi dồn dập).</li>
    </ol>

    <p><strong>Bảng số cần thuộc</strong></p>
    <table>
      <tr><th>Đại lượng</th><th>Giá trị làm tròn</th></tr>
      <tr><td>1 ngày</td><td>86 400 s ≈ <strong>10<sup>5</sup> s</strong> (dễ nhẩm)</td></tr>
      <tr><td>1 triệu request/ngày</td><td>≈ 12 QPS trung bình</td></tr>
      <tr><td>Đỉnh (peak)</td><td>thường 2–10 × trung bình (flash sale có thể hơn)</td></tr>
      <tr><td>Đọc RAM / Redis cùng DC</td><td>~100 ns / ~0.2–1 ms (tính cả mạng)</td></tr>
      <tr><td>Round trip trong 1 DC</td><td>~0.5 ms; xuyên châu lục ~100–150 ms</td></tr>
      <tr><td>Query Postgres có index</td><td>~1–5 ms; một node chịu vài nghìn QPS đơn giản</td></tr>
    </table>

    <p><strong>Vì sao ước lượng quan trọng?</strong> Nó quyết định kiến trúc. 12 QPS thì một service Rust + một Postgres là thừa sức;
    50 000 QPS ghi sự kiện thì Postgres dòng-từng-dòng sẽ nghẹt, phải đẩy vào Kafka rồi ClickHouse ghi theo lô.
    Tỉ lệ đọc:ghi 100:1 → nghĩ ngay tới cache; ghi nhiều hơn đọc → nghĩ tới log/append.</p>

    <div class="callout"><p>💡 So với Spring: trước đây bạn nhận ticket "thêm API đặt đơn" và viết <code>@PostMapping</code> ngay.
    System design là làm ngược lại: hỏi "bao nhiêu đơn/giây lúc sale? mất đơn có được không? app mobile chịu mạng chập chờn thế nào?" rồi mới chọn công cụ.
    Trong phỏng vấn lẫn thực tế, <strong>nói rõ giả định</strong> ("giả sử 1 triệu DAU") quan trọng hơn con số chính xác.</p></div>
  `,

  codeTabs: [
    { id: "req", label: "① Yêu cầu", lines: [
      "# Bài toán: service Đơn hàng cho app mobile bán mỹ phẩm",
      "Chức năng:",
      "  - Khách tạo đơn từ giỏ hàng, thanh toán online",
      "  - Khách xem lịch sử đơn, trạng thái giao hàng",
      "  - Push thông báo khi đơn đổi trạng thái",
      "Ngoài phạm vi: đổi trả, marketplace nhiều người bán",
      "",
      "Phi chức năng:",
      "  - Tạo đơn p99 < 500 ms; xem lịch sử p99 < 200 ms",
      "  - Sẵn sàng 99.9% (~43 phút downtime/tháng)",
      "  - KHÔNG được mất đơn đã thanh toán (durability)",
      "  - Lịch sử đơn được phép trễ vài giây (eventual consistency)"
    ]},
    { id: "est", label: "② Ước lượng", lines: [
      "DAU            = 1 000 000",
      "đơn/ngày       = 1 000 000 * 5%   = 50 000 đơn",
      "QPS ghi TB     = 50 000 / 100 000 ≈ 0.5 QPS   // 1 ngày ≈ 1e5 s",
      "QPS ghi đỉnh   = 0.5 * 20 (flash sale) = 10 QPS",
      "",
      "xem đơn/ngày   = 1 000 000 * 3 lần = 3 000 000",
      "QPS đọc TB     = 3e6 / 1e5 = 30 QPS ; đỉnh ~300 QPS",
      "tỉ lệ đọc:ghi  ≈ 60 : 1   -> đáng cân nhắc cache",
      "",
      "1 đơn ≈ 2 KB (đơn + dòng hàng)",
      "dung lượng/năm = 50 000 * 365 * 2 KB ≈ 36.5 GB   -> 1 Postgres thừa sức"
    ]},
    { id: "evt", label: "③ Ước lượng sự kiện", lines: [
      "# Cùng app, nhưng giờ ghi mọi sự kiện UI để phân tích",
      "sự kiện/user/ngày = 200",
      "sự kiện/ngày      = 1e6 * 200 = 2e8",
      "QPS TB            = 2e8 / 1e5 = 2 000 events/s ; đỉnh ~10 000/s",
      "1 sự kiện ≈ 300 B -> 60 GB/ngày thô, ~22 TB/năm",
      "",
      "=> Không ghi từng dòng vào Postgres.",
      "=> Mobile gửi theo lô -> Worker ở edge -> Kafka -> ClickHouse (nén cột ~10x)"
    ]},
    { id: "java", label: "④ Thói quen cũ vs mới", lines: [
      "// Thói quen cũ (Spring): bắt đầu từ code",
      "@PostMapping(\"/orders\")",
      "public Order create(@RequestBody OrderReq r) { return repo.save(...); }",
      "",
      "// Kỹ sư: bắt đầu từ câu hỏi",
      "// 1. Bao nhiêu QPS lúc đỉnh?           -> 10 QPS: không cần gì đặc biệt",
      "// 2. Retry từ mobile có tạo đơn trùng? -> cần Idempotency-Key (bài 08)",
      "// 3. Thanh toán ở service khác?        -> cần saga/outbox (bài 09, 10)",
      "// 4. Ai khác cần biết 'đơn đã tạo'?    -> phát event qua Kafka (bài 05)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="n1"><div class="nl">① Yêu cầu chức năng</div><div class="ns">ai làm gì · ngoài phạm vi</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="n2"><div class="nl">② Phi chức năng</div><div class="ns">latency · availability · consistency · durability</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="n3"><div class="nl">③ Ước lượng</div><div class="ns">QPS · đọc:ghi · GB/năm</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="n4"><div class="nl">④ API &amp; data model</div><div class="ns">hợp đồng · chủ sở hữu dữ liệu</div></div>
      <div class="node" id="n5"><div class="nl">⑤ Sơ đồ &amp; đào sâu</div><div class="ns">chỉ đào chỗ con số nói là khó</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chốt chức năng và ngoài phạm vi", tab: "req", highlight: [2, 3, 4, 5, 6], on: ["n1"],
      desc: "Viết bằng động từ. Dòng 6 — thứ KHÔNG làm — giúp tránh thiết kế cho bài toán không tồn tại." },
    { title: "2 · Phi chức năng quyết định kiến trúc", tab: "req", highlight: [9, 10, 11, 12], on: ["a1", "n2"],
      desc: "'Không được mất đơn' dẫn tới ghi DB trước khi trả 200 và dùng outbox; 'lịch sử trễ vài giây được' cho phép dùng read model/cache." },
    { title: "3 · Nhẩm QPS với 1 ngày ≈ 1e5 giây", tab: "est", highlight: [2, 3, 4, 7, 8], on: ["a2", "n3"],
      desc: "10 QPS ghi lúc đỉnh là rất nhỏ. Kết luận: Postgres đơn là đủ; đừng vội sharding." },
    { title: "4 · Dung lượng", tab: "est", highlight: [10, 11], on: ["n3"],
      desc: "36.5 GB/năm vừa một ổ đĩa. Con số này bảo bạn KHÔNG cần phân mảnh." },
    { title: "5 · Cùng app, bài toán khác hẳn", tab: "evt", highlight: [4, 5, 7, 8], on: ["n3", "a3", "n5"],
      desc: "10 000 sự kiện/s và 22 TB/năm: đây mới là chỗ cần Kafka + ClickHouse. Ước lượng chỉ ra chỗ phải đào sâu." },
    { title: "6 · Đổi thói quen", tab: "java", highlight: [5, 6, 7, 8, 9], on: ["n4", "n5"],
      desc: "Mỗi câu hỏi dẫn tới một bài trong khoá. Code đến sau cùng." }
  ],

  quiz: [
    { q: "Câu nào là yêu cầu PHI chức năng?", options: [
        "Khách xem được lịch sử đơn",
        "API tạo đơn có p99 dưới 500 ms",
        "Admin huỷ được đơn",
        "Gửi email xác nhận đơn"
      ], correct: 1, explanation: "Độ trễ, sẵn sàng, nhất quán, bền dữ liệu, bảo mật, chi phí là phi chức năng." },
    { q: "10 triệu request/ngày tương đương khoảng bao nhiêu QPS trung bình?", options: [
        "~1 QPS", "~115 QPS", "~10 000 QPS", "~1 000 000 QPS"
      ], correct: 1, explanation: "10^7 / 86 400 ≈ 115. Nhẩm nhanh: 10^7 / 10^5 = 100." },
    { q: "Vì sao phải ước lượng tải trước khi chọn công nghệ?", options: [
        "Để điền vào tài liệu",
        "Vì con số quyết định cần gì: 10 QPS thì một Postgres đủ; 10 000 sự kiện/s thì cần log + kho cột",
        "Để chọn ngôn ngữ lập trình",
        "Không cần, cứ dùng microservice cho chắc"
      ], correct: 1, explanation: "Thiết kế thừa tốn chi phí vận hành; thiết kế thiếu làm sập hệ thống." },
    { q: "Tỉ lệ đọc:ghi 100:1 gợi ý điều gì?", options: [
        "Cần sharding ghi ngay",
        "Cache hoặc read replica/read model thường mang lại nhiều lợi ích",
        "Phải dùng Kafka",
        "Bỏ index"
      ], correct: 1, explanation: "Đọc áp đảo → tối ưu đường đọc." },
    { q: "Sẵn sàng 99.9% cho phép khoảng bao nhiêu downtime mỗi tháng (30 ngày)?", options: [
        "~4 phút", "~43 phút", "~7 giờ", "~3 ngày"
      ], correct: 1, explanation: "0.1% × 43 200 phút ≈ 43 phút. 99.99% ≈ 4.3 phút." },
    { q: "Vì sao nên ghi rõ phần 'ngoài phạm vi'?", options: [
        "Cho tài liệu dài hơn",
        "Tránh thiết kế cho yêu cầu không có, giữ thiết kế tập trung",
        "Để QA không test",
        "Bắt buộc theo chuẩn ISO"
      ], correct: 1, explanation: "Phạm vi mơ hồ là nguồn gốc của thiết kế thừa." },
    { q: "Lịch sử đơn 'được phép trễ vài giây' mở ra lựa chọn nào?", options: [
        "Phải dùng transaction phân tán 2PC",
        "Đọc từ cache, replica hay read model cập nhật bất đồng bộ (eventual consistency)",
        "Không được dùng cache",
        "Phải khoá bảng khi đọc"
      ], correct: 1, explanation: "Nới lỏng nhất quán là thứ cho phép scale đường đọc rẻ." },
    { q: "Khi trình bày thiết kế, điều gì quan trọng nhất về con số?", options: [
        "Phải chính xác tới đơn vị",
        "Nói rõ giả định và làm tròn hợp lý để ra bậc độ lớn (order of magnitude)",
        "Không nói con số",
        "Dùng số của Google"
      ], correct: 1, explanation: "Sai lệch 2 lần không đổi kiến trúc; sai 100 lần thì có." },
    { q: "Bước nào nên làm SAU cùng?", options: [
        "Hỏi yêu cầu", "Ước lượng tải", "Đào sâu điểm nghẽn mà con số chỉ ra", "Xác định phi chức năng"
      ], correct: 2, explanation: "Chỉ đào sâu khi đã biết chỗ nào thực sự khó." }
  ]
});
