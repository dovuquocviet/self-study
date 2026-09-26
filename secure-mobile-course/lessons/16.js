window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Giao tiếp giữa các app",
  title: "WebView an toàn",
  subtitle: "JS bridge tối thiểu · allowlist URL · tắt truy cập file · không nạp nội dung không tin cậy · khi nào nên dùng system browser",

  theory: `
    <p>WebView là trình duyệt nhúng trong app: hiển thị trang điều khoản, trang thanh toán, nội dung CMS, hoặc cả một phần app viết bằng web (hybrid).
    Nguy hiểm nằm ở chỗ WebView <strong>trộn hai thế giới</strong>: nội dung web (có thể đến từ bất kỳ đâu) và quyền native của app (token, file, API thiết bị).
    Nếu nội dung web độc hại chạy được trong WebView có "cầu nối" tới native, nó có thể dùng quyền của app bạn.</p>

    <p><strong>1. Câu hỏi đầu tiên: có cần WebView không?</strong></p>
    <table>
      <tr><th>Nhu cầu</th><th>Lựa chọn tốt hơn</th></tr>
      <tr><td>Mở link bên ngoài (bài báo, trang đối tác)</td><td>System browser / Custom Tabs / <code>SFSafariViewController</code> — tách biệt khỏi app</td></tr>
      <tr><td>Đăng nhập OAuth</td><td><code>ASWebAuthenticationSession</code> / Custom Tabs (bài 11)</td></tr>
      <tr><td>Hiển thị nội dung của chính bạn (FAQ, điều khoản)</td><td>WebView với allowlist chặt, không bridge — hoặc render native</td></tr>
      <tr><td>Phần app viết bằng web (hybrid)</td><td>WebView với cấu hình đầy đủ ở dưới + bridge tối thiểu</td></tr>
    </table>

    <p><strong>2. Allowlist URL — chỉ nạp nội dung bạn kiểm soát</strong></p>
    <ul>
      <li>Chặn điều hướng tới host ngoài allowlist: Android <code>shouldOverrideUrlLoading</code>, iOS <code>decidePolicyFor navigationAction</code>, RN <code>onShouldStartLoadWithRequest</code> + <code>originWhitelist</code>, Flutter <code>NavigationDelegate.onNavigationRequest</code>.</li>
      <li>So sánh bằng <strong>host đã parse</strong> và so khớp chính xác (hoặc hậu tố có dấu chấm <code>.shop.com</code>) — không dùng <code>contains("shop.com")</code> vì <code>shop.com.attacker.example</code> cũng chứa chuỗi đó.</li>
      <li>Chỉ <code>https</code>. Link ngoài allowlist → mở bằng system browser.</li>
      <li>Không nạp URL lấy thẳng từ deep link, push, hay server không tin cậy (bài 14).</li>
    </ul>

    <p><strong>3. JavaScript bridge — bề mặt tấn công lớn nhất</strong></p>
    <ul>
      <li>Android <code>addJavascriptInterface</code>, iOS <code>WKScriptMessageHandler</code>, RN <code>onMessage</code>/<code>postMessage</code>, Flutter <code>JavaScriptChannel</code> cho phép JS gọi code native.</li>
      <li>Bất kỳ trang nào nạp vào WebView đó (kể cả iframe, kể cả trang bị redirect tới) đều có thể gọi bridge.</li>
      <li>Quy tắc:
        <ol>
          <li>Chỉ bật JavaScript khi cần; chỉ thêm bridge khi cần.</li>
          <li>Bridge <strong>tối thiểu</strong>: vài hàm cụ thể (<code>closeScreen</code>, <code>openProduct(id)</code>), không có hàm chung kiểu <code>exec(command)</code>, <code>getToken()</code>, <code>readFile(path)</code>.</li>
          <li>Mỗi lần nhận message: kiểm tra <strong>origin/URL hiện tại</strong> của frame gửi thuộc allowlist, và <strong>validate tham số</strong> như input API.</li>
          <li>Không đưa token cho JS. Nếu trang web cần gọi API: dùng cookie phiên riêng cho web ngắn hạn, hoặc để native gọi API thay.</li>
        </ol>
      </li>
      <li>Android: chỉ phương thức có <code>@JavascriptInterface</code> mới lộ ra JS (API 17+); vẫn giữ số lượng tối thiểu.</li>
    </ul>

    <p><strong>4. Tắt truy cập file và các tính năng thừa (Android)</strong></p>
    <ul>
      <li><code>setAllowFileAccess(false)</code>, <code>setAllowContentAccess(false)</code>; <code>allowFileAccessFromFileURLs</code> và <code>allowUniversalAccessFromFileURLs</code> luôn <code>false</code>.</li>
      <li>Nội dung cục bộ: dùng <code>WebViewAssetLoader</code> phục vụ asset qua URL <code>https://appassets.androidplatform.net/...</code> thay vì <code>file://</code>.</li>
      <li><code>setGeolocationEnabled(false)</code>, không tự cấp quyền trong <code>onPermissionRequest</code>, <code>setSupportMultipleWindows(false)</code> nếu không cần.</li>
      <li>Lỗi SSL → <code>cancel()</code>, không bao giờ <code>proceed()</code> (bài 08). Không bật <code>MIXED_CONTENT_ALWAYS_ALLOW</code>.</li>
      <li><code>WebView.setWebContentsDebuggingEnabled(true)</code> chỉ trong debug.</li>
    </ul>

    <p><strong>5. iOS</strong>: chỉ dùng <code>WKWebView</code> (UIWebView đã bị loại bỏ). Tránh <code>loadFileURL</code> với <code>allowingReadAccessTo</code> là cả thư mục lớn;
    chỉ cấp thư mục chứa đúng nội dung cần. <code>isInspectable</code> chỉ bật trong debug.</p>

    <p><strong>6. Nội dung động và XSS trong WebView</strong> — Nếu app dựng HTML từ dữ liệu (tên người dùng, bình luận) rồi <code>loadData</code>/<code>loadHTMLString</code>:
    phải escape HTML như trên web; nếu không, dữ liệu người dùng thành script chạy trong WebView — và nếu có bridge thì script đó gọi được native.
    Tránh <code>evaluateJavascript</code> với chuỗi ghép từ dữ liệu; truyền dữ liệu dạng JSON đã encode.</p>

    <p><strong>7. Cookie và dữ liệu web</strong>: xoá cookie, localStorage, cache của WebView khi logout (bài 07, 13). Không dùng chung WebView đã đăng nhập để mở trang bên ngoài.</p>

    <div class="callout"><p>💡 Mô hình tư duy: <strong>WebView có bridge = một trang web có quyền native</strong>. Hãy chắc chắn chỉ trang của bạn, qua HTTPS, được nạp vào đó,
    và bridge chỉ làm được những việc mà bạn sẵn sàng cho <em>bất kỳ</em> trang nào làm.</p></div>
  `,

  codeTabs: [
    { id: "android", label: "🤖 Android cấu hình", lines: [
      "webView.settings.apply {",
      "    javaScriptEnabled = true               // chỉ nếu trang cần",
      "    allowFileAccess = false",
      "    allowContentAccess = false",
      "    setGeolocationEnabled(false)",
      "    setSupportMultipleWindows(false)",
      "    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW",
      "}",
      "if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)",
      "",
      "// Nội dung cục bộ: qua https giả lập, không dùng file://",
      "val loader = WebViewAssetLoader.Builder()",
      "    .addPathHandler(\"/assets/\", WebViewAssetLoader.AssetsPathHandler(ctx)).build()",
      "webView.loadUrl(\"https://appassets.androidplatform.net/assets/help/index.html\")"
    ]},
    { id: "allow", label: "✅ Allowlist điều hướng", lines: [
      "ALLOWED = setOf(\"shop.com\", \"help.shop.com\")",
      "",
      "fun isAllowed(url: Uri): Boolean =",
      "    url.scheme == \"https\" && url.host in ALLOWED        // so khớp CHÍNH XÁC host",
      "",
      "override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {",
      "    if (isAllowed(req.url)) return false                  // cho WebView nạp",
      "    openInSystemBrowser(req.url); return true             // ngoài allowlist -> trình duyệt",
      "}",
      "",
      "// ❌ SAI: url.toString().contains(\"shop.com\")",
      "//    -> 'https://shop.com.attacker.example' cũng khớp"
    ]},
    { id: "bridge", label: "🌉 Bridge tối thiểu", lines: [
      "// ❌ Bridge quá mạnh",
      "class Bridge { @JavascriptInterface fun getToken() = tokenStore.access }",
      "",
      "// ✅ Vài hàm cụ thể, kiểm tra nguồn + validate tham số",
      "class ShopBridge(private val web: WebView) {",
      "    @JavascriptInterface",
      "    fun openProduct(id: String) {",
      "        web.post {",
      "            if (!isAllowed(Uri.parse(web.url))) return@post   // trang hiện tại phải thuộc allowlist",
      "            val pid = id.toLongOrNull() ?: return@post",
      "            navigator.openProduct(pid)",
      "        }",
      "    }",
      "}",
      "webView.addJavascriptInterface(ShopBridge(webView), \"ShopApp\")"
    ]},
    { id: "ios", label: "🍎 WKWebView", lines: [
      "let cfg = WKWebViewConfiguration()",
      "cfg.userContentController.add(handler, name: \"shop\")      // một kênh duy nhất",
      "let web = WKWebView(frame: .zero, configuration: cfg)",
      "#if DEBUG",
      "web.isInspectable = true",
      "#endif",
      "",
      "func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {",
      "    guard m.frameInfo.isMainFrame, let host = m.frameInfo.securityOrigin.host as String?,",
      "          allowedHosts.contains(host),",
      "          let body = m.body as? [String: Any], let action = body[\"action\"] as? String",
      "    else { return }",
      "    switch action { case \"close\": dismiss(animated: true); default: break }",
      "}",
      "",
      "func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: ...) {",
      "    decisionHandler(isAllowed(a.request.url) ? .allow : .cancel)",
      "}"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// React Native (react-native-webview)",
      "<WebView",
      "  source={{ uri: 'https://help.shop.com' }}",
      "  originWhitelist={['https://help.shop.com']}",
      "  onShouldStartLoadWithRequest={(r) => isAllowed(r.url)}",
      "  allowFileAccess={false} allowUniversalAccessFromFileURLs={false}",
      "  javaScriptEnabled={needsJs}",
      "  onMessage={(e) => { if (isAllowed(e.nativeEvent.url)) handle(safeParse(e.nativeEvent.data)) }}",
      "/>",
      "",
      "// Flutter (webview_flutter)",
      "controller",
      "  ..setJavaScriptMode(JavaScriptMode.disabled)       // bật nếu cần",
      "  ..setNavigationDelegate(NavigationDelegate(onNavigationRequest: (r) =>",
      "      isAllowed(r.url) ? NavigationDecision.navigate : NavigationDecision.prevent))"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="own"><div class="nl">🏠 Trang của bạn (HTTPS)</div><div class="ns">trong allowlist</div></div>
      <div class="node" id="foreign"><div class="nl">🌍 Trang lạ / bị chèn</div><div class="ns">link ngoài, iframe, XSS</div></div>
    </div>
    <div class="arrow" id="a1">↓ điều hướng</div>
    <div class="node" id="gate"><div class="nl">🚦 Allowlist host (so khớp chính xác)</div><div class="ns">ngoài danh sách → system browser</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="webview"><div class="nl">🪟 WebView</div><div class="ns">không file://, không mixed content, SSL lỗi → huỷ</div></div>
    <div class="arrow" id="a3">↓ postMessage</div>
    <div class="node" id="bridge"><div class="nl">🌉 JS bridge tối thiểu</div><div class="ns">kiểm origin · validate tham số · không lộ token</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="native"><div class="nl">📱 Quyền native của app</div><div class="ns">token, file, camera, API</div></div>
  `,

  steps: [
    { title: "1 · WebView trộn web và native", tab: "bridge", highlight: [2], on: ["foreign", "bridge", "native"],
      desc: "Bridge kiểu <code>getToken()</code> nghĩa là bất kỳ trang nào lọt vào WebView đều lấy được token. Nội dung web phải được coi là không đáng tin." },
    { title: "2 · Allowlist điều hướng", tab: "allow", highlight: [1, 4, 7, 8, 11, 12], on: ["a1", "gate"],
      desc: "Chỉ https và host khớp chính xác. <code>contains</code> bị lừa bởi host dài có chứa tên miền của bạn. Ngoài allowlist → mở trình duyệt hệ thống." },
    { title: "3 · Tắt tính năng thừa", tab: "android", highlight: [3, 4, 5, 6, 7, 9], on: ["gate", "a2", "webview"],
      desc: "Không file/content access, không geolocation, không nhiều cửa sổ, không mixed content; debug WebView chỉ bật ở bản debug." },
    { title: "4 · Nội dung cục bộ qua AssetLoader", tab: "android", highlight: [12, 13, 14], on: ["webview"],
      desc: "WebViewAssetLoader phục vụ asset qua một origin https riêng, tránh các quyền rộng của file:// URL." },
    { title: "5 · Bridge tối thiểu có kiểm tra", tab: "bridge", highlight: [7, 9, 10, 11, 15], on: ["a3", "bridge"],
      desc: "Một vài hàm cụ thể; mỗi lần gọi kiểm tra trang hiện tại thuộc allowlist và validate tham số (ID phải là số)." },
    { title: "6 · iOS: kiểm frameInfo", tab: "ios", highlight: [2, 4, 5, 9, 10, 11, 17], on: ["bridge", "a4", "native"],
      desc: "Kiểm message đến từ main frame với origin thuộc allowlist, body đúng cấu trúc; điều hướng lọc bằng decidePolicyFor." },
    { title: "7 · Cross-platform", tab: "xplat", highlight: [4, 5, 6, 7, 8, 13, 14, 15], on: ["gate", "webview", "bridge"],
      desc: "react-native-webview và webview_flutter có đủ tuỳ chọn: originWhitelist, chặn điều hướng, tắt file access, kiểm tra URL trong onMessage." }
  ],

  quiz: [
    { q: "Mở một bài báo bên ngoài từ app. Lựa chọn tốt nhất?", options: [
        "WebView có JS bridge đầy đủ",
        "System browser / Custom Tabs / SFSafariViewController",
        "WebView với allowFileAccess=true",
        "Tải HTML về rồi loadData"
      ], correct: 1,
      explanation: "Trình duyệt hệ thống tách biệt khỏi quyền của app." },
    { q: "Kiểm tra allowlist bằng url.contains(\"shop.com\") có vấn đề gì?", options: [
        "Không vấn đề",
        "Host như shop.com.attacker.example cũng khớp; phải so khớp chính xác host đã parse",
        "Chậm",
        "Không hỗ trợ HTTPS"
      ], correct: 1,
      explanation: "So sánh chuỗi con là lỗi kinh điển của allowlist." },
    { q: "Bridge có hàm @JavascriptInterface getToken(). Rủi ro?", options: [
        "Không rủi ro nếu dùng HTTPS",
        "Bất kỳ trang/script nào chạy trong WebView đó đều lấy được token",
        "Chỉ rủi ro trên iOS",
        "Token sẽ hết hạn nhanh hơn"
      ], correct: 1,
      explanation: "Không đưa token cho JS; bridge chỉ gồm hành động hẹp, có kiểm tra." },
    { q: "Cấu hình nào nên TẮT trên Android WebView nếu không cần?", options: [
        "HTTPS",
        "allowFileAccess, allowContentAccess, allowUniversalAccessFromFileURLs",
        "Safe Browsing",
        "Kiểm tra chứng chỉ"
      ], correct: 1,
      explanation: "Truy cập file từ WebView mở đường đọc dữ liệu cục bộ." },
    { q: "Cách phục vụ HTML/JS cục bộ an toàn trên Android?", options: [
        "file:///android_asset/ với allowUniversalAccessFromFileURLs=true",
        "WebViewAssetLoader qua https://appassets.androidplatform.net",
        "Copy vào Downloads rồi mở",
        "Dùng http://localhost không mã hoá"
      ], correct: 1,
      explanation: "AssetLoader cho nội dung cục bộ một origin https riêng." },
    { q: "App dựng HTML từ bình luận người dùng rồi loadHTMLString, WebView có bridge. Nguy cơ?", options: [
        "Không nguy cơ",
        "Bình luận chứa script sẽ chạy trong WebView và có thể gọi bridge native",
        "Chỉ lỗi hiển thị",
        "Chỉ nguy cơ khi offline"
      ], correct: 1,
      explanation: "Phải escape HTML như trên web; dữ liệu truyền vào JS dạng JSON đã encode." },
    { q: "iOS: nhận WKScriptMessage, cần kiểm tra gì?", options: [
        "Không cần kiểm tra",
        "Frame gửi (main frame), origin thuộc allowlist, cấu trúc và giá trị body",
        "Chỉ kiểm tra tên handler",
        "Chỉ kiểm tra độ dài message"
      ], correct: 1,
      explanation: "Message có thể đến từ iframe hoặc trang đã bị điều hướng sang nơi khác." },
    { q: "setWebContentsDebuggingEnabled(true) nên bật khi nào?", options: [
        "Luôn luôn",
        "Chỉ trong bản debug",
        "Chỉ trong bản release",
        "Khi người dùng yêu cầu"
      ], correct: 1,
      explanation: "Bật trong release cho phép công cụ debug kết nối và đọc/sửa nội dung WebView." },
    { q: "Logout thì dữ liệu WebView cần xử lý thế nào?", options: [
        "Giữ lại để lần sau nhanh hơn",
        "Xoá cookie, localStorage, cache của WebView",
        "Chỉ xoá lịch sử",
        "Không cần xử lý"
      ], correct: 1,
      explanation: "Cookie phiên web còn lại cho phép người dùng kế tiếp truy cập tài khoản." }
  ]
});
