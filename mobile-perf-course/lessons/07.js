window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Công cụ đo",
  title: "React Native: DevTools, React Profiler, Hermes profiler — Flipper đã đi đâu?",
  subtitle: "Flame graph commit · 'why did this render' · sampling profiler của Hermes · profile bản release",

  theory: `
    <p>App RN có hai thế giới cần đo: <strong>JS</strong> (React, logic) và <strong>native</strong> (view, ảnh, module). Native đo bằng công cụ Android/iOS (bài 04–05).
    Bài này là phía JS.</p>

    <p><strong>Flipper đã bị bỏ</strong>: đánh dấu deprecated từ RN 0.73, gỡ khỏi template mặc định từ 0.74. Thay thế:</p>
    <ul>
      <li><strong>React Native DevTools</strong> (mặc định từ 0.76, mở bằng phím <code>j</code> trong Metro hoặc Dev Menu → Open DevTools): giao diện Chrome DevTools kết nối thẳng Hermes —
      Console, Sources/breakpoint, Memory (heap snapshot), và tab <em>React Components</em> + <em>React Profiler</em>. Các bản RN mới hơn bổ sung thêm panel Network/Performance.</li>
      <li>Công cụ cộng đồng cho nhu cầu riêng: Reactotron, plugin của Expo Dev Tools, Rozenite (plugin cho RN DevTools).</li>
    </ul>

    <p><strong>React Profiler</strong> (trong DevTools): bấm Record, thao tác, Stop. Mỗi <em>commit</em> là một lần React cập nhật UI. Xem:</p>
    <ul>
      <li><strong>Flame graph</strong>: component nào render trong commit đó và mất bao lâu (màu xám = không render).</li>
      <li><strong>Ranked</strong>: component tốn nhất lên đầu.</li>
      <li>Bật <em>"Record why each component rendered while profiling"</em> trong settings → biết lý do: props đổi, state đổi, hook đổi, hay parent render.</li>
    </ul>
    <p>Component <code>&lt;Profiler id onRender&gt;</code> của React đo được bằng code, nhưng bị tắt trong bản production thông thường.</p>

    <p><strong>Hermes sampling profiler</strong>: đo CPU của JS ở mức hàm (giống Time Profiler cho JS). Dev Menu → <em>Enable Sampling Profiler</em>, thao tác, tắt lại;
    rồi <code>npx react-native profile-hermes</code> kéo file về và đổi sang định dạng Chrome trace để mở bằng Chrome DevTools/Perfetto.
    Muốn đo bản <em>release</em> (không có overhead dev mode) có thư viện <code>react-native-release-profiler</code>.</p>

    <div class="callout"><p>💡 Quy trình: Perf Monitor (bài 03) khoanh thread nghẽn → nếu là JS: React Profiler xem có re-render thừa không (bài 11) → nếu render ít mà vẫn chậm:
    Hermes profiler tìm hàm JS tốn CPU. Nhớ rằng mọi số ở dev mode chỉ để <em>so sánh tương đối</em>, không để báo cáo.</p></div>
  `,

  codeTabs: [
    { id: "devtools", label: "① Mở DevTools", lines: [
      "# Chạy Metro, rồi nhấn 'j' để mở React Native DevTools",
      "npx react-native start",
      "#  › Press j │ open debugger",
      "",
      "# Hoặc Dev Menu trên máy: Cmd+D (iOS sim) / Cmd+M (Android emu) / lắc máy",
      "#   → Open DevTools",
      "",
      "# Tab có sẵn: Console · Sources · Memory · ⚛️ Components · ⚛️ Profiler"
    ]},
    { id: "prof", label: "② Đọc Profiler", lines: [
      "Commit #7 — 48.2 ms (gõ 1 ký tự vào ô tìm kiếm)",
      "",
      "ProductListScreen    47.9 ms   why: hook 2 changed (query)",
      "├─ SearchBar           0.8 ms   why: props changed (value)",
      "└─ FlatList          46.5 ms   why: parent rendered",
      "   ├─ ProductCard      0.9 ms   why: parent rendered   × 50 cell",
      "   └─ ...",
      "",
      "# 50 ProductCard render lại dù dữ liệu không đổi → re-render thừa (bài 11)"
    ]},
    { id: "hermes", label: "③ Hermes profiler", lines: [
      "# 1. Dev Menu → Enable Sampling Profiler",
      "# 2. Thao tác kịch bản chậm",
      "# 3. Dev Menu → Disable Sampling Profiler (file .cpuprofile được lưu trên máy)",
      "",
      "# 4. Kéo về và chuyển định dạng",
      "npx react-native profile-hermes ./profiles",
      "",
      "# 5. Mở file trong Chrome DevTools (Performance → Load profile) hoặc ui.perfetto.dev",
      "#    thấy: formatPrice 310 ms ← gọi Intl.NumberFormat mới mỗi lần"
    ]},
    { id: "code", label: "④ <Profiler> trong code", lines: [
      "import { Profiler } from 'react';",
      "",
      "function onRender(id, phase, actualDuration, baseDuration) {",
      "  // phase: 'mount' | 'update' | 'nested-update'",
      "  if (actualDuration > 16) console.warn(id, phase, actualDuration.toFixed(1));",
      "}",
      "",
      "<Profiler id='ProductList' onRender={onRender}>",
      "  <ProductList items={items} />",
      "</Profiler>",
      "// actualDuration: thời gian render thực tế (có memo); baseDuration: ước tính nếu render lại toàn bộ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="pm"><div class="nl">📟 Perf Monitor</div><div class="ns">JS fps hay UI fps thấp?</div></div>
    <div class="arrow" id="a1">↓ JS thấp</div>
    <div class="node" id="rp"><div class="nl">⚛️ React Profiler</div><div class="ns">commit nào dài · vì sao render</div></div>
    <div class="arrow" id="a2">↓ render ít mà vẫn chậm</div>
    <div class="node" id="hp"><div class="nl">🔥 Hermes sampling profiler</div><div class="ns">hàm JS nào tốn CPU</div></div>
    <div class="arrow" id="a3">↓ UI thấp</div>
    <div class="node" id="nat"><div class="nl">🛠️ Perfetto / Instruments</div><div class="ns">phía native</div></div>
  `,
  steps: [
    { title: "1 · Mở React Native DevTools", tab: "devtools", highlight: [1, 2, 3, 8], on: ["pm"],
      desc: "Flipper đã bị gỡ khỏi template. DevTools mới kết nối trực tiếp tới Hermes, không cần plugin native." },
    { title: "2 · Ghi một phiên Profiler", tab: "prof", highlight: [1, 3, 5, 6], on: ["a1", "rp"],
      desc: "Gõ một ký tự mà commit mất 48 ms: toàn bộ 50 card render lại chỉ vì parent render." },
    { title: "3 · Đọc 'why did this render'", tab: "prof", highlight: [3, 4, 6, 9], on: ["rp"],
      desc: "Lý do 'parent rendered' mà props không đổi → ứng viên cho React.memo/ổn định props." },
    { title: "4 · Hermes profiler cho CPU JS", tab: "hermes", highlight: [1, 3, 6, 9], on: ["a2", "hp"],
      desc: "Khi số lần render đã hợp lý mà vẫn chậm: xem hàm JS nào tốn CPU. Ví dụ tạo Intl.NumberFormat mới mỗi lần gọi." },
    { title: "5 · Đo bằng code", tab: "code", highlight: [3, 5, 8], on: ["rp"],
      desc: "<code>&lt;Profiler&gt;</code> hữu ích để log commit chậm khi phát triển; bản production thường không có số liệu này." },
    { title: "6 · Không phải JS? Sang native", tab: "devtools", highlight: [5, 6], on: ["a3", "nat"],
      desc: "UI fps thấp → ảnh lớn, layout nặng, overdraw: dùng Perfetto/Instruments như app native." }
  ],

  quiz: [
    { q: "Flipper hiện nay ở đâu trong hệ sinh thái RN?", options: [
        "Là công cụ debug mặc định",
        "Đã deprecated (0.73) và bị gỡ khỏi template (0.74); React Native DevTools là mặc định từ 0.76",
        "Được tích hợp vào Hermes",
        "Chỉ dùng cho iOS"
      ], correct: 1, explanation: "Flipper vẫn cài tay được nhưng không còn được khuyến nghị." },
    { q: "Trong React Profiler, một 'commit' là gì?", options: [
        "Một git commit",
        "Một lần React áp dụng thay đổi lên cây UI",
        "Một request mạng",
        "Một frame GPU"
      ], correct: 1, explanation: "Mỗi lần state/props đổi dẫn tới render + commit." },
    { q: "Làm sao biết VÌ SAO một component render lại?", options: [
        "Đoán",
        "Bật 'Record why each component rendered while profiling' trong React DevTools",
        "Dùng Perfetto",
        "Đọc logcat"
      ], correct: 1, explanation: "Profiler sẽ hiện: props đổi, state đổi, hook đổi, parent rendered." },
    { q: "Hermes sampling profiler trả lời câu hỏi nào?", options: [
        "Component nào render lại",
        "Hàm JS nào tiêu tốn CPU nhiều nhất",
        "Ảnh nào tốn bộ nhớ",
        "Request nào chậm"
      ], correct: 1, explanation: "Giống Time Profiler nhưng cho JS chạy trên Hermes." },
    { q: "Lệnh nào kéo file profile Hermes về máy và chuyển sang định dạng Chrome trace?", options: [
        "npx react-native profile-hermes", "npx react-native bundle", "adb logcat", "pod install"
      ], correct: 0, explanation: "Lệnh của React Native CLI." },
    { q: "Trong callback onRender của <Profiler>, actualDuration là gì?", options: [
        "Thời gian tải bundle",
        "Thời gian render thực tế của cây con trong commit đó (đã tính hiệu quả của memo)",
        "Thời gian từ khi mở app",
        "Thời gian GPU vẽ"
      ], correct: 1, explanation: "baseDuration là ước tính khi render lại toàn bộ không memo." },
    { q: "Số liệu profiler lấy ở dev mode nên dùng thế nào?", options: [
        "Báo cáo cho sếp làm số chính thức",
        "Để so sánh tương đối, khoanh vùng vấn đề; số chính thức phải đo bản release",
        "Bỏ qua hoàn toàn",
        "Nhân đôi để ra số release"
      ], correct: 1, explanation: "Dev mode có overhead không đều giữa các phần code." },
    { q: "Perf Monitor cho UI fps thấp, JS fps cao. Bước tiếp theo hợp lý?", options: [
        "Mở React Profiler",
        "Profile phía native bằng Perfetto/Instruments (ảnh, layout, overdraw)",
        "Thêm useCallback",
        "Tắt Hermes"
      ], correct: 1, explanation: "JS không phải nút thắt." },
    { q: "Muốn profile JS ở bản release của RN, có thể dùng gì?", options: [
        "Không thể",
        "Thư viện như react-native-release-profiler",
        "Chỉ Flipper",
        "Chrome remote debugging"
      ], correct: 1, explanation: "Giúp đo không có overhead của dev mode." }
  ]
});
