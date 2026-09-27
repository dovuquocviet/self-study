window.LESSONS.push({
  id: "14",
  phase: "4", phaseName: "Kiến trúc app & tài nguyên hệ thống",
  title: "Chạy nền: WorkManager, foreground service, BGTaskScheduler — và giới hạn của OS",
  subtitle: "Doze · App Standby Buckets · chu kỳ tối thiểu 15 phút · FGS type · BGAppRefresh vs BGProcessing · background URLSession",

  theory: `
    <p>Trên server, <code>@Scheduled(cron = "0 */5 * * * *")</code> chạy đúng giờ. Trên điện thoại, pin là tài nguyên số 1: OS <strong>gom, hoãn, hoặc từ chối</strong> việc nền của bạn.
    Tư duy đúng: bạn <em>khai báo điều kiện</em>, OS quyết định <em>khi nào</em>.</p>

    <p><strong>Android</strong></p>
    <ul>
      <li><strong>Doze</strong> (Android 6+): máy nằm yên, tắt màn → mạng, alarm, job bị hoãn, chỉ chạy trong các "cửa sổ bảo trì" thưa dần.</li>
      <li><strong>App Standby Buckets</strong> (Android 9+): app được xếp <em>active / working set / frequent / rare / restricted</em> theo mức dùng; bucket càng thấp, job càng bị giới hạn.</li>
      <li><strong>WorkManager</strong> — lựa chọn mặc định cho việc cần <em>đảm bảo chạy</em> kể cả khi app bị giết hoặc máy khởi động lại: đồng bộ đơn nháp, upload log. Có ràng buộc (mạng, sạc, pin không yếu), retry với backoff, chuỗi công việc.
      Việc định kỳ có chu kỳ <strong>tối thiểu 15 phút</strong> và không đúng giờ tuyệt đối.</li>
      <li><strong>Foreground service</strong>: việc người dùng <em>đang nhận thấy</em> (phát nhạc, dẫn đường, đang gọi) — bắt buộc có notification. Target Android 14+ phải khai báo <code>foregroundServiceType</code> (vd <code>dataSync</code>, <code>location</code>, <code>mediaPlayback</code>) cùng permission tương ứng; từ Android 12 hầu như không được khởi động FGS khi app đang ở nền.</li>
      <li><strong>Exact alarm</strong> cần quyền <code>SCHEDULE_EXACT_ALARM</code>/<code>USE_EXACT_ALARM</code> — chỉ cho app báo thức, lịch.</li>
    </ul>

    <p><strong>iOS — chặt hơn nhiều</strong></p>
    <ul>
      <li>Không có "service chạy nền" tuỳ ý. Chỉ có các <em>background mode</em> được khai báo (audio, location, VoIP, …) và <code>BGTaskScheduler</code>.</li>
      <li><code>BGAppRefreshTask</code>: vài chục giây để làm mới nội dung; hệ thống chọn thời điểm dựa trên thói quen dùng app (<code>earliestBeginDate</code> chỉ là "không sớm hơn").</li>
      <li><code>BGProcessingTask</code>: việc dài vài phút (dọn DB, train model), thường chạy khi máy rảnh/sạc; có thể yêu cầu mạng/nguồn điện.</li>
      <li><strong>Background URLSession</strong>: giao việc upload/tải file lớn cho hệ thống, tiếp tục kể cả khi app bị suspend/giết; app được đánh thức khi xong.</li>
      <li><em>Silent push</em> (<code>content-available: 1</code>) có thể đánh thức app nhưng bị hệ thống điều tiết, không đảm bảo tới; app bị người dùng vuốt tắt thì không được đánh thức.</li>
    </ul>

    <table>
      <tr><th>Nhu cầu</th><th>Android</th><th>iOS</th></tr>
      <tr><td>Đồng bộ đảm bảo, không gấp</td><td>WorkManager + constraints</td><td>BGAppRefresh/BGProcessing + đồng bộ khi mở app</td></tr>
      <tr><td>Upload file lớn</td><td>WorkManager (có thể expedited / FGS dataSync)</td><td>Background URLSession</td></tr>
      <tr><td>Người dùng đang theo dõi</td><td>Foreground service + notification</td><td>Background mode tương ứng (audio, location…)</td></tr>
      <tr><td>Báo cho app có dữ liệu mới</td><td>FCM data message</td><td>Push (bài 18), silent push không đảm bảo</td></tr>
    </table>

    <div class="callout"><p>💡 Thiết kế kiểu backend quen thuộc "cứ 5 phút poll API" không làm được trên mobile. Thay bằng: <strong>server push khi có thay đổi</strong> + <strong>đồng bộ khi app mở</strong> + job nền cơ hội. Và job nền phải <em>idempotent</em> — nó có thể chạy lại.</p></div>
  `,

  codeTabs: [
    { id: "wm", label: "① WorkManager", lines: [
      "class SyncOrdersWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {",
      "    override suspend fun doWork(): Result = try {",
      "        repo.pushPendingOrders()          // idempotent: có thể chạy lại",
      "        Result.success()",
      "    } catch (e: IOException) { Result.retry() }",
      "}",
      "",
      "val req = PeriodicWorkRequestBuilder<SyncOrdersWorker>(15, TimeUnit.MINUTES)  // tối thiểu 15'",
      "    .setConstraints(Constraints(requiredNetworkType = NetworkType.CONNECTED, requiresBatteryNotLow = true))",
      "    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)",
      "    .build()",
      "WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(\"sync-orders\", ExistingPeriodicWorkPolicy.KEEP, req)"
    ]},
    { id: "fgs", label: "② Foreground service", lines: [
      "<!-- AndroidManifest.xml (target 34+) -->",
      "<uses-permission android:name=\"android.permission.FOREGROUND_SERVICE\"/>",
      "<uses-permission android:name=\"android.permission.FOREGROUND_SERVICE_DATA_SYNC\"/>",
      "<service android:name=\".UploadService\"",
      "         android:foregroundServiceType=\"dataSync\" android:exported=\"false\"/>",
      "",
      "// trong service",
      "ServiceCompat.startForeground(this, 1, notification,",
      "    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)"
    ]},
    { id: "bg", label: "③ iOS BGTaskScheduler", lines: [
      "// Info.plist: BGTaskSchedulerPermittedIdentifiers = [\"vn.shop.refresh\"]",
      "//             UIBackgroundModes = [\"fetch\", \"processing\"]",
      "",
      "BGTaskScheduler.shared.register(forTaskWithIdentifier: \"vn.shop.refresh\", using: nil) { task in",
      "    scheduleRefresh()                                    // hẹn lần sau",
      "    let job = Task { await feed.refresh(); task.setTaskCompleted(success: true) }",
      "    task.expirationHandler = { job.cancel() }            // hết giờ phải dừng",
      "}",
      "",
      "func scheduleRefresh() {",
      "    let req = BGAppRefreshTaskRequest(identifier: \"vn.shop.refresh\")",
      "    req.earliestBeginDate = Date(timeIntervalSinceNow: 60 * 60)   // 'không sớm hơn'",
      "    try? BGTaskScheduler.shared.submit(req)",
      "}"
    ]},
    { id: "url", label: "④ Background URLSession", lines: [
      "let cfg = URLSessionConfiguration.background(withIdentifier: \"vn.shop.upload\")",
      "cfg.isDiscretionary = false",
      "let session = URLSession(configuration: cfg, delegate: self, delegateQueue: nil)",
      "session.uploadTask(with: request, fromFile: videoURL).resume()   // phải là file, không phải Data",
      "",
      "// App bị suspend/giết vẫn tiếp tục; xong thì hệ thống đánh thức app:",
      "func application(_ app: UIApplication, handleEventsForBackgroundURLSession id: String,",
      "                 completionHandler: @escaping () -> Void) { saveHandler(completionHandler) }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="req"><div class="nl">📝 App khai báo việc + điều kiện</div><div class="ns">mạng, sạc, không sớm hơn…</div></div>
    <div class="arrow" id="a1">↓ giao cho OS</div>
    <div class="node" id="os"><div class="nl">🔋 OS xếp lịch</div><div class="ns">Doze, Standby Bucket, thói quen dùng app</div></div>
    <div class="arrow" id="a2">↓ đến cửa sổ phù hợp</div>
    <div class="row">
      <div class="node" id="run"><div class="nl">⚙️ Chạy job</div><div class="ns">giới hạn thời gian</div></div>
      <div class="node" id="exp"><div class="nl">⏰ Hết giờ</div><div class="ns">expirationHandler / onStopped</div></div>
    </div>
    <div class="arrow" id="a3">↓ kết quả</div>
    <div class="node" id="done"><div class="nl">✅ success / 🔁 retry</div><div class="ns">job phải idempotent</div></div>
  `,
  steps: [
    { title: "1 · Khai báo, không ra lệnh", tab: "wm", highlight: [8, 9, 10], on: ["req"],
      desc: "Chu kỳ 15 phút là tối thiểu; constraints nói điều kiện; backoff nói cách thử lại." },
    { title: "2 · OS quyết định thời điểm", tab: "wm", highlight: [12], on: ["a1", "os"],
      desc: "Doze và Standby Bucket có thể hoãn job. enqueueUniquePeriodicWork tránh đăng ký trùng." },
    { title: "3 · Chạy và trả kết quả", tab: "wm", highlight: [2, 3, 4, 5], on: ["a2", "run", "done"],
      desc: "Lỗi mạng → Result.retry(); WorkManager tự lên lịch lại kể cả sau khi app bị giết." },
    { title: "4 · Việc người dùng đang thấy", tab: "fgs", highlight: [3, 5, 8, 9], on: ["run"],
      desc: "Foreground service cần notification và (target 34+) khai báo type kèm permission." },
    { title: "5 · iOS: đăng ký & hẹn", tab: "bg", highlight: [1, 4, 5, 6, 12], on: ["req", "os"],
      desc: "Identifier phải có trong Info.plist; earliestBeginDate chỉ là mốc sớm nhất." },
    { title: "6 · Hết giờ phải dừng", tab: "bg", highlight: [6, 7], on: ["exp"],
      desc: "Không gọi setTaskCompleted hoặc không dừng khi expiration → hệ thống giết app và giảm ưu tiên lần sau." },
    { title: "7 · Upload lớn giao cho hệ thống", tab: "url", highlight: [1, 4, 7], on: ["run", "done"],
      desc: "Background URLSession chạy trong process hệ thống, không phụ thuộc app còn sống." }
  ],

  quiz: [
    { q: "PeriodicWorkRequest trong WorkManager có chu kỳ tối thiểu bao nhiêu?", options: [
        "1 phút", "5 phút", "15 phút", "1 giờ"
      ], correct: 2, explanation: "Và thời điểm chạy không chính xác tuyệt đối." },
    { q: "Công việc nào hợp với WorkManager?", options: [
        "Phát nhạc liên tục", "Đồng bộ đơn nháp cần đảm bảo chạy kể cả sau khi app bị giết hoặc máy khởi động lại", "Cập nhật UI mỗi frame", "Animation"
      ], correct: 1, explanation: "WorkManager lưu job bền vững và tôn trọng Doze." },
    { q: "Target Android 14+, khởi động foreground service cần thêm gì?", options: [
        "Không cần gì", "Khai báo foregroundServiceType và permission FOREGROUND_SERVICE_<TYPE> tương ứng", "Root", "Quyền SYSTEM_ALERT_WINDOW"
      ], correct: 1, explanation: "Thiếu sẽ ném exception khi startForeground." },
    { q: "BGAppRefreshTaskRequest.earliestBeginDate nghĩa là gì?", options: [
        "Thời điểm chính xác chạy", "Mốc sớm nhất; hệ thống có thể chạy muộn hơn nhiều hoặc không chạy", "Hạn chót", "Chu kỳ lặp"
      ], correct: 1, explanation: "iOS quyết định dựa trên thói quen dùng app, pin, mạng." },
    { q: "Không xử lý expirationHandler của BGTask thì sao?", options: [
        "Không sao", "Hệ thống có thể giết app và giảm cơ hội chạy nền sau này", "Job chạy vô hạn", "App bị gỡ"
      ], correct: 1, explanation: "Phải dừng việc và setTaskCompleted." },
    { q: "Upload video 500 MB trên iOS nên dùng gì để tiếp tục khi app bị suspend?", options: [
        "URLSession.shared", "URLSessionConfiguration.background + uploadTask từ file", "Timer", "beginBackgroundTask vô hạn"
      ], correct: 1, explanation: "Hệ thống thực hiện truyền tải thay app." },
    { q: "Doze trên Android làm gì?", options: [
        "Tăng tốc CPU", "Khi máy nằm yên, tắt màn: hoãn mạng, job, alarm vào các cửa sổ bảo trì thưa dần", "Xoá cache", "Tắt push hoàn toàn"
      ], correct: 1, explanation: "FCM high priority vẫn có thể đánh thức app." },
    { q: "Silent push (content-available) trên iOS có đảm bảo đánh thức app không?", options: [
        "Có, luôn luôn", "Không — bị điều tiết, và app bị người dùng vuốt tắt thì không được đánh thức", "Chỉ khi app đang mở", "Có nếu gửi nhiều lần"
      ], correct: 1, explanation: "Không dùng silent push làm cơ chế đồng bộ duy nhất." },
    { q: "Thay cho 'poll API mỗi 5 phút' kiểu backend, app mobile nên làm gì?", options: [
        "Dùng Thread.sleep(300000) trong vòng lặp", "Server push khi có thay đổi + đồng bộ khi mở app + job nền cơ hội, idempotent", "Giữ foreground service mãi", "Tắt tối ưu pin"
      ], correct: 1, explanation: "OS không cho chạy nền định kỳ dày đặc." }
  ]
});
