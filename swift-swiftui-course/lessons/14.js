window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "SwiftUI",
  title: "@State & @Binding: nguồn sự thật duy nhất",
  subtitle: "Property wrapper là gì · state sống theo danh tính · $ tạo Binding · luồng dữ liệu một chiều",

  theory: `
    <p><strong>Property wrapper</strong> là cơ chế ngôn ngữ: <code>@State var count = 0</code> được compiler biến thành một field ẩn <code>_count: State&lt;Int&gt;</code>; đọc/ghi <code>count</code> thực ra đi qua <code>_count.wrappedValue</code>, còn <code>$count</code> là <code>_count.projectedValue</code>. Giống annotation Spring nhưng được xử lý lúc biên dịch, không phải proxy lúc chạy.</p>

    <p><strong>@State</strong></p>
    <ul>
      <li>Khai báo state <strong>thuộc sở hữu</strong> của view. Giá trị thật được SwiftUI lưu bên ngoài struct, gắn với <em>danh tính</em> của view (bài 13) — struct bị tạo lại bao nhiêu lần, state vẫn còn; view bị huỷ thì state mất.</li>
      <li>Giá trị khởi tạo chỉ dùng <strong>lần đầu</strong>. Truyền giá trị khác vào <code>init</code> sau đó không ghi đè state đang có — lỗi rất hay gặp.</li>
      <li>Quy ước: <code>@State private var</code> — state là chuyện nội bộ của view. Dùng cho giá trị UI cục bộ: text đang gõ, toggle, sheet mở hay đóng.</li>
      <li>Ghi state từ bất kỳ đâu trong view (action của nút, <code>.task</code>) → body chạy lại. An toàn khi ghi từ main actor.</li>
    </ul>

    <p><strong>@Binding</strong> — tham chiếu <em>hai chiều</em> tới state mà view khác sở hữu. View con không sở hữu dữ liệu, chỉ đọc/ghi hộ. Cha truyền <code>$isOn</code> (dấu <code>$</code> lấy Binding từ State). Control hệ thống đều nhận Binding: <code>TextField("Email", text: $email)</code>, <code>Toggle(isOn: $on)</code>, <code>.sheet(isPresented: $showSheet)</code>.</p>

    <p><strong>Nguồn sự thật duy nhất (single source of truth)</strong>: mỗi mẩu dữ liệu chỉ có <em>một</em> chủ. Không sao chép state sang view con rồi đồng bộ bằng tay; truyền giá trị (chỉ đọc) hoặc Binding (cần ghi).</p>
    <table>
      <tr><th>Nhu cầu của view con</th><th>Nhận gì</th><th>React Native tương đương</th></tr>
      <tr><td>Chỉ hiển thị</td><td><code>let value: T</code></td><td>prop</td></tr>
      <tr><td>Hiển thị + sửa state của cha</td><td><code>@Binding var value: T</code></td><td>prop <code>value</code> + <code>onChange</code> callback</td></tr>
      <tr><td>State riêng của mình</td><td><code>@State private var</code></td><td><code>useState</code></td></tr>
    </table>

    <p>Binding còn có thể dẫn xuất: <code>$cart.items[0].qty</code> (binding tới field lồng nhau), hoặc tự tạo <code>Binding(get: { ... }, set: { ... })</code> khi cần chuyển đổi. <code>.constant(true)</code> tiện cho Preview.</p>

    <div class="callout"><p>💡 Khác <code>useState</code> của React: setter không "lên lịch", đọc lại <code>count</code> ngay sau khi gán thấy giá trị mới; và không có stale closure vì closure trong struct View đọc qua storage của SwiftUI.</p></div>
  `,

  codeTabs: [
    { id: "state", label: "@State", lines: [
      "struct QuantityStepper: View {",
      "    @State private var qty = 1          // chỉ dùng lần đầu tạo view",
      "",
      "    var body: some View {",
      "        HStack {",
      "            Button(\"−\") { qty = max(1, qty - 1) }",
      "            Text(\"\\(qty)\").monospacedDigit()",
      "            Button(\"+\") { qty += 1 }     // ghi → body chạy lại",
      "        }",
      "    }",
      "}"
    ]},
    { id: "binding", label: "@Binding", lines: [
      "struct FilterSheet: View {",
      "    @Binding var onlyInStock: Bool       // không sở hữu, đọc/ghi hộ cha",
      "    var body: some View {",
      "        Toggle(\"Chỉ còn hàng\", isOn: $onlyInStock)",
      "    }",
      "}",
      "",
      "struct CatalogView: View {",
      "    @State private var onlyInStock = false   // nguồn sự thật",
      "    @State private var showFilter = false",
      "    var body: some View {",
      "        Button(\"Lọc\") { showFilter = true }",
      "            .sheet(isPresented: $showFilter) {",
      "                FilterSheet(onlyInStock: $onlyInStock)",
      "            }",
      "    }",
      "}"
    ]},
    { id: "wrapper", label: "Bên dưới @State", lines: [
      "// Bạn viết:",
      "@State private var qty = 1",
      "",
      "// Compiler sinh (giản lược):",
      "private var _qty = State(initialValue: 1)",
      "private var qty: Int {",
      "    get { _qty.wrappedValue }",
      "    nonmutating set { _qty.wrappedValue = newValue }   // ghi vào storage ngoài struct",
      "}",
      "// $qty  ==  _qty.projectedValue   (kiểu Binding<Int>)"
    ]},
    { id: "pitfall", label: "Bẫy init", lines: [
      "struct EditName: View {",
      "    @State private var draft: String",
      "    init(name: String) { _draft = State(initialValue: name) }",
      "    var body: some View { TextField(\"Tên\", text: $draft) }",
      "}",
      "// Cha truyền name mới → draft KHÔNG đổi (state đã tồn tại theo danh tính).",
      "// Muốn reset theo dữ liệu: EditName(name: n).id(user.id)",
      "// Hoặc để cha sở hữu và truyền @Binding."
    ]},
    { id: "rn", label: "React Native", lines: [
      "function CatalogView() {",
      "  const [onlyInStock, setOnlyInStock] = useState(false);",
      "  return <FilterSheet value={onlyInStock} onChange={setOnlyInStock} />;",
      "}",
      "function FilterSheet({ value, onChange }) {",
      "  return <Switch value={value} onValueChange={onChange} />;",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="store"><div class="nl">Storage của SwiftUI</div><div class="ns">gắn với danh tính CatalogView</div></div>
    <div class="arrow" id="a1">↕ @State onlyInStock</div>
    <div class="node" id="parent"><div class="nl">CatalogView</div><div class="ns">sở hữu (source of truth)</div></div>
    <div class="arrow" id="a2">↓ $onlyInStock (Binding)</div>
    <div class="node" id="child"><div class="nl">FilterSheet</div><div class="ns">@Binding — đọc/ghi hộ</div></div>
    <div class="arrow" id="a3">↑ Toggle ghi → storage đổi → body của cả hai chạy lại</div>
  `,
  steps: [
    { title: "1 · @State sở hữu giá trị", tab: "state", highlight: [2, 6, 8], on: ["store", "a1"],
      desc: "Giá trị nằm trong storage của SwiftUI, sống theo danh tính view. Ghi → body chạy lại." },
    { title: "2 · Wrapper bên dưới", tab: "wrapper", highlight: [2, 5, 6, 7, 8, 10], on: ["store"],
      desc: "<code>nonmutating set</code>: ghi không sửa struct mà sửa storage ngoài — nên đổi được state dù body không mutating." },
    { title: "3 · Cha giữ nguồn sự thật", tab: "binding", highlight: [9, 10, 12, 13], on: ["parent"],
      desc: "<code>.sheet(isPresented:)</code> cũng nhận Binding: sheet tự đóng sẽ ghi <code>false</code> ngược lại." },
    { title: "4 · Truyền $ cho con", tab: "binding", highlight: [2, 4, 14], on: ["a2", "child", "a3"],
      desc: "Con khai báo <code>@Binding</code>, cha truyền <code>$onlyInStock</code>. Toggle ghi thẳng vào state của cha." },
    { title: "5 · Bẫy giá trị khởi tạo", tab: "pitfall", highlight: [2, 3, 6, 7], on: ["store"],
      desc: "Giá trị ban đầu chỉ dùng lần đầu. Đổi dữ liệu nguồn không reset state — dùng <code>.id</code> hoặc Binding." },
    { title: "6 · Đối chiếu RN", tab: "rn", highlight: [2, 3, 6], on: ["parent", "child"],
      desc: "RN truyền value + callback; SwiftUI gói cả hai thành một <code>Binding</code>." }
  ],

  quiz: [
    { q: "@State lưu giá trị ở đâu?", options: [
        "Trong struct View như field thường",
        "Trong storage do SwiftUI quản lý, gắn với danh tính của view",
        "UserDefaults",
        "Biến toàn cục"
      ], correct: 1, explanation: "Nhờ vậy state sống sót khi struct được tạo lại." },
    { q: "$qty với @State var qty: Int có kiểu gì?", options: [
        "Int", "Binding<Int>", "State<Int>", "Int?"
      ], correct: 1, explanation: "Dấu $ lấy projectedValue, với State là Binding." },
    { q: "View con cần sửa một giá trị mà view cha sở hữu nên khai báo?", options: [
        "@State var", "@Binding var", "let", "static var"
      ], correct: 1, explanation: "Binding là tham chiếu hai chiều tới state của nơi khác." },
    { q: "View cha truyền giá trị mới vào init của view con, nơi con dùng nó làm giá trị ban đầu cho @State. Chuyện gì xảy ra ở lần truyền thứ hai?", options: [
        "State cập nhật theo giá trị mới",
        "State giữ giá trị cũ — giá trị khởi tạo chỉ dùng lần đầu tạo danh tính",
        "Crash",
        "Lỗi biên dịch"
      ], correct: 1, explanation: "Dùng .id hoặc Binding nếu muốn đồng bộ." },
    { q: "Vì sao nên khai báo @State là private?", options: [
        "Bắt buộc bởi compiler",
        "State là dữ liệu nội bộ của view; bên ngoài muốn điều khiển thì dùng Binding hoặc tham số",
        "Nhanh hơn",
        "Để lưu vào disk"
      ], correct: 1, explanation: "Khuyến nghị của Apple, tránh hiểu nhầm có thể 'set' từ ngoài." },
    { q: ".sheet(isPresented: $showFilter) — khi người dùng vuốt đóng sheet thì?", options: [
        "showFilter vẫn true",
        "SwiftUI ghi false vào showFilter qua Binding",
        "Sheet mở lại",
        "Crash"
      ], correct: 1, explanation: "Binding cho phép control hệ thống ghi ngược." },
    { q: "Property wrapper khác annotation + proxy của Spring ở đâu?", options: [
        "Giống hệt",
        "Được compiler biến đổi thành code (field ẩn + accessor) lúc biên dịch, không dùng proxy lúc chạy",
        "Dùng reflection",
        "Chỉ là comment"
      ], correct: 1, explanation: "@State var x sinh _x và accessor đi qua wrappedValue." },
    { q: "Binding cho Preview khi không có state thật?", options: [
        "Binding.constant(giá trị)", "State()", "nil", "Không thể preview"
      ], correct: 0, explanation: ".constant tạo binding bỏ qua mọi lần ghi." },
    { q: "Nguyên tắc 'single source of truth' nghĩa là?", options: [
        "Chỉ có một view",
        "Mỗi mẩu dữ liệu có đúng một chủ; nơi khác nhận giá trị hoặc Binding, không sao chép rồi đồng bộ tay",
        "Mọi state ở global",
        "Dùng một database"
      ], correct: 1, explanation: "Tránh lệch dữ liệu giữa các bản sao." }
  ]
});
