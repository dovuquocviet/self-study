window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Vận hành",
  title: "Observability: log, metric, trace xuyên service",
  subtitle: "3 tín hiệu · RED/USE · histogram & cardinality · W3C traceparent qua HTTP và Kafka · Rust tracing + OpenTelemetry",

  theory: `
    <p>Monolith lỗi: mở một file log, đọc stack trace. Microservice lỗi: request đi qua Worker → BFF → order → Kafka → notification; log nằm ở 5 nơi với 5 đồng hồ.
    Observability là khả năng trả lời <em>"chuyện gì đang xảy ra và vì sao"</em> từ bên ngoài, mà không phải deploy thêm code để debug.</p>

    <table>
      <tr><th>Tín hiệu</th><th>Trả lời</th><th>Lưu ý thiết kế</th></tr>
      <tr><td><strong>Metric</strong></td><td>Có vấn đề không? Bao nhiêu? (tổng hợp, rẻ, giữ lâu)</td><td>Counter/gauge/histogram; nhãn (label) có <em>cardinality thấp</em></td></tr>
      <tr><td><strong>Trace</strong></td><td>Chậm/lỗi ở khâu nào trên đường đi của một request?</td><td>Truyền ngữ cảnh qua mọi hop; lấy mẫu (sampling)</td></tr>
      <tr><td><strong>Log</strong></td><td>Chi tiết chuyện gì xảy ra ở một điểm</td><td>JSON có cấu trúc, kèm <code>trace_id</code> để nhảy từ trace sang log</td></tr>
    </table>

    <p><strong>Metric nào?</strong> Cho mỗi service/endpoint: <strong>RED</strong> — Rate (req/s), Errors (tỉ lệ lỗi), Duration (phân phối độ trễ). Cho tài nguyên (DB pool, CPU, Kafka consumer): <strong>USE</strong> — Utilization, Saturation, Errors.
    Độ trễ phải là <strong>histogram</strong> để tính p50/p95/p99; trung bình che mất đuôi chậm. Thêm metric nghiệp vụ: đơn/phút, tỉ lệ thanh toán thất bại, <strong>consumer lag</strong> của từng group Kafka.</p>
    <p><strong>Bẫy cardinality</strong>: nhãn <code>user_id</code> hay <code>order_id</code> trên metric tạo hàng triệu chuỗi thời gian → làm nổ Prometheus. Dùng <code>route</code> dạng mẫu (<code>/v1/orders/:id</code>), không dùng path thật.</p>

    <p><strong>Distributed tracing</strong>: chuẩn W3C Trace Context — header <code>traceparent: 00-&lt;trace-id 32 hex&gt;-&lt;span-id 16 hex&gt;-&lt;flags&gt;</code>. Mỗi hop đọc header, tạo span con, chuyển tiếp.
    Qua Kafka: đặt <code>traceparent</code> vào <strong>message header</strong> để consumer nối tiếp trace. OpenTelemetry (OTel) là chuẩn chung cho SDK và giao thức xuất (OTLP) → backend như Jaeger/Tempo/Grafana/Datadog.</p>

    <p><strong>Log có cấu trúc</strong>: một dòng JSON mỗi sự kiện với <code>level</code>, <code>service</code>, <code>trace_id</code>, <code>span_id</code>, khoá nghiệp vụ (<code>order_id</code>); không log PII/token.
    Log là loại tín hiệu đắt nhất khi volume lớn → log INFO có chọn lọc, lỗi đủ ngữ cảnh.</p>

    <div class="callout"><p>💡 Spring: Micrometer + Micrometer Tracing (trước là Sleuth) tự gắn traceId vào MDC. Rust: crate <code>tracing</code> (span + event có cấu trúc),
    <code>tracing-subscriber</code> xuất JSON, <code>tracing-opentelemetry</code> + <code>opentelemetry-otlp</code> gửi trace; metric qua OTel hoặc <code>metrics</code>/<code>prometheus</code>.
    Workers: Workers Logs/Observability trong dashboard, Tail Workers để chuyển log đi; nhớ tạo/chuyển tiếp <code>traceparent</code> khi <code>fetch</code> về origin.</p></div>
  `,

  codeTabs: [
    { id: "init", label: "① Rust tracing + OTel", lines: [
      "let exporter = opentelemetry_otlp::SpanExporter::builder().with_tonic().build()?;",
      "let provider = SdkTracerProvider::builder()",
      "    .with_batch_exporter(exporter)",
      "    .with_resource(Resource::builder().with_service_name(\"order-service\").build())",
      "    .build();",
      "global::set_text_map_propagator(TraceContextPropagator::new());   // W3C traceparent",
      "",
      "tracing_subscriber::registry()",
      "    .with(tracing_subscriber::fmt::layer().json())                // log JSON có trace_id",
      "    .with(tracing_opentelemetry::layer().with_tracer(provider.tracer(\"order\")))",
      "    .with(EnvFilter::from_default_env())",
      "    .init();"
    ]},
    { id: "span", label: "② Span & log trong handler", lines: [
      "#[tracing::instrument(skip(st, req), fields(customer_id = %user.id, order_id))]",
      "async fn create_order(st: State<AppState>, user: AuthUser, req: Json<OrderReq>) -> ApiResult {",
      "    let order = repo::insert(&st.db, &user, &req).await?;         // span con: db.insert",
      "    tracing::Span::current().record(\"order_id\", tracing::field::display(&order.id));",
      "    tracing::info!(total_minor = order.total_minor, \"order created\");",
      "    Ok(Json(order.into()))",
      "}",
      "",
      "// dòng log xuất ra:",
      "// {\"level\":\"INFO\",\"message\":\"order created\",\"total_minor\":125000,",
      "//  \"span\":{\"customer_id\":\"cus_12\",\"order_id\":\"ord_9\"},\"trace_id\":\"4bf92f35...\"}"
    ]},
    { id: "kafka", label: "③ Trace qua Kafka", lines: [
      "// producer: nhét ngữ cảnh hiện tại vào header message",
      "let mut carrier = HashMap::new();",
      "global::get_text_map_propagator(|p| p.inject_context(&Span::current().context(), &mut carrier));",
      "let headers = carrier.iter().fold(OwnedHeaders::new(), |h, (k, v)|",
      "    h.insert(Header { key: k, value: Some(v.as_str()) }));",
      "producer.send(FutureRecord::to(\"order.v1\").key(&id).payload(&json).headers(headers), t).await;",
      "",
      "// consumer: rút ngữ cảnh ra, span xử lý là con của span producer",
      "let parent = global::get_text_map_propagator(|p| p.extract(&KafkaHeaders(msg.headers())));",
      "let span = info_span!(\"handle OrderPlaced\");",
      "span.set_parent(parent);"
    ]},
    { id: "metric", label: "④ Metric RED + nghiệp vụ", lines: [
      "# Prometheus exposition",
      "http_server_request_duration_seconds_bucket{route=\"/v1/orders\",method=\"POST\",le=\"0.1\"} 9120",
      "http_server_request_duration_seconds_bucket{route=\"/v1/orders\",method=\"POST\",le=\"0.5\"} 9870",
      "http_server_requests_total{route=\"/v1/orders\",status=\"5xx\"} 12",
      "orders_created_total{channel=\"app_ios\"} 4512",
      "kafka_consumergroup_lag{group=\"notification-svc\",topic=\"order.v1\"} 35",
      "",
      "# SAI: nhãn cardinality cao",
      "http_requests_total{path=\"/v1/orders/ord_9f2\",user_id=\"cus_12\"}   # hàng triệu chuỗi",
      "",
      "# p99 (PromQL)",
      "histogram_quantile(0.99, sum by (le) (rate(http_server_request_duration_seconds_bucket[5m])))"
    ]},
    { id: "tp", label: "⑤ traceparent", lines: [
      "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      "             |  |                                |                |",
      "             |  trace-id (16 byte, chung cả hành trình)            flags (01 = sampled)",
      "             version                            parent span-id (8 byte, hop trước)",
      "",
      "Worker -> BFF -> order-service -> Kafka header -> notification-svc",
      "   cùng trace-id; mỗi hop một span-id mới"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="w"><div class="nl">☁️ Worker</div><div class="ns">tạo traceparent</div></div>
      <div class="node" id="o"><div class="nl">🦀 order</div><div class="ns">span + log JSON</div></div>
      <div class="node" id="k"><div class="nl">📨 Kafka</div><div class="ns">traceparent trong header</div></div>
      <div class="node" id="n"><div class="nl">🦀 notification</div><div class="ns">span con</div></div>
    </div>
    <div class="arrow" id="a1">↓ OTLP / scrape</div>
    <div class="row">
      <div class="node" id="tr"><div class="nl">🧵 Traces</div><div class="ns">chậm ở đâu?</div></div>
      <div class="node" id="me"><div class="nl">📈 Metrics</div><div class="ns">RED · lag · nghiệp vụ</div></div>
      <div class="node" id="lg"><div class="nl">📜 Logs</div><div class="ns">lọc theo trace_id</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Khởi tạo một lần", tab: "init", highlight: [1, 4, 6, 9, 10], on: ["o"],
      desc: "Một subscriber vừa xuất log JSON vừa gửi span qua OTLP; propagator W3C cho traceparent." },
    { title: "2 · instrument handler", tab: "span", highlight: [1, 4, 5, 10, 11], on: ["o", "lg"],
      desc: "Mỗi log tự mang trace_id và các field của span → từ trace nhảy sang đúng dòng log." },
    { title: "3 · Đọc traceparent", tab: "tp", highlight: [1, 3, 4, 6, 7], on: ["w"],
      desc: "trace-id chung cả hành trình; span-id là hop cha. Worker đầu tiên tạo, các hop sau chuyển tiếp." },
    { title: "4 · Không đứt trace ở Kafka", tab: "kafka", highlight: [3, 6, 9, 11], on: ["k", "n"],
      desc: "Không có bước này, trace dừng ở producer và phần async trở thành vùng tối." },
    { title: "5 · Metric RED bằng histogram", tab: "metric", highlight: [2, 3, 4, 12], on: ["a1", "me"],
      desc: "Histogram cho p99 thật. Thêm consumer lag và metric nghiệp vụ như đơn/phút." },
    { title: "6 · Tránh nổ cardinality", tab: "metric", highlight: [9], on: ["me"],
      desc: "ID thuộc về trace/log, không thuộc về nhãn metric." }
  ],

  quiz: [
    { q: "Tín hiệu nào trả lời 'request này chậm ở service nào'?", options: [
        "Metric", "Distributed trace", "Log của gateway", "CPU usage"
      ], correct: 1, explanation: "Trace cho thấy từng span trên đường đi." },
    { q: "RED gồm?", options: [
        "Read, Execute, Delete",
        "Rate, Errors, Duration",
        "Redis, Elastic, Docker",
        "Retry, Error, Deadline"
      ], correct: 1, explanation: "USE (Utilization, Saturation, Errors) dành cho tài nguyên." },
    { q: "Vì sao đo độ trễ bằng histogram chứ không chỉ trung bình?", options: [
        "Rẻ hơn",
        "Trung bình che đuôi chậm; histogram cho p95/p99",
        "Prometheus không hỗ trợ trung bình",
        "Không khác"
      ], correct: 1, explanation: "Người dùng cảm nhận đuôi, không cảm nhận trung bình." },
    { q: "Gắn nhãn user_id vào metric request gây gì?", options: [
        "Không sao",
        "Bùng nổ cardinality (hàng triệu chuỗi thời gian), tốn bộ nhớ và làm chậm/ngã hệ metric",
        "Metric chính xác hơn",
        "Mã hoá dữ liệu"
      ], correct: 1, explanation: "ID nên đặt ở trace/log." },
    { q: "Header W3C truyền ngữ cảnh trace là?", options: [
        "X-Request-Id", "traceparent", "Authorization", "X-B3-Sampled bắt buộc"
      ], correct: 1, explanation: "Kèm tracestate tuỳ chọn." },
    { q: "Làm sao trace không bị đứt khi đi qua Kafka?", options: [
        "Không thể",
        "Producer ghi traceparent vào header message; consumer trích ra làm parent của span xử lý",
        "Ghi trace_id vào tên topic",
        "Dùng cùng thread"
      ], correct: 1, explanation: "Propagator inject/extract trên header Kafka." },
    { q: "Log nên có định dạng thế nào trong microservice?", options: [
        "Văn bản tự do",
        "JSON có cấu trúc, kèm trace_id/span_id và khoá nghiệp vụ, không chứa PII/token",
        "Chỉ stack trace",
        "Không log"
      ], correct: 1, explanation: "Để tìm, lọc, nối với trace." },
    { q: "Metric nào báo sớm ClickHouse/notification đang tụt lại so với luồng sự kiện?", options: [
        "CPU của Kafka", "Consumer lag theo group", "Số topic", "Dung lượng đĩa ES"
      ], correct: 1, explanation: "Lag tăng đều = consumer không theo kịp." },
    { q: "Tương đương Micrometer Tracing + MDC trong Rust là?", options: [
        "log4rs", "crate tracing (+ tracing-opentelemetry)", "println!", "serde"
      ], correct: 1, explanation: "Span có field, log tự mang ngữ cảnh span." }
  ]
});
