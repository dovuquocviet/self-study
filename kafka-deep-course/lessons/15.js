window.LESSONS.push({
  id: "15",
  phase: "4", phaseName: "Dữ liệu & schema",
  title: "Retention vs log compaction",
  subtitle: "cleanup.policy=delete|compact · tombstone · active segment · topic 'trạng thái mới nhất'",

  theory: `
    <p>Log không thể lớn mãi. Kafka có hai chính sách dọn dẹp, đặt bằng <code>cleanup.policy</code> cho từng topic:</p>

    <p><strong>1. <code>delete</code> (mặc định) — xoá theo tuổi/dung lượng</strong></p>
    <ul>
      <li><code>retention.ms</code> (mặc định 7 ngày) và/hoặc <code>retention.bytes</code> (mặc định -1 = không giới hạn, tính <em>theo partition</em>).</li>
      <li>Xoá cả <strong>segment</strong> khi record <em>mới nhất</em> trong segment đã quá hạn. Active segment không bị xoá → dữ liệu có thể sống lâu hơn retention.ms tới khoảng <code>segment.ms</code>.</li>
      <li>Consumer chậm hơn retention → offset commit trỏ vào dữ liệu đã bị xoá → <code>OFFSET_OUT_OF_RANGE</code> → áp dụng <code>auto.offset.reset</code> (earliest = nhảy tới đầu còn lại → <em>mất</em> phần bị xoá).</li>
    </ul>

    <p><strong>2. <code>compact</code> — giữ bản mới nhất của mỗi key</strong></p>
    <ul>
      <li>Log cleaner (luồng nền) quét các segment đã đóng, với mỗi key chỉ giữ record có offset lớn nhất. Offset <strong>không đổi</strong>, chỉ có "lỗ".</li>
      <li><strong>Tombstone</strong>: record có key và <code>value = null</code> nghĩa là "xoá key này". Tombstone được giữ thêm <code>delete.retention.ms</code> (mặc định 1 ngày) để consumer kịp thấy, rồi mới bị dọn.</li>
      <li>Bắt buộc có key. Chỉ đảm bảo "<em>cuối cùng</em> còn ít nhất bản mới nhất" — phần đuôi chưa compact vẫn có nhiều bản.</li>
      <li>Núm vặn: <code>min.cleanable.dirty.ratio</code> (0.5), <code>min.compaction.lag.ms</code> (giữ nguyên ít nhất bao lâu), <code>max.compaction.lag.ms</code> (muộn nhất phải compact).</li>
      <li><code>cleanup.policy=compact,delete</code>: vừa compact vừa xoá bản quá cũ.</li>
    </ul>

    <table>
      <tr><th>Dùng khi</th><th>Chính sách</th><th>Ví dụ</th></tr>
      <tr><td>Luồng sự kiện (cái gì đã xảy ra)</td><td>delete</td><td>orders, clicks, payments</td></tr>
      <tr><td>Trạng thái hiện tại theo key (bảng)</td><td>compact</td><td>customer-profile, product-price, cấu hình</td></tr>
      <tr><td>Nội bộ Kafka</td><td>compact</td><td><code>__consumer_offsets</code>, <code>__transaction_state</code></td></tr>
    </table>

    <p><strong>Ứng dụng</strong>: service mới khởi động cần bảng giá hiện tại → đọc topic <code>product-prices</code> (compacted) từ đầu vào một HashMap/Redis là có "snapshot", sau đó tiếp tục nghe thay đổi.
    Đây là nền tảng của KTable trong Kafka Streams và của CDC (Debezium) giữ trạng thái bảng.</p>

    <div class="callout"><p>💡 Retention là cam kết với <em>consumer</em>: nó là khoảng thời gian tối đa một consumer được phép chết/chậm mà không mất dữ liệu.
    Đặt retention theo "sự cố dài nhất ta cần chịu được + thời gian replay", không phải theo cảm tính.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "① Tạo hai loại topic", lines: [
      "# luồng sự kiện: giữ 14 ngày",
      "kafka-topics.sh --bootstrap-server b:9092 --create --topic orders \\",
      "  --partitions 12 --replication-factor 3 \\",
      "  --config retention.ms=1209600000",
      "",
      "# trạng thái mới nhất theo key",
      "kafka-topics.sh --bootstrap-server b:9092 --create --topic product-prices \\",
      "  --partitions 6 --replication-factor 3 \\",
      "  --config cleanup.policy=compact \\",
      "  --config min.compaction.lag.ms=3600000 \\",
      "  --config delete.retention.ms=86400000"
    ]},
    { id: "compact", label: "② Trước & sau compaction", lines: [
      "TRƯỚC (segment đã đóng):",
      "  off 0 sku-1 = 100",
      "  off 1 sku-2 = 50",
      "  off 2 sku-1 = 120",
      "  off 3 sku-3 = 70",
      "  off 4 sku-2 = null        # tombstone: xoá sku-2",
      "  off 5 sku-1 = 115",
      "",
      "SAU:",
      "  off 3 sku-3 = 70",
      "  off 4 sku-2 = null        # còn giữ delete.retention.ms rồi mới mất",
      "  off 5 sku-1 = 115",
      "# offset giữ nguyên, chỉ có lỗ 0,1,2"
    ]},
    { id: "rust", label: "③ Gửi tombstone (Rust)", lines: [
      "// cập nhật giá",
      "producer.send(FutureRecord::to(\"product-prices\").key(\"sku-1\").payload(&price_json),",
      "              Duration::from_secs(1)).await.map_err(|(e, _)| e)?;",
      "",
      "// xoá sản phẩm: có key, KHÔNG có payload -> value null",
      "producer.send(FutureRecord::<str, ()>::to(\"product-prices\").key(\"sku-2\"),",
      "              Duration::from_secs(1)).await.map_err(|(e, _)| e)?;",
      "",
      "// consumer: m.payload() == None -> xoá khỏi cache"
    ]},
    { id: "oor", label: "④ Consumer chậm hơn retention", lines: [
      "group analytics dừng 10 ngày, retention.ms = 7 ngày",
      "offset commit = 5_000_000, log start offset hiện tại = 7_200_000",
      "",
      "fetch(5_000_000) -> OFFSET_OUT_OF_RANGE",
      "auto.offset.reset=earliest -> nhảy tới 7_200_000   (mất 2,2 triệu message)",
      "auto.offset.reset=latest   -> nhảy tới cuối         (mất nhiều hơn)",
      "auto.offset.reset=none     -> báo lỗi cho ứng dụng  (để người quyết định)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="del"><div class="nl">🗑️ cleanup.policy=delete</div><div class="ns">xoá segment quá retention</div></div>
      <div class="node" id="cmp"><div class="nl">🧹 cleanup.policy=compact</div><div class="ns">giữ bản mới nhất mỗi key</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="ev"><div class="nl">orders</div><div class="ns">luồng sự kiện</div></div>
      <div class="node" id="st"><div class="nl">product-prices</div><div class="ns">bảng trạng thái</div></div>
    </div>
    <div class="node" id="tomb"><div class="nl">🪦 Tombstone</div><div class="ns">key + value null = xoá key</div></div>
    <div class="node" id="slow"><div class="nl">🐢 Consumer chậm hơn retention</div><div class="ns">OFFSET_OUT_OF_RANGE → mất dữ liệu</div></div>
  `,
  steps: [
    { title: "1 · Hai loại topic", tab: "cfg", highlight: [4, 9, 10, 11], on: ["del", "cmp", "ev", "st"],
      desc: "Sự kiện dùng delete theo thời gian; trạng thái dùng compact." },
    { title: "2 · Compaction giữ bản mới nhất", tab: "compact", highlight: [2, 4, 7, 10, 12, 13], on: ["cmp", "st"],
      desc: "sku-1 chỉ còn bản 115. Offset không bị đánh lại." },
    { title: "3 · Tombstone", tab: "rust", highlight: [5, 6, 9], on: ["tomb"],
      desc: "Gửi key với value null. Consumer phải hiểu None là xoá." },
    { title: "4 · Tombstone cũng hết hạn", tab: "compact", highlight: [6, 11], on: ["tomb"],
      desc: "Sau delete.retention.ms tombstone bị dọn. Consumer offline lâu hơn thế có thể không bao giờ thấy lệnh xoá." },
    { title: "5 · Consumer chậm hơn retention", tab: "oor", highlight: [4, 5, 6, 7], on: ["slow", "del"],
      desc: "Retention là giới hạn chịu đựng của consumer. none giúp phát hiện thay vì âm thầm nhảy qua." }
  ],

  quiz: [
    { q: "cleanup.policy mặc định của topic là?", options: ["compact", "delete", "compact,delete", "none"], correct: 1,
      explanation: "Xoá theo retention.ms (7 ngày) / retention.bytes." },
    { q: "Log compaction đảm bảo điều gì?", options: [
        "Chỉ có đúng một record cho mỗi key tại mọi thời điểm",
        "Cuối cùng còn ít nhất bản mới nhất của mỗi key (phần chưa compact có thể còn nhiều bản)",
        "Xoá mọi record cũ hơn 7 ngày",
        "Nén dữ liệu bằng zstd"
      ], correct: 1, explanation: "Active segment và phần 'dirty' chưa được dọn." },
    { q: "Tombstone là gì?", options: [
        "Record key null", "Record có key và value null — đánh dấu xoá key", "Segment bị hỏng", "Partition offline"
      ], correct: 1, explanation: "Được giữ delete.retention.ms rồi mới dọn." },
    { q: "Sau compaction, offset của các record còn lại thế nào?", options: [
        "Được đánh số lại từ 0", "Giữ nguyên, có lỗ ở chỗ record bị xoá", "Đổi thành timestamp", "Đảo ngược"
      ], correct: 1, explanation: "Consumer phải chịu được offset không liên tục." },
    { q: "Topic nào nên dùng compact?", options: [
        "clicks", "payments (lịch sử giao dịch)", "customer-profile (trạng thái mới nhất theo customer_id)", "app-logs"
      ], correct: 2, explanation: "Compact dành cho dữ liệu dạng bảng." },
    { q: "retention.bytes được tính theo…", options: ["Topic", "Partition", "Broker", "Cluster"], correct: 1,
      explanation: "Topic 12 partition × retention.bytes 10GB = tới 120GB (chưa nhân replica)." },
    { q: "Vì sao dữ liệu có thể sống lâu hơn retention.ms?", options: [
        "Lỗi Kafka",
        "Xoá theo segment; active segment chưa đóng thì chưa bị xoá",
        "Replica giữ lại",
        "Consumer khoá"
      ], correct: 1, explanation: "segment.ms/segment.bytes quyết định khi nào segment đóng." },
    { q: "Consumer offline lâu hơn retention, auto.offset.reset=earliest. Điều gì xảy ra?", options: [
        "Đọc tiếp từ offset cũ",
        "Nhảy tới offset sớm nhất còn lại; phần đã bị xoá bị bỏ qua",
        "Báo lỗi",
        "Broker khôi phục dữ liệu"
      ], correct: 1, explanation: "Đặt 'none' nếu muốn phát hiện tình huống này." },
    { q: "Service mới cần bảng giá hiện tại khi khởi động. Cách dùng topic compacted?", options: [
        "Gọi REST sang service giá",
        "Đọc topic product-prices từ đầu để dựng cache, rồi tiếp tục nghe cập nhật",
        "Đọc __consumer_offsets",
        "Không thể"
      ], correct: 1, explanation: "Nền tảng của KTable/CDC." }
  ]
});
