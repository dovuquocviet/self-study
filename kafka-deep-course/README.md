# 📨 Kafka chuyên sâu

Khoá đi sau `db-internals-course` (Database internals đa mô hình). Mở hộp đen Kafka: log & partition, replication, producer/consumer, ngữ nghĩa giao nhận, schema, xử lý lỗi, vận hành và nạp sang ClickHouse. Ví dụ code bằng Rust (`rdkafka`), so sánh với Spring Kafka. Phía ClickHouse ingest chi tiết xem khoá ClickHouse chuyên sâu.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/kafka-deep-course/
```

## Lộ trình (23 bài · 217 câu trắc nghiệm)

**Pha 0 — Nền tảng**

- 01 · Kafka là một cái log — không phải hàng đợi
- 02 · Kiến trúc cluster: broker, controller và KRaft
- 03 · Topic → partition → segment: dữ liệu nằm trên đĩa ra sao

**Pha 1 — Độ bền & nhân bản**

- 04 · Replication: leader, follower, ISR và high watermark
- 05 · acks, min.insync.replicas & unclean leader election

**Pha 2 — Producer sâu**

- 06 · Bên trong producer: batching, linger, nén và bộ đệm
- 07 · Partitioner & key: message rơi vào partition nào
- 08 · Retry & idempotent producer: gửi lại mà không nhân đôi
- 09 · Transactions: ghi nhiều partition và commit offset nguyên tử

**Pha 3 — Consumer sâu**

- 10 · Consumer group & vòng poll: ai đọc partition nào, sống chết ra sao
- 11 · Rebalancing: eager, cooperative sticky, static membership & giao thức mới
- 12 · Commit offset: tự động hay thủ công, và commit ở đâu trong vòng lặp
- 13 · At-most / at-least / exactly-once & idempotent consumer
- 14 · Thứ tự message từ đầu tới cuối

**Pha 4 — Dữ liệu & schema**

- 15 · Retention vs log compaction
- 16 · Schema & tiến hoá schema: Schema Registry, Avro/Protobuf, compatibility

**Pha 5 — Vận hành**

- 17 · Xử lý lỗi: poison pill, retry tại chỗ, retry topic & DLQ
- 18 · Consumer lag & giám sát cluster
- 19 · Hiệu năng & chọn số partition

**Pha 6 — Tích hợp**

- 20 · Service Kafka bằng Rust (rdkafka): từ @KafkaListener sang code tự kiểm soát
- 21 · Kafka → ClickHouse: ba cách nạp và bài toán không mất, không trùng
- 22 · Bảo mật Kafka cơ bản: TLS, SASL, ACL

**Pha 7 — Tổng kết**

- 23 · Tổng kết: checklist thiết kế một luồng Kafka không mất, không trùng

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
