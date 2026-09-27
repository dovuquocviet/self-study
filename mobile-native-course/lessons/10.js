window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "React Native bên dưới",
  title: "New Architecture: JSI, Fabric, TurboModules, Hermes — và cái giá còn lại",
  subtitle: "Bỏ bridge JSON · gọi C++ đồng bộ · lazy module · bytecode AOT · vì sao native vẫn nhanh hơn",

  theory: `
    <p>Để sửa những giới hạn ở bài 09, Meta viết lại lõi RN. <strong>New Architecture</strong> thành mặc định từ RN <strong>0.76</strong> (10/2024), và từ <strong>0.82</strong> (10/2025) là kiến trúc <em>duy nhất</em>: đặt <code>newArchEnabled=false</code> sẽ bị bỏ qua.</p>

    <table>
      <tr><th>Mảnh ghép</th><th>Thay cho</th><th>Ý tưởng</th></tr>
      <tr><td><strong>JSI</strong> (JavaScript Interface)</td><td>Bridge JSON</td><td>API C++ cho phép JS giữ tham chiếu tới object C++ (<em>host object</em>) và gọi hàm trực tiếp — có thể <strong>đồng bộ</strong>, không serialize JSON</td></tr>
      <tr><td><strong>Fabric</strong></td><td>UIManager + shadow thread cũ</td><td>Renderer mới, shadow tree viết bằng C++ dùng chung hai nền tảng; có thể render đồng bộ khi cần (đo layout trong cùng frame), hỗ trợ tính năng concurrent của React 18+</td></tr>
      <tr><td><strong>TurboModules</strong></td><td>Native Modules cũ</td><td>Nạp <em>lazy</em> khi lần đầu dùng; gọi qua JSI</td></tr>
      <tr><td><strong>Codegen</strong></td><td>Hợp đồng "tự hiểu ngầm"</td><td>Từ spec TypeScript sinh code C++/ObjC/Java kiểu chặt → sai kiểu bị bắt lúc build</td></tr>
      <tr><td><strong>Bridgeless</strong></td><td>Khởi tạo bridge</td><td>Bỏ hẳn bridge khỏi runtime (mặc định cùng New Arch)</td></tr>
    </table>

    <p><strong>Hermes</strong> là JS engine của Meta tối ưu cho mobile, mặc định từ RN 0.70. Điểm mấu chốt: JS được <em>biên dịch sẵn thành bytecode lúc build</em> (<code>hermesc</code>),
    nên lúc mở app không phải parse/compile JS → khởi động nhanh, ít RAM. Hermes không có JIT (đổi đỉnh tốc độ lấy khởi động nhanh và bộ nhớ ổn định).</p>

    <p><strong>Cái giá vẫn còn — vì sao native thuần vẫn nhanh hơn</strong></p>
    <ol>
      <li><strong>Khởi động</strong>: vẫn phải nạp JS runtime + bundle bytecode + khởi tạo React trước khi vẽ màn đầu. Native chỉ cần nạp binary.</li>
      <li><strong>JS vẫn đơn luồng</strong>: business logic, reconciliation của React vẫn chung một JS thread. Tính toán nặng vẫn chặn phản hồi.</li>
      <li><strong>Hai cây</strong>: React element tree (JS) → shadow tree (C++) → native view. Native Compose/SwiftUI chỉ có một tầng.</li>
      <li><strong>Bộ nhớ</strong>: thêm heap của JS engine + GC riêng, song song với heap ART/ARC của nền tảng.</li>
      <li><strong>Truy cập nền tảng</strong>: API mới của OS (widget, Live Activity, App Intents, Material 3 mới) phải chờ thư viện bọc lại hoặc tự viết module.</li>
    </ol>

    <div class="callout"><p>💡 JSI nhanh nhưng <strong>gọi đồng bộ cũng có thể chặn</strong>: một hàm native chậm được gọi sync từ JS sẽ chặn JS thread. Và Reanimated chạy "worklet" trên UI thread nhờ JSI —
    mạnh, nhưng worklet nặng thì chặn chính UI thread. JSI xoá chi phí serialize, không xoá quy tắc bài 05.</p></div>
  `,

  codeTabs: [
    { id: "spec", label: "① TurboModule spec (TS)", lines: [
      "// NativeCartStore.ts — Codegen đọc file này",
      "import type { TurboModule } from 'react-native';",
      "import { TurboModuleRegistry } from 'react-native';",
      "",
      "export interface Spec extends TurboModule {",
      "  getCount(): number;                        // gọi đồng bộ qua JSI",
      "  save(items: string): Promise<void>;       // bất đồng bộ",
      "}",
      "export default TurboModuleRegistry.getEnforcing<Spec>('CartStore');"
    ]},
    { id: "kt", label: "② Hiện thực Android", lines: [
      "// NativeCartStoreSpec do Codegen sinh ra từ spec TS",
      "class CartStoreModule(ctx: ReactApplicationContext) : NativeCartStoreSpec(ctx) {",
      "    override fun getName() = NAME",
      "    override fun getCount(): Double = prefs.getInt(\"count\", 0).toDouble()",
      "    override fun save(items: String, promise: Promise) {",
      "        scope.launch(Dispatchers.IO) { file.writeText(items); promise.resolve(null) }",
      "    }",
      "    companion object { const val NAME = \"CartStore\" }",
      "}"
    ]},
    { id: "cfg", label: "③ Cấu hình", lines: [
      "# android/gradle.properties",
      "newArchEnabled=true        # từ RN 0.82: luôn bật, đặt false bị bỏ qua",
      "hermesEnabled=true",
      "",
      "# iOS: Podfile / pod install",
      "RCT_NEW_ARCH_ENABLED=1 bundle exec pod install",
      "",
      "# Bundle Hermes = bytecode, không phải JS text",
      "$ file index.android.bundle",
      "index.android.bundle: Hermes JavaScript bytecode, version <n>"
    ]},
    { id: "cmp", label: "④ Đường đi của một cú chạm", lines: [
      "RN kiến trúc cũ:  touch -> JSON -> bridge (async) -> JS -> diff -> JSON -> bridge -> shadow -> UI",
      "RN New Arch:      touch -> JSI -> JS -> diff -> Fabric C++ shadow tree -> UI",
      "Native Compose:   touch -> onClick (Kotlin) -> state đổi -> recompose -> UI",
      "Native SwiftUI:   touch -> action (Swift) -> @State đổi -> body -> UI"
    ]}
  ],

  stageHtml: `
    <div class="node" id="js"><div class="nl">🟨 JS thread (Hermes bytecode)</div><div class="ns">React, business logic</div></div>
    <div class="arrow" id="a1">↓ JSI: gọi C++ trực tiếp, không JSON</div>
    <div class="row">
      <div class="node" id="fabric"><div class="nl">🧶 Fabric (C++)</div><div class="ns">shadow tree + Yoga dùng chung</div></div>
      <div class="node" id="turbo"><div class="nl">⚡ TurboModules</div><div class="ns">lazy, kiểu chặt nhờ Codegen</div></div>
    </div>
    <div class="arrow" id="a2">↓ mount</div>
    <div class="node" id="ui"><div class="nl">🧵 UI thread — native view</div><div class="ns">có thể cập nhật đồng bộ</div></div>
    <div class="arrow" id="a3">↓ vẫn còn</div>
    <div class="node" id="cost"><div class="nl">💸 Chi phí còn lại</div><div class="ns">khởi động runtime · JS đơn luồng · 2 cây · 2 heap</div></div>
  `,
  steps: [
    { title: "1 · Spec TypeScript → Codegen", tab: "spec", highlight: [5, 6, 7, 9], on: ["turbo"],
      desc: "Hợp đồng JS ⇄ native được khai báo kiểu chặt; Codegen sinh lớp nền cho Android/iOS." },
    { title: "2 · Hiện thực native", tab: "kt", highlight: [2, 4, 6], on: ["turbo"],
      desc: "getCount trả về đồng bộ qua JSI; save chạy trên IO rồi resolve Promise." },
    { title: "3 · JSI thay bridge", tab: "cmp", highlight: [1, 2], on: ["js", "a1"],
      desc: "Không còn serialize JSON và hàng đợi bất đồng bộ bắt buộc." },
    { title: "4 · Fabric dựng cây C++", tab: "cmp", highlight: [2], on: ["fabric", "a2", "ui"],
      desc: "Shadow tree C++ dùng chung, có thể đo và cập nhật đồng bộ trong cùng frame." },
    { title: "5 · Hermes: bytecode lúc build", tab: "cfg", highlight: [2, 3, 9, 10], on: ["js"],
      desc: "Bundle là bytecode nên lúc mở app không phải parse JS; mặc định từ RN 0.70." },
    { title: "6 · Native vẫn ít tầng hơn", tab: "cmp", highlight: [3, 4], on: ["a3", "cost"],
      desc: "Native không có JS runtime, không có cây thứ hai, không có heap thứ hai." }
  ],

  quiz: [
    { q: "JSI thay thế thành phần nào của kiến trúc cũ?", options: [
        "Yoga", "Bridge bất đồng bộ serialize JSON", "Hermes", "Metro bundler"
      ], correct: 1, explanation: "JSI cho JS gọi trực tiếp object C++." },
    { q: "Từ phiên bản React Native nào New Architecture là kiến trúc duy nhất (không tắt được)?", options: [
        "0.68", "0.76", "0.82", "1.0"
      ], correct: 2, explanation: "0.76 bật mặc định; 0.82 bỏ qua newArchEnabled=false." },
    { q: "TurboModules khác Native Modules cũ ở điểm nào?", options: [
        "Viết bằng Python", "Nạp lazy khi dùng lần đầu, gọi qua JSI, kiểu chặt nhờ Codegen", "Chạy trên server", "Chỉ cho iOS"
      ], correct: 1, explanation: "Giảm thời gian khởi động và lỗi sai kiểu." },
    { q: "Vì sao Hermes giúp app khởi động nhanh hơn?", options: [
        "Có JIT mạnh", "JS được biên dịch sẵn thành bytecode lúc build, lúc chạy không phải parse/compile", "Bỏ React", "Chạy JS trên GPU"
      ], correct: 1, explanation: "hermesc chạy lúc build." },
    { q: "Fabric mang lại khả năng gì mà kiến trúc cũ thiếu?", options: [
        "Viết UI bằng HTML", "Render/đo layout đồng bộ khi cần và hỗ trợ tính năng concurrent của React", "Không cần native view", "Tự động đa luồng JS"
      ], correct: 1, explanation: "Shadow tree C++ truy cập được từ nhiều thread." },
    { q: "Với New Architecture, JS còn đơn luồng không?", options: [
        "Không, mỗi component một thread", "Có — logic và reconciliation vẫn trên một JS thread", "Chỉ trên Android", "Tuỳ Hermes"
      ], correct: 1, explanation: "Tính toán nặng trong JS vẫn chặn phản hồi." },
    { q: "Một hàm TurboModule đồng bộ chạy 300 ms được gọi từ JS. Hậu quả?", options: [
        "Không sao vì JSI nhanh", "JS thread bị chặn 300 ms", "Tự chuyển sang nền", "Crash ngay"
      ], correct: 1, explanation: "JSI bỏ chi phí serialize, không bỏ chi phí của chính việc bạn làm." },
    { q: "Lý do nào KHÔNG phải là vì sao native thuần vẫn nhanh hơn RN New Arch?", options: [
        "Không phải khởi động JS runtime", "Không có cây shadow thứ hai", "Không có heap JS thứ hai", "Native view vẽ bằng WebView nên nhẹ hơn"
      ], correct: 3, explanation: "Cả RN và native đều dùng native view; WebView không liên quan." },
    { q: "Codegen trong New Architecture làm gì?", options: [
        "Sinh JS từ Kotlin", "Sinh code native kiểu chặt từ spec TypeScript/Flow", "Nén ảnh", "Ký app"
      ], correct: 1, explanation: "Sai lệch kiểu giữa JS và native bị bắt lúc build." }
  ]
});
