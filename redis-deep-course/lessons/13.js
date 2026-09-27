window.LESSONS.push({
  id: "13",
  phase: "5", phaseName: "Redis Cluster",
  title: "Redis Cluster: 16384 hash slot, gossip và failover",
  subtitle: "CRC16(key) mod 16384 · mỗi master giữ một dải slot · cluster bus · không cần Sentinel",

  theory: `
    <p>Khi một instance không đủ (RAM, CPU một luồng, băng thông mạng), ta <strong>chia dữ liệu</strong> ra nhiều master. Redis Cluster làm việc đó
    mà không cần proxy ở giữa: client nói chuyện thẳng với node giữ dữ liệu.</p>

    <p><strong>Hash slot</strong></p>
    <ul>
      <li>Không gian key chia thành <strong>16384 slot</strong>. <code>slot = CRC16(key) mod 16384</code>.</li>
      <li>Mỗi master chịu trách nhiệm một tập slot, vd 3 master: 0–5460, 5461–10922, 10923–16383.</li>
      <li>Thêm/bớt node = <strong>chuyển slot</strong> (kèm key trong slot) giữa các node, không phải băm lại toàn bộ như <code>hash % N</code>.</li>
      <li>Vì sao 16384? Mỗi gói heartbeat mang bitmap slot của node gửi: 16384 bit = 2 KB — đủ nhỏ. Và tác giả khuyến nghị cluster không quá ~1000 master nên 16384 slot là đủ mịn.</li>
    </ul>

    <p><strong>Cluster bus</strong>: mỗi node mở thêm một cổng (mặc định <em>cổng dữ liệu + 10000</em>, vd 16379) nói giao thức nhị phân riêng.
    Các node <strong>gossip</strong> với nhau (PING/PONG kèm thông tin về vài node khác) để biết ai sống, ai giữ slot nào, và phiên bản cấu hình (<code>configEpoch</code>).</p>

    <p><strong>Failover tích hợp</strong> (không cần Sentinel):</p>
    <ol>
      <li>Node A không nhận PONG từ master M quá <code>cluster-node-timeout</code> → đánh dấu <strong>PFAIL</strong>.</li>
      <li>Qua gossip, khi <em>đa số master</em> báo PFAIL về M → <strong>FAIL</strong>, lan truyền toàn cluster.</li>
      <li>Replica của M xin phiếu các master; replica có offset lớn hơn xin sớm hơn (độ trễ theo thứ hạng). Được đa số master đồng ý → thăng cấp, tăng <code>configEpoch</code>, nhận các slot của M.</li>
    </ol>

    <p><strong>Giới hạn cần nhớ</strong></p>
    <ul>
      <li>Chỉ có <strong>database 0</strong> (<code>SELECT 1</code> lỗi).</li>
      <li>Lệnh nhiều key (<code>MGET</code>, <code>SUNION</code>, <code>MULTI</code>, script Lua) chỉ chạy khi mọi key cùng slot — bài 14.</li>
      <li>Replication vẫn async → vẫn có thể mất ghi khi failover; phía thiểu số bị cô lập sẽ ngừng nhận ghi sau <code>cluster-node-timeout</code>.</li>
      <li><code>cluster-require-full-coverage yes</code> (mặc định): có slot không ai phục vụ → cả cluster từ chối truy vấn. Đặt <code>no</code> để phần còn lại vẫn chạy.</li>
    </ul>

    <div class="callout"><p>💡 Tối thiểu cho production: 3 master + mỗi master ≥ 1 replica, trải trên các zone. Thêm master là tăng cả RAM lẫn CPU ghi — mỗi master là một main thread riêng.
    Với AWS ElastiCache/MemoryDB hay Redis Cloud, "cluster mode enabled" chính là mô hình này.</p></div>
  `,

  codeTabs: [
    { id: "slot", label: "① Tính slot", lines: [
      "127.0.0.1:7000> CLUSTER KEYSLOT user:1001",
      "(integer) 5712",
      "127.0.0.1:7000> CLUSTER KEYSLOT user:1002",
      "(integer) 9779           # key 'gần nhau' vẫn rơi slot xa nhau",
      "127.0.0.1:7000> CLUSTER KEYSLOT foo",
      "(integer) 12182",
      "",
      "# CRC16 biến thể XMODEM (đa thức 0x1021), lấy mod 16384 (= & 0x3FFF)"
    ]},
    { id: "nodes", label: "② CLUSTER SHARDS", lines: [
      "$ redis-cli -c -p 7000 CLUSTER NODES",
      "a1.. 10.0.0.1:7000@17000 myself,master - 0 0 1 connected 0-5460",
      "b2.. 10.0.0.2:7000@17000 master - 0 1727400000000 2 connected 5461-10922",
      "c3.. 10.0.0.3:7000@17000 master - 0 1727400000000 3 connected 10923-16383",
      "d4.. 10.0.0.4:7000@17000 slave a1.. 0 1727400000000 1 connected",
      "",
      "# 7.0+: CLUSTER SHARDS trả cấu trúc dễ đọc cho client",
      "# @17000 = cổng cluster bus"
    ]},
    { id: "create", label: "③ Dựng cluster", lines: [
      "# redis.conf mỗi node",
      "cluster-enabled yes",
      "cluster-config-file nodes-7000.conf    # Redis tự ghi, đừng sửa tay",
      "cluster-node-timeout 15000",
      "cluster-require-full-coverage no",
      "",
      "$ redis-cli --cluster create 10.0.0.1:7000 10.0.0.2:7000 10.0.0.3:7000 \\",
      "    10.0.0.4:7000 10.0.0.5:7000 10.0.0.6:7000 --cluster-replicas 1",
      "$ redis-cli --cluster add-node 10.0.0.7:7000 10.0.0.1:7000",
      "$ redis-cli --cluster rebalance 10.0.0.1:7000"
    ]},
    { id: "fo", label: "④ Failover", lines: [
      "t=0      master B ngừng trả PONG",
      "t=15s    các node đánh dấu B PFAIL (cluster-node-timeout)",
      "         gossip: đa số master báo PFAIL -> B FAIL (broadcast)",
      "t=15s+   replica B' chờ 500ms + random + rank*1000ms (rank theo offset)",
      "         B' -> FAILOVER_AUTH_REQUEST tới mọi master",
      "         đa số master ACK -> B' thăng cấp, configEpoch++",
      "         B' nhận slot 5461-10922, gossip cấu hình mới"
    ]}
  ],

  stageHtml: `
    <div class="node" id="k"><div class="nl">🔑 user:1001</div><div class="ns">CRC16 mod 16384 = 5712</div></div>
    <div class="arrow" id="a1">↓ slot 5712 thuộc dải 5461–10922 → Master B</div>
    <div class="row">
      <div class="node" id="a"><div class="nl">🟥 Master A</div><div class="ns">0–5460</div></div>
      <div class="node" id="b"><div class="nl">🟥 Master B</div><div class="ns">5461–10922</div></div>
      <div class="node" id="c"><div class="nl">🟥 Master C</div><div class="ns">10923–16383</div></div>
    </div>
    <div class="arrow" id="a2">↕ cluster bus :16379 — gossip PING/PONG</div>
    <div class="row">
      <div class="node" id="ra"><div class="nl">📖 A'</div><div class="ns">replica A</div></div>
      <div class="node" id="rb"><div class="nl">📖 B' → master</div><div class="ns">khi B FAIL</div></div>
      <div class="node" id="rc"><div class="nl">📖 C'</div><div class="ns">replica C</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Key → slot", tab: "slot", highlight: [1, 2, 3, 4], on: ["k"],
      desc: "CRC16 trộn đều: user:1001 → 5712, user:1002 → 9779: hai slot xa nhau. Với 3 master chia đều, cả hai tình cờ cùng thuộc B; thêm node là có thể tách ra." },
    { title: "2 · Slot → node", tab: "nodes", highlight: [2, 3, 4], on: ["a1", "b"],
      desc: "Mỗi master giữ một dải slot. Client cache bảng slot → node này." },
    { title: "3 · Dựng và mở rộng", tab: "create", highlight: [2, 7, 8, 9, 10], on: ["a", "b", "c", "ra", "rb", "rc"],
      desc: "Thêm node rồi rebalance = dời một phần slot sang node mới. Không băm lại toàn bộ." },
    { title: "4 · Gossip", tab: "nodes", highlight: [5, 8], on: ["a2"],
      desc: "Cổng +10000 chuyên cho node nói với node: trạng thái sống/chết, bitmap slot, epoch." },
    { title: "5 · PFAIL → FAIL", tab: "fo", highlight: [1, 2, 3], on: ["b"],
      desc: "Một node nghi ngờ chưa đủ; cần đa số master đồng ý qua gossip." },
    { title: "6 · Replica tự thăng cấp", tab: "fo", highlight: [4, 5, 6, 7], on: ["rb"],
      desc: "Replica nhiều dữ liệu nhất xin phiếu trước; được đa số master đồng ý thì nhận slot và tăng configEpoch." }
  ],

  quiz: [
    { q: "Redis Cluster có bao nhiêu hash slot?", options: [
        "1024", "16384", "65536", "Bằng số node"
      ], correct: 1, explanation: "slot = CRC16(key) mod 16384." },
    { q: "Vì sao dùng slot thay vì hash(key) % số_node?", options: [
        "Nhanh hơn khi tính", "Thêm/bớt node chỉ cần dời một phần slot, không phải băm lại toàn bộ key", "Để hỗ trợ SELECT", "Để không cần replica"
      ], correct: 1, explanation: "% N thay đổi khi N đổi → gần như mọi key đổi chỗ." },
    { q: "Cổng cluster bus mặc định của node chạy ở 7000?", options: [
        "7001", "17000", "26379", "7000 dùng chung"
      ], correct: 1, explanation: "Cổng dữ liệu + 10000 (cấu hình được bằng cluster-port)." },
    { q: "Redis Cluster phát hiện master chết thế nào?", options: [
        "Cần Sentinel", "Node đánh dấu PFAIL; khi đa số master đồng ý qua gossip → FAIL", "Client báo", "Ping DNS"
      ], correct: 1, explanation: "Failover tích hợp sẵn trong Cluster." },
    { q: "Trong Cluster, SELECT 2 cho kết quả gì?", options: [
        "Chuyển sang db 2", "Lỗi — Cluster chỉ hỗ trợ database 0", "Chuyển sang slot 2", "Chuyển sang node 2"
      ], correct: 1, explanation: "Muốn tách namespace thì dùng prefix key." },
    { q: "cluster-require-full-coverage yes và một dải slot mất cả master lẫn replica. Hệ quả?", options: [
        "Chỉ slot đó lỗi", "Toàn bộ cluster ngừng nhận truy vấn", "Slot tự chuyển sang node khác kèm dữ liệu", "Không ảnh hưởng"
      ], correct: 1, explanation: "Đặt no để các slot còn phục vụ vẫn chạy." },
    { q: "Một lý do chọn con số 16384?", options: [
        "Là số nguyên tố", "Bitmap slot trong heartbeat chỉ 2 KB; đủ mịn cho cụm tới ~1000 master", "Giới hạn của CRC16", "Bằng số database"
      ], correct: 1, explanation: "65536 slot sẽ làm heartbeat 8 KB." },
    { q: "Khi nhiều replica cùng muốn thăng cấp, replica nào thường xin phiếu trước?", options: [
        "Ngẫu nhiên hoàn toàn", "Replica có offset replication lớn nhất (rank tốt nhất)", "Replica có ID nhỏ nhất", "Replica khởi động sớm nhất"
      ], correct: 1, explanation: "Độ trễ xin phiếu tỉ lệ rank theo offset." },
    { q: "Thêm master vào Cluster tăng khả năng gì mà Sentinel không cho?", options: [
        "Không gì", "Mở rộng cả RAM lẫn throughput ghi (mỗi master một main thread)", "Nhất quán mạnh", "Hỗ trợ nhiều database"
      ], correct: 1, explanation: "Sentinel chỉ có một master." }
  ]
});
