window.LESSONS.push({
  id: "09",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "ARC: đếm tham chiếu, retain cycle, weak & unowned",
  subtitle: "Không có GC dọn vòng · deinit tất định · [weak self] trong closure · khi nào unowned",

  theory: `
    <p>JVM dùng <strong>GC tracing</strong>: định kỳ đi từ các "root" (stack, static), object nào không với tới được thì dọn — kể cả khi chúng trỏ vòng vào nhau. Swift dùng <strong>ARC (Automatic Reference Counting)</strong>: mỗi object class có một bộ đếm tham chiếu mạnh. Compiler chèn <code>retain</code> (+1) khi có thêm tham chiếu mạnh và <code>release</code> (−1) khi tham chiếu mất; về 0 là <code>deinit</code> chạy và bộ nhớ được trả <strong>ngay lập tức</strong>.</p>
    <ul>
      <li>Ưu: không có GC pause, giải phóng tất định (biết chính xác lúc nào <code>deinit</code> chạy), ít tốn RAM dư — quan trọng trên điện thoại.</li>
      <li>Nhược: retain/release là thao tác nguyên tử, tốn chi phí (compiler tối ưu bớt); và <strong>ARC không tự phá được vòng tham chiếu</strong>.</li>
      <li>ARC chỉ áp cho class (và closure, actor). Struct/enum không có refcount riêng (trừ khi chứa class bên trong).</li>
    </ul>

    <p><strong>Retain cycle</strong>: A giữ mạnh B, B giữ mạnh A → không bao giờ về 0 → rò bộ nhớ vĩnh viễn. Ba tình huống kinh điển:</p>
    <ol>
      <li>Parent ↔ child: <code>Order</code> giữ <code>[OrderLine]</code>, mỗi line giữ ngược <code>order</code>.</li>
      <li>Delegate: view controller giữ helper, helper giữ <code>delegate</code> trỏ ngược lại.</li>
      <li><strong>Closure capture self</strong>: object lưu một closure vào property, closure dùng <code>self</code> → closure giữ mạnh self, self giữ closure. Hay gặp nhất.</li>
    </ol>

    <p><strong>Cách phá vòng</strong></p>
    <table>
      <tr><th></th><th><code>weak</code></th><th><code>unowned</code></th></tr>
      <tr><td>Tăng refcount mạnh?</td><td>Không</td><td>Không</td></tr>
      <tr><td>Kiểu</td><td>Luôn là <code>var</code> Optional</td><td>Không optional</td></tr>
      <tr><td>Object đã bị huỷ</td><td>Tự thành <code>nil</code></td><td>Truy cập → <strong>crash</strong></td></tr>
      <tr><td>Dùng khi</td><td>Bên kia có thể chết trước (delegate, self trong callback)</td><td>Chắc chắn bên kia sống lâu hơn hoặc bằng (line → order sở hữu nó)</td></tr>
    </table>
    <p>Trong closure: <code>{ [weak self] in guard let self else { return } ... }</code>. Không phải closure nào cũng cần: closure non-escaping (map, filter), closure của <code>UIView.animate</code> hay một <code>Task</code> chạy xong là thả, không tạo vòng lâu dài. Chỉ cần <code>[weak self]</code> khi <em>self lưu giữ (trực tiếp hay gián tiếp) closure đó</em>, hoặc khi bạn không muốn closure kéo dài đời sống của self.</p>

    <p><strong>Công cụ</strong>: Xcode <em>Memory Graph Debugger</em> (nút ba vòng tròn trên thanh debug) vẽ đồ thị object và đánh dấu vòng; Instruments → Leaks. Mẹo nhanh: đặt <code>print</code> trong <code>deinit</code> của ViewModel — đóng màn hình mà không thấy in là có rò.</p>

    <div class="callout"><p>💡 Rust giải quyết cùng bài toán bằng ownership + <code>Rc</code>/<code>Weak</code>: <code>Rc</code> cũng là đếm tham chiếu và cũng rò nếu vòng. Hiểu ARC ở Swift là bạn đã hiểu một nửa <code>Rc</code>/<code>Arc</code> trong Rust.</p></div>
  `,

  codeTabs: [
    { id: "count", label: "Đếm tham chiếu", lines: [
      "final class Screen {",
      "    let name: String",
      "    init(name: String) { self.name = name }",
      "    deinit { print(\"deinit \\(name)\") }",
      "}",
      "",
      "var a: Screen? = Screen(name: \"Cart\")   // refcount = 1",
      "var b = a                               // refcount = 2",
      "a = nil                                 // refcount = 1",
      "b = nil                                 // 0 → in \"deinit Cart\" NGAY"
    ]},
    { id: "cycle", label: "Vòng closure", lines: [
      "final class CartViewModel {",
      "    var total: Decimal = 0",
      "    var onChange: (() -> Void)?",
      "",
      "    func bind() {",
      "        onChange = {",
      "            print(self.total)     // closure giữ mạnh self",
      "        }                         // self giữ mạnh closure → VÒNG",
      "    }",
      "    deinit { print(\"VM freed\") } // không bao giờ in",
      "}"
    ]},
    { id: "weak", label: "[weak self]", lines: [
      "func bind() {",
      "    onChange = { [weak self] in",
      "        guard let self else { return }   // self đã chết → bỏ qua",
      "        print(self.total)",
      "    }",
      "}",
      "",
      "protocol CartDelegate: AnyObject { func didUpdate() }",
      "final class CartService {",
      "    weak var delegate: CartDelegate?     // delegate luôn weak",
      "}"
    ]},
    { id: "unowned", label: "unowned", lines: [
      "final class Order {",
      "    var lines: [OrderLine] = []",
      "}",
      "final class OrderLine {",
      "    unowned let order: Order     // line không sống lâu hơn order",
      "    init(order: Order) { self.order = order }",
      "}",
      "",
      "// Nếu line bị giữ lại sau khi order chết → truy cập order sẽ crash",
      "// Không chắc chắn về vòng đời → dùng weak var order: Order?"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="vm"><div class="nl">CartViewModel</div><div class="ns">refcount ≥ 1</div></div>
      <div class="node" id="cl"><div class="nl">closure onChange</div><div class="ns">capture self</div></div>
    </div>
    <div class="arrow" id="strong">⇄ strong ⇄ strong: không bao giờ về 0</div>
    <div class="arrow" id="weakA">→ [weak self]: closure trỏ yếu, không +1</div>
    <div class="node" id="free"><div class="nl">View đóng → VM refcount 0</div><div class="ns">deinit chạy, closure được thả theo</div></div>
  `,
  steps: [
    { title: "1 · retain / release", tab: "count", highlight: [7, 8, 9, 10], on: ["vm"],
      desc: "Mỗi tham chiếu mạnh +1, mất tham chiếu −1. Về 0 là <code>deinit</code> chạy ngay, không đợi GC." },
    { title: "2 · deinit tất định", tab: "count", highlight: [4, 10], on: ["free"],
      desc: "Biết chính xác thời điểm giải phóng — hữu ích để đóng tài nguyên và phát hiện rò." },
    { title: "3 · Vòng qua closure", tab: "cycle", highlight: [3, 6, 7, 8, 10], on: ["vm", "cl", "strong"],
      desc: "self → onChange → closure → self. Refcount không bao giờ về 0, <code>deinit</code> không chạy. GC Java sẽ dọn được vòng này, ARC thì không." },
    { title: "4 · Phá vòng bằng [weak self]", tab: "weak", highlight: [2, 3, 4], on: ["weakA", "free"],
      desc: "Closure giữ tham chiếu yếu; <code>guard let self</code> mở ra tạm thời trong lúc chạy." },
    { title: "5 · Delegate luôn weak", tab: "weak", highlight: [8, 10], on: ["weakA"],
      desc: "Protocol phải <code>: AnyObject</code> (chỉ class) mới khai báo được <code>weak</code>." },
    { title: "6 · unowned khi vòng đời chắc chắn", tab: "unowned", highlight: [5, 9, 10], on: ["vm"],
      desc: "Không optional, không tự thành nil — sai giả định về vòng đời là crash. Không chắc thì dùng weak." }
  ],

  quiz: [
    { q: "Khi refcount mạnh của một object class về 0 thì?", options: [
        "Đợi GC chạy lần sau", "deinit chạy và bộ nhớ được giải phóng ngay", "Không có gì", "Object chuyển sang weak"
      ], correct: 1, explanation: "Giải phóng tất định là đặc trưng của ARC." },
    { q: "ARC có tự dọn được hai object trỏ mạnh vào nhau không?", options: [
        "Có, như GC", "Không — đó là retain cycle, bị rò bộ nhớ", "Có nếu dùng struct", "Có sau 60 giây"
      ], correct: 1, explanation: "ARC chỉ đếm, không duyệt đồ thị như GC tracing." },
    { q: "Biến weak có đặc điểm gì?", options: [
        "let, không optional", "var Optional, tự thành nil khi object bị huỷ", "Tăng refcount", "Chỉ dùng cho struct"
      ], correct: 1, explanation: "weak không giữ object sống." },
    { q: "Truy cập một tham chiếu unowned sau khi object đã bị huỷ?", options: [
        "Trả nil", "Crash", "Trả object cũ", "Lỗi biên dịch"
      ], correct: 1, explanation: "unowned giả định object còn sống; sai là crash." },
    { q: "Closure nào cần [weak self]?", options: [
        "Mọi closure có dùng self",
        "Closure mà self lưu giữ (trực tiếp/gián tiếp), hoặc khi không muốn closure kéo dài đời sống self",
        "Closure truyền cho map/filter",
        "Không closure nào"
      ], correct: 1, explanation: "Closure non-escaping hoặc chạy xong là thả không tạo vòng lâu dài." },
    { q: "Vì sao property delegate thường khai báo weak?", options: [
        "Cho nhanh",
        "Owner thường giữ mạnh service; service giữ mạnh ngược lại owner sẽ tạo vòng",
        "Bắt buộc bởi compiler",
        "Để delegate là optional"
      ], correct: 1, explanation: "Mẫu delegate kinh điển của UIKit." },
    { q: "Protocol muốn dùng làm kiểu cho weak var cần gì?", options: [
        "Không cần gì", "Ràng buộc : AnyObject (chỉ class conform)", "@objc bắt buộc", "Là enum"
      ], correct: 1, explanation: "weak chỉ áp dụng cho reference type." },
    { q: "ARC áp dụng cho kiểu nào?", options: [
        "Mọi kiểu", "class, closure, actor (reference type)", "Chỉ struct", "Chỉ String"
      ], correct: 1, explanation: "Value type không có refcount riêng (trừ phần class bên trong)." },
    { q: "Cách nhanh phát hiện ViewModel bị rò khi đóng màn hình?", options: [
        "Xem CPU",
        "Đặt print trong deinit, hoặc dùng Memory Graph Debugger / Instruments Leaks",
        "Tăng RAM",
        "Không phát hiện được"
      ], correct: 1, explanation: "deinit không chạy khi đóng màn hình là dấu hiệu retain cycle." }
  ]
});
