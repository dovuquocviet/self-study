/* ============================================================================
 * data.js — Toàn bộ nội dung khoá học React Native cho dân Java backend.
 * Mỗi bài: { id, phase, phaseName, title, objective, theory(HTML), code(RN),
 *            codeTitle, diagram, quiz[] }
 * theory viết bằng HTML (dùng <code>) để tránh đụng backtick của template string.
 * code phải `export default` một component và KHÔNG chứa dấu backtick.
 * ==========================================================================*/
window.LESSONS = [

/* ======================= PHASE 1 — NỀN TẢNG ======================= */
{
  id: "01", phase: "1", phaseName: "Phase 1 · Nền tảng React Native",
  title: "JSX & Component đầu tiên",
  objective: "Hiểu JSX là gì và viết một function component trả về UI.",
  theory: `
<p><b>Component</b> trong React Native giống như một <b>method trả về UI</b>. Một component
là một <b>function</b> trả về <b>JSX</b> — cú pháp trông như HTML nhưng thực chất là JavaScript.</p>
<h3>JSX là gì?</h3>
<p>JSX chỉ là "đường tắt". Khi bạn viết <code>&lt;Text&gt;Hi&lt;/Text&gt;</code>, nó được biên dịch
thành lời gọi hàm tạo phần tử. Bạn <b>nhúng biểu thức JS</b> vào JSX bằng dấu ngoặc nhọn <code>{ }</code>.</p>
<div class="callout java"><b>So với Java:</b> Nghĩ về component như một method <code>String render()</code>
trả về khối UI. Khác biệt: nó khai báo (declarative) — bạn mô tả UI <i>trông như thế nào</i>,
không phải từng bước vẽ.</div>
<h3>Quy tắc vàng</h3>
<ul>
<li>Tên component <b>viết hoa chữ đầu</b> (<code>App</code>, <code>Greeting</code>).</li>
<li>Phải trả về <b>đúng 1 phần tử gốc</b> (bọc trong 1 <code>&lt;View&gt;</code>).</li>
<li><code>export default</code> để file khác dùng được — ở đây là điểm khởi chạy app.</li>
</ul>`,
  code: `import { View, Text, StyleSheet } from 'react-native';

// Component = function trả về JSX. Tên viết hoa chữ đầu.
export default function App() {
  const name = 'Việt';          // JS thường
  const gio = new Date().getHours();

  return (
    <View style={styles.box}>
      {/* Nhúng biến JS vào JSX bằng { } */}
      <Text style={styles.title}>Xin chào, {name}! 👋</Text>
      <Text style={styles.sub}>Bây giờ là {gio} giờ.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  title: { color: '#ffb454', fontSize: 22, fontWeight: '700' },
  sub:   { color: '#93a1b1', marginTop: 8 },
});`,
  diagram: { type: "custom", id: "jsx-tree" },
  quiz: [
    { q: "Component trong React Native về bản chất là gì?", options: ["Một file XML", "Một function trả về JSX", "Một class bắt buộc kế thừa Component", "Một biến toàn cục"], correct: 1, explanation: "Cách hiện đại nhất: component là một function trả về JSX." },
    { q: "Muốn nhúng một biến JavaScript vào JSX, ta dùng?", options: ["Dấu ngoặc nhọn { }", "Dấu ngoặc vuông [ ]", "Dấu $ như trong template", "Không nhúng được"], correct: 0, explanation: "Dùng { } để nhúng bất kỳ biểu thức JS nào vào JSX." },
    { q: "Vì sao component phải viết hoa chữ cái đầu (App, Greeting)?", options: ["Chỉ là quy ước cho đẹp", "Để React phân biệt component với thẻ thường", "Bắt buộc bởi trình duyệt", "Không quan trọng"], correct: 1, explanation: "Chữ thường bị coi là thẻ built-in; chữ hoa mới được hiểu là component của bạn." }
  ]
},

{
  id: "02", phase: "1", phaseName: "Phase 1 · Nền tảng React Native",
  title: "Core Components: View, Text, Image, ScrollView",
  objective: "Nắm các 'viên gạch' dựng UI và khi nào dùng cái nào.",
  theory: `
<p>React Native <b>không dùng thẻ HTML</b>. Thay vào đó có các <b>core component</b> ánh xạ sang
UI gốc của iOS/Android:</p>
<table>
<tr><th>Component</th><th>Vai trò</th><th>Giống web</th></tr>
<tr><td><code>View</code></td><td>Khung chứa / bố cục</td><td><code>div</code></td></tr>
<tr><td><code>Text</code></td><td>Hiển thị chữ (bắt buộc bọc mọi chữ)</td><td><code>span/p</code></td></tr>
<tr><td><code>Image</code></td><td>Ảnh</td><td><code>img</code></td></tr>
<tr><td><code>ScrollView</code></td><td>Vùng cuộn được</td><td>div overflow:scroll</td></tr>
</table>
<div class="callout"><b>Lưu ý quan trọng:</b> Mọi đoạn chữ <b>phải</b> nằm trong <code>&lt;Text&gt;</code>.
Viết chữ trần trong <code>&lt;View&gt;</code> sẽ lỗi — khác hẳn HTML.</div>
<div class="callout java"><b>So với Java:</b> Giống như bạn không in ra String bừa bãi mà phải bọc trong
một widget (JLabel...). RN nghiêm ngặt về chuyện này.</div>`,
  code: `import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';

export default function App() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h}>Các viên gạch UI</Text>

      <Image
        style={styles.img}
        source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
      />

      <View style={styles.card}>
        <Text style={styles.t}>View là khung chứa.</Text>
        <Text style={styles.t}>Text để hiện chữ.</Text>
        <Text style={styles.t}>Cuộn xuống xem thêm...</Text>
      </View>

      {[1, 2, 3, 4].map((n) => (
        <View key={n} style={styles.card}>
          <Text style={styles.t}>Thẻ số {n}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#0f1216' },
  content: { padding: 16, alignItems: 'center' },
  h:    { color: '#ffb454', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  img:  { width: 64, height: 64, marginBottom: 12 },
  card: { backgroundColor: '#1e252e', borderRadius: 10, padding: 14, marginBottom: 10, width: '100%' },
  t:    { color: '#e7ecf2' },
});`,
  diagram: {
    type: "mermaid",
    caption: "Cây component của màn hình trên. <code>ScrollView</code> bọc mọi thứ để cuộn được.",
    src: `flowchart TD
  A["ScrollView (cuộn được)"] --> B["Text: tiêu đề"]
  A --> C["Image: logo"]
  A --> D["View: card"]
  D --> D1["Text"]
  D --> D2["Text"]
  A --> E["...nhiều card map ra"]`
  },
  quiz: [
    { q: "Đâu là component đúng để hiển thị một đoạn chữ?", options: ["<div>", "<Text>", "<p>", "<label>"], correct: 1, explanation: "RN dùng <Text>, không có thẻ HTML." },
    { q: "Điều gì xảy ra nếu viết chữ trần trong <View> mà không bọc <Text>?", options: ["Vẫn chạy bình thường", "Chữ tự căn giữa", "Lỗi — chữ phải nằm trong <Text>", "Chữ bị ẩn"], correct: 2, explanation: "RN bắt buộc mọi chữ phải trong <Text>." },
    { q: "Muốn một vùng nội dung dài có thể cuộn, dùng?", options: ["View", "ScrollView", "Image", "Text"], correct: 1, explanation: "ScrollView (hoặc FlatList cho danh sách lớn) cho phép cuộn." }
  ]
},

{
  id: "03", phase: "1", phaseName: "Phase 1 · Nền tảng React Native",
  title: "Props — truyền dữ liệu vào component",
  objective: "Tái sử dụng component bằng cách truyền dữ liệu qua props.",
  theory: `
<p><b>Props</b> (properties) là dữ liệu component <b>cha</b> truyền xuống component <b>con</b> — giống
<b>tham số của một hàm</b>.</p>
<div class="callout java"><b>So với Java:</b> Props chính là <b>tham số constructor / method</b>. Component
<code>Greeting(name, age)</code> giống <code>new Greeting("An", 20)</code>, nhưng viết dạng thẻ:
<code>&lt;Greeting name="An" age={20} /&gt;</code>.</div>
<h3>Đặc điểm cốt lõi</h3>
<ul>
<li>Props <b>chỉ đọc</b> (immutable) — con không được sửa props của mình.</li>
<li>Chuỗi truyền bằng <code>name="An"</code>; số/biến/biểu thức truyền trong <code>{ }</code>: <code>age={20}</code>.</li>
<li>Thường dùng <b>destructuring</b> cho gọn: <code>function Greeting({ name, age })</code>.</li>
</ul>`,
  code: `import { View, Text, StyleSheet } from 'react-native';

// Con: nhận props. Destructuring { name, age } cho gọn.
function Greeting({ name, age }) {
  return (
    <Text style={styles.item}>
      👤 {name} — {age} tuổi
    </Text>
  );
}

// Cha: dùng lại Greeting nhiều lần với dữ liệu khác nhau.
export default function App() {
  const people = [
    { name: 'An', age: 20 },
    { name: 'Bình', age: 25 },
    { name: 'Chi', age: 30 },
  ];
  return (
    <View style={styles.box}>
      <Greeting name="Việt" age={28} />
      {people.map((p, i) => (
        <Greeting key={i} name={p.name} age={p.age} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box:  { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f1216' },
  item: { color: '#e7ecf2', fontSize: 16, paddingVertical: 6 },
});`,
  diagram: { type: "custom", id: "props-flow" },
  quiz: [
    { q: "Props giống khái niệm nào nhất trong Java?", options: ["Biến static", "Tham số của method/constructor", "Exception", "Interface"], correct: 1, explanation: "Props là dữ liệu truyền vào, y như tham số hàm." },
    { q: "Component con có được phép sửa props nó nhận không?", options: ["Có, thoải mái", "Không — props chỉ đọc", "Chỉ sửa được số", "Chỉ khi dùng useState"], correct: 1, explanation: "Props là immutable; muốn dữ liệu thay đổi thì dùng state (bài sau)." },
    { q: "Cách truyền số 20 cho prop age đúng là?", options: ["age=\"20\"", "age={20}", "age=20", "age:(20)"], correct: 1, explanation: "Giá trị không phải chuỗi phải đặt trong { }: age={20}. age=\"20\" sẽ là chuỗi." }
  ]
},

{
  id: "04", phase: "1", phaseName: "Phase 1 · Nền tảng React Native",
  title: "StyleSheet & Flexbox",
  objective: "Tạo kiểu bằng StyleSheet và bố cục bằng Flexbox.",
  theory: `
<p>RN tạo kiểu bằng <b>object JavaScript</b>, không phải file CSS. Tên thuộc tính viết
<b>camelCase</b> (<code>backgroundColor</code> chứ không phải <code>background-color</code>).</p>
<h3>Flexbox — công cụ bố cục chính</h3>
<p>Mọi <code>View</code> mặc định là một flex container. Ba thuộc tính hay dùng nhất:</p>
<ul>
<li><code>flexDirection</code>: <code>'column'</code> (mặc định, xếp dọc) hoặc <code>'row'</code> (xếp ngang).</li>
<li><code>justifyContent</code>: căn theo <b>trục chính</b> (flex-start / center / space-between...).</li>
<li><code>alignItems</code>: căn theo <b>trục phụ</b> (vuông góc trục chính).</li>
</ul>
<div class="callout"><b>Khác web:</b> Mặc định của RN là <code>flexDirection: 'column'</code> (web là row).
Dùng <code>flex: 1</code> để một View "ăn hết" không gian còn lại.</div>
<div class="callout java"><b>So với Java:</b> Giống các LayoutManager (BorderLayout, GridBagLayout) nhưng
thống nhất một mô hình duy nhất — Flexbox — cho mọi bố cục.</div>`,
  code: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      {/* Thử đổi flexDirection thành 'column', justifyContent thành 'center' */}
      <View style={[styles.box, { backgroundColor: '#ff9e64' }]}>
        <Text style={styles.t}>1</Text>
      </View>
      <View style={[styles.box, { backgroundColor: '#6ad0ff' }]}>
        <Text style={styles.t}>2</Text>
      </View>
      <View style={[styles.box, { backgroundColor: '#6ee7a8' }]}>
        <Text style={styles.t}>3</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',            // thử 'column'
    justifyContent: 'space-around',  // thử 'center'
    alignItems: 'center',
    backgroundColor: '#10151b',
  },
  box: { width: 60, height: 60, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  t:   { color: '#08151d', fontWeight: '800', fontSize: 18 },
});`,
  codeTitle: "Flexbox.js",
  diagram: { type: "custom", id: "flexbox" },
  quiz: [
    { q: "flexDirection mặc định trong React Native là?", options: ["row", "column", "row-reverse", "không có mặc định"], correct: 1, explanation: "RN mặc định 'column' (khác web mặc định 'row')." },
    { q: "Tên thuộc tính style trong RN viết theo kiểu?", options: ["kebab-case: background-color", "camelCase: backgroundColor", "snake_case: background_color", "UPPER: BACKGROUNDCOLOR"], correct: 1, explanation: "Style là object JS nên dùng camelCase." },
    { q: "Muốn một View chiếm hết không gian còn lại, ta đặt?", options: ["width: 100%", "flex: 1", "grow: true", "fill: 1"], correct: 1, explanation: "flex: 1 khiến View giãn ra lấp đầy phần còn trống." }
  ]
},

{
  id: "05", phase: "1", phaseName: "Phase 1 · Nền tảng React Native",
  title: "Render danh sách với .map() và key",
  objective: "Biến một mảng dữ liệu thành danh sách UI, hiểu vai trò của key.",
  theory: `
