window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Nền tảng lưu trữ",
  title: "B-tree (B+tree) — cấu trúc đọc nhanh, sửa tại chỗ",
  subtitle: "Fanout lớn · chiều cao 3–4 · page split · khoá tuần tự vs UUID ngẫu nhiên · clustered vs heap",

  theory: `
    <p>B+tree là cấu trúc index mặc định của PostgreSQL, MySQL InnoDB, MongoDB (WiredTiger) và nhiều DB khác. Nó được thiết kế cho <strong>đĩa đọc theo page</strong>:
    mỗi node là một page, và mỗi page chứa <em>hàng trăm</em> khoá, nên cây rất thấp.</p>

    <p><strong>Cấu trúc</strong></p>
    <ul>
      <li><strong>Node trong</strong> (internal): chỉ chứa khoá phân cách + con trỏ tới page con.</li>
      <li><strong>Node lá</strong> (leaf): chứa khoá + giá trị (PostgreSQL: ctid trỏ vào heap; InnoDB: cả dòng dữ liệu nếu là khoá chính).</li>
      <li>Các lá được <strong>nối với nhau</strong> theo thứ tự → quét khoảng (<code>BETWEEN</code>, <code>ORDER BY</code>, <code>&gt;</code>) chỉ cần tìm điểm đầu rồi đi ngang.</li>
    </ul>

    <p><strong>Vì sao thấp?</strong> Page 8 KB, khoá bigint 8 byte + con trỏ + overhead → fanout cỡ vài trăm. Với fanout 300: 3 tầng ≈ 27 triệu khoá, 4 tầng ≈ 8 tỷ khoá.
    Gốc và tầng trên gần như luôn nằm trong buffer pool, nên tìm một dòng trong bảng tỷ dòng chỉ tốn 1–2 lần đọc đĩa.</p>

    <p><strong>Ghi: sửa tại chỗ và tách page</strong></p>
    <ol>
      <li>Insert: đi xuống lá đúng vị trí, chèn khoá vào page (giữ thứ tự).</li>
      <li>Page đầy → <strong>page split</strong>: chia đôi, đẩy một khoá phân cách lên node cha (có thể lan lên tới gốc, khi đó cây cao thêm 1).</li>
      <li>Mỗi thay đổi nhỏ vẫn làm dirty nguyên page 8 KB → <strong>write amplification</strong> (ghi 8 KB cho một thay đổi vài byte, cộng WAL).</li>
    </ol>

    <p><strong>Khoá tuần tự vs UUID ngẫu nhiên</strong></p>
    <ul>
      <li><code>bigserial</code>/<code>IDENTITY</code>, UUIDv7 (có tiền tố thời gian): khoá mới luôn ở lá phải cùng → chỉ lá đó nóng, nằm trong RAM, split gọn.</li>
      <li>UUIDv4 ngẫu nhiên: mỗi insert rơi vào một lá bất kỳ → cả index phải nằm trong RAM mới nhanh, split khắp nơi, page chỉ đầy ~50–70%, WAL phình vì full page writes.</li>
    </ul>

    <p><strong>Clustered vs heap</strong></p>
    <table>
      <tr><th></th><th>PostgreSQL (heap)</th><th>InnoDB / WiredTiger clustered</th></tr>
      <tr><td>Dòng dữ liệu ở đâu</td><td>Heap page, không theo thứ tự</td><td>Trong lá của B+tree khoá chính (InnoDB); WiredTiger lưu document theo RecordId nội bộ</td></tr>
      <tr><td>Index phụ trỏ tới</td><td>ctid (vị trí vật lý)</td><td>Khoá chính (InnoDB) → tra thêm một lần B-tree</td></tr>
      <tr><td>Hệ quả</td><td>UPDATE tạo tuple mới → mọi index có thể phải cập nhật (trừ HOT update)</td><td>Khoá chính to (UUID string) làm mọi index phụ to theo</td></tr>
    </table>

    <div class="callout"><p>💡 Hibernate <code>@GeneratedValue(strategy = GenerationType.UUID)</code> sinh UUIDv4 ngẫu nhiên. Với bảng ghi nhiều, cân nhắc UUIDv7
    (PostgreSQL 18 có sẵn hàm <code>uuidv7()</code>) hoặc bigint: cùng là B-tree nhưng hành vi cache khác nhau hoàn toàn.</p></div>
  `,

  codeTabs: [
    { id: "tree", label: "Hình cây", lines: [
      "                 [ 100 | 200 ]                  ← gốc (luôn trong RAM)",
      "        /              |              \\",
      "  [ 20 | 60 ]     [ 130 | 170 ]     [ 250 | 300 ]   ← node trong",
      "   /   |   \\        /   |   \\         ...",
      "[..19][20..59][60..99]→[100..129]→[130..169]→ ...  ← lá, nối nhau",
      "",
      "# tìm 142: gốc (100≤142<200) → node giữa (130≤142<170) → lá [130..169]",
      "# 3 page. Quét 142..400: tìm lá đầu rồi đi ngang theo con trỏ phải"
    ]},
    { id: "split", label: "Page split", lines: [
      "lá L đầy: [130 131 135 140 150 155 160 169]",
      "insert 142",
      "→ tách: L  = [130 131 135 140]",
      "        L' = [142 150 155 160 169]",
      "→ đẩy khoá phân cách 142 lên node cha: [130 | 142 | 170]",
      "",
      "# cha đầy thì tách tiếp; tách tới gốc thì cây cao thêm 1 tầng"
    ]},
    { id: "sql", label: "Đo trong PostgreSQL", lines: [
      "CREATE EXTENSION pageinspect;",
      "SELECT level FROM bt_metap('orders_pkey');     -- level của gốc: 2 → cây 3 tầng",
      "",
      "CREATE EXTENSION pgstattuple;",
      "SELECT avg_leaf_density, leaf_fragmentation",
      "FROM pgstatindex('orders_pkey');",
      "-- khoá bigint tuần tự: density ~90%   (fillfactor B-tree mặc định 90)",
      "-- khoá UUIDv4:         density thấp hơn nhiều, index to hơn"
    ]},
    { id: "java", label: "Chọn khoá ở JPA", lines: [
      "@Entity",
      "class Order {",
      "    @Id",
      "    @GeneratedValue(strategy = GenerationType.IDENTITY)  // bigint tăng dần",
      "    Long id;",
      "}",
      "",
      "// UUIDv4: insert rơi ngẫu nhiên khắp B-tree",
      "// @GeneratedValue(strategy = GenerationType.UUID) UUID id;",
      "",
      "-- UUIDv7: vẫn là UUID nhưng tăng theo thời gian (PostgreSQL 18)",
      "CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT uuidv7(), ...);"
    ]}
  ],

  stageHtml: `
    <div class="node" id="root"><div class="nl">🌳 Gốc [100 | 200]</div><div class="ns">page luôn trong RAM</div></div>
    <div class="arrow" id="a1">↓ 142 nằm giữa 100 và 200</div>
    <div class="node" id="mid"><div class="nl">Node trong [130 | 170]</div><div class="ns">fanout hàng trăm</div></div>
    <div class="arrow" id="a2">↓ 130 ≤ 142 &lt; 170</div>
    <div class="row">
      <div class="node" id="leaf"><div class="nl">🍃 Lá [130..169]</div><div class="ns">khoá + ctid</div></div>
      <div class="node" id="leaf2"><div class="nl">🍃 Lá kế bên</div><div class="ns">nối ngang → range scan</div></div>
    </div>
    <div class="arrow" id="a3">↓ lá đầy khi insert</div>
    <div class="node" id="split"><div class="nl">✂️ Page split</div><div class="ns">chia đôi, đẩy khoá lên cha</div></div>
  `,
  steps: [
    { title: "1 · Đi từ gốc", tab: "tree", highlight: [1, 7], on: ["root", "a1"],
      desc: "So sánh khoá với các khoá phân cách để chọn nhánh. Gốc gần như luôn trong buffer pool." },
    { title: "2 · Xuống node trong", tab: "tree", highlight: [3, 7], on: ["mid", "a2"],
      desc: "Fanout lớn → cây chỉ 3–4 tầng cho hàng tỷ khoá." },
    { title: "3 · Tới lá, quét ngang", tab: "tree", highlight: [5, 8], on: ["leaf", "leaf2"],
      desc: "Lá nối nhau theo thứ tự nên range scan và ORDER BY theo khoá rất rẻ." },
    { title: "4 · Insert làm lá đầy → split", tab: "split", highlight: [1, 2, 3, 4, 5], on: ["a3", "split"],
      desc: "Chia đôi page, đẩy khoá phân cách lên cha. Mỗi split là thêm ghi page + WAL." },
    { title: "5 · Khoá tuần tự vs ngẫu nhiên", tab: "sql", highlight: [5, 6, 7, 8], on: ["leaf", "split"],
      desc: "Khoá tăng dần chỉ làm nóng lá phải cùng; UUIDv4 rải khắp cây, index to và phải nằm trọn RAM." },
    { title: "6 · Áp vào JPA", tab: "java", highlight: [4, 9, 12], on: ["root"],
      desc: "Cách sinh id trong entity quyết định hành vi B-tree ở DB." }
  ],

  quiz: [
    { q: "Trong B+tree, dữ liệu (hoặc con trỏ tới dữ liệu) nằm ở đâu?", options: [
        "Chỉ ở gốc", "Ở node lá; node trong chỉ chứa khoá phân cách", "Rải đều mọi node", "Trong WAL"
      ], correct: 1, explanation: "Node trong chỉ để định hướng, nên chứa được nhiều khoá hơn." },
    { q: "Vì sao B+tree chỉ cao 3–4 tầng cho hàng tỷ dòng?", options: [
        "Vì nén dữ liệu",
        "Mỗi node là một page chứa hàng trăm khoá (fanout lớn)",
        "Vì chỉ lưu khoá chẵn",
        "Vì dùng hash"
      ], correct: 1, explanation: "300^4 ≈ 8 tỷ." },
    { q: "Điều gì làm range scan (BETWEEN) trên B+tree rẻ?", options: [
        "Các lá được nối với nhau theo thứ tự khoá",
        "Gốc chứa toàn bộ dữ liệu",
        "Hash của khoá",
        "Bloom filter"
      ], correct: 0, explanation: "Tìm lá đầu rồi đi ngang, không phải quay lại gốc." },
    { q: "Page split xảy ra khi nào?", options: [
        "Khi đọc", "Khi insert vào page lá đã đầy", "Khi VACUUM", "Khi backup"
      ], correct: 1, explanation: "Page được chia đôi và khoá phân cách đẩy lên cha." },
    { q: "Vì sao khoá chính UUIDv4 thường làm insert chậm hơn bigint tăng dần trên bảng lớn?", options: [
        "UUID không so sánh được",
        "Insert rơi ngẫu nhiên khắp lá → nhiều page nóng, split khắp nơi, cache kém, WAL phình",
        "UUID không có index",
        "PostgreSQL cấm UUID"
      ], correct: 1, explanation: "Khoá tuần tự chỉ làm nóng lá phải cùng." },
    { q: "Ưu điểm của UUIDv7 so với UUIDv4 khi làm khoá B-tree?", options: [
        "Ngắn hơn",
        "Có tiền tố thời gian nên gần tuần tự, insert dồn về cuối cây",
        "Không cần index",
        "Mã hoá dữ liệu"
      ], correct: 1, explanation: "Vẫn 128 bit, vẫn khó đoán hơn bigint, nhưng thân thiện với B-tree." },
    { q: "Index phụ trong InnoDB trỏ tới gì?", options: [
        "ctid", "Giá trị khoá chính", "Offset file", "Số page"
      ], correct: 1, explanation: "Vì dòng nằm trong B+tree khoá chính; khoá chính to thì mọi index phụ to theo." },
    { q: "Index B-tree trong PostgreSQL trỏ tới gì?", options: [
        "Khoá chính", "ctid (vị trí vật lý của tuple trong heap)", "Tên cột", "WAL LSN"
      ], correct: 1, explanation: "PostgreSQL lưu bảng dạng heap, không clustered." },
    { q: "'Write amplification' của B-tree nghĩa là?", options: [
        "Ghi 2 lần cùng một lúc lên 2 đĩa",
        "Một thay đổi vài byte vẫn làm dirty và ghi lại cả page (cộng WAL)",
        "Tăng tốc ghi",
        "Nén khi ghi"
      ], correct: 1, explanation: "Đây là lý do LSM-tree ra đời cho workload ghi nhiều (bài 05)." }
  ]
});
