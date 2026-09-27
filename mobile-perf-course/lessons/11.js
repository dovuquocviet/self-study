window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Giao diện mượt",
  title: "Re-render thừa: React, Compose recomposition, SwiftUI body",
  subtitle: "Vì sao component render lại · React.memo & tham chiếu ổn định · selector · React Compiler · stability trong Compose",

  theory: `
    <p>Cả ba framework UI hiện đại (React, Jetpack Compose, SwiftUI) đều <strong>khai báo</strong>: bạn mô tả UI theo state, framework tự tính lại khi state đổi.
    Tiện, nhưng nếu phạm vi "tính lại" quá rộng, bạn trả tiền cho những việc không cần.</p>

    <p><strong>React: component render lại khi</strong></p>
    <ol>
      <li>State của chính nó đổi (<code>useState</code>, <code>useReducer</code>).</li>
      <li><strong>Parent render lại</strong> — mặc định mọi con đều render lại, dù props không đổi.</li>
      <li>Context mà nó dùng đổi giá trị.</li>
      <li>Store (Redux/Zustand) báo selector trả về giá trị <em>khác tham chiếu</em>.</li>
    </ol>

    <p><strong>Bẫy tham chiếu</strong>: <code>{}</code>, <code>[]</code>, <code>() =&gt; {}</code> viết inline tạo đối tượng mới mỗi lần render → so sánh nông (<code>Object.is</code>) luôn thấy "đổi".
    Vì vậy <code>React.memo</code> vô dụng nếu bạn truyền <code>style={{...}}</code> hoặc <code>onPress={() =&gt; ...}</code> mới mỗi lần.</p>

    <table>
      <tr><th>Vấn đề</th><th>Cách sửa</th></tr>
      <tr><td>Con render lại vì parent</td><td><code>React.memo(Child)</code> + props ổn định</td></tr>
      <tr><td>Callback mới mỗi lần</td><td><code>useCallback</code></td></tr>
      <tr><td>Object/array tính mới mỗi lần</td><td><code>useMemo</code> hoặc đưa ra ngoài component nếu là hằng</td></tr>
      <tr><td>State đặt quá cao (ô search ở màn cha)</td><td>Đưa state xuống component con dùng nó (<em>colocate</em>)</td></tr>
      <tr><td>Một context chứa cả user, cart, theme</td><td>Tách context; hoặc dùng store có selector</td></tr>
      <tr><td>Selector trả object mới</td><td>Chọn giá trị nguyên thuỷ, hoặc so sánh <code>shallowEqual</code></td></tr>
    </table>

    <p><strong>React Compiler</strong> (bản 1.0 ổn định từ 10/2025) tự chèn memo hoá lúc build, giảm nhu cầu viết tay <code>useMemo/useCallback</code>. Vẫn cần hiểu cơ chế để đọc profiler và xử lý chỗ compiler bỏ qua.</p>

    <p><strong>Tương đương phía native</strong></p>
    <ul>
      <li><strong>Compose</strong>: composable bị <em>skip</em> khi tham số không đổi và kiểu tham số <em>stable</em>. <code>List</code> của Kotlin bị coi là không ổn định (có thể là MutableList bên dưới);
      từ Kotlin 2.0.20 chế độ <em>strong skipping</em> mặc định bật giúp skip cả với tham số không ổn định (so sánh bằng tham chiếu). Xem số lần recompose bằng Layout Inspector.</li>
      <li><strong>SwiftUI</strong>: <code>body</code> được đánh giá lại khi dữ liệu mà view đọc thay đổi. Với <code>ObservableObject</code>, mọi <code>@Published</code> đổi làm <em>mọi</em> view quan sát object đó tính lại;
      macro <code>@Observable</code> (iOS 17) chỉ theo dõi thuộc tính mà <code>body</code> thực sự đọc.</li>
    </ul>

    <div class="callout"><p>💡 Đừng memo mọi thứ "cho chắc": memo có chi phí so sánh và bộ nhớ. Dùng Profiler (bài 07) tìm component render nhiều <em>và</em> tốn, rồi mới sửa.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "① Trước", lines: [
      "function ProductListScreen({ products }) {",
      "  const [query, setQuery] = useState('');",
      "  return (",
      "    <View>",
      "      <SearchBar value={query} onChange={setQuery} />",
      "      {products.map(p => (",
      "        <ProductCard",
      "          key={p.id}",
      "          product={p}",
      "          style={{ margin: 8 }}                 // object mới mỗi render",
      "          onPress={() => navigate('Detail', { id: p.id })}   // hàm mới",
      "        />",
      "      ))}",
      "    </View>",
      "  );",
      "}",
      "// Gõ 1 ký tự → 50 ProductCard render lại"
    ]},
    { id: "good", label: "② Sau", lines: [
      "const styles = StyleSheet.create({ card: { margin: 8 } });   // hằng, ngoài component",
      "",
      "const ProductCard = React.memo(function ProductCard({ product, onPress }) {",
      "  return <Pressable onPress={() => onPress(product.id)} style={styles.card}>...</Pressable>;",
      "});",
      "",
      "function ProductListScreen({ products }) {",
      "  const openDetail = useCallback(id => navigate('Detail', { id }), []);",
      "  return (",
      "    <View>",
      "      <SearchBox />                     {/* state query nằm trong SearchBox */}",
      "      {products.map(p => <ProductCard key={p.id} product={p} onPress={openDetail} />)}",
      "    </View>",
      "  );",
      "}"
    ]},
    { id: "store", label: "③ Context & selector", lines: [
      "// ✗ Một context to: đổi cart → mọi màn dùng AppContext render lại",
      "<AppContext.Provider value={{ user, cart, theme }}>",
      "",
      "// ✓ Tách: UserContext, CartContext, ThemeContext",
      "",
      "// Redux: ✗ selector trả object mới mỗi action",
      "const { count, total } = useSelector(s => ({ count: s.cart.count, total: s.cart.total }));",
      "// ✓ chọn giá trị nguyên thuỷ",
      "const count = useSelector(s => s.cart.count);",
      "// ✓ hoặc so sánh nông",
      "const summary = useSelector(s => ({ count: s.cart.count, total: s.cart.total }), shallowEqual);"
    ]},
    { id: "native", label: "④ Compose & SwiftUI", lines: [
      "// Compose: tham số stable → composable được skip khi không đổi",
      "@Immutable data class CardUi(val id: String, val title: String, val price: String)",
      "",
      "@Composable fun ProductCard(ui: CardUi, onClick: (String) -> Unit) { ... }",
      "",
      "// SwiftUI iOS 17+: chỉ theo dõi thuộc tính được đọc trong body",
      "@Observable final class CartModel { var count = 0; var items: [Item] = [] }",
      "",
      "struct CartBadge: View {",
      "    let model: CartModel",
      "    var body: some View { Text(\"\\(model.count)\") }   // items đổi không làm view này tính lại",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="st"><div class="nl">✏️ State đổi (gõ ô search)</div><div class="ns">query = 'a'</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="parent"><div class="nl">📄 ProductListScreen render</div><div class="ns">state đặt quá cao</div></div>
    <div class="arrow" id="a2">↓ props mới?</div>
    <div class="row">
      <div class="node" id="memo"><div class="nl">🛡️ React.memo so sánh nông</div><div class="ns">Object.is từng prop</div></div>
      <div class="node" id="kids"><div class="nl">🃏 50 ProductCard</div><div class="ns">render lại hay skip?</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="res"><div class="nl">⚡ Kết quả</div><div class="ns">48 ms → 2 ms mỗi lần gõ</div></div>
  `,
  steps: [
    { title: "1 · State đặt ở màn cha", tab: "bad", highlight: [2, 5], on: ["st", "a1", "parent"],
      desc: "query nằm ở ProductListScreen nên mỗi ký tự làm cả màn render lại." },
    { title: "2 · Props mới mỗi lần", tab: "bad", highlight: [10, 11, 17], on: ["a2", "kids"],
      desc: "style và onPress là đối tượng mới mỗi render → dù có React.memo, so sánh nông vẫn thấy khác." },
    { title: "3 · Ổn định tham chiếu + memo", tab: "good", highlight: [1, 3, 8, 12], on: ["memo", "kids"],
      desc: "Style tạo một lần, callback ổn định bằng useCallback, card bọc React.memo → card chỉ render khi product đổi." },
    { title: "4 · Colocate state", tab: "good", highlight: [11], on: ["st", "res", "a3"],
      desc: "Chuyển query vào SearchBox: gõ phím chỉ render SearchBox, danh sách không bị động tới." },
    { title: "5 · Context và selector", tab: "store", highlight: [2, 7, 9, 11], on: ["parent"],
      desc: "Selector trả object mới luôn khác tham chiếu → component render lại sau MỌI action." },
    { title: "6 · Cùng ý tưởng ở native", tab: "native", highlight: [2, 4, 7, 11], on: ["memo"],
      desc: "Compose skip composable khi tham số stable không đổi; @Observable chỉ theo dõi thuộc tính body thực sự đọc." }
  ],

  quiz: [
    { q: "Mặc định, khi component cha render lại, component con thế nào?", options: [
        "Không render lại",
        "Render lại, dù props không đổi (trừ khi được memo và props ổn định)",
        "Bị unmount",
        "Chỉ render nếu có key"
      ], correct: 1, explanation: "Đó là hành vi mặc định của React." },
    { q: "Vì sao React.memo không có tác dụng khi truyền style={{ margin: 8 }}?", options: [
        "Vì memo không hỗ trợ style",
        "Vì object literal tạo mới mỗi render, so sánh nông luôn thấy khác",
        "Vì StyleSheet bị cấm",
        "Vì margin quá nhỏ"
      ], correct: 1, explanation: "Đưa style ra ngoài component hoặc StyleSheet.create." },
    { q: "'Colocate state' nghĩa là gì?", options: [
        "Lưu state lên server",
        "Đặt state ở component thấp nhất thực sự dùng nó để thay đổi không lan rộng",
        "Gộp mọi state vào một context",
        "Dùng Redux cho mọi state"
      ], correct: 1, explanation: "Giảm phạm vi render lại." },
    { q: "useSelector(s => ({ a: s.a, b: s.b })) không kèm hàm so sánh gây ra vấn đề gì?", options: [
        "Không lấy được dữ liệu",
        "Trả object mới mỗi lần → component render lại sau mọi action",
        "Crash",
        "Chậm reducer"
      ], correct: 1, explanation: "Dùng shallowEqual hoặc chọn từng giá trị nguyên thuỷ." },
    { q: "React Compiler giúp gì?", options: [
        "Biên dịch JS sang native",
        "Tự động chèn memo hoá lúc build, giảm viết tay useMemo/useCallback",
        "Thay Hermes",
        "Giảm bundle size về 0"
      ], correct: 1, explanation: "Vẫn cần hiểu cơ chế để đọc profiler." },
    { q: "Một context chứa { user, cart, theme }. Đổi cart thì sao?", options: [
        "Chỉ component dùng cart render lại",
        "Mọi component dùng context đó render lại, kể cả chỉ đọc theme",
        "Không ai render lại",
        "Chỉ Provider render lại"
      ], correct: 1, explanation: "Context không có selector; tách context hoặc dùng store." },
    { q: "Trong Compose, điều kiện nào giúp composable được skip?", options: [
        "Dùng var",
        "Tham số không đổi và (theo quy tắc cũ) có kiểu stable; strong skipping mở rộng cho cả kiểu không ổn định",
        "Có @Preview",
        "Không bao giờ skip"
      ], correct: 1, explanation: "Strong skipping mặc định từ Kotlin 2.0.20." },
    { q: "@Observable (iOS 17) khác ObservableObject ở điểm nào về hiệu năng?", options: [
        "Không khác",
        "@Observable chỉ làm view tính lại khi thuộc tính mà body đọc thay đổi; ObservableObject báo mọi thay đổi @Published",
        "@Observable chậm hơn",
        "@Observable chỉ dùng cho UIKit"
      ], correct: 1, explanation: "Theo dõi ở mức thuộc tính." },
    { q: "Nên áp dụng memo hoá thế nào?", options: [
        "Bọc mọi component và mọi giá trị",
        "Dựa trên profiler: component render nhiều và tốn mới đáng tối ưu",
        "Không bao giờ dùng",
        "Chỉ dùng cho component gốc"
      ], correct: 1, explanation: "Memo có chi phí; tối ưu theo số liệu." }
  ]
});
