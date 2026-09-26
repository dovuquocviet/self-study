window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Tư duy nền tảng",
  title: "Validate input đúng cách",
  subtitle: "Allowlist thay vì denylist · parse chứ đừng chỉ check · chuẩn hoá trước khi so sánh",

  theory: `
    <p>Validate input là lớp phòng thủ đầu tiên. Nó <strong>không</strong> thay thế được các biện pháp riêng (parameterized query, output encoding…),
    nhưng nó loại bỏ phần lớn rác và thu hẹp đáng kể những gì kẻ tấn công có thể gửi vào sâu bên trong.</p>

    <p><strong>1. Allowlist (cho phép cái biết là đúng) &gt; Denylist (chặn cái biết là xấu)</strong></p>
    <ul>
      <li>Denylist: "chặn chuỗi có <code>&lt;script&gt;</code>, <code>' OR 1=1</code>, <code>../</code>". Kẻ tấn công luôn tìm được biến thể:
        <code>&lt;ScRiPt&gt;</code>, <code>&lt;img onerror=...&gt;</code>, <code>..%2f</code>, <code>....//</code>…</li>
      <li>Allowlist: "username chỉ gồm <code>[a-z0-9_]</code>, dài 3–30 ký tự". Mọi thứ khác bị từ chối — kể cả những kiểu tấn công chưa ai nghĩ ra.</li>
    </ul>

    <p><strong>2. Kiểm tra những gì?</strong></p>
    <table>
      <tr><th>Khía cạnh</th><th>Ví dụ</th></tr>
      <tr><td>Kiểu dữ liệu</td><td><code>qty</code> phải là số nguyên, không phải chuỗi <code>"1; DROP"</code> hay mảng <code>[1,2]</code> hay object <code>{"$gt":0}</code></td></tr>
      <tr><td>Khoảng giá trị</td><td><code>qty</code> trong 1–100; <code>page_size</code> tối đa 100 (không cho 1.000.000)</td></tr>
      <tr><td>Độ dài</td><td>tên ≤ 100 ký tự; body JSON ≤ 1MB; mảng ≤ 50 phần tử</td></tr>
      <tr><td>Định dạng</td><td>email, UUID, ngày ISO-8601 — dùng parser thật, không tự viết regex phức tạp</td></tr>
      <tr><td>Tập giá trị cho phép (enum)</td><td><code>sort</code> ∈ {<code>created_at</code>, <code>price</code>}; <code>status</code> ∈ {<code>open</code>, <code>closed</code>}</td></tr>
      <tr><td>Field thừa</td><td>Từ chối (hoặc bỏ qua) field không có trong schema — chặn mass assignment (bài 15)</td></tr>
      <tr><td>Nghiệp vụ</td><td>ngày kết thúc sau ngày bắt đầu; không chuyển tiền cho chính mình</td></tr>
    </table>

    <p><strong>3. "Parse, don't validate"</strong> — thay vì kiểm tra chuỗi rồi vẫn dùng chuỗi đó, hãy <em>chuyển</em> nó thành kiểu dữ liệu đúng
    (số nguyên, UUID, enum, object có schema). Từ đó trở đi code chỉ làm việc với kiểu đã parse — không còn chỗ cho chuỗi thô lọt xuống dưới.
    Mọi ngôn ngữ đều có công cụ: JSON Schema, OpenAPI validator, Zod/Joi (JS), Pydantic (Python), Bean Validation (Java), struct tag + validator (Go), serde (Rust)…</p>

    <p><strong>4. Chuẩn hoá (canonicalize) trước khi kiểm tra.</strong> Một giá trị có thể được viết nhiều cách:</p>
    <ul>
      <li>URL-encode: <code>%2e%2e%2f</code> = <code>../</code>; encode hai lần: <code>%252e</code>.</li>
      <li>Unicode: <code>ａｄｍｉｎ</code> (chữ full-width) sau khi chuẩn hoá NFKC thành <code>admin</code>; chữ Cyrillic <code>а</code> nhìn y hệt chữ Latin <code>a</code>.</li>
      <li>Hoa/thường, khoảng trắng: <code>Admin@X.com </code> vs <code>admin@x.com</code>.</li>
      <li>Đường dẫn: <code>/files/./a/../../etc/passwd</code>.</li>
    </ul>
    <p>Quy tắc: <strong>decode → chuẩn hoá → rồi mới validate</strong>, và dùng <em>chính giá trị đã chuẩn hoá</em> cho các bước sau. Nếu validate trên bản này mà dùng bản khác → lỗ hổng.</p>

    <p><strong>5. Validate ở đâu?</strong> Tại ranh giới — ngay khi dữ liệu vào hệ thống (controller, consumer của queue, handler webhook).
    Và nhớ: validate đúng kiểu <em>không</em> có nghĩa là an toàn cho mọi ngữ cảnh. Chuỗi <code>O'Brien</code> là tên hợp lệ, nhưng vẫn phá câu SQL nếu nối chuỗi.
    Vì vậy validate chỉ là lớp 1; mỗi ngữ cảnh đầu ra (SQL, HTML, shell…) cần biện pháp riêng — đó là nội dung các bài sau.</p>

    <div class="callout"><p>💡 Khi input không hợp lệ: <strong>từ chối</strong> (400) thay vì cố "sửa hộ" (xoá ký tự lạ rồi dùng tiếp). Code tự làm sạch rất dễ bị lừa:
    xoá <code>&lt;script&gt;</code> một lần khỏi <code>&lt;scr&lt;script&gt;ipt&gt;</code> lại sinh ra đúng <code>&lt;script&gt;</code>.</p></div>
  `,

  codeTabs: [
    { id: "deny", label: "❌ Denylist", lines: [
      "// Cố chặn những thứ 'trông nguy hiểm'",
      "function isSafe(input):",
      "    bad = [\"<script>\", \"' OR 1=1\", \"../\", \"DROP TABLE\"]",
      "    for b in bad:",
      "        if input.contains(b): return false",
      "    return true",
      "",
      "// Kẻ tấn công vượt qua dễ dàng:",
      "//   <ScRiPt>        (hoa thường)",
      "//   <img src=x onerror=alert(1)>",
      "//   ' OR 2>1 --",
      "//   ..%2f..%2f      (URL-encode)",
      "//   drop/**/table   (chèn comment)"
    ]},
    { id: "allow", label: "✅ Schema allowlist", lines: [
      "// Khai báo schema: chỉ nhận đúng thứ cần, đúng kiểu, trong giới hạn",
      "CreateOrder = {",
      "    items: array(maxItems=50) of {",
      "        sku: string(pattern='^[A-Z0-9-]{3,32}$'),",
      "        qty: integer(min=1, max=100)",
      "    },",
      "    couponCode: optional string(pattern='^[A-Z0-9]{4,16}$'),",
      "    additionalProperties: false      // field lạ -> từ chối",
      "}",
      "",
      "handle POST /orders (req):",
      "    order = CreateOrder.parse(req.body)   // lỗi -> 400, dừng ngay",
      "    // từ đây 'order' là object đã đúng kiểu, không còn chuỗi thô"
    ]},
    { id: "langs", label: "🌐 Đa ngôn ngữ", lines: [
      "# Cùng một ý tưởng, công cụ khác nhau:",
      "",
      "# TypeScript (Zod)",
      "const Item = z.object({ sku: z.string().regex(/^[A-Z0-9-]{3,32}$/), qty: z.number().int().min(1).max(100) }).strict()",
      "",
      "# Python (Pydantic)",
      "class Item(BaseModel): sku: constr(pattern=r'^[A-Z0-9-]{3,32}$'); qty: conint(ge=1, le=100)",
      "",
      "# Java (Bean Validation)",
      "record Item(@Pattern(regexp=\"^[A-Z0-9-]{3,32}$\") String sku, @Min(1) @Max(100) int qty) {}",
      "",
      "# Go (validator tag)",
      "type Item struct { Sku string `validate:\"required,max=32\"`; Qty int `validate:\"min=1,max=100\"` }"
    ]},
    { id: "canon", label: "🔁 Chuẩn hoá", lines: [
      "// SAI: kiểm tra trên chuỗi thô, dùng chuỗi đã decode",
      "name = req.query.file                 // '..%2f..%2fetc%2fpasswd'",
      "if name.contains('../'): reject       // không thấy '../' -> cho qua",
      "open('/data/' + urlDecode(name))      // mở /data/../../etc/passwd !",
      "",
      "// ĐÚNG: decode -> chuẩn hoá -> validate -> dùng CHÍNH giá trị đó",
      "name = urlDecode(req.query.file)",
      "name = unicodeNormalize(name, NFKC)",
      "if not matches(name, '^[a-zA-Z0-9_-]{1,64}\\.pdf$'): reject(400)",
      "open('/data/' + name)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="raw"><div class="nl">📨 Input thô</div><div class="ns">chuỗi/byte bất kỳ từ ngoài ranh giới</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="decode"><div class="nl">🔁 Decode + chuẩn hoá</div><div class="ns">URL-decode, Unicode NFKC, lowercase…</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="schema"><div class="nl">📐 Parse theo schema (allowlist)</div><div class="ns">kiểu · khoảng · độ dài · enum · không field lạ</div></div>
    <div class="arrow" id="a3">↓ hợp lệ</div>
    <div class="row">
      <div class="node" id="typed"><div class="nl">✅ Object đúng kiểu</div><div class="ns">phần còn lại của code chỉ dùng cái này</div></div>
      <div class="node" id="reject"><div class="nl">⛔ 400 Bad Request</div><div class="ns">từ chối, không 'sửa hộ'</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Denylist luôn thiếu", tab: "deny", highlight: [3, 9, 10, 11, 12, 13], on: ["raw"],
      desc: "Danh sách chặn chỉ chứa những gì <em>bạn</em> nghĩ ra. Kẻ tấn công có hàng nghìn biến thể: đổi hoa thường, encode, chèn comment, dùng thẻ HTML khác." },
    { title: "2 · Chuẩn hoá trước", tab: "canon", highlight: [2, 3, 4], on: ["raw", "a1", "decode"],
      desc: "Kiểm tra trên chuỗi thô rồi dùng bản đã decode = hai giá trị khác nhau. <code>..%2f</code> vượt qua bộ lọc, rồi bị decode thành <code>../</code> ngay trước khi mở file." },
    { title: "3 · Validate trên đúng giá trị sẽ dùng", tab: "canon", highlight: [7, 8, 9, 10], on: ["decode", "a2", "schema"],
      desc: "Decode → chuẩn hoá → so với allowlist → dùng <strong>chính</strong> giá trị đó. Không có bước biến đổi nào xen giữa kiểm tra và sử dụng." },
    { title: "4 · Khai báo schema allowlist", tab: "allow", highlight: [2, 3, 4, 5, 7, 8], on: ["schema"],
      desc: "Schema nói rõ cái gì được phép: mảng tối đa 50 phần tử, sku theo pattern, qty 1–100, không field lạ. Mọi thứ khác bị từ chối — kể cả kiểu tấn công chưa ai biết." },
    { title: "5 · Parse, don't validate", tab: "allow", highlight: [12, 13], on: ["a3", "typed", "reject"],
      desc: "Sau khi parse, code phía sau nhận một object đã đúng kiểu. Không hợp lệ → trả 400 ngay, không cố 'làm sạch' rồi dùng tiếp." },
    { title: "6 · Ngôn ngữ nào cũng có công cụ", tab: "langs", highlight: [4, 7, 10, 13], on: ["schema", "typed"],
      desc: "Zod, Pydantic, Bean Validation, validator của Go, serde của Rust, JSON Schema, OpenAPI validator… Ý tưởng giống hệt nhau — chọn công cụ theo stack của bạn." }
  ],

  quiz: [
    { q: "Vì sao allowlist an toàn hơn denylist?", options: [
        "Vì allowlist chạy nhanh hơn",
        "Vì allowlist chỉ cho phép những gì biết chắc là đúng, mọi biến thể tấn công chưa biết đều tự động bị từ chối",
        "Vì denylist không dùng được regex",
        "Hai cách an toàn như nhau"
      ], correct: 1,
      explanation: "Denylist phải liệt kê hết mọi cách tấn công — không thể. Allowlist chỉ cần mô tả input hợp lệ." },
    { q: "Bộ lọc kiểm tra chuỗi có chứa '../' không, sau đó code URL-decode rồi mở file. Input '..%2f..%2fetc%2fpasswd' sẽ thế nào?", options: [
        "Bị chặn vì chứa dấu chấm",
        "Vượt qua bộ lọc (chưa decode nên không có '../'), sau đó được decode thành '../../etc/passwd'",
        "Gây lỗi cú pháp",
        "An toàn vì %2f không phải dấu /"
      ], correct: 1,
      explanation: "Kiểm tra và sử dụng trên hai dạng khác nhau của cùng dữ liệu. Phải decode + chuẩn hoá TRƯỚC khi kiểm tra." },
    { q: "Tham số page_size do client gửi, không giới hạn. Rủi ro chính là gì?", options: [
        "Không có rủi ro",
        "SQL Injection",
        "DoS: client gửi page_size=10000000 làm server/DB quá tải",
        "XSS"
      ], correct: 2,
      explanation: "Validate khoảng giá trị cũng là bảo mật: thiếu giới hạn trên dẫn tới cạn tài nguyên (Availability)." },
    { q: "'Parse, don't validate' nghĩa là gì?", options: [
        "Không cần validate input nữa",
        "Chuyển input thành kiểu dữ liệu đúng (số, UUID, enum, object có schema) ngay tại ranh giới, code phía sau chỉ dùng kiểu đã parse",
        "Dùng parser XML cho mọi input",
        "Chỉ validate ở frontend"
      ], correct: 1,
      explanation: "Sau khi parse, không còn chuỗi thô 'chưa rõ đã kiểm tra chưa' trôi xuống các tầng dưới." },
    { q: "Input không hợp lệ (chứa ký tự lạ). Cách xử lý nên chọn?", options: [
        "Tự xoá ký tự lạ rồi dùng tiếp",
        "Từ chối với lỗi 400",
        "Ghi log rồi vẫn xử lý bình thường",
        "Thay ký tự lạ bằng dấu cách"
      ], correct: 1,
      explanation: "Code 'sửa hộ' dễ bị lừa (vd xoá <script> một lần khỏi <scr<script>ipt> lại sinh ra <script>). Từ chối là an toàn và dễ hiểu nhất." },
    { q: "Tên 'O'Brien' đã qua validate (tên hợp lệ). Có thể nối thẳng vào câu SQL không?", options: [
        "Có, vì đã validate",
        "Không — validate chỉ là lớp 1; ngữ cảnh SQL vẫn cần parameterized query",
        "Có, nếu viết hoa toàn bộ",
        "Có, nếu DB là PostgreSQL"
      ], correct: 1,
      explanation: "Dữ liệu hợp lệ về nghiệp vụ vẫn có thể chứa ký tự đặc biệt với một ngữ cảnh khác (dấu ' trong SQL). Mỗi ngữ cảnh đầu ra có biện pháp riêng." },
    { q: "Schema có 'additionalProperties: false' (hoặc .strict()) giúp chặn điều gì?", options: [
        "SQL Injection",
        "Client gửi thêm field lạ như 'role': 'admin' hay 'isVerified': true lọt vào object",
        "Tấn công DoS",
        "Lộ stack trace"
      ], correct: 1,
      explanation: "Từ chối field không khai báo giúp chặn mass assignment — gán hàng loạt field nhạy cảm từ body vào model." },
    { q: "Hai username 'admin' và 'ａｄｍｉｎ' (chữ full-width). Nếu không chuẩn hoá Unicode thì rủi ro gì?", options: [
        "Không rủi ro gì",
        "Có thể đăng ký tài khoản trông giống/được chuẩn hoá thành 'admin' ở chỗ khác, gây giả mạo hoặc vượt kiểm tra",
        "Server bị crash",
        "Mật khẩu bị lộ"
      ], correct: 1,
      explanation: "Nếu một chỗ so sánh bản chưa chuẩn hoá còn chỗ khác chuẩn hoá (NFKC), hai giá trị 'khác nhau' lại thành một — mở đường giả mạo." },
    { q: "Nên validate input ở đâu?", options: [
        "Chỉ ở frontend",
        "Chỉ trong database bằng constraint",
        "Tại ranh giới — ngay khi dữ liệu vào hệ thống (controller, consumer queue, handler webhook)",
        "Chỉ trước khi ghi log"
      ], correct: 2,
      explanation: "Validate càng sớm càng tốt, ngay tại ranh giới tin cậy. Constraint ở DB là lớp bổ sung (defense in depth), không thay thế." }
  ]
});
