window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Mô hình dữ liệu",
  title: "JSONB: khi nào dùng, toán tử, index & cái giá khi cập nhật",
  subtitle: "json vs jsonb · -> ->> @> ? · jsonpath · GIN · TOAST · so với MongoDB",

  theory: `
    <p>JSONB cho phép một cột "không schema" trong bảng quan hệ. Rất tiện cho thuộc tính sản phẩm khác nhau theo loại, payload webhook, cấu hình. Nhưng nó <em>không</em> biến PostgreSQL thành MongoDB — hiểu cách lưu trữ để biết giới hạn.</p>

    <p><strong>json vs jsonb</strong>: <code>json</code> lưu nguyên văn chuỗi (giữ khoảng trắng, thứ tự key, key trùng), mỗi lần truy cập phải parse lại. <code>jsonb</code> lưu dạng nhị phân đã phân tích: bỏ khoảng trắng, key sắp xếp lại, key trùng giữ cái cuối; truy cập nhanh và <strong>index được</strong>. Gần như luôn dùng <code>jsonb</code>.</p>

    <table>
      <tr><th>Toán tử</th><th>Ý nghĩa</th><th>Ví dụ</th></tr>
      <tr><td><code>-&gt;</code></td><td>Lấy phần tử, trả jsonb</td><td><code>attrs -&gt; 'dims'</code></td></tr>
      <tr><td><code>-&gt;&gt;</code></td><td>Lấy phần tử, trả text</td><td><code>attrs -&gt;&gt; 'color'</code></td></tr>
      <tr><td><code>#&gt;</code>, <code>#&gt;&gt;</code></td><td>Theo đường dẫn</td><td><code>attrs #&gt;&gt; '{dims,w}'</code></td></tr>
      <tr><td><code>@&gt;</code></td><td>Chứa (containment)</td><td><code>attrs @&gt; '{"color":"red"}'</code></td></tr>
      <tr><td><code>?</code>, <code>?|</code>, <code>?&amp;</code></td><td>Có key / có một trong / có tất cả</td><td><code>attrs ? 'warranty'</code></td></tr>
      <tr><td><code>@?</code>, <code>@@</code></td><td>jsonpath (PG 12+)</td><td><code>attrs @? '$.sizes[*] ? (@ == "M")'</code></td></tr>
      <tr><td><code>||</code>, <code>-</code>, <code>jsonb_set</code></td><td>Gộp, xoá key, đặt giá trị</td><td></td></tr>
    </table>
    <p>PG 14+ còn có cú pháp subscript: <code>attrs['color']</code>, và PG 17 thêm <code>JSON_TABLE</code> để biến JSON thành bảng.</p>

    <p><strong>Index</strong></p>
    <ul>
      <li><strong>GIN</strong> trên cả cột (bài 09) cho <code>@&gt;</code>, <code>?</code>, jsonpath. <code>jsonb_path_ops</code> nhỏ hơn, chỉ cho <code>@&gt;</code>/<code>@?</code>/<code>@@</code>.</li>
      <li><strong>B-tree trên biểu thức</strong> cho một field hay lọc/sort: <code>((attrs -&gt;&gt; 'brand'))</code>. Nhớ query phải viết đúng <code>attrs -&gt;&gt; 'brand' = ...</code>, <em>không</em> phải <code>@&gt;</code>.</li>
      <li>Planner <strong>không có thống kê</strong> bên trong JSONB (ước lượng cố định) → field quan trọng nên là cột thật, hoặc expression index/CREATE STATISTICS trên biểu thức để có thống kê.</li>
    </ul>

    <p><strong>Cái giá khi cập nhật</strong>: JSONB là <em>một giá trị</em>. Sửa một key = ghi lại cả document (MVCC tạo tuple mới). Document &gt; ~2 KB được <strong>TOAST</strong> (nén + cắt ra bảng phụ) → mỗi lần sửa ghi lại toàn bộ phần TOAST. Document 1 MB cập nhật 1 counter mỗi giây là thảm hoạ.</p>

    <div class="callout"><p>💡 Quy tắc thực dụng: field có trong WHERE/JOIN/ORDER BY thường xuyên, có ràng buộc (NOT NULL, FK, unique), hoặc cập nhật thường xuyên → <strong>cột thật</strong>. Phần đuôi dài thay đổi theo loại, ít truy vấn → JSONB. Có thể thêm <code>CHECK (jsonb_typeof(attrs) = 'object')</code> để giữ tối thiểu hình dạng.</p></div>
  `,

  codeTabs: [
    { id: "q", label: "① Truy vấn", lines: [
      "CREATE TABLE products (",
      "  id bigint PRIMARY KEY, sku text NOT NULL UNIQUE, price numeric(12,2) NOT NULL,",
      "  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')",
      ");",
      "",
      "SELECT sku, attrs ->> 'color' AS color, (attrs #>> '{dims,w}')::int AS width",
      "FROM products",
      "WHERE attrs @> '{\"brand\": \"Acme\"}'",
      "  AND attrs ? 'warranty'",
      "  AND attrs @? '$.sizes[*] ? (@ == \"M\")';"
    ]},
    { id: "idx", label: "② Index", lines: [
      "-- containment / key-exists / jsonpath",
      "CREATE INDEX products_attrs_gin ON products USING gin (attrs);",
      "",
      "-- 1 field hay dùng để lọc/sắp xếp: B-tree biểu thức (có thống kê riêng)",
      "CREATE INDEX products_brand_idx ON products ((attrs ->> 'brand'));",
      "SELECT id FROM products WHERE attrs ->> 'brand' = 'Acme' ORDER BY attrs ->> 'brand';",
      "",
      "-- hoặc đưa ra cột thật (PG 12+ generated column, được lưu và index được)",
      "ALTER TABLE products ADD COLUMN brand text",
      "  GENERATED ALWAYS AS (attrs ->> 'brand') STORED;"
    ]},
    { id: "upd", label: "③ Cập nhật", lines: [
      "-- đặt 1 key — vẫn ghi lại CẢ document thành tuple mới",
      "UPDATE products SET attrs = jsonb_set(attrs, '{stock}', '12') WHERE id = 1;",
      "UPDATE products SET attrs = attrs || '{\"color\": \"blue\"}' WHERE id = 1;",
      "UPDATE products SET attrs = attrs - 'legacy_code' WHERE id = 1;",
      "",
      "SELECT pg_column_size(attrs) FROM products WHERE id = 1;   -- byte sau nén",
      "",
      "-- ❌ counter đổi liên tục trong document lớn → tách ra cột/bảng riêng",
      "-- ✅ ALTER TABLE products ADD COLUMN stock int NOT NULL DEFAULT 0;"
    ]},
    { id: "rust", label: "④ sqlx + serde", lines: [
      "#[derive(serde::Deserialize, serde::Serialize)]",
      "struct Attrs { brand: String, color: Option<String>, sizes: Vec<String> }",
      "",
      "#[derive(sqlx::FromRow)]",
      "struct Product { id: i64, sku: String, attrs: sqlx::types::Json<Attrs> }",
      "",
      "let p: Product = sqlx::query_as(\"SELECT id, sku, attrs FROM products WHERE id = $1\")",
      "    .bind(1_i64).fetch_one(&pool).await?;",
      "println!(\"{}\", p.attrs.0.brand);      // Json<T> tự (de)serialize jsonb",
      "",
      "sqlx::query(\"UPDATE products SET attrs = $2 WHERE id = $1\")",
      "    .bind(1_i64).bind(sqlx::types::Json(&new_attrs)).execute(&pool).await?;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="doc"><div class="nl">📄 attrs jsonb</div><div class="ns">{brand, color, sizes[], dims{w,h}, …}</div></div>
    <div class="arrow" id="a1">↓ truy vấn</div>
    <div class="row">
      <div class="node" id="gin"><div class="nl">🔤 GIN</div><div class="ns">@&gt; · ? · jsonpath</div></div>
      <div class="node" id="bt"><div class="nl">🌲 B-tree biểu thức</div><div class="ns">attrs -&gt;&gt; 'brand'</div></div>
    </div>
    <div class="arrow" id="a2">↓ cập nhật 1 key</div>
    <div class="node" id="rw"><div class="nl">♻️ Ghi lại cả document</div><div class="ns">tuple mới + TOAST mới nếu &gt; ~2KB</div></div>
  `,
  steps: [
    { title: "1 · Cột JSONB có kiểm tra hình dạng", tab: "q", highlight: [3], on: ["doc"],
      desc: "Cột thật cho thứ quan trọng (sku, price), JSONB cho phần đuôi linh hoạt, CHECK đảm bảo luôn là object." },
    { title: "2 · Toán tử truy vấn", tab: "q", highlight: [6, 8, 9, 10], on: ["a1"],
      desc: "->> trả text (cần ép kiểu khi so số), @> kiểm tra chứa, ? kiểm tra key, @? chạy jsonpath." },
    { title: "3 · GIN cho truy vấn 'chứa'", tab: "idx", highlight: [2], on: ["gin"],
      desc: "Một index phục vụ nhiều kiểu điều kiện trên mọi key." },
    { title: "4 · B-tree / generated column cho field nóng", tab: "idx", highlight: [5, 6, 9, 10], on: ["bt"],
      desc: "Field hay lọc/sort nên có B-tree biểu thức hoặc cột generated — có thống kê, sort được, dùng được với = và khoảng." },
    { title: "5 · Cái giá của UPDATE", tab: "upd", highlight: [2, 3, 4, 6, 9], on: ["a2", "rw"],
      desc: "Mọi hàm sửa đều tạo lại toàn bộ giá trị. Dữ liệu cập nhật thường xuyên nên nằm ở cột riêng." },
    { title: "6 · Map sang struct Rust", tab: "rust", highlight: [2, 5, 9, 12], on: ["doc"],
      desc: "<code>sqlx::types::Json&lt;T&gt;</code> + serde: đọc/ghi jsonb thành struct có kiểu, thay cho <code>@JdbcTypeCode(SqlTypes.JSON)</code> bên Hibernate." }
  ],

  quiz: [
    { q: "Khác biệt chính giữa json và jsonb?", options: [
        "Không khác",
        "jsonb lưu dạng nhị phân đã parse, truy cập nhanh và index được; json lưu nguyên văn",
        "json nhanh hơn khi truy vấn",
        "jsonb giữ nguyên thứ tự key"
      ], correct: 1, explanation: "jsonb bỏ khoảng trắng, sắp xếp key, bỏ key trùng." },
    { q: "attrs ->> 'color' trả về kiểu gì?", options: ["jsonb", "text", "int", "boolean"], correct: 1,
      explanation: "-> trả jsonb, ->> trả text." },
    { q: "Toán tử kiểm tra 'document chứa cặp brand = Acme'?", options: [
        "attrs ? 'Acme'", "attrs @> '{\"brand\":\"Acme\"}'", "attrs -> 'brand' = 'Acme'", "attrs || 'Acme'"
      ], correct: 1, explanation: "@> là containment, được GIN hỗ trợ." },
    { q: "Có B-tree trên (attrs ->> 'brand'). Query nào dùng được?", options: [
        "WHERE attrs @> '{\"brand\":\"Acme\"}'",
        "WHERE attrs ->> 'brand' = 'Acme'",
        "WHERE attrs ? 'brand'",
        "Cả ba"
      ], correct: 1, explanation: "Expression index chỉ phục vụ đúng biểu thức đó." },
    { q: "Cập nhật một key trong document JSONB 500 KB thì PostgreSQL ghi gì?", options: [
        "Chỉ vài byte của key",
        "Toàn bộ giá trị mới (tuple mới, dữ liệu TOAST mới)",
        "Chỉ WAL",
        "Không ghi gì cho tới VACUUM"
      ], correct: 1, explanation: "Vì vậy counter/field nóng nên là cột riêng." },
    { q: "Vì sao planner thường ước lượng sai với điều kiện trên field JSONB?", options: [
        "JSONB không có index",
        "ANALYZE không thu thống kê cho từng key bên trong JSONB, planner dùng hằng số mặc định",
        "Vì JSONB nén",
        "Vì thiếu work_mem"
      ], correct: 1, explanation: "Expression index hoặc CREATE STATISTICS trên biểu thức tạo thống kê riêng." },
    { q: "Field nào NÊN là cột thật thay vì nằm trong JSONB?", options: [
        "Mô tả marketing dài ít truy vấn",
        "Field lọc/sort thường xuyên, cần ràng buộc, hoặc cập nhật liên tục",
        "Thuộc tính tuỳ chọn khác nhau theo loại sản phẩm",
        "Payload webhook gốc để debug"
      ], correct: 1, explanation: "JSONB cho phần linh hoạt, ít truy vấn." },
    { q: "Trong sqlx, kiểu nào map jsonb ↔ struct serde?", options: [
        "String", "sqlx::types::Json<T>", "Vec<u8>", "serde_json::Map chỉ đọc"
      ], correct: 1, explanation: "serde_json::Value cũng dùng được khi không có struct cố định." },
    { q: "Generated column STORED (PG 12+) dùng thế nào với JSONB?", options: [
        "Không dùng được",
        "Tách một field ra cột được tính tự động, lưu thật và index/thống kê như cột thường",
        "Chỉ để hiển thị",
        "Thay thế GIN"
      ], correct: 1, explanation: "GENERATED ALWAYS AS (attrs ->> 'brand') STORED." }
  ]
});
