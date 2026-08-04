# 💠 Nhập môn GraphQL

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, **không cần build tool**.
Chủ đề: đi từ "vì sao lại đẻ ra GraphQL" tới những thứ chỉ gặp khi làm thật —
**schema & type system, query/mutation/subscription, resolver, N+1 & DataLoader,
pagination kiểu cursor, null bubbling, normalized cache, complexity limit, Federation**.

Mỗi bài gồm 4 phần:
1. **Lý thuyết** ngắn, nhiều ví dụ đời thường (thực đơn set sẵn vs gọi món, đặt báo dài hạn…).
2. **Code demo** có tab + tô màu cú pháp (SDL, query, resolver JS, log SQL).
3. **Animation từng bước** — bấm "Bước tiếp" để xem query chạy qua schema → resolver → database,
   đồng thời tô sáng dòng code tương ứng.
4. **Trắc nghiệm** chấm điểm + giải thích ngay.

Có **thanh tiến độ** (lưu trong `localStorage`) và nút **Sáng/Tối**.

## Chạy

Vì đọc file qua `fetch`/script nên chạy qua static server (đừng mở bằng `file://`):

```bash
cd graphql-course
python3 -m http.server 8080
# mở http://localhost:8080
```

## Lộ trình (14 bài)

- **Pha 0** — Nền tảng · vì sao có GraphQL (over/under-fetching), schema & type system (SDL, `!`, `[ ]`), query đầu tiên (selection set, tham số, hình dạng response)
- **Pha 1** — Ngôn ngữ truy vấn · biến/alias/fragment/directive, mutation (input & payload type), subscription (WebSocket, pub/sub), enum · interface · union · `__typename`
- **Pha 2** — Bên trong server · resolver (parent/args/context/info), N+1 & DataLoader, pagination offset vs cursor (chuẩn Connection), lỗi & null bubbling
- **Pha 3** — Thực chiến · client & normalized cache (fetch policy, optimistic UI), bảo mật (auth theo field, depth/complexity limit, persisted query), thiết kế schema · Federation · khi nào KHÔNG nên dùng GraphQL

## Cấu trúc

```
index.html        # trang chủ: lưới bài học + tiến độ
lesson.html       # template 1 bài (4 phần), đọc ?id=NN
styles.css        # design system + light/dark (màu chủ đạo ở khối :root — hồng sen)
common.js         # engine dùng chung: highlighter, step animation, quiz, progress, theme
lessons/
  00-index.js     # khởi tạo window.LESSONS = []
  NN.js           # mỗi bài = window.LESSONS.push({...})
```

Engine dùng chung với các khoá khác (networking / os / shell / gitlabci / auth…); khoá này chỉ khác
`window.COURSE.slug`, màu accent trong `styles.css`, và nội dung `lessons/*.js`.

### Thêm một bài

Tạo `lessons/NN.js` theo schema của `lessons/01.js`, thêm `<script src="lessons/NN.js"></script>`
vào **cả** `index.html` và `lesson.html`.

> Lưu ý: trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`
> (JS sẽ hiểu là template interpolation).
