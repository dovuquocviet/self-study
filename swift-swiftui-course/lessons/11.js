window.LESSONS.push({
  id: "11",
  phase: "1", phaseName: "Concurrency hiện đại",
  title: "actor, @MainActor, Sendable: data race bị chặn lúc biên dịch",
  subtitle: "Actor thay synchronized · reentrancy qua await · UI trên MainActor · Swift 6 strict concurrency",

  theory: `
    <p>Java chống data race bằng kỷ luật: <code>synchronized</code>, <code>ConcurrentHashMap</code>, <code>volatile</code>… Quên một chỗ thì compiler không nói gì. Swift 6 (language mode 6) biến <strong>data race thành lỗi biên dịch</strong>, dựa trên ba khái niệm:</p>

    <p><strong>1. actor</strong> — một reference type (như class) nhưng trạng thái bên trong chỉ được truy cập <em>tuần tự</em>. Mỗi actor có một "hộp thư" (serial executor): lời gọi từ ngoài phải <code>await</code> và được xử lý lần lượt. Giống một object mà mọi method đều <code>synchronized</code> — nhưng <strong>không khoá luồng</strong>: người gọi treo (nhả luồng) thay vì chặn.</p>
    <ul>
      <li>Bên trong actor, truy cập property trực tiếp, không <code>await</code>.</li>
      <li><strong>Reentrancy</strong>: khi method của actor <code>await</code>, actor có thể xử lý lời gọi khác trong lúc chờ. Nên <strong>đừng giả định trạng thái không đổi qua await</strong> — kiểm tra lại sau await, hoặc cập nhật trạng thái trước khi await.</li>
      <li><code>nonisolated</code> đánh dấu method không chạm trạng thái được bảo vệ → gọi đồng bộ được.</li>
    </ul>

    <p><strong>2. @MainActor</strong> — actor toàn cục đại diện cho main thread. UIKit/SwiftUI chỉ được cập nhật trên main thread; đánh dấu <code>@MainActor</code> cho class/func thì compiler đảm bảo điều đó (thay cho <code>DispatchQueue.main.async</code> thủ công). <code>View</code> của SwiftUI được cô lập trên MainActor; ViewModel cũng nên <code>@MainActor</code>. Gọi code MainActor từ nơi khác phải <code>await</code> (hoặc <code>await MainActor.run { }</code>).</p>

    <p><strong>3. Sendable</strong> — đánh dấu kiểu <strong>an toàn khi chuyển qua ranh giới cô lập</strong> (giữa các actor/task).</p>
    <ul>
      <li>struct/enum mà mọi field đều Sendable → Sendable (tự suy ra với kiểu không public).</li>
      <li>actor luôn Sendable. <code>final class</code> chỉ có <code>let</code> Sendable → khai báo được <code>Sendable</code>.</li>
      <li>class có <code>var</code> thường thì <strong>không</strong> Sendable — gửi nó sang task khác là lỗi biên dịch trong Swift 6. <code>@unchecked Sendable</code> = "tôi tự khoá bằng lock, tin tôi" — lối thoát cuối cùng.</li>
      <li>Closure truyền cho <code>Task {}</code> hay <code>addTask</code> phải là <code>@Sendable</code>/<code>sending</code>: chỉ capture thứ an toàn.</li>
    </ul>

    <p><strong>Swift 6.2 — "approachable concurrency"</strong>: nhiều lỗi Sendable của app đơn giản đến từ việc code bị đẩy ra khỏi main thread ngoài ý muốn. Swift 6.2 cho phép đặt <strong>isolation mặc định là MainActor</strong> cho cả module (Xcode: Build Setting "Default Actor Isolation"; SPM: <code>.defaultIsolation(MainActor.self)</code>), và hàm <code>async</code> nonisolated mặc định chạy trên actor của người gọi (khi bật chế độ approachable concurrency); muốn chủ động đẩy việc nặng ra pool thì đánh dấu <code>@concurrent</code>. Project mới trong Xcode 26 bật sẵn các thiết lập này.</p>

    <div class="callout"><p>💡 Tư duy: mỗi mẩu trạng thái có thể thay đổi phải có "chủ" — một actor (hoặc MainActor). Dữ liệu đi giữa các chủ phải là giá trị Sendable (thường là struct). Rust dùng đúng ý tưởng này với trait <code>Send</code>/<code>Sync</code>.</p></div>
  `,

  codeTabs: [
    { id: "actor", label: "actor", lines: [
      "actor TokenStore {",
      "    private var token: String?",
      "    private var refreshTask: Task<String, Error>?",
      "",
      "    func validToken() async throws -> String {",
      "        if let token { return token }",
      "        if let refreshTask { return try await refreshTask.value }  // gộp request",
      "        let task = Task { try await api.refresh() }",
      "        refreshTask = task            // cập nhật TRƯỚC khi await (reentrancy)",
      "        defer { refreshTask = nil }",
      "        let t = try await task.value",
      "        token = t",
      "        return t",
      "    }",
      "}",
      "let t = try await store.validToken()   // từ ngoài: phải await"
    ]},
    { id: "main", label: "@MainActor", lines: [
      "@MainActor",
      "@Observable",
      "final class CartViewModel {",
      "    var items: [CartItem] = []",
      "    var isLoading = false",
      "",
      "    func load() async {",
      "        isLoading = true                     // chắc chắn trên main thread",
      "        let fetched = try? await api.cart()  // treo, main thread rảnh để vẽ UI",
      "        items = fetched ?? []                // quay lại MainActor",
      "        isLoading = false",
      "    }",
      "}"
    ]},
    { id: "sendable", label: "Sendable", lines: [
      "struct CartItem: Sendable { let sku: String; var qty: Int }   // OK",
      "",
      "final class Config: Sendable {                                // OK: final + chỉ let",
      "    let baseURL: URL; init(baseURL: URL) { self.baseURL = baseURL }",
      "}",
      "",
      "final class Counter { var value = 0 }                         // không Sendable",
      "let c = Counter()",
      "Task.detached { c.value += 1 }",
      "// ❌ Swift 6: capture of non-Sendable 'c' in @Sendable closure → data race",
      "",
      "final class LegacyCache: @unchecked Sendable {                // tự khoá bằng lock",
      "    private let lock = NSLock(); private var dict: [String: Data] = [:]",
      "}"
    ]},
    { id: "java", label: "So với Java", lines: [
      "public class TokenStore {",
      "    private String token;",
      "    public synchronized String validToken() throws IOException {",
      "        if (token == null) token = api.refresh();   // chặn luồng khi refresh",
      "        return token;",
      "    }",
      "}",
      "// Quên synchronized ở 1 method → race, compiler không báo",
      "// Cập nhật UI Android/Swing từ thread nền → crash lúc chạy, không phải lúc build"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="t1"><div class="nl">Task A</div><div class="ns">await store.validToken()</div></div>
      <div class="node" id="t2"><div class="nl">Task B</div><div class="ns">await store.validToken()</div></div>
    </div>
    <div class="arrow" id="a1">↓ xếp hàng vào hộp thư actor (không chặn luồng)</div>
    <div class="node" id="act"><div class="nl">actor TokenStore</div><div class="ns">xử lý từng lời gọi; qua await có thể xen kẽ</div></div>
    <div class="arrow" id="a2">↓ trả String (Sendable)</div>
    <div class="node" id="main"><div class="nl">@MainActor ViewModel</div><div class="ns">cập nhật state UI trên main thread</div></div>
  `,
  steps: [
    { title: "1 · actor bảo vệ trạng thái", tab: "actor", highlight: [1, 2, 3, 16], on: ["t1", "t2", "a1", "act"],
      desc: "Chỉ code trong actor chạm được <code>token</code>. Từ ngoài phải <code>await</code> — người gọi treo, không chặn luồng." },
    { title: "2 · Reentrancy", tab: "actor", highlight: [7, 8, 9, 11], on: ["act"],
      desc: "Trong lúc await ở dòng 11, Task B có thể vào actor. Vì <code>refreshTask</code> đã được gán trước await, B sẽ dùng chung task thay vì refresh lần hai." },
    { title: "3 · @MainActor cho UI", tab: "main", highlight: [1, 7, 8, 9, 10], on: ["a2", "main"],
      desc: "Compiler đảm bảo mọi truy cập <code>items</code> diễn ra trên main thread. Await ở dòng 9 không chặn UI." },
    { title: "4 · Sendable", tab: "sendable", highlight: [1, 3, 7, 9, 10], on: ["a2"],
      desc: "Struct toàn field Sendable là Sendable. Class có var không được gửi sang task khác — lỗi biên dịch ở Swift 6." },
    { title: "5 · Lối thoát @unchecked", tab: "sendable", highlight: [12, 13], on: ["act"],
      desc: "Khi bạn tự đồng bộ bằng lock (code cũ). Compiler không kiểm tra nữa — trách nhiệm là của bạn." },
    { title: "6 · Java: kỷ luật, không kiểm chứng", tab: "java", highlight: [3, 4, 8, 9], on: ["t1"],
      desc: "<code>synchronized</code> chặn luồng; quên là race; sai luồng UI chỉ lộ ra lúc chạy." }
  ],

  quiz: [
    { q: "Gọi method của actor từ bên ngoài cần gì?", options: [
        "Không cần gì", "await — vì có thể phải chờ tới lượt", "synchronized", "DispatchQueue.main"
      ], correct: 1, explanation: "Lời gọi xuyên ranh giới cô lập là bất đồng bộ." },
    { q: "Actor khác synchronized của Java ở điểm chính nào?", options: [
        "Không khác",
        "Người gọi treo (nhả luồng) thay vì chặn luồng chờ lock",
        "Actor chạy song song các method",
        "Actor chỉ dùng cho UI"
      ], correct: 1, explanation: "Không có lock chặn luồng; dùng hàng đợi + suspension." },
    { q: "Actor reentrancy nghĩa là gì?", options: [
        "Actor có thể gọi chính nó",
        "Khi method của actor await, actor có thể xử lý lời gọi khác; trạng thái có thể đổi qua await",
        "Actor chạy lại khi lỗi",
        "Actor không bao giờ bị treo"
      ], correct: 1, explanation: "Kiểm tra lại giả định sau mỗi await." },
    { q: "@MainActor trên một class ViewModel đảm bảo gì?", options: [
        "Chạy nhanh hơn",
        "Mọi truy cập state/method của nó diễn ra trên main thread, compiler kiểm tra",
        "Chạy trên thread nền",
        "Tự động Sendable cho mọi thứ bên trong nó được gửi đi"
      ], correct: 1, explanation: "Thay DispatchQueue.main.async thủ công." },
    { q: "struct CartItem { let sku: String; var qty: Int } có Sendable không?", options: [
        "Không bao giờ", "Có — value type với mọi field Sendable", "Chỉ khi là class", "Chỉ khi mọi field là let"
      ], correct: 1, explanation: "var trong struct không phá Sendable vì mỗi bên có bản sao riêng." },
    { q: "final class Counter { var value = 0 } gửi vào Task.detached trong Swift 6 mode?", options: [
        "OK", "Lỗi biên dịch: capture non-Sendable, có thể data race", "Crash lúc chạy", "Chỉ cảnh báo trong mọi chế độ"
      ], correct: 1, explanation: "Class có trạng thái đổi được không an toàn khi chia sẻ giữa các task." },
    { q: "@unchecked Sendable dùng khi nào?", options: [
        "Mọi class",
        "Kiểu tự đồng bộ bằng lock/queue mà compiler không chứng minh được — bạn chịu trách nhiệm",
        "Để tăng tốc",
        "Cho struct"
      ], correct: 1, explanation: "Là lối thoát, nên hạn chế." },
    { q: "Swift 6.2 'Default Actor Isolation = MainActor' làm gì?", options: [
        "Cấm dùng actor",
        "Coi code trong module là @MainActor mặc định trừ khi đánh dấu khác, giảm lỗi Sendable cho app",
        "Chạy mọi thứ trên thread nền",
        "Tắt kiểm tra concurrency"
      ], correct: 1, explanation: "Hợp với app mà phần lớn code là UI; việc nặng tách ra bằng @concurrent/nonisolated." },
    { q: "Thuộc tính @concurrent (Swift 6.2) dùng để?", options: [
        "Khoá hàm",
        "Chủ động cho hàm async chạy trên concurrent thread pool thay vì actor của người gọi",
        "Đánh dấu Sendable",
        "Tạo actor"
      ], correct: 1, explanation: "Dùng cho việc nặng CPU như decode ảnh lớn." },
    { q: "Khái niệm Rust tương ứng với Sendable của Swift?", options: [
        "Clone", "Send / Sync", "Drop", "Copy"
      ], correct: 1, explanation: "Cùng ý tưởng: đánh dấu kiểu an toàn khi chuyển/chia sẻ giữa luồng." }
  ]
});
