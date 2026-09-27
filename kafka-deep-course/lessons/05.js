window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Độ bền & nhân bản",
  title: "acks, min.insync.replicas & unclean leader election",
  subtitle: "Bộ ba cấu hình quyết định 'có mất message không' — và cái giá về độ sẵn sàng",

  theory: `
    <p>Producer gửi xong thì <em>khi nào</em> broker trả lời "OK"? Đó là <code>acks</code>:</p>
    <table>
      <tr><th>acks</th><th>Broker trả lời khi</th><th>Rủi ro</th></tr>
      <tr><td><code>0</code></td><td>Không chờ gì (producer không đợi phản hồi)</td><td>Mất mà không hề biết</td></tr>
      <tr><td><code>1</code></td><td>Leader đã ghi vào log của nó</td><td>Leader chết trước khi follower chép → mất message đã được báo OK</td></tr>
      <tr><td><code>all</code> (= <code>-1</code>)</td><td>Mọi replica <strong>trong ISR hiện tại</strong> đã có</td><td>Chỉ an toàn nếu ISR đủ lớn</td></tr>
    </table>
    <p>Từ Kafka 3.0, producer Java mặc định <code>acks=all</code> và <code>enable.idempotence=true</code>. librdkafka (rdkafka Rust) cũng mặc định <code>acks=all</code>,
    nhưng <strong>idempotence mặc định tắt</strong> — xem bài 08.</p>

    <p><strong>Cái bẫy của acks=all</strong>: "mọi replica trong ISR" — nếu hai follower đã rơi khỏi ISR thì ISR = {leader}, và acks=all chỉ còn nghĩa như acks=1.
    <code>min.insync.replicas</code> (cấu hình topic/broker, mặc định 1) chặn chuyện này: nếu ISR nhỏ hơn giá trị này, leader <strong>từ chối</strong> ghi với lỗi
    <code>NOT_ENOUGH_REPLICAS</code> (producer sẽ retry, hết <code>delivery.timeout.ms</code> thì báo lỗi cho ứng dụng).</p>

    <p><strong>Công thức kinh điển</strong>: <code>replication.factor=3</code>, <code>min.insync.replicas=2</code>, <code>acks=all</code>.</p>
    <ul>
      <li>Mất 1 broker: ISR còn 2 ≥ 2 → vẫn ghi được, mỗi message được báo OK luôn có ít nhất 2 bản.</li>
      <li>Mất 2 broker: ISR còn 1 &lt; 2 → <strong>ngừng nhận ghi</strong> (chọn nhất quán thay vì sẵn sàng). Consumer vẫn đọc được.</li>
      <li>Đặt min.insync = 3 với RF = 3 là sai lầm: chỉ cần một broker restart để rolling upgrade là topic không ghi được.</li>
    </ul>
    <p>Lưu ý: <code>min.insync.replicas</code> chỉ có tác dụng với producer dùng <code>acks=all</code>; acks=1 bỏ qua nó.</p>

    <p><strong>Unclean leader election</strong>: tất cả replica trong ISR đều chết, chỉ còn một replica <em>ngoài ISR</em> (đang tụt hậu) sống. Hai lựa chọn:</p>
    <ul>
      <li><code>unclean.leader.election.enable=false</code> (mặc định): partition <strong>offline</strong> tới khi một replica ISR sống lại. Không mất dữ liệu đã committed, nhưng đứng.</li>
      <li><code>true</code>: bầu replica tụt hậu làm leader → partition sống lại ngay, nhưng <strong>mất</strong> các message nó chưa có; khi leader cũ quay lại sẽ bị truncate theo leader mới.</li>
    </ul>
    <p>Bật cho topic log/metric chấp nhận mất; tắt cho topic nghiệp vụ (đơn hàng, thanh toán). Metric cần canh: <code>OfflinePartitionsCount</code>.</p>

    <div class="callout"><p>💡 "Không mất message" là chuỗi mắt xích: <code>acks=all</code> + <code>min.insync.replicas=2</code> + RF=3 + unclean=false + producer <em>xử lý lỗi gửi</em>
    (không nuốt kết quả của <code>send()</code>) + consumer commit <em>sau</em> khi xử lý (bài 12). Thiếu một mắt là hở.</p></div>
  `,

  codeTabs: [
    { id: "topic", label: "① Cấu hình topic", lines: [
      "kafka-topics.sh --bootstrap-server b:9092 --create --topic payments \\",
      "  --partitions 12 --replication-factor 3 \\",
      "  --config min.insync.replicas=2 \\",
      "  --config unclean.leader.election.enable=false",
      "",
      "# topic log ứng dụng: ưu tiên sẵn sàng",
      "kafka-configs.sh --bootstrap-server b:9092 --alter --entity-type topics \\",
      "  --entity-name app-logs --add-config unclean.leader.election.enable=true"
    ]},
    { id: "rust", label: "② Producer Rust", lines: [
      "let producer: FutureProducer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", \"b1:9092,b2:9092,b3:9092\")",
      "    .set(\"acks\", \"all\")                    // chờ đủ ISR",
      "    .set(\"enable.idempotence\", \"true\")     // librdkafka mặc định false!",
      "    .set(\"delivery.timeout.ms\", \"120000\")  // tổng thời gian cho 1 message kể cả retry",
      "    .create()?;",
      "",
      "match producer.send(record, Duration::from_secs(5)).await {",
      "    Ok(d) => tracing::info!(p = d.partition, o = d.offset, \"đã ghi\"),",
      "    Err((e, msg)) => return Err(anyhow!(\"gửi thất bại {e}, key={:?}\", msg.key())),",
      "}"
    ]},
    { id: "java", label: "③ Spring tương đương", lines: [
      "spring:",
      "  kafka:",
      "    producer:",
      "      acks: all",
      "      properties:",
      "        enable.idempotence: true",
      "        delivery.timeout.ms: 120000",
      "",
      "// lỗi hay gặp: kafkaTemplate.send(...) rồi KHÔNG xem CompletableFuture trả về",
      "// => lỗi NOT_ENOUGH_REPLICAS sau khi hết retry bị nuốt im lặng"
    ]},
    { id: "table", label: "④ Kịch bản RF=3, min.isr=2", lines: [
      "broker sống | ISR | acks=all ghi? | đọc? | ghi chú",
      "------------+-----+---------------+------+----------------------------",
      "     3      |  3  |      có       |  có  | bình thường",
      "     2      |  2  |      có       |  có  | vẫn đủ 2 bản cho mỗi message",
      "     1      |  1  |  KHÔNG (NOT_ENOUGH_REPLICAS) | có | chọn nhất quán",
      "     0*     |  -  |      -        |  -   | *chỉ còn replica ngoài ISR:",
      "            |     |               |      |  unclean=false -> offline",
      "            |     |               |      |  unclean=true  -> sống, MẤT dữ liệu"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">✍️ Producer acks=all</div><div class="ns">gửi payment #991</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="l"><div class="nl">👑 Leader</div><div class="ns">kiểm tra |ISR| ≥ min.insync.replicas</div></div>
    <div class="row">
      <div class="node" id="f1"><div class="nl">📦 Follower A</div><div class="ns">trong ISR</div></div>
      <div class="node" id="f2"><div class="nl">📦 Follower B</div><div class="ns">có thể rơi khỏi ISR</div></div>
    </div>
    <div class="arrow" id="a2">↑ OK chỉ khi mọi ISR đã có</div>
    <div class="node" id="ue"><div class="nl">⚠️ Unclean election</div><div class="ns">sống ngay nhưng mất message / hoặc offline</div></div>
  `,
  steps: [
    { title: "1 · Topic cấu hình an toàn", tab: "topic", highlight: [2, 3, 4], on: ["l"],
      desc: "RF=3, min.isr=2, không unclean. Đây là mặc định bạn nên dùng cho topic nghiệp vụ." },
    { title: "2 · Producer chờ đủ ISR", tab: "rust", highlight: [3, 4, 5], on: ["p", "a1", "l", "f1", "f2"],
      desc: "acks=all: leader chỉ trả OK khi mọi replica trong ISR đã có message." },
    { title: "3 · Kiểm tra kết quả gửi", tab: "rust", highlight: [8, 9, 10], on: ["a2", "p"],
      desc: "Lỗi cuối cùng (hết delivery.timeout.ms) phải được xử lý: trả lỗi cho request, ghi outbox, cảnh báo… Nuốt lỗi = mất message trong im lặng." },
    { title: "4 · ISR co còn 1", tab: "table", highlight: [4, 5], on: ["f2", "l"],
      desc: "Mất một broker vẫn chạy bình thường; mất hai thì từ chối ghi thay vì ghi vào chỉ một bản." },
    { title: "5 · Khi toàn ISR chết", tab: "table", highlight: [6, 7, 8], on: ["ue"],
      desc: "Đánh đổi kinh điển giữa nhất quán và sẵn sàng. Chọn theo từng topic." },
    { title: "6 · Bẫy trong Spring", tab: "java", highlight: [9, 10], on: ["p"],
      desc: "Cấu hình đúng mà code không xem kết quả send thì vẫn mất. Ở Rust, kiểu Result buộc bạn phải xử lý." }
  ],

  quiz: [
    { q: "acks=1 nghĩa là gì?", options: [
        "Không chờ phản hồi", "Leader ghi xong vào log của nó là trả OK", "Mọi replica đã ghi", "1 consumer đã đọc"
      ], correct: 1, explanation: "Leader chết trước khi follower chép thì mất message đã báo OK." },
    { q: "acks=all đảm bảo điều gì chính xác?", options: [
        "Mọi replica được cấu hình (RF) đã có message",
        "Mọi replica trong ISR hiện tại đã có message",
        "Message đã fsync",
        "Consumer đã đọc"
      ], correct: 1, explanation: "Vì thế cần min.insync.replicas để ISR không co về 1." },
    { q: "RF=3, min.insync.replicas=2, acks=all. Hai broker chết. Producer gặp gì?", options: [
        "Ghi bình thường", "Lỗi NOT_ENOUGH_REPLICAS (sau khi hết retry)", "Message bị mất im lặng", "Tự tạo replica mới"
      ], correct: 1, explanation: "ISR=1 < 2 nên leader từ chối ghi." },
    { q: "Vì sao đặt min.insync.replicas=3 với RF=3 là tệ?", options: [
        "Không hợp lệ",
        "Chỉ một broker restart (vd rolling upgrade) là topic không ghi được",
        "Tốn đĩa",
        "Làm chậm consumer"
      ], correct: 1, explanation: "Không còn biên cho bảo trì." },
    { q: "min.insync.replicas có tác dụng với producer acks=1 không?", options: ["Có", "Không", "Chỉ khi bật idempotence", "Chỉ trong KRaft"], correct: 1,
      explanation: "Chỉ được kiểm tra khi acks=all." },
    { q: "unclean.leader.election.enable=true đánh đổi điều gì?", options: [
        "Hiệu năng lấy độ trễ",
        "Sẵn sàng ngay nhưng có thể mất message đã committed",
        "Bảo mật lấy tốc độ",
        "Không đánh đổi gì"
      ], correct: 1, explanation: "Replica ngoài ISR có thể thiếu đuôi log." },
    { q: "Mặc định librdkafka (rdkafka Rust) khác producer Java 3.x ở điểm nào?", options: [
        "acks mặc định 0",
        "enable.idempotence mặc định false",
        "Không hỗ trợ acks=all",
        "Không có retry"
      ], correct: 1, explanation: "Java 3.0+ bật idempotence mặc định; librdkafka phải tự bật." },
    { q: "Metric nào báo partition không có leader (không đọc/ghi được)?", options: [
        "UnderReplicatedPartitions", "OfflinePartitionsCount", "records-lag-max", "BytesInPerSec"
      ], correct: 1, explanation: "Offline thường xảy ra khi toàn ISR chết và unclean=false." },
    { q: "Cấu hình đúng hết nhưng code gọi send() rồi bỏ qua kết quả. Hậu quả?", options: [
        "Không sao",
        "Lỗi gửi cuối cùng bị nuốt → mất message im lặng",
        "Kafka tự lưu vào DLQ",
        "Broker tự gửi lại mãi mãi"
      ], correct: 1, explanation: "Độ bền là trách nhiệm chung của cấu hình và code." }
  ]
});
