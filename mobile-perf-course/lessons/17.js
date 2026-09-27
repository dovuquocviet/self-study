window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Tài nguyên: bộ nhớ, mạng, pin, dung lượng",
  title: "Pin & việc chạy nền: wakelock, WorkManager, BGTaskScheduler",
  subtitle: "CPU, radio, GPS, màn hình · Doze & App Standby · việc nền có ràng buộc · đo năng lượng",

  theory: `
    <p>Người dùng không đọc được "CPU time", nhưng họ thấy app trong mục <em>Pin</em> của Cài đặt — và gỡ app. Bốn thứ tốn pin nhất do app gây ra:
    <strong>CPU</strong> chạy khi không cần, <strong>radio</strong> (mạng di động, bài 16), <strong>GPS</strong> độ chính xác cao, và <strong>màn hình/GPU</strong> (animation vô hạn, refresh rate cao).</p>

    <p><strong>Android</strong></p>
    <ul>
      <li><strong>Doze</strong> và <strong>App Standby Buckets</strong>: khi máy nằm yên, hệ thống gom và trì hoãn việc nền, alarm, mạng của app. Đừng chống lại — thiết kế theo nó.</li>
      <li><strong>WorkManager</strong>: cho việc nền cần đảm bảo chạy (đồng bộ, upload log) với <em>ràng buộc</em>: có mạng không đo lưu lượng (Wi-Fi), đang sạc, pin không yếu. Hệ thống chọn thời điểm tốt.</li>
      <li><strong>Partial wakelock</strong> giữ CPU thức; quên nhả là hao pin nặng. Android vitals theo dõi wakelock kéo dài. Hầu hết trường hợp nên để WorkManager/foreground service quản lý.</li>
      <li>Vị trí: chọn độ chính xác và chu kỳ vừa đủ (<code>Priority.PRIORITY_BALANCED_POWER_ACCURACY</code> thay vì high accuracy), dừng cập nhật khi rời màn.</li>
    </ul>

    <p><strong>iOS</strong>: app bị treo (suspended) gần như ngay khi vào nền. Việc nền đi qua API riêng:</p>
    <ul>
      <li><strong>BGTaskScheduler</strong>: <code>BGAppRefreshTask</code> (cập nhật nội dung ngắn), <code>BGProcessingTask</code> (việc dài, có thể yêu cầu đang sạc/có mạng). Hệ thống quyết định lúc chạy dựa trên thói quen dùng app.</li>
      <li><strong>Background URLSession</strong>: tải/upload do hệ thống thực hiện kể cả khi app bị treo.</li>
      <li>Silent push để báo có dữ liệu mới — bị hệ thống giới hạn tần suất.</li>
    </ul>

    <p><strong>RN</strong> không có phép màu: JS không chạy nền tuỳ ý. Dùng thư viện bọc WorkManager/BGTaskScheduler (vd <code>expo-background-task</code>), và
    đảm bảo khi app vào nền thì dừng timer, polling, animation (<code>AppState</code>).</p>

    <p><strong>Đo</strong>: Android Studio <em>Power Profiler</em> (máy có On-Device Power Monitor, vd Pixel 6 trở lên), <code>adb shell dumpsys batterystats</code>;
    iOS: Energy trong Xcode Organizer, MetricKit (<code>MXCPUMetric</code>, <code>MXLocationActivityMetric</code>, <code>MXCellularConditionMetric</code>...), gauge Energy Impact khi debug.</p>

    <div class="callout"><p>💡 Nguyên tắc: <strong>làm ít hơn, làm gộp, làm khi hệ thống cho phép</strong>. Polling mỗi 30 giây ở nền là mùi code xấu — thay bằng push hoặc WorkManager/BGTask với ràng buộc.</p></div>
  `,

  codeTabs: [
    { id: "wm", label: "① WorkManager", lines: [
      "class SyncOrdersWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {",
      "    override suspend fun doWork(): Result =",
      "        runCatching { repo.syncOrders() }.fold({ Result.success() }, { Result.retry() })",
      "}",
      "",
      "val request = PeriodicWorkRequestBuilder<SyncOrdersWorker>(6, TimeUnit.HOURS)",
      "    .setConstraints(Constraints.Builder()",
      "        .setRequiredNetworkType(NetworkType.UNMETERED)   // Wi-Fi",
      "        .setRequiresBatteryNotLow(true)",
      "        .build())",
      "    .build()",
      "WorkManager.getInstance(ctx)",
      "    .enqueueUniquePeriodicWork(\"sync-orders\", ExistingPeriodicWorkPolicy.KEEP, request)"
    ]},
    { id: "bg", label: "② BGTaskScheduler", lines: [
      "// Info.plist: BGTaskSchedulerPermittedIdentifiers = [\"com.shop.refresh\"]",
      "BGTaskScheduler.shared.register(forTaskWithIdentifier: \"com.shop.refresh\", using: nil) { task in",
      "    let op = Task { await Catalog.refresh() }",
      "    task.expirationHandler = { op.cancel() }            // hệ thống đòi lại thời gian",
      "    Task { _ = await op.value; task.setTaskCompleted(success: true) }",
      "    scheduleRefresh()                                    // lên lịch lần sau",
      "}",
      "",
      "func scheduleRefresh() {",
      "    let req = BGAppRefreshTaskRequest(identifier: \"com.shop.refresh\")",
      "    req.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 3600)   // sớm nhất, không phải chính xác",
      "    try? BGTaskScheduler.shared.submit(req)",
      "}"
    ]},
    { id: "rn", label: "③ RN: dừng khi vào nền", lines: [
      "useEffect(() => {",
      "  let timer = setInterval(refreshCart, 30_000);",
      "  const sub = AppState.addEventListener('change', state => {",
      "    if (state === 'active') {",
      "      refreshCart();",
      "      timer = setInterval(refreshCart, 30_000);",
      "    } else {",
      "      clearInterval(timer);            // không polling khi ở nền",
      "    }",
      "  });",
      "  return () => { clearInterval(timer); sub.remove(); };",
      "}, []);"
    ]},
    { id: "measure", label: "④ Đo năng lượng", lines: [
      "# Android: reset rồi đọc thống kê pin sau khi dùng app",
      "adb shell dumpsys batterystats --reset",
      "# ... dùng app 30 phút theo kịch bản ...",
      "adb shell dumpsys batterystats com.shop > stats.txt",
      "",
      "# Android Studio → Profiler → Power Profiler (máy có ODPM, vd Pixel 6+)",
      "",
      "# iOS: Xcode Organizer → Energy; MetricKit MXCPUMetric, MXLocationActivityMetric",
      "# Debug navigator → Energy Impact khi chạy từ Xcode"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="cpu"><div class="nl">🧮 CPU</div><div class="ns">polling · wakelock</div></div>
      <div class="node" id="radio"><div class="nl">📶 Radio</div><div class="ns">request rải rác</div></div>
      <div class="node" id="gps"><div class="nl">📍 GPS</div><div class="ns">độ chính xác cao</div></div>
    </div>
    <div class="arrow" id="a1">↓ thay bằng</div>
    <div class="row">
      <div class="node" id="wm"><div class="nl">🤖 WorkManager</div><div class="ns">ràng buộc: Wi-Fi, pin, sạc</div></div>
      <div class="node" id="bgt"><div class="nl">🍎 BGTaskScheduler</div><div class="ns">hệ thống chọn thời điểm</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="meas"><div class="nl">🔋 Đo</div><div class="ns">Power Profiler · batterystats · Organizer Energy</div></div>
  `,
  steps: [
    { title: "1 · Việc nền có ràng buộc", tab: "wm", highlight: [6, 7, 8, 9, 13], on: ["cpu", "radio", "a1", "wm"],
      desc: "Đồng bộ 6 giờ một lần, chỉ trên Wi-Fi, khi pin không yếu. KEEP để không tạo trùng khi app mở lại." },
    { title: "2 · Worker trả kết quả rõ ràng", tab: "wm", highlight: [1, 2, 3], on: ["wm"],
      desc: "retry() để hệ thống thử lại với backoff, không tự lặp vô hạn." },
    { title: "3 · iOS: hệ thống quyết định", tab: "bg", highlight: [2, 4, 5, 10, 11, 12], on: ["bgt"],
      desc: "earliestBeginDate chỉ là 'không sớm hơn'. Luôn xử lý expirationHandler và gọi setTaskCompleted." },
    { title: "4 · RN: dừng khi vào nền", tab: "rn", highlight: [3, 4, 8, 11], on: ["cpu"],
      desc: "Polling 30 giây vô hại ở foreground, nhưng ở nền (khi còn được chạy) là hao pin vô ích." },
    { title: "5 · Đo trước và sau", tab: "measure", highlight: [2, 4, 6, 8], on: ["a2", "meas", "gps"],
      desc: "Cùng kịch bản 30 phút, so batterystats hoặc Power Profiler trước/sau khi sửa." }
  ],

  quiz: [
    { q: "Doze trên Android làm gì?", options: [
        "Tăng tốc CPU",
        "Khi máy nằm yên, gom và trì hoãn việc nền, mạng, alarm của app để tiết kiệm pin",
        "Xoá app không dùng",
        "Tắt màn hình"
      ], correct: 1, explanation: "App nên thiết kế theo, không chống lại." },
    { q: "Công cụ nào phù hợp cho việc đồng bộ định kỳ chỉ khi có Wi-Fi trên Android?", options: [
        "Thread + while(true)", "WorkManager với Constraints", "Handler.postDelayed", "AlarmManager chính xác mỗi phút"
      ], correct: 1, explanation: "WorkManager tôn trọng Doze và ràng buộc." },
    { q: "Rủi ro lớn của partial wakelock?", options: [
        "Tăng app size",
        "Quên nhả khiến CPU thức mãi, hao pin nặng",
        "Làm chậm mạng",
        "Làm lộ dữ liệu"
      ], correct: 1, explanation: "Android vitals theo dõi wakelock kéo dài." },
    { q: "earliestBeginDate của BGAppRefreshTaskRequest nghĩa là gì?", options: [
        "Thời điểm chính xác task chạy",
        "Task không chạy sớm hơn thời điểm này; hệ thống quyết định lúc chạy thực tế",
        "Hạn chót phải chạy",
        "Thời gian tối đa của task"
      ], correct: 1, explanation: "iOS dựa vào thói quen dùng app, pin, mạng." },
    { q: "Trên iOS, khi app vào nền thông thường thì code của app thế nào?", options: [
        "Tiếp tục chạy vô hạn",
        "Nhanh chóng bị treo (suspended); việc nền phải dùng API riêng như BGTaskScheduler, background URLSession",
        "Chạy trên server Apple",
        "Chuyển sang watchOS"
      ], correct: 1, explanation: "iOS kiểm soát chặt việc nền." },
    { q: "Trong RN, nên làm gì với timer polling khi app vào nền?", options: [
        "Giữ nguyên",
        "Dừng khi AppState không còn 'active', chạy lại khi active",
        "Tăng tần suất",
        "Chuyển sang setTimeout"
      ], correct: 1, explanation: "Không tốn CPU/radio vô ích." },
    { q: "Power Profiler trong Android Studio yêu cầu gì?", options: [
        "Emulator",
        "Máy có On-Device Power Monitor (ODPM) như Pixel 6 trở lên",
        "Root máy",
        "Không yêu cầu gì"
      ], correct: 1, explanation: "Đo năng lượng thật theo từng rail." },
    { q: "Thay polling server mỗi 30 giây ở nền bằng gì?", options: [
        "Polling mỗi 10 giây",
        "Push notification (hoặc silent push) + việc nền có ràng buộc",
        "Wakelock",
        "Vòng lặp while"
      ], correct: 1, explanation: "Server báo khi có thay đổi." },
    { q: "Ưu tiên vị trí nào tiết kiệm pin hơn cho tính năng 'cửa hàng gần bạn'?", options: [
        "PRIORITY_HIGH_ACCURACY mỗi giây",
        "PRIORITY_BALANCED_POWER_ACCURACY, cập nhật thưa, dừng khi rời màn",
        "Bật GPS liên tục ở nền",
        "Không quan trọng"
      ], correct: 1, explanation: "Độ chính xác cỡ khu phố là đủ." }
  ]
});
