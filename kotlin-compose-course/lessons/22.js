window.LESSONS.push({
  id: "22",
  phase: "5", phaseName: "Dữ liệu & hạ tầng",
  title: "Networking: Retrofit & Ktor client",
  subtitle: "Interface + suspend · kotlinx.serialization · OkHttp interceptor · xử lý lỗi · Ktor cho KMP · so với RestTemplate/Feign",

  theory: `
    <p><strong>Retrofit</strong> quen với dev Spring: giống <strong>OpenFeign</strong> — bạn viết interface có annotation, thư viện sinh implementation (dynamic proxy).
    Bên dưới là <strong>OkHttp</strong> (connection pool, HTTP/2, gzip, cache, interceptor). Hàm <code>suspend</code> được hỗ trợ trực tiếp và main-safe.</p>
    <ul>
      <li>Kiểu trả về <code>T</code>: HTTP 2xx → body đã parse; <strong>non-2xx → ném <code>HttpException</code></strong>; lỗi mạng → <code>IOException</code>.</li>
      <li>Kiểu trả về <code>Response&lt;T&gt;</code>: không ném với non-2xx; tự kiểm tra <code>isSuccessful</code>, <code>code()</code>, <code>errorBody()</code>.</li>
      <li>JSON: <code>converter-kotlinx-serialization</code> (<code>Json.asConverterFactory("application/json".toMediaType())</code>) — hợp Kotlin hơn Gson (tôn trọng non-null & giá trị mặc định,
        không dùng reflection). Moshi cũng phổ biến.</li>
    </ul>

    <p><strong>kotlinx.serialization</strong>: plugin compiler sinh serializer lúc build cho class <code>@Serializable</code>. Lưu ý <code>Json { ignoreUnknownKeys = true }</code> —
    mặc định field lạ trong JSON sẽ làm parse <em>lỗi</em>; server thêm field mới là app cũ crash nếu quên cấu hình này. Field non-null thiếu trong JSON mà không có default → lỗi.</p>

    <p><strong>Interceptor</strong> (OkHttp) ≈ <code>ClientHttpRequestInterceptor</code> của Spring: gắn header <code>Authorization</code>, log, thêm <code>Accept-Language</code>.
    Làm mới token khi 401 dùng <code>Authenticator</code> của OkHttp. Timeout mặc định của OkHttp là 10 giây cho connect/read/write.</p>

    <p><strong>Ktor client</strong> (của JetBrains): API dạng DSL, thuần Kotlin, chạy được trong <strong>Kotlin Multiplatform</strong> (engine OkHttp trên Android, Darwin trên iOS).
    Nếu công ty đi KMP để chia sẻ tầng data giữa Android và iOS, Ktor + kotlinx.serialization là lựa chọn mặc định; Retrofit chỉ chạy trên JVM/Android.</p>

    <table>
      <tr><th></th><th>Retrofit</th><th>Ktor client</th></tr>
      <tr><td>Phong cách</td><td>Interface + annotation (như Feign)</td><td>Gọi hàm DSL (như WebClient)</td></tr>
      <tr><td>Nền tảng</td><td>JVM/Android</td><td>Multiplatform</td></tr>
      <tr><td>Lỗi non-2xx</td><td>Ném HttpException (kiểu T)</td><td>Không ném mặc định; bật <code>expectSuccess = true</code> để ném</td></tr>
    </table>

    <div class="callout"><p>💡 Bắt lỗi ở repository và chuyển thành kết quả có nghĩa với nghiệp vụ (<code>Result</code>, sealed <code>NetworkError</code>), đừng để <code>HttpException</code> lọt lên UI.
    Và nhớ: bắt <code>IOException</code>/<code>HttpException</code> cụ thể, không <code>catch (e: Exception)</code> nuốt <code>CancellationException</code> (bài 08).</p></div>
  `,

  codeTabs: [
    { id: "api", label: "① Retrofit interface", lines: [
      "interface ShopApi {",
      "    @GET(\"v1/categories/{id}/products\")",
      "    suspend fun productsByCategory(",
      "        @Path(\"id\") catId: Long,",
      "        @Query(\"page\") page: Int = 1",
      "    ): List<ProductDto>                         // non-2xx → HttpException",
      "",
      "    @POST(\"v1/orders\")",
      "    suspend fun placeOrder(@Body body: PlaceOrderRequest): Response<OrderDto>   // tự xử lý code",
      "}"
    ]},
    { id: "build", label: "② Dựng client", lines: [
      "val json = Json { ignoreUnknownKeys = true; explicitNulls = false }",
      "",
      "val okHttp = OkHttpClient.Builder()",
      "    .addInterceptor { chain ->",
      "        val req = chain.request().newBuilder()",
      "            .header(\"Authorization\", \"Bearer \" + tokenStore.accessToken())",
      "            .build()",
      "        chain.proceed(req)",
      "    }",
      "    .authenticator(TokenRefreshAuthenticator(tokenStore))   // xử lý 401",
      "    .build()",
      "",
      "val api: ShopApi = Retrofit.Builder()",
      "    .baseUrl(\"https://api.shop.vn/\")               // phải kết thúc bằng /",
      "    .client(okHttp)",
      "    .addConverterFactory(json.asConverterFactory(\"application/json\".toMediaType()))",
      "    .build()",
      "    .create(ShopApi::class.java)"
    ]},
    { id: "err", label: "③ Xử lý lỗi ở repository", lines: [
      "sealed interface PlaceResult {",
      "    data class Ok(val code: String) : PlaceResult",
      "    data object OutOfStock : PlaceResult",
      "    data object Offline : PlaceResult",
      "    data class Failed(val http: Int) : PlaceResult",
      "}",
      "",
      "suspend fun place(req: PlaceOrderRequest): PlaceResult = try {",
      "    val res = api.placeOrder(req)",
      "    when {",
      "        res.isSuccessful -> PlaceResult.Ok(res.body()!!.code)",
      "        res.code() == 409 -> PlaceResult.OutOfStock",
      "        else -> PlaceResult.Failed(res.code())",
      "    }",
      "} catch (e: IOException) { PlaceResult.Offline }     // mất mạng, timeout"
    ]},
    { id: "ktor", label: "④ Ktor client (KMP)", lines: [
      "val client = HttpClient(OkHttp) {                 // iOS: HttpClient(Darwin)",
      "    install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }",
      "    install(HttpTimeout) { requestTimeoutMillis = 15_000 }",
      "    defaultRequest { url(\"https://api.shop.vn/\") }",
      "    expectSuccess = true                             // non-2xx → ném exception",
      "}",
      "",
      "suspend fun products(catId: Long): List<ProductDto> =",
      "    client.get(\"v1/categories/$catId/products\") { parameter(\"page\", 1) }.body()"
    ]}
  ],

  stageHtml: `
    <div class="node" id="repo"><div class="nl">📚 Repository</div><div class="ns">api.placeOrder(req)</div></div>
    <div class="arrow" id="a1">↓ Retrofit proxy dựng request</div>
    <div class="node" id="icp"><div class="nl">🔗 OkHttp interceptor</div><div class="ns">+ Authorization, log</div></div>
    <div class="arrow" id="a2">↓ HTTP/2 · connection pool</div>
    <div class="node" id="server"><div class="nl">🦀 Backend (Rust / Workers)</div><div class="ns">200 · 401 · 409 · timeout</div></div>
    <div class="arrow" id="a3">↑ converter parse JSON (kotlinx.serialization)</div>
    <div class="node" id="result"><div class="nl">✅ PlaceResult</div><div class="ns">Ok / OutOfStock / Offline / Failed</div></div>
  `,
  steps: [
    { title: "1 · Khai báo API như Feign", tab: "api", highlight: [1, 2, 3, 4, 5, 6], on: ["repo", "a1"],
      desc: "Annotation mô tả request; Retrofit sinh implementation. Kiểu trả T nghĩa là non-2xx sẽ ném HttpException." },
    { title: "2 · Response<T> khi cần mã lỗi", tab: "api", highlight: [8, 9], on: ["repo"],
      desc: "Với đặt hàng cần phân biệt 409 hết hàng, dùng Response<T> để đọc code()." },
    { title: "3 · Interceptor gắn token", tab: "build", highlight: [3, 4, 6, 8, 10], on: ["icp", "a2"],
      desc: "Mọi request đi qua interceptor. Authenticator được OkHttp gọi khi nhận 401 để làm mới token và thử lại." },
    { title: "4 · Converter & cấu hình Json", tab: "build", highlight: [1, 14, 16], on: ["a3"],
      desc: "ignoreUnknownKeys để server thêm field không làm app cũ lỗi. baseUrl phải kết thúc bằng '/'." },
    { title: "5 · Lỗi thành kết quả nghiệp vụ", tab: "err", highlight: [1, 10, 11, 12, 15], on: ["server", "result"],
      desc: "Repository biến mã HTTP và IOException thành sealed PlaceResult; UI chỉ cần when đủ nhánh." },
    { title: "6 · Ktor cho Multiplatform", tab: "ktor", highlight: [1, 2, 5, 9], on: ["repo"],
      desc: "Cùng DTO @Serializable dùng được cho Android và iOS trong module shared." }
  ],

  quiz: [
    { q: "Hàm Retrofit suspend fun get(): List<ProductDto> nhận HTTP 500 thì?", options: [
        "Trả list rỗng", "Ném HttpException", "Trả null", "Treo mãi"
      ], correct: 1, explanation: "Muốn tự xử lý mã lỗi thì trả Response<T>." },
    { q: "Retrofit tương đương gì bên Spring?", options: [
        "JdbcTemplate", "OpenFeign (interface + annotation)", "Spring Data JPA", "Kafka listener"
      ], correct: 1, explanation: "Cả hai sinh client từ interface." },
    { q: "Server thêm field mới vào JSON; app dùng kotlinx.serialization với Json mặc định thì?", options: [
        "Bỏ qua field", "Lỗi parse vì unknown key", "Tự thêm property", "Chỉ cảnh báo"
      ], correct: 1, explanation: "Bật ignoreUnknownKeys = true." },
    { q: "Gắn header Authorization cho mọi request nên dùng?", options: [
        "Thêm @Header vào mọi hàm", "OkHttp Interceptor", "Sửa baseUrl", "ViewModel"
      ], correct: 1, explanation: "Một chỗ cho mọi request." },
    { q: "Xử lý 401 để làm mới token trong OkHttp dùng?", options: [
        "CookieJar", "Authenticator", "Dispatcher", "EventListener"
      ], correct: 1, explanation: "OkHttp gọi Authenticator khi nhận 401 để tạo request mới có token mới." },
    { q: "Mất mạng khi gọi API Retrofit sẽ ném?", options: [
        "HttpException", "IOException (vd UnknownHostException, SocketTimeoutException)", "NullPointerException", "IllegalStateException"
      ], correct: 1, explanation: "HttpException chỉ khi có response non-2xx." },
    { q: "Vì sao chọn Ktor client cho dự án KMP?", options: [
        "Nhanh gấp đôi", "Chạy đa nền tảng (Android/iOS...) với engine riêng mỗi nền tảng", "Có sẵn trong Android", "Retrofit bị khai tử"
      ], correct: 1, explanation: "Retrofit phụ thuộc JVM." },
    { q: "Ktor client mặc định với response 404?", options: [
        "Ném exception", "Không ném; cần expectSuccess = true hoặc tự kiểm tra status", "Retry", "Crash"
      ], correct: 1, explanation: "Khác Retrofit kiểu T." },
    { q: "Nơi nào nên chuyển lỗi HTTP thành kiểu nghiệp vụ (OutOfStock...)?", options: [
        "Composable", "Repository/data layer", "Interceptor", "Activity"
      ], correct: 1, explanation: "UI không nên biết mã HTTP." },
    { q: "Retrofit baseUrl(\"https://api.shop.vn/v1\") (thiếu / cuối) thì?", options: [
        "Chạy bình thường", "Ném IllegalArgumentException: baseUrl must end in /", "Tự thêm /", "Bỏ qua v1"
      ], correct: 1, explanation: "Quy tắc ghép URL của Retrofit." }
  ]
});
