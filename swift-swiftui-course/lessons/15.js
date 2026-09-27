window.LESSONS.push({
  id: "15",
  phase: "3", phaseName: "SwiftUI",
  title: "@Observable, @Bindable, @Environment: state dùng chung",
  subtitle: "Observation framework (iOS 17) · theo dõi theo từng property · sở hữu bằng @State · tiêm qua environment",

  theory: `
    <p><code>@State</code> hợp với giá trị nhỏ của một view. Dữ liệu dùng chung nhiều màn hình (giỏ hàng, phiên đăng nhập) và logic nghiệp vụ cần một <strong>class</strong> (có danh tính, bài 03). Từ iOS 17, cách chuẩn là macro <strong><code>@Observable</code></strong> (framework Observation).</p>

    <p><strong>Cơ chế</strong></p>
    <ul>
      <li><code>@Observable</code> là <em>macro</em>: compiler viết lại mỗi stored property thành getter/setter có gọi <code>access</code> (khi đọc) và <code>withMutation</code> (khi ghi) tới một registrar ẩn.</li>
      <li>Khi SwiftUI đánh giá <code>body</code>, nó ghi nhận <strong>những property nào được đọc</strong>. Chỉ khi chính những property đó đổi, body mới chạy lại. View chỉ đọc <code>cart.count</code> sẽ không vẽ lại khi <code>cart.note</code> đổi.</li>
      <li>So với cách cũ <code>ObservableObject</code> + <code>@Published</code> (Combine): bất kỳ <code>@Published</code> nào đổi cũng làm mọi view quan sát object vẽ lại → dễ thừa. Code cũ còn gặp <code>@StateObject</code>, <code>@ObservedObject</code>, <code>@EnvironmentObject</code> — đều thuộc mô hình cũ.</li>
    </ul>

    <p><strong>Bốn vai trò</strong></p>
    <table>
      <tr><th>Cần gì</th><th>Viết</th><th>Mô hình cũ</th></tr>
      <tr><td>View <strong>tạo và sở hữu</strong> object</td><td><code>@State private var model = CartModel()</code></td><td><code>@StateObject</code></td></tr>
      <tr><td>Nhận object từ cha, chỉ đọc/gọi method</td><td><code>let model: CartModel</code> (hoặc <code>var</code>) — không cần wrapper</td><td><code>@ObservedObject</code></td></tr>
      <tr><td>Cần <strong>Binding</strong> tới property của object (<code>TextField</code>)</td><td><code>@Bindable var model: CartModel</code> → <code>$model.note</code></td><td><code>@ObservedObject</code> + <code>$</code></td></tr>
      <tr><td>Lấy object ở tầng sâu, không truyền tay qua từng cấp</td><td><code>@Environment(CartModel.self) private var cart</code>; gốc gắn <code>.environment(cart)</code></td><td><code>@EnvironmentObject</code></td></tr>
    </table>
    <p>Vì sao sở hữu phải dùng <code>@State</code>? Struct View bị tạo lại liên tục; nếu viết <code>let model = CartModel()</code> thì mỗi lần cha vẽ lại lại tạo object mới, mất dữ liệu. <code>@State</code> giữ instance theo danh tính view.</p>

    <p><strong>@Environment</strong> còn đọc các giá trị hệ thống qua key path: <code>@Environment(&#92;.dismiss)</code>, <code>&#92;.colorScheme</code>, <code>&#92;.scenePhase</code>, <code>&#92;.locale</code>. Tự định nghĩa giá trị environment mới bằng macro <code>@Entry</code> trong <code>extension EnvironmentValues</code>. Environment là cơ chế DI của SwiftUI — gần với React Context. Thiếu <code>.environment(obj)</code> ở tổ tiên mà view đọc <code>@Environment(Type.self)</code> (không optional) → crash lúc chạy.</p>

    <div class="callout"><p>💡 Nhớ nhanh: <strong>class @Observable</strong> chứa dữ liệu; <strong>@State</strong> để sở hữu; <strong>let</strong> để truyền; <strong>@Bindable</strong> khi cần <code>$</code>; <strong>@Environment</strong> khi truyền xa.</p></div>
  `,

  codeTabs: [
    { id: "model", label: "@Observable", lines: [
      "import Observation",
      "",
      "@MainActor @Observable",
      "final class CartModel {",
      "    var items: [CartItem] = []",
      "    var note = \"\"",
      "    var count: Int { items.reduce(0) { $0 + $1.qty } }   // computed: theo dõi qua items",
      "",
      "    func add(_ p: Product) {",
      "        if let i = items.firstIndex(where: { $0.sku == p.sku }) { items[i].qty += 1 }",
      "        else { items.append(CartItem(sku: p.sku, qty: 1)) }",
      "    }",
      "}"
    ]},
    { id: "own", label: "Sở hữu & tiêm", lines: [
      "@main",
      "struct ShopApp: App {",
      "    @State private var cart = CartModel()     // sở hữu: sống cùng App",
      "    var body: some Scene {",
      "        WindowGroup {",
      "            RootView()",
      "                .environment(cart)             // tiêm cho cả cây",
      "        }",
      "    }",
      "}"
    ]},
    { id: "use", label: "Dùng ở view", lines: [
      "struct CartBadge: View {",
      "    @Environment(CartModel.self) private var cart",
      "    var body: some View {",
      "        Text(\"\\(cart.count)\")          // chỉ phụ thuộc items (qua count)",
      "    }",
      "}",
      "",
      "struct NoteEditor: View {",
      "    @Bindable var cart: CartModel",
      "    var body: some View {",
      "        TextField(\"Ghi chú\", text: $cart.note)   // cần Binding → @Bindable",
      "    }",
      "}",
      "",
      "struct CartScreen: View {",
      "    @Environment(CartModel.self) private var cart",
      "    var body: some View {",
      "        @Bindable var cart = cart               // tạo Bindable tại chỗ",
      "        TextField(\"Ghi chú\", text: $cart.note)",
      "    }",
      "}"
    ]},
    { id: "old", label: "Cách cũ (iOS 13–16)", lines: [
      "final class CartStore: ObservableObject {",
      "    @Published var items: [CartItem] = []",
      "    @Published var note = \"\"   // đổi note → MỌI view quan sát đều vẽ lại",
      "}",
      "",
      "struct OldRoot: View {",
      "    @StateObject private var store = CartStore()",
      "    var body: some View { OldChild().environmentObject(store) }",
      "}",
      "struct OldChild: View {",
      "    @EnvironmentObject var store: CartStore",
      "    var body: some View { Text(\"\\(store.items.count)\") }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">ShopApp</div><div class="ns">@State cart = CartModel()</div></div>
    <div class="arrow" id="a1">↓ .environment(cart)</div>
    <div class="row">
      <div class="node" id="badge"><div class="nl">CartBadge</div><div class="ns">đọc cart.count</div></div>
      <div class="node" id="note"><div class="nl">NoteEditor</div><div class="ns">@Bindable → $cart.note</div></div>
    </div>
    <div class="arrow" id="a2">↑ đổi note: chỉ NoteEditor vẽ lại (badge không đọc note)</div>
    <div class="node" id="reg"><div class="nl">Observation registrar</div><div class="ns">ghi nhận property nào view đã đọc</div></div>
  `,
  steps: [
    { title: "1 · Macro @Observable", tab: "model", highlight: [3, 4, 5, 6, 7], on: ["reg"],
      desc: "Mỗi stored property được viết lại để báo đọc/ghi. Computed property phụ thuộc gián tiếp qua property nó đọc." },
    { title: "2 · Sở hữu bằng @State", tab: "own", highlight: [3], on: ["app"],
      desc: "Không có <code>@StateObject</code> nữa: <code>@State</code> giữ instance class theo danh tính." },
    { title: "3 · Tiêm qua environment", tab: "own", highlight: [6, 7], on: ["a1"],
      desc: "Mọi view con cháu lấy được bằng <code>@Environment(CartModel.self)</code> — không truyền tay qua từng tầng." },
    { title: "4 · Theo dõi chính xác", tab: "use", highlight: [2, 4], on: ["badge", "reg"],
      desc: "CartBadge chỉ đọc <code>count</code> → chỉ vẽ lại khi <code>items</code> đổi." },
    { title: "5 · @Bindable khi cần $", tab: "use", highlight: [9, 11, 18, 19], on: ["note", "a2"],
      desc: "Object @Observable không tự có <code>$</code>. <code>@Bindable</code> (ở property hoặc local trong body) tạo Binding tới property." },
    { title: "6 · Mô hình cũ để đọc code legacy", tab: "old", highlight: [1, 2, 3, 7, 8, 11], on: ["app"],
      desc: "ObservableObject/@Published: thông báo ở mức object, mọi view quan sát vẽ lại. Vẫn gặp nhiều trong code iOS 16 trở xuống." }
  ],

  quiz: [
    { q: "@Observable cần tối thiểu iOS nào?", options: [
        "iOS 13", "iOS 15", "iOS 17", "iOS 18"
      ], correct: 2, explanation: "Framework Observation ra mắt cùng iOS 17/macOS 14." },
    { q: "View tự tạo và sở hữu một CartModel @Observable nên khai báo?", options: [
        "let model = CartModel()", "@State private var model = CartModel()", "@Binding var model", "@Environment var model"
      ], correct: 1, explanation: "@State giữ instance qua các lần struct View được tạo lại." },
    { q: "View A chỉ đọc cart.count; property cart.note đổi. A có vẽ lại không?", options: [
        "Có, như ObservableObject", "Không — Observation chỉ theo dõi property A đã đọc", "Crash", "Tuỳ iOS"
      ], correct: 1, explanation: "Theo dõi ở mức property, không phải object." },
    { q: "Cần TextField(text: $model.note) với model @Observable truyền từ cha. Khai báo?", options: [
        "@Binding var model", "@Bindable var model: CartModel", "@State var model", "@ObservedObject var model"
      ], correct: 1, explanation: "@Bindable cung cấp projected value để tạo Binding tới property." },
    { q: "Truyền object @Observable cho view con chỉ để hiển thị cần wrapper gì?", options: [
        "@ObservedObject", "Không cần — let/var thường là đủ, việc theo dõi vẫn hoạt động", "@State", "@Published"
      ], correct: 1, explanation: "Observation theo dõi lúc body đọc, không cần wrapper." },
    { q: "View dùng @Environment(CartModel.self) nhưng tổ tiên không gắn .environment(cart)?", options: [
        "Tự tạo CartModel mới", "Crash lúc chạy", "Trả nil", "Lỗi biên dịch"
      ], correct: 1, explanation: "Dạng không optional yêu cầu object phải có trong environment." },
    { q: "Tương đương @StateObject trong mô hình mới là?", options: [
        "@Bindable", "@State", "@Environment", "@Observable"
      ], correct: 1, explanation: "@State + class @Observable." },
    { q: "@Environment(\\.dismiss) dùng để?", options: [
        "Xoá view khỏi bộ nhớ", "Lấy action đóng màn hình/sheet hiện tại", "Đọc chế độ tối", "Huỷ Task"
      ], correct: 1, explanation: "Gọi dismiss() để pop hoặc đóng sheet." },
    { q: "Vấn đề hiệu năng của ObservableObject + @Published so với @Observable?", options: [
        "Không có",
        "Đổi bất kỳ @Published nào cũng làm mọi view quan sát object vẽ lại",
        "Không hỗ trợ class",
        "Chỉ chạy trên thread nền"
      ], correct: 1, explanation: "objectWillChange phát ở mức object." },
    { q: "Environment của SwiftUI gần nhất với khái niệm nào của React?", options: [
        "useState", "Context (Provider/useContext)", "useRef", "Redux middleware"
      ], correct: 1, explanation: "Truyền giá trị/đối tượng xuống cây mà không qua props từng tầng." }
  ]
});
