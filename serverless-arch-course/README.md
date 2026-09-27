# 🌩️ Kiến trúc serverless trên Cloudflare

Khoá tiếp nối `cf-workers-course` (Nhập môn Cloudflare Workers). Học cách *thiết kế* hệ thống serverless: state sống ở đâu, nhất quán tới mức nào, xử lý trùng lặp/lỗi ra sao, ghép vào hệ microservice Rust/Java sẵn có thế nào. Mỗi bài có code thật, so sánh với Spring và trắc nghiệm.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/serverless-arch-course/
```

## Lộ trình (20 bài · 189 câu trắc nghiệm)

**Pha 0 — Tư duy serverless**

- 01 · Tư duy serverless: isolate, stateless, edge và giới hạn

**Pha 1 — Durable Objects sâu**

- 02 · Durable Object là gì: actor đơn luồng có địa chỉ toàn cầu
- 03 · Storage API SQLite trong Durable Object
- 04 · Alarm: hẹn giờ cho từng object
- 05 · WebSocket Hibernation: phòng chat, realtime mà không trả tiền lúc im lặng
- 06 · Pattern DO: lock, counter, rate limiter và sharding

**Pha 2 — Bất đồng bộ: Queues & Workflows**

- 07 · Queues: producer, consumer, batching và ack
- 08 · Retry, DLQ và consumer idempotent
- 09 · Workflows: durable execution cho quy trình nhiều bước

**Pha 3 — Dữ liệu: nhất quán & lưu trữ**

- 10 · Nhất quán: KV (cuối cùng) vs D1 vs Durable Objects vs R2
- 11 · D1 sâu: giới hạn, read replica, Sessions API và sharding theo tenant
- 12 · R2 & presigned URL: upload/download không đi qua Worker
- 13 · Hyperdrive + PostgreSQL: dùng DB sẵn có từ Worker

**Pha 4 — Kết nối hệ thống**

- 14 · Service bindings & RPC giữa các Worker
- 15 · Ghép Workers vào hệ microservice Java/Rust sẵn có

**Pha 5 — Vận hành: hiệu năng, quan sát, chi phí**

- 16 · Cold start & hiệu năng: isolate, round-trip và vị trí
- 17 · Observability & debugging khi không có server để SSH
- 18 · Chi phí và khi nào KHÔNG nên dùng serverless

**Pha 6 — Pattern & tổng kết**

- 19 · Pattern mẫu: fan-out/fan-in, saga, outbox
- 20 · Tổng kết: kiến trúc tham chiếu và bảng chọn nhanh

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Số liệu giới hạn/giá lấy theo tài liệu Cloudflare tại thời điểm viết (09/2026) — luôn kiểm tra lại trang Limits/Pricing.
>
> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
