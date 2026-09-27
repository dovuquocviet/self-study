window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Nền tảng",
  title: "Topic → partition → segment: dữ liệu nằm trên đĩa ra sao",
  subtitle: ".log · .index · .timeindex · active segment · page cache & zero-copy — vì sao Kafka nhanh",

  theory: `
    <p><strong>Topic</strong> chỉ là cái tên logic. Đơn vị thật là <strong>partition</strong>: mỗi partition là <em>một thư mục</em> trên đĩa broker, ví dụ
    <code>/var/lib/kafka/data/orders-0/</code>. Topic 6 partition = 6 log độc lập, có thể nằm trên 6 broker khác nhau — đó là cách Kafka chia tải (scale ngang).</p>

    <p><strong>Segment</strong>: một partition không phải một file khổng lồ mà là chuỗi file segment. Tên file = offset đầu tiên của segment, đệm 20 chữ số.</p>
    <ul>
      <li><code>00000000000000000000.log</code> — dữ liệu thật: các <em>record batch</em> nối đuôi nhau.</li>
      <li><code>.index</code> — chỉ mục thưa: offset → vị trí byte trong file .log (khoảng mỗi <code>index.interval.bytes</code> = 4096 byte thêm một mục).</li>
      <li><code>.timeindex</code> — timestamp → offset, dùng cho "đọc từ thời điểm X" và retention theo thời gian.</li>
      <li>Chỉ <strong>segment cuối (active segment)</strong> được ghi. Khi nó đạt <code>segment.bytes</code> (mặc định 1 GiB) hoặc quá <code>segment.ms</code> (mặc định 7 ngày) thì đóng lại, mở segment mới.</li>
      <li>Retention và compaction làm việc theo <em>đơn vị segment đã đóng</em> — active segment không bao giờ bị xoá/compact (bài 15).</li>
    </ul>

    <p><strong>Tìm offset 1234567 thế nào?</strong> (1) Tìm nhị phân trên tên file segment → segment bắt đầu từ 1200000. (2) Tìm nhị phân trong .index của segment đó → mục gần nhất ≤ offset.
    (3) Quét tuần tự một đoạn ngắn trong .log. Chi phí gần như hằng số dù log dài bao nhiêu.</p>

    <p><strong>Vì sao Kafka nhanh dù ghi đĩa?</strong></p>
    <ol>
      <li><strong>Ghi tuần tự</strong> (append) — đĩa, kể cả HDD, ghi tuần tự rất nhanh; không có B-tree phải cập nhật ngẫu nhiên.</li>
      <li><strong>Page cache của OS</strong>: Kafka không tự cache dữ liệu trong heap JVM; nó ghi vào page cache và để OS flush. Consumer đọc gần đuôi log thường đọc thẳng từ RAM.
        (Vì thế máy broker cần nhiều RAM "trống" cho OS, heap JVM chỉ cần vài GB.)</li>
      <li><strong>Zero-copy</strong> (<code>sendfile</code>): khi gửi dữ liệu cho consumer, kernel chép thẳng từ page cache ra socket, không qua bộ nhớ JVM. (Bật TLS thì mất ưu thế này vì phải mã hoá trong JVM.)</li>
      <li><strong>Batch</strong>: producer gửi theo lô, broker lưu nguyên lô (kể cả dạng nén) — broker không giải nén/nén lại nếu codec khớp.</li>
    </ol>

    <p><strong>Độ bền không đến từ fsync.</strong> Mặc định Kafka không fsync mỗi message (<code>flush.messages</code>/<code>flush.ms</code> để OS lo). Dữ liệu an toàn nhờ
    <em>nhân bản sang nhiều broker</em> (bài 04–05): mất điện một máy vẫn còn bản ở máy khác.</p>

    <div class="callout"><p>💡 So với PostgreSQL (khoá DB internals): Postgres ghi WAL rồi cập nhật trang dữ liệu; Kafka <em>chỉ có WAL</em> — cái log chính là dữ liệu.
    Không có index theo nội dung, không truy vấn "tìm order-17". Muốn tra cứu theo key thì đẩy sang DB/ClickHouse/Elasticsearch.</p></div>
  `,

  codeTabs: [
    { id: "disk", label: "① Trên đĩa", lines: [
      "$ ls /var/lib/kafka/data/orders-0/",
      "00000000000000000000.index",
      "00000000000000000000.log          # segment cũ, đã đóng (1 GiB)",
      "00000000000000000000.timeindex",
      "00000000000001200000.index",
      "00000000000001200000.log          # active segment: đang được ghi",
      "00000000000001200000.timeindex",
      "leader-epoch-checkpoint",
      "partition.metadata"
    ]},
    { id: "seek", label: "② Tìm offset", lines: [
      "find(offset = 1234567):",
      "  seg = floorEntry(segments, 1234567)       // -> segment 1200000",
      "  pos = seg.index.floor(1234567)            // -> (1234500, byte 52428800)",
      "  scan seg.log from byte 52428800           // quét tới offset 1234567",
      "  return batch chứa 1234567",
      "",
      "# .index là 'thưa' (sparse): không có mục cho MỌI offset,",
      "# nên bước cuối luôn là quét ngắn trong .log"
    ]},
    { id: "dump", label: "③ Soi segment", lines: [
      "kafka-dump-log.sh --print-data-log \\",
      "  --files /var/lib/kafka/data/orders-0/00000000000001200000.log",
      "",
      "baseOffset: 1200000 lastOffset: 1200009 count: 10 producerId: 4001",
      "  producerEpoch: 0 baseSequence: 90 isTransactional: false",
      "  compresscodec: zstd  size: 812  CreateTime: 1790000000000",
      "| offset: 1200000 key: order-17 payload: {\"type\":\"OrderPaid\"}",
      "# một record batch chứa 10 record, nén chung một lần"
    ]},
    { id: "cfg", label: "④ Cấu hình segment", lines: [
      "# cấp broker (mặc định cho mọi topic)",
      "log.segment.bytes=1073741824       # 1 GiB",
      "log.roll.hours=168                 # 7 ngày",
      "",
      "# ghi đè cho một topic",
      "kafka-configs.sh --bootstrap-server b:9092 --alter \\",
      "  --entity-type topics --entity-name orders \\",
      "  --add-config segment.bytes=268435456,segment.ms=86400000"
    ]}
  ],

  stageHtml: `
    <div class="node" id="t"><div class="nl">🏷️ topic orders</div><div class="ns">tên logic</div></div>
    <div class="arrow" id="a1">↓ 3 partition = 3 thư mục (có thể ở 3 broker)</div>
    <div class="row">
      <div class="node" id="p0"><div class="nl">orders-0</div><div class="ns">broker 101</div></div>
      <div class="node" id="p1"><div class="nl">orders-1</div><div class="ns">broker 102</div></div>
      <div class="node" id="p2"><div class="nl">orders-2</div><div class="ns">broker 103</div></div>
    </div>
    <div class="arrow" id="a2">↓ mỗi partition = chuỗi segment</div>
    <div class="row">
      <div class="node" id="s0"><div class="nl">seg 0 (đóng)</div><div class="ns">.log .index .timeindex</div></div>
      <div class="node" id="s1"><div class="nl">seg 1200000 (active)</div><div class="ns">chỉ ghi vào đây</div></div>
    </div>
    <div class="arrow" id="a3">↓ đọc: page cache → sendfile → socket</div>
    <div class="node" id="c"><div class="nl">👀 Consumer</div><div class="ns">zero-copy, không qua heap JVM</div></div>
  `,
  steps: [
    { title: "1 · Topic chia thành partition", tab: "disk", highlight: [1], on: ["t", "a1", "p0", "p1", "p2"],
      desc: "Partition là đơn vị song song và đơn vị lưu trữ; mỗi cái là một thư mục riêng." },
    { title: "2 · Partition chia thành segment", tab: "disk", highlight: [3, 6], on: ["a2", "s0", "s1"],
      desc: "Tên file = offset đầu. Chỉ active segment nhận ghi; segment cũ là bất biến." },
    { title: "3 · Tìm offset nhanh", tab: "seek", highlight: [2, 3, 4], on: ["s1"],
      desc: "Hai lần tìm nhị phân + một đoạn quét ngắn. Không phụ thuộc độ dài log." },
    { title: "4 · Bên trong là record batch", tab: "dump", highlight: [4, 5, 6, 8], on: ["s1"],
      desc: "Producer gửi theo lô; broker lưu nguyên lô, kể cả dạng nén. producerId/sequence phục vụ idempotence (bài 08)." },
    { title: "5 · Đọc bằng zero-copy", tab: "cfg", highlight: [2, 3], on: ["a3", "c"],
      desc: "Consumer đọc gần đuôi thì dữ liệu còn trong page cache; kernel gửi thẳng ra socket. Kích thước segment ảnh hưởng tới độ mịn của retention." }
  ],

  quiz: [
    { q: "Trên đĩa broker, một partition là…", options: [
        "Một bảng trong SQLite", "Một thư mục chứa các file segment (.log/.index/.timeindex)", "Một file duy nhất không bao giờ chia", "Một key trong ZooKeeper"
      ], correct: 1, explanation: "Ví dụ thư mục orders-0 chứa chuỗi segment." },
    { q: "Tên file 00000000000001200000.log cho biết gì?", options: [
        "Segment có 1.200.000 byte", "Offset đầu tiên của segment là 1200000", "Được tạo lúc 12:00", "Là segment thứ 1.200.000"
      ], correct: 1, explanation: "Tên segment là base offset." },
    { q: "Segment nào có thể bị retention xoá?", options: [
        "Chỉ active segment", "Chỉ các segment đã đóng", "Bất kỳ record nào", "Không segment nào"
      ], correct: 1, explanation: "Active segment luôn được giữ; đó là lý do segment.bytes/segment.ms ảnh hưởng tới việc dữ liệu cũ bao giờ thực sự bị xoá." },
    { q: "File .index của segment là loại chỉ mục gì?", options: [
        "Dày: mỗi offset một mục", "Thưa: offset → vị trí byte, cách quãng; bước cuối quét tuần tự", "Chỉ mục theo key", "Chỉ mục full-text"
      ], correct: 1, explanation: "Thưa để nhỏ, nạp vừa bộ nhớ (được mmap)." },
    { q: "Kafka có index theo key để tìm 'mọi message của order-17' không?", options: [
        "Có, mặc định", "Không; chỉ tra theo offset/timestamp", "Có nếu bật compaction", "Có qua ZooKeeper"
      ], correct: 1, explanation: "Tra cứu theo nội dung thuộc về DB/ClickHouse/Elasticsearch." },
    { q: "Vì sao broker Kafka thường cấu hình heap JVM nhỏ (vài GB) dù máy nhiều RAM?", options: [
        "JVM không hỗ trợ heap lớn",
        "Kafka dựa vào page cache của OS để cache dữ liệu; RAM trống dành cho OS",
        "Để tiết kiệm điện",
        "Vì dữ liệu đã nén"
      ], correct: 1, explanation: "Heap lớn còn làm GC chậm mà không giúp gì cho đọc log." },
    { q: "Zero-copy (sendfile) giúp gì?", options: [
        "Nén dữ liệu",
        "Kernel chép dữ liệu từ page cache thẳng ra socket, không qua bộ nhớ ứng dụng",
        "Mã hoá TLS nhanh hơn",
        "Giảm số partition"
      ], correct: 1, explanation: "Khi bật TLS ở broker, dữ liệu phải đi qua JVM để mã hoá nên mất lợi thế này." },
    { q: "Mặc định Kafka đảm bảo độ bền chủ yếu nhờ…", options: [
        "fsync mỗi message", "Nhân bản sang nhiều broker (replication)", "RAID", "Ghi vào ZooKeeper"
      ], correct: 1, explanation: "Kafka để OS flush; an toàn nhờ có bản sao trên máy khác." },
    { q: "Khi nào active segment được đóng và mở segment mới?", options: [
        "Mỗi message", "Khi đạt segment.bytes hoặc quá segment.ms", "Khi consumer commit", "Khi controller yêu cầu"
      ], correct: 1, explanation: "Mặc định 1 GiB hoặc 7 ngày." }
  ]
});
