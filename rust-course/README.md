# 🦀 Nhập môn Rust cho dev Java

Khoá nhập môn Rust cho lập trình viên Java/Spring đang chuyển backend sang Rust. Mục tiêu: hiểu cơ chế bên dưới (ownership, borrow, lifetime, Send/Sync, async) thay vì chỉ chép mẫu; mỗi bài có tab đối chiếu Java ↔ Rust và trắc nghiệm.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/rust-course/
```

## Lộ trình (21 bài · 197 câu trắc nghiệm)

**Pha 0 — Khởi động**

- 01 · Vì sao Rust? Nhìn từ góc một dev Java
- 02 · Cargo & crate — Maven/Gradle của Rust
- 03 · Biến, mut, kiểu dữ liệu & biểu thức

**Pha 1 — Ownership — trái tim của Rust**

- 04 · Stack, heap & ownership: move, Copy, Clone, Drop
- 05 · Borrowing: & và &mut — luật "nhiều người đọc HOẶC một người ghi"
- 06 · Slice & lifetime cơ bản: &str, &[T], 'a, 'static

**Pha 2 — Mô hình dữ liệu**

- 07 · Struct & impl — class Java bị tách làm đôi
- 08 · Enum & match — enum mang dữ liệu, match vét cạn
- 09 · Option & Result — tạm biệt null và exception
- 10 · Xử lý lỗi thực chiến: toán tử ?, From, thiserror & anyhow

**Pha 3 — Trừu tượng hoá**

- 11 · Trait & generic — interface và generic, nhưng không xoá kiểu
- 12 · Trait object: dyn Trait, vtable & khi nào chọn nó
- 13 · Collection: Vec, HashMap, String và entry API
- 14 · Iterator & closure — Stream API không tốn phí
- 15 · Module & visibility — tổ chức code như package Java

**Pha 4 — Bộ nhớ & đồng thời**

- 16 · Smart pointer: Box, Rc, RefCell, Arc — khi một owner là không đủ
- 17 · Thread, Send/Sync & "fearless concurrency"
- 18 · async/await với Tokio — hàng nghìn request trên vài thread

**Pha 5 — Thực chiến backend**

- 19 · REST API nhỏ với axum + sqlx — đối chiếu Spring Boot
- 20 · Test với cargo test — unit, integration, doc test, async test
- 21 · Tổng kết: bản đồ tư duy Rust cho dev Java

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
