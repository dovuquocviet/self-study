window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Tư duy đo",
  title: "Bản đồ chỉ số hiệu năng mobile",
  subtitle: "Startup cold/warm/hot · TTID/TTFD/TTI · frame & jank · ANR · memory · pin · size · network",

  theory: `
    <p>Backend có latency, throughput, error rate. Mobile có bộ chỉ số riêng, mỗi chỉ số gắn với một cảm giác cụ thể của người dùng.</p>

    <p><strong>1. Khởi động (startup)</strong></p>
    <table>
      <tr><th>Loại</th><th>Trạng thái trước đó</th><th>Việc phải làm</th></tr>
      <tr><td><strong>Cold</strong></td><td>Chưa có process (vừa bật máy, bị hệ thống kill)</td><td>Tạo process, khởi tạo Application/AppDelegate, (RN: load JS bundle), tạo màn hình đầu</td></tr>
      <tr><td><strong>Warm</strong></td><td>Process còn nhưng Activity/màn hình bị huỷ</td><td>Tạo lại Activity/UI, không tạo lại process</td></tr>
      <tr><td><strong>Hot</strong></td><td>Process và Activity còn trong bộ nhớ, app chỉ ở nền</td><td>Đưa lên foreground, vẽ lại</td></tr>
    </table>
    <p>Android vitals coi là <em>quá chậm</em> khi cold ≥ 5 s, warm ≥ 2 s, hot ≥ 1,5 s. Đó là ngưỡng "tệ", không phải mục tiêu — app tốt cold start dưới ~1 s trên máy tầm trung.</p>
    <ul>
      <li><strong>TTID</strong> (time to initial display): tới frame đầu tiên của Activity. Android in dòng <code>Displayed ... +850ms</code> trong logcat.</li>
      <li><strong>TTFD</strong> (time to full display): tới khi nội dung thật (dữ liệu) hiện ra; app tự báo bằng <code>reportFullyDrawn()</code>.</li>
      <li><strong>TTI</strong> (time to interactive): thường dùng trong RN/web — tới khi người dùng chạm được và app phản hồi. RN còn phải tải và chạy JS bundle.</li>
    </ul>

    <p><strong>2. Độ mượt (frame)</strong>: màn hình 60 Hz cho mỗi frame <strong>16,67 ms</strong>; 90 Hz → 11,1 ms; 120 Hz → 8,33 ms.
    Frame trễ hạn = <em>jank</em> (Android) / <em>hitch</em> (iOS). Firebase Performance gọi frame &gt; 16 ms là <em>slow</em>, &gt; 700 ms là <em>frozen</em>.
    Apple đo <em>hitch time ratio</em> (ms hitch trên mỗi giây cuộn): &lt; 5 ms/s tốt, 5–10 cần xem, &gt; 10 ms/s tệ.</p>

    <p><strong>3. Không phản hồi</strong>: Android báo <strong>ANR</strong> khi main thread không xử lý sự kiện input trong <strong>5 giây</strong> (BroadcastReceiver/Service có timeout riêng).
    iOS không có hộp thoại ANR nhưng watchdog kill app nếu launch hoặc chuyển trạng thái quá lâu (mã <code>0x8badf00d</code>); MetricKit báo <em>hang</em>.
    Play Console dùng ngưỡng "hành vi xấu": user-perceived ANR rate 0,47%, crash rate 1,09% — vượt ngưỡng có thể bị giảm hiển thị trên Play.</p>

    <p><strong>4. Bộ nhớ</strong>: peak memory, memory footprint, số lần OOM/jetsam (iOS kill app vì dùng quá RAM). <strong>5. Pin</strong>: CPU khi nền, wakelock, GPS, radio mạng.
    <strong>6. Kích thước app</strong>: download size (ảnh hưởng tỉ lệ cài) và install size. <strong>7. Mạng</strong>: latency request, số request mỗi màn, bytes tải về.</p>

    <div class="callout"><p>💡 Đừng theo dõi tất cả cùng lúc. Chọn 3–4 chỉ số gắn với nghiệp vụ: vd shop app thường là cold start → TTFD trang chủ, độ mượt khi cuộn danh sách,
    ANR/crash rate, và thời gian mở trang sản phẩm.</p></div>
  `,

  codeTabs: [
    { id: "startup", label: "① Startup", lines: [
      "# Android: logcat tự in TTID của Activity",
      "adb logcat | grep Displayed",
      "ActivityTaskManager: Displayed com.shop/.MainActivity: +850ms",
      "",
      "# Đo cold start thủ công (-S: force-stop trước, -W: chờ xong)",
      "adb shell am start -S -W com.shop/.MainActivity",
      "TotalTime: 850",
      "",
      "# TTFD: app tự báo khi dữ liệu thật đã hiện",
      "activity.reportFullyDrawn()   // logcat: Fully drawn com.shop/.MainActivity: +1s420ms"
    ]},
    { id: "frame", label: "② Frame budget", lines: [
      "refresh 60 Hz  → 1000 / 60  = 16.67 ms mỗi frame",
      "refresh 90 Hz  → 1000 / 90  = 11.11 ms",
      "refresh 120 Hz → 1000 / 120 =  8.33 ms",
      "",
      "frame mất 40 ms ở 60 Hz → trễ 2 vsync → người dùng thấy giật",
      "",
      "# Firebase Performance: slow > 16 ms, frozen > 700 ms",
      "# Apple hitch ratio: < 5 ms/s tốt | 5–10 cảnh báo | > 10 tệ"
    ]},
    { id: "anr", label: "③ ANR / hang", lines: [
      "// Android — nguyên nhân ANR kinh điển: I/O trên main thread",
      "override fun onClick(v: View) {",
      "    val json = File(filesDir, \"catalog.json\").readText()   // 30 MB, 3 s",
      "    render(parse(json))",
      "}",
      "// user bấm tiếp mà main thread vẫn bận > 5 s → hộp thoại ANR",
      "",
      "// iOS — watchdog: launch quá lâu → kill, crash report mã 0x8badf00d"
    ]},
    { id: "vitals", label: "④ Ngưỡng Play", lines: [
      "# Android vitals — ngưỡng 'bad behavior' (toàn bộ thiết bị)",
      "user-perceived crash rate  : 1.09%",
      "user-perceived ANR rate    : 0.47%",
      "# theo từng model máy: 8%",
      "",
      "# Startup bị coi là chậm quá mức",
      "cold >= 5 s | warm >= 2 s | hot >= 1.5 s"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="s"><div class="nl">⏱️ Startup</div><div class="ns">cold / warm / hot · TTID · TTFD</div></div>
      <div class="node" id="f"><div class="nl">🎞️ Frame</div><div class="ns">16,67 ms @60Hz · jank · hitch</div></div>
    </div>
    <div class="row">
      <div class="node" id="r"><div class="nl">🧊 Phản hồi</div><div class="ns">ANR 5 s · hang · watchdog</div></div>
      <div class="node" id="m"><div class="nl">🧠 Bộ nhớ</div><div class="ns">peak · OOM · jetsam</div></div>
    </div>
    <div class="row">
      <div class="node" id="b"><div class="nl">🔋 Pin</div><div class="ns">CPU nền · wakelock · radio</div></div>
      <div class="node" id="z"><div class="nl">📦 Size & 🌐 Mạng</div><div class="ns">download size · bytes · số request</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Ba kiểu startup", tab: "startup", highlight: [5, 6, 7], on: ["s"],
      desc: "<code>am start -S</code> force-stop app trước → luôn là cold start. Cold là trường hợp chậm nhất và quan trọng nhất." },
    { title: "2 · TTID vs TTFD", tab: "startup", highlight: [2, 3, 9, 10], on: ["s"],
      desc: "Frame đầu tiên (TTID) có thể chỉ là khung trống. TTFD mới là lúc người dùng thấy dữ liệu — app phải tự gọi <code>reportFullyDrawn()</code>." },
    { title: "3 · Ngân sách mỗi frame", tab: "frame", highlight: [1, 3, 5], on: ["f"],
      desc: "Máy 120 Hz chỉ cho 8,33 ms mỗi frame — code 'vừa đủ' ở 60 Hz có thể giật ở 120 Hz." },
    { title: "4 · ANR = main thread bị chặn", tab: "anr", highlight: [3, 6, 8], on: ["r"],
      desc: "Đọc file 30 MB trên main thread chặn mọi input. Android báo ANR sau 5 s; iOS watchdog kill app nếu launch quá lâu." },
    { title: "5 · Ngưỡng của Google Play", tab: "vitals", highlight: [2, 3, 7], on: ["r", "s"],
      desc: "Vượt ngưỡng hành vi xấu có thể làm app bị giảm hiển thị và bị gắn cảnh báo trên trang Play Store." },
    { title: "6 · Bộ nhớ, pin, size, mạng", tab: "vitals", highlight: [1], on: ["m", "b", "z"],
      desc: "Các chỉ số này ít 'thấy ngay' nhưng gây OOM, bị gỡ app vì hao pin, hoặc giảm tỉ lệ cài vì app quá nặng." }
  ],

  quiz: [
    { q: "Cold start khác warm start ở điểm nào?", options: [
        "Cold start chỉ xảy ra trên iOS",
        "Cold start phải tạo process mới; warm start process vẫn còn, chỉ tạo lại Activity/UI",
        "Warm start luôn chậm hơn cold start",
        "Không khác nhau"
      ], correct: 1, explanation: "Tạo process + khởi tạo app là phần đắt nhất của cold start." },
    { q: "Ở màn hình 120 Hz, ngân sách mỗi frame là bao nhiêu?", options: [
        "16,67 ms", "11,11 ms", "8,33 ms", "33 ms"
      ], correct: 2, explanation: "1000 / 120 ≈ 8,33 ms." },
    { q: "TTFD khác TTID thế nào?", options: [
        "TTFD là lúc frame đầu tiên hiện ra",
        "TTFD là lúc nội dung đầy đủ (dữ liệu thật) hiện ra, app tự báo bằng reportFullyDrawn()",
        "TTFD chỉ có trên iOS",
        "TTFD đo thời gian tải APK"
      ], correct: 1, explanation: "TTID là frame đầu tiên, có thể chỉ là skeleton." },
    { q: "Android báo ANR khi nào (trường hợp input)?", options: [
        "Khi app dùng quá 1 GB RAM",
        "Khi main thread không xử lý sự kiện input trong 5 giây",
        "Khi mạng mất kết nối",
        "Khi app crash"
      ], correct: 1, explanation: "Input dispatch timeout là 5 s." },
    { q: "Mã crash 0x8badf00d trên iOS nghĩa là gì?", options: [
        "Hết bộ nhớ",
        "Watchdog kill app vì mất quá lâu khi launch/chuyển trạng thái (main thread bị chặn)",
        "Lỗi chữ ký",
        "Crash do Swift force unwrap"
      ], correct: 1, explanation: "'ate bad food' — watchdog timeout." },
    { q: "Ngưỡng 'bad behavior' của Android vitals cho user-perceived ANR rate là bao nhiêu?", options: [
        "0,47%", "1,09%", "5%", "10%"
      ], correct: 0, explanation: "1,09% là ngưỡng crash rate; 0,47% là ANR rate." },
    { q: "Firebase Performance coi frame là 'frozen' khi render lâu hơn bao nhiêu?", options: [
        "16 ms", "100 ms", "700 ms", "5 s"
      ], correct: 2, explanation: "Slow > 16 ms, frozen > 700 ms." },
    { q: "Lệnh nào đo cold start Activity trên Android từ dòng lệnh?", options: [
        "adb shell am start -S -W <package>/<activity>",
        "adb install -r app.apk",
        "adb shell pm clear",
        "adb reboot"
      ], correct: 0, explanation: "-S force-stop trước khi start, -W chờ và in TotalTime." },
    { q: "Hitch time ratio 15 ms/s khi cuộn trên iOS được đánh giá thế nào?", options: [
        "Tốt", "Cần xem xét", "Tệ (> 10 ms/s)", "Không liên quan"
      ], correct: 2, explanation: "Apple: < 5 tốt, 5–10 cảnh báo, > 10 tệ." }
  ]
});
