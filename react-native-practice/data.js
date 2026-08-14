/* ============================================================================
 * data.js — Nội dung khoá THỰC HÀNH React Native.
 *
 * Mỗi bài:
 *   id, phase, phaseName, title
 *   kind      : "fix"  = cho code sai, tìm & sửa
 *               "fill" = cho code thiếu, viết bổ sung vào chỗ TODO
 *   objective : 1 câu mục tiêu
 *   brief     : HTML đề bài
 *   goal      : HTML mô tả kết quả mong đợi
 *   code      : code khởi đầu (KHÔNG được chứa dấu backtick)
 *   solution  : đáp án tham khảo
 *   hints[]   : gợi ý mở dần
 *   explain   : HTML giải thích sau khi xem đáp án
 *   checks[]  : { label, test } — `test` là THÂN của một async function chạy
 *               NGAY TRONG iframe sau khi app render xong. Trả về true = qua,
 *               false hoặc một chuỗi (thông báo lỗi) = trượt.
 *               Biến dùng được: text() q() qa() count() press() type() wait()
 *                               until() expect() logs src findByText()
 * ==========================================================================*/
window.EXERCISES = [

/* ================== PHASE 1 — CHẠY ĐƯỢC CÁI ĐÃ ================== */
{
  id: "01", phase: "1", phaseName: "Phase 1 · Chạy được cái đã",
  title: "Hai lỗi làm app không chạy",
  kind: "fix",
  objective: "Sửa 2 lỗi cơ bản nhất mà ai mới học React Native cũng dính.",
  brief: `
<p>File dưới đây <b>không chạy được</b>. Bấm ▶ Chạy &amp; Chấm trước đã — đọc thông báo lỗi
trong ô <b>Console &amp; Stack trace</b>, nó chỉ thẳng ra chỗ sai.</p>
<p>Có đúng <b>2 lỗi</b>:</p>
<ul>
  <li>Một lỗi <b>cú pháp</b> — Babel không biên dịch nổi.</li>
  <li>Một lỗi <b>thiếu khai báo</b> — biên dịch xong nhưng app không biết render cái gì.</li>
</ul>`,
  goal: `<p>Màn hình hiện 2 dòng chữ: <code>Xin chào React Native</code> và <code>Bài thực hành số 1</code>.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, StyleSheet } from 'react-native';

function App() {
  return (
    <Text style={styles.title}>Xin chào React Native</Text>
    <Text style={styles.sub}>Bài thực hành số 1</Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 20, fontWeight: '700', color: '#a78bfa' },
  sub: { color: '#94a3b8', marginTop: 6 },
});`,
  solution: `import { View, Text, StyleSheet } from 'react-native';

// Lỗi 1: JSX chỉ được trả về ĐÚNG MỘT phần tử gốc -> bọc cả 2 dòng vào <View>.
// Lỗi 2: thiếu "export default" -> runtime không biết component nào là app.
export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Xin chào React Native</Text>
      <Text style={styles.sub}>Bài thực hành số 1</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 20, fontWeight: '700', color: '#a78bfa' },
  sub: { color: '#94a3b8', marginTop: 6 },
});`,
  hints: [
    "Đọc dòng đầu trong Console: <code>Adjacent JSX elements must be wrapped in an enclosing tag</code> — hai thẻ &lt;Text&gt; đang là anh em ruột mà không có ai bọc.",
    "Có sẵn style tên <code>screen</code> trong StyleSheet nhưng chưa ai dùng. Đó chính là cái &lt;View&gt; bạn cần thêm.",
    "Lỗi còn lại: dòng <code>function App()</code> phải thành <code>export default function App()</code>."
  ],
  explain: `
<p><b>Vì sao chỉ được 1 phần tử gốc?</b> <code>return</code> của JavaScript chỉ trả về được một giá trị.
JSX biên dịch thành lời gọi tạo phần tử, nên hai thẻ đứng cạnh nhau = trả về hai giá trị → không hợp lệ.
Muốn không thêm &lt;View&gt; thừa thì dùng Fragment: <code>&lt;&gt; ... &lt;/&gt;</code>.</p>
<p><b>Vì sao cần export default?</b> Trong khoá này (và trong app thật) runtime đi tìm component mặc định
của file để render. Không export thì file chỉ là một đống code không ai gọi.</p>`,
  checks: [
    { label: "App chạy được và hiện dòng 'Xin chào React Native'",
      test: "return text().includes('Xin chào React Native') || 'Chưa thấy dòng chữ này trên màn hình';" },
    { label: "Hiện tiếp dòng 'Bài thực hành số 1'",
      test: "return text().includes('Bài thực hành số 1') || 'Dòng thứ hai bị mất — có thể bạn xoá nó thay vì bọc lại';" },
    { label: "Không còn lỗi đỏ nào trong Console",
      test: "var e = logs.filter(function(l){return l.level==='error'}); return e.length===0 || ('Vẫn còn lỗi: ' + e[0].text.split('\\n')[0]);" }
  ]
},

{
  id: "02", phase: "1", phaseName: "Phase 1 · Chạy được cái đã",
  title: "Props bị truyền sai kiểu dữ liệu",
  kind: "fix",
  objective: "Nhận ra bẫy kinh điển: truyền số dưới dạng chuỗi qua props.",
  brief: `
<p>Component <code>Price</code> nhận prop <code>amount</code> rồi cộng thêm 10% thuế.
App đang render 2 sản phẩm nhưng <b>một trong hai ra con số kỳ quặc</b>.</p>
<p>App vẫn chạy, không có lỗi đỏ — đây là loại bug khó chịu nhất: sai <b>âm thầm</b>.
Chạy thử, nhìn số trên màn hình rồi tìm ra chỗ sai.</p>`,
  goal: `<p>Áo thun: <code>110000 đ</code> — Quần jean: <code>275000 đ</code>.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, StyleSheet } from 'react-native';

function Price({ label, amount }) {
  const total = amount + amount * 0.1;   // cộng 10% thuế
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{total} đ</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Price label="Áo thun" amount="100000" />
      <Price label="Quần jean" amount={250000} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0f172a' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  label: { color: '#e2e8f0', fontSize: 15 },
  value: { color: '#a78bfa', fontSize: 18, fontWeight: '700', marginTop: 2 },
});`,
  solution: `import { View, Text, StyleSheet } from 'react-native';

function Price({ label, amount }) {
  const total = amount + amount * 0.1;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{total} đ</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      {/* amount={100000} -> dấu ngoặc nhọn nghĩa là "giá trị JS", ở đây là SỐ */}
      <Price label="Áo thun" amount={100000} />
      <Price label="Quần jean" amount={250000} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0f172a' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  label: { color: '#e2e8f0', fontSize: 15 },
  value: { color: '#a78bfa', fontSize: 18, fontWeight: '700', marginTop: 2 },
});`,
  hints: [
    "Nhìn con số của Áo thun: <code>10000010000</code>. Đó là dấu hiệu của phép <b>nối chuỗi</b>, không phải phép cộng.",
    "Trong JSX: <code>amount=\"100000\"</code> truyền một <b>chuỗi</b>, còn <code>amount={100000}</code> truyền một <b>số</b>.",
    "Sửa dòng <code>&lt;Price label=\"Áo thun\" amount=\"100000\" /&gt;</code>."
  ],
  explain: `
<p>JavaScript cho phép <code>"100000" + 10000</code> và trả về chuỗi <code>"10000010000"</code>
(toán tử <code>+</code> ưu tiên nối chuỗi khi có một vế là chuỗi), trong khi
<code>"100000" * 0.1</code> lại tự ép về số ra <code>10000</code>. Nửa nạc nửa mỡ như vậy nên bug rất khó thấy.</p>
<p><b>Quy tắc:</b> trong JSX, ngoặc kép truyền chuỗi, ngoặc nhọn truyền giá trị JS.
Chỉ có <code>label="Áo thun"</code> mới đúng là chuỗi.</p>`,
  checks: [
    { label: "Áo thun hiển thị 110000 đ",
      test: "return text().replace(/[.,\\s]/g,'').includes('110000') || 'Giá Áo thun đang là: ' + text().split('Áo thun')[1];" },
    { label: "Quần jean vẫn đúng 275000 đ",
      test: "return text().replace(/[.,\\s]/g,'').includes('275000') || 'Đừng đụng vào dòng Quần jean — nó vốn đã đúng';" },
    { label: "Không còn con số do nối chuỗi (10000010000)",
      test: "return !text().includes('10000010000') || 'Vẫn đang cộng chuỗi với số';" }
  ]
},

{
  id: "03", phase: "1", phaseName: "Phase 1 · Chạy được cái đã",
  title: "Viết component con nhận props",
  kind: "fill",
  objective: "Tự tay tách một mẩu UI thành component tái dùng được.",
  brief: `
<p>Màn hình cần 3 cái nhãn nhỏ (badge) khác nhau. Thay vì copy-paste 3 lần,
hãy viết <b>một component</b> rồi dùng lại 3 lần với props khác nhau.</p>
<p>Yêu cầu:</p>
<ol>
  <li>Viết component tên <code>Badge</code>, nhận 2 props: <code>label</code> (chữ) và <code>color</code> (màu nền).</li>
  <li><code>Badge</code> trả về một <code>&lt;View&gt;</code> bọc <code>&lt;Text&gt;</code> hiển thị <code>label</code>,
      màu nền của View lấy từ prop <code>color</code>.</li>
  <li>Trong <code>App</code>, dùng <code>Badge</code> đúng 3 lần: <code>NEW</code>, <code>SALE</code>, <code>HOT</code>.</li>
</ol>`,
  goal: `<p>Ba nhãn nằm ngang, 3 màu khác nhau, chữ NEW / SALE / HOT.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, StyleSheet } from 'react-native';

// TODO 1: viết component Badge({ label, color }) ở đây.
//   - trả về <View style={[styles.badge, { backgroundColor: color }]}>
//   - bên trong là <Text style={styles.badgeText}>{label}</Text>


export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Nhãn sản phẩm</Text>
      <View style={styles.row}>
        {/* TODO 2: dùng Badge 3 lần: NEW (#22c55e), SALE (#ef4444), HOT (#f59e0b) */}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 16, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#0b1020', fontWeight: '800', fontSize: 12 },
});`,
  solution: `import { View, Text, StyleSheet } from 'react-native';

// Component con: nhận props qua tham số, dùng destructuring cho gọn.
function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Nhãn sản phẩm</Text>
      <View style={styles.row}>
        <Badge label="NEW" color="#22c55e" />
        <Badge label="SALE" color="#ef4444" />
        <Badge label="HOT" color="#f59e0b" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 16, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#0b1020', fontWeight: '800', fontSize: 12 },
});`,
  hints: [
    "Khung sườn: <code>function Badge({ label, color }) { return ( ... ); }</code> — viết ở ngoài App, cùng cấp với App.",
    "Muốn trộn style tĩnh với style động thì truyền một mảng: <code>style={[styles.badge, { backgroundColor: color }]}</code>.",
    "Gọi component con y như một thẻ HTML: <code>&lt;Badge label=\"NEW\" color=\"#22c55e\" /&gt;</code>."
  ],
  explain: `
<p>Đây là toàn bộ tinh thần của React: UI = hàm nhận dữ liệu (props) trả về mô tả giao diện.
Ba badge khác nhau <b>không phải</b> ba đoạn code khác nhau, mà là <b>một</b> hàm gọi ba lần với đối số khác nhau.</p>
<p><code>style</code> nhận cả object lẫn mảng object; mảng sẽ được gộp từ trái sang phải,
phần tử sau đè phần tử trước — đúng như <code>Object.assign</code>.</p>`,
  checks: [
    { label: "Có khai báo component tên Badge",
      test: "return /(function\\s+Badge|(const|let|var)\\s+Badge\\s*=)/.test(src) || 'Chưa thấy khai báo Badge';" },
    { label: "Badge được dùng đúng 3 lần trong JSX",
      test: "var n=(src.match(/<Badge[\\s/>]/g)||[]).length; return n===3 || ('Đang dùng ' + n + ' lần, cần đúng 3');" },
    { label: "Màn hình hiện đủ NEW, SALE, HOT",
      test: "var t=text(); return (t.includes('NEW')&&t.includes('SALE')&&t.includes('HOT')) || ('Màn hình đang là: ' + t.replace(/\\n/g,' | '));" },
    { label: "Badge nhận chữ qua prop label (không hard-code trong Badge)",
      test: "return /label\\s*=/.test(src) && /\\{\\s*label\\s*\\}/.test(src) || 'Badge phải hiển thị {label} lấy từ props';" }
  ]
},

{
  id: "04", phase: "1", phaseName: "Phase 1 · Chạy được cái đã",
  title: "StyleSheet không phải là CSS",
  kind: "fix",
  objective: "Bỏ thói quen viết CSS web khi làm React Native.",
  brief: `
<p>Đoạn style dưới đây được viết bởi một người quen làm web. Trên React Native <b>thật</b>
(iOS/Android) những dòng đó bị bỏ qua hoàn toàn hoặc làm app crash.</p>
<p>Sửa lại toàn bộ StyleSheet cho đúng chuẩn React Native:</p>
<ul>
  <li>Tên thuộc tính viết <b>camelCase</b>, không dùng dấu gạch ngang.</li>
  <li>Giá trị kích thước là <b>số</b>, không có đơn vị <code>px</code>.</li>
</ul>`,
  goal: `<p>Thẻ sản phẩm nền tím nhạt, chữ tiêu đề to đậm, có khoảng đệm bên trong.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Thẻ sản phẩm</Text>
        <Text style={styles.price}>199.000 đ</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#0f172a' },
  card: {
    'background-color': '#eef2ff',
    padding: '20px',
    'border-radius': 12,
    margin: 16,
  },
  title: { 'font-size': 18, 'font-weight': 'bold', color: '#312e81' },
  price: { fontSize: 16, color: '#4f46e5', 'margin-top': 8 },
});`,
  solution: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Thẻ sản phẩm</Text>
        <Text style={styles.price}>199.000 đ</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#0f172a' },
  card: {
    backgroundColor: '#eef2ff',
    padding: 20,
    borderRadius: 12,
    margin: 16,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#312e81' },
  price: { fontSize: 16, color: '#4f46e5', marginTop: 8 },
});`,
  hints: [
    "<code>'background-color'</code> → <code>backgroundColor</code>. Tương tự cho <code>border-radius</code>, <code>font-size</code>, <code>font-weight</code>, <code>margin-top</code>.",
    "<code>padding: '20px'</code> → <code>padding: 20</code>. React Native dùng đơn vị dp, luôn là số trần.",
    "Sau khi sửa, trong file không còn dấu nháy nào bọc tên thuộc tính nữa."
  ],
  explain: `
<p>React Native không chạy CSS. <code>StyleSheet.create</code> chỉ nhận object JS với khoá camelCase,
và mọi kích thước là số (đơn vị dp — độc lập mật độ điểm ảnh của máy).</p>
<p>Ở trình duyệt (khung xem trước này) react-native-web có thể "tha" cho vài lỗi đó, nhưng trên máy thật
thì thuộc tính bị bỏ qua và bạn ngồi soi cả buổi không hiểu vì sao style không ăn.
Đó là lý do bài này chấm bằng cách <b>đọc code</b> chứ không chỉ nhìn màn hình.</p>`,
  checks: [
    { label: "Không còn tên thuộc tính kiểu CSS (có dấu gạch ngang)",
      test: "var m=src.match(/['\\\"][a-z]+-[a-z-]+['\\\"]\\s*:/g); return !m || ('Còn: ' + m.join(', ') + ' — phải đổi sang camelCase');" },
    { label: "Không còn giá trị có đơn vị px",
      test: "var m=src.match(/['\\\"]\\d+px['\\\"]/g); return !m || ('Còn: ' + m.join(', ') + ' — RN dùng số trần');" },
    { label: "Màn hình vẫn hiện đủ nội dung thẻ",
      test: "var t=text(); return (t.includes('Thẻ sản phẩm') && t.includes('199.000')) || 'Nội dung bị mất khi sửa style';" },
    { label: "Style vẫn ăn: thẻ có nền sáng và bo góc",
      test: "var el=findByText('Thẻ sản phẩm'); expect(el,'Không tìm thấy tiêu đề'); var card=el.parentElement; var st=getComputedStyle(card); return (st.borderTopLeftRadius!=='0px' && st.backgroundColor!=='rgba(0, 0, 0, 0)') || ('Thẻ chưa có nền/bo góc — computed: ' + st.backgroundColor + ' / ' + st.borderTopLeftRadius);" }
  ]
},

/* ================== PHASE 2 — LAYOUT ================== */
{
  id: "05", phase: "2", phaseName: "Phase 2 · Layout với Flexbox",
  title: "Điền style để căn giữa và xếp hàng ngang",
  kind: "fill",
  objective: "Nắm 3 thuộc tính flex dùng nhiều nhất: flex, flexDirection, justifyContent/alignItems.",
  brief: `
<p>Ba ô vuông đang xếp <b>dọc</b> và dính trên đỉnh màn hình. Hãy điền style còn thiếu:</p>
<ol>
  <li><code>screen</code>: chiếm <b>hết</b> màn hình, và đặt nội dung vào <b>chính giữa</b> (cả dọc lẫn ngang).</li>
  <li><code>row</code>: xếp 3 ô <b>nằm ngang</b>, cách nhau <b>12</b>.</li>
</ol>
<p>Lưu ý: trong React Native, mặc định của <code>flexDirection</code> là <code>'column'</code>
(khác web, mặc định là row). Đây là chỗ dân web hay vấp.</p>`,
  goal: `<p>Ba ô tím nằm ngang, cách đều 12, cụm ô nằm chính giữa màn hình đen.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <View style={styles.cell}><Text style={styles.n}>1</Text></View>
        <View style={styles.cell}><Text style={styles.n}>2</Text></View>
        <View style={styles.cell}><Text style={styles.n}>3</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // TODO 1: thêm flex, justifyContent, alignItems
  screen: { backgroundColor: '#0f172a' },

  // TODO 2: thêm flexDirection và gap
  row: {},

  cell: { width: 56, height: 56, backgroundColor: '#818cf8', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  n: { color: '#0b1020', fontWeight: '800', fontSize: 18 },
});`,
  solution: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <View style={styles.cell}><Text style={styles.n}>1</Text></View>
        <View style={styles.cell}><Text style={styles.n}>2</Text></View>
        <View style={styles.cell}><Text style={styles.n}>3</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,                    // chiếm hết phần trống của cha
    justifyContent: 'center',   // căn giữa theo TRỤC CHÍNH (mặc định là dọc)
    alignItems: 'center',       // căn giữa theo trục phụ (ngang)
    backgroundColor: '#0f172a',
  },
  row: {
    flexDirection: 'row',       // đổi trục chính sang ngang
    gap: 12,
  },
  cell: { width: 56, height: 56, backgroundColor: '#818cf8', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  n: { color: '#0b1020', fontWeight: '800', fontSize: 18 },
});`,
  hints: [
    "<code>flex: 1</code> nghĩa là 'ăn hết chỗ trống còn lại của cha'. Không có nó thì View chỉ cao bằng nội dung.",
    "<code>justifyContent</code> căn theo TRỤC CHÍNH, <code>alignItems</code> căn theo trục còn lại. Với column (mặc định) thì trục chính là dọc.",
    "row cần <code>flexDirection: 'row'</code> và <code>gap: 12</code>."
  ],
  explain: `
<p>Ba dòng style này giải quyết 80% layout thường gặp:</p>
<ul>
<li><code>flex: 1</code> — chiếm hết chỗ trống.</li>
<li><code>flexDirection</code> — quyết định đâu là trục chính. RN mặc định <code>column</code>.</li>
<li><code>justifyContent</code> (trục chính) + <code>alignItems</code> (trục phụ) — vị trí của con bên trong.</li>
</ul>
<p>Đổi <code>flexDirection</code> là hai thuộc tính căn lề kia <b>đảo vai</b> cho nhau — nhớ kỹ điều này
thì hết loay hoay thử mò.</p>`,
  checks: [
    { label: "Màn hình (screen) phủ kín chiều cao",
      test: "var s=q('div'); expect(s,'Không tìm thấy View gốc'); return (s.offsetHeight >= window.innerHeight - 4) || ('screen chỉ cao ' + s.offsetHeight + 'px trong khi màn hình cao ' + window.innerHeight + 'px — thiếu flex: 1');" },
    { label: "Ba ô nằm trên cùng một hàng ngang",
      test: "var c=qa('div').filter(function(e){return e.offsetWidth===56 && e.offsetHeight===56}); expect(c.length>=3,'Không tìm thấy đủ 3 ô 56x56'); var t=c.slice(0,3).map(function(e){return Math.round(e.getBoundingClientRect().top)}); return (t[0]===t[1] && t[1]===t[2]) || ('Ba ô đang ở 3 độ cao khác nhau (' + t.join(', ') + ') — thiếu flexDirection: row');" },
    { label: "Ba ô cách nhau khoảng 12",
      test: "var c=qa('div').filter(function(e){return e.offsetWidth===56}); var a=c[0].getBoundingClientRect(), b=c[1].getBoundingClientRect(); var g=Math.round(b.left - a.right); return (g>=10 && g<=14) || ('Khoảng cách đang là ' + g + ', cần 12');" },
    { label: "Cụm ô nằm giữa màn hình (cả dọc lẫn ngang)",
      test: "var c=qa('div').filter(function(e){return e.offsetWidth===56}); var first=c[0].getBoundingClientRect(), last=c[2].getBoundingClientRect(); var cx=(first.left+last.right)/2, cy=(first.top+first.bottom)/2; var dx=Math.abs(cx - window.innerWidth/2), dy=Math.abs(cy - window.innerHeight/2); return (dx<=6 && dy<=6) || ('Lệch tâm: ngang ' + Math.round(dx) + 'px, dọc ' + Math.round(dy) + 'px');" }
  ]
},

