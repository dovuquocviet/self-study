window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Tư duy thiết kế",
  title: "API contract, data model & sơ đồ",
  subtitle: "Thiết kế API trước code · phân trang cursor · versioning · entity & chủ sở hữu · sơ đồ C4",

  theory: `
    <p>API là <strong>hợp đồng</strong>: một khi app mobile đã phát hành, bạn không thu hồi được bản cũ trên máy người dùng.
    Vì vậy API phải thiết kế trước, có chủ đích, và tiến hoá được mà không làm vỡ client.</p>

    <p><strong>Nguyên tắc API cho service</strong></p>
    <ul>
      <li><strong>Tài nguyên + động từ HTTP</strong>: <code>POST /orders</code>, <code>GET /orders/{id}</code>. Hành động không phải CRUD thì dùng sub-resource: <code>POST /orders/{id}/cancel</code>.</li>
      <li><strong>Phân trang bằng cursor</strong>, không dùng <code>OFFSET</code> cho danh sách lớn: <code>OFFSET 100000</code> buộc DB đọc rồi bỏ 100 000 dòng, và dữ liệu chèn thêm làm trang bị lệch.
        Cursor = giá trị khoá sắp xếp cuối cùng (vd <code>created_at,id</code>) mã hoá base64.</li>
      <li><strong>Tiến hoá tương thích ngược</strong>: chỉ <em>thêm</em> field tuỳ chọn; không đổi nghĩa, không xoá field đang dùng. Client phải bỏ qua field lạ.
        Thay đổi phá vỡ → version mới (<code>/v2</code> hoặc header) và chạy song song đến khi app cũ hết người dùng.</li>
      <li><strong>Lỗi có cấu trúc</strong>: mã HTTP đúng + body máy đọc được (vd RFC 9457 <code>application/problem+json</code>) để mobile hiển thị/xử lý.</li>
      <li><strong>Tiền tệ</strong>: số nguyên đơn vị nhỏ nhất (<code>amount_minor: 125000</code>) + mã tiền tệ; không dùng float.</li>
      <li><strong>Thời gian</strong>: ISO 8601 có múi giờ, lưu UTC.</li>
    </ul>

    <p><strong>Data model: bắt đầu từ entity và "ai sở hữu"</strong>. Mỗi entity có đúng một service là nguồn sự thật (source of truth).
    Service khác chỉ giữ <em>bản sao</em> hoặc <em>ID tham chiếu</em>. Ví dụ đơn hàng lưu <code>customer_id</code> và bản chụp giá tại thời điểm mua,
    không JOIN sang bảng giá của service Catalog (giá đổi thì đơn cũ không được đổi theo).</p>

    <p><strong>Sơ đồ</strong>: dùng mô hình C4 cho gọn — Context (hệ thống và người dùng/hệ thống ngoài) → Container (từng service, DB, Kafka, Worker) → Component (bên trong một service, chỉ khi cần).
    Trên mũi tên luôn ghi <em>sync hay async</em> và <em>giao thức</em>.</p>

    <div class="callout"><p>💡 Spring quen <code>Page&lt;T&gt;</code> với <code>page=5&amp;size=20</code> (offset). Với feed/lịch sử đơn trên mobile cuộn vô hạn,
    cursor ổn định và nhanh hơn. Trong Rust, định nghĩa API bằng OpenAPI (vd crate <code>utoipa</code> sinh từ code axum) hoặc file <code>.proto</code> cho gRPC để mobile/đội khác sinh client.</p></div>
  `,

  codeTabs: [
    { id: "api", label: "① Hợp đồng API", lines: [
      "POST /v1/orders                     # tạo đơn (header Idempotency-Key)",
      "GET  /v1/orders/{id}                # chi tiết",
      "GET  /v1/orders?cursor=eyJ0Ij...&limit=20   # lịch sử, phân trang cursor",
      "POST /v1/orders/{id}/cancel         # hành động không phải CRUD",
      "",
      "200 GET /v1/orders?limit=2",
      "{ \"items\": [ {\"id\":\"ord_9\",\"total\":{\"amount_minor\":125000,\"currency\":\"VND\"}}, ... ],",
      "  \"next_cursor\": \"eyJ0IjoiMjAyNi0wOS0yN1QwMzowMDowMFoiLCJpZCI6Im9yZF84In0\" }",
      "",
      "409 application/problem+json",
      "{ \"type\": \"https://api.shop.vn/errors/out-of-stock\", \"title\": \"Hết hàng\", \"status\": 409 }"
    ]},
    { id: "sql", label: "② Offset vs cursor", lines: [
      "-- Offset: DB vẫn phải duyệt 100 000 dòng rồi bỏ đi",
      "SELECT * FROM orders WHERE customer_id = $1",
      "ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 100000;",
      "",
      "-- Cursor (keyset): nhảy thẳng tới vị trí nhờ index",
      "CREATE INDEX ON orders (customer_id, created_at DESC, id DESC);",
      "SELECT * FROM orders WHERE customer_id = $1",
      "  AND (created_at, id) < ($2, $3)      -- giá trị cuối của trang trước",
      "ORDER BY created_at DESC, id DESC LIMIT 20;"
    ]},
    { id: "rust", label: "③ Rust (axum)", lines: [
      "#[derive(Deserialize)]",
      "struct ListQuery { cursor: Option<String>, limit: Option<u32> }",
      "",
      "async fn list_orders(State(db): State<PgPool>, user: AuthUser,",
      "                     Query(q): Query<ListQuery>) -> Result<Json<Page>, ApiError> {",
      "    let limit = q.limit.unwrap_or(20).min(100);        // chặn trên",
      "    let after = q.cursor.map(Cursor::decode).transpose()?;",
      "    let rows = repo::list(&db, user.id, after, limit + 1).await?; // lấy dư 1",
      "    let has_more = rows.len() > limit as usize;",
      "    Ok(Json(Page::from(rows, limit, has_more)))",
      "}"
    ]},
    { id: "model", label: "④ Data model & chủ sở hữu", lines: [
      "# order-service (Postgres) — nguồn sự thật của đơn",
      "orders(id, customer_id, status, total_minor, currency, created_at)",
      "order_items(order_id, sku, name_snapshot, unit_price_minor, qty)",
      "  # name/price là BẢN CHỤP lúc mua, không JOIN sang catalog",
      "",
      "# catalog-service (MongoDB) — nguồn sự thật của sản phẩm",
      "products { _id: sku, name, price_minor, attributes: {...} }",
      "",
      "# customer-service (Postgres) — nguồn sự thật của khách",
      "customers(id, email, phone, ...)",
      "# order chỉ giữ customer_id, không có FOREIGN KEY xuyên DB"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App mobile</div><div class="ns">bản cũ vẫn chạy nhiều tháng</div></div>
    <div class="arrow" id="a1">↓ HTTPS · REST /v1 (sync)</div>
    <div class="node" id="ord"><div class="nl">🦀 order-service</div><div class="ns">sở hữu orders</div></div>
    <div class="row">
      <div class="node" id="pg"><div class="nl">🐘 Postgres (orders)</div><div class="ns">index keyset</div></div>
      <div class="node" id="cat"><div class="nl">📦 catalog (Mongo)</div><div class="ns">chỉ tham chiếu sku</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Viết hợp đồng trước", tab: "api", highlight: [1, 2, 3, 4], on: ["app", "a1"],
      desc: "Danh sách endpoint là thứ mobile và backend thống nhất trước khi code. Có /v1 để tiến hoá." },
    { title: "2 · Response tiền tệ & lỗi có cấu trúc", tab: "api", highlight: [7, 8, 10, 11], on: ["ord"],
      desc: "Tiền là số nguyên + currency. Lỗi dạng problem+json để app phân biệt 'hết hàng' với 'lỗi hệ thống'." },
    { title: "3 · Vì sao OFFSET chậm", tab: "sql", highlight: [1, 2, 3], on: ["pg"],
      desc: "Càng cuộn sâu càng chậm, và đơn mới chèn vào làm trùng/sót dòng giữa các trang." },
    { title: "4 · Keyset pagination", tab: "sql", highlight: [6, 8, 9], on: ["pg"],
      desc: "So sánh tuple (created_at, id) dùng thẳng index; tốc độ như nhau ở trang 1 hay trang 5000." },
    { title: "5 · Lấy dư 1 để biết còn trang", tab: "rust", highlight: [6, 7, 8, 9], on: ["ord"],
      desc: "limit bị chặn tối đa 100 (chống client xin 1 triệu dòng). Lấy limit+1 dòng: có dòng dư nghĩa là còn trang sau." },
    { title: "6 · Mỗi entity một chủ", tab: "model", highlight: [3, 4, 7, 11], on: ["ord", "cat"],
      desc: "Đơn giữ bản chụp tên/giá. Không có khoá ngoại xuyên DB — toàn vẹn giữa service đảm bảo bằng event (bài 05, 10)." }
  ],

  quiz: [
    { q: "Vì sao API cho mobile phải đặc biệt cẩn thận về tương thích ngược?", options: [
        "Mobile chạy chậm",
        "Bản app cũ vẫn nằm trên máy người dùng nhiều tháng, không thể ép cập nhật ngay",
        "Mobile không hỗ trợ JSON",
        "Vì App Store yêu cầu"
      ], correct: 1, explanation: "Backend deploy xong là xong, app thì không." },
    { q: "Thay đổi nào là tương thích ngược?", options: [
        "Đổi tên field total thành amount",
        "Thêm field tuỳ chọn mới vào response",
        "Đổi kiểu id từ string sang number",
        "Xoá field client đang dùng"
      ], correct: 1, explanation: "Client bỏ qua field lạ nên thêm field tuỳ chọn là an toàn." },
    { q: "Vấn đề chính của OFFSET với danh sách lớn?", options: [
        "Không hỗ trợ ORDER BY",
        "DB vẫn phải duyệt rồi bỏ các dòng trước offset; dữ liệu chèn thêm làm trang lệch",
        "Không dùng được index",
        "Chỉ chạy trên MySQL"
      ], correct: 1, explanation: "Keyset/cursor khắc phục cả hai." },
    { q: "Cursor pagination thường chứa gì?", options: [
        "Số trang",
        "Giá trị khoá sắp xếp của phần tử cuối trang trước (vd created_at, id)",
        "Toàn bộ kết quả",
        "Session ID"
      ], correct: 1, explanation: "Mã hoá (base64) để client coi là chuỗi mờ." },
    { q: "Vì sao sắp xếp theo (created_at, id) mà không chỉ created_at?", options: [
        "Cho đẹp",
        "created_at có thể trùng; thêm id để thứ tự duy nhất, không sót/trùng dòng giữa các trang",
        "Postgres bắt buộc",
        "Để nhanh hơn gấp đôi"
      ], correct: 1, explanation: "Khoá sắp xếp phải duy nhất để cursor chính xác." },
    { q: "Nên biểu diễn số tiền trong API thế nào?", options: [
        "float 1250.00",
        "Số nguyên đơn vị nhỏ nhất + mã tiền tệ",
        "Chuỗi '1.250.000 đ'",
        "double"
      ], correct: 1, explanation: "Float gây sai số làm tròn." },
    { q: "Đơn hàng nên lưu giá sản phẩm thế nào?", options: [
        "JOIN sang bảng giá của catalog mỗi lần đọc",
        "Lưu bản chụp giá/tên tại thời điểm mua trong DB của order-service",
        "Không lưu giá",
        "Gọi catalog mỗi lần hiển thị"
      ], correct: 1, explanation: "Giá thay đổi không được làm thay đổi đơn cũ, và order-service không phụ thuộc catalog khi đọc." },
    { q: "Trên sơ đồ Container (C4), mũi tên giữa các khối nên ghi gì?", options: [
        "Tên lập trình viên",
        "Sync hay async và giao thức (REST, gRPC, Kafka topic...)",
        "Màu sắc",
        "Không cần ghi"
      ], correct: 1, explanation: "Đó là thông tin quyết định độ trễ và cách hỏng hóc lan truyền." },
    { q: "Tham số limit do client gửi nên xử lý thế nào?", options: [
        "Tin tưởng tuyệt đối",
        "Có mặc định và chặn trên (vd tối đa 100)",
        "Bỏ qua",
        "Nhân đôi"
      ], correct: 1, explanation: "Không chặn thì một request có thể kéo cả bảng." }
  ]
});
