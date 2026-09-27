window.LESSONS.push({
  id: "24",
  phase: "5", phaseName: "Dữ liệu & hạ tầng",
  title: "Dependency Injection với Hilt (bản ngắn cho dev Spring)",
  subtitle: "@HiltAndroidApp · @AndroidEntryPoint · @Inject constructor · @Module/@Provides/@Binds · scope · sinh code lúc compile",

  theory: `
    <p>Bạn đã quen Spring DI. <strong>Hilt</strong> (xây trên Dagger) giải quyết cùng bài toán, khác biệt quan trọng nhất: <strong>đồ thị phụ thuộc được kiểm tra và sinh code lúc compile</strong>
    (KSP), không quét classpath và reflection lúc chạy. Thiếu binding → lỗi build, không phải lỗi khi app khởi động trên máy user. Khởi động nhanh — quan trọng trên mobile.</p>

    <table>
      <tr><th>Spring</th><th>Hilt</th></tr>
      <tr><td><code>@SpringBootApplication</code></td><td><code>@HiltAndroidApp class ShopApp : Application()</code></td></tr>
      <tr><td><code>@Component/@Service</code> + constructor injection</td><td><code>class Repo @Inject constructor(...)</code></td></tr>
      <tr><td><code>@Configuration</code> + <code>@Bean</code></td><td><code>@Module @InstallIn(SingletonComponent::class)</code> + <code>@Provides</code></td></tr>
      <tr><td>Bind interface → impl</td><td><code>@Binds abstract fun bind(impl: RepoImpl): Repo</code></td></tr>
      <tr><td><code>@Qualifier</code>/<code>@Named</code></td><td><code>@Qualifier annotation class IoDispatcher</code></td></tr>
      <tr><td>Singleton (mặc định!)</td><td><strong>Không scope mặc định</strong> — mỗi lần inject tạo mới; muốn một instance thì <code>@Singleton</code></td></tr>
      <tr><td>Request/session scope</td><td><code>@ActivityRetainedScoped</code>, <code>@ViewModelScoped</code>, <code>@ActivityScoped</code></td></tr>
    </table>

    <p><strong>Điểm vào</strong>: Android tự tạo Activity/Application, nên Hilt không gọi constructor được. Đánh dấu <code>@AndroidEntryPoint</code> lên Activity để Hilt inject field.
    ViewModel dùng <code>@HiltViewModel</code> + <code>@Inject constructor</code>, lấy trong Compose bằng <code>hiltViewModel()</code>; <code>SavedStateHandle</code> được cung cấp sẵn.</p>

    <p><strong>Component & vòng đời</strong>: <code>SingletonComponent</code> (sống cùng Application) → <code>ActivityRetainedComponent</code> (qua xoay màn hình) → <code>ViewModelComponent</code>
    → <code>ActivityComponent</code>... Binding cài ở component nào sống theo vòng đời component đó. OkHttpClient, Retrofit, Room DB nên <code>@Singleton</code> — tạo nhiều lần rất tốn
    (OkHttp mỗi instance có connection pool và thread pool riêng).</p>

    <div class="callout"><p>💡 Bẫy cho dev Spring: quên <code>@Singleton</code> trên <code>@Provides fun provideDb()</code> → mỗi repository có một RoomDatabase riêng, Flow của bên này không thấy ghi của bên kia.
    Nếu dự án đi KMP, Hilt chỉ chạy trên Android; phần shared thường dùng <strong>Koin</strong> (DI runtime, đơn giản hơn) hoặc truyền tay.</p></div>
  `,

  codeTabs: [
    { id: "app", label: "① Điểm vào", lines: [
      "@HiltAndroidApp",
      "class ShopApp : Application()",
      "",
      "@AndroidEntryPoint",
      "class MainActivity : ComponentActivity() {",
      "    override fun onCreate(savedInstanceState: Bundle?) {",
      "        super.onCreate(savedInstanceState)",
      "        setContent { ShopTheme { ShopNavHost() } }",
      "    }",
      "}",
      "",
      "// build.gradle.kts: plugin com.google.dagger.hilt.android + com.google.devtools.ksp",
      "// ksp(libs.hilt.compiler); implementation(libs.hilt.navigation.compose)"
    ]},
    { id: "module", label: "② Module", lines: [
      "@Module",
      "@InstallIn(SingletonComponent::class)",
      "object NetworkModule {",
      "    @Provides @Singleton",
      "    fun okHttp(tokens: TokenStore): OkHttpClient = OkHttpClient.Builder()",
      "        .addInterceptor(AuthInterceptor(tokens)).build()",
      "",
      "    @Provides @Singleton",
      "    fun api(client: OkHttpClient, json: Json): ShopApi = Retrofit.Builder()",
      "        .baseUrl(\"https://api.shop.vn/\").client(client)",
      "        .addConverterFactory(json.asConverterFactory(\"application/json\".toMediaType()))",
      "        .build().create(ShopApi::class.java)",
      "",
      "    @Provides @Singleton",
      "    fun db(@ApplicationContext ctx: Context): ShopDb =",
      "        Room.databaseBuilder(ctx, ShopDb::class.java, \"shop.db\").build()",
      "",
      "    @Provides fun cartDao(db: ShopDb): CartDao = db.cartDao()",
      "}"
    ]},
    { id: "binds", label: "③ @Binds & qualifier", lines: [
      "interface CartRepository { fun observe(): Flow<List<CartItem>> }",
      "class CartRepositoryImpl @Inject constructor(private val dao: CartDao) : CartRepository { ... }",
      "",
      "@Module @InstallIn(SingletonComponent::class)",
      "abstract class RepoModule {",
      "    @Binds @Singleton",
      "    abstract fun cartRepo(impl: CartRepositoryImpl): CartRepository",
      "}",
      "",
      "@Qualifier @Retention(AnnotationRetention.BINARY) annotation class IoDispatcher",
      "",
      "@Module @InstallIn(SingletonComponent::class)",
      "object DispatcherModule {",
      "    @Provides @IoDispatcher fun io(): CoroutineDispatcher = Dispatchers.IO   // test thay bằng TestDispatcher",
      "}"
    ]},
    { id: "vm", label: "④ ViewModel", lines: [
      "@HiltViewModel",
      "class CartViewModel @Inject constructor(",
      "    private val repo: CartRepository,          // interface — Hilt tìm @Binds",
      "    private val handle: SavedStateHandle         // có sẵn",
      ") : ViewModel() { ... }",
      "",
      "@Composable",
      "fun CartRoute(vm: CartViewModel = hiltViewModel()) { ... }   // scope theo NavBackStackEntry"
    ]}
  ],

  stageHtml: `
    <div class="node" id="single"><div class="nl">🌍 SingletonComponent</div><div class="ns">OkHttpClient · ShopApi · ShopDb · CartRepository</div></div>
    <div class="arrow" id="a1">↓ con</div>
    <div class="node" id="retained"><div class="nl">🔁 ActivityRetainedComponent</div><div class="ns">sống qua xoay màn hình</div></div>
    <div class="arrow" id="a2">↓ con</div>
    <div class="row">
      <div class="node" id="vmc"><div class="nl">🧠 ViewModelComponent</div><div class="ns">CartViewModel + SavedStateHandle</div></div>
      <div class="node" id="actc"><div class="nl">📱 ActivityComponent</div><div class="ns">@AndroidEntryPoint</div></div>
    </div>
    <div class="node" id="compile"><div class="nl">⚙️ KSP sinh code lúc build</div><div class="ns">thiếu binding = lỗi compile</div></div>
  `,
  steps: [
    { title: "1 · Điểm vào của Hilt", tab: "app", highlight: [1, 4, 12, 13], on: ["single", "actc"],
      desc: "Application và Activity do OS tạo nên cần annotation để Hilt móc vào. Code sinh bởi KSP." },
    { title: "2 · @Provides như @Bean", tab: "module", highlight: [1, 2, 4, 5, 8, 9], on: ["single"],
      desc: "Hilt tự truyền tham số (TokenStore, OkHttpClient, Json) nếu biết cách tạo chúng." },
    { title: "3 · Nhớ @Singleton", tab: "module", highlight: [14, 15, 16, 18], on: ["single"],
      desc: "Không có scope → mỗi lần inject tạo DB mới. Khác mặc định singleton của Spring." },
    { title: "4 · Interface → impl & qualifier", tab: "binds", highlight: [2, 6, 7, 10, 14], on: ["single", "compile"],
      desc: "@Binds gắn interface với implementation (có @Inject constructor). Qualifier phân biệt hai binding cùng kiểu." },
    { title: "5 · ViewModel được inject", tab: "vm", highlight: [1, 2, 3, 4, 8], on: ["a1", "retained", "a2", "vmc"],
      desc: "hiltViewModel() tạo VM qua factory do Hilt sinh, gắn với entry navigation hiện tại." }
  ],

  quiz: [
    { q: "Khác biệt cốt lõi giữa Hilt và Spring DI?", options: [
        "Hilt không hỗ trợ constructor injection",
        "Hilt kiểm tra đồ thị và sinh code lúc compile; Spring dựng lúc runtime bằng reflection/scan",
        "Hilt chỉ cho Java",
        "Không khác"
      ], correct: 1, explanation: "Thiếu binding là lỗi build." },
    { q: "Một binding @Provides không có annotation scope thì?", options: [
        "Là singleton", "Mỗi lần inject tạo instance mới", "Lỗi compile", "Sống theo Activity"
      ], correct: 1, explanation: "Ngược với Spring (singleton mặc định)." },
    { q: "Vì sao OkHttpClient nên @Singleton?", options: [
        "Bắt buộc", "Mỗi instance có connection pool và thread pool riêng — tạo nhiều lãng phí tài nguyên", "Để test", "Không cần"
      ], correct: 1, explanation: "Chia sẻ một client cho cả app." },
    { q: "@Binds dùng khi nào?", options: [
        "Tạo object từ thư viện ngoài", "Gắn interface với implementation đã có @Inject constructor", "Khai báo Activity", "Tạo ViewModel"
      ], correct: 1, explanation: "@Provides dùng khi phải tự viết code tạo object." },
    { q: "Activity cần annotation gì để Hilt inject?", options: [
        "@Inject", "@AndroidEntryPoint", "@HiltViewModel", "@Module"
      ], correct: 1, explanation: "Application cần @HiltAndroidApp." },
    { q: "Lấy ViewModel có dependency trong Compose với Hilt?", options: [
        "CartViewModel()", "hiltViewModel()", "remember { CartViewModel() }", "LocalViewModel.current"
      ], correct: 1, explanation: "Tự dùng factory do Hilt sinh." },
    { q: "Binding cài trong SingletonComponent sống bao lâu?", options: [
        "Theo Activity", "Theo Application (toàn process)", "Theo ViewModel", "Một request"
      ], correct: 1, explanation: "Nếu có @Singleton." },
    { q: "Quên @Singleton trên provideDb() có thể gây lỗi gì?", options: [
        "Không lỗi gì",
        "Nhiều instance RoomDatabase: tốn tài nguyên và Flow quan sát của instance này không thấy ghi từ instance khác",
        "Lỗi compile",
        "Crash ngay"
      ], correct: 1, explanation: "Room invalidation tracker gắn với từng instance." },
    { q: "Dự án KMP cần DI cho code shared thường dùng?", options: [
        "Hilt", "Koin hoặc truyền tay", "Spring", "Dagger Android"
      ], correct: 1, explanation: "Hilt phụ thuộc Android." }
  ]
});
