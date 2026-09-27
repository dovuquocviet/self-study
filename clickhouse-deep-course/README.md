# 🟨 ClickHouse chuyên sâu

Khoá tiếp nối "Database internals đa mô hình". Đi sâu vào cơ chế bên trong ClickHouse — kho phân tích tiêu thụ Kafka của hệ thống: part, granule, sparse index, họ MergeTree, materialized view, ingest chịu trùng, cluster và vận hành. Phía producer/broker xem khoá "Kafka chuyên sâu" (`kafka-deep-course`). Mỗi bài có lý thuyết, code/SQL thật, animation từng bước và trắc nghiệm.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/clickhouse-deep-course/
```

## Lộ trình (23 bài · 214 câu trắc nghiệm)

**Pha 0 — Nền tảng**

- 01 · Vì sao ClickHouse nhanh: column-store & vectorized execution
- 02 · MergeTree trên đĩa: part, granule và merge

**Pha 1 — MergeTree sâu**

- 03 · Primary index thưa: ORDER BY vs PRIMARY KEY và cách chọn khoá
- 04 · Partition: để quản lý dữ liệu, không phải để tăng tốc query
- 05 · Kiểu dữ liệu & nén: LowCardinality, Nullable, codec
- 06 · Skip index: minmax, set, bloom_filter — bỏ qua granule, không phải tìm hàng
- 07 · Projection: bản sao ẩn với thứ tự khác hoặc đã gom sẵn

**Pha 2 — Họ MergeTree & chống trùng**

- 08 · ReplacingMergeTree: upsert "cuối cùng sẽ đúng"
- 09 · SummingMergeTree & AggregatingMergeTree: gom dữ liệu khi merge
- 10 · CollapsingMergeTree & VersionedCollapsing: huỷ hàng bằng sign = -1
- 11 · FINAL và cái giá: đọc đúng dữ liệu chưa merge

**Pha 3 — Ingest**

- 12 · Insert đúng cách: batch lớn, async insert, chống trùng khi retry
- 13 · Materialized view: trigger khi insert & refreshable MV
- 14 · Ingest từ Kafka: Kafka table engine + materialized view
- 15 · Kafka nâng cao: chống trùng, message hỏng, ClickPipes & các lựa chọn khác

**Pha 4 — Truy vấn**

- 16 · JOIN & dictionary: làm giàu dữ liệu mà không nổ RAM
- 17 · Tối ưu query: EXPLAIN, system.query_log và các đòn bẩy chính

**Pha 5 — Vận hành**

- 18 · Mutation, lightweight DELETE/UPDATE — và vì sao nên tránh
- 19 · TTL & tiered storage: vòng đời dữ liệu tự động
- 20 · Cluster: shard, replica, Distributed table & ClickHouse Keeper
- 21 · Giới hạn, settings profile & quota: không để một query hạ cả cluster

**Pha 6 — Ứng dụng & tổng kết**

- 22 · Client Rust: crate clickhouse — insert theo batch, query có kiểu
- 23 · Tổng kết: thiết kế pipeline analytics đơn hàng từ Kafka tới dashboard

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án; highlighter bổ sung từ khoá ClickHouse SQL + Rust), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
