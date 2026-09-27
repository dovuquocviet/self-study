window.LESSONS.push({
  id: "23",
  phase: "5", phaseName: "Case study",
  title: "Case study 4: Pipeline sự kiện mobile → Kafka → ClickHouse",
  subtitle: "SDK gom lô & offline · ingest ở edge · Rust ingest → Kafka · bảng thô + materialized view tổng hợp · TTL & quyền riêng tư",

  theory: `
    <p>Đội sản phẩm muốn biết: funnel xem sản phẩm → thêm giỏ → thanh toán, tỉ lệ crash theo phiên bản app, hiệu quả chiến dịch push. Đây là bài toán <em>ghi rất nhiều, đọc tổng hợp</em>
    — đúng chỗ bài 01 đã chỉ ra cần Kafka + ClickHouse.</p>

    <p><strong>Con số</strong> (từ bài 01): 1 triệu DAU × 200 sự kiện = 2 × 10<sup>8</sup>/ngày ≈ 2 000/s trung bình, đỉnh ~10 000/s; ~300 B/sự kiện → ~60 GB/ngày thô;
    ClickHouse nén cột thường còn một phần nhỏ.</p>

    <p><strong>1. SDK trên app</strong> (RN hiện tại, Kotlin/Swift sau này — cùng hợp đồng)</p>
    <ul>
      <li>Ghi sự kiện vào hàng đợi cục bộ (SQLite/file), <strong>gửi theo lô</strong> (vd 50 sự kiện hoặc 30 s, hoặc khi app vào nền) — tiết kiệm pin và radio.</li>
      <li>Mỗi sự kiện có <code>event_id</code> (UUID sinh trên máy) để khử trùng khi gửi lại; <code>client_ts</code> (đồng hồ máy có thể sai) + server gắn <code>server_ts</code>.</li>
      <li>Offline: giữ lại, gửi khi có mạng; giới hạn kích thước hàng đợi để không đầy bộ nhớ máy.</li>
    </ul>

    <p><strong>2. Ingest</strong>: endpoint ở edge (Worker) nhận lô nén gzip, kiểm khoá app/JWT, rate limit theo installation, kiểm schema cơ bản, gắn quốc gia từ <code>req.cf</code>,
    rồi chuyển về <strong>ingest-service Rust</strong> đẩy vào Kafka (trả <code>202 Accepted</code> ngay khi Kafka đã nhận). Có thể đệm bằng Cloudflare Queues giữa hai bước để chịu được origin chập chờn.</p>

    <p><strong>3. Kafka</strong>: topic <code>events.raw.v1</code>, nhiều partition (vd 48), key = installation_id (giữ thứ tự theo máy cho phân tích phiên), retention vài ngày để replay khi ClickHouse lỗi.</p>

    <p><strong>4. ClickHouse</strong></p>
    <ul>
      <li>Kafka engine → materialized view → bảng thô <code>MergeTree</code>, <code>PARTITION BY toYYYYMM</code>, <code>ORDER BY (event_name, event_date, installation_id)</code> — sắp theo cách truy vấn lọc.</li>
      <li>ClickHouse thích <strong>insert lô lớn, ít lần</strong>; hàng nghìn insert nhỏ mỗi giây tạo quá nhiều part ("too many parts"). Kafka engine tự gom lô — đừng tự INSERT từng dòng.</li>
      <li><strong>Bảng tổng hợp</strong> bằng MV thứ hai vào <code>AggregatingMergeTree</code>/<code>SummingMergeTree</code> (vd số người dùng duy nhất theo ngày theo sự kiện) → dashboard đọc bảng nhỏ, không quét bảng thô.</li>
      <li><strong>TTL</strong>: xoá dữ liệu thô sau 180 ngày, giữ bảng tổng hợp lâu hơn.</li>
      <li>Trùng lặp do gửi lại: chấp nhận sai số nhỏ cho số liệu xu hướng, hoặc dùng <code>uniqExact(event_id)</code>/ReplacingMergeTree cho chỉ số cần chính xác.</li>
    </ul>

    <p><strong>Quyền riêng tư</strong>: không gửi PII (email, SĐT, địa chỉ) trong thuộc tính sự kiện; dùng id ẩn danh; tôn trọng đồng ý theo dõi (ATT trên iOS, consent); có quy trình xoá dữ liệu theo yêu cầu người dùng.</p>

    <div class="callout"><p>💡 Thiết kế này không chạm bất kỳ DB nghiệp vụ nào. Nếu ClickHouse chết 2 giờ, app vẫn gửi được, Kafka giữ dữ liệu, ClickHouse đọc tiếp từ offset cũ khi sống lại —
    đó là lợi ích của việc để Kafka làm "bộ giảm xóc" giữa nguồn ghi dồn dập và kho phân tích.</p></div>
  `,

  codeTabs: [
    { id: "sdk", label: "① SDK gom lô (Kotlin)", lines: [
      "data class Event(val eventId: String = UUID.randomUUID().toString(), val name: String,",
      "                 val clientTs: Long = System.currentTimeMillis(), val props: Map<String, String>)",
      "",
      "class Tracker(private val queue: EventDao, private val api: IngestApi) {",
      "    fun track(name: String, props: Map<String, String> = emptyMap()) =",
      "        queue.insert(Event(name = name, props = props))          // ghi đĩa trước, không mất khi app bị kill",
      "",
      "    suspend fun flush() {                                         // mỗi 30 s / 50 event / khi vào nền",
      "        val batch = queue.peek(limit = 50).ifEmpty { return }",
      "        if (api.send(batch).isSuccess) queue.delete(batch.map { it.eventId })",
      "        // lỗi mạng: giữ nguyên, lần sau gửi lại -> server khử trùng bằng eventId",
      "    }",
      "}"
    ]},
    { id: "edge", label: "② Worker ingest", lines: [
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const inst = req.headers.get('x-installation-id');",
      "    const { success } = await env.EVENTS_LIMITER.limit({ key: inst ?? 'anon' });",
      "    if (!success) return new Response(null, { status: 429, headers: { 'Retry-After': '60' } });",
      "    const events = await new Response(req.body.pipeThrough(new DecompressionStream('gzip'))).json();",
      "    if (!Array.isArray(events) || events.length > 100) return new Response(null, { status: 400 });",
      "    const enriched = events.map(e => ({ ...e, installation_id: inst,",
      "      server_ts: Date.now(), country: req.cf?.country ?? 'XX' }));",
      "    await env.EVENTS_Q.sendBatch(enriched.map(body => ({ body })));   // đệm bằng Queues",
      "    return new Response(null, { status: 202 });",
      "  }",
      "};"
    ]},
    { id: "ingest", label: "③ Rust ingest → Kafka", lines: [
      "async fn ingest(State(st): State<AppState>, Json(batch): Json<Vec<RawEvent>>) -> StatusCode {",
      "    let sends = batch.iter().map(|e| {",
      "        let payload = serde_json::to_vec(e).unwrap();",
      "        let key = e.installation_id.clone();",
      "        let p = st.producer.clone();",
      "        async move {",
      "            p.send(FutureRecord::to(\"events.raw.v1\").key(&key).payload(&payload),",
      "                   Duration::from_secs(5)).await",
      "        }",
      "    });",
      "    match futures::future::try_join_all(sends).await {",
      "        Ok(_)  => StatusCode::ACCEPTED,              // Kafka đã nhận (acks=all)",
      "        Err(_) => StatusCode::SERVICE_UNAVAILABLE,   // phía trên sẽ retry",
      "    }",
      "}",
      "// producer: linger.ms=20, compression.type=zstd, batch lớn -> thông lượng cao"
    ]},
    { id: "ch", label: "④ ClickHouse bảng thô", lines: [
      "CREATE TABLE events_raw (",
      "  event_id        UUID,",
      "  event_name      LowCardinality(String),",
      "  installation_id String,",
      "  app_version     LowCardinality(String),",
      "  country         LowCardinality(FixedString(2)),",
      "  props           Map(String, String),",
      "  client_ts       DateTime64(3),",
      "  server_ts       DateTime64(3),",
      "  event_date      Date MATERIALIZED toDate(server_ts)",
      ") ENGINE = MergeTree",
      "PARTITION BY toYYYYMM(server_ts)",
      "ORDER BY (event_name, event_date, installation_id)",
      "TTL toDateTime(server_ts) + INTERVAL 180 DAY;",
      "-- nạp qua Kafka engine + MV như bài 15 (gom lô tự động, tránh 'too many parts')"
    ]},
    { id: "agg", label: "⑤ Bảng tổng hợp & funnel", lines: [
      "CREATE TABLE daily_event_users (",
      "  event_date Date, event_name LowCardinality(String),",
      "  users AggregateFunction(uniq, String)",
      ") ENGINE = AggregatingMergeTree ORDER BY (event_date, event_name);",
      "",
      "CREATE MATERIALIZED VIEW daily_event_users_mv TO daily_event_users AS",
      "SELECT toDate(server_ts) AS event_date, event_name, uniqState(installation_id) AS users",
      "FROM events_raw GROUP BY event_date, event_name;",
      "",
      "SELECT event_date, event_name, uniqMerge(users) FROM daily_event_users",
      "WHERE event_date >= today() - 30 GROUP BY event_date, event_name;",
      "",
      "-- funnel 3 bước trong 1 giờ",
      "SELECT level, count() FROM (",
      "  SELECT installation_id, windowFunnel(3600)(toDateTime(server_ts),",
      "    event_name = 'view_product', event_name = 'add_to_cart', event_name = 'checkout') AS level",
      "  FROM events_raw WHERE event_date = today() GROUP BY installation_id",
      ") GROUP BY level ORDER BY level;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="sdk"><div class="nl">📱 SDK</div><div class="ns">hàng đợi đĩa · lô 50 · event_id</div></div>
    <div class="arrow" id="a1">↓ gzip, HTTPS</div>
    <div class="node" id="edge"><div class="nl">☁️ Worker ingest</div><div class="ns">rate limit · validate · enrich · Queues</div></div>
    <div class="node" id="rs"><div class="nl">🦀 ingest-service</div><div class="ns">202 khi Kafka đã nhận</div></div>
    <div class="node" id="k"><div class="nl">📨 events.raw.v1</div><div class="ns">48 partition · key installation</div></div>
    <div class="arrow" id="a2">↓ Kafka engine + MV</div>
    <div class="row">
      <div class="node" id="raw"><div class="nl">📊 events_raw</div><div class="ns">MergeTree · TTL 180 ngày</div></div>
      <div class="node" id="agg"><div class="nl">📈 bảng tổng hợp</div><div class="ns">AggregatingMergeTree</div></div>
    </div>
  `,
  steps: [
    { title: "1 · SDK: ghi đĩa trước, gửi lô", tab: "sdk", highlight: [1, 6, 9, 10, 11], on: ["sdk"],
      desc: "Không mất sự kiện khi app bị kill; lỗi mạng thì gửi lại lô cũ, event_id giúp khử trùng." },
    { title: "2 · Edge: chặn rác trước khi tốn tiền", tab: "edge", highlight: [4, 5, 7, 8, 9, 10, 11], on: ["a1", "edge"],
      desc: "Rate limit theo installation, giới hạn kích thước lô, gắn server_ts/country, đệm vào Queue, trả 202." },
    { title: "3 · Ingest Rust đẩy Kafka", tab: "ingest", highlight: [4, 7, 11, 12, 13, 16], on: ["rs", "k"],
      desc: "Key theo installation; chỉ trả 202 khi Kafka xác nhận; producer gom lô + nén cho thông lượng." },
    { title: "4 · Bảng thô sắp theo truy vấn", tab: "ch", highlight: [3, 7, 12, 13, 14], on: ["a2", "raw"],
      desc: "ORDER BY theo cách lọc; LowCardinality cho cột ít giá trị; TTL tự xoá dữ liệu cũ." },
    { title: "5 · Dashboard đọc bảng tổng hợp", tab: "agg", highlight: [3, 4, 7, 10], on: ["agg"],
      desc: "MV tính trạng thái uniq theo ngày lúc ghi; dashboard gộp trạng thái thay vì quét tỷ dòng." },
    { title: "6 · Funnel ngay trên dữ liệu thô", tab: "agg", highlight: [15, 16], on: ["raw"],
      desc: "windowFunnel đếm mỗi installation đi được tới bước nào trong cửa sổ 1 giờ." }
  ],

  quiz: [
    { q: "Vì sao SDK gửi sự kiện theo lô thay vì từng cái?", options: [
        "Server yêu cầu",
        "Tiết kiệm pin/radio và số request; hợp với mạng di động chập chờn",
        "Để mất ít dữ liệu hơn",
        "Bắt buộc bởi Kafka"
      ], correct: 1, explanation: "Mỗi lần bật radio tốn năng lượng." },
    { q: "Vì sao cần cả client_ts và server_ts?", options: [
        "Không cần",
        "client_ts phản ánh thời điểm thật trên máy nhưng đồng hồ máy có thể sai; server_ts đáng tin để phân vùng",
        "Để tăng kích thước",
        "Để mã hoá"
      ], correct: 1, explanation: "Sự kiện offline có thể đến trễ hàng giờ." },
    { q: "Hàng nghìn INSERT nhỏ mỗi giây vào ClickHouse gây gì?", options: [
        "Nhanh hơn",
        "Quá nhiều part, merge không kịp, lỗi 'too many parts'",
        "Không sao",
        "Mất dữ liệu ngay"
      ], correct: 1, explanation: "ClickHouse thích lô lớn; Kafka engine tự gom." },
    { q: "Ingest nên trả 202 khi nào?", options: [
        "Ngay khi nhận, trước khi làm gì",
        "Khi Kafka đã xác nhận nhận message (acks=all)",
        "Khi ClickHouse đã ghi",
        "Khi dashboard cập nhật"
      ], correct: 1, explanation: "Sau đó Kafka giữ bền, ClickHouse đọc theo nhịp của nó." },
    { q: "Lợi ích của bảng AggregatingMergeTree cho dashboard?", options: [
        "Lưu dữ liệu thô",
        "Dashboard đọc bảng nhỏ đã tổng hợp sẵn lúc ghi, không quét bảng thô",
        "Không cần MV",
        "Chống trùng tuyệt đối"
      ], correct: 1, explanation: "uniqState lúc ghi, uniqMerge lúc đọc." },
    { q: "ClickHouse chết 2 giờ. Dữ liệu sự kiện?", options: [
        "Mất 2 giờ",
        "Kafka giữ theo retention; ClickHouse đọc tiếp từ offset đã commit khi sống lại",
        "App phải gửi lại",
        "Ghi vào Postgres"
      ], correct: 1, explanation: "Kafka là bộ giảm xóc." },
    { q: "Thuộc tính sự kiện nào KHÔNG nên gửi?", options: [
        "Tên màn hình", "Phiên bản app", "Số điện thoại/email người dùng", "SKU đã xem"
      ], correct: 2, explanation: "PII không nên vào kho phân tích; dùng id ẩn danh." },
    { q: "Vì sao chọn installation_id làm Kafka key?", options: [
        "Ngẫu nhiên",
        "Giữ thứ tự sự kiện của một máy trong một partition, phân bố đều",
        "Để nén tốt",
        "Kafka yêu cầu"
      ], correct: 1, explanation: "Hợp cho phân tích phiên." },
    { q: "Điều khoản TTL trên bảng thô dùng để?", options: [
        "Tăng tốc insert",
        "Tự xoá dữ liệu thô quá hạn (vd 180 ngày) để kiểm soát chi phí và tuân thủ",
        "Đặt timeout truy vấn",
        "Khử trùng"
      ], correct: 1, explanation: "Bảng tổng hợp có thể giữ lâu hơn." }
  ]
});
