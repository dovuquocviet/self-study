window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Thư viện đa nền tảng",
  title: "DataStore cho cài đặt & Koin cho DI",
  subtitle: "Preferences theo đường dẫn file · một instance mỗi file · module Koin chung + module nền tảng · lấy object từ Swift",

  theory: `
    <p><strong>DataStore (androidx) trên KMP</strong></p>
    <ul>
      <li>Thay SharedPreferences/UserDefaults cho <em>cài đặt nhỏ</em>: đã onboarding chưa, ngôn ngữ, theme, id cửa hàng gần nhất.</li>
      <li>API bất đồng bộ: đọc qua <code>data: Flow&lt;Preferences&gt;</code>, ghi qua <code>suspend edit { }</code> — ghi an toàn, không chặn main thread.</li>
      <li>KMP tạo bằng <code>PreferenceDataStoreFactory.createWithPath(produceFile = { path.toPath() })</code> (okio Path). Tên file phải kết thúc <code>.preferences_pb</code>.
        Chỉ đường dẫn là khác nhau: Android dùng <code>context.filesDir</code>, iOS dùng thư mục Documents qua <code>NSFileManager</code>.</li>
      <li><strong>Chỉ được có một instance cho mỗi file</strong> trong process → tạo một lần (singleton trong DI).</li>
      <li>Không mã hoá. Token/bí mật để ở Keychain (iOS) / Keystore (Android) qua interface (bài 05).</li>
    </ul>

    <p><strong>Koin — DI thuần Kotlin, chạy được trên mọi target</strong></p>
    <ul>
      <li>Khai báo bằng DSL: <code>single { }</code> (singleton), <code>factory { }</code> (mỗi lần một instance mới), <code>viewModelOf(::X)</code>. <code>singleOf(::Repo)</code> tự truyền tham số constructor bằng <code>get()</code>.</li>
      <li>Thường có <strong>module chung</strong> (<code>sharedModule</code>) trong commonMain và <strong>module nền tảng</strong> (<code>expect val platformModule: Module</code>) cung cấp driver DB, DataStore, engine, cài đặt Keychain.</li>
      <li>Android: <code>startKoin { androidContext(app); modules(...) }</code> trong <code>Application.onCreate</code>. iOS: gọi hàm Kotlin <code>initKoin()</code> — Swift thấy là <code>doInitKoin()</code> — trong <code>init</code> của <code>App</code>.</li>
      <li>Swift lấy object qua một hàm/helper Kotlin (<code>KoinComponent</code> + <code>inject()</code>, hoặc <code>KoinPlatform.getKoin().get()</code>) vì hàm generic reified không gọi được từ Swift.</li>
    </ul>

    <table>
      <tr><th>Spring</th><th>Koin</th></tr>
      <tr><td><code>@Configuration</code> + <code>@Bean</code></td><td><code>module { single { ... } }</code></td></tr>
      <tr><td>Scope singleton / prototype</td><td><code>single</code> / <code>factory</code></td></tr>
      <tr><td>Quét classpath, kiểm tra lúc khởi động</td><td>Không quét; resolve khi <code>get()</code> — thiếu định nghĩa là lỗi <em>lúc chạy</em></td></tr>
      <tr><td><code>@Profile</code></td><td>Module nền tảng khác nhau cho Android/iOS</td></tr>
    </table>

    <div class="callout"><p>💡 Koin phát hiện thiếu định nghĩa lúc chạy, không lúc build như Dagger/Hilt. Bù lại bằng một test gọi <code>verify()</code> (trên JVM) hoặc test khởi động Koin thật trong CI.
    Muốn kiểm tra lúc biên dịch có thể xem Koin Annotations hoặc tự nối tay bằng constructor — với module shared nhỏ, DI thủ công cũng hoàn toàn ổn.</p></div>
  `,

  codeTabs: [
    { id: "ds", label: "DataStore", lines: [
      "// commonMain",
      "const val PREFS_FILE = \"shop.preferences_pb\"",
      "",
      "fun createDataStore(producePath: () -> String): DataStore<Preferences> =",
      "    PreferenceDataStoreFactory.createWithPath(produceFile = { producePath().toPath() })",
      "",
      "class SettingsRepository(private val ds: DataStore<Preferences>) {",
      "    private val ONBOARDED = booleanPreferencesKey(\"onboarded\")",
      "    val onboarded: Flow<Boolean> = ds.data.map { it[ONBOARDED] ?: false }",
      "    suspend fun setOnboarded() { ds.edit { it[ONBOARDED] = true } }",
      "}"
    ]},
    { id: "path", label: "Đường dẫn theo nền tảng", lines: [
      "// androidMain",
      "fun androidDataStore(ctx: Context) =",
      "    createDataStore { ctx.filesDir.resolve(PREFS_FILE).absolutePath }",
      "",
      "// iosMain",
      "@OptIn(ExperimentalForeignApi::class)",
      "fun iosDataStore() = createDataStore {",
      "    val dir = NSFileManager.defaultManager.URLForDirectory(",
      "        directory = NSDocumentDirectory, inDomain = NSUserDomainMask,",
      "        appropriateForURL = null, create = false, error = null)",
      "    requireNotNull(dir).path + \"/\" + PREFS_FILE",
      "}"
    ]},
    { id: "koin", label: "Module Koin", lines: [
      "// commonMain",
      "val sharedModule = module {",
      "    single { createHttpClient(get()) }",
      "    singleOf(::OrderApi)",
      "    singleOf(::OrderRepository)",
      "    singleOf(::SettingsRepository)",
      "    factoryOf(::GetOrdersUseCase)",
      "    viewModelOf(::OrdersViewModel)",
      "}",
      "expect val platformModule: Module",
      "",
      "fun initKoin(extra: KoinAppDeclaration = {}) = startKoin {",
      "    extra()",
      "    modules(sharedModule, platformModule)",
      "}",
      "",
      "// iosMain",
      "actual val platformModule = module {",
      "    single { iosDataStore() }",
      "    single<SecureStorage> { KeychainStorage() }",
      "}"
    ]},
    { id: "start", label: "Khởi động 2 app", lines: [
      "// Android: Application",
      "class ShopApp : Application() {",
      "    override fun onCreate() {",
      "        super.onCreate()",
      "        initKoin { androidContext(this@ShopApp) }",
      "    }",
      "}",
      "",
      "// iosMain — helper cho Swift",
      "object Deps : KoinComponent {",
      "    fun ordersViewModel(): OrdersViewModel = get()",
      "}",
      "",
      "// Swift",
      "// @main struct ShopApp: App { init() { KoinKt.doInitKoin() } ... }",
      "// let vm = Deps.shared.ordersViewModel()"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="sm"><div class="nl">📦 sharedModule</div><div class="ns">HttpClient, Api, Repo, UseCase, VM</div></div>
      <div class="node" id="pm"><div class="nl">🧩 platformModule</div><div class="ns">DataStore, driver DB, Keychain</div></div>
    </div>
    <div class="arrow" id="a1">↓ startKoin { modules(...) }</div>
    <div class="row">
      <div class="node" id="and"><div class="nl">🤖 Application.onCreate</div><div class="ns">androidContext</div></div>
      <div class="node" id="ios"><div class="nl">🍎 App.init()</div><div class="ns">KoinKt.doInitKoin()</div></div>
    </div>
    <div class="node" id="ds"><div class="nl">💾 DataStore (1 instance / file)</div><div class="ns">data: Flow · edit { }</div></div>
  `,
  steps: [
    { title: "1 · DataStore một lần viết", tab: "ds", highlight: [2, 4, 5, 8, 9, 10], on: ["ds"],
      desc: "Đọc là Flow, ghi là suspend. Tên file phải có đuôi .preferences_pb." },
    { title: "2 · Chỉ đường dẫn khác nhau", tab: "path", highlight: [3, 8, 9, 11], on: ["pm"],
      desc: "Android dùng filesDir, iOS dùng thư mục Documents. Phần còn lại dùng chung." },
    { title: "3 · Module chung", tab: "koin", highlight: [2, 3, 4, 5, 7, 8], on: ["sm"],
      desc: "singleOf/factoryOf tự lấy tham số constructor từ Koin. UseCase là factory vì không giữ trạng thái." },
    { title: "4 · Module nền tảng", tab: "koin", highlight: [10, 14, 18, 19, 20], on: ["pm", "a1"],
      desc: "expect val platformModule — mỗi nền tảng cung cấp phần phụ thuộc riêng. DataStore là single vì chỉ được một instance mỗi file." },
    { title: "5 · Khởi động và lấy từ Swift", tab: "start", highlight: [5, 10, 11, 15, 16], on: ["and", "ios"],
      desc: "Android truyền Context. iOS gọi doInitKoin() (tên init bị đổi), rồi lấy ViewModel qua helper Deps vì Swift không gọi được hàm reified <code>get&lt;T&gt;()</code>." }
  ],

  quiz: [
    { q: "DataStore đọc dữ liệu qua gì?", options: [
        "Hàm getBoolean() đồng bộ", "data: Flow<Preferences>", "Callback", "LiveData"
      ], correct: 1, explanation: "Ghi qua suspend edit { }." },
    { q: "Tên file DataStore Preferences phải kết thúc bằng?", options: [
        ".json", ".preferences_pb", ".db", ".plist"
      ], correct: 1, explanation: "Yêu cầu của PreferenceDataStoreFactory." },
    { q: "Có nên tạo hai instance DataStore cùng trỏ một file không?", options: [
        "Có, để đọc nhanh hơn", "Không — chỉ được một instance mỗi file trong process", "Tuỳ nền tảng", "Chỉ trên iOS"
      ], correct: 1, explanation: "Hai instance sẽ gây lỗi/hỏng dữ liệu; để single trong DI." },
    { q: "Lưu access token ở DataStore có ổn không?", options: [
        "Ổn, đã mã hoá",
        "Không nên — DataStore không mã hoá; dùng Keychain/Keystore",
        "Chỉ ổn trên iOS",
        "Bắt buộc"
      ], correct: 1, explanation: "Bí mật cần kho an toàn của hệ điều hành." },
    { q: "single và factory trong Koin tương đương gì trong Spring?", options: [
        "singleton và prototype scope", "request và session", "@Controller và @Service", "Không có tương đương"
      ], correct: 0, explanation: "factory tạo instance mới mỗi lần get()." },
    { q: "Thiếu định nghĩa một phụ thuộc trong Koin thì lỗi khi nào?", options: [
        "Lúc biên dịch", "Lúc chạy, khi resolve", "Lúc Gradle sync", "Không bao giờ"
      ], correct: 1, explanation: "Nên có test khởi động/verify module trong CI." },
    { q: "Swift gọi hàm Kotlin initKoin() thế nào?", options: [
        "initKoin()", "KoinKt.doInitKoin()", "Koin.start()", "InitKoin.shared"
      ], correct: 1, explanation: "Hàm top-level → class tên file + Kt; tên init → doInit." },
    { q: "Vì sao cần helper (vd object Deps) để Swift lấy ViewModel từ Koin?", options: [
        "Koin không chạy trên iOS",
        "Hàm inline reified get<T>() không gọi được từ Swift; helper Kotlin gọi hộ",
        "Để tăng tốc",
        "Vì Swift không có class"
      ], correct: 1, explanation: "Hàm inline không tồn tại trong binary để Swift gọi." },
    { q: "Driver DB, DataStore, Keychain nên đặt ở module Koin nào?", options: [
        "sharedModule", "platformModule (expect/actual) vì phụ thuộc nền tảng", "Không đưa vào DI", "Module test"
      ], correct: 1, explanation: "Giống @Profile theo nền tảng." }
  ]
});
