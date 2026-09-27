window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "React Native bên dưới",
  title: "React Native kiến trúc cũ: 3 thread và cây cầu JSON",
  subtitle: "JS thread · shadow thread (Yoga) · UI thread · bridge bất đồng bộ, batch, serialize JSON",

  theory: `
    <p>App RN mà bạn đang viết <strong>không phải WebView</strong>: <code>&lt;View&gt;</code> cuối cùng là <code>android.view.ViewGroup</code> / <code>UIView</code> thật. Nhưng logic và cây React chạy trong một <strong>JS engine</strong> nhúng trong app.
    Hiểu chỗ hai thế giới gặp nhau là hiểu vì sao RN có lúc giật mà native thì không.</p>

    <p><strong>Kiến trúc cũ (trước New Architecture) có 3 luồng chính</strong></p>
    <table>
      <tr><th>Thread</th><th>Làm gì</th></tr>
      <tr><td><strong>JS thread</strong></td><td>Chạy bundle JS: component, hooks, Redux, gọi API bằng fetch, React reconciliation (tính diff cây)</td></tr>
      <tr><td><strong>Shadow thread</strong></td><td>Nhận "cây bóng" (shadow tree), tính layout flexbox bằng <strong>Yoga</strong> (C++) → toạ độ từng view</td></tr>
      <tr><td><strong>UI / main thread</strong></td><td>Tạo, cập nhật native view theo lệnh; nhận touch; chạy animation native</td></tr>
    </table>

    <p><strong>Bridge</strong>: mọi giao tiếp JS ⇄ native đi qua một hàng đợi message, được <em>serialize thành JSON</em>, <em>gom theo lô</em> (batch) và <em>bất đồng bộ</em>.</p>
    <ul>
      <li>JS muốn tạo view → gửi message kiểu <code>createView(tag, "RCTView", props)</code> qua bridge → native parse JSON → tạo view.</li>
      <li>Người dùng chạm → native serialize sự kiện → qua bridge → JS xử lý → gửi lệnh update ngược lại. Luôn có ít nhất một vòng khứ hồi bất đồng bộ.</li>
      <li>Native module (Camera, AsyncStorage) được khởi tạo <em>hết</em> lúc startup, kể cả khi chưa dùng.</li>
    </ul>

    <p><strong>Hệ quả thực tế</strong></p>
    <ol>
      <li><strong>JS thread bận = app "đơ logic"</strong>: parse JSON 2 MB, filter 5.000 sản phẩm, re-render cả danh sách… trong lúc đó touch vẫn tới native nhưng phản hồi (setState, điều hướng) phải chờ.
      Perf Monitor của RN hiển thị riêng <em>JS FPS</em> và <em>UI FPS</em> vì hai cái có thể rớt độc lập.</li>
      <li><strong>Chi phí qua cầu</strong>: dữ liệu lớn hoặc sự kiện liên tục (onScroll mỗi frame, gesture) phải serialize/parse liên tục → nghẽn.</li>
      <li><strong>Không đồng bộ được</strong>: JS không thể hỏi native "view này cao bao nhiêu?" và nhận ngay kết quả trong cùng frame → nhấp nháy layout, khó làm gesture mượt.</li>
    </ol>

    <div class="callout"><p>💡 Đây là lý do các "mẹo" RN tồn tại: <code>useNativeDriver: true</code> (đẩy animation sang native, không qua cầu mỗi frame), <code>InteractionManager.runAfterInteractions</code>, <code>getItemLayout</code> cho FlatList, memo hoá component.
    Tất cả đều là cách <em>tránh JS thread và bridge</em>. Native thì không có hai thế giới này ngay từ đầu.</p></div>
  `,

  codeTabs: [
    { id: "jsx", label: "① Code RN của bạn", lines: [
      "function CartBadge() {",
      "  const count = useSelector(s => s.cart.items.length);",
      "  return (",
      "    <View style={{ padding: 8, backgroundColor: 'red' }}>",
      "      <Text>{count}</Text>",
      "    </View>",
      "  );",
      "}"
    ]},
    { id: "bridge", label: "② Message qua bridge (minh hoạ)", lines: [
      "// JS -> Native, gom thành một lô, serialize JSON:",
      "[",
      "  ['UIManager', 'createView',  [41, 'RCTView', 1, {'padding': 8, 'backgroundColor': -65536}]],",
      "  ['UIManager', 'createView',  [42, 'RCTText', 1, {}]],",
      "  ['UIManager', 'setChildren', [41, [42]]]",
      "]",
      "",
      "// Native -> JS khi chạm:",
      "['RCTEventEmitter', 'receiveTouches', ['topTouchStart', [{ 'target': 41, 'pageX': 120 }]]]"
    ]},
    { id: "native", label: "③ Native tương đương", lines: [
      "// Kotlin / Compose — cùng process, cùng ngôn ngữ, không serialize",
      "@Composable fun CartBadge(count: Int) {",
      "    Box(Modifier.background(Color.Red).padding(8.dp)) { Text(\"$count\") }",
      "}",
      "",
      "// Swift / SwiftUI",
      "struct CartBadge: View {",
      "    let count: Int",
      "    var body: some View { Text(\"\\(count)\").padding(8).background(.red) }",
      "}"
    ]},
    { id: "tricks", label: "④ Mẹo né bridge", lines: [
      "Animated.timing(opacity, {",
      "  toValue: 1, duration: 250,",
      "  useNativeDriver: true,     // gửi mô tả animation 1 lần, native tự chạy từng frame",
      "}).start();",
      "",
      "<FlatList",
      "  data={products}",
      "  getItemLayout={(_, i) => ({ length: 88, offset: 88 * i, index: i })}  // khỏi đo",
      "  removeClippedSubviews",
      "/>"
    ]}
  ],

  stageHtml: `
    <div class="node" id="js"><div class="nl">🟨 JS thread</div><div class="ns">React, Redux, fetch, diff cây</div></div>
    <div class="arrow" id="a1">↓ bridge: JSON, batch, async</div>
    <div class="node" id="shadow"><div class="nl">🌫️ Shadow thread</div><div class="ns">Yoga tính flexbox layout</div></div>
    <div class="arrow" id="a2">↓ lệnh tạo/cập nhật view</div>
    <div class="node" id="ui"><div class="nl">🧵 UI thread</div><div class="ns">UIView / android.view.View thật</div></div>
    <div class="arrow" id="a3">↑ sự kiện touch — lại qua bridge</div>
    <div class="node" id="touch"><div class="nl">👆 Người dùng chạm</div><div class="ns">phản hồi chờ JS thread rảnh</div></div>
  `,
  steps: [
    { title: "1 · Component chạy trên JS thread", tab: "jsx", highlight: [1, 2, 4, 5], on: ["js"],
      desc: "Hook, selector, JSX → React tính ra cây cần hiển thị. Tất cả trên một thread JS." },
    { title: "2 · Qua cầu bằng JSON", tab: "bridge", highlight: [2, 3, 4, 5, 6], on: ["a1"],
      desc: "Lệnh tạo view được serialize, gom lô, gửi bất đồng bộ. Native phải parse lại." },
    { title: "3 · Yoga tính layout", tab: "bridge", highlight: [3], on: ["shadow"],
      desc: "Shadow thread dùng Yoga (C++) tính padding/flex thành toạ độ tuyệt đối." },
    { title: "4 · UI thread tạo view thật", tab: "native", highlight: [2, 3], on: ["a2", "ui"],
      desc: "Kết quả cuối vẫn là view native. Native thuần viết thẳng như tab này, không có bước 1–3." },
    { title: "5 · Touch quay ngược qua cầu", tab: "bridge", highlight: [9], on: ["touch", "a3", "js"],
      desc: "Sự kiện chạm phải đi JSON về JS; nếu JS thread đang bận, phản hồi bị trễ." },
    { title: "6 · Mẹo = né JS thread & bridge", tab: "tricks", highlight: [3, 8], on: ["ui"],
      desc: "useNativeDriver gửi mô tả animation một lần; getItemLayout bỏ bước đo. Bản chất là giảm qua lại hai thế giới." }
  ],

  quiz: [
    { q: "<View> trong React Native cuối cùng được hiển thị bằng gì?", options: [
        "Một thẻ div trong WebView", "View native thật (UIView / android.view.ViewGroup)", "Canvas vẽ tay", "Ảnh bitmap"
      ], correct: 1, explanation: "RN render ra native view, khác Cordova/Ionic." },
    { q: "Trong kiến trúc cũ, bridge có ba đặc điểm nào?", options: [
        "Đồng bộ, nhị phân, từng message", "Bất đồng bộ, gom lô (batch), serialize JSON", "Đồng bộ, JSON, không gom lô", "Dùng HTTP localhost"
      ], correct: 1, explanation: "Ba điểm này sinh ra độ trễ và chi phí serialize." },
    { q: "Yoga là gì?", options: [
        "JS engine", "Engine layout flexbox viết bằng C++ mà RN dùng để tính toạ độ", "Thư viện animation", "Trình quản lý package"
      ], correct: 1, explanation: "Yoga chạy trên shadow thread ở kiến trúc cũ." },
    { q: "Màn hình RN vẫn cuộn mượt nhưng bấm nút 1 giây sau mới phản hồi. Nguyên nhân hợp lý nhất?", options: [
        "UI thread bị chặn", "JS thread đang bận (vd parse JSON lớn, re-render nặng)", "GPU yếu", "Thiếu permission"
      ], correct: 1, explanation: "Cuộn là native nên mượt; xử lý sự kiện phải chờ JS thread." },
    { q: "useNativeDriver: true giúp gì?", options: [
        "Animation chạy trên JS thread nhanh hơn",
        "Mô tả animation được gửi sang native một lần; native tự chạy từng frame, không qua bridge mỗi frame",
        "Bật GPU", "Tắt animation"
      ], correct: 1, explanation: "Chỉ hỗ trợ thuộc tính không ảnh hưởng layout (transform, opacity)." },
    { q: "Vì sao trong kiến trúc cũ JS khó đo kích thước view đồng bộ?", options: [
        "Vì JS không có số thực", "Vì mọi giao tiếp qua bridge đều bất đồng bộ", "Vì Yoga chạy trên server", "Vì React cấm"
      ], correct: 1, explanation: "Phải gọi measure với callback, kết quả về ở lần sau → nhấp nháy layout." },
    { q: "Perf Monitor của RN hiển thị JS FPS và UI FPS riêng vì…", options: [
        "Cho đẹp", "Hai thread có thể rớt frame độc lập nhau", "UI FPS luôn bằng JS FPS", "JS FPS là FPS của GPU"
      ], correct: 1, explanation: "JS FPS thấp → logic chậm; UI FPS thấp → native render chậm." },
    { q: "Native module trong kiến trúc cũ được khởi tạo khi nào?", options: [
        "Khi lần đầu gọi", "Tất cả lúc startup, dù chưa dùng", "Khi app về nền", "Không bao giờ"
      ], correct: 1, explanation: "Làm chậm khởi động — TurboModules sửa điều này bằng lazy loading (bài 10)." },
    { q: "Điểm khác biệt cơ bản của app native thuần so với RN về luồng dữ liệu UI?", options: [
        "Native không có main thread",
        "Không có JS runtime và bước serialize giữa hai ngôn ngữ; code UI chạy trực tiếp trên nền tảng",
        "Native không dùng GPU", "Native luôn đa luồng cho UI"
      ], correct: 1, explanation: "Ít tầng hơn = ít độ trễ và ít chi phí hơn." }
  ]
});
