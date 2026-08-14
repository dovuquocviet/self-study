# React Native — Thực hành (sửa lỗi & viết bổ sung)

Khoá **thực hành**, đi kèm khoá lý thuyết `react-native-course/`. Không có bài đọc, không có
trắc nghiệm — mỗi bài là một file `App.js` **đang sai** hoặc **còn thiếu**, bạn sửa rồi bấm
**▶ Chạy & Chấm**.

18 bài, 2 dạng:

| Dạng | Việc phải làm |
|------|---------------|
| **Tìm & sửa lỗi** (`fix`) | Code chạy sai (hoặc không chạy). Đọc lỗi/nhìn màn hình, tìm chỗ hỏng. |
| **Viết bổ sung** (`fill`) | Code có sẵn khung, các chỗ `// TODO` để trống cho bạn viết. |

## Mỗi bài gồm 4 phần

1. **Đề bài** — yêu cầu + kết quả mong đợi.
2. **Editor + khung điện thoại** — sửa code, bấm ▶ (hoặc `⌘/Ctrl + Enter`).
   Có **Console & Stack trace**: lỗi in ra kèm **code frame** trỏ đúng dòng bạn viết.
3. **Kết quả chấm** — danh sách mục kiểm tra ✓/✗, mục nào trượt có kèm lý do cụ thể
   (ví dụ: *"Trước khi bấm là 0, sau khi bấm vẫn là 0 — UI chưa vẽ lại"*).
4. **Gợi ý & đáp án** — gợi ý mở dần từng cái một; đáp án xem sau cùng, có nút nạp thẳng vào editor.

Qua hết mục kiểm tra thì bài tự đánh dấu hoàn thành. Code bạn viết được lưu trong
`localStorage` nên đóng tab mở lại vẫn còn.

## Chạy

Cần HTTP server (dùng ES module + importmap, không mở bằng `file://`):

```bash
cd /Volumes/KINGSTON/self-study
python3 -m http.server 8080
# mở http://localhost:8080/react-native-practice/
```

Lần chạy đầu cần internet để tải `react-native-web` từ esm.sh. Babel/marked lấy từ
`../react-native-course/vendor/` (offline).

## Cấu trúc

| File | Vai trò |
|------|---------|
| `index.html` | Danh sách bài + tiến độ |
| `lesson.html` | Khung một bài (4 phần) |
| `data.js` | **Toàn bộ 18 bài** (`window.EXERCISES`) |
| `app.js` | Render đề bài, chấm, gợi ý/đáp án, tiến độ |
| `runtime.js` | Editor chạy code + **bộ chấm bài** + stack trace |
| `styles.css` | Giao diện (accent indigo) |
| `../code-editor.js` | Editor tô màu cú pháp — **dùng chung** với khoá lý thuyết |

Tiến độ lưu ở key `rn_practice_progress` (đã khai báo trong `sync.js` để đồng bộ đa thiết bị).

## Bộ chấm hoạt động thế nào

`checks` của mỗi bài là các đoạn JS chạy **ngay trong iframe** sau khi app render xong,
nên chấm được cả hành vi thật lẫn nội dung code:

```js
checks: [
  { label: "Bấm Tăng thì con số tăng lên",
    test: "var a=text(); await press('Tăng'); return text()!==a || 'UI chưa vẽ lại';" }
]
```

Hàm dùng được trong `test`:

| Hàm | Ý nghĩa |
|-----|---------|
| `text()` | Toàn bộ chữ đang hiển thị trên màn hình |
| `q(sel)` / `qa(sel)` / `count(sel)` | Truy vấn DOM đã render |
| `findByText(t)` | Phần tử mang đoạn chữ `t` (ưu tiên khớp chính xác) |
| `press(target)` | Bấm — `target` là chuỗi chữ hoặc phần tử |
| `type(placeholder, value)` | Gõ vào `TextInput` |
| `wait(ms)` / `until(fn, ms)` | Chờ |
| `expect(cond, msg)` | Ném lỗi nếu sai |
| `logs` | Mọi dòng console của app |
| `src` | Chính source code người học đang viết (để kiểm tra cách viết) |

Trả về `true` = qua, `false` hoặc **một chuỗi** = trượt (chuỗi đó hiện lên làm lý do).

> Ghi chú kỹ thuật: `press()` phát cụm `mousedown → mouseup → click`.
> react-native-web bắn `onPress` từ sự kiện **click**; thiếu nó thì bấm giả lập không ăn.

## Thêm bài mới

Thêm một object vào `window.EXERCISES` trong `data.js`
(mô tả đầy đủ các trường ở đầu file). Lưu ý: `code`/`solution` **không được chứa dấu backtick**.

Có sẵn một harness tự kiểm tra (không commit, khớp `.gitignore`):
`_test.html` chạy **đáp án** của mọi bài (phải qua hết check) và **code khởi đầu**
(phải trượt ít nhất một check). Mở nó qua HTTP server rồi đọc `window.__RESULTS`.
