window.LESSONS.push({
  id: "13",
  phase: "4", phaseName: "Đồng thời: isolation & lock",
  title: "Isolation level trong PostgreSQL: RC, RR, Serializable (SSI)",
  subtitle: "Lost update · write skew · lỗi 40001 và vòng retry · khác gì @Transactional(isolation=...)",

  theory: `
    <p><code>@Transactional(isolation = Isolation.SERIALIZABLE)</code> trong Spring chỉ gửi <code>SET TRANSACTION ISOLATION LEVEL ...</code>. Hành vi thật do PostgreSQL quyết định — và nó khác MySQL/Oracle ở vài điểm quan trọng.</p>

    <table>
      <tr><th>Level</th><th>Snapshot</th><th>Khi đụng row người khác vừa sửa và commit</th><th>Chặn được</th></tr>
      <tr><td><strong>READ COMMITTED</strong> (mặc định)</td><td>Mỗi câu lệnh</td><td>Chờ họ xong, rồi <em>đánh giá lại</em> WHERE trên phiên bản mới nhất và làm tiếp</td><td>Dirty read</td></tr>
      <tr><td><strong>REPEATABLE READ</strong></td><td>Cả transaction</td><td>Lỗi <code>40001 could not serialize access due to concurrent update</code></td><td>+ non-repeatable read, phantom (ở PG)</td></tr>
      <tr><td><strong>SERIALIZABLE</strong></td><td>Cả transaction + theo dõi phụ thuộc đọc/ghi (SSI)</td><td>Như RR, và thêm lỗi 40001 khi phát hiện chu trình nguy hiểm</td><td>Mọi anomaly — kết quả như chạy tuần tự</td></tr>
    </table>
    <p><code>READ UNCOMMITTED</code> ở PostgreSQL chạy y như READ COMMITTED — MVCC không bao giờ cho đọc dữ liệu chưa commit.</p>

    <p><strong>Anomaly 1 — lost update</strong> (ở RC): app <code>SELECT balance</code> → tính trong Java/Rust → <code>UPDATE SET balance = :new</code>. Hai request song song ghi đè nhau. Cách chữa, từ đơn giản:</p>
    <ol>
      <li>Để DB tính nguyên tử: <code>UPDATE account SET balance = balance - 10 WHERE id = 1 AND balance &gt;= 10</code> — an toàn ở RC nhờ bước đánh giá lại.</li>
      <li>Khoá bi quan: <code>SELECT ... FOR UPDATE</code> (bài 14).</li>
      <li>Khoá lạc quan: cột <code>version</code> (như JPA <code>@Version</code>): <code>UPDATE ... WHERE id = $1 AND version = $2</code>, 0 row → retry.</li>
      <li>Chạy ở REPEATABLE READ: update đụng nhau sẽ lỗi 40001 thay vì âm thầm ghi đè.</li>
    </ol>

    <p><strong>Anomaly 2 — write skew</strong> (lọt qua cả RR): quy tắc "luôn còn ít nhất 1 bác sĩ trực". Hai bác sĩ cùng lúc xin nghỉ; mỗi transaction đếm thấy 2 người trực → cho phép → mỗi bên update row <em>của mình</em> (không đụng nhau) → còn 0 người. Chỉ SERIALIZABLE (hoặc khoá tường minh các row đã đọc) chặn được.</p>

    <p><strong>SSI hoạt động thế nào</strong>: ghi lại "ai đã đọc gì" (SIRead lock — không chặn ai) và phát hiện cấu trúc hai cạnh rw-conflict liên tiếp giữa các transaction đồng thời. Khi thấy, huỷ một bên với 40001. Chi phí: một ít CPU/bộ nhớ và <strong>bắt buộc có retry</strong>; có thể có false positive.</p>

    <div class="callout"><p>💡 Dùng RR/SERIALIZABLE mà không có vòng retry cho SQLSTATE <code>40001</code> (và <code>40P01</code> deadlock) là bug chờ nổ. Retry phải chạy lại <em>toàn bộ</em> transaction từ đầu (đọc lại dữ liệu), không chỉ câu lệnh lỗi. Và đừng đặt gọi API bên ngoài bên trong khối được retry.</p></div>
  `,

  codeTabs: [
    { id: "lost", label: "① Lost update", lines: [
      "# T1 (RC)                              # T2 (RC)",
      "SELECT balance FROM account WHERE id=1;  -- 100",
      "                                       SELECT balance FROM account WHERE id=1;  -- 100",
      "UPDATE account SET balance = 90 WHERE id=1;   -- app tính 100 - 10",
      "COMMIT;",
      "                                       UPDATE account SET balance = 80 WHERE id=1;  -- 100 - 20",
      "                                       COMMIT;   -- kết quả 80, mất lần trừ 10",
      "",
      "-- ✅ để DB tính, nguyên tử ở RC",
      "UPDATE account SET balance = balance - 10 WHERE id = 1 AND balance >= 10;"
    ]},
    { id: "rr", label: "② RR báo lỗi", lines: [
      "BEGIN ISOLATION LEVEL REPEATABLE READ;",
      "SELECT balance FROM account WHERE id = 1;       -- 100 (snapshot chụp ở đây)",
      "-- ... transaction khác UPDATE row 1 và COMMIT ...",
      "UPDATE account SET balance = balance - 10 WHERE id = 1;",
      "-- ERROR:  could not serialize access due to concurrent update",
      "-- SQLSTATE 40001 → ROLLBACK và chạy lại cả transaction",
      "ROLLBACK;"
    ]},
    { id: "skew", label: "③ Write skew", lines: [
      "-- quy tắc: luôn có >= 1 bác sĩ on_call trong ca 7",
      "# T1: bác sĩ An                          # T2: bác sĩ Bình",
      "BEGIN ISOLATION LEVEL SERIALIZABLE;      BEGIN ISOLATION LEVEL SERIALIZABLE;",
      "SELECT count(*) FROM doctors             SELECT count(*) FROM doctors",
      " WHERE shift=7 AND on_call;  -- 2         WHERE shift=7 AND on_call;  -- 2",
      "UPDATE doctors SET on_call=false         UPDATE doctors SET on_call=false",
      " WHERE name='An';                         WHERE name='Bình';",
      "COMMIT;  -- OK                           COMMIT;",
      "                                         -- ERROR: could not serialize access due to",
      "                                         --   read/write dependencies among transactions",
      "# Ở REPEATABLE READ: cả hai commit được → 0 bác sĩ trực!"
    ]},
    { id: "retry", label: "④ Retry trong Rust", lines: [
      "async fn transfer(pool: &PgPool, from: i64, to: i64, amt: i64) -> anyhow::Result<()> {",
      "    for attempt in 1..=5 {",
      "        let res: Result<(), sqlx::Error> = async {",
      "            let mut tx = pool.begin().await?;",
      "            sqlx::query(\"SET TRANSACTION ISOLATION LEVEL SERIALIZABLE\").execute(&mut *tx).await?;",
      "            debit(&mut tx, from, amt).await?;",
      "            credit(&mut tx, to, amt).await?;",
      "            tx.commit().await",
      "        }.await;",
      "        match res {",
      "            Ok(()) => return Ok(()),",
      "            Err(sqlx::Error::Database(e)) if matches!(e.code().as_deref(), Some(\"40001\" | \"40P01\")) => {",
      "                tokio::time::sleep(backoff(attempt)).await;   // chạy lại TỪ ĐẦU",
      "            }",
      "            Err(e) => return Err(e.into()),",
      "        }",
      "    }",
      "    anyhow::bail!(\"transfer: hết lượt retry\")",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="rc"><div class="nl">READ COMMITTED</div><div class="ns">snapshot mỗi câu · re-check WHERE</div></div>
      <div class="node" id="rr"><div class="nl">REPEATABLE READ</div><div class="ns">snapshot cả tx · update đụng → 40001</div></div>
      <div class="node" id="sr"><div class="nl">SERIALIZABLE</div><div class="ns">+ SSI: chu trình rw → 40001</div></div>
    </div>
    <div class="arrow" id="a1">↓ anomaly lọt qua</div>
    <div class="row">
      <div class="node" id="lu"><div class="nl">💸 Lost update</div><div class="ns">lọt ở RC (đọc-tính-ghi trong app)</div></div>
      <div class="node" id="ws"><div class="nl">🩺 Write skew</div><div class="ns">lọt ở RC và RR</div></div>
    </div>
    <div class="arrow" id="a2">↓ cái giá</div>
    <div class="node" id="rt"><div class="nl">🔁 Vòng retry 40001 / 40P01</div><div class="ns">chạy lại cả transaction</div></div>
  `,
  steps: [
    { title: "1 · Lost update ở RC", tab: "lost", highlight: [2, 3, 4, 6, 7], on: ["rc", "lu"],
      desc: "Cả hai đọc 100, cả hai ghi giá trị do app tính → lần trừ 10 biến mất. Không có lỗi nào được báo." },
    { title: "2 · Để DB tính nguyên tử", tab: "lost", highlight: [10], on: ["rc"],
      desc: "<code>balance = balance - 10</code>: T2 chờ T1 commit, rồi đánh giá lại trên phiên bản mới (90) → 70. Điều kiện <code>balance &gt;= 10</code> được kiểm lại luôn." },
    { title: "3 · RR biến lỗi âm thầm thành lỗi rõ ràng", tab: "rr", highlight: [1, 2, 4, 5, 6], on: ["rr"],
      desc: "Snapshot cố định; phát hiện row đã bị sửa sau snapshot → 40001. Ứng dụng phải retry." },
    { title: "4 · Write skew", tab: "skew", highlight: [4, 5, 6, 7, 9, 10, 11], on: ["a1", "ws", "sr"],
      desc: "Hai bên sửa hai row khác nhau dựa trên cùng một điều kiện đã đọc. Chỉ SERIALIZABLE phát hiện được chu trình này." },
    { title: "5 · Vòng retry", tab: "retry", highlight: [2, 4, 5, 12, 13], on: ["a2", "rt"],
      desc: "Bắt SQLSTATE 40001/40P01, chờ backoff, chạy lại toàn bộ closure. Mọi thứ đọc trong transaction cũ đều phải đọc lại." }
  ],

  quiz: [
    { q: "Isolation level mặc định của PostgreSQL?", options: [
        "READ UNCOMMITTED", "READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"
      ], correct: 1, explanation: "Và READ UNCOMMITTED ở PG hoạt động như READ COMMITTED." },
    { q: "Ở READ COMMITTED, UPDATE gặp row vừa bị transaction khác sửa và commit sẽ?", options: [
        "Báo lỗi 40001",
        "Chờ transaction kia xong, rồi đánh giá lại WHERE trên phiên bản mới nhất và cập nhật nếu còn thoả",
        "Ghi đè bằng phiên bản cũ",
        "Bỏ qua row đó"
      ], correct: 1, explanation: "Nhờ vậy balance = balance - 10 an toàn ở RC." },
    { q: "Lost update xảy ra khi nào ở RC?", options: [
        "Khi dùng UPDATE SET x = x + 1",
        "Khi app đọc giá trị, tự tính, rồi ghi đè giá trị tuyệt đối mà không khoá/không kiểm version",
        "Khi dùng FOR UPDATE",
        "Không bao giờ"
      ], correct: 1, explanation: "Đọc-tính-ghi trong app là mẫu nguy hiểm." },
    { q: "Ở REPEATABLE READ, cập nhật row đã bị transaction khác sửa sau khi snapshot được chụp sẽ?", options: [
        "Thành công, ghi đè",
        "Lỗi 40001 could not serialize access due to concurrent update",
        "Chờ vô hạn",
        "Tự chuyển sang RC"
      ], correct: 1, explanation: "Ứng dụng phải retry toàn bộ transaction." },
    { q: "Write skew là gì?", options: [
        "Hai transaction ghi cùng một row",
        "Hai transaction đọc cùng dữ liệu, rồi mỗi bên ghi các row khác nhau dựa trên điều kiện đã đọc, cùng phá vỡ một ràng buộc",
        "Ghi lệch múi giờ",
        "Ghi vào sai bảng"
      ], correct: 1, explanation: "Lọt qua RR vì không có xung đột ghi-ghi trên cùng row." },
    { q: "SERIALIZABLE ở PostgreSQL được hiện thực bằng?", options: [
        "Khoá toàn bảng mỗi lần đọc",
        "Serializable Snapshot Isolation — theo dõi phụ thuộc đọc/ghi, huỷ một transaction khi thấy chu trình nguy hiểm",
        "Chạy từng transaction một",
        "Two-phase commit"
      ], correct: 1, explanation: "SIRead lock không chặn ai; chi phí là khả năng bị huỷ và phải retry." },
    { q: "Khi retry sau lỗi 40001, cần chạy lại gì?", options: [
        "Chỉ câu lệnh bị lỗi",
        "Toàn bộ transaction từ đầu, đọc lại mọi dữ liệu",
        "Chỉ COMMIT",
        "Không cần retry"
      ], correct: 1, explanation: "Dữ liệu đã đọc trong lần trước có thể đã lỗi thời." },
    { q: "SQLSTATE 40P01 là gì?", options: [
        "Unique violation", "Deadlock detected", "Serialization failure", "Syntax error"
      ], correct: 1, explanation: "40001 là serialization_failure; 40P01 là deadlock_detected; cả hai đều nên retry." },
    { q: "Cách nào KHÔNG chặn được lost update ở RC?", options: [
        "UPDATE SET balance = balance - 10",
        "SELECT ... FOR UPDATE trước khi tính",
        "Cột version + WHERE version = $2",
        "Đọc bằng SELECT thường rồi UPDATE SET balance = giá trị app tính"
      ], correct: 3, explanation: "Đó chính là mẫu gây lost update." }
  ]
});