{
  id: "06", phase: "2", phaseName: "Phase 2 · Layout với Flexbox",
  title: "Footer không chịu nằm dưới đáy",
  kind: "fix",
  objective: "Hiểu vì sao thiếu một chữ flex là cả bố cục sai chỗ.",
  brief: `
<p>Bố cục kinh điển: Header trên cùng, Footer dưới đáy, phần nội dung ăn hết khoảng giữa.</p>
<p>Hiện tại Footer đang <b>dính ngay dưới Header</b>, để trống một mảng lớn phía dưới.
Chỉ cần thêm <b>đúng một dòng style</b> là xong.</p>`,
  goal: `<p>Header cao 48 trên đỉnh · vùng nội dung xám chiếm hết khoảng giữa · Footer cao 48 chạm đáy màn hình.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}><Text style={styles.bar}>Header</Text></View>
      <View style={styles.content}><Text style={styles.c}>Nội dung</Text></View>
      <View style={styles.footer}><Text style={styles.bar}>Footer</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  header: { height: 48, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  content: { backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  footer: { height: 48, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  bar: { color: '#fff', fontWeight: '700' },
  c: { color: '#94a3b8' },
});`,
  solution: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}><Text style={styles.bar}>Header</Text></View>
      <View style={styles.content}><Text style={styles.c}>Nội dung</Text></View>
      <View style={styles.footer}><Text style={styles.bar}>Footer</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  header: { height: 48, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  // flex: 1 -> nuốt hết chỗ trống giữa header và footer, đẩy footer xuống đáy
  content: { flex: 1, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  footer: { height: 48, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  bar: { color: '#fff', fontWeight: '700' },
  c: { color: '#94a3b8' },
});`,
  hints: [
    "Header và Footer đều có <code>height</code> cố định. Vậy ai là người phải giãn ra để lấp chỗ trống?",
    "Trong flexbox, phần tử có <code>flex: 1</code> sẽ nuốt hết không gian còn thừa của cha.",
    "Thêm <code>flex: 1</code> vào style <code>content</code>."
  ],
  explain: `
<p>Không cần <code>position: absolute</code>, không cần tính chiều cao. Nguyên tắc:
<b>phần co giãn được thì cho flex: 1, phần cố định thì cho height</b>. Cha (screen) đã có
<code>flex: 1</code> nên biết chiều cao thật; con ở giữa lấy nốt phần dư.</p>
<p>Đây cũng là lý do <code>ScrollView</code>/<code>FlatList</code> hay "không cuộn được":
cha của chúng không có chiều cao xác định.</p>`,
  checks: [
    { label: "Header nằm sát đỉnh màn hình",
      test: "var h=findByText('Header').parentElement.getBoundingClientRect(); return Math.round(h.top)<=1 || ('Header đang cách đỉnh ' + Math.round(h.top) + 'px');" },
    { label: "Footer chạm đáy màn hình",
      test: "var f=findByText('Footer').parentElement.getBoundingClientRect(); var d=Math.abs(f.bottom - window.innerHeight); return d<=2 || ('Đáy Footer còn cách đáy màn hình ' + Math.round(d) + 'px — phần nội dung chưa giãn ra');" },
    { label: "Vùng nội dung chiếm hết khoảng giữa",
      test: "var c=findByText('Nội dung').parentElement.getBoundingClientRect(); return (c.height >= window.innerHeight - 100) || ('Vùng nội dung chỉ cao ' + Math.round(c.height) + 'px');" },
    { label: "Không đụng tới chiều cao của Header/Footer",
      test: "return (src.match(/height:\\s*48/g)||[]).length===2 || 'Header và Footer vẫn phải là height: 48 — lời giải không nằm ở đó';" }
  ]
},

/* ================== PHASE 3 — STATE & SỰ KIỆN ================== */
{
  id: "07", phase: "3", phaseName: "Phase 3 · State & sự kiện",
  title: "Bấm nút mà số không nhảy",
  kind: "fix",
  objective: "Phân biệt biến thường và state — cái nào làm UI vẽ lại.",
  brief: `
<p>Bấm nút <b>Tăng</b>: Console in ra số tăng dần, nhưng <b>số trên màn hình đứng im</b>.</p>
<p>Chạy thử, bấm vài lần và nhìn Console để tự thấy hiện tượng. Sau đó sửa để màn hình cập nhật.</p>
<p><b>Chú ý:</b> bạn sẽ cần thêm một dòng <code>import</code> nữa ở đầu file.</p>`,
  goal: `<p>Mỗi lần bấm Tăng, con số trên màn hình tăng thêm 1.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  let count = 0;

  function tang() {
    count = count + 1;
    console.log('count trong bộ nhớ là', count);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.num}>{count}</Text>
      <Pressable style={styles.btn} onPress={tang}>
        <Text style={styles.btnText}>Tăng</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 56, fontWeight: '800' },
  btn: { marginTop: 18, backgroundColor: '#4f46e5', paddingHorizontal: 26, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});`,
  solution: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  // state = giá trị được React ghi nhớ giữa các lần render, và đổi nó thì UI vẽ lại
  const [count, setCount] = useState(0);

  function tang() {
    setCount(count + 1);
    console.log('count trong bộ nhớ là', count + 1);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.num}>{count}</Text>
      <Pressable style={styles.btn} onPress={tang}>
        <Text style={styles.btnText}>Tăng</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 56, fontWeight: '800' },
  btn: { marginTop: 18, backgroundColor: '#4f46e5', paddingHorizontal: 26, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});`,
  hints: [
    "Biến <code>let count</code> có đổi giá trị thật (Console chứng minh), nhưng React <b>không hề biết</b> nên không vẽ lại màn hình.",
    "Thêm <code>import { useState } from 'react';</code> ở dòng đầu.",
    "Đổi thành <code>const [count, setCount] = useState(0);</code> và trong hàm tang gọi <code>setCount(count + 1)</code>."
  ],
  explain: `
<p>Mỗi lần render, React chạy lại toàn bộ function component. Biến khai báo bằng <code>let</code>
sẽ được tạo mới từ đầu — nó không có "trí nhớ".</p>
<p><code>useState</code> làm 2 việc: (1) giữ giá trị lại giữa các lần render,
(2) khi bạn gọi hàm <code>set...</code>, nó báo cho React biết "dữ liệu đổi rồi, vẽ lại đi".
Thiếu vế (2) là UI đứng hình — đúng như bug bạn vừa gặp.</p>`,
  checks: [
    { label: "Ban đầu màn hình hiện số 0",
      test: "return /(^|\\D)0(\\D|$)/.test(text()) || ('Màn hình đang hiện: ' + text().replace(/\\n/g,' '));" },
    { label: "Bấm Tăng thì con số trên màn hình tăng lên",
      test: "function num(){var m=text().match(/-?\\d+/); return m?parseInt(m[0],10):null;} var a=num(); await press('Tăng'); var b=num(); return (b>a) || ('Trước khi bấm là ' + a + ', sau khi bấm vẫn là ' + b + ' — UI chưa vẽ lại');" },
    { label: "Dùng useState thay cho biến thường",
      test: "return /useState\\s*\\(/.test(src) || 'Chưa thấy useState trong code';" },
    { label: "Không còn khai báo let count = 0",
      test: "return !/let\\s+count\\s*=/.test(src) || 'Vẫn còn biến let count — nó không sống sót qua lần render sau';" }
  ]
},

