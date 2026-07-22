# 🔐 Nhập môn Authentication & Authorization

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, **không cần build tool**.
Chủ đề: giải mã các khái niệm hay gây mông lung — **session, bearer token, JWT, OAuth 2,
PKCE, OpenID Connect, SSO, login with code (OTP/magic link), device code, RBAC**.

Mỗi bài gồm 4 phần:
1. **Lý thuyết** ngắn, nhiều ví dụ đời thường (vé gửi xe, chìa khoá valet, phiếu hẹn…).
2. **Code demo** có tab + tô màu cú pháp (chủ yếu là HTTP request/response).
3. **Animation từng bước** — bấm "Bước tiếp" để xem luồng đăng nhập chạy, đồng thời tô sáng dòng code tương ứng.
4. **Trắc nghiệm** chấm điểm + giải thích ngay.

Có **thanh tiến độ** (lưu trong `localStorage`) và nút **Sáng/Tối**.

## Chạy

Vì đọc file qua `fetch`/script nên chạy qua static server (đừng mở bằng `file://`):

```bash
cd auth-course
python3 -m http.server 8080
# mở http://localhost:8080
```

## Lộ trình (12 bài)

- **Pha 0** — Nền tảng · AuthN vs AuthZ (401/403), session & cookie, bearer token & JWT
- **Pha 1** — OAuth 2.0 · bài toán uỷ quyền (chìa valet), Authorization Code flow, access/refresh token & scope, PKCE
- **Pha 2** — Danh tính & đăng nhập hiện đại · OpenID Connect ("Login with Google"), SSO (OIDC/SAML), login with code (OTP · magic link · passwordless)
- **Pha 3** — Thực chiến · Device Code flow & các grant khác (client credentials, implicit/ROPC đã khai tử), RBAC/ABAC + API key + passkey

## Cấu trúc

```
index.html        # trang chủ: lưới bài học + tiến độ
lesson.html       # template 1 bài (4 phần), đọc ?id=NN
styles.css        # design system + light/dark (màu chủ đạo ở khối :root — đỏ hồng)
common.js         # engine dùng chung: highlighter, step animation, quiz, progress, theme
lessons/
  00-index.js     # khởi tạo window.LESSONS = []
  NN.js           # mỗi bài = window.LESSONS.push({...})
```

Engine dùng chung với các khoá khác (networking / os / shell / gitlabci…); khoá này chỉ khác
`window.COURSE.slug`, màu accent trong `styles.css`, và nội dung `lessons/*.js`.

### Thêm một bài

Tạo `lessons/NN.js` theo schema của `lessons/01.js`, thêm `<script src="lessons/NN.js"></script>`
vào **cả** `index.html` và `lesson.html`.

> Lưu ý: trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`
> (JS sẽ hiểu là template interpolation).
