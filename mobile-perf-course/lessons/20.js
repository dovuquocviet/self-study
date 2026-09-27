window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Quy trình & quyết định",
  title: "Chứng minh 'chuyển sang native nhanh hơn bao nhiêu' — benchmark có phương pháp",
  subtitle: "Câu hỏi rõ · so sánh công bằng · cùng công cụ đo · xen kẽ lượt chạy · median, p90, khoảng tin cậy · xác nhận bằng field",

  theory: `
    <p>"Native nhanh hơn" là giả thuyết, không phải kết luận. Quyết định đầu tư viết lại app cần số liệu mà người hoài nghi nhất trong phòng họp cũng phải chấp nhận.
    Giống so sánh hai kiến trúc backend: bạn không so một service đã tune với một service chạy cấu hình mặc định.</p>

    <p><strong>1. Câu hỏi cụ thể, gắn nghiệp vụ</strong> — chọn 4–6 kịch bản người dùng quan tâm:</p>
    <ul>
      <li>Cold start → trang chủ có dữ liệu (TTFD).</li>
      <li>Cuộn danh sách sản phẩm 50 item: % frame jank, p90 frame time.</li>
      <li>Chạm sản phẩm → trang chi tiết hiện đủ.</li>
      <li>Peak memory sau 5 phút dùng; download size.</li>
    </ul>

    <p><strong>2. So sánh công bằng</strong></p>
    <ul>
      <li>Cùng tính năng, cùng UI, cùng dữ liệu (API mock hoặc server cố định) — nếu bản native thiếu tính năng thì nó "nhanh" vì làm ít việc hơn.</li>
      <li>Cả hai đều bản release, cùng thiết bị (ít nhất một máy yếu, một máy trung bình; Android và iOS).</li>
      <li>Nên có thêm biến thể <strong>"RN đã tối ưu"</strong> (FlashList, Hermes, kiến trúc mới, ảnh đúng cỡ...). Câu hỏi thật là: native hơn <em>RN đã làm đúng</em> bao nhiêu, và có đáng chi phí viết lại không.</li>
    </ul>

    <p><strong>3. Cùng một công cụ đo, đo từ bên ngoài</strong>: Macrobenchmark đo được mọi app Android theo package (RN hay native đều là Activity), <code>StartupTimingMetric</code>, <code>FrameTimingMetric</code>;
    XCTest <code>XCTApplicationLaunchMetric</code> với iOS; Flashlight cho FPS/CPU. TTFD cần app gọi <code>reportFullyDrawn()</code> / signpost ở cùng mốc nghiệp vụ trong cả hai bản.</p>

    <p><strong>4. Thống kê đủ dùng</strong></p>
    <ul>
      <li>≥ 30 lượt mỗi biến thể mỗi máy; <strong>xen kẽ</strong> A, B, A, B... để nhiệt độ máy và nền không thiên vị bên nào.</li>
      <li>Báo <strong>median, p90</strong> và độ phân tán (IQR); với chênh lệch, báo <strong>khoảng tin cậy</strong> (bootstrap đơn giản là đủ) — "nhanh hơn 180 ms (95% CI: 140–220 ms)".</li>
      <li>Báo cả ms và %: 30% của 300 ms khác 30% của 3 s về giá trị với người dùng.</li>
    </ul>

    <p><strong>5. Xác nhận bằng field</strong>: đặt cùng custom trace (bài 06) ở cả hai bản; phát hành dần (staged rollout) và so theo nhóm thiết bị. Lab trả lời "có thể nhanh hơn bao nhiêu", field trả lời "người dùng thực sự thấy gì".</p>

    <div class="callout"><p>💡 Một báo cáo tốt kết thúc bằng quyết định có điều kiện: "Native giảm TTFD 35% và jank từ 9% còn 2% trên máy yếu; RN đã tối ưu giảm được 20% và 4%.
    Khác biệt còn lại X đáng/không đáng chi phí Y." Số liệu phục vụ quyết định, không phục vụ phe nào.</p></div>
  `,

  codeTabs: [
    { id: "plan", label: "① Kế hoạch đo", lines: [
      "Biến thể : A = RN hiện tại | B = RN đã tối ưu | C = native (Kotlin/Swift)",
      "Thiết bị : Galaxy A14 (yếu) · Pixel 7a (trung) · iPhone 11 · iPhone 15",
      "Build    : release, cùng API mock trả JSON cố định",
      "Kịch bản : S1 cold start → trang chủ đủ dữ liệu (TTFD)",
      "           S2 cuộn 50 sản phẩm: % jank, p90 frame time",
      "           S3 chạm sản phẩm → chi tiết hiện đủ",
      "           S4 peak memory 5 phút; download size",
      "Lặp      : 30 lượt / biến thể / máy, xen kẽ A B C A B C ...",
      "Báo cáo  : median, p90, IQR, chênh lệch kèm 95% CI"
    ]},
    { id: "macro", label: "② Cùng công cụ", lines: [
      "// Một benchmark, đổi packageName là đo được cả RN lẫn native",
      "@RunWith(Parameterized::class)",
      "class CompareStartup(private val pkg: String) {",
      "    @get:Rule val rule = MacrobenchmarkRule()",
      "    @Test fun cold() = rule.measureRepeated(",
      "        packageName = pkg,",
      "        metrics = listOf(StartupTimingMetric()),",
      "        iterations = 30, startupMode = StartupMode.COLD",
      "    ) { pressHome(); startActivityAndWait() }",
      "    companion object {",
      "        @JvmStatic @Parameterized.Parameters",
      "        fun pkgs() = listOf(\"com.shop.rn\", \"com.shop.rnopt\", \"com.shop.native\")",
      "    }",
      "}"
    ]},
    { id: "stats", label: "③ Bootstrap CI", lines: [
      "import random, statistics as st",
      "",
      "def bootstrap_diff(a, b, n=10000):",
      "    diffs = sorted(st.median(random.choices(a, k=len(a))) -",
      "                   st.median(random.choices(b, k=len(b))) for _ in range(n))",
      "    return diffs[int(0.025 * n)], diffs[int(0.975 * n)]",
      "",
      "# a = 30 lần TTFD của RN, b = 30 lần của native (ms)",
      "lo, hi = bootstrap_diff(rn, native)",
      "# → native nhanh hơn 180 ms, 95% CI [140, 220] → khác biệt chắc chắn > 0"
    ]},
    { id: "report", label: "④ Báo cáo (số minh hoạ)", lines: [
      "S1 TTFD median (ms) — Galaxy A14",
      "A RN hiện tại   2150   p90 2480",
      "B RN tối ưu     1620   p90 1850   (-25%)",
      "C Native        1310   p90 1460   (-39% so A, -19% so B; CI của B−C: 250–370 ms)",
      "",
      "S2 cuộn: jank frames   A 9.1%   B 3.8%   C 1.7%",
      "Size tải về (arm64)    A 24 MB  B 22 MB  C 11 MB",
      "",
      "Kết luận: phần lớn lợi ích đạt được bằng tối ưu RN (B); native thêm ~19% TTFD",
      "và giảm jank thêm 2 điểm %. Cân nhắc với chi phí viết lại & bảo trì 2 codebase."
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Câu hỏi nghiệp vụ</div><div class="ns">4–6 kịch bản có điểm đầu/cuối</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="a"><div class="nl">A · RN hiện tại</div><div class="ns">baseline</div></div>
      <div class="node" id="b"><div class="nl">B · RN tối ưu</div><div class="ns">đối chứng công bằng</div></div>
      <div class="node" id="c"><div class="nl">C · Native</div><div class="ns">cùng tính năng & dữ liệu</div></div>
    </div>
    <div class="arrow" id="a2">↓ cùng công cụ · cùng máy · xen kẽ · 30 lượt</div>
    <div class="node" id="stat"><div class="nl">📊 Median · p90 · 95% CI</div><div class="ns">ms và %</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="field"><div class="nl">🌍 Xác nhận bằng field</div><div class="ns">staged rollout · cùng custom trace</div></div>
  `,
  steps: [
    { title: "1 · Viết kế hoạch trước khi đo", tab: "plan", highlight: [1, 4, 5, 6, 7], on: ["q", "a1"],
      desc: "Kịch bản gắn nghiệp vụ, có điểm đầu/cuối rõ. Viết ra trước để không 'chọn kịch bản có lợi' sau khi thấy số." },
    { title: "2 · Ba biến thể, không phải hai", tab: "plan", highlight: [1, 2, 3], on: ["a", "b", "c"],
      desc: "Có RN đã tối ưu (B) mới trả lời được câu hỏi thật: phần hơn còn lại của native là bao nhiêu." },
    { title: "3 · Cùng công cụ đo từ bên ngoài", tab: "macro", highlight: [2, 6, 7, 8, 12], on: ["a2"],
      desc: "Macrobenchmark không quan tâm app viết bằng gì — chỉ cần package. Cùng metric, cùng số lượt." },
    { title: "4 · Xen kẽ & nhiều lượt", tab: "plan", highlight: [8, 9], on: ["a2", "stat"],
      desc: "Chạy hết A rồi mới tới C thì C chịu máy nóng hơn → thiên vị. Xen kẽ triệt tiêu yếu tố này." },
    { title: "5 · Khoảng tin cậy cho chênh lệch", tab: "stats", highlight: [3, 4, 5, 6, 10], on: ["stat"],
      desc: "Bootstrap: lấy mẫu lại nhiều lần để ước lượng dao động của chênh lệch median. CI không chứa 0 → khác biệt có thật." },
    { title: "6 · Báo cáo phục vụ quyết định", tab: "report", highlight: [2, 3, 4, 6, 9, 10], on: ["stat", "a3", "field"],
      desc: "Số minh hoạ cho thấy tối ưu RN đã lấy phần lớn lợi ích. Sau cùng xác nhận bằng field qua staged rollout." }
  ],

  quiz: [
    { q: "Vì sao nên có biến thể 'RN đã tối ưu' khi so với native?", options: [
        "Để làm RN trông tốt hơn",
        "Để đo phần lợi ích thật sự chỉ native mới mang lại, so với việc làm đúng trên RN",
        "Vì native cần đối thủ",
        "Không cần thiết"
      ], correct: 1, explanation: "So native với RN chưa tối ưu sẽ thổi phồng lợi ích." },
    { q: "Nếu bản native thiếu vài tính năng so với bản RN, kết quả benchmark bị ảnh hưởng thế nào?", options: [
        "Không ảnh hưởng",
        "Native có thể 'nhanh' chỉ vì làm ít việc hơn — so sánh không công bằng",
        "RN sẽ nhanh hơn",
        "Chỉ ảnh hưởng size"
      ], correct: 1, explanation: "Phải cùng tính năng, UI, dữ liệu." },
    { q: "Vì sao chạy xen kẽ A, B, C thay vì chạy hết A rồi tới B?", options: [
        "Cho nhanh",
        "Tránh thiên vị do máy nóng dần, tiến trình nền thay đổi theo thời gian",
        "Vì Macrobenchmark yêu cầu",
        "Không có lý do"
      ], correct: 1, explanation: "Yếu tố môi trường chia đều cho các biến thể." },
    { q: "Macrobenchmark có đo được app React Native không?", options: [
        "Không, chỉ app Kotlin",
        "Có — nó điều khiển app theo package từ bên ngoài, RN cũng chạy trong Activity",
        "Chỉ khi dùng Expo",
        "Chỉ trên iOS"
      ], correct: 1, explanation: "Đo từ bên ngoài nên áp dụng được cho mọi app." },
    { q: "Khoảng tin cậy 95% của chênh lệch là [140, 220] ms. Diễn giải đúng?", options: [
        "Không có khác biệt",
        "Chênh lệch thật nhiều khả năng nằm trong khoảng này; vì không chứa 0 nên khác biệt là có thật",
        "95% người dùng nhanh hơn 180 ms",
        "Cần đo lại vì khoảng quá hẹp"
      ], correct: 1, explanation: "CI mô tả độ bất định của ước lượng." },
    { q: "Vì sao nên báo cả ms lẫn %?", options: [
        "Cho dài báo cáo",
        "Vì cùng một % có ý nghĩa rất khác nhau tuỳ giá trị gốc (30% của 300 ms vs 30% của 3 s)",
        "Vì % luôn sai",
        "Vì ms khó hiểu"
      ], correct: 1, explanation: "Giá trị cảm nhận phụ thuộc số tuyệt đối." },
    { q: "Muốn đo TTFD công bằng giữa bản RN và native cần gì?", options: [
        "Không cần gì",
        "Cả hai bản báo cùng một mốc nghiệp vụ (reportFullyDrawn/signpost) khi dữ liệu thật đã hiện",
        "Chỉ đo TTID",
        "Dùng đồng hồ bấm giờ"
      ], correct: 1, explanation: "Cùng định nghĩa điểm kết thúc." },
    { q: "Vai trò của dữ liệu field trong so sánh RN vs native?", options: [
        "Không cần",
        "Xác nhận lợi ích lab có thật với người dùng, qua staged rollout và cùng custom trace",
        "Thay thế hoàn toàn lab",
        "Chỉ để đếm lượt tải"
      ], correct: 1, explanation: "Lab = có thể; field = thực tế." },
    { q: "Nên chọn kịch bản benchmark khi nào?", options: [
        "Sau khi xem kết quả để chọn kịch bản có lợi",
        "Viết ra trước khi đo, gắn với nghiệp vụ",
        "Để đội native chọn",
        "Chọn ngẫu nhiên"
      ], correct: 1, explanation: "Tránh thiên kiến chọn lọc." },
    { q: "Số lượt tối thiểu hợp lý cho mỗi biến thể trên mỗi máy trong bài?", options: [
        "1", "3", "Khoảng 30", "1000"
      ], correct: 2, explanation: "Đủ để ước lượng median, p90 và CI ổn định." }
  ]
});
