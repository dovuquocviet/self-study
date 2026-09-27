# 🧩 Nhập môn Kotlin Multiplatform (KMP)

Khoá cho lập trình viên Java/Spring và dev đang làm React Native muốn hiểu KMP từ cơ chế: trình biên dịch nhiều backend, source set, expect/actual, cách Swift nhìn thấy Kotlin qua header Objective-C, thư viện đa nền tảng (coroutines, Ktor, kotlinx.serialization, SQLDelight/Room, DataStore, Koin), kiến trúc chia sẻ tới ViewModel, Compose Multiplatform, phân phối XCFramework/SPM, bộ nhớ trên Kotlin/Native, test trong commonTest và lộ trình chuyển dần từ React Native.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/kmp-course/
```

## Lộ trình (19 bài · 178 câu trắc nghiệm)

**Pha 0 — Toàn cảnh**

- 01 · KMP là gì — chia sẻ cái gì, giữ native cái gì
- 02 · Một ngôn ngữ, nhiều backend biên dịch

**Pha 1 — Project & Gradle**

- 03 · Target, source set và cây phân cấp
- 04 · build.gradle.kts của module shared — đọc từng khối
- 05 · expect/actual — và khi nào nên dùng interface thay thế

**Pha 2 — iOS gọi Kotlin**

- 06 · Kotlin/Native & framework: Xcode lấy code Kotlin bằng cách nào
- 07 · Interop Objective-C/Swift: Kotlin hiện ra trong Swift trông ra sao
- 08 · suspend & Flow khi sang Swift

**Pha 3 — Thư viện đa nền tảng**

- 09 · kotlinx.coroutines & Flow trong commonMain
- 10 · Gọi API: Ktor client + kotlinx.serialization
- 11 · Lưu trữ cục bộ: SQLDelight vs Room KMP
- 12 · DataStore cho cài đặt & Koin cho DI

**Pha 4 — Kiến trúc chia sẻ**

- 13 · Kiến trúc chia sẻ: Repository → UseCase → ViewModel dùng chung
- 14 · Compose Multiplatform — khi nào nên chia sẻ cả UI

**Pha 5 — Build, runtime & test**

- 15 · Phân phối cho iOS: XCFramework, SPM, CocoaPods
- 16 · Bộ nhớ & concurrency trên Kotlin/Native
- 17 · Test trong commonTest — một bộ test, chạy trên mọi nền tảng

**Pha 6 — Chuyển đổi & tổng kết**

- 18 · Lộ trình chuyển dần từ React Native sang KMP + UI native
- 19 · Tổng kết: bản đồ KMP từ source tới App Store

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`. Code Kotlin có chuỗi template đặt trong `codeTabs.lines`.
