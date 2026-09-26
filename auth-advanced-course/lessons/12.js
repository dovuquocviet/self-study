window.LESSONS.push({
  id: "12",
  phase: "4", phaseName: "Các chuẩn hiện đại",
  title: "Token gắn khoá: DPoP (RFC 9449) & mTLS (RFC 8705)",
  subtitle: "Từ 'ai cầm cũng dùng được' sang 'phải chứng minh sở hữu khoá' — claim cnf",

  theory: `
    <p>Điểm yếu cố hữu của bearer token: lộ ra (log, proxy, XSS, thiết bị bị nhiễm) là dùng được. <strong>Sender-constrained token</strong> gắn token với một khoá
    mà chỉ client hợp lệ có; muốn dùng token phải chứng minh đang giữ khoá đó (<em>proof of possession</em>). Có hai chuẩn:</p>

    <p><strong>1. mTLS-bound token (RFC 8705)</strong></p>
    <ul>
      <li>Client kết nối tới AS và API bằng <strong>mutual TLS</strong> với chứng chỉ client.</li>
      <li>AS ghi dấu vân tay chứng chỉ vào token: <code>"cnf": {"x5t#S256": "&lt;SHA-256 của cert&gt;"}</code>.</li>
      <li>API so dấu vân tay chứng chỉ của kết nối hiện tại với <code>cnf</code>. Khác → từ chối.</li>
      <li>Hợp với server-to-server trong hạ tầng có PKI. Khó cho SPA/mobile, và TLS bị kết thúc ở load balancer thì phải chuyển tiếp thông tin cert an toàn.</li>
    </ul>

    <p><strong>2. DPoP — Demonstrating Proof of Possession (RFC 9449)</strong></p>
    <ul>
      <li>Client tự sinh cặp khoá (thường ES256), khoá riêng không rời thiết bị (lý tưởng: không export được, nằm trong Keystore/Keychain/WebCrypto non-extractable).</li>
      <li>Mỗi request gửi header <code>DPoP: &lt;JWT proof&gt;</code> ký bằng khoá riêng, header của JWT chứa <em>khoá công khai</em> (<code>jwk</code>), <code>typ: dpop+jwt</code>.</li>
      <li>Payload của proof: <code>htm</code> (HTTP method), <code>htu</code> (URL, không query), <code>iat</code>, <code>jti</code> (duy nhất); khi gọi API thêm <code>ath</code> = băm của access token;
        và <code>nonce</code> nếu server yêu cầu (<code>DPoP-Nonce</code>).</li>
      <li>AS phát token với <code>"token_type": "DPoP"</code> và <code>"cnf": {"jkt": "&lt;thumbprint của khoá công khai&gt;"}</code>.</li>
      <li>Gọi API bằng <code>Authorization: DPoP &lt;token&gt;</code> + header <code>DPoP</code>. API kiểm tra chữ ký proof, <code>htm/htu</code> khớp request, <code>iat</code> mới, <code>jti</code> chưa dùng,
        <code>ath</code> khớp token, và thumbprint của <code>jwk</code> bằng <code>cnf.jkt</code>.</li>
    </ul>

    <table>
      <tr><th></th><th>Bearer</th><th>DPoP</th><th>mTLS</th></tr>
      <tr><td>Lộ token đơn thuần</td><td>Dùng được</td><td>Vô dụng nếu không có khoá riêng</td><td>Vô dụng nếu không có cert + khoá</td></tr>
      <tr><td>Hoạt động ở tầng</td><td>—</td><td>Ứng dụng (HTTP header)</td><td>Transport (TLS)</td></tr>
      <tr><td>Hợp với</td><td>Hệ thống rủi ro thấp</td><td>SPA, mobile, cả backend</td><td>Backend, B2B, open banking</td></tr>
      <tr><td>Refresh token public client</td><td>Cần rotation</td><td>Được gắn khoá luôn</td><td>Được gắn cert</td></tr>
    </table>

    <div class="callout"><p>💡 DPoP không chống được kẻ đã chiếm thiết bị và dùng được khoá riêng (vd XSS gọi WebCrypto để ký giúp). Nó chống <em>token rò rỉ ra ngoài</em>:
    log, proxy, backup, token bị copy sang máy khác. Vì thế nó giống ý tưởng chữ ký của OAuth 1.0a, nhưng dùng khoá bất đối xứng do client tự sinh.</p></div>
  `,

  codeTabs: [
    { id: "proof", label: "DPoP proof", lines: [
      "// header",
      "{ \"typ\": \"dpop+jwt\", \"alg\": \"ES256\",",
      "  \"jwk\": { \"kty\": \"EC\", \"crv\": \"P-256\", \"x\": \"l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs\",",
      "           \"y\": \"9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA\" } }",
      "// payload",
      "{ \"jti\": \"-BwC3ESc6acc2lTc\", \"htm\": \"POST\",",
      "  \"htu\": \"https://as.example.com/token\", \"iat\": 1790000000 }",
      "",
      "// ký bằng khoá riêng tương ứng với jwk ở header"
    ]},
    { id: "token", label: "Lấy token DPoP", lines: [
      "POST /token HTTP/1.1",
      "Host: as.example.com",
      "DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7...",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "grant_type=authorization_code&code=...&code_verifier=...&client_id=shop-spa",
      "",
      "200 OK",
      "{ \"access_token\": \"eyJ...\", \"token_type\": \"DPoP\", \"expires_in\": 900,",
      "  \"refresh_token\": \"...\" }",
      "# bên trong access token: \"cnf\": { \"jkt\": \"0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I\" }"
    ]},
    { id: "api", label: "Gọi API", lines: [
      "GET /api/orders HTTP/1.1",
      "Host: api.example.com",
      "Authorization: DPoP eyJ...access_token...",
      "DPoP: eyJ...proof mới...",
      "",
      "# payload của proof lần này:",
      "{ \"jti\": \"e1j3V_bKic8-LAEB\", \"htm\": \"GET\", \"htu\": \"https://api.example.com/api/orders\",",
      "  \"iat\": 1790000123, \"ath\": \"fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo\" }",
      "#   ath = base64url(sha256(access_token))"
    ]},
    { id: "check", label: "API kiểm tra", lines: [
      "proof  = verifyJwt(req.header('DPoP'), key = proof.header.jwk)",
      "assert proof.header.typ == 'dpop+jwt' and proof.header.alg in ['ES256', 'PS256']",
      "assert proof.htm == req.method and proof.htu == urlWithoutQuery(req)",
      "assert abs(now - proof.iat) < 60 and not seenJti(proof.jti)",
      "assert proof.ath == b64url(sha256(accessToken))",
      "token = verifyAccessToken(accessToken)",
      "assert token.cnf.jkt == thumbprint(proof.header.jwk)      // RFC 7638",
      "",
      "# mTLS thay vào đó: assert token.cnf['x5t#S256'] == sha256(clientCertOfThisConnection)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cl"><div class="nl">📱 Client giữ khoá riêng</div><div class="ns">không export được</div></div>
    <div class="arrow" id="a1">↓ /token + DPoP proof (jwk)</div>
    <div class="node" id="as"><div class="nl">🏛️ AS gắn token với khoá</div><div class="ns">cnf.jkt = thumbprint(jwk)</div></div>
    <div class="arrow" id="a2">↓ mỗi request: token + proof mới (htm, htu, ath)</div>
    <div class="node" id="api"><div class="nl">📡 API</div><div class="ns">proof hợp lệ + khoá khớp cnf?</div></div>
    <div class="arrow" id="a3">↓ kẻ trộm chỉ có token</div>
    <div class="node" id="thief"><div class="nl">🕵️ Không ký được proof</div><div class="ns">→ 401</div></div>
  `,
  steps: [
    { title: "1 · Proof là một JWT nhỏ", tab: "proof", highlight: [2, 3, 6, 7], on: ["cl"],
      desc: "Header mang khoá công khai; payload nói request nào (method + URL), khi nào, và jti duy nhất." },
    { title: "2 · AS gắn token với khoá", tab: "token", highlight: [3, 9, 11], on: ["a1", "as"],
      desc: "token_type là DPoP, access token chứa cnf.jkt — thumbprint của khoá công khai trong proof." },
    { title: "3 · Mỗi lời gọi API một proof mới", tab: "api", highlight: [3, 4, 7, 8, 9], on: ["a2", "api"],
      desc: "Proof gắn với method, URL và băm của chính access token (ath). Không dùng lại được cho request khác." },
    { title: "4 · API kiểm tra", tab: "check", highlight: [2, 3, 4, 5, 7], on: ["api"],
      desc: "Chữ ký, typ, htm/htu, thời gian, jti, ath, và thumbprint khớp cnf. mTLS làm cùng việc ở tầng TLS (dòng 9)." },
    { title: "5 · Token bị lộ trở nên vô dụng", tab: "check", highlight: [7], on: ["a3", "thief"],
      desc: "Kẻ có token nhưng không có khoá riêng không thể tạo proof hợp lệ." }
  ],

  quiz: [
    { q: "Sender-constrained token giải quyết vấn đề gì?", options: [
        "Token quá dài", "Token bị lộ vẫn dùng được (bearer)", "Không có refresh token", "Đăng nhập chậm"
      ], correct: 1, explanation: "Token gắn với khoá/cert; phải chứng minh sở hữu mới dùng được." },
    { q: "Trong DPoP, khoá riêng được tạo ở đâu?", options: [
        "AS tạo và gửi cho client", "Client tự sinh, khoá riêng không rời client", "Trong JWKS của AS", "Trong access token"
      ], correct: 1, explanation: "Khoá công khai được gửi trong header jwk của proof." },
    { q: "Claim ath trong DPoP proof là gì?", options: [
        "ID của user", "base64url(SHA-256(access token)) — gắn proof với token cụ thể", "Thời gian hết hạn", "Tên thuật toán"
      ], correct: 1, explanation: "Có khi gọi resource server để proof không dùng được với token khác." },
    { q: "htm và htu trong proof dùng để?", options: [
        "Mã hoá body",
        "Gắn proof với HTTP method và URL của đúng request đó",
        "Chọn khoá",
        "Chứa scope"
      ], correct: 1, explanation: "Proof cho GET /orders không dùng được cho POST /payments." },
    { q: "Access token DPoP chứa gì để gắn với khoá?", options: [
        "cnf.jkt — thumbprint của khoá công khai", "Khoá riêng", "Mật khẩu", "cnf.x5c"
      ], correct: 0, explanation: "mTLS dùng cnf['x5t#S256'] (dấu vân tay chứng chỉ)." },
    { q: "Header Authorization khi dùng DPoP là?", options: [
        "Bearer <token>", "DPoP <token>", "OAuth <token>", "Basic <token>"
      ], correct: 1, explanation: "Kèm header DPoP chứa proof." },
    { q: "mTLS-bound token khác DPoP chủ yếu ở đâu?", options: [
        "mTLS không dùng khoá",
        "mTLS chứng minh sở hữu ở tầng TLS bằng chứng chỉ client; DPoP ở tầng HTTP bằng JWT proof",
        "DPoP chỉ cho backend",
        "Giống hệt nhau"
      ], correct: 1, explanation: "DPoP dễ dùng cho SPA/mobile; mTLS hợp với B2B có PKI." },
    { q: "DPoP có chống được XSS dùng WebCrypto để ký proof ngay trong trang không?", options: [
        "Có, hoàn toàn",
        "Không — DPoP chống token rò rỉ ra ngoài, không chống kẻ đang điều khiển được client",
        "Có, nếu dùng RS256",
        "Có, nếu token ngắn"
      ], correct: 1, explanation: "Khoá non-extractable chỉ ngăn lấy khoá mang đi, không ngăn dùng khoá tại chỗ." },
    { q: "Header DPoP-Nonce từ server dùng để?", options: [
        "Mã hoá token",
        "Server cấp nonce để client đưa vào proof, hạn chế proof tạo sẵn và replay",
        "Đặt thời hạn refresh token",
        "Chọn scope"
      ], correct: 1, explanation: "Server có thể yêu cầu nonce để proof phải được tạo gần thời điểm gọi." }
  ]
});
