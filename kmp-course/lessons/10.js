window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Thư viện đa nền tảng",
  title: "Gọi API: Ktor client + kotlinx.serialization",
  subtitle: "Engine OkHttp/Darwin · plugin ContentNegotiation, Auth, Timeout · @Serializable sinh code lúc biên dịch",

  theory: `
    <p><strong>Ktor client</strong> (JetBrains) là HTTP client đa nền tảng. API viết một lần trong commonMain; phần thực sự mở socket là <strong>engine</strong> theo nền tảng:</p>
    <ul>
      <li>Android: <code>ktor-client-okhttp</code> (hoặc <code>ktor-client-android</code>).</li>
      <li>iOS: <code>ktor-client-darwin</code> — bọc <code>NSURLSession</code>, nên tôn trọng App Transport Security, proxy, chứng chỉ hệ thống của iOS.</li>
    </ul>
    <p>Khai báo engine trong <code>androidMain</code>/<code>iosMain</code>, rồi <code>HttpClient { }</code> trong common sẽ tự dùng engine có mặt. Hoặc tạo client bằng <code>expect fun httpEngine()</code>.</p>

    <p><strong>Plugin</strong> (giống interceptor/filter của Spring <code>RestClient</code>/<code>WebClient</code>):</p>
    <ul>
      <li><code>ContentNegotiation</code> + <code>json(...)</code>: tự serialize body và <code>response.body&lt;T&gt;()</code>.</li>
      <li><code>HttpTimeout</code>: timeout request/connect/socket.</li>
      <li><code>Auth</code> với <code>bearer { loadTokens; refreshTokens }</code>: gắn token, gặp 401 thì tự refresh rồi gửi lại.</li>
      <li><code>Logging</code>, <code>HttpRequestRetry</code>, <code>defaultRequest { url(...) }</code>.</li>
      <li><code>expectSuccess = true</code>: status 4xx/5xx thành exception (<code>ClientRequestException</code>/<code>ServerResponseException</code>). Mặc định là <code>false</code> — không ném, bạn phải tự kiểm tra status.</li>
    </ul>

    <p><strong>kotlinx.serialization</strong> thay cho Jackson/Gson. Khác biệt cốt lõi: là <strong>compiler plugin</strong> — với mỗi class <code>@Serializable</code>, compiler sinh sẵn serializer lúc build, không dùng reflection → chạy được trên Kotlin/Native.</p>
    <ul>
      <li>Cần plugin Gradle <code>org.jetbrains.kotlin.plugin.serialization</code> + thư viện <code>kotlinx-serialization-json</code>.</li>
      <li>Field thiếu trong JSON mà không có giá trị mặc định → <code>MissingFieldException</code>. Field lạ trong JSON → lỗi, trừ khi <code>ignoreUnknownKeys = true</code>.</li>
      <li><code>@SerialName("created_at")</code> giống <code>@JsonProperty</code>. Sealed class hỗ trợ đa hình với trường phân biệt (<code>classDiscriminator</code>, mặc định <code>"type"</code>).</li>
    </ul>

    <table>
      <tr><th>Spring/Java</th><th>KMP</th></tr>
      <tr><td>RestClient / WebClient</td><td>Ktor HttpClient</td></tr>
      <tr><td>ClientHttpRequestInterceptor</td><td>Plugin Ktor</td></tr>
      <tr><td>Jackson <code>ObjectMapper</code> (reflection)</td><td><code>Json</code> + serializer sinh lúc biên dịch</td></tr>
      <tr><td><code>FAIL_ON_UNKNOWN_PROPERTIES=false</code></td><td><code>ignoreUnknownKeys = true</code></td></tr>
    </table>

    <div class="callout"><p>💡 API backend Rust/Java của công ty thay đổi thêm field là chuyện thường. Với app mobile đã phát hành không thể ép người dùng cập nhật,
    <strong>luôn bật <code>ignoreUnknownKeys</code></strong> và cho field mới giá trị mặc định — nếu không, backend thêm một field là app cũ crash khi parse.</p></div>
  `,

  codeTabs: [
    { id: "gradle", label: "Gradle", lines: [
      "plugins {",
      "    alias(libs.plugins.kotlin.multiplatform)",
      "    alias(libs.plugins.kotlin.serialization)   // org.jetbrains.kotlin.plugin.serialization",
      "}",
      "kotlin {",
      "    sourceSets {",
      "        commonMain.dependencies {",
      "            implementation(\"io.ktor:ktor-client-core:3.2.3\")   // phiên bản minh hoạ",
      "            implementation(\"io.ktor:ktor-client-content-negotiation:3.2.3\")",
      "            implementation(\"io.ktor:ktor-serialization-kotlinx-json:3.2.3\")",
      "            implementation(\"io.ktor:ktor-client-auth:3.2.3\")",
      "        }",
      "        androidMain.dependencies { implementation(\"io.ktor:ktor-client-okhttp:3.2.3\") }",
      "        iosMain.dependencies     { implementation(\"io.ktor:ktor-client-darwin:3.2.3\") }",
      "    }",
      "}"
    ]},
    { id: "model", label: "@Serializable", lines: [
      "import kotlinx.serialization.SerialName",
      "import kotlinx.serialization.Serializable",
      "",
      "@Serializable",
      "data class OrderDto(",
      "    val id: String,",
      "    @SerialName(\"total_amount\") val total: Long,",
      "    @SerialName(\"created_at\") val createdAt: String,",
      "    val note: String? = null,              // field mới → luôn có default",
      "    val status: OrderStatus = OrderStatus.PENDING,",
      ")",
      "",
      "@Serializable enum class OrderStatus { PENDING, PAID, SHIPPED }"
    ]},
    { id: "client", label: "HttpClient", lines: [
      "val json = Json { ignoreUnknownKeys = true; explicitNulls = false }",
      "",
      "fun createHttpClient(tokens: TokenStore) = HttpClient {",
      "    expectSuccess = true                                   // 4xx/5xx → exception",
      "    install(ContentNegotiation) { json(json) }",
      "    install(HttpTimeout) { requestTimeoutMillis = 15_000 }",
      "    install(Auth) {",
      "        bearer {",
      "            loadTokens { tokens.current()?.let { BearerTokens(it.access, it.refresh) } }",
      "            refreshTokens { tokens.refresh()?.let { BearerTokens(it.access, it.refresh) } }",
      "        }",
      "    }",
      "    defaultRequest { url(\"https://api.shop.vn/v1/\") }",
      "}"
    ]},
    { id: "api", label: "Gọi API", lines: [
      "class OrderApi(private val client: HttpClient) {",
      "    suspend fun fetchOrders(page: Int): List<OrderDto> =",
      "        client.get(\"orders\") { parameter(\"page\", page) }.body()",
      "",
      "    suspend fun create(req: CreateOrderRequest): OrderDto =",
      "        client.post(\"orders\") {",
      "            contentType(ContentType.Application.Json)",
      "            setBody(req)",
      "        }.body()",
      "}",
      "",
      "// GET https://api.shop.vn/v1/orders?page=1",
      "// ← [{\"id\":\"o1\",\"total_amount\":250000,\"created_at\":\"2026-09-01\",\"promo\":\"X\"}]",
      "//   'promo' không có trong DTO → bỏ qua nhờ ignoreUnknownKeys"
    ]}
  ],

  stageHtml: `
    <div class="node" id="call"><div class="nl">📞 api.fetchOrders(1)</div><div class="ns">commonMain</div></div>
    <div class="arrow" id="a1">↓ plugin: defaultRequest · Auth (Bearer) · Timeout</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">🤖 OkHttp engine</div><div class="ns">Android</div></div>
      <div class="node" id="dw"><div class="nl">🍎 Darwin engine</div><div class="ns">NSURLSession</div></div>
    </div>
    <div class="arrow" id="a2">↓ 200 JSON (· 401 → refreshTokens → gửi lại)</div>
    <div class="node" id="ser"><div class="nl">🧾 ContentNegotiation + Json</div><div class="ns">serializer sinh lúc biên dịch</div></div>
    <div class="node" id="dto"><div class="nl">📦 List&lt;OrderDto&gt;</div></div>
  `,
  steps: [
    { title: "1 · Khai báo phụ thuộc", tab: "gradle", highlight: [3, 8, 9, 10, 13, 14], on: ["ok", "dw"],
      desc: "Lõi Ktor ở common; engine mỗi nền tảng một cái. Plugin serialization bắt buộc để @Serializable có tác dụng." },
    { title: "2 · DTO an toàn khi backend đổi", tab: "model", highlight: [4, 7, 8, 9, 10], on: ["ser"],
      desc: "@SerialName ánh xạ snake_case. Field tuỳ chọn có default để JSON cũ thiếu field vẫn parse được." },
    { title: "3 · Cấu hình client", tab: "client", highlight: [1, 4, 5, 6], on: ["a1"],
      desc: "ignoreUnknownKeys để JSON thừa field không làm lỗi. expectSuccess biến 4xx/5xx thành exception." },
    { title: "4 · Bearer tự refresh", tab: "client", highlight: [7, 8, 9, 10], on: ["a1", "a2"],
      desc: "loadTokens gắn token vào mọi request. Gặp 401, Ktor gọi refreshTokens rồi gửi lại request — như một interceptor refresh bạn hay tự viết." },
    { title: "5 · Gọi và parse", tab: "api", highlight: [2, 3, 12, 13, 14], on: ["call", "ser", "dto"],
      desc: "<code>.body()</code> dùng serializer của OrderDto. Field <code>promo</code> lạ bị bỏ qua." }
  ],

  quiz: [
    { q: "Engine Ktor khuyến nghị cho iOS là?", options: [
        "OkHttp", "Darwin (bọc NSURLSession)", "CIO bắt buộc", "Apache"
      ], correct: 1, explanation: "Dùng stack mạng của iOS: ATS, proxy, chứng chỉ hệ thống." },
    { q: "Vì sao kotlinx.serialization chạy được trên iOS còn Jackson thì không?", options: [
        "Jackson quá lớn",
        "kotlinx.serialization sinh serializer lúc biên dịch (compiler plugin), Jackson dựa vào reflection JVM",
        "Jackson chỉ đọc XML",
        "Jackson không hỗ trợ Kotlin"
      ], correct: 1, explanation: "Kotlin/Native không có reflection kiểu JVM." },
    { q: "Thiếu plugin Gradle org.jetbrains.kotlin.plugin.serialization thì sao?", options: [
        "Không sao",
        "@Serializable không sinh serializer → lỗi khi (de)serialize",
        "Ktor không build",
        "Chỉ lỗi trên Android"
      ], correct: 1, explanation: "Annotation không tự làm gì nếu không có compiler plugin." },
    { q: "JSON có field lạ không có trong DTO, Json mặc định sẽ?", options: [
        "Bỏ qua", "Ném lỗi — trừ khi ignoreUnknownKeys = true", "Thêm vào map", "Crash compiler"
      ], correct: 1, explanation: "Nên bật cho app mobile." },
    { q: "Field trong DTO không có default và JSON không có field đó?", options: [
        "Nhận null", "MissingFieldException", "Nhận chuỗi rỗng", "Bỏ qua"
      ], correct: 1, explanation: "Cho default để tương thích." },
    { q: "Mặc định (expectSuccess = false), response 404 thì Ktor?", options: [
        "Ném ClientRequestException",
        "Không ném — trả response, bạn phải tự kiểm tra status",
        "Tự retry",
        "Crash"
      ], correct: 1, explanation: "Bật expectSuccess = true để 4xx/5xx thành exception." },
    { q: "Plugin Auth bearer làm gì khi nhận 401?", options: [
        "Đăng xuất",
        "Gọi refreshTokens, rồi gửi lại request với token mới",
        "Bỏ qua",
        "Chuyển sang Basic auth"
      ], correct: 1, explanation: "Giống interceptor refresh token tự viết trong Spring/OkHttp." },
    { q: "@SerialName tương đương annotation nào của Jackson?", options: [
        "@JsonIgnore", "@JsonProperty", "@JsonFormat", "@JsonCreator"
      ], correct: 1, explanation: "Đổi tên field khi (de)serialize." },
    { q: "Engine khai báo ở đâu?", options: [
        "commonMain", "androidMain/iosMain (hoặc qua expect fun)", "settings.gradle.kts", "Xcode"
      ], correct: 1, explanation: "Engine là phần phụ thuộc nền tảng." }
  ]
});
