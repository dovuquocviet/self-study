# 📱 An toàn bảo mật khi code Mobile

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, không cần build tool.
Bảo mật app mobile không phụ thuộc nền tảng: ví dụ song song Android (Kotlin), iOS (Swift), React Native, Flutter.

Mỗi bài gồm 4 phần: lý thuyết → code demo có tab → animation từng bước → trắc nghiệm (thứ tự đáp án được xáo cố định theo từng câu). Nội dung tập trung vào phòng thủ; phần tấn công chỉ minh hoạ bằng placeholder.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/secure-mobile-course/
```

## Lộ trình (23 bài · 211 câu trắc nghiệm)

**Pha 0 — Nền tảng**

- 01 · Mô hình đe doạ trên mobile
- 02 · Bên trong gói app: mọi thứ đều đọc được
- 03 · Sandbox, quyền hệ điều hành & thiết bị root/jailbreak

**Pha 1 — Dữ liệu trên thiết bị**

- 04 · Lưu trữ dữ liệu nhạy cảm
- 05 · Keychain & Keystore chuyên sâu
- 06 · Rò rỉ ngoài ý muốn
- 07 · Database & file cục bộ

**Pha 2 — Giao tiếp mạng**

- 08 · HTTPS bắt buộc — và đừng tự phá nó
- 09 · Certificate / Public-key pinning
- 10 · Gọi API từ mobile: server luôn là người gác cổng

**Pha 3 — Xác thực trên mobile**

- 11 · Đăng nhập & OAuth trên mobile
- 12 · Sinh trắc học đúng cách
- 13 · Vòng đời token trên mobile

**Pha 4 — Giao tiếp giữa các app**

- 14 · Deep link, Universal Links & App Links
- 15 · IPC: giao tiếp giữa các app
- 16 · WebView an toàn

**Pha 5 — Code & gói phát hành**

- 17 · Secret trong app: không thể giấu
- 18 · Chống reverse engineering & giả mạo
- 19 · OTA / hot update & nạp code động
- 20 · Thư viện & SDK bên thứ ba

**Pha 6 — Phát hành & vận hành**

- 21 · Build release an toàn
- 22 · Quyền riêng tư & tuân thủ
- 23 · Kiểm thử bảo mật mobile & checklist MASVS (tổng kết)

## Cấu trúc

Giống các khoá khác (auth-course, networking-course…): `index.html`, `lesson.html`, `common.js` (engine), `styles.css`, `lessons/NN.js`.
Thêm bài: tạo `lessons/NN.js` và thêm `<script>` vào cả `index.html` lẫn `lesson.html`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
