window.LESSONS.push({
  id: "06",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "Generics: không type erasure như Java",
  subtitle: "Ràng buộc & where · associatedtype · specialization · some trong tham số",

  theory: `
    <p>Cú pháp generic Swift nhìn giống Java: <code>func first&lt;T&gt;(_ xs: [T]) -&gt; T?</code>. Khác biệt nằm ở <strong>cơ chế bên dưới</strong>:</p>
    <table>
      <tr><th></th><th>Java</th><th>Swift</th></tr>
      <tr><td>Lúc chạy</td><td><strong>Type erasure</strong>: <code>List&lt;String&gt;</code> và <code>List&lt;Integer&gt;</code> cùng là <code>List</code></td><td>Kiểu generic <strong>được giữ lại</strong> (có type metadata lúc chạy)</td></tr>
      <tr><td>Kiểu nguyên thuỷ</td><td>Phải boxing: <code>List&lt;Integer&gt;</code></td><td><code>[Int]</code> lưu Int liền nhau, không boxing</td></tr>
      <tr><td>Hiệu năng</td><td>Cast ngầm, gọi qua interface</td><td>Compiler có thể <strong>specialize</strong>: sinh bản riêng cho <code>Int</code> khi biết kiểu cụ thể</td></tr>
      <tr><td><code>new T()</code>, <code>T.class</code></td><td>Không làm được</td><td>Được nếu có ràng buộc: <code>T: Decodable</code> → <code>T(from:)</code>, <code>T.self</code></td></tr>
    </table>
    <p>Khi không specialize được (khác module, generic phức tạp), Swift truyền ngầm type metadata + "witness table" (bảng hàm của protocol) để gọi đúng — vẫn đúng kiểu, chỉ chậm hơn chút.</p>

    <p><strong>Ràng buộc</strong></p>
    <ul>
      <li><code>&lt;T: Comparable&gt;</code> ≈ Java <code>&lt;T extends Comparable&lt;T&gt;&gt;</code>.</li>
      <li><code>where</code> cho ràng buộc phức tạp: <code>where C: Collection, C.Element: Hashable</code>.</li>
      <li>Swift không có wildcard <code>? extends</code>/<code>? super</code>; dùng ràng buộc hoặc <code>some</code>/<code>any</code>.</li>
    </ul>

    <p><strong>associatedtype = generic của protocol</strong>. Protocol không viết <code>protocol Repository&lt;T&gt;</code> kiểu Java mà khai báo <code>associatedtype Entity</code>. Từ Swift 5.7 có <em>primary associated type</em>: <code>protocol Repository&lt;Entity&gt;</code> để viết gọn <code>some Repository&lt;Product&gt;</code> hoặc <code>any Repository&lt;Product&gt;</code>. Thư viện chuẩn: <code>Collection&lt;Element&gt;</code>, <code>Sequence&lt;Element&gt;</code>.</p>

    <p><strong>some trong tham số</strong> (Swift 5.7): <code>func total(_ xs: some Collection&lt;Decimal&gt;)</code> là cách viết tắt của <code>func total&lt;C: Collection&gt;(_ xs: C) where C.Element == Decimal</code>. Đọc dễ hơn, cơ chế y hệt generic.</p>

    <div class="callout"><p>💡 Quy tắc chọn: cần tốc độ và kiểu cố định → generic / <code>some</code>. Cần trộn nhiều kiểu hoặc tráo lúc chạy (DI) → <code>any</code>. Swift ép bạn chọn rõ, Java thì luôn là "any" ngầm.</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "Hàm generic", lines: [
      "func maxBy<T, K: Comparable>(_ xs: [T], key: (T) -> K) -> T? {",
      "    guard var best = xs.first else { return nil }",
      "    for x in xs.dropFirst() where key(x) > key(best) {",
      "        best = x",
      "    }",
      "    return best",
      "}",
      "",
      "let top = maxBy(products) { $0.price }    // T = Product, K = Decimal"
    ]},
    { id: "where", label: "where & some", lines: [
      "func uniqueCount<C: Collection>(_ c: C) -> Int where C.Element: Hashable {",
      "    Set(c).count",
      "}",
      "",
      "// viết gọn bằng some (cùng cơ chế generic):",
      "func total(_ prices: some Collection<Decimal>) -> Decimal {",
      "    prices.reduce(0, +)",
      "}",
      "total([10, 20.5])        // Array<Decimal>",
      "total(Set([10, 20.5]))   // Set<Decimal> — cũng được"
    ]},
    { id: "assoc", label: "associatedtype", lines: [
      "protocol Repository<Entity> {",
      "    associatedtype Entity: Identifiable",
      "    func find(id: Entity.ID) async throws -> Entity?",
      "    func save(_ e: Entity) async throws",
      "}",
      "",
      "struct ProductRepo: Repository {",
      "    func find(id: String) async throws -> Product? { nil }  // Entity = Product",
      "    func save(_ e: Product) async throws {}",
      "}",
      "",
      "func load(_ repo: some Repository<Product>) async throws { }"
    ]},
    { id: "decode", label: "Không bị erasure", lines: [
      "func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {",
      "    try JSONDecoder().decode(T.self, from: data)   // T có thật lúc chạy",
      "}",
      "let user = try decode(User.self, from: data)",
      "",
      "// Java cần truyền Class<T> hoặc TypeReference<List<User>>{} vì erasure:",
      "// mapper.readValue(json, new TypeReference<List<User>>() {});",
      "let users = try decode([User].self, from: data)   // Swift: không cần mẹo"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">func total(_: some Collection&lt;Decimal&gt;)</div><div class="ns">một định nghĩa</div></div>
    <div class="arrow" id="a1">↓ compiler</div>
    <div class="row">
      <div class="node" id="spec"><div class="nl">Bản specialize cho [Decimal]</div><div class="ns">gọi trực tiếp, inline được</div></div>
      <div class="node" id="gen"><div class="nl">Bản chung</div><div class="ns">nhận type metadata + witness table</div></div>
    </div>
    <div class="node" id="java"><div class="nl">Java: List&lt;Object&gt; + cast</div><div class="ns">kiểu bị xoá lúc chạy</div></div>
  `,
  steps: [
    { title: "1 · Hàm generic có ràng buộc", tab: "basic", highlight: [1, 3, 9], on: ["src"],
      desc: "<code>K: Comparable</code> cho phép dùng <code>&gt;</code>. Kiểu T, K được suy ra từ lời gọi." },
    { title: "2 · where và some", tab: "where", highlight: [1, 6, 9, 10], on: ["src", "a1"],
      desc: "<code>some Collection&lt;Decimal&gt;</code> là cú pháp gọn cho generic có ràng buộc Element == Decimal." },
    { title: "3 · Specialization", tab: "where", highlight: [9], on: ["spec"],
      desc: "Khi biết kiểu cụ thể, compiler có thể sinh bản tối ưu riêng — không boxing, không cast." },
    { title: "4 · Protocol có associatedtype", tab: "assoc", highlight: [1, 2, 3, 7, 8, 12], on: ["gen"],
      desc: "<code>Entity</code> được suy ra từ chữ ký method của <code>ProductRepo</code>. Primary associated type cho phép viết <code>Repository&lt;Product&gt;</code>." },
    { title: "5 · Kiểu tồn tại lúc chạy", tab: "decode", highlight: [1, 2, 6, 7, 8], on: ["java"],
      desc: "<code>T.self</code> và <code>[User].self</code> dùng được trực tiếp. Java phải dùng <code>TypeReference</code> vì generic bị xoá." }
  ],

  quiz: [
    { q: "Khác biệt lớn nhất giữa generic Swift và Java lúc chạy?", options: [
        "Swift không có generic",
        "Java xoá kiểu (type erasure); Swift giữ thông tin kiểu và có thể specialize",
        "Swift xoá kiểu, Java giữ",
        "Không khác"
      ], correct: 1, explanation: "Swift truyền type metadata hoặc specialize code cho kiểu cụ thể." },
    { q: "[Int] trong Swift lưu phần tử thế nào?", options: [
        "Mảng các object Integer đã boxing", "Các Int liền nhau, không boxing", "Linked list", "Dictionary"
      ], correct: 1, explanation: "Không có boxing như List<Integer> của Java." },
    { q: "Tương đương <T extends Comparable<T>> của Java?", options: [
        "<T: Comparable>", "<T super Comparable>", "<? extends Comparable>", "<T == Comparable>"
      ], correct: 0, explanation: "Dấu hai chấm biểu thị ràng buộc protocol/class." },
    { q: "Protocol Swift khai báo 'kiểu generic thành viên' bằng gì?", options: [
        "protocol P<T> như Java", "associatedtype", "typealias T = Any", "generic keyword"
      ], correct: 1, explanation: "Primary associated type <Entity> chỉ là cú pháp để chỉ định associatedtype khi dùng." },
    { q: "func total(_ xs: some Collection<Decimal>) tương đương?", options: [
        "func total(_ xs: any Collection)",
        "func total<C: Collection>(_ xs: C) where C.Element == Decimal",
        "func total(_ xs: [Any])",
        "func total(_ xs: Collection<Decimal>?)"
      ], correct: 1, explanation: "some ở vị trí tham số là generic ẩn danh." },
    { q: "Vì sao Swift decode [User].self được mà Java cần TypeReference?", options: [
        "Swift dùng reflection chậm",
        "Swift giữ kiểu generic lúc chạy; Java xoá List<User> thành List",
        "Java không có JSON",
        "Swift đoán kiểu từ JSON"
      ], correct: 1, explanation: "Hệ quả trực tiếp của type erasure." },
    { q: "Khi compiler không specialize được, hàm generic Swift gọi method của T bằng cách nào?", options: [
        "Reflection theo tên",
        "Qua type metadata và witness table (bảng hàm của protocol) truyền ngầm",
        "Ép về Any rồi cast",
        "Không gọi được"
      ], correct: 1, explanation: "Witness table giống vtable nhưng theo protocol conformance." },
    { q: "Swift có wildcard ? extends như Java không?", options: [
        "Có", "Không — dùng ràng buộc generic hoặc some/any", "Có nhưng viết là *", "Chỉ cho Array"
      ], correct: 1, explanation: "Swift thiết kế khác, không cần variance wildcard." },
    { q: "Trong ProductRepo, Entity được xác định thế nào?", options: [
        "Bắt buộc viết typealias Entity = Product",
        "Compiler suy ra từ chữ ký method (find trả Product?)",
        "Lúc chạy",
        "Mặc định là Any"
      ], correct: 1, explanation: "Associated type inference; có thể viết typealias cho rõ nếu muốn." }
  ]
});
