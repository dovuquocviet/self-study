window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Ranh giới: unsafe, FFI, macro, WASM",
  title: "unsafe & FFI — và UniFFI để dùng chung Rust với Kotlin/Swift",
  subtitle: "5 siêu năng lực của unsafe · safe wrapper · extern \"C\" · #[unsafe(no_mangle)] · ai giải phóng bộ nhớ · UniFFI: Record, Object, Error, async",

  theory: `
    <p><code>unsafe</code> không tắt borrow checker. Nó chỉ mở khoá <strong>5 thao tác</strong> mà compiler không tự chứng minh được là an toàn, và chuyển trách nhiệm chứng minh sang bạn:</p>
    <ol>
      <li>Dereference raw pointer <code>*const T</code> / <code>*mut T</code>.</li>
      <li>Gọi hàm <code>unsafe fn</code> (kể cả hàm C qua FFI).</li>
      <li>Đọc/ghi <code>static mut</code>.</li>
      <li>Impl <code>unsafe trait</code> (vd <code>unsafe impl Send</code>).</li>
      <li>Truy cập field của <code>union</code>.</li>
    </ol>
    <p>Nguyên tắc: gói phần unsafe nhỏ nhất có thể trong một hàm/kiểu <strong>safe</strong>, ghi comment <code>// SAFETY:</code> giải thích vì sao bất biến được giữ. <code>Vec</code>, <code>String</code>, <code>Arc</code>, <code>Mutex</code> đều làm vậy.
    Nếu code unsafe vi phạm bất biến → <em>undefined behavior</em>: có thể chạy đúng hôm nay, sai khi đổi compiler. Công cụ kiểm tra: <code>cargo +nightly miri test</code>.
    Trong code service thông thường bạn gần như không cần viết <code>unsafe</code>; bạn gặp nó ở FFI.</p>

    <p><strong>FFI với C</strong> (≈ JNI/JNA/Panama của Java)</p>
    <ul>
      <li>Gọi C: khai báo trong <code>unsafe extern "C" { fn ...; }</code> (edition 2024 bắt buộc chữ <code>unsafe</code>), kiểu dùng <code>std::ffi::{CStr, CString, c_char, c_int}</code>, struct gắn <code>#[repr(C)]</code>. Crate <code>bindgen</code> sinh khai báo từ file .h.</li>
      <li>Cho C gọi Rust: <code>#[unsafe(no_mangle)] pub extern "C" fn</code> (edition 2024; trước đó là <code>#[no_mangle]</code>), build <code>crate-type = ["cdylib"]</code> (.so/.dylib) hoặc <code>"staticlib"</code> (.a cho iOS).</li>
      <li>Quy tắc sống còn: <strong>bên nào cấp phát thì bên đó giải phóng</strong>. Trả <code>CString::into_raw()</code> cho C thì phải xuất thêm hàm <code>free_string</code> gọi <code>CString::from_raw</code>. Panic không được vượt qua ranh giới FFI.</li>
    </ul>

    <p><strong>UniFFI — không viết tay JNI/C header</strong></p>
    <p>Mozilla UniFFI sinh binding Kotlin, Swift (và Python, Ruby) từ Rust: bạn đánh dấu API bằng proc macro, nó sinh lớp "C ABI" ở giữa và code Kotlin/Swift idiomatic ở hai đầu.
    Đây là cách chia sẻ logic nghiệp vụ (tính giá, validate, đồng bộ offline, mã hoá) giữa Android và iOS native — cạnh tranh với KMP ở phần "shared core".</p>
    <table>
      <tr><th>Rust</th><th>Kotlin</th><th>Swift</th></tr>
      <tr><td><code>#[derive(uniffi::Record)] struct</code> (giá trị, copy qua ranh giới)</td><td><code>data class</code></td><td><code>struct</code></td></tr>
      <tr><td><code>#[derive(uniffi::Enum)]</code></td><td><code>enum</code>/<code>sealed class</code></td><td><code>enum</code></td></tr>
      <tr><td><code>#[derive(uniffi::Object)]</code> + <code>Arc&lt;Self&gt;</code> (tham chiếu, có method)</td><td>class (<code>AutoCloseable</code>, nên <code>.use {}</code>)</td><td>class (giải phóng khi ARC về 0)</td></tr>
      <tr><td><code>#[derive(uniffi::Error)]</code> + <code>Result&lt;T, E&gt;</code></td><td>exception</td><td><code>throws</code></td></tr>
      <tr><td><code>#[uniffi::export] async fn</code></td><td><code>suspend fun</code></td><td><code>async</code></td></tr>
    </table>
    <p>Build: Android dùng <code>cargo-ndk</code> sinh <code>.so</code> cho từng ABI (arm64-v8a, armeabi-v7a, x86_64) vào <code>jniLibs</code>; iOS build <code>staticlib</code> cho các target
    (<code>aarch64-apple-ios</code>, <code>aarch64-apple-ios-sim</code>) rồi gói <code>.xcframework</code>. Sinh binding ở "library mode": <code>uniffi-bindgen generate --library &lt;lib&gt; --language kotlin</code>.</p>
    <div class="callout"><p>💡 Object của UniFFI phải <code>Send + Sync</code> vì Kotlin/Swift có thể gọi từ nhiều thread — state bên trong dùng <code>Mutex</code>. Và mỗi lời gọi qua ranh giới có chi phí
    (copy Record, serialize): thiết kế API "thô" (ít lời gọi, mỗi lời gọi làm nhiều việc), đừng gọi Rust trong vòng lặp render UI.</p></div>
  `,

  codeTabs: [
    { id: "unsafe", label: "① Safe wrapper", lines: [
      "/// Trả phần tử giữa của slice không rỗng.",
      "pub fn middle<T>(xs: &[T]) -> Option<&T> {",
      "    if xs.is_empty() { return None; }",
      "    let i = xs.len() / 2;",
      "    // SAFETY: xs không rỗng nên 0 <= i < xs.len()",
      "    Some(unsafe { xs.get_unchecked(i) })",
      "}",
      "",
      "// Kiểm tra UB trong test:",
      "// rustup +nightly component add miri",
      "// cargo +nightly miri test"
    ]},
    { id: "ffi", label: "② FFI thô với C", lines: [
      "use std::ffi::{c_char, CStr, CString};",
      "",
      "unsafe extern \"C\" {",
      "    fn strlen(s: *const c_char) -> usize;          // gọi hàm C",
      "}",
      "",
      "#[unsafe(no_mangle)]",
      "pub extern \"C\" fn greet(name: *const c_char) -> *mut c_char {",
      "    // SAFETY: phía C hứa truyền chuỗi kết thúc NUL, còn sống trong lời gọi",
      "    let name = unsafe { CStr::from_ptr(name) }.to_string_lossy();",
      "    CString::new(format!(\"hello {name}\")).unwrap().into_raw()   // Rust cấp phát",
      "}",
      "",
      "#[unsafe(no_mangle)]",
      "pub extern \"C\" fn greet_free(p: *mut c_char) {",
      "    if !p.is_null() { unsafe { drop(CString::from_raw(p)) } }   // Rust giải phóng",
      "}"
    ]},
    { id: "uniffi", label: "③ UniFFI Rust", lines: [
      "uniffi::setup_scaffolding!();",
      "",
      "#[derive(uniffi::Record)]",
      "pub struct CartLine { pub sku: String, pub qty: u32, pub unit_price: i64 }",
      "",
      "#[derive(Debug, thiserror::Error, uniffi::Error)]",
      "pub enum PricingError {",
      "    #[error(\"invalid coupon {code}\")] InvalidCoupon { code: String },",
      "}",
      "",
      "#[derive(uniffi::Object)]",
      "pub struct PricingEngine { rules: std::sync::Mutex<Vec<Rule>> }",
      "",
      "#[uniffi::export]",
      "impl PricingEngine {",
      "    #[uniffi::constructor]",
      "    pub fn new() -> Arc<Self> { Arc::new(Self { rules: Default::default() }) }",
      "    pub fn total(&self, lines: Vec<CartLine>, coupon: Option<String>) -> Result<i64, PricingError> {",
      "        /* logic dùng chung Android + iOS + backend */ Ok(0)",
      "    }",
      "}"
    ]},
    { id: "mobile", label: "④ Kotlin & Swift", lines: [
      "// Kotlin (Android) — binding sinh tự động",
      "val engine = PricingEngine()",
      "try {",
      "    val total = engine.total(listOf(CartLine(\"SKU1\", 2u, 99_000L)), coupon = \"SALE10\")",
      "} catch (e: PricingException.InvalidCoupon) { showError(e.code) }",
      "engine.close()                         // hoặc engine.use { ... }",
      "",
      "// Swift (iOS)",
      "let engine = PricingEngine()",
      "do {",
      "    let total = try engine.total(lines: [CartLine(sku: \"SKU1\", qty: 2, unitPrice: 99_000)], coupon: \"SALE10\")",
      "} catch PricingError.InvalidCoupon(let code) { showError(code) }"
    ]},
    { id: "build", label: "⑤ Build", lines: [
      "# Cargo.toml",
      "[lib]",
      "crate-type = [\"cdylib\", \"staticlib\", \"lib\"]",
      "",
      "# Android: .so cho từng ABI vào jniLibs",
      "cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 -o app/src/main/jniLibs build --release",
      "",
      "# iOS: staticlib cho máy thật + simulator -> xcframework",
      "cargo build --release --target aarch64-apple-ios",
      "cargo build --release --target aarch64-apple-ios-sim",
      "",
      "# Sinh binding (library mode, đọc metadata từ thư viện đã build)",
      "cargo run --bin uniffi-bindgen generate --library target/release/libpricing.so --language kotlin --out-dir out/kotlin"
    ]}
  ],

  stageHtml: `
    <div class="node" id="core"><div class="nl">🦀 Rust core</div><div class="ns">PricingEngine · CartLine · PricingError</div></div>
    <div class="arrow" id="a1">↓ #[uniffi::export] → C ABI (extern \"C\")</div>
    <div class="node" id="abi"><div class="nl">🔌 Lớp FFI sinh tự động</div><div class="ns">serialize Record · handle Object · Result → exception</div></div>
    <div class="row">
      <div class="node" id="kt"><div class="nl">🤖 Kotlin</div><div class="ns">.so trong jniLibs (JNA)</div></div>
      <div class="node" id="sw"><div class="nl">🍎 Swift</div><div class="ns">.xcframework</div></div>
    </div>
    <div class="node" id="us"><div class="nl">⚠️ unsafe</div><div class="ns">gói nhỏ · // SAFETY: · kiểm bằng miri</div></div>
  `,
  steps: [
    { title: "1 · unsafe có giới hạn", tab: "unsafe", highlight: [3, 5, 6], on: ["us"],
      desc: "Chỉ bỏ kiểm tra biên ở một chỗ đã chứng minh bằng điều kiện phía trên. Hàm bên ngoài vẫn safe." },
    { title: "2 · FFI thô: ai cấp phát, người đó giải phóng", tab: "ffi", highlight: [3, 4, 7, 8, 10, 11, 16], on: ["us", "abi"],
      desc: "Rust tạo CString và into_raw cho C; C phải gọi lại greet_free để Rust giải phóng. Gọi free() của C trên con trỏ này là UB." },
    { title: "3 · Khai báo API bằng UniFFI", tab: "uniffi", highlight: [1, 3, 6, 11, 14, 16, 18], on: ["core", "a1"],
      desc: "Record = giá trị, Object = tham chiếu Arc có method, Error = exception phía mobile. Không viết một dòng JNI hay C header." },
    { title: "4 · Dùng ở Kotlin & Swift", tab: "mobile", highlight: [2, 4, 5, 6, 9, 11, 12], on: ["abi", "kt", "sw"],
      desc: "Binding idiomatic: data class, exception, close()/use cho Object ở Kotlin; try/catch và ARC ở Swift." },
    { title: "5 · Build cho từng nền tảng", tab: "build", highlight: [3, 6, 9, 10, 13], on: ["kt", "sw"],
      desc: "cdylib cho Android, staticlib cho iOS. Binding sinh từ metadata trong thư viện đã build." }
  ],

  quiz: [
    { q: "unsafe có tắt borrow checker trong khối đó không?", options: [
        "Có",
        "Không — chỉ mở thêm 5 thao tác như deref raw pointer, gọi unsafe fn, static mut...",
        "Tắt mọi kiểm tra kiểu",
        "Tắt cả panic"
      ], correct: 1, explanation: "Tham chiếu thường trong khối unsafe vẫn bị kiểm tra như mọi nơi." },
    { q: "Comment // SAFETY: dùng để làm gì?", options: [
        "Tắt cảnh báo",
        "Giải thích vì sao bất biến cần cho thao tác unsafe được đảm bảo tại đó",
        "Bắt buộc bởi compiler",
        "Đánh dấu code bảo mật"
      ], correct: 1, explanation: "Clippy có lint undocumented_unsafe_blocks để bắt buộc." },
    { q: "Rust trả CString::into_raw() cho C. Ai giải phóng và bằng cách nào?", options: [
        "C gọi free()",
        "Rust, qua một hàm xuất ra (vd greet_free) gọi CString::from_raw",
        "Không cần giải phóng",
        "GC của hệ điều hành"
      ], correct: 1, explanation: "Hai allocator có thể khác nhau; free() của C trên bộ nhớ Rust là UB." },
    { q: "Công cụ phát hiện undefined behavior trong code unsafe khi chạy test?", options: [
        "clippy", "miri", "rustfmt", "cargo audit"
      ], correct: 1, explanation: "cargo +nightly miri test." },
    { q: "Trong UniFFI, kiểu nào nên dùng cho dữ liệu thuần truyền qua lại (copy giá trị)?", options: [
        "uniffi::Object", "uniffi::Record", "uniffi::Error", "Box<dyn Any>"
      ], correct: 1, explanation: "Record thành data class (Kotlin) / struct (Swift)." },
    { q: "uniffi::Object phía Rust được giữ bằng gì và vì sao phải Send + Sync?", options: [
        "Box; không cần Sync",
        "Arc<Self>; Kotlin/Swift có thể gọi method từ nhiều thread",
        "Rc; chạy một thread",
        "&'static; không giải phóng"
      ], correct: 1, explanation: "State thay đổi được bên trong cần Mutex/atomic." },
    { q: "#[uniffi::export] async fn phía Kotlin trở thành?", options: [
        "Callback", "suspend fun", "Thread", "RxJava Observable"
      ], correct: 1, explanation: "Phía Swift là async func." },
    { q: "Android cần thư viện Rust dạng gì?", options: [
        "staticlib .a", "cdylib .so cho từng ABI, đặt trong jniLibs", ".jar", ".aar thuần Java"
      ], correct: 1, explanation: "cargo-ndk giúp build cho arm64-v8a, armeabi-v7a, x86_64." },
    { q: "Nguyên tắc thiết kế API qua ranh giới UniFFI?", options: [
        "Gọi Rust cho từng pixel",
        "API thô: ít lời gọi, mỗi lời gọi làm nhiều việc, vì mỗi lần vượt ranh giới có chi phí copy/serialize",
        "Mọi thứ là Object",
        "Không trả lỗi"
      ], correct: 1, explanation: "Giống nguyên tắc với JNI." },
    { q: "Trong edition 2024, xuất hàm cho C gọi viết thế nào?", options: [
        "#[export] fn",
        "#[unsafe(no_mangle)] pub extern \"C\" fn ...",
        "pub fn với #[c]",
        "extern fn không cần attribute"
      ], correct: 1, explanation: "no_mangle giờ là unsafe attribute; edition cũ viết #[no_mangle]." }
  ]
});
