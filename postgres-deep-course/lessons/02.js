window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Kiến trúc bên trong",
  title: "Shared buffers, WAL & checkpoint — đường đi của một lệnh COMMIT",
  subtitle: "Trang 8 KB · ghi WAL trước, ghi dữ liệu sau · fsync · full-page write",

  theory: `
    <p>Khi bạn gọi <code>repository.save(order)</code> rồi transaction commit, dữ liệu <strong>chưa</strong> nằm trong file bảng. Nó nằm ở 2 nơi: một trang bẩn trong RAM và một bản ghi trong WAL đã fsync. Đó là bí quyết để PostgreSQL vừa nhanh vừa không mất dữ liệu khi mất điện.</p>

    <p><strong>Trang (page) 8 KB</strong> là đơn vị của mọi thứ: file bảng và file index được chia thành các trang 8 KB; đọc/ghi/cache đều theo trang. Một bảng là một (hoặc nhiều, mỗi file tối đa 1 GB) file trong <code>base/&lt;oid db&gt;/&lt;relfilenode&gt;</code>.</p>

    <p><strong>Shared buffers</strong> là cache trang dùng chung. Backend cần trang nào → tìm trong buffer; không có thì đọc từ OS (thường OS còn page cache của nó — đọc "từ đĩa" có thể vẫn là từ RAM của kernel). Sửa dữ liệu = sửa trang trong buffer, đánh dấu <em>dirty</em>.</p>

    <p><strong>WAL (Write-Ahead Log)</strong> — quy tắc vàng: <em>bản ghi WAL mô tả thay đổi phải xuống đĩa trước khi trang dữ liệu tương ứng xuống đĩa</em>. WAL là file ghi nối tiếp (segment 16 MB trong <code>pg_wal/</code>), ghi tuần tự nên rẻ hơn nhiều so với ghi ngẫu nhiên các trang bảng/index.</p>
    <ol>
      <li>UPDATE sửa trang trong shared buffers + sinh bản ghi WAL vào WAL buffers.</li>
      <li>COMMIT: ghi bản ghi commit, <strong>fsync WAL</strong> tới LSN đó rồi mới trả "OK" cho client (với <code>synchronous_commit = on</code>).</li>
      <li>Trang dữ liệu bẩn được ghi xuống sau, bởi bgwriter/checkpointer, có thể vài phút sau.</li>
      <li>Crash: khởi động lại, đọc WAL từ checkpoint gần nhất và <strong>redo</strong> — trang nào thiếu thay đổi thì áp lại.</li>
    </ol>

    <p><strong>Checkpoint</strong>: điểm mà mọi trang bẩn trước đó đã được ghi xuống file dữ liệu → WAL cũ hơn không còn cần cho crash recovery (có thể tái dùng/xoá, trừ khi đang cần cho archive/replication). Kích hoạt theo <code>checkpoint_timeout</code> (mặc định 5 phút) hoặc khi WAL sinh ra vượt <code>max_wal_size</code> (mặc định 1 GB). <code>checkpoint_completion_target = 0.9</code> dàn đều việc ghi để tránh "bão I/O".</p>

    <p><strong>Full-page write</strong>: lần đầu một trang bị sửa sau mỗi checkpoint, WAL chứa <em>nguyên trang 8 KB</em> — phòng trường hợp mất điện khi trang mới ghi được một nửa (torn page). Hệ quả: checkpoint quá dày → WAL phình to.</p>

    <table>
      <tr><th>synchronous_commit</th><th>COMMIT chờ gì</th><th>Rủi ro</th></tr>
      <tr><td><code>on</code> (mặc định)</td><td>WAL fsync ở local (và standby đồng bộ nếu cấu hình)</td><td>Không mất commit đã xác nhận</td></tr>
      <tr><td><code>off</code></td><td>Không chờ fsync</td><td>Crash có thể mất vài trăm ms commit gần nhất, nhưng <em>không</em> hỏng dữ liệu</td></tr>
    </table>

    <div class="callout"><p>💡 Tắt <code>fsync</code> thì khác hẳn: crash có thể <strong>hỏng</strong> cả database. Muốn đổi độ bền lấy tốc độ cho dữ liệu ít quan trọng (log, metric) → dùng <code>SET LOCAL synchronous_commit = off</code> cho transaction đó, đừng bao giờ tắt fsync.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "① Đường đi của COMMIT", lines: [
      "BEGIN;",
      "UPDATE orders SET status = 'PAID' WHERE id = 42;",
      "  # 1. tìm trang chứa id=42 trong shared_buffers (miss → đọc từ OS)",
      "  # 2. sửa trang trong RAM, đánh dấu dirty",
      "  # 3. ghi bản ghi WAL vào wal_buffers, LSN = 0/3A0012F8",
      "COMMIT;",
      "  # 4. ghi bản ghi COMMIT, fsync pg_wal tới LSN đó",
      "  # 5. trả OK cho client  ← dữ liệu đã bền dù trang bảng chưa ghi",
      "  # 6. (sau đó) bgwriter/checkpointer ghi trang 8KB xuống base/16384/24576"
    ]},
    { id: "inspect", label: "② Soi LSN & buffer", lines: [
      "SELECT pg_current_wal_lsn();                 -- 0/3A0012F8",
      "SELECT pg_walfile_name(pg_current_wal_lsn()); -- 00000001000000000000003A",
      "",
      "SELECT pg_relation_filepath('orders');       -- base/16384/24576",
      "SELECT pg_relation_size('orders') / 8192 AS pages;",
      "",
      "CREATE EXTENSION pg_buffercache;",
      "SELECT count(*) AS buffers, count(*) FILTER (WHERE isdirty) AS dirty",
      "FROM pg_buffercache b JOIN pg_class c ON b.relfilenode = c.relfilenode",
      "WHERE c.relname = 'orders';"
    ]},
    { id: "conf", label: "③ Cấu hình liên quan", lines: [
      "shared_buffers = 4GB               # mặc định 128MB; ~25% RAM là điểm khởi đầu",
      "wal_buffers = -1                   # tự tính theo shared_buffers (tối đa 16MB)",
      "synchronous_commit = on",
      "checkpoint_timeout = 15min         # mặc định 5min",
      "max_wal_size = 8GB                 # mặc định 1GB",
      "checkpoint_completion_target = 0.9",
      "full_page_writes = on              # KHÔNG tắt",
      "fsync = on                         # KHÔNG BAO GIỜ tắt ở production",
      "log_checkpoints = on               # mặc định on từ PG 15"
    ]},
    { id: "rust", label: "④ Rust: nới độ bền có chủ đích", lines: [
      "// Ghi log truy cập: mất vài trăm ms khi crash cũng chấp nhận được",
      "let mut tx = pool.begin().await?;",
      "sqlx::query(\"SET LOCAL synchronous_commit = off\")",
      "    .execute(&mut *tx).await?;",
      "sqlx::query(\"INSERT INTO access_log (path, ms) VALUES ($1, $2)\")",
      "    .bind(path).bind(ms)",
      "    .execute(&mut *tx).await?;",
      "tx.commit().await?;   // trả về không chờ fsync WAL"
    ]}
  ],

  stageHtml: `
    <div class="node" id="be"><div class="nl">⚙️ Backend chạy UPDATE</div><div class="ns">sửa trang trong RAM</div></div>
    <div class="row">
      <div class="node" id="sb"><div class="nl">🧠 shared_buffers</div><div class="ns">trang 8KB dirty</div></div>
      <div class="node" id="wb"><div class="nl">📝 WAL buffers</div><div class="ns">bản ghi thay đổi</div></div>
    </div>
    <div class="arrow" id="a1">↓ COMMIT → fsync WAL (tuần tự, rẻ)</div>
    <div class="node" id="wal"><div class="nl">💾 pg_wal/ segment 16MB</div><div class="ns">bền từ đây</div></div>
    <div class="arrow" id="a2">↓ vài phút sau: checkpoint</div>
    <div class="node" id="data"><div class="nl">💾 base/…/relfilenode</div><div class="ns">file bảng, ghi ngẫu nhiên</div></div>
  `,
  steps: [
    { title: "1 · Sửa trang trong RAM", tab: "flow", highlight: [2, 3, 4], on: ["be", "sb"],
      desc: "Không có I/O ghi nào ở bước này. Trang bị đánh dấu dirty trong shared buffers." },
    { title: "2 · Sinh bản ghi WAL", tab: "flow", highlight: [5], on: ["wb"],
      desc: "Mỗi thay đổi có một vị trí trong WAL gọi là <strong>LSN</strong> (Log Sequence Number), dạng <code>0/3A0012F8</code>." },
    { title: "3 · COMMIT = fsync WAL", tab: "flow", highlight: [6, 7, 8], on: ["a1", "wal"],
      desc: "Chỉ WAL phải xuống đĩa trước khi báo OK. Ghi tuần tự vào một file nên nhanh; nhiều commit đồng thời còn được gộp chung một lần fsync." },
    { title: "4 · Checkpoint ghi trang dữ liệu", tab: "conf", highlight: [4, 5, 6], on: ["a2", "data"],
      desc: "Checkpointer ghi trang bẩn xuống file bảng, dàn đều trong 90% khoảng thời gian tới checkpoint sau. Checkpoint thưa hơn = ít full-page write hơn, nhưng recovery lâu hơn." },
    { title: "5 · Crash → redo từ WAL", tab: "inspect", highlight: [1, 2], on: ["wal", "data"],
      desc: "Khởi động lại, PostgreSQL đọc WAL từ checkpoint cuối và áp lại thay đổi. Commit nào đã fsync WAL thì không mất." },
    { title: "6 · Nới độ bền có chủ đích", tab: "rust", highlight: [3, 8], on: ["be"],
      desc: "<code>SET LOCAL synchronous_commit = off</code> chỉ ảnh hưởng transaction này: nhanh hơn, có thể mất commit gần nhất khi crash, nhưng DB không bao giờ bị hỏng." }
  ],

  quiz: [
    { q: "Kích thước trang mặc định của PostgreSQL?", options: ["4 KB", "8 KB", "16 KB", "1 MB"], correct: 1,
      explanation: "8 KB, là đơn vị đọc/ghi/cache của bảng và index." },
    { q: "Nguyên tắc Write-Ahead Log là gì?", options: [
        "Ghi file bảng trước, WAL sau",
        "Bản ghi WAL của thay đổi phải xuống đĩa trước khi trang dữ liệu tương ứng xuống đĩa",
        "Ghi WAL mỗi 5 phút một lần",
        "WAL chỉ dùng cho replication"
      ], correct: 1, explanation: "Nhờ đó crash lúc nào cũng redo được." },
    { q: "Khi client nhận 'COMMIT' thành công (synchronous_commit=on), điều nào CHẮC CHẮN đúng?", options: [
        "Trang bảng đã được ghi xuống file dữ liệu",
        "WAL chứa commit đã được fsync xuống đĩa",
        "Checkpoint vừa chạy xong",
        "Dữ liệu đã có trên mọi replica"
      ], correct: 1, explanation: "Trang dữ liệu có thể vẫn chỉ nằm trong RAM; WAL mới là thứ đảm bảo bền." },
    { q: "Vì sao ghi WAL lúc commit lại nhanh hơn ghi thẳng trang bảng?", options: [
        "WAL được nén",
        "WAL ghi tuần tự vào một file, còn trang bảng/index nằm rải rác (ghi ngẫu nhiên)",
        "WAL không cần fsync",
        "WAL nằm trong RAM"
      ], correct: 1, explanation: "Thêm vào đó, nhiều commit đồng thời có thể dùng chung một lần fsync (group commit)." },
    { q: "Full-page write sinh ra để chống lại điều gì?", options: [
        "SQL injection",
        "Trang bị ghi dở (torn page) khi mất điện",
        "Deadlock",
        "Bloat"
      ], correct: 1, explanation: "Lần đầu sửa trang sau checkpoint, WAL lưu nguyên trang để phục hồi được kể cả khi trang trên đĩa bị ghi một nửa." },
    { q: "Hai điều kiện nào kích hoạt checkpoint tự động?", options: [
        "Số connection và số bảng",
        "checkpoint_timeout đã trôi qua hoặc lượng WAL vượt max_wal_size",
        "Mỗi COMMIT",
        "Khi autovacuum chạy"
      ], correct: 1, explanation: "Log 'checkpoints are occurring too frequently' nghĩa là max_wal_size quá nhỏ so với tải ghi." },
    { q: "synchronous_commit = off có thể gây hậu quả gì khi crash?", options: [
        "Database bị hỏng, phải restore backup",
        "Mất một số commit gần nhất đã báo OK, nhưng dữ liệu vẫn nhất quán",
        "Không có hậu quả gì",
        "Mất toàn bộ bảng"
      ], correct: 1, explanation: "Khác hoàn toàn với fsync=off, thứ có thể làm hỏng dữ liệu." },
    { q: "LSN là gì?", options: [
        "Mã khoá chính nội bộ của row",
        "Vị trí (byte offset) trong luồng WAL",
        "Số hiệu transaction",
        "Tên file bảng"
      ], correct: 1, explanation: "Log Sequence Number, dùng để đo độ trễ replication, xác định điểm recovery..." },
    { q: "shared_buffers mặc định và điểm khởi đầu hay dùng cho server riêng?", options: [
        "128MB; khoảng 25% RAM",
        "1GB; 90% RAM",
        "8KB; 1% RAM",
        "Không cấu hình được"
      ], correct: 0, explanation: "PostgreSQL còn dựa vào page cache của OS nên không cần (và không nên) cho shared_buffers gần hết RAM." }
  ]
});
