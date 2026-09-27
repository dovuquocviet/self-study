window.LESSONS.push({
  id: "16",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "Modifier: chuỗi có thứ tự",
  subtitle: "Thứ tự quan trọng · padding vs background · size/fill · clickable & vùng chạm · semantics · nhận modifier từ ngoài",

  theory: `
    <p><code>Modifier</code> là cách Compose gắn hành vi cho một composable: kích thước, khoảng cách, nền, viền, bo góc, xử lý chạm, cuộn, semantics cho trợ năng...
    Thay vì hàng chục thuộc tính như XML, bạn nối chuỗi: <code>Modifier.padding(8.dp).background(Color.Red).clickable { }</code>.</p>

    <p><strong>Thứ tự là tất cả.</strong> Mỗi modifier <em>bọc</em> phần phía sau nó. Đọc từ trái sang phải = từ ngoài vào trong:</p>
    <ul>
      <li><code>.padding(16.dp).background(Red)</code> → chừa lề 16dp trước, rồi tô nền phần bên trong: lề <em>không</em> có màu (giống margin).</li>
      <li><code>.background(Red).padding(16.dp)</code> → tô nền cả khối, rồi đẩy nội dung vào 16dp: lề có màu (giống padding CSS).</li>
      <li><code>.clickable { }.padding(16.dp)</code> → vùng chạm gồm cả lề; <code>.padding(16.dp).clickable { }</code> → chỉ phần trong mới bấm được, ripple nhỏ hơn.</li>
      <li><code>.clip(RoundedCornerShape(12.dp))</code> phải đặt <em>trước</em> <code>background</code>/<code>clickable</code> để nền và ripple bị bo theo.</li>
    </ul>
    <p>Compose không có <code>margin</code> riêng — "margin" chỉ là padding đặt ở ngoài cùng.</p>

    <table>
      <tr><th>Nhóm</th><th>Ví dụ</th></tr>
      <tr><td>Kích thước</td><td><code>size(48.dp)</code>, <code>width</code>, <code>height</code>, <code>fillMaxWidth()</code>, <code>fillMaxSize(0.5f)</code>, <code>wrapContentSize()</code>, <code>aspectRatio(16f/9f)</code>, <code>heightIn(min = 48.dp)</code></td></tr>
      <tr><td>Trang trí</td><td><code>background</code>, <code>border</code>, <code>clip</code>, <code>shadow</code>, <code>alpha</code>, <code>graphicsLayer { }</code></td></tr>
      <tr><td>Tương tác</td><td><code>clickable</code>, <code>toggleable</code>, <code>verticalScroll</code>, <code>pointerInput { detectTapGestures() }</code></td></tr>
      <tr><td>Trợ năng/test</td><td><code>semantics { contentDescription = ... }</code>, <code>testTag(\"cart_total\")</code></td></tr>
    </table>

    <p><strong>Đơn vị</strong>: <code>dp</code> (density-independent pixel) cho kích thước; <code>sp</code> cho cỡ chữ (co giãn theo cài đặt cỡ chữ của user). Vùng chạm tối thiểu
    khuyến nghị 48×48dp — Material component tự đảm bảo.</p>

    <p><strong>Quy ước API</strong>: mọi composable phát UI nên có tham số <code>modifier: Modifier = Modifier</code> và áp nó cho <em>phần tử ngoài cùng</em>, đặt trước các modifier nội bộ:
    <code>Row(modifier.padding(8.dp))</code>. Người gọi quyết định vị trí/kích thước; component quyết định nội bộ.</p>

    <div class="callout"><p>💡 So với RN: <code>style={{ padding, backgroundColor, borderRadius }}</code> là một object không thứ tự; Modifier là chuỗi có thứ tự,
    nên cùng một tập modifier có thể cho kết quả khác nhau. Khi layout "lạ", việc đầu tiên là đọc lại thứ tự chuỗi modifier.</p></div>
  `,

  codeTabs: [
    { id: "order", label: "① Thứ tự padding/background", lines: [
      "// A: lề ngoài không màu (≈ margin)",
      "Text(\"A\", Modifier.padding(16.dp).background(Color.Yellow))",
      "",
      "// B: nền phủ cả lề (≈ padding CSS)",
      "Text(\"B\", Modifier.background(Color.Yellow).padding(16.dp))",
      "",
      "// C: cả hai — margin 8, nền, padding 16",
      "Text(\"C\", Modifier.padding(8.dp).background(Color.Yellow).padding(16.dp))"
    ]},
    { id: "click", label: "② clip & clickable", lines: [
      "Row(",
      "    Modifier",
      "        .padding(horizontal = 16.dp)            // margin ngoài",
      "        .clip(RoundedCornerShape(12.dp))        // bo góc cho mọi thứ phía sau",
      "        .background(MaterialTheme.colorScheme.surfaceVariant)",
      "        .clickable { onOpen(order.id) }        // ripple bị bo theo clip",
      "        .padding(16.dp)                          // padding trong, vẫn bấm được",
      ") { Text(order.code) }"
    ]},
    { id: "size", label: "③ Kích thước", lines: [
      "Image(",
      "    painter = painterResource(R.drawable.banner),",
      "    contentDescription = \"Khuyến mãi tháng 9\",",
      "    contentScale = ContentScale.Crop,",
      "    modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)",
      ")",
      "",
      "Button(onClick = {}, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {",
      "    Text(\"Đặt hàng\", fontSize = 16.sp)      // sp: theo cỡ chữ hệ thống",
      "}"
    ]},
    { id: "api", label: "④ Nhận modifier từ ngoài", lines: [
      "@Composable",
      "fun PriceTag(price: String, modifier: Modifier = Modifier) {",
      "    Text(",
      "        text = price,",
      "        modifier = modifier                        // của người gọi — ngoài cùng",
      "            .background(Color(0xFFFFE8E8), RoundedCornerShape(4.dp))",
      "            .padding(horizontal = 6.dp, vertical = 2.dp)",
      "            .testTag(\"price_tag\")",
      "    )",
      "}",
      "",
      "PriceTag(\"199k\", Modifier.align(Alignment.TopEnd))   // người gọi định vị"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m1"><div class="nl">padding(16) — lớp ngoài</div><div class="ns">chừa lề, chưa có màu</div></div>
    <div class="arrow" id="a1">↓ bọc</div>
    <div class="node" id="m2"><div class="nl">clip + background</div><div class="ns">tô & bo phần còn lại</div></div>
    <div class="arrow" id="a2">↓ bọc</div>
    <div class="node" id="m3"><div class="nl">clickable</div><div class="ns">vùng chạm = từ đây vào trong</div></div>
    <div class="arrow" id="a3">↓ bọc</div>
    <div class="node" id="m4"><div class="nl">padding(16) — lớp trong</div><div class="ns">đẩy nội dung vào</div></div>
    <div class="node" id="content"><div class="nl">📝 Text</div><div class="ns">nội dung</div></div>
  `,
  steps: [
    { title: "1 · padding trước background", tab: "order", highlight: [2], on: ["m1"],
      desc: "Lề nằm ngoài vùng tô màu — chính là margin." },
    { title: "2 · background trước padding", tab: "order", highlight: [5, 8], on: ["m2", "m4"],
      desc: "Nền phủ cả phần lề. Kết hợp hai padding cho cả margin và padding." },
    { title: "3 · clip trước background & clickable", tab: "click", highlight: [3, 4, 5, 6], on: ["a1", "m2", "m3"],
      desc: "Mọi thứ phía sau clip bị bo góc, kể cả ripple khi bấm." },
    { title: "4 · padding sau clickable", tab: "click", highlight: [6, 7], on: ["a3", "m4", "content"],
      desc: "Vùng bấm gồm cả padding trong — user bấm vào khoảng trống vẫn ăn." },
    { title: "5 · Kích thước & đơn vị", tab: "size", highlight: [5, 8, 9], on: ["content"],
      desc: "fillMaxWidth + aspectRatio cho ảnh co giãn; heightIn(min = 48.dp) đảm bảo vùng chạm; sp cho chữ." },
    { title: "6 · Modifier từ người gọi", tab: "api", highlight: [2, 5, 12], on: ["m1"],
      desc: "Component nhận modifier, áp ở ngoài cùng; người gọi quyết định vị trí (align trong Box)." }
  ],

  quiz: [
    { q: "Modifier.padding(16.dp).background(Red) — phần lề 16dp có màu đỏ không?", options: [
        "Có", "Không — padding bọc ngoài, background chỉ tô phần bên trong", "Tuỳ theme", "Lỗi compile"
      ], correct: 1, explanation: "Đây là cách tạo 'margin'." },
    { q: "Muốn ripple khi bấm được bo góc theo card, đặt clip ở đâu?", options: [
        "Sau clickable", "Trước background và clickable", "Không cần clip", "Trong onClick"
      ], correct: 1, explanation: "clip ảnh hưởng mọi thứ phía sau nó trong chuỗi." },
    { q: "Compose có modifier margin không?", options: [
        "Có, Modifier.margin", "Không — dùng padding đặt ở ngoài cùng", "Chỉ trong Row", "Chỉ trong Material 3"
      ], correct: 1, explanation: "Thứ tự modifier quyết định ý nghĩa." },
    { q: ".clickable { }.padding(16.dp) so với .padding(16.dp).clickable { }?", options: [
        "Giống nhau",
        "Bản đầu: vùng bấm gồm cả padding; bản sau: vùng bấm chỉ phần bên trong padding",
        "Bản đầu không bấm được",
        "Bản sau không có ripple"
      ], correct: 1, explanation: "clickable áp cho mọi thứ nó bọc." },
    { q: "Cỡ chữ nên dùng đơn vị gì?", options: [
        "px", "dp", "sp — co giãn theo cài đặt cỡ chữ của user", "pt"
      ], correct: 2, explanation: "dp cho kích thước, sp cho chữ." },
    { q: "Composable tự viết nên áp tham số modifier ở đâu?", options: [
        "Không áp", "Phần tử ngoài cùng, trước các modifier nội bộ", "Phần tử trong cùng", "Mọi phần tử con"
      ], correct: 1, explanation: "Người gọi kiểm soát vị trí/kích thước bên ngoài." },
    { q: "Vùng chạm tối thiểu khuyến nghị?", options: [
        "24dp", "32dp", "48×48dp", "64dp"
      ], correct: 2, explanation: "Theo hướng dẫn Material / accessibility." },
    { q: "Modifier.testTag(\"x\") dùng để?", options: [
        "Đổi màu", "Tìm node trong UI test (onNodeWithTag)", "Log", "Analytics"
      ], correct: 1, explanation: "Sẽ gặp ở bài test." },
    { q: "Điểm khác cơ bản giữa Modifier và style của React Native?", options: [
        "Không khác", "Modifier là chuỗi có thứ tự, mỗi phần bọc phần sau; style là object không thứ tự", "style nhanh hơn", "Modifier chỉ cho màu"
      ], correct: 1, explanation: "Cùng tập modifier, đổi thứ tự → kết quả khác." }
  ]
});
