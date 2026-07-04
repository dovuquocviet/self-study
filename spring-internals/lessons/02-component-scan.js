window.LESSONS.push({
  id: "02",
  phase: "1", phaseName: "Container & Bean",
  title: "Component Scanning",
  subtitle: "@Service/@Repository/@Controller được phát hiện thế nào",

  theory: `
    <p>Ở bài trước ta biết <code>ApplicationContext</code> đứng ra tạo bean.
    Nhưng làm sao nó <em>biết</em> class nào nên trở thành bean? Câu trả lời là
    <strong>component scanning</strong> — quá trình quét classpath để tìm ra các
    class "ứng viên".</p>
    <p>Bạn khai báo phạm vi quét bằng <code>@ComponentScan(basePackages = ...)</code>
    (trong Spring Boot, <code>@SpringBootApplication</code> đã bao gồm nó, mặc định
    quét package chứa class khởi động và các package con). Spring dùng
    <code>ClassPathScanningCandidateComponentProvider</code> để đọc các file
    <code>.class</code> trong package đó và lọc ra class mang annotation stereotype.</p>
    <ul>
      <li><strong>Điểm mấu chốt:</strong> <code>@Service</code>, <code>@Repository</code>,
          <code>@Controller</code> đều được <strong>meta-annotated bằng
          <code>@Component</code></strong>. Nên scanner chỉ cần tìm <code>@Component</code>
          là nhận diện được cả ba.</li>
      <li>Mỗi class ứng viên → sinh một <code>BeanDefinition</code> (bản "định nghĩa"
          bean: class nào, scope gì, tên gì…) → đăng ký vào
          <code>BeanDefinitionRegistry</code>.</li>
      <li>Tên bean mặc định = tên class viết thường chữ cái đầu
          (<code>OrderService</code> → <code>"orderService"</code>).</li>
    </ul>
    <div class="callout"><p>💡 Cực kỳ quan trọng: sau bước scan, bean vẫn <strong>CHƯA
    được khởi tạo</strong>. Ta mới chỉ có <em>định nghĩa</em> (BeanDefinition) nằm trong
    registry. Việc <code>new</code> ra object thật diễn ra ở bước sau (instantiation).</p></div>
  `,

  codeTabs: [
    { id: "app", label: "🌱 Code của bạn", lines: [
      "@Configuration",
      "@ComponentScan(basePackages = \"com.shop\")",
      "class AppConfig { }",
      "",
      "// Tương đương, gọn hơn:",
      "// @SpringBootApplication đã bao gồm",
      "// @ComponentScan(package hiện tại)",
      "",
      "@Service                 // stereotype",
      "class OrderService {",
      "    // -> bean tên \"orderService\"",
      "}",
      "",
      "@Repository",
      "class OrderRepository { }"
    ]},
    { id: "meta", label: "🔬 Bên trong @Service", lines: [
      "// @Service KHÔNG tự nhận diện —",
      "// nó được meta-annotated @Component:",
      "@Target(ElementType.TYPE)",
      "@Retention(RetentionPolicy.RUNTIME)",
      "@Component        // ← meta-annotation",
      "public @interface Service {",
      "    @AliasFor(annotation = Component.class)",
      "    String value() default \"\";",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cs"><div class="nl">@ComponentScan</div><div class="ns">khai báo basePackages cần quét</div></div>
    <div class="arrow" id="a1">↓ giao phạm vi</div>
    <div class="node" id="scanner"><div class="nl">ClassPathScanningCandidateComponentProvider</div><div class="ns">đọc các file .class trong package</div></div>
    <div class="arrow" id="a2">↓ lọc</div>
    <div class="node" id="filter"><div class="nl">Lọc theo @Component</div><div class="ns">kể cả meta: @Service/@Repository/@Controller</div></div>
    <div class="arrow" id="a3">↓ mỗi class ứng viên</div>
    <div class="node" id="bd"><div class="nl">BeanDefinition</div><div class="ns">chỉ là "định nghĩa" — bean CHƯA được tạo</div></div>
    <div class="arrow" id="a4">↓ đăng ký (theo tên bean)</div>
    <div class="node" id="registry"><div class="nl">BeanDefinitionRegistry</div><div class="ns">"orderService", "orderRepository"…</div></div>
  `,
  steps: [
    { title: "1 · Khai báo phạm vi quét", tab: "app", highlight: [1, 2], on: ["cs"],
      desc: "<code>@ComponentScan(basePackages = \"com.shop\")</code> nói cho Spring biết <strong>quét ở đâu</strong>. Trong Spring Boot, <code>@SpringBootApplication</code> đã gói sẵn <code>@ComponentScan</code> lấy mặc định là package của class khởi động." },
    { title: "2 · Scanner đọc file .class", tab: "app", highlight: [9, 14], on: ["cs", "a1", "scanner"],
      desc: "<code>ClassPathScanningCandidateComponentProvider</code> duyệt các file <code>.class</code> trong package đã khai báo — nó đọc bytecode/metadata, <em>chưa</em> load class như bình thường." },
    { title: "3 · Lọc theo @Component (kể cả meta)", tab: "meta", highlight: [1, 2, 5], on: ["scanner", "a2", "filter"],
      desc: "Scanner giữ lại class nào mang <code>@Component</code>. Vì <code>@Service</code> bản thân được <strong>meta-annotated bằng <code>@Component</code></strong>, một class <code>@Service</code> vẫn bị nhận diện dù scanner chỉ tìm <code>@Component</code>. <code>@Repository</code>, <code>@Controller</code> cũng vậy." },
    { title: "4 · Mỗi ứng viên → một BeanDefinition", tab: "app", highlight: [9, 10], on: ["filter", "a3", "bd"],
      desc: "Với mỗi class lọt qua bộ lọc, Spring tạo một <code>BeanDefinition</code> — mô tả metadata: class nào, scope, lazy hay không, tên bean… Đây <strong>chỉ là bản mô tả</strong>, không phải object thật." },
    { title: "5 · Đăng ký vào registry theo tên bean", tab: "app", highlight: [10, 11], on: ["bd", "a4", "registry"],
      desc: "<code>BeanDefinition</code> được đăng ký vào <code>BeanDefinitionRegistry</code> dưới một <strong>tên bean</strong>. Mặc định tên = tên class viết thường chữ đầu: <code>OrderService</code> → <code>\"orderService\"</code>." },
    { title: "6 · Lưu ý: bean CHƯA được tạo", tab: "app", highlight: [10, 11, 12], on: ["bd", "registry"],
      desc: "Kết thúc quá trình scan, registry chứa <em>danh sách định nghĩa</em>, chưa có object nào được <code>new</code>. Việc khởi tạo & inject phụ thuộc diễn ra ở bước sau — đó là nội dung các bài kế tiếp." }
  ],

  quiz: [
    { q: "Vì sao một class đánh <code>@Service</code> vẫn bị quét, dù scanner tìm <code>@Component</code>?", options: [
        "Vì @Service là một từ khoá đặc biệt của Java",
        "Vì @Service được meta-annotated bằng @Component, nên tính là một @Component",
        "Vì scanner quét tất cả class rồi mới lọc theo tên",
        "Vì @Service phải luôn đi kèm @Component trên cùng class"
      ], correct: 1,
      explanation: "@Service, @Repository, @Controller đều mang @Component ở trên định nghĩa của chúng (meta-annotation). Scanner nhận diện tất cả qua @Component." },
    { q: "<code>@ComponentScan</code> xác định điều gì?", options: [
        "Thứ tự khởi tạo các bean",
        "Danh sách các package (basePackages) mà Spring sẽ quét để tìm component",
        "Bean nào là singleton, bean nào là prototype",
        "Cách inject phụ thuộc vào constructor"
      ], correct: 1,
      explanation: "@ComponentScan khai báo phạm vi quét — (các) base package. Spring chỉ tìm component trong phạm vi đó (và package con)." },
    { q: "Sau khi quá trình component scan kết thúc, các bean đã được khởi tạo chưa?", options: [
        "Rồi, mỗi class được new ngay khi scanner tìm thấy",
        "Chưa — mới chỉ có BeanDefinition trong registry, chưa có object thật",
        "Chỉ bean @Service được tạo, còn @Repository thì chưa",
        "Tuỳ máy, có máy tạo có máy không"
      ], correct: 1,
      explanation: "Scan chỉ tạo & đăng ký BeanDefinition (bản 'định nghĩa'). Việc instantiate và inject diễn ra ở bước sau." },
    { q: "Tên bean mặc định của class <code>OrderService</code> là gì?", options: [
        "OrderService",
        "order_service",
        "orderService",
        "ORDER_SERVICE"
      ], correct: 2,
      explanation: "Mặc định Spring lấy tên class rồi viết thường chữ cái đầu (decapitalize): OrderService → \"orderService\"." }
  ]
});
