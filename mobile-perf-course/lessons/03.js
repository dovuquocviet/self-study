window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Tư duy đo",
  title: "Một frame được vẽ thế nào — main thread, RenderThread, JS thread",
  subtitle: "Vsync & Choreographer · Core Animation render server · RN: JS thread, UI thread, kiến trúc mới (JSI, Fabric)",

  theory: `
    <p>Muốn hiểu vì sao app giật, phải biết <strong>ai làm gì trong 16 ms</strong>. Với dev Spring quen request-per-thread, điểm khác biệt lớn nhất:
    trên mobile có <strong>một</strong> main thread duy nhất được chạm vào UI, và nó phải xong việc trước mỗi nhịp vsync.</p>

    <p><strong>Android</strong></p>
    <ol>
      <li>Phần cứng phát tín hiệu <strong>vsync</strong>; <code>Choreographer</code> đánh thức main thread.</li>
      <li>Main thread: xử lý input → animation → <strong>measure/layout</strong> → <strong>draw</strong> (thực ra là ghi <em>display list</em>, chưa vẽ pixel).</li>
      <li><strong>RenderThread</strong> (từ Android 5) nhận display list, gửi lệnh cho GPU. SurfaceFlinger ghép các lớp và đưa ra màn hình.</li>
    </ol>
    <p>Main thread chậm (parse JSON, query SQLite, layout lồng sâu) → lỡ vsync → frame bị lặp lại → giật. RenderThread chậm (overdraw, shadow/blur nặng, bitmap lớn upload lên GPU) cũng gây giật.</p>

    <p><strong>iOS</strong>: main thread chạy <em>run loop</em>, xử lý sự kiện, chạy layout (Auto Layout / SwiftUI) và <em>commit</em> cây layer (<code>CATransaction</code>) sang
    <strong>render server</strong> — một process riêng của hệ thống — nơi Core Animation render bằng GPU. Hitch xảy ra ở <em>commit phase</em> (main thread làm quá lâu) hoặc <em>render phase</em> (layer quá phức tạp: offscreen rendering, mask, shadow không có path).</p>

    <p><strong>React Native</strong> có thêm tầng JS:</p>
    <table>
      <tr><th></th><th>Kiến trúc cũ (Bridge)</th><th>Kiến trúc mới (mặc định từ 0.76)</th></tr>
      <tr><td>Giao tiếp JS ↔ native</td><td>Bridge bất đồng bộ, serialize JSON theo lô</td><td><strong>JSI</strong>: JS giữ tham chiếu trực tiếp tới đối tượng C++, gọi được đồng bộ</td></tr>
      <tr><td>Render</td><td>UIManager + shadow thread tính layout (Yoga)</td><td><strong>Fabric</strong>: cây shadow bất biến viết bằng C++, layout Yoga, hỗ trợ render đồng bộ và tính năng concurrent của React 18</td></tr>
      <tr><td>Native module</td><td>Khởi tạo hết lúc startup</td><td><strong>TurboModules</strong>: nạp lười khi dùng lần đầu</td></tr>
    </table>
    <p>Trong RN có <strong>hai nơi có thể nghẽn</strong>: JS thread (logic React, re-render, xử lý dữ liệu) và UI thread (native view, layout, animation). Perf Monitor của RN hiển thị FPS riêng cho từng thread —
    UI 60 fps nhưng JS 10 fps nghĩa là chạm vào nút thì phản hồi chậm, còn cuộn native (ScrollView) vẫn mượt.</p>

    <div class="callout"><p>💡 Quy tắc chung cho cả 3 nền tảng: <strong>main/UI thread chỉ dùng để phản hồi người dùng và vẽ</strong>. Mọi I/O, parse, tính toán nặng đưa đi chỗ khác.
    Trong RN, thêm quy tắc: animation liên tục nên chạy trên UI thread (native driver/Reanimated) để không phụ thuộc JS thread.</p></div>
  `,

  codeTabs: [
    { id: "android", label: "① Android pipeline", lines: [
      "vsync ─▶ Choreographer.doFrame()            // main thread",
      "         ├─ input      (onTouchEvent)",
      "         ├─ animation  (ValueAnimator tick)",
      "         ├─ traversal: measure → layout → draw (ghi display list)",
      "         └─ sync display list sang RenderThread",
      "RenderThread ─▶ lệnh OpenGL/Vulkan ─▶ GPU",
      "SurfaceFlinger ─▶ ghép layer ─▶ màn hình",
      "",
      "# Tất cả trên phải xong trong 16.67 ms (60 Hz)"
    ]},
    { id: "ios", label: "② iOS pipeline", lines: [
      "Run loop (main thread)",
      "  ├─ event (touch)",
      "  ├─ layout: layoutSubviews / SwiftUI body + layout",
      "  ├─ display: draw(_:) nếu có",
      "  └─ commit CATransaction ─▶ render server (process riêng)",
      "render server ─▶ GPU ─▶ màn hình",
      "",
      "# Commit hitch: main thread quá chậm",
      "# Render hitch: layer quá phức tạp (offscreen: mask, shadow không có shadowPath)"
    ]},
    { id: "rn", label: "③ React Native", lines: [
      "// JS thread: chạy React (render, diff), logic, gọi native qua JSI",
      "setState(...)  ─▶ React render ─▶ commit cây mới",
      "",
      "// Fabric (C++): shadow tree + Yoga layout",
      "// UI thread: mount — tạo/cập nhật native view (UIView / android.view.View)",
      "",
      "// JS thread bận 200 ms (vòng lặp nặng):",
      "for (const p of products) heavyFormat(p)   // chạm nút không phản hồi",
      "// nhưng ScrollView native vẫn cuộn được (UI thread rảnh)"
    ]},
    { id: "perfmon", label: "④ Perf Monitor RN", lines: [
      "# Mở Dev Menu (Cmd+D / Cmd+M / lắc máy) → 'Perf Monitor'",
      "UI  : 60 fps   ← UI thread",
      "JS  : 12 fps   ← JS thread đang nghẽn",
      "",
      "# Đọc kết quả:",
      "# UI thấp, JS cao  → vấn đề native: layout nặng, ảnh lớn, overdraw",
      "# JS thấp, UI cao  → vấn đề JS: re-render thừa, xử lý dữ liệu nặng",
      "# Lưu ý: đây là dev build — chỉ dùng để khoanh vùng, không làm số liệu báo cáo"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vs"><div class="nl">⏲️ Vsync (mỗi 16,67 ms)</div><div class="ns">Choreographer / CADisplayLink</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="js"><div class="nl">🟨 JS thread (RN)</div><div class="ns">React render, logic</div></div>
      <div class="node" id="main"><div class="nl">🧵 Main / UI thread</div><div class="ns">input · layout · draw/commit</div></div>
    </div>
    <div class="arrow" id="a2">↓ display list / CATransaction</div>
    <div class="node" id="rt"><div class="nl">🎨 RenderThread / render server</div><div class="ns">lệnh GPU</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="gpu"><div class="nl">🖥️ GPU → màn hình</div><div class="ns">lỡ vsync = frame lặp = giật</div></div>
  `,
  steps: [
    { title: "1 · Vsync khởi động một frame", tab: "android", highlight: [1], on: ["vs", "a1"],
      desc: "Choreographer (Android) / CADisplayLink (iOS) gắn công việc vào nhịp vsync." },
    { title: "2 · Main thread: input → layout → draw", tab: "android", highlight: [2, 3, 4, 5], on: ["main"],
      desc: "Draw trên Android chỉ ghi display list. Nếu phần này > 16 ms thì lỡ vsync." },
    { title: "3 · RenderThread / GPU", tab: "android", highlight: [6, 7], on: ["a2", "rt", "a3", "gpu"],
      desc: "Việc vẽ pixel diễn ra ngoài main thread. Overdraw, blur, bitmap lớn làm phần này chậm." },
    { title: "4 · iOS: commit sang render server", tab: "ios", highlight: [3, 5, 8, 9], on: ["main", "rt"],
      desc: "Hai loại hitch: commit (main thread chậm) và render (layer phức tạp, offscreen rendering)." },
    { title: "5 · RN: thêm JS thread", tab: "rn", highlight: [1, 2, 4, 5], on: ["js", "main"],
      desc: "React chạy trên JS thread, Fabric tính layout bằng C++, UI thread mount view native." },
    { title: "6 · Khoanh vùng thread nghẽn", tab: "perfmon", highlight: [2, 3, 6, 7], on: ["js", "main"],
      desc: "JS 12 fps, UI 60 fps → nút bấm phản hồi chậm nhưng cuộn vẫn mượt: nghẽn ở JS, cần profile JS." }
  ],

  quiz: [
    { q: "Trên Android, bước 'draw' trên main thread thực sự làm gì?", options: [
        "Vẽ trực tiếp pixel ra màn hình",
        "Ghi display list; RenderThread mới gửi lệnh tới GPU",
        "Tải ảnh từ mạng",
        "Chạy garbage collector"
      ], correct: 1, explanation: "Từ Android 5, việc vẽ bằng GPU diễn ra trên RenderThread." },
    { q: "Thành phần nào đánh thức main thread Android theo nhịp vsync?", options: [
        "Looper.prepare()", "Choreographer", "WorkManager", "ActivityManager"
      ], correct: 1, explanation: "Choreographer.doFrame() chạy mỗi vsync." },
    { q: "Trên iOS, render server là gì?", options: [
        "Một thread trong app",
        "Một process riêng của hệ thống nhận cây layer đã commit và render bằng GPU",
        "Server backend của Apple",
        "Tên khác của main thread"
      ], correct: 1, explanation: "App commit CATransaction; render server làm phần render." },
    { q: "Trong kiến trúc mới của RN, JSI thay thế điều gì?", options: [
        "Hermes",
        "Bridge bất đồng bộ serialize JSON — JSI cho JS giữ tham chiếu tới đối tượng C++ và gọi đồng bộ",
        "Metro bundler",
        "Yoga"
      ], correct: 1, explanation: "JSI bỏ lớp serialize của Bridge." },
    { q: "TurboModules cải thiện startup chủ yếu nhờ gì?", options: [
        "Nén bundle",
        "Nạp native module lười — chỉ khởi tạo khi dùng lần đầu",
        "Dùng GPU",
        "Bỏ JS thread"
      ], correct: 1, explanation: "Kiến trúc cũ khởi tạo mọi module lúc startup." },
    { q: "Perf Monitor RN: UI 60 fps, JS 10 fps. Triệu chứng dễ thấy nhất là gì?", options: [
        "ScrollView native không cuộn được",
        "Chạm nút, cập nhật state phản hồi chậm; nhưng cuộn native vẫn mượt",
        "App crash",
        "Ảnh không hiện"
      ], correct: 1, explanation: "Logic React nằm trên JS thread đang nghẽn." },
    { q: "Nguyên nhân nào gây 'render hitch' (không phải commit hitch) trên iOS?", options: [
        "Parse JSON trên main thread",
        "Layer cần offscreen rendering: mask, shadow không có shadowPath",
        "Gọi API mạng",
        "Đọc UserDefaults"
      ], correct: 1, explanation: "Render hitch nằm ở phía render server/GPU." },
    { q: "Kiến trúc mới của RN là mặc định từ phiên bản nào?", options: [
        "0.60", "0.68", "0.76", "1.0"
      ], correct: 2, explanation: "0.68 cho bật thử; 0.76 bật mặc định." },
    { q: "Quy tắc chung đúng cho cả Android, iOS, RN?", options: [
        "Mọi việc nên chạy trên main thread cho đơn giản",
        "Main/UI thread chỉ dùng để phản hồi người dùng và vẽ; I/O, parse, tính toán nặng đưa ra thread khác",
        "Chỉ dùng một thread",
        "Luôn tạo thread mới cho mỗi view"
      ], correct: 1, explanation: "Main thread bận = lỡ vsync, chậm phản hồi, ANR." }
  ]
});
