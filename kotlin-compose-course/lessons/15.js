window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "Layout: Column, Row, Box & LazyColumn",
  subtitle: "Đo một lần · constraints đi xuống, size đi lên · Arrangement/Alignment · weight · Lazy list, key, contentType · Scaffold",

  theory: `
    <p><strong>Mô hình layout</strong> của Compose (giống Flutter): cha truyền <strong>constraints</strong> (min/max width/height) xuống con → con tự đo trong giới hạn đó và báo
    <strong>size</strong> lên → cha đặt vị trí con. Mỗi con chỉ được đo <em>một lần</em> mỗi lượt layout (đo hai lần là lỗi runtime), nên lồng sâu không bùng nổ chi phí như
    <code>RelativeLayout</code>/<code>LinearLayout</code> có weight lồng nhau bên View cũ.</p>

    <table>
      <tr><th>Composable</th><th>Xếp con</th><th>Tương đương RN (flexbox)</th></tr>
      <tr><td><code>Column</code></td><td>Dọc</td><td><code>View</code> mặc định (flexDirection: column)</td></tr>
      <tr><td><code>Row</code></td><td>Ngang</td><td><code>flexDirection: 'row'</code></td></tr>
      <tr><td><code>Box</code></td><td>Chồng lên nhau (con sau nằm trên)</td><td><code>position: absolute</code> trong cha</td></tr>
      <tr><td><code>LazyColumn</code>/<code>LazyRow</code>/<code>LazyVerticalGrid</code></td><td>Chỉ compose phần đang thấy</td><td><code>FlatList</code></td></tr>
    </table>

    <ul>
      <li><strong>Arrangement</strong> — cách chia khoảng trống theo <em>trục chính</em>: <code>spacedBy(8.dp)</code>, <code>SpaceBetween</code>, <code>Center</code>... (≈ justifyContent)</li>
      <li><strong>Alignment</strong> — căn theo <em>trục phụ</em>: <code>Column(horizontalAlignment = ...)</code>, <code>Row(verticalAlignment = ...)</code> (≈ alignItems)</li>
      <li><code>Modifier.weight(1f)</code> (chỉ có trong scope Row/Column) chia phần còn lại theo tỉ lệ (≈ <code>flex: 1</code>).</li>
    </ul>

    <p><strong>Column vs LazyColumn</strong>: <code>Column</code> + <code>verticalScroll</code> compose và đo <em>tất cả</em> con — ổn cho form 20 ô, tệ cho 2.000 sản phẩm.
    <code>LazyColumn</code> chỉ compose item trong viewport (+ một ít lề), tái sử dụng khi cuộn. Nội dung của nó là DSL <code>LazyListScope</code>: <code>item { }</code>, <code>items(list) { }</code>,
    <code>stickyHeader { }</code> — không phải composable tuỳ ý.</p>
    <ul>
      <li><strong><code>key = { it.id }</code></strong>: mặc định item được định danh theo vị trí. Thêm/xoá ở đầu list → mọi item "dịch" vị trí, state remember bị gắn nhầm, animation sai.
        Key ổn định (ID) giữ đúng state cho đúng item. Key phải là kiểu lưu được vào Bundle (Long, String...).</li>
      <li><strong><code>contentType</code></strong>: báo loại item (banner/sản phẩm/quảng cáo) để Compose tái sử dụng đúng loại.</li>
      <li>Không lồng <code>LazyColumn</code> trong <code>Column</code> có <code>verticalScroll</code> cùng chiều — lỗi vì chiều cao vô hạn. Dùng nhiều <code>item { }</code> trong một LazyColumn.</li>
    </ul>

    <div class="callout"><p>💡 <code>Scaffold</code> là khung màn hình Material (topBar, bottomBar, floatingActionButton, snackbarHost). Nó truyền <code>innerPadding</code> cho nội dung —
    phải áp <code>Modifier.padding(innerPadding)</code>, không thì nội dung chui dưới top bar/thanh hệ thống (nhất là khi bật edge-to-edge).</p></div>
  `,

  codeTabs: [
    { id: "row", label: "① Row/Column/Box", lines: [
      "@Composable",
      "fun ProductCard(p: ProductUi, onAdd: () -> Unit) {",
      "    Row(",
      "        modifier = Modifier.fillMaxWidth().padding(12.dp),",
      "        verticalAlignment = Alignment.CenterVertically,",
      "        horizontalArrangement = Arrangement.spacedBy(12.dp)",
      "    ) {",
      "        Box {                                        // ảnh + badge chồng lên",
      "            AsyncImage(p.imageUrl, null, Modifier.size(72.dp))",
      "            if (p.onSale) Text(\"SALE\", Modifier.align(Alignment.TopEnd))",
      "        }",
      "        Column(Modifier.weight(1f)) {                // chiếm phần còn lại",
      "            Text(p.name, maxLines = 2)",
      "            Text(p.priceText, style = MaterialTheme.typography.titleMedium)",
      "        }",
      "        Button(onClick = onAdd) { Text(\"Thêm\") }",
      "    }",
      "}"
    ]},
    { id: "lazy", label: "② LazyColumn", lines: [
      "@Composable",
      "fun ProductList(banners: List<Banner>, products: List<ProductUi>, onAdd: (Long) -> Unit) {",
      "    LazyColumn(",
      "        contentPadding = PaddingValues(16.dp),",
      "        verticalArrangement = Arrangement.spacedBy(8.dp)",
      "    ) {",
      "        item(contentType = \"banner\") { BannerCarousel(banners) }",
      "        items(",
      "            items = products,",
      "            key = { it.id },                       // định danh ổn định",
      "            contentType = { \"product\" }",
      "        ) { p ->",
      "            ProductCard(p, onAdd = { onAdd(p.id) })",
      "        }",
      "    }",
      "}"
    ]},
    { id: "key", label: "③ Vì sao cần key", lines: [
      "// Không có key: item định danh theo VỊ TRÍ",
      "// [A(checked), B, C]  --chèn X lên đầu-->  [X, A, B, C]",
      "// vị trí 0 trước là A (checked) → giờ là X → X hiện 'checked' ❌",
      "",
      "items(orders, key = { it.id }) { order ->",
      "    var expanded by remember { mutableStateOf(false) }   // gắn với order.id, không với vị trí",
      "    OrderRow(order, expanded, onToggle = { expanded = !expanded },",
      "             modifier = Modifier.animateItem())             // animation thêm/xoá/đổi chỗ",
      "}"
    ]},
    { id: "scaffold", label: "④ Scaffold", lines: [
      "Scaffold(",
      "    topBar = { TopAppBar(title = { Text(\"Giỏ hàng\") }) },",
      "    bottomBar = { CheckoutBar(total) },",
      "    snackbarHost = { SnackbarHost(snackbarState) }",
      ") { innerPadding ->",
      "    CartList(items, modifier = Modifier.padding(innerPadding))   // ⚠️ đừng quên",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="parent"><div class="nl">📐 Cha: Row</div><div class="ns">constraints: maxWidth = 360.dp</div></div>
    <div class="arrow" id="down">↓ constraints đi xuống</div>
    <div class="row">
      <div class="node" id="img"><div class="nl">🖼️ Box ảnh</div><div class="ns">72.dp</div></div>
      <div class="node" id="text"><div class="nl">📝 Column weight(1f)</div><div class="ns">phần còn lại</div></div>
      <div class="node" id="btn"><div class="nl">🔘 Button</div><div class="ns">theo nội dung</div></div>
    </div>
    <div class="arrow" id="up">↑ size đi lên · cha đặt vị trí (place)</div>
    <div class="node" id="lazy"><div class="nl">📜 LazyColumn</div><div class="ns">chỉ compose item trong viewport · key = id</div></div>
  `,
  steps: [
    { title: "1 · Row với arrangement & alignment", tab: "row", highlight: [3, 4, 5, 6], on: ["parent"],
      desc: "Row xếp ngang; spacedBy chia khoảng cách trục chính, CenterVertically căn trục phụ." },
    { title: "2 · Đo con: constraints xuống, size lên", tab: "row", highlight: [8, 9, 12, 16], on: ["down", "img", "btn", "text", "up"],
      desc: "Ảnh và nút đo trước theo nội dung; Column có weight(1f) nhận phần rộng còn lại. Mỗi con đo đúng một lần." },
    { title: "3 · Box chồng lớp", tab: "row", highlight: [8, 10], on: ["img"],
      desc: "Con sau nằm trên con trước; <code>Modifier.align</code> chỉ có trong BoxScope." },
    { title: "4 · LazyColumn chỉ compose phần thấy", tab: "lazy", highlight: [3, 7, 8, 9, 10, 11], on: ["lazy"],
      desc: "Nội dung là DSL LazyListScope. Banner và sản phẩm có contentType khác nhau để tái sử dụng đúng." },
    { title: "5 · key giữ state đúng item", tab: "key", highlight: [2, 3, 5, 6, 8], on: ["lazy"],
      desc: "Không key thì state bám theo vị trí; chèn phần tử đầu làm state lệch. key = id sửa lỗi và cho phép animateItem." },
    { title: "6 · Scaffold & innerPadding", tab: "scaffold", highlight: [2, 5, 6], on: ["parent"],
      desc: "Áp innerPadding để nội dung không bị top bar/bottom bar che." }
  ],

  quiz: [
    { q: "Trong layout Compose, thông tin nào đi từ cha xuống con?", options: [
        "Size", "Constraints (min/max width/height)", "Màu", "State"
      ], correct: 1, explanation: "Con trả size lên, cha đặt vị trí." },
    { q: "Đo một con hai lần trong cùng lượt layout thì?", options: [
        "Được, chỉ chậm", "Lỗi runtime — Compose chỉ cho đo một lần", "Tự cache", "Tuỳ Modifier"
      ], correct: 1, explanation: "Cần thông tin trước khi đo thì dùng intrinsic measurement hoặc SubcomposeLayout." },
    { q: "Hiển thị 2.000 sản phẩm nên dùng?", options: [
        "Column + verticalScroll", "LazyColumn", "Box", "Row"
      ], correct: 1, explanation: "Chỉ compose item hiển thị." },
    { q: "Vì sao nên truyền key = { it.id } cho items()?", options: [
        "Bắt buộc để compile", "Để state/animation gắn với item thay vì vị trí khi list thay đổi", "Để sắp xếp", "Để lưu DB"
      ], correct: 1, explanation: "Không key, chèn/xoá làm state lệch." },
    { q: "Modifier.weight(1f) dùng được ở đâu?", options: [
        "Mọi nơi", "Con trực tiếp của Row/Column (RowScope/ColumnScope)", "Chỉ trong Box", "Chỉ trong LazyColumn"
      ], correct: 1, explanation: "Là extension trong scope." },
    { q: "Box xếp con thế nào?", options: [
        "Dọc", "Ngang", "Chồng lên nhau, con sau nằm trên", "Lưới"
      ], correct: 2, explanation: "Giống FrameLayout / absolute positioning." },
    { q: "Arrangement và Alignment khác nhau?", options: [
        "Giống nhau", "Arrangement theo trục chính (chia khoảng), Alignment theo trục phụ (căn)", "Arrangement cho màu", "Alignment chỉ cho Box"
      ], correct: 1, explanation: "≈ justifyContent vs alignItems." },
    { q: "Đặt LazyColumn trong Column có verticalScroll thì?", options: [
        "Chạy tốt", "Lỗi: LazyColumn nhận chiều cao vô hạn", "Chậm một chút", "Tự chuyển thành Column"
      ], correct: 1, explanation: "Gộp nội dung vào item { } của một LazyColumn." },
    { q: "Quên áp innerPadding của Scaffold sẽ?", options: [
        "Không sao", "Nội dung bị top bar/bottom bar/thanh hệ thống che", "Crash", "Mất theme"
      ], correct: 1, explanation: "Đặc biệt khi dùng edge-to-edge." },
    { q: "LazyColumn tương đương gì trong React Native?", options: [
        "ScrollView", "FlatList", "View", "SectionHeader"
      ], correct: 1, explanation: "Và keyExtractor ↔ key." }
  ]
});
