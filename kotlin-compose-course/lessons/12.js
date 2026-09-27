window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "Recomposition: cơ chế & chi phí",
  subtitle: "Snapshot state → invalidate scope · skipping · stable/unstable · strong skipping · derivedStateOf · đọc state muộn",

  theory: `
    <p><strong>Recomposition</strong> là việc Compose chạy lại một số hàm composable vì dữ liệu chúng đọc đã đổi. Hiểu đúng cơ chế giúp bạn trả lời "vì sao màn hình giật" thay vì đoán.</p>

    <p><strong>Cơ chế theo dõi</strong>:</p>
    <ol>
      <li><code>mutableStateOf</code> tạo một <em>snapshot state object</em>. Khi một composable <strong>đọc</strong> <code>.value</code> trong lúc composition, Compose ghi lại:
        "restart scope này phụ thuộc state kia".</li>
      <li>Khi state được <strong>ghi</strong> giá trị mới (khác giá trị cũ theo <code>equals</code>, với policy mặc định), mọi scope đã đọc nó bị đánh dấu <em>invalid</em>.</li>
      <li>Ở khung hình kế tiếp, Recomposer chạy lại <strong>chỉ các scope invalid</strong> — không chạy lại cả màn hình. Scope thường là thân của hàm composable không-inline gần nhất
        (lưu ý: <code>Column</code>, <code>Row</code>, <code>Box</code> là hàm <em>inline</em> nên không tạo scope riêng).</li>
      <li>Khi scope chạy lại và gọi composable con, con được <strong>skip</strong> nếu mọi tham số "bằng" lần trước.</li>
    </ol>

    <p><strong>Stable hay không quyết định có skip được không</strong>. Compiler suy luận tính ổn định của từng kiểu:</p>
    <ul>
      <li>Stable: kiểu nguyên thuỷ, String, lambda, <code>data class</code> toàn <code>val</code> kiểu stable, class có <code>@Immutable</code>/<code>@Stable</code>, <code>State&lt;T&gt;</code>.</li>
      <li>Unstable: class có <code>var</code> public thường, <code>List/Map/Set</code> (interface — compiler không biết bên dưới có phải MutableList), class từ module không biên dịch bằng Compose compiler.</li>
    </ul>
    <p><strong>Strong skipping mode</strong> (bật mặc định từ Kotlin 2.0.20): composable vẫn skip được kể cả khi có tham số unstable — tham số unstable so sánh bằng
    <em>tham chiếu</em> (<code>===</code>), tham số stable so bằng <code>equals</code>; lambda trong composable được tự động <code>remember</code>.
    Hệ quả: tạo list mới mỗi lần (<code>items.filter { }</code> trong thân composable) sẽ làm con không skip được.</p>

    <p><strong>Chi phí thực</strong> thường không nằm ở một lần recompose mà ở: recompose <em>mỗi khung hình</em> (đọc scroll offset/animation ở pha composition),
    tính toán nặng trong thân composable (sort list 1.000 phần tử mỗi lần), hoặc một state "to" (cả object UI) bị đọc ở gốc màn hình.</p>
    <ul>
      <li><code>remember(key) { tínhNặng() }</code> — chỉ tính lại khi key đổi.</li>
      <li><code>derivedStateOf { }</code> — khi state nguồn đổi rất thường xuyên nhưng kết quả ít đổi (vd <code>firstVisibleItemIndex &gt; 0</code> để hiện nút "lên đầu").</li>
      <li><strong>Đọc state muộn</strong>: truyền lambda <code>() -&gt; Int</code> thay vì giá trị, hoặc dùng <code>Modifier.offset { }</code>/<code>graphicsLayer { }</code> để đọc ở pha layout/draw.</li>
    </ul>

    <div class="callout"><p>💡 Đừng tối ưu mù. Dùng <strong>Layout Inspector</strong> của Android Studio (cột số lần recompose/skip) và báo cáo compiler
    (<code>composeCompiler { reportsDestination = ... }</code>) để xem hàm nào không skippable. Bản debug chậm hơn nhiều so với release (R8, không có debug hook) — đo hiệu năng trên release.</p></div>
  `,

  codeTabs: [
    { id: "scope", label: "① Scope bị invalidate", lines: [
      "@Composable",
      "fun CartScreen(vm: CartViewModel) {",
      "    val cart by vm.cart.collectAsStateWithLifecycle()",
      "    var note by remember { mutableStateOf(\"\") }",
      "    Column {",
      "        CartHeader(count = cart.items.size)        // đọc cart",
      "        NoteField(note, onChange = { note = it })   // đọc note",
      "        CartList(cart.items)",
      "    }",
      "}",
      "// gõ 1 ký tự → note đổi → scope CartScreen chạy lại (Column là inline)",
      "// CartHeader(count) tham số không đổi → SKIP; CartList(items) cùng list → SKIP"
    ]},
    { id: "stable", label: "② Stable vs unstable", lines: [
      "data class ProductUi(val id: Long, val name: String, val price: Long)   // stable",
      "",
      "class CartModel { var items = mutableListOf<ProductUi>() }             // unstable: var + mutable",
      "",
      "@Immutable",
      "data class CartUi(val items: List<ProductUi>)   // hứa với compiler: không bao giờ bị sửa",
      "",
      "// Hoặc dùng kotlinx.collections.immutable: ImmutableList<ProductUi> (stable sẵn)"
    ]},
    { id: "trap", label: "③ Bẫy phá skipping", lines: [
      "@Composable",
      "fun ProductScreen(all: List<ProductUi>, query: String) {",
      "    val visible = all.filter { it.name.contains(query) }   // ❌ list MỚI mỗi lần chạy",
      "    ProductList(visible)                                  // strong skipping so ===  → không skip",
      "}",
      "",
      "@Composable",
      "fun ProductScreenFixed(all: List<ProductUi>, query: String) {",
      "    val visible = remember(all, query) { all.filter { it.name.contains(query) } }   // ✅",
      "    ProductList(visible)",
      "}"
    ]},
    { id: "derived", label: "④ derivedStateOf & đọc muộn", lines: [
      "val listState = rememberLazyListState()",
      "",
      "// ❌ đổi mỗi pixel cuộn → recompose liên tục",
      "// val showTop = listState.firstVisibleItemIndex > 0",
      "",
      "val showTop by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }",
      "if (showTop) ScrollToTopButton()          // chỉ recompose khi true/false đổi",
      "",
      "val offsetPx by animateIntAsState(target)",
      "Box(Modifier.offset { IntOffset(offsetPx, 0) })   // đọc ở pha layout, bỏ qua composition"
    ]}
  ],

  stageHtml: `
    <div class="node" id="write"><div class="nl">✍️ note = \"a\"</div><div class="ns">ghi snapshot state (khác giá trị cũ)</div></div>
    <div class="arrow" id="a1">↓ tìm các scope đã ĐỌC note</div>
    <div class="node" id="inv"><div class="nl">🚩 Scope CartScreen invalid</div><div class="ns">chờ khung hình kế tiếp</div></div>
    <div class="arrow" id="a2">↓ Recomposer chạy lại scope</div>
    <div class="row">
      <div class="node" id="skip1"><div class="nl">⏭️ CartHeader</div><div class="ns">count không đổi → skip</div></div>
      <div class="node" id="run"><div class="nl">🔁 NoteField</div><div class="ns">note đổi → chạy</div></div>
      <div class="node" id="skip2"><div class="nl">⏭️ CartList</div><div class="ns">cùng list → skip</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Đọc state = đăng ký theo dõi", tab: "scope", highlight: [3, 4, 6, 7], on: ["write"],
      desc: "Compose ghi lại scope nào đọc state nào trong lúc composition." },
    { title: "2 · Ghi state → invalidate", tab: "scope", highlight: [7, 11], on: ["a1", "inv"],
      desc: "Gõ phím đổi <code>note</code>. Scope đọc note là CartScreen (Column inline không tạo scope riêng)." },
    { title: "3 · Chạy lại, con được skip", tab: "scope", highlight: [6, 7, 8, 12], on: ["a2", "skip1", "run", "skip2"],
      desc: "Chỉ NoteField thực sự chạy lại. CartHeader và CartList skip vì tham số không đổi." },
    { title: "4 · Stable giúp so sánh đúng", tab: "stable", highlight: [1, 3, 5, 6], on: ["skip2"],
      desc: "Kiểu stable so bằng equals. Kiểu unstable (var, MutableList) chỉ so bằng tham chiếu dưới strong skipping." },
    { title: "5 · Bẫy: tạo object mới trong thân", tab: "trap", highlight: [3, 4, 9], on: ["run"],
      desc: "<code>filter</code> tạo list mới mỗi lần → ProductList luôn chạy lại, và filter tốn CPU mỗi lần. <code>remember(keys)</code> sửa cả hai." },
    { title: "6 · derivedStateOf & đọc state muộn", tab: "derived", highlight: [6, 7, 10], on: ["inv"],
      desc: "derivedStateOf lọc bớt thay đổi. Lambda của <code>Modifier.offset { }</code> đọc state ở pha layout nên animation không gây recomposition." }
  ],

  quiz: [
    { q: "Compose biết cần recompose scope nào bằng cách nào?", options: [
        "Recompose toàn bộ cây mỗi khung hình",
        "Ghi lại scope nào đã đọc snapshot state nào; khi state được ghi thì invalidate đúng các scope đó",
        "Diff cây element như React",
        "Dùng reflection quét field"
      ], correct: 1, explanation: "Theo dõi đọc/ghi qua hệ thống snapshot." },
    { q: "Vì sao đổi state đọc bên trong Column lại làm cả hàm cha chạy lại?", options: [
        "Bug", "Column là hàm inline nên không có restart scope riêng; scope gần nhất là hàm cha", "Column luôn recompose cả cây", "Do Modifier"
      ], correct: 1, explanation: "Tách phần đọc state ra composable con để thu hẹp scope." },
    { q: "Một composable được skip khi nào?", options: [
        "Không bao giờ", "Khi mọi tham số được coi là không đổi so với lần trước", "Khi nó nằm ngoài màn hình", "Khi không có Modifier"
      ], correct: 1, explanation: "Stable so bằng equals, unstable (strong skipping) so bằng ===." },
    { q: "Với strong skipping, tham số List<T> (unstable) được so sánh thế nào?", options: [
        "equals từng phần tử", "So tham chiếu (===)", "Không so, luôn recompose", "hashCode"
      ], correct: 1, explanation: "Cùng instance thì skip; list mới dù nội dung giống vẫn chạy lại." },
    { q: "Dòng val v = all.filter { ... } trong thân composable gây hại gì?", options: [
        "Không hại gì", "Tính lại mỗi lần recompose và tạo list mới làm con không skip được", "Lỗi compile", "Rò rỉ bộ nhớ vĩnh viễn"
      ], correct: 1, explanation: "Bọc bằng remember(all, query) hoặc đưa vào ViewModel." },
    { q: "derivedStateOf phù hợp khi nào?", options: [
        "Mọi phép tính", "State nguồn đổi rất thường xuyên nhưng kết quả suy ra ít đổi", "Gọi API", "Lưu vào DB"
      ], correct: 1, explanation: "Ví dụ scroll index → boolean hiện nút." },
    { q: "Class nào sau đây Compose compiler coi là stable?", options: [
        "class A { var x = 0 }", "data class B(val id: Long, val name: String)", "data class C(val items: MutableList<String>)", "Class từ thư viện không dùng Compose compiler"
      ], correct: 1, explanation: "Toàn val kiểu stable." },
    { q: "Modifier.offset { IntOffset(x, 0) } (lambda) khác Modifier.offset(x.dp) thế nào về recomposition khi x animate?", options: [
        "Không khác",
        "Bản lambda đọc x ở pha layout nên không gây recomposition mỗi khung hình",
        "Bản lambda chậm hơn",
        "Bản lambda không animate được"
      ], correct: 1, explanation: "Đọc state càng muộn, càng ít pha phải làm lại." },
    { q: "Nên đo hiệu năng Compose trên bản build nào?", options: [
        "Debug", "Release (có R8, không có overhead debug)", "Không quan trọng", "Chỉ trên emulator"
      ], correct: 1, explanation: "Debug chậm hơn đáng kể và gây kết luận sai." },
    { q: "Ghi state bằng giá trị equals với giá trị cũ (policy mặc định) thì?", options: [
        "Luôn recompose", "Không invalidate gì", "Ném exception", "Recompose toàn màn hình"
      ], correct: 1, explanation: "structuralEqualityPolicy mặc định bỏ qua ghi trùng." }
  ]
});
