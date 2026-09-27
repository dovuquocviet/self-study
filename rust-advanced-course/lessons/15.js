window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "Service production",
  title: "sqlx nâng cao: pool, transaction, migration, query kiểm tra lúc biên dịch",
  subtitle: "PgPoolOptions & kích thước pool · Transaction rollback khi drop · query! + cargo sqlx prepare · migrate! · stream · so với diesel và JPA",

  theory: `
    <p>Không có JPA/Hibernate trong Rust — và đó là chủ ý. sqlx cho bạn SQL thật, được <strong>kiểm tra với DB thật lúc biên dịch</strong>; diesel cho DSL kiểu an toàn.
    Không có lazy loading, không có dirty checking, không có "session" ngầm: mọi truy vấn là tường minh.</p>

    <p><strong>1. Pool</strong> (≈ HikariCP)</p>
    <ul>
      <li><code>PgPoolOptions::new().max_connections(n).min_connections(m).acquire_timeout(..).idle_timeout(..).max_lifetime(..)</code>. Mặc định <code>max_connections</code> là 10.</li>
      <li>Cỡ pool không phải "càng to càng tốt": Postgres mỗi connection là một process. Tổng (số pod × max_connections) phải &lt; <code>max_connections</code> của server (thường có PgBouncer phía trước).
        Công thức khởi điểm giống Hikari: vài lần số core của DB, chứ không theo số request đồng thời.</li>
      <li><code>acquire_timeout</code> ngắn (vài giây) → lỗi <em>PoolTimedOut</em> rõ ràng thay vì treo; đó cũng là tín hiệu backpressure.</li>
      <li>Dùng PgBouncer chế độ transaction: prepared statement có thể xung đột (PgBouncer 1.21+ hỗ trợ <code>max_prepared_statements</code>); nếu không, tắt statement cache (<code>statement_cache_capacity(0)</code> trên <code>PgConnectOptions</code>).</li>
    </ul>

    <p><strong>2. Transaction</strong></p>
    <ul>
      <li><code>let mut tx = pool.begin().await?;</code> → truyền <code>&amp;mut *tx</code> vào query → <code>tx.commit().await?</code>.</li>
      <li>Không commit (lỗi <code>?</code> thoát sớm, panic, future bị huỷ) → <code>Transaction</code> bị drop → <strong>rollback</strong> tự động. Không cần <code>@Transactional</code>, không có proxy, không có bẫy self-invocation.</li>
      <li>Hàm repository nhận <code>impl PgExecutor&lt;'_&gt;</code> (hoặc <code>&amp;mut PgConnection</code>) để dùng được cả với pool lẫn transaction.</li>
      <li><code>SELECT ... FOR UPDATE</code> để khoá hàng khi đọc-sửa-ghi; hoặc cập nhật có điều kiện <code>UPDATE ... WHERE stock &gt;= $1</code> rồi kiểm tra <code>rows_affected()</code>.</li>
    </ul>

    <p><strong>3. Kiểm tra lúc biên dịch</strong></p>
    <ul>
      <li><code>sqlx::query!</code> / <code>query_as!</code> kết nối <code>DATABASE_URL</code> lúc <code>cargo build</code>, hỏi Postgres kiểu của từng cột/tham số: sai tên cột, sai kiểu, cột nullable mà struct không phải <code>Option</code> → <strong>lỗi biên dịch</strong>.</li>
      <li>CI không có DB: chạy <code>cargo sqlx prepare</code> (sinh thư mục <code>.sqlx/</code>, commit vào git) và build với <code>SQLX_OFFLINE=true</code>.</li>
      <li>Hàm <code>sqlx::query</code>/<code>query_as</code> (không có dấu !) không kiểm tra lúc biên dịch — dùng cho SQL động.</li>
    </ul>

    <p><strong>4. Migration</strong>: <code>sqlx migrate add -r create_orders</code> tạo cặp file up/down; <code>sqlx::migrate!()</code> nhúng thư mục <code>./migrations</code> vào binary, <code>.run(&amp;pool)</code> áp khi khởi động
    (ghi vào bảng <code>_sqlx_migrations</code>, có checksum — sửa file migration đã chạy là lỗi). Tương đương Flyway. Khi nhiều pod cùng khởi động, sqlx dùng advisory lock của Postgres để chỉ một pod chạy.</p>

    <p><strong>5. diesel</strong>: DSL Rust sinh SQL, schema trong <code>schema.rs</code> (sinh từ DB); kiểm tra hoàn toàn bằng hệ kiểu, không cần DB lúc build. Mặc định đồng bộ — dùng <code>diesel-async</code> cho Tokio.
    Chọn sqlx khi đội viết SQL thành thạo; diesel khi muốn query builder kiểu an toàn. Cả hai đều không phải ORM kiểu JPA.</p>
    <div class="callout"><p>💡 Bẫy N+1 không biến mất khi bỏ JPA — nó chỉ lộ rõ hơn: vòng for gọi <code>query!</code> cho mỗi đơn. Dùng <code>WHERE id = ANY($1)</code> với <code>&amp;[i64]</code> để lấy một lần.</p></div>
  `,

  codeTabs: [
    { id: "pool", label: "① Pool & migrate", lines: [
      "let pool = PgPoolOptions::new()",
      "    .max_connections(20)",
      "    .min_connections(2)",
      "    .acquire_timeout(Duration::from_secs(3))     // hết slot -> lỗi rõ, không treo",
      "    .idle_timeout(Duration::from_secs(600))",
      "    .max_lifetime(Duration::from_secs(1800))",
      "    .connect(&cfg.database_url)",
      "    .await?;",
      "",
      "sqlx::migrate!(\"./migrations\")                   // nhúng vào binary lúc build",
      "    .run(&pool)",
      "    .await?;                                     // ghi vào _sqlx_migrations"
    ]},
    { id: "tx", label: "② Transaction", lines: [
      "pub async fn place_order(pool: &PgPool, user: i64, sku: &str, qty: i32) -> Result<i64, OrderError> {",
      "    let mut tx = pool.begin().await.context(\"begin\")?;",
      "",
      "    let res = sqlx::query!(",
      "        \"UPDATE stock SET qty = qty - $1 WHERE sku = $2 AND qty >= $1\", qty, sku)",
      "        .execute(&mut *tx).await.context(\"reserve\")?;",
      "    if res.rows_affected() == 0 {",
      "        return Err(OrderError::OutOfStock { sku: sku.into(), left: 0 });   // drop tx -> ROLLBACK",
      "    }",
      "",
      "    let id = sqlx::query_scalar!(",
      "        \"INSERT INTO orders (user_id, sku, qty) VALUES ($1, $2, $3) RETURNING id\", user, sku, qty)",
      "        .fetch_one(&mut *tx).await.context(\"insert order\")?;",
      "",
      "    tx.commit().await.context(\"commit\")?;",
      "    Ok(id)",
      "}"
    ]},
    { id: "check", label: "③ query! kiểm tra", lines: [
      "struct OrderRow { id: i64, sku: String, note: Option<String> }",
      "",
      "let rows = sqlx::query_as!(OrderRow,",
      "    \"SELECT id, sku, note FROM orders WHERE id = ANY($1)\", &ids[..])   // tránh N+1",
      "    .fetch_all(&pool).await?;",
      "",
      "// Đổi note thành String (không Option) trong khi cột nullable:",
      "// error: ... expected `String`, found `Option<String>`   <- lúc BIÊN DỊCH",
      "",
      "# CI không có DB:",
      "cargo sqlx prepare          # sinh .sqlx/*.json -> commit",
      "SQLX_OFFLINE=true cargo build"
    ]},
    { id: "exec", label: "④ Executor chung", lines: [
      "// Nhận cả &PgPool lẫn &mut *tx",
      "pub async fn find_user<'e, E>(db: E, id: i64) -> sqlx::Result<Option<User>>",
      "where E: sqlx::PgExecutor<'e> {",
      "    sqlx::query_as!(User, \"SELECT id, email FROM users WHERE id = $1\", id)",
      "        .fetch_optional(db).await",
      "}",
      "",
      "find_user(&pool, 1).await?;          // ngoài transaction",
      "find_user(&mut *tx, 1).await?;       // trong transaction",
      "",
      "// Stream kết quả lớn, không nạp hết vào RAM:",
      "let mut s = sqlx::query_as::<_, Event>(\"SELECT * FROM events\").fetch(&pool);",
      "while let Some(ev) = s.try_next().await? { export(ev).await?; }"
    ]},
    { id: "java", label: "⑤ Đối chiếu JPA", lines: [
      "@Transactional                        // proxy AOP; gọi nội bộ this.x() -> mất tx",
      "public Long placeOrder(Long user, String sku, int qty) {",
      "    Stock s = stockRepo.findBySku(sku);        // managed entity",
      "    s.setQty(s.getQty() - qty);                // dirty checking -> UPDATE ngầm",
      "    return orderRepo.save(new Order(user, sku, qty)).getId();",
      "}",
      "",
      "// sqlx: không proxy, không dirty checking, không lazy loading",
      "// tx là giá trị bình thường; drop = rollback; SQL nhìn thấy được"
    ]}
  ],

  stageHtml: `
    <div class="node" id="build"><div class="nl">🔨 cargo build</div><div class="ns">query! hỏi DB (hoặc .sqlx/) kiểu cột</div></div>
    <div class="arrow" id="a1">↓ binary chứa migrations</div>
    <div class="node" id="mig"><div class="nl">📜 migrate!().run()</div><div class="ns">_sqlx_migrations · advisory lock</div></div>
    <div class="arrow" id="a2">↓ request</div>
    <div class="node" id="pool"><div class="nl">🏊 PgPool (max 20)</div><div class="ns">acquire_timeout 3s</div></div>
    <div class="arrow" id="a3">↓ begin()</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ commit()</div><div class="ns">UPDATE + INSERT cùng lúc</div></div>
      <div class="node" id="rb"><div class="nl">↩️ drop tx</div><div class="ns">lỗi / huỷ → ROLLBACK</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Cấu hình pool", tab: "pool", highlight: [1, 2, 4, 6], on: ["pool"],
      desc: "Giới hạn theo sức chịu của Postgres, không theo số request. acquire_timeout ngắn để lỗi rõ ràng." },
    { title: "2 · Migration nhúng binary", tab: "pool", highlight: [10, 11, 12], on: ["a1", "mig"],
      desc: "Như Flyway: bảng lịch sử + checksum. Nhiều pod khởi động cùng lúc vẫn an toàn nhờ advisory lock." },
    { title: "3 · Transaction & cập nhật có điều kiện", tab: "tx", highlight: [2, 5, 6, 7, 8], on: ["a3", "rb"],
      desc: "UPDATE ... WHERE qty >= $1 tránh race đọc-rồi-ghi. Hết hàng → return Err → tx drop → rollback." },
    { title: "4 · Commit", tab: "tx", highlight: [11, 12, 13, 15], on: ["ok"],
      desc: "Chỉ khi tới được commit() thì cả hai lệnh mới có hiệu lực. Không proxy, không annotation." },
    { title: "5 · Kiểm tra lúc biên dịch", tab: "check", highlight: [1, 3, 4, 8, 11, 12], on: ["build"],
      desc: "Cột nullable phải là Option. ANY($1) lấy nhiều id một lần. CI dùng .sqlx/ + SQLX_OFFLINE." },
    { title: "6 · Một hàm, hai ngữ cảnh", tab: "exec", highlight: [2, 3, 8, 9, 12, 13], on: ["pool"],
      desc: "PgExecutor cho phép gọi với pool hoặc transaction. fetch() trả stream để xử lý bảng lớn." }
  ],

  quiz: [
    { q: "Transaction của sqlx bị drop khi chưa commit thì?", options: [
        "Tự commit", "Rollback", "Panic", "Giữ connection mãi"
      ], correct: 1, explanation: "RAII: lỗi ? thoát sớm hay future bị huỷ đều an toàn." },
    { q: "sqlx::query! kiểm tra SQL lúc nào?", options: [
        "Lúc chạy", "Lúc biên dịch, bằng cách hỏi DB (DATABASE_URL) hoặc dữ liệu offline trong .sqlx/", "Không kiểm tra", "Lúc migrate"
      ], correct: 1, explanation: "Sai cột/kiểu là lỗi biên dịch." },
    { q: "Build trên CI không có Postgres với query! cần gì?", options: [
        "Không build được",
        "Chạy cargo sqlx prepare, commit .sqlx/, build với SQLX_OFFLINE=true",
        "Tắt macro",
        "Dùng SQLite"
      ], correct: 1, explanation: "Metadata truy vấn được lưu sẵn." },
    { q: "Cột note nullable, struct khai báo note: String. query_as! báo gì?", options: [
        "Không báo gì", "Lỗi biên dịch về kiểu (cần Option<String>)", "Panic lúc chạy khi gặp NULL", "Tự đổi NULL thành chuỗi rỗng"
      ], correct: 1, explanation: "Nullability được suy ra từ schema." },
    { q: "Cách tránh race khi trừ tồn kho mà không cần SELECT FOR UPDATE?", options: [
        "Đọc qty rồi UPDATE với giá trị mới",
        "UPDATE ... SET qty = qty - $1 WHERE sku = $2 AND qty >= $1 rồi kiểm tra rows_affected",
        "Dùng Mutex trong Rust",
        "Tăng pool"
      ], correct: 1, explanation: "Điều kiện nằm trong một câu lệnh nguyên tử ở DB. Mutex trong process không bảo vệ được khi có nhiều pod." },
    { q: "max_connections của pool nên đặt dựa trên?", options: [
        "Số request đồng thời tối đa",
        "Sức chịu của Postgres (tổng các pod < giới hạn server/PgBouncer), thường không lớn",
        "Càng to càng tốt",
        "Số CPU của pod × 100"
      ], correct: 1, explanation: "Mỗi connection Postgres là một process." },
    { q: "Viết hàm repository dùng được cả với &PgPool và transaction, bound nào?", options: [
        "E: Clone", "E: sqlx::PgExecutor<'e>", "E: Send", "E: Iterator"
      ], correct: 1, explanation: "Truyền &pool hoặc &mut *tx." },
    { q: "sqlx::migrate!() khác chạy migration bằng CLI ở điểm nào?", options: [
        "Không khác",
        "Nhúng file migration vào binary lúc biên dịch, chạy khi service khởi động",
        "Chỉ chạy down",
        "Không có checksum"
      ], correct: 1, explanation: "Giống Flyway chạy lúc Spring Boot khởi động." },
    { q: "So với @Transactional của Spring, điểm khác chính của transaction sqlx?", options: [
        "sqlx không hỗ trợ transaction",
        "Là giá trị tường minh truyền qua hàm; không proxy nên không có bẫy self-invocation",
        "Chỉ đọc",
        "Tự retry"
      ], correct: 1, explanation: "Nhìn chữ ký hàm là biết có chạy trong transaction không." },
    { q: "Lấy 1 triệu dòng để export mà không nạp hết vào RAM?", options: [
        "fetch_all", "fetch() trả stream, xử lý từng dòng với try_next", "fetch_one lặp", "LIMIT 1000000"
      ], correct: 1, explanation: "Stream đọc dần theo cursor của giao thức." }
  ]
});