{
  id: "08", phase: "3", phaseName: "Phase 3 · State & sự kiện",
  title: "onPress bị gọi ngay khi render",
  kind: "fix",
  objective: "Phân biệt TRUYỀN hàm và GỌI hàm trong props sự kiện.",
  brief: `
<p>App này crash ngay khi mở, chưa kịp bấm gì. Chạy thử và đọc kỹ dòng lỗi trong
<b>Console &amp; Stack trace</b> — React nói rất rõ: <i>Too many re-renders</i>.</p>
<p>Nguyên nhân nằm ở <b>một cặp dấu ngoặc</b> trong prop <code>onPress</code>.</p>`,
  goal: `<p>Mở lên thấy chữ "Chưa bấm". Bấm nút thì đổi thành "Đã bấm rồi!".</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [msg, setMsg] = useState('Chưa bấm');

  return (
    <View style={styles.screen}>
      <Text style={styles.msg}>{msg}</Text>
      <Pressable style={styles.btn} onPress={setMsg('Đã bấm rồi!')}>
        <Text style={styles.btnText}>Bấm tôi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  msg: { color: '#e2e8f0', fontSize: 20, marginBottom: 18 },
  btn: { backgroundColor: '#4f46e5', paddingHorizontal: 26, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  solution: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [msg, setMsg] = useState('Chưa bấm');

  return (
    <View style={styles.screen}>
      <Text style={styles.msg}>{msg}</Text>
      {/* Truyền MỘT HÀM để React gọi sau, chứ không gọi ngay lúc render */}
      <Pressable style={styles.btn} onPress={() => setMsg('Đã bấm rồi!')}>
        <Text style={styles.btnText}>Bấm tôi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  msg: { color: '#e2e8f0', fontSize: 20, marginBottom: 18 },
  btn: { backgroundColor: '#4f46e5', paddingHorizontal: 26, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  hints: [
    "<code>onPress={setMsg('...')}</code> nghĩa là: gọi setMsg NGAY BÂY GIỜ, rồi lấy kết quả (undefined) gán cho onPress.",
    "Gọi setState trong lúc render → React render lại → lại gọi setState → vòng lặp vô tận.",
    "Bọc lại thành hàm mũi tên: <code>onPress={() =&gt; setMsg('Đã bấm rồi!')}</code>."
  ],
  explain: `
<p>Props sự kiện cần một <b>hàm</b> để dành đó, gọi sau khi người dùng chạm.
<code>onPress={tang}</code> đúng (truyền tên hàm), <code>onPress={tang()}</code> sai (gọi ngay).</p>
<p>Khi cần truyền tham số thì bọc trong hàm mũi tên:
<code>onPress={() =&gt; xoa(item.id)}</code> — hàm mũi tên chính là "cái vỏ" để hoãn việc gọi lại.</p>`,
  checks: [
    { label: "App mở lên không crash, hiện 'Chưa bấm'",
      test: "return text().includes('Chưa bấm') || ('Màn hình đang là: ' + text().replace(/\\n/g,' '));" },
    { label: "Bấm nút thì đổi thành 'Đã bấm rồi!'",
      test: "await press('Bấm tôi'); return text().includes('Đã bấm rồi') || ('Sau khi bấm màn hình là: ' + text().replace(/\\n/g,' '));" },
    { label: "onPress nhận một hàm, không phải kết quả gọi hàm",
      test: "return !/onPress=\\{\\s*set[A-Za-z]*\\s*\\(/.test(src) || 'onPress vẫn đang gọi hàm ngay lập tức';" },
    { label: "Không còn lỗi đỏ trong Console",
      test: "var e=logs.filter(function(l){return l.level==='error'}); return e.length===0 || ('Vẫn còn lỗi: ' + e[0].text.split('\\n')[0]);" }
  ]
},

{
  id: "09", phase: "3", phaseName: "Phase 3 · State & sự kiện",
  title: "Gọi setState 3 lần mà chỉ tăng 1",
  kind: "fix",
  objective: "Hiểu state là ảnh chụp của lần render hiện tại — và cách dùng hàm cập nhật.",
  brief: `
<p>Nút <b>+3</b> gọi <code>setCount</code> ba lần liên tiếp, nhưng bấm một cái chỉ tăng đúng <b>1</b>.</p>
<p>Chạy thử để tự thấy, rồi sửa sao cho mỗi lần bấm tăng đủ 3 — <b>vẫn giữ 3 lời gọi setCount</b>,
không được gộp thành <code>setCount(count + 3)</code>.</p>`,
  goal: `<p>Bấm +3 một lần: số nhảy từ 0 lên 3, lần nữa lên 6.</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  function congBa() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.num}>{count}</Text>
      <Pressable style={styles.btn} onPress={congBa}>
        <Text style={styles.btnText}>+3</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 56, fontWeight: '800' },
  btn: { marginTop: 18, backgroundColor: '#4f46e5', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});`,
  solution: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  function congBa() {
    // Dạng hàm: React đưa cho bạn giá trị MỚI NHẤT đang xếp hàng, không phải ảnh chụp cũ
    setCount(function (c) { return c + 1; });
    setCount(function (c) { return c + 1; });
    setCount(function (c) { return c + 1; });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.num}>{count}</Text>
      <Pressable style={styles.btn} onPress={congBa}>
        <Text style={styles.btnText}>+3</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 56, fontWeight: '800' },
  btn: { marginTop: 18, backgroundColor: '#4f46e5', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});`,
  hints: [
    "Trong một lần render, <code>count</code> là một hằng số. Ba lời gọi đều đang tính <code>0 + 1</code>.",
    "setState có dạng thứ hai: truyền vào một HÀM nhận giá trị hiện tại — <code>setCount(c =&gt; c + 1)</code>.",
    "Đổi cả 3 lời gọi sang dạng hàm cập nhật."
  ],
  explain: `
<p>React gom (batch) các lời gọi setState trong cùng một sự kiện rồi mới render một lần.
Với <code>setCount(count + 1)</code>, cả ba lần đều đọc <code>count</code> của <b>lần render hiện tại</b> (0),
nên kết quả cuối cùng là 1.</p>
<p>Với <code>setCount(c =&gt; c + 1)</code>, React xếp ba <b>hàm</b> vào hàng đợi và chạy lần lượt,
mỗi hàm nhận kết quả của hàm trước: 0→1→2→3.</p>
<p><b>Quy tắc thực chiến:</b> khi giá trị mới phụ thuộc giá trị cũ, luôn dùng dạng hàm.</p>`,
  checks: [
    { label: "Bấm +3 một lần thì số tăng đủ 3",
      test: "function num(){var m=text().match(/-?\\d+/); return m?parseInt(m[0],10):null;} var a=num(); await press('+3'); var b=num(); return ((b-a)%3===0 && b>a) || ('Số nhảy từ ' + a + ' lên ' + b + ' — mới tăng ' + (b-a));" },
    { label: "Vẫn giữ đúng 3 lời gọi setCount",
      test: "var n=(src.match(/setCount\\s*\\(/g)||[]).length; return n===3 || ('Đang có ' + n + ' lời gọi setCount, đề bài yêu cầu giữ nguyên 3');" },
    { label: "Dùng dạng hàm cập nhật cho setCount",
      test: "return /setCount\\s*\\(\\s*(function|\\(?\\s*\\w+\\s*\\)?\\s*=>)/.test(src) || 'Chưa dùng dạng setCount(c => c + 1)';" }
  ]
},

