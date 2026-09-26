window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Danh tính & định dạng token",
  title: "JOSE: JWT, JWS, JWE, JWK, JWKS — và xoay khoá",
  subtitle: "Cấu trúc 3 phần · alg nào nên dùng · kid & JWKS · checklist verify",

  theory: `
    <p><strong>JOSE</strong> (JSON Object Signing and Encryption) là họ chuẩn định dạng mà OAuth/OIDC dùng để đóng gói token và khoá:</p>
    <table>
      <tr><th>Chuẩn</th><th>RFC</th><th>Là gì</th></tr>
      <tr><td><strong>JWS</strong></td><td>7515</td><td>Dữ liệu + <em>chữ ký</em>. Ai cũng đọc được, không ai sửa được.</td></tr>
      <tr><td><strong>JWE</strong></td><td>7516</td><td>Dữ liệu được <em>mã hoá</em>. Chỉ người có khoá mới đọc được. 5 phần.</td></tr>
      <tr><td><strong>JWK / JWKS</strong></td><td>7517</td><td>Biểu diễn khoá dạng JSON / tập khoá, công bố tại <code>jwks_uri</code></td></tr>
      <tr><td><strong>JWA</strong></td><td>7518</td><td>Danh sách thuật toán (<code>RS256</code>, <code>ES256</code>, <code>A256GCM</code>…)</td></tr>
      <tr><td><strong>JWT</strong></td><td>7519</td><td>Bộ claim chuẩn (<code>iss sub aud exp nbf iat jti</code>) đóng gói bằng JWS (thường) hoặc JWE</td></tr>
    </table>

    <p><strong>JWS compact</strong> = <code>BASE64URL(header) . BASE64URL(payload) . BASE64URL(chữ ký)</code>. Chữ ký tính trên hai phần đầu.
    Base64url không phải mã hoá — payload đọc được bằng mắt. Muốn giấu nội dung thì dùng JWE hoặc đừng đưa vào token.</p>

    <p><strong>Chọn thuật toán</strong></p>
    <table>
      <tr><th>alg</th><th>Loại</th><th>Khi dùng</th></tr>
      <tr><td><code>HS256</code></td><td>HMAC, khoá chung</td><td>Chỉ khi bên ký và bên kiểm tra là <em>cùng một hệ thống</em></td></tr>
      <tr><td><code>RS256</code>, <code>PS256</code></td><td>RSA</td><td>Phổ biến nhất trong OIDC; PS256 (RSA-PSS) hiện đại hơn</td></tr>
      <tr><td><code>ES256</code></td><td>ECDSA P-256</td><td>Khoá & chữ ký nhỏ; FAPI khuyến nghị PS256/ES256</td></tr>
      <tr><td><code>EdDSA</code> (Ed25519)</td><td>Edwards curve</td><td>Nhanh, an toàn; hỗ trợ đang tăng</td></tr>
      <tr><td><code>none</code></td><td>Không ký</td><td>❌ Không bao giờ chấp nhận</td></tr>
    </table>

    <p><strong>kid và xoay khoá (key rotation)</strong>: header JWS có <code>kid</code> chỉ ra khoá nào đã ký. Bên kiểm tra tải JWKS (cache), tìm khoá theo <code>kid</code>.
    Quy trình xoay không gián đoạn: (1) công bố khoá mới trong JWKS trước; (2) chờ cache các bên làm mới; (3) bắt đầu ký bằng khoá mới; (4) giữ khoá cũ trong JWKS tới khi mọi token cũ hết hạn; (5) gỡ khoá cũ.
    Gặp <code>kid</code> lạ: tải lại JWKS một lần (có giới hạn tần suất), vẫn không có thì từ chối.</p>

    <div class="callout"><p>💡 Checklist verify JWT: (1) <strong>allowlist</strong> thuật toán phía server — không tin <code>alg</code> trong header; không bao giờ nhận <code>none</code>;
    khoá RSA/EC chỉ dùng cho thuật toán tương ứng. (2) Lấy khoá theo <code>kid</code> từ JWKS của <em>issuer đã cấu hình</em> — không theo URL nằm trong token (<code>jku</code>, <code>x5u</code>).
    (3) Kiểm tra <code>iss</code>, <code>aud</code>, <code>exp</code>/<code>nbf</code>, <code>typ</code>. (4) Dùng thư viện đã kiểm chứng.</p></div>
  `,

  codeTabs: [
    { id: "jws", label: "JWS 3 phần", lines: [
      "eyJhbGciOiJFUzI1NiIsImtpZCI6Im9wLTIwMjYtMDkifQ",
      ".eyJpc3MiOiJodHRwczovL29wLmV4YW1wbGUuY29tIiwic3ViIjoiNDIifQ",
      ".MEUCIQDx...chữ-ký...",
      "",
      "# phần 1 decode: { \"alg\": \"ES256\", \"kid\": \"op-2026-09\" }",
      "# phần 2 decode: { \"iss\": \"https://op.example.com\", \"sub\": \"42\" }",
      "# phần 3: ECDSA(khoá riêng, phần1 + '.' + phần2)",
      "",
      "# JWE thì có 5 phần: header.encryptedKey.iv.ciphertext.tag"
    ]},
    { id: "jwks", label: "JWKS", lines: [
      "GET https://op.example.com/jwks",
      "{ \"keys\": [",
      "  { \"kty\": \"EC\", \"crv\": \"P-256\", \"kid\": \"op-2026-09\", \"use\": \"sig\", \"alg\": \"ES256\",",
      "    \"x\": \"f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU\",",
      "    \"y\": \"x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0\" },",
      "  { \"kty\": \"EC\", \"crv\": \"P-256\", \"kid\": \"op-2026-06\", \"use\": \"sig\", \"alg\": \"ES256\",",
      "    \"x\": \"...\", \"y\": \"...\" }",
      "] }",
      "",
      "# Chỉ có KHOÁ CÔNG KHAI. Hai khoá cùng lúc = đang trong giai đoạn xoay khoá"
    ]},
    { id: "verify", label: "Verify đúng", lines: [
      "ALLOWED_ALGS = ['ES256', 'RS256']",
      "ISSUER = 'https://op.example.com'",
      "",
      "header = decodeHeader(token)",
      "if header.alg not in ALLOWED_ALGS: reject          // chặn 'none', chặn nhầm HS/RS",
      "key = jwksCache(ISSUER).get(header.kid) or jwksCache(ISSUER).refreshOnce().get(header.kid)",
      "if not key or key.alg != header.alg: reject",
      "claims = verifySignature(token, key)",
      "check claims.iss == ISSUER and AUDIENCE in claims.aud",
      "check claims.exp > now - 60 and (claims.nbf or 0) <= now + 60",
      "",
      "// KHÔNG dùng jku / x5u trong header để tải khoá"
    ]},
    { id: "rotate", label: "Xoay khoá", lines: [
      "Ngày 0   JWKS = [old]                ký bằng old",
      "Ngày 1   JWKS = [old, new]           ký bằng old   // công bố new trước",
      "Ngày 2   JWKS = [old, new]           ký bằng new   // cache các bên đã có new",
      "Ngày 3+  JWKS = [old, new]           token cũ ký bằng old dần hết hạn",
      "Ngày N   JWKS = [new]                gỡ old",
      "",
      "# Khoá bị lộ: gỡ ngay khỏi JWKS + thu hồi token, chấp nhận gián đoạn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="iss"><div class="nl">🏛️ Issuer</div><div class="ns">ký bằng khoá riêng (kid)</div></div>
    <div class="arrow" id="a1">↓ JWT header.payload.signature</div>
    <div class="node" id="ver"><div class="nl">🔎 Bên kiểm tra</div><div class="ns">allowlist alg · tìm khoá theo kid</div></div>
    <div class="arrow" id="a2">↑ tải + cache</div>
    <div class="node" id="jwks"><div class="nl">🗝️ JWKS của issuer</div><div class="ns">chỉ khoá công khai · nhiều kid khi xoay</div></div>
  `,
  steps: [
    { title: "1 · Ba phần của JWS", tab: "jws", highlight: [1, 2, 3, 5, 6, 7], on: ["iss", "a1"],
      desc: "Header và payload chỉ là base64url — đọc được. Chữ ký bảo đảm không ai sửa được mà không có khoá riêng." },
    { title: "2 · JWKS công bố khoá công khai", tab: "jwks", highlight: [3, 6, 10], on: ["jwks", "a2"],
      desc: "Mỗi khoá có kid. Hai khoá cùng lúc là bình thường trong giai đoạn xoay." },
    { title: "3 · Verify với allowlist", tab: "verify", highlight: [1, 5, 6, 7, 9, 10, 12], on: ["ver"],
      desc: "Server quyết định thuật toán chấp nhận, lấy khoá từ JWKS của issuer đã cấu hình, rồi kiểm tra claim." },
    { title: "4 · Xoay khoá không gián đoạn", tab: "rotate", highlight: [2, 3, 5, 7], on: ["iss", "jwks"],
      desc: "Công bố trước, ký sau, gỡ khi token cũ hết hạn. Khoá lộ thì gỡ ngay." }
  ],

  quiz: [
    { q: "Payload của một JWS (JWT thông thường) có bị mã hoá không?", options: [
        "Có, bằng AES", "Không — chỉ base64url, ai cũng đọc được; chữ ký chỉ chống sửa", "Có, bằng RSA", "Tuỳ độ dài"
      ], correct: 1, explanation: "Muốn giấu nội dung thì dùng JWE, hoặc không đưa dữ liệu nhạy cảm vào token." },
    { q: "JWE khác JWS thế nào?", options: [
        "JWE nhanh hơn", "JWE mã hoá nội dung (5 phần); JWS ký nội dung (3 phần)", "JWE không có header", "Giống nhau"
      ], correct: 1, explanation: "JWS = toàn vẹn + xác thực nguồn; JWE = bí mật." },
    { q: "Thuật toán nào KHÔNG bao giờ được chấp nhận?", options: [
        "ES256", "RS256", "none", "EdDSA"
      ], correct: 2, explanation: "alg: none nghĩa là không có chữ ký." },
    { q: "Vì sao phải allowlist thuật toán phía server thay vì tin alg trong header?", options: [
        "Để nhanh hơn",
        "Header do người gửi kiểm soát; tin nó có thể dẫn tới chấp nhận 'none' hoặc dùng khoá sai loại thuật toán",
        "Vì header bị mã hoá",
        "Không cần thiết"
      ], correct: 1, explanation: "Server quyết định thuật toán và gắn mỗi khoá với đúng một thuật toán." },
    { q: "HS256 phù hợp khi nào?", options: [
        "OP phát id_token cho hàng nghìn client",
        "Bên ký và bên kiểm tra là cùng một hệ thống (dùng chung khoá bí mật)",
        "Mọi trường hợp",
        "Khi cần công bố JWKS"
      ], correct: 1, explanation: "HMAC dùng khoá chung — ai kiểm tra được thì cũng ký được." },
    { q: "Header kid dùng để làm gì?", options: [
        "Mã hoá", "Chỉ ra khoá nào trong JWKS đã ký token", "Chứa user id", "Chứa thời hạn"
      ], correct: 1, explanation: "kid giúp chọn khoá, đặc biệt trong giai đoạn xoay khoá." },
    { q: "Thứ tự xoay khoá đúng?", options: [
        "Ký bằng khoá mới ngay, công bố sau",
        "Công bố khoá mới trong JWKS trước → chờ cache → ký bằng khoá mới → gỡ khoá cũ khi token cũ hết hạn",
        "Gỡ khoá cũ trước",
        "Không bao giờ xoay khoá"
      ], correct: 1, explanation: "Công bố trước để mọi bên kiểm tra đã có khoá mới khi token mới xuất hiện." },
    { q: "Token có header jku trỏ tới một URL JWKS. Bên kiểm tra nên?", options: [
        "Tải khoá từ URL đó",
        "Bỏ qua jku; chỉ dùng JWKS của issuer đã cấu hình sẵn",
        "Tải và cache vĩnh viễn",
        "Chấp nhận nếu HTTPS"
      ], correct: 1, explanation: "Để người gửi chọn nơi lấy khoá thì họ tự ký được token." },
    { q: "JWKS công bố những gì?", options: [
        "Khoá riêng", "Khoá công khai", "Mật khẩu admin", "Access token"
      ], correct: 1, explanation: "Chỉ khoá công khai, để bất kỳ ai cũng verify được chữ ký." }
  ]
});
