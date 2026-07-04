window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Cấu hình",
  title: "@Configuration & @Bean (proxy CGLIB)",
  subtitle: "Vì sao gọi @Bean này trong @Bean kia vẫn ra cùng một instance",

  theory: `
    <p><strong>@Configuration + @Bean</strong> là cách <strong>đăng ký bean bằng code Java</strong>
    (thay cho <code>@Component</code> + component scan). Một method gắn <code>@Bean</code> trả về
    một object → object đó trở thành bean, và <strong>tên bean = tên method</strong>.</p>
    <p>Điểm mấu chốt: một class <code>@Configuration</code> (mặc định
    <code>proxyBeanMethods=true</code>, gọi là <strong>"full" mode</strong>) được Spring
    <strong>enhance bằng CGLIB</strong> — tạo động một <em>subclass</em> lúc runtime. Trong subclass đó,
    mỗi lời gọi tới một method <code>@Bean</code> bị <strong>chặn (intercept)</strong>:</p>
    <ul>
      <li>Lần đầu: chạy method, tạo bean và <strong>cache</strong> vào container.</li>
      <li>Các lần sau: <strong>trả về bean đã cache</strong>, KHÔNG chạy lại method.</li>
    </ul>
    <p>Nhờ vậy, nếu <code>dataSource()</code> gọi <code>config()</code> bên trong, nó nhận đúng
    <strong>singleton</strong> config bean chứ không tạo bản mới.</p>
    <p>Đối lập là <strong>"lite" mode</strong>: <code>@Bean</code> trong class KHÔNG có
    <code>@Configuration</code>, hoặc <code>proxyBeanMethods=false</code>. Lúc này KHÔNG có proxy →
    gọi thẳng method <code>@Bean</code> chỉ là một lời gọi Java bình thường, <strong>tạo instance mới
    mỗi lần</strong> (không đi qua container) → dễ sinh nhiều instance ngoài ý muốn.</p>
    <div class="callout"><p>💡 <code>proxyBeanMethods=false</code> giúp khởi động nhanh hơn (không cần
    tạo subclass CGLIB) nhưng đánh đổi: bạn mất tính "gọi method @Bean = lấy singleton". Chỉ nên tắt khi
    các method @Bean của bạn không gọi lẫn nhau.</p></div>
  `,

  codeTabs: [
    { id: "full", label: "🌱 @Configuration (full mode)", lines: [
      "@Configuration",
      "class AppConfig {",
      "",
      "    @Bean",
      "    Config config() {",
      "        return new Config(\"db-url\");",
      "    }",
      "",
      "    @Bean",
      "    DataSource dataSource() {",
      "        // dataSource() gọi thẳng method @Bean khác",
      "        return new DataSource(config());",
      "    }",
      "}"
    ]},
    { id: "lite", label: "⚡ proxyBeanMethods=false", lines: [
      "@Configuration(proxyBeanMethods = false)",
      "class LiteConfig {",
      "",
      "    @Bean",
      "    Config config() {",
      "        return new Config(\"db-url\");",
      "    }",
      "",
      "    @Bean",
      "    DataSource dataSource() {",
      "        // KHÔNG proxy → config() tạo instance MỚI",
      "        return new DataSource(config());",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cfg"><div class="nl">@Configuration AppConfig</div><div class="ns">2 method @Bean, cái này gọi cái kia</div></div>
    <div class="arrow" id="a1">↓ Spring enhance lúc khởi động</div>
    <div class="node" id="proxy"><div class="nl">AppConfig$$SpringCGLIB$$0</div><div class="ns">subclass CGLIB (full mode)</div></div>
    <div class="arrow" id="a2">↓ khi dataSource() gọi config()</div>
    <div class="node" id="intercept"><div class="nl">Proxy chặn lời gọi config()</div><div class="ns">hỏi container: đã có config bean chưa?</div></div>
    <div class="arrow" id="a3">↓ so sánh hai chế độ</div>
    <div class="row">
      <div class="node" id="full"><div class="nl">full: proxyBeanMethods=true</div><div class="ns">trả bean đã cache → 1 instance</div></div>
      <div class="node" id="lite"><div class="nl">lite: proxyBeanMethods=false</div><div class="ns">chạy method → new instance mỗi lần</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Đăng ký bean bằng code", tab: "full", highlight: [1, 4, 5], on: ["cfg"],
      desc: "<code>@Configuration</code> đánh dấu class chứa cấu hình. Mỗi method <code>@Bean</code> trả về một object trở thành một bean, với <strong>tên bean = tên method</strong> (ở đây là <code>config</code> và <code>dataSource</code>)." },
    { title: "2 · Spring enhance bằng CGLIB", tab: "full", highlight: [1], on: ["cfg", "a1", "proxy"],
      desc: "Vì <code>proxyBeanMethods</code> mặc định là <code>true</code>, Spring KHÔNG dùng thẳng class của bạn mà tạo động một <strong>subclass CGLIB</strong> (tên kiểu <code>AppConfig$$SpringCGLIB$$0</code>) để chặn các lời gọi method @Bean." },
    { title: "3 · Một @Bean gọi @Bean khác", tab: "full", highlight: [10, 12], on: ["proxy", "a2", "intercept"],
      desc: "<code>dataSource()</code> gọi thẳng <code>config()</code>. Trông như một lời gọi Java bình thường, nhưng vì ta đang ở trong subclass CGLIB nên lời gọi này <strong>bị proxy chặn lại</strong>." },
    { title: "4 · Full mode: trả bean đã cache", tab: "full", highlight: [12], on: ["intercept", "a3", "full"],
      desc: "Proxy hỏi container: 'đã có bean <code>config</code> chưa?'. Nếu rồi → <strong>trả về đúng singleton đã cache</strong> thay vì chạy lại method. Vì thế <code>dataSource</code> luôn nhận cùng một <code>Config</code> instance." },
    { title: "5 · Lite mode: new mỗi lần", tab: "lite", highlight: [1, 11, 12], on: ["full", "lite"],
      desc: "Với <code>proxyBeanMethods=false</code> (hoặc class không có <code>@Configuration</code>) thì <strong>không có proxy</strong>. Lời gọi <code>config()</code> chỉ là method Java thuần → tạo một <code>Config</code> MỚI, không đi qua container. Đổi lại: khởi động nhanh hơn." }
  ],

  quiz: [
    { q: "Vì sao một class @Configuration (full mode) cần bị enhance bằng CGLIB proxy?", options: [
        "Để mã hoá source code cho bảo mật",
        "Để chặn các lời gọi method @Bean, trả về singleton đã cache thay vì chạy lại method",
        "Để tăng tốc độ chạy method @Bean lên nhiều lần",
        "Vì CGLIB bắt buộc cho mọi bean trong Spring"
      ], correct: 1,
      explanation: "Proxy CGLIB chặn lời gọi method @Bean: lần đầu tạo & cache vào container, các lần sau trả bean đã có → đảm bảo tính singleton khi @Bean này gọi @Bean kia." },
    { q: "Nếu gọi trực tiếp một method @Bean trong class KHÔNG có @Configuration thì điều gì xảy ra?", options: [
        "Vẫn lấy được singleton từ container như bình thường",
        "Spring báo lỗi biên dịch",
        "Nó chỉ là lời gọi Java thường → tạo instance MỚI, không đi qua container",
        "Method sẽ không bao giờ được chạy"
      ], correct: 2,
      explanation: "Không có @Configuration nghĩa là không có proxy (lite mode). Gọi method @Bean chỉ là lời gọi Java thuần, tạo object mới mỗi lần, bỏ qua cache của container." },
    { q: "Tên của bean được tạo bởi một method @Bean được xác định thế nào?", options: [
        "Luôn là tên class trả về",
        "Mặc định là tên của chính method @Bean đó",
        "Một chuỗi ngẫu nhiên do Spring sinh ra",
        "Tên package chứa class @Configuration"
      ], correct: 1,
      explanation: "Mặc định tên bean = tên method @Bean (ví dụ method dataSource() → bean tên 'dataSource'). Có thể đổi bằng thuộc tính name của @Bean." },
    { q: "Đặt proxyBeanMethods=false đánh đổi điều gì?", options: [
        "Mất khả năng dùng dependency injection hoàn toàn",
        "Khởi động nhanh hơn (không tạo subclass CGLIB), nhưng gọi method @Bean không còn trả singleton",
        "Làm ứng dụng chậm hơn nhưng an toàn hơn",
        "Không có đánh đổi gì, luôn nên bật"
      ], correct: 1,
      explanation: "Tắt proxy giúp bỏ bước enhance CGLIB nên khởi động nhanh hơn, nhưng method @Bean gọi lẫn nhau sẽ tạo instance mới. Chỉ nên tắt khi các @Bean không gọi nhau." }
  ]
});