<p>Để hiển thị danh sách, ta <b>biến mảng dữ liệu thành mảng phần tử</b> bằng <code>.map()</code>
ngay trong JSX.</p>
<div class="callout java"><b>So với Java:</b> Giống <code>list.stream().map(...)</code> — nhưng kết quả là các
phần tử UI, và bạn nhúng thẳng vào JSX.</div>
<h3>key quan trọng thế nào?</h3>
<p>Mỗi phần tử trong danh sách cần một <b><code>key</code> duy nhất & ổn định</b>. React dùng key để
biết phần tử nào thêm/xoá/di chuyển khi dữ liệu đổi — giúp cập nhật nhanh và đúng.</p>
<div class="callout"><b>Mẹo:</b> Dùng <b>id thật</b> của dữ liệu làm key. Chỉ dùng index (<code>i</code>)
khi danh sách tĩnh, không thêm/xoá/sắp xếp.</div>`,
  code: `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  const todos = [
    { id: 't1', text: '🥋 Học JSX' },
    { id: 't2', text: '📦 Hiểu props' },
    { id: 't3', text: '🎨 Tập Flexbox' },
    { id: 't4', text: '🔁 Render danh sách' },
  ];

  return (
    <View style={styles.box}>
      <Text style={styles.h}>Việc cần làm</Text>
      {todos.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.t}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 18, backgroundColor: '#0f1216' },
  h:   { color: '#ffb454', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { backgroundColor: '#1e252e', borderRadius: 8, padding: 12, marginBottom: 8 },
  t:   { color: '#e7ecf2' },
});`,
  diagram: { type: "custom", id: "list-keys" },
  quiz: [
    { q: ".map() trong JSX dùng để làm gì?", options: ["Tạo Map như HashMap", "Biến mảng dữ liệu thành mảng phần tử UI", "Sắp xếp mảng", "Lọc mảng"], correct: 1, explanation: "map biến mỗi phần tử dữ liệu thành một phần tử UI." },
    { q: "key dùng để làm gì?", options: ["Trang trí", "Giúp React theo dõi phần tử nào thêm/xoá/di chuyển", "Bắt buộc để chạy, không có ý nghĩa", "Đặt màu cho phần tử"], correct: 1, explanation: "key giúp React so khớp phần tử qua các lần render, cập nhật hiệu quả." },
    { q: "Nên chọn giá trị nào làm key tốt nhất?", options: ["index i luôn luôn", "id duy nhất & ổn định của dữ liệu", "Math.random() mỗi lần render", "Số thứ tự ngẫu nhiên"], correct: 1, explanation: "id ổn định là tốt nhất; random mỗi render phá vỡ việc theo dõi." }
  ]
},

/* ======================= PHASE 2 — STATE & TƯƠNG TÁC ======================= */
{
  id: "06", phase: "2", phaseName: "Phase 2 · State & tương tác",
  title: "useState — trạng thái đầu tiên",
  objective: "Lưu dữ liệu thay đổi theo thời gian và khiến UI tự cập nhật.",
  theory: `
