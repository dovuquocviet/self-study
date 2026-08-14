# React Native cho dân Java backend

Khoá học tương tác, tự chạy trong trình duyệt — **không cần build tool**. Mỗi bài gồm 4 phần:

1. **Lý thuyết** ngắn gọn (có ô "So với Java" để bắc cầu).
2. **Code demo sửa được + ▶ Run** — như Expo Snack: sửa code React Native, bấm Run, xem app render ngay trong khung điện thoại, kèm Console.
3. **Sơ đồ minh hoạ** — nhiều bài có sơ đồ **tương tác** (bấm/kéo/đổi tuỳ chọn), số còn lại dùng Mermaid.
4. **Trắc nghiệm** phản hồi tức thì, có giải thích. Làm hết mới mở nút "Hoàn thành".

Tiến độ lưu trong `localStorage`.

## Chạy

Vì dùng ES module + importmap nên cần chạy qua HTTP (không mở bằng `file://`):

```bash
cd /Volumes/KINGSTON/react-native-course
python3 -m http.server 8080
# mở http://localhost:8080
```

> Phần "Run" tải `react-native-web` từ CDN **esm.sh** lần đầu → cần internet. Các thư viện còn lại
> (mermaid, marked, highlight, babel) đã nằm sẵn trong `vendor/` (offline).

## Cách hoạt động của editor (phần 2)

`runtime.js` = "Expo Snack" thu nhỏ:
1. Editor tô màu cú pháp (`../code-editor.js`, dùng chung mọi khoá) — textarea trong suốt
   nằm chồng lên một lớp <pre> đã tô màu.
2. Babel (vendor) transpile JSX của bạn ngay tại trang (`retainLines` để số dòng trong
   stack trace khớp code bạn viết).
3. Code được nhét vào `<iframe sandbox>` có **importmap** trỏ `react-native` → `react-native-web`.
4. `console.log` và lỗi trong iframe (lỗi in kèm code frame trỏ đúng dòng) được gửi về khung Console bằng `postMessage`.

Code demo **bắt buộc** `export default` một component và **không chứa dấu backtick** (\`).

## Cấu trúc

| File | Vai trò |
|------|---------|
| `index.html` | Trang chủ: danh sách bài + tiến độ |
| `lesson.html` | Khung 1 bài (4 mục) |
| `data.js` | **Toàn bộ nội dung** 20 bài (`window.LESSONS`) |
| `app.js` | Render 4 mục + quiz + tiến độ + điều hướng |
| `runtime.js` | Editor React Native chạy được (iframe + Babel) |
| `diagrams.js` | Các sơ đồ tương tác (`window.Diagrams[id]`) |
| `styles.css` | Dark theme |
| `vendor/` | mermaid, marked, highlight, babel (offline) |
| `../code-editor.js` | Editor tô màu cú pháp, dùng chung với khoá thực hành |

## Thêm một bài mới

Thêm một object vào mảng trong `data.js`:

```js
{
  id: "21", phase: "4", phaseName: "Phase 4 · ...",
  title: "Tên bài",
  objective: "Mục tiêu 1 câu.",
  theory: `<p>HTML — dùng <code>...</code>, KHÔNG dùng backtick trong theory.</p>`,
  code: `import { View, Text } from 'react-native';
export default function App() { return <View><Text>Hi</Text></View>; }`,   // không có backtick bên trong
  codeTitle: "App.js",
  diagram: { type: "mermaid", src: "flowchart TD\n A-->B", caption: "..." },
  // hoặc: diagram: { type: "custom", id: "state-rerender" }  (khai báo trong diagrams.js)
  quiz: [
    { q: "Câu hỏi?", options: ["A","B","C"], correct: 1, explanation: "Vì sao B đúng." }
  ]
}
```

Sơ đồ tương tác có sẵn trong `diagrams.js`: `jsx-tree`, `props-flow`, `state-rerender`,
`useeffect-lifecycle`, `flexbox`, `list-keys`, `lifting-state`. Muốn thêm loại mới → viết
`D["ten-moi"] = function(container){ ... }`.

## Lộ trình 20 bài

- **Phase 1 — Nền tảng:** JSX & Component · Core Components · Props · StyleSheet & Flexbox · Danh sách + key
- **Phase 2 — State & tương tác:** useState · onPress · TextInput · Conditional rendering · Lifting state up
- **Phase 3 — Hooks:** useEffect · Fetch API · useRef · useContext · Custom hook · useReducer
- **Phase 4 — Thực tế:** FlatList · Navigation · useMemo/useCallback · Mini project To-Do
