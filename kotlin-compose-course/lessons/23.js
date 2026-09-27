window.LESSONS.push({
  id: "23",
  phase: "5", phaseName: "Dữ liệu & hạ tầng",
  title: "Lưu trữ cục bộ: Room & DataStore",
  subtitle: "SQLite có kiểm tra lúc compile · DAO trả Flow · @Transaction · migration · DataStore thay SharedPreferences",

  theory: `
    <p>Trên máy user có sẵn <strong>SQLite</strong>. <strong>Room</strong> là lớp trên SQLite — gần giống Spring Data JPA nhưng <em>không có ORM ma thuật</em>: bạn viết SQL thật trong
    <code>@Query</code>, và Room (qua KSP) <strong>kiểm tra SQL lúc compile</strong> với schema — sai tên cột là lỗi build, không phải lỗi runtime.</p>

    <table>
      <tr><th>Room</th><th>Vai trò</th><th>Spring tương đương</th></tr>
      <tr><td><code>@Entity</code></td><td>Một bảng</td><td><code>@Entity</code> JPA</td></tr>
      <tr><td><code>@Dao</code> interface</td><td>Hàm truy vấn: <code>@Query</code>, <code>@Insert</code>, <code>@Upsert</code>, <code>@Delete</code></td><td>Repository interface + <code>@Query</code> native</td></tr>
      <tr><td><code>@Database(entities, version)</code></td><td>Điểm vào, liệt kê bảng & phiên bản schema</td><td>DataSource + Flyway version</td></tr>
      <tr><td><code>Migration(1, 2)</code> / <code>autoMigrations</code></td><td>Nâng schema khi app cập nhật</td><td>Flyway/Liquibase</td></tr>
    </table>

    <ul>
      <li><strong>Luồng</strong>: hàm DAO <code>suspend</code> → main-safe. Hàm trả <code>Flow&lt;T&gt;</code> → <em>quan sát</em>: Room theo dõi bảng được đọc, bảng đổi thì chạy lại query và phát giá trị mới —
        nền của offline-first (bài 21). Gọi hàm DAO blocking trên main thread → Room ném <code>IllegalStateException</code>.</li>
      <li><strong>Transaction</strong>: <code>@Transaction</code> trên hàm DAO hoặc <code>db.withTransaction { }</code> — như <code>@Transactional</code>.</li>
      <li><strong>Không có lazy loading/quan hệ tự động</strong> như JPA: quan hệ dùng <code>@Relation</code> + <code>@Embedded</code> vào class kết quả, hoặc tự JOIN.</li>
      <li><strong>Migration</strong>: tăng <code>version</code> mà không cung cấp migration → crash khi mở DB trên máy user đã có bản cũ (trừ khi bật
        <code>fallbackToDestructiveMigration</code> — xoá sạch dữ liệu). Bật <code>exportSchema</code> để lưu JSON schema vào git và test migration.</li>
    </ul>

    <p><strong>DataStore</strong> thay cho <code>SharedPreferences</code> cho cài đặt nhỏ (theme, ngôn ngữ, onboarding đã xem, token...). SharedPreferences đọc file lần đầu có thể chặn main thread,
    <code>commit()</code> ghi đồng bộ, và không báo lỗi I/O. DataStore: API hoàn toàn bất đồng bộ (<code>Flow</code> để đọc, <code>suspend edit { }</code> để ghi), ghi theo transaction.</p>
    <ul>
      <li><strong>Preferences DataStore</strong>: key-value không schema (<code>stringPreferencesKey("theme")</code>).</li>
      <li><strong>Proto DataStore</strong> (hoặc với serializer tuỳ chỉnh): object có kiểu.</li>
      <li>Chỉ tạo <strong>một instance</strong> cho mỗi file (dùng delegate top-level <code>preferencesDataStore</code>) — hai instance cùng file sẽ lỗi.</li>
    </ul>

    <div class="callout"><p>💡 Chọn nhanh: dữ liệu có cấu trúc, nhiều bản ghi, cần truy vấn/sort → Room. Vài giá trị cài đặt → DataStore. File lớn (ảnh) → thư mục <code>filesDir</code>/<code>cacheDir</code>.
    Bí mật (token) → mã hoá bằng khoá trong <strong>Android Keystore</strong> trước khi lưu. Room đã hỗ trợ Kotlin Multiplatform (từ 2.7) nếu cần chia sẻ tầng data với iOS.</p></div>
  `,

  codeTabs: [
    { id: "entity", label: "① Entity & DAO", lines: [
      "@Entity(tableName = \"cart_items\")",
      "data class CartItemEntity(",
      "    @PrimaryKey val productId: Long,",
      "    val name: String,",
      "    val priceCents: Long,",
      "    val qty: Int,",
      "    @ColumnInfo(name = \"added_at\") val addedAt: Long",
      ")",
      "",
      "@Dao",
      "interface CartDao {",
      "    @Query(\"SELECT * FROM cart_items ORDER BY added_at DESC\")",
      "    fun observeAll(): Flow<List<CartItemEntity>>        // phát lại khi bảng đổi",
      "",
      "    @Query(\"SELECT SUM(priceCents * qty) FROM cart_items\")",
      "    fun observeTotal(): Flow<Long?>",
      "",
      "    @Upsert suspend fun upsert(item: CartItemEntity)",
      "    @Query(\"DELETE FROM cart_items WHERE productId = :id\") suspend fun remove(id: Long)",
      "}"
    ]},
    { id: "db", label: "② Database & migration", lines: [
      "@Database(entities = [CartItemEntity::class, ProductEntity::class], version = 2, exportSchema = true)",
      "abstract class ShopDb : RoomDatabase() {",
      "    abstract fun cartDao(): CartDao",
      "    abstract fun productDao(): ProductDao",
      "}",
      "",
      "val MIGRATION_1_2 = object : Migration(1, 2) {",
      "    override fun migrate(db: SupportSQLiteDatabase) {",
      "        db.execSQL(\"ALTER TABLE cart_items ADD COLUMN added_at INTEGER NOT NULL DEFAULT 0\")",
      "    }",
      "}",
      "",
      "val db = Room.databaseBuilder(context, ShopDb::class.java, \"shop.db\")",
      "    .addMigrations(MIGRATION_1_2)",
      "    .build()                      // tạo một lần (singleton qua DI)"
    ]},
    { id: "tx", label: "③ Transaction", lines: [
      "@Dao",
      "interface ProductDao {",
      "    @Query(\"DELETE FROM products WHERE catId = :catId\") suspend fun deleteCategory(catId: Long)",
      "    @Upsert suspend fun upsertAll(items: List<ProductEntity>)",
      "",
      "    @Transaction                  // cả hai lệnh thành công hoặc không lệnh nào",
      "    suspend fun replaceCategory(catId: Long, items: List<ProductEntity>) {",
      "        deleteCategory(catId)",
      "        upsertAll(items)",
      "    }                             // Flow quan sát chỉ phát MỘT lần sau commit",
      "}"
    ]},
    { id: "ds", label: "④ DataStore", lines: [
      "val Context.settings: DataStore<Preferences> by preferencesDataStore(name = \"settings\")",
      "",
      "object Keys {",
      "    val DARK = booleanPreferencesKey(\"dark_mode\")",
      "    val LANG = stringPreferencesKey(\"lang\")",
      "}",
      "",
      "class SettingsRepository @Inject constructor(@ApplicationContext private val ctx: Context) {",
      "    val dark: Flow<Boolean> = ctx.settings.data.map { it[Keys.DARK] ?: false }",
      "",
      "    suspend fun setDark(on: Boolean) {",
      "        ctx.settings.edit { prefs -> prefs[Keys.DARK] = on }   // ghi nguyên tử, không chặn main",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vm"><div class="nl">🧠 CartViewModel</div><div class="ns">collect dao.observeAll()</div></div>
    <div class="arrow" id="a1">↓ upsert(item) — suspend, main-safe</div>
    <div class="node" id="room"><div class="nl">🗃️ Room (SQL kiểm tra lúc compile)</div><div class="ns">theo dõi bảng cart_items bị ghi</div></div>
    <div class="arrow" id="a2">↓ SQLite trên máy</div>
    <div class="node" id="sqlite"><div class="nl">💾 shop.db (version 2)</div><div class="ns">migration 1→2 đã chạy</div></div>
    <div class="arrow" id="a3">↑ bảng đổi → query chạy lại → Flow phát list mới</div>
    <div class="node" id="ds"><div class="nl">⚙️ DataStore settings</div><div class="ns">dark_mode, lang — Flow + edit { }</div></div>
  `,
  steps: [
    { title: "1 · Entity & SQL thật", tab: "entity", highlight: [1, 3, 12, 13], on: ["room"],
      desc: "@Query là SQL thật, được kiểm tra với schema lúc build. Sai tên cột → lỗi compile." },
    { title: "2 · Ghi bằng suspend", tab: "entity", highlight: [18, 19], on: ["vm", "a1"],
      desc: "@Upsert chèn hoặc cập nhật theo khoá chính. suspend nên gọi từ viewModelScope được." },
    { title: "3 · Flow phát lại khi bảng đổi", tab: "entity", highlight: [13, 16], on: ["a3", "vm"],
      desc: "Room biết query đọc bảng nào; ghi vào bảng đó → chạy lại query → UI tự cập nhật tổng tiền." },
    { title: "4 · Version & migration", tab: "db", highlight: [1, 7, 9, 14], on: ["sqlite", "a2"],
      desc: "Tăng version phải có migration; không thì app cập nhật sẽ crash khi mở DB (hoặc mất dữ liệu nếu dùng destructive)." },
    { title: "5 · Transaction", tab: "tx", highlight: [6, 7, 8, 9, 10], on: ["room"],
      desc: "Xoá rồi chèn trong một transaction: không có khoảnh khắc danh mục rỗng hiện lên UI." },
    { title: "6 · DataStore cho cài đặt", tab: "ds", highlight: [1, 4, 9, 12], on: ["ds"],
      desc: "Một instance mỗi file qua delegate top-level; đọc bằng Flow, ghi bằng edit { } suspend." }
  ],

  quiz: [
    { q: "Room phát hiện sai tên cột trong @Query khi nào?", options: [
        "Lúc runtime khi chạy query", "Lúc compile (KSP kiểm tra SQL với schema)", "Không phát hiện", "Khi migration"
      ], correct: 1, explanation: "Lợi thế lớn so với chuỗi SQL thô." },
    { q: "Hàm DAO trả Flow<List<T>> hoạt động thế nào?", options: [
        "Chạy query một lần", "Phát kết quả, rồi phát lại mỗi khi bảng liên quan thay đổi", "Chỉ chạy khi gọi refresh", "Cache vĩnh viễn"
      ], correct: 1, explanation: "Nền của offline-first." },
    { q: "Tăng version của @Database mà không thêm Migration, user cập nhật app thì?", options: [
        "Tự migrate", "Crash khi mở DB (IllegalStateException về migration thiếu)", "Dữ liệu giữ nguyên", "Room bỏ qua"
      ], correct: 1, explanation: "Trừ khi dùng fallbackToDestructiveMigration (xoá dữ liệu)." },
    { q: "Gọi hàm DAO không-suspend (blocking) trên main thread thì?", options: [
        "Chạy bình thường", "Room ném IllegalStateException: không truy cập DB trên main thread", "Tự chuyển IO", "Trả null"
      ], correct: 1, explanation: "Trừ khi bật allowMainThreadQueries (chỉ nên cho test)." },
    { q: "@Upsert làm gì?", options: [
        "Chỉ insert", "Insert, hoặc update nếu khoá chính đã tồn tại", "Xoá rồi insert", "Chỉ update"
      ], correct: 1, explanation: "Có từ Room 2.5." },
    { q: "Room khác JPA ở điểm nào?", options: [
        "Room có lazy loading", "Room không có ORM tự động quản lý quan hệ/lazy loading; bạn viết SQL và @Relation rõ ràng", "Room chỉ dùng NoSQL", "Không khác"
      ], correct: 1, explanation: "Đơn giản và dễ đoán hơn." },
    { q: "Vì sao DataStore được khuyến nghị thay SharedPreferences?", options: [
        "Lưu được ảnh",
        "API bất đồng bộ (Flow/suspend), không chặn main thread, ghi nguyên tử, báo lỗi I/O",
        "Nhanh hơn Room",
        "Mã hoá sẵn"
      ], correct: 1, explanation: "SharedPreferences có thể chặn main khi đọc/commit." },
    { q: "Tạo hai instance DataStore cho cùng file thì?", options: [
        "Tăng tốc", "Lỗi — chỉ được một instance đang hoạt động mỗi file", "Dữ liệu nhân đôi", "Không sao"
      ], correct: 1, explanation: "Dùng delegate top-level preferencesDataStore." },
    { q: "Token đăng nhập nên lưu thế nào?", options: [
        "Plain text trong DataStore", "Mã hoá bằng khoá trong Android Keystore trước khi lưu", "Trong Room không mã hoá", "Trong biến static"
      ], correct: 1, explanation: "Máy root/backup có thể đọc file thường." },
    { q: "@Transaction trên hàm replaceCategory giúp gì cho UI quan sát Flow?", options: [
        "Không liên quan", "Hai lệnh commit cùng lúc nên UI không thấy trạng thái trung gian (danh mục rỗng)", "Tăng tốc mạng", "Chặn main"
      ], correct: 1, explanation: "Và đảm bảo tất cả hoặc không gì." }
  ]
});
