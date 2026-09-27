# 🔎 Elasticsearch chuyên sâu

Khoá tiếp nối `db-internals-course` (Database internals đa mô hình). Đi sâu vào cơ chế bên dưới Elasticsearch — shard, segment Lucene, mapping, analyzer tiếng Việt, BM25, Query DSL, aggregation, đường ghi, reindex không downtime, đồng bộ từ DB chính qua Kafka, sizing, ILM, monitoring, bảo mật — với ví dụ client Rust và ghi chú khác biệt Elasticsearch ↔ OpenSearch.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/elastic-deep-course/
```

## Lộ trình (23 bài · 219 câu trắc nghiệm)

**Pha 0 — Bản đồ & kiến trúc**

- 01 · Elasticsearch đứng ở đâu trong hệ thống của ta
- 02 · Cluster, node role, shard primary/replica
- 03 · Bên trong một shard: Lucene segment, inverted index, doc values

**Pha 1 — Mô hình dữ liệu**

- 04 · Mapping: text vs keyword, kiểu dữ liệu, multi-field
- 05 · Dynamic mapping và bẫy mapping explosion
- 06 · Analyzer: char_filter → tokenizer → token filter
- 07 · Tìm kiếm tiếng Việt: dấu, Unicode tổ hợp, ICU, asciifolding

**Pha 2 — Tìm kiếm & xếp hạng**

- 08 · Query DSL: bool, match vs term, query context vs filter context
- 09 · Phrase, multi_match, fuzzy, prefix/wildcard, range
- 10 · Relevance: BM25, explain, boost, function_score
- 11 · Quan hệ trong ES: object vs nested vs join vs phi chuẩn hoá

**Pha 3 — Aggregation & phân trang**

- 12 · Aggregations: terms, date_histogram, cardinality, pipeline — và cái giá phải trả
- 13 · Phân trang: from/size, search_after, Point-in-Time, scroll

**Pha 4 — Ghi dữ liệu**

- 14 · Đường ghi: bulk, refresh, near-real-time, translog, flush
- 15 · Update, versioning & optimistic concurrency
- 16 · Đổi mapping không downtime: reindex + alias
- 17 · Đồng bộ từ DB chính vào ES: dual write vs outbox/CDC + Kafka

**Pha 5 — Vận hành**

- 18 · Sizing: bao nhiêu shard, shard to bao nhiêu, heap và disk
- 19 · Vòng đời index: ILM, rollover, data stream, hot-warm-cold (và ISM của OpenSearch)
- 20 · Hiệu năng & monitoring: _cat, slowlog, profile, hot threads, circuit breaker
- 21 · Bảo mật cơ bản: xác thực, TLS, role, API key

**Pha 6 — Rust & tổng kết**

- 22 · Client Rust: crate elasticsearch (và opensearch)
- 23 · Tổng kết: thiết kế một read model tìm kiếm từ đầu đến cuối

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
