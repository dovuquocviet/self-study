window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Họ MergeTree & chống trùng",
  title: "ReplacingMergeTree: upsert \"cuối cùng sẽ đúng\"",
  subtitle: "khử trùng theo ORDER BY khi merge · cột version · is_deleted · đọc đúng khi chưa merge",

  theory: `
    <p>ClickHouse không có UPDATE rẻ và không có UNIQUE. Khi nguồn dữ liệu là <em>trạng thái thay đổi</em> (đơn hàng đổi status, CDC từ Postgres qua Kafka),
    mẫu chuẩn là: <strong>mỗi lần thay đổi insert thêm một phiên bản mới</strong>, để engine giữ lại bản mới nhất.</p>

    <p><code>ReplacingMergeTree([ver [, is_deleted]])</code>: khi merge, các hàng có <strong>cùng giá trị ORDER BY</strong> (không phải PRIMARY KEY) trong cùng partition chỉ còn lại một:</p>
    <ul>
      <li>Có <code>ver</code>: giữ hàng có ver lớn nhất (bằng nhau thì giữ hàng insert sau).</li>
      <li>Không có <code>ver</code>: giữ hàng insert sau cùng.</li>
      <li>Có <code>is_deleted</code> (UInt8): hàng thắng có is_deleted = 1 nghĩa là bản ghi đã bị xoá; đọc với FINAL sẽ không thấy nó, và <code>OPTIMIZE ... FINAL CLEANUP</code> có thể loại hẳn.</li>
    </ul>

    <p><strong>Ba cái bẫy</strong></p>
    <ol>
      <li><strong>Merge không biết lúc nào</strong> (bài 02). Trước khi merge, <code>SELECT count()</code> đếm cả bản trùng. Phải đọc bằng <code>FINAL</code> hoặc <code>argMax</code>/<code>GROUP BY</code> (bài 11).</li>
      <li><strong>Chỉ khử trùng trong cùng partition</strong> (và cùng shard). Partition theo <code>created_at</code> thì an toàn vì bản ghi không đổi partition;
      partition theo <code>updated_at</code> là sai — hai phiên bản rơi vào hai tháng khác nhau, không bao giờ gộp.</li>
      <li><strong>ORDER BY là khoá khử trùng</strong>. Thêm cột vào ORDER BY để query nhanh hơn là đổi luôn nghĩa "hàng trùng". Cột hay thay đổi (status) không được nằm trong ORDER BY.</li>
    </ol>

    <p><strong>Chọn ver</strong>: phải tăng đơn điệu theo từng bản ghi — <code>updated_at</code> (nếu đủ chính xác), LSN từ CDC, hoặc offset Kafka nếu một key luôn vào cùng partition.</p>

    <div class="callout"><p>💡 So với JPA <code>save()</code> = upsert ngay: ở ClickHouse "upsert" là <em>eventual</em>. Thiết kế query để đúng kể cả khi còn bản trùng — đó là tư duy then chốt của cả phase này.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① DDL", lines: [
      "CREATE TABLE orders",
      "(",
      "    order_id    UInt64,",
      "    tenant_id   UInt32,",
      "    status      LowCardinality(String),",
      "    amount      Decimal(18, 2),",
      "    created_at  DateTime,",
      "    updated_at  DateTime64(3),",
      "    is_deleted  UInt8 DEFAULT 0",
      ")",
      "ENGINE = ReplacingMergeTree(updated_at, is_deleted)",
      "PARTITION BY toYYYYMM(created_at)     -- KHÔNG dùng updated_at",
      "ORDER BY (tenant_id, order_id);        -- khoá khử trùng"
    ]},
    { id: "ins", label: "② Nhiều phiên bản", lines: [
      "INSERT INTO orders VALUES (1001, 7, 'NEW',     50, '2024-09-01 10:00:00', '2024-09-01 10:00:00.000', 0);",
      "INSERT INTO orders VALUES (1001, 7, 'PAID',    50, '2024-09-01 10:00:00', '2024-09-01 10:05:00.000', 0);",
      "INSERT INTO orders VALUES (1001, 7, 'SHIPPED', 50, '2024-09-01 10:00:00', '2024-09-02 08:00:00.000', 0);",
      "",
      "SELECT status FROM orders WHERE order_id = 1001;",
      "-- NEW, PAID, SHIPPED      <- chưa merge: thấy cả 3",
      "",
      "SELECT status FROM orders FINAL WHERE order_id = 1001;",
      "-- SHIPPED                 <- FINAL khử trùng lúc đọc"
    ]},
    { id: "del", label: "③ Xoá mềm", lines: [
      "-- đơn bị huỷ và xoá khỏi hệ thống nguồn -> CDC gửi bản ghi xoá",
      "INSERT INTO orders VALUES (1001, 7, 'SHIPPED', 50, '2024-09-01 10:00:00', '2024-09-03 09:00:00.000', 1);",
      "",
      "SELECT count() FROM orders FINAL WHERE order_id = 1001;   -- 0",
      "",
      "-- dọn hẳn các hàng đã xoá (tốn I/O, chạy thưa)",
      "OPTIMIZE TABLE orders FINAL CLEANUP;",
      "-- tuỳ phiên bản cần bật setting bảng allow_experimental_replacing_merge_with_cleanup = 1"
    ]},
    { id: "bad", label: "④ Sai thường gặp", lines: [
      "PARTITION BY toYYYYMM(updated_at)  -- 2 phiên bản ở 2 tháng: không bao giờ gộp",
      "ORDER BY (tenant_id, status, order_id)  -- status đổi => coi là hàng KHÁC",
      "ENGINE = ReplacingMergeTree()      -- không ver: phụ thuộc thứ tự insert,",
      "                                   -- Kafka giao lại message cũ sẽ ghi đè bản mới"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="v1"><div class="nl">NEW</div><div class="ns">ver 10:00</div></div>
      <div class="node" id="v2"><div class="nl">PAID</div><div class="ns">ver 10:05</div></div>
      <div class="node" id="v3"><div class="nl">SHIPPED</div><div class="ns">ver 08:00 hôm sau</div></div>
    </div>
    <div class="arrow" id="a1">↓ chưa merge: SELECT thấy 3 hàng</div>
    <div class="node" id="final"><div class="nl">🔍 FINAL / argMax</div><div class="ns">khử trùng lúc đọc</div></div>
    <div class="arrow" id="a2">↓ merge nền (cùng partition, cùng ORDER BY)</div>
    <div class="node" id="merged"><div class="nl">📦 1 hàng: SHIPPED</div><div class="ns">ver lớn nhất thắng</div></div>
    <div class="arrow" id="a3">↓ is_deleted = 1 thắng</div>
    <div class="node" id="gone"><div class="nl">🗑️ Ẩn với FINAL</div><div class="ns">CLEANUP để xoá hẳn</div></div>
  `,
  steps: [
    { title: "1 · Khai báo ver và is_deleted", tab: "ddl", highlight: [8, 9, 11, 12, 13], on: [],
      desc: "updated_at làm version; ORDER BY (tenant_id, order_id) là khoá khử trùng; partition theo created_at để các phiên bản ở cùng partition." },
    { title: "2 · Mỗi thay đổi = một insert", tab: "ins", highlight: [1, 2, 3], on: ["v1", "v2", "v3"],
      desc: "Không UPDATE. Insert phiên bản mới với updated_at lớn hơn." },
    { title: "3 · Trước merge thấy trùng", tab: "ins", highlight: [5, 6, 8, 9], on: ["a1", "final"],
      desc: "SELECT thường thấy cả 3 phiên bản. FINAL gộp lúc đọc và trả đúng bản mới nhất." },
    { title: "4 · Merge giữ ver lớn nhất", tab: "ins", highlight: [3], on: ["a2", "merged"],
      desc: "Khi merge (lúc nào không biết), chỉ hàng ver lớn nhất còn lại trên đĩa." },
    { title: "5 · Xoá bằng is_deleted", tab: "del", highlight: [2, 4, 7], on: ["a3", "gone"],
      desc: "Insert phiên bản có is_deleted = 1. FINAL ẩn nó; OPTIMIZE ... FINAL CLEANUP loại hẳn khỏi đĩa." },
    { title: "6 · Tránh sai thiết kế", tab: "bad", highlight: [1, 2, 3, 4], on: ["merged"],
      desc: "Partition theo cột thay đổi, cột thay đổi trong ORDER BY, hoặc thiếu ver đều làm khử trùng sai." }
  ],

  quiz: [
    { q: "ReplacingMergeTree khử trùng theo cột nào?", options: [
        "PRIMARY KEY", "ORDER BY", "PARTITION BY", "Cột ver"
      ], correct: 1, explanation: "Hàng có cùng giá trị sorting key (ORDER BY) được coi là trùng." },
    { q: "Khi nào việc khử trùng xảy ra?", options: [
        "Ngay khi INSERT",
        "Khi merge nền (thời điểm không xác định) hoặc khi đọc với FINAL",
        "Mỗi đêm lúc 0h",
        "Khi gọi COMMIT"
      ], correct: 1, explanation: "Không được giả định dữ liệu đã được merge." },
    { q: "Với ver, hàng nào được giữ lại?", options: [
        "Hàng insert đầu tiên", "Hàng có ver lớn nhất", "Hàng có ver nhỏ nhất", "Ngẫu nhiên"
      ], correct: 1, explanation: "Nếu ver bằng nhau thì giữ hàng insert sau." },
    { q: "Vì sao PARTITION BY toYYYYMM(updated_at) là sai?", options: [
        "Vì updated_at không phải Date",
        "Vì các phiên bản của cùng bản ghi có thể rơi vào partition khác nhau và merge không bao giờ gộp chúng",
        "Vì partition phải là số",
        "Không sai"
      ], correct: 1, explanation: "Khử trùng chỉ xảy ra trong cùng partition." },
    { q: "Đưa cột status (hay thay đổi) vào ORDER BY gây gì?", options: [
        "Query nhanh hơn, không hại gì",
        "Mỗi status khác nhau bị coi là hàng khác → không khử trùng được",
        "Lỗi cú pháp",
        "Dữ liệu bị xoá"
      ], correct: 1, explanation: "ORDER BY chính là định nghĩa danh tính của hàng." },
    { q: "Không khai báo ver thì sao?", options: [
        "Báo lỗi",
        "Giữ hàng insert sau cùng — sai nếu message cũ đến muộn (Kafka giao lại)",
        "Giữ hàng đầu tiên",
        "Giữ tất cả"
      ], correct: 1, explanation: "Nên có ver đơn điệu để không phụ thuộc thứ tự insert." },
    { q: "Cột is_deleted dùng để làm gì?", options: [
        "Xoá ngay hàng khỏi đĩa",
        "Đánh dấu phiên bản thắng là đã xoá: FINAL ẩn nó, OPTIMIZE FINAL CLEANUP loại hẳn",
        "Tăng tốc merge",
        "Chống trùng insert"
      ], correct: 1, explanation: "Xoá theo kiểu insert một phiên bản 'đã xoá'." },
    { q: "SELECT count() FROM orders (không FINAL) ngay sau 3 lần insert cùng order_id trả?", options: [
        "1", "3 (có thể giảm sau khi merge)", "0", "Lỗi"
      ], correct: 1, explanation: "Trước merge các phiên bản cùng tồn tại." },
    { q: "Nguồn nào làm ver tốt cho dữ liệu CDC từ Postgres?", options: [
        "now() lúc ClickHouse nhận",
        "LSN hoặc updated_at chính xác từ nguồn — tăng đơn điệu theo bản ghi",
        "rand()",
        "Số thứ tự insert"
      ], correct: 1, explanation: "now() phía ClickHouse sai khi message bị giao lại/đến muộn." }
  ]
});
