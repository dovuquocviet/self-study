window.LESSONS.push({
  id: "19",
  phase: "3", phaseName: "SwiftUI",
  title: "Lifecycle: App/Scene, .task, onAppear, onChange, scenePhase",
  subtitle: ".task tự huỷ khi view biến mất · .task(id:) chạy lại khi id đổi · init ≠ xuất hiện · so với useEffect",

  theory: `
    <p><strong>Điểm vào của app</strong>: <code>@main struct ShopApp: App</code> với <code>var body: some Scene { WindowGroup { RootView() } }</code>. Không còn <code>AppDelegate</code> bắt buộc (cần thì gắn bằng <code>@UIApplicationDelegateAdaptor</code>, ví dụ cho push notification). Giống <code>main()</code> của Spring Boot: nơi dựng các object sống suốt đời app.</p>

    <p><strong>Ba khái niệm hay bị nhầm</strong></p>
    <ul>
      <li><strong>init của struct View</strong>: có thể chạy nhiều lần, kể cả khi view chưa (hoặc không bao giờ) hiện — ví dụ màn hình đích của NavigationLink, cha vẽ lại. <strong>Không</strong> làm side effect trong init.</li>
      <li><strong>body</strong>: chạy khi dependency đổi (bài 13). Không side effect.</li>
      <li><strong>Xuất hiện / biến mất</strong>: đây mới là nơi làm việc — dùng modifier.</li>
    </ul>

    <table>
      <tr><th>Modifier</th><th>Khi nào chạy</th><th>React tương đương</th></tr>
      <tr><td><code>.task { await ... }</code></td><td>Trước khi view xuất hiện; <strong>tự huỷ</strong> Task khi view biến mất</td><td><code>useEffect(() =&gt; { ...; return cleanup }, [])</code></td></tr>
      <tr><td><code>.task(id: query) { ... }</code></td><td>Như trên + <strong>huỷ và chạy lại</strong> khi <code>id</code> đổi</td><td><code>useEffect(..., [query])</code></td></tr>
      <tr><td><code>.onAppear</code> / <code>.onDisappear</code></td><td>Đồng bộ; có thể gọi <strong>nhiều lần</strong> (quay lại màn hình, đổi tab)</td><td>focus/blur listener</td></tr>
      <tr><td><code>.onChange(of: value) { old, new in }</code></td><td>Khi giá trị đổi (chữ ký 2 tham số từ iOS 17)</td><td><code>useEffect</code> theo dependency</td></tr>
      <tr><td><code>@Environment(&#92;.scenePhase)</code></td><td><code>.active</code> / <code>.inactive</code> / <code>.background</code></td><td><code>AppState</code> change</td></tr>
    </table>

    <p><strong>Vì sao ưu tiên .task hơn onAppear + Task {}?</strong> <code>.onAppear { Task { await load() } }</code> tạo Task <em>không ai huỷ</em>: rời màn hình giữa chừng, request vẫn chạy, rồi ghi kết quả vào state của màn hình đã đóng. <code>.task</code> gắn vòng đời Task với view — huỷ tự động (URLSession nhận huỷ và ném lỗi <code>URLError.cancelled</code>). Với ô tìm kiếm, <code>.task(id: query)</code> + <code>Task.sleep</code> cho debounce miễn phí: gõ ký tự mới → task cũ bị huỷ trong lúc đang sleep.</p>

    <p>Closure của <code>.task</code> kế thừa MainActor từ View, nên gán state sau <code>await</code> là an toàn. Lưu ý: <code>.onAppear</code> được gọi lại khi quay về màn hình — nếu chỉ muốn tải một lần, kiểm tra state (<code>if items.isEmpty</code>) hoặc tải ở ViewModel.</p>

    <div class="callout"><p>💡 Nền/tiền cảnh: dùng <code>.onChange(of: scenePhase)</code> để lưu nháp khi app vào nền, làm mới token khi quay lại <code>.active</code>. Việc chạy nền lâu (sync định kỳ) cần BackgroundTasks framework — hệ điều hành quyết định khi nào chạy.</p></div>
  `,

  codeTabs: [
    { id: "app", label: "App & Scene", lines: [
      "@main",
      "struct ShopApp: App {",
      "    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate   // tuỳ chọn: push",
      "    @State private var session = SessionModel()",
      "    @Environment(\\.scenePhase) private var scenePhase",
      "",
      "    var body: some Scene {",
      "        WindowGroup { RootView().environment(session) }",
      "            .onChange(of: scenePhase) { _, phase in",
      "                if phase == .background { session.saveDraft() }",
      "                if phase == .active { Task { await session.refreshIfNeeded() } }",
      "            }",
      "    }",
      "}"
    ]},
    { id: "task", label: ".task", lines: [
      "struct OrderListView: View {",
      "    @State private var orders: [Order] = []",
      "    @State private var error: String?",
      "",
      "    var body: some View {",
      "        List(orders) { OrderRow(o: $0) }",
      "            .task {                                  // huỷ khi view biến mất",
      "                do { orders = try await api.orders() }   // quay lại MainActor",
      "                catch { if !Task.isCancelled { self.error = error.localizedDescription } }",
      "                // bị huỷ (CancellationError / URLError.cancelled) thì im lặng",
      "            }",
      "            .refreshable { orders = (try? await api.orders()) ?? orders }",
      "    }",
      "}"
    ]},
    { id: "search", label: ".task(id:) debounce", lines: [
      "struct SearchView: View {",
      "    @State private var query = \"\"",
      "    @State private var results: [Product] = []",
      "    var body: some View {",
      "        List(results) { Text($0.name) }",
      "            .searchable(text: $query)",
      "            .task(id: query) {                         // query đổi → huỷ task cũ",
      "                try? await Task.sleep(for: .milliseconds(300))   // debounce",
      "                guard !Task.isCancelled, query.count >= 2 else { return }",
      "                results = (try? await api.search(query)) ?? []",
      "            }",
      "    }",
      "}"
    ]},
    { id: "bad", label: "Bẫy", lines: [
      "struct ProductDetail: View {",
      "    let id: String",
      "    init(id: String) {",
      "        self.id = id",
      "        // ❌ api.trackView(id) — init có thể chạy khi view chưa hề hiện",
      "    }",
      "    var body: some View {",
      "        content",
      "            .onAppear { Task { await load() } }   // ❌ không bị huỷ khi rời màn hình",
      "            .task { await load() }                 // ✅",
      "    }",
      "}"
    ]},
    { id: "rn", label: "React Native", lines: [
      "useEffect(() => {",
      "  const controller = new AbortController();",
      "  api.orders({ signal: controller.signal }).then(setOrders);",
      "  return () => controller.abort();           // cleanup khi unmount",
      "}, []);",
      "",
      "useEffect(() => { /* search */ }, [query]);  // ≈ .task(id: query)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="init"><div class="nl">init View</div><div class="ns">có thể nhiều lần, chưa chắc hiện</div></div>
    <div class="arrow" id="a1">↓ view được đưa lên màn hình</div>
    <div class="node" id="appear"><div class="nl">.task bắt đầu · onAppear</div><div class="ns">trên MainActor</div></div>
    <div class="arrow" id="a2">↓ id đổi</div>
    <div class="node" id="restart"><div class="nl">huỷ task cũ → chạy task mới</div><div class="ns">.task(id:)</div></div>
    <div class="arrow" id="a3">↓ view rời màn hình</div>
    <div class="node" id="gone"><div class="nl">task bị huỷ · onDisappear</div><div class="ns">URLSession ném lỗi cancelled</div></div>
  `,
  steps: [
    { title: "1 · App là điểm vào", tab: "app", highlight: [1, 2, 4, 8], on: ["init"],
      desc: "Object sống suốt đời app giữ bằng <code>@State</code> trong App và tiêm qua environment." },
    { title: "2 · scenePhase", tab: "app", highlight: [5, 9, 10, 11], on: ["gone"],
      desc: "Theo dõi app vào nền/quay lại để lưu nháp hoặc làm mới dữ liệu." },
    { title: "3 · .task gắn vòng đời", tab: "task", highlight: [7, 8, 9, 10], on: ["a1", "appear"],
      desc: "Bắt đầu khi view xuất hiện, tự huỷ khi biến mất. Lỗi do bị huỷ (URLSession ném <code>URLError.cancelled</code>, code khác có thể ném <code>CancellationError</code>) không phải lỗi người dùng cần thấy." },
    { title: "4 · .task(id:) = useEffect có dependency", tab: "search", highlight: [6, 7, 8, 9, 10], on: ["a2", "restart"],
      desc: "Mỗi ký tự mới huỷ task cũ đang sleep → chỉ lần gõ cuối cùng gọi API. Debounce không cần Combine." },
    { title: "5 · Bẫy init và onAppear + Task", tab: "bad", highlight: [3, 5, 9, 10], on: ["init", "a3", "gone"],
      desc: "Side effect trong init chạy sai thời điểm; Task trong onAppear không bị huỷ. Dùng <code>.task</code>." },
    { title: "6 · Đối chiếu RN", tab: "rn", highlight: [1, 4, 5, 7], on: ["appear"],
      desc: "AbortController + cleanup của useEffect là thứ <code>.task</code> làm sẵn cho bạn." }
  ],

  quiz: [
    { q: "Điều gì xảy ra với Task tạo bởi .task khi view biến mất?", options: [
        "Chạy tiếp tới xong", "Bị huỷ tự động", "Chuyển sang nền", "Crash"
      ], correct: 1, explanation: "Vòng đời task gắn với view." },
    { q: ".task(id: query) hành xử thế nào khi query đổi?", options: [
        "Không làm gì", "Huỷ task đang chạy và khởi động task mới", "Chạy song song task mới", "Chỉ chạy lần đầu"
      ], correct: 1, explanation: "Tương đương useEffect với dependency [query]." },
    { q: "Vì sao không đặt side effect (gọi API, tracking) trong init của View?", options: [
        "Không biên dịch",
        "init có thể chạy nhiều lần và cả khi view chưa hiện (ví dụ đích của NavigationLink)",
        "init chạy trên thread nền",
        "init không có self"
      ], correct: 1, explanation: "Làm side effect trong .task/.onAppear." },
    { q: ".onAppear { Task { await load() } } có nhược điểm gì so với .task?", options: [
        "Không chạy",
        "Task không bị huỷ khi rời màn hình",
        "Chạy hai lần",
        "Chạy trên thread nền"
      ], correct: 1, explanation: "Task không cấu trúc cần tự giữ và huỷ." },
    { q: "Cách debounce ô tìm kiếm đơn giản trong SwiftUI?", options: [
        "Timer tự viết",
        ".task(id: query) { try? await Task.sleep(for: .milliseconds(300)); ... }",
        "DispatchQueue.asyncAfter không huỷ",
        "Không làm được"
      ], correct: 1, explanation: "Gõ tiếp huỷ task đang sleep." },
    { q: "Theo dõi app vào nền dùng gì?", options: [
        "@Environment(\\.scenePhase) + onChange", ".onDisappear", "deinit", "UserDefaults"
      ], correct: 0, explanation: "Giá trị .background/.inactive/.active." },
    { q: "Closure của .task chạy trên actor nào (view SwiftUI thông thường)?", options: [
        "Thread nền ngẫu nhiên", "MainActor, kế thừa từ View", "Actor riêng", "Không xác định"
      ], correct: 1, explanation: "Gán @State sau await là an toàn." },
    { q: "onChange(of:) dạng mới (iOS 17) nhận tham số gì?", options: [
        "Không tham số", "Giá trị cũ và giá trị mới", "Chỉ giá trị mới dạng Binding", "Index"
      ], correct: 1, explanation: "{ oldValue, newValue in ... } hoặc closure không tham số." },
    { q: "Cần AppDelegate cho push notification trong app SwiftUI thì?", options: [
        "Không thể",
        "Dùng @UIApplicationDelegateAdaptor trong struct App",
        "Chuyển sang UIKit hoàn toàn",
        "Viết trong Info.plist"
      ], correct: 1, explanation: "Cầu nối tới UIApplicationDelegate." }
  ]
});
