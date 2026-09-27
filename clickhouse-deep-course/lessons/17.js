window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Truy vấn",
  title: "Tối ưu query: EXPLAIN, system.query_log và các đòn bẩy chính",
  subtitle: "đọc ít hơn là nhanh hơn · EXPLAIN indexes/PIPELINE · PREWHERE · tìm query tệ nhất",

  theory: `
    <p>Gần như mọi tối ưu ở ClickHouse quy về một câu: <strong>đọc ít byte hơn</strong>. Thứ tự kiểm tra:</p>
    <ol>
      <li><strong>Có dùng primary key không?</strong> <code>EXPLAIN indexes = 1</code> — số Granules chọn / tổng.</li>
      <li><strong>Đọc bao nhiêu cột?</strong> Tránh <code>SELECT *</code> — ở column-store mỗi cột thừa là một file thừa.</li>
      <li><strong>PREWHERE</strong>: ClickHouse tự chuyển điều kiện chọn lọc nhất sang PREWHERE: đọc cột điều kiện trước, chỉ đọc các cột còn lại cho hàng khớp. Có thể viết tay khi optimizer chọn sai.</li>
      <li><strong>Aggregation</strong>: GROUP BY khoá cardinality cao tốn RAM; dùng hàm xấp xỉ (<code>uniq</code> thay <code>uniqExact</code>, <code>quantile</code> thay <code>quantileExact</code>) khi chấp nhận sai số nhỏ.</li>
      <li><strong>ORDER BY … LIMIT</strong> theo đúng thứ tự khoá sắp xếp được tối ưu (<code>optimize_read_in_order</code>): không cần sort toàn bộ.</li>
      <li>Nếu một kiểu query lặp lại nhiều: projection, MV tổng hợp (bài 07, 13).</li>
    </ol>

    <p><strong>Các loại EXPLAIN</strong></p>
    <ul>
      <li><code>EXPLAIN PLAN</code> (mặc định): các bước logic; thêm <code>indexes = 1</code>, <code>actions = 1</code>.</li>
      <li><code>EXPLAIN PIPELINE</code>: các processor thực thi và mức song song.</li>
      <li><code>EXPLAIN SYNTAX</code> / <code>EXPLAIN QUERY TREE</code>: query sau khi được viết lại.</li>
      <li><code>EXPLAIN ESTIMATE</code>: ước lượng số part/hàng/mark sẽ đọc.</li>
    </ul>

    <p><strong>system.query_log</strong> là "APM" có sẵn: mỗi query có <code>query_duration_ms</code>, <code>read_rows</code>, <code>read_bytes</code>, <code>memory_usage</code>,
    <code>result_rows</code>, <code>normalized_query_hash</code> (gộp các query cùng dạng), <code>ProfileEvents</code>. Query đang chạy: <code>system.processes</code>, huỷ bằng <code>KILL QUERY</code>.</p>

    <div class="callout"><p>💡 Tương đương Spring: <code>query_log</code> ≈ log của Hibernate kèm thời gian + số hàng đọc, nhưng lưu thành bảng để bạn tự GROUP BY.
    Thói quen tốt: mỗi tuần xem top 10 <code>normalized_query_hash</code> theo tổng read_bytes.</p></div>
  `,

  codeTabs: [
    { id: "explain", label: "① EXPLAIN", lines: [
      "EXPLAIN indexes = 1",
      "SELECT url, count() FROM page_views",
      "WHERE tenant_id = 7 AND ts >= now() - INTERVAL 1 DAY",
      "GROUP BY url ORDER BY count() DESC LIMIT 10;",
      "",
      "-- ReadFromMergeTree (default.page_views)",
      "--   Indexes:",
      "--     PrimaryKey  Keys: tenant_id, url   Granules: 1210/40960",
      "",
      "EXPLAIN ESTIMATE SELECT ...;      -- parts, rows, marks sẽ đọc"
    ]},
    { id: "prewhere", label: "② PREWHERE", lines: [
      "-- body là cột to (vài KB/hàng), level nhỏ",
      "SELECT ts, body FROM logs",
      "PREWHERE level = 'ERROR'          -- đọc cột level trước",
      "WHERE service = 'payment';",
      "-- body chỉ được đọc cho granule/hàng có level = 'ERROR'",
      "",
      "-- thường không cần viết tay: optimize_move_to_prewhere = 1 (mặc định)"
    ]},
    { id: "top", label: "③ Query tệ nhất", lines: [
      "SELECT normalized_query_hash,",
      "       any(query)                              AS mau,",
      "       count()                                 AS so_lan,",
      "       formatReadableSize(sum(read_bytes))     AS tong_doc,",
      "       quantile(0.95)(query_duration_ms)       AS p95_ms,",
      "       formatReadableSize(max(memory_usage))   AS ram_max",
      "FROM system.query_log",
      "WHERE type = 'QueryFinish'",
      "  AND event_time >= now() - INTERVAL 1 DAY",
      "GROUP BY normalized_query_hash",
      "ORDER BY sum(read_bytes) DESC LIMIT 10;"
    ]},
    { id: "live", label: "④ Đang chạy", lines: [
      "SELECT query_id, user, elapsed, read_rows,",
      "       formatReadableSize(memory_usage) AS ram, query",
      "FROM system.processes ORDER BY elapsed DESC;",
      "",
      "KILL QUERY WHERE query_id = '6f1c...';",
      "",
      "-- lỗi gần đây",
      "SELECT event_time, exception_code, exception FROM system.query_log",
      "WHERE type = 'ExceptionWhileProcessing' ORDER BY event_time DESC LIMIT 10;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🐢 Query chậm</div></div>
    <div class="arrow" id="a1">↓ tìm trong query_log (top read_bytes)</div>
    <div class="node" id="log"><div class="nl">📜 system.query_log</div><div class="ns">normalized_query_hash, read_bytes, p95</div></div>
    <div class="arrow" id="a2">↓ EXPLAIN indexes = 1</div>
    <div class="node" id="idx"><div class="nl">🔑 Granules 40960/40960?</div><div class="ns">→ khoá không khớp truy vấn</div></div>
    <div class="arrow" id="a3">↓ sửa: bớt cột, PREWHERE, projection/MV</div>
    <div class="node" id="fix"><div class="nl">⚡ Đọc ít byte hơn</div><div class="ns">đo lại trên query_log</div></div>
  `,
  steps: [
    { title: "1 · Tìm query đáng sửa", tab: "top", highlight: [1, 4, 5, 10, 11], on: ["q", "a1", "log"],
      desc: "Gộp theo normalized_query_hash, xếp theo tổng read_bytes: sửa một query chạy 10.000 lần/ngày lợi hơn sửa query chạy một lần." },
    { title: "2 · Kiểm tra index", tab: "explain", highlight: [1, 8], on: ["a2", "idx"],
      desc: "Granules chọn gần bằng tổng → query không khớp ORDER BY. Cân nhắc projection hoặc bảng phụ." },
    { title: "3 · Giảm cột đọc bằng PREWHERE", tab: "prewhere", highlight: [3, 5, 7], on: ["a3"],
      desc: "Đọc cột nhỏ để lọc trước, cột to chỉ đọc cho hàng khớp. Thường optimizer tự làm." },
    { title: "4 · Theo dõi query đang chạy", tab: "live", highlight: [1, 3, 5], on: ["fix"],
      desc: "system.processes cho biết query nào đang ngốn RAM/thời gian; KILL QUERY khi cần." },
    { title: "5 · Đo lại", tab: "explain", highlight: [10], on: ["fix"],
      desc: "EXPLAIN ESTIMATE và query_log sau khi sửa để xác nhận read_bytes giảm thật." }
  ],

  quiz: [
    { q: "Nguyên tắc tối ưu số 1 ở ClickHouse là gì?", options: [
        "Thêm B-tree index", "Đọc ít byte hơn", "Tăng max_threads vô hạn", "Luôn dùng FINAL"
      ], correct: 1, explanation: "Ít granule, ít cột, dữ liệu nén tốt." },
    { q: "Vì sao SELECT * đặc biệt tệ ở ClickHouse?", options: [
        "Cú pháp không hỗ trợ",
        "Mỗi cột là file riêng; đọc mọi cột làm mất lợi thế column-store",
        "Nó khoá bảng",
        "Nó bỏ qua primary key"
      ], correct: 1, explanation: "Chỉ chọn cột cần." },
    { q: "PREWHERE làm gì?", options: [
        "Lọc sau GROUP BY",
        "Đọc cột điều kiện trước, chỉ đọc các cột khác cho phần dữ liệu khớp",
        "Lọc trên replica",
        "Chạy trước khi insert"
      ], correct: 1, explanation: "optimize_move_to_prewhere tự làm trong đa số trường hợp." },
    { q: "Cột nào trong query_log giúp gộp các query cùng dạng khác tham số?", options: [
        "query_id", "normalized_query_hash", "event_time", "user"
      ], correct: 1, explanation: "Hash của query sau khi bỏ literal." },
    { q: "EXPLAIN indexes = 1 cho thấy Granules: 40960/40960. Nghĩa là?", options: [
        "Index hoạt động hoàn hảo",
        "Primary key không loại được granule nào — điều kiện không khớp khoá",
        "Bảng trống",
        "Có lỗi"
      ], correct: 1, explanation: "Cần xem lại ORDER BY, projection hoặc skip index." },
    { q: "Muốn xem và huỷ query đang chạy quá lâu?", options: [
        "system.processes + KILL QUERY", "system.parts + DROP", "system.merges + STOP", "Restart server"
      ], correct: 0, explanation: "KILL QUERY WHERE query_id = '...'." },
    { q: "uniq so với uniqExact?", options: [
        "uniq chính xác hơn",
        "uniq xấp xỉ, dùng ít RAM và nhanh hơn; uniqExact chính xác nhưng tốn RAM với cardinality cao",
        "Giống nhau",
        "uniqExact chỉ dùng cho số"
      ], correct: 1, explanation: "Dashboard thường chấp nhận sai số nhỏ của uniq." },
    { q: "EXPLAIN ESTIMATE trả gì?", options: [
        "Thời gian chạy",
        "Ước lượng số part, hàng, mark sẽ đọc",
        "Chi phí tiền",
        "Plan của Postgres"
      ], correct: 1, explanation: "Nhanh, không chạy query thật." },
    { q: "Lọc query_log theo type nào để lấy query đã chạy xong?", options: [
        "QueryStart", "QueryFinish", "ExceptionBeforeStart", "Tất cả"
      ], correct: 1, explanation: "Mỗi query có dòng QueryStart và QueryFinish/Exception…; lọc để tránh đếm đôi." }
  ]
});
