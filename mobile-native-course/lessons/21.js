window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Build, ký & phát hành",
  title: "Phát hành lên store: track thử nghiệm, review, rollout từng phần",
  subtitle: "Play: internal/closed/open/production + staged rollout · TestFlight + App Review + phased release · vitals · OTA được gì",

  theory: `
    <p>Deploy backend: bấm pipeline, 5 phút sau cả hệ thống chạy bản mới, lỗi thì rollback. Mobile thì <strong>không có rollback</strong>: bản đã cài nằm trên máy người dùng, nhiều người không cập nhật trong nhiều tháng.
    Vì vậy phát hành mobile xoay quanh: <em>thử kỹ trước</em>, <em>tung từ từ</em>, <em>theo dõi sát</em>, và <em>kill switch/feature flag từ server</em>.</p>

    <p><strong>Google Play Console</strong></p>
    <ul>
      <li><strong>Track</strong>: <em>Internal testing</em> (tối đa 100 tester, có ngay sau vài phút) → <em>Closed testing</em> (nhóm chọn lọc) → <em>Open testing</em> (ai cũng tham gia được) → <em>Production</em>.</li>
      <li>Tài khoản developer cá nhân mới phải chạy closed test với ít nhất 12 tester trong 14 ngày trước khi được lên production.</li>
      <li><strong>Staged rollout</strong>: phát cho 1% → 5% → 20% → 100%; thấy lỗi thì <em>halt</em> (dừng), sửa và phát bản versionCode mới.</li>
      <li>Yêu cầu hằng năm: <code>targetSdk</code> phải đủ mới (khoảng trong vòng một năm so với bản Android mới nhất); khai báo <em>Data safety</em>.</li>
      <li><strong>Android vitals</strong>: tỉ lệ crash và ANR vượt ngưỡng xấu (user-perceived ANR ≈ 0,47%, crash ≈ 1,09%) → app bị giảm hiển thị trên Play.</li>
    </ul>

    <p><strong>App Store Connect</strong></p>
    <ul>
      <li><strong>TestFlight</strong>: tester nội bộ (thành viên team, tối đa 100) thử ngay; tester ngoài (tối đa 10.000, qua email hoặc link công khai) cần <em>Beta App Review</em> cho build đầu. Build TestFlight hết hạn sau <strong>90 ngày</strong>.</li>
      <li><strong>App Review</strong> cho mọi bản production, thường trong 24–48 giờ; lý do từ chối hay gặp: crash, thiếu tài khoản demo, mô tả quyền mơ hồ, thanh toán số không qua In-App Purchase, thiếu nút xoá tài khoản khi có đăng ký tài khoản.</li>
      <li><strong>Phased release</strong>: tự động tăng dần trong 7 ngày (1% → 2% → 5% → 10% → 20% → 50% → 100%) cho người dùng bật tự cập nhật; có thể tạm dừng. Người dùng vẫn chủ động cập nhật được bất cứ lúc nào.</li>
      <li>Khai báo quyền riêng tư: <em>privacy nutrition label</em>, và <em>privacy manifest</em> (<code>PrivacyInfo.xcprivacy</code>) cho app và SDK bên thứ ba dùng "required reason API". Apple cũng nâng yêu cầu Xcode/SDK tối thiểu mỗi năm.</li>
    </ul>

    <p><strong>OTA update (CodePush, EAS Update) — thứ RN có mà native không có</strong>: RN có thể đẩy bản JS/asset mới không qua store, vì phần thay đổi là code thông dịch và không đổi mục đích app.
    Nhưng <em>mọi thay đổi native</em> (thư viện native mới, permission, SDK) vẫn phải qua store. App native thuần không có OTA code — thay vào đó dựa vào <strong>remote config / feature flag</strong> và UI điều khiển từ server.</p>

    <div class="callout"><p>💡 Tư duy backend áp dụng được: backend phải <strong>tương thích ngược</strong> với các bản app cũ nhiều tháng (versioned API, trường mới là optional), và nên có endpoint "phiên bản tối thiểu" để buộc cập nhật khi bắt buộc (Play có thêm In-App Updates API).</p></div>
  `,

  codeTabs: [
    { id: "play", label: "① Upload Play (Gradle Play Publisher / fastlane)", lines: [
      "# fastlane/Fastfile",
      "lane :internal do",
      "  gradle(task: 'bundle', flavor: 'prod', build_type: 'Release')",
      "  upload_to_play_store(track: 'internal', aab: lane_context[SharedValues::GRADLE_AAB_OUTPUT_PATH])",
      "end",
      "",
      "lane :promote_prod do",
      "  upload_to_play_store(track: 'internal', track_promote_to: 'production',",
      "                       rollout: '0.05')      # staged rollout 5%",
      "end"
    ]},
    { id: "ios", label: "② Upload TestFlight", lines: [
      "lane :beta do",
      "  app_store_connect_api_key(key_id: ENV['ASC_KEY_ID'], issuer_id: ENV['ASC_ISSUER'],",
      "                            key_filepath: 'AuthKey.p8')",
      "  increment_build_number(build_number: ENV['CI_PIPELINE_IID'])",
      "  build_app(scheme: 'Shop-Prod', export_method: 'app-store')",
      "  upload_to_testflight(groups: ['QA'], changelog: 'Sửa lỗi giỏ hàng')",
      "end"
    ]},
    { id: "flag", label: "③ Kill switch & bản tối thiểu", lines: [
      "// Backend (ví dụ JSON trả cho app lúc mở)",
      "{ 'minSupported': { 'android': 20100, 'ios': '2.1.0' },",
      "  'flags': { 'newCheckout': false } }      // tắt tính năng lỗi, không cần phát bản",
      "",
      "// App",
      "if (BuildConfig.VERSION_CODE < cfg.minSupported.android) showForceUpdate()",
      "if (cfg.flags.newCheckout) NewCheckout() else LegacyCheckout()"
    ]},
    { id: "cmp", label: "④ Backend deploy vs mobile release", lines: [
      "Backend:  build -> deploy -> 100% user trong vài phút -> lỗi thì rollback",
      "Mobile :  build -> ký -> upload -> review (giờ-ngày) -> rollout 1%..100% (ngày)",
      "          lỗi? KHÔNG rollback được bản đã cài",
      "          -> halt rollout + feature flag tắt + phát bản sửa (versionCode/build mới)",
      "          -> bản cũ còn sống nhiều tháng: API phải tương thích ngược"
    ]}
  ],

  stageHtml: `
    <div class="node" id="build"><div class="nl">📦 AAB / IPA đã ký</div><div class="ns">từ CI</div></div>
    <div class="arrow" id="a1">↓ upload</div>
    <div class="node" id="test"><div class="nl">🧪 Internal / TestFlight</div><div class="ns">QA, tester nội bộ</div></div>
    <div class="arrow" id="a2">↓ review</div>
    <div class="node" id="review"><div class="nl">🧑‍⚖️ App Review / Play review</div><div class="ns">giờ tới ngày</div></div>
    <div class="arrow" id="a3">↓ phát từng phần</div>
    <div class="node" id="roll"><div class="nl">📈 Staged / phased rollout</div><div class="ns">1% → 100%, theo dõi crash/ANR</div></div>
    <div class="arrow" id="a4">↓ có lỗi</div>
    <div class="node" id="stop"><div class="nl">🛑 Halt + feature flag + bản sửa</div><div class="ns">không có rollback</div></div>
  `,
  steps: [
    { title: "1 · Tự động upload từ CI", tab: "play", highlight: [2, 3, 4], on: ["build", "a1", "test"],
      desc: "Mỗi merge vào nhánh release → build AAB → internal track trong vài phút." },
    { title: "2 · TestFlight cho iOS", tab: "ios", highlight: [2, 4, 5, 6], on: ["test"],
      desc: "API key thay cho tài khoản cá nhân; build number tăng theo pipeline; nhóm QA nhận bản ngay." },
    { title: "3 · Review", tab: "cmp", highlight: [2], on: ["a2", "review"],
      desc: "Khác backend: có bên thứ ba duyệt, mất từ vài giờ tới vài ngày." },
    { title: "4 · Phát từng phần", tab: "play", highlight: [7, 8, 9], on: ["a3", "roll"],
      desc: "Rollout 5% trước; theo dõi Android vitals / Crashlytics rồi mới tăng." },
    { title: "5 · Có lỗi thì sao?", tab: "cmp", highlight: [3, 4, 5], on: ["a4", "stop"],
      desc: "Halt rollout, tắt tính năng bằng flag, phát bản sửa; API phải phục vụ được bản cũ." },
    { title: "6 · Điều khiển từ server", tab: "flag", highlight: [2, 3, 6, 7], on: ["stop"],
      desc: "Kill switch và phiên bản tối thiểu là 'rollback' gần nhất mà mobile có." }
  ],

  quiz: [
    { q: "Phát hiện crash nghiêm trọng khi bản mới đang rollout 5% trên Play. Nên làm gì?", options: [
        "Rollback bản đã cài trên máy người dùng", "Halt rollout, tắt tính năng bằng flag nếu có, phát bản sửa với versionCode mới", "Xoá app khỏi store", "Chờ người dùng tự gỡ"
      ], correct: 1, explanation: "Không thể gỡ bản đã cài; chỉ ngăn lan rộng và sửa nhanh." },
    { q: "Build TestFlight hết hạn sau bao lâu?", options: [
        "7 ngày", "30 ngày", "90 ngày", "Không hết hạn"
      ], correct: 2, explanation: "Sau 90 ngày tester không mở được build đó." },
    { q: "TestFlight tester ngoài (external) khác nội bộ ở điểm nào?", options: [
        "Không khác", "Tối đa 10.000 người, build cần qua Beta App Review", "Không cần Apple ID", "Chỉ trên iPad"
      ], correct: 1, explanation: "Tester nội bộ là thành viên team App Store Connect, tối đa 100." },
    { q: "Phased release của App Store kéo dài bao lâu nếu không tạm dừng?", options: [
        "1 ngày", "7 ngày", "30 ngày", "90 ngày"
      ], correct: 1, explanation: "1% → 2% → 5% → 10% → 20% → 50% → 100%." },
    { q: "Vì sao backend phải tương thích ngược với app cũ lâu hơn nhiều so với web?", options: [
        "Vì mobile không dùng HTTP", "Vì nhiều người dùng không cập nhật app trong thời gian dài, không ép được ngay", "Vì store cấm đổi API", "Không cần"
      ], correct: 1, explanation: "Web tải bản mới mỗi lần mở; app thì không." },
    { q: "OTA update (CodePush/EAS Update) của RN có thể cập nhật gì?", options: [
        "Mọi thứ kể cả thư viện native mới", "Chỉ bundle JS và asset; thay đổi native vẫn phải qua store", "Chỉ icon", "Không gì"
      ], correct: 1, explanation: "App native thuần không có cơ chế tương đương cho code." },
    { q: "Android vitals ảnh hưởng thế nào nếu tỉ lệ ANR vượt ngưỡng xấu?", options: [
        "Không ảnh hưởng", "App có thể bị giảm hiển thị trên Google Play", "App bị xoá ngay", "Tăng thứ hạng"
      ], correct: 1, explanation: "Ngưỡng user-perceived ANR khoảng 0,47%." },
    { q: "Track nào trên Play có bản cho tester nhanh nhất?", options: [
        "Production", "Open testing", "Internal testing", "Closed testing với review dài"
      ], correct: 2, explanation: "Internal testing sẵn sàng sau vài phút, tối đa 100 tester." },
    { q: "Privacy manifest (PrivacyInfo.xcprivacy) là gì?", options: [
        "Chứng chỉ ký", "File khai báo dữ liệu thu thập và lý do dùng các API nhạy cảm, cho app và SDK", "Cấu hình push", "File dịch"
      ], correct: 1, explanation: "Apple yêu cầu từ 2024 cho required reason API." }
  ]
});
