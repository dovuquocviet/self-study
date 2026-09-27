window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Kiến trúc bên trong",
  title: "Kiến trúc process: postmaster, backend, background workers",
  subtitle: "Mỗi connection = một process OS · vì sao max_connections không thể để 5000",

  theory: `
    <p>Với Spring Boot bạn quen mô hình <strong>thread-per-request</strong>: Tomcat có pool 200 thread, HikariCP giữ 10 connection. Nhưng phía PostgreSQL, mỗi connection trong HikariCP đó là <strong>một process hệ điều hành</strong> riêng. Hiểu điều này giải thích gần hết các quyết định vận hành sau này (pooler, max_connections, work_mem).</p>

    <p><strong>Cây process của một server PostgreSQL</strong></p>
    <table>
      <tr><th>Process</th><th>Việc</th></tr>
      <tr><td><code>postmaster</code> (process cha)</td><td>Nghe cổng 5432, xác thực ban đầu, <strong>fork()</strong> một backend cho mỗi connection mới; khởi động lại mọi thứ nếu một con bị crash</td></tr>
      <tr><td><code>backend</code> (client backend)</td><td>Phục vụ đúng <em>một</em> connection từ đầu đến cuối: parse → plan → execute SQL. Không chia sẻ giữa các client</td></tr>
      <tr><td><code>checkpointer</code></td><td>Định kỳ ghi mọi trang "bẩn" trong shared buffers xuống file dữ liệu (bài 02)</td></tr>
      <tr><td><code>background writer</code></td><td>Ghi dần trang bẩn để backend ít phải tự ghi khi cần chỗ trống</td></tr>
      <tr><td><code>walwriter</code></td><td>Đẩy WAL buffer xuống đĩa</td></tr>
      <tr><td><code>autovacuum launcher</code> + <code>autovacuum worker</code></td><td>Dọn tuple chết, cập nhật thống kê, freeze (Pha 1)</td></tr>
      <tr><td><code>walsender</code> / <code>walreceiver</code></td><td>Gửi/nhận WAL khi có replication</td></tr>
      <tr><td><code>archiver</code>, <code>logical replication launcher</code>, <code>io worker</code> (PG 18)</td><td>Lưu trữ WAL, điều phối logical replication, I/O bất đồng bộ</td></tr>
      <tr><td><code>parallel worker</code></td><td>Được backend "mượn" để chạy song song một phần query (Gather)</td></tr>
    </table>

    <p><strong>Vì sao là process mà không phải thread?</strong> Thiết kế từ thập niên 90, ưu tiên cô lập: một backend crash thì postmaster reset shared memory và các backend khác, nhưng không có chuyện một thread hỏng ghi đè bộ nhớ của connection khác. Cái giá:</p>
    <ul>
      <li>Mỗi backend tốn vài MB RSS riêng (catalog cache, plan cache...) cộng với bộ nhớ cho sort/hash khi chạy query.</li>
      <li>Fork + xác thực + nạp catalog cache tốn vài ms — mở connection mới cho mỗi request là rất đắt.</li>
      <li>Nhiều connection đồng thời → nhiều process tranh CPU, lock trong shared memory, snapshot lớn hơn. Thông lượng thường <strong>giảm</strong> khi số connection <em>đang chạy</em> vượt xa số core.</li>
    </ul>

    <p><strong>Bộ nhớ: chia sẻ và riêng</strong></p>
    <ul>
      <li><strong>Shared memory</strong> (mọi process thấy): <code>shared_buffers</code> (cache trang dữ liệu), WAL buffers, lock table, CLOG (trạng thái commit của transaction).</li>
      <li><strong>Local memory</strong> (mỗi backend): <code>work_mem</code> cho từng node sort/hash, <code>temp_buffers</code>, <code>maintenance_work_mem</code> cho VACUUM/CREATE INDEX.</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc thực chiến: <code>max_connections</code> để vừa phải (vài trăm trở xuống), đặt <strong>pooler</strong> ở giữa (PgBouncer, Hyperdrive — bài 18). Số connection hữu ích ≈ vài lần số core, không phải số request đồng thời. 20 pod × Hikari 10 = 200 process, phần lớn ngồi chơi <code>idle</code>.</p></div>
  `,

  codeTabs: [
    { id: "ps", label: "① ps trên server", lines: [
      "$ ps -ef --forest | grep postgres",
      "postgres  1001     1  /usr/lib/postgresql/17/bin/postgres -D /var/lib/postgresql/17/main",
      "postgres  1002  1001   \\_ postgres: checkpointer",
      "postgres  1003  1001   \\_ postgres: background writer",
      "postgres  1005  1001   \\_ postgres: walwriter",
      "postgres  1006  1001   \\_ postgres: autovacuum launcher",
      "postgres  1007  1001   \\_ postgres: logical replication launcher",
      "postgres  2210  1001   \\_ postgres: order_svc orders 10.0.3.7(51514) idle",
      "postgres  2211  1001   \\_ postgres: order_svc orders 10.0.3.7(51522) SELECT",
      "postgres  2305  1001   \\_ postgres: order_svc orders 10.0.3.9(40112) idle in transaction"
    ]},
    { id: "sql", label: "② Nhìn từ SQL", lines: [
      "SELECT pid, backend_type, usename, state, wait_event_type, wait_event",
      "FROM pg_stat_activity",
      "ORDER BY backend_type;",
      "",
      "--  pid  | backend_type        | usename   | state  | wait_event",
      "-- 1002  | checkpointer        |           |        | CheckpointerMain",
      "-- 1006  | autovacuum launcher |           |        | AutovacuumMain",
      "-- 2210  | client backend      | order_svc | idle   | ClientRead",
      "-- 2211  | client backend      | order_svc | active |",
      "",
      "SHOW max_connections;   -- mặc định 100"
    ]},
    { id: "java", label: "③ Java ↔ PostgreSQL", lines: [
      "// Spring Boot: Tomcat 200 thread, HikariCP 10 connection / pod",
      "spring.datasource.hikari.maximum-pool-size=10",
      "",
      "// 20 pod × 10 = 200 connection = 200 PROCESS trên DB server",
      "// Mỗi process: vài MB + work_mem × số node sort/hash khi chạy",
      "",
      "// Rust (sqlx) cũng y hệt: pool ở phía app, process ở phía DB",
      "let pool = PgPoolOptions::new()",
      "    .max_connections(10)",
      "    .connect(&database_url).await?;"
    ]},
    { id: "crash", label: "④ Khi 1 backend crash", lines: [
      "LOG:  server process (PID 2211) was terminated by signal 9: Killed",
      "DETAIL:  Failed process was running: SELECT ... ORDER BY ...",
      "LOG:  terminating any other active server processes",
      "LOG:  all server processes terminated; reinitializing",
      "LOG:  database system was not properly shut down; automatic recovery in progress",
      "LOG:  redo starts at 3/1A2B3C40",
      "LOG:  database system is ready to accept connections",
      "",
      "# signal 9 thường do OOM killer: work_mem quá lớn × nhiều connection"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">☕ / 🦀 App pool (Hikari, sqlx)</div><div class="ns">giữ N connection TCP</div></div>
    <div class="arrow" id="a1">↓ connect :5432</div>
    <div class="node" id="pm"><div class="nl">👑 postmaster</div><div class="ns">xác thực, fork()</div></div>
    <div class="arrow" id="a2">↓ fork mỗi connection</div>
    <div class="row">
      <div class="node" id="be"><div class="nl">⚙️ backend × N</div><div class="ns">parse → plan → execute</div></div>
      <div class="node" id="bg"><div class="nl">🧹 background</div><div class="ns">checkpointer · bgwriter · walwriter · autovacuum</div></div>
    </div>
    <div class="arrow" id="a3">↓ cùng dùng</div>
    <div class="node" id="shm"><div class="nl">🧠 Shared memory</div><div class="ns">shared_buffers · WAL buffers · lock table · CLOG</div></div>
  `,
  steps: [
    { title: "1 · App mở connection", tab: "java", highlight: [2, 4], on: ["app", "a1"],
      desc: "Pool phía app (Hikari/sqlx) giữ connection TCP sẵn. Mỗi connection ấy tương ứng một process phía DB." },
    { title: "2 · postmaster fork backend", tab: "ps", highlight: [2, 8, 9, 10], on: ["pm", "a2", "be"],
      desc: "Trong <code>ps</code> mỗi backend hiện <code>user db ip(port) trạng thái</code>. Chú ý dòng <code>idle in transaction</code> — process đang giữ transaction mở mà không làm gì." },
    { title: "3 · Các process nền", tab: "ps", highlight: [3, 4, 5, 6, 7], on: ["bg"],
      desc: "Checkpointer, bgwriter, walwriter, autovacuum chạy độc lập với connection của bạn. Chúng là lý do dữ liệu bền và bảng không phình mãi." },
    { title: "4 · Soi bằng pg_stat_activity", tab: "sql", highlight: [1, 2, 8, 9, 11], on: ["be", "bg"],
      desc: "<code>backend_type</code> phân biệt client backend với process nền. <code>state</code> + <code>wait_event</code> cho biết process đang chạy hay đang chờ gì." },
    { title: "5 · Shared memory & crash", tab: "crash", highlight: [1, 3, 4, 5, 9], on: ["shm"],
      desc: "Mọi process dùng chung shared memory. Một backend chết bất thường → postmaster không tin shared memory nữa, giết tất cả và chạy recovery từ WAL. Mọi connection đều rớt." }
  ],

  quiz: [
    { q: "PostgreSQL phục vụ mỗi connection bằng gì?", options: [
        "Một thread trong thread pool chung",
        "Một process OS riêng do postmaster fork",
        "Một coroutine trong event loop",
        "Một process dùng chung cho mọi connection cùng user"
      ], correct: 1, explanation: "Mô hình process-per-connection: mỗi connection có một backend process riêng suốt vòng đời." },
    { q: "Vì sao mở connection mới cho mỗi HTTP request là tệ với PostgreSQL?", options: [
        "Vì PostgreSQL giới hạn 10 connection",
        "Vì mỗi lần phải fork process, xác thực, nạp cache — tốn vài ms và tài nguyên",
        "Vì TCP không hỗ trợ",
        "Vì SQL sẽ bị sai"
      ], correct: 1, explanation: "Chi phí thiết lập backend cao; cần pool ở app hoặc pooler ở giữa." },
    { q: "Process nào định kỳ ghi toàn bộ trang bẩn từ shared buffers xuống file dữ liệu?", options: [
        "walwriter", "checkpointer", "postmaster", "autovacuum launcher"
      ], correct: 1, explanation: "Checkpointer tạo checkpoint; walwriter chỉ lo WAL." },
    { q: "work_mem nằm ở đâu?", options: [
        "Shared memory, dùng chung một lần cho cả server",
        "Bộ nhớ riêng của từng backend, cấp cho từng node sort/hash",
        "Trên đĩa",
        "Trong PgBouncer"
      ], correct: 1, explanation: "Mỗi node sort/hash trong mỗi query của mỗi backend có thể dùng tới work_mem — nên nó nhân lên rất nhanh." },
    { q: "Một backend bị OOM killer giết (signal 9). Điều gì xảy ra?", options: [
        "Chỉ connection đó rớt, các connection khác không ảnh hưởng",
        "Postmaster giết mọi backend, reset shared memory và chạy crash recovery",
        "Database bị hỏng vĩnh viễn",
        "Không có gì, PostgreSQL tự bỏ qua"
      ], correct: 1, explanation: "Vì process chết có thể đã làm hỏng shared memory, postmaster reinitialize toàn bộ; mọi client đều mất connection." },
    { q: "Trạng thái 'idle in transaction' trong pg_stat_activity nghĩa là gì?", options: [
        "Connection rảnh, không có transaction",
        "Đã BEGIN (hoặc đang trong transaction) nhưng hiện không chạy câu lệnh nào",
        "Đang chờ lock",
        "Đang chạy VACUUM"
      ], correct: 1, explanation: "Nguy hiểm: giữ snapshot và lock, cản VACUUM. Thường do code quên commit hoặc gọi HTTP bên trong transaction." },
    { q: "Tăng max_connections từ 200 lên 5000 để chịu tải thường dẫn tới gì?", options: [
        "Thông lượng tăng tuyến tính",
        "Nhiều process tranh CPU/lock, bộ nhớ tăng, thông lượng thường giảm — nên dùng pooler",
        "Không ảnh hưởng gì",
        "PostgreSQL tự chuyển sang thread"
      ], correct: 1, explanation: "Số connection đang chạy hữu ích chỉ khoảng vài lần số core; còn lại nên xếp hàng ở pooler." },
    { q: "Trong ví dụ 20 pod × HikariCP maximum-pool-size=10, DB có bao nhiêu client backend tối đa?", options: [
        "10", "20", "200", "Tuỳ số thread Tomcat"
      ], correct: 2, explanation: "Mỗi connection trong mỗi pool là một process. 20 × 10 = 200." },
    { q: "Ưu điểm chính của mô hình process so với thread mà PostgreSQL chọn?", options: [
        "Tiết kiệm bộ nhớ hơn",
        "Cô lập lỗi bộ nhớ giữa các connection",
        "Mở connection nhanh hơn",
        "Không cần shared memory"
      ], correct: 1, explanation: "Đổi lại là tốn tài nguyên và chi phí tạo connection." }
  ]
});
