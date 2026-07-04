window.LESSONS.push({
  id: "13",
  phase: "4", phaseName: "Khởi động & Web",
  title: "DispatcherServlet: một HTTP request đi đâu",
  subtitle: "Từ TCP tới @GetMapping và ngược lại",

  theory: `
    <p>Khi một request HTTP tới ứng dụng Spring Boot web, nó KHÔNG nhảy thẳng vào
    method <code>@GetMapping</code> của bạn. Đường đi thật sự là:</p>
    <ol>
      <li>Request tới <strong>embedded Tomcat</strong>, rồi Tomcat chuyển cho
          <code>DispatcherServlet</code> — một <strong>front controller</strong> duy nhất
          được auto-config đăng ký map vào đường dẫn <code>"/"</code>.</li>
      <li>DispatcherServlet hỏi <code>HandlerMapping</code>
          (vd <code>RequestMappingHandlerMapping</code>) để tìm handler khớp
          <strong>URL + HTTP method</strong>, trả về một <code>HandlerExecutionChain</code>
          (method controller + các interceptor).</li>
      <li>DispatcherServlet lấy <code>HandlerAdapter</code> phù hợp
          (vd <code>RequestMappingHandlerAdapter</code>) để <strong>gọi</strong> handler.
          Adapter lo phân giải tham số: <code>@RequestParam</code>, <code>@PathVariable</code>,
          <code>@RequestBody</code> (qua <code>HttpMessageConverter</code>), rồi gọi method.</li>
      <li>Kết quả trả về: nếu <code>@ResponseBody</code>/<code>@RestController</code> →
          dùng <code>HttpMessageConverter</code> (vd Jackson) serialize object thành JSON,
          ghi thẳng vào response. Nếu trả về tên view →
          <code>ViewResolver</code> phân giải thành <code>View</code> rồi render
          (Thymeleaf/JSP).</li>
      <li>Nếu có exception → <code>HandlerExceptionResolver</code> xử lý
          (vd <code>@ExceptionHandler</code>/<code>@ControllerAdvice</code>).</li>
      <li>Response quay lại DispatcherServlet → Tomcat → client.</li>
    </ol>
    <div class="callout"><p>💡 <code>@GetMapping</code> không "tự" nhận request.
    <strong>DispatcherServlet + HandlerMapping</strong> mới là bộ định tuyến;
    controller của bạn chỉ là một <em>handler</em> được gọi tới.</p></div>
  `,

  codeTabs: [
    { id: "controller", label: "🎯 Controller", lines: [
      "@RestController          // = @Controller + @ResponseBody",
      "@RequestMapping(\"/users\")",
      "class UserController {",
      "",
      "    @GetMapping(\"/{id}\")",
      "    User getUser(@PathVariable Long id,",
      "                 @RequestParam(defaultValue = \"vi\") String lang) {",
      "        return new User(id, \"An\", lang);",
      "    }",
      "}",
      "",
      "// Trả về object User, KHÔNG trả tên view",
      "// → Jackson biến nó thành JSON trong response body"
    ]},
    { id: "flow", label: "⚙️ doDispatch()", lines: [
      "// Bên trong DispatcherServlet.doDispatch(req, res):",
      "",
      "// 1) Tìm handler khớp URL + method",
      "chain = handlerMapping.getHandler(req);",
      "",
      "// 2) Chọn adapter biết cách gọi handler đó",
      "adapter = getHandlerAdapter(chain.getHandler());",
      "",
      "// 3) Adapter bind tham số rồi gọi controller",
      "mav = adapter.handle(req, res, chain.getHandler());",
      "",
      "// 4) @ResponseBody? converter ghi JSON thẳng vào res",
      "//    Trả tên view? viewResolver phân giải rồi render",
      "processDispatchResult(req, res, mav, exception);"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">HTTP request</div><div class="ns">GET /users/7?lang=vi</div></div>
    <div class="arrow" id="a1">↓ TCP</div>
    <div class="node" id="tomcat"><div class="nl">Embedded Tomcat</div><div class="ns">servlet container</div></div>
    <div class="arrow" id="a2">↓ chuyển tới "/"</div>
    <div class="node" id="ds"><div class="nl">DispatcherServlet</div><div class="ns">front controller duy nhất</div></div>
    <div class="arrow" id="a3">↓ getHandler()</div>
    <div class="node" id="hm"><div class="nl">HandlerMapping</div><div class="ns">tìm handler khớp URL+method</div></div>
    <div class="arrow" id="a4">↓ handle()</div>
    <div class="node" id="ha"><div class="nl">HandlerAdapter</div><div class="ns">bind tham số + gọi</div></div>
    <div class="arrow" id="a5">↓ gọi method</div>
    <div class="node" id="ctrl"><div class="nl">Controller method</div><div class="ns">@GetMapping trả về User</div></div>
    <div class="arrow" id="a6">↓ serialize</div>
    <div class="node" id="conv"><div class="nl">HttpMessageConverter</div><div class="ns">Jackson → JSON (hoặc ViewResolver)</div></div>
    <div class="arrow" id="a7">↓ response về client</div>
    <div class="node" id="resp"><div class="nl">HTTP response</div><div class="ns">200 + body JSON</div></div>
  `,
  steps: [
    { title: "1 · Request tới Tomcat", tab: "flow", highlight: [1], on: ["req", "a1", "tomcat"],
      desc: "Request HTTP tới <strong>embedded Tomcat</strong>. Tomcat là servlet container: nó nhận kết nối TCP, dựng đối tượng <code>HttpServletRequest/Response</code>." },
    { title: "2 · Tomcat trao cho DispatcherServlet", tab: "flow", highlight: [1], on: ["tomcat", "a2", "ds"],
      desc: "Auto-config đăng ký một <code>DispatcherServlet</code> map vào <code>\"/\"</code>, nên mọi request đều vào nó — <strong>front controller</strong> duy nhất điều phối tất cả." },
    { title: "3 · HandlerMapping tìm handler", tab: "flow", highlight: [3, 4], on: ["ds", "a3", "hm"],
      desc: "DispatcherServlet hỏi <code>HandlerMapping</code> (vd <code>RequestMappingHandlerMapping</code>): URL <code>/users/7</code> + method <code>GET</code> khớp handler nào? → trả về <code>HandlerExecutionChain</code> (method + interceptor)." },
    { title: "4 · HandlerAdapter bind tham số & gọi", tab: "controller", highlight: [5, 6, 7], on: ["hm", "a4", "ha", "a5", "ctrl"],
      desc: "<code>HandlerAdapter</code> phân giải <code>@PathVariable id=7</code>, <code>@RequestParam lang=vi</code> (với <code>@RequestBody</code> thì dùng converter đọc JSON), rồi <strong>gọi</strong> method controller." },
    { title: "5 · Controller trả object", tab: "controller", highlight: [8], on: ["ctrl", "a6"],
      desc: "Method trả về một <code>User</code> — KHÔNG trả tên view. Vì đây là <code>@RestController</code> (ngầm <code>@ResponseBody</code>), Spring biết phải serialize giá trị trả về vào body." },
    { title: "6 · Converter serialize thành JSON", tab: "flow", highlight: [11, 12, 13], on: ["conv", "a7", "resp"],
      desc: "<code>HttpMessageConverter</code> (Jackson) biến <code>User</code> thành JSON ghi thẳng vào response. Nếu là <code>@Controller</code> trả tên view thì <code>ViewResolver</code> sẽ render HTML thay vì converter." }
  ],

  quiz: [
    { q: "Thành phần nào tìm ra handler (controller method) khớp với URL và HTTP method?", options: [
        "HttpMessageConverter",
        "HandlerMapping (vd RequestMappingHandlerMapping)",
        "ViewResolver",
        "Chính annotation @GetMapping tự làm"
      ], correct: 1,
      explanation: "DispatcherServlet ủy quyền cho HandlerMapping để ánh xạ URL+method → handler, trả về HandlerExecutionChain. @GetMapping chỉ là metadata mà HandlerMapping đọc." },
    { q: "Object trả về từ @RestController được biến thành JSON nhờ đâu?", options: [
        "ViewResolver phân giải thành trang JSON",
        "Tomcat tự động chuyển object thành JSON",
        "HttpMessageConverter (vd Jackson) serialize object vào response body",
        "HandlerMapping chuyển đổi kiểu dữ liệu"
      ], correct: 2,
      explanation: "Với @ResponseBody/@RestController, giá trị trả về đi qua HttpMessageConverter (thường là Jackson cho JSON) và được ghi thẳng vào body — không qua ViewResolver." },
    { q: "DispatcherServlet đóng vai trò gì trong Spring MVC?", options: [
        "Một trong nhiều servlet, mỗi controller là một servlet riêng",
        "Front controller duy nhất, điều phối mọi request tới đúng handler",
        "Là embedded Tomcat",
        "Là nơi chứa business logic của ứng dụng"
      ], correct: 1,
      explanation: "DispatcherServlet là front controller: một servlet duy nhất map vào \"/\" nhận mọi request rồi điều phối qua HandlerMapping, HandlerAdapter, converter/ViewResolver." },
    { q: "@RestController khác @Controller ở điểm nào?", options: [
        "@RestController chạy nhanh hơn nhờ đa luồng",
        "@RestController không cần DispatcherServlet",
        "@RestController ngầm thêm @ResponseBody: kết quả đi qua HttpMessageConverter thay vì ViewResolver",
        "@Controller chỉ dùng cho REST API"
      ], correct: 2,
      explanation: "@RestController = @Controller + @ResponseBody. Giá trị trả về được serialize bằng HttpMessageConverter (JSON) thay vì được coi là tên view cho ViewResolver render." }
  ]
});
