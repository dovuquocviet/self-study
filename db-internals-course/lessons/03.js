window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Nền tảng lưu trữ",
  title: "WAL & fsync — COMMIT thật sự nghĩa là gì",
  subtitle: "Write-ahead log · fsync · checkpoint · crash recovery · mỗi DB đánh đổi độ bền ra sao",

  theory: `
    <p>Bài 02: page dirty nằm trong RAM, ghi xuống đĩa sau. Vậy nếu mất điện ngay sau COMMIT thì sao? Câu trả lời là <strong>WAL — Write-Ahead Log</strong>:
    trước khi thay đổi được coi là xong, một bản mô tả thay đổi phải nằm an toàn trên đĩa trong một file log ghi <em>tuần tự</em>.</p>

    <p><strong>Quy tắc write-ahead</strong>: bản ghi WAL mô tả thay đổi phải được ghi bền <em>trước</em> page dữ liệu tương ứng. COMMIT chỉ trả về khi bản ghi WAL
    của commit đã được <code>fsync</code>.</p>

    <p><strong>Vì sao không ghi thẳng page?</strong> Một transaction sửa 5 dòng ở 5 page rải rác = 5 lần ghi ngẫu nhiên 8 KB. WAL chỉ cần nối vài trăm byte vào cuối file = ghi tuần tự,
    và nhiều transaction đồng thời có thể dùng chung một lần fsync (<em>group commit</em>).</p>

    <p><strong>fsync là gì?</strong> <code>write()</code> chỉ chép vào page cache của OS; dữ liệu vẫn có thể mất khi mất điện. <code>fsync()</code> buộc OS đẩy xuống thiết bị
    và chờ thiết bị xác nhận. Đây là thao tác đắt nhất của một COMMIT (từ vài chục µs trên NVMe có tụ bảo vệ tới vài ms).</p>

    <p><strong>Checkpoint &amp; recovery</strong></p>
    <ol>
      <li>Định kỳ, checkpointer ghi mọi page dirty xuống đĩa và đánh dấu "mọi thứ trước LSN X đã nằm trong file dữ liệu".</li>
      <li>Khi crash, DB đọc WAL từ checkpoint cuối và <em>redo</em> lại các thay đổi → dữ liệu về đúng trạng thái đã commit.</li>
      <li>WAL cũ hơn checkpoint có thể tái sử dụng/xoá (trừ khi replica hoặc archive còn cần).</li>
    </ol>
    <p>PostgreSQL còn bật <code>full_page_writes</code>: lần đầu sửa một page sau checkpoint thì ghi nguyên page vào WAL, phòng trường hợp page 8 KB chỉ ghi được một nửa (torn page).</p>

    <p><strong>WAL còn là nền của replication</strong>: replica nhận luồng WAL và phát lại (bài 18). Kafka thì đi xa hơn: <em>log chính là dữ liệu</em>.</p>

    <table>
      <tr><th>DB</th><th>Log</th><th>Nút vặn độ bền</th></tr>
      <tr><td>PostgreSQL</td><td>WAL (segment 16 MB)</td><td><code>synchronous_commit</code> = on / off / local / remote_write / remote_apply</td></tr>
      <tr><td>MongoDB</td><td>WiredTiger journal</td><td>writeConcern <code>j: true</code>, <code>w: "majority"</code></td></tr>
      <tr><td>Redis</td><td>AOF</td><td><code>appendfsync always / everysec / no</code></td></tr>
      <tr><td>Elasticsearch</td><td>translog</td><td><code>index.translog.durability: request</code> (mặc định) hoặc <code>async</code></td></tr>
      <tr><td>Kafka</td><td>chính log partition</td><td>Mặc định không fsync từng message; độ bền dựa vào <code>acks=all</code> + nhiều replica</td></tr>
    </table>

    <div class="callout"><p>💡 <code>synchronous_commit = off</code> ở PostgreSQL không làm hỏng dữ liệu: nó có thể <em>mất vài transaction cuối</em> (tối đa khoảng 3 × <code>wal_writer_delay</code>)
    khi crash, nhưng DB vẫn nhất quán. Còn <code>fsync = off</code> thì crash có thể làm hỏng cả cluster — không bao giờ dùng trên production.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "Luồng COMMIT", lines: [
      "BEGIN;",
      "UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- sửa page trong RAM",
      "UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- sửa page khác trong RAM",
      "COMMIT;",
      "",
      "# bên trong COMMIT:",
      "# 1. nối bản ghi WAL (2 update + commit record) vào WAL buffer",
      "# 2. write() WAL buffer vào file pg_wal/000000010000000000000003",
      "# 3. fsync() file WAL  ← chờ ở đây",
      "# 4. trả 'COMMIT' cho client",
      "# 5. (sau đó) checkpointer ghi 2 page dirty vào file bảng"
    ]},
    { id: "recover", label: "Crash recovery", lines: [
      "LSN 0/3000000  CHECKPOINT           ← mọi page trước đây đã nằm trên đĩa",
      "LSN 0/3000128  UPDATE rel=accounts blk=5 ...",
      "LSN 0/30001A0  UPDATE rel=accounts blk=9 ...",
      "LSN 0/3000210  COMMIT xid=812",
      "LSN 0/3000280  UPDATE rel=orders blk=2 ...   (xid=813, chưa commit)",
      "--- mất điện ---",
      "",
      "# khởi động lại: redo từ checkpoint",
      "# xid 812 đã commit → thay đổi hiện ra",
      "# xid 813 không có commit record → coi như abort, MVCC làm nó vô hình"
    ]},
    { id: "knobs", label: "Nút vặn độ bền", lines: [
      "-- PostgreSQL: cho riêng transaction ghi log hành vi, chấp nhận mất vài ms cuối",
      "SET LOCAL synchronous_commit = off;",
      "",
      "# redis.conf",
      "appendonly yes",
      "appendfsync everysec      # mất tối đa ~1 giây ghi khi crash",
      "",
      "// MongoDB: chờ journal trên đa số node",
      "db.orders.insertOne({ _id: 1001 }, { writeConcern: { w: 'majority', j: true } })",
      "",
      "# Kafka producer: bền nhờ replica chứ không nhờ fsync",
      "acks=all"
    ]},
    { id: "java", label: "Góc nhìn Spring", lines: [
      "@Transactional",
      "public void transfer(long from, long to, long amount) {",
      "    accountRepo.debit(from, amount);",
      "    accountRepo.credit(to, amount);",
      "}   // ← proxy gọi connection.commit() tại đây",
      "",
      "// commit() chỉ trả về khi WAL đã fsync (với synchronous_commit=on).",
      "// Thời gian của nó ≈ độ trễ fsync của đĩa, không phụ thuộc số dòng đã sửa."
    ]}
  ],

  stageHtml: `
    <div class="node" id="tx"><div class="nl">🧾 Transaction</div><div class="ns">2 UPDATE</div></div>
    <div class="arrow" id="a1">↓ sửa page trong RAM (dirty)</div>
    <div class="row">
      <div class="node" id="bp"><div class="nl">🧠 Buffer pool</div><div class="ns">page 5, page 9 dirty</div></div>
      <div class="node" id="wal"><div class="nl">📜 WAL buffer</div><div class="ns">bản ghi thay đổi</div></div>
    </div>
    <div class="arrow" id="a2">↓ COMMIT: fsync WAL (tuần tự)</div>
    <div class="node" id="walf"><div class="nl">💾 File WAL trên đĩa</div><div class="ns">bền vững → trả OK</div></div>
    <div class="arrow" id="a3">↓ checkpoint (sau đó)</div>
    <div class="node" id="data"><div class="nl">💾 File dữ liệu</div><div class="ns">page được ghi ngẫu nhiên, gộp nhiều lần sửa</div></div>
  `,
  steps: [
    { title: "1 · Sửa trong RAM", tab: "flow", highlight: [1, 2, 3], on: ["tx", "a1", "bp"],
      desc: "UPDATE chỉ chạm page trong buffer pool, đồng thời sinh bản ghi WAL." },
    { title: "2 · Ghi WAL tuần tự", tab: "flow", highlight: [7, 8], on: ["wal"],
      desc: "Bản ghi WAL nhỏ, nối vào cuối file — ghi tuần tự rẻ hơn nhiều so với ghi page ngẫu nhiên." },
    { title: "3 · fsync rồi mới trả COMMIT", tab: "flow", highlight: [4, 9, 10], on: ["a2", "walf"],
      desc: "Đây là điểm độ bền (Durability). Group commit cho nhiều transaction dùng chung một fsync." },
    { title: "4 · Checkpoint ghi page", tab: "flow", highlight: [11], on: ["a3", "data"],
      desc: "Page dirty được ghi sau, có thể gộp hàng trăm lần sửa vào một lần ghi." },
    { title: "5 · Crash → redo từ checkpoint", tab: "recover", highlight: [1, 4, 5, 9, 10], on: ["walf", "data"],
      desc: "Transaction có commit record được phát lại; transaction dở dang coi như abort." },
    { title: "6 · Mỗi DB một nút vặn", tab: "knobs", highlight: [2, 6, 9, 12], on: ["walf"],
      desc: "Đánh đổi độ trễ lấy rủi ro mất vài ghi cuối. Kafka chọn độ bền qua replica thay vì fsync từng message." }
  ],

  quiz: [
    { q: "Quy tắc 'write-ahead' nói gì?", options: [
        "Ghi page dữ liệu trước, log sau",
        "Bản ghi log mô tả thay đổi phải bền trên đĩa trước page dữ liệu tương ứng",
        "Ghi vào replica trước",
        "Chỉ ghi khi checkpoint"
      ], correct: 1, explanation: "Nhờ vậy khi crash luôn có log để redo." },
    { q: "Vì sao ghi WAL rẻ hơn ghi thẳng các page đã sửa lúc COMMIT?", options: [
        "Vì WAL không cần fsync",
        "Vì WAL là ghi tuần tự bản ghi nhỏ, còn page là ghi ngẫu nhiên 8 KB ở nhiều vị trí",
        "Vì WAL nằm trong RAM",
        "Vì WAL được nén bằng gzip"
      ], correct: 1, explanation: "Và group commit còn chia sẻ một fsync cho nhiều transaction." },
    { q: "write() trả về thành công có nghĩa dữ liệu đã an toàn khi mất điện không?", options: [
        "Có", "Không — mới vào page cache của OS; cần fsync()", "Chỉ trên SSD", "Chỉ trên Linux"
      ], correct: 1, explanation: "fsync buộc OS đẩy xuống thiết bị và chờ xác nhận." },
    { q: "Khi khởi động sau crash, PostgreSQL làm gì?", options: [
        "Xoá toàn bộ dữ liệu",
        "Đọc WAL từ checkpoint cuối và redo các thay đổi",
        "Hỏi replica",
        "Bỏ qua, chạy tiếp"
      ], correct: 1, explanation: "Transaction không có commit record thì không hiện ra." },
    { q: "synchronous_commit = off gây hậu quả gì khi crash?", options: [
        "Hỏng toàn bộ cluster",
        "Có thể mất vài transaction cuối đã báo commit, nhưng DB vẫn nhất quán",
        "Không có hậu quả gì",
        "Mất toàn bộ WAL"
      ], correct: 1, explanation: "Khác với fsync=off — cái đó có thể làm hỏng dữ liệu." },
    { q: "full_page_writes trong PostgreSQL chống lại vấn đề gì?", options: [
        "Deadlock", "Torn page — page 8 KB chỉ được ghi một phần khi crash", "SQL injection", "Replica lag"
      ], correct: 1, explanation: "Lần sửa đầu sau checkpoint ghi nguyên page vào WAL để khôi phục được." },
    { q: "Redis appendfsync everysec có nghĩa là?", options: [
        "fsync sau mỗi lệnh",
        "fsync AOF mỗi giây; crash có thể mất khoảng 1 giây ghi",
        "Không bao giờ fsync",
        "Snapshot mỗi giây"
      ], correct: 1, explanation: "always an toàn nhất nhưng chậm; no để OS tự quyết." },
    { q: "Kafka mặc định đảm bảo độ bền chủ yếu bằng cách nào?", options: [
        "fsync từng message",
        "Nhân bản sang nhiều broker (acks=all + min.insync.replicas), không fsync từng message",
        "Ghi vào PostgreSQL",
        "Không đảm bảo gì"
      ], correct: 1, explanation: "Xác suất mọi replica cùng mất điện trước khi flush là rất thấp." },
    { q: "Trong Spring, thời gian của connection.commit() chủ yếu phụ thuộc vào?", options: [
        "Số dòng đã sửa",
        "Độ trễ fsync WAL của đĩa (khi synchronous_commit=on)",
        "Số annotation @Transactional",
        "Kích thước heap JVM"
      ], correct: 1, explanation: "Các thay đổi đã ở WAL buffer; commit chủ yếu chờ fsync." }
  ]
});
