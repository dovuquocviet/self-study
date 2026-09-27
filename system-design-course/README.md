# 🏗️ System design cho microservice & serverless

Thiết kế hệ thống theo đúng bối cảnh công ty: backend Rust, mỗi service một DB (PostgreSQL, MongoDB, Redis), Kafka làm bus sự kiện, ClickHouse consume từ Kafka cho analytics, Elasticsearch cho tìm kiếm, service nhỏ trên Cloudflare Workers, app mobile (React Native → native). Viết cho lập trình viên Java/Spring muốn hiểu cơ chế và đánh đổi đằng sau mỗi quyết định kiến trúc.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/system-design-course/
```

## Lộ trình (24 bài · 224 câu trắc nghiệm)

**Pha 0 — Tư duy thiết kế**

- 01 · Quy trình thiết kế: từ yêu cầu tới con số
- 02 · API contract, data model & sơ đồ

**Pha 1 — Ranh giới & giao tiếp**

- 03 · Ranh giới service & database-per-service
- 04 · Giao tiếp đồng bộ: REST vs gRPC
- 05 · Giao tiếp bất đồng bộ: event qua Kafka
- 06 · API Gateway & BFF cho mobile

**Pha 2 — Độ bền khi gọi nhau**

- 07 · Timeout, retry, backoff, circuit breaker, bulkhead
- 08 · Idempotency: gọi lại bao nhiêu lần cũng như một
- 09 · Nhất quán giữa service: Saga
- 10 · Transactional Outbox, CDC & eventual consistency

**Pha 3 — Hiệu năng & scale**

- 11 · Cache nhiều tầng: client → edge → Redis → DB
- 12 · Rate limiting: thuật toán và đặt ở đâu
- 13 · Scale ngang, stateless & serverless
- 14 · Partitioning & sharding
- 15 · Read model: Elasticsearch cho tìm kiếm, ClickHouse cho analytics

**Pha 4 — Vận hành**

- 16 · Observability: log, metric, trace xuyên service
- 17 · Triển khai an toàn: rolling, blue-green, canary, feature flag
- 18 · Độ tin cậy: SLI, SLO, error budget & graceful degradation
- 19 · Bảo mật giữa service: mTLS, JWT & zero trust

**Pha 5 — Case study**

- 20 · Case study 1: Hệ thống đơn hàng e-commerce
- 21 · Case study 2: Push notification cho app mobile
- 22 · Case study 3: URL shortener trên Cloudflare Workers
- 23 · Case study 4: Pipeline sự kiện mobile → Kafka → ClickHouse

**Pha 6 — Tổng kết**

- 24 · Tổng kết: checklist thiết kế & bảng quyết định

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
