window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Ingest",
  title: "Insert đúng cách: batch lớn, async insert, chống trùng khi retry",
  subtitle: "Too many parts · 10k–100k hàng/insert · async_insert · insert deduplication & token",

  theory: `
    <p>Thói quen Spring Data <code>repository.save(event)</code> mỗi request là cách nhanh nhất để giết ClickHouse. Mỗi INSERT tạo part (bài 02);
    1.000 insert/giây = 1.000 part/giây, merge không theo kịp.</p>

    <p><strong>Các ngưỡng</strong> (theo partition, số part đang active):</p>
    <ul>
      <li><code>parts_to_delay_insert</code> (mặc định 1000 ở bản mới): vượt ⇒ server cố tình làm chậm insert.</li>
      <li><code>parts_to_throw_insert</code> (mặc định 3000 ở bản mới): vượt ⇒ lỗi <code>TOO_MANY_PARTS</code>. Tăng ngưỡng không phải cách sửa.</li>
    </ul>

    <p><strong>Khuyến nghị</strong>: mỗi insert ít nhất ~1.000 hàng, tốt nhất 10.000–100.000+; khoảng 1 insert/giây/bảng là thoải mái. Dữ liệu một insert nên thuộc ít partition.</p>

    <p><strong>Ba cách có batch lớn</strong></p>
    <ol>
      <li><strong>Batch phía client</strong>: gom trong bộ nhớ, đẩy theo số hàng hoặc thời gian (Inserter của crate Rust, bài 22).</li>
      <li><strong>async_insert = 1</strong>: server gom nhiều insert nhỏ vào buffer và ghi thành một part khi đủ kích thước/thời gian.
        Với <code>wait_for_async_insert = 1</code> (mặc định), client chỉ nhận OK khi dữ liệu đã ghi xuống đĩa — an toàn. Đặt 0 thì nhanh hơn nhưng có thể mất dữ liệu nếu server chết (fire-and-forget).</li>
      <li><strong>Hàng đợi ở giữa</strong>: đẩy vào Kafka, để Kafka engine/ClickPipes gom batch (bài 14–15).</li>
    </ol>

    <p><strong>Retry mà không trùng — insert deduplication</strong></p>
    <ul>
      <li>Bảng <strong>Replicated*</strong>: mặc định <code>insert_deduplicate = 1</code>. ClickHouse băm từng block insert; block giống hệt một block trong
      <code>replicated_deduplication_window</code> block gần nhất sẽ bị bỏ qua. Nên retry cùng batch y hệt (cùng hàng, cùng thứ tự) là an toàn.</li>
      <li>Bảng MergeTree thường: tắt mặc định, bật bằng <code>non_replicated_deduplication_window</code>.</li>
      <li><code>insert_deduplication_token</code>: tự cung cấp khoá dedup (vd "topic-partition-offsetĐầu-offsetCuối") thay cho hash nội dung.</li>
      <li>Async insert có dedup riêng (<code>async_insert_deduplicate</code>, tắt mặc định).</li>
    </ul>
    <p>Lưu ý: dedup này chống <em>retry cả batch</em>, không chống trùng <em>từng hàng</em> giữa các batch khác nhau — việc đó là của ReplacingMergeTree.</p>

    <div class="callout"><p>💡 Tương đương JDBC: dùng <code>addBatch()/executeBatch()</code> hàng chục nghìn dòng thay vì <code>executeUpdate()</code> từng dòng — nhưng ở ClickHouse đây là bắt buộc, không phải tối ưu.</p></div>
  `,

  codeTabs: [
    { id: "bad", label: "① Anti-pattern", lines: [
      "@PostMapping(\"/track\")",
      "public void track(@RequestBody Event e) {",
      "    jdbc.update(\"INSERT INTO events VALUES (?, ?, ?)\", e.ts(), e.user(), e.name());",
      "}",
      "// 2.000 req/s => 2.000 part/s",
      "// DB::Exception: Too many parts (3001) in partition 202409.",
      "//   Merges are processing significantly slower than inserts. (TOO_MANY_PARTS)"
    ]},
    { id: "async", label: "② async_insert", lines: [
      "-- bật cho user của service tracking (settings profile)",
      "ALTER USER tracking_svc SETTINGS",
      "    async_insert = 1,",
      "    wait_for_async_insert = 1;          -- chỉ OK khi đã ghi đĩa",
      "",
      "-- hoặc theo từng query qua HTTP",
      "$ curl 'http://ch:8123/?async_insert=1&wait_for_async_insert=1' \\",
      "    --data-binary 'INSERT INTO events FORMAT JSONEachRow {\"ts\":1727400000,\"user\":7,\"name\":\"view\"}'",
      "",
      "-- theo dõi buffer",
      "SELECT * FROM system.asynchronous_inserts;"
    ]},
    { id: "dedup", label: "③ Retry an toàn", lines: [
      "-- bảng Replicated: insert_deduplicate = 1 mặc định",
      "INSERT INTO events SETTINGS insert_deduplication_token = 'events-p3-1000-1999'",
      "VALUES ...;          -- timeout, không biết đã ghi chưa -> retry y hệt",
      "",
      "INSERT INTO events SETTINGS insert_deduplication_token = 'events-p3-1000-1999'",
      "VALUES ...;          -- bị bỏ qua, không tạo bản trùng",
      "",
      "-- MergeTree thường: bật cửa sổ dedup",
      "ALTER TABLE events MODIFY SETTING non_replicated_deduplication_window = 1000;"
    ]},
    { id: "watch", label: "④ Theo dõi part", lines: [
      "SELECT table, partition, count() AS parts",
      "FROM system.parts",
      "WHERE active",
      "GROUP BY table, partition",
      "ORDER BY parts DESC LIMIT 10;",
      "",
      "-- số part mới tạo mỗi phút (NewPart) từ part_log",
      "SELECT toStartOfMinute(event_time) m, count()",
      "FROM system.part_log WHERE event_type = 'NewPart'",
      "GROUP BY m ORDER BY m DESC LIMIT 10;"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="c1"><div class="nl">📱 req 1</div><div class="ns">1 hàng</div></div>
      <div class="node" id="c2"><div class="nl">📱 req 2</div><div class="ns">1 hàng</div></div>
      <div class="node" id="c3"><div class="nl">📱 req N</div><div class="ns">1 hàng</div></div>
    </div>
    <div class="arrow" id="a1">↓ không gom: mỗi req 1 part</div>
    <div class="node" id="boom"><div class="nl">💥 TOO_MANY_PARTS</div><div class="ns">merge không theo kịp</div></div>
    <div class="arrow" id="a2">↓ async_insert / batch client</div>
    <div class="node" id="buf"><div class="nl">🧺 Buffer</div><div class="ns">gom theo kích thước / thời gian</div></div>
    <div class="arrow" id="a3">↓ 1 part lớn</div>
    <div class="node" id="part"><div class="nl">📦 1 part / flush</div><div class="ns">retry cùng token → bị bỏ qua</div></div>
  `,
  steps: [
    { title: "1 · Insert từng hàng", tab: "bad", highlight: [3, 5, 6], on: ["c1", "c2", "c3", "a1", "boom"],
      desc: "Mỗi request một INSERT = một part. Số part vượt ngưỡng thì ClickHouse làm chậm rồi từ chối insert." },
    { title: "2 · Server gom bằng async_insert", tab: "async", highlight: [2, 3, 4], on: ["a2", "buf"],
      desc: "Nhiều insert nhỏ vào buffer, flush thành một part. wait_for_async_insert = 1 để client biết chắc dữ liệu đã bền." },
    { title: "3 · Flush thành part lớn", tab: "async", highlight: [7, 8, 11], on: ["a3", "part"],
      desc: "system.asynchronous_inserts cho thấy dữ liệu đang chờ trong buffer." },
    { title: "4 · Retry idempotent", tab: "dedup", highlight: [2, 5, 6, 9], on: ["part"],
      desc: "Cùng token (hoặc cùng nội dung block với bảng Replicated) thì insert lặp bị bỏ qua. Chống trùng khi retry batch, không phải chống trùng từng hàng." },
    { title: "5 · Theo dõi", tab: "watch", highlight: [1, 5, 9], on: ["boom"],
      desc: "Số part active theo partition và tốc độ tạo part mới là hai chỉ số cần cảnh báo." }
  ],

  quiz: [
    { q: "Vì sao insert từng hàng với tần suất cao gây hại?", options: [
        "Vì ClickHouse khoá bảng",
        "Mỗi insert tạo một part; quá nhiều part làm merge không theo kịp → chậm rồi TOO_MANY_PARTS",
        "Vì tốn băng thông",
        "Không gây hại"
      ], correct: 1, explanation: "Đây là lỗi vận hành phổ biến nhất." },
    { q: "Kích thước batch khuyến nghị cho mỗi INSERT?", options: [
        "1 hàng", "Ít nhất ~1.000, tốt nhất 10.000–100.000+ hàng", "Đúng 8192", "Tối đa 100"
      ], correct: 1, explanation: "Kèm tần suất khoảng 1 insert/giây/bảng." },
    { q: "async_insert = 1 làm gì?", options: [
        "Client tự gom batch",
        "Server gom nhiều insert nhỏ vào buffer rồi ghi thành một part",
        "Bỏ qua ghi đĩa",
        "Chạy insert trên replica khác"
      ], correct: 1, explanation: "Phù hợp khi nhiều client nhỏ không tự batch được." },
    { q: "wait_for_async_insert = 0 có rủi ro gì?", options: [
        "Không rủi ro",
        "Client nhận OK trước khi dữ liệu bền trên đĩa; server chết có thể mất dữ liệu và client không biết lỗi",
        "Chậm hơn",
        "Tạo nhiều part hơn"
      ], correct: 1, explanation: "Fire-and-forget; chỉ dùng khi chấp nhận mất mát." },
    { q: "Insert deduplication mặc định bật cho loại bảng nào?", options: [
        "Mọi MergeTree", "Replicated*MergeTree", "Chỉ Kafka engine", "Không bảng nào"
      ], correct: 1, explanation: "MergeTree thường phải bật non_replicated_deduplication_window." },
    { q: "Insert dedup chống được loại trùng nào?", options: [
        "Hai hàng cùng order_id ở hai batch khác nhau",
        "Retry lại đúng một batch đã ghi (cùng nội dung hoặc cùng insert_deduplication_token)",
        "Mọi loại trùng",
        "Trùng giữa các bảng"
      ], correct: 1, explanation: "Trùng theo khoá nghiệp vụ cần ReplacingMergeTree." },
    { q: "insert_deduplication_token dùng khi nào?", options: [
        "Khi muốn tự định nghĩa danh tính batch (vd theo dải offset Kafka) thay cho hash nội dung",
        "Để xác thực user",
        "Để mã hoá dữ liệu",
        "Để chọn shard"
      ], correct: 0, explanation: "Hữu ích khi nội dung batch retry có thể khác thứ tự." },
    { q: "Gặp TOO_MANY_PARTS, cách sửa đúng?", options: [
        "Tăng parts_to_throw_insert lên thật cao",
        "Giảm số insert: batch lớn hơn, async_insert, xem lại partition key",
        "Tắt merge",
        "Chuyển sang Nullable"
      ], correct: 1, explanation: "Tăng ngưỡng chỉ trì hoãn vấn đề." },
    { q: "Bảng hệ thống nào cho biết tốc độ tạo part mới?", options: [
        "system.part_log (event_type = 'NewPart')", "system.users", "system.clusters", "system.functions"
      ], correct: 0, explanation: "part_log ghi lại NewPart, MergeParts, RemovePart…" }
  ]
});
