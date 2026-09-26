window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Giao tiếp mạng",
  title: "HTTPS bắt buộc — và đừng tự phá nó",
  subtitle: "Cleartext · App Transport Security · Network Security Config · không bao giờ viết TrustManager 'chấp nhận mọi chứng chỉ'",

  theory: `
    <p>Điện thoại thay đổi mạng liên tục: Wi-Fi nhà, Wi-Fi quán cà phê, 4G, Wi-Fi khách sạn. Trên nhiều mạng trong số đó,
    <strong>người khác có thể nghe và sửa</strong> lưu lượng của bạn (man-in-the-middle, viết tắt MITM). HTTPS (HTTP trên TLS) giải quyết ba việc:</p>
    <ol>
      <li><strong>Bí mật</strong>: người giữa đường không đọc được nội dung.</li>
      <li><strong>Toàn vẹn</strong>: không sửa được nội dung mà không bị phát hiện.</li>
      <li><strong>Xác thực server</strong>: bạn đang nói chuyện với đúng <code>api.shop.com</code>, không phải kẻ mạo danh — nhờ <em>chứng chỉ</em> được một CA (cơ quan chứng thực) tin cậy ký.</li>
    </ol>
    <p>Điểm thứ 3 hay bị xem nhẹ nhất: mã hoá mà không kiểm tra <em>đang mã hoá với ai</em> thì kẻ MITM chỉ cần tự đưa ra chứng chỉ của họ.</p>

    <p><strong>1. Chặn HTTP thường (cleartext) ở mức nền tảng</strong></p>
    <ul>
      <li><strong>Android</strong>: từ Android 9 (API 28), cleartext bị chặn mặc định. Cấu hình bằng <em>Network Security Config</em> (<code>res/xml/network_security_config.xml</code>).
        Đừng bật <code>cleartextTrafficPermitted="true"</code> cho toàn app; nếu bắt buộc (thiết bị IoT nội bộ), chỉ bật cho đúng domain đó.
        <code>android:usesCleartextTraffic="true"</code> trong manifest là dấu hiệu đỏ khi review.</li>
      <li><strong>iOS</strong>: <em>App Transport Security</em> (ATS) mặc định bắt buộc HTTPS với TLS 1.2+ và cipher mạnh. Tránh <code>NSAllowsArbitraryLoads = YES</code>;
        nếu cần ngoại lệ, dùng <code>NSExceptionDomains</code> cho đúng domain và ghi rõ lý do (Apple có thể hỏi khi review).</li>
      <li><strong>React Native / Flutter</strong>: chạy trên nền native nên tuân theo cấu hình trên. Lưu ý: template RN có thể bật cleartext cho bản debug
        (để kết nối Metro trên máy dev) — đảm bảo cấu hình đó <em>chỉ</em> nằm trong build debug.</li>
    </ul>

    <p><strong>2. Lỗi kinh điển: tắt kiểm tra chứng chỉ</strong></p>
    <p>Trong lúc phát triển, server test dùng chứng chỉ tự ký → app báo lỗi SSL. Lập trình viên tìm được "cách sửa nhanh" trên mạng:
    viết một TrustManager / HostnameVerifier / delegate <em>chấp nhận mọi thứ</em>. Code này sau đó lọt vào bản release.
    Kết quả: HTTPS vẫn "xanh" nhưng <strong>bất kỳ ai trên cùng mạng</strong> đưa ra chứng chỉ bất kỳ đều đọc/sửa được toàn bộ traffic, kể cả mật khẩu và token.</p>
    <table>
      <tr><th>Nền tảng</th><th>Dạng lỗi (không được có trong code)</th></tr>
      <tr><td>Android / Kotlin</td><td>X509TrustManager có <code>checkServerTrusted</code> rỗng; HostnameVerifier luôn trả true; WebViewClient gọi <code>handler.proceed()</code> trong <code>onReceivedSslError</code></td></tr>
      <tr><td>iOS / Swift</td><td>Delegate <code>urlSession(_:didReceive:completionHandler:)</code> luôn trả <code>.useCredential</code> mà không đánh giá trust</td></tr>
      <tr><td>Flutter</td><td><code>badCertificateCallback</code> trả true cho mọi host</td></tr>
      <tr><td>React Native / JS</td><td>Thư viện/cấu hình tắt xác minh TLS; patch native module bỏ kiểm tra</td></tr>
    </table>
    <p>Google Play và các công cụ quét tĩnh sẽ gắn cờ các mẫu này; một số trường hợp app bị từ chối.</p>

    <p><strong>3. Cách đúng khi cần tin chứng chỉ test</strong></p>
    <ul>
      <li>Dùng chứng chỉ thật cho staging (Let's Encrypt miễn phí) — giải pháp tốt nhất.</li>
      <li>Nếu bắt buộc dùng CA nội bộ: Android dùng <code>&lt;debug-overrides&gt;</code> trong Network Security Config — chỉ có hiệu lực khi app <code>debuggable</code>.
        iOS cài profile CA vào máy test (không đổi code).</li>
      <li>Không bao giờ đặt cờ kiểu <code>if (BuildConfig.DEBUG) trustAll()</code> — flavor/cấu hình sai là lọt vào release.</li>
    </ul>

    <p><strong>4. Người dùng tự cài CA</strong> — Từ Android 7, app mặc định <em>không</em> tin CA do người dùng tự cài (chỉ tin CA hệ thống). Đừng mở rộng thêm
    <code>&lt;certificates src="user"/&gt;</code> cho bản release trừ khi thật sự cần (ví dụ app doanh nghiệp).</p>

    <p><strong>5. Những thứ HTTPS KHÔNG giải quyết</strong></p>
    <ul>
      <li>Người dùng (chủ thiết bị) vẫn đọc được traffic của chính họ bằng proxy + cài CA trên máy root. Đó là lý do API không được tin client (bài 01, 10).</li>
      <li>Dữ liệu sau khi đến server / trước khi rời app — cần các biện pháp khác.</li>
      <li>Kết nối không phải HTTP: WebSocket phải là <code>wss://</code>; MQTT, gRPC, socket tự viết cũng phải bật TLS và kiểm tra chứng chỉ.</li>
    </ul>

    <div class="callout"><p>💡 Quy tắc review: tìm các từ khoá <code>TrustManager</code>, <code>HostnameVerifier</code>, <code>onReceivedSslError</code>, <code>badCertificateCallback</code>,
    <code>NSAllowsArbitraryLoads</code>, <code>usesCleartextTraffic</code>, <code>http://</code> trong codebase. Mỗi kết quả phải có lý do rõ ràng.</p></div>
  `,

  codeTabs: [
    { id: "nsc", label: "🤖 Network Security Config", lines: [
      "<!-- res/xml/network_security_config.xml -->",
      "<network-security-config>",
      "  <base-config cleartextTrafficPermitted=\"false\">",
      "    <trust-anchors><certificates src=\"system\"/></trust-anchors>",
      "  </base-config>",
      "",
      "  <!-- Chỉ khi debuggable: tin thêm CA nội bộ của môi trường test -->",
      "  <debug-overrides>",
      "    <trust-anchors><certificates src=\"@raw/staging_ca\"/></trust-anchors>",
      "  </debug-overrides>",
      "</network-security-config>",
      "",
      "<!-- AndroidManifest.xml -->",
      "<application android:networkSecurityConfig=\"@xml/network_security_config\">"
    ]},
    { id: "ats", label: "🍎 App Transport Security", lines: [
      "<!-- Info.plist: KHÔNG làm thế này -->",
      "<key>NSAppTransportSecurity</key>",
      "<dict><key>NSAllowsArbitraryLoads</key><true/></dict>",
      "",
      "<!-- Nếu thật sự cần ngoại lệ: chỉ đúng một domain, có lý do -->",
      "<key>NSAppTransportSecurity</key>",
      "<dict>",
      "  <key>NSExceptionDomains</key>",
      "  <dict><key>legacy-printer.local</key>",
      "    <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/></dict>",
      "  </dict>",
      "</dict>"
    ]},
    { id: "bad", label: "❌ Tắt kiểm tra (đừng làm)", lines: [
      "// Các mẫu này PHẢI bị chặn trong review / lint",
      "",
      "// Kotlin: TrustManager không kiểm tra gì",
      "override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) { }",
      "// Kotlin: bỏ qua lỗi SSL trong WebView",
      "override fun onReceivedSslError(v: WebView, h: SslErrorHandler, e: SslError) { h.proceed() }",
      "",
      "// Swift: tin mọi server trust",
      "completionHandler(.useCredential, URLCredential(trust: challenge.protectionSpace.serverTrust!))",
      "",
      "// Dart",
      "client.badCertificateCallback = (cert, host, port) => true;",
      "",
      "// Hậu quả: ai trên cùng Wi-Fi cũng đọc/sửa được toàn bộ request"
    ]},
    { id: "good", label: "✅ Đúng cách", lines: [
      "// Mặc định của nền tảng ĐÃ kiểm tra chứng chỉ đúng — hãy để yên",
      "val client = OkHttpClient.Builder().build()              // Android",
      "let session = URLSession(configuration: .default)          // iOS",
      "final dio = Dio();                                         // Flutter",
      "fetch('https://api.shop.com/me')                           // React Native",
      "",
      "// WebView: lỗi SSL -> huỷ, không proceed",
      "override fun onReceivedSslError(v: WebView, h: SslErrorHandler, e: SslError) {",
      "    h.cancel(); showNetworkError()",
      "}",
      "",
      "// WebSocket / realtime",
      "connect('wss://rt.shop.com/socket')                       // không dùng ws://"
    ]},
    { id: "ci", label: "🔍 Lint trong CI", lines: [
      "# Chặn merge nếu phát hiện mẫu nguy hiểm (grep đơn giản, bổ sung cho SAST)",
      "PATTERNS='checkServerTrusted|HostnameVerifier|onReceivedSslError|badCertificateCallback'",
      "PATTERNS=\"$PATTERNS|NSAllowsArbitraryLoads|usesCleartextTraffic|cleartextTrafficPermitted=.true\"",
      "grep -rEn \"$PATTERNS\" android ios lib src && echo 'Cần review bảo mật' && exit 1",
      "",
      "# Tìm URL http:// (trừ localhost trong cấu hình debug)",
      "grep -rEn 'http://' src lib | grep -v localhost"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">gửi token, mật khẩu, dữ liệu cá nhân</div></div>
    <div class="arrow" id="a1">↓ qua Wi-Fi công cộng</div>
    <div class="node" id="mitm"><div class="nl">🕵️ Kẻ trung gian (MITM)</div><div class="ns">đưa ra chứng chỉ giả</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="check"><div class="nl">✅ App kiểm tra chứng chỉ</div><div class="ns">CA hệ thống + đúng hostname → từ chối kẻ giả</div></div>
      <div class="node" id="trustall"><div class="nl">❌ TrustManager rỗng</div><div class="ns">chấp nhận chứng chỉ giả → lộ hết</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="server"><div class="nl">🖥️ api.shop.com</div><div class="ns">chứng chỉ thật do CA ký</div></div>
  `,

  steps: [
    { title: "1 · Chặn cleartext toàn app", tab: "nsc", highlight: [3, 4, 14], on: ["app", "check"],
      desc: "Network Security Config: không cho HTTP thường, chỉ tin CA hệ thống. Đây là cấu hình nền mà mọi request (kể cả của SDK) đều tuân theo." },
    { title: "2 · CA test chỉ cho bản debug", tab: "nsc", highlight: [8, 9, 10], on: ["check"],
      desc: "<code>debug-overrides</code> chỉ có hiệu lực khi app debuggable — không thể vô tình lọt vào release như một cờ if trong code." },
    { title: "3 · iOS: giữ ATS bật", tab: "ats", highlight: [3, 8, 9, 10], on: ["app"],
      desc: "<code>NSAllowsArbitraryLoads</code> tắt ATS cho mọi domain. Nếu cần ngoại lệ, chỉ mở cho đúng domain và ghi lý do." },
    { title: "4 · Kẻ trung gian đưa chứng chỉ giả", tab: "bad", highlight: [4, 6, 9, 12, 14], on: ["a1", "mitm", "a2", "trustall"],
      desc: "Nếu code chấp nhận mọi chứng chỉ, kẻ MITM chỉ cần tự tạo một chứng chỉ. Kết nối vẫn là 'HTTPS' nhưng đầu bên kia là kẻ tấn công." },
    { title: "5 · Để mặc định làm việc", tab: "good", highlight: [2, 3, 4, 5, 9, 13], on: ["check", "a3", "server"],
      desc: "HTTP client mặc định của mọi nền tảng đã kiểm tra chuỗi chứng chỉ và hostname. Lỗi SSL trong WebView → huỷ. Realtime dùng wss://." },
    { title: "6 · Chặn bằng CI", tab: "ci", highlight: [2, 3, 4, 7], on: ["trustall"],
      desc: "Một bước grep đơn giản trong CI bắt được phần lớn các 'fix nhanh' nguy hiểm trước khi merge. Kết hợp thêm công cụ SAST cho mobile." }
  ],

  quiz: [
    { q: "HTTPS đảm bảo ba điều gì?", options: [
        "Tốc độ, nén, cache",
        "Bí mật, toàn vẹn và xác thực server",
        "Chống DDoS, chống spam, chống bot",
        "Ẩn địa chỉ IP người dùng"
      ], correct: 1,
      explanation: "Xác thực server nhờ chứng chỉ là phần hay bị phá nhất khi lập trình viên tắt kiểm tra." },
    { q: "Một X509TrustManager có checkServerTrusted rỗng dẫn tới điều gì?", options: [
        "Kết nối nhanh hơn, vẫn an toàn",
        "App chấp nhận chứng chỉ bất kỳ, kẻ MITM đọc/sửa được toàn bộ traffic",
        "App không kết nối được server nào",
        "Chỉ ảnh hưởng bản debug"
      ], correct: 1,
      explanation: "Mã hoá vẫn có nhưng với kẻ tấn công. Đây là lỗi nghiêm trọng và phổ biến." },
    { q: "Cách đúng để app debug tin CA nội bộ của server staging trên Android?", options: [
        "if (BuildConfig.DEBUG) dùng TrustManager chấp nhận mọi thứ",
        "Dùng <debug-overrides> trong Network Security Config",
        "Tắt HTTPS cho staging",
        "Thêm <certificates src=\"user\"/> vào base-config của release"
      ], correct: 1,
      explanation: "debug-overrides chỉ hiệu lực khi app debuggable. Tốt nhất vẫn là dùng chứng chỉ thật cho staging." },
    { q: "NSAllowsArbitraryLoads = YES trong Info.plist có tác dụng gì?", options: [
        "Bật HTTP/3",
        "Tắt App Transport Security cho mọi domain, cho phép HTTP thường",
        "Tăng tốc tải ảnh",
        "Bắt buộc certificate pinning"
      ], correct: 1,
      explanation: "Nên dùng NSExceptionDomains cho đúng domain cần ngoại lệ thay vì tắt toàn bộ." },
    { q: "WebView gặp lỗi SSL. onReceivedSslError nên làm gì?", options: [
        "Gọi handler.proceed() để trang vẫn hiện",
        "Gọi handler.cancel() và hiển thị lỗi",
        "Tắt JavaScript rồi proceed",
        "Chuyển sang http://"
      ], correct: 1,
      explanation: "proceed() bỏ qua lỗi chứng chỉ — tương đương TrustManager rỗng." },
    { q: "Từ Android 7, app mặc định tin loại CA nào?", options: [
        "Cả CA hệ thống và CA người dùng tự cài",
        "Chỉ CA hệ thống",
        "Chỉ CA người dùng",
        "Không tin CA nào"
      ], correct: 1,
      explanation: "Điều này giúp giảm rủi ro người dùng bị lừa cài CA độc. Không nên mở rộng cho bản release." },
    { q: "App dùng HTTPS đúng. Người dùng (chủ máy) có đọc được traffic của chính app không?", options: [
        "Không bao giờ",
        "Có thể, bằng proxy + cài CA trên máy họ kiểm soát (root); vì vậy server không được tin client",
        "Chỉ trên iOS",
        "Chỉ khi dùng 4G"
      ], correct: 1,
      explanation: "HTTPS bảo vệ khỏi bên thứ ba trên mạng, không phải khỏi chủ thiết bị." },
    { q: "Kết nối realtime nên dùng URL nào?", options: [
        "ws://rt.shop.com/socket",
        "wss://rt.shop.com/socket",
        "http://rt.shop.com/socket",
        "tcp://rt.shop.com"
      ], correct: 1,
      explanation: "wss:// là WebSocket qua TLS; ws:// là plaintext." },
    { q: "Dart: client.badCertificateCallback = (cert, host, port) => true; có ý nghĩa gì?", options: [
        "Bật kiểm tra chứng chỉ chặt hơn",
        "Chấp nhận mọi chứng chỉ không hợp lệ — tắt xác thực server",
        "Chỉ log lỗi",
        "Bật pinning"
      ], correct: 1,
      explanation: "Cùng bản chất với TrustManager rỗng: không được xuất hiện trong code phát hành." }
  ]
});
