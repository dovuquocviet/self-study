window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Hệ điều hành & vòng đời",
  title: "Process & vòng đời app: ai quyết định app sống hay chết?",
  subtitle: "Mức ưu tiên process Android · trạng thái app iOS · lmkd/jetsam · process death",

  theory: `
    <p>RAM điện thoại có hạn và không có swap kiểu server. Khi thiếu bộ nhớ, OS <strong>giết process</strong> theo thứ tự ưu tiên. App không được hỏi ý kiến.</p>

    <p><strong>Android: xếp hạng process theo "độ quan trọng"</strong></p>
    <ol>
      <li><strong>Foreground</strong>: có Activity người dùng đang tương tác, hoặc foreground service/receiver đang chạy. Gần như không bị giết.</li>
      <li><strong>Visible</strong>: nhìn thấy nhưng không ở trên cùng (bị dialog che một phần).</li>
      <li><strong>Service</strong>: có started service đang chạy (tải dữ liệu…). Bị giới hạn mạnh từ Android 8.</li>
      <li><strong>Cached</strong>: không có gì đang hiển thị — process được giữ lại để mở lại nhanh. <em>Là ứng viên bị giết đầu tiên</em>.</li>
    </ol>
    <p>Daemon <code>lmkd</code> theo dõi áp lực bộ nhớ và giết process có <code>oom_adj</code> cao nhất (ít quan trọng nhất). Trước đó app có thể nhận <code>onTrimMemory()</code>.</p>

    <p><strong>iOS: 5 trạng thái</strong></p>
    <table>
      <tr><th>Trạng thái</th><th>Chạy code?</th><th>Ví dụ</th></tr>
      <tr><td>Not running</td><td>Không</td><td>Chưa mở hoặc đã bị giết</td></tr>
      <tr><td>Inactive</td><td>Có, không nhận sự kiện</td><td>Kéo Control Center, có cuộc gọi đến</td></tr>
      <tr><td>Active</td><td>Có</td><td>Đang dùng bình thường</td></tr>
      <tr><td>Background</td><td>Có, trong thời gian ngắn</td><td>Vừa về Home; hoặc đang xin thêm thời gian / chạy background mode</td></tr>
      <tr><td>Suspended</td><td>Không — vẫn trong RAM, bị đóng băng</td><td>Có thể bị <strong>jetsam</strong> giết mà không có callback nào</td></tr>
    </table>
    <p>Khi về nền, app chỉ có vài giây; muốn làm nốt việc (lưu đơn hàng nháp) thì gọi <code>beginBackgroundTask</code> để xin thêm thời gian — thực tế khoảng 30 giây, và <strong>bắt buộc</strong> gọi <code>endBackgroundTask</code>, nếu không hệ thống sẽ giết app.</p>

    <p><strong>Process death — cái bẫy kinh điển</strong>: người dùng mở giỏ hàng → chuyển sang app ngân hàng lâu → quay lại. Process đã bị giết, nhưng OS vẫn nhớ "màn hình đang ở giỏ hàng" và dựng lại màn đó với <em>process mới toanh</em>:
    mọi biến static, singleton, cache trong RAM đều trống. Android cung cấp <code>SavedStateHandle</code>/<code>onSaveInstanceState</code>, iOS có state restoration (<code>@SceneStorage</code>, <code>NSUserActivity</code>) để khôi phục.</p>

    <div class="callout"><p>💡 Cách test process death trên Android: đưa app về nền rồi chạy <code>adb shell am kill com.shop.app</code>, sau đó mở lại từ Recents.
    Nếu app crash vì singleton null — bạn vừa tìm ra lỗi mà người dùng thật gặp hằng ngày.</p></div>
  `,

  codeTabs: [
    { id: "trim", label: "① Android: nghe áp lực RAM", lines: [
      "class ShopApp : Application() {",
      "    override fun onTrimMemory(level: Int) {",
      "        super.onTrimMemory(level)",
      "        if (level >= TRIM_MEMORY_UI_HIDDEN) {",
      "            imageCache.evictAll()      // UI đã ẩn: thả cache ảnh",
      "        }",
      "    }",
      "}",
      "",
      "// Xem hạng process: oom_score_adj càng cao càng dễ bị giết",
      "$ adb shell cat /proc/12873/oom_score_adj",
      "900    # cached"
    ]},
    { id: "bg", label: "② iOS: xin thêm thời gian", lines: [
      "func sceneDidEnterBackground(_ scene: UIScene) {",
      "    var taskId: UIBackgroundTaskIdentifier = .invalid",
      "    taskId = UIApplication.shared.beginBackgroundTask(withName: \"saveDraft\") {",
      "        // hết giờ: dọn dẹp và kết thúc ngay",
      "        UIApplication.shared.endBackgroundTask(taskId)",
      "    }",
      "    Task {",
      "        await draftStore.flush()",
      "        UIApplication.shared.endBackgroundTask(taskId)",
      "    }",
      "}"
    ]},
    { id: "death", label: "③ Bẫy process death", lines: [
      "object Session {                 // singleton trong RAM",
      "    var cart: Cart? = null",
      "}",
      "",
      "class CartViewModel(private val state: SavedStateHandle) : ViewModel() {",
      "    // SAI: Session.cart!!  -> NPE sau khi process bị giết",
      "    // ĐÚNG: lưu id tối thiểu, dựng lại dữ liệu từ DB/API",
      "    val cartId: String? = state[\"cartId\"]",
      "}",
      "",
      "$ adb shell am kill com.shop.app   # chỉ giết khi app đang ở nền",
      "# mở lại từ Recents -> Activity được tạo lại với process mới"
    ]},
    { id: "java", label: "④ So với Spring", lines: [
      "// Spring: bean singleton sống suốt vòng đời JVM",
      "@Service class CartService { val cache = ConcurrentHashMap<String, Cart>() }",
      "",
      "// Mobile: 'singleton' chỉ sống bằng process",
      "// -> process bị giết = mất sạch, nhưng màn hình vẫn được dựng lại",
      "// -> coi RAM là cache, nguồn sự thật là disk/server"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="fg"><div class="nl">🟢 Foreground / Active</div><div class="ns">đang dùng</div></div>
      <div class="node" id="bgn"><div class="nl">🟡 Background</div><div class="ns">vài giây, hoặc xin thêm</div></div>
    </div>
    <div class="arrow" id="a1">↓ hết giờ</div>
    <div class="node" id="cached"><div class="nl">🧊 Cached / Suspended</div><div class="ns">còn trong RAM, không chạy code</div></div>
    <div class="arrow" id="a2">↓ thiếu RAM: lmkd / jetsam</div>
    <div class="node" id="dead"><div class="nl">💀 Bị giết — không callback</div><div class="ns">static, singleton, cache mất sạch</div></div>
    <div class="arrow" id="a3">↓ người dùng mở lại từ Recents</div>
    <div class="node" id="restore"><div class="nl">♻️ Process mới + khôi phục màn hình</div><div class="ns">SavedStateHandle / state restoration</div></div>
  `,
  steps: [
    { title: "1 · Đang dùng", tab: "java", highlight: [4, 5], on: ["fg"],
      desc: "Process foreground gần như không bị giết. Nhưng không có gì bảo đảm nó sống khi rời màn hình." },
    { title: "2 · Về nền: xin thêm thời gian", tab: "bg", highlight: [3, 8, 9], on: ["bgn"],
      desc: "iOS cho vài giây; <code>beginBackgroundTask</code> xin thêm, và phải <code>endBackgroundTask</code> khi xong hoặc khi hết giờ." },
    { title: "3 · Bị đóng băng / cache", tab: "trim", highlight: [2, 4, 5, 11, 12], on: ["a1", "cached"],
      desc: "Android đưa process vào hạng cached (oom_score_adj cao); nên thả bớt cache khi nhận <code>onTrimMemory</code>." },
    { title: "4 · Bị giết im lặng", tab: "death", highlight: [1, 2, 6], on: ["a2", "dead"],
      desc: "lmkd/jetsam giết process, không gọi onDestroy hay applicationWillTerminate. Singleton mất sạch." },
    { title: "5 · Dựng lại màn hình", tab: "death", highlight: [5, 7, 8, 11, 12], on: ["a3", "restore"],
      desc: "OS dựng lại màn đang mở trên process mới. Chỉ những gì bạn đã lưu (SavedState, disk) còn tồn tại." }
  ],

  quiz: [
    { q: "Trên Android, process loại nào bị lmkd giết đầu tiên khi thiếu RAM?", options: [
        "Foreground", "Visible", "Cached (không có gì hiển thị)", "system_server"
      ], correct: 2, explanation: "Cached process có oom_score_adj cao nhất nên bị hy sinh trước." },
    { q: "Ở trạng thái Suspended trên iOS, app…", options: [
        "Vẫn chạy code bình thường",
        "Còn trong RAM nhưng không chạy code; có thể bị giết mà không nhận callback",
        "Đã bị xoá khỏi RAM",
        "Đang chạy ở chế độ tiết kiệm pin"
      ], correct: 1, explanation: "Suspended = đóng băng. Jetsam giết app suspended không báo trước." },
    { q: "Gọi beginBackgroundTask mà quên endBackgroundTask thì sao?", options: [
        "Không sao", "App được chạy nền vô hạn", "Hết thời gian cho phép, hệ thống giết app", "App bị gỡ cài đặt"
      ], correct: 2, explanation: "Expiration handler là cơ hội cuối để kết thúc task; không kết thúc thì app bị terminate." },
    { q: "Sau process death, người dùng mở lại app từ Recents. Điều gì xảy ra trên Android?", options: [
        "App mở lại từ màn hình splash",
        "Activity cuối cùng được tạo lại trên process mới, static/singleton đều trống",
        "Process cũ được đánh thức",
        "App báo lỗi và thoát"
      ], correct: 1, explanation: "Đây là nguồn gốc nhiều crash NullPointerException khó tái hiện." },
    { q: "Cách nhanh để giả lập process death khi test Android?", options: [
        "Xoay màn hình", "Đưa app về nền rồi adb shell am kill <package>", "Bấm nút Back", "Gỡ và cài lại"
      ], correct: 1, explanation: "am kill chỉ giết process đang ở nền, đúng như lmkd làm." },
    { q: "onTrimMemory(TRIM_MEMORY_UI_HIDDEN) là lúc thích hợp để…", options: [
        "Tải thêm dữ liệu", "Thả các tài nguyên chỉ dùng cho UI như cache ảnh", "Khởi động lại app", "Xin quyền"
      ], correct: 1, explanation: "UI đã ẩn thì cache ảnh không còn cần; thả ra giảm nguy cơ bị giết." },
    { q: "Nên lưu gì vào SavedStateHandle / onSaveInstanceState?", options: [
        "Toàn bộ danh sách sản phẩm", "Ảnh bitmap", "Trạng thái tối thiểu như id, vị trí cuộn, text đang nhập", "Token đăng nhập dạng plain text"
      ], correct: 2, explanation: "Bundle có giới hạn kích thước (TransactionTooLargeException); dữ liệu lớn thì dựng lại từ DB/API." },
    { q: "Trạng thái Inactive trên iOS xảy ra khi nào?", options: [
        "App bị crash", "App ở foreground nhưng tạm không nhận sự kiện (kéo Control Center, cuộc gọi đến)", "App đã bị giết", "App chưa cài"
      ], correct: 1, explanation: "Inactive là trạng thái chuyển tiếp ngắn giữa Active và Background." },
    { q: "Trong Spring, bean singleton sống theo JVM. Tương đương trên mobile cần hiểu thế nào?", options: [
        "Singleton sống vĩnh viễn trên thiết bị",
        "Singleton chỉ sống theo process; coi RAM là cache, nguồn sự thật là disk/server",
        "Mobile không cho phép singleton",
        "Singleton được OS tự lưu xuống disk"
      ], correct: 1, explanation: "Process có thể bị giết bất kỳ lúc nào ở nền." }
  ]
});
