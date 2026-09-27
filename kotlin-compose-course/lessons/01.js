window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Kotlin cho dev Java",
  title: "Kotlin chạy thế nào — và khác Java ở những chỗ nào",
  subtitle: "Cùng JVM bytecode · val/var · suy luận kiểu · hàm top-level · không checked exception",

  theory: `
    <p>Kotlin <strong>không phải máy ảo mới</strong>. Trên Android/JVM, <code>kotlinc</code> biên dịch <code>.kt</code> ra <code>.class</code> (bytecode JVM) y như <code>javac</code>;
    trên Android, bytecode đó lại được D8/R8 chuyển sang DEX để chạy trên ART. Vì vậy Kotlin gọi Java và Java gọi Kotlin trực tiếp, dùng chung Spring, Jackson, OkHttp...
    Thứ Kotlin thêm vào là <em>compiler thông minh hơn</em> + một thư viện nhỏ <code>kotlin-stdlib</code>.</p>

    <table>
      <tr><th>Java</th><th>Kotlin</th><th>Ghi chú cơ chế</th></tr>
      <tr><td><code>final String name = "A";</code></td><td><code>val name = "A"</code></td><td><code>val</code> = tham chiếu không gán lại (như final), kiểu được <strong>suy luận lúc compile</strong> — vẫn là kiểu tĩnh</td></tr>
      <tr><td><code>int count = 0;</code></td><td><code>var count = 0</code></td><td>Không có kiểu nguyên thuỷ trong cú pháp; compiler tự dùng <code>int</code> khi được, <code>Integer</code> khi nullable/generic</td></tr>
      <tr><td><code>public static</code> trong class Utils</td><td>hàm <strong>top-level</strong> trong file</td><td>Compile thành static method của class <code>TênFileKt</code></td></tr>
      <tr><td><code>throws IOException</code></td><td>không có</td><td>Kotlin <strong>không có checked exception</strong>; mọi exception đều như RuntimeException</td></tr>
      <tr><td>class mặc định mở, override tuỳ ý</td><td>class/hàm mặc định <code>final</code></td><td>Muốn kế thừa phải <code>open</code>. (Spring cần plugin <code>kotlin-spring</code>/all-open để proxy được)</td></tr>
      <tr><td><code>switch</code></td><td><code>when</code></td><td><code>when</code> là <strong>biểu thức</strong>, trả giá trị được</td></tr>
      <tr><td><code>"Hi " + name</code></td><td>string template <code>"Hi $name"</code></td><td>Compile thành StringBuilder/concat như Java</td></tr>
    </table>

    <p><strong>Mọi thứ là biểu thức nhiều hơn</strong>: <code>if</code>, <code>when</code>, <code>try</code> đều trả giá trị, nên không cần toán tử <code>? :</code> của Java.
    Hàm một dòng viết <code>fun sq(x: Int) = x * x</code>. Tham số có <strong>giá trị mặc định</strong> và <strong>gọi theo tên</strong>, thay cho overload/Builder pattern.</p>

    <p><strong>Kiểu nằm sau tên</strong>: <code>fun find(id: Long): User</code>. Kiểu trả về <code>Unit</code> ≈ <code>void</code> (nhưng là một object thật). Kiểu <code>Nothing</code> là kiểu của biểu thức không bao giờ trả về (vd <code>throw</code>, <code>TODO()</code>).</p>

    <div class="callout"><p>💡 "Suy luận kiểu" không phải dynamic typing. <code>val x = 1</code> thì x là <code>Int</code> mãi mãi; gán <code>x = "a"</code> là lỗi compile.
    Muốn biết Kotlin sinh ra gì, trong Android Studio/IntelliJ: <em>Tools → Kotlin → Show Kotlin Bytecode → Decompile</em> — thói quen tốt để hiểu cơ chế.</p></div>
  `,

  codeTabs: [
    { id: "java", label: "① Java quen thuộc", lines: [
      "public final class PriceUtils {",
      "    private PriceUtils() {}",
      "    public static String format(long cents, String currency) {",
      "        String sign = cents < 0 ? \"-\" : \"\";",
      "        return sign + Math.abs(cents) / 100 + \" \" + currency;",
      "    }",
      "    public static String format(long cents) {   // overload cho default",
      "        return format(cents, \"VND\");",
      "    }",
      "}"
    ]},
    { id: "kt", label: "② Kotlin tương đương", lines: [
      "// file PriceUtils.kt — không cần class",
      "fun format(cents: Long, currency: String = \"VND\"): String {",
      "    val sign = if (cents < 0) \"-\" else \"\"      // if là biểu thức",
      "    return \"$sign${Math.abs(cents) / 100} $currency\"",
      "}",
      "",
      "fun main() {",
      "    println(format(150000))                      // dùng default",
      "    println(format(currency = \"USD\", cents = -500)) // gọi theo tên",
      "}"
    ]},
    { id: "bytecode", label: "③ Compiler sinh ra", lines: [
      "// Decompile PriceUtilsKt.class (rút gọn)",
      "public final class PriceUtilsKt {",
      "   @NotNull",
      "   public static final String format(long cents, @NotNull String currency) {",
      "      Intrinsics.checkNotNullParameter(currency, \"currency\");",
      "      ...",
      "   }",
      "   // hàm phụ sinh cho tham số mặc định (mask bit đánh dấu tham số bị bỏ)",
      "   public static String format$default(long c, String cur, int mask, Object o) { ... }",
      "}"
    ]},
    { id: "when", label: "④ when / try là biểu thức", lines: [
      "fun httpLabel(code: Int): String = when (code) {",
      "    200, 201 -> \"OK\"",
      "    in 400..499 -> \"Lỗi client\"",
      "    in 500..599 -> \"Lỗi server\"",
      "    else -> \"Khác\"",
      "}",
      "",
      "val port: Int = try { System.getenv(\"PORT\").toInt() } catch (e: Exception) { 8080 }",
      "",
      "fun fail(msg: String): Nothing = throw IllegalStateException(msg)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="src-kt"><div class="nl">📄 PriceUtils.kt</div><div class="ns">Kotlin source</div></div>
      <div class="node" id="src-java"><div class="nl">📄 Legacy.java</div><div class="ns">Java source</div></div>
    </div>
    <div class="arrow" id="a1">↓ kotlinc / javac</div>
    <div class="node" id="cls"><div class="nl">📦 .class (JVM bytecode)</div><div class="ns">PriceUtilsKt.format(...) là static method</div></div>
    <div class="arrow" id="a2">↓ D8/R8 (Android)</div>
    <div class="node" id="dex"><div class="nl">🤖 classes.dex → ART</div><div class="ns">hoặc chạy thẳng trên JVM (backend)</div></div>
  `,
  steps: [
    { title: "1 · Code Java quen thuộc", tab: "java", highlight: [1, 3, 7, 8], on: ["src-java"],
      desc: "Class tiện ích chỉ để chứa static method, và phải overload để giả lập tham số mặc định." },
    { title: "2 · Viết lại bằng Kotlin", tab: "kt", highlight: [2, 3, 4], on: ["src-kt"],
      desc: "Hàm top-level, tham số mặc định, <code>if</code> trả giá trị, string template." },
    { title: "3 · Gọi theo tên", tab: "kt", highlight: [8, 9], on: ["src-kt"],
      desc: "Gọi theo tên cho phép đổi thứ tự và bỏ bớt tham số — thay Builder pattern trong nhiều trường hợp." },
    { title: "4 · Compiler sinh bytecode", tab: "bytecode", highlight: [2, 4, 5, 9], on: ["a1", "cls"],
      desc: "File <code>PriceUtils.kt</code> thành class <code>PriceUtilsKt</code>. Compiler tự chèn kiểm tra null cho tham số public và sinh hàm <code>format$default</code> để xử lý tham số mặc định." },
    { title: "5 · Chạy trên ART hoặc JVM", tab: "when", highlight: [1, 3, 8, 10], on: ["a2", "dex"],
      desc: "Cùng bytecode nên dùng chung thư viện Java. <code>when</code>/<code>try</code> là biểu thức; <code>Nothing</code> báo cho compiler biết hàm không bao giờ trả về." }
  ],

  quiz: [
    { q: "Kotlin trên Android được thực thi thế nào?", options: [
        "Bằng một máy ảo Kotlin riêng",
        "Biên dịch ra bytecode JVM, rồi D8/R8 chuyển sang DEX chạy trên ART",
        "Thông dịch từng dòng lúc runtime",
        "Biên dịch sang JavaScript"
      ], correct: 1, explanation: "Kotlin/JVM sinh .class giống Java; pipeline Android phía sau không đổi." },
    { q: "val x = 10 rồi x = 20. Kết quả?", options: [
        "Chạy được, x = 20", "Lỗi compile: val không gán lại được", "Lỗi runtime", "x thành kiểu Any"
      ], correct: 1, explanation: "val tương đương biến final." },
    { q: "var s = \"a\" rồi s = 5. Kết quả?", options: [
        "Chạy được vì Kotlin là dynamic", "Lỗi compile: s có kiểu String đã suy luận", "s tự thành Any", "Lỗi runtime ClassCastException"
      ], correct: 1, explanation: "Suy luận kiểu vẫn là kiểu tĩnh." },
    { q: "Hàm top-level fun format() trong file PriceUtils.kt được gọi từ Java thế nào?", options: [
        "new PriceUtils().format()", "PriceUtilsKt.format()", "Không gọi được từ Java", "Kotlin.format()"
      ], correct: 1, explanation: "Compiler tạo class TênFileKt chứa static method (đổi tên được bằng @file:JvmName)." },
    { q: "Kotlin xử lý checked exception thế nào?", options: [
        "Giống Java, phải khai báo throws",
        "Không có checked exception — không bắt buộc catch hay khai báo",
        "Cấm dùng exception",
        "Chỉ cho phép RuntimeException"
      ], correct: 1, explanation: "Có thể dùng @Throws khi cần Java caller thấy throws." },
    { q: "Vì sao Spring + Kotlin cần plugin kotlin-spring (all-open)?", options: [
        "Để bật coroutine",
        "Class Kotlin mặc định final nên CGLIB không tạo proxy subclass được",
        "Để dùng data class",
        "Để bỏ checked exception"
      ], correct: 1, explanation: "Plugin tự mở (open) các class có annotation như @Component, @Transactional." },
    { q: "Kiểu Nothing dùng cho gì?", options: [
        "Giống void", "Biểu thức/hàm không bao giờ trả về bình thường (throw, vòng lặp vô hạn)", "Giá trị null", "Kiểu cha của mọi kiểu"
      ], correct: 1, explanation: "Unit mới giống void; Nothing là kiểu con của mọi kiểu nên throw dùng được ở mọi vị trí biểu thức." },
    { q: "Thay cho nhiều overload giả lập tham số tuỳ chọn, Kotlin dùng gì?", options: [
        "Varargs", "Tham số mặc định + gọi theo tên", "Annotation @Optional", "Builder bắt buộc"
      ], correct: 1, explanation: "Muốn Java thấy các overload thì thêm @JvmOverloads." },
    { q: "Giá trị của when (404) { in 400..499 -> \"A\"; else -> \"B\" }?", options: [
        "\"A\"", "\"B\"", "Lỗi compile", "null"
      ], correct: 0, explanation: "when là biểu thức; nhánh range khớp đầu tiên được chọn." }
  ]
});
