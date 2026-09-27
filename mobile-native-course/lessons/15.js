window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Kiến trúc app & tài nguyên hệ thống",
  title: "Networking & cache: OkHttp/Retrofit, URLSession, HTTP cache và mạng di động",
  subtitle: "Connection pool · HTTP/2 · interceptor · Cache-Control / ETag / 304 · ATS & cleartext · NWPathMonitor · retry & idempotency",

  theory: `
    <p>Mạng di động khác mạng trong data center: độ trễ 50–300 ms mỗi vòng, chuyển Wi-Fi ↔ 4G giữa chừng, thang máy mất sóng, radio tốn pin khi bật. Code gọi API "như gọi service nội bộ" sẽ chậm và hỏng.</p>

    <p><strong>Thư viện chuẩn</strong></p>
    <table>
      <tr><th></th><th>Android</th><th>iOS</th><th>Spring tương đương</th></tr>
      <tr><td>HTTP client</td><td><strong>OkHttp</strong> (connection pool, HTTP/2, gzip trong suốt)</td><td><strong>URLSession</strong></td><td>WebClient / RestClient</td></tr>
      <tr><td>Khai báo API</td><td><strong>Retrofit</strong> + hàm <code>suspend</code> (hoặc Ktor client)</td><td>Tự viết lớp mỏng với async/await</td><td>@HttpExchange / Feign</td></tr>
      <tr><td>Chặn giữa</td><td>OkHttp <code>Interceptor</code> (thêm token, log)</td><td>Bọc URLSession / <code>URLProtocol</code></td><td>ClientHttpRequestInterceptor</td></tr>
      <tr><td>JSON</td><td>kotlinx.serialization / Moshi</td><td><code>Codable</code></td><td>Jackson</td></tr>
    </table>
    <p>Chỉ tạo <strong>một</strong> OkHttpClient / URLSession dùng chung cả app — mỗi client có pool kết nối và cache riêng; tạo mới mỗi request là mất keep-alive, phải bắt tay TLS lại.</p>

    <p><strong>HTTP cache — miễn phí nếu server trả header đúng</strong></p>
    <ul>
      <li><code>Cache-Control: max-age=300</code>: trong 5 phút, client dùng bản trong cache, không gọi mạng.</li>
      <li>Hết hạn → gửi <code>If-None-Match: "etag"</code>; server trả <strong>304 Not Modified</strong> không có body → tiết kiệm băng thông.</li>
      <li>OkHttp chỉ cache khi bạn gắn <code>Cache(dir, size)</code>; URLSession có <code>URLCache</code> mặc định. Đây là chỗ backend Rust/Workers của công ty giúp mobile trực tiếp: đặt đúng <code>Cache-Control</code>/<code>ETag</code>.</li>
    </ul>

    <p><strong>Bảo mật mặc định</strong>: iOS có <strong>ATS</strong> (App Transport Security) — chặn HTTP thường, yêu cầu TLS 1.2+. Android 9+ chặn cleartext mặc định; ngoại lệ khai báo trong <code>network_security_config.xml</code>. Đừng tắt toàn cục cho tiện.</p>

    <p><strong>Thực tế di động</strong></p>
    <ul>
      <li>Theo dõi trạng thái mạng: <code>ConnectivityManager.NetworkCallback</code> / <code>NWPathMonitor</code> — nhưng "có mạng" không có nghĩa là "tới được server"; cứ gọi và xử lý lỗi.</li>
      <li>Timeout hợp lý, retry có backoff cho request <em>idempotent</em>. POST tạo đơn hàng thì gửi kèm <code>Idempotency-Key</code> để server không tạo trùng khi client retry.</li>
      <li><strong>Offline-first</strong>: DB cục bộ (bài 16) là nguồn sự thật cho UI; mạng chỉ đồng bộ vào DB. UI hiện ngay dữ liệu cũ, rồi cập nhật.</li>
    </ul>

    <div class="callout"><p>💡 Ít request lớn tốt hơn nhiều request nhỏ: mỗi lần bật radio tốn pin và chịu độ trễ vòng. Gộp API cho màn hình (BFF/GraphQL), nén, và phân trang bằng cursor.</p></div>
  `,

  codeTabs: [
    { id: "ok", label: "① OkHttp + Retrofit", lines: [
      "val client = OkHttpClient.Builder()                  // MỘT instance cho cả app",
      "    .cache(Cache(File(ctx.cacheDir, \"http\"), 20L * 1024 * 1024))",
      "    .connectTimeout(10, TimeUnit.SECONDS)",
      "    .readTimeout(20, TimeUnit.SECONDS)",
      "    .addInterceptor(AuthInterceptor(tokenStore))",
      "    .build()",
      "",
      "interface ShopApi {",
      "    @GET(\"products/{id}\") suspend fun product(@Path(\"id\") id: String): ProductDto",
      "    @POST(\"orders\") suspend fun create(@Header(\"Idempotency-Key\") key: String, @Body o: OrderDto): OrderDto",
      "}",
      "val api = Retrofit.Builder().baseUrl(\"https://api.shop.vn/\").client(client)",
      "    .addConverterFactory(Json.asConverterFactory(\"application/json\".toMediaType())).build()",
      "    .create(ShopApi::class.java)"
    ]},
    { id: "us", label: "② URLSession + Codable", lines: [
      "struct ProductDTO: Decodable { let id: String; let name: String; let price: Int }",
      "",
      "final class ShopAPI {",
      "    private let session: URLSession = {",
      "        let cfg = URLSessionConfiguration.default",
      "        cfg.timeoutIntervalForRequest = 20",
      "        cfg.waitsForConnectivity = true           // chờ có mạng thay vì lỗi ngay",
      "        return URLSession(configuration: cfg)",
      "    }()",
      "    func product(_ id: String) async throws -> ProductDTO {",
      "        let url = URL(string: \"https://api.shop.vn/products/\" + id)!",
      "        let (data, resp) = try await session.data(from: url)",
      "        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw APIError.bad }",
      "        return try JSONDecoder().decode(ProductDTO.self, from: data)",
      "    }",
      "}"
    ]},
    { id: "cache", label: "③ HTTP cache & 304", lines: [
      "# Lần 1",
      "GET /products/42",
      "200 OK",
      "Cache-Control: max-age=300",
      "ETag: \"p42-v7\"",
      "",
      "# Trong 5 phút: đọc từ cache, KHÔNG gọi mạng",
      "",
      "# Sau 5 phút",
      "GET /products/42",
      "If-None-Match: \"p42-v7\"",
      "304 Not Modified          # không body, dùng lại bản cache"
    ]},
    { id: "sec", label: "④ Cleartext / ATS", lines: [
      "<!-- res/xml/network_security_config.xml: chỉ cho phép HTTP tới máy dev -->",
      "<network-security-config>",
      "  <domain-config cleartextTrafficPermitted=\"true\">",
      "    <domain includeSubdomains=\"false\">10.0.2.2</domain>",
      "  </domain-config>",
      "</network-security-config>",
      "",
      "<!-- iOS Info.plist: ngoại lệ ATS theo domain, KHÔNG dùng NSAllowsArbitraryLoads -->",
      "<key>NSAppTransportSecurity</key>",
      "<dict><key>NSExceptionDomains</key><dict>...</dict></dict>"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ui"><div class="nl">🖼️ UI hiển thị từ DB cục bộ</div><div class="ns">offline-first</div></div>
    <div class="arrow" id="a1">↓ cần làm mới</div>
    <div class="node" id="client"><div class="nl">🌐 OkHttp / URLSession (1 instance)</div><div class="ns">pool, HTTP/2, interceptor</div></div>
    <div class="arrow" id="a2">↓ còn hạn max-age?</div>
    <div class="row">
      <div class="node" id="hit"><div class="nl">💾 Cache hit</div><div class="ns">không gọi mạng</div></div>
      <div class="node" id="cond"><div class="nl">🔁 If-None-Match</div><div class="ns">304 → dùng lại</div></div>
    </div>
    <div class="arrow" id="a3">↓ lỗi mạng</div>
    <div class="node" id="retry"><div class="nl">⏳ Retry + backoff</div><div class="ns">POST kèm Idempotency-Key</div></div>
  `,
  steps: [
    { title: "1 · Một client dùng chung", tab: "ok", highlight: [1, 2, 3, 4, 5], on: ["client"],
      desc: "Pool kết nối, cache, interceptor gắn với instance — tạo mới mỗi lần là mất hết." },
    { title: "2 · Khai báo API như Feign", tab: "ok", highlight: [8, 9, 10], on: ["client"],
      desc: "Retrofit + suspend giống @HttpExchange của Spring; Idempotency-Key cho POST." },
    { title: "3 · iOS tương đương", tab: "us", highlight: [7, 12, 13, 14], on: ["client"],
      desc: "waitsForConnectivity chờ mạng thay vì lỗi ngay; Codable thay Jackson." },
    { title: "4 · Cache còn hạn", tab: "cache", highlight: [4, 5, 7], on: ["a2", "hit"],
      desc: "max-age=300 → 5 phút không tốn một byte mạng." },
    { title: "5 · Hỏi lại có điều kiện", tab: "cache", highlight: [11, 12], on: ["cond"],
      desc: "304 không có body — rẻ hơn tải lại toàn bộ." },
    { title: "6 · HTTPS mặc định", tab: "sec", highlight: [3, 4, 9, 10], on: ["client"],
      desc: "Chỉ mở ngoại lệ hẹp cho môi trường dev; không tắt ATS/cleartext toàn cục." }
  ],

  quiz: [
    { q: "Vì sao nên dùng một OkHttpClient/URLSession cho cả app?", options: [
        "Cho code ngắn", "Để chia sẻ connection pool (keep-alive, HTTP/2) và cache; tạo mới mỗi request phải bắt tay TLS lại", "Bắt buộc bởi OS", "Để dùng ít thread"
      ], correct: 1, explanation: "Tạo nhiều client còn lãng phí thread và bộ nhớ." },
    { q: "Server trả 'Cache-Control: max-age=300'. Trong 5 phút sau, request cùng URL sẽ…", options: [
        "Luôn gọi mạng", "Được phục vụ từ cache (nếu client bật cache) mà không gọi mạng", "Bị lỗi", "Gửi If-None-Match"
      ], correct: 1, explanation: "Hết hạn mới hỏi lại có điều kiện." },
    { q: "Phản hồi 304 Not Modified có ý nghĩa gì?", options: [
        "Lỗi server", "Tài nguyên không đổi so với ETag client gửi; client dùng lại bản cache", "Redirect", "Cần đăng nhập"
      ], correct: 1, explanation: "Không có body nên tiết kiệm băng thông." },
    { q: "OkHttp có cache HTTP mặc định không?", options: [
        "Có, luôn bật", "Không, phải gắn Cache(dir, size) khi build client", "Chỉ trên Android 14", "Chỉ với Retrofit"
      ], correct: 1, explanation: "URLSession thì có URLCache mặc định." },
    { q: "App Transport Security (ATS) trên iOS làm gì?", options: [
        "Mã hoá DB", "Mặc định chặn kết nối HTTP không mã hoá, yêu cầu TLS đủ mạnh", "Chặn quảng cáo", "Nén request"
      ], correct: 1, explanation: "Ngoại lệ phải khai báo trong Info.plist." },
    { q: "Client retry POST /orders sau timeout. Làm sao tránh tạo đơn trùng?", options: [
        "Không retry POST bao giờ", "Gửi Idempotency-Key giống nhau cho các lần thử; server trả lại kết quả cũ", "Tăng timeout", "Dùng GET"
      ], correct: 1, explanation: "Kết hợp chặt với thiết kế backend." },
    { q: "Offline-first nghĩa là gì?", options: [
        "App không dùng mạng", "DB cục bộ là nguồn sự thật cho UI; mạng đồng bộ vào DB", "Chỉ chạy khi máy bay", "Cache mọi thứ trong RAM"
      ], correct: 1, explanation: "UI luôn có dữ liệu ngay, cập nhật khi mạng về." },
    { q: "NWPathMonitor báo 'satisfied'. Có chắc gọi được API?", options: [
        "Có", "Không — chỉ biết có đường mạng; server vẫn có thể không tới được, phải xử lý lỗi", "Chỉ trên Wi-Fi", "Chỉ khi có 5G"
      ], correct: 1, explanation: "Captive portal, DNS, server lỗi… vẫn có thể xảy ra." },
    { q: "Android 9+ gọi http:// (không TLS) mặc định thì sao?", options: [
        "Chạy bình thường", "Bị chặn trừ khi cho phép trong network_security_config", "Tự nâng lên https", "Crash khi build"
      ], correct: 1, explanation: "cleartextTrafficPermitted mặc định false từ API 28." }
  ]
});
