window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Kiến trúc app & tài nguyên hệ thống",
  title: "Lưu trữ cục bộ: key-value, SQLite, file và kho khoá bí mật",
  subtitle: "DataStore / UserDefaults · Room / SwiftData · Documents, Caches, tmp · Keystore & Keychain · backup",

  theory: `
    <p>Trên server bạn có PostgreSQL, Redis, S3. Trên máy người dùng bạn có… một thư mục sandbox (bài 01). Chọn đúng "ngăn" quyết định dữ liệu có mất không, có bị backup lên cloud không, có lộ không.</p>

    <table>
      <tr><th>Nhu cầu</th><th>Android</th><th>iOS</th><th>Ghi chú</th></tr>
      <tr><td>Cài đặt nhỏ (theme, cờ đã xem onboarding)</td><td><strong>DataStore</strong> (thay SharedPreferences)</td><td><strong>UserDefaults</strong> / <code>@AppStorage</code></td><td>Không lưu bí mật; không lưu dữ liệu lớn</td></tr>
      <tr><td>Dữ liệu có cấu trúc, truy vấn</td><td><strong>Room</strong> (ORM trên SQLite)</td><td><strong>SwiftData</strong> / Core Data (trên SQLite), hoặc GRDB</td><td>Giống JPA thu nhỏ; có migration schema</td></tr>
      <tr><td>File (ảnh, PDF, export)</td><td><code>filesDir</code>, <code>cacheDir</code></td><td><code>Documents</code>, <code>Library/Caches</code>, <code>tmp</code></td><td>Cache có thể bị OS xoá khi thiếu chỗ</td></tr>
      <tr><td>Bí mật (refresh token, khoá)</td><td><strong>Android Keystore</strong> (khoá phần cứng) + mã hoá dữ liệu</td><td><strong>Keychain</strong></td><td>Không bao giờ để plain text trong prefs</td></tr>
    </table>

    <p><strong>Vì sao DataStore thay SharedPreferences?</strong> SharedPreferences đọc toàn bộ file XML vào RAM và <code>apply()</code> ghi bất đồng bộ nhưng có thể chặn main thread lúc Activity dừng (nguồn ANR kinh điển); <code>commit()</code> ghi đồng bộ.
    DataStore dùng coroutine + Flow, ghi nguyên tử, không chạy trên main.</p>

    <p><strong>SQLite trên máy</strong>: một file, một process; ghi phải tuần tự (WAL cho phép đọc song song với ghi). Room kiểm tra SQL lúc biên dịch và cấm truy vấn trên main thread (trừ khi bạn cố tình tắt).
    Đổi schema → phải viết <strong>migration</strong>, nếu không người dùng cập nhật app sẽ crash hoặc mất dữ liệu — tương tự Flyway/Liquibase nhưng chạy trên hàng triệu máy bạn không kiểm soát.</p>

    <p><strong>Thư mục iOS</strong>: <code>Documents</code> (dữ liệu người dùng tạo, được backup iCloud), <code>Library/Application Support</code> (dữ liệu app, backup), <code>Library/Caches</code> (không backup, có thể bị xoá), <code>tmp</code> (xoá bất kỳ lúc nào).
    Android có Auto Backup lên Google Drive cho app target 23+ — cấu hình <code>dataExtractionRules</code> để loại DB chứa token.</p>

    <p><strong>Keychain / Keystore</strong>: Keychain lưu mục bí mật được mã hoá bởi hệ thống, có thể giới hạn "chỉ khi máy đã mở khoá" và <em>không đi theo backup sang máy khác</em> (<code>...ThisDeviceOnly</code>). Lưu ý: mục Keychain có thể còn lại sau khi gỡ app.
    Android Keystore giữ <em>khoá</em> trong phần cứng (TEE/StrongBox) không export được; bạn dùng khoá đó để mã hoá dữ liệu rồi lưu bản mã. (<code>EncryptedSharedPreferences</code> của Jetpack Security đã bị deprecated.)</p>

    <div class="callout"><p>💡 Quy tắc chọn nhanh: bí mật → Keychain/Keystore; có quan hệ/truy vấn → Room/SwiftData; cờ đơn giản → DataStore/UserDefaults; tải về tạo lại được → Caches.</p></div>
  `,

  codeTabs: [
    { id: "ds", label: "① DataStore / UserDefaults", lines: [
      "// Android: Preferences DataStore",
      "val Context.settings by preferencesDataStore(name = \"settings\")",
      "val DARK = booleanPreferencesKey(\"dark_mode\")",
      "",
      "val darkFlow: Flow<Boolean> = ctx.settings.data.map { it[DARK] ?: false }",
      "suspend fun setDark(v: Boolean) = ctx.settings.edit { it[DARK] = v }",
      "",
      "// iOS: SwiftUI",
      "@AppStorage(\"dark_mode\") private var dark = false      // UserDefaults bên dưới"
    ]},
    { id: "room", label: "② Room", lines: [
      "@Entity(tableName = \"orders\")",
      "data class OrderEntity(@PrimaryKey val id: String, val total: Long, val status: String)",
      "",
      "@Dao interface OrderDao {",
      "    @Query(\"SELECT * FROM orders WHERE status = :s ORDER BY id DESC\")",
      "    fun byStatus(s: String): Flow<List<OrderEntity>>     // tự phát lại khi bảng đổi",
      "    @Upsert suspend fun upsert(o: OrderEntity)",
      "}",
      "",
      "val MIGRATION_1_2 = object : Migration(1, 2) {",
      "    override fun migrate(db: SupportSQLiteDatabase) {",
      "        db.execSQL(\"ALTER TABLE orders ADD COLUMN note TEXT\")",
      "    }",
      "}"
    ]},
    { id: "sd", label: "③ SwiftData", lines: [
      "import SwiftData",
      "",
      "@Model final class Order {",
      "    @Attribute(.unique) var id: String",
      "    var total: Int",
      "    var status: String",
      "    init(id: String, total: Int, status: String) { self.id = id; self.total = total; self.status = status }",
      "}",
      "",
      "// App: .modelContainer(for: Order.self)",
      "struct OrdersView: View {",
      "    @Query(filter: #Predicate<Order> { $0.status == \"paid\" }, sort: \\Order.id) var orders: [Order]",
      "    var body: some View { List(orders) { Text($0.id) } }",
      "}"
    ]},
    { id: "kc", label: "④ Keychain", lines: [
      "func saveRefreshToken(_ token: String) throws {",
      "    let base: [String: Any] = [",
      "        kSecClass as String: kSecClassGenericPassword,",
      "        kSecAttrService as String: \"vn.shop.auth\",",
      "        kSecAttrAccount as String: \"refresh\"",
      "    ]",
      "    SecItemDelete(base as CFDictionary)",
      "    var add = base",
      "    add[kSecValueData as String] = Data(token.utf8)",
      "    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
      "    let status = SecItemAdd(add as CFDictionary, nil)",
      "    guard status == errSecSuccess else { throw KeychainError(status) }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="data"><div class="nl">📥 Dữ liệu cần lưu</div><div class="ns">loại gì? mất có sao không? bí mật không?</div></div>
    <div class="arrow" id="a1">↓ chọn ngăn</div>
    <div class="row">
      <div class="node" id="kv"><div class="nl">🔧 DataStore / UserDefaults</div><div class="ns">cờ, cài đặt</div></div>
      <div class="node" id="db"><div class="nl">🗄️ Room / SwiftData</div><div class="ns">SQLite + migration</div></div>
    </div>
    <div class="row">
      <div class="node" id="file"><div class="nl">📁 Files / Caches</div><div class="ns">Caches có thể bị xoá</div></div>
      <div class="node" id="sec"><div class="nl">🔐 Keychain / Keystore</div><div class="ns">bí mật, ThisDeviceOnly</div></div>
    </div>
    <div class="arrow" id="a2">↓ cập nhật app</div>
    <div class="node" id="mig"><div class="nl">🔄 Migration schema</div><div class="ns">thiếu = crash trên máy người dùng</div></div>
  `,
  steps: [
    { title: "1 · Cài đặt nhỏ", tab: "ds", highlight: [2, 5, 6, 9], on: ["data", "a1", "kv"],
      desc: "DataStore đọc/ghi qua Flow và suspend, không chặn main. @AppStorage bọc UserDefaults." },
    { title: "2 · Dữ liệu có cấu trúc", tab: "room", highlight: [1, 2, 5, 6, 7], on: ["db"],
      desc: "Room: SQL được kiểm tra lúc biên dịch; truy vấn trả Flow tự phát lại khi bảng đổi — nền tảng của offline-first." },
    { title: "3 · Migration", tab: "room", highlight: [10, 11, 12], on: ["a2", "mig"],
      desc: "Mỗi lần đổi schema tăng version và viết migration — như Flyway nhưng chạy trên máy người dùng." },
    { title: "4 · iOS: SwiftData", tab: "sd", highlight: [3, 4, 12], on: ["db"],
      desc: "@Model thay Entity; @Query trong view tự cập nhật khi dữ liệu đổi." },
    { title: "5 · Bí mật vào Keychain", tab: "kc", highlight: [3, 9, 10, 11], on: ["sec"],
      desc: "AfterFirstUnlockThisDeviceOnly: đọc được sau lần mở khoá đầu, không đi theo backup sang máy khác." }
  ],

  quiz: [
    { q: "Refresh token nên lưu ở đâu trên iOS?", options: [
        "UserDefaults", "Keychain", "Documents/token.txt", "Biến static"
      ], correct: 1, explanation: "Keychain được hệ thống mã hoá và kiểm soát truy cập." },
    { q: "Vì sao Google khuyến nghị DataStore thay SharedPreferences?", options: [
        "Nhanh hơn 100 lần",
        "API bất đồng bộ (Flow/suspend), ghi nguyên tử; SharedPreferences có thể chặn main thread và gây ANR",
        "SharedPreferences bị xoá khỏi Android", "DataStore lưu lên cloud"
      ], correct: 1, explanation: "apply() vẫn có thể bị chờ khi Activity dừng." },
    { q: "Đổi schema Room mà không có migration thì người dùng cập nhật app sẽ…", options: [
        "Không sao", "Crash khi mở DB (hoặc mất dữ liệu nếu dùng fallbackToDestructiveMigration)", "Tự migrate", "Chỉ cảnh báo"
      ], correct: 1, explanation: "Giống quên Flyway script trên production." },
    { q: "Thư mục iOS nào có thể bị hệ thống xoá khi thiếu dung lượng và không được backup?", options: [
        "Documents", "Library/Application Support", "Library/Caches", "Bundle"
      ], correct: 2, explanation: "Chỉ đặt dữ liệu tải lại được vào Caches." },
    { q: "Android Keystore bảo vệ gì?", options: [
        "Lưu dữ liệu lớn", "Khoá mật mã nằm trong phần cứng, không export được; dùng để mã hoá dữ liệu", "Lưu ảnh", "Quản lý permission"
      ], correct: 1, explanation: "Bạn lưu bản mã, còn khoá ở trong TEE/StrongBox." },
    { q: "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly nghĩa là gì?", options: [
        "Đọc được mọi lúc, đồng bộ iCloud",
        "Đọc được sau lần mở khoá đầu tiên kể từ khởi động, không chuyển sang máy khác qua backup",
        "Chỉ đọc khi màn hình sáng", "Xoá khi gỡ app"
      ], correct: 1, explanation: "Phù hợp token cần dùng khi chạy nền." },
    { q: "Room có cho truy vấn trên main thread mặc định không?", options: [
        "Có", "Không, ném IllegalStateException trừ khi allowMainThreadQueries()", "Chỉ với SELECT", "Chỉ trên emulator"
      ], correct: 1, explanation: "Bảo vệ khỏi ANR." },
    { q: "Android Auto Backup có thể mang file DB chứa token sang máy mới. Làm gì?", options: [
        "Không làm gì", "Cấu hình dataExtractionRules / fullBackupContent để loại trừ file nhạy cảm", "Tắt Internet", "Đổi tên file"
      ], correct: 1, explanation: "Token gắn với thiết bị không nên được khôi phục sang máy khác." },
    { q: "@Query trong SwiftData dùng trong View có tác dụng gì?", options: [
        "Gọi API", "Truy vấn dữ liệu và tự cập nhật view khi dữ liệu thay đổi", "Tạo bảng", "Chạy migration"
      ], correct: 1, explanation: "Tương tự Room trả Flow." }
  ]
});
