window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Công cụ đo",
  title: "Đo từ người dùng thật: Android vitals, MetricKit, Firebase Performance",
  subtitle: "Lab vs field · dữ liệu gộp theo ngày · custom trace · chia theo phiên bản, thiết bị",

  theory: `
    <p>Lab (máy trên bàn, Macrobenchmark, Instruments) cho số <em>ổn định, lặp lại được</em> để so sánh trước/sau. Field (người dùng thật) cho số <em>đúng với thực tế</em>:
    đủ loại máy, mạng, pin yếu, bộ nhớ đầy. Cần cả hai — giống backend có load test và APM production.</p>

    <table>
      <tr><th>Nguồn</th><th>Nền tảng</th><th>Dữ liệu</th><th>Ghi chú</th></tr>
      <tr><td><strong>Android vitals</strong> (Play Console)</td><td>Android</td><td>ANR, crash, startup chậm, frame chậm, wakelock, pin...</td><td>Không cần SDK; chỉ từ người dùng đồng ý chia sẻ dữ liệu chẩn đoán</td></tr>
      <tr><td><strong>Xcode Organizer</strong></td><td>iOS</td><td>Launch time, hang rate, memory, disk writes, energy, scroll hitch</td><td>Gộp từ người dùng đồng ý chia sẻ analytics</td></tr>
      <tr><td><strong>MetricKit</strong></td><td>iOS 13+</td><td><code>MXMetricPayload</code> (gộp 24 h) + <code>MXDiagnosticPayload</code> (hang, crash, CPU/disk exception kèm call stack)</td><td>Nhận ngay trong app, tự gửi về backend của mình</td></tr>
      <tr><td><strong>Firebase Performance</strong></td><td>Android, iOS, RN</td><td>App start, trace màn hình (slow/frozen frames), request mạng tự động, custom trace</td><td>Có SDK; xem theo phiên bản, quốc gia, thiết bị</td></tr>
      <tr><td>APM khác</td><td>—</td><td>Sentry, New Relic, Datadog RUM, Embrace...</td><td>Cùng ý tưởng</td></tr>
    </table>

    <p><strong>MetricKit</strong>: đăng ký <code>MXMetricManager.shared.add(self)</code>, hệ thống giao payload tối đa khoảng một lần mỗi ngày; từ iOS 15 diagnostic
    được giao ngay ở lần mở app kế tiếp. Payload có thể xuất <code>jsonRepresentation()</code> để gửi lên server.</p>

    <p><strong>Firebase Performance custom trace</strong>: bọc một đoạn nghiệp vụ, gắn <em>attribute</em> (vd loại màn hình) và <em>metric</em> (vd số sản phẩm).
    Đừng đưa dữ liệu cá nhân vào attribute.</p>

    <p><strong>Cách đọc dữ liệu field</strong></p>
    <ul>
      <li>Luôn chia theo <strong>phiên bản app</strong> — so sánh bản mới với bản cũ là cách phát hiện regression.</li>
      <li>Chia theo <strong>thiết bị / RAM / OS</strong> — thường 20% máy yếu nhất gây 80% phàn nàn.</li>
      <li>Nhìn <strong>p90/p95</strong> chứ không chỉ median.</li>
      <li>Dữ liệu có độ trễ (thường 1–2 ngày) và chỉ từ người dùng đồng ý — không thay được lab test trước khi release.</li>
    </ul>

    <div class="callout"><p>💡 Chiến lược: <strong>lab</strong> để chặn regression trước khi merge (bài 19), <strong>field</strong> để phát hiện vấn đề lab không thấy và xác nhận cải thiện là thật.
    Khi chuyển RN → native, có số field của bản RN làm baseline là bằng chứng mạnh nhất (bài 20).</p></div>
  `,

  codeTabs: [
    { id: "mk", label: "① MetricKit", lines: [
      "import MetricKit",
      "",
      "final class PerfReporter: NSObject, MXMetricManagerSubscriber {",
      "    func start() { MXMetricManager.shared.add(self) }",
      "",
      "    func didReceive(_ payloads: [MXMetricPayload]) {",
      "        for p in payloads {",
      "            let launch = p.applicationLaunchMetrics?.histogrammedTimeToFirstDraw",
      "            upload(p.jsonRepresentation())      // gửi về backend của mình",
      "        }",
      "    }",
      "",
      "    func didReceive(_ payloads: [MXDiagnosticPayload]) {",
      "        payloads.forEach { upload($0.jsonRepresentation()) }  // hang, crash kèm call stack",
      "    }",
      "}"
    ]},
    { id: "fa", label: "② Firebase (Kotlin)", lines: [
      "// build.gradle.kts: plugin com.google.firebase.firebase-perf + firebase-perf",
      "val trace = Firebase.performance.newTrace(\"checkout_load\")",
      "trace.start()",
      "val cart = repo.loadCart()",
      "trace.putAttribute(\"payment\", cart.paymentMethod)   // không đưa email/tên",
      "trace.putMetric(\"items\", cart.items.size.toLong())",
      "trace.stop()",
      "",
      "// Tự động: _app_start, trace mỗi Activity (slow/frozen frames), request HTTP"
    ]},
    { id: "rnfb", label: "③ Firebase (RN)", lines: [
      "import perf from '@react-native-firebase/perf';",
      "",
      "async function loadCheckout() {",
      "  const trace = await perf().startTrace('checkout_load');",
      "  const cart = await api.getCart();",
      "  trace.putAttribute('payment', cart.paymentMethod);",
      "  trace.putMetric('items', cart.items.length);",
      "  await trace.stop();",
      "  return cart;",
      "}"
    ]},
    { id: "read", label: "④ Đọc dữ liệu field", lines: [
      "checkout_load (p90)",
      "version   all devices   RAM <= 3GB",
      "5.2.0     1.8 s         3.9 s",
      "5.3.0     2.6 s         6.1 s     ← regression, nặng nhất trên máy yếu",
      "",
      "# Hành động: diff 5.2.0..5.3.0, tái hiện trên máy RAM 3GB trong lab,",
      "# trace để tìm nguyên nhân, sửa, xác nhận lại bằng field ở bản 5.3.1"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="lab"><div class="nl">🧪 Lab</div><div class="ns">ổn định · lặp lại được · trước release</div></div>
      <div class="node" id="field"><div class="nl">🌍 Field</div><div class="ns">người dùng thật · đa dạng · có trễ</div></div>
    </div>
    <div class="arrow" id="a1">↓ nguồn field</div>
    <div class="row">
      <div class="node" id="vit"><div class="nl">🤖 Android vitals</div><div class="ns">không cần SDK</div></div>
      <div class="node" id="mk"><div class="nl">🍎 MetricKit / Organizer</div><div class="ns">payload hằng ngày</div></div>
      <div class="node" id="fb"><div class="nl">🔥 Firebase Perf</div><div class="ns">custom trace, 2 nền tảng + RN</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="seg"><div class="nl">🔎 Chia theo version / thiết bị / p90</div><div class="ns">tìm regression</div></div>
  `,
  steps: [
    { title: "1 · Lab và field bổ sung nhau", tab: "read", highlight: [1], on: ["lab", "field"],
      desc: "Lab chặn regression trước khi phát hành; field cho thấy thực tế trên hàng nghìn loại máy." },
    { title: "2 · MetricKit nhận payload", tab: "mk", highlight: [3, 4, 6, 8, 9], on: ["a1", "mk"],
      desc: "Payload gộp theo ngày; histogram thời gian tới frame đầu tiên. Tự gửi JSON về backend để phân tích." },
    { title: "3 · Diagnostic: hang kèm call stack", tab: "mk", highlight: [13, 14], on: ["mk"],
      desc: "MXDiagnosticPayload chứa hang, crash, CPU exception kèm call stack — thứ lab thường không tái hiện được." },
    { title: "4 · Custom trace Firebase", tab: "fa", highlight: [2, 3, 5, 6, 7], on: ["fb"],
      desc: "Trace gắn với nghiệp vụ (checkout), có attribute để lọc và metric để đếm. Không đưa PII vào attribute." },
    { title: "5 · Cùng API cho RN", tab: "rnfb", highlight: [4, 6, 7, 8], on: ["fb"],
      desc: "Đặt trace giống nhau ở bản RN và bản native tương lai → có số so sánh trực tiếp khi chuyển đổi." },
    { title: "6 · Chia nhỏ để thấy regression", tab: "read", highlight: [3, 4, 6, 7], on: ["a2", "seg", "vit"],
      desc: "Trung bình toàn bộ có thể chỉ tăng nhẹ, nhưng nhóm máy RAM ≤ 3 GB tăng gần gấp đôi." }
  ],

  quiz: [
    { q: "Vì sao cần cả dữ liệu lab lẫn field?", options: [
        "Không cần, chỉ field là đủ",
        "Lab ổn định để so sánh trước/sau khi release; field phản ánh thực tế đa dạng thiết bị, mạng",
        "Lab rẻ hơn nên bỏ field",
        "Store bắt buộc"
      ], correct: 1, explanation: "Hai loại dữ liệu trả lời hai câu hỏi khác nhau." },
    { q: "Android vitals lấy dữ liệu từ đâu?", options: [
        "SDK phải tích hợp",
        "Từ thiết bị người dùng đã đồng ý chia sẻ dữ liệu chẩn đoán, qua Google Play — không cần SDK",
        "Từ Firebase",
        "Từ emulator"
      ], correct: 1, explanation: "Có sẵn trong Play Console." },
    { q: "MXMetricPayload thường được giao với tần suất nào?", options: [
        "Mỗi frame", "Mỗi request", "Tối đa khoảng một lần mỗi ngày (gộp 24 h)", "Mỗi giờ"
      ], correct: 2, explanation: "Metric được gộp theo ngày." },
    { q: "MXDiagnosticPayload chứa loại dữ liệu nào?", options: [
        "Chỉ số pin",
        "Chẩn đoán như hang, crash, CPU/disk write exception kèm call stack",
        "Ảnh chụp màn hình",
        "Log mạng"
      ], correct: 1, explanation: "Từ iOS 15 được giao ngay lần mở app kế tiếp." },
    { q: "Điều gì KHÔNG nên đưa vào attribute của custom trace?", options: [
        "Loại màn hình", "Phương thức thanh toán", "Email hoặc tên người dùng", "Phiên bản API"
      ], correct: 2, explanation: "Không đưa dữ liệu cá nhân (PII) vào dữ liệu hiệu năng." },
    { q: "Cách hiệu quả nhất để phát hiện regression hiệu năng từ dữ liệu field?", options: [
        "Nhìn trung bình toàn bộ",
        "So sánh theo phiên bản app, chia theo nhóm thiết bị, nhìn p90",
        "Đọc review trên store",
        "Chỉ nhìn máy flagship"
      ], correct: 1, explanation: "Regression thường chỉ rõ ở một nhóm thiết bị." },
    { q: "Firebase Performance tự động thu những gì mà không cần code?", options: [
        "Chỉ crash",
        "App start, trace màn hình (slow/frozen frames), request HTTP",
        "Memory leak",
        "Kích thước APK"
      ], correct: 1, explanation: "Custom trace thì phải tự thêm." },
    { q: "Hạn chế của dữ liệu field là gì?", options: [
        "Luôn chính xác tuyệt đối",
        "Có độ trễ, chỉ từ người dùng đồng ý, khó tái hiện nguyên nhân — không thay được lab test trước release",
        "Chỉ có trên iOS",
        "Không chia được theo phiên bản"
      ], correct: 1, explanation: "Field phát hiện; lab tái hiện và xác nhận." },
    { q: "Muốn chứng minh bản native nhanh hơn bản RN bằng dữ liệu field, nên làm gì từ bây giờ?", options: [
        "Không cần làm gì",
        "Đặt cùng tên custom trace/kịch bản đo ở bản RN để có baseline, rồi đặt y hệt ở bản native",
        "Chỉ đo bản native",
        "Dùng số của app khác"
      ], correct: 1, explanation: "Không có baseline thì không so sánh được." }
  ]
});
