# 🖥️ Nhập môn Hệ điều hành

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, **không cần build tool**.
Chủ đề: ai quản lý CPU, bộ nhớ, tiến trình, file — và quản lý thế nào.

Mỗi bài gồm 4 phần:
1. **Lý thuyết** ngắn, nhiều ví dụ đời thường.
2. **Code demo** có tab + tô màu cú pháp.
3. **Animation từng bước** — bấm "Bước tiếp" để xem cơ chế chạy, đồng thời tô sáng dòng code tương ứng.
4. **Trắc nghiệm** chấm điểm + giải thích ngay.

Có **thanh tiến độ** (lưu trong `localStorage`) và nút **Sáng/Tối**.

## Chạy

Vì đọc file qua `fetch`/script nên chạy qua static server (đừng mở bằng `file://`):

```bash
cd os-course
python3 -m http.server 8080
# mở http://localhost:8080
```

## Lộ trình (12 bài)

- **Pha 0** — Tổng quan · kernel/user, boot, system call
- **Pha 1** — Tiến trình & Luồng · process, thread, scheduling, IPC
- **Pha 2** — Đồng bộ hoá · race condition, mutex/semaphore, deadlock
- **Pha 3** — Bộ nhớ · cấp phát, bộ nhớ ảo & paging
- **Pha 4** — Lưu trữ & I/O · file system, interrupt

## Cấu trúc

```
index.html        # trang chủ: lưới bài học + tiến độ
lesson.html       # template 1 bài (4 phần), đọc ?id=NN
styles.css        # design system + light/dark (màu chủ đạo ở khối :root)
common.js         # engine: highlighter, step animation, quiz, progress, theme
lessons/
  00-index.js     # khởi tạo window.LESSONS = []
  NN.js           # mỗi bài = window.LESSONS.push({...})
```

Engine dùng chung cho cả 4 khoá (networking / os / auth / shell); mỗi khoá chỉ khác
`window.COURSE.slug`, màu accent trong `styles.css`, và nội dung `lessons/*.js`.

### Thêm một bài

Tạo `lessons/NN.js` theo schema của `lessons/01.js`, thêm `<script src="lessons/NN.js"></script>`
vào **cả** `index.html` và `lesson.html`. Kiểm tra bằng: `node ../validate-lessons.js os-course`.

> Lưu ý: trong chuỗi backtick (theory/stageHtml) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`
> (JS sẽ hiểu là template interpolation).
