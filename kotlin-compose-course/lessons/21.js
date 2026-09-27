window.LESSONS.push({
  id: "21",
  phase: "4", phaseName: "Kiến trúc app",
  title: "Kiến trúc: UDF, MVVM, repository & single source of truth",
  subtitle: "UI layer · (domain layer) · data layer · offline-first · mapping model giữa các tầng · so với Controller/Service/Repository của Spring",

  theory: `
    <p>Kiến trúc Google khuyến nghị cho Android rất gần thứ bạn đã làm ở Spring, chỉ đảo chiều: thay vì request HTTP đi vào, ở đây <strong>event của user</strong> đi vào
    và <strong>state</strong> chảy ra màn hình.</p>

    <table>
      <tr><th>Tầng</th><th>Thành phần</th><th>Trách nhiệm</th><th>Spring tương đương</th></tr>
      <tr><td>UI</td><td>Composable + ViewModel</td><td>Render state, nhận event, giữ UI state</td><td>Controller + view model/DTO</td></tr>
      <tr><td>Domain (tuỳ chọn)</td><td>UseCase: <code>PlaceOrderUseCase</code></td><td>Logic nghiệp vụ dùng lại giữa nhiều ViewModel</td><td>Service</td></tr>
      <tr><td>Data</td><td>Repository + DataSource (Retrofit API, Room DAO, DataStore)</td><td>Nguồn dữ liệu, cache, đồng bộ, ẩn chi tiết lưu trữ</td><td>Repository + client ngoài</td></tr>
    </table>
    <p>Phụ thuộc chỉ đi <strong>một chiều</strong>: UI → domain → data. Data layer không biết gì về ViewModel/Compose.</p>

    <p><strong>UDF (Unidirectional Data Flow)</strong>: <em>state đi xuống</em> (Repository → ViewModel → UI), <em>event đi lên</em> (UI → ViewModel → Repository).
    UI không bao giờ tự sửa dữ liệu; nó chỉ báo ý định. Mọi thay đổi đi qua một chỗ nên dễ debug: muốn biết vì sao màn hình hiện X, xem state; muốn biết state đổi thế nào, xem ViewModel.
    <strong>MVVM</strong> ở đây: Model = data layer, View = composable, ViewModel = lớp giữa. (Một số team dùng <strong>MVI</strong>: gom event thành sealed <code>Intent/Action</code> và một reducer — cùng tinh thần UDF.)</p>

    <p><strong>Single source of truth (SSOT)</strong>: mỗi loại dữ liệu có đúng một nơi "sở hữu" và chỉ nơi đó được sửa. Với <strong>offline-first</strong>, nguồn sự thật là
    <em>database cục bộ</em> (Room):</p>
    <ol>
      <li>UI quan sát <code>Flow</code> từ Room qua repository → hiển thị ngay dữ liệu cache, kể cả khi mất mạng.</li>
      <li>Repository gọi API, <em>ghi kết quả vào Room</em> (không trả thẳng lên UI).</li>
      <li>Room phát lại Flow → UI tự cập nhật. Một đường dữ liệu duy nhất, không có hai bản lệch nhau.</li>
    </ol>

    <p><strong>Model riêng từng tầng</strong>: <code>ProductDto</code> (JSON từ API) → <code>ProductEntity</code> (bảng Room) → <code>Product</code> (domain) → <code>ProductUi</code> (đã format giá, text).
    Hơi nhiều class, nhưng API đổi field thì chỉ sửa mapper, không lan lên UI — giống việc bạn không trả thẳng JPA entity ra REST.</p>

    <div class="callout"><p>💡 Đừng thêm domain layer/UseCase "cho đủ bộ". Nếu UseCase chỉ gọi thẳng repository thì nó là lớp thừa. Thêm khi logic được dùng ở nhiều ViewModel
    hoặc gộp nhiều repository (vd đặt hàng = giỏ + địa chỉ + thanh toán).</p></div>
  `,

  codeTabs: [
    { id: "repo", label: "① Repository offline-first", lines: [
      "class ProductRepository @Inject constructor(",
      "    private val api: ShopApi,          // Retrofit",
      "    private val dao: ProductDao,       // Room",
      "    @IoDispatcher private val io: CoroutineDispatcher",
      ") {",
      "    fun observeCategory(catId: Long): Flow<List<Product>> =",
      "        dao.observeByCategory(catId).map { rows -> rows.map { it.toDomain() } }   // SSOT = Room",
      "",
      "    suspend fun refreshCategory(catId: Long) = withContext(io) {",
      "        val dtos = api.productsByCategory(catId)        // có thể ném IOException",
      "        dao.replaceCategory(catId, dtos.map { it.toEntity() })   // ghi DB → Flow phát lại",
      "    }",
      "}"
    ]},
    { id: "vm", label: "② ViewModel ghép state", lines: [
      "@HiltViewModel",
      "class CategoryViewModel @Inject constructor(",
      "    private val repo: ProductRepository, handle: SavedStateHandle",
      ") : ViewModel() {",
      "    private val catId = handle.toRoute<CategoryRoute>().id",
      "    private val refreshing = MutableStateFlow(false)",
      "    private val error = MutableStateFlow<String?>(null)",
      "",
      "    val ui: StateFlow<CategoryUi> = combine(repo.observeCategory(catId), refreshing, error) { items, r, e ->",
      "        CategoryUi(items.map { it.toUi() }, refreshing = r, error = e)",
      "    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CategoryUi())",
      "",
      "    init { refresh() }",
      "    fun refresh() = viewModelScope.launch {",
      "        refreshing.value = true",
      "        error.value = runCatching { repo.refreshCategory(catId) }.exceptionOrNull()?.message",
      "        refreshing.value = false",
      "    }",
      "}"
    ]},
    { id: "models", label: "③ Model từng tầng", lines: [
      "@Serializable data class ProductDto(val id: Long, val title: String, @SerialName(\"price_cents\") val priceCents: Long)",
      "@Entity(tableName = \"products\") data class ProductEntity(@PrimaryKey val id: Long, val catId: Long, val name: String, val priceCents: Long)",
      "data class Product(val id: Long, val name: String, val price: Money)",
      "data class ProductUi(val id: Long, val name: String, val priceText: String)",
      "",
      "fun ProductEntity.toDomain() = Product(id, name, Money(priceCents))",
      "fun Product.toUi() = ProductUi(id, name, price.format(\"vi-VN\"))"
    ]},
    { id: "spring", label: "④ Đối chiếu Spring", lines: [
      "// Spring backend              // Android",
      "@RestController            ↔    Composable + ViewModel (nhận event, trả state)",
      "@Service                   ↔    UseCase (tuỳ chọn)",
      "@Repository (JPA)          ↔    Repository → Room DAO + Retrofit API",
      "Entity ↔ DTO mapper        ↔    Entity ↔ Dto ↔ Domain ↔ Ui mapper",
      "@Transactional             ↔    @Transaction của Room / withTransaction",
      "Spring DI                  ↔    Hilt (bài 24)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ui"><div class="nl">🖥️ UI (Composable)</div><div class="ns">render CategoryUi · gửi onRefresh</div></div>
    <div class="arrow" id="ev">↓ event: refresh()</div>
    <div class="node" id="vm"><div class="nl">🧠 ViewModel</div><div class="ns">combine(Flow từ repo, refreshing, error)</div></div>
    <div class="arrow" id="call">↓ repo.refreshCategory()</div>
    <div class="row">
      <div class="node" id="api"><div class="nl">🌐 Retrofit API</div><div class="ns">ProductDto</div></div>
      <div class="node" id="db"><div class="nl">🗃️ Room (SSOT)</div><div class="ns">ProductEntity</div></div>
    </div>
    <div class="arrow" id="state">↑ Room Flow phát lại → state mới đi lên UI</div>
  `,
  steps: [
    { title: "1 · Repository: Room là nguồn sự thật", tab: "repo", highlight: [6, 7], on: ["db"],
      desc: "UI chỉ quan sát dữ liệu từ Room, nên có dữ liệu cache ngay cả khi offline." },
    { title: "2 · Làm mới = ghi vào DB", tab: "repo", highlight: [9, 10, 11], on: ["call", "api", "db"],
      desc: "Kết quả API không trả thẳng lên UI mà ghi vào Room. Một đường dữ liệu duy nhất." },
    { title: "3 · Event đi lên", tab: "vm", highlight: [13, 14, 15, 16, 17], on: ["ui", "ev", "vm"],
      desc: "UI gọi refresh(); ViewModel quản lý cờ refreshing/error và gọi repository." },
    { title: "4 · State đi xuống", tab: "vm", highlight: [9, 10, 11], on: ["state", "vm", "ui"],
      desc: "combine gộp dữ liệu DB với trạng thái tải thành một CategoryUi. Room đổi → UI đổi tự động." },
    { title: "5 · Model riêng từng tầng", tab: "models", highlight: [1, 2, 3, 4, 6, 7], on: ["api", "db", "ui"],
      desc: "Đổi tên field JSON chỉ sửa DTO + mapper; UI nhận priceText đã format sẵn." },
    { title: "6 · Đối chiếu Spring", tab: "spring", highlight: [2, 3, 4, 5], on: ["vm"],
      desc: "Cùng tư duy phân tầng; khác ở chỗ luồng là event → state liên tục thay vì request → response." }
  ],

  quiz: [
    { q: "Trong UDF, dữ liệu và sự kiện đi thế nào?", options: [
        "Cả hai đi xuống", "State đi xuống (data → VM → UI), event đi lên (UI → VM → data)", "UI sửa trực tiếp repository", "Ngẫu nhiên"
      ], correct: 1, explanation: "Một chiều, dễ lần theo." },
    { q: "Offline-first: kết quả API nên đi đâu?", options: [
        "Trả thẳng lên UI", "Ghi vào database cục bộ; UI quan sát DB", "Lưu vào ViewModel", "Bỏ qua"
      ], correct: 1, explanation: "DB là single source of truth." },
    { q: "Hướng phụ thuộc giữa các tầng?", options: [
        "Data phụ thuộc UI", "UI → domain → data; data không biết UI", "Hai chiều", "Không có quy tắc"
      ], correct: 1, explanation: "Giống Controller → Service → Repository." },
    { q: "Khi nào nên thêm UseCase?", options: [
        "Luôn luôn cho mọi hàm", "Khi logic dùng lại ở nhiều ViewModel hoặc gộp nhiều repository", "Không bao giờ", "Chỉ khi dùng Hilt"
      ], correct: 1, explanation: "UseCase chỉ chuyển tiếp là lớp thừa." },
    { q: "Vì sao tách ProductDto, ProductEntity, ProductUi?", options: [
        "Bắt buộc bởi Room",
        "Thay đổi ở một tầng (API đổi field) không lan sang tầng khác",
        "Tăng tốc",
        "Để test chậm hơn"
      ], correct: 1, explanation: "Như không trả JPA entity ra REST." },
    { q: "combine(flowA, flowB) phát khi nào?", options: [
        "Chỉ khi cả hai phát cùng lúc", "Khi bất kỳ flow nào phát (sau khi mỗi flow đã có ít nhất một giá trị)", "Một lần duy nhất", "Khi flowA kết thúc"
      ], correct: 1, explanation: "Hợp để gộp dữ liệu và trạng thái tải." },
    { q: "Trong MVVM Android, 'View' là?", options: [
        "Room", "Composable (hoặc Activity/Fragment)", "Repository", "Retrofit"
      ], correct: 1, explanation: "Model là data layer." },
    { q: "Mất mạng khi mở màn danh mục (offline-first) thì user thấy gì?", options: [
        "Màn trắng", "Dữ liệu cache từ Room + thông báo lỗi làm mới", "App crash", "Loading mãi"
      ], correct: 1, explanation: "Lợi ích chính của SSOT = DB." },
    { q: "MVI khác MVVM chủ yếu ở?", options: [
        "Không dùng ViewModel",
        "Gom event thành kiểu Intent/Action (thường sealed) và cập nhật state qua reducer — vẫn là UDF",
        "Không có state",
        "Chỉ cho iOS"
      ], correct: 1, explanation: "Khác cách tổ chức, cùng nguyên tắc một chiều." }
  ]
});
