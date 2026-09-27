window.LESSONS.push({
  id: "17",
  phase: "7", phaseName: "Pattern thực chiến",
  title: "Pattern cache: cache-aside, write-through, write-behind và invalidation",
  subtitle: "Ai đọc DB, ai ghi cache · vì sao xoá cache chứ không cập nhật · race condition kinh điển",

  theory: `
    <p>Mỗi service của bạn có DB riêng (Postgres, Mongo...). Redis đứng trước để giảm tải và giảm độ trễ. Câu hỏi thiết kế: <strong>ai</strong> nạp cache, <strong>khi nào</strong> cache bị làm mới.</p>

    <table>
      <tr><th>Pattern</th><th>Đọc</th><th>Ghi</th><th>Hợp khi</th></tr>
      <tr><td><strong>Cache-aside</strong> (lazy loading)</td><td>App đọc cache; miss → đọc DB → ghi cache kèm TTL</td><td>App ghi DB rồi <strong>xoá</strong> key cache</td><td>Mặc định cho hầu hết trường hợp — chính là <code>@Cacheable</code>/<code>@CacheEvict</code> của Spring</td></tr>
      <tr><td><strong>Read-through</strong></td><td>Tầng cache tự đọc DB khi miss</td><td>—</td><td>Có thư viện/proxy làm hộ</td></tr>
      <tr><td><strong>Write-through</strong></td><td>Luôn có trong cache</td><td>Ghi DB và cache đồng bộ trong cùng thao tác</td><td>Dữ liệu đọc ngay sau khi ghi, ít ghi</td></tr>
      <tr><td><strong>Write-behind</strong> (write-back)</td><td>Từ cache</td><td>Ghi cache, đẩy xuống DB bất đồng bộ theo lô</td><td>Ghi cực nhiều (counter, view count); chấp nhận mất khi Redis chết</td></tr>
    </table>

    <p><strong>Vì sao xoá (invalidate) thay vì cập nhật cache khi ghi?</strong></p>
    <ul>
      <li>Hai request ghi đồng thời: A ghi DB=1, B ghi DB=2, B SET cache=2, A SET cache=1 → cache sai <em>vĩnh viễn</em> (tới TTL). Xoá thì cả hai đều DEL, lần đọc sau nạp giá trị đúng.</li>
      <li>Giá trị cache thường là kết quả tính từ nhiều bảng — tính lại lúc ghi tốn và dễ sai. Để lần đọc sau tính.</li>
    </ul>

    <p><strong>Race vẫn còn của cache-aside</strong> (hiếm nhưng có): Reader miss, đọc DB được giá trị <em>cũ</em>; Writer cập nhật DB rồi DEL cache; Reader lúc này mới SET giá trị cũ vào cache.
    Cách giảm: (1) luôn có <strong>TTL</strong> để sai lệch tự lành; (2) <strong>xoá trễ lần hai</strong> (delayed double delete) sau vài trăm ms; (3) invalidation dựa trên
    <strong>CDC</strong>: đọc WAL của Postgres/oplog của Mongo (Debezium → Kafka) rồi xoá key — không phụ thuộc code app nhớ gọi DEL; (4) lưu version trong value và chỉ ghi khi mới hơn (Lua).</p>

    <p><strong>Thứ tự: ghi DB trước rồi xoá cache</strong>. Xoá cache trước rồi ghi DB có cửa sổ lớn hơn nhiều: reader chen vào giữa sẽ nạp lại giá trị cũ ngay.</p>

    <p><strong>Thiết kế key và value</strong></p>
    <ul>
      <li>Key có namespace + version schema: <code>catalog:v3:product:9812</code>. Đổi cấu trúc value → tăng v3 thành v4, khỏi lo đọc dữ liệu định dạng cũ.</li>
      <li>Serialize gọn (JSON nhỏ, MessagePack, Protobuf). Đừng nhét object 500 KB.</li>
      <li>Cache cả kết quả "không tồn tại" (bài 18) để chặn truy vấn lặp vào id không có.</li>
    </ul>

    <div class="callout"><p>💡 <strong>Client-side caching</strong> (Redis 6+, <code>CLIENT TRACKING</code>): server ghi nhớ client đã đọc key nào và gửi thông báo invalidation khi key đổi.
    Cho phép cache trong RAM của process (như Caffeine) mà vẫn biết khi nào phải bỏ — hữu ích cho hot key (bài 06).</p></div>
  `,

  codeTabs: [
    { id: "aside", label: "① Cache-aside (Rust)", lines: [
      "async fn get_product(id: i64, redis: &mut MultiplexedConnection, db: &PgPool)",
      "    -> anyhow::Result<Product> {",
      "    let key = format!(\"catalog:v3:product:{id}\");",
      "    if let Some(json) = redis.get::<_, Option<String>>(&key).await? {",
      "        return Ok(serde_json::from_str(&json)?);          // HIT",
      "    }",
      "    let p = sqlx::query_as::<_, Product>(\"SELECT * FROM product WHERE id = $1\")",
      "        .bind(id).fetch_one(db).await?;                   // MISS -> DB",
      "    let ttl = 600 + rand::random::<u64>() % 120;          // TTL + jitter",
      "    let _: () = redis.set_ex(&key, serde_json::to_string(&p)?, ttl).await?;",
      "    Ok(p)",
      "}"
    ]},
    { id: "write", label: "② Ghi + invalidate", lines: [
      "async fn update_price(id: i64, price: i64, ...) -> anyhow::Result<()> {",
      "    sqlx::query(\"UPDATE product SET price = $1 WHERE id = $2\")",
      "        .bind(price).bind(id).execute(db).await?;         // 1. DB trước",
      "    let _: () = redis.del(format!(\"catalog:v3:product:{id}\")).await?;  // 2. xoá cache",
      "    Ok(())",
      "}",
      "",
      "// SAI thứ tự: DEL cache rồi mới UPDATE DB",
      "//   -> reader chen giữa nạp lại giá cũ vào cache ngay lập tức"
    ]},
    { id: "race", label: "③ Race hiếm gặp", lines: [
      "t1  Reader: GET cache            -> miss",
      "t2  Reader: SELECT price         -> 100   (giá cũ)",
      "t3  Writer: UPDATE price = 120",
      "t4  Writer: DEL cache",
      "t5  Reader: SET cache = 100      -> cache sai tới khi hết TTL",
      "",
      "Giảm thiểu: TTL ngắn hợp lý | delayed double delete | CDC (Debezium) | version trong value"
    ]},
    { id: "spring", label: "④ So với Spring", lines: [
      "@Cacheable(value = \"product\", key = \"#id\")     // = cache-aside phần đọc",
      "public Product get(long id) { return repo.findById(id).orElseThrow(); }",
      "",
      "@CacheEvict(value = \"product\", key = \"#id\")    // = xoá sau khi ghi",
      "@Transactional",
      "public void updatePrice(long id, long price) { ... }",
      "// Bẫy: evict chạy khi method trả về - có thể TRƯỚC khi transaction commit",
      "// -> reader nạp lại giá cũ. Nên evict sau commit (TransactionalEventListener AFTER_COMMIT)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 Service</div><div class="ns">get_product(9812)</div></div>
    <div class="arrow" id="a1">↓ GET catalog:v3:product:9812</div>
    <div class="row">
      <div class="node" id="hit"><div class="nl">⚡ HIT</div><div class="ns">trả ngay (~0,3 ms)</div></div>
      <div class="node" id="miss"><div class="nl">🕳️ MISS</div><div class="ns">đọc Postgres (~5 ms) rồi SET EX</div></div>
    </div>
    <div class="arrow" id="a2">↓ khi ghi</div>
    <div class="node" id="w"><div class="nl">✍️ UPDATE DB → DEL cache</div><div class="ns">thứ tự quan trọng</div></div>
    <div class="arrow" id="a3">↓ lưới an toàn</div>
    <div class="node" id="cdc"><div class="nl">🔁 TTL + CDC</div><div class="ns">Debezium → Kafka → DEL</div></div>
  `,
  steps: [
    { title: "1 · Đọc cache trước", tab: "aside", highlight: [3, 4, 5], on: ["app", "a1", "hit"],
      desc: "Key có namespace và version schema. Hit thì trả luôn." },
    { title: "2 · Miss: DB rồi nạp cache", tab: "aside", highlight: [7, 8, 9, 10], on: ["miss"],
      desc: "SET kèm TTL (có jitter) trong một lệnh. TTL là lưới an toàn cho mọi sai lệch." },
    { title: "3 · Ghi: DB trước, xoá cache sau", tab: "write", highlight: [2, 3, 4, 8, 9], on: ["a2", "w"],
      desc: "Xoá thay vì cập nhật để tránh hai writer ghi đè nhau sai thứ tự." },
    { title: "4 · Race còn sót", tab: "race", highlight: [1, 2, 3, 4, 5], on: ["miss", "w"],
      desc: "Reader chậm có thể ghi giá cũ vào cache sau khi writer đã xoá. Hiếm, nhưng có." },
    { title: "5 · Lưới an toàn", tab: "race", highlight: [7], on: ["a3", "cdc"],
      desc: "TTL tự lành; CDC xoá cache từ chính log của DB nên không phụ thuộc code nào quên DEL." },
    { title: "6 · Bẫy trong Spring", tab: "spring", highlight: [4, 5, 7, 8], on: ["w"],
      desc: "Evict trước khi commit = cửa sổ cho reader nạp giá cũ. Xoá sau commit." }
  ],

  quiz: [
    { q: "Trong cache-aside, ai đọc DB khi cache miss?", options: [
        "Redis tự đọc", "Ứng dụng", "Debezium", "Sentinel"
      ], correct: 1, explanation: "Read-through mới là tầng cache tự đọc." },
    { q: "Vì sao khi ghi nên DEL key cache thay vì SET giá trị mới?", options: [
        "DEL nhanh hơn", "Tránh hai writer đồng thời ghi cache sai thứ tự để lại giá trị cũ; và không phải tính lại value phức tạp", "SET không hỗ trợ TTL", "Để tiết kiệm RAM"
      ], correct: 1, explanation: "Invalidate an toàn hơn update." },
    { q: "Thứ tự nào đúng khi cập nhật?", options: [
        "DEL cache rồi UPDATE DB", "UPDATE DB rồi DEL cache", "Chỉ UPDATE DB", "Chỉ DEL cache"
      ], correct: 1, explanation: "Ngược lại tạo cửa sổ lớn để reader nạp giá trị cũ." },
    { q: "Write-behind có rủi ro gì?", options: [
        "Đọc chậm", "Redis chết trước khi đẩy xuống DB → mất dữ liệu", "Không dùng được TTL", "Không có rủi ro"
      ], correct: 1, explanation: "Chỉ dùng cho dữ liệu chấp nhận mất hoặc có cơ chế bền phụ." },
    { q: "Vì sao luôn nên đặt TTL cho key cache dù đã có invalidation?", options: [
        "Bắt buộc về cú pháp", "Lưới an toàn: mọi sai lệch do race/bug tự lành sau TTL; đồng thời giải phóng RAM", "Để Redis nhanh hơn", "Để replica đồng bộ"
      ], correct: 1, explanation: "Invalidation có thể sót; TTL giới hạn thời gian sai." },
    { q: "Lợi ích của invalidation qua CDC (Debezium đọc WAL)?", options: [
        "Không cần Redis", "Mọi thay đổi DB (kể cả từ service/script khác) đều sinh sự kiện xoá cache, không phụ thuộc code app", "Nhanh hơn DEL", "Không cần TTL nữa"
      ], correct: 1, explanation: "Nguồn sự thật là log của DB." },
    { q: "Vì sao đưa version schema (v3) vào tên key?", options: [
        "Để sắp xếp", "Đổi cấu trúc value thì đổi version, bản deploy mới không đọc nhầm dữ liệu định dạng cũ", "Bắt buộc trong Cluster", "Để tăng hit ratio"
      ], correct: 1, explanation: "Key cũ tự hết hạn theo TTL." },
    { q: "@CacheEvict trên method @Transactional có bẫy gì?", options: [
        "Không xoá được", "Có thể xoá trước khi transaction commit, reader nạp lại giá trị cũ", "Xoá toàn bộ cache", "Không chạy với Redis"
      ], correct: 1, explanation: "Xoá sau commit (AFTER_COMMIT)." },
    { q: "CLIENT TRACKING (Redis 6+) dùng để làm gì?", options: [
        "Theo dõi IP client", "Server gửi thông báo invalidation cho client đã đọc key, cho phép cache cục bộ trong process an toàn hơn", "Giới hạn số client", "Ghi log lệnh"
      ], correct: 1, explanation: "Client-side caching." }
  ]
});
