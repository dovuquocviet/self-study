window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "State & remember",
  subtitle: "mutableStateOf · remember · by delegate · rememberSaveable · mutableStateListOf · key của remember",

  theory: `
    <p>Một biến thường trong composable <strong>không phải state</strong>: mỗi lần hàm chạy lại, biến được khởi tạo lại, và gán nó cũng không làm UI vẽ lại.
    Cần hai thứ tách biệt:</p>
    <ul>
      <li><strong><code>mutableStateOf(x)</code></strong> — tạo object <em>quan sát được</em>: đọc thì đăng ký theo dõi, ghi thì báo recompose (bài 12). Trả về <code>MutableState&lt;T&gt;</code>.</li>
      <li><strong><code>remember { }</code></strong> — lưu giá trị vào slot table tại <em>vị trí</em> đó trong cây, để lần chạy lại lấy ra đúng object cũ thay vì tạo mới.</li>
    </ul>
    <p>Vì vậy câu thần chú là <code>var x by remember { mutableStateOf(0) }</code>. <code>by</code> là property delegate: đọc <code>x</code> = đọc <code>.value</code>, gán <code>x = 1</code> = ghi <code>.value</code>
    (cần import <code>getValue</code>/<code>setValue</code> từ <code>androidx.compose.runtime</code>).</p>

    <table>
      <tr><th>API</th><th>Sống qua recomposition</th><th>Sống qua xoay màn hình</th><th>Sống qua process death</th></tr>
      <tr><td>biến thường</td><td>❌</td><td>❌</td><td>❌</td></tr>
      <tr><td><code>remember</code></td><td>✅</td><td>❌</td><td>❌</td></tr>
      <tr><td><code>rememberSaveable</code></td><td>✅</td><td>✅</td><td>✅ (lưu vào Bundle — chỉ kiểu Bundle chứa được hoặc qua Saver/<code>@Parcelize</code>)</td></tr>
      <tr><td>ViewModel</td><td>✅</td><td>✅</td><td>❌ (trừ phần lưu trong <code>SavedStateHandle</code>)</td></tr>
    </table>

    <p><strong>remember gắn với vị trí</strong>: composable rời khỏi cây (vd bị <code>if</code> ẩn đi) thì giá trị remember bị quên; hiện lại thì bắt đầu từ đầu.
    <code>remember(key1) { }</code> tính lại khi key đổi — như dependency array của <code>useMemo</code> trong React.</p>

    <p><strong>Collection làm state</strong>: <code>mutableStateOf(mutableListOf())</code> rồi <code>list.add()</code> <em>không</em> recompose — object state không đổi, chỉ nội dung bên trong đổi.
    Hai cách đúng: <code>mutableStateListOf()</code>/<code>mutableStateMapOf()</code> (collection tự quan sát được), hoặc dùng list bất biến và gán list mới: <code>items = items + x</code>.</p>

    <div class="callout"><p>💡 So với React Native: <code>remember { mutableStateOf(0) }</code> ≈ <code>useState(0)</code>; <code>remember(key) { }</code> ≈ <code>useMemo</code>.
    Khác biệt: React re-render cả component khi setState; Compose chỉ chạy lại scope <em>đã đọc</em> state đó, và ghi state trùng giá trị thì không làm gì.</p></div>
  `,

  codeTabs: [
    { id: "wrong", label: "① Sai: biến thường", lines: [
      "@Composable",
      "fun QtyStepper() {",
      "    var qty = 1                          // ❌ khởi tạo lại mỗi lần chạy",
      "    Row {",
      "        Button(onClick = { qty++ }) { Text(\"+\") }   // tăng biến, không ai biết",
      "        Text(\"$qty\")                     // luôn hiển thị 1",
      "    }",
      "}"
    ]},
    { id: "right", label: "② Đúng: remember + state", lines: [
      "import androidx.compose.runtime.getValue",
      "import androidx.compose.runtime.setValue",
      "",
      "@Composable",
      "fun QtyStepper() {",
      "    var qty by remember { mutableStateOf(1) }   // nhớ object state qua các lần chạy",
      "    Row {",
      "        Button(onClick = { qty++ }) { Text(\"+\") }  // ghi → invalidate",
      "        Text(\"$qty\")                             // đọc → đăng ký theo dõi",
      "    }",
      "}"
    ]},
    { id: "save", label: "③ rememberSaveable & key", lines: [
      "@Composable",
      "fun SearchBox() {",
      "    var query by rememberSaveable { mutableStateOf(\"\") }   // sống qua xoay màn hình",
      "    TextField(value = query, onValueChange = { query = it })",
      "}",
      "",
      "@Composable",
      "fun PriceTag(cents: Long, locale: Locale) {",
      "    val fmt = remember(locale) { NumberFormat.getCurrencyInstance(locale) }  // tạo lại khi locale đổi",
      "    Text(fmt.format(cents / 100.0))",
      "}"
    ]},
    { id: "list", label: "④ List làm state", lines: [
      "// ❌ add vào MutableList bên trong State: không recompose",
      "val bad = remember { mutableStateOf(mutableListOf<String>()) }",
      "bad.value.add(\"x\")",
      "",
      "// ✅ Cách 1: collection quan sát được",
      "val tags = remember { mutableStateListOf<String>() }",
      "tags.add(\"sale\")                        // recompose nơi đọc tags",
      "",
      "// ✅ Cách 2: list bất biến, thay cả list",
      "var picked by remember { mutableStateOf(listOf<String>()) }",
      "picked = picked + \"size-M\""
    ]}
  ],

  stageHtml: `
    <div class="node" id="first"><div class="nl">1️⃣ Lần chạy đầu</div><div class="ns">remember chạy lambda → lưu MutableState(1) vào slot</div></div>
    <div class="arrow" id="a1">↓ bấm + : qty = 2</div>
    <div class="node" id="write"><div class="nl">✍️ Ghi state</div><div class="ns">scope đọc qty bị invalidate</div></div>
    <div class="arrow" id="a2">↓ recompose</div>
    <div class="node" id="again"><div class="nl">🔁 Lần chạy lại</div><div class="ns">remember trả object cũ ở slot → đọc 2</div></div>
    <div class="arrow" id="a3">↓ xoay màn hình</div>
    <div class="node" id="rot"><div class="nl">♻️ Activity tạo lại</div><div class="ns">remember mất · rememberSaveable khôi phục từ Bundle</div></div>
  `,
  steps: [
    { title: "1 · Biến thường không phải state", tab: "wrong", highlight: [3, 5, 6], on: ["first"],
      desc: "qty = 1 mỗi lần hàm chạy; tăng qty không báo ai, nên không có recomposition." },
    { title: "2 · mutableStateOf + remember", tab: "right", highlight: [1, 2, 6], on: ["first"],
      desc: "mutableStateOf cho khả năng quan sát; remember giữ đúng object đó giữa các lần chạy; <code>by</code> để đọc/ghi như biến thường." },
    { title: "3 · Ghi & recompose", tab: "right", highlight: [8, 9], on: ["a1", "write", "a2", "again"],
      desc: "Bấm + ghi state → scope đọc qty bị invalidate → chạy lại, remember trả object cũ đang giữ 2." },
    { title: "4 · Sống qua xoay màn hình", tab: "save", highlight: [3, 4], on: ["a3", "rot"],
      desc: "rememberSaveable lưu vào Bundle của hệ thống, khôi phục sau config change và process death." },
    { title: "5 · remember có key", tab: "save", highlight: [9], on: ["again"],
      desc: "Chỉ tạo NumberFormat lại khi locale đổi — như useMemo với dependency." },
    { title: "6 · Collection làm state", tab: "list", highlight: [2, 3, 6, 7, 10, 11], on: ["write"],
      desc: "Sửa nội dung MutableList không đổi object State. Dùng mutableStateListOf hoặc gán list mới." }
  ],

  quiz: [
    { q: "var count = 0 trong composable, onClick tăng count. UI thế nào?", options: [
        "Tăng bình thường", "Không đổi — biến thường không được theo dõi và bị khởi tạo lại mỗi lần chạy", "Crash", "Tăng gấp đôi"
      ], correct: 1, explanation: "Cần remember { mutableStateOf(0) }." },
    { q: "mutableStateOf(0) không có remember thì sao?", options: [
        "Vẫn ổn", "Mỗi lần recompose tạo State mới giá trị 0 — giá trị bị reset", "Lỗi compile", "Rò rỉ bộ nhớ"
      ], correct: 1, explanation: "remember giữ object qua các lần chạy." },
    { q: "Muốn giá trị ô tìm kiếm còn sau khi xoay màn hình, dùng?", options: [
        "remember", "rememberSaveable", "biến top-level", "LaunchedEffect"
      ], correct: 1, explanation: "Hoặc để trong ViewModel." },
    { q: "remember(locale) { ... } tính lại khi nào?", options: [
        "Mỗi lần recompose", "Khi locale đổi (hoặc composable rời cây rồi vào lại)", "Không bao giờ", "Mỗi giây"
      ], correct: 1, explanation: "Key giống dependency của useMemo." },
    { q: "state.value.add(x) với state = mutableStateOf(mutableListOf()). Recompose không?", options: [
        "Có", "Không — object state không đổi, Compose không biết nội dung list đổi", "Có nhưng chậm", "Ném exception"
      ], correct: 1, explanation: "Dùng mutableStateListOf hoặc thay list mới." },
    { q: "Composable bị ẩn bởi if rồi hiện lại. Giá trị remember bên trong?", options: [
        "Giữ nguyên", "Bị quên, khởi tạo lại từ đầu", "Lưu vào disk", "Tuỳ thiết bị"
      ], correct: 1, explanation: "remember gắn với sự hiện diện trong composition." },
    { q: "Tương đương React của remember { mutableStateOf(x) } là?", options: [
        "useEffect", "useState", "useContext", "useRef"
      ], correct: 1, explanation: "Và remember(key){} ≈ useMemo." },
    { q: "rememberSaveable lưu được kiểu nào mặc định?", options: [
        "Mọi kiểu", "Kiểu Bundle chứa được (primitive, String, Parcelable...), còn lại cần Saver", "Chỉ String", "Chỉ Int"
      ], correct: 1, explanation: "Data class thường cần @Parcelize hoặc Saver tuỳ biến." },
    { q: "Vì sao cần import getValue/setValue khi dùng 'by remember { mutableStateOf() }'?", options: [
        "Không cần", "Đó là operator của property delegate cho State/MutableState", "Để chạy trên IO", "Để lưu Bundle"
      ], correct: 1, explanation: "IDE thường tự gợi ý import." }
  ]
});
