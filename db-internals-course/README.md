# 🧬 Database internals đa mô hình

Khoá học cơ chế bên dưới các DB công ty đang dùng — PostgreSQL, MongoDB, ClickHouse, Elasticsearch, Redis, Kafka. Học theo **mô hình** trước (page, WAL, B-tree/LSM, row/column, MVCC, inverted index, log), engine sau; dừng ở mức cơ chế + so sánh, các khoá đi sâu từng engine sẽ làm riêng. Có so sánh với Java/Spring (JPA, `@Transactional`, Spring Data, Spring Kafka).

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/db-internals-course/
```

## Lộ trình (21 bài · 209 câu trắc nghiệm)

**Pha 0 — Bản đồ**

- 01 · Bản đồ: 6 database, 6 mô hình, 6 kiểu workload

**Pha 1 — Nền tảng lưu trữ**

- 02 · Page & buffer pool — vì sao DB đọc theo khối
- 03 · WAL & fsync — COMMIT thật sự nghĩa là gì
- 04 · B-tree (B+tree) — cấu trúc đọc nhanh, sửa tại chỗ
- 05 · LSM-tree — ghi tuần tự, gộp sau
- 06 · Row-store vs column-store — cùng dữ liệu, xếp khác nhau
- 07 · Các loại index — mỗi loại trả lời một kiểu câu hỏi

**Pha 2 — Transaction, đồng thời & truy vấn**

- 08 · ACID — bốn chữ cái, bốn cơ chế khác nhau
- 09 · MVCC — người đọc không chặn người ghi
- 10 · Isolation level & anomaly — thứ gì có thể sai khi chạy song song
- 11 · Lock, deadlock & optimistic locking
- 12 · Query planner & EXPLAIN — DB quyết định chạy SQL thế nào

**Pha 3 — Các mô hình dữ liệu**

- 13 · Mô hình document — nhúng hay tham chiếu (MongoDB & WiredTiger)
- 14 · Mô hình cột & OLAP — vì sao ClickHouse quét tỷ dòng trong vài giây
- 15 · Inverted index & search — Elasticsearch/Lucene bên dưới
- 16 · Key-value in-memory — Redis bên dưới
- 17 · Log phân tán — Kafka như một database chỉ-thêm

**Pha 4 — Phân tán**

- 18 · Replication — sao chép dữ liệu sang nhiều máy
- 19 · Partitioning & sharding — chia dữ liệu ra nhiều phần
- 20 · CAP, PACELC & mô hình nhất quán — dùng cho thực tế

**Pha 5 — Tổng kết**

- 21 · Bảng chọn DB theo bài toán — tổng kết khoá

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
