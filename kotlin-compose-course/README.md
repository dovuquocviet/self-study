# 🟣 Nhập môn Kotlin & Jetpack Compose (cho dev Java)

Khoá dành cho dev Java/Spring chuẩn bị chuyển sang Android native: Kotlin, coroutines & Flow, Jetpack Compose và kiến trúc app hiện đại. Mỗi bài giải thích cơ chế bên dưới, so sánh với Spring/React Native khi có ích, có code thật và trắc nghiệm.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/kotlin-compose-course/
```

## Lộ trình (26 bài · 251 câu trắc nghiệm)

**Pha 0 — Kotlin cho dev Java**

- 01 · Kotlin chạy thế nào — và khác Java ở những chỗ nào
- 02 · Null safety — NullPointerException bị đẩy lên lúc compile
- 03 · Class, property, data class & object
- 04 · sealed class, enum & when đầy đủ nhánh
- 05 · Lambda, extension function & lambda có receiver (nền của DSL)
- 06 · Scope functions & collections

**Pha 1 — Coroutines & Flow**

- 07 · Coroutine là gì — suspend dưới lớp vỏ
- 08 · Structured concurrency: scope, Job, huỷ & lỗi
- 09 · Flow, StateFlow & SharedFlow — dòng dữ liệu theo thời gian

**Pha 2 — Android & Gradle**

- 10 · Cấu trúc project Android & Gradle Kotlin DSL

**Pha 3 — Jetpack Compose cốt lõi**

- 11 · Composable: UI = f(state)
- 12 · Recomposition: cơ chế & chi phí
- 13 · State & remember
- 14 · State hoisting & luồng dữ liệu một chiều
- 15 · Layout: Column, Row, Box & LazyColumn
- 16 · Modifier: chuỗi có thứ tự
- 17 · Theming với Material 3
- 18 · Side effects: LaunchedEffect, DisposableEffect & bạn bè

**Pha 4 — Kiến trúc app**

- 19 · Navigation trong Compose
- 20 · ViewModel & lifecycle
- 21 · Kiến trúc: UDF, MVVM, repository & single source of truth

**Pha 5 — Dữ liệu & hạ tầng**

- 22 · Networking: Retrofit & Ktor client
- 23 · Lưu trữ cục bộ: Room & DataStore
- 24 · Dependency Injection với Hilt (bản ngắn cho dev Spring)

**Pha 6 — Kiểm thử & tổng kết**

- 25 · Test cơ bản: ViewModel, coroutine, Flow & Compose UI
- 26 · Tổng kết: một tính năng từ đầu đến cuối

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
