window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Công cụ đo",
  title: "iOS: Xcode Instruments — Time Profiler, Allocations, Leaks, Hitches",
  subtitle: "Profile (⌘I) bản Release · đọc call tree · signpost với OSSignposter · Memory Graph",

  theory: `
    <p><strong>Instruments</strong> là bộ công cụ đo của Xcode. Mở bằng <em>Product → Profile</em> (⌘I): Xcode build cấu hình <strong>Release</strong> (theo scheme mặc định) rồi mở Instruments.
    Mỗi <em>template</em> gom sẵn vài instrument cho một mục đích.</p>

    <table>
      <tr><th>Template / Instrument</th><th>Trả lời câu hỏi</th></tr>
      <tr><td><strong>Time Profiler</strong></td><td>CPU đang chạy hàm nào? (sampling call stack khoảng mỗi 1 ms)</td></tr>
      <tr><td><strong>Allocations</strong></td><td>Cấp phát bao nhiêu, ở đâu, cái gì còn sống? So sánh các <em>generation</em> (Mark Generation) để tìm bộ nhớ tăng dần</td></tr>
      <tr><td><strong>Leaks</strong></td><td>Có vùng nhớ nào không còn ai tham chiếu từ gốc nhưng chưa giải phóng (thường do retain cycle)?</td></tr>
      <tr><td><strong>Animation Hitches</strong></td><td>Frame nào trễ, trễ bao lâu, do commit hay render?</td></tr>
      <tr><td><strong>App Launch</strong></td><td>Thời gian launch chia theo giai đoạn (process, dyld, static init, UIKit init, frame đầu)</td></tr>
      <tr><td><strong>SwiftUI</strong></td><td>View body nào được đánh giá lại bao nhiêu lần</td></tr>
      <tr><td><strong>os_signpost / Points of Interest</strong></td><td>Hiện các khoảng thời gian bạn tự đánh dấu</td></tr>
    </table>

    <p><strong>Đọc call tree của Time Profiler</strong> — bật các tuỳ chọn:</p>
    <ul>
      <li><em>Separate by Thread</em>: tách main thread ra xem riêng.</li>
      <li><em>Hide System Libraries</em>: chỉ còn code của mình.</li>
      <li><em>Invert Call Tree</em>: hàm lá tốn nhiều nhất lên đầu (self time).</li>
    </ul>
    <p>Cột <em>Weight</em> là tổng thời gian (gồm hàm con), <em>Self Weight</em> là thời gian của riêng hàm đó.</p>

    <p><strong>Signpost</strong> tương đương <code>Trace.beginSection</code> của Android: iOS 15+ dùng <code>OSSignposter</code>; category <code>.pointsOfInterest</code> hiện sẵn trong hầu hết template.</p>

    <p><strong>Memory Graph Debugger</strong> (nút ba vòng tròn trong thanh debug của Xcode) chụp đồ thị object lúc đang chạy — xem ngay ai đang giữ một ViewController lẽ ra đã giải phóng.</p>

    <div class="callout"><p>💡 Với app RN chạy Hermes, Time Profiler thấy các hàm của Hermes (interpreter) chứ không thấy tên hàm JS. Dùng Instruments cho phía native,
    Hermes profiler (bài 07) cho phía JS.</p></div>
  `,

  codeTabs: [
    { id: "sign", label: "① OSSignposter", lines: [
      "import os",
      "",
      "let signposter = OSSignposter(subsystem: \"com.shop\", category: .pointsOfInterest)",
      "",
      "func loadCatalog() async throws -> [Product] {",
      "    let id = signposter.makeSignpostID()",
      "    let state = signposter.beginInterval(\"Catalog.load\", id: id)",
      "    defer { signposter.endInterval(\"Catalog.load\", state) }",
      "    let data = try await api.products()",
      "    return try JSONDecoder().decode([Product].self, from: data)",
      "}"
    ]},
    { id: "tp", label: "② Call tree", lines: [
      "Time Profiler — main thread, Invert Call Tree, Hide System Libraries",
      "",
      "Weight   Self    Symbol",
      "412 ms   388 ms  ProductCell.configure(with:)",
      "                 └ NSAttributedString(html:)       ← parse HTML mỗi lần cuộn",
      " 96 ms    90 ms  DateFormatter.init()              ← tạo formatter mỗi cell",
      " 31 ms    28 ms  UIImage(named:)",
      "",
      "# Sửa: tính sẵn chuỗi ngoài main thread, dùng 1 formatter tĩnh"
    ]},
    { id: "alloc", label: "③ Allocations", lines: [
      "Allocations — mở/đóng màn ProductDetail 5 lần, Mark Generation sau mỗi lần",
      "",
      "Generation A   +2.1 MB   (lần mở đầu, có cache ảnh: bình thường)",
      "Generation B   +1.9 MB",
      "Generation C   +2.0 MB   ← mỗi lần tăng ~2 MB mà không giảm",
      "Generation D   +2.0 MB",
      "  └ ProductDetailViewController   1 instance / generation còn sống",
      "",
      "# ViewController không được giải phóng → nghi retain cycle (bài 15)"
    ]},
    { id: "hitch", label: "④ Hitches", lines: [
      "Animation Hitches — cuộn danh sách 10 giây",
      "",
      "Hitch time ratio: 14.2 ms/s   (> 10 ms/s: tệ)",
      "Hitch #12  duration 50 ms  type: Commit   → main thread chậm",
      "Hitch #19  duration 33 ms  type: Render   → layer phức tạp",
      "",
      "# Render: shadow không có shadowPath → offscreen pass",
      "cell.layer.shadowPath = UIBezierPath(roundedRect: cell.bounds, cornerRadius: 12).cgPath"
    ]}
  ],

  stageHtml: `
    <div class="node" id="prof"><div class="nl">⌘I Profile</div><div class="ns">build Release → Instruments</div></div>
    <div class="arrow" id="a1">↓ chọn template</div>
    <div class="row">
      <div class="node" id="tp"><div class="nl">⏱️ Time Profiler</div><div class="ns">CPU ở đâu</div></div>
      <div class="node" id="al"><div class="nl">🧠 Allocations / Leaks</div><div class="ns">bộ nhớ ở đâu</div></div>
      <div class="node" id="hi"><div class="nl">🎞️ Hitches</div><div class="ns">frame nào trễ</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="sp"><div class="nl">🏷️ Signpost</div><div class="ns">khoảng thời gian tự đặt tên</div></div>
  `,
  steps: [
    { title: "1 · Đánh dấu bằng OSSignposter", tab: "sign", highlight: [3, 6, 7, 8], on: ["sp"],
      desc: "Category .pointsOfInterest hiện sẵn trên timeline. <code>defer</code> đảm bảo luôn đóng interval kể cả khi throw." },
    { title: "2 · Profile bản Release", tab: "sign", highlight: [5], on: ["prof", "a1"],
      desc: "⌘I build Release. Đo Debug (-Onone) cho số sai lệch lớn, nhất là với Swift generic." },
    { title: "3 · Time Profiler: đảo cây gọi", tab: "tp", highlight: [1, 4, 5, 6], on: ["tp"],
      desc: "Self weight 388 ms trong configure: parse HTML mỗi lần cell hiện. DateFormatter tạo mới mỗi cell cũng tốn 90 ms." },
    { title: "4 · Allocations theo generation", tab: "alloc", highlight: [5, 6, 7, 9], on: ["al"],
      desc: "Mở/đóng cùng màn hình mà bộ nhớ tăng đều mỗi lần = có thứ bị giữ lại. Xem object nào còn sống trong generation." },
    { title: "5 · Hitch: commit hay render?", tab: "hitch", highlight: [3, 4, 5, 8], on: ["hi", "a2"],
      desc: "Commit → tối ưu main thread. Render → giảm offscreen rendering, ví dụ cho shadow một shadowPath." }
  ],

  quiz: [
    { q: "Product → Profile (⌘I) mặc định build với cấu hình nào?", options: [
        "Debug", "Release", "Test", "Không build"
      ], correct: 1, explanation: "Action Profile trong scheme mặc định dùng Release." },
    { q: "Time Profiler hoạt động theo cách nào?", options: [
        "Ghi mọi lời gọi hàm", "Lấy mẫu call stack định kỳ", "Đếm số dòng code", "Đo nhiệt độ CPU"
      ], correct: 1, explanation: "Sampling, overhead thấp." },
    { q: "Tuỳ chọn 'Invert Call Tree' giúp gì?", options: [
        "Ẩn main thread",
        "Đưa các hàm lá có self time lớn nhất lên đầu",
        "Sắp xếp theo tên",
        "Xoá system library"
      ], correct: 1, explanation: "Nhìn thẳng vào hàm thực sự tiêu CPU." },
    { q: "Khác biệt giữa Weight và Self Weight?", options: [
        "Giống nhau",
        "Weight gồm cả thời gian hàm con; Self Weight chỉ thời gian của chính hàm đó",
        "Self Weight gồm cả hàm con",
        "Weight là bộ nhớ"
      ], correct: 1, explanation: "Hàm có Weight lớn nhưng Self nhỏ chỉ là hàm điều phối." },
    { q: "Mark Generation trong Allocations dùng để làm gì?", options: [
        "Chụp màn hình",
        "Chia bộ nhớ theo từng lần lặp thao tác để thấy bộ nhớ tăng dần không được giải phóng",
        "Xoá cache",
        "Tạo signpost"
      ], correct: 1, explanation: "Lặp cùng thao tác nhiều lần; generation sau vẫn tăng = rò rỉ/giữ lại." },
    { q: "API signpost khuyến nghị từ iOS 15 là gì?", options: [
        "NSLog", "OSSignposter", "print", "CFAbsoluteTimeGetCurrent"
      ], correct: 1, explanation: "OSSignposter với beginInterval/endInterval." },
    { q: "Hitch loại Render thường do đâu?", options: [
        "Gọi API",
        "Layer cần offscreen rendering (mask, shadow không có path, blur) làm render server/GPU chậm",
        "Parse JSON",
        "Đọc Core Data trên main thread"
      ], correct: 1, explanation: "Commit hitch mới do main thread chậm." },
    { q: "Công cụ nào xem nhanh 'ai đang giữ ViewController này' ngay khi debug?", options: [
        "Time Profiler", "Memory Graph Debugger của Xcode", "Network Link Conditioner", "App Store Connect"
      ], correct: 1, explanation: "Memory Graph hiển thị các tham chiếu tới object." },
    { q: "Với app RN dùng Hermes, Time Profiler của Instruments hiển thị phần JS thế nào?", options: [
        "Tên hàm JS đầy đủ",
        "Chủ yếu thấy hàm của Hermes interpreter, không thấy tên hàm JS — cần Hermes profiler",
        "Không thấy thread JS",
        "Hiển thị source map"
      ], correct: 1, explanation: "Dùng Instruments cho native, công cụ của RN/Hermes cho JS." }
  ]
});
