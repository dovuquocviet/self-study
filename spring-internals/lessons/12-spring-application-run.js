window.LESSONS.push({
  id: "12",
  phase: "4", phaseName: "Khởi động & Web",
  title: "SpringApplication.run() từ A đến Z",
  subtitle: "Điều gì xảy ra giữa main() và lúc app sẵn sàng",

  theory: `
    <p>Khi bạn gọi <code>SpringApplication.run(MyApp.class, args)</code> trong <code>main()</code>,
    một chuỗi bước lớn được thực hiện. Đây chính là chỗ <strong>ráp lại tất cả</strong> những gì
    các bài trước đã mổ xẻ: environment → bean definition → post-processor → server → tạo bean.</p>
    <p>Các bước chính của <code>run()</code>:</p>
    <ol>
      <li><strong>Tạo đối tượng SpringApplication</strong>: suy ra <em>loại ứng dụng</em>
          (<code>SERVLET</code> / <code>REACTIVE</code> / <code>NONE</code>) từ classpath, rồi nạp
          <code>ApplicationContextInitializer</code> &amp; <code>ApplicationListener</code> từ
          <code>spring.factories</code>.</li>
      <li><strong>run()</strong>: phát sự kiện <code>starting</code>, rồi tạo và chuẩn bị
          <code>Environment</code> (đọc <code>application.properties</code>, profiles, tham số
          dòng lệnh — bài 08). Lưu ý: environment sẵn sàng <em>trước</em> khi có bất kỳ bean nào.</li>
      <li><strong>createApplicationContext()</strong>: tạo <code>ApplicationContext</code> đúng loại
          (vd <code>AnnotationConfigServletWebServerApplicationContext</code> cho web servlet).</li>
      <li><strong>prepareContext()</strong>: nạp bean definition nguồn (class
          <code>@SpringBootApplication</code>) vào context — mới chỉ là <em>ĐỊNH NGHĨA</em> (bài 03),
          <strong>chưa</strong> tạo instance.</li>
      <li><strong>refreshContext()</strong> — <strong>TRÁI TIM</strong>. Bên trong
          <code>ApplicationContext.refresh()</code>:
        <ul>
          <li><code>invokeBeanFactoryPostProcessors()</code>: chạy các BFPP, trong đó
              <code>ConfigurationClassPostProcessor</code> làm component scan, xử lý
              <code>@Configuration</code>/<code>@Bean</code> và auto-configuration (bài 02/07/09)
              → <em>sinh thêm</em> bean definition.</li>
          <li><code>registerBeanPostProcessors()</code>: đăng ký các BPP (bài 10).</li>
          <li><code>onRefresh()</code>: với web app → <strong>tạo &amp; khởi động embedded server
              (Tomcat)</strong> (bài 13).</li>
          <li><code>finishBeanFactoryInitialization()</code>: <strong>instantiate mọi singleton
              non-lazy</strong> — chạy toàn bộ vòng đời bean (bài 04).</li>
        </ul>
      </li>
      <li><strong>afterRefresh()</strong>: phát sự kiện <code>started</code>/<code>ready</code>,
          chạy các <code>ApplicationRunner</code>/<code>CommandLineRunner</code>. App sẵn sàng.</li>
    </ol>
    <div class="callout"><p>💡 Thứ tự cốt lõi cần nhớ:
    <em>environment → definitions → BFPP (scan/config/autoconfig) → BPP → server → tạo singleton → runners</em>.</p></div>
  `,

  codeTabs: [
    { id: "main", label: "🚀 Điểm khởi động", lines: [
      "@SpringBootApplication",
      "public class MyApp {",
      "",
      "    public static void main(String[] args) {",
      "        SpringApplication.run(MyApp.class, args);",
      "    }",
      "}"
    ]},
    { id: "refresh", label: "⚙️ Bên trong run()", lines: [
      "// SpringApplication.run(MyApp.class, args):",
      "new SpringApplication(MyApp.class);  // suy ra loại",
      "// -> SERVLET / REACTIVE / NONE từ classpath",
      "run(args) {",
      "  listeners.starting();  // phát event",
      "  prepareEnvironment();  // properties+profiles",
      "  context = createApplicationContext();",
      "  prepareContext();  // nạp bean DEFINITION",
      "  refreshContext(context);  // === TRAI TIM ===",
      "    invokeBeanFactoryPostProcessors();",
      "    // ^ scan + @Bean + auto-config",
      "    registerBeanPostProcessors();",
      "    onRefresh();  // tao & start Tomcat",
      "    finishBeanFactoryInitialization();",
      "    // ^ tao moi singleton non-lazy",
      "  afterRefresh();  // event started/ready",
      "  callRunners();  // Application/CommandLineRunner",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="new"><div class="nl">new SpringApplication</div><div class="ns">suy ra loại app từ classpath</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="env"><div class="nl">prepareEnvironment()</div><div class="ns">đọc properties, profiles, args</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="create"><div class="nl">createApplicationContext()</div><div class="ns">tạo context đúng loại</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="prep"><div class="nl">prepareContext()</div><div class="ns">nạp bean DEFINITION nguồn</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="refresh"><div class="nl">refreshContext() · TRÁI TIM</div><div class="ns">ApplicationContext.refresh()</div></div>
    <div class="arrow" id="s1">↓ bên trong</div>
    <div class="node" id="bfpp"><div class="nl">invokeBeanFactoryPostProcessors</div><div class="ns">scan + @Config + auto-config → +definitions</div></div>
    <div class="arrow" id="s2">↓</div>
    <div class="node" id="bpp"><div class="nl">registerBeanPostProcessors</div><div class="ns">đăng ký BPP</div></div>
    <div class="arrow" id="s3">↓</div>
    <div class="node" id="server"><div class="nl">onRefresh()</div><div class="ns">tạo &amp; start Tomcat (web)</div></div>
    <div class="arrow" id="s4">↓</div>
    <div class="node" id="singleton"><div class="nl">finishBeanFactoryInitialization</div><div class="ns">tạo mọi singleton non-lazy</div></div>
    <div class="arrow" id="a5">↓</div>
    <div class="node" id="runners"><div class="nl">callRunners()</div><div class="ns">Application/CommandLineRunner</div></div>
    <div class="arrow" id="a6">↓</div>
    <div class="node" id="ready"><div class="nl">READY</div><div class="ns">app sẵn sàng nhận request</div></div>
  `,
  steps: [
    { title: "1 · main() gọi run()", tab: "main", highlight: [4, 5], on: ["new"],
      desc: "Tất cả bắt đầu từ <code>SpringApplication.run(MyApp.class, args)</code>. Một dòng này che giấu cả một pipeline khởi động — phần còn lại của bài mổ xẻ nó." },
    { title: "2 · Tạo SpringApplication & suy ra loại app", tab: "refresh", highlight: [2, 3], on: ["new"],
      desc: "Constructor nhìn classpath để suy ra <code>WebApplicationType</code>: <code>SERVLET</code>, <code>REACTIVE</code> hay <code>NONE</code>. Đồng thời nạp <code>ApplicationContextInitializer</code> &amp; <code>ApplicationListener</code> từ <code>spring.factories</code>." },
    { title: "3 · Chuẩn bị Environment (TRƯỚC khi có bean)", tab: "refresh", highlight: [5, 6], on: ["env"],
      desc: "Sau sự kiện <code>starting</code>, <code>prepareEnvironment()</code> đọc <code>application.properties</code>, profiles và command-line args (bài 08). Environment sẵn sàng <strong>trước</strong> khi tạo bất kỳ bean nào." },
    { title: "4 · Tạo context & nạp ĐỊNH NGHĨA", tab: "refresh", highlight: [7, 8], on: ["create", "prep"],
      desc: "<code>createApplicationContext()</code> tạo context đúng loại (vd <code>AnnotationConfigServletWebServerApplicationContext</code>). <code>prepareContext()</code> nạp class <code>@SpringBootApplication</code> làm bean <em>definition</em> — vẫn chưa có instance nào (bài 03)." },
    { title: "5 · refresh → BFPP: scan + auto-config", tab: "refresh", highlight: [9, 10, 11], on: ["refresh", "bfpp"],
      desc: "<code>refreshContext()</code> vào <code>refresh()</code>. Bước con <code>invokeBeanFactoryPostProcessors()</code> chạy <code>ConfigurationClassPostProcessor</code>: component scan, xử lý <code>@Configuration</code>/<code>@Bean</code> và auto-configuration (bài 02/07/09) → <strong>sinh thêm</strong> bean definition." },
    { title: "6 · Đăng ký BPP & khởi động server", tab: "refresh", highlight: [12, 13], on: ["bpp", "server"],
      desc: "<code>registerBeanPostProcessors()</code> đăng ký các BPP (bài 10). Với web app, <code>onRefresh()</code> <strong>tạo &amp; khởi động embedded Tomcat</strong> (bài 13) — server đã lắng nghe port dù bean chưa tạo xong." },
    { title: "7 · Tạo singleton, chạy runner, READY", tab: "refresh", highlight: [14, 15, 16, 17], on: ["singleton", "runners", "ready"],
      desc: "<code>finishBeanFactoryInitialization()</code> <strong>instantiate mọi singleton non-lazy</strong> — chạy toàn bộ vòng đời bean (bài 04). Rồi <code>afterRefresh()</code> phát <code>started</code>/<code>ready</code> và <code>callRunners()</code> chạy các runner. App sẵn sàng." }
  ],

  quiz: [
    { q: "<code>refreshContext()</code> (tức <code>ApplicationContext.refresh()</code>) làm những gì chính?", options: [
        "Chỉ đọc file application.properties",
        "Chạy BFPP (scan/config/autoconfig), đăng ký BPP, khởi động server và tạo mọi singleton non-lazy",
        "Chỉ tạo đối tượng SpringApplication và suy ra loại app",
        "Chỉ phát sự kiện started và chạy các runner"
      ], correct: 1,
      explanation: "refresh() là 'trái tim': invokeBeanFactoryPostProcessors → registerBeanPostProcessors → onRefresh (server) → finishBeanFactoryInitialization (tạo singleton)." },
    { q: "Các bean singleton non-lazy được thực sự tạo (instantiate) ở bước con nào?", options: [
        "prepareContext()",
        "invokeBeanFactoryPostProcessors()",
        "finishBeanFactoryInitialization()",
        "afterRefresh()"
      ], correct: 2,
      explanation: "prepareContext chỉ nạp ĐỊNH NGHĨA; các singleton non-lazy được khởi tạo (chạy full lifecycle) trong finishBeanFactoryInitialization()." },
    { q: "Environment (properties, profiles, args) được chuẩn bị vào lúc nào?", options: [
        "Sau khi tất cả bean đã được tạo",
        "Trước khi tạo bean, ngay trong prepareEnvironment() ở đầu run()",
        "Chỉ khi bean đầu tiên gọi @Value",
        "Trong onRefresh() cùng lúc với khởi động Tomcat"
      ], correct: 1,
      explanation: "prepareEnvironment() chạy ở đầu run(), trước cả createApplicationContext — nên @Value/profiles đã có sẵn khi bean bắt đầu được tạo." },
    { q: "Embedded server (Tomcat) của web app được tạo & khởi động ở đâu?", options: [
        "Trong prepareContext(), khi nạp bean definition",
        "Trong invokeBeanFactoryPostProcessors(), lúc component scan",
        "Trong onRefresh() — một bước con của refresh()",
        "Trong main(), trước khi gọi SpringApplication.run()"
      ], correct: 2,
      explanation: "Với web app, onRefresh() bên trong refresh() chịu trách nhiệm tạo và khởi động embedded server (Tomcat/Jetty/Undertow)." }
  ]
});
