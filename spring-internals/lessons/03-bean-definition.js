window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Container & Bean",
  title: "BeanDefinition & Registry",
  subtitle: "Bản thiết kế của một bean gồm những gì",

  theory: `
    <p>Trước khi container <code>new</code> ra bất kỳ object nào, nó cần biết
    <strong>phải tạo cái gì và tạo thế nào</strong>. Thông tin đó nằm trong một
    <code>BeanDefinition</code> — <strong>metadata / bản thiết kế</strong> của bean,
    <em>không phải</em> bản thân object. Hãy ví von: <code>BeanDefinition</code> là
    <em>class</em>, còn bean instance là <em>object</em>; hay đó là
    <em>bản vẽ nhà</em> so với <em>căn nhà</em> thật.</p>
    <p>Một <code>BeanDefinition</code> chứa những "chỉ dẫn" như:</p>
    <ul>
      <li><code>beanClassName</code> — lớp cần khởi tạo.</li>
      <li><code>scope</code> — <code>singleton</code> hay <code>prototype</code>.</li>
      <li><code>lazyInit</code>, <code>dependsOn</code> — khi nào tạo, cần bean nào trước.</li>
      <li><code>constructorArgumentValues</code>, <code>propertyValues</code> — nguyên liệu để nối dây.</li>
      <li><code>initMethodName</code>, <code>destroyMethodName</code> — hook vòng đời.</li>
      <li><code>autowireMode</code>; và với <code>@Bean</code> thì có
          <code>factoryBeanName</code> + <code>factoryMethodName</code>.</li>
    </ul>
    <p>Tất cả definition được giữ trong <code>BeanDefinitionRegistry</code> — về bản chất
    là một map <em>tên bean → BeanDefinition</em>. Trên thực tế lớp
    <code>DefaultListableBeanFactory</code> cài đặt <strong>cả registry lẫn factory</strong>:
    vừa lưu định nghĩa, vừa biết cách dựng instance từ chúng.</p>
    <div class="callout"><p>💡 Vòng đời 2 pha: <strong>(1)</strong> thu thập ĐỊNH NGHĨA
    (từ component scan, <code>@Bean</code>, XML…) → <strong>(2)</strong> sau đó factory mới
    đọc định nghĩa để <em>new</em> ra instance. Vì có pha (1) tách riêng nên ta còn cơ hội
    <em>sửa</em> bản thiết kế trước khi bean ra đời — đó là việc của
    <code>BeanFactoryPostProcessor</code>.</p></div>
  `,

  codeTabs: [
    { id: "def", label: "📐 Một BeanDefinition trông thế nào", lines: [
      "// KHÔNG phải object thật — chỉ là metadata",
      "BeanDefinition bd = new RootBeanDefinition();",
      "bd.setBeanClassName(\"com.app.UserService\");",
      "bd.setScope(\"singleton\");   // hoặc \"prototype\"",
      "bd.setLazyInit(false);",
      "bd.setDependsOn(\"dataSource\");",
      "bd.setInitMethodName(\"init\");",
      "",
      "// nguyên liệu để container nối dây sau này",
      "bd.getConstructorArgumentValues()",
      "  .addGenericArgumentValue(userRepoRef);",
      "",
      "// cất vào registry: tên -> bản thiết kế",
      "registry.registerBeanDefinition(\"userService\", bd);",
      "",
      "// LÚC NÀY chưa có object UserService nào cả!"
    ]},
    { id: "bfpp", label: "🔧 Sửa định nghĩa trước khi tạo", lines: [
      "// BeanFactoryPostProcessor chạy ở PHA 1,",
      "// sau khi gom định nghĩa, TRƯỚC khi tạo instance",
      "class MyPostProcessor",
      "    implements BeanFactoryPostProcessor {",
      "  public void postProcessBeanFactory(",
      "      ConfigurableListableBeanFactory bf) {",
      "    BeanDefinition bd =",
      "        bf.getBeanDefinition(\"userService\");",
      "    // đổi bản thiết kế, không đụng instance",
      "    bd.setScope(\"prototype\");",
      "    bd.setLazyInit(true);",
      "  }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="scan"><div class="nl">Component scan</div><div class="ns">@Service, @Repository…</div></div>
      <div class="node" id="atbean"><div class="nl">@Bean methods</div><div class="ns">factory method</div></div>
      <div class="node" id="xml"><div class="nl">XML / khác</div><div class="ns">nguồn cũ</div></div>
    </div>
    <div class="arrow" id="a1">↓ đọc & mô tả</div>
    <div class="node" id="bd"><div class="nl">BeanDefinition</div><div class="ns">metadata: class, scope, deps… (blueprint)</div></div>
    <div class="arrow" id="a2">↓ registerBeanDefinition(tên, bd)</div>
    <div class="node" id="reg"><div class="nl">BeanDefinitionRegistry</div><div class="ns">map: tên bean → BeanDefinition (DefaultListableBeanFactory)</div></div>
    <div class="arrow" id="a3">↓ [PHA 2] factory dùng blueprint</div>
    <div class="node" id="inst"><div class="nl">Bean instance</div><div class="ns">object thật, đã new & nối dây</div></div>
  `,
  steps: [
    { title: "1 · Nhiều nguồn khai báo bean", tab: "def", highlight: [3, 4], on: ["scan", "atbean", "xml"],
      desc: "Bean có thể đến từ <strong>component scan</strong> (<code>@Service</code>…), từ method <code>@Bean</code> trong lớp config, hay từ XML cũ. Dù nguồn nào, kết quả đầu ra đều giống nhau: một <em>mô tả</em> về bean." },
    { title: "2 · Mỗi nguồn sinh ra một BeanDefinition", tab: "def", highlight: [1, 2, 3], on: ["a1", "bd"],
      desc: "Spring đọc mỗi nguồn và tạo một <code>BeanDefinition</code> — chỉ là <strong>metadata</strong>: cần <em>new</em> lớp nào, scope gì, phụ thuộc ai. Đây là <em>bản vẽ</em>, chưa phải căn nhà." },
    { title: "3 · Ghi lại các thuộc tính thiết kế", tab: "def", highlight: [4, 5, 6, 7], on: ["bd"],
      desc: "Bản thiết kế ghi rõ <code>scope</code>, <code>lazyInit</code>, <code>dependsOn</code>, <code>initMethodName</code>… cùng <code>constructorArgumentValues</code> làm nguyên liệu nối dây cho pha sau." },
    { title: "4 · Cất vào Registry", tab: "def", highlight: [13, 15], on: ["a2", "reg"],
      desc: "Definition được đăng ký vào <code>BeanDefinitionRegistry</code> — map <em>tên → blueprint</em>. Lớp <code>DefaultListableBeanFactory</code> đóng cả vai registry lẫn factory. <strong>Lúc này vẫn CHƯA có object nào.</strong>" },
    { title: "5 · Sửa blueprint trước khi tạo (tùy chọn)", tab: "bfpp", highlight: [5, 6, 7, 8, 10], on: ["reg"],
      desc: "Vì định nghĩa nằm sẵn trong registry, một <code>BeanFactoryPostProcessor</code> có thể lấy ra và <strong>chỉnh bản thiết kế</strong> (đổi scope, bật lazy…) — vẫn chưa đụng tới instance nào." },
    { title: "6 · Pha 2: factory dựng instance", tab: "def", highlight: [16], on: ["a3", "inst"],
      desc: "Chỉ đến khi cần, factory mới đọc blueprint để <code>new</code> ra <strong>bean instance</strong> thật và nối dây. Một blueprint có thể dựng ra 1 instance (singleton) hoặc nhiều (prototype)." }
  ],

  quiz: [
    { q: "Một BeanDefinition thực chất chứa cái gì?", options: [
        "Chính object bean đã được khởi tạo",
        "Metadata mô tả cách tạo bean (class, scope, phụ thuộc…), không phải instance",
        "Bytecode đã biên dịch của lớp bean",
        "Một bản sao dự phòng của bean để phục hồi khi lỗi"
      ], correct: 1,
      explanation: "BeanDefinition là bản thiết kế/metadata (beanClassName, scope, deps, init method…). Object thật chỉ được tạo ở pha sau, từ definition này." },
    { q: "Các BeanDefinition được lưu ở đâu?", options: [
        "Trong chính mỗi instance bean",
        "Trong một file .class riêng do Spring sinh ra",
        "Trong BeanDefinitionRegistry — map tên bean → BeanDefinition",
        "Trong JVM method area, ngoài tầm với của Spring"
      ], correct: 2,
      explanation: "Registry là nơi giữ mọi định nghĩa dưới dạng map tên → BeanDefinition, để factory tra cứu khi cần dựng instance." },
    { q: "Vai trò của DefaultListableBeanFactory là gì?", options: [
        "Chỉ là một annotation đánh dấu bean",
        "Chỉ lưu định nghĩa, việc tạo instance do lớp khác lo",
        "Lớp cài đặt CẢ BeanDefinitionRegistry lẫn bean factory — vừa lưu định nghĩa vừa dựng instance",
        "Một cache riêng cho các bean prototype"
      ], correct: 2,
      explanation: "DefaultListableBeanFactory là hiện thực đầy đủ: nó vừa là registry (giữ định nghĩa) vừa là factory (đọc định nghĩa để tạo bean)." },
    { q: "Có thể thay đổi định nghĩa bean TRƯỚC khi instance được tạo không?", options: [
        "Không, định nghĩa là bất biến ngay khi đăng ký",
        "Có — BeanFactoryPostProcessor chạy ở pha định nghĩa và sửa được BeanDefinition trước khi tạo instance",
        "Chỉ sửa được sau khi bean đã khởi tạo xong",
        "Chỉ sửa được nếu bean là prototype"
      ], correct: 1,
      explanation: "Nhờ vòng đời 2 pha, BeanFactoryPostProcessor can thiệp ở pha định nghĩa: lấy BeanDefinition từ registry và chỉnh (scope, lazy…) trước khi bất kỳ instance nào ra đời." }
  ]
});
