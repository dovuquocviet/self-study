window.LESSONS.push({
  id: "08",
  phase: "2", phaseName: "Cấu hình",
  title: "application.properties hoạt động thế nào",
  subtitle: "Environment, PropertySource, @Value, @ConfigurationProperties",

  theory: `
    <p>Nhiều người tưởng file <code>application.properties</code> là "thần kỳ": cứ ghi vào là
    Spring tự hiểu. Sự thật đơn giản hơn: nó chỉ là <strong>một</strong> nguồn cấu hình,
    và <em>không tự tạo ra gì cả</em>.</p>
    <p>Spring gom <strong>mọi</strong> nguồn cấu hình vào một abstraction tên là
    <strong><code>Environment</code></strong>. Bên trong <code>Environment</code> là một
    <strong>DANH SÁCH CÓ THỨ TỰ</strong> các <code>PropertySource</code>. Khi cần một key,
    <code>Environment</code> dò lần lượt từ trên xuống — <strong>nguồn đứng TRƯỚC thắng</strong>
    khi trùng key (override). Thứ tự ưu tiên (từ cao đến thấp):</p>
    <ul>
      <li><strong>Command-line args</strong> (<code>--app.name=X</code>) — cao nhất.</li>
      <li><strong>OS environment variables / JVM system properties</strong> (<code>-Dapp.name=X</code>).</li>
      <li><strong>application-{profile}.properties/yml</strong> (theo profile đang bật).</li>
      <li><strong>application.properties/yml</strong> — mặc định trong <code>resources/</code>.</li>
      <li><strong>Giá trị default</strong> viết trong <code>@Value("...:default")</code> — thấp nhất.</li>
    </ul>
    <p><strong><code>@Value("\${app.name}")</code></strong> được xử lý bởi một
    <code>BeanPostProcessor</code>: nó tra key qua <code>Environment</code> rồi điền giá trị vào
    field/param <em>khi bean được tạo</em>. Có thể đặt default: <code>@Value("\${app.name:Mặc định}")</code>.</p>
    <p><strong><code>@ConfigurationProperties(prefix="app")</code></strong> bind cả một <em>nhóm</em>
    key cùng tiền tố vào các field của một POJO — type-safe và gom nhóm gọn gàng. Nó có
    <strong>relaxed binding</strong>: <code>app.myName</code>, <code>app.my-name</code>,
    <code>app.MY_NAME</code> đều bind vào field <code>myName</code>.</p>
    <div class="callout"><p>💡 Cốt lõi: file .properties chỉ là MỘT <code>PropertySource</code>.
    Thứ thật sự <em>đọc &amp; phân giải</em> là <code>Environment</code>, và
    <strong>thứ tự nguồn quyết định giá trị cuối cùng</strong>.</p></div>
  `,

  codeTabs: [
    { id: "properties", label: "⚙️ application.properties", lines: [
      "app.name=Cửa hàng ABC",
      "app.max-items=50",
      "app.timeout=60",
      "spring.datasource.url=jdbc:mysql://localhost/db"
    ]},
    { id: "java", label: "☕ @Value & @ConfigurationProperties", lines: [
      "@Component",
      "class Banner {",
      "    @Value(\"${app.name}\")",
      "    private String name;",
      "",
      "    @Value(\"${app.timeout:30}\")  // default = 30",
      "    private int timeout;",
      "}",
      "",
      "@ConfigurationProperties(prefix = \"app\")",
      "class AppProps {",
      "    private String name;      // ← app.name",
      "    private int maxItems;     // ← app.max-items",
      "    // getters + setters...",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="files"><div class="nl">Các nguồn cấu hình</div><div class="ns">CLI args · env vars · .properties · default</div></div>
    <div class="arrow" id="a1">↓ nạp vào</div>
    <div class="node" id="env"><div class="nl">Environment</div><div class="ns">danh sách PropertySource CÓ THỨ TỰ</div></div>
    <div class="row">1 · Command-line args (thắng cao nhất)</div>
    <div class="row">2 · OS env vars / JVM system properties</div>
    <div class="row">3 · application-{profile}.properties</div>
    <div class="row">4 · application.properties</div>
    <div class="row">5 · Giá trị default trong @Value (thấp nhất)</div>
    <div class="arrow" id="a2">↓ hỏi giá trị</div>
    <div class="node" id="resolve"><div class="nl">@Value / @ConfigurationProperties</div><div class="ns">tra key qua Environment</div></div>
    <div class="arrow" id="a3">↓ tiêm vào</div>
    <div class="node" id="bean"><div class="nl">Bean đã có giá trị</div><div class="ns">field được điền lúc tạo bean</div></div>
  `,
  steps: [
    { title: "1 · File .properties chỉ là một nguồn", tab: "properties", highlight: [1, 2, 3], on: ["files"],
      desc: "<code>application.properties</code> chỉ là các cặp <code>key=value</code>. Nó KHÔNG tự tạo bean hay tự tiêm gì cả — nó là <strong>một</strong> trong nhiều nguồn cấu hình." },
    { title: "2 · Mọi nguồn gom vào Environment", tab: "properties", highlight: [1, 2, 3, 4], on: ["files", "a1", "env"],
      desc: "Lúc khởi động, Spring nạp tất cả nguồn (CLI args, env vars, các file .properties, default) vào <code>Environment</code> dưới dạng một <strong>danh sách PropertySource có thứ tự</strong>." },
    { title: "3 · Thứ tự nguồn = luật override", tab: "properties", highlight: [1], on: ["env"],
      desc: "Khi tra một key, <code>Environment</code> dò từ nguồn ưu tiên cao xuống thấp. Nếu chạy với <code>--app.name=Sale</code> thì CLI arg thắng, giá trị <code>app.name</code> trong file bị <strong>override</strong>." },
    { title: "4 · @Value tra một key qua Environment", tab: "java", highlight: [3, 4, 6, 7], on: ["env", "a2", "resolve"],
      desc: "Một <code>BeanPostProcessor</code> thấy <code>@Value(\"\${app.name}\")</code>, hỏi <code>Environment</code> giá trị của key đó. Thiếu key mà có default (<code>:30</code>) thì dùng default; không có default lại thiếu key → lỗi." },
    { title: "5 · @ConfigurationProperties bind cả nhóm", tab: "java", highlight: [10, 11, 12, 13], on: ["resolve"],
      desc: "<code>@ConfigurationProperties(prefix=\"app\")</code> bind mọi key có tiền tố <code>app.</code> vào POJO. Nhờ <strong>relaxed binding</strong>, <code>app.max-items</code> bind được vào field <code>maxItems</code>." },
    { title: "6 · Giá trị được tiêm vào bean", tab: "java", highlight: [1, 2, 4], on: ["resolve", "a3", "bean"],
      desc: "Sau khi phân giải, giá trị được điền vào field/param <strong>ngay lúc container tạo bean</strong>. Bean nhận về giá trị cuối cùng đã qua luật thứ tự nguồn." }
  ],

  quiz: [
    { q: "Cùng key <code>app.name</code> vừa có trong command-line args vừa có trong application.properties — Spring dùng giá trị nào?", options: [
        "Giá trị trong application.properties, vì đó là file cấu hình chính",
        "Giá trị từ command-line args, vì nguồn này ưu tiên cao hơn",
        "Báo lỗi vì trùng key ở hai nơi",
        "Ghép cả hai giá trị lại với nhau"
      ], correct: 1,
      explanation: "Environment dò các PropertySource theo thứ tự; command-line args đứng trước application.properties nên thắng (override)." },
    { q: "<code>@Value(\"\${app.name}\")</code> lấy giá trị từ đâu?", options: [
        "Đọc trực tiếp file application.properties",
        "Từ một biến static trong class App",
        "Tra key qua Environment (nơi gom mọi PropertySource)",
        "Từ annotation @Value tự sinh giá trị"
      ], correct: 2,
      explanation: "@Value được một BeanPostProcessor xử lý bằng cách hỏi Environment — chứ không đọc thẳng một file cụ thể nào." },
    { q: "\"Relaxed binding\" của @ConfigurationProperties nghĩa là gì?", options: [
        "Bind chậm lại để tăng hiệu năng khởi động",
        "Cho phép nhiều cách viết key (app.myName, app.my-name, app.MY_NAME) cùng bind vào một field",
        "Bỏ qua các key sai kiểu dữ liệu",
        "Chỉ bind khi bean được gọi lần đầu"
      ], correct: 1,
      explanation: "Relaxed binding chấp nhận nhiều biến thể chữ hoa/gạch nối/underscore cho cùng một field POJO, ví dụ app.max-items → maxItems." },
    { q: "@ConfigurationProperties khác @Value chủ yếu ở điểm nào?", options: [
        "@ConfigurationProperties nhanh hơn @Value",
        "@Value chỉ dùng cho số, @ConfigurationProperties cho chuỗi",
        "@Value tiêm từng key lẻ; @ConfigurationProperties bind cả một nhóm key cùng tiền tố vào POJO (type-safe, có relaxed binding)",
        "Hai cái hoàn toàn giống nhau"
      ], correct: 2,
      explanation: "@Value hợp cho một vài giá trị lẻ; @ConfigurationProperties gom cả nhóm key theo prefix vào POJO, type-safe và hỗ trợ relaxed binding." }
  ]
});
