window.LESSONS.push({
  id: "19",
  phase: "6", phaseName: "Chuyển đổi & tổng kết",
  title: "Tổng kết: bản đồ KMP từ source tới App Store",
  subtitle: "Một request đi qua toàn bộ stack · checklist quyết định · ôn tập",

  theory: `
    <p>Gom lại toàn bộ khoá bằng một luồng thật: người dùng iOS kéo để làm mới danh sách đơn hàng.</p>
    <ol>
      <li><strong>SwiftUI</strong> gọi <code>vm.onRefresh()</code> — ViewModel Kotlin lấy qua Koin (<code>Deps</code>), sống theo <code>ViewModelStore</code> của màn hình (bài 12, 13).</li>
      <li><code>viewModelScope.launch</code> trên <code>Dispatchers.Main</code> (= main queue) cập nhật <code>UiState(refreshing = true)</code> (bài 09).</li>
      <li><code>OrderRepository.refresh()</code> chuyển sang <code>Dispatchers.IO</code>, <strong>Ktor</strong> + engine Darwin gọi API, <strong>kotlinx.serialization</strong> parse JSON bằng serializer sinh lúc biên dịch (bài 10).</li>
      <li>Kết quả ghi vào <strong>SQLDelight/Room</strong>; Flow từ DB phát danh sách mới → UseCase lọc → <code>StateFlow</code> (bài 11, 13).</li>
      <li>Swift nhận state qua wrapper/SKIE trên main thread, closure dùng <code>[weak self]</code> để không tạo vòng trộn với GC (bài 08, 16).</li>
      <li>Toàn bộ phần Kotlin là mã máy trong <code>Shared.xcframework</code> phát hành qua SPM (bài 06, 15), có test ở commonTest chạy cả trên simulator (bài 17).</li>
    </ol>

    <table>
      <tr><th>Quyết định</th><th>Mặc định hợp lý</th><th>Đổi khi</th></tr>
      <tr><td>Chia sẻ tới đâu</td><td>Tới ViewModel, UI native</td><td>Màn phụ/nội bộ → CMP</td></tr>
      <tr><td>Phụ thuộc nền tảng</td><td>Interface + DI; expect fun cho factory nhỏ</td><td>—</td></tr>
      <tr><td>Flow sang Swift</td><td>SKIE hoặc KMP-NativeCoroutines</td><td>Muốn 0 phụ thuộc → wrapper tự viết</td></tr>
      <tr><td>DB cục bộ</td><td>SQLDelight (SQL-first) hoặc Room (đội Android quen)</td><td>—</td></tr>
      <tr><td>Phân phối iOS</td><td>Direct integration trong monorepo</td><td>Đội iOS tách repo → XCFramework + SPM</td></tr>
      <tr><td>Ngoại lệ ở ranh giới</td><td>Trả sealed Result hoặc gắn @Throws</td><td>Không bao giờ để exception trần sang Swift</td></tr>
    </table>

    <p><strong>Những điều "kỹ sư" cần nhớ, không chỉ "code theo mẫu"</strong></p>
    <ul>
      <li>KMP là <em>trình biên dịch</em>, không phải runtime: không bridge, không VM trên iOS.</li>
      <li>Swift thấy Kotlin qua header Objective-C → mọi điểm vụng (enum, sealed, generic interface, default args, exception) đều từ đây.</li>
      <li>Native không có reflection kiểu JVM → thư viện sinh code lúc build (serialization, Room, SQLDelight).</li>
      <li>Memory model mới = tự do như JVM → data race là việc của bạn; ranh giới GC/ARC cần <code>weak</code>.</li>
      <li>Chuyển đổi từ RN: logic trước, UI sau, gỡ RN cuối cùng.</li>
    </ul>

    <div class="callout"><p>💡 Bước tiếp theo: dựng một module <code>shared</code> nhỏ chứa một tính năng thật (vd tính phí ship + gọi API đơn hàng), có commonTest, chạy được trong app Android và một app SwiftUI mẫu.
    Làm hết vòng đó một lần là đã chạm vào mọi bài của khoá.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "Luồng đầy đủ", lines: [
      "// SwiftUI",
      "// .refreshable { model.vm.onRefresh() }",
      "",
      "// shared — ViewModel",
      "fun onRefresh() = viewModelScope.launch {               // Main = main queue",
      "    _state.update { it.copy(refreshing = true) }",
      "    runCatching { repo.refresh() }",
      "        .onFailure { e -> _state.update { it.copy(error = e.message) } }",
      "    _state.update { it.copy(refreshing = false) }",
      "}",
      "",
      "// shared — Repository",
      "suspend fun refresh() = withContext(io) {",
      "    val dto: List<OrderDto> = client.get(\"orders\").body()  // Ktor + Darwin + serialization",
      "    dao.replaceAll(dto)                                     // DB → Flow phát lại",
      "}"
    ]},
    { id: "check", label: "Checklist API cho Swift", lines: [
      "[ ] Hàm có thể lỗi: @Throws hoặc trả sealed Result",
      "[ ] Không trả Flow trần: dùng SKIE / NativeCoroutines / wrapper",
      "[ ] Tránh generic interface ở ranh giới",
      "[ ] Không dựa vào tham số mặc định (hoặc bật SKIE default args)",
      "[ ] Tên hàm không bắt đầu bằng init/new/copy nếu tránh được",
      "[ ] Một framework umbrella duy nhất",
      "[ ] ViewModel trên iOS có người gọi clear()",
      "[ ] Closure Swift truyền vào Kotlin dùng [weak self]"
    ]},
    { id: "map", label: "Bản đồ khoá", lines: [
      "Toàn cảnh      01 KMP là gì · 02 các backend biên dịch",
      "Project        03 target/source set · 04 Gradle · 05 expect/actual",
      "iOS ↔ Kotlin   06 framework & Xcode · 07 interop · 08 suspend/Flow sang Swift",
      "Thư viện       09 coroutines · 10 Ktor + serialization · 11 SQLDelight/Room · 12 DataStore/Koin",
      "Kiến trúc      13 Repository → UseCase → ViewModel · 14 Compose Multiplatform",
      "Build/runtime  15 XCFramework/SPM · 16 bộ nhớ & concurrency · 17 commonTest",
      "Chuyển đổi     18 RN → KMP + native · 19 tổng kết"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ui"><div class="nl">🦅 SwiftUI .refreshable</div><div class="ns">gọi vm.onRefresh()</div></div>
    <div class="arrow" id="a1">↓ viewModelScope (Main)</div>
    <div class="node" id="vm"><div class="nl">🧠 ViewModel shared</div><div class="ns">UiState(refreshing = true)</div></div>
    <div class="arrow" id="a2">↓ withContext(IO)</div>
    <div class="row">
      <div class="node" id="net"><div class="nl">🌐 Ktor + Darwin</div><div class="ns">kotlinx.serialization</div></div>
      <div class="node" id="db"><div class="nl">🗄️ SQLDelight/Room</div><div class="ns">ghi → Flow phát</div></div>
    </div>
    <div class="arrow" id="a3">↓ StateFlow → SKIE/wrapper (main thread)</div>
    <div class="node" id="back"><div class="nl">🔁 SwiftUI render</div><div class="ns">[weak self] · clear() khi rời màn</div></div>
  `,
  steps: [
    { title: "1 · UI gửi hành động", tab: "flow", highlight: [2, 5], on: ["ui", "a1"],
      desc: "UI native không chứa logic; chỉ gọi hành động của ViewModel shared." },
    { title: "2 · State bật cờ", tab: "flow", highlight: [6], on: ["vm"],
      desc: "update { copy } nguyên tử; UI thấy spinner." },
    { title: "3 · Mạng và parse", tab: "flow", highlight: [13, 14], on: ["a2", "net"],
      desc: "I/O trên dispatcher IO, engine Darwin dùng NSURLSession, serializer sinh lúc biên dịch." },
    { title: "4 · DB là nguồn sự thật", tab: "flow", highlight: [15], on: ["db"],
      desc: "Ghi DB; Flow từ DB phát danh sách mới qua UseCase lên StateFlow." },
    { title: "5 · Về lại Swift", tab: "check", highlight: [2, 7, 8], on: ["a3", "back"],
      desc: "State sang Swift qua SKIE/wrapper; nhớ weak self và clear ViewModel khi rời màn." },
    { title: "6 · Ôn lại bản đồ", tab: "map", highlight: [1, 2, 3, 4, 5, 6, 7], on: ["ui", "vm", "net", "db", "back"],
      desc: "Mỗi bước của luồng tương ứng với một bài trong khoá." }
  ],

  quiz: [
    { q: "Câu nào mô tả đúng nhất bản chất KMP?", options: [
        "Runtime chạy Kotlin trên mọi nền tảng",
        "Trình biên dịch sinh bytecode/mã máy cho từng nền tảng từ code Kotlin chung",
        "Framework UI như Flutter",
        "Thư viện JavaScript"
      ], correct: 1, explanation: "Không có VM hay bridge trên iOS." },
    { q: "commonMain được phép dùng thứ nào?", options: [
        "java.io.File", "kotlinx.coroutines và thư viện đa nền tảng", "UIKit", "android.content.Context"
      ], correct: 1, explanation: "API nền tảng chỉ ở source set nền tảng." },
    { q: "Target iPhone thật và simulator Apple Silicon là?", options: [
        "iosX64 và iosArm64", "iosArm64 và iosSimulatorArm64", "ios và iosSim", "arm64 và x86"
      ], correct: 1, explanation: "iosX64 cho simulator trên Mac Intel." },
    { q: "Vì sao enum/sealed/Flow Kotlin trông vụng trong Swift?", options: [
        "Swift yếu",
        "Swift nhìn Kotlin qua header Objective-C, vốn không có các khái niệm đó",
        "Do Xcode lỗi",
        "Do Gradle"
      ], correct: 1, explanation: "SKIE và Swift export nhằm giải quyết điều này." },
    { q: "Hàm Kotlin không @Throws ném exception khi Swift gọi?", options: [
        "Swift catch được", "App crash", "Trả nil", "Bị log rồi bỏ qua"
      ], correct: 1, explanation: "Gắn @Throws hoặc trả Result." },
    { q: "Muốn phụ thuộc nền tảng dễ test và cài được bằng Swift, chọn?", options: [
        "expect class", "Interface trong common + cài đặt theo nền tảng qua DI", "Global var", "Reflection"
      ], correct: 1, explanation: "expect fun hợp với factory nhỏ." },
    { q: "Engine Ktor cho iOS và serialization chạy trên Native nhờ?", options: [
        "OkHttp + Jackson",
        "Darwin (NSURLSession) + kotlinx.serialization sinh serializer lúc biên dịch",
        "CIO + Gson",
        "URLSession Swift + Codable"
      ], correct: 1, explanation: "Không cần reflection." },
    { q: "Single source of truth trong kiến trúc chia sẻ là?", options: [
        "API là nguồn duy nhất UI đọc",
        "DB cục bộ; mạng chỉ cập nhật DB, UI đọc Flow từ DB",
        "ViewModel giữ tất cả",
        "UserDefaults"
      ], correct: 1, explanation: "Offline-first và nhất quán." },
    { q: "Trên iOS, điều gì phải tự làm với ViewModel androidx dùng chung?", options: [
        "Không gì cả",
        "Quản ViewModelStore của màn hình và gọi clear() khi màn hình biến mất",
        "Freeze ViewModel",
        "Chạy trên thread riêng"
      ], correct: 1, explanation: "Nếu không viewModelScope không bị huỷ." },
    { q: "Khi nào chọn Compose Multiplatform cho một màn hình?", options: [
        "Widget iOS",
        "Màn cài đặt/form/admin, đội chủ yếu là Kotlin, thiết kế thương hiệu riêng",
        "Live Activity",
        "Không bao giờ"
      ], correct: 1, explanation: "Có thể nhúng từng màn vào app SwiftUI." },
    { q: "Đội iOS ở repo riêng, không muốn cài Gradle. Phân phối thế nào?", options: [
        "Direct integration", "XCFramework phát hành qua SPM (binaryTarget + checksum)", "Copy file .kt", "Không thể"
      ], correct: 1, explanation: "KMMBridge tự động hoá." },
    { q: "Memory model mới của Kotlin/Native có nghĩa là?", options: [
        "Phải freeze object",
        "Chia sẻ object giữa thread tự do như JVM; tự lo đồng bộ",
        "Không có GC",
        "Chỉ một thread"
      ], correct: 1, explanation: "Mặc định từ 1.7.20." },
    { q: "Vòng tham chiếu giữa object Swift và Kotlin phá thế nào?", options: [
        "GC tự phá", "weak/unowned phía Swift và huỷ subscription", "Gọi System.gc()", "Không cần"
      ], correct: 1, explanation: "GC không phá được vòng đi qua object ARC." },
    { q: "Thư viện mock nào KHÔNG dùng được trong commonTest có target iOS?", options: [
        "Fake viết tay", "MockK/Mockito", "Ktor MockEngine", "Turbine"
      ], correct: 1, explanation: "Chúng dựa vào cơ chế JVM." },
    { q: "Thứ tự hợp lý khi chuyển từ React Native sang KMP + native UI?", options: [
        "Gỡ RN trước rồi viết lại",
        "Chuyển logic vào KMP (gọi qua native module) → màn mới native → đảo vỏ app → gỡ RN",
        "Viết lại UI trước, logic sau",
        "Chạy song song hai app mãi mãi"
      ], correct: 1, explanation: "Strangler fig: thay từng phần, luôn có app chạy được." }
  ]
});
