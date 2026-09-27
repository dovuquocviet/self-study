window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Service production",
  title: "Kiến trúc service axum: tower Service, Layer, State & graceful shutdown",
  subtitle: "Service = async fn(Request) -> Response · Layer bọc Service · thứ tự layer · middleware::from_fn · FromRef · tắt êm với with_graceful_shutdown",

  theory: `
    <p>Nhập môn đã viết REST API với axum. Bài này nhìn xuống lớp bên dưới — <strong>tower</strong> — để bạn tự viết được middleware, đặt layer đúng thứ tự, tổ chức state cho service lớn và tắt service không làm rơi request.</p>

    <p><strong>1. tower::Service — mọi thứ là một hàm bất đồng bộ</strong></p>
    <p><code>trait Service&lt;Req&gt; { type Response; type Error; type Future; fn poll_ready(...); fn call(&amp;mut self, req: Req) -&gt; Self::Future; }</code>.
    Router axum, mỗi handler, hyper client, timeout, retry... đều là Service. <strong>Layer</strong> là "nhà máy bọc": nhận Service trong, trả Service ngoài — chính là Decorator/Filter chain.
    Hệ sinh thái <code>tower-http</code> có sẵn: <code>TraceLayer</code>, <code>CorsLayer</code>, <code>TimeoutLayer</code>, <code>CompressionLayer</code>, <code>RequestIdLayer</code> (<code>SetRequestIdLayer</code>/<code>PropagateRequestIdLayer</code>), <code>CatchPanicLayer</code>, <code>RequestBodyLimitLayer</code>.</p>

    <p><strong>2. Thứ tự layer</strong> — hay nhầm nhất</p>
    <ul>
      <li><code>Router::layer(a).layer(b)</code>: layer thêm <strong>sau</strong> nằm <strong>ngoài</strong> → request đi b → a → handler, response đi ngược lại.</li>
      <li><code>ServiceBuilder::new().layer(a).layer(b)</code>: ngược lại, đọc từ trên xuống = ngoài vào trong (a ngoài cùng). Vì vậy nên gom bằng ServiceBuilder cho dễ đọc.</li>
      <li><code>Router::layer</code> chỉ áp cho route đã thêm <em>trước</em> nó; <code>route_layer</code> chỉ chạy khi route khớp (hợp cho auth: route không tồn tại vẫn trả 404 chứ không 401).</li>
    </ul>

    <p><strong>3. Viết middleware</strong>: đa số trường hợp dùng <code>axum::middleware::from_fn</code> / <code>from_fn_with_state</code> — một async fn nhận <code>Request</code> và <code>Next</code>
    (giống <code>OncePerRequestFilter.doFilterInternal</code>). Muốn chuyển dữ liệu từ middleware xuống handler (user đã xác thực): <code>req.extensions_mut().insert(user)</code>, handler lấy bằng <code>Extension&lt;CurrentUser&gt;</code>.
    Chỉ tự impl <code>Layer</code> + <code>Service</code> khi viết thư viện dùng chung hoặc cần <code>poll_ready</code>.</p>

    <p><strong>4. State cho service lớn</strong>: một <code>AppState</code> (Clone, các field là <code>Arc</code>/pool vốn đã rẻ để clone). Handler chỉ cần một phần → <code>#[derive(FromRef)]</code>
    rồi extract <code>State&lt;PgPool&gt;</code> trực tiếp. Tránh <code>Extension</code> cho state toàn cục: sai kiểu chỉ lộ ra lúc chạy (500), còn <code>State</code> kiểm tra lúc biên dịch.
    Chia router theo module: <code>Router::new().nest("/orders", orders::router())</code>, <code>merge</code> để ghép.</p>

    <p><strong>5. Graceful shutdown</strong> (Kubernetes gửi SIGTERM, chờ <code>terminationGracePeriodSeconds</code> mặc định 30s rồi SIGKILL):
    <code>axum::serve(listener, app).with_graceful_shutdown(signal)</code> ngừng accept connection mới, chờ request đang chạy xong. Sau đó: dừng consumer/job qua CancellationToken, <code>pool.close().await</code>, flush OTel.
    Thêm <code>TimeoutLayer</code> để request dài không giữ quá hạn grace period.</p>
    <div class="callout"><p>💡 axum 0.8 đổi cú pháp path thành <code>/users/{id}</code> (0.7 là <code>/users/:id</code>) và không còn cần <code>#[async_trait]</code> khi tự viết extractor. Code cũ trên mạng rất hay dùng cú pháp 0.7.</p></div>
  `,

  codeTabs: [
    { id: "main", label: "① main & layer", lines: [
      "#[tokio::main]",
      "async fn main() -> anyhow::Result<()> {",
      "    let provider = init_telemetry();",
      "    let state = AppState::new(&Config::from_env()?).await?;",
      "",
      "    let app = Router::new()",
      "        .nest(\"/orders\", orders::router(state.clone()))",
      "        .merge(health::router())",
      "        .layer(ServiceBuilder::new()                 // trên xuống = ngoài vào",
      "            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))",
      "            .layer(TraceLayer::new_for_http())",
      "            .layer(PropagateRequestIdLayer::x_request_id())",
      "            .layer(CatchPanicLayer::new())",
      "            .layer(TimeoutLayer::new(Duration::from_secs(10))))",
      "        .with_state(state.clone());",
      "",
      "    let listener = tokio::net::TcpListener::bind(\"0.0.0.0:8080\").await?;",
      "    axum::serve(listener, app)",
      "        .with_graceful_shutdown(shutdown_signal())",
      "        .await?;",
      "    state.shutdown().await;                       // token.cancel, pool.close",
      "    provider.shutdown()?;",
      "    Ok(())",
      "}"
    ]},
    { id: "mw", label: "② Middleware from_fn", lines: [
      "#[derive(Clone)]",
      "pub struct CurrentUser { pub id: i64, pub roles: Vec<String> }",
      "",
      "async fn auth(State(s): State<AppState>, mut req: Request, next: Next)",
      "    -> Result<Response, StatusCode> {",
      "    let token = req.headers().get(header::AUTHORIZATION)",
      "        .and_then(|v| v.to_str().ok())",
      "        .and_then(|v| v.strip_prefix(\"Bearer \"))",
      "        .ok_or(StatusCode::UNAUTHORIZED)?;",
      "    let user = s.jwt.verify(token).map_err(|_| StatusCode::UNAUTHORIZED)?;",
      "    req.extensions_mut().insert(user);             // chuyển xuống handler",
      "    Ok(next.run(req).await)",
      "}",
      "",
      "pub fn router(state: AppState) -> Router<AppState> {",
      "    Router::new()",
      "        .route(\"/{id}\", get(get_order))",
      "        .route_layer(middleware::from_fn_with_state(state, auth))",
      "}",
      "async fn get_order(Extension(u): Extension<CurrentUser>, Path(id): Path<i64>) { /* ... */ }"
    ]},
    { id: "state", label: "③ State & FromRef", lines: [
      "#[derive(Clone, FromRef)]",
      "pub struct AppState {",
      "    pub db: PgPool,                     // PgPool bên trong đã là Arc",
      "    pub redis: redis::aio::ConnectionManager,",
      "    pub orders: Arc<dyn OrderRepo>,",
      "    pub jwt: Arc<JwtVerifier>,",
      "    pub shutdown: CancellationToken,",
      "}",
      "",
      "// Handler chỉ lấy phần cần:",
      "async fn health(State(db): State<PgPool>) -> StatusCode {",
      "    match sqlx::query(\"SELECT 1\").execute(&db).await {",
      "        Ok(_) => StatusCode::OK,",
      "        Err(_) => StatusCode::SERVICE_UNAVAILABLE,",
      "    }",
      "}"
    ]},
    { id: "sig", label: "④ Tín hiệu tắt", lines: [
      "async fn shutdown_signal() {",
      "    let ctrl_c = async { tokio::signal::ctrl_c().await.expect(\"ctrl_c\") };",
      "    #[cfg(unix)]",
      "    let term = async {",
      "        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())",
      "            .expect(\"sigterm\").recv().await;",
      "    };",
      "    #[cfg(not(unix))]",
      "    let term = std::future::pending::<()>();",
      "    tokio::select! { _ = ctrl_c => {}, _ = term => {} }",
      "    tracing::info!(\"shutdown signal received, draining\");",
      "}"
    ]},
    { id: "java", label: "⑤ Đối chiếu Spring", lines: [
      "// Filter chain ~ tower Layer",
      "class AuthFilter extends OncePerRequestFilter {",
      "  protected void doFilterInternal(HttpServletRequest r, HttpServletResponse s,",
      "                                  FilterChain chain) {",
      "    r.setAttribute(\"user\", verify(r));      // ~ extensions_mut().insert",
      "    chain.doFilter(r, s);                   // ~ next.run(req).await",
      "  }",
      "}",
      "# application.yml",
      "server.shutdown: graceful                  # ~ with_graceful_shutdown",
      "spring.lifecycle.timeout-per-shutdown-phase: 20s"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📨 Request</div><div class="ns">hyper → tower Service</div></div>
    <div class="arrow" id="a1">↓ ngoài vào trong</div>
    <div class="node" id="l1"><div class="nl">🆔 RequestId → 🔭 Trace → 🧯 CatchPanic → ⏱️ Timeout</div><div class="ns">ServiceBuilder: trên xuống = ngoài vào</div></div>
    <div class="arrow" id="a2">↓ route khớp</div>
    <div class="node" id="auth"><div class="nl">🔐 route_layer(auth)</div><div class="ns">extensions.insert(CurrentUser)</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="h"><div class="nl">🎯 Handler</div><div class="ns">State&lt;PgPool&gt; · Extension&lt;CurrentUser&gt;</div></div>
    <div class="node" id="sd"><div class="nl">🛑 SIGTERM</div><div class="ns">ngừng accept · chờ request xong · đóng pool · flush OTel</div></div>
  `,
  steps: [
    { title: "1 · Chồng layer", tab: "main", highlight: [9, 10, 11, 12, 13, 14], on: ["req", "a1", "l1"],
      desc: "Trong ServiceBuilder, layer đầu là ngoài cùng: request ID được gán trước để TraceLayer ghi được nó." },
    { title: "2 · Router theo module", tab: "main", highlight: [6, 7, 8, 15], on: ["l1"],
      desc: "<code>nest</code> gắn tiền tố, <code>merge</code> gộp router. <code>with_state</code> cung cấp state một lần." },
    { title: "3 · Middleware xác thực", tab: "mw", highlight: [4, 9, 10, 11, 12, 18], on: ["a2", "auth"],
      desc: "from_fn_with_state + route_layer: chỉ chạy cho route tồn tại. Dữ liệu xuống handler qua extensions." },
    { title: "4 · Handler lấy đúng phần cần", tab: "state", highlight: [1, 3, 5, 11], on: ["a3", "h"],
      desc: "FromRef cho phép extract <code>State&lt;PgPool&gt;</code> từ AppState. Kiểu sai là lỗi biên dịch, khác Extension." },
    { title: "5 · Bắt SIGTERM", tab: "sig", highlight: [2, 5, 6, 10], on: ["sd"],
      desc: "Kubernetes gửi SIGTERM; future này hoàn tất → axum ngừng accept." },
    { title: "6 · Tắt êm", tab: "main", highlight: [18, 19, 20, 21, 22], on: ["sd"],
      desc: "Chờ request đang chạy xong, rồi huỷ job nền, đóng pool, flush trace — trước khi grace period hết." }
  ],

  quiz: [
    { q: "Trong tower, Layer là gì?", options: [
        "Một handler",
        "Thứ nhận một Service và trả về Service mới bọc bên ngoài (decorator)",
        "Một thread pool",
        "Router con"
      ], correct: 1, explanation: "Tương đương Filter trong Servlet." },
    { q: "Router::new().route(...).layer(A).layer(B): request đi qua thứ tự nào?", options: [
        "A → B → handler", "B → A → handler", "Ngẫu nhiên", "Chỉ B"
      ], correct: 1, explanation: "Layer thêm sau nằm ngoài. ServiceBuilder thì đọc trên xuống = ngoài vào." },
    { q: "Vì sao dùng route_layer cho middleware auth?", options: [
        "Nhanh hơn",
        "Chỉ chạy khi route khớp: đường dẫn không tồn tại vẫn trả 404 thay vì 401",
        "Bắt buộc với State",
        "Để bỏ qua CORS"
      ], correct: 1, explanation: "layer thường chạy cả cho fallback." },
    { q: "Chuyển user đã xác thực từ middleware xuống handler bằng cách nào?", options: [
        "Biến global",
        "req.extensions_mut().insert(user), handler lấy Extension<CurrentUser>",
        "Header giả",
        "thread_local!"
      ], correct: 1, explanation: "Extensions là type map gắn theo request." },
    { q: "#[derive(FromRef)] trên AppState cho phép gì?", options: [
        "Tự sinh router",
        "Handler extract State<PgPool> (một field) thay vì cả AppState",
        "Serialize state",
        "Clone sâu"
      ], correct: 1, explanation: "Giảm phụ thuộc của handler." },
    { q: "Vì sao ưu tiên State hơn Extension cho dependency toàn cục?", options: [
        "Extension không tồn tại",
        "State kiểm tra kiểu lúc biên dịch; Extension thiếu/sai kiểu chỉ lộ ra lúc chạy (500)",
        "Extension chậm hơn 100 lần",
        "State tự thread-safe"
      ], correct: 1, explanation: "Lỗi chuyển từ runtime sang compile time." },
    { q: "with_graceful_shutdown(signal) làm gì khi signal hoàn tất?", options: [
        "Kill mọi request ngay",
        "Ngừng nhận connection mới và chờ các request đang xử lý hoàn tất",
        "Restart server",
        "Đóng DB pool"
      ], correct: 1, explanation: "Đóng pool, flush trace là việc của bạn sau khi serve trả về." },
    { q: "Cú pháp path parameter trong axum 0.8 là?", options: [
        "/users/:id", "/users/{id}", "/users/<id>", "/users/$id"
      ], correct: 1, explanation: "0.7 dùng :id; 0.8 đổi sang {id}." },
    { q: "Kubernetes mặc định chờ bao lâu sau SIGTERM trước khi SIGKILL?", options: [
        "5 giây", "30 giây (terminationGracePeriodSeconds)", "Vô hạn", "1 phút"
      ], correct: 1, explanation: "Nên đặt TimeoutLayer nhỏ hơn con số này." }
  ]
});
