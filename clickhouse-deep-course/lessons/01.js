window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng",
  title: "Vì sao ClickHouse nhanh: column-store & vectorized execution",
  subtitle: "OLTP vs OLAP · đọc cột thay vì đọc hàng · xử lý theo block · nén",

  theory: `
    <p>Trong Postgres (hay MySQL mà Spring JPA hay dùng), một hàng nằm liền nhau trên đĩa: <code>id, user_id, event, price, ts</code> sát cạnh nhau.
    Tốt khi bạn cần <em>cả hàng</em> (<code>findById</code>). Nhưng câu analytics kiểu "tổng doanh thu theo ngày trong 90 ngày" chỉ cần 2 cột trên hàng tỷ hàng —
    row-store vẫn phải kéo cả hàng từ đĩa lên.</p>

    <table>
      <tr><th></th><th>OLTP (Postgres, Mongo)</th><th>OLAP (ClickHouse)</th></tr>
      <tr><td>Truy vấn điển hình</td><td>Lấy/sửa vài hàng theo khoá</td><td>Quét hàng triệu–tỷ hàng, gom nhóm vài cột</td></tr>
      <tr><td>Ghi</td><td>Nhiều ghi nhỏ, UPDATE thường xuyên</td><td>Insert theo lô lớn, gần như chỉ thêm (append)</td></tr>
      <tr><td>Lưu trữ</td><td>Theo hàng + B-tree</td><td>Theo cột, sắp xếp + chỉ mục thưa</td></tr>
      <tr><td>Giao dịch</td><td>ACID đầy đủ</td><td>Không có transaction nhiều câu lệnh; insert một block là nguyên tử</td></tr>
    </table>

    <p><strong>1. Lưu theo cột.</strong> Mỗi cột là một file riêng. Câu <code>SELECT sum(price) ... GROUP BY toDate(ts)</code> chỉ đọc file <code>price</code> và <code>ts</code>.
    Bảng 50 cột mà câu hỏi chạm 2 cột thì đọc khoảng 4% dữ liệu.</p>

    <p><strong>2. Nén rất tốt.</strong> Các giá trị cùng kiểu, cùng cột nằm cạnh nhau (và đã sắp xếp) nên lặp lại nhiều. Tỷ lệ nén 5–10 lần là bình thường, log/event có thể hơn nữa.
    Ít byte đọc từ đĩa hơn thì nhanh hơn.</p>

    <p><strong>3. Vectorized execution.</strong> Engine không xử lý từng hàng (kiểu <code>for (Row r : rows)</code> gọi hàm ảo mỗi hàng) mà xử lý <em>block</em> —
    mỗi cột là một mảng liên tục khoảng 65 nghìn giá trị (<code>max_block_size</code> mặc định 65409). Vòng lặp chặt trên mảng tận dụng cache CPU và lệnh SIMD (SSE/AVX).</p>

    <p><strong>4. Song song hoá.</strong> Một câu query được chia cho nhiều luồng (<code>max_threads</code> mặc định bằng số core) và nhiều server (shard, bài 20).</p>

    <p><strong>Cái giá phải trả</strong>: UPDATE/DELETE từng hàng rất đắt (bài 18), không có ràng buộc UNIQUE, JOIN lớn tốn RAM (bài 16),
    insert từng hàng một là thảm hoạ (bài 12). ClickHouse không thay Postgres — nó là kho phân tích đứng sau, nhận dữ liệu từ Kafka.</p>

    <div class="callout"><p>💡 Trong hệ thống của mình: các service ghi vào Postgres/Mongo (OLTP), phát event lên Kafka, ClickHouse tiêu thụ Kafka để phục vụ dashboard/báo cáo.
    Hỏi "đơn hàng #123 trạng thái gì" → Postgres. Hỏi "doanh thu theo kênh 12 tháng qua" → ClickHouse.</p></div>
  `,

  codeTabs: [
    { id: "row", label: "① Row-store", lines: [
      "-- Postgres: mỗi hàng nằm liền nhau trong page 8KB",
      "-- page 1: [1,u7,'view',0,ts][2,u9,'buy',19.9,ts][3,u7,'buy',5,ts]...",
      "",
      "SELECT toDate(ts) AS d, sum(price)",
      "FROM events",
      "WHERE ts >= now() - INTERVAL 90 DAY",
      "GROUP BY d;",
      "",
      "-- Phải đọc TOÀN BỘ hàng (cả 50 cột) chỉ để lấy 2 cột"
    ]},
    { id: "col", label: "② Column-store", lines: [
      "-- ClickHouse: mỗi cột một file",
      "-- id.bin      : 1 2 3 4 5 ...",
      "-- user_id.bin : u7 u9 u7 u2 ...",
      "-- event.bin   : view buy buy view ...",
      "-- price.bin   : 0 19.9 5 0 ...      <- đọc",
      "-- ts.bin      : t1 t2 t3 t4 ...     <- đọc",
      "",
      "-- Cùng câu query: chỉ mở price.bin + ts.bin, đã nén"
    ]},
    { id: "vec", label: "③ Vectorized", lines: [
      "// Kiểu row-at-a-time (Volcano) — giống Java Iterator",
      "for (Row r : rows) { if (filter.eval(r)) agg.add(r.get(\"price\")); }",
      "",
      "// Kiểu vectorized — ClickHouse xử lý cả block",
      "float[] price = block.column(\"price\");   // ~65k giá trị liên tục",
      "byte[]  mask  = filterColumn(block);     // 1 lần cho cả block",
      "for (int i = 0; i < price.length; i++) sum += mask[i] * price[i];",
      "// vòng lặp chặt -> compiler sinh lệnh SIMD, ít cache miss"
    ]},
    { id: "try", label: "④ Tự thử", lines: [
      "$ clickhouse local --query \"SELECT sum(number) FROM numbers(1000000000)\"",
      "",
      "-- xem kích thước nén vs chưa nén theo từng cột",
      "SELECT name,",
      "       formatReadableSize(data_compressed_bytes)   AS nen,",
      "       formatReadableSize(data_uncompressed_bytes) AS goc",
      "FROM system.columns",
      "WHERE table = 'events';"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔎 Query: sum(price) theo ngày</div><div class="ns">chỉ cần cột price, ts</div></div>
    <div class="arrow" id="a1">↓ chỉ mở 2 file cột</div>
    <div class="row">
      <div class="node" id="disk"><div class="nl">💾 price.bin + ts.bin</div><div class="ns">đã nén, đã sắp xếp</div></div>
      <div class="node" id="skip"><div class="nl">🚫 48 cột còn lại</div><div class="ns">không đọc</div></div>
    </div>
    <div class="arrow" id="a2">↓ giải nén thành block ~65k giá trị</div>
    <div class="node" id="cpu"><div class="nl">⚙️ Vectorized + đa luồng</div><div class="ns">SIMD trên mảng, max_threads luồng</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="res"><div class="nl">📊 Kết quả 90 dòng</div><div class="ns">quét tỷ hàng trong vài giây</div></div>
  `,
  steps: [
    { title: "1 · Row-store đọc thừa", tab: "row", highlight: [2, 4, 9], on: ["q"],
      desc: "Postgres lưu cả hàng liền nhau nên muốn lấy 2 cột vẫn phải đọc page chứa đủ 50 cột." },
    { title: "2 · Column-store chỉ đọc cột cần", tab: "col", highlight: [5, 6, 8], on: ["a1", "disk", "skip"],
      desc: "Mỗi cột một file, nên các cột không liên quan không bị chạm tới. I/O giảm theo tỷ lệ số cột dùng / tổng số cột." },
    { title: "3 · Nén cộng dồn lợi ích", tab: "try", highlight: [4, 5, 6, 7], on: ["disk"],
      desc: "Cùng kiểu, cùng thứ tự sắp xếp → nén gấp nhiều lần. system.columns cho thấy kích thước nén/gốc của từng cột." },
    { title: "4 · Xử lý theo block", tab: "vec", highlight: [2, 5, 6, 7], on: ["a2", "cpu"],
      desc: "Không gọi hàm cho từng hàng mà chạy vòng lặp chặt trên mảng cột → tận dụng cache và SIMD." },
    { title: "5 · Song song và trả kết quả", tab: "vec", highlight: [8], on: ["a3", "res"],
      desc: "Mỗi luồng xử lý một phần dữ liệu, kết quả gom lại. Đây là lý do ClickHouse quét hàng tỷ hàng trong vài giây." }
  ],

  quiz: [
    { q: "Vì sao column-store hợp với câu analytics chỉ dùng vài cột?", options: [
        "Vì có B-tree trên mọi cột",
        "Vì chỉ đọc file của các cột được dùng, bỏ qua các cột khác",
        "Vì lưu toàn bộ dữ liệu trong RAM",
        "Vì không cần nén"
      ], correct: 1, explanation: "Mỗi cột là file riêng; query chạm 2/50 cột thì đọc khoảng 2/50 lượng dữ liệu (trước khi tính nén)." },
    { q: "Vectorized execution nghĩa là gì?", options: [
        "Xử lý từng hàng một qua Iterator",
        "Xử lý dữ liệu theo block — mỗi cột là mảng liên tục — để tận dụng cache và SIMD",
        "Chạy query trên GPU",
        "Chia query thành nhiều câu nhỏ"
      ], correct: 1, explanation: "Engine xử lý block khoảng 65k giá trị/cột bằng vòng lặp chặt thay vì gọi hàm cho mỗi hàng." },
    { q: "Loại truy vấn nào nên chạy ở Postgres chứ không phải ClickHouse?", options: [
        "Doanh thu theo kênh 12 tháng",
        "Top 10 sản phẩm bán chạy theo tuần",
        "Lấy và cập nhật trạng thái một đơn hàng theo id",
        "Đếm số user hoạt động theo ngày"
      ], correct: 2, explanation: "Đọc/sửa một hàng theo khoá là OLTP. ClickHouse làm UPDATE từng hàng rất đắt." },
    { q: "Vì sao dữ liệu cột nén tốt hơn dữ liệu hàng?", options: [
        "Vì ClickHouse dùng thuật toán nén bí mật",
        "Vì các giá trị cùng kiểu, cùng cột, thường đã sắp xếp nằm cạnh nhau nên lặp lại nhiều",
        "Vì cột luôn là số",
        "Vì không lưu NULL"
      ], correct: 1, explanation: "Dữ liệu đồng nhất và có thứ tự thì LZ4/ZSTD và các codec chuyên dụng đạt tỷ lệ cao." },
    { q: "ClickHouse có transaction nhiều câu lệnh (BEGIN…COMMIT) như Postgres không?", options: [
        "Có, đầy đủ ACID",
        "Không; đơn vị nguyên tử là một block insert",
        "Có nhưng chỉ với MongoDB",
        "Chỉ khi bật Keeper"
      ], correct: 1, explanation: "Một INSERT (block đủ nhỏ theo max_insert_block_size) là nguyên tử; không có transaction nhiều câu lệnh cho production." },
    { q: "Giá trị mặc định của max_threads là gì?", options: [
        "1",
        "Xấp xỉ số core CPU của server",
        "65536",
        "Bằng số partition"
      ], correct: 1, explanation: "Mặc định auto = số core vật lý, nên một query có thể dùng hết CPU của máy." },
    { q: "Trong kiến trúc công ty (Postgres, Mongo, Kafka, ClickHouse), ClickHouse đóng vai trò gì?", options: [
        "Nguồn sự thật cho giao dịch",
        "Kho phân tích, nhận event từ Kafka để phục vụ báo cáo/dashboard",
        "Cache thay Redis",
        "Hàng đợi thay Kafka"
      ], correct: 1, explanation: "ClickHouse là consumer của Kafka, phục vụ truy vấn phân tích." },
    { q: "Đâu KHÔNG phải điểm yếu của ClickHouse?", options: [
        "UPDATE/DELETE từng hàng",
        "Insert từng hàng một với tần suất cao",
        "Quét và gom nhóm hàng tỷ hàng",
        "Ràng buộc UNIQUE"
      ], correct: 2, explanation: "Quét + aggregate là sở trường. Ba cái còn lại là điểm yếu: mutation đắt, quá nhiều part, không có UNIQUE." },
    { q: "Row-at-a-time (Volcano) chậm hơn vectorized chủ yếu vì?", options: [
        "Dùng nhiều RAM hơn",
        "Mỗi hàng tốn một lần gọi hàm ảo/nhánh, CPU không tận dụng được SIMD và cache",
        "Không hỗ trợ SQL",
        "Chỉ chạy một luồng"
      ], correct: 1, explanation: "Chi phí gọi hàm trên mỗi hàng áp đảo phần tính toán thật khi dữ liệu lớn." }
  ]
});
