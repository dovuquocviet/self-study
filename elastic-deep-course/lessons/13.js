window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Aggregation & phân trang",
  title: "Phân trang: from/size, search_after, Point-in-Time, scroll",
  subtitle: "vì sao trang 500 chậm · max_result_window · con trỏ theo giá trị sort · snapshot nhất quán · track_total_hits",

  theory: `
    <p><strong>from/size và cái giá của trang sâu</strong>. Muốn trang 500 (from = 9980, size = 20), <em>mỗi shard</em> phải xếp hạng và gửi về <strong>10000</strong> ứng viên; với 5 shard coordinating phải sắp 50000 bản ghi để lấy 20. Chi phí tăng tuyến tính theo độ sâu. ES chặn bằng <code>index.max_result_window</code> = <strong>10000</strong> (from + size vượt → lỗi). Nâng giới hạn này chỉ chuyển vấn đề sang heap.</p>

    <p><strong>search_after</strong> — phân trang bằng con trỏ, giống keyset pagination trong SQL (<code>WHERE (price, id) &gt; (?, ?)</code>):</p>
    <ul>
      <li>Phải có <code>sort</code> xác định, với trường phá hoà duy nhất (tiebreaker).</li>
      <li>Trang sau truyền <code>search_after</code> = giá trị <code>sort</code> của hit cuối trang trước. Mỗi shard chỉ cần trả <code>size</code> bản ghi sau con trỏ → chi phí không đổi dù sâu bao nhiêu.</li>
      <li>Không nhảy thẳng tới trang N được — hợp với infinite scroll của mobile.</li>
    </ul>

    <p><strong>Point-in-Time (PIT)</strong>: giữa các trang, refresh sinh segment mới → document chen vào/biến mất → trùng hoặc sót. PIT "đóng băng" tập segment tại một thời điểm để mọi trang nhìn cùng một snapshot.</p>
    <ul>
      <li><code>POST /products/_pit?keep_alive=1m</code> → <code>id</code>. Search <em>không</em> ghi index trên đường dẫn, truyền <code>pit.id</code> + <code>keep_alive</code> (gia hạn mỗi lần).</li>
      <li>Có PIT thì ES tự thêm tiebreaker ngầm <code>_shard_doc</code>. Luôn dùng <code>pit_id</code> mới nhất trả về trong response.</li>
      <li>Xong phải <code>DELETE /_pit</code>: PIT giữ segment cũ không cho merge xoá → tốn disk, file handle.</li>
      <li><strong>OpenSearch</strong>: PIT từ 2.4 nhưng API khác: <code>POST /products/_search/point_in_time?keep_alive=1m</code>, xoá bằng <code>DELETE /_search/point_in_time</code>.</li>
    </ul>

    <p><strong>scroll</strong>: cách cũ để quét hết dữ liệu (giữ search context trên server). Elastic hiện <em>không khuyến nghị</em> scroll cho phân trang sâu; dùng search_after + PIT. Scroll còn gặp trong code cũ và trong reindex nội bộ.</p>

    <p><strong>track_total_hits</strong>: mặc định chỉ đếm chính xác tới 10000 (<code>"relation": "gte"</code> nếu hơn), để ES dừng sớm khi đủ top N. Đặt <code>true</code> để đếm chính xác — tốn hơn; UI "hơn 10.000 kết quả" thường là đủ.</p>

    <div class="callout"><p>💡 Spring Data <code>Pageable</code> sinh from/size. API mobile chuyển sang Rust nên trả <code>next_cursor</code> (mã hoá mảng sort values) thay vì <code>page=N</code> — giống cursor pagination của GraphQL.</p></div>
  `,

  codeTabs: [
    { id: "from", label: "① from/size", lines: [
      "POST /products/_search",
      "{ \"from\": 9980, \"size\": 20, \"query\": { \"match\": { \"name\": \"ốp lưng\" } } }",
      "# mỗi shard: xếp hạng, trả 10000 ứng viên → coordinating sắp 5 × 10000",
      "",
      "{ \"from\": 10000, \"size\": 20, ... }",
      "# → Result window is too large, from + size must be less than or equal to: [10000]",
      "#   but was [10020]... controlled by the [index.max_result_window] index level setting"
    ]},
    { id: "sa", label: "② search_after", lines: [
      "POST /products/_search",
      "{ \"size\": 20,",
      "  \"query\": { \"term\": { \"category\": \"op-lung\" } },",
      "  \"sort\": [ { \"price\": \"asc\" }, { \"sku\": \"asc\" } ] }      // sku duy nhất = tiebreaker",
      "",
      "# hit cuối: \"sort\": [ 89000, \"OL-2231\" ]",
      "",
      "POST /products/_search",
      "{ \"size\": 20, \"query\": { ... },",
      "  \"sort\": [ { \"price\": \"asc\" }, { \"sku\": \"asc\" } ],",
      "  \"search_after\": [ 89000, \"OL-2231\" ] }"
    ]},
    { id: "pit", label: "③ PIT + search_after", lines: [
      "POST /products/_pit?keep_alive=1m",
      "# → { \"id\": \"46ToAwMDaWR5BXV1aWQy...\" }",
      "",
      "POST /_search                                  // KHÔNG có tên index",
      "{ \"size\": 1000,",
      "  \"pit\":  { \"id\": \"46ToAwMDaWR5BXV1aWQy...\", \"keep_alive\": \"1m\" },",
      "  \"sort\": [ { \"updated_at\": \"asc\" } ],        // _shard_doc tự thêm làm tiebreaker",
      "  \"search_after\": [ 1714521600000, 4294967298 ] }",
      "",
      "DELETE /_pit",
      "{ \"id\": \"46ToAwMDaWR5BXV1aWQy...\" }"
    ]},
    { id: "os", label: "④ OpenSearch & total", lines: [
      "# OpenSearch 2.4+",
      "POST /products/_search/point_in_time?keep_alive=1m",
      "# → { \"pit_id\": \"o463QQEPbXktaW5kZXgt...\" }",
      "DELETE /_search/point_in_time   { \"pit_id\": [ \"o463QQ...\" ] }",
      "",
      "# track_total_hits",
      "\"hits\": { \"total\": { \"value\": 10000, \"relation\": \"gte\" } }   // mặc định",
      "{ \"track_total_hits\": true, ... }   // đếm chính xác, tốn hơn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="fs"><div class="nl">📄 from/size trang 500</div><div class="ns">mỗi shard gửi 10000 ứng viên</div></div>
    <div class="arrow" id="a1">↓ thay bằng con trỏ</div>
    <div class="node" id="sa"><div class="nl">👉 search_after [89000, "OL-2231"]</div><div class="ns">mỗi shard chỉ gửi 20</div></div>
    <div class="arrow" id="a2">↓ + đóng băng snapshot</div>
    <div class="node" id="pit"><div class="nl">📸 PIT</div><div class="ns">mọi trang nhìn cùng tập segment</div></div>
    <div class="arrow" id="a3">↓ xong thì</div>
    <div class="node" id="del"><div class="nl">🧹 DELETE /_pit</div><div class="ns">trả segment cho merge</div></div>
  `,
  steps: [
    { title: "1 · Trang sâu = chi phí sâu", tab: "from", highlight: [2, 3], on: ["fs"],
      desc: "Mỗi shard phải tính top from + size, không phải chỉ size." },
    { title: "2 · Tường 10000", tab: "from", highlight: [5, 6, 7], on: ["fs"],
      desc: "max_result_window chặn trước khi heap chịu trận." },
    { title: "3 · Con trỏ theo giá trị sort", tab: "sa", highlight: [4, 6, 11], on: ["a1", "sa"],
      desc: "Giống keyset pagination. sku duy nhất để không sót/trùng khi cùng giá." },
    { title: "4 · Snapshot nhất quán", tab: "pit", highlight: [1, 4, 6, 7], on: ["a2", "pit"],
      desc: "Không ghi index trên URL; keep_alive gia hạn mỗi lần gọi." },
    { title: "5 · Dọn PIT", tab: "pit", highlight: [10, 11], on: ["a3", "del"],
      desc: "PIT treo = segment cũ không được xoá sau merge." },
    { title: "6 · Khác biệt OpenSearch", tab: "os", highlight: [2, 4, 7, 8], on: ["pit"],
      desc: "Cùng ý tưởng, khác đường dẫn API. track_total_hits mặc định dừng đếm ở 10000." }
  ],

  quiz: [
    { q: "index.max_result_window mặc định?", options: [
        "1000", "10000", "100000", "Không giới hạn"
      ], correct: 1, explanation: "from + size không được vượt 10000." },
    { q: "Vì sao from = 9980, size = 20 tốn kém?", options: [
        "Vì phải đọc _source 10000 doc",
        "Mỗi shard phải xếp hạng và gửi 10000 ứng viên để coordinating chọn đúng 20",
        "Vì không dùng cache",
        "Vì phải refresh"
      ], correct: 1, explanation: "Chi phí tỉ lệ với độ sâu × số shard." },
    { q: "search_after cần điều kiện gì?", options: [
        "Không cần sort",
        "Sort xác định có tiebreaker duy nhất; truyền giá trị sort của hit cuối",
        "from = 0 luôn",
        "Chỉ chạy với scroll"
      ], correct: 1, explanation: "Thiếu tiebreaker có thể sót/trùng document cùng giá trị sort." },
    { q: "PIT giải quyết vấn đề gì?", options: [
        "Tăng tốc query",
        "Kết quả nhất quán giữa các trang dù dữ liệu đang được ghi/refresh",
        "Bỏ giới hạn 10000",
        "Giảm heap"
      ], correct: 1, explanation: "Đóng băng tập segment tại một thời điểm." },
    { q: "Khi search với PIT, đường dẫn là?", options: [
        "POST /products/_search", "POST /_search (không có index)", "POST /_pit/_search", "GET /products/_pit"
      ], correct: 1, explanation: "Index đã gắn với PIT." },
    { q: "Quên DELETE PIT có hậu quả gì (trước khi hết keep_alive)?", options: [
        "Không có",
        "Segment cũ bị giữ lại, không được xoá sau merge → tốn disk và file handle",
        "Mất dữ liệu",
        "Index read-only"
      ], correct: 1, explanation: "Luôn đóng PIT khi xong." },
    { q: "API PIT của OpenSearch?", options: [
        "Giống hệt ES",
        "POST /index/_search/point_in_time và DELETE /_search/point_in_time",
        "Không hỗ trợ PIT",
        "Dùng scroll_id"
      ], correct: 1, explanation: "Khác đường dẫn so với ES /_pit." },
    { q: "hits.total trả value 10000, relation gte nghĩa là?", options: [
        "Có đúng 10000",
        "Có ít nhất 10000; ES dừng đếm chính xác ở đó (track_total_hits mặc định)",
        "Lỗi",
        "Bị cắt bởi max_result_window"
      ], correct: 1, explanation: "Đặt track_total_hits: true nếu thật sự cần con số chính xác." },
    { q: "API mobile infinite scroll nên phân trang thế nào?", options: [
        "page=N với from/size",
        "next_cursor mã hoá sort values, dùng search_after",
        "scroll",
        "Trả hết một lần"
      ], correct: 1, explanation: "Chi phí không đổi theo độ sâu." }
  ]
});
