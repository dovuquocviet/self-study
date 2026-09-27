window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Aggregation & phân trang",
  title: "Aggregations: terms, date_histogram, cardinality, pipeline — và cái giá phải trả",
  subtitle: "bucket · metric · pipeline · terms gần đúng thế nào · HyperLogLog · max_buckets · composite · post_filter",

  theory: `
    <p>Aggregation chạy trên <strong>tập document khớp query</strong>, đọc <strong>doc values</strong>. Ba nhóm:</p>
    <ul>
      <li><strong>Bucket</strong> (chia nhóm, như <code>GROUP BY</code>): <code>terms</code>, <code>date_histogram</code>, <code>histogram</code>, <code>range</code>, <code>filters</code>, <code>composite</code>, <code>nested</code>.</li>
      <li><strong>Metric</strong> (tính trên nhóm): <code>sum</code>, <code>avg</code>, <code>min</code>/<code>max</code>, <code>stats</code>, <code>cardinality</code>, <code>percentiles</code>, <code>top_hits</code>.</li>
      <li><strong>Pipeline</strong> (tính trên <em>kết quả</em> của agg khác): <code>derivative</code>, <code>cumulative_sum</code>, <code>bucket_selector</code> (≈ <code>HAVING</code>), <code>bucket_sort</code>, <code>avg_bucket</code>/<code>max_bucket</code>.</li>
    </ul>

    <p><strong>terms là gần đúng khi nhiều shard</strong>: mỗi shard trả về top <code>shard_size</code> (mặc định <code>size × 1.5 + 10</code>) bucket của nó, coordinating gộp lại. Một brand đứng thứ 11 ở mọi shard có thể thực ra đứng top 10 toàn cục mà bị bỏ sót. Response có <code>doc_count_error_upper_bound</code> và <code>sum_other_doc_count</code> để bạn biết. Tăng <code>shard_size</code> = chính xác hơn, tốn hơn. Index 1 shard thì chính xác.</p>

    <p><strong>cardinality</strong> (đếm distinct) dùng <strong>HyperLogLog++</strong>: bộ nhớ cố định, sai số nhỏ. <code>precision_threshold</code> (mặc định 3000, tối đa 40000): dưới ngưỡng gần như chính xác, trên ngưỡng xấp xỉ. Không bao giờ dùng terms với size khổng lồ để đếm distinct.</p>

    <p><strong>date_histogram</strong>: <code>calendar_interval</code> (<code>1d</code>, <code>1M</code> — theo lịch, tháng dài ngắn khác nhau) vs <code>fixed_interval</code> (<code>30m</code>, <code>7d</code> — số ms cố định). Luôn đặt <code>time_zone: "+07:00"</code> (hoặc <code>Asia/Ho_Chi_Minh</code>) nếu không muốn ngày bị cắt theo UTC. <code>min_doc_count: 0</code> + <code>extended_bounds</code> để có cả ngày trống.</p>

    <p><strong>Chi phí &amp; giới hạn</strong></p>
    <ul>
      <li>Bucket nằm trong heap của data node rồi coordinating node. Terms lồng terms lồng date_histogram = nhân số bucket. <code>search.max_buckets</code> (mặc định 65536) chặn request tạo quá nhiều bucket.</li>
      <li>terms trên keyword cần <strong>global ordinals</strong> (bảng ánh xạ term → số) dựng lại sau refresh; field nhiều giá trị khác nhau thì agg đầu tiên sau refresh chậm. <code>eager_global_ordinals: true</code> chuyển chi phí sang lúc refresh.</li>
      <li>Duyệt <em>toàn bộ</em> bucket (xuất báo cáo): dùng <code>composite</code> với <code>after_key</code>, không dùng terms size 100000.</li>
      <li>Kết quả agg với <code>size: 0</code> được shard request cache giữ lại → dashboard lặp lại rất rẻ.</li>
    </ul>

    <p><strong>Facet đúng cách</strong>: người dùng chọn brand=samsung nhưng vẫn muốn thấy số lượng các brand khác → đặt điều kiện brand vào <code>post_filter</code> (lọc hits <em>sau</em> khi tính agg) thay vì query.</p>

    <div class="callout"><p>💡 Agg phân tích nặng (hàng tỷ event, GROUP BY nhiều chiều, chính xác tuyệt đối) là việc của ClickHouse trong hệ thống của ta. ES mạnh ở agg <em>đi kèm tìm kiếm</em>: facet, đếm theo bộ lọc, biểu đồ nhỏ.</p></div>
  `,

  codeTabs: [
    { id: "facet", label: "① Facet sản phẩm", lines: [
      "POST /products/_search",
      "{ \"size\": 20,",
      "  \"query\": { \"match\": { \"name\": \"tai nghe\" } },",
      "  \"aggs\": {",
      "    \"brands\": { \"terms\": { \"field\": \"brand\", \"size\": 10 } },",
      "    \"price_ranges\": { \"range\": { \"field\": \"price\", \"ranges\": [",
      "        { \"to\": 500000 }, { \"from\": 500000, \"to\": 2000000 }, { \"from\": 2000000 } ] } },",
      "    \"avg_price\": { \"avg\": { \"field\": \"price\" } }",
      "  },",
      "  \"post_filter\": { \"term\": { \"brand\": \"sony\" } }   // hits lọc theo sony, agg vẫn đủ brand",
      "}"
    ]},
    { id: "resp", label: "② terms gần đúng", lines: [
      "\"brands\": {",
      "  \"doc_count_error_upper_bound\": 0,",
      "  \"sum_other_doc_count\": 1834,          // doc thuộc brand ngoài top 10",
      "  \"buckets\": [",
      "    { \"key\": \"sony\",    \"doc_count\": 412 },",
      "    { \"key\": \"samsung\", \"doc_count\": 377 }, ...",
      "  ] }",
      "",
      "# mỗi shard trả top shard_size = 10 × 1.5 + 10 = 25 bucket rồi gộp",
      "\"terms\": { \"field\": \"brand\", \"size\": 10, \"shard_size\": 100 }   // chính xác hơn"
    ]},
    { id: "time", label: "③ date_histogram + pipeline", lines: [
      "POST /orders/_search",
      "{ \"size\": 0,",
      "  \"query\": { \"range\": { \"created_at\": { \"gte\": \"now-30d/d\" } } },",
      "  \"aggs\": { \"per_day\": {",
      "    \"date_histogram\": { \"field\": \"created_at\", \"calendar_interval\": \"1d\",",
      "                        \"time_zone\": \"+07:00\", \"min_doc_count\": 0 },",
      "    \"aggs\": {",
      "      \"revenue\":  { \"sum\": { \"field\": \"total\" } },",
      "      \"buyers\":   { \"cardinality\": { \"field\": \"customer_id\", \"precision_threshold\": 3000 } },",
      "      \"cum\":      { \"cumulative_sum\": { \"buckets_path\": \"revenue\" } },",
      "      \"big_days\": { \"bucket_selector\": {",
      "          \"buckets_path\": { \"r\": \"revenue\" }, \"script\": \"params.r > 100000000\" } }",
      "} } } }"
    ]},
    { id: "comp", label: "④ composite duyệt hết", lines: [
      "POST /orders/_search",
      "{ \"size\": 0, \"aggs\": { \"all\": { \"composite\": {",
      "    \"size\": 1000,",
      "    \"sources\": [ { \"shop\": { \"terms\": { \"field\": \"shop_id\" } } },",
      "                 { \"day\":  { \"date_histogram\": { \"field\": \"created_at\", \"calendar_interval\": \"1d\" } } } ]",
      "} } } }",
      "",
      "# response: \"after_key\": { \"shop\": \"s-0999\", \"day\": 1714521600000 }",
      "# trang sau: thêm \"after\": { ...after_key... } vào composite"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">🔍 Query lọc tập document</div><div class="ns">agg chỉ chạy trên tập khớp</div></div>
    <div class="arrow" id="a1">↓ mỗi shard đọc doc values</div>
    <div class="row">
      <div class="node" id="s1"><div class="nl">Shard 0</div><div class="ns">top 25 brand cục bộ</div></div>
      <div class="node" id="s2"><div class="nl">Shard 1</div><div class="ns">top 25 brand cục bộ</div></div>
    </div>
    <div class="arrow" id="a2">↓ gộp, cắt còn top 10</div>
    <div class="node" id="co"><div class="nl">🧭 Coordinating</div><div class="ns">+ error_upper_bound · max_buckets</div></div>
    <div class="arrow" id="a3">↓ pipeline chạy trên kết quả</div>
    <div class="node" id="pl"><div class="nl">🧮 cumulative_sum · bucket_selector</div><div class="ns">sau khi mọi bucket đã có</div></div>
  `,
  steps: [
    { title: "1 · Facet đi kèm tìm kiếm", tab: "facet", highlight: [3, 5, 6, 8], on: ["q", "a1"],
      desc: "Cùng một request trả hits và các con số cho bộ lọc bên trái màn hình." },
    { title: "2 · post_filter giữ facet đầy đủ", tab: "facet", highlight: [10], on: ["q"],
      desc: "Chọn sony nhưng vẫn thấy samsung có 377 sản phẩm để người dùng đổi lựa chọn." },
    { title: "3 · terms gộp từ các shard", tab: "resp", highlight: [2, 3, 9, 10], on: ["s1", "s2", "a2", "co"],
      desc: "Mỗi shard chỉ gửi top shard_size; có thể lệch. Response cho bạn biết mức lệch tối đa." },
    { title: "4 · Theo ngày, đúng múi giờ", tab: "time", highlight: [5, 6, 8, 9], on: ["co"],
      desc: "calendar_interval 1d + time_zone +07:00. cardinality đếm khách distinct bằng HyperLogLog++." },
    { title: "5 · Pipeline như HAVING", tab: "time", highlight: [10, 11, 12], on: ["a3", "pl"],
      desc: "Chạy trên các bucket đã tính xong: luỹ kế doanh thu, chỉ giữ ngày > 100 triệu." },
    { title: "6 · Duyệt mọi bucket", tab: "comp", highlight: [3, 4, 5, 8, 9], on: ["co"],
      desc: "composite phân trang bucket bằng after_key, không vượt max_buckets." }
  ],

  quiz: [
    { q: "Aggregation đọc dữ liệu từ đâu?", options: [
        "_source", "Doc values", "Translog", "Inverted index của text"
      ], correct: 1, explanation: "Lưu theo cột, tối ưu cho agg/sort." },
    { q: "Vì sao terms agg trên nhiều shard có thể không chính xác?", options: [
        "Bug",
        "Mỗi shard chỉ gửi top shard_size bucket cục bộ; bucket bị cắt ở shard có thể thuộc top toàn cục",
        "Doc values nén mất dữ liệu",
        "Do replica"
      ], correct: 1, explanation: "Xem doc_count_error_upper_bound; tăng shard_size nếu cần." },
    { q: "shard_size mặc định với size = 10?", options: [
        "10", "25", "100", "1000"
      ], correct: 1, explanation: "size × 1.5 + 10." },
    { q: "Đếm số khách hàng distinct hiệu quả nhất?", options: [
        "terms size 1000000 rồi đếm bucket",
        "cardinality (HyperLogLog++)",
        "value_count",
        "top_hits"
      ], correct: 1, explanation: "Bộ nhớ cố định, sai số nhỏ, chính xác cao dưới precision_threshold." },
    { q: "calendar_interval: 1M khác fixed_interval: 30d thế nào?", options: [
        "Giống nhau",
        "1M theo tháng lịch (28–31 ngày); 30d luôn đúng 30 × 24h",
        "fixed_interval không hỗ trợ ngày",
        "calendar_interval chỉ cho giờ"
      ], correct: 1, explanation: "Tháng lịch không có độ dài cố định." },
    { q: "Thiếu time_zone trong date_histogram theo ngày gây gì cho dữ liệu VN?", options: [
        "Không gì",
        "Ngày bị cắt theo UTC: đơn lúc 0h–7h sáng giờ VN rơi vào ngày hôm trước",
        "Lỗi",
        "Chậm hơn"
      ], correct: 1, explanation: "Bucket mặc định theo UTC." },
    { q: "bucket_selector tương đương mệnh đề SQL nào?", options: [
        "WHERE", "HAVING", "ORDER BY", "JOIN"
      ], correct: 1, explanation: "Lọc bucket dựa trên metric đã tính." },
    { q: "Cần xuất doanh thu theo mọi (shop, ngày) — hàng trăm nghìn tổ hợp. Dùng gì?", options: [
        "terms lồng với size lớn",
        "composite aggregation phân trang bằng after_key",
        "top_hits",
        "scroll"
      ], correct: 1, explanation: "Tránh chạm search.max_buckets và tránh nổ heap." },
    { q: "post_filter khác filter trong query ở điểm nào?", options: [
        "Không khác",
        "post_filter lọc hits sau khi agg đã tính, nên agg không bị ảnh hưởng",
        "post_filter chấm điểm",
        "post_filter nhanh hơn"
      ], correct: 1, explanation: "Dùng cho facet đa lựa chọn." },
    { q: "Agg terms đầu tiên sau mỗi refresh trên field có hàng triệu giá trị khác nhau chậm vì sao?", options: [
        "Merge",
        "Phải dựng lại global ordinals; có thể dùng eager_global_ordinals",
        "Translog",
        "Replica đồng bộ"
      ], correct: 1, explanation: "eager_global_ordinals dời chi phí sang lúc refresh." },
    { q: "search.max_buckets mặc định bảo vệ điều gì?", options: [
        "Disk",
        "Heap: chặn request tạo quá nhiều bucket (mặc định 65536)",
        "Số shard",
        "Số field"
      ], correct: 1, explanation: "Agg lồng nhau nhân số bucket rất nhanh." }
  ]
});
