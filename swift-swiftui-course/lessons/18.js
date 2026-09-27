window.LESSONS.push({
  id: "18",
  phase: "3", phaseName: "SwiftUI",
  title: "Navigation: NavigationStack, điều hướng bằng dữ liệu, sheet",
  subtitle: "NavigationLink(value:) · navigationDestination(for:) · path là mảng state · deep link · TabView · sheet",

  theory: `
    <p>React Navigation giữ một <em>stack màn hình</em> và bạn gọi <code>navigation.navigate('Product', { id })</code>. SwiftUI (iOS 16+) theo tư duy "UI là hàm của state": <strong>stack điều hướng chính là một mảng dữ liệu</strong>. Push = append vào mảng; pop = removeLast; về gốc = xoá mảng.</p>

    <p><strong>Ba mảnh ghép</strong></p>
    <ol>
      <li><code>NavigationStack(path: $router.path) { RootView() }</code> — container, <code>path</code> là Binding tới mảng (hoặc <code>NavigationPath</code> nếu cần trộn nhiều kiểu).</li>
      <li><code>NavigationLink(value: Route.product(id))</code> — khi bấm, append <em>giá trị</em> vào path. Link không biết màn hình đích là gì.</li>
      <li><code>.navigationDestination(for: Route.self) { route in ... }</code> — ánh xạ giá trị → View. Đặt một lần gần gốc stack, <strong>không</strong> đặt bên trong <code>List</code>/lazy container (có thể không được đăng ký).</li>
    </ol>
    <p>Giá trị trong path phải <code>Hashable</code>. Dùng <code>enum Route: Hashable</code> với associated value là mẫu gọn nhất — một chỗ liệt kê mọi màn hình (bài 04).</p>

    <p><strong>Vì sao data-driven hay?</strong></p>
    <ul>
      <li><strong>Deep link / push notification</strong>: nhận URL <code>shop://order/123</code> → <code>router.path = [.orders, .order("123")]</code>. Không cần gọi navigate từng bước.</li>
      <li><strong>Điều hướng từ ViewModel</strong> mà không cần tham chiếu tới view.</li>
      <li><strong>Lưu/khôi phục</strong> stack (path Codable).</li>
    </ul>
    <p>API cũ <code>NavigationView</code> và <code>NavigationLink(destination:)</code> vẫn thấy trong code cũ; <code>NavigationView</code> đã deprecated.</p>

    <p><strong>Modal</strong>: <code>.sheet(isPresented:)</code> hoặc <code>.sheet(item: $selected)</code> (hiện khi item khác nil — truyền luôn dữ liệu), <code>.fullScreenCover</code>, <code>.alert</code>, <code>.confirmationDialog</code>. Đóng từ bên trong bằng <code>@Environment(&#92;.dismiss)</code>. <code>.presentationDetents([.medium, .large])</code> cho bottom sheet nửa màn hình.</p>

    <p><strong>Tab</strong>: <code>TabView(selection: $tab)</code>, mỗi tab thường có <em>NavigationStack riêng</em> (lịch sử riêng), giống bottom tab navigator lồng stack navigator trong RN. Trên iPad/Mac, <code>NavigationSplitView</code> cho bố cục nhiều cột.</p>

    <div class="callout"><p>💡 Tiêu đề và nút thanh điều hướng đặt bằng modifier trên <em>màn hình con</em>: <code>.navigationTitle("Giỏ hàng")</code>, <code>.toolbar { ToolbarItem(placement: .topBarTrailing) { ... } }</code> — không đặt trên NavigationStack.</p></div>
  `,

  codeTabs: [
    { id: "route", label: "Route & Router", lines: [
      "enum Route: Hashable {",
      "    case product(id: String)",
      "    case cart",
      "    case order(id: String)",
      "}",
      "",
      "@MainActor @Observable",
      "final class Router {",
      "    var path: [Route] = []",
      "    func push(_ r: Route) { path.append(r) }",
      "    func popToRoot() { path.removeAll() }",
      "}"
    ]},
    { id: "stack", label: "NavigationStack", lines: [
      "struct ShopRoot: View {",
      "    @State private var router = Router()",
      "    var body: some View {",
      "        NavigationStack(path: $router.path) {",
      "            CatalogView()",
      "                .navigationDestination(for: Route.self) { route in",
      "                    switch route {",
      "                    case .product(let id): ProductDetail(id: id)",
      "                    case .cart:            CartScreen()",
      "                    case .order(let id):   OrderDetail(id: id)",
      "                    }",
      "                }",
      "        }",
      "        .environment(router)",
      "    }",
      "}"
    ]},
    { id: "link", label: "Link & deep link", lines: [
      "struct CatalogView: View {",
      "    @Environment(Router.self) private var router",
      "    let products: [Product]",
      "    var body: some View {",
      "        List(products) { p in",
      "            NavigationLink(p.name, value: Route.product(id: p.id))",
      "        }",
      "        .navigationTitle(\"Sản phẩm\")",
      "        .toolbar { Button(\"Giỏ\") { router.push(.cart) } }",
      "    }",
      "}",
      "",
      "// shop://order/123  →  thay cả stack một lần:",
      ".onOpenURL { url in router.path = [.cart, .order(id: url.lastPathComponent)] }"
    ]},
    { id: "modal", label: "Sheet & dismiss", lines: [
      "@State private var editing: Address?          // Address: Identifiable",
      "",
      "List(addresses) { a in",
      "    Button(a.line1) { editing = a }",
      "}",
      ".sheet(item: $editing) { a in                  // hiện khi editing != nil",
      "    AddressForm(address: a)",
      "        .presentationDetents([.medium, .large])",
      "}",
      "",
      "struct AddressForm: View {",
      "    @Environment(\\.dismiss) private var dismiss",
      "    let address: Address",
      "    var body: some View { Button(\"Lưu\") { save(); dismiss() } }",
      "}"
    ]},
    { id: "rn", label: "React Navigation", lines: [
      "const Stack = createNativeStackNavigator();",
      "<Stack.Navigator>",
      "  <Stack.Screen name=\"Catalog\" component={CatalogScreen} />",
      "  <Stack.Screen name=\"Product\" component={ProductScreen} />",
      "</Stack.Navigator>",
      "",
      "navigation.navigate('Product', { id: p.id });   // mệnh lệnh",
      "// SwiftUI: router.path.append(.product(id: p.id))   // đổi dữ liệu"
    ]}
  ],

  stageHtml: `
    <div class="node" id="path"><div class="nl">router.path: [Route]</div><div class="ns">[] → [.product("42")] → [.product("42"), .cart]</div></div>
    <div class="arrow" id="a1">↓ NavigationStack đọc mảng</div>
    <div class="row">
      <div class="node" id="root"><div class="nl">CatalogView</div><div class="ns">gốc</div></div>
      <div class="node" id="s1"><div class="nl">ProductDetail</div><div class="ns">path[0]</div></div>
      <div class="node" id="s2"><div class="nl">CartScreen</div><div class="ns">path[1]</div></div>
    </div>
    <div class="arrow" id="a2">↑ NavigationLink(value:) / onOpenURL / nút back ghi vào path</div>
    <div class="node" id="dest"><div class="nl">navigationDestination(for: Route.self)</div><div class="ns">giá trị → View</div></div>
  `,
  steps: [
    { title: "1 · Route là dữ liệu", tab: "route", highlight: [1, 2, 3, 4, 9, 10, 11], on: ["path"],
      desc: "Enum Hashable liệt kê mọi màn hình; Router giữ mảng path. Push/pop là thao tác mảng." },
    { title: "2 · NavigationStack gắn với path", tab: "stack", highlight: [2, 4, 5], on: ["a1", "root"],
      desc: "Binding hai chiều: nút back của hệ thống cũng xoá phần tử cuối của path." },
    { title: "3 · Ánh xạ giá trị → View", tab: "stack", highlight: [6, 7, 8, 9, 10], on: ["dest", "s1", "s2"],
      desc: "Một chỗ duy nhất, gần gốc stack. switch vét hết giúp không quên màn hình nào." },
    { title: "4 · Link chỉ mang giá trị", tab: "link", highlight: [6, 9], on: ["a2"],
      desc: "<code>NavigationLink(value:)</code> append vào path; toolbar gọi router trực tiếp." },
    { title: "5 · Deep link = gán mảng", tab: "link", highlight: [13, 14], on: ["path"],
      desc: "Dựng cả stack trong một phép gán — điều mà điều hướng mệnh lệnh làm rất vất vả." },
    { title: "6 · Sheet theo item", tab: "modal", highlight: [1, 4, 6, 8, 12, 14], on: ["root"],
      desc: "<code>.sheet(item:)</code> mở khi có giá trị và truyền luôn dữ liệu; <code>dismiss()</code> đóng từ bên trong." }
  ],

  quiz: [
    { q: "Trong NavigationStack(path:), push một màn hình nghĩa là?", options: [
        "Gọi navigate()", "Append một giá trị vào mảng path", "Tạo UIViewController", "Đổi .id"
      ], correct: 1, explanation: "Điều hướng data-driven." },
    { q: "Giá trị dùng trong path/NavigationLink(value:) phải conform gì?", options: [
        "Codable", "Hashable", "Identifiable", "Sendable"
      ], correct: 1, explanation: "Codable chỉ cần nếu muốn lưu/khôi phục path." },
    { q: "Vai trò của .navigationDestination(for: Route.self)?", options: [
        "Đặt tiêu đề",
        "Ánh xạ giá trị Route thành View đích",
        "Tạo tab",
        "Mở sheet"
      ], correct: 1, explanation: "Link chỉ mang giá trị; destination quyết định view." },
    { q: "Vì sao không nên đặt navigationDestination bên trong List/LazyVStack?", options: [
        "Không biên dịch",
        "Container lazy có thể chưa tạo view chứa modifier đó nên destination không được đăng ký",
        "Chậm",
        "List không hỗ trợ điều hướng"
      ], correct: 1, explanation: "Đặt ở view gốc của stack." },
    { q: "Xử lý deep link shop://order/123 gọn nhất?", options: [
        "Gọi push 2 lần với delay",
        "Gán router.path = [.cart, .order(id: \"123\")]",
        "Tạo NavigationStack mới",
        "Dùng UIKit"
      ], correct: 1, explanation: "Stack là dữ liệu nên dựng lại bằng một phép gán." },
    { q: ".sheet(item: $editing) hiện sheet khi nào?", options: [
        "Luôn luôn", "Khi editing khác nil; đóng sheet sẽ gán lại nil", "Khi editing là true", "Khi gọi present()"
      ], correct: 1, explanation: "Item phải Identifiable." },
    { q: "Đóng một sheet từ bên trong view của nó?", options: [
        "self.close()", "@Environment(\\.dismiss) rồi gọi dismiss()", "router.pop()", "Không đóng được"
      ], correct: 1, explanation: "dismiss cũng pop màn hình khi ở trong stack." },
    { q: ".navigationTitle nên đặt ở đâu?", options: [
        "Trên NavigationStack", "Trên view nội dung của màn hình đó (bên trong stack)", "Trong App", "Trong Info.plist"
      ], correct: 1, explanation: "Mỗi màn hình tự khai báo tiêu đề và toolbar." },
    { q: "Ứng dụng có TabView 3 tab, mỗi tab cần lịch sử điều hướng riêng. Cấu trúc?", options: [
        "Một NavigationStack bọc TabView",
        "Mỗi tab một NavigationStack riêng bên trong TabView",
        "Không cần NavigationStack",
        "Dùng NavigationView"
      ], correct: 1, explanation: "Giống tab navigator lồng stack navigator trong RN." }
  ]
});
