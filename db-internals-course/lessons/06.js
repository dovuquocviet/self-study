window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Nền tảng lưu trữ",
  title: "Row-store vs column-store — cùng dữ liệu, xếp khác nhau",
  subtitle: "Đọc bao nhiêu byte cho một truy vấn · nén theo cột · vì sao OLTP chọn dòng, OLAP chọn cột",

  theory: `
    <p>Bài 02 nói: đơn vị đọc là page, nên <em>thứ hay đọc cùng nhau phải nằm cạnh nhau</em>. Câu hỏi là "cùng nhau" theo chiều nào?</p>
    <ul>
      <li><strong>Row-store</strong> (PostgreSQL, MySQL, MongoDB): các cột của <em>một dòng</em> nằm liền nhau. Đọc/ghi trọn một đơn hàng = chạm 1 page.</li>
      <li><strong>Column-store</strong> (ClickHouse, và các engine phân tích như Parquet, Snowflake, BigQuery): giá trị của <em>một cột</em> cho mọi dòng nằm liền nhau trong file riêng.
      Tổng một cột trên 1 tỷ dòng = chỉ đọc file của cột đó.</li>
    </ul>

    <p><strong>Phép tính thực tế</strong>: bảng <code>events</code> 1 tỷ dòng, 50 cột, trung bình 200 byte/dòng ≈ 200 GB.
    Truy vấn <code>SELECT country, count() ... GROUP BY country</code> chỉ cần 1 cột (giả sử 2 byte/dòng sau mã hoá).</p>
    <table>
      <tr><th></th><th>Row-store</th><th>Column-store</th></tr>
      <tr><td>Byte phải đọc</td><td>~200 GB (cả dòng)</td><td>~2 GB trước nén, thường vài trăm MB sau nén</td></tr>
      <tr><td>Nén</td><td>Kém: các giá trị cạnh nhau khác kiểu</td><td>Rất tốt: cùng kiểu, lặp nhiều, có thứ tự</td></tr>
      <tr><td>Insert 1 dòng</td><td>Rẻ: ghi 1 chỗ</td><td>Đắt: chạm 50 file cột → phải gom batch</td></tr>
      <tr><td>UPDATE 1 dòng</td><td>Rẻ</td><td>Rất đắt; ClickHouse dùng mutation chạy nền</td></tr>
      <tr><td>SELECT * WHERE id = ?</td><td>Rẻ: 1 page</td><td>Phải ghép 50 cột từ 50 nơi</td></tr>
    </table>

    <p><strong>Vì sao cột nén tốt?</strong> Cột <code>country</code> chỉ có ~200 giá trị khác nhau; nếu dữ liệu được sắp theo nó thì có những đoạn dài lặp lại →
    <em>dictionary encoding</em> (thay chuỗi bằng số nhỏ), <em>run-length encoding</em> (ghi "VN × 10.000"), <em>delta</em> cho timestamp tăng dần, rồi thêm LZ4/ZSTD.
    Tỉ lệ nén 5–10 lần là bình thường, có cột hơn nhiều.</p>

    <p><strong>Lợi ích thứ hai: CPU.</strong> Một cột là mảng cùng kiểu liên tục trong bộ nhớ → xử lý theo lô (vectorized), tận dụng SIMD và cache CPU (bài 14).
    Row-store xử lý từng dòng một, mỗi dòng phải "giải mã" để tìm cột cần.</p>

    <p><strong>Document store</strong> (MongoDB) cũng là row-oriented: cả document nằm cùng nhau — vì vậy nó hợp OLTP theo aggregate, không hợp quét-tổng hợp tỷ dòng.
    <strong>Elasticsearch</strong> lai: lưu <code>_source</code> theo document, nhưng có <em>doc values</em> — lưu theo cột trên đĩa — để sort/aggregation.</p>

    <div class="callout"><p>💡 Đó là lý do công ty đẩy sự kiện từ Kafka sang ClickHouse thay vì chạy báo cáo trên PostgreSQL: cùng câu SQL GROUP BY,
    nhưng một bên đọc 200 GB, một bên đọc vài trăm MB. Và cũng là lý do đừng dùng ClickHouse làm DB đơn hàng cần UPDATE từng dòng.</p></div>
  `,

  codeTabs: [
    { id: "layout", label: "Cách xếp trên đĩa", lines: [
      "Bảng: (id, country, amount, ts)",
      "",
      "Row-store (1 page chứa nhiều dòng liền mạch):",
      "  [1,VN,100,t1][2,VN,250,t2][3,TH,80,t3][4,VN,120,t4] ...",
      "",
      "Column-store (mỗi cột 1 file):",
      "  id.bin      : 1 2 3 4 ...",
      "  country.bin : VN VN TH VN ...",
      "  amount.bin  : 100 250 80 120 ...",
      "  ts.bin      : t1 t2 t3 t4 ..."
    ]},
    { id: "compress", label: "Nén theo cột", lines: [
      "country (đã sắp theo country):",
      "  gốc        : TH TH TH ... (5.000 lần) VN VN VN ... (10.000 lần)",
      "  dictionary : TH→0, VN→1          → mảng số 1 byte",
      "  RLE        : (0 × 5000) (1 × 10000) → vài byte",
      "",
      "ts (tăng dần):",
      "  gốc        : 1727400000 1727400001 1727400003 ...",
      "  delta      : 1727400000 +1 +2 ...  → số nhỏ, nén rất tốt",
      "",
      "# ClickHouse: CODEC(Delta, ZSTD), LowCardinality(String)"
    ]},
    { id: "sql", label: "Cùng SQL, 2 engine", lines: [
      "-- PostgreSQL (row): đọc mọi page của bảng",
      "SELECT country, count(*) FROM events GROUP BY country;",
      "-- Seq Scan on events  (... rows=1000000000)  → đọc ~200 GB",
      "",
      "-- ClickHouse (column): chỉ đọc country.bin",
      "SELECT country, count() FROM events GROUP BY country;",
      "-- Processed 1.00 billion rows, 2.00 GB (... GB/s)",
      "",
      "-- Ngược lại, lấy 1 dòng đầy đủ: PostgreSQL thắng",
      "SELECT * FROM events WHERE id = 42;"
    ]},
    { id: "choose", label: "Khi nào chọn gì", lines: [
      "Row-store  → đọc/ghi trọn thực thể theo khoá, UPDATE thường xuyên, transaction",
      "             (đơn hàng, tài khoản, tồn kho)",
      "Column     → quét nhiều dòng, ít cột, dữ liệu gần như chỉ thêm vào",
      "             (event, log, metric, báo cáo)",
      "Lai        → ES doc values: lưu cột để sort/aggregate trên index tìm kiếm",
      "             PostgreSQL + extension cột, hoặc Parquet trên object storage"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ SELECT country, count() GROUP BY country</div><div class="ns">cần 1 / 50 cột</div></div>
    <div class="row">
      <div class="node" id="row"><div class="nl">🧱 Row-store</div><div class="ns">đọc cả dòng: ~200 GB</div></div>
      <div class="node" id="col"><div class="nl">🏛️ Column-store</div><div class="ns">đọc 1 file cột</div></div>
    </div>
    <div class="arrow" id="a1">↓ nén dictionary + RLE + LZ4</div>
    <div class="node" id="small"><div class="nl">🗜️ Vài trăm MB</div><div class="ns">ít I/O hơn hàng trăm lần</div></div>
    <div class="arrow" id="a2">↓ xử lý theo lô trên mảng cùng kiểu</div>
    <div class="node" id="cpu"><div class="nl">⚙️ Vectorized + SIMD</div><div class="ns">tận dụng cache CPU</div></div>
  `,
  steps: [
    { title: "1 · Hai cách xếp", tab: "layout", highlight: [3, 4, 6, 7, 8, 9, 10], on: ["row", "col"],
      desc: "Row: một dòng liền mạch. Column: một cột liền mạch, mỗi cột một file." },
    { title: "2 · Chỉ đọc cột cần", tab: "sql", highlight: [2, 3, 6, 7], on: ["q", "row", "col"],
      desc: "Cùng câu SQL: row-store phải đọc cả dòng, column-store chỉ đọc file của country." },
    { title: "3 · Nén theo cột", tab: "compress", highlight: [2, 3, 4, 7, 8], on: ["a1", "small"],
      desc: "Cùng kiểu, lặp nhiều, có thứ tự → dictionary, RLE, delta nén cực tốt." },
    { title: "4 · CPU cũng thắng", tab: "compress", highlight: [10], on: ["a2", "cpu"],
      desc: "Mảng cùng kiểu liên tục → xử lý theo lô, SIMD. Chi tiết ở bài 14." },
    { title: "5 · Nhưng dòng lẻ thì thua", tab: "sql", highlight: [9, 10], on: ["row"],
      desc: "Lấy/sửa một dòng đầy đủ: row-store 1 page, column-store phải ghép mọi cột." },
    { title: "6 · Chọn theo workload", tab: "choose", highlight: [1, 3, 5], on: ["row", "col"],
      desc: "OLTP → dòng; OLAP → cột. ES là ví dụ lai với doc values." }
  ],

  quiz: [
    { q: "Trong column-store, dữ liệu nào nằm liền nhau trên đĩa?", options: [
        "Mọi cột của một dòng", "Giá trị của một cột cho nhiều dòng", "Các dòng cùng khoá chính", "Ngẫu nhiên"
      ], correct: 1, explanation: "Mỗi cột thường là một file (hoặc khối) riêng." },
    { q: "Vì sao column-store nén tốt hơn row-store?", options: [
        "Dùng thuật toán nén bí mật",
        "Giá trị cạnh nhau cùng kiểu, lặp nhiều, thường có thứ tự → dictionary, RLE, delta hiệu quả",
        "Vì bỏ bớt dữ liệu",
        "Vì không có index"
      ], correct: 1, explanation: "Row-store xen kẽ nhiều kiểu nên nén kém." },
    { q: "Truy vấn nào row-store làm tốt hơn column-store?", options: [
        "SUM(amount) trên 1 tỷ dòng",
        "SELECT * WHERE id = 42 và UPDATE một dòng",
        "COUNT theo country",
        "AVG theo ngày"
      ], correct: 1, explanation: "Một dòng đầy đủ nằm trong một page." },
    { q: "Insert từng dòng một vào column-store gặp vấn đề gì?", options: [
        "Không có vấn đề",
        "Mỗi dòng phải chạm file của mọi cột → nên gom batch",
        "Mất dữ liệu",
        "Phải khoá cả bảng"
      ], correct: 1, explanation: "Ở ClickHouse còn tạo nhiều part nhỏ (bài 05)." },
    { q: "Run-length encoding nén tốt nhất khi nào?", options: [
        "Giá trị ngẫu nhiên", "Có những đoạn dài cùng giá trị liên tiếp (dữ liệu sắp theo cột đó)", "Chuỗi dài", "Số thực"
      ], correct: 1, explanation: "RLE ghi (giá trị × số lần)." },
    { q: "Delta encoding hợp với cột nào nhất?", options: [
        "Timestamp tăng dần", "Tên khách hàng", "Mô tả sản phẩm", "UUIDv4"
      ], correct: 0, explanation: "Hiệu giữa các giá trị liên tiếp nhỏ nên tốn ít bit." },
    { q: "MongoDB lưu document theo kiểu nào?", options: [
        "Column-oriented", "Row/document-oriented: cả document nằm cùng nhau", "Inverted index", "Log append-only"
      ], correct: 1, explanation: "Hợp đọc/ghi trọn aggregate, không hợp quét-tổng hợp tỷ dòng." },
    { q: "Doc values trong Elasticsearch là gì?", options: [
        "Bản sao _source",
        "Lưu giá trị field theo cột trên đĩa để sort/aggregation",
        "Cache truy vấn",
        "Log ghi"
      ], correct: 1, explanation: "Inverted index trả lời 'term → doc'; doc values trả lời 'doc → giá trị' hiệu quả cho aggregate." },
    { q: "Vì sao chạy báo cáo phân tích trên ClickHouse thay vì PostgreSQL OLTP?", options: [
        "ClickHouse hỗ trợ transaction tốt hơn",
        "Chỉ đọc cột cần, nén tốt, xử lý vectorized → đọc ít hơn hàng trăm lần, lại không tranh tài nguyên với OLTP",
        "PostgreSQL không có GROUP BY",
        "ClickHouse miễn phí còn PostgreSQL thì không"
      ], correct: 1, explanation: "Cùng SQL nhưng khác hẳn lượng I/O." }
  ]
});
