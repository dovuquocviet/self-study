window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Bức tranh tổng",
  title: "IoC & Dependency Injection",
  subtitle: "Ai đứng ra tạo object và tiêm nó vào đâu",

  theory: `
    <p><strong>IoC (Inversion of Control — đảo ngược điều khiển)</strong> nghĩa là:
    thay vì <em>bạn</em> tự <code>new</code> các object và tự nối chúng lại,
    bạn giao việc đó cho một <strong>container</strong>. Container sẽ tạo object,
    quản lý vòng đời và "tiêm" (inject) các phụ thuộc vào đúng chỗ.</p>
    <p><strong>DI (Dependency Injection)</strong> là <em>cách</em> IoC được thực hiện:
    một class không tự tạo phụ thuộc của nó mà <strong>khai báo</strong> phụ thuộc
    (qua constructor / field / setter), rồi container đưa phụ thuộc vào.</p>
    <ul>
      <li>Object do container quản lý được gọi là <strong>bean</strong>.</li>
      <li><code>BeanFactory</code> là container lõi (tạo + giữ bean).
          <code>ApplicationContext</code> là bản "cao cấp" bọc quanh nó,
          thêm: quét annotation, sự kiện, i18n, tích hợp web…</li>
      <li>Trong Spring Boot, container thật là một <code>ApplicationContext</code>
          được tạo tự động khi bạn gọi <code>SpringApplication.run(...)</code>.</li>
    </ul>
    <div class="callout"><p>💡 Câu hỏi cốt lõi của cả khoá: <em>"Cái gì đứng ra tạo bean?"</em>
    → Câu trả lời: <strong>ApplicationContext</strong>. Các bài sau sẽ mổ xẻ nó tạo <em>thế nào</em>.</p></div>
  `,

  codeTabs: [
    { id: "spring", label: "🌱 Cách viết với Spring", lines: [
      "@Service",
      "class UserService {",
      "    private final UserRepository repo;",
      "",
      "    // KHÔNG có 'new UserRepository()' ở đây!",
      "    UserService(UserRepository repo) {",
      "        this.repo = repo;   // container tiêm vào",
      "    }",
      "}",
      "",
      "@Repository",
      "class UserRepository { }",
      "",
      "// Nơi khởi động ứng dụng",
      "var ctx = new AnnotationConfigApplicationContext(App.class);",
      "UserService s = ctx.getBean(UserService.class);"
    ]},
    { id: "manual", label: "🔧 Nếu KHÔNG có Spring", lines: [
      "// Không có container — bạn tự lo tất cả",
      "UserRepository repo = new UserRepository();",
      "UserService service = new UserService(repo);",
      "",
      "// Bạn phải tự nhớ thứ tự tạo, tự nối dây, và sửa",
      "// TẤT CẢ những chỗ như thế này mỗi khi đổi phụ thuộc."
    ]}
  ],

  stageHtml: `
    <div class="node" id="cont"><div class="nl">ApplicationContext</div><div class="ns">IoC container</div></div>
    <div class="arrow" id="a1">↓ tạo</div>
    <div class="node" id="repo"><div class="nl">UserRepository</div><div class="ns">bean không phụ thuộc ai</div></div>
    <div class="arrow" id="a2">↓ tiêm vào</div>
    <div class="node" id="svc"><div class="nl">UserService</div><div class="ns">cần một UserRepository</div></div>
    <div class="arrow" id="a3">↓ getBean()</div>
    <div class="node" id="ready"><div class="nl">Bean sẵn sàng dùng</div><div class="ns">đã nối dây xong</div></div>
  `,
  steps: [
    { title: "1 · Khởi động container", tab: "spring", highlight: [14, 15], on: ["cont"],
      desc: "Bạn gọi <code>new AnnotationConfigApplicationContext(...)</code> (Spring Boot làm hộ bên trong <code>SpringApplication.run</code>). Từ đây, container — chứ không phải bạn — chịu trách nhiệm tạo object." },
    { title: "2 · Tạo bean độc lập trước", tab: "spring", highlight: [11, 12], on: ["cont", "a1", "repo"],
      desc: "Container tạo những bean không phụ thuộc ai trước. <code>UserRepository</code> không cần gì nên được khởi tạo ngay." },
    { title: "3 · Bean phụ thuộc khai báo nhu cầu", tab: "spring", highlight: [1, 2, 3, 6], on: ["repo", "svc"],
      desc: "<code>UserService</code> KHÔNG tự tạo repository. Nó chỉ <strong>khai báo</strong> qua constructor rằng 'tôi cần một UserRepository'." },
    { title: "4 · Đảo ngược điều khiển: inject", tab: "spring", highlight: [5, 6, 7], on: ["repo", "a2", "svc"],
      desc: "Container thấy tham số constructor, tìm bean <code>UserRepository</code> đã có và <strong>tiêm vào</strong>. Quyền quyết định 'lấy repo ở đâu' đã chuyển từ bạn sang container — đó chính là <em>inversion</em>." },
    { title: "5 · Lấy bean ra dùng", tab: "spring", highlight: [16], on: ["svc", "a3", "ready"],
      desc: "<code>getBean(UserService.class)</code> trả về bean đã được nối dây hoàn chỉnh. Bạn không hề gọi <code>new</code> — container đã làm tất cả." }
  ],

  quiz: [
    { q: "\"Inversion of Control\" đảo ngược điều gì?", options: [
        "Đảo ngược thứ tự các câu lệnh trong method",
        "Quyền tạo object và nối phụ thuộc chuyển từ code của bạn sang container",
        "Đảo ngược quan hệ kế thừa giữa các class",
        "Chạy chương trình theo chiều ngược lại"
      ], correct: 1,
      explanation: "IoC = quyền điều khiển việc khởi tạo & nối dây object được 'đảo' từ bạn sang framework/container." },
    { q: "Quan hệ giữa BeanFactory và ApplicationContext là gì?", options: [
        "Chúng không liên quan gì nhau",
        "ApplicationContext là container lõi, BeanFactory bọc thêm tính năng",
        "BeanFactory là container lõi; ApplicationContext bọc quanh và thêm tính năng (annotation, event, i18n…)",
        "BeanFactory chỉ dùng cho web, ApplicationContext cho console"
      ], correct: 2,
      explanation: "ApplicationContext là 'siêu tập' của BeanFactory: vẫn tạo/giữ bean nhưng bổ sung nhiều năng lực cấp ứng dụng." },
    { q: "Vì sao dùng constructor injection lại giúp lớp dễ test hơn?", options: [
        "Vì Spring bắt buộc như vậy",
        "Vì bạn có thể tự new object và truyền phụ thuộc giả (mock) vào — không cần container",
        "Vì constructor chạy nhanh hơn setter",
        "Vì nó tự động tạo mock"
      ], correct: 1,
      explanation: "Phụ thuộc được khai báo ở constructor nên khi test bạn chỉ cần new class và truyền mock — hoàn toàn không cần Spring." },
    { q: "Trong Spring Boot, cái gì thực sự đứng ra tạo các bean?", options: [
        "Chính từ khoá @Service",
        "Trình biên dịch javac",
        "Một ApplicationContext được tạo bên trong SpringApplication.run(...)",
        "JVM tự nhận diện annotation và tạo"
      ], correct: 2,
      explanation: "Annotation chỉ là 'đánh dấu'. Thực thể tạo bean là ApplicationContext, được khởi tạo trong quá trình SpringApplication.run()." }
  ]
});
