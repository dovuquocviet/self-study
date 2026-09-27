window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Thread & rendering",
  title: "Main thread: một hàng đợi duy nhất, và vì sao chặn nó gây giật / ANR",
  subtitle: "Looper + MessageQueue · RunLoop · 16 ms mỗi frame · ANR 5 giây · watchdog 0x8badf00d",

  theory: `
    <p>Mọi UI toolkit phổ biến (Android View/Compose, UIKit/SwiftUI) đều <strong>đơn luồng</strong>: chỉ <em>main thread</em> (UI thread) được chạm vào view. Main thread thực chất là một vòng lặp vô hạn:</p>
    <ol>
      <li>Lấy một việc từ hàng đợi (touch, callback vòng đời, tin nhắn <code>Handler.post</code>/<code>DispatchQueue.main.async</code>, tín hiệu vẽ frame).</li>
      <li>Chạy việc đó <strong>đến hết</strong>.</li>
      <li>Quay lại bước 1.</li>
    </ol>
    <p>Android gọi là <code>Looper</code> + <code>MessageQueue</code>; iOS gọi là <code>RunLoop</code> (main queue của GCD chạy trên đó). Nếu một việc chạy 800 ms, thì trong 800 ms đó <em>không có frame nào được vẽ và không có chạm nào được xử lý</em>.</p>

    <table>
      <tr><th>Việc chặn main thread</th><th>Hậu quả</th></tr>
      <tr><td>&gt; ~16 ms (màn 60 Hz) hoặc ~8 ms (120 Hz)</td><td>Rớt frame → cuộn giật (jank) — bài 07</td></tr>
      <tr><td>Vài trăm ms</td><td>Người dùng cảm nhận "đơ" (iOS gọi là <em>hang</em>, Xcode Organizer thống kê hang ≥ 250 ms)</td></tr>
      <tr><td>Android: input không được xử lý trong <strong>5 giây</strong></td><td><strong>ANR</strong> — hộp thoại "App không phản hồi"; tỉ lệ ANR cao bị Google Play hạ hiển thị</td></tr>
      <tr><td>Android: BroadcastReceiver <code>onReceive</code> quá lâu (~10 s khi foreground)</td><td>ANR</td></tr>
      <tr><td>iOS: khởi động/đáp ứng sự kiện hệ thống quá lâu</td><td>Watchdog giết app, crash report mã <code>0x8badf00d</code> ("ate bad food")</td></tr>
    </table>

    <p><strong>Những thứ không được làm trên main thread</strong>: gọi mạng (Android ném <code>NetworkOnMainThreadException</code>), đọc/ghi file hoặc DB lớn, parse JSON lớn, giải mã ảnh lớn, mã hoá, <code>Thread.sleep</code>, chờ lock mà thread khác đang giữ.
    Và ngược lại: <strong>chỉ main thread được cập nhật UI</strong> — Android ném <code>CalledFromWrongThreadException</code>, iOS có Main Thread Checker báo lỗi (và UI có thể hỏng ngẫu nhiên).</p>

    <div class="callout"><p>💡 So với Spring MVC: mỗi request có thread riêng trong pool Tomcat (~200 thread), chặn một cái thì chỉ request đó chậm.
    Trên mobile chỉ có <strong>một</strong> main thread cho toàn bộ UI — chặn nó là chặn cả app. Công cụ phát hiện: StrictMode (Android), Main Thread Checker &amp; Instruments Time Profiler / Hangs (iOS).</p></div>
  `,

  codeTabs: [
    { id: "loop", label: "① Vòng lặp main thread", lines: [
      "// Rút gọn từ android.os.Looper.loop()",
      "while (true) {",
      "    val msg = queue.next()        // chặn tới khi có việc",
      "    msg.target.dispatchMessage(msg) // chạy tới HẾT",
      "}",
      "",
      "// iOS: RunLoop tương tự",
      "// repeat { xử lý nguồn sự kiện (touch, timer, main queue) } while app sống",
      "",
      "handler.post { textView.text = \"Xong\" }     // Android: xếp việc vào main queue",
      "DispatchQueue.main.async { label.text = \"Xong\" }   // iOS"
    ]},
    { id: "bad", label: "② Chặn main thread", lines: [
      "button.setOnClickListener {",
      "    val json = URL(\"https://api.shop.vn/cart\").readText()  // NetworkOnMainThreadException",
      "    val bmp  = BitmapFactory.decodeFile(bigPhoto)          // 300 ms giải mã",
      "    db.orderDao().insertAll(orders)                          // Room: lỗi nếu gọi trên main",
      "    Thread.sleep(6000)                                       // -> ANR sau 5 s không xử lý input",
      "}"
    ]},
    { id: "good", label: "③ Đẩy ra nền, về main cập nhật", lines: [
      "// Android — Kotlin coroutines",
      "viewModelScope.launch {                       // bắt đầu trên Main",
      "    val cart = withContext(Dispatchers.IO) {  // nhảy sang pool IO",
      "        api.getCart()",
      "    }",
      "    _state.value = cart                        // quay lại Main tự động",
      "}",
      "",
      "// iOS — Swift concurrency",
      "@MainActor func reload() async {",
      "    let cart = try await api.getCart()   // URLSession không chặn main",
      "    self.cart = cart                     // đang ở MainActor",
      "}"
    ]},
    { id: "detect", label: "④ Phát hiện", lines: [
      "// Android: bật StrictMode ở bản debug",
      "StrictMode.setThreadPolicy(",
      "    StrictMode.ThreadPolicy.Builder()",
      "        .detectDiskReads().detectDiskWrites().detectNetwork()",
      "        .penaltyLog()",
      "        .build()",
      ")",
      "",
      "# ANR traces: adb bugreport  -> xem stack của thread 'main'",
      "# iOS: Xcode Organizer > Hangs, Instruments > Time Profiler / Hangs"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="touch"><div class="nl">👆 Touch</div><div class="ns">sự kiện input</div></div>
      <div class="node" id="vs"><div class="nl">⏱️ Vsync</div><div class="ns">tới giờ vẽ frame</div></div>
      <div class="node" id="post"><div class="nl">📨 post / main.async</div><div class="ns">việc từ thread khác</div></div>
    </div>
    <div class="arrow" id="a1">↓ xếp vào hàng đợi</div>
    <div class="node" id="q"><div class="nl">📬 MessageQueue / RunLoop</div><div class="ns">một hàng duy nhất</div></div>
    <div class="arrow" id="a2">↓ lấy từng việc, chạy tới hết</div>
    <div class="node" id="main"><div class="nl">🧵 Main thread</div><div class="ns">việc dài = mọi thứ phía sau phải chờ</div></div>
    <div class="arrow" id="a3">↓ chờ &gt; 5 s</div>
    <div class="node" id="anr"><div class="nl">🛑 ANR / watchdog</div><div class="ns">app không phản hồi / bị giết</div></div>
  `,
  steps: [
    { title: "1 · Mọi nguồn việc vào một hàng", tab: "loop", highlight: [10, 11], on: ["touch", "vs", "post", "a1", "q"],
      desc: "Touch, tín hiệu vẽ frame và việc từ thread khác đều xếp chung một hàng đợi của main thread." },
    { title: "2 · Chạy từng việc tới hết", tab: "loop", highlight: [2, 3, 4], on: ["a2", "main"],
      desc: "Không có chuyện 'chen ngang': việc hiện tại chưa xong thì việc vẽ frame kế tiếp phải chờ." },
    { title: "3 · Một handler chặn tất cả", tab: "bad", highlight: [2, 3, 4, 5], on: ["main"],
      desc: "Mạng, giải mã ảnh, DB, sleep — mỗi thứ đều khiến frame bị rớt; đủ lâu thì thành ANR." },
    { title: "4 · Hậu quả: ANR", tab: "bad", highlight: [5], on: ["a3", "anr"],
      desc: "Input không được xử lý trong 5 giây → hệ thống hiện hộp thoại ANR. Trên iOS, watchdog có thể giết app." },
    { title: "5 · Cách đúng", tab: "good", highlight: [3, 4, 6, 11, 12], on: ["main"],
      desc: "Làm việc nặng trên thread nền, chỉ quay về main để gán kết quả cho UI (bài 06)." },
    { title: "6 · Bắt lỗi sớm", tab: "detect", highlight: [4, 9, 10], on: ["anr"],
      desc: "StrictMode, Main Thread Checker, Organizer Hangs giúp tìm chỗ chặn trước khi người dùng thấy." }
  ],

  quiz: [
    { q: "Main thread trên Android về bản chất là gì?", options: [
        "Một thread pool 200 thread", "Một vòng lặp Looper lấy từng message từ MessageQueue và chạy tới hết", "Một coroutine", "Một process riêng"
      ], correct: 1, explanation: "Mọi callback UI đều là message được dispatch tuần tự." },
    { q: "Android hiển thị ANR khi input không được xử lý trong bao lâu?", options: [
        "16 ms", "500 ms", "5 giây", "60 giây"
      ], correct: 2, explanation: "Input dispatch timeout là 5 giây." },
    { q: "Gọi HTTP đồng bộ trên main thread Android thì sao?", options: [
        "Chạy bình thường", "NetworkOnMainThreadException", "Tự chuyển sang thread nền", "Chỉ cảnh báo"
      ], correct: 1, explanation: "Từ Android 3.0 hệ thống ném ngoại lệ này (với app target đủ mới)." },
    { q: "Cập nhật TextView từ background thread trên Android thì sao?", options: [
        "Được phép", "CalledFromWrongThreadException", "UI tự đồng bộ", "ANR"
      ], correct: 1, explanation: "Chỉ thread tạo ra view hierarchy (main) được chạm vào view." },
    { q: "Crash report iOS có mã 0x8badf00d nghĩa là gì?", options: [
        "Hết bộ nhớ", "Watchdog giết app vì main thread không phản hồi kịp (vd khởi động quá lâu)", "Lỗi chữ ký", "Null pointer"
      ], correct: 1, explanation: "'Ate bad food' — watchdog timeout." },
    { q: "Màn hình 120 Hz cho main thread bao nhiêu thời gian mỗi frame (xấp xỉ)?", options: [
        "16,7 ms", "8,3 ms", "33 ms", "1 ms"
      ], correct: 1, explanation: "1000 / 120 ≈ 8,3 ms, và còn phải chia với render thread." },
    { q: "Khác biệt cốt lõi giữa chặn thread trong Spring MVC và chặn main thread mobile?", options: [
        "Không khác",
        "Spring mỗi request một thread nên chỉ request đó chậm; mobile chỉ có một main thread cho toàn bộ UI",
        "Mobile có nhiều main thread",
        "Spring không có thread"
      ], correct: 1, explanation: "Chặn main thread là chặn toàn app." },
    { q: "Công cụ nào giúp phát hiện đọc disk trên main thread ở Android?", options: [
        "LeakCanary", "StrictMode ThreadPolicy detectDiskReads", "ProGuard", "Lint baseline"
      ], correct: 1, explanation: "StrictMode ghi log hoặc crash khi phát hiện I/O trên main." },
    { q: "handler.post { ... } / DispatchQueue.main.async { ... } làm gì?", options: [
        "Chạy ngay lập tức, chen trước việc đang chạy",
        "Xếp block vào cuối hàng đợi của main thread, chạy khi tới lượt",
        "Chạy trên thread mới",
        "Chạy khi app về nền"
      ], correct: 1, explanation: "Đó là cách chuẩn để từ thread khác gửi việc về main." }
  ]
});