{
  id: "10", phase: "3", phaseName: "Phase 3 · State & sự kiện",
  title: "Thêm vào mảng bằng push — danh sách đứng im",
  kind: "fix",
  objective: "Hiểu vì sao state phải được thay bằng đối tượng MỚI, không sửa tại chỗ.",
  brief: `
<p>Bấm <b>Thêm món</b>: Console in ra mảng đã dài thêm, nhưng danh sách trên màn hình không đổi.</p>
<p>Sửa để mỗi lần bấm là một dòng mới xuất hiện.</p>`,
  goal: `<p>Bấm 1 lần: có thêm "Món 2". Bấm nữa: thêm "Món 3"...</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [items, setItems] = useState(['Món 1']);

  function them() {
    items.push('Món ' + (items.length + 1));
    setItems(items);
    console.log('mảng hiện có', items.length, 'phần tử');
  }

  return (
    <View style={styles.screen}>
      {items.map(function (ten, i) {
        return <Text key={i} style={styles.item}>{ten}</Text>;
      })}
      <Pressable style={styles.btn} onPress={them}>
        <Text style={styles.btnText}>Thêm món</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  item: { color: '#e2e8f0', fontSize: 16, paddingVertical: 3 },
  btn: { marginTop: 16, backgroundColor: '#4f46e5', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  solution: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [items, setItems] = useState(['Món 1']);

  function them() {
    // Tạo MẢNG MỚI: React so sánh tham chiếu, mảng cũ sửa tại chỗ thì nó coi như không đổi
    const moi = [...items, 'Món ' + (items.length + 1)];
    setItems(moi);
    console.log('mảng hiện có', moi.length, 'phần tử');
  }

  return (
    <View style={styles.screen}>
      {items.map(function (ten, i) {
        return <Text key={i} style={styles.item}>{ten}</Text>;
      })}
      <Pressable style={styles.btn} onPress={them}>
        <Text style={styles.btnText}>Thêm món</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  item: { color: '#e2e8f0', fontSize: 16, paddingVertical: 3 },
  btn: { marginTop: 16, backgroundColor: '#4f46e5', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  hints: [
    "<code>items.push(...)</code> sửa chính mảng cũ. <code>setItems(items)</code> đưa lại đúng cái mảng đó — React thấy 'y hệt cái cũ' nên không render lại.",
    "Toán tử spread tạo mảng mới: <code>[...items, 'phần tử mới']</code>.",
    "Xoá dòng push đi, thay bằng <code>setItems([...items, 'Món ' + (items.length + 1)]);</code>"
  ],
  explain: `
<p>React so sánh state cũ và mới bằng <code>Object.is</code> — tức là so <b>tham chiếu</b>, không so từng phần tử.
Mảng bị <code>push</code> vẫn là cùng một tham chiếu → React kết luận "không có gì đổi" → bỏ qua việc render.</p>
<p>Các thao tác an toàn (đều trả về cái mới): <code>[...arr, x]</code> để thêm,
<code>arr.filter(...)</code> để xoá, <code>arr.map(...)</code> để sửa,
<code>{...obj, key: value}</code> cho object.</p>
<p>Ngược lại, tránh: <code>push</code>, <code>pop</code>, <code>splice</code>, <code>sort</code> trực tiếp trên state.</p>`,
  checks: [
    { label: "Ban đầu có đúng 1 món",
      test: "var n=(text().match(/Món \\d+/g)||[]).length; return n===1 || ('Đang hiện ' + n + ' món');" },
    { label: "Bấm Thêm món thì danh sách dài thêm",
      test: "var a=(text().match(/Món \\d+/g)||[]).length; await press('Thêm món'); var b=(text().match(/Món \\d+/g)||[]).length; return (b>a) || ('Vẫn ' + b + ' món sau khi bấm — React không nhận ra state đổi');" },
    { label: "Không còn dùng items.push trên state",
      test: "return !/items\\s*\\.\\s*push\\s*\\(/.test(src) || 'Vẫn còn items.push(...) — đó là sửa tại chỗ';" },
    { label: "Tạo mảng mới khi cập nhật state",
      test: "return /\\.\\.\\.\\s*items/.test(src) || /items\\s*\\.\\s*concat\\s*\\(/.test(src) || 'Hãy tạo mảng mới bằng [...items, x] hoặc items.concat(x)';" }
  ]
},

{
  id: "11", phase: "3", phaseName: "Phase 3 · State & sự kiện",
  title: "Nối TextInput với state",
  kind: "fill",
  objective: "Làm một ô nhập controlled — dữ liệu chảy từ state ra UI và ngược lại.",
  brief: `
<p>Ô nhập hiện đang "rời rạc": gõ vào không ai biết. Hãy nối nó với state <code>ten</code>.</p>
<p>Yêu cầu:</p>
<ol>
  <li><code>TextInput</code> phải có <code>value</code> lấy từ state và <code>onChangeText</code> cập nhật state.</li>
  <li>Dòng chữ bên dưới hiện <code>Xin chào, &lt;tên&gt;!</code> khi đã gõ, và <code>Chưa nhập gì</code> khi ô trống.</li>
  <li>Dòng cuối hiện đúng <code>Độ dài: N ký tự</code>.</li>
</ol>
<p>Chú ý: <code>onChangeText</code> nhận thẳng <b>chuỗi</b>, không phải event như trên web.</p>`,
  goal: `<p>Gõ "Việt" → hiện "Xin chào, Việt!" và "Độ dài: 4 ký tự".</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  const [ten, setTen] = useState('');

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Nhập tên của bạn</Text>

      {/* TODO 1: thêm value và onChangeText cho TextInput */}
      <TextInput style={styles.input} placeholder="Tên..." placeholderTextColor="#64748b" />

      {/* TODO 2: nếu ten rỗng thì hiện 'Chưa nhập gì', ngược lại hiện 'Xin chào, ' + ten + '!' */}
      <Text style={styles.out}>Chưa nhập gì</Text>

      {/* TODO 3: hiện độ dài, đúng dạng: Độ dài: 4 ký tự */}
      <Text style={styles.small}>Độ dài: 0 ký tự</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', marginBottom: 8, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, color: '#e2e8f0', backgroundColor: '#1e293b' },
  out: { color: '#a78bfa', fontSize: 18, fontWeight: '700', marginTop: 16 },
  small: { color: '#64748b', fontSize: 12, marginTop: 4 },
});`,
  solution: `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  const [ten, setTen] = useState('');

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Nhập tên của bạn</Text>

      <TextInput
        style={styles.input}
        placeholder="Tên..."
        placeholderTextColor="#64748b"
        value={ten}
        onChangeText={setTen}
      />

      <Text style={styles.out}>
        {ten === '' ? 'Chưa nhập gì' : 'Xin chào, ' + ten + '!'}
      </Text>

      <Text style={styles.small}>Độ dài: {ten.length} ký tự</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', marginBottom: 8, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, color: '#e2e8f0', backgroundColor: '#1e293b' },
  out: { color: '#a78bfa', fontSize: 18, fontWeight: '700', marginTop: 16 },
  small: { color: '#64748b', fontSize: 12, marginTop: 4 },
});`,
  hints: [
    "<code>value={ten}</code> làm UI luôn phản chiếu state; <code>onChangeText={setTen}</code> làm state luôn theo kịp bàn phím.",
    "Trong JSX dùng toán tử ba ngôi để chọn chữ: <code>{ten === '' ? 'Chưa nhập gì' : 'Xin chào, ' + ten + '!'}</code>",
    "Độ dài: <code>&lt;Text&gt;Độ dài: {ten.length} ký tự&lt;/Text&gt;</code>"
  ],
  explain: `
