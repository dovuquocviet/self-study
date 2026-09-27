# 📲 Nền tảng Mobile native: app chạy thế nào bên dưới

Khoá dành cho lập trình viên backend Java/Spring đang dùng React Native và sắp chuyển sang native (Kotlin/Swift). Không dạy cú pháp — dạy **cơ chế**: sandbox, vòng đời, main thread, rendering, bộ nhớ, chạy nền, push, build & phát hành. Ví dụ song song Android ↔ iOS, so sánh với React Native và Spring.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/mobile-native-course/
```

## Lộ trình (22 bài · 205 câu trắc nghiệm)

**Pha 0 — Hệ điều hành & vòng đời**

- 01 · Kiến trúc OS mobile & sandbox — app của bạn thực ra là gì?
- 02 · Process & vòng đời app: ai quyết định app sống hay chết?
- 03 · Android: vòng đời Activity, Fragment và ViewModel
- 04 · iOS App/Scene lifecycle & vòng đời trong SwiftUI / Compose

**Pha 1 — Thread & rendering**

- 05 · Main thread: một hàng đợi duy nhất, và vì sao chặn nó gây giật / ANR
- 06 · Làm việc nền đúng cách: Kotlin coroutines & Swift concurrency
- 07 · Rendering pipeline: từ vsync tới điểm ảnh trong 16 ms
- 08 · UI khai báo & danh sách dài: recomposition, identity và tái sử dụng cell

**Pha 2 — React Native bên dưới**

- 09 · React Native kiến trúc cũ: 3 thread và cây cầu JSON
- 10 · New Architecture: JSI, Fabric, TurboModules, Hermes — và cái giá còn lại

**Pha 3 — Bộ nhớ**

- 11 · Bộ nhớ: GC trên Android, ARC trên iOS, và giới hạn RAM mỗi app
- 12 · Memory leak: giữ Activity, retain cycle trong closure — tìm và sửa

**Pha 4 — Kiến trúc app & tài nguyên hệ thống**

- 13 · Điều hướng & back stack: task, NavController, NavigationStack, deep link
- 14 · Chạy nền: WorkManager, foreground service, BGTaskScheduler — và giới hạn của OS
- 15 · Networking & cache: OkHttp/Retrofit, URLSession, HTTP cache và mạng di động
- 16 · Lưu trữ cục bộ: key-value, SQLite, file và kho khoá bí mật
- 17 · Permissions: xin quyền đúng lúc, đúng cách, trên cả hai nền tảng
- 18 · Push notification: luồng chạy từ backend tới màn hình khoá

**Pha 5 — Build, ký & phát hành**

- 19 · Build Android: Gradle, DEX, R8, APK vs AAB và ký app
- 20 · Build iOS: từ Swift tới IPA — certificate, provisioning profile, entitlements
- 21 · Phát hành lên store: track thử nghiệm, review, rollout từng phần

**Pha 6 — Tổng kết**

- 22 · Tổng kết: bản đồ app native từ lúc bấm icon tới lúc lên store

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án; thêm từ khoá Kotlin/Swift cho highlighter), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
