window.LESSONS.push({
  id: "05",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "Protocol & extension: interface kiểu Swift",
  subtitle: "Default implementation · conform bằng extension · Equatable/Hashable/Codable tự sinh · some vs any",

  theory: `
    <p><code>protocol</code> ≈ <code>interface</code> của Java: khai báo method/property mà kiểu phải có. Nhưng vì struct và enum cũng conform được protocol (không chỉ class), Swift xây cả thư viện chuẩn quanh protocol — Apple gọi là <em>protocol-oriented programming</em>, thay cho kế thừa class.</p>

    <p><strong>extension</strong> cho phép thêm method, computed property, conformance vào một kiểu <em>có sẵn</em> — kể cả kiểu bạn không sở hữu như <code>String</code> hay <code>Date</code>. Java không có cơ chế này (Kotlin có extension function, gần giống).</p>
    <ul>
      <li><code>extension Money: CustomStringConvertible { var description: String { ... } }</code> — tách phần conform ra khối riêng, code dễ đọc.</li>
      <li><strong>protocol extension</strong> cung cấp <em>default implementation</em> — giống <code>default</code> method của interface Java 8, nhưng dùng được cho mọi kiểu conform.</li>
      <li>extension <strong>không</strong> thêm được stored property (không đổi được layout bộ nhớ) — chỉ computed property.</li>
    </ul>

    <p><strong>Conformance tự sinh</strong>: khai báo <code>struct Product: Equatable, Hashable, Codable</code> mà mọi field đều Equatable/Hashable/Codable → compiler tự viết <code>==</code>, <code>hash(into:)</code>, encode/decode. Không cần Lombok, không cần tự viết <code>equals</code>/<code>hashCode</code>.</p>

    <p><strong>Hai cách dùng protocol làm kiểu</strong></p>
    <table>
      <tr><th></th><th><code>some PaymentGateway</code> (opaque)</th><th><code>any PaymentGateway</code> (existential)</th></tr>
      <tr><td>Ý nghĩa</td><td>"Một kiểu cụ thể nào đó conform, compiler biết là kiểu nào"</td><td>"Một hộp chứa bất kỳ giá trị nào conform, biết lúc chạy"</td></tr>
      <tr><td>Cơ chế</td><td>Tĩnh, có thể inline/specialize</td><td>Hộp existential + gọi qua bảng witness (dynamic dispatch)</td></tr>
      <tr><td>Đổi kiểu</td><td>Không: luôn một kiểu cố định</td><td>Có: mảng <code>[any Shape]</code> chứa Circle lẫn Square</td></tr>
      <tr><td>Gặp ở</td><td><code>var body: some View</code> (SwiftUI)</td><td>Dependency injection, danh sách không đồng nhất</td></tr>
    </table>
    <p>Giống nhất với cách Java dùng interface làm kiểu biến là <code>any</code>. Từ khoá <code>any</code> có từ Swift 5.6 để làm rõ chi phí; code cũ viết thẳng <code>PaymentGateway</code> vẫn được hiểu là existential.</p>

    <p><strong>associatedtype</strong>: protocol có thể có "kiểu thành viên" (giống generic của interface): <code>protocol Repository { associatedtype Entity; func find(id: String) async throws -&gt; Entity? }</code>. Kiểu conform chỉ định <code>Entity</code> là gì. Chi tiết ở bài 06.</p>

    <div class="callout"><p>💡 Thay vì <code>abstract class BaseRepository</code> + kế thừa như Spring, Swift ưa: protocol nhỏ + default implementation trong extension + struct conform. Mock cho test chỉ là một struct khác conform cùng protocol (bài 23).</p></div>
  `,

  codeTabs: [
    { id: "proto", label: "protocol + default", lines: [
      "protocol PaymentGateway {",
      "    var name: String { get }",
      "    func charge(_ amount: Decimal, token: String) async throws -> String",
      "}",
      "",
      "extension PaymentGateway {",
      "    // default implementation cho mọi kiểu conform",
      "    func describe() -> String { \"Cổng thanh toán \\(name)\" }",
      "}",
      "",
      "struct StripeGateway: PaymentGateway {",
      "    let name = \"Stripe\"",
      "    func charge(_ amount: Decimal, token: String) async throws -> String { \"ch_123\" }",
      "}"
    ]},
    { id: "ext", label: "extension kiểu có sẵn", lines: [
      "extension String {",
      "    var isValidEmail: Bool { contains(\"@\") && contains(\".\") }",
      "}",
      "\"a@b.vn\".isValidEmail        // true",
      "",
      "struct Money { let amount: Decimal; let currency: String }",
      "",
      "extension Money: CustomStringConvertible {",
      "    var description: String { \"\\(amount) \\(currency)\" }",
      "}",
      "// extension Money { var cached = 0 }  ❌ không được thêm stored property"
    ]},
    { id: "derive", label: "Tự sinh conformance", lines: [
      "struct Product: Identifiable, Hashable, Codable {",
      "    let id: String",
      "    var name: String",
      "    var price: Decimal",
      "}",
      "// compiler tự sinh: ==, hash(into:), init(from:), encode(to:)",
      "",
      "let set: Set<Product> = [p1, p2]     // dùng được vì Hashable",
      "p1 == p2                             // so từng field"
    ]},
    { id: "someany", label: "some vs any", lines: [
      "func makeGateway() -> some PaymentGateway {",
      "    StripeGateway()          // luôn trả MỘT kiểu cụ thể",
      "}",
      "",
      "struct CheckoutService {",
      "    let gateway: any PaymentGateway   // hộp existential, đổi được lúc chạy",
      "}",
      "let s1 = CheckoutService(gateway: StripeGateway())",
      "let s2 = CheckoutService(gateway: MockGateway())",
      "",
      "let gateways: [any PaymentGateway] = [StripeGateway(), MockGateway()]"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">protocol PaymentGateway</div><div class="ns">yêu cầu: name, charge()</div></div>
    <div class="arrow" id="a1">↓ extension cung cấp describe() mặc định</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">struct StripeGateway</div><div class="ns">conform</div></div>
      <div class="node" id="s2"><div class="nl">struct MockGateway</div><div class="ns">conform (test)</div></div>
    </div>
    <div class="row">
      <div class="node" id="some"><div class="nl">some PaymentGateway</div><div class="ns">kiểu cố định, tĩnh</div></div>
      <div class="node" id="any"><div class="nl">any PaymentGateway</div><div class="ns">hộp động, như interface Java</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Khai báo protocol", tab: "proto", highlight: [1, 2, 3, 4], on: ["p"],
      desc: "<code>{ get }</code> nghĩa là kiểu conform phải cho đọc được <code>name</code> (let hay var đều được)." },
    { title: "2 · Default implementation", tab: "proto", highlight: [6, 7, 8, 9], on: ["a1"],
      desc: "Mọi kiểu conform có sẵn <code>describe()</code> mà không cần viết." },
    { title: "3 · Struct conform", tab: "proto", highlight: [11, 12, 13], on: ["s1"],
      desc: "Struct, enum, class đều conform được. Không cần kế thừa." },
    { title: "4 · Mở rộng kiểu có sẵn", tab: "ext", highlight: [1, 2, 8, 9, 11], on: ["s1"],
      desc: "Thêm computed property cho <code>String</code>; tách conformance thành extension riêng. Không thêm được stored property." },
    { title: "5 · Conformance tự sinh", tab: "derive", highlight: [1, 6, 8, 9], on: ["s2"],
      desc: "Hashable/Codable/Equatable được compiler tổng hợp khi mọi field đều conform." },
    { title: "6 · some vs any", tab: "someany", highlight: [1, 2, 6, 8, 9, 11], on: ["some", "any"],
      desc: "<code>some</code>: một kiểu cụ thể được giấu tên. <code>any</code>: hộp chứa kiểu bất kỳ, cho phép tráo đổi — đúng thứ cần cho DI và mock." }
  ],

  quiz: [
    { q: "Kiểu nào trong Swift có thể conform protocol?", options: [
        "Chỉ class", "struct, enum và class", "Chỉ struct", "Chỉ kiểu Objective-C"
      ], correct: 1, explanation: "Đây là khác biệt lớn với interface Java (chỉ class/enum/record)." },
    { q: "Extension KHÔNG làm được điều gì?", options: [
        "Thêm method", "Thêm computed property", "Thêm stored property", "Thêm protocol conformance"
      ], correct: 2, explanation: "Stored property thay đổi layout bộ nhớ nên không thêm qua extension được." },
    { q: "Default implementation cho protocol đặt ở đâu?", options: [
        "Trong khai báo protocol với từ khoá default", "Trong protocol extension", "Trong class cha", "Không hỗ trợ"
      ], correct: 1, explanation: "extension PaymentGateway { func describe() ... }." },
    { q: "struct Product: Hashable với mọi field Hashable. Cần tự viết hash(into:) không?", options: [
        "Có", "Không — compiler tự sinh", "Chỉ khi có Decimal", "Phải dùng thư viện"
      ], correct: 1, explanation: "Synthesized conformance cho Equatable, Hashable, Codable." },
    { q: "var body: some View nghĩa là gì?", options: [
        "body có thể trả bất kỳ View nào, đổi được lúc chạy",
        "body trả một kiểu View cụ thể do compiler biết, chỉ giấu tên kiểu",
        "body là optional",
        "body là class View"
      ], correct: 1, explanation: "Opaque type: một kiểu cố định, tĩnh." },
    { q: "Muốn một mảng chứa lẫn StripeGateway và MockGateway, khai báo kiểu gì?", options: [
        "[some PaymentGateway]", "[any PaymentGateway]", "[PaymentGateway.Type]", "Không làm được"
      ], correct: 1, explanation: "Existential any cho phép không đồng nhất." },
    { q: "Cái nào gần nhất với việc Java dùng interface làm kiểu biến (PaymentGateway g = ...)?", options: [
        "some PaymentGateway", "any PaymentGateway", "PaymentGateway.self", "generic <T>"
      ], correct: 1, explanation: "Cả hai đều là tham chiếu động tới 'bất kỳ thứ gì conform', dispatch lúc chạy." },
    { q: "{ get } trong var name: String { get } của protocol yêu cầu gì?", options: [
        "Bắt buộc là computed property",
        "Kiểu conform phải cho đọc name; let, var hay computed đều được",
        "name phải là static",
        "name chỉ được set"
      ], correct: 1, explanation: "{ get set } mới đòi ghi được." },
    { q: "Thay thế Swift cho abstract class BaseRepository kiểu Spring là gì?", options: [
        "Kế thừa class nhiều tầng",
        "Protocol nhỏ + default implementation trong extension + struct conform",
        "Singleton",
        "Macro"
      ], correct: 1, explanation: "Protocol-oriented thay vì class hierarchy." }
  ]
});
