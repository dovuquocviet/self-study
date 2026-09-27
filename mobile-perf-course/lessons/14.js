window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Giao diện mượt",
  title: "Animation mượt: native driver, Reanimated, Compose & SwiftUI",
  subtitle: "Animation chạy ở thread nào · transform/opacity rẻ, layout đắt · worklet · deferred read trong Compose · SwiftUI",

  theory: `
    <p>Animation mượt = mỗi frame (16,67 ms hoặc 8,33 ms) phải tính xong giá trị mới và vẽ. Hai câu hỏi quyết định:</p>
    <ol>
      <li><strong>Giá trị animation được tính ở thread nào?</strong> Nếu ở JS thread (RN) hoặc main thread đang bận → giật khi thread đó có việc khác.</li>
      <li><strong>Thuộc tính nào đang thay đổi?</strong> <code>transform</code> (translate/scale/rotate) và <code>opacity</code> chỉ cần vẽ lại/ghép lớp — rẻ.
      <code>width</code>, <code>height</code>, <code>top</code>, <code>margin</code> buộc tính lại layout mỗi frame — đắt.</li>
    </ol>

    <p><strong>React Native</strong></p>
    <table>
      <tr><th>Cách</th><th>Tính ở đâu</th><th>Ghi chú</th></tr>
      <tr><td><code>Animated</code> không native driver</td><td>JS thread, mỗi frame gửi giá trị sang native</td><td>JS bận là giật</td></tr>
      <tr><td><code>Animated</code> + <code>useNativeDriver: true</code></td><td>Gửi mô tả animation sang native một lần, chạy trên UI thread</td><td>Chỉ thuộc tính không liên quan layout (transform, opacity)</td></tr>
      <tr><td><strong>Reanimated</strong></td><td><em>Worklet</em> chạy trên UI thread; <code>useSharedValue</code>, <code>useAnimatedStyle</code></td><td>Làm được gesture, animation phụ thuộc cuộn; Reanimated 4 yêu cầu kiến trúc mới</td></tr>
      <tr><td><code>LayoutAnimation</code> / layout animation của Reanimated</td><td>Native</td><td>Cho thêm/xoá item</td></tr>
    </table>
    <p>Gesture kéo thả nên dùng <code>react-native-gesture-handler</code> + Reanimated: cử chỉ được xử lý trên UI thread, không đi qua JS mỗi frame.</p>

    <p><strong>Jetpack Compose</strong>: Compose có 3 pha — <em>composition → layout → draw</em>. Đọc state animation ở pha càng muộn càng rẻ:</p>
    <ul>
      <li><code>Modifier.offset(x.dp)</code> đọc state ở composition → recompose mỗi frame.</li>
      <li><code>Modifier.offset { IntOffset(...) }</code> (lambda) đọc ở layout → bỏ qua composition.</li>
      <li><code>Modifier.graphicsLayer { translationX = ...; alpha = ... }</code> đọc ở draw → chỉ vẽ lại lớp.</li>
    </ul>
    <p>Dùng <code>derivedStateOf</code> khi state thay đổi liên tục (vị trí cuộn) nhưng UI chỉ cần một ngưỡng (hiện nút "lên đầu trang").</p>

    <p><strong>SwiftUI / UIKit</strong>: Core Animation chạy animation trong render server, không cần main thread mỗi frame — nhưng main thread vẫn phải commit kịp.
    Tránh animation làm đổi layout của cả cây; ưu tiên <code>scaleEffect</code>, <code>offset</code>, <code>opacity</code>. Hiệu ứng nặng (shadow, blur trên nhiều view) có thể gom bằng <code>drawingGroup()</code> (render thành một lớp bằng Metal) — đo trước khi dùng.</p>

    <div class="callout"><p>💡 Quy tắc: <strong>animate transform/opacity, tính trên UI thread, đọc state muộn nhất có thể</strong>. Rồi kiểm tra bằng Perf Monitor (RN), Profile GPU Rendering / Perfetto (Android), Hitches (iOS).</p></div>
  `,

  codeTabs: [
    { id: "animated", label: "① Animated native driver", lines: [
      "const opacity = useRef(new Animated.Value(0)).current;",
      "",
      "useEffect(() => {",
      "  Animated.timing(opacity, {",
      "    toValue: 1,",
      "    duration: 250,",
      "    useNativeDriver: true,        // chạy trên UI thread, không cần JS mỗi frame",
      "  }).start();",
      "}, []);",
      "",
      "<Animated.View style={{ opacity }} />",
      "// ✗ useNativeDriver: true với 'height' → lỗi: thuộc tính không được hỗ trợ"
    ]},
    { id: "rea", label: "② Reanimated", lines: [
      "import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';",
      "import { Gesture, GestureDetector } from 'react-native-gesture-handler';",
      "",
      "function DraggableCard() {",
      "  const x = useSharedValue(0);",
      "  const pan = Gesture.Pan()",
      "    .onUpdate(e => { x.value = e.translationX; })   // worklet: chạy trên UI thread",
      "    .onEnd(() => { x.value = withSpring(0); });",
      "  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));",
      "  return (",
      "    <GestureDetector gesture={pan}>",
      "      <Animated.View style={[styles.card, style]} />",
      "    </GestureDetector>",
      "  );",
      "}"
    ]},
    { id: "compose", label: "③ Compose deferred read", lines: [
      "val offsetX by animateFloatAsState(if (open) 300f else 0f, label = \"drawer\")",
      "",
      "// ✗ đọc ở composition → recompose mỗi frame",
      "Box(Modifier.offset(x = offsetX.dp))",
      "",
      "// ✓ đọc ở layout",
      "Box(Modifier.offset { IntOffset(offsetX.roundToInt(), 0) })",
      "",
      "// ✓ đọc ở draw (rẻ nhất cho translate/alpha)",
      "Box(Modifier.graphicsLayer { translationX = offsetX; alpha = 1f - offsetX / 600f })",
      "",
      "// Cuộn: chỉ recompose khi vượt ngưỡng",
      "val showTop by remember { derivedStateOf { listState.firstVisibleItemIndex > 5 } }"
    ]},
    { id: "swiftui", label: "④ SwiftUI", lines: [
      "struct AddToCartButton: View {",
      "    @State private var pressed = false",
      "    var body: some View {",
      "        Button(\"Thêm vào giỏ\") { pressed.toggle() }",
      "            .scaleEffect(pressed ? 0.95 : 1)          // ✓ transform, không đổi layout",
      "            .opacity(pressed ? 0.8 : 1)",
      "            .animation(.spring(duration: 0.25), value: pressed)",
      "        // ✗ .frame(width: pressed ? 200 : 220) → layout lại cả hàng mỗi frame",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="jsanim"><div class="nl">🟨 Tính trên JS thread</div><div class="ns">Animated không native driver</div></div>
      <div class="node" id="uianim"><div class="nl">🧵 Tính trên UI thread</div><div class="ns">native driver · Reanimated · Core Animation</div></div>
    </div>
    <div class="arrow" id="a1">↓ thuộc tính thay đổi</div>
    <div class="row">
      <div class="node" id="layout"><div class="nl">📐 width/height/margin</div><div class="ns">layout lại mỗi frame — đắt</div></div>
      <div class="node" id="xform"><div class="nl">✨ transform / opacity</div><div class="ns">chỉ vẽ/ghép lớp — rẻ</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="phase"><div class="nl">🎚️ Compose: composition → layout → draw</div><div class="ns">đọc state càng muộn càng rẻ</div></div>
  `,
  steps: [
    { title: "1 · Chuyển animation sang UI thread", tab: "animated", highlight: [4, 7, 11], on: ["jsanim", "uianim"],
      desc: "Native driver gửi cấu hình animation một lần; mỗi frame được tính trên UI thread nên JS bận cũng không giật." },
    { title: "2 · Native driver có giới hạn", tab: "animated", highlight: [12], on: ["a1", "layout"],
      desc: "Chỉ hỗ trợ thuộc tính không phải layout. Muốn animate height → dùng Reanimated hoặc đổi sang scaleY." },
    { title: "3 · Reanimated + gesture", tab: "rea", highlight: [5, 7, 8, 9, 11], on: ["uianim", "xform"],
      desc: "Worklet trong onUpdate và useAnimatedStyle chạy trên UI thread; ngón tay kéo tới đâu card theo tới đó." },
    { title: "4 · Compose: đọc state muộn", tab: "compose", highlight: [4, 7, 10], on: ["a2", "phase"],
      desc: "Cùng một animation: bản 1 recompose mỗi frame, bản 2 chỉ layout, bản 3 chỉ vẽ lại lớp." },
    { title: "5 · derivedStateOf", tab: "compose", highlight: [13], on: ["phase"],
      desc: "firstVisibleItemIndex đổi liên tục khi cuộn, nhưng UI chỉ recompose khi kết quả so sánh > 5 đổi." },
    { title: "6 · SwiftUI: transform thay vì frame", tab: "swiftui", highlight: [5, 6, 7, 8], on: ["xform"],
      desc: "scaleEffect/opacity không làm thay đổi layout của các view xung quanh; đổi frame thì có." }
  ],

  quiz: [
    { q: "useNativeDriver: true mang lại lợi ích gì?", options: [
        "Animation chạy trên GPU của server",
        "Animation được tính trên UI thread, không phụ thuộc JS thread mỗi frame",
        "Hỗ trợ animate mọi thuộc tính",
        "Giảm bundle size"
      ], correct: 1, explanation: "JS thread bận cũng không làm animation giật." },
    { q: "Thuộc tính nào KHÔNG dùng được với native driver của Animated?", options: [
        "opacity", "transform translateX", "height", "transform scale"
      ], correct: 2, explanation: "Native driver chỉ cho thuộc tính không phải layout." },
    { q: "Worklet trong Reanimated là gì?", options: [
        "Một web worker",
        "Hàm JS nhỏ được chạy trên UI thread (runtime riêng) để cập nhật animation/gesture",
        "Native module Java",
        "Một loại component"
      ], correct: 1, explanation: "Nhờ vậy gesture và animation không phải đi qua JS thread." },
    { q: "Vì sao animate transform/opacity rẻ hơn width/height?", options: [
        "Vì ít ký tự hơn",
        "Transform/opacity chỉ cần vẽ/ghép lớp; width/height buộc tính lại layout mỗi frame",
        "Vì GPU không hỗ trợ width",
        "Không có khác biệt"
      ], correct: 1, explanation: "Layout lan ra cả các view xung quanh." },
    { q: "Trong Compose, Modifier nào đọc state animation ở pha draw?", options: [
        "Modifier.offset(x = v.dp)", "Modifier.graphicsLayer { translationX = v }", "Modifier.padding(v.dp)", "Modifier.width(v.dp)"
      ], correct: 1, explanation: "graphicsLayer lambda chỉ chạy lại ở pha draw." },
    { q: "Modifier.offset { IntOffset(...) } (dạng lambda) khác offset(x.dp) thế nào?", options: [
        "Không khác",
        "Dạng lambda đọc state ở pha layout nên bỏ qua recomposition mỗi frame",
        "Dạng lambda chậm hơn",
        "Dạng lambda chỉ dùng cho text"
      ], correct: 1, explanation: "Deferred read." },
    { q: "derivedStateOf dùng khi nào?", options: [
        "Khi cần gọi API",
        "Khi state nguồn đổi liên tục nhưng UI chỉ phụ thuộc một kết quả suy ra ít thay đổi",
        "Khi tạo animation spring",
        "Khi lưu state xuống đĩa"
      ], correct: 1, explanation: "Giảm số lần recompose." },
    { q: "Reanimated 4 yêu cầu gì?", options: [
        "Kiến trúc cũ", "Kiến trúc mới của RN", "Flipper", "Không dùng Hermes"
      ], correct: 1, explanation: "Reanimated 4 chỉ hỗ trợ new architecture." },
    { q: "Gesture kéo thả mượt trong RN nên dùng tổ hợp nào?", options: [
        "PanResponder + setState mỗi frame",
        "react-native-gesture-handler + Reanimated",
        "ScrollView lồng nhau",
        "setInterval 16 ms"
      ], correct: 1, explanation: "Xử lý cử chỉ và cập nhật style đều trên UI thread." }
  ]
});
