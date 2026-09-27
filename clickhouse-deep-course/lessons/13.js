window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Ingest",
  title: "Materialized view: trigger khi insert & refreshable MV",
  subtitle: "MV chỉ thấy block vừa insert · TO bảng đích · chuỗi MV · REFRESH EVERY",

  theory: `
    <p>Materialized view của ClickHouse <strong>khác hẳn</strong> MV của Postgres. Postgres MV = kết quả query lưu lại, <code>REFRESH</code> để chạy lại toàn bộ.
    ClickHouse MV (incremental) = <strong>trigger AFTER INSERT</strong>: mỗi khi có block insert vào bảng nguồn, câu SELECT của MV chạy <em>trên đúng block đó</em>
    và ghi kết quả vào bảng đích.</p>

    <p><strong>Hệ quả quan trọng</strong></p>
    <ol>
      <li>MV <strong>chỉ thấy dữ liệu mới insert</strong>. Tạo MV khi bảng nguồn đã có dữ liệu ⇒ dữ liệu cũ không được xử lý (phải backfill bằng INSERT … SELECT).</li>
      <li><code>GROUP BY</code> trong MV chỉ gom <em>trong một block</em>. Vì thế bảng đích phải là Summing/AggregatingMergeTree để gom tiếp giữa các block.</li>
      <li>MV không phản ánh DELETE/UPDATE/DROP PARTITION ở bảng nguồn.</li>
      <li>Trigger chỉ gắn với bảng <em>đầu tiên</em> trong FROM. JOIN trong MV: insert vào bảng bị JOIN không kích hoạt MV.</li>
      <li>Nên dùng cú pháp <code>TO bảng_đích</code> (tự quản lý bảng đích) thay vì để MV tự tạo bảng ẩn <code>.inner</code>. Tránh <code>POPULATE</code> (bỏ sót dữ liệu insert trong lúc populate).</li>
      <li>MV chạy đồng bộ trong luồng insert: MV lỗi ⇒ INSERT báo lỗi (dù bảng nguồn có thể đã ghi). Nhiều MV/chuỗi MV làm insert chậm hơn.</li>
    </ol>

    <p>Bảng nguồn có thể dùng engine <code>Null</code>: dữ liệu đi qua để kích hoạt MV rồi bị bỏ, không lưu thô — hợp khi chỉ cần bảng tổng hợp.</p>

    <p><strong>Refreshable MV</strong> (<code>REFRESH EVERY 1 HOUR</code>): giống Postgres MV hơn — chạy lại toàn bộ query theo lịch, thay thế nội dung bảng đích một cách nguyên tử
    (hoặc <code>APPEND</code> để nối thêm). Dùng khi query cần JOIN nhiều bảng, cần xử lý cả dữ liệu cũ, hoặc kết quả nhỏ (top-N, bảng tra cứu).
    Xem trạng thái ở <code>system.view_refreshes</code>, chạy tay bằng <code>SYSTEM REFRESH VIEW</code>.</p>

    <div class="callout"><p>💡 Tương đương Spring: MV incremental giống <code>@TransactionalEventListener</code> xử lý từng sự kiện lưu — rẻ nhưng chỉ thấy sự kiện mới.
    Refreshable MV giống <code>@Scheduled</code> job tính lại toàn bộ — tốn hơn nhưng nhìn thấy mọi thứ.</p></div>
  `,

  codeTabs: [
    { id: "mv", label: "① MV incremental", lines: [
      "CREATE TABLE revenue_daily",
      "(",
      "    day Date, tenant_id UInt32, orders UInt64, revenue Decimal(18, 2)",
      ")",
      "ENGINE = SummingMergeTree",
      "ORDER BY (tenant_id, day);",
      "",
      "CREATE MATERIALIZED VIEW mv_revenue_daily TO revenue_daily AS",
      "SELECT toDate(created_at) AS day, tenant_id,",
      "       count() AS orders, sum(amount) AS revenue",
      "FROM order_events",
      "WHERE event_type = 'PAID'",
      "GROUP BY day, tenant_id;"
    ]},
    { id: "flow", label: "② Chạy khi insert", lines: [
      "INSERT INTO order_events VALUES (...), (...), (...);   -- block 3 hàng",
      "",
      "-- ClickHouse làm tương đương:",
      "--   1. ghi block vào order_events",
      "--   2. chạy SELECT của mv_revenue_daily trên CHỈ 3 hàng này",
      "--   3. INSERT kết quả vào revenue_daily (tạo part mới)",
      "",
      "SELECT day, sum(orders), sum(revenue)       -- đọc vẫn phải gom",
      "FROM revenue_daily WHERE tenant_id = 7 GROUP BY day;"
    ]},
    { id: "backfill", label: "③ Backfill", lines: [
      "-- MV mới chỉ thấy insert từ giờ trở đi. Dữ liệu cũ:",
      "INSERT INTO revenue_daily",
      "SELECT toDate(created_at), tenant_id, count(), sum(amount)",
      "FROM order_events",
      "WHERE event_type = 'PAID' AND created_at < '2024-09-27 00:00:00'",
      "GROUP BY 1, 2;",
      "-- chọn mốc cẩn thận để không đếm trùng phần MV đã xử lý"
    ]},
    { id: "refresh", label: "④ Refreshable", lines: [
      "CREATE MATERIALIZED VIEW mv_top_products",
      "REFRESH EVERY 1 HOUR",
      "TO top_products AS",
      "SELECT p.product_id, any(p.name) AS name, sum(o.qty) AS sold",
      "FROM order_items AS o",
      "JOIN products AS p ON p.product_id = o.product_id",
      "WHERE o.created_at >= now() - INTERVAL 7 DAY",
      "GROUP BY p.product_id ORDER BY sold DESC LIMIT 100;",
      "",
      "SYSTEM REFRESH VIEW mv_top_products;       -- chạy ngay",
      "SELECT view, status, last_success_time FROM system.view_refreshes;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ins"><div class="nl">📥 INSERT block → order_events</div></div>
    <div class="arrow" id="a1">↓ trigger (đồng bộ, cùng luồng insert)</div>
    <div class="node" id="mv"><div class="nl">⚙️ SELECT của MV</div><div class="ns">chỉ trên block vừa insert</div></div>
    <div class="arrow" id="a2">↓ INSERT vào bảng đích</div>
    <div class="node" id="dst"><div class="nl">📦 revenue_daily (Summing)</div><div class="ns">gom tiếp khi merge / khi đọc</div></div>
    <div class="arrow" id="a3">↓ khác: theo lịch</div>
    <div class="node" id="rmv"><div class="nl">⏰ Refreshable MV</div><div class="ns">chạy lại toàn bộ, thay nguyên tử</div></div>
  `,
  steps: [
    { title: "1 · Bảng đích + MV TO", tab: "mv", highlight: [5, 6, 8], on: ["dst"],
      desc: "Tự tạo bảng đích SummingMergeTree, MV chỉ là 'trigger' ghi vào đó." },
    { title: "2 · Insert kích hoạt MV", tab: "flow", highlight: [1, 4, 5, 6], on: ["ins", "a1", "mv"],
      desc: "SELECT của MV chạy trên đúng block vừa insert, không đọc lại bảng nguồn." },
    { title: "3 · Gom tiếp ở bảng đích", tab: "flow", highlight: [8, 9], on: ["a2", "dst"],
      desc: "Mỗi block tạo vài hàng tổng hợp; Summing gộp khi merge, query sum() gộp nốt." },
    { title: "4 · Backfill dữ liệu cũ", tab: "backfill", highlight: [2, 5, 7], on: ["dst"],
      desc: "MV không nhìn quá khứ. Chọn mốc thời gian rõ ràng để không đếm trùng." },
    { title: "5 · Refreshable MV cho JOIN/toàn bộ", tab: "refresh", highlight: [2, 3, 6, 10, 11], on: ["a3", "rmv"],
      desc: "Chạy lại cả query mỗi giờ; hợp với kết quả nhỏ, cần JOIN hoặc cần thấy toàn bộ dữ liệu." }
  ],

  quiz: [
    { q: "Materialized view incremental của ClickHouse hoạt động thế nào?", options: [
        "Chạy lại toàn bộ query định kỳ",
        "Như trigger sau insert: chạy SELECT trên block vừa insert vào bảng nguồn, ghi kết quả sang bảng đích",
        "Là view ảo, không lưu gì",
        "Đọc WAL của bảng nguồn"
      ], correct: 1, explanation: "Khác hoàn toàn MV của Postgres." },
    { q: "Tạo MV trên bảng nguồn đã có 1 tỷ hàng. Bảng đích có gì?", options: [
        "Toàn bộ 1 tỷ hàng đã xử lý",
        "Không có gì cho dữ liệu cũ; chỉ dữ liệu insert sau khi tạo MV",
        "Một nửa",
        "Lỗi"
      ], correct: 1, explanation: "Phải backfill bằng INSERT … SELECT." },
    { q: "Vì sao bảng đích của MV có GROUP BY thường là Summing/AggregatingMergeTree?", options: [
        "Vì MV bắt buộc",
        "Vì GROUP BY trong MV chỉ gom trong từng block; cần engine gom tiếp giữa các block",
        "Để nén tốt hơn",
        "Để có FINAL"
      ], correct: 1, explanation: "Mỗi block tạo hàng tổng hợp riêng cho cùng khoá." },
    { q: "MV có SELECT ... FROM a JOIN b. Insert vào b có kích hoạt MV không?", options: [
        "Có", "Không; chỉ insert vào bảng đầu tiên (a) kích hoạt MV", "Chỉ khi b nhỏ", "Tuỳ engine"
      ], correct: 1, explanation: "Cần JOIN đầy đủ thì cân nhắc refreshable MV hoặc dictionary." },
    { q: "Xoá dữ liệu ở bảng nguồn (DELETE / DROP PARTITION) thì bảng đích MV?", options: [
        "Tự xoá tương ứng", "Không thay đổi", "Bị xoá toàn bộ", "Lỗi"
      ], correct: 1, explanation: "MV chỉ phản ứng với INSERT." },
    { q: "Vì sao nên dùng MV ... TO bảng_đích thay vì để MV tự tạo bảng ẩn?", options: [
        "Nhanh hơn",
        "Chủ động quản lý schema/engine bảng đích, dễ ALTER, backfill và thay MV mà không mất dữ liệu",
        "Bắt buộc",
        "Để dùng POPULATE"
      ], correct: 1, explanation: "Và tránh POPULATE vì có thể bỏ sót dữ liệu insert trong lúc populate." },
    { q: "Refreshable MV khác MV incremental ở điểm nào?", options: [
        "Không lưu kết quả",
        "Chạy lại toàn bộ query theo lịch (REFRESH EVERY), thay nội dung bảng đích nguyên tử hoặc APPEND",
        "Chạy trên từng block",
        "Chỉ đọc từ Kafka"
      ], correct: 1, explanation: "Phù hợp khi cần JOIN nhiều bảng hoặc nhìn toàn bộ dữ liệu." },
    { q: "Engine Null làm bảng nguồn để làm gì?", options: [
        "Lưu dữ liệu nén cao",
        "Cho dữ liệu đi qua kích hoạt MV rồi bỏ đi, không lưu dữ liệu thô",
        "Chặn insert",
        "Làm cache"
      ], correct: 1, explanation: "Hữu ích khi chỉ cần bảng tổng hợp." },
    { q: "MV bị lỗi (ví dụ lỗi chuyển kiểu) thì INSERT vào bảng nguồn?", options: [
        "Thành công bình thường, lỗi bị bỏ qua",
        "Báo lỗi cho client (mặc định), dù bảng nguồn có thể đã ghi — cần cẩn thận khi retry",
        "Tự retry",
        "Bị treo"
      ], correct: 1, explanation: "MV chạy đồng bộ trong luồng insert; materialized_views_ignore_errors có thể thay đổi hành vi này." }
  ]
});
