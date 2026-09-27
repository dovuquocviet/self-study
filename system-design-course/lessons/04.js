window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Ranh giới & giao tiếp",
  title: "Giao tiếp đồng bộ: REST vs gRPC",
  subtitle: "HTTP/1.1 vs HTTP/2 · Protobuf · deadline · khi nào sync là đúng · cái giá của chuỗi gọi",

  theory: `
    <p>Gọi đồng bộ (sync) = bên gọi <strong>đứng chờ</strong> câu trả lời. Dễ hiểu, dễ debug, nhưng ghép chặt hai service <em>về thời gian</em>:
    bên kia chậm thì mình chậm, bên kia chết thì mình lỗi.</p>

    <p><strong>Toán về độ sẵn sàng</strong>: nếu request đi qua chuỗi 4 service, mỗi cái 99.9%, thì cả chuỗi ≈ 0.999<sup>4</sup> ≈ 99.6%.
    Độ trễ cũng cộng dồn, và p99 của chuỗi xấu hơn p99 từng khâu. Vì vậy: chuỗi sync càng ngắn càng tốt (lý tưởng ≤ 1–2 bước).</p>

    <table>
      <tr><th></th><th>REST/JSON</th><th>gRPC</th></tr>
      <tr><td>Giao thức</td><td>HTTP/1.1 hoặc 2, text JSON</td><td>HTTP/2 bắt buộc, Protobuf nhị phân</td></tr>
      <tr><td>Hợp đồng</td><td>OpenAPI (tuỳ chọn, dễ lệch code)</td><td>File <code>.proto</code> bắt buộc, sinh code client/server</td></tr>
      <tr><td>Hiệu năng</td><td>Parse JSON tốn CPU, payload lớn hơn</td><td>Nhỏ, nhanh; multiplex nhiều call trên 1 kết nối</td></tr>
      <tr><td>Streaming</td><td>SSE/WebSocket riêng</td><td>Có sẵn: server/client/bidi streaming</td></tr>
      <tr><td>Trình duyệt/edge</td><td>Chạy mọi nơi, debug bằng curl</td><td>Trình duyệt cần gRPC-Web/proxy; khó đọc bằng mắt</td></tr>
      <tr><td>Dùng khi</td><td>API public, mobile, Workers, webhook</td><td>Service ↔ service nội bộ, nhiều call nhỏ, cần kiểu chặt</td></tr>
    </table>

    <p><strong>Tiến hoá Protobuf</strong>: mỗi field có <em>số hiệu</em>; thêm field mới với số mới là tương thích ngược; không bao giờ tái sử dụng số đã xoá (dùng <code>reserved</code>).
    Trong proto3 field vô hướng mặc định không phân biệt "0" và "không gửi" — cần thì dùng <code>optional</code>.</p>

    <p><strong>Deadline</strong>: gRPC truyền hạn chót qua header <code>grpc-timeout</code>; service giữa chuỗi nên chuyển tiếp phần thời gian còn lại
    thay vì đặt timeout mới dài hơn — để không làm việc cho một request mà client đã bỏ.</p>

    <p><strong>Khi nào sync là đúng?</strong> Khi bên gọi <em>cần kết quả ngay để trả lời người dùng</em>: kiểm tra tồn kho lúc đặt, xác thực token, lấy giá hiện tại.
    Khi chỉ cần "báo cho ai đó biết việc đã xảy ra" (gửi email, cập nhật analytics) → async (bài 05).</p>

    <div class="callout"><p>💡 Spring: <code>RestTemplate</code>/<code>WebClient</code>/<code>FeignClient</code> ↔ Rust: <code>reqwest</code>. gRPC Java (<code>grpc-java</code>) ↔ Rust <code>tonic</code> + <code>prost</code>.
    Lưu ý <code>reqwest::Client</code> mặc định <strong>không có timeout tổng</strong> — phải tự đặt, giống RestTemplate mặc định chờ vô hạn.
    Cloudflare Workers gọi ra ngoài bằng <code>fetch</code> (HTTP), nên API mà Workers dùng thường là REST.</p></div>
  `,

  codeTabs: [
    { id: "proto", label: "① inventory.proto", lines: [
      "syntax = \"proto3\";",
      "package inventory.v1;",
      "",
      "service Inventory {",
      "  rpc Reserve(ReserveRequest) returns (ReserveReply);",
      "}",
      "message ReserveRequest {",
      "  string order_id = 1;",
      "  repeated Line lines = 2;",
      "  reserved 3;                 // field cũ đã xoá, cấm tái dùng số 3",
      "  optional string warehouse = 4;  // mới thêm: tương thích ngược",
      "}",
      "message Line { string sku = 1; uint32 qty = 2; }",
      "message ReserveReply { bool ok = 1; repeated string out_of_stock = 2; }"
    ]},
    { id: "tonic", label: "② Client tonic", lines: [
      "let channel = Endpoint::from_static(\"http://inventory:50051\")",
      "    .connect_timeout(Duration::from_millis(300))",
      "    .timeout(Duration::from_millis(800))     // trần cho mỗi call",
      "    .connect().await?;",
      "let mut client = InventoryClient::new(channel);   // tái sử dụng, đừng tạo mỗi request",
      "",
      "let mut req = tonic::Request::new(ReserveRequest { order_id, lines, ..Default::default() });",
      "req.set_timeout(remaining_budget);   // chuyển tiếp deadline còn lại -> header grpc-timeout",
      "match client.reserve(req).await {",
      "    Ok(r) => handle(r.into_inner()),",
      "    Err(s) if s.code() == Code::DeadlineExceeded => fallback(),",
      "    Err(s) => return Err(s.into()),",
      "}"
    ]},
    { id: "rest", label: "③ Client REST (reqwest)", lines: [
      "// Tạo MỘT lần lúc khởi động, chia sẻ qua State (có connection pool bên trong)",
      "let http = reqwest::Client::builder()",
      "    .connect_timeout(Duration::from_millis(300))",
      "    .timeout(Duration::from_secs(2))        // mặc định KHÔNG có timeout tổng!",
      "    .pool_max_idle_per_host(32)",
      "    .build()?;",
      "",
      "let price: PriceDto = http.get(format!(\"http://pricing/v1/prices/{sku}\"))",
      "    .send().await?",
      "    .error_for_status()?     // 4xx/5xx thành Err",
      "    .json().await?;"
    ]},
    { id: "chain", label: "④ Chuỗi sync", lines: [
      "mobile -> gateway -> order -> inventory -> pricing",
      "",
      "availability = 0.999 * 0.999 * 0.999 * 0.999 ≈ 0.996   // 99.6%",
      "latency p50  = 20 + 30 + 25 + 15 ms = 90 ms",
      "latency p99  : đuôi chậm của từng khâu cộng dồn và dễ gặp hơn",
      "",
      "Cách rút ngắn:",
      "  - order giữ bản sao giá (event) -> bỏ bước gọi pricing",
      "  - gửi email/push/analytics bằng event -> không nằm trên đường chờ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m"><div class="nl">📱 Mobile</div><div class="ns">REST/JSON qua gateway</div></div>
    <div class="arrow" id="a1">↓ HTTPS REST</div>
    <div class="node" id="o"><div class="nl">🦀 order-service</div><div class="ns">ngân sách thời gian 1 s</div></div>
    <div class="arrow" id="a2">↓ gRPC (HTTP/2, protobuf, grpc-timeout còn lại)</div>
    <div class="row">
      <div class="node" id="i"><div class="nl">🦀 inventory</div><div class="ns">Reserve()</div></div>
      <div class="node" id="p"><div class="nl">🦀 pricing</div><div class="ns">REST, có thể bỏ khỏi chuỗi</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Hợp đồng bằng .proto", tab: "proto", highlight: [4, 5, 7, 8, 9], on: ["i"],
      desc: "Proto là hợp đồng chặt; tonic/prost sinh code Rust, grpc-java sinh code Java từ cùng file." },
    { title: "2 · Tiến hoá an toàn", tab: "proto", highlight: [10, 11], on: ["i"],
      desc: "Thêm field số mới; xoá thì reserved số cũ. Đổi số hiệu = phá vỡ tương thích." },
    { title: "3 · Client dùng chung, có timeout", tab: "tonic", highlight: [2, 3, 5], on: ["o", "a2"],
      desc: "Channel tonic multiplex trên HTTP/2; tạo mới mỗi request là tốn bắt tay TCP/TLS." },
    { title: "4 · Truyền deadline xuống", tab: "tonic", highlight: [8, 11], on: ["a2", "i"],
      desc: "Chỉ cho inventory phần thời gian còn lại. Hết hạn thì fallback thay vì treo." },
    { title: "5 · REST: nhớ đặt timeout", tab: "rest", highlight: [2, 3, 4, 10], on: ["p"],
      desc: "reqwest không có timeout tổng mặc định. error_for_status để không coi 500 là thành công." },
    { title: "6 · Chuỗi càng dài càng mong manh", tab: "chain", highlight: [1, 3, 5, 8, 9], on: ["m", "a1", "o", "p"],
      desc: "Mỗi bước sync nhân xác suất lỗi. Rút ngắn bằng bản sao dữ liệu và event." }
  ],

  quiz: [
    { q: "Chuỗi gọi sync qua 3 service, mỗi cái sẵn sàng 99%. Cả chuỗi ≈?", options: [
        "99%", "~97%", "~99.9%", "~90%"
      ], correct: 1, explanation: "0.99³ ≈ 0.970." },
    { q: "gRPC chạy trên giao thức nào?", options: [
        "HTTP/1.1", "HTTP/2", "UDP thuần", "WebSocket"
      ], correct: 1, explanation: "HTTP/2 cho multiplexing và streaming." },
    { q: "Thay đổi .proto nào PHÁ vỡ tương thích?", options: [
        "Thêm field mới với số hiệu chưa dùng",
        "Đổi số hiệu của field đang dùng / tái dùng số đã xoá",
        "Thêm rpc mới",
        "Thêm message mới"
      ], correct: 1, explanation: "Trên dây chỉ có số hiệu; đổi số là đổi nghĩa dữ liệu." },
    { q: "Vì sao nên chuyển tiếp deadline còn lại xuống service phía sau?", options: [
        "Cho log đẹp",
        "Để không làm việc cho request mà client đã bỏ, tránh lãng phí và dồn tải",
        "gRPC bắt buộc",
        "Để tăng timeout"
      ], correct: 1, explanation: "Mỗi tầng đặt timeout riêng dài hơn sẽ để lại việc 'mồ côi'." },
    { q: "reqwest::Client mặc định có timeout tổng cho request không?", options: [
        "Có, 30 giây", "Không — phải tự đặt", "Có, 5 giây", "Có, 1 phút"
      ], correct: 1, explanation: "Giống RestTemplate cũ: không đặt là có thể chờ rất lâu." },
    { q: "Vì sao nên tạo reqwest::Client / tonic Channel một lần rồi dùng chung?", options: [
        "Tiết kiệm RAM một chút",
        "Chúng giữ connection pool; tạo mới mỗi request tốn bắt tay TCP/TLS",
        "Bắt buộc bởi compiler",
        "Không có lý do"
      ], correct: 1, explanation: "Tương tự không tạo RestTemplate mới mỗi lần gọi." },
    { q: "Khi nào gọi sync là lựa chọn đúng?", options: [
        "Gửi email xác nhận",
        "Cần kết quả ngay để trả lời người dùng, vd kiểm tra tồn kho lúc đặt",
        "Cập nhật analytics",
        "Đồng bộ dữ liệu sang Elasticsearch"
      ], correct: 1, explanation: "Các việc 'báo cho biết' nên async." },
    { q: "API mà app mobile và Cloudflare Workers gọi thường dùng gì?", options: [
        "gRPC thuần", "REST/JSON qua HTTPS", "CORBA", "SOAP"
      ], correct: 1, explanation: "Chạy mọi nơi; gRPC từ trình duyệt/edge cần thêm gRPC-Web hoặc proxy." },
    { q: "Trong proto3, field string/int không có optional: server nhận 0 hoặc chuỗi rỗng nghĩa là?", options: [
        "Chắc chắn client gửi 0",
        "Không phân biệt được 'gửi 0' và 'không gửi' — cần optional nếu cần phân biệt",
        "Lỗi parse",
        "Field bị xoá"
      ], correct: 1, explanation: "Giá trị mặc định không được mã hoá trên dây." }
  ]
});
