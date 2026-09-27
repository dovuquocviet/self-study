window.LESSONS.push({
  id: "11",
  phase: "4", phaseName: "Replication & HA",
  title: "Replication: PSYNC, backlog và vì sao có thể mất ghi",
  subtitle: "Full sync vs partial sync · replication ID + offset · async · WAIT · min-replicas-to-write",

  theory: `
    <p>Một master, nhiều replica. Replica <strong>chỉ đọc</strong> (mặc định <code>replica-read-only yes</code>) và nhận <em>luồng lệnh ghi</em> từ master — chính là các lệnh sẽ vào AOF.</p>

    <p><strong>Định danh vị trí</strong>: mỗi master có <code>replid</code> (chuỗi ngẫu nhiên 40 ký tự đại diện cho "một lịch sử dữ liệu") và <code>master_repl_offset</code>
    (số byte luồng replication đã phát). Cặp (replid, offset) giống LSN của PostgreSQL: nói chính xác replica đang ở đâu.</p>

    <p><strong>Đồng bộ khi replica kết nối</strong> — replica gửi <code>PSYNC &lt;replid&gt; &lt;offset&gt;</code>:</p>
    <ul>
      <li><strong>Partial resync</strong> (<code>+CONTINUE</code>): replid khớp và phần thiếu vẫn còn trong <strong>replication backlog</strong> — bộ đệm vòng trên master
        (<code>repl-backlog-size</code>, mặc định 1 MB). Master chỉ gửi phần chênh lệch. Rẻ.</li>
      <li><strong>Full resync</strong> (<code>+FULLRESYNC &lt;replid&gt; &lt;offset&gt;</code>): replica mới, replid khác, hoặc rớt mạng lâu đến mức backlog đã ghi đè.
        Master BGSAVE (fork!) và gửi RDB — mặc định từ 7.0 là <em>diskless</em> (ghi thẳng vào socket), trong lúc đó các lệnh mới được đệm trong output buffer của replica; replica xoá sạch dữ liệu cũ, nạp RDB, rồi nhận phần đệm.</li>
    </ul>
    <p>Backlog quá nhỏ → mỗi lần mạng chập chờn vài giây là full resync → fork + truyền cả dataset → có thể thành vòng lặp nếu output buffer vượt
    <code>client-output-buffer-limit replica</code> (mặc định 256mb/64mb trong 60s) và bị ngắt. Đặt backlog ≈ tốc độ ghi × thời gian rớt mạng chấp nhận (vd 10 MB/s × 60 s = 600 MB).</p>

    <p><strong>Replication là bất đồng bộ</strong>: master trả <code>OK</code> cho client <em>trước</em> khi replica nhận được. Master chết ngay sau đó và replica được thăng cấp
    → lệnh đã xác nhận <strong>biến mất</strong>. Công cụ giảm thiểu:</p>
    <ul>
      <li><code>WAIT numreplicas timeout</code>: chặn client tới khi N replica xác nhận offset. Tăng độ bền nhưng <em>không</em> biến Redis thành hệ nhất quán mạnh (failover vẫn có thể chọn replica chưa có ghi).</li>
      <li><code>min-replicas-to-write 1</code> + <code>min-replicas-max-lag 10</code>: master từ chối ghi khi không có đủ replica "tươi" — giới hạn cửa sổ mất dữ liệu khi master bị cô lập mạng.</li>
    </ul>

    <p>Khi replica được thăng cấp, nó tạo <code>replid</code> mới và nhớ replid cũ (<code>master_replid2</code>) + offset, để các replica khác vẫn partial sync được với nó.</p>

    <div class="callout"><p>💡 Đọc từ replica = chấp nhận dữ liệu cũ (thường vài ms, có lúc vài giây). Pattern "ghi xong đọc lại ngay" (read-your-writes) phải đọc master.
    Và <strong>master tắt persistence + tự khởi động lại</strong> là thảm hoạ: nó lên với dataset rỗng, replica đồng bộ theo và xoá sạch dữ liệu của chính mình.</p></div>
  `,

  codeTabs: [
    { id: "hs", label: "① Bắt tay PSYNC", lines: [
      "replica -> master: PING",
      "replica -> master: AUTH <user> <pass>",
      "replica -> master: REPLCONF listening-port 6380",
      "replica -> master: REPLCONF capa eof capa psync2",
      "replica -> master: PSYNC 8de1787ba490483314a4d30f1c628bc5025eb761 1048320",
      "",
      "master: backlog có từ offset 1048320?",
      "  có  -> +CONTINUE                              (partial: gửi phần thiếu)",
      "  không -> +FULLRESYNC <replid> <offset>        (gửi RDB rồi luồng lệnh)"
    ]},
    { id: "conf", label: "② Cấu hình", lines: [
      "# trên replica",
      "replicaof 10.0.0.1 6379",
      "masteruser repl",
      "masterauth s3cret",
      "replica-read-only yes",
      "",
      "# trên master",
      "repl-backlog-size 512mb          # mặc định 1mb - quá nhỏ cho production",
      "repl-diskless-sync yes           # mặc định 7.0+",
      "client-output-buffer-limit replica 1gb 256mb 60",
      "min-replicas-to-write 1",
      "min-replicas-max-lag 10"
    ]},
    { id: "info", label: "③ INFO replication", lines: [
      "role:master",
      "connected_slaves:2",
      "slave0:ip=10.0.0.2,port=6379,state=online,offset=90211342,lag=0",
      "slave1:ip=10.0.0.3,port=6379,state=online,offset=90208110,lag=1",
      "master_replid:8de1787ba490483314a4d30f1c628bc5025eb761",
      "master_replid2:0000000000000000000000000000000000000000",
      "master_repl_offset:90211342",
      "repl_backlog_size:536870912",
      "",
      "# replica1 chậm 90211342 - 90208110 = 3232 byte"
    ]},
    { id: "wait", label: "④ WAIT trong Rust", lines: [
      "// Ghi đơn hàng rồi chờ >= 1 replica xác nhận, tối đa 100ms",
      "let _: () = con.set(\"order:991:status\", \"PAID\").await?;",
      "let acked: i64 = redis::cmd(\"WAIT\").arg(1).arg(100)",
      "    .query_async(&mut con).await?;",
      "if acked < 1 {",
      "    // chưa chắc đã an toàn: log/cảnh báo hoặc ghi thêm vào DB chính",
      "}",
      "// WAIT giảm rủi ro, KHÔNG biến Redis thành CP như Postgres synchronous_commit"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m"><div class="nl">👑 Master</div><div class="ns">replid + offset · backlog vòng</div></div>
    <div class="arrow" id="a1">↓ PSYNC replid offset</div>
    <div class="row">
      <div class="node" id="pr"><div class="nl">⚡ +CONTINUE</div><div class="ns">gửi phần thiếu từ backlog</div></div>
      <div class="node" id="fr"><div class="nl">🐘 +FULLRESYNC</div><div class="ns">fork + gửi RDB</div></div>
    </div>
    <div class="arrow" id="a2">↓ luồng lệnh ghi (async)</div>
    <div class="row">
      <div class="node" id="r1"><div class="nl">📖 Replica 1</div><div class="ns">lag 0</div></div>
      <div class="node" id="r2"><div class="nl">📖 Replica 2</div><div class="ns">lag 1s</div></div>
    </div>
    <div class="arrow" id="a3">↓ master chết trước khi gửi xong</div>
    <div class="node" id="loss"><div class="nl">💥 Ghi đã OK nhưng mất</div><div class="ns">WAIT / min-replicas giảm rủi ro</div></div>
  `,
  steps: [
    { title: "1 · Replica bắt tay", tab: "hs", highlight: [1, 2, 3, 4, 5], on: ["m", "a1"],
      desc: "Replica gửi replid và offset nó đang có — 'tôi đã có lịch sử X tới byte Y'." },
    { title: "2 · Partial nếu backlog còn", tab: "hs", highlight: [7, 8], on: ["pr"],
      desc: "Rớt mạng ngắn, backlog đủ lớn → chỉ gửi vài KB/MB còn thiếu." },
    { title: "3 · Không thì full resync", tab: "hs", highlight: [9], on: ["fr"],
      desc: "Fork, gửi RDB (diskless), replica xoá dữ liệu cũ và nạp lại. Tốn CPU, RAM, mạng." },
    { title: "4 · Chỉnh backlog và buffer", tab: "conf", highlight: [8, 9, 10], on: ["m"],
      desc: "Backlog 1 MB mặc định thường quá nhỏ. Output buffer quá nhỏ làm full sync bị ngắt giữa chừng và lặp lại." },
    { title: "5 · Theo dõi lag", tab: "info", highlight: [3, 4, 5, 7, 10], on: ["a2", "r1", "r2"],
      desc: "So offset của từng replica với master_repl_offset để biết chậm bao nhiêu byte." },
    { title: "6 · Async = có thể mất", tab: "wait", highlight: [2, 3, 5, 8], on: ["a3", "loss"],
      desc: "Master trả OK trước khi replica có dữ liệu. WAIT buộc chờ ack nhưng failover vẫn có thể chọn replica thiếu." }
  ],

  quiz: [
    { q: "Replication mặc định của Redis là đồng bộ hay bất đồng bộ?", options: [
        "Đồng bộ", "Bất đồng bộ — master trả OK trước khi replica nhận", "Bán đồng bộ bắt buộc", "Tuỳ lệnh"
      ], correct: 1, explanation: "Đây là lý do có thể mất ghi khi failover." },
    { q: "Cặp giá trị nào xác định vị trí replication?", options: [
        "run_id và uptime", "replid và offset", "slot và epoch", "hz và backlog"
      ], correct: 1, explanation: "replid: lịch sử nào; offset: tới byte nào." },
    { q: "Khi nào master trả +CONTINUE?", options: [
        "Replica mới hoàn toàn", "replid khớp và dữ liệu thiếu vẫn còn trong replication backlog", "Luôn luôn", "Khi bật diskless"
      ], correct: 1, explanation: "Đó là partial resync." },
    { q: "Hậu quả của repl-backlog-size quá nhỏ?", options: [
        "Không ảnh hưởng", "Rớt mạng ngắn cũng phải full resync (fork + gửi cả dataset)", "Replica không đọc được", "Master từ chối ghi"
      ], correct: 1, explanation: "Backlog bị ghi đè trước khi replica quay lại." },
    { q: "WAIT 1 100 trả về 1. Có đảm bảo tuyệt đối ghi không mất khi failover?", options: [
        "Có", "Không — giảm rủi ro nhưng failover vẫn có thể thăng cấp replica chưa có ghi", "Có nếu bật AOF", "Có nếu dùng Cluster"
      ], correct: 1, explanation: "Redis không phải hệ nhất quán mạnh." },
    { q: "min-replicas-to-write 1 + min-replicas-max-lag 10 làm gì?", options: [
        "Bắt buộc ghi đồng bộ", "Master từ chối ghi nếu không có ít nhất 1 replica có lag ≤ 10s", "Giới hạn 10 replica", "Chuyển master sau 10s"
      ], correct: 1, explanation: "Giới hạn cửa sổ ghi mất khi master bị cô lập." },
    { q: "Master không bật persistence, crash và tự khởi động lại ngay. Điều gì xảy ra?", options: [
        "Replica thăng cấp", "Master lên với dữ liệu rỗng, replica đồng bộ theo và mất sạch dữ liệu", "Master nạp từ replica", "Không sao"
      ], correct: 1, explanation: "Tắt auto-restart hoặc bật persistence trên master." },
    { q: "Ứng dụng ghi rồi đọc lại ngay để hiển thị. Nên đọc từ đâu?", options: [
        "Replica bất kỳ", "Master (hoặc chấp nhận có thể thấy dữ liệu cũ)", "Sentinel", "File RDB"
      ], correct: 1, explanation: "Replica có độ trễ nên không đảm bảo read-your-writes." },
    { q: "Full resync mặc định ở Redis 7.x gửi RDB thế nào?", options: [
        "Ghi ra đĩa rồi gửi file", "Diskless: ghi thẳng vào socket", "Gửi từng key bằng lệnh SET", "Qua Sentinel"
      ], correct: 1, explanation: "repl-diskless-sync yes là mặc định từ 7.0." }
  ]
});
