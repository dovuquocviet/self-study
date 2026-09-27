window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Transaction, đồng thời & truy vấn",
  title: "Isolation level & anomaly — thứ gì có thể sai khi chạy song song",
  subtitle: "Dirty read · non-repeatable · phantom · lost update · write skew · Read Committed vs Repeatable Read vs Serializable",

  theory: `
    <p>Isolation hoàn hảo (serializable) = kết quả như thể các transaction chạy <em>lần lượt</em>. Nó đắt, nên DB cho chọn mức thấp hơn và chấp nhận vài <strong>anomaly</strong>.
    Hiểu anomaly là hiểu bug đồng thời mà test đơn luồng không bao giờ bắt được.</p>

    <p><strong>Các anomaly</strong></p>
    <ul>
      <li><strong>Dirty read</strong>: đọc dữ liệu transaction khác <em>chưa commit</em> (rồi nó rollback).</li>
      <li><strong>Non-repeatable read</strong>: đọc cùng dòng 2 lần trong một transaction, giá trị khác nhau.</li>
      <li><strong>Phantom</strong>: chạy cùng điều kiện WHERE 2 lần, tập dòng khác nhau (có dòng mới xuất hiện).</li>
      <li><strong>Lost update</strong>: hai bên cùng đọc qty=10, cùng tính 10−1, cùng ghi 9 → mất một lần trừ.</li>
      <li><strong>Write skew</strong>: hai bên đọc cùng tập dữ liệu, mỗi bên sửa một dòng <em>khác nhau</em> dựa trên điều kiện đã đọc → cả hai commit, ràng buộc chung bị vi phạm.</li>
    </ul>

    <table>
      <tr><th>Mức (PostgreSQL)</th><th>Dirty</th><th>Non-repeatable</th><th>Phantom</th><th>Lost update</th><th>Write skew</th></tr>
      <tr><td>Read Committed (mặc định)</td><td>Không</td><td>Có</td><td>Có</td><td>Có (với read-modify-write ở app)</td><td>Có</td></tr>
      <tr><td>Repeatable Read (= snapshot isolation)</td><td>Không</td><td>Không</td><td>Không</td><td>Không — báo lỗi serialize</td><td><strong>Có</strong></td></tr>
      <tr><td>Serializable (SSI)</td><td>Không</td><td>Không</td><td>Không</td><td>Không</td><td>Không — báo lỗi serialize</td></tr>
    </table>
    <p>PostgreSQL không có dirty read ở bất kỳ mức nào (Read Uncommitted chạy như Read Committed). MySQL InnoDB mặc định Repeatable Read nhưng cơ chế khác (dùng gap lock).
    Bảng chuẩn SQL chỉ nói "tối thiểu phải chặn gì", mỗi DB làm chặt hơn theo cách riêng — luôn đọc docs của DB bạn dùng.</p>

    <p><strong>Read Committed</strong>: mỗi <em>câu lệnh</em> lấy snapshot mới. <strong>Repeatable Read</strong>: snapshot lấy ở câu lệnh đầu tiên, dùng cho cả transaction;
    nếu định UPDATE một dòng mà transaction khác đã sửa và commit sau snapshot → lỗi <code>could not serialize access due to concurrent update</code>.
    <strong>Serializable</strong> (SSI) theo dõi phụ thuộc đọc-ghi giữa các transaction và huỷ một bên khi phát hiện vòng nguy hiểm.</p>

    <p><strong>Hệ quả cho code</strong>: ở Repeatable Read và Serializable, lỗi SQLSTATE <code>40001</code> là <em>chuyện bình thường</em> — ứng dụng phải retry cả transaction.
    Spring: bắt <code>CannotAcquireLockException</code>/<code>ConcurrencyFailureException</code> rồi thử lại (vd Spring Retry), và method phải idempotent.</p>

    <div class="callout"><p>💡 Phần lớn service chạy Read Committed và vẫn đúng, <em>nếu</em> tránh read-modify-write ở app: dùng UPDATE nguyên tử
    (<code>SET qty = qty - 1 WHERE qty &gt; 0</code>), <code>SELECT ... FOR UPDATE</code>, hoặc optimistic locking <code>@Version</code> (bài 11). Write skew thì cần Serializable
    hoặc khoá tường minh / ràng buộc trong DB.</p></div>
  `,

  codeTabs: [
    { id: "lost", label: "Lost update", lines: [
      "-- A (Read Committed)                       -- B (Read Committed)",
      "BEGIN;                                       BEGIN;",
      "SELECT qty FROM stock WHERE sku='X';  -- 10",
      "                                             SELECT qty FROM stock WHERE sku='X';  -- 10",
      "UPDATE stock SET qty = 9 WHERE sku='X';      -- app tính 10 - 1",
      "COMMIT;",
      "                                             UPDATE stock SET qty = 9 WHERE sku='X';",
      "                                             COMMIT;",
      "-- kết quả 9, đúng ra phải 8 → mất một lần bán",
      "",
      "-- sửa: để DB tự tính, nguyên tử",
      "UPDATE stock SET qty = qty - 1 WHERE sku='X' AND qty > 0;"
    ]},
    { id: "skew", label: "Write skew", lines: [
      "-- quy tắc: luôn phải có ít nhất 1 bác sĩ trực",
      "-- A (Repeatable Read)                       -- B (Repeatable Read)",
      "SELECT count(*) FROM oncall WHERE on_duty;   SELECT count(*) FROM oncall WHERE on_duty;",
      "-- 2 → mình nghỉ được                        -- 2 → mình nghỉ được",
      "UPDATE oncall SET on_duty=false WHERE doc='An';",
      "                                             UPDATE oncall SET on_duty=false WHERE doc='Bình';",
      "COMMIT;                                      COMMIT;",
      "-- cả hai thành công, 0 người trực: sửa 2 dòng KHÁC nhau nên không xung đột",
      "",
      "-- Serializable: một trong hai nhận lỗi 40001 → retry → đọc thấy 1 → không nghỉ"
    ]},
    { id: "rr", label: "Repeatable Read báo lỗi", lines: [
      "-- A: BEGIN ISOLATION LEVEL REPEATABLE READ;",
      "-- A: SELECT qty FROM stock WHERE sku='X';          -- 10 (chụp snapshot)",
      "-- B: UPDATE stock SET qty = qty - 1 WHERE sku='X'; -- autocommit → 9",
      "-- A: UPDATE stock SET qty = qty - 1 WHERE sku='X';",
      "ERROR:  could not serialize access due to concurrent update",
      "-- SQLSTATE 40001 → A phải ROLLBACK và chạy lại cả transaction"
    ]},
    { id: "spring", label: "Spring & retry", lines: [
      "@Retryable(retryFor = ConcurrencyFailureException.class, maxAttempts = 3)",
      "@Transactional(isolation = Isolation.SERIALIZABLE)",
      "public void goOffDuty(String doctor) {",
      "    long onDuty = repo.countByOnDutyTrue();",
      "    if (onDuty < 2) throw new IllegalStateException(\"phải còn người trực\");",
      "    repo.setOffDuty(doctor);",
      "}",
      "// @Retryable phải ở NGOÀI proxy @Transactional để mỗi lần thử là một tx mới",
      "// (đặt ở bean gọi vào, hoặc chỉnh thứ tự advice)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ta"><div class="nl">🅰️ Transaction A</div><div class="ns">đọc → tính → ghi</div></div>
      <div class="node" id="tb"><div class="nl">🅱️ Transaction B</div><div class="ns">đọc → tính → ghi</div></div>
    </div>
    <div class="arrow" id="a1">↓ cùng đọc một trạng thái</div>
    <div class="node" id="anom"><div class="nl">⚠️ Anomaly</div><div class="ns">lost update / write skew</div></div>
    <div class="arrow" id="a2">↓ chọn cách phòng</div>
    <div class="row">
      <div class="node" id="atomic"><div class="nl">🧮 UPDATE nguyên tử</div><div class="ns">qty = qty - 1</div></div>
      <div class="node" id="ser"><div class="nl">🛡️ Serializable</div><div class="ns">lỗi 40001 → retry</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Lost update ở Read Committed", tab: "lost", highlight: [3, 4, 5, 7, 9], on: ["ta", "tb", "a1", "anom"],
      desc: "Cả hai đọc 10, app tính 9, cả hai ghi 9. Không có lỗi nào — chỉ có số sai." },
    { title: "2 · Sửa bằng UPDATE nguyên tử", tab: "lost", highlight: [11, 12], on: ["a2", "atomic"],
      desc: "Để DB đọc-và-ghi trong một câu lệnh; dòng bị lock khi UPDATE nên B chờ A rồi đọc lại giá trị mới." },
    { title: "3 · Repeatable Read phát hiện xung đột", tab: "rr", highlight: [2, 3, 4, 5, 6], on: ["ta", "tb"],
      desc: "Snapshot isolation không cho ghi đè thay đổi đã commit sau snapshot → lỗi, phải retry." },
    { title: "4 · Write skew lọt qua Repeatable Read", tab: "skew", highlight: [3, 4, 5, 6, 7, 8], on: ["anom"],
      desc: "Hai bên sửa hai dòng khác nhau nên không có xung đột ghi — nhưng ràng buộc chung bị phá." },
    { title: "5 · Serializable chặn write skew", tab: "skew", highlight: [10], on: ["ser"],
      desc: "SSI phát hiện phụ thuộc đọc-ghi vòng tròn và huỷ một bên." },
    { title: "6 · Code phải biết retry", tab: "spring", highlight: [1, 2, 8, 9], on: ["ser"],
      desc: "Lỗi 40001 là bình thường ở mức cao. Retry phải bọc ngoài transaction." }
  ],

  quiz: [
    { q: "Isolation level mặc định của PostgreSQL?", options: [
        "Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"
      ], correct: 1, explanation: "MySQL InnoDB mặc định Repeatable Read." },
    { q: "PostgreSQL có cho phép dirty read ở mức Read Uncommitted không?", options: [
        "Có", "Không — Read Uncommitted chạy như Read Committed", "Chỉ với bảng tạm", "Chỉ trên replica"
      ], correct: 1, explanation: "MVCC không bao giờ cho thấy tuple của transaction chưa commit." },
    { q: "Lost update xảy ra khi nào?", options: [
        "Mất điện",
        "Hai transaction cùng đọc giá trị, cùng tính ở app rồi ghi đè lên nhau",
        "Xoá nhầm bảng",
        "Replica lag"
      ], correct: 1, explanation: "Read-modify-write ngoài DB mà không lock hay kiểm tra phiên bản." },
    { q: "Cách đơn giản nhất chống lost update khi trừ tồn kho?", options: [
        "Tăng RAM",
        "UPDATE stock SET qty = qty - 1 WHERE sku = ? AND qty > 0",
        "Đọc 2 lần",
        "Dùng cache Redis"
      ], correct: 1, explanation: "DB tự đọc-và-ghi dưới row lock trong một câu lệnh." },
    { q: "Write skew là gì?", options: [
        "Hai transaction sửa cùng một dòng",
        "Hai transaction đọc cùng tập dữ liệu rồi sửa các dòng khác nhau, cùng commit và phá ràng buộc chung",
        "Ghi lệch đĩa",
        "Đọc dữ liệu chưa commit"
      ], correct: 1, explanation: "Ví dụ kinh điển: hai bác sĩ cùng xin nghỉ trực." },
    { q: "Repeatable Read của PostgreSQL chặn được write skew không?", options: [
        "Có", "Không — cần Serializable hoặc khoá/ràng buộc tường minh", "Chỉ khi có index", "Chỉ trên MySQL"
      ], correct: 1, explanation: "Snapshot isolation chỉ phát hiện xung đột ghi cùng dòng." },
    { q: "Lỗi SQLSTATE 40001 ở mức Serializable nên xử lý thế nào?", options: [
        "Báo lỗi 500 cho người dùng",
        "Rollback và retry cả transaction (code nên idempotent)",
        "Bỏ qua",
        "Hạ xuống Read Uncommitted"
      ], correct: 1, explanation: "Đây là cơ chế bình thường của SSI, không phải bug." },
    { q: "Ở Read Committed, snapshot được lấy khi nào?", options: [
        "Một lần đầu transaction",
        "Mỗi câu lệnh một snapshot mới",
        "Khi COMMIT",
        "Không dùng snapshot"
      ], correct: 1, explanation: "Vì vậy đọc lại cùng dòng có thể ra giá trị khác (non-repeatable read)." },
    { q: "Vì sao @Retryable nên nằm ngoài proxy @Transactional?", options: [
        "Cho đẹp code",
        "Để mỗi lần thử là một transaction mới; retry bên trong transaction đã hỏng là vô ích",
        "Vì Spring bắt buộc",
        "Để tăng isolation"
      ], correct: 1, explanation: "Transaction đã nhận lỗi serialize phải rollback toàn bộ." },
    { q: "Phantom read nghĩa là?", options: [
        "Đọc dòng đã bị xoá vật lý",
        "Cùng một điều kiện WHERE chạy 2 lần trả về tập dòng khác nhau",
        "Đọc dữ liệu chưa commit",
        "Replica trả dữ liệu cũ"
      ], correct: 1, explanation: "PostgreSQL Repeatable Read chặn được phantom nhờ snapshot cố định." }
  ]
});
