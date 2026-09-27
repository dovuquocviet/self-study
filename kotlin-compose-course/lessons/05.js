window.LESSONS.push({
  id: "05",
  phase: "0", phaseName: "Kotlin cho dev Java",
  title: "Lambda, extension function & lambda có receiver (nền của DSL)",
  subtitle: "Kiểu hàm (A) -> B · trailing lambda · extension là static method · inline/reified · T.() -> Unit",

  theory: `
    <p>Compose và Gradle Kotlin DSL trông như "ngôn ngữ riêng", nhưng thực ra chỉ là 3 tính năng Kotlin ghép lại. Hiểu 3 cái này, đọc code Compose sẽ hết "ma thuật".</p>

    <p><strong>1. Kiểu hàm & trailing lambda</strong></p>
    <ul>
      <li>Kiểu hàm là kiểu hạng nhất: <code>(Int, Int) -&gt; Int</code>, <code>() -&gt; Unit</code>. Không cần interface như <code>Function&lt;T,R&gt;</code>/<code>Runnable</code> của Java.</li>
      <li>Nếu tham số <strong>cuối cùng</strong> là lambda, được đặt lambda ra ngoài ngoặc: <code>button(text = "OK") { ... }</code>. Nếu chỉ có lambda, bỏ luôn ngoặc: <code>run { ... }</code>.</li>
      <li>Lambda một tham số có tên ngầm <code>it</code>. Giá trị của biểu thức cuối là giá trị trả về của lambda (không viết <code>return</code>).</li>
    </ul>

    <p><strong>2. Extension function</strong>: <code>fun String.toSlug(): String</code> — "thêm" hàm vào class có sẵn mà không sửa/kế thừa nó.
    Cơ chế: compiler biên dịch thành <em>static method</em> nhận receiver làm tham số đầu tiên: <code>toSlug(String $this)</code>. Vì vậy extension
    <strong>được phân giải tĩnh</strong> theo kiểu khai báo, không đa hình, và không đọc được member <code>private</code>.</p>

    <p><strong>3. Lambda có receiver</strong> <code>T.() -&gt; Unit</code>: bên trong lambda, <code>this</code> là một đối tượng T, gọi thẳng method của T không cần tiền tố.
    Đó là cách <code>apply { }</code>, <code>buildString { }</code>, khối <code>android { }</code> trong Gradle, và <code>LazyColumn { items(...) }</code> trong Compose hoạt động
    (bên trong khối là <code>LazyListScope</code>).</p>

    <p><strong>inline</strong>: mỗi lambda bình thường là một object (cấp phát). Hàm <code>inline</code> được chép thân vào chỗ gọi, lambda cũng được chép — không cấp phát,
    và cho phép <code>return</code> từ hàm bao ngoài trong lambda (non-local return). <code>reified</code> (chỉ với inline) giữ lại kiểu generic lúc runtime:
    <code>inline fun &lt;reified T&gt; Gson.fromJson(s: String): T</code> — thứ Java không làm được vì type erasure.</p>

    <div class="callout"><p>💡 So với Java: lambda Java chỉ gán được cho <em>functional interface</em>; Kotlin có kiểu hàm thật, và vẫn chuyển được lambda cho interface Java
    (SAM conversion) như <code>executor.execute { ... }</code>. Lambda Kotlin được sửa biến <code>var</code> bên ngoài (Java bắt "effectively final").</p></div>
  `,

  codeTabs: [
    { id: "hof", label: "① Hàm bậc cao", lines: [
      "fun <T> retry(times: Int = 3, block: () -> T): T {",
      "    var last: Exception? = null",
      "    repeat(times) {",
      "        try { return block() } catch (e: Exception) { last = e }",
      "    }",
      "    throw last!!",
      "}",
      "",
      "val price = retry(times = 2) {      // trailing lambda",
      "    api.fetchPrice(\"SKU-1\")          // biểu thức cuối = giá trị trả về",
      "}"
    ]},
    { id: "ext", label: "② Extension function", lines: [
      "fun String.toSlug(): String =",
      "    lowercase().trim().replace(Regex(\"[^a-z0-9]+\"), \"-\")",
      "",
      "\"Áo Thun Nam 2024\".toSlug()     // gọi như method",
      "",
      "// Bytecode ≈ Java:",
      "// public static String toSlug(String $this$toSlug) { ... }",
      "",
      "val Int.vnd: String get() = \"%,d đ\".format(this)   // extension property",
      "println(150000.vnd)             // 150,000 đ"
    ]},
    { id: "recv", label: "③ Lambda có receiver", lines: [
      "class HtmlBuilder { private val sb = StringBuilder()",
      "    fun h1(text: String) { sb.append(\"<h1>\").append(text).append(\"</h1>\") }",
      "    fun p(text: String) { sb.append(\"<p>\").append(text).append(\"</p>\") }",
      "    override fun toString() = sb.toString()",
      "}",
      "",
      "fun html(block: HtmlBuilder.() -> Unit): String =",
      "    HtmlBuilder().apply(block).toString()",
      "",
      "val page = html {        // this = HtmlBuilder",
      "    h1(\"Giỏ hàng\")      // = this.h1(...)",
      "    p(\"3 sản phẩm\")",
      "}"
    ]},
    { id: "dsl", label: "④ Nhận ra DSL thật", lines: [
      "// build.gradle.kts — android { } là hàm nhận lambda có receiver",
      "android {",
      "    namespace = \"vn.shop.app\"",
      "    compileSdk = 35",
      "}",
      "",
      "// Compose — content là lambda có receiver LazyListScope",
      "LazyColumn {",
      "    items(products) { p -> ProductRow(p) }",
      "}"
    ]},
    { id: "inline", label: "⑤ inline & reified", lines: [
      "inline fun <reified T> Json.decodeOrNull(s: String): T? =",
      "    runCatching { decodeFromString<T>(s) }.getOrNull()",
      "",
      "val u = Json.decodeOrNull<User>(body)   // T = User có mặt lúc runtime",
      "",
      "fun firstPaid(orders: List<Order>): Order? {",
      "    orders.forEach { if (it.paid) return it }  // forEach là inline → return thoát khỏi firstPaid",
      "    return null",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ft"><div class="nl">λ Kiểu hàm</div><div class="ns">() -&gt; T, trailing lambda</div></div>
      <div class="node" id="ex"><div class="nl">➕ Extension</div><div class="ns">static method + receiver</div></div>
      <div class="node" id="rc"><div class="nl">🎯 Receiver lambda</div><div class="ns">T.() -&gt; Unit</div></div>
    </div>
    <div class="arrow" id="a1">↓ ghép lại</div>
    <div class="node" id="dsl"><div class="nl">🧱 DSL: Gradle kts, Compose, Ktor</div><div class="ns">trông như ngôn ngữ riêng, thực ra là hàm</div></div>
    <div class="arrow" id="a2">↓ inline</div>
    <div class="node" id="inl"><div class="nl">⚡ Chép thân vào chỗ gọi</div><div class="ns">không cấp phát lambda · reified T</div></div>
  `,
  steps: [
    { title: "1 · Hàm nhận hàm", tab: "hof", highlight: [1, 4, 9, 10], on: ["ft"],
      desc: "<code>block: () -&gt; T</code> là kiểu hàm. Gọi với trailing lambda; biểu thức cuối trong lambda là giá trị trả về." },
    { title: "2 · Extension function", tab: "ext", highlight: [1, 4, 7], on: ["ex"],
      desc: "Trông như method của String nhưng thực chất là static method. Không đọc được private của String, không override được." },
    { title: "3 · Lambda có receiver", tab: "recv", highlight: [7, 8, 10, 11], on: ["rc"],
      desc: "Trong khối <code>html { }</code>, <code>this</code> là HtmlBuilder nên gọi <code>h1()</code> trực tiếp." },
    { title: "4 · Nhận ra các DSL quen mặt", tab: "dsl", highlight: [2, 3, 8, 9], on: ["a1", "dsl"],
      desc: "<code>android { }</code> và <code>LazyColumn { items() }</code> đều là hàm có tham số cuối kiểu <code>X.() -&gt; Unit</code>." },
    { title: "5 · inline & reified", tab: "inline", highlight: [1, 4, 7], on: ["a2", "inl"],
      desc: "inline chép thân hàm và lambda vào chỗ gọi: không cấp phát, cho phép non-local return, và reified giữ kiểu T lúc runtime." }
  ],

  quiz: [
    { q: "fun String.toSlug() được biên dịch thành gì?", options: [
        "Method mới chèn vào class String", "Static method nhận String làm tham số đầu", "Class con của String", "Proxy động"
      ], correct: 1, explanation: "Vì vậy extension không đọc được private và không đa hình." },
    { q: "Extension function được phân giải thế nào khi biến có kiểu khai báo Base nhưng object thực là Derived (cả hai có extension cùng tên)?", options: [
        "Theo kiểu runtime (Derived)", "Theo kiểu khai báo (Base) — phân giải tĩnh", "Lỗi compile", "Ngẫu nhiên"
      ], correct: 1, explanation: "Extension không phải virtual method." },
    { q: "Trong html { h1(\"x\") } với tham số block: HtmlBuilder.() -> Unit, h1 được gọi trên đối tượng nào?", options: [
        "Một biến toàn cục", "this — đối tượng HtmlBuilder làm receiver của lambda", "it", "Lớp companion"
      ], correct: 1, explanation: "Lambda có receiver cho phép gọi member không cần tiền tố." },
    { q: "Trailing lambda là gì?", options: [
        "Lambda chạy sau cùng", "Nếu tham số cuối là hàm, lambda được viết ngoài dấu ngoặc", "Lambda không có tham số", "Lambda async"
      ], correct: 1, explanation: "Đó là lý do Column { } hay retry { } trông như khối lệnh." },
    { q: "Lợi ích chính của inline cho hàm nhận lambda?", options: [
        "Code ngắn hơn", "Tránh cấp phát object lambda và cho phép non-local return", "Chạy trên thread khác", "Tự động cache"
      ], correct: 1, explanation: "Thân hàm và lambda được chép vào nơi gọi." },
    { q: "reified T cho phép gì mà Java generic không làm được?", options: [
        "Generic với primitive", "Dùng T như kiểu thật lúc runtime (T::class, is T)", "Kế thừa nhiều generic", "Generic trên static"
      ], correct: 1, explanation: "Chỉ dùng được trong hàm inline vì kiểu được chép vào chỗ gọi." },
    { q: "Trong lambda một tham số, tên ngầm của tham số là?", options: [
        "this", "it", "self", "arg"
      ], correct: 1, explanation: "Có thể đặt tên rõ: { p -> ... }." },
    { q: "Khối android { ... } trong build.gradle.kts thực chất là?", options: [
        "Cú pháp riêng của Gradle, không phải Kotlin",
        "Gọi hàm android nhận lambda có receiver (extension của Project)",
        "File XML",
        "Annotation"
      ], correct: 1, explanation: "Gradle Kotlin DSL là Kotlin thật, có autocomplete và kiểm tra kiểu." },
    { q: "Lambda Kotlin có sửa được biến var bên ngoài không?", options: [
        "Không, như Java", "Có — compiler bọc biến vào một Ref object", "Chỉ trong inline", "Chỉ với val"
      ], correct: 1, explanation: "Java yêu cầu effectively final; Kotlin tự bọc (với lambda không-inline dùng IntRef/ObjectRef...)." }
  ]
});
