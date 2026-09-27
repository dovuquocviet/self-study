window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Kotlin cho dev Java",
  title: "Class, property, data class & object",
  subtitle: "Primary constructor · property thay getter/setter · equals/copy tự sinh · object/companion thay static",

  theory: `
    <p><strong>Property</strong> trong Kotlin = field + getter (+ setter nếu <code>var</code>). Khi bạn viết <code>user.name</code> từ Kotlin, thực chất là gọi <code>getName()</code>.
    Không còn phải viết getter/setter tay hay nhờ Lombok.</p>

    <p><strong>Primary constructor</strong> nằm ngay sau tên class: <code>class User(val id: Long, var name: String)</code> vừa khai báo constructor vừa khai báo property.
    Logic khởi tạo đặt trong khối <code>init { }</code>. Class mặc định <code>public final</code>; muốn cho kế thừa dùng <code>open</code>.</p>

    <p><strong>data class</strong> — thay cho POJO/DTO/record: compiler sinh <code>equals()</code>, <code>hashCode()</code>, <code>toString()</code>, <code>componentN()</code> (destructuring)
    và <code>copy()</code> <em>dựa trên các property trong primary constructor</em>. Property khai báo trong thân class không tham gia equals.</p>
    <ul>
      <li><code>copy(name = "B")</code> tạo object mới, giữ nguyên các field khác — nền tảng của cách cập nhật state bất biến trong Compose/ViewModel.</li>
      <li><code>copy</code> là <strong>shallow copy</strong>: list bên trong vẫn là cùng một object.</li>
      <li>So với Java <code>record</code>: tương tự, nhưng data class có thể có <code>var</code>, có <code>copy</code>, và tham số mặc định.</li>
    </ul>

    <p><strong>object</strong> = singleton do ngôn ngữ đảm bảo (khởi tạo lazy, thread-safe khi class được load). <strong>companion object</strong> = object gắn với class,
    thay chỗ của <code>static</code> (factory method, hằng số). <code>const val</code> cho hằng compile-time (inline như <code>static final</code> primitive/String).</p>

    <p><strong>Visibility</strong>: <code>public</code> (mặc định), <code>private</code>, <code>protected</code>, <code>internal</code> (nhìn thấy trong cùng module Gradle — không có "package-private").</p>

    <div class="callout"><p>💡 Với Compose, data class gồm toàn <code>val</code> kiểu bất biến là "stable": Compose so sánh được bằng <code>equals</code> để bỏ qua recomposition (bài 12).
    Một <code>var</code> hay <code>MutableList</code> bên trong là đủ để làm class mất tính ổn định.</p></div>
  `,

  codeTabs: [
    { id: "java", label: "① Java DTO", lines: [
      "public class Product {",
      "    private final long id;",
      "    private String name;",
      "    private long price;",
      "    public Product(long id, String name, long price) { ... }",
      "    public long getId() { return id; }",
      "    public String getName() { return name; }",
      "    public void setName(String n) { this.name = n; }",
      "    // + getPrice, setPrice, equals, hashCode, toString ... (~50 dòng)",
      "}"
    ]},
    { id: "data", label: "② data class", lines: [
      "data class Product(",
      "    val id: Long,",
      "    val name: String,",
      "    val price: Long = 0,",
      "    val tags: List<String> = emptyList()",
      ") {",
      "    init { require(price >= 0) { \"price âm\" } }",
      "    val isFree: Boolean get() = price == 0L   // property tính toán, không có field",
      "}",
      "",
      "val p1 = Product(1, \"Áo\", 200_000)",
      "val p2 = p1.copy(price = 150_000)     // object mới",
      "println(p1 == p2)                     // false — so sánh bằng equals()",
      "val (id, name) = p1                   // destructuring: component1(), component2()"
    ]},
    { id: "prop", label: "③ Property tuỳ biến", lines: [
      "class Counter {",
      "    var count: Int = 0",
      "        private set                   // đọc public, ghi chỉ trong class",
      "",
      "    var label: String = \"\"",
      "        set(value) { field = value.trim() }   // field = backing field",
      "",
      "    fun inc() { count++ }",
      "}"
    ]},
    { id: "obj", label: "④ object / companion", lines: [
      "object AppClock {                       // singleton",
      "    fun now(): Long = System.currentTimeMillis()",
      "}",
      "",
      "class User private constructor(val email: String) {",
      "    companion object {",
      "        const val MAX_LEN = 254",
      "        fun of(raw: String): User? =",
      "            raw.trim().lowercase().takeIf { it.contains('@') && it.length <= MAX_LEN }?.let { User(it) }",
      "    }",
      "}",
      "",
      "val u = User.of(\" An@Shop.vn \")          // gọi như static factory"
    ]}
  ],

  stageHtml: `
    <div class="node" id="decl"><div class="nl">📝 data class Product(val id, val name, val price)</div><div class="ns">1 dòng khai báo</div></div>
    <div class="arrow" id="a1">↓ compiler sinh</div>
    <div class="row">
      <div class="node" id="acc"><div class="nl">getId() getName()</div><div class="ns">property accessor</div></div>
      <div class="node" id="eq"><div class="nl">equals / hashCode / toString</div><div class="ns">theo tham số constructor</div></div>
      <div class="node" id="cp"><div class="nl">copy() · componentN()</div><div class="ns">cập nhật bất biến</div></div>
    </div>
    <div class="arrow" id="a2">↓ dùng như singleton / static</div>
    <div class="node" id="obj"><div class="nl">object · companion object</div><div class="ns">thay cho static & Singleton pattern</div></div>
  `,
  steps: [
    { title: "1 · DTO kiểu Java", tab: "java", highlight: [1, 6, 7, 8, 9], on: ["decl"],
      desc: "Rất nhiều code lặp chỉ để mô tả 3 field." },
    { title: "2 · data class", tab: "data", highlight: [1, 2, 3, 4, 5], on: ["decl", "a1", "acc", "eq"],
      desc: "Tham số <code>val</code> trong primary constructor thành property. equals/hashCode/toString dựa trên đúng các tham số này." },
    { title: "3 · copy & so sánh", tab: "data", highlight: [11, 12, 13, 14], on: ["cp"],
      desc: "<code>copy</code> tạo object mới, chỉ đổi field chỉ định. <code>==</code> trong Kotlin gọi <code>equals</code>; so sánh tham chiếu là <code>===</code>." },
    { title: "4 · Property tính toán & init", tab: "data", highlight: [7, 8], on: ["acc"],
      desc: "<code>init</code> chạy trong constructor. <code>isFree</code> có getter nhưng không có field, không tham gia equals." },
    { title: "5 · Tuỳ biến getter/setter", tab: "prop", highlight: [3, 6], on: ["acc"],
      desc: "<code>private set</code> cho phép đọc công khai nhưng chỉ sửa bên trong; <code>field</code> là backing field." },
    { title: "6 · object & companion", tab: "obj", highlight: [1, 6, 7, 8, 13], on: ["a2", "obj"],
      desc: "object là singleton; companion chứa factory và hằng số, gọi qua tên class như static." }
  ],

  quiz: [
    { q: "data class Product(val id: Long) { var note = \"\" } — hai object cùng id, note khác nhau, == trả gì?", options: [
        "false", "true — note không nằm trong primary constructor nên không tham gia equals", "Lỗi compile", "Tuỳ hashCode"
      ], correct: 1, explanation: "Compiler chỉ dùng tham số primary constructor." },
    { q: "p.copy(price = 1) làm gì?", options: [
        "Sửa price của p", "Tạo object mới giống p, chỉ khác price", "Deep copy toàn bộ cây object", "Clone qua Serializable"
      ], correct: 1, explanation: "Copy nông: các tham chiếu bên trong (list...) được dùng chung." },
    { q: "Trong Kotlin, a == b và a === b khác nhau thế nào?", options: [
        "Giống nhau", "== gọi equals (an toàn null); === so sánh tham chiếu", "== so tham chiếu; === gọi equals", "=== chỉ cho số"
      ], correct: 1, explanation: "Ngược với thói quen Java, nơi == là so tham chiếu." },
    { q: "Viết user.name trong Kotlin với class có property name. Ở bytecode là gì?", options: [
        "Truy cập field public trực tiếp", "Gọi getName()", "Reflection", "Gọi name()"
      ], correct: 1, explanation: "Property public được truy cập qua accessor." },
    { q: "var count = 0 kèm private set nghĩa là?", options: [
        "count chỉ đọc được trong class", "Đọc ở mọi nơi, chỉ gán được trong class", "count là hằng", "count không có setter"
      ], correct: 1, explanation: "Mẫu thường gặp để lộ trạng thái chỉ-đọc." },
    { q: "Thay cho static method trong Java, Kotlin dùng gì?", options: [
        "Không có cách", "Hàm top-level hoặc companion object", "Annotation @Static", "interface default"
      ], correct: 1, explanation: "Cần Java thấy static thật thì thêm @JvmStatic." },
    { q: "object AppClock { } được khởi tạo khi nào?", options: [
        "Mỗi lần gọi", "Lần đầu được truy cập (lazy), thread-safe", "Lúc app khởi động luôn", "Phải gọi init thủ công"
      ], correct: 1, explanation: "Dựa trên cơ chế class initialization của JVM." },
    { q: "Visibility internal trong Kotlin là gì?", options: [
        "Giống package-private Java", "Nhìn thấy trong cùng module (Gradle module)", "Chỉ trong file", "Chỉ trong class con"
      ], correct: 1, explanation: "Kotlin không có package-private." },
    { q: "Vì sao data class toàn val kiểu bất biến có lợi cho Compose?", options: [
        "Chạy nhanh hơn trên GPU",
        "Compose coi là stable, so sánh bằng equals để bỏ qua recomposition khi không đổi",
        "Bắt buộc phải vậy mới compile",
        "Tự lưu vào DB"
      ], correct: 1, explanation: "Sẽ học ở bài recomposition." }
  ]
});
