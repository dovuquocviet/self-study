window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "MergeTree sâu",
  title: "Projection: bản sao ẩn với thứ tự khác hoặc đã gom sẵn",
  subtitle: "ADD PROJECTION · MATERIALIZE · optimizer tự chọn · so với materialized view",

  theory: `
    <p>Bảng chỉ có một ORDER BY. Nếu hai kiểu truy vấn cần hai thứ tự khác nhau, <strong>projection</strong> lưu thêm một bản dữ liệu
    <em>bên trong chính mỗi part</em> (thư mục con <code>tên_projection.proj</code>), được sắp xếp khác hoặc đã aggregate sẵn.</p>

    <p><strong>Hai loại</strong></p>
    <ul>
      <li><strong>Normal projection</strong>: <code>SELECT * ORDER BY user_id</code> — cùng dữ liệu, thứ tự khác. Tốn gấp đôi dung lượng cho các cột được chọn.</li>
      <li><strong>Aggregate projection</strong>: <code>SELECT day, event, count() GROUP BY day, event</code> — lưu kết quả gom sẵn, rất nhỏ.</li>
    </ul>

    <p><strong>Tính chất</strong></p>
    <ol>
      <li>Được ghi cùng lúc với part chính khi INSERT và merge cùng part chính ⇒ luôn nhất quán, không bao giờ lệch.</li>
      <li>Query <strong>không cần biết</strong> projection: optimizer tự chọn nếu projection trả lời được và đọc ít granule hơn.</li>
      <li>Thêm projection vào bảng có sẵn: chỉ part mới có; chạy <code>MATERIALIZE PROJECTION</code> (mutation) cho part cũ.</li>
      <li>Làm insert chậm hơn (ghi thêm) và tăng dung lượng.</li>
      <li>Với Replacing/Collapsing/Aggregating… có hạn chế: mặc định từ chối khi dedup/xoá có thể làm projection lệch (setting <code>deduplicate_merge_projection_mode</code>, <code>lightweight_mutation_projection_mode</code>).</li>
    </ol>

    <table>
      <tr><th></th><th>Projection</th><th>Materialized view (bài 13)</th></tr>
      <tr><td>Lưu ở đâu</td><td>Trong part của bảng gốc</td><td>Bảng đích riêng</td></tr>
      <tr><td>Query</td><td>Tự động dùng, query gốc không đổi</td><td>Phải query bảng đích</td></tr>
      <tr><td>Nhất quán</td><td>Luôn khớp (cùng part)</td><td>Chỉ thấy insert mới; không theo delete/mutation của nguồn</td></tr>
      <tr><td>Linh hoạt</td><td>Không JOIN, không WHERE, cùng một bảng</td><td>Biến đổi tuỳ ý, ghi sang engine khác, khác cluster</td></tr>
    </table>

    <div class="callout"><p>💡 Giống Spring: projection giống cache được quản lý bởi framework — tiện, trong suốt. MV giống bạn tự viết listener ghi sang bảng khác — linh hoạt hơn nhưng tự chịu trách nhiệm.</p></div>
  `,

  codeTabs: [
    { id: "normal", label: "① Normal", lines: [
      "-- bảng gốc sort theo (tenant_id, ts)",
      "ALTER TABLE page_views ADD PROJECTION by_user",
      "(",
      "    SELECT * ORDER BY (user_id, ts)",
      ");",
      "ALTER TABLE page_views MATERIALIZE PROJECTION by_user;",
      "",
      "-- query không đổi, optimizer tự chọn projection",
      "SELECT count() FROM page_views WHERE user_id = 12345;"
    ]},
    { id: "agg", label: "② Aggregate", lines: [
      "ALTER TABLE page_views ADD PROJECTION daily_by_url",
      "(",
      "    SELECT tenant_id, toDate(ts), url, count(), uniq(user_id)",
      "    GROUP BY tenant_id, toDate(ts), url",
      ");",
      "",
      "-- query khớp hình dạng GROUP BY -> đọc projection nhỏ",
      "SELECT toDate(ts) AS d, url, count()",
      "FROM page_views WHERE tenant_id = 7",
      "GROUP BY d, url;"
    ]},
    { id: "check", label: "③ Kiểm tra", lines: [
      "EXPLAIN SELECT count() FROM page_views WHERE user_id = 12345;",
      "-- ReadFromMergeTree (by_user)          <- dùng projection",
      "",
      "SELECT query, projections",
      "FROM system.query_log",
      "WHERE type = 'QueryFinish' ORDER BY event_time DESC LIMIT 5;",
      "",
      "SELECT name, parent_name, rows",
      "FROM system.projection_parts WHERE table = 'page_views' AND active;"
    ]},
    { id: "off", label: "④ Tắt / xoá", lines: [
      "SET optimize_use_projections = 0;        -- so sánh khi không dùng",
      "ALTER TABLE page_views DROP PROJECTION by_user;",
      "",
      "-- ReplacingMergeTree: phải chọn cách xử lý khi merge dedup",
      "ALTER TABLE t MODIFY SETTING deduplicate_merge_projection_mode = 'rebuild';"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ins"><div class="nl">📥 INSERT</div></div>
    <div class="arrow" id="a1">↓ ghi part + projection cùng lúc</div>
    <div class="row">
      <div class="node" id="main"><div class="nl">📦 Part chính</div><div class="ns">ORDER BY (tenant_id, ts)</div></div>
      <div class="node" id="proj"><div class="nl">📦 by_user.proj</div><div class="ns">ORDER BY (user_id, ts)</div></div>
    </div>
    <div class="arrow" id="a2">↓ WHERE user_id = 12345</div>
    <div class="node" id="opt"><div class="nl">🧠 Optimizer</div><div class="ns">chọn nguồn đọc ít granule hơn</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="res"><div class="nl">✅ đọc projection</div><div class="ns">query gốc không đổi</div></div>
  `,
  steps: [
    { title: "1 · Thêm normal projection", tab: "normal", highlight: [2, 3, 4, 5], on: ["proj"],
      desc: "Bản sao dữ liệu sort theo user_id, nằm trong thư mục con của từng part." },
    { title: "2 · Dựng cho dữ liệu cũ", tab: "normal", highlight: [6], on: ["main", "proj"],
      desc: "MATERIALIZE PROJECTION là mutation. Từ giờ mỗi INSERT ghi cả hai." },
    { title: "3 · Optimizer tự chọn", tab: "normal", highlight: [9], on: ["ins", "a1", "a2", "opt"],
      desc: "Query không nhắc tên projection. ClickHouse phân tích và chọn projection vì đọc ít granule hơn." },
    { title: "4 · Aggregate projection", tab: "agg", highlight: [3, 4, 8, 9, 10], on: ["opt"],
      desc: "Lưu sẵn count/uniq theo ngày. Query có GROUP BY tương thích sẽ đọc bảng tổng hợp nhỏ thay vì dữ liệu thô." },
    { title: "5 · Xác nhận đã dùng", tab: "check", highlight: [2, 4, 9], on: ["a3", "res"],
      desc: "EXPLAIN hoặc cột projections trong system.query_log cho biết projection nào được dùng." }
  ],

  quiz: [
    { q: "Projection được lưu ở đâu?", options: [
        "Trong một bảng riêng như MV",
        "Trong mỗi part của bảng gốc, dưới dạng thư mục con .proj",
        "Trong Keeper",
        "Trong RAM"
      ], correct: 1, explanation: "Vì vậy nó được insert và merge cùng part chính." },
    { q: "Muốn dùng projection, query phải làm gì?", options: [
        "Ghi FROM tên_projection",
        "Không cần làm gì; optimizer tự chọn khi có lợi",
        "Thêm hint /*+ PROJECTION */",
        "Bật FINAL"
      ], correct: 1, explanation: "Đó là ưu điểm lớn: trong suốt với ứng dụng." },
    { q: "Thêm projection cho bảng đã có dữ liệu thì sao?", options: [
        "Tự động dựng cho mọi part",
        "Chỉ part mới có; cần MATERIALIZE PROJECTION cho part cũ",
        "Báo lỗi",
        "Phải DROP bảng"
      ], correct: 1, explanation: "Giống skip index, việc dựng cho dữ liệu cũ là mutation." },
    { q: "Nhược điểm của normal projection?", options: [
        "Không nhất quán với bảng gốc",
        "Tăng dung lượng và thời gian insert vì ghi thêm bản sao",
        "Không dùng được WHERE",
        "Chỉ hỗ trợ một cột"
      ], correct: 1, explanation: "Normal projection SELECT * gần như nhân đôi dung lượng." },
    { q: "Điểm khác chính giữa projection và materialized view?", options: [
        "Projection có thể JOIN bảng khác",
        "Projection nằm trong bảng gốc, tự dùng và luôn nhất quán; MV ghi ra bảng riêng, linh hoạt hơn nhưng phải query bảng đích",
        "MV luôn nhanh hơn",
        "Không khác nhau"
      ], correct: 1, explanation: "Chọn projection khi chỉ cần thứ tự/gom khác trên cùng bảng." },
    { q: "Aggregate projection hữu ích khi nào?", options: [
        "Dashboard lặp lại cùng một kiểu GROUP BY",
        "Tìm một hàng theo id",
        "Xoá dữ liệu",
        "JOIN hai bảng"
      ], correct: 0, explanation: "Kết quả gom sẵn nhỏ hơn dữ liệu thô rất nhiều." },
    { q: "Cách kiểm tra projection có được dùng?", options: [
        "SHOW PROJECTIONS",
        "EXPLAIN hoặc cột projections trong system.query_log",
        "system.merges",
        "Không có cách"
      ], correct: 1, explanation: "query_log ghi tên projection được dùng cho từng query." },
    { q: "Projection trên ReplacingMergeTree cần chú ý gì?", options: [
        "Không có gì khác",
        "Merge có thể loại hàng trùng làm projection lệch; phải cấu hình deduplicate_merge_projection_mode (throw/drop/rebuild)",
        "Projection tự khử trùng",
        "Chỉ hỗ trợ aggregate projection"
      ], correct: 1, explanation: "Mặc định ClickHouse từ chối tạo để tránh kết quả sai." },
    { q: "Setting nào tắt việc dùng projection để so sánh hiệu năng?", options: [
        "allow_projections = 0",
        "optimize_use_projections = 0",
        "use_index = 0",
        "max_threads = 1"
      ], correct: 1, explanation: "Tiện khi đo xem projection có thật sự giúp." }
  ]
});
