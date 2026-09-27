window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Consumer sâu",
  title: "Commit offset: tự động hay thủ công, và commit ở đâu trong vòng lặp",
  subtitle: "enable.auto.commit · offset store của librdkafka · commit trước = mất, commit sau = trùng",

  theory: `
    <p>Offset commit là câu trả lời cho: "nếu tôi chết ngay bây giờ, người thay tôi bắt đầu từ đâu?". Vị trí của lệnh commit so với lệnh xử lý quyết định ngữ nghĩa giao nhận:</p>
    <ul>
      <li><strong>Commit trước, xử lý sau</strong> → chết giữa chừng thì message đó <em>mất</em> (at-most-once).</li>
      <li><strong>Xử lý trước, commit sau</strong> → chết giữa chừng thì message đó <em>xử lý lại</em> (at-least-once). Đây là lựa chọn mặc định đúng cho hầu hết hệ thống.</li>
    </ul>

    <p><strong>Auto commit của Java</strong> (<code>enable.auto.commit=true</code>, mỗi <code>auto.commit.interval.ms</code>=5s): commit được thực hiện <em>bên trong lời gọi poll()</em>,
    commit offset của lô đã trả về ở lần poll trước. Nếu bạn xử lý đồng bộ xong lô rồi mới poll tiếp → gần như at-least-once. Nhưng nếu bạn đẩy message sang thread khác/hàng đợi để xử lý bất đồng bộ
    rồi poll tiếp ngay → offset được commit trong khi việc chưa xong → <strong>mất</strong> khi crash.</p>

    <p><strong>librdkafka / rdkafka khác Java — rất quan trọng</strong>. Có hai tầng:</p>
    <table>
      <tr><th>Cấu hình</th><th>Mặc định</th><th>Ý nghĩa</th></tr>
      <tr><td><code>enable.auto.offset.store</code></td><td>true</td><td>Ngay khi message được <em>trao cho ứng dụng</em>, offset của nó được ghi vào "offset store" (bộ nhớ)</td></tr>
      <tr><td><code>enable.auto.commit</code></td><td>true</td><td>Luồng nền định kỳ (5s) commit những gì đang có trong offset store</td></tr>
    </table>
    <p>Mặc định = "vừa nhận là coi như xong" → có thể commit message chưa xử lý xong → <strong>có thể mất</strong>. Mẫu chuẩn cho at-least-once trong Rust:
    <code>enable.auto.offset.store=false</code> + <code>enable.auto.commit=true</code>, và <strong>chỉ gọi <code>store_offset_from_message(&amp;m)</code> sau khi xử lý xong</strong>.
    Được cả hai: commit nền không chặn, và không bao giờ commit thứ chưa xử lý.</p>

    <p><strong>Commit thủ công</strong> (<code>enable.auto.commit=false</code>): <code>commitSync</code> (chặn tới khi broker xác nhận, tự retry) hoặc <code>commitAsync</code>
    (không chặn, không retry vì có thể ghi đè commit mới hơn). Mẫu phổ biến: async trong vòng lặp, sync khi tắt/revoke.
    Commit sau <em>mỗi</em> message là đắt (một request mỗi lần) — commit theo lô hoặc theo thời gian.</p>

    <p><strong>Xử lý song song và "lỗ hổng offset"</strong>: nếu xử lý offset 10, 11, 12 song song và 12 xong trước, bạn <em>không</em> được commit 13 khi 10 chưa xong —
    commit là "mọi thứ trước offset này đã xong". Phải theo dõi offset liên tục thấp nhất đã xong (watermark) cho từng partition.</p>

    <div class="callout"><p>💡 Spring Kafka mặc định <code>enable.auto.commit=false</code> và container tự commit theo <code>AckMode.BATCH</code> (sau khi listener xử lý xong lô).
    Bạn quen "nó tự lo" — sang rdkafka thì <em>bạn</em> phải lo, và mặc định của librdkafka nghiêng về phía có thể mất.</p></div>
  `,

  codeTabs: [
    { id: "rust", label: "① Mẫu chuẩn Rust", lines: [
      "let consumer: StreamConsumer = ClientConfig::new()",
      "    .set(\"bootstrap.servers\", &cfg.brokers)",
      "    .set(\"group.id\", \"billing\")",
      "    .set(\"enable.auto.commit\", \"true\")          // commit nền mỗi 5s…",
      "    .set(\"enable.auto.offset.store\", \"false\")   // …nhưng CHỈ những gì mình store",
      "    .create()?;",
      "consumer.subscribe(&[\"orders\"])?;",
      "",
      "loop {",
      "    let m = consumer.recv().await?;",
      "    process(&m).await?;                           // xử lý xong đã",
      "    consumer.store_offset_from_message(&m)?;      // rồi mới đánh dấu",
      "}"
    ]},
    { id: "danger", label: "② Mặc định nguy hiểm", lines: [
      "// enable.auto.offset.store=true (mặc định librdkafka)",
      "loop {",
      "    let m = consumer.recv().await?;     // offset m đã vào store NGAY LÚC NÀY",
      "    tokio::spawn(process_owned(m.detach()));   // xử lý nền",
      "}",
      "",
      "// luồng auto commit chạy -> commit offset m",
      "// process crash trước khi task xong -> message m MẤT"
    ]},
    { id: "manual", label: "③ Commit thủ công", lines: [
      "// enable.auto.commit=false",
      "let mut n = 0;",
      "loop {",
      "    let m = consumer.recv().await?;",
      "    process(&m).await?;",
      "    n += 1;",
      "    if n % 500 == 0 {",
      "        consumer.commit_message(&m, CommitMode::Async)?;   // theo lô",
      "    }",
      "}",
      "// khi tắt: consumer.commit_consumer_state(CommitMode::Sync)?;"
    ]},
    { id: "gap", label: "④ Song song & watermark", lines: [
      "partition 3: đang xử lý song song offset 10, 11, 12",
      "",
      "t1: 12 xong   -> KHÔNG commit 13 (10, 11 chưa xong)",
      "t2: 10 xong   -> có thể commit 11",
      "t3: 11 xong   -> có thể commit 13",
      "",
      "quy tắc: commit = (offset liên tục cao nhất đã xong) + 1"
    ]},
    { id: "java", label: "⑤ Java/Spring", lines: [
      "// KafkaConsumer thuần",
      "props.put(\"enable.auto.commit\", \"false\");",
      "while (running) {",
      "    var records = consumer.poll(Duration.ofMillis(500));",
      "    for (var r : records) process(r);",
      "    consumer.commitAsync();",
      "}",
      "consumer.commitSync();   // khi tắt",
      "",
      "// Spring: container.getContainerProperties().setAckMode(AckMode.BATCH); // mặc định"
    ]}
  ],

  stageHtml: `
    <div class="node" id="r"><div class="nl">📥 recv(): offset 41</div><div class="ns">message được trao cho app</div></div>
    <div class="row">
      <div class="node" id="bad"><div class="nl">❌ store/commit ngay</div><div class="ns">crash → 41 mất (at-most-once)</div></div>
      <div class="node" id="good"><div class="nl">✅ xử lý rồi store</div><div class="ns">crash → 41 xử lý lại (at-least-once)</div></div>
    </div>
    <div class="arrow" id="a1">↓ offset store (RAM)</div>
    <div class="node" id="ac"><div class="nl">⏲️ auto commit nền</div><div class="ns">mỗi 5s gửi offset store → __consumer_offsets</div></div>
  `,
  steps: [
    { title: "1 · Hai núm của librdkafka", tab: "rust", highlight: [4, 5], on: ["ac"],
      desc: "auto.commit lo việc gửi; auto.offset.store quyết định cái gì được coi là xong. Tắt cái thứ hai để tự kiểm soát." },
    { title: "2 · Xử lý rồi mới store", tab: "rust", highlight: [10, 11, 12], on: ["r", "good", "a1"],
      desc: "Chết trước dòng 12 → message được xử lý lại. Đó là at-least-once — an toàn nếu xử lý idempotent (bài 13)." },
    { title: "3 · Mặc định có thể mất", tab: "danger", highlight: [3, 4, 7, 8], on: ["bad", "ac"],
      desc: "Offset vào store ngay khi nhận. Kết hợp với xử lý nền là công thức mất dữ liệu." },
    { title: "4 · Commit thủ công theo lô", tab: "manual", highlight: [7, 8, 11], on: ["ac"],
      desc: "Async trong vòng lặp cho nhanh; Sync lúc tắt để chắc chắn." },
    { title: "5 · Song song cần watermark", tab: "gap", highlight: [3, 4, 5, 7], on: ["good"],
      desc: "Commit nghĩa là 'mọi thứ trước đây đã xong'. Không nhảy qua lỗ." },
    { title: "6 · So với Spring", tab: "java", highlight: [2, 5, 6, 8, 10], on: ["good"],
      desc: "Spring tự commit sau khi listener trả về. Mẫu Rust ở tab ① đạt cùng ngữ nghĩa." }
  ],

  quiz: [
    { q: "Commit offset TRƯỚC khi xử lý cho ngữ nghĩa gì?", options: ["At-least-once", "At-most-once", "Exactly-once", "Không xác định"], correct: 1,
      explanation: "Crash sau commit trước khi xử lý → message không bao giờ được xử lý." },
    { q: "Trong librdkafka, enable.auto.offset.store=true (mặc định) nghĩa là?", options: [
        "Offset chỉ lưu khi bạn gọi store",
        "Offset của message được ghi vào offset store ngay khi trao cho ứng dụng",
        "Tắt auto commit",
        "Lưu offset ra đĩa cục bộ"
      ], correct: 1, explanation: "Auto commit sau đó sẽ commit nó dù bạn chưa xử lý xong." },
    { q: "Cấu hình rdkafka nào cho at-least-once mà vẫn commit nền không chặn?", options: [
        "auto.commit=true, auto.offset.store=true",
        "auto.commit=true, auto.offset.store=false, gọi store_offset_from_message sau khi xử lý",
        "auto.commit=false, không commit gì",
        "isolation.level=read_committed"
      ], correct: 1, explanation: "Mẫu được khuyến nghị trong tài liệu librdkafka." },
    { q: "Vì sao commitAsync không tự retry?", options: [
        "Lỗi thiết kế",
        "Retry muộn có thể ghi đè một commit mới hơn, làm offset lùi",
        "Vì nhanh hơn",
        "Vì broker không hỗ trợ"
      ], correct: 1, explanation: "Commit cuối cùng lúc tắt nên dùng sync." },
    { q: "Xử lý song song offset 10, 11, 12; 12 xong trước. Commit bao nhiêu?", options: [
        "13", "Chưa commit gì mới cho tới khi 10 xong", "12", "10"
      ], correct: 1, explanation: "Commit là watermark liên tục." },
    { q: "Java auto commit xảy ra khi nào?", options: [
        "Ở luồng nền bất kỳ lúc nào",
        "Bên trong lời gọi poll(), khi đã quá auto.commit.interval.ms, commit offset lô đã trả về trước đó",
        "Sau mỗi message",
        "Khi consumer đóng mới commit"
      ], correct: 1, explanation: "Nên an toàn nếu xử lý đồng bộ xong trước khi poll tiếp." },
    { q: "Commit đồng bộ sau MỖI message có vấn đề gì?", options: [
        "Mất dữ liệu", "Một round-trip mỗi message → thông lượng rất thấp", "Gây rebalance", "Không có vấn đề"
      ], correct: 1, explanation: "Commit theo lô/thời gian." },
    { q: "Spring Kafka mặc định commit thế nào?", options: [
        "enable.auto.commit=true của client",
        "Client auto commit tắt; container commit sau khi listener xử lý xong lô (AckMode.BATCH)",
        "Không bao giờ commit",
        "Commit trước khi gọi listener"
      ], correct: 1, explanation: "Vì vậy dev Spring ít khi phải nghĩ về commit." },
    { q: "Giá trị commit '42' cho partition 3 có nghĩa gì?", options: [
        "Đã xử lý offset 42",
        "Đã xử lý xong tới 41; khởi động lại sẽ đọc từ 42",
        "Còn 42 message",
        "Lag là 42"
      ], correct: 1, explanation: "store_offset_from_message tự lưu offset+1." }
  ]
});
