# 🚀 Mobile performance: đo, tìm và sửa

Khoá đi sau `Nền tảng Mobile native`. Dạy cách làm hiệu năng mobile như một kỹ sư: đo trên bản release ở máy thật, tìm nút thắt bằng trace, sửa đúng chỗ, chứng minh bằng số và chặn tái phát trong CI. Ví dụ cho cả React Native (hiện tại) lẫn Android/iOS native (tương lai), có so sánh với Java/Spring khi hữu ích.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/mobile-perf-course/
```

## Lộ trình (21 bài · 196 câu trắc nghiệm)

**Pha 0 — Tư duy đo**

- 01 · Đo trước khi sửa — vòng lặp của kỹ sư hiệu năng
- 02 · Bản đồ chỉ số hiệu năng mobile
- 03 · Một frame được vẽ thế nào — main thread, RenderThread, JS thread

**Pha 1 — Công cụ đo**

- 04 · Android: Android Studio Profiler & Perfetto
- 05 · iOS: Xcode Instruments — Time Profiler, Allocations, Leaks, Hitches
- 06 · Đo từ người dùng thật: Android vitals, MetricKit, Firebase Performance
- 07 · React Native: DevTools, React Profiler, Hermes profiler — Flipper đã đi đâu?

**Pha 2 — Khởi động nhanh**

- 08 · Startup Android: cold start từng giai đoạn, Macrobenchmark, Baseline Profiles
- 09 · Startup iOS & React Native: dyld, pre-main, bundle JS và TTI

**Pha 3 — Giao diện mượt**

- 10 · Đừng chặn main thread: ANR, hang và cách đẩy việc ra nền
- 11 · Re-render thừa: React, Compose recomposition, SwiftUI body
- 12 · Danh sách dài: ảo hoá, tái sử dụng cell, FlatList vs FlashList
- 13 · Ảnh: kích thước, decode, cache — nguyên nhân giật số 1
- 14 · Animation mượt: native driver, Reanimated, Compose & SwiftUI

**Pha 4 — Tài nguyên: bộ nhớ, mạng, pin, dung lượng**

- 15 · Memory leak & OOM: GC, ARC và JS heap
- 16 · Mạng: ít request hơn, nhỏ hơn, sớm hơn
- 17 · Pin & việc chạy nền: wakelock, WorkManager, BGTaskScheduler
- 18 · Kích thước app: R8, AAB, app thinning, asset

**Pha 5 — Quy trình & quyết định**

- 19 · Đo trên máy thật & chặn regression trong CI
- 20 · Chứng minh 'chuyển sang native nhanh hơn bao nhiêu' — benchmark có phương pháp
- 21 · Tổng kết: bản đồ triệu chứng → công cụ → cách sửa

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
