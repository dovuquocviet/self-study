window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Service production",
  title: "tracing & OpenTelemetry: log có cấu trúc, span, trace phân tán",
  subtitle: "event vs span · #[instrument] · subscriber + layer + EnvFilter · JSON log · TraceLayer cho HTTP · OTLP exporter · lan truyền traceparent",

  theory: `
    <p>Trong Java bạn có SLF4J + Logback + MDC + Micrometer Tracing/OTel agent. Rust tách tương tự nhưng rõ hơn: crate <code>tracing</code> là <strong>API</strong> (như SLF4J),
    <code>tracing-subscriber</code> là <strong>backend</strong> (như Logback), <code>tracing-opentelemetry</code> là cầu nối sang OpenTelemetry. Không có java agent tự gắn — mọi thứ cấu hình tường minh trong <code>main</code>.</p>

    <p><strong>1. Event và Span</strong></p>
    <ul>
      <li><strong>Event</strong> = một dòng log tại một thời điểm: <code>info!(order_id, amount = 99, "paid")</code>. Field là key-value có kiểu, không phải chuỗi ghép.</li>
      <li><strong>Span</strong> = một khoảng thời gian có tên và field (xử lý request, một query). Event bên trong span tự mang field của span — thay MDC nhưng đúng cả với async
        (MDC dựa ThreadLocal sẽ sai khi task nhảy thread; span của tracing đi theo future).</li>
      <li><code>#[tracing::instrument]</code> bọc hàm trong span, tự ghi tham số làm field. Dùng <code>skip(pool, password)</code> để bỏ tham số lớn hoặc nhạy cảm; <code>err</code> để ghi lỗi trả về.</li>
      <li>Cú pháp field: <code>user_id</code> (lấy biến cùng tên), <code>%e</code> (dùng Display), <code>?req</code> (dùng Debug).</li>
      <li>Với future tự spawn: <code>tokio::spawn(fut.instrument(span))</code> hoặc <code>.in_current_span()</code> — nếu không, task mới mất span cha.</li>
    </ul>

    <p><strong>2. Subscriber = Registry + các Layer</strong></p>
    <ul>
      <li><code>EnvFilter</code>: lọc theo biến <code>RUST_LOG=info,sqlx=warn,order_svc=debug</code> (như <code>logging.level.*</code> của Spring).</li>
      <li><code>fmt::layer().json()</code>: log JSON một dòng cho Loki/Elasticsearch; <code>.pretty()</code> khi dev.</li>
      <li><code>tracing_opentelemetry::layer()</code>: chuyển span thành OTel span, xuất qua OTLP tới Collector → Jaeger/Tempo/Datadog.</li>
    </ul>

    <p><strong>3. Trace phân tán</strong>: service A gọi B qua HTTP phải gửi header W3C <code>traceparent</code> (<code>00-&lt;trace-id 32 hex&gt;-&lt;span-id 16 hex&gt;-01</code>).
    Phía nhận: middleware đọc header, đặt làm parent của span request. Phía gửi: inject context hiện tại vào header (reqwest-tracing hoặc tự gọi propagator).
    Với Kafka, <code>traceparent</code> đi trong header của message — nhờ vậy trace nối được từ API qua consumer tới ClickHouse insert.</p>

    <p><strong>4. Chi phí</strong>: macro kiểm tra level trước khi tạo field → log bị lọc gần như miễn phí. OTel nên dùng <em>batch exporter</em> + lấy mẫu (sampling) ở tải cao.
    Nhớ <code>provider.shutdown()</code> khi tắt để flush span cuối.</p>
    <div class="callout"><p>💡 Quy ước tốt: mỗi request một span với <code>method</code>, <code>route</code>, <code>request_id</code>, <code>trace_id</code>; log lỗi kèm <code>trace_id</code> và trả <code>trace_id</code> trong response 5xx —
    support nhận ticket là tra được đúng trace. Không bao giờ ghi password/token vào field (dùng <code>skip</code>).</p></div>
  `,

  codeTabs: [
    { id: "events", label: "① Event & span", lines: [
      "use tracing::{info, warn, instrument};",
      "",
      "#[instrument(skip(pool), fields(order_id = id), err)]",
      "async fn pay(pool: &PgPool, id: i64, amount: u64) -> anyhow::Result<()> {",
      "    info!(amount, \"start payment\");            // field có kiểu, không ghép chuỗi",
      "    let res = gateway::charge(id, amount).await;",
      "    if let Err(e) = &res {",
      "        warn!(error = %e, retryable = true, \"gateway failed\");",
      "    }",
      "    res",
      "}",
      "// JSON: {\"level\":\"INFO\",\"fields\":{\"message\":\"start payment\",\"amount\":99},",
      "//        \"span\":{\"name\":\"pay\",\"order_id\":42}, ...}"
    ]},
    { id: "sub", label: "② Subscriber", lines: [
      "use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};",
      "",
      "fn init_telemetry() -> SdkTracerProvider {",
      "    let provider = otel_provider();                 // tab ③",
      "    let tracer = provider.tracer(\"order-svc\");",
      "    tracing_subscriber::registry()",
      "        .with(EnvFilter::try_from_default_env()",
      "              .unwrap_or_else(|_| EnvFilter::new(\"info,sqlx=warn\")))",
      "        .with(tracing_subscriber::fmt::layer().json())",
      "        .with(tracing_opentelemetry::layer().with_tracer(tracer))",
      "        .init();",
      "    provider                                        // giữ để shutdown() khi tắt",
      "}"
    ]},
    { id: "otel", label: "③ OTLP exporter", lines: [
      "use opentelemetry::trace::TracerProvider as _;",
      "use opentelemetry_sdk::{trace::SdkTracerProvider, Resource};",
      "",
      "fn otel_provider() -> SdkTracerProvider {",
      "    let exporter = opentelemetry_otlp::SpanExporter::builder()",
      "        .with_tonic()                    // gRPC tới OTel Collector :4317",
      "        .build()",
      "        .expect(\"otlp exporter\");",
      "    SdkTracerProvider::builder()",
      "        .with_batch_exporter(exporter)   // gom lô, không chặn request",
      "        .with_resource(Resource::builder().with_service_name(\"order-svc\").build())",
      "        .build()",
      "}",
      "# Endpoint đọc từ env: OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317"
    ]},
    { id: "http", label: "④ HTTP & spawn", lines: [
      "use tower_http::trace::TraceLayer;",
      "",
      "let app = Router::new()",
      "    .route(\"/orders/{id}/pay\", post(pay_order))",
      "    .layer(TraceLayer::new_for_http());     // span cho mỗi request + log status/latency",
      "",
      "// Task nền phải mang span theo, nếu không sẽ mất ngữ cảnh",
      "use tracing::Instrument;",
      "tokio::spawn(",
      "    send_receipt(order_id).instrument(tracing::info_span!(\"receipt\", order_id))",
      ");",
      "",
      "// Header giữa các service (W3C Trace Context):",
      "// traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "private static final Logger log = LoggerFactory.getLogger(PayService.class);",
      "MDC.put(\"orderId\", id);                 // ThreadLocal: lệch khi đổi thread",
      "log.info(\"start payment amount={}\", amount);",
      "",
      "@Observed(name = \"pay\")                 // Micrometer ~ #[instrument]",
      "",
      "# application.yml",
      "logging.level.org.hibernate.SQL: warn  # ~ RUST_LOG=sqlx=warn",
      "# java -javaagent:opentelemetry-javaagent.jar  -> Rust: cấu hình tay trong main"
    ]}
  ],

  stageHtml: `
    <div class="node" id="code"><div class="nl">🧩 Code: info!, #[instrument]</div><div class="ns">crate tracing = API</div></div>
    <div class="arrow" id="a1">↓ event + span</div>
    <div class="node" id="reg"><div class="nl">🗂️ Registry + EnvFilter</div><div class="ns">RUST_LOG=info,sqlx=warn</div></div>
    <div class="row">
      <div class="node" id="fmt"><div class="nl">📄 fmt().json()</div><div class="ns">stdout → Loki / ES</div></div>
      <div class="node" id="ot"><div class="nl">🛰️ OpenTelemetry layer</div><div class="ns">batch → OTLP :4317</div></div>
    </div>
    <div class="arrow" id="a2">↓ traceparent qua HTTP / Kafka header</div>
    <div class="node" id="col"><div class="nl">📊 Collector → Jaeger/Tempo</div><div class="ns">một trace xuyên nhiều service</div></div>
  `,
  steps: [
    { title: "1 · Event có field", tab: "events", highlight: [5, 8, 12, 13], on: ["code"],
      desc: "Field có kiểu → tìm kiếm được trong Loki/ES (<code>amount &gt; 50</code>), không phải regex trên chuỗi." },
    { title: "2 · Span từ #[instrument]", tab: "events", highlight: [3, 4], on: ["code", "a1"],
      desc: "<code>skip(pool)</code> bỏ tham số không cần; <code>fields(order_id = id)</code> thêm field; <code>err</code> ghi lỗi trả về. Event bên trong tự mang order_id." },
    { title: "3 · Ghép subscriber", tab: "sub", highlight: [6, 7, 8, 9, 10, 11], on: ["reg", "fmt", "ot"],
      desc: "Mỗi layer một việc: lọc, in JSON, xuất OTel. Thứ tự with() không đổi ngữ nghĩa lọc toàn cục của EnvFilter." },
    { title: "4 · Exporter OTLP", tab: "otel", highlight: [5, 6, 10, 11, 14], on: ["ot"],
      desc: "Batch exporter gom span và gửi nền. service.name là thứ bạn thấy trong Jaeger." },
    { title: "5 · Span cho HTTP & task nền", tab: "http", highlight: [5, 9, 10, 14], on: ["a2", "col"],
      desc: "TraceLayer tạo span mỗi request. Task spawn phải <code>.instrument(span)</code>. traceparent nối trace giữa các service." },
    { title: "6 · Khác SLF4J/MDC", tab: "java", highlight: [2, 5, 9], on: ["reg"],
      desc: "MDC dựa ThreadLocal nên sai với async; span của tracing gắn vào future nên đi theo task dù đổi thread." }
  ],

  quiz: [
    { q: "Crate tracing đóng vai trò giống gì trong hệ Java?", options: [
        "Logback", "SLF4J (API), còn tracing-subscriber như Logback (backend)", "Log4Shell", "JUL"
      ], correct: 1, explanation: "Thư viện chỉ phụ thuộc tracing; binary chọn subscriber." },
    { q: "Vì sao MDC (ThreadLocal) không phù hợp với async Rust?", options: [
        "Rust không có thread",
        "Task có thể chuyển giữa các worker thread và nhiều task chia sẻ một thread; span tracing gắn vào future thay vì thread",
        "MDC quá chậm",
        "MDC không hỗ trợ JSON"
      ], correct: 1, explanation: "Trong Java async (WebFlux) cũng gặp vấn đề này." },
    { q: "#[instrument(skip(password))] để làm gì?", options: [
        "Bỏ qua kiểm tra mật khẩu",
        "Không ghi tham số password làm field của span",
        "Tăng tốc hàm",
        "Bỏ span"
      ], correct: 1, explanation: "Mặc định instrument ghi mọi tham số (Debug)." },
    { q: "warn!(error = %e, ...) — ký hiệu % nghĩa là?", options: [
        "Phần trăm", "Ghi field bằng Display", "Ghi bằng Debug", "Bỏ qua field"
      ], correct: 1, explanation: "? là Debug." },
    { q: "Task tạo bằng tokio::spawn mất span cha. Sửa?", options: [
        "Không sửa được",
        "fut.instrument(span) hoặc fut.in_current_span() trước khi spawn",
        "Dùng MDC",
        "Dùng thread_local!"
      ], correct: 1, explanation: "Trait tracing::Instrument." },
    { q: "Header chuẩn W3C để lan truyền trace giữa service là?", options: [
        "X-Request-Id", "traceparent", "X-B3-Sampled bắt buộc", "Authorization"
      ], correct: 1, explanation: "Định dạng 00-traceid-spanid-flags." },
    { q: "Muốn giảm log của sqlx xuống warn nhưng app ở debug. Đặt biến gì?", options: [
        "LOG_LEVEL=debug",
        "RUST_LOG=warn,order_svc=debug (hoặc info,sqlx=warn,order_svc=debug) cho EnvFilter",
        "SQLX_QUIET=1",
        "Sửa code sqlx"
      ], correct: 1, explanation: "EnvFilter đọc cú pháp directive theo target." },
    { q: "Vì sao dùng batch exporter thay vì simple exporter trong production?", options: [
        "Simple không gửi được",
        "Batch gom span và gửi ở nền, không chặn luồng xử lý request mỗi khi span kết thúc",
        "Batch rẻ hơn tiền",
        "Batch bắt buộc với gRPC"
      ], correct: 1, explanation: "Simple exporter gửi đồng bộ từng span — chỉ hợp để debug." },
    { q: "Quên gọi provider.shutdown() khi tắt service gây ra gì?", options: [
        "Không sao",
        "Các span còn trong buffer có thể không được gửi đi",
        "Process treo mãi",
        "Mất log stdout"
      ], correct: 1, explanation: "Gọi trong graceful shutdown." },
    { q: "Trace từ API qua Kafka tới consumer nối được nhờ?", options: [
        "Kafka tự làm",
        "Producer ghi traceparent vào header message; consumer đọc và đặt làm parent context",
        "Dùng cùng thread",
        "Không thể"
      ], correct: 1, explanation: "Lan truyền context qua mọi ranh giới: HTTP header, message header." }
  ]
});
