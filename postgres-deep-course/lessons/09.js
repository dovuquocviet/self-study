window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Index chuyên sâu",
  title: "GIN, GiST, BRIN — khi B-tree bó tay",
  subtitle: "Inverted index cho JSONB/mảng/full-text · cây tổng quát cho khoảng & hình học · tóm tắt khối trang",

  theory: `
    <p>B-tree cần một thứ tự tuyến tính. Nhưng "tài liệu JSON này <em>có chứa</em> cặp key-value kia không", "hai khoảng thời gian có <em>chồng lên nhau</em> không", "tên chứa chuỗi 'nguyen' ở giữa" — không có thứ tự nào giúp được. Đó là việc của các access method khác.</p>

    <table>
      <tr><th>Loại</th><th>Ý tưởng</th><th>Dùng cho</th><th>Toán tử tiêu biểu</th></tr>
      <tr><td><strong>GIN</strong></td><td>Inverted index: mỗi <em>phần tử</em> (key JSON, phần tử mảng, từ, trigram) → danh sách TID</td><td>JSONB, mảng, full-text (tsvector), <code>pg_trgm</code></td><td><code>@&gt;</code>, <code>?</code>, <code>&amp;&amp;</code>, <code>@@</code>, <code>LIKE '%x%'</code></td></tr>
      <tr><td><strong>GiST</strong></td><td>Cây cân bằng tổng quát, mỗi nút giữ "vùng bao" (bounding) các con</td><td>range type, hình học/PostGIS, exclusion constraint, KNN</td><td><code>&amp;&amp;</code> (overlap), <code>@&gt;</code>, <code>&lt;-&gt;</code> (khoảng cách)</td></tr>
      <tr><td><strong>BRIN</strong></td><td>Mỗi khối <code>pages_per_range</code> (mặc định 128 trang) lưu min/max</td><td>Bảng rất lớn, cột tương quan với thứ tự vật lý (timestamp của log chỉ INSERT)</td><td><code>&lt;</code>, <code>=</code>, <code>&gt;</code>, BETWEEN</td></tr>
      <tr><td>SP-GiST</td><td>Cây phân hoạch không cân bằng (quadtree, radix)</td><td>IP/CIDR, điểm, tiền tố text</td><td></td></tr>
      <tr><td>Hash</td><td>Băm</td><td>Chỉ <code>=</code>; hiếm khi hơn B-tree</td><td><code>=</code></td></tr>
    </table>

    <p><strong>GIN — đánh đổi</strong>: đọc rất nhanh cho truy vấn "chứa", nhưng một row sinh nhiều entry (mỗi key/từ một entry) → ghi đắt. <code>fastupdate</code> (mặc định bật) gom entry mới vào <em>pending list</em>, gộp vào cây khi VACUUM hoặc khi list vượt <code>gin_pending_list_limit</code> (4 MB) — có lúc một INSERT "xui" phải gánh việc gộp. GIN không hỗ trợ sort, không index-only scan.</p>

    <p><strong>GiST — exclusion constraint</strong>: "không được có hai lượt đặt phòng chồng giờ trên cùng một phòng" — thứ UNIQUE không làm được. Cần extension <code>btree_gist</code> để trộn <code>=</code> trên cột thường với <code>&amp;&amp;</code> trên range.</p>

    <p><strong>BRIN — tí hon</strong>: index cho bảng 1 TB có thể chỉ vài MB. Query <code>created_at</code> trong 1 ngày → loại các khối có [min,max] không giao, chỉ đọc khối còn lại (Bitmap Heap Scan có "Rows Removed by Index Recheck"). Vô dụng nếu dữ liệu vật lý lộn xộn (UPDATE nhiều, cột ngẫu nhiên như UUID v4).</p>

    <div class="callout"><p>💡 Với các bạn quen Elasticsearch: GIN + tsvector là full-text "đủ dùng" ngay trong PostgreSQL (tách từ, stemming theo ngôn ngữ, xếp hạng <code>ts_rank</code>), <code>pg_trgm</code> cho tìm gần đúng/LIKE giữa chuỗi. Khi cần relevance phức tạp, faceting, nhiều ngôn ngữ, scale riêng → vẫn là ES.</p></div>
  `,

  codeTabs: [
    { id: "gin", label: "① GIN: JSONB & trigram", lines: [
      "CREATE INDEX products_attrs_gin ON products USING gin (attrs jsonb_path_ops);",
      "SELECT id FROM products WHERE attrs @> '{\"color\": \"red\", \"size\": \"M\"}';",
      "",
      "CREATE EXTENSION pg_trgm;",
      "CREATE INDEX customers_name_trgm ON customers USING gin (name gin_trgm_ops);",
      "SELECT id, name FROM customers WHERE name ILIKE '%nguyen van%';",
      "",
      "-- full-text",
      "CREATE INDEX posts_fts ON posts USING gin (to_tsvector('simple', title || ' ' || body));",
      "SELECT id FROM posts",
      "WHERE to_tsvector('simple', title || ' ' || body) @@ plainto_tsquery('simple', 'hoàn tiền');"
    ]},
    { id: "gist", label: "② GiST: exclusion", lines: [
      "CREATE EXTENSION btree_gist;",
      "",
      "CREATE TABLE booking (",
      "  room_id int NOT NULL,",
      "  during  tstzrange NOT NULL,",
      "  EXCLUDE USING gist (room_id WITH =, during WITH &&)",
      ");",
      "",
      "INSERT INTO booking VALUES (7, '[2026-10-01 09:00, 2026-10-01 11:00)');",
      "INSERT INTO booking VALUES (7, '[2026-10-01 10:00, 2026-10-01 12:00)');",
      "-- ERROR: conflicting key value violates exclusion constraint \"booking_room_id_during_excl\""
    ]},
    { id: "brin", label: "③ BRIN: log khổng lồ", lines: [
      "CREATE INDEX events_created_brin ON events USING brin (created_at)",
      "    WITH (pages_per_range = 64);",
      "",
      "SELECT pg_size_pretty(pg_relation_size('events')),               -- 820 GB",
      "       pg_size_pretty(pg_relation_size('events_created_brin'));  -- 3 MB",
      "",
      " Bitmap Heap Scan on events",
      "   Recheck Cond: (created_at >= '2026-09-26' AND created_at < '2026-09-27')",
      "   Rows Removed by Index Recheck: 12544",
      "   ->  Bitmap Index Scan on events_created_brin"
    ]},
    { id: "choose", label: "④ Bảng chọn nhanh", lines: [
      "# Câu hỏi                                   → Index",
      "# =, <, >, ORDER BY, LIKE 'abc%'            → B-tree",
      "# JSONB @> / ?, mảng &&, full-text @@       → GIN",
      "# LIKE '%abc%', similarity                  → GIN + pg_trgm",
      "# khoảng chồng nhau, EXCLUDE, PostGIS, KNN  → GiST",
      "# bảng append-only cực lớn, lọc theo thời gian → BRIN",
      "# chỉ = trên giá trị rất dài                → Hash (hiếm)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="gin"><div class="nl">🔤 GIN</div><div class="ns">'red' → {TID 3, 9, 12} · 'M' → {TID 3, 7}</div></div>
      <div class="node" id="gist"><div class="nl">📐 GiST</div><div class="ns">nút cha = vùng bao các khoảng con</div></div>
      <div class="node" id="brin"><div class="nl">🧱 BRIN</div><div class="ns">khối 0–63: [09-01, 09-02] · khối 64–127: …</div></div>
    </div>
    <div class="arrow" id="a1">↓ trả tập TID / khối ứng viên</div>
    <div class="node" id="bm"><div class="nl">🗺️ Bitmap Heap Scan</div><div class="ns">đọc trang ứng viên, Recheck điều kiện</div></div>
  `,
  steps: [
    { title: "1 · GIN cho JSONB", tab: "gin", highlight: [1, 2], on: ["gin"],
      desc: "Mỗi cặp path/value được băm thành một key; query @> lấy giao các danh sách TID. <code>jsonb_path_ops</code> nhỏ hơn opclass mặc định nhưng chỉ hỗ trợ @>, @?, @@." },
    { title: "2 · GIN + trigram", tab: "gin", highlight: [4, 5, 6], on: ["gin"],
      desc: "Chuỗi được cắt thành các cụm 3 ký tự; ILIKE '%nguyen van%' trở thành giao các trigram → không cần seq scan." },
    { title: "3 · GiST exclusion constraint", tab: "gist", highlight: [6, 9, 10, 11], on: ["gist"],
      desc: "Ràng buộc 'không chồng giờ trên cùng phòng' được DB đảm bảo kể cả khi hai request chèn đồng thời." },
    { title: "4 · BRIN cho log", tab: "brin", highlight: [1, 4, 5], on: ["brin"],
      desc: "820 GB dữ liệu, index 3 MB. Hiệu quả vì created_at tăng dần đúng theo thứ tự INSERT." },
    { title: "5 · Bitmap + Recheck", tab: "brin", highlight: [7, 8, 9, 10], on: ["a1", "bm"],
      desc: "BRIN (và GIN) trả về tập ứng viên, không chính xác từng row → Bitmap Heap Scan đọc trang và kiểm tra lại." },
    { title: "6 · Chọn đúng loại", tab: "choose", highlight: [2, 3, 4, 5, 6], on: ["gin", "gist", "brin"],
      desc: "Chọn theo <em>toán tử</em> query dùng, không theo kiểu cột." }
  ],

  quiz: [
    { q: "Index nào phù hợp cho WHERE attrs @> '{\"color\":\"red\"}' trên cột JSONB?", options: [
        "B-tree", "GIN", "BRIN", "Hash"
      ], correct: 1, explanation: "GIN là inverted index cho toán tử 'chứa'." },
    { q: "LIKE '%nguyen%' (wildcard ở đầu) nhanh được nhờ gì?", options: [
        "B-tree với text_pattern_ops",
        "GIN (hoặc GiST) với pg_trgm",
        "BRIN",
        "Không thể tăng tốc"
      ], correct: 1, explanation: "B-tree chỉ giúp LIKE có tiền tố cố định." },
    { q: "Ràng buộc 'không có 2 booking chồng giờ trong cùng phòng' dùng gì?", options: [
        "UNIQUE (room_id, during)",
        "EXCLUDE USING gist (room_id WITH =, during WITH &&)",
        "CHECK constraint",
        "Foreign key"
      ], correct: 1, explanation: "Cần btree_gist để dùng = trên int trong GiST." },
    { q: "BRIN hiệu quả khi nào?", options: [
        "Cột UUID v4 ngẫu nhiên",
        "Giá trị cột tương quan mạnh với vị trí vật lý, vd created_at của bảng chỉ INSERT",
        "Bảng nhỏ vài nghìn row",
        "Tìm kiếm full-text"
      ], correct: 1, explanation: "BRIN lưu min/max mỗi khối trang; dữ liệu lộn xộn thì khối nào cũng khớp." },
    { q: "Nhược điểm chính của GIN?", options: [
        "Không hỗ trợ JSONB",
        "Ghi đắt vì một row sinh nhiều entry; không hỗ trợ sắp xếp",
        "Kích thước luôn lớn hơn bảng",
        "Không dùng được với mảng"
      ], correct: 1, explanation: "fastupdate/pending list giảm chi phí ghi nhưng đôi khi gây trễ đột biến." },
    { q: "'Rows Removed by Index Recheck' xuất hiện với BRIN nghĩa là?", options: [
        "Lỗi index",
        "BRIN chỉ trả khối ứng viên; row trong khối không thoả điều kiện bị loại khi kiểm tra lại",
        "Row bị xoá",
        "Index bị bloat"
      ], correct: 1, explanation: "Bình thường với index 'lossy'." },
    { q: "jsonb_path_ops so với jsonb_ops (mặc định)?", options: [
        "Hỗ trợ nhiều toán tử hơn",
        "Nhỏ và nhanh hơn cho @>, nhưng không hỗ trợ toán tử kiểm tra key ?, ?|, ?&",
        "Giống hệt",
        "Chỉ cho mảng"
      ], correct: 1, explanation: "Chọn theo query thực tế." },
    { q: "Toán tử <-> với GiST dùng cho?", options: [
        "So sánh bằng",
        "Sắp xếp theo khoảng cách — tìm K điểm gần nhất (KNN)",
        "Nối chuỗi",
        "Phủ định"
      ], correct: 1, explanation: "ORDER BY location <-> point LIMIT 10." },
    { q: "Hash index nên dùng khi nào?", options: [
        "Luôn thay B-tree",
        "Hiếm khi — chỉ hỗ trợ =, đôi khi có lợi về kích thước với giá trị rất dài",
        "Cho range query",
        "Cho ORDER BY"
      ], correct: 1, explanation: "Từ PG 10 hash index mới được WAL-log và an toàn crash." }
  ]
});
