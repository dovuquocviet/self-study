window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng",
  title: "MergeTree trên đĩa: part, granule và merge",
  subtitle: "mỗi INSERT = 1 part bất biến · merge nền · tên part · wide vs compact",

  theory: `
    <p>MergeTree là engine chính của ClickHouse. Hiểu nó như một <strong>LSM-tree đơn giản</strong>: không sửa file tại chỗ, chỉ ghi file mới rồi gộp dần.</p>

    <ol>
      <li><strong>Mỗi INSERT tạo ra ít nhất một part</strong> (một thư mục trên đĩa) cho mỗi partition mà dữ liệu chạm tới. Trong part, dữ liệu đã được sắp xếp theo <code>ORDER BY</code>.</li>
      <li><strong>Part bất biến</strong> (immutable). Không ai sửa part cũ; muốn đổi thì ghi part mới.</li>
      <li><strong>Merge chạy nền</strong>: gộp vài part nhỏ cùng partition thành một part lớn hơn (merge sort vì các part đã sắp xếp), rồi đánh dấu part cũ là không hoạt động và xoá sau đó.</li>
    </ol>

    <p><strong>Tên part</strong> <code>202409_1_5_1</code> = <code>partitionId_minBlock_maxBlock_level</code>: thuộc partition 202409, chứa block số 1 đến 5, đã qua 1 lượt merge (level 0 = part vừa insert).</p>

    <p><strong>Bên trong một part (dạng wide)</strong></p>
    <ul>
      <li><code>price.bin</code>: dữ liệu cột, chia thành các khối nén.</li>
      <li><code>price.cmrk2</code> (hoặc <code>.mrk2</code>): <em>mark</em> — với mỗi granule, vị trí trong file .bin (offset khối nén + offset trong khối đã giải nén).</li>
      <li><code>primary.idx</code> (hoặc <code>primary.cidx</code>): giá trị khoá sắp xếp ở hàng đầu tiên mỗi granule.</li>
      <li><code>checksums.txt</code>, <code>columns.txt</code>, <code>count.txt</code>, <code>minmax_*.idx</code> (min/max cột partition)…</li>
    </ul>
    <p>Part nhỏ (dưới <code>min_bytes_for_wide_part</code>, mặc định 10 MB) được lưu dạng <strong>compact</strong>: mọi cột chung một file <code>data.bin</code> để khỏi tạo quá nhiều file.</p>

    <p><strong>Granule</strong> là đơn vị đọc nhỏ nhất: mặc định <code>index_granularity = 8192</code> hàng (và adaptive theo <code>index_granularity_bytes</code> = 10 MB). ClickHouse không bao giờ đọc "một hàng" — nó đọc cả granule.</p>

    <div class="callout"><p>💡 So với Java: part giống một <code>List</code> bất biến đã sort; merge là <code>mergeSorted(a, b)</code> tạo list mới. Vì part bất biến nên đọc không cần lock, và
    mọi thứ "sửa/xoá/khử trùng" trong ClickHouse đều xảy ra lúc merge — tức là <em>không biết lúc nào</em>. Đó là gốc rễ của bài 08–11 và 18.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① Bảng", lines: [
      "CREATE TABLE events",
      "(",
      "    ts       DateTime,",
      "    user_id  UInt64,",
      "    event    LowCardinality(String),",
      "    price    Decimal(18, 2)",
      ")",
      "ENGINE = MergeTree",
      "PARTITION BY toYYYYMM(ts)",
      "ORDER BY (event, user_id, ts);"
    ]},
    { id: "ins", label: "② 3 lần insert", lines: [
      "INSERT INTO events VALUES ('2024-09-01 10:00:00', 7, 'view', 0);",
      "INSERT INTO events VALUES ('2024-09-01 10:00:01', 9, 'buy', 19.9);",
      "INSERT INTO events VALUES ('2024-09-02 08:00:00', 7, 'buy', 5);",
      "",
      "SELECT name, rows, level, active",
      "FROM system.parts WHERE table = 'events';",
      "-- 202409_1_1_0   1  0  1",
      "-- 202409_2_2_0   1  0  1",
      "-- 202409_3_3_0   1  0  1"
    ]},
    { id: "merge", label: "③ Sau merge", lines: [
      "-- vài giây/phút sau, merge nền gộp 3 part",
      "SELECT name, rows, level, active",
      "FROM system.parts WHERE table = 'events';",
      "-- 202409_1_1_0   1  0  0   <- không còn active",
      "-- 202409_2_2_0   1  0  0",
      "-- 202409_3_3_0   1  0  0",
      "-- 202409_1_3_1   3  1  1   <- part mới",
      "",
      "-- ép merge ngay (chỉ để học, đừng lạm dụng ở production)",
      "OPTIMIZE TABLE events FINAL;"
    ]},
    { id: "disk", label: "④ Trên đĩa", lines: [
      "$ ls /var/lib/clickhouse/store/xxx/<uuid>/202409_1_3_1/",
      "checksums.txt  columns.txt  count.txt  default_compression_codec.txt",
      "data.bin  data.cmrk3                  # compact part: mọi cột 1 file",
      "minmax_ts.idx  partition.dat  primary.cidx",
      "",
      "# part lớn (wide) thì mỗi cột 1 cặp file:",
      "# ts.bin ts.cmrk2  user_id.bin user_id.cmrk2  price.bin price.cmrk2 ..."
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="p1"><div class="nl">📦 202409_1_1_0</div><div class="ns">insert #1, đã sort</div></div>
      <div class="node" id="p2"><div class="nl">📦 202409_2_2_0</div><div class="ns">insert #2</div></div>
      <div class="node" id="p3"><div class="nl">📦 202409_3_3_0</div><div class="ns">insert #3</div></div>
    </div>
    <div class="arrow" id="a1">↓ merge nền (merge sort)</div>
    <div class="node" id="pm"><div class="nl">📦 202409_1_3_1</div><div class="ns">level 1, 3 hàng, sort theo ORDER BY</div></div>
    <div class="arrow" id="a2">↓ bên trong part</div>
    <div class="row">
      <div class="node" id="bin"><div class="nl">🗃️ .bin</div><div class="ns">khối nén</div></div>
      <div class="node" id="mrk"><div class="nl">📍 marks</div><div class="ns">granule → offset</div></div>
      <div class="node" id="idx"><div class="nl">🔑 primary.idx</div><div class="ns">khoá đầu mỗi granule</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Định nghĩa bảng", tab: "ddl", highlight: [8, 9, 10], on: [],
      desc: "ENGINE = MergeTree, dữ liệu chia partition theo tháng và sắp xếp theo (event, user_id, ts)." },
    { title: "2 · Mỗi INSERT = 1 part", tab: "ins", highlight: [1, 2, 3, 7, 8, 9], on: ["p1", "p2", "p3"],
      desc: "3 lần insert 1 hàng tạo 3 part level 0. Đây chính là lý do insert từng hàng là thói quen xấu." },
    { title: "3 · Merge nền gộp part", tab: "merge", highlight: [4, 5, 6, 7], on: ["a1", "pm"],
      desc: "Part mới 202409_1_3_1 thay thế 3 part cũ (active = 0, bị xoá sau một khoảng chờ)." },
    { title: "4 · Cấu trúc file trong part", tab: "disk", highlight: [2, 3, 4, 7], on: ["a2", "bin", "mrk", "idx"],
      desc: "Part nhỏ dạng compact (1 file data.bin), part lớn dạng wide (mỗi cột .bin + mark). primary index chứa khoá của hàng đầu mỗi granule." },
    { title: "5 · OPTIMIZE FINAL — dùng có ý thức", tab: "merge", highlight: [9, 10], on: ["pm"],
      desc: "Ép gộp mọi part trong partition thành một, tốn I/O lớn. Hữu ích khi học/khi dọn dữ liệu, không nên đặt cron chạy liên tục." }
  ],

  quiz: [
    { q: "Một câu INSERT vào bảng MergeTree tạo ra gì?", options: [
        "Sửa trực tiếp file hiện có",
        "Ít nhất một part mới (mỗi partition bị chạm một part), đã sắp xếp theo ORDER BY",
        "Một dòng trong WAL, chưa ghi đĩa",
        "Một bản ghi trong Keeper"
      ], correct: 1, explanation: "Part là bất biến; insert luôn ghi part mới." },
    { q: "Part tên 202409_4_9_2 cho biết điều gì?", options: [
        "Tháng 4 đến tháng 9",
        "Partition 202409, chứa block 4 đến 9, đã qua 2 cấp merge",
        "Có 4 đến 9 hàng",
        "Là part thứ 2 của shard 4"
      ], correct: 1, explanation: "Định dạng partitionId_minBlock_maxBlock_level." },
    { q: "Merge trong MergeTree làm gì?", options: [
        "Gộp các part nhỏ cùng partition thành part lớn hơn, bằng merge sort",
        "Gộp các partition khác nhau",
        "Gộp các bảng",
        "Đồng bộ replica"
      ], correct: 0, explanation: "Merge chỉ xảy ra giữa các part cùng partition." },
    { q: "Granule mặc định bao nhiêu hàng?", options: ["1024", "8192", "65536", "1 triệu"], correct: 1,
      explanation: "index_granularity = 8192 (kèm giới hạn theo byte index_granularity_bytes)." },
    { q: "File mark (.mrk2/.cmrk2) chứa gì?", options: [
        "Giá trị min/max của cột",
        "Vị trí trong file .bin tương ứng với đầu mỗi granule",
        "Checksum của part",
        "Danh sách replica"
      ], correct: 1, explanation: "Mark gồm offset khối nén trong .bin và offset bên trong khối đã giải nén." },
    { q: "Part compact khác part wide thế nào?", options: [
        "Compact không nén",
        "Compact để mọi cột trong một file data.bin, dùng cho part nhỏ để giảm số file",
        "Compact chỉ có primary key",
        "Compact chỉ tồn tại trên S3"
      ], correct: 1, explanation: "Dưới ngưỡng min_bytes_for_wide_part (10 MB) part được ghi dạng compact." },
    { q: "Vì sao đọc MergeTree không cần lock hàng?", options: [
        "Vì ClickHouse chỉ có một luồng",
        "Vì part là bất biến; merge tạo part mới rồi đổi trạng thái active một cách nguyên tử",
        "Vì có MVCC giống Postgres",
        "Vì dữ liệu ở RAM"
      ], correct: 1, explanation: "Query đọc snapshot tập part active tại thời điểm bắt đầu." },
    { q: "Hệ quả quan trọng của việc 'mọi thay đổi xảy ra lúc merge' là gì?", options: [
        "Dữ liệu luôn khử trùng ngay khi insert",
        "Các việc như khử trùng/gộp dòng của Replacing/SummingMergeTree xảy ra vào thời điểm không xác định",
        "Không thể xoá dữ liệu",
        "Query luôn chậm"
      ], correct: 1, explanation: "Merge chạy nền theo lịch riêng; không được giả định đã merge xong." },
    { q: "OPTIMIZE TABLE ... FINAL nên dùng thế nào?", options: [
        "Cron mỗi phút để dữ liệu luôn gọn",
        "Thỉnh thoảng, có ý thức — nó ép merge toàn bộ, tốn nhiều I/O",
        "Bắt buộc sau mỗi insert",
        "Không bao giờ có tác dụng"
      ], correct: 1, explanation: "Viết lại toàn bộ dữ liệu partition; lạm dụng làm nghẽn server." }
  ]
});
