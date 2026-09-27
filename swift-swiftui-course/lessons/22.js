window.LESSONS.push({
  id: "22",
  phase: "4", phaseName: "Kiến trúc & dữ liệu",
  title: "Lưu trữ: UserDefaults, Keychain, SwiftData",
  subtitle: "Chọn đúng chỗ cho từng loại dữ liệu · @AppStorage · SecItem API · @Model, ModelContainer, @Query",

  theory: `
    <p>Backend có Postgres, Redis, Vault. Trên điện thoại, mỗi loại dữ liệu cũng có chỗ riêng — chọn sai là lộ token hoặc app chậm.</p>
    <table>
      <tr><th>Loại dữ liệu</th><th>Nơi lưu</th><th>RN tương đương</th><th>Backend liên tưởng</th></tr>
      <tr><td>Cài đặt nhỏ: theme, ngôn ngữ, đã xem onboarding</td><td><strong>UserDefaults</strong> / <code>@AppStorage</code></td><td>AsyncStorage / MMKV</td><td>file config</td></tr>
      <tr><td>Bí mật: access/refresh token, mật khẩu</td><td><strong>Keychain</strong></td><td>react-native-keychain</td><td>Vault / KMS</td></tr>
      <tr><td>Dữ liệu có cấu trúc, truy vấn, offline</td><td><strong>SwiftData</strong> (hoặc Core Data, SQLite/GRDB)</td><td>WatermelonDB, SQLite</td><td>Postgres</td></tr>
      <tr><td>File lớn: ảnh, PDF, cache JSON</td><td>FileManager (Documents, Caches)</td><td>react-native-fs</td><td>S3</td></tr>
    </table>

    <p><strong>UserDefaults</strong>: kho key-value (plist) trong sandbox app, <strong>không mã hoá riêng</strong> — không bao giờ lưu token ở đây. Chỉ dùng cho giá trị nhỏ (được nạp vào bộ nhớ). Trong SwiftUI: <code>@AppStorage("onboarded") var onboarded = false</code> — đọc/ghi như <code>@State</code>, view tự vẽ lại khi giá trị đổi.</p>

    <p><strong>Keychain</strong>: kho bí mật do hệ điều hành quản lý, mã hoá bằng khoá gắn với thiết bị (bảo vệ bởi Secure Enclave), <strong>vẫn còn sau khi gỡ app</strong> (cần xử lý lần chạy đầu sau khi cài lại). API C cổ: <code>SecItemAdd</code>, <code>SecItemCopyMatching</code>, <code>SecItemUpdate</code>, <code>SecItemDelete</code> với dictionary thuộc tính; trả <code>OSStatus</code> (<code>errSecSuccess</code>, <code>errSecDuplicateItem</code>, <code>errSecItemNotFound</code>). Chọn mức truy cập, ví dụ <code>kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly</code>: đọc được sau lần mở khoá đầu tiên (kể cả khi app chạy nền) và không đi theo bản sao lưu sang máy khác. Thường bọc trong một struct/actor <code>TokenStore</code> nhỏ.</p>

    <p><strong>SwiftData</strong> (iOS 17) — ORM của Apple, xây trên nền Core Data/SQLite, khai báo bằng macro:</p>
    <ul>
      <li><code>@Model final class CartEntry { ... }</code> ≈ <code>@Entity</code> JPA. Macro sinh schema, theo dõi thay đổi (cũng Observable). <code>@Attribute(.unique)</code>, <code>@Relationship(deleteRule: .cascade)</code>.</li>
      <li><code>ModelContainer</code> ≈ DataSource + schema; gắn bằng <code>.modelContainer(for: CartEntry.self)</code> ở App.</li>
      <li><code>ModelContext</code> ≈ <code>EntityManager</code>/persistence context: <code>insert</code>, <code>delete</code>, <code>fetch(FetchDescriptor)</code>, <code>save()</code>. Context chính có <strong>autosave</strong>. Lấy trong view: <code>@Environment(&#92;.modelContext)</code>.</li>
      <li><code>@Query(sort: &#92;CartEntry.addedAt, order: .reverse) var entries: [CartEntry]</code> — truy vấn "sống": dữ liệu đổi là view tự cập nhật. Lọc bằng macro <code>#Predicate</code> (biểu thức Swift được dịch sang SQL).</li>
      <li>Model object <strong>không Sendable</strong> — không chuyển giữa actor; muốn làm việc nền dùng <code>@ModelActor</code> với context riêng, truyền <code>PersistentIdentifier</code>.</li>
    </ul>

    <div class="callout"><p>💡 Với app thương mại điện tử: server vẫn là nguồn sự thật. SwiftData hợp cho cache offline, nháp, lịch sử tìm kiếm — không nên cố đồng bộ hai chiều phức tạp nếu không thật cần.</p></div>
  `,

  codeTabs: [
    { id: "defaults", label: "UserDefaults & @AppStorage", lines: [
      "UserDefaults.standard.set(true, forKey: \"onboarded\")",
      "let seen = UserDefaults.standard.bool(forKey: \"onboarded\")   // thiếu key → false",
      "",
      "struct SettingsView: View {",
      "    @AppStorage(\"onboarded\") private var onboarded = false",
      "    @AppStorage(\"currency\") private var currency = \"VND\"",
      "    var body: some View {",
      "        Toggle(\"Đã xem giới thiệu\", isOn: $onboarded)   // ghi thẳng vào UserDefaults",
      "    }",
      "}",
      "// ❌ @AppStorage(\"accessToken\") — không mã hoá riêng, lộ khi backup/thiết bị bị jailbreak"
    ]},
    { id: "keychain", label: "Keychain", lines: [
      "import Security",
      "",
      "struct Keychain {",
      "    let service = \"vn.shop.app\"",
      "    func save(_ value: Data, account: String) throws {",
      "        let query: [String: Any] = [",
      "            kSecClass as String: kSecClassGenericPassword,",
      "            kSecAttrService as String: service,",
      "            kSecAttrAccount as String: account]",
      "        SecItemDelete(query as CFDictionary)             // xoá bản cũ nếu có",
      "        var add = query",
      "        add[kSecValueData as String] = value",
      "        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
      "        let status = SecItemAdd(add as CFDictionary, nil)",
      "        guard status == errSecSuccess else { throw KeychainError(status) }",
      "    }",
      "}"
    ]},
    { id: "read", label: "Đọc Keychain", lines: [
      "func read(account: String) throws -> Data? {",
      "    let query: [String: Any] = [",
      "        kSecClass as String: kSecClassGenericPassword,",
      "        kSecAttrService as String: service,",
      "        kSecAttrAccount as String: account,",
      "        kSecReturnData as String: true,",
      "        kSecMatchLimit as String: kSecMatchLimitOne]",
      "    var out: CFTypeRef?",
      "    let status = SecItemCopyMatching(query as CFDictionary, &out)",
      "    if status == errSecItemNotFound { return nil }",
      "    guard status == errSecSuccess else { throw KeychainError(status) }",
      "    return out as? Data",
      "}"
    ]},
    { id: "swiftdata", label: "SwiftData", lines: [
      "import SwiftData",
      "",
      "@Model final class RecentSearch {",
      "    @Attribute(.unique) var term: String",
      "    var searchedAt: Date",
      "    init(term: String, searchedAt: Date = .now) { self.term = term; self.searchedAt = searchedAt }",
      "}",
      "",
      "// App: WindowGroup { RootView() }.modelContainer(for: RecentSearch.self)",
      "",
      "struct RecentSearchList: View {",
      "    @Environment(\\.modelContext) private var context",
      "    @Query(sort: \\RecentSearch.searchedAt, order: .reverse) private var recents: [RecentSearch]",
      "    var body: some View {",
      "        List(recents) { r in Text(r.term) }",
      "        Button(\"Lưu 'áo khoác'\") { context.insert(RecentSearch(term: \"áo khoác\")) }  // autosave",
      "    }",
      "}"
    ]},
    { id: "jpa", label: "So với JPA", lines: [
      "@Entity class RecentSearch {",
      "    @Id String term;",
      "    Instant searchedAt;",
      "}",
      "",
      "em.persist(new RecentSearch(\"áo khoác\"));     // ≈ context.insert(...)",
      "em.createQuery(\"from RecentSearch r order by r.searchedAt desc\")",
      "  .getResultList();                            // ≈ @Query(sort:order:)",
      "// Khác: @Query tự cập nhật view khi dữ liệu đổi"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">App</div><div class="ns">dữ liệu nào đi đâu?</div></div>
    <div class="row">
      <div class="node" id="ud"><div class="nl">UserDefaults</div><div class="ns">cài đặt nhỏ, không bí mật</div></div>
      <div class="node" id="kc"><div class="nl">Keychain</div><div class="ns">token, mật khẩu (mã hoá, còn sau khi gỡ app)</div></div>
    </div>
    <div class="row">
      <div class="node" id="sd"><div class="nl">SwiftData</div><div class="ns">@Model · ModelContext · @Query</div></div>
      <div class="node" id="fs"><div class="nl">FileManager</div><div class="ns">file lớn, cache</div></div>
    </div>
    <div class="arrow" id="a1">↓ @Query theo dõi thay đổi → view tự cập nhật</div>
  `,
  steps: [
    { title: "1 · UserDefaults cho cài đặt", tab: "defaults", highlight: [1, 2, 5, 8], on: ["app", "ud"],
      desc: "<code>@AppStorage</code> giống <code>@State</code> nhưng bền vững trong UserDefaults." },
    { title: "2 · Không lưu bí mật ở UserDefaults", tab: "defaults", highlight: [11], on: ["ud"],
      desc: "Plist trong sandbox, không có lớp mã hoá riêng như Keychain." },
    { title: "3 · Ghi Keychain", tab: "keychain", highlight: [6, 7, 8, 9, 10, 13, 14, 15], on: ["kc"],
      desc: "Item nhận diện bằng class + service + account. Xoá trước rồi thêm để tránh <code>errSecDuplicateItem</code> (hoặc dùng SecItemUpdate). Chọn mức accessible phù hợp." },
    { title: "4 · Đọc Keychain", tab: "read", highlight: [6, 7, 9, 10, 12], on: ["kc"],
      desc: "<code>kSecReturnData</code> + <code>kSecMatchLimitOne</code>; không tìm thấy là <code>errSecItemNotFound</code>, không phải lỗi." },
    { title: "5 · SwiftData model & query", tab: "swiftdata", highlight: [3, 4, 9, 12, 13, 16], on: ["sd", "a1"],
      desc: "<code>@Model</code> ≈ @Entity; <code>@Query</code> là truy vấn sống; insert xong, autosave lưu và view tự cập nhật." },
    { title: "6 · Đối chiếu JPA", tab: "jpa", highlight: [1, 6, 7, 9], on: ["sd"],
      desc: "ModelContext ≈ EntityManager. Khác lớn: kết quả truy vấn gắn với UI và tự làm mới." }
  ],

  quiz: [
    { q: "Nên lưu refresh token ở đâu trên iOS?", options: [
        "UserDefaults", "Keychain", "File JSON trong Documents", "@AppStorage"
      ], correct: 1, explanation: "Keychain được hệ điều hành mã hoá và kiểm soát truy cập." },
    { q: "@AppStorage(\"onboarded\") var onboarded = false lưu dữ liệu ở đâu?", options: [
        "Keychain", "UserDefaults", "SwiftData", "Bộ nhớ tạm"
      ], correct: 1, explanation: "Wrapper tiện lợi quanh UserDefaults, cập nhật view khi đổi." },
    { q: "Dữ liệu Keychain sau khi người dùng gỡ app?", options: [
        "Luôn bị xoá cùng app",
        "Có thể vẫn còn — cần xử lý ở lần chạy đầu sau khi cài lại",
        "Chuyển sang iCloud",
        "Bị mã hoá lại"
      ], correct: 1, explanation: "Hành vi đã biết; nhiều app xoá keychain khi phát hiện lần chạy đầu (cờ trong UserDefaults)." },
    { q: "SecItemCopyMatching trả errSecItemNotFound nghĩa là?", options: [
        "Keychain hỏng", "Không có item khớp — thường trả nil, không phải lỗi", "Thiếu quyền", "Sai kiểu dữ liệu"
      ], correct: 1, explanation: "Xử lý như 'chưa đăng nhập'." },
    { q: "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly nghĩa là?", options: [
        "Đọc được bất cứ lúc nào kể cả trước lần mở khoá đầu",
        "Đọc được sau lần mở khoá đầu tiên kể từ khi khởi động, và không di chuyển sang thiết bị khác qua backup",
        "Chỉ đọc khi màn hình đang mở khoá",
        "Đồng bộ iCloud"
      ], correct: 1, explanation: "Hợp cho token cần dùng khi app chạy nền." },
    { q: "Tương đương @Entity của JPA trong SwiftData?", options: [
        "@Query", "@Model", "ModelContainer", "@Observable"
      ], correct: 1, explanation: "Macro @Model trên class." },
    { q: "@Query trong view SwiftUI khác truy vấn JPA thường ở đâu?", options: [
        "Không khác",
        "Là truy vấn 'sống': dữ liệu trong store đổi thì view tự cập nhật",
        "Chỉ chạy một lần",
        "Không lọc được"
      ], correct: 1, explanation: "Tích hợp với cơ chế invalidation của SwiftUI." },
    { q: "Muốn xử lý SwiftData trên nền (import 10.000 bản ghi) thì?", options: [
        "Gửi model object sang Task.detached",
        "Dùng @ModelActor với ModelContext riêng; truyền PersistentIdentifier giữa các actor",
        "Dùng UserDefaults",
        "Không làm được"
      ], correct: 1, explanation: "Model object không Sendable." },
    { q: "Vì sao không nên dùng UserDefaults cho danh sách 5.000 sản phẩm?", options: [
        "Không lưu được mảng",
        "UserDefaults dành cho giá trị nhỏ, được nạp vào bộ nhớ; dữ liệu lớn/có truy vấn dùng SwiftData/SQLite hoặc file",
        "Bị xoá mỗi ngày",
        "Chỉ lưu Bool"
      ], correct: 1, explanation: "Chọn kho theo loại dữ liệu." }
  ]
});
