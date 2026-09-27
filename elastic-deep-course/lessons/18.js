window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Vận hành",
  title: "Sizing: bao nhiêu shard, shard to bao nhiêu, heap và disk",
  subtitle: "10–50GB/shard · <200 triệu doc/shard · oversharding · heap ≤ 50% RAM & < ~31GB · disk watermark",

  theory: `
    <p>Số primary shard gần như không đổi được (bài 02), nên đây là quyết định phải làm đúng từ đầu — hoặc thiết kế để đổi được (alias + reindex, rollover).</p>

    <p><strong>Khuyến nghị của Elastic (điểm xuất phát, sau đó đo)</strong></p>
    <ul>
      <li>Mỗi shard khoảng <strong>10GB – 50GB</strong>; với log/time-series thường nhắm quanh 50GB (rollover theo <code>max_primary_shard_size</code>).</li>
      <li>Không quá <strong>200 triệu document</strong> mỗi shard.</li>
      <li>Mỗi shard có chi phí cố định (heap cho metadata, file handle, cluster state). <code>cluster.max_shards_per_node</code> mặc định <strong>1000</strong> shard không-frozen/node — chạm là không tạo index được.</li>
      <li>Hướng dẫn cũ "20 shard / GB heap" đã bỏ từ 8.3; nay chi phí heap tính chủ yếu theo <em>số field được map</em> trên mỗi node.</li>
    </ul>

    <p><strong>Oversharding — lỗi phổ biến nhất</strong>: tạo 1 index/ngày × 5 shard × 1 replica cho mỗi service × 1 năm = hàng chục nghìn shard tí hon (vài MB). Hậu quả: cluster state phình, master chậm, search phải đụng hàng trăm shard (mỗi shard một task), heap hao. Chữa: index theo tháng hoặc rollover theo kích thước, <code>_shrink</code> index cũ, gộp index nhỏ.</p>

    <p><strong>Undersharding</strong>: một shard 300GB → khôi phục/di chuyển shard rất lâu, không chia tải được sang node mới, merge nặng.</p>

    <p><strong>Tính nhanh</strong>: <code>số primary = ceil(dung lượng dự kiến sau 1–2 năm / kích thước shard mục tiêu)</code>. Dung lượng trên disk khác JSON gốc (nén _source, cộng inverted index, doc values) — cách chính xác là nạp một mẫu 1 triệu doc thật rồi xem <code>_cat/indices</code>. Catalog sản phẩm 2 triệu doc × ~5KB ≈ 10GB → <strong>1 primary</strong> + replica là đủ; nhiều shard hơn không làm nhanh hơn mà còn chậm.</p>

    <p><strong>Heap &amp; RAM</strong>: heap JVM ≤ 50% RAM (phần còn lại cho OS page cache — nơi Lucene đọc segment), và dưới ngưỡng compressed oops (~31GB). Từ 7.11 ES tự tính heap theo RAM và role nếu bạn không đặt <code>-Xms/-Xmx</code>. <code>bootstrap.memory_lock</code> hoặc tắt swap.</p>

    <p><strong>Disk watermark</strong>: <code>low</code> 85% (không cấp shard mới lên node), <code>high</code> 90% (chuyển shard đi), <code>flood_stage</code> 95% (index có shard trên node đó bị đặt <code>read_only_allow_delete</code> — ghi bị từ chối; tự gỡ khi disk xuống dưới high).</p>

    <div class="callout"><p>💡 Kafka thì thêm partition dễ; ES thì không. Cách "đổi số shard" an toàn cho catalog là reindex sang index mới + alias; cho log/event là rollover — index mới dùng template với số shard mới.</p></div>
  `,

  codeTabs: [
    { id: "cat", label: "① Đo thực tế", lines: [
      "GET /_cat/indices/products*?v&h=index,pri,rep,docs.count,pri.store.size,store.size&s=index",
      "index        pri rep docs.count pri.store.size store.size",
      "products_v4    1   1    2100450          9.8gb     19.6gb",
      "",
      "GET /_cat/shards?v&h=index,shard,prirep,store,node&s=store:desc",
      "",
      "GET /_cat/allocation?v",
      "shards disk.indices disk.used disk.avail disk.percent node",
      "   812      1.1tb     1.2tb    300gb           80 es-data-1"
    ]},
    { id: "calc", label: "② Tính số shard", lines: [
      "# catalog: 2.1M doc, 9.8GB primary, tăng ~30%/năm",
      "2 năm ≈ 9.8 × 1.3 × 1.3 ≈ 16.6GB  → ceil(16.6 / 30) = 1 primary",
      "",
      "# log order-service: 40GB/ngày, giữ 30 ngày",
      "rollover khi primary shard = 50GB, 1 primary → ~1 index mới/ngày",
      "tổng: 30 index × (1 p + 1 r) = 60 shard",
      "",
      "# ❌ phương án cũ: index theo ngày × 5 primary × 1 replica × 30 ngày × 20 service",
      "= 6000 shard, phần lớn vài trăm MB"
    ]},
    { id: "shrink", label: "③ Shrink / split", lines: [
      "# gộp 5 primary → 1 cho index log đã ngừng ghi",
      "PUT /logs-2024.04/_settings",
      "{ \"index.routing.allocation.require._name\": \"es-data-2\", \"index.blocks.write\": true }",
      "",
      "POST /logs-2024.04/_shrink/logs-2024.04-shrunk",
      "{ \"settings\": { \"index.number_of_shards\": 1, \"index.number_of_replicas\": 1,",
      "                \"index.routing.allocation.require._name\": null, \"index.blocks.write\": null } }",
      "",
      "# số shard đích phải là ước số của số shard nguồn (split: bội số)"
    ]},
    { id: "jvm", label: "④ Heap & watermark", lines: [
      "# config/jvm.options.d/heap.options (hoặc để ES tự tính)",
      "-Xms16g",
      "-Xmx16g            # node 64GB RAM: 16–31GB heap, phần còn lại cho page cache",
      "",
      "GET /_cluster/settings?include_defaults=true&filter_path=**.watermark",
      "# low: 85%   high: 90%   flood_stage: 95%",
      "",
      "# flood stage → index bị read_only_allow_delete:",
      "# cluster_block_exception: index [products] blocked by: [TOO_MANY_REQUESTS/12/disk usage exceeded flood-stage watermark...]"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="tiny"><div class="nl">🐜 6000 shard × 200MB</div><div class="ns">oversharding: master & heap khổ</div></div>
      <div class="node" id="huge"><div class="nl">🐘 1 shard × 400GB</div><div class="ns">recovery chậm, không chia tải</div></div>
    </div>
    <div class="arrow" id="a1">↓ nhắm 10–50GB, &lt;200M doc</div>
    <div class="node" id="ok"><div class="nl">✅ Shard vừa phải</div><div class="ns">rollover theo kích thước · alias + reindex</div></div>
    <div class="arrow" id="a2">↓ node</div>
    <div class="node" id="node"><div class="nl">🖥️ heap ≤ 50% RAM, &lt; ~31GB</div><div class="ns">disk &lt; 85% · watermark 85/90/95</div></div>
  `,
  steps: [
    { title: "1 · Đo trước khi đoán", tab: "cat", highlight: [1, 3, 8, 9], on: ["ok"],
      desc: "pri.store.size là dung lượng thực của primary sau nén + index." },
    { title: "2 · Catalog nhỏ: 1 primary", tab: "calc", highlight: [1, 2], on: ["ok", "a1"],
      desc: "Dưới vài chục GB thì 1 primary là đúng; thêm replica để tăng thông lượng đọc." },
    { title: "3 · Log: rollover theo kích thước", tab: "calc", highlight: [4, 5, 6, 8, 9], on: ["tiny", "ok"],
      desc: "So với index theo ngày cố định 5 shard, số shard giảm 100 lần." },
    { title: "4 · Sửa oversharding cũ", tab: "shrink", highlight: [3, 5, 6, 9], on: ["tiny"],
      desc: "Shrink yêu cầu index chặn ghi và mọi shard nằm trên một node." },
    { title: "5 · Heap và disk", tab: "jvm", highlight: [2, 3, 6, 9], on: ["node", "a2"],
      desc: "Page cache quan trọng không kém heap. Chạm flood stage là mất khả năng ghi." }
  ],

  quiz: [
    { q: "Kích thước shard Elastic khuyến nghị làm điểm xuất phát?", options: [
        "100MB – 1GB", "10GB – 50GB", "200GB – 500GB", "Càng lớn càng tốt"
      ], correct: 1, explanation: "Kèm không quá ~200 triệu document/shard." },
    { q: "Oversharding gây hậu quả gì?", options: [
        "Tiết kiệm disk",
        "Cluster state phình, master chậm, search phải chạm quá nhiều shard, tốn heap",
        "Tăng độ chính xác",
        "Không ảnh hưởng"
      ], correct: 1, explanation: "Mỗi shard có chi phí cố định." },
    { q: "Catalog 2 triệu sản phẩm, ~10GB. Số primary hợp lý?", options: [
        "1", "10", "20", "50"
      ], correct: 0, explanation: "Nhiều shard nhỏ không nhanh hơn; thêm replica nếu cần đọc nhiều." },
    { q: "Vì sao heap không nên vượt ~50% RAM?", options: [
        "JVM cấm",
        "Phần còn lại cần cho OS page cache, nơi Lucene đọc segment",
        "Để có swap",
        "Vì GC không chạy"
      ], correct: 1, explanation: "Và nên dưới ngưỡng compressed oops (~31GB)." },
    { q: "Disk chạm flood_stage (95%) thì sao?", options: [
        "Cụm tắt",
        "Index có shard trên node đó bị đặt read_only_allow_delete — ghi bị từ chối",
        "Tự xoá index cũ",
        "Tự thêm node"
      ], correct: 1, explanation: "Tự gỡ khi dung lượng xuống dưới high watermark (từ 7.4)." },
    { q: "cluster.max_shards_per_node mặc định?", options: [
        "100", "1000", "10000", "Không giới hạn"
      ], correct: 1, explanation: "Tính cho shard không thuộc frozen tier." },
    { q: "Shrink index 6 primary thành bao nhiêu primary được?", options: [
        "4", "3, 2 hoặc 1 (ước số của 6)", "5", "12"
      ], correct: 1, explanation: "Split thì ngược lại: bội số." },
    { q: "Log 40GB/ngày: chiến lược tốt?", options: [
        "Index/ngày × 10 shard",
        "Rollover theo max_primary_shard_size ~50GB qua data stream/ILM",
        "Một index duy nhất mãi mãi",
        "Index/giờ"
      ], correct: 1, explanation: "Số shard và kích thước ổn định bất kể lưu lượng thay đổi." },
    { q: "Cách chính xác nhất để ước lượng dung lượng index?", options: [
        "Nhân JSON gốc × 2",
        "Nạp mẫu dữ liệu thật với mapping thật rồi đo _cat/indices",
        "Hỏi Elastic",
        "Đếm số field"
      ], correct: 1, explanation: "Nén, analyzer, doc values khiến tỉ lệ thay đổi nhiều theo dữ liệu." }
  ]
});
