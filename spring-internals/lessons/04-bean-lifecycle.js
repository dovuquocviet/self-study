window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Container & Bean",
  title: "Vòng đời của một Bean",
  subtitle: "Từ new tới sẵn sàng, và tới lúc bị huỷ",

  theory: `
    <p>Khi container tạo một <strong>singleton bean</strong>, nó không chỉ gọi
    <code>new</code> rồi trả về. Có cả một <strong>chuỗi chặng (lifecycle)</strong>
    diễn ra theo thứ tự cố định, và hiểu thứ tự này giúp bạn biết
    <em>lúc nào phụ thuộc đã sẵn sàng để dùng</em>.</p>
    <ol>
      <li><strong>Instantiate</strong> — container gọi constructor, tạo ra một
          object "rỗng" (phụ thuộc chưa được tiêm).</li>
      <li><strong>Populate properties</strong> — tiêm các phụ thuộc
          (<code>@Autowired</code> field/setter) vào.</li>
      <li><strong>Aware callbacks</strong> — nếu bean implements
          <code>BeanNameAware</code> / <code>BeanFactoryAware</code> /
          <code>ApplicationContextAware</code> thì được gọi.</li>
      <li><strong>postProcessBeforeInitialization</strong> — mọi
          <code>BeanPostProcessor</code> (BPP) được chạy trước khi init.</li>
      <li><strong>Initialization</strong> — theo thứ tự:
          <code>@PostConstruct</code> → <code>InitializingBean.afterPropertiesSet()</code>
          → <code>init-method</code> tuỳ chỉnh.</li>
      <li><strong>postProcessAfterInitialization</strong> — đây là nơi
          <strong>AOP proxy</strong> thường được bọc quanh bean
          (bài 10/11 sẽ mổ xẻ sâu).</li>
      <li><strong>Sẵn sàng</strong> — bean nằm trong singleton cache, phục vụ
          <code>getBean</code>.</li>
      <li><strong>Khi container đóng</strong> — <code>@PreDestroy</code> →
          <code>DisposableBean.destroy()</code> → <code>destroy-method</code>.</li>
    </ol>
    <div class="callout"><p>💡 Điểm mấu chốt: <code>@PostConstruct</code> chạy
    <strong>SAU</strong> khi phụ thuộc đã được inject. Nên trong
    <em>constructor</em> phụ thuộc <code>@Autowired</code> có thể còn
    <code>null</code>, còn trong <code>@PostConstruct</code> thì đã sẵn sàng —
    hãy làm việc cần phụ thuộc ở đó, đừng làm trong constructor.</p></div>
  `,

  codeTabs: [
    { id: "bean", label: "🌱 Một bean đủ vòng đời", lines: [
      "@Service",
      "class OrderService",
      "        implements InitializingBean {",
      "",
      "    @Autowired",
      "    private PaymentGateway gateway;",
      "",
      "    OrderService() {",
      "        // gateway CHƯA được inject ở đây",
      "    }",
      "",
      "    @PostConstruct",
      "    void init() {",
      "        // gateway ĐÃ sẵn sàng ở đây",
      "        gateway.warmUp();",
      "    }",
      "",
      "    @Override",
      "    public void afterPropertiesSet() {",
      "        // chạy sau @PostConstruct",
      "    }",
      "",
      "    @PreDestroy",
      "    void cleanup() {",
      "        gateway.close();",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="inst"><div class="nl">1 · Instantiate</div><div class="ns">gọi constructor → object rỗng</div></div>
    <div class="arrow" id="a1">↓ object đã tạo</div>
    <div class="node" id="pop"><div class="nl">2 · Populate properties</div><div class="ns">inject @Autowired vào</div></div>
    <div class="arrow" id="a2">↓ đã nối dây</div>
    <div class="node" id="aware"><div class="nl">3 · Aware callbacks</div><div class="ns">BeanName / BeanFactory / AppContext Aware</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="before"><div class="nl">4 · BPP.beforeInitialization</div><div class="ns">mọi BeanPostProcessor</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="init"><div class="nl">5 · Initialization</div><div class="ns">@PostConstruct → afterPropertiesSet → init-method</div></div>
    <div class="arrow" id="a5">↓</div>
    <div class="node" id="after"><div class="nl">6 · BPP.afterInitialization</div><div class="ns">AOP proxy được bọc ở đây</div></div>
    <div class="arrow" id="a6">↓ vào singleton cache</div>
    <div class="node" id="ready"><div class="nl">7 · Bean sẵn sàng</div><div class="ns">phục vụ getBean()</div></div>
    <div class="arrow" id="a7">↓ khi container đóng</div>
    <div class="node" id="destroy"><div class="nl">8 · Destroy</div><div class="ns">@PreDestroy → destroy() → destroy-method</div></div>
  `,
  steps: [
    { title: "1 · Instantiate — gọi constructor", tab: "bean", highlight: [8, 9, 10], on: ["inst"],
      desc: "Container gọi <code>new OrderService()</code> tạo một object <em>rỗng</em>. Lúc này <code>gateway</code> vẫn <code>null</code> — phụ thuộc CHƯA được tiêm, nên đừng dùng nó trong constructor." },
    { title: "2 · Populate — inject phụ thuộc", tab: "bean", highlight: [5, 6], on: ["inst", "a1", "pop"],
      desc: "Container tìm bean <code>PaymentGateway</code> đã có và tiêm vào field <code>@Autowired</code>. Sau chặng này <code>gateway</code> đã trỏ tới bean thật." },
    { title: "3 · Aware + beforeInitialization", tab: "bean", highlight: [2, 3], on: ["pop", "a2", "aware", "a3", "before"],
      desc: "Nếu bean implements các interface <code>*Aware</code>, chúng được gọi để bean 'biết' tên/context của mình. Rồi mọi <code>BeanPostProcessor.postProcessBeforeInitialization(...)</code> chạy — trước khi bean được init." },
    { title: "4 · Initialization callbacks", tab: "bean", highlight: [12, 13, 14, 15, 18, 19], on: ["before", "a4", "init"],
      desc: "Theo đúng thứ tự: <code>@PostConstruct</code> (<code>init()</code>) chạy TRƯỚC, rồi tới <code>afterPropertiesSet()</code> của <code>InitializingBean</code>, cuối cùng là <code>init-method</code>. Vì phụ thuộc đã inject xong, <code>gateway.warmUp()</code> an toàn ở đây." },
    { title: "5 · afterInitialization — bọc AOP proxy", tab: "bean", highlight: [1, 2], on: ["init", "a5", "after"],
      desc: "Mọi <code>BeanPostProcessor.postProcessAfterInitialization(...)</code> chạy. ĐÂY là nơi Spring thường <strong>bọc bean bằng một AOP proxy</strong> (ví dụ cho <code>@Transactional</code>) — object cuối cùng vào cache có thể là proxy chứ không phải instance gốc." },
    { title: "6 · Bean sẵn sàng phục vụ", tab: "bean", highlight: [5, 6], on: ["after", "a6", "ready"],
      desc: "Bean (đã init, có thể đã proxy) được đưa vào <strong>singleton cache</strong>. Từ giờ mọi <code>getBean</code> hay <code>@Autowired</code> nơi khác đều nhận lại đúng object này." },
    { title: "7 · Destroy — khi container đóng", tab: "bean", highlight: [23, 24, 25], on: ["ready", "a7", "destroy"],
      desc: "Khi <code>ApplicationContext</code> đóng: <code>@PreDestroy</code> (<code>cleanup()</code>) chạy trước, rồi <code>DisposableBean.destroy()</code>, cuối cùng là <code>destroy-method</code> — để bean giải phóng tài nguyên (đóng kết nối, pool…)." }
  ],

  quiz: [
    { q: "Trong vòng đời bean, <code>@PostConstruct</code> chạy vào lúc nào?", options: [
        "Trong lúc constructor đang chạy",
        "Trước khi phụ thuộc @Autowired được inject",
        "Sau khi constructor xong VÀ phụ thuộc đã được inject",
        "Chỉ khi container đóng"
      ], correct: 2,
      explanation: "Thứ tự là: constructor → inject phụ thuộc → @PostConstruct. Nên trong @PostConstruct các field @Autowired đã sẵn sàng, còn trong constructor thì chưa." },
    { q: "AOP proxy (ví dụ cho @Transactional) thường được bọc quanh bean ở chặng nào?", options: [
        "Trong postProcessBeforeInitialization",
        "Trong postProcessAfterInitialization",
        "Ngay trong constructor",
        "Khi bean bị destroy"
      ], correct: 1,
      explanation: "BeanPostProcessor.postProcessAfterInitialization(...) chạy sau khi bean đã init, và đây là chỗ Spring thường trả về một proxy bọc quanh bean gốc." },
    { q: "Khi container đóng, thứ tự các callback huỷ bean là gì?", options: [
        "destroy-method → DisposableBean.destroy() → @PreDestroy",
        "@PreDestroy → DisposableBean.destroy() → destroy-method",
        "afterPropertiesSet() → @PreDestroy",
        "Chỉ @PostConstruct chạy ngược lại"
      ], correct: 1,
      explanation: "Chặng destroy chạy: @PreDestroy trước, rồi DisposableBean.destroy(), cuối cùng là destroy-method tuỳ chỉnh." },
    { q: "Vì sao KHÔNG nên dùng một phụ thuộc @Autowired ngay trong thân constructor cho việc cần nó đã sẵn sàng?", options: [
        "Vì constructor không được phép chứa logic",
        "Vì field @Autowired chỉ được inject SAU khi constructor chạy xong, nên trong constructor nó còn null",
        "Vì Spring cấm gọi method trong constructor",
        "Vì constructor chạy trên thread khác"
      ], correct: 1,
      explanation: "Field injection xảy ra ở chặng Populate — SAU khi constructor đã chạy. Trong constructor field còn null; việc cần phụ thuộc đã init nên đặt trong @PostConstruct (hoặc dùng constructor injection để nhận nó qua tham số)." }
  ]
});
