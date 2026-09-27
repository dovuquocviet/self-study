window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "Composable: UI = f(state)",
  subtitle: "@Composable là gì · Compose compiler & Composer · composition/layout/drawing · so với XML View và React Native",

  theory: `
    <p><strong>Cách cũ (View/XML)</strong>: bạn khai báo cây View trong XML, rồi trong code <em>tìm và sửa</em> nó: <code>findViewById</code>, <code>textView.setText(...)</code>,
    <code>button.setVisibility(GONE)</code>. Trạng thái nằm rải rác trong các View — dễ lệch với dữ liệu.</p>
    <p><strong>Compose (declarative)</strong>: bạn viết hàm mô tả UI <em>ứng với</em> dữ liệu hiện tại. Dữ liệu đổi → Compose gọi lại hàm → tự tính phần UI cần đổi.
    Không có <code>setText</code>. Nếu bạn đã thấy React Native: <code>@Composable fun</code> ≈ function component, tham số ≈ props — nhưng không có virtual DOM diff.</p>

    <p><strong>@Composable làm gì ở tầng compiler?</strong> Plugin Compose biến đổi mọi hàm có annotation này:</p>
    <ul>
      <li>Thêm tham số ẩn <code>$composer: Composer</code> (và <code>$changed</code> bitmask) — giống cách suspend thêm Continuation. Vì vậy composable chỉ gọi được từ composable khác.</li>
      <li>Bọc thân hàm bằng "group" có key theo <em>vị trí trong source</em>. Composer ghi lại cây group + state vào cấu trúc <strong>slot table</strong> (bộ nhớ của composition).</li>
      <li>Chèn logic <strong>skip</strong>: nếu mọi tham số không đổi so với lần trước, bỏ qua không chạy lại thân hàm (bài 12).</li>
    </ul>

    <p><strong>Ba pha mỗi khung hình</strong>:</p>
    <ol>
      <li><strong>Composition</strong> — chạy các hàm composable, dựng/cập nhật cây UI (<em>cái gì</em> hiển thị).</li>
      <li><strong>Layout</strong> — đo (measure) và đặt vị trí (place) từng node (<em>ở đâu</em>). Mỗi node được đo đúng một lần.</li>
      <li><strong>Drawing</strong> — vẽ lên Canvas.</li>
    </ol>
    <p>Trạng thái chỉ được đọc ở pha nào thì chỉ pha đó chạy lại khi nó đổi — đọc state trong lambda của <code>Modifier.offset { }</code> hay <code>drawBehind { }</code> có thể bỏ qua cả composition.</p>

    <p><strong>Quy tắc viết composable</strong>: tên PascalCase (là "danh từ" UI), trả <code>Unit</code> (phát UI chứ không trả View), <strong>không tác dụng phụ</strong> trong thân
    (không gọi API, không ghi DB, không sửa biến ngoài) vì hàm có thể chạy lại bất kỳ lúc nào, nhiều lần, thậm chí bị bỏ dở. Tác dụng phụ đặt trong side-effect API (bài 18) hoặc event handler.</p>

    <div class="callout"><p>💡 Compose không phải wrapper của View. Nó tự đo, tự vẽ trên một <code>AndroidComposeView</code> duy nhất. Cũng vì vậy <strong>Compose Multiplatform</strong>
    (JetBrains) chạy được code UI này trên iOS/desktop — liên quan nếu công ty chọn KMP.</p></div>
  `,

  codeTabs: [
    { id: "xml", label: "① Cách cũ: XML + View", lines: [
      "<!-- activity_cart.xml -->",
      "<TextView android:id=\"@+id/total\" ... />",
      "<Button android:id=\"@+id/checkout\" ... />",
      "",
      "// CartActivity.kt — imperative: tìm View rồi sửa",
      "val total = findViewById<TextView>(R.id.total)",
      "val checkout = findViewById<Button>(R.id.checkout)",
      "fun render(cart: Cart) {",
      "    total.text = \"Tổng: ${cart.total}\"",
      "    checkout.isEnabled = cart.items.isNotEmpty()   // quên dòng này = UI lệch dữ liệu",
      "}"
    ]},
    { id: "compose", label: "② Compose: declarative", lines: [
      "@Composable",
      "fun CartSummary(cart: Cart, onCheckout: () -> Unit) {",
      "    Column {",
      "        Text(\"Tổng: ${cart.total}\")",
      "        Button(",
      "            onClick = onCheckout,",
      "            enabled = cart.items.isNotEmpty()",
      "        ) { Text(\"Thanh toán\") }",
      "    }",
      "}",
      "// cart đổi → CartSummary chạy lại → UI khớp dữ liệu, không có setText"
    ]},
    { id: "compiled", label: "③ Compiler biến đổi", lines: [
      "// Sau Compose compiler (rút gọn, minh hoạ ý tưởng)",
      "fun CartSummary(cart: Cart, onCheckout: () -> Unit, $composer: Composer, $changed: Int) {",
      "    $composer.startRestartGroup(0x1a2b3c)          // key theo vị trí source",
      "    if ($changed == 0 && $composer.skipping) {",
      "        $composer.skipToGroupEnd()                  // tham số không đổi → bỏ qua",
      "    } else {",
      "        Column { ... }",
      "    }",
      "    $composer.endRestartGroup()?.updateScope { c, _ -> CartSummary(cart, onCheckout, c, ...) }",
      "}"
    ]},
    { id: "rn", label: "④ So với React Native", lines: [
      "// React Native",
      "function CartSummary({ cart, onCheckout }) {",
      "  return (<View><Text>Tổng: {cart.total}</Text>",
      "    <Button title=\"Thanh toán\" onPress={onCheckout} disabled={cart.items.length === 0} /></View>);",
      "}",
      "",
      "// Khác biệt cơ chế:",
      "// RN: component trả cây element → reconciler diff → bridge/JSI → native View",
      "// Compose: không trả gì; gọi hàm = ghi vào slot table; chỉ scope bị đổi chạy lại"
    ]}
  ],

  stageHtml: `
    <div class="node" id="state"><div class="nl">📦 State: Cart(total=350k, items=3)</div><div class="ns">nguồn sự thật</div></div>
    <div class="arrow" id="a1">↓ gọi hàm @Composable</div>
    <div class="node" id="comp"><div class="nl">① Composition</div><div class="ns">chạy composable, ghi slot table</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="layout"><div class="nl">② Layout</div><div class="ns">measure + place, mỗi node đo một lần</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="draw"><div class="nl">③ Drawing</div><div class="ns">vẽ lên Canvas</div></div>
  `,
  steps: [
    { title: "1 · Imperative: tìm và sửa View", tab: "xml", highlight: [6, 9, 10], on: ["state"],
      desc: "Bạn phải nhớ cập nhật mọi View liên quan mỗi khi dữ liệu đổi. Quên một dòng là UI lệch." },
    { title: "2 · Declarative: mô tả theo state", tab: "compose", highlight: [2, 4, 7, 11], on: ["state", "a1"],
      desc: "UI là hàm của dữ liệu. Không có trạng thái View để quên cập nhật." },
    { title: "3 · Compiler thêm Composer", tab: "compiled", highlight: [2, 3, 9], on: ["comp"],
      desc: "Tham số ẩn <code>$composer</code> và group theo vị trí source giúp Compose nhớ cây và state giữa các lần chạy." },
    { title: "4 · Skip khi không đổi", tab: "compiled", highlight: [4, 5], on: ["comp"],
      desc: "<code>$changed</code> cho biết tham số nào đổi. Không đổi → bỏ qua cả thân hàm. Đây là nguồn hiệu năng của Compose." },
    { title: "5 · Layout rồi Drawing", tab: "compose", highlight: [3, 5], on: ["a2", "layout", "a3", "draw"],
      desc: "Column đo con theo chiều dọc rồi đặt vị trí; cuối cùng vẽ. State đọc ở pha nào thì chỉ pha đó phải làm lại." },
    { title: "6 · So với React Native", tab: "rn", highlight: [2, 8, 9], on: ["comp"],
      desc: "Cùng tư duy UI = f(state), props ↔ tham số. Khác: RN diff cây element rồi điều khiển View native; Compose tự vẽ và chỉ chạy lại các scope bị ảnh hưởng." }
  ],

  quiz: [
    { q: "Compose compiler thêm gì vào hàm @Composable?", options: [
        "Không gì cả", "Tham số ẩn Composer (và bitmask $changed), group theo vị trí source, logic skip", "Một Activity mới", "Reflection runtime"
      ], correct: 1, explanation: "Vì vậy composable chỉ gọi được trong ngữ cảnh composable." },
    { q: "Ba pha của một khung hình Compose theo thứ tự?", options: [
        "Layout → Composition → Drawing", "Composition → Layout → Drawing", "Drawing → Layout → Composition", "Measure → Compose → Render"
      ], correct: 1, explanation: "Cái gì → ở đâu → vẽ." },
    { q: "Vì sao không được gọi API trong thân composable?", options: [
        "Không có quyền INTERNET",
        "Composable có thể chạy lại nhiều lần, bất kỳ lúc nào, thậm chí bị bỏ dở — tác dụng phụ sẽ lặp/không kiểm soát",
        "Composable chạy trên IO",
        "Lỗi compile"
      ], correct: 1, explanation: "Dùng LaunchedEffect hoặc ViewModel." },
    { q: "Hàm composable trả về gì?", options: [
        "View", "Unit — nó 'phát' UI vào composition", "Element như React", "Bitmap"
      ], correct: 1, explanation: "Khác RN, nơi component trả về cây element." },
    { q: "Muốn đổi text trên màn hình trong Compose, bạn làm gì?", options: [
        "text.setText()", "Đổi state mà composable đọc; Compose tự chạy lại phần liên quan", "findViewById", "Gọi invalidate()"
      ], correct: 1, explanation: "UI = f(state)." },
    { q: "Slot table là gì?", options: [
        "Bảng database", "Cấu trúc dữ liệu Composer dùng ghi cây group, tham số và state đã remember của composition", "Danh sách thread", "File layout XML"
      ], correct: 1, explanation: "Đây là 'bộ nhớ' giữa các lần recomposition." },
    { q: "Compose có phải là lớp bọc quanh TextView/Button cũ không?", options: [
        "Có", "Không — Compose tự đo và vẽ, không tạo View cho từng thành phần", "Chỉ với Material", "Chỉ trên Android 14"
      ], correct: 1, explanation: "Điều này cho phép Compose Multiplatform chạy trên nền tảng khác." },
    { q: "Tương đương gần nhất của props trong React Native là gì trong Compose?", options: [
        "remember", "Tham số của hàm composable", "ViewModel", "Modifier"
      ], correct: 1, explanation: "State cục bộ thì tương ứng remember { mutableStateOf() }." },
    { q: "Quy ước đặt tên composable phát UI?", options: [
        "camelCase động từ", "PascalCase danh từ, trả Unit", "snake_case", "Tiền tố 'compose'"
      ], correct: 1, explanation: "Ví dụ ProductCard, CartSummary." }
  ]
});
