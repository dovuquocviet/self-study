window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "MergeTree sâu",
  title: "Primary index thưa: ORDER BY vs PRIMARY KEY và cách chọn khoá",
  subtitle: "1 entry / granule · binary search trên mark · thứ tự cột quyết định tất cả",

  theory: `
    <p>Primary key của ClickHouse <strong>không phải</strong> primary key của Postgres: không đảm bảo duy nhất, không trỏ tới từng hàng.
    Nó là <strong>chỉ mục thưa (sparse index)</strong>: mỗi granule (8192 hàng) chỉ có <em>một</em> entry — giá trị khoá của hàng đầu tiên granule.</p>

    <p>Bảng 1 tỷ hàng ⇒ khoảng 122 nghìn entry ⇒ vài MB, nằm gọn trong RAM. B-tree của Postgres cho 1 tỷ hàng thì cỡ chục GB.</p>

    <p><strong>Cách dùng khi query</strong>: với điều kiện <code>WHERE</code> trên các cột đầu của khoá, ClickHouse tìm nhị phân trên primary.idx để ra
    <em>khoảng mark</em> có thể chứa dữ liệu, rồi chỉ đọc các granule đó. Kết quả luôn là "đọc thừa trong phạm vi granule" — chấp nhận được vì đọc tuần tự rất nhanh.</p>

    <p><strong>ORDER BY vs PRIMARY KEY</strong></p>
    <ul>
      <li><code>ORDER BY</code> = thứ tự sắp xếp dữ liệu trong part (bắt buộc; có thể là <code>tuple()</code> nếu không sort).</li>
      <li><code>PRIMARY KEY</code> = phần đầu (prefix) của ORDER BY được đưa vào primary.idx. Không khai báo thì bằng ORDER BY.</li>
      <li>Tách hai cái khi muốn sort theo nhiều cột (nén tốt hơn / phục vụ Summing, Replacing) mà index chỉ cần vài cột đầu, giữ index nhỏ.</li>
    </ul>

    <p><strong>Chọn thứ tự cột</strong></p>
    <ol>
      <li>Cột hay lọc bằng <code>=</code> nhất đứng đầu (ví dụ <code>tenant_id</code>, <code>event</code>).</li>
      <li>Thường xếp cột có cardinality thấp trước cao sau: vừa lọc tốt ở cột sau, vừa nén tốt (giá trị lặp thành chuỗi dài).</li>
      <li>Cột thời gian thường đặt sau cùng hoặc gần cuối, để lọc khoảng thời gian trong từng nhóm.</li>
      <li>Lọc chỉ theo cột <em>thứ hai</em> của khoá vẫn có thể dùng index (thuật toán "generic exclusion search"), nhưng hiệu quả chỉ tốt khi cột trước đó có cardinality thấp.</li>
    </ol>

    <div class="callout"><p>💡 ORDER BY là quyết định thiết kế quan trọng nhất và <strong>không đổi được</strong> sau khi tạo (chỉ được thêm cột mới vào cuối, cùng lúc với ADD COLUMN).
    Muốn phục vụ thêm kiểu truy vấn khác → dùng projection (bài 07) hoặc bảng thứ hai nuôi bằng MV (bài 13). Hãy liệt kê 5 truy vấn quan trọng nhất trước khi viết DDL.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① DDL", lines: [
      "CREATE TABLE page_views",
      "(",
      "    tenant_id  UInt32,",
      "    url        String,",
      "    ts         DateTime,",
      "    user_id    UInt64,",
      "    duration   UInt32",
      ")",
      "ENGINE = MergeTree",
      "ORDER BY (tenant_id, url, ts)",
      "PRIMARY KEY (tenant_id, url);   -- phải là prefix của ORDER BY"
    ]},
    { id: "idx", label: "② primary.idx", lines: [
      "-- mark  tenant_id  url            (hàng đầu mỗi granule)",
      "-- 0     1          /home",
      "-- 1     1          /product/12",
      "-- 2     1          /product/98",
      "-- 3     2          /cart",
      "-- 4     2          /home",
      "-- 5     3          /blog/a",
      "",
      "-- WHERE tenant_id = 2 AND url = '/home'",
      "-- binary search -> chỉ có thể nằm ở granule 3..4  => đọc 2 × 8192 hàng"
    ]},
    { id: "explain", label: "③ EXPLAIN", lines: [
      "EXPLAIN indexes = 1",
      "SELECT count() FROM page_views",
      "WHERE tenant_id = 2 AND url = '/home';",
      "",
      "-- PrimaryKey",
      "--   Keys: tenant_id, url",
      "--   Condition: and((url in ['/home', '/home']), (tenant_id in [2, 2]))",
      "--   Parts: 3/12",
      "--   Granules: 5/12208      <- chỉ đọc 5 granule"
    ]},
    { id: "bad", label: "④ Chọn sai", lines: [
      "-- Truy vấn chính: WHERE tenant_id = ? AND ts >= ?",
      "",
      "ORDER BY (user_id, tenant_id, ts)  -- sai: user_id đầu, cardinality cao",
      "-- => lọc theo tenant_id gần như phải quét toàn bảng",
      "",
      "ORDER BY (tenant_id, ts)           -- đúng với truy vấn chính",
      "ORDER BY (tenant_id, toStartOfHour(ts), user_id) -- biến thể nén tốt hơn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔎 WHERE tenant_id = 2 AND url = '/home'</div></div>
    <div class="arrow" id="a1">↓ binary search trên primary.idx (trong RAM)</div>
    <div class="node" id="pk"><div class="nl">🔑 Sparse index</div><div class="ns">1 entry / 8192 hàng</div></div>
    <div class="arrow" id="a2">↓ khoảng mark 3..4</div>
    <div class="node" id="mrk"><div class="nl">📍 Marks</div><div class="ns">mark → offset trong .bin</div></div>
    <div class="arrow" id="a3">↓ đọc + giải nén 2 granule</div>
    <div class="node" id="scan"><div class="nl">🔍 Lọc chính xác trong granule</div><div class="ns">bỏ các hàng không khớp</div></div>
  `,
  steps: [
    { title: "1 · ORDER BY vs PRIMARY KEY", tab: "ddl", highlight: [10, 11], on: [],
      desc: "Dữ liệu sort theo 3 cột, index chỉ giữ 2 cột đầu. PRIMARY KEY phải là prefix của ORDER BY." },
    { title: "2 · Index thưa", tab: "idx", highlight: [1, 2, 3, 4, 5, 6, 7], on: ["pk"],
      desc: "Mỗi granule một entry, là khoá của hàng đầu tiên granule. Nhỏ đến mức luôn nằm trong RAM." },
    { title: "3 · Tìm khoảng mark", tab: "idx", highlight: [9, 10], on: ["q", "a1", "a2"],
      desc: "Mọi hàng (2, '/home') phải nằm giữa entry mark 3 (2,'/cart') và entry mark 5 (3,'/blog/a') → granule 3 và 4." },
    { title: "4 · Đọc granule rồi lọc", tab: "explain", highlight: [1, 8, 9], on: ["mrk", "a3", "scan"],
      desc: "EXPLAIN indexes = 1 cho biết số part và granule được chọn — thước đo số 1 xem index có hiệu quả không." },
    { title: "5 · Chọn khoá theo truy vấn", tab: "bad", highlight: [3, 4, 6, 7], on: ["pk"],
      desc: "Khoá bắt đầu bằng cột cardinality cao mà query không lọc → index vô dụng. Khoá phải đi từ truy vấn thật." }
  ],

  quiz: [
    { q: "Primary key trong MergeTree có đảm bảo duy nhất không?", options: [
        "Có, như Postgres",
        "Không; nó chỉ là chỉ mục thưa để bỏ qua granule",
        "Có nếu dùng ReplicatedMergeTree",
        "Chỉ khi PRIMARY KEY khác ORDER BY"
      ], correct: 1, explanation: "Insert 2 hàng cùng khoá thì cả 2 cùng tồn tại." },
    { q: "Primary index lưu bao nhiêu entry?", options: [
        "Một entry cho mỗi hàng",
        "Một entry cho mỗi granule (mặc định 8192 hàng)",
        "Một entry cho mỗi part",
        "Một entry cho mỗi partition"
      ], correct: 1, explanation: "Vì vậy gọi là sparse index." },
    { q: "Quan hệ giữa PRIMARY KEY và ORDER BY?", options: [
        "Độc lập hoàn toàn",
        "PRIMARY KEY phải là prefix của ORDER BY; không khai báo thì bằng ORDER BY",
        "ORDER BY phải là prefix của PRIMARY KEY",
        "Phải giống hệt nhau"
      ], correct: 1, explanation: "Có thể sort theo nhiều cột hơn phần được index." },
    { q: "Truy vấn chính là WHERE tenant_id = ? AND ts BETWEEN ?. Khoá nào hợp lý nhất?", options: [
        "ORDER BY (ts, tenant_id)",
        "ORDER BY (user_id, tenant_id, ts)",
        "ORDER BY (tenant_id, ts)",
        "ORDER BY tuple()"
      ], correct: 2, explanation: "Cột lọc bằng = đứng đầu, khoảng thời gian đứng sau." },
    { q: "Công cụ nào cho biết một query đọc bao nhiêu granule nhờ index?", options: [
        "SHOW INDEX",
        "EXPLAIN indexes = 1",
        "DESCRIBE TABLE",
        "system.merges"
      ], correct: 1, explanation: "Dòng Granules: x/y cho biết số granule được chọn trên tổng." },
    { q: "Có thể đổi ORDER BY của bảng đang chạy thành cột khác hoàn toàn không?", options: [
        "Có, ALTER TABLE MODIFY ORDER BY bất kỳ",
        "Không; chỉ có thể thêm cột mới (vừa ADD) vào cuối. Muốn đổi hẳn phải tạo bảng mới và copy",
        "Có, sau khi OPTIMIZE",
        "Có nếu bảng rỗng một nửa"
      ], correct: 1, explanation: "MODIFY ORDER BY chỉ cho phép nối thêm cột vừa được thêm trong cùng ALTER." },
    { q: "Vì sao thường xếp cột cardinality thấp trước?", options: [
        "Để primary.idx to hơn",
        "Để các cột sau vẫn lọc được tốt và dữ liệu lặp thành chuỗi dài, nén tốt hơn",
        "Vì ClickHouse bắt buộc",
        "Để merge nhanh hơn"
      ], correct: 1, explanation: "Cột đầu cardinality cao làm các cột sau gần như ngẫu nhiên giữa các granule." },
    { q: "WHERE chỉ lọc trên cột thứ hai của khoá thì sao?", options: [
        "Không bao giờ dùng được index",
        "Có thể dùng index (generic exclusion search), hiệu quả tốt khi cột đầu có cardinality thấp",
        "Báo lỗi",
        "Luôn nhanh như lọc cột đầu"
      ], correct: 1, explanation: "Nếu cột đầu cardinality cao, cột hai phân tán khắp nơi, gần như phải đọc hết." },
    { q: "Kết quả của tìm trên sparse index là gì?", options: [
        "Chính xác danh sách hàng khớp",
        "Tập granule CÓ THỂ chứa hàng khớp; phải đọc và lọc tiếp bên trong",
        "Một con trỏ tới hàng",
        "Số hàng khớp"
      ], correct: 1, explanation: "Index chỉ loại trừ granule; lọc chính xác làm sau khi đọc." }
  ]
});
