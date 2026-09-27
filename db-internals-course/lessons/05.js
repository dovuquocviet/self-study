window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Nền tảng lưu trữ",
  title: "LSM-tree — ghi tuần tự, gộp sau",
  subtitle: "Memtable · SSTable bất biến · tombstone · bloom filter · compaction · 3 loại amplification",

  theory: `
    <p>B-tree sửa tại chỗ: mỗi ghi là đọc page + sửa + ghi page ngẫu nhiên. Với workload ghi dồn dập (log, metric, sự kiện), <strong>LSM-tree</strong>
    (Log-Structured Merge-tree) chọn hướng ngược lại: <em>không bao giờ sửa file cũ</em>, chỉ ghi file mới tuần tự rồi gộp dần ở nền.</p>

    <p><strong>Đường ghi</strong></p>
    <ol>
      <li>Ghi vào commit log/WAL (tuần tự) để bền.</li>
      <li>Chèn vào <strong>memtable</strong> — cấu trúc có thứ tự trong RAM (thường là skip list).</li>
      <li>Memtable đầy (vd 64 MB) → đóng băng và <strong>flush</strong> xuống đĩa thành một <strong>SSTable</strong> (Sorted String Table): file đã sắp xếp theo khoá, <em>bất biến</em>, kèm index thưa và bloom filter.</li>
    </ol>

    <p><strong>Đường đọc</strong>: tìm trong memtable → rồi các SSTable từ mới tới cũ. Bản mới nhất thắng. Để khỏi mở mọi file, mỗi SSTable có
    <strong>bloom filter</strong>: trả lời "chắc chắn không có" hoặc "có thể có" (có dương tính giả, không có âm tính giả).</p>

    <p><strong>Update và delete</strong>: update = ghi phiên bản mới; delete = ghi một <strong>tombstone</strong> (bia mộ). Dữ liệu cũ chỉ thực sự biến mất khi compaction gộp file.</p>

    <p><strong>Compaction</strong> gộp nhiều SSTable thành ít file hơn, bỏ bản cũ và tombstone đã hết hạn:</p>
    <ul>
      <li><strong>Size-tiered</strong>: gộp các file cùng cỡ. Ghi rẻ, nhưng tốn chỗ tạm thời và đọc phải xem nhiều file.</li>
      <li><strong>Leveled</strong> (RocksDB, LevelDB): chia tầng L0, L1, L2..., mỗi tầng lớn hơn ~10 lần, khoá trong một tầng không chồng lấn. Đọc tốt, chiếm chỗ ít, nhưng ghi lại dữ liệu nhiều lần hơn.</li>
    </ul>

    <table>
      <tr><th>Amplification</th><th>B-tree</th><th>LSM-tree</th></tr>
      <tr><td>Ghi (write amp)</td><td>Cao với ghi nhỏ ngẫu nhiên (cả page)</td><td>Ghi tuần tự, nhưng compaction ghi lại nhiều lần</td></tr>
      <tr><td>Đọc (read amp)</td><td>Thấp, 1 đường đi xuống cây</td><td>Có thể phải xem memtable + nhiều SSTable</td></tr>
      <tr><td>Chỗ (space amp)</td><td>Page không đầy, bloat</td><td>Bản cũ + tombstone chờ compaction</td></tr>
    </table>
    <p>Không cấu trúc nào tối ưu cả ba cùng lúc — đó là đánh đổi cốt lõi (RUM conjecture: Read, Update, Memory).</p>

    <p><strong>Trong các DB của công ty</strong></p>
    <ul>
      <li><strong>Elasticsearch/Lucene</strong>: segment bất biến + merge → cùng tư tưởng LSM (bài 15).</li>
      <li><strong>ClickHouse MergeTree</strong>: mỗi INSERT tạo một <em>part</em> bất biến, merge nền gộp part (bài 14) — tên "MergeTree" từ đây.</li>
      <li><strong>PostgreSQL, MongoDB (WiredTiger mặc định)</strong>: B-tree. <strong>Redis</strong>: trong RAM. <strong>Kafka</strong>: log thuần, không cần merge theo khoá (trừ log compaction, bài 17).</li>
      <li>LSM "chính hiệu": RocksDB, Cassandra, ScyllaDB, LevelDB.</li>
    </ul>

    <div class="callout"><p>💡 Dấu hiệu bạn đang "đánh nhau" với LSM: xoá hàng loạt nhưng dung lượng không giảm (tombstone chờ compaction), đọc chậm dần khi số file tăng,
    hay đĩa đầy đột ngột lúc compaction lớn chạy. Ở ClickHouse, lỗi "Too many parts" chính là LSM bị ghi nhanh hơn tốc độ gộp.</p></div>
  `,

  codeTabs: [
    { id: "write", label: "Đường ghi", lines: [
      "put('user:42', 'An')",
      "  1. append commit log            # tuần tự, để bền",
      "  2. memtable.insert('user:42')   # skip list trong RAM, có thứ tự",
      "",
      "memtable đạt 64 MB →",
      "  3. đóng băng memtable, mở memtable mới",
      "  4. flush → sst_000123.sst       # file sắp xếp, bất biến",
      "        [data blocks][index thưa][bloom filter][footer]",
      "  5. xoá đoạn commit log tương ứng"
    ]},
    { id: "read", label: "Đường đọc", lines: [
      "get('user:42'):",
      "  memtable?                        → không",
      "  sst_000125: bloom.mightContain?  → không   (bỏ qua, không đọc đĩa)",
      "  sst_000124: bloom.mightContain?  → có thể",
      "     index thưa → đọc 1 block      → không thấy (dương tính giả)",
      "  sst_000123: bloom.mightContain?  → có thể",
      "     index thưa → đọc 1 block      → 'An'  ✔ trả về",
      "",
      "delete('user:42') → ghi tombstone; get sau đó gặp tombstone trước → 'không tồn tại'"
    ]},
    { id: "compact", label: "Compaction", lines: [
      "Trước:  sst_A: user:1=a  user:42=An        user:77=x",
      "        sst_B:           user:42=Anh(mới)  user:77=TOMBSTONE",
      "",
      "merge-sort 2 file (đều đã sắp xếp) →",
      "Sau:    sst_C: user:1=a  user:42=Anh",
      "",
      "# bản cũ user:42 và user:77 (đã xoá) biến mất khỏi đĩa",
      "# leveled: L0 → L1 (10x) → L2 (100x) ..., khoá trong 1 tầng không chồng lấn"
    ]},
    { id: "ch", label: "Ví dụ ClickHouse", lines: [
      "-- mỗi INSERT tạo 1 part bất biến",
      "INSERT INTO events VALUES (...);   -- part all_1_1_0",
      "INSERT INTO events VALUES (...);   -- part all_2_2_0",
      "",
      "SELECT name, rows, active FROM system.parts WHERE table = 'events';",
      "-- sau merge nền: all_1_2_1 (active=1), 2 part cũ active=0 rồi bị xoá",
      "",
      "-- insert từng dòng một, hàng nghìn lần/giây → 'Too many parts'",
      "-- cách đúng: gom batch lớn (vd 10k–100k dòng) hoặc async_insert = 1"
    ]}
  ],

  stageHtml: `
    <div class="node" id="log"><div class="nl">📜 Commit log</div><div class="ns">append tuần tự</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="mem"><div class="nl">🧠 Memtable (RAM)</div><div class="ns">skip list có thứ tự</div></div>
    <div class="arrow" id="a2">↓ đầy → flush</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">SST mới</div><div class="ns">bloom + index thưa</div></div>
      <div class="node" id="s2"><div class="nl">SST</div><div class="ns">bất biến</div></div>
      <div class="node" id="s3"><div class="nl">SST cũ</div><div class="ns">bất biến</div></div>
    </div>
    <div class="arrow" id="a3">↓ compaction nền (merge-sort)</div>
    <div class="node" id="big"><div class="nl">🗜️ SST lớn hơn</div><div class="ns">bỏ bản cũ + tombstone</div></div>
  `,
  steps: [
    { title: "1 · Ghi log + memtable", tab: "write", highlight: [1, 2, 3], on: ["log", "a1", "mem"],
      desc: "Không đọc page nào, không sửa file cũ. Ghi luôn rẻ và tuần tự." },
    { title: "2 · Flush thành SSTable", tab: "write", highlight: [5, 6, 7, 8], on: ["a2", "s1"],
      desc: "File đã sắp xếp, bất biến, kèm index thưa và bloom filter." },
    { title: "3 · Đọc: mới tới cũ, nhờ bloom filter", tab: "read", highlight: [2, 3, 4, 5, 6, 7], on: ["mem", "s1", "s2", "s3"],
      desc: "Bloom filter loại nhanh file chắc chắn không có khoá; dương tính giả tốn thêm 1 lần đọc block." },
    { title: "4 · Delete = tombstone", tab: "read", highlight: [9], on: ["s1"],
      desc: "Xoá cũng là ghi. Dữ liệu cũ vẫn chiếm đĩa cho tới compaction." },
    { title: "5 · Compaction gộp file", tab: "compact", highlight: [1, 2, 4, 5, 7], on: ["a3", "big"],
      desc: "Merge-sort các file đã sắp xếp, giữ bản mới nhất. Đổi lại: ghi lại dữ liệu nhiều lần (write amp)." },
    { title: "6 · Gặp lại ở ClickHouse", tab: "ch", highlight: [2, 3, 6, 8, 9], on: ["s1", "s2", "big"],
      desc: "Part = SSTable. Insert quá vụn thì merge không theo kịp → Too many parts." }
  ],

  quiz: [
    { q: "LSM-tree ghi dữ liệu mới vào đâu trước tiên (sau commit log)?", options: [
        "Trực tiếp SSTable cũ", "Memtable trong RAM", "Page B-tree", "Replica"
      ], correct: 1, explanation: "Memtable đầy mới flush thành SSTable." },
    { q: "Tính chất quan trọng nhất của SSTable?", options: [
        "Sửa tại chỗ được", "Đã sắp xếp theo khoá và bất biến", "Luôn nằm trong RAM", "Không có index"
      ], correct: 1, explanation: "Bất biến nên ghi tuần tự; sắp xếp nên merge-sort và tìm kiếm dễ." },
    { q: "Bloom filter trả lời được gì?", options: [
        "Giá trị của khoá",
        "'Chắc chắn không có' hoặc 'có thể có' — có dương tính giả, không âm tính giả",
        "Số dòng trong file",
        "Khoá lớn nhất"
      ], correct: 1, explanation: "Nhờ đó bỏ qua được phần lớn SSTable khi đọc." },
    { q: "Delete trong LSM-tree làm gì?", options: [
        "Xoá ngay dòng khỏi mọi file",
        "Ghi một tombstone; dữ liệu cũ bị bỏ khi compaction",
        "Khoá file",
        "Không hỗ trợ delete"
      ], correct: 1, explanation: "Vì SSTable bất biến." },
    { q: "Compaction làm gì?", options: [
        "Nén bằng zip",
        "Gộp nhiều SSTable (merge-sort), bỏ bản cũ và tombstone hết hạn",
        "Sao lưu dữ liệu",
        "Tạo index mới"
      ], correct: 1, explanation: "Giảm số file cần đọc và thu hồi chỗ." },
    { q: "So với B-tree, LSM-tree thường mạnh hơn ở điểm nào?", options: [
        "Đọc điểm luôn nhanh hơn", "Thông lượng ghi cao (ghi tuần tự)", "Không cần đĩa", "Không có amplification"
      ], correct: 1, explanation: "Đổi lại đọc có thể phải xem nhiều file và compaction tốn I/O." },
    { q: "Leveled compaction khác size-tiered chủ yếu ở đâu?", options: [
        "Không dùng SSTable",
        "Chia tầng, khoá trong một tầng không chồng lấn → đọc tốt, ít chiếm chỗ, nhưng ghi lại nhiều hơn",
        "Chỉ chạy khi tắt máy",
        "Không xoá tombstone"
      ], correct: 1, explanation: "Size-tiered ưu tiên ghi, leveled ưu tiên đọc và dung lượng." },
    { q: "Lỗi 'Too many parts' ở ClickHouse thường do?", options: [
        "Bảng có quá nhiều cột",
        "INSERT quá vụn, tạo part nhanh hơn tốc độ merge nền",
        "Thiếu RAM cho JVM",
        "Sai isolation level"
      ], correct: 1, explanation: "Gom batch lớn hoặc bật async_insert." },
    { q: "DB nào dưới đây dùng B-tree (không phải LSM) làm cấu trúc lưu trữ mặc định?", options: [
        "RocksDB", "Cassandra", "PostgreSQL", "LevelDB"
      ], correct: 2, explanation: "PostgreSQL: heap + B-tree. MongoDB WiredTiger mặc định cũng là B-tree." }
  ]
});
