window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Code & gói phát hành",
  title: "Chống reverse engineering & giả mạo",
  subtitle: "R8/ProGuard · Hermes bytecode · obfuscate Dart · kiểm tra toàn vẹn · phát hiện root/jailbreak/debugger — giá trị thật và giới hạn",

  theory: `
    <p>Nhóm biện pháp này (MASVS-RESILIENCE) nhằm làm cho việc <strong>đọc hiểu</strong> và <strong>sửa đổi</strong> app tốn nhiều công sức hơn.
    Điều quan trọng nhất cần nhớ trước khi đọc tiếp: <strong>đây là lớp làm chậm, không phải lớp bảo vệ</strong>.
    Người kiểm soát thiết bị cuối cùng luôn có thể vượt qua. Giá trị của chúng là nâng chi phí tấn công và tạo tín hiệu cho server.</p>

    <p><strong>1. Khi nào đáng đầu tư?</strong></p>
    <ul>
      <li><strong>Đáng</strong>: game có kinh tế ảo, app ngân hàng/ví (chống app giả mạo, chống tự động hoá), app có nội dung trả phí cần DRM, app có thuật toán độc quyền.</li>
      <li><strong>Ít đáng</strong>: app thương mại thông thường — thời gian nên dành cho server-side validation trước.</li>
      <li><strong>Không bao giờ</strong>: dùng để thay thế kiểm tra phía server hay để "giấu" secret (bài 17).</li>
    </ul>

    <p><strong>2. Làm rối code (obfuscation) theo nền tảng</strong></p>
    <table>
      <tr><th>Nền tảng</th><th>Công cụ</th><th>Làm được</th><th>Không làm được</th></tr>
      <tr><td>Android (Kotlin/Java)</td><td>R8 (mặc định), ProGuard; công cụ thương mại</td><td>Đổi tên lớp/hàm/biến, bỏ code thừa, tối ưu</td><td>Giấu chuỗi hằng, giấu lời gọi API hệ thống</td></tr>
      <tr><td>iOS (Swift/ObjC)</td><td>Strip symbol khi build release; công cụ thương mại</td><td>Bỏ tên symbol không cần</td><td>Nhiều tên ObjC/Swift vẫn còn cho runtime</td></tr>
      <tr><td>React Native</td><td>Minify + Hermes bytecode</td><td>Khó đọc hơn JS thuần</td><td>Có công cụ decompile Hermes công khai; logic vẫn khôi phục được</td></tr>
      <tr><td>Flutter</td><td><code>--obfuscate --split-debug-info</code></td><td>Làm rối tên symbol Dart trong AOT</td><td>Chuỗi hằng vẫn còn</td></tr>
    </table>
    <p>Lưu ý: bật obfuscation thì <strong>phải lưu mapping/symbol</strong> (mapping.txt, dSYM, thư mục split-debug-info, source map) ở nơi riêng tư để giải mã crash report —
    và <strong>không</strong> đóng gói chúng vào app hay để public (bài 21).</p>

    <p><strong>3. Kiểm tra toàn vẹn (anti-tampering)</strong></p>
    <ul>
      <li>Kẻ tấn công có thể sửa app (bỏ kiểm tra premium, chèn mã quảng cáo/đánh cắp dữ liệu), ký lại bằng khoá của họ rồi phát tán ("app mod", app giả mạo ngân hàng).</li>
      <li>App tự kiểm tra: chữ ký hiện tại có đúng chứng chỉ phát hành của bạn không, cài từ store chính thức không, hash file có bị đổi không.</li>
      <li>Giới hạn: kiểm tra chạy trong app → kẻ sửa app cũng sửa luôn kiểm tra. Đáng tin hơn: <strong>attestation xác minh ở server</strong> (Play Integrity trả về app có được nhận diện là bản gốc không; App Attest chỉ hoạt động với bản app hợp lệ — bài 10).</li>
    </ul>

    <p><strong>4. Phát hiện môi trường rủi ro</strong></p>
    <ul>
      <li><strong>Root/jailbreak</strong>: sự tồn tại của công cụ quản lý quyền root, phân vùng hệ thống bị sửa, sandbox bị nới lỏng…</li>
      <li><strong>Debugger</strong>: tiến trình đang bị gắn debugger, cờ debuggable bật trên bản release.</li>
      <li><strong>Emulator</strong>: thuộc tính phần cứng/giá trị hệ thống đặc trưng của máy ảo (hữu ích để chống bot farm).</li>
      <li><strong>Hooking framework</strong>: thư viện lạ nạp vào tiến trình, cổng/tiến trình đặc trưng của công cụ instrumentation.</li>
      <li>Thư viện có sẵn: các thư viện phát hiện mã nguồn mở cho từng nền tảng (ví dụ RootBeer cho Android, IOSSecuritySuite cho iOS, freeRASP cho nhiều nền tảng), hoặc giải pháp RASP thương mại.</li>
    </ul>

    <p><strong>5. Phản ứng thế nào khi phát hiện? — thiết kế quan trọng hơn kỹ thuật phát hiện</strong></p>
    <ul>
      <li><strong>Tránh</strong>: crash ngay tại chỗ kiểm tra với thông báo rõ ràng — chỉ cho kẻ tấn công đúng chỗ cần vô hiệu hoá.</li>
      <li><strong>Nên</strong>: gửi tín hiệu về server (kèm attestation) → server quyết định theo mức rủi ro: yêu cầu xác thực thêm, giới hạn giao dịch, gắn cờ tài khoản để xem xét,
        tắt một số tính năng rủi ro cao. Người dùng root hợp pháp vẫn dùng được phần cơ bản.</li>
      <li>Nhiều điểm kiểm tra rải rác, chạy vào thời điểm khác nhau, khó vô hiệu hoá hơn một hàm <code>isRooted()</code> duy nhất.</li>
      <li>Tránh false positive làm hỏng trải nghiệm người dùng thật (máy ROM tuỳ biến, máy của nhà phát triển).</li>
    </ul>

    <p><strong>6. Defense in depth — xếp các lớp</strong></p>
    <ol>
      <li>Server-side validation và phân quyền (bắt buộc, lớp chính).</li>
      <li>Attestation được server xác minh.</li>
      <li>Dữ liệu nhạy cảm trong Keystore/Keychain, device binding.</li>
      <li>Obfuscation + kiểm tra toàn vẹn + phát hiện môi trường (lớp làm chậm).</li>
      <li>Giám sát phía server: hành vi bất thường, tốc độ bất thường, nhiều tài khoản từ một thiết bị.</li>
    </ol>

    <div class="callout"><p>💡 Bài test cho mọi biện pháp resilience: <strong>"Giả sử kẻ tấn công đã tắt được biện pháp này — hệ thống còn an toàn không?"</strong>
    Nếu không, bạn đang dùng lớp làm chậm như lớp bảo vệ, và cần bổ sung kiểm soát phía server.</p></div>
  `,

  codeTabs: [
    { id: "r8", label: "🤖 R8 / ProGuard", lines: [
      "// build.gradle.kts (module app)",
      "android {",
      "    buildTypes {",
      "        release {",
      "            isMinifyEnabled = true            // bật R8: rút gọn + làm rối",
      "            isShrinkResources = true",
      "            proguardFiles(getDefaultProguardFile(\"proguard-android-optimize.txt\"),",
      "                          \"proguard-rules.pro\")",
      "        }",
      "    }",
      "}",
      "",
      "# proguard-rules.pro: xoá log debug khỏi bản release",
      "-assumenosideeffects class android.util.Log { public static int d(...); public static int v(...); }",
      "# Giữ số dòng để đọc crash (mapping.txt lưu riêng, KHÔNG public)",
      "-keepattributes SourceFile,LineNumberTable"
    ]},
    { id: "xplat", label: "⚛️ Hermes & Flutter", lines: [
      "# React Native: Hermes bật mặc định trong các bản RN mới",
      "# android/gradle.properties",
      "hermesEnabled=true",
      "# -> bundle là Hermes bytecode; source map giữ riêng để giải mã crash",
      "",
      "# Flutter: làm rối symbol Dart + tách thông tin debug",
      "flutter build apk --release --obfuscate --split-debug-info=build/symbols",
      "flutter build ipa --release --obfuscate --split-debug-info=build/symbols",
      "# build/symbols: upload lên hệ thống crash, KHÔNG đưa vào gói, KHÔNG commit",
      "",
      "# iOS native: strip symbol trong Release",
      "STRIP_INSTALLED_PRODUCT = YES; DEPLOYMENT_POSTPROCESSING = YES"
    ]},
    { id: "integrity", label: "🧾 Kiểm tra toàn vẹn", lines: [
      "// Android: so chữ ký hiện tại với fingerprint phát hành (lớp làm chậm)",
      "val info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)",
      "val current = info.signingInfo.apkContentsSigners.map { sha256(it.toByteArray()) }",
      "val tampered = EXPECTED_CERT_SHA256 !in current",
      "",
      "// Nguồn cài đặt",
      "val installer = pm.getInstallSourceInfo(packageName).installingPackageName",
      "",
      "// Không crash tại chỗ — gửi tín hiệu kèm attestation cho server quyết định",
      "riskSignals.add(\"signature_mismatch\", tampered)",
      "riskSignals.add(\"installer\", installer)",
      "api.post(\"/session/risk\", riskSignals + integrityToken)"
    ]},
    { id: "detect", label: "📡 Tín hiệu môi trường", lines: [
      "// Pseudo-code: thu thập nhiều tín hiệu, không phụ thuộc một hàm",
      "signals = {",
      "  rooted:        rootChecks.any(),           // thư viện phát hiện root/jailbreak",
      "  debugger:      isDebuggerAttached(),",
      "  emulator:      emulatorHeuristics(),",
      "  hooking:       suspiciousLibrariesLoaded(),",
      "  attestation:   await platformAttestation(serverNonce),",
      "}",
      "",
      "// Server chấm điểm và phản ứng theo mức",
      "score = risk(verify(signals.attestation), signals, accountHistory)",
      "if score >= HIGH:   requireStepUp(); limit('transfer', 2_000_000); flagForReview()",
      "elif score >= MED:  requireStepUpForSensitiveActions()",
      "else:               normal()"
    ]},
    { id: "layers", label: "🧱 Xếp lớp", lines: [
      "# Hỏi với từng lớp: nếu lớp này bị vô hiệu thì sao?",
      "",
      "Lớp 1  Server validation + phân quyền      -> BẮT BUỘC, không thể thiếu",
      "Lớp 2  Attestation verify ở server         -> lọc app giả/máy giả phần lớn",
      "Lớp 3  Keystore/Keychain + device binding  -> token trộm không dùng nơi khác được",
      "Lớp 4  Obfuscation, integrity, root check  -> tăng thời gian phân tích",
      "Lớp 5  Giám sát hành vi phía server        -> phát hiện khi các lớp trên bị vượt",
      "",
      "# Sai lầm: dùng Lớp 4 thay cho Lớp 1"
    ]}
  ],

  stageHtml: `
    <div class="node" id="attacker"><div class="nl">🔬 Kẻ phân tích / sửa app</div><div class="ns">decompile, hook, ký lại, phát tán bản mod</div></div>
    <div class="arrow" id="a1">↓ lớp làm chậm (trên thiết bị)</div>
    <div class="row">
      <div class="node" id="obf"><div class="nl">🌀 Obfuscation</div><div class="ns">R8 · Hermes · --obfuscate</div></div>
      <div class="node" id="integ"><div class="nl">🧾 Toàn vẹn</div><div class="ns">chữ ký · nguồn cài</div></div>
      <div class="node" id="env"><div class="nl">📡 Môi trường</div><div class="ns">root · debugger · hook · emulator</div></div>
    </div>
    <div class="arrow" id="a2">↓ gửi tín hiệu, không crash tại chỗ</div>
    <div class="node" id="server"><div class="nl">🖥️ Server: attestation + chấm điểm rủi ro</div><div class="ns">step-up · giới hạn · gắn cờ</div></div>
    <div class="arrow" id="a3">↓ lớp bảo vệ thật</div>
    <div class="node" id="core"><div class="nl">🛡️ Validation + phân quyền phía server</div><div class="ns">vẫn đúng kể cả khi mọi lớp trên bị vượt</div></div>
  `,

  steps: [
    { title: "1 · Làm rối code Android", tab: "r8", highlight: [5, 6, 7, 14, 16], on: ["attacker", "a1", "obf"],
      desc: "R8 đổi tên, bỏ code thừa, có thể xoá lời gọi Log.d. Giữ số dòng và lưu mapping.txt riêng để đọc crash — mapping không được public." },
    { title: "2 · Hermes, Flutter, iOS", tab: "xplat", highlight: [3, 7, 8, 9, 12], on: ["obf"],
      desc: "Hermes bytecode và <code>--obfuscate</code> làm khó hơn, không làm không thể. Thư mục symbol/source map lưu riêng tư." },
    { title: "3 · Kiểm tra toàn vẹn", tab: "integrity", highlight: [2, 3, 4, 7], on: ["integ"],
      desc: "So chữ ký hiện tại với fingerprint phát hành, kiểm tra nguồn cài. Kẻ sửa app có thể sửa luôn đoạn này — nên nó chỉ là tín hiệu." },
    { title: "4 · Gửi tín hiệu thay vì crash", tab: "integrity", highlight: [10, 11, 12], on: ["a2", "server"],
      desc: "Crash tại chỗ chỉ đường cho kẻ tấn công. Gửi tín hiệu kèm attestation để server quyết định." },
    { title: "5 · Nhiều tín hiệu, phản ứng theo mức", tab: "detect", highlight: [3, 4, 5, 6, 7, 11, 12, 13], on: ["env", "server"],
      desc: "Root, debugger, emulator, hook, attestation → điểm rủi ro. Cao thì step-up + giới hạn + gắn cờ; người dùng hợp pháp vẫn dùng được cơ bản." },
    { title: "6 · Server mới là lớp bảo vệ", tab: "layers", highlight: [3, 4, 5, 6, 7, 9], on: ["a3", "core"],
      desc: "Mọi lớp trên thiết bị đều có thể bị vượt. Kiểm tra phía server phải đúng ngay cả khi kẻ tấn công đã tắt hết các lớp làm chậm." }
  ],

  quiz: [
    { q: "Vai trò đúng của obfuscation và root detection là gì?", options: [
        "Bảo vệ tuyệt đối app khỏi bị sửa",
        "Lớp làm chậm: tăng chi phí phân tích và tạo tín hiệu rủi ro, không thay kiểm tra phía server",
        "Thay thế HTTPS",
        "Giấu API secret an toàn"
      ], correct: 1,
      explanation: "Người kiểm soát thiết bị cuối cùng luôn vượt qua được kiểm tra chạy trên thiết bị." },
    { q: "R8 làm được gì với chuỗi hằng như URL hay key?", options: [
        "Mã hoá chúng",
        "Gần như không — chủ yếu đổi tên lớp/hàm và bỏ code thừa",
        "Xoá chúng khỏi gói",
        "Chuyển chúng lên server"
      ], correct: 1,
      explanation: "Chuỗi hằng vẫn đọc được sau khi obfuscate." },
    { q: "Bật --obfuscate cho Flutter thì cần làm gì với thư mục --split-debug-info?", options: [
        "Đóng gói vào app",
        "Lưu riêng tư (upload lên hệ thống crash), không commit, không public",
        "Xoá luôn",
        "Đăng lên web cho người dùng"
      ], correct: 1,
      explanation: "Thiếu nó thì không đọc được crash; lộ nó thì mất lợi ích obfuscation." },
    { q: "Phát hiện root thì app crash ngay với thông báo 'Thiết bị đã root'. Nhược điểm?", options: [
        "Không có nhược điểm",
        "Chỉ đúng chỗ cho kẻ tấn công vô hiệu hoá, và làm hỏng trải nghiệm người dùng hợp pháp",
        "Tốn pin",
        "Vi phạm HTTPS"
      ], correct: 1,
      explanation: "Gửi tín hiệu cho server phản ứng theo mức rủi ro là cách tốt hơn." },
    { q: "Kiểm tra chữ ký app trong code để phát hiện bản mod có hạn chế gì?", options: [
        "Không có hạn chế",
        "Kẻ sửa app có thể sửa luôn đoạn kiểm tra; attestation xác minh ở server đáng tin hơn",
        "Chỉ chạy trên iOS",
        "Làm app nặng hơn nhiều"
      ], correct: 1,
      explanation: "Kiểm tra cục bộ là tín hiệu; server-side attestation là bằng chứng mạnh hơn." },
    { q: "Hermes bytecode trong React Native có ngăn được reverse engineering không?", options: [
        "Có, hoàn toàn",
        "Không — có công cụ decompile công khai; chỉ khó hơn JS thuần",
        "Có, trên Android",
        "Có, nếu thêm minify"
      ], correct: 1,
      explanation: "Hermes nhằm hiệu năng; không phải cơ chế bảo mật." },
    { q: "App thương mại thông thường có ít thời gian bảo mật. Nên ưu tiên gì trước?", options: [
        "RASP thương mại đắt tiền",
        "Validation và phân quyền phía server, lưu trữ an toàn, HTTPS đúng",
        "Obfuscation nhiều lớp",
        "Chống emulator"
      ], correct: 1,
      explanation: "Resilience là lớp bổ sung; nền tảng phải vững trước." },
    { q: "Vì sao nên rải nhiều điểm kiểm tra thay vì một hàm isRooted()?", options: [
        "Để code dài hơn",
        "Một hàm duy nhất dễ bị hook để luôn trả false; nhiều điểm, nhiều thời điểm khó vô hiệu hoá hơn",
        "Để chạy nhanh hơn",
        "Apple yêu cầu"
      ], correct: 1,
      explanation: "Tăng chi phí tấn công là mục tiêu của lớp làm chậm." },
    { q: "Câu hỏi kiểm tra đúng cho mọi biện pháp resilience?", options: [
        "Biện pháp này có đắt không?",
        "Nếu kẻ tấn công đã tắt biện pháp này, hệ thống còn an toàn không?",
        "Có bao nhiêu dòng code?",
        "Có chạy trên emulator không?"
      ], correct: 1,
      explanation: "Nếu không còn an toàn thì đang đặt kiểm soát sai chỗ." }
  ]
});
