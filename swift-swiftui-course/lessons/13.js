window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "SwiftUI",
  title: "View là struct: body, danh tính và diffing",
  subtitle: "View là mô tả, không phải đối tượng trên màn hình · structural vs explicit identity · khi nào body chạy lại",

  theory: `
    <p>Dev UIKit/Android cũ nghĩ "view là object sống trên màn hình, tôi giữ tham chiếu và gọi <code>setText</code>". SwiftUI (giống React) đảo ngược: <strong>View là một struct nhỏ, rẻ, chỉ là mô tả</strong> — "với dữ liệu này, UI trông như thế này". SwiftUI giữ riêng một cây nội bộ (attribute graph) cho những gì đang hiển thị, và tự cập nhật màn hình khi dữ liệu đổi.</p>

    <ul>
      <li><code>struct ProductRow: View { let product: Product; var body: some View { ... } }</code>. Protocol <code>View</code> chỉ yêu cầu một thứ: <code>body</code>.</li>
      <li>Giá trị struct View bị tạo và vứt liên tục — <strong>không</strong> lưu state trong property thường của View (sẽ mất). State nằm trong <code>@State</code> (bài 14), được SwiftUI lưu bên ngoài struct.</li>
      <li><code>body</code> nên là hàm thuần, rẻ: không gọi mạng, không nặng CPU, không side effect. Nó có thể chạy rất nhiều lần.</li>
      <li><code>some View</code>: kiểu thật của body là một kiểu generic lồng nhau rất dài (<code>VStack&lt;TupleView&lt;(Text, Button&lt;Text&gt;)&gt;&gt;</code>) — compiler biết, bạn không cần viết ra. Nhờ kiểu tĩnh này SwiftUI biết cấu trúc cây mà không phải so sánh động.</li>
    </ul>

    <p><strong>Khi nào body chạy lại?</strong> Khi một dependency mà body <em>đã đọc</em> thay đổi: <code>@State</code>, <code>@Binding</code>, property của object <code>@Observable</code> được đọc trong body, giá trị <code>@Environment</code>, hoặc view cha truyền vào tham số khác. SwiftUI so sánh giá trị View mới với cũ và chỉ cập nhật phần khác biệt (diffing) — giống virtual DOM của React.</p>

    <p><strong>Danh tính (identity) — khái niệm quan trọng nhất</strong>. SwiftUI cần biết "view này bây giờ có phải là view lúc nãy không" để giữ state và chạy animation đúng:</p>
    <ul>
      <li><strong>Structural identity</strong>: vị trí + kiểu trong cây. Hai nhánh <code>if/else</code> là hai view khác danh tính: chuyển nhánh → view cũ bị huỷ (mất <code>@State</code>), view mới được tạo, animation là transition thay vì di chuyển.</li>
      <li><strong>Explicit identity</strong>: <code>ForEach(items)</code> với <code>Identifiable</code>, hoặc <code>.id(x)</code>. Đổi <code>.id</code> = ép tạo view mới (reset state). Giống <code>key</code> trong React.</li>
      <li><strong>Lifetime</strong>: state sống bằng danh tính, không phải bằng giá trị struct.</li>
    </ul>
    <p>Vì vậy, ưu tiên thay đổi <em>modifier</em> (<code>.opacity(isOn ? 1 : 0.5)</code>) thay vì tách <code>if/else</code> hai view giống nhau; tránh <code>AnyView</code> vì nó xoá thông tin kiểu, SwiftUI khó diff.</p>

    <div class="callout"><p>💡 RN ↔ SwiftUI: component function ↔ struct View; props ↔ <code>let</code> property; <code>key</code> ↔ <code>id</code>; re-render ↔ body được đánh giá lại. Khác biệt: SwiftUI theo dõi dependency chính xác tới từng property (với <code>@Observable</code>), không re-render cả cây con mặc định như React.</p></div>
  `,

  codeTabs: [
    { id: "view", label: "View cơ bản", lines: [
      "struct ProductRow: View {",
      "    let product: Product            // như props: chỉ đọc",
      "",
      "    var body: some View {",
      "        HStack {",
      "            Text(product.name)",
      "            Spacer()",
      "            Text(product.price, format: .currency(code: \"VND\"))",
      "        }",
      "    }",
      "}",
      "",
      "#Preview { ProductRow(product: .sample) }"
    ]},
    { id: "identity", label: "Danh tính", lines: [
      "// ❌ hai nhánh = hai view khác danh tính: state của Counter bị reset",
      "if isHighlighted {",
      "    Counter().background(.yellow)",
      "} else {",
      "    Counter()",
      "}",
      "",
      "// ✅ một view, chỉ đổi modifier: giữ state, animation mượt",
      "Counter().background(isHighlighted ? .yellow : .clear)",
      "",
      "ProfileView(user: user).id(user.id)   // đổi user → reset toàn bộ state"
    ]},
    { id: "foreach", label: "ForEach & id", lines: [
      "struct Product: Identifiable { let id: String; var name: String }",
      "",
      "ForEach(products) { p in           // id từ Identifiable",
      "    ProductRow(product: p)",
      "}",
      "",
      "ForEach(names, id: \\.self) { Text($0) }   // dùng chính giá trị làm id",
      "",
      "// ❌ ForEach(products.indices, id: \\.self) — xoá 1 phần tử làm lệch danh tính"
    ]},
    { id: "rn", label: "So với React Native", lines: [
      "function ProductRow({ product }) {",
      "  return (",
      "    <View style={{ flexDirection: 'row' }}>",
      "      <Text>{product.name}</Text>",
      "      <Text>{formatVND(product.price)}</Text>",
      "    </View>",
      "  );",
      "}",
      "products.map(p => <ProductRow key={p.id} product={p} />)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="data"><div class="nl">Dữ liệu đổi</div><div class="ns">@State / @Observable / tham số</div></div>
    <div class="arrow" id="a1">↓ đánh giá lại body của view phụ thuộc</div>
    <div class="node" id="value"><div class="nl">Giá trị View mới (struct)</div><div class="ns">rẻ, tạo rồi bỏ</div></div>
    <div class="arrow" id="a2">↓ so với lần trước theo danh tính</div>
    <div class="row">
      <div class="node" id="same"><div class="nl">Cùng danh tính</div><div class="ns">giữ state, cập nhật khác biệt</div></div>
      <div class="node" id="new"><div class="nl">Danh tính mới</div><div class="ns">huỷ view cũ + state, tạo mới</div></div>
    </div>
    <div class="node" id="screen"><div class="nl">Màn hình</div><div class="ns">chỉ phần thay đổi được vẽ lại</div></div>
  `,
  steps: [
    { title: "1 · View chỉ là mô tả", tab: "view", highlight: [1, 2, 4, 5, 6, 8], on: ["value"],
      desc: "Struct với <code>body</code>. Không có <code>setText</code>; muốn đổi chữ thì đổi dữ liệu." },
    { title: "2 · body chạy lại khi dependency đổi", tab: "view", highlight: [4, 6, 8], on: ["data", "a1", "value"],
      desc: "body phải rẻ và thuần. Đừng gọi API hay tạo object nặng trong body." },
    { title: "3 · Structural identity", tab: "identity", highlight: [1, 2, 3, 4, 5], on: ["a2", "new"],
      desc: "if/else tạo hai danh tính khác nhau; chuyển nhánh là huỷ view và mất @State." },
    { title: "4 · Đổi modifier thay vì đổi view", tab: "identity", highlight: [8, 9], on: ["same", "screen"],
      desc: "Cùng danh tính → giữ state, SwiftUI chỉ cập nhật màu nền." },
    { title: "5 · Explicit identity", tab: "foreach", highlight: [1, 3, 7, 9], on: ["same", "new"],
      desc: "<code>ForEach</code> dùng id ổn định. Dùng index làm id là sai khi thêm/xoá phần tử — giống lỗi key={index} trong React." },
    { title: "6 · Đối chiếu RN", tab: "rn", highlight: [1, 9], on: ["value"],
      desc: "Cùng mô hình declarative. <code>.id(user.id)</code> trong SwiftUI tương đương đổi <code>key</code> để remount trong React." }
  ],

  quiz: [
    { q: "View trong SwiftUI là gì?", options: [
        "Object sống trên màn hình, giữ tham chiếu để cập nhật",
        "Struct nhẹ mô tả UI cho một trạng thái dữ liệu; SwiftUI tự quản lý phần hiển thị thật",
        "Subclass của UIView",
        "Một file XML"
      ], correct: 1, explanation: "Declarative như React." },
    { q: "Lưu state trong var thường của struct View (không property wrapper) thì?", options: [
        "Hoạt động bình thường",
        "Không được — struct bị tạo lại liên tục, và body không sửa được self",
        "Tự đồng bộ",
        "Lưu vào UserDefaults"
      ], correct: 1, explanation: "Dùng @State để SwiftUI lưu state bên ngoài struct." },
    { q: "body của một View chạy lại khi nào?", options: [
        "Mỗi frame 60 lần/giây",
        "Khi dependency body đã đọc thay đổi (state, binding, observable property, environment, tham số)",
        "Chỉ một lần",
        "Khi gọi setNeedsDisplay"
      ], correct: 1, explanation: "SwiftUI theo dõi dependency." },
    { q: "Chuyển qua lại giữa hai nhánh if/else chứa cùng loại view thì state bên trong?", options: [
        "Giữ nguyên", "Bị reset vì hai nhánh là hai danh tính khác nhau", "Được copy sang", "Crash"
      ], correct: 1, explanation: "Structural identity dựa vào vị trí trong cây." },
    { q: "Cách giữ state khi chỉ muốn đổi màu nền theo điều kiện?", options: [
        "Dùng if/else hai view", "Một view, đổi giá trị trong modifier: .background(cond ? .yellow : .clear)", "Dùng AnyView", "Dùng .id(UUID())"
      ], correct: 1, explanation: "Giữ nguyên danh tính." },
    { q: ".id(user.id) trên một view có tác dụng?", options: [
        "Không gì",
        "Gắn explicit identity; khi user.id đổi, view được tạo mới và state reset",
        "Đặt accessibility id",
        "Sắp xếp view"
      ], correct: 1, explanation: "Giống đổi key trong React để remount." },
    { q: "Vì sao dùng index làm id trong ForEach là rủi ro?", options: [
        "Chậm",
        "Thêm/xoá phần tử làm danh tính lệch sang phần tử khác → state/animation sai",
        "Không biên dịch",
        "Index không Hashable"
      ], correct: 1, explanation: "Dùng id ổn định từ dữ liệu." },
    { q: "Vì sao nên tránh AnyView?", options: [
        "Không tồn tại",
        "Xoá thông tin kiểu tĩnh, SwiftUI khó so sánh và tối ưu cây",
        "Chỉ dùng trên macOS",
        "Gây crash"
      ], correct: 1, explanation: "Dùng @ViewBuilder hoặc some View thay thế." },
    { q: "Tương đương props của React trong SwiftUI?", options: [
        "@State", "Các let property của struct View truyền vào qua init", "@Environment", "UserDefaults"
      ], correct: 1, explanation: "View cha tạo view con với tham số." }
  ]
});
