window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Container & Bean",
  title: "Dependency Injection chuyên sâu",
  subtitle: "Autowiring, @Qualifier, và circular dependency",

  theory: `
    <p>Bài 01 đã nói container <em>tiêm</em> phụ thuộc. Bài này mổ xẻ ba câu hỏi thực chiến:
    <strong>tiêm bằng cách nào</strong>, <strong>container chọn bean nào khi có nhiều lựa chọn</strong>,
    và <strong>chuyện gì xảy ra khi hai bean cần lẫn nhau</strong> (circular dependency).</p>

    <p><strong>Ba kiểu inject:</strong></p>
    <ul>
      <li><strong>Constructor injection</strong> (khuyên dùng): phụ thuộc là tham số constructor.
          Cho phép để field <code>final</code>, đảm bảo object luôn đủ phụ thuộc ngay khi tạo,
          và <em>dễ test</em> vì bạn tự <code>new</code> rồi truyền mock vào — không cần Spring.</li>
      <li><strong>Setter injection</strong>: container gọi setter sau khi tạo. Dùng cho phụ thuộc tuỳ chọn.</li>
      <li><strong>Field injection</strong> (<code>@Autowired</code> đặt thẳng trên field): tiện nhưng
          <em>khó test</em> (không new được tay, phải dùng reflection) và field không thể <code>final</code>.</li>
    </ul>

    <p><strong>Container resolve <code>@Autowired</code> thế nào?</strong> Trước hết tìm theo
    <strong>KIỂU (type)</strong>. Nếu có nhiều bean cùng type → ném
    <code>NoUniqueBeanDefinitionException</code>. Gỡ bằng:</p>
    <ul>
      <li><code>@Primary</code> — đánh dấu một bean là <em>mặc định</em> khi container phân vân.</li>
      <li><code>@Qualifier("tênBean")</code> — chỉ <em>đích danh</em> bean cần lấy (đè cả <code>@Primary</code>).</li>
    </ul>
    <p>Nếu match theo type vẫn không ra một bean duy nhất, Spring thử tiếp theo <strong>tên</strong> (tên field/tham số so với tên bean).</p>

    <p><strong>Circular dependency &amp; three-level cache.</strong> Khi A cần B và B cần A,
    với <strong>field/setter injection</strong> Spring gỡ được nhờ 3 cache trong
    <code>DefaultSingletonBeanRegistry</code>:</p>
    <ul>
      <li><code>singletonObjects</code> — bean <strong>hoàn chỉnh</strong> (đã init xong).</li>
      <li><code>earlySingletonObjects</code> — bean <strong>"nửa vời"</strong>: đã <code>new</code> nhưng chưa init xong.</li>
      <li><code>singletonFactories</code> — <strong>factory</strong> tạo <em>early reference</em>, phục vụ AOP proxy sớm.</li>
    </ul>
    <p>Luồng: tạo A → <code>new</code> xong đặt factory vào <code>singletonFactories</code> → A cần B →
    tạo B → B cần A → lấy được <em>early reference</em> của A từ cache → B hoàn tất → quay lại A hoàn tất.</p>
    <div class="callout"><p>⚠️ Với <strong>constructor injection hai chiều</strong> thì KHÔNG gỡ được:
    A chưa <code>new</code> xong đã cần B, B chưa <code>new</code> xong đã cần A → chưa có gì để đặt vào cache
    → <code>BeanCurrentlyInCreationException</code>.</p></div>
  `,

  codeTabs: [
    { id: "autowire", label: "🔀 Autowire nhiều bean", lines: [
      "interface PaymentGateway { }",
      "",
      "@Service @Primary   // mặc định khi mơ hồ",
      "class StripeGateway implements PaymentGateway {}",
      "",
      "@Service",
      "class PaypalGateway implements PaymentGateway {}",
      "",
      "@Service",
      "class OrderService {",
      "    private final PaymentGateway gateway;",
      "",
      "    // @Qualifier chỉ đích danh, đè @Primary",
      "    OrderService(@Qualifier(\"paypalGateway\")",
      "                 PaymentGateway gateway) {",
      "        this.gateway = gateway;",
      "    }",
      "}"
    ]},
    { id: "circular", label: "🔁 Circular dependency", lines: [
      "@Component",
      "class A {",
      "    @Autowired B b;   // cần B",
      "}",
      "",
      "@Component",
      "class B {",
      "    @Autowired A a;   // cần A",
      "}",
      "",
      "// A cần B, B cần A → vòng tròn phụ thuộc",
      "// Field injection: Spring GỠ được (3 cache)",
      "// Constructor injection hai chiều:",
      "// → BeanCurrentlyInCreationException"
    ]}
  ],

  stageHtml: `
    <div class="node" id="au"><div class="nl">@Autowired</div><div class="ns">cần một PaymentGateway</div></div>
    <div class="arrow" id="a1">↓ tìm theo KIỂU (type)</div>
    <div class="node" id="multi"><div class="nl">Nhiều bean cùng type?</div><div class="ns">NoUniqueBeanDefinitionException</div></div>
    <div class="arrow" id="a2">↓ gỡ mơ hồ</div>
    <div class="node" id="pick"><div class="nl">@Primary / @Qualifier</div><div class="ns">mặc định / chỉ đích danh</div></div>
    <div class="arrow" id="a3">↓ circular dependency A ↔ B</div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">singletonObjects</div><div class="ns">bean hoàn chỉnh</div></div>
      <div class="node" id="c2"><div class="nl">earlySingletonObjects</div><div class="ns">bean nửa vời</div></div>
      <div class="node" id="c3"><div class="nl">singletonFactories</div><div class="ns">factory early ref (AOP)</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Resolve theo KIỂU (type)", tab: "autowire", highlight: [11, 14, 15], on: ["au", "a1"],
      desc: "Gặp <code>@Autowired</code> (ở đây là tham số constructor kiểu <code>PaymentGateway</code>), container <strong>tìm bean theo kiểu</strong> trước tiên, chứ không theo tên." },
    { title: "2 · Hai bean cùng type → lỗi", tab: "autowire", highlight: [1, 3, 4, 6, 7], on: ["a1", "multi"],
      desc: "Có <em>hai</em> bean cùng implement <code>PaymentGateway</code> (Stripe &amp; Paypal). Container không biết chọn ai → ném <code>NoUniqueBeanDefinitionException</code>." },
    { title: "3 · @Primary & @Qualifier gỡ mơ hồ", tab: "autowire", highlight: [3, 13, 14], on: ["multi", "a2", "pick"],
      desc: "<code>@Primary</code> đặt <strong>StripeGateway</strong> làm mặc định. Nhưng <code>@Qualifier(\"paypalGateway\")</code> chỉ <strong>đích danh</strong> Paypal và <em>đè</em> cả @Primary — nên bean được tiêm là Paypal." },
    { title: "4 · Vòng lặp A ↔ B & ba cache", tab: "circular", highlight: [1, 2, 3, 6, 7, 8], on: ["a3", "c1", "c2", "c3"],
      desc: "A cần B, B cần A. Vì dùng <strong>field injection</strong>, Spring gỡ được nhờ 3 cache trong <code>DefaultSingletonBeanRegistry</code>: <code>singletonObjects</code>, <code>earlySingletonObjects</code>, <code>singletonFactories</code>." },
    { title: "5 · Tạo A → singletonFactories", tab: "circular", highlight: [1, 2, 3], on: ["c3"],
      desc: "Container <code>new A</code> (chưa init xong), rồi đặt một <strong>factory</strong> tạo <em>early reference</em> của A vào <code>singletonFactories</code>. Sau đó A cần B nên container quay sang tạo B." },
    { title: "6 · B cần A → lấy early reference", tab: "circular", highlight: [6, 7, 8], on: ["c3", "c2"],
      desc: "Đang tạo B thì B cần A. A chưa hoàn chỉnh, nhưng <code>singletonFactories</code> có factory → tạo <em>early reference</em> A, chuyển sang <code>earlySingletonObjects</code> và tiêm vào B. <strong>B hoàn tất.</strong>" },
    { title: "7 · A hoàn tất — trừ constructor 2 chiều", tab: "circular", highlight: [11, 12, 13, 14], on: ["c1"],
      desc: "Quay lại A: nay đã có B nên A init xong, chuyển vào <code>singletonObjects</code> → vòng lặp gỡ xong. Nhưng nếu A &amp; B dùng <strong>constructor injection hai chiều</strong> thì chưa <code>new</code> xong đã cần nhau → <code>BeanCurrentlyInCreationException</code>." }
  ],

  quiz: [
    { q: "Có hai bean cùng type mà không đánh dấu gì thì @Autowired gặp lỗi nào, và gỡ ra sao?", options: [
        "BeanCurrentlyInCreationException — gỡ bằng @Lazy",
        "NoUniqueBeanDefinitionException — gỡ bằng @Primary (mặc định) hoặc @Qualifier (đích danh)",
        "NoSuchBeanDefinitionException — gỡ bằng @ComponentScan",
        "ClassCastException — gỡ bằng ép kiểu thủ công"
      ], correct: 1,
      explanation: "Match theo type ra nhiều bean → NoUniqueBeanDefinitionException. @Primary chọn bean mặc định; @Qualifier(\"tên\") chỉ đích danh và đè cả @Primary." },
    { q: "Vì sao constructor injection hai chiều gây lỗi còn field injection thì không?", options: [
        "Vì constructor chạy chậm hơn nên timeout",
        "Vì field injection không thật sự tạo vòng lặp",
        "Constructor cần đủ phụ thuộc NGAY lúc new → chưa new xong đã cần nhau, không có gì đặt vào cache; field injection new trước rồi mới tiêm nên có early reference để gỡ",
        "Vì Spring cấm dùng @Autowired trên constructor"
      ], correct: 2,
      explanation: "Constructor injection đòi hỏi phụ thuộc ngay khi khởi tạo, nên A và B kẹt lẫn nhau trước khi kịp đưa early reference vào cache. Field/setter tách 'new' khỏi 'tiêm' nên gỡ được." },
    { q: "Ba cache singletonObjects / earlySingletonObjects / singletonFactories dùng để làm gì?", options: [
        "Ba bản sao dự phòng của cùng một bean phòng khi crash",
        "Lần lượt giữ bean hoàn chỉnh, bean 'nửa vời' (đã new chưa init), và factory tạo early reference — để gỡ circular dependency",
        "Cache theo ba tầng bảo mật của Spring Security",
        "Ba vùng nhớ cho ba scope: singleton, prototype, request"
      ], correct: 1,
      explanation: "singletonObjects = bean đã init xong; earlySingletonObjects = bean mới new chưa init; singletonFactories = factory tạo early reference (còn phục vụ AOP proxy sớm). Ba tầng này cho phép trả early reference để phá vòng lặp." },
    { q: "Vì sao constructor injection được khuyên dùng hơn field injection?", options: [
        "Vì nó khiến ứng dụng khởi động nhanh hơn",
        "Vì nó cho phép field final, đảm bảo object luôn đủ phụ thuộc, và dễ test (new + truyền mock, không cần Spring)",
        "Vì chỉ constructor mới được @Autowired",
        "Vì field injection không được Spring hỗ trợ nữa"
      ], correct: 1,
      explanation: "Constructor injection cho phép để field final (bất biến), object không bao giờ ở trạng thái thiếu phụ thuộc, và test chỉ cần new class rồi truyền mock — không phụ thuộc container hay reflection như field injection." }
  ]
});
