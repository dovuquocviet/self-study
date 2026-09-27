window.LESSONS.push({
  id: "11",
  phase: "2", phaseName: "Họ MergeTree & chống trùng",
  title: "FINAL và cái giá: đọc đúng dữ liệu chưa merge",
  subtitle: "FINAL gộp lúc đọc · argMax + GROUP BY · bẫy WHERE trước khi khử trùng · các setting giảm chi phí",

  theory: `
    <p>Với Replacing/Collapsing/Summing, dữ liệu trên đĩa có thể còn trùng. Có ba cách đọc đúng:</p>

    <p><strong>1. FINAL</strong> — <code>SELECT ... FROM orders FINAL</code>: ClickHouse chạy logic merge của engine <em>ngay lúc đọc</em> trên các part liên quan.</p>
    <ul>
      <li>Phải đọc <em>toàn bộ cột ORDER BY</em> và cột version để so khớp, kể cả khi query không cần.</li>
      <li>Merge các part đã sort lúc đọc — tốn CPU và bộ nhớ hơn đọc thường.</li>
      <li>Bản mới đã tối ưu nhiều: chạy song song, chỉ merge phần các part <em>chồng lấn khoá</em>, bỏ qua part đã ở level cao không giao nhau;
      <code>do_not_merge_across_partitions_select_final = 1</code> xử lý từng partition riêng (đúng khi bản ghi không đổi partition).</li>
      <li>Setting <code>final = 1</code> áp FINAL cho mọi bảng hỗ trợ trong query — tiện cho dashboard.</li>
    </ul>

    <p><strong>2. argMax + GROUP BY</strong> — tự khử trùng bằng SQL: <code>argMax(status, updated_at)</code> = status của hàng có updated_at lớn nhất.
    Linh hoạt, chạy được trên mọi engine, nhưng với khoá cardinality cao (hàng chục triệu order_id) thì GROUP BY tốn RAM.</p>

    <p><strong>3. Thiết kế để không cần khử trùng</strong>: bảng append-only (event không bao giờ đổi), Collapsing với <code>sum(x * sign)</code>, hoặc MV tổng hợp.</p>

    <p><strong>Bẫy kinh điển: lọc trước khi khử trùng.</strong> <code>WHERE status = 'PAID' GROUP BY order_id</code> với argMax: đơn đã chuyển sang SHIPPED vẫn còn hàng PAID cũ
    ⇒ bị đếm là PAID. Phải khử trùng trước (subquery), lọc sau. Với FINAL, ClickHouse tự lo: điều kiện trên cột ngoài khoá được áp <em>sau</em> khi gộp.</p>

    <div class="callout"><p>💡 Quy tắc chọn: tra cứu vài entity → FINAL thoải mái. Báo cáo quét lớn → đo cả hai cách, và cân nhắc MV sang bảng tổng hợp để không phải khử trùng mỗi lần.
    Đừng "sửa" bằng cron <code>OPTIMIZE FINAL</code> mỗi phút — vừa tốn vừa không đảm bảo (insert mới lại tạo trùng ngay).</p></div>
  `,

  codeTabs: [
    { id: "final", label: "① FINAL", lines: [
      "SELECT status, count()",
      "FROM orders FINAL",
      "WHERE tenant_id = 7 AND created_at >= '2024-09-01'",
      "GROUP BY status;",
      "",
      "-- hoặc bật cho cả query/profile",
      "SELECT status, count() FROM orders",
      "WHERE tenant_id = 7",
      "GROUP BY status",
      "SETTINGS final = 1;"
    ]},
    { id: "argmax", label: "② argMax", lines: [
      "SELECT status, count()",
      "FROM",
      "(",
      "    SELECT order_id,",
      "           argMax(status, updated_at)     AS status,",
      "           argMax(is_deleted, updated_at) AS deleted",
      "    FROM orders",
      "    WHERE tenant_id = 7              -- chỉ lọc trên cột KHÔNG đổi",
      "    GROUP BY order_id",
      ")",
      "WHERE deleted = 0",
      "GROUP BY status;"
    ]},
    { id: "trap", label: "③ Bẫy lọc sớm", lines: [
      "-- SAI: lọc status trước khi khử trùng",
      "SELECT count() FROM",
      "(",
      "    SELECT order_id FROM orders",
      "    WHERE status = 'PAID'            -- bắt cả phiên bản cũ PAID",
      "    GROUP BY order_id",
      ");",
      "-- đơn 1001 hiện là SHIPPED nhưng vẫn bị đếm là PAID",
      "",
      "-- ĐÚNG: khử trùng trước, lọc sau (như tab ②)"
    ]},
    { id: "cost", label: "④ Đo chi phí", lines: [
      "SELECT query_duration_ms, read_rows, formatReadableSize(memory_usage)",
      "FROM system.query_log",
      "WHERE type = 'QueryFinish' AND query LIKE '%FROM orders%'",
      "ORDER BY event_time DESC LIMIT 4;",
      "",
      "SET do_not_merge_across_partitions_select_final = 1;",
      "-- an toàn khi mọi phiên bản của 1 bản ghi nằm cùng partition"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="p1"><div class="nl">📦 part A</div><div class="ns">1001 PAID</div></div>
      <div class="node" id="p2"><div class="nl">📦 part B</div><div class="ns">1001 SHIPPED</div></div>
      <div class="node" id="p3"><div class="nl">📦 part C (level cao)</div><div class="ns">khoá không giao</div></div>
    </div>
    <div class="arrow" id="a1">↓ FINAL: merge lúc đọc phần giao nhau</div>
    <div class="node" id="fin"><div class="nl">🔁 Merge on read</div><div class="ns">đọc thêm cột khoá + version</div></div>
    <div class="arrow" id="a2">↓ hoặc argMax + GROUP BY</div>
    <div class="node" id="arg"><div class="nl">🧮 argMax(status, updated_at)</div><div class="ns">khử trùng bằng SQL</div></div>
    <div class="arrow" id="a3">↓ sau đó mới lọc status</div>
    <div class="node" id="ok"><div class="nl">✅ 1001 = SHIPPED</div></div>
  `,
  steps: [
    { title: "1 · Dữ liệu chưa merge", tab: "trap", highlight: [4, 5, 8], on: ["p1", "p2"],
      desc: "Hai phiên bản của đơn 1001 nằm ở hai part. Lọc status = 'PAID' trước sẽ bắt nhầm phiên bản cũ." },
    { title: "2 · FINAL gộp lúc đọc", tab: "final", highlight: [2, 3], on: ["a1", "fin"],
      desc: "Engine chạy logic Replacing trên phần chồng lấn; part C không giao khoá có thể đọc thẳng." },
    { title: "3 · Setting final = 1", tab: "final", highlight: [10], on: ["fin"],
      desc: "Áp FINAL cho mọi bảng trong query mà không phải sửa SQL từng chỗ." },
    { title: "4 · argMax + GROUP BY", tab: "argmax", highlight: [5, 6, 8, 9, 11], on: ["a2", "arg"],
      desc: "Khử trùng tường minh; chỉ lọc sớm trên cột không đổi (tenant_id), lọc cột thay đổi sau subquery." },
    { title: "5 · Đo và chọn", tab: "cost", highlight: [1, 6, 7], on: ["a3", "ok"],
      desc: "So read_rows, thời gian, bộ nhớ giữa hai cách trên dữ liệu thật rồi mới quyết định." }
  ],

  quiz: [
    { q: "FINAL làm gì?", options: [
        "Ép merge part trên đĩa vĩnh viễn",
        "Chạy logic merge của engine ngay lúc đọc để trả kết quả đã khử trùng/gộp",
        "Khoá bảng",
        "Chỉ đọc part cuối cùng"
      ], correct: 1, explanation: "Không thay đổi dữ liệu trên đĩa; khác với OPTIMIZE FINAL." },
    { q: "Vì sao FINAL tốn hơn đọc thường?", options: [
        "Vì bỏ qua index",
        "Phải đọc thêm cột khoá/version và merge các part đã sort lúc đọc",
        "Vì chạy một luồng duy nhất ở mọi phiên bản",
        "Vì ghi ra đĩa"
      ], correct: 1, explanation: "Bản mới chạy song song và chỉ merge phần giao nhau, nhưng vẫn có chi phí." },
    { q: "argMax(status, updated_at) trả gì?", options: [
        "updated_at lớn nhất",
        "Giá trị status của hàng có updated_at lớn nhất",
        "status lớn nhất theo thứ tự chữ cái",
        "Số status khác nhau"
      ], correct: 1, explanation: "argMax(giá trị, theo) = giá trị tại hàng có 'theo' lớn nhất." },
    { q: "Vì sao WHERE status = 'PAID' trước GROUP BY order_id là sai?", options: [
        "Cú pháp sai",
        "Bắt cả phiên bản cũ PAID của đơn nay đã đổi trạng thái",
        "Chậm hơn",
        "Không sai"
      ], correct: 1, explanation: "Phải khử trùng trước rồi mới lọc theo cột thay đổi." },
    { q: "Lọc WHERE tenant_id = 7 trước khi khử trùng có an toàn không (tenant không đổi)?", options: [
        "Có, vì mọi phiên bản của một đơn đều có cùng tenant_id",
        "Không bao giờ an toàn",
        "Chỉ với FINAL",
        "Chỉ khi tenant_id là Nullable"
      ], correct: 0, explanation: "Cột bất biến lọc sớm không loại phiên bản mới nhất." },
    { q: "do_not_merge_across_partitions_select_final = 1 an toàn khi nào?", options: [
        "Luôn luôn",
        "Khi mọi phiên bản của một bản ghi luôn nằm cùng partition",
        "Khi không có partition",
        "Khi dùng Collapsing"
      ], correct: 1, explanation: "Nếu bản ghi có thể đổi partition, xử lý riêng từng partition sẽ bỏ sót trùng." },
    { q: "Cron OPTIMIZE FINAL mỗi phút để khỏi dùng FINAL có tốt không?", options: [
        "Tốt, đó là best practice",
        "Không: tốn I/O rất lớn và insert mới lại tạo trùng ngay",
        "Tốt nếu bảng nhỏ hơn 1 tỷ hàng",
        "Bắt buộc với Replacing"
      ], correct: 1, explanation: "Query vẫn phải được viết để đúng khi còn trùng." },
    { q: "Setting nào áp FINAL cho mọi bảng trong query?", options: [
        "force_final = 1", "final = 1", "select_final = 1", "use_final_everywhere = 1"
      ], correct: 1, explanation: "Có thể đặt trong settings profile cho user dashboard." },
    { q: "Khi nào argMax + GROUP BY có thể tệ hơn FINAL?", options: [
        "Khi khoá cardinality rất cao, GROUP BY tốn nhiều RAM",
        "Khi bảng có ít hàng",
        "Khi dùng LowCardinality",
        "Không bao giờ"
      ], correct: 0, explanation: "GROUP BY phải giữ hash table theo từng order_id." }
  ]
});
