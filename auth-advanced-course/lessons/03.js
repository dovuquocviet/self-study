window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "OAuth 1.0a",
  title: "Chữ ký OAuth 1.0a — tính oauth_signature từng bước",
  subtitle: "Signature base string · khoá HMAC · nonce + timestamp · header Authorization: OAuth",

  theory: `
    <p>Điểm làm nên OAuth 1.0a là <strong>mỗi request đều được ký</strong>. Server tự tính lại chữ ký từ cùng dữ liệu;
    khớp thì chứng tỏ người gửi có cả hai secret và request không bị sửa dọc đường. Hầu hết lỗi <code>401 invalid signature</code> khi tích hợp đến từ một bước nhỏ sai trong quy trình dưới đây.</p>

    <p><strong>5 bước tính chữ ký (HMAC-SHA1)</strong></p>
    <ol>
      <li><strong>Gom tham số</strong>: toàn bộ query string + body dạng <code>application/x-www-form-urlencoded</code> (nếu có) + các tham số <code>oauth_*</code> (trừ <code>oauth_signature</code>). Body JSON <em>không</em> tham gia.</li>
      <li><strong>Chuẩn hoá</strong>: percent-encode từng key và value theo RFC 3986 (chỉ giữ nguyên <code>A-Z a-z 0-9 - . _ ~</code>), <em>sắp xếp</em> theo key rồi value, nối <code>key=value</code> bằng <code>&amp;</code>.</li>
      <li><strong>Signature base string</strong> = <code>METHOD</code> &amp; encode(base URL) &amp; encode(chuỗi tham số bước 2). Base URL: scheme + host viết thường, bỏ port mặc định, bỏ query.</li>
      <li><strong>Khoá</strong> = encode(consumer_secret) &amp; encode(token_secret). Chưa có token (bước request_token) thì vẫn giữ dấu <code>&amp;</code> ở cuối.</li>
      <li><strong>Chữ ký</strong> = Base64(HMAC-SHA1(khoá, base string)) → đặt vào <code>oauth_signature</code> (nhớ percent-encode khi đưa vào header).</li>
    </ol>

    <p><strong>Nonce và timestamp — chống phát lại (replay)</strong>: <code>oauth_timestamp</code> là giây Unix; server từ chối request quá cũ/lệch giờ.
    <code>oauth_nonce</code> là chuỗi ngẫu nhiên duy nhất; server nhớ nonce đã dùng trong khoảng thời gian cho phép. Đồng hồ máy chủ client lệch vài phút là đủ bị từ chối.</p>

    <p><strong>Các phương thức ký</strong></p>
    <table>
      <tr><th>oauth_signature_method</th><th>Ghi chú</th></tr>
      <tr><td><code>HMAC-SHA1</code></td><td>Phổ biến nhất (Magento, X API v1.1, WooCommerce). SHA-1 yếu cho chữ ký số nhưng HMAC-SHA1 vẫn chưa bị phá thực tế.</td></tr>
      <tr><td><code>HMAC-SHA256</code></td><td>Không có trong RFC 5849 nhưng nhiều provider hỗ trợ (Magento 2 hỗ trợ cả hai).</td></tr>
      <tr><td><code>RSA-SHA1</code></td><td>Ký bằng khoá riêng RSA của client thay vì consumer secret (Jira/Confluence Application Link).</td></tr>
      <tr><td><code>PLAINTEXT</code></td><td>Gửi thẳng secret — chỉ chấp nhận qua TLS; gần như không nên dùng.</td></tr>
    </table>

    <div class="callout"><p>💡 Đừng tự viết thuật toán ký trong code production — dùng thư viện OAuth 1 có sẵn của ngôn ngữ (requests-oauthlib, oauth-1.0a cho Node, scribejava, signpost…).
    Nhưng hiểu 5 bước này giúp bạn debug được lỗi <em>invalid signature</em> trong vài phút thay vì vài ngày: in ra base string của client và so với server.</p></div>
  `,

  codeTabs: [
    { id: "params", label: "① Tham số", lines: [
      "# Request: GET https://shop.example.com/rest/V1/orders?searchCriteria[pageSize]=10",
      "# Credential: consumer_key=ck123  consumer_secret=cs789",
      "#             token=at456         token_secret=ats000",
      "",
      "searchCriteria[pageSize] = 10          # từ query string",
      "oauth_consumer_key       = ck123",
      "oauth_token              = at456",
      "oauth_signature_method   = HMAC-SHA1",
      "oauth_timestamp          = 1790000000",
      "oauth_nonce              = k9f3a1x7",
      "oauth_version            = 1.0"
    ]},
    { id: "norm", label: "② Chuẩn hoá", lines: [
      "# encode từng key/value -> sắp xếp theo key -> nối bằng &",
      "oauth_consumer_key=ck123",
      "&oauth_nonce=k9f3a1x7",
      "&oauth_signature_method=HMAC-SHA1",
      "&oauth_timestamp=1790000000",
      "&oauth_token=at456",
      "&oauth_version=1.0",
      "&searchCriteria%5BpageSize%5D=10      # [ ] đã encode thành %5B %5D",
      "",
      "# (thực tế là MỘT dòng, xuống dòng ở đây cho dễ đọc)"
    ]},
    { id: "base", label: "③ Base string", lines: [
      "GET",
      "&https%3A%2F%2Fshop.example.com%2Frest%2FV1%2Forders",
      "&oauth_consumer_key%3Dck123%26oauth_nonce%3Dk9f3a1x7",
      "%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1790000000",
      "%26oauth_token%3Dat456%26oauth_version%3D1.0",
      "%26searchCriteria%255BpageSize%255D%3D10",
      "",
      "# Chuỗi tham số bị encode THÊM một lần: = -> %3D, & -> %26, %5B -> %255B"
    ]},
    { id: "sign", label: "④⑤ Ký & gửi", lines: [
      "key       = 'cs789' + '&' + 'ats000'            # = cs789&ats000",
      "signature = base64( HMAC_SHA1(key, baseString) )",
      "          = 'wFLbhjPZX1e7NQuBSJzXnSOkWmk='",
      "",
      "GET /rest/V1/orders?searchCriteria[pageSize]=10 HTTP/1.1",
      "Host: shop.example.com",
      "Authorization: OAuth oauth_consumer_key=\"ck123\", oauth_token=\"at456\",",
      "  oauth_signature_method=\"HMAC-SHA1\", oauth_timestamp=\"1790000000\",",
      "  oauth_nonce=\"k9f3a1x7\", oauth_version=\"1.0\",",
      "  oauth_signature=\"wFLbhjPZX1e7NQuBSJzXnSOkWmk%3D\""
    ]},
    { id: "debug", label: "🐞 Lỗi hay gặp", lines: [
      "# 401 invalid signature — kiểm tra theo thứ tự:",
      "1. Encode sai chuẩn (dấu cách phải là %20, không phải +; ~ không encode)",
      "2. Quên đưa query string hoặc form body vào tham số",
      "3. Đưa body JSON vào tham số (không được)",
      "4. Base URL có port mặc định / chữ hoa / có query",
      "5. Không sắp xếp, hoặc sắp xếp trước khi encode",
      "6. Encode chuỗi tham số chỉ một lần thay vì hai",
      "7. Khoá thiếu dấu & khi chưa có token secret",
      "8. Đồng hồ lệch -> timestamp bị từ chối; nonce dùng lại"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">① Gom tham số</div><div class="ns">query + form body + oauth_*</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="n"><div class="nl">② Encode + sắp xếp + nối</div><div class="ns">RFC 3986, theo key</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="b"><div class="nl">③ Base string</div><div class="ns">METHOD &amp; URL &amp; params (encode lần 2)</div></div>
    <div class="arrow" id="a3">↓ HMAC-SHA1 với khoá consumer_secret&amp;token_secret</div>
    <div class="node" id="s"><div class="nl">④⑤ oauth_signature</div><div class="ns">Base64 → header Authorization: OAuth</div></div>
  `,
  steps: [
    { title: "1 · Gom tham số", tab: "params", highlight: [5, 6, 7, 8, 9, 10, 11], on: ["p"],
      desc: "Query string + các tham số <code>oauth_*</code>. Nếu body là form-urlencoded thì cũng đưa vào; body JSON thì không." },
    { title: "2 · Chuẩn hoá", tab: "norm", highlight: [2, 3, 4, 5, 6, 7, 8], on: ["n", "a1"],
      desc: "Encode theo RFC 3986, sắp xếp theo key, nối bằng <code>&amp;</code>. <code>[</code> <code>]</code> thành <code>%5B</code> <code>%5D</code>." },
    { title: "3 · Dựng base string", tab: "base", highlight: [1, 2, 3, 6, 8], on: ["b", "a2"],
      desc: "Method, base URL đã encode, và chuỗi tham số được encode <strong>thêm một lần nữa</strong> — nên <code>%5B</code> thành <code>%255B</code>." },
    { title: "4 · Ký bằng hai secret", tab: "sign", highlight: [1, 2, 3], on: ["a3", "s"],
      desc: "Khoá = <code>cs789&amp;ats000</code>. HMAC-SHA1 rồi Base64 ra <code>wFLbhjPZX1e7NQuBSJzXnSOkWmk=</code> (tính thật, bạn có thể tự kiểm tra)." },
    { title: "5 · Gửi request", tab: "sign", highlight: [7, 8, 9, 10], on: ["s"],
      desc: "Chữ ký được percent-encode (<code>=</code> thành <code>%3D</code>) rồi đặt vào header. Secret không xuất hiện ở đâu." },
    { title: "6 · Debug invalid signature", tab: "debug", highlight: [2, 3, 6, 7, 9], on: ["n", "b"],
      desc: "90% lỗi nằm ở bước 2–3. Cách debug nhanh nhất: in base string ở client và so từng ký tự với tài liệu/log của server." }
  ],

  quiz: [
    { q: "Signature base string gồm 3 phần nào nối bằng '&'?", options: [
        "Consumer key, token, nonce",
        "HTTP method, base URL đã encode, chuỗi tham số đã chuẩn hoá (encode thêm lần nữa)",
        "Header, body, footer",
        "Timestamp, nonce, signature"
      ], correct: 1, explanation: "METHOD & encode(baseURL) & encode(normalizedParams)." },
    { q: "Body JSON của request có được đưa vào chuỗi tham số để ký không?", options: [
        "Có, luôn luôn",
        "Không — chỉ query string và body dạng form-urlencoded mới tham gia",
        "Chỉ khi dùng RSA-SHA1",
        "Chỉ field đầu tiên"
      ], correct: 1, explanation: "RFC 5849 chỉ tính tham số dạng form. Body khác không được ký (một điểm yếu của OAuth 1)." },
    { q: "Khi gọi request_token (chưa có token secret), khoá HMAC là gì?", options: [
        "consumer_secret",
        "consumer_secret& (vẫn có dấu & ở cuối)",
        "&consumer_secret",
        "Không cần khoá"
      ], correct: 1, explanation: "Khoá luôn có dạng A&B; B rỗng thì vẫn giữ dấu &." },
    { q: "oauth_nonce và oauth_timestamp dùng để làm gì?", options: [
        "Mã hoá body",
        "Chống replay: server từ chối request quá cũ hoặc nonce đã dùng",
        "Định danh user",
        "Chọn thuật toán ký"
      ], correct: 1, explanation: "Kẻ nghe lén không thể gửi lại nguyên request đã ký." },
    { q: "Dấu cách trong giá trị tham số phải được encode thành gì khi ký?", options: [
        "+", "%20", "_", "Giữ nguyên"
      ], correct: 1, explanation: "OAuth 1 dùng percent-encoding RFC 3986: dấu cách là %20. Dùng + là lỗi invalid signature kinh điển." },
    { q: "Vì sao trong base string thấy '%255B' thay vì '%5B'?", options: [
        "Lỗi của thư viện",
        "Chuỗi tham số (đã chứa %5B) được encode thêm một lần khi ghép vào base string",
        "Do dùng HMAC-SHA256",
        "Do URL có port"
      ], correct: 1, explanation: "% bị encode thành %25, nên %5B thành %255B." },
    { q: "Server kiểm tra chữ ký OAuth 1.0a bằng cách nào?", options: [
        "Giải mã chữ ký bằng khoá công khai",
        "Tự tính lại chữ ký từ request nhận được và các secret nó lưu, rồi so sánh",
        "Hỏi lại client",
        "Không kiểm tra, chỉ đọc consumer key"
      ], correct: 1, explanation: "HMAC là đối xứng: hai bên cùng biết secret nên server tính lại và so khớp." },
    { q: "Phương thức ký nào dùng khoá riêng RSA thay cho consumer secret?", options: [
        "HMAC-SHA1", "PLAINTEXT", "RSA-SHA1", "HMAC-SHA256"
      ], correct: 2, explanation: "RSA-SHA1: server giữ khoá công khai của client (hay gặp ở Jira/Confluence Application Link)." },
    { q: "Client liên tục bị 401 dù chữ ký tính đúng trên máy dev. Nguyên nhân có thể là?", options: [
        "Đồng hồ server chạy client bị lệch nên timestamp bị từ chối",
        "Consumer key quá ngắn",
        "Dùng GET thay vì POST",
        "Header viết thường"
      ], correct: 0, explanation: "Lệch giờ vài phút là đủ vượt cửa sổ timestamp. Đồng bộ NTP." }
  ]
});
