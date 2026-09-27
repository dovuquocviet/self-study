window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Quy trình & quyết định",
  title: "Đo trên máy thật & chặn regression trong CI",
  subtitle: "Máy thật vs emulator · giảm nhiễu · baseline & ngưỡng · Macrobenchmark/XCTest trong CI · Reassure, Flashlight cho RN · ngân sách size",

  theory: `
    <p>Tối ưu một lần rồi để đó thì vài tháng sau app lại chậm: mỗi PR thêm một chút. Backend có load test/SLO trong pipeline; mobile cần <strong>performance test tự động</strong> tương tự.</p>

    <p><strong>Máy thật hay emulator?</strong> Emulator/Simulator tốt cho test chức năng, nhưng số hiệu năng không đại diện (CPU của máy chủ, GPU giả lập).
    Macrobenchmark mặc định báo lỗi khi chạy trên emulator. Lựa chọn: máy thật cắm vào runner tự quản, hoặc device farm (Firebase Test Lab, AWS Device Farm, BrowserStack...).
    Chọn <strong>máy tầm thấp–trung</strong> đại diện người dùng.</p>

    <p><strong>Giảm nhiễu</strong></p>
    <ul>
      <li>Cùng một máy cho baseline và lần đo mới; tắt cập nhật tự động, chế độ máy bay (hoặc mock mạng), pin đủ, nhiệt độ ổn định (để máy nguội giữa các lượt).</li>
      <li>Khoá xung CPU trên máy đã root (thư viện benchmark có task <code>lockClocks</code>) — tuỳ chọn, giảm dao động nhiều.</li>
      <li>Nhiều lần lặp, báo median; mock mạng/dữ liệu cố định để đo app, không đo server.</li>
    </ul>

    <p><strong>Baseline và ngưỡng</strong>: lưu kết quả của nhánh main làm baseline; PR chỉ fail khi chậm hơn <em>vượt ngưỡng</em> (vd median startup tệ hơn 10% hoặc &gt; 50 ms) — ngưỡng phải lớn hơn độ nhiễu đã đo,
    nếu không CI sẽ "kêu sói" và mọi người bỏ qua. Theo dõi xu hướng theo thời gian (dashboard) để thấy các lần chậm đi nhỏ cộng dồn.</p>

    <table>
      <tr><th>Tầng</th><th>Công cụ</th><th>Bắt được</th></tr>
      <tr><td>Android</td><td>Macrobenchmark (startup, frame timing), xuất JSON</td><td>Startup, jank khi cuộn</td></tr>
      <tr><td>iOS</td><td>XCTest <code>measure(metrics:)</code> với baseline trong Xcode, <code>xcodebuild test</code></td><td>Launch, CPU, memory, thời gian đoạn signpost</td></tr>
      <tr><td>RN component</td><td><strong>Reassure</strong> (Callstack): chạy trong Jest, đo thời gian và <em>số lần render</em>, so với nhánh baseline</td><td>Re-render thừa mới xuất hiện</td></tr>
      <tr><td>RN app (Android)</td><td><strong>Flashlight</strong>: chạy kịch bản (vd Maestro), đo FPS/CPU/RAM, cho điểm</td><td>Jank, CPU tăng</td></tr>
      <tr><td>Size</td><td>So kích thước AAB/IPA với ngân sách</td><td>Thêm SDK nặng</td></tr>
    </table>

    <div class="callout"><p>💡 Bắt đầu nhỏ: <strong>một</strong> benchmark cold start + <strong>một</strong> benchmark cuộn danh sách chính + kiểm tra size. Chạy hằng đêm trên main trước; khi đủ ổn định mới gắn vào từng PR.</p></div>
  `,

  codeTabs: [
    { id: "gha", label: "① Pipeline CI", lines: [
      "# Chạy hằng đêm trên runner có máy Android thật cắm sẵn",
      "./gradlew :app:assembleBenchmark :macrobenchmark:assembleBenchmark",
      "./gradlew :macrobenchmark:connectedCheck        # chạy mọi benchmark trên máy đang cắm",
      "# (emulator: phải thêm ...androidx.benchmark.suppressErrors=EMULATOR — số không đại diện)",
      "",
      "# Kết quả JSON: build/outputs/connected_android_test_additional_output/.../*benchmarkData.json",
      "python3 scripts/compare_bench.py --baseline main.json --current pr.json --max-regression 0.10",
      "",
      "# Kiểm tra ngân sách size",
      "bundletool get-size total --apks=app.apks | tail -1   # so với 30 MB"
    ]},
    { id: "compare", label: "② So sánh có ngưỡng", lines: [
      "def check(metric, base, cur, max_reg=0.10, min_abs_ms=50):",
      "    delta = cur['median'] - base['median']",
      "    if delta > max(base['median'] * max_reg, min_abs_ms):",
      "        fail(f'{metric}: {base[\"median\"]} → {cur[\"median\"]} ms (+{delta})')",
      "",
      "# startup cold  base 648 ms, PR 731 ms → +83 ms > max(64.8, 50) → FAIL",
      "# scroll p90    base 11.2 ms, PR 11.9 ms → +0.7 ms → OK (trong nhiễu)"
    ]},
    { id: "reassure", label: "③ Reassure (RN)", lines: [
      "// ProductList.perf-test.tsx",
      "import { measureRenders } from 'reassure';",
      "import { fireEvent, screen } from '@testing-library/react-native';",
      "",
      "test('gõ tìm kiếm không render lại cả danh sách', async () => {",
      "  const scenario = async () => {",
      "    fireEvent.changeText(screen.getByTestId('search'), 'giày');",
      "  };",
      "  await measureRenders(<ProductListScreen products={fixture} />, { scenario });",
      "});",
      "",
      "# CI: chạy trên nhánh baseline rồi nhánh PR, Reassure so sánh",
      "# kết quả: 'ProductListScreen: render count 3 → 52 (+49)' ← regression"
    ]},
    { id: "xct", label: "④ XCTest trong CI", lines: [
      "func testScrollCatalog() {",
      "    let app = XCUIApplication()",
      "    app.launch()",
      "    let opts = XCTMeasureOptions(); opts.iterationCount = 10",
      "    measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric], options: opts) {",
      "        app.collectionViews.firstMatch.swipeUp(velocity: .fast)",
      "    }",
      "}",
      "",
      "# xcodebuild test -scheme ShopPerf -destination 'platform=iOS,name=CI iPhone 12'",
      "# Baseline lưu theo từng loại máy trong .xcbaseline của project"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pr"><div class="nl">🔀 PR mới</div><div class="ns">thêm tính năng / SDK</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="dev"><div class="nl">📱 Máy thật tầm trung</div><div class="ns">release · mạng mock · máy nguội</div></div>
      <div class="node" id="bench"><div class="nl">🏃 Benchmark lặp N lần</div><div class="ns">Macrobenchmark · XCTest · Reassure</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="cmp"><div class="nl">⚖️ So với baseline main</div><div class="ns">ngưỡng &gt; nhiễu</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">✅ Merge</div><div class="ns">cập nhật dashboard</div></div>
      <div class="node" id="fail"><div class="nl">❌ Fail</div><div class="ns">kèm trace để điều tra</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Chạy trên máy thật", tab: "gha", highlight: [1, 2, 3], on: ["pr", "a1", "dev"],
      desc: "Build variant benchmark (giống release). Emulator chỉ dùng khi chấp nhận số không đại diện." },
    { title: "2 · Lặp và xuất JSON", tab: "gha", highlight: [6, 7], on: ["bench"],
      desc: "Macrobenchmark ghi min/median/max và trace; script so sánh với kết quả của main." },
    { title: "3 · Ngưỡng lớn hơn nhiễu", tab: "compare", highlight: [2, 3, 6, 7], on: ["a2", "cmp"],
      desc: "Chỉ fail khi chậm hơn cả 10% lẫn 50 ms. Scroll +0,7 ms nằm trong nhiễu nên không fail." },
    { title: "4 · RN: Reassure đếm render", tab: "reassure", highlight: [2, 7, 9, 13], on: ["bench", "cmp"],
      desc: "Số lần render là chỉ số ổn định hơn thời gian — nhảy từ 3 lên 52 là regression rõ ràng." },
    { title: "5 · iOS: XCTest + baseline", tab: "xct", highlight: [4, 5, 10, 11], on: ["dev", "bench"],
      desc: "Baseline lưu theo từng loại máy; test fail khi kết quả vượt baseline quá độ lệch cho phép." },
    { title: "6 · Kết quả", tab: "gha", highlight: [10], on: ["a3", "ok", "fail"],
      desc: "Fail phải kèm trace/số liệu để dev điều tra ngay; pass thì cập nhật dashboard xu hướng." }
  ],

  quiz: [
    { q: "Vì sao không dùng số hiệu năng đo trên emulator làm căn cứ chính?", options: [
        "Emulator không chạy được app",
        "Emulator dùng CPU/GPU của máy chủ, không đại diện phần cứng người dùng",
        "Emulator luôn chậm hơn đúng 2 lần",
        "Vì Google cấm"
      ], correct: 1, explanation: "Macrobenchmark mặc định báo lỗi khi chạy trên emulator." },
    { q: "Ngưỡng fail trong CI nên được đặt thế nào?", options: [
        "Fail khi chậm hơn 1 ms",
        "Lớn hơn độ nhiễu đã đo (vd cả % tương đối lẫn ms tuyệt đối)",
        "Không đặt ngưỡng",
        "Tuỳ ý mỗi lần"
      ], correct: 1, explanation: "Ngưỡng quá nhạy → báo động giả → mọi người bỏ qua CI." },
    { q: "Reassure đo những gì?", options: [
        "Kích thước APK",
        "Thời gian render và số lần render của component React trong Jest, so với baseline",
        "Pin",
        "Mạng"
      ], correct: 1, explanation: "Bắt re-render thừa mới xuất hiện trong PR." },
    { q: "Biện pháp nào giúp giảm nhiễu khi benchmark?", options: [
        "Dùng máy khác nhau mỗi lần",
        "Cùng máy, máy nguội, mạng mock, nhiều lần lặp, báo median",
        "Chạy một lần duy nhất",
        "Bật mọi app nền"
      ], correct: 1, explanation: "Kiểm soát biến số để so sánh công bằng." },
    { q: "Vì sao nên mock mạng khi benchmark startup/scroll trong CI?", options: [
        "Để app nhanh hơn thật",
        "Để đo hiệu năng của app, không bị dao động theo server/mạng",
        "Vì CI không có mạng",
        "Không nên mock"
      ], correct: 1, explanation: "Hiệu năng backend đo riêng." },
    { q: "Flashlight dùng cho mục đích gì?", options: [
        "Đo hiệu năng app (FPS, CPU, RAM) trên Android khi chạy một kịch bản, cho điểm",
        "Chụp ảnh",
        "Build iOS",
        "Quản lý ảnh"
      ], correct: 0, explanation: "Hữu ích để so sánh app RN giữa các phiên bản." },
    { q: "Baseline của XCTest measure được lưu thế nào?", options: [
        "Trên App Store Connect",
        "Trong project (xcbaseline), theo từng loại thiết bị",
        "Trong Info.plist",
        "Không lưu được"
      ], correct: 1, explanation: "Máy khác nhau có baseline khác nhau." },
    { q: "Cách bắt đầu CI hiệu năng hợp lý?", options: [
        "Viết 50 benchmark ngay",
        "Một benchmark startup + một benchmark cuộn danh sách chính + kiểm tra size, chạy hằng đêm trước",
        "Chỉ đo thủ công khi release",
        "Chờ người dùng phàn nàn"
      ], correct: 1, explanation: "Ổn định rồi mới mở rộng và gắn vào PR." },
    { q: "Vì sao theo dõi xu hướng theo thời gian vẫn cần dù CI đã có ngưỡng?", options: [
        "Không cần",
        "Nhiều thay đổi nhỏ dưới ngưỡng có thể cộng dồn thành chậm đáng kể",
        "Để đẹp dashboard",
        "Vì ngưỡng luôn sai"
      ], correct: 1, explanation: "'Chết bởi nghìn vết cắt'." }
  ]
});