<p><b>State</b> là dữ liệu <b>thay đổi được</b> và <b>thuộc về</b> component. Khi state đổi, React
<b>tự render lại</b> component để UI khớp với dữ liệu mới.</p>
<h3>Hook useState</h3>
<p><code>const [count, setCount] = useState(0)</code> trả về:</p>
<ul>
<li><code>count</code>: giá trị hiện tại (khởi đầu = 0).</li>
<li><code>setCount</code>: hàm để <b>đổi</b> giá trị. <b>Luôn dùng hàm này</b>, đừng gán trực tiếp.</li>
</ul>
<div class="callout"><b>Cực kỳ quan trọng:</b> Gọi <code>setCount(...)</code> là cách duy nhất để UI cập nhật.
Sửa <code>count = count + 1</code> trực tiếp sẽ KHÔNG re-render.</div>
<div class="callout java"><b>So với Java:</b> Khác một field bình thường — đây là field "có quan sát". Đổi nó
sẽ tự động kích hoạt vẽ lại giao diện, không cần bạn gọi <code>repaint()</code> thủ công.</div>`,
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  // [giá trị, hàm đổi giá trị] = useState(giá trị ban đầu)
  const [count, setCount] = useState(0);

  return (
    <View style={styles.box}>
      <Text style={styles.num}>{count}</Text>
      <Pressable style={styles.btn} onPress={() => setCount(count + 1)}>
        <Text style={styles.btnText}>+1</Text>
      </Pressable>
      <Text style={styles.hint}>Bấm nút → setCount chạy → UI cập nhật</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  num:   { color: '#ffb454', fontSize: 64, fontWeight: '800' },
  btn:   { backgroundColor: '#6ad0ff', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, marginTop: 10 },
  btnText: { color: '#08151d', fontWeight: '800', fontSize: 18 },
  hint:  { color: '#93a1b1', marginTop: 16, fontSize: 12 },
});`,
  diagram: { type: "custom", id: "state-rerender" },
  quiz: [
    { q: "useState(0) trả về gì?", options: ["Chỉ giá trị", "Một cặp [giá trị, hàm cập nhật]", "Một Promise", "Một object rỗng"], correct: 1, explanation: "Trả về mảng [state, setState]; ta destructure ra 2 biến." },
    { q: "Cách nào KHÔNG khiến UI cập nhật?", options: ["setCount(count + 1)", "setCount(c => c + 1)", "count = count + 1", "Gọi hàm set từ onPress"], correct: 2, explanation: "Gán trực tiếp không kích hoạt re-render; phải dùng hàm setCount." },
    { q: "Khi state thay đổi, điều gì xảy ra?", options: ["Không có gì cho tới khi reload", "React render lại component để cập nhật UI", "App crash", "Phải gọi repaint() thủ công"], correct: 1, explanation: "Đổi state khiến React tự render lại — UI luôn khớp dữ liệu." }
  ]
},

{
  id: "07", phase: "2", phaseName: "Phase 2 · State & tương tác",
  title: "Xử lý sự kiện — onPress",
  objective: "Phản hồi thao tác của người dùng bằng các handler sự kiện.",
  theory: `
<p>Người dùng chạm nút → ta chạy một <b>hàm xử lý</b>. Nút bấm thường dùng <code>Pressable</code>
(linh hoạt) hoặc <code>Button</code> (đơn giản), gắn hàm vào <code>onPress</code>.</p>
<div class="callout"><b>Truyền hàm, đừng gọi hàm:</b> Viết <code>onPress={handlePress}</code> hoặc
<code>onPress={() => setX(1)}</code>. Nếu viết <code>onPress={handlePress()}</code> (có ngoặc) là bạn
<b>gọi ngay</b> lúc render — sai.</div>
<div class="callout java"><b>So với Java:</b> Giống gắn <code>ActionListener</code> / lambda vào nút. RN gọn hơn:
truyền thẳng một arrow function.</div>
<h3>Cập nhật dựa trên giá trị cũ</h3>
<p>Khi state mới phụ thuộc state cũ, dùng dạng hàm: <code>setCount(c => c + 1)</code> — an toàn hơn
khi có nhiều cập nhật liên tiếp.</p>`,
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  const tang = () => setCount(c => c + 1);
  const giam = () => setCount(c => c - 1);
  const reset = () => { setCount(0); console.log('Đã reset về 0'); };

  return (
    <View style={styles.box}>
      <Text style={styles.num}>{count}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={giam}><Text style={styles.bt}>−</Text></Pressable>
        <Pressable style={styles.btn} onPress={reset}><Text style={styles.bt}>0</Text></Pressable>
        <Pressable style={styles.btn} onPress={tang}><Text style={styles.bt}>+</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  num: { color: '#6ee7a8', fontSize: 60, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { backgroundColor: '#1e252e', width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a323d' },
  bt:  { color: '#e7ecf2', fontSize: 24, fontWeight: '700' },
});`,
  diagram: {
    type: "mermaid",
    caption: "Vòng lặp tương tác: chạm → handler → setState → render lại → UI mới.",
    src: `flowchart LR
  A["Người dùng chạm nút"] --> B["onPress chạy handler"]
  B --> C["setCount cập nhật state"]
  C --> D["React render lại"]
  D --> E["UI hiện số mới"]
  E -.-> A`
  },
  quiz: [
    { q: "Cách gắn handler đúng cho onPress?", options: ["onPress={handlePress()}", "onPress={handlePress}", "onPress=handlePress", "onClick={handlePress}"], correct: 1, explanation: "Truyền tham chiếu hàm (không có ngoặc). Có ngoặc là gọi ngay lúc render." },
    { q: "Khi giá trị mới phụ thuộc giá trị cũ, nên viết?", options: ["setCount(count + 1)", "setCount(c => c + 1)", "count++", "setCount(+1)"], correct: 1, explanation: "Dạng hàm c => c + 1 an toàn với nhiều cập nhật liên tiếp." },
    { q: "Component bấm nút thường dùng thuộc tính sự kiện nào trong RN?", options: ["onClick", "onTap", "onPress", "onTouch"], correct: 2, explanation: "RN dùng onPress (không phải onClick như web)." }
  ]
},

{
  id: "08", phase: "2", phaseName: "Phase 2 · State & tương tác",
  title: "TextInput & controlled input",
  objective: "Đọc dữ liệu người dùng nhập bằng ô nhập được kiểm soát.",
  theory: `
<p><code>TextInput</code> là ô nhập liệu. Trong React ta dùng <b>controlled input</b>: giá trị ô nhập
<b>do state quyết định</b>, và mỗi lần gõ ta cập nhật state.</p>
<h3>Vòng lặp 2 chiều</h3>
<ul>
<li><code>value={name}</code>: ô nhập luôn hiển thị đúng state.</li>
<li><code>onChangeText={setName}</code>: mỗi lần gõ → cập nhật state → re-render → ô nhập cập nhật.</li>
</ul>
<div class="callout"><b>Vì sao "controlled"?</b> Vì state là "nguồn sự thật" duy nhất. Bạn luôn biết chính xác
nội dung ô nhập, dễ kiểm tra/validate/format.</div>
<div class="callout java"><b>So với Java:</b> Thay vì hỏi widget "getText()" khi cần, RN làm ngược lại: state đẩy
giá trị vào widget. UI luôn phản chiếu dữ liệu.</div>`,
  code: `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  const [name, setName] = useState('');

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Tên của bạn:</Text>
      <TextInput
        style={styles.input}
        placeholder="Gõ vào đây..."
        placeholderTextColor="#5c6773"
        value={name}                 // state -> ô nhập
        onChangeText={setName}       // gõ -> cập nhật state
      />
      <Text style={styles.hello}>
        {name ? 'Xin chào, ' + name + '! 👋' : 'Hãy nhập tên của bạn.'}
      </Text>
      <Text style={styles.count}>Số ký tự: {name.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#0f1216' },
  label: { color: '#93a1b1', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#2a323d', borderRadius: 10, padding: 12, color: '#e7ecf2', backgroundColor: '#1e252e' },
  hello: { color: '#ffb454', fontSize: 18, marginTop: 18, fontWeight: '600' },
  count: { color: '#6ad0ff', marginTop: 6, fontSize: 12 },
});`,
  diagram: {
    type: "mermaid",
    caption: "Controlled input: state là nguồn sự thật; gõ phím chỉ cập nhật state, rồi state vẽ lại ô nhập.",
    src: `flowchart LR
  A["Người dùng gõ"] --> B["onChangeText"]
  B --> C["setName cập nhật state"]
  C --> D["Re-render"]
  D --> E["value={name} hiển thị"]
  E -.-> A`
  },
  quiz: [
    { q: "Trong controlled input, nội dung ô nhập được quyết định bởi?", options: ["Chính widget tự giữ", "State (qua prop value)", "Trình duyệt", "Không ai cả"], correct: 1, explanation: "value={state} khiến state là nguồn sự thật duy nhất." },
    { q: "Prop nào bắt sự kiện gõ chữ trong TextInput?", options: ["onChange", "onChangeText", "onInput", "onType"], correct: 1, explanation: "RN dùng onChangeText, trả thẳng chuỗi mới." },
    { q: "Nếu đặt value={name} nhưng KHÔNG có onChangeText thì?", options: ["Gõ bình thường", "Ô nhập gần như không gõ được (bị khoá theo state)", "App crash", "Tự thêm onChangeText"], correct: 1, explanation: "value cố định theo state; thiếu onChangeText thì state không đổi nên ô như bị khoá." }
  ]
},

{
  id: "09", phase: "2", phaseName: "Phase 2 · State & tương tác",
  title: "Conditional rendering — hiển thị có điều kiện",
  objective: "Hiển thị UI khác nhau tuỳ theo state.",
  theory: `
<p>Vì JSX là JavaScript, bạn dùng <b>logic JS thông thường</b> để chọn hiển thị cái gì:</p>
<ul>
<li><b>Toán tử 3 ngôi</b>: <code>{isOn ? &lt;Text&gt;BẬT&lt;/Text&gt; : &lt;Text&gt;TẮT&lt;/Text&gt;}</code></li>
<li><b>Short-circuit &&</b>: <code>{hasError && &lt;Text&gt;Lỗi!&lt;/Text&gt;}</code> — chỉ hiện khi điều kiện đúng.</li>
</ul>
<div class="callout"><b>Bẫy thường gặp:</b> Với <code>&&</code>, nếu vế trái là <b>số 0</b>, RN sẽ cố render số 0
và báo lỗi "text phải trong Text". Hãy dùng điều kiện boolean: <code>{count &gt; 0 && ...}</code>.</div>
<div class="callout java"><b>So với Java:</b> Không có "template if" riêng — chỉ là biểu thức JS. Giống bạn
dùng toán tử 3 ngôi để chọn giá trị, nhưng giá trị ở đây là cả một khối UI.</div>`,
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return (
    <View style={styles.box}>
      {/* Toán tử 3 ngôi chọn cả khối UI */}
      {loggedIn ? (
        <Text style={styles.ok}>✅ Đã đăng nhập. Xin chào!</Text>
      ) : (
        <Text style={styles.no}>🔒 Bạn chưa đăng nhập.</Text>
      )}

      {/* Short-circuit: chỉ hiện khi loggedIn = true */}
      {loggedIn && <Text style={styles.extra}>Bạn có 3 thông báo mới.</Text>}

      <Pressable style={styles.btn} onPress={() => setLoggedIn(v => !v)}>
        <Text style={styles.bt}>{loggedIn ? 'Đăng xuất' : 'Đăng nhập'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0f1216' },
  ok:    { color: '#6ee7a8', fontSize: 18, fontWeight: '700' },
  no:    { color: '#ff7a90', fontSize: 18, fontWeight: '700' },
  extra: { color: '#93a1b1', marginTop: 8 },
  btn:   { backgroundColor: '#ffb454', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 20 },
  bt:    { color: '#10161d', fontWeight: '800' },
});`,
  diagram: {
    type: "mermaid",
    caption: "State quyết định nhánh UI nào được render.",
    src: `flowchart TD
  A["state loggedIn"] -->|true| B["Hiện: Đã đăng nhập + thông báo"]
  A -->|false| C["Hiện: Chưa đăng nhập"]`
  },
  quiz: [
    { q: "Cách hiển thị UI có điều kiện phổ biến trong JSX?", options: ["Thẻ <if>", "Toán tử 3 ngôi và &&", "Vòng lặp for", "Annotation @If"], correct: 1, explanation: "JSX dùng biểu thức JS: ba ngôi ?: và short-circuit &&." },
    { q: "Rủi ro khi viết {count && <Text>...} với count là số?", options: ["Không sao", "Nếu count = 0, RN cố render 0 và báo lỗi", "Luôn crash", "Tự bỏ qua"], correct: 1, explanation: "0 là falsy nhưng vẫn bị render như text 0 → lỗi. Dùng count > 0 &&." },
    { q: "{isOn ? <A/> : <B/>} nghĩa là?", options: ["Luôn hiện A", "Hiện A nếu isOn đúng, ngược lại hiện B", "Hiện cả A và B", "Lỗi cú pháp"], correct: 1, explanation: "Toán tử 3 ngôi chọn giữa hai khối UI." }
  ]
},

{
  id: "10", phase: "2", phaseName: "Phase 2 · State & tương tác",
  title: "Lifting state up — nâng state lên cha",
  objective: "Chia sẻ state giữa các component anh em qua component cha.",
  theory: `
<p>Khi <b>hai component cần dùng chung</b> một dữ liệu, ta đặt state ở <b>component cha chung</b> gần
nhất, rồi truyền xuống: <b>giá trị</b> qua props, và <b>hàm cập nhật</b> cũng qua props.</p>
<h3>Dòng dữ liệu một chiều</h3>
<ul>
<li>Dữ liệu chảy <b>xuống</b>: cha → con qua props.</li>
<li>Sự kiện chảy <b>lên</b>: con gọi hàm callback do cha truyền xuống để "báo" cha cập nhật.</li>
</ul>
<div class="callout java"><b>So với Java:</b> Giống "state ở tầng service dùng chung", các controller con chỉ
nhận dữ liệu và gọi callback. Không con nào tự giữ bản sao riêng — tránh lệch dữ liệu.</div>`,
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Con A: chỉ hiển thị (nhận value)
function Display({ value }) {
  return <Text style={styles.num}>{value}</Text>;
}
// Con B: chỉ ra lệnh (nhận callback onAdd)
function Controls({ onAdd, onReset }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.btn} onPress={onReset}><Text style={styles.bt}>Reset</Text></Pressable>
      <Pressable style={styles.btn} onPress={onAdd}><Text style={styles.bt}>+1</Text></Pressable>
    </View>
  );
}

