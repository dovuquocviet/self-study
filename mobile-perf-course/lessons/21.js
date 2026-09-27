window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Quy trình & quyết định",
  title: "Tổng kết: bản đồ triệu chứng → công cụ → cách sửa",
  subtitle: "Checklist theo chỉ số · quy trình điều tra một ca chậm · mẫu PR tối ưu · ôn tập toàn khoá",

  theory: `
    <p>Toàn khoá gói lại trong một câu: <strong>đo trên bản release ở máy thật → tìm nút thắt bằng trace → sửa một thứ → đo lại → chặn tái phát bằng CI → xác nhận bằng field</strong>.</p>

    <p><strong>Bảng tra triệu chứng</strong></p>
    <table>
      <tr><th>Triệu chứng</th><th>Công cụ đầu tiên</th><th>Nghi phạm thường gặp</th><th>Bài</th></tr>
      <tr><td>Mở app lâu</td><td>Macrobenchmark / App Launch / mốc TTI</td><td>Init SDK eager, ContentProvider, I/O main thread, bundle JS lớn, chờ API</td><td>08, 09</td></tr>
      <tr><td>Cuộn giật</td><td>Perfetto / Hitches / Perf Monitor</td><td>Ảnh gốc to, bind nặng, FlatList không tái sử dụng, re-render thừa</td><td>12, 13, 11</td></tr>
      <tr><td>Chạm không phản hồi / ANR</td><td>Trace main thread, StrictMode, Hangs</td><td>I/O, parse, lock trên main; JS thread bận</td><td>10</td></tr>
      <tr><td>Animation khựng</td><td>Perf Monitor, Layout Inspector (recomposition)</td><td>Animation trên JS thread, animate layout, đọc state sớm</td><td>14</td></tr>
      <tr><td>App tự tắt khi dùng lâu</td><td>LeakCanary, Allocations, heap snapshot</td><td>Leak Activity/VC, retain cycle, listener không huỷ, bitmap lớn</td><td>15, 13</td></tr>
      <tr><td>Màn chờ dữ liệu lâu</td><td>Proxy / network inspector</td><td>Waterfall, không cache, payload to</td><td>16</td></tr>
      <tr><td>Hao pin</td><td>Power Profiler, batterystats, Organizer Energy</td><td>Polling, wakelock, GPS chính xác cao</td><td>17</td></tr>
      <tr><td>App nặng</td><td>APK Analyzer, Thinning report</td><td>Không R8, APK universal, asset lớn, SDK thừa</td><td>18</td></tr>
    </table>

    <p><strong>Các con số nên thuộc</strong>: 16,67 ms/frame @60 Hz (8,33 ms @120 Hz) · ANR 5 s · hang ≥ 250 ms · frozen frame &gt; 700 ms · Android vitals: ANR 0,47%, crash 1,09%, cold start chậm ≥ 5 s ·
    bitmap = rộng × cao × 4 byte · FlatList <code>windowSize</code> mặc định 21.</p>

    <p><strong>Với lộ trình của công ty</strong></p>
    <ul>
      <li><strong>Hôm nay (RN)</strong>: đặt custom trace cho các hành trình chính, bật kiến trúc mới + Hermes, FlashList, expo-image, Reassure trong CI. Đây vừa là cải thiện ngay, vừa là baseline.</li>
      <li><strong>Khi chuyển native</strong>: dùng cùng kịch bản và công cụ đo từ bên ngoài (Macrobenchmark, XCTest), thêm Baseline Profiles từ ngày đầu, và so sánh có phương pháp (bài 20).</li>
    </ul>

    <div class="callout"><p>💡 Kỹ sư khác "thợ" ở chỗ: khi ai đó nói "app chậm", bạn hỏi lại "chậm ở kịch bản nào, trên máy nào, p90 bao nhiêu, trace cho thấy thời gian đi đâu?" — rồi mới mở editor.</p></div>
  `,

  codeTabs: [
    { id: "flow", label: "① Quy trình điều tra", lines: [
      "1. Tái hiện : kịch bản + máy + build release     → 'mở chi tiết SP mất 1.9 s trên A14'",
      "2. Đo        : 15 lượt, median/p90                → baseline 1.9 s / 2.3 s",
      "3. Khoanh vùng: JS hay native? main hay render?    → Perf Monitor: JS 15 fps",
      "4. Trace     : React Profiler + Hermes profiler    → 1 commit 420 ms, formatVariants()",
      "5. Giả thuyết: format 300 biến thể mỗi render      → useMemo / server trả sẵn",
      "6. Sửa 1 thứ, đo lại                               → 1.3 s / 1.5 s",
      "7. Chặn tái phát: Reassure test + custom trace field"
    ]},
    { id: "pr", label: "② Mẫu PR tối ưu", lines: [
      "## Perf: màn chi tiết sản phẩm nhanh hơn 32%",
      "Kịch bản : chạm SP → chi tiết đủ dữ liệu (mốc 'pdp_ready')",
      "Thiết bị : Galaxy A14, iPhone 11 — release, API mock",
      "Số lượt  : 15 mỗi bên",
      "",
      "| máy      | trước median/p90 | sau median/p90 |",
      "| A14      | 1900 / 2300 ms   | 1290 / 1510 ms |",
      "| iPhone11 |  980 / 1150 ms   |  700 /  820 ms |",
      "",
      "Nguyên nhân: formatVariants() chạy mỗi render (trace đính kèm)",
      "Chống tái phát: ProductDetail.perf-test.tsx (Reassure)"
    ]},
    { id: "check", label: "③ Checklist nhanh", lines: [
      "[ ] Đo release, máy thật tầm trung, ≥ 10 lượt, median + p90",
      "[ ] Application/AppDelegate chỉ init thứ bắt buộc; còn lại lười/nền",
      "[ ] Baseline Profile (Android); ít dynamic framework (iOS); Hermes + inline requires (RN)",
      "[ ] Không I/O, parse, lock trên main thread; StrictMode ở debug",
      "[ ] List: key ổn định, cell nhẹ, recycling (FlashList/RecyclerView), ảnh đúng cỡ",
      "[ ] Animation: transform/opacity, UI thread (Reanimated/native driver)",
      "[ ] Không leak: cleanup listener/timer, [weak self], LeakCanary",
      "[ ] Mạng: song song/BFF, cache + ETag, prefetch, 1 client dùng chung",
      "[ ] Nền: WorkManager/BGTask có ràng buộc, không polling",
      "[ ] Size: R8 + shrinkResources, AAB, Asset Catalog, ngân sách",
      "[ ] CI: benchmark startup + scroll, Reassure, size check; field: vitals/MetricKit/Firebase"
    ]}
  ],

  stageHtml: `
    <div class="node" id="s1"><div class="nl">🎯 Kịch bản + máy + release</div><div class="ns">tái hiện được</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="s2"><div class="nl">📏 Baseline</div><div class="ns">median · p90</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="s3"><div class="nl">🔬 Khoanh vùng + trace</div><div class="ns">JS / main / render / mạng</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="s4"><div class="nl">🔧 Sửa một thứ → đo lại</div><div class="ns">chênh lệch &gt; nhiễu</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="s5"><div class="nl">🛡️ CI + field</div><div class="ns">chặn tái phát · xác nhận thực tế</div></div>
  `,
  steps: [
    { title: "1 · Tái hiện & đo", tab: "flow", highlight: [1, 2], on: ["s1", "a1", "s2"],
      desc: "Không có kịch bản tái hiện được thì không có gì để đo, cũng không chứng minh được đã sửa." },
    { title: "2 · Khoanh vùng rồi trace", tab: "flow", highlight: [3, 4], on: ["a2", "s3"],
      desc: "Perf Monitor/thread state chỉ ra tầng nghẽn; profiler của tầng đó chỉ ra hàm cụ thể." },
    { title: "3 · Sửa và chứng minh", tab: "flow", highlight: [5, 6], on: ["a3", "s4"],
      desc: "Giả thuyết cụ thể, sửa một thứ, số sau rõ ràng lớn hơn nhiễu." },
    { title: "4 · Chặn tái phát", tab: "flow", highlight: [7], on: ["a4", "s5"],
      desc: "Test trong CI bắt regression trước khi merge; custom trace field xác nhận người dùng thật hưởng lợi." },
    { title: "5 · Viết PR có số liệu", tab: "pr", highlight: [2, 3, 4, 7, 8, 10, 11], on: ["s4", "s5"],
      desc: "Người review thấy ngay kịch bản, thiết bị, số lượt, trước/sau và cơ chế chống tái phát." },
    { title: "6 · Checklist khi review", tab: "check", highlight: [1, 4, 5, 11], on: ["s1", "s3", "s5"],
      desc: "Dùng như danh sách kiểm tra khi thiết kế màn mới hoặc review PR." }
  ],

  quiz: [
    { q: "Bước đầu tiên khi nhận phản ánh 'app chậm'?", options: [
        "Viết lại bằng native",
        "Xác định kịch bản cụ thể, thiết bị, build release và đo baseline",
        "Thêm useMemo khắp nơi",
        "Tăng RAM máy test"
      ], correct: 1, explanation: "Không có baseline thì không biết sửa có tác dụng." },
    { q: "Cuộn danh sách giật, bộ nhớ nhảy mạnh khi cuộn. Nghi phạm số 1?", options: [
        "Font", "Ảnh decode ở kích thước gốc", "Mạng chậm", "R8"
      ], correct: 1, explanation: "Bitmap = rộng × cao × 4 byte." },
    { q: "Perf Monitor: JS 15 fps, UI 60 fps. Công cụ tiếp theo?", options: [
        "Perfetto system trace", "React Profiler / Hermes profiler", "APK Analyzer", "Power Profiler"
      ], correct: 1, explanation: "Nghẽn ở JS thread." },
    { q: "Ngân sách frame ở màn hình 60 Hz?", options: [
        "8,33 ms", "16,67 ms", "33 ms", "100 ms"
      ], correct: 1, explanation: "1000 / 60." },
    { q: "App Android bị ANR khi bấm nút. Thủ phạm điển hình?", options: [
        "Ảnh WebP",
        "I/O, parse hoặc chờ lock trên main thread",
        "Dùng Compose",
        "R8 bật"
      ], correct: 1, explanation: "Main thread không xử lý input trong 5 s." },
    { q: "Baseline Profiles cải thiện điều gì?", options: [
        "App size", "Tốc độ thực thi từ lần chạy đầu nhờ AOT các đường code quan trọng", "Pin khi nền", "Mạng"
      ], correct: 1, explanation: "Không phải chờ JIT." },
    { q: "Retain cycle giữa ViewController và closure được phá bằng?", options: [
        "[weak self]", "DispatchQueue.main", "@MainActor", "lazy var"
      ], correct: 0, explanation: "Cắt tham chiếu mạnh từ closure." },
    { q: "Màn gọi 5 API độc lập tuần tự. Cách sửa nhanh nhất ở client?", options: [
        "Gọi song song (Promise.all / async let)", "Tăng timeout", "Thêm retry", "Dùng HTTP/1.0"
      ], correct: 0, explanation: "Giảm số RTT phải chờ; lâu dài có thể làm BFF." },
    { q: "Animation dùng Animated với useNativeDriver: true có ưu điểm gì?", options: [
        "Animate được height",
        "Chạy trên UI thread, không phụ thuộc JS thread mỗi frame",
        "Không cần GPU",
        "Giảm bundle"
      ], correct: 1, explanation: "Chỉ cho transform/opacity." },
    { q: "Cách nào đúng cho việc đồng bộ nền định kỳ trên Android?", options: [
        "while(true) + sleep",
        "WorkManager với Constraints (mạng, pin)",
        "Wakelock giữ suốt",
        "Service chạy mãi"
      ], correct: 1, explanation: "Tôn trọng Doze, hệ thống chọn thời điểm." },
    { q: "Công cụ nào bắt re-render thừa trong PR của app RN?", options: [
        "LeakCanary", "Reassure", "bundletool", "Instruments Leaks"
      ], correct: 1, explanation: "Đo thời gian và số lần render so với baseline." },
    { q: "Khi chứng minh native nhanh hơn RN, điều nào là SAI phương pháp?", options: [
        "Cùng tính năng và dữ liệu mock",
        "So bản native release với bản RN debug",
        "Xen kẽ lượt chạy",
        "Báo median, p90 và khoảng tin cậy"
      ], correct: 1, explanation: "Phải cùng loại build (release)." },
    { q: "Ngưỡng user-perceived ANR rate 'bad behavior' của Android vitals?", options: [
        "0,47%", "1,09%", "5%", "8%"
      ], correct: 0, explanation: "1,09% là crash rate; 8% là ngưỡng theo từng model máy." },
    { q: "Vì sao R8 cần keep rules?", options: [
        "Để tăng tốc build",
        "Code truy cập qua reflection có thể bị xoá/đổi tên vì R8 không thấy tham chiếu tĩnh",
        "Để giảm ảnh",
        "Bắt buộc với iOS"
      ], correct: 1, explanation: "Serialization, DI dựa trên reflection, một số SDK." },
    { q: "Lab benchmark và dữ liệu field khác vai trò thế nào?", options: [
        "Giống nhau",
        "Lab ổn định để so trước/sau và chặn regression; field phản ánh thực tế người dùng và xác nhận cải thiện",
        "Field thay thế lab",
        "Lab chỉ dùng cho iOS"
      ], correct: 1, explanation: "Cần cả hai." }
  ]
});
