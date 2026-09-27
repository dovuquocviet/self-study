window.LESSONS.push({
  id: "07",
  phase: "2", phaseName: "Độ bền khi gọi nhau",
  title: "Timeout, retry, backoff, circuit breaker, bulkhead",
  subtitle: "Lỗi lan truyền thế nào · retry đúng cách có jitter · ngắt mạch · cô lập tài nguyên",

  theory: `
    <p>Trong hệ phân tán, <strong>chậm nguy hiểm hơn chết</strong>. Service chết trả lỗi ngay; service chậm giữ luồng/kết nối của bên gọi,
    bên gọi cạn pool rồi chậm theo, lan ngược lên tới gateway → sập dây chuyền (cascading failure). Bốn công cụ chặn lan truyền:</p>

    <p><strong>1. Timeout</strong> — mọi lời gọi mạng phải có. Chọn dựa trên p99 thực đo của bên kia (vd p99 = 200 ms → timeout 500 ms), không phải "30 giây cho chắc".
    Timeout tầng ngoài phải <em>lớn hơn</em> tổng timeout + retry tầng trong, nếu không tầng ngoài bỏ cuộc trong khi tầng trong vẫn đang làm.</p>

    <p><strong>2. Retry</strong> — chỉ khi đủ 3 điều kiện:</p>
    <ul>
      <li>Lỗi <em>tạm thời</em>: timeout kết nối, 502/503/504, 429 (tôn trọng <code>Retry-After</code>). Không retry 400/401/404/409/422 — thử lại vẫn sai.</li>
      <li>Thao tác <em>idempotent</em> (GET, PUT, hoặc POST có Idempotency-Key — bài 08). Retry POST tạo đơn không có key = tạo 2 đơn.</li>
      <li>Có <strong>backoff mũ + jitter</strong> và giới hạn số lần. Không jitter, hàng nghìn client retry đúng cùng mốc → "thundering herd" đập lại service vừa hồi phục.</li>
    </ul>
    <p>Retry nhân tải: 3 tầng mỗi tầng retry 3 lần → 3<sup>3</sup> = 27 request tới tầng cuối cho 1 request gốc. Quy tắc: <strong>retry ở một tầng</strong> (thường gần client nhất có ý nghĩa), hoặc dùng <em>retry budget</em> (vd retry không quá 10% tổng request).</p>

    <p><strong>3. Circuit breaker</strong> — đếm lỗi gần đây tới một phụ thuộc. Vượt ngưỡng → <em>Open</em>: trả lỗi/fallback ngay, không gọi nữa (cho bên kia thở).
    Sau một khoảng → <em>Half-open</em>: cho vài request thử; thành công → <em>Closed</em>, lỗi → Open lại.</p>

    <p><strong>4. Bulkhead</strong> — ngăn khoang như tàu thuỷ: mỗi phụ thuộc có giới hạn đồng thời riêng (semaphore/pool riêng). reco-service chậm chỉ chiếm tối đa 20 slot,
    không nuốt hết tài nguyên dành cho luồng thanh toán. Thêm <strong>load shedding</strong>: quá tải thì từ chối sớm (503) thay vì nhận rồi xử lý quá hạn.</p>

    <div class="callout"><p>💡 Spring: Resilience4j (<code>@Retry</code>, <code>@CircuitBreaker</code>, <code>@Bulkhead</code>, <code>@TimeLimiter</code>). Rust: hệ sinh thái <code>tower</code> —
    middleware <code>TimeoutLayer</code>, <code>ConcurrencyLimitLayer</code>, <code>LoadShedLayer</code>, <code>RetryLayer</code> (tự viết Policy), và <code>tokio::time::timeout</code> cho từng future.
    Circuit breaker có crate riêng hoặc tự viết vài chục dòng. Quan trọng là hiểu <em>vì sao</em>, không phải annotation nào.</p></div>
  `,

  codeTabs: [
    { id: "cascade", label: "① Sập dây chuyền", lines: [
      "t=0s   reco-service chậm: p99 từ 50 ms lên 30 s (GC/DB lock)",
      "t=1s   BFF gọi reco không timeout -> mỗi request giữ 1 kết nối",
      "t=5s   pool 100 kết nối của BFF cạn, request trang chủ xếp hàng",
      "t=10s  request /checkout cũng đi qua BFF -> cũng xếp hàng",
      "t=15s  mobile retry (không jitter) -> tải gấp 3",
      "t=20s  BFF hết RAM, OOM -> TOÀN BỘ app lỗi, vì một tính năng gợi ý",
      "",
      "# Cần: timeout (dòng 2), bulkhead (dòng 4), retry có jitter/budget (dòng 5)"
    ]},
    { id: "retry", label: "② Retry + backoff + jitter", lines: [
      "async fn call_with_retry<T, F, Fut>(mut f: F) -> Result<T, CallError>",
      "where F: FnMut() -> Fut, Fut: Future<Output = Result<T, CallError>> {",
      "    let base = Duration::from_millis(100);",
      "    let cap  = Duration::from_secs(2);",
      "    for attempt in 0..3u32 {",
      "        match tokio::time::timeout(Duration::from_millis(500), f()).await {",
      "            Ok(Ok(v)) => return Ok(v),",
      "            Ok(Err(e)) if !e.is_retryable() => return Err(e),   // 4xx: thôi",
      "            _ if attempt == 2 => break,",
      "            _ => {",
      "                let exp = (base * 2u32.pow(attempt)).min(cap);",
      "                let sleep = rand::thread_rng().gen_range(Duration::ZERO..=exp); // full jitter",
      "                tokio::time::sleep(sleep).await;",
      "            }",
      "        }",
      "    }",
      "    Err(CallError::Exhausted)",
      "}"
    ]},
    { id: "cb", label: "③ Circuit breaker", lines: [
      "Closed    : gọi bình thường, đếm lỗi trong cửa sổ 10 s",
      "            lỗi >= 50% và >= 20 request -> Open",
      "Open      : KHÔNG gọi, trả fallback ngay (vd trang chủ không có gợi ý)",
      "            sau 30 s -> Half-open",
      "Half-open : cho 5 request thử",
      "            đều OK -> Closed ; có lỗi -> Open lại 30 s",
      "",
      "if breaker.allow() {",
      "    let r = reco.get(user).await;",
      "    breaker.record(r.is_ok());",
      "    r.unwrap_or_default()",
      "} else { Vec::new() }       // fallback, không tốn một kết nối nào"
    ]},
    { id: "tower", label: "④ Bulkhead với tower", lines: [
      "// Mỗi phụ thuộc một stack riêng -> giới hạn riêng",
      "let reco = ServiceBuilder::new()",
      "    .load_shed()                          // quá giới hạn -> lỗi ngay, không xếp hàng",
      "    .concurrency_limit(20)                // tối đa 20 call đồng thời tới reco",
      "    .timeout(Duration::from_millis(300))",
      "    .service(reco_client);",
      "",
      "let payment = ServiceBuilder::new()",
      "    .concurrency_limit(200)               // thanh toán có khoang riêng, rộng hơn",
      "    .timeout(Duration::from_secs(3))",
      "    .service(payment_client);"
    ]},
    { id: "budget", label: "⑤ Toán timeout & retry", lines: [
      "mobile timeout            = 10 s",
      "BFF -> order timeout      = 3 s,  retry 1 lần  => tối đa ~6.x s  (< 10 s: OK)",
      "order -> inventory        = 800 ms, KHÔNG retry (tầng trên đã retry)",
      "",
      "Sai: 3 tầng x 3 lần thử = 27 request tới inventory cho 1 lần bấm",
      "Đúng: retry ở 1 tầng + retry budget (<= 10% lưu lượng là retry)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="c"><div class="nl">🦀 BFF / service gọi</div><div class="ns">timeout · retry có jitter</div></div>
    <div class="arrow" id="a1">↓ qua bulkhead (khoang riêng mỗi phụ thuộc)</div>
    <div class="row">
      <div class="node" id="closed"><div class="nl">🟢 Closed</div><div class="ns">gọi bình thường</div></div>
      <div class="node" id="open"><div class="nl">🔴 Open</div><div class="ns">fallback ngay</div></div>
      <div class="node" id="half"><div class="nl">🟡 Half-open</div><div class="ns">thử vài request</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="dep"><div class="nl">reco-service</div><div class="ns">đang chậm</div></div>
  `,
  steps: [
    { title: "1 · Chậm lan truyền thế nào", tab: "cascade", highlight: [1, 2, 3, 4, 6], on: ["dep", "c"],
      desc: "Một tính năng phụ không timeout đủ làm sập toàn app. Đây là lý do mọi thứ bên dưới tồn tại." },
    { title: "2 · Retry có điều kiện", tab: "retry", highlight: [6, 8, 9], on: ["c"],
      desc: "Mỗi lần thử có timeout riêng; lỗi không tạm thời (4xx) thì dừng; tối đa 3 lần." },
    { title: "3 · Backoff mũ + full jitter", tab: "retry", highlight: [11, 12, 13], on: ["c"],
      desc: "Chờ ngẫu nhiên trong [0, 100·2^n ms] để các client không retry cùng lúc." },
    { title: "4 · Ngắt mạch", tab: "cb", highlight: [2, 3, 4, 8, 12], on: ["closed", "open", "half"],
      desc: "Open: không gọi nữa, trả fallback ngay → cho reco thời gian hồi phục, BFF không mất kết nối." },
    { title: "5 · Bulkhead + load shedding", tab: "tower", highlight: [3, 4, 9], on: ["a1", "dep"],
      desc: "reco tối đa 20 slot; vượt thì từ chối ngay. Thanh toán có khoang riêng nên không bị ảnh hưởng." },
    { title: "6 · Timeout ngoài > trong, retry một tầng", tab: "budget", highlight: [1, 2, 3, 5, 6], on: ["c", "a2"],
      desc: "Nếu không, tải nhân lên theo cấp số và tầng ngoài bỏ cuộc trong khi tầng trong vẫn làm." }
  ],

  quiz: [
    { q: "Vì sao service chậm nguy hiểm hơn service chết?", options: [
        "Không nguy hiểm hơn",
        "Chậm giữ tài nguyên (kết nối, thread, RAM) của bên gọi, gây cạn kiệt và lan ngược lên",
        "Service chết không trả lỗi",
        "Vì log dài hơn"
      ], correct: 1, explanation: "Chết thì fail nhanh; chậm thì chiếm chỗ." },
    { q: "Lỗi nào KHÔNG nên retry?", options: [
        "503 Service Unavailable", "Timeout kết nối", "422 dữ liệu không hợp lệ", "429 kèm Retry-After"
      ], correct: 2, explanation: "Gửi lại y nguyên vẫn không hợp lệ." },
    { q: "Vì sao cần jitter trong backoff?", options: [
        "Cho code phức tạp hơn",
        "Tránh hàng loạt client retry cùng một thời điểm (thundering herd)",
        "Để retry nhanh hơn",
        "Để giảm log"
      ], correct: 1, explanation: "Ngẫu nhiên hoá thời điểm để trải đều tải." },
    { q: "3 tầng gọi nhau, mỗi tầng thử tối đa 3 lần. Tầng cuối có thể nhận bao nhiêu request cho 1 request gốc?", options: [
        "3", "9", "27", "6"
      ], correct: 2, explanation: "3 × 3 × 3. Vì vậy chỉ retry ở một tầng hoặc dùng retry budget." },
    { q: "Circuit breaker ở trạng thái Open làm gì?", options: [
        "Gọi bình thường",
        "Không gọi phụ thuộc, trả lỗi/fallback ngay",
        "Retry liên tục",
        "Tắt service"
      ], correct: 1, explanation: "Sau một thời gian chuyển Half-open để thử lại." },
    { q: "Bulkhead giải quyết vấn đề gì?", options: [
        "Mã hoá dữ liệu",
        "Một phụ thuộc chậm không chiếm hết tài nguyên dùng chung, các luồng khác vẫn chạy",
        "Tăng tốc DB",
        "Giảm dung lượng log"
      ], correct: 1, explanation: "Giới hạn đồng thời riêng cho từng phụ thuộc." },
    { q: "Retry POST /orders không có Idempotency-Key có thể gây gì?", options: [
        "Không sao",
        "Tạo đơn trùng nếu lần đầu thực ra đã thành công nhưng response bị mất",
        "Server tự khử trùng",
        "Chỉ chậm hơn"
      ], correct: 1, explanation: "Timeout không có nghĩa là thất bại." },
    { q: "Nên chọn giá trị timeout dựa trên gì?", options: [
        "30 giây cho an toàn",
        "Độ trễ p99 đo được của phụ thuộc cộng biên, và ngân sách thời gian của tầng trên",
        "Mặc định của thư viện",
        "Càng nhỏ càng tốt, 1 ms"
      ], correct: 1, explanation: "Quá lớn thì giữ tài nguyên; quá nhỏ thì báo lỗi oan." },
    { q: "Load shedding nghĩa là?", options: [
        "Xoá dữ liệu cũ",
        "Khi quá tải, từ chối sớm request mới (vd 503) thay vì nhận rồi xử lý quá hạn",
        "Tăng số instance",
        "Nén response"
      ], correct: 1, explanation: "Phục vụ tốt một phần còn hơn phục vụ tồi tất cả." }
  ]
});