export default function App() {
  // State sống ở CHA — nguồn sự thật duy nhất
  const [count, setCount] = useState(0);
  return (
    <View style={styles.box}>
      <Display value={count} />
      <Controls onAdd={() => setCount(c => c + 1)} onReset={() => setCount(0)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  num: { color: '#ffb454', fontSize: 60, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { backgroundColor: '#1e252e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2a323d' },
  bt:  { color: '#e7ecf2', fontWeight: '700' },
});`,
  diagram: { type: "custom", id: "lifting-state" },
  quiz: [
    { q: "Khi hai component anh em cần dùng chung state, ta nên?", options: ["Copy state ở mỗi con", "Đặt state ở cha chung gần nhất rồi truyền xuống", "Dùng biến toàn cục", "Không chia sẻ được"], correct: 1, explanation: "Đó chính là 'lifting state up': nâng state lên cha chung." },
    { q: "Con báo cho cha cập nhật state bằng cách nào?", options: ["Sửa trực tiếp state của cha", "Gọi hàm callback mà cha truyền xuống qua props", "Dùng return", "Không thể báo"], correct: 1, explanation: "Cha truyền callback xuống; con gọi callback đó (sự kiện đi lên)." },
    { q: "Dòng dữ liệu trong React theo hướng nào?", options: ["Hai chiều tự do", "Một chiều: xuống qua props, sự kiện đi lên qua callback", "Chỉ đi lên", "Ngẫu nhiên"], correct: 1, explanation: "One-way data flow: props đi xuống, sự kiện đi lên." }
  ]
},

/* ======================= PHASE 3 — HOOKS & SIDE EFFECTS ======================= */
{
  id: "11", phase: "3", phaseName: "Phase 3 · Hooks & side effects",
  title: "useEffect — side effect & vòng đời",
  objective: "Chạy code phụ (timer, subscription...) đúng thời điểm trong vòng đời.",
  theory: `
<p><b>Side effect</b> là việc "ngoài render": gọi API, đặt timer, đăng ký sự kiện... <code>useEffect</code>
chạy code này <b>sau khi</b> component render.</p>
<h3>Dependency array quyết định "khi nào chạy"</h3>
<ul>
<li><code>useEffect(fn, [])</code>: chạy <b>1 lần</b> khi component xuất hiện (mount).</li>
<li><code>useEffect(fn, [x])</code>: chạy lại <b>mỗi khi x đổi</b>.</li>
<li><code>useEffect(fn)</code> (không array): chạy sau <b>mọi</b> lần render.</li>
</ul>
<h3>Cleanup — dọn dẹp</h3>
<p>Hàm <code>return</code> bên trong effect chạy khi component <b>biến mất</b> (unmount) hoặc trước khi
effect chạy lại. Dùng để <b>clearInterval</b>, huỷ subscription... tránh rò rỉ.</p>
<div class="callout java"><b>So với Java:</b> Gần giống <code>@PostConstruct</code> (mount) + <code>@PreDestroy</code>
(cleanup) gộp lại, nhưng gắn với dữ liệu qua dependency array.</div>`,
  code: `import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  const [sec, setSec] = useState(0);

  useEffect(() => {
    console.log('Effect chạy: bật đồng hồ');
    const id = setInterval(() => setSec(s => s + 1), 1000);

    // cleanup: dọn timer khi component biến mất
    return () => {
      clearInterval(id);
      console.log('Cleanup: tắt đồng hồ');
    };
  }, []); // [] = chỉ chạy 1 lần khi mount

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Đã trôi qua</Text>
      <Text style={styles.num}>{sec}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  label: { color: '#93a1b1' },
  num:   { color: '#6ad0ff', fontSize: 64, fontWeight: '800' },
});`,
  diagram: { type: "custom", id: "useeffect-lifecycle" },
  quiz: [
    { q: "useEffect(fn, []) với mảng rỗng chạy khi nào?", options: ["Sau mọi render", "Đúng 1 lần khi mount", "Không bao giờ", "Chỉ khi unmount"], correct: 1, explanation: "[] rỗng = không phụ thuộc gì, chỉ chạy 1 lần lúc mount." },
    { q: "Hàm return bên trong useEffect dùng để?", options: ["Trả kết quả effect", "Cleanup: dọn dẹp khi unmount / trước lần chạy sau", "Bắt buộc vô nghĩa", "Đổi state"], correct: 1, explanation: "Đó là cleanup — clearInterval, huỷ subscription..." },
    { q: "useEffect(fn, [count]) sẽ chạy lại khi nào?", options: ["Không bao giờ", "Mỗi khi count thay đổi", "Chỉ lúc mount", "Sau mọi render bất kể count"], correct: 1, explanation: "Có [count] nghĩa là chạy lại mỗi khi count đổi." }
  ]
},

{
  id: "12", phase: "3", phaseName: "Phase 3 · Hooks & side effects",
  title: "Fetch dữ liệu từ API",
  objective: "Tải dữ liệu từ server khi màn hình mở và hiển thị trạng thái loading.",
  theory: `
