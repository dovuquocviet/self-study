window.LESSONS.push({
  id: "16",
  phase: "3", phaseName: "Service production",
  title: "serde nâng cao: rename, tag, flatten, default, with & zero-copy",
  subtitle: "rename_all · enum tagging (external/internal/adjacent/untagged) · flatten · default & skip_serializing_if · deny_unknown_fields · with/serde_with · Cow & #[serde(borrow)]",

  theory: `
    <p>serde là Jackson của Rust, nhưng khác căn bản: <strong>không reflection</strong>. <code>#[derive(Serialize, Deserialize)]</code> sinh code lúc biên dịch cho đúng struct đó,
    nên nhanh và mọi cấu hình là attribute có kiểm tra. serde tách <em>data model</em> khỏi <em>format</em>: cùng một derive dùng cho JSON (<code>serde_json</code>), MessagePack, YAML, TOML, bincode, Avro...</p>

    <p><strong>1. Tên trường & giá trị thiếu</strong></p>
    <ul>
      <li><code>#[serde(rename_all = "camelCase")]</code> trên struct (≈ <code>PropertyNamingStrategies</code>); <code>#[serde(rename = "type")]</code> cho từng field (<code>type</code> là từ khoá Rust); <code>alias</code> nhận thêm tên cũ khi đọc.</li>
      <li>Field kiểu <code>Option&lt;T&gt;</code> thiếu trong JSON → <code>None</code> (không lỗi). Field thường thiếu → lỗi <em>missing field</em>, trừ khi có <code>#[serde(default)]</code> hoặc <code>default = "fn_name"</code>.</li>
      <li><code>#[serde(skip_serializing_if = "Option::is_none")]</code> để không in <code>"x": null</code>.</li>
      <li><code>#[serde(deny_unknown_fields)]</code>: field lạ → lỗi (≈ <code>FAIL_ON_UNKNOWN_PROPERTIES</code>). Mặc định serde <em>bỏ qua</em> field lạ — ngược với mặc định của Jackson.
        Dùng cho config/API nội bộ chặt; tránh cho payload từ bên thứ ba vì họ thêm field là bạn vỡ.</li>
    </ul>

    <p><strong>2. Enum — 4 cách biểu diễn</strong></p>
    <table>
      <tr><th>Attribute</th><th>JSON của <code>Event::Paid { amount: 5 }</code></th><th>Ghi chú</th></tr>
      <tr><td>(mặc định, external)</td><td><code>{"Paid": {"amount": 5}}</code></td><td>Ít gặp ở API ngoài</td></tr>
      <tr><td><code>tag = "type"</code> (internal)</td><td><code>{"type": "Paid", "amount": 5}</code></td><td>Phổ biến nhất, ≈ <code>@JsonTypeInfo(property="type")</code></td></tr>
      <tr><td><code>tag = "t", content = "c"</code> (adjacent)</td><td><code>{"t": "Paid", "c": {"amount": 5}}</code></td><td>Khi nội dung không phải object</td></tr>
      <tr><td><code>untagged</code></td><td><code>{"amount": 5}</code></td><td>Thử lần lượt từng variant — chậm, thông báo lỗi kém; dùng tiết kiệm</td></tr>
    </table>
    <p>Thêm <code>#[serde(other)]</code> trên một unit variant <code>Unknown</code> để event type mới từ producer không làm consumer Kafka chết (chỉ đặt được trên unit variant của enum internally hoặc adjacently tagged).</p>

    <p><strong>3. flatten & tuỳ biến</strong></p>
    <ul>
      <li><code>#[serde(flatten)]</code>: nhúng field của struct con vào cùng cấp (≈ <code>@JsonUnwrapped</code>); <code>flatten</code> vào <code>HashMap&lt;String, Value&gt;</code> để giữ mọi field lạ. Có chi phí (buffer trung gian) và không đi cùng <code>deny_unknown_fields</code>.</li>
      <li><code>#[serde(with = "module")]</code> dùng hàm serialize/deserialize riêng cho một field — vd thời gian dạng epoch millis, số tiền dạng chuỗi. Crate <code>serde_with</code> có sẵn nhiều: <code>DisplayFromStr</code>, <code>TimestampMilliSeconds</code>, <code>base64</code>...</li>
      <li><code>#[serde(try_from = "String")]</code>: deserialize qua kiểu trung gian rồi validate — kết hợp newtype <code>Email</code> ở bài 02: JSON sai định dạng bị từ chối ngay ở tầng parse.</li>
    </ul>

    <p><strong>4. Zero-copy</strong>: struct chứa <code>&amp;'a str</code> mượn thẳng từ buffer đầu vào, không cấp phát. Chỉ hoạt động khi chuỗi không có ký tự escape;
    dùng <code>Cow&lt;'a, str&gt;</code> + <code>#[serde(borrow)]</code> để mượn khi được, cấp phát khi phải unescape. Có ích khi parse hàng triệu message Kafka/giây trước khi insert ClickHouse.</p>
    <div class="callout"><p>💡 Số lớn: JavaScript chỉ giữ chính xác số nguyên tới 2^53. ID <code>i64</code> (snowflake) gửi cho app React Native/web nên serialize thành chuỗi
    (<code>#[serde_as(as = "DisplayFromStr")]</code>) — lỗi này không báo gì, chỉ lặng lẽ làm sai ID.</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "① Tên & mặc định", lines: [
      "#[derive(Debug, Serialize, Deserialize)]",
      "#[serde(rename_all = \"camelCase\")]",
      "pub struct CreateOrder {",
      "    pub customer_id: i64,                       // JSON: customerId",
      "    #[serde(rename = \"type\")]",
      "    pub kind: OrderKind,",
      "    #[serde(default)]                           // thiếu -> Vec rỗng",
      "    pub items: Vec<Item>,",
      "    #[serde(default = \"default_currency\")]",
      "    pub currency: String,",
      "    #[serde(skip_serializing_if = \"Option::is_none\")]",
      "    pub note: Option<String>,                   // thiếu -> None",
      "}",
      "fn default_currency() -> String { \"VND\".into() }"
    ]},
    { id: "enum", label: "② Enum tagging", lines: [
      "#[derive(Serialize, Deserialize)]",
      "#[serde(tag = \"type\", rename_all = \"SCREAMING_SNAKE_CASE\")]",
      "pub enum OrderEvent {",
      "    Created { order_id: i64, total: i64 },",
      "    Paid { order_id: i64, amount: i64 },",
      "    Cancelled { order_id: i64, reason: String },",
      "    #[serde(other)]",
      "    Unknown,                                   // type lạ -> không crash consumer",
      "}",
      "// {\"type\":\"PAID\",\"order_id\":42,\"amount\":99000}",
      "",
      "match serde_json::from_slice::<OrderEvent>(&msg.payload)? {",
      "    OrderEvent::Paid { order_id, amount } => record(order_id, amount).await?,",
      "    OrderEvent::Unknown => tracing::debug!(\"skip unknown event\"),",
      "    _ => {}",
      "}"
    ]},
    { id: "with", label: "③ flatten & with", lines: [
      "#[serde_with::serde_as]",
      "#[derive(Serialize, Deserialize)]",
      "pub struct OrderDto {",
      "    #[serde_as(as = \"serde_with::DisplayFromStr\")]",
      "    pub id: i64,                                 // \"id\": \"7301234567890123456\"",
      "    #[serde(with = \"time::serde::rfc3339\")]",
      "    pub created_at: time::OffsetDateTime,",
      "    #[serde(flatten)]",
      "    pub audit: Audit,                            // created_by... cùng cấp",
      "    #[serde(flatten)]",
      "    pub extra: HashMap<String, serde_json::Value>, // giữ field lạ",
      "}",
      "",
      "#[derive(Deserialize)]",
      "#[serde(try_from = \"String\")]",
      "pub struct Email(String);",
      "impl TryFrom<String> for Email { type Error = String; fn try_from(s: String) -> Result<Self, String> { /* validate */ } }"
    ]},
    { id: "zc", label: "④ Zero-copy", lines: [
      "#[derive(Deserialize)]",
      "pub struct ClickEvent<'a> {",
      "    pub user_id: u64,",
      "    #[serde(borrow)]",
      "    pub url: Cow<'a, str>,        // mượn nếu không có escape, else cấp phát",
      "    pub ts: i64,",
      "}",
      "",
      "for msg in batch {",
      "    let ev: ClickEvent = serde_json::from_slice(msg.payload())?;   // mượn từ payload",
      "    writer.write(&ev)?;                                            // ghi ClickHouse",
      "}   // ev không sống quá msg -> lifetime đảm bảo an toàn"
    ]},
    { id: "java", label: "⑤ Đối chiếu Jackson", lines: [
      "@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)",
      "@JsonInclude(JsonInclude.Include.NON_NULL)          // ~ skip_serializing_if",
      "@JsonIgnoreProperties(ignoreUnknown = false)        // ~ deny_unknown_fields",
      "@JsonTypeInfo(use = Id.NAME, property = \"type\")    // ~ tag = \"type\"",
      "@JsonSubTypes({ @Type(value = Paid.class, name = \"PAID\") })",
      "record Paid(long orderId, long amount) implements OrderEvent {}",
      "",
      "// Jackson: reflection lúc chạy, mặc định FAIL_ON_UNKNOWN_PROPERTIES = true",
      "// serde:   code sinh lúc biên dịch, mặc định bỏ qua field lạ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="json"><div class="nl">📥 Bytes JSON / Kafka</div><div class="ns">{\"type\":\"PAID\",\"order_id\":42,...}</div></div>
    <div class="arrow" id="a1">↓ code sinh lúc biên dịch (không reflection)</div>
    <div class="node" id="attr"><div class="nl">🏷️ Attribute</div><div class="ns">rename · default · tag · flatten · with</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ Kiểu Rust hợp lệ</div><div class="ns">enum OrderEvent::Paid</div></div>
      <div class="node" id="bad"><div class="nl">⛔ Lỗi parse</div><div class="ns">missing field · try_from thất bại</div></div>
    </div>
    <div class="arrow" id="a2">↓ #[serde(borrow)]</div>
    <div class="node" id="zc"><div class="nl">🪶 Zero-copy</div><div class="ns">&amp;str/Cow trỏ vào buffer gốc</div></div>
  `,
  steps: [
    { title: "1 · Tên & giá trị thiếu", tab: "basic", highlight: [2, 5, 7, 9, 11, 12], on: ["json", "a1", "attr"],
      desc: "camelCase cho API, rename cho từ khoá, default cho field tuỳ chọn, bỏ null khi serialize." },
    { title: "2 · Enum có tag", tab: "enum", highlight: [2, 4, 5, 6, 10], on: ["attr", "ok"],
      desc: "Internally tagged: trường <code>type</code> quyết định variant — giống @JsonTypeInfo nhưng match vét cạn ở phía xử lý." },
    { title: "3 · Không chết vì event mới", tab: "enum", highlight: [7, 8, 14], on: ["ok"],
      desc: "<code>#[serde(other)]</code> hứng type chưa biết. Consumer cũ không crash khi producer thêm event." },
    { title: "4 · ID lớn, thời gian, flatten", tab: "with", highlight: [4, 5, 6, 8, 10, 11], on: ["attr"],
      desc: "i64 thành chuỗi để JS không làm tròn; RFC 3339 cho thời gian; flatten gộp/giữ field." },
    { title: "5 · Validate ngay khi parse", tab: "with", highlight: [15, 16, 17], on: ["bad"],
      desc: "try_from: JSON có email sai → lỗi deserialize → axum Json extractor trả 422, handler không bao giờ thấy Email sai." },
    { title: "6 · Zero-copy cho throughput cao", tab: "zc", highlight: [2, 4, 5, 10], on: ["a2", "zc"],
      desc: "Cow mượn từ payload khi được. Lifetime đảm bảo event không sống quá buffer." }
  ],

  quiz: [
    { q: "Mặc định serde xử lý field lạ trong JSON thế nào?", options: [
        "Báo lỗi", "Bỏ qua", "Lưu vào map", "Panic"
      ], correct: 1, explanation: "Ngược với mặc định của Jackson; bật deny_unknown_fields để chặt." },
    { q: "Field Option<String> thiếu trong JSON thì?", options: [
        "Lỗi missing field", "Thành None", "Thành chuỗi rỗng", "Panic"
      ], correct: 1, explanation: "Field không phải Option cần #[serde(default)] nếu muốn cho phép thiếu." },
    { q: "#[serde(tag = \"type\")] trên enum cho JSON dạng nào?", options: [
        "{\"Paid\": {...}}",
        "{\"type\": \"Paid\", ...các field...}",
        "[\"Paid\", {...}]",
        "{\"t\":..., \"c\":...}"
      ], correct: 1, explanation: "Internally tagged." },
    { q: "Vì sao nên cẩn thận với #[serde(untagged)]?", options: [
        "Không tồn tại",
        "serde thử lần lượt từng variant: chậm hơn và thông báo lỗi mơ hồ",
        "Không hỗ trợ JSON",
        "Mất dữ liệu"
      ], correct: 1, explanation: "Chỉ dùng khi định dạng không có tag." },
    { q: "Consumer Kafka không muốn crash khi producer thêm loại event mới. Dùng gì?", options: [
        "deny_unknown_fields",
        "Variant Unknown với #[serde(other)]",
        "flatten",
        "rename_all"
      ], correct: 1, explanation: "Hứng mọi tag chưa biết." },
    { q: "Gửi ID i64 (snowflake) cho client JavaScript nên?", options: [
        "Gửi số bình thường",
        "Serialize thành chuỗi, vì JS number chỉ chính xác tới 2^53",
        "Chia đôi",
        "Dùng float"
      ], correct: 1, explanation: "Lỗi âm thầm: ID bị làm tròn." },
    { q: "#[serde(flatten)] tương đương annotation nào của Jackson?", options: [
        "@JsonIgnore", "@JsonUnwrapped", "@JsonValue", "@JsonCreator"
      ], correct: 1, explanation: "Có thể flatten vào HashMap để giữ field lạ." },
    { q: "Cow<'a, str> với #[serde(borrow)] có lợi gì?", options: [
        "Mã hoá chuỗi",
        "Mượn trực tiếp từ buffer khi không có escape (không cấp phát), tự cấp phát khi cần unescape",
        "Luôn cấp phát",
        "Nén chuỗi"
      ], correct: 1, explanation: "&str thuần sẽ lỗi khi chuỗi có ký tự escape." },
    { q: "Vì sao serde nhanh hơn Jackson dựa reflection?", options: [
        "Dùng GPU",
        "Code (de)serialize được sinh lúc biên dịch cho từng kiểu cụ thể",
        "Không kiểm tra lỗi",
        "Chỉ hỗ trợ JSON"
      ], correct: 1, explanation: "Không có tra cứu field/method lúc chạy." },
    { q: "#[serde(try_from = \"String\")] trên newtype Email giúp gì?", options: [
        "Đổi tên field",
        "Deserialize qua String rồi gọi TryFrom để validate; dữ liệu sai bị từ chối ngay khi parse",
        "Mã hoá email",
        "Bỏ qua field"
      ], correct: 1, explanation: "Parse, don't validate — tới handler thì Email chắc chắn hợp lệ." }
  ]
});
