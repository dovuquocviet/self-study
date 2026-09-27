window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Thực chiến backend",
  title: "Tổng kết: bản đồ tư duy Rust cho dev Java",
  subtitle: "ownership → borrow → lifetime · enum/Option/Result · trait · Send/Sync · async · checklist review code · đọc lỗi compiler",

  theory: `
    <p>Toàn bộ khoá xoay quanh một ý: <strong>compiler biết ai sở hữu dữ liệu và ai đang nhìn nó</strong>, nên tự giải phóng bộ nhớ và chặn race — thay cho GC và kỷ luật của lập trình viên.</p>

    <table>
      <tr><th>Câu hỏi khi viết code</th><th>Câu trả lời Rust</th><th>Bài</th></tr>
      <tr><td>Hàm cần sở hữu hay chỉ nhìn?</td><td>Sở hữu: <code>T</code> · đọc: <code>&amp;T</code> / <code>&amp;str</code> / <code>&amp;[T]</code> · sửa: <code>&amp;mut T</code></td><td>04–06</td></tr>
      <tr><td>Có thể không có giá trị?</td><td><code>Option&lt;T&gt;</code></td><td>09</td></tr>
      <tr><td>Có thể thất bại?</td><td><code>Result&lt;T, E&gt;</code> + <code>?</code>; thiserror (domain) / anyhow (app)</td><td>09–10</td></tr>
      <tr><td>Nhiều trạng thái có dữ liệu khác nhau?</td><td><code>enum</code> + <code>match</code> vét cạn</td><td>08</td></tr>
      <tr><td>Trừu tượng hoá hành vi?</td><td>trait + generic (mặc định) · <code>dyn Trait</code> khi cần linh hoạt lúc chạy</td><td>11–12</td></tr>
      <tr><td>Nhiều chủ sở hữu?</td><td><code>Rc</code> (1 thread) · <code>Arc</code> (đa luồng)</td><td>16</td></tr>
      <tr><td>Sửa dữ liệu dùng chung?</td><td><code>RefCell</code> (1 thread) · <code>Mutex</code>/<code>RwLock</code> (đa luồng)</td><td>16–17</td></tr>
      <tr><td>Chờ I/O mà không tốn thread?</td><td><code>async</code>/<code>.await</code> trên Tokio; không block; CPU nặng → <code>spawn_blocking</code></td><td>18</td></tr>
      <tr><td>Web API?</td><td>axum (Router, extractor, IntoResponse) + sqlx (pool, bind, migrate)</td><td>19</td></tr>
    </table>

    <p><strong>Đọc lỗi compiler — 5 mã hay gặp nhất</strong></p>
    <ul>
      <li><code>E0382</code> use of moved value → giá trị đã move; mượn (<code>&amp;</code>) thay vì chuyển, hoặc clone nếu thật cần hai bản.</li>
      <li><code>E0502</code> / <code>E0499</code> cannot borrow as mutable → đang có &amp; (hoặc &amp;mut khác) còn sống; sắp lại thứ tự, thu hẹp scope.</li>
      <li><code>E0597</code> does not live long enough → tham chiếu sống lâu hơn dữ liệu; trả về giá trị sở hữu.</li>
      <li><code>E0277</code> trait bound not satisfied (vd not Send) → kiểu thiếu trait; với thread/task: Rc → Arc, RefCell → Mutex, thả guard trước .await.</li>
      <li><code>E0308</code> mismatched types → hay gặp: thừa <code>;</code> ở dòng cuối, quên <code>Some()</code>/<code>Ok()</code>, lẫn <code>String</code>/<code>&amp;str</code>.</li>
    </ul>
    <p>Thông báo lỗi của rustc thường kèm gợi ý sửa ("help: consider borrowing here"). <code>rustc --explain E0382</code> in giải thích chi tiết.</p>

    <p><strong>Checklist review một PR Rust</strong></p>
    <ol>
      <li><code>unwrap()</code>/<code>expect()</code> trên dữ liệu bên ngoài? → trả lỗi.</li>
      <li><code>.clone()</code> rải rác để né borrow checker? → xem lại có mượn được không.</li>
      <li>Lời gọi blocking trong <code>async fn</code>? (<code>std::thread::sleep</code>, IO đồng bộ, CPU nặng)</li>
      <li>Giữ <code>MutexGuard</code> qua <code>.await</code> hoặc giữ khoá lâu?</li>
      <li><code>_ =&gt;</code> nuốt variant trong match enum nghiệp vụ?</li>
      <li>SQL nối chuỗi thay vì <code>.bind()</code>?</li>
      <li>Có <code>unsafe</code> không? Nếu có, đã ghi rõ bất biến (// SAFETY:) chưa?</li>
      <li><code>cargo clippy -- -D warnings</code> và <code>cargo fmt --check</code> đã xanh trong CI?</li>
    </ol>

    <div class="callout"><p>💡 Học tiếp: khoá <strong>"Rust nâng cao cho backend"</strong> (lifetime nâng cao, async sâu với Pin/Waker, tower middleware, tracing, hiệu năng, UniFFI chia sẻ Rust cho mobile, WASM cho Cloudflare Workers).
    Tài liệu chính thức: <em>The Rust Programming Language</em> (doc.rust-lang.org/book), <em>Rust by Example</em>, <em>Tokio tutorial</em> (tokio.rs), và bài tập <em>rustlings</em>.</p></div>
  `,

  codeTabs: [
    { id: "map", label: "Tất cả trong một", lines: [
      "#[derive(Debug, thiserror::Error)]",
      "enum OrderError {                                    // enum lỗi (bài 08, 10)",
      "    #[error(\"không tìm thấy {0}\")] NotFound(u64),",
      "    #[error(transparent)] Db(#[from] sqlx::Error),",
      "}",
      "",
      "trait OrderRepo: Send + Sync {                       // trait + Send/Sync (11, 17)",
      "    async fn find(&self, id: u64) -> Result<Option<Order>, sqlx::Error>;",
      "}",
      "",
      "struct OrderService<R: OrderRepo> { repo: Arc<R> }   // generic + Arc (11, 16)",
      "",
      "impl<R: OrderRepo> OrderService<R> {",
      "    async fn total(&self, ids: &[u64]) -> Result<u64, OrderError> {  // &[T] (06)",
      "        let mut sum = 0;",
      "        for &id in ids {",
      "            let o = self.repo.find(id).await?               // ? + From (10), async (18)",
      "                .ok_or(OrderError::NotFound(id))?;           // Option -> Result (09)",
      "            sum += o.items.iter().map(|i| i.price).sum::<u64>();  // iterator (14)",
      "        }",
      "        Ok(sum)",
      "    }",
      "}"
    ]},
    { id: "errs", label: "Đọc lỗi compiler", lines: [
      "error[E0382]: borrow of moved value: `cart`",
      "  --> src/main.rs:5:20",
      "3 |     let cart = vec![1, 2];",
      "  |         ---- move occurs because `cart` has type `Vec<i32>`, which does not implement the `Copy` trait",
      "4 |     consume(cart);",
      "  |             ---- value moved here",
      "5 |     println!(\"{:?}\", cart);",
      "  |                      ^^^^ value borrowed here after move",
      "help: consider changing this parameter type in function `consume` to borrow instead",
      "",
      "$ rustc --explain E0382"
    ]},
    { id: "ci", label: "CI tối thiểu", lines: [
      "# .github/workflows/ci.yml (hoặc .gitlab-ci.yml tương tự)",
      "$ cargo fmt --all -- --check           # format",
      "$ cargo clippy --all-targets -- -D warnings   # lint, cảnh báo = lỗi",
      "$ cargo test --all                     # unit + integration + doc test",
      "$ cargo build --release                # binary production",
      "",
      "# Dockerfile nhiều stage",
      "# FROM rust:1 AS build",
      "# RUN cargo build --release",
      "# FROM gcr.io/distroless/cc",
      "# COPY --from=build /app/target/release/order-svc /order-svc",
      "# ENTRYPOINT [\"/order-svc\"]"
    ]},
    { id: "cmp", label: "Java ↔ Rust (tóm tắt)", lines: [
      "// Java                          // Rust",
      "// GC                            ownership + drop khi ra scope",
      "// null / NPE                    Option<T>",
      "// throw / try-catch             Result<T, E> + ?",
      "// interface / extends           trait / (không kế thừa class)",
      "// generic type erasure          monomorphization",
      "// synchronized                  Mutex<T> chứa dữ liệu",
      "// thread pool / virtual thread  Tokio async",
      "// Spring MVC / JPA              axum / sqlx",
      "// JUnit / MockMvc               #[test] / oneshot",
      "// Maven                         Cargo"
    ]}
  ],

  stageHtml: `
    <div class="node" id="own"><div class="nl">👑 Ownership</div><div class="ns">một chủ, drop khi ra scope</div></div>
    <div class="arrow" id="a1">↓ cho mượn</div>
    <div class="node" id="bor"><div class="nl">🤝 Borrow &amp; lifetime</div><div class="ns">nhiều &amp; hoặc một &amp;mut</div></div>
    <div class="arrow" id="a2">↓ mô hình hoá</div>
    <div class="row">
      <div class="node" id="ty"><div class="nl">🏷️ enum · Option · Result</div><div class="ns">không null, không exception</div></div>
      <div class="node" id="tr"><div class="nl">📜 trait · generic · dyn</div><div class="ns">trừu tượng không tốn phí</div></div>
    </div>
    <div class="arrow" id="a3">↓ chia sẻ &amp; đồng thời</div>
    <div class="row">
      <div class="node" id="cc"><div class="nl">🧵 Arc · Mutex · Send/Sync</div><div class="ns">không data race</div></div>
      <div class="node" id="as"><div class="nl">⚡ async · Tokio · axum · sqlx</div><div class="ns">service thật</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Nền móng: ownership & borrow", tab: "cmp", highlight: [2], on: ["own", "a1", "bor"],
      desc: "Thay GC bằng quy tắc sở hữu. Mọi thứ phía sau (thread-safety, async Send) đều dựng trên nền này." },
    { title: "2 · Mô hình dữ liệu", tab: "map", highlight: [2, 3, 4, 18], on: ["a2", "ty"],
      desc: "Enum lỗi có kiểu, Option cho 'không có', ok_or để nối hai thế giới." },
    { title: "3 · Trừu tượng", tab: "map", highlight: [7, 11, 13, 19], on: ["tr"],
      desc: "Trait + generic cho static dispatch; iterator zero-cost. (async fn trong trait có từ Rust 1.75 — khi cần dyn thì dùng crate async-trait.)" },
    { title: "4 · Đồng thời & service", tab: "map", highlight: [7, 11, 17], on: ["a3", "cc", "as"],
      desc: "Send + Sync, Arc, async/await — compiler kiểm tra rằng service không có data race." },
    { title: "5 · Đọc lỗi & CI", tab: "errs", highlight: [1, 4, 6, 8, 9, 11], on: ["own"],
      desc: "Lỗi rustc chỉ đúng dòng move và dòng dùng lại, kèm gợi ý. CI: fmt, clippy -D warnings, test, build --release." }
  ],

  quiz: [
    { q: "Rust giải phóng bộ nhớ heap của một <code>Vec</code> khi nào?", options: [
        "Khi GC chạy", "Khi owner ra khỏi scope (drop)", "Khi gọi free()", "Khi chương trình kết thúc"
      ], correct: 1, explanation: "Ownership + RAII." },
    { q: "Lỗi E0382 \"use of moved value\" — cách sửa đúng tinh thần Rust nhất khi hàm chỉ cần đọc?", options: [
        "Thêm .clone() mọi nơi",
        "Đổi tham số hàm sang mượn (&T / &str / &[T])",
        "Dùng unsafe",
        "Dùng static"
      ], correct: 1, explanation: "Clone chỉ khi thật sự cần hai bản độc lập." },
    { q: "Luật borrow: tại một thời điểm được phép?", options: [
        "Nhiều &mut", "Nhiều & HOẶC một &mut", "Một & và một &mut", "Không giới hạn"
      ], correct: 1, explanation: "Aliasing XOR mutation." },
    { q: "Hàm có thể không tìm thấy bản ghi và cũng có thể lỗi DB nên trả?", options: [
        "Option&lt;Order&gt;", "Result&lt;Option&lt;Order&gt;, DbError&gt;", "Order hoặc null", "panic khi không có"
      ], correct: 1, explanation: "Không có ≠ lỗi; hai khái niệm tách biệt trong kiểu." },
    { q: "Thêm variant mới vào enum nghiệp vụ; lợi ích lớn nhất của match vét cạn?", options: [
        "Chạy nhanh hơn",
        "Compiler chỉ ra mọi chỗ chưa xử lý variant mới",
        "Tự sinh code xử lý",
        "Không có lợi ích"
      ], correct: 1, explanation: "Trừ khi bạn dùng _ => nuốt mất." },
    { q: "Chọn giữa <code>fn f&lt;T: Repo&gt;</code> và <code>Box&lt;dyn Repo&gt;</code>: mặc định nên?", options: [
        "Luôn dyn", "Generic (static dispatch); dyn khi cần linh hoạt lúc chạy/collection nhiều kiểu", "Không quan trọng", "Luôn Box"
      ], correct: 1, explanation: "Generic được inline, không cấp phát." },
    { q: "Config dùng chung cho mọi task Tokio, chỉ đọc. Dùng?", options: [
        "Rc&lt;Config&gt;", "Arc&lt;Config&gt;", "RefCell&lt;Config&gt;", "static mut"
      ], correct: 1, explanation: "Không cần Mutex nếu chỉ đọc." },
    { q: "Bộ đếm dùng chung được nhiều thread cùng tăng. Dùng?", options: [
        "Rc&lt;RefCell&lt;u64&gt;&gt;", "Arc&lt;Mutex&lt;u64&gt;&gt; (hoặc AtomicU64)", "Box&lt;u64&gt;", "&amp;mut u64 cho mỗi thread"
      ], correct: 1, explanation: "Atomic còn nhẹ hơn cho số đơn giản." },
    { q: "Trong handler axum có đoạn <code>std::thread::sleep(1s)</code>. Vấn đề?", options: [
        "Không vấn đề",
        "Chặn worker thread của Tokio, làm chậm các request khác",
        "Lỗi biên dịch",
        "Tokio tự xử lý"
      ], correct: 1, explanation: "Dùng tokio::time::sleep(..).await." },
    { q: "E0277 \"Rc&lt;..&gt; cannot be sent between threads safely\" — sửa thế nào?", options: [
        "Dùng unsafe impl Send", "Đổi Rc sang Arc (và RefCell sang Mutex nếu có)", "Thêm .clone()", "Thêm lifetime"
      ], correct: 1, explanation: "Arc có bộ đếm atomic." },
    { q: "Toán tử <code>?</code> trên <code>Err(e)</code> làm gì?", options: [
        "Panic", "Return Err(From::from(e)) khỏi hàm hiện tại", "Bỏ qua", "Retry"
      ], correct: 1, explanation: "Nên kiểu lỗi của hàm cần impl From cho lỗi tầng dưới." },
    { q: "Tương đương <code>@ControllerAdvice</code> trong axum?", options: [
        "tower Layer", "impl IntoResponse for AppError", "Router::nest", "#[tokio::main]"
      ], correct: 1, explanation: "Handler trả Result<_, AppError>." },
    { q: "Vì sao dùng <code>&str</code> thay <code>String</code> cho tham số chỉ đọc?", options: [
        "Nhanh biên dịch",
        "Không lấy quyền sở hữu; nhận được cả String (qua &) lẫn literal",
        "Bắt buộc",
        "&str an toàn luồng hơn"
      ], correct: 1, explanation: "Deref coercion &String → &str." },
    { q: "Future trong Rust bắt đầu chạy khi nào?", options: [
        "Ngay khi gọi async fn", "Khi được .await hoặc giao cho runtime (spawn)", "Khi GC chạy", "Khi main kết thúc"
      ], correct: 1, explanation: "Future lười, khác CompletableFuture." },
    { q: "Lệnh CI nào biến mọi cảnh báo lint thành lỗi?", options: [
        "cargo check", "cargo clippy -- -D warnings", "cargo fmt", "cargo build --release"
      ], correct: 1, explanation: "-D warnings = deny warnings." },
    { q: "Mẫu test handler axum không cần mở port?", options: [
        "Gọi curl localhost", "router.oneshot(request) với tower::ServiceExt", "Mock tokio", "Không thể"
      ], correct: 1, explanation: "Router là tower Service." }
  ]
});
