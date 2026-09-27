window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Planner & tối ưu query",
  title: "Đọc EXPLAIN ANALYZE: cost, rows, loops, buffers & các node scan",
  subtitle: "Ước lượng vs thực tế · đọc từ trong ra ngoài · Seq/Index/Index Only/Bitmap scan",

  theory: `
    <p>Trong Spring bạn bật <code>show-sql</code> để xem Hibernate sinh câu gì. Bước tiếp theo của một kỹ sư là hỏi: <em>PostgreSQL chạy câu đó thế nào</em>. <code>EXPLAIN</code> cho kế hoạch dự kiến; <code>EXPLAIN (ANALYZE, BUFFERS)</code> <strong>chạy thật</strong> và ghi lại số liệu thật.</p>

    <p><strong>Đọc một dòng node</strong>: <code>Seq Scan on orders (cost=0.00..445.00 rows=10000 width=244) (actual time=0.012..3.1 rows=9800 loops=1)</code></p>
    <table>
      <tr><th>Phần</th><th>Ý nghĩa</th></tr>
      <tr><td><code>cost=A..B</code></td><td>Đơn vị tuỳ ý (1.0 ≈ đọc tuần tự 1 trang). A = chi phí trước khi trả row đầu (startup), B = tổng chi phí trả hết row. <strong>Không phải ms</strong></td></tr>
      <tr><td><code>rows=</code> (trong cost)</td><td>Số row planner <em>ước lượng</em> node này trả ra</td></tr>
      <tr><td><code>width=</code></td><td>Kích thước trung bình mỗi row (byte)</td></tr>
      <tr><td><code>actual time=X..Y</code></td><td>ms thật tới row đầu / tới row cuối, <strong>tính cho mỗi loop</strong></td></tr>
      <tr><td><code>rows=</code> (actual), <code>loops=</code></td><td>Số row thật <em>trung bình mỗi loop</em>; tổng = rows × loops (PG 18 hiển thị rows có phần thập phân)</td></tr>
      <tr><td><code>Buffers: shared hit=H read=R</code></td><td>H trang lấy từ shared_buffers, R trang phải đọc từ OS/đĩa. PG 18 tự bật BUFFERS khi có ANALYZE</td></tr>
    </table>

    <p><strong>Công thức cost</strong> (Seq Scan): <code>số trang × seq_page_cost (1.0) + số row × cpu_tuple_cost (0.01)</code> [+ số row × cpu_operator_cost (0.0025) mỗi điều kiện]. Bảng 345 trang, 10.000 row → 345 + 100 = 445. Index scan dùng thêm <code>random_page_cost</code> (mặc định 4.0 — với SSD nên hạ về ~1.1).</p>

    <p><strong>Cách đọc</strong>: cây đọc <em>từ trong ra ngoài, từ dưới lên</em>; node thụt sâu nhất chạy trước và đẩy row lên cha. Tìm:</p>
    <ol>
      <li>Node có <strong>actual time × loops</strong> lớn nhất — đó là chỗ tốn thời gian.</li>
      <li>Chỗ <strong>rows ước lượng lệch xa rows thật</strong> (×10, ×1000) — gốc của plan tồi (bài 11).</li>
      <li><code>Rows Removed by Filter</code> lớn — đọc nhiều để vứt đi.</li>
      <li><code>Sort Method: external merge Disk: ...</code> — thiếu <code>work_mem</code>, sort tràn ra đĩa.</li>
      <li><code>Buffers read</code> lớn — dữ liệu không nằm trong cache.</li>
    </ol>

    <p><strong>Các node scan</strong></p>
    <ul>
      <li><strong>Seq Scan</strong>: đọc cả bảng. Không phải lúc nào cũng xấu — lấy 30% bảng thì seq scan rẻ hơn tra index từng row.</li>
      <li><strong>Index Scan</strong>: đi index, mỗi TID nhảy vào heap (đọc ngẫu nhiên). Tốt khi lấy ít row.</li>
      <li><strong>Index Only Scan</strong>: bài 08, xem <code>Heap Fetches</code>.</li>
      <li><strong>Bitmap Index Scan → Bitmap Heap Scan</strong>: gom mọi TID thành bitmap theo trang, rồi đọc heap theo thứ tự vật lý. Tầm trung (vài nghìn–vài trăm nghìn row), hoặc kết hợp nhiều index (<code>BitmapAnd</code>/<code>BitmapOr</code>).</li>
      <li><strong>Parallel Seq Scan</strong> dưới <strong>Gather</strong>: nhiều worker cùng quét.</li>
    </ul>

    <div class="callout"><p>💡 <code>EXPLAIN ANALYZE</code> thực thi câu lệnh: với UPDATE/DELETE hãy bọc trong <code>BEGIN; ... ROLLBACK;</code>. Và đo trên dữ liệu có kích thước giống production — plan trên bảng 100 row của máy dev gần như vô nghĩa.</p></div>
  `,

  codeTabs: [
    { id: "plan", label: "① Một plan thật", lines: [
      "EXPLAIN (ANALYZE, BUFFERS)",
      "SELECT o.id, o.total FROM orders o",
      "WHERE o.status = 'PAID' AND o.created_at >= now() - interval '7 days';",
      "",
      " Seq Scan on orders o  (cost=0.00..198233.00 rows=512 width=16)",
      "                       (actual time=0.041..1432.880 rows=48211 loops=1)",
      "   Filter: ((status = 'PAID') AND (created_at >= (now() - '7 days'::interval)))",
      "   Rows Removed by Filter: 4951789",
      "   Buffers: shared hit=2048 read=121185",
      " Planning Time: 0.210 ms",
      " Execution Time: 1436.004 ms"
    ]},
    { id: "cost", label: "② Tính cost bằng tay", lines: [
      "SELECT relpages, reltuples FROM pg_class WHERE relname = 'tenk1';",
      "--  relpages | reltuples",
      "--       345 |     10000",
      "",
      "EXPLAIN SELECT * FROM tenk1;",
      "-- Seq Scan on tenk1  (cost=0.00..445.00 rows=10000 width=244)",
      "--   345 × 1.0 (seq_page_cost) + 10000 × 0.01 (cpu_tuple_cost) = 445",
      "",
      "EXPLAIN SELECT * FROM tenk1 WHERE unique1 < 7000;",
      "-- Seq Scan on tenk1  (cost=0.00..470.00 rows=7000 width=244)",
      "--   445 + 10000 × 0.0025 (cpu_operator_cost) = 470"
    ]},
    { id: "scans", label: "③ Các kiểu scan", lines: [
      " Index Scan using orders_pkey on orders  (actual rows=1 loops=1)",
      "   Index Cond: (id = 42)",
      "",
      " Bitmap Heap Scan on orders  (actual rows=48211 loops=1)",
      "   Recheck Cond: (created_at >= ...)",
      "   Filter: (status = 'PAID')",
      "   Heap Blocks: exact=9120",
      "   ->  Bitmap Index Scan on orders_created_idx  (actual rows=61020 loops=1)",
      "",
      " Gather  (workers planned: 2, workers launched: 2)",
      "   ->  Parallel Seq Scan on events  (actual rows=1666667 loops=3)"
    ]},
    { id: "loops", label: "④ Bẫy loops & sort", lines: [
      " Nested Loop  (actual time=0.05..912.4 rows=20000 loops=1)",
      "   ->  Seq Scan on customers c  (actual rows=20000 loops=1)",
      "   ->  Index Scan using orders_cust_idx on orders o",
      "         (actual time=0.040..0.044 rows=1 loops=20000)",
      "# 0.044 ms × 20000 loops ≈ 880 ms  ← chỗ tốn thật sự",
      "",
      " Sort  (actual time=2210.3..2390.8 rows=3000000 loops=1)",
      "   Sort Key: created_at DESC",
      "   Sort Method: external merge  Disk: 187344kB   ← work_mem không đủ",
      "",
      "BEGIN; EXPLAIN ANALYZE DELETE FROM orders WHERE id = 42; ROLLBACK;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sql"><div class="nl">📝 SQL</div><div class="ns">parse → rewrite</div></div>
    <div class="arrow" id="a1">↓ planner dùng thống kê + cost</div>
    <div class="node" id="est"><div class="nl">🧮 Ước lượng</div><div class="ns">cost=0.00..198233 rows=512</div></div>
    <div class="arrow" id="a2">↓ ANALYZE: chạy thật</div>
    <div class="node" id="act"><div class="nl">⏱️ Thực tế</div><div class="ns">rows=48211 · 1432 ms · read=121185</div></div>
    <div class="arrow" id="a3">↓ so sánh</div>
    <div class="row">
      <div class="node" id="gap"><div class="nl">📉 Ước lượng lệch ×94</div><div class="ns">→ thống kê (bài 11)</div></div>
      <div class="node" id="waste"><div class="nl">🗑️ Đọc 5 triệu, vứt 4,95 triệu</div><div class="ns">→ thiếu index phù hợp</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chạy EXPLAIN (ANALYZE, BUFFERS)", tab: "plan", highlight: [1, 2, 3], on: ["sql", "a1"],
      desc: "ANALYZE thực thi câu lệnh; BUFFERS cho biết đọc bao nhiêu trang từ cache/đĩa." },
    { title: "2 · Cost là con số tương đối", tab: "cost", highlight: [3, 6, 7, 10, 11], on: ["est"],
      desc: "Cost tính từ số trang, số row và vài hằng số cấu hình. Dùng để so các plan với nhau, không phải thời gian." },
    { title: "3 · So ước lượng với thực tế", tab: "plan", highlight: [5, 6], on: ["a2", "act", "a3", "gap"],
      desc: "Dự đoán 512 row, thật 48.211. Lệch gần 100 lần → planner có thể chọn sai kiểu join/scan ở các node phía trên." },
    { title: "4 · Tìm chỗ lãng phí", tab: "plan", highlight: [8, 9, 11], on: ["waste"],
      desc: "Đọc ~123 nghìn trang (≈1 GB), hầu hết từ đĩa, để giữ lại 1% row. Ứng viên: index (status, created_at) hoặc partial index." },
    { title: "5 · Nhận diện kiểu scan", tab: "scans", highlight: [1, 4, 7, 8, 10, 11], on: ["act"],
      desc: "Index Scan cho vài row; Bitmap cho tầm trung; Parallel Seq Scan cho quét lớn. <code>loops=3</code> = leader + 2 worker." },
    { title: "6 · Nhân với loops, soi Sort", tab: "loops", highlight: [4, 5, 9], on: ["gap", "waste"],
      desc: "actual time là <em>mỗi loop</em>. Và 'external merge Disk' nghĩa là sort tràn đĩa — xem work_mem (bài 23)." }
  ],

  quiz: [
    { q: "Đơn vị của cost trong EXPLAIN là gì?", options: [
        "Millisecond",
        "Đơn vị tương đối, 1.0 ≈ chi phí đọc tuần tự một trang",
        "Số byte",
        "Số CPU cycle"
      ], correct: 1, explanation: "Dùng để so sánh các phương án, không quy đổi trực tiếp ra thời gian." },
    { q: "EXPLAIN ANALYZE khác EXPLAIN ở điểm nào?", options: [
        "Chỉ đẹp hơn",
        "Thực sự chạy câu lệnh và báo thời gian, số row thực tế",
        "Không chạy câu lệnh nhưng chính xác hơn",
        "Chỉ dùng cho SELECT"
      ], correct: 1, explanation: "Cẩn thận với DML: bọc BEGIN/ROLLBACK." },
    { q: "Node có actual time=0.04..0.05 rows=1 loops=50000. Tổng thời gian node này xấp xỉ?", options: [
        "0,05 ms", "2,5 giây", "50 ms", "Không xác định"
      ], correct: 1, explanation: "0,05 ms × 50.000 = 2.500 ms. Thời gian và rows là trung bình mỗi loop." },
    { q: "Dấu hiệu nào gợi ý planner đang dựa trên thống kê sai?", options: [
        "Planning Time nhỏ",
        "rows ước lượng khác rows thực tế hàng chục/hàng trăm lần",
        "Có node Gather",
        "Buffers hit cao"
      ], correct: 1, explanation: "Ước lượng sai ở node dưới lan lên làm chọn sai join/scan phía trên." },
    { q: "'Sort Method: external merge Disk: 187344kB' nghĩa là?", options: [
        "Sort dùng index",
        "Sort vượt work_mem nên tràn ra file tạm trên đĩa",
        "Sort song song",
        "Sort bị lỗi"
      ], correct: 1, explanation: "Tăng work_mem cho phiên/query đó hoặc tránh sort bằng index." },
    { q: "Seq Scan có phải lúc nào cũng xấu?", options: [
        "Có",
        "Không — khi cần phần lớn bảng hoặc bảng nhỏ, đọc tuần tự rẻ hơn tra index từng row",
        "Chỉ xấu với bảng có khoá chính",
        "Chỉ tốt trên HDD"
      ], correct: 1, explanation: "Index scan tốn đọc ngẫu nhiên cho mỗi row." },
    { q: "Bitmap Heap Scan có lợi gì so với Index Scan khi lấy nhiều row?", options: [
        "Không cần index",
        "Gom TID theo trang rồi đọc heap theo thứ tự vật lý, mỗi trang đọc một lần; có thể kết hợp nhiều index",
        "Luôn trả row theo thứ tự",
        "Không cần kiểm tra visibility"
      ], correct: 1, explanation: "Đổi lại mất thứ tự của index." },
    { q: "Buffers: shared hit=2048 read=121185 cho biết gì?", options: [
        "2048 lỗi đọc",
        "2048 trang có sẵn trong shared_buffers, 121185 trang phải đọc từ OS/đĩa",
        "121185 row bị lọc",
        "Số byte gửi cho client"
      ], correct: 1, explanation: "'read' có thể vẫn là page cache của OS, nhưng đắt hơn 'hit'." },
    { q: "Với ổ SSD, tham số planner nào thường nên hạ?", options: [
        "seq_page_cost", "random_page_cost (mặc định 4.0 → ~1.1)", "cpu_tuple_cost", "work_mem"
      ], correct: 1, explanation: "Giá trị 4.0 phản ánh HDD; để nguyên trên SSD khiến planner ngại dùng index." },
    { q: "Thứ tự thực thi các node trong cây EXPLAIN?", options: [
        "Từ dòng đầu xuống dòng cuối",
        "Node thụt sâu nhất (lá) chạy trước, đẩy row lên node cha",
        "Ngẫu nhiên",
        "Theo cost tăng dần"
      ], correct: 1, explanation: "Thực tế là mô hình kéo (pull): cha gọi con lấy từng row, nhưng dữ liệu bắt nguồn từ lá." }
  ]
});
