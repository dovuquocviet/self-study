window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "Optional: null được đưa vào hệ thống kiểu",
  subtitle: "T? là enum · if let / guard let · ?? · optional chaining · vì sao ! là mùi code",

  theory: `
    <p>Trong Java, <em>mọi</em> reference đều có thể null và compiler không nhắc bạn — <code>NullPointerException</code> xảy ra lúc chạy. <code>java.util.Optional</code> chỉ là một class bọc ngoài, không ai bắt bạn dùng. Swift làm ngược lại: <strong>kiểu <code>String</code> không bao giờ là nil</strong>. Muốn "có thể không có", phải khai báo <code>String?</code>.</p>

    <p><strong>Optional thực chất là enum</strong> trong thư viện chuẩn:</p>
    <ul>
      <li><code>enum Optional&lt;Wrapped&gt; { case none; case some(Wrapped) }</code></li>
      <li><code>String?</code> là cách viết tắt của <code>Optional&lt;String&gt;</code>; <code>nil</code> chính là <code>.none</code>.</li>
      <li>Vì là kiểu khác, bạn <strong>không thể</strong> gọi <code>name.count</code> khi <code>name: String?</code> — phải "mở" (unwrap) trước. Compiler ép bạn xử lý nhánh nil.</li>
    </ul>

    <p><strong>Các cách mở Optional</strong></p>
    <table>
      <tr><th>Cú pháp</th><th>Ý nghĩa</th><th>Java tương đương</th></tr>
      <tr><td><code>if let name { ... }</code></td><td>Có giá trị thì chạy khối, <code>name</code> trong khối là <code>String</code></td><td><code>if (name != null)</code> + cast</td></tr>
      <tr><td><code>guard let user else { return }</code></td><td>Thoát sớm nếu nil; sau guard, <code>user</code> dùng được cho phần còn lại của hàm</td><td>early return</td></tr>
      <tr><td><code>a ?? "mặc định"</code></td><td>Nil-coalescing</td><td><code>Optional.orElse</code></td></tr>
      <tr><td><code>user?.address?.city</code></td><td>Optional chaining: gặp nil ở đâu thì cả biểu thức là nil</td><td>chuỗi <code>map</code> của Optional</td></tr>
      <tr><td><code>name.map { ... }</code></td><td>Biến đổi nếu có giá trị</td><td><code>Optional.map</code></td></tr>
      <tr><td><code>name!</code></td><td>Force unwrap: nil thì <strong>crash</strong></td><td><code>Optional.get()</code></td></tr>
    </table>

    <p><code>if let name</code> (không có <code>= name</code>) là cú pháp rút gọn từ Swift 5.7; code cũ viết <code>if let name = name</code>.</p>

    <p><strong>Khi nào dùng <code>!</code>?</strong> Gần như không. Chỉ khi nil là lỗi lập trình chắc chắn không thể xảy ra (ví dụ <code>URL(string: "https://api.shop.vn")!</code> với chuỗi hằng bạn tự viết). Dữ liệu từ mạng, từ người dùng, từ DB — luôn dùng <code>guard let</code>/<code>if let</code>. Còn <strong>implicitly unwrapped optional</strong> <code>String!</code> là di sản thời Objective-C/IBOutlet, tránh trong code mới.</p>

    <p><strong>Nối với Java/Kotlin</strong>: Kotlin có <code>String?</code>, <code>?.</code>, <code>?:</code> gần như y hệt — nếu bạn học Kotlin song song, đây là phần chung. Khác biệt: Swift Optional là enum thật, nên có thể <code>switch</code> trên nó với <code>case .some(let v)</code> / <code>case .none</code>.</p>

    <div class="callout"><p>💡 Thói quen kỹ sư: đẩy Optional về <strong>biên</strong> (parse JSON, đọc input) và mở nó ngay tại đó bằng <code>guard</code>. Lõi nghiệp vụ nhận kiểu không-optional. Đừng để <code>String?</code> lan khắp codebase.</p></div>
  `,

  codeTabs: [
    { id: "java", label: "Java", lines: [
      "String city(User u) {",
      "    if (u == null) return \"?\";",
      "    Address a = u.getAddress();",
      "    if (a == null || a.getCity() == null) return \"?\";",
      "    return a.getCity().toUpperCase();",
      "}",
      "// Quên 1 check null → NPE lúc chạy, compiler không cảnh báo"
    ]},
    { id: "swift", label: "Swift", lines: [
      "struct Address { var city: String? }",
      "struct User { var address: Address? }",
      "",
      "func city(_ u: User?) -> String {",
      "    u?.address?.city?.uppercased() ?? \"?\"",
      "}",
      "",
      "// let c: String = u.address.city   ❌ lỗi biên dịch: phải xử lý nil"
    ]},
    { id: "unwrap", label: "if let / guard", lines: [
      "func checkout(cartId: String?, token: String?) throws -> Receipt {",
      "    guard let cartId, let token else {",
      "        throw CheckoutError.missingInput",
      "    }",
      "    // từ đây cartId, token là String (không optional)",
      "    if let coupon = loadCoupon(for: cartId) {",
      "        print(\"Áp mã \\(coupon.code)\")",
      "    }",
      "    return try pay(cartId: cartId, token: token)",
      "}"
    ]},
    { id: "enum", label: "Bản chất enum", lines: [
      "let raw: Int? = Int(\"42x\")      // parse thất bại → nil",
      "",
      "switch raw {",
      "case .some(let v): print(\"Số \\(v)\")",
      "case .none:        print(\"Không phải số\")",
      "}",
      "",
      "let doubled = raw.map { $0 * 2 }  // Int?  (nil vẫn là nil)",
      "let n = raw!                      // 💥 Fatal error: Unexpectedly found nil"
    ]}
  ],

  stageHtml: `
    <div class="node" id="in"><div class="nl">Giá trị kiểu String?</div><div class="ns">.some("Hà Nội") hoặc .none</div></div>
    <div class="arrow" id="a1">↓ bắt buộc mở</div>
    <div class="row">
      <div class="node" id="safe"><div class="nl">if let / guard let / ?? / ?.</div><div class="ns">compiler kiểm tra cả nhánh nil</div></div>
      <div class="node" id="force"><div class="nl">x!</div><div class="ns">nil → crash</div></div>
    </div>
    <div class="arrow" id="a2">↓ sau khi mở</div>
    <div class="node" id="core"><div class="nl">Lõi nghiệp vụ nhận String</div><div class="ns">không cần kiểm tra null nữa</div></div>
  `,
  steps: [
    { title: "1 · Java: null ẩn trong mọi reference", tab: "java", highlight: [2, 4, 7], on: ["in"],
      desc: "Chuỗi check null viết tay, sót một cái là NPE. Kiểu <code>String</code> của Java không nói gì về khả năng null." },
    { title: "2 · Swift: nil nằm trong kiểu", tab: "swift", highlight: [1, 2, 5, 8], on: ["in", "a1"],
      desc: "<code>?.</code> dừng ở nil đầu tiên, <code>??</code> cho giá trị mặc định. Truy cập thẳng field optional là lỗi biên dịch." },
    { title: "3 · guard let: thoát sớm", tab: "unwrap", highlight: [2, 3, 4, 5], on: ["safe"],
      desc: "Sau <code>guard</code>, biến đã mở dùng được đến hết hàm. Khối <code>else</code> bắt buộc phải thoát (return/throw)." },
    { title: "4 · if let: nhánh có giá trị", tab: "unwrap", highlight: [6, 7, 8], on: ["safe"],
      desc: "<code>coupon</code> chỉ tồn tại trong khối if. Hợp cho logic tuỳ chọn." },
    { title: "5 · Optional là enum; ! là crash", tab: "enum", highlight: [3, 4, 5, 8, 9], on: ["force"],
      desc: "switch được trên <code>.some</code>/<code>.none</code>. <code>!</code> trên nil dừng chương trình ngay." },
    { title: "6 · Đẩy optional về biên", tab: "unwrap", highlight: [9], on: ["a2", "core"],
      desc: "Hàm <code>pay</code> nhận <code>String</code> thường — lõi sạch, không phải phòng thủ null." }
  ],

  quiz: [
    { q: "Biến kiểu String (không có ?) trong Swift có thể là nil không?", options: [
        "Có, như Java", "Không — chỉ String? mới chứa được nil", "Có nếu khai báo var", "Chỉ trong class"
      ], correct: 1, explanation: "Nil là một trường hợp của kiểu Optional, không phải giá trị của mọi reference." },
    { q: "String? thực chất là gì?", options: [
        "Một class bọc như java.util.Optional",
        "Optional<String> — một enum với case none và some(String)",
        "Con trỏ có thể null",
        "Macro của compiler, không có kiểu"
      ], correct: 1, explanation: "Optional là enum generic trong thư viện chuẩn." },
    { q: "u?.address?.city khi address là nil cho kết quả?", options: [
        "Crash", "nil (kiểu String?)", "Chuỗi rỗng", "Lỗi biên dịch"
      ], correct: 1, explanation: "Optional chaining dừng ở nil đầu tiên và trả nil." },
    { q: "Khối else của guard let bắt buộc làm gì?", options: [
        "Không cần gì", "Thoát khỏi phạm vi hiện tại (return, throw, break, continue…)", "In log", "Gán giá trị mặc định"
      ], correct: 1, explanation: "Compiler đảm bảo sau guard biến đã được mở, nên nhánh else không được rơi xuống." },
    { q: "Toán tử ?? tương đương gì bên Java?", options: [
        "Optional.get()", "Optional.orElse(...)", "Objects.requireNonNull", "instanceof"
      ], correct: 1, explanation: "a ?? b trả a nếu có giá trị, ngược lại b." },
    { q: "Int(\"42x\") trả về gì?", options: [
        "42", "0", "nil vì parse thất bại (kiểu Int?)", "Ném NumberFormatException"
      ], correct: 2, explanation: "Initializer có thể thất bại (failable init) trả Optional thay vì ném lỗi." },
    { q: "Khi nào force unwrap (!) chấp nhận được?", options: [
        "Với dữ liệu JSON từ server",
        "Khi nil là lỗi lập trình không thể xảy ra, ví dụ URL từ chuỗi hằng tự viết",
        "Mọi lúc cho gọn code",
        "Với input người dùng"
      ], correct: 1, explanation: "Dữ liệu bên ngoài luôn có thể thiếu; dùng guard/if let." },
    { q: "Sau dòng guard let token else { return }, token có kiểu gì?", options: [
        "String?", "String", "Optional<Any>", "String!"
      ], correct: 1, explanation: "guard let mở optional và biến đã mở sống tới hết phạm vi." },
    { q: "raw.map { $0 * 2 } với raw: Int? = nil cho gì?", options: [
        "0", "nil", "Crash", "Lỗi biên dịch"
      ], correct: 1, explanation: "map trên Optional chỉ chạy closure khi có giá trị." }
  ]
});
