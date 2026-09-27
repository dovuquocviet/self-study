window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Consumer sâu",
  title: "Rebalancing: eager, cooperative sticky, static membership & giao thức mới",
  subtitle: "Stop-the-world vs từng bước · group.instance.id · KIP-848 (group.protocol=consumer)",

  theory: `
    <p>Rebalance xảy ra khi thành viên group thay đổi (deploy, scale, crash, bị đá vì max.poll.interval) hoặc số partition thay đổi.
    Trong Kubernetes, <em>mỗi lần rolling deploy</em> là một chuỗi rebalance — nên hiểu nó là bắt buộc.</p>

    <p><strong>1. Eager rebalance (kiểu cũ: Range, RoundRobin, Sticky)</strong></p>
    <ul>
      <li>Mọi consumer <strong>thu hồi toàn bộ</strong> partition đang giữ → cả group ngừng xử lý → chia lại → nhận partition mới.</li>
      <li>"Stop-the-world": group 50 consumer, một pod restart → cả 50 dừng. Rolling deploy 50 pod → 50+ lần dừng toàn bộ.</li>
    </ul>

    <p><strong>2. Cooperative (incremental) rebalance — <code>CooperativeStickyAssignor</code></strong></p>
    <ul>
      <li>Chỉ thu hồi những partition <em>thật sự phải chuyển</em>; phần còn lại tiếp tục xử lý.</li>
      <li>Diễn ra 2 vòng: vòng 1 xác định partition phải nhả; vòng 2 giao chúng cho chủ mới.</li>
      <li>"Sticky": cố giữ nguyên phân công cũ để ít di chuyển (giữ cache, state cục bộ).</li>
      <li>Java: mặc định <code>partition.assignment.strategy=[RangeAssignor, CooperativeStickyAssignor]</code> (Range được ưu tiên — phải chuyển hẳn sang cooperative để hưởng lợi).
        librdkafka: mặc định <code>range,roundrobin</code>; đặt <code>cooperative-sticky</code>. <strong>Không trộn</strong> eager và cooperative trong cùng group (phải chuyển qua 2 lần rolling).</li>
    </ul>

    <p><strong>3. Static membership — <code>group.instance.id</code></strong></p>
    <ul>
      <li>Mỗi instance có ID cố định (vd tên pod StatefulSet <code>billing-0</code>). Restart nhanh trong <code>session.timeout.ms</code> → quay lại nhận đúng partition cũ, <strong>không rebalance</strong>.</li>
      <li>Đánh đổi: instance chết thật thì partition của nó đứng tới hết session timeout mới được chia lại.</li>
    </ul>

    <p><strong>4. Giao thức rebalance thế hệ mới — KIP-848</strong> (GA trong Kafka 4.0; bật bằng <code>group.protocol=consumer</code>)</p>
    <ul>
      <li>Việc tính phân công chuyển từ client (một consumer "leader") về <strong>broker (group coordinator)</strong>.</li>
      <li>Không còn "barrier" đồng bộ toàn group; mỗi consumer được cập nhật phân công dần qua heartbeat.</li>
      <li>Assignor chọn ở server (<code>group.remote.assignor</code>: uniform/range). librdkafka hỗ trợ ở các bản 2.x gần đây — kiểm tra phiên bản trước khi bật.</li>
    </ul>

    <p><strong>Việc phải làm khi mất partition</strong>: commit offset của phần đã xử lý (callback <code>onPartitionsRevoked</code> ở Java;
    <code>ConsumerContext::pre_rebalance</code> trong rdkafka), xả buffer/batch đang gom cho partition đó. Không làm → partition sang chủ mới và bị xử lý lại từ offset commit cũ.</p>

    <div class="callout"><p>💡 Checklist giảm đau do rebalance: cooperative-sticky (hoặc group.protocol=consumer), static membership cho workload ổn định,
    xử lý nhanh để không vượt max.poll.interval, commit trong revoke callback, và graceful shutdown (gọi close để rời group ngay thay vì đợi session timeout).</p></div>
  `,

  codeTabs: [
    { id: "eager", label: "① Eager vs cooperative", lines: [
      "Trước: c1=[0,1] c2=[2,3] c3=[4,5]; thêm c4",
      "",
      "EAGER:",
      "  vòng 1: c1,c2,c3 thu hồi TẤT CẢ -> cả group dừng",
      "  vòng 2: c1=[0,1] c2=[2,3] c3=[4] c4=[5]",
      "",
      "COOPERATIVE STICKY:",
      "  vòng 1: chỉ c3 nhả partition 5; c1,c2 và c3(partition 4) vẫn chạy",
      "  vòng 2: c4 nhận [5]"
    ]},
    { id: "rust", label: "② rdkafka + callback", lines: [
      "struct Ctx;",
      "impl ClientContext for Ctx {}",
      "impl ConsumerContext for Ctx {",
      "    fn pre_rebalance(&self, _c: &BaseConsumer<Self>, r: &Rebalance) {",
      "        if let Rebalance::Revoke(tpl) = r {",
      "            tracing::info!(?tpl, \"sắp mất partition: xả batch, commit\");",
      "        }",
      "    }",
      "}",
      "let consumer: StreamConsumer<Ctx> = ClientConfig::new()",
      "    .set(\"group.id\", \"billing\")",
      "    .set(\"partition.assignment.strategy\", \"cooperative-sticky\")",
      "    .set(\"group.instance.id\", &pod_name)          // static membership",
      "    .create_with_context(Ctx)?;"
    ]},
    { id: "java", label: "③ Java", lines: [
      "props.put(\"partition.assignment.strategy\",",
      "          CooperativeStickyAssignor.class.getName());",
      "props.put(\"group.instance.id\", System.getenv(\"POD_NAME\"));",
      "",
      "// Kafka 4.0+: giao thức mới, phân công ở broker",
      "props.put(\"group.protocol\", \"consumer\");",
      "// (khi dùng group.protocol=consumer, không đặt partition.assignment.strategy)",
      "",
      "consumer.subscribe(List.of(\"orders\"), new ConsumerRebalanceListener() {",
      "  public void onPartitionsRevoked(Collection<TopicPartition> ps) { consumer.commitSync(); }",
      "  public void onPartitionsAssigned(Collection<TopicPartition> ps) { }",
      "});"
    ]},
    { id: "k8s", label: "④ Rolling deploy", lines: [
      "# 6 pod, eager, không static membership:",
      "#   mỗi pod tắt -> rebalance, pod mới lên -> rebalance  => ~12 lần dừng cả group",
      "",
      "# cooperative + static membership (StatefulSet billing-0..5):",
      "#   pod billing-3 restart trong < session.timeout -> nhận lại partition cũ",
      "#   => gần như không rebalance",
      "",
      "# graceful: bắt SIGTERM -> dừng nhận việc -> commit -> consumer close (rời group)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="ev"><div class="nl">🔔 Sự kiện: thêm c4 / pod restart</div><div class="ns">coordinator bắt đầu rebalance</div></div>
    <div class="row">
      <div class="node" id="eg"><div class="nl">🛑 Eager</div><div class="ns">mọi người nhả hết, cả group dừng</div></div>
      <div class="node" id="co"><div class="nl">🔄 Cooperative sticky</div><div class="ns">chỉ nhả phần phải chuyển</div></div>
    </div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="st"><div class="nl">📌 Static membership</div><div class="ns">restart nhanh = không rebalance</div></div>
      <div class="node" id="kip"><div class="nl">🆕 KIP-848</div><div class="ns">broker tính phân công</div></div>
    </div>
    <div class="node" id="rv"><div class="nl">🧹 onRevoke</div><div class="ns">commit & xả batch trước khi mất partition</div></div>
  `,
  steps: [
    { title: "1 · Eager: dừng cả group", tab: "eager", highlight: [3, 4, 5], on: ["ev", "eg"],
      desc: "Mọi consumer nhả mọi partition — kể cả partition không cần chuyển." },
    { title: "2 · Cooperative: chỉ phần cần chuyển", tab: "eager", highlight: [7, 8, 9], on: ["co"],
      desc: "Hai vòng nhưng chỉ partition 5 tạm ngừng. Phần còn lại tiếp tục chạy." },
    { title: "3 · Cấu hình trong Rust", tab: "rust", highlight: [4, 5, 6, 12, 13], on: ["co", "st", "rv"],
      desc: "cooperative-sticky + group.instance.id + callback pre_rebalance để commit/xả batch." },
    { title: "4 · Java & giao thức mới", tab: "java", highlight: [1, 2, 3, 6, 10], on: ["kip", "rv"],
      desc: "group.protocol=consumer đẩy việc phân công về broker, bỏ barrier toàn group." },
    { title: "5 · Rolling deploy trên Kubernetes", tab: "k8s", highlight: [2, 5, 6, 8], on: ["st"],
      desc: "Kết hợp static membership và graceful shutdown để deploy không làm cả group giật." }
  ],

  quiz: [
    { q: "Eager rebalance khác cooperative ở điểm cốt lõi nào?", options: [
        "Eager nhanh hơn",
        "Eager thu hồi mọi partition của mọi consumer; cooperative chỉ thu hồi partition cần chuyển",
        "Cooperative cần ZooKeeper",
        "Không khác"
      ], correct: 1, explanation: "Đó là lý do eager gây stop-the-world." },
    { q: "group.instance.id (static membership) giúp gì?", options: [
        "Mã hoá",
        "Instance restart nhanh trong session.timeout nhận lại partition cũ mà không gây rebalance",
        "Tăng số partition",
        "Tắt heartbeat"
      ], correct: 1, explanation: "Đánh đổi: instance chết thật thì phải đợi hết session timeout." },
    { q: "Giá trị partition.assignment.strategy mặc định của librdkafka là?", options: [
        "cooperative-sticky", "range,roundrobin", "sticky", "uniform"
      ], correct: 1, explanation: "Phải tự đặt cooperative-sticky." },
    { q: "Có nên trộn consumer eager và cooperative trong cùng group không?", options: [
        "Có, không vấn đề",
        "Không; chuyển đổi cần hai lần rolling (thêm cooperative vào danh sách rồi bỏ eager)",
        "Bắt buộc phải trộn",
        "Chỉ khi dùng KRaft"
      ], correct: 1, explanation: "Các assignor phải thống nhất giao thức rebalance." },
    { q: "KIP-848 (group.protocol=consumer) thay đổi gì?", options: [
        "Bỏ consumer group",
        "Việc tính phân công chuyển về broker, rebalance tăng dần qua heartbeat, không barrier toàn group",
        "Consumer đọc từ controller",
        "Bắt buộc exactly-once"
      ], correct: 1, explanation: "GA trong Kafka 4.0." },
    { q: "Trong callback revoke (onPartitionsRevoked / pre_rebalance Revoke), nên làm gì?", options: [
        "Không làm gì",
        "Commit offset phần đã xử lý và xả batch/buffer của partition sắp mất",
        "Xoá topic",
        "Tăng session timeout"
      ], correct: 1, explanation: "Để chủ mới không xử lý lại quá nhiều." },
    { q: "Nguyên nhân nào KHÔNG gây rebalance?", options: [
        "Pod mới tham gia group",
        "Consumer vượt max.poll.interval.ms",
        "Producer gửi thêm message",
        "Topic tăng số partition"
      ], correct: 2, explanation: "Ghi dữ liệu không đổi thành viên hay số partition." },
    { q: "Vì sao graceful shutdown (close consumer) quan trọng khi deploy?", options: [
        "Để xoá offset",
        "Consumer gửi LeaveGroup ngay, rebalance bắt đầu lập tức thay vì chờ hết session.timeout",
        "Để flush producer",
        "Không quan trọng"
      ], correct: 1, explanation: "Với static membership thì close không rời group ngay — đó là chủ đích để quay lại." },
    { q: "Java consumer mặc định [RangeAssignor, CooperativeStickyAssignor] có đang dùng cooperative không?", options: [
        "Có",
        "Không — Range được ưu tiên; danh sách này để hỗ trợ nâng cấp dần sang cooperative",
        "Chỉ khi có > 10 consumer",
        "Tuỳ broker"
      ], correct: 1, explanation: "Phải bỏ Range ở lần rolling thứ hai để thật sự dùng cooperative." }
  ]
});
