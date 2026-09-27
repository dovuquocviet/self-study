window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "MergeTree sâu",
  title: "Skip index: minmax, set, bloom_filter — bỏ qua granule, không phải tìm hàng",
  subtitle: "data skipping index · GRANULARITY · khi nào có ích, khi nào chỉ tốn tiền",

  theory: `
    <p>Primary key chỉ giúp với cột đầu của ORDER BY. Lọc theo cột khác (ví dụ <code>order_id</code> trong bảng sort theo <code>tenant_id, ts</code>) sẽ phải quét toàn bảng.
    <strong>Skip index</strong> (data skipping index) lưu một bản tóm tắt nhỏ cho mỗi nhóm granule; khi query, ClickHouse đọc tóm tắt để <em>bỏ qua</em> nhóm chắc chắn không chứa giá trị cần tìm.</p>

    <p>Đừng nghĩ nó là B-tree index như Postgres: nó không trỏ tới hàng, chỉ trả lời "khối này <em>có thể</em> chứa hay <em>chắc chắn không</em> chứa".</p>

    <table>
      <tr><th>Loại</th><th>Tóm tắt lưu</th><th>Hợp với</th></tr>
      <tr><td><code>minmax</code></td><td>min và max của biểu thức</td><td>Cột tương quan với thứ tự sort (vd <code>created_at</code> khi sort theo <code>order_id</code> tăng dần)</td></tr>
      <tr><td><code>set(N)</code></td><td>Tập giá trị khác nhau (tối đa N; vượt thì bỏ)</td><td>Cột ít giá trị trong mỗi khối (status, error_code)</td></tr>
      <tr><td><code>bloom_filter(p)</code></td><td>Bloom filter, sai dương tính xác suất p (mặc định 0.025)</td><td>Tìm <code>=</code> / <code>IN</code> trên cột cardinality cao: trace_id, order_id</td></tr>
      <tr><td><code>tokenbf_v1</code>, <code>ngrambf_v1</code></td><td>Bloom filter trên token/n-gram</td><td>Tìm từ trong log (<code>hasToken</code>, <code>LIKE</code>)</td></tr>
      <tr><td><code>text</code> (bản mới)</td><td>Inverted index full-text</td><td>Tìm kiếm văn bản — vẫn không thay Elasticsearch cho search có ranking</td></tr>
    </table>

    <p><strong>GRANULARITY N</strong>: một entry của skip index bao phủ N granule của bảng (N × 8192 hàng). Bản mới mặc định N = 1.</p>

    <p><strong>Khi nào skip index vô dụng?</strong> Khi giá trị cần tìm rải khắp mọi granule. Ví dụ bloom_filter trên <code>country</code>: mọi khối đều có 'VN' ⇒ không bỏ được khối nào,
    lại tốn thêm công đọc index. Skip index chỉ hiệu quả khi giá trị <strong>tập trung</strong> ở ít khối.</p>

    <div class="callout"><p>💡 Thứ tự ưu tiên: (1) ORDER BY đúng; (2) projection hoặc bảng phụ qua MV nếu là truy vấn thường xuyên; (3) skip index cho tra cứu "kim đáy bể" như tìm theo trace_id.
    Luôn đo bằng <code>EXPLAIN indexes = 1</code> — nếu Granules không giảm thì xoá index đi.</p></div>
  `,

  codeTabs: [
    { id: "add", label: "① Thêm index", lines: [
      "ALTER TABLE logs ADD INDEX idx_trace trace_id TYPE bloom_filter(0.01) GRANULARITY 1;",
      "ALTER TABLE logs ADD INDEX idx_status status TYPE set(100) GRANULARITY 4;",
      "ALTER TABLE logs ADD INDEX idx_msg message TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1;",
      "",
      "-- index chỉ tự tạo cho part MỚI; dựng cho part cũ:",
      "ALTER TABLE logs MATERIALIZE INDEX idx_trace;   -- là mutation"
    ]},
    { id: "ddl", label: "② Trong DDL", lines: [
      "CREATE TABLE logs",
      "(",
      "    ts        DateTime64(3),",
      "    service   LowCardinality(String),",
      "    level     LowCardinality(String),",
      "    trace_id  String,",
      "    status    UInt16,",
      "    message   String,",
      "    INDEX idx_trace trace_id TYPE bloom_filter(0.01) GRANULARITY 1",
      ")",
      "ENGINE = MergeTree",
      "ORDER BY (service, ts);"
    ]},
    { id: "explain", label: "③ Đo hiệu quả", lines: [
      "EXPLAIN indexes = 1",
      "SELECT * FROM logs WHERE trace_id = '4bf92f3577b34da6';",
      "",
      "-- PrimaryKey    Condition: true           Granules: 50000/50000",
      "-- Skip",
      "--   Name: idx_trace",
      "--   Description: bloom_filter GRANULARITY 1",
      "--   Parts: 2/40",
      "--   Granules: 3/50000                     <- bỏ được 99.99%"
    ]},
    { id: "bad", label: "④ Index vô dụng", lines: [
      "ALTER TABLE logs ADD INDEX idx_level level TYPE bloom_filter GRANULARITY 1;",
      "",
      "EXPLAIN indexes = 1 SELECT count() FROM logs WHERE level = 'ERROR';",
      "-- Skip  Name: idx_level  Granules: 49870/50000   <- gần như không bỏ được",
      "-- => ERROR có mặt ở hầu hết khối; xoá index:",
      "ALTER TABLE logs DROP INDEX idx_level;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔎 WHERE trace_id = '4bf9…'</div><div class="ns">trace_id không nằm trong ORDER BY</div></div>
    <div class="arrow" id="a1">↓ primary key không giúp được</div>
    <div class="node" id="pk"><div class="nl">🔑 Primary: 50000/50000 granule</div></div>
    <div class="arrow" id="a2">↓ hỏi bloom filter từng khối</div>
    <div class="row">
      <div class="node" id="no"><div class="nl">❌ "chắc chắn không"</div><div class="ns">49997 khối bị bỏ</div></div>
      <div class="node" id="maybe"><div class="nl">❓ "có thể có"</div><div class="ns">3 khối</div></div>
    </div>
    <div class="arrow" id="a3">↓ chỉ đọc 3 granule</div>
    <div class="node" id="res"><div class="nl">✅ 1 hàng khớp</div><div class="ns">2 khối là sai dương tính</div></div>
  `,
  steps: [
    { title: "1 · Primary key bất lực", tab: "ddl", highlight: [6, 12], on: ["q", "a1", "pk"],
      desc: "Bảng sort theo (service, ts); lọc theo trace_id sẽ quét toàn bộ nếu không có gì khác." },
    { title: "2 · Khai báo bloom_filter", tab: "ddl", highlight: [9], on: ["pk"],
      desc: "Mỗi granule có một bloom filter nhỏ cho các trace_id trong đó, sai dương tính 1%." },
    { title: "3 · Bỏ qua khối chắc chắn không chứa", tab: "explain", highlight: [4, 6, 9], on: ["a2", "no", "maybe"],
      desc: "Bloom filter không bao giờ sai âm tính: nói 'không' là chắc chắn không. Chỉ những khối 'có thể' mới được đọc." },
    { title: "4 · Đọc và lọc chính xác", tab: "explain", highlight: [8, 9], on: ["a3", "res"],
      desc: "3 granule được đọc; hàng thật được lọc bằng so sánh chính xác, sai dương tính chỉ tốn chút I/O." },
    { title: "5 · Index cho part cũ và index vô dụng", tab: "bad", highlight: [4, 6], on: ["no"],
      desc: "Giá trị có mặt khắp nơi thì index không bỏ được gì. Đo, rồi DROP INDEX. Nhớ MATERIALIZE INDEX cho dữ liệu cũ khi thêm index mới." }
  ],

  quiz: [
    { q: "Skip index trả lời câu hỏi gì?", options: [
        "Hàng nào khớp điều kiện",
        "Khối granule nào chắc chắn KHÔNG chứa giá trị, để bỏ qua",
        "Giá trị nào là duy nhất",
        "Thứ tự sắp xếp"
      ], correct: 1, explanation: "Nó chỉ loại trừ khối; không trỏ tới hàng như B-tree." },
    { q: "Loại skip index hợp để tìm trace_id (cardinality rất cao) bằng '='?", options: ["minmax", "set(100)", "bloom_filter", "Không loại nào"], correct: 2,
      explanation: "Bloom filter trả lời nhanh 'chắc chắn không có' cho tập lớn." },
    { q: "Bloom filter bị sai theo kiểu nào?", options: [
        "Sai âm tính (nói không có nhưng thật ra có)",
        "Sai dương tính (nói có thể có nhưng thật ra không)",
        "Cả hai",
        "Không bao giờ sai"
      ], correct: 1, explanation: "Sai dương tính chỉ khiến đọc thừa, không làm mất kết quả." },
    { q: "Vì sao bloom_filter trên cột level ('INFO','ERROR') gần như vô dụng?", options: [
        "Vì cột là LowCardinality",
        "Vì giá trị xuất hiện ở hầu hết khối nên không bỏ được khối nào",
        "Vì bloom filter không hỗ trợ String",
        "Vì cần GRANULARITY 100"
      ], correct: 1, explanation: "Skip index chỉ hiệu quả khi giá trị tập trung ở ít khối." },
    { q: "minmax index hiệu quả khi nào?", options: [
        "Cột ngẫu nhiên hoàn toàn",
        "Cột có tương quan với thứ tự sắp xếp (giá trị gần nhau nằm gần nhau)",
        "Cột String dài",
        "Cột Nullable"
      ], correct: 1, explanation: "Nếu mỗi khối có khoảng min–max hẹp thì dễ loại trừ." },
    { q: "GRANULARITY 4 trong định nghĩa skip index nghĩa là?", options: [
        "Index có 4 mức",
        "Mỗi entry index bao phủ 4 granule của bảng",
        "Mỗi granule 4 hàng",
        "4 bloom filter mỗi hàng"
      ], correct: 1, explanation: "Entry to hơn thì index nhỏ hơn nhưng loại trừ thô hơn." },
    { q: "Thêm skip index bằng ALTER ADD INDEX, dữ liệu cũ thì sao?", options: [
        "Tự động có index ngay",
        "Chỉ part mới có; cần ALTER TABLE ... MATERIALIZE INDEX để dựng cho part cũ",
        "Dữ liệu cũ bị xoá",
        "Phải tạo lại bảng"
      ], correct: 1, explanation: "MATERIALIZE INDEX chạy như một mutation." },
    { q: "tokenbf_v1 dùng cho trường hợp nào?", options: [
        "Tìm từ trong chuỗi log (hasToken, LIKE theo từ)",
        "Tìm khoảng số",
        "Kiểm tra duy nhất",
        "JOIN"
      ], correct: 0, explanation: "Bloom filter trên các token tách từ chuỗi." },
    { q: "Thứ tự ưu tiên hợp lý khi tối ưu lọc theo một cột?", options: [
        "Skip index trước mọi thứ",
        "ORDER BY đúng → projection/bảng phụ qua MV → skip index cho tra cứu hiếm, kim đáy bể",
        "Thêm Nullable",
        "Tăng index_granularity"
      ], correct: 1, explanation: "Skip index là công cụ bổ sung, không thay thiết kế khoá." }
  ]
});
