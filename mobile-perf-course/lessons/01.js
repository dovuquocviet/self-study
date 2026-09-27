window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Tư duy đo",
  title: "Đo trước khi sửa — vòng lặp của kỹ sư hiệu năng",
  subtitle: "Baseline · giả thuyết · sửa một thứ · đo lại · p50/p90 · release build trên máy thật",

  theory: `
    <p>Sai lầm phổ biến nhất khi "tối ưu app": đọc một bài blog, rắc <code>useMemo</code> hoặc <code>Dispatchers.IO</code> khắp nơi, rồi <em>cảm thấy</em> app nhanh hơn.
    Kỹ sư hiệu năng làm ngược lại: <strong>có số trước, sửa sau, rồi chứng minh bằng số</strong>. Giống bạn không tối ưu query Spring bằng cảm giác —
    bạn bật <code>EXPLAIN ANALYZE</code> hoặc nhìn trace APM trước.</p>

    <p><strong>Vòng lặp 5 bước</strong></p>
    <ol>
      <li><strong>Định nghĩa kịch bản</strong> cụ thể, lặp lại được: "cold start tới khi danh sách sản phẩm hiện ảnh đầu tiên", không phải "app chậm".</li>
      <li><strong>Đo baseline</strong>: chạy N lần (≥ 10) trên máy thật, bản release, ghi median (p50) và p90.</li>
      <li><strong>Tìm nút thắt</strong> bằng profiler/trace — thời gian đi đâu? Đừng đoán.</li>
      <li><strong>Sửa một thứ</strong> mỗi lần. Sửa 5 thứ cùng lúc thì không biết cái nào có tác dụng (hoặc cái nào làm chậm đi).</li>
      <li><strong>Đo lại</strong> cùng kịch bản, cùng máy. Chênh lệch nhỏ hơn độ nhiễu giữa các lần chạy = chưa chứng minh được gì.</li>
    </ol>

    <p><strong>Vì sao phải là release build trên máy thật?</strong></p>
    <table>
      <tr><th>Môi trường</th><th>Sai lệch</th></tr>
      <tr><td>Android debug build</td><td>Không R8, không AOT/Baseline Profile, <code>debuggable</code> tắt nhiều tối ưu của ART → chậm hơn nhiều lần</td></tr>
      <tr><td>React Native dev mode</td><td>Bật kiểm tra PropTypes/warning, không minify, tải bundle qua Metro → số đo vô nghĩa</td></tr>
      <tr><td>iOS Simulator</td><td>Chạy trên CPU Mac, RAM Mac, GPU Mac — nhanh hơn iPhone thật, không có giới hạn nhiệt/pin</td></tr>
      <tr><td>Flagship của dev</td><td>Người dùng thật thường xài máy tầm trung/thấp; nút thắt chỉ lộ ra trên máy yếu</td></tr>
    </table>

    <p><strong>Nhìn phân vị, không nhìn trung bình.</strong> Trung bình 800 ms có thể che giấu 10% người dùng phải chờ 4 s. Với dữ liệu production,
    p90/p99 mới cho thấy nỗi đau thật. Với benchmark trong lab, dùng <em>median</em> vì ít bị ảnh hưởng bởi một lần chạy bất thường.</p>

    <p><strong>Hiệu năng cảm nhận (perceived performance)</strong> cũng là hiệu năng: skeleton, hiện dữ liệu cache ngay rồi cập nhật sau, phản hồi chạm trong ≤ 100 ms.
    Nhưng nó không thay được việc sửa nút thắt thật.</p>

    <div class="callout"><p>💡 Quy tắc vàng: <strong>không có số trước khi sửa thì không được tuyên bố đã nhanh hơn</strong>. Mọi PR "tối ưu" nên đính kèm bảng before/after
    (median, p90, số lần chạy, thiết bị, build type).</p></div>
  `,

  codeTabs: [
    { id: "loop", label: "① Vòng lặp đo", lines: [
      "scenario = 'cold start → ảnh đầu tiên của danh sách hiện ra'",
      "device   = 'Samsung A14 (máy tầm thấp), release build, pin > 50%'",
      "",
      "baseline = run(scenario, times = 15)     // median 2150 ms, p90 2480 ms",
      "profile  = trace(scenario)               // 600 ms: parse JSON config trên main thread",
      "",
      "fix: chuyển parse config sang background + lazy",
      "",
      "after    = run(scenario, times = 15)     // median 1560 ms, p90 1790 ms",
      "report(before = baseline, after = after) // -27% median, nhiễu giữa các lần ≈ ±60 ms"
    ]},
    { id: "pct", label: "② p50 vs trung bình", lines: [
      "// 10 lần đo cold start (ms), đã sắp xếp:",
      "[ 980, 1010, 1020, 1040, 1050, 1060, 1090, 1120, 1300, 4100 ]",
      "",
      "mean   = 1377 ms   // bị kéo lên bởi 1 lần 4100 ms",
      "median = 1055 ms   // (1050 + 1060) / 2",
      "p90    ≈ 1300 ms   // (theo cách tính nearest-rank)",
      "",
      "# Lab: báo median + p90 + độ lệch. Production: theo dõi p90/p99."
    ]},
    { id: "build", label: "③ Build để đo", lines: [
      "# Android: build release (hoặc buildType 'benchmark' kế thừa release, ký debug key)",
      "./gradlew :app:assembleRelease",
      "",
      "# iOS: scheme Release, Profile (⌘I) để mở Instruments",
      "xcodebuild -scheme Shop -configuration Release -destination 'generic/platform=iOS' build",
      "",
      "# React Native: tắt dev mode",
      "npx react-native run-android --mode release",
      "npx react-native run-ios --mode Release"
    ]},
    { id: "java", label: "④ So với Spring", lines: [
      "// Backend Java: bạn không tối ưu bằng cảm giác",
      "EXPLAIN ANALYZE SELECT ...          -- đo trước",
      "JMH @Benchmark với warmup           -- chống nhiễu JIT",
      "APM trace (p95 latency)             -- nhìn phân vị",
      "",
      "// Mobile tương đương:",
      "Perfetto / Instruments              -- xem thời gian đi đâu",
      "Macrobenchmark / XCTest measure     -- chạy lặp, có warmup, báo median",
      "Android vitals / MetricKit          -- phân vị từ người dùng thật"
    ]}
  ],

  stageHtml: `
    <div class="node" id="n1"><div class="nl">🎯 Kịch bản cụ thể</div><div class="ns">bắt đầu ở đâu, kết thúc ở đâu</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="n2"><div class="nl">📏 Baseline</div><div class="ns">N lần, release, máy thật → p50/p90</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="n3"><div class="nl">🔬 Profiler / trace</div><div class="ns">thời gian đi đâu?</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="n4"><div class="nl">🔧 Sửa MỘT thứ</div><div class="ns">giả thuyết rõ ràng</div></div>
    <div class="arrow" id="a4">↓</div>
    <div class="node" id="n5"><div class="nl">📊 Đo lại & so sánh</div><div class="ns">chênh lệch &gt; nhiễu?</div></div>
  `,
  steps: [
    { title: "1 · Chốt kịch bản & thiết bị", tab: "loop", highlight: [1, 2], on: ["n1"],
      desc: "Kịch bản phải có điểm đầu và điểm cuối đo được. Thiết bị nên là máy đại diện cho người dùng, không phải máy của dev." },
    { title: "2 · Đo baseline nhiều lần", tab: "loop", highlight: [4], on: ["a1", "n2"],
      desc: "Một lần đo không nói lên gì. Chạy ≥ 10–15 lần, lấy median và p90." },
    { title: "3 · Median thay vì trung bình", tab: "pct", highlight: [2, 4, 5, 6], on: ["n2"],
      desc: "Một lần chạy 4100 ms (GC, máy nóng, tiến trình nền) kéo trung bình lên 1377 ms, còn median vẫn 1055 ms." },
    { title: "4 · Trace để tìm nút thắt", tab: "loop", highlight: [5], on: ["a2", "n3"],
      desc: "Trace cho thấy 600 ms nằm ở việc parse JSON trên main thread — đó là giả thuyết có bằng chứng." },
    { title: "5 · Sửa một thứ, đo lại", tab: "loop", highlight: [7, 9, 10], on: ["a3", "n4", "a4", "n5"],
      desc: "Giảm 590 ms median, lớn hơn nhiều so với nhiễu ±60 ms → kết luận được. Nếu chỉ giảm 30 ms thì chưa chứng minh gì." },
    { title: "6 · Luôn đo bản release", tab: "build", highlight: [2, 5, 8, 9], on: ["n2"],
      desc: "Debug build và dev mode của RN chậm hơn nhiều lần và chậm ở chỗ khác — tối ưu dựa trên chúng có thể là tối ưu nhầm chỗ." }
  ],

  quiz: [
    { q: "Bước nào nên làm TRƯỚC khi sửa code để tăng tốc?", options: [
        "Thêm useMemo cho mọi component",
        "Đo baseline của một kịch bản cụ thể trên bản release",
        "Nâng cấp mọi thư viện",
        "Chuyển hết sang native"
      ], correct: 1, explanation: "Không có baseline thì không chứng minh được thay đổi có tác dụng." },
    { q: "Vì sao không nên đo hiệu năng trên React Native dev mode?", options: [
        "Dev mode nhanh hơn release",
        "Dev mode bật kiểm tra/warning, không minify, tải bundle qua Metro — số đo không đại diện",
        "Dev mode không chạy được trên Android",
        "Dev mode tắt JS"
      ], correct: 1, explanation: "Chi phí của dev mode có thể lớn hơn cả nút thắt bạn đang tìm." },
    { q: "10 lần đo: 9 lần quanh 1000 ms, 1 lần 4100 ms. Chỉ số nào mô tả tốt nhất 'thường mất bao lâu'?", options: [
        "Trung bình (mean)", "Median", "Giá trị lớn nhất", "Giá trị nhỏ nhất"
      ], correct: 1, explanation: "Median ít bị kéo bởi giá trị ngoại lai." },
    { q: "Với dữ liệu từ người dùng thật, vì sao cần theo dõi p90/p99?", options: [
        "Vì nó luôn bằng median",
        "Vì trung bình che giấu nhóm người dùng chịu trải nghiệm tệ nhất",
        "Vì store yêu cầu",
        "Vì dễ tính hơn"
      ], correct: 1, explanation: "Nhóm đuôi thường là máy yếu, mạng kém — nơi người dùng bỏ app." },
    { q: "Vì sao nên sửa MỘT thứ mỗi lần rồi đo lại?", options: [
        "Để PR nhỏ hơn cho đẹp",
        "Để biết chính xác thay đổi nào có tác dụng (và thay đổi nào làm chậm đi)",
        "Vì profiler chỉ đo được một thay đổi",
        "Không cần, sửa nhiều cùng lúc tốt hơn"
      ], correct: 1, explanation: "Nhiều thay đổi cùng lúc có thể bù trừ nhau và che mất nguyên nhân." },
    { q: "Đo trên iOS Simulator thường cho kết quả thế nào so với iPhone thật?", options: [
        "Giống hệt",
        "Thường nhanh hơn vì dùng CPU/RAM của Mac, không có giới hạn nhiệt/pin của máy thật",
        "Luôn chậm hơn 10 lần",
        "Không đo được thời gian"
      ], correct: 1, explanation: "Simulator không đại diện cho phần cứng người dùng." },
    { q: "Sau khi sửa, median giảm 30 ms, nhưng các lần chạy dao động ±80 ms. Kết luận đúng là gì?", options: [
        "Đã nhanh hơn 30 ms",
        "Chưa chứng minh được — chênh lệch nhỏ hơn độ nhiễu",
        "Đã chậm đi",
        "Cần chạy trên simulator"
      ], correct: 1, explanation: "Cần tăng số lần chạy/giảm nhiễu hoặc chấp nhận là không có khác biệt đáng kể." },
    { q: "'Hiện dữ liệu cache ngay rồi cập nhật sau' thuộc nhóm kỹ thuật nào?", options: [
        "Giảm app size", "Hiệu năng cảm nhận (perceived performance)", "Chống memory leak", "Tối ưu build"
      ], correct: 1, explanation: "Người dùng thấy nội dung sớm hơn dù tổng công việc không đổi." },
    { q: "Công cụ Java nào có vai trò giống Macrobenchmark / XCTest measure trên mobile?", options: [
        "Lombok", "JMH (chạy lặp có warmup, báo thống kê)", "Hibernate", "Maven"
      ], correct: 1, explanation: "Cả hai đều chạy lặp có kiểm soát để giảm nhiễu và báo số liệu thống kê." }
  ]
});
