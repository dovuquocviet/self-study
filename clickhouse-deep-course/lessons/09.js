window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Họ MergeTree & chống trùng",
  title: "SummingMergeTree & AggregatingMergeTree: gom dữ liệu khi merge",
  subtitle: "cộng dồn số · AggregateFunction + -State/-Merge · SimpleAggregateFunction · vẫn phải GROUP BY khi đọc",

  theory: `
    <p>Hai engine này <strong>gộp</strong> các hàng cùng ORDER BY khi merge thay vì chỉ giữ một hàng. Chúng thường là <em>bảng đích của materialized view</em> (bài 13):
    MV biến mỗi batch event thành vài hàng tổng hợp, engine gộp tiếp theo thời gian.</p>

    <p><strong>SummingMergeTree([cột])</strong>: cộng các cột số (hoặc chỉ các cột liệt kê) của hàng cùng khoá; cột không phải số lấy giá trị của một hàng bất kỳ.
    Chỉ hợp với <code>sum</code>/<code>count</code>. Hàng có mọi cột cộng bằng 0 sẽ bị xoá khi merge.</p>

    <p><strong>AggregatingMergeTree</strong>: lưu <em>trạng thái trung gian</em> của hàm gộp. Ví dụ <code>uniq</code> (đếm khác nhau xấp xỉ) không thể cộng số — phải lưu cấu trúc
    HyperLogLog-like rồi gộp. Kiểu cột là <code>AggregateFunction(uniq, UInt64)</code>.</p>
    <ul>
      <li>Ghi: dùng hàm có hậu tố <code>-State</code>: <code>uniqState(user_id)</code>, <code>avgState(latency)</code>, <code>quantilesState(0.5, 0.99)(latency)</code>.</li>
      <li>Đọc: dùng hậu tố <code>-Merge</code>: <code>uniqMerge(users)</code>. SELECT thẳng cột state chỉ ra byte nhị phân.</li>
      <li><code>SimpleAggregateFunction(max, UInt64)</code>: cho hàm mà state chính là giá trị (sum, min, max, any, anyLast, groupUniqArray…) — lưu gọn và đọc được trực tiếp.</li>
    </ul>

    <p><strong>Quy tắc vàng khi đọc</strong>: luôn <code>GROUP BY</code> khoá + <code>sum()</code>/<code>-Merge</code>, vì có thể còn nhiều hàng cùng khoá chưa được gộp.</p>

    <div class="callout"><p>💡 Trong Java bạn quen <code>Collectors.groupingBy(..., summingLong(...))</code> chạy một lần. Ở đây việc gom diễn ra <em>từng phần</em>: mỗi batch gom một ít, merge gom thêm,
    query gom nốt phần còn lại. Hàm gộp phải có tính "gộp được" (associative) — avg thì lưu (sum, count), không lưu avg.</p></div>
  `,

  codeTabs: [
    { id: "sum", label: "① Summing", lines: [
      "CREATE TABLE revenue_daily",
      "(",
      "    day        Date,",
      "    tenant_id  UInt32,",
      "    channel    LowCardinality(String),",
      "    orders     UInt64,",
      "    revenue    Decimal(18, 2)",
      ")",
      "ENGINE = SummingMergeTree((orders, revenue))",
      "ORDER BY (tenant_id, day, channel);",
      "",
      "-- đọc: LUÔN gom lại",
      "SELECT day, sum(orders), sum(revenue)",
      "FROM revenue_daily WHERE tenant_id = 7",
      "GROUP BY day ORDER BY day;"
    ]},
    { id: "agg", label: "② Aggregating", lines: [
      "CREATE TABLE visits_hourly",
      "(",
      "    hour       DateTime,",
      "    url        String,",
      "    views      SimpleAggregateFunction(sum, UInt64),",
      "    users      AggregateFunction(uniq, UInt64),",
      "    p99        AggregateFunction(quantile(0.99), UInt32)",
      ")",
      "ENGINE = AggregatingMergeTree",
      "ORDER BY (url, hour);"
    ]},
    { id: "write", label: "③ Ghi -State", lines: [
      "INSERT INTO visits_hourly",
      "SELECT toStartOfHour(ts)        AS hour,",
      "       url,",
      "       count()                  AS views,",
      "       uniqState(user_id)       AS users,",
      "       quantileState(0.99)(latency_ms) AS p99",
      "FROM page_views_raw",
      "GROUP BY hour, url;"
    ]},
    { id: "read", label: "④ Đọc -Merge", lines: [
      "SELECT url,",
      "       sum(views)               AS views,",
      "       uniqMerge(users)         AS users,",
      "       quantileMerge(0.99)(p99) AS p99",
      "FROM visits_hourly",
      "WHERE hour >= now() - INTERVAL 1 DAY",
      "GROUP BY url",
      "ORDER BY views DESC LIMIT 10;",
      "",
      "-- SAI: SELECT users FROM visits_hourly  -> ra byte nhị phân"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="b1"><div class="nl">batch 1</div><div class="ns">/home 10h: views 30, state{u1,u2}</div></div>
      <div class="node" id="b2"><div class="nl">batch 2</div><div class="ns">/home 10h: views 12, state{u2,u3}</div></div>
    </div>
    <div class="arrow" id="a1">↓ merge gộp state (không phải cộng số)</div>
    <div class="node" id="m"><div class="nl">📦 /home 10h</div><div class="ns">views 42, state{u1,u2,u3}</div></div>
    <div class="arrow" id="a2">↓ query: GROUP BY + -Merge</div>
    <div class="node" id="r"><div class="nl">📊 views = 42, users = 3</div><div class="ns">đúng dù đã merge hay chưa</div></div>
  `,
  steps: [
    { title: "1 · SummingMergeTree cho số cộng được", tab: "sum", highlight: [9, 10], on: [],
      desc: "Khi merge, các hàng cùng (tenant_id, day, channel) được cộng orders và revenue." },
    { title: "2 · Vẫn GROUP BY khi đọc", tab: "sum", highlight: [13, 14, 15], on: [],
      desc: "Có thể còn vài hàng chưa gộp. sum() khi đọc đảm bảo đúng bất kể trạng thái merge." },
    { title: "3 · Cột state cho hàm không cộng được", tab: "agg", highlight: [5, 6, 7], on: ["b1", "b2"],
      desc: "uniq và quantile cần lưu cấu trúc trung gian; views dùng SimpleAggregateFunction(sum)." },
    { title: "4 · Ghi bằng -State", tab: "write", highlight: [5, 6], on: ["a1", "m"],
      desc: "Mỗi batch tạo state; merge gộp state của hai batch thành một." },
    { title: "5 · Đọc bằng -Merge", tab: "read", highlight: [2, 3, 4, 7, 10], on: ["a2", "r"],
      desc: "uniqMerge gộp nốt các state còn lại và trả số cuối cùng." }
  ],

  quiz: [
    { q: "SummingMergeTree làm gì khi merge?", options: [
        "Giữ hàng mới nhất",
        "Cộng các cột số của những hàng có cùng ORDER BY",
        "Xoá hàng trùng",
        "Tính trung bình"
      ], correct: 1, explanation: "Cột không phải số lấy giá trị của một hàng bất kỳ." },
    { q: "Vì sao khi đọc bảng SummingMergeTree vẫn phải sum() + GROUP BY?", options: [
        "Cú pháp bắt buộc",
        "Vì có thể còn nhiều hàng cùng khoá chưa được merge",
        "Để dùng index",
        "Không cần"
      ], correct: 1, explanation: "Merge là eventual." },
    { q: "Muốn lưu số user khác nhau theo giờ và gộp được, dùng gì?", options: [
        "SummingMergeTree với cột users UInt64",
        "AggregatingMergeTree với AggregateFunction(uniq, UInt64), ghi uniqState, đọc uniqMerge",
        "ReplacingMergeTree",
        "Cột Array"
      ], correct: 1, explanation: "Số distinct không cộng được; phải gộp state." },
    { q: "SELECT trực tiếp cột AggregateFunction trả gì?", options: [
        "Giá trị cuối", "Byte nhị phân của state", "NULL", "Lỗi luôn luôn"
      ], correct: 1, explanation: "Phải dùng hàm -Merge (hoặc finalizeAggregation)." },
    { q: "SimpleAggregateFunction phù hợp với hàm nào?", options: [
        "uniq", "quantile", "sum, min, max, any, anyLast", "avg"
      ], correct: 2, explanation: "Hàm mà state chính là kết quả; không cần -State/-Merge." },
    { q: "Muốn lưu giá trị trung bình gộp được qua nhiều batch?", options: [
        "Lưu avg rồi lấy avg của avg",
        "Dùng avgState/avgMerge (bên trong là sum và count) hoặc lưu sum và count riêng",
        "Lưu max",
        "Không làm được"
      ], correct: 1, explanation: "Trung bình của các trung bình là sai khi các nhóm có kích thước khác nhau." },
    { q: "Hàng có mọi cột cộng bằng 0 trong SummingMergeTree thì sao?", options: [
        "Giữ nguyên", "Bị xoá khi merge", "Báo lỗi", "Chuyển thành NULL"
      ], correct: 1, explanation: "Hành vi mặc định của SummingMergeTree." },
    { q: "Cú pháp đúng để ghi state quantile 0.99?", options: [
        "quantile(0.99)State(x)", "quantileState(0.99)(x)", "State(quantile, x)", "quantile_state(x, 0.99)"
      ], correct: 1, explanation: "Hậu tố -State gắn vào tên hàm, tham số hàm nằm ở cặp ngoặc đầu." },
    { q: "Các engine này thường được dùng ở đâu?", options: [
        "Làm bảng đích của materialized view gom dữ liệu thô",
        "Lưu session user",
        "Thay Kafka",
        "Bảng staging cho JOIN"
      ], correct: 0, explanation: "MV tổng hợp theo batch, engine gộp tiếp qua merge." }
  ]
});
