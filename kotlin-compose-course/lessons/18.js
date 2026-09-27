window.LESSONS.push({
  id: "18",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "Side effects: LaunchedEffect, DisposableEffect & bạn bè",
  subtitle: "Vì sao cần · key quyết định vòng đời · rememberCoroutineScope · rememberUpdatedState · SideEffect · produceState · so với useEffect",

  theory: `
    <p>Composable phải "thuần" (bài 11). Nhưng app cần tác dụng phụ: gọi API khi màn hình mở, hiện Snackbar, đăng ký listener, log analytics.
    <strong>Effect API</strong> là cách chạy tác dụng phụ <em>gắn với vòng đời của composable trong cây</em>, không phải mỗi lần recompose.</p>

    <table>
      <tr><th>API</th><th>Làm gì</th><th>React tương đương</th></tr>
      <tr><td><code>LaunchedEffect(key) { }</code></td><td>Chạy coroutine khi vào composition; <strong>key đổi → huỷ coroutine cũ, chạy lại</strong>; rời cây → huỷ</td><td><code>useEffect(async, [key])</code></td></tr>
      <tr><td><code>DisposableEffect(key) { ... onDispose { } }</code></td><td>Đăng ký thứ cần dọn dẹp (listener, observer); <code>onDispose</code> <em>bắt buộc</em></td><td><code>useEffect</code> có return cleanup</td></tr>
      <tr><td><code>rememberCoroutineScope()</code></td><td>Scope gắn với composable, để <code>launch</code> từ <strong>event handler</strong> (onClick)</td><td>—</td></tr>
      <tr><td><code>rememberUpdatedState(v)</code></td><td>Cho effect chạy lâu đọc giá trị <em>mới nhất</em> mà không phải restart</td><td><code>useRef</code> + gán mỗi render</td></tr>
      <tr><td><code>SideEffect { }</code></td><td>Chạy sau <em>mỗi</em> lần composition thành công — đồng bộ state Compose sang đối tượng ngoài</td><td><code>useEffect</code> không deps</td></tr>
      <tr><td><code>produceState(initial, key) { value = ... }</code></td><td>Biến nguồn không phải Compose thành <code>State</code></td><td>custom hook</td></tr>
      <tr><td><code>snapshotFlow { state }</code></td><td>Biến state Compose thành Flow (để debounce, lọc...)</td><td>—</td></tr>
    </table>

    <p><strong>Chọn key cẩn thận</strong> — key quyết định effect sống bao lâu:</p>
    <ul>
      <li><code>LaunchedEffect(Unit)</code>/<code>(true)</code>: chạy một lần khi vào cây. Nhưng "một lần" theo composition — xoay màn hình tạo lại Activity thì chạy lại. Vì vậy tải dữ liệu
        màn hình nên để ViewModel (<code>init</code> hoặc <code>stateIn</code>), không đặt trong LaunchedEffect(Unit).</li>
      <li><code>LaunchedEffect(productId)</code>: đổi sản phẩm → huỷ việc cũ, làm việc mới.</li>
      <li>Quên đưa biến vào key → effect dùng giá trị cũ (stale). Đưa quá nhiều key → effect restart liên tục. Với callback đổi thường xuyên, dùng <code>rememberUpdatedState</code>.</li>
    </ul>

    <p><strong>Không gọi <code>launch</code> trực tiếp trong thân composable</strong> — sẽ launch mỗi lần recompose. Trong onClick thì dùng <code>rememberCoroutineScope</code>;
    còn "khi X đổi thì làm Y" thì dùng <code>LaunchedEffect(X)</code>.</p>

    <div class="callout"><p>💡 Khác biệt tinh tế với <code>useEffect</code>: LaunchedEffect chạy một <em>coroutine</em> — có thể <code>delay</code>, <code>collect</code> flow vô hạn — và việc "cleanup"
    chính là huỷ coroutine (structured concurrency). DisposableEffect mới là bản tương ứng khi cần gỡ listener đồng bộ.</p></div>
  `,

  codeTabs: [
    { id: "launched", label: "① LaunchedEffect", lines: [
      "@Composable",
      "fun CartScreen(ui: CartUi, messages: Flow<String>, onRetry: () -> Unit) {",
      "    val snackbar = remember { SnackbarHostState() }",
      "",
      "    LaunchedEffect(Unit) {                  // collect suốt khi màn hình còn trong cây",
      "        messages.collect { msg ->",
      "            snackbar.showSnackbar(msg)        // suspend tới khi snackbar đóng",
      "        }",
      "    }",
      "",
      "    LaunchedEffect(ui.couponCode) {          // mã giảm giá đổi → huỷ cũ, chạy mới",
      "        delay(500)",
      "        analytics.log(\"coupon_typed\", ui.couponCode)",
      "    }",
      "    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { /* ... */ }",
      "}"
    ]},
    { id: "disposable", label: "② DisposableEffect", lines: [
      "@Composable",
      "fun TrackScreenVisibility(onVisible: () -> Unit, onHidden: () -> Unit) {",
      "    val owner = LocalLifecycleOwner.current",
      "    val latestVisible by rememberUpdatedState(onVisible)   // luôn gọi bản mới nhất",
      "    val latestHidden by rememberUpdatedState(onHidden)",
      "",
      "    DisposableEffect(owner) {",
      "        val observer = LifecycleEventObserver { _, e ->",
      "            if (e == Lifecycle.Event.ON_START) latestVisible()",
      "            if (e == Lifecycle.Event.ON_STOP) latestHidden()",
      "        }",
      "        owner.lifecycle.addObserver(observer)",
      "        onDispose { owner.lifecycle.removeObserver(observer) }   // bắt buộc",
      "    }",
      "}"
    ]},
    { id: "scope", label: "③ rememberCoroutineScope", lines: [
      "@Composable",
      "fun ProductGrid(items: List<ProductUi>) {",
      "    val gridState = rememberLazyGridState()",
      "    val scope = rememberCoroutineScope()        // huỷ khi composable rời cây",
      "",
      "    Box {",
      "        LazyVerticalGrid(GridCells.Fixed(2), state = gridState) { /* ... */ }",
      "        FloatingActionButton(onClick = {",
      "            scope.launch { gridState.animateScrollToItem(0) }  // từ event handler",
      "        }) { Icon(Icons.Default.KeyboardArrowUp, null) }",
      "    }",
      "    // ❌ scope.launch { ... } đặt thẳng ở đây = launch mỗi lần recompose",
      "}"
    ]},
    { id: "rn", label: "④ So với useEffect", lines: [
      "// React Native",
      "useEffect(() => {",
      "  const sub = AppState.addEventListener('change', onChange);",
      "  return () => sub.remove();               // cleanup",
      "}, [onChange]);",
      "",
      "// Compose",
      "DisposableEffect(Unit) {",
      "    val sub = registerListener(listener)",
      "    onDispose { sub.remove() }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="enter"><div class="nl">➡️ Composable vào composition</div><div class="ns">LaunchedEffect(key=A) → launch coroutine</div></div>
    <div class="arrow" id="a1">↓ recompose, key vẫn A</div>
    <div class="node" id="same"><div class="nl">⏸️ Không làm gì</div><div class="ns">coroutine cũ chạy tiếp</div></div>
    <div class="arrow" id="a2">↓ key đổi thành B</div>
    <div class="node" id="restart"><div class="nl">🔄 Huỷ coroutine A, launch coroutine B</div><div class="ns">DisposableEffect: onDispose rồi đăng ký lại</div></div>
    <div class="arrow" id="a3">↓ rời composition</div>
    <div class="node" id="leave"><div class="nl">🛑 Huỷ coroutine / gọi onDispose</div><div class="ns">không leak</div></div>
  `,
  steps: [
    { title: "1 · LaunchedEffect(Unit): collect sự kiện", tab: "launched", highlight: [5, 6, 7], on: ["enter"],
      desc: "Coroutine chạy khi màn hình vào cây, collect flow đến khi rời cây thì tự huỷ." },
    { title: "2 · Recompose không restart effect", tab: "launched", highlight: [5], on: ["a1", "same"],
      desc: "Key không đổi → effect giữ nguyên. Đây là khác biệt với việc viết code thẳng trong thân hàm." },
    { title: "3 · Key đổi → restart", tab: "launched", highlight: [11, 12, 13], on: ["a2", "restart"],
      desc: "Gõ mã giảm giá: mỗi ký tự huỷ coroutine đang delay và bắt đầu cái mới — thành debounce tự nhiên." },
    { title: "4 · DisposableEffect & dọn dẹp", tab: "disposable", highlight: [7, 12, 13], on: ["restart", "a3", "leave"],
      desc: "Đăng ký observer, gỡ trong onDispose khi rời cây hoặc khi key (owner) đổi." },
    { title: "5 · rememberUpdatedState", tab: "disposable", highlight: [4, 5, 9, 10], on: ["same"],
      desc: "Callback mới nhất được dùng mà không cần restart effect mỗi khi cha truyền lambda mới." },
    { title: "6 · Launch từ event", tab: "scope", highlight: [4, 9, 12], on: ["leave"],
      desc: "onClick không phải composable nên không dùng LaunchedEffect; dùng scope của rememberCoroutineScope." },
    { title: "7 · Đối chiếu useEffect", tab: "rn", highlight: [2, 4, 5, 8, 10], on: ["restart"],
      desc: "Dependency array ↔ key; hàm cleanup ↔ onDispose (hoặc huỷ coroutine với LaunchedEffect)." }
  ],

  quiz: [
    { q: "LaunchedEffect(productId) khi productId đổi sẽ?", options: [
        "Không làm gì", "Huỷ coroutine đang chạy và launch lại với productId mới", "Chạy song song hai coroutine", "Crash"
      ], correct: 1, explanation: "Key quyết định vòng đời effect." },
    { q: "Đặt scope.launch { api.load() } thẳng trong thân composable thì?", options: [
        "Chạy một lần", "Launch lại mỗi lần recompose", "Lỗi compile", "Chạy khi rời màn hình"
      ], correct: 1, explanation: "Thân composable chạy nhiều lần." },
    { q: "Muốn cuộn list lên đầu khi bấm nút, dùng?", options: [
        "LaunchedEffect trong onClick", "rememberCoroutineScope() rồi scope.launch trong onClick", "SideEffect", "GlobalScope"
      ], correct: 1, explanation: "LaunchedEffect là composable, không gọi trong onClick được." },
    { q: "DisposableEffect bắt buộc có gì?", options: [
        "delay", "onDispose { } ở cuối khối", "key là Unit", "Coroutine"
      ], correct: 1, explanation: "Nơi gỡ listener/observer." },
    { q: "rememberUpdatedState giải quyết vấn đề gì?", options: [
        "Lưu qua process death",
        "Effect chạy lâu cần gọi callback mới nhất mà không restart effect",
        "Tăng tốc recomposition",
        "Chuyển State sang Flow"
      ], correct: 1, explanation: "Tránh stale closure." },
    { q: "Tải dữ liệu màn hình bằng LaunchedEffect(Unit) có nhược điểm gì?", options: [
        "Không có",
        "Chạy lại mỗi khi composable vào lại cây (vd xoay màn hình) — nên để ViewModel lo",
        "Không gọi được suspend",
        "Chạy trên IO"
      ], correct: 1, explanation: "ViewModel sống qua config change." },
    { q: "Tương đương React của LaunchedEffect(key) là?", options: [
        "useState", "useEffect với dependency [key]", "useMemo", "useContext"
      ], correct: 1, explanation: "Cleanup = huỷ coroutine." },
    { q: "snapshotFlow { listState.firstVisibleItemIndex } dùng để?", options: [
        "Lưu state", "Chuyển state Compose thành Flow để áp toán tử (distinctUntilChanged, debounce...)", "Tạo animation", "Điều hướng"
      ], correct: 1, explanation: "Thường collect trong LaunchedEffect." },
    { q: "SideEffect { } chạy khi nào?", options: [
        "Một lần", "Sau mỗi lần composition thành công", "Khi rời cây", "Trên IO"
      ], correct: 1, explanation: "Dùng để đẩy state Compose sang object không do Compose quản lý." },
    { q: "Khi composable chứa LaunchedEffect rời khỏi cây, coroutine?", options: [
        "Chạy tiếp", "Bị huỷ", "Bị tạm dừng chờ quay lại", "Chuyển sang GlobalScope"
      ], correct: 1, explanation: "Structured concurrency — không leak." }
  ]
});
