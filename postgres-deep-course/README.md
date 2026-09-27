# 🐘 PostgreSQL chuyên sâu

Khoá tiếp nối `db-internals-course` (Database internals đa mô hình). Đi sâu vào cơ chế bên trong PostgreSQL và vận hành production; ví dụ phía ứng dụng viết bằng Rust (sqlx), có so sánh với Java/Spring, kèm Hyperdrive cho Cloudflare Workers.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/postgres-deep-course/
```

## Lộ trình (24 bài · 228 câu trắc nghiệm)

**Pha 0 — Kiến trúc bên trong**

- 01 · Kiến trúc process: postmaster, backend, background workers
- 02 · Shared buffers, WAL & checkpoint — đường đi của một lệnh COMMIT

**Pha 1 — MVCC & VACUUM**

- 03 · MVCC chi tiết: xmin, xmax, snapshot và tuple visibility
- 04 · HOT update & fillfactor — vì sao index nhiều làm UPDATE chậm
- 05 · VACUUM, autovacuum & bloat
- 06 · Transaction ID wraparound & freeze — sự cố có thể làm DB ngừng ghi

**Pha 2 — Index chuyên sâu**

- 07 · B-tree sâu: cấu trúc, index nhiều cột, thứ tự cột & sort
- 08 · Partial, expression, covering INCLUDE & index-only scan
- 09 · GIN, GiST, BRIN — khi B-tree bó tay

**Pha 3 — Planner & tối ưu query**

- 10 · Đọc EXPLAIN ANALYZE: cost, rows, loops, buffers & các node scan
- 11 · Join algorithms & statistics — vì sao planner đoán sai
- 12 · Tối ưu query thực chiến: 7 mẫu hay gặp

**Pha 4 — Đồng thời: isolation & lock**

- 13 · Isolation level trong PostgreSQL: RC, RR, Serializable (SSI)
- 14 · Lock: bảng, row, deadlock & advisory lock
- 15 · SELECT … FOR UPDATE SKIP LOCKED: làm job queue & outbox bằng PostgreSQL

**Pha 5 — Mô hình dữ liệu**

- 16 · Partitioning: chia bảng lớn theo RANGE, LIST, HASH
- 17 · JSONB: khi nào dùng, toán tử, index & cái giá khi cập nhật

**Pha 6 — Vận hành production**

- 18 · Connection pooling: sqlx pool, PgBouncer & Hyperdrive từ Cloudflare Workers
- 19 · Replication: streaming (vật lý) & logical — và CDC sang Kafka
- 20 · Backup & PITR — quay DB về đúng 14:31:59 trước lệnh DELETE nhầm
- 21 · Migration an toàn, không downtime
- 22 · Monitoring: pg_stat_statements, pg_stat_activity, lock & các view thống kê
- 23 · Cấu hình quan trọng: bộ nhớ, connection, planner, WAL, timeout

**Pha 7 — Tổng kết**

- 24 · Tổng kết: hành trình của một request & checklist production

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
