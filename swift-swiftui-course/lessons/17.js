window.LESSONS.push({
  id: "17",
  phase: "3", phaseName: "SwiftUI",
  title: "Modifier: mỗi lần gọi là một lớp bọc mới — thứ tự quan trọng",
  subtitle: "ModifiedContent · padding trước/sau background · modifier kế thừa xuống cây · ViewModifier tự viết",

  theory: `
    <p>Trong RN, <code>style={{ padding: 16, backgroundColor: 'red' }}</code> là một object thuộc tính — thứ tự key không quan trọng. Trong SwiftUI, <code>.padding().background(.red)</code> <strong>không</strong> "đặt thuộc tính" cho view. Mỗi modifier trả về <strong>một view mới bọc view cũ</strong> (kiểu <code>ModifiedContent&lt;Content, Modifier&gt;</code>). Chuỗi modifier là một chuỗi lớp bọc từ trong ra ngoài.</p>

    <p><strong>Hệ quả: thứ tự thay đổi kết quả</strong></p>
    <ul>
      <li><code>Text("Mua").padding().background(.orange)</code>: padding bọc Text trước (to ra), background tô cả vùng đã có padding → nút có nền rộng.</li>
      <li><code>Text("Mua").background(.orange).padding()</code>: nền chỉ ôm sát chữ, padding thêm khoảng trống trong suốt bên ngoài.</li>
      <li><code>.frame(width: 200).background(.blue)</code> vs <code>.background(.blue).frame(width: 200)</code>: cái đầu nền rộng 200; cái sau nền chỉ ôm nội dung, khung 200 trống hai bên.</li>
      <li>Vùng chạm: <code>.onTapGesture</code> chỉ nhận chạm ở phần có nội dung; thêm <code>.contentShape(.rect)</code> để chạm được cả vùng trống — và phải đặt đúng chỗ trong chuỗi.</li>
    </ul>

    <p><strong>Hai loại modifier</strong></p>
    <table>
      <tr><th>Loại</th><th>Ví dụ</th><th>Hành vi</th></tr>
      <tr><td>Bọc/biến đổi layout</td><td><code>padding</code>, <code>frame</code>, <code>offset</code>, <code>background</code>, <code>overlay</code>, <code>clipShape</code></td><td>Tạo lớp mới, thứ tự quyết định kết quả</td></tr>
      <tr><td>Environment (lan xuống cây)</td><td><code>.font</code>, <code>.foregroundStyle</code>, <code>.tint</code>, <code>.disabled</code>, <code>.environment</code></td><td>Áp cho mọi con cháu; con gần hơn ghi đè được. Như CSS kế thừa</td></tr>
    </table>
    <p>Ví dụ: <code>VStack { Text("A"); Text("B").font(.title) }.font(.caption)</code> → A là caption, B là title.</p>

    <p><strong>Tái sử dụng</strong>: gom chuỗi modifier thành <code>struct PrimaryButtonStyle: ViewModifier</code> với <code>func body(content: Content) -&gt; some View</code>, rồi thêm <code>extension View { func primaryButton() -&gt; some View { modifier(PrimaryButtonStyle()) } }</code>. Với nút có sẵn protocol riêng <code>ButtonStyle</code> (biết trạng thái <code>isPressed</code>). Đây là cách làm "design system" thay cho <code>StyleSheet.create</code> của RN.</p>

    <p><strong>Modifier có điều kiện</strong>: tránh tự viết <code>.if(cond) { $0.xxx }</code> — nó tạo hai nhánh khác danh tính (bài 13), làm mất state/animation. Ưu tiên truyền điều kiện vào tham số: <code>.opacity(enabled ? 1 : 0.4)</code>, <code>.disabled(!enabled)</code>.</p>

    <div class="callout"><p>💡 Chuỗi modifier rất rẻ: chúng chỉ là các struct lồng nhau, compiler biết trọn kiểu, SwiftUI gộp chúng khi render. Đừng ngại viết dài; hãy ngại viết sai thứ tự.</p></div>
  `,

  codeTabs: [
    { id: "order", label: "Thứ tự", lines: [
      "// A: nền rộng, bo góc cả vùng padding",
      "Text(\"Mua ngay\")",
      "    .padding(.horizontal, 24).padding(.vertical, 12)",
      "    .background(.orange)",
      "    .clipShape(.capsule)",
      "",
      "// B: nền ôm sát chữ, padding trong suốt bên ngoài",
      "Text(\"Mua ngay\")",
      "    .background(.orange)",
      "    .padding(.horizontal, 24).padding(.vertical, 12)"
    ]},
    { id: "type", label: "Kiểu thật", lines: [
      "let v = Text(\"Mua\").padding().background(.orange)",
      "",
      "// type(of: v) ==   (tên kiểu nội bộ, có thể khác theo phiên bản iOS)",
      "// ModifiedContent<",
      "//     ModifiedContent<Text, _PaddingLayout>,",
      "//     _BackgroundStyleModifier<Color>",
      "// >",
      "// → mỗi modifier là 1 lớp bọc; lớp ngoài cùng là modifier gọi sau cùng"
    ]},
    { id: "env", label: "Modifier lan xuống", lines: [
      "VStack(alignment: .leading) {",
      "    Text(\"Đơn #1024\")",
      "    Text(\"Đang giao\").font(.headline)     // ghi đè",
      "    Button(\"Huỷ đơn\") { cancel() }",
      "}",
      ".font(.caption)                        // áp cho mọi Text bên trong",
      ".foregroundStyle(.secondary)",
      ".disabled(order.isShipped)             // vô hiệu hoá mọi control bên trong"
    ]},
    { id: "custom", label: "ViewModifier & ButtonStyle", lines: [
      "struct CardStyle: ViewModifier {",
      "    func body(content: Content) -> some View {",
      "        content",
      "            .padding(16)",
      "            .background(.background, in: .rect(cornerRadius: 12))",
      "            .shadow(color: .black.opacity(0.08), radius: 8, y: 2)",
      "    }",
      "}",
      "extension View { func card() -> some View { modifier(CardStyle()) } }",
      "",
      "struct PrimaryButton: ButtonStyle {",
      "    func makeBody(configuration: Configuration) -> some View {",
      "        configuration.label",
      "            .padding(.vertical, 12).frame(maxWidth: .infinity)",
      "            .background(.orange.opacity(configuration.isPressed ? 0.7 : 1), in: .capsule)",
      "    }",
      "}",
      "// dùng: ProductCard(p).card()   Button(\"Thanh toán\") { }.buttonStyle(PrimaryButton())"
    ]}
  ],

  stageHtml: `
    <div class="node" id="text"><div class="nl">Text("Mua ngay")</div><div class="ns">lõi</div></div>
    <div class="arrow" id="a1">↓ bọc</div>
    <div class="node" id="pad"><div class="nl">.padding(24, 12)</div><div class="ns">view mới to hơn</div></div>
    <div class="arrow" id="a2">↓ bọc</div>
    <div class="node" id="bg"><div class="nl">.background(.orange)</div><div class="ns">tô theo kích thước lớp bên trong nó</div></div>
    <div class="arrow" id="a3">↓ bọc</div>
    <div class="node" id="clip"><div class="nl">.clipShape(.capsule)</div><div class="ns">lớp ngoài cùng</div></div>
  `,
  steps: [
    { title: "1 · Mỗi modifier là một lớp bọc", tab: "type", highlight: [1, 4, 5, 6, 8], on: ["text", "a1", "pad"],
      desc: "Kiểu thật là <code>ModifiedContent</code> lồng nhau. Không có 'thuộc tính padding' trên Text." },
    { title: "2 · padding rồi background", tab: "order", highlight: [2, 3, 4, 5], on: ["a2", "bg", "a3", "clip"],
      desc: "Background tô kích thước của lớp bên trong nó — đã gồm padding. Kết quả: nút viên thuốc." },
    { title: "3 · Đảo thứ tự", tab: "order", highlight: [8, 9, 10], on: ["bg", "pad"],
      desc: "Nền chỉ ôm chữ; padding thêm vùng trống trong suốt. Cùng modifier, khác thứ tự, khác kết quả." },
    { title: "4 · Modifier environment", tab: "env", highlight: [3, 6, 7, 8], on: ["text"],
      desc: "<code>.font</code>, <code>.foregroundStyle</code>, <code>.disabled</code> lan xuống con cháu; con ghi đè được." },
    { title: "5 · Đóng gói thành design system", tab: "custom", highlight: [1, 2, 9, 11, 15, 18], on: ["clip"],
      desc: "ViewModifier + extension cho cú pháp gọn; ButtonStyle biết <code>isPressed</code>." }
  ],

  quiz: [
    { q: "Một modifier như .padding() thực chất làm gì?", options: [
        "Đặt thuộc tính padding cho view gốc",
        "Trả về một view mới bọc view cũ",
        "Sửa view tại chỗ",
        "Tạo UIView mới"
      ], correct: 1, explanation: "ModifiedContent<Content, Modifier>." },
    { q: "Text(\"A\").padding().background(.red) so với Text(\"A\").background(.red).padding()?", options: [
        "Giống hệt",
        "Cái đầu nền đỏ bao cả vùng padding; cái sau nền chỉ ôm chữ",
        "Cái sau nền to hơn",
        "Cái đầu lỗi biên dịch"
      ], correct: 1, explanation: "Background lấy kích thước của lớp nằm trong nó." },
    { q: ".font(.caption) đặt trên VStack ảnh hưởng gì?", options: [
        "Chỉ VStack", "Mọi Text bên trong, trừ con tự đặt font khác", "Không gì vì VStack không có chữ", "Lỗi biên dịch"
      ], correct: 1, explanation: "Font là giá trị environment lan xuống." },
    { q: "Cách tái sử dụng một chuỗi modifier trong nhiều view?", options: [
        "Copy-paste", "Viết ViewModifier + extension View", "Kế thừa Text", "StyleSheet.create"
      ], correct: 1, explanation: "Hoặc ButtonStyle/LabelStyle cho control tương ứng." },
    { q: "Vì sao modifier .if(cond) tự chế có thể gây lỗi khó thấy?", options: [
        "Không biên dịch",
        "Tạo hai nhánh khác danh tính; đổi cond làm view bị tạo lại, mất state và animation",
        "Chậm",
        "Không hỗ trợ iOS 17"
      ], correct: 1, explanation: "Ưu tiên điều kiện trong tham số modifier." },
    { q: "Vùng trống trong HStack không nhận onTapGesture. Thêm gì?", options: [
        ".contentShape(.rect)", ".zIndex(1)", ".id()", ".opacity(1)"
      ], correct: 0, explanation: "contentShape định nghĩa vùng nhận hit-test." },
    { q: ".frame(width: 200).background(.blue) vs .background(.blue).frame(width: 200)?", options: [
        "Giống nhau",
        "Cái đầu nền xanh rộng 200; cái sau nền chỉ ôm nội dung, khung 200 còn trống",
        "Cái sau nền rộng 200",
        "Cả hai lỗi"
      ], correct: 1, explanation: "Lại là thứ tự lớp bọc." },
    { q: "ButtonStyle khác ViewModifier ở điểm nào hữu ích?", options: [
        "Không khác",
        "makeBody nhận configuration có isPressed và label để style theo trạng thái nhấn",
        "Chỉ dùng cho Text",
        "Nhanh hơn"
      ], correct: 1, explanation: "Áp bằng .buttonStyle(...), cũng lan xuống như environment." },
    { q: "Chuỗi 10 modifier có làm app chậm đáng kể không?", options: [
        "Có, mỗi modifier là một UIView",
        "Thường không — chỉ là struct lồng nhau, SwiftUI gộp khi render",
        "Có, phải giới hạn 3",
        "Chỉ trên iPad"
      ], correct: 1, explanation: "Vấn đề hiệu năng thường nằm ở body nặng hoặc invalidation thừa, không ở số modifier." }
  ]
});
