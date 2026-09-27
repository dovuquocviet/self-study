window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Tổng kết",
  title: "Tổng kết: bản đồ app native từ lúc bấm icon tới lúc lên store",
  subtitle: "Một chuỗi sự kiện xuyên suốt · bảng Android ↔ iOS ↔ RN ↔ Spring · checklist khi chuyển RN sang native",

  theory: `
    <p>Gom cả khoá vào <strong>một hành trình</strong>: người dùng bấm icon app bán hàng, xem sản phẩm, rời app, nhận push "đơn đã giao".</p>
    <ol>
      <li><strong>Mở app</strong>: Zygote fork (Android) / launchd spawn (iOS) một process mới trong sandbox riêng (bài 01). Application/@main App khởi tạo.</li>
      <li><strong>Màn đầu tiên</strong>: Activity onCreate → onResume / Scene active; UI khai báo vào composition (bài 03, 04).</li>
      <li><strong>Tải dữ liệu</strong>: ViewModel launch coroutine / Task; mạng trên IO, UI trên main (bài 05, 06); OkHttp/URLSession + HTTP cache, lưu Room/SwiftData (bài 15, 16).</li>
      <li><strong>Vẽ</strong>: mỗi vsync, main thread measure/layout/draw hoặc commit transaction, render thread/render server vẽ GPU, trong 16 ms/8 ms (bài 07, 08).</li>
      <li><strong>Điều hướng</strong>: push destination lên back stack; Back pop, ViewModel của màn bị clear (bài 13).</li>
      <li><strong>Rời app</strong>: onStop / background → lưu trạng thái; process bị cache/suspend rồi có thể bị lmkd/jetsam giết im lặng (bài 02, 11).</li>
      <li><strong>Việc nền</strong>: WorkManager/BGTaskScheduler đồng bộ đơn nháp khi OS cho phép (bài 14).</li>
      <li><strong>Push</strong>: backend → FCM/APNs → OS hiển thị; bấm vào → deep link dựng lại stack trên process mới (bài 17, 18, 13).</li>
      <li><strong>Phát hành bản mới</strong>: R8/AAB, archive/IPA, ký, review, rollout từng phần (bài 19–21).</li>
    </ol>

    <table>
      <tr><th>Khái niệm</th><th>Android</th><th>iOS</th><th>React Native</th><th>Spring (liên tưởng)</th></tr>
      <tr><td>Runtime</td><td>ART (DEX, GC)</td><td>Mã máy + ARC</td><td>Hermes (bytecode, GC riêng) + nền tảng bên dưới</td><td>JVM</td></tr>
      <tr><td>Vòng đời màn</td><td>Activity/Fragment, composition</td><td>Scene, UIViewController, SwiftUI view</td><td>Component mount/unmount + màn native bên dưới</td><td>Bean lifecycle (nhưng ổn định hơn nhiều)</td></tr>
      <tr><td>Luồng UI</td><td>Main Looper</td><td>Main RunLoop / MainActor</td><td>JS thread + UI thread</td><td>Không có; thread-per-request</td></tr>
      <tr><td>Việc nền</td><td>Coroutines, WorkManager</td><td>async/await, BGTaskScheduler</td><td>Promise trên JS thread + module native</td><td>@Async, @Scheduled</td></tr>
      <tr><td>Lưu trữ</td><td>DataStore, Room, Keystore</td><td>UserDefaults, SwiftData, Keychain</td><td>AsyncStorage/MMKV, SQLite lib, keychain lib</td><td>Redis, JPA, Vault</td></tr>
      <tr><td>Đóng gói</td><td>AAB/APK + mapping.txt</td><td>IPA + dSYM</td><td>AAB/IPA + JS bundle + source map</td><td>JAR/Docker image</td></tr>
    </table>

    <p><strong>Checklist khi viết lại một màn RN bằng native</strong></p>
    <ul>
      <li>Trạng thái nào phải sống qua xoay màn (ViewModel) và qua process death (SavedState / @SceneStorage)?</li>
      <li>Có gì đang chạy trên main thread mà nên chuyển sang IO/Default hay actor?</li>
      <li>Danh sách đã lazy + key ổn định chưa? Ảnh đã giải mã đúng kích thước chưa?</li>
      <li>Closure/listener nào có thể giữ màn hình (weak self, applicationContext, huỷ đăng ký)?</li>
      <li>Việc nền có idempotent và dùng đúng API của OS (không poll)?</li>
      <li>Quyền xin đúng ngữ cảnh; push token cập nhật; deep link dựng stack hợp lý?</li>
      <li>Release: lưu mapping.txt/dSYM, rollout từng phần, có feature flag để tắt.</li>
    </ul>

    <div class="callout"><p>💡 Một câu để nhớ: <strong>OS là chủ, app là khách</strong> — app không kiểm soát khi nào mình sống, khi nào chạy nền, được bao nhiêu RAM, hay khi nào tới lượt vẽ. Code tốt là code <em>hợp tác</em> với OS thay vì chống lại nó.</p></div>
  `,

  codeTabs: [
    { id: "journey", label: "① Hành trình một cú bấm", lines: [
      "t=0      bấm icon      -> fork Zygote / launchd spawn, nạp app",
      "t=300ms  onCreate      -> setContent / WindowGroup, ViewModel tạo",
      "t=310ms  launch{}      -> api.products() trên IO, main vẫn rảnh",
      "t=316ms  vsync         -> frame đầu (skeleton) trong 16 ms",
      "t=700ms  dữ liệu về    -> state đổi -> recompose phần danh sách",
      "t=5min   Home          -> onStop / background, lưu nháp",
      "t=2h     thiếu RAM     -> lmkd/jetsam giết process (không callback)",
      "t=3h     push tới      -> FCM/APNs -> notification",
      "t=3h+1s  bấm push      -> process mới, deep link dựng [Home, Order]"
    ]},
    { id: "screen", label: "② Một màn native chuẩn (Android)", lines: [
      "@HiltViewModel",
      "class OrdersVM @Inject constructor(repo: OrderRepo, state: SavedStateHandle) : ViewModel() {",
      "    private val filter = state.getStateFlow(\"filter\", \"all\")        // qua process death",
      "    val orders = filter.flatMapLatest { repo.observe(it) }             // Room Flow",
      "        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())",
      "    init { viewModelScope.launch { repo.refresh() } }                 // IO bên trong repo",
      "}",
      "",
      "@Composable fun OrdersScreen(vm: OrdersVM = hiltViewModel()) {",
      "    val orders by vm.orders.collectAsStateWithLifecycle()",
      "    LazyColumn { items(orders, key = { it.id }) { OrderRow(it) } }",
      "}"
    ]},
    { id: "screen-ios", label: "③ Cùng màn đó (iOS)", lines: [
      "@MainActor @Observable final class OrdersModel {",
      "    var orders: [Order] = []",
      "    func load() async { orders = (try? await repo.refresh()) ?? repo.cached() }",
      "}",
      "",
      "struct OrdersScreen: View {",
      "    @State private var model = OrdersModel()",
      "    @SceneStorage(\"orders.filter\") private var filter = \"all\"   // khôi phục trạng thái",
      "    var body: some View {",
      "        List(model.orders) { OrderRow(order: $0) }",
      "            .task { await model.load() }                      // huỷ khi rời màn",
      "    }",
      "}"
    ]},
    { id: "rn", label: "④ Cùng màn đó (RN)", lines: [
      "function OrdersScreen() {",
      "  const { data } = useQuery({ queryKey: ['orders'], queryFn: api.orders }); // JS thread",
      "  return (",
      "    <FlashList data={data} keyExtractor={o => o.id}",
      "               renderItem={({ item }) => <OrderRow order={item} />} />",
      "  );",
      "}",
      "// Khác biệt: JS runtime + Fabric ở giữa; process death, main thread, bộ nhớ",
      "// vẫn là quy luật của Android/iOS bên dưới"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="os"><div class="nl">🧱 OS & sandbox</div><div class="ns">bài 01–02</div></div>
      <div class="node" id="lc"><div class="nl">♻️ Vòng đời</div><div class="ns">bài 03–04</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="th"><div class="nl">🧵 Thread & vẽ</div><div class="ns">bài 05–08</div></div>
      <div class="node" id="rn"><div class="nl">🟨 RN bên dưới</div><div class="ns">bài 09–10</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="row">
      <div class="node" id="mem"><div class="nl">🧠 Bộ nhớ</div><div class="ns">bài 11–12</div></div>
      <div class="node" id="sys"><div class="nl">🧰 Điều hướng, nền, mạng, lưu trữ, quyền, push</div><div class="ns">bài 13–18</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="rel"><div class="nl">🚀 Build, ký, phát hành</div><div class="ns">bài 19–21</div></div>
  `,
  steps: [
    { title: "1 · Mở app", tab: "journey", highlight: [1, 2], on: ["os", "lc"],
      desc: "Process mới trong sandbox; vòng đời bắt đầu." },
    { title: "2 · Tải & vẽ không chặn main", tab: "journey", highlight: [3, 4, 5], on: ["a1", "th"],
      desc: "Mạng trên IO, frame đầu trong ngân sách vsync, recompose đúng phần đổi." },
    { title: "3 · Màn chuẩn Android", tab: "screen", highlight: [3, 4, 5, 10, 11], on: ["lc", "th", "sys"],
      desc: "SavedStateHandle, Room Flow, collect theo lifecycle, LazyColumn có key." },
    { title: "4 · Màn chuẩn iOS", tab: "screen-ios", highlight: [1, 7, 8, 11], on: ["lc", "th"],
      desc: "@MainActor model, @SceneStorage cho khôi phục, .task huỷ theo view." },
    { title: "5 · RN: cùng quy luật bên dưới", tab: "rn", highlight: [2, 4, 8, 9], on: ["a2", "rn", "mem"],
      desc: "Thêm tầng JS runtime, nhưng process death, main thread, RAM vẫn là của OS." },
    { title: "6 · Rời app, push, phát hành", tab: "journey", highlight: [6, 7, 8, 9], on: ["sys", "a3", "rel"],
      desc: "Bị giết im lặng, push đưa người dùng quay lại trên process mới — và mọi bản sửa đi qua ký, review, rollout." }
  ],

  quiz: [
    { q: "Người dùng quay lại app sau 3 giờ, thấy đúng màn cũ nhưng app crash NPE. Nguyên nhân khả dĩ nhất?", options: [
        "Mạng yếu", "Process đã bị giết; màn được dựng lại trên process mới nhưng code dựa vào singleton trong RAM", "GPU lỗi", "Hết pin"
      ], correct: 1, explanation: "Bài 02–03: dùng SavedStateHandle và dựng lại từ DB/API." },
    { q: "Màn danh sách giật khi cuộn trên máy 120 Hz. Việc kiểm tra đầu tiên?", options: [
        "Tăng RAM", "Xem có việc nặng trên main thread / recompose thừa / ảnh giải mã sai kích thước bằng profiler", "Đổi sang WebView", "Tắt animation hệ thống"
      ], correct: 1, explanation: "Ngân sách chỉ 8,3 ms mỗi frame (bài 07, 08, 11)." },
    { q: "Android hiện hộp thoại ANR. Điều gì đã xảy ra?", options: [
        "Hết bộ nhớ", "Main thread không xử lý input trong 5 giây", "Mạng mất", "Thiếu quyền"
      ], correct: 1, explanation: "Bài 05." },
    { q: "Xoay màn hình mà dữ liệu đã tải không phải tải lại là nhờ gì?", options: [
        "Activity không bị huỷ", "ViewModel được giữ qua configuration change", "SharedPreferences", "Service"
      ], correct: 1, explanation: "Bài 03." },
    { q: "Một ViewController iOS không bao giờ chạy deinit sau khi đóng. Nghi ngờ đầu tiên?", options: [
        "ARC bị tắt", "Retain cycle: closure/timer/delegate giữ self mạnh", "Thiếu quyền", "Sai provisioning profile"
      ], correct: 1, explanation: "Bài 12: [weak self], weak delegate." },
    { q: "Trong RN New Architecture, thứ gì thay cho bridge JSON bất đồng bộ?", options: [
        "Hermes", "JSI", "Yoga", "Metro"
      ], correct: 1, explanation: "Bài 10." },
    { q: "Vì sao app native thuần vẫn khởi động nhanh hơn RN với Hermes?", options: [
        "Native không có main thread", "Native không phải nạp JS runtime, bundle và khởi tạo React trước màn đầu", "RN không dùng GPU", "Native không cần ký"
      ], correct: 1, explanation: "Bài 10." },
    { q: "Cần đồng bộ đơn nháp đảm bảo chạy kể cả khi app bị giết (Android). Dùng gì?", options: [
        "Thread trong Activity", "WorkManager với constraints", "GlobalScope.launch", "Handler.postDelayed"
      ], correct: 1, explanation: "Bài 14." },
    { q: "Push hoạt động với build debug iOS nhưng hỏng trên TestFlight. Kiểm tra gì?", options: [
        "Quyền camera", "Backend có đang gửi tới APNs production cho token production không", "Dung lượng máy", "Phiên bản Kotlin"
      ], correct: 1, explanation: "Bài 18." },
    { q: "Refresh token trên hai nền tảng nên lưu ở đâu?", options: [
        "UserDefaults / SharedPreferences", "Keychain (iOS) / mã hoá bằng khoá Android Keystore", "File trong Documents", "Biến static"
      ], correct: 1, explanation: "Bài 16." },
    { q: "Crash report release Android chỉ có a.b.c(). Thiếu gì?", options: [
        "dSYM", "mapping.txt của đúng bản build đó", "Keystore", "Provisioning profile"
      ], correct: 1, explanation: "Bài 19; iOS tương ứng là dSYM (bài 20)." },
    { q: "Ba mảnh ghép code signing iOS?", options: [
        "Certificate, App ID/entitlements, provisioning profile", "Keystore, upload key, AAB", "Apple ID, mật khẩu, OTP", "Info.plist, Assets, Storyboard"
      ], correct: 0, explanation: "Bài 20." },
    { q: "Bản mới trên store có lỗi nghiêm trọng. Điều gì KHÔNG làm được?", options: [
        "Halt staged rollout", "Tắt tính năng bằng feature flag", "Rollback bản đã cài trên máy người dùng", "Phát bản sửa"
      ], correct: 2, explanation: "Bài 21: mobile không có rollback." },
    { q: "Xin quyền camera trên iOS lần đầu bị từ chối. Lần sau app có thể làm gì?", options: [
        "Hiện lại hộp thoại hệ thống", "Dẫn người dùng tới Settings, hoặc dùng picker/camera hệ thống không cần quyền", "Tự cấp quyền", "Cài lại app"
      ], correct: 1, explanation: "Bài 17." },
    { q: "Cách tốt để giữ đúng state từng dòng khi danh sách thay đổi?", options: [
        "Dùng index làm key", "Dùng id ổn định từ dữ liệu làm key/identity", "Dùng UUID() mới mỗi lần render", "Không cần key"
      ], correct: 1, explanation: "Bài 08." },
    { q: "Câu nào mô tả đúng nhất tư duy khi làm app mobile?", options: [
        "App kiểm soát tài nguyên như server", "OS là chủ: quyết định app sống, chạy nền, được bao nhiêu RAM, khi nào vẽ — code phải hợp tác với OS", "Mọi thứ chạy trên main thread cho đơn giản", "Poll server mỗi phút là chuẩn"
      ], correct: 1, explanation: "Sợi chỉ xuyên suốt cả khoá." }
  ]
});
