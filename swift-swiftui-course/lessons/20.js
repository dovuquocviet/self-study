window.LESSONS.push({
  id: "20",
  phase: "4", phaseName: "Kiến trúc & dữ liệu",
  title: "Kiến trúc MVVM với @Observable",
  subtitle: "View mỏng · ViewModel @MainActor giữ state + logic màn hình · Service qua protocol · state bằng enum",

  theory: `
    <p>Dev Spring quen <strong>Controller → Service → Repository</strong>. Trên app SwiftUI, cách tách lớp phổ biến là MVVM, và có thể ánh xạ khá thẳng:</p>
    <table>
      <tr><th>Lớp</th><th>Trách nhiệm</th><th>Kiểu Swift</th><th>Spring gần nhất</th></tr>
      <tr><td><strong>View</strong></td><td>Hiển thị state, chuyển hành động của người dùng thành lời gọi method</td><td>struct View</td><td>Template / JSON serializer</td></tr>
      <tr><td><strong>ViewModel</strong></td><td>State của màn hình, logic trình bày (định dạng, validate form, gộp dữ liệu), gọi service</td><td><code>@MainActor @Observable final class</code></td><td>Controller</td></tr>
      <tr><td><strong>Service / Repository</strong></td><td>Nghiệp vụ, gọi API, cache, DB</td><td><code>protocol</code> + struct/actor cài đặt</td><td>@Service, @Repository</td></tr>
      <tr><td><strong>Model</strong></td><td>Dữ liệu thuần</td><td>struct Codable, Sendable</td><td>DTO / entity</td></tr>
    </table>

    <p><strong>Nguyên tắc</strong></p>
    <ul>
      <li><strong>View không gọi mạng</strong>, không biết URLSession. Nó gọi <code>await vm.load()</code> trong <code>.task</code>, và <code>vm.addToCart(p)</code> trong nút.</li>
      <li><strong>ViewModel không import SwiftUI</strong> nếu tránh được (không giữ <code>Color</code>, <code>View</code>) → test bằng unit test thuần, không cần UI.</li>
      <li><strong>Trạng thái màn hình là enum</strong> <code>idle/loading/loaded/failed</code> (bài 04) thay vì các cờ rời rạc.</li>
      <li><strong>Phụ thuộc truyền qua init bằng protocol</strong> (<code>any ProductService</code>) — constructor injection như Spring, nhưng không có container: bạn tự lắp ở gốc app (composition root), hoặc đặt vào environment. Test thay bằng mock.</li>
      <li>ViewModel là <code>@MainActor</code>: state cập nhật trên main thread; lời gọi service là <code>async</code> nên không chặn UI. Service có trạng thái dùng chung (cache token) nên là <code>actor</code>.</li>
    </ul>

    <p><strong>Ai sở hữu ViewModel?</strong> Màn hình tạo: <code>@State private var vm: ProductListViewModel</code>, khởi tạo trong <code>init</code> với <code>_vm = State(initialValue: ...)</code> — nhớ bẫy "chỉ dùng lần đầu" ở bài 14; nếu tham số đầu vào đổi (id khác), gắn <code>.id(...)</code> để tạo lại. Dùng chung nhiều màn hình (giỏ hàng, phiên đăng nhập): tạo ở App và đặt vào environment (bài 15).</p>

    <p><strong>Đừng cực đoan</strong>: màn hình tĩnh hoặc form nhỏ chỉ có vài <code>@State</code> thì không cần ViewModel. Apple cũng không bắt buộc MVVM; điều quan trọng là logic không nằm trong body và có thể test được. Các lựa chọn khác bạn sẽ gặp: TCA (The Composable Architecture — giống Redux), Clean Architecture nhiều tầng.</p>

    <div class="callout"><p>💡 So với RN: ViewModel ≈ custom hook (<code>useProductList()</code>) trả state + hàm, hoặc store Zustand/Redux cho một màn hình. Khác biệt: nó là class có danh tính, SwiftUI theo dõi từng property nó đọc.</p></div>
  `,

  codeTabs: [
    { id: "service", label: "Service (protocol)", lines: [
      "protocol ProductService: Sendable {",
      "    func products(page: Int) async throws -> [Product]",
      "}",
      "",
      "struct LiveProductService: ProductService {",
      "    let client: APIClient",
      "    func products(page: Int) async throws -> [Product] {",
      "        try await client.get(\"/products\", query: [URLQueryItem(name: \"page\", value: \"\\(page)\")])",
      "    }",
      "}"
    ]},
    { id: "vm", label: "ViewModel", lines: [
      "@MainActor @Observable",
      "final class ProductListViewModel {",
      "    enum ScreenState { case idle, loading, loaded([Product]), failed(String) }",
      "",
      "    private(set) var state: ScreenState = .idle",
      "    private let service: any ProductService",
      "",
      "    init(service: any ProductService) { self.service = service }",
      "",
      "    func load() async {",
      "        state = .loading",
      "        do { state = .loaded(try await service.products(page: 1)) }",
      "        catch { state = .failed(\"Không tải được sản phẩm\") }",
      "    }",
      "}"
    ]},
    { id: "view", label: "View mỏng", lines: [
      "struct ProductListView: View {",
      "    @State private var vm: ProductListViewModel",
      "    init(service: any ProductService) {",
      "        _vm = State(initialValue: ProductListViewModel(service: service))",
      "    }",
      "    var body: some View {",
      "        Group {",
      "            switch vm.state {",
      "            case .idle, .loading: ProgressView()",
      "            case .loaded(let items): List(items) { ProductRow(product: $0) }",
      "            case .failed(let msg):",
      "                ContentUnavailableView(msg, systemImage: \"wifi.slash\")",
      "            }",
      "        }",
      "        .task { await vm.load() }",
      "    }",
      "}"
    ]},
    { id: "root", label: "Composition root", lines: [
      "@main",
      "struct ShopApp: App {",
      "    private let client = APIClient(baseURL: URL(string: \"https://api.shop.vn\")!)",
      "    var body: some Scene {",
      "        WindowGroup {",
      "            NavigationStack {",
      "                ProductListView(service: LiveProductService(client: client))",
      "            }",
      "        }",
      "    }",
      "}",
      "// Spring làm việc lắp ráp này bằng @Autowired; Swift: tự lắp, tường minh"
    ]},
    { id: "test", label: "Test ViewModel", lines: [
      "struct FailingService: ProductService {",
      "    func products(page: Int) async throws -> [Product] { throw URLError(.notConnectedToInternet) }",
      "}",
      "",
      "@Test @MainActor func showsErrorWhenOffline() async {",
      "    let vm = ProductListViewModel(service: FailingService())",
      "    await vm.load()",
      "    guard case .failed = vm.state else { Issue.record(\"expected failed\"); return }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="view"><div class="nl">ProductListView (struct)</div><div class="ns">switch vm.state · .task { await vm.load() }</div></div>
    <div class="arrow" id="a1">↓ gọi method · ↑ đọc state (Observation)</div>
    <div class="node" id="vm"><div class="nl">ProductListViewModel</div><div class="ns">@MainActor @Observable · enum State</div></div>
    <div class="arrow" id="a2">↓ any ProductService (inject qua init)</div>
    <div class="row">
      <div class="node" id="live"><div class="nl">LiveProductService</div><div class="ns">APIClient → mạng</div></div>
      <div class="node" id="mock"><div class="nl">FailingService / Mock</div><div class="ns">trong test</div></div>
    </div>
    <div class="node" id="root"><div class="nl">Composition root (App)</div><div class="ns">lắp ráp phụ thuộc</div></div>
  `,
  steps: [
    { title: "1 · Service sau protocol", tab: "service", highlight: [1, 2, 5, 7, 8], on: ["live"],
      desc: "Protocol Sendable để truyền an toàn giữa các actor. Cài đặt thật dùng APIClient." },
    { title: "2 · ViewModel giữ state bằng enum", tab: "vm", highlight: [1, 3, 5, 6, 8], on: ["vm", "a2"],
      desc: "<code>private(set)</code>: View chỉ đọc, chỉ ViewModel được đổi state. Phụ thuộc vào qua init." },
    { title: "3 · Logic tải", tab: "vm", highlight: [10, 11, 12, 13], on: ["vm"],
      desc: "Chạy trên MainActor; <code>await</code> nhả main thread trong lúc chờ mạng." },
    { title: "4 · View mỏng", tab: "view", highlight: [2, 4, 8, 9, 10, 11, 15], on: ["view", "a1"],
      desc: "View chỉ switch trên state và gọi <code>load</code> trong <code>.task</code>. Không có URLSession ở đây." },
    { title: "5 · Lắp ráp ở gốc", tab: "root", highlight: [3, 7, 12], on: ["root"],
      desc: "Không có container DI: bạn tự tạo phụ thuộc ở App (hoặc đặt vào environment). Tường minh, dễ lần theo." },
    { title: "6 · Test không cần UI", tab: "test", highlight: [1, 2, 5, 6, 7, 8], on: ["mock"],
      desc: "Thay service bằng struct giả, gọi method, kiểm tra state. Chi tiết Swift Testing ở bài 23." }
  ],

  quiz: [
    { q: "Trong MVVM SwiftUI, lớp nào gọi API mạng?", options: [
        "View trong body", "Service/Repository, được ViewModel gọi", "Model struct", "App struct"
      ], correct: 1, explanation: "View không biết tới URLSession." },
    { q: "ViewModel nên khai báo thế nào ở iOS 17+?", options: [
        "struct View", "@MainActor @Observable final class", "actor", "enum"
      ], correct: 1, explanation: "Class để có danh tính, MainActor để state cập nhật trên main thread." },
    { q: "Vì sao dùng private(set) var state?", options: [
        "Tăng tốc",
        "View đọc được nhưng chỉ ViewModel được thay đổi state",
        "Bắt buộc bởi @Observable",
        "Để Codable"
      ], correct: 1, explanation: "Luồng dữ liệu một chiều: View → method → state." },
    { q: "Cách truyền phụ thuộc cho ViewModel để dễ test?", options: [
        "Singleton toàn cục",
        "Truyền qua init dưới dạng protocol (any ProductService)",
        "Tạo trực tiếp bên trong ViewModel",
        "Dùng @Autowired"
      ], correct: 1, explanation: "Constructor injection; test thay bằng mock." },
    { q: "Swift/SwiftUI có container DI như Spring mặc định không?", options: [
        "Có, @Inject", "Không — tự lắp ở composition root hoặc qua environment", "Có trong SPM", "Có trong Xcode"
      ], correct: 1, explanation: "Có thư viện bên thứ ba nhưng không bắt buộc." },
    { q: "Màn hình tạo ViewModel với tham số id qua init, sau đó cha truyền id khác. Chuyện gì xảy ra?", options: [
        "ViewModel tự tạo lại",
        "@State giữ ViewModel cũ; cần .id(id) để tạo lại view/ViewModel",
        "Crash",
        "Lỗi biên dịch"
      ], correct: 1, explanation: "Giá trị khởi tạo của @State chỉ dùng lần đầu." },
    { q: "Màn hình form nhỏ với 3 trường nhập, không gọi API. Cần ViewModel không?", options: [
        "Bắt buộc", "Không nhất thiết — vài @State là đủ", "Cần 2 ViewModel", "Cần actor"
      ], correct: 1, explanation: "Tránh kiến trúc thừa." },
    { q: "Tương đương gần nhất của ViewModel trong React Native?", options: [
        "StyleSheet", "Custom hook hoặc store (Zustand/Redux) cho màn hình", "FlatList", "Metro"
      ], correct: 1, explanation: "Gói state + hành động cho view." },
    { q: "Vì sao nên để ViewModel không import SwiftUI?", options: [
        "Biên dịch nhanh hơn",
        "Giữ logic thuần, test được bằng unit test không cần UI và tái sử dụng được",
        "Bắt buộc",
        "Để chạy trên Android"
      ], correct: 1, explanation: "Observation nằm trong module Observation, không cần SwiftUI." }
  ]
});
