# 🦊 Nhập môn GitLab CI/CD

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, **không cần build tool**.
Chủ đề: mỗi lần `git push`, để máy tự động **build – test – deploy** thay bạn.

Mỗi bài gồm 4 phần:
1. **Lý thuyết** ngắn, nhiều ví dụ đời thường.
2. **Code demo** có tab + tô màu cú pháp (chủ yếu là `.gitlab-ci.yml`).
3. **Animation từng bước** — bấm "Bước tiếp" để xem pipeline chạy, đồng thời tô sáng dòng YAML tương ứng.
4. **Trắc nghiệm** chấm điểm + giải thích ngay.

Có **thanh tiến độ** (lưu trong `localStorage`) và nút **Sáng/Tối**.

## Chạy

Vì đọc file qua `fetch`/script nên chạy qua static server (đừng mở bằng `file://`):

```bash
cd gitlabci-course
python3 -m http.server 8080
# mở http://localhost:8080
```

## Lộ trình (12 bài)

- **Pha 0** — Nền tảng · CI/CD là gì, kiến trúc GitLab CI (Runner, pipeline)
- **Pha 1** — Pipeline đầu tiên · job & script, stages, variables
- **Pha 2** — Truyền dữ liệu & điều khiển · artifacts, cache, rules, needs (DAG)
- **Pha 3** — Tổ chức & triển khai · tái sử dụng (extends/include), runner & executor, environments & deploy

## Cấu trúc

```
index.html        # trang chủ: lưới bài học + tiến độ
lesson.html       # template 1 bài (4 phần), đọc ?id=NN
styles.css        # design system + light/dark (màu chủ đạo ở khối :root — cam GitLab)
common.js         # engine dùng chung: highlighter, step animation, quiz, progress, theme
lessons/
  00-index.js     # khởi tạo window.LESSONS = []
  NN.js           # mỗi bài = window.LESSONS.push({...})
```

Engine dùng chung với các khoá khác (networking / os / shell…); khoá này chỉ khác
`window.COURSE.slug`, màu accent trong `styles.css`, và nội dung `lessons/*.js`.

### Thêm một bài

Tạo `lessons/NN.js` theo schema của `lessons/01.js`, thêm `<script src="lessons/NN.js"></script>`
vào **cả** `index.html` và `lesson.html`.

> Lưu ý: trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`
> (JS sẽ hiểu là template interpolation). Với biến GitLab, viết `$VAR` trong các mảng `lines`
> (chuỗi thường) là an toàn; tránh viết `${VAR}` bên trong `theory`/`stageHtml`.
