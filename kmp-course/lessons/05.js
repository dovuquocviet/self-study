window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Project & Gradle",
  title: "expect/actual — và khi nào nên dùng interface thay thế",
  subtitle: "expect fun · expect class (Beta) · actual typealias · interface + DI cho phụ thuộc có trạng thái",

  theory: `
    <p>Khi code chung cần một thứ mà mỗi nền tảng làm khác nhau (UUID, đường dẫn file, tên thiết bị, SQLite driver), KMP cho hai cách:</p>

    <p><strong>1. expect/actual</strong> — cơ chế của ngôn ngữ</p>
    <ul>
      <li>Trong <code>commonMain</code> khai báo <code>expect fun platformName(): String</code> — chỉ có chữ ký, không có thân.</li>
      <li>Trong <em>mỗi</em> source set nền tảng (hoặc source set trung gian như <code>iosMain</code>) viết <code>actual fun platformName(): String = ...</code>.</li>
      <li>Trình biên dịch <strong>kiểm tra lúc build</strong>: thiếu <code>actual</code> cho target nào là lỗi. Không có tra cứu lúc chạy, không reflection.</li>
      <li>Áp dụng cho hàm, property, object, class, annotation. Riêng <code>expect class</code> đang ở trạng thái <strong>Beta</strong> (có cảnh báo; tắt bằng cờ <code>-Xexpect-actual-classes</code>).</li>
      <li><code>actual typealias</code> cho phép ánh xạ thẳng tới một kiểu có sẵn của nền tảng, ví dụ trỏ tới một class Java đã có trên Android.</li>
    </ul>

    <p><strong>2. Interface trong common + cài đặt ở nền tảng, nối bằng DI</strong></p>
    <ul>
      <li><code>interface SecureStorage { fun put(k: String, v: String) }</code> trong common.</li>
      <li>Android cài bằng EncryptedSharedPreferences/Keystore, iOS cài bằng Keychain — cài đặt iOS thậm chí có thể viết bằng <strong>Swift</strong> rồi truyền vào Kotlin.</li>
      <li>Test dễ: truyền một bản fake trong commonTest.</li>
    </ul>

    <table>
      <tr><th></th><th>expect/actual</th><th>interface + DI</th></tr>
      <tr><td>Kiểm tra</td><td>Lúc biên dịch, đủ mọi target</td><td>Lúc chạy (quên đăng ký DI → lỗi runtime)</td></tr>
      <tr><td>Thay khi test</td><td>Khó (một actual cho mỗi target)</td><td>Dễ, truyền fake</td></tr>
      <tr><td>Cài đặt bằng Swift</td><td>Không</td><td>Được</td></tr>
      <tr><td>Hợp với</td><td>Hàm nhỏ, không trạng thái; factory (driver DB, HttpClient engine)</td><td>Dịch vụ có trạng thái, cần mock, cần context (Keychain, analytics, push)</td></tr>
    </table>

    <p><strong>Góc Spring</strong>: expect/actual giống một "bean bắt buộc có đúng một cài đặt cho mỗi profile" nhưng được kiểm tra ngay khi compile. Interface + DI thì y như <code>@Bean</code> quen thuộc.</p>

    <div class="callout"><p>💡 Quy tắc thực dụng: dùng <strong>expect fun</strong> cho vài hàm tiện ích và factory; dùng <strong>interface</strong> cho mọi thứ lớn hơn.
    Tránh <code>expect class</code> lớn — nó ép mọi nền tảng có cùng constructor và thành viên, khó test, và vẫn Beta.</p></div>
  `,

  codeTabs: [
    { id: "expect", label: "commonMain (expect)", lines: [
      "// commonMain/Platform.kt",
      "expect fun platformName(): String",
      "",
      "expect fun randomId(): String",
      "",
      "// dùng như hàm bình thường trong code chung",
      "fun greeting(): String = \"Xin chào từ \" + platformName()"
    ]},
    { id: "actual", label: "actual Android & iOS", lines: [
      "// androidMain/Platform.android.kt",
      "actual fun platformName(): String = \"Android \" + android.os.Build.VERSION.SDK_INT",
      "actual fun randomId(): String = java.util.UUID.randomUUID().toString()",
      "",
      "// iosMain/Platform.ios.kt",
      "import platform.UIKit.UIDevice",
      "import platform.Foundation.NSUUID",
      "actual fun platformName(): String =",
      "    UIDevice.currentDevice.systemName + \" \" + UIDevice.currentDevice.systemVersion",
      "actual fun randomId(): String = NSUUID().UUIDString"
    ]},
    { id: "iface", label: "Interface + DI", lines: [
      "// commonMain",
      "interface SecureStorage {",
      "    fun put(key: String, value: String)",
      "    fun get(key: String): String?",
      "}",
      "class AuthRepository(private val storage: SecureStorage) {",
      "    fun saveToken(t: String) = storage.put(\"access_token\", t)",
      "}",
      "",
      "// iOS: cài đặt bằng Swift, truyền vào Kotlin lúc khởi tạo",
      "// class KeychainStorage: SecureStorage { func put(key: String, value: String) {...} }",
      "",
      "// commonTest",
      "class FakeStorage : SecureStorage {",
      "    val map = mutableMapOf<String, String>()",
      "    override fun put(key: String, value: String) { map[key] = value }",
      "    override fun get(key: String) = map[key]",
      "}"
    ]},
    { id: "alias", label: "actual typealias", lines: [
      "// commonMain",
      "expect class AtomicCounter() {       // expect class: Beta",
      "    fun incrementAndGet(): Int",
      "}",
      "",
      "// androidMain — trỏ thẳng vào class JDK có sẵn",
      "actual typealias AtomicCounter = java.util.concurrent.atomic.AtomicInteger",
      "",
      "// Thực tế: dùng kotlin.concurrent.atomics hoặc atomicfu thay vì tự viết",
      "# build.gradle.kts: compilerOptions { freeCompilerArgs.add(\"-Xexpect-actual-classes\") }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="e"><div class="nl">commonMain: expect fun platformName()</div><div class="ns">chỉ chữ ký</div></div>
    <div class="row">
      <div class="node" id="aa"><div class="nl">androidMain: actual</div><div class="ns">Build.VERSION</div></div>
      <div class="node" id="ai"><div class="nl">iosMain: actual</div><div class="ns">UIDevice</div></div>
    </div>
    <div class="arrow" id="chk">↓ compiler kiểm tra: đủ actual cho mọi target?</div>
    <div class="node" id="i"><div class="nl">Hoặc: interface SecureStorage</div><div class="ns">cài đặt Kotlin/Swift, nối bằng DI, fake khi test</div></div>
  `,
  steps: [
    { title: "1 · Khai báo expect", tab: "expect", highlight: [2, 4, 7], on: ["e"],
      desc: "Code chung gọi <code>platformName()</code> như bình thường. Không cần biết nền tảng nào." },
    { title: "2 · Cài đặt actual", tab: "actual", highlight: [2, 3, 8, 9, 10], on: ["aa", "ai"],
      desc: "Mỗi nền tảng một actual, cùng chữ ký. Android dùng JDK UUID, iOS dùng NSUUID. Đặt ở iosMain là đủ cho mọi target iOS." },
    { title: "3 · Kiểm tra lúc biên dịch", tab: "expect", highlight: [2], on: ["chk"],
      desc: "Thêm target mới (vd jvm) mà quên actual → build lỗi ngay. Đây là điểm mạnh so với DI." },
    { title: "4 · Interface cho dịch vụ lớn", tab: "iface", highlight: [2, 3, 4, 6, 11], on: ["i"],
      desc: "Keychain trên iOS có thể cài bằng Swift rồi truyền vào. Repository không biết gì về nền tảng." },
    { title: "5 · Dễ test", tab: "iface", highlight: [14, 15, 16, 17], on: ["i"],
      desc: "commonTest dùng FakeStorage. Với expect/actual bạn không thay được cài đặt trong test." },
    { title: "6 · actual typealias", tab: "alias", highlight: [2, 7, 10], on: ["aa"],
      desc: "Khi nền tảng đã có sẵn class đúng hình dạng, typealias trỏ thẳng vào nó. expect class vẫn Beta nên cần cờ compiler." }
  ],

  quiz: [
    { q: "Khi thêm target mới nhưng quên viết actual, chuyện gì xảy ra?", options: [
        "Crash lúc chạy", "Lỗi biên dịch", "Trả về null", "Dùng cài đặt Android"
      ], correct: 1, explanation: "expect/actual được kiểm tra đầy đủ lúc build." },
    { q: "Một actual đặt trong iosMain có áp dụng cho iosArm64 và iosSimulatorArm64 không?", options: [
        "Không, phải viết riêng từng target",
        "Có — source set trung gian iosMain dùng chung cho các target iOS",
        "Chỉ cho simulator",
        "Chỉ cho thiết bị thật"
      ], correct: 1, explanation: "Đây là lợi ích của hierarchy." },
    { q: "Trạng thái của expect/actual cho class hiện nay là?", options: [
        "Stable hoàn toàn", "Beta — có cảnh báo, tắt bằng -Xexpect-actual-classes", "Đã bị xoá", "Chỉ dùng cho Android"
      ], correct: 1, explanation: "expect fun/property thì ổn định." },
    { q: "Dịch vụ lưu token vào Keychain nên thiết kế thế nào?", options: [
        "expect class lớn",
        "Interface trong common, cài đặt theo nền tảng (có thể bằng Swift), nối qua DI",
        "Hard-code trong commonMain",
        "Dùng java.security"
      ], correct: 1, explanation: "Dễ test và cho phép cài bằng Swift." },
    { q: "Ưu điểm lớn nhất của interface + DI so với expect/actual?", options: [
        "Nhanh hơn lúc chạy",
        "Thay được bằng fake khi test và cài đặt được bằng Swift",
        "Không cần Gradle",
        "Được kiểm tra lúc biên dịch"
      ], correct: 1, explanation: "Đổi lại, quên đăng ký thì lỗi lúc chạy." },
    { q: "actual typealias dùng khi nào?", options: [
        "Khi muốn đổi tên package",
        "Khi nền tảng đã có kiểu sẵn khớp với khai báo expect, trỏ thẳng vào nó",
        "Khi viết test",
        "Khi dùng Swift"
      ], correct: 1, explanation: "Ví dụ trỏ tới một class JDK trên Android." },
    { q: "expect fun có thân hàm trong commonMain không?", options: [
        "Có", "Không — chỉ chữ ký; thân nằm ở actual", "Tuỳ", "Có nếu là inline"
      ], correct: 1, explanation: "expect chỉ là lời hứa." },
    { q: "Trường hợp nào hợp với expect fun nhất?", options: [
        "Dịch vụ thanh toán nhiều trạng thái",
        "Factory nhỏ như tạo SQLite driver hoặc HttpClient engine",
        "Toàn bộ repository",
        "ViewModel"
      ], correct: 1, explanation: "Nhỏ, không trạng thái, ít cần mock." },
    { q: "iosMain dùng NSUUID được vì sao?", options: [
        "Vì có JDK trên iOS",
        "Vì Kotlin/Native cung cấp binding Foundation qua platform.Foundation",
        "Vì Swift tự dịch",
        "Không dùng được"
      ], correct: 1, explanation: "Các binding platform.* sinh từ header Objective-C." }
  ]
});
