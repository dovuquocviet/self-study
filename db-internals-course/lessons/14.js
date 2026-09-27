window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Các mô hình dữ liệu",
  title: "Mô hình cột & OLAP — vì sao ClickHouse quét tỷ dòng trong vài giây",
  subtitle: "MergeTree: part, granule, sparse index · ORDER BY là quyết định lớn nhất · nén · vectorized · Kafka → ClickHouse",

  theory: `
    <p>Bài 06 cho thấy lưu theo cột giảm I/O. ClickHouse chồng thêm nhiều lớp để một truy vấn tổng hợp trên hàng tỷ dòng chỉ mất vài giây.</p>

    <p><strong>Cấu trúc MergeTree</strong></p>
    <ul>
      <li>Bảng = tập <strong>part</strong> bất biến (bài 05). Mỗi INSERT tạo một part; merge nền gộp part nhỏ thành part lớn.</li>
      <li>Trong mỗi part, dữ liệu được <strong>sắp xếp theo <code>ORDER BY</code></strong>; mỗi cột một file nén (<code>.bin</code>) + file mark (<code>.mrk</code>) chỉ vị trí từng granule.</li>
      <li><strong>Granule</strong> = 8192 dòng (mặc định) — đơn vị nhỏ nhất ClickHouse đọc. <code>primary.idx</code> lưu giá trị khoá ở đầu mỗi granule → sparse index nhỏ, nằm trong RAM.</li>
      <li><code>PARTITION BY</code> (thường theo tháng) chia part theo nhóm để xoá/di chuyển cả tháng rẻ, và bỏ qua partition không liên quan. Đừng partition quá mịn.</li>
    </ul>

    <p><strong>ORDER BY là quyết định thiết kế lớn nhất</strong>: nó vừa là thứ tự lưu, vừa là primary index. Đặt cột hay lọc bằng <code>=</code> và ít giá trị khác nhau lên trước
    (<code>tenant_id, event_type, ts</code>): truy vấn lọc theo chúng chỉ đọc vài granule, và dữ liệu sắp xếp tốt nén tốt hơn. Truy vấn không lọc theo tiền tố ORDER BY
    phải quét nhiều granule — lúc đó mới cần skip index hoặc projection/materialized view.</p>

    <p><strong>Vì sao nhanh — cộng dồn các lớp</strong></p>
    <ol>
      <li><strong>Chỉ đọc cột cần</strong> (column pruning).</li>
      <li><strong>Bỏ qua granule</strong> nhờ sparse primary index, partition pruning, skip index.</li>
      <li><strong>Nén</strong>: LZ4 mặc định, ZSTD và codec chuyên dụng (Delta, DoubleDelta, Gorilla, <code>LowCardinality</code>) → ít byte từ đĩa.</li>
      <li><strong>Vectorized execution</strong>: xử lý theo block (~65 nghìn dòng) trên mảng cột liên tục; vòng lặp chặt, dùng SIMD, ít rẽ nhánh, ít gọi hàm ảo mỗi dòng.</li>
      <li><strong>Song song</strong>: chia granule cho mọi core; phân tán qua nhiều shard.</li>
    </ol>

    <p><strong>Cái giá</strong></p>
    <ul>
      <li>UPDATE/DELETE là <em>mutation</em> chạy nền, viết lại part — dùng hiếm. Có lightweight DELETE nhưng vẫn không phải OLTP.</li>
      <li>Không có unique constraint. <code>ReplacingMergeTree</code> khử trùng lặp theo ORDER BY <em>khi merge</em> — tức là cuối cùng mới đúng; muốn chính xác ngay khi đọc phải dùng <code>FINAL</code> hoặc gom nhóm.</li>
      <li>Insert phải theo batch (bài 05: Too many parts).</li>
    </ul>

    <p><strong>Kafka → ClickHouse</strong> (kiến trúc công ty): bảng <code>ENGINE = Kafka</code> là consumer; một <em>materialized view</em> đọc từ nó và INSERT vào bảng MergeTree
    theo lô. Kafka giao at-least-once → có thể trùng → hay dùng ReplacingMergeTree hoặc khử trùng lặp khi truy vấn.</p>

    <div class="callout"><p>💡 Với dev Java: vectorized giống khác biệt giữa gọi <code>stream().map()</code> cho từng object boxed và một vòng <code>for</code> trên <code>long[]</code>
    mà JIT tự dùng SIMD. Cùng phép tính, nhưng một bên thân thiện với cache CPU hơn hàng chục lần.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "Thiết kế bảng", lines: [
      "CREATE TABLE events (",
      "    tenant_id  UInt32,",
      "    event_type LowCardinality(String),",
      "    ts         DateTime CODEC(Delta, ZSTD),",
      "    user_id    UInt64,",
      "    amount     Decimal(18, 2)",
      ")",
      "ENGINE = MergeTree",
      "PARTITION BY toYYYYMM(ts)",
      "ORDER BY (tenant_id, event_type, ts);     -- thứ tự lưu = primary index thưa",
      "",
      "-- part trên đĩa: tenant_id.bin, event_type.bin, ts.bin, ... + .mrk, primary.idx"
    ]},
    { id: "query", label: "Truy vấn nhanh", lines: [
      "SELECT toDate(ts) AS d, sum(amount)",
      "FROM events",
      "WHERE tenant_id = 7 AND event_type = 'purchase'",
      "  AND ts >= '2026-09-01'",
      "GROUP BY d ORDER BY d;",
      "",
      "-- 1. partition pruning: chỉ part của 2026-09",
      "-- 2. primary.idx: chỉ granule có (7, 'purchase', ts >= ...)",
      "-- 3. chỉ đọc 4 cột: tenant_id, event_type, ts, amount",
      "-- 4. giải nén + tính sum theo block, song song trên mọi core"
    ]},
    { id: "kafka", label: "Kafka → ClickHouse", lines: [
      "CREATE TABLE events_queue (...) ENGINE = Kafka",
      "SETTINGS kafka_broker_list = 'kafka:9092',",
      "         kafka_topic_list  = 'events',",
      "         kafka_group_name  = 'clickhouse-events',",
      "         kafka_format      = 'JSONEachRow';",
      "",
      "CREATE MATERIALIZED VIEW events_mv TO events AS",
      "SELECT tenant_id, event_type, ts, user_id, amount FROM events_queue;",
      "",
      "-- consumer group riêng → offset riêng, không ảnh hưởng consumer khác"
    ]},
    { id: "dedup", label: "Trùng lặp & mutation", lines: [
      "CREATE TABLE orders_latest (",
      "    order_id UInt64, status LowCardinality(String), version UInt64, ...",
      ") ENGINE = ReplacingMergeTree(version)",
      "ORDER BY order_id;",
      "",
      "-- trước khi merge có thể còn nhiều bản cùng order_id:",
      "SELECT * FROM orders_latest FINAL WHERE order_id = 1001;   -- khử lúc đọc (đắt hơn)",
      "",
      "-- mutation: viết lại part, chạy nền — không dùng cho luồng thường xuyên",
      "ALTER TABLE events DELETE WHERE tenant_id = 99;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ sum(amount) theo ngày, tenant 7</div><div class="ns">bảng 5 tỷ dòng</div></div>
    <div class="arrow" id="a1">↓ partition pruning</div>
    <div class="node" id="part"><div class="nl">📁 Chỉ part tháng 2026-09</div><div class="ns">bỏ 95% part</div></div>
    <div class="arrow" id="a2">↓ primary.idx (sparse)</div>
    <div class="node" id="gran"><div class="nl">🧱 Vài trăm granule × 8192 dòng</div><div class="ns">bỏ phần còn lại</div></div>
    <div class="arrow" id="a3">↓ chỉ 4 file cột, giải nén LZ4/ZSTD</div>
    <div class="node" id="vec"><div class="nl">⚙️ Vectorized + mọi core</div><div class="ns">block ~65k dòng, SIMD</div></div>
  `,
  steps: [
    { title: "1 · Thiết kế ORDER BY & PARTITION", tab: "ddl", highlight: [3, 4, 9, 10], on: ["q"],
      desc: "ORDER BY vừa là thứ tự lưu vừa là index thưa. LowCardinality và codec Delta giúp nén." },
    { title: "2 · Bỏ partition không liên quan", tab: "query", highlight: [4, 7], on: ["a1", "part"],
      desc: "Điều kiện trên ts cho phép loại mọi part không thuộc tháng 9." },
    { title: "3 · Bỏ granule nhờ sparse index", tab: "query", highlight: [3, 8], on: ["a2", "gran"],
      desc: "Điều kiện trùng tiền tố ORDER BY → chỉ đọc vài granule." },
    { title: "4 · Chỉ đọc cột cần, đã nén", tab: "query", highlight: [9], on: ["a3"],
      desc: "4 trên hàng chục cột; mỗi cột nén tốt vì đã sắp xếp." },
    { title: "5 · Vectorized & song song", tab: "query", highlight: [10], on: ["vec"],
      desc: "Xử lý theo block trên mảng liên tục, chia cho mọi core." },
    { title: "6 · Nạp từ Kafka", tab: "kafka", highlight: [1, 4, 7, 8, 10], on: ["q"],
      desc: "Kafka engine + materialized view: ClickHouse là một consumer group độc lập." },
    { title: "7 · Trùng lặp và sửa dữ liệu", tab: "dedup", highlight: [3, 7, 10], on: ["gran"],
      desc: "ReplacingMergeTree khử trùng khi merge (cuối cùng mới đúng); mutation viết lại part — hiếm dùng." }
  ],

  quiz: [
    { q: "Granule trong ClickHouse mặc định bao nhiêu dòng?", options: ["1", "1024", "8192", "1 triệu"], correct: 2,
      explanation: "index_granularity = 8192; là đơn vị đọc nhỏ nhất." },
    { q: "ORDER BY trong bảng MergeTree quyết định gì?", options: [
        "Chỉ thứ tự kết quả trả về",
        "Thứ tự lưu dữ liệu trong part và primary index thưa",
        "Số shard",
        "Thời gian TTL"
      ], correct: 1, explanation: "Đây là quyết định thiết kế quan trọng nhất của bảng." },
    { q: "Nên đặt cột nào lên đầu ORDER BY?", options: [
        "Cột ngẫu nhiên nhất như UUID",
        "Cột hay lọc bằng '=' và có ít giá trị khác nhau (tenant, loại sự kiện)",
        "Cột text dài",
        "Không quan trọng"
      ], correct: 1, explanation: "Vừa lọc tốt, vừa nén tốt." },
    { q: "Điều nào KHÔNG phải lý do ClickHouse nhanh cho OLAP?", options: [
        "Chỉ đọc cột cần",
        "Vectorized execution",
        "Transaction serializable nhiều câu lệnh",
        "Bỏ qua granule nhờ sparse index"
      ], correct: 2, explanation: "ClickHouse không có transaction OLTP nhiều câu lệnh." },
    { q: "ReplacingMergeTree khử bản ghi trùng khi nào?", options: [
        "Ngay lúc INSERT",
        "Khi merge nền gộp part (không đảm bảo thời điểm); muốn chắc khi đọc dùng FINAL",
        "Không bao giờ",
        "Khi backup"
      ], correct: 1, explanation: "Cuối cùng mới đúng (eventually)." },
    { q: "ALTER TABLE ... DELETE trong ClickHouse là gì?", options: [
        "Xoá tức thì một dòng như PostgreSQL",
        "Mutation chạy nền, viết lại các part bị ảnh hưởng",
        "Không được hỗ trợ",
        "Chỉ xoá index"
      ], correct: 1, explanation: "Đắt; không dùng cho luồng thường xuyên." },
    { q: "Vectorized execution nghĩa là?", options: [
        "Dùng GPU",
        "Xử lý theo block nhiều dòng trên mảng cột liên tục, tận dụng SIMD và cache CPU",
        "Chuyển SQL thành vector embedding",
        "Chạy từng dòng một"
      ], correct: 1, explanation: "Giảm chi phí mỗi dòng." },
    { q: "Trong kiến trúc Kafka → ClickHouse bằng Kafka engine, thành phần nào ghi vào bảng MergeTree?", options: [
        "Bảng Kafka tự ghi",
        "Materialized view đọc từ bảng Kafka và INSERT vào bảng đích",
        "Producer",
        "ZooKeeper"
      ], correct: 1, explanation: "MV TO events kích hoạt với mỗi lô message." },
    { q: "Vì sao cần cân nhắc khử trùng lặp khi nạp từ Kafka?", options: [
        "Kafka nén dữ liệu",
        "Giao hàng thường là at-least-once nên message có thể đến hơn một lần",
        "ClickHouse tự nhân bản dòng",
        "Không cần"
      ], correct: 1, explanation: "Dùng ReplacingMergeTree hoặc khoá idempotent." },
    { q: "PARTITION BY quá mịn (vd theo giờ cho nhiều năm) gây gì?", options: [
        "Tăng tốc mọi thứ",
        "Quá nhiều part/partition, merge kém hiệu quả, truy vấn phải mở nhiều file",
        "Không ảnh hưởng",
        "Mất dữ liệu"
      ], correct: 1, explanation: "Thường theo tháng hoặc ngày là đủ." }
  ]
});
