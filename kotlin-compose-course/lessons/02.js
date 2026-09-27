window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Kotlin cho dev Java",
  title: "Null safety — NullPointerException bị đẩy lên lúc compile",
  subtitle: "String vs String? · ?. · ?: · !! · smart cast · platform type · lateinit",

  theory: `
    <p>Trong Java, mọi tham chiếu đều <em>có thể</em> null và compiler không quan tâm — NPE nổ lúc runtime. Kotlin tách thành <strong>hai kiểu khác nhau</strong>:
    <code>String</code> (không bao giờ null) và <code>String?</code> (có thể null). Đây là thông tin của <em>hệ thống kiểu lúc compile</em>;
    trong bytecode cả hai vẫn là <code>java.lang.String</code>, chỉ thêm annotation <code>@NotNull/@Nullable</code> và vài lệnh kiểm tra.</p>

    <table>
      <tr><th>Cú pháp</th><th>Ý nghĩa</th><th>Java tương đương</th></tr>
      <tr><td><code>a?.length</code></td><td>Safe call: a null thì cả biểu thức là null</td><td><code>a == null ? null : a.length()</code></td></tr>
      <tr><td><code>a ?: "mặc định"</code></td><td>Elvis: vế trái null thì lấy vế phải</td><td><code>Objects.requireNonNullElse(a, ...)</code></td></tr>
      <tr><td><code>a ?: return</code> / <code>a ?: throw ...</code></td><td>Thoát sớm khi null (vì return/throw là biểu thức kiểu Nothing)</td><td><code>if (a == null) return;</code></td></tr>
      <tr><td><code>a!!</code></td><td>"Tôi chắc chắn không null" — sai thì ném NPE</td><td>Dùng thẳng <code>a</code> như Java</td></tr>
      <tr><td><code>a?.let { ... }</code></td><td>Chỉ chạy khối khi khác null</td><td><code>if (a != null) {...}</code></td></tr>
      <tr><td><code>a as? User</code></td><td>Ép kiểu an toàn: sai kiểu trả null</td><td><code>instanceof</code> + cast</td></tr>
    </table>

    <p><strong>Smart cast</strong>: sau <code>if (a != null)</code> compiler tự coi <code>a</code> là <code>String</code> trong khối đó — nhưng chỉ với <code>val</code> cục bộ hoặc
    property không thể bị thay đổi giữa chừng. Với <code>var</code> property của class, thread khác có thể gán null nên compiler từ chối, bạn phải copy ra biến cục bộ.</p>

    <p><strong>Platform type</strong> (<code>String!</code>): giá trị trả về từ code Java không có annotation nullability. Kotlin không biết nên <em>để bạn quyết</em> — gán vào
    <code>String</code> là bạn cam kết không null; nếu Java trả null thì NPE nổ ngay ở chỗ gán. Khi gọi SDK Android/Java cũ, hãy chủ động khai báo <code>String?</code>.</p>

    <p><strong>lateinit var</strong>: cho property không-null nhưng được gán sau constructor (DI, setUp của test). Đọc trước khi gán ném
    <code>UninitializedPropertyAccessException</code>. Chỉ dùng với <code>var</code>, kiểu không phải primitive.</p>

    <div class="callout"><p>💡 Mỗi <code>!!</code> là một chỗ bạn tắt tính năng an toàn. Trong code review, <code>!!</code> nên hiếm như <code>@SuppressWarnings</code>.
    Cách đúng thường là: đẩy null về biên (parse JSON, DB, Intent extras), kiểm tra một lần, rồi bên trong domain chỉ dùng kiểu không-null.</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "① Hai loại kiểu", lines: [
      "var name: String = \"An\"",
      "name = null            // ❌ lỗi compile: Null can not be a value of a non-null type",
      "",
      "var nick: String? = null",
      "val len1 = nick.length    // ❌ lỗi compile: phải xử lý null",
      "val len2 = nick?.length   // Int? = null",
      "val len3 = nick?.length ?: 0   // Int = 0",
      "val len4 = nick!!.length  // biên dịch được, runtime ném NPE"
    ]},
    { id: "smart", label: "② Smart cast & thoát sớm", lines: [
      "fun greet(user: User?): String {",
      "    val u = user ?: return \"Khách\"      // từ đây u: User (không null)",
      "    val email = u.email ?: throw IllegalStateException(\"thiếu email\")",
      "    return \"Chào ${u.name} <$email>\"",
      "}",
      "",
      "class Screen { var title: String? = null",
      "    fun show() {",
      "        if (title != null) println(title.length)  // ❌ var property: không smart cast",
      "        title?.let { println(it.length) }         // ✅ it là String",
      "    }",
      "}"
    ]},
    { id: "platform", label: "③ Platform type", lines: [
      "// Java: public String getHeader(String name) { ... có thể trả null ... }",
      "val h1 = request.getHeader(\"X-Id\")          // kiểu String! (platform)",
      "val h2: String = request.getHeader(\"X-Id\")  // NPE ngay tại đây nếu Java trả null",
      "val h3: String? = request.getHeader(\"X-Id\") // ✅ an toàn, buộc xử lý null",
      "",
      "// Java có @Nullable/@NonNull (JSpecify, AndroidX) → Kotlin hiểu đúng String?/String"
    ]},
    { id: "late", label: "④ lateinit & lazy", lines: [
      "class OrderServiceTest {",
      "    lateinit var repo: FakeOrderRepo       // gán trong setUp",
      "",
      "    @Before fun setUp() { repo = FakeOrderRepo() }",
      "",
      "    fun check() = ::repo.isInitialized    // kiểm tra đã gán chưa",
      "}",
      "",
      "val config: Config by lazy { loadConfig() }  // tính một lần ở lần đọc đầu, thread-safe mặc định"
    ]}
  ],

  stageHtml: `
    <div class="node" id="in"><div class="nl">📥 Biên: JSON / Java API / Intent</div><div class="ns">giá trị có thể null → kiểu T?</div></div>
    <div class="arrow" id="a1">↓ ?: return · ?: throw · ?.let</div>
    <div class="node" id="check"><div class="nl">🛂 Kiểm tra một lần</div><div class="ns">compiler smart cast sang T</div></div>
    <div class="arrow" id="a2">↓ chỉ còn kiểu không-null</div>
    <div class="node" id="domain"><div class="nl">🏛️ Domain / UI logic</div><div class="ns">không cần kiểm tra null nữa</div></div>
    <div class="node" id="bang"><div class="nl">💥 !! hoặc platform type gán bừa</div><div class="ns">NPE quay lại như Java</div></div>
  `,
  steps: [
    { title: "1 · Hai kiểu tách biệt", tab: "basic", highlight: [1, 2, 4, 5], on: ["in"],
      desc: "String và String? là hai kiểu khác nhau. Gọi thẳng <code>.length</code> trên String? là lỗi compile, không phải lỗi runtime." },
    { title: "2 · Các toán tử xử lý null", tab: "basic", highlight: [6, 7], on: ["a1"],
      desc: "<code>?.</code> lan truyền null, <code>?:</code> thay giá trị mặc định." },
    { title: "3 · Thoát sớm & smart cast", tab: "smart", highlight: [2, 3, 4], on: ["check", "a2", "domain"],
      desc: "Sau <code>?: return</code>, compiler biết u không null. Phần còn lại của hàm viết như không có null." },
    { title: "4 · Giới hạn của smart cast", tab: "smart", highlight: [9, 10], on: ["check"],
      desc: "Property <code>var</code> có thể bị đổi giữa lúc kiểm tra và lúc dùng, nên compiler không smart cast. Dùng <code>?.let</code> hoặc copy ra val cục bộ." },
    { title: "5 · Lỗ hổng: platform type & !!", tab: "platform", highlight: [2, 3, 4], on: ["bang"],
      desc: "Giá trị từ Java không annotation là <code>String!</code>. Tự khai báo <code>String?</code> để lấy lại sự an toàn." },
    { title: "6 · lateinit & lazy", tab: "late", highlight: [2, 6, 9], on: ["domain"],
      desc: "lateinit cho giá trị gán muộn (test, DI); <code>by lazy</code> cho giá trị tính lần đầu khi dùng." }
  ],

  quiz: [
    { q: "Khác nhau giữa String và String? trong bytecode JVM là gì?", options: [
        "Hai class khác nhau", "Cùng là java.lang.String; khác biệt nằm ở kiểu lúc compile (và annotation)", "String? là Optional<String>", "String? dùng boxing"
      ], correct: 1, explanation: "Null safety là tính năng của compiler, không tốn wrapper object như Optional." },
    { q: "val n: String? = null; val x = n?.length ?: -1. x bằng?", options: [
        "null", "0", "-1", "Ném NPE"
      ], correct: 2, explanation: "n?.length là null, Elvis lấy vế phải." },
    { q: "Khi nào dùng !! là hợp lý nhất?", options: [
        "Mọi khi compiler báo lỗi null",
        "Hiếm khi — khi bất biến đã được đảm bảo ở nơi compiler không thấy, và muốn fail nhanh",
        "Để tăng hiệu năng",
        "Khi gọi code Java"
      ], correct: 1, explanation: "!! ném NPE nếu sai; phần lớn trường hợp nên dùng ?:, ?.let hoặc thiết kế lại kiểu." },
    { q: "val u = user ?: return. Vì sao return đặt được ở vế phải Elvis?", options: [
        "Cú pháp đặc biệt của Elvis",
        "return là biểu thức kiểu Nothing, là kiểu con của mọi kiểu",
        "Compiler bỏ qua",
        "Chỉ được trong hàm Unit"
      ], correct: 1, explanation: "Tương tự với throw." },
    { q: "Vì sao compiler không smart cast một var property sau if (title != null)?", options: [
        "Bug compiler",
        "Property có thể bị thay đổi (thread khác, setter) giữa lúc kiểm tra và lúc dùng",
        "var không bao giờ null",
        "Chỉ smart cast với String"
      ], correct: 1, explanation: "Copy ra val cục bộ hoặc dùng title?.let { }." },
    { q: "Platform type String! là gì?", options: [
        "Kiểu String bắt buộc không null",
        "Kiểu từ Java không có thông tin nullability; Kotlin để lập trình viên tự quyết",
        "Kiểu dành cho Android",
        "Kiểu String mutable"
      ], correct: 1, explanation: "Gán vào String mà Java trả null → NPE tại chỗ gán." },
    { q: "Đọc một lateinit var trước khi gán sẽ thế nào?", options: [
        "Trả null", "Trả giá trị mặc định", "Ném UninitializedPropertyAccessException", "Lỗi compile"
      ], correct: 2, explanation: "Kiểm tra được bằng ::prop.isInitialized." },
    { q: "user as? Admin trả gì nếu user không phải Admin?", options: [
        "Ném ClassCastException", "null", "user", "Lỗi compile"
      ], correct: 1, explanation: "as? là ép kiểu an toàn, kết quả có kiểu Admin?." },
    { q: "Chiến lược tốt nhất với dữ liệu có thể null từ API/DB?", options: [
        "Dùng !! khắp nơi cho gọn",
        "Xử lý null một lần ở biên, chuyển sang model không-null cho phần domain",
        "Khai báo mọi thứ là Any?",
        "Bắt NPE bằng try/catch"
      ], correct: 1, explanation: "Giảm số chỗ phải nghĩ về null và làm lỗi lộ ra sớm ở biên." }
  ]
});
