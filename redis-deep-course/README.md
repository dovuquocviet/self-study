# 🟥 Redis chuyên sâu

Khoá tiếp nối `db-internals-course` (Database internals đa mô hình). Dành cho lập trình viên backend đã dùng Redis qua `RedisTemplate`/`@Cacheable` nhưng chưa nắm cơ chế bên dưới: event loop một luồng, encoding của từng kiểu dữ liệu, TTL và eviction, RDB/AOF, replication, Sentinel, Cluster, rồi các pattern thực chiến (cache, lock, rate limit, Streams, session). Ví dụ client viết bằng Rust (redis-rs, fred), có so sánh với Java/Spring.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/redis-deep-course/
```

## Lộ trình (25 bài · 235 câu trắc nghiệm)

**Pha 0 — Nền tảng**

- 01 · Redis chạy thế nào: một luồng, event loop và vì sao nhanh
- 02 · Bên trong một key: dict, redisObject, SDS và encoding của String

**Pha 1 — Cấu trúc dữ liệu & encoding**

- 03 · List và Hash: listpack, quicklist, hashtable
- 04 · Set và Sorted Set: intset, skiplist + dict
- 05 · Bitmap, HyperLogLog và Geo — ba kiểu 'giả'
- 06 · Độ phức tạp lệnh & lệnh nguy hiểm: KEYS vs SCAN, big key, hot key

**Pha 2 — Bộ nhớ & vòng đời key**

- 07 · TTL & expire: key hết hạn bị xoá lúc nào?
- 08 · Eviction: khi RAM đầy, Redis bỏ key nào?

**Pha 3 — Persistence**

- 09 · RDB snapshot: fork và copy-on-write
- 10 · AOF: fsync policy, rewrite và định dạng hybrid

**Pha 4 — Replication & HA**

- 11 · Replication: PSYNC, backlog và vì sao có thể mất ghi
- 12 · Sentinel: tự động failover cho master–replica

**Pha 5 — Redis Cluster**

- 13 · Redis Cluster: 16384 hash slot, gossip và failover
- 14 · Làm việc với Cluster: MOVED, ASK, CROSSSLOT và hash tag

**Pha 6 — Thực thi nhiều lệnh**

- 15 · Pipelining và transaction: MULTI/EXEC, WATCH
- 16 · Lua scripting và Redis Functions

**Pha 7 — Pattern thực chiến**

- 17 · Pattern cache: cache-aside, write-through, write-behind và invalidation
- 18 · Khi cache làm sập DB: stampede, avalanche, penetration
- 19 · Distributed lock: SET NX PX, Redlock và fencing token
- 20 · Rate limiter: fixed window, sliding window, token bucket
- 21 · Pub/Sub vs Streams: consumer group, PEL, XAUTOCLAIM
- 22 · Session store và mô hình hoá dữ liệu trong Redis

**Pha 8 — Vận hành & client**

- 23 · Tối ưu bộ nhớ và giám sát: INFO, SLOWLOG, LATENCY, MEMORY
- 24 · Client Rust: redis-rs và fred trong service thật

**Pha 9 — Tổng kết**

- 25 · Tổng kết: bản đồ quyết định và checklist production

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
