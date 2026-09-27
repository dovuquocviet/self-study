# 🕊️ Nhập môn Swift & SwiftUI (cho dev Java)

Khoá cho lập trình viên Java/Spring (đã từng làm React Native) chuẩn bị chuyển sang mobile native iOS. Trọng tâm là **cơ chế**: value semantics, Optional, ARC, structured concurrency, actor/Sendable, danh tính & diffing của SwiftUI — kèm so sánh với Java/Spring và React Native.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/swift-swiftui-course/
```

## Lộ trình (24 bài · 227 câu trắc nghiệm)

**Pha 0 — Swift cho dev Java**

- 01 · Bản đồ Swift cho người viết Java: biên dịch, let/var, kiểu
- 02 · Optional: null được đưa vào hệ thống kiểu
- 03 · struct vs class: value semantics và copy-on-write
- 04 · enum có associated value & pattern matching
- 05 · Protocol & extension: interface kiểu Swift
- 06 · Generics: không type erasure như Java
- 07 · Closure: capture theo tham chiếu, @escaping, trailing closure
- 08 · Error handling: throws, try, do-catch, Result, defer
- 09 · ARC: đếm tham chiếu, retain cycle, weak & unowned

**Pha 1 — Concurrency hiện đại**

- 10 · async/await & Task: concurrency có cấu trúc
- 11 · actor, @MainActor, Sendable: data race bị chặn lúc biên dịch

**Pha 2 — Công cụ: Xcode & SPM**

- 12 · Xcode project & Swift Package Manager (so với Gradle/Maven)

**Pha 3 — SwiftUI**

- 13 · View là struct: body, danh tính và diffing
- 14 · @State & @Binding: nguồn sự thật duy nhất
- 15 · @Observable, @Bindable, @Environment: state dùng chung
- 16 · Layout: stack, List, Lazy và thuật toán đề xuất kích thước
- 17 · Modifier: mỗi lần gọi là một lớp bọc mới — thứ tự quan trọng
- 18 · Navigation: NavigationStack, điều hướng bằng dữ liệu, sheet
- 19 · Lifecycle: App/Scene, .task, onAppear, onChange, scenePhase

**Pha 4 — Kiến trúc & dữ liệu**

- 20 · Kiến trúc MVVM với @Observable
- 21 · Networking: URLSession async + Codable
- 22 · Lưu trữ: UserDefaults, Keychain, SwiftData
- 23 · Test cơ bản: Swift Testing, XCTest, mock bằng protocol

**Pha 5 — Tổng kết**

- 24 · Tổng kết: bản đồ Java/RN → Swift/SwiftUI và checklist kỹ sư

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`. Nội suy chuỗi Swift `\(x)` trong `lines` phải viết `\\(x)` trong nguồn JS.
