window.LESSONS.push({
  id: "19",
  phase: "6", phaseName: "Vận hành production",
  title: "Replication: streaming (vật lý) & logical — và CDC sang Kafka",
  subtitle: "Standby đọc được · lag · sync vs async · replication slot · publication/subscription · Debezium",

  theory: `
    <p>Cả hai kiểu replication đều dựa trên WAL (bài 02) — nhưng gửi đi thứ khác nhau.</p>

    <table>
      <tr><th></th><th>Streaming (physical)</th><th>Logical</th></tr>
      <tr><td>Gửi gì</td><td>Byte WAL nguyên bản: "trang X, offset Y đổi thành…"</td><td>Thay đổi mức row đã giải mã: INSERT/UPDATE/DELETE trên bảng T</td></tr>
      <tr><td>Bản sao</td><td>Y hệt từng byte, toàn bộ cluster</td><td>Chọn bảng; bên nhận là DB bình thường, ghi được</td></tr>
      <tr><td>Version</td><td>Cùng major version</td><td>Khác major version được → dùng để nâng cấp ít downtime</td></tr>
      <tr><td>DDL</td><td>Có (vì là byte)</td><td><strong>Không</strong> — phải tự chạy DDL ở hai bên</td></tr>
      <tr><td>Dùng cho</td><td>HA/failover, replica đọc, backup</td><td>CDC (Debezium → Kafka), gộp/tách DB, nâng cấp</td></tr>
    </table>

    <p><strong>Streaming replication</strong>: process <code>walsender</code> trên primary đẩy WAL tới <code>walreceiver</code> trên standby, standby replay liên tục. Với <code>hot_standby = on</code>, standby phục vụ SELECT.</p>
    <ul>
      <li><strong>Async</strong> (mặc định): primary commit không chờ standby → primary chết có thể mất vài giao dịch cuối chưa kịp gửi.</li>
      <li><strong>Sync</strong>: đặt <code>synchronous_standby_names</code>; commit chờ standby xác nhận theo mức <code>synchronous_commit</code>: <code>remote_write</code> (standby đã nhận vào OS) → <code>on</code> (đã flush) → <code>remote_apply</code> (đã replay, đọc trên standby thấy ngay). Đổi lại độ trễ commit, và standby chết có thể làm primary treo ghi nếu không có standby thay thế.</li>
      <li><strong>Đọc từ replica = đọc dữ liệu có thể cũ</strong>: user vừa đặt hàng, trang "đơn của tôi" đọc từ replica → chưa thấy. Luồng đọc-sau-ghi đi primary.</li>
      <li><strong>Xung đột trên standby</strong>: VACUUM trên primary xoá tuple mà query dài trên standby còn cần → "canceling statement due to conflict with recovery". Hai núm: <code>max_standby_streaming_delay</code> (tạm dừng replay, mặc định 30s) hoặc <code>hot_standby_feedback = on</code> (báo xmin về primary — đổi lại bloat trên primary, bài 05).</li>
    </ul>

    <p><strong>Replication slot</strong> bảo đảm primary giữ WAL cho tới khi consumer nhận xong. Con dao hai lưỡi: consumer chết (Debezium dừng, standby bị gỡ quên xoá slot) → WAL tích tụ tới <strong>đầy đĩa primary</strong>. Đặt <code>max_slot_wal_keep_size</code> và alert trên dung lượng WAL giữ lại.</p>

    <p><strong>Logical replication &amp; CDC</strong>: <code>wal_level = logical</code>; primary tạo <code>PUBLICATION</code>; một PostgreSQL khác <code>SUBSCRIPTION</code>, hoặc Debezium dùng plugin <code>pgoutput</code> qua logical slot và đẩy mỗi thay đổi thành message Kafka. UPDATE/DELETE cần <strong>replica identity</strong> (mặc định là PK) để bên nhận biết row nào. Đây là con đường tự nhiên để dữ liệu nghiệp vụ trong PostgreSQL chảy vào Kafka rồi vào ClickHouse. PG 17 thêm <em>failover slots</em> để logical slot sống sót khi failover sang standby.</p>

    <div class="callout"><p>💡 Replication không phải backup: <code>DELETE FROM orders</code> nhầm được replay sang mọi standby trong vài ms. Backup + PITR (bài 20) mới cứu được lỗi người.</p></div>
  `,

  codeTabs: [
    { id: "phys", label: "① Streaming", lines: [
      "# primary: postgresql.conf",
      "wal_level = replica                 # mặc định",
      "max_wal_senders = 10",
      "max_slot_wal_keep_size = 50GB       # chặn slot bỏ rơi làm đầy đĩa",
      "",
      "# tạo standby từ primary (PG 12+: -R ghi sẵn primary_conninfo + standby.signal)",
      "pg_basebackup -h primary -U replicator -D /var/lib/postgresql/17/main \\",
      "  -X stream -R --slot=standby1 -C",
      "",
      "# standby",
      "hot_standby = on",
      "hot_standby_feedback = off          # on: ít bị cancel query, đổi lại bloat trên primary"
    ]},
    { id: "lag", label: "② Theo dõi lag", lines: [
      "-- trên primary",
      "SELECT application_name, state, sync_state,",
      "       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_gap,",
      "       write_lag, flush_lag, replay_lag",
      "FROM pg_stat_replication;",
      "",
      "-- slot nào đang giữ WAL",
      "SELECT slot_name, slot_type, active,",
      "       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained",
      "FROM pg_replication_slots;"
    ]},
    { id: "logical", label: "③ Logical", lines: [
      "-- nguồn (wal_level = logical, cần restart)",
      "CREATE PUBLICATION orders_pub FOR TABLE orders, order_items;",
      "",
      "-- đích (DB PostgreSQL khác, có sẵn bảng cùng cấu trúc)",
      "CREATE SUBSCRIPTION orders_sub",
      "  CONNECTION 'host=src dbname=orders user=repl password=...'",
      "  PUBLICATION orders_pub;          -- tự copy dữ liệu ban đầu rồi stream tiếp",
      "",
      "-- bảng không có PK: UPDATE/DELETE bị từ chối trên nguồn nếu không đặt identity",
      "ALTER TABLE audit_log REPLICA IDENTITY FULL;"
    ]},
    { id: "cdc", label: "④ CDC → Kafka → ClickHouse", lines: [
      "# Debezium PostgreSQL connector (Kafka Connect) — rút gọn",
      "connector.class      = io.debezium.connector.postgresql.PostgresConnector",
      "plugin.name          = pgoutput",
      "slot.name            = debezium_orders",
      "publication.name     = dbz_orders_pub",
      "table.include.list   = public.orders,public.outbox",
      "topic.prefix         = pg.orders",
      "",
      "# luồng: PostgreSQL WAL → logical slot → Debezium → topic pg.orders.public.orders",
      "#        → ClickHouse (Kafka engine / connector) → bảng phân tích",
      "# ⚠️ Debezium dừng = slot không tiến = WAL tích tụ trên primary"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pri"><div class="nl">🐘 Primary</div><div class="ns">sinh WAL</div></div>
    <div class="arrow" id="a1">↓ walsender (qua replication slot)</div>
    <div class="row">
      <div class="node" id="stb"><div class="nl">🪞 Standby (physical)</div><div class="ns">replay byte WAL · chỉ đọc</div></div>
      <div class="node" id="sub"><div class="nl">📥 Subscriber (logical)</div><div class="ns">nhận thay đổi mức row</div></div>
      <div class="node" id="dbz"><div class="nl">🔌 Debezium</div><div class="ns">pgoutput → Kafka → ClickHouse</div></div>
    </div>
    <div class="arrow" id="a2">↓ consumer chết?</div>
    <div class="node" id="disk"><div class="nl">💥 WAL tích tụ</div><div class="ns">đầy đĩa primary nếu không có max_slot_wal_keep_size</div></div>
  `,
  steps: [
    { title: "1 · Dựng standby", tab: "phys", highlight: [2, 3, 7, 8], on: ["pri", "a1", "stb"],
      desc: "pg_basebackup sao chép cluster, -R ghi sẵn cấu hình nối về primary, --slot + -C tạo slot để primary giữ WAL cho standby." },
    { title: "2 · Đọc trên standby", tab: "phys", highlight: [11, 12], on: ["stb"],
      desc: "Replica đọc được nhưng dữ liệu có độ trễ; query dài có thể bị huỷ do xung đột với replay." },
    { title: "3 · Đo lag", tab: "lag", highlight: [3, 4, 9], on: ["stb", "sub", "dbz"],
      desc: "replay_gap tính bằng byte WAL; write/flush/replay_lag tính bằng thời gian. 'retained' cho thấy slot nào đang ôm WAL." },
    { title: "4 · Logical replication", tab: "logical", highlight: [2, 5, 7, 10], on: ["sub"],
      desc: "Chọn bảng, bên nhận ghi được, khác version được. Không replicate DDL. Bảng không PK cần REPLICA IDENTITY." },
    { title: "5 · CDC sang Kafka", tab: "cdc", highlight: [3, 4, 6, 9, 10], on: ["dbz"],
      desc: "Debezium đọc logical slot bằng pgoutput, đẩy mỗi thay đổi thành message. Kết hợp outbox (bài 15) để phát sự kiện nghiệp vụ sạch." },
    { title: "6 · Slot bỏ rơi", tab: "cdc", highlight: [11], on: ["a2", "disk"],
      desc: "Consumer dừng → restart_lsn đứng yên → primary giữ WAL mãi. Đặt max_slot_wal_keep_size, alert, xoá slot không dùng." }
  ],

  quiz: [
    { q: "Streaming replication gửi gì sang standby?", options: [
        "Câu lệnh SQL", "Byte WAL nguyên bản", "Bản dump", "Thay đổi mức row đã giải mã"
      ], correct: 1, explanation: "Nên standby giống primary từng byte và phải cùng major version." },
    { q: "Logical replication KHÔNG tự động sao chép gì?", options: [
        "INSERT", "UPDATE", "DDL (ALTER TABLE, CREATE INDEX…)", "DELETE"
      ], correct: 2, explanation: "Phải chạy DDL ở cả hai phía theo thứ tự hợp lý." },
    { q: "Với replication async, primary chết đột ngột thì?", options: [
        "Không mất gì",
        "Có thể mất vài transaction cuối đã commit trên primary nhưng chưa tới standby",
        "Standby bị hỏng",
        "Toàn bộ dữ liệu mất"
      ], correct: 1, explanation: "Sync replication đổi độ trễ lấy RPO = 0." },
    { q: "synchronous_commit = remote_apply đảm bảo gì?", options: [
        "Standby đã nhận vào bộ nhớ OS",
        "Standby đã replay, nên đọc trên standby thấy ngay thay đổi",
        "Chỉ primary flush",
        "Không chờ gì"
      ], correct: 1, explanation: "Mạnh nhất, độ trễ commit cao nhất." },
    { q: "Rủi ro lớn nhất của replication slot?", options: [
        "Chậm query",
        "Consumer ngừng tiêu thụ → primary giữ WAL mãi → đầy đĩa",
        "Mất dữ liệu",
        "Deadlock"
      ], correct: 1, explanation: "max_slot_wal_keep_size giới hạn lượng WAL giữ lại." },
    { q: "'canceling statement due to conflict with recovery' trên standby là do?", options: [
        "Lỗi mạng",
        "Replay cần áp thay đổi (vd VACUUM xoá tuple) mà query dài trên standby còn cần",
        "Standby hết đĩa",
        "Sai mật khẩu"
      ], correct: 1, explanation: "Giảm bằng max_standby_streaming_delay hoặc hot_standby_feedback (đổi lấy bloat primary)." },
    { q: "Vì sao không route trang 'đơn hàng của tôi' ngay sau khi đặt sang replica async?", options: [
        "Replica không đọc được",
        "Replica có độ trễ nên user có thể chưa thấy đơn vừa đặt",
        "Replica chậm hơn",
        "Replica không có index"
      ], correct: 1, explanation: "Đọc-sau-ghi nên đi primary (hoặc chờ LSN)." },
    { q: "Debezium đọc thay đổi từ PostgreSQL bằng cơ chế nào?", options: [
        "Poll SELECT mỗi giây",
        "Logical decoding qua replication slot (plugin pgoutput)",
        "Trigger",
        "pg_dump định kỳ"
      ], correct: 1, explanation: "Cần wal_level = logical." },
    { q: "Replication có thay thế backup được không?", options: [
        "Có",
        "Không — lỗi người (DELETE nhầm) được replay sang replica ngay",
        "Có nếu dùng sync",
        "Có nếu có 3 replica"
      ], correct: 1, explanation: "Cần backup + WAL archive để PITR." },
    { q: "Bảng không có PK trong publication, chạy UPDATE trên nguồn thì?", options: [
        "Replicate bình thường",
        "Bị lỗi vì thiếu replica identity; cần PK hoặc REPLICA IDENTITY FULL/USING INDEX",
        "Tự tạo PK",
        "Bị bỏ qua lặng lẽ"
      ], correct: 1, explanation: "Bên nhận cần cách xác định row cũ." }
  ]
});
