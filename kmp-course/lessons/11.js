window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Thư viện đa nền tảng",
  title: "Lưu trữ cục bộ: SQLDelight vs Room KMP",
  subtitle: "SQL-first sinh Kotlin · annotation-first như JPA · driver theo nền tảng · Flow từ truy vấn",

  theory: `
    <p>Cả hai đều dùng <strong>SQLite</strong> trên thiết bị và sinh code lúc biên dịch. Khác nhau ở triết lý:</p>

    <p><strong>SQLDelight</strong> (Cash App) — <em>SQL trước</em></p>
    <ul>
      <li>Bạn viết file <code>.sq</code> chứa <code>CREATE TABLE</code> và các truy vấn có nhãn (<code>selectAll:</code>). Plugin Gradle kiểm tra SQL lúc build và sinh class Kotlin type-safe (<code>OrderQueries.selectAll()</code>).</li>
      <li>Driver theo nền tảng: <code>AndroidSqliteDriver</code>, <code>NativeSqliteDriver</code> (iOS). Tạo bằng expect/actual hoặc DI.</li>
      <li><code>.asFlow().mapToList(dispatcher)</code> (module <code>coroutines-extensions</code>) → Flow tự phát lại khi bảng thay đổi.</li>
      <li>Migration bằng file <code>1.sqm</code>, <code>2.sqm</code>... chứa câu lệnh SQL thay đổi schema.</li>
    </ul>

    <p><strong>Room KMP</strong> (Google, hỗ trợ KMP stable từ Room 2.7) — <em>annotation trước</em></p>
    <ul>
      <li><code>@Entity</code>, <code>@Dao</code>, <code>@Query</code>, <code>@Database</code> như Room trên Android; code được sinh bằng <strong>KSP</strong> cho từng target (<code>kspAndroid</code>, <code>kspIosArm64</code>, <code>kspIosSimulatorArm64</code>).</li>
      <li>Trong KMP, <code>@Database</code> cần <code>@ConstructedBy(AppDatabaseConstructor::class)</code> cùng một <code>expect object AppDatabaseConstructor</code> — Room compiler tự sinh <code>actual</code>.</li>
      <li>Driver: <code>BundledSQLiteDriver</code> (SQLite đóng gói kèm, hành vi giống nhau mọi nền tảng — khuyến nghị) hoặc driver hệ thống.</li>
      <li>Trên target không phải Android, DAO phải là <code>suspend</code> hoặc trả về <code>Flow</code> (DAO chặn thread chỉ còn ở Android).</li>
    </ul>

    <table>
      <tr><th></th><th>SQLDelight</th><th>Room KMP</th></tr>
      <tr><td>Nguồn sự thật</td><td>File .sq (SQL)</td><td>Class Kotlin + annotation</td></tr>
      <tr><td>Giống bên Java</td><td>jOOQ / MyBatis (SQL tường minh)</td><td>JPA/Spring Data (entity + repository)</td></tr>
      <tr><td>Sinh code</td><td>Plugin Gradle</td><td>KSP theo từng target</td></tr>
      <tr><td>Migration</td><td>File .sqm</td><td><code>@AutoMigration</code> hoặc Migration thủ công, schema JSON</td></tr>
      <tr><td>Hợp với</td><td>Đội thích kiểm soát SQL, đã quen SQL</td><td>Đội Android đã dùng Room, muốn chuyển sang KMP ít sửa</td></tr>
    </table>

    <div class="callout"><p>💡 Đây là cache/nguồn offline trên thiết bị, không phải DB của service. Dữ liệu chuẩn vẫn nằm ở PostgreSQL/MongoDB phía backend.
    Mẫu phổ biến: <strong>UI đọc từ DB cục bộ (Flow)</strong>, mạng chỉ làm nhiệm vụ cập nhật DB — "single source of truth" (bài 13).</p></div>
  `,

  codeTabs: [
    { id: "sq", label: "SQLDelight .sq", lines: [
      "-- shared/src/commonMain/sqldelight/com/shop/db/Order.sq",
      "CREATE TABLE OrderEntity (",
      "  id TEXT NOT NULL PRIMARY KEY,",
      "  total INTEGER NOT NULL,",
      "  created_at TEXT NOT NULL",
      ");",
      "",
      "selectAll:",
      "SELECT * FROM OrderEntity ORDER BY created_at DESC;",
      "",
      "upsert:",
      "INSERT OR REPLACE INTO OrderEntity(id, total, created_at) VALUES (?, ?, ?);",
      "",
      "deleteAll:",
      "DELETE FROM OrderEntity;"
    ]},
    { id: "sqk", label: "SQLDelight dùng", lines: [
      "// build.gradle.kts",
      "// plugins { id(\"app.cash.sqldelight\") }",
      "// sqldelight { databases { create(\"AppDatabase\") { packageName.set(\"com.shop.db\") } } }",
      "",
      "// androidMain: AndroidSqliteDriver(AppDatabase.Schema, context, \"shop.db\")",
      "// iosMain:     NativeSqliteDriver(AppDatabase.Schema, \"shop.db\")",
      "",
      "class OrderDao(db: AppDatabase, private val io: CoroutineDispatcher) {",
      "    private val q = db.orderQueries",
      "    fun observeAll(): Flow<List<OrderEntity>> = q.selectAll().asFlow().mapToList(io)",
      "    suspend fun replaceAll(list: List<OrderDto>) = withContext(io) {",
      "        q.transaction {",
      "            q.deleteAll()",
      "            list.forEach { q.upsert(it.id, it.total, it.createdAt) }",
      "        }",
      "    }",
      "}"
    ]},
    { id: "room", label: "Room KMP", lines: [
      "@Entity(tableName = \"orders\")",
      "data class OrderEntity(@PrimaryKey val id: String, val total: Long, val createdAt: String)",
      "",
      "@Dao",
      "interface OrderDao {",
      "    @Query(\"SELECT * FROM orders ORDER BY createdAt DESC\")",
      "    fun observeAll(): Flow<List<OrderEntity>>",
      "    @Upsert suspend fun upsertAll(items: List<OrderEntity>)",
      "}",
      "",
      "@Database(entities = [OrderEntity::class], version = 1)",
      "@ConstructedBy(AppDatabaseConstructor::class)",
      "abstract class AppDatabase : RoomDatabase() { abstract fun orderDao(): OrderDao }",
      "",
      "@Suppress(\"KotlinNoActualForExpect\")",
      "expect object AppDatabaseConstructor : RoomDatabaseConstructor<AppDatabase> {",
      "    override fun initialize(): AppDatabase",
      "}"
    ]},
    { id: "roomb", label: "Room: build & driver", lines: [
      "// build.gradle.kts",
      "plugins { id(\"com.google.devtools.ksp\"); id(\"androidx.room\") }",
      "room { schemaDirectory(\"$projectDir/schemas\") }",
      "dependencies {",
      "    add(\"kspAndroid\", libs.androidx.room.compiler)",
      "    add(\"kspIosArm64\", libs.androidx.room.compiler)",
      "    add(\"kspIosSimulatorArm64\", libs.androidx.room.compiler)",
      "}",
      "",
      "// commonMain",
      "fun buildDb(b: RoomDatabase.Builder<AppDatabase>) = b",
      "    .setDriver(BundledSQLiteDriver())",
      "    .setQueryCoroutineContext(Dispatchers.IO)",
      "    .build()",
      "// iosMain: Room.databaseBuilder<AppDatabase>(name = documentsDir() + \"/shop.db\")"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="s1"><div class="nl">📝 Order.sq</div><div class="ns">SQL là nguồn sự thật</div></div>
      <div class="node" id="r1"><div class="nl">🏷️ @Entity/@Dao</div><div class="ns">annotation là nguồn sự thật</div></div>
    </div>
    <div class="row">
      <div class="arrow" id="s2">↓ plugin SQLDelight</div>
      <div class="arrow" id="r2">↓ KSP mỗi target</div>
    </div>
    <div class="node" id="gen"><div class="nl">⚙️ Code Kotlin type-safe</div><div class="ns">sinh lúc build</div></div>
    <div class="row">
      <div class="node" id="da"><div class="nl">🤖 Driver Android</div></div>
      <div class="node" id="di"><div class="nl">🍎 Driver Native / Bundled</div></div>
    </div>
    <div class="node" id="flow"><div class="nl">🔁 Flow&lt;List&lt;OrderEntity&gt;&gt;</div><div class="ns">tự phát khi bảng đổi</div></div>
  `,
  steps: [
    { title: "1 · SQLDelight: viết SQL", tab: "sq", highlight: [2, 8, 9, 11, 12], on: ["s1"],
      desc: "Mỗi truy vấn có nhãn. Sai tên cột là lỗi build, không phải lỗi runtime." },
    { title: "2 · SQLDelight: dùng code sinh ra", tab: "sqk", highlight: [3, 5, 6, 10, 12], on: ["s2", "gen", "da", "di", "flow"],
      desc: "Driver theo nền tảng. asFlow().mapToList biến truy vấn thành Flow; transaction gom nhiều lệnh." },
    { title: "3 · Room: annotation", tab: "room", highlight: [1, 4, 7, 8, 11, 12], on: ["r1"],
      desc: "Quen thuộc với dev Android. DAO trả Flow hoặc suspend — bắt buộc khi có target iOS." },
    { title: "4 · Room: expect object", tab: "room", highlight: [12, 15, 16, 17], on: ["gen"],
      desc: "Room compiler sinh actual cho AppDatabaseConstructor trên mỗi nền tảng — thay cho reflection mà Room Android từng dùng." },
    { title: "5 · Room: KSP và driver", tab: "roomb", highlight: [2, 5, 6, 7, 12, 13], on: ["r2", "di", "flow"],
      desc: "KSP phải khai báo cho từng target. BundledSQLiteDriver đảm bảo cùng phiên bản SQLite ở mọi nơi." }
  ],

  quiz: [
    { q: "Trong SQLDelight, nguồn sự thật của schema là?", options: [
        "Class Kotlin có annotation", "File .sq chứa SQL", "File JSON", "Code Swift"
      ], correct: 1, explanation: "Plugin sinh Kotlin từ SQL." },
    { q: "Room KMP sinh code bằng gì?", options: [
        "Reflection lúc chạy", "KSP, khai báo cho từng target (kspAndroid, kspIosArm64...)", "kapt", "Gradle groovy script"
      ], correct: 1, explanation: "kapt chỉ chạy trên JVM." },
    { q: "Vì sao @Database trong Room KMP cần @ConstructedBy + expect object?", options: [
        "Để đặt tên DB",
        "Vì không có reflection trên Native; Room compiler sinh actual để khởi tạo database",
        "Để bật migration",
        "Để dùng Swift"
      ], correct: 1, explanation: "Room Android cũ tìm class _Impl bằng reflection." },
    { q: "Trên target iOS, DAO Room phải có dạng nào?", options: [
        "Hàm chặn thread bình thường", "suspend hoặc trả về Flow", "Callback", "RxJava"
      ], correct: 1, explanation: "DAO chặn chỉ còn hỗ trợ trên Android." },
    { q: "BundledSQLiteDriver có ưu điểm gì?", options: [
        "Không cần SQLite",
        "Đóng gói SQLite biên dịch từ source, hành vi và phiên bản giống nhau trên mọi nền tảng",
        "Chỉ chạy trên Android",
        "Mã hoá dữ liệu mặc định"
      ], correct: 1, explanation: "Driver hệ thống phụ thuộc phiên bản SQLite của OS." },
    { q: "SQLDelight biến truy vấn thành Flow bằng cách nào?", options: [
        "query.collect()", "query.asFlow().mapToList(dispatcher) (coroutines-extensions)", "query.toFlow()", "Không hỗ trợ"
      ], correct: 1, explanation: "Flow phát lại khi bảng liên quan thay đổi." },
    { q: "So với thế giới Java, SQLDelight gần với gì nhất?", options: [
        "Hibernate", "jOOQ/MyBatis — SQL tường minh, type-safe", "Spring Data REST", "Liquibase"
      ], correct: 1, explanation: "Room gần JPA/Spring Data hơn." },
    { q: "Migration trong SQLDelight viết ở đâu?", options: [
        "File .sqm đánh số (1.sqm, 2.sqm...)", "Annotation @Migration", "Trong Swift", "Không hỗ trợ"
      ], correct: 0, explanation: "Mỗi file chứa lệnh SQL chuyển từ phiên bản N lên N+1." },
    { q: "DB SQLite trên app đóng vai trò gì trong hệ thống công ty?", options: [
        "Thay thế PostgreSQL",
        "Cache/nguồn offline cục bộ; dữ liệu chuẩn vẫn ở DB của backend",
        "Nơi lưu log Kafka",
        "Không nên dùng"
      ], correct: 1, explanation: "UI đọc DB cục bộ, mạng cập nhật DB." }
  ]
});
