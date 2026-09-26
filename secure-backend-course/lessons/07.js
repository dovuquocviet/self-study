window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Injection — khi dữ liệu biến thành lệnh",
  title: "Template injection & Code injection (eval)",
  subtitle: "Khi input người dùng trở thành template, biểu thức, hay code được thực thi",

  theory: `
    <p>Nhiều hệ thống có một "trình thông dịch mini" bên trong: template engine để render email/HTML, expression language để tính công thức,
    rule engine, hàm <code>eval</code>. Nếu input người dùng được đưa vào <em>chỗ đóng vai trò code</em> của trình thông dịch đó, ta có
    <strong>Server-Side Template Injection (SSTI)</strong> hoặc <strong>Code Injection</strong>. Hậu quả thường là thực thi code tuỳ ý trên server.</p>

    <p><strong>1. Template: dữ liệu vs. chính template.</strong> Mọi template engine (Jinja2, Twig, Freemarker, Thymeleaf, Handlebars, EJS, Go template, Razor, Liquid…)
    đều có hai thứ:</p>
    <ul>
      <li><strong>Template</strong> — do lập trình viên viết, chứa cú pháp đặc biệt (vòng lặp, gọi hàm, truy cập thuộc tính).</li>
      <li><strong>Dữ liệu (context)</strong> — giá trị được điền vào chỗ trống.</li>
    </ul>
    <p>✅ Đúng: <code>render(TEMPLATE_CỐ_ĐỊNH, { name: userInput })</code> — userInput chỉ là giá trị.<br>
    ❌ Sai: <code>render("Xin chào " + userInput)</code> — userInput trở thành <em>một phần template</em>, cú pháp template trong đó sẽ được thực thi.</p>
    <p>Tình huống thật hay gặp: tính năng "cho khách hàng tự soạn mẫu email/thông báo", "custom landing page", "thông báo lỗi có chèn tên"… lập trình viên nối chuỗi rồi render.</p>

    <p><strong>2. Code injection — eval và bạn bè.</strong> Các hàm biến chuỗi thành code: <code>eval</code>, <code>exec</code>, <code>new Function(str)</code>, <code>setTimeout(str)</code>,
    script engine nhúng, expression language (SpEL, OGNL, MVEL, JEXL…), <code>vm.runInContext</code>. Đưa input vào đây = cho người dùng viết code chạy trên server.</p>
    <p>Lý do người ta dùng eval thường là: parse JSON (dùng <code>JSON.parse</code>!), tính công thức do người dùng nhập, chọn hàm theo tên, cấu hình "linh hoạt".
    Mỗi lý do đều có cách thay thế an toàn — xem bảng dưới.</p>

    <table>
      <tr><th>Nhu cầu</th><th>❌ Cách nguy hiểm</th><th>✅ Cách an toàn</th></tr>
      <tr><td>Đọc dữ liệu có cấu trúc</td><td><code>eval(text)</code></td><td>Parser dữ liệu: <code>JSON.parse</code>, <code>json.loads</code>, YAML safe loader</td></tr>
      <tr><td>Gọi hàm theo tên do client gửi</td><td><code>eval(name + "()")</code>, reflection tự do</td><td>Map cố định: <code>HANDLERS = { "a": fnA, "b": fnB }</code></td></tr>
      <tr><td>Tính công thức người dùng nhập</td><td><code>eval("1+2*x")</code></td><td>Thư viện parser biểu thức toán học giới hạn (chỉ số, + - * /, hàm được allowlist)</td></tr>
      <tr><td>Khách tự soạn template</td><td>Nối vào template chính, engine full quyền</td><td>Engine "logic-less" hoặc chế độ sandbox (Mustache/Liquid, sandboxed env), chỉ expose biến được phép</td></tr>
      <tr><td>Rule/cấu hình động</td><td>Expression language đầy đủ với input người dùng</td><td>DSL giới hạn tự định nghĩa bằng JSON (field, toán tử allowlist, giá trị)</td></tr>
    </table>

    <p><strong>3. Sandbox không phải thuốc tiên.</strong> Chế độ sandbox của template engine và các thư viện "safe eval" đã nhiều lần bị vượt qua.
    Thứ tự ưu tiên: (1) không cho người dùng viết template/code; (2) nếu buộc phải cho, dùng ngôn ngữ logic-less không gọi được hàm/thuộc tính tuỳ ý;
    (3) chạy phần render trong process/worker cô lập, quyền thấp, có timeout và giới hạn bộ nhớ.</p>

    <p><strong>4. Nhận biết khi review code.</strong> Tìm các chỗ: <code>render(</code>/<code>compile(</code>/<code>fromString(</code> nhận chuỗi có ghép biến;
    <code>eval</code>, <code>exec</code>, <code>Function(</code>; expression parser nhận input HTTP; "template" lưu trong DB do người dùng sửa được.</p>

    <div class="callout"><p>💡 Cùng một quy tắc với SQL và shell: <strong>template/code là thứ lập trình viên viết; người dùng chỉ được cung cấp dữ liệu</strong>.
    Khi thấy input người dùng đi vào vị trí "code", hãy dừng lại và tìm cách thiết kế khác.</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Nối vào template", lines: [
      "// Pseudo-code: trang lỗi 'thân thiện' có chèn tên người dùng",
      "handle GET /hello (req):",
      "    name = req.query.name",
      "    tpl  = \"<h1>Xin chào \" + name + \"</h1>\"      // input thành một phần TEMPLATE",
      "    return templateEngine.renderString(tpl, {})",
      "",
      "// name = \"An\"                        -> <h1>Xin chào An</h1>",
      "// name = \"<cú_pháp_template_của_engine>\"",
      "//      -> engine THỰC THI phần đó như code template",
      "//      -> tuỳ engine, có thể truy cập object nội bộ, đọc cấu hình, chạy code"
    ]},
    { id: "safe", label: "✅ Template cố định", lines: [
      "// Template là file/hằng số do lập trình viên viết:",
      "HELLO_TPL = \"<h1>Xin chào {{ name }}</h1>\"",
      "",
      "handle GET /hello (req):",
      "    name = validate(req.query.name, maxLen=50)",
      "    return templateEngine.render(HELLO_TPL, { name: name })   // name chỉ là DỮ LIỆU",
      "",
      "// Engine điền giá trị + auto-escape HTML",
      "// cú pháp template bên trong 'name' được in ra như chữ thường"
    ]},
    { id: "eval", label: "❌ eval / expression", lines: [
      "// 1) Parse dữ liệu bằng eval",
      "config = eval(req.body.configText)                  // ❌",
      "",
      "// 2) Gọi hàm theo tên",
      "result = eval(req.query.action + \"(order)\")         // ❌",
      "",
      "// 3) Công thức do khách nhập (tính phí ship, giảm giá)",
      "fee = eval(merchant.feeFormula)                     // ❌ merchant = người dùng!",
      "",
      "// 4) Expression language với input HTTP",
      "value = expressionParser.parse(req.query.expr).getValue(context)   // ❌"
    ]},
    { id: "alt", label: "✅ Thay thế an toàn", lines: [
      "// 1) Dữ liệu -> parser dữ liệu",
      "config = JSON.parse(req.body.configText)  // rồi validate theo schema",
      "",
      "// 2) Tên hàm -> map cố định",
      "ACTIONS = { \"approve\": approveOrder, \"cancel\": cancelOrder }",
      "fn = ACTIONS[req.query.action] or reject(400)",
      "result = fn(order)",
      "",
      "// 3) Công thức -> DSL giới hạn, lưu dạng dữ liệu",
      "// { \"base\": 15000, \"perKg\": 5000, \"freeOver\": 500000 }",
      "fee = computeFee(rule, cart)             // code của ta đọc rule, không eval",
      "",
      "// 4) Nếu thật sự cần biểu thức: thư viện math-expression chỉ cho số + phép toán"
    ]},
    { id: "custom", label: "🧩 Khách tự soạn mẫu", lines: [
      "// Nhu cầu: merchant tự soạn email 'Cảm ơn {{customer_name}} đã mua {{product}}'",
      "",
      "// Lựa chọn an toàn theo thứ tự:",
      "// 1. Placeholder đơn giản, thay thế bằng code của ta (không dùng engine):",
      "ALLOWED = [\"customer_name\", \"product\", \"order_id\"]",
      "out = replacePlaceholders(merchantText, ALLOWED, values)   // chỉ thay {{x}} có trong ALLOWED",
      "",
      "// 2. Engine logic-less (Mustache/Liquid) ở chế độ strict, chỉ truyền dữ liệu phẳng",
      "",
      "// 3. Render trong worker cô lập: timeout, giới hạn RAM, không quyền mạng/file",
      "",
      "// Và LUÔN escape kết quả theo ngữ cảnh (HTML email)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="dev"><div class="nl">👩‍💻 Template / code</div><div class="ns">lập trình viên viết</div></div>
      <div class="node" id="user"><div class="nl">📨 Dữ liệu</div><div class="ns">người dùng cung cấp</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="engine"><div class="nl">⚙️ Template engine / eval / expression</div><div class="ns">trình thông dịch mini trong app</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="bad"><div class="nl">💥 Dữ liệu vào vị trí code</div><div class="ns">bị thực thi</div></div>
      <div class="node" id="good"><div class="nl">✅ Dữ liệu vào vị trí giá trị</div><div class="ns">chỉ được in ra</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Nối input vào template", tab: "vuln", highlight: [3, 4, 5], on: ["user", "a1", "engine"],
      desc: "Chuỗi template được dựng bằng cách ghép input. Engine không biết phần nào do ai viết — nó biên dịch toàn bộ." },
    { title: "2 · Cú pháp template bị thực thi", tab: "vuln", highlight: [8, 9, 10], on: ["engine", "a2", "bad"],
      desc: "Nếu input chứa cú pháp của engine, nó được thực thi như code template. Nhiều engine cho phép đi từ đó tới object nội bộ và thực thi code tuỳ ý." },
    { title: "3 · Template cố định, input là dữ liệu", tab: "safe", highlight: [2, 5, 6], on: ["dev", "user", "good"],
      desc: "Template là hằng số/file. Input được truyền qua context, engine điền giá trị và auto-escape. Cú pháp template trong input chỉ còn là chữ." },
    { title: "4 · eval và expression language", tab: "eval", highlight: [2, 5, 8, 11], on: ["user", "engine", "bad"],
      desc: "Bốn lý do phổ biến để dùng eval. Chú ý dòng 8: 'merchant' cũng là người dùng — dữ liệu từ tài khoản khách hàng không phải code tin cậy." },
    { title: "5 · Mỗi nhu cầu có cách thay thế", tab: "alt", highlight: [2, 5, 6, 10, 11], on: ["dev", "good"],
      desc: "Parser dữ liệu thay cho eval; map cố định thay cho gọi hàm theo tên; DSL dạng dữ liệu thay cho công thức tự do." },
    { title: "6 · Khi khách thật sự cần soạn mẫu", tab: "custom", highlight: [5, 6, 8, 10], on: ["engine", "good"],
      desc: "Ưu tiên thay placeholder bằng code của ta với allowlist biến; tiếp theo là engine logic-less; cuối cùng là cô lập hoàn toàn quá trình render." }
  ],

  quiz: [
    { q: "SSTI xảy ra khi nào?", options: [
        "Khi template được lưu trong file",
        "Khi input người dùng trở thành một phần của chính template (không phải dữ liệu điền vào)",
        "Khi dùng template engine bất kỳ",
        "Khi render HTML ở client"
      ], correct: 1,
      explanation: "render(TEMPLATE_CỐ_ĐỊNH, {name: input}) an toàn; render('...' + input) thì input bị biên dịch như template." },
    { q: "Cách nào đúng?", options: [
        "render(\"Xin chào \" + name)",
        "render(HELLO_TPL, { name: name }) với HELLO_TPL là hằng số",
        "render(req.query.template, {})",
        "render(escape(name) + \"</h1>\")"
      ], correct: 1,
      explanation: "Template cố định, input chỉ đi qua context như dữ liệu." },
    { q: "Muốn gọi hàm xử lý theo tham số ?action=approve. Cách an toàn?", options: [
        "eval(action + '(order)')",
        "Reflection tìm method theo tên bất kỳ",
        "Map cố định { approve: approveOrder, cancel: cancelOrder } và từ chối tên không có trong map",
        "new Function(action)"
      ], correct: 2,
      explanation: "Allowlist bằng map cố định: client chỉ chọn được trong các hàm ta cho phép." },
    { q: "Dùng eval() để parse chuỗi JSON từ request. Nên thay bằng gì?", options: [
        "new Function",
        "Parser dữ liệu như JSON.parse / json.loads rồi validate schema",
        "setTimeout(str)",
        "Không cần thay nếu đã trim chuỗi"
      ], correct: 1,
      explanation: "Parser dữ liệu chỉ tạo ra dữ liệu, không bao giờ thực thi code." },
    { q: "Merchant (khách hàng của nền tảng) nhập công thức tính phí ship được lưu vào DB, sau đó server eval công thức. Có an toàn không vì đó là dữ liệu từ DB của mình?", options: [
        "An toàn vì dữ liệu đến từ DB",
        "Không — merchant là người dùng; dữ liệu họ nhập là không tin cậy dù đã lưu trong DB",
        "An toàn nếu merchant đã đăng nhập",
        "An toàn nếu công thức ngắn"
      ], correct: 1,
      explanation: "Nguồn gốc dữ liệu mới quan trọng, không phải nơi nó đang nằm. Hãy dùng DSL dạng dữ liệu thay vì eval." },
    { q: "Sandbox của template engine có phải là giải pháp tuyệt đối không?", options: [
        "Có, sandbox không thể bị vượt qua",
        "Không — nhiều sandbox đã bị vượt; ưu tiên không cho người dùng viết template, hoặc dùng engine logic-less và cô lập process",
        "Có, nếu bật auto-escape",
        "Không cần sandbox nếu dùng HTTPS"
      ], correct: 1,
      explanation: "Sandbox là một lớp, không phải bảo đảm. Kết hợp logic-less + cô lập + timeout/giới hạn tài nguyên." },
    { q: "Expression language (SpEL/OGNL/JEXL...) nhận biểu thức trực tiếp từ tham số HTTP. Rủi ro?", options: [
        "Không rủi ro, chỉ là tính toán",
        "Code injection — nhiều expression language truy cập được class/hàm hệ thống",
        "Chỉ làm chậm server",
        "Chỉ lỗi hiển thị"
      ], correct: 1,
      explanation: "Expression language đầy đủ gần như là một ngôn ngữ lập trình; đưa input người dùng vào là cho họ chạy code." },
    { q: "Tính năng cho khách soạn email 'Cảm ơn {{customer_name}}'. Giải pháp an toàn nhất?", options: [
        "Đưa nguyên văn bản vào template engine full quyền",
        "Tự thay các placeholder nằm trong allowlist bằng code của mình, không dùng engine",
        "eval văn bản",
        "Cho khách viết thẳng code template của engine"
      ], correct: 1,
      explanation: "Chỉ cần thay thế đơn giản thì không cần engine; allowlist biến giới hạn những gì khách truy cập được." },
    { q: "Khi review code, dấu hiệu nào gợi ý nguy cơ SSTI/code injection?", options: [
        "Dùng JSON.parse",
        "renderString/compile/fromString nhận chuỗi có ghép biến; eval/exec/Function nhận input",
        "Có unit test",
        "Dùng hằng số cho template"
      ], correct: 1,
      explanation: "Tìm những chỗ chuỗi động được biên dịch/thực thi — đó là nơi dữ liệu có thể thành code." }
  ]
});
