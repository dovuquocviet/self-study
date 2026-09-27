window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Vận hành",
  title: "Hiệu năng & chọn số partition",
  subtitle: "Công thức ước lượng · cái giá của quá nhiều partition · tinh chỉnh producer/consumer · đo bằng perf-test",

  theory: `
    <p><strong>Số partition</strong> quyết định trần song song của consumer group và độ phân tán tải — nhưng không phải càng nhiều càng tốt.</p>

    <p><strong>Công thức ước lượng</strong>: gọi T = thông lượng mục tiêu (MB/s hoặc msg/s, <em>tính cả đỉnh và tăng trưởng 1–2 năm</em>),
    p = thông lượng một partition phía producer đạt được, c = thông lượng <em>một consumer</em> xử lý được (thường là nút thắt vì consumer làm việc thật: ghi DB, gọi API).</p>
    <p><code>số partition ≥ max(T / p, T / c)</code>. Ví dụ: đỉnh 6.000 msg/s, mỗi consumer ghi DB được 400 msg/s → cần ≥ 15 consumer → chọn 24 partition (dư cho tăng trưởng, chia hết cho nhiều số lượng pod: 1, 2, 3, 4, 6, 8, 12, 24).</p>

    <p><strong>Cái giá của quá nhiều partition</strong></p>
    <ul>
      <li>Mỗi partition-replica là thư mục + file mở + index mmap trên broker; nhiều partition → nhiều metadata, bầu leader khi failover lâu hơn (KRaft cải thiện nhiều nhưng không miễn phí).</li>
      <li>Producer: mỗi partition một batch riêng → nhiều partition chia nhỏ batch → nén kém, request nhiều.</li>
      <li>Consumer: nhiều fetch session, rebalance nặng hơn.</li>
      <li>Hướng dẫn thô: vài nghìn partition-replica mỗi broker là thoải mái; hàng chục nghìn cần tính toán kỹ. Topic nhỏ (vài msg/s) không cần 50 partition — 3–6 là đủ.</li>
    </ul>

    <p><strong>Đòn bẩy hiệu năng — theo thứ tự hay dùng</strong></p>
    <table>
      <tr><th>Phía</th><th>Cấu hình</th><th>Tác dụng</th></tr>
      <tr><td>Producer</td><td><code>linger.ms</code> 10–50, <code>batch.size</code> lớn, <code>compression.type=zstd|lz4</code></td><td>Batch to, ít request, ít băng thông</td></tr>
      <tr><td>Consumer</td><td><code>fetch.min.bytes</code>, <code>fetch.max.wait.ms</code> (Java; librdkafka là <code>fetch.wait.max.ms</code>), <code>max.partition.fetch.bytes</code></td><td>Mỗi fetch mang nhiều dữ liệu hơn</td></tr>
      <tr><td>Consumer</td><td>Xử lý theo lô: gom 500–5000 message rồi ghi DB một lần</td><td>Thường là đòn bẩy lớn nhất (vd insert ClickHouse theo lô)</td></tr>
      <tr><td>Broker</td><td>Đĩa nhanh, RAM cho page cache, <code>num.io.threads</code>/<code>num.network.threads</code></td><td>Giữ đuôi log trong RAM</td></tr>
      <tr><td>Hạ tầng</td><td>Rack awareness, đọc follower gần</td><td>Giảm phí và độ trễ giữa AZ</td></tr>
    </table>

    <p><strong>Kích thước message</strong>: mặc định tối đa ~1 MiB. Payload lớn (ảnh, file) → lưu object storage (S3/R2), Kafka chỉ mang đường dẫn (<em>claim check pattern</em>).</p>

    <p><strong>Ước lượng đĩa</strong>: dung lượng = thông lượng ghi (sau nén) × retention × replication factor. 20 MB/s × 7 ngày × 3 ≈ 20 × 604800 × 3 ≈ 36 TB — cộng 30% dư.</p>

    <div class="callout"><p>💡 Đừng đoán — đo. <code>kafka-producer-perf-test.sh</code> và <code>kafka-consumer-perf-test.sh</code> cho con số trần của cluster;
    còn con số thật của consumer là tốc độ xử lý nghiệp vụ, phải đo bằng chính service của bạn.</p></div>
  `,

  codeTabs: [
    { id: "calc", label: "① Tính số partition", lines: [
      "đỉnh hiện tại        : 3000 msg/s   (x2 tăng trưởng)  -> T = 6000 msg/s",
      "1 consumer (ghi PG)  : c = 400 msg/s",
      "1 partition producer : p = 20000 msg/s (không phải nút thắt)",
      "",
      "cần >= max(6000/20000, 6000/400) = 15 consumer",
      "chọn 24 partition: chia đều cho 1,2,3,4,6,8,12,24 pod"
    ]},
    { id: "perf", label: "② Đo trần cluster", lines: [
      "kafka-producer-perf-test.sh --topic perf --num-records 5000000 \\",
      "  --record-size 1024 --throughput -1 \\",
      "  --producer-props bootstrap.servers=b:9092 acks=all linger.ms=20 \\",
      "    batch.size=262144 compression.type=zstd",
      "",
      "kafka-consumer-perf-test.sh --bootstrap-server b:9092 --topic perf \\",
      "  --messages 5000000 --group perf-test"
    ]},
    { id: "batch", label: "③ Consumer xử lý theo lô (Rust)", lines: [
      "let mut buf = Vec::with_capacity(2000);",
      "let mut deadline = Instant::now() + Duration::from_millis(500);",
      "loop {",
      "    tokio::select! {",
      "        r = consumer.recv() => buf.push(r?.detach()),",
      "        _ = tokio::time::sleep_until(deadline) => {}",
      "    }",
      "    if buf.len() >= 2000 || Instant::now() >= deadline {",
      "        if !buf.is_empty() { insert_batch(&db, &buf).await?; store_offsets(&consumer, &buf)?; }",
      "        buf.clear();",
      "        deadline = Instant::now() + Duration::from_millis(500);",
      "    }",
      "}"
    ]},
    { id: "disk", label: "④ Ước lượng đĩa", lines: [
      "ghi (sau nén) : 20 MB/s",
      "retention     : 7 ngày = 604800 s",
      "RF            : 3",
      "",
      "20 MB/s x 604800 s x 3 = 36.288.000 MB ≈ 36 TB",
      "+ 30% dự phòng        ≈ 47 TB   (chia cho số broker)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="t"><div class="nl">🎯 Thông lượng mục tiêu T</div><div class="ns">đỉnh × tăng trưởng</div></div>
    <div class="arrow" id="a1">↓ max(T/p, T/c)</div>
    <div class="node" id="n"><div class="nl">🔢 Số partition</div><div class="ns">đủ song song, dư tăng trưởng, không quá nhiều</div></div>
    <div class="row">
      <div class="node" id="pr"><div class="nl">✍️ Producer</div><div class="ns">linger · batch · zstd</div></div>
      <div class="node" id="cs"><div class="nl">👀 Consumer</div><div class="ns">fetch lớn · xử lý theo lô</div></div>
      <div class="node" id="bk"><div class="nl">📦 Broker</div><div class="ns">page cache · đĩa</div></div>
    </div>
    <div class="node" id="m"><div class="nl">📏 Đo bằng perf-test</div><div class="ns">và bằng chính service</div></div>
  `,
  steps: [
    { title: "1 · Tính số partition", tab: "calc", highlight: [1, 2, 5, 6], on: ["t", "a1", "n"],
      desc: "Consumer thường là nút thắt. Chọn số có nhiều ước để chia đều cho số pod." },
    { title: "2 · Đo trần cluster", tab: "perf", highlight: [1, 3, 4, 6], on: ["m", "bk"],
      desc: "Biết trần của hạ tầng trước khi đổ lỗi cho Kafka." },
    { title: "3 · Consumer theo lô", tab: "batch", highlight: [4, 5, 6, 8, 9], on: ["cs"],
      desc: "Gom tới 2000 message hoặc 500ms. Một lần insert thay vì 2000 lần — thường nhanh hơn cả chục lần." },
    { title: "4 · Producer", tab: "perf", highlight: [3, 4], on: ["pr"],
      desc: "linger + batch + nén là ba núm quan trọng nhất." },
    { title: "5 · Dung lượng", tab: "disk", highlight: [5, 6], on: ["bk"],
      desc: "Thông lượng × retention × RF. Nhớ tính sau nén." }
  ],

  quiz: [
    { q: "Công thức ước lượng số partition phổ biến?", options: [
        "Số broker × 2", "max(T/p, T/c) với p, c là thông lượng một partition/một consumer", "Luôn 100", "Bằng số service"
      ], correct: 1, explanation: "Cộng dư cho tăng trưởng." },
    { q: "Trong hệ thống nghiệp vụ, nút thắt thường nằm ở…", options: [
        "Producer", "Consumer (xử lý: ghi DB, gọi API)", "Controller", "Schema Registry"
      ], correct: 1, explanation: "Vì vậy c thường quyết định." },
    { q: "Vì sao chọn 12 hoặc 24 partition thay vì 13?", options: [
        "Kafka yêu cầu số chẵn",
        "Nhiều ước số → chia đều cho nhiều cỡ deployment khác nhau",
        "Nhanh hơn về hash",
        "Không có lý do"
      ], correct: 1, explanation: "13 partition với 4 pod → lệch 4/3/3/3." },
    { q: "Tác hại của quá nhiều partition?", options: [
        "Không có",
        "Nhiều file/metadata, batch producer vụn, failover/rebalance nặng hơn",
        "Mất dữ liệu",
        "Không nén được"
      ], correct: 1, explanation: "Chọn vừa đủ + dư hợp lý." },
    { q: "Đòn bẩy lớn nhất cho consumer ghi DB thường là…", options: [
        "Tăng session.timeout", "Xử lý/ghi theo lô", "Giảm partition", "acks=0"
      ], correct: 1, explanation: "Đặc biệt với ClickHouse — insert từng dòng là anti-pattern." },
    { q: "Payload 20 MB (file PDF) nên xử lý thế nào?", options: [
        "Tăng message.max.bytes lên 50MB",
        "Lưu object storage, Kafka mang đường dẫn (claim check)",
        "Chia thành 20 message",
        "Nén gzip"
      ], correct: 1, explanation: "Message lớn làm hại cả broker lẫn consumer." },
    { q: "Ghi 10 MB/s (sau nén), retention 3 ngày, RF 3. Dung lượng thô xấp xỉ?", options: [
        "2,6 TB", "7,8 TB", "26 TB", "780 GB"
      ], correct: 1, explanation: "10 × 259200 × 3 ≈ 7.776.000 MB ≈ 7,8 TB." },
    { q: "Ba núm producer quan trọng nhất cho thông lượng?", options: [
        "acks, retries, key", "linger.ms, batch.size, compression.type", "group.id, client.id, topic", "session.timeout, heartbeat, poll"
      ], correct: 1, explanation: "Batch to và nén tốt." },
    { q: "Công cụ đo trần thông lượng cluster đi kèm Kafka?", options: [
        "kafka-topics.sh", "kafka-producer-perf-test.sh / kafka-consumer-perf-test.sh", "kafka-acls.sh", "kafka-storage.sh"
      ], correct: 1, explanation: "Đo trước khi tinh chỉnh." }
  ]
});