<p>Đây là mô hình <b>controlled component</b>: state là nguồn sự thật duy nhất.
UI chỉ hiển thị state, còn mọi thay đổi từ người dùng đều đi qua hàm set.
Nhờ vậy bạn có thể lọc/chuẩn hoá dữ liệu ngay khi gõ (viết hoa, chặn ký tự, giới hạn độ dài...).</p>
<p>Khác web: RN cho bạn <code>onChangeText</code> với thẳng chuỗi, không cần
<code>e.target.value</code>. Vẫn có <code>onChange</code> nhận event nhưng gần như không ai dùng.</p>`,
  checks: [
    { label: "TextInput là controlled (có value và onChangeText)",
      test: "return (/value\\s*=\\s*\\{/.test(src) && /onChangeText\\s*=\\s*\\{/.test(src)) || 'TextInput còn thiếu value hoặc onChangeText';" },
    { label: "Chưa gõ gì thì hiện 'Chưa nhập gì'",
      test: "return text().includes('Chưa nhập gì') || ('Màn hình đang là: ' + text().replace(/\\n/g,' | '));" },
    { label: "Gõ 'Việt' thì hiện 'Xin chào, Việt!'",
      test: "await type('Tên', 'Việt'); return text().includes('Xin chào, Việt!') || ('Sau khi gõ, màn hình là: ' + text().replace(/\\n/g,' | '));" },
    { label: "Đếm đúng độ dài: 'Độ dài: 4 ký tự'",
      test: "await type('Tên', 'Việt'); return text().includes('Độ dài: 4 ký tự') || ('Đang hiện: ' + (text().match(/Độ dài:.*/)||['(không có)'])[0]);" }
  ]
},

/* ================== PHASE 4 — HOOKS ================== */
{
  id: "12", phase: "4", phaseName: "Phase 4 · Hooks",
  title: "useEffect chạy lại sau mỗi lần render",
  kind: "fix",
  objective: "Hiểu vai trò của mảng phụ thuộc (dependency array).",
  brief: `
