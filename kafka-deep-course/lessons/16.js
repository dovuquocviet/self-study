window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Dữ liệu & schema",
  title: "Schema & tiến hoá schema: Schema Registry, Avro/Protobuf, compatibility",
  subtitle: "Wire format 5 byte · subject · BACKWARD/FORWARD/FULL · thứ tự nâng cấp producer/consumer",

  theory: `
    <p>Kafka chỉ thấy <strong>byte</strong>. Nó không biết message là JSON, Avro hay rác. Khi 10 service đọc chung topic <code>orders</code>, một producer đổi tên trường
    <code>total</code> thành <code>amount</code> là đủ làm gãy cả 10 — lúc chạy, không phải lúc build. Schema là <em>hợp đồng</em> giữa producer và consumer.</p>

    <p><strong>Schema Registry</strong> (Confluent, hoặc tương thích như Apicurio, Redpanda, Karapace): một service lưu các phiên bản schema theo <strong>subject</strong>
    (mặc định <code>&lt;topic&gt;-value</code> và <code>&lt;topic&gt;-key</code>), gán mỗi schema một ID toàn cục, và <strong>kiểm tra tương thích</strong> khi đăng ký phiên bản mới.</p>

    <p><strong>Wire format</strong> (Confluent): <code>[0x00 magic][4 byte schema ID big-endian][payload đã mã hoá]</code>. Protobuf chèn thêm danh sách chỉ số message sau ID.
    Consumer đọc ID → lấy schema từ registry (cache lại) → giải mã. Message nhỏ gọn vì không mang schema theo.</p>

    <table>
      <tr><th></th><th>JSON (không schema)</th><th>Avro</th><th>Protobuf</th></tr>
      <tr><td>Kích thước</td><td>Lớn (lặp tên trường)</td><td>Rất nhỏ (không có tên/tag trường)</td><td>Nhỏ (tag số)</td></tr>
      <tr><td>Giải mã cần</td><td>—</td><td>Schema của người ghi + người đọc</td><td>Chỉ .proto của người đọc</td></tr>
      <tr><td>Rust</td><td>serde_json</td><td>apache-avro</td><td>prost</td></tr>
      <tr><td>Hợp với</td><td>Prototype, log</td><td>Hệ sinh thái Kafka/Confluent, CDC</td><td>Công ty đã dùng gRPC</td></tr>
    </table>

    <p><strong>Compatibility modes</strong> — đặt theo subject (mặc định <code>BACKWARD</code>):</p>
    <table>
      <tr><th>Mode</th><th>Nghĩa</th><th>Được phép</th><th>Nâng cấp ai trước</th></tr>
      <tr><td><strong>BACKWARD</strong></td><td>Schema mới đọc được dữ liệu ghi bằng schema cũ</td><td>Xoá trường; thêm trường <em>có default</em></td><td><strong>Consumer</strong> trước</td></tr>
      <tr><td><strong>FORWARD</strong></td><td>Schema cũ đọc được dữ liệu ghi bằng schema mới</td><td>Thêm trường; xoá trường <em>có default</em></td><td><strong>Producer</strong> trước</td></tr>
      <tr><td><strong>FULL</strong></td><td>Cả hai chiều</td><td>Chỉ thêm/xoá trường có default</td><td>Thứ tự nào cũng được</td></tr>
      <tr><td><code>*_TRANSITIVE</code></td><td>So với <em>mọi</em> phiên bản cũ, không chỉ bản liền trước</td><td></td><td></td></tr>
      <tr><td>NONE</td><td>Không kiểm tra</td><td>Mọi thứ — nguy hiểm</td><td></td></tr>
    </table>

    <p><strong>Quy tắc sống còn</strong>: không đổi tên trường (với Avro = xoá + thêm), không đổi kiểu, không tái sử dụng tag Protobuf; trường mới luôn có default (Avro) / là optional (Protobuf).
    Thay đổi phá vỡ thật sự → topic mới (<code>orders.v2</code>) và chạy song song một thời gian.</p>

    <div class="callout"><p>💡 Với topic có nhiều consumer đọc lại lịch sử (ClickHouse replay, service mới đọc từ đầu), dùng <code>BACKWARD_TRANSITIVE</code> hoặc <code>FULL_TRANSITIVE</code>:
    consumer mới nhất phải đọc được message ghi từ phiên bản schema đầu tiên còn nằm trong retention.</p></div>
  `,

  codeTabs: [
    { id: "avro", label: "① Avro v1 → v2", lines: [
      "// v1",
      "{\"type\":\"record\",\"name\":\"OrderPaid\",\"namespace\":\"shop.orders\",\"fields\":[",
      "  {\"name\":\"order_id\",\"type\":\"string\"},",
      "  {\"name\":\"total\",\"type\":\"long\"}",
      "]}",
      "",
      "// v2: thêm trường CÓ default -> BACKWARD & FORWARD đều OK",
      "  {\"name\":\"currency\",\"type\":\"string\",\"default\":\"VND\"}",
      "",
      "// v2 SAI: thêm trường KHÔNG default -> registry từ chối (BACKWARD)",
      "  {\"name\":\"currency\",\"type\":\"string\"}"
    ]},
    { id: "wire", label: "② Wire format", lines: [
      "byte 0     : 0x00                 # magic byte",
      "byte 1..4  : 0x00 0x00 0x01 0x2A  # schema id = 298",
      "byte 5..   : payload Avro nhị phân",
      "",
      "consumer:",
      "  id = u32::from_be_bytes(buf[1..5])",
      "  schema = cache.get_or_fetch(id)   // GET /schemas/ids/298",
      "  value  = decode(schema, &buf[5..])"
    ]},
    { id: "rest", label: "③ REST API registry", lines: [
      "# đặt mode cho subject",
      "curl -X PUT -H 'Content-Type: application/vnd.schemaregistry.v1+json' \\",
      "  --data '{\"compatibility\":\"BACKWARD_TRANSITIVE\"}' \\",
      "  http://registry:8081/config/orders-value",
      "",
      "# thử schema mới có tương thích không (trong CI, trước khi deploy)",
      "curl -X POST -H 'Content-Type: application/vnd.schemaregistry.v1+json' \\",
      "  --data @order-paid-v2.json \\",
      "  http://registry:8081/compatibility/subjects/orders-value/versions/latest",
      "# => {\"is_compatible\": true}"
    ]},
    { id: "proto", label: "④ Protobuf + Rust", lines: [
      "// order.proto",
      "message OrderPaid {",
      "  string order_id = 1;",
      "  int64  total    = 2;",
      "  optional string currency = 3;   // thêm trường: tag mới, optional",
      "  reserved 4;                      // tag đã xoá: KHÔNG tái sử dụng",
      "}",
      "",
      "// Rust (prost): let ev = OrderPaid::decode(&payload[offset..])?;",
      "// offset = 5 + độ dài danh sách message-index (wire format Confluent cho Protobuf)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">✍️ Producer</div><div class="ns">đăng ký/tra schema → id 298</div></div>
    <div class="arrow" id="a1">↓ [0x00][298][payload]</div>
    <div class="node" id="k"><div class="nl">📨 Kafka</div><div class="ns">chỉ thấy byte</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="c"><div class="nl">👀 Consumer</div><div class="ns">đọc id → lấy schema → giải mã</div></div>
    <div class="node" id="sr"><div class="nl">📚 Schema Registry</div><div class="ns">subject orders-value · kiểm tra compatibility</div></div>
  `,
  steps: [
    { title: "1 · Thêm trường đúng cách", tab: "avro", highlight: [7, 8], on: ["p", "sr"],
      desc: "Trường mới có default: người đọc mới đọc được dữ liệu cũ (dùng default), người đọc cũ bỏ qua trường lạ." },
    { title: "2 · Registry chặn thay đổi phá vỡ", tab: "avro", highlight: [10, 11], on: ["sr"],
      desc: "Dưới BACKWARD, schema mới không đọc được dữ liệu cũ thiếu trường currency → đăng ký thất bại." },
    { title: "3 · 5 byte đầu message", tab: "wire", highlight: [1, 2, 3, 6, 7, 8], on: ["a1", "k", "a2", "c"],
      desc: "Magic byte + schema id. Consumer cache schema theo id nên chỉ gọi registry lần đầu." },
    { title: "4 · Kiểm tra trong CI", tab: "rest", highlight: [3, 4, 9, 10], on: ["sr"],
      desc: "Chạy kiểm tra tương thích trước khi merge — phát hiện lỗi hợp đồng lúc build, không phải lúc 2 giờ sáng." },
    { title: "5 · Protobuf", tab: "proto", highlight: [5, 6, 9, 10], on: ["c"],
      desc: "Tiến hoá dựa trên tag số: thêm tag mới, reserved tag đã xoá, không đổi kiểu." }
  ],

  quiz: [
    { q: "Compatibility mặc định của Confluent Schema Registry là?", options: ["NONE", "BACKWARD", "FORWARD", "FULL"], correct: 1,
      explanation: "Schema mới đọc được dữ liệu cũ." },
    { q: "Với BACKWARD, nên nâng cấp bên nào trước?", options: ["Producer", "Consumer", "Đồng thời", "Không quan trọng"], correct: 1,
      explanation: "Consumer mới đọc được cả dữ liệu cũ lẫn mới; sau đó producer mới bắt đầu ghi." },
    { q: "Thêm trường Avro không có default dưới BACKWARD thì?", options: [
        "Được chấp nhận", "Bị từ chối — schema mới không đọc được dữ liệu cũ thiếu trường đó", "Tự thêm default", "Chỉ cảnh báo"
      ], correct: 1, explanation: "Luôn thêm default." },
    { q: "Wire format Confluent bắt đầu bằng gì?", options: [
        "Tên schema dạng chuỗi", "Magic byte 0x00 + 4 byte schema ID", "Độ dài payload", "JSON header"
      ], correct: 1, explanation: "Protobuf thêm danh sách message index sau ID." },
    { q: "Subject mặc định cho value của topic orders là?", options: ["orders", "orders-value", "value-orders", "orders.avsc"], correct: 1,
      explanation: "TopicNameStrategy." },
    { q: "Khác biệt của *_TRANSITIVE?", options: [
        "Kiểm tra nhanh hơn",
        "Kiểm tra tương thích với mọi phiên bản trước, không chỉ bản liền trước",
        "Bỏ qua kiểm tra",
        "Chỉ áp dụng cho key"
      ], correct: 1, explanation: "Quan trọng khi consumer có thể đọc lại dữ liệu rất cũ." },
    { q: "Đổi tên trường total → amount trong Avro tương đương với…", options: [
        "Không thay đổi gì", "Xoá một trường và thêm một trường — thường phá vỡ tương thích", "Đổi kiểu", "Thêm alias tự động"
      ], correct: 1, explanation: "Avro có aliases nhưng dễ sai; tránh đổi tên." },
    { q: "Trong Protobuf, tag của trường đã xoá nên…", options: [
        "Tái sử dụng cho trường mới", "Đánh dấu reserved, không tái sử dụng", "Đổi kiểu", "Đặt về 0"
      ], correct: 1, explanation: "Tái sử dụng tag làm dữ liệu cũ bị hiểu sai." },
    { q: "Kafka broker có kiểm tra schema message không (mặc định, Apache Kafka)?", options: [
        "Có", "Không — broker chỉ thấy byte; kiểm tra nằm ở serializer client + registry", "Chỉ với Avro", "Chỉ với key"
      ], correct: 1, explanation: "Một số nền tảng thương mại có broker-side validation, nhưng Apache Kafka thì không." },
    { q: "Thay đổi thật sự phá vỡ (đổi kiểu total từ long sang string). Cách an toàn?", options: [
        "Đặt compatibility NONE rồi deploy",
        "Tạo topic mới (orders.v2), producer ghi song song, consumer chuyển dần",
        "Xoá topic cũ",
        "Tăng partition"
      ], correct: 1, explanation: "Giữ hợp đồng cũ cho consumer chưa chuyển." }
  ]
});
