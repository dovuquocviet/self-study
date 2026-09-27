window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "State hoisting & luồng dữ liệu một chiều",
  subtitle: "Stateful vs stateless · value + onValueChange · state đi xuống, event đi lên · so với props/lifting state của React",

  theory: `
    <p><strong>State hoisting</strong> = đưa state ra khỏi composable, lên người gọi. Composable nhận hai thứ qua tham số:</p>
    <ul>
      <li><code>value: T</code> — giá trị hiện tại cần hiển thị (<em>state đi xuống</em>).</li>
      <li><code>onValueChange: (T) -&gt; Unit</code> — báo "user muốn đổi thành giá trị này" (<em>event đi lên</em>).</li>
    </ul>
    <p>Chính <code>TextField(value, onValueChange)</code> của Material là ví dụ: nó <strong>không tự giữ text</strong>. Nếu bạn không cập nhật state trong <code>onValueChange</code>,
    gõ phím sẽ không thấy chữ nào. Đây là "controlled component" trong React.</p>

    <p><strong>Vì sao hoist?</strong></p>
    <ol>
      <li><strong>Một nguồn sự thật</strong>: hai widget cần cùng giá trị (ô số lượng và tổng tiền) thì state phải nằm ở cha chung gần nhất.</li>
      <li><strong>Dễ test & preview</strong>: composable stateless chỉ là hàm của tham số — truyền giá trị gì, hiện đúng cái đó.</li>
      <li><strong>Tái sử dụng</strong>: cùng <code>QtyStepper</code> dùng cho giỏ hàng, wishlist, form đặt hàng.</li>
      <li><strong>Kiểm soát</strong>: cha có thể từ chối/sửa giá trị (giới hạn 1–99, chặn ký tự lạ).</li>
    </ol>

    <p><strong>Hoist tới đâu?</strong> Tới cha chung thấp nhất cần đọc/ghi nó. State UI thuần (menu đang mở, tab đang chọn) có thể ở composable; state liên quan dữ liệu/nghiệp vụ
    (giỏ hàng, kết quả tìm kiếm) hoist lên <strong>ViewModel</strong>. Mẫu thường gặp: một composable <em>stateful</em> mỏng ở trên cùng (lấy state từ ViewModel) gọi một composable
    <em>stateless</em> nhận toàn bộ bằng tham số.</p>

    <p><strong>Đặt tên event</strong> theo ý định của user, không theo cách xử lý: <code>onAddToCart</code>, <code>onQtyChange</code>, không phải <code>updateDatabase</code>.
    Đó cũng là <strong>UDF</strong> (unidirectional data flow) ở mức component; bài 21 mở rộng lên cả kiến trúc.</p>

    <div class="callout"><p>💡 Với dev React Native: đây đúng là "lifting state up" + props. Khác biệt nhỏ: Compose không có context mặc định cho mọi thứ;
    muốn truyền ngầm qua nhiều tầng thì dùng <code>CompositionLocal</code> (như <code>MaterialTheme</code>), nhưng chỉ cho dữ liệu kiểu "môi trường" (theme, locale), không cho state nghiệp vụ.</p></div>
  `,

  codeTabs: [
    { id: "stateful", label: "① Stateful (khó dùng lại)", lines: [
      "@Composable",
      "fun QtyStepper() {",
      "    var qty by remember { mutableStateOf(1) }   // state bị 'giấu' bên trong",
      "    Row {",
      "        IconButton(onClick = { qty-- }) { Text(\"−\") }",
      "        Text(\"$qty\")",
      "        IconButton(onClick = { qty++ }) { Text(\"+\") }",
      "    }",
      "}",
      "// Tổng tiền ở ngoài không biết qty là bao nhiêu!"
    ]},
    { id: "stateless", label: "② Stateless (hoisted)", lines: [
      "@Composable",
      "fun QtyStepper(",
      "    qty: Int,                          // state đi xuống",
      "    onQtyChange: (Int) -> Unit,        // event đi lên",
      "    modifier: Modifier = Modifier",
      ") {",
      "    Row(modifier) {",
      "        IconButton(onClick = { onQtyChange(qty - 1) }, enabled = qty > 1) { Text(\"−\") }",
      "        Text(\"$qty\")",
      "        IconButton(onClick = { onQtyChange(qty + 1) }, enabled = qty < 99) { Text(\"+\") }",
      "    }",
      "}"
    ]},
    { id: "parent", label: "③ Cha giữ state", lines: [
      "@Composable",
      "fun CartLine(product: ProductUi) {",
      "    var qty by rememberSaveable { mutableStateOf(1) }",
      "    Column {",
      "        Text(product.name)",
      "        QtyStepper(qty = qty, onQtyChange = { qty = it.coerceIn(1, 99) })",
      "        Text(\"Thành tiền: ${product.price * qty}\")   // cùng nguồn sự thật",
      "    }",
      "}"
    ]},
    { id: "vm", label: "④ Hoist lên ViewModel", lines: [
      "@Composable",
      "fun CartRoute(vm: CartViewModel = hiltViewModel()) {          // stateful, mỏng",
      "    val ui by vm.ui.collectAsStateWithLifecycle()",
      "    CartScreen(ui = ui, onQtyChange = vm::changeQty, onCheckout = vm::checkout)",
      "}",
      "",
      "@Composable",
      "fun CartScreen(ui: CartUi, onQtyChange: (Long, Int) -> Unit, onCheckout: () -> Unit) {",
      "    // stateless: preview & test được với CartUi giả",
      "}",
      "",
      "@Preview @Composable",
      "fun CartScreenPreview() = CartScreen(CartUi.sample, { _, _ -> }, {})"
    ]},
    { id: "rn", label: "⑤ So với React Native", lines: [
      "// React Native — lifting state up",
      "function QtyStepper({ qty, onQtyChange }) { /* ... */ }",
      "function CartLine({ product }) {",
      "  const [qty, setQty] = useState(1);",
      "  return <QtyStepper qty={qty} onQtyChange={setQty} />;",
      "}",
      "// Compose: qty = tham số, onQtyChange = lambda — cùng mô hình"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vm"><div class="nl">🧠 ViewModel</div><div class="ns">StateFlow&lt;CartUi&gt; · changeQty()</div></div>
    <div class="arrow" id="down1">↓ state</div>
    <div class="node" id="screen"><div class="nl">🖥️ CartScreen(ui, onQtyChange)</div><div class="ns">stateless</div></div>
    <div class="arrow" id="down2">↓ qty</div>
    <div class="node" id="stepper"><div class="nl">➕➖ QtyStepper(qty, onQtyChange)</div><div class="ns">stateless, tái sử dụng</div></div>
    <div class="arrow" id="up">↑ onQtyChange(qty + 1) — event đi lên</div>
  `,
  steps: [
    { title: "1 · State bị giấu bên trong", tab: "stateful", highlight: [3, 10], on: ["stepper"],
      desc: "Stepper tự giữ qty: tiện nhưng cha không đọc được, không giới hạn được, khó test." },
    { title: "2 · Tách thành value + event", tab: "stateless", highlight: [3, 4, 8, 10], on: ["stepper"],
      desc: "Stepper chỉ hiển thị qty và báo ý định thay đổi. Không tự sửa gì." },
    { title: "3 · Cha giữ một nguồn sự thật", tab: "parent", highlight: [3, 6, 7], on: ["down2", "up"],
      desc: "Thành tiền và stepper đọc cùng qty. Cha kẹp giá trị 1–99 trong onQtyChange." },
    { title: "4 · Hoist lên ViewModel", tab: "vm", highlight: [2, 3, 4, 8], on: ["vm", "down1", "screen"],
      desc: "Route stateful mỏng lấy state từ ViewModel; Screen stateless nhận mọi thứ qua tham số." },
    { title: "5 · Preview & test dễ", tab: "vm", highlight: [12, 13], on: ["screen"],
      desc: "Composable stateless render được với dữ liệu giả, không cần ViewModel, mạng hay DB." },
    { title: "6 · Cùng mô hình với RN", tab: "rn", highlight: [2, 4, 5], on: ["up"],
      desc: "props ↔ tham số, setState truyền xuống ↔ lambda event." }
  ],

  quiz: [
    { q: "State hoisting là gì?", options: [
        "Lưu state vào DB", "Đưa state lên người gọi; composable nhận value và lambda báo thay đổi", "Đẩy state xuống composable con", "Dùng biến global"
      ], correct: 1, explanation: "State đi xuống, event đi lên." },
    { q: "TextField(value = name, onValueChange = { }) — onValueChange rỗng. Gõ phím thì?", options: [
        "Chữ hiện bình thường", "Không có chữ nào hiện — TextField không tự giữ text", "Crash", "Chữ hiện rồi biến mất sau 1s"
      ], correct: 1, explanation: "Đây là controlled component." },
    { q: "Nên hoist state tới đâu?", options: [
        "Luôn lên Activity", "Cha chung thấp nhất cần đọc/ghi nó (hoặc ViewModel nếu là state nghiệp vụ)", "Không bao giờ hoist", "Luôn lên Application"
      ], correct: 1, explanation: "Hoist quá cao làm scope recompose rộng hơn cần." },
    { q: "Lợi ích nào KHÔNG phải của composable stateless?", options: [
        "Dễ preview", "Dễ test", "Tái sử dụng", "Tự lưu dữ liệu qua process death"
      ], correct: 3, explanation: "Lưu trạng thái là việc của nơi giữ state." },
    { q: "Tên event tốt cho nút thêm giỏ?", options: [
        "onClick2", "onAddToCart", "updateDb", "callApi"
      ], correct: 1, explanation: "Đặt theo ý định của user." },
    { q: "Tương đương RN của state hoisting?", options: [
        "Redux bắt buộc", "Lifting state up + truyền props/callback", "useEffect", "Context API"
      ], correct: 1, explanation: "Cùng mô hình." },
    { q: "CompositionLocal nên dùng cho?", options: [
        "Mọi state nghiệp vụ", "Dữ liệu kiểu môi trường như theme, locale, density", "Thay ViewModel", "Truyền event"
      ], correct: 1, explanation: "Lạm dụng làm luồng dữ liệu khó theo dõi." },
    { q: "Vì sao composable nên nhận modifier: Modifier = Modifier?", options: [
        "Bắt buộc bởi compiler", "Cho người gọi tuỳ chỉnh kích thước/padding/vị trí từ ngoài", "Để recompose nhanh hơn", "Để dùng Material"
      ], correct: 1, explanation: "Quy ước API của Compose." },
    { q: "Mẫu Route/Screen tách thế nào?", options: [
        "Route stateless, Screen stateful",
        "Route stateful mỏng (lấy state từ ViewModel), Screen stateless nhận tham số",
        "Cả hai stateful",
        "Không tách"
      ], correct: 1, explanation: "Screen preview/test được độc lập." }
  ]
});
