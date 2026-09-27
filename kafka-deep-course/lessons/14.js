window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Consumer sâu",
  title: "Thứ tự message từ đầu tới cuối",
  subtitle: "Thứ tự chỉ tồn tại trong partition · những chỗ làm vỡ nó · xử lý song song mà vẫn giữ thứ tự theo key",

  theory: `
    <p>Kafka hứa đúng một điều: <strong>trong một partition, consumer đọc theo đúng thứ tự offset</strong>. Thứ tự nghiệp vụ (OrderCreated → OrderPaid → OrderShipped)
    chỉ còn nguyên nếu <em>mọi mắt xích</em> giữ nó. Danh sách chỗ làm vỡ:</p>

    <table>
      <tr><th>Mắt xích</th><th>Làm vỡ thứ tự khi</th><th>Cách giữ</th></tr>
      <tr><td>Nguồn</td><td>Hai instance order-service cùng phát sự kiện cho một đơn (race)</td><td>Sự kiện sinh từ một nguồn tuần tự (outbox theo thứ tự commit), có version</td></tr>
      <tr><td>Key/partitioner</td><td>Key khác nhau cho cùng thực thể; Java và Rust khác hàm băm; tăng partition</td><td>Key = ID thực thể; <code>murmur2_random</code>; đủ partition từ đầu</td></tr>
      <tr><td>Producer retry</td><td>in-flight &gt; 1 mà không idempotence</td><td><code>enable.idempotence=true</code></td></tr>
      <tr><td>Consumer</td><td>Xử lý song song không theo key; retry bằng cách đẩy sang retry topic</td><td>Song song <em>theo key</em>; retry chặn (blocking) nếu thứ tự là bắt buộc</td></tr>
      <tr><td>Đích</td><td>Ghi song song vào DB, sự kiện cũ ghi đè mới</td><td>Ghi có điều kiện theo version</td></tr>
    </table>

    <p><strong>Xử lý song song mà vẫn giữ thứ tự theo key</strong>. Một partition có thể chứa hàng nghìn đơn khác nhau; xử lý tuần tự cả partition thì chậm.
    Mẹo: trong consumer, chia message của partition vào N hàng đợi (worker) theo <code>hash(key) % N</code>. Cùng key luôn vào cùng worker → tuần tự; khác key chạy song song.
    Commit offset vẫn phải theo watermark (bài 12). Java có thư viện <em>Confluent Parallel Consumer</em> làm đúng việc này; trong Rust bạn tự dựng bằng các kênh <code>tokio::sync::mpsc</code>.</p>

    <p><strong>Retry và thứ tự mâu thuẫn nhau</strong>: đẩy message lỗi sang retry topic (bài 17) thì message sau của cùng key được xử lý trước → vỡ thứ tự.
    Với dữ liệu yêu cầu thứ tự chặt (số dư, trạng thái máy), hoặc retry tại chỗ (chặn partition), hoặc "park" cả key: khi một key đang lỗi, mọi message sau của key đó cũng đi vào hàng chờ.</p>

    <p><strong>Thứ tự toàn cục</strong> (mọi sự kiện của cả hệ thống): chỉ có với topic 1 partition → không scale. Gần như không bao giờ thật sự cần; hãy tìm "thứ tự theo thực thể nào".</p>

    <div class="callout"><p>💡 Thiết kế phòng thủ: kể cả khi mọi mắt xích đúng, consumer vẫn nên chịu được sự kiện tới sai thứ tự (dùng version/timestamp nghiệp vụ để bỏ qua sự kiện cũ).
    Thứ tự Kafka là sự trợ giúp, không phải hợp đồng nghiệp vụ.</p></div>
  `,

  codeTabs: [
    { id: "keyed", label: "① Song song theo key (Rust)", lines: [
      "const N: usize = 16;",
      "let mut senders = Vec::with_capacity(N);",
      "for _ in 0..N {",
      "    let (tx, mut rx) = tokio::sync::mpsc::channel::<OwnedMessage>(1024);",
      "    tokio::spawn(async move {",
      "        while let Some(m) = rx.recv().await { handle(&m).await; mark_done(&m); }",
      "    });",
      "    senders.push(tx);",
      "}",
      "loop {",
      "    let m = consumer.recv().await?.detach();",
      "    let lane = fxhash(m.key().unwrap_or_default()) as usize % N;",
      "    senders[lane].send(m).await?;      // cùng key -> cùng lane -> tuần tự",
      "}",
      "// mark_done cập nhật watermark từng partition; chỉ store offset liên tục"
    ]},
    { id: "break", label: "② Vỡ thứ tự do song song", lines: [
      "partition 2: [o-17 Created] [o-17 Paid] [o-17 Shipped]",
      "",
      "tokio::spawn cho TỪNG message (không theo key):",
      "  task A: Created  -> DB chậm 50ms",
      "  task B: Paid     -> xong trước",
      "  task C: Shipped  -> xong trước",
      "=> DB cuối cùng: status = Created   ❌"
    ]},
    { id: "retry", label: "③ Retry làm vỡ thứ tự", lines: [
      "o-17 Paid     -> lỗi tạm -> đẩy sang orders.retry.1m",
      "o-17 Shipped  -> xử lý ngay -> OK",
      "(1 phút sau) o-17 Paid từ retry topic -> áp dụng sau Shipped  ❌",
      "",
      "# lựa chọn: retry tại chỗ (chặn partition) cho luồng cần thứ tự,",
      "#           hoặc park cả key o-17 cho tới khi Paid xử lý xong"
    ]},
    { id: "guard", label: "④ Phòng thủ ở đích", lines: [
      "UPDATE orders_view",
      "SET status = $2, version = $3",
      "WHERE order_id = $1 AND version < $3;",
      "-- sự kiện tới muộn (version nhỏ hơn) không ghi đè trạng thái mới"
    ]}
  ],

  stageHtml: `
    <div class="node" id="p"><div class="nl">📜 partition 2</div><div class="ns">o-17 Created · o-42 Created · o-17 Paid · o-42 Paid</div></div>
    <div class="arrow" id="a1">↓ hash(key) % N</div>
    <div class="row">
      <div class="node" id="l1"><div class="nl">lane 3</div><div class="ns">o-17: Created → Paid (tuần tự)</div></div>
      <div class="node" id="l2"><div class="nl">lane 9</div><div class="ns">o-42: Created → Paid (tuần tự)</div></div>
    </div>
    <div class="arrow" id="a2">↓ song song giữa các lane</div>
    <div class="node" id="wm"><div class="nl">📏 Watermark offset</div><div class="ns">chỉ commit phần liên tục đã xong</div></div>
    <div class="node" id="bad"><div class="nl">❌ spawn từng message / retry topic</div><div class="ns">thứ tự theo key bị vỡ</div></div>
  `,
  steps: [
    { title: "1 · Vỡ do song song vô tổ chức", tab: "break", highlight: [3, 4, 5, 6, 7], on: ["bad"],
      desc: "Mỗi message một task: task xong trước ghi trước. Trạng thái cuối sai." },
    { title: "2 · Chia lane theo key", tab: "keyed", highlight: [4, 6, 12, 13], on: ["p", "a1", "l1", "l2"],
      desc: "Cùng key luôn cùng lane → tuần tự. Khác key → song song. Thông lượng tăng mà thứ tự theo key vẫn giữ." },
    { title: "3 · Commit theo watermark", tab: "keyed", highlight: [15], on: ["a2", "wm"],
      desc: "Lane 9 có thể xong trước lane 3; offset chỉ được đánh dấu tới chỗ liên tục." },
    { title: "4 · Retry topic vs thứ tự", tab: "retry", highlight: [1, 2, 3, 5, 6], on: ["bad"],
      desc: "Retry không chặn tốt cho thông lượng nhưng phá thứ tự. Chọn theo yêu cầu nghiệp vụ." },
    { title: "5 · Phòng thủ bằng version", tab: "guard", highlight: [3, 4], on: ["wm"],
      desc: "Lớp an toàn cuối cùng: sự kiện cũ không thể ghi đè sự kiện mới." }
  ],

  quiz: [
    { q: "Kafka đảm bảo thứ tự ở phạm vi nào?", options: ["Topic", "Partition", "Cluster", "Consumer group"], correct: 1,
      explanation: "Không có thứ tự giữa các partition." },
    { q: "Consumer spawn một task cho mỗi message. Hệ quả với sự kiện của cùng đơn hàng?", options: [
        "Vẫn đúng thứ tự", "Có thể hoàn tất sai thứ tự, trạng thái cuối sai", "Bị mất", "Bị trùng"
      ], correct: 1, explanation: "Task nào xong trước ghi trước." },
    { q: "Cách xử lý song song mà vẫn giữ thứ tự theo key?", options: [
        "Tăng max.poll.records",
        "Phân message vào N lane theo hash(key); mỗi lane tuần tự",
        "Dùng nhiều consumer group",
        "Tắt commit"
      ], correct: 1, explanation: "Ý tưởng của Confluent Parallel Consumer." },
    { q: "Vì sao retry topic có thể làm vỡ thứ tự?", options: [
        "Retry topic không có partition",
        "Message lỗi bị tách ra, message sau cùng key được xử lý trước",
        "Retry topic dùng key khác",
        "Không làm vỡ"
      ], correct: 1, explanation: "Đánh đổi giữa không chặn và thứ tự." },
    { q: "Muốn thứ tự toàn cục cho mọi sự kiện, phải dùng…", options: [
        "Topic 1 partition (không scale)", "acks=all", "Transactions", "read_committed"
      ], correct: 0, explanation: "Hiếm khi thực sự cần." },
    { q: "Producer không idempotence, max.in.flight=5, retries>0 — ảnh hưởng thứ tự?", options: [
        "Không ảnh hưởng", "Batch retry có thể ghi sau batch mới hơn", "Mất message", "Bị từ chối"
      ], correct: 1, explanation: "Idempotence giải quyết (bài 08)." },
    { q: "Phòng thủ ở đích chống sự kiện tới muộn bằng cách…", options: [
        "Xoá sự kiện cũ", "Ghi có điều kiện theo version/timestamp nghiệp vụ", "Tăng partition", "Tắt retry"
      ], correct: 1, explanation: "WHERE version < new_version." },
    { q: "Trong mô hình lane theo key, commit offset cần chú ý gì?", options: [
        "Commit offset lớn nhất đã thấy",
        "Chỉ commit tới offset liên tục đã xong trong mỗi partition",
        "Không cần commit",
        "Commit mỗi lane riêng"
      ], correct: 1, explanation: "Lane khác nhau xong không theo thứ tự offset." },
    { q: "Topic orders dùng key = customer_id nhưng nghiệp vụ cần thứ tự theo order_id. Có vấn đề không?", options: [
        "Có, thứ tự theo order bị mất",
        "Không — mọi order của một customer cùng partition nên thứ tự theo order vẫn giữ (dù phân bố kém mịn hơn)",
        "Phải dùng 1 partition",
        "Phải dùng transactions"
      ], correct: 1, explanation: "Key thô hơn vẫn giữ thứ tự cho key mịn hơn; cái giá là nguy cơ hot partition." }
  ]
});
