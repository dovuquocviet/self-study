window.LESSONS.push({
  id: "15",
  phase: "6", phaseName: "Thực thi nhiều lệnh",
  title: "Pipelining và transaction: MULTI/EXEC, WATCH",
  subtitle: "Giảm RTT ≠ nguyên tử · MULTI không rollback · optimistic locking với WATCH",

  theory: `
    <p>Ba khái niệm hay bị trộn lẫn. Tách rõ:</p>
    <table>
      <tr><th></th><th>Giải quyết</th><th>Nguyên tử?</th></tr>
      <tr><td><strong>Pipelining</strong></td><td>Độ trễ mạng: gửi N lệnh liền, đọc N reply một lượt</td><td>Không — lệnh của client khác có thể chen giữa</td></tr>
      <tr><td><strong>MULTI/EXEC</strong></td><td>Chạy một nhóm lệnh liền mạch, không ai chen</td><td>Có (cô lập), nhưng <strong>không rollback</strong></td></tr>
      <tr><td><strong>WATCH</strong> + MULTI</td><td>Đọc – tính – ghi có điều kiện (check-and-set)</td><td>Có; EXEC huỷ nếu key bị đổi</td></tr>
    </table>

    <p><strong>Pipelining</strong>: 1 lệnh GET ~ 0,1 ms xử lý nhưng RTT trong cùng DC ~0,2–1 ms. 1000 GET tuần tự = 1000 RTT. Pipeline 1000 GET = ~1 RTT + thời gian xử lý.
    Server cũng đỡ tốn syscall (đọc nhiều lệnh trong một lần read). Giữ mỗi lô vừa phải (vài trăm – vài nghìn) để không phình buffer.
    Tương đương <code>JdbcTemplate.batchUpdate</code> — gom cho đỡ round-trip, không phải transaction.</p>

    <p><strong>MULTI/EXEC</strong></p>
    <ol>
      <li><code>MULTI</code>: các lệnh sau đó trả <code>QUEUED</code>, chưa chạy.</li>
      <li><code>EXEC</code>: chạy <em>toàn bộ</em> hàng đợi liên tục trên main thread, trả mảng kết quả.</li>
      <li>Lỗi <strong>lúc xếp hàng</strong> (sai cú pháp, sai số tham số) → EXEC trả <code>EXECABORT</code>, không lệnh nào chạy.</li>
      <li>Lỗi <strong>lúc chạy</strong> (vd <code>INCR</code> vào key đang là list → WRONGTYPE) → <em>chỉ lệnh đó lỗi, các lệnh khác vẫn chạy</em>. Không rollback.
        Lý do: những lỗi này là lỗi lập trình, phát hiện được khi dev; bỏ rollback giữ Redis đơn giản và nhanh.</li>
    </ol>
    <p>Khác <code>@Transactional</code> của Spring rất nhiều: không đọc được kết quả giữa chừng để quyết định lệnh tiếp theo (mọi lệnh chỉ trả QUEUED), không rollback.</p>

    <p><strong>WATCH — optimistic locking</strong>: <code>WATCH k</code> trước MULTI. Nếu từ lúc WATCH tới EXEC có ai sửa <code>k</code> (kể cả hết hạn), EXEC trả <em>nil</em> và không chạy gì;
    client đọc lại và thử lại. Giống <code>@Version</code> của JPA. Tranh chấp cao → thử lại nhiều → nên dùng Lua (bài 16).</p>

    <div class="callout"><p>💡 Trong Cluster, mọi key trong MULTI phải cùng slot (hash tag). Và EXEC trả OK <em>không</em> có nghĩa là đã bền: vẫn phụ thuộc AOF/fsync và replication async.
    Transaction của Redis là về <strong>cô lập</strong>, không phải về <strong>độ bền</strong>.</p></div>
  `,

  codeTabs: [
    { id: "pipe", label: "① Pipeline (Rust)", lines: [
      "// 1 round-trip thay vì 3",
      "let (name, visits, tags): (Option<String>, i64, Vec<String>) = redis::pipe()",
      "    .get(\"user:42:name\")",
      "    .incr(\"user:42:visits\", 1)",
      "    .smembers(\"user:42:tags\")",
      "    .query_async(&mut con).await?;",
      "",
      "// Client khác CÓ THỂ chen lệnh giữa GET và INCR trên server"
    ]},
    { id: "multi", label: "② MULTI/EXEC", lines: [
      "127.0.0.1:6379> MULTI",
      "OK",
      "127.0.0.1:6379(TX)> DECRBY stock:sku9 1",
      "QUEUED",
      "127.0.0.1:6379(TX)> RPUSH orders:pending order:881",
      "QUEUED",
      "127.0.0.1:6379(TX)> EXEC",
      "1) (integer) 4",
      "2) (integer) 17",
      "",
      "// Rust: redis::pipe().atomic() = bọc MULTI ... EXEC"
    ]},
    { id: "err", label: "③ Không rollback", lines: [
      "RPUSH mylist a",
      "MULTI",
      "SET greeting hello        # QUEUED",
      "INCR mylist               # QUEUED (chưa biết là sai kiểu)",
      "SET done 1                # QUEUED",
      "EXEC",
      "1) OK",
      "2) (error) WRONGTYPE Operation against a key holding the wrong kind of value",
      "3) OK                     # lệnh 1 và 3 VẪN được áp dụng",
      "",
      "MULTI",
      "SET a                     # (error) ERR wrong number of arguments",
      "EXEC                      # (error) EXECABORT - không lệnh nào chạy"
    ]},
    { id: "watch", label: "④ WATCH check-and-set", lines: [
      "// Chuyển điểm thưởng: chỉ trừ nếu đủ số dư",
      "loop {",
      "    redis::cmd(\"WATCH\").arg(\"points:alice\").query_async::<()>(&mut con).await?;",
      "    let bal: i64 = con.get(\"points:alice\").await.unwrap_or(0);",
      "    if bal < 100 {",
      "        redis::cmd(\"UNWATCH\").query_async::<()>(&mut con).await?;",
      "        return Err(Insufficient);",
      "    }",
      "    let res: Option<(i64, i64)> = redis::pipe().atomic()",
      "        .decr(\"points:alice\", 100).incr(\"points:bob\", 100)",
      "        .query_async(&mut con).await?;",
      "    if res.is_some() { break; }   // None = key bị sửa sau WATCH -> thử lại",
      "}",
      "// Cần connection riêng (không multiplexed) để WATCH gắn đúng phiên"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="p"><div class="nl">🚀 Pipeline</div><div class="ns">N lệnh / 1 RTT · không cô lập</div></div>
      <div class="node" id="m"><div class="nl">📦 MULTI … EXEC</div><div class="ns">cô lập · không rollback</div></div>
      <div class="node" id="w"><div class="nl">👀 WATCH</div><div class="ns">EXEC → nil nếu key đổi</div></div>
    </div>
    <div class="arrow" id="a1">↓ trên main thread</div>
    <div class="node" id="q"><div class="nl">📋 Hàng đợi QUEUED</div><div class="ns">lỗi cú pháp → EXECABORT</div></div>
    <div class="arrow" id="a2">↓ EXEC</div>
    <div class="node" id="x"><div class="nl">⚙️ Chạy liền một mạch</div><div class="ns">lỗi runtime chỉ ảnh hưởng lệnh đó</div></div>
  `,
  steps: [
    { title: "1 · Pipeline chỉ gom round-trip", tab: "pipe", highlight: [2, 3, 4, 5, 6, 8], on: ["p"],
      desc: "3 lệnh đi chung một lần gửi. Rất nhanh, nhưng client khác vẫn có thể chen giữa." },
    { title: "2 · MULTI xếp hàng", tab: "multi", highlight: [1, 3, 4, 5, 6], on: ["m", "a1", "q"],
      desc: "Mỗi lệnh chỉ trả QUEUED. Không thể dùng kết quả của lệnh trước để quyết định lệnh sau." },
    { title: "3 · EXEC chạy liền mạch", tab: "multi", highlight: [7, 8, 9, 11], on: ["a2", "x"],
      desc: "Không lệnh của client nào chen vào giữa DECRBY và RPUSH." },
    { title: "4 · Lỗi runtime không rollback", tab: "err", highlight: [4, 8, 9], on: ["x"],
      desc: "INCR vào list lỗi, nhưng SET greeting và SET done vẫn được áp dụng." },
    { title: "5 · Lỗi xếp hàng huỷ cả khối", tab: "err", highlight: [12, 13], on: ["q"],
      desc: "Sai cú pháp phát hiện ngay lúc queue → EXECABORT." },
    { title: "6 · WATCH cho check-and-set", tab: "watch", highlight: [3, 4, 9, 12], on: ["w"],
      desc: "Đọc số dư, quyết định, rồi ghi có điều kiện. Ai sửa key giữa chừng → EXEC trả nil → thử lại." }
  ],

  quiz: [
    { q: "Pipeline có đảm bảo các lệnh chạy liền nhau không bị chen không?", options: [
        "Có", "Không — pipeline chỉ giảm round-trip", "Có trong Cluster", "Chỉ khi ít hơn 100 lệnh"
      ], correct: 1, explanation: "Muốn cô lập dùng MULTI/EXEC hoặc Lua." },
    { q: "Trong MULTI, INCR trên key đang là list. Sau EXEC?", options: [
        "Toàn bộ transaction rollback", "Chỉ lệnh INCR lỗi, các lệnh khác vẫn được áp dụng", "EXECABORT", "Redis crash"
      ], correct: 1, explanation: "Redis không có rollback." },
    { q: "Khi nào EXEC trả EXECABORT?", options: [
        "Lỗi WRONGTYPE lúc chạy", "Có lỗi lúc xếp hàng (sai cú pháp/số tham số)", "Key bị WATCH thay đổi", "Hết RAM"
      ], correct: 1, explanation: "WATCH bị phá thì EXEC trả nil, không phải EXECABORT." },
    { q: "WATCH k, rồi client khác SET k, rồi MULTI ... EXEC. Kết quả?", options: [
        "EXEC chạy bình thường", "EXEC trả nil, không lệnh nào chạy", "EXECABORT", "Chờ tới khi k ổn định"
      ], correct: 1, explanation: "Optimistic locking: thử lại từ đầu." },
    { q: "Trong MULTI, có thể GET x rồi dùng giá trị đó để quyết định lệnh tiếp theo không?", options: [
        "Có", "Không — mọi lệnh chỉ trả QUEUED tới khi EXEC", "Có nếu dùng WATCH", "Có với RESP3"
      ], correct: 1, explanation: "Cần đọc trước khi MULTI (kèm WATCH) hoặc dùng Lua." },
    { q: "WATCH tương đương khái niệm nào trong JPA?", options: [
        "@Transactional(isolation=SERIALIZABLE)", "Optimistic locking với @Version", "SELECT ... FOR UPDATE", "@Lock(PESSIMISTIC_WRITE)"
      ], correct: 1, explanation: "Không khoá; phát hiện xung đột lúc commit và thử lại." },
    { q: "Vì sao WATCH cần kết nối riêng, không dùng chung multiplexed connection?", options: [
        "Vì chậm", "WATCH/MULTI là trạng thái của phiên kết nối; lệnh của task khác chen vào cùng kết nối sẽ phá logic", "Vì RESP2", "Không cần"
      ], correct: 1, explanation: "Multiplexed connection trộn lệnh của nhiều task trên một socket." },
    { q: "1000 lệnh GET, RTT 0,5 ms. Tuần tự vs pipeline, thời gian mạng khoảng?", options: [
        "Như nhau", "~500 ms vs ~0,5 ms (+ thời gian xử lý)", "~50 ms vs 5 ms", "Pipeline chậm hơn"
      ], correct: 1, explanation: "Pipeline gom 1000 RTT còn khoảng 1." },
    { q: "EXEC trả kết quả thành công nghĩa là dữ liệu đã bền trên đĩa và replica?", options: [
        "Đúng", "Không — tuỳ AOF/fsync và replication vẫn async", "Đúng nếu dùng WATCH", "Đúng trong Cluster"
      ], correct: 1, explanation: "MULTI là về cô lập, không phải độ bền." }
  ]
});