<p>Mẫu chuẩn: gọi API trong <code>useEffect</code> với <code>[]</code> (tải 1 lần khi mở màn hình),
lưu kết quả vào state, và quản lý ba trạng thái: <b>đang tải</b>, <b>thành công</b>, <b>lỗi</b>.</p>
<h3>3 biến state quen thuộc</h3>
<ul>
<li><code>loading</code>: đang tải hay chưa (hiện spinner).</li>
<li><code>data</code>: dữ liệu nhận được.</li>
<li><code>error</code>: thông báo nếu hỏng.</li>
</ul>
<div class="callout"><b>Bất đồng bộ:</b> <code>fetch</code> trả về Promise. Dùng <code>.then()</code> hoặc
<code>async/await</code>. Nhớ <code>.catch()</code> để bắt lỗi mạng.</div>
<div class="callout java"><b>So với Java:</b> Giống gọi REST bằng <code>CompletableFuture</code> — bất đồng bộ,
không chặn UI. Khác: kết quả về thì bạn setState, UI tự cập nhật.</div>`,
  code: `import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/users/1')
      .then(res => res.json())
      .then(data => { setUser(data); setLoading(false); })
      .catch(err => { setError('Lỗi mạng'); setLoading(false); });
  }, []); // tải 1 lần khi mở

  if (loading) return <View style={styles.box}><ActivityIndicator color="#6ad0ff" size="large" /></View>;
  if (error)   return <View style={styles.box}><Text style={styles.err}>{error}</Text></View>;

  return (
    <View style={styles.box}>
      <Text style={styles.h}>{user.name}</Text>
      <Text style={styles.t}>📧 {user.email}</Text>
      <Text style={styles.t}>🏙️ {user.address.city}</Text>
      <Text style={styles.t}>🏢 {user.company.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#0f1216' },
  h:   { color: '#ffb454', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  t:   { color: '#e7ecf2', marginTop: 4 },
  err: { color: '#ff7a90' },
});`,
  diagram: {
    type: "mermaid",
    caption: "Luồng tải dữ liệu: mount → fetch → cập nhật state → UI đổi theo từng trạng thái.",
    src: `flowchart TD
  A["Component mount"] --> B["useEffect chạy: fetch()"]
  B --> C{"Kết quả?"}
  C -->|Đang chờ| L["loading=true → spinner"]
  C -->|Thành công| D["setUser(data) → hiện thông tin"]
  C -->|Lỗi| E["setError → hiện lỗi"]`
  },
  quiz: [
    { q: "Nên gọi API tải lần đầu ở đâu?", options: ["Trực tiếp trong thân component", "Trong useEffect với []", "Trong styles", "Trong onPress bắt buộc"], correct: 1, explanation: "useEffect(…, []) chạy 1 lần khi mount — nơi lý tưởng để tải dữ liệu đầu." },
    { q: "Vì sao cần biến state loading?", options: ["Cho vui", "Để hiện spinner trong lúc chờ dữ liệu về", "Bắt buộc bởi fetch", "Để tăng tốc mạng"], correct: 1, explanation: "loading giúp hiển thị trạng thái chờ, tránh màn hình trống/hỏng." },
    { q: "fetch() trả về gì?", options: ["Dữ liệu ngay lập tức", "Một Promise (bất đồng bộ)", "Một mảng", "null"], correct: 1, explanation: "fetch trả Promise; xử lý bằng .then/.catch hoặc async/await." }
  ]
},

{
  id: "13", phase: "3", phaseName: "Phase 3 · Hooks & side effects",
  title: "useRef — tham chiếu & giá trị không gây re-render",
  objective: "Giữ một giá trị qua các lần render mà không kích hoạt render, và tham chiếu tới phần tử.",
  theory: `
<p><code>useRef</code> tạo một "hộp" <code>{ current: ... }</code> <b>tồn tại xuyên suốt</b> các lần render.
Đổi <code>ref.current</code> <b>KHÔNG</b> gây re-render (khác hẳn state).</p>
<h3>Hai công dụng chính</h3>
<ul>
<li><b>Tham chiếu phần tử UI</b>: gắn <code>ref={inputRef}</code> rồi gọi <code>inputRef.current.focus()</code>.</li>
<li><b>Lưu giá trị "bên lề"</b> không cần hiển thị: id timer, số lần render, giá trị trước đó...</li>
</ul>
<div class="callout"><b>useState hay useRef?</b> Nếu thay đổi cần <b>vẽ lại UI</b> → dùng state. Nếu chỉ cần <b>nhớ</b>
mà không cần vẽ lại → dùng ref.</div>`,
  code: `import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const inputRef = useRef(null);   // tham chiếu tới ô nhập
  const renders = useRef(0);       // đếm số lần render, KHÔNG gây render
  const [text, setText] = useState('');

  renders.current += 1;            // đổi ref, không re-render

  return (
    <View style={styles.box}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Bấm nút để tự focus"
        placeholderTextColor="#5c6773"
        value={text}
        onChangeText={setText}
      />
      <Pressable style={styles.btn} onPress={() => inputRef.current && inputRef.current.focus()}>
        <Text style={styles.bt}>🎯 Focus vào ô nhập</Text>
      </Pressable>
      <Text style={styles.hint}>Component đã render {renders.current} lần</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#0f1216' },
  input: { borderWidth: 1, borderColor: '#2a323d', borderRadius: 10, padding: 12, color: '#e7ecf2', backgroundColor: '#1e252e' },
  btn:   { backgroundColor: '#6ad0ff', padding: 12, borderRadius: 10, marginTop: 14, alignItems: 'center' },
  bt:    { color: '#08151d', fontWeight: '800' },
  hint:  { color: '#93a1b1', marginTop: 16, fontSize: 12, textAlign: 'center' },
});`,
  diagram: {
    type: "mermaid",
    caption: "So sánh: đổi state → re-render; đổi ref.current → KHÔNG re-render.",
    src: `flowchart LR
  S["setState(x)"] --> R1["Re-render UI"]
  F["ref.current = x"] --> R2["Không re-render (chỉ nhớ giá trị)"]`
  },
  quiz: [
    { q: "Đổi giá trị ref.current có gây re-render không?", options: ["Có, luôn luôn", "Không", "Chỉ khi là số", "Chỉ lần đầu"], correct: 1, explanation: "Ref thay đổi lặng lẽ, không kích hoạt render." },
    { q: "Khi nào nên dùng useRef thay vì useState?", options: ["Khi cần vẽ lại UI", "Khi chỉ cần nhớ giá trị mà không cần vẽ lại", "Không bao giờ", "Khi cần mảng"], correct: 1, explanation: "Ref để nhớ 'bên lề'; state để dữ liệu ảnh hưởng UI." },
    { q: "Cách truy cập phần tử qua ref?", options: ["ref.value", "ref.current", "ref.element", "ref()"], correct: 1, explanation: "Giá trị nằm ở ref.current." }
  ]
},

{
  id: "14", phase: "3", phaseName: "Phase 3 · Hooks & side effects",
  title: "useContext — chia sẻ dữ liệu toàn cục",
  objective: "Truyền dữ liệu cho cây component sâu mà không phải xâu chuỗi props.",
  theory: `
