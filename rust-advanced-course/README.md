# ⚙️ Rust nâng cao cho backend

Khoá tiếp nối `rust-course` (Nhập môn Rust). Không lặp lại cú pháp cơ bản; đi vào cơ chế bên dưới (Future, Pin, Tokio, memory ordering) và các quyết định khi dựng service production: backpressure, cancellation, lỗi, tracing/OpenTelemetry, axum/tower, sqlx, serde, hiệu năng — rồi mở ra biên: unsafe/FFI, UniFFI cho Kotlin/Swift, macro, WASM trên Cloudflare Workers. Mỗi bài có code thật, đối chiếu Java/Spring và trắc nghiệm.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/rust-advanced-course/
```

## Lộ trình (21 bài · 210 câu trắc nghiệm)

**Pha 0 — Lifetime & trait nâng cao**

- 01 · Lifetime nâng cao: bound, 'static, variance & HRTB
- 02 · Trait nâng cao: associated type, blanket impl, orphan rule
- 03 · dyn vs impl, dyn-compatible & async fn trong trait

**Pha 1 — Async sâu**

- 04 · Future từ bên trong: poll, Context, Waker & state machine
- 05 · Pin & Unpin — vì sao future không được di chuyển
- 06 · Tokio runtime: worker, work-stealing, spawn vs spawn_blocking
- 07 · Cancellation, select! & timeout — huỷ bằng cách drop
- 08 · Backpressure: giới hạn đồng thời để service không tự sập

**Pha 2 — Concurrency**

- 09 · Mutex & RwLock: std hay tokio? Giữ lock qua .await
- 10 · Channel: mpsc, oneshot, broadcast, watch & actor pattern
- 11 · Atomics & memory ordering ở mức đủ dùng

**Pha 3 — Service production**

- 12 · Xử lý lỗi ở quy mô service: phân tầng, mapping HTTP, không panic
- 13 · tracing & OpenTelemetry: log có cấu trúc, span, trace phân tán
- 14 · Kiến trúc service axum: tower Service, Layer, State & graceful shutdown
- 15 · sqlx nâng cao: pool, transaction, migration, query kiểm tra lúc biên dịch
- 16 · serde nâng cao: rename, tag, flatten, default, with & zero-copy

**Pha 4 — Hiệu năng**

- 17 · Hiệu năng: allocation, clone, Cow, Arc & đo đạc bằng flamegraph/criterion

**Pha 5 — Ranh giới: unsafe, FFI, macro, WASM**

- 18 · unsafe & FFI — và UniFFI để dùng chung Rust với Kotlin/Swift
- 19 · Macro: macro_rules! và procedural macro ở mức đọc hiểu
- 20 · WebAssembly & Cloudflare Workers với workers-rs

**Pha 6 — Tổng kết**

- 21 · Tổng kết: bản đồ quyết định cho service Rust production

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án; highlighter bổ sung từ khoá Rust), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
