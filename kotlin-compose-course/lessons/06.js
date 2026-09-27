window.LESSONS.push({
  id: "06",
  phase: "0", phaseName: "Kotlin cho dev Java",
  title: "Scope functions & collections",
  subtitle: "let/run/with/apply/also · List vs MutableList · map/filter/groupBy · Sequence lười",

  theory: `
    <p><strong>Scope functions</strong> là 5 hàm inline trong stdlib, khác nhau đúng 2 điểm: trong khối, đối tượng gọi là <code>this</code> hay <code>it</code>;
    và hàm trả về <em>chính đối tượng</em> hay <em>kết quả của lambda</em>.</p>
    <table>
      <tr><th>Hàm</th><th>Đối tượng trong khối</th><th>Trả về</th><th>Dùng khi</th></tr>
      <tr><td><code>let</code></td><td><code>it</code></td><td>kết quả lambda</td><td><code>x?.let { }</code> xử lý khi khác null; biến đổi giá trị</td></tr>
      <tr><td><code>run</code></td><td><code>this</code></td><td>kết quả lambda</td><td>Tính toán dùng nhiều member của đối tượng</td></tr>
      <tr><td><code>with(x)</code></td><td><code>this</code></td><td>kết quả lambda</td><td>Như run nhưng không phải extension</td></tr>
      <tr><td><code>apply</code></td><td><code>this</code></td><td>chính đối tượng</td><td>Cấu hình object vừa tạo (thay builder)</td></tr>
      <tr><td><code>also</code></td><td><code>it</code></td><td>chính đối tượng</td><td>Tác dụng phụ: log, validate, rồi đi tiếp</td></tr>
    </table>
    <p>Đừng lồng nhiều scope function — <code>it</code> trong <code>it</code> khó đọc hơn một câu <code>if</code>.</p>

    <p><strong>Collections: đọc-chỉ vs sửa được</strong>. <code>List&lt;T&gt;</code> là interface <em>chỉ-đọc</em> (không có add/remove); <code>MutableList&lt;T&gt;</code> mới sửa được.
    Ở runtime cả hai thường là <code>java.util.ArrayList</code> — "chỉ đọc" là hợp đồng của kiểu, không phải bất biến thật (người giữ tham chiếu MutableList vẫn sửa được).
    Tạo bằng <code>listOf</code>, <code>mutableListOf</code>, <code>mapOf("a" to 1)</code>, <code>setOf</code>, <code>buildList { add(..) }</code>.</p>

    <p><strong>Toán tử</strong>: <code>map</code>, <code>filter</code>, <code>first/firstOrNull</code>, <code>sumOf</code>, <code>groupBy</code>, <code>associateBy</code>, <code>partition</code>,
    <code>sortedBy</code>, <code>distinctBy</code>, <code>chunked</code>, <code>zip</code>... Giống Stream API nhưng chạy thẳng trên collection, không cần <code>.stream()</code>/<code>collect()</code>.</p>

    <p><strong>Háo (eager) vs lười (lazy)</strong>: trên <code>List</code>, mỗi bước <code>map</code>/<code>filter</code> tạo <em>một list trung gian mới</em>.
    <code>asSequence()</code> chuyển sang xử lý lười từng phần tử qua cả chuỗi (giống Java Stream), dừng sớm được với <code>first()</code>/<code>take()</code>.
    Dùng Sequence khi dữ liệu lớn hoặc chuỗi dài có bước dừng sớm; với list nhỏ, List thường nhanh hơn.</p>

    <div class="callout"><p>💡 Trong Compose/StateFlow, bạn thường <strong>thay</strong> cả list chứ không sửa tại chỗ: <code>items = items + newItem</code> tạo list mới,
    nên hệ thống nhận ra thay đổi. Sửa một <code>MutableList</code> tại chỗ thì tham chiếu không đổi → UI không biết để vẽ lại.</p></div>
  `,

  codeTabs: [
    { id: "scope", label: "① 5 scope functions", lines: [
      "val req = Request.Builder().apply {        // this = builder, trả builder",
      "    url(\"https://api.shop.vn/orders\")",
      "    header(\"Accept\", \"application/json\")",
      "}.build()",
      "",
      "val len = user.nickname?.let { it.trim().length } ?: 0   // chỉ chạy khi khác null",
      "",
      "val order = repo.save(draft).also { log.info(\"saved ${it.id}\") }  // log rồi trả order",
      "",
      "val total = cart.run { items.sumOf { it.price * it.qty } - discount }  // this = cart"
    ]},
    { id: "coll", label: "② Toán tử collection", lines: [
      "data class Order(val id: Long, val shop: String, val total: Long, val paid: Boolean)",
      "",
      "val paidByShop: Map<String, Long> = orders",
      "    .filter { it.paid }",
      "    .groupBy { it.shop }",
      "    .mapValues { (_, list) -> list.sumOf { it.total } }",
      "",
      "val byId: Map<Long, Order> = orders.associateBy { it.id }",
      "val (paid, unpaid) = orders.partition { it.paid }",
      "val top3 = orders.sortedByDescending { it.total }.take(3)"
    ]},
    { id: "java", label: "③ So với Java Stream", lines: [
      "// Java",
      "Map<String, Long> paidByShop = orders.stream()",
      "    .filter(Order::isPaid)",
      "    .collect(Collectors.groupingBy(Order::getShop,",
      "             Collectors.summingLong(Order::getTotal)));",
      "",
      "// Kotlin: không stream()/collect(), mỗi bước trả collection thật",
      "val paidByShop = orders.filter { it.paid }.groupBy { it.shop }",
      "    .mapValues { e -> e.value.sumOf { it.total } }"
    ]},
    { id: "seq", label: "④ List vs Sequence", lines: [
      "// Eager: map chạy trên CẢ 1 triệu phần tử, tạo 2 list trung gian",
      "val a = bigList.map { expensive(it) }.filter { it > 0 }.first()",
      "",
      "// Lazy: từng phần tử đi qua map → filter, dừng ngay khi gặp phần tử đầu thoả",
      "val b = bigList.asSequence().map { expensive(it) }.filter { it > 0 }.first()",
      "",
      "val ro: List<Int> = mutableListOf(1, 2)",
      "// ro.add(3)  ❌ không có add trên List",
      "(ro as MutableList).add(3)   // ⚠️ vẫn chạy: List chỉ là 'view' chỉ-đọc"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="self"><div class="nl">Trả chính đối tượng</div><div class="ns">apply (this) · also (it)</div></div>
      <div class="node" id="res"><div class="nl">Trả kết quả lambda</div><div class="ns">let (it) · run/with (this)</div></div>
    </div>
    <div class="arrow" id="a1">↓ dữ liệu</div>
    <div class="node" id="list"><div class="nl">📋 List (eager)</div><div class="ns">mỗi bước tạo list mới</div></div>
    <div class="node" id="seq"><div class="nl">🔁 Sequence (lazy)</div><div class="ns">từng phần tử qua cả chuỗi, dừng sớm</div></div>
  `,
  steps: [
    { title: "1 · apply: cấu hình object", tab: "scope", highlight: [1, 2, 3, 4], on: ["self"],
      desc: "Trong khối, <code>this</code> là builder; apply trả lại chính builder nên nối <code>.build()</code> được." },
    { title: "2 · let với null, also để log", tab: "scope", highlight: [6, 8], on: ["res", "self"],
      desc: "<code>?.let</code> chỉ chạy khi khác null và trả kết quả lambda. <code>also</code> làm tác dụng phụ rồi trả nguyên object." },
    { title: "3 · run: tính toán trên object", tab: "scope", highlight: [10], on: ["res"],
      desc: "<code>this</code> là cart; trả kết quả biểu thức cuối." },
    { title: "4 · Chuỗi toán tử collection", tab: "coll", highlight: [3, 4, 5, 6, 8, 9], on: ["a1", "list"],
      desc: "filter → groupBy → mapValues. Mỗi bước tạo collection mới (eager)." },
    { title: "5 · So với Java Stream", tab: "java", highlight: [2, 4, 8], on: ["list"],
      desc: "Cùng ý tưởng, ít nghi thức hơn: không cần stream()/Collectors." },
    { title: "6 · Khi nào dùng Sequence", tab: "seq", highlight: [2, 5, 9], on: ["seq"],
      desc: "Sequence xử lý lười, dừng ở phần tử đầu thoả điều kiện. Và nhớ: List chỉ-đọc không phải bất biến thật." }
  ],

  quiz: [
    { q: "Hàm nào trả về chính đối tượng và dùng this trong khối?", options: [
        "let", "also", "apply", "run"
      ], correct: 2, explanation: "apply: this + trả đối tượng; also: it + trả đối tượng." },
    { q: "user?.let { send(it) } — send được gọi khi nào?", options: [
        "Luôn luôn", "Chỉ khi user khác null", "Chỉ khi user null", "Không bao giờ"
      ], correct: 1, explanation: "?. làm cả lời gọi let bị bỏ qua khi null." },
    { q: "val x = listOf(1,2).also { println(it) }. x là?", options: [
        "Unit", "listOf(1,2)", "kết quả println", "null"
      ], correct: 1, explanation: "also trả chính đối tượng." },
    { q: "val n = \"abc\".run { length * 2 }. n bằng?", options: [
        "\"abc\"", "6", "3", "Unit"
      ], correct: 1, explanation: "run trả kết quả biểu thức cuối; this là chuỗi." },
    { q: "List<T> trong Kotlin có đảm bảo bất biến không?", options: [
        "Có, như ImmutableList của Guava",
        "Không — chỉ là interface chỉ-đọc; object bên dưới có thể là ArrayList bị sửa qua tham chiếu khác",
        "Có, JVM chặn sửa",
        "Chỉ khi dùng val"
      ], correct: 1, explanation: "val chỉ khoá tham chiếu, không khoá nội dung." },
    { q: "orders.map { }.filter { }.first() trên List làm gì với phần tử?", options: [
        "Xử lý lười, dừng sớm", "map toàn bộ list, filter toàn bộ, rồi lấy phần tử đầu", "Chạy song song", "Lỗi compile"
      ], correct: 1, explanation: "Eager. Dùng asSequence() nếu muốn dừng sớm." },
    { q: "Khi nào Sequence có lợi rõ rệt?", options: [
        "List 5 phần tử", "Dữ liệu lớn, chuỗi toán tử dài, có bước dừng sớm như first/take", "Luôn luôn", "Khi cần sort"
      ], correct: 1, explanation: "Với list nhỏ, chi phí overhead của Sequence có thể lớn hơn lợi ích." },
    { q: "associateBy { it.id } trả về?", options: [
        "Map<id, List<Order>>", "Map<id, Order> (trùng key thì phần tử sau ghi đè)", "List<Pair>", "Set<id>"
      ], correct: 1, explanation: "groupBy mới trả Map<K, List<V>>." },
    { q: "Vì sao trong Compose nên viết items = items + newItem thay vì mutableList.add(newItem)?", options: [
        "Cú pháp đẹp hơn",
        "Tạo list mới → tham chiếu/giá trị state đổi → Compose biết để recompose",
        "add bị cấm",
        "Tiết kiệm bộ nhớ"
      ], correct: 1, explanation: "Sửa tại chỗ không làm State đổi giá trị nên UI không vẽ lại." }
  ]
});
