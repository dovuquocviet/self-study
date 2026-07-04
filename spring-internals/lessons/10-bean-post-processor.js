window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Proxy & AOP",
  title: "BeanPostProcessor — nơi 'phép màu' xảy ra",
  subtitle: "Cái móc mà chính Spring dùng để xử lý @Autowired và bọc AOP",

  theory: `
    <p><strong>BeanPostProcessor (BPP)</strong> là một interface có hai method,
    được container gọi cho <strong>MỌI bean</strong>, ngay quanh bước khởi tạo
    (xem lại vòng đời bean ở bài 04):</p>
    <ul>
      <li><code>postProcessBeforeInitialization(bean, name)</code> — chạy
          <em>trước</em> <code>@PostConstruct</code> / <code>afterPropertiesSet()</code>.</li>
      <li><code>postProcessAfterInitialization(bean, name)</code> — chạy
          <em>sau</em> bước khởi tạo. Method này có thể <strong>trả về một object khác</strong>
          để thay cho bean gốc (chìa khoá của AOP).</li>
    </ul>
    <p>Điều bất ngờ: rất nhiều tính năng lõi của Spring THỰC RA <em>chính là</em> các BPP:</p>
    <ul>
      <li><code>AutowiredAnnotationBeanPostProcessor</code> — xử lý
          <code>@Autowired</code>, <code>@Value</code> (tiêm phụ thuộc).</li>
      <li><code>CommonAnnotationBeanPostProcessor</code> — xử lý
          <code>@PostConstruct</code>, <code>@PreDestroy</code>, <code>@Resource</code>.</li>
      <li><code>AnnotationAwareAspectJAutoProxyCreator</code> (một
          <code>AbstractAutoProxyCreator</code>) — trong
          <code>postProcessAfterInitialization</code>, nếu bean khớp một aspect thì
          <strong>thay bean gốc bằng một proxy</strong>. Đây là lý do
          <code>@Transactional</code> / <code>@Async</code> hoạt động.</li>
    </ul>
    <div class="callout"><p>💡 Đừng nhầm với
    <strong>BeanFactoryPostProcessor (BFPP)</strong>: BFPP chạy <em>sớm hơn</em> và
    thao tác trên <strong>BeanDefinition</strong> (metadata) trước khi bất kỳ bean nào
    được tạo — ví dụ <code>PropertySourcesPlaceholderConfigurer</code> thay
    <code>\${...}</code> trong definition. Còn BPP chạy trên <strong>instance thật</strong>
    của từng bean, trong lúc khởi tạo.</p></div>
    <p>Bạn có thể tự viết BPP để can thiệp mọi bean — nhưng mục tiêu chính là hiểu rằng
    Spring dùng đúng cơ chế này cho <code>@Autowired</code> và AOP.</p>
  `,

  codeTabs: [
    { id: "custom", label: "✍️ BPP tự viết", lines: [
      "@Component",
      "class TimingBpp implements BeanPostProcessor {",
      "",
      "    @Override",
      "    public Object postProcessBeforeInitialization(",
      "            Object bean, String name) {",
      "        // chạy TRƯỚC @PostConstruct",
      "        System.out.println(\"before init: \" + name);",
      "        return bean;   // trả bean gốc",
      "    }",
      "",
      "    @Override",
      "    public Object postProcessAfterInitialization(",
      "            Object bean, String name) {",
      "        // chạy SAU init; có thể trả object khác!",
      "        return bean;   // (AOP sẽ trả proxy ở đây)",
      "    }",
      "}"
    ]},
    { id: "builtin", label: "🏭 BPP có sẵn của Spring", lines: [
      "// Xử lý @Autowired, @Value (tiêm phụ thuộc):",
      "AutowiredAnnotationBeanPostProcessor",
      "",
      "// Xử lý @PostConstruct, @PreDestroy, @Resource:",
      "CommonAnnotationBeanPostProcessor",
      "",
      "// Trong postProcessAfterInitialization:",
      "// nếu bean khớp aspect -> trả PROXY thay bean gốc",
      "// (đây là gốc rễ của @Transactional / @Async):",
      "AnnotationAwareAspectJAutoProxyCreator"
    ]}
  ],

  stageHtml: `
    <div class="node" id="bfpp"><div class="nl">BeanFactoryPostProcessor</div><div class="ns">sửa BeanDefinition (metadata)</div></div>
    <div class="arrow" id="a0">↓ rồi container mới tạo instance</div>
    <div class="node" id="raw"><div class="nl">Bean instance thô</div><div class="ns">vừa new, chưa nối dây</div></div>
    <div class="arrow" id="a1">↓ postProcessBeforeInitialization</div>
    <div class="row">
      <div class="node" id="autowire"><div class="nl">AutowiredAnnotationBPP</div><div class="ns">tiêm @Autowired / @Value</div></div>
      <div class="node" id="init"><div class="nl">@PostConstruct</div><div class="ns">bean tự khởi tạo</div></div>
    </div>
    <div class="arrow" id="a2">↓ postProcessAfterInitialization</div>
    <div class="node" id="proxy"><div class="nl">AutoProxyCreator</div><div class="ns">khớp aspect → trả PROXY thay bean gốc</div></div>
    <div class="arrow" id="a3">↓ đưa vào container</div>
    <div class="node" id="ready"><div class="nl">Bean sẵn sàng (có thể là proxy)</div><div class="ns">@Transactional/@Async hoạt động</div></div>
  `,
  steps: [
    { title: "1 · BFPP sửa metadata trước", tab: "custom", highlight: [2], on: ["bfpp", "a0"],
      desc: "Trước khi bất kỳ bean nào ra đời, <code>BeanFactoryPostProcessor</code> chỉnh <strong>BeanDefinition</strong> (ví dụ thay <code>${...}</code>). Đó là chuyện của metadata — KHÁC với interface <code>BeanPostProcessor</code> ở đây, thứ chỉ chạy khi đã có instance thật." },
    { title: "2 · Trước init: tiêm phụ thuộc", tab: "custom", highlight: [4, 5, 6, 7, 8, 9], on: ["raw", "a1", "autowire"],
      desc: "Với instance thật, container gọi <code>postProcessBeforeInitialization</code> cho từng BPP. Chính <code>AutowiredAnnotationBeanPostProcessor</code> ở bước này tiêm <code>@Autowired</code> / <code>@Value</code> vào bean." },
    { title: "3 · Bean tự khởi tạo", tab: "builtin", highlight: [4, 5], on: ["autowire", "init"],
      desc: "Sau các BPP-before, tới lượt <code>@PostConstruct</code> (do <code>CommonAnnotationBeanPostProcessor</code> kích hoạt) và <code>afterPropertiesSet()</code>. Lúc này phụ thuộc đã có đủ." },
    { title: "4 · Sau init: thay bằng proxy", tab: "custom", highlight: [12, 13, 14, 15, 16], on: ["init", "a2", "proxy"],
      desc: "Container gọi <code>postProcessAfterInitialization</code>. Nếu bean khớp một aspect, <code>AnnotationAwareAspectJAutoProxyCreator</code> <strong>trả về một proxy</strong> thay cho bean gốc — vì method này được phép đổi object." },
    { title: "5 · Bean vào container", tab: "custom", highlight: [16], on: ["proxy", "a3", "ready"],
      desc: "Object cuối cùng (bean gốc HOẶC proxy) được đặt vào container. Khi bạn <code>getBean</code>, bạn có thể đang cầm một proxy — đó là cách <code>@Transactional</code> / <code>@Async</code> chạy được." }
  ],

  quiz: [
    { q: "BeanPostProcessor làm việc trên cái gì?", options: [
        "Trên BeanDefinition (metadata) trước khi tạo bean",
        "Trên instance thật của từng bean, trong lúc khởi tạo",
        "Trên file .class trước khi JVM nạp",
        "Trên annotation ở mức trình biên dịch"
      ], correct: 1,
      explanation: "BPP chạy trên INSTANCE thật của mỗi bean quanh bước init. Thao tác trên BeanDefinition (metadata) là việc của BeanFactoryPostProcessor." },
    { q: "Cái gì thực sự xử lý @Autowired khi bean được tạo?", options: [
        "JVM tự nhận diện và tiêm",
        "AnnotationAwareAspectJAutoProxyCreator",
        "AutowiredAnnotationBeanPostProcessor — một BeanPostProcessor",
        "BeanFactoryPostProcessor"
      ], correct: 2,
      explanation: "@Autowired / @Value được xử lý bởi AutowiredAnnotationBeanPostProcessor — bản thân nó là một BPP chạy ở bước before-initialization." },
    { q: "AOP proxy được tạo ở method nào của BeanPostProcessor?", options: [
        "postProcessBeforeInitialization — trước khi bean khởi tạo",
        "postProcessAfterInitialization — vì method này được phép trả object khác",
        "Trong constructor của bean",
        "Trong @PostConstruct của chính bean"
      ], correct: 1,
      explanation: "postProcessAfterInitialization có thể trả về một object khác (proxy) thay cho bean gốc. AbstractAutoProxyCreator lợi dụng đúng điểm này để bọc AOP." },
    { q: "Khác biệt cốt lõi giữa BeanFactoryPostProcessor và BeanPostProcessor?", options: [
        "Không khác gì, chỉ là tên gọi khác nhau",
        "BFPP chạy trên BeanDefinition trước khi tạo bean; BPP chạy trên instance thật quanh bước init",
        "BPP chạy sớm hơn BFPP",
        "BFPP chỉ dùng cho web, BPP cho console"
      ], correct: 1,
      explanation: "BFPP thao tác metadata (BeanDefinition) SỚM, trước khi có bean nào; BPP thao tác trên INSTANCE thật của từng bean trong lúc khởi tạo — muộn hơn." }
  ]
});
