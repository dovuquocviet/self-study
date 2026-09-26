window.LESSONS.push({
  id: "09",
  phase: "1", phaseName: "Injection — khi dữ liệu biến thành lệnh",
  title: "Parse dữ liệu có cấu trúc một cách an toàn (JSON, YAML, XML, serialize)",
  subtitle: "Định dạng chỉ-dữ-liệu · safe loader · tắt DTD/external entity · giới hạn kích thước · ký toàn vẹn",

  theory: `
    <p>Backend liên tục nhận dữ liệu có cấu trúc: body JSON của API, file cấu hình YAML, file XML từ đối tác, message trong hàng đợi, cookie/session,
    dữ liệu cache… Bước biến bytes thành object gọi là <strong>parse</strong> (hay <strong>deserialize</strong>). Rủi ro nằm ở chỗ một số định dạng và parser
    có khả năng <strong>làm nhiều hơn là đọc dữ liệu</strong>: tạo object thuộc lớp tuỳ ý, gọi code khi khởi tạo, tải tài nguyên bên ngoài, hoặc tốn tài nguyên
    không giới hạn. Nếu bytes đến từ nguồn không tin cậy, người gửi có thể điều khiển những hành vi đó. Bài này tập trung vào <em>cách cấu hình và viết code đúng</em>.</p>

    <p><strong>1. Nguyên tắc gốc: bytes từ bên ngoài chỉ được trở thành DỮ LIỆU.</strong> Kết quả parse nên chỉ gồm các kiểu cơ bản: chuỗi, số, boolean, null,
    mảng, map — hoặc một struct/DTO mà <em>bạn</em> định nghĩa sẵn. Parser không được tự chọn lớp để khởi tạo, không được chạy code, không được mở file hay kết nối mạng.</p>

    <p><strong>2. Chọn định dạng chỉ-dữ-liệu thay vì serialize object gốc của ngôn ngữ.</strong></p>
    <table>
      <tr><th>Nhóm</th><th>Ví dụ</th><th>Dùng cho dữ liệu không tin cậy?</th></tr>
      <tr><td>✅ Chỉ-dữ-liệu, có schema</td><td>JSON (+ JSON Schema), Protobuf, Avro, MessagePack, CBOR</td><td>Có — kèm validate schema và giới hạn kích thước</td></tr>
      <tr><td>⚠️ Mạnh, cần cấu hình an toàn</td><td>YAML, XML</td><td>Có, <strong>chỉ khi</strong> dùng safe loader / tắt DTD</td></tr>
      <tr><td>❌ Serialize object gốc của ngôn ngữ</td><td>Java <code>ObjectInputStream</code>, Python <code>pickle</code>/<code>shelve</code>, PHP <code>unserialize</code>, .NET <code>BinaryFormatter</code>, Ruby <code>Marshal</code></td><td>Không. Chỉ dùng cho dữ liệu chính process mình tạo và lưu ở nơi client không chạm tới được</td></tr>
    </table>
    <p>Lý do ngắn gọn: định dạng serialize gốc lưu cả <em>tên lớp</em>, nên khi đọc, runtime có thể khởi tạo lớp do dữ liệu chỉ định và chạy code của lớp đó.
    Bạn không kiểm soát được danh sách lớp nằm trong classpath/thư viện, nên cách chắc chắn nhất là <strong>không dùng</strong> cho input bên ngoài.</p>

    <p><strong>3. JSON cũng cần cẩn thận ở tầng "bind vào object".</strong> Tự thân JSON an toàn, nhưng một số thư viện có chế độ "đa hình" cho phép JSON chỉ định
    kiểu lớp (ví dụ trường kiểu <code>@class</code>/<code>$type</code>). Cách làm đúng:</p>
    <ul>
      <li><strong>Tắt default typing / type name handling</strong> (Jackson: không bật <code>activateDefaultTyping</code>; Json.NET: <code>TypeNameHandling.None</code>; fastjson: tắt autoType).</li>
      <li>Nếu cần đa hình: dùng <strong>allowlist kiểu con</strong> khai báo tường minh (<code>@JsonSubTypes</code>, discriminator với tập giá trị cố định).</li>
      <li>Bind vào <strong>DTO riêng</strong> chỉ chứa field được phép, rồi validate bằng schema (bài 03) — không bind thẳng vào entity DB (tránh "mass assignment").</li>
      <li>Tránh <code>eval</code> để "parse" JSON — dùng <code>JSON.parse</code>/thư viện chuẩn.</li>
    </ul>

    <p><strong>4. YAML: luôn dùng safe loader.</strong> YAML đầy đủ hỗ trợ tag chỉ định kiểu của ngôn ngữ; loader "đầy đủ" sẽ khởi tạo các kiểu đó.</p>
    <ul>
      <li>Python PyYAML: <code>yaml.safe_load</code> (không dùng <code>yaml.load</code> với <code>Loader=Loader/UnsafeLoader</code>).</li>
      <li>Ruby: <code>YAML.safe_load</code> (Psych 4 mặc định an toàn cho <code>load</code>, nhưng hãy viết rõ ý định).</li>
      <li>Java SnakeYAML: <code>new Yaml(new SafeConstructor(new LoaderOptions()))</code>; SnakeYAML 2.x an toàn hơn theo mặc định.</li>
      <li>Node <code>js-yaml</code> 4.x: <code>yaml.load</code> mặc định dùng schema an toàn; không thêm schema/tag tuỳ biến cho input ngoài.</li>
      <li>Giới hạn alias/anchor (ví dụ <code>LoaderOptions.setMaxAliasesForCollections</code>) và kích thước file — alias lồng nhau có thể làm bùng nổ bộ nhớ.</li>
    </ul>

    <p><strong>5. XML: tắt DTD và external entity.</strong> Chuẩn XML cho phép tài liệu tự khai báo DTD và "entity" trỏ tới tài nguyên bên ngoài;
    parser cấu hình mặc định (ở nhiều ngôn ngữ/phiên bản cũ) sẽ xử lý chúng — dẫn tới đọc file cục bộ, gọi mạng nội bộ, hoặc bùng nổ bộ nhớ (lỗ hổng nhóm XXE).
    Cấu hình đúng:</p>
    <ul>
      <li><strong>Tốt nhất: cấm hẳn DOCTYPE</strong> (Java: feature <code>disallow-doctype-decl = true</code>). Dữ liệu nghiệp vụ gần như không bao giờ cần DTD.</li>
      <li>Nếu không cấm được: tắt external general/parameter entity, tắt tải DTD ngoài, tắt XInclude, bật secure processing.</li>
      <li>Python: dùng <code>defusedxml</code> thay cho <code>xml.etree</code>/<code>minidom</code>/<code>lxml</code> với input ngoài; lxml thì <code>resolve_entities=False, no_network=True</code>.</li>
      <li>.NET: <code>DtdProcessing = Prohibit</code>, <code>XmlResolver = null</code> (mặc định an toàn từ .NET 4.5.2+, nhưng hãy đặt tường minh).</li>
      <li>PHP: libxml ≥ 2.9 mặc định không nạp external entity; không truyền cờ <code>LIBXML_NOENT</code>/<code>LIBXML_DTDLOAD</code>.</li>
      <li>Nhớ các "XML trá hình": SVG, DOCX/XLSX (zip chứa XML), SOAP, SAML, RSS — cùng áp dụng cấu hình trên.</li>
    </ul>

    <p><strong>6. Giới hạn tài nguyên cho MỌI parser.</strong> Kể cả định dạng an toàn nhất vẫn có thể bị dùng để làm cạn tài nguyên:</p>
    <ul>
      <li><strong>Kích thước body</strong>: đặt ở reverse proxy và framework (ví dụ 1 MB cho API JSON thông thường).</li>
      <li><strong>Độ sâu lồng nhau</strong> (ví dụ ≤ 32), <strong>số phần tử mảng/khoá</strong>, <strong>độ dài chuỗi</strong>, độ lớn số.</li>
      <li><strong>Timeout</strong> cho việc xử lý, và parser dạng stream cho file lớn.</li>
      <li>Nhiều thư viện có sẵn: Jackson <code>StreamReadConstraints</code> (maxNestingDepth, maxStringLength), Go <code>http.MaxBytesReader</code>, Express <code>express.json({ limit })</code>, Protobuf recursion limit.</li>
    </ul>

    <p><strong>7. Khi buộc phải đưa dữ liệu serialize ra ngoài rồi nhận lại</strong> (cookie, token, trạng thái trong form, message qua hàng đợi dùng chung):</p>
    <ul>
      <li>Vẫn dùng định dạng chỉ-dữ-liệu (JSON), <strong>ký HMAC</strong> (hoặc chữ ký số / AEAD nếu cần bí mật) bằng khoá chỉ server biết.</li>
      <li><strong>Kiểm tra chữ ký TRƯỚC khi parse</strong>, so sánh bằng hàm constant-time; sai chữ ký → từ chối, không parse.</li>
      <li>Kèm thời hạn (<code>exp</code>), phiên bản khoá (<code>kid</code>) để xoay khoá, và mục đích sử dụng để token loại này không dùng được chỗ khác.</li>
      <li>Chữ ký chứng minh dữ liệu do mình tạo, <em>không</em> biến định dạng nguy hiểm thành an toàn — nếu khoá lộ, định dạng chỉ-dữ-liệu vẫn là lớp bảo vệ cuối.</li>
    </ul>

    <div class="callout"><p>💡 Checklist khi review code parse dữ liệu: (1) Có dùng serialize object gốc cho input ngoài không? (2) JSON có bật đa hình/type hint không?
    (3) YAML dùng safe loader chưa? (4) XML parser đã cấm DOCTYPE/external entity chưa (kể cả SVG, DOCX, SAML)? (5) Có giới hạn kích thước, độ sâu, số phần tử, timeout không?
    (6) Dữ liệu đi ra ngoài rồi quay lại có được ký và kiểm tra chữ ký trước khi parse không? (7) Kết quả parse có qua schema validation trước khi dùng không?</p></div>
  `,

  codeTabs: [
    { id: "vuln", label: "❌ Parser quá mạnh", lines: [
      "// Pseudo-code: nhận 'trạng thái giỏ hàng' từ cookie",
      "handle POST /cart/restore (req):",
      "    blob  = base64Decode(req.cookies.cart)",
      "    state = nativeDeserialize(blob)     // định dạng serialize gốc của ngôn ngữ",
      "    return render(state)",
      "",
      "// Định dạng gốc lưu cả TÊN LỚP -> runtime khởi tạo lớp do dữ liệu chỉ định.",
      "// blob = '<user_input_payload>' -> người gửi điều khiển lớp nào được tạo,",
      "//         có thể kéo theo việc chạy code với quyền của backend."
    ]},
    { id: "safe", label: "✅ Chỉ-dữ-liệu + ký", lines: [
      "CartSchema = { items: array(max 100) of { sku: string(1..32), qty: int(1..99) } }",
      "",
      "handle POST /cart/restore (req):",
      "    token = req.cookies.cart",
      "    if size(token) > 4 KB: return 400                   // giới hạn trước",
      "    (payload, sig) = split(token)",
      "    if not constantTimeEquals(sig, hmac(KEY, payload)): return 400   // ký trước, parse sau",
      "    data = jsonParse(payload, maxDepth = 8)             // chỉ ra map/list/string/number",
      "    if data.exp < now(): return 400",
      "    cart = validate(CartSchema, data)                   // DTO riêng, schema chặt",
      "    return render(cart)",
      "",
      "// Tốt hơn nữa: lưu giỏ hàng ở server, cookie chỉ chứa ID phiên."
    ]},
    { id: "json", label: "🌐 JSON đa ngôn ngữ", lines: [
      "// Java - Jackson: KHÔNG bật default typing; giới hạn tài nguyên",
      "JsonMapper m = JsonMapper.builder().build();   // không activateDefaultTyping",
      "m.getFactory().setStreamReadConstraints(StreamReadConstraints.builder().maxNestingDepth(32).build());",
      "CartDto dto = m.readValue(body, CartDto.class); // bind vào DTO cụ thể",
      "// .NET - Json.NET",
      "new JsonSerializerSettings { TypeNameHandling = TypeNameHandling.None, MaxDepth = 32 };",
      "# Python",
      "data = json.loads(body)          # rồi validate bằng pydantic / jsonschema",
      "# Node.js",
      "app.use(express.json({ limit: '100kb' }));   // rồi validate bằng zod/ajv",
      "# Go",
      "dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)); dec.DisallowUnknownFields()"
    ]},
    { id: "yaml", label: "📄 YAML safe loader", lines: [
      "# Python (PyYAML)",
      "cfg = yaml.safe_load(text)                 # KHÔNG yaml.load(text, Loader=yaml.Loader)",
      "# Ruby",
      "cfg = YAML.safe_load(text, permitted_classes: [], aliases: false)",
      "# Java (SnakeYAML)",
      "LoaderOptions opt = new LoaderOptions(); opt.setMaxAliasesForCollections(50);",
      "Yaml y = new Yaml(new SafeConstructor(opt));",
      "# Node.js (js-yaml 4.x)",
      "const cfg = yaml.load(text);               // schema mặc định an toàn, không thêm tag tuỳ biến",
      "# Go (gopkg.in/yaml.v3)",
      "yaml.Unmarshal(data, &cfgStruct)           // decode vào struct định nghĩa sẵn"
    ]},
    { id: "xml", label: "🧱 XML parser an toàn", lines: [
      "// Java - DocumentBuilderFactory",
      "f.setFeature(\"http://apache.org/xml/features/disallow-doctype-decl\", true);   // cấm DOCTYPE",
      "f.setFeature(\"http://xml.org/sax/features/external-general-entities\", false);",
      "f.setFeature(\"http://xml.org/sax/features/external-parameter-entities\", false);",
      "f.setXIncludeAware(false); f.setExpandEntityReferences(false);",
      "f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);",
      "# Python",
      "from defusedxml.ElementTree import fromstring    # thay cho xml.etree",
      "# .NET",
      "new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };",
      "# PHP",
      "$doc->loadXML($xml, LIBXML_NONET);               // KHÔNG dùng LIBXML_NOENT / LIBXML_DTDLOAD"
    ]}
  ],

  stageHtml: `
    <div class="node" id="bytes"><div class="nl">📨 Bytes từ bên ngoài</div><div class="ns">body API · cookie · file upload · message queue</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="limits"><div class="nl">📏 Giới hạn tài nguyên</div><div class="ns">kích thước · độ sâu · số phần tử · timeout</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="sig"><div class="nl">🔏 Kiểm tra chữ ký</div><div class="ns">HMAC/chữ ký số · constant-time · exp</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="native"><div class="nl">🧨 Serialize gốc / parser đầy đủ</div><div class="ns">❌ dữ liệu chọn lớp, tải tài nguyên ngoài</div></div>
      <div class="node" id="dataonly"><div class="nl">🧾 Parser chỉ-dữ-liệu</div><div class="ns">✅ JSON · Protobuf · YAML safe · XML không DTD</div></div>
    </div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="schema"><div class="nl">📐 Schema → DTO</div><div class="ns">field cho phép · kiểu · khoảng giá trị</div></div>
  `,
  steps: [
    { title: "1 · Chỗ lỗi: parser làm nhiều hơn đọc dữ liệu", tab: "vuln", highlight: [3, 4], on: ["bytes", "native"],
      desc: "Cookie do client giữ được đưa thẳng vào hàm deserialize gốc của ngôn ngữ. Định dạng này lưu cả tên lớp, nên dữ liệu quyết định object nào được tạo." },
    { title: "2 · Hậu quả (dạng trừu tượng)", tab: "vuln", highlight: [7, 8, 9], on: ["native"],
      desc: "Với <code>&lt;user_input_payload&gt;</code>, người gửi điều khiển quá trình khởi tạo object, có thể dẫn tới chạy code. Phòng thủ không cần biết payload: <strong>đừng để bytes ngoài đi vào parser có khả năng tạo lớp tuỳ ý</strong>." },
    { title: "3 · Giới hạn trước, ký trước, parse sau", tab: "safe", highlight: [5, 6, 7], on: ["a1", "limits", "a2", "sig"],
      desc: "Chặn kích thước ngay đầu; kiểm tra HMAC bằng so sánh constant-time. Sai chữ ký thì từ chối, không bao giờ parse dữ liệu chưa xác thực." },
    { title: "4 · Parser chỉ-dữ-liệu + schema", tab: "safe", highlight: [1, 8, 9, 10, 13], on: ["a3", "dataonly", "a4", "schema"],
      desc: "JSON chỉ ra kiểu cơ bản; giới hạn độ sâu; kiểm tra hạn dùng; bind vào DTO qua schema chặt. Tốt nhất là giữ trạng thái ở server và chỉ đưa ID ra ngoài." },
    { title: "5 · JSON: tắt đa hình, bind vào DTO", tab: "json", highlight: [2, 3, 4, 6, 10, 12], on: ["dataonly", "limits", "schema"],
      desc: "Không bật default typing / TypeNameHandling; đặt giới hạn độ sâu và kích thước; decode vào DTO/struct cụ thể, từ chối field lạ." },
    { title: "6 · YAML: safe loader", tab: "yaml", highlight: [2, 4, 6, 7, 9, 11], on: ["dataonly"],
      desc: "safe_load, SafeConstructor, schema mặc định an toàn, decode vào struct. Giới hạn alias để tránh bùng nổ bộ nhớ." },
    { title: "7 · XML: cấm DOCTYPE, tắt entity ngoài", tab: "xml", highlight: [2, 3, 4, 5, 6, 8, 10, 12], on: ["dataonly", "limits"],
      desc: "Cấm DOCTYPE là cấu hình mạnh nhất; nếu không được thì tắt external entity, XInclude, bật secure processing. Python dùng defusedxml, .NET đặt DtdProcessing.Prohibit. Áp dụng cả cho SVG, DOCX, SAML." }
  ],

  quiz: [
    { q: "Nguyên tắc gốc khi parse dữ liệu từ nguồn không tin cậy là gì?", options: [
        "Parse càng nhanh càng tốt",
        "Bytes từ bên ngoài chỉ được trở thành dữ liệu thuần (chuỗi, số, map, list hoặc DTO định nghĩa sẵn), parser không tự chọn lớp, chạy code hay tải tài nguyên ngoài",
        "Luôn dùng XML vì có schema",
        "Chỉ cần HTTPS là đủ"
      ], correct: 1,
      explanation: "Rủi ro đến từ việc parser làm nhiều hơn đọc dữ liệu; giữ kết quả ở dạng dữ liệu thuần là cách phòng thủ gốc." },
    { q: "Vì sao không nên dùng Java ObjectInputStream, Python pickle, PHP unserialize cho dữ liệu từ client?", options: [
        "Vì chúng chậm",
        "Vì định dạng lưu cả tên lớp, runtime có thể khởi tạo lớp do dữ liệu chỉ định và chạy code của lớp đó",
        "Vì chúng không hỗ trợ UTF-8",
        "Vì file sinh ra quá lớn"
      ], correct: 1,
      explanation: "Bạn không kiểm soát được mọi lớp trong classpath/thư viện; cách chắc chắn nhất là không dùng serialize gốc cho input ngoài." },
    { q: "Thư viện JSON có chế độ cho phép JSON chỉ định kiểu lớp (default typing, TypeNameHandling). Nên làm gì?", options: [
        "Bật lên cho tiện",
        "Tắt; nếu cần đa hình thì dùng allowlist kiểu con khai báo tường minh và bind vào DTO cụ thể",
        "Chỉ bật trong production",
        "Mã hoá JSON trước khi parse"
      ], correct: 1,
      explanation: "Để dữ liệu chọn lớp là tái tạo rủi ro của serialize gốc ngay trong JSON." },
    { q: "Với PyYAML, cách load file YAML từ người dùng đúng là?", options: [
        "yaml.load(text, Loader=yaml.Loader)",
        "yaml.safe_load(text)",
        "eval(text)",
        "yaml.load(text, Loader=yaml.UnsafeLoader)"
      ], correct: 1,
      explanation: "safe_load chỉ tạo kiểu cơ bản; loader đầy đủ có thể khởi tạo kiểu Python tuỳ ý theo tag trong YAML." },
    { q: "Cấu hình mạnh nhất cho XML parser xử lý dữ liệu ngoài là gì?", options: [
        "Bật validate DTD",
        "Cấm hẳn DOCTYPE (disallow-doctype-decl = true); nếu không được thì tắt external entity, XInclude, tải DTD ngoài",
        "Chỉ chấp nhận file có đuôi .xml",
        "Tăng bộ nhớ heap"
      ], correct: 1,
      explanation: "Dữ liệu nghiệp vụ gần như không cần DTD; cấm DOCTYPE loại bỏ cả nhóm lỗi XXE và bùng nổ entity." },
    { q: "Định dạng nào sau đây cũng là XML và cần cấu hình parser an toàn tương tự?", options: [
        "PNG",
        "SVG, DOCX/XLSX, SAML, SOAP",
        "CSV",
        "MP4"
      ], correct: 1,
      explanation: "Các định dạng này chứa XML bên trong; parser xử lý chúng cũng phải tắt DTD/external entity." },
    { q: "Trong Python, lựa chọn nào an toàn khi parse XML không tin cậy?", options: [
        "xml.dom.minidom với cấu hình mặc định",
        "defusedxml (hoặc lxml với resolve_entities=False, no_network=True)",
        "Dùng regex để đọc XML",
        "pickle"
      ], correct: 1,
      explanation: "defusedxml bọc các parser chuẩn và chặn entity/DTD nguy hiểm." },
    { q: "Vì sao cần giới hạn kích thước, độ sâu, số phần tử ngay cả với JSON?", options: [
        "Để JSON đẹp hơn",
        "Vì dữ liệu hợp lệ về cú pháp vẫn có thể làm cạn CPU/RAM (lồng quá sâu, mảng khổng lồ)",
        "Vì JSON không hỗ trợ số lớn",
        "Không cần giới hạn"
      ], correct: 1,
      explanation: "Giới hạn tài nguyên là lớp bảo vệ cho mọi parser: body size, maxDepth, số phần tử, độ dài chuỗi, timeout." },
    { q: "Dữ liệu serialize phải gửi ra client rồi nhận lại (cookie trạng thái). Thứ tự xử lý đúng?", options: [
        "Parse trước, kiểm tra chữ ký sau",
        "Giới hạn kích thước → kiểm tra HMAC bằng so sánh constant-time → mới parse (định dạng chỉ-dữ-liệu) → kiểm tra hạn dùng → validate schema",
        "Chỉ base64 là đủ",
        "Mã hoá bằng khoá công khai của client"
      ], correct: 1,
      explanation: "Không bao giờ parse dữ liệu chưa xác thực; định dạng chỉ-dữ-liệu vẫn là lớp bảo vệ nếu khoá bị lộ." },
    { q: "Nhận định nào đúng về việc ký HMAC dữ liệu serialize?", options: [
        "Ký rồi thì dùng pickle/ObjectInputStream cũng an toàn tuyệt đối",
        "Chữ ký chứng minh dữ liệu do server tạo, nhưng không biến định dạng nguy hiểm thành an toàn; vẫn nên dùng định dạng chỉ-dữ-liệu",
        "HMAC mã hoá dữ liệu để client không đọc được",
        "Có thể so sánh chữ ký bằng == thông thường"
      ], correct: 1,
      explanation: "Nếu khoá lộ, định dạng chỉ-dữ-liệu là lớp phòng thủ cuối. HMAC không che giấu nội dung; cần AEAD nếu muốn bí mật. So sánh phải constant-time." },
    { q: "Sau khi parse JSON thành công, bước nào nên làm trước khi dùng dữ liệu?", options: [
        "Lưu thẳng object vào entity DB",
        "Validate bằng schema và bind vào DTO chỉ chứa field được phép",
        "Chuyển thành chuỗi rồi eval",
        "Không cần làm gì thêm"
      ], correct: 1,
      explanation: "Parse đúng cú pháp chưa có nghĩa dữ liệu hợp lệ. Schema + DTO chặn field lạ, kiểu sai, và mass assignment." }
  ]
});
