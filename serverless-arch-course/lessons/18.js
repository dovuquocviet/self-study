window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Vận hành: hiệu năng, quan sát, chi phí",
  title: "Chi phí và khi nào KHÔNG nên dùng serverless",
  subtitle: "Mô hình tính tiền theo request/CPU/row · ước tính một API · bẫy chi phí · tiêu chí chọn Workers, Containers hay service Rust",

  theory: `
    <p>Serverless tính tiền theo <strong>lượng dùng</strong>, không theo máy. Rẻ khi traffic thất thường hoặc nhỏ; có thể đắt hơn máy thuê khi tải cao đều đặn và CPU nặng.
    Kỹ sư phải ước tính được trước khi chọn.</p>

    <p><strong>Đơn giá tham khảo (Workers Paid, tại thời điểm viết — luôn kiểm tra trang Pricing)</strong></p>
    <table>
      <tr><th>Sản phẩm</th><th>Tính theo</th><th>Giá vượt mức gói</th></tr>
      <tr><td>Workers</td><td>Request + CPU ms (gói $5/tháng có 10 triệu request, 30 triệu CPU ms)</td><td>$0,30 / triệu request · $0,02 / triệu CPU ms</td></tr>
      <tr><td>Durable Objects</td><td>Request + duration (GB-s, khi object đang thức) + storage</td><td>$0,15 / triệu request · $12,50 / triệu GB-s</td></tr>
      <tr><td>DO SQLite / D1 storage</td><td>Dòng đọc, dòng ghi, GB lưu</td><td>$0,001 / triệu dòng đọc · $1,00 / triệu dòng ghi</td></tr>
      <tr><td>KV</td><td>Đọc, ghi, lưu</td><td>$0,50 / triệu đọc · $5 / triệu ghi</td></tr>
      <tr><td>Queues</td><td>Operation (mỗi 64 KB ghi/đọc/xoá)</td><td>$0,40 / triệu operation</td></tr>
      <tr><td>R2</td><td>GB lưu + Class A/B operation; <strong>egress miễn phí</strong></td><td>$0,015 / GB-tháng · A $4,50 / triệu · B $0,36 / triệu</td></tr>
    </table>

    <p><strong>Bẫy chi phí hay gặp</strong></p>
    <ul>
      <li>DO không hibernate (WebSocket bằng <code>ws.accept()</code>, <code>setInterval</code>) → trả duration 24/7 cho mỗi object.</li>
      <li>Query không index trên D1/DO SQLite → tiền tính theo <em>dòng quét</em>, không theo dòng trả về. Một <code>SELECT COUNT(*)</code> trên bảng 10 triệu dòng mỗi request = 10 triệu dòng đọc.</li>
      <li>KV dùng như DB ghi nhiều: ghi đắt gấp 10 lần đọc.</li>
      <li>Retry vô hạn trong Queues vì lỗi logic.</li>
      <li>Log 100% traffic lớn với payload đầy đủ.</li>
    </ul>

    <p><strong>Khi nào KHÔNG dùng Workers</strong></p>
    <table>
      <tr><th>Dấu hiệu</th><th>Vì sao</th><th>Chọn gì</th></tr>
      <tr><td>CPU nặng kéo dài (encode video, xử lý ảnh lớn, ML inference tự host)</td><td>Trần CPU 5 phút, 128 MB RAM</td><td>Cloudflare Containers, hoặc service Rust trên máy/K8s</td></tr>
      <tr><td>Cần thư viện native / hệ sinh thái JVM nặng</td><td>Runtime là V8 (JS/TS/Wasm)</td><td>Giữ service Java/Rust, Worker làm biên</td></tr>
      <tr><td>Kết nối dài hạn kiểu consumer Kafka, gRPC streaming hai chiều lâu</td><td>Mô hình theo request/sự kiện</td><td>Service chạy liên tục</td></tr>
      <tr><td>Tải cao đều đặn 24/7, đã tối ưu tốt trên máy thuê</td><td>Trả theo lượng có thể đắt hơn máy cố định</td><td>So sánh bằng số, không theo cảm tính</td></tr>
      <tr><td>Transaction quan hệ phức tạp trên DB lớn dùng chung</td><td>D1 10 GB/DB, không transaction tương tác</td><td>Postgres (+ Hyperdrive nếu Worker cần đọc)</td></tr>
    </table>

    <div class="callout"><p>💡 Workers mạnh nhất ở: biên (gateway, auth, cache, BFF), API nhỏ nhiều biến động, điều phối realtime (DO), việc bất đồng bộ nhẹ (Queues), quy trình dài (Workflows).
    Service lõi nhiều CPU và nhiều JOIN để ở Rust + Postgres là quyết định kỹ thuật tốt, không phải thất bại của serverless.</p></div>
  `,

  codeTabs: [
    { id: "calc", label: "① Ước tính một API", lines: [
      "# API catalog: 100 triệu request/tháng, CPU trung bình 4 ms",
      "requests_vuot = 100M - 10M              = 90M   × $0.30/M  = $27.00",
      "cpu_ms        = 100M × 4 ms              = 400M ms",
      "cpu_vuot      = 400M - 30M               = 370M  × $0.02/M  = $7.40",
      "goi_co_ban                                                 = $5.00",
      "tong_workers                                               ≈ $39.40 / tháng",
      "",
      "# chưa gồm KV/D1/R2 và chi phí backend phía sau",
      "# CPU chỉ tính thời gian chạy thật, chờ fetch/DB không tính"
    ]},
    { id: "do", label: "② DO: hibernate hay không", lines: [
      "# 1.000 phòng chat, mỗi phòng mở 24/7, nhưng chỉ bận ~2% thời gian",
      "duration_1_obj = 128 MB = 0.125 GB × 2.592.000 s/tháng = 324.000 GB-s",
      "",
      "# Không hibernate: 1.000 × 324.000 = 324M GB-s × $12.50/M ≈ $4.050",
      "# Hibernate (chỉ tính lúc thức ~2%):  ≈ 6,5M GB-s × $12.50/M ≈ $81",
      "",
      "# → chọn đúng API (acceptWebSocket) đổi hoá đơn ~50 lần",
      "# (con số minh hoạ, chưa trừ phần miễn phí trong gói)"
    ]},
    { id: "rows", label: "③ Tiền theo dòng quét", lines: [
      "-- SAI: mỗi request quét cả bảng",
      "SELECT COUNT(*) FROM orders WHERE status = 'PENDING';   -- 10M rows read",
      "",
      "-- ĐÚNG: index + bộ đếm duy trì khi ghi",
      "CREATE INDEX idx_orders_status ON orders(status);",
      "-- hoặc giữ counter trong một DO / bảng tổng, cập nhật khi đổi trạng thái",
      "",
      "// kiểm tra: D1 trả meta.rows_read, DO cursor.rowsRead"
    ]},
    { id: "decide", label: "④ Cây quyết định", lines: [
      "if (cpu_nang_keo_dai || can_thu_vien_native)     -> Containers / service Rust",
      "else if (ket_noi_dai_han_khong_phai_HTTP)       -> service chạy liên tục",
      "else if (can_dieu_phoi_state_realtime)           -> Worker + Durable Objects",
      "else if (nhieu_buoc_cho_lau)                     -> Workflows",
      "else if (viec_nen_nhe)                           -> Queues",
      "else if (bien: auth/cache/route/BFF/API nho)     -> Worker",
      "// luôn: ước tính chi phí bằng số liệu traffic thật"
    ]}
  ],

  stageHtml: `
    <div class="node" id="need"><div class="nl">🧩 Tính năng mới</div><div class="ns">traffic? CPU? state? thời gian chạy?</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="wk"><div class="nl">🌩️ Workers/DO/Queues</div><div class="ns">biên, realtime, bất đồng bộ nhẹ</div></div>
      <div class="node" id="ct"><div class="nl">📦 Containers / Rust</div><div class="ns">CPU nặng, native, chạy liên tục</div></div>
    </div>
    <div class="arrow" id="a2">↓ ước tính bằng số</div>
    <div class="node" id="bill"><div class="nl">💵 Hoá đơn</div><div class="ns">request · CPU ms · GB-s · dòng đọc/ghi · operation</div></div>
  `,
  steps: [
    { title: "1 · Ước tính trước", tab: "calc", highlight: [2, 4, 6], on: ["need", "bill"],
      desc: "Request và CPU ms là hai trục chính của Workers. Chờ I/O không tính CPU." },
    { title: "2 · Duration của DO", tab: "do", highlight: [2, 4, 5, 7], on: ["wk", "bill"],
      desc: "Object thức 24/7 vs chỉ thức khi có việc: chênh lệch hàng chục lần." },
    { title: "3 · Tiền theo dòng quét", tab: "rows", highlight: [2, 5, 8], on: ["bill"],
      desc: "SQLite serverless tính tiền theo dòng đọc — index vừa là hiệu năng vừa là tiền." },
    { title: "4 · Khi nào không dùng", tab: "decide", highlight: [1, 2], on: ["a1", "ct"],
      desc: "CPU nặng, native lib, kết nối dài hạn → không phải đất của Workers." },
    { title: "5 · Khi nào dùng", tab: "decide", highlight: [3, 4, 5, 6, 7], on: ["wk", "a2"],
      desc: "Chọn sản phẩm theo nhu cầu state/thời gian; luôn ước tính bằng traffic thật." }
  ],

  quiz: [
    { q: "Hai trục tính tiền chính của Workers (Standard)?", options: [
        "Số máy và RAM", "Số request và CPU time", "Băng thông ra", "Số dòng code"
      ], correct: 1, explanation: "Gói $5 có sẵn 10 triệu request và 30 triệu CPU ms." },
    { q: "Worker chờ một API chậm 2 giây (CPU chỉ 3 ms). CPU bị tính bao nhiêu?", options: [
        "2003 ms", "Khoảng 3 ms", "2000 ms", "0"
      ], correct: 1, explanation: "Thời gian chờ I/O không tính CPU." },
    { q: "Vì sao DO giữ WebSocket bằng ws.accept() có thể rất đắt?", options: [
        "Tính theo số message",
        "Object phải thức liên tục → trả duration (GB-s) 24/7",
        "Bị tính egress",
        "Không đắt"
      ], correct: 1, explanation: "Hibernation chỉ tính lúc thức." },
    { q: "SELECT COUNT(*) không index trên bảng D1 10 triệu dòng, mỗi request. Vấn đề chi phí?", options: [
        "Không sao vì chỉ trả 1 dòng",
        "Tính theo dòng đọc (quét) — 10 triệu dòng mỗi request",
        "Chỉ tính CPU",
        "D1 miễn phí đọc"
      ], correct: 1, explanation: "Index hoặc duy trì bộ đếm." },
    { q: "Ghi KV so với đọc KV về giá?", options: [
        "Bằng nhau", "Ghi đắt hơn đọc khoảng 10 lần", "Đọc đắt hơn", "Ghi miễn phí"
      ], correct: 1, explanation: "$5 vs $0,50 mỗi triệu." },
    { q: "Encode video 20 phút CPU mỗi file. Nên chạy ở đâu?", options: [
        "Worker với cpu_ms tối đa",
        "Containers hoặc service chạy trên máy (Rust), Worker chỉ điều phối",
        "Durable Object",
        "KV"
      ], correct: 1, explanation: "Trần CPU của Worker là 5 phút, RAM 128 MB." },
    { q: "Ưu điểm chi phí đặc biệt của R2?", options: [
        "Không tính phí lưu trữ", "Egress miễn phí", "Không tính operation", "Miễn phí hoàn toàn"
      ], correct: 1, explanation: "Vẫn tính GB lưu và Class A/B." },
    { q: "Service tải cao đều 24/7, CPU nặng, đang chạy tốt trên máy thuê. Có nên chuyển sang Workers?", options: [
        "Luôn nên",
        "Chỉ khi ước tính bằng số cho thấy lợi — trả theo lượng có thể đắt hơn máy cố định",
        "Không bao giờ",
        "Chỉ nếu viết bằng Rust"
      ], correct: 1, explanation: "Quyết định bằng số liệu." },
    { q: "Một consumer Kafka cần giữ kết nối liên tục để đọc partition. Chạy ở đâu hợp?", options: [
        "Worker fetch handler", "Service chạy liên tục (Rust/Java)", "Cron mỗi phút", "KV"
      ], correct: 1, explanation: "Workers theo mô hình request/sự kiện, không phải tiến trình sống lâu." },
    { q: "Bẫy chi phí nào liên quan tới Queues?", options: [
        "Batch size lớn",
        "Retry vô hạn vì lỗi logic — mỗi lần giao lại tốn operation",
        "Dùng DLQ",
        "Ack từng message"
      ], correct: 1, explanation: "Phân loại lỗi vĩnh viễn và ack/DLQ." }
  ]
});
