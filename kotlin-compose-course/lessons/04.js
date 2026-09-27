window.LESSONS.push({
  id: "04",
  phase: "0", phaseName: "Kotlin cho dev Java",
  title: "sealed class, enum & when đầy đủ nhánh",
  subtitle: "Mô hình hoá trạng thái đóng: Loading/Success/Error · exhaustive when · value class",

  theory: `
    <p>Rất nhiều bug đến từ trạng thái "không thể xảy ra" mà vẫn xảy ra: <code>loading=false, data=null, error=null</code>. Kotlin cho công cụ để
    <strong>làm trạng thái sai không biểu diễn được</strong>.</p>

    <p><strong>sealed class / sealed interface</strong>: tập các lớp con <em>đóng</em> — mọi lớp con trực tiếp phải nằm trong cùng module và cùng package
    (thực tế thường cùng file). Compiler biết hết các lớp con, nên:</p>
    <ul>
      <li><code>when</code> dùng như biểu thức trên kiểu sealed phải <strong>đủ nhánh</strong>, không cần <code>else</code>.</li>
      <li>Thêm lớp con mới → mọi <code>when</code> thiếu nhánh báo <strong>lỗi compile</strong>. Đây là giá trị lớn nhất: compiler chỉ ra mọi chỗ cần sửa.</li>
      <li>Kết hợp smart cast: trong nhánh <code>is Success -&gt;</code>, biến đã có kiểu Success, đọc <code>.data</code> trực tiếp.</li>
    </ul>

    <p>So với Java: Java 17 có <code>sealed interface ... permits</code> và Java 21 có pattern matching switch — ý tưởng giống hệt. Nếu bạn chưa dùng ở Java, đây là lúc làm quen.</p>

    <table>
      <tr><th>Công cụ</th><th>Khi nào</th><th>Ví dụ</th></tr>
      <tr><td><code>enum class</code></td><td>Tập giá trị cố định, <em>không mang dữ liệu riêng từng lần</em></td><td>OrderStatus: NEW, PAID, SHIPPED</td></tr>
      <tr><td><code>sealed interface</code></td><td>Mỗi trường hợp mang dữ liệu khác nhau</td><td>UiState: Loading / Success(items) / Error(msg)</td></tr>
      <tr><td><code>data object</code></td><td>Trường hợp không có dữ liệu trong sealed (có toString đẹp)</td><td><code>data object Loading : UiState</code></td></tr>
      <tr><td><code>@JvmInline value class</code></td><td>Bọc một giá trị để có kiểu riêng, gần như không tốn object</td><td><code>value class OrderId(val raw: Long)</code></td></tr>
    </table>

    <p><strong>value class</strong>: ngăn nhầm <code>userId</code> với <code>orderId</code> (cùng Long). Ở runtime, compiler thường thay bằng giá trị bên trong (không cấp phát),
    chỉ box khi dùng như generic/nullable/interface. Tên hàm nhận value class bị "mangle" (thêm hậu tố) nên gọi từ Java hơi bất tiện.</p>

    <div class="callout"><p>💡 Mẫu <code>sealed interface UiState</code> sẽ xuất hiện lại ở ViewModel (bài 20–21): màn hình render theo <code>when (state)</code>,
    và compiler đảm bảo bạn không quên trạng thái Error.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "① Trạng thái lỏng lẻo", lines: [
      "data class ScreenState(",
      "    val loading: Boolean = false,",
      "    val items: List<Product>? = null,",
      "    val error: String? = null",
      ")",
      "// loading=true VÀ error=\"x\" cùng lúc? items=null nhưng loading=false?",
      "// 2 x 2 x 2 = 8 tổ hợp, chỉ 3 cái có nghĩa"
    ]},
    { id: "sealed", label: "② sealed interface", lines: [
      "sealed interface ProductsUiState {",
      "    data object Loading : ProductsUiState",
      "    data class Success(val items: List<Product>) : ProductsUiState",
      "    data class Error(val message: String, val canRetry: Boolean) : ProductsUiState",
      "}",
      "",
      "fun title(s: ProductsUiState): String = when (s) {",
      "    ProductsUiState.Loading -> \"Đang tải...\"",
      "    is ProductsUiState.Success -> \"${s.items.size} sản phẩm\"   // smart cast",
      "    is ProductsUiState.Error -> \"Lỗi: \" + s.message",
      "}   // không cần else"
    ]},
    { id: "add", label: "③ Thêm trường hợp mới", lines: [
      "sealed interface ProductsUiState {",
      "    data object Loading : ProductsUiState",
      "    data object Empty : ProductsUiState          // ➕ mới thêm",
      "    data class Success(val items: List<Product>) : ProductsUiState",
      "    data class Error(val message: String, val canRetry: Boolean) : ProductsUiState",
      "}",
      "",
      "// ❌ compile error ở MỌI when thiếu nhánh:",
      "// 'when' expression must be exhaustive, add necessary 'Empty' branch or 'else' branch instead"
    ]},
    { id: "enum", label: "④ enum & value class", lines: [
      "enum class OrderStatus(val label: String) {",
      "    NEW(\"Mới\"), PAID(\"Đã trả\"), SHIPPED(\"Đang giao\");",
      "    fun canCancel() = this == NEW || this == PAID",
      "}",
      "val s = OrderStatus.valueOf(\"PAID\")      // entries / valueOf như Java",
      "",
      "@JvmInline value class OrderId(val raw: Long)",
      "@JvmInline value class UserId(val raw: Long)",
      "",
      "fun cancel(order: OrderId, by: UserId) { }",
      "cancel(UserId(7), OrderId(99))   // ❌ lỗi compile — không còn truyền nhầm Long"
    ]}
  ],

  stageHtml: `
    <div class="node" id="state"><div class="nl">🧩 sealed interface ProductsUiState</div><div class="ns">tập lớp con đóng, compiler biết hết</div></div>
    <div class="row">
      <div class="node" id="loading"><div class="nl">⏳ Loading</div><div class="ns">data object</div></div>
      <div class="node" id="success"><div class="nl">✅ Success(items)</div><div class="ns">data class</div></div>
      <div class="node" id="error"><div class="nl">⚠️ Error(message)</div><div class="ns">data class</div></div>
      <div class="node" id="empty"><div class="nl">📭 Empty</div><div class="ns">thêm sau</div></div>
    </div>
    <div class="arrow" id="a1">↓ when (state) — phải đủ nhánh</div>
    <div class="node" id="ui"><div class="nl">🖥️ Render UI</div><div class="ns">thiếu nhánh = lỗi compile</div></div>
  `,
  steps: [
    { title: "1 · Vấn đề: boolean + nullable", tab: "bad", highlight: [2, 3, 4, 6, 7], on: ["state"],
      desc: "Ba field độc lập tạo 8 tổ hợp, phần lớn vô nghĩa. UI phải đoán ưu tiên cái nào." },
    { title: "2 · Mỗi trạng thái là một kiểu", tab: "sealed", highlight: [1, 2, 3, 4], on: ["loading", "success", "error"],
      desc: "Success mới có items, Error mới có message. Không thể vừa Loading vừa Error." },
    { title: "3 · when đủ nhánh + smart cast", tab: "sealed", highlight: [7, 8, 9, 10, 11], on: ["a1", "ui"],
      desc: "Trong nhánh <code>is Success</code>, s đã được smart cast nên đọc <code>s.items</code> trực tiếp." },
    { title: "4 · Thêm trạng thái: compiler dẫn đường", tab: "add", highlight: [3, 8, 9], on: ["empty", "a1"],
      desc: "Thêm <code>Empty</code> và compiler liệt kê mọi chỗ chưa xử lý. Nếu bạn lười viết <code>else -&gt;</code> thì mất lợi ích này." },
    { title: "5 · enum và value class", tab: "enum", highlight: [1, 3, 7, 8, 11], on: ["state"],
      desc: "enum cho tập giá trị cố định; value class cho ID có kiểu riêng mà gần như không tốn object." }
  ],

  quiz: [
    { q: "Lợi ích chính của sealed interface so với interface thường?", options: [
        "Chạy nhanh hơn", "Compiler biết toàn bộ lớp con nên kiểm tra when đủ nhánh", "Không cần constructor", "Tự sinh equals"
      ], correct: 1, explanation: "Tập lớp con đóng trong module/package." },
    { q: "Thêm lớp con mới vào sealed interface, when (không có else) ở nơi khác sẽ?", options: [
        "Chạy nhánh đầu tiên", "Lỗi compile đòi thêm nhánh", "Ném exception lúc runtime", "Bỏ qua"
      ], correct: 1, explanation: "Đây là cách compiler chỉ ra mọi chỗ cần cập nhật." },
    { q: "Vì sao nên tránh else -> trong when trên sealed type?", options: [
        "else chậm hơn", "else nuốt các trường hợp mới, compiler không cảnh báo nữa", "else bị cấm", "else làm mất smart cast"
      ], correct: 1, explanation: "Mất đi kiểm tra đủ nhánh khi mở rộng." },
    { q: "Khi nào chọn enum thay vì sealed?", options: [
        "Khi mỗi trường hợp mang dữ liệu khác nhau",
        "Khi là tập giá trị cố định, mỗi giá trị là một hằng duy nhất",
        "Khi cần kế thừa nhiều tầng",
        "Không bao giờ"
      ], correct: 1, explanation: "enum entry là singleton; sealed cho phép mỗi case có dữ liệu riêng mỗi lần tạo." },
    { q: "Trong nhánh is Success -> của when(s), đọc s.items được vì?", options: [
        "Reflection", "Smart cast: compiler biết s là Success trong nhánh đó", "items là property chung", "Phải ép kiểu tay"
      ], correct: 1, explanation: "Giống pattern matching của Java 21." },
    { q: "data object Loading khác object Loading ở điểm nào đáng kể?", options: [
        "data object có toString in ra 'Loading' và equals/hashCode hợp lý",
        "data object có thể có nhiều instance",
        "object không dùng được trong sealed",
        "Không khác gì"
      ], correct: 0, explanation: "object thường có toString dạng Loading@1a2b3c." },
    { q: "@JvmInline value class OrderId(val raw: Long) giải quyết vấn đề gì?", options: [
        "Tăng tốc DB", "Phân biệt kiểu giữa các ID cùng là Long, gần như không tốn cấp phát", "Mã hoá ID", "Tự sinh ID"
      ], correct: 1, explanation: "Truyền nhầm UserId vào chỗ OrderId thành lỗi compile." },
    { q: "Khi nào value class bị box thành object thật?", options: [
        "Không bao giờ", "Khi dùng như generic, nullable hoặc qua interface", "Luôn luôn", "Khi là val"
      ], correct: 1, explanation: "Các trường hợp này cần một tham chiếu object." },
    { q: "Mô hình (loading: Boolean, items: List?, error: String?) có vấn đề gì?", options: [
        "Tốn bộ nhớ", "Biểu diễn được nhiều tổ hợp vô nghĩa (vừa loading vừa error)", "Không serialize được", "Không dùng được với Compose"
      ], correct: 1, explanation: "sealed làm trạng thái sai không biểu diễn được." }
  ]
});