<p>Effect này giả lập việc "kết nối tới server" — thứ chỉ nên làm <b>đúng một lần</b> khi mở màn hình.</p>
<p>Chạy thử, bấm nút Tăng vài lần và nhìn Console: dòng <code>Kết nối tới server...</code>
in ra thêm sau <b>mỗi</b> lần bấm. Sửa để nó chỉ in đúng 1 lần.</p>`,
  goal: `<p>Bấm Tăng bao nhiêu lần thì Console vẫn chỉ có duy nhất 1 dòng "Kết nối tới server...".</p>`,
  codeTitle: "App.js",
  code: `import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(function () {
    console.log('Kết nối tới server...');
  });

  return (
    <View style={styles.screen}>
      <Text style={styles.num}>{count}</Text>
      <Text style={styles.hint}>Mở Console xem effect chạy mấy lần</Text>
      <Pressable style={styles.btn} onPress={function () { setCount(count + 1); }}>
        <Text style={styles.btnText}>Tăng</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 48, fontWeight: '800' },
  hint: { color: '#64748b', fontSize: 12, marginTop: 4 },
  btn: { marginTop: 16, backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  solution: `import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  // [] = danh sách phụ thuộc rỗng -> effect chỉ chạy một lần sau lần render đầu tiên
  useEffect(function () {
    console.log('Kết nối tới server...');
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.num}>{count}</Text>
      <Text style={styles.hint}>Mở Console xem effect chạy mấy lần</Text>
      <Pressable style={styles.btn} onPress={function () { setCount(count + 1); }}>
        <Text style={styles.btnText}>Tăng</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 48, fontWeight: '800' },
  hint: { color: '#64748b', fontSize: 12, marginTop: 4 },
  btn: { marginTop: 16, backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  hints: [
    "<code>useEffect(fn)</code> — không có tham số thứ hai — nghĩa là 'chạy sau MỌI lần render'.",
    "Tham số thứ hai là mảng phụ thuộc: effect chỉ chạy lại khi một phần tử trong mảng đổi.",
    "Mảng rỗng <code>[]</code> = không phụ thuộc gì = chỉ chạy một lần. Nhớ dấu phẩy: <code>}, []);</code>"
  ],
  explain: `
<p>Ba dạng cần thuộc lòng:</p>
<ul>
<li><code>useEffect(fn)</code> — sau mỗi lần render. Hầu như luôn là bug.</li>
<li><code>useEffect(fn, [])</code> — một lần khi mount. Dùng cho: kết nối, đăng ký sự kiện, tải dữ liệu ban đầu.</li>
<li><code>useEffect(fn, [id])</code> — chạy lại mỗi khi <code>id</code> đổi. Dùng cho: tải lại dữ liệu khi đổi sản phẩm.</li>
</ul>
<p>Nếu effect có gọi setState mà lại thiếu mảng phụ thuộc thì bạn sẽ tạo ra
vòng lặp vô tận: render → effect → setState → render → ...</p>`,
  checks: [
    { label: "Effect chỉ chạy 1 lần dù bấm nhiều lần",
      test: "await press('Tăng'); await press('Tăng'); var n=logs.filter(function(l){return l.text.indexOf('Kết nối tới server')>=0}).length; return n===1 || ('Effect đã chạy ' + n + ' lần');" },
    { label: "useEffect có mảng phụ thuộc rỗng",
      test: "return /\\}\\s*,\\s*\\[\\s*\\]\\s*\\)/.test(src) || 'Chưa thấy tham số thứ hai [] của useEffect';" },
    { label: "Nút Tăng vẫn hoạt động",
      test: "function num(){var m=text().match(/-?\\d+/); return m?parseInt(m[0],10):null;} var a=num(); await press('Tăng'); return num()>a || 'Số không tăng nữa — bạn sửa nhầm chỗ rồi';" }
  ]
},

{
  id: "13", phase: "4", phaseName: "Phase 4 · Hooks",
  title: "Viết hàm dọn dẹp cho useEffect",
  kind: "fill",
  objective: "Biết trả về hàm cleanup để không rò rỉ timer/listener.",
  brief: `
<p>Đồng hồ chạy bằng <code>setInterval</code>. Bấm <b>Ẩn đồng hồ</b> thì component bị gỡ khỏi cây,
nhưng <code>setInterval</code> vẫn tiếp tục chạy mãi trong nền — đó là rò rỉ bộ nhớ kinh điển.</p>
<p>Yêu cầu: viết <b>hàm dọn dẹp</b> — <code>useEffect</code> trả về một hàm huỷ interval.
Console phải in <code>Đã dọn interval</code> khi đồng hồ bị ẩn.</p>`,
  goal: `<p>Số giây tăng đều. Bấm "Ẩn đồng hồ" → Console in "Đã dọn interval".</p>`,
  codeTitle: "App.js",
  code: `import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function DongHo() {
  const [giay, setGiay] = useState(0);

  useEffect(function () {
    const id = setInterval(function () {
      setGiay(function (g) { return g + 1; });
    }, 300);

    // TODO: trả về hàm dọn dẹp — gọi clearInterval(id) và console.log('Đã dọn interval')

  }, []);

  return <Text style={styles.num}>{giay}</Text>;
}

export default function App() {
  const [hien, setHien] = useState(true);
  return (
    <View style={styles.screen}>
      {hien ? <DongHo /> : <Text style={styles.off}>Đã ẩn</Text>}
      <Pressable style={styles.btn} onPress={function () { setHien(!hien); }}>
        <Text style={styles.btnText}>Ẩn đồng hồ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 52, fontWeight: '800' },
  off: { color: '#64748b', fontSize: 18 },
  btn: { marginTop: 18, backgroundColor: '#4f46e5', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  solution: `import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function DongHo() {
  const [giay, setGiay] = useState(0);

  useEffect(function () {
    const id = setInterval(function () {
      setGiay(function (g) { return g + 1; });
    }, 300);

    // Hàm này được React gọi khi component bị gỡ (hoặc trước khi effect chạy lại)
    return function () {
      clearInterval(id);
      console.log('Đã dọn interval');
    };
  }, []);

  return <Text style={styles.num}>{giay}</Text>;
}

export default function App() {
  const [hien, setHien] = useState(true);
  return (
    <View style={styles.screen}>
      {hien ? <DongHo /> : <Text style={styles.off}>Đã ẩn</Text>}
      <Pressable style={styles.btn} onPress={function () { setHien(!hien); }}>
        <Text style={styles.btnText}>Ẩn đồng hồ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  num: { color: '#a78bfa', fontSize: 52, fontWeight: '800' },
  off: { color: '#64748b', fontSize: 18 },
  btn: { marginTop: 18, backgroundColor: '#4f46e5', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  hints: [
    "Thứ duy nhất useEffect được phép trả về là một HÀM — hàm dọn dẹp.",
    "Khung sườn: <code>return function () { clearInterval(id); };</code>",
    "Nhớ thêm <code>console.log('Đã dọn interval');</code> bên trong hàm dọn dẹp để bài chấm thấy được."
  ],
  explain: `
<p>React gọi hàm dọn dẹp trong 2 tình huống: (1) component bị gỡ khỏi màn hình,
(2) ngay trước khi effect chạy lại vì phụ thuộc đổi.</p>
<p>Không dọn thì mọi thứ "sống dai" vẫn tiếp tục: <code>setInterval</code>, listener sự kiện,
socket, subscription của navigation... Trong app thật, đây là nguyên nhân số một của
"app dùng lâu thì giật dần" và lỗi cập nhật state của màn hình đã đóng.</p>`,
  checks: [
    { label: "Đồng hồ chạy: số giây tự tăng",
      test: "var a=text(); var ok=await until(function(){return text()!==a}, 2000); return ok || 'Số giây không nhúc nhích';" },
    { label: "useEffect trả về hàm dọn dẹp có clearInterval",
      test: "return (/return\\s*(function\\s*\\(\\s*\\)|\\(\\s*\\)\\s*=>)/.test(src) && /clearInterval\\s*\\(/.test(src)) || 'Chưa thấy return một hàm có clearInterval bên trong';" },
    { label: "Bấm Ẩn đồng hồ thì hàm dọn dẹp chạy",
      test: "await press('Ẩn đồng hồ'); await wait(200); var n=logs.filter(function(l){return l.text.indexOf('Đã dọn interval')>=0}).length; return n>=1 || 'Console chưa in Đã dọn interval — hàm dọn dẹp chưa được gọi';" },
    { label: "Sau khi ẩn thì đồng hồ dừng hẳn",
      test: "if(text().indexOf('Đã ẩn')>=0){await press('Ẩn đồng hồ'); await wait(250);} await press('Ẩn đồng hồ'); await wait(150); var a=text(); await wait(700); return text()===a || 'Màn hình vẫn đổi sau khi ẩn — interval chưa bị huỷ';" }
  ]
},

{
  id: "14", phase: "4", phaseName: "Phase 4 · Hooks",
  title: "useRef để chạm tới ô nhập",
  kind: "fill",
  objective: "Dùng ref lấy tham chiếu tới một component để gọi lệnh trực tiếp (focus).",
  brief: `
<p>Nút <b>Nhập tên ngay</b> phải làm con trỏ nhảy vào ô nhập. Không có state nào ở đây cả —
đây là việc "ra lệnh trực tiếp cho một node", đúng địa bàn của <code>useRef</code>.</p>
<p>Yêu cầu:</p>
<ol>
  <li>Tạo ref: <code>const oNhap = useRef(null);</code></li>
  <li>Gắn vào TextInput: <code>ref={oNhap}</code></li>
  <li>Trong onPress gọi <code>oNhap.current.focus()</code></li>
</ol>`,
  goal: `<p>Bấm nút → viền ô nhập sáng lên, con trỏ nằm trong ô, gõ được luôn.</p>`,
  codeTitle: "App.js",
  code: `import { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  // TODO 1: tạo ref tên oNhap

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Bấm nút để nhảy vào ô nhập</Text>

      {/* TODO 2: gắn ref vào TextInput */}
      <TextInput style={styles.input} placeholder="Tên..." placeholderTextColor="#64748b" />

      {/* TODO 3: onPress gọi focus() qua ref */}
      <Pressable style={styles.btn} onPress={function () {}}>
        <Text style={styles.btnText}>Nhập tên ngay</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', marginBottom: 10, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, color: '#e2e8f0', backgroundColor: '#1e293b' },
  btn: { marginTop: 14, backgroundColor: '#4f46e5', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  solution: `import { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  // useRef giữ một "ô nhớ" không gây render lại khi đổi; .current sẽ trỏ tới TextInput
  const oNhap = useRef(null);

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Bấm nút để nhảy vào ô nhập</Text>

      <TextInput
        ref={oNhap}
        style={styles.input}
        placeholder="Tên..."
        placeholderTextColor="#64748b"
      />

      <Pressable style={styles.btn} onPress={function () { oNhap.current.focus(); }}>
        <Text style={styles.btnText}>Nhập tên ngay</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', marginBottom: 10, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, color: '#e2e8f0', backgroundColor: '#1e293b' },
  btn: { marginTop: 14, backgroundColor: '#4f46e5', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});`,
  hints: [
    "<code>useRef(null)</code> trả về object dạng <code>{ current: null }</code>. React sẽ tự gán node vào <code>.current</code> khi bạn truyền qua prop <code>ref</code>.",
    "Gắn: <code>&lt;TextInput ref={oNhap} ... /&gt;</code>",
    "Gọi lệnh: <code>onPress={() =&gt; oNhap.current.focus()}</code> — nhớ có <code>.current</code>."
  ],
  explain: `
<p>Hai công dụng của <code>useRef</code>:</p>
<ol>
<li><b>Chạm tới node</b> để gọi lệnh mệnh lệnh: <code>focus()</code>, <code>blur()</code>,
<code>scrollToIndex()</code> của FlatList, <code>measure()</code>...</li>
<li><b>Giữ giá trị giữa các lần render mà KHÔNG gây render lại</b>: id của timer, giá trị trước đó,
cờ "đã gửi request chưa".</li>
</ol>
<p>Khác biệt cốt lõi với state: đổi <code>ref.current</code> thì React <b>không</b> vẽ lại.
Nên đừng dùng ref cho dữ liệu cần hiển thị.</p>`,
  checks: [
    { label: "Có tạo ref bằng useRef",
      test: "return /useRef\\s*\\(/.test(src) || 'Chưa thấy useRef trong code';" },
    { label: "ref được gắn vào TextInput",
      test: "return /ref\\s*=\\s*\\{/.test(src) || 'TextInput chưa có prop ref';" },
    { label: "Bấm nút thì con trỏ nhảy vào ô nhập",
      test: "await press('Nhập tên ngay'); var a=document.activeElement; return (a && (a.tagName==='INPUT'||a.tagName==='TEXTAREA')) || ('Phần tử đang được focus là: ' + (a?a.tagName:'không có'));" },
    { label: "Gọi focus qua .current",
      test: "return /\\.current\\s*\\.\\s*focus\\s*\\(/.test(src) || 'Phải gọi qua oNhap.current.focus()';" }
  ]
},

{
  id: "15", phase: "4", phaseName: "Phase 4 · Hooks",
  title: "Tự viết một custom hook",
  kind: "fill",
  objective: "Gói logic state lặp đi lặp lại thành hook dùng lại được.",
  brief: `
<p>Hai bộ đếm trên màn hình cần cùng một logic. Thay vì copy state + 3 hàm hai lần,
hãy viết <b>một custom hook</b>.</p>
<p>Yêu cầu: viết <code>useCounter(banDau)</code> trả về object
<code>{ count, tang, giam, reset }</code>, rồi dùng nó trong <code>BoDem</code>.</p>
<p>Custom hook chỉ là một <b>hàm thường</b> có tên bắt đầu bằng <code>use</code> và được phép gọi các hook khác.</p>`,
  goal: `<p>Hai bộ đếm hoạt động độc lập: bấm + / − / reset ở bộ này không ảnh hưởng bộ kia.</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// TODO 1: viết custom hook useCounter(banDau)
//   - bên trong dùng useState(banDau)
//   - trả về { count, tang, giam, reset }


function BoDem({ ten, banDau }) {
  // TODO 2: dùng useCounter thay cho code thủ công
  const count = banDau;

  return (
    <View style={styles.box}>
      <Text style={styles.ten}>{ten}</Text>
      <Text style={styles.num}>{count}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={function () {}}><Text style={styles.btnText}>−</Text></Pressable>
        <Pressable style={styles.btn} onPress={function () {}}><Text style={styles.btnText}>+</Text></Pressable>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <BoDem ten="Táo" banDau={0} />
      <BoDem ten="Cam" banDau={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, backgroundColor: '#0f172a' },
  box: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center' },
  ten: { color: '#94a3b8', fontSize: 13 },
  num: { color: '#a78bfa', fontSize: 30, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});`,
  solution: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Custom hook = hàm thường, tên bắt đầu bằng "use", bên trong được gọi hook khác.
// Mỗi component gọi nó sẽ có MỘT bản state riêng — không dùng chung.
function useCounter(banDau) {
  const [count, setCount] = useState(banDau);
  function tang() { setCount(function (c) { return c + 1; }); }
  function giam() { setCount(function (c) { return c - 1; }); }
  function reset() { setCount(banDau); }
  return { count: count, tang: tang, giam: giam, reset: reset };
}

function BoDem({ ten, banDau }) {
  const { count, tang, giam } = useCounter(banDau);

  return (
    <View style={styles.box}>
      <Text style={styles.ten}>{ten}</Text>
      <Text style={styles.num}>{count}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={giam}><Text style={styles.btnText}>−</Text></Pressable>
        <Pressable style={styles.btn} onPress={tang}><Text style={styles.btnText}>+</Text></Pressable>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <BoDem ten="Táo" banDau={0} />
      <BoDem ten="Cam" banDau={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, backgroundColor: '#0f172a' },
  box: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center' },
  ten: { color: '#94a3b8', fontSize: 13 },
  num: { color: '#a78bfa', fontSize: 30, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});`,
  hints: [
    "Custom hook không có gì huyền bí: <code>function useCounter(banDau) { const [count, setCount] = useState(banDau); ... return { count, tang, giam, reset }; }</code>",
    "Trong BoDem: <code>const { count, tang, giam } = useCounter(banDau);</code> — xoá dòng <code>const count = banDau;</code>.",
    "Gắn hàm vào nút: <code>onPress={tang}</code> và <code>onPress={giam}</code> (truyền tên hàm, không gọi)."
  ],
  explain: `
<p>Mỗi lần một component gọi <code>useCounter()</code>, nó nhận <b>một bộ state riêng</b>.
Hook chia sẻ <b>logic</b>, không chia sẻ <b>dữ liệu</b> — đây là điểm nhiều người hiểu nhầm.</p>
<p>Quy tắc đặt tên <code>useXxx</code> không phải cho đẹp: nhờ nó mà React và ESLint biết đây là hook
để áp dụng "quy tắc của hook" (chỉ gọi ở cấp cao nhất, không trong if/for).</p>
<p>Trong app thật bạn sẽ viết đủ loại: <code>useDebounce</code>, <code>useCart</code>,
<code>useAuth</code>, <code>useKeyboardHeight</code>...</p>`,
  checks: [
    { label: "Có khai báo custom hook tên useCounter",
      test: "return /(function\\s+useCounter|(const|let|var)\\s+useCounter\\s*=)/.test(src) || 'Chưa thấy useCounter';" },
    { label: "BoDem dùng useCounter",
      test: "return /useCounter\\s*\\(/.test(src) && !/const\\s+count\\s*=\\s*banDau/.test(src) || 'BoDem vẫn dùng const count = banDau';" },
    { label: "Bộ đếm Táo bắt đầu từ 0, Cam từ 10",
      test: "var t=text(); return (t.includes('0') && t.includes('10')) || ('Màn hình: ' + t.replace(/\\n/g,' | '));" },
    { label: "Bấm + ở bộ đếm đầu thì chỉ nó tăng",
      test: "var plus=qa('div').filter(function(e){return e.textContent==='+'}); expect(plus.length>=2,'Không tìm thấy 2 nút +'); var before=text(); await press(plus[0]); return (text()!==before) || 'Bấm + không làm số đổi';" },
    { label: "Hai bộ đếm độc lập (số 10 của Cam không đổi khi bấm ở Táo)",
      test: "var plus=qa('div').filter(function(e){return e.textContent==='+'}); await press(plus[0]); return text().includes('10') || 'Bộ đếm Cam đã bị ảnh hưởng — state đang bị dùng chung';" }
  ]
},

/* ================== PHASE 5 — DANH SÁCH & TỔNG HỢP ================== */
{
  id: "16", phase: "5", phaseName: "Phase 5 · Danh sách & tổng hợp",
  title: "FlatList render ra danh sách trống",
  kind: "fix",
  objective: "Nhớ đúng chữ ký của renderItem và vai trò của keyExtractor.",
  brief: `
<p>Dữ liệu có 4 món nhưng màn hình trống trơn (chỉ thấy dấu gạch phân cách).
Không có lỗi đỏ nào — <code>undefined</code> hiển thị ra... không gì cả.</p>
<p>Có <b>2 việc</b> phải làm:</p>
<ol>
  <li>Sửa <code>renderItem</code> cho đúng chữ ký.</li>
  <li>Thêm <code>keyExtractor</code> dùng trường <code>id</code> của mỗi món.</li>
</ol>`,
  goal: `<p>Bốn dòng: Phở bò, Bún chả, Cơm tấm, Bánh mì — kèm giá.</p>`,
  codeTitle: "App.js",
  code: `import { View, Text, FlatList, StyleSheet } from 'react-native';

const MON_AN = [
  { id: 'm1', ten: 'Phở bò', gia: 45000 },
  { id: 'm2', ten: 'Bún chả', gia: 40000 },
  { id: 'm3', ten: 'Cơm tấm', gia: 38000 },
  { id: 'm4', ten: 'Bánh mì', gia: 20000 },
];

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Thực đơn</Text>
      <FlatList
        data={MON_AN}
        renderItem={function (item) {
          return (
            <View style={styles.row}>
              <Text style={styles.ten}>{item.ten}</Text>
              <Text style={styles.gia}>{item.gia} đ</Text>
            </View>
          );
        }}
        ItemSeparatorComponent={function () { return <View style={styles.sep} />; }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 28, paddingHorizontal: 14, backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  ten: { color: '#e2e8f0', fontSize: 15 },
  gia: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#1e293b' },
});`,
  solution: `import { View, Text, FlatList, StyleSheet } from 'react-native';

const MON_AN = [
  { id: 'm1', ten: 'Phở bò', gia: 45000 },
  { id: 'm2', ten: 'Bún chả', gia: 40000 },
  { id: 'm3', ten: 'Cơm tấm', gia: 38000 },
  { id: 'm4', ten: 'Bánh mì', gia: 20000 },
];

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Thực đơn</Text>
      <FlatList
        data={MON_AN}
        keyExtractor={function (item) { return item.id; }}
        renderItem={function (info) {
          // FlatList truyền vào MỘT OBJECT { item, index, separators }
          const item = info.item;
          return (
            <View style={styles.row}>
              <Text style={styles.ten}>{item.ten}</Text>
              <Text style={styles.gia}>{item.gia} đ</Text>
            </View>
          );
        }}
        ItemSeparatorComponent={function () { return <View style={styles.sep} />; }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 28, paddingHorizontal: 14, backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  ten: { color: '#e2e8f0', fontSize: 15 },
  gia: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#1e293b' },
});`,
  hints: [
    "FlatList KHÔNG truyền phần tử thẳng vào renderItem. Nó truyền một object <code>{ item, index, separators }</code>.",
    "Cách gọn nhất là destructuring ngay ở tham số: <code>renderItem={({ item }) =&gt; ( ... )}</code>",
    "keyExtractor: <code>keyExtractor={(item) =&gt; item.id}</code> — giúp React biết dòng nào là dòng nào khi danh sách đổi."
  ],
  explain: `
<p><code>renderItem={(item) =&gt; ...}</code> nhìn rất hợp lý nhưng sai: tham số đó thực ra là
<code>{ item, index, separators }</code>, nên <code>item.ten</code> chính là
<code>{item:..., index:...}.ten</code> → <code>undefined</code>. React hiển thị
<code>undefined</code> thành chuỗi rỗng, nên bạn không thấy lỗi mà chỉ thấy trống.</p>
<p><code>keyExtractor</code> cho FlatList một khoá ổn định theo từng phần tử. Thiếu nó,
khi chèn/xoá giữa danh sách React sẽ dựng lại nhầm dòng — trạng thái của item (ví dụ ô đang gõ dở)
nhảy lung tung.</p>`,
  checks: [
    { label: "Bốn món đều hiện trên màn hình",
      test: "var t=text(); var thieu=['Phở bò','Bún chả','Cơm tấm','Bánh mì'].filter(function(x){return t.indexOf(x)<0}); return thieu.length===0 || ('Chưa thấy: ' + thieu.join(', '));" },
    { label: "Giá tiền hiện đúng",
      test: "return text().includes('45000') || 'Chưa thấy giá 45000 của Phở bò';" },
    { label: "renderItem nhận object rồi lấy ra item",
      test: "return (/renderItem=\\{[^]{0,120}\\{\\s*item/.test(src) || /info\\.item|\\.item\\b/.test(src)) || 'renderItem vẫn đang coi tham số là phần tử';" },
    { label: "Có keyExtractor lấy theo id",
      test: "return (/keyExtractor\\s*=\\s*\\{/.test(src) && /\\.id/.test(src)) || 'Thiếu keyExtractor dùng item.id';" }
  ]
},

{
  id: "17", phase: "5", phaseName: "Phase 5 · Danh sách & tổng hợp",
  title: "Bộ lọc: đưa state lên component cha",
  kind: "fill",
  objective: "Hai component anh em chia sẻ dữ liệu qua state của cha (lifting state up).",
  brief: `
<p><code>BoLoc</code> (3 nút) và <code>DanhSach</code> là hai component anh em.
Nút bấm ở cái này phải đổi nội dung cái kia — mà anh em thì không nói chuyện trực tiếp được.</p>
<p>Cách làm: state <code>loai</code> nằm ở <b>cha</b> (App), truyền xuống hai đường:</p>
<ol>
  <li>Xuống <code>DanhSach</code>: giá trị <code>loai</code> để lọc.</li>
  <li>Xuống <code>BoLoc</code>: một <b>hàm callback</b> <code>onChon</code> để con báo ngược lên cha.</li>
</ol>`,
  goal: `<p>Bấm "Rau" → chỉ còn Rau muống, Cải xanh. Bấm "Tất cả" → hiện lại đủ 4 món.</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const HANG = [
  { id: 1, ten: 'Rau muống', loai: 'rau' },
  { id: 2, ten: 'Cải xanh', loai: 'rau' },
  { id: 3, ten: 'Thịt bò', loai: 'thit' },
  { id: 4, ten: 'Thịt gà', loai: 'thit' },
];

function BoLoc({ loai, onChon }) {
  const cacLoai = [
    { key: 'all', ten: 'Tất cả' },
    { key: 'rau', ten: 'Rau' },
    { key: 'thit', ten: 'Thịt' },
  ];
  return (
    <View style={styles.row}>
      {cacLoai.map(function (l) {
        return (
          // TODO 1: bấm vào thì gọi onChon(l.key)
          <Pressable key={l.key} style={[styles.tab, loai === l.key && styles.tabOn]} onPress={function () {}}>
            <Text style={styles.tabText}>{l.ten}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DanhSach({ loai }) {
  // TODO 2: nếu loai === 'all' thì lấy hết, ngược lại chỉ lấy món có h.loai === loai
  const hienThi = HANG;

  return (
    <View style={styles.list}>
      {hienThi.map(function (h) {
        return <Text key={h.id} style={styles.item}>{h.ten}</Text>;
      })}
    </View>
  );
}

export default function App() {
  // TODO 3: state loai nằm ở đây, mặc định 'all'; truyền xuống cả hai con
  return (
    <View style={styles.screen}>
      <BoLoc />
      <DanhSach />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0f172a' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1e293b' },
  tabOn: { backgroundColor: '#4f46e5' },
  tabText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  list: { marginTop: 16, alignItems: 'center', gap: 4 },
  item: { color: '#a78bfa', fontSize: 15 },
});`,
  solution: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const HANG = [
  { id: 1, ten: 'Rau muống', loai: 'rau' },
  { id: 2, ten: 'Cải xanh', loai: 'rau' },
  { id: 3, ten: 'Thịt bò', loai: 'thit' },
  { id: 4, ten: 'Thịt gà', loai: 'thit' },
];

function BoLoc({ loai, onChon }) {
  const cacLoai = [
    { key: 'all', ten: 'Tất cả' },
    { key: 'rau', ten: 'Rau' },
    { key: 'thit', ten: 'Thịt' },
  ];
  return (
    <View style={styles.row}>
      {cacLoai.map(function (l) {
        return (
          <Pressable
            key={l.key}
            style={[styles.tab, loai === l.key && styles.tabOn]}
            onPress={function () { onChon(l.key); }}
          >
            <Text style={styles.tabText}>{l.ten}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DanhSach({ loai }) {
  const hienThi = loai === 'all'
    ? HANG
    : HANG.filter(function (h) { return h.loai === loai; });

  return (
    <View style={styles.list}>
      {hienThi.map(function (h) {
        return <Text key={h.id} style={styles.item}>{h.ten}</Text>;
      })}
    </View>
  );
}

export default function App() {
  // State ở CHA — nơi gần nhất mà cả hai con đều với tới được
  const [loai, setLoai] = useState('all');

  return (
    <View style={styles.screen}>
      <BoLoc loai={loai} onChon={setLoai} />
      <DanhSach loai={loai} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0f172a' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1e293b' },
  tabOn: { backgroundColor: '#4f46e5' },
  tabText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  list: { marginTop: 16, alignItems: 'center', gap: 4 },
  item: { color: '#a78bfa', fontSize: 15 },
});`,
  hints: [
    "Trong App: <code>const [loai, setLoai] = useState('all');</code> rồi <code>&lt;BoLoc loai={loai} onChon={setLoai} /&gt;</code> và <code>&lt;DanhSach loai={loai} /&gt;</code>.",
    "Trong BoLoc, nút phải gọi callback: <code>onPress={() =&gt; onChon(l.key)}</code>.",
    "Trong DanhSach: <code>const hienThi = loai === 'all' ? HANG : HANG.filter(h =&gt; h.loai === loai);</code>"
  ],
  explain: `
<p><b>Lifting state up</b>: khi hai component cần chung một dữ liệu, đưa dữ liệu đó lên
tổ tiên chung gần nhất. Dữ liệu đi <b>xuống</b> bằng props, sự kiện đi <b>lên</b> bằng callback.
Luồng một chiều này là lý do React dễ suy luận hơn kiểu hai chiều.</p>
<p>Chú ý <code>hienThi</code> <b>không</b> phải state. Nó tính được từ <code>loai</code> + <code>HANG</code>,
nên cứ tính lại mỗi lần render. Đừng bao giờ nhân bản dữ liệu dẫn xuất vào state —
đó là nguồn gốc của bug "hai chỗ lệch nhau".</p>`,
  checks: [
    { label: "Ban đầu hiện đủ 4 mặt hàng",
      test: "var t=text(); var thieu=['Rau muống','Cải xanh','Thịt bò','Thịt gà'].filter(function(x){return t.indexOf(x)<0}); return thieu.length===0 || ('Chưa thấy: ' + thieu.join(', '));" },
    { label: "Bấm 'Rau' thì chỉ còn 2 món rau",
      test: "await press('Rau'); var t=text(); return (t.includes('Rau muống') && t.includes('Cải xanh') && !t.includes('Thịt bò')) || ('Sau khi lọc, danh sách là: ' + t.replace(/\\n/g,' | '));" },
    { label: "Bấm 'Thịt' thì chỉ còn 2 món thịt",
      test: "await press('Thịt'); var t=text(); return (t.includes('Thịt bò') && t.includes('Thịt gà') && !t.includes('Rau muống')) || ('Sau khi lọc, danh sách là: ' + t.replace(/\\n/g,' | '));" },
    { label: "Bấm 'Tất cả' thì quay lại đủ 4 món",
      test: "await press('Rau'); await press('Tất cả'); var t=text(); return (t.includes('Rau muống') && t.includes('Thịt gà')) || ('Danh sách là: ' + t.replace(/\\n/g,' | '));" },
    { label: "State nằm ở App và truyền xuống bằng props",
      test: "return (/useState\\s*\\(\\s*'all'\\s*\\)/.test(src) && /<BoLoc[^>]*onChon\\s*=/.test(src) && /<DanhSach[^>]*loai\\s*=/.test(src)) || 'App phải giữ state và truyền loai/onChon xuống hai con';" }
  ]
},

{
  id: "18", phase: "5", phaseName: "Phase 5 · Danh sách & tổng hợp",
  title: "Danh sách việc cần làm — ghép mọi thứ lại",
  kind: "fill",
  objective: "Tự ráp một màn hình thật: nhập, thêm, đánh dấu xong, xoá.",
  brief: `
<p>Bài tổng hợp. Khung sườn đã có, ba hàm xử lý đang để trống. Viết nốt:</p>
<ol>
  <li><code>them()</code> — thêm việc mới từ ô nhập; <b>bỏ qua nếu ô trống</b> (hoặc chỉ có dấu cách);
      thêm xong thì <b>xoá trắng ô nhập</b>.</li>
  <li><code>doiTrangThai(id)</code> — bật/tắt trạng thái <code>xong</code> của một việc.</li>
  <li><code>xoa(id)</code> — bỏ việc đó khỏi danh sách.</li>
</ol>
<p>Nhớ nguyên tắc bài 10: luôn tạo mảng MỚI.</p>`,
  goal: `<p>Gõ "Mua sữa" → bấm Thêm → dòng mới xuất hiện, ô nhập trống lại.
Bấm vào dòng → gạch ngang. Bấm ✕ → dòng biến mất. Ô trống bấm Thêm → không có gì xảy ra.</p>`,
  codeTitle: "App.js",
  code: `import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';

export default function App() {
  const [viec, setViec] = useState([{ id: 1, ten: 'Học React Native', xong: false }]);
  const [nhap, setNhap] = useState('');

  function them() {
    // TODO 1: bỏ qua nếu nhap.trim() rỗng
    //         thêm { id: Date.now(), ten: nhap.trim(), xong: false } vào cuối danh sách
    //         rồi setNhap('')
  }

  function doiTrangThai(id) {
    // TODO 2: đảo trường xong của đúng việc có id này (dùng map, tạo object mới)
  }

  function xoa(id) {
    // TODO 3: loại việc có id này ra khỏi danh sách (dùng filter)
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Việc cần làm ({viec.length})</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={nhap}
          onChangeText={setNhap}
          placeholder="Thêm việc..."
          placeholderTextColor="#64748b"
        />
        <Pressable style={styles.add} onPress={them}>
          <Text style={styles.addText}>Thêm</Text>
        </Pressable>
      </View>

      <FlatList
        data={viec}
        keyExtractor={function (item) { return String(item.id); }}
        renderItem={function (info) {
          const item = info.item;
          return (
            <View style={styles.row}>
              <Pressable style={styles.grow} onPress={function () { doiTrangThai(item.id); }}>
                <Text style={item.xong ? styles.done : styles.item}>{item.ten}</Text>
              </Pressable>
              <Pressable onPress={function () { xoa(item.id); }}>
                <Text style={styles.del}>✕</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 24, paddingHorizontal: 14, backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: '#e2e8f0', backgroundColor: '#1e293b' },
  add: { backgroundColor: '#4f46e5', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 },
  addText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  grow: { flex: 1 },
  item: { color: '#e2e8f0', fontSize: 14 },
  done: { color: '#64748b', fontSize: 14, textDecorationLine: 'line-through' },
  del: { color: '#ef4444', fontSize: 16, paddingHorizontal: 6 },
});`,
  solution: `import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';

export default function App() {
  const [viec, setViec] = useState([{ id: 1, ten: 'Học React Native', xong: false }]);
  const [nhap, setNhap] = useState('');

  function them() {
    const ten = nhap.trim();
    if (ten === '') return;                       // ô trống thì không làm gì
    setViec([...viec, { id: Date.now(), ten: ten, xong: false }]);
    setNhap('');                                  // dọn ô nhập
  }

  function doiTrangThai(id) {
    setViec(viec.map(function (v) {
      // chỉ thay phần tử trùng id, và thay bằng OBJECT MỚI
      return v.id === id ? { id: v.id, ten: v.ten, xong: !v.xong } : v;
    }));
  }

  function xoa(id) {
    setViec(viec.filter(function (v) { return v.id !== id; }));
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Việc cần làm ({viec.length})</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={nhap}
          onChangeText={setNhap}
          placeholder="Thêm việc..."
          placeholderTextColor="#64748b"
        />
        <Pressable style={styles.add} onPress={them}>
          <Text style={styles.addText}>Thêm</Text>
        </Pressable>
      </View>

      <FlatList
        data={viec}
        keyExtractor={function (item) { return String(item.id); }}
        renderItem={function (info) {
          const item = info.item;
          return (
            <View style={styles.row}>
              <Pressable style={styles.grow} onPress={function () { doiTrangThai(item.id); }}>
                <Text style={item.xong ? styles.done : styles.item}>{item.ten}</Text>
              </Pressable>
              <Pressable onPress={function () { xoa(item.id); }}>
                <Text style={styles.del}>✕</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 24, paddingHorizontal: 14, backgroundColor: '#0f172a' },
  title: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: '#e2e8f0', backgroundColor: '#1e293b' },
  add: { backgroundColor: '#4f46e5', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 },
  addText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  grow: { flex: 1 },
  item: { color: '#e2e8f0', fontSize: 14 },
  done: { color: '#64748b', fontSize: 14, textDecorationLine: 'line-through' },
  del: { color: '#ef4444', fontSize: 16, paddingHorizontal: 6 },
});`,
  hints: [
    "them(): <code>const ten = nhap.trim(); if (ten === '') return; setViec([...viec, { id: Date.now(), ten: ten, xong: false }]); setNhap('');</code>",
    "doiTrangThai(): dùng map, phần tử trùng id thì trả về object mới với <code>xong: !v.xong</code>, còn lại trả về nguyên <code>v</code>.",
    "xoa(): <code>setViec(viec.filter(v =&gt; v.id !== id));</code>"
  ],
  explain: `
<p>Ba thao tác này là bộ khung của gần như mọi màn hình danh sách trong app thật
(giỏ hàng, danh sách địa chỉ, wishlist):</p>
<ul>
<li><b>Thêm</b> → <code>[...cũ, mới]</code></li>
<li><b>Sửa một phần tử</b> → <code>map</code> + trả về object mới cho đúng phần tử</li>
<li><b>Xoá</b> → <code>filter</code></li>
</ul>
<p>Cả ba đều trả về mảng mới, không đụng vào mảng cũ — nhờ vậy React biết chắc có thay đổi
và render lại đúng phần cần thiết.</p>
<p>Kiểm tra <code>trim()</code> trước khi thêm là thói quen nhỏ nhưng cứu bạn khỏi
một loại bug rất phổ biến: danh sách đầy các dòng trắng.</p>`,
  checks: [
    { label: "Gõ 'Mua sữa' rồi bấm Thêm thì việc mới xuất hiện",
      test: "await type('Thêm việc', 'Mua sữa'); await press('Thêm'); return text().includes('Mua sữa') || ('Danh sách đang là: ' + text().replace(/\\n/g,' | '));" },
    { label: "Thêm xong thì ô nhập được xoá trắng",
      test: "await type('Thêm việc', 'Mua sữa'); await press('Thêm'); var i=q('input'); return (i && i.value==='') || ('Ô nhập vẫn còn chữ: ' + (q('input')||{}).value);" },
    { label: "Ô nhập trống thì bấm Thêm không tạo dòng rác",
      test: "function dem(){var m=text().match(/Việc cần làm \\((\\d+)\\)/); return m?parseInt(m[1],10):-1;} var truoc=dem(); await type('Thêm việc','   '); await press('Thêm'); var sau=dem(); return sau===truoc || ('Số việc tăng từ ' + truoc + ' lên ' + sau + ' — chuỗi toàn khoảng trắng vẫn bị thêm vào');" },
    { label: "Bấm vào một việc thì nó bị gạch ngang",
      test: "var el=findByText('Học React Native'); expect(el,'Không thấy việc mẫu'); await press(el); var e2=findByText('Học React Native'); var st=getComputedStyle(e2); return (st.textDecorationLine.indexOf('line-through')>=0) || ('Kiểu chữ hiện tại: ' + st.textDecorationLine);" },
    { label: "Bấm ✕ thì việc bị xoá khỏi danh sách",
      test: "var xs=qa('*').filter(function(e){return (e.textContent||'').trim()==='✕' && e.children.length===0}); expect(xs.length,'Không thấy nút ✕ nào'); await press(xs[0]); return !text().includes('Học React Native') || 'Việc vẫn còn trong danh sách';" },
    { label: "Dùng map/filter, không sửa mảng tại chỗ",
      test: "return (/\\.filter\\s*\\(/.test(src) && /\\.map\\s*\\(/.test(src) && !/viec\\s*\\.\\s*(push|splice)\\s*\\(/.test(src)) || 'Hãy dùng map và filter, đừng push/splice lên state';" }
  ]
}

];
