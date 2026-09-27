window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Case study",
  title: "Case study 2: Push notification cho app mobile",
  subtitle: "Đăng ký device token · notification-service từ Kafka · FCM HTTP v1 & APNs · xử lý token chết · chiến dịch 1 triệu máy",

  theory: `
    <p><strong>Yêu cầu</strong>: push giao dịch (đơn đã xác nhận, đang giao) trong vài giây; push marketing tới hàng triệu máy; tôn trọng tuỳ chọn người dùng (tắt marketing, giờ yên lặng);
    bấm push mở đúng màn hình (deep link). Phi chức năng: không spam trùng, không gửi tới token chết mãi, chiến dịch không làm nghẽn push giao dịch.</p>

    <p><strong>Sự thật quan trọng</strong>: push là <em>best-effort</em>. FCM/APNs không đảm bảo giao, máy có thể tắt, người dùng có thể tắt quyền.
    Thông tin quan trọng phải nằm cả trong app (inbox/trạng thái đơn) — push chỉ là lời nhắc.</p>

    <p><strong>Thành phần</strong></p>
    <ul>
      <li><strong>Đăng ký token</strong>: app lấy token (FCM registration token; APNs device token trên iOS, hoặc dùng FCM cho cả hai) và gửi lên
        <code>PUT /v1/devices/{installation_id}</code> mỗi lần mở app/khi token đổi. Khoá theo <em>installation</em>, không theo user: một user nhiều máy; đăng xuất thì gỡ liên kết user.</li>
      <li><strong>notification-service</strong>: consumer group trên Kafka (<code>order.v1</code>, <code>shipping.v1</code>...), quyết định có gửi không (tuỳ chọn, giờ yên lặng), dựng nội dung theo ngôn ngữ, rồi đẩy vào hàng gửi.</li>
      <li><strong>Sender</strong>: gọi FCM HTTP v1 (<code>POST https://fcm.googleapis.com/v1/projects/{project}/messages:send</code>, xác thực OAuth2 bằng service account)
        và/hoặc APNs (HTTP/2, <code>POST /3/device/{token}</code>, xác thực bằng JWT ký khoá .p8, header <code>apns-topic</code> = bundle id, <code>apns-push-type</code>).</li>
    </ul>

    <p><strong>Xử lý phản hồi — nơi hay bị bỏ quên</strong></p>
    <table>
      <tr><th>Phản hồi</th><th>Ý nghĩa</th><th>Làm gì</th></tr>
      <tr><td>FCM <code>UNREGISTERED</code> (404) · APNs <code>410 Unregistered</code> / <code>BadDeviceToken</code></td><td>Token không còn hợp lệ (gỡ app, token đổi)</td><td>Xoá/đánh dấu token, không gửi lại</td></tr>
      <tr><td>429 / <code>QUOTA_EXCEEDED</code>, 5xx / <code>UNAVAILABLE</code></td><td>Quá tải/tạm thời</td><td>Retry có backoff + jitter, tôn trọng Retry-After</td></tr>
      <tr><td><code>INVALID_ARGUMENT</code> · 400</td><td>Payload sai</td><td>Không retry; log và sửa code</td></tr>
    </table>
    <p>Token không hoạt động lâu cũng nên dọn (Firebase khuyên làm mới token định kỳ và coi token không thấy hoạt động khoảng một tháng là cũ).</p>

    <p><strong>Tách luồng theo độ ưu tiên</strong>: topic/queue riêng cho <em>transactional</em> và <em>marketing</em>, consumer riêng, giới hạn tốc độ riêng.
    Chiến dịch 1 triệu máy: job chia danh sách thành lô (theo segment trong ClickHouse/DB), đẩy vào topic marketing nhiều partition, sender scale ngang, rate limit tổng theo quota nhà cung cấp.</p>

    <p><strong>Chống trùng</strong>: khoá idempotent (<code>event_id</code>, <code>installation_id</code>) — consumer at-least-once không gửi 2 push cho cùng sự kiện.
    Trạng thái đơn đổi liên tục → dùng <code>apns-collapse-id</code> / Android <code>collapse_key</code> để push mới thay push cũ trên màn hình khoá.</p>

    <div class="callout"><p>💡 Với app React Native hiện tại hay Kotlin/Swift sau này, backend không đổi: hợp đồng là "app đăng ký installation + token + nền tảng + ngôn ngữ".
    Kết quả gửi/mở (sent, failed, opened) đổ vào Kafka → ClickHouse để đo tỉ lệ mở theo chiến dịch.</p></div>
  `,

  codeTabs: [
    { id: "reg", label: "① Đăng ký thiết bị", lines: [
      "PUT /v1/devices/inst_7f3a    (Authorization: Bearer <access token, nếu đã đăng nhập>)",
      "{ \"platform\": \"ios\", \"push_token\": \"fcm:dK3...\", \"app_version\": \"4.3.1\",",
      "  \"locale\": \"vi-VN\", \"timezone\": \"Asia/Ho_Chi_Minh\" }",
      "",
      "CREATE TABLE devices (",
      "  installation_id text PRIMARY KEY,",
      "  user_id         text,              -- NULL khi đăng xuất",
      "  platform        text NOT NULL,",
      "  push_token      text NOT NULL,",
      "  locale          text, timezone text,",
      "  last_seen_at    timestamptz NOT NULL,",
      "  invalid_at      timestamptz        -- đánh dấu khi FCM/APNs báo token chết",
      ");",
      "CREATE INDEX ON devices (user_id) WHERE invalid_at IS NULL;"
    ]},
    { id: "fcm", label: "② FCM HTTP v1", lines: [
      "POST https://fcm.googleapis.com/v1/projects/shop-prod/messages:send",
      "Authorization: Bearer <OAuth2 access token của service account>",
      "{",
      "  \"message\": {",
      "    \"token\": \"dK3...\",",
      "    \"notification\": { \"title\": \"Đơn ord_9 đang giao\", \"body\": \"Dự kiến tới 15:00 hôm nay\" },",
      "    \"data\": { \"deeplink\": \"shop://orders/ord_9\", \"event_id\": \"01J8Z...\" },",
      "    \"android\": { \"priority\": \"HIGH\", \"collapse_key\": \"order-ord_9\", \"ttl\": \"3600s\" },",
      "    \"apns\": { \"headers\": { \"apns-priority\": \"10\", \"apns-collapse-id\": \"order-ord_9\" } }",
      "  }",
      "}"
    ]},
    { id: "apns", label: "③ APNs trực tiếp", lines: [
      "POST https://api.push.apple.com/3/device/<device-token>     (HTTP/2)",
      "authorization: bearer <JWT ES256 ký bằng khoá .p8, kid + team id, làm mới < 1 giờ>",
      "apns-topic: vn.shop.app          # bundle id",
      "apns-push-type: alert",
      "apns-priority: 10                # 10 = ngay; 5 = tiết kiệm pin",
      "apns-collapse-id: order-ord_9",
      "apns-expiration: 1790000000      # hết hạn thì APNs bỏ, không giao muộn",
      "",
      "{ \"aps\": { \"alert\": { \"title\": \"Đơn ord_9 đang giao\", \"body\": \"Dự kiến 15:00\" }, \"sound\": \"default\" },",
      "  \"deeplink\": \"shop://orders/ord_9\" }",
      "",
      "# 410 {\"reason\":\"Unregistered\"} -> đánh dấu token chết"
    ]},
    { id: "svc", label: "④ notification-service (Rust)", lines: [
      "async fn on_order_event(st: &AppState, e: OrderEvent) -> anyhow::Result<()> {",
      "    let Some(tpl) = template_for(&e) else { return Ok(()) };      // không phải event cần push",
      "    for d in repo::active_devices(&st.db, &e.customer_id).await? {",
      "        if !prefs::allows(&st.db, &e.customer_id, tpl.category).await? { continue; }",
      "        if tpl.category == Category::Marketing && quiet_hours(&d.timezone) { continue; }",
      "        // idempotent: (event_id, installation) chỉ gửi một lần",
      "        if !st.sent.insert_once(&e.event_id, &d.installation_id).await? { continue; }",
      "        match st.fcm.send(&d.push_token, tpl.render(&d.locale, &e)).await {",
      "            Ok(_) => {}",
      "            Err(FcmError::Unregistered) => repo::mark_invalid(&st.db, &d.installation_id).await?,",
      "            Err(e) if e.is_retryable() => return Err(e.into()),      // để lần consume sau thử lại",
      "            Err(e) => tracing::warn!(error = %e, \"push dropped\"),",
      "        }",
      "    }",
      "    Ok(())",
      "}"
    ]},
    { id: "campaign", label: "⑤ Chiến dịch 1 triệu máy", lines: [
      "1. Marketing chọn segment (truy vấn ClickHouse: mua son 90 ngày, chưa mua 30 ngày)",
      "2. campaign-job ghi danh sách installation vào topic push.marketing.v1 (48 partition), lô 500",
      "3. sender-marketing: 12 pod, token bucket tổng theo quota nhà cung cấp",
      "4. sender-transactional: pod RIÊNG, topic RIÊNG -> đơn hàng không chờ sau 1 triệu push quảng cáo",
      "5. Kết quả sent/failed/opened -> Kafka -> ClickHouse -> tỉ lệ mở theo chiến dịch",
      "",
      "1 000 000 push / 12 pod / 200 push/s mỗi pod ≈ 7 phút"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">đăng ký installation + token</div></div>
    <div class="arrow" id="a1">↓ PUT /devices</div>
    <div class="row">
      <div class="node" id="k"><div class="nl">📨 Kafka</div><div class="ns">order.v1 · push.marketing.v1</div></div>
      <div class="node" id="ns"><div class="nl">🦀 notification-service</div><div class="ns">tuỳ chọn · giờ yên lặng · idempotent</div></div>
    </div>
    <div class="row">
      <div class="node" id="tx"><div class="nl">⚡ sender giao dịch</div><div class="ns">ưu tiên cao, pod riêng</div></div>
      <div class="node" id="mk"><div class="nl">📣 sender marketing</div><div class="ns">rate limit theo quota</div></div>
    </div>
    <div class="arrow" id="a2">↓ HTTPS / HTTP2</div>
    <div class="node" id="prov"><div class="nl">FCM · APNs</div><div class="ns">UNREGISTERED/410 → xoá token</div></div>
  `,
  steps: [
    { title: "1 · Đăng ký theo installation", tab: "reg", highlight: [1, 2, 6, 7, 12], on: ["app", "a1"],
      desc: "Một user nhiều máy; đăng xuất thì bỏ liên kết user; token chết được đánh dấu." },
    { title: "2 · Từ event tới quyết định gửi", tab: "svc", highlight: [2, 4, 5, 7], on: ["k", "ns"],
      desc: "Kiểm tuỳ chọn, giờ yên lặng theo múi giờ máy, khoá idempotent (event, installation)." },
    { title: "3 · Gửi qua FCM HTTP v1", tab: "fcm", highlight: [1, 2, 5, 7, 8, 9], on: ["tx", "a2", "prov"],
      desc: "Deep link trong data; collapse để push trạng thái mới thay push cũ; TTL để không giao quá muộn." },
    { title: "4 · Hoặc APNs trực tiếp", tab: "apns", highlight: [2, 3, 4, 5, 7, 12], on: ["prov"],
      desc: "JWT provider token từ khoá .p8; apns-topic là bundle id; 410 nghĩa là token đã chết." },
    { title: "5 · Xử lý lỗi đúng loại", tab: "svc", highlight: [10, 11, 12], on: ["ns", "prov"],
      desc: "Token chết → đánh dấu; lỗi tạm thời → retry; payload sai → không retry." },
    { title: "6 · Chiến dịch không chặn giao dịch", tab: "campaign", highlight: [2, 3, 4, 7], on: ["mk", "tx"],
      desc: "Topic và pod riêng theo độ ưu tiên; thông lượng tính trước; kết quả đo trong ClickHouse." }
  ],

  quiz: [
    { q: "Vì sao không được coi push là kênh giao tin đảm bảo?", options: [
        "Push luôn đảm bảo",
        "FCM/APNs là best-effort; máy tắt, mất quyền, token chết đều làm push không tới",
        "Vì push chậm",
        "Vì push bị mã hoá"
      ], correct: 1, explanation: "Thông tin quan trọng phải có trong app (inbox/trạng thái)." },
    { q: "Nên khoá bảng thiết bị theo gì?", options: [
        "user_id", "installation_id (mỗi lần cài app trên một máy)", "số điện thoại", "email"
      ], correct: 1, explanation: "Một user nhiều máy; máy có thể đổi người đăng nhập." },
    { q: "APNs trả 410 Unregistered. Làm gì?", options: [
        "Retry sau 1 phút",
        "Đánh dấu/xoá token, ngừng gửi tới token đó",
        "Gửi lại qua FCM",
        "Bỏ qua"
      ], correct: 1, explanation: "Gửi mãi tới token chết lãng phí và có thể bị nhà cung cấp phạt tốc độ." },
    { q: "Endpoint FCM HTTP v1 để gửi một message?", options: [
        "POST https://fcm.googleapis.com/fcm/send với server key",
        "POST https://fcm.googleapis.com/v1/projects/{project}/messages:send với OAuth2 token",
        "GET https://fcm.googleapis.com/push",
        "POST https://api.push.apple.com/3/device"
      ], correct: 1, explanation: "API legacy dùng server key đã bị Google ngừng." },
    { q: "Header apns-topic chứa gì?", options: [
        "Tên topic Kafka", "Bundle id của app", "Device token", "Team id"
      ], correct: 1, explanation: "Theo tài liệu APNs." },
    { q: "Trạng thái đơn đổi 4 lần trong 1 giờ; muốn màn hình khoá chỉ còn push mới nhất?", options: [
        "Gửi 4 push riêng",
        "Dùng apns-collapse-id / collapse_key cùng giá trị cho đơn đó",
        "Chỉ gửi push cuối",
        "Tắt âm thanh"
      ], correct: 1, explanation: "Push mới thay thế push cũ cùng khoá." },
    { q: "Consumer Kafka at-least-once có thể gửi push trùng. Chống thế nào?", options: [
        "Không chống được",
        "Khoá idempotent (event_id, installation_id) — đã gửi thì bỏ qua",
        "Tắt retry",
        "Gửi hai lần cho chắc"
      ], correct: 1, explanation: "Áp dụng bài 08 cho tác dụng bên ngoài." },
    { q: "Vì sao tách sender transactional và marketing?", options: [
        "Cho đẹp kiến trúc",
        "Chiến dịch 1 triệu push không được làm push 'đơn đã giao' phải xếp hàng phía sau",
        "FCM yêu cầu",
        "Để tiết kiệm tiền"
      ], correct: 1, explanation: "Bulkhead theo độ ưu tiên." },
    { q: "Push marketing lúc 2 giờ sáng theo giờ người dùng. Thiết kế đúng?", options: [
        "Vẫn gửi",
        "Kiểm giờ yên lặng theo timezone của thiết bị; hoãn tới khung giờ cho phép",
        "Gửi im lặng",
        "Dùng giờ server"
      ], correct: 1, explanation: "Timezone lưu khi đăng ký thiết bị." }
  ]
});
