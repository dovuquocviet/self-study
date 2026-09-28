window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "OAuth 2.0",
  title: "Authorization Code flow — luồng chuẩn của OAuth 2",
  subtitle: "4 vai diễn và điệu nhảy đổi 'code' lấy 'token'",

  theory: `
    <div class="callout"><p><strong>📝 Đề bài.</strong> Bạn muốn in album <strong>"Đà Lạt 2025"</strong> (128 ảnh)
    đang lưu trên <code>photos.example.com</code>. Bạn vào app in ảnh <code>print.app</code>
    (<code>client_id=photo-print-app</code>). App cần <strong>đọc</strong> ảnh của bạn nhưng <strong>không được biết
    mật khẩu</strong> của bạn. Vì vậy app nhờ <code>auth.example.com</code> hỏi bạn có đồng ý cho app đọc ảnh
    (<code>scope=photos.read</code>) không, rồi lấy một <strong>access token</strong> để gọi API ảnh.</p>
    <p><strong>❓ Token đi đường nào tới tay app mà không lộ qua trình duyệt?</strong></p></div>
    <p>OAuth 2 định nghĩa <strong>4 vai</strong> (roles) — thuộc lòng 4 vai này thì đọc tài liệu nào cũng hiểu.
    Trong đề bài trên, mỗi vai là một cột trên sơ đồ:</p>
    <table>
      <tr><th>Vai</th><th>Là gì</th><th>Trong đề bài</th></tr>
      <tr><td><strong>Resource Owner</strong></td><td>chủ dữ liệu</td><td>🌐 bạn, qua trình duyệt</td></tr>
      <tr><td><strong>Client</strong></td><td>app muốn dùng dữ liệu</td><td>🖨️ <code>print.app</code>, giữ <code>client_secret=app-mat-khau-rieng</code></td></tr>
      <tr><td><strong>Authorization Server</strong></td><td>nơi đăng nhập &amp; phát token</td><td>🏛️ <code>auth.example.com</code></td></tr>
      <tr><td><strong>Resource Server</strong></td><td>API giữ dữ liệu</td><td>🗄️ <code>photos.example.com</code></td></tr>
    </table>
    <p>Luồng phổ biến và an toàn nhất là <strong>Authorization Code flow</strong>. Điểm tinh tế:
    token <em>không</em> được trao ngay ở trình duyệt, mà đi qua 2 bước:</p>
    <ol>
      <li>Qua trình duyệt (front channel — kênh "lộ thiên"), authorization server chỉ trao một
      <strong>authorization code</strong> — mã tạm, dùng 1 lần, sống ~1 phút. Như <em>phiếu hẹn lấy hàng</em>.</li>
      <li>Client đem code + <strong>client_secret</strong> (mật khẩu riêng của app) gọi thẳng
      server-to-server (back channel — kênh kín) để <strong>đổi code lấy access token</strong>.</li>
    </ol>
    <p>Vì sao lòng vòng vậy? Vì URL trình duyệt dễ lộ (history, log, extension…). Thứ đi qua chỗ dễ lộ
    chỉ là <em>phiếu hẹn</em> — muốn quy ra token phải có thêm client_secret mà chỉ server của app biết.</p>
    <div class="callout"><p>💡 <code>state</code> là tham số chống giả mạo: client sinh chuỗi ngẫu nhiên,
    gửi đi rồi kiểm tra lúc quay về — chặn kẻ gian "nhét" code lạ vào phiên của bạn (CSRF).
    Còn app mobile/SPA không giữ nổi client_secret thì dùng PKCE — bài 7.</p></div>
    <p>Đọc sơ đồ bên dưới: mỗi số ①–⑤ là <strong>một lượt request + response</strong>. Lượt ③
    (trình duyệt gọi <code>/callback</code>) mở ra trước nhưng trả lời <em>sau cùng</em>: trong lúc giữ request đó,
    server app tự đi làm ④ (đổi code lấy token) và ⑤ (gọi API ảnh).</p>
  `,

  codeTabs: [
    { id: "front", label: "🌐 Front channel", lines: [
      "# ① Client đưa người dùng sang authorization server:",
      "GET https://auth.example.com/authorize",
      "  ?response_type=code          # xin authorization code",
      "  &client_id=photo-print-app",
      "  &redirect_uri=https://print.app/callback",
      "  &scope=photos.read",
      "  &state=xyz789               # chuỗi ngẫu nhiên chống CSRF",
      "",
      "# ② (đi) Người dùng đăng nhập + bấm Đồng ý tại auth server",
      "",
      "# ② (về) Auth server đưa người dùng quay về app kèm CODE:",
      "HTTP/1.1 302 Found",
      "Location: https://print.app/callback?code=SplxlO...&state=xyz789"
    ]},
    { id: "back", label: "🔒 Back channel", lines: [
      "# ④ (đi) Server của app đổi code lấy token (server-to-server):",
      "POST https://auth.example.com/token",
      "Content-Type: application/x-www-form-urlencoded",
      "",
      "grant_type=authorization_code",
      "&code=SplxlO...              # phiếu hẹn vừa nhận",
      "&redirect_uri=https://print.app/callback",
      "&client_id=photo-print-app",
      "&client_secret=app-mat-khau-rieng   # chỉ server app biết",
      "",
      "# ④ (về) Auth server trả token:",
      "{ \"access_token\": \"ya29...\", \"token_type\": \"Bearer\",",
      "  \"expires_in\": 3600, \"refresh_token\": \"1//xEo...\" }"
    ]},
    { id: "api", label: "📡 Gọi API", lines: [
      "# ⑤ Client dùng access token gọi resource server:",
      "GET https://photos.example.com/api/albums",
      "Authorization: Bearer ya29...",
      "",
      "# Resource server kiểm token + scope:",
      "#  - token hợp lệ? còn hạn?",
      "#  - scope photos.read có cho phép đọc album? -> OK",
      "HTTP/1.1 200 OK",
      "[ { \"album\": \"Đà Lạt 2025\", \"photos\": 128 } ]"
    ]}
  ],

  stageHtml: `
    <div class="seq" id="seq05">
    <div class="seq-legend"><span><i class="front"></i>đi qua trình duyệt (front channel, dễ lộ)</span><span><i class="back"></i>server ↔ server (back channel)</span><span><i></i>request</span><span><i class="dash"></i>response</span><span>▮ hộp xanh = server app đang giữ request ③ · mỗi số = 1 lượt đi + về</span></div>
    <svg viewBox="0 0 1140 810" role="img" aria-label="Sequence diagram Authorization Code flow">
    <defs><marker id="s5-front" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#f08c00"/></marker><marker id="s5-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#37b24d"/></marker></defs>
    <rect class="band-front" x="0" y="105" width="1140" height="313"/>
    <text class="band-label front" x="1132" y="124" text-anchor="end" font-size="12">FRONT CHANNEL</text>
    <rect class="band-back" x="0" y="440" width="1140" height="272"/>
    <text class="band-label back" x="1132" y="458" text-anchor="end" font-size="12">BACK CHANNEL</text>
    <rect class="band-front" x="0" y="712" width="1140" height="98"/>
    <line class="life" x1="110" y1="80" x2="110" y2="805"/>
    <rect class="actor" x="15" y="20" width="190" height="56" rx="8"/>
    <text class="actor-name" x="110" y="44" text-anchor="middle" font-size="14">🌐 Trình duyệt</text>
    <text class="sub" x="110" y="64" text-anchor="middle" font-size="12">(mày)</text>
    <line class="life" x1="400" y1="80" x2="400" y2="805"/>
    <rect class="actor" x="305" y="20" width="190" height="56" rx="8"/>
    <text class="actor-name" x="400" y="44" text-anchor="middle" font-size="14">🖨️ Server app</text>
    <text class="sub" x="400" y="64" text-anchor="middle" font-size="12">print.app</text>
    <line class="life" x1="800" y1="80" x2="800" y2="805"/>
    <rect class="actor" x="705" y="20" width="190" height="56" rx="8"/>
    <text class="actor-name" x="800" y="44" text-anchor="middle" font-size="14">🏛️ Auth server</text>
    <text class="sub" x="800" y="64" text-anchor="middle" font-size="12">auth.example.com</text>
    <line class="life" x1="1030" y1="80" x2="1030" y2="805"/>
    <rect class="actor" x="935" y="20" width="190" height="56" rx="8"/>
    <text class="actor-name" x="1030" y="44" text-anchor="middle" font-size="14">🗄️ Resource server</text>
    <text class="sub" x="1030" y="64" text-anchor="middle" font-size="12">photos.example.com</text>
    <rect class="act" x="393" y="400" width="14" height="360"/>
    <rect class="act-s" x="794" y="150" width="12" height="50"/>
    <rect class="act-s" x="794" y="255" width="12" height="75"/>
    <rect class="act-s" x="794" y="480" width="12" height="70"/>
    <rect class="act-s" x="1024" y="620" width="12" height="50"/>
    <g class="arrow msg" id="m1a">
    <line class="ln-front" x1="118" y1="150" x2="792" y2="150" marker-end="url(#s5-front)"/>
    <text x="455" y="127" text-anchor="middle" font-size="12">GET /authorize?response_type=code&amp;client_id=photo-print-app</text>
    <text x="455" y="142" text-anchor="middle" font-size="12">&amp;redirect_uri=…/callback&amp;scope=photos.read&amp;state=xyz789</text>
    <circle class="bg-front" cx="132" cy="173" r="13"/>
    <text class="badge" x="132" y="177" text-anchor="middle" font-size="11">①</text>
    </g>
    <g class="arrow msg" id="m1b">
    <line class="ln-front" x1="792" y1="200" x2="118" y2="200" stroke-dasharray="7 5" marker-end="url(#s5-front)"/>
    <text x="455" y="192" text-anchor="middle" font-size="12">200 trang đăng nhập</text>
    <circle class="bg-front" cx="778" cy="223" r="13"/>
    <text class="badge" x="778" y="227" text-anchor="middle" font-size="11">①</text>
    </g>
    <g class="arrow msg" id="m2a">
    <line class="ln-front" x1="118" y1="255" x2="792" y2="255" marker-end="url(#s5-front)"/>
    <text x="455" y="247" text-anchor="middle" font-size="12">POST đăng nhập + bấm Đồng ý</text>
    <circle class="bg-front" cx="132" cy="278" r="13"/>
    <text class="badge" x="132" y="282" text-anchor="middle" font-size="11">②</text>
    </g>
    <g class="arrow msg" id="m2b">
    <line class="ln-front" x1="792" y1="330" x2="118" y2="330" stroke-dasharray="7 5" marker-end="url(#s5-front)"/>
    <text x="455" y="307" text-anchor="middle" font-size="12">302 Location: https://print.app/callback</text>
    <text x="455" y="322" text-anchor="middle" font-size="12">?code=SplxlO...&amp;state=xyz789   ⚠ code nằm trên URL</text>
    <circle class="bg-front" cx="778" cy="353" r="13"/>
    <text class="badge" x="778" y="357" text-anchor="middle" font-size="11">②</text>
    </g>
    <g class="arrow msg" id="m3a">
    <line class="ln-front" x1="118" y1="400" x2="392" y2="400" marker-end="url(#s5-front)"/>
    <text x="255" y="377" text-anchor="middle" font-size="12">GET /callback?code=SplxlO...</text>
    <text x="255" y="392" text-anchor="middle" font-size="12">&amp;state=xyz789</text>
    <circle class="bg-front" cx="132" cy="423" r="13"/>
    <text class="badge" x="132" y="427" text-anchor="middle" font-size="11">③</text>
    </g>
    <g class="arrow msg" id="m4a">
    <line class="ln-back" x1="408" y1="480" x2="792" y2="480" marker-end="url(#s5-back)"/>
    <text x="600" y="457" text-anchor="middle" font-size="12">POST /token  grant_type=authorization_code</text>
    <text x="600" y="472" text-anchor="middle" font-size="12">code=SplxlO...  client_secret=app-mat-khau-rieng</text>
    <circle class="bg-back" cx="422" cy="503" r="13"/>
    <text class="badge" x="422" y="507" text-anchor="middle" font-size="11">④</text>
    </g>
    <g class="arrow msg" id="m4b">
    <line class="ln-back" x1="792" y1="550" x2="408" y2="550" stroke-dasharray="7 5" marker-end="url(#s5-back)"/>
    <text x="600" y="527" text-anchor="middle" font-size="12">200 { access_token:&quot;ya29...&quot;, expires_in:3600,</text>
    <text x="600" y="542" text-anchor="middle" font-size="12">      refresh_token:&quot;1//xEo...&quot; }</text>
    <circle class="bg-back" cx="778" cy="573" r="13"/>
    <text class="badge" x="778" y="577" text-anchor="middle" font-size="11">④</text>
    </g>
    <g class="arrow msg" id="m5a">
    <line class="ln-back" x1="408" y1="620" x2="1022" y2="620" marker-end="url(#s5-back)"/>
    <text x="715" y="597" text-anchor="middle" font-size="12">GET /api/albums</text>
    <text x="715" y="612" text-anchor="middle" font-size="12">Authorization: Bearer ya29...</text>
    <circle class="bg-back" cx="422" cy="643" r="13"/>
    <text class="badge" x="422" y="647" text-anchor="middle" font-size="11">⑤</text>
    </g>
    <g class="arrow msg" id="m5b">
    <line class="ln-back" x1="1022" y1="670" x2="408" y2="670" stroke-dasharray="7 5" marker-end="url(#s5-back)"/>
    <text x="715" y="662" text-anchor="middle" font-size="12">200 [{album:&quot;Đà Lạt 2025&quot;, photos:128}]</text>
    <circle class="bg-back" cx="1008" cy="693" r="13"/>
    <text class="badge" x="1008" y="697" text-anchor="middle" font-size="11">⑤</text>
    </g>
    <g class="arrow msg" id="m3b">
    <line class="ln-front" x1="392" y1="760" x2="118" y2="760" stroke-dasharray="7 5" marker-end="url(#s5-front)"/>
    <text x="255" y="722" text-anchor="middle" font-size="12">response của ③: HTML album</text>
    <text x="255" y="737" text-anchor="middle" font-size="12">hoặc 302 /albums + cookie session</text>
    <text x="255" y="752" text-anchor="middle" font-size="12">(KHÔNG chứa ya29...)</text>
    <circle class="bg-front" cx="378" cy="783" r="13"/>
    <text class="badge" x="378" y="787" text-anchor="middle" font-size="11">③</text>
    </g>
    <g class="arrow note" id="n-code"><rect x="815" y="262" width="205" height="74" rx="4"/>
    <text x="823" y="280" font-size="11.5">tạo code=SplxlO...</text>
    <text x="823" y="296" font-size="11.5">sống ~60s · dùng 1 lần</text>
    <text x="823" y="312" font-size="11.5">gắn client_id +</text>
    <text x="823" y="328" font-size="11.5">redirect_uri + scope</text>
    </g>
    <g class="arrow note" id="n-state"><rect x="165" y="412" width="220" height="58" rx="4"/>
    <text x="173" y="430" font-size="11.5">so state: xyz789 == xyz789 ✔</text>
    <text x="173" y="446" font-size="11.5">giữ request, CHƯA trả lời</text>
    <text x="173" y="462" font-size="11.5">→ tự đi đổi token (④⑤)</text>
    </g>
    <g class="arrow note" id="n-check"><rect x="812" y="488" width="214" height="74" rx="4"/>
    <text x="820" y="506" font-size="11.5">kiểm: 1. secret đúng?</text>
    <text x="820" y="522" font-size="11.5">2. code của photo-print-app?</text>
    <text x="820" y="538" font-size="11.5">3. redirect_uri trùng?</text>
    <text x="820" y="554" font-size="11.5">4. còn hạn, chưa dùng?</text>
    </g>
    <g class="arrow note" id="n-hold"><rect x="20" y="520" width="190" height="42" rx="4"/>
    <text x="28" y="538" font-size="11.5">trình duyệt đang chờ</text>
    <text x="28" y="554" font-size="11.5">response của ③…</text>
    </g>
    </svg></div>
  `,
  steps: [
    { title: "Toàn cảnh · 5 lượt đi + về", tab: "front", highlight: [], on: [],
      desc: "Mỗi số ①–⑤ là <em>một</em> lượt: request (nét liền) và response của chính nó (nét đứt). Cam = đi qua trình duyệt, xanh lá = server gọi server. Để ý hộp xanh trên cột Server app: request ③ mở ra ở giữa nhưng chỉ trả lời ở cuối, bọc cả ④⑤ bên trong." },
    { title: "① Redirect sang /authorize", tab: "front", highlight: [2, 3, 4, 5, 6, 7], on: ["m1a", "m1b"],
      desc: "<b>Đi:</b> trình duyệt gọi auth server, khai tôi là ai (<code>client_id=photo-print-app</code>), xin gì (<code>scope=photos.read</code>), nhận kết quả ở đâu (<code>redirect_uri</code>), kèm <code>state=xyz789</code> mà server app đã lưu vào session. <b>Về:</b> trang đăng nhập." },
    { title: "② Đăng nhập + Đồng ý → nhận code", tab: "front", highlight: [9, 12, 13], on: ["m2a", "m2b", "n-code"],
      desc: "<b>Đi:</b> bạn gõ mật khẩu <em>trên auth.example.com</em> và bấm Đồng ý — server app không thấy mật khẩu. Auth server tạo <code>code=SplxlO...</code>. <b>Về:</b> không phải token, mà là <code>302</code> bảo trình duyệt sang <code>print.app/callback?code=SplxlO...&amp;state=xyz789</code>. ⚠ Code nằm trên URL nên lọt vào history, log, extension." },
    { title: "③ (đi) Trình duyệt gọi server app", tab: "front", highlight: [13], on: ["m3a", "n-state", "n-hold"],
      desc: "Trình duyệt tự đi theo <code>Location</code> — request này tới <b>server app</b>, không phải auth server. Server app so <code>state</code> (xyz789 == xyz789) rồi <b>giữ request, chưa trả lời</b>: trong lúc trình duyệt chờ, nó đi làm ④ và ⑤." },
    { title: "④ Đổi code lấy token (kênh kín)", tab: "back", highlight: [2, 5, 6, 7, 8, 9, 12, 13], on: ["m4a", "m4b", "n-check"],
      desc: "<b>Đi:</b> server app gọi <em>thẳng</em> auth server qua HTTPS: <code>code</code> + <code>client_secret</code>. Auth server kiểm secret, code có đúng của app này, <code>redirect_uri</code> trùng, còn hạn — rồi đánh dấu code đã dùng. Kẻ trộm được code từ URL cũng chịu vì thiếu secret. <b>Về:</b> <code>access_token</code> (Bearer, 1 giờ) và <code>refresh_token</code> nằm trong body — chỉ server app nhận được." },
    { title: "⑤ Gọi API bằng token", tab: "api", highlight: [2, 3, 8, 9], on: ["m5a", "m5b"],
      desc: "<b>Đi:</b> server app gọi <code>GET /api/albums</code> với <code>Authorization: Bearer ya29...</code>. <b>Về:</b> resource server kiểm token + scope <code>photos.read</code> rồi trả album \"Đà Lạt 2025\"." },
    { title: "③ (về) Trả lời trình duyệt", tab: "api", highlight: [], on: ["m3b"],
      desc: "Tới đây server app mới <b>trả response cho request ③</b>: trang HTML album, hoặc <code>302 /albums</code> kèm cookie session. Response này <b>không chứa</b> <code>ya29...</code> — token nằm lại trên server app. Đó là câu trả lời cho đề bài." }
  ],

  quiz: [
    { q: "Trong OAuth 2, 'Resource Owner' là ai?", options: [
        "Server API giữ dữ liệu",
        "Người dùng — chủ của dữ liệu",
        "App bên thứ ba",
        "Nơi phát token"
      ], correct: 1,
      explanation: "Resource Owner = chủ tài nguyên = bạn. Client là app, Authorization Server phát token, Resource Server là API giữ dữ liệu." },
    { q: "Vì sao auth server trao 'authorization code' qua trình duyệt thay vì trao thẳng access token?", options: [
        "Vì code ngắn hơn nên tải nhanh hơn",
        "Vì URL trình duyệt dễ lộ — thứ đi qua đó chỉ nên là mã tạm dùng 1 lần, phải kèm client_secret ở kênh kín mới đổi được token",
        "Vì access token chưa được tạo xong",
        "Vì trình duyệt không chứa được token dài"
      ], correct: 1,
      explanation: "Front channel (URL, history, log) không an toàn. Code chỉ là 'phiếu hẹn' — quy ra token phải qua back channel kèm client_secret." },
    { q: "Tham số state trong Authorization Code flow dùng để làm gì?", options: [
        "Cho biết người dùng đang ở tỉnh nào",
        "Chuỗi ngẫu nhiên client sinh ra và đối chiếu khi quay về — chống kẻ gian nhét code lạ vào phiên (CSRF)",
        "Chứa mật khẩu đã mã hoá",
        "Đếm số lần đăng nhập"
      ], correct: 1,
      explanation: "Client so state gửi đi với state nhận về — lệch là huỷ. Chặn tấn công gắn authorization code của kẻ khác vào phiên của bạn." },
    { q: "client_secret được dùng ở bước nào và ai giữ nó?", options: [
        "Gõ vào trình duyệt cùng mật khẩu người dùng",
        "Server của app dùng ở bước đổi code lấy token, qua kênh server-to-server",
        "Người dùng giữ trong máy",
        "Resource server phát cho người dùng"
      ], correct: 1,
      explanation: "client_secret là 'mật khẩu của app', chỉ tồn tại trên server của app và chỉ đi qua back channel. App mobile/SPA không giấu nổi secret → cần PKCE (bài 7)." }
  ]
});
