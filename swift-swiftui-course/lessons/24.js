window.LESSONS.push({
  id: "24",
  phase: "5", phaseName: "Tổng kết",
  title: "Tổng kết: bản đồ Java/RN → Swift/SwiftUI và checklist kỹ sư",
  subtitle: "Ghép mọi mảnh vào một luồng màn hình hoàn chỉnh · bảng đối chiếu · lỗi hay gặp · ôn tập",

  theory: `
    <p><strong>Bảng đối chiếu nhanh</strong></p>
    <table>
      <tr><th>Java / Spring</th><th>React Native</th><th>Swift / SwiftUI</th><th>Bài</th></tr>
      <tr><td>JVM + GC</td><td>JS engine (Hermes) + GC</td><td>Native AOT + <strong>ARC</strong></td><td>01, 09</td></tr>
      <tr><td><code>null</code>, <code>Optional</code></td><td><code>undefined</code>, <code>?.</code></td><td><code>T?</code>, <code>guard let</code>, <code>??</code></td><td>02</td></tr>
      <tr><td>class / record</td><td>object</td><td><strong>struct</strong> (giá trị) mặc định, class khi cần danh tính</td><td>03</td></tr>
      <tr><td>sealed + record</td><td>union type TS</td><td>enum có associated value</td><td>04</td></tr>
      <tr><td>interface, abstract class</td><td>TS interface</td><td>protocol + extension</td><td>05</td></tr>
      <tr><td>Generic bị xoá kiểu</td><td>—</td><td>Generic giữ kiểu, specialize; <code>some</code>/<code>any</code></td><td>06</td></tr>
      <tr><td>Exception</td><td>throw/Promise reject</td><td><code>throws</code>/<code>try</code>, lỗi là giá trị</td><td>08</td></tr>
      <tr><td>Virtual thread, <code>synchronized</code></td><td>Promise, async/await</td><td>async/await, Task, <strong>actor</strong>, Sendable</td><td>10, 11</td></tr>
      <tr><td>Gradle / Maven</td><td>npm + CocoaPods</td><td>Xcode project + SPM</td><td>12</td></tr>
      <tr><td>—</td><td>component, props, key</td><td>struct View, let property, <code>.id</code></td><td>13</td></tr>
      <tr><td>—</td><td><code>useState</code>, callback prop</td><td><code>@State</code>, <code>@Binding</code></td><td>14</td></tr>
      <tr><td>Bean dùng chung</td><td>Context, Zustand</td><td><code>@Observable</code> + <code>@Environment</code></td><td>15</td></tr>
      <tr><td>—</td><td>Flexbox, FlatList</td><td>Stack, Lazy stack, List</td><td>16, 17</td></tr>
      <tr><td>—</td><td>React Navigation</td><td>NavigationStack(path:)</td><td>18</td></tr>
      <tr><td>—</td><td><code>useEffect</code></td><td><code>.task</code>, <code>.task(id:)</code></td><td>19</td></tr>
      <tr><td>Controller/Service</td><td>hook / store</td><td>ViewModel <code>@MainActor @Observable</code> + protocol service</td><td>20</td></tr>
      <tr><td>RestClient + Jackson</td><td>fetch/axios</td><td>URLSession + Codable</td><td>21</td></tr>
      <tr><td>JPA, Vault</td><td>AsyncStorage, keychain lib</td><td>SwiftData, UserDefaults, Keychain</td><td>22</td></tr>
      <tr><td>JUnit + Mockito</td><td>Jest, Detox</td><td>Swift Testing, mock bằng protocol, XCUITest</td><td>23</td></tr>
    </table>

    <p><strong>Một luồng hoàn chỉnh</strong> (xem các tab): mở app → <code>App</code> tạo <code>Router</code>, <code>CartModel</code>, <code>APIClient</code> → màn danh sách có ViewModel riêng, <code>.task</code> gọi <code>load()</code> → ViewModel (MainActor) <code>await</code> service → <code>APIClient</code> gọi URLSession, kiểm tra status, decode <code>[Product]</code> (Sendable) → state enum đổi sang <code>.loaded</code> → Observation báo view vẽ lại → người dùng bấm sản phẩm → <code>NavigationLink(value:)</code> append vào <code>path</code> → màn chi tiết.</p>

    <p><strong>10 lỗi hay gặp của người mới từ Java/RN</strong></p>
    <ol>
      <li>Dùng <code>!</code> với dữ liệu từ server.</li>
      <li>Nghĩ <code>var b = a</code> với struct là chung object (hoặc ngược lại với class).</li>
      <li><code>switch</code> dùng <code>default</code> cho enum của mình → mất cảnh báo khi thêm case.</li>
      <li>Closure lưu vào property dùng <code>self</code> mạnh → ViewModel không bao giờ <code>deinit</code>.</li>
      <li><code>Thread.sleep</code>/chặn luồng trong code async.</li>
      <li>Giả định trạng thái actor không đổi qua <code>await</code>.</li>
      <li>Side effect trong <code>init</code>/<code>body</code> của View; <code>onAppear { Task {} }</code> thay vì <code>.task</code>.</li>
      <li>Tạo object ViewModel bằng <code>let vm = VM()</code> trong View thay vì <code>@State</code>.</li>
      <li>Quên kiểm tra <code>statusCode</code> sau <code>URLSession</code>.</li>
      <li>Lưu token trong UserDefaults.</li>
    </ol>

    <div class="callout"><p>💡 Bước tiếp: dựng một app nhỏ end-to-end (danh sách → chi tiết → giỏ → lưu nháp) bằng đúng kiến trúc ở tab ①–④, bật Swift 6 language mode ngay từ đầu, viết test cho ViewModel. Khi sang Kotlin/Compose hoặc Rust, bạn sẽ thấy lại gần như mọi ý tưởng: Optional, sum type, value semantics, structured concurrency, state một chiều.</p></div>
  `,

  codeTabs: [
    { id: "app", label: "① App", lines: [
      "@main",
      "struct ShopApp: App {",
      "    @State private var router = Router()",
      "    @State private var cart = CartModel()",
      "    private let api = APIClient(baseURL: URL(string: \"https://api.shop.vn\")!)",
      "",
      "    var body: some Scene {",
      "        WindowGroup {",
      "            NavigationStack(path: $router.path) {",
      "                ProductListView(service: LiveProductService(client: api))",
      "                    .navigationDestination(for: Route.self) { route in",
      "                        switch route {",
      "                        case .product(let id): ProductDetail(id: id)",
      "                        case .cart: CartScreen()",
      "                        case .order(let id): OrderDetail(id: id)",
      "                        }",
      "                    }",
      "            }",
      "            .environment(router)",
      "            .environment(cart)",
      "        }",
      "    }",
      "}"
    ]},
    { id: "vm", label: "② ViewModel", lines: [
      "@MainActor @Observable",
      "final class ProductListViewModel {",
      "    enum ScreenState { case loading, loaded([Product]), failed(String) }",
      "    private(set) var state: ScreenState = .loading",
      "    private let service: any ProductService",
      "    init(service: any ProductService) { self.service = service }",
      "",
      "    func load() async {",
      "        do { state = .loaded(try await service.products(page: 1)) }",
      "        catch { if !Task.isCancelled { state = .failed(\"Không tải được\") } }",
      "    }",
      "}"
    ]},
    { id: "view", label: "③ View", lines: [
      "struct ProductListView: View {",
      "    @State private var vm: ProductListViewModel",
      "    @Environment(CartModel.self) private var cart",
      "    init(service: any ProductService) { _vm = State(initialValue: .init(service: service)) }",
      "",
      "    var body: some View {",
      "        Group {",
      "            switch vm.state {",
      "            case .loading: ProgressView()",
      "            case .failed(let m): ContentUnavailableView(m, systemImage: \"wifi.slash\")",
      "            case .loaded(let items):",
      "                List(items) { p in",
      "                    NavigationLink(value: Route.product(id: p.id)) { ProductRow(product: p) }",
      "                        .swipeActions { Button(\"Thêm\") { cart.add(p) } }",
      "                }",
      "            }",
      "        }",
      "        .navigationTitle(\"Sản phẩm\")",
      "        .task { await vm.load() }",
      "    }",
      "}"
    ]},
    { id: "net", label: "④ Mạng & model", lines: [
      "struct Product: Codable, Identifiable, Hashable, Sendable {",
      "    let id: String",
      "    let displayName: String",
      "    let price: Decimal",
      "}",
      "",
      "struct LiveProductService: ProductService {",
      "    let client: APIClient",
      "    func products(page: Int) async throws -> [Product] {",
      "        try await client.get(\"/products\", query: [URLQueryItem(name: \"page\", value: \"\\(page)\")])",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">ShopApp</div><div class="ns">Router · CartModel · APIClient</div></div>
    <div class="arrow" id="a1">↓ .environment · NavigationStack(path:)</div>
    <div class="node" id="view"><div class="nl">ProductListView</div><div class="ns">.task { await vm.load() }</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="vm"><div class="nl">ViewModel @MainActor</div><div class="ns">state: enum</div></div>
    <div class="arrow" id="a3">↓ await (nhả main thread)</div>
    <div class="node" id="net"><div class="nl">Service → APIClient → URLSession</div><div class="ns">status → Codable → [Product] Sendable</div></div>
    <div class="arrow" id="a4">↑ state = .loaded → Observation → body vẽ lại</div>
  `,
  steps: [
    { title: "1 · Lắp ráp ở App", tab: "app", highlight: [3, 4, 5, 9, 10, 19, 20], on: ["app", "a1"],
      desc: "Object sống suốt app giữ bằng <code>@State</code>, tiêm qua environment; phụ thuộc tự lắp tường minh." },
    { title: "2 · Điều hướng bằng dữ liệu", tab: "app", highlight: [9, 11, 12, 13, 14, 15], on: ["a1"],
      desc: "Một chỗ ánh xạ Route → View; deep link chỉ là gán path." },
    { title: "3 · View mỏng khởi động tải", tab: "view", highlight: [2, 4, 8, 19], on: ["view", "a2"],
      desc: "<code>.task</code> gắn vòng đời; View chỉ switch trên state." },
    { title: "4 · ViewModel gọi service", tab: "vm", highlight: [1, 3, 8, 9, 10], on: ["vm", "a3"],
      desc: "MainActor cho state; await nhả main thread; huỷ không bị coi là lỗi." },
    { title: "5 · Mạng & Codable", tab: "net", highlight: [1, 9, 10], on: ["net"],
      desc: "Model là struct Sendable, Codable; APIClient kiểm tra status và decode generic." },
    { title: "6 · Vòng phản hồi", tab: "view", highlight: [11, 12, 13, 14], on: ["a4"],
      desc: "State đổi → Observation biết body đã đọc <code>vm.state</code> → vẽ lại danh sách. Bấm dòng → append Route vào path." }
  ],

  quiz: [
    { q: "var b = a với a là struct, sửa b. Điều gì đúng?", options: [
        "a đổi theo", "a không đổi vì b là bản sao", "Lỗi biên dịch", "Tuỳ kích thước struct"
      ], correct: 1, explanation: "Value semantics (bài 03)." },
    { q: "Cách an toàn mở Optional từ dữ liệu server và thoát sớm nếu thiếu?", options: [
        "value!", "guard let value else { return }", "value as! String", "try! value"
      ], correct: 1, explanation: "Bài 02." },
    { q: "ViewModel không bao giờ deinit sau khi đóng màn hình. Nguyên nhân hay gặp nhất?", options: [
        "Thiếu @MainActor", "Closure lưu trong property capture self mạnh (retain cycle)", "Dùng struct", "Dùng @State"
      ], correct: 1, explanation: "Dùng [weak self] (bài 09)." },
    { q: "Hai request độc lập muốn chạy song song trong hàm async?", options: [
        "Hai await nối tiếp", "async let cho từng cái rồi await cả hai", "Thread mới", "DispatchQueue.main.sync"
      ], correct: 1, explanation: "Structured concurrency (bài 10)." },
    { q: "Qua một await bên trong method actor, điều gì có thể xảy ra?", options: [
        "Không gì",
        "Lời gọi khác vào actor chạy xen kẽ và đổi trạng thái (reentrancy)",
        "Actor bị huỷ",
        "Deadlock chắc chắn"
      ], correct: 1, explanation: "Bài 11." },
    { q: "Truyền class có var giữa các Task trong Swift 6 language mode?", options: [
        "Luôn OK", "Lỗi biên dịch vì không Sendable (trừ khi actor/@unchecked)", "Crash", "Tự sao chép"
      ], correct: 1, explanation: "Data race safety lúc biên dịch." },
    { q: "Chuyển giữa hai nhánh if/else chứa cùng loại view làm mất @State vì?", options: [
        "Bug SwiftUI", "Hai nhánh là hai danh tính khác nhau", "State hết hạn", "Thiếu .id"
      ], correct: 1, explanation: "Structural identity (bài 13)." },
    { q: "View tạo và sở hữu một ViewModel @Observable nên khai báo?", options: [
        "let vm = VM()", "@State private var vm", "@Binding var vm", "@ObservedObject var vm"
      ], correct: 1, explanation: "Bài 15, 20." },
    { q: "Text(\"Mua\").padding().background(.orange) khác .background(.orange).padding() ở đâu?", options: [
        "Không khác", "Cái đầu nền phủ cả padding; cái sau nền chỉ ôm chữ", "Cái sau lỗi", "Cái đầu không có padding"
      ], correct: 1, explanation: "Modifier là lớp bọc, thứ tự quan trọng (bài 17)." },
    { q: "Deep link tới đơn hàng 123 với NavigationStack(path:)?", options: [
        "Gọi navigate 2 lần", "Gán path = [.cart, .order(id: \"123\")]", "Tạo stack mới", "Không hỗ trợ"
      ], correct: 1, explanation: "Bài 18." },
    { q: "Tải dữ liệu khi màn hình hiện và tự huỷ khi rời màn hình?", options: [
        ".onAppear { Task { } }", ".task { await load() }", "init()", "body"
      ], correct: 1, explanation: "Bài 19." },
    { q: "URLSession trả HTTP 404 thì?", options: [
        "Ném URLError", "Không ném; phải tự kiểm tra statusCode", "Crash", "Trả nil"
      ], correct: 1, explanation: "Bài 21." },
    { q: "Nơi lưu access token?", options: [
        "UserDefaults", "Keychain", "@AppStorage", "SwiftData"
      ], correct: 1, explanation: "Bài 22." },
    { q: "Mock ProductService trong test Swift?", options: [
        "Mockito", "Struct/class giả conform protocol ProductService", "Reflection", "Không được"
      ], correct: 1, explanation: "Bài 23." },
    { q: "Muốn trộn StripeGateway và MockGateway trong một mảng, kiểu phần tử là?", options: [
        "some PaymentGateway", "any PaymentGateway", "PaymentGateway.Type", "AnyObject"
      ], correct: 1, explanation: "Existential (bài 05)." },
    { q: "Lỗi ném trong Swift khác exception Java ở cơ chế?", options: [
        "Giống hệt",
        "Là giá trị trả về đặc biệt, rẻ, phải try tại điểm gọi; crash (trap) không bắt được",
        "Luôn có stack trace",
        "Chỉ dùng cho IO"
      ], correct: 1, explanation: "Bài 08." }
  ]
});
