window.LESSONS.push({
  id: "17",
  phase: "4", phaseName: "Hiệu năng",
  title: "Hiệu năng: allocation, clone, Cow, Arc & đo đạc bằng flamegraph/criterion",
  subtitle: "chi phí thật của clone · with_capacity · Cow · Arc<str> & Bytes · release profile · criterion benchmark · cargo flamegraph · allocator",

  theory: `
    <p>Rust nhanh "mặc định" so với Java ở chỗ không có GC pause và không có JIT warm-up. Nhưng code Rust viết vội vẫn có thể chậm — thủ phạm gần như luôn là
    <strong>cấp phát heap thừa</strong> và <strong>sao chép thừa</strong>. Quy tắc số một: <em>đo trước khi tối ưu</em>.</p>

    <p><strong>1. Biết cái gì tốn tiền</strong></p>
    <table>
      <tr><th>Thao tác</th><th>Chi phí</th></tr>
      <tr><td>Move một <code>String</code>/<code>Vec</code></td><td>Copy 24 byte (con trỏ, len, cap) — rẻ</td></tr>
      <tr><td><code>.clone()</code> <code>String</code>/<code>Vec</code></td><td>Cấp phát heap + copy toàn bộ nội dung</td></tr>
      <tr><td><code>Arc::clone</code></td><td>Một phép cộng atomic — rẻ, nhưng tranh chấp nếu mọi core cùng clone một Arc</td></tr>
      <tr><td><code>format!</code>, <code>to_string()</code>, <code>collect::&lt;Vec&lt;_&gt;&gt;()</code></td><td>Mỗi lần một cấp phát</td></tr>
      <tr><td><code>Vec::push</code> không có capacity</td><td>Tăng gấp đôi + copy lại khi đầy (log n lần)</td></tr>
      <tr><td><code>Box&lt;dyn Trait&gt;</code>, <code>async_trait</code></td><td>Một cấp phát mỗi lần tạo</td></tr>
    </table>

    <p><strong>2. Kỹ thuật giảm cấp phát</strong></p>
    <ul>
      <li><strong>Mượn thay vì clone</strong>: tham số <code>&amp;str</code>/<code>&amp;[T]</code>. "Clone cho qua borrow checker" chấp nhận được ở code nguội, không ở vòng lặp nóng.</li>
      <li><code>Vec::with_capacity(n)</code>, <code>String::with_capacity</code> khi biết trước kích thước; tái sử dụng buffer với <code>clear()</code> (giữ capacity).</li>
      <li><code>Cow&lt;'a, str&gt;</code>: trả tham chiếu khi không cần sửa, chỉ cấp phát khi phải sửa (chuẩn hoá chuỗi, escape).</li>
      <li><code>Arc&lt;str&gt;</code> thay <code>String</code> cho dữ liệu bất biến chia sẻ nhiều nơi (tên tenant, cấu hình): clone = tăng refcount.
        <code>bytes::Bytes</code> cho payload mạng: slice và clone không copy (hyper/axum/Kafka client dùng sẵn).</li>
      <li>Ghi thẳng vào writer (<code>write!(buf, ...)</code>) thay vì <code>format!</code> rồi nối.</li>
      <li>Allocator: đổi sang <code>mimalloc</code>/<code>jemalloc</code> (<code>#[global_allocator]</code>) thường cải thiện service nhiều luồng cấp phát dày — một dòng code, nhưng vẫn phải đo.</li>
    </ul>

    <p><strong>3. Build cho production</strong>: <code>cargo build --release</code> (opt-level 3). Trong <code>[profile.release]</code>: <code>lto = "thin"</code> hoặc <code>"fat"</code>, <code>codegen-units = 1</code> nhanh thêm vài %, build chậm hơn;
    <code>debug = "line-tables-only"</code> hoặc <code>debug = 1</code> để flamegraph có tên hàm; <code>panic = "abort"</code> nhỏ binary nhưng <strong>làm CatchPanicLayer vô dụng</strong> (panic giết cả process).
    Benchmark ở debug build là vô nghĩa — chậm 10–100 lần.</p>

    <p><strong>4. Đo</strong></p>
    <ul>
      <li><strong>criterion</strong> (micro-benchmark): chạy nhiều vòng, thống kê, so với lần trước ("change: -23%"). Dùng <code>std::hint::black_box</code> để compiler không tối ưu mất phép tính. Tương tự JMH.</li>
      <li><strong>cargo flamegraph</strong> (dùng <code>perf</code> trên Linux, <code>dtrace</code> trên macOS): ảnh SVG, bề ngang = thời gian CPU. Tìm "tháp rộng": <code>alloc</code>, <code>memcpy</code>, <code>clone</code>, serde.</li>
      <li><strong>tokio-console</strong> cho vấn đề async (task bị chặn, poll lâu); <strong>dhat</strong>/<strong>heaptrack</strong> cho cấp phát; tải thật bằng <code>oha</code>/<code>k6</code> xem p99.</li>
    </ul>
    <div class="callout"><p>💡 So với Java: không có JIT nên hiệu năng ổn định ngay từ request đầu; không có GC nên p99 phẳng. Nhưng cũng không có escape analysis tự đặt object lên stack —
    trong Rust bạn quyết định (và thấy) mọi cấp phát.</p></div>
  `,

  codeTabs: [
    { id: "alloc", label: "① Bớt cấp phát", lines: [
      "// Trước: 3 cấp phát mỗi phần tử",
      "fn keys_slow(items: &[Item]) -> Vec<String> {",
      "    let mut out = Vec::new();                         // grow nhiều lần",
      "    for it in items { out.push(format!(\"{}:{}\", it.tenant.clone(), it.id)); }",
      "    out",
      "}",
      "",
      "// Sau: 1 cấp phát Vec + 1 String mỗi phần tử, không clone tenant",
      "fn keys_fast(items: &[Item]) -> Vec<String> {",
      "    let mut out = Vec::with_capacity(items.len());",
      "    for it in items {",
      "        let mut s = String::with_capacity(it.tenant.len() + 21);",
      "        write!(s, \"{}:{}\", it.tenant, it.id).unwrap();   // use std::fmt::Write",
      "        out.push(s);",
      "    }",
      "    out",
      "}"
    ]},
    { id: "cow", label: "② Cow, Arc<str>, Bytes", lines: [
      "fn normalize(sku: &str) -> Cow<'_, str> {",
      "    if sku.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) {",
      "        Cow::Borrowed(sku)                  // 99% trường hợp: không cấp phát",
      "    } else {",
      "        Cow::Owned(sku.to_ascii_uppercase())",
      "    }",
      "}",
      "",
      "#[derive(Clone)]",
      "struct Tenant { name: Arc<str>, region: Arc<str> }   // clone = +1 refcount",
      "",
      "let body: Bytes = resp.bytes().await?;",
      "let header = body.slice(0..16);             // không copy, chung buffer"
    ]},
    { id: "bench", label: "③ criterion", lines: [
      "# Cargo.toml",
      "[dev-dependencies]",
      "criterion = \"0.5\"                 # hoặc bản mới hơn trên crates.io",
      "[[bench]]",
      "name = \"keys\"",
      "harness = false",
      "",
      "// benches/keys.rs",
      "use criterion::{criterion_group, criterion_main, Criterion};",
      "use std::hint::black_box;",
      "fn bench(c: &mut Criterion) {",
      "    let items = sample_items(10_000);",
      "    c.bench_function(\"keys_slow\", |b| b.iter(|| keys_slow(black_box(&items))));",
      "    c.bench_function(\"keys_fast\", |b| b.iter(|| keys_fast(black_box(&items))));",
      "}",
      "criterion_group!(benches, bench);",
      "criterion_main!(benches);",
      "// cargo bench  ->  keys_fast  time: [412 µs ...]  change: [-41.2% ...]"
    ]},
    { id: "prof", label: "④ Profile & flamegraph", lines: [
      "# Cargo.toml",
      "[profile.release]",
      "lto = \"thin\"",
      "codegen-units = 1",
      "debug = \"line-tables-only\"          # flamegraph có tên hàm + dòng",
      "# panic = \"abort\"                   # cẩn thận: panic giết cả process",
      "",
      "cargo install flamegraph",
      "cargo flamegraph --bin order-svc     # chạy tải bằng oha rồi Ctrl+C",
      "oha -z 30s -c 50 http://localhost:8080/orders/42",
      "",
      "// main.rs — thử allocator khác",
      "#[global_allocator]",
      "static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;"
    ]},
    { id: "java", label: "⑤ Đối chiếu Java", lines: [
      "// JMH ~ criterion",
      "@Benchmark public List<String> keys(State s) { return s.items.stream()",
      "    .map(i -> i.tenant() + \":\" + i.id()).toList(); }",
      "",
      "// async-profiler -> flamegraph ~ cargo flamegraph",
      "// JIT + escape analysis có thể xoá cấp phát tạm; Rust: bạn tự quyết định",
      "// GC pause ảnh hưởng p99; Rust: drop xác định, p99 phẳng hơn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="m"><div class="nl">📏 Đo trước</div><div class="ns">oha/k6 → p50/p99, CPU</div></div>
    <div class="arrow" id="a1">↓ chỗ nào nóng?</div>
    <div class="node" id="fg"><div class="nl">🔥 cargo flamegraph</div><div class="ns">tháp rộng: alloc, memcpy, clone, serde</div></div>
    <div class="arrow" id="a2">↓ sửa</div>
    <div class="row">
      <div class="node" id="cap"><div class="nl">📦 with_capacity</div><div class="ns">tái dùng buffer</div></div>
      <div class="node" id="cow"><div class="nl">🐄 Cow / Arc&lt;str&gt; / Bytes</div><div class="ns">chia sẻ thay vì copy</div></div>
    </div>
    <div class="arrow" id="a3">↓ chứng minh</div>
    <div class="node" id="cr"><div class="nl">📊 criterion</div><div class="ns">change: -41%</div></div>
  `,
  steps: [
    { title: "1 · Nhận diện cấp phát thừa", tab: "alloc", highlight: [3, 4], on: ["m", "a1", "fg"],
      desc: "<code>Vec::new()</code> grow nhiều lần, <code>tenant.clone()</code> cấp phát vô ích, <code>format!</code> tạo String mới — flamegraph sẽ thấy <code>alloc</code>/<code>memcpy</code> rộng." },
    { title: "2 · Cấp phát đúng một lần", tab: "alloc", highlight: [10, 12, 13], on: ["a2", "cap"],
      desc: "Biết trước kích thước → with_capacity. Ghi thẳng vào String bằng write!, mượn tenant thay vì clone." },
    { title: "3 · Cow: cấp phát khi cần", tab: "cow", highlight: [1, 3, 5], on: ["cow"],
      desc: "Đa số SKU đã chuẩn → trả tham chiếu. Chỉ ca hiếm mới cấp phát." },
    { title: "4 · Chia sẻ dữ liệu bất biến", tab: "cow", highlight: [10, 12, 13], on: ["cow"],
      desc: "Arc<str> clone chỉ tăng refcount; Bytes slice không copy — hợp payload mạng." },
    { title: "5 · Chứng minh bằng criterion", tab: "bench", highlight: [6, 10, 13, 14, 18], on: ["a3", "cr"],
      desc: "harness = false để criterion tự làm main. black_box ngăn compiler xoá phép tính. Báo cáo so sánh với lần chạy trước." },
    { title: "6 · Build & profile đúng cách", tab: "prof", highlight: [3, 4, 5, 6, 9, 13, 14], on: ["fg"],
      desc: "Profile release có debug line-tables để flamegraph đọc được. panic=abort làm mất CatchPanicLayer." }
  ],

  quiz: [
    { q: "Move một String tốn gì?", options: [
        "Copy toàn bộ nội dung", "Copy 3 word (ptr, len, cap), không cấp phát", "Một cấp phát heap", "Một phép atomic"
      ], correct: 1, explanation: "Clone mới copy nội dung." },
    { q: "Arc::clone tốn gì?", options: [
        "Copy dữ liệu bên trong", "Một phép tăng refcount atomic", "Cấp phát mới", "Không tốn gì"
      ], correct: 1, explanation: "Rẻ nhưng có thể tranh chấp cache line khi mọi core clone liên tục." },
    { q: "Hàm chuẩn hoá chuỗi mà đa số input đã chuẩn, kiểu trả về tốt nhất?", options: [
        "String", "Cow<'_, str>", "&'static str", "Box<str>"
      ], correct: 1, explanation: "Borrowed khi không sửa, Owned khi phải sửa." },
    { q: "Vì sao benchmark bằng debug build là sai?", options: [
        "Debug không chạy được",
        "Không tối ưu, chậm 10–100 lần và phân bố thời gian khác hẳn release",
        "Debug dùng GC",
        "Không có lý do"
      ], correct: 1, explanation: "Luôn đo với --release (cargo bench mặc định dùng profile bench tối ưu)." },
    { q: "std::hint::black_box trong benchmark để làm gì?", options: [
        "Mã hoá dữ liệu",
        "Ngăn compiler suy luận và tối ưu mất phép tính đang đo",
        "Tăng tốc",
        "Ẩn log"
      ], correct: 1, explanation: "Nếu kết quả không dùng, LLVM có thể xoá cả vòng lặp." },
    { q: "Trên flamegraph, điều gì đáng chú ý nhất?", options: [
        "Tháp cao nhất",
        "Khối rộng nhất (chiếm nhiều thời gian CPU), ví dụ alloc/memcpy/clone",
        "Màu đỏ",
        "Hàm main"
      ], correct: 1, explanation: "Bề ngang = tỉ lệ thời gian; chiều cao = độ sâu stack." },
    { q: "Đặt panic = \"abort\" trong profile release có hệ quả gì với service axum?", options: [
        "Không ảnh hưởng",
        "Panic giết cả process; CatchPanicLayer không còn tác dụng",
        "Nhanh gấp đôi",
        "Tắt mọi log"
      ], correct: 1, explanation: "Đổi lại binary nhỏ hơn chút." },
    { q: "bytes::Bytes hợp nhất cho?", options: [
        "Chuỗi UTF-8 cần sửa",
        "Payload mạng bất biến: slice/clone không copy, chia sẻ chung buffer",
        "Số nguyên lớn",
        "Khoá Mutex"
      ], correct: 1, explanation: "hyper, axum, reqwest, rdkafka đều dùng." },
    { q: "Tương đương JMH trong Rust là?", options: [
        "cargo test", "criterion", "clippy", "miri"
      ], correct: 1, explanation: "Thống kê nhiều vòng, so sánh với baseline." },
    { q: "Vì sao Rust service thường có p99 ổn định hơn service JVM?", options: [
        "Rust dùng nhiều thread hơn",
        "Không có GC pause và không cần JIT warm-up; giải phóng bộ nhớ xác định",
        "Rust không cấp phát heap",
        "Rust tự cache"
      ], correct: 1, explanation: "Nhưng cấp phát thừa vẫn làm tăng latency trung bình." }
  ]
});
