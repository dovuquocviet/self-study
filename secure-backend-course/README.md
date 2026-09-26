# 🛡️ An toàn bảo mật khi code Backend

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, không cần build tool.
Lỗ hổng backend phổ biến và cách phòng thủ, không gắn với ngôn ngữ nào: mỗi lỗi đều có ví dụ ở nhiều ngôn ngữ để thấy hình dạng lỗi giống nhau.

Mỗi bài gồm 4 phần: lý thuyết → code demo có tab → animation từng bước → trắc nghiệm (thứ tự đáp án được xáo cố định theo từng câu). Nội dung tập trung vào phòng thủ; phần tấn công chỉ minh hoạ bằng placeholder.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/secure-backend-course/
```

## Lộ trình (27 bài · 279 câu trắc nghiệm)

**Pha 0 — Tư duy nền tảng**

- 01 · Tư duy bảo mật — nghĩ như kẻ tấn công
- 02 · Threat modeling & bản đồ OWASP Top 10
- 03 · Validate input đúng cách

**Pha 1 — Injection — khi dữ liệu biến thành lệnh**

- 04 · SQL Injection — lỗi kinh điển nhất
- 05 · NoSQL, LDAP, filter injection — không có SQL vẫn bị inject
- 06 · Gọi lệnh hệ điều hành an toàn (chống OS Command Injection)
- 07 · Template injection & Code injection (eval)
- 08 · Làm việc với file theo tên một cách an toàn (chống Path Traversal, Zip Slip)
- 09 · Parse dữ liệu có cấu trúc một cách an toàn (JSON, YAML, XML, serialize)

**Pha 2 — Xác thực & phiên đăng nhập**

- 10 · Lưu mật khẩu an toàn
- 11 · Đăng nhập an toàn
- 12 · Session & token

**Pha 3 — Phân quyền**

- 13 · Broken Access Control: IDOR/BOLA và BFLA
- 14 · Mass assignment, lỗi logic nghiệp vụ và race condition

**Pha 4 — Các lỗi phía web**

- 15 · XSS nhìn từ backend
- 16 · CSRF & CORS
- 17 · Gọi URL ra ngoài an toàn (chống SSRF)
- 18 · Redirect & header an toàn
- 19 · Nhận file upload an toàn

**Pha 5 — Dữ liệu & mật mã**

- 20 · Mật mã cho lập trình viên: dùng đúng, đừng tự chế
- 21 · Quản lý secret: không hardcode, không commit, không in ra log
- 22 · Chống lộ dữ liệu nhạy cảm: lỗi, response, log và file export

**Pha 6 — Vận hành & quy trình**

- 23 · Rate limiting & chống DoS ở tầng ứng dụng
- 24 · Supply chain & dependency — code bạn không viết cũng là code của bạn
- 25 · Security headers & cấu hình an toàn
- 26 · Logging, monitoring & phản ứng sự cố
- 27 · Secure SDLC — tổng kết khoá: đưa bảo mật vào mọi bước làm phần mềm

## Cấu trúc

Giống các khoá khác (auth-course, networking-course…): `index.html`, `lesson.html`, `common.js` (engine), `styles.css`, `lessons/NN.js`.
Thêm bài: tạo `lessons/NN.js` và thêm `<script>` vào cả `index.html` lẫn `lesson.html`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
