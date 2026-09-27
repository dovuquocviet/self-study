window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Đồng thời: isolation & lock",
  title: "SELECT … FOR UPDATE SKIP LOCKED: làm job queue & outbox bằng PostgreSQL",
  subtitle: "Nhiều worker không giẫm chân nhau · lease/visibility timeout · outbox → Kafka · khi nào nên dùng Kafka",

  theory: `
    <p>Công ty đã có Kafka, vậy sao lại làm queue trong PostgreSQL? Vì có những việc cần <strong>nguyên tử cùng dữ liệu nghiệp vụ</strong>: "tạo đơn <em>và</em> xếp job gửi email" trong cùng một transaction. Nếu ghi DB xong rồi publish Kafka, crash ở giữa là mất sự kiện (hoặc gửi sự kiện cho đơn đã rollback).</p>

    <p><strong>Vấn đề khi nhiều worker cùng lấy job</strong></p>
    <ul>
      <li><code>SELECT ... LIMIT 10</code> thường: các worker lấy trùng job.</li>
      <li><code>FOR UPDATE</code>: worker 2 phải chờ worker 1 → chạy tuần tự.</li>
      <li><code>FOR UPDATE SKIP LOCKED</code>: row nào đang bị khoá thì <strong>bỏ qua</strong>, lấy row kế tiếp → mỗi worker nhận một lô riêng, không chờ nhau.</li>
    </ul>

    <p><strong>Hai kiểu thiết kế</strong></p>
    <ol>
      <li><strong>Giữ transaction khi xử lý</strong>: lấy job FOR UPDATE SKIP LOCKED, xử lý, DELETE/đánh dấu xong, COMMIT. Đơn giản, worker chết thì transaction rollback và job tự trở lại. Nhưng giữ transaction lâu → cản VACUUM (bài 05), tốn connection. Chỉ hợp job vài trăm ms.</li>
      <li><strong>Lease (khuyên dùng)</strong>: transaction ngắn chuyển job sang <code>running</code> + <code>locked_until = now() + 5 phút</code>, COMMIT, rồi xử lý ngoài transaction, cuối cùng cập nhật <code>done</code>. Worker chết → hết hạn lease → job được lấy lại. Vì vậy xử lý phải <strong>idempotent</strong> (at-least-once).</li>
    </ol>

    <p><strong>Transactional outbox</strong> — cầu nối sang Kafka: transaction nghiệp vụ INSERT thêm một row vào bảng <code>outbox</code>. Một relay (worker dùng SKIP LOCKED, hoặc Debezium đọc WAL qua logical replication — bài 19) đẩy sang Kafka rồi đánh dấu đã gửi. Kết quả: DB và Kafka nhất quán cuối cùng, không mất sự kiện.</p>

    <p><strong>Lưu ý vận hành</strong></p>
    <ul>
      <li>Index partial trên job còn chờ: <code>(run_at) WHERE status = 'queued'</code>.</li>
      <li>Bảng queue churn cực mạnh → autovacuum tích cực cho riêng bảng (bài 05); dọn job cũ theo lô hoặc partition theo ngày rồi DROP (bài 16).</li>
      <li>Muốn đánh thức worker ngay thay vì poll: <code>LISTEN/NOTIFY</code> — nhưng LISTEN cần connection phiên, <em>không</em> dùng qua pooler transaction mode.</li>
    </ul>

    <div class="callout"><p>💡 PostgreSQL queue tốt tới khoảng vài nghìn job/giây và khi cần transaction với dữ liệu nghiệp vụ. Cần fan-out cho nhiều consumer, replay lịch sử, hàng trăm nghìn message/giây (như luồng vào ClickHouse) → đó là việc của Kafka.</p></div>
  `,

  codeTabs: [
    { id: "schema", label: "① Schema", lines: [
      "CREATE TABLE jobs (",
      "  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,",
      "  kind         text NOT NULL,",
      "  payload      jsonb NOT NULL,",
      "  status       text NOT NULL DEFAULT 'queued',   -- queued | running | done | failed",
      "  run_at       timestamptz NOT NULL DEFAULT now(),",
      "  locked_until timestamptz,",
      "  attempts     int NOT NULL DEFAULT 0",
      ");",
      "CREATE INDEX jobs_ready_idx ON jobs (run_at) WHERE status = 'queued';",
      "CREATE INDEX jobs_lease_idx ON jobs (locked_until) WHERE status = 'running';"
    ]},
    { id: "claim", label: "② Lấy lô job", lines: [
      "WITH next AS (",
      "  SELECT id FROM jobs",
      "  WHERE status = 'queued' AND run_at <= now()",
      "  ORDER BY run_at",
      "  LIMIT 10",
      "  FOR UPDATE SKIP LOCKED",
      ")",
      "UPDATE jobs j",
      "SET status = 'running', locked_until = now() + interval '5 minutes',",
      "    attempts = attempts + 1",
      "FROM next WHERE j.id = next.id",
      "RETURNING j.id, j.kind, j.payload, j.attempts;"
    ]},
    { id: "worker", label: "③ Worker Rust", lines: [
      "loop {",
      "    let jobs: Vec<Job> = sqlx::query_as(CLAIM_SQL)     // câu ở tab ②, tự commit",
      "        .fetch_all(&pool).await?;",
      "    if jobs.is_empty() { tokio::time::sleep(Duration::from_millis(500)).await; continue; }",
      "    for job in jobs {",
      "        let res = handle(&job).await;                  // ngoài transaction, idempotent",
      "        let (st, delay) = match res { Ok(_) => (\"done\", 0), Err(_) => (\"queued\", backoff_secs(job.attempts)) };",
      "        sqlx::query(\"UPDATE jobs SET status = $2, locked_until = NULL, \\",
      "                     run_at = now() + make_interval(secs => $3) WHERE id = $1\")",
      "            .bind(job.id).bind(st).bind(delay as f64)",
      "            .execute(&pool).await?;",
      "    }",
      "}"
    ]},
    { id: "reap", label: "④ Thu hồi lease & outbox", lines: [
      "-- worker chết: trả job hết hạn lease về hàng đợi (chạy định kỳ)",
      "UPDATE jobs SET status = 'queued', locked_until = NULL",
      "WHERE status = 'running' AND locked_until < now();",
      "",
      "-- outbox: ghi cùng transaction với nghiệp vụ",
      "BEGIN;",
      "INSERT INTO orders (id, customer_id, total) VALUES (9001, 42, 350000);",
      "INSERT INTO outbox (topic, key, payload)",
      "  VALUES ('order.created', '9001', '{\"orderId\": 9001, \"total\": 350000}');",
      "COMMIT;",
      "-- relay (SKIP LOCKED hoặc Debezium) đẩy outbox sang Kafka"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">📋 jobs (queued)</div><div class="ns">#1 #2 #3 #4 #5 #6 …</div></div>
    <div class="arrow" id="a1">↓ FOR UPDATE SKIP LOCKED</div>
    <div class="row">
      <div class="node" id="w1"><div class="nl">👷 Worker 1</div><div class="ns">nhận #1–#3</div></div>
      <div class="node" id="w2"><div class="nl">👷 Worker 2</div><div class="ns">bỏ qua #1–#3, nhận #4–#6</div></div>
    </div>
    <div class="arrow" id="a2">↓ COMMIT ngay: running + locked_until</div>
    <div class="node" id="proc"><div class="nl">⚙️ Xử lý ngoài transaction</div><div class="ns">idempotent</div></div>
    <div class="row">
      <div class="node" id="done"><div class="nl">✅ done</div><div class="ns">hoặc queued lại + backoff</div></div>
      <div class="node" id="reap"><div class="nl">⏰ Lease hết hạn</div><div class="ns">worker chết → trả về queued</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Bảng job + index partial", tab: "schema", highlight: [5, 6, 7, 10, 11], on: ["q"],
      desc: "Index chỉ chứa job đang chờ nên nhỏ và nhanh, dù bảng có hàng triệu job đã xong." },
    { title: "2 · SKIP LOCKED chia việc", tab: "claim", highlight: [3, 4, 5, 6], on: ["a1", "w1", "w2"],
      desc: "Worker 2 không chờ các row Worker 1 đang khoá mà lấy lô kế tiếp. Không trùng, không tuần tự hoá." },
    { title: "3 · Đổi trạng thái & commit ngay", tab: "claim", highlight: [8, 9, 10, 12], on: ["a2"],
      desc: "Một câu lệnh vừa chọn vừa cập nhật lease; auto-commit xong là khoá được nhả. Transaction chỉ vài ms." },
    { title: "4 · Xử lý ngoài transaction", tab: "worker", highlight: [2, 6, 7, 8, 9], on: ["proc", "done"],
      desc: "Gọi API, gửi email... không giữ connection hay snapshot. Lỗi thì đưa về queued với run_at lùi theo backoff." },
    { title: "5 · Thu hồi job của worker chết", tab: "reap", highlight: [2, 3], on: ["reap"],
      desc: "Lease hết hạn → job quay lại hàng đợi. Vì thế một job có thể chạy hơn một lần → handler phải idempotent." },
    { title: "6 · Outbox sang Kafka", tab: "reap", highlight: [6, 7, 8, 9, 10], on: ["q"],
      desc: "Đơn hàng và sự kiện 'order.created' commit cùng nhau hoặc cùng không. Relay đảm bảo sự kiện tới Kafka ít nhất một lần." }
  ],

  quiz: [
    { q: "FOR UPDATE SKIP LOCKED làm gì khi gặp row đang bị khoá?", options: [
        "Chờ", "Báo lỗi", "Bỏ qua row đó và xét row kế tiếp", "Đọc phiên bản cũ rồi khoá"
      ], correct: 2, explanation: "Nhờ vậy nhiều worker lấy các lô khác nhau mà không chờ nhau." },
    { q: "Vì sao chỉ dùng FOR UPDATE (không SKIP LOCKED) cho queue lại kém?", options: [
        "Vì lấy trùng job",
        "Vì các worker phải chờ nhau trên cùng những row đầu hàng → xử lý tuần tự",
        "Vì không khoá gì",
        "Vì lỗi cú pháp"
      ], correct: 1, explanation: "Không trùng nhưng mất tính song song." },
    { q: "Ưu điểm của thiết kế lease so với giữ transaction trong lúc xử lý job?", options: [
        "Đảm bảo exactly-once",
        "Transaction ngắn: không giữ connection, không ghim xmin horizon cản VACUUM",
        "Không cần index",
        "Không cần xử lý worker chết"
      ], correct: 1, explanation: "Đổi lại cần thu hồi lease và handler idempotent." },
    { q: "Vì sao handler job phải idempotent trong mô hình lease?", options: [
        "Vì PostgreSQL chạy job 2 lần",
        "Vì worker có thể chết sau khi xử lý xong nhưng trước khi đánh dấu done → job được chạy lại (at-least-once)",
        "Vì SKIP LOCKED trả trùng",
        "Không cần idempotent"
      ], correct: 1, explanation: "Dùng khoá idempotency (vd order_id) ở phía xử lý." },
    { q: "Transactional outbox giải quyết vấn đề gì?", options: [
        "Tăng tốc Kafka",
        "Ghi DB và phát sự kiện không nhất quán khi crash giữa chừng",
        "Giảm dung lượng DB",
        "Thay thế Kafka"
      ], correct: 1, explanation: "Sự kiện được commit cùng dữ liệu nghiệp vụ, relay đẩy đi sau." },
    { q: "LISTEN/NOTIFY qua PgBouncer transaction mode?", options: [
        "Hoạt động bình thường",
        "Không đáng tin: LISTEN gắn với phiên của một connection server vốn được chia sẻ",
        "Bắt buộc phải dùng",
        "Chỉ lỗi trên Windows"
      ], correct: 1, explanation: "Worker cần LISTEN nên có connection trực tiếp riêng." },
    { q: "Index phù hợp để worker tìm job sẵn sàng?", options: [
        "B-tree trên payload",
        "Partial index (run_at) WHERE status = 'queued'",
        "GIN trên status",
        "Không cần index"
      ], correct: 1, explanation: "Chỉ chứa job đang chờ, khớp ORDER BY run_at." },
    { q: "Khi nào nên chọn Kafka thay vì queue trong PostgreSQL?", options: [
        "Khi cần transaction cùng dữ liệu nghiệp vụ",
        "Khi cần thông lượng rất cao, nhiều consumer group độc lập, replay lịch sử",
        "Khi có dưới 100 job/ngày",
        "Không bao giờ"
      ], correct: 1, explanation: "Hai thứ bổ sung nhau; outbox là cầu nối." },
    { q: "Rủi ro vận hành chính của bảng queue trong PostgreSQL?", options: [
        "Không có",
        "Sinh dead tuple rất nhanh → cần autovacuum tích cực và tránh transaction dài song song",
        "Không dùng được index",
        "Khoá toàn bảng"
      ], correct: 1, explanation: "Hoặc partition theo thời gian và DROP partition cũ." }
  ]
});
