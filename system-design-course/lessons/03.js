window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Ranh giới & giao tiếp",
  title: "Ranh giới service & database-per-service",
  subtitle: "Bounded context · coupling/cohesion · vì sao không dùng chung DB · lấy dữ liệu của service khác thế nào",

  theory: `
    <p>Microservice không phải "chia nhỏ code". Nó là chia <strong>quyền sở hữu dữ liệu và quyết định</strong> để từng đội deploy độc lập.
    Chia sai ranh giới tạo ra "distributed monolith": mọi service phải deploy cùng nhau, gọi nhau dây chuyền, chậm hơn cả monolith.</p>

    <p><strong>Cắt ở đâu?</strong></p>
    <ul>
      <li><strong>Bounded context</strong> (DDD): vùng mà một thuật ngữ có nghĩa nhất quán. "Product" ở Catalog là mô tả, ảnh, thuộc tính; ở Inventory là số lượng trong kho; ở Order là dòng hàng đã chụp giá.
        Ba nghĩa khác nhau → ba mô hình khác nhau, không phải một class <code>Product</code> dùng chung.</li>
      <li><strong>Cohesion cao</strong>: thứ hay đổi cùng nhau thì ở cùng service. <strong>Coupling thấp</strong>: một nghiệp vụ không cần gọi đồng bộ 5 service.</li>
      <li><strong>Kiểm tra nhanh</strong>: một use case chính có hoàn thành được mà không gọi sync sang service khác không? Nếu 2 service luôn phải đổi và deploy cùng lúc → nên gộp.</li>
    </ul>

    <p><strong>Database-per-service</strong>: mỗi service có DB (hoặc schema/user riêng) mà <em>chỉ nó</em> đọc ghi. Lý do:</p>
    <ul>
      <li>Đổi schema không làm vỡ service khác (bảng là chi tiết nội bộ, API mới là hợp đồng).</li>
      <li>Chọn đúng loại DB: Postgres cho đơn hàng (transaction), MongoDB cho catalog (document linh hoạt), Redis cho session/giỏ hàng.</li>
      <li>Cô lập tải và sự cố: query nặng của báo cáo không khoá bảng đơn hàng.</li>
    </ul>
    <p>Cái giá: <strong>mất JOIN và mất transaction ACID xuyên service</strong>. Thay bằng:</p>
    <table>
      <tr><th>Nhu cầu</th><th>Cách làm</th></tr>
      <tr><td>Cần dữ liệu của service khác lúc xử lý request</td><td>Gọi API (sync) — đơn giản nhưng phụ thuộc thời gian chạy</td></tr>
      <tr><td>Cần đọc nhiều, chấp nhận trễ</td><td>Giữ <strong>bản sao cục bộ</strong> cập nhật qua event Kafka (bài 05)</td></tr>
      <tr><td>Báo cáo/tìm kiếm tổng hợp nhiều service</td><td>Read model riêng: Elasticsearch, ClickHouse (bài 15)</td></tr>
      <tr><td>Ghi nhất quán qua nhiều service</td><td>Saga + outbox (bài 09, 10)</td></tr>
    </table>

    <div class="callout"><p>💡 Trong Spring monolith, <code>@Transactional</code> bao cả trừ kho lẫn tạo đơn và JPA JOIN mọi bảng. Sang microservice, hai việc đó nằm ở hai DB —
    không còn transaction chung. Nếu bạn thấy mình muốn cấp quyền cho service A đọc thẳng bảng của service B "cho nhanh", đó là dấu hiệu ranh giới sai
    hoặc thiếu một event/read model. Bắt đầu bằng <strong>modular monolith</strong> (một binary Rust, nhiều module có ranh giới rõ) rồi tách dần cũng là lựa chọn hợp lý.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "① Sai: dùng chung DB", lines: [
      "# order-service và inventory-service cùng trỏ vào 1 Postgres",
      "-- order-service chạy:",
      "SELECT o.*, s.qty FROM orders o JOIN stock s ON s.sku = o.sku;",
      "",
      "# Hậu quả:",
      "# - inventory đổi tên cột qty -> on_hand  => order-service vỡ lúc chạy",
      "# - báo cáo nặng bên inventory khoá bảng  => tạo đơn chậm theo",
      "# - không ai biết bảng nào của ai        => không dám sửa gì"
    ]},
    { id: "good", label: "② Đúng: mỗi service một DB", lines: [
      "order-service     -> Postgres  orders_db    (user: order_rw)",
      "inventory-service -> Postgres  inventory_db (user: inv_rw)",
      "catalog-service   -> MongoDB   catalog",
      "cart-service      -> Redis     cart:*",
      "search-service    -> Elasticsearch (read model, nạp từ Kafka)",
      "analytics         -> ClickHouse    (consume Kafka)",
      "",
      "-- chặn bằng quyền, không chỉ bằng quy ước:",
      "REVOKE ALL ON DATABASE inventory_db FROM order_rw;"
    ]},
    { id: "copy", label: "③ Bản sao cục bộ qua event", lines: [
      "// order-service cần tên + giá sản phẩm khi tạo đơn, không muốn gọi catalog mỗi lần",
      "// => consume topic catalog.product.v1, giữ bảng product_view riêng",
      "async fn on_product_event(db: &PgPool, e: ProductChanged) -> anyhow::Result<()> {",
      "    sqlx::query(\"INSERT INTO product_view (sku, name, price_minor, version)",
      "                 VALUES ($1, $2, $3, $4)",
      "                 ON CONFLICT (sku) DO UPDATE SET name = $2, price_minor = $3, version = $4",
      "                 WHERE product_view.version < $4\")   // bỏ event cũ đến muộn",
      "        .bind(&e.sku).bind(&e.name).bind(e.price_minor).bind(e.version)",
      "        .execute(db).await?;",
      "    Ok(())",
      "}"
    ]},
    { id: "java", label: "④ Spring vs microservice", lines: [
      "// Monolith Spring: một transaction bao tất",
      "@Transactional",
      "public Order place(Cart c) {",
      "    inventoryRepo.decrease(c.items());   // bảng stock",
      "    return orderRepo.save(Order.from(c)); // bảng orders, cùng DB",
      "}",
      "",
      "// Microservice: stock và orders ở 2 DB khác nhau",
      "// => không có @Transactional chung; dùng saga + outbox (bài 09-10)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="os"><div class="nl">🦀 order-service</div><div class="ns">Postgres orders_db</div></div>
      <div class="node" id="is"><div class="nl">🦀 inventory-service</div><div class="ns">Postgres inventory_db</div></div>
      <div class="node" id="cs"><div class="nl">🦀 catalog-service</div><div class="ns">MongoDB</div></div>
    </div>
    <div class="arrow" id="a1">↓ event (Kafka) thay cho JOIN xuyên DB</div>
    <div class="node" id="k"><div class="nl">📨 Kafka</div><div class="ns">catalog.product.v1 · order.v1 ...</div></div>
    <div class="arrow" id="a2">↓ nạp read model</div>
    <div class="row">
      <div class="node" id="pv"><div class="nl">product_view</div><div class="ns">bản sao trong orders_db</div></div>
      <div class="node" id="es"><div class="nl">🔎 ES / 📊 ClickHouse</div><div class="ns">tìm kiếm · báo cáo</div></div>
    </div>
  `,
  steps: [
    { title: "1 · DB dùng chung là coupling ẩn", tab: "bad", highlight: [3, 6, 7, 8], on: ["os", "is"],
      desc: "JOIN qua bảng của đội khác biến schema nội bộ thành hợp đồng không ai quản lý." },
    { title: "2 · Mỗi service một kho, đúng loại", tab: "good", highlight: [1, 2, 3, 4], on: ["os", "is", "cs"],
      desc: "Postgres cho giao dịch, Mongo cho document, Redis cho dữ liệu ngắn hạn." },
    { title: "3 · Khoá cửa bằng quyền DB", tab: "good", highlight: [8, 9], on: ["is"],
      desc: "Quy ước dễ bị phá lúc gấp; phân quyền thì không." },
    { title: "4 · Cần dữ liệu người khác? nghe event", tab: "copy", highlight: [1, 2, 3], on: ["cs", "a1", "k"],
      desc: "order-service subscribe sự kiện sản phẩm và tự giữ bảng product_view." },
    { title: "5 · Upsert có version", tab: "copy", highlight: [4, 5, 6, 7], on: ["a2", "pv"],
      desc: "Event có thể đến trễ hoặc lặp; so version để không ghi đè dữ liệu mới bằng dữ liệu cũ." },
    { title: "6 · Mất @Transactional chung", tab: "java", highlight: [2, 4, 5, 8, 9], on: ["os", "is", "es"],
      desc: "Đây là cái giá lớn nhất của database-per-service; phần 2 của khoá giải quyết nó." }
  ],

  quiz: [
    { q: "Dấu hiệu rõ nhất của 'distributed monolith'?", options: [
        "Có nhiều hơn 10 service",
        "Các service phải deploy cùng nhau và gọi sync dây chuyền để hoàn thành mọi việc",
        "Dùng Kafka",
        "Mỗi service một DB"
      ], correct: 1, explanation: "Có chi phí của hệ phân tán mà không có lợi ích deploy độc lập." },
    { q: "Lợi ích chính của database-per-service?", options: [
        "Tiết kiệm ổ đĩa",
        "Service tự đổi schema, chọn loại DB phù hợp, cô lập tải và sự cố",
        "JOIN nhanh hơn",
        "Không cần backup"
      ], correct: 1, explanation: "Bảng trở thành chi tiết nội bộ; API/event là hợp đồng." },
    { q: "Cái giá lớn nhất của database-per-service?", options: [
        "Phải dùng Rust",
        "Mất JOIN và transaction ACID xuyên service",
        "Không dùng được index",
        "Không backup được"
      ], correct: 1, explanation: "Thay bằng API, bản sao qua event, read model và saga." },
    { q: "'Product' ở Catalog, Inventory và Order nên là…", options: [
        "Một class dùng chung trong thư viện chung",
        "Ba mô hình khác nhau theo bounded context, mỗi nơi chỉ giữ thứ mình cần",
        "Một bảng dùng chung",
        "Một service riêng mà ai cũng gọi"
      ], correct: 1, explanation: "Cùng tên nhưng khác nghĩa trong từng ngữ cảnh." },
    { q: "order-service cần tên sản phẩm cho mỗi lần tạo đơn, catalog có thể chậm/chết. Cách bền nhất?", options: [
        "Đọc thẳng collection Mongo của catalog",
        "Giữ bản sao product_view cập nhật từ event của catalog",
        "Hard-code tên",
        "Bắt mobile gửi tên sản phẩm và tin luôn"
      ], correct: 1, explanation: "Bỏ phụ thuộc thời gian chạy; chấp nhận trễ vài giây." },
    { q: "Vì sao upsert bản sao cần so version?", options: [
        "Để tiết kiệm CPU",
        "Event có thể lặp hoặc tới sai thứ tự; tránh ghi đè bản mới bằng bản cũ",
        "Postgres yêu cầu",
        "Để có index"
      ], correct: 1, explanation: "Consumer phải idempotent và chịu được out-of-order." },
    { q: "Hai service luôn phải sửa và deploy cùng lúc. Nên làm gì?", options: [
        "Tách thêm service thứ ba",
        "Cân nhắc gộp lại — ranh giới hiện tại sai",
        "Dùng chung DB",
        "Thêm Kafka giữa hai service"
      ], correct: 1, explanation: "Thứ hay đổi cùng nhau nên ở cùng nhau (cohesion)." },
    { q: "Cách đảm bảo service khác không đọc lén DB của bạn?", options: [
        "Viết vào wiki",
        "Phân quyền DB: user của mỗi service chỉ có quyền trên DB của nó",
        "Đặt tên bảng khó đoán",
        "Không cần"
      ], correct: 1, explanation: "Quy ước bị phá lúc gấp; quyền thì không." },
    { q: "Modular monolith là…", options: [
        "Monolith không có module",
        "Một deployable nhưng chia module có ranh giới rõ, dễ tách service sau",
        "Microservice dùng chung DB",
        "Serverless"
      ], correct: 1, explanation: "Điểm khởi đầu tốt khi chưa rõ ranh giới." }
  ]
});
