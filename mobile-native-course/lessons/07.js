window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Thread & rendering",
  title: "Rendering pipeline: từ vsync tới điểm ảnh trong 16 ms",
  subtitle: "Vsync · Choreographer · measure/layout/draw · RenderThread · SurfaceFlinger · Core Animation & render server",

  theory: `
    <p>Màn hình quét lại theo nhịp cố định: 60 Hz → mỗi <strong>16,7 ms</strong> một frame; 90 Hz → 11,1 ms; 120 Hz (ProMotion, nhiều máy Android) → <strong>8,3 ms</strong>.
    Mỗi nhịp phát tín hiệu <strong>vsync</strong>. Nếu frame mới chưa sẵn sàng đúng lúc, màn hình hiển thị lại frame cũ → mắt thấy <em>giật</em> (jank/hitch).</p>

    <p><strong>Android (View system)</strong></p>
    <ol>
      <li><strong>Vsync</strong> → <code>Choreographer</code> trên main thread chạy <code>doFrame</code> theo thứ tự: input → animation → traversal.</li>
      <li><strong>Traversal</strong>: <em>measure</em> (mỗi view muốn to bao nhiêu), <em>layout</em> (đặt ở đâu), <em>draw</em> (ghi lệnh vẽ vào <em>display list</em> — chưa vẽ pixel).</li>
      <li><strong>RenderThread</strong> (thread riêng của app) nhận display list, chuyển thành lệnh GPU (OpenGL ES/Vulkan qua HWUI), vẽ vào buffer.</li>
      <li>Buffer được đưa vào <code>BufferQueue</code>; <strong>SurfaceFlinger</strong> (process hệ thống) ghép các lớp (status bar, app, nav bar) và gửi ra màn hình.</li>
    </ol>
    <p>Compose cũng đi qua 3 pha tương tự: <em>Composition</em> (chạy composable, dựng cây UI) → <em>Layout</em> (measure + place) → <em>Drawing</em>; rồi dùng chung RenderThread và SurfaceFlinger.</p>

    <p><strong>iOS (Core Animation)</strong></p>
    <ol>
      <li>Main thread chạy vòng RunLoop; khi có thay đổi, cuối vòng lặp Core Animation <strong>commit transaction</strong>: layout (<code>layoutSubviews</code>), display (<code>draw(_:)</code> nếu có), chuẩn bị (giải mã ảnh), commit cây layer.</li>
      <li>Cây layer được gửi sang <strong>render server</strong> (process hệ thống riêng), dựng ảnh bằng GPU (Metal) và hiển thị ở vsync.</li>
      <li>Apple chia hitch làm hai: <em>commit hitch</em> (app chậm trên main) và <em>render hitch</em> (render server không kịp — thường do hiệu ứng đắt: blur, shadow không có shadowPath, mask, offscreen rendering).</li>
    </ol>

    <table>
      <tr><th>Nguyên nhân rớt frame hay gặp</th><th>Pha bị ảnh hưởng</th></tr>
      <tr><td>Việc nặng trên main thread (JSON, DB, giải mã ảnh)</td><td>Toàn bộ — main không kịp chạy doFrame / commit</td></tr>
      <tr><td>Cây view sâu, layout lồng nhiều lần đo (nested weight, RelativeLayout lồng)</td><td>Measure/Layout</td></tr>
      <tr><td>Recomposition quá rộng (bài 08)</td><td>Composition</td></tr>
      <tr><td>Overdraw, shadow/blur, ảnh lớn hơn khung hiển thị</td><td>GPU / render server</td></tr>
    </table>

    <div class="callout"><p>💡 Ngân sách 16 ms <em>không</em> dành hết cho code của bạn: nó chia cho main thread, render thread/render server và GPU. Thực tế hãy nhắm main thread &lt; ~8 ms ở 60 Hz và nhỏ hơn nữa ở 120 Hz.
    Công cụ: Perfetto / Android Studio Profiler, "Profile HWUI rendering"; Instruments → Animation Hitches, Time Profiler.</p></div>
  `,

  codeTabs: [
    { id: "budget", label: "① Ngân sách frame", lines: [
      "refresh  frame budget",
      "60 Hz    1000/60  = 16.7 ms",
      "90 Hz    1000/90  = 11.1 ms",
      "120 Hz   1000/120 =  8.3 ms",
      "",
      "Frame N:  |--main 6ms--|--render 4ms--|--GPU 3ms--|    ✅ kịp vsync",
      "Frame N+1:|------main 19ms (parse JSON)------|        ❌ lỡ vsync",
      "          -> màn hình hiển thị lại frame N  = jank"
    ]},
    { id: "choreo", label: "② Android: Choreographer", lines: [
      "// Rút gọn: Choreographer.doFrame(frameTimeNanos)",
      "doCallbacks(CALLBACK_INPUT)       // xử lý touch",
      "doCallbacks(CALLBACK_ANIMATION)   // ValueAnimator, Compose animation",
      "doCallbacks(CALLBACK_TRAVERSAL)   // ViewRootImpl.performTraversals():",
      "    performMeasure()  // onMeasure từng view",
      "    performLayout()   // onLayout",
      "    performDraw()     // onDraw -> ghi display list",
      "// -> RenderThread: display list -> lệnh GPU -> BufferQueue",
      "// -> SurfaceFlinger ghép lớp -> màn hình"
    ]},
    { id: "ca", label: "③ iOS: Core Animation", lines: [
      "// Đổi thuộc tính -> được gom vào CATransaction ngầm",
      "cardView.frame.origin.y = 120",
      "cardView.layer.cornerRadius = 12",
      "",
      "// Cuối vòng RunLoop: commit",
      "//   layout  -> layoutSubviews()",
      "//   display -> draw(_:) nếu view tự vẽ",
      "//   prepare -> giải mã ảnh",
      "//   commit  -> gửi cây layer sang render server",
      "",
      "// Tránh render hitch: cho shadow một đường viền sẵn",
      "cardView.layer.shadowPath = UIBezierPath(roundedRect: cardView.bounds, cornerRadius: 12).cgPath"
    ]},
    { id: "tools", label: "④ Đo đạc", lines: [
      "# Android: số frame trễ của app",
      "$ adb shell dumpsys gfxinfo com.shop.app",
      "Total frames rendered: 1840",
      "Janky frames: 97 (5.27%)",
      "",
      "# Android: trace hệ thống chi tiết -> mở ở ui.perfetto.dev",
      "$ adb shell perfetto -o /data/misc/perfetto-traces/t.pftrace -t 10s sched gfx view",
      "",
      "# iOS: Instruments > Animation Hitches / Time Profiler",
      "$ xcrun xctrace record --template 'Animation Hitches' --attach Shop"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vsync"><div class="nl">⏱️ Vsync</div><div class="ns">mỗi 16,7 / 8,3 ms</div></div>
    <div class="arrow" id="a1">↓ Choreographer / cuối RunLoop</div>
    <div class="node" id="main"><div class="nl">🧵 Main: input → animation → measure/layout/draw</div><div class="ns">iOS: commit transaction</div></div>
    <div class="arrow" id="a2">↓ display list / cây layer</div>
    <div class="node" id="rt"><div class="nl">🎨 RenderThread / render server</div><div class="ns">lệnh GPU (Vulkan/GL · Metal)</div></div>
    <div class="arrow" id="a3">↓ buffer</div>
    <div class="node" id="sf"><div class="nl">🧩 SurfaceFlinger / compositor</div><div class="ns">ghép lớp</div></div>
    <div class="arrow" id="a4">↓ vsync kế tiếp</div>
    <div class="node" id="screen"><div class="nl">📱 Màn hình</div><div class="ns">kịp → mượt · trễ → lặp frame cũ</div></div>
  `,
  steps: [
    { title: "1 · Ngân sách thời gian", tab: "budget", highlight: [2, 4], on: ["vsync"],
      desc: "Tần số quét quyết định ngân sách: 16,7 ms ở 60 Hz, chỉ 8,3 ms ở 120 Hz." },
    { title: "2 · Main thread chạy doFrame", tab: "choreo", highlight: [2, 3, 4], on: ["a1", "main"],
      desc: "Choreographer xử lý input, animation, rồi traversal — tất cả trên main thread." },
    { title: "3 · Measure → Layout → Draw", tab: "choreo", highlight: [5, 6, 7], on: ["main"],
      desc: "Draw chỉ ghi lệnh vẽ vào display list; chưa tạo pixel." },
    { title: "4 · Render thread & ghép lớp", tab: "choreo", highlight: [8, 9], on: ["a2", "rt", "a3", "sf"],
      desc: "RenderThread đẩy lệnh cho GPU; SurfaceFlinger ghép các lớp và hiển thị ở vsync." },
    { title: "5 · iOS: commit sang render server", tab: "ca", highlight: [2, 3, 5, 9, 12], on: ["main", "rt"],
      desc: "App commit cây layer; render server (process khác) vẽ bằng Metal. shadowPath giúp tránh offscreen pass đắt." },
    { title: "6 · Lỡ vsync = jank", tab: "budget", highlight: [6, 7, 8], on: ["a4", "screen"],
      desc: "Main mất 19 ms → frame không kịp → màn hình lặp frame cũ. Đo bằng gfxinfo, Perfetto, Animation Hitches." }
  ],

  quiz: [
    { q: "Màn hình 60 Hz cho mỗi frame bao nhiêu thời gian?", options: [
        "8,3 ms", "16,7 ms", "33 ms", "60 ms"
      ], correct: 1, explanation: "1000 ms / 60." },
    { q: "Trên Android, ai điều phối callback input/animation/traversal theo nhịp vsync?", options: [
        "SurfaceFlinger", "Choreographer", "Zygote", "WorkManager"
      ], correct: 1, explanation: "Choreographer nhận vsync và chạy doFrame trên main thread." },
    { q: "Pha draw trong View system làm gì?", options: [
        "Tạo pixel trực tiếp trên màn hình", "Ghi lệnh vẽ vào display list để RenderThread xử lý", "Đo kích thước view", "Gọi API"
      ], correct: 1, explanation: "Hardware acceleration tách ghi lệnh (main) và thực thi lệnh (RenderThread/GPU)." },
    { q: "SurfaceFlinger là gì?", options: [
        "Thư viện ảnh", "Dịch vụ hệ thống ghép các lớp (surface) của nhiều app thành frame cuối cùng", "Thread của app", "Công cụ debug"
      ], correct: 1, explanation: "Compositor của Android." },
    { q: "Trên iOS, khi bạn đổi frame của view, việc render thực tế xảy ra ở đâu?", options: [
        "Ngay trong dòng lệnh đó", "Thay đổi được commit cuối vòng RunLoop, render server (process riêng) vẽ bằng GPU", "Trong AppDelegate", "Trên thread nền do bạn tạo"
      ], correct: 1, explanation: "Core Animation gom thay đổi vào transaction rồi commit." },
    { q: "'Render hitch' trên iOS thường do đâu?", options: [
        "Main thread chạy lâu", "Hiệu ứng đắt cho render server: blur, shadow không có shadowPath, mask/offscreen", "Mạng chậm", "Thiếu permission"
      ], correct: 1, explanation: "Commit hitch là do app; render hitch là do render server không kịp." },
    { q: "Máy chạy 120 Hz nhưng code main thread mất 12 ms mỗi frame. Kết quả?", options: [
        "Mượt", "Lỡ ngân sách 8,3 ms → rớt frame", "Tự động hạ xuống 30 Hz và mượt", "ANR"
      ], correct: 1, explanation: "120 Hz đòi hỏi mỗi frame nhanh gấp đôi so với 60 Hz." },
    { q: "Lệnh nào cho nhanh tỉ lệ janky frames của app Android?", options: [
        "adb logcat", "adb shell dumpsys gfxinfo <package>", "adb install", "gradlew lint"
      ], correct: 1, explanation: "gfxinfo tổng hợp số frame và frame trễ." },
    { q: "Ba pha của một frame trong Jetpack Compose là gì?", options: [
        "Parse → Compile → Run", "Composition → Layout → Drawing", "Input → Network → Draw", "Create → Resume → Destroy"
      ], correct: 1, explanation: "Compose có thể bỏ qua pha không cần (vd chỉ đổi màu thì bỏ qua layout)." }
  ]
});
