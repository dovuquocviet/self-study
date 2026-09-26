# 🗄️ An toàn bảo mật cho Database

Khoá tự học **tương tác**, chạy thẳng trong trình duyệt — vanilla HTML/CSS/JS, không cần build tool.
Hardening database không gắn với một engine: PostgreSQL, Redis, Kafka, ClickHouse, MongoDB và Cloudflare D1/KV/R2/Durable Objects/Hyperdrive.

Mỗi bài gồm 4 phần: lý thuyết → code demo có tab → animation từng bước → trắc nghiệm (thứ tự đáp án được xáo cố định theo từng câu). Nội dung tập trung vào phòng thủ; phần tấn công chỉ minh hoạ bằng placeholder.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/secure-db-course/
```

## Lộ trình (24 bài · 222 câu trắc nghiệm)

**Pha 0 — Nền tảng**

- 01 · Bề mặt tấn công của một Database
- 02 · Mô hình 7 lớp phòng thủ cho mọi Database

**Pha 1 — Mạng & kết nối**

- 03 · Không phơi DB ra Internet
- 04 · TLS cho kết nối Database

**Pha 2 — Xác thực**

- 05 · Xác thực: không mặc định, không bỏ trống mật khẩu
- 06 · Quản lý credential của Database

**Pha 3 — Phân quyền**

- 07 · Least privilege: quyền tối thiểu trên từng engine
- 08 · Row-level security & multi-tenancy
- 09 · Tính năng & lệnh nguy hiểm: tắt hoặc khoá lại

**Pha 4 — Truy vấn an toàn**

- 10 · Truy vấn có tham số trên mọi engine
- 11 · NoSQL, Redis & KV: injection không cần SQL
- 12 · Dữ liệu trong luồng: Kafka & hàng đợi

**Pha 5 — Bảo vệ dữ liệu**

- 13 · Mã hoá at-rest: bảo vệ được gì, không bảo vệ được gì
- 14 · Mã hoá mức field/ứng dụng
- 15 · PII & vòng đời dữ liệu
- 16 · Redis & cache: nhanh nhưng đừng cẩu thả
- 17 · Kafka: bảo mật một cụm stream từ đầu tới cuối
- 18 · ClickHouse & kho phân tích
- 19 · Cloudflare D1, KV, R2, Durable Objects & Hyperdrive

**Pha 6 — Vận hành**

- 20 · Backup & khôi phục an toàn
- 21 · Audit log & giám sát
- 22 · Chống cạn tài nguyên (DoS) ở tầng dữ liệu
- 23 · Migration, môi trường & dữ liệu dev
- 24 · Checklist hardening theo từng engine (tổng kết)

## Cấu trúc

Giống các khoá khác (auth-course, networking-course…): `index.html`, `lesson.html`, `common.js` (engine), `styles.css`, `lessons/NN.js`.
Thêm bài: tạo `lessons/NN.js` và thêm `<script>` vào cả `index.html` lẫn `lesson.html`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
