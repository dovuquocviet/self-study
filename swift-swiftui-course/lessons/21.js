window.LESSONS.push({
  id: "21",
  phase: "4", phaseName: "Kiến trúc & dữ liệu",
  title: "Networking: URLSession async + Codable",
  subtitle: "data(for:) · kiểm tra status code · JSONDecoder snake_case & ISO 8601 · CodingKeys · APIClient generic",

  theory: `
    <p>Trên iOS không cần thư viện như Retrofit/Axios: <code>URLSession</code> (có sẵn, dùng HTTP/2 và HTTP/3 khi server hỗ trợ) + <code>Codable</code> là đủ cho phần lớn app.</p>

    <p><strong>URLSession với async/await</strong></p>
    <ul>
      <li><code>let (data, response) = try await URLSession.shared.data(for: request)</code>. Trả về <code>Data</code> + <code>URLResponse</code> (ép sang <code>HTTPURLResponse</code> để đọc <code>statusCode</code>, header).</li>
      <li><strong>Bẫy lớn</strong>: HTTP 404/500 <strong>không</strong> ném lỗi — chỉ lỗi tầng mạng (mất mạng, timeout, DNS, huỷ) mới ném <code>URLError</code>. Bạn phải tự kiểm tra status code (giống <code>fetch</code> của JS, khác <code>RestTemplate</code> ném <code>HttpClientErrorException</code>).</li>
      <li>Timeout mặc định của request là 60 giây (<code>timeoutInterval</code>). Cấu hình chung (header, cache, timeout) qua <code>URLSessionConfiguration</code>.</li>
      <li>Huỷ Task → request bị huỷ, ném <code>URLError(.cancelled)</code> (bài 19).</li>
      <li>App Transport Security (ATS): mặc định chỉ cho HTTPS; gọi HTTP thường phải khai ngoại lệ trong Info.plist.</li>
    </ul>

    <p><strong>Codable = Encodable + Decodable</strong>. Khai báo <code>struct Product: Codable</code> là compiler sinh code encode/decode (giống Jackson nhưng lúc biên dịch, không dùng reflection).</p>
    <table>
      <tr><th>Nhu cầu</th><th>Swift</th><th>Jackson</th></tr>
      <tr><td>JSON <code>snake_case</code> → property camelCase</td><td><code>decoder.keyDecodingStrategy = .convertFromSnakeCase</code></td><td><code>PropertyNamingStrategies.SNAKE_CASE</code></td></tr>
      <tr><td>Đổi tên một field</td><td><code>enum CodingKeys: String, CodingKey { case id = "product_id" }</code> (nếu không dùng convertFromSnakeCase)</td><td><code>@JsonProperty</code></td></tr>
      <tr><td>Ngày ISO 8601</td><td><code>decoder.dateDecodingStrategy = .iso8601</code></td><td><code>JavaTimeModule</code></td></tr>
      <tr><td>Field có thể thiếu/null</td><td>Khai báo Optional <code>String?</code></td><td>mặc định null</td></tr>
      <tr><td>Field lạ không khai báo</td><td>Bị bỏ qua</td><td>tuỳ <code>FAIL_ON_UNKNOWN_PROPERTIES</code></td></tr>
      <tr><td>Field bắt buộc bị thiếu / sai kiểu</td><td>Ném <code>DecodingError</code> (keyNotFound, typeMismatch…)</td><td>tuỳ cấu hình</td></tr>
    </table>
    <p>Enum có raw value String Codable được — nhưng nếu server gửi giá trị mới chưa có case, decode <strong>thất bại cả object</strong>. Với enum từ server hay thay đổi, tự viết <code>init(from:)</code> có case <code>unknown</code>. Lưu ý <code>.iso8601</code> mặc định không nhận phần giây lẻ (<code>.123Z</code>) — cần strategy tuỳ biến nếu server trả kiểu đó.</p>

    <p><strong>Thiết kế</strong>: gói trong một <code>APIClient</code> (thường là struct hoặc actor) với hàm generic <code>func send&lt;T: Decodable&gt;(_ endpoint: Endpoint) async throws -&gt; T</code>: dựng request, gắn token, kiểm tra status, decode, map lỗi về enum <code>APIError</code>. ViewModel chỉ thấy kiểu Swift.</p>

    <div class="callout"><p>💡 Tạo <code>JSONDecoder</code> một lần và tái sử dụng (cấu hình strategy ở một chỗ). Log body lỗi khi decode thất bại: <code>DecodingError</code> cho biết đúng đường dẫn field sai — quý hơn mọi stack trace.</p></div>
  `,

  codeTabs: [
    { id: "model", label: "Model Codable", lines: [
      "// JSON: {\"product_id\":\"p1\",\"display_name\":\"Áo\",\"price\":199000,",
      "//        \"created_at\":\"2026-01-05T09:00:00Z\",\"tags\":null}",
      "struct Product: Codable, Identifiable, Sendable {",
      "    let id: String",
      "    let displayName: String       // convertFromSnakeCase: display_name",
      "    let price: Decimal",
      "    let createdAt: Date           // iso8601",
      "    let tags: [String]?           // null hoặc thiếu → nil",
      "",
      "    enum CodingKeys: String, CodingKey {",
      "        case id = \"productId\"   // key đã qua convertFromSnakeCase: product_id → productId",
      "        case displayName, price, createdAt, tags",
      "    }",
      "}"
    ]},
    { id: "client", label: "APIClient", lines: [
      "enum APIError: Error { case http(Int, Data), decoding(Error), transport(URLError) }",
      "",
      "struct APIClient: Sendable {",
      "    let baseURL: URL",
      "    let session: URLSession = .shared",
      "    private static let decoder: JSONDecoder = {",
      "        let d = JSONDecoder()",
      "        d.keyDecodingStrategy = .convertFromSnakeCase",
      "        d.dateDecodingStrategy = .iso8601",
      "        return d",
      "    }()",
      "",
      "    func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {",
      "        var req = URLRequest(url: baseURL.appending(path: path).appending(queryItems: query))",
      "        req.setValue(\"application/json\", forHTTPHeaderField: \"Accept\")",
      "        let result: (Data, URLResponse)",
      "        do { result = try await session.data(for: req) }",
      "        catch let e as URLError { throw APIError.transport(e) }",
      "        let (data, resp) = result; let status = (resp as? HTTPURLResponse)?.statusCode ?? 0",
      "        guard (200..<300).contains(status) else { throw APIError.http(status, data) }",
      "        do { return try Self.decoder.decode(T.self, from: data) }",
      "        catch { throw APIError.decoding(error) }",
      "    }",
      "}"
    ]},
    { id: "post", label: "POST JSON", lines: [
      "struct CreateOrder: Encodable { let cartId: String; let note: String? }",
      "",
      "func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {",
      "    var req = URLRequest(url: baseURL.appending(path: path))",
      "    req.httpMethod = \"POST\"",
      "    req.setValue(\"application/json\", forHTTPHeaderField: \"Content-Type\")",
      "    let enc = JSONEncoder(); enc.keyEncodingStrategy = .convertToSnakeCase",
      "    req.httpBody = try enc.encode(body)",
      "    let (data, _) = try await session.data(for: req)   // + kiểm tra status như get",
      "    return try Self.decoder.decode(T.self, from: data)",
      "}"
    ]},
    { id: "enum", label: "Enum chịu giá trị lạ", lines: [
      "enum OrderStatus: Decodable, Sendable {",
      "    case pending, paid, shipped, unknown(String)",
      "    init(from decoder: Decoder) throws {",
      "        let raw = try decoder.singleValueContainer().decode(String.self)",
      "        switch raw {",
      "        case \"pending\": self = .pending",
      "        case \"paid\":    self = .paid",
      "        case \"shipped\": self = .shipped",
      "        default:        self = .unknown(raw)   // server thêm giá trị mới: app cũ không vỡ",
      "        }",
      "    }",
      "}"
    ]},
    { id: "java", label: "So với Spring", lines: [
      "Product p = restClient.get()",
      "    .uri(\"/products/{id}\", id)",
      "    .retrieve()                      // 4xx/5xx → ném exception",
      "    .body(Product.class);            // Jackson, reflection lúc chạy",
      "",
      "// Swift: URLSession không ném với 4xx/5xx — tự kiểm tra statusCode",
      "// Codable sinh code lúc biên dịch, sai kiểu → DecodingError có codingPath"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vm"><div class="nl">ViewModel</div><div class="ns">let p: [Product] = try await api.get("/products")</div></div>
    <div class="arrow" id="a1">↓ dựng URLRequest</div>
    <div class="node" id="session"><div class="nl">URLSession.data(for:)</div><div class="ns">lỗi mạng/huỷ → URLError</div></div>
    <div class="arrow" id="a2">↓ (Data, HTTPURLResponse)</div>
    <div class="node" id="status"><div class="nl">Kiểm tra statusCode</div><div class="ns">4xx/5xx KHÔNG tự ném</div></div>
    <div class="arrow" id="a3">↓ 2xx</div>
    <div class="node" id="decode"><div class="nl">JSONDecoder.decode(T.self)</div><div class="ns">snake_case · iso8601 · CodingKeys</div></div>
  `,
  steps: [
    { title: "1 · Model Codable", tab: "model", highlight: [3, 5, 7, 8], on: ["decode"],
      desc: "Compiler sinh code decode. Optional cho field có thể null/thiếu." },
    { title: "2 · CodingKeys đổi tên riêng lẻ", tab: "model", highlight: [10, 11, 12], on: ["decode"],
      desc: "Khi có CodingKeys, phải liệt kê mọi field muốn encode/decode. Bẫy: <code>convertFromSnakeCase</code> chạy <em>trước</em>, nên raw value phải là <code>productId</code> chứ không phải <code>product_id</code>." },
    { title: "3 · Decoder cấu hình một lần", tab: "client", highlight: [6, 7, 8, 9, 10], on: ["decode"],
      desc: "<code>.convertFromSnakeCase</code> đổi key JSON sang camelCase trước khi so với CodingKeys." },
    { title: "4 · Gửi request", tab: "client", highlight: [13, 14, 17, 18], on: ["vm", "a1", "session"],
      desc: "<code>data(for:)</code> là async; lỗi tầng mạng thành <code>URLError</code>." },
    { title: "5 · Tự kiểm tra status", tab: "client", highlight: [19, 20], on: ["a2", "status"],
      desc: "404/500 vẫn 'thành công' ở tầng URLSession. Quên dòng 20 là decode body lỗi thành sản phẩm → DecodingError khó hiểu." },
    { title: "6 · Decode generic", tab: "client", highlight: [21, 22], on: ["a3", "decode"],
      desc: "<code>T.self</code> có thật lúc chạy (bài 06). Lỗi decode được gói lại để ViewModel xử lý thống nhất." },
    { title: "7 · Enum chịu giá trị mới", tab: "enum", highlight: [2, 3, 4, 9], on: ["decode"],
      desc: "Raw-value enum sẽ làm decode thất bại khi server thêm trạng thái. Case <code>unknown</code> giữ app cũ không vỡ." }
  ],

  quiz: [
    { q: "URLSession.data(for:) nhận HTTP 500 thì?", options: [
        "Ném URLError", "Trả về bình thường (Data, response); bạn phải tự kiểm tra statusCode", "Crash", "Tự retry"
      ], correct: 1, explanation: "Chỉ lỗi tầng mạng mới ném." },
    { q: "JSON có key display_name, struct có displayName. Cấu hình nào khớp tự động?", options: [
        "dateDecodingStrategy", "keyDecodingStrategy = .convertFromSnakeCase", "outputFormatting", "Không làm được"
      ], correct: 1, explanation: "Tương đương SNAKE_CASE naming strategy của Jackson." },
    { q: "Field JSON có thể là null hoặc vắng mặt. Khai báo property thế nào?", options: [
        "String", "String? (Optional)", "String!", "Any"
      ], correct: 1, explanation: "Non-optional thiếu key sẽ ném keyNotFound." },
    { q: "Codable khác Jackson ở cơ chế nào?", options: [
        "Giống hệt",
        "Code encode/decode được compiler sinh lúc biên dịch, không reflection lúc chạy",
        "Codable dùng XML",
        "Codable chỉ đọc được"
      ], correct: 1, explanation: "Synthesized conformance." },
    { q: "Server thêm status 'refunded' mà enum OrderStatus: String, Codable chưa có case đó?", options: [
        "Tự thành nil", "Decode cả object thất bại (DataCorrupted)", "Bỏ qua field", "Tạo case mới"
      ], correct: 1, explanation: "Dùng init(from:) tự viết với case unknown." },
    { q: "Khi đã khai báo CodingKeys, field không liệt kê trong đó thì?", options: [
        "Vẫn decode",
        "Không được encode/decode (phải có giá trị mặc định nếu muốn decode được struct)",
        "Lỗi runtime",
        "Tự snake_case"
      ], correct: 1, explanation: "CodingKeys định nghĩa tập key tham gia." },
    { q: "Huỷ Task đang chờ URLSession thì?", options: [
        "Request vẫn chạy", "Request bị huỷ, ném URLError với code .cancelled", "Crash", "Trả Data rỗng"
      ], correct: 1, explanation: "URLSession tích hợp huỷ hợp tác." },
    { q: "App gọi http:// (không s) bị chặn. Nguyên nhân?", options: [
        "Lỗi URLSession", "App Transport Security mặc định yêu cầu HTTPS", "Thiếu quyền mạng", "Simulator"
      ], correct: 1, explanation: "Cần khai ngoại lệ ATS trong Info.plist (chỉ khi thật cần)." },
    { q: "Vì sao nên tạo JSONDecoder một lần và dùng lại?", options: [
        "Bắt buộc",
        "Cấu hình strategy ở một chỗ, tránh lệch; và tránh tạo object lặp lại",
        "Decoder không thread-safe nên phải một cái",
        "Để cache JSON"
      ], correct: 1, explanation: "Thống nhất snake_case/date strategy toàn app." },
    { q: "Decoder dùng convertFromSnakeCase; JSON có key product_id muốn map vào property id. CodingKeys nên viết?", options: [
        "case id = \"product_id\"", "case id = \"productId\"", "case product_id", "Không cần CodingKeys"
      ], correct: 1, explanation: "Key được chuyển thành productId trước rồi mới so với CodingKeys, nên \"product_id\" sẽ không khớp." }
  ]
});
