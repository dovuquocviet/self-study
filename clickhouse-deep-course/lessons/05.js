window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "MergeTree sâu",
  title: "Kiểu dữ liệu & nén: LowCardinality, Nullable, codec",
  subtitle: "chọn kiểu nhỏ nhất đủ dùng · LowCardinality = dictionary · Delta/DoubleDelta/Gorilla/T64 + ZSTD",

  theory: `
    <p>Ở column-store, kiểu dữ liệu quyết định trực tiếp số byte đọc từ đĩa. Chọn kiểu kỹ ở ClickHouse đáng giá hơn nhiều so với ở Postgres.</p>

    <table>
      <tr><th>Tình huống</th><th>Nên dùng</th><th>Tránh</th></tr>
      <tr><td>Số nguyên</td><td>Kiểu nhỏ nhất đủ dùng: <code>UInt8/16/32/64</code></td><td>Int64 cho mọi thứ (quen tay kiểu Java <code>long</code>)</td></tr>
      <tr><td>Tiền</td><td><code>Decimal(18, 2)</code> hoặc lưu số nguyên đơn vị nhỏ nhất (<code>Int64</code> xu)</td><td><code>Float64</code> (sai số)</td></tr>
      <tr><td>Chuỗi ít giá trị khác nhau (&lt; ~10k): country, event, status</td><td><code>LowCardinality(String)</code></td><td>String thuần</td></tr>
      <tr><td>Tập giá trị cố định, biết trước</td><td><code>Enum8</code> hoặc LowCardinality</td><td>—</td></tr>
      <tr><td>Thời gian</td><td><code>DateTime</code> (giây), <code>DateTime64(3)</code> (ms), <code>Date</code></td><td>Lưu chuỗi ISO</td></tr>
      <tr><td>Thiếu giá trị</td><td>Giá trị mặc định (0, '') nếu nghiệp vụ cho phép</td><td><code>Nullable</code> tràn lan</td></tr>
      <tr><td>UUID</td><td><code>UUID</code> (16 byte)</td><td>String 36 ký tự</td></tr>
    </table>

    <p><strong>LowCardinality(T)</strong> lưu dictionary các giá trị khác nhau + cột chỉ số nhỏ. Lọc/GROUP BY làm trên chỉ số nên nhanh, lại nén rất tốt.
    Không nên dùng khi cột có hàng triệu giá trị khác nhau (URL, email).</p>

    <p><strong>Nullable(T)</strong> thêm một cột ẩn <code>null map</code> (UInt8 mỗi hàng) và làm chậm xử lý; không dùng được trong primary key (trừ khi bật <code>allow_nullable_key</code>).</p>

    <p><strong>Codec nén</strong>: mặc định nén bằng <code>LZ4</code> (ClickHouse Cloud dùng ZSTD). Có thể chỉ định theo cột, xếp chuỗi: codec chuyên dụng trước rồi codec chung.</p>
    <ul>
      <li><code>Delta</code>: lưu hiệu giữa hai giá trị liên tiếp — tốt cho số tăng dần (id, timestamp).</li>
      <li><code>DoubleDelta</code>: hiệu của hiệu — timestamp đều đặn (mỗi 10 giây) gần như về 0.</li>
      <li><code>Gorilla</code>: cho số thực biến đổi chậm (gauge, nhiệt độ).</li>
      <li><code>T64</code>: cắt bỏ bit cao không dùng của số nguyên.</li>
      <li><code>ZSTD(level)</code>: nén chung, tỷ lệ cao hơn LZ4, giải nén chậm hơn một chút. <code>LZ4</code>: nhanh nhất.</li>
    </ul>

    <div class="callout"><p>💡 Quy trình thực tế: tạo bảng với kiểu hợp lý, nạp dữ liệu thật, xem <code>system.columns</code> cột nào to nhất, chỉ thêm codec cho vài cột đó rồi đo lại.
    Đừng thêm codec theo cảm tính cho mọi cột.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① DDL tốt", lines: [
      "CREATE TABLE app_events",
      "(",
      "    ts          DateTime64(3)          CODEC(DoubleDelta, ZSTD(1)),",
      "    event_id    UUID,",
      "    user_id     UInt64                 CODEC(T64, ZSTD(1)),",
      "    platform    LowCardinality(String),        -- ios/android/web",
      "    event       LowCardinality(String),",
      "    country     LowCardinality(FixedString(2)),",
      "    amount      Decimal(18, 2),",
      "    latency_ms  UInt32                 CODEC(ZSTD(3)),",
      "    props       String                 CODEC(ZSTD(3)) -- JSON thô",
      ")",
      "ENGINE = MergeTree",
      "ORDER BY (event, platform, ts);"
    ]},
    { id: "java", label: "② Java → CH", lines: [
      "// Java entity                     -> kiểu ClickHouse",
      "long id;                          // UInt64 (hoặc UInt32 nếu đủ)",
      "BigDecimal price;                 // Decimal(18, 2)",
      "String status;  // 5 giá trị      // LowCardinality(String) / Enum8",
      "Instant createdAt;                // DateTime64(3, 'UTC')",
      "UUID orderId;                     // UUID",
      "Integer discount; // có thể null  // UInt32 DEFAULT 0 (tránh Nullable)",
      "boolean paid;                     // Bool (thực chất UInt8)"
    ]},
    { id: "measure", label: "③ Đo", lines: [
      "SELECT name, type,",
      "       formatReadableSize(data_compressed_bytes)   AS nen,",
      "       formatReadableSize(data_uncompressed_bytes) AS goc,",
      "       round(data_uncompressed_bytes / data_compressed_bytes, 1) AS ty_le",
      "FROM system.columns",
      "WHERE table = 'app_events'",
      "ORDER BY data_compressed_bytes DESC;"
    ]},
    { id: "alter", label: "④ Đổi codec", lines: [
      "ALTER TABLE app_events MODIFY COLUMN props String CODEC(ZSTD(6));",
      "-- chỉ áp dụng cho part MỚI; part cũ đổi dần khi merge",
      "",
      "ALTER TABLE app_events MODIFY COLUMN platform LowCardinality(String);",
      "-- đổi kiểu = mutation, viết lại cột trong mọi part (bài 18)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="raw"><div class="nl">📄 Cột platform (String)</div><div class="ns">'android','ios','android','web',...</div></div>
    <div class="arrow" id="a1">↓ LowCardinality</div>
    <div class="row">
      <div class="node" id="dict"><div class="nl">📖 Dictionary</div><div class="ns">0=android 1=ios 2=web</div></div>
      <div class="node" id="keys"><div class="nl">🔢 Chỉ số UInt8</div><div class="ns">0,1,0,2,...</div></div>
    </div>
    <div class="arrow" id="a2">↓ codec chuyên dụng → codec chung</div>
    <div class="node" id="codec"><div class="nl">🗜️ DoubleDelta → ZSTD</div><div class="ns">ts đều đặn gần như về 0</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="disk"><div class="nl">💾 Ít byte hơn = query nhanh hơn</div></div>
  `,
  steps: [
    { title: "1 · Kiểu nhỏ nhất đủ dùng", tab: "java", highlight: [2, 3, 4, 5, 7], on: ["raw"],
      desc: "Map entity Java sang ClickHouse: long không tự động thành Int64, BigDecimal thành Decimal, Integer nullable thành UInt32 DEFAULT 0." },
    { title: "2 · LowCardinality", tab: "ddl", highlight: [6, 7, 8], on: ["a1", "dict", "keys"],
      desc: "Lưu dictionary + chỉ số nhỏ. GROUP BY/lọc chạy trên chỉ số, nhanh và nén tốt." },
    { title: "3 · Codec theo cột", tab: "ddl", highlight: [3, 5, 10, 11], on: ["a2", "codec"],
      desc: "DoubleDelta cho timestamp đều đặn, T64 cho số nguyên, ZSTD cho chuỗi dài. Codec chuyên dụng đứng trước codec chung." },
    { title: "4 · Đo trước khi tối ưu", tab: "measure", highlight: [2, 3, 4, 7], on: ["disk"],
      desc: "Tìm cột chiếm nhiều dung lượng nhất rồi mới chỉnh — thường là 1–2 cột String lớn." },
    { title: "5 · Đổi codec/kiểu sau này", tab: "alter", highlight: [1, 2, 4, 5], on: ["disk"],
      desc: "Đổi codec chỉ ảnh hưởng part mới; đổi kiểu cột là mutation viết lại dữ liệu — tốn kém trên bảng lớn." }
  ],

  quiz: [
    { q: "LowCardinality(String) phù hợp nhất với cột nào?", options: [
        "URL đầy đủ", "Email user", "Mã quốc gia / tên sự kiện / platform", "Nội dung bình luận"
      ], correct: 2, explanation: "Ít giá trị khác nhau (thường dưới ~10 nghìn) thì dictionary nhỏ và hiệu quả." },
    { q: "Vì sao nên tránh Nullable khi có thể?", options: [
        "Không thể lưu NULL",
        "Nó thêm cột null map và làm chậm xử lý; không dùng được trong khoá sắp xếp mặc định",
        "Nó làm mất dữ liệu",
        "Vì chỉ hỗ trợ String"
      ], correct: 1, explanation: "Nếu nghiệp vụ chấp nhận, dùng giá trị mặc định như 0 hoặc chuỗi rỗng." },
    { q: "Codec Delta phù hợp với dữ liệu nào?", options: [
        "Chuỗi JSON",
        "Số tăng dần đều như id, timestamp",
        "Số ngẫu nhiên",
        "UUID"
      ], correct: 1, explanation: "Hiệu giữa các giá trị liên tiếp nhỏ nên nén tốt." },
    { q: "Thứ tự đúng khi ghép codec là?", options: [
        "ZSTD trước, Delta sau",
        "Codec chuyên dụng (Delta, DoubleDelta, Gorilla, T64) trước, codec chung (LZ4/ZSTD) sau",
        "Không được ghép",
        "Tuỳ ý, kết quả như nhau"
      ], correct: 1, explanation: "Codec chuyên dụng biến đổi dữ liệu cho dễ nén, codec chung nén kết quả đó." },
    { q: "Kiểu nào hợp cho tiền tệ?", options: [
        "Float64", "Decimal(18, 2) hoặc Int64 theo đơn vị nhỏ nhất", "String", "Float32"
      ], correct: 1, explanation: "Float có sai số làm tròn." },
    { q: "Codec nén mặc định của ClickHouse open-source là gì?", options: ["ZSTD", "LZ4", "Gzip", "Không nén"], correct: 1,
      explanation: "LZ4 mặc định vì giải nén rất nhanh; ClickHouse Cloud mặc định ZSTD." },
    { q: "ALTER ... MODIFY COLUMN đổi codec có viết lại dữ liệu cũ ngay không?", options: [
        "Có, ngay lập tức",
        "Không; part mới dùng codec mới, part cũ đổi dần khi được merge",
        "Chỉ khi restart",
        "Không bao giờ đổi"
      ], correct: 1, explanation: "Muốn áp dụng ngay cho part cũ phải ép merge/materialize." },
    { q: "Codec Gorilla thiết kế cho dữ liệu nào?", options: [
        "Số thực biến đổi chậm (gauge, metrics)", "Chuỗi", "UUID", "Enum"
      ], correct: 0, explanation: "Dựa trên XOR giữa các giá trị float liên tiếp (bài báo Gorilla của Facebook)." },
    { q: "Làm sao biết cột nào chiếm dung lượng lớn nhất?", options: [
        "du -sh thư mục bảng",
        "Truy vấn system.columns (data_compressed_bytes / data_uncompressed_bytes)",
        "SHOW TABLES",
        "system.merges"
      ], correct: 1, explanation: "system.columns có số liệu theo từng cột." }
  ]
});