<p>Khi nhiều component ở nhiều tầng cần cùng một dữ liệu (theme, user đăng nhập, ngôn ngữ...), truyền
props qua từng tầng rất mệt ("prop drilling"). <b>Context</b> giải quyết việc này.</p>
<h3>3 bước dùng Context</h3>
<ol>
<li><b>Tạo</b>: <code>const ThemeContext = createContext(giá_trị_mặc_định)</code>.</li>
<li><b>Cung cấp</b>: bọc cây con trong <code>&lt;ThemeContext.Provider value={...}&gt;</code>.</li>
<li><b>Dùng</b>: bất kỳ con nào gọi <code>useContext(ThemeContext)</code> để lấy giá trị.</li>
</ol>
<div class="callout java"><b>So với Java:</b> Giống <b>dependency injection</b> — cung cấp một dịch vụ ở tầng cao,
mọi tầng dưới tự "inject" khi cần, không phải truyền tay qua từng lớp.</div>`,
  code: `import { createContext, useContext, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// 1. Tạo context
const ThemeContext = createContext('light');

// Con sâu bên trong — không nhận props theme, mà tự lấy từ context
function Badge() {
  const theme = useContext(ThemeContext);   // 3. Dùng
  const dark = theme === 'dark';
  return (
    <View style={[styles.badge, { backgroundColor: dark ? '#1e252e' : '#ffe9c7' }]}>
      <Text style={{ color: dark ? '#6ad0ff' : '#8a5a00', fontWeight: '700' }}>
        Theme hiện tại: {theme}
      </Text>
    </View>
  );
}

export default function App() {
  const [theme, setTheme] = useState('light');
  return (
    // 2. Cung cấp
    <ThemeContext.Provider value={theme}>
      <View style={styles.box}>
        <Badge />
        <Pressable style={styles.btn} onPress={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
          <Text style={styles.bt}>Đổi theme</Text>
        </Pressable>
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  badge: { padding: 14, borderRadius: 10 },
  btn:   { backgroundColor: '#ffb454', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, marginTop: 18 },
  bt:    { color: '#10161d', fontWeight: '800' },
});`,
  diagram: {
    type: "mermaid",
    caption: "Provider đặt giá trị ở trên; mọi component con lấy trực tiếp qua useContext, bỏ qua các tầng trung gian.",
    src: `flowchart TD
  P["ThemeContext.Provider (value=theme)"] --> A["View"]
  A --> B["Component trung gian"]
  B --> C["Badge: useContext lấy thẳng theme"]
  P -.giá trị.-> C`
  },
  quiz: [
    { q: "Context giúp giải quyết vấn đề gì?", options: ["Tốc độ render", "Prop drilling — truyền props qua nhiều tầng", "Lỗi cú pháp", "Quản lý CSS"], correct: 1, explanation: "Context cho phép con sâu lấy dữ liệu mà không xâu chuỗi props." },
    { q: "Component con lấy giá trị context bằng?", options: ["useState", "useContext(MyContext)", "useRef", "props.context"], correct: 1, explanation: "Gọi useContext(TheContext) để đọc giá trị hiện tại." },
    { q: "Context gần với khái niệm nào trong Java backend?", options: ["Exception handling", "Dependency injection", "Generics", "Threading"], correct: 1, explanation: "Giống DI: cung cấp ở trên, tầng dưới tự lấy khi cần." }
  ]
},

{
  id: "15", phase: "3", phaseName: "Phase 3 · Hooks & side effects",
  title: "Custom hook — tự đóng gói logic",
  objective: "Trích logic dùng chung ra một hàm hook tái sử dụng.",
  theory: `
<p><b>Custom hook</b> chỉ là một <b>function</b> tên bắt đầu bằng <code>use</code>, bên trong dùng các hook
khác (useState, useEffect...). Nó giúp <b>tách logic ra khỏi UI</b> để dùng lại ở nhiều nơi.</p>
<div class="callout java"><b>So với Java:</b> Giống trích một khối logic lặp lại ra một <b>helper method / service</b>
để nhiều nơi gọi chung — nguyên tắc DRY.</div>
<h3>Quy tắc</h3>
<ul>
<li>Tên phải bắt đầu bằng <code>use</code> (để React nhận diện là hook).</li>
<li>Trả về bất cứ gì tiện dùng: giá trị, hàm, object...</li>
<li>Mỗi component gọi hook có <b>state riêng biệt</b> — không dùng chung dữ liệu.</li>
</ul>`,
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Custom hook: đóng gói toàn bộ logic đếm
function useCounter(initial) {
  const [count, setCount] = useState(initial);
  const inc = () => setCount(c => c + 1);
  const dec = () => setCount(c => c - 1);
  const reset = () => setCount(initial);
  return { count, inc, dec, reset };   // trả ra cho component dùng
}

export default function App() {
  // Dùng lại logic; UI gọn hơn hẳn
  const a = useCounter(0);
  const b = useCounter(10);   // state riêng, độc lập

  return (
    <View style={styles.box}>
      <Row label="Bộ đếm A" c={a} />
      <Row label="Bộ đếm B" c={b} />
    </View>
  );
}

function Row({ label, c }) {
  return (
    <View style={styles.card}>
      <Text style={styles.l}>{label}: {c.count}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={c.dec}><Text style={styles.bt}>−</Text></Pressable>
        <Pressable style={styles.btn} onPress={c.reset}><Text style={styles.bt}>↺</Text></Pressable>
        <Pressable style={styles.btn} onPress={c.inc}><Text style={styles.bt}>+</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box:  { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f1216' },
  card: { backgroundColor: '#171c23', borderRadius: 12, padding: 16, marginBottom: 14 },
  l:    { color: '#ffb454', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  row:  { flexDirection: 'row', gap: 10 },
  btn:  { backgroundColor: '#1e252e', width: 46, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a323d' },
  bt:   { color: '#e7ecf2', fontSize: 20, fontWeight: '700' },
});`,
  diagram: {
    type: "mermaid",
    caption: "Logic đếm được rút vào useCounter; nhiều component dùng lại, mỗi nơi có state riêng.",
    src: `flowchart TD
  H["useCounter (logic dùng chung)"] --> A["Bộ đếm A: state riêng"]
  H --> B["Bộ đếm B: state riêng"]`
  },
  quiz: [
    { q: "Điều kiện tên của một custom hook?", options: ["Bắt đầu bằng use", "Viết hoa toàn bộ", "Kết thúc bằng Hook", "Bất kỳ tên nào"], correct: 0, explanation: "Phải bắt đầu bằng 'use' để React áp dụng quy tắc hook." },
    { q: "Hai component cùng gọi useCounter(0) thì?", options: ["Dùng chung một state", "Mỗi component có state riêng, độc lập", "Chỉ component đầu chạy được", "Gây lỗi"], correct: 1, explanation: "Mỗi lần gọi hook tạo state riêng cho component đó." },
    { q: "Mục đích chính của custom hook?", options: ["Tăng tốc app", "Tách & tái sử dụng logic có state, tránh lặp", "Thay thế CSS", "Bắt buộc phải có"], correct: 1, explanation: "Custom hook giúp DRY: gói logic để nhiều nơi dùng lại." }
  ]
},

{
  id: "16", phase: "3", phaseName: "Phase 3 · Hooks & side effects",
  title: "useReducer — state phức tạp",
  objective: "Quản lý state có nhiều hành động bằng reducer thay vì nhiều useState rời rạc.",
  theory: `
<p>Khi state phức tạp (nhiều trường, nhiều loại thao tác), <code>useReducer</code> gom mọi logic cập nhật
vào <b>một hàm reducer</b> thuần: <code>(state, action) =&gt; state mới</code>.</p>
<h3>Ba mảnh ghép</h3>
<ul>
<li><b>state</b>: dữ liệu hiện tại.</li>
<li><b>action</b>: một object mô tả "muốn làm gì", ví dụ <code>{ type: 'inc' }</code>.</li>
<li><b>dispatch(action)</b>: "gửi" action → reducer tính ra state mới.</li>
</ul>
<div class="callout java"><b>So với Java:</b> Rất giống mẫu <b>Command + state machine</b>: dispatch giống gửi một
command, reducer là bộ chuyển trạng thái tập trung, dễ test vì là hàm thuần.</div>`,
  code: `import { useReducer } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Reducer thuần: nhận state cũ + action, trả state mới
function reducer(state, action) {
  switch (action.type) {
    case 'inc':   return { count: state.count + 1 };
    case 'dec':   return { count: state.count - 1 };
    case 'reset': return { count: 0 };
    default:      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <View style={styles.box}>
      <Text style={styles.num}>{state.count}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => dispatch({ type: 'dec' })}><Text style={styles.bt}>−</Text></Pressable>
        <Pressable style={styles.btn} onPress={() => dispatch({ type: 'reset' })}><Text style={styles.bt}>↺</Text></Pressable>
        <Pressable style={styles.btn} onPress={() => dispatch({ type: 'inc' })}><Text style={styles.bt}>+</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1216' },
  num: { color: '#6ee7a8', fontSize: 64, fontWeight: '800', marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { backgroundColor: '#1e252e', width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a323d' },
  bt:  { color: '#e7ecf2', fontSize: 22, fontWeight: '700' },
});`,
  diagram: {
    type: "mermaid",
    caption: "dispatch gửi action → reducer tính state mới → UI render lại. Logic tập trung một chỗ.",
    src: `flowchart LR
  A["dispatch({type:'inc'})"] --> B["reducer(state, action)"]
  B --> C["state mới"]
  C --> D["Re-render UI"]`
  },
  quiz: [
    { q: "Reducer có dạng chữ ký nào?", options: ["() => state", "(state, action) => state mới", "(action) => void", "(state) => action"], correct: 1, explanation: "Reducer nhận (state, action) và trả về state mới." },
    { q: "Để kích hoạt thay đổi state với useReducer, ta gọi?", options: ["setState", "dispatch(action)", "reducer() trực tiếp", "useState"], correct: 1, explanation: "dispatch(action) gửi action cho reducer xử lý." },
    { q: "useReducer phù hợp khi nào hơn useState?", options: ["Luôn luôn", "Khi state phức tạp/nhiều loại thao tác cần logic tập trung", "Khi chỉ có 1 boolean", "Không bao giờ"], correct: 1, explanation: "State phức tạp với nhiều action gom về reducer sẽ gọn & dễ test." }
  ]
},

/* ======================= PHASE 4 — ỨNG DỤNG THỰC TẾ ======================= */
{
  id: "17", phase: "4", phaseName: "Phase 4 · Ứng dụng thực tế",
  title: "FlatList — danh sách hiệu năng cao",
  objective: "Hiển thị danh sách dài mượt mà bằng FlatList thay vì map trong ScrollView.",
  theory: `
<p>Với danh sách dài (hàng trăm, hàng nghìn dòng), <b>đừng</b> dùng <code>map</code> trong
<code>ScrollView</code> — nó dựng <b>tất cả</b> một lúc, rất nặng. Dùng <code>FlatList</code>: nó
<b>chỉ render những gì đang hiển thị</b> (virtualization).</p>
<h3>Props cốt lõi</h3>
<ul>
<li><code>data</code>: mảng dữ liệu.</li>
<li><code>renderItem={({ item }) =&gt; ...}</code>: cách vẽ một dòng.</li>
<li><code>keyExtractor={item =&gt; item.id}</code>: lấy key duy nhất cho mỗi dòng.</li>
</ul>
<div class="callout java"><b>So với Java:</b> Giống RecyclerView của Android — tái sử dụng ô hiển thị, chỉ dựng
phần trong tầm nhìn. Hiệu năng tốt cho danh sách lớn.</div>`,
  code: `import { FlatList, View, Text, StyleSheet } from 'react-native';

export default function App() {
  // 200 dòng — FlatList vẫn mượt vì chỉ render phần đang thấy
  const data = Array.from({ length: 200 }, (_, i) => ({
    id: String(i),
    title: 'Sản phẩm #' + (i + 1),
    price: (i + 1) * 1000,
  }));

  return (
    <FlatList
      style={styles.list}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.t}>{item.title}</Text>
          <Text style={styles.p}>{item.price.toLocaleString()}đ</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0f1216' },
  row:  { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e252e' },
  t:    { color: '#e7ecf2' },
  p:    { color: '#6ee7a8', fontWeight: '700' },
});`,
  diagram: {
    type: "mermaid",
    caption: "FlatList chỉ dựng các dòng trong tầm nhìn (+ đệm), tái dùng khi cuộn — không dựng cả 200 dòng.",
    src: `flowchart TD
  D["data: 200 phần tử"] --> F["FlatList"]
  F --> V["Chỉ render ~10 dòng đang hiển thị"]
  V --> S["Cuộn → tái dùng ô, render dòng mới"]`
  },
  quiz: [
    { q: "Vì sao ưu tiên FlatList hơn map trong ScrollView cho danh sách dài?", options: ["Cú pháp ngắn hơn", "FlatList chỉ render phần đang hiển thị (virtualization)", "Không có lý do", "FlatList đổi màu tự động"], correct: 1, explanation: "FlatList virtualize — chỉ dựng phần trong tầm nhìn, tiết kiệm bộ nhớ." },
    { q: "Prop nào định nghĩa cách vẽ mỗi dòng?", options: ["data", "renderItem", "keyExtractor", "style"], correct: 1, explanation: "renderItem={({item}) => ...} quyết định UI của một dòng." },
    { q: "FlatList tương tự thành phần nào bên Android?", options: ["Activity", "RecyclerView", "Fragment", "Intent"], correct: 1, explanation: "Ý tưởng virtualization/tái sử dụng ô giống RecyclerView." }
  ]
},

{
  id: "18", phase: "4", phaseName: "Phase 4 · Ứng dụng thực tế",
  title: "Điều hướng giữa các màn hình (Navigation)",
  objective: "Hiểu mô hình chuyển màn hình; mô phỏng bằng state trước khi dùng thư viện.",
  theory: `
<p>App thật có nhiều <b>màn hình</b> (Home, Chi tiết, Cài đặt...). Thư viện chuẩn là
<b>React Navigation</b> (<code>@react-navigation</code>) với mô hình <b>stack</b>: mở màn mới thì
"đẩy" lên chồng, back thì "gỡ" ra.</p>
<div class="callout"><b>Trong bài này</b> ta <b>mô phỏng</b> navigation bằng một state <code>screen</code> để bạn
thấy bản chất: chuyển màn = đổi state → render màn tương ứng. App thật dùng thư viện để có back,
animation, truyền tham số... sẵn.</div>
<div class="callout java"><b>So với Java:</b> Stack navigation giống ngăn xếp lời gọi / back-stack của
Activity trên Android: push để vào, pop để quay lại.</div>`,
  code: `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function Home({ go }) {
  return (
    <View style={[styles.screen, { backgroundColor: '#0f1216' }]}>
      <Text style={styles.h}>🏠 Trang chủ</Text>
      <Pressable style={styles.btn} onPress={() => go('detail')}>
        <Text style={styles.bt}>Mở chi tiết →</Text>
      </Pressable>
    </View>
  );
}
function Detail({ go }) {
  return (
    <View style={[styles.screen, { backgroundColor: '#141a21' }]}>
      <Text style={styles.h}>📄 Màn chi tiết</Text>
      <Pressable style={styles.btn} onPress={() => go('home')}>
        <Text style={styles.bt}>← Quay lại</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');   // "router" tối giản
  return screen === 'home'
    ? <Home go={setScreen} />
    : <Detail go={setScreen} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  h:   { color: '#ffb454', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  btn: { backgroundColor: '#6ad0ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  bt:  { color: '#08151d', fontWeight: '800' },
});`,
  diagram: {
    type: "mermaid",
    caption: "Stack navigation: push để mở màn mới, pop (back) để quay lại màn trước.",
    src: `flowchart LR
  H["Home"] -->|"push('detail')"| D["Detail"]
  D -->|"pop / back"| H`
  },
  quiz: [
    { q: "Thư viện điều hướng phổ biến nhất cho React Native?", options: ["react-router-dom", "@react-navigation", "expo-router-legacy", "rn-nav"], correct: 1, explanation: "React Navigation là lựa chọn chuẩn (Expo Router xây trên nó)." },
    { q: "Trong stack navigation, mở một màn mới gọi là?", options: ["pop", "push (đẩy lên chồng)", "replace bắt buộc", "clear"], correct: 1, explanation: "Push đẩy màn mới lên đỉnh stack; back sẽ pop ra." },
    { q: "Ở bản mô phỏng bằng state, việc 'chuyển màn' thực chất là?", options: ["Tải lại toàn app", "Đổi state screen → render màn tương ứng", "Gọi API", "Mở tab trình duyệt"], correct: 1, explanation: "Đổi state khiến App render component màn hình khác — đó là bản chất." }
  ]
},

{
  id: "19", phase: "4", phaseName: "Phase 4 · Ứng dụng thực tế",
  title: "useMemo & useCallback — tối ưu re-render",
  objective: "Tránh tính toán lại tốn kém và giữ tham chiếu hàm ổn định.",
  theory: `
<p>Mỗi lần render, mọi thứ trong component chạy lại. Nếu có <b>tính toán nặng</b> hoặc bạn truyền
<b>hàm</b> xuống con đã được tối ưu, hãy "ghi nhớ" chúng.</p>
<ul>
<li><code>useMemo(() =&gt; tính(), [deps])</code>: nhớ <b>kết quả</b> tính toán; chỉ tính lại khi deps đổi.</li>
<li><code>useCallback(fn, [deps])</code>: nhớ <b>chính hàm</b>; giữ tham chiếu ổn định qua các lần render.</li>
</ul>
<div class="callout"><b>Đừng lạm dụng:</b> Chỉ dùng khi có vấn đề hiệu năng thật. Ghi nhớ cũng tốn chi phí;
với tính toán nhẹ thì không cần.</div>
<div class="callout java"><b>So với Java:</b> Giống <b>caching/memoization</b> một kết quả theo tham số đầu vào —
chỉ tính lại khi đầu vào thay đổi.</div>`,
  code: `import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

function slow(n) {
  let s = 0;
  for (let i = 0; i < n * 200000; i++) s += i;   // giả lập tính nặng
  return s;
}

export default function App() {
  const [count, setCount] = useState(1);
  const [text, setText] = useState('');

  // Chỉ tính lại khi count đổi — gõ text KHÔNG kích hoạt tính lại
  const total = useMemo(() => {
    console.log('⚙️ Tính lại slow(count)...');
    return slow(count);
  }, [count]);

  return (
    <View style={styles.box}>
      <Text style={styles.t}>count = {count}, kết quả nặng = {total}</Text>
      <Pressable style={styles.btn} onPress={() => setCount(c => c + 1)}>
        <Text style={styles.bt}>count +1 (sẽ tính lại)</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder="Gõ đây — KHÔNG tính lại (xem console)"
        placeholderTextColor="#5c6773"
        value={text}
        onChangeText={setText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box:   { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0f1216' },
  t:     { color: '#e7ecf2', marginBottom: 14 },
  btn:   { backgroundColor: '#ffb454', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
  bt:    { color: '#10161d', fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#2a323d', borderRadius: 10, padding: 12, color: '#e7ecf2', backgroundColor: '#1e252e' },
});`,
  diagram: {
    type: "mermaid",
    caption: "useMemo bỏ qua tính lại khi dependency không đổi; chỉ tính lại đúng khi cần.",
    src: `flowchart TD
  R["Component render"] --> Q{"Dependency đổi?"}
  Q -->|Có| C["Tính lại & nhớ kết quả"]
  Q -->|Không| M["Dùng lại kết quả đã nhớ (bỏ qua tính)"]`
  },
  quiz: [
    { q: "useMemo ghi nhớ điều gì?", options: ["Chính hàm", "Kết quả của một phép tính", "Toàn bộ component", "Danh sách state"], correct: 1, explanation: "useMemo nhớ kết quả; useCallback nhớ hàm." },
    { q: "useMemo(() => f(), [count]) tính lại khi nào?", options: ["Mọi render", "Chỉ khi count đổi", "Không bao giờ", "Khi bất kỳ state nào đổi"], correct: 1, explanation: "Chỉ tính lại khi dependency (count) thay đổi." },
    { q: "Nguyên tắc dùng useMemo/useCallback?", options: ["Bọc mọi thứ luôn cho chắc", "Chỉ dùng khi có vấn đề hiệu năng thực sự", "Không bao giờ dùng", "Chỉ dùng với string"], correct: 1, explanation: "Lạm dụng gây phức tạp & tốn chi phí; dùng khi thật cần." }
  ]
},

{
  id: "20", phase: "4", phaseName: "Phase 4 · Ứng dụng thực tế",
  title: "Mini project: App To-Do hoàn chỉnh",
  objective: "Ghép mọi thứ đã học: state, input, danh sách, sự kiện, conditional.",
  theory: `
<p>Đây là bài tổng hợp. App To-Do dùng đủ bộ kỹ năng:</p>
<ul>
<li><b>useState</b>: mảng công việc + nội dung ô nhập.</li>
<li><b>TextInput</b> controlled: nhập việc mới.</li>
<li><b>Sự kiện</b>: thêm / gạch hoàn thành / xoá.</li>
<li><b>FlatList</b>: hiển thị danh sách.</li>
<li><b>Conditional</b>: đổi kiểu chữ khi việc đã xong.</li>
</ul>
<div class="callout"><b>Bất biến (immutability):</b> Đừng sửa mảng cũ. Tạo mảng <b>mới</b> bằng spread
<code>[...todos, newItem]</code> hay <code>.map()</code>/<code>.filter()</code> rồi setState. React so sánh
tham chiếu để biết cần render lại.</div>
<div class="callout java"><b>Thử thách:</b> Hãy sửa code — thêm nút "Xoá tất cả", hay đếm số việc chưa xong.
Bạn đã đủ công cụ để tự làm!</div>`,
  code: `import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';

export default function App() {
  const [todos, setTodos] = useState([
    { id: '1', text: 'Học React Native', done: true },
    { id: '2', text: 'Làm app To-Do', done: false },
  ]);
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    // tạo MẢNG MỚI (bất biến), không sửa mảng cũ
    setTodos([...todos, { id: Date.now().toString(), text: text.trim(), done: false }]);
    setText('');
  };
  const toggle = (id) =>
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id) =>
    setTodos(todos.filter(t => t.id !== id));

  const left = todos.filter(t => !t.done).length;

  return (
    <View style={styles.box}>
      <Text style={styles.h}>📝 Việc cần làm — còn {left}</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Thêm việc mới..."
          placeholderTextColor="#5c6773"
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <Pressable style={styles.addBtn} onPress={add}><Text style={styles.addBt}>+</Text></Pressable>
      </View>

      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={{ flex: 1 }} onPress={() => toggle(item.id)}>
              <Text style={[styles.t, item.done && styles.doneT]}>
                {item.done ? '✅ ' : '⬜ '}{item.text}
              </Text>
            </Pressable>
            <Pressable onPress={() => remove(item.id)}><Text style={styles.del}>🗑️</Text></Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box:    { flex: 1, padding: 16, paddingTop: 28, backgroundColor: '#0f1216' },
  h:      { color: '#ffb454', fontSize: 20, fontWeight: '800', marginBottom: 14 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  input:  { flex: 1, borderWidth: 1, borderColor: '#2a323d', borderRadius: 10, padding: 11, color: '#e7ecf2', backgroundColor: '#1e252e' },
  addBtn: { backgroundColor: '#6ee7a8', width: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addBt:  { color: '#08130c', fontSize: 24, fontWeight: '800' },
  row:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171c23', borderRadius: 10, padding: 12, marginBottom: 8 },
  t:      { color: '#e7ecf2', fontSize: 15 },
  doneT:  { color: '#5c6773', textDecorationLine: 'line-through' },
  del:    { fontSize: 16, marginLeft: 8 },
});`,
  codeTitle: "TodoApp.js",
  diagram: {
    type: "mermaid",
    caption: "Kiến trúc app: một mảng state là nguồn sự thật; các hành động tạo mảng MỚI rồi setState → FlatList vẽ lại.",
    src: `flowchart TD
  S["state: todos[] (nguồn sự thật)"] --> L["FlatList render danh sách"]
  A["add / toggle / remove"] --> N["Tạo mảng MỚI (spread/map/filter)"]
  N --> S
  I["TextInput (controlled)"] --> A`
  },
  quiz: [
    { q: "Để thêm 1 việc, cách đúng với tính bất biến là?", options: ["todos.push(item)", "setTodos([...todos, item])", "todos[todos.length] = item", "todos.add(item)"], correct: 1, explanation: "Tạo mảng mới bằng spread rồi setState; không mutate mảng cũ." },
    { q: "Để đánh dấu 1 việc done, ta dùng?", options: [".forEach sửa trực tiếp", "todos.map(t => t.id===id ? {...t, done:!t.done} : t)", "delete todos[id]", "todos.done = true"], correct: 1, explanation: "map tạo mảng mới, thay phần tử khớp id bằng object mới." },
    { q: "Vì sao phải tạo mảng/đối tượng MỚI thay vì sửa cái cũ?", options: ["Cho đẹp", "React so sánh tham chiếu để biết cần render lại", "Bắt buộc bởi FlatList", "Để tiết kiệm RAM"], correct: 1, explanation: "React dựa vào thay đổi tham chiếu để phát hiện state đã đổi." }
  ]
}

];
