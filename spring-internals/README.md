# 🌱 Spring Internals

Website tự học **cơ chế bên trong Spring Framework** dành cho lập trình viên Java —
giải thích *ai* tạo bean, tạo *thế nào* và theo *thứ tự* gì, thay vì chỉ biết dùng annotation.

Vanilla HTML/CSS/JS, **không cần build**. Mở bằng static server là chạy.

## Chạy thử

```bash
python3 -m http.server 8080
# rồi mở http://localhost:8080
```

## Mỗi bài gồm 4 phần

1. **Lý thuyết** ngắn gọn
2. **Code demo** có tab + syntax highlight
3. **Animation từng bước** — bấm "Bước tiếp" để xem container chạy, đồng thời tô sáng dòng code tương ứng
4. **Trắc nghiệm** chấm điểm + giải thích

Có **thanh tiến độ** (lưu trong trình duyệt qua `localStorage`) và **chế độ Sáng/Tối**.

## Lộ trình 13 bài

| Pha | Bài |
|-----|-----|
| 0 · Bức tranh tổng | IoC & Dependency Injection |
| 1 · Container & Bean | Component Scanning · BeanDefinition & Registry · Vòng đời Bean · DI chuyên sâu (circular dependency, three-level cache) · Bean Scope |
| 2 · Cấu hình | @Configuration & @Bean (proxy CGLIB) · application.properties / Environment · Auto-configuration & @Conditional |
| 3 · Proxy & AOP | BeanPostProcessor · AOP & Proxy (@Transactional, @Async) |
| 4 · Khởi động & Web | SpringApplication.run() · DispatcherServlet |

## Cấu trúc

```
index.html          # trang chủ: grid bài học + thanh tiến độ
lesson.html         # template 1 trang, đọc ?id=NN
styles.css          # design system + light/dark theme
common.js           # engine: step-animation, quiz, progress, theme
lessons/
  00-index.js       # khởi tạo window.LESSONS = []
  NN-*.js           # mỗi bài = window.LESSONS.push({...})
```

### Thêm một bài mới

Tạo `lessons/NN-tên.js` theo schema của `lessons/01-ioc-di.js`, rồi thêm 1 dòng
`<script src="lessons/NN-tên.js"></script>` vào **cả** `index.html` và `lesson.html`.

> Lưu ý: không dùng `${...}` bên trong chuỗi backtick (theory/stageHtml) — JS sẽ hiểu là
> template interpolation. Escape thành `\${...}` hoặc đặt trong chuỗi nháy kép.
