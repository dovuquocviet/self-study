# ☁️ Nhập môn Cloudflare Workers

Khoá cho dev Java/Spring chuyển service nhỏ sang Cloudflare Workers (serverless ở edge). Trọng tâm là **cơ chế**: V8 isolate, edge network, tính phí theo CPU time, binding — để biết vì sao code phải viết khác Spring, và khi nào không nên dùng Workers. Có so sánh Spring ↔ Workers, TypeScript ↔ Rust (workers-rs).

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/cf-workers-course/
```

## Lộ trình (20 bài · 189 câu trắc nghiệm)

**Pha 0 — Nền tảng serverless**

- 01 · Serverless là gì — từ Spring Boot chạy 24/7 đến code chạy theo request
- 02 · V8 isolate vs container/VM — vì sao cold start chỉ vài ms
- 03 · Edge network — request đi đường nào tới Worker của bạn?

**Pha 1 — Wrangler & cấu hình**

- 04 · Wrangler & wrangler.jsonc — tạo, chạy local, deploy, rollback
- 05 · Environments, biến môi trường & secrets

**Pha 2 — Handler & routing**

- 06 · fetch handler — Request, Response, ctx.waitUntil
- 07 · Routing với Hono — 'Spring MVC' nhỏ gọn cho Workers
- 08 · scheduled (cron) & queue handler — Worker không chỉ nhận HTTP

**Pha 3 — Bindings: lưu trữ & kết nối**

- 09 · Binding là gì — và Workers KV (key-value phân tán, nhất quán cuối cùng)
- 10 · D1 — SQLite serverless: migrations, prepared statement, batch
- 11 · R2 — object storage tương thích S3, không phí egress
- 12 · Durable Objects nhập môn — một 'actor' duy nhất cho mỗi ID
- 13 · Hyperdrive — Worker nói chuyện với PostgreSQL có sẵn của công ty
- 14 · Service bindings — Worker gọi Worker khác không qua HTTP công khai

**Pha 4 — Worker bằng Rust**

- 15 · Viết Worker bằng Rust với workers-rs (WebAssembly)
- 16 · Rust (WASM) hay TypeScript trên Workers — chọn thế nào?

**Pha 5 — Vận hành: giới hạn, log, test**

- 17 · Giới hạn & bẫy — những thứ Spring cho phép mà Workers thì không
- 18 · Logging & observability — wrangler tail và Workers Logs
- 19 · Test Worker với Vitest trong runtime thật

**Pha 6 — Tổng kết**

- 20 · Tổng kết — kiến trúc mẫu & khi nào KHÔNG nên dùng Workers

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.

> Số liệu giới hạn/giá và tên gói (vd `@cloudflare/vitest-plugin`) theo docs Cloudflare tháng 9/2026 — kiểm tra lại docs khi dùng thực tế.
