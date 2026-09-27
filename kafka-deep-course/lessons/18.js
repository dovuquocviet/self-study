window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Vận hành",
  title: "Consumer lag & giám sát cluster",
  subtitle: "lag = log-end-offset − committed · lag theo thời gian · metric broker quan trọng · reset offset",

  theory: `
    <p><strong>Consumer lag</strong> của một partition = <code>log-end-offset − committed-offset</code> của group. Tổng lag của group = tổng các partition.
    Đây là chỉ số số một cho biết consumer có theo kịp không.</p>

    <p><strong>Đọc lag cho đúng</strong></p>
    <ul>
      <li>Lag <em>dao động</em> quanh một mức ổn định → bình thường (commit định kỳ, batch).</li>
      <li>Lag <em>tăng đều</em> → tốc độ xử lý &lt; tốc độ ghi. Scale consumer (nếu còn partition trống), tối ưu xử lý, hoặc tăng partition.</li>
      <li>Lag cao chỉ ở <em>một</em> partition → hot partition hoặc poison pill kẹt (bài 07, 17).</li>
      <li>Lag = số message, nhưng SLA nói bằng <em>thời gian</em>. 100.000 message lag với 50.000 msg/s là 2 giây; với 10 msg/s là 3 tiếng.
        Hãy theo dõi <strong>lag theo thời gian</strong> (tuổi của message chưa xử lý), vd bằng timestamp của message tại offset commit.</li>
      <li>So với retention: lag theo thời gian tiến gần retention → sắp mất dữ liệu (bài 15). Cảnh báo sớm.</li>
    </ul>

    <p><strong>Công cụ</strong>: <code>kafka-consumer-groups.sh --describe</code>; exporter Prometheus (vd kafka-exporter, KMinion, Burrow); metric phía client
    (<code>records-lag-max</code> ở Java; <code>consumer_lag</code> trong statistics JSON của librdkafka — bật <code>statistics.interval.ms</code> và nhận qua <code>ClientContext::stats</code> trong rdkafka).</p>

    <p><strong>Metric broker phải có cảnh báo</strong></p>
    <table>
      <tr><th>Metric</th><th>Bình thường</th><th>Ý nghĩa khi lệch</th></tr>
      <tr><td>UnderReplicatedPartitions</td><td>0</td><td>Có replica tụt khỏi ISR — broker chậm/chết, đĩa/mạng</td></tr>
      <tr><td>UnderMinIsrPartitionCount</td><td>0</td><td>Producer acks=all đang bị từ chối ghi</td></tr>
      <tr><td>OfflinePartitionsCount</td><td>0</td><td>Partition không có leader — mất khả năng đọc/ghi</td></tr>
      <tr><td>ActiveControllerCount (tổng cluster)</td><td>1</td><td>0 = không có controller; &gt;1 = bất thường</td></tr>
      <tr><td>RequestHandlerAvgIdlePercent</td><td>&gt; 0.3</td><td>Broker quá tải xử lý request</td></tr>
      <tr><td>Produce/Fetch request latency (p99)</td><td>ổn định</td><td>Đĩa chậm, GC, mạng</td></tr>
      <tr><td>Dung lượng đĩa</td><td>&lt; 70–80%</td><td>Đĩa đầy = broker dừng</td></tr>
    </table>

    <p><strong>Reset offset</strong> (group phải đang <em>không</em> có thành viên hoạt động): <code>--to-earliest</code>, <code>--to-latest</code>, <code>--to-datetime</code>, <code>--shift-by</code>, <code>--to-offset</code>.
    Luôn chạy <code>--dry-run</code> trước, rồi <code>--execute</code>.</p>

    <div class="callout"><p>💡 Cảnh báo hay nhất cho từng consumer: "lag theo thời gian &gt; X phút trong 10 phút liên tục". Nó bắt được cả consumer chết, consumer chậm,
    poison pill và hot partition — mà không báo động giả khi lag dao động ngắn.</p></div>
  `,

  codeTabs: [
    { id: "cli", label: "① Xem lag", lines: [
      "kafka-consumer-groups.sh --bootstrap-server b:9092 --describe --group clickhouse-ingest",
      "",
      "GROUP             TOPIC  PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG     CONSUMER-ID",
      "clickhouse-ingest orders 0         1200450        1200460        10      rdkafka-3f...",
      "clickhouse-ingest orders 1         1188000        1190020        2020    rdkafka-3f...",
      "clickhouse-ingest orders 2         640000         1195000        555000  rdkafka-9a...  <- !",
      "",
      "# partition 2 lag gấp hàng trăm lần -> hot partition hoặc kẹt poison pill"
    ]},
    { id: "reset", label: "② Reset offset", lines: [
      "# dừng mọi consumer của group trước",
      "kafka-consumer-groups.sh --bootstrap-server b:9092 --group clickhouse-ingest \\",
      "  --topic orders --reset-offsets --to-datetime 2026-09-25T00:00:00.000 --dry-run",
      "",
      "kafka-consumer-groups.sh --bootstrap-server b:9092 --group clickhouse-ingest \\",
      "  --topic orders --reset-offsets --to-datetime 2026-09-25T00:00:00.000 --execute",
      "",
      "# bỏ qua 1 poison pill ở partition 2: --topic orders:2 --shift-by 1"
    ]},
    { id: "rust", label: "③ Metric từ rdkafka", lines: [
      "struct StatsCtx;",
      "impl ClientContext for StatsCtx {",
      "    fn stats(&self, s: Statistics) {",
      "        for (topic, t) in &s.topics {",
      "            for (p, part) in &t.partitions {",
      "                metrics::gauge!(\"kafka_consumer_lag\", \"topic\" => topic.clone(),",
      "                    \"partition\" => p.to_string()).set(part.consumer_lag as f64);",
      "            }",
      "        }",
      "    }",
      "}",
      "impl ConsumerContext for StatsCtx {}",
      "// ClientConfig: .set(\"statistics.interval.ms\", \"15000\")"
    ]},
    { id: "alert", label: "④ Luật cảnh báo (PromQL)", lines: [
      "# lag theo message tăng liên tục 15 phút",
      "deriv(sum by (group, topic) (kafka_consumergroup_lag)[15m:]) > 0",
      "",
      "# broker",
      "sum(kafka_server_replicamanager_underreplicatedpartitions) > 0",
      "sum(kafka_controller_kafkacontroller_offlinepartitionscount) > 0",
      "sum(kafka_controller_kafkacontroller_activecontrollercount) != 1",
      "",
      "# (tên metric tuỳ exporter; ý nghĩa là như nhau)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="leo"><div class="nl">📜 log-end-offset</div><div class="ns">producer ghi tới đây</div></div>
    <div class="arrow" id="a1">↕ LAG</div>
    <div class="node" id="co"><div class="nl">✅ committed offset</div><div class="ns">group đã xử lý tới đây</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">〰️ dao động ổn định</div><div class="ns">bình thường</div></div>
      <div class="node" id="up"><div class="nl">📈 tăng đều</div><div class="ns">xử lý chậm hơn ghi</div></div>
      <div class="node" id="one"><div class="nl">🎯 một partition</div><div class="ns">hot key / poison pill</div></div>
    </div>
    <div class="node" id="brk"><div class="nl">🩺 Metric broker</div><div class="ns">URP · UnderMinIsr · Offline · ActiveController</div></div>
  `,
  steps: [
    { title: "1 · Lag là gì", tab: "cli", highlight: [3, 4, 5], on: ["leo", "a1", "co"],
      desc: "LOG-END-OFFSET − CURRENT-OFFSET cho từng partition." },
    { title: "2 · Đọc hình dạng lag", tab: "cli", highlight: [6, 8], on: ["one"],
      desc: "Lag dồn vào một partition gần như luôn là vấn đề key hoặc một message kẹt." },
    { title: "3 · Đo từ client Rust", tab: "rust", highlight: [3, 7, 13], on: ["up"],
      desc: "librdkafka gửi JSON thống kê định kỳ; rdkafka parse sẵn thành Statistics." },
    { title: "4 · Cảnh báo", tab: "alert", highlight: [2, 5, 6, 7], on: ["up", "brk"],
      desc: "Cảnh báo theo xu hướng, không theo một điểm. Metric broker cơ bản phải luôn bằng 0/1." },
    { title: "5 · Reset offset an toàn", tab: "reset", highlight: [1, 3, 6, 8], on: ["co"],
      desc: "Dừng group, dry-run, rồi execute. shift-by 1 để nhảy qua một poison pill khi khẩn cấp (nhớ lưu lại message đó)." }
  ],

  quiz: [
    { q: "Consumer lag của một partition được tính thế nào?", options: [
        "committed − 0", "log-end-offset − committed offset của group", "Số consumer × số partition", "HW − LEO"
      ], correct: 1, explanation: "Tổng lag group = tổng các partition." },
    { q: "Vì sao nên theo dõi lag theo THỜI GIAN thay vì chỉ số message?", options: [
        "Dễ tính hơn",
        "Cùng một số message lag có thể là vài giây hoặc vài giờ tuỳ tốc độ; SLA nói bằng thời gian",
        "Kafka không có offset",
        "Không có lý do"
      ], correct: 1, explanation: "Và so trực tiếp được với retention." },
    { q: "Lag rất cao ở đúng một partition, các partition khác ~0. Nghi ngờ đầu tiên?", options: [
        "Broker chết", "Hot partition hoặc poison pill kẹt", "Sai acks", "Thiếu RAM producer"
      ], correct: 1, explanation: "Vấn đề cục bộ ở partition đó." },
    { q: "UnderMinIsrPartitionCount > 0 có ảnh hưởng gì tới producer acks=all?", options: [
        "Không ảnh hưởng", "Ghi vào các partition đó bị từ chối (NOT_ENOUGH_REPLICAS)", "Nhanh hơn", "Mất dữ liệu cũ"
      ], correct: 1, explanation: "ISR < min.insync.replicas." },
    { q: "ActiveControllerCount tổng cluster bình thường bằng?", options: ["0", "1", "Số broker", "3"], correct: 1,
      explanation: "Đúng một active controller." },
    { q: "Điều kiện để reset offset của group bằng kafka-consumer-groups?", options: [
        "Group đang chạy", "Group không có thành viên hoạt động", "Topic phải compacted", "Phải restart broker"
      ], correct: 1, explanation: "Và nên --dry-run trước." },
    { q: "Lấy lag từ client rdkafka bằng cách nào?", options: [
        "Không thể",
        "Bật statistics.interval.ms và đọc Statistics trong ClientContext::stats",
        "Đọc __consumer_offsets trực tiếp",
        "Gọi controller"
      ], correct: 1, explanation: "Trường consumer_lag theo partition." },
    { q: "Lag theo thời gian tiến gần retention.ms. Nguy cơ?", options: [
        "Không có", "Dữ liệu chưa xử lý sắp bị xoá → mất", "Rebalance", "Tăng partition tự động"
      ], correct: 1, explanation: "Cảnh báo phải kích hoạt sớm hơn nhiều." },
    { q: "Kiểu cảnh báo lag nào ít báo động giả nhất?", options: [
        "Lag > 0",
        "Lag theo thời gian vượt ngưỡng liên tục trong một khoảng (vd 10 phút)",
        "Lag bất kỳ lúc nào > 100",
        "Không cảnh báo"
      ], correct: 1, explanation: "Lag dao động ngắn là bình thường." }
  ]
});
