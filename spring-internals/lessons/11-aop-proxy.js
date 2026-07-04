window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Proxy & AOP",
  title: "AOP & Proxy: @Transactional, @Async",
  subtitle: "Proxy chặn lời gọi method để chèn hành vi — và cái bẫy self-invocation",

  theory: `
    <p><strong>AOP (Aspect-Oriented Programming — lập trình hướng khía cạnh)</strong>
    là cách <strong>tách các mối quan tâm xuyên suốt</strong> (cross-cutting concerns)
    như transaction, log, security, cache ra khỏi <em>business code</em>. Thay vì
    lặp lại "mở transaction / commit" trong từng method, bạn chỉ dán một annotation.</p>
    <p>Spring hiện thực điều này bằng <strong>proxy</strong>: cái bean bạn
    <code>@Autowired</code> vào <em>thực ra không phải object gốc</em> mà là một
    <strong>proxy bọc quanh nó</strong>, được tạo bởi một
    <code>AutoProxyCreator</code> (một BeanPostProcessor — xem bài 10).</p>
    <ul>
      <li><strong>JDK dynamic proxy</strong>: dùng khi bean có cài đặt interface —
          proxy implement <em>cùng interface</em> đó.</li>
      <li><strong>CGLIB</strong>: dùng khi bean <em>không</em> có interface —
          proxy là một <em>subclass sinh động</em> của class gốc.
          Spring Boot mặc định thiên về CGLIB.</li>
    </ul>
    <p>Khi bạn gọi một method <code>@Transactional</code>: lời gọi đi vào
    <strong>proxy</strong> → proxy (qua một interceptor, vd
    <code>TransactionInterceptor</code>) <strong>MỞ transaction</strong> →
    gọi method thật của <em>target</em> → <strong>COMMIT</strong> (hoặc
    <em>rollback</em> nếu có exception) → trả kết quả. <code>@Async</code>
    tương tự nhưng đẩy việc chạy sang <em>thread khác</em>.</p>
    <div class="callout"><p>⚠️ <strong>Cái bẫy self-invocation:</strong> nếu trong bean bạn gọi
    <code>this.otherMethod()</code> (method này cũng có <code>@Transactional</code>/<code>@Async</code>),
    lời gọi đó <strong>KHÔNG đi qua proxy</strong> — vì <code>this</code> là <em>target gốc</em>,
    không phải proxy → annotation <strong>BỊ BỎ QUA</strong>. Cách tránh: gọi qua bean được inject
    (self-inject / lấy từ <code>ApplicationContext</code>), hoặc tách method sang một bean khác.</p></div>
  `,

  codeTabs: [
    { id: "usage", label: "✅ Cách dùng đúng", lines: [
      "@Service",
      "class OrderService {",
      "    private final OrderRepository repo;",
      "",
      "    OrderService(OrderRepository repo) {",
      "        this.repo = repo;",
      "    }",
      "",
      "    @Transactional            // proxy chặn ở đây",
      "    public void placeOrder(Order o) {",
      "        repo.save(o);         // chạy trong transaction",
      "        repo.updateStock(o);  // cùng 1 transaction",
      "    }                         // xong -> proxy COMMIT",
      "}"
    ]},
    { id: "pitfall", label: "⚠️ Bẫy self-invocation", lines: [
      "@Service",
      "class ReportService {",
      "",
      "    public void run() {",
      "        this.heavy();     // gọi qua 'this' -> KHÔNG qua proxy",
      "    }",
      "",
      "    @Transactional        // BỊ BỎ QUA khi gọi từ run()",
      "    public void heavy() {",
      "        // ... không có transaction nào mở cả!",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="caller"><div class="nl">Caller</div><div class="ns">gọi orderService.placeOrder()</div></div>
    <div class="arrow" id="a1">↓ lời gọi đi vào</div>
    <div class="node" id="proxy"><div class="nl">Proxy (JDK / CGLIB)</div><div class="ns">bean bạn inject THỰC RA là cái này</div></div>
    <div class="arrow" id="a2">↓ chặn lời gọi</div>
    <div class="node" id="open"><div class="nl">TransactionInterceptor</div><div class="ns">MỞ transaction trước khi vào target</div></div>
    <div class="arrow" id="a3">↓ gọi method thật</div>
    <div class="node" id="target"><div class="nl">Target (OrderService gốc)</div><div class="ns">chạy business code: repo.save()...</div></div>
    <div class="arrow" id="a4">↓ quay ra proxy</div>
    <div class="row">
      <div class="node" id="commit"><div class="nl">COMMIT / rollback</div><div class="ns">interceptor kết thúc tx → trả kết quả</div></div>
      <div class="node" id="self"><div class="nl">Bẫy: this.method()</div><div class="ns">đi THẲNG vào target → KHÔNG mở tx</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Bean inject là proxy, không phải gốc", tab: "usage", highlight: [1, 2, 9], on: ["caller", "a1", "proxy"],
      desc: "Vì <code>OrderService</code> có method <code>@Transactional</code>, <code>AutoProxyCreator</code> đã bọc nó bằng một <strong>proxy</strong>. Cái bean caller nhận được (qua <code>@Autowired</code>) chính là proxy này, chứ KHÔNG phải object gốc." },
    { title: "2 · Proxy chặn lời gọi có annotation", tab: "usage", highlight: [9, 10], on: ["proxy", "a2", "open"],
      desc: "Lời gọi <code>placeOrder()</code> đi vào proxy trước. Proxy thấy method mang <code>@Transactional</code> nên chuyển cho <code>TransactionInterceptor</code> — nơi <strong>MỞ một transaction</strong> trước khi cho phép vào target." },
    { title: "3 · Gọi method thật của target", tab: "usage", highlight: [11, 12], on: ["open", "a3", "target"],
      desc: "Sau khi transaction đã mở, interceptor gọi method <em>thật</em> trên <strong>target</strong> (object gốc). Toàn bộ business code — <code>repo.save()</code>, <code>repo.updateStock()</code> — chạy <strong>bên trong</strong> transaction đó." },
    { title: "4 · Kết thúc: COMMIT hoặc rollback", tab: "usage", highlight: [13], on: ["target", "a4", "commit"],
      desc: "Khi method trả về, luồng quay lại proxy. Interceptor <strong>COMMIT</strong> transaction. Nếu method ném exception, interceptor <strong>rollback</strong>. Hành vi transaction được chèn <em>quanh</em> business code mà code đó không hề biết." },
    { title: "5 · Bẫy self-invocation", tab: "pitfall", highlight: [4, 5, 8, 9], on: ["target", "self"],
      desc: "Trong <code>run()</code>, lời gọi <code>this.heavy()</code> dùng tham chiếu <code>this</code> — tức là <strong>target gốc</strong>, không phải proxy. Nó đi <em>thẳng</em> vào method, <strong>bỏ qua interceptor</strong> → <code>@Transactional</code> trên <code>heavy()</code> KHÔNG có tác dụng, không transaction nào được mở." },
    { title: "6 · Cách sửa self-invocation", tab: "pitfall", highlight: [5, 8], on: ["self", "commit"],
      desc: "Để lời gọi đi qua proxy trở lại: gọi <code>heavy()</code> qua một tham chiếu <strong>bean được inject</strong> (self-inject hoặc lấy từ <code>ApplicationContext.getBean()</code>), hoặc <strong>tách</strong> <code>heavy()</code> sang một bean khác rồi inject bean đó vào. Khi ấy annotation lại được proxy áp dụng." }
  ],

  quiz: [
    { q: "Khi bạn @Autowired một bean có method @Transactional, đối tượng bạn nhận được là gì?", options: [
        "Chính object gốc (target) mà bạn khai báo",
        "Một proxy bọc quanh object gốc, do AutoProxyCreator tạo ra",
        "Một bản copy của object gốc",
        "Một interface rỗng chưa có cài đặt"
      ], correct: 1,
      explanation: "Bean AOP luôn được bọc bởi một proxy (JDK hoặc CGLIB). Cái bạn inject là proxy đó; nó chặn lời gọi để chèn hành vi rồi mới ủy quyền cho target gốc." },
    { q: "Spring dùng JDK dynamic proxy và CGLIB trong trường hợp nào?", options: [
        "JDK proxy cho class final, CGLIB cho class abstract",
        "JDK proxy khi bean có interface (implement cùng interface); CGLIB khi không có interface (sinh subclass)",
        "CGLIB chỉ dùng cho web, JDK proxy cho console",
        "Cả hai giống hệt nhau, chọn ngẫu nhiên"
      ], correct: 1,
      explanation: "Có interface → JDK dynamic proxy implement cùng interface. Không có interface → CGLIB sinh một subclass động. Spring Boot mặc định thiên về CGLIB." },
    { q: "Vì sao gọi this.method() (method có @Transactional) từ bên trong cùng bean lại làm annotation mất tác dụng, và sửa thế nào?", options: [
        "Vì @Transactional chỉ chạy ở method public; đổi sang private là xong",
        "Vì this là target gốc nên lời gọi không qua proxy; sửa bằng cách gọi qua bean được inject hoặc tách sang bean khác",
        "Vì transaction chỉ mở được một lần cho mỗi thread",
        "Vì Spring cấm gọi method nội bộ, phải đổi thành static"
      ], correct: 1,
      explanation: "Self-invocation: this trỏ tới object gốc, không phải proxy, nên interceptor không được kích hoạt. Cách tránh: gọi qua tham chiếu proxy (self-inject / ApplicationContext) hoặc tách method sang một bean khác." },
    { q: "Trong luồng @Transactional, transaction được mở và commit ở đâu?", options: [
        "Bên trong chính business method của target",
        "Ở proxy/interceptor: mở trước khi vào target, commit (hoặc rollback) sau khi target trả về",
        "Do JVM tự động mở khi thấy annotation",
        "Ở tầng database driver, Spring không tham gia"
      ], correct: 1,
      explanation: "TransactionInterceptor trong proxy mở transaction trước khi gọi target, rồi commit khi thành công hoặc rollback khi có exception — hành vi được chèn QUANH business code." }
  ]
});
